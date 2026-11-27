# OG VELOCITY — Firestore Security Specification

## 1. Data Invariants
1. **Identity Isolation (PII Split)**: Public profile fields (`userPublicProfiles/{userId}`) MUST NEVER contain `email`, `phone`, or session tokens. Email/PII belongs exclusively in `userPrivate/{userId}`, readable/writable only by the owning UID (`request.auth.uid == userId`) or an administrator.
2. **Self-Role Escalation Prevention**: Users MUST NEVER assign themselves `role`, `isAdmin`, `vipLevel`, or `coins` in Firestore documents. Only `/admins/{userId}` or verified Super Admin email (`email_verified == true`) grants admin access.
3. **Presence Integrity**: A user can write `/presence/{userId}` ONLY when `userId == request.auth.uid` and `incoming().uid == request.auth.uid`, with verified email.
4. **Friend Request Ownership & State Machine**: A user can create `/friendRequests/{requestId}` ONLY when `incoming().fromUid == request.auth.uid`, `incoming().toUid != request.auth.uid`, `incoming().status == 'pending'`. Only the recipient (`toUid`) may accept or reject; only the sender (`fromUid`) may cancel/delete a pending outgoing request.
5. **Private Chat Master Gate & Friendship Boundary**: Subcollection `/chats/{chatId}/messages/{messageId}` enforces the Master Gate using `get()` on `/chats/{chatId}` verifying `request.auth.uid in chatDoc.participants`, `participants.size() == 2`, and `incoming().senderUid == request.auth.uid`.
6. **Immutable Ownership & Server Timestamps**: Creation requires `createdAt == request.time`; updates require `updatedAt == request.time` and unchanged owner/author IDs.
7. **ID & Payload Bounds**: Every document path variable passes `isValidId()` (`<= 128` chars, `^[a-zA-Z0-9_\-]+$`), every string has `.size()` bounds, and every write validates exact allowed keys via `hasAll` / `hasOnly` and `affectedKeys().hasOnly(...)`.

## 2. "Dirty Dozen" Attack Payloads (Expected: `PERMISSION_DENIED`)
1. Spoofed Admin Creation: Write `/admins/attackerUid` with `{ active: true }` as non-super-admin.
2. Unverified Email Spoof: Authenticate with `email_verified: false` matching admin email and write `/userPrivate/otherUid`.
3. Cross-User PII Read: Signed-in user `uidA` calls `get` on `/userPrivate/uidB`.
4. Shadow Field Injection on Profile: Write `/userPublicProfiles/uidA` with extra key `isAdmin: true` or `vipLevel: 15`.
5. Oversized ID Poisoning: Write `/userPublicProfiles/<1500-char-id>` to exhaust storage/index limits.
6. Spoofed Presence Write: `uidA` writes `/presence/uidB` setting `online: true`.
7. Self Friend Request: `uidA` writes `/friendRequests/uidA_uidA` with `fromUid == toUid`.
8. Friend Request State Shortcut: Sender `uidA` updates `/friendRequests/uidA_uidB` directly to `status: 'accepted'`.
9. Forged Chat Participant Injection: `uidC` creates `/chats/chat1` claiming `participants: ['uidA', 'uidB']` without including `uidC`.
10. Unbounded Participant Array: Create `/chats/chat1` with `participants: ['a','b','c','d']` (`size() > 2`).
11. Unauthorized Chat Message Read/Write: `uidC` writes `/chats/uidA_uidB/messages/m1` with `senderUid: 'uidA'`.
12. Fake Timestamp Backdating: Write message or profile with client-chosen `createdAt` not equal to `request.time`.
