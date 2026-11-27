import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// 1. Users (anchored on Firebase Auth UID + immutable publicId ZAY-XXXXXX)
export const users = pgTable(
  'users',
  {
    uid: text('uid').primaryKey(), // Firebase Auth UID
    publicId: text('public_id').notNull().unique(), // Immutable ZAY-XXXXXX
    email: text('email').unique(),
    phone: text('phone').unique(),
    primaryProvider: text('primary_provider').notNull().default('google'), // 'google' | 'phone' | 'facebook'
    emailVerified: boolean('email_verified').notNull().default(false),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    role: text('role').notNull().default('normal_user'), // 'normal_user' | 'support_staff' | 'moderator' | 'admin' | 'super_admin'
    accountStatus: text('account_status').notNull().default('active'), // 'active' | 'suspended' | 'banned'
    banReason: text('ban_reason'),
    referredByUid: text('referred_by_uid'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    adminNotes: jsonb('admin_notes')
      .$type<Array<{ id: string; note: string; authorUid: string; authorName: string; createdAt: string }>>()
      .notNull()
      .default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('users_role_idx').on(t.role),
    index('users_status_idx').on(t.accountStatus),
    index('users_public_id_idx').on(t.publicId),
  ]
);

// 2. Auth Identities (supports multi-provider linking without duplicate profiles)
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'google.com' | 'phone' | 'facebook.com'
    providerSubject: text('provider_subject').notNull(),
    email: text('email'),
    phone: text('phone'),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('auth_identities_provider_subject_idx').on(t.provider, t.providerSubject),
    index('auth_identities_user_idx').on(t.userUid),
  ]
);

