export type WsEventHandler = (msg: Record<string, unknown>) => void;

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface AnalyserEntry {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
}

export class OgRealtimeClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners = new Set<WsEventHandler>();
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private onlineBound = false;

  // Room WebRTC voice & live camera state
  private peers = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private remoteAudioEls = new Map<string, HTMLAudioElement>();
  private remoteAnalysers = new Map<string, AnalyserEntry>();
  private localStream: MediaStream | null = null;
  private localVideoStream: MediaStream | null = null;
  private remoteVideoStreams = new Map<string, MediaStream>();
  private videoStreamListeners = new Set<() => void>();
  private localMicPromise: Promise<MediaStream | null> | null = null;
  private localAnalyser: AnalyserEntry | null = null;
  private currentRoomId: string | null = null;
  private micMuted = false;
  private cameraEnabled = false;

  // Game WebRTC voice state
  private gamePeers = new Map<string, RTCPeerConnection>();
  private gamePendingIce = new Map<string, RTCIceCandidateInit[]>();
  private gameRemoteAudioEls = new Map<string, HTMLAudioElement>();
  private gameLocalStream: MediaStream | null = null;
  private currentMatchId: string | null = null;

  private myUserUid: string | null = null;
  private speakerMuted = false;
  private audioCtx: AudioContext | null = null;
  private gestureUnlockBound = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.bindGlobalAudioUnlock();
      this.bindOnlineReconnect();
    }
  }

  private bindOnlineReconnect() {
    if (this.onlineBound || typeof window === 'undefined') return;
    this.onlineBound = true;
    window.addEventListener('online', () => {
      if (this.shouldReconnect && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
        this.reconnectAttempt = 0;
        if (this.reconnectTimer) {
          window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.openSocket();
      }
    });
  }

  private bindGlobalAudioUnlock() {
    if (this.gestureUnlockBound || typeof window === 'undefined') return;
    this.gestureUnlockBound = true;
    const handler = () => {
      void this.unlockAudioPlayback();
    };
    window.addEventListener('pointerdown', handler, { passive: true });
    window.addEventListener('touchstart', handler, { passive: true });
    window.addEventListener('keydown', handler, { passive: true });
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private buildAnalyser(stream: MediaStream): AnalyserEntry | null {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx || stream.getAudioTracks().length === 0) return null;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      return { source, analyser, data };
    } catch {
      return null;
    }
  }

  private disposeAnalyser(entry: AnalyserEntry | null | undefined) {
    if (!entry) return;
    try {
      entry.source.disconnect();
    } catch {
      // ignore
    }
    try {
      entry.analyser.disconnect();
    } catch {
      // ignore
    }
  }

  private computeLevel(entry: AnalyserEntry | null | undefined): number {
    if (!entry) return 0;
    try {
      entry.analyser.getByteFrequencyData(entry.data);
      let sum = 0;
      for (let i = 0; i < entry.data.length; i++) {
        sum += entry.data[i];
      }
      const avg = sum / Math.max(1, entry.data.length);
      return Math.min(1, avg / 75);
    } catch {
      return 0;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getLocalVideoStream(): MediaStream | null {
    return this.localVideoStream;
  }

  public isCameraEnabled(): boolean {
    return this.cameraEnabled;
  }

  public getRemoteVideoStreams(): Record<string, MediaStream> {
    const out: Record<string, MediaStream> = {};
    for (const [uid, stream] of this.remoteVideoStreams.entries()) {
      out[uid] = stream;
    }
    return out;
  }

  public subscribeVideoStreams(fn: () => void): () => void {
    this.videoStreamListeners.add(fn);
    return () => this.videoStreamListeners.delete(fn);
  }

  private emitVideoStreamsChanged() {
    for (const fn of this.videoStreamListeners) {
      try {
        fn();
      } catch {
        // ignore listener failure
      }
    }
  }

  public getLocalMicLevel(): number {
    if (this.micMuted || !this.localStream) return 0;
    const tracks = this.localStream.getAudioTracks();
    if (tracks.length === 0 || !tracks.some((t) => t.enabled && t.readyState === 'live')) {
      return 0;
    }
    return this.computeLevel(this.localAnalyser);
  }

  public getRemoteAudioLevels(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [peerUid, entry] of this.remoteAnalysers.entries()) {
      out[peerUid] = this.speakerMuted ? 0 : this.computeLevel(entry);
    }
    return out;
  }

  public connect(token: string | null, myUserUid: string) {
    this.token = token;
    this.myUserUid = myUserUid;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.openSocket();
  }

  public disconnect() {
    this.shouldReconnect = false;
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.leaveVoiceAudio();
    this.leaveGameVoice();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private openSocket() {
    if (!this.myUserUid) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const tokenQuery = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    const wsUrl = `${proto}//${window.location.host}/ws${tokenQuery}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        await this.handleInternalRtcMessage(msg);
        for (const fn of this.listeners) fn(msg);
      } catch {
        // Ignore malformed packets
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.shouldReconnect) {
        if (this.reconnectTimer) {
          window.clearTimeout(this.reconnectTimer);
        }
        const baseDelay = Math.min(15_000, Math.round(1500 * Math.pow(1.6, this.reconnectAttempt)));
        const jitter = Math.floor(Math.random() * 1200);
        this.reconnectAttempt = Math.min(8, this.reconnectAttempt + 1);
        this.reconnectTimer = window.setTimeout(() => this.openSocket(), baseDelay + jitter);
      }
    };
  }

  public subscribe(fn: WsEventHandler): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public send(payload: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public async unlockAudioPlayback() {
    try {
      const ctx = this.ensureAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      for (const el of [...this.remoteAudioEls.values(), ...this.gameRemoteAudioEls.values()]) {
        el.muted = this.speakerMuted;
        el.volume = this.speakerMuted ? 0 : 1;
        if (!this.speakerMuted && el.paused && el.srcObject) {
          await el.play().catch(() => {});
        }
      }
    } catch {
      // ignore autoplay block until next user gesture
    }
  }

  public setSpeakerMuted(muted: boolean) {
    this.speakerMuted = muted;
    for (const el of [...this.remoteAudioEls.values(), ...this.gameRemoteAudioEls.values()]) {
      el.muted = muted;
      el.volume = muted ? 0 : 1;
      if (!muted && el.srcObject) {
        void el.play().catch(() => {});
      }
    }
    if (!muted) {
      void this.unlockAudioPlayback();
    }
  }

  public isSpeakerMuted(): boolean {
    return this.speakerMuted;
  }

  private async acquireMicStream(): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      return null;
    }
  }

  private async ensureLocalMicStream(): Promise<MediaStream | null> {
    if (this.localStream && this.localStream.getAudioTracks().some((t) => t.readyState === 'live')) {
      return this.localStream;
    }
    if (this.localMicPromise) return this.localMicPromise;
    this.localMicPromise = (async () => {
      const stream = await this.acquireMicStream();
      if (!stream) return null;
      this.localStream = stream;
      this.disposeAnalyser(this.localAnalyser);
      this.localAnalyser = this.buildAnalyser(stream);
      return stream;
    })();
    try {
      return await this.localMicPromise;
    } finally {
      this.localMicPromise = null;
    }
  }

  /**
   * Keeps WebRTC peer connections synchronized for EVERYONE in the room:
   * - Unseated listeners receive live audio from seated speakers (receive-only).
   * - Seated speakers both capture/publish local microphone audio AND receive remote audio.
   */
  public async syncRoomPeers(
    roomId: string,
    participantUids: string[],
    opts: { seated: boolean; muted: boolean }
  ): Promise<MediaStream | null> {
    this.currentRoomId = roomId;
    this.micMuted = opts.muted;
    await this.unlockAudioPlayback();

    let stream: MediaStream | null = null;
    if (opts.seated) {
      stream = await this.ensureLocalMicStream();
      if (stream) {
        for (const track of stream.getAudioTracks()) {
          track.enabled = !opts.muted;
        }
      }
    } else if (this.localStream) {
      // Unseated listeners should not transmit microphone audio
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = false;
      }
    }

    const activePeerSet = new Set(
      participantUids.filter((id) => Boolean(id) && id !== this.myUserUid)
    );

    // Tear down peers who left the room
    for (const [peerUid, pc] of this.peers.entries()) {
      if (!activePeerSet.has(peerUid)) {
        this.cleanupRoomPeer(peerUid, pc);
      }
    }

    // Attach tracks / establish connections with active room peers
    for (const peerUid of activePeerSet) {
      const existingPc = this.peers.get(peerUid);
      if (!existingPc) {
        // Deterministic initiator avoids glare between two joining peers
        if (!this.myUserUid || this.myUserUid < peerUid) {
          await this.createRoomPeerAndOffer(peerUid);
        }
      } else if (stream) {
        let addedNew = false;
        const senders = existingPc.getSenders();
        for (const track of stream.getAudioTracks()) {
          const senderWithTrack = senders.find((s) => s.track?.kind === 'audio');
          if (senderWithTrack) {
            if (senderWithTrack.track !== track) {
              await senderWithTrack.replaceTrack(track).catch(() => {});
            }
          } else {
            existingPc.addTrack(track, stream);
            addedNew = true;
          }
        }
        if (addedNew && existingPc.signalingState === 'stable') {
          await this.renegotiateRoomPeer(peerUid, existingPc);
        }
      }
    }

    return stream;
  }

  public async enableMicAndBroadcast(roomId: string, participantUids: string[]): Promise<MediaStream | null> {
    return this.syncRoomPeers(roomId, participantUids, { seated: true, muted: false });
  }

  public setMicMuted(muted: boolean) {
    this.micMuted = muted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    this.send({ type: 'room:mute', isMuted: muted });
  }

  public async enableRoomCamera(enabled: boolean): Promise<MediaStream | null> {
    if (!enabled) {
      this.cameraEnabled = false;
      if (this.localVideoStream) {
        this.localVideoStream.getTracks().forEach((t) => t.stop());
        this.localVideoStream = null;
      }
      for (const [, pc] of this.peers.entries()) {
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind === 'video') {
            await sender.replaceTrack(null).catch(() => {});
          }
        }
      }
      this.send({ type: 'room:cam-state', hasCamera: false });
      this.emitVideoStreamsChanged();
      return null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API is unavailable on this browser.');
    }
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach((t) => t.stop());
    }
    this.localVideoStream = camStream;
    this.cameraEnabled = true;

    const videoTrack = camStream.getVideoTracks()[0];
    if (videoTrack) {
      for (const [peerUid, pc] of this.peers.entries()) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack).catch(() => {});
        } else {
          pc.addTrack(videoTrack, camStream);
          if (pc.signalingState === 'stable') {
            await this.renegotiateRoomPeer(peerUid, pc);
          }
        }
      }
    }
    this.send({ type: 'room:cam-state', hasCamera: true });
    this.emitVideoStreamsChanged();
    return camStream;
  }

  private cleanupRoomPeer(peerUid: string, pc?: RTCPeerConnection) {
    const conn = pc ?? this.peers.get(peerUid);
    if (conn) {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
    this.peers.delete(peerUid);
    this.pendingIce.delete(peerUid);
    const audio = this.remoteAudioEls.get(peerUid);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      this.remoteAudioEls.delete(peerUid);
    }
    if (this.remoteVideoStreams.delete(peerUid)) {
      this.emitVideoStreamsChanged();
    }
    this.disposeAnalyser(this.remoteAnalysers.get(peerUid));
    this.remoteAnalysers.delete(peerUid);
  }

  public leaveVoiceAudio() {
    for (const [peerUid, pc] of Array.from(this.peers.entries())) {
      this.cleanupRoomPeer(peerUid, pc);
    }
    this.peers.clear();
    this.pendingIce.clear();
    this.remoteAnalysers.clear();
    if (this.remoteVideoStreams.size > 0) {
      this.remoteVideoStreams.clear();
      this.emitVideoStreamsChanged();
    }
    this.disposeAnalyser(this.localAnalyser);
    this.localAnalyser = null;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach((t) => t.stop());
      this.localVideoStream = null;
    }
    this.cameraEnabled = false;
    this.currentRoomId = null;
    this.micMuted = false;
  }

  private getOrCreateRoomPeer(peerUid: string): RTCPeerConnection {
    const existing = this.peers.get(peerUid);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(peerUid, pc);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    } else {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {
        // Fallback to offerToReceiveAudio
      }
    }
    if (this.localVideoStream) {
      for (const track of this.localVideoStream.getVideoTracks()) {
        pc.addTrack(track, this.localVideoStream);
      }
    } else {
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch {
        // Fallback
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && this.currentRoomId) {
        this.send({
          type: 'rtc:ice-candidate',
          targetUid: peerUid,
          candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupRoomPeer(peerUid, pc);
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (e.track.kind === 'video') {
        const videoOnlyStream =
          stream.getVideoTracks().length > 0 ? stream : new MediaStream([e.track]);
        this.remoteVideoStreams.set(peerUid, videoOnlyStream);
        e.track.onended = () => {
          this.remoteVideoStreams.delete(peerUid);
          this.emitVideoStreamsChanged();
        };
        this.emitVideoStreamsChanged();
        return;
      }

      let audio = this.remoteAudioEls.get(peerUid);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.remoteAudioEls.set(peerUid, audio);
      }
      audio.muted = this.speakerMuted;
      audio.volume = this.speakerMuted ? 0 : 1;
      audio.srcObject = stream;
      if (!this.speakerMuted) {
        void audio.play().catch(() => {});
      }

      this.disposeAnalyser(this.remoteAnalysers.get(peerUid));
      const analyser = this.buildAnalyser(stream);
      if (analyser) {
        this.remoteAnalysers.set(peerUid, analyser);
      }
    };

    return pc;
  }

  private async renegotiateRoomPeer(peerUid: string, pc: RTCPeerConnection) {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      this.send({ type: 'rtc:offer', targetUid: peerUid, sdp: pc.localDescription });
    } catch {
      // Ignore transient renegotiation failure
    }
  }

  private async createRoomPeerAndOffer(peerUid: string) {
    const pc = this.getOrCreateRoomPeer(peerUid);
    await this.renegotiateRoomPeer(peerUid, pc);
  }

  private async flushIceQueue(queueMap: Map<string, RTCIceCandidateInit[]>, peerUid: string, pc: RTCPeerConnection) {
    const queued = queueMap.get(peerUid);
    if (!queued || queued.length === 0) return;
    queueMap.delete(peerUid);
    for (const c of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
  }

  // ------------------------------------------------------------------
  // IN-GAME WEBRTC LIVE VOICE CHAT
  // ------------------------------------------------------------------
  public async joinGameVoice(matchId: string): Promise<boolean> {
    this.currentMatchId = matchId;
    await this.unlockAudioPlayback();
    if (!this.gameLocalStream) {
      this.gameLocalStream = await this.acquireMicStream();
      if (!this.gameLocalStream) return false;
    }
    for (const track of this.gameLocalStream.getAudioTracks()) {
      track.enabled = true;
    }
    this.send({ type: 'game:voice-join', matchId, muted: false });
    return true;
  }

  public setGameMicMuted(matchId: string, muted: boolean) {
    if (this.gameLocalStream) {
      for (const track of this.gameLocalStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    this.send({ type: 'game:voice-mute', matchId, muted });
  }

  public leaveGameVoice(matchId?: string) {
    const targetMatch = matchId || this.currentMatchId;
    if (targetMatch) {
      this.send({ type: 'game:voice-leave', matchId: targetMatch });
    }
    for (const pc of this.gamePeers.values()) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    this.gamePeers.clear();
    this.gamePendingIce.clear();
    for (const el of this.gameRemoteAudioEls.values()) {
      el.srcObject = null;
      el.remove();
    }
    this.gameRemoteAudioEls.clear();
    if (this.gameLocalStream) {
      this.gameLocalStream.getTracks().forEach((t) => t.stop());
      this.gameLocalStream = null;
    }
    this.currentMatchId = null;
  }

  private getOrCreateGamePeer(matchId: string, peerUid: string): RTCPeerConnection {
    const existing = this.gamePeers.get(peerUid);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.gamePeers.set(peerUid, pc);

    if (this.gameLocalStream) {
      for (const track of this.gameLocalStream.getTracks()) {
        pc.addTrack(track, this.gameLocalStream);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({
          type: 'game:rtc-ice-candidate',
          matchId,
          targetUid: peerUid,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      let audio = this.gameRemoteAudioEls.get(peerUid);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.gameRemoteAudioEls.set(peerUid, audio);
      }
      audio.muted = this.speakerMuted;
      audio.volume = this.speakerMuted ? 0 : 1;
      audio.srcObject = stream;
      if (!this.speakerMuted) {
        void audio.play().catch(() => {});
      }
    };

    return pc;
  }

  private async handleInternalRtcMessage(msg: Record<string, unknown>) {
    const type = String(msg.type || '');

    if (type === 'game:voice-peers') {
      const matchId = String(msg.matchId || '');
      if (!matchId || matchId !== this.currentMatchId || !this.gameLocalStream) return;
      const peers = Array.isArray(msg.peers) ? (msg.peers as Array<{ publicId?: string }>) : [];
      const activeIds = new Set(peers.map((p) => String(p.publicId || '')).filter(Boolean));

      for (const [peerUid, pc] of this.gamePeers.entries()) {
        if (!activeIds.has(peerUid)) {
          pc.close();
          this.gamePeers.delete(peerUid);
          const audio = this.gameRemoteAudioEls.get(peerUid);
          if (audio) {
            audio.srcObject = null;
            audio.remove();
            this.gameRemoteAudioEls.delete(peerUid);
          }
        }
      }

      for (const peerUid of activeIds) {
        if (peerUid !== this.myUserUid && !this.gamePeers.has(peerUid)) {
          if (!this.myUserUid || this.myUserUid < peerUid) {
            const pc = this.getOrCreateGamePeer(matchId, peerUid);
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            this.send({ type: 'game:rtc-offer', matchId, targetUid: peerUid, sdp: pc.localDescription });
          }
        }
      }
      return;
    }

    const fromUid = String(msg.fromUid || '');
    if (!fromUid) return;

    if (type === 'rtc:offer' && msg.sdp) {
      const pc = this.getOrCreateRoomPeer(fromUid);
      const polite = !this.myUserUid || this.myUserUid < fromUid;
      if (pc.signalingState !== 'stable') {
        if (!polite) return;
        await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
      }
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
      await this.flushIceQueue(this.pendingIce, fromUid, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({ type: 'rtc:answer', targetUid: fromUid, sdp: pc.localDescription });
    } else if (type === 'rtc:answer' && msg.sdp) {
      const pc = this.peers.get(fromUid);
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
        await this.flushIceQueue(this.pendingIce, fromUid, pc);
      }
    } else if (type === 'rtc:ice-candidate' && msg.candidate) {
      const pc = this.peers.get(fromUid);
      const cand = msg.candidate as RTCIceCandidateInit;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      } else {
        const list = this.pendingIce.get(fromUid) || [];
        list.push(cand);
        this.pendingIce.set(fromUid, list);
      }
    } else if (type === 'game:rtc-offer' && msg.sdp) {
      const matchId = String(msg.matchId || '');
      if (!matchId) return;
      const pc = this.getOrCreateGamePeer(matchId, fromUid);
      const polite = !this.myUserUid || this.myUserUid < fromUid;
      if (pc.signalingState !== 'stable') {
        if (!polite) return;
        await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
      }
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
      await this.flushIceQueue(this.gamePendingIce, fromUid, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({ type: 'game:rtc-answer', matchId, targetUid: fromUid, sdp: pc.localDescription });
    } else if (type === 'game:rtc-answer' && msg.sdp) {
      const pc = this.gamePeers.get(fromUid);
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
        await this.flushIceQueue(this.gamePendingIce, fromUid, pc);
      }
    } else if (type === 'game:rtc-ice-candidate' && msg.candidate) {
      const pc = this.gamePeers.get(fromUid);
      const cand = msg.candidate as RTCIceCandidateInit;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      } else {
        const list = this.gamePendingIce.get(fromUid) || [];
        list.push(cand);
        this.gamePendingIce.set(fromUid, list);
      }
    }
  }
}

export const ogRealtime = new OgRealtimeClient();
