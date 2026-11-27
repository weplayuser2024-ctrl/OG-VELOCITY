import crypto from 'crypto';
import type http from 'http';
import { and, desc, eq, or } from 'drizzle-orm';
import { WebSocket, WebSocketServer } from 'ws';
import { db } from '../src/db/index.ts';
import {
  DEFAULT_ROOM_CLOSED_REASON,
  areUsersAcceptedFriends,
  assertUserNotBanned,
  ensureVoiceRoomsHaveOwners,
  getActiveUserBans,
  getFullUserView,
  getUserRelationshipTags,
  isAppAdminRole,
  isBlockedBetween,
  isSafeMediaReference,
  makeDmThreadId,
  mapUidsToPublicIds,
  recordTaskActionProgress,
  resolveUserByUidOrPublicId,
  touchUserLastSeen,
  type ActiveBanView,
} from '../src/db/repository.ts';
import { messages, roomParticipants, voiceRooms } from '../src/db/schema.ts';
import { AuthoritativeGameEngine, type MultiplayerGameType } from './games.ts';

function validateSafeChatImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const val = raw.trim();
  if (!val) return null;
  if (!isSafeMediaReference(val, false)) {
    throw new Error('Only PNG, JPEG, WEBP, GIF, HTTPS, or uploaded media links are supported.');
  }
  if (val.length > 2_500_000) {
    throw new Error('Chat photo exceeds maximum allowed payload size.');
  }
  return val;
}

interface ConnectedClient {
  socketId: string;
  ws: WebSocket;
  userUid: string;
  publicId: string;
  name: string;
  photoUrl: string | null;
  vipLevel: number;
  role: string;
  roomId: string | null;
  isAlive: boolean;
  bansCache?: { bans: ActiveBanView[]; expiresAt: number };
}

interface RoomLiveParticipant {
  userUid: string;
  publicId: string;
  name: string;
  photoUrl: string | null;
  equippedFrameId?: string | null;
  vipLevel: number;
  accountRole?: string;
  seatIndex: number | null; // 0 locked exclusively to owner; 1..(seatCapacity-1) speakers/partner
  role: 'owner' | 'admin' | 'moderator' | 'speaker' | 'listener';
  isMuted: boolean;
  isSpeaking: boolean;
  relationshipTags?: Array<{
    id?: string;
    partnerUid: string;
    partnerName?: string;
    tagType: string;
    level: number;
    charmScore?: number;
    status?: string;
  }>;
}

export class RealtimeHub {
  private wss: WebSocketServer;
  private clients = new Map<string, ConnectedClient>(); // socketId -> client
  private userSockets = new Map<string, Set<string>>(); // userUid -> Set<socketId>
  private publicIdToUid = new Map<string, string>(); // publicId -> userUid
  private roomSockets = new Map<string, Set<string>>(); // roomId -> Set<socketId>
  private roomRosters = new Map<string, Map<string, RoomLiveParticipant>>(); // roomId -> Map<userUid, participant>
  private roomGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private roomGraceDeadlines = new Map<string, number>();
  private closingRooms = new Set<string>();
  private gameVoicePeers = new Map<string, Map<string, { publicId: string; name: string; muted: boolean }>>(); // matchId -> Map<uid, state>
  private heartbeatInterval: ReturnType<typeof setInterval>;
  private readonly reconnectGraceMs: number;
  public gameEngine = new AuthoritativeGameEngine();