// Reserved immutable Public IDs (never reused even if account removed)
export const reservedPublicIds = pgTable('reserved_public_ids', {
  publicId: text('public_id').primaryKey(),
  userUid: text('user_uid').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Server-side Sessions (backed in DB, signed HTTP-only cookies + Bearer tokens)
export const userSessions = pgTable(
  'user_sessions',
  {
    sid: text('sid').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    identifier: text('identifier').notNull(),
    provider: text('provider').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('user_sessions_uid_idx').on(t.userUid)]
);

// 3. Profiles (separate table from auth identity)
export const profiles = pgTable(
  'profiles',
  {
    userUid: text('user_uid')
      .primaryKey()
      .references(() => users.uid, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    handle: text('handle').notNull(),
    photoUrl: text('photo_url'),
    coverUrl: text('cover_url'),
    bio: text('bio').notNull().default(''),
    gender: text('gender').notNull().default('Male'),
    age: integer('age').notNull().default(21),
    country: text('country').notNull().default('India'),
    ornament: text('ornament').notNull().default('crown'),
    equippedFrameId: text('equipped_frame_id'),
    equippedRingId: text('equipped_ring_id'),
    equippedEntryId: text('equipped_entry_id'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    cpPartnerUid: text('cp_partner_uid'),
    themeMode: text('theme_mode').notNull().default('dark'),
    equippedEmoteId: text('equipped_emote_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('profiles_display_name_idx').on(t.displayName),
    index('profiles_handle_idx').on(t.handle),
  ]
);

// 4. Wallets (atomic coin ledger anchor; starts at 0)
export const wallets = pgTable('wallets', {
  userUid: text('user_uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  coins: bigint('coins', { mode: 'number' }).notNull().default(0),
  totalPurchasedCoins: bigint('total_purchased_coins', { mode: 'number' }).notNull().default(0),
  totalSpentCoins: bigint('total_spent_coins', { mode: 'number' }).notNull().default(0),
  totalReceivedCoins: bigint('total_received_coins', { mode: 'number' }).notNull().default(0),
  isFrozen: boolean('is_frozen').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 5. Wallet Transactions (immutable ledger with idempotency keys)
export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: serial('id').primaryKey(),
    txId: text('tx_id').notNull().unique(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'topup_credit' | 'admin_credit' | 'admin_deduct' | 'transfer_out' | 'transfer_in' | 'gift_spend' | 'gift_receive' | 'shop_spend' | 'task_reward' | 'game_reward' | 'refund_reversal'
    amount: bigint('amount', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    idempotencyKey: text('idempotency_key').unique(),
    description: text('description').notNull(),
    actorUid: text('actor_uid'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('wallet_tx_user_idx').on(t.userUid),
    index('wallet_tx_created_idx').on(t.createdAt),
  ]
);

// 6. Payment Orders (Permanent UPI QR + UTR + Screenshot + Admin Approval)
export const paymentOrders = pgTable(
  'payment_orders',
  {
    orderId: text('order_id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    orderType: text('order_type').notNull(), // 'vip' | 'coins'
    packageId: text('package_id').notNull(),
    packageName: text('package_name').notNull(),
    amountInr: integer('amount_inr').notNull(),
    coinsAmount: bigint('coins_amount', { mode: 'number' }).notNull().default(0),
    grantedVipLevel: integer('granted_vip_level').notNull().default(0),
    vipDurationDays: integer('vip_duration_days').notNull().default(0),
    bonusGrowth: integer('bonus_growth').notNull().default(0),
    upiIdUsed: text('upi_id_used').notNull().default(''),
    qrVersionId: integer('qr_version_id'),
    accountNameUsed: text('account_name_used'),
    providerUsed: text('provider_used'),
    qrDataUrlSnapshot: text('qr_data_url_snapshot'),
    utrNumber: text('utr_number').unique(),
    accountHolderName: text('account_holder_name'),
    paymentDateTime: text('payment_date_time'),
    screenshotDataUrl: text('screenshot_data_url'),
    payerNote: text('payer_note'),
    status: text('status').notNull().default('awaiting_payment'), // 'awaiting_payment' | 'pending_review' | 'approved' | 'rejected' | 'cancelled'
    reviewedByUid: text('reviewed_by_uid'),
    reviewNote: text('review_note'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [
    index('payment_orders_user_idx').on(t.userUid),
    index('payment_orders_status_idx').on(t.status),
    index('payment_orders_user_status_created_idx').on(t.userUid, t.status, t.createdAt),
  ]
);

// 6b. Dynamic Payment QR Versions & Audit Trail
export const paymentQrVersions = pgTable(
  'payment_qr_versions',
  {
    id: serial('id').primaryKey(),
    versionNumber: integer('version_number').notNull(),
    accountName: text('account_name').notNull(),
    upiId: text('upi_id').notNull(),
    provider: text('provider').notNull(),
    customQrDataUrl: text('custom_qr_data_url'),
    qrPreviewDataUrl: text('qr_preview_data_url'),
    note: text('note').notNull().default(''),
    active: boolean('active').notNull().default(true),
    screens: jsonb('screens').$type<string[]>().notNull().default(['coins', 'vip']),
    updatedByUid: text('updated_by_uid'),
    updatedByName: text('updated_by_name'),
    changeSummary: text('change_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('payment_qr_versions_created_idx').on(t.createdAt)]
);

// 7. VIP Packages & Coin Packages (Admin-configurable)
export const vipPackages = pgTable('vip_packages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceInr: integer('price_inr').notNull(),
  durationDays: integer('duration_days').notNull(),
  grantedVipLevel: integer('granted_vip_level').notNull(),
  bonusGrowth: integer('bonus_growth').notNull(),
  perks: jsonb('perks').$type<string[]>().notNull().default([]),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const coinPackages = pgTable('coin_packages', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  coins: bigint('coins', { mode: 'number' }).notNull(),
  bonusCoins: bigint('bonus_coins', { mode: 'number' }).notNull().default(0),
  priceInr: integer('price_inr').notNull(),
  highlight: text('highlight'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8. VIP Memberships (starts at VIP 0 Inactive; NEVER granted by login/tasks/charm/ranking)
export const vipMemberships = pgTable('vip_memberships', {
  userUid: text('user_uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  vipLevel: integer('vip_level').notNull().default(0), // 0..18
  vipStatus: text('vip_status').notNull().default('inactive'), // 'inactive' | 'active' | 'expired'
  vipGrowth: integer('vip_growth').notNull().default(0),
  activatedByOrderId: text('activated_by_order_id'),
  activatedByAdminUid: text('activated_by_admin_uid'),
  planLabel: text('plan_label'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastDecayDateKey: text('last_decay_date_key'),
  lastDecayAt: timestamp('last_decay_at', { withTimezone: true }),
  graceDaysApplied: integer('grace_days_applied').notNull().default(15),
  customBenefits: jsonb('custom_benefits').$type<string[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8b. VIP Subscription Grant & Renewal History (distinct from payment_orders)
export const vipSubscriptionHistory = pgTable(
  'vip_subscription_history',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    action: text('action').notNull(), // 'activate' | 'renew' | 'admin_grant' | 'super_admin_override'
    source: text('source').notNull(), // 'payment_order' | 'admin_grant' | 'super_admin_override'
    orderId: text('order_id'),
    packageId: text('package_id'),
    packageName: text('package_name'),
    months: integer('months').notNull().default(0),
    durationDays: integer('duration_days').notNull().default(0),
    startingVipLevel: integer('starting_vip_level').notNull().default(1),
    resultingVipLevel: integer('resulting_vip_level').notNull().default(1),
    previousExpiresAt: timestamp('previous_expires_at', { withTimezone: true }),
    newExpiresAt: timestamp('new_expires_at', { withTimezone: true }),
    actorUid: text('actor_uid'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vip_sub_history_user_idx').on(t.userUid),
    index('vip_sub_history_created_idx').on(t.createdAt),
  ]
);

// 8c. VIP Point Ledger (tracks gifting points & post-grace daily decay)
export const vipPointLedger = pgTable(
  'vip_point_ledger',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    vipLevelAfter: integer('vip_level_after').notNull(),
    source: text('source').notNull(), // 'gift_spend' | 'decay' | 'migration' | 'super_admin_override'
    referenceId: text('reference_id'),
    idempotencyKey: text('idempotency_key').unique(),
    description: text('description').notNull(),
    actorUid: text('actor_uid'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vip_point_ledger_user_idx').on(t.userUid),
    index('vip_point_ledger_source_idx').on(t.source),
  ]
);

// 9. VIP Progression Rules (VIP 1 -> 18 cumulative points)
export const vipProgressionRules = pgTable('vip_progression_rules', {
  level: integer('level').primaryKey(),
  title: text('title').notNull(),
  requiredPoints: integer('required_points').notNull(),
  stepPoints: integer('step_points').notNull(),
  badgeColor: text('badge_color').notNull(),
  benefits: jsonb('benefits').$type<string[]>().notNull().default([]),
});

// 10. Gifts (CRUD in /admin)
export const gifts = pgTable('gifts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cost: integer('cost').notNull(),
  charmValue: integer('charm_value').notNull(),
  randomCoinsMin: integer('random_coins_min').notNull().default(0),
  randomCoinsMax: integer('random_coins_max').notNull().default(0),
  rarity: text('rarity').notNull().default('Standard'),
  primaryColor: text('primary_color').notNull(),
  secondaryColor: text('secondary_color').notNull(),
  description: text('description').notNull(),
  particleStyle: text('particle_style').notNull(),
  giftNumber: integer('gift_number').notNull().default(1),
  artworkUrl: text('artwork_url'),
  animationUrl: text('animation_url'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 10b. User-Submitted Custom Gifts (Pending -> Admin Review/Edit -> Approved in Catalog)
export const customGifts = pgTable(
  'custom_gifts',
  {
    id: text('id').primaryKey(),
    creatorUid: text('creator_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    cost: integer('cost').notNull(),
    charmValue: integer('charm_value').notNull(),
    rarity: text('rarity').notNull().default('Signature'),
    description: text('description').notNull(),
    primaryColor: text('primary_color').notNull().default('#A855F7'),
    secondaryColor: text('secondary_color').notNull().default('#38BDF8'),
    particleStyle: text('particle_style').notNull().default('crown'),
    artworkUrl: text('artwork_url'),
    animationVideoUrl: text('animation_video_url'),
    videoFileName: text('video_file_name'),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
    approvedGiftId: text('approved_gift_id'),
    reviewedByUid: text('reviewed_by_uid'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('custom_gifts_status_idx').on(t.status),
    index('custom_gifts_creator_idx').on(t.creatorUid),
  ]
);

// 11. Gift Transactions
export const giftTransactions = pgTable(
  'gift_transactions',
  {
    id: serial('id').primaryKey(),
    txId: text('tx_id').notNull().unique(),
    senderUid: text('sender_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    recipientUid: text('recipient_uid').notNull(),
    roomId: text('room_id'),
    giftId: text('gift_id').notNull(),
    giftName: text('gift_name').notNull(),
    quantity: integer('quantity').notNull(),
    coinsSpent: bigint('coins_spent', { mode: 'number' }).notNull(),
    coinsCreditedToRecipient: bigint('coins_credited_to_recipient', { mode: 'number' }).notNull(),
    charmAwarded: bigint('charm_awarded', { mode: 'number' }).notNull(),
    vipGrowthAwarded: integer('vip_growth_awarded').notNull().default(0),
    customMessage: text('custom_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('gift_tx_sender_idx').on(t.senderUid),
    index('gift_tx_recipient_idx').on(t.recipientUid),
  ]
);

// 12. Voice Rooms (10 / 15 / 19 seats; default 12 active speakers + owner fixed + partner right)
export const voiceRooms = pgTable(
  'voice_rooms',
  {
    id: text('id').primaryKey(),
    roomCode: text('room_code').notNull().unique(),
    title: text('title').notNull(),
    topic: text('topic').notNull().default(''),
    category: text('category').notNull().default('Popular'),
    ownerUid: text('owner_uid').notNull(),
    hostName: text('host_name').notNull(),
    seatCapacity: integer('seat_capacity').notNull().default(15),
    activeSpeakerSlots: integer('active_speaker_slots').notNull().default(12),
    isOfficial: boolean('is_official').notNull().default(false),
    isLocked: boolean('is_locked').notNull().default(false),
    passcodeHash: text('passcode_hash'),
    bgThemeId: text('bg_theme_id'),
    bgUrl: text('bg_url'),
    dpUrl: text('dp_url'),
    roomLevel: integer('room_level').notNull().default(1),
    roomXp: integer('room_xp').notNull().default(0),
    ambiance: text('ambiance').notNull().default('indigo'),
    adminUids: jsonb('admin_uids').$type<string[]>().notNull().default([]),
    lockedSeats: jsonb('locked_seats').$type<number[]>().notNull().default([]),
    roomSettings: jsonb('room_settings').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('active'), // 'active' | 'closed'
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedReason: text('closed_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('voice_rooms_status_idx').on(t.status)]
);

// 13. Room Participants
export const roomParticipants = pgTable(
  'room_participants',
  {
    id: serial('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => voiceRooms.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    seatIndex: integer('seat_index'), // null = listener; 0 = owner fixed
    role: text('role').notNull().default('listener'), // 'owner' | 'admin' | 'moderator' | 'speaker' | 'listener'
    isMuted: boolean('is_muted').notNull().default(false),
    isSpeaking: boolean('is_speaking').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('room_participants_unique_idx').on(t.roomId, t.userUid),
    index('room_participants_room_idx').on(t.roomId),
  ]
);

// 14. Messages (Private DMs + Voice Room chat)
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    scope: text('scope').notNull(), // 'dm' | 'room'
    threadId: text('thread_id').notNull(),
    senderUid: text('sender_uid').notNull(),
    recipientUid: text('recipient_uid'),
    body: text('body').notNull(),
    imageUrl: text('image_url'),
    kind: text('kind').notNull().default('chat'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_thread_idx').on(t.threadId, t.createdAt),
    index('messages_recipient_idx').on(t.recipientUid, t.readAt),
    index('messages_scope_users_idx').on(t.scope, t.senderUid, t.recipientUid, t.createdAt),
  ]
);

// 15. Friends & Blocks
export const friends = pgTable(
  'friends',
  {
    id: serial('id').primaryKey(),
    requesterUid: text('requester_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    addresseeUid: text('addressee_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'blocked'
    bondTag: text('bond_tag'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('friends_pair_unique_idx').on(t.requesterUid, t.addresseeUid),
    index('friends_addressee_idx').on(t.addresseeUid),
    index('friends_requester_status_idx').on(t.requesterUid, t.status),
    index('friends_addressee_status_idx').on(t.addresseeUid, t.status),
  ]
);

// 16. Posts (Moments)
export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    authorUid: text('author_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull().default('photo'), // 'photo' | 'video' | 'text'
    mediaUrl: text('media_url'),
    caption: text('caption').notNull(),
    likesCount: integer('likes_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    sharesCount: integer('shares_count').notNull().default(0),
    status: text('status').notNull().default('active'), // 'active' | 'hidden' | 'removed'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('posts_author_idx').on(t.authorUid), index('posts_created_idx').on(t.createdAt)]
);

// 17. Comments
export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorUid: text('author_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('comments_post_idx').on(t.postId)]
);

// 18. Likes
export const likes = pgTable(
  'likes',
  {
    id: serial('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('likes_post_user_unique_idx').on(t.postId, t.userUid)]
);

// 19. Charm Records (immutable audit of charm growth; starts at 0, NEVER touches VIP)
export const charmRecords = pgTable(
  'charm_records',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    delta: bigint('delta', { mode: 'number' }).notNull(),
    totalAfter: bigint('total_after', { mode: 'number' }).notNull(),
    source: text('source').notNull(), // 'gift_received' | 'admin_adjust' | 'event_bonus'
    referenceId: text('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('charm_records_user_idx').on(t.userUid)]
);

// 20. Rankings (Top 50 Weekly, Monthly, Overall)
export const rankings = pgTable(
  'rankings',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    periodKey: text('period_key').notNull(), // 'overall' | 'weekly-YYYY-Www' | 'monthly-YYYY-MM'
    charmScore: bigint('charm_score', { mode: 'number' }).notNull().default(0),
    giftsSentScore: bigint('gifts_sent_score', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rankings_user_period_unique_idx').on(t.userUid, t.periodKey),
    index('rankings_period_charm_idx').on(t.periodKey, t.charmScore),
  ]
);

// 21. Tasks (Daily / Weekly / Event)
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  category: text('category').notNull().default('daily'), // 'daily' | 'weekly' | 'event'
  actionType: text('action_type').notNull(), // 'checkin' | 'voice_time' | 'send_gift' | 'post_moment' | 'play_game' | 'add_friend'
  targetCount: integer('target_count').notNull().default(1),
  rewardCoins: integer('reward_coins').notNull().default(100),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 22. Task Progress
export const taskProgress = pgTable(
  'task_progress',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    cycleKey: text('cycle_key').notNull(),
    progress: integer('progress').notNull().default(0),
    claimed: boolean('claimed').notNull().default(false),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('task_progress_unique_idx').on(t.userUid, t.taskId, t.cycleKey)]
);

// 23. Events (Live synced from /admin to Discover/Home)
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  description: text('description').notNull().default(''),
  bannerUrl: text('banner_url'),
  eventType: text('event_type').notNull().default('tournament'),
  rewardCoins: integer('reward_coins').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('live'), // 'draft' | 'upcoming' | 'live' | 'ended'
  createdByUid: text('created_by_uid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 24. Event Participants
export const eventParticipants = pgTable(
  'event_participants',
  {
    id: serial('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('event_participants_unique_idx').on(t.eventId, t.userUid)]
);

// 25. Admin Users & 26. Roles Permissions
export const rolesPermissions = pgTable('roles_permissions', {
  role: text('role').primaryKey(), // 'super_admin' | 'admin' | 'moderator' | 'support_staff'
  label: text('label').notNull(),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable('admin_users', {
  userUid: text('user_uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  role: text('role')
    .notNull()
    .references(() => rolesPermissions.role),
  assignedByUid: text('assigned_by_uid'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 26b. Granular Admin Permission Sets, Per-User Assignments & Audit History
export const adminPermissionSets = pgTable('admin_permission_sets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  createdByUid: text('created_by_uid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminUserPermissions = pgTable('admin_user_permissions', {
  userUid: text('user_uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  customPermissions: jsonb('custom_permissions').$type<string[]>().notNull().default([]),
  permissionSetId: text('permission_set_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  grantedByUid: text('granted_by_uid'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminPermissionHistory = pgTable(
  'admin_permission_history',
  {
    id: serial('id').primaryKey(),
    targetUid: text('target_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    actorUid: text('actor_uid').notNull(),
    action: text('action').notNull(),
    previousPermissions: jsonb('previous_permissions').$type<string[]>().notNull().default([]),
    nextPermissions: jsonb('next_permissions').$type<string[]>().notNull().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('admin_perm_history_target_idx').on(t.targetUid),
    index('admin_perm_history_created_idx').on(t.createdAt),
  ]
);

// 27. Reports
export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    reporterUid: text('reporter_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(), // 'user' | 'room' | 'post' | 'message'
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').notNull().default('open'), // 'open' | 'resolved' | 'dismissed'
    resolvedByUid: text('resolved_by_uid'),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('reports_status_idx').on(t.status)]
);

// 28. Notifications & Announcements
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid'), // null = global announcement broadcast
    type: text('type').notNull().default('system'), // 'system' | 'payment' | 'vip' | 'gift' | 'friend' | 'event' | 'announcement'
    title: text('title').notNull(),
    body: text('body').notNull(),
    read: boolean('read').notNull().default(false),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userUid, t.read)]
);

// 29. Audit Logs (immutable record of every admin/financial/VIP action)
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUid: text('actor_uid').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_actor_idx').on(t.actorUid),
    index('audit_logs_created_idx').on(t.createdAt),
  ]
);

// Platform Settings (Permanent UPI QR, Announcements banner, etc.)
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedByUid: text('updated_by_uid'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Room Backgrounds (Admin-managed)
export const roomBackgrounds = pgTable('room_backgrounds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gradient: text('gradient').notNull(),
  imageUrl: text('image_url'),
  accent: text('accent').notNull(),
  ambiance: text('ambiance').notNull().default('indigo'),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// User Shop Inventory (rings, 3-day frames, entries)
export const userInventory = pgTable(
  'user_inventory',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    category: text('category').notNull(),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('user_inventory_unique_idx').on(t.userUid, t.itemId)]
);

// Authoritative Game Matches (Carrom / UNO / Laser Tag)
export const gameMatches = pgTable(
  'game_matches',
  {
    id: text('id').primaryKey(),
    gameType: text('game_type').notNull(), // 'carrom' | 'uno' | 'laser_tag'
    hostUid: text('host_uid').notNull(),
    status: text('status').notNull().default('lobby'), // 'lobby' | 'playing' | 'finished'
    winnerUid: text('winner_uid'),
    players: jsonb('players').$type<Array<{ uid: string; name: string; score: number }>>().notNull().default([]),
    stateJson: jsonb('state_json').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('game_matches_status_idx').on(t.status)]
);

// 30. CP Proposals & Active CP Relationships (Separate from Avatar Ring Shop)
export const cpProposals = pgTable(
  'cp_proposals',
  {
    id: text('id').primaryKey(),
    fromUid: text('from_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    toUid: text('to_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    ringNumber: integer('ring_number').notNull().default(1),
    ringName: text('ring_name').notNull().default('Couple Bond Ring'),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'cancelled'
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cp_proposals_from_idx').on(t.fromUid, t.status),
    index('cp_proposals_to_idx').on(t.toUid, t.status),
  ]
);

export const cpRelationships = pgTable(
  'cp_relationships',
  {
    id: text('id').primaryKey(),
    userAUid: text('user_a_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    userBUid: text('user_b_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    proposalId: text('proposal_id'),
    ringNumber: integer('ring_number').notNull().default(1),
    ringName: text('ring_name').notNull().default('Couple Bond Ring'),
    cpCharm: integer('cp_charm').notNull().default(0),
    status: text('status').notNull().default('active'), // 'active' | 'ended'
    endedByUid: text('ended_by_uid'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    index('cp_rel_a_status_idx').on(t.userAUid, t.status),
    index('cp_rel_b_status_idx').on(t.userBUid, t.status),
  ]
);

// 31. Admin-Managed Shop Items (Rings, Frames, Entry Effects, Seat FX, Room Themes)
export const shopItems = pgTable(
  'shop_items',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(), // 'ring' | 'frame' | 'bubble' | 'entry' | 'seat-fx' | 'room-theme'
    description: text('description').notNull().default(''),
    priceCoins: bigint('price_coins', { mode: 'number' }).notNull().default(100000),
    durationDays: integer('duration_days'), // null = permanent
    imageUrl: text('image_url'),
    previewColor: text('preview_color').notNull().default('#38BDF8'),
    ringNumber: integer('ring_number'),
    seatFrameNumber: integer('seat_frame_number'),
    styleVariant: text('style_variant'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shop_items_category_idx').on(t.category),
    index('shop_items_active_idx').on(t.active),
  ]
);

// 32. Granular & Complete User Bans (Complete ID, Microphone, Voice Seat, Chat)
export const userBans = pgTable(
  'user_bans',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    banType: text('ban_type').notNull(), // 'complete' | 'mic' | 'seat' | 'chat'
    durationDays: integer('duration_days'), // null = permanent
    expiresAt: timestamp('expires_at', { withTimezone: true }), // null = permanent
    reason: text('reason').notNull().default('Policy violation'),
    bannedByUid: text('banned_by_uid').notNull(),
    active: boolean('active').notNull().default(true),
    revokedByUid: text('revoked_by_uid'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_bans_uid_active_idx').on(t.userUid, t.active),
    index('user_bans_type_idx').on(t.banType),
  ]
);

// 33. Verified Friend Invite Referrals (+25,000 Coins each)
export const referrals = pgTable(
  'referrals',
  {
    id: serial('id').primaryKey(),
    inviterUid: text('inviter_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    invitedUid: text('invited_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    inviteCode: text('invite_code').notNull(),
    rewardCoins: integer('reward_coins').notNull().default(25000),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('referrals_invited_unique_idx').on(t.invitedUid),
    index('referrals_inviter_idx').on(t.inviterUid),
  ]
);

// 34. Coin Withdrawal Requests & Admin Banking Review
export const withdrawalRequests = pgTable(
  'withdrawal_requests',
  {
    id: serial('id').primaryKey(),
    requestId: text('request_id').notNull().unique(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    coinsAmount: bigint('coins_amount', { mode: 'number' }).notNull(),
    inrAmount: integer('inr_amount').notNull(),
    accountHolderName: text('account_holder_name').notNull(),
    payoutMethod: text('payout_method').notNull().default('upi'), // 'upi' | 'bank'
    upiOrBankDetails: text('upi_or_bank_details').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'completed' | 'rejected'
    reviewNote: text('review_note'),
    reviewedByUid: text('reviewed_by_uid'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [
    index('withdrawal_requests_user_idx').on(t.userUid),
    index('withdrawal_requests_status_idx').on(t.status),
  ]
);

// 35. Relationship Tags & Lv.1–Lv.10 Charm Progression (Bro, Sister, Soulmate, CP Partner, Confident)
export const relationshipTags = pgTable(
  'relationship_tags',
  {
    id: text('id').primaryKey(),
    userAUid: text('user_a_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    userBUid: text('user_b_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    tagType: text('tag_type').notNull(), // 'bro' | 'sister' | 'soulmate' | 'cp_partner' | 'confident'
    charmScore: bigint('charm_score', { mode: 'number' }).notNull().default(0),
    level: integer('level').notNull().default(1),
    status: text('status').notNull().default('active'), // 'pending' | 'active' | 'ended'
    requestedByUid: text('requested_by_uid').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('relationship_tags_a_idx').on(t.userAUid, t.status),
    index('relationship_tags_b_idx').on(t.userBUid, t.status),
  ]
);

