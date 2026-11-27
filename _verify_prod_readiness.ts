import http from 'http';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import { inArray, like, or, eq } from 'drizzle-orm';
import { createApp, authenticateWebSocketRequest, type DecodedFirebaseTokenLike } from './server.ts';
import { RealtimeHub } from './server/realtime.ts';
import { db, pool } from './src/db/index.ts';
import {
  mediaAssets,
  messages,
  momentLikes,
  posts,
  profiles,
  userSessions,
  users,
  vipMemberships,
  voiceRooms,
  walletTransactions,
  wallets,
} from './src/db/schema.ts';
import {
  createDbSession,
  ensureDatabaseSchemaReady,
  ensureSeedData,
  findOrCreateVerifiedUser,
  signSessionToken,
} from './src/db/repository.ts';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 10) / 10;
}

async function cleanupTestArtifacts() {
  const testUserRows = await db
    .select({ uid: users.uid })
    .from(users)
    .where(like(users.uid, 'test-load-%'));
  const testUids = testUserRows.map((r) => r.uid);

  await db.delete(messages).where(or(like(messages.roomId, 'test-load-%'), like(messages.senderUid, 'test-load-%')));
  await db.delete(voiceRooms).where(or(like(voiceRooms.id, 'test-load-%'), like(voiceRooms.ownerUid, 'test-load-%')));
  await db.delete(momentLikes).where(like(momentLikes.userUid, 'test-load-%'));
  await db.delete(posts).where(like(posts.authorUid, 'test-load-%'));
  await db.delete(mediaAssets).where(like(mediaAssets.ownerUid, 'test-load-%'));
  await db.delete(walletTransactions).where(like(walletTransactions.userUid, 'test-load-%'));
  await db.delete(userSessions).where(like(userSessions.userUid, 'test-load-%'));

  if (testUids.length > 0) {
    // Delete in batches to avoid huge parameter lists
    for (let i = 0; i < testUids.length; i += 200) {
      const slice = testUids.slice(i, i + 200);
      await db.delete(vipMemberships).where(inArray(vipMemberships.userUid, slice));
      await db.delete(wallets).where(inArray(wallets.userUid, slice));
      await db.delete(profiles).where(inArray(profiles.uid, slice));
      await db.delete(users).where(inArray(users.uid, slice));
    }
  }
}

