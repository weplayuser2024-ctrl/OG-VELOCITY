var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import "dotenv/config";
import crypto5 from "crypto";
import fs2 from "fs";
import http from "http";
import path2 from "path";
import { fileURLToPath } from "url";
import express from "express";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import QRCode3 from "qrcode";
import { and as and3, desc as desc3, eq as eq6, ilike as ilike3, inArray as inArray2, isNull as isNull2, lt, or as or4, sql as sql3 } from "drizzle-orm";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "analytical-helper-cc62s",
  appId: "1:186688392215:web:e255db148a9080dd69e052",
  apiKey: "AIzaSyAJF5rlVgtjpvJ_Tn_JXn2WwRFgyBXsYtU",
  authDomain: "analytical-helper-cc62s.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-zayro4kmultiplay-001113de-95af-4269-9f12-c4ac0de485e5",
  storageBucket: "analytical-helper-cc62s.firebasestorage.app",
  messagingSenderId: "186688392215",
  measurementId: "",
  oAuthClientId: "186688392215-li9kq6bs5ck1sc4p9ibkqhtjtjj9htjj.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  adminPermissionHistory: () => adminPermissionHistory,
  adminPermissionSets: () => adminPermissionSets,
  adminUserPermissions: () => adminUserPermissions,
  adminUsers: () => adminUsers,
  auditLogs: () => auditLogs,
  authIdentities: () => authIdentities,
  charmRecords: () => charmRecords,
  coinPackages: () => coinPackages,
  comments: () => comments,
  cpProposals: () => cpProposals,
  cpRelationships: () => cpRelationships,
  customGifts: () => customGifts,
  eventParticipants: () => eventParticipants,
  events: () => events,
  friends: () => friends,
  gameMatches: () => gameMatches,
  giftTransactions: () => giftTransactions,
  gifts: () => gifts,
  likes: () => likes,
  messages: () => messages,
  notifications: () => notifications,
  paymentOrders: () => paymentOrders,
  paymentQrVersions: () => paymentQrVersions,
  platformSettings: () => platformSettings,
  posts: () => posts,
  profiles: () => profiles,
  rankings: () => rankings,
  referrals: () => referrals,
  relationshipTags: () => relationshipTags,
  reports: () => reports,
  reservedPublicIds: () => reservedPublicIds,
  rolesPermissions: () => rolesPermissions,
  roomBackgrounds: () => roomBackgrounds,
  roomParticipants: () => roomParticipants,
  shopItems: () => shopItems,
  taskProgress: () => taskProgress,
  tasks: () => tasks,
  userBans: () => userBans,
  userInventory: () => userInventory,
  userSessions: () => userSessions,
  users: () => users,
  vipMemberships: () => vipMemberships,
  vipPackages: () => vipPackages,
  vipPointLedger: () => vipPointLedger,
  vipProgressionRules: () => vipProgressionRules,
  vipSubscriptionHistory: () => vipSubscriptionHistory,
  voiceRooms: () => voiceRooms,
  walletTransactions: () => walletTransactions,
  wallets: () => wallets,
  withdrawalRequests: () => withdrawalRequests
});
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
  index
} from "drizzle-orm/pg-core";
var users = pgTable(
  "users",
  {
    uid: text("uid").primaryKey(),
    // Firebase Auth UID
    publicId: text("public_id").notNull().unique(),
    // Immutable ZAY-XXXXXX
    email: text("email").unique(),
    phone: text("phone").unique(),
    primaryProvider: text("primary_provider").notNull().default("google"),
    // 'google' | 'phone' | 'facebook'
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    role: text("role").notNull().default("normal_user"),
    // 'normal_user' | 'support_staff' | 'moderator' | 'admin' | 'super_admin'
    accountStatus: text("account_status").notNull().default("active"),
    // 'active' | 'suspended' | 'banned'
    banReason: text("ban_reason"),
    referredByUid: text("referred_by_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    adminNotes: jsonb("admin_notes").$type().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("users_role_idx").on(t.role),
    index("users_status_idx").on(t.accountStatus),
    index("users_public_id_idx").on(t.publicId)
  ]
);
var authIdentities = pgTable(
  "auth_identities",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    // 'google.com' | 'phone' | 'facebook.com'
    providerSubject: text("provider_subject").notNull(),
    email: text("email"),
    phone: text("phone"),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("auth_identities_provider_subject_idx").on(t.provider, t.providerSubject),
    index("auth_identities_user_idx").on(t.userUid)
  ]
);
var reservedPublicIds = pgTable("reserved_public_ids", {
  publicId: text("public_id").primaryKey(),
  userUid: text("user_uid").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var userSessions = pgTable(
  "user_sessions",
  {
    sid: text("sid").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    identifier: text("identifier").notNull(),
    provider: text("provider").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull()
  },
  (t) => [index("user_sessions_uid_idx").on(t.userUid)]
);
var profiles = pgTable(
  "profiles",
  {
    userUid: text("user_uid").primaryKey().references(() => users.uid, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    handle: text("handle").notNull(),
    photoUrl: text("photo_url"),
    coverUrl: text("cover_url"),
    bio: text("bio").notNull().default(""),
    gender: text("gender").notNull().default("Male"),
    age: integer("age").notNull().default(21),
    country: text("country").notNull().default("India"),
    ornament: text("ornament").notNull().default("crown"),
    equippedFrameId: text("equipped_frame_id"),
    equippedRingId: text("equipped_ring_id"),
    equippedEntryId: text("equipped_entry_id"),
    tags: jsonb("tags").$type().notNull().default([]),
    cpPartnerUid: text("cp_partner_uid"),
    themeMode: text("theme_mode").notNull().default("dark"),
    equippedEmoteId: text("equipped_emote_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("profiles_display_name_idx").on(t.displayName),
    index("profiles_handle_idx").on(t.handle)
  ]
);
var wallets = pgTable("wallets", {
  userUid: text("user_uid").primaryKey().references(() => users.uid, { onDelete: "cascade" }),
  coins: bigint("coins", { mode: "number" }).notNull().default(0),
  totalPurchasedCoins: bigint("total_purchased_coins", { mode: "number" }).notNull().default(0),
  totalSpentCoins: bigint("total_spent_coins", { mode: "number" }).notNull().default(0),
  totalReceivedCoins: bigint("total_received_coins", { mode: "number" }).notNull().default(0),
  isFrozen: boolean("is_frozen").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: serial("id").primaryKey(),
    txId: text("tx_id").notNull().unique(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    type: text("type").notNull(),
    // 'topup_credit' | 'admin_credit' | 'admin_deduct' | 'transfer_out' | 'transfer_in' | 'gift_spend' | 'gift_receive' | 'shop_spend' | 'task_reward' | 'game_reward' | 'refund_reversal'
    amount: bigint("amount", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key").unique(),
    description: text("description").notNull(),
    actorUid: text("actor_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("wallet_tx_user_idx").on(t.userUid),
    index("wallet_tx_created_idx").on(t.createdAt)
  ]
);
var paymentOrders = pgTable(
  "payment_orders",
  {
    orderId: text("order_id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    orderType: text("order_type").notNull(),
    // 'vip' | 'coins'
    packageId: text("package_id").notNull(),
    packageName: text("package_name").notNull(),
    amountInr: integer("amount_inr").notNull(),
    coinsAmount: bigint("coins_amount", { mode: "number" }).notNull().default(0),
    grantedVipLevel: integer("granted_vip_level").notNull().default(0),
    vipDurationDays: integer("vip_duration_days").notNull().default(0),
    bonusGrowth: integer("bonus_growth").notNull().default(0),
    upiIdUsed: text("upi_id_used").notNull().default(""),
    qrVersionId: integer("qr_version_id"),
    accountNameUsed: text("account_name_used"),
    providerUsed: text("provider_used"),
    qrDataUrlSnapshot: text("qr_data_url_snapshot"),
    utrNumber: text("utr_number").unique(),
    accountHolderName: text("account_holder_name"),
    paymentDateTime: text("payment_date_time"),
    screenshotDataUrl: text("screenshot_data_url"),
    payerNote: text("payer_note"),
    status: text("status").notNull().default("awaiting_payment"),
    // 'awaiting_payment' | 'pending_review' | 'approved' | 'rejected' | 'cancelled'
    reviewedByUid: text("reviewed_by_uid"),
    reviewNote: text("review_note"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
  },
  (t) => [
    index("payment_orders_user_idx").on(t.userUid),
    index("payment_orders_status_idx").on(t.status),
    index("payment_orders_user_status_created_idx").on(t.userUid, t.status, t.createdAt)
  ]
);
var paymentQrVersions = pgTable(
  "payment_qr_versions",
  {
    id: serial("id").primaryKey(),
    versionNumber: integer("version_number").notNull(),
    accountName: text("account_name").notNull(),
    upiId: text("upi_id").notNull(),
    provider: text("provider").notNull(),
    customQrDataUrl: text("custom_qr_data_url"),
    qrPreviewDataUrl: text("qr_preview_data_url"),
    note: text("note").notNull().default(""),
    active: boolean("active").notNull().default(true),
    screens: jsonb("screens").$type().notNull().default(["coins", "vip"]),
    updatedByUid: text("updated_by_uid"),
    updatedByName: text("updated_by_name"),
    changeSummary: text("change_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("payment_qr_versions_created_idx").on(t.createdAt)]
);
var vipPackages = pgTable("vip_packages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  priceInr: integer("price_inr").notNull(),
  durationDays: integer("duration_days").notNull(),
  grantedVipLevel: integer("granted_vip_level").notNull(),
  bonusGrowth: integer("bonus_growth").notNull(),
  perks: jsonb("perks").$type().notNull().default([]),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var coinPackages = pgTable("coin_packages", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  coins: bigint("coins", { mode: "number" }).notNull(),
  bonusCoins: bigint("bonus_coins", { mode: "number" }).notNull().default(0),
  priceInr: integer("price_inr").notNull(),
  highlight: text("highlight"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var vipMemberships = pgTable("vip_memberships", {
  userUid: text("user_uid").primaryKey().references(() => users.uid, { onDelete: "cascade" }),
  vipLevel: integer("vip_level").notNull().default(0),
  // 0..18
  vipStatus: text("vip_status").notNull().default("inactive"),
  // 'inactive' | 'active' | 'expired'
  vipGrowth: integer("vip_growth").notNull().default(0),
  activatedByOrderId: text("activated_by_order_id"),
  activatedByAdminUid: text("activated_by_admin_uid"),
  planLabel: text("plan_label"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastDecayDateKey: text("last_decay_date_key"),
  lastDecayAt: timestamp("last_decay_at", { withTimezone: true }),
  graceDaysApplied: integer("grace_days_applied").notNull().default(15),
  customBenefits: jsonb("custom_benefits").$type().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var vipSubscriptionHistory = pgTable(
  "vip_subscription_history",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    action: text("action").notNull(),
    // 'activate' | 'renew' | 'admin_grant' | 'super_admin_override'
    source: text("source").notNull(),
    // 'payment_order' | 'admin_grant' | 'super_admin_override'
    orderId: text("order_id"),
    packageId: text("package_id"),
    packageName: text("package_name"),
    months: integer("months").notNull().default(0),
    durationDays: integer("duration_days").notNull().default(0),
    startingVipLevel: integer("starting_vip_level").notNull().default(1),
    resultingVipLevel: integer("resulting_vip_level").notNull().default(1),
    previousExpiresAt: timestamp("previous_expires_at", { withTimezone: true }),
    newExpiresAt: timestamp("new_expires_at", { withTimezone: true }),
    actorUid: text("actor_uid"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("vip_sub_history_user_idx").on(t.userUid),
    index("vip_sub_history_created_idx").on(t.createdAt)
  ]
);
var vipPointLedger = pgTable(
  "vip_point_ledger",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    vipLevelAfter: integer("vip_level_after").notNull(),
    source: text("source").notNull(),
    // 'gift_spend' | 'decay' | 'migration' | 'super_admin_override'
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key").unique(),
    description: text("description").notNull(),
    actorUid: text("actor_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("vip_point_ledger_user_idx").on(t.userUid),
    index("vip_point_ledger_source_idx").on(t.source)
  ]
);
var vipProgressionRules = pgTable("vip_progression_rules", {
  level: integer("level").primaryKey(),
  title: text("title").notNull(),
  requiredPoints: integer("required_points").notNull(),
  stepPoints: integer("step_points").notNull(),
  badgeColor: text("badge_color").notNull(),
  benefits: jsonb("benefits").$type().notNull().default([])
});
var gifts = pgTable("gifts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cost: integer("cost").notNull(),
  charmValue: integer("charm_value").notNull(),
  randomCoinsMin: integer("random_coins_min").notNull().default(0),
  randomCoinsMax: integer("random_coins_max").notNull().default(0),
  rarity: text("rarity").notNull().default("Standard"),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  description: text("description").notNull(),
  particleStyle: text("particle_style").notNull(),
  giftNumber: integer("gift_number").notNull().default(1),
  artworkUrl: text("artwork_url"),
  animationUrl: text("animation_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var customGifts = pgTable(
  "custom_gifts",
  {
    id: text("id").primaryKey(),
    creatorUid: text("creator_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cost: integer("cost").notNull(),
    charmValue: integer("charm_value").notNull(),
    rarity: text("rarity").notNull().default("Signature"),
    description: text("description").notNull(),
    primaryColor: text("primary_color").notNull().default("#A855F7"),
    secondaryColor: text("secondary_color").notNull().default("#38BDF8"),
    particleStyle: text("particle_style").notNull().default("crown"),
    artworkUrl: text("artwork_url"),
    animationVideoUrl: text("animation_video_url"),
    videoFileName: text("video_file_name"),
    status: text("status").notNull().default("pending"),
    // 'pending' | 'approved' | 'rejected'
    approvedGiftId: text("approved_gift_id"),
    reviewedByUid: text("reviewed_by_uid"),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("custom_gifts_status_idx").on(t.status),
    index("custom_gifts_creator_idx").on(t.creatorUid)
  ]
);
var giftTransactions = pgTable(
  "gift_transactions",
  {
    id: serial("id").primaryKey(),
    txId: text("tx_id").notNull().unique(),
    senderUid: text("sender_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    recipientUid: text("recipient_uid").notNull(),
    roomId: text("room_id"),
    giftId: text("gift_id").notNull(),
    giftName: text("gift_name").notNull(),
    quantity: integer("quantity").notNull(),
    coinsSpent: bigint("coins_spent", { mode: "number" }).notNull(),
    coinsCreditedToRecipient: bigint("coins_credited_to_recipient", { mode: "number" }).notNull(),
    charmAwarded: bigint("charm_awarded", { mode: "number" }).notNull(),
    vipGrowthAwarded: integer("vip_growth_awarded").notNull().default(0),
    customMessage: text("custom_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("gift_tx_sender_idx").on(t.senderUid),
    index("gift_tx_recipient_idx").on(t.recipientUid)
  ]
);
var voiceRooms = pgTable(
  "voice_rooms",
  {
    id: text("id").primaryKey(),
    roomCode: text("room_code").notNull().unique(),
    title: text("title").notNull(),
    topic: text("topic").notNull().default(""),
    category: text("category").notNull().default("Popular"),
    ownerUid: text("owner_uid").notNull(),
    hostName: text("host_name").notNull(),
    seatCapacity: integer("seat_capacity").notNull().default(15),
    activeSpeakerSlots: integer("active_speaker_slots").notNull().default(12),
    isOfficial: boolean("is_official").notNull().default(false),
    isLocked: boolean("is_locked").notNull().default(false),
    passcodeHash: text("passcode_hash"),
    bgThemeId: text("bg_theme_id"),
    bgUrl: text("bg_url"),
    dpUrl: text("dp_url"),
    roomLevel: integer("room_level").notNull().default(1),
    roomXp: integer("room_xp").notNull().default(0),
    ambiance: text("ambiance").notNull().default("indigo"),
    adminUids: jsonb("admin_uids").$type().notNull().default([]),
    lockedSeats: jsonb("locked_seats").$type().notNull().default([]),
    roomSettings: jsonb("room_settings").$type().notNull().default({}),
    status: text("status").notNull().default("active"),
    // 'active' | 'closed'
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedReason: text("closed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("voice_rooms_status_idx").on(t.status)]
);
var roomParticipants = pgTable(
  "room_participants",
  {
    id: serial("id").primaryKey(),
    roomId: text("room_id").notNull().references(() => voiceRooms.id, { onDelete: "cascade" }),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    seatIndex: integer("seat_index"),
    // null = listener; 0 = owner fixed
    role: text("role").notNull().default("listener"),
    // 'owner' | 'admin' | 'moderator' | 'speaker' | 'listener'
    isMuted: boolean("is_muted").notNull().default(false),
    isSpeaking: boolean("is_speaking").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("room_participants_unique_idx").on(t.roomId, t.userUid),
    index("room_participants_room_idx").on(t.roomId)
  ]
);
var messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    scope: text("scope").notNull(),
    // 'dm' | 'room'
    threadId: text("thread_id").notNull(),
    senderUid: text("sender_uid").notNull(),
    recipientUid: text("recipient_uid"),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    kind: text("kind").notNull().default("chat"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("messages_thread_idx").on(t.threadId, t.createdAt),
    index("messages_recipient_idx").on(t.recipientUid, t.readAt),
    index("messages_scope_users_idx").on(t.scope, t.senderUid, t.recipientUid, t.createdAt)
  ]
);
var friends = pgTable(
  "friends",
  {
    id: serial("id").primaryKey(),
    requesterUid: text("requester_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    addresseeUid: text("addressee_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    // 'pending' | 'accepted' | 'rejected' | 'blocked'
    bondTag: text("bond_tag"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("friends_pair_unique_idx").on(t.requesterUid, t.addresseeUid),
    index("friends_addressee_idx").on(t.addresseeUid),
    index("friends_requester_status_idx").on(t.requesterUid, t.status),
    index("friends_addressee_status_idx").on(t.addresseeUid, t.status)
  ]
);
var posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorUid: text("author_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    mediaType: text("media_type").notNull().default("photo"),
    // 'photo' | 'video' | 'text'
    mediaUrl: text("media_url"),
    caption: text("caption").notNull(),
    likesCount: integer("likes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    sharesCount: integer("shares_count").notNull().default(0),
    status: text("status").notNull().default("active"),
    // 'active' | 'hidden' | 'removed'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("posts_author_idx").on(t.authorUid), index("posts_created_idx").on(t.createdAt)]
);
var comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    authorUid: text("author_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("comments_post_idx").on(t.postId)]
);
var likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("likes_post_user_unique_idx").on(t.postId, t.userUid)]
);
var charmRecords = pgTable(
  "charm_records",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    delta: bigint("delta", { mode: "number" }).notNull(),
    totalAfter: bigint("total_after", { mode: "number" }).notNull(),
    source: text("source").notNull(),
    // 'gift_received' | 'admin_adjust' | 'event_bonus'
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("charm_records_user_idx").on(t.userUid)]
);
var rankings = pgTable(
  "rankings",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    // 'overall' | 'weekly-YYYY-Www' | 'monthly-YYYY-MM'
    charmScore: bigint("charm_score", { mode: "number" }).notNull().default(0),
    giftsSentScore: bigint("gifts_sent_score", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("rankings_user_period_unique_idx").on(t.userUid, t.periodKey),
    index("rankings_period_charm_idx").on(t.periodKey, t.charmScore)
  ]
);
var tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  category: text("category").notNull().default("daily"),
  // 'daily' | 'weekly' | 'event'
  actionType: text("action_type").notNull(),
  // 'checkin' | 'voice_time' | 'send_gift' | 'post_moment' | 'play_game' | 'add_friend'
  targetCount: integer("target_count").notNull().default(1),
  rewardCoins: integer("reward_coins").notNull().default(100),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var taskProgress = pgTable(
  "task_progress",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    cycleKey: text("cycle_key").notNull(),
    progress: integer("progress").notNull().default(0),
    claimed: boolean("claimed").notNull().default(false),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
  },
  (t) => [uniqueIndex("task_progress_unique_idx").on(t.userUid, t.taskId, t.cycleKey)]
);
var events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),
  bannerUrl: text("banner_url"),
  eventType: text("event_type").notNull().default("tournament"),
  rewardCoins: integer("reward_coins").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("live"),
  // 'draft' | 'upcoming' | 'live' | 'ended'
  createdByUid: text("created_by_uid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var eventParticipants = pgTable(
  "event_participants",
  {
    id: serial("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("event_participants_unique_idx").on(t.eventId, t.userUid)]
);
var rolesPermissions = pgTable("roles_permissions", {
  role: text("role").primaryKey(),
  // 'super_admin' | 'admin' | 'moderator' | 'support_staff'
  label: text("label").notNull(),
  permissions: jsonb("permissions").$type().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var adminUsers = pgTable("admin_users", {
  userUid: text("user_uid").primaryKey().references(() => users.uid, { onDelete: "cascade" }),
  role: text("role").notNull().references(() => rolesPermissions.role),
  assignedByUid: text("assigned_by_uid"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var adminPermissionSets = pgTable("admin_permission_sets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  permissions: jsonb("permissions").$type().notNull().default([]),
  createdByUid: text("created_by_uid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var adminUserPermissions = pgTable("admin_user_permissions", {
  userUid: text("user_uid").primaryKey().references(() => users.uid, { onDelete: "cascade" }),
  customPermissions: jsonb("custom_permissions").$type().notNull().default([]),
  permissionSetId: text("permission_set_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  grantedByUid: text("granted_by_uid"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var adminPermissionHistory = pgTable(
  "admin_permission_history",
  {
    id: serial("id").primaryKey(),
    targetUid: text("target_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    actorUid: text("actor_uid").notNull(),
    action: text("action").notNull(),
    previousPermissions: jsonb("previous_permissions").$type().notNull().default([]),
    nextPermissions: jsonb("next_permissions").$type().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("admin_perm_history_target_idx").on(t.targetUid),
    index("admin_perm_history_created_idx").on(t.createdAt)
  ]
);
var reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterUid: text("reporter_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    // 'user' | 'room' | 'post' | 'message'
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    // 'open' | 'resolved' | 'dismissed'
    resolvedByUid: text("resolved_by_uid"),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (t) => [index("reports_status_idx").on(t.status)]
);
var notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid"),
    // null = global announcement broadcast
    type: text("type").notNull().default("system"),
    // 'system' | 'payment' | 'vip' | 'gift' | 'friend' | 'event' | 'announcement'
    title: text("title").notNull(),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    metadata: jsonb("metadata").$type(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("notifications_user_idx").on(t.userUid, t.read)]
);
var auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUid: text("actor_uid").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    details: jsonb("details").$type(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorUid),
    index("audit_logs_created_idx").on(t.createdAt)
  ]
);
var platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type().notNull(),
  updatedByUid: text("updated_by_uid"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var roomBackgrounds = pgTable("room_backgrounds", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  gradient: text("gradient").notNull(),
  imageUrl: text("image_url"),
  accent: text("accent").notNull(),
  ambiance: text("ambiance").notNull().default("indigo"),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var userInventory = pgTable(
  "user_inventory",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    category: text("category").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
  },
  (t) => [uniqueIndex("user_inventory_unique_idx").on(t.userUid, t.itemId)]
);
var gameMatches = pgTable(
  "game_matches",
  {
    id: text("id").primaryKey(),
    gameType: text("game_type").notNull(),
    // 'carrom' | 'uno' | 'laser_tag'
    hostUid: text("host_uid").notNull(),
    status: text("status").notNull().default("lobby"),
    // 'lobby' | 'playing' | 'finished'
    winnerUid: text("winner_uid"),
    players: jsonb("players").$type().notNull().default([]),
    stateJson: jsonb("state_json").$type(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (t) => [index("game_matches_status_idx").on(t.status)]
);
var cpProposals = pgTable(
  "cp_proposals",
  {
    id: text("id").primaryKey(),
    fromUid: text("from_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    toUid: text("to_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    ringNumber: integer("ring_number").notNull().default(1),
    ringName: text("ring_name").notNull().default("Couple Bond Ring"),
    status: text("status").notNull().default("pending"),
    // 'pending' | 'accepted' | 'rejected' | 'cancelled'
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("cp_proposals_from_idx").on(t.fromUid, t.status),
    index("cp_proposals_to_idx").on(t.toUid, t.status)
  ]
);
var cpRelationships = pgTable(
  "cp_relationships",
  {
    id: text("id").primaryKey(),
    userAUid: text("user_a_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    userBUid: text("user_b_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    proposalId: text("proposal_id"),
    ringNumber: integer("ring_number").notNull().default(1),
    ringName: text("ring_name").notNull().default("Couple Bond Ring"),
    cpCharm: integer("cp_charm").notNull().default(0),
    status: text("status").notNull().default("active"),
    // 'active' | 'ended'
    endedByUid: text("ended_by_uid"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true })
  },
  (t) => [
    index("cp_rel_a_status_idx").on(t.userAUid, t.status),
    index("cp_rel_b_status_idx").on(t.userBUid, t.status)
  ]
);
var shopItems = pgTable(
  "shop_items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    // 'ring' | 'frame' | 'bubble' | 'entry' | 'seat-fx' | 'room-theme'
    description: text("description").notNull().default(""),
    priceCoins: bigint("price_coins", { mode: "number" }).notNull().default(1e5),
    durationDays: integer("duration_days"),
    // null = permanent
    imageUrl: text("image_url"),
    previewColor: text("preview_color").notNull().default("#38BDF8"),
    ringNumber: integer("ring_number"),
    seatFrameNumber: integer("seat_frame_number"),
    styleVariant: text("style_variant"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("shop_items_category_idx").on(t.category),
    index("shop_items_active_idx").on(t.active)
  ]
);
var userBans = pgTable(
  "user_bans",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    banType: text("ban_type").notNull(),
    // 'complete' | 'mic' | 'seat' | 'chat'
    durationDays: integer("duration_days"),
    // null = permanent
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // null = permanent
    reason: text("reason").notNull().default("Policy violation"),
    bannedByUid: text("banned_by_uid").notNull(),
    active: boolean("active").notNull().default(true),
    revokedByUid: text("revoked_by_uid"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("user_bans_uid_active_idx").on(t.userUid, t.active),
    index("user_bans_type_idx").on(t.banType)
  ]
);
var referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    inviterUid: text("inviter_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    invitedUid: text("invited_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    inviteCode: text("invite_code").notNull(),
    rewardCoins: integer("reward_coins").notNull().default(25e3),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("referrals_invited_unique_idx").on(t.invitedUid),
    index("referrals_inviter_idx").on(t.inviterUid)
  ]
);
var withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: serial("id").primaryKey(),
    requestId: text("request_id").notNull().unique(),
    userUid: text("user_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    coinsAmount: bigint("coins_amount", { mode: "number" }).notNull(),
    inrAmount: integer("inr_amount").notNull(),
    accountHolderName: text("account_holder_name").notNull(),
    payoutMethod: text("payout_method").notNull().default("upi"),
    // 'upi' | 'bank'
    upiOrBankDetails: text("upi_or_bank_details").notNull(),
    status: text("status").notNull().default("pending"),
    // 'pending' | 'approved' | 'completed' | 'rejected'
    reviewNote: text("review_note"),
    reviewedByUid: text("reviewed_by_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
  },
  (t) => [
    index("withdrawal_requests_user_idx").on(t.userUid),
    index("withdrawal_requests_status_idx").on(t.status)
  ]
);
var relationshipTags = pgTable(
  "relationship_tags",
  {
    id: text("id").primaryKey(),
    userAUid: text("user_a_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    userBUid: text("user_b_uid").notNull().references(() => users.uid, { onDelete: "cascade" }),
    tagType: text("tag_type").notNull(),
    // 'bro' | 'sister' | 'soulmate' | 'cp_partner' | 'confident'
    charmScore: bigint("charm_score", { mode: "number" }).notNull().default(0),
    level: integer("level").notNull().default(1),
    status: text("status").notNull().default("active"),
    // 'pending' | 'active' | 'ended'
    requestedByUid: text("requested_by_uid").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("relationship_tags_a_idx").on(t.userAUid, t.status),
    index("relationship_tags_b_idx").on(t.userBUid, t.status)
  ]
);

// src/db/index.ts
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 15,
      connectionTimeoutMillis: 15e3
    });
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/repository.ts
import crypto from "crypto";
import QRCode from "qrcode";
import {
  and,
  desc,
  asc,
  eq as eq2,
  gt,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql
} from "drizzle-orm";
import { Pool as Pool2 } from "pg";

// src/db/seed.ts
import { eq } from "drizzle-orm";
var DEFAULT_VIP_DECAY_CONFIG = {
  enabled: true,
  graceDays: 15,
  mode: "fixed",
  dailyAmount: 50,
  dailyPercent: 5
};
var PERMANENT_UPI_CONFIG = {
  accountName: "Imamuddin",
  upiId: "9871913389@yespop",
  provider: "YesPop",
  customQrDataUrl: null,
  active: true,
  screens: ["coins", "vip"],
  currentVersionId: 1,
  note: "Scan & Pay via any UPI app (PhonePe, GPay, Paytm, BHIM), then submit your 12-digit UTR & screenshot for verification."
};
var DEFAULT_APP_CONFIG = {
  appName: "OG VELOCITY",
  tagline: "4K Multiplayer Voice Squads, Social Rooms & Arcade",
  maintenanceMode: false,
  maintenanceMessage: "OG VELOCITY is undergoing scheduled maintenance. Please check back shortly.",
  features: {
    voiceRooms: true,
    games: true,
    moments: true,
    shop: true,
    cpProposals: true
  },
  voiceRoomLimits: {
    maxRoomsPerUser: 1,
    maxRoomLevel: 20,
    allowedCapacities: [10, 15, 19],
    defaultCapacity: 15
  },
  charmRankingConfig: {
    weeklyEnabled: true,
    monthlyEnabled: true,
    overallEnabled: true,
    topLimit: 50
  },
  homeBanner: {
    headline: "Live Voice Rooms & Multiplayer Arena",
    subheadline: "Real players, live WebRTC voice stages, and verified community rankings."
  },
  profileDefaults: {
    defaultCountry: "India",
    defaultBio: ""
  },
  supportInfo: {
    supportEmail: "support@ogvelocity.xyz",
    supportNote: "Report issues or submit payment inquiries through official in-app support."
  }
};
var VIP_PROGRESSION_SEED = [
  { level: 1, title: "Initiate VIP", requiredPoints: 0, stepPoints: 0, badgeColor: "#38BDF8", benefits: ["Active VIP 1 Crest", "VIP Room Entry Tag"] },
  { level: 2, title: "Azure Guard", requiredPoints: 5e3, stepPoints: 5e3, badgeColor: "#60A5FA", benefits: ["5,000 VIP Points", "Azure Chat Accent"] },
  { level: 3, title: "Emerald Noble", requiredPoints: 14e3, stepPoints: 9e3, badgeColor: "#34D399", benefits: ["14,000 VIP Points", "Emerald Aura Frame"] },
  { level: 4, title: "Amethyst Baron", requiredPoints: 3e4, stepPoints: 16e3, badgeColor: "#A78BFA", benefits: ["30,000 VIP Points", "Amethyst Entrance Ribbon"] },
  { level: 5, title: "Crimson Knight", requiredPoints: 7e4, stepPoints: 4e4, badgeColor: "#FB7185", benefits: ["70,000 VIP Points", "Crimson Mic Halo"] },
  { level: 6, title: "Solar Viscount", requiredPoints: 13e4, stepPoints: 6e4, badgeColor: "#FBBF24", benefits: ["130,000 VIP Points", "VIP 6 Priority Seat Entry", "Golden Profile Showcase"] },
  { level: 7, title: "Solaris Earl", requiredPoints: 22e4, stepPoints: 9e4, badgeColor: "#F59E0B", benefits: ["220,000 VIP Points", "VIP 7 Animated Crest", "Custom Name Glow"] },
  { level: 8, title: "Celestial Marquis", requiredPoints: 34e4, stepPoints: 12e4, badgeColor: "#22D3EE", benefits: ["340,000 VIP Points", "VIP 8 Entrance Banner", "Room XP Boost 1.5x"] },
  { level: 9, title: "Starlight Duke", requiredPoints: 49e4, stepPoints: 15e4, badgeColor: "#818CF8", benefits: ["490,000 VIP Points", "VIP 9 Starlight Frame", "Private Lounge Flair"] },
  { level: 10, title: "Imperial Crown", requiredPoints: 68e4, stepPoints: 19e4, badgeColor: "#F43F5E", benefits: ["680,000 VIP Points", "VIP 10 Crown Seal", "Imperial Seat Highlight"] },
  { level: 11, title: "Aether Archduke", requiredPoints: 92e4, stepPoints: 24e4, badgeColor: "#C084FC", benefits: ["920,000 VIP Points", "VIP 11 Dual-Glow Name", "VIP 11 Priority Desk"] },
  { level: 12, title: "Eclipse Monarch", requiredPoints: 122e4, stepPoints: 3e5, badgeColor: "#FDE047", benefits: ["1,220,000 VIP Points", "VIP 12 Dual-Color Nameplate", "Eclipse Entry Spark"] },
  { level: 13, title: "Astral Emperor", requiredPoints: 158e4, stepPoints: 36e4, badgeColor: "#38BDF8", benefits: ["1,580,000 VIP Points", "VIP 13 Astral Crest", "Extended Emote Deck"] },
  { level: 14, title: "Mythic Overlord", requiredPoints: 2e6, stepPoints: 42e4, badgeColor: "#FB923C", benefits: ["2,000,000 VIP Points", "VIP 14 Mythic Halo", "Pre-Sovereign Aura"] },
  { level: 15, title: "Sovereign Apex", requiredPoints: 25e5, stepPoints: 5e5, badgeColor: "#FACC15", benefits: ["2,500,000 VIP Points", "VIP 15 Full-Screen Entrance", "Sovereign Room Crest"] },
  { level: 16, title: "Celestial Sovereign", requiredPoints: 31e5, stepPoints: 6e5, badgeColor: "#A855F7", benefits: ["3,100,000 VIP Points", "VIP 16 Celestial Wings", "Prismatic Name Aura"] },
  { level: 17, title: "Eternal Emperor", requiredPoints: 38e5, stepPoints: 7e5, badgeColor: "#EC4899", benefits: ["3,800,000 VIP Points", "VIP 17 Eternal Seal", "Royal Entrance Fanfare"] },
  { level: 18, title: "Cosmic Legend", requiredPoints: 46e5, stepPoints: 8e5, badgeColor: "#22D3EE", benefits: ["4,600,000 VIP Points", "Max VIP 18 Cosmic Legend Crown", "All Exclusive Perks"] }
];
var DEFAULT_SHOP_ITEMS_SEED = [
  { id: "ring-1", name: "Imperial Ruby Crest Ring", category: "ring", priceCoins: 1e6, previewColor: "#F59E0B", description: "24K gold sovereign band crowned with a fiery ruby.", ringNumber: 1, sortOrder: 1 },
  { id: "ring-2", name: "Astral Cryo Sapphire Ring", category: "ring", priceCoins: 2e6, previewColor: "#38BDF8", description: "Frost-forged platinum spiral holding an ocean sapphire.", ringNumber: 2, sortOrder: 2 },
  { id: "ring-3", name: "Rose Ember Filigree Ring", category: "ring", priceCoins: 3e6, previewColor: "#FB7185", description: "Sculpted rose-gold petals encircling a radiant pink diamond.", ringNumber: 3, sortOrder: 3 },
  { id: "ring-4", name: "Seraphim Wing Halo Ring", category: "ring", priceCoins: 4e6, previewColor: "#E2E8F0", description: "Twin silver angel wings cradling a celestial star gem.", ringNumber: 4, sortOrder: 4 },
  { id: "ring-5", name: "Flame Trident Monarch Ring", category: "ring", priceCoins: 5e6, previewColor: "#F97316", description: "Blazing amber-gold crest forged for CP champions.", ringNumber: 5, sortOrder: 5 },
  { id: "ring-6", name: "Amethyst Violet Signet Ring", category: "ring", priceCoins: 6e6, previewColor: "#A855F7", description: "Royal filigree band set with a deep prism amethyst.", ringNumber: 6, sortOrder: 6 },
  { id: "ring-7", name: "Solar Sunburst Halo Ring", category: "ring", priceCoins: 7e6, previewColor: "#FBBF24", description: "Sun-flare gold spokes framing a luminous opal core.", ringNumber: 7, sortOrder: 7 },
  { id: "ring-8", name: "Glacier Teardrop Ring", category: "ring", priceCoins: 8e6, previewColor: "#60A5FA", description: "Refined silver vinework locked with an aquamarine gem.", ringNumber: 8, sortOrder: 8 },
  { id: "ring-9", name: "Celestial Compass Ring", category: "ring", priceCoins: 9e6, previewColor: "#FDE68A", description: "Dual-tone navigator jewel engraved with star runes.", ringNumber: 9, sortOrder: 9 },
  { id: "ring-10", name: "Emerald Dragon Claw Ring", category: "ring", priceCoins: 1e7, previewColor: "#10B981", description: "Golden wyrm talons clutching an imperial emerald.", ringNumber: 10, sortOrder: 10 },
  { id: "ring-11", name: "Prism Aurora Diamond Ring", category: "ring", priceCoins: 11e6, previewColor: "#67E8F9", description: "Rainbow-faceted diamond heart glowing in starlight.", ringNumber: 11, sortOrder: 11 },
  { id: "ring-12", name: "Void Singularity Ring", category: "ring", priceCoins: 12e6, previewColor: "#818CF8", description: "Obsidian-violet astral coils orbiting a cosmic pearl.", ringNumber: 12, sortOrder: 12 },
  { id: "ring-13", name: "Sakura Blossom Crown Ring", category: "ring", priceCoins: 13e6, previewColor: "#F472B6", description: "Enamel cherry-blossom bouquet blooming in 3D gold.", ringNumber: 13, sortOrder: 13 },
  { id: "ring-14", name: "Clockwork Magenta Ruby Ring", category: "ring", priceCoins: 14e6, previewColor: "#FB923C", description: "Precision-cut gear halo centered on a royal magenta stone.", ringNumber: 14, sortOrder: 14 },
  { id: "ring-15", name: "Arctic Rune Titanium Ring", category: "ring", priceCoins: 15e6, previewColor: "#38BDF8", description: "Engraved glacial runes crowned by a midnight cabochon.", ringNumber: 15, sortOrder: 15 },
  { id: "ring-16", name: "Phoenix Feather Ruby Ring", category: "ring", priceCoins: 16e6, previewColor: "#EF4444", description: "Sculpted crimson plumes rising from molten gold.", ringNumber: 16, sortOrder: 16 },
  { id: "ring-17", name: "Starlight Lotus Halo Ring", category: "ring", priceCoins: 17e6, previewColor: "#2DD4BF", description: "Delicate jade lotus petals cradling a star-cut crystal.", ringNumber: 17, sortOrder: 17 },
  { id: "ring-18", name: "Royal Lion Sovereign Ring", category: "ring", priceCoins: 18e6, previewColor: "#F59E0B", description: "Crowned heraldic crest inlaid with golden diamonds.", ringNumber: 18, sortOrder: 18 },
  { id: "ring-19", name: "Eternal Twin Heart Ring", category: "ring", priceCoins: 19e6, previewColor: "#EC4899", description: "Interlocking rose-quartz hearts bound by white gold.", ringNumber: 19, sortOrder: 19 },
  { id: "ring-20", name: "OG VELOCITY Mythic Crown Ring", category: "ring", priceCoins: 2e7, previewColor: "#FDE047", description: "The ultimate 20M Sovereign Ring for eternal CP royalty.", ringNumber: 20, sortOrder: 20 },
  { id: "frame-1", name: "Royal Sapphire Crown Frame", category: "frame", priceCoins: 2e5, previewColor: "#38BDF8", description: "Blue-winged sovereign crown framing your mic seat & DP.", seatFrameNumber: 1, durationDays: 3, sortOrder: 21 },
  { id: "frame-2", name: "Diamond Ice Crystal Frame", category: "frame", priceCoins: 3e5, previewColor: "#67E8F9", description: "Glacial crystalline frost halo crowned with an ice diamond.", seatFrameNumber: 2, durationDays: 3, sortOrder: 22 },
  { id: "frame-3", name: "Crimson Rose Wreath Frame", category: "frame", priceCoins: 4e5, previewColor: "#EF4444", description: "Velvet red roses twined around a golden royal wreath.", seatFrameNumber: 3, durationDays: 3, sortOrder: 23 },
  { id: "frame-4", name: "Winged Star Crest Frame", category: "frame", priceCoins: 5e5, previewColor: "#FBBF24", description: "Golden laurel & azure wings topped with a champion star.", seatFrameNumber: 4, durationDays: 3, sortOrder: 24 },
  { id: "frame-5", name: "Amethyst Dragon Coil Frame", category: "frame", priceCoins: 6e5, previewColor: "#A855F7", description: "Fierce neon-purple cyber dragon coiling around your seat.", seatFrameNumber: 5, durationDays: 3, sortOrder: 25 },
  { id: "frame-6", name: "Sakura Neko Ears Frame", category: "frame", priceCoins: 7e5, previewColor: "#F472B6", description: "Playful glowing pink cat ears and paw gems.", seatFrameNumber: 6, durationDays: 3, sortOrder: 26 },
  { id: "frame-7", name: "Solar Flame Dragon Frame", category: "frame", priceCoins: 8e5, previewColor: "#F97316", description: "Blazing golden-crimson fire dragon circling your portrait.", seatFrameNumber: 7, durationDays: 3, sortOrder: 27 },
  { id: "frame-8", name: "Azure Morpho Garden Frame", category: "frame", priceCoins: 9e5, previewColor: "#3B82F6", description: "Luminous blue butterflies & sakura blossoms on your mic.", seatFrameNumber: 8, durationDays: 3, sortOrder: 28 },
  { id: "frame-9", name: "Seraphic Halo Wings Frame", category: "frame", priceCoins: 1e6, previewColor: "#FDE68A", description: "White angel wings and golden star halo.", seatFrameNumber: 9, durationDays: 3, sortOrder: 29 },
  { id: "frame-10", name: "Obsidian Ruby Crown Frame", category: "frame", priceCoins: 11e5, previewColor: "#DC2626", description: "Gothic silver-steel crown encrusted with dark rubies.", seatFrameNumber: 10, durationDays: 3, sortOrder: 30 },
  { id: "frame-11", name: "Bamboo Panda Guardian Frame", category: "frame", priceCoins: 12e5, previewColor: "#4ADE80", description: "Adorable bamboo panda hugging your voice seat.", seatFrameNumber: 11, durationDays: 3, sortOrder: 31 },
  { id: "frame-12", name: "Valkyrie Wing Crest Frame", category: "frame", priceCoins: 13e5, previewColor: "#9333EA", description: "Crystal violet valkyrie wings with silver chains.", seatFrameNumber: 12, durationDays: 3, sortOrder: 32 },
  { id: "frame-13", name: "Sovereign Golden Stars Frame", category: "frame", priceCoins: 14e5, previewColor: "#F59E0B", description: "Radiant constellation of 24K golden stars.", seatFrameNumber: 13, durationDays: 3, sortOrder: 33 },
  { id: "frame-14", name: "Tidal Dolphin Wave Frame", category: "frame", priceCoins: 15e5, previewColor: "#0EA5E9", description: "Ocean crest wave with a leaping luminous dolphin.", seatFrameNumber: 14, durationDays: 3, sortOrder: 34 },
  { id: "frame-15", name: "Blossom Sakura Ring Frame", category: "frame", priceCoins: 16e5, previewColor: "#EC4899", description: "Full ring of radiant spring sakura petals.", seatFrameNumber: 15, durationDays: 3, sortOrder: 35 },
  { id: "frame-16", name: "Neon DJ Beats Frame", category: "frame", priceCoins: 17e5, previewColor: "#38BDF8", description: "Glowing cyber headphones & music equalizer waves.", seatFrameNumber: 16, durationDays: 3, sortOrder: 36 },
  { id: "frame-17", name: "Kitsune Blossom Mask Frame", category: "frame", priceCoins: 18e5, previewColor: "#F43F5E", description: "Mystic scarlet kitsune spirit mask & camellia flowers.", seatFrameNumber: 17, durationDays: 3, sortOrder: 37 },
  { id: "frame-18", name: "Imperial Lion Laurel Frame", category: "frame", priceCoins: 19e5, previewColor: "#D97706", description: "Crowned golden lion crest wreathed in victory laurels.", seatFrameNumber: 18, durationDays: 3, sortOrder: 38 },
  { id: "frame-19", name: "Pink Ribbon Heart Frame", category: "frame", priceCoins: 195e4, previewColor: "#F472B6", description: "Floating heart-shaped pink aura tied with a satin bow.", seatFrameNumber: 19, durationDays: 3, sortOrder: 39 },
  { id: "frame-20", name: "Immortal Phoenix Crest Frame", category: "frame", priceCoins: 2e6, previewColor: "#FBBF24", description: "Supreme blazing golden phoenix wings for room legends.", seatFrameNumber: 20, durationDays: 3, sortOrder: 40 },
  { id: "entry-golden-flame", name: "Golden Flame Entry", category: "entry", priceCoins: 8e4, previewColor: "#FBBF24", description: "Blazing golden flame ribbon with your VIP badge & colored name.", styleVariant: "flame", sortOrder: 41 },
  { id: "entry-throne", name: "Royal Throne Entry", category: "entry", priceCoins: 14e4, previewColor: "#EF4444", description: "Grand imperial throne entrance alert across the room.", styleVariant: "throne", sortOrder: 42 },
  { id: "entry-car", name: "Luxury Car Entry", category: "entry", priceCoins: 18e4, previewColor: "#38BDF8", description: "Sleek neon supercar streaks across the stage on VIP entry.", styleVariant: "car", sortOrder: 43 },
  { id: "entry-river", name: "Crystal River Entry", category: "entry", priceCoins: 16e4, previewColor: "#22D3EE", description: "Shimmering azure river wave banner announces your arrival.", styleVariant: "river", sortOrder: 44 },
  { id: "entry-golden-palace", name: "Golden Place Entry", category: "entry", priceCoins: 24e4, previewColor: "#FDE047", description: "Radiant Golden Place archway entrance with royal sparkles.", styleVariant: "golden-palace", sortOrder: 45 },
  { id: "entry-crab", name: "Red Crab Entry", category: "entry", priceCoins: 11e4, previewColor: "#F97316", description: "Playful neon coral crab entrance spectacle.", styleVariant: "crab", sortOrder: 46 },
  { id: "seatfx-blazing-fire", name: "Blazing Fire Seat FX", category: "seat-fx", priceCoins: 95e3, previewColor: "#F97316", description: "Blazing amber flames pulsing around your active mic seat.", sortOrder: 47 },
  { id: "seatfx-astral-halo", name: "Astral Pulse Seat FX", category: "seat-fx", priceCoins: 13e4, previewColor: "#38BDF8", description: "Dual cyan harmonic rings radiating as you speak.", sortOrder: 48 },
  { id: "theme-aurora", name: "Aurora Nebula Theme", category: "room-theme", priceCoins: 12e4, previewColor: "#38BDF8", description: "Unlocks luminous northern-lights room stage theme.", sortOrder: 49 },
  { id: "theme-golden", name: "Golden Palace Theme", category: "room-theme", priceCoins: 18e4, previewColor: "#FBBF24", description: "Imperial gilded room backdrop for level-up celebrations.", sortOrder: 50 },
  { id: "theme-river", name: "Crystal River Theme", category: "room-theme", priceCoins: 15e4, previewColor: "#22D3EE", description: "Serene flowing river light gradients for your voice room.", sortOrder: 51 }
];
var ROLES_SEED = [
  {
    role: "super_admin",
    label: "Super Admin",
    permissions: ["*"]
  },
  {
    role: "admin",
    label: "Admin",
    permissions: [
      "users:read",
      "users:manage",
      "payments:review",
      "wallet:adjust",
      "gifts:manage",
      "events:manage",
      "tasks:manage",
      "announcements:manage",
      "reports:manage",
      "audit:read"
    ]
  },
  {
    role: "moderator",
    label: "Moderator",
    permissions: ["users:read", "users:moderate", "reports:manage", "posts:moderate", "rooms:moderate"]
  },
  {
    role: "support_staff",
    label: "Support Staff",
    permissions: ["users:read", "payments:read", "reports:read", "notifications:send"]
  }
];
var seedPromise = null;
async function ensureSeedData() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}
var DEFAULT_VIP_PACKAGES = [
  {
    id: "vip-1m",
    name: "1 Month VIP",
    priceInr: 200,
    durationDays: 30,
    grantedVipLevel: 1,
    bonusGrowth: 0,
    perks: ["Starts at VIP 1", "30 Days Membership Validity", "Earn 1 VIP Pt / 100 Coins Gifted"],
    active: true,
    sortOrder: 1
  },
  {
    id: "vip-3m",
    name: "3 Months VIP",
    priceInr: 500,
    durationDays: 90,
    grantedVipLevel: 1,
    bonusGrowth: 0,
    perks: ["Starts at VIP 1", "90 Days Membership Validity", "Earn 1 VIP Pt / 100 Coins Gifted"],
    active: true,
    sortOrder: 2
  }
];
var DEFAULT_PERMISSION_SETS = [
  {
    id: "set-payment-reviewer",
    name: "Payment Reviewer",
    description: "Inspect payment orders, QR history, and approve/reject UTR submissions.",
    permissions: ["users:read", "payments:read", "payments:review", "audit:read"]
  },
  {
    id: "set-community-moderator",
    name: "Community Moderator",
    description: "Moderate voice rooms, moments, user reports, and temporary suspensions.",
    permissions: ["users:read", "users:moderate", "reports:manage", "posts:moderate", "rooms:moderate"]
  },
  {
    id: "set-vip-manager",
    name: "VIP & Economy Operator",
    description: "Manage VIP packages, coin packages, gifts, and manual coin/VIP adjustments.",
    permissions: ["users:read", "vip:manage", "wallet:adjust", "gifts:manage", "events:manage", "tasks:manage"]
  },
  {
    id: "set-platform-operator",
    name: "Platform Config Operator",
    description: "Manage app settings, banners, announcements, and feature switches.",
    permissions: ["users:read", "config:manage", "announcements:manage", "notifications:send"]
  }
];
async function runSeed() {
  for (const r of ROLES_SEED) {
    await db.insert(rolesPermissions).values(r).onConflictDoUpdate({
      target: rolesPermissions.role,
      set: { label: r.label, permissions: r.permissions }
    });
  }
  for (const rule of VIP_PROGRESSION_SEED) {
    await db.insert(vipProgressionRules).values(rule).onConflictDoUpdate({
      target: vipProgressionRules.level,
      set: {
        title: rule.title,
        requiredPoints: rule.requiredPoints,
        stepPoints: rule.stepPoints,
        badgeColor: rule.badgeColor,
        benefits: rule.benefits
      }
    });
  }
  const existingSettings = await db.select().from(platformSettings).where(eq(platformSettings.key, "upi_payment_config"));
  let activeUpiVal = PERMANENT_UPI_CONFIG;
  if (existingSettings.length === 0) {
    await db.insert(platformSettings).values({
      key: "upi_payment_config",
      value: PERMANENT_UPI_CONFIG
    });
  } else {
    activeUpiVal = { ...PERMANENT_UPI_CONFIG, ...existingSettings[0].value };
  }
  const existingQrVersions = await db.select().from(paymentQrVersions).limit(1);
  if (existingQrVersions.length === 0) {
    const [createdVer] = await db.insert(paymentQrVersions).values({
      versionNumber: 1,
      accountName: String(activeUpiVal.accountName || PERMANENT_UPI_CONFIG.accountName),
      upiId: String(activeUpiVal.upiId || PERMANENT_UPI_CONFIG.upiId),
      provider: String(activeUpiVal.provider || PERMANENT_UPI_CONFIG.provider),
      customQrDataUrl: activeUpiVal.customQrDataUrl || null,
      qrPreviewDataUrl: activeUpiVal.customQrDataUrl || null,
      note: String(activeUpiVal.note || PERMANENT_UPI_CONFIG.note),
      active: activeUpiVal.active !== false,
      screens: Array.isArray(activeUpiVal.screens) ? activeUpiVal.screens : ["coins", "vip"],
      updatedByUid: "system",
      updatedByName: "System Baseline",
      changeSummary: "Initial dynamic payment QR version recorded."
    }).returning();
    if (createdVer) {
      await db.update(platformSettings).set({
        value: { ...activeUpiVal, currentVersionId: createdVer.id, active: createdVer.active, screens: createdVer.screens },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(platformSettings.key, "upi_payment_config"));
    }
  }
  const existingAppCfg = await db.select().from(platformSettings).where(eq(platformSettings.key, "app_config"));
  if (existingAppCfg.length === 0) {
    await db.insert(platformSettings).values({
      key: "app_config",
      value: DEFAULT_APP_CONFIG
    });
  }
  for (const pSet of DEFAULT_PERMISSION_SETS) {
    await db.insert(adminPermissionSets).values(pSet).onConflictDoNothing();
  }
  const existingDecayCfg = await db.select().from(platformSettings).where(eq(platformSettings.key, "vip_decay_config"));
  if (existingDecayCfg.length === 0) {
    await db.insert(platformSettings).values({
      key: "vip_decay_config",
      value: DEFAULT_VIP_DECAY_CONFIG
    });
  }
  const [v2Migrated] = await db.select().from(platformSettings).where(eq(platformSettings.key, "vip_system_v2_migrated"));
  const [v3Migrated] = await db.select().from(platformSettings).where(eq(platformSettings.key, "vip_system_2plan_v3_migrated"));
  const existingVipPkgs = await db.select().from(vipPackages);
  if (existingVipPkgs.length === 0) {
    await db.insert(vipPackages).values(DEFAULT_VIP_PACKAGES);
  }
  if (!v2Migrated || !v3Migrated) {
    for (const pkg of DEFAULT_VIP_PACKAGES) {
      await db.insert(vipPackages).values(pkg).onConflictDoUpdate({
        target: vipPackages.id,
        set: {
          name: pkg.name,
          priceInr: pkg.priceInr,
          durationDays: pkg.durationDays,
          grantedVipLevel: 1,
          bonusGrowth: 0,
          perks: pkg.perks,
          active: true,
          sortOrder: pkg.sortOrder,
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
    }
    const keepIds = new Set(DEFAULT_VIP_PACKAGES.map((p) => p.id));
    for (const oldPkg of existingVipPkgs) {
      if (!keepIds.has(oldPkg.id)) {
        await db.update(vipPackages).set({ active: false, grantedVipLevel: 1, bonusGrowth: 0, updatedAt: /* @__PURE__ */ new Date() }).where(eq(vipPackages.id, oldPkg.id));
      }
    }
    if (!v2Migrated) {
      const vipRows = await db.select().from(vipMemberships);
      for (const row of vipRows) {
        if (Number(row.vipGrowth || 0) > 0) {
          await db.insert(vipPointLedger).values({
            userUid: row.userUid,
            delta: Number(row.vipGrowth),
            balanceAfter: Number(row.vipGrowth),
            vipLevelAfter: Math.max(0, Math.min(18, Number(row.vipLevel || 1))),
            source: "migration",
            referenceId: "vip_system_v2_migrated",
            idempotencyKey: `migration:${row.userUid}`,
            description: `Preserved existing VIP progression points (${Number(row.vipGrowth).toLocaleString()} pts, VIP ${row.vipLevel})`
          }).onConflictDoNothing();
        }
      }
      await db.insert(platformSettings).values({
        key: "vip_system_v2_migrated",
        value: { migratedAt: (/* @__PURE__ */ new Date()).toISOString() }
      }).onConflictDoNothing();
    }
    if (!v3Migrated) {
      await db.insert(platformSettings).values({
        key: "vip_system_2plan_v3_migrated",
        value: { migratedAt: (/* @__PURE__ */ new Date()).toISOString(), activePlans: ["vip-1m", "vip-3m"] }
      }).onConflictDoNothing();
    }
  }
  const existingCoinPkgs = await db.select().from(coinPackages);
  if (existingCoinPkgs.length === 0) {
    await db.insert(coinPackages).values([
      { id: "pkg-1m", label: "1 Million Coins", coins: 1e6, bonusCoins: 0, priceInr: 100, highlight: "Starter Pack", sortOrder: 1 },
      { id: "pkg-2.2m", label: "2.2 Million Coins", coins: 22e5, bonusCoins: 2e5, priceInr: 200, highlight: "+10% Bonus", sortOrder: 2 },
      { id: "pkg-8m", label: "8 Million Coins", coins: 8e6, bonusCoins: 1e6, priceInr: 500, highlight: "Best Value", sortOrder: 3 },
      { id: "pkg-12m", label: "12 Million Coins", coins: 12e6, bonusCoins: 15e5, priceInr: 1e3, highlight: "VIP Favorite", sortOrder: 4 },
      { id: "pkg-30m", label: "30 Million Coins", coins: 3e7, bonusCoins: 5e6, priceInr: 2e3, highlight: "High Roller", sortOrder: 5 }
    ]);
  }
  const existingGifts = await db.select().from(gifts);
  if (existingGifts.length === 0) {
    await db.insert(gifts).values([
      {
        id: "rose",
        name: "Velvet Rose",
        cost: 100,
        charmValue: 100,
        randomCoinsMin: 10,
        randomCoinsMax: 50,
        rarity: "Standard",
        primaryColor: "#F43F5E",
        secondaryColor: "#FB7185",
        description: "Classic crimson petal tribute for hosts and friends.",
        particleStyle: "rose",
        giftNumber: 1
      },
      {
        id: "kiss",
        name: "Neon Heart",
        cost: 200,
        charmValue: 200,
        randomCoinsMin: 20,
        randomCoinsMax: 100,
        rarity: "Standard",
        primaryColor: "#EC4899",
        secondaryColor: "#F472B6",
        description: "Electric heart burst across the live room stage.",
        particleStyle: "heart",
        giftNumber: 2
      },
      {
        id: "ring",
        name: "Lotus Lantern",
        cost: 500,
        charmValue: 500,
        randomCoinsMin: 50,
        randomCoinsMax: 250,
        rarity: "Signature",
        primaryColor: "#F59E0B",
        secondaryColor: "#FDE047",
        description: "Radiant golden lantern illuminating the voice sanctuary.",
        particleStyle: "lantern",
        giftNumber: 3
      },
      {
        id: "diamond-ring",
        name: "Celestial Crown",
        cost: 2e3,
        charmValue: 2e3,
        randomCoinsMin: 200,
        randomCoinsMax: 1e3,
        rarity: "Signature",
        primaryColor: "#38BDF8",
        secondaryColor: "#818CF8",
        description: "Sovereign diamond crown honoring top performers.",
        particleStyle: "crown",
        giftNumber: 4
      },
      {
        id: "sports_car",
        name: "Velocity Hypercar",
        cost: 5e3,
        charmValue: 5e3,
        randomCoinsMin: 500,
        randomCoinsMax: 2500,
        rarity: "Mythic",
        primaryColor: "#22D3EE",
        secondaryColor: "#A855F7",
        description: "Neon turbo supercar drifting across every seat.",
        particleStyle: "vehicle",
        giftNumber: 5
      },
      {
        id: "castle",
        name: "Astral Citadel",
        cost: 2e4,
        charmValue: 2e4,
        randomCoinsMin: 2e3,
        randomCoinsMax: 1e4,
        rarity: "Mythic",
        primaryColor: "#FACC15",
        secondaryColor: "#F97316",
        description: "Monumental floating citadel lighting up the whole arena.",
        particleStyle: "meteor",
        giftNumber: 6
      },
      {
        id: "phoenix",
        name: "Solar Phoenix",
        cost: 5e4,
        charmValue: 5e4,
        randomCoinsMin: 5e3,
        randomCoinsMax: 25e3,
        rarity: "Mythic",
        primaryColor: "#EF4444",
        secondaryColor: "#FDE047",
        description: "Supreme mythic phoenix sweeping across the entire room.",
        particleStyle: "phoenix",
        giftNumber: 7
      }
    ]);
  }
  const existingTasks = await db.select().from(tasks);
  if (existingTasks.length === 0) {
    await db.insert(tasks).values([
      { id: "task-checkin", title: "Daily Check-In", subtitle: "Check in inside OG VELOCITY today", category: "daily", actionType: "checkin", targetCount: 1, rewardCoins: 200, sortOrder: 1 },
      { id: "task-friend", title: "Add a Friend", subtitle: "Send or accept a friend request", category: "daily", actionType: "add_friend", targetCount: 1, rewardCoins: 250, sortOrder: 2 },
      { id: "task-moment", title: "Share a Moment", subtitle: "Post a photo, video, or update in Discover", category: "daily", actionType: "post_moment", targetCount: 1, rewardCoins: 300, sortOrder: 3 },
      { id: "task-game", title: "Play Multiplayer Arena", subtitle: "Complete a match in Ludo, Carrom, UNO, or Laser Tag", category: "daily", actionType: "play_game", targetCount: 1, rewardCoins: 500, sortOrder: 4 },
      { id: "task-gift", title: "Send a Gift", subtitle: "Send any gift in a voice room or chat", category: "daily", actionType: "send_gift", targetCount: 1, rewardCoins: 350, sortOrder: 5 },
      { id: "task-weekly-voice", title: "Weekly Voice Host", subtitle: "Host or participate across 5 voice sessions", category: "weekly", actionType: "voice_time", targetCount: 5, rewardCoins: 2500, sortOrder: 6 }
    ]);
  }
  const existingShopItems = await db.select().from(shopItems).limit(1);
  if (existingShopItems.length === 0) {
    await db.insert(shopItems).values(DEFAULT_SHOP_ITEMS_SEED).onConflictDoNothing();
  }
  const existingEvents = await db.select().from(events);
  if (existingEvents.length === 0) {
    const now = /* @__PURE__ */ new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 864e5);
    await db.insert(events).values([
      {
        id: "evt-velocity-cup",
        title: "OG VELOCITY Season 1 Cup",
        subtitle: "Live Carrom, UNO & Laser Tag Championship",
        description: "Compete in live multiplayer matches and climb the weekly arena standings for bonus coin rewards.",
        eventType: "tournament",
        rewardCoins: 1e4,
        startsAt: now,
        endsAt: inSevenDays,
        status: "live"
      },
      {
        id: "evt-voice-gala",
        title: "Midnight Voice Sanctuary Gala",
        subtitle: "19-Seat Official Audio Room Gathering",
        description: "Join featured 19-seat official rooms, connect over WebRTC live audio, and celebrate top hosts.",
        eventType: "voice",
        rewardCoins: 5e3,
        startsAt: now,
        endsAt: inSevenDays,
        status: "live"
      }
    ]);
  }
  const velBgs = [
    {
      id: "bg-velocity-royal",
      name: "OG Royal Indigo",
      gradient: "linear-gradient(145deg, rgba(16,8,38,0.98) 0%, rgba(44,18,86,0.92) 52%, rgba(10,8,24,0.98) 100%)",
      accent: "#A855F7",
      ambiance: "indigo"
    },
    {
      id: "bg-velocity-neon",
      name: "OG Neon Cyber",
      gradient: "linear-gradient(145deg, rgba(8,14,34,0.98) 0%, rgba(58,14,72,0.9) 52%, rgba(6,24,44,0.98) 100%)",
      accent: "#EC4899",
      ambiance: "crimson"
    },
    {
      id: "bg-velocity-gold",
      name: "OG Sovereign Gold",
      gradient: "linear-gradient(145deg, rgba(18,12,8,0.98) 0%, rgba(56,34,12,0.92) 52%, rgba(10,8,12,0.98) 100%)",
      accent: "#FBBF24",
      ambiance: "saffron"
    },
    {
      id: "bg-velocity-cyber",
      name: "OG Holo Sapphire",
      gradient: "linear-gradient(145deg, rgba(6,16,34,0.98) 0%, rgba(12,48,84,0.9) 52%, rgba(6,12,24,0.98) 100%)",
      accent: "#22D3EE",
      ambiance: "indigo"
    },
    {
      id: "bg-velocity-celestial",
      name: "OG Celestial Aurora",
      gradient: "linear-gradient(145deg, rgba(6,22,24,0.98) 0%, rgba(16,52,64,0.9) 52%, rgba(8,12,28,0.98) 100%)",
      accent: "#34D399",
      ambiance: "emerald"
    }
  ];
  for (const bg of velBgs) {
    await db.insert(roomBackgrounds).values(bg).onConflictDoUpdate({
      target: roomBackgrounds.id,
      set: { name: bg.name, gradient: bg.gradient, accent: bg.accent, ambiance: bg.ambiance, active: true, updatedAt: /* @__PURE__ */ new Date() }
    });
  }
}

// src/db/repository.ts
var ADMIN_PANEL_ROLES = /* @__PURE__ */ new Set([
  "support_staff",
  "moderator",
  "admin",
  "super_admin"
]);
function getCycleKeys(now = /* @__PURE__ */ new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return {
    daily: `${y}-${m}-${d}`,
    weekly: `weekly-${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
    monthly: `monthly-${y}-${m}`
  };
}
var MAX_VIP_LEVEL = 18;
var REFERRAL_REWARD_COINS = 25e3;
function computeVipLevelFromPoints(points) {
  let lvl = 1;
  for (const r of VIP_PROGRESSION_SEED) {
    if (points >= r.requiredPoints) {
      lvl = r.level;
    }
  }
  return Math.min(MAX_VIP_LEVEL, Math.max(1, lvl));
}
var schemaReadyPromise = null;
async function inspectExistingSchemaStatus() {
  const requiredVipColumns = [
    "user_uid",
    "vip_level",
    "vip_status",
    "vip_growth",
    "activated_by_order_id",
    "activated_by_admin_uid",
    "plan_label",
    "activated_at",
    "expires_at",
    "last_decay_date_key",
    "last_decay_at",
    "grace_days_applied",
    "custom_benefits",
    "updated_at"
  ];
  const [tableRows, columnRows] = await Promise.all([
    pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [["users", "vip_memberships", "shop_items", "user_bans", "referrals", "voice_rooms", "withdrawal_requests", "relationship_tags"]]
    ),
    pool.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [["users", "vip_memberships", "voice_rooms", "profiles", "wallets", "payment_orders"]]
    )
  ]);
  const existingTables = new Set(tableRows.rows.map((r) => r.table_name));
  const colsByTable = /* @__PURE__ */ new Map();
  for (const row of columnRows.rows) {
    if (!colsByTable.has(row.table_name)) {
      colsByTable.set(row.table_name, /* @__PURE__ */ new Set());
    }
    colsByTable.get(row.table_name).add(row.column_name);
  }
  const usersExists = existingTables.has("users") && Boolean(colsByTable.get("users")?.has("uid"));
  const usersHasReferredByUid = Boolean(colsByTable.get("users")?.has("referred_by_uid"));
  const vipCols = colsByTable.get("vip_memberships");
  const vipMembershipsReady = existingTables.has("vip_memberships") && requiredVipColumns.every((col) => Boolean(vipCols?.has(col)));
  const shopItemsExists = existingTables.has("shop_items");
  const userBansExists = existingTables.has("user_bans");
  const referralsExists = existingTables.has("referrals");
  const withdrawalRequestsExists = existingTables.has("withdrawal_requests");
  const relationshipTagsExists = existingTables.has("relationship_tags");
  const voiceRoomsHasRoomSettings = existingTables.has("voice_rooms") && Boolean(colsByTable.get("voice_rooms")?.has("room_settings"));
  const profilesHasExtended = Boolean(colsByTable.get("profiles")?.has("theme_mode")) && Boolean(colsByTable.get("profiles")?.has("equipped_emote_id"));
  const walletsHasFrozen = Boolean(colsByTable.get("wallets")?.has("is_frozen"));
  const ordersHasHolder = Boolean(colsByTable.get("payment_orders")?.has("account_holder_name")) && Boolean(colsByTable.get("payment_orders")?.has("payment_date_time"));
  const allReady = usersExists && usersHasReferredByUid && vipMembershipsReady && shopItemsExists && userBansExists && referralsExists && withdrawalRequestsExists && relationshipTagsExists && voiceRoomsHasRoomSettings && profilesHasExtended && walletsHasFrozen && ordersHasHolder;
  return {
    allReady,
    usersExists,
    usersHasReferredByUid,
    vipMembershipsReady,
    shopItemsExists,
    userBansExists,
    referralsExists,
    voiceRoomsHasRoomSettings
  };
}
async function ensureDatabaseSchemaReady() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const status = await inspectExistingSchemaStatus();
    if (status.allReady) {
      return;
    }
    const hasAdminCreds = Boolean(
      process.env.SQL_ADMIN_USER && process.env.SQL_ADMIN_PASSWORD
    );
    const adminPool = hasAdminCreds ? new Pool2({
      host: process.env.SQL_HOST,
      user: process.env.SQL_ADMIN_USER,
      password: process.env.SQL_ADMIN_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 2,
      connectionTimeoutMillis: 15e3
    }) : pool;
    try {
      if (!status.usersExists) {
        throw new Error(
          "Database schema missing required users(uid) table. Run Drizzle schema push before starting the server."
        );
      }
      if (!status.usersHasReferredByUid) {
        await adminPool.query(
          `ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS referred_by_uid text;`
        );
      }
      if (!status.voiceRoomsHasRoomSettings) {
        await adminPool.query(
          `ALTER TABLE IF EXISTS public.voice_rooms ADD COLUMN IF NOT EXISTS room_settings jsonb NOT NULL DEFAULT '{}'::jsonb;`
        );
      }
      if (!status.vipMembershipsReady) {
        await adminPool.query(`
          CREATE TABLE IF NOT EXISTS public.vip_memberships (
            user_uid text PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
            vip_level integer NOT NULL DEFAULT 0,
            vip_status text NOT NULL DEFAULT 'inactive',
            vip_growth integer NOT NULL DEFAULT 0,
            activated_by_order_id text,
            activated_by_admin_uid text,
            plan_label text,
            activated_at timestamptz,
            expires_at timestamptz,
            last_decay_date_key text,
            last_decay_at timestamptz,
            grace_days_applied integer NOT NULL DEFAULT 15,
            custom_benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
            updated_at timestamptz NOT NULL DEFAULT now()
          );
        `);
        await adminPool.query(`
          ALTER TABLE IF EXISTS public.vip_memberships
            ADD COLUMN IF NOT EXISTS vip_level integer NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS vip_status text NOT NULL DEFAULT 'inactive',
            ADD COLUMN IF NOT EXISTS vip_growth integer NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS activated_by_order_id text,
            ADD COLUMN IF NOT EXISTS activated_by_admin_uid text,
            ADD COLUMN IF NOT EXISTS plan_label text,
            ADD COLUMN IF NOT EXISTS activated_at timestamptz,
            ADD COLUMN IF NOT EXISTS expires_at timestamptz,
            ADD COLUMN IF NOT EXISTS last_decay_date_key text,
            ADD COLUMN IF NOT EXISTS last_decay_at timestamptz,
            ADD COLUMN IF NOT EXISTS grace_days_applied integer NOT NULL DEFAULT 15,
            ADD COLUMN IF NOT EXISTS custom_benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
        `);
      }
      if (!status.shopItemsExists) {
        await adminPool.query(`
          CREATE TABLE IF NOT EXISTS public.shop_items (
            id text PRIMARY KEY,
            name text NOT NULL,
            category text NOT NULL,
            description text NOT NULL DEFAULT '',
            price_coins bigint NOT NULL DEFAULT 100000,
            duration_days integer,
            image_url text,
            preview_color text NOT NULL DEFAULT '#38BDF8',
            ring_number integer,
            seat_frame_number integer,
            style_variant text,
            active boolean NOT NULL DEFAULT true,
            sort_order integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );
        `);
      }
      if (!status.userBansExists) {
        await adminPool.query(`
          CREATE TABLE IF NOT EXISTS public.user_bans (
            id serial PRIMARY KEY,
            user_uid text NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
            ban_type text NOT NULL,
            duration_days integer,
            expires_at timestamptz,
            reason text NOT NULL DEFAULT 'Policy violation',
            banned_by_uid text NOT NULL,
            active boolean NOT NULL DEFAULT true,
            revoked_by_uid text,
            revoked_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
          );
        `);
      }
      if (!status.referralsExists) {
        await adminPool.query(`
          CREATE TABLE IF NOT EXISTS public.referrals (
            id serial PRIMARY KEY,
            inviter_uid text NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
            invited_uid text NOT NULL UNIQUE REFERENCES public.users(uid) ON DELETE CASCADE,
            invite_code text NOT NULL,
            reward_coins integer NOT NULL DEFAULT 25000,
            created_at timestamptz NOT NULL DEFAULT now()
          );
        `);
      }
      const appRole = (process.env.SQL_USER || "").replace(/[^a-zA-Z0-9_]/g, "");
      if (hasAdminCreds && appRole && appRole !== process.env.SQL_ADMIN_USER) {
        await adminPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appRole}";`).catch(() => {
        });
        await adminPool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${appRole}";`).catch(() => {
        });
      }
    } finally {
      if (hasAdminCreds && adminPool !== pool) {
        await adminPool.end().catch(() => {
        });
      }
    }
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });
  return schemaReadyPromise;
}
var CP_CHARM_LEVEL_MINS = [
  0,
  12e3,
  42e3,
  102e3,
  182e3,
  292e3,
  442e3,
  642e3,
  9e5,
  125e4
];
function computeCpLevelFromCharm(cpCharm) {
  let lvl = 1;
  for (let i = 0; i < CP_CHARM_LEVEL_MINS.length; i++) {
    if (cpCharm >= CP_CHARM_LEVEL_MINS[i]) lvl = i + 1;
  }
  return lvl;
}
var RELATIONSHIP_TAG_THRESHOLDS = [
  0,
  15e3,
  4e4,
  1e5,
  2e5,
  35e4,
  6e5,
  8e5,
  1e6,
  12e5
];
var ALLOWED_RELATIONSHIP_TAGS = [
  "bro",
  "bestie",
  "sister",
  "soulmate",
  "lover",
  "confident",
  "cp_partner"
];
function normalizeRelationshipTagKey(raw) {
  const clean = String(raw || "").trim().toLowerCase();
  if (clean === "cp_partner") return "lover";
  if (clean === "bro" || clean === "bestie" || clean === "sister" || clean === "soulmate" || clean === "lover" || clean === "confident") {
    return clean;
  }
  return "bro";
}
function computeRelationshipTagLevel(charm) {
  let lvl = 1;
  for (let i = 0; i < RELATIONSHIP_TAG_THRESHOLDS.length; i++) {
    if (charm >= RELATIONSHIP_TAG_THRESHOLDS[i]) lvl = i + 1;
  }
  return Math.min(10, Math.max(1, lvl));
}
var SUPER_ADMIN_EMAILS = new Set(
  (process.env.SUPER_ADMIN_EMAIL || "weplayuser2024@gmail.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
);
var publicIdMigrationPromise = null;
function sanitizeUserForClient(user) {
  return {
    ...user,
    uid: user.publicId,
    zayroId: user.publicId,
    publicId: user.publicId
  };
}
async function resolveUserByUidOrPublicId(identifier, executor = db) {
  const raw = String(identifier || "").trim();
  if (!raw) return null;
  const cleanedNumeric = raw.startsWith("#") ? raw.slice(1).trim() : raw;
  const [row] = await executor.select({
    uid: users.uid,
    publicId: users.publicId,
    role: users.role,
    accountStatus: users.accountStatus
  }).from(users).where(
    or(
      eq2(users.uid, raw),
      eq2(users.publicId, raw),
      eq2(users.publicId, cleanedNumeric),
      eq2(users.publicId, raw.toUpperCase())
    )
  );
  return row || null;
}
async function mapUidsToPublicIds(uids) {
  const unique = Array.from(new Set(uids.map((u) => String(u || "").trim()).filter(Boolean)));
  if (unique.length === 0) return {};
  const rows = await db.select({ uid: users.uid, publicId: users.publicId }).from(users).where(inArray(users.uid, unique));
  const out = {};
  for (const r of rows) {
    out[r.uid] = r.publicId;
  }
  return out;
}
var PUBLIC_ID_COUNTER_KEY = "public_id_counter";
async function getMaxNumericPublicId(tx) {
  const maxUserRow = await tx.execute(
    sql`SELECT COALESCE(MAX(CAST(public_id AS BIGINT)), 100000) AS max_id FROM users WHERE public_id ~ '^[0-9]+$'`
  );
  const maxResRow = await tx.execute(
    sql`SELECT COALESCE(MAX(CAST(public_id AS BIGINT)), 100000) AS max_id FROM reserved_public_ids WHERE public_id ~ '^[0-9]+$'`
  );
  const [counterRow] = await tx.select().from(platformSettings).where(eq2(platformSettings.key, PUBLIC_ID_COUNTER_KEY)).for("update");
  const maxUser = Number(maxUserRow?.rows?.[0]?.max_id ?? 1e5);
  const maxRes = Number(maxResRow?.rows?.[0]?.max_id ?? 1e5);
  const lastAssigned = Number(counterRow?.value?.lastAssigned ?? 1e5);
  return Math.max(1e5, maxUser, maxRes, lastAssigned);
}
async function allocateNextNumericPublicId(tx, userUid) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(9021001)`);
  for (let i = 0; i < 120; i++) {
    const candidateNum = crypto.randomInt(1e6, 1e7);
    const nextId = String(candidateNum);
    if (nextId === "100001") continue;
    const existingUser = await tx.select({ uid: users.uid }).from(users).where(eq2(users.publicId, nextId));
    const existingRes = await tx.select({ publicId: reservedPublicIds.publicId }).from(reservedPublicIds).where(eq2(reservedPublicIds.publicId, nextId));
    if (existingUser.length === 0 && existingRes.length === 0) {
      await tx.delete(reservedPublicIds).where(eq2(reservedPublicIds.userUid, userUid));
      await tx.insert(reservedPublicIds).values({ publicId: nextId, userUid }).onConflictDoNothing();
      return nextId;
    }
  }
  throw new Error("Unable to allocate unique 7-digit numeric public ID.");
}
async function ensureNumericPublicIdsMigrated() {
  if (publicIdMigrationPromise) return publicIdMigrationPromise;
  publicIdMigrationPromise = (async () => {
    await ensureDatabaseSchemaReady();
    await ensureSeedData();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(9021001)`);
      const legacyUsers = await tx.select({ uid: users.uid, publicId: users.publicId }).from(users).where(sql`${users.publicId} !~ '^[0-9]{6,}$'`).orderBy(asc(users.createdAt), asc(users.uid));
      for (const u of legacyUsers) {
        const nextId = await allocateNextNumericPublicId(tx, u.uid);
        await tx.update(users).set({ publicId: nextId, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.uid, u.uid));
        const [prof] = await tx.select({ handle: profiles.handle }).from(profiles).where(eq2(profiles.userUid, u.uid));
        if (prof?.handle && u.publicId) {
          const oldSuffix = u.publicId.replace(/^ZAY-/i, "").toLowerCase();
          if (oldSuffix && prof.handle.endsWith(`.${oldSuffix}`)) {
            const nextHandle = `${prof.handle.slice(0, -oldSuffix.length)}${nextId}`;
            await tx.update(profiles).set({ handle: nextHandle }).where(eq2(profiles.userUid, u.uid));
          }
        }
      }
      const numericUsers = await tx.select({ uid: users.uid, publicId: users.publicId }).from(users).where(sql`${users.publicId} ~ '^[0-9]{6,}$'`);
      for (const u of numericUsers) {
        await tx.insert(reservedPublicIds).values({ publicId: u.publicId, userUid: u.uid }).onConflictDoNothing();
      }
      const currentMax = await getMaxNumericPublicId(tx);
      await tx.insert(platformSettings).values({
        key: PUBLIC_ID_COUNTER_KEY,
        value: { lastAssigned: currentMax },
        updatedAt: /* @__PURE__ */ new Date()
      }).onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: { lastAssigned: currentMax }, updatedAt: /* @__PURE__ */ new Date() }
      });
    });
    await ensureVoiceRoomsHaveOwners();
  })().catch((err) => {
    publicIdMigrationPromise = null;
    throw err;
  });
  return publicIdMigrationPromise;
}
var DEFAULT_ROOM_CLOSED_REASON = "This room has been closed because the Owner and Admin are no longer present.";
function getMaxRoomAdminSlots(roomLevel) {
  const lvl = Math.max(1, Math.min(20, Number(roomLevel || 1)));
  return Math.min(15, 3 + Math.floor((lvl - 1) * 12 / 19));
}
async function ensureVoiceRoomsHaveOwners() {
  const unownedRooms = await db.select({ id: voiceRooms.id }).from(voiceRooms).where(or(eq2(voiceRooms.ownerUid, "system-official"), eq2(voiceRooms.ownerUid, "")));
  if (unownedRooms.length === 0) return;
  const [superAdmin] = await db.select({ uid: users.uid }).from(users).where(and(eq2(users.role, "super_admin"), eq2(users.accountStatus, "active"))).orderBy(asc(users.createdAt)).limit(1);
  if (!superAdmin) return;
  await db.update(voiceRooms).set({ ownerUid: superAdmin.uid, updatedAt: /* @__PURE__ */ new Date() }).where(or(eq2(voiceRooms.ownerUid, "system-official"), eq2(voiceRooms.ownerUid, "")));
}
function serializeVoiceRoomForClient(room, uidMap, onlineCount = 0) {
  const lockedSeats = Array.isArray(room.lockedSeats) ? room.lockedSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const rawSettings = room.roomSettings && typeof room.roomSettings === "object" ? room.roomSettings : {};
  const { passcodeHash: _secretHash, ...safeRoom } = room;
  return {
    ...safeRoom,
    dpUrl: room.dpUrl || null,
    hasPasscode: Boolean(room.isLocked && _secretHash),
    ownerUid: room.ownerUid === "system-official" ? "system-official" : uidMap[room.ownerUid] || room.ownerUid,
    adminUids: Array.isArray(room.adminUids) ? room.adminUids.map((u) => uidMap[u] || u) : [],
    lockedSeats,
    roomSettings: rawSettings,
    status: room.status || "active",
    closedAt: room.closedAt ? room.closedAt.toISOString() : null,
    closedReason: room.closedReason || null,
    onlineCount
  };
}
async function reserveUniquePublicId(tx, userUid) {
  return allocateNextNumericPublicId(tx, userUid);
}
async function getVipDecayConfig(executor = db) {
  const [row] = await executor.select().from(platformSettings).where(eq2(platformSettings.key, "vip_decay_config"));
  const val = row?.value || {};
  return {
    enabled: val.enabled !== void 0 ? Boolean(val.enabled) : DEFAULT_VIP_DECAY_CONFIG.enabled,
    graceDays: Math.max(1, Math.min(90, Math.floor(Number(val.graceDays ?? DEFAULT_VIP_DECAY_CONFIG.graceDays)))),
    mode: val.mode === "percent" ? "percent" : "fixed",
    dailyAmount: Math.max(0, Math.floor(Number(val.dailyAmount ?? DEFAULT_VIP_DECAY_CONFIG.dailyAmount))),
    dailyPercent: Math.max(0, Math.min(100, Number(val.dailyPercent ?? DEFAULT_VIP_DECAY_CONFIG.dailyPercent)))
  };
}
async function updateVipDecayConfig(actorUid, updates) {
  const current = await getVipDecayConfig();
  const next = {
    enabled: typeof updates.enabled === "boolean" ? updates.enabled : current.enabled,
    graceDays: updates.graceDays !== void 0 ? Math.max(1, Math.min(90, Math.floor(Number(updates.graceDays)))) : current.graceDays,
    mode: updates.mode === "percent" ? "percent" : updates.mode === "fixed" ? "fixed" : current.mode,
    dailyAmount: updates.dailyAmount !== void 0 ? Math.max(0, Math.floor(Number(updates.dailyAmount))) : current.dailyAmount,
    dailyPercent: updates.dailyPercent !== void 0 ? Math.max(0, Math.min(100, Number(updates.dailyPercent))) : current.dailyPercent
  };
  await db.transaction(async (tx) => {
    await tx.insert(platformSettings).values({ key: "vip_decay_config", value: next, updatedByUid: actorUid, updatedAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedByUid: actorUid, updatedAt: /* @__PURE__ */ new Date() }
    });
    await tx.insert(auditLogs).values({
      actorUid,
      actorRole: "super_admin",
      action: "update_vip_decay_config",
      targetType: "platform_settings",
      targetId: "vip_decay_config",
      details: next
    });
  });
  return next;
}
function computeVipStatusDetails(vipRow, decayConfig, now = /* @__PURE__ */ new Date()) {
  const nowMs = now.getTime();
  const graceDays = Math.max(1, Number(decayConfig.graceDays || 15));
  let vipStatusRaw = vipRow?.vipStatus || "inactive";
  if (vipStatusRaw === "active" && vipRow?.expiresAt && vipRow.expiresAt.getTime() <= nowMs) {
    vipStatusRaw = "expired";
  }
  const expiresMs = vipRow?.expiresAt ? vipRow.expiresAt.getTime() : null;
  const graceEndsAt = expiresMs ? new Date(expiresMs + graceDays * 864e5) : null;
  const inGracePeriod = Boolean(
    vipStatusRaw === "expired" && graceEndsAt && nowMs <= graceEndsAt.getTime()
  );
  let nextDecayAt = null;
  if (vipStatusRaw === "expired" && decayConfig.enabled && Number(vipRow?.vipGrowth ?? 0) > 0 && graceEndsAt) {
    const anchorMs = Math.max(
      graceEndsAt.getTime(),
      vipRow?.lastDecayAt ? vipRow.lastDecayAt.getTime() : graceEndsAt.getTime()
    );
    nextDecayAt = new Date(anchorMs + 864e5);
  }
  return {
    vipStatusRaw,
    graceEndsAt,
    inGracePeriod,
    graceDays,
    nextDecayAt
  };
}
async function syncUserVipAndDecay(userUid, now = /* @__PURE__ */ new Date(), txOverride) {
  const run = async (tx) => {
    const [vipRow] = await tx.select().from(vipMemberships).where(eq2(vipMemberships.userUid, userUid)).for("update");
    if (!vipRow) {
      return { decayedTotal: 0, daysApplied: 0, vipStatus: "inactive", vipGrowth: 0, vipLevel: 0 };
    }
    const decayConfig = await getVipDecayConfig(tx);
    const nowMs = now.getTime();
    let status = vipRow.vipStatus;
    let needsUpdate = false;
    if (status === "active" && vipRow.expiresAt && vipRow.expiresAt.getTime() <= nowMs) {
      status = "expired";
      needsUpdate = true;
    }
    let currentGrowth = Math.max(0, Number(vipRow.vipGrowth ?? 0));
    let currentLevel = Math.max(0, Math.min(MAX_VIP_LEVEL, Number(vipRow.vipLevel ?? 0)));
    let lastDecayAt = vipRow.lastDecayAt ? new Date(vipRow.lastDecayAt) : null;
    let lastDecayDateKey = vipRow.lastDecayDateKey || null;
    let decayedTotal = 0;
    let daysApplied = 0;
    if (status === "expired" && decayConfig.enabled && vipRow.expiresAt && currentGrowth > 0) {
      const graceEndsMs = vipRow.expiresAt.getTime() + decayConfig.graceDays * 864e5;
      if (nowMs > graceEndsMs) {
        const baseMs = lastDecayAt && lastDecayAt.getTime() >= graceEndsMs ? lastDecayAt.getTime() : graceEndsMs;
        const elapsedDays = Math.min(365, Math.floor((nowMs - baseMs) / 864e5));
        for (let step = 1; step <= elapsedDays; step++) {
          if (currentGrowth <= 0) break;
          const stepDate = new Date(baseMs + step * 864e5);
          const dayKey = stepDate.toISOString().slice(0, 10);
          const idempotencyKey = `decay:${userUid}:${dayKey}`;
          const rawReduction = decayConfig.mode === "percent" ? Math.max(1, Math.round(currentGrowth * decayConfig.dailyPercent / 100)) : Math.max(0, decayConfig.dailyAmount);
          const actualDelta = Math.min(currentGrowth, rawReduction);
          if (actualDelta <= 0) {
            lastDecayAt = stepDate;
            continue;
          }
          const nextGrowth = Math.max(0, currentGrowth - actualDelta);
          const nextProgLevel = nextGrowth > 0 ? computeVipLevelFromPoints(nextGrowth) : 1;
          const inserted = await tx.insert(vipPointLedger).values({
            userUid,
            delta: -actualDelta,
            balanceAfter: nextGrowth,
            vipLevelAfter: nextProgLevel,
            source: "decay",
            referenceId: dayKey,
            idempotencyKey,
            description: `Post-grace VIP point decay (-${actualDelta} pts \xB7 ${decayConfig.mode === "percent" ? `${decayConfig.dailyPercent}%` : "daily fixed"})`
          }).onConflictDoNothing().returning({ id: vipPointLedger.id });
          if (inserted.length > 0) {
            currentGrowth = nextGrowth;
            currentLevel = nextProgLevel;
            lastDecayAt = stepDate;
            lastDecayDateKey = dayKey;
            decayedTotal += actualDelta;
            daysApplied += 1;
            needsUpdate = true;
          } else {
            lastDecayAt = stepDate;
            lastDecayDateKey = dayKey;
          }
        }
      }
    }
    if (needsUpdate) {
      await tx.update(vipMemberships).set({
        vipStatus: status,
        vipGrowth: currentGrowth,
        vipLevel: currentLevel,
        lastDecayAt,
        lastDecayDateKey,
        graceDaysApplied: decayConfig.graceDays,
        updatedAt: now
      }).where(eq2(vipMemberships.userUid, userUid));
    }
    return {
      decayedTotal,
      daysApplied,
      vipStatus: status,
      vipGrowth: currentGrowth,
      vipLevel: currentLevel
    };
  };
  if (txOverride) {
    return run(txOverride);
  }
  return db.transaction(run);
}
async function runVipDecaySweep(now = /* @__PURE__ */ new Date()) {
  await ensureSeedData();
  const candidates = await db.select({ userUid: vipMemberships.userUid }).from(vipMemberships).where(
    or(
      eq2(vipMemberships.vipStatus, "active"),
      eq2(vipMemberships.vipStatus, "expired")
    )
  );
  let decayedUsers = 0;
  let totalPointsDecayed = 0;
  for (const row of candidates) {
    const res = await syncUserVipAndDecay(row.userUid, now);
    if (res.decayedTotal > 0) {
      decayedUsers += 1;
      totalPointsDecayed += res.decayedTotal;
    }
  }
  return {
    processedUsers: candidates.length,
    decayedUsers,
    totalPointsDecayed
  };
}
async function getValidEquippedFrameId(uid, equippedFrameId, executor = db) {
  if (!equippedFrameId) return null;
  const now = /* @__PURE__ */ new Date();
  const [inv] = await executor.select({ itemId: userInventory.itemId, expiresAt: userInventory.expiresAt }).from(userInventory).where(and(eq2(userInventory.userUid, uid), eq2(userInventory.itemId, equippedFrameId)));
  if (!inv) return null;
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() <= now.getTime()) {
    return null;
  }
  return inv.itemId;
}
async function touchUserLastSeen(uid) {
  if (!uid) return;
  await db.update(users).set({ lastSeenAt: /* @__PURE__ */ new Date() }).where(eq2(users.uid, uid)).catch(() => {
  });
}
async function getFullUserView(uid) {
  await ensureNumericPublicIdsMigrated();
  const [userRow] = await db.select().from(users).where(eq2(users.uid, uid));
  if (!userRow) return null;
  await syncUserVipAndDecay(uid).catch((err) => {
    console.warn("[VIP] syncUserVipAndDecay skipped:", err instanceof Error ? err.message : err);
  });
  let [
    [profileRow],
    [walletRow],
    [vipRow],
    charmAgg,
    giftAgg,
    decayConfig,
    activeCpRows
  ] = await Promise.all([
    db.select().from(profiles).where(eq2(profiles.userUid, uid)),
    db.select().from(wallets).where(eq2(wallets.userUid, uid)),
    db.select().from(vipMemberships).where(eq2(vipMemberships.userUid, uid)),
    db.select({ total: sql`COALESCE(SUM(${charmRecords.delta}), 0)` }).from(charmRecords).where(eq2(charmRecords.userUid, uid)),
    db.select({ total: sql`COALESCE(SUM(${giftTransactions.quantity}), 0)` }).from(giftTransactions).where(eq2(giftTransactions.recipientUid, uid)),
    getVipDecayConfig(),
    db.select().from(cpRelationships).where(
      and(
        eq2(cpRelationships.status, "active"),
        or(eq2(cpRelationships.userAUid, uid), eq2(cpRelationships.userBUid, uid))
      )
    ).limit(1)
  ]);
  if (!profileRow) {
    const fallbackName = userRow.email ? userRow.email.split("@")[0].slice(0, 40) : `Player ${userRow.publicId}`;
    await db.insert(profiles).values({
      userUid: uid,
      displayName: fallbackName,
      handle: `@${fallbackName.toLowerCase().replace(/[^a-z0-9]/g, "") || "ogplayer"}.${userRow.publicId}`,
      bio: "",
      gender: "Male",
      age: 21,
      country: "India",
      ornament: "crown"
    }).onConflictDoNothing();
    [profileRow] = await db.select().from(profiles).where(eq2(profiles.userUid, uid));
  }
  if (!walletRow) {
    await db.insert(wallets).values({
      userUid: uid,
      coins: 0,
      totalPurchasedCoins: 0,
      totalSpentCoins: 0,
      totalReceivedCoins: 0
    }).onConflictDoNothing();
    [walletRow] = await db.select().from(wallets).where(eq2(wallets.userUid, uid));
  }
  if (!vipRow) {
    await db.insert(vipMemberships).values({
      userUid: uid,
      vipLevel: 0,
      vipStatus: "inactive",
      vipGrowth: 0,
      planLabel: null
    }).onConflictDoNothing();
    [vipRow] = await db.select().from(vipMemberships).where(eq2(vipMemberships.userUid, uid));
  }
  const activeBans = await getActiveUserBans(uid).catch(() => []);
  const now = /* @__PURE__ */ new Date();
  const hasCompleteBan = activeBans.some((b) => b.banType === "complete");
  const effectiveAccountStatus = hasCompleteBan ? "banned" : userRow.accountStatus || "active";
  const vipDetails = computeVipStatusDetails(vipRow, decayConfig, now);
  const vipEarnedLevel = Number(vipRow?.vipGrowth ?? 0) > 0 ? computeVipLevelFromPoints(Number(vipRow?.vipGrowth ?? 0)) : Number(vipRow?.vipLevel ?? 0);
  const effectiveVipLevel = vipDetails.vipStatusRaw === "active" ? Math.max(1, Math.min(MAX_VIP_LEVEL, Number(vipRow?.vipLevel ?? 1))) : 0;
  const validFrameId = await getValidEquippedFrameId(uid, profileRow?.equippedFrameId);
  let cpPartner = null;
  const activeRel = activeCpRows[0];
  if (activeRel) {
    const partnerInternalUid = activeRel.userAUid === uid ? activeRel.userBUid : activeRel.userAUid;
    const [[partnerUser], [partnerProf]] = await Promise.all([
      db.select({ publicId: users.publicId }).from(users).where(eq2(users.uid, partnerInternalUid)),
      db.select({ displayName: profiles.displayName, photoUrl: profiles.photoUrl }).from(profiles).where(eq2(profiles.userUid, partnerInternalUid))
    ]);
    if (partnerUser) {
      const days = Math.max(
        1,
        Math.floor((now.getTime() - activeRel.startedAt.getTime()) / 864e5) + 1
      );
      cpPartner = {
        partnerUid: partnerUser.publicId,
        partnerName: partnerProf?.displayName || `Player ${partnerUser.publicId}`,
        partnerAvatarId: `user-${partnerUser.publicId}`,
        partnerPhotoUrl: partnerProf?.photoUrl || null,
        ringNumber: Number(activeRel.ringNumber || 1),
        ringName: activeRel.ringName || "Couple Bond Ring",
        since: `${days} ${days === 1 ? "day" : "days"}`,
        cpCharm: Number(activeRel.cpCharm ?? 0),
        cpLevel: computeCpLevelFromCharm(Number(activeRel.cpCharm ?? 0))
      };
    }
  }
  const activeTagList = await getUserRelationshipTags(uid, { activeOnly: true }).catch(() => []);
  return {
    uid: userRow.uid,
    zayroId: userRow.publicId,
    publicId: userRow.publicId,
    email: userRow.email,
    phone: userRow.phone,
    provider: userRow.primaryProvider,
    emailVerified: userRow.emailVerified,
    phoneVerified: userRow.phoneVerified,
    role: userRow.role || "normal_user",
    accountStatus: effectiveAccountStatus,
    banReason: userRow.banReason || activeBans.find((b) => b.banType === "complete")?.reason || null,
    activeBans,
    referredByUid: userRow.referredByUid || null,
    name: profileRow?.displayName || "OG Player",
    handle: profileRow?.handle || `@${userRow.publicId.toLowerCase()}`,
    photoUrl: profileRow?.photoUrl || null,
    coverUrl: profileRow?.coverUrl || null,
    bio: profileRow?.bio || "",
    gender: profileRow?.gender || "Male",
    age: Number(profileRow?.age ?? 21),
    country: profileRow?.country || "India",
    ornament: profileRow?.ornament || "crown",
    themeMode: profileRow?.themeMode === "light" ? "light" : "dark",
    equippedEmoteId: profileRow?.equippedEmoteId || null,
    equippedFrameId: validFrameId,
    equippedRingId: profileRow?.equippedRingId || null,
    equippedEntryId: profileRow?.equippedEntryId || null,
    tags: Array.isArray(profileRow?.tags) ? profileRow.tags : [],
    coins: Number(walletRow?.coins ?? 0),
    walletFrozen: Boolean(walletRow?.isFrozen),
    charmPoints: Math.max(0, Number(charmAgg[0]?.total ?? 0)),
    giftsReceived: Number(giftAgg[0]?.total ?? 0),
    vipLevel: effectiveVipLevel,
    vipEarnedLevel,
    vipStatus: vipDetails.vipStatusRaw === "active" ? "Active" : "Not Active",
    vipStatusRaw: vipDetails.vipStatusRaw,
    vipGrowth: Number(vipRow?.vipGrowth ?? 0),
    vipPlanLabel: vipDetails.vipStatusRaw === "active" ? vipRow?.planLabel || `VIP ${effectiveVipLevel}` : null,
    vipExpiresAt: vipRow?.expiresAt ? vipRow.expiresAt.toISOString() : null,
    vipGraceEndsAt: vipDetails.graceEndsAt ? vipDetails.graceEndsAt.toISOString() : null,
    vipNextDecayAt: vipDetails.nextDecayAt ? vipDetails.nextDecayAt.toISOString() : null,
    vipInGracePeriod: vipDetails.inGracePeriod,
    vipGraceDays: vipDetails.graceDays,
    vipCustomBenefits: Array.isArray(vipRow?.customBenefits) ? vipRow.customBenefits : [],
    vipBenefits: effectiveVipLevel > 0 ? Array.from(
      /* @__PURE__ */ new Set([
        ...VIP_PROGRESSION_SEED.find((r) => r.level === effectiveVipLevel)?.benefits || [],
        ...Array.isArray(vipRow?.customBenefits) ? vipRow.customBenefits : []
      ])
    ) : [],
    cpPartner,
    relationshipTags: activeTagList,
    createdAt: userRow.createdAt.toISOString(),
    lastLoginAt: userRow.lastLoginAt.toISOString(),
    lastSeenAt: (userRow.lastSeenAt || userRow.lastLoginAt).toISOString()
  };
}
async function findOrCreateVerifiedUser(params) {
  await ensureNumericPublicIdsMigrated();
  try {
    const normalizedEmail = params.email ? params.email.trim().toLowerCase() : null;
    const normalizedPhone = params.phone ? params.phone.trim() : null;
    const isOwnerSuperAdmin = Boolean(
      normalizedEmail && params.emailVerified && SUPER_ADMIN_EMAILS.has(normalizedEmail)
    );
    const { userUid, isNew } = await db.transaction(async (tx) => {
      const [identityMatch] = await tx.select({ userUid: authIdentities.userUid }).from(authIdentities).where(
        and(
          eq2(authIdentities.provider, params.providerId),
          eq2(authIdentities.providerSubject, params.firebaseUid)
        )
      );
      let existing;
      if (identityMatch) {
        [existing] = await tx.select().from(users).where(eq2(users.uid, identityMatch.userUid));
      }
      if (!existing) {
        [existing] = await tx.select().from(users).where(eq2(users.uid, params.firebaseUid));
      }
      if (!existing && normalizedEmail && params.emailVerified) {
        [existing] = await tx.select().from(users).where(eq2(users.email, normalizedEmail));
      }
      if (!existing && normalizedPhone && params.phoneVerified) {
        [existing] = await tx.select().from(users).where(eq2(users.phone, normalizedPhone));
      }
      if (existing) {
        const nextRole = isOwnerSuperAdmin ? "super_admin" : existing.role;
        const now = /* @__PURE__ */ new Date();
        await tx.update(users).set({
          email: existing.email || normalizedEmail,
          phone: existing.phone || normalizedPhone,
          emailVerified: existing.emailVerified || Boolean(params.emailVerified),
          phoneVerified: existing.phoneVerified || Boolean(params.phoneVerified),
          role: nextRole,
          lastLoginAt: now,
          lastSeenAt: now,
          updatedAt: now
        }).where(eq2(users.uid, existing.uid));
        await tx.insert(authIdentities).values({
          userUid: existing.uid,
          provider: params.providerId,
          providerSubject: params.firebaseUid,
          email: normalizedEmail,
          phone: normalizedPhone,
          verified: Boolean(params.emailVerified || params.phoneVerified)
        }).onConflictDoUpdate({
          target: [authIdentities.provider, authIdentities.providerSubject],
          set: {
            email: normalizedEmail,
            phone: normalizedPhone,
            verified: Boolean(params.emailVerified || params.phoneVerified),
            lastUsedAt: /* @__PURE__ */ new Date()
          }
        });
        if (isOwnerSuperAdmin) {
          await tx.insert(adminUsers).values({
            userUid: existing.uid,
            role: "super_admin",
            assignedByUid: existing.uid,
            active: true
          }).onConflictDoUpdate({
            target: adminUsers.userUid,
            set: { role: "super_admin", active: true, updatedAt: /* @__PURE__ */ new Date() }
          });
        }
        if (params.photoUrl) {
          await tx.update(profiles).set({ photoUrl: sql`COALESCE(${profiles.photoUrl}, ${params.photoUrl})` }).where(eq2(profiles.userUid, existing.uid));
        }
        return { userUid: existing.uid, isNew: false };
      }
      const publicId = await reserveUniquePublicId(tx, params.firebaseUid);
      const fallbackName = normalizedEmail ? normalizedEmail.split("@")[0] : normalizedPhone ? `Player ${normalizedPhone.slice(-4)}` : `Player ${publicId}`;
      const displayName = (params.name || "").trim().slice(0, 40) || fallbackName;
      const handleBase = displayName.toLowerCase().replace(/[^a-z0-9]/g, "") || "ogplayer";
      const handle = `@${handleBase}.${publicId}`;
      const startingRole = isOwnerSuperAdmin ? "super_admin" : "normal_user";
      await tx.insert(users).values({
        uid: params.firebaseUid,
        publicId,
        email: normalizedEmail,
        phone: normalizedPhone,
        primaryProvider: params.provider,
        emailVerified: Boolean(params.emailVerified),
        phoneVerified: Boolean(params.phoneVerified),
        role: startingRole,
        accountStatus: "active"
      });
      await tx.insert(authIdentities).values({
        userUid: params.firebaseUid,
        provider: params.providerId,
        providerSubject: params.firebaseUid,
        email: normalizedEmail,
        phone: normalizedPhone,
        verified: Boolean(params.emailVerified || params.phoneVerified)
      });
      await tx.insert(profiles).values({
        userUid: params.firebaseUid,
        displayName,
        handle,
        photoUrl: params.photoUrl || null,
        bio: "",
        gender: "Male",
        age: 21,
        country: "India",
        ornament: "crown"
      });
      await tx.insert(wallets).values({
        userUid: params.firebaseUid,
        coins: 0,
        totalPurchasedCoins: 0,
        totalSpentCoins: 0,
        totalReceivedCoins: 0
      });
      await tx.insert(vipMemberships).values({
        userUid: params.firebaseUid,
        vipLevel: 0,
        vipStatus: "inactive",
        vipGrowth: 0,
        planLabel: null
      });
      if (isOwnerSuperAdmin) {
        await tx.insert(adminUsers).values({
          userUid: params.firebaseUid,
          role: "super_admin",
          assignedByUid: params.firebaseUid,
          active: true
        });
      }
      return { userUid: params.firebaseUid, isNew: true };
    });
    if (isOwnerSuperAdmin) {
      await ensureVoiceRoomsHaveOwners();
    }
    const fullUser = await getFullUserView(userUid);
    if (!fullUser) throw new Error("Failed to load created user.");
    return { user: fullUser, isNewUser: isNew };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown database error";
    console.error("[DB] findOrCreateVerifiedUser failed:", detail);
    throw new Error(`Failed to register or load verified user account: ${detail}`, { cause: err });
  }
}
async function createDbSession(params) {
  const sid = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  const expiresAt = now + params.ttlMs;
  await db.insert(userSessions).values({
    sid,
    userUid: params.userUid,
    identifier: params.identifier,
    provider: params.provider,
    createdAt: now,
    expiresAt
  });
  return { sid, userUid: params.userUid, identifier: params.identifier, provider: params.provider, createdAt: now, expiresAt };
}
async function getDbSession(sid) {
  const [row] = await db.select().from(userSessions).where(eq2(userSessions.sid, sid));
  return row || null;
}
async function deleteDbSession(sid) {
  await db.delete(userSessions).where(eq2(userSessions.sid, sid));
}
async function updateSafeProfile(uid, updates) {
  const patch = { updatedAt: /* @__PURE__ */ new Date() };
  if (typeof updates.name === "string" && updates.name.trim()) {
    patch.displayName = updates.name.trim().slice(0, 40);
  }
  if (typeof updates.bio === "string") {
    patch.bio = updates.bio.trim().slice(0, 160);
  }
  if (updates.gender) patch.gender = updates.gender;
  if (typeof updates.age === "number" && updates.age >= 13 && updates.age <= 120) {
    patch.age = Math.floor(updates.age);
  }
  if (typeof updates.country === "string" && updates.country.trim()) {
    patch.country = updates.country.trim().slice(0, 40);
  }
  if (updates.ornament) patch.ornament = updates.ornament;
  if (updates.themeMode === "dark" || updates.themeMode === "light") {
    patch.themeMode = updates.themeMode;
  }
  if (updates.equippedEmoteId !== void 0) {
    patch.equippedEmoteId = updates.equippedEmoteId ? String(updates.equippedEmoteId).trim().slice(0, 40) : null;
  }
  if (typeof updates.handle === "string" && updates.handle.trim()) {
    const cleaned = updates.handle.trim().replace(/^@+/, "").slice(0, 30);
    if (cleaned) patch.handle = `@${cleaned}`;
  }
  if (typeof updates.photoUrl === "string" && updates.photoUrl.startsWith("data:image/")) {
    patch.photoUrl = updates.photoUrl;
  }
  if (Array.isArray(updates.tags)) {
    patch.tags = updates.tags.slice(0, 6).map((t) => String(t).slice(0, 24));
  }
  await db.update(profiles).set(patch).where(eq2(profiles.userUid, uid));
  const full = await getFullUserView(uid);
  if (!full) throw new Error("User not found.");
  return full;
}
async function getPermanentUpiConfig() {
  await ensureSeedData();
  const [row] = await db.select().from(platformSettings).where(eq2(platformSettings.key, "upi_payment_config"));
  const val = row?.value || PERMANENT_UPI_CONFIG;
  const screensRaw = Array.isArray(val.screens) ? val.screens.map((s) => String(s).trim()).filter(Boolean) : ["coins", "vip"];
  return {
    accountName: String(val.accountName || PERMANENT_UPI_CONFIG.accountName),
    upiId: String(val.upiId || PERMANENT_UPI_CONFIG.upiId),
    provider: String(val.provider || PERMANENT_UPI_CONFIG.provider),
    customQrDataUrl: typeof val.customQrDataUrl === "string" && val.customQrDataUrl ? val.customQrDataUrl : null,
    note: String(val.note || PERMANENT_UPI_CONFIG.note),
    active: val.active !== false,
    screens: screensRaw.length > 0 ? screensRaw : ["coins", "vip"],
    currentVersionId: val.currentVersionId ? Number(val.currentVersionId) : null,
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function updatePermanentUpiConfig(actorUid, updates) {
  const current = await getPermanentUpiConfig();
  if (typeof updates.customQrDataUrl === "string" && updates.customQrDataUrl.trim()) {
    const val = updates.customQrDataUrl.trim();
    const validDataUrl = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(val);
    const validHttps = val.startsWith("https://");
    if (!validDataUrl && !validHttps) {
      throw new Error("Uploaded QR image must be a valid PNG, JPEG, WEBP, or SVG image.");
    }
    if (val.length > 28e5) {
      throw new Error("Uploaded QR image must be under 2 MB.");
    }
  }
  const nextAccountName = updates.accountName?.trim() || current.accountName;
  const nextUpiId = updates.upiId?.trim() || current.upiId;
  const nextProvider = updates.provider?.trim() || current.provider;
  const nextCustomQr = updates.customQrDataUrl !== void 0 ? updates.customQrDataUrl : current.customQrDataUrl;
  const nextNote = updates.note?.trim() || current.note;
  const nextActive = typeof updates.active === "boolean" ? updates.active : current.active;
  const nextScreens = Array.isArray(updates.screens) && updates.screens.length > 0 ? Array.from(new Set(updates.screens.map((s) => String(s).trim().toLowerCase()).filter(Boolean))) : current.screens;
  const upiUri = `upi://pay?pa=${encodeURIComponent(nextUpiId)}&pn=${encodeURIComponent(nextAccountName)}&cu=INR`;
  const qrPreviewDataUrl = nextCustomQr || await QRCode.toDataURL(upiUri, { width: 320, margin: 1 });
  return db.transaction(async (tx) => {
    const [actorProfile] = await tx.select({ displayName: profiles.displayName }).from(profiles).where(eq2(profiles.userUid, actorUid));
    const [latestVer] = await tx.select({ versionNumber: paymentQrVersions.versionNumber }).from(paymentQrVersions).orderBy(desc(paymentQrVersions.versionNumber)).limit(1);
    const nextVersionNumber = Number(latestVer?.versionNumber ?? 0) + 1;
    const changes = [];
    if (nextAccountName !== current.accountName) changes.push(`Account Name -> ${nextAccountName}`);
    if (nextUpiId !== current.upiId) changes.push(`UPI ID -> ${nextUpiId}`);
    if (nextProvider !== current.provider) changes.push(`Provider -> ${nextProvider}`);
    if (nextCustomQr !== current.customQrDataUrl) {
      changes.push(nextCustomQr ? "Uploaded new QR image" : "Reverted to auto-generated QR");
    }
    if (nextActive !== current.active) changes.push(nextActive ? "Activated payment method" : "Deactivated payment method");
    if (nextScreens.join(",") !== current.screens.join(",")) changes.push(`Screens -> ${nextScreens.join(", ")}`);
    const [createdVersion] = await tx.insert(paymentQrVersions).values({
      versionNumber: nextVersionNumber,
      accountName: nextAccountName,
      upiId: nextUpiId,
      provider: nextProvider,
      customQrDataUrl: nextCustomQr,
      qrPreviewDataUrl,
      note: nextNote,
      active: nextActive,
      screens: nextScreens,
      updatedByUid: actorUid,
      updatedByName: actorProfile?.displayName || "Super Admin",
      changeSummary: updates.changeSummary?.trim() || (changes.length > 0 ? changes.join(" \xB7 ") : "Republished active QR configuration")
    }).returning();
    const nextConfig = {
      accountName: nextAccountName,
      upiId: nextUpiId,
      provider: nextProvider,
      customQrDataUrl: nextCustomQr,
      note: nextNote,
      active: nextActive,
      screens: nextScreens,
      currentVersionId: createdVersion.id,
      updatedAt: createdVersion.createdAt.toISOString()
    };
    await tx.insert(platformSettings).values({
      key: "upi_payment_config",
      value: nextConfig,
      updatedByUid: actorUid,
      updatedAt: /* @__PURE__ */ new Date()
    }).onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: nextConfig, updatedByUid: actorUid, updatedAt: /* @__PURE__ */ new Date() }
    });
    await tx.insert(auditLogs).values({
      actorUid,
      actorRole: updates.actorRole || "super_admin",
      action: "update_permanent_upi_qr",
      targetType: "payment_qr_version",
      targetId: String(createdVersion.id),
      details: {
        versionNumber: nextVersionNumber,
        accountName: nextAccountName,
        upiId: nextUpiId,
        provider: nextProvider,
        active: nextActive,
        screens: nextScreens,
        hasCustomQr: Boolean(nextCustomQr)
      }
    });
    return {
      ...nextConfig,
      qrDataUrl: qrPreviewDataUrl,
      upiUri,
      versionNumber: createdVersion.versionNumber
    };
  });
}
async function getPaymentQrVersions(limit = 50) {
  await ensureSeedData();
  const rows = await db.select().from(paymentQrVersions).orderBy(desc(paymentQrVersions.versionNumber), desc(paymentQrVersions.createdAt)).limit(limit);
  const uidMap = await mapUidsToPublicIds(rows.map((r) => r.updatedByUid || "").filter(Boolean));
  return Promise.all(
    rows.map(async (r) => {
      let preview = r.qrPreviewDataUrl || r.customQrDataUrl || null;
      if (!preview) {
        const upiUri = `upi://pay?pa=${encodeURIComponent(r.upiId)}&pn=${encodeURIComponent(r.accountName)}&cu=INR`;
        preview = await QRCode.toDataURL(upiUri, { width: 280, margin: 1 });
      }
      return {
        ...r,
        qrPreviewDataUrl: preview,
        updatedByPublicId: r.updatedByUid ? uidMap[r.updatedByUid] || r.updatedByUid : "system",
        createdAt: r.createdAt.toISOString()
      };
    })
  );
}
async function createPaymentOrder(params) {
  await ensureSeedData();
  const upiConfig = await getPermanentUpiConfig();
  if (!upiConfig.active) {
    throw new Error("UPI payments are currently paused by the administrator. Please check back soon.");
  }
  const requiredScreen = (params.screen || params.orderType).toLowerCase();
  if (upiConfig.screens.length > 0 && !upiConfig.screens.includes(requiredScreen)) {
    throw new Error(`UPI payments are currently disabled for ${requiredScreen} purchases.`);
  }
  let packageName = "";
  let amountInr = 0;
  let coinsAmount = 0;
  let grantedVipLevel = 0;
  let vipDurationDays = 0;
  let bonusGrowth = 0;
  if (params.orderType === "vip") {
    const [pkg] = await db.select().from(vipPackages).where(and(eq2(vipPackages.id, params.packageId), eq2(vipPackages.active, true)));
    if (!pkg) throw new Error("VIP package not found or inactive.");
    packageName = pkg.name;
    amountInr = pkg.priceInr;
    grantedVipLevel = 1;
    vipDurationDays = pkg.durationDays;
    bonusGrowth = 0;
  } else {
    const [pkg] = await db.select().from(coinPackages).where(and(eq2(coinPackages.id, params.packageId), eq2(coinPackages.active, true)));
    if (!pkg) throw new Error("Coin package not found or inactive.");
    packageName = pkg.label;
    amountInr = pkg.priceInr;
    coinsAmount = Number(pkg.coins) + Number(pkg.bonusCoins ?? 0);
  }
  const now = /* @__PURE__ */ new Date();
  const [pendingProof] = await db.select().from(paymentOrders).where(
    and(
      eq2(paymentOrders.userUid, params.userUid),
      eq2(paymentOrders.orderType, params.orderType),
      eq2(paymentOrders.packageId, params.packageId),
      eq2(paymentOrders.status, "pending_review")
    )
  ).orderBy(desc(paymentOrders.createdAt)).limit(1);
  if (pendingProof) {
    throw new Error(
      `You already have a payment order (${pendingProof.orderId}) pending Admin verification for ${packageName}.`
    );
  }
  const [existingUnexpired] = await db.select().from(paymentOrders).where(
    and(
      eq2(paymentOrders.userUid, params.userUid),
      eq2(paymentOrders.orderType, params.orderType),
      eq2(paymentOrders.packageId, params.packageId),
      eq2(paymentOrders.status, "awaiting_payment"),
      gt(paymentOrders.expiresAt, now)
    )
  ).orderBy(desc(paymentOrders.createdAt)).limit(1);
  if (existingUnexpired) {
    const snapUpiId = existingUnexpired.upiIdUsed || upiConfig.upiId;
    const snapAccountName = existingUnexpired.accountNameUsed || upiConfig.accountName;
    const snapProvider = existingUnexpired.providerUsed || upiConfig.provider;
    const snapUpiUri = `upi://pay?pa=${encodeURIComponent(snapUpiId)}&pn=${encodeURIComponent(snapAccountName)}&am=${existingUnexpired.amountInr}&tn=${encodeURIComponent(existingUnexpired.orderId)}&cu=INR`;
    const snapQr = existingUnexpired.qrDataUrlSnapshot || await QRCode.toDataURL(snapUpiUri, { width: 320, margin: 1 });
    return {
      order: existingUnexpired,
      upiConfig: {
        ...upiConfig,
        upiId: snapUpiId,
        accountName: snapAccountName,
        provider: snapProvider,
        upiUri: snapUpiUri,
        qrDataUrl: snapQr
      },
      reused: true
    };
  }
  const orderId = `ORD-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(now.getTime() + 20 * 60 * 1e3);
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiConfig.upiId)}&pn=${encodeURIComponent(upiConfig.accountName)}&am=${amountInr}&tn=${encodeURIComponent(orderId)}&cu=INR`;
  const qrDataUrl = upiConfig.customQrDataUrl || await QRCode.toDataURL(upiUri, { width: 320, margin: 1 });
  const [created] = await db.insert(paymentOrders).values({
    orderId,
    userUid: params.userUid,
    orderType: params.orderType,
    packageId: params.packageId,
    packageName,
    amountInr,
    coinsAmount,
    grantedVipLevel,
    vipDurationDays,
    bonusGrowth,
    upiIdUsed: upiConfig.upiId,
    qrVersionId: upiConfig.currentVersionId,
    accountNameUsed: upiConfig.accountName,
    providerUsed: upiConfig.provider,
    qrDataUrlSnapshot: qrDataUrl,
    expiresAt,
    status: "awaiting_payment"
  }).returning();
  return {
    order: created,
    upiConfig: {
      ...upiConfig,
      upiUri,
      qrDataUrl
    },
    reused: false
  };
}
async function submitPaymentProof(params) {
  const cleanUtr = params.utrNumber.trim().toUpperCase();
  if (!/^[A-Z0-9]{8,35}$/.test(cleanUtr)) {
    throw new Error("UTR / Transaction Reference must be 8\u201335 alphanumeric characters.");
  }
  const cleanHolder = String(params.accountHolderName || "").trim().slice(0, 80);
  if (cleanHolder.length < 2) {
    throw new Error("Bank Account Holder / Sender Name is required.");
  }
  const cleanDateTime = String(params.paymentDateTime || "").trim().slice(0, 80) || (/* @__PURE__ */ new Date()).toISOString();
  if (params.screenshotDataUrl) {
    const okMime = /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(params.screenshotDataUrl);
    if (!okMime || params.screenshotDataUrl.length > 25e5) {
      throw new Error("Payment screenshot must be a valid PNG/JPEG/WEBP image under 2MB.");
    }
  }
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(paymentOrders).where(eq2(paymentOrders.orderId, params.orderId)).for("update");
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.userUid !== params.userUid) throw new Error("ORDER_OWNERSHIP_MISMATCH");
    if (order.status === "approved") throw new Error("ORDER_ALREADY_APPROVED");
    if (order.status === "cancelled" || order.status === "expired") throw new Error("ORDER_CANCELLED");
    if (order.status === "awaiting_payment" && order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
      await tx.update(paymentOrders).set({ status: "expired" }).where(eq2(paymentOrders.orderId, params.orderId));
      throw new Error("ORDER_EXPIRED");
    }
    const duplicateUtr = await tx.select({ orderId: paymentOrders.orderId }).from(paymentOrders).where(and(eq2(paymentOrders.utrNumber, cleanUtr), ne(paymentOrders.orderId, params.orderId)));
    if (duplicateUtr.length > 0) {
      throw new Error("DUPLICATE_UTR");
    }
    const [updated] = await tx.update(paymentOrders).set({
      utrNumber: cleanUtr,
      accountHolderName: cleanHolder,
      paymentDateTime: cleanDateTime,
      screenshotDataUrl: params.screenshotDataUrl || order.screenshotDataUrl,
      payerNote: params.payerNote?.trim().slice(0, 200) || null,
      status: "pending_review",
      submittedAt: /* @__PURE__ */ new Date()
    }).where(eq2(paymentOrders.orderId, params.orderId)).returning();
    await tx.insert(notifications).values({
      userUid: params.userUid,
      type: "payment",
      title: "Payment Proof Submitted",
      body: `Order ${order.orderId} (UTR ${cleanUtr} \xB7 Sender: ${cleanHolder}) is pending Admin review. VIP & Coins activate only upon Admin approval.`,
      metadata: { orderId: order.orderId, utr: cleanUtr, accountHolderName: cleanHolder }
    });
    return updated;
  });
}
async function approvePaymentOrder(params) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(paymentOrders).where(eq2(paymentOrders.orderId, params.orderId)).for("update");
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "approved") throw new Error("ORDER_ALREADY_APPROVED");
    if (order.status === "rejected" || order.status === "cancelled" || order.status === "expired") {
      throw new Error("ORDER_NOT_REVIEWABLE");
    }
    if (order.status === "awaiting_payment" && order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
      throw new Error("ORDER_EXPIRED");
    }
    if (!order.utrNumber) {
      throw new Error("UTR_REQUIRED_BEFORE_APPROVAL");
    }
    const [approvedOrder] = await tx.update(paymentOrders).set({
      status: "approved",
      reviewedByUid: params.adminUid,
      reviewNote: params.reviewNote?.trim() || "Verified & Approved",
      reviewedAt: /* @__PURE__ */ new Date()
    }).where(eq2(paymentOrders.orderId, params.orderId)).returning();
    if (order.orderType === "coins") {
      const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, order.userUid)).for("update");
      const nextCoins = Number(wallet?.coins ?? 0) + Number(order.coinsAmount);
      await tx.update(wallets).set({
        coins: nextCoins,
        totalPurchasedCoins: Number(wallet?.totalPurchasedCoins ?? 0) + Number(order.coinsAmount),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(wallets.userUid, order.userUid));
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        userUid: order.userUid,
        type: "topup_credit",
        amount: Number(order.coinsAmount),
        balanceAfter: nextCoins,
        referenceType: "payment_order",
        referenceId: order.orderId,
        idempotencyKey: `order-approve-${order.orderId}`,
        description: `Approved INR \u20B9${order.amountInr} (${order.packageName}) \xB7 UTR ${order.utrNumber}`,
        actorUid: params.adminUid
      });
      await tx.insert(notifications).values({
        userUid: order.userUid,
        type: "payment",
        title: "Coins Credited!",
        body: `Your order ${order.orderId} was approved! +${Number(order.coinsAmount).toLocaleString()} coins credited to your wallet.`,
        metadata: { orderId: order.orderId, coins: Number(order.coinsAmount) }
      });
    } else {
      const now = /* @__PURE__ */ new Date();
      await syncUserVipAndDecay(order.userUid, now, tx);
      const decayConfig = await getVipDecayConfig(tx);
      const [vip] = await tx.select().from(vipMemberships).where(eq2(vipMemberships.userUid, order.userUid)).for("update");
      const existingGrowth = Math.max(0, Number(vip?.vipGrowth ?? 0));
      const levelFromGrowth = computeVipLevelFromPoints(existingGrowth);
      const nextVipLevel = Math.min(MAX_VIP_LEVEL, Math.max(1, levelFromGrowth));
      const previousExpiresAt = vip?.expiresAt ? new Date(vip.expiresAt) : null;
      const isRenewal = Boolean(vip?.activatedAt);
      const baseExpiry = vip?.vipStatus === "active" && vip.expiresAt && vip.expiresAt.getTime() > now.getTime() ? vip.expiresAt.getTime() : now.getTime();
      const durationDays = Math.max(1, Number(order.vipDurationDays || 30));
      const expiresAt = new Date(baseExpiry + durationDays * 864e5);
      await tx.update(vipMemberships).set({
        vipLevel: nextVipLevel,
        vipStatus: "active",
        vipGrowth: existingGrowth,
        activatedByOrderId: order.orderId,
        planLabel: `VIP ${nextVipLevel}`,
        activatedAt: vip?.activatedAt || now,
        expiresAt,
        lastDecayAt: now,
        lastDecayDateKey: null,
        graceDaysApplied: decayConfig.graceDays,
        updatedAt: now
      }).where(eq2(vipMemberships.userUid, order.userUid));
      await tx.insert(vipSubscriptionHistory).values({
        userUid: order.userUid,
        action: isRenewal ? "renew" : "activate",
        source: "payment_order",
        orderId: order.orderId,
        packageId: order.packageId,
        packageName: order.packageName,
        months: Math.max(1, Math.round(durationDays / 30)),
        durationDays,
        startingVipLevel: 1,
        resultingVipLevel: nextVipLevel,
        previousExpiresAt,
        newExpiresAt: expiresAt,
        actorUid: params.adminUid,
        reason: params.reviewNote?.trim() || `Verified UPI Order ${order.orderId}`
      });
      await tx.insert(notifications).values({
        userUid: order.userUid,
        type: "vip",
        title: isRenewal ? `VIP ${nextVipLevel} Renewed!` : `VIP ${nextVipLevel} Activated!`,
        body: `Your VIP payment (${order.packageName}, UTR ${order.utrNumber}) was approved! Valid until ${expiresAt.toLocaleDateString()}.`,
        metadata: { orderId: order.orderId, vipLevel: nextVipLevel, expiresAt: expiresAt.toISOString() }
      });
    }
    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: "approve_payment_order",
      targetType: "payment_order",
      targetId: order.orderId,
      details: {
        targetUserUid: order.userUid,
        orderType: order.orderType,
        amountInr: order.amountInr,
        utr: order.utrNumber,
        reviewNote: params.reviewNote || null
      }
    });
    return approvedOrder;
  });
}
async function rejectPaymentOrder(params) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(paymentOrders).where(eq2(paymentOrders.orderId, params.orderId)).for("update");
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "approved") throw new Error("ORDER_ALREADY_APPROVED");
    const [rejected] = await tx.update(paymentOrders).set({
      status: "rejected",
      reviewedByUid: params.adminUid,
      reviewNote: params.reviewNote.trim() || "Rejected by Admin",
      reviewedAt: /* @__PURE__ */ new Date()
    }).where(eq2(paymentOrders.orderId, params.orderId)).returning();
    await tx.insert(notifications).values({
      userUid: order.userUid,
      type: "payment",
      title: "Payment Proof Rejected",
      body: `Order ${order.orderId} was rejected: ${rejected.reviewNote}`,
      metadata: { orderId: order.orderId }
    });
    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: "reject_payment_order",
      targetType: "payment_order",
      targetId: order.orderId,
      details: { targetUserUid: order.userUid, reason: rejected.reviewNote, utr: order.utrNumber }
    });
    return rejected;
  });
}
async function adminGrantVipSubscription(params) {
  const months = Math.floor(Number(params.months));
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error("Subscription duration must be between 1 and 120 months.");
  }
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 3) {
    throw new Error("A mandatory reason (minimum 3 characters) is required to grant or renew VIP.");
  }
  const durationDays = months * 30;
  const now = /* @__PURE__ */ new Date();
  await db.transaction(async (tx) => {
    const [targetUser] = await tx.select({ uid: users.uid }).from(users).where(eq2(users.uid, params.targetUserUid));
    if (!targetUser) throw new Error("Target user not found.");
    await syncUserVipAndDecay(params.targetUserUid, now, tx);
    const decayConfig = await getVipDecayConfig(tx);
    const [vip] = await tx.select().from(vipMemberships).where(eq2(vipMemberships.userUid, params.targetUserUid)).for("update");
    const existingGrowth = Math.max(0, Number(vip?.vipGrowth ?? 0));
    const resultingVipLevel = Math.min(MAX_VIP_LEVEL, Math.max(1, computeVipLevelFromPoints(existingGrowth)));
    const previousExpiresAt = vip?.expiresAt ? new Date(vip.expiresAt) : null;
    const baseExpiryMs = vip?.vipStatus === "active" && vip.expiresAt && vip.expiresAt.getTime() > now.getTime() ? vip.expiresAt.getTime() : now.getTime();
    const expiresAt = new Date(baseExpiryMs + durationDays * 864e5);
    await tx.update(vipMemberships).set({
      vipLevel: resultingVipLevel,
      vipStatus: "active",
      vipGrowth: existingGrowth,
      activatedByAdminUid: params.adminUid,
      planLabel: `VIP ${resultingVipLevel}`,
      activatedAt: vip?.activatedAt || now,
      expiresAt,
      lastDecayAt: now,
      lastDecayDateKey: null,
      graceDaysApplied: decayConfig.graceDays,
      updatedAt: now
    }).where(eq2(vipMemberships.userUid, params.targetUserUid));
    const pkgLabel = `${months} ${months === 1 ? "Month" : "Months"} Admin Grant`;
    await tx.insert(vipSubscriptionHistory).values({
      userUid: params.targetUserUid,
      action: "admin_grant",
      source: "admin_grant",
      packageName: pkgLabel,
      months,
      durationDays,
      startingVipLevel: 1,
      resultingVipLevel,
      previousExpiresAt,
      newExpiresAt: expiresAt,
      actorUid: params.adminUid,
      reason: cleanReason
    });
    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: "admin_grant_vip_subscription",
      targetType: "user",
      targetId: params.targetUserUid,
      details: {
        months,
        durationDays,
        startingVipLevel: 1,
        resultingVipLevel,
        expiresAt: expiresAt.toISOString(),
        reason: cleanReason
      }
    });
    await tx.insert(notifications).values({
      userUid: params.targetUserUid,
      type: "vip",
      title: `VIP ${resultingVipLevel} Subscription Active`,
      body: `Admin granted ${months} ${months === 1 ? "month" : "months"} of VIP validity (valid until ${expiresAt.toLocaleDateString()}): ${cleanReason}`,
      metadata: { months, durationDays, vipLevel: resultingVipLevel, expiresAt: expiresAt.toISOString() }
    });
  });
  return getFullUserView(params.targetUserUid);
}
async function superAdminSetVip(params) {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 3) {
    throw new Error("Mandatory reason (minimum 3 characters) is required for VIP assignment.");
  }
  const actorRole = params.actorRole || "super_admin";
  const actorLabel = actorRole === "super_admin" ? "Super Admin" : "Admin";
  const now = /* @__PURE__ */ new Date();
  const durationDays = Math.max(1, Math.floor(params.durationDays ?? 30));
  const expiresAt = params.vipStatus === "active" ? new Date(now.getTime() + durationDays * 864e5) : null;
  const cleanBenefits = params.vipStatus === "active" && Array.isArray(params.customBenefits) ? Array.from(new Set(params.customBenefits.map((b) => String(b || "").trim().slice(0, 80)).filter(Boolean))).slice(0, 12) : [];
  await db.transaction(async (tx) => {
    await syncUserVipAndDecay(params.targetUserUid, now, tx);
    const [prevVip] = await tx.select().from(vipMemberships).where(eq2(vipMemberships.userUid, params.targetUserUid)).for("update");
    const prevGrowth = Math.max(0, Number(prevVip?.vipGrowth ?? 0));
    const safeLevel = params.vipStatus === "active" ? Math.min(MAX_VIP_LEVEL, Math.max(1, computeVipLevelFromPoints(prevGrowth))) : 0;
    const previousExpiresAt = prevVip?.expiresAt ? new Date(prevVip.expiresAt) : null;
    await tx.update(vipMemberships).set({
      vipLevel: safeLevel,
      vipStatus: params.vipStatus,
      vipGrowth: prevGrowth,
      activatedByAdminUid: params.superAdminUid,
      planLabel: params.vipStatus === "active" ? `VIP ${safeLevel} (${actorLabel})` : null,
      activatedAt: params.vipStatus === "active" ? prevVip?.activatedAt || now : null,
      expiresAt,
      customBenefits: cleanBenefits,
      lastDecayAt: params.vipStatus === "active" ? now : prevVip?.lastDecayAt || null,
      lastDecayDateKey: params.vipStatus === "active" ? null : prevVip?.lastDecayDateKey || null,
      updatedAt: now
    }).where(eq2(vipMemberships.userUid, params.targetUserUid));
    await tx.insert(vipSubscriptionHistory).values({
      userUid: params.targetUserUid,
      action: params.vipStatus === "active" ? "admin_vip_assign" : "admin_vip_remove",
      source: "super_admin_override",
      packageName: params.vipStatus === "active" ? `${actorLabel} VIP ${safeLevel} Activation (${durationDays}d)` : `${actorLabel} VIP Removed (Inactive)`,
      months: Math.max(0, Math.round(durationDays / 30)),
      durationDays: params.vipStatus === "active" ? durationDays : 0,
      startingVipLevel: safeLevel,
      resultingVipLevel: safeLevel,
      previousExpiresAt,
      newExpiresAt: expiresAt,
      actorUid: params.superAdminUid,
      reason: cleanReason
    });
    await tx.insert(auditLogs).values({
      actorUid: params.superAdminUid,
      actorRole,
      action: params.vipStatus === "active" ? "admin_assign_vip" : "admin_remove_vip",
      targetType: "user",
      targetId: params.targetUserUid,
      details: {
        vipStatus: params.vipStatus,
        vipLevel: safeLevel,
        durationDays,
        customBenefits: cleanBenefits,
        reason: cleanReason
      }
    });
    await tx.insert(notifications).values({
      userUid: params.targetUserUid,
      type: "vip",
      title: params.vipStatus === "active" ? `VIP ${safeLevel} Activated` : "VIP Membership Removed",
      body: params.vipStatus === "active" ? `${actorLabel} activated your VIP ${safeLevel} (${durationDays} days): ${cleanReason}` : `Your VIP membership was removed by ${actorLabel}: ${cleanReason}`
    });
  });
  return getFullUserView(params.targetUserUid);
}
async function adminAdjustCoinsBatch(params) {
  if (!Number.isInteger(params.deltaCoins) || params.deltaCoins === 0) {
    throw new Error("deltaCoins must be a non-zero integer.");
  }
  return db.transaction(async (tx) => {
    const results = [];
    for (const targetUid of params.targetUids) {
      const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, targetUid)).for("update");
      if (!wallet) throw new Error(`Wallet not found for ${targetUid}`);
      const currentCoins = Number(wallet.coins);
      const nextCoins = currentCoins + params.deltaCoins;
      if (nextCoins < 0) {
        throw new Error(`Insufficient balance for ${targetUid} (current ${currentCoins}).`);
      }
      await tx.update(wallets).set({ coins: nextCoins, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(wallets.userUid, targetUid));
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        userUid: targetUid,
        type: params.deltaCoins > 0 ? "admin_credit" : "admin_deduct",
        amount: params.deltaCoins,
        balanceAfter: nextCoins,
        referenceType: "admin_adjustment",
        referenceId: params.adminUid,
        description: params.reason.trim() || "Admin wallet adjustment",
        actorUid: params.adminUid
      });
      await tx.insert(notifications).values({
        userUid: targetUid,
        type: "payment",
        title: params.deltaCoins > 0 ? "Coins Received" : "Wallet Adjusted",
        body: params.deltaCoins > 0 ? `+${params.deltaCoins.toLocaleString()} coins credited: ${params.reason}` : `${params.deltaCoins.toLocaleString()} coins deducted: ${params.reason}`
      });
      results.push({ uid: targetUid, coins: nextCoins });
    }
    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: params.deltaCoins > 0 ? "admin_credit_coins" : "admin_deduct_coins",
      targetType: "wallet",
      targetId: params.targetUids.join(","),
      details: { deltaCoins: params.deltaCoins, count: params.targetUids.length, reason: params.reason }
    });
    return results;
  });
}
async function sendGiftAtomic(params) {
  await ensureSeedData();
  const qty = Math.max(1, Math.min(999, Math.floor(params.quantity)));
  const now = params.now || /* @__PURE__ */ new Date();
  return db.transaction(async (tx) => {
    const [gift] = await tx.select().from(gifts).where(and(eq2(gifts.id, params.giftId), eq2(gifts.active, true)));
    if (!gift) throw new Error("UNKNOWN_GIFT");
    const totalCost = gift.cost * qty;
    const totalCharm = gift.charmValue * qty;
    const rewardCoins = (gift.randomCoinsMin + crypto.randomInt(0, Math.max(1, gift.randomCoinsMax - gift.randomCoinsMin + 1))) * qty;
    const [realRecipient] = await tx.select({ uid: users.uid }).from(users).where(or(eq2(users.uid, params.recipientUid), eq2(users.publicId, params.recipientUid)));
    const lockUids = realRecipient && realRecipient.uid !== params.senderUid ? [params.senderUid, realRecipient.uid].sort() : [params.senderUid];
    const walletRows = await tx.select().from(wallets).where(inArray(wallets.userUid, lockUids)).orderBy(asc(wallets.userUid)).for("update");
    const senderWallet = walletRows.find((w) => w.userUid === params.senderUid);
    if (senderWallet?.isFrozen) {
      throw new Error("WALLET_FROZEN: Your wallet is currently frozen by Admin moderation.");
    }
    if (!senderWallet || Number(senderWallet.coins) < totalCost) {
      throw new Error("INSUFFICIENT_COINS");
    }
    await syncUserVipAndDecay(params.senderUid, now, tx);
    const [senderVip] = await tx.select().from(vipMemberships).where(eq2(vipMemberships.userUid, params.senderUid)).for("update");
    const txId = `GFT-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const nextSenderCoins = Number(senderWallet.coins) - totalCost;
    await tx.update(wallets).set({
      coins: nextSenderCoins,
      totalSpentCoins: Number(senderWallet.totalSpentCoins) + totalCost,
      updatedAt: now
    }).where(eq2(wallets.userUid, params.senderUid));
    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      userUid: params.senderUid,
      type: "gift_spend",
      amount: -totalCost,
      balanceAfter: nextSenderCoins,
      referenceType: "gift",
      referenceId: txId,
      description: `Sent ${qty}x ${gift.name} to ${params.recipientUid}`
    });
    const senderHasActiveVip = senderVip?.vipStatus === "active" && (!senderVip.expiresAt || senderVip.expiresAt.getTime() > now.getTime());
    const vipPointsEarned = senderHasActiveVip ? Math.floor(totalCost / 100) : 0;
    if (vipPointsEarned > 0 && senderVip) {
      const nextGrowth = Math.max(0, Number(senderVip.vipGrowth ?? 0)) + vipPointsEarned;
      const nextVipLevel = Math.max(1, computeVipLevelFromPoints(nextGrowth));
      await tx.update(vipMemberships).set({
        vipGrowth: nextGrowth,
        vipLevel: nextVipLevel,
        planLabel: `VIP ${nextVipLevel}`,
        updatedAt: now
      }).where(eq2(vipMemberships.userUid, params.senderUid));
      await tx.insert(vipPointLedger).values({
        userUid: params.senderUid,
        delta: vipPointsEarned,
        balanceAfter: nextGrowth,
        vipLevelAfter: nextVipLevel,
        source: "gift_spend",
        referenceId: txId,
        idempotencyKey: `gift:${txId}`,
        description: `Earned +${vipPointsEarned} VIP pt${vipPointsEarned === 1 ? "" : "s"} for gifting ${qty}x ${gift.name} (${totalCost.toLocaleString()} coins)`
      });
    }
    const targetUidForCharm = realRecipient ? realRecipient.uid : params.recipientUid;
    if (realRecipient) {
      if (realRecipient.uid !== params.senderUid && rewardCoins > 0) {
        const recWallet = walletRows.find((w) => w.userUid === realRecipient.uid);
        if (recWallet) {
          const nextRecCoins = Number(recWallet.coins) + rewardCoins;
          await tx.update(wallets).set({
            coins: nextRecCoins,
            totalReceivedCoins: Number(recWallet.totalReceivedCoins) + rewardCoins,
            updatedAt: now
          }).where(eq2(wallets.userUid, realRecipient.uid));
          await tx.insert(walletTransactions).values({
            txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
            userUid: realRecipient.uid,
            type: "gift_receive",
            amount: rewardCoins,
            balanceAfter: nextRecCoins,
            referenceType: "gift",
            referenceId: txId,
            description: `Received ${qty}x ${gift.name} bonus coins`
          });
        }
      }
      const [existingCharm] = await tx.select({ total: sql`COALESCE(SUM(${charmRecords.delta}), 0)` }).from(charmRecords).where(eq2(charmRecords.userUid, realRecipient.uid));
      const newCharmTotal = Number(existingCharm?.total ?? 0) + totalCharm;
      await tx.insert(charmRecords).values({
        userUid: realRecipient.uid,
        delta: totalCharm,
        totalAfter: newCharmTotal,
        source: "gift_received",
        referenceId: txId
      });
      const { weekly: weekly2, monthly: monthly2 } = getCycleKeys(now);
      for (const pk of ["overall", weekly2, monthly2]) {
        await tx.insert(rankings).values({ userUid: realRecipient.uid, periodKey: pk, charmScore: totalCharm, giftsSentScore: 0 }).onConflictDoUpdate({
          target: [rankings.userUid, rankings.periodKey],
          set: { charmScore: sql`${rankings.charmScore} + ${totalCharm}`, updatedAt: now }
        });
      }
      if (realRecipient.uid !== params.senderUid) {
        const [activeCp] = await tx.select().from(cpRelationships).where(
          and(
            eq2(cpRelationships.status, "active"),
            or(
              and(eq2(cpRelationships.userAUid, params.senderUid), eq2(cpRelationships.userBUid, realRecipient.uid)),
              and(eq2(cpRelationships.userAUid, realRecipient.uid), eq2(cpRelationships.userBUid, params.senderUid))
            )
          )
        ).for("update");
        if (activeCp) {
          await tx.update(cpRelationships).set({ cpCharm: Number(activeCp.cpCharm ?? 0) + totalCharm }).where(eq2(cpRelationships.id, activeCp.id));
        }
        const activeRelTags = await tx.select().from(relationshipTags).where(
          and(
            eq2(relationshipTags.status, "active"),
            or(
              and(eq2(relationshipTags.userAUid, params.senderUid), eq2(relationshipTags.userBUid, realRecipient.uid)),
              and(eq2(relationshipTags.userAUid, realRecipient.uid), eq2(relationshipTags.userBUid, params.senderUid))
            )
          )
        ).for("update");
        for (const tagRow of activeRelTags) {
          const nextCharm = Number(tagRow.charmScore ?? 0) + totalCharm;
          const nextLvl = computeRelationshipTagLevel(nextCharm);
          await tx.update(relationshipTags).set({ charmScore: nextCharm, level: nextLvl, updatedAt: now }).where(eq2(relationshipTags.id, tagRow.id));
        }
      }
    }
    const { weekly, monthly } = getCycleKeys(now);
    for (const pk of ["overall", weekly, monthly]) {
      await tx.insert(rankings).values({ userUid: params.senderUid, periodKey: pk, charmScore: 0, giftsSentScore: totalCost }).onConflictDoUpdate({
        target: [rankings.userUid, rankings.periodKey],
        set: { giftsSentScore: sql`${rankings.giftsSentScore} + ${totalCost}`, updatedAt: now }
      });
    }
    await tx.insert(giftTransactions).values({
      txId,
      senderUid: params.senderUid,
      recipientUid: targetUidForCharm,
      roomId: params.roomId || null,
      giftId: gift.id,
      giftName: gift.name,
      quantity: qty,
      coinsSpent: totalCost,
      coinsCreditedToRecipient: realRecipient ? rewardCoins : 0,
      charmAwarded: totalCharm,
      vipGrowthAwarded: vipPointsEarned,
      customMessage: params.customMessage || null
    });
    const { daily } = getCycleKeys(now);
    const dailyGiftTasks = await tx.select().from(tasks).where(and(eq2(tasks.actionType, "send_gift"), eq2(tasks.active, true)));
    for (const t of dailyGiftTasks) {
      await tx.insert(taskProgress).values({ userUid: params.senderUid, taskId: t.id, cycleKey: daily, progress: 1, claimed: false }).onConflictDoUpdate({
        target: [taskProgress.userUid, taskProgress.taskId, taskProgress.cycleKey],
        set: { progress: sql`LEAST(${t.targetCount}, ${taskProgress.progress} + 1)` }
      });
    }
    return {
      txId,
      gift,
      quantity: qty,
      coinsSpent: totalCost,
      charmAwarded: totalCharm,
      bonusCoins: rewardCoins,
      vipPointsEarned
    };
  });
}
async function getTop50Rankings(period = "overall") {
  await ensureSeedData();
  const keys = getCycleKeys();
  const periodKey = period === "weekly" ? keys.weekly : period === "monthly" ? keys.monthly : "overall";
  const rows = await db.select({
    uid: users.uid,
    publicId: users.publicId,
    name: profiles.displayName,
    photoUrl: profiles.photoUrl,
    equippedFrameId: profiles.equippedFrameId,
    vipLevel: vipMemberships.vipLevel,
    vipStatus: vipMemberships.vipStatus,
    charmScore: rankings.charmScore,
    giftsSentScore: rankings.giftsSentScore
  }).from(rankings).innerJoin(users, eq2(rankings.userUid, users.uid)).innerJoin(profiles, eq2(users.uid, profiles.userUid)).leftJoin(vipMemberships, eq2(users.uid, vipMemberships.userUid)).where(and(eq2(rankings.periodKey, periodKey), eq2(users.accountStatus, "active"))).orderBy(desc(rankings.charmScore), desc(rankings.giftsSentScore)).limit(50);
  const now = Date.now();
  const framedUids = rows.filter((r) => Boolean(r.equippedFrameId)).map((r) => r.uid);
  const invRows = framedUids.length > 0 ? await db.select({
    userUid: userInventory.userUid,
    itemId: userInventory.itemId,
    expiresAt: userInventory.expiresAt
  }).from(userInventory).where(inArray(userInventory.userUid, framedUids)) : [];
  const validFrameSet = new Set(
    invRows.filter((inv) => !inv.expiresAt || new Date(inv.expiresAt).getTime() > now).map((inv) => `${inv.userUid}:${inv.itemId}`)
  );
  return rows.map((r, idx) => ({
    rank: idx + 1,
    uid: r.publicId,
    publicId: r.publicId,
    name: r.name,
    photoUrl: r.photoUrl,
    equippedFrameId: r.equippedFrameId && validFrameSet.has(`${r.uid}:${r.equippedFrameId}`) ? r.equippedFrameId : null,
    vipLevel: r.vipStatus === "active" ? Number(r.vipLevel ?? 0) : 0,
    charmPoints: Number(r.charmScore ?? 0),
    giftsSentCoins: Number(r.giftsSentScore ?? 0)
  }));
}
async function getUserTasksWithProgress(userUid) {
  await ensureSeedData();
  const allTasks = await db.select().from(tasks).where(eq2(tasks.active, true)).orderBy(asc(tasks.sortOrder));
  const keys = getCycleKeys();
  const progRows = await db.select().from(taskProgress).where(eq2(taskProgress.userUid, userUid));
  return allTasks.map((t) => {
    const cycleKey = t.category === "weekly" ? keys.weekly : t.category === "event" ? "event" : keys.daily;
    const match = progRows.find((p) => p.taskId === t.id && p.cycleKey === cycleKey);
    return {
      ...t,
      cycleKey,
      progress: match?.progress ?? 0,
      claimed: match?.claimed ?? false
    };
  });
}
async function recordTaskActionProgress(userUid, actionType, increment = 1) {
  await ensureSeedData();
  const activeTasks = await db.select().from(tasks).where(and(eq2(tasks.actionType, actionType), eq2(tasks.active, true)));
  const keys = getCycleKeys();
  for (const t of activeTasks) {
    const cycleKey = t.category === "weekly" ? keys.weekly : t.category === "event" ? "event" : keys.daily;
    await db.insert(taskProgress).values({ userUid, taskId: t.id, cycleKey, progress: Math.min(t.targetCount, increment), claimed: false }).onConflictDoUpdate({
      target: [taskProgress.userUid, taskProgress.taskId, taskProgress.cycleKey],
      set: { progress: sql`LEAST(${t.targetCount}, ${taskProgress.progress} + ${increment})` }
    });
  }
}
async function claimTaskRewardAtomic(userUid, taskId) {
  await ensureSeedData();
  const [taskRow] = await db.select().from(tasks).where(and(eq2(tasks.id, taskId), eq2(tasks.active, true)));
  if (!taskRow) throw new Error("TASK_NOT_FOUND");
  const keys = getCycleKeys();
  const cycleKey = taskRow.category === "weekly" ? keys.weekly : taskRow.category === "event" ? "event" : keys.daily;
  return db.transaction(async (tx) => {
    const [prog] = await tx.select().from(taskProgress).where(and(eq2(taskProgress.userUid, userUid), eq2(taskProgress.taskId, taskId), eq2(taskProgress.cycleKey, cycleKey))).for("update");
    if (taskRow.actionType === "checkin" && !prog) {
      await tx.insert(taskProgress).values({
        userUid,
        taskId,
        cycleKey,
        progress: taskRow.targetCount,
        claimed: false
      });
    } else if (!prog || prog.progress < taskRow.targetCount) {
      if (taskRow.actionType !== "checkin") {
        throw new Error("TASK_NOT_COMPLETED");
      }
    }
    if (prog?.claimed) throw new Error("TASK_ALREADY_CLAIMED");
    await tx.update(taskProgress).set({ progress: taskRow.targetCount, claimed: true, claimedAt: /* @__PURE__ */ new Date() }).where(and(eq2(taskProgress.userUid, userUid), eq2(taskProgress.taskId, taskId), eq2(taskProgress.cycleKey, cycleKey)));
    const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, userUid)).for("update");
    const nextCoins = Number(wallet?.coins ?? 0) + taskRow.rewardCoins;
    await tx.update(wallets).set({ coins: nextCoins, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(wallets.userUid, userUid));
    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      userUid,
      type: "task_reward",
      amount: taskRow.rewardCoins,
      balanceAfter: nextCoins,
      referenceType: "task",
      referenceId: `${taskId}:${cycleKey}`,
      idempotencyKey: `task-${userUid}-${taskId}-${cycleKey}`,
      description: `Completed task: ${taskRow.title}`
    });
    return { task: taskRow, coinsAwarded: taskRow.rewardCoins, coins: nextCoins };
  });
}
var DAILY_TASK_CHEST_REWARDS = {
  2: { coins: 500, label: "OG Crystal Chest (2 Tasks)" },
  5: { coins: 1e4, label: "OG Diamond Chest (5 Tasks)" },
  8: { coins: 25e3, label: "OG Royal Gift Chest (8 Tasks)" }
};
async function getClaimedTaskChests(userUid) {
  const keys = getCycleKeys();
  const prefix = `${keys.daily}:`;
  const rows = await db.select({ referenceId: walletTransactions.referenceId }).from(walletTransactions).where(
    and(
      eq2(walletTransactions.userUid, userUid),
      eq2(walletTransactions.referenceType, "task_chest"),
      ilike(walletTransactions.referenceId, `${prefix}%`)
    )
  );
  const steps = rows.map((r) => {
    const parts = String(r.referenceId || "").split(":");
    return Number(parts[parts.length - 1]);
  }).filter((n) => n === 2 || n === 5 || n === 8);
  return Array.from(new Set(steps)).sort((a, b) => a - b);
}
async function claimTaskChestAtomic(userUid, rawStep) {
  await ensureSeedData();
  const step = Number(rawStep);
  const rewardCfg = DAILY_TASK_CHEST_REWARDS[step];
  if (!rewardCfg) throw new Error("INVALID_CHEST_STEP");
  const keys = getCycleKeys();
  const dailyTasks = await db.select().from(tasks).where(and(eq2(tasks.active, true), eq2(tasks.category, "daily")));
  const progRows = await db.select().from(taskProgress).where(and(eq2(taskProgress.userUid, userUid), eq2(taskProgress.cycleKey, keys.daily)));
  const completedCount = dailyTasks.filter((t) => {
    const p = progRows.find((r) => r.taskId === t.id);
    return p && (p.claimed || p.progress >= t.targetCount);
  }).length;
  if (completedCount < step) {
    throw new Error(`Complete at least ${step} daily tasks first (${completedCount}/${step}).`);
  }
  const idempotencyKey = `taskchest-${userUid}-${keys.daily}-${step}`;
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ txId: walletTransactions.txId }).from(walletTransactions).where(eq2(walletTransactions.idempotencyKey, idempotencyKey));
    if (existing) {
      throw new Error("CHEST_ALREADY_CLAIMED");
    }
    const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, userUid)).for("update");
    const nextCoins = Number(wallet?.coins ?? 0) + rewardCfg.coins;
    await tx.update(wallets).set({ coins: nextCoins, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(wallets.userUid, userUid));
    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      userUid,
      type: "task_reward",
      amount: rewardCfg.coins,
      balanceAfter: nextCoins,
      referenceType: "task_chest",
      referenceId: `${keys.daily}:${step}`,
      idempotencyKey,
      description: `Claimed ${rewardCfg.label} (+${rewardCfg.coins.toLocaleString()} coins)`
    });
    return { step, coinsAwarded: rewardCfg.coins, coins: nextCoins, label: rewardCfg.label };
  });
}
async function adminGetTaskProgressList(limitCount = 120) {
  const keys = getCycleKeys();
  const [rows, allUsers, allTasks] = await Promise.all([
    db.select().from(taskProgress).orderBy(desc(taskProgress.id)).limit(Math.max(20, Math.min(300, limitCount))),
    db.select({ uid: users.uid, publicId: users.publicId, email: users.email }).from(users),
    db.select().from(tasks)
  ]);
  const userMap = new Map(allUsers.map((u) => [u.uid, u]));
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  return rows.map((r) => {
    const u = userMap.get(r.userUid);
    const t = taskMap.get(r.taskId);
    return {
      id: r.id,
      userPublicId: u?.publicId || r.userUid,
      userEmail: u?.email || "",
      taskId: r.taskId,
      taskTitle: t?.title || r.taskId,
      targetCount: t?.targetCount ?? 1,
      rewardCoins: t?.rewardCoins ?? 0,
      cycleKey: r.cycleKey,
      isCurrentDailyCycle: r.cycleKey === keys.daily,
      progress: r.progress,
      claimed: r.claimed,
      claimedAt: r.claimedAt ? r.claimedAt.toISOString() : null
    };
  });
}
async function adminUpdateUserTaskProgress(params) {
  const targetUser = await resolveUserByUidOrPublicId(params.userIdentifier);
  if (!targetUser) throw new Error("User not found.");
  const [taskRow] = await db.select().from(tasks).where(eq2(tasks.id, params.taskId));
  if (!taskRow) throw new Error("Task not found.");
  const keys = getCycleKeys();
  const cycleKey = taskRow.category === "weekly" ? keys.weekly : taskRow.category === "event" ? "event" : keys.daily;
  const nextProgress = typeof params.progress === "number" ? Math.max(0, Math.min(taskRow.targetCount, Math.floor(params.progress))) : taskRow.targetCount;
  const nextClaimed = Boolean(params.claimed);
  const [saved] = await db.insert(taskProgress).values({
    userUid: targetUser.uid,
    taskId: taskRow.id,
    cycleKey,
    progress: nextProgress,
    claimed: nextClaimed,
    claimedAt: nextClaimed ? /* @__PURE__ */ new Date() : null
  }).onConflictDoUpdate({
    target: [taskProgress.userUid, taskProgress.taskId, taskProgress.cycleKey],
    set: {
      progress: nextProgress,
      claimed: nextClaimed,
      claimedAt: nextClaimed ? /* @__PURE__ */ new Date() : null
    }
  }).returning();
  return {
    ...saved,
    userPublicId: targetUser.publicId,
    taskTitle: taskRow.title
  };
}
async function buyShopItemAtomic(params) {
  await ensureSeedData();
  if (params.priceCoins < 0) throw new Error("Invalid price.");
  return db.transaction(async (tx) => {
    const [catalogItem] = await tx.select().from(shopItems).where(eq2(shopItems.id, params.itemId));
    if (catalogItem && !catalogItem.active) {
      throw new Error("This shop item is currently unavailable.");
    }
    const authoritativePrice = catalogItem ? Number(catalogItem.priceCoins) : params.priceCoins;
    const authoritativeCategory = catalogItem ? catalogItem.category : params.category;
    const authoritativeDurationDays = catalogItem ? catalogItem.durationDays : params.durationDays;
    const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, params.userUid)).for("update");
    if (wallet?.isFrozen) throw new Error("Your wallet is currently frozen by Admin moderation.");
    if (!wallet || Number(wallet.coins) < authoritativePrice) throw new Error("INSUFFICIENT_COINS");
    const nextCoins = Number(wallet.coins) - authoritativePrice;
    await tx.update(wallets).set({
      coins: nextCoins,
      totalSpentCoins: Number(wallet.totalSpentCoins) + authoritativePrice,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(wallets.userUid, params.userUid));
    const expiresAt = authoritativeDurationDays ? new Date(Date.now() + authoritativeDurationDays * 864e5) : null;
    await tx.insert(userInventory).values({ userUid: params.userUid, itemId: params.itemId, category: authoritativeCategory, expiresAt }).onConflictDoUpdate({
      target: [userInventory.userUid, userInventory.itemId],
      set: { purchasedAt: /* @__PURE__ */ new Date(), expiresAt }
    });
    if (authoritativePrice > 0) {
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        userUid: params.userUid,
        type: "shop_spend",
        amount: -authoritativePrice,
        balanceAfter: nextCoins,
        referenceType: "shop_item",
        referenceId: params.itemId,
        description: `Purchased ${authoritativeCategory}: ${catalogItem?.name || params.itemId}`
      });
    }
    return { itemId: params.itemId, coins: nextCoins, expiresAt: expiresAt?.toISOString() ?? null };
  });
}
function makeDmThreadId(uidA, uidB) {
  return [uidA, uidB].sort().join("__");
}
async function isBlockedBetween(uidA, uidB) {
  const rows = await db.select().from(friends).where(
    and(
      eq2(friends.status, "blocked"),
      or(
        and(eq2(friends.requesterUid, uidA), eq2(friends.addresseeUid, uidB)),
        and(eq2(friends.requesterUid, uidB), eq2(friends.addresseeUid, uidA))
      )
    )
  );
  return rows.length > 0;
}
async function areUsersAcceptedFriends(uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return false;
  const rows = await db.select({ id: friends.id, status: friends.status }).from(friends).where(
    or(
      and(eq2(friends.requesterUid, uidA), eq2(friends.addresseeUid, uidB)),
      and(eq2(friends.requesterUid, uidB), eq2(friends.addresseeUid, uidA))
    )
  );
  if (rows.some((r) => r.status === "blocked")) return false;
  return rows.some((r) => r.status === "accepted");
}
async function cancelFriendRequest(actorUid, targetIdentifierOrRelId) {
  let rel;
  if (typeof targetIdentifierOrRelId === "number" || /^\d+$/.test(String(targetIdentifierOrRelId))) {
    const idNum = Number(targetIdentifierOrRelId);
    const [byId] = await db.select().from(friends).where(eq2(friends.id, idNum));
    if (byId && byId.requesterUid === actorUid && byId.status === "pending") {
      rel = byId;
    }
  }
  if (!rel) {
    const resolved = await resolveUserByUidOrPublicId(String(targetIdentifierOrRelId));
    if (resolved) {
      const [byTarget] = await db.select().from(friends).where(
        and(
          eq2(friends.requesterUid, actorUid),
          eq2(friends.addresseeUid, resolved.uid),
          eq2(friends.status, "pending")
        )
      );
      rel = byTarget;
    }
  }
  if (!rel) throw new Error("Outgoing pending friend request not found.");
  await db.delete(friends).where(eq2(friends.id, rel.id));
  return { cancelledId: rel.id, addresseeUid: rel.addresseeUid };
}
async function unfriendUser(actorUid, targetIdentifier) {
  const resolved = await resolveUserByUidOrPublicId(targetIdentifier);
  const targetUid = resolved?.uid || targetIdentifier;
  if (!targetUid || targetUid === actorUid) {
    throw new Error("Invalid target user.");
  }
  await db.delete(friends).where(
    and(
      eq2(friends.status, "accepted"),
      or(
        and(eq2(friends.requesterUid, actorUid), eq2(friends.addresseeUid, targetUid)),
        and(eq2(friends.requesterUid, targetUid), eq2(friends.addresseeUid, actorUid))
      )
    )
  );
  return { unfriendedUid: targetUid, unfriendedPublicId: resolved?.publicId || targetIdentifier };
}
async function unblockUser(actorUid, targetIdentifier) {
  const resolved = await resolveUserByUidOrPublicId(targetIdentifier);
  const targetUid = resolved?.uid || targetIdentifier;
  if (!targetUid || targetUid === actorUid) {
    throw new Error("Invalid target user.");
  }
  await db.delete(friends).where(
    and(
      eq2(friends.requesterUid, actorUid),
      eq2(friends.addresseeUid, targetUid),
      eq2(friends.status, "blocked")
    )
  );
  return { unblockedPublicId: resolved?.publicId || targetIdentifier };
}
async function getUserNotifications(userUid) {
  return db.select().from(notifications).where(or(eq2(notifications.userUid, userUid), isNull(notifications.userUid))).orderBy(desc(notifications.createdAt)).limit(50);
}
async function getPublicUserProfile(identifier, viewerUid, isOnlineOverride) {
  const resolved = await resolveUserByUidOrPublicId(identifier);
  if (!resolved) return null;
  const full = await getFullUserView(resolved.uid);
  if (!full || full.accountStatus !== "active") return null;
  const [friendCountRow, giftsGivenRow, activeRoomRows, viewerRelRows] = await Promise.all([
    db.select({ count: sql`COUNT(*)` }).from(friends).where(
      and(
        eq2(friends.status, "accepted"),
        or(eq2(friends.requesterUid, resolved.uid), eq2(friends.addresseeUid, resolved.uid))
      )
    ),
    db.select({ total: sql`COALESCE(SUM(${giftTransactions.quantity}), 0)` }).from(giftTransactions).where(eq2(giftTransactions.senderUid, resolved.uid)),
    db.select({
      roomId: voiceRooms.id,
      roomTitle: voiceRooms.title,
      isLocked: voiceRooms.isLocked
    }).from(roomParticipants).innerJoin(voiceRooms, eq2(roomParticipants.roomId, voiceRooms.id)).where(and(eq2(roomParticipants.userUid, resolved.uid), eq2(voiceRooms.status, "active"))).limit(1),
    viewerUid && viewerUid !== resolved.uid ? db.select().from(friends).where(
      or(
        and(eq2(friends.requesterUid, viewerUid), eq2(friends.addresseeUid, resolved.uid)),
        and(eq2(friends.requesterUid, resolved.uid), eq2(friends.addresseeUid, viewerUid))
      )
    ) : Promise.resolve([])
  ]);
  let friendStatus = viewerUid === resolved.uid ? "self" : "none";
  let relationId = null;
  if (viewerUid && viewerUid !== resolved.uid && viewerRelRows.length > 0) {
    const blockedByMe = viewerRelRows.find((r) => r.status === "blocked" && r.requesterUid === viewerUid);
    const blockedByThem = viewerRelRows.find((r) => r.status === "blocked" && r.requesterUid === resolved.uid);
    const accepted = viewerRelRows.find((r) => r.status === "accepted");
    const pendingOut = viewerRelRows.find((r) => r.status === "pending" && r.requesterUid === viewerUid);
    const pendingIn = viewerRelRows.find((r) => r.status === "pending" && r.addresseeUid === viewerUid);
    if (blockedByMe) {
      friendStatus = "blocked_by_me";
      relationId = blockedByMe.id;
    } else if (blockedByThem) {
      friendStatus = "blocked_by_them";
      relationId = blockedByThem.id;
    } else if (accepted) {
      friendStatus = "friends";
      relationId = accepted.id;
    } else if (pendingOut) {
      friendStatus = "pending_outgoing";
      relationId = pendingOut.id;
    } else if (pendingIn) {
      friendStatus = "pending_incoming";
      relationId = pendingIn.id;
    }
  }
  const activeRoom = activeRoomRows[0];
  return {
    avatar: {
      id: `user-${full.publicId}`,
      uid: full.publicId,
      publicId: full.publicId,
      name: full.name,
      handle: full.handle,
      bio: full.bio,
      photoUrl: full.photoUrl || void 0,
      coverUrl: full.coverUrl || void 0,
      gender: full.gender,
      age: full.age,
      country: full.country,
      blessing: full.charmPoints,
      cpPartner: full.cpPartner,
      skinTone: "#E0AC89",
      hairColor: "#1E293B",
      robeColor: "#F59E0B",
      accentColor: "#FBBF24",
      ornament: full.ornament
    },
    equippedFrameId: full.equippedFrameId,
    vipLevel: full.vipLevel,
    charm: full.charmPoints,
    blessing: full.charmPoints,
    ringNumber: full.cpPartner?.ringNumber,
    roomId: activeRoom?.roomId,
    roomTitle: activeRoom?.roomTitle,
    roomLocked: Boolean(activeRoom?.isLocked),
    friendsCount: Number(friendCountRow[0]?.count ?? 0),
    giftsReceived: full.giftsReceived,
    giftsGiven: Number(giftsGivenRow[0]?.total ?? 0),
    cpPartner: full.cpPartner,
    tags: full.tags || [],
    online: Boolean(isOnlineOverride),
    lastSeenAt: full.lastSeenAt,
    friendStatus,
    relationId
  };
}
async function getCpStateForUser(uid) {
  await ensureNumericPublicIdsMigrated();
  const [proposalRows, relationshipRows] = await Promise.all([
    db.select().from(cpProposals).where(or(eq2(cpProposals.fromUid, uid), eq2(cpProposals.toUid, uid))).orderBy(desc(cpProposals.createdAt)).limit(40),
    db.select().from(cpRelationships).where(or(eq2(cpRelationships.userAUid, uid), eq2(cpRelationships.userBUid, uid))).orderBy(desc(cpRelationships.startedAt)).limit(15)
  ]);
  const involvedUids = Array.from(
    /* @__PURE__ */ new Set([
      uid,
      ...proposalRows.flatMap((p) => [p.fromUid, p.toUid]),
      ...relationshipRows.flatMap((r) => [r.userAUid, r.userBUid])
    ])
  );
  const userSummaryRows = involvedUids.length > 0 ? await db.select({
    uid: users.uid,
    publicId: users.publicId,
    name: profiles.displayName,
    photoUrl: profiles.photoUrl
  }).from(users).leftJoin(profiles, eq2(users.uid, profiles.userUid)).where(inArray(users.uid, involvedUids)) : [];
  const infoMap = new Map(
    userSummaryRows.map((u) => [
      u.uid,
      {
        publicId: u.publicId,
        name: u.name || `Player ${u.publicId}`,
        photoUrl: u.photoUrl || null,
        avatarId: `user-${u.publicId}`
      }
    ])
  );
  const activeRel = relationshipRows.find((r) => r.status === "active") || null;
  let cpPartner = null;
  if (activeRel) {
    const partnerInternalUid = activeRel.userAUid === uid ? activeRel.userBUid : activeRel.userAUid;
    const partnerInfo = infoMap.get(partnerInternalUid);
    if (partnerInfo) {
      const days = Math.max(
        1,
        Math.floor((Date.now() - activeRel.startedAt.getTime()) / 864e5) + 1
      );
      cpPartner = {
        partnerUid: partnerInfo.publicId,
        partnerName: partnerInfo.name,
        partnerAvatarId: partnerInfo.avatarId,
        partnerPhotoUrl: partnerInfo.photoUrl,
        ringNumber: Number(activeRel.ringNumber || 1),
        ringName: activeRel.ringName,
        since: `${days} ${days === 1 ? "day" : "days"}`,
        cpCharm: Number(activeRel.cpCharm ?? 0),
        cpLevel: computeCpLevelFromCharm(Number(activeRel.cpCharm ?? 0))
      };
    }
  }
  return {
    cpPartner,
    proposals: proposalRows.map((p) => {
      const from = infoMap.get(p.fromUid);
      const to = infoMap.get(p.toUid);
      return {
        id: p.id,
        fromUid: from?.publicId || p.fromUid,
        fromName: from?.name || "Player",
        fromAvatarId: from?.avatarId || "av-self",
        fromPhotoUrl: from?.photoUrl || null,
        toUid: to?.publicId || p.toUid,
        toName: to?.name || "Player",
        toAvatarId: to?.avatarId || "av-self",
        toPhotoUrl: to?.photoUrl || null,
        ringNumber: Number(p.ringNumber || 1),
        ringName: p.ringName,
        status: p.status === "rejected" ? "declined" : p.status,
        rawStatus: p.status,
        direction: p.fromUid === uid ? "outgoing" : "incoming",
        timestamp: p.createdAt.toISOString(),
        respondedAt: p.respondedAt ? p.respondedAt.toISOString() : null
      };
    }),
    history: relationshipRows.map((r) => {
      const a = infoMap.get(r.userAUid);
      const b = infoMap.get(r.userBUid);
      const partner = r.userAUid === uid ? b : a;
      return {
        id: r.id,
        partnerUid: partner?.publicId || "",
        partnerName: partner?.name || "Player",
        ringNumber: Number(r.ringNumber || 1),
        ringName: r.ringName,
        cpCharm: Number(r.cpCharm ?? 0),
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt ? r.endedAt.toISOString() : null
      };
    })
  };
}
var CpDomainError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
};
async function proposeCpAtomic(params) {
  await ensureNumericPublicIdsMigrated();
  const ringNumber = Math.max(1, Math.min(20, Math.floor(Number(params.ringNumber || 1))));
  const ringName = String(params.ringName || "Couple Bond Ring").trim().slice(0, 60) || "Couple Bond Ring";
  const resolvedTarget = await resolveUserByUidOrPublicId(params.toIdentifier);
  if (!resolvedTarget) {
    throw new CpDomainError(404, "Target user not found.");
  }
  if (resolvedTarget.uid === params.fromUid) {
    throw new CpDomainError(400, "Cannot send a CP proposal to yourself.");
  }
  if (resolvedTarget.accountStatus !== "active") {
    throw new CpDomainError(400, "Target user account is not active.");
  }
  if (await isBlockedBetween(params.fromUid, resolvedTarget.uid)) {
    throw new CpDomainError(403, "Cannot propose CP to a blocked user.");
  }
  return db.transaction(async (tx) => {
    const orderedUids = [params.fromUid, resolvedTarget.uid].sort();
    await tx.select({ uid: users.uid }).from(users).where(inArray(users.uid, orderedUids)).orderBy(asc(users.uid)).for("update");
    const activeConflict = await tx.select({ id: cpRelationships.id, userAUid: cpRelationships.userAUid, userBUid: cpRelationships.userBUid }).from(cpRelationships).where(
      and(
        eq2(cpRelationships.status, "active"),
        or(
          eq2(cpRelationships.userAUid, params.fromUid),
          eq2(cpRelationships.userBUid, params.fromUid),
          eq2(cpRelationships.userAUid, resolvedTarget.uid),
          eq2(cpRelationships.userBUid, resolvedTarget.uid)
        )
      )
    ).limit(1);
    if (activeConflict.length > 0) {
      throw new CpDomainError(409, "One of the users already has an active CP partner.");
    }
    const pendingDup = await tx.select({ id: cpProposals.id }).from(cpProposals).where(
      and(
        eq2(cpProposals.status, "pending"),
        or(
          and(eq2(cpProposals.fromUid, params.fromUid), eq2(cpProposals.toUid, resolvedTarget.uid)),
          and(eq2(cpProposals.fromUid, resolvedTarget.uid), eq2(cpProposals.toUid, params.fromUid))
        )
      )
    ).limit(1);
    if (pendingDup.length > 0) {
      throw new CpDomainError(409, "A pending CP proposal already exists between you two.");
    }
    const matchingShopRings = await tx.select({ id: shopItems.id }).from(shopItems).where(and(eq2(shopItems.category, "ring"), eq2(shopItems.ringNumber, ringNumber)));
    const allowedRingIds = Array.from(/* @__PURE__ */ new Set([`ring-${ringNumber}`, ...matchingShopRings.map((r) => r.id)]));
    const ownedRings = await tx.select({ itemId: userInventory.itemId, expiresAt: userInventory.expiresAt }).from(userInventory).where(and(eq2(userInventory.userUid, params.fromUid), inArray(userInventory.itemId, allowedRingIds)));
    const hasUnexpiredRing = ownedRings.some(
      (r) => !r.expiresAt || new Date(r.expiresAt).getTime() > Date.now()
    );
    if (!hasUnexpiredRing) {
      throw new CpDomainError(
        403,
        `You must purchase and own "${ringName}" in the Shop before sending a CP proposal.`
      );
    }
    const proposalId = `CPPROP-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const [created] = await tx.insert(cpProposals).values({
      id: proposalId,
      fromUid: params.fromUid,
      toUid: resolvedTarget.uid,
      ringNumber,
      ringName,
      status: "pending"
    }).returning();
    const [senderProfile] = await tx.select({ displayName: profiles.displayName }).from(profiles).where(eq2(profiles.userUid, params.fromUid));
    const [senderUser] = await tx.select({ publicId: users.publicId }).from(users).where(eq2(users.uid, params.fromUid));
    await tx.insert(notifications).values({
      userUid: resolvedTarget.uid,
      type: "cp",
      title: "New CP Proposal Received",
      body: `${senderProfile?.displayName || "Player"} (${senderUser?.publicId || ""}) sent you a ${ringName} CP proposal.`,
      metadata: { proposalId, ringNumber, ringName, fromPublicId: senderUser?.publicId }
    });
    return {
      proposal: created,
      fromUidInternal: params.fromUid,
      toUidInternal: resolvedTarget.uid,
      fromPublicId: senderUser?.publicId || params.fromUid,
      toPublicId: resolvedTarget.publicId
    };
  });
}
async function respondCpProposalAtomic(params) {
  return db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(cpProposals).where(eq2(cpProposals.id, params.proposalId)).for("update");
    if (!proposal) {
      throw new CpDomainError(404, "CP proposal not found.");
    }
    if (proposal.toUid !== params.actorUid) {
      throw new CpDomainError(403, "Only the proposal recipient can accept or reject this CP proposal.");
    }
    if (proposal.status !== "pending") {
      throw new CpDomainError(409, `CP proposal is already ${proposal.status}.`);
    }
    const now = /* @__PURE__ */ new Date();
    const [[fromUser], [toUser], [fromProfile], [toProfile]] = await Promise.all([
      tx.select({ publicId: users.publicId }).from(users).where(eq2(users.uid, proposal.fromUid)),
      tx.select({ publicId: users.publicId }).from(users).where(eq2(users.uid, proposal.toUid)),
      tx.select({ displayName: profiles.displayName }).from(profiles).where(eq2(profiles.userUid, proposal.fromUid)),
      tx.select({ displayName: profiles.displayName }).from(profiles).where(eq2(profiles.userUid, proposal.toUid))
    ]);
    if (!params.accept) {
      const [rejected] = await tx.update(cpProposals).set({ status: "rejected", respondedAt: now }).where(eq2(cpProposals.id, proposal.id)).returning();
      await tx.insert(notifications).values({
        userUid: proposal.fromUid,
        type: "cp",
        title: "CP Proposal Declined",
        body: `${toProfile?.displayName || "Player"} (${toUser?.publicId || ""}) declined your ${proposal.ringName} CP proposal.`,
        metadata: { proposalId: proposal.id }
      });
      return {
        status: "rejected",
        proposal: rejected,
        relationship: null,
        fromUidInternal: proposal.fromUid,
        toUidInternal: proposal.toUid
      };
    }
    const orderedUids = [proposal.fromUid, proposal.toUid].sort();
    await tx.select({ uid: users.uid }).from(users).where(inArray(users.uid, orderedUids)).orderBy(asc(users.uid)).for("update");
    const activeConflict = await tx.select({ id: cpRelationships.id }).from(cpRelationships).where(
      and(
        eq2(cpRelationships.status, "active"),
        or(
          eq2(cpRelationships.userAUid, proposal.fromUid),
          eq2(cpRelationships.userBUid, proposal.fromUid),
          eq2(cpRelationships.userAUid, proposal.toUid),
          eq2(cpRelationships.userBUid, proposal.toUid)
        )
      )
    ).limit(1);
    if (activeConflict.length > 0) {
      throw new CpDomainError(409, "One of the users already has an active CP partner.");
    }
    const [accepted] = await tx.update(cpProposals).set({ status: "accepted", respondedAt: now }).where(eq2(cpProposals.id, proposal.id)).returning();
    await tx.update(cpProposals).set({ status: "rejected", respondedAt: now }).where(
      and(
        ne(cpProposals.id, proposal.id),
        eq2(cpProposals.status, "pending"),
        or(
          eq2(cpProposals.fromUid, proposal.fromUid),
          eq2(cpProposals.toUid, proposal.fromUid),
          eq2(cpProposals.fromUid, proposal.toUid),
          eq2(cpProposals.toUid, proposal.toUid)
        )
      )
    );
    const relId = `CPREL-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const [relationship] = await tx.insert(cpRelationships).values({
      id: relId,
      userAUid: proposal.fromUid,
      userBUid: proposal.toUid,
      proposalId: proposal.id,
      ringNumber: proposal.ringNumber,
      ringName: proposal.ringName,
      cpCharm: 0,
      status: "active",
      startedAt: now
    }).returning();
    await Promise.all([
      tx.update(profiles).set({ cpPartnerUid: proposal.toUid, updatedAt: now }).where(eq2(profiles.userUid, proposal.fromUid)),
      tx.update(profiles).set({ cpPartnerUid: proposal.fromUid, updatedAt: now }).where(eq2(profiles.userUid, proposal.toUid)),
      // Clear any stale manual Lover/CP Partner rows so active CP relationship is the single source of truth for the official Lover tag
      tx.update(relationshipTags).set({ status: "ended", updatedAt: now }).where(
        and(
          inArray(relationshipTags.tagType, ["lover", "cp_partner"]),
          or(
            eq2(relationshipTags.userAUid, proposal.fromUid),
            eq2(relationshipTags.userBUid, proposal.fromUid),
            eq2(relationshipTags.userAUid, proposal.toUid),
            eq2(relationshipTags.userBUid, proposal.toUid)
          )
        )
      )
    ]);
    await tx.insert(notifications).values([
      {
        userUid: proposal.fromUid,
        type: "cp",
        title: "CP Bond Formed!",
        body: `${toProfile?.displayName || "Player"} accepted your ${proposal.ringName} CP proposal! Your CP ring & official Lover tag are now active.`,
        metadata: { relationshipId: relId, ringNumber: proposal.ringNumber }
      },
      {
        userUid: proposal.toUid,
        type: "cp",
        title: "CP Bond Formed!",
        body: `You and ${fromProfile?.displayName || "Player"} are now officially CP partners (${proposal.ringName}) with the Lover tag active!`,
        metadata: { relationshipId: relId, ringNumber: proposal.ringNumber }
      }
    ]);
    return {
      status: "accepted",
      proposal: accepted,
      relationship,
      fromUidInternal: proposal.fromUid,
      toUidInternal: proposal.toUid
    };
  });
}
async function breakCpRelationshipAtomic(actorUid) {
  return db.transaction(async (tx) => {
    const [activeRel] = await tx.select().from(cpRelationships).where(
      and(
        eq2(cpRelationships.status, "active"),
        or(eq2(cpRelationships.userAUid, actorUid), eq2(cpRelationships.userBUid, actorUid))
      )
    ).for("update");
    if (!activeRel) {
      throw new CpDomainError(404, "No active CP relationship found.");
    }
    const now = /* @__PURE__ */ new Date();
    const partnerInternalUid = activeRel.userAUid === actorUid ? activeRel.userBUid : activeRel.userAUid;
    await tx.update(cpRelationships).set({ status: "ended", endedByUid: actorUid, endedAt: now }).where(eq2(cpRelationships.id, activeRel.id));
    await Promise.all([
      tx.update(profiles).set({ cpPartnerUid: null, updatedAt: now }).where(eq2(profiles.userUid, activeRel.userAUid)),
      tx.update(profiles).set({ cpPartnerUid: null, updatedAt: now }).where(eq2(profiles.userUid, activeRel.userBUid)),
      tx.update(relationshipTags).set({ status: "ended", updatedAt: now }).where(
        and(
          inArray(relationshipTags.tagType, ["lover", "cp_partner"]),
          or(
            eq2(relationshipTags.userAUid, activeRel.userAUid),
            eq2(relationshipTags.userBUid, activeRel.userAUid),
            eq2(relationshipTags.userAUid, activeRel.userBUid),
            eq2(relationshipTags.userBUid, activeRel.userBUid)
          )
        )
      )
    ]);
    const [[actorProf], [actorUser]] = await Promise.all([
      tx.select({ displayName: profiles.displayName }).from(profiles).where(eq2(profiles.userUid, actorUid)),
      tx.select({ publicId: users.publicId }).from(users).where(eq2(users.uid, actorUid))
    ]);
    await tx.insert(notifications).values({
      userUid: partnerInternalUid,
      type: "cp",
      title: "CP Relationship Ended",
      body: `${actorProf?.displayName || "Player"} (${actorUser?.publicId || ""}) ended your CP relationship. The CP ring has been removed from both profiles.`,
      metadata: { relationshipId: activeRel.id }
    });
    return {
      relationshipId: activeRel.id,
      userAUidInternal: activeRel.userAUid,
      userBUidInternal: activeRel.userBUid,
      partnerUidInternal: partnerInternalUid
    };
  });
}
var APP_PERMISSIONS_CATALOG = [
  "users:read",
  "users:manage",
  "users:moderate",
  "payments:read",
  "payments:review",
  "payments:qr_manage",
  "wallet:adjust",
  "vip:manage",
  "gifts:manage",
  "events:manage",
  "tasks:manage",
  "rooms:moderate",
  "posts:moderate",
  "reports:manage",
  "announcements:manage",
  "notifications:send",
  "config:manage",
  "roles:manage",
  "audit:read"
];
async function getAppConfig() {
  await ensureSeedData();
  const [row] = await db.select().from(platformSettings).where(eq2(platformSettings.key, "app_config"));
  const val = row?.value || {};
  return {
    appName: String(val.appName || DEFAULT_APP_CONFIG.appName),
    tagline: String(val.tagline || DEFAULT_APP_CONFIG.tagline),
    maintenanceMode: Boolean(val.maintenanceMode ?? DEFAULT_APP_CONFIG.maintenanceMode),
    maintenanceMessage: String(val.maintenanceMessage || DEFAULT_APP_CONFIG.maintenanceMessage),
    features: { ...DEFAULT_APP_CONFIG.features, ...val.features || {} },
    voiceRoomLimits: { ...DEFAULT_APP_CONFIG.voiceRoomLimits, ...val.voiceRoomLimits || {} },
    charmRankingConfig: { ...DEFAULT_APP_CONFIG.charmRankingConfig, ...val.charmRankingConfig || {} },
    homeBanner: { ...DEFAULT_APP_CONFIG.homeBanner, ...val.homeBanner || {} },
    profileDefaults: { ...DEFAULT_APP_CONFIG.profileDefaults, ...val.profileDefaults || {} },
    supportInfo: { ...DEFAULT_APP_CONFIG.supportInfo, ...val.supportInfo || {} }
  };
}
async function updateAppConfig(actorUid, actorRole, updates) {
  const current = await getAppConfig();
  const next = {
    appName: typeof updates.appName === "string" && updates.appName.trim() ? updates.appName.trim().slice(0, 60) : current.appName,
    tagline: typeof updates.tagline === "string" ? updates.tagline.trim().slice(0, 140) : current.tagline,
    maintenanceMode: typeof updates.maintenanceMode === "boolean" ? updates.maintenanceMode : current.maintenanceMode,
    maintenanceMessage: typeof updates.maintenanceMessage === "string" ? updates.maintenanceMessage.trim().slice(0, 240) : current.maintenanceMessage,
    features: { ...current.features, ...updates.features || {} },
    voiceRoomLimits: { ...current.voiceRoomLimits, ...updates.voiceRoomLimits || {} },
    charmRankingConfig: { ...current.charmRankingConfig, ...updates.charmRankingConfig || {} },
    homeBanner: { ...current.homeBanner, ...updates.homeBanner || {} },
    profileDefaults: { ...current.profileDefaults, ...updates.profileDefaults || {} },
    supportInfo: { ...current.supportInfo, ...updates.supportInfo || {} }
  };
  await db.transaction(async (tx) => {
    await tx.insert(platformSettings).values({ key: "app_config", value: next, updatedByUid: actorUid, updatedAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedByUid: actorUid, updatedAt: /* @__PURE__ */ new Date() }
    });
    await tx.insert(auditLogs).values({
      actorUid,
      actorRole,
      action: "update_app_config",
      targetType: "platform_settings",
      targetId: "app_config",
      details: next
    });
  });
  return next;
}
async function getEffectiveAdminPermissions(userUid, role) {
  if (role === "super_admin") return ["*"];
  if (!ADMIN_PANEL_ROLES.has(role)) return [];
  const [[roleRow], [userPermRow]] = await Promise.all([
    db.select().from(rolesPermissions).where(eq2(rolesPermissions.role, role)),
    db.select().from(adminUserPermissions).where(eq2(adminUserPermissions.userUid, userUid))
  ]);
  const effective = new Set(Array.isArray(roleRow?.permissions) ? roleRow.permissions : []);
  if (userPermRow) {
    const notExpired = !userPermRow.expiresAt || userPermRow.expiresAt.getTime() > Date.now();
    if (notExpired) {
      if (Array.isArray(userPermRow.customPermissions)) {
        for (const p of userPermRow.customPermissions) effective.add(String(p));
      }
      if (userPermRow.permissionSetId) {
        const [pSet] = await db.select().from(adminPermissionSets).where(eq2(adminPermissionSets.id, userPermRow.permissionSetId));
        if (pSet && Array.isArray(pSet.permissions)) {
          for (const p of pSet.permissions) effective.add(String(p));
        }
      }
    }
  }
  return Array.from(effective);
}
async function getAdminPermissionSets() {
  await ensureSeedData();
  return db.select().from(adminPermissionSets).orderBy(asc(adminPermissionSets.name));
}
async function upsertAdminPermissionSet(params) {
  const id = (params.id || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "") || `set-${crypto.randomBytes(3).toString("hex")}`;
  const cleanPerms = Array.from(new Set(params.permissions.map((p) => String(p).trim()).filter(Boolean)));
  const [saved] = await db.insert(adminPermissionSets).values({
    id,
    name: params.name.trim().slice(0, 60),
    description: (params.description || "").trim().slice(0, 200),
    permissions: cleanPerms,
    createdByUid: params.actorUid
  }).onConflictDoUpdate({
    target: adminPermissionSets.id,
    set: {
      name: params.name.trim().slice(0, 60),
      description: (params.description || "").trim().slice(0, 200),
      permissions: cleanPerms,
      updatedAt: /* @__PURE__ */ new Date()
    }
  }).returning();
  return saved;
}
async function assignAdminUserPermissions(params) {
  const cleanPerms = Array.from(new Set(params.customPermissions.map((p) => String(p).trim()).filter(Boolean)));
  const expiresAtDate = params.expiresAt ? new Date(params.expiresAt) : null;
  if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
    throw new Error("Invalid expiresAt timestamp.");
  }
  return db.transaction(async (tx) => {
    const [prevRow] = await tx.select().from(adminUserPermissions).where(eq2(adminUserPermissions.userUid, params.targetUid));
    const [saved] = await tx.insert(adminUserPermissions).values({
      userUid: params.targetUid,
      customPermissions: cleanPerms,
      permissionSetId: params.permissionSetId || null,
      expiresAt: expiresAtDate,
      grantedByUid: params.actorUid,
      updatedAt: /* @__PURE__ */ new Date()
    }).onConflictDoUpdate({
      target: adminUserPermissions.userUid,
      set: {
        customPermissions: cleanPerms,
        permissionSetId: params.permissionSetId || null,
        expiresAt: expiresAtDate,
        grantedByUid: params.actorUid,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    await tx.insert(adminPermissionHistory).values({
      targetUid: params.targetUid,
      actorUid: params.actorUid,
      action: "update_custom_permissions",
      previousPermissions: Array.isArray(prevRow?.customPermissions) ? prevRow.customPermissions : [],
      nextPermissions: cleanPerms,
      expiresAt: expiresAtDate,
      reason: params.reason?.trim() || "Super Admin permission update"
    });
    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: "super_admin",
      action: "assign_custom_permissions",
      targetType: "user",
      targetId: params.targetUid,
      details: {
        customPermissions: cleanPerms,
        permissionSetId: params.permissionSetId || null,
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null
      }
    });
    return saved;
  });
}
async function getAdminPermissionHistory(limit = 60) {
  const rows = await db.select().from(adminPermissionHistory).orderBy(desc(adminPermissionHistory.createdAt)).limit(limit);
  const uids = Array.from(new Set(rows.flatMap((r) => [r.targetUid, r.actorUid])));
  const uidMap = await mapUidsToPublicIds(uids);
  return rows.map((r) => ({
    ...r,
    targetPublicId: uidMap[r.targetUid] || r.targetUid,
    actorPublicId: uidMap[r.actorUid] || r.actorUid,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null
  }));
}
async function addUserAdminNote(params) {
  const cleanNote = params.note.trim().slice(0, 500);
  if (!cleanNote) throw new Error("Note text is required.");
  const resolved = await resolveUserByUidOrPublicId(params.targetIdentifier);
  if (!resolved) throw new Error("User not found.");
  const [userRow] = await db.select({ adminNotes: users.adminNotes }).from(users).where(eq2(users.uid, resolved.uid));
  const currentNotes = Array.isArray(userRow?.adminNotes) ? userRow.adminNotes : [];
  const nextNotes = [
    {
      id: `NOTE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      note: cleanNote,
      authorUid: params.actorUid,
      authorName: params.actorName,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    ...currentNotes
  ].slice(0, 50);
  await db.update(users).set({ adminNotes: nextNotes, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.uid, resolved.uid));
  return nextNotes;
}
async function getAdminUserInspection(targetIdentifier) {
  const resolved = await resolveUserByUidOrPublicId(targetIdentifier);
  if (!resolved) return null;
  const targetUid = resolved.uid;
  const [[userRow], fullUser, walletTx, orders, subHistory, pointLedger, inventoryRows, permRow] = await Promise.all([
    db.select({ adminNotes: users.adminNotes, banReason: users.banReason }).from(users).where(eq2(users.uid, targetUid)),
    getFullUserView(targetUid),
    db.select().from(walletTransactions).where(eq2(walletTransactions.userUid, targetUid)).orderBy(desc(walletTransactions.createdAt)).limit(30),
    db.select().from(paymentOrders).where(eq2(paymentOrders.userUid, targetUid)).orderBy(desc(paymentOrders.createdAt)).limit(20),
    db.select().from(vipSubscriptionHistory).where(eq2(vipSubscriptionHistory.userUid, targetUid)).orderBy(desc(vipSubscriptionHistory.createdAt)).limit(25),
    db.select().from(vipPointLedger).where(eq2(vipPointLedger.userUid, targetUid)).orderBy(desc(vipPointLedger.createdAt)).limit(40),
    db.select().from(userInventory).where(eq2(userInventory.userUid, targetUid)),
    db.select().from(adminUserPermissions).where(eq2(adminUserPermissions.userUid, targetUid))
  ]);
  const effectivePerms = fullUser ? await getEffectiveAdminPermissions(targetUid, fullUser.role) : [];
  return {
    user: fullUser,
    banReason: userRow?.banReason || null,
    adminNotes: Array.isArray(userRow?.adminNotes) ? userRow.adminNotes : [],
    walletTransactions: walletTx,
    paymentOrders: orders,
    vipSubscriptionHistory: subHistory,
    vipPointLedger: pointLedger,
    inventory: inventoryRows,
    customPermissions: permRow[0] || null,
    effectivePermissions: effectivePerms
  };
}
function isAppAdminRole(role) {
  return role === "admin" || role === "super_admin";
}
async function ensureOfficialRoomsSecurityState(roomIdsWithLiveAppAdmin) {
  const officialActiveRooms = await db.select({ id: voiceRooms.id }).from(voiceRooms).where(and(eq2(voiceRooms.isOfficial, true), eq2(voiceRooms.status, "active")));
  const closedIds = [];
  for (const r of officialActiveRooms) {
    if (roomIdsWithLiveAppAdmin?.has(r.id)) continue;
    await db.update(voiceRooms).set({
      status: "closed",
      closedAt: /* @__PURE__ */ new Date(),
      closedReason: "Waiting for an authorized App Admin to open this Official Room.",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(voiceRooms.id, r.id));
    closedIds.push(r.id);
  }
  return closedIds;
}
async function reopenVoiceRoom(params) {
  const [room] = await db.select().from(voiceRooms).where(eq2(voiceRooms.id, params.roomId));
  if (!room) {
    const err = new Error("Voice room not found.");
    err.statusCode = 404;
    throw err;
  }
  const actorIsAppAdmin = isAppAdminRole(params.actorUser.role);
  if (room.isOfficial) {
    if (!actorIsAppAdmin) {
      const err = new Error("Only authorized App Admins can open or reopen Official Rooms.");
      err.statusCode = 403;
      throw err;
    }
  } else {
    const isOwnerOrRoomAdmin = room.ownerUid === params.actorUser.uid || Array.isArray(room.adminUids) && room.adminUids.includes(params.actorUser.uid) || actorIsAppAdmin;
    if (!isOwnerOrRoomAdmin) {
      const err = new Error("Only the room Owner or an authorized Room Admin can reopen this room.");
      err.statusCode = 403;
      throw err;
    }
  }
  const [updated] = await db.update(voiceRooms).set({
    status: "active",
    closedAt: null,
    closedReason: null,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(voiceRooms.id, room.id)).returning();
  await db.insert(auditLogs).values({
    actorUid: params.actorUser.uid,
    actorRole: params.actorUser.role,
    action: room.isOfficial ? "official_room_opened" : "voice_room_reopened",
    targetType: "voice_room",
    targetId: room.id,
    details: { title: room.title, isOfficial: room.isOfficial }
  });
  const uidMap = await mapUidsToPublicIds([
    updated.ownerUid,
    ...Array.isArray(updated.adminUids) ? updated.adminUids : []
  ]);
  return serializeVoiceRoomForClient(updated, uidMap, 0);
}
async function submitCustomGift(params) {
  const name = params.name.trim().slice(0, 60);
  const description = params.description.trim().slice(0, 240);
  const cost = Math.max(10, Math.min(1e6, Math.floor(Number(params.cost || 100))));
  const charmValue = Math.max(1, Math.min(2e6, Math.floor(Number(params.charmValue || cost * 2))));
  if (!name || !description) {
    throw new Error("Gift name and description are required.");
  }
  const rarity = ["Standard", "Signature", "Mythic"].includes(String(params.rarity || "")) ? String(params.rarity) : cost >= 1500 ? "Mythic" : cost >= 300 ? "Signature" : "Standard";
  const id = `CG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const [created] = await db.insert(customGifts).values({
    id,
    creatorUid: params.creatorUid,
    name,
    cost,
    charmValue,
    rarity,
    description,
    primaryColor: (params.primaryColor || "#A855F7").slice(0, 24),
    secondaryColor: (params.secondaryColor || "#38BDF8").slice(0, 24),
    particleStyle: (params.particleStyle || "crown").slice(0, 24),
    artworkUrl: params.artworkUrl ? params.artworkUrl.slice(0, 4e5) : null,
    animationVideoUrl: params.animationVideoUrl ? params.animationVideoUrl.slice(0, 9e5) : null,
    videoFileName: params.videoFileName ? params.videoFileName.slice(0, 120) : null,
    status: "pending"
  }).returning();
  return created;
}
async function getUserCustomGifts(creatorUid) {
  const [rows, [creatorUser], [creatorProf]] = await Promise.all([
    db.select().from(customGifts).where(eq2(customGifts.creatorUid, creatorUid)).orderBy(desc(customGifts.createdAt)),
    db.select({ publicId: users.publicId }).from(users).where(eq2(users.uid, creatorUid)),
    db.select({ displayName: profiles.displayName }).from(profiles).where(eq2(profiles.userUid, creatorUid))
  ]);
  const creatorPublicId = creatorUser?.publicId || creatorUid;
  const creatorName = creatorProf?.displayName || "Player";
  return rows.map((r) => ({
    ...r,
    creatorUid: creatorPublicId,
    creatorName,
    submittedAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null
  }));
}
async function adminListCustomGifts(statusFilter) {
  const rows = statusFilter && ["pending", "approved", "rejected"].includes(statusFilter) ? await db.select().from(customGifts).where(eq2(customGifts.status, statusFilter)).orderBy(desc(customGifts.createdAt)).limit(100) : await db.select().from(customGifts).orderBy(desc(customGifts.createdAt)).limit(100);
  const uidCandidates = rows.flatMap((r) => [r.creatorUid, r.reviewedByUid || ""]).filter(Boolean);
  const uidMap = await mapUidsToPublicIds(uidCandidates);
  const profRows = uidCandidates.length > 0 ? await db.select({ userUid: profiles.userUid, displayName: profiles.displayName }).from(profiles).where(inArray(profiles.userUid, Array.from(new Set(uidCandidates)))) : [];
  const nameMap = new Map(profRows.map((p) => [p.userUid, p.displayName]));
  return rows.map((r) => ({
    ...r,
    creatorUid: uidMap[r.creatorUid] || r.creatorUid,
    creatorName: nameMap.get(r.creatorUid) || "Player",
    reviewedByPublicId: r.reviewedByUid ? uidMap[r.reviewedByUid] || r.reviewedByUid : null,
    submittedAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null
  }));
}
async function adminUpdateCustomGift(params) {
  const [existing] = await db.select().from(customGifts).where(eq2(customGifts.id, params.id));
  if (!existing) throw new Error("Custom gift submission not found.");
  const patch = { updatedAt: /* @__PURE__ */ new Date() };
  if (typeof params.updates.name === "string" && params.updates.name.trim()) {
    patch.name = params.updates.name.trim().slice(0, 60);
  }
  if (typeof params.updates.cost === "number" && Number.isFinite(params.updates.cost)) {
    patch.cost = Math.max(10, Math.min(1e6, Math.floor(params.updates.cost)));
  }
  if (typeof params.updates.charmValue === "number" && Number.isFinite(params.updates.charmValue)) {
    patch.charmValue = Math.max(1, Math.min(2e6, Math.floor(params.updates.charmValue)));
  }
  if (typeof params.updates.rarity === "string" && ["Standard", "Signature", "Mythic"].includes(params.updates.rarity)) {
    patch.rarity = params.updates.rarity;
  }
  if (typeof params.updates.description === "string" && params.updates.description.trim()) {
    patch.description = params.updates.description.trim().slice(0, 240);
  }
  if (typeof params.updates.primaryColor === "string" && params.updates.primaryColor.trim()) {
    patch.primaryColor = params.updates.primaryColor.trim().slice(0, 24);
  }
  if (typeof params.updates.secondaryColor === "string" && params.updates.secondaryColor.trim()) {
    patch.secondaryColor = params.updates.secondaryColor.trim().slice(0, 24);
  }
  if (typeof params.updates.particleStyle === "string" && params.updates.particleStyle.trim()) {
    patch.particleStyle = params.updates.particleStyle.trim().slice(0, 24);
  }
  if (params.updates.artworkUrl !== void 0) {
    patch.artworkUrl = params.updates.artworkUrl ? String(params.updates.artworkUrl).slice(0, 4e5) : null;
  }
  const [updated] = await db.update(customGifts).set(patch).where(eq2(customGifts.id, params.id)).returning();
  if (updated.approvedGiftId) {
    await db.update(gifts).set({
      name: updated.name,
      cost: updated.cost,
      charmValue: updated.charmValue,
      rarity: updated.rarity,
      description: updated.description,
      primaryColor: updated.primaryColor,
      secondaryColor: updated.secondaryColor,
      particleStyle: updated.particleStyle,
      artworkUrl: updated.artworkUrl,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(gifts.id, updated.approvedGiftId));
  }
  await db.insert(auditLogs).values({
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    action: "admin_edit_custom_gift",
    targetType: "custom_gift",
    targetId: updated.id,
    details: patch
  });
  return updated;
}
async function adminApproveCustomGift(params) {
  const now = /* @__PURE__ */ new Date();
  return db.transaction(async (tx) => {
    const [sub] = await tx.select().from(customGifts).where(eq2(customGifts.id, params.id)).for("update");
    if (!sub) throw new Error("Custom gift submission not found.");
    const resolvedName = typeof params.name === "string" && params.name.trim() ? params.name.trim().slice(0, 60) : sub.name;
    const resolvedCost = typeof params.cost === "number" && Number.isFinite(params.cost) ? Math.max(10, Math.min(1e6, Math.floor(params.cost))) : sub.cost;
    const resolvedCharm = typeof params.charmValue === "number" && Number.isFinite(params.charmValue) ? Math.max(1, Math.min(2e6, Math.floor(params.charmValue))) : sub.charmValue;
    const resolvedRarity = typeof params.rarity === "string" && ["Standard", "Signature", "Mythic"].includes(params.rarity) ? params.rarity : sub.rarity;
    const resolvedDescription = typeof params.description === "string" && params.description.trim() ? params.description.trim().slice(0, 240) : sub.description;
    const giftId = sub.approvedGiftId || `gift-cg-${sub.id.toLowerCase()}`;
    const maxGiftRow = await tx.select({ maxNum: sql`COALESCE(MAX(${gifts.giftNumber}), 900)` }).from(gifts);
    const nextGiftNumber = Math.max(901, Number(maxGiftRow[0]?.maxNum ?? 900) + 1);
    const randomCoinsMin = Math.max(5, Math.round(resolvedCost * 0.08));
    const randomCoinsMax = Math.max(15, Math.round(resolvedCost * 0.2));
    const [approvedGift] = await tx.insert(gifts).values({
      id: giftId,
      name: resolvedName,
      cost: resolvedCost,
      charmValue: resolvedCharm,
      randomCoinsMin,
      randomCoinsMax,
      rarity: resolvedRarity,
      primaryColor: sub.primaryColor,
      secondaryColor: sub.secondaryColor,
      description: resolvedDescription,
      particleStyle: sub.particleStyle,
      giftNumber: nextGiftNumber,
      artworkUrl: sub.artworkUrl,
      animationUrl: sub.animationVideoUrl,
      active: true,
      updatedAt: now
    }).onConflictDoUpdate({
      target: gifts.id,
      set: {
        name: resolvedName,
        cost: resolvedCost,
        charmValue: resolvedCharm,
        randomCoinsMin,
        randomCoinsMax,
        rarity: resolvedRarity,
        primaryColor: sub.primaryColor,
        secondaryColor: sub.secondaryColor,
        description: resolvedDescription,
        particleStyle: sub.particleStyle,
        artworkUrl: sub.artworkUrl,
        animationUrl: sub.animationVideoUrl,
        active: true,
        updatedAt: now
      }
    }).returning();
    const [updatedSub] = await tx.update(customGifts).set({
      name: resolvedName,
      cost: resolvedCost,
      charmValue: resolvedCharm,
      rarity: resolvedRarity,
      description: resolvedDescription,
      status: "approved",
      approvedGiftId: giftId,
      reviewedByUid: params.actorUid,
      reviewNote: params.reviewNote?.trim() || "Approved for OG VELOCITY Gift Store",
      reviewedAt: now,
      updatedAt: now
    }).where(eq2(customGifts.id, sub.id)).returning();
    await tx.insert(notifications).values({
      userUid: sub.creatorUid,
      type: "gift",
      title: "Custom Gift Approved!",
      body: `Your custom gift "${resolvedName}" was approved by Admin and is now live in the Gift Store.`
    });
    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: "admin_approve_custom_gift",
      targetType: "custom_gift",
      targetId: sub.id,
      details: { approvedGiftId: giftId, name: resolvedName, cost: resolvedCost }
    });
    return { submission: updatedSub, catalogGiftId: giftId, gift: approvedGift };
  });
}
async function adminRejectCustomGift(params) {
  const now = /* @__PURE__ */ new Date();
  const note = (params.reviewNote || "").trim() || "Declined during Admin gift review.";
  return db.transaction(async (tx) => {
    const [sub] = await tx.select().from(customGifts).where(eq2(customGifts.id, params.id)).for("update");
    if (!sub) throw new Error("Custom gift submission not found.");
    if (sub.approvedGiftId) {
      await tx.update(gifts).set({ active: false, updatedAt: now }).where(eq2(gifts.id, sub.approvedGiftId));
    }
    const [updated] = await tx.update(customGifts).set({
      status: "rejected",
      reviewedByUid: params.actorUid,
      reviewNote: note,
      reviewedAt: now,
      updatedAt: now
    }).where(eq2(customGifts.id, sub.id)).returning();
    await tx.insert(notifications).values({
      userUid: sub.creatorUid,
      type: "gift",
      title: "Custom Gift Not Approved",
      body: `Your gift submission "${sub.name}" was not approved: ${note}`
    });
    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: "admin_reject_custom_gift",
      targetType: "custom_gift",
      targetId: sub.id,
      details: { reason: note }
    });
    return updated;
  });
}
async function listShopItems(includeInactive = false) {
  await ensureSeedData();
  const rows = includeInactive ? await db.select().from(shopItems).orderBy(asc(shopItems.sortOrder), asc(shopItems.id)) : await db.select().from(shopItems).where(eq2(shopItems.active, true)).orderBy(asc(shopItems.sortOrder), asc(shopItems.id));
  return rows.map((r) => ({
    ...r,
    priceCoins: Number(r.priceCoins),
    durationDays: r.durationDays ?? void 0,
    imageUrl: r.imageUrl ?? void 0,
    ringNumber: r.ringNumber ?? void 0,
    seatFrameNumber: r.seatFrameNumber ?? void 0,
    styleVariant: r.styleVariant ?? void 0
  }));
}
async function upsertShopItem(params) {
  await ensureSeedData();
  const name = String(params.item.name || "").trim().slice(0, 80);
  if (!name) throw new Error("Item name is required.");
  const allowedCategories = /* @__PURE__ */ new Set(["ring", "frame", "bubble", "entry", "seat-fx", "room-theme"]);
  const category = allowedCategories.has(params.item.category) ? params.item.category : "ring";
  const priceCoins = Math.max(0, Math.floor(Number(params.item.priceCoins ?? 1e5)));
  const durationDays = params.item.durationDays === null || params.item.durationDays === void 0 || Number(params.item.durationDays) <= 0 ? null : Math.max(1, Math.min(3650, Math.floor(Number(params.item.durationDays))));
  let imageUrl = params.item.imageUrl ? String(params.item.imageUrl).trim() : null;
  if (imageUrl) {
    const valid = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(imageUrl) || imageUrl.startsWith("https://");
    if (!valid || imageUrl.length > 9e5) {
      throw new Error("Item image must be a valid image under 900KB or HTTPS URL.");
    }
  }
  let ringNumber = params.item.ringNumber ? Math.max(1, Math.floor(Number(params.item.ringNumber))) : null;
  let seatFrameNumber = params.item.seatFrameNumber ? Math.max(1, Math.floor(Number(params.item.seatFrameNumber))) : null;
  if (category === "ring" && !ringNumber) {
    const maxRow = await db.select({ maxN: sql`COALESCE(MAX(${shopItems.ringNumber}), 20)` }).from(shopItems).where(eq2(shopItems.category, "ring"));
    ringNumber = Number(maxRow[0]?.maxN ?? 20) + 1;
  }
  if (category === "frame" && !seatFrameNumber) {
    const maxRow = await db.select({ maxN: sql`COALESCE(MAX(${shopItems.seatFrameNumber}), 20)` }).from(shopItems).where(eq2(shopItems.category, "frame"));
    seatFrameNumber = Number(maxRow[0]?.maxN ?? 20) + 1;
  }
  const cleanedId = String(params.item.id || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
  const id = cleanedId || `${category}-${crypto.randomBytes(4).toString("hex")}`;
  const previewColor = String(params.item.previewColor || "#38BDF8").trim().slice(0, 24);
  const description = String(params.item.description || "").trim().slice(0, 240);
  const active = params.item.active !== false;
  const sortOrder = Number.isFinite(Number(params.item.sortOrder)) ? Math.floor(Number(params.item.sortOrder)) : 100;
  const [saved] = await db.insert(shopItems).values({
    id,
    name,
    category,
    description,
    priceCoins,
    durationDays,
    imageUrl,
    previewColor,
    ringNumber,
    seatFrameNumber,
    styleVariant: params.item.styleVariant || null,
    active,
    sortOrder
  }).onConflictDoUpdate({
    target: shopItems.id,
    set: {
      name,
      category,
      description,
      priceCoins,
      durationDays,
      imageUrl: params.item.imageUrl !== void 0 ? imageUrl : sql`${shopItems.imageUrl}`,
      previewColor,
      ringNumber,
      seatFrameNumber,
      styleVariant: params.item.styleVariant ?? null,
      active,
      sortOrder,
      updatedAt: /* @__PURE__ */ new Date()
    }
  }).returning();
  await db.insert(auditLogs).values({
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    action: "upsert_shop_item",
    targetType: "shop_item",
    targetId: saved.id,
    details: { name: saved.name, category: saved.category, priceCoins: Number(saved.priceCoins), active: saved.active }
  });
  return {
    ...saved,
    priceCoins: Number(saved.priceCoins),
    durationDays: saved.durationDays ?? void 0,
    imageUrl: saved.imageUrl ?? void 0,
    ringNumber: saved.ringNumber ?? void 0,
    seatFrameNumber: saved.seatFrameNumber ?? void 0,
    styleVariant: saved.styleVariant ?? void 0
  };
}
async function deleteShopItem(params) {
  const [deleted] = await db.delete(shopItems).where(eq2(shopItems.id, params.id)).returning();
  if (!deleted) throw new Error("Shop item not found.");
  await db.insert(auditLogs).values({
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    action: "delete_shop_item",
    targetType: "shop_item",
    targetId: params.id,
    details: { name: deleted.name, category: deleted.category }
  });
  return deleted;
}
async function getActiveUserBans(userUid) {
  const rows = await db.select().from(userBans).where(and(eq2(userBans.userUid, userUid), eq2(userBans.active, true))).orderBy(desc(userBans.createdAt));
  const now = Date.now();
  const active = [];
  const expiredCompleteIds = [];
  for (const row of rows) {
    if (row.expiresAt && row.expiresAt.getTime() <= now) {
      await db.update(userBans).set({ active: false, revokedAt: /* @__PURE__ */ new Date(), revokedByUid: "system-expiry" }).where(eq2(userBans.id, row.id)).catch(() => {
      });
      if (row.banType === "complete") expiredCompleteIds.push(row.id);
      continue;
    }
    active.push({
      id: row.id,
      banType: row.banType,
      durationDays: row.durationDays,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      reason: row.reason,
      createdAt: row.createdAt.toISOString()
    });
  }
  if (expiredCompleteIds.length > 0 && !active.some((b) => b.banType === "complete")) {
    await db.update(users).set({ accountStatus: "active", banReason: null, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(users.uid, userUid), eq2(users.accountStatus, "banned"))).catch(() => {
    });
  }
  return active;
}
async function assertUserNotBanned(userUid, types) {
  const activeBans = await getActiveUserBans(userUid);
  const hit = activeBans.find((b) => b.banType === "complete" || types.includes(b.banType));
  if (!hit) return;
  const label = hit.banType === "complete" ? "Account banned" : hit.banType === "mic" ? "Microphone banned" : hit.banType === "seat" ? "Voice Room Seat banned" : "Chat banned";
  const durationMsg = hit.expiresAt ? `until ${new Date(hit.expiresAt).toLocaleDateString()}` : "permanently";
  throw new Error(`${label} ${durationMsg}: ${hit.reason}`);
}
async function createUserBan(params) {
  const allowed = ["complete", "mic", "seat", "chat"];
  if (!allowed.includes(params.banType)) {
    throw new Error("Invalid ban type. Use complete, mic, seat, or chat.");
  }
  const resolved = await resolveUserByUidOrPublicId(params.targetIdentifier);
  if (!resolved) throw new Error("Target user not found.");
  if (resolved.uid === params.actorUid) throw new Error("Cannot ban your own account.");
  if (resolved.role === "super_admin" && params.actorRole !== "super_admin") {
    throw new Error("Cannot ban Super Admin.");
  }
  const cleanReason = params.reason.trim().slice(0, 240) || "Policy violation";
  const daysNum = params.durationDays === null || params.durationDays === void 0 || Number(params.durationDays) <= 0 ? null : Math.max(1, Math.min(3650, Math.floor(Number(params.durationDays))));
  const expiresAt = daysNum ? new Date(Date.now() + daysNum * 864e5) : null;
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(userBans).values({
      userUid: resolved.uid,
      banType: params.banType,
      durationDays: daysNum,
      expiresAt,
      reason: cleanReason,
      bannedByUid: params.actorUid,
      active: true
    }).returning();
    if (params.banType === "complete") {
      await tx.update(users).set({ accountStatus: "banned", banReason: cleanReason, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.uid, resolved.uid));
    }
    await tx.insert(notifications).values({
      userUid: resolved.uid,
      type: "system",
      title: `Account Restriction Applied (${params.banType.toUpperCase()})`,
      body: `${params.banType.toUpperCase()} ban applied ${daysNum ? `for ${daysNum} day(s)` : "permanently"}: ${cleanReason}`
    });
    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: `ban_user_${params.banType}`,
      targetType: "user",
      targetId: resolved.uid,
      details: { banType: params.banType, durationDays: daysNum, reason: cleanReason, banId: row.id }
    });
    return row;
  });
  return { ban: created, targetUid: resolved.uid, targetPublicId: resolved.publicId };
}
async function revokeUserBan(params) {
  const [ban] = await db.select().from(userBans).where(eq2(userBans.id, params.banId));
  if (!ban) throw new Error("Ban record not found.");
  await db.transaction(async (tx) => {
    await tx.update(userBans).set({ active: false, revokedByUid: params.actorUid, revokedAt: /* @__PURE__ */ new Date() }).where(eq2(userBans.id, ban.id));
    if (ban.banType === "complete") {
      const remaining = await tx.select({ id: userBans.id }).from(userBans).where(
        and(
          eq2(userBans.userUid, ban.userUid),
          eq2(userBans.banType, "complete"),
          eq2(userBans.active, true)
        )
      );
      if (remaining.length === 0) {
        await tx.update(users).set({ accountStatus: "active", banReason: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.uid, ban.userUid));
      }
    }
    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: `revoke_ban_${ban.banType}`,
      targetType: "user",
      targetId: ban.userUid,
      details: { banId: ban.id }
    });
  });
  return ban;
}
async function listUserBans(params) {
  const conds = [];
  if (params?.userUid) conds.push(eq2(userBans.userUid, params.userUid));
  if (params?.activeOnly) conds.push(eq2(userBans.active, true));
  const rows = conds.length > 0 ? await db.select().from(userBans).where(and(...conds)).orderBy(desc(userBans.createdAt)).limit(100) : await db.select().from(userBans).orderBy(desc(userBans.createdAt)).limit(100);
  const allUids = Array.from(new Set(rows.flatMap((r) => [r.userUid, r.bannedByUid])));
  const uidMap = await mapUidsToPublicIds(allUids);
  const profRows = allUids.length > 0 ? await db.select({ userUid: profiles.userUid, displayName: profiles.displayName }).from(profiles).where(inArray(profiles.userUid, allUids)) : [];
  const nameMap = new Map(profRows.map((p) => [p.userUid, p.displayName]));
  return rows.map((r) => ({
    ...r,
    userPublicId: uidMap[r.userUid] || r.userUid,
    userName: nameMap.get(r.userUid) || "Player",
    bannedByPublicId: uidMap[r.bannedByUid] || r.bannedByUid,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString()
  }));
}
async function getReferralSummaryForUser(userUid) {
  const [[selfUser], rows] = await Promise.all([
    db.select({ publicId: users.publicId, referredByUid: users.referredByUid }).from(users).where(eq2(users.uid, userUid)),
    db.select().from(referrals).where(eq2(referrals.inviterUid, userUid)).orderBy(desc(referrals.createdAt)).limit(50)
  ]);
  const invitedUids = rows.map((r) => r.invitedUid);
  const allLookupUids = selfUser?.referredByUid ? [...invitedUids, selfUser.referredByUid] : invitedUids;
  const uidMap = await mapUidsToPublicIds(allLookupUids);
  const profRows = invitedUids.length > 0 ? await db.select({ userUid: profiles.userUid, displayName: profiles.displayName }).from(profiles).where(inArray(profiles.userUid, invitedUids)) : [];
  const nameMap = new Map(profRows.map((p) => [p.userUid, p.displayName]));
  return {
    inviteCode: selfUser?.publicId || "",
    rewardCoins: REFERRAL_REWARD_COINS,
    referredByPublicId: selfUser?.referredByUid ? uidMap[selfUser.referredByUid] || null : null,
    totalInvited: rows.length,
    totalEarnedCoins: rows.reduce((sum, r) => sum + Number(r.rewardCoins || 0), 0),
    referrals: rows.map((r) => ({
      id: r.id,
      invitedPublicId: uidMap[r.invitedUid] || r.invitedUid,
      invitedName: nameMap.get(r.invitedUid) || "OG Player",
      rewardCoins: Number(r.rewardCoins || REFERRAL_REWARD_COINS),
      createdAt: r.createdAt.toISOString()
    }))
  };
}
async function claimReferralCodeAtomic(params) {
  const cleanCode = String(params.inviteCode || "").trim().replace(/^#/, "");
  if (!cleanCode) throw new Error("Referral code is required.");
  const inviter = await resolveUserByUidOrPublicId(cleanCode);
  if (!inviter) throw new Error("Invalid invite code. Inviter User ID not found.");
  if (inviter.uid === params.invitedUid) {
    throw new Error("You cannot claim your own referral invite code.");
  }
  if (inviter.accountStatus !== "active") {
    throw new Error("Inviter account is not active.");
  }
  return db.transaction(async (tx) => {
    const orderedUids = [inviter.uid, params.invitedUid].sort();
    const lockedUsers = await tx.select({ uid: users.uid, publicId: users.publicId, referredByUid: users.referredByUid }).from(users).where(inArray(users.uid, orderedUids)).orderBy(asc(users.uid)).for("update");
    const invitedUser = lockedUsers.find((u) => u.uid === params.invitedUid);
    if (!invitedUser) throw new Error("Your account could not be verified.");
    const existingRef = await tx.select({ id: referrals.id }).from(referrals).where(eq2(referrals.invitedUid, params.invitedUid)).limit(1);
    if (invitedUser.referredByUid || existingRef.length > 0) {
      throw new Error("Referral invite reward has already been claimed on your account.");
    }
    const reward = REFERRAL_REWARD_COINS;
    await tx.insert(referrals).values({
      inviterUid: inviter.uid,
      invitedUid: params.invitedUid,
      inviteCode: inviter.publicId,
      rewardCoins: reward
    });
    await tx.update(users).set({ referredByUid: inviter.uid, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.uid, params.invitedUid));
    const walletRows = await tx.select().from(wallets).where(inArray(wallets.userUid, orderedUids)).orderBy(asc(wallets.userUid)).for("update");
    const now = /* @__PURE__ */ new Date();
    const updatedCoinsMap = {};
    for (const targetUid of orderedUids) {
      const existingWallet = walletRows.find((w) => w.userUid === targetUid);
      const nextCoins = Number(existingWallet?.coins ?? 0) + reward;
      updatedCoinsMap[targetUid] = nextCoins;
      if (existingWallet) {
        await tx.update(wallets).set({ coins: nextCoins, updatedAt: now }).where(eq2(wallets.userUid, targetUid));
      } else {
        await tx.insert(wallets).values({ userUid: targetUid, coins: nextCoins });
      }
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        userUid: targetUid,
        type: "referral_reward",
        amount: reward,
        balanceAfter: nextCoins,
        referenceType: "referral",
        referenceId: `${inviter.publicId}->${invitedUser.publicId}`,
        idempotencyKey: `ref:${targetUid}:${params.invitedUid}`,
        description: targetUid === inviter.uid ? `Friend invite bonus for inviting ${invitedUser.publicId}` : `Welcome invite bonus from ${inviter.publicId}`
      });
    }
    await tx.insert(notifications).values([
      {
        userUid: inviter.uid,
        type: "friend",
        title: "+25,000 Referral Coins Credited!",
        body: `Your invited friend (${invitedUser.publicId}) claimed your invite link! +25,000 coins added to your wallet.`
      },
      {
        userUid: params.invitedUid,
        type: "friend",
        title: "+25,000 Invite Welcome Bonus!",
        body: `Referral code ${inviter.publicId} verified! +25,000 coins added to your wallet.`
      }
    ]);
    return {
      rewardCoins: reward,
      inviterUid: inviter.uid,
      inviterPublicId: inviter.publicId,
      inviterCoins: updatedCoinsMap[inviter.uid],
      invitedCoins: updatedCoinsMap[params.invitedUid]
    };
  });
}
var MIN_WITHDRAWAL_COINS = 1e4;
function parsePayoutDetails(raw) {
  const parts = String(raw || "").split(" | ");
  return {
    upiOrAccount: (parts[0] || "").trim(),
    ifscOrBank: parts[1] ? parts[1].trim() : null
  };
}
async function createWithdrawalRequestAtomic(params) {
  const amountCoins = Math.floor(Number(params.amountCoins || 0));
  if (!Number.isFinite(amountCoins) || amountCoins < MIN_WITHDRAWAL_COINS) {
    throw new Error(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_COINS.toLocaleString()} coins.`);
  }
  const holder = String(params.accountHolderName || "").trim().slice(0, 80);
  const destination = String(params.upiOrAccount || "").trim().slice(0, 120);
  const ifscOrBank = params.ifscOrBank ? String(params.ifscOrBank).trim().slice(0, 80) : null;
  if (holder.length < 2 || destination.length < 4) {
    throw new Error("Account holder name and UPI ID / Bank account number are required.");
  }
  const payoutMethod = params.payoutMethod === "bank" ? "bank" : "upi";
  const amountInr = Math.max(1, Math.floor(amountCoins / 100));
  const upiOrBankDetails = ifscOrBank ? `${destination} | ${ifscOrBank}` : destination;
  const requestId = `WDR-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const now = /* @__PURE__ */ new Date();
  return db.transaction(async (tx) => {
    const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, params.userUid)).for("update");
    if (wallet?.isFrozen) {
      throw new Error("Your wallet is currently frozen. Withdrawals are suspended.");
    }
    if (!wallet || Number(wallet.coins) < amountCoins) {
      throw new Error("INSUFFICIENT_COINS");
    }
    const nextCoins = Number(wallet.coins) - amountCoins;
    await tx.update(wallets).set({ coins: nextCoins, updatedAt: now }).where(eq2(wallets.userUid, params.userUid));
    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      userUid: params.userUid,
      type: "withdrawal_hold",
      amount: -amountCoins,
      balanceAfter: nextCoins,
      referenceType: "withdrawal",
      referenceId: requestId,
      idempotencyKey: `wdr-hold-${requestId}`,
      description: `Withdrawal request ${requestId} (${payoutMethod.toUpperCase()} \xB7 ${holder})`
    });
    const [created] = await tx.insert(withdrawalRequests).values({
      requestId,
      userUid: params.userUid,
      coinsAmount: amountCoins,
      inrAmount: amountInr,
      payoutMethod,
      accountHolderName: holder,
      upiOrBankDetails,
      status: "pending"
    }).returning();
    await tx.insert(notifications).values({
      userUid: params.userUid,
      type: "payment",
      title: "Withdrawal Request Submitted",
      body: `Withdrawal ${requestId} for ${amountCoins.toLocaleString()} coins (\u20B9${amountInr}) is pending Admin review.`,
      metadata: { requestId, amountCoins, amountInr }
    });
    return {
      request: {
        ...created,
        amountCoins: Number(created.coinsAmount),
        amountInr: Number(created.inrAmount),
        upiOrAccount: destination,
        ifscOrBank,
        createdAt: created.createdAt.toISOString(),
        reviewedAt: created.reviewedAt ? created.reviewedAt.toISOString() : null
      },
      coins: nextCoins
    };
  });
}
async function listUserWithdrawals(userUid) {
  const rows = await db.select().from(withdrawalRequests).where(eq2(withdrawalRequests.userUid, userUid)).orderBy(desc(withdrawalRequests.createdAt)).limit(40);
  return rows.map((r) => {
    const parsed = parsePayoutDetails(r.upiOrBankDetails);
    return {
      requestId: r.requestId,
      userUid: r.userUid,
      amountCoins: Number(r.coinsAmount),
      amountInr: Number(r.inrAmount),
      payoutMethod: r.payoutMethod,
      accountHolderName: r.accountHolderName,
      upiOrAccount: parsed.upiOrAccount,
      ifscOrBank: parsed.ifscOrBank,
      status: r.status,
      reviewNote: r.reviewNote,
      reviewedByUid: r.reviewedByUid,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null
    };
  });
}
async function adminListWithdrawals(statusFilter) {
  const rows = statusFilter && ["pending", "approved", "completed", "rejected"].includes(statusFilter) ? await db.select({
    id: withdrawalRequests.id,
    requestId: withdrawalRequests.requestId,
    userUid: withdrawalRequests.userUid,
    userPublicId: users.publicId,
    userName: profiles.displayName,
    walletFrozen: wallets.isFrozen,
    walletCoins: wallets.coins,
    coinsAmount: withdrawalRequests.coinsAmount,
    inrAmount: withdrawalRequests.inrAmount,
    payoutMethod: withdrawalRequests.payoutMethod,
    accountHolderName: withdrawalRequests.accountHolderName,
    upiOrBankDetails: withdrawalRequests.upiOrBankDetails,
    status: withdrawalRequests.status,
    reviewNote: withdrawalRequests.reviewNote,
    reviewedByUid: withdrawalRequests.reviewedByUid,
    createdAt: withdrawalRequests.createdAt,
    reviewedAt: withdrawalRequests.reviewedAt
  }).from(withdrawalRequests).leftJoin(users, eq2(withdrawalRequests.userUid, users.uid)).leftJoin(profiles, eq2(withdrawalRequests.userUid, profiles.userUid)).leftJoin(wallets, eq2(withdrawalRequests.userUid, wallets.userUid)).where(eq2(withdrawalRequests.status, statusFilter)).orderBy(desc(withdrawalRequests.createdAt)).limit(100) : await db.select({
    id: withdrawalRequests.id,
    requestId: withdrawalRequests.requestId,
    userUid: withdrawalRequests.userUid,
    userPublicId: users.publicId,
    userName: profiles.displayName,
    walletFrozen: wallets.isFrozen,
    walletCoins: wallets.coins,
    coinsAmount: withdrawalRequests.coinsAmount,
    inrAmount: withdrawalRequests.inrAmount,
    payoutMethod: withdrawalRequests.payoutMethod,
    accountHolderName: withdrawalRequests.accountHolderName,
    upiOrBankDetails: withdrawalRequests.upiOrBankDetails,
    status: withdrawalRequests.status,
    reviewNote: withdrawalRequests.reviewNote,
    reviewedByUid: withdrawalRequests.reviewedByUid,
    createdAt: withdrawalRequests.createdAt,
    reviewedAt: withdrawalRequests.reviewedAt
  }).from(withdrawalRequests).leftJoin(users, eq2(withdrawalRequests.userUid, users.uid)).leftJoin(profiles, eq2(withdrawalRequests.userUid, profiles.userUid)).leftJoin(wallets, eq2(withdrawalRequests.userUid, wallets.userUid)).orderBy(desc(withdrawalRequests.createdAt)).limit(100);
  return rows.map((r) => {
    const parsed = parsePayoutDetails(r.upiOrBankDetails);
    return {
      requestId: r.requestId,
      userUid: r.userUid,
      userPublicId: r.userPublicId,
      userName: r.userName,
      walletFrozen: Boolean(r.walletFrozen),
      walletCoins: Number(r.walletCoins ?? 0),
      amountCoins: Number(r.coinsAmount),
      amountInr: Number(r.inrAmount),
      payoutMethod: r.payoutMethod,
      accountHolderName: r.accountHolderName,
      upiOrAccount: parsed.upiOrAccount,
      ifscOrBank: parsed.ifscOrBank,
      status: r.status,
      reviewNote: r.reviewNote,
      reviewedByUid: r.reviewedByUid,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null
    };
  });
}
async function adminReviewWithdrawalAtomic(params) {
  const now = /* @__PURE__ */ new Date();
  return db.transaction(async (tx) => {
    const [reqRow] = await tx.select().from(withdrawalRequests).where(eq2(withdrawalRequests.requestId, params.requestId)).for("update");
    if (!reqRow) throw new Error("Withdrawal request not found.");
    if (reqRow.status === "rejected" || reqRow.status === "completed") {
      throw new Error(`Withdrawal already finalized as ${reqRow.status}.`);
    }
    const nextStatus = params.action === "reject" ? "rejected" : params.action === "complete" ? "completed" : "approved";
    const note = params.reviewNote?.trim() || (nextStatus === "rejected" ? "Rejected by Admin \xB7 Coins refunded" : nextStatus === "completed" ? "Payout completed" : "Approved for payout");
    const [updated] = await tx.update(withdrawalRequests).set({
      status: nextStatus,
      reviewedByUid: params.adminUid,
      reviewNote: note,
      reviewedAt: now
    }).where(eq2(withdrawalRequests.requestId, params.requestId)).returning();
    const coinsVal = Number(reqRow.coinsAmount);
    const inrVal = Number(reqRow.inrAmount);
    if (nextStatus === "rejected") {
      const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, reqRow.userUid)).for("update");
      const nextCoins = Number(wallet?.coins ?? 0) + coinsVal;
      await tx.update(wallets).set({ coins: nextCoins, updatedAt: now }).where(eq2(wallets.userUid, reqRow.userUid));
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        userUid: reqRow.userUid,
        type: "withdrawal_refund",
        amount: coinsVal,
        balanceAfter: nextCoins,
        referenceType: "withdrawal",
        referenceId: reqRow.requestId,
        idempotencyKey: `wdr-refund-${reqRow.requestId}`,
        description: `Withdrawal rejected (${reqRow.requestId}) \xB7 Coins refunded`,
        actorUid: params.adminUid
      });
    }
    await tx.insert(notifications).values({
      userUid: reqRow.userUid,
      type: "payment",
      title: `Withdrawal ${nextStatus.toUpperCase()}`,
      body: nextStatus === "rejected" ? `Withdrawal ${reqRow.requestId} was rejected (${note}). ${coinsVal.toLocaleString()} coins refunded.` : `Withdrawal ${reqRow.requestId} (${coinsVal.toLocaleString()} coins / \u20B9${inrVal}) is now ${nextStatus}.`,
      metadata: { requestId: reqRow.requestId, status: nextStatus }
    });
    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: `withdrawal_${nextStatus}`,
      targetType: "withdrawal",
      targetId: reqRow.requestId,
      details: { targetUid: reqRow.userUid, amountCoins: coinsVal, note }
    });
    const parsed = parsePayoutDetails(updated.upiOrBankDetails);
    return {
      ...updated,
      amountCoins: Number(updated.coinsAmount),
      amountInr: Number(updated.inrAmount),
      upiOrAccount: parsed.upiOrAccount,
      ifscOrBank: parsed.ifscOrBank
    };
  });
}
async function adminToggleWalletFreeze(params) {
  const resolved = await resolveUserByUidOrPublicId(params.targetIdentifier);
  if (!resolved) throw new Error("Target user not found.");
  const now = /* @__PURE__ */ new Date();
  const cleanReason = (params.reason || "").trim().slice(0, 200) || (params.freeze ? "Admin security hold" : "Wallet unfrozen");
  await db.transaction(async (tx) => {
    await tx.update(wallets).set({ isFrozen: params.freeze, updatedAt: now }).where(eq2(wallets.userUid, resolved.uid));
    await tx.insert(notifications).values({
      userUid: resolved.uid,
      type: "system",
      title: params.freeze ? "Wallet Frozen" : "Wallet Unfrozen",
      body: params.freeze ? `Your coin wallet has been frozen by Admin: ${cleanReason}` : "Your coin wallet has been unfrozen and normal transactions are restored."
    });
    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: params.freeze ? "freeze_wallet" : "unfreeze_wallet",
      targetType: "wallet",
      targetId: resolved.uid,
      details: { publicId: resolved.publicId, freeze: params.freeze, reason: cleanReason }
    });
  });
  return { uid: resolved.uid, publicId: resolved.publicId, isFrozen: params.freeze };
}
async function getUserRelationshipTags(uid, opts) {
  const conds = [or(eq2(relationshipTags.userAUid, uid), eq2(relationshipTags.userBUid, uid))];
  if (opts?.activeOnly) conds.push(eq2(relationshipTags.status, "active"));
  else conds.push(or(eq2(relationshipTags.status, "active"), eq2(relationshipTags.status, "pending")));
  const [rows, activeCpRows] = await Promise.all([
    db.select().from(relationshipTags).where(and(...conds)).orderBy(desc(relationshipTags.charmScore), desc(relationshipTags.createdAt)).limit(40),
    db.select().from(cpRelationships).where(
      and(
        eq2(cpRelationships.status, "active"),
        or(eq2(cpRelationships.userAUid, uid), eq2(cpRelationships.userBUid, uid))
      )
    ).limit(1)
  ]);
  const nonLoverRows = rows.filter(
    (r) => r.tagType !== "lover" && r.tagType !== "cp_partner"
  );
  const activeCp = activeCpRows[0];
  const cpPartnerInternalUid = activeCp ? activeCp.userAUid === uid ? activeCp.userBUid : activeCp.userAUid : null;
  const otherUids = Array.from(
    /* @__PURE__ */ new Set([
      ...nonLoverRows.map((r) => r.userAUid === uid ? r.userBUid : r.userAUid),
      ...cpPartnerInternalUid ? [cpPartnerInternalUid] : []
    ])
  );
  if (otherUids.length === 0) return [];
  const partnerRows = await db.select({
    uid: users.uid,
    publicId: users.publicId,
    name: profiles.displayName,
    photoUrl: profiles.photoUrl
  }).from(users).leftJoin(profiles, eq2(users.uid, profiles.userUid)).where(inArray(users.uid, otherUids));
  const map = new Map(partnerRows.map((p) => [p.uid, p]));
  const result = [];
  if (activeCp && cpPartnerInternalUid) {
    const partner = map.get(cpPartnerInternalUid);
    const cpCharm = Number(activeCp.cpCharm ?? 0);
    result.push({
      id: `cp-lover-${activeCp.id}`,
      tagType: "lover",
      partnerUid: partner?.publicId || cpPartnerInternalUid,
      partnerName: partner?.name || `Player ${partner?.publicId || cpPartnerInternalUid}`,
      partnerPhotoUrl: partner?.photoUrl || null,
      status: "active",
      isIncoming: false,
      charmScore: cpCharm,
      level: computeCpLevelFromCharm(cpCharm),
      startedAt: activeCp.startedAt.toISOString()
    });
  }
  for (const r of nonLoverRows) {
    const otherUid = r.userAUid === uid ? r.userBUid : r.userAUid;
    const p = map.get(otherUid);
    const charmScore = Number(r.charmScore ?? 0);
    result.push({
      id: r.id,
      tagType: normalizeRelationshipTagKey(r.tagType),
      partnerUid: p?.publicId || otherUid,
      partnerName: p?.name || `Player ${p?.publicId || otherUid}`,
      partnerPhotoUrl: p?.photoUrl || null,
      status: r.status,
      isIncoming: r.requestedByUid !== uid,
      charmScore,
      level: computeRelationshipTagLevel(charmScore),
      startedAt: (r.status === "active" ? r.updatedAt : r.createdAt).toISOString()
    });
  }
  return result;
}
async function proposeOrActivateRelationshipTag(params) {
  const rawClean = String(params.tagType || "").trim().toLowerCase();
  if (!ALLOWED_RELATIONSHIP_TAGS.includes(rawClean)) {
    throw new Error("Invalid relationship tag. Supported: bro, bestie, sister, soulmate, lover, confident.");
  }
  const cleanTag = normalizeRelationshipTagKey(rawClean);
  if (cleanTag === "lover") {
    throw new Error("Lover Tag is the official CP Partner tag and activates automatically when two players become CP Partners.");
  }
  const target = await resolveUserByUidOrPublicId(params.toIdentifier);
  if (!target) throw new Error("Target player not found.");
  if (target.uid === params.fromUid) throw new Error("Cannot tag yourself.");
  if (await isBlockedBetween(params.fromUid, target.uid)) {
    throw new Error("Cannot create relationship tag while a block is active.");
  }
  const [userA, userB] = [params.fromUid, target.uid].sort();
  const [existing] = await db.select().from(relationshipTags).where(
    and(
      eq2(relationshipTags.userAUid, userA),
      eq2(relationshipTags.userBUid, userB),
      eq2(relationshipTags.tagType, cleanTag)
    )
  );
  if (existing && existing.status === "active") {
    return { saved: existing, targetInternalUid: target.uid, targetPublicId: target.publicId };
  }
  const id = existing?.id || `TAG-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const now = /* @__PURE__ */ new Date();
  const [saved] = await db.insert(relationshipTags).values({
    id,
    userAUid: userA,
    userBUid: userB,
    requestedByUid: params.fromUid,
    tagType: cleanTag,
    status: "pending",
    charmScore: existing?.charmScore ?? 0,
    level: existing?.level ?? 1
  }).onConflictDoUpdate({
    target: relationshipTags.id,
    set: {
      requestedByUid: params.fromUid,
      status: "pending",
      updatedAt: now
    }
  }).returning();
  await db.insert(notifications).values({
    userUid: target.uid,
    type: "friend",
    title: "Relationship Tag Invitation",
    body: `You received a ${cleanTag.replace("_", " ").toUpperCase()} relationship tag invitation!`,
    metadata: { tagId: saved.id, tagType: cleanTag }
  });
  return { saved, targetInternalUid: target.uid, targetPublicId: target.publicId };
}
async function respondRelationshipTag(params) {
  const [row] = await db.select().from(relationshipTags).where(eq2(relationshipTags.id, params.tagId));
  if (!row) throw new Error("Relationship tag invitation not found.");
  if (row.userAUid !== params.actorUid && row.userBUid !== params.actorUid) {
    throw new Error("You are not part of this relationship tag.");
  }
  if (row.requestedByUid === params.actorUid && params.accept) {
    throw new Error("Waiting for the invited player to accept.");
  }
  const nextStatus = params.accept ? "active" : "ended";
  const [updated] = await db.update(relationshipTags).set({
    status: nextStatus,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(relationshipTags.id, row.id)).returning();
  return updated;
}
async function endRelationshipTag(params) {
  const [row] = await db.select().from(relationshipTags).where(eq2(relationshipTags.id, params.tagId));
  if (!row) throw new Error("Relationship tag not found.");
  if (row.userAUid !== params.actorUid && row.userBUid !== params.actorUid) {
    throw new Error("Unauthorized.");
  }
  const [updated] = await db.update(relationshipTags).set({ status: "ended", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(relationshipTags.id, row.id)).returning();
  return updated;
}
var ACTION_ROOM_TAG_PRICE_MAP = {
  bro: 5e4,
  bestie: 8e4,
  sister: 1e5,
  soulmate: 15e4,
  confident: 2e5
};
async function purchaseActionRoomTagAtomic(params) {
  const rawClean = String(params.tagType || "").trim().toLowerCase();
  if (!(rawClean in ACTION_ROOM_TAG_PRICE_MAP)) {
    throw new Error("Paid Action Room tags support: bro, bestie, sister, soulmate, confident.");
  }
  const cleanTag = rawClean;
  const priceCoins = ACTION_ROOM_TAG_PRICE_MAP[cleanTag];
  const target = await resolveUserByUidOrPublicId(params.partnerIdentifier);
  if (!target) throw new Error("Target player not found.");
  if (target.uid === params.actorUid) throw new Error("Cannot activate a relationship tag with yourself.");
  if (await isBlockedBetween(params.actorUid, target.uid)) {
    throw new Error("Cannot activate relationship tag while a block is active.");
  }
  const [userA, userB] = [params.actorUid, target.uid].sort();
  const now = /* @__PURE__ */ new Date();
  const cleanIdempotency = params.idempotencyKey ? params.idempotencyKey.trim().slice(0, 120) : void 0;
  return db.transaction(async (tx) => {
    if (cleanIdempotency) {
      const [existingTx] = await tx.select().from(walletTransactions).where(eq2(walletTransactions.idempotencyKey, cleanIdempotency));
      if (existingTx) {
        const [existingTag2] = await tx.select().from(relationshipTags).where(
          and(
            eq2(relationshipTags.userAUid, userA),
            eq2(relationshipTags.userBUid, userB),
            eq2(relationshipTags.tagType, cleanTag)
          )
        );
        if (existingTag2) {
          return {
            saved: existingTag2,
            targetInternalUid: target.uid,
            targetPublicId: target.publicId,
            coinsAfter: Number(existingTx.balanceAfter),
            priceCoins
          };
        }
      }
    }
    const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userUid, params.actorUid)).for("update");
    if (!wallet) throw new Error("Wallet not initialized.");
    if (wallet.isFrozen) throw new Error("Your wallet is currently frozen.");
    const currentCoins = Number(wallet.coins ?? 0);
    if (currentCoins < priceCoins) {
      throw new Error(`Insufficient coins. ${priceCoins.toLocaleString()} coins required to activate ${cleanTag.toUpperCase()} tag.`);
    }
    const [existingTag] = await tx.select().from(relationshipTags).where(
      and(
        eq2(relationshipTags.userAUid, userA),
        eq2(relationshipTags.userBUid, userB),
        eq2(relationshipTags.tagType, cleanTag)
      )
    ).for("update");
    if (existingTag && existingTag.status === "active") {
      throw new Error(`You already have an active ${cleanTag.toUpperCase()} tag with ${target.publicId}.`);
    }
    const coinsAfter = currentCoins - priceCoins;
    await tx.update(wallets).set({
      coins: coinsAfter,
      totalSpentCoins: Number(wallet.totalSpentCoins ?? 0) + priceCoins,
      updatedAt: now
    }).where(eq2(wallets.userUid, params.actorUid));
    const tagId = existingTag?.id || `TAG-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    const [saved] = await tx.insert(relationshipTags).values({
      id: tagId,
      userAUid: userA,
      userBUid: userB,
      requestedByUid: params.actorUid,
      tagType: cleanTag,
      status: "active",
      charmScore: existingTag?.charmScore ?? 0,
      level: existingTag?.level ?? 1,
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: relationshipTags.id,
      set: {
        requestedByUid: params.actorUid,
        status: "active",
        updatedAt: now
      }
    }).returning();
    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      userUid: params.actorUid,
      type: "action_tag_purchase",
      amount: -priceCoins,
      balanceAfter: coinsAfter,
      referenceType: "relationship_tag",
      referenceId: saved.id,
      idempotencyKey: cleanIdempotency || `action-tag-${saved.id}-${Date.now()}`,
      description: `Action Room Tag Activation: ${cleanTag.toUpperCase()} with ${target.publicId}`,
      actorUid: params.actorUid
    });
    await tx.insert(notifications).values({
      userUid: target.uid,
      type: "friend",
      title: "Action Room Tag Activated",
      body: `Your ${cleanTag.toUpperCase()} relationship bond is now active!`,
      metadata: { tagId: saved.id, tagType: cleanTag }
    });
    return {
      saved,
      targetInternalUid: target.uid,
      targetPublicId: target.publicId,
      coinsAfter,
      priceCoins
    };
  });
}

// server/adminRoutes.ts
import crypto2 from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Router } from "express";
import { desc as desc2, eq as eq3, ilike as ilike2, or as or2, sql as sql2 } from "drizzle-orm";
import QRCode2 from "qrcode";
function createAdminRouter(options) {
  const router = Router();
  const requireAdminRole = (allowedRoles, requiredPermission) => {
    return async (req, res, next) => {
      const user = req.authUser;
      if (!user || !ADMIN_PANEL_ROLES.has(user.role)) {
        res.status(403).json({ error: "Admin panel access denied." });
        return;
      }
      if (user.role === "super_admin") {
        next();
        return;
      }
      const roleAllowed = !allowedRoles || allowedRoles.includes(user.role);
      if (roleAllowed) {
        next();
        return;
      }
      if (requiredPermission) {
        const effectivePerms = await getEffectiveAdminPermissions(user.uid, user.role);
        if (effectivePerms.includes("*") || effectivePerms.includes(requiredPermission)) {
          next();
          return;
        }
      }
      res.status(403).json({ error: `Role "${user.role}" does not have permission for this action.` });
    };
  };
  router.use(options.requireAuth, requireAdminRole());
  router.get("/stats", async (_req, res) => {
    try {
      const [
        userCounts,
        vipCounts,
        walletAgg,
        pendingPayments,
        approvedRev,
        giftAgg,
        openReports,
        roomCount,
        eventCount
      ] = await Promise.all([
        db.select({
          total: sql2`COUNT(*)`,
          active: sql2`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'active')`,
          suspended: sql2`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'suspended')`,
          banned: sql2`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'banned')`
        }).from(users),
        db.select({ activeVip: sql2`COUNT(*) FILTER (WHERE ${vipMemberships.vipStatus} = 'active')` }).from(vipMemberships),
        db.select({ totalCoins: sql2`COALESCE(SUM(${wallets.coins}), 0)` }).from(wallets),
        db.select({ count: sql2`COUNT(*)` }).from(paymentOrders).where(eq3(paymentOrders.status, "pending_review")),
        db.select({ inr: sql2`COALESCE(SUM(${paymentOrders.amountInr}), 0)` }).from(paymentOrders).where(eq3(paymentOrders.status, "approved")),
        db.select({ count: sql2`COUNT(*)` }).from(giftTransactions),
        db.select({ count: sql2`COUNT(*)` }).from(reports).where(eq3(reports.status, "open")),
        db.select({ count: sql2`COUNT(*)` }).from(voiceRooms).where(eq3(voiceRooms.status, "active")),
        db.select({ count: sql2`COUNT(*)` }).from(events).where(eq3(events.status, "live"))
      ]);
      res.json({
        ok: true,
        stats: {
          totalUsers: Number(userCounts[0]?.total ?? 0),
          activeUsers: Number(userCounts[0]?.active ?? 0),
          suspendedUsers: Number(userCounts[0]?.suspended ?? 0),
          bannedUsers: Number(userCounts[0]?.banned ?? 0),
          activeVipUsers: Number(vipCounts[0]?.activeVip ?? 0),
          totalCoinsInCirculation: Number(walletAgg[0]?.totalCoins ?? 0),
          pendingPaymentReviews: Number(pendingPayments[0]?.count ?? 0),
          approvedRevenueInr: Number(approvedRev[0]?.inr ?? 0),
          totalGiftTransactions: Number(giftAgg[0]?.count ?? 0),
          openReports: Number(openReports[0]?.count ?? 0),
          totalVoiceRooms: Number(roomCount[0]?.count ?? 0),
          liveEvents: Number(eventCount[0]?.count ?? 0)
        }
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load stats." });
    }
  });
  router.get("/users", async (req, res) => {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
    const rows = await db.select({
      uid: users.uid,
      publicId: users.publicId,
      email: users.email,
      phone: users.phone,
      primaryProvider: users.primaryProvider,
      role: users.role,
      accountStatus: users.accountStatus,
      banReason: users.banReason,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      name: profiles.displayName,
      handle: profiles.handle,
      photoUrl: profiles.photoUrl,
      coins: wallets.coins,
      walletFrozen: wallets.isFrozen,
      vipLevel: vipMemberships.vipLevel,
      vipStatus: vipMemberships.vipStatus,
      vipGrowth: vipMemberships.vipGrowth,
      vipExpiresAt: vipMemberships.expiresAt,
      vipActivatedAt: vipMemberships.activatedAt,
      vipPlanLabel: vipMemberships.planLabel,
      vipCustomBenefits: vipMemberships.customBenefits
    }).from(users).leftJoin(profiles, eq3(users.uid, profiles.userUid)).leftJoin(wallets, eq3(users.uid, wallets.userUid)).leftJoin(vipMemberships, eq3(users.uid, vipMemberships.userUid)).where(
      q ? or2(
        eq3(users.uid, q),
        ilike2(users.publicId, `%${q}%`),
        ilike2(users.email, `%${q}%`),
        ilike2(users.phone, `%${q}%`),
        ilike2(profiles.displayName, `%${q}%`)
      ) : void 0
    ).orderBy(desc2(users.createdAt)).limit(limit);
    res.json({ ok: true, users: rows });
  });
  router.get("/users/:uid/history", async (req, res) => {
    const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
    if (!resolved) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const targetUid = resolved.uid;
    const [walletTx, orders, subHistory, pointLedger, userDetail] = await Promise.all([
      db.select().from(walletTransactions).where(eq3(walletTransactions.userUid, targetUid)).orderBy(desc2(walletTransactions.createdAt)).limit(30),
      db.select().from(paymentOrders).where(eq3(paymentOrders.userUid, targetUid)).orderBy(desc2(paymentOrders.createdAt)).limit(20),
      db.select().from(vipSubscriptionHistory).where(eq3(vipSubscriptionHistory.userUid, targetUid)).orderBy(desc2(vipSubscriptionHistory.createdAt)).limit(25),
      db.select().from(vipPointLedger).where(eq3(vipPointLedger.userUid, targetUid)).orderBy(desc2(vipPointLedger.createdAt)).limit(40),
      getFullUserView(targetUid)
    ]);
    res.json({
      ok: true,
      user: userDetail,
      walletTransactions: walletTx,
      paymentOrders: orders,
      vipSubscriptionHistory: subHistory,
      vipPointLedger: pointLedger
    });
  });
  router.post(
    "/users/:uid/status",
    requireAdminRole(["moderator", "admin", "super_admin"]),
    async (req, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
      const targetUid = resolved?.uid || String(req.params.uid);
      const status = String(req.body?.status || "").toLowerCase();
      const reason = String(req.body?.reason || "").trim();
      if (!["active", "suspended", "banned"].includes(status)) {
        res.status(400).json({ error: "Invalid account status." });
        return;
      }
      if (targetUid === req.authUser.uid) {
        res.status(400).json({ error: "Cannot suspend/ban your own account." });
        return;
      }
      const [targetUser] = await db.select().from(users).where(eq3(users.uid, targetUid));
      if (!targetUser) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      if (targetUser.role === "super_admin" && req.authUser.role !== "super_admin") {
        res.status(403).json({ error: "Cannot change Super Admin status." });
        return;
      }
      await db.transaction(async (tx) => {
        await tx.update(users).set({
          accountStatus: status,
          banReason: status === "active" ? null : reason || "Moderated by Admin",
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(users.uid, targetUid));
        await tx.insert(auditLogs).values({
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          action: `user_status_${status}`,
          targetType: "user",
          targetId: targetUid,
          details: { status, reason }
        });
      });
      const updated = await getFullUserView(targetUid);
      res.json({ ok: true, user: updated });
    }
  );
  router.post(
    "/vip-subscriptions/grant",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      if (req.body?.vipLevel !== void 0 && req.body?.vipLevel !== null) {
        res.status(400).json({
          error: "VIP level selection is forbidden on subscription grants. Subscriptions always start at VIP 1 (or preserve earned progression)."
        });
        return;
      }
      const rawTarget = String(req.body?.targetUserUid || req.body?.targetUid || "").trim();
      const months = Number(req.body?.months);
      const reason = String(req.body?.reason || "").trim();
      if (!rawTarget) {
        res.status(400).json({ error: "Target Public User ID is required." });
        return;
      }
      if (reason.length < 3) {
        res.status(400).json({ error: "Mandatory reason (at least 3 characters) is required." });
        return;
      }
      const resolved = await resolveUserByUidOrPublicId(rawTarget);
      if (!resolved) {
        res.status(404).json({ error: "Target user not found." });
        return;
      }
      try {
        const updated = await adminGrantVipSubscription({
          adminUid: req.authUser.uid,
          adminRole: req.authUser.role,
          targetUserUid: resolved.uid,
          months,
          reason
        });
        options.getRealtimeHub?.()?.sendToUser(resolved.uid, {
          type: "user:refresh",
          user: updated ? sanitizeUserForClient(updated) : null
        });
        res.json({ ok: true, user: updated ? sanitizeUserForClient(updated) : null });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "VIP grant failed." });
      }
    }
  );
  router.get(
    "/vip-subscriptions/overview",
    requireAdminRole(["admin", "super_admin", "support_staff"]),
    async (_req, res) => {
      try {
        const [subRows, ledgerRows, decayConfig] = await Promise.all([
          db.select().from(vipSubscriptionHistory).orderBy(desc2(vipSubscriptionHistory.createdAt)).limit(60),
          db.select().from(vipPointLedger).orderBy(desc2(vipPointLedger.createdAt)).limit(80),
          getVipDecayConfig()
        ]);
        const allUids = Array.from(
          new Set([
            ...subRows.flatMap((r) => [r.userUid, r.actorUid || ""]),
            ...ledgerRows.flatMap((r) => [r.userUid, r.actorUid || ""])
          ].filter(Boolean))
        );
        const uidMap = await mapUidsToPublicIds(allUids);
        const profileRows = allUids.length > 0 ? await db.select({ userUid: profiles.userUid, displayName: profiles.displayName }).from(profiles).where(sql2`${profiles.userUid} = ANY(ARRAY[${sql2.join(allUids.map((u) => sql2`${u}`), sql2`, `)}]::text[])`) : [];
        const nameMap = new Map(profileRows.map((p) => [p.userUid, p.displayName]));
        res.json({
          ok: true,
          decayConfig,
          subscriptionHistory: subRows.map((r) => ({
            ...r,
            userPublicId: uidMap[r.userUid] || r.userUid,
            userName: nameMap.get(r.userUid) || "Player",
            actorPublicId: r.actorUid ? uidMap[r.actorUid] || r.actorUid : null,
            actorName: r.actorUid ? nameMap.get(r.actorUid) || "Admin" : null
          })),
          pointLedger: ledgerRows.map((l) => ({
            ...l,
            userPublicId: uidMap[l.userUid] || l.userUid,
            userName: nameMap.get(l.userUid) || "Player",
            actorPublicId: l.actorUid ? uidMap[l.actorUid] || l.actorUid : null
          }))
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load VIP overview." });
      }
    }
  );
  router.put(
    "/vip-decay-config",
    requireAdminRole(["super_admin"]),
    async (req, res) => {
      if (req.authUser.role !== "super_admin") {
        res.status(403).json({ error: "Only Super Admin can configure VIP point decay settings." });
        return;
      }
      const next = await updateVipDecayConfig(req.authUser.uid, {
        enabled: typeof req.body?.enabled === "boolean" ? req.body.enabled : void 0,
        graceDays: req.body?.graceDays !== void 0 ? Number(req.body.graceDays) : void 0,
        mode: req.body?.mode === "percent" ? "percent" : req.body?.mode === "fixed" ? "fixed" : void 0,
        dailyAmount: req.body?.dailyAmount !== void 0 ? Number(req.body.dailyAmount) : void 0,
        dailyPercent: req.body?.dailyPercent !== void 0 ? Number(req.body.dailyPercent) : void 0
      });
      res.json({ ok: true, decayConfig: next });
    }
  );
  router.post(
    "/vip-decay/run",
    requireAdminRole(["super_admin"]),
    async (req, res) => {
      if (req.authUser.role !== "super_admin") {
        res.status(403).json({ error: "Only Super Admin can manually run the VIP decay sweep." });
        return;
      }
      const summary = await runVipDecaySweep(/* @__PURE__ */ new Date());
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: "super_admin",
        action: "manual_vip_decay_sweep",
        targetType: "vip_decay",
        targetId: "global",
        details: summary
      });
      res.json({ ok: true, summary });
    }
  );
  router.post(
    "/users/:uid/vip",
    requireAdminRole(["admin", "super_admin"], "vip:manage"),
    async (req, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
      if (!resolved) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      const targetUid = resolved.uid;
      const vipStatus = req.body?.vipStatus === "active" ? "active" : "inactive";
      const durationDays = Number(req.body?.durationDays ?? 30);
      const customBenefits = Array.isArray(req.body?.customBenefits) ? req.body.customBenefits.map((b) => String(b).trim()).filter(Boolean) : void 0;
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 3) {
        res.status(400).json({ error: "Mandatory reason (minimum 3 characters) is required for VIP assignment." });
        return;
      }
      const updated = await superAdminSetVip({
        superAdminUid: req.authUser.uid,
        actorRole: req.authUser.role,
        targetUserUid: targetUid,
        vipStatus,
        durationDays,
        customBenefits,
        reason
      });
      options.getRealtimeHub?.()?.sendToUser(targetUid, {
        type: "user:refresh",
        user: updated ? sanitizeUserForClient(updated) : null
      });
      res.json({ ok: true, user: updated ? sanitizeUserForClient(updated) : null });
    }
  );
  router.get(
    "/bans",
    requireAdminRole(["moderator", "admin", "super_admin"], "users:moderate"),
    async (req, res) => {
      try {
        const rawUid = String(req.query.userUid || "").trim();
        let resolvedUid;
        if (rawUid) {
          const found = await resolveUserByUidOrPublicId(rawUid);
          if (!found) {
            res.json({ ok: true, bans: [] });
            return;
          }
          resolvedUid = found.uid;
        }
        const activeOnly = req.query.activeOnly === "true";
        const bans = await listUserBans({ userUid: resolvedUid, activeOnly });
        res.json({ ok: true, bans });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load user bans." });
      }
    }
  );
  router.get(
    "/users/:uid/bans",
    requireAdminRole(["moderator", "admin", "super_admin"], "users:moderate"),
    async (req, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
      if (!resolved) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      const bans = await listUserBans({ userUid: resolved.uid });
      res.json({ ok: true, bans });
    }
  );
  router.post(
    "/users/:uid/bans",
    requireAdminRole(["moderator", "admin", "super_admin"], "users:moderate"),
    async (req, res) => {
      const banType = String(req.body?.banType || "complete").trim().toLowerCase();
      const durationRaw = req.body?.durationDays;
      const durationDays = durationRaw === null || durationRaw === void 0 || durationRaw === "" ? null : Number(durationRaw);
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 2) {
        res.status(400).json({ error: "Ban reason (at least 2 characters) is required." });
        return;
      }
      try {
        const result = await createUserBan({
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          targetIdentifier: String(req.params.uid),
          banType,
          durationDays,
          reason
        });
        const hub = options.getRealtimeHub?.();
        if (hub) {
          await hub.enforceRealtimeBan(result.targetUid, banType, reason);
          const refreshed = await getFullUserView(result.targetUid);
          if (refreshed && banType !== "complete") {
            hub.sendToUser(result.targetUid, {
              type: "user:refresh",
              user: sanitizeUserForClient(refreshed)
            });
          }
        }
        res.json({ ok: true, ban: result.ban, targetPublicId: result.targetPublicId });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to apply ban." });
      }
    }
  );
  const handleRevokeBan = async (req, res) => {
    const banId = Number(req.params.banId);
    if (!Number.isInteger(banId) || banId <= 0) {
      res.status(400).json({ error: "Invalid banId." });
      return;
    }
    try {
      const revoked = await revokeUserBan({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        banId
      });
      const refreshed = await getFullUserView(revoked.userUid);
      if (refreshed) {
        options.getRealtimeHub?.()?.sendToUser(revoked.userUid, {
          type: "user:refresh",
          user: sanitizeUserForClient(refreshed)
        });
      }
      res.json({ ok: true, revoked });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to revoke ban." });
    }
  };
  router.post(
    "/bans/:banId/revoke",
    requireAdminRole(["moderator", "admin", "super_admin"], "users:moderate"),
    handleRevokeBan
  );
  router.delete(
    "/bans/:banId",
    requireAdminRole(["moderator", "admin", "super_admin"], "users:moderate"),
    handleRevokeBan
  );
  router.get("/shop-items", async (_req, res) => {
    try {
      const items = await listShopItems(true);
      res.json({ ok: true, items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load shop items." });
    }
  });
  router.post(
    "/shop-items",
    requireAdminRole(["admin", "super_admin"], "config:manage"),
    async (req, res) => {
      try {
        const saved = await upsertShopItem({
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          item: {
            id: typeof req.body?.id === "string" ? req.body.id : void 0,
            name: String(req.body?.name || ""),
            category: String(req.body?.category || "ring"),
            description: typeof req.body?.description === "string" ? req.body.description : "",
            priceCoins: Number(req.body?.priceCoins ?? 1e5),
            durationDays: req.body?.durationDays === null || req.body?.durationDays === void 0 || req.body?.durationDays === "" ? null : Number(req.body.durationDays),
            imageUrl: typeof req.body?.imageUrl === "string" ? req.body.imageUrl : null,
            previewColor: typeof req.body?.previewColor === "string" ? req.body.previewColor : "#38BDF8",
            ringNumber: req.body?.ringNumber !== void 0 && req.body?.ringNumber !== null ? Number(req.body.ringNumber) : null,
            seatFrameNumber: req.body?.seatFrameNumber !== void 0 && req.body?.seatFrameNumber !== null ? Number(req.body.seatFrameNumber) : null,
            styleVariant: typeof req.body?.styleVariant === "string" ? req.body.styleVariant : null,
            active: req.body?.active !== false,
            sortOrder: req.body?.sortOrder !== void 0 ? Number(req.body.sortOrder) : 100
          }
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: "catalog:updated", kind: "shop" });
        res.json({ ok: true, item: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to save shop item." });
      }
    }
  );
  router.patch(
    "/shop-items/:id",
    requireAdminRole(["admin", "super_admin"], "config:manage"),
    async (req, res) => {
      try {
        const id = String(req.params.id || "").trim();
        const existingList = await listShopItems(true);
        const existing = existingList.find((i) => i.id === id);
        if (!existing) {
          res.status(404).json({ error: "Shop item not found." });
          return;
        }
        const saved = await upsertShopItem({
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          item: {
            id,
            name: typeof req.body?.name === "string" ? req.body.name : existing.name,
            category: typeof req.body?.category === "string" ? req.body.category : existing.category,
            description: typeof req.body?.description === "string" ? req.body.description : existing.description,
            priceCoins: req.body?.priceCoins !== void 0 ? Number(req.body.priceCoins) : existing.priceCoins,
            durationDays: req.body?.durationDays !== void 0 ? req.body.durationDays === null || req.body.durationDays === "" ? null : Number(req.body.durationDays) : existing.durationDays ?? null,
            imageUrl: req.body?.imageUrl !== void 0 ? req.body.imageUrl : void 0,
            previewColor: typeof req.body?.previewColor === "string" ? req.body.previewColor : existing.previewColor,
            ringNumber: req.body?.ringNumber !== void 0 ? req.body.ringNumber ? Number(req.body.ringNumber) : null : existing.ringNumber ?? null,
            seatFrameNumber: req.body?.seatFrameNumber !== void 0 ? req.body.seatFrameNumber ? Number(req.body.seatFrameNumber) : null : existing.seatFrameNumber ?? null,
            styleVariant: typeof req.body?.styleVariant === "string" ? req.body.styleVariant : existing.styleVariant ?? null,
            active: typeof req.body?.active === "boolean" ? req.body.active : existing.active,
            sortOrder: req.body?.sortOrder !== void 0 ? Number(req.body.sortOrder) : existing.sortOrder
          }
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: "catalog:updated", kind: "shop" });
        res.json({ ok: true, item: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update shop item." });
      }
    }
  );
  router.delete(
    "/shop-items/:id",
    requireAdminRole(["admin", "super_admin"], "config:manage"),
    async (req, res) => {
      try {
        const deleted = await deleteShopItem({
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          id: String(req.params.id || "").trim()
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: "catalog:updated", kind: "shop" });
        res.json({ ok: true, deleted });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete shop item." });
      }
    }
  );
  router.post(
    "/wallets/adjust",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const rawTargets = Array.isArray(req.body?.targetUids) ? req.body.targetUids.map((s) => String(s).trim()).filter(Boolean) : req.body?.targetUid ? [String(req.body.targetUid).trim()] : [];
      const resolvedTargets = [];
      for (const rawId of rawTargets) {
        const found = await resolveUserByUidOrPublicId(rawId);
        if (!found) {
          res.status(404).json({ error: `User "${rawId}" not found.` });
          return;
        }
        resolvedTargets.push(found.uid);
      }
      const targetUids = Array.from(new Set(resolvedTargets));
      const deltaCoins = Number(req.body?.deltaCoins);
      const reason = String(req.body?.reason || "").trim();
      if (targetUids.length === 0 || !Number.isInteger(deltaCoins) || deltaCoins === 0) {
        res.status(400).json({ error: "Provide targetUids[] and a non-zero integer deltaCoins." });
        return;
      }
      try {
        const results = await adminAdjustCoinsBatch({
          adminUid: req.authUser.uid,
          adminRole: req.authUser.role,
          targetUids,
          deltaCoins,
          reason: reason || (deltaCoins > 0 ? "Admin Coin Grant" : "Admin Coin Deduction")
        });
        for (const r of results) {
          options.getRealtimeHub?.()?.sendToUser(r.uid, { type: "wallet:updated", coins: r.coins });
        }
        res.json({ ok: true, results });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Coin adjustment failed." });
      }
    }
  );
  router.get("/payments", async (req, res) => {
    const statusFilter = String(req.query.status || "").trim();
    const rows = await db.select({
      orderId: paymentOrders.orderId,
      userUid: paymentOrders.userUid,
      userPublicId: users.publicId,
      userName: profiles.displayName,
      userEmail: users.email,
      userPhone: users.phone,
      orderType: paymentOrders.orderType,
      packageId: paymentOrders.packageId,
      packageName: paymentOrders.packageName,
      amountInr: paymentOrders.amountInr,
      coinsAmount: paymentOrders.coinsAmount,
      grantedVipLevel: paymentOrders.grantedVipLevel,
      vipDurationDays: paymentOrders.vipDurationDays,
      upiIdUsed: paymentOrders.upiIdUsed,
      qrVersionId: paymentOrders.qrVersionId,
      accountNameUsed: paymentOrders.accountNameUsed,
      providerUsed: paymentOrders.providerUsed,
      expiresAt: paymentOrders.expiresAt,
      utrNumber: paymentOrders.utrNumber,
      accountHolderName: paymentOrders.accountHolderName,
      paymentDateTime: paymentOrders.paymentDateTime,
      screenshotDataUrl: paymentOrders.screenshotDataUrl,
      payerNote: paymentOrders.payerNote,
      status: paymentOrders.status,
      reviewedByUid: paymentOrders.reviewedByUid,
      reviewNote: paymentOrders.reviewNote,
      createdAt: paymentOrders.createdAt,
      submittedAt: paymentOrders.submittedAt,
      reviewedAt: paymentOrders.reviewedAt
    }).from(paymentOrders).leftJoin(users, eq3(paymentOrders.userUid, users.uid)).leftJoin(profiles, eq3(paymentOrders.userUid, profiles.userUid)).where(statusFilter ? eq3(paymentOrders.status, statusFilter) : void 0).orderBy(desc2(paymentOrders.createdAt)).limit(100);
    res.json({ ok: true, orders: rows });
  });
  router.get(
    "/withdrawals",
    requireAdminRole(["admin", "super_admin"], "payments:read"),
    async (req, res) => {
      const statusFilter = typeof req.query.status === "string" ? req.query.status : void 0;
      const list = await adminListWithdrawals(statusFilter);
      res.json({ ok: true, withdrawals: list });
    }
  );
  router.post(
    "/withdrawals/:requestId/review",
    requireAdminRole(["admin", "super_admin"], "payments:review"),
    async (req, res) => {
      const requestId = String(req.params.requestId || "").trim();
      const action = req.body?.action === "reject" ? "reject" : req.body?.action === "complete" ? "complete" : "approve";
      const reviewNote = typeof req.body?.reviewNote === "string" ? req.body.reviewNote : void 0;
      try {
        const updated = await adminReviewWithdrawalAtomic({
          adminUid: req.authUser.uid,
          adminRole: req.authUser.role,
          requestId,
          action,
          reviewNote
        });
        const updatedUser = await getFullUserView(updated.userUid);
        options.getRealtimeHub?.()?.sendToUser(updated.userUid, {
          type: "wallet:updated",
          coins: updatedUser?.coins,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null
        });
        res.json({
          ok: true,
          withdrawal: updated,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null
        });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Withdrawal review failed." });
      }
    }
  );
  router.post(
    "/wallets/:uid/freeze",
    requireAdminRole(["admin", "super_admin"], "wallet:adjust"),
    async (req, res) => {
      try {
        const result = await adminToggleWalletFreeze({
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          targetIdentifier: String(req.params.uid || "").trim(),
          freeze: Boolean(req.body?.freeze),
          reason: typeof req.body?.reason === "string" ? req.body.reason : void 0
        });
        const updatedUser = await getFullUserView(result.uid);
        if (updatedUser) {
          options.getRealtimeHub?.()?.sendToUser(result.uid, {
            type: "user:refresh",
            user: sanitizeUserForClient(updatedUser)
          });
        }
        res.json({ ok: true, ...result, user: updatedUser ? sanitizeUserForClient(updatedUser) : null });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update wallet freeze state." });
      }
    }
  );
  router.post(
    "/payments/:orderId/approve",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const orderId = String(req.params.orderId);
      const reviewNote = String(req.body?.reviewNote || "").trim();
      try {
        const order = await approvePaymentOrder({
          adminUid: req.authUser.uid,
          adminRole: req.authUser.role,
          orderId,
          reviewNote
        });
        const updatedUser = await getFullUserView(order.userUid);
        options.getRealtimeHub?.()?.sendToUser(order.userUid, {
          type: "payment:approved",
          order: updatedUser ? { ...order, userUid: updatedUser.publicId, reviewedByUid: null } : order,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null
        });
        res.json({ ok: true, order, user: updatedUser });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Approval failed.";
        const status = msg === "ORDER_ALREADY_APPROVED" ? 409 : 400;
        res.status(status).json({ error: msg });
      }
    }
  );
  router.post(
    "/payments/:orderId/reject",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const orderId = String(req.params.orderId);
      const reviewNote = String(req.body?.reviewNote || "Invalid or unverified payment proof.").trim();
      try {
        const order = await rejectPaymentOrder({
          adminUid: req.authUser.uid,
          adminRole: req.authUser.role,
          orderId,
          reviewNote
        });
        const updatedUser = await getFullUserView(order.userUid);
        options.getRealtimeHub?.()?.sendToUser(order.userUid, {
          type: "payment:rejected",
          order: updatedUser ? { ...order, userUid: updatedUser.publicId, reviewedByUid: null } : order,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null
        });
        res.json({ ok: true, order, user: updatedUser });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Rejection failed." });
      }
    }
  );
  router.get(
    "/upi-config",
    requireAdminRole(["admin", "super_admin"], "payments:qr_manage"),
    async (_req, res) => {
      const cfg = await getPermanentUpiConfig();
      const upiUri = `upi://pay?pa=${encodeURIComponent(cfg.upiId)}&pn=${encodeURIComponent(cfg.accountName)}&cu=INR`;
      const qrDataUrl = cfg.customQrDataUrl || await QRCode2.toDataURL(upiUri, { width: 320, margin: 1 });
      res.json({ ok: true, upiConfig: { ...cfg, upiUri, qrDataUrl } });
    }
  );
  router.get(
    "/upi-config/history",
    requireAdminRole(["admin", "super_admin"], "payments:qr_manage"),
    async (_req, res) => {
      const versions = await getPaymentQrVersions(80);
      res.json({ ok: true, versions });
    }
  );
  router.put(
    "/upi-config",
    requireAdminRole(["super_admin"], "payments:qr_manage"),
    async (req, res) => {
      try {
        const next = await updatePermanentUpiConfig(req.authUser.uid, {
          actorRole: req.authUser.role,
          accountName: typeof req.body?.accountName === "string" ? req.body.accountName : void 0,
          upiId: typeof req.body?.upiId === "string" ? req.body.upiId : void 0,
          provider: typeof req.body?.provider === "string" ? req.body.provider : void 0,
          customQrDataUrl: req.body?.customQrDataUrl === null || typeof req.body?.customQrDataUrl === "string" ? req.body.customQrDataUrl : void 0,
          note: typeof req.body?.note === "string" ? req.body.note : void 0,
          active: typeof req.body?.active === "boolean" ? req.body.active : void 0,
          screens: Array.isArray(req.body?.screens) ? req.body.screens.map(String) : void 0,
          changeSummary: typeof req.body?.changeSummary === "string" ? req.body.changeSummary : void 0
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: "catalog:updated", kind: "upiConfig" });
        res.json({ ok: true, upiConfig: next });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Failed to update UPI QR configuration."
        });
      }
    }
  );
  router.get("/gifts", async (_req, res) => {
    const rows = await db.select().from(gifts).orderBy(gifts.giftNumber);
    res.json({ ok: true, gifts: rows });
  });
  router.post(
    "/gifts",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.body?.id || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "") || `gift-${crypto2.randomBytes(3).toString("hex")}`;
      const name = String(req.body?.name || "").trim();
      const cost = Math.max(1, Math.floor(Number(req.body?.cost || 100)));
      const charmValue = Math.max(1, Math.floor(Number(req.body?.charmValue || cost)));
      if (!name) {
        res.status(400).json({ error: "Gift name is required." });
        return;
      }
      const [saved] = await db.insert(gifts).values({
        id,
        name,
        cost,
        charmValue,
        randomCoinsMin: Math.max(0, Math.floor(Number(req.body?.randomCoinsMin || Math.round(cost * 0.1)))),
        randomCoinsMax: Math.max(0, Math.floor(Number(req.body?.randomCoinsMax || Math.round(cost * 0.5)))),
        rarity: String(req.body?.rarity || "Signature"),
        primaryColor: String(req.body?.primaryColor || "#22D3EE"),
        secondaryColor: String(req.body?.secondaryColor || "#FBBF24"),
        description: String(req.body?.description || "Custom OG VELOCITY gift"),
        particleStyle: String(req.body?.particleStyle || "heart"),
        giftNumber: Math.max(1, Math.floor(Number(req.body?.giftNumber || 10))),
        artworkUrl: typeof req.body?.artworkUrl === "string" ? req.body.artworkUrl : null,
        animationUrl: typeof req.body?.animationUrl === "string" ? req.body.animationUrl : null,
        active: req.body?.active !== false
      }).onConflictDoUpdate({
        target: gifts.id,
        set: {
          name,
          cost,
          charmValue,
          rarity: String(req.body?.rarity || "Signature"),
          primaryColor: String(req.body?.primaryColor || "#22D3EE"),
          secondaryColor: String(req.body?.secondaryColor || "#FBBF24"),
          description: String(req.body?.description || "Custom OG VELOCITY gift"),
          active: req.body?.active !== false,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }).returning();
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "upsert_gift",
        targetType: "gift",
        targetId: saved.id,
        details: { name: saved.name, cost: saved.cost }
      });
      options.getRealtimeHub?.()?.broadcastAll({ type: "catalog:updated", kind: "gifts" });
      res.json({ ok: true, gift: saved });
    }
  );
  router.delete(
    "/gifts/:id",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.params.id);
      await db.update(gifts).set({ active: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(gifts.id, id));
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "deactivate_gift",
        targetType: "gift",
        targetId: id
      });
      options.getRealtimeHub?.()?.broadcastAll({ type: "catalog:updated", kind: "gifts" });
      res.json({ ok: true });
    }
  );
  router.get(
    "/custom-gifts",
    requireAdminRole(["admin", "super_admin"], "gifts:manage"),
    async (_req, res) => {
      try {
        const items = await adminListCustomGifts();
        res.json({ ok: true, customGifts: items });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load custom gifts." });
      }
    }
  );
  router.patch(
    "/custom-gifts/:id",
    requireAdminRole(["admin", "super_admin"], "gifts:manage"),
    async (req, res) => {
      try {
        const updated = await adminUpdateCustomGift({
          id: String(req.params.id || "").trim(),
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          updates: {
            name: typeof req.body?.name === "string" ? req.body.name : void 0,
            cost: req.body?.cost !== void 0 ? Number(req.body.cost) : void 0,
            charmValue: req.body?.charmValue !== void 0 ? Number(req.body.charmValue) : void 0,
            rarity: typeof req.body?.rarity === "string" ? req.body.rarity : void 0,
            description: typeof req.body?.description === "string" ? req.body.description : void 0,
            primaryColor: typeof req.body?.primaryColor === "string" ? req.body.primaryColor : void 0,
            secondaryColor: typeof req.body?.secondaryColor === "string" ? req.body.secondaryColor : void 0,
            particleStyle: typeof req.body?.particleStyle === "string" ? req.body.particleStyle : void 0
          }
        });
        res.json({ ok: true, customGift: updated });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update custom gift." });
      }
    }
  );
  router.post(
    "/custom-gifts/:id/approve",
    requireAdminRole(["admin", "super_admin"], "gifts:manage"),
    async (req, res) => {
      try {
        const result = await adminApproveCustomGift({
          id: String(req.params.id || "").trim(),
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          reviewNote: typeof req.body?.reviewNote === "string" ? req.body.reviewNote : void 0,
          cost: req.body?.cost !== void 0 ? Number(req.body.cost) : void 0,
          charmValue: req.body?.charmValue !== void 0 ? Number(req.body.charmValue) : void 0,
          rarity: typeof req.body?.rarity === "string" ? req.body.rarity : void 0,
          name: typeof req.body?.name === "string" ? req.body.name : void 0,
          description: typeof req.body?.description === "string" ? req.body.description : void 0
        });
        const hub = options.getRealtimeHub?.();
        hub?.broadcastAll({ type: "catalog:updated", kind: "gifts" });
        hub?.sendToUser(result.submission.creatorUid, {
          type: "notification:new",
          notification: {
            title: "Custom Gift Approved!",
            body: `"${result.gift.name}" is now live in the Gift Catalog.`
          }
        });
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Custom gift approval failed." });
      }
    }
  );
  router.post(
    "/custom-gifts/:id/reject",
    requireAdminRole(["admin", "super_admin"], "gifts:manage"),
    async (req, res) => {
      try {
        const updated = await adminRejectCustomGift({
          id: String(req.params.id || "").trim(),
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          reviewNote: typeof req.body?.reviewNote === "string" ? req.body.reviewNote : void 0
        });
        options.getRealtimeHub?.()?.sendToUser(updated.creatorUid, {
          type: "notification:new",
          notification: {
            title: "Custom Gift Reviewed",
            body: `"${updated.name}" was rejected: ${updated.reviewNote || "Did not meet guidelines."}`
          }
        });
        res.json({ ok: true, customGift: updated });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Custom gift rejection failed." });
      }
    }
  );
  router.get("/events", async (_req, res) => {
    const rows = await db.select().from(events).orderBy(desc2(events.createdAt));
    res.json({ ok: true, events: rows });
  });
  router.post(
    "/events",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.body?.id || `evt-${crypto2.randomBytes(4).toString("hex")}`).trim();
      const title = String(req.body?.title || "").trim();
      if (!title) {
        res.status(400).json({ error: "Event title is required." });
        return;
      }
      const now = /* @__PURE__ */ new Date();
      const [saved] = await db.insert(events).values({
        id,
        title,
        subtitle: String(req.body?.subtitle || "").trim(),
        description: String(req.body?.description || "").trim(),
        bannerUrl: typeof req.body?.bannerUrl === "string" ? req.body.bannerUrl : null,
        eventType: String(req.body?.eventType || "tournament"),
        rewardCoins: Math.max(0, Math.floor(Number(req.body?.rewardCoins || 0))),
        startsAt: req.body?.startsAt ? new Date(String(req.body.startsAt)) : now,
        endsAt: req.body?.endsAt ? new Date(String(req.body.endsAt)) : new Date(now.getTime() + 7 * 864e5),
        status: String(req.body?.status || "live"),
        createdByUid: req.authUser.uid
      }).onConflictDoUpdate({
        target: events.id,
        set: {
          title,
          subtitle: String(req.body?.subtitle || "").trim(),
          description: String(req.body?.description || "").trim(),
          rewardCoins: Math.max(0, Math.floor(Number(req.body?.rewardCoins || 0))),
          status: String(req.body?.status || "live"),
          updatedAt: /* @__PURE__ */ new Date()
        }
      }).returning();
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "upsert_event",
        targetType: "event",
        targetId: saved.id,
        details: { title: saved.title, status: saved.status }
      });
      options.getRealtimeHub?.()?.broadcastAll({ type: "event:updated", event: saved });
      res.json({ ok: true, event: saved });
    }
  );
  router.delete(
    "/events/:id",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.params.id);
      await db.delete(events).where(eq3(events.id, id));
      options.getRealtimeHub?.()?.broadcastAll({ type: "event:updated", deletedId: id });
      res.json({ ok: true });
    }
  );
  router.get("/tasks", async (_req, res) => {
    const rows = await db.select().from(tasks).orderBy(tasks.sortOrder);
    res.json({ ok: true, tasks: rows });
  });
  router.post(
    "/tasks",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.body?.id || `task-${crypto2.randomBytes(3).toString("hex")}`).trim();
      const title = String(req.body?.title || "").trim();
      if (!title) {
        res.status(400).json({ error: "Task title is required." });
        return;
      }
      const subtitle = String(req.body?.subtitle || "").trim();
      const category = String(req.body?.category || "daily").trim() || "daily";
      const actionType = String(req.body?.actionType || "checkin").trim() || "checkin";
      const targetCount = Math.max(1, Math.floor(Number(req.body?.targetCount || 1)));
      const rewardCoins = Math.max(1, Math.floor(Number(req.body?.rewardCoins || 200)));
      const active = req.body?.active !== false;
      const sortOrder = Math.floor(Number(req.body?.sortOrder ?? 10));
      const [saved] = await db.insert(tasks).values({
        id,
        title,
        subtitle,
        category,
        actionType,
        targetCount,
        rewardCoins,
        active,
        sortOrder
      }).onConflictDoUpdate({
        target: tasks.id,
        set: {
          title,
          subtitle,
          category,
          actionType,
          targetCount,
          rewardCoins,
          active,
          sortOrder,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }).returning();
      options.getRealtimeHub?.()?.broadcastAll({ type: "tasks:updated", taskId: saved.id });
      res.json({ ok: true, task: saved });
    }
  );
  router.patch(
    "/tasks/:id",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.params.id || "").trim();
      const [existing] = await db.select().from(tasks).where(eq3(tasks.id, id));
      if (!existing) {
        res.status(404).json({ error: "Task not found." });
        return;
      }
      const patch = { updatedAt: /* @__PURE__ */ new Date() };
      if (typeof req.body?.title === "string" && req.body.title.trim()) patch.title = req.body.title.trim();
      if (typeof req.body?.subtitle === "string") patch.subtitle = req.body.subtitle.trim();
      if (typeof req.body?.category === "string" && req.body.category.trim()) patch.category = req.body.category.trim();
      if (typeof req.body?.actionType === "string" && req.body.actionType.trim()) patch.actionType = req.body.actionType.trim();
      if (req.body?.targetCount !== void 0) patch.targetCount = Math.max(1, Math.floor(Number(req.body.targetCount)));
      if (req.body?.rewardCoins !== void 0) patch.rewardCoins = Math.max(1, Math.floor(Number(req.body.rewardCoins)));
      if (req.body?.sortOrder !== void 0) patch.sortOrder = Math.floor(Number(req.body.sortOrder));
      if (typeof req.body?.active === "boolean") patch.active = req.body.active;
      const [updated] = await db.update(tasks).set(patch).where(eq3(tasks.id, id)).returning();
      options.getRealtimeHub?.()?.broadcastAll({ type: "tasks:updated", taskId: updated.id });
      res.json({ ok: true, task: updated });
    }
  );
  router.delete(
    "/tasks/:id",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.params.id || "").trim();
      await db.delete(tasks).where(eq3(tasks.id, id));
      options.getRealtimeHub?.()?.broadcastAll({ type: "tasks:updated", deletedId: id });
      res.json({ ok: true, deletedId: id });
    }
  );
  router.get("/tasks/progress", async (req, res) => {
    const limit = Number(req.query.limit || 120);
    const list = await adminGetTaskProgressList(limit);
    res.json({ ok: true, progress: list });
  });
  router.post(
    "/tasks/progress",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      try {
        const userIdentifier = String(req.body?.userIdentifier || "").trim();
        const taskId = String(req.body?.taskId || "").trim();
        if (!userIdentifier || !taskId) {
          res.status(400).json({ error: "userIdentifier and taskId are required." });
          return;
        }
        const saved = await adminUpdateUserTaskProgress({
          userIdentifier,
          taskId,
          progress: req.body?.progress !== void 0 ? Number(req.body.progress) : void 0,
          claimed: req.body?.claimed !== void 0 ? Boolean(req.body.claimed) : void 0
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: "tasks:updated", taskId });
        res.json({ ok: true, progress: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update task progress." });
      }
    }
  );
  router.get("/packages", async (_req, res) => {
    const [vipPkgs, coinPkgs] = await Promise.all([
      db.select().from(vipPackages).orderBy(vipPackages.sortOrder),
      db.select().from(coinPackages).orderBy(coinPackages.sortOrder)
    ]);
    res.json({ ok: true, vipPackages: vipPkgs, coinPackages: coinPkgs });
  });
  router.post(
    "/packages/vip",
    requireAdminRole(["super_admin"]),
    async (req, res) => {
      if (req.authUser.role !== "super_admin") {
        res.status(403).json({ error: "Only Super Admin can configure VIP subscription packages." });
        return;
      }
      if (req.body?.grantedVipLevel !== void 0 && Number(req.body.grantedVipLevel) !== 1 || req.body?.bonusGrowth !== void 0 && Number(req.body.bonusGrowth) !== 0) {
        res.status(400).json({
          error: "Every VIP subscription package must start at VIP 1 with 0 bonus points. Only price and duration are configurable."
        });
        return;
      }
      const id = String(req.body?.id || `vip-${crypto2.randomBytes(3).toString("hex")}`).trim();
      const name = String(req.body?.name || "").trim();
      if (!name) {
        res.status(400).json({ error: "Package name required." });
        return;
      }
      const priceInr = Math.max(1, Math.floor(Number(req.body?.priceInr || 200)));
      const durationDays = Math.max(1, Math.floor(Number(req.body?.durationDays || 30)));
      const perks = Array.isArray(req.body?.perks) ? req.body.perks.map(String) : ["Starts at VIP 1", `${durationDays} Days Membership Validity`, "Earn 1 VIP Pt / 100 Coins Gifted"];
      const [saved] = await db.insert(vipPackages).values({
        id,
        name,
        priceInr,
        durationDays,
        grantedVipLevel: 1,
        bonusGrowth: 0,
        perks,
        active: req.body?.active !== false
      }).onConflictDoUpdate({
        target: vipPackages.id,
        set: {
          name,
          priceInr,
          durationDays,
          grantedVipLevel: 1,
          bonusGrowth: 0,
          perks,
          active: req.body?.active !== false,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }).returning();
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: "super_admin",
        action: "upsert_vip_package",
        targetType: "vip_package",
        targetId: saved.id,
        details: { name: saved.name, priceInr: saved.priceInr, durationDays: saved.durationDays, grantedVipLevel: 1 }
      });
      options.getRealtimeHub?.()?.broadcastAll({ type: "catalog:updated", kind: "vipPackages" });
      res.json({ ok: true, package: saved });
    }
  );
  router.post(
    "/packages/coins",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.body?.id || `pkg-${crypto2.randomBytes(3).toString("hex")}`).trim();
      const label = String(req.body?.label || "").trim();
      if (!label) {
        res.status(400).json({ error: "Package label required." });
        return;
      }
      const [saved] = await db.insert(coinPackages).values({
        id,
        label,
        coins: Math.max(1, Math.floor(Number(req.body?.coins || 1e5))),
        bonusCoins: Math.max(0, Math.floor(Number(req.body?.bonusCoins || 0))),
        priceInr: Math.max(1, Math.floor(Number(req.body?.priceInr || 100))),
        highlight: typeof req.body?.highlight === "string" ? req.body.highlight : null,
        active: req.body?.active !== false
      }).onConflictDoUpdate({
        target: coinPackages.id,
        set: {
          label,
          coins: Math.max(1, Math.floor(Number(req.body?.coins || 1e5))),
          bonusCoins: Math.max(0, Math.floor(Number(req.body?.bonusCoins || 0))),
          priceInr: Math.max(1, Math.floor(Number(req.body?.priceInr || 100))),
          active: req.body?.active !== false,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }).returning();
      res.json({ ok: true, package: saved });
    }
  );
  router.get("/backgrounds", async (_req, res) => {
    const rows = await db.select().from(roomBackgrounds);
    res.json({ ok: true, backgrounds: rows });
  });
  router.post(
    "/backgrounds",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      const id = String(req.body?.id || `bg-${crypto2.randomBytes(3).toString("hex")}`).trim();
      const name = String(req.body?.name || "").trim();
      if (!name) {
        res.status(400).json({ error: "Background name required." });
        return;
      }
      const [saved] = await db.insert(roomBackgrounds).values({
        id,
        name,
        gradient: String(req.body?.gradient || "linear-gradient(160deg, #0D0B1D 0%, #191134 55%, #070912 100%)"),
        imageUrl: typeof req.body?.imageUrl === "string" ? req.body.imageUrl : null,
        accent: String(req.body?.accent || "#A855F7"),
        ambiance: String(req.body?.ambiance || "indigo"),
        active: req.body?.active !== false
      }).onConflictDoUpdate({
        target: roomBackgrounds.id,
        set: {
          name,
          gradient: String(req.body?.gradient || "linear-gradient(160deg, #0D0B1D 0%, #191134 55%, #070912 100%)"),
          imageUrl: typeof req.body?.imageUrl === "string" ? req.body.imageUrl : null,
          accent: String(req.body?.accent || "#A855F7"),
          active: req.body?.active !== false,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }).returning();
      res.json({ ok: true, background: saved });
    }
  );
  router.post(
    "/announcements",
    requireAdminRole(["admin", "super_admin", "support_staff"]),
    async (req, res) => {
      const title = String(req.body?.title || "").trim();
      const body = String(req.body?.body || "").trim();
      const rawTargetUid = req.body?.targetUid ? String(req.body.targetUid).trim() : null;
      if (!title || !body) {
        res.status(400).json({ error: "Announcement title and body are required." });
        return;
      }
      const resolvedTarget = rawTargetUid ? await resolveUserByUidOrPublicId(rawTargetUid) : null;
      if (rawTargetUid && !resolvedTarget) {
        res.status(404).json({ error: "Target user not found." });
        return;
      }
      const targetUid = resolvedTarget?.uid || null;
      const [created] = await db.insert(notifications).values({
        userUid: targetUid,
        type: targetUid ? "system" : "announcement",
        title,
        body
      }).returning();
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "publish_announcement",
        targetType: "notification",
        targetId: String(created.id),
        details: { title, targetUid }
      });
      const hub = options.getRealtimeHub?.();
      if (targetUid && resolvedTarget) {
        hub?.sendToUser(targetUid, {
          type: "notification:new",
          notification: { ...created, userUid: resolvedTarget.publicId }
        });
      } else {
        hub?.broadcastAll({ type: "announcement:new", notification: { ...created, userUid: null } });
      }
      res.json({ ok: true, notification: created });
    }
  );
  router.get("/reports", async (_req, res) => {
    const rows = await db.select().from(reports).orderBy(desc2(reports.createdAt)).limit(100);
    res.json({ ok: true, reports: rows });
  });
  router.post(
    "/reports/:id/resolve",
    requireAdminRole(["moderator", "admin", "super_admin"]),
    async (req, res) => {
      const id = Number(req.params.id);
      const status = req.body?.status === "dismissed" ? "dismissed" : "resolved";
      const note = String(req.body?.resolutionNote || "").trim();
      const removePost = Boolean(req.body?.removePost);
      const [updated] = await db.update(reports).set({
        status,
        resolvedByUid: req.authUser.uid,
        resolutionNote: note || "Handled by moderation team",
        resolvedAt: /* @__PURE__ */ new Date()
      }).where(eq3(reports.id, id)).returning();
      if (updated && removePost && updated.targetType === "post") {
        await db.update(posts).set({ status: "removed" }).where(eq3(posts.id, updated.targetId));
      }
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: `report_${status}`,
        targetType: "report",
        targetId: String(id),
        details: { note, removePost }
      });
      res.json({ ok: true, report: updated });
    }
  );
  router.get("/roles", async (_req, res) => {
    const [roles, admins] = await Promise.all([
      db.select().from(rolesPermissions),
      db.select({
        userUid: adminUsers.userUid,
        role: adminUsers.role,
        active: adminUsers.active,
        publicId: users.publicId,
        email: users.email,
        name: profiles.displayName
      }).from(adminUsers).leftJoin(users, eq3(adminUsers.userUid, users.uid)).leftJoin(profiles, eq3(adminUsers.userUid, profiles.userUid))
    ]);
    res.json({ ok: true, roles, admins });
  });
  router.post(
    "/roles/assign",
    requireAdminRole(["super_admin"]),
    async (req, res) => {
      if (req.authUser.role !== "super_admin") {
        res.status(403).json({ error: "Only Super Admin can assign admin panel roles." });
        return;
      }
      const rawTarget = String(req.body?.userUid || "").trim();
      const role = String(req.body?.role || "normal_user");
      if (!rawTarget) {
        res.status(400).json({ error: "Missing userUid." });
        return;
      }
      const resolved = await resolveUserByUidOrPublicId(rawTarget);
      if (!resolved) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      const targetUid = resolved.uid;
      await db.transaction(async (tx) => {
        await tx.update(users).set({ role, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(users.uid, targetUid));
        if (ADMIN_PANEL_ROLES.has(role)) {
          await tx.insert(adminUsers).values({ userUid: targetUid, role, assignedByUid: req.authUser.uid, active: true }).onConflictDoUpdate({
            target: adminUsers.userUid,
            set: { role, assignedByUid: req.authUser.uid, active: true, updatedAt: /* @__PURE__ */ new Date() }
          });
        } else {
          await tx.delete(adminUsers).where(eq3(adminUsers.userUid, targetUid));
        }
        await tx.insert(auditLogs).values({
          actorUid: req.authUser.uid,
          actorRole: "super_admin",
          action: "assign_role",
          targetType: "user",
          targetId: targetUid,
          details: { role }
        });
      });
      res.json({ ok: true });
    }
  );
  router.get("/audit-logs", async (_req, res) => {
    const rows = await db.select().from(auditLogs).orderBy(desc2(auditLogs.createdAt)).limit(150);
    res.json({ ok: true, logs: rows });
  });
  router.get(
    "/users/:uid/inspect",
    requireAdminRole(["admin", "super_admin", "moderator"], "users:read"),
    async (req, res) => {
      const inspection = await getAdminUserInspection(String(req.params.uid || "").trim());
      if (!inspection || !inspection.user) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      res.json({ ok: true, ...inspection });
    }
  );
  router.put(
    "/users/:uid/notes",
    requireAdminRole(["admin", "super_admin", "moderator"], "users:manage"),
    async (req, res) => {
      try {
        const notes = await addUserAdminNote({
          actorUid: req.authUser.uid,
          actorName: req.authUser.name,
          targetIdentifier: String(req.params.uid || "").trim(),
          note: String(req.body?.note || "")
        });
        res.json({ ok: true, adminNotes: notes });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to save admin note." });
      }
    }
  );
  router.get("/permissions/catalog", (_req, res) => {
    res.json({ ok: true, permissions: APP_PERMISSIONS_CATALOG });
  });
  router.get("/permissions/sets", async (_req, res) => {
    const sets = await getAdminPermissionSets();
    res.json({ ok: true, sets });
  });
  router.post(
    "/permissions/sets",
    requireAdminRole(["super_admin"], "roles:manage"),
    async (req, res) => {
      const name = String(req.body?.name || "").trim();
      if (!name) {
        res.status(400).json({ error: "Permission set name is required." });
        return;
      }
      const saved = await upsertAdminPermissionSet({
        actorUid: req.authUser.uid,
        id: typeof req.body?.id === "string" ? req.body.id : void 0,
        name,
        description: typeof req.body?.description === "string" ? req.body.description : void 0,
        permissions: Array.isArray(req.body?.permissions) ? req.body.permissions.map(String) : []
      });
      res.json({ ok: true, set: saved });
    }
  );
  router.post(
    "/permissions/users/:uid",
    requireAdminRole(["super_admin"], "roles:manage"),
    async (req, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid || "").trim());
      if (!resolved) {
        res.status(404).json({ error: "Target user not found." });
        return;
      }
      try {
        const saved = await assignAdminUserPermissions({
          actorUid: req.authUser.uid,
          targetUid: resolved.uid,
          customPermissions: Array.isArray(req.body?.customPermissions) ? req.body.customPermissions.map(String) : [],
          permissionSetId: typeof req.body?.permissionSetId === "string" && req.body.permissionSetId.trim() ? req.body.permissionSetId.trim() : null,
          expiresAt: typeof req.body?.expiresAt === "string" && req.body.expiresAt.trim() ? req.body.expiresAt.trim() : null,
          reason: typeof req.body?.reason === "string" ? req.body.reason : void 0
        });
        res.json({ ok: true, userPermissions: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to assign permissions." });
      }
    }
  );
  router.get("/permissions/history", async (_req, res) => {
    const history = await getAdminPermissionHistory(60);
    res.json({ ok: true, history });
  });
  router.get("/app-config", async (_req, res) => {
    const config = await getAppConfig();
    res.json({ ok: true, config });
  });
  router.put(
    "/app-config",
    requireAdminRole(["super_admin"], "config:manage"),
    async (req, res) => {
      const config = await updateAppConfig(
        req.authUser.uid,
        req.authUser.role,
        req.body ?? {}
      );
      options.getRealtimeHub?.()?.broadcastAll({ type: "app:config-updated", config });
      res.json({ ok: true, config });
    }
  );
  router.get("/rooms", async (_req, res) => {
    const hub = options.getRealtimeHub?.();
    await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin());
    const rows = await db.select().from(voiceRooms).orderBy(desc2(voiceRooms.createdAt)).limit(80);
    const uidMap = await mapUidsToPublicIds(rows.map((r) => r.ownerUid));
    res.json({
      ok: true,
      rooms: rows.map((r) => ({
        ...r,
        ownerUid: uidMap[r.ownerUid] || r.ownerUid,
        lockedSeats: Array.isArray(r.lockedSeats) ? r.lockedSeats : [],
        liveParticipantsCount: hub ? hub.getRoomParticipants(r.id).length : 0
      }))
    });
  });
  router.post(
    "/rooms/:roomId/reopen",
    requireAdminRole(["admin", "super_admin"], "rooms:moderate"),
    async (req, res) => {
      try {
        const reopened = await reopenVoiceRoom({
          roomId: String(req.params.roomId || "").trim(),
          actorUser: req.authUser
        });
        const hub = options.getRealtimeHub?.();
        if (!reopened.isOfficial) {
          hub?.scheduleInitialRoomGrace(reopened.id);
        }
        hub?.broadcastToRoom(reopened.id, {
          type: "room:status-changed",
          roomId: reopened.id,
          status: "active",
          reason: null
        });
        hub?.broadcastAll({ type: "room:list-updated", updatedRoomId: reopened.id });
        res.json({ ok: true, room: reopened });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to reopen room." });
      }
    }
  );
  router.patch(
    "/rooms/:roomId/level",
    requireAdminRole(["admin", "super_admin"], "rooms:moderate"),
    async (req, res) => {
      const roomId = String(req.params.roomId || "").trim();
      const level = Math.max(1, Math.min(30, Math.floor(Number(req.body?.roomLevel || 15))));
      const [updated] = await db.update(voiceRooms).set({ roomLevel: level, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(voiceRooms.id, roomId)).returning();
      if (!updated) {
        res.status(404).json({ error: "Voice room not found." });
        return;
      }
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "admin_set_room_level",
        targetType: "voice_room",
        targetId: roomId,
        details: { roomLevel: level }
      });
      const hub = options.getRealtimeHub?.();
      hub?.broadcastToRoom(roomId, {
        type: "room:settings-updated",
        roomId,
        room: { ...updated, roomLevel: level }
      });
      hub?.broadcastAll({ type: "room:list-updated", updatedRoomId: roomId });
      res.json({ ok: true, room: updated });
    }
  );
  router.delete(
    "/rooms/:roomId",
    requireAdminRole(["moderator", "admin", "super_admin"], "rooms:moderate"),
    async (req, res) => {
      const roomId = String(req.params.roomId || "").trim();
      const reason = String(req.body?.reason || "Closed by App Admin moderation.").trim();
      const hub = options.getRealtimeHub?.();
      let closed = false;
      if (hub) {
        closed = await hub.closeRoom(roomId, reason);
      } else {
        const [updated] = await db.update(voiceRooms).set({ status: "closed", closedAt: /* @__PURE__ */ new Date(), closedReason: reason, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(voiceRooms.id, roomId)).returning();
        closed = Boolean(updated);
      }
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "admin_close_room",
        targetType: "voice_room",
        targetId: roomId,
        details: { reason }
      });
      res.json({ ok: true, closed });
    }
  );
  const DEFAULT_DEPLOYMENT_STATE = {
    primaryDomain: "ogvelocity.xyz",
    previewDomain: "ais-dev-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app",
    sharedDomain: "ais-pre-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app",
    customDomains: ["ogvelocity.xyz"],
    publishStatus: "draft",
    lastBuildStatus: "idle",
    lastBuildAt: null,
    lastBuildDurationMs: null,
    lastBuildLogs: "",
    lastBuildError: null,
    publishedVersion: 0,
    publishedAt: null,
    publishedBy: null,
    environmentMode: process.env.NODE_ENV || "development"
  };
  let activeBuildRunning = false;
  async function loadDeploymentState() {
    const [row] = await db.select().from(platformSettings).where(eq3(platformSettings.key, "deployment_state"));
    const raw = row?.value ?? {};
    return {
      ...DEFAULT_DEPLOYMENT_STATE,
      ...raw,
      customDomains: Array.isArray(raw.customDomains) && raw.customDomains.length > 0 ? raw.customDomains.map(String) : DEFAULT_DEPLOYMENT_STATE.customDomains,
      environmentMode: process.env.NODE_ENV || "development"
    };
  }
  async function saveDeploymentState(next, updatedByUid) {
    await db.insert(platformSettings).values({
      key: "deployment_state",
      value: next,
      updatedByUid
    }).onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: next,
        updatedByUid,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
  }
  async function fetchFirebaseAuthorizedDomainsMap() {
    const entries = [
      { projectId: "og-velocity", apiKey: process.env.FIREBASE_WEB_API_KEY || "AIzaSyCWMhFzpTkrcWEEjGEwkItHtGJ8AYjKg_Q" },
      ...firebase_applet_config_default.projectId && firebase_applet_config_default.apiKey ? [{ projectId: firebase_applet_config_default.projectId, apiKey: firebase_applet_config_default.apiKey }] : []
    ];
    const results = {};
    await Promise.all(
      entries.map(async ({ projectId, apiKey }) => {
        try {
          const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${apiKey}`);
          if (!resp.ok) {
            results[projectId] = [];
            return;
          }
          const json = await resp.json();
          results[projectId] = Array.isArray(json.authorizedDomains) ? json.authorizedDomains : [];
        } catch {
          results[projectId] = [];
        }
      })
    );
    return results;
  }
  router.get(
    "/deployment/status",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      try {
        const state = await loadDeploymentState();
        const distHtmlPath = path.resolve(process.cwd(), "dist", "index.html");
        const distReady = fs.existsSync(distHtmlPath);
        const authorizedDomainsByProject = await fetchFirebaseAuthorizedDomainsMap();
        const allAuthorized = Array.from(new Set(Object.values(authorizedDomainsByProject).flat()));
        const rawHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0].trim().toLowerCase();
        const requiredHosts = Array.from(
          new Set(
            [state.primaryDomain, state.previewDomain, state.sharedDomain, rawHost].map((h) => h.trim().toLowerCase()).filter(Boolean)
          )
        );
        const domainChecks = requiredHosts.map((host) => ({
          host,
          authorized: allAuthorized.some(
            (d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`)
          )
        }));
        res.json({
          ok: true,
          deployment: {
            ...state,
            distReady,
            buildInProgress: activeBuildRunning,
            currentHost: rawHost,
            authorizedDomainsByProject,
            domainChecks
          }
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Failed to inspect deployment status." });
      }
    }
  );
  router.put(
    "/deployment/domains",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      if (!isAppAdminRole(req.authUser.role)) {
        res.status(403).json({ error: "Only App Admins can update domain configuration." });
        return;
      }
      const cleanDomain = (v) => String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const cur = await loadDeploymentState();
      const primaryDomain = req.body?.primaryDomain ? cleanDomain(req.body.primaryDomain) : cur.primaryDomain;
      const previewDomain = req.body?.previewDomain ? cleanDomain(req.body.previewDomain) : cur.previewDomain;
      const sharedDomain = req.body?.sharedDomain ? cleanDomain(req.body.sharedDomain) : cur.sharedDomain;
      const customDomains = Array.isArray(req.body?.customDomains) ? Array.from(new Set(req.body.customDomains.map(cleanDomain).filter(Boolean))) : Array.from(new Set([primaryDomain, ...cur.customDomains].filter(Boolean)));
      if (!primaryDomain) {
        res.status(400).json({ error: "Primary website domain is required." });
        return;
      }
      const next = {
        ...cur,
        primaryDomain,
        previewDomain,
        sharedDomain,
        customDomains
      };
      await saveDeploymentState(next, req.authUser.uid);
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "update_deployment_domains",
        targetType: "deployment",
        targetId: "global",
        details: { primaryDomain, previewDomain, sharedDomain, customDomains }
      });
      res.json({ ok: true, deployment: next });
    }
  );
  router.post(
    "/deployment/build",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      if (activeBuildRunning) {
        res.status(409).json({ error: "A production build is already in progress." });
        return;
      }
      activeBuildRunning = true;
      const startedAt = Date.now();
      const cur = await loadDeploymentState();
      await saveDeploymentState(
        {
          ...cur,
          publishStatus: "building",
          lastBuildStatus: "running",
          lastBuildError: null
        },
        req.authUser.uid
      );
      try {
        const result = await new Promise((resolve) => {
          const child = spawn("npm", ["run", "build"], {
            cwd: process.cwd(),
            shell: false,
            env: { ...process.env, FORCE_COLOR: "0" }
          });
          let out = "";
          const append = (chunk) => {
            out += chunk.toString("utf8");
            if (out.length > 24e3) {
              out = out.slice(-24e3);
            }
          };
          child.stdout?.on("data", append);
          child.stderr?.on("data", append);
          child.on("error", (err) => {
            resolve({ code: 1, output: `${out}
${err.message}`.trim() });
          });
          child.on("close", (code) => {
            resolve({ code: code ?? 1, output: out.trim() });
          });
        });
        const durationMs = Date.now() - startedAt;
        const distReady = fs.existsSync(path.resolve(process.cwd(), "dist", "index.html"));
        const success = result.code === 0 && distReady;
        const next = {
          ...cur,
          publishStatus: success ? cur.publishedVersion > 0 ? "live" : "ready" : "failed",
          lastBuildStatus: success ? "success" : "failed",
          lastBuildAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastBuildDurationMs: durationMs,
          lastBuildLogs: result.output || (success ? "Vite production build completed." : "Build failed with no output."),
          lastBuildError: success ? null : `Production build exited with code ${result.code}`
        };
        await saveDeploymentState(next, req.authUser.uid);
        await db.insert(auditLogs).values({
          actorUid: req.authUser.uid,
          actorRole: req.authUser.role,
          action: success ? "production_build_success" : "production_build_failed",
          targetType: "deployment",
          targetId: "global",
          details: { durationMs, code: result.code, distReady }
        });
        res.status(success ? 200 : 500).json({
          ok: success,
          deployment: { ...next, distReady, buildInProgress: false },
          error: success ? void 0 : next.lastBuildError
        });
      } finally {
        activeBuildRunning = false;
      }
    }
  );
  router.post(
    "/deployment/publish",
    requireAdminRole(["admin", "super_admin"]),
    async (req, res) => {
      if (activeBuildRunning) {
        res.status(409).json({ error: "Wait for the active production build to finish before publishing." });
        return;
      }
      const distReady = fs.existsSync(path.resolve(process.cwd(), "dist", "index.html"));
      if (!distReady) {
        res.status(400).json({
          error: "No production bundle found in dist/. Run Production Build first before publishing."
        });
        return;
      }
      const cur = await loadDeploymentState();
      const next = {
        ...cur,
        publishStatus: "live",
        lastBuildStatus: cur.lastBuildStatus === "idle" ? "success" : cur.lastBuildStatus,
        publishedVersion: cur.publishedVersion + 1,
        publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
        publishedBy: `${req.authUser.name} (${req.authUser.publicId})`
      };
      await saveDeploymentState(next, req.authUser.uid);
      await db.insert(auditLogs).values({
        actorUid: req.authUser.uid,
        actorRole: req.authUser.role,
        action: "publish_production_release",
        targetType: "deployment",
        targetId: `v${next.publishedVersion}`,
        details: {
          publishedVersion: next.publishedVersion,
          primaryDomain: next.primaryDomain,
          customDomains: next.customDomains
        }
      });
      res.json({
        ok: true,
        deployment: { ...next, distReady: true, buildInProgress: false }
      });
    }
  );
  return router;
}

// server/realtime.ts
import crypto4 from "crypto";
import { and as and2, eq as eq5, or as or3 } from "drizzle-orm";
import { WebSocket, WebSocketServer } from "ws";

// server/games.ts
import crypto3 from "crypto";
import { eq as eq4 } from "drizzle-orm";
function buildUnoDeck() {
  const colors = ["red", "blue", "green", "yellow"];
  const deck = [];
  let seq = 0;
  for (const color of colors) {
    deck.push({ id: `u-${seq++}`, color, value: "0" });
    for (const val of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "+2"]) {
      deck.push({ id: `u-${seq++}`, color, value: val });
      deck.push({ id: `u-${seq++}`, color, value: val });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `u-${seq++}`, color: "wild", value: "wild" });
    deck.push({ id: `u-${seq++}`, color: "wild", value: "+4" });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto3.randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function buildCarromDiscs() {
  const discs = [{ id: "queen", color: "queen", x: 210, y: 210, pocketed: false }];
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    discs.push({
      id: `w-${i}`,
      color: "white",
      x: Math.round(210 + Math.cos(angle) * 28),
      y: Math.round(210 + Math.sin(angle) * 28),
      pocketed: false
    });
    discs.push({
      id: `b-${i}`,
      color: "black",
      x: Math.round(210 + Math.cos(angle + 0.35) * 46),
      y: Math.round(210 + Math.sin(angle + 0.35) * 46),
      pocketed: false
    });
  }
  return discs;
}
var AuthoritativeGameEngine = class {
  constructor() {
    this.matches = /* @__PURE__ */ new Map();
    this.userToMatch = /* @__PURE__ */ new Map();
    this.lastActionByUser = /* @__PURE__ */ new Map();
  }
  checkRateLimit(uid, minMs = 80) {
    const now = Date.now();
    const prev = this.lastActionByUser.get(uid) ?? 0;
    if (now - prev < minMs) return false;
    this.lastActionByUser.set(uid, now);
    return true;
  }
  listMatches(gameType) {
    const list = [];
    for (const m of this.matches.values()) {
      if (gameType && m.gameType !== gameType) continue;
      if (m.status === "finished") continue;
      const uidToPublic = new Map(m.players.map((p) => [p.uid, p.publicId]));
      list.push({
        id: m.id,
        code: m.code,
        gameType: m.gameType,
        hostUid: uidToPublic.get(m.hostUid) || m.hostUid,
        status: m.status,
        playerCount: m.players.length,
        players: m.players.map((p) => ({
          uid: p.publicId,
          publicId: p.publicId,
          name: p.name,
          vipLevel: p.vipLevel ?? 0,
          score: p.score
        }))
      });
    }
    return list;
  }
  createMatch(player, gameType) {
    const id = `GM-${crypto3.randomBytes(4).toString("hex").toUpperCase()}`;
    const code = String(1e3 + crypto3.randomInt(0, 8999));
    const match = {
      id,
      code,
      gameType,
      hostUid: player.uid,
      status: "lobby",
      players: [
        {
          uid: player.uid,
          publicId: player.publicId,
          name: player.name,
          vipLevel: Number(player.vipLevel ?? 0),
          score: 0,
          connected: true,
          ready: true,
          x: 120,
          y: 220,
          hp: 100,
          shield: 50,
          tags: 0
        }
      ],
      turnIndex: 0,
      winnerUid: null,
      createdAt: Date.now(),
      chatMessages: []
    };
    this.matches.set(id, match);
    this.userToMatch.set(player.uid, id);
    return match;
  }
  findOrCreateMatchmaking(player, gameType) {
    for (const m of this.matches.values()) {
      if (m.gameType === gameType && m.status === "lobby" && m.players.length < 4) {
        if (!m.players.some((p) => p.uid === player.uid)) {
          return this.joinMatch(m.id, player);
        }
        return m;
      }
    }
    return this.createMatch(player, gameType);
  }
  joinMatch(matchId, player) {
    const m = this.matches.get(matchId);
    if (!m) throw new Error("Match not found.");
    const existing = m.players.find((p) => p.uid === player.uid);
    if (existing) {
      existing.connected = true;
      existing.vipLevel = Number(player.vipLevel ?? existing.vipLevel ?? 0);
      this.userToMatch.set(player.uid, m.id);
      return m;
    }
    if (m.status !== "lobby") throw new Error("Match already in progress.");
    if (m.players.length >= 4) throw new Error("Match lobby is full (max 4 players).");
    const spawns = [
      { x: 120, y: 220 },
      { x: 580, y: 220 },
      { x: 350, y: 80 },
      { x: 350, y: 360 }
    ];
    const sp = spawns[m.players.length % spawns.length];
    m.players.push({
      uid: player.uid,
      publicId: player.publicId,
      name: player.name,
      vipLevel: Number(player.vipLevel ?? 0),
      score: 0,
      connected: true,
      ready: true,
      x: sp.x,
      y: sp.y,
      hp: 100,
      shield: 50,
      tags: 0
    });
    this.userToMatch.set(player.uid, m.id);
    return m;
  }
  getMatch(matchId) {
    return this.matches.get(matchId) || null;
  }
  getMatchByUser(uid) {
    const id = this.userToMatch.get(uid);
    return id ? this.matches.get(id) || null : null;
  }
  markDisconnected(uid) {
    const m = this.getMatchByUser(uid);
    if (!m) return null;
    const p = m.players.find((pl) => pl.uid === uid);
    if (p) p.connected = false;
    return m;
  }
  async leaveMatch(uid, matchId) {
    const targetId = matchId || this.userToMatch.get(uid) || null;
    if (!targetId) return { match: null, leftMatchId: null };
    const m = this.matches.get(targetId);
    if (this.userToMatch.get(uid) === targetId) {
      this.userToMatch.delete(uid);
    }
    if (!m) return { match: null, leftMatchId: targetId };
    const idx = m.players.findIndex((p) => p.uid === uid);
    if (idx < 0) return { match: null, leftMatchId: targetId };
    m.players.splice(idx, 1);
    if (m.players.length === 0) {
      this.matches.delete(m.id);
      return { match: null, leftMatchId: m.id };
    }
    if (m.hostUid === uid) {
      m.hostUid = m.players[0].uid;
    }
    if (m.status === "playing") {
      m.turnIndex = m.turnIndex % m.players.length;
      if (m.players.length === 1) {
        m.winnerUid = m.players[0].uid;
        m.status = "finished";
        await this.persistFinishedMatch(m);
      }
    }
    return { match: m, leftMatchId: m.id };
  }
  addChatMessage(matchId, actorUid, rawText) {
    const m = this.matches.get(matchId);
    if (!m) throw new Error("Match not found.");
    const player = m.players.find((p) => p.uid === actorUid);
    if (!player) throw new Error("You are not a participant in this match.");
    const text2 = rawText.trim().slice(0, 300);
    if (!text2) throw new Error("Empty chat message.");
    m.chatMessages = [
      ...(m.chatMessages || []).slice(-49),
      {
        id: `gm-chat-${crypto3.randomBytes(4).toString("hex")}`,
        senderUid: player.publicId,
        senderName: player.name,
        vipLevel: player.vipLevel ?? 0,
        text: text2,
        createdAt: Date.now()
      }
    ];
    return m;
  }
  startMatch(matchId, actorUid) {
    const m = this.matches.get(matchId);
    if (!m) throw new Error("Match not found.");
    if (m.hostUid !== actorUid) throw new Error("Only host can start the match.");
    if (m.players.length < 2) throw new Error("At least 2 real players must join to start.");
    if (m.status !== "lobby") throw new Error("Match already started.");
    m.status = "playing";
    m.turnIndex = 0;
    if (m.gameType === "uno") {
      const deck = buildUnoDeck();
      for (const p of m.players) {
        p.hand = deck.splice(0, 7);
        p.saidUno = false;
      }
      let firstIdx = deck.findIndex((c) => c.color !== "wild");
      if (firstIdx < 0) firstIdx = 0;
      const [firstCard] = deck.splice(firstIdx, 1);
      m.unoDeck = deck;
      m.unoDiscard = [firstCard];
      m.unoActiveColor = firstCard.color === "wild" ? "red" : firstCard.color;
      m.unoDirection = 1;
    } else if (m.gameType === "carrom") {
      m.carromDiscs = buildCarromDiscs();
      m.carromQueenClaimedBy = null;
    } else if (m.gameType === "laser_tag") {
      m.laserEndsAt = Date.now() + 9e4;
      m.laserShots = [];
    } else if (m.gameType === "ludo") {
      const ludoColors = ["red", "green", "yellow", "blue"];
      m.players.forEach((p, idx) => {
        p.ludoColor = ludoColors[idx % 4];
        p.ludoTokens = [-1, -1, -1, -1];
        p.score = 0;
      });
      m.ludoDice = null;
      m.ludoMustRoll = true;
      m.ludoLastEvent = `${m.players[0].name}'s turn \u2014 Roll the dice!`;
    }
    return m;
  }
  async handleAction(matchId, actorUid, action) {
    const m = this.matches.get(matchId);
    if (!m) throw new Error("Match not found.");
    if (!this.checkRateLimit(actorUid, m.gameType === "laser_tag" ? 40 : 120)) {
      throw new Error("Action rate limit exceeded.");
    }
    const playerIdx = m.players.findIndex((p) => p.uid === actorUid);
    if (playerIdx < 0) throw new Error("You are not a participant in this match.");
    if (m.status !== "playing") throw new Error("Match is not currently playing.");
    let finishedJustNow = false;
    if (m.gameType === "uno") {
      if (m.turnIndex !== playerIdx) throw new Error("Not your turn.");
      const actType = String(action.type || "");
      const player = m.players[playerIdx];
      const top = m.unoDiscard[m.unoDiscard.length - 1];
      if (actType === "draw") {
        if (!m.unoDeck.length) {
          const keep = m.unoDiscard.pop();
          m.unoDeck = m.unoDiscard.splice(0);
          m.unoDiscard = [keep];
        }
        const drawn = m.unoDeck.pop();
        if (drawn) player.hand.push(drawn);
        player.saidUno = false;
        m.turnIndex = (m.turnIndex + m.unoDirection + m.players.length) % m.players.length;
      } else if (actType === "play") {
        const cardId = String(action.cardId || "");
        const chosenColor = String(action.chosenColor || "red");
        const cardIdx = player.hand.findIndex((c) => c.id === cardId);
        if (cardIdx < 0) throw new Error("Card not in your hand.");
        const card = player.hand[cardIdx];
        const playable = card.color === "wild" || card.color === m.unoActiveColor || card.value === top.value;
        if (!playable) throw new Error("Illegal UNO card play.");
        player.hand.splice(cardIdx, 1);
        m.unoDiscard.push(card);
        m.unoActiveColor = card.color === "wild" ? ["red", "blue", "green", "yellow"].includes(chosenColor) ? chosenColor : "red" : card.color;
        if (player.hand.length === 0) {
          player.score += 100;
          m.winnerUid = player.uid;
          m.status = "finished";
          finishedJustNow = true;
        } else {
          let steps = 1;
          if (card.value === "reverse") {
            if (m.players.length === 2) steps = 2;
            else m.unoDirection = m.unoDirection === 1 ? -1 : 1;
          } else if (card.value === "skip") {
            steps = 2;
          } else if (card.value === "+2" || card.value === "+4") {
            const drawCount = card.value === "+4" ? 4 : 2;
            const victimIdx = (m.turnIndex + m.unoDirection + m.players.length) % m.players.length;
            for (let k = 0; k < drawCount; k++) {
              const d = m.unoDeck.pop();
              if (d) m.players[victimIdx].hand.push(d);
            }
            steps = 2;
          }
          m.turnIndex = (m.turnIndex + steps * m.unoDirection + m.players.length * 4) % m.players.length;
        }
      } else if (actType === "call_uno") {
        if (player.hand.length <= 2) player.saidUno = true;
      }
    } else if (m.gameType === "carrom") {
      if (m.turnIndex !== playerIdx) throw new Error("Not your turn.");
      const angle = Number(action.angle ?? 0);
      const power = Math.max(0.2, Math.min(1, Number(action.power ?? 0.6)));
      const strikerX = Math.max(85, Math.min(335, Number(action.strikerX ?? 210)));
      if (!Number.isFinite(angle)) throw new Error("Invalid shot angle.");
      const discs = m.carromDiscs;
      const activeDiscs = discs.filter((d) => !d.pocketed);
      const sx = strikerX;
      const sy = 344;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let scored = false;
      let bestDisc = null;
      let bestProj = Infinity;
      for (const d of activeDiscs) {
        const vx = d.x - sx;
        const vy = d.y - sy;
        const proj = vx * dx + vy * dy;
        if (proj <= 0 || proj > 360 * power) continue;
        const perp = Math.abs(vx * -dy + vy * dx);
        if (perp <= 28 && proj < bestProj) {
          bestProj = proj;
          bestDisc = d;
        }
      }
      const player = m.players[playerIdx];
      if (bestDisc) {
        const pocketChance = power >= 0.45 && bestProj < 320;
        if (pocketChance) {
          bestDisc.pocketed = true;
          scored = true;
          if (bestDisc.color === "queen") {
            player.score += 30;
            m.carromQueenClaimedBy = player.uid;
          } else {
            player.score += bestDisc.color === "white" ? 20 : 10;
          }
        } else {
          bestDisc.x = Math.max(55, Math.min(365, Math.round(bestDisc.x + dx * 45 * power)));
          bestDisc.y = Math.max(55, Math.min(365, Math.round(bestDisc.y + dy * 45 * power)));
        }
      }
      const remaining = discs.filter((d) => !d.pocketed).length;
      if (remaining === 0) {
        const sorted = [...m.players].sort((a, b) => b.score - a.score);
        m.winnerUid = sorted[0].uid;
        m.status = "finished";
        finishedJustNow = true;
      } else if (!scored) {
        m.turnIndex = (m.turnIndex + 1) % m.players.length;
      }
    } else if (m.gameType === "laser_tag") {
      const player = m.players[playerIdx];
      const actType = String(action.type || "");
      const now = Date.now();
      if (m.laserEndsAt && now >= m.laserEndsAt) {
        const sorted = [...m.players].sort((a, b) => b.score - a.score);
        m.winnerUid = sorted[0].uid;
        m.status = "finished";
        finishedJustNow = true;
      } else if (actType === "move") {
        const nextX = Math.max(24, Math.min(676, Number(action.x ?? player.x ?? 200)));
        const nextY = Math.max(24, Math.min(416, Number(action.y ?? player.y ?? 200)));
        const dist = Math.hypot(nextX - (player.x ?? 200), nextY - (player.y ?? 200));
        if (dist <= 90) {
          player.x = nextX;
          player.y = nextY;
        }
      } else if (actType === "fire") {
        if (player.lastShotAt && now - player.lastShotAt < 320) {
          return { match: m, finishedJustNow: false };
        }
        player.lastShotAt = now;
        const aimAngle = Number(action.angle ?? 0);
        const x1 = player.x ?? 200;
        const y1 = player.y ?? 200;
        const dx = Math.cos(aimAngle);
        const dy = Math.sin(aimAngle);
        let hitPlayer;
        let hitDist = 720;
        for (const target of m.players) {
          if (target.uid === player.uid || (target.hp ?? 100) <= 0) continue;
          const tx = (target.x ?? 200) - x1;
          const ty = (target.y ?? 200) - y1;
          const proj = tx * dx + ty * dy;
          if (proj <= 0 || proj > hitDist) continue;
          const perp = Math.abs(tx * -dy + ty * dx);
          if (perp <= 24) {
            hitDist = proj;
            hitPlayer = target;
          }
        }
        const x2 = Math.max(10, Math.min(690, Math.round(x1 + dx * Math.min(hitDist, 420))));
        const y2 = Math.max(10, Math.min(430, Math.round(y1 + dy * Math.min(hitDist, 420))));
        if (hitPlayer) {
          player.score += 25;
          player.tags = (player.tags ?? 0) + 1;
          const nextHp = Math.max(0, (hitPlayer.hp ?? 100) - 34);
          hitPlayer.hp = nextHp;
          if (nextHp === 0) {
            player.score += 50;
            hitPlayer.hp = 100;
            hitPlayer.x = 60 + crypto3.randomInt(0, 560);
            hitPlayer.y = 60 + crypto3.randomInt(0, 320);
          }
        }
        m.laserShots = [
          ...(m.laserShots || []).slice(-8),
          {
            id: `ls-${crypto3.randomBytes(3).toString("hex")}`,
            shooterUid: player.uid,
            x1,
            y1,
            x2,
            y2,
            hitUid: hitPlayer?.uid,
            ts: now
          }
        ];
      }
    } else if (m.gameType === "ludo") {
      if (m.turnIndex !== playerIdx) throw new Error("Not your turn.");
      const player = m.players[playerIdx];
      const actType = String(action.type || "");
      const colorOffsets = { red: 0, green: 13, yellow: 26, blue: 39 };
      const safeSquares = /* @__PURE__ */ new Set([0, 8, 13, 21, 26, 34, 39, 47]);
      const tokens = player.ludoTokens || [-1, -1, -1, -1];
      player.ludoTokens = tokens;
      if (actType === "roll") {
        if (!m.ludoMustRoll && m.ludoDice !== null) {
          throw new Error("Select a token to move first.");
        }
        const rolled = crypto3.randomInt(1, 7);
        m.ludoDice = rolled;
        const canMoveAny = tokens.some((pos) => pos === -1 ? rolled === 6 : pos + rolled <= 56);
        if (!canMoveAny) {
          m.ludoDice = null;
          m.ludoMustRoll = true;
          m.turnIndex = (m.turnIndex + 1) % m.players.length;
          m.ludoLastEvent = `${player.name} rolled ${rolled} (no legal move). ${m.players[m.turnIndex].name}'s turn.`;
        } else {
          m.ludoMustRoll = false;
          m.ludoLastEvent = `${player.name} rolled a ${rolled}! Select a token to move.`;
        }
      } else if (actType === "move_token") {
        const dice = m.ludoDice;
        if (!dice || m.ludoMustRoll) throw new Error("Roll the dice first.");
        const tokenIndex = Number(action.tokenIndex);
        if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex > 3) {
          throw new Error("Invalid token index.");
        }
        const curPos = tokens[tokenIndex];
        let nextPos = curPos;
        if (curPos === -1) {
          if (dice !== 6) throw new Error("Need a 6 to deploy a token from yard.");
          nextPos = 0;
        } else {
          if (curPos + dice > 56) throw new Error("Move overshoots Home finish.");
          nextPos = curPos + dice;
        }
        tokens[tokenIndex] = nextPos;
        let capturedName = null;
        if (nextPos >= 0 && nextPos <= 50) {
          const offset = colorOffsets[player.ludoColor || "red"] ?? 0;
          const globalSq = (offset + nextPos) % 52;
          if (!safeSquares.has(globalSq)) {
            for (const opp of m.players) {
              if (opp.uid === player.uid || !opp.ludoTokens) continue;
              const oppOffset = colorOffsets[opp.ludoColor || "green"] ?? 13;
              opp.ludoTokens.forEach((opPos, opIdx) => {
                if (opPos >= 0 && opPos <= 50 && (oppOffset + opPos) % 52 === globalSq) {
                  opp.ludoTokens[opIdx] = -1;
                  player.score += 15;
                  capturedName = opp.name;
                }
              });
            }
          }
        }
        const finishedCount = tokens.filter((p) => p === 56).length;
        if (nextPos === 56) player.score += 25;
        m.ludoDice = null;
        m.ludoMustRoll = true;
        if (finishedCount === 4) {
          m.winnerUid = player.uid;
          m.status = "finished";
          finishedJustNow = true;
          m.ludoLastEvent = `${player.name} brought all 4 tokens Home and won!`;
        } else if (dice === 6 || capturedName || nextPos === 56) {
          m.ludoLastEvent = capturedName ? `${player.name} captured ${capturedName}'s token! Bonus roll!` : nextPos === 56 ? `${player.name} reached Home! Bonus roll!` : `${player.name} rolled 6! Bonus roll!`;
        } else {
          m.turnIndex = (m.turnIndex + 1) % m.players.length;
          m.ludoLastEvent = `${player.name} moved ${dice}. ${m.players[m.turnIndex].name}'s turn.`;
        }
      }
    }
    if (finishedJustNow) {
      await this.persistFinishedMatch(m);
    }
    return { match: m, finishedJustNow };
  }
  async persistFinishedMatch(m) {
    try {
      await db.insert(gameMatches).values({
        id: m.id,
        gameType: m.gameType,
        hostUid: m.hostUid,
        status: "finished",
        winnerUid: m.winnerUid,
        players: m.players.map((p) => ({ uid: p.uid, name: p.name, score: p.score })),
        stateJson: { code: m.code },
        finishedAt: /* @__PURE__ */ new Date()
      }).onConflictDoUpdate({
        target: gameMatches.id,
        set: {
          status: "finished",
          winnerUid: m.winnerUid,
          players: m.players.map((p) => ({ uid: p.uid, name: p.name, score: p.score })),
          finishedAt: /* @__PURE__ */ new Date()
        }
      });
      for (const p of m.players) {
        await recordTaskActionProgress(p.uid, "play_game", 1).catch(() => {
        });
      }
      await db.transaction(async (tx) => {
        for (const p of m.players) {
          const isWinner = m.winnerUid === p.uid;
          const rewardAmount = isWinner ? 2500 : 500;
          const [w] = await tx.select().from(wallets).where(eq4(wallets.userUid, p.uid)).for("update");
          if (!w) continue;
          const nextCoins = Number(w.coins) + rewardAmount;
          await tx.update(wallets).set({ coins: nextCoins, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(wallets.userUid, p.uid));
          await tx.insert(walletTransactions).values({
            txId: `TX-${crypto3.randomBytes(6).toString("hex").toUpperCase()}`,
            userUid: p.uid,
            type: "game_reward",
            amount: rewardAmount,
            balanceAfter: nextCoins,
            referenceType: "game_match",
            referenceId: m.id,
            idempotencyKey: `match-${isWinner ? "win" : "play"}-${m.id}-${p.uid}`,
            description: isWinner ? `Won ${m.gameType.toUpperCase()} multiplayer match (+2,500 Coins)` : `Played ${m.gameType.toUpperCase()} multiplayer match (+500 Coins)`
          });
        }
      });
    } catch (err) {
      console.error("Failed to persist match:", err);
    }
  }
  sanitizeMatchForPlayer(m, viewerUid) {
    const uidToPublic = new Map(m.players.map((p) => [p.uid, p.publicId]));
    const turnPlayer = m.players[m.turnIndex];
    return {
      id: m.id,
      code: m.code,
      gameType: m.gameType,
      hostUid: uidToPublic.get(m.hostUid) || m.hostUid,
      status: m.status,
      turnIndex: m.turnIndex,
      turnPlayerUid: turnPlayer ? turnPlayer.publicId : null,
      winnerUid: m.winnerUid ? uidToPublic.get(m.winnerUid) || m.winnerUid : null,
      unoTopCard: m.unoDiscard?.[m.unoDiscard.length - 1] || null,
      unoActiveColor: m.unoActiveColor || null,
      unoDirection: m.unoDirection || 1,
      carromDiscs: m.carromDiscs || [],
      laserEndsAt: m.laserEndsAt || null,
      laserShots: (m.laserShots || []).map((s) => ({
        ...s,
        shooterUid: uidToPublic.get(s.shooterUid) || s.shooterUid,
        hitUid: s.hitUid ? uidToPublic.get(s.hitUid) || s.hitUid : void 0
      })),
      chatMessages: (m.chatMessages || []).slice(-40),
      ludoDice: m.ludoDice ?? null,
      ludoMustRoll: m.ludoMustRoll ?? true,
      ludoLastEvent: m.ludoLastEvent ?? null,
      players: m.players.map((p) => ({
        uid: p.publicId,
        publicId: p.publicId,
        name: p.name,
        vipLevel: p.vipLevel ?? 0,
        score: p.score,
        connected: p.connected,
        cardCount: p.hand?.length ?? 0,
        hand: p.uid === viewerUid ? p.hand : void 0,
        // Hide opponents' private cards!
        saidUno: p.saidUno,
        x: p.x,
        y: p.y,
        hp: p.hp,
        tags: p.tags,
        ludoColor: p.ludoColor,
        ludoTokens: p.ludoTokens
      }))
    };
  }
};

// server/realtime.ts
function validateSafeChatImageUrl(raw) {
  if (typeof raw !== "string") return null;
  const val = raw.trim();
  if (!val) return null;
  const validData = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(val);
  const validHttps = val.startsWith("https://");
  if (!validData && !validHttps) {
    throw new Error("Only PNG, JPEG, WEBP, GIF, or HTTPS image links are supported.");
  }
  if (val.length > 9e5) {
    throw new Error("Chat photo must be smaller than 900 KB.");
  }
  return val;
}
var RealtimeHub = class {
  constructor(server, authenticateWs, options) {
    this.clients = /* @__PURE__ */ new Map();
    // socketId -> client
    this.userSockets = /* @__PURE__ */ new Map();
    // userUid -> Set<socketId>
    this.roomRosters = /* @__PURE__ */ new Map();
    // roomId -> Map<userUid, participant>
    this.roomGraceTimers = /* @__PURE__ */ new Map();
    this.roomGraceDeadlines = /* @__PURE__ */ new Map();
    this.closingRooms = /* @__PURE__ */ new Set();
    this.gameVoicePeers = /* @__PURE__ */ new Map();
    this.gameEngine = new AuthoritativeGameEngine();
    this.reconnectGraceMs = Math.max(100, Number(options?.reconnectGraceMs ?? 3e4));
    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      verifyClient: (info, done) => {
        authenticateWs(info.req).then(async (auth) => {
          if (!auth) {
            done(false, 401, "Authenticated OG VELOCITY session required.");
            return;
          }
          const user = await getFullUserView(auth.userUid);
          if (!user || user.accountStatus !== "active") {
            done(false, 403, user?.banReason ? `Account banned: ${user.banReason}` : "Account not active.");
            return;
          }
          info.req.__ogvUser = user;
          done(true);
        }).catch(() => done(false, 500, "Realtime authentication error."));
      }
    });
    this.wss.on("connection", async (ws, req) => {
      try {
        const preAuthUser = req.__ogvUser;
        const user = preAuthUser ?? null;
        if (!user || user.accountStatus !== "active") {
          ws.close(4403, "Account not active.");
          return;
        }
        const socketId = `ws-${crypto4.randomBytes(6).toString("hex")}`;
        const client = {
          socketId,
          ws,
          userUid: user.uid,
          publicId: user.publicId,
          name: user.name,
          photoUrl: user.photoUrl,
          vipLevel: user.vipLevel,
          role: user.role,
          roomId: null
        };
        this.clients.set(socketId, client);
        if (!this.userSockets.has(user.uid)) this.userSockets.set(user.uid, /* @__PURE__ */ new Set());
        this.userSockets.get(user.uid).add(socketId);
        void touchUserLastSeen(user.uid);
        this.sendToSocket(ws, {
          type: "welcome",
          socketId,
          userUid: user.publicId,
          publicId: user.publicId,
          onlineUsers: Array.from(new Set(Array.from(this.clients.values()).map((c) => c.publicId)))
        });
        this.broadcastAll({
          type: "presence:update",
          userUid: user.publicId,
          publicId: user.publicId,
          online: true,
          lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        ws.on("message", (raw) => {
          this.handleMessage(client, String(raw)).catch((err) => {
            this.sendToSocket(ws, {
              type: "error",
              message: err instanceof Error ? err.message : "Realtime operation failed."
            });
          });
        });
        ws.on("close", () => {
          this.handleDisconnect(client);
        });
      } catch {
        ws.close(1011, "Realtime auth failed");
      }
    });
  }
  sendToSocket(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
  sendToUser(userUid, payload) {
    const ids = this.userSockets.get(userUid);
    if (!ids) return;
    for (const sid of ids) {
      const c = this.clients.get(sid);
      if (c) this.sendToSocket(c.ws, payload);
    }
  }
  disconnectBannedUser(userUid, reason) {
    const ids = this.userSockets.get(userUid);
    if (!ids) return;
    for (const sid of Array.from(ids)) {
      const c = this.clients.get(sid);
      if (!c) continue;
      this.sendToSocket(c.ws, { type: "auth:banned", reason });
      try {
        c.ws.close(4403, reason.slice(0, 100));
      } catch {
      }
    }
  }
  async enforceRealtimeBan(userUid, banType, reason) {
    if (banType === "complete") {
      this.disconnectBannedUser(userUid, reason);
      return;
    }
    for (const [roomId, roster] of this.roomRosters.entries()) {
      const p = roster.get(userUid);
      if (!p) continue;
      if (banType === "mic") {
        p.isMuted = true;
        p.isSpeaking = false;
        await db.update(roomParticipants).set({ isMuted: true, isSpeaking: false }).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, userUid))).catch(() => {
        });
        this.broadcastToRoom(roomId, {
          type: "room:roster-updated",
          roomId,
          participants: this.getPublicRoomParticipants(roomId)
        });
      } else if (banType === "seat") {
        p.seatIndex = null;
        p.isMuted = true;
        p.isSpeaking = false;
        await db.update(roomParticipants).set({ seatIndex: null, isMuted: true, isSpeaking: false }).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, userUid))).catch(() => {
        });
        this.broadcastToRoom(roomId, {
          type: "room:roster-updated",
          roomId,
          participants: this.getPublicRoomParticipants(roomId)
        });
      }
    }
    this.sendToUser(userUid, {
      type: "error",
      message: `${banType.toUpperCase()} restriction applied: ${reason}`
    });
  }
  broadcastAll(payload) {
    for (const c of this.clients.values()) {
      this.sendToSocket(c.ws, payload);
    }
  }
  broadcastToRoom(roomId, payload, exceptUserUid) {
    for (const c of this.clients.values()) {
      if (c.roomId === roomId && (!exceptUserUid || c.userUid !== exceptUserUid)) {
        this.sendToSocket(c.ws, payload);
      }
    }
  }
  isUserOnline(userUid) {
    const s = this.userSockets.get(userUid);
    return Boolean(s && s.size > 0);
  }
  getRoomParticipants(roomId) {
    const map = this.roomRosters.get(roomId);
    return map ? Array.from(map.values()) : [];
  }
  toPublicParticipant(p) {
    return {
      ...p,
      userUid: p.publicId,
      publicId: p.publicId
    };
  }
  getPublicRoomParticipants(roomId) {
    return this.getRoomParticipants(roomId).map((p) => this.toPublicParticipant(p));
  }
  async refreshParticipantSocialState(userUids) {
    const cleanUids = Array.from(new Set(userUids.map((u) => String(u || "").trim()).filter(Boolean)));
    if (cleanUids.length === 0) return;
    const tagsByUid = /* @__PURE__ */ new Map();
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
            status: t.status
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
          type: "room:roster-updated",
          roomId,
          participants: this.getPublicRoomParticipants(roomId)
        });
      }
    }
  }
  async resolveTargetInternalUid(identifier) {
    const trimmed = String(identifier || "").trim();
    if (!trimmed) return null;
    for (const c of this.clients.values()) {
      if (c.publicId === trimmed || c.userUid === trimmed) {
        return { uid: c.userUid, publicId: c.publicId };
      }
    }
    const found = await resolveUserByUidOrPublicId(trimmed);
    return found ? { uid: found.uid, publicId: found.publicId } : null;
  }
  getOfficialRoomsWithLiveAppAdmin() {
    const activeSet = /* @__PURE__ */ new Set();
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
  clearRoomGraceTimer(roomId) {
    const existing = this.roomGraceTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.roomGraceTimers.delete(roomId);
    }
    this.roomGraceDeadlines.delete(roomId);
  }
  isRoomHostOrAdminInRoster(room, roster) {
    if (!roster || roster.size === 0) return false;
    if (room.isOfficial) {
      return Array.from(roster.values()).some((p) => isAppAdminRole(p.accountRole));
    }
    if (room.ownerUid && room.ownerUid !== "system-official" && roster.has(room.ownerUid)) {
      return true;
    }
    const adminUids = Array.isArray(room.adminUids) ? room.adminUids : [];
    return adminUids.some((uid) => Boolean(uid && roster.has(uid)));
  }
  scheduleRoomGraceTimer(roomId, broadcastWarning = true) {
    this.clearRoomGraceTimer(roomId);
    const expiresAt = Date.now() + this.reconnectGraceMs;
    const timer = setTimeout(() => {
      this.roomGraceTimers.delete(roomId);
      this.roomGraceDeadlines.delete(roomId);
      void (async () => {
        try {
          const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
          if (!room || room.status === "closed") return;
          const roster = this.roomRosters.get(roomId);
          if (!this.isRoomHostOrAdminInRoster(room, roster)) {
            await this.closeRoom(roomId, DEFAULT_ROOM_CLOSED_REASON);
          }
        } catch (err) {
          console.error("[RealtimeHub] Grace timer room check failed:", err);
        }
      })();
    }, this.reconnectGraceMs);
    timer.unref?.();
    this.roomGraceTimers.set(roomId, timer);
    this.roomGraceDeadlines.set(roomId, expiresAt);
    if (broadcastWarning) {
      this.broadcastToRoom(roomId, {
        type: "room:host-reconnecting",
        roomId,
        graceSeconds: Math.max(1, Math.round(this.reconnectGraceMs / 1e3)),
        expiresAt
      });
    }
  }
  scheduleInitialRoomGrace(roomId) {
    const roster = this.roomRosters.get(roomId);
    if (!roster || roster.size === 0) {
      this.scheduleRoomGraceTimer(roomId, false);
    }
  }
  getRoomGraceDeadline(roomId) {
    return this.roomGraceDeadlines.get(roomId) ?? null;
  }
  async closeRoom(roomId, reason = DEFAULT_ROOM_CLOSED_REASON) {
    if (this.closingRooms.has(roomId)) return false;
    this.closingRooms.add(roomId);
    try {
      this.clearRoomGraceTimer(roomId);
      const [closedRoom] = await db.update(voiceRooms).set({
        status: "closed",
        closedAt: /* @__PURE__ */ new Date(),
        closedReason: reason,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(and2(eq5(voiceRooms.id, roomId), eq5(voiceRooms.status, "active"))).returning();
      const [fallbackRoom] = closedRoom ? [closedRoom] : await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      const affectedClients = Array.from(this.clients.values()).filter((c) => c.roomId === roomId);
      const roster = this.roomRosters.get(roomId);
      if (roster) {
        for (const p of roster.values()) {
          p.seatIndex = null;
          p.isMuted = true;
          p.isSpeaking = false;
          if (p.role === "speaker") p.role = "listener";
        }
      }
      await db.update(roomParticipants).set({ seatIndex: null, isMuted: true, isSpeaking: false, role: "listener" }).where(eq5(roomParticipants.roomId, roomId)).catch(() => {
      });
      const statusPayload = {
        type: "room:status-changed",
        roomId,
        status: "closed",
        roomTitle: fallbackRoom?.title || "Voice Room",
        reason: fallbackRoom?.closedReason || reason
      };
      for (const c of affectedClients) {
        this.sendToSocket(c.ws, statusPayload);
      }
      this.broadcastToRoom(roomId, {
        type: "room:roster-updated",
        roomId,
        participants: this.getPublicRoomParticipants(roomId)
      });
      if (closedRoom) {
        this.broadcastAll({
          type: "room:list-updated",
          updatedRoomId: roomId
        });
      }
      return Boolean(closedRoom);
    } finally {
      this.closingRooms.delete(roomId);
    }
  }
  async evaluateRoomPresence(roomId, opts) {
    const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
    if (!room) return;
    if (room.status === "closed") {
      this.clearRoomGraceTimer(roomId);
      return;
    }
    const roster = this.roomRosters.get(roomId);
    if (this.isRoomHostOrAdminInRoster(room, roster)) {
      if (this.roomGraceTimers.has(roomId)) {
        this.clearRoomGraceTimer(roomId);
        this.broadcastToRoom(roomId, {
          type: "room:host-reconnected",
          roomId
        });
      }
      return;
    }
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
  async syncRoomAdmins(roomId, nextAdminUids, publicAdminUids) {
    const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
    if (!room || room.status === "closed") return;
    const roster = this.roomRosters.get(roomId);
    if (roster) {
      for (const participant of roster.values()) {
        if (participant.userUid === room.ownerUid) {
          participant.role = "owner";
          continue;
        }
        const isNowAdmin = nextAdminUids.includes(participant.userUid);
        const nextRole = isNowAdmin ? "admin" : participant.seatIndex !== null ? "speaker" : "listener";
        if (participant.role !== nextRole) {
          participant.role = nextRole;
          await db.update(roomParticipants).set({ role: nextRole, lastActiveAt: /* @__PURE__ */ new Date() }).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, participant.userUid))).catch(() => {
          });
        }
      }
      this.broadcastToRoom(roomId, {
        type: "room:roster-updated",
        roomId,
        participants: this.getPublicRoomParticipants(roomId)
      });
    }
    this.broadcastToRoom(roomId, {
      type: "room:admins-updated",
      roomId,
      adminUids: publicAdminUids
    });
    await this.evaluateRoomPresence(roomId, {
      intentionalLeave: true,
      disconnectedWasHost: true
    });
  }
  async forceUserLeaveRoom(roomId, userUid, opts = {}) {
    const intentional = opts.intentional ?? true;
    let publicId = userUid;
    for (const c of this.clients.values()) {
      if (c.userUid === userUid && c.roomId === roomId) {
        c.roomId = null;
        publicId = c.publicId;
      }
    }
    const roster = this.roomRosters.get(roomId);
    const wasInRoster = Boolean(roster?.has(userUid));
    if (roster) {
      roster.delete(userUid);
      if (roster.size === 0) this.roomRosters.delete(roomId);
    }
    await db.delete(roomParticipants).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, userUid))).catch(() => {
    });
    if (wasInRoster) {
      this.broadcastToRoom(roomId, {
        type: "room:participant-left",
        roomId,
        userUid: publicId,
        participants: this.getPublicRoomParticipants(roomId)
      });
    }
    const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
    const leftUserView = room?.isOfficial ? await getFullUserView(userUid).catch(() => null) : null;
    const disconnectedWasHost = Boolean(
      room && (room.isOfficial ? isAppAdminRole(leftUserView?.role) : room.ownerUid === userUid || Array.isArray(room.adminUids) && room.adminUids.includes(userUid))
    );
    await this.evaluateRoomPresence(roomId, {
      intentionalLeave: intentional,
      disconnectedWasHost
    });
  }
  shutdown() {
    for (const timer of this.roomGraceTimers.values()) {
      clearTimeout(timer);
    }
    this.roomGraceTimers.clear();
    this.roomGraceDeadlines.clear();
    this.wss.close();
  }
  async handleDisconnect(client) {
    this.clients.delete(client.socketId);
    const set = this.userSockets.get(client.userUid);
    if (set) {
      set.delete(client.socketId);
      if (set.size === 0) {
        this.userSockets.delete(client.userUid);
        const lastSeenAt = (/* @__PURE__ */ new Date()).toISOString();
        void touchUserLastSeen(client.userUid);
        this.broadcastAll({
          type: "presence:update",
          userUid: client.publicId,
          publicId: client.publicId,
          online: false,
          lastSeenAt
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
            this.sendToUser(p.uid, { type: "game:voice-peers", matchId: activeMatch.id, peers });
          }
          if (peerMap.size === 0) this.gameVoicePeers.delete(activeMatch.id);
        }
      }
      this.broadcastMatchSync(activeMatch.id);
    }
  }
  async leaveRoom(client, opts = { intentional: true }) {
    const roomId = client.roomId;
    if (!roomId) return;
    client.roomId = null;
    const hasOtherSocketInRoom = Array.from(this.clients.values()).some(
      (c) => c.userUid === client.userUid && c.roomId === roomId
    );
    if (hasOtherSocketInRoom) return;
    const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
    const disconnectedWasHost = Boolean(
      room && (room.isOfficial ? isAppAdminRole(client.role) : room.ownerUid === client.userUid || Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid))
    );
    const roster = this.roomRosters.get(roomId);
    if (roster) {
      roster.delete(client.userUid);
      if (roster.size === 0) this.roomRosters.delete(roomId);
    }
    await db.delete(roomParticipants).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, client.userUid))).catch(() => {
    });
    this.broadcastToRoom(roomId, {
      type: "room:participant-left",
      roomId,
      userUid: client.publicId,
      participants: this.getPublicRoomParticipants(roomId)
    });
    await this.evaluateRoomPresence(roomId, {
      intentionalLeave: opts.intentional,
      disconnectedWasHost
    });
  }
  broadcastMatchSync(matchId) {
    const match = this.gameEngine.getMatch(matchId);
    if (!match) return;
    for (const p of match.players) {
      this.sendToUser(p.uid, {
        type: "game:sync",
        match: this.gameEngine.sanitizeMatchForPlayer(match, p.uid)
      });
    }
  }
  async handleMessage(client, raw) {
    const msg = JSON.parse(raw);
    const type = String(msg.type || "");
    if (type === "room:join") {
      const requestedRoomId = String(msg.roomId || "").trim();
      if (!requestedRoomId) throw new Error("Missing roomId.");
      await ensureVoiceRoomsHaveOwners().catch(() => {
      });
      const [room] = await db.select().from(voiceRooms).where(or3(eq5(voiceRooms.id, requestedRoomId), eq5(voiceRooms.roomCode, requestedRoomId)));
      if (!room) throw new Error("Voice room not found.");
      const roomId = room.id;
      const isAppAdmin = isAppAdminRole(client.role);
      const isOwner = room.ownerUid === client.userUid;
      const isRoomAdmin = room.isOfficial ? isAppAdmin : Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      const existingRoster = this.roomRosters.get(roomId);
      const isJoiningAuthorizedHost = room.isOfficial ? isAppAdmin : isOwner || isRoomAdmin;
      const hasHostOrAdminOnline = isJoiningAuthorizedHost || this.isRoomHostOrAdminInRoster(room, existingRoster);
      let effectiveRoomStatus = room.status;
      let effectiveClosedReason = room.closedReason;
      if (hasHostOrAdminOnline) {
        if (room.status === "closed") {
          await db.update(voiceRooms).set({ status: "active", closedAt: null, closedReason: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(voiceRooms.id, roomId));
          effectiveRoomStatus = "active";
          effectiveClosedReason = null;
          this.broadcastToRoom(roomId, {
            type: "room:status-changed",
            roomId,
            status: "active",
            reason: null
          });
          this.broadcastAll({ type: "room:list-updated", updatedRoomId: roomId });
        }
      } else if (!this.roomGraceTimers.has(roomId)) {
        effectiveRoomStatus = "closed";
        effectiveClosedReason = room.closedReason || DEFAULT_ROOM_CLOSED_REASON;
        if (room.status !== "closed") {
          await db.update(voiceRooms).set({
            status: "closed",
            closedAt: /* @__PURE__ */ new Date(),
            closedReason: effectiveClosedReason,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq5(voiceRooms.id, roomId));
          this.broadcastAll({ type: "room:list-updated", updatedRoomId: roomId });
        }
      }
      const roomCfg = room.roomSettings && typeof room.roomSettings === "object" ? room.roomSettings : {};
      const blockedList = Array.isArray(roomCfg.blockedUids) ? roomCfg.blockedUids.map((u) => String(u).trim()) : [];
      const isRoomOwnerOrAppAdmin = room.ownerUid === client.userUid || isAppAdminRole(client.role);
      if (!isRoomOwnerOrAppAdmin && (blockedList.includes(client.publicId) || blockedList.includes(client.userUid))) {
        throw new Error("You are on this room's blocklist and cannot enter.");
      }
      if (client.roomId && client.roomId !== roomId) {
        await this.leaveRoom(client, { intentional: true });
      }
      client.roomId = roomId;
      if (!this.roomRosters.has(roomId)) this.roomRosters.set(roomId, /* @__PURE__ */ new Map());
      const roster = this.roomRosters.get(roomId);
      const [liveUser, activeBans, userTags] = await Promise.all([
        getFullUserView(client.userUid),
        getActiveUserBans(client.userUid),
        getUserRelationshipTags(client.userUid, { activeOnly: true }).catch(() => [])
      ]);
      const effectiveAccountRole = liveUser?.role || client.role;
      client.role = effectiveAccountRole;
      const isAppAdminLive = isAppAdminRole(effectiveAccountRole);
      const isAdminLive = room.isOfficial ? isAppAdminLive : Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      const isMicBanned = activeBans.some((b) => b.banType === "mic" || b.banType === "complete");
      const isSeatBanned = activeBans.some((b) => b.banType === "seat" || b.banType === "complete");
      const role = isOwner ? "owner" : isAdminLive ? "admin" : "listener";
      const initialSeat = isOwner && !isSeatBanned && effectiveRoomStatus === "active" ? 0 : null;
      const participant = {
        userUid: client.userUid,
        publicId: client.publicId,
        name: liveUser?.name || client.name,
        photoUrl: liveUser?.photoUrl ?? client.photoUrl,
        equippedFrameId: liveUser?.equippedFrameId ?? null,
        vipLevel: liveUser?.vipLevel ?? client.vipLevel,
        accountRole: effectiveAccountRole,
        seatIndex: initialSeat,
        role,
        isMuted: isMicBanned || effectiveRoomStatus === "closed",
        isSpeaking: false,
        relationshipTags: userTags.map((t) => ({
          id: t.id,
          partnerUid: t.partnerUid,
          partnerName: t.partnerName,
          tagType: t.tagType,
          level: t.level,
          charmScore: t.charmScore,
          status: t.status
        }))
      };
      roster.set(client.userUid, participant);
      await db.insert(roomParticipants).values({
        roomId,
        userUid: client.userUid,
        displayName: client.name,
        seatIndex: initialSeat,
        role,
        isMuted: participant.isMuted,
        isSpeaking: false
      }).onConflictDoUpdate({
        target: [roomParticipants.roomId, roomParticipants.userUid],
        set: { seatIndex: initialSeat, role, isMuted: participant.isMuted, lastActiveAt: /* @__PURE__ */ new Date() }
      });
      await recordTaskActionProgress(client.userUid, "voice_time", 1).catch(() => {
      });
      const isAuthorizedHostPresence = room.isOfficial ? isAppAdminLive : isOwner || isAdminLive;
      if (isAuthorizedHostPresence) {
        if (this.roomGraceTimers.has(roomId)) {
          this.clearRoomGraceTimer(roomId);
          this.broadcastToRoom(
            roomId,
            { type: "room:host-reconnected", roomId },
            client.userUid
          );
        }
      } else if (effectiveRoomStatus === "active" && !this.isRoomHostOrAdminInRoster(room, roster) && !this.roomGraceTimers.has(roomId)) {
        await this.closeRoom(roomId, DEFAULT_ROOM_CLOSED_REASON);
        effectiveRoomStatus = "closed";
        effectiveClosedReason = DEFAULT_ROOM_CLOSED_REASON;
      }
      const recentMsgs = await db.select().from(messages).where(eq5(messages.threadId, roomId)).limit(40);
      const msgUidMap = await mapUidsToPublicIds(recentMsgs.map((m) => m.senderUid));
      const publicMessages = recentMsgs.map((m) => ({
        ...m,
        senderUid: msgUidMap[m.senderUid] || m.senderUid,
        senderPublicId: msgUidMap[m.senderUid] || m.senderUid
      }));
      const publicRoster = this.getPublicRoomParticipants(roomId);
      this.sendToSocket(client.ws, {
        type: "room:joined",
        roomId,
        roomStatus: effectiveRoomStatus,
        closedReason: effectiveClosedReason || null,
        participants: publicRoster,
        messages: publicMessages
      });
      this.broadcastToRoom(
        roomId,
        {
          type: "room:participant-joined",
          roomId,
          participant: this.toPublicParticipant(participant),
          participants: publicRoster
        },
        client.userUid
      );
      if (client.vipLevel >= 6) {
        this.broadcastToRoom(roomId, {
          type: "room:vip-entrance",
          roomId,
          userUid: client.publicId,
          name: client.name,
          vipLevel: client.vipLevel,
          fullScreenCinematic: client.vipLevel >= 15
        });
      }
      return;
    }
    if (type === "room:leave") {
      await this.leaveRoom(client, { intentional: true });
      return;
    }
    if (type === "room:seat-take") {
      await assertUserNotBanned(client.userUid, ["seat", "complete"]);
      const roomId = client.roomId;
      if (!roomId) throw new Error("Join a room first.");
      const seatIndex = Number(msg.seatIndex);
      const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      if (!room) throw new Error("Voice room not found.");
      if (room.status === "closed") {
        throw new Error(
          "This VR is currently closed. Seats open when the owner, co-owner, or an admin is here."
        );
      }
      const roster = this.roomRosters.get(roomId);
      const self = roster?.get(client.userUid);
      if (!roster || !self) throw new Error("Not inside room.");
      if (seatIndex === 0 && room.ownerUid !== client.userUid) {
        throw new Error("The Owner seat is reserved exclusively for the room owner.");
      }
      if (room.ownerUid === client.userUid && seatIndex !== 0) {
        throw new Error("The room Owner stays on Seat 0 and cannot move positions.");
      }
      if (seatIndex < 0 || seatIndex >= room.seatCapacity) {
        throw new Error("Invalid seat index for this room.");
      }
      const lockedSeats = Array.isArray(room.lockedSeats) ? room.lockedSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
      if (lockedSeats.includes(seatIndex)) {
        throw new Error("This seat is currently locked by the host.");
      }
      const seatCfg = room.roomSettings && typeof room.roomSettings === "object" ? room.roomSettings : {};
      const partnerSeatMode = String(seatCfg.partnerSeatMode || "Enable All");
      const isSeatHostOrAdmin = room.ownerUid === client.userUid || (room.isOfficial ? isAppAdminRole(client.role) : Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid));
      if (!isSeatHostOrAdmin && (partnerSeatMode === "Locked" || partnerSeatMode === "Owner & Admins")) {
        throw new Error(
          partnerSeatMode === "Locked" ? "Partner seats are currently locked by the room host." : "Only the room Owner and Admins can take a seat right now."
        );
      }
      const activeSpeakers = Array.from(roster.values()).filter((p) => p.seatIndex !== null);
      if (self.seatIndex === null && activeSpeakers.length >= room.activeSpeakerSlots) {
        throw new Error(`Maximum ${room.activeSpeakerSlots} active speaker seats are currently full.`);
      }
      const occupied = Array.from(roster.values()).find(
        (p) => p.seatIndex === seatIndex && p.userUid !== client.userUid
      );
      if (occupied) throw new Error("Seat is already occupied.");
      self.seatIndex = seatIndex;
      if (self.role === "listener") self.role = "speaker";
      await db.update(roomParticipants).set({ seatIndex, role: self.role, lastActiveAt: /* @__PURE__ */ new Date() }).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, client.userUid)));
      this.broadcastToRoom(roomId, {
        type: "room:roster-updated",
        roomId,
        participants: this.getPublicRoomParticipants(roomId)
      });
      return;
    }
    if (type === "room:seat-lock") {
      const roomId = client.roomId;
      if (!roomId) throw new Error("Join a room first.");
      const seatIndex = Number(msg.seatIndex);
      const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      if (!room || room.status === "closed") return;
      const canModerate = room.isOfficial ? isAppAdminRole(client.role) : room.ownerUid === client.userUid || Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      if (!canModerate) {
        throw new Error(
          room.isOfficial ? "Only authorized App Admins can lock seats in Official Rooms." : "Only the room Owner or Room Admin can lock seats."
        );
      }
      if (!Number.isInteger(seatIndex) || seatIndex <= 0 || seatIndex >= room.seatCapacity) {
        throw new Error("Seat 0 is permanently reserved for the Owner and cannot be locked.");
      }
      const currentLocked = Array.isArray(room.lockedSeats) ? room.lockedSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
      const shouldLock = typeof msg.locked === "boolean" ? msg.locked : !currentLocked.includes(seatIndex);
      const nextLocked = shouldLock ? Array.from(/* @__PURE__ */ new Set([...currentLocked, seatIndex])).sort((a, b) => a - b) : currentLocked.filter((n) => n !== seatIndex);
      await db.update(voiceRooms).set({ lockedSeats: nextLocked, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(voiceRooms.id, roomId));
      if (shouldLock) {
        const roster = this.roomRosters.get(roomId);
        const occupant = roster ? Array.from(roster.values()).find((p) => p.seatIndex === seatIndex && p.userUid !== room.ownerUid) : void 0;
        if (occupant) {
          occupant.seatIndex = null;
          occupant.isSpeaking = false;
          if (occupant.role === "speaker") occupant.role = "listener";
          await db.update(roomParticipants).set({ seatIndex: null, role: occupant.role, isSpeaking: false, lastActiveAt: /* @__PURE__ */ new Date() }).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, occupant.userUid))).catch(() => {
          });
        }
      }
      this.broadcastToRoom(roomId, {
        type: "room:seat-locks-updated",
        roomId,
        lockedSeats: nextLocked
      });
      this.broadcastToRoom(roomId, {
        type: "room:roster-updated",
        roomId,
        participants: this.getPublicRoomParticipants(roomId)
      });
      return;
    }
    if (type === "room:seat-leave") {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      if (!room || room.status === "closed") return;
      if (room.ownerUid === client.userUid) {
        throw new Error("Room owner cannot vacate Seat 0.");
      }
      const roster = this.roomRosters.get(roomId);
      const self = roster?.get(client.userUid);
      if (!self) return;
      self.seatIndex = null;
      self.isSpeaking = false;
      if (self.role === "speaker") self.role = "listener";
      await db.update(roomParticipants).set({ seatIndex: null, role: self.role, isSpeaking: false, lastActiveAt: /* @__PURE__ */ new Date() }).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, client.userUid))).catch(() => {
      });
      this.broadcastToRoom(roomId, {
        type: "room:roster-updated",
        roomId,
        participants: this.getPublicRoomParticipants(roomId)
      });
      return;
    }
    if (type === "room:mute" || type === "room:speaking") {
      const roomId = client.roomId;
      if (!roomId) return;
      const roster = this.roomRosters.get(roomId);
      const self = roster?.get(client.userUid);
      if (!self) return;
      const activeBans = await getActiveUserBans(client.userUid).catch(() => []);
      const micBan = activeBans.find((b) => b.banType === "mic" || b.banType === "complete");
      if (micBan) {
        self.isMuted = true;
        self.isSpeaking = false;
        if (type === "room:mute" && msg.isMuted === false || type === "room:speaking" && msg.isSpeaking) {
          this.sendToSocket(client.ws, {
            type: "error",
            message: `Microphone banned${micBan.expiresAt ? ` until ${new Date(micBan.expiresAt).toLocaleDateString()}` : " permanently"}: ${micBan.reason}`
          });
        }
      } else {
        if (type === "room:mute") self.isMuted = Boolean(msg.isMuted);
        if (type === "room:speaking") self.isSpeaking = !self.isMuted && Boolean(msg.isSpeaking);
      }
      this.broadcastToRoom(roomId, {
        type: "room:roster-updated",
        roomId,
        participants: this.getPublicRoomParticipants(roomId)
      });
      return;
    }
    if (type === "room:kick" || type === "room:force-mute") {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      if (!room || room.status === "closed") return;
      const roster = this.roomRosters.get(roomId);
      const actor = roster?.get(client.userUid);
      const canModerate = room.isOfficial ? isAppAdminRole(client.role) : room.ownerUid === client.userUid || actor?.role === "admin" || actor?.role === "moderator" || Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      if (!canModerate) {
        throw new Error(
          room.isOfficial ? "Only authorized App Admins can moderate Official Rooms." : "Owner or room admin permission required."
        );
      }
      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ""));
      const targetUid = resolvedTarget?.uid || "";
      if (!targetUid) return;
      if (targetUid === room.ownerUid) throw new Error("Cannot moderate the room owner.");
      const target = roster?.get(targetUid);
      if (!target) return;
      if (type === "room:force-mute") {
        target.isMuted = Boolean(msg.isMuted ?? true);
        target.isSpeaking = false;
        this.broadcastToRoom(roomId, {
          type: "room:roster-updated",
          roomId,
          participants: this.getPublicRoomParticipants(roomId)
        });
      } else {
        target.seatIndex = null;
        target.isSpeaking = false;
        roster?.delete(targetUid);
        for (const c of this.clients.values()) {
          if (c.userUid === targetUid && c.roomId === roomId) {
            c.roomId = null;
          }
        }
        await db.delete(roomParticipants).where(and2(eq5(roomParticipants.roomId, roomId), eq5(roomParticipants.userUid, targetUid))).catch(() => {
        });
        this.sendToUser(targetUid, { type: "room:kicked", roomId });
        this.broadcastToRoom(roomId, {
          type: "room:roster-updated",
          roomId,
          participants: this.getPublicRoomParticipants(roomId)
        });
      }
      return;
    }
    if (type === "room:chat") {
      await assertUserNotBanned(client.userUid, ["chat", "complete"]);
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select({
        status: voiceRooms.status,
        ownerUid: voiceRooms.ownerUid,
        adminUids: voiceRooms.adminUids,
        isOfficial: voiceRooms.isOfficial,
        roomSettings: voiceRooms.roomSettings
      }).from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      if (!room || room.status === "closed") return;
      const imageUrl = validateSafeChatImageUrl(msg.imageUrl);
      const rawText = String(msg.text || "").trim().slice(0, 500);
      const body = rawText || (imageUrl ? "\u{1F4F7} Photo" : "");
      if (!body && !imageUrl) return;
      const chatCfg = room.roomSettings && typeof room.roomSettings === "object" ? room.roomSettings : {};
      const isMod = room.isOfficial ? isAppAdminRole(client.role) : room.ownerUid === client.userUid || Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      if (!isMod) {
        if (imageUrl && chatCfg.banPhotoChat) {
          throw new Error("Photo chatting is banned in this room.");
        }
        if (!imageUrl && chatCfg.banTextChat) {
          throw new Error("Text chatting is banned in this room.");
        }
      }
      const [saved] = await db.insert(messages).values({
        scope: "room",
        threadId: roomId,
        senderUid: client.userUid,
        body,
        imageUrl,
        kind: imageUrl ? "photo" : "chat"
      }).returning();
      this.broadcastToRoom(roomId, {
        type: "room:chat",
        roomId,
        message: {
          ...saved,
          senderUid: client.publicId,
          senderName: client.name,
          senderPublicId: client.publicId,
          vipLevel: client.vipLevel
        }
      });
      return;
    }
    if (type === "rtc:offer" || type === "rtc:answer" || type === "rtc:ice-candidate") {
      const roomId = client.roomId;
      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ""));
      const targetUid = resolvedTarget?.uid || "";
      if (!roomId || !targetUid) return;
      const roster = this.roomRosters.get(roomId);
      if (!roster?.has(client.userUid) || !roster.has(targetUid)) return;
      this.sendToUser(targetUid, {
        type,
        roomId,
        fromUid: client.publicId,
        fromName: client.name,
        sdp: msg.sdp,
        candidate: msg.candidate
      });
      return;
    }
    if (type === "room:action-update") {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      if (!room || room.status === "closed") return;
      const canControl = room.isOfficial ? isAppAdminRole(client.role) : room.ownerUid === client.userUid || Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      if (!canControl) {
        throw new Error("Only room Host/Admin can update Action Room state.");
      }
      const modeRaw = String(msg.actionMode || "bidding");
      const actionModeMap = {
        bidding: "bidding",
        Bidding: "bidding",
        relationship_advancement: "relationship_advancement",
        "Relationship Advancement": "relationship_advancement",
        music: "music",
        Music: "music"
      };
      const actionMode = actionModeMap[modeRaw] || "bidding";
      const slots = Array.isArray(msg.slots) ? msg.slots.slice(0, 3) : void 0;
      const cfg = room.roomSettings && typeof room.roomSettings === "object" ? { ...room.roomSettings } : {};
      cfg.actionRoom = {
        actionMode,
        slots: slots || cfg.actionRoom?.slots || [null, null, null],
        updatedBy: client.publicId
      };
      await db.update(voiceRooms).set({ roomSettings: cfg, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(voiceRooms.id, roomId));
      this.broadcastToRoom(roomId, {
        type: "room:action-update",
        roomId,
        actionRoom: cfg.actionRoom
      });
      return;
    }
    if (type === "room:emote") {
      const roomId = client.roomId;
      if (!roomId) return;
      const emoteNumber = Math.max(1, Math.min(30, Math.floor(Number(msg.emoteNumber || 1))));
      const label = String(msg.label || "Emote").trim().slice(0, 40) || "Emote";
      const symbol = String(msg.symbol || "\u2728").trim().slice(0, 8) || "\u2728";
      const rawMotion = String(msg.motion || "bounce");
      const motion = ["bounce", "sway", "shake", "pulse"].includes(rawMotion) ? rawMotion : "bounce";
      this.broadcastToRoom(roomId, {
        type: "room:emote",
        roomId,
        userUid: client.publicId,
        emoteNumber,
        label,
        symbol,
        motion,
        triggeredAt: Date.now()
      });
      return;
    }
    if (type === "room:video-sync") {
      const roomId = client.roomId;
      if (!roomId) return;
      const [room] = await db.select().from(voiceRooms).where(eq5(voiceRooms.id, roomId));
      if (!room || room.status === "closed") return;
      const canControl = room.isOfficial ? isAppAdminRole(client.role) : room.ownerUid === client.userUid || Array.isArray(room.adminUids) && room.adminUids.includes(client.userUid);
      if (!canControl) {
        throw new Error("Only room Host/Admin can control Video Room playback.");
      }
      const sourceType = msg.sourceType === "local" ? "local" : "youtube";
      if (sourceType === "local" && Number(room.roomLevel ?? 1) < 15) {
        throw new Error("Mobile Video playback unlocks at Room Level 15.");
      }
      this.broadcastToRoom(roomId, {
        type: "room:video-sync",
        roomId,
        sourceType,
        youtubeUrl: typeof msg.youtubeUrl === "string" ? msg.youtubeUrl.slice(0, 300) : "",
        playing: Boolean(msg.playing),
        title: typeof msg.title === "string" ? msg.title.slice(0, 120) : "",
        updatedBy: client.name
      });
      return;
    }
    if (type === "room:cam-state") {
      const roomId = client.roomId;
      if (!roomId) return;
      this.broadcastToRoom(
        roomId,
        {
          type: "room:cam-state",
          roomId,
          userUid: client.publicId,
          hasCamera: Boolean(msg.hasCamera)
        },
        client.userUid
      );
      return;
    }
    if (type === "dm:send") {
      await assertUserNotBanned(client.userUid, ["chat", "complete"]);
      const rawRecipient = String(msg.recipientUid || "").trim();
      const imageUrl = validateSafeChatImageUrl(msg.imageUrl);
      const rawBody = String(msg.body || "").trim().slice(0, 1500);
      const body = rawBody || (imageUrl ? "\u{1F4F7} Photo" : "");
      if (!rawRecipient || !body && !imageUrl) return;
      const resolvedRecipient = await this.resolveTargetInternalUid(rawRecipient);
      const recipientUid = resolvedRecipient?.uid || rawRecipient;
      const recipientPublicId = resolvedRecipient?.publicId || rawRecipient;
      if (await isBlockedBetween(client.userUid, recipientUid)) {
        throw new Error("Cannot message this user because a block is active.");
      }
      if (!await areUsersAcceptedFriends(client.userUid, recipientUid)) {
        throw new Error("Only accepted friends can send direct messages.");
      }
      const threadId = makeDmThreadId(client.userUid, recipientUid);
      const [saved] = await db.insert(messages).values({
        scope: "dm",
        threadId,
        senderUid: client.userUid,
        recipientUid,
        body,
        imageUrl,
        kind: imageUrl ? "photo" : "chat"
      }).returning();
      const payload = {
        type: "dm:message",
        message: {
          ...saved,
          senderUid: client.publicId,
          recipientUid: recipientPublicId,
          senderName: client.name,
          senderPublicId: client.publicId,
          recipientPublicId
        }
      };
      this.sendToUser(client.userUid, payload);
      this.sendToUser(recipientUid, payload);
      return;
    }
    if (type === "game:matchmake") {
      const gameType = String(msg.gameType || "carrom");
      const match = this.gameEngine.findOrCreateMatchmaking(
        { uid: client.userUid, publicId: client.publicId, name: client.name, vipLevel: client.vipLevel },
        gameType
      );
      this.broadcastMatchSync(match.id);
      return;
    }
    if (type === "game:create") {
      const gameType = String(msg.gameType || "carrom");
      const match = this.gameEngine.createMatch(
        { uid: client.userUid, publicId: client.publicId, name: client.name, vipLevel: client.vipLevel },
        gameType
      );
      this.broadcastMatchSync(match.id);
      return;
    }
    if (type === "game:join") {
      const matchId = String(msg.matchId || "");
      const match = this.gameEngine.joinMatch(matchId, {
        uid: client.userUid,
        publicId: client.publicId,
        name: client.name,
        vipLevel: client.vipLevel
      });
      this.broadcastMatchSync(match.id);
      return;
    }
    if (type === "game:leave") {
      const requestedMatchId = typeof msg.matchId === "string" ? msg.matchId : void 0;
      const res = await this.gameEngine.leaveMatch(client.userUid, requestedMatchId);
      const leftId = res.leftMatchId || requestedMatchId || null;
      if (leftId) {
        const peerMap = this.gameVoicePeers.get(leftId);
        if (peerMap) {
          peerMap.delete(client.userUid);
          const peers = Array.from(peerMap.values());
          for (const p of res.match?.players || []) {
            this.sendToUser(p.uid, { type: "game:voice-peers", matchId: leftId, peers });
          }
          if (peerMap.size === 0) this.gameVoicePeers.delete(leftId);
        }
      }
      this.sendToSocket(client.ws, {
        type: "game:left",
        matchId: leftId
      });
      if (res.match) {
        this.broadcastMatchSync(res.match.id);
      }
      return;
    }
    if (type === "game:chat") {
      await assertUserNotBanned(client.userUid, ["chat", "complete"]);
      const matchId = String(msg.matchId || "");
      const match = this.gameEngine.addChatMessage(matchId, client.userUid, String(msg.text || ""));
      this.broadcastMatchSync(match.id);
      return;
    }
    if (type === "game:voice-join" || type === "game:voice-leave" || type === "game:voice-mute") {
      const matchId = String(msg.matchId || "").trim();
      const match = this.gameEngine.getMatch(matchId);
      if (!match) return;
      if (!match.players.some((p) => p.uid === client.userUid)) return;
      if (!this.gameVoicePeers.has(matchId)) {
        this.gameVoicePeers.set(matchId, /* @__PURE__ */ new Map());
      }
      const peerMap = this.gameVoicePeers.get(matchId);
      if (type === "game:voice-leave") {
        peerMap.delete(client.userUid);
      } else {
        if (type === "game:voice-join" || msg.muted === false) {
          await assertUserNotBanned(client.userUid, ["mic", "complete"]);
        }
        peerMap.set(client.userUid, {
          publicId: client.publicId,
          name: client.name,
          muted: Boolean(msg.muted ?? false)
        });
      }
      const peers = Array.from(peerMap.values());
      for (const p of match.players) {
        this.sendToUser(p.uid, { type: "game:voice-peers", matchId, peers });
      }
      return;
    }
    if (type === "game:rtc-offer" || type === "game:rtc-answer" || type === "game:rtc-ice-candidate") {
      const matchId = String(msg.matchId || "").trim();
      const match = this.gameEngine.getMatch(matchId);
      if (!match) return;
      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ""));
      const targetUid = resolvedTarget?.uid || "";
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
        candidate: msg.candidate
      });
      return;
    }
    if (type === "game:invite") {
      const resolvedTarget = await this.resolveTargetInternalUid(String(msg.targetUid || ""));
      const targetUid = resolvedTarget?.uid || "";
      const matchId = String(msg.matchId || "");
      const match = this.gameEngine.getMatch(matchId);
      if (!match) throw new Error("Match not found.");
      if (!targetUid) throw new Error("Target user not found.");
      this.sendToUser(targetUid, {
        type: "game:invited",
        matchId: match.id,
        gameType: match.gameType,
        fromUid: client.publicId,
        fromName: client.name
      });
      return;
    }
    if (type === "game:start") {
      const matchId = String(msg.matchId || "");
      const match = this.gameEngine.startMatch(matchId, client.userUid);
      this.broadcastMatchSync(match.id);
      return;
    }
    if (type === "game:action") {
      const matchId = String(msg.matchId || "");
      const result = await this.gameEngine.handleAction(
        matchId,
        client.userUid,
        msg.action || {}
      );
      this.broadcastMatchSync(result.match.id);
      return;
    }
  }
};

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var PORT = Number(process.env.PORT || 3e3);
var FIREBASE_PROJECT_ID = "og-velocity";
var FIREBASE_WEB_API_KEY = "AIzaSyCWMhFzpTkrcWEEjGEwkItHtGJ8AYjKg_Q";
var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var SESSION_COOKIE_NAME = "ogv_session";
var ENV_SESSION_SECRET = process.env.SESSION_SECRET?.trim();
var SESSION_SECRET = ENV_SESSION_SECRET && !ENV_SESSION_SECRET.startsWith("MY_") ? ENV_SESSION_SECRET : crypto5.randomBytes(32).toString("hex");
var adminAuthApps = /* @__PURE__ */ new Map();
function getAdminAuthForProject(projectId) {
  const existing = adminAuthApps.get(projectId);
  if (existing) return existing;
  if (projectId === FIREBASE_PROJECT_ID) {
    const appInstance2 = getApps().find((a) => a.name === "[DEFAULT]") || initializeApp({ projectId });
    const authInstance2 = getAdminAuth(appInstance2);
    adminAuthApps.set(projectId, authInstance2);
    return authInstance2;
  }
  const appName = `ogv-${projectId}`;
  const found = getApps().find((a) => a.name === appName);
  const appInstance = found || initializeApp({ projectId }, appName);
  const authInstance = getAdminAuth(appInstance);
  adminAuthApps.set(projectId, authInstance);
  return authInstance;
}
function decodeJwtAudience(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.aud === "string" ? payload.aud : null;
  } catch {
    return null;
  }
}
async function verifyTokenAcrossProjects(idToken) {
  const allowedProjects = Array.from(
    new Set([FIREBASE_PROJECT_ID, firebase_applet_config_default.projectId].filter(Boolean))
  );
  const aud = decodeJwtAudience(idToken);
  const ordered = aud && allowedProjects.includes(aud) ? [aud, ...allowedProjects.filter((p) => p !== aud)] : allowedProjects;
  let lastErr = null;
  for (const projectId of ordered) {
    try {
      return await getAdminAuthForProject(projectId).verifyIdToken(
        idToken
      );
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Firebase ID token verification failed.");
}
getAdminAuthForProject(FIREBASE_PROJECT_ID);
var PRIVILEGED_PROFILE_FIELDS = /* @__PURE__ */ new Set([
  "viplevel",
  "vip_level",
  "vipstatus",
  "vip_status",
  "vipgrowth",
  "vip_growth",
  "vipplanlabel",
  "vip_plan_label",
  "charm",
  "charmpoints",
  "charm_points",
  "coins",
  "giftsreceived",
  "gifts_received",
  "zayroid",
  "zayro_id",
  "publicid",
  "public_id",
  "uid",
  "firebaseuid",
  "firebase_uid",
  "email",
  "phone",
  "role",
  "emailverified",
  "email_verified",
  "phoneverified",
  "phone_verified",
  "accountstatus",
  "account_status",
  "provider"
]);
var ipRateBuckets = /* @__PURE__ */ new Map();
var cachedAuthorizedDomains = null;
function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}
function consumeRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const cur = ipRateBuckets.get(key);
  if (!cur || cur.resetAt <= now) {
    ipRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (cur.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1e3)) };
  }
  cur.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}
function safeEqualString(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto5.timingSafeEqual(bufA, bufB);
}
function signSessionToken(params) {
  const payload = Buffer.from(
    JSON.stringify({
      sid: params.sid,
      uid: params.userUid,
      id: params.identifier,
      exp: params.expiresAt
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto5.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
async function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto5.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (!safeEqualString(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.sid || !decoded.uid || !decoded.exp) return null;
    if (Date.now() > decoded.exp) {
      await deleteDbSession(decoded.sid).catch(() => {
      });
      return null;
    }
    const stored = await getDbSession(decoded.sid);
    if (!stored || stored.userUid !== decoded.uid) return null;
    return stored;
  } catch {
    return null;
  }
}
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const out = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}
function extractTokenFromHeaders(headers) {
  const authHeader = headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}
async function authenticateWebSocketRequest(req) {
  let token = null;
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    token = url.searchParams.get("token");
  } catch {
    token = null;
  }
  if (!token) token = extractTokenFromHeaders(req.headers);
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session ? { userUid: session.userUid } : null;
}
function setSessionCookie(req, res, token) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`,
    isHttps ? "SameSite=None" : "SameSite=Lax"
  ];
  if (isHttps) {
    attrs.push("Secure");
    attrs.push("Partitioned");
  }
  res.setHeader("Set-Cookie", attrs.join("; "));
}
function clearSessionCookie(req, res) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    isHttps ? "SameSite=None" : "SameSite=Lax"
  ];
  if (isHttps) {
    attrs.push("Secure");
    attrs.push("Partitioned");
  }
  res.setHeader("Set-Cookie", attrs.join("; "));
}
async function fetchAuthorizedDomainsForApiKey(apiKey) {
  if (!apiKey) return [];
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${apiKey}`);
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data.authorizedDomains) ? data.authorizedDomains : [];
}
async function fetchAuthorizedDomainsByProject() {
  const now = Date.now();
  if (cachedAuthorizedDomains && cachedAuthorizedDomains.expiresAt > now) {
    return { byProject: cachedAuthorizedDomains.byProject, domains: cachedAuthorizedDomains.domains };
  }
  const projectKeys = [
    { projectId: FIREBASE_PROJECT_ID, apiKey: FIREBASE_WEB_API_KEY }
  ];
  if (firebase_applet_config_default.projectId && firebase_applet_config_default.apiKey) {
    projectKeys.push({
      projectId: firebase_applet_config_default.projectId,
      apiKey: firebase_applet_config_default.apiKey
    });
  }
  const byProject = {};
  await Promise.all(
    projectKeys.map(async ({ projectId, apiKey }) => {
      byProject[projectId] = await fetchAuthorizedDomainsForApiKey(apiKey).catch(() => []);
    })
  );
  const domains = Array.from(new Set(Object.values(byProject).flat()));
  cachedAuthorizedDomains = { byProject, domains, expiresAt: now + 60 * 1e3 };
  return { byProject, domains };
}
function createApp(options = {}) {
  const verifyIdTokenFn = options.verifyIdTokenFn ?? verifyTokenAcrossProjects;
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  const requireVerifiedSession = async (req, res, next) => {
    try {
      const token = extractTokenFromHeaders(req.headers);
      const session = token ? await verifySessionToken(token) : null;
      if (!session) {
        res.status(401).json({ error: "Authentication required. Please sign in." });
        return;
      }
      const user = await getFullUserView(session.userUid);
      if (!user || user.accountStatus !== "active") {
        res.status(403).json({
          error: user?.accountStatus === "banned" ? user.banReason ? `Account banned: ${user.banReason}` : "This account has been banned." : user?.accountStatus === "suspended" ? "This account is currently suspended." : "Verified active account required."
        });
        return;
      }
      req.authSessionSid = session.sid;
      req.authUser = user;
      next();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Session error." });
    }
  };
  app.get("/api/health", (_req, res) => {
    res.json({
      name: "OG VELOCITY Production Server",
      status: "ok",
      firebaseProjectId: FIREBASE_PROJECT_ID,
      appletProjectId: firebase_applet_config_default.projectId,
      providers: ["google.com", "facebook.com"]
    });
  });
  app.get("/api/app-config", async (_req, res) => {
    try {
      const config = await getAppConfig();
      res.json({ ok: true, config });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load app config." });
    }
  });
  app.get("/api/auth/domain-check", async (req, res) => {
    const rawHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0].trim().toLowerCase();
    const expectedDomains = [
      "ogvelocity.xyz",
      "ais-dev-tmyxn2f2uyfmeagcwxc4c42-997874239735.asia-southeast1.run.app",
      "ais-dev-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app",
      "ais-pre-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app"
    ];
    try {
      const { byProject, domains: authorizedDomains } = await fetchAuthorizedDomainsByProject();
      const hostAuthorizedOn = (domainList) => Boolean(rawHost) && (rawHost === "localhost" || domainList.some(
        (d) => rawHost === d.toLowerCase() || rawHost.endsWith(`.${d.toLowerCase()}`)
      ));
      const authorizedProjects = Object.entries(byProject).filter(([, domainList]) => hostAuthorizedOn(domainList)).map(([projectId]) => projectId);
      const isDomainAuthorized = authorizedProjects.length > 0;
      res.json({
        ok: true,
        projectId: FIREBASE_PROJECT_ID,
        appletProjectId: firebase_applet_config_default.projectId,
        currentHost: rawHost,
        authorizedDomains,
        authorizedDomainsByProject: byProject,
        authorizedProjects,
        expectedDomains,
        isDomainAuthorized
      });
    } catch {
      res.json({
        ok: false,
        projectId: FIREBASE_PROJECT_ID,
        appletProjectId: firebase_applet_config_default.projectId,
        currentHost: rawHost,
        authorizedDomains: [],
        authorizedDomainsByProject: {},
        authorizedProjects: [],
        expectedDomains,
        isDomainAuthorized: false
      });
    }
  });
  app.all(["/api/auth/login", "/api/auth/register", "/api/auth/password", "/api/auth/email"], (_req, res) => {
    res.status(403).json({
      error: "Direct email/password authentication is disabled. Authenticate using Firebase Google or Facebook."
    });
  });
  const handleVerifyFirebase = async (req, res) => {
    const ip = getClientIp(req);
    const limit = consumeRateLimit(`auth:${ip}`, 50, 15 * 60 * 1e3);
    if (!limit.allowed) {
      res.status(429).json({ error: `Too many sign-in attempts. Retry in ${limit.retryAfterSec}s.` });
      return;
    }
    const idToken = String(req.body?.idToken ?? "").trim();
    if (!idToken) {
      res.status(400).json({ error: "Missing Firebase ID token." });
      return;
    }
    let decoded;
    try {
      decoded = await verifyIdTokenFn(idToken);
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? String(err.code) : "";
      console.error("[Auth] Firebase ID token verification failed:", code || "unknown_code");
      if (code === "auth/id-token-expired") {
        res.status(401).json({ error: "Firebase session expired. Please sign in again." });
        return;
      }
      res.status(401).json({
        error: err instanceof Error ? err.message : "Firebase ID token verification failed."
      });
      return;
    }
    const signInProvider = decoded.firebase?.sign_in_provider;
    if (!decoded.uid || !signInProvider) {
      res.status(401).json({ error: "Firebase token missing subject or provider." });
      return;
    }
    let provider;
    if (signInProvider === "google.com") {
      if (!decoded.email || decoded.email_verified !== true) {
        console.warn("[Auth] Rejected Google sign-in without verified email for uid:", decoded.uid);
        res.status(403).json({ error: "Verified Google email address is required." });
        return;
      }
      provider = "google";
    } else if (signInProvider === "phone") {
      res.status(403).json({ error: "Phone SMS OTP sign-in is disabled. Please sign in with Google or Facebook." });
      return;
    } else if (signInProvider === "facebook.com") {
      provider = "facebook";
    } else {
      res.status(403).json({
        error: `Unsupported authentication provider "${signInProvider}". Use Google or Facebook.`
      });
      return;
    }
    try {
      const { user, isNewUser } = await findOrCreateVerifiedUser({
        firebaseUid: decoded.uid,
        provider,
        providerId: signInProvider,
        email: decoded.email || null,
        emailVerified: Boolean(decoded.email_verified),
        phone: decoded.phone_number || null,
        phoneVerified: Boolean(decoded.phone_number),
        name: typeof decoded.name === "string" ? decoded.name : null,
        photoUrl: typeof decoded.picture === "string" ? decoded.picture : null
      });
      if (user.accountStatus !== "active") {
        res.status(403).json({ error: `Account is ${user.accountStatus}. Contact support.` });
        return;
      }
      void touchUserLastSeen(user.uid);
      const identifier = user.email || user.phone || user.publicId;
      const session = await createDbSession({
        userUid: user.uid,
        identifier,
        provider,
        ttlMs: SESSION_TTL_MS
      });
      const token = signSessionToken({
        sid: session.sid,
        userUid: user.uid,
        identifier,
        expiresAt: session.expiresAt
      });
      setSessionCookie(req, res, token);
      console.log(
        `[Auth] Verified ${provider} session for publicId=${user.publicId} isNew=${isNewUser}`
      );
      res.json({ ok: true, token, user: sanitizeUserForClient(user), isNewUser });
    } catch (err) {
      console.error(
        "[Auth] Failed to create/load user profile or session:",
        err instanceof Error ? err.message : err
      );
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to initialize user profile on server. Please try again."
      });
    }
  };
  app.post("/api/auth/verify-firebase", handleVerifyFirebase);
  app.post("/api/auth/verify-google", handleVerifyFirebase);
  app.get("/api/auth/session", requireVerifiedSession, (req, res) => {
    const token = extractTokenFromHeaders(req.headers);
    res.json({ ok: true, token, user: sanitizeUserForClient(req.authUser) });
  });
  app.post("/api/auth/logout", async (req, res) => {
    const token = extractTokenFromHeaders(req.headers);
    if (token) {
      const session = await verifySessionToken(token);
      if (session) await deleteDbSession(session.sid);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
  app.get("/api/protected/bootstrap", requireVerifiedSession, async (req, res) => {
    await ensureDatabaseSchemaReady();
    await ensureSeedData();
    await ensureVoiceRoomsHaveOwners();
    const uid = req.authUser.uid;
    const hub = options.getRealtimeHub?.();
    await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin());
    const [
      appConfig,
      vipPkgs,
      coinPkgs,
      vipRules,
      activeGifts,
      activeShopItems,
      myCustomGifts,
      activeTasks,
      liveEvents,
      allRoomsList,
      myNotifs,
      myOrders,
      inventoryRows,
      bgRows,
      myVipLedger,
      myVipHistory,
      vipDecayConfig,
      cpState,
      referralSummary,
      myWithdrawals,
      myTags,
      claimedTaskChests
    ] = await Promise.all([
      getAppConfig(),
      db.select().from(vipPackages).where(eq6(vipPackages.active, true)).orderBy(vipPackages.sortOrder),
      db.select().from(coinPackages).where(eq6(coinPackages.active, true)).orderBy(coinPackages.sortOrder),
      db.select().from(vipProgressionRules).orderBy(vipProgressionRules.level),
      db.select().from(gifts).where(eq6(gifts.active, true)).orderBy(gifts.giftNumber),
      listShopItems(false),
      getUserCustomGifts(uid),
      getUserTasksWithProgress(uid),
      db.select().from(events).orderBy(desc3(events.createdAt)),
      db.select().from(voiceRooms).orderBy(desc3(voiceRooms.isOfficial), desc3(voiceRooms.roomLevel)),
      getUserNotifications(uid),
      db.select().from(paymentOrders).where(eq6(paymentOrders.userUid, uid)).orderBy(desc3(paymentOrders.createdAt)).limit(20),
      db.select().from(userInventory).where(eq6(userInventory.userUid, uid)),
      db.select().from(roomBackgrounds).where(eq6(roomBackgrounds.active, true)),
      db.select().from(vipPointLedger).where(eq6(vipPointLedger.userUid, uid)).orderBy(desc3(vipPointLedger.createdAt)).limit(40),
      db.select().from(vipSubscriptionHistory).where(eq6(vipSubscriptionHistory.userUid, uid)).orderBy(desc3(vipSubscriptionHistory.createdAt)).limit(25),
      getVipDecayConfig(),
      getCpStateForUser(uid),
      getReferralSummaryForUser(uid),
      listUserWithdrawals(uid),
      getUserRelationshipTags(uid, { activeOnly: false }),
      getClaimedTaskChests(uid)
    ]);
    const roomsList = allRoomsList;
    const roomUidCandidates = roomsList.flatMap((r) => [
      r.ownerUid,
      ...Array.isArray(r.adminUids) ? r.adminUids : []
    ]);
    const roomUidMap = await mapUidsToPublicIds(roomUidCandidates);
    const selfPublicId = req.authUser.publicId;
    res.json({
      ok: true,
      user: sanitizeUserForClient(req.authUser),
      appConfig,
      vipPackages: vipPkgs,
      coinPackages: coinPkgs,
      vipProgressionRules: vipRules,
      vipDecayConfig,
      vipPointLedger: myVipLedger.map((l) => ({ ...l, userUid: selfPublicId, actorUid: null })),
      vipSubscriptionHistory: myVipHistory.map((h) => ({ ...h, userUid: selfPublicId, actorUid: null })),
      cpState,
      referralSummary,
      withdrawals: myWithdrawals.map((w) => ({ ...w, userUid: selfPublicId, reviewedByUid: null })),
      relationshipTags: myTags,
      gifts: activeGifts,
      shopItems: activeShopItems,
      customGifts: myCustomGifts,
      tasks: activeTasks,
      claimedTaskChests,
      events: liveEvents,
      rooms: roomsList.map(
        (r) => serializeVoiceRoomForClient(r, roomUidMap, hub ? hub.getRoomParticipants(r.id).length : 0)
      ),
      notifications: myNotifs.map((n) => ({ ...n, userUid: n.userUid ? selfPublicId : null })),
      orders: myOrders.map((o) => ({ ...o, userUid: selfPublicId, reviewedByUid: null })),
      inventory: inventoryRows.map((inv) => ({ ...inv, userUid: selfPublicId })),
      roomBackgrounds: bgRows,
      serverTime: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/vip/status", requireVerifiedSession, async (req, res) => {
    const uid = req.authUser.uid;
    const selfPublicId = req.authUser.publicId;
    const [decayConfig, ledger, history] = await Promise.all([
      getVipDecayConfig(),
      db.select().from(vipPointLedger).where(eq6(vipPointLedger.userUid, uid)).orderBy(desc3(vipPointLedger.createdAt)).limit(40),
      db.select().from(vipSubscriptionHistory).where(eq6(vipSubscriptionHistory.userUid, uid)).orderBy(desc3(vipSubscriptionHistory.createdAt)).limit(25)
    ]);
    res.json({
      ok: true,
      user: sanitizeUserForClient(req.authUser),
      decayConfig,
      pointLedger: ledger.map((l) => ({ ...l, userUid: selfPublicId, actorUid: null })),
      subscriptionHistory: history.map((h) => ({ ...h, userUid: selfPublicId, actorUid: null }))
    });
  });
  app.post("/api/protected/profile", requireVerifiedSession, async (req, res) => {
    const body = req.body ?? {};
    const attemptedPrivileged = Object.keys(body).filter(
      (k) => PRIVILEGED_PROFILE_FIELDS.has(k.toLowerCase())
    );
    if (attemptedPrivileged.length > 0) {
      res.status(403).json({
        error: `Modification of protected fields (${attemptedPrivileged.join(", ")}) from the client is forbidden.`
      });
      return;
    }
    const updated = await updateSafeProfile(req.authUser.uid, {
      name: typeof body.name === "string" ? body.name : void 0,
      bio: typeof body.bio === "string" ? body.bio : void 0,
      gender: body.gender === "Male" || body.gender === "Female" || body.gender === "Other" ? body.gender : void 0,
      age: typeof body.age === "number" ? body.age : void 0,
      country: typeof body.country === "string" ? body.country : void 0,
      ornament: body.ornament === "crown" || body.ornament === "lotus" || body.ornament === "halo" || body.ornament === "visor" || body.ornament === "crescent" || body.ornament === "flame" ? body.ornament : void 0,
      handle: typeof body.handle === "string" ? body.handle : void 0,
      photoUrl: typeof body.photoUrl === "string" ? body.photoUrl : void 0,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : void 0,
      themeMode: body.themeMode === "light" || body.themeMode === "dark" ? body.themeMode : void 0,
      equippedEmoteId: body.equippedEmoteId === null || typeof body.equippedEmoteId === "string" ? body.equippedEmoteId : void 0
    });
    res.json({ ok: true, user: sanitizeUserForClient(updated) });
  });
  app.get("/api/payments/upi-config", requireVerifiedSession, async (req, res) => {
    const orderId = String(req.query.orderId || "").trim();
    if (!orderId) {
      res.status(400).json({
        error: "An active payment orderId is required before accessing payment QR details."
      });
      return;
    }
    const [order] = await db.select().from(paymentOrders).where(eq6(paymentOrders.orderId, orderId));
    if (!order) {
      res.status(404).json({ error: "Payment order not found." });
      return;
    }
    if (order.userUid !== req.authUser.uid) {
      res.status(403).json({ error: "You do not have access to this payment order." });
      return;
    }
    if (order.status === "expired" || order.status === "cancelled" || order.status === "rejected") {
      res.status(410).json({ error: `This payment order is ${order.status}. Please create a new order.` });
      return;
    }
    if (order.status === "approved") {
      res.status(400).json({ error: "This payment order has already been approved." });
      return;
    }
    if (order.status === "awaiting_payment" && order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
      await db.update(paymentOrders).set({ status: "expired" }).where(eq6(paymentOrders.orderId, orderId));
      res.status(410).json({ error: "Payment session expired. Please create a new order." });
      return;
    }
    const accountName = order.accountNameUsed || "Merchant";
    const upiId = order.upiIdUsed;
    const provider = order.providerUsed || "UPI";
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(accountName)}&am=${order.amountInr}&tn=${encodeURIComponent(order.orderId)}&cu=INR`;
    const qrDataUrl = order.qrDataUrlSnapshot || await QRCode3.toDataURL(upiUri, { width: 320, margin: 1 });
    res.json({
      ok: true,
      orderId: order.orderId,
      expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
      upiConfig: {
        accountName,
        upiId,
        provider,
        upiUri,
        qrDataUrl,
        currentVersionId: order.qrVersionId ?? null,
        active: true
      }
    });
  });
  app.get("/api/payments/orders", requireVerifiedSession, async (req, res) => {
    const rows = await db.select().from(paymentOrders).where(eq6(paymentOrders.userUid, req.authUser.uid)).orderBy(desc3(paymentOrders.createdAt)).limit(40);
    const selfPublicId = req.authUser.publicId;
    res.json({ ok: true, orders: rows.map((o) => ({ ...o, userUid: selfPublicId, reviewedByUid: null })) });
  });
  app.post("/api/payments/orders", requireVerifiedSession, async (req, res) => {
    const orderType = req.body?.orderType === "coins" ? "coins" : req.body?.orderType === "vip" ? "vip" : null;
    const packageId = String(req.body?.packageId || "").trim();
    const screen = typeof req.body?.screen === "string" && req.body.screen.trim() ? req.body.screen.trim() : void 0;
    if (!orderType || !packageId) {
      res.status(400).json({ error: 'Specify orderType ("vip" | "coins") and packageId.' });
      return;
    }
    try {
      const { order, upiConfig, reused } = await createPaymentOrder({
        userUid: req.authUser.uid,
        orderType,
        packageId,
        screen: screen || orderType
      });
      res.json({
        ok: true,
        reused: Boolean(reused),
        order: { ...order, userUid: req.authUser.publicId, reviewedByUid: null },
        upiConfig
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Unable to create order." });
    }
  });
  app.post("/api/payments/orders/:orderId/submit-proof", requireVerifiedSession, async (req, res) => {
    const orderId = String(req.params.orderId);
    const utrNumber = String(req.body?.utrNumber || "").trim();
    const accountHolderName = String(req.body?.accountHolderName || "").trim();
    const paymentDateTime = typeof req.body?.paymentDateTime === "string" ? req.body.paymentDateTime.trim() : void 0;
    const screenshotDataUrl = typeof req.body?.screenshotDataUrl === "string" ? req.body.screenshotDataUrl : void 0;
    const payerNote = typeof req.body?.payerNote === "string" ? req.body.payerNote : void 0;
    if (!utrNumber) {
      res.status(400).json({ error: "UTR / Transaction Reference number is required." });
      return;
    }
    if (accountHolderName.length < 2) {
      res.status(400).json({ error: "Bank Account Holder / Sender Name is required." });
      return;
    }
    try {
      const order = await submitPaymentProof({
        userUid: req.authUser.uid,
        orderId,
        utrNumber,
        accountHolderName,
        paymentDateTime,
        screenshotDataUrl,
        payerNote
      });
      const user = await getFullUserView(req.authUser.uid);
      res.json({
        ok: true,
        order: { ...order, userUid: req.authUser.publicId, reviewedByUid: null },
        user: user ? sanitizeUserForClient(user) : null,
        message: "UTR & proof submitted for Admin verification. VIP/Coins activate only after Admin approval."
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Proof submission failed.";
      const code = msg === "DUPLICATE_UTR" ? 409 : msg === "ORDER_OWNERSHIP_MISMATCH" ? 403 : 400;
      res.status(code).json({
        error: msg === "DUPLICATE_UTR" ? "Duplicate UTR detected. This UTR was already submitted." : msg
      });
    }
  });
  app.get("/api/wallet/state", requireVerifiedSession, async (req, res) => {
    const [txs, withdrawals] = await Promise.all([
      db.select().from(walletTransactions).where(eq6(walletTransactions.userUid, req.authUser.uid)).orderBy(desc3(walletTransactions.createdAt)).limit(50),
      listUserWithdrawals(req.authUser.uid)
    ]);
    const selfPublicId = req.authUser.publicId;
    res.json({
      ok: true,
      user: sanitizeUserForClient(req.authUser),
      transactions: txs.map((t) => ({ ...t, userUid: selfPublicId, actorUid: null })),
      withdrawals: withdrawals.map((w) => ({ ...w, userUid: selfPublicId, reviewedByUid: null }))
    });
  });
  app.get("/api/withdrawals", requireVerifiedSession, async (req, res) => {
    const rows = await listUserWithdrawals(req.authUser.uid);
    const selfPublicId = req.authUser.publicId;
    res.json({
      ok: true,
      withdrawals: rows.map((w) => ({ ...w, userUid: selfPublicId, reviewedByUid: null }))
    });
  });
  app.post("/api/withdrawals", requireVerifiedSession, async (req, res) => {
    try {
      const result = await createWithdrawalRequestAtomic({
        userUid: req.authUser.uid,
        amountCoins: Number(req.body?.amountCoins || 0),
        payoutMethod: req.body?.payoutMethod === "bank" ? "bank" : "upi",
        accountHolderName: String(req.body?.accountHolderName || ""),
        upiOrAccount: String(req.body?.upiOrAccount || ""),
        ifscOrBank: typeof req.body?.ifscOrBank === "string" ? req.body.ifscOrBank : void 0
      });
      const [user, withdrawals] = await Promise.all([
        getFullUserView(req.authUser.uid),
        listUserWithdrawals(req.authUser.uid)
      ]);
      const selfPublicId = req.authUser.publicId;
      res.json({
        ok: true,
        request: { ...result.request, userUid: selfPublicId, reviewedByUid: null },
        withdrawals: withdrawals.map((w) => ({ ...w, userUid: selfPublicId, reviewedByUid: null })),
        user: user ? sanitizeUserForClient(user) : null
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Withdrawal request failed." });
    }
  });
  app.post("/api/wallet/transfer", requireVerifiedSession, (_req, res) => {
    res.status(403).json({
      error: "User-to-user coin transfers are permanently disabled."
    });
  });
  app.post("/api/shop/buy", requireVerifiedSession, async (req, res) => {
    const itemId = String(req.body?.itemId || "").trim();
    const category = String(req.body?.category || "ring").trim();
    const priceCoins = Math.max(0, Math.floor(Number(req.body?.priceCoins ?? 0)));
    const durationDays = req.body?.durationDays ? Math.max(1, Math.floor(Number(req.body.durationDays))) : void 0;
    if (!itemId) {
      res.status(400).json({ error: "Missing itemId." });
      return;
    }
    try {
      const result = await buyShopItemAtomic({
        userUid: req.authUser.uid,
        itemId,
        category,
        priceCoins,
        durationDays
      });
      const user = await getFullUserView(req.authUser.uid);
      res.json({ ok: true, purchase: result, user: user ? sanitizeUserForClient(user) : null });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Purchase failed." });
    }
  });
  app.post("/api/shop/equip", requireVerifiedSession, async (req, res) => {
    const category = String(req.body?.category || "");
    const itemId = req.body?.itemId ? String(req.body.itemId) : null;
    if (itemId) {
      const [owned] = await db.select().from(userInventory).where(and3(eq6(userInventory.userUid, req.authUser.uid), eq6(userInventory.itemId, itemId)));
      if (!owned) {
        res.status(403).json({ error: "You do not own this item." });
        return;
      }
      if (owned.expiresAt && owned.expiresAt.getTime() <= Date.now()) {
        res.status(403).json({ error: "This 3-day item has expired." });
        return;
      }
    }
    const patch = { updatedAt: /* @__PURE__ */ new Date() };
    if (category === "frame") patch.equippedFrameId = itemId;
    else if (category === "ring") patch.equippedRingId = itemId;
    else if (category === "entry") patch.equippedEntryId = itemId;
    else {
      res.status(400).json({ error: "Unsupported equip category." });
      return;
    }
    await db.update(profiles).set(patch).where(eq6(profiles.userUid, req.authUser.uid));
    const user = await getFullUserView(req.authUser.uid);
    res.json({ ok: true, user: user ? sanitizeUserForClient(user) : null });
  });
  app.get("/api/shop/items", requireVerifiedSession, async (_req, res) => {
    try {
      const items = await listShopItems(false);
      res.json({ ok: true, items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load shop items." });
    }
  });
  app.get("/api/referrals/me", requireVerifiedSession, async (req, res) => {
    try {
      const summary = await getReferralSummaryForUser(req.authUser.uid);
      res.json({ ok: true, referralSummary: summary });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load referral summary." });
    }
  });
  app.post("/api/referrals/claim", requireVerifiedSession, async (req, res) => {
    const inviteCode = String(req.body?.inviteCode || "").trim();
    if (!inviteCode) {
      res.status(400).json({ error: "Invite code is required." });
      return;
    }
    try {
      const result = await claimReferralCodeAtomic({
        invitedUid: req.authUser.uid,
        inviteCode
      });
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.inviterUid, { type: "wallet:updated", coins: result.inviterCoins });
      hub?.sendToUser(req.authUser.uid, { type: "wallet:updated", coins: result.invitedCoins });
      const [user, referralSummary] = await Promise.all([
        getFullUserView(req.authUser.uid),
        getReferralSummaryForUser(req.authUser.uid)
      ]);
      res.json({
        ok: true,
        rewardCoins: result.rewardCoins,
        inviterPublicId: result.inviterPublicId,
        user: user ? sanitizeUserForClient(user) : null,
        referralSummary
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to claim referral reward." });
    }
  });
  app.get("/api/gifts", requireVerifiedSession, async (_req, res) => {
    const rows = await db.select().from(gifts).where(eq6(gifts.active, true)).orderBy(gifts.giftNumber);
    res.json({ ok: true, gifts: rows });
  });
  app.get("/api/gifts/custom", requireVerifiedSession, async (req, res) => {
    try {
      const items = await getUserCustomGifts(req.authUser.uid);
      res.json({ ok: true, submissions: items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load custom gifts." });
    }
  });
  app.get("/api/gifts/my-submissions", requireVerifiedSession, async (req, res) => {
    try {
      const items = await getUserCustomGifts(req.authUser.uid);
      res.json({ ok: true, submissions: items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load submissions." });
    }
  });
  app.post("/api/gifts/submit", requireVerifiedSession, async (req, res) => {
    try {
      const submission = await submitCustomGift({
        creatorUid: req.authUser.uid,
        name: String(req.body?.name || ""),
        cost: Number(req.body?.cost || 100),
        charmValue: Number(req.body?.charmValue || req.body?.cost || 100),
        rarity: String(req.body?.rarity || "Signature"),
        description: String(req.body?.description || ""),
        primaryColor: String(req.body?.primaryColor || "#F43F5E"),
        secondaryColor: String(req.body?.secondaryColor || "#F59E0B"),
        particleStyle: String(req.body?.particleStyle || "heart"),
        artworkUrl: typeof req.body?.artworkUrl === "string" ? req.body.artworkUrl : null,
        animationVideoUrl: typeof req.body?.animationVideoUrl === "string" ? req.body.animationVideoUrl : null,
        videoFileName: typeof req.body?.videoFileName === "string" ? req.body.videoFileName : null
      });
      res.json({ ok: true, submission });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Custom gift submission failed." });
    }
  });
  app.post("/api/gifts/send", requireVerifiedSession, async (req, res) => {
    const giftId = String(req.body?.giftId || "").trim();
    const rawRecipient = String(req.body?.recipientUid || "").trim();
    const roomId = typeof req.body?.roomId === "string" ? req.body.roomId : void 0;
    const customMessage = typeof req.body?.customMessage === "string" ? req.body.customMessage : void 0;
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(req.body?.quantity ?? 1))));
    if (!giftId || !rawRecipient) {
      res.status(400).json({ error: "giftId and recipientUid required." });
      return;
    }
    try {
      const resolvedRecipient = await resolveUserByUidOrPublicId(rawRecipient);
      const giftRes = await sendGiftAtomic({
        senderUid: req.authUser.uid,
        recipientUid: resolvedRecipient ? resolvedRecipient.uid : rawRecipient,
        giftId,
        quantity,
        roomId,
        customMessage
      });
      const updatedUser = await getFullUserView(req.authUser.uid);
      if (roomId) {
        options.getRealtimeHub?.()?.broadcastToRoom(roomId, {
          type: "room:gift-fx",
          roomId,
          gift: giftRes.gift,
          quantity: giftRes.quantity,
          senderUid: req.authUser.publicId,
          senderName: req.authUser.name,
          recipientUid: resolvedRecipient ? resolvedRecipient.publicId : rawRecipient,
          charmEarned: giftRes.charmAwarded,
          customMessage
        });
      }
      res.json({
        ok: true,
        charmEarned: giftRes.charmAwarded,
        randomCoinsEarned: giftRes.bonusCoins,
        vipPointsEarned: giftRes.vipPointsEarned,
        user: updatedUser ? sanitizeUserForClient(updatedUser) : null
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gift send failed.";
      res.status(400).json({ error: msg === "INSUFFICIENT_COINS" ? "Insufficient coins balance." : msg });
    }
  });
  app.get("/api/rankings", requireVerifiedSession, async (req, res) => {
    const rawPeriod = String(req.query.period || "overall").toLowerCase();
    const period = rawPeriod === "weekly" ? "weekly" : rawPeriod === "monthly" ? "monthly" : "overall";
    const leaderboard = await getTop50Rankings(period);
    res.json({ ok: true, period, leaderboard, currentUser: sanitizeUserForClient(req.authUser) });
  });
  app.get("/api/tasks", requireVerifiedSession, async (req, res) => {
    const [list, claimedTaskChests] = await Promise.all([
      getUserTasksWithProgress(req.authUser.uid),
      getClaimedTaskChests(req.authUser.uid)
    ]);
    res.json({ ok: true, tasks: list, claimedTaskChests });
  });
  app.post("/api/tasks/:taskId/claim", requireVerifiedSession, async (req, res) => {
    try {
      const result = await claimTaskRewardAtomic(req.authUser.uid, String(req.params.taskId));
      const [user, claimedTaskChests] = await Promise.all([
        getFullUserView(req.authUser.uid),
        getClaimedTaskChests(req.authUser.uid)
      ]);
      res.json({
        ok: true,
        coinsAwarded: result.coinsAwarded,
        claimedTaskChests,
        user: user ? sanitizeUserForClient(user) : null
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Task claim failed.";
      const status = msg === "TASK_ALREADY_CLAIMED" ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });
  app.post("/api/tasks/chests/:step/claim", requireVerifiedSession, async (req, res) => {
    try {
      const step = Number(req.params.step);
      const result = await claimTaskChestAtomic(req.authUser.uid, step);
      const [user, claimedTaskChests] = await Promise.all([
        getFullUserView(req.authUser.uid),
        getClaimedTaskChests(req.authUser.uid)
      ]);
      res.json({
        ok: true,
        step: result.step,
        label: result.label,
        coinsAwarded: result.coinsAwarded,
        claimedTaskChests,
        user: user ? sanitizeUserForClient(user) : null
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chest claim failed.";
      const status = msg === "CHEST_ALREADY_CLAIMED" ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });
  app.get("/api/rooms", requireVerifiedSession, async (_req, res) => {
    await ensureSeedData();
    await ensureVoiceRoomsHaveOwners();
    const hub = options.getRealtimeHub?.();
    await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin());
    const rows = await db.select().from(voiceRooms).orderBy(desc3(voiceRooms.isOfficial), desc3(voiceRooms.roomLevel));
    const uidMap = await mapUidsToPublicIds(
      rows.flatMap((r) => [
        r.ownerUid,
        ...Array.isArray(r.adminUids) ? r.adminUids : []
      ])
    );
    res.json({
      ok: true,
      rooms: rows.map(
        (r) => serializeVoiceRoomForClient(r, uidMap, hub ? hub.getRoomParticipants(r.id).length : 0)
      )
    });
  });
  app.get("/api/rooms/:roomId", requireVerifiedSession, async (req, res) => {
    const requested = String(req.params.roomId || "").trim();
    if (!requested) {
      res.status(400).json({ ok: false, error: "Missing roomId." });
      return;
    }
    await ensureSeedData();
    await ensureVoiceRoomsHaveOwners();
    const hub = options.getRealtimeHub?.();
    await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin());
    const [room] = await db.select().from(voiceRooms).where(or4(eq6(voiceRooms.id, requested), eq6(voiceRooms.roomCode, requested)));
    if (!room) {
      res.status(404).json({ ok: false, error: "Voice room not found." });
      return;
    }
    const uidMap = await mapUidsToPublicIds([
      room.ownerUid,
      ...Array.isArray(room.adminUids) ? room.adminUids : []
    ]);
    res.json({
      ok: true,
      room: serializeVoiceRoomForClient(room, uidMap, hub ? hub.getRoomParticipants(room.id).length : 0)
    });
  });
  app.post("/api/rooms/:roomId/reopen", requireVerifiedSession, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) {
      res.status(400).json({ error: "Missing roomId." });
      return;
    }
    try {
      const reopened = await reopenVoiceRoom({
        roomId,
        actorUser: req.authUser
      });
      const hub = options.getRealtimeHub?.();
      if (!reopened.isOfficial) {
        hub?.scheduleInitialRoomGrace(reopened.id);
      }
      hub?.broadcastToRoom(reopened.id, {
        type: "room:status-changed",
        roomId: reopened.id,
        status: "active",
        reason: null
      });
      hub?.broadcastAll({ type: "room:list-updated", updatedRoomId: reopened.id });
      res.json({
        ok: true,
        room: reopened
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to reopen room.";
      const status = msg.toLowerCase().includes("only ") ? 403 : msg.includes("not found") ? 404 : 400;
      res.status(status).json({ error: msg });
    }
  });
  app.post("/api/rooms/:roomId/verify-passcode", requireVerifiedSession, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const passcode = String(req.body?.passcode || "").trim();
    if (!roomId || !passcode) {
      res.status(400).json({ error: "Room passcode is required." });
      return;
    }
    const [room] = await db.select().from(voiceRooms).where(or4(eq6(voiceRooms.id, roomId), eq6(voiceRooms.roomCode, roomId)));
    if (!room) {
      res.status(404).json({ error: "Voice room not found." });
      return;
    }
    if (!room.isLocked || !room.passcodeHash) {
      res.json({ ok: true });
      return;
    }
    const candidateHash = crypto5.createHash("sha256").update(`${SESSION_SECRET}:${passcode}`).digest("hex");
    if (candidateHash !== room.passcodeHash) {
      res.status(403).json({ error: "Incorrect room password. Please try again." });
      return;
    }
    res.json({ ok: true });
  });
  app.post("/api/rooms", requireVerifiedSession, async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const topic = String(req.body?.topic || "Open Voice Sanctuary").trim();
    const categoryRaw = String(req.body?.category || "Popular").trim();
    const category = ["Popular", "Music", "Chats", "Teenagers"].includes(categoryRaw) ? categoryRaw : "Popular";
    const seatCapacityRaw = Number(req.body?.seatCapacity || 15);
    const seatCapacity = [10, 15, 19].includes(seatCapacityRaw) ? seatCapacityRaw : 15;
    const ambianceRaw = String(req.body?.ambiance || "indigo").trim().toLowerCase();
    const ambiance = ["indigo", "saffron", "emerald", "crimson"].includes(ambianceRaw) ? ambianceRaw : "indigo";
    const dpUrlRaw = typeof req.body?.dpUrl === "string" ? req.body.dpUrl.trim() : "";
    const dpUrl = dpUrlRaw && (dpUrlRaw.startsWith("data:image/") || dpUrlRaw.startsWith("https://")) ? dpUrlRaw.slice(0, 35e4) : null;
    if (!title) {
      res.status(400).json({ error: "Room name is required." });
      return;
    }
    let roomCode = "";
    const customCodeRaw = String(req.body?.roomCode || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (customCodeRaw) {
      if (customCodeRaw.length < 3 || customCodeRaw.length > 24) {
        res.status(400).json({ error: "Custom Room ID must be between 3 and 24 characters (A-Z, 0-9, -, _)." });
        return;
      }
      const [dup] = await db.select({ id: voiceRooms.id }).from(voiceRooms).where(or4(eq6(voiceRooms.roomCode, customCodeRaw), eq6(voiceRooms.id, customCodeRaw)));
      if (dup) {
        res.status(409).json({ error: `Room ID "${customCodeRaw}" is already taken. Choose a unique Room ID.` });
        return;
      }
      roomCode = customCodeRaw;
    } else {
      roomCode = `RM-${1e5 + crypto5.randomInt(0, 899999)}`;
    }
    const wantLock = Boolean(req.body?.isRoomLocked ?? req.body?.isLocked);
    const rawPasscode = String(req.body?.roomPasscode ?? req.body?.passcode ?? "").trim();
    if (wantLock && rawPasscode.length < 4) {
      res.status(400).json({ error: "Please provide a 4-digit room password when lock is enabled." });
      return;
    }
    const passcodeHash = wantLock && rawPasscode ? crypto5.createHash("sha256").update(`${SESSION_SECRET}:${rawPasscode}`).digest("hex") : null;
    const roomModeRaw = String(req.body?.roomMode || "Normal").trim();
    const roomMode = ["Normal", "Action", "Video", "Music", "PK", "Party"].includes(roomModeRaw) ? roomModeRaw : "Normal";
    const bgThemeByAmbiance = {
      indigo: "bg-velocity-royal",
      saffron: "bg-velocity-gold",
      emerald: "bg-velocity-celestial",
      crimson: "bg-velocity-neon"
    };
    const id = `room-${crypto5.randomBytes(4).toString("hex")}`;
    let created;
    try {
      created = await db.transaction(async (tx) => {
        await tx.execute(sql3`SELECT pg_advisory_xact_lock(hashtext(${req.authUser.uid}))`);
        const existingOwned = await tx.select({ id: voiceRooms.id }).from(voiceRooms).where(and3(eq6(voiceRooms.ownerUid, req.authUser.uid), eq6(voiceRooms.isOfficial, false)));
        if (existingOwned.length >= 1) {
          throw new Error("ROOM_LIMIT_REACHED");
        }
        if (customCodeRaw) {
          const [dupInsideTx] = await tx.select({ id: voiceRooms.id }).from(voiceRooms).where(or4(eq6(voiceRooms.roomCode, roomCode), eq6(voiceRooms.id, roomCode)));
          if (dupInsideTx) {
            throw new Error("ROOM_CODE_TAKEN");
          }
        }
        const [inserted] = await tx.insert(voiceRooms).values({
          id,
          roomCode,
          title: title.slice(0, 60),
          topic: topic.slice(0, 120),
          category,
          ownerUid: req.authUser.uid,
          hostName: req.authUser.name,
          seatCapacity,
          activeSpeakerSlots: Math.min(seatCapacity, 12),
          isOfficial: false,
          isLocked: wantLock && Boolean(passcodeHash),
          passcodeHash,
          dpUrl,
          status: "active",
          bgThemeId: bgThemeByAmbiance[ambiance] || "bg-velocity-royal",
          ambiance,
          roomSettings: {
            roomMode,
            partnerSeatMode: "Enable All",
            membershipFeeCoins: 0
          }
        }).returning();
        return inserted;
      });
    } catch (err) {
      if (err instanceof Error && err.message === "ROOM_LIMIT_REACHED") {
        res.status(409).json({ error: "You can only create 1 personal Voice Room." });
        return;
      }
      if (err instanceof Error && err.message === "ROOM_CODE_TAKEN") {
        res.status(409).json({ error: `Room ID "${roomCode}" is already taken. Choose a unique Room ID.` });
        return;
      }
      throw err;
    }
    const hub = options.getRealtimeHub?.();
    hub?.broadcastAll({ type: "room:list-updated", addedRoomId: created.id });
    res.json({
      ok: true,
      room: serializeVoiceRoomForClient(created, { [req.authUser.uid]: req.authUser.publicId }, 0)
    });
  });
  app.post("/api/rooms/:roomId/admins/toggle", requireVerifiedSession, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const rawTarget = String(req.body?.targetUid || "").trim();
    if (!roomId || !rawTarget) {
      res.status(400).json({ error: "roomId and targetUid are required." });
      return;
    }
    const [room] = await db.select().from(voiceRooms).where(eq6(voiceRooms.id, roomId));
    if (!room) {
      res.status(404).json({ error: "Voice room not found." });
      return;
    }
    if (room.isOfficial) {
      res.status(403).json({
        error: "Official Rooms are controlled exclusively by App Admins."
      });
      return;
    }
    if (room.status === "closed") {
      res.status(410).json({
        ok: false,
        closed: true,
        roomId: room.id,
        reason: room.closedReason || DEFAULT_ROOM_CLOSED_REASON
      });
      return;
    }
    if (room.ownerUid !== req.authUser.uid) {
      res.status(403).json({ error: "Only the room Owner can appoint or remove room Admins." });
      return;
    }
    const resolvedTarget = await resolveUserByUidOrPublicId(rawTarget);
    if (!resolvedTarget) {
      res.status(404).json({ error: "Target user not found." });
      return;
    }
    if (resolvedTarget.uid === room.ownerUid) {
      res.status(400).json({ error: "Room Owner already holds full Owner authority." });
      return;
    }
    const currentAdmins = Array.isArray(room.adminUids) ? room.adminUids.map(String) : [];
    const isCurrentlyAdmin = currentAdmins.includes(resolvedTarget.uid);
    const maxAdmins = getMaxRoomAdminSlots(room.roomLevel);
    if (!isCurrentlyAdmin && currentAdmins.length >= maxAdmins) {
      res.status(400).json({ error: `Maximum ${maxAdmins} room Admin slots reached for Room Level ${room.roomLevel}.` });
      return;
    }
    const nextAdminUids = isCurrentlyAdmin ? currentAdmins.filter((u) => u !== resolvedTarget.uid) : [...currentAdmins, resolvedTarget.uid];
    const existingRoomSettings = room.roomSettings && typeof room.roomSettings === "object" ? room.roomSettings : {};
    const existingRecords = Array.isArray(existingRoomSettings.operationRecords) ? existingRoomSettings.operationRecords : [];
    const nextOperationRecords = [
      {
        id: crypto5.randomUUID(),
        action: isCurrentlyAdmin ? `Removed ${resolvedTarget.publicId} from Room Admin` : `Appointed ${resolvedTarget.publicId} as Room Admin`,
        actorName: req.authUser.name || req.authUser.publicId,
        actorUid: req.authUser.publicId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      ...existingRecords
    ].slice(0, 50);
    await db.update(voiceRooms).set({
      adminUids: nextAdminUids,
      roomSettings: { ...existingRoomSettings, operationRecords: nextOperationRecords },
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq6(voiceRooms.id, room.id));
    const uidMap = await mapUidsToPublicIds(nextAdminUids);
    const publicAdminUids = nextAdminUids.map((u) => uidMap[u] || u);
    const hub = options.getRealtimeHub?.();
    if (hub) {
      await hub.syncRoomAdmins(room.id, nextAdminUids, publicAdminUids);
      hub.broadcastAll({ type: "room:list-updated", updatedRoomId: room.id });
    }
    res.json({
      ok: true,
      roomId: room.id,
      targetUid: resolvedTarget.publicId,
      isAdmin: !isCurrentlyAdmin,
      adminUids: publicAdminUids,
      operationRecords: nextOperationRecords
    });
  });
  app.patch("/api/rooms/:roomId/settings", requireVerifiedSession, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const [room] = await db.select().from(voiceRooms).where(eq6(voiceRooms.id, roomId));
    if (!room) {
      res.status(404).json({ error: "Voice room not found." });
      return;
    }
    if (room.status === "closed") {
      res.status(410).json({
        ok: false,
        closed: true,
        roomId: room.id,
        reason: room.closedReason || DEFAULT_ROOM_CLOSED_REASON
      });
      return;
    }
    const isAuthorized = room.isOfficial ? isAppAdminRole(req.authUser.role) : room.ownerUid === req.authUser.uid || Array.isArray(room.adminUids) && room.adminUids.includes(req.authUser.uid);
    if (!isAuthorized) {
      res.status(403).json({
        error: room.isOfficial ? "Only App Admins can update Official Room settings." : "Only the room Owner or Admin can update room settings."
      });
      return;
    }
    const body = req.body ?? {};
    const patch = { updatedAt: /* @__PURE__ */ new Date() };
    const changedLabels = [];
    if (typeof body.title === "string" && body.title.trim()) {
      patch.title = body.title.trim().slice(0, 60);
      changedLabels.push(`Updated room title to "${patch.title}"`);
    }
    if (typeof body.topic === "string") {
      patch.topic = body.topic.trim().slice(0, 120);
      changedLabels.push("Updated room topic");
    }
    if (typeof body.category === "string" && ["Popular", "Music", "Chats", "Teenagers"].includes(body.category)) {
      patch.category = body.category;
      changedLabels.push(`Changed category to ${body.category}`);
    }
    if (typeof body.dpUrl === "string") {
      patch.dpUrl = body.dpUrl.slice(0, 35e4) || null;
      changedLabels.push(patch.dpUrl ? "Updated room cover photo" : "Reset room cover photo");
    }
    if (typeof body.bgThemeId === "string" && body.bgThemeId.trim()) {
      patch.bgThemeId = body.bgThemeId.trim().slice(0, 40);
      changedLabels.push(`Changed room background theme`);
    }
    if (typeof body.bgUrl === "string") {
      patch.bgUrl = body.bgUrl.slice(0, 5e5) || null;
      changedLabels.push(patch.bgUrl ? "Uploaded custom room background" : "Cleared custom wallpaper");
    }
    if (typeof body.isRoomLocked === "boolean") {
      patch.isLocked = body.isRoomLocked;
      if (!body.isRoomLocked) {
        patch.passcodeHash = null;
        changedLabels.push("Disabled room password");
      } else {
        changedLabels.push("Enabled room password");
      }
    }
    if (typeof body.roomPasscode === "string" && body.roomPasscode.trim()) {
      patch.passcodeHash = crypto5.createHash("sha256").update(`${SESSION_SECRET}:${body.roomPasscode.trim()}`).digest("hex");
      changedLabels.push("Updated 4-digit room password");
    }
    const currentSettings = room.roomSettings && typeof room.roomSettings === "object" ? { ...room.roomSettings } : {};
    const incomingSettings = body.roomSettings && typeof body.roomSettings === "object" ? body.roomSettings : null;
    if (incomingSettings) {
      if (typeof incomingSettings.announcement === "string") {
        currentSettings.announcement = incomingSettings.announcement.trim().slice(0, 300);
        changedLabels.push("Updated room announcement");
      }
      if (typeof incomingSettings.roomMode === "string" && ["Normal", "Action", "Video", "Music", "PK", "Party"].includes(incomingSettings.roomMode)) {
        currentSettings.roomMode = incomingSettings.roomMode;
        changedLabels.push(`Switched Room Mode to ${incomingSettings.roomMode}`);
      }
      if (typeof incomingSettings.roomTag === "string" && incomingSettings.roomTag.trim()) {
        currentSettings.roomTag = incomingSettings.roomTag.trim().slice(0, 32);
        changedLabels.push(`Updated Room Tag to ${currentSettings.roomTag}`);
      }
      if (typeof incomingSettings.partnerSeatMode === "string" && ["Enable All", "Owner & Admins", "Locked"].includes(incomingSettings.partnerSeatMode)) {
        currentSettings.partnerSeatMode = incomingSettings.partnerSeatMode;
        changedLabels.push(`Partner Seat set to ${incomingSettings.partnerSeatMode}`);
      }
      if (typeof incomingSettings.highQualityMode === "boolean") {
        currentSettings.highQualityMode = incomingSettings.highQualityMode;
        changedLabels.push(
          incomingSettings.highQualityMode ? "Enabled High Quality Mode" : "Disabled High Quality Mode"
        );
      }
      if (typeof incomingSettings.banTextChat === "boolean") {
        currentSettings.banTextChat = incomingSettings.banTextChat;
        changedLabels.push(
          incomingSettings.banTextChat ? "Banned Text Chatting" : "Allowed Text Chatting"
        );
      }
      if (typeof incomingSettings.banPhotoChat === "boolean") {
        currentSettings.banPhotoChat = incomingSettings.banPhotoChat;
        changedLabels.push(
          incomingSettings.banPhotoChat ? "Banned Photo Chatting" : "Allowed Photo Chatting"
        );
      }
      if (typeof incomingSettings.banRedPacket === "boolean") {
        currentSettings.banRedPacket = incomingSettings.banRedPacket;
        changedLabels.push(
          incomingSettings.banRedPacket ? "Banned Red Packet" : "Allowed Red Packet"
        );
      }
      if (incomingSettings.membershipFeeCoins !== void 0) {
        const fee = Math.max(0, Math.min(1e6, Math.floor(Number(incomingSettings.membershipFeeCoins) || 0)));
        currentSettings.membershipFeeCoins = fee;
        changedLabels.push(fee === 0 ? "Set Membership Fees to Free" : `Set Membership Fees to ${fee} coins`);
      }
      if (Array.isArray(incomingSettings.blockedUids)) {
        const cleaned = Array.from(
          new Set(incomingSettings.blockedUids.map((u) => String(u || "").trim()).filter(Boolean))
        ).slice(0, 200);
        currentSettings.blockedUids = cleaned;
        changedLabels.push("Updated room blocklist");
      }
      if (typeof incomingSettings.associatedGroupName === "string") {
        currentSettings.associatedGroupName = incomingSettings.associatedGroupName.trim().slice(0, 80);
        changedLabels.push(
          currentSettings.associatedGroupName ? `Linked group "${currentSettings.associatedGroupName}"` : "Cleared associated group"
        );
      }
    }
    if (changedLabels.length > 0) {
      const existingRecords = Array.isArray(currentSettings.operationRecords) ? currentSettings.operationRecords : [];
      currentSettings.operationRecords = [
        {
          id: crypto5.randomUUID(),
          action: changedLabels.join(" \xB7 "),
          actorName: req.authUser.name || req.authUser.publicId,
          actorUid: req.authUser.publicId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        ...existingRecords
      ].slice(0, 50);
      patch.roomSettings = currentSettings;
    }
    const [updated] = await db.update(voiceRooms).set(patch).where(eq6(voiceRooms.id, room.id)).returning();
    const hub = options.getRealtimeHub?.();
    const uidMap = await mapUidsToPublicIds([
      updated.ownerUid,
      ...Array.isArray(updated.adminUids) ? updated.adminUids : []
    ]);
    const serialized = serializeVoiceRoomForClient(
      updated,
      uidMap,
      hub ? hub.getRoomParticipants(updated.id).length : 0
    );
    if (hub) {
      hub.broadcastToRoom(room.id, {
        type: "room:settings-updated",
        roomId: room.id,
        room: serialized
      });
      hub.broadcastAll({ type: "room:list-updated", updatedRoomId: room.id });
    }
    res.json({
      ok: true,
      room: serialized
    });
  });
  app.post("/api/rooms/:roomId/leave", requireVerifiedSession, async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) {
      res.status(400).json({ error: "Missing roomId." });
      return;
    }
    const hub = options.getRealtimeHub?.();
    if (hub) {
      await hub.forceUserLeaveRoom(roomId, req.authUser.uid, { intentional: true });
    } else {
      await db.delete(roomParticipants).where(and3(eq6(roomParticipants.roomId, roomId), eq6(roomParticipants.userUid, req.authUser.uid)));
    }
    const [room] = await db.select().from(voiceRooms).where(eq6(voiceRooms.id, roomId));
    res.json({
      ok: true,
      roomStatus: room?.status || "closed"
    });
  });
  app.get("/api/users/search", requireVerifiedSession, async (req, res) => {
    const rl = consumeRateLimit(`search:${req.authUser.uid}`, 60, 6e4);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many searches. Retry in ${rl.retryAfterSec}s.` });
      return;
    }
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
    const limit = Math.min(30, Math.max(5, Math.floor(Number(req.query.limit || 20))));
    const offset = (page - 1) * limit;
    const rows = await db.select({
      uid: users.uid,
      publicId: users.publicId,
      lastSeenAt: users.lastSeenAt,
      name: profiles.displayName,
      handle: profiles.handle,
      photoUrl: profiles.photoUrl,
      equippedFrameId: profiles.equippedFrameId,
      vipLevel: vipMemberships.vipLevel,
      vipStatus: vipMemberships.vipStatus
    }).from(users).innerJoin(profiles, eq6(users.uid, profiles.userUid)).leftJoin(vipMemberships, eq6(users.uid, vipMemberships.userUid)).where(
      and3(
        eq6(users.accountStatus, "active"),
        q ? or4(
          ilike3(users.publicId, `%${q}%`),
          ilike3(profiles.displayName, `%${q}%`),
          ilike3(profiles.handle, `%${q}%`)
        ) : void 0
      )
    ).orderBy(desc3(users.lastSeenAt), desc3(users.createdAt)).limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    const slice = rows.slice(0, limit);
    const uids = slice.map((r) => r.uid);
    const viewerUid = req.authUser.uid;
    const now = Date.now();
    const [invRows, relRows] = await Promise.all([
      uids.length > 0 ? db.select({
        userUid: userInventory.userUid,
        itemId: userInventory.itemId,
        expiresAt: userInventory.expiresAt
      }).from(userInventory).where(inArray2(userInventory.userUid, uids)) : Promise.resolve([]),
      uids.length > 0 ? db.select().from(friends).where(
        or4(
          and3(eq6(friends.requesterUid, viewerUid), inArray2(friends.addresseeUid, uids)),
          and3(inArray2(friends.requesterUid, uids), eq6(friends.addresseeUid, viewerUid))
        )
      ) : Promise.resolve([])
    ]);
    const validFrameSet = new Set(
      invRows.filter((inv) => !inv.expiresAt || new Date(inv.expiresAt).getTime() > now).map((inv) => `${inv.userUid}:${inv.itemId}`)
    );
    const hub = options.getRealtimeHub?.();
    res.json({
      ok: true,
      page,
      hasMore,
      users: slice.map((r) => {
        let friendStatus = r.uid === viewerUid ? "self" : "none";
        let relationId = null;
        if (r.uid !== viewerUid) {
          const matches = relRows.filter((rel) => rel.requesterUid === r.uid || rel.addresseeUid === r.uid);
          const blocked = matches.find((m) => m.status === "blocked");
          const accepted = matches.find((m) => m.status === "accepted");
          const pendOut = matches.find((m) => m.status === "pending" && m.requesterUid === viewerUid);
          const pendIn = matches.find((m) => m.status === "pending" && m.addresseeUid === viewerUid);
          if (blocked) {
            friendStatus = blocked.requesterUid === viewerUid ? "blocked_by_me" : "blocked_by_them";
            relationId = blocked.id;
          } else if (accepted) {
            friendStatus = "friends";
            relationId = accepted.id;
          } else if (pendOut) {
            friendStatus = "pending_outgoing";
            relationId = pendOut.id;
          } else if (pendIn) {
            friendStatus = "pending_incoming";
            relationId = pendIn.id;
          }
        }
        return {
          uid: r.publicId,
          publicId: r.publicId,
          name: r.name,
          handle: r.handle,
          photoUrl: r.photoUrl,
          equippedFrameId: r.equippedFrameId && validFrameSet.has(`${r.uid}:${r.equippedFrameId}`) ? r.equippedFrameId : null,
          vipLevel: r.vipStatus === "active" ? Number(r.vipLevel ?? 0) : 0,
          online: hub ? hub.isUserOnline(r.uid) : false,
          lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
          friendStatus,
          relationId
        };
      })
    });
  });
  app.get("/api/users/:id/profile", requireVerifiedSession, async (req, res) => {
    const requested = String(req.params.id || "").trim();
    const resolved = await resolveUserByUidOrPublicId(requested);
    const hub = options.getRealtimeHub?.();
    const isOnline = resolved && hub ? hub.isUserOnline(resolved.uid) : false;
    const profile = await getPublicUserProfile(requested, req.authUser.uid, isOnline);
    if (!profile) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }
    res.json({ ok: true, profile });
  });
  app.get("/api/cp/state", requireVerifiedSession, async (req, res) => {
    const state = await getCpStateForUser(req.authUser.uid);
    res.json({ ok: true, ...state });
  });
  app.post("/api/cp/propose", requireVerifiedSession, async (req, res) => {
    const toUid = String(req.body?.toUid || req.body?.toPublicId || req.body?.targetId || "").trim();
    const ringNumber = Number(req.body?.ringNumber || 1);
    const ringName = String(req.body?.ringName || "Couple Bond Ring").trim();
    if (!toUid) {
      res.status(400).json({ error: "Target Public User ID is required." });
      return;
    }
    try {
      const result = await proposeCpAtomic({
        fromUid: req.authUser.uid,
        toIdentifier: toUid,
        ringNumber,
        ringName
      });
      const [senderState, recipientState] = await Promise.all([
        getCpStateForUser(result.fromUidInternal),
        getCpStateForUser(result.toUidInternal)
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.toUidInternal, {
        type: "cp:proposal",
        fromName: req.authUser.name,
        fromUid: result.fromPublicId,
        ringName,
        cpState: recipientState
      });
      hub?.sendToUser(result.fromUidInternal, { type: "cp:updated", cpState: senderState });
      res.json({ ok: true, proposalId: result.proposal.id, cpState: senderState });
    } catch (err) {
      const status = err instanceof CpDomainError ? err.statusCode : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : "CP proposal failed." });
    }
  });
  app.post("/api/cp/proposals/:proposalId/respond", requireVerifiedSession, async (req, res) => {
    const proposalId = String(req.params.proposalId || "").trim();
    const accept = Boolean(req.body?.accept);
    try {
      const result = await respondCpProposalAtomic({
        actorUid: req.authUser.uid,
        proposalId,
        accept
      });
      const [fromUser, toUser, fromState, toState, fromTags, toTags] = await Promise.all([
        getFullUserView(result.fromUidInternal),
        getFullUserView(result.toUidInternal),
        getCpStateForUser(result.fromUidInternal),
        getCpStateForUser(result.toUidInternal),
        getUserRelationshipTags(result.fromUidInternal, { activeOnly: false }),
        getUserRelationshipTags(result.toUidInternal, { activeOnly: false })
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.fromUidInternal, {
        type: "cp:updated",
        action: result.status,
        cpState: fromState,
        user: fromUser ? sanitizeUserForClient(fromUser) : null
      });
      hub?.sendToUser(result.toUidInternal, {
        type: "cp:updated",
        action: result.status,
        cpState: toState,
        user: toUser ? sanitizeUserForClient(toUser) : null
      });
      hub?.sendToUser(result.fromUidInternal, {
        type: "tag:updated",
        tags: fromTags,
        user: fromUser ? sanitizeUserForClient(fromUser) : null
      });
      hub?.sendToUser(result.toUidInternal, {
        type: "tag:updated",
        tags: toTags,
        user: toUser ? sanitizeUserForClient(toUser) : null
      });
      if (result.status === "accepted") {
        if (fromUser) {
          hub?.sendToUser(result.fromUidInternal, { type: "user:refresh", user: sanitizeUserForClient(fromUser) });
        }
        if (toUser) {
          hub?.sendToUser(result.toUidInternal, { type: "user:refresh", user: sanitizeUserForClient(toUser) });
        }
      }
      await hub?.refreshParticipantSocialState([result.fromUidInternal, result.toUidInternal]);
      res.json({
        ok: true,
        status: result.status,
        cpState: toState,
        user: toUser ? sanitizeUserForClient(toUser) : null
      });
    } catch (err) {
      const status = err instanceof CpDomainError ? err.statusCode : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : "Failed to respond to CP proposal." });
    }
  });
  app.post("/api/cp/break", requireVerifiedSession, async (req, res) => {
    try {
      const result = await breakCpRelationshipAtomic(req.authUser.uid);
      const [userA, userB, stateA, stateB, tagsA, tagsB] = await Promise.all([
        getFullUserView(result.userAUidInternal),
        getFullUserView(result.userBUidInternal),
        getCpStateForUser(result.userAUidInternal),
        getCpStateForUser(result.userBUidInternal),
        getUserRelationshipTags(result.userAUidInternal, { activeOnly: false }),
        getUserRelationshipTags(result.userBUidInternal, { activeOnly: false })
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.userAUidInternal, {
        type: "cp:updated",
        action: "ended",
        cpState: stateA,
        user: userA ? sanitizeUserForClient(userA) : null
      });
      hub?.sendToUser(result.userBUidInternal, {
        type: "cp:updated",
        action: "ended",
        cpState: stateB,
        user: userB ? sanitizeUserForClient(userB) : null
      });
      hub?.sendToUser(result.userAUidInternal, {
        type: "tag:updated",
        tags: tagsA,
        user: userA ? sanitizeUserForClient(userA) : null
      });
      hub?.sendToUser(result.userBUidInternal, {
        type: "tag:updated",
        tags: tagsB,
        user: userB ? sanitizeUserForClient(userB) : null
      });
      if (userA) hub?.sendToUser(result.userAUidInternal, { type: "user:refresh", user: sanitizeUserForClient(userA) });
      if (userB) hub?.sendToUser(result.userBUidInternal, { type: "user:refresh", user: sanitizeUserForClient(userB) });
      await hub?.refreshParticipantSocialState([result.userAUidInternal, result.userBUidInternal]);
      const actorUser = result.userAUidInternal === req.authUser.uid ? userA : userB;
      const actorState = result.userAUidInternal === req.authUser.uid ? stateA : stateB;
      res.json({
        ok: true,
        cpState: actorState,
        user: actorUser ? sanitizeUserForClient(actorUser) : null
      });
    } catch (err) {
      const status = err instanceof CpDomainError ? err.statusCode : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : "Failed to end CP relationship." });
    }
  });
  app.get("/api/tags", requireVerifiedSession, async (req, res) => {
    const tags = await getUserRelationshipTags(req.authUser.uid, { activeOnly: false });
    res.json({ ok: true, tags });
  });
  app.post("/api/tags/propose", requireVerifiedSession, async (req, res) => {
    const toUid = String(req.body?.toUid || req.body?.targetId || "").trim();
    const tagType = String(req.body?.tagType || "").trim();
    if (!toUid || !tagType) {
      res.status(400).json({ error: "Target Player ID and tagType are required." });
      return;
    }
    try {
      const result = await proposeOrActivateRelationshipTag({
        fromUid: req.authUser.uid,
        toIdentifier: toUid,
        tagType
      });
      const [senderTags, targetTags] = await Promise.all([
        getUserRelationshipTags(req.authUser.uid, { activeOnly: false }),
        getUserRelationshipTags(result.targetInternalUid, { activeOnly: false })
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.targetInternalUid, {
        type: "tag:updated",
        tags: targetTags,
        fromName: req.authUser.name
      });
      hub?.sendToUser(req.authUser.uid, { type: "tag:updated", tags: senderTags });
      res.json({ ok: true, tags: senderTags, tag: result.saved });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to invite relationship tag." });
    }
  });
  app.post("/api/tags/:tagId/respond", requireVerifiedSession, async (req, res) => {
    const tagId = String(req.params.tagId || "").trim();
    const accept = Boolean(req.body?.accept);
    try {
      const updated = await respondRelationshipTag({
        actorUid: req.authUser.uid,
        tagId,
        accept
      });
      const otherUid = updated.userAUid === req.authUser.uid ? updated.userBUid : updated.userAUid;
      const [actorTags, otherTags, actorFull, otherFull] = await Promise.all([
        getUserRelationshipTags(req.authUser.uid, { activeOnly: false }),
        getUserRelationshipTags(otherUid, { activeOnly: false }),
        getFullUserView(req.authUser.uid),
        getFullUserView(otherUid)
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(otherUid, {
        type: "tag:updated",
        tags: otherTags,
        user: otherFull ? sanitizeUserForClient(otherFull) : null
      });
      hub?.sendToUser(req.authUser.uid, {
        type: "tag:updated",
        tags: actorTags,
        user: actorFull ? sanitizeUserForClient(actorFull) : null
      });
      await hub?.refreshParticipantSocialState([req.authUser.uid, otherUid]);
      res.json({ ok: true, tags: actorTags, user: actorFull ? sanitizeUserForClient(actorFull) : null });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to respond to tag invitation." });
    }
  });
  app.post("/api/tags/:tagId/end", requireVerifiedSession, async (req, res) => {
    const tagId = String(req.params.tagId || "").trim();
    try {
      const updated = await endRelationshipTag({ actorUid: req.authUser.uid, tagId });
      const otherUid = updated.userAUid === req.authUser.uid ? updated.userBUid : updated.userAUid;
      const [actorTags, otherTags, actorFull] = await Promise.all([
        getUserRelationshipTags(req.authUser.uid, { activeOnly: false }),
        getUserRelationshipTags(otherUid, { activeOnly: false }),
        getFullUserView(req.authUser.uid)
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(otherUid, { type: "tag:updated", tags: otherTags });
      await hub?.refreshParticipantSocialState([req.authUser.uid, otherUid]);
      res.json({ ok: true, tags: actorTags, user: actorFull ? sanitizeUserForClient(actorFull) : null });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to remove relationship tag." });
    }
  });
  app.post("/api/action-room/tags/purchase", requireVerifiedSession, async (req, res) => {
    const partnerUid = String(req.body?.partnerUid || req.body?.toUid || req.body?.targetId || "").trim();
    const tagType = String(req.body?.tagType || "").trim();
    const idempotencyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.trim() : void 0;
    if (!partnerUid || !tagType) {
      res.status(400).json({ error: "partnerUid and tagType are required." });
      return;
    }
    try {
      const result = await purchaseActionRoomTagAtomic({
        actorUid: req.authUser.uid,
        partnerIdentifier: partnerUid,
        tagType,
        idempotencyKey
      });
      const [actorTags, targetTags, actorFull, targetFull] = await Promise.all([
        getUserRelationshipTags(req.authUser.uid, { activeOnly: false }),
        getUserRelationshipTags(result.targetInternalUid, { activeOnly: false }),
        getFullUserView(req.authUser.uid),
        getFullUserView(result.targetInternalUid)
      ]);
      const sanitizedActor = actorFull ? sanitizeUserForClient(actorFull) : null;
      const sanitizedTarget = targetFull ? sanitizeUserForClient(targetFull) : null;
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(req.authUser.uid, {
        type: "wallet:updated",
        coins: result.coinsAfter,
        user: sanitizedActor
      });
      hub?.sendToUser(req.authUser.uid, {
        type: "tag:updated",
        tags: actorTags,
        user: sanitizedActor
      });
      hub?.sendToUser(result.targetInternalUid, {
        type: "tag:updated",
        tags: targetTags,
        fromName: req.authUser.name,
        user: sanitizedTarget
      });
      await hub?.refreshParticipantSocialState([req.authUser.uid, result.targetInternalUid]);
      res.json({
        ok: true,
        tag: result.saved,
        tags: actorTags,
        user: sanitizedActor,
        priceCoins: result.priceCoins
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to purchase Action Room tag." });
    }
  });
  app.get("/api/friends", requireVerifiedSession, async (req, res) => {
    const uid = req.authUser.uid;
    const q = String(req.query.q || "").trim().toLowerCase();
    const rows = await db.select().from(friends).where(or4(eq6(friends.requesterUid, uid), eq6(friends.addresseeUid, uid)));
    const hub = options.getRealtimeHub?.();
    const peerUids = Array.from(
      new Set(rows.map((r) => r.requesterUid === uid ? r.addresseeUid : r.requesterUid))
    );
    const peerDetails = {};
    for (const pid of peerUids) {
      const p = await getFullUserView(pid);
      if (p) peerDetails[pid] = p;
    }
    const serialized = rows.map((r) => {
      const peerUid = r.requesterUid === uid ? r.addresseeUid : r.requesterUid;
      const peer = peerDetails[peerUid];
      const reqPublic = r.requesterUid === uid ? req.authUser.publicId : peerDetails[r.requesterUid]?.publicId || r.requesterUid;
      const addPublic = r.addresseeUid === uid ? req.authUser.publicId : peerDetails[r.addresseeUid]?.publicId || r.addresseeUid;
      return {
        ...r,
        requesterUid: reqPublic,
        addresseeUid: addPublic,
        direction: r.requesterUid === uid ? "outgoing" : "incoming",
        peer: peer ? sanitizeUserForClient(peer) : null,
        online: hub ? hub.isUserOnline(peerUid) : false,
        lastSeenAt: peer?.lastSeenAt ?? null
      };
    }).filter((rel) => {
      if (!q) return true;
      const nameMatch = (rel.peer?.name || "").toLowerCase().includes(q);
      const idMatch = (rel.peer?.publicId || "").toLowerCase().includes(q);
      const handleMatch = (rel.peer?.handle || "").toLowerCase().includes(q);
      return nameMatch || idMatch || handleMatch;
    });
    res.json({ ok: true, relations: serialized });
  });
  app.post("/api/friends/request", requireVerifiedSession, async (req, res) => {
    const targetIdentifier = String(req.body?.targetUidOrPublicId || "").trim();
    const target = await resolveUserByUidOrPublicId(targetIdentifier);
    if (!target) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (target.uid === req.authUser.uid) {
      res.status(400).json({ error: "Cannot add yourself as a friend." });
      return;
    }
    if (await isBlockedBetween(req.authUser.uid, target.uid)) {
      res.status(403).json({ error: "Action blocked." });
      return;
    }
    const existingRows = await db.select().from(friends).where(
      or4(
        and3(eq6(friends.requesterUid, req.authUser.uid), eq6(friends.addresseeUid, target.uid)),
        and3(eq6(friends.requesterUid, target.uid), eq6(friends.addresseeUid, req.authUser.uid))
      )
    );
    const alreadyAccepted = existingRows.find((r) => r.status === "accepted");
    if (alreadyAccepted) {
      res.status(409).json({ error: "You are already friends." });
      return;
    }
    const existingOutgoing = existingRows.find(
      (r) => r.requesterUid === req.authUser.uid && r.status === "pending"
    );
    if (existingOutgoing) {
      res.json({
        ok: true,
        alreadyPending: true,
        relation: {
          ...existingOutgoing,
          requesterUid: req.authUser.publicId,
          addresseeUid: target.publicId
        }
      });
      return;
    }
    const existingIncoming = existingRows.find(
      (r) => r.requesterUid === target.uid && r.addresseeUid === req.authUser.uid && r.status === "pending"
    );
    const hub = options.getRealtimeHub?.();
    if (existingIncoming) {
      const [acceptedRel] = await db.update(friends).set({ status: "accepted", updatedAt: /* @__PURE__ */ new Date() }).where(eq6(friends.id, existingIncoming.id)).returning();
      hub?.sendToUser(target.uid, {
        type: "friend:accepted",
        byName: req.authUser.name,
        byPublicId: req.authUser.publicId
      });
      hub?.sendToUser(target.uid, { type: "friend:updated", peerPublicId: req.authUser.publicId });
      hub?.sendToUser(req.authUser.uid, { type: "friend:updated", peerPublicId: target.publicId });
      res.json({
        ok: true,
        autoAccepted: true,
        relation: {
          ...acceptedRel,
          requesterUid: target.publicId,
          addresseeUid: req.authUser.publicId
        }
      });
      return;
    }
    const [saved] = await db.insert(friends).values({ requesterUid: req.authUser.uid, addresseeUid: target.uid, status: "pending" }).onConflictDoUpdate({
      target: [friends.requesterUid, friends.addresseeUid],
      set: { status: "pending", updatedAt: /* @__PURE__ */ new Date() }
    }).returning();
    await recordTaskActionProgress(req.authUser.uid, "add_friend", 1).catch(() => {
    });
    await db.insert(notifications).values({
      userUid: target.uid,
      type: "friend",
      title: "New Friend Request",
      body: `${req.authUser.name} (${req.authUser.publicId}) sent you a friend request.`
    });
    hub?.sendToUser(target.uid, { type: "friend:request", from: req.authUser.name, fromPublicId: req.authUser.publicId });
    hub?.sendToUser(target.uid, { type: "friend:updated", peerPublicId: req.authUser.publicId });
    hub?.sendToUser(req.authUser.uid, { type: "friend:updated", peerPublicId: target.publicId });
    res.json({
      ok: true,
      relation: { ...saved, requesterUid: req.authUser.publicId, addresseeUid: target.publicId }
    });
  });
  app.post("/api/friends/respond", requireVerifiedSession, async (req, res) => {
    const relationId = Number(req.body?.relationId);
    const accept = Boolean(req.body?.accept);
    const [rel] = await db.select().from(friends).where(eq6(friends.id, relationId));
    if (!rel || rel.addresseeUid !== req.authUser.uid) {
      res.status(404).json({ error: "Friend request not found." });
      return;
    }
    const [updated] = await db.update(friends).set({ status: accept ? "accepted" : "rejected", updatedAt: /* @__PURE__ */ new Date() }).where(eq6(friends.id, relationId)).returning();
    const uidMap = await mapUidsToPublicIds([updated.requesterUid, updated.addresseeUid]);
    const hub = options.getRealtimeHub?.();
    if (accept) {
      hub?.sendToUser(updated.requesterUid, {
        type: "friend:accepted",
        byName: req.authUser.name,
        byPublicId: req.authUser.publicId
      });
    }
    hub?.sendToUser(updated.requesterUid, { type: "friend:updated" });
    hub?.sendToUser(updated.addresseeUid, { type: "friend:updated" });
    res.json({
      ok: true,
      relation: {
        ...updated,
        requesterUid: uidMap[updated.requesterUid] || updated.requesterUid,
        addresseeUid: uidMap[updated.addresseeUid] || updated.addresseeUid
      }
    });
  });
  app.post("/api/friends/cancel", requireVerifiedSession, async (req, res) => {
    const identifier = req.body?.relationId ?? req.body?.targetUidOrPublicId ?? req.body?.targetUid;
    if (!identifier) {
      res.status(400).json({ error: "Specify relationId or targetUidOrPublicId." });
      return;
    }
    try {
      const result = await cancelFriendRequest(req.authUser.uid, identifier);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(req.authUser.uid, { type: "friend:updated" });
      if (result.addresseeUid) {
        hub?.sendToUser(result.addresseeUid, { type: "friend:updated" });
      }
      res.json({ ok: true, cancelledId: result.cancelledId });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Unable to cancel friend request." });
    }
  });
  app.delete("/api/friends/:targetId", requireVerifiedSession, async (req, res) => {
    const targetId = String(req.params.targetId || "").trim();
    if (!targetId) {
      res.status(400).json({ error: "Missing targetId." });
      return;
    }
    try {
      const result = await unfriendUser(req.authUser.uid, targetId);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(req.authUser.uid, { type: "friend:updated" });
      if (result.unfriendedUid) {
        hub?.sendToUser(result.unfriendedUid, { type: "friend:updated" });
      }
      res.json({ ok: true, unfriendedPublicId: result.unfriendedPublicId });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Unable to unfriend user." });
    }
  });
  app.post("/api/friends/block", requireVerifiedSession, async (req, res) => {
    const rawTarget = String(req.body?.targetUidOrPublicId || req.body?.targetUid || "").trim();
    const resolvedTarget = await resolveUserByUidOrPublicId(rawTarget);
    const targetInternalUid = resolvedTarget?.uid || rawTarget;
    if (!targetInternalUid || targetInternalUid === req.authUser.uid) {
      res.status(400).json({ error: "Invalid target user." });
      return;
    }
    const [saved] = await db.insert(friends).values({ requesterUid: req.authUser.uid, addresseeUid: targetInternalUid, status: "blocked" }).onConflictDoUpdate({
      target: [friends.requesterUid, friends.addresseeUid],
      set: { status: "blocked", updatedAt: /* @__PURE__ */ new Date() }
    }).returning();
    res.json({
      ok: true,
      relation: {
        ...saved,
        requesterUid: req.authUser.publicId,
        addresseeUid: resolvedTarget?.publicId || rawTarget
      }
    });
  });
  app.post("/api/friends/unblock", requireVerifiedSession, async (req, res) => {
    const rawTarget = String(req.body?.targetUidOrPublicId || req.body?.targetUid || "").trim();
    if (!rawTarget) {
      res.status(400).json({ error: "Missing target user ID." });
      return;
    }
    try {
      const result = await unblockUser(req.authUser.uid, rawTarget);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Unable to unblock user." });
    }
  });
  app.get("/api/messages/dm/:peerUid", requireVerifiedSession, async (req, res) => {
    const rawPeer = String(req.params.peerUid);
    const resolvedPeer = await resolveUserByUidOrPublicId(rawPeer);
    const internalPeerUid = resolvedPeer?.uid || rawPeer;
    if (await isBlockedBetween(req.authUser.uid, internalPeerUid)) {
      res.status(403).json({ error: "Messages unavailable because a block is active." });
      return;
    }
    if (!await areUsersAcceptedFriends(req.authUser.uid, internalPeerUid)) {
      res.status(403).json({ error: "Only accepted friends can access direct messages." });
      return;
    }
    const threadId = makeDmThreadId(req.authUser.uid, internalPeerUid);
    const limit = Math.min(80, Math.max(10, Math.floor(Number(req.query.limit || 40))));
    const beforeParam = String(req.query.before || "").trim();
    let beforeDate = null;
    if (beforeParam) {
      const d = new Date(beforeParam);
      if (!Number.isNaN(d.getTime())) beforeDate = d;
    }
    const rowsDesc = await db.select().from(messages).where(
      and3(
        eq6(messages.scope, "dm"),
        eq6(messages.threadId, threadId),
        beforeDate ? lt(messages.createdAt, beforeDate) : void 0
      )
    ).orderBy(desc3(messages.createdAt), desc3(messages.id)).limit(limit + 1);
    const hasMore = rowsDesc.length > limit;
    const rows = rowsDesc.slice(0, limit).reverse();
    const uidMap = await mapUidsToPublicIds([req.authUser.uid, internalPeerUid]);
    res.json({
      ok: true,
      hasMore,
      messages: rows.map((m) => ({
        ...m,
        senderUid: uidMap[m.senderUid] || m.senderUid,
        recipientUid: m.recipientUid ? uidMap[m.recipientUid] || m.recipientUid : null
      }))
    });
  });
  app.post("/api/messages/dm/:peerUid/read", requireVerifiedSession, async (req, res) => {
    const rawPeer = String(req.params.peerUid);
    const resolvedPeer = await resolveUserByUidOrPublicId(rawPeer);
    const internalPeerUid = resolvedPeer?.uid || rawPeer;
    const threadId = makeDmThreadId(req.authUser.uid, internalPeerUid);
    await db.update(messages).set({ readAt: /* @__PURE__ */ new Date() }).where(
      and3(
        eq6(messages.scope, "dm"),
        eq6(messages.threadId, threadId),
        eq6(messages.recipientUid, req.authUser.uid),
        isNull2(messages.readAt)
      )
    );
    res.json({ ok: true });
  });
  app.get("/api/messages/unread-count", requireVerifiedSession, async (req, res) => {
    const [row] = await db.select({ count: sql3`COUNT(*)` }).from(messages).where(
      and3(
        eq6(messages.scope, "dm"),
        eq6(messages.recipientUid, req.authUser.uid),
        isNull2(messages.readAt)
      )
    );
    res.json({ ok: true, unreadCount: Number(row?.count ?? 0) });
  });
  app.get("/api/moments", requireVerifiedSession, async (req, res) => {
    const viewerUid = req.authUser.uid;
    const [rows, aclRows, myLikes] = await Promise.all([
      db.select({
        id: posts.id,
        authorInternalUid: posts.authorUid,
        mediaType: posts.mediaType,
        mediaUrl: posts.mediaUrl,
        caption: posts.caption,
        likesCount: posts.likesCount,
        commentsCount: posts.commentsCount,
        sharesCount: posts.sharesCount,
        createdAt: posts.createdAt,
        authorName: profiles.displayName,
        authorPublicId: users.publicId,
        authorPhoto: profiles.photoUrl,
        authorVipLevel: vipMemberships.vipLevel,
        authorVipStatus: vipMemberships.vipStatus
      }).from(posts).innerJoin(users, eq6(posts.authorUid, users.uid)).innerJoin(profiles, eq6(posts.authorUid, profiles.userUid)).leftJoin(vipMemberships, eq6(posts.authorUid, vipMemberships.userUid)).where(eq6(posts.status, "active")).orderBy(desc3(posts.createdAt)).limit(80),
      db.select().from(platformSettings).where(ilike3(platformSettings.key, "moment_acl:%")),
      db.select().from(likes).where(eq6(likes.userUid, viewerUid))
    ]);
    const aclMap = /* @__PURE__ */ new Map();
    for (const row of aclRows) {
      const postId = row.key.replace(/^moment_acl:/, "");
      const val = row.value && typeof row.value === "object" ? row.value : {};
      aclMap.set(postId, {
        visibility: val.visibility === "selected" ? "selected" : "public",
        allowedUids: Array.isArray(val.allowedUids) ? val.allowedUids.map((u) => String(u || "").trim()).filter(Boolean) : []
      });
    }
    const likedSet = new Set(myLikes.map((l) => l.postId));
    const visibleRows = rows.filter((p) => {
      const acl = aclMap.get(p.id);
      if (!acl || acl.visibility === "public") return true;
      return p.authorInternalUid === viewerUid || acl.allowedUids.includes(viewerUid);
    });
    res.json({
      ok: true,
      posts: visibleRows.slice(0, 50).map(({ authorInternalUid: _internal, ...p }) => {
        const acl = aclMap.get(p.id);
        return {
          ...p,
          authorUid: p.authorPublicId,
          authorVipLevel: p.authorVipStatus === "active" ? Number(p.authorVipLevel ?? 0) : 0,
          likedByMe: likedSet.has(p.id),
          visibility: acl?.visibility ?? "public"
        };
      })
    });
  });
  app.get("/api/moments/shared", requireVerifiedSession, async (req, res) => {
    const viewerUid = req.authUser.uid;
    const [rows, aclRows, myLikes, friendRows] = await Promise.all([
      db.select({
        id: posts.id,
        authorInternalUid: posts.authorUid,
        mediaType: posts.mediaType,
        mediaUrl: posts.mediaUrl,
        caption: posts.caption,
        likesCount: posts.likesCount,
        commentsCount: posts.commentsCount,
        sharesCount: posts.sharesCount,
        createdAt: posts.createdAt,
        authorName: profiles.displayName,
        authorPublicId: users.publicId,
        authorPhoto: profiles.photoUrl,
        authorVipLevel: vipMemberships.vipLevel,
        authorVipStatus: vipMemberships.vipStatus
      }).from(posts).innerJoin(users, eq6(posts.authorUid, users.uid)).innerJoin(profiles, eq6(posts.authorUid, profiles.userUid)).leftJoin(vipMemberships, eq6(posts.authorUid, vipMemberships.userUid)).where(eq6(posts.status, "active")).orderBy(desc3(posts.createdAt)).limit(80),
      db.select().from(platformSettings).where(ilike3(platformSettings.key, "moment_acl:%")),
      db.select().from(likes).where(eq6(likes.userUid, viewerUid)),
      db.select().from(friends).where(
        and3(
          eq6(friends.status, "accepted"),
          or4(eq6(friends.requesterUid, viewerUid), eq6(friends.addresseeUid, viewerUid))
        )
      )
    ]);
    const acceptedFriendUids = new Set(
      friendRows.map((r) => r.requesterUid === viewerUid ? r.addresseeUid : r.requesterUid)
    );
    const aclMap = /* @__PURE__ */ new Map();
    for (const row of aclRows) {
      const postId = row.key.replace(/^moment_acl:/, "");
      const val = row.value && typeof row.value === "object" ? row.value : {};
      aclMap.set(postId, {
        visibility: val.visibility === "selected" ? "selected" : "public",
        allowedUids: Array.isArray(val.allowedUids) ? val.allowedUids.map((u) => String(u || "").trim()).filter(Boolean) : []
      });
    }
    const likedSet = new Set(myLikes.map((l) => l.postId));
    const sharedRows = rows.filter((p) => {
      const acl = aclMap.get(p.id);
      if (acl?.visibility === "selected") {
        return p.authorInternalUid === viewerUid || acl.allowedUids.includes(viewerUid);
      }
      return p.authorInternalUid === viewerUid || acceptedFriendUids.has(p.authorInternalUid);
    });
    res.json({
      ok: true,
      posts: sharedRows.slice(0, 40).map(({ authorInternalUid: _internal, ...p }) => {
        const acl = aclMap.get(p.id);
        return {
          ...p,
          authorUid: p.authorPublicId,
          authorVipLevel: p.authorVipStatus === "active" ? Number(p.authorVipLevel ?? 0) : 0,
          likedByMe: likedSet.has(p.id),
          visibility: acl?.visibility ?? "public"
        };
      })
    });
  });
  app.post("/api/moments", requireVerifiedSession, async (req, res) => {
    try {
      await assertUserNotBanned(req.authUser.uid, ["chat", "complete"]);
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : "Restricted from posting." });
      return;
    }
    const caption = String(req.body?.caption || "").trim().slice(0, 1e3);
    const mediaType = req.body?.mediaType === "video" ? "video" : req.body?.mediaUrl ? "photo" : "text";
    const mediaUrl = typeof req.body?.mediaUrl === "string" ? req.body.mediaUrl : null;
    if (mediaUrl && !/^data:(image|video)\//i.test(mediaUrl) && !mediaUrl.startsWith("https://")) {
      res.status(400).json({ error: "Invalid media format." });
      return;
    }
    if (!caption && !mediaUrl) {
      res.status(400).json({ error: "Caption or media is required." });
      return;
    }
    const visibility = req.body?.visibility === "selected" ? "selected" : "public";
    const rawAllowed = Array.isArray(req.body?.allowedUids) ? req.body.allowedUids.map((u) => String(u || "").trim()).filter(Boolean).slice(0, 100) : [];
    const resolvedAllowedUids = [];
    if (visibility === "selected" && rawAllowed.length > 0) {
      for (const ident of rawAllowed) {
        const u = await resolveUserByUidOrPublicId(ident);
        if (u && !resolvedAllowedUids.includes(u.uid)) {
          resolvedAllowedUids.push(u.uid);
        }
      }
    }
    const id = `PST-${crypto5.randomBytes(5).toString("hex").toUpperCase()}`;
    const [created] = await db.insert(posts).values({ id, authorUid: req.authUser.uid, mediaType, mediaUrl, caption }).returning();
    if (visibility === "selected") {
      await db.insert(platformSettings).values({
        key: `moment_acl:${created.id}`,
        value: { visibility: "selected", allowedUids: resolvedAllowedUids },
        updatedByUid: req.authUser.uid,
        updatedAt: /* @__PURE__ */ new Date()
      }).onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: { visibility: "selected", allowedUids: resolvedAllowedUids },
          updatedByUid: req.authUser.uid,
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
    }
    await recordTaskActionProgress(req.authUser.uid, "post_moment", 1).catch(() => {
    });
    res.json({
      ok: true,
      post: {
        ...created,
        authorUid: req.authUser.publicId,
        authorPublicId: req.authUser.publicId,
        authorVipLevel: req.authUser.vipStatusRaw === "active" ? req.authUser.vipLevel : 0,
        visibility,
        allowedUids: rawAllowed
      }
    });
  });
  app.post("/api/moments/:postId/like", requireVerifiedSession, async (req, res) => {
    const postId = String(req.params.postId);
    const existing = await db.select().from(likes).where(and3(eq6(likes.postId, postId), eq6(likes.userUid, req.authUser.uid)));
    if (existing.length > 0) {
      await db.delete(likes).where(and3(eq6(likes.postId, postId), eq6(likes.userUid, req.authUser.uid)));
      await db.update(posts).set({ likesCount: sql3`GREATEST(0, ${posts.likesCount} - 1)` }).where(eq6(posts.id, postId));
      res.json({ ok: true, liked: false });
    } else {
      await db.insert(likes).values({ postId, userUid: req.authUser.uid });
      await db.update(posts).set({ likesCount: sql3`${posts.likesCount} + 1` }).where(eq6(posts.id, postId));
      res.json({ ok: true, liked: true });
    }
  });
  app.get("/api/moments/:postId/comments", requireVerifiedSession, async (req, res) => {
    const postId = String(req.params.postId);
    const rows = await db.select({
      id: comments.id,
      postId: comments.postId,
      body: comments.body,
      createdAt: comments.createdAt,
      authorName: profiles.displayName,
      authorPublicId: users.publicId
    }).from(comments).innerJoin(users, eq6(comments.authorUid, users.uid)).innerJoin(profiles, eq6(comments.authorUid, profiles.userUid)).where(eq6(comments.postId, postId)).orderBy(comments.createdAt);
    res.json({ ok: true, comments: rows.map((c) => ({ ...c, authorUid: c.authorPublicId })) });
  });
  app.post("/api/moments/:postId/comments", requireVerifiedSession, async (req, res) => {
    try {
      await assertUserNotBanned(req.authUser.uid, ["chat", "complete"]);
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : "Restricted from commenting." });
      return;
    }
    const postId = String(req.params.postId);
    const body = String(req.body?.body || "").trim().slice(0, 400);
    if (!body) {
      res.status(400).json({ error: "Comment text required." });
      return;
    }
    const [created] = await db.insert(comments).values({ postId, authorUid: req.authUser.uid, body }).returning();
    await db.update(posts).set({ commentsCount: sql3`${posts.commentsCount} + 1` }).where(eq6(posts.id, postId));
    res.json({
      ok: true,
      comment: {
        ...created,
        authorUid: req.authUser.publicId,
        authorName: req.authUser.name,
        authorPublicId: req.authUser.publicId
      }
    });
  });
  app.post("/api/moments/:postId/share", requireVerifiedSession, async (req, res) => {
    const postId = String(req.params.postId);
    await db.update(posts).set({ sharesCount: sql3`${posts.sharesCount} + 1` }).where(eq6(posts.id, postId));
    res.json({ ok: true });
  });
  app.get("/api/events", requireVerifiedSession, async (_req, res) => {
    await ensureSeedData();
    const rows = await db.select().from(events).orderBy(desc3(events.createdAt));
    res.json({ ok: true, events: rows });
  });
  app.post("/api/events/:eventId/join", requireVerifiedSession, async (req, res) => {
    const eventId = String(req.params.eventId);
    await db.insert(eventParticipants).values({ eventId, userUid: req.authUser.uid, score: 0 }).onConflictDoNothing();
    res.json({ ok: true });
  });
  app.get("/api/notifications", requireVerifiedSession, async (req, res) => {
    const rows = await getUserNotifications(req.authUser.uid);
    const selfPublicId = req.authUser.publicId;
    res.json({ ok: true, notifications: rows.map((n) => ({ ...n, userUid: n.userUid ? selfPublicId : null })) });
  });
  app.post("/api/notifications/read-all", requireVerifiedSession, async (req, res) => {
    await db.update(notifications).set({ read: true }).where(eq6(notifications.userUid, req.authUser.uid));
    res.json({ ok: true });
  });
  app.post("/api/reports", requireVerifiedSession, async (req, res) => {
    const targetType = String(req.body?.targetType || "user");
    const rawTargetId = String(req.body?.targetId || "").trim();
    const reason = String(req.body?.reason || "").trim();
    const details = typeof req.body?.details === "string" ? req.body.details.trim() : null;
    if (!rawTargetId || !reason) {
      res.status(400).json({ error: "targetId and reason required." });
      return;
    }
    const resolvedTarget = targetType === "user" ? await resolveUserByUidOrPublicId(rawTargetId) : null;
    const storedTargetId = resolvedTarget?.uid || rawTargetId;
    const [saved] = await db.insert(reports).values({ reporterUid: req.authUser.uid, targetType, targetId: storedTargetId, reason, details }).returning();
    res.json({
      ok: true,
      report: {
        ...saved,
        reporterUid: req.authUser.publicId,
        targetId: resolvedTarget?.publicId || rawTargetId
      }
    });
  });
  app.get("/api/games/matches", requireVerifiedSession, (_req, res) => {
    const hub = options.getRealtimeHub?.();
    res.json({ ok: true, matches: hub ? hub.gameEngine.listMatches() : [] });
  });
  app.get("/api/games/history", requireVerifiedSession, async (_req, res) => {
    const rows = await db.select().from(gameMatches).orderBy(desc3(gameMatches.createdAt)).limit(25);
    const uidCandidates = rows.flatMap((m) => [
      m.hostUid,
      m.winnerUid || "",
      ...Array.isArray(m.players) ? m.players.map((p) => String(p?.uid || "")) : []
    ]);
    const uidMap = await mapUidsToPublicIds(uidCandidates);
    res.json({
      ok: true,
      history: rows.map((m) => ({
        ...m,
        hostUid: uidMap[m.hostUid] || m.hostUid,
        winnerUid: m.winnerUid ? uidMap[m.winnerUid] || m.winnerUid : null,
        players: Array.isArray(m.players) ? m.players.map((p) => ({ ...p, uid: uidMap[p.uid] || p.uid })) : []
      }))
    });
  });
  app.use(
    "/api/admin",
    createAdminRouter({
      requireAuth: requireVerifiedSession,
      getRealtimeHub: options.getRealtimeHub
    })
  );
  app.use("/api", requireVerifiedSession, (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  return app;
}
async function startServer() {
  let realtimeHub = null;
  const app = createApp({ getRealtimeHub: () => realtimeHub });
  const server = http.createServer(app);
  realtimeHub = new RealtimeHub(server, authenticateWebSocketRequest);
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const candidateA = path2.resolve(process.cwd(), "dist");
    const candidateB = path2.join(__dirname, "dist");
    const candidateC = path2.join(__dirname, "../dist");
    const distPath = [candidateA, candidateB, candidateC].find(
      (p) => fs2.existsSync(path2.join(p, "index.html"))
    ) || candidateA;
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`OG VELOCITY server listening on http://0.0.0.0:${PORT}`);
    void (async () => {
      await ensureDatabaseSchemaReady().catch((err) => {
        console.error("Schema readiness startup warning:", err);
      });
      await ensureNumericPublicIdsMigrated().catch((err) => {
        console.error("Public ID startup migration warning:", err);
      });
      await ensureSeedData().catch((err) => {
        console.error("Seed data initialization warning:", err);
      });
      await ensureOfficialRoomsSecurityState().catch((err) => {
        console.error("Official rooms security state initialization warning:", err);
      });
      await runVipDecaySweep().catch((err) => {
        console.error("Initial VIP decay sweep warning:", err);
      });
    })();
    setInterval(() => {
      void runVipDecaySweep().catch((err) => {
        console.error("Scheduled VIP decay sweep error:", err);
      });
    }, 36e5).unref();
  });
}
var isMainModule = process.argv[1] && path2.resolve(process.argv[1]) === path2.resolve(__filename);
if (isMainModule) {
  startServer();
}
export {
  authenticateWebSocketRequest,
  createApp
};
