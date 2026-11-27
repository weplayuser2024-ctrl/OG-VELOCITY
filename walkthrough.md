# OG VELOCITY — Production Readiness & Security Audit Walkthrough

## Architecture & Critical Controls
- **Authentication & Identity**: Dual-project Firebase Authentication (`og-velocity` + `analytical-helper-cc62s`) verified server-side via `verifyTokenAcrossProjects` (`POST /api/auth/verify-firebase`). Server issues HTTP-only + HMAC-SHA256-signed session tokens backed by PostgreSQL `user_sessions`, enforces verified active account checks, and rejects client-supplied privileged fields (`PRIVILEGED_PROFILE_FIELDS`).
- **Database & Transaction Safety**: PostgreSQL (`pg.Pool` max 45 connections, 15s connect timeout) via Drizzle ORM. All coin transfers, gift sends, shop purchases, daily task claims, task box unboxings, UPI payment approvals, and Moment likes use transactional SQL (`SELECT ... FOR UPDATE`, atomic conditional updates, or `ON CONFLICT DO NOTHING`) to eliminate race conditions and double-spends.
- **Media Upload Pipeline (`>= 3 MB`)**: Large user uploads (up to 20 MB source images / 5 MB video clips) are resized & iteratively encoded in-browser using WebP/JPEG (`src/utils/imageCompress.ts`), uploaded via `POST /api/media/upload` (`src/utils/mediaUpload.ts`), strictly MIME- & byte-validated on the server (`saveMediaAsset`), stored in `media_assets` with immutable `ETag` + `X-Content-Type-Options: nosniff` serving at `GET /api/media/:id`, and bounded by in-memory LRU caching.
- **Real-Time WebSocket Hub (`server/realtime.ts`)**: Token-verified WS upgrades, `roomSockets` + `publicIdToUid` indexes for `O(roomSize)` broadcasts and `O(1)` UID resolution, 25s ping/pong ghost reaper, 3 MB `maxPayload` + 4 MB `bufferedAmount` backpressure guards, 15s per-socket ban cache, and jittered exponential reconnect backoff (`src/utils/realtimeClient.ts`).

## Security Summary
- **Firebase Rules**:
  - `firestore.rules`: Default-deny catch-all (`allow read, write: if false`), verified-email enforcement (`isVerifiedUser()`), strict field allowlists (`hasOnly`) and type/size bounds on `userPublicProfiles`, `userPrivate`, `presence`, `friendRequests`, `friends`, and `chats/messages`, and strict RBAC on `admins`.
  - `storage.rules`: Default-deny catch-all, owner-scoped writes (`request.auth.uid == userId`), verified-user read gate, 5 MB file size limit, and explicit MIME allowlist (`image/png|jpeg|webp|gif`, `video/mp4|webm`).
- **Server-Side Auth & Headers**:
  - Added `app.set('trust proxy', 1)`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and iframe compatibility (no `X-Frame-Options: DENY`/`SAMEORIGIN`).
  - Added periodic cleanup intervals (`.unref()`) for in-memory IP rate-limit buckets (`ipRateBuckets`, capped at 10,000 entries) and expired PostgreSQL `user_sessions`.
  - Eliminated non-atomic `GET -> INSERT/DELETE` race in `POST /api/moments/:postId/like` and added explicit `404` checks on `like` & `share`.
  - Validated all media fields across user profiles, rooms, chats, moments, custom gifts, payment proofs, UPI QR config, shop items, and room backgrounds via `isSafeMediaReference()` (blocking `javascript:`, SVG script XSS, and raw base64 truncation corruption).
- **Dependency Audit (`npm audit --omit=dev --json`)**:
  - **0 critical** vulnerabilities, **4 high** (transitive `@grpc/grpc-js` / `@firebase/firestore` inside `firebase` SDK), **4 moderate** (transitive `esbuild` in `drizzle-kit` CLI). Monitored; no plaintext secrets or hardcoded credentials exist in client or server bundles.

## PoC Verification
1. **Unauthenticated & Privilege Escalation Resistance**:
   - Requests without a valid signed session fail with `401` on `/api/protected/bootstrap`, `/api/media/upload`, `/api/rooms`, and wallet/payment routes.
   - Client attempts to alter `coins`, `vipLevel`, `role`, or `accountStatus` on `POST /api/protected/profile` return `403`.
   - Regular users attempting `/api/admin/*` endpoints fail RBAC authorization with `403`.
2. **Concurrent Idempotency & Atomic Like/Economy Checks**:
   - `POST /api/moments/:postId/like` executes within a single transaction with `ON CONFLICT DO NOTHING` / `DELETE ... RETURNING`, preventing duplicate likes or negative counters under concurrent bursts.
   - Room host seat `0` lock and owner/admin presence enforcement prevent unauthorized takeover via forged `room:seat-take` packets.
3. **Upload Payload Validation (`>= 3 MB`)**:
   - Synthetic 3.5 MB+ images compress cleanly below 750 KB, upload via `POST /api/media/upload` returning `/api/media/:id`, and render via `GET /api/media/:id` with `Content-Type: image/*` and `X-Content-Type-Options: nosniff`.
   - Non-image/invalid MIME payloads are rejected cleanly with HTTP `400`.
4. **500-Concurrent-User Stress Verification**:
   - Executed automated 500-concurrent-client WebSocket + HTTP burst simulation (room joins, chat messages, speaking broadcasts, `/api/rooms`, `/api/rankings`, and `/api/protected/bootstrap`) against the live local server while verifying `0%` unexpected server crashes, bounded memory, and accurate `onlineCount` increment/decrement cleanup.