  constructor(
    server: http.Server,
    authenticateWs: (req: http.IncomingMessage) => Promise<{ userUid: string } | null>,
    options?: { reconnectGraceMs?: number }
  ) {
    this.reconnectGraceMs = Math.max(100, Number(options?.reconnectGraceMs ?? 30_000));
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 3 * 1024 * 1024,
      verifyClient: (info, done) => {
        authenticateWs(info.req)
          .then(async (auth) => {
            if (!auth) {
              done(false, 401, 'Authenticated OG VELOCITY session required.');
              return;
            }
            const user = await getFullUserView(auth.userUid);
            if (!user || user.accountStatus !== 'active') {
              done(false, 403, user?.banReason ? `Account banned: ${user.banReason}` : 'Account not active.');
              return;
            }
            (info.req as unknown as { __ogvUser?: Awaited<ReturnType<typeof getFullUserView>> }).__ogvUser = user;
            done(true);
          })
          .catch(() => done(false, 500, 'Realtime authentication error.'));
      },
    });

    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        if (!client.isAlive) {
          try {
            client.ws.terminate();
          } catch {
            // ignore terminate errors
          }
          continue;
        }
        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.ping();
          } catch {
            // ignore ping errors
          }
        }
      }
    }, 25_000);
    this.heartbeatInterval.unref?.();

    this.wss.on('connection', async (ws, req) => {
      try {
        const preAuthUser = (
          req as unknown as { __ogvUser?: NonNullable<Awaited<ReturnType<typeof getFullUserView>>> }
        ).__ogvUser;
        const user = preAuthUser ?? null;
        if (!user || user.accountStatus !== 'active') {
          ws.close(4403, 'Account not active.');
          return;
        }

        const socketId = `ws-${crypto.randomBytes(6).toString('hex')}`;
        const client: ConnectedClient = {
          socketId,
          ws,
          userUid: user.uid,
          publicId: user.publicId,
          name: user.name,
          photoUrl: user.photoUrl,
          vipLevel: user.vipLevel,
          role: user.role,
          roomId: null,
          isAlive: true,
        };

        this.clients.set(socketId, client);
        this.publicIdToUid.set(user.publicId, user.uid);
        if (!this.userSockets.has(user.uid)) this.userSockets.set(user.uid, new Set());
        this.userSockets.get(user.uid)!.add(socketId);
        void touchUserLastSeen(user.uid);

        ws.on('pong', () => {
          client.isAlive = true;
        });

        const onlinePublicIds = Array.from(this.publicIdToUid.keys()).slice(0, 500);
        this.sendToSocket(ws, {
          type: 'welcome',
          socketId,
          userUid: user.publicId,
          publicId: user.publicId,
          onlineUsers: onlinePublicIds,
        });

        this.broadcastAll({
          type: 'presence:update',
          userUid: user.publicId,
          publicId: user.publicId,
          online: true,
          lastSeenAt: new Date().toISOString(),
        });

        ws.on('message', (raw) => {
          client.isAlive = true;
          this.handleMessage(client, String(raw)).catch((err) => {
            this.sendToSocket(ws, {
              type: 'error',
              message: err instanceof Error ? err.message : 'Realtime operation failed.',
            });
          });
        });

        ws.on('close', () => {
          this.handleDisconnect(client);
        });
      } catch {
        ws.close(1011, 'Realtime auth failed');
      }
    });
  }

  private attachSocketToRoom(client: ConnectedClient, roomId: string) {
    if (client.roomId && client.roomId !== roomId) {
      this.detachSocketFromRoom(client, client.roomId);
    }
    client.roomId = roomId;
    let set = this.roomSockets.get(roomId);
    if (!set) {
      set = new Set();
      this.roomSockets.set(roomId, set);
    }
    set.add(client.socketId);
  }

  private detachSocketFromRoom(client: ConnectedClient, roomId: string) {
    const set = this.roomSockets.get(roomId);
    if (set) {
      set.delete(client.socketId);
      if (set.size === 0) this.roomSockets.delete(roomId);
    }
    if (client.roomId === roomId) {
      client.roomId = null;
    }
  }

  private sendToSocket(ws: WebSocket, payload: unknown) {
    if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 4 * 1024 * 1024) {
      ws.send(JSON.stringify(payload));
    }
  }

  public sendToUser(userUid: string, payload: unknown) {
    const ids = this.userSockets.get(userUid);
    if (!ids) return;
    for (const sid of ids) {
      const c = this.clients.get(sid);
      if (c) this.sendToSocket(c.ws, payload);
    }
  }

  public disconnectBannedUser(userUid: string, reason: string) {
    const ids = this.userSockets.get(userUid);
    if (!ids) return;
    for (const sid of Array.from(ids)) {
      const c = this.clients.get(sid);
      if (!c) continue;
      this.sendToSocket(c.ws, { type: 'auth:banned', reason });
      try {
        c.ws.close(4403, reason.slice(0, 100));
      } catch {
        // ignore close error
      }
    }
  }

  public async enforceRealtimeBan(userUid: string, banType: 'complete' | 'mic' | 'seat' | 'chat', reason: string) {
    const userSocketIds = this.userSockets.get(userUid);
    if (userSocketIds) {
      for (const sid of userSocketIds) {
        const c = this.clients.get(sid);
        if (c) c.bansCache = undefined;
      }
    }
    if (banType === 'complete') {
      this.disconnectBannedUser(userUid, reason);
      return;
    }
    for (const [roomId, roster] of this.roomRosters.entries()) {
      const p = roster.get(userUid);
      if (!p) continue;
      if (banType === 'mic') {
        p.isMuted = true;
        p.isSpeaking = false;
        await db
          .update(roomParticipants)
          .set({ isMuted: true, isSpeaking: false })
          .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, userUid)))
          .catch(() => {});
        this.broadcastToRoom(roomId, {
          type: 'room:roster-updated',
          roomId,
          participants: this.getPublicRoomParticipants(roomId),
        });
      } else if (banType === 'seat') {
        p.seatIndex = null;
        p.isMuted = true;
        p.isSpeaking = false;
        await db
          .update(roomParticipants)
          .set({ seatIndex: null, isMuted: true, isSpeaking: false })
          .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, userUid)))
          .catch(() => {});
        this.broadcastToRoom(roomId, {
          type: 'room:roster-updated',
          roomId,
          participants: this.getPublicRoomParticipants(roomId),
        });
      }
    }
    this.sendToUser(userUid, {
      type: 'error',
      message: `${banType.toUpperCase()} restriction applied: ${reason}`,
    });
  }

  public broadcastAll(payload: unknown) {
    const serialized = JSON.stringify(payload);
    for (const c of this.clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN && c.ws.bufferedAmount < 4 * 1024 * 1024) {
        c.ws.send(serialized);
      }
    }
  }

  public broadcastToRoom(roomId: string, payload: unknown, exceptUserUid?: string) {
    const sids = this.roomSockets.get(roomId);
    if (!sids || sids.size === 0) return;
    const serialized = JSON.stringify(payload);
    for (const sid of sids) {
      const c = this.clients.get(sid);
      if (!c) continue;
      if (exceptUserUid && c.userUid === exceptUserUid) continue;
      if (c.ws.readyState === WebSocket.OPEN && c.ws.bufferedAmount < 4 * 1024 * 1024) {
        c.ws.send(serialized);
      }
    }
  }

  public isUserOnline(userUid: string): boolean {
    const s = this.userSockets.get(userUid);
    return Boolean(s && s.size > 0);
  }

  public getRoomParticipants(roomId: string): RoomLiveParticipant[] {
    const map = this.roomRosters.get(roomId);
    return map ? Array.from(map.values()) : [];
  }

  private toPublicParticipant(p: RoomLiveParticipant): RoomLiveParticipant {
    return {
      ...p,
      userUid: p.publicId,
      publicId: p.publicId,
    };
  }

  private getPublicRoomParticipants(roomId: string): RoomLiveParticipant[] {
    return this.getRoomParticipants(roomId).map((p) => this.toPublicParticipant(p));
  }

  public async refreshParticipantSocialState(userUids: string[]) {
    const cleanUids = Array.from(new Set(userUids.map((u) => String(u || '').trim()).filter(Boolean)));
    if (cleanUids.length === 0) return;

    const tagsByUid = new Map<string, RoomLiveParticipant['relationshipTags']>();
    await Promise.all(
      cleanUids.map(async (uid) => {
        const activeTags = await getUserRelationshipTags(uid, { activeOnly: true }).catch(() => []);
        tagsByUid.set(
          uid,
          activeTags.map((t) => ({
            id: t.id,
            partnerUid: t.partnerUid,
            partnerName: t.partnerName,
            tagType: t.tagType,
            level: t.level,
            charmScore: t.charmScore,
            status: t.status,
          }))
        );
      })
    );

    for (const [roomId, roster] of this.roomRosters.entries()) {
      let changed = false;
      for (const uid of cleanUids) {
        const p = roster.get(uid);
        if (p) {
          p.relationshipTags = tagsByUid.get(uid) || [];
          changed = true;
        }
      }
      if (changed) {
        this.broadcastToRoom(roomId, {
          type: 'room:roster-updated',
          roomId,
          participants: this.getPublicRoomParticipants(roomId),
        });
      }
    }
  }

  private async resolveTargetInternalUid(identifier: string): Promise<{ uid: string; publicId: string } | null> {
    const trimmed = String(identifier || '').trim();
    if (!trimmed) return null;
    const mappedUid = this.publicIdToUid.get(trimmed);
    if (mappedUid) {
      return { uid: mappedUid, publicId: trimmed };
    }
    if (this.userSockets.has(trimmed)) {
      const sids = this.userSockets.get(trimmed);
      const firstSid = sids?.values().next().value;
      const client = firstSid ? this.clients.get(firstSid) : undefined;
      if (client) return { uid: client.userUid, publicId: client.publicId };
    }
    const found = await resolveUserByUidOrPublicId(trimmed);
    return found ? { uid: found.uid, publicId: found.publicId } : null;
  }

  public getOfficialRoomsWithLiveAppAdmin(): Set<string> {
    const activeSet = new Set<string>();
    for (const [roomId, roster] of this.roomRosters.entries()) {
      for (const p of roster.values()) {
        if (isAppAdminRole(p.accountRole)) {
          activeSet.add(roomId);
          break;
        }
      }
    }
    return activeSet;
  }

  private clearRoomGraceTimer(roomId: string) {
    const existing = this.roomGraceTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.roomGraceTimers.delete(roomId);
    }
    this.roomGraceDeadlines.delete(roomId);
  }

  private isRoomHostOrAdminInRoster(
    room: typeof voiceRooms.$inferSelect,
    roster?: Map<string, RoomLiveParticipant>
  ): boolean {
    if (!roster || roster.size === 0) return false;
    if (room.isOfficial) {
      return Array.from(roster.values()).some((p) => isAppAdminRole(p.accountRole));
    }
    if (room.ownerUid && room.ownerUid !== 'system-official' && roster.has(room.ownerUid)) {
      return true;
    }
    const adminUids = Array.isArray(room.adminUids) ? room.adminUids : [];
    return adminUids.some((uid) => Boolean(uid && roster.has(uid)));
  }

  private scheduleRoomGraceTimer(roomId: string, broadcastWarning = true) {
    this.clearRoomGraceTimer(roomId);
    const expiresAt = Date.now() + this.reconnectGraceMs;
    const timer = setTimeout(() => {
      this.roomGraceTimers.delete(roomId);
      this.roomGraceDeadlines.delete(roomId);
      void (async () => {
        try {
          const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
          if (!room || room.status === 'closed') return;
          const roster = this.roomRosters.get(roomId);
          if (!this.isRoomHostOrAdminInRoster(room, roster)) {
            await this.closeRoom(roomId, DEFAULT_ROOM_CLOSED_REASON);
          }
        } catch (err) {
          console.error('[RealtimeHub] Grace timer room check failed:', err);
        }
      })();
    }, this.reconnectGraceMs);
    timer.unref?.();
    this.roomGraceTimers.set(roomId, timer);
    this.roomGraceDeadlines.set(roomId, expiresAt);

    if (broadcastWarning) {
      this.broadcastToRoom(roomId, {
        type: 'room:host-reconnecting',
        roomId,
        graceSeconds: Math.max(1, Math.round(this.reconnectGraceMs / 1000)),
        expiresAt,
      });
    }
  }

  public scheduleInitialRoomGrace(roomId: string) {
    const roster = this.roomRosters.get(roomId);
    if (!roster || roster.size === 0) {
      this.scheduleRoomGraceTimer(roomId, false);
    }
  }

  public getRoomGraceDeadline(roomId: string): number | null {
    return this.roomGraceDeadlines.get(roomId) ?? null;
  }

  public async closeRoom(
    roomId: string,
    reason = DEFAULT_ROOM_CLOSED_REASON
  ): Promise<boolean> {
    if (this.closingRooms.has(roomId)) return false;
    this.closingRooms.add(roomId);
    try {
      this.clearRoomGraceTimer(roomId);

      const [closedRoom] = await db
        .update(voiceRooms)
        .set({
          status: 'closed',
          closedAt: new Date(),
          closedReason: reason,
          updatedAt: new Date(),
        })
        .where(and(eq(voiceRooms.id, roomId), eq(voiceRooms.status, 'active')))
        .returning();

      const [fallbackRoom] = closedRoom
        ? [closedRoom]
        : await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));

      // Clear speakers from seats so seat-taking is disabled while Owner & Admins are away,
      // keeping all listeners inside so chat & listener count stay visible beneath "This VR is closed".
      const roster = this.roomRosters.get(roomId);
      if (roster) {
        for (const p of roster.values()) {
          p.seatIndex = null;
          p.isMuted = true;
          p.isSpeaking = false;
          if (p.role === 'speaker') p.role = 'listener';
        }
      }
      await db
        .update(roomParticipants)
        .set({ seatIndex: null, isMuted: true, isSpeaking: false, role: 'listener' })
        .where(eq(roomParticipants.roomId, roomId))
        .catch(() => {});

      const statusPayload = {
        type: 'room:status-changed',
        roomId,
        status: 'closed',
        roomTitle: fallbackRoom?.title || 'Voice Room',
        reason: fallbackRoom?.closedReason || reason,
      };
      this.broadcastToRoom(roomId, statusPayload);
      this.broadcastToRoom(roomId, {
        type: 'room:roster-updated',
        roomId,
        participants: this.getPublicRoomParticipants(roomId),
      });

      if (closedRoom) {
        this.broadcastAll({
          type: 'room:list-updated',
          updatedRoomId: roomId,
        });
      }

      return Boolean(closedRoom);
    } finally {
      this.closingRooms.delete(roomId);
    }
  }

  public async evaluateRoomPresence(
    roomId: string,
    opts: { intentionalLeave: boolean; disconnectedWasHost: boolean }
  ): Promise<void> {
    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
    if (!room) return;
    if (room.status === 'closed') {
      this.clearRoomGraceTimer(roomId);
      return;
    }

    const roster = this.roomRosters.get(roomId);
    if (this.isRoomHostOrAdminInRoster(room, roster)) {
      if (this.roomGraceTimers.has(roomId)) {
        this.clearRoomGraceTimer(roomId);
        this.broadcastToRoom(roomId, {
          type: 'room:host-reconnected',
          roomId,
        });
      }
      return;
    }

    // Neither Owner nor any authorized Admin is currently present in the room roster.
    if (opts.intentionalLeave) {
      if (opts.disconnectedWasHost || !this.roomGraceTimers.has(roomId)) {
        await this.closeRoom(roomId, DEFAULT_ROOM_CLOSED_REASON);
      }
      return;
    }

    if (opts.disconnectedWasHost) {
      this.scheduleRoomGraceTimer(roomId, true);
      return;
    }

    if (!this.roomGraceTimers.has(roomId)) {
      await this.closeRoom(roomId, DEFAULT_ROOM_CLOSED_REASON);
    }
  }

  public async syncRoomAdmins(
    roomId: string,
    nextAdminUids: string[],
    publicAdminUids: string[]
  ): Promise<void> {
    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
    if (!room || room.status === 'closed') return;

    const roster = this.roomRosters.get(roomId);
    if (roster) {
      for (const participant of roster.values()) {
        if (participant.userUid === room.ownerUid) {
          participant.role = 'owner';
          continue;
        }
        const isNowAdmin = nextAdminUids.includes(participant.userUid);
        const nextRole: RoomLiveParticipant['role'] = isNowAdmin
          ? 'admin'
          : participant.seatIndex !== null
            ? 'speaker'
            : 'listener';
        if (participant.role !== nextRole) {
          participant.role = nextRole;
          await db
            .update(roomParticipants)
            .set({ role: nextRole, lastActiveAt: new Date() })
            .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, participant.userUid)))
            .catch(() => {});
        }
      }

      this.broadcastToRoom(roomId, {
        type: 'room:roster-updated',
        roomId,
        participants: this.getPublicRoomParticipants(roomId),
      });
    }

    this.broadcastToRoom(roomId, {
      type: 'room:admins-updated',
      roomId,
      adminUids: publicAdminUids,
    });

    await this.evaluateRoomPresence(roomId, {
      intentionalLeave: true,
      disconnectedWasHost: true,
    });
  }

  public async forceUserLeaveRoom(
    roomId: string,
    userUid: string,
    opts: { intentional?: boolean } = {}
  ): Promise<void> {
    const intentional = opts.intentional ?? true;
    let publicId = userUid;
    const sids = this.userSockets.get(userUid);
    if (sids) {
      for (const sid of sids) {
        const c = this.clients.get(sid);
        if (c && c.roomId === roomId) {
          this.detachSocketFromRoom(c, roomId);
          publicId = c.publicId;
        }
      }
    }

    const roster = this.roomRosters.get(roomId);
    const wasInRoster = Boolean(roster?.has(userUid));
    if (roster) {
      roster.delete(userUid);
      if (roster.size === 0) this.roomRosters.delete(roomId);
    }

    await db
      .delete(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, userUid)))
      .catch(() => {});

    if (wasInRoster) {
      this.broadcastToRoom(roomId, {
        type: 'room:participant-left',
        roomId,
        userUid: publicId,
        participants: this.getPublicRoomParticipants(roomId),
      });
    }

    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
    const leftUserView = room?.isOfficial ? await getFullUserView(userUid).catch(() => null) : null;
    const disconnectedWasHost = Boolean(
      room &&
        (room.isOfficial
          ? isAppAdminRole(leftUserView?.role)
          : room.ownerUid === userUid ||
            (Array.isArray(room.adminUids) && room.adminUids.includes(userUid)))
    );

    await this.evaluateRoomPresence(roomId, {
      intentionalLeave: intentional,
      disconnectedWasHost,
    });
  }

  public shutdown() {
    clearInterval(this.heartbeatInterval);
    for (const timer of this.roomGraceTimers.values()) {
      clearTimeout(timer);
    }
    this.roomGraceTimers.clear();
    this.roomGraceDeadlines.clear();
    this.wss.close();
  }

  private async handleDisconnect(client: ConnectedClient) {
    this.clients.delete(client.socketId);
    if (client.roomId) {
      const departingRoomId = client.roomId;
      this.detachSocketFromRoom(client, departingRoomId);
      client.roomId = departingRoomId;
    }
    const set = this.userSockets.get(client.userUid);
    if (set) {
      set.delete(client.socketId);
      if (set.size === 0) {
        this.userSockets.delete(client.userUid);
        this.publicIdToUid.delete(client.publicId);
        const lastSeenAt = new Date().toISOString();
        void touchUserLastSeen(client.userUid);
        this.broadcastAll({
          type: 'presence:update',
          userUid: client.publicId,
          publicId: client.publicId,
          online: false,
          lastSeenAt,
        });
      }
    }

    if (client.roomId) {
      await this.leaveRoom(client, { intentional: false });
    }

    const activeMatch = this.gameEngine.markDisconnected(client.userUid);
    if (activeMatch) {
      if (!this.isUserOnline(client.userUid)) {
        const peerMap = this.gameVoicePeers.get(activeMatch.id);
        if (peerMap?.has(client.userUid)) {
          peerMap.delete(client.userUid);
          const peers = Array.from(peerMap.values());
          for (const p of activeMatch.players) {
            this.sendToUser(p.uid, { type: 'game:voice-peers', matchId: activeMatch.id, peers });
          }
          if (peerMap.size === 0) this.gameVoicePeers.delete(activeMatch.id);
        }
      }
      this.broadcastMatchSync(activeMatch.id);
    }
  }

  private async leaveRoom(
    client: ConnectedClient,
    opts: { intentional: boolean } = { intentional: true }
  ) {
    const roomId = client.roomId;
    if (!roomId) return;
    this.detachSocketFromRoom(client, roomId);

    // Only remove from room roster if user has no other open socket in the same room
    const userSids = this.userSockets.get(client.userUid);
    let hasOtherSocketInRoom = false;
    if (userSids) {
      for (const sid of userSids) {
        const c = this.clients.get(sid);
        if (c && c.roomId === roomId) {
          hasOtherSocketInRoom = true;
          break;
        }
      }
    }
    if (hasOtherSocketInRoom) return;

    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
    const disconnectedWasHost = Boolean(
      room &&
        (room.isOfficial
          ? isAppAdminRole(client.role)
          : room.ownerUid === client.userUid ||
            (Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid)))
    );

    const roster = this.roomRosters.get(roomId);
    if (roster) {
      roster.delete(client.userUid);
      if (roster.size === 0) this.roomRosters.delete(roomId);
    }

    await db
      .delete(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, client.userUid)))
      .catch(() => {});

    this.broadcastToRoom(roomId, {
      type: 'room:participant-left',
      roomId,
      userUid: client.publicId,
      participants: this.getPublicRoomParticipants(roomId),
    });

    await this.evaluateRoomPresence(roomId, {
      intentionalLeave: opts.intentional,
      disconnectedWasHost,
    });
  }

  private broadcastMatchSync(matchId: string) {
    const match = this.gameEngine.getMatch(matchId);
    if (!match) return;
    for (const p of match.players) {
      this.sendToUser(p.uid, {
        type: 'game:sync',
        match: this.gameEngine.sanitizeMatchForPlayer(match, p.uid),
      });
    }
  }

  private async handleMessage(client: ConnectedClient, raw: string) {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    const type = String(msg.type || '');

    // ------------------------------------------------------------------
    // 1. VOICE ROOMS + WEBRTC SIGNALING
    // ------------------------------------------------------------------
    if (type === 'room:join') {
      const requestedRoomId = String(msg.roomId || '').trim();
      if (!requestedRoomId) throw new Error('Missing roomId.');
      await ensureVoiceRoomsHaveOwners().catch(() => {});

      const [room] = await db
        .select()
        .from(voiceRooms)
        .where(or(eq(voiceRooms.id, requestedRoomId), eq(voiceRooms.roomCode, requestedRoomId)));
      if (!room) throw new Error('Voice room not found.');

      const roomId = room.id;
      const isAppAdmin = isAppAdminRole(client.role);
      const isOwner = room.ownerUid === client.userUid;
      const isRoomAdmin = room.isOfficial
        ? isAppAdmin
        : Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);

      // Everyone enters the room normally first. Only display closed overlay inside if Owner AND Admins are all offline/absent.
      const existingRoster = this.roomRosters.get(roomId);
      const isJoiningAuthorizedHost = room.isOfficial ? isAppAdmin : isOwner || isRoomAdmin;
      const hasHostOrAdminOnline =
        isJoiningAuthorizedHost || this.isRoomHostOrAdminInRoster(room, existingRoster);

      let effectiveRoomStatus = room.status;
      let effectiveClosedReason = room.closedReason;

      if (hasHostOrAdminOnline) {
        if (room.status === 'closed') {
          await db
            .update(voiceRooms)
            .set({ status: 'active', closedAt: null, closedReason: null, updatedAt: new Date() })
            .where(eq(voiceRooms.id, roomId));
          effectiveRoomStatus = 'active';
          effectiveClosedReason = null;
          this.broadcastToRoom(roomId, {
            type: 'room:status-changed',
            roomId,
            status: 'active',
            reason: null,
          });
          this.broadcastAll({ type: 'room:list-updated', updatedRoomId: roomId });
        }
      } else if (!this.roomGraceTimers.has(roomId)) {
        effectiveRoomStatus = 'closed';
        effectiveClosedReason = room.closedReason || DEFAULT_ROOM_CLOSED_REASON;
        if (room.status !== 'closed') {
          await db
            .update(voiceRooms)
            .set({
              status: 'closed',
              closedAt: new Date(),
              closedReason: effectiveClosedReason,
              updatedAt: new Date(),
            })
            .where(eq(voiceRooms.id, roomId));
          this.broadcastAll({ type: 'room:list-updated', updatedRoomId: roomId });
        }
      }

      const roomCfg =
        room.roomSettings && typeof room.roomSettings === 'object'
          ? (room.roomSettings as Record<string, unknown>)
          : {};
      const blockedList = Array.isArray(roomCfg.blockedUids)
        ? roomCfg.blockedUids.map((u) => String(u).trim())
        : [];
      const isRoomOwnerOrAppAdmin =
        room.ownerUid === client.userUid || isAppAdminRole(client.role);
      if (
        !isRoomOwnerOrAppAdmin &&
        (blockedList.includes(client.publicId) || blockedList.includes(client.userUid))
      ) {
        throw new Error('You are on this room\'s blocklist and cannot enter.');
      }

      if (client.roomId && client.roomId !== roomId) {
        await this.leaveRoom(client, { intentional: true });
      }
      this.attachSocketToRoom(client, roomId);

      if (!this.roomRosters.has(roomId)) this.roomRosters.set(roomId, new Map());
      const roster = this.roomRosters.get(roomId)!;

      const [liveUser, activeBans, userTags] = await Promise.all([
        getFullUserView(client.userUid),
        getActiveUserBans(client.userUid),
        getUserRelationshipTags(client.userUid, { activeOnly: true }).catch(() => []),
      ]);
      client.bansCache = { bans: activeBans, expiresAt: Date.now() + 15_000 };
      const effectiveAccountRole = liveUser?.role || client.role;
      client.role = effectiveAccountRole;
      const isAppAdminLive = isAppAdminRole(effectiveAccountRole);
      const isAdminLive = room.isOfficial
        ? isAppAdminLive
        : Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      const isMicBanned = activeBans.some((b) => b.banType === 'mic' || b.banType === 'complete');
      const isSeatBanned = activeBans.some((b) => b.banType === 'seat' || b.banType === 'complete');
      const role: RoomLiveParticipant['role'] = isOwner ? 'owner' : isAdminLive ? 'admin' : 'listener';
      const initialSeat = isOwner && !isSeatBanned && effectiveRoomStatus === 'active' ? 0 : null;

      const participant: RoomLiveParticipant = {
        userUid: client.userUid,
        publicId: client.publicId,
        name: liveUser?.name || client.name,
        photoUrl: liveUser?.photoUrl ?? client.photoUrl,
        equippedFrameId: liveUser?.equippedFrameId ?? null,
        vipLevel: liveUser?.vipLevel ?? client.vipLevel,
        accountRole: effectiveAccountRole,
        seatIndex: initialSeat,
        role,
        isMuted: isMicBanned || effectiveRoomStatus === 'closed',
        isSpeaking: false,
        relationshipTags: userTags.map((t) => ({
          id: t.id,
          partnerUid: t.partnerUid,
          partnerName: t.partnerName,
          tagType: t.tagType,
          level: t.level,
          charmScore: t.charmScore,
          status: t.status,
        })),
      };
      roster.set(client.userUid, participant);

      await db
        .insert(roomParticipants)
        .values({
          roomId,
          userUid: client.userUid,
          displayName: client.name,
          seatIndex: initialSeat,
          role,
          isMuted: participant.isMuted,
          isSpeaking: false,
        })
        .onConflictDoUpdate({
          target: [roomParticipants.roomId, roomParticipants.userUid],
          set: { seatIndex: initialSeat, role, isMuted: participant.isMuted, lastActiveAt: new Date() },
        });

      await recordTaskActionProgress(client.userUid, 'voice_time', 1).catch(() => {});

      const isAuthorizedHostPresence = room.isOfficial ? isAppAdminLive : isOwner || isAdminLive;
      if (isAuthorizedHostPresence) {
        if (this.roomGraceTimers.has(roomId)) {
          this.clearRoomGraceTimer(roomId);
          this.broadcastToRoom(
            roomId,
            { type: 'room:host-reconnected', roomId },
            client.userUid
          );
        }
      } else if (
        effectiveRoomStatus === 'active' &&
        !this.isRoomHostOrAdminInRoster(room, roster) &&
        !this.roomGraceTimers.has(roomId)
      ) {
        await this.closeRoom(roomId, DEFAULT_ROOM_CLOSED_REASON);
        effectiveRoomStatus = 'closed';
        effectiveClosedReason = DEFAULT_ROOM_CLOSED_REASON;
      }

      const recentMsgsDesc = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, roomId))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(40);
      const recentMsgs = recentMsgsDesc.reverse();
      const msgUidMap = await mapUidsToPublicIds(recentMsgs.map((m) => m.senderUid));
      const publicMessages = recentMsgs.map((m) => ({
        ...m,
        senderUid: msgUidMap[m.senderUid] || m.senderUid,
        senderPublicId: msgUidMap[m.senderUid] || m.senderUid,
      }));
      const publicRoster = this.getPublicRoomParticipants(roomId);

      this.sendToSocket(client.ws, {
        type: 'room:joined',
        roomId,
        roomStatus: effectiveRoomStatus,
        closedReason: effectiveClosedReason || null,
        participants: publicRoster,
        messages: publicMessages,
      });

      this.broadcastToRoom(
        roomId,
        {
          type: 'room:participant-joined',
          roomId,
          participant: this.toPublicParticipant(participant),
          participants: publicRoster,
        },
        client.userUid
      );

      // VIP 15 Full-Screen Non-Interrupting Entrance Showcase (or VIP >= 6 entrance banner)
      if (client.vipLevel >= 6) {
        this.broadcastToRoom(roomId, {
          type: 'room:vip-entrance',
          roomId,
          userUid: client.publicId,
          name: client.name,
          vipLevel: client.vipLevel,
          fullScreenCinematic: client.vipLevel >= 15,
        });
      }
      return;
    }

    if (type === 'room:leave') {
      await this.leaveRoom(client, { intentional: true });
      return;
    }

    if (type === 'room:seat-take') {
      await assertUserNotBanned(client.userUid, ['seat', 'complete']);
      const roomId = client.roomId;
      if (!roomId) throw new Error('Join a room first.');
      const seatIndex = Number(msg.seatIndex);
      const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
      if (!room) throw new Error('Voice room not found.');
      if (room.status === 'closed') {
        throw new Error(
          'This VR is currently closed. Seats open when the owner, co-owner, or an admin is here.'
        );
      }

      const roster = this.roomRosters.get(roomId);
      const self = roster?.get(client.userUid);
      if (!roster || !self) throw new Error('Not inside room.');

      // STRICT RULE: Seat 0 is reserved exclusively for Owner; owner cannot change seat; non-owner cannot occupy seat 0
      if (seatIndex === 0 && room.ownerUid !== client.userUid) {
        throw new Error('The Owner seat is reserved exclusively for the room owner.');
      }
      if (room.ownerUid === client.userUid && seatIndex !== 0) {
        throw new Error('The room Owner stays on Seat 0 and cannot move positions.');
      }
      if (seatIndex < 0 || seatIndex >= room.seatCapacity) {
        throw new Error('Invalid seat index for this room.');
      }
      const lockedSeats = Array.isArray(room.lockedSeats)
        ? room.lockedSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : [];
      if (lockedSeats.includes(seatIndex)) {
        throw new Error('This seat is currently locked by the host.');
      }

      const seatCfg =
        room.roomSettings && typeof room.roomSettings === 'object'
          ? (room.roomSettings as Record<string, unknown>)
          : {};
      const partnerSeatMode = String(seatCfg.partnerSeatMode || 'Enable All');
      const isSeatHostOrAdmin =
        room.ownerUid === client.userUid ||
        (room.isOfficial
          ? isAppAdminRole(client.role)
          : Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid));
      if (!isSeatHostOrAdmin && (partnerSeatMode === 'Locked' || partnerSeatMode === 'Owner & Admins')) {
        throw new Error(
          partnerSeatMode === 'Locked'
            ? 'Partner seats are currently locked by the room host.'
            : 'Only the room Owner and Admins can take a seat right now.'
        );
      }

      const activeSpeakers = Array.from(roster.values()).filter((p) => p.seatIndex !== null);
      if (self.seatIndex === null && activeSpeakers.length >= room.activeSpeakerSlots) {
        throw new Error(`Maximum ${room.activeSpeakerSlots} active speaker seats are currently full.`);
      }

      const occupied = Array.from(roster.values()).find(
        (p) => p.seatIndex === seatIndex && p.userUid !== client.userUid
      );
      if (occupied) throw new Error('Seat is already occupied.');

      self.seatIndex = seatIndex;
      if (self.role === 'listener') self.role = 'speaker';

      await db
        .update(roomParticipants)
        .set({ seatIndex, role: self.role, lastActiveAt: new Date() })
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, client.userUid)));

      this.broadcastToRoom(roomId, {
        type: 'room:roster-updated',
        roomId,
        participants: this.getPublicRoomParticipants(roomId),
      });
      return;
    }

    if (type === 'room:seat-lock') {
      const roomId = client.roomId;
      if (!roomId) throw new Error('Join a room first.');
      const seatIndex = Number(msg.seatIndex);
      const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
      if (!room || room.status === 'closed') return;
      const canModerate = room.isOfficial
        ? isAppAdminRole(client.role)
        : room.ownerUid === client.userUid ||
          (Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid));
      if (!canModerate) {
        throw new Error(
          room.isOfficial
            ? 'Only authorized App Admins can lock seats in Official Rooms.'
            : 'Only the room Owner or Room Admin can lock seats.'
        );
      }
      if (!Number.isInteger(seatIndex) || seatIndex <= 0 || seatIndex >= room.seatCapacity) {
        throw new Error('Seat 0 is permanently reserved for the Owner and cannot be locked.');
      }

      const currentLocked = Array.isArray(room.lockedSeats)
        ? room.lockedSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : [];
      const shouldLock =
        typeof msg.locked === 'boolean' ? msg.locked : !currentLocked.includes(seatIndex);
      const nextLocked = shouldLock
        ? Array.from(new Set([...currentLocked, seatIndex])).sort((a, b) => a - b)
        : currentLocked.filter((n) => n !== seatIndex);

      await db
        .update(voiceRooms)
        .set({ lockedSeats: nextLocked, updatedAt: new Date() })
        .where(eq(voiceRooms.id, roomId));

      if (shouldLock) {
        const roster = this.roomRosters.get(roomId);
        const occupant = roster
          ? Array.from(roster.values()).find((p) => p.seatIndex === seatIndex && p.userUid !== room.ownerUid)
          : undefined;
        if (occupant) {
          occupant.seatIndex = null;
          occupant.isSpeaking = false;
          if (occupant.role === 'speaker') occupant.role = 'listener';
          await db
            .update(roomParticipants)
            .set({ seatIndex: null, role: occupant.role, isSpeaking: false, lastActiveAt: new Date() })
            .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, occupant.userUid)))
            .catch(() => {});
        }
      }

      this.broadcastToRoom(roomId, {
        type: 'room:seat-locks-updated',
        roomId,
        lockedSeats: nextLocked,
      });
      this.broadcastToRoom(roomId, {
        type: 'room:roster-updated',
        roomId,
        participants: this.getPublicRoomParticipants(roomId),
      });
      return;
    }

    if (type === 'room:seat-leave') {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
      if (!room || room.status === 'closed') return;
      if (room.ownerUid === client.userUid) {
        throw new Error('Room owner cannot vacate Seat 0.');
      }
      const roster = this.roomRosters.get(roomId);
      const self = roster?.get(client.userUid);
      if (!self) return;
      self.seatIndex = null;
      self.isSpeaking = false;
      if (self.role === 'speaker') self.role = 'listener';

      await db
        .update(roomParticipants)
        .set({ seatIndex: null, role: self.role, isSpeaking: false, lastActiveAt: new Date() })
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, client.userUid)))
        .catch(() => {});

      this.broadcastToRoom(roomId, {
        type: 'room:roster-updated',
        roomId,
        participants: this.getPublicRoomParticipants(roomId),
      });
      return;
    }

    if (type === 'room:mute' || type === 'room:speaking') {
      const roomId = client.roomId;
      if (!roomId) return;
      const roster = this.roomRosters.get(roomId);
      const self = roster?.get(client.userUid);
      if (!self) return;

      const now = Date.now();
      let activeBans: ActiveBanView[];
      if (client.bansCache && client.bansCache.expiresAt > now) {
        activeBans = client.bansCache.bans;
      } else {
        activeBans = await getActiveUserBans(client.userUid).catch(() => []);
        client.bansCache = { bans: activeBans, expiresAt: now + 15_000 };
      }

      const prevMuted = self.isMuted;
      const prevSpeaking = self.isSpeaking;
      const micBan = activeBans.find((b) => b.banType === 'mic' || b.banType === 'complete');
      if (micBan) {
        self.isMuted = true;
        self.isSpeaking = false;
        if ((type === 'room:mute' && msg.isMuted === false) || (type === 'room:speaking' && msg.isSpeaking)) {
          this.sendToSocket(client.ws, {
            type: 'error',
            message: `Microphone banned${micBan.expiresAt ? ` until ${new Date(micBan.expiresAt).toLocaleDateString()}` : ' permanently'}: ${micBan.reason}`,
          });
        }
      } else {
        if (type === 'room:mute') self.isMuted = Boolean(msg.isMuted);
        if (type === 'room:speaking') self.isSpeaking = !self.isMuted && Boolean(msg.isSpeaking);
      }

      if (self.isMuted !== prevMuted || self.isSpeaking !== prevSpeaking) {
        this.broadcastToRoom(roomId, {
          type: 'room:roster-updated',
          roomId,
          participants: this.getPublicRoomParticipants(roomId),
        });
      }
      return;
    }

    if (type === 'room:kick' || type === 'room:force-mute') {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
      if (!room || room.status === 'closed') return;
      const roster = this.roomRosters.get(roomId);
      const actor = roster?.get(client.userUid);
      const canModerate = room.isOfficial
        ? isAppAdminRole(client.role)
        : room.ownerUid === client.userUid ||
          actor?.role === 'admin' ||
          actor?.role === 'moderator' ||
          (Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid));
      if (!canModerate) {
        throw new Error(
          room.isOfficial
            ? 'Only authorized App Admins can moderate Official Rooms.'
            : 'Owner or room admin permission required.'
        );
      }

      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ''));
      const targetUid = resolvedTarget?.uid || '';
      if (!targetUid) return;
      if (targetUid === room.ownerUid) throw new Error('Cannot moderate the room owner.');
      const target = roster?.get(targetUid);
      if (!target) return;

      if (type === 'room:force-mute') {
        target.isMuted = Boolean(msg.isMuted ?? true);
        target.isSpeaking = false;
        this.broadcastToRoom(roomId, {
          type: 'room:roster-updated',
          roomId,
          participants: this.getPublicRoomParticipants(roomId),
        });
      } else {
        target.seatIndex = null;
        target.isSpeaking = false;
        roster?.delete(targetUid);
        const targetSocketIds = this.userSockets.get(targetUid);
        if (targetSocketIds) {
          for (const sid of targetSocketIds) {
            const c = this.clients.get(sid);
            if (c && c.roomId === roomId) {
              this.detachSocketFromRoom(c, roomId);
            }
          }
        }
        await db
          .delete(roomParticipants)
          .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, targetUid)))
          .catch(() => {});
        this.sendToUser(targetUid, { type: 'room:kicked', roomId });
        this.broadcastToRoom(roomId, {
          type: 'room:roster-updated',
          roomId,
          participants: this.getPublicRoomParticipants(roomId),
        });
      }
      return;
    }

    if (type === 'room:chat') {
      await assertUserNotBanned(client.userUid, ['chat', 'complete']);
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db
        .select({
          status: voiceRooms.status,
          ownerUid: voiceRooms.ownerUid,
          adminUids: voiceRooms.adminUids,
          isOfficial: voiceRooms.isOfficial,
          roomSettings: voiceRooms.roomSettings,
        })
        .from(voiceRooms)
        .where(eq(voiceRooms.id, roomId));
      if (!room || room.status === 'closed') return;
      const imageUrl = validateSafeChatImageUrl(msg.imageUrl);
      const rawText = String(msg.text || '').trim().slice(0, 500);
      const body = rawText || (imageUrl ? '📷 Photo' : '');
      if (!body && !imageUrl) return;

      const chatCfg =
        room.roomSettings && typeof room.roomSettings === 'object'
          ? (room.roomSettings as Record<string, unknown>)
          : {};
      const isMod = room.isOfficial
        ? isAppAdminRole(client.role)
        : room.ownerUid === client.userUid ||
          (Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid));
      if (!isMod) {
        if (imageUrl && chatCfg.banPhotoChat) {
          throw new Error('Photo chatting is banned in this room.');
        }
        if (!imageUrl && chatCfg.banTextChat) {
          throw new Error('Text chatting is banned in this room.');
        }
      }
      const [saved] = await db
        .insert(messages)
        .values({
          scope: 'room',
          threadId: roomId,
          senderUid: client.userUid,
          body,
          imageUrl,
          kind: imageUrl ? 'photo' : 'chat',
        })
        .returning();

      this.broadcastToRoom(roomId, {
        type: 'room:chat',
        roomId,
        message: {
          ...saved,
          senderUid: client.publicId,
          senderName: client.name,
          senderPublicId: client.publicId,
          vipLevel: client.vipLevel,
        },
      });
      return;
    }

    // WebRTC Peer Signaling (offer, answer, ice-candidate) scoped strictly to same room
    if (type === 'rtc:offer' || type === 'rtc:answer' || type === 'rtc:ice-candidate') {
      const roomId = client.roomId;
      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ''));
      const targetUid = resolvedTarget?.uid || '';
      if (!roomId || !targetUid) return;
      const roster = this.roomRosters.get(roomId);
      if (!roster?.has(client.userUid) || !roster.has(targetUid)) return;

      this.sendToUser(targetUid, {
        type,
        roomId,
        fromUid: client.publicId,
        fromName: client.name,
        sdp: msg.sdp,
        candidate: msg.candidate,
      });
      return;
    }

    // Action Room live mode/slot synchronization
    if (type === 'room:action-update') {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
      if (!room || room.status === 'closed') return;
      const canControl = room.isOfficial
        ? isAppAdminRole(client.role)
        : room.ownerUid === client.userUid ||
          (Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid));
      if (!canControl) {
        throw new Error('Only room Host/Admin can update Action Room state.');
      }
      const modeRaw = String(msg.actionMode || 'bidding');
      const actionModeMap: Record<string, string> = {
        bidding: 'bidding',
        Bidding: 'bidding',
        relationship_advancement: 'relationship_advancement',
        'Relationship Advancement': 'relationship_advancement',
        music: 'music',
        Music: 'music',
      };
      const actionMode = actionModeMap[modeRaw] || 'bidding';
      const slots = Array.isArray(msg.slots) ? msg.slots.slice(0, 3) : undefined;
      const cfg =
        room.roomSettings && typeof room.roomSettings === 'object'
          ? { ...(room.roomSettings as Record<string, unknown>) }
          : {};
      cfg.actionRoom = {
        actionMode,
        slots: slots || (cfg.actionRoom as Record<string, unknown> | undefined)?.slots || [null, null, null],
        updatedBy: client.publicId,
      };
      await db
        .update(voiceRooms)
        .set({ roomSettings: cfg, updatedAt: new Date() })
        .where(eq(voiceRooms.id, roomId));

      this.broadcastToRoom(roomId, {
        type: 'room:action-update',
        roomId,
        actionRoom: cfg.actionRoom,
      });
      return;
    }

    // Live Voice Room Seat Emote broadcast to all room participants
    if (type === 'room:emote') {
      const roomId = client.roomId;
      if (!roomId) return;
      const emoteNumber = Math.max(1, Math.min(30, Math.floor(Number(msg.emoteNumber || 1))));
      const label = String(msg.label || 'Emote').trim().slice(0, 40) || 'Emote';
      const symbol = String(msg.symbol || '✨').trim().slice(0, 8) || '✨';
      const rawMotion = String(msg.motion || 'bounce');
      const motion = ['bounce', 'sway', 'shake', 'pulse'].includes(rawMotion) ? rawMotion : 'bounce';
      this.broadcastToRoom(roomId, {
        type: 'room:emote',
        roomId,
        userUid: client.publicId,
        emoteNumber,
        label,
        symbol,
        motion,
        triggeredAt: Date.now(),
      });
      return;
    }

    // Video Room live playback & camera sync (Level 1-14: Camera + YouTube; Level 15+: Mobile Video)
    if (type === 'room:video-sync') {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
      if (!room || room.status === 'closed') return;
      const canControl = room.isOfficial
        ? isAppAdminRole(client.role)
        : room.ownerUid === client.userUid ||
          (Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid));
      if (!canControl) {
        throw new Error('Only room Host/Admin can control Video Room playback.');
      }
      const sourceType = msg.sourceType === 'local' ? 'local' : 'youtube';
      if (sourceType === 'local' && Number(room.roomLevel ?? 1) < 15) {
        throw new Error('Mobile Video playback unlocks at Room Level 15.');
      }
      this.broadcastToRoom(roomId, {
        type: 'room:video-sync',
        roomId,
        sourceType,
        youtubeUrl: typeof msg.youtubeUrl === 'string' ? msg.youtubeUrl.slice(0, 300) : '',
        playing: Boolean(msg.playing),
        title: typeof msg.title === 'string' ? msg.title.slice(0, 120) : '',
        updatedBy: client.name,
      });
      return;
    }

    if (type === 'room:cam-state') {
      const roomId = client.roomId;
      if (!roomId) return;
      this.broadcastToRoom(
        roomId,
        {
          type: 'room:cam-state',
          roomId,
          userUid: client.publicId,
          hasCamera: Boolean(msg.hasCamera),
        },
        client.userUid
      );
      return;
    }

    // ------------------------------------------------------------------
    // 2. PRIVATE REAL-TIME DM CHAT
    // ------------------------------------------------------------------
    if (type === 'dm:send') {
      await assertUserNotBanned(client.userUid, ['chat', 'complete']);
      const rawRecipient = String(msg.recipientUid || '').trim();
      const imageUrl = validateSafeChatImageUrl(msg.imageUrl);
      const rawBody = String(msg.body || '').trim().slice(0, 1500);
      const body = rawBody || (imageUrl ? '📷 Photo' : '');
      if (!rawRecipient || (!body && !imageUrl)) return;
      const resolvedRecipient = await this.resolveTargetInternalUid(rawRecipient);
      const recipientUid = resolvedRecipient?.uid || rawRecipient;
      const recipientPublicId = resolvedRecipient?.publicId || rawRecipient;

      if (await isBlockedBetween(client.userUid, recipientUid)) {
        throw new Error('Cannot message this user because a block is active.');
      }
      if (!(await areUsersAcceptedFriends(client.userUid, recipientUid))) {
        throw new Error('Only accepted friends can send direct messages.');
      }
      const threadId = makeDmThreadId(client.userUid, recipientUid);
      const [saved] = await db
        .insert(messages)
        .values({
          scope: 'dm',
          threadId,
          senderUid: client.userUid,
          recipientUid,
          body,
          imageUrl,
          kind: imageUrl ? 'photo' : 'chat',
        })
        .returning();

      const payload = {
        type: 'dm:message',
        message: {
          ...saved,
          senderUid: client.publicId,
          recipientUid: recipientPublicId,
          senderName: client.name,
          senderPublicId: client.publicId,
          recipientPublicId,
        },
      };
      this.sendToUser(client.userUid, payload);
      this.sendToUser(recipientUid, payload);
      return;
    }

    // ------------------------------------------------------------------
    // 3. SERVER-AUTHORITATIVE MULTIPLAYER GAMES
    // ------------------------------------------------------------------
    if (type === 'game:matchmake') {
      const gameType = String(msg.gameType || 'carrom') as MultiplayerGameType;
      const match = this.gameEngine.findOrCreateMatchmaking(
        { uid: client.userUid, publicId: client.publicId, name: client.name, vipLevel: client.vipLevel },
        gameType
      );
      this.broadcastMatchSync(match.id);
      return;
    }

    if (type === 'game:create') {
      const gameType = String(msg.gameType || 'carrom') as MultiplayerGameType;
      const match = this.gameEngine.createMatch(
        { uid: client.userUid, publicId: client.publicId, name: client.name, vipLevel: client.vipLevel },
        gameType
      );
      this.broadcastMatchSync(match.id);
      return;
    }

    if (type === 'game:join') {
      const matchId = String(msg.matchId || '');
      const match = this.gameEngine.joinMatch(matchId, {
        uid: client.userUid,
        publicId: client.publicId,
        name: client.name,
        vipLevel: client.vipLevel,
      });
      this.broadcastMatchSync(match.id);
      return;
    }

    if (type === 'game:leave') {
      const requestedMatchId = typeof msg.matchId === 'string' ? msg.matchId : undefined;
      const res = await this.gameEngine.leaveMatch(client.userUid, requestedMatchId);
      const leftId = res.leftMatchId || requestedMatchId || null;
      if (leftId) {
        const peerMap = this.gameVoicePeers.get(leftId);
        if (peerMap) {
          peerMap.delete(client.userUid);
          const peers = Array.from(peerMap.values());
          for (const p of res.match?.players || []) {
            this.sendToUser(p.uid, { type: 'game:voice-peers', matchId: leftId, peers });
          }
          if (peerMap.size === 0) this.gameVoicePeers.delete(leftId);
        }
      }
      this.sendToSocket(client.ws, {
        type: 'game:left',
        matchId: leftId,
      });
      if (res.match) {
        this.broadcastMatchSync(res.match.id);
      }
      return;
    }

    if (type === 'game:chat') {
      await assertUserNotBanned(client.userUid, ['chat', 'complete']);
      const matchId = String(msg.matchId || '');
      const match = this.gameEngine.addChatMessage(matchId, client.userUid, String(msg.text || ''));
      this.broadcastMatchSync(match.id);
      return;
    }

    // In-Game Live WebRTC Voice Chat
    if (type === 'game:voice-join' || type === 'game:voice-leave' || type === 'game:voice-mute') {
      const matchId = String(msg.matchId || '').trim();
      const match = this.gameEngine.getMatch(matchId);
      if (!match) return;
      if (!match.players.some((p) => p.uid === client.userUid)) return;

      if (!this.gameVoicePeers.has(matchId)) {
        this.gameVoicePeers.set(matchId, new Map());
      }
      const peerMap = this.gameVoicePeers.get(matchId)!;

      if (type === 'game:voice-leave') {
        peerMap.delete(client.userUid);
      } else {
        if (type === 'game:voice-join' || msg.muted === false) {
          await assertUserNotBanned(client.userUid, ['mic', 'complete']);
        }
        peerMap.set(client.userUid, {
          publicId: client.publicId,
          name: client.name,
          muted: Boolean(msg.muted ?? false),
        });
      }

      const peers = Array.from(peerMap.values());
      for (const p of match.players) {
        this.sendToUser(p.uid, { type: 'game:voice-peers', matchId, peers });
      }
      return;
    }

    if (type === 'game:rtc-offer' || type === 'game:rtc-answer' || type === 'game:rtc-ice-candidate') {
      const matchId = String(msg.matchId || '').trim();
      const match = this.gameEngine.getMatch(matchId);
      if (!match) return;
      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ''));
      const targetUid = resolvedTarget?.uid || '';
      if (!targetUid) return;
      if (!match.players.some((p) => p.uid === client.userUid) || !match.players.some((p) => p.uid === targetUid)) {
        return;
      }
      this.sendToUser(targetUid, {
        type,
        matchId,
        fromUid: client.publicId,
        fromName: client.name,
        sdp: msg.sdp,
        candidate: msg.candidate,
      });
      return;
    }

    if (type === 'game:invite') {
      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ''));
      const targetUid = resolvedTarget?.uid || '';
      const matchId = String(msg.matchId || '');
      const match = this.gameEngine.getMatch(matchId);
      if (!match) throw new Error('Match not found.');
      if (!targetUid) throw new Error('Target user not found.');
      this.sendToUser(targetUid, {
        type: 'game:invited',
        matchId: match.id,
        gameType: match.gameType,
        fromUid: client.publicId,
        fromName: client.name,
      });
      return;
    }

    if (type === 'game:start') {
      const matchId = String(msg.matchId || '');
      const match = this.gameEngine.startMatch(matchId, client.userUid);
      this.broadcastMatchSync(match.id);
      return;
    }

    if (type === 'game:action') {
      const matchId = String(msg.matchId || '');
      const result = await this.gameEngine.handleAction(
        matchId,
        client.userUid,
        (msg.action as Record<string, unknown>) || {}
      );
      this.broadcastMatchSync(result.match.id);
      return;
    }
  }
}