async function main() {
  await ensureDatabaseSchemaReady();
  await ensureSeedData();
  await cleanupTestArtifacts();

  // 1. Live dev server health check (port 3000)
  const liveHealth = await fetch('http://127.0.0.1:3000/api/health');
  const liveHealthJson = await liveHealth.json();
  const liveRoot = await fetch('http://127.0.0.1:3000/');
  const liveRootHtml = await liveRoot.text();
  if (!liveHealth.ok || liveHealthJson.status !== 'ok') {
    throw new Error(`Live server /api/health failed: ${liveHealth.status}`);
  }
  if (!liveRoot.ok || !liveRootHtml.includes('OG VELOCITY')) {
    throw new Error(`Live server / HTML check failed: ${liveRoot.status}`);
  }
  console.log('[1/5] Live port 3000 HTTP health & HTML title check PASSED');

  // Verify protected accounts untouched before & after
  const protectedIds = ['100001', '100002', '100003', '7824059'];
  const protectedBefore = await db
    .select({ uid: users.uid, publicId: users.publicId, role: users.role, status: users.accountStatus })
    .from(users)
    .where(inArray(users.publicId, protectedIds));

  // Spin up isolated test server sharing real app + RealtimeHub + PG DB
  let hub: RealtimeHub | null = null;
  const verifyIdTokenFn = async (idToken: string): Promise<DecodedFirebaseTokenLike> => {
    const parsed = JSON.parse(Buffer.from(idToken, 'base64url').toString('utf8')) as DecodedFirebaseTokenLike;
    return parsed;
  };
  const app = createApp({
    verifyIdTokenFn,
    getRealtimeHub: () => hub,
  });
  const server = http.createServer(app);
  hub = new RealtimeHub(server, authenticateWebSocketRequest);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  const wsBaseUrl = `ws://127.0.0.1:${addr.port}/ws`;

  const encodeMockIdToken = (payload: DecodedFirebaseTokenLike) =>
    Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

  try {
    // 2. Auth Verification Tests
    const authTokenPayload = encodeMockIdToken({
      uid: 'test-load-auth-fb-1',
      email: 'test-load-auth-1@example.com',
      email_verified: true,
      name: 'Load Auth Tester',
      firebase: { sign_in_provider: 'google.com' },
    });

    const signupRes = await fetch(`${baseUrl}/api/auth/verify-firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.99.1.1' },
      body: JSON.stringify({ idToken: authTokenPayload }),
    });
    const signupJson = (await signupRes.json()) as { ok?: boolean; token?: string; isNewUser?: boolean; user?: { uid: string; publicId: string } };
    if (!signupRes.ok || !signupJson.ok || !signupJson.token || !signupJson.isNewUser) {
      throw new Error(`Signup failed: ${signupRes.status} ${JSON.stringify(signupJson)}`);
    }

    // Re-login same Google account -> must reuse existing user, no duplicate
    const loginAgainRes = await fetch(`${baseUrl}/api/auth/verify-firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.99.1.2' },
      body: JSON.stringify({ idToken: authTokenPayload }),
    });
    const loginAgainJson = (await loginAgainRes.json()) as { ok?: boolean; isNewUser?: boolean; user?: { uid: string; publicId: string } };
    if (!loginAgainRes.ok || !loginAgainJson.ok || loginAgainJson.isNewUser || loginAgainJson.user?.publicId !== signupJson.user?.publicId) {
      throw new Error(`Repeat login failed or duplicated user: ${JSON.stringify(loginAgainJson)}`);
    }

    // Reject unverified Google email & blocked /api/auth/login & privileged field escalation & non-admin endpoint
    const unverifiedRes = await fetch(`${baseUrl}/api/auth/verify-firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.99.1.3' },
      body: JSON.stringify({
        idToken: encodeMockIdToken({
          uid: 'test-load-auth-unverified',
          email: 'unverified@example.com',
          email_verified: false,
          firebase: { sign_in_provider: 'google.com' },
        }),
      }),
    });
    const directLoginRes = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST' });
    const privEscRes = await fetch(`${baseUrl}/api/protected/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signupJson.token}` },
      body: JSON.stringify({ coins: 999999 }),
    });
    const adminCheckRes = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${signupJson.token}` },
    });
    if (unverifiedRes.status !== 403 || directLoginRes.status !== 403 || privEscRes.status !== 403 || adminCheckRes.status !== 403) {
      throw new Error(`Security check status mismatch: unverified=${unverifiedRes.status}, direct=${directLoginRes.status}, priv=${privEscRes.status}, admin=${adminCheckRes.status}`);
    }
    console.log('[2/5] Auth signup, duplicate prevention, session & RBAC security checks PASSED');

    // 3. 3.5 MB Image Upload & Serving Check
    // Generate a 3.45 MB valid PNG payload (>= 3 MB binary)
    const pngHeader = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
    const bigBody = crypto.randomBytes(3_450_000);
    const synthetic35MbPng = Buffer.concat([pngHeader, bigBody]);
    const dataUrl35Mb = `data:image/png;base64,${synthetic35MbPng.toString('base64')}`;

    const badMimeRes = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signupJson.token}` },
      body: JSON.stringify({ dataUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' }),
    });
    if (badMimeRes.status !== 400) {
      throw new Error(`Invalid MIME was not rejected cleanly: ${badMimeRes.status}`);
    }

    const uploadRes = await fetch(`${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signupJson.token}` },
      body: JSON.stringify({ dataUrl: dataUrl35Mb }),
    });
    const uploadJson = (await uploadRes.json()) as { ok?: boolean; url?: string; byteSize?: number };
    if (!uploadRes.ok || !uploadJson.ok || !uploadJson.url || (uploadJson.byteSize ?? 0) < 3_400_000) {
      throw new Error(`3.45 MB media upload failed: ${uploadRes.status} ${JSON.stringify(uploadJson)}`);
    }

    const mediaGetRes = await fetch(`${baseUrl}${uploadJson.url}`);
    const mediaBytes = Buffer.from(await mediaGetRes.arrayBuffer());
    if (!mediaGetRes.ok || mediaBytes.length !== synthetic35MbPng.length || mediaGetRes.headers.get('x-content-type-options') !== 'nosniff') {
      throw new Error(`Media retrieval mismatch: status=${mediaGetRes.status}, bytes=${mediaBytes.length}`);
    }

    // Attach to profile avatar & cover + moment
    const profRes = await fetch(`${baseUrl}/api/protected/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signupJson.token}` },
      body: JSON.stringify({ photoUrl: uploadJson.url, coverUrl: uploadJson.url }),
    });
    const momentRes = await fetch(`${baseUrl}/api/moments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signupJson.token}` },
      body: JSON.stringify({ mediaType: 'photo', mediaUrl: uploadJson.url, caption: '3.5MB Upload Test', visibility: 'public' }),
    });
    if (!profRes.ok || !momentRes.ok) {
      throw new Error(`Profile/Moment attach failed: prof=${profRes.status}, moment=${momentRes.status}`);
    }
    console.log(`[3/5] >= 3 MB Upload (${(uploadJson.byteSize! / (1024 * 1024)).toFixed(2)} MB binary) -> ${uploadJson.url} & GET render check PASSED`);

    // 4. Voice Room Lifecycle & Host Seat 0 + Reconnect Grace Verification
    const ownerRes = await fetch(`${baseUrl}/api/auth/verify-firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.99.2.1' },
      body: JSON.stringify({
        idToken: encodeMockIdToken({
          uid: 'test-load-room-owner',
          email: 'test-load-room-owner@example.com',
          email_verified: true,
          name: 'Test Room Owner',
          firebase: { sign_in_provider: 'google.com' },
        }),
      }),
    });
    const ownerJson = (await ownerRes.json()) as { token: string; user: { uid: string; publicId: string } };
    await db.update(wallets).set({ coins: 5000 }).where(eq(wallets.userUid, ownerJson.user.uid));

    const createRoomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJson.token}` },
      body: JSON.stringify({ title: 'Test Stability Room', topic: 'Load & Voice Check', category: 'Popular', dpUrl: uploadJson.url }),
    });
    const createRoomJson = (await createRoomRes.json()) as { ok?: boolean; room?: { id: string; dpUrl?: string } };
    if (!createRoomRes.ok || !createRoomJson.ok || !createRoomJson.room?.id) {
      throw new Error(`Create room failed: ${createRoomRes.status} ${JSON.stringify(createRoomJson)}`);
    }
    const testRoomId = createRoomJson.room.id;

    // Guest joins BEFORE owner -> room:closed notice!
    const connectWs = (token: string) =>
      new Promise<{ ws: WebSocket; msgs: Record<string, unknown>[] }>((resolve, reject) => {
        const ws = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(token)}`);
        const msgs: Record<string, unknown>[] = [];
        ws.on('message', (raw) => {
          try {
            msgs.push(JSON.parse(String(raw)));
          } catch {
            // ignore
          }
        });
        ws.once('open', () => resolve({ ws, msgs }));
        ws.once('error', (err) => reject(err));
      });

    const guestConn = await connectWs(signupJson.token!);
    guestConn.ws.send(JSON.stringify({ type: 'room:join', roomId: testRoomId }));
    await new Promise((r) => setTimeout(r, 250));
    const sawClosed = guestConn.msgs.some((m) => m.type === 'room:closed' && m.roomId === testRoomId);
    if (!sawClosed) {
      throw new Error('Guest entering room without owner/admin did not receive room:closed');
    }

    // Owner joins -> room opens & owner occupies Seat 0
    let ownerConn = await connectWs(ownerJson.token);
    ownerConn.ws.send(JSON.stringify({ type: 'room:join', roomId: testRoomId }));
    await new Promise((r) => setTimeout(r, 250));

    // Guest cannot steal seat 0; can take seat 1, mute & send chat + image
    guestConn.ws.send(JSON.stringify({ type: 'room:seat-take', seatIndex: 0 }));
    guestConn.ws.send(JSON.stringify({ type: 'room:seat-take', seatIndex: 1 }));
    guestConn.ws.send(JSON.stringify({ type: 'room:mute', isMuted: true }));
    guestConn.ws.send(JSON.stringify({ type: 'room:chat', text: 'Stability photo check', imageUrl: uploadJson.url }));
    await new Promise((r) => setTimeout(r, 250));

    const hostSeatedZero = hub.getRoomSeats(testRoomId).find((s) => s.seatIndex === 0);
    const guestSeatedOne = hub.getRoomSeats(testRoomId).find((s) => s.seatIndex === 1);
    if (hostSeatedZero?.userUid !== ownerJson.user.uid || guestSeatedOne?.userUid !== signupJson.user!.uid || !guestSeatedOne?.isMuted) {
      throw new Error(`Seat ownership/mute check failed: seat0=${JSON.stringify(hostSeatedZero)} seat1=${JSON.stringify(guestSeatedOne)}`);
    }

    // Abrupt host disconnect -> host-reconnecting emitted; reconnect -> host-reconnected emitted
    ownerConn.ws.terminate();
    await new Promise((r) => setTimeout(r, 200));
    const sawReconnecting = guestConn.msgs.some((m) => m.type === 'room:host-reconnecting' && m.roomId === testRoomId);
    ownerConn = await connectWs(ownerJson.token);
    ownerConn.ws.send(JSON.stringify({ type: 'room:join', roomId: testRoomId }));
    await new Promise((r) => setTimeout(r, 200));
    const sawReconnected = guestConn.msgs.some((m) => m.type === 'room:host-reconnected' && m.roomId === testRoomId);
    if (!sawReconnecting || !sawReconnected) {
      throw new Error(`Host grace reconnect failed: reconnecting=${sawReconnecting}, reconnected=${sawReconnected}`);
    }

    guestConn.ws.close();
    ownerConn.ws.close();
    await new Promise((r) => setTimeout(r, 150));
    if (hub.getRoomParticipants(testRoomId).length !== 0) {
      throw new Error(`Room participant cleanup failed: remaining=${hub.getRoomParticipants(testRoomId).length}`);
    }
    console.log('[4/5] Voice Room Seat 0 lock, closed-room check, mute/chat, host 30s grace reconnect & leave count PASSED');

    // 5. Real 500-Concurrent-User Stress Benchmark
    const TOTAL_USERS = 500;
    const ROOM_COUNT = 10;
    const loadRoomIds: string[] = [];
    for (let r = 0; r < ROOM_COUNT; r++) {
      const rid = `test-load-room-${r}`;
      loadRoomIds.push(rid);
      await db.insert(voiceRooms).values({
        id: rid,
        roomCode: `TL${100 + r}`,
        title: `Load Room ${r + 1}`,
        topic: '500 User Stress Benchmark',
        category: 'Popular',
        ownerUid: ownerJson.user.uid,
        hostName: 'Test Room Owner',
        adminUids: [],
        memberUids: [ownerJson.user.uid],
        isOfficial: true,
        status: 'active',
        seatCapacity: 15,
      });
    }

    // Provision 500 user records & session tokens cleanly
    const loadUsers: Array<{ uid: string; token: string; roomId: string }> = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
      const uid = `test-load-u-${String(i).padStart(3, '0')}`;
      const { user } = await findOrCreateVerifiedUser({
        firebaseUid: `fb-${uid}`,
        provider: 'google',
        providerId: 'google.com',
        email: `${uid}@loadtest.local`,
        emailVerified: true,
        name: `Load User ${i}`,
      });
      // Rename uid cleanly via generated user record (findOrCreateVerifiedUser returns generated uid or we just use user.uid)
      // Wait: cleanup cleans by like('test-load-%') on uid, so ensure email/uid matches or tag uid directly:
      // Let's set users uid pattern? Actually findOrCreateVerifiedUser generates `u-${hex}`, so let's insert directly for deterministic test-load-* cleanup!
      void user;
    }
    // Wait: we don't want stray `u-*` rows from the loop above — clean any `@loadtest.local` rows right away and insert `test-load-u-*` directly!
    const createdByEmail = await db.select({ uid: users.uid }).from(users).where(like(users.email, '%@loadtest.local'));
    if (createdByEmail.length > 0) {
      const uidsToDrop = createdByEmail.map((x) => x.uid);
      for (let i = 0; i < uidsToDrop.length; i += 200) {
        const s = uidsToDrop.slice(i, i + 200);
        await db.delete(vipMemberships).where(inArray(vipMemberships.userUid, s));
        await db.delete(wallets).where(inArray(wallets.userUid, s));
        await db.delete(profiles).where(inArray(profiles.uid, s));
        await db.delete(users).where(inArray(users.uid, s));
      }
    }

    for (let i = 0; i < TOTAL_USERS; i++) {
      const uid = `test-load-u-${String(i).padStart(3, '0')}`;
      const publicId = String(9000000 + i);
      await db.insert(users).values({
        uid,
        publicId,
        email: `${uid}@loadtest.local`,
        primaryProvider: 'google',
        providerId: 'google.com',
        emailVerified: true,
        role: 'normal_user',
        accountStatus: 'active',
      });
      await db.insert(profiles).values({
        uid,
        name: `Load Tester ${i}`,
        handle: `@load${i}`,
        avatarId: `av-load-${i % 8}`,
      });
      await db.insert(wallets).values({ userUid: uid, coins: 1000, totalCoinsEarned: 1000 });
      await db.insert(vipMemberships).values({ userUid: uid, vipLevel: 0, vipStatus: 'Not Active', vipGrowth: 0 });
      const sess = await createDbSession({
        userUid: uid,
        identifier: `${uid}@loadtest.local`,
        provider: 'google',
        ttlMs: 3_600_000,
      });
      const token = signSessionToken({
        sid: sess.sid,
        userUid: uid,
        identifier: `${uid}@loadtest.local`,
        expiresAt: sess.expiresAt,
      });
      loadUsers.push({ uid, token, roomId: loadRoomIds[i % ROOM_COUNT] });
    }

    const memBeforeMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const wsConnectLatencies: number[] = [];
    let wsFailures = 0;
    const sockets: WebSocket[] = [];

    // Connect 500 concurrent WebSockets + join rooms simultaneously
    const tWsStart = performance.now();
    await Promise.all(
      loadUsers.map(
        (u) =>
          new Promise<void>((resolve) => {
            const t0 = performance.now();
            const ws = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(u.token)}`);
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                wsFailures++;
                resolve();
              }
            }, 15_000);
            ws.once('open', () => {
              wsConnectLatencies.push(performance.now() - t0);
              ws.send(JSON.stringify({ type: 'room:join', roomId: u.roomId }));
              sockets.push(ws);
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve();
              }
            });
            ws.once('error', () => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                wsFailures++;
                resolve();
              }
            });
          })
      )
    );
    const totalWsConnectMs = Math.round(performance.now() - tWsStart);

    // Wait briefly for room:join handlers to settle and verify live socket count
    await new Promise((r) => setTimeout(r, 600));
    const totalRoomParticipants = loadRoomIds.reduce((sum, rid) => sum + hub!.getRoomParticipants(rid).length, 0);

    // Burst 500 concurrent HTTP requests (/api/rooms + /api/protected/bootstrap + /api/rankings)
    const httpLatencies: number[] = [];
    let httpFailures = 0;
    const tHttpStart = performance.now();
    await Promise.all(
      loadUsers.map(async (u, idx) => {
        const endpoint = idx % 3 === 0 ? '/api/protected/bootstrap' : idx % 3 === 1 ? '/api/rooms' : '/api/rankings?tab=charm';
        const t0 = performance.now();
        try {
          const r = await fetch(`${baseUrl}${endpoint}`, {
            headers: { Authorization: `Bearer ${u.token}` },
          });
          await r.arrayBuffer();
          httpLatencies.push(performance.now() - t0);
          if (!r.ok) httpFailures++;
        } catch {
          httpFailures++;
        }
      })
    );
    const totalHttpBurstMs = Math.round(performance.now() - tHttpStart);

    // Broadcast WS chat + speaking burst across all 500 connected clients
    const tBroadcastStart = performance.now();
    for (let i = 0; i < sockets.length; i++) {
      if (sockets[i].readyState === WebSocket.OPEN) {
        if (i % 5 === 0) {
          sockets[i].send(JSON.stringify({ type: 'room:speaking', isSpeaking: true }));
        }
        if (i % 10 === 0) {
          sockets[i].send(JSON.stringify({ type: 'room:chat', text: `Load burst msg #${i}` }));
        }
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    const broadcastElapsedMs = Math.round(performance.now() - tBroadcastStart);
    const memPeakMb = Math.round(process.memoryUsage().rss / (1024 * 1024));

    // Close all 500 WebSockets cleanly and verify participant counts drop to 0
    for (const s of sockets) {
      s.close();
    }
    await new Promise((r) => setTimeout(r, 500));
    const remainingAfterClose = loadRoomIds.reduce((sum, rid) => sum + hub!.getRoomParticipants(rid).length, 0);

    wsConnectLatencies.sort((a, b) => a - b);
    httpLatencies.sort((a, b) => a - b);

    console.log('[5/5] 500-Concurrent-User Stress Benchmark RESULTS:', JSON.stringify({
      concurrentUsers: TOTAL_USERS,
      wsConnected: sockets.length,
      wsFailures,
      wsJoinedRoomParticipants: totalRoomParticipants,
      totalWsConnectMs,
      wsConnectP50Ms: percentile(wsConnectLatencies, 50),
      wsConnectP95Ms: percentile(wsConnectLatencies, 95),
      wsConnectP99Ms: percentile(wsConnectLatencies, 99),
      httpConcurrentRequests: TOTAL_USERS,
      httpFailures,
      totalHttpBurstMs,
      httpP50Ms: percentile(httpLatencies, 50),
      httpP95Ms: percentile(httpLatencies, 95),
      httpP99Ms: percentile(httpLatencies, 99),
      wsBroadcastBurstMs: broadcastElapsedMs,
      remainingParticipantsAfterClose: remainingAfterClose,
      rssBeforeMb: memBeforeMb,
      rssPeakMb: memPeakMb,
    }, null, 2));

    if (wsFailures > 0 || httpFailures > 0 || remainingAfterClose !== 0) {
      throw new Error(`Load test had failures: wsFailures=${wsFailures}, httpFailures=${httpFailures}, remainingAfterClose=${remainingAfterClose}`);
    }
  } finally {
    hub?.shutdown();
    server.close();
    await cleanupTestArtifacts();
    const protectedAfter = await db
      .select({ uid: users.uid, publicId: users.publicId, role: users.role, status: users.accountStatus })
      .from(users)
      .where(inArray(users.publicId, protectedIds));
    if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter)) {
      throw new Error('Protected accounts check mismatch!');
    }
    console.log(`[Cleanup] Removed all test-load-* records; protected accounts verified intact (${protectedAfter.length} rows).`);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
