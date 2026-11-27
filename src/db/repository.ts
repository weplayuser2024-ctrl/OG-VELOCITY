import crypto from 'crypto';
import QRCode from 'qrcode';
import {
  and,
  desc,
  asc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { Pool } from 'pg';
import { db, pool } from './index.ts';
import {
  adminPermissionHistory,
  adminPermissionSets,
  adminUserPermissions,
  adminUsers,
  auditLogs,
  authIdentities,
  charmRecords,
  coinPackages,
  comments,
  cpProposals,
  cpRelationships,
  customGifts,
  eventParticipants,
  events,
  friends,
  gameMatches,
  giftTransactions,
  gifts,
  likes,
  messages,
  notifications,
  paymentOrders,
  paymentQrVersions,
  platformSettings,
  posts,
  profiles,
  rankings,
  referrals,
  relationshipTags,
  reports,
  reservedPublicIds,
  rolesPermissions,
  roomBackgrounds,
  roomParticipants,
  shopItems,
  taskProgress,
  tasks,
  userBans,
  userInventory,
  userSessions,
  users,
  vipMemberships,
  vipPackages,
  vipPointLedger,
  vipProgressionRules,
  vipSubscriptionHistory,
  voiceRooms,
  walletTransactions,
  wallets,
  withdrawalRequests,
} from './schema.ts';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_VIP_DECAY_CONFIG,
  PERMANENT_UPI_CONFIG,
  VIP_PROGRESSION_SEED,
  ensureSeedData,
} from './seed.ts';

export type AccountRole = 'normal_user' | 'support_staff' | 'moderator' | 'admin' | 'super_admin';

export const ADMIN_PANEL_ROLES = new Set<AccountRole>([
  'support_staff',
  'moderator',
  'admin',
  'super_admin',
]);

export function getCycleKeys(now = new Date()): {
  daily: string;
  weekly: string;
  monthly: string;
} {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');

  // ISO week number
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return {
    daily: `${y}-${m}-${d}`,
    weekly: `weekly-${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    monthly: `monthly-${y}-${m}`,
  };
}

export const MAX_VIP_LEVEL = 18;
export const REFERRAL_REWARD_COINS = 25_000;

export function computeVipLevelFromPoints(points: number): number {
  let lvl = 1;
  for (const r of VIP_PROGRESSION_SEED) {
    if (points >= r.requiredPoints) {
      lvl = r.level;
    }
  }
  return Math.min(MAX_VIP_LEVEL, Math.max(1, lvl));
}

let schemaReadyPromise: Promise<void> | null = null;

async function inspectExistingSchemaStatus(): Promise<{
  allReady: boolean;
  usersExists: boolean;
  usersHasReferredByUid: boolean;
  vipMembershipsReady: boolean;
  shopItemsExists: boolean;
  userBansExists: boolean;
  referralsExists: boolean;
  mediaAssetsExists: boolean;
  voiceRoomsHasRoomSettings: boolean;
}> {
  const requiredVipColumns = [
    'user_uid',
    'vip_level',
    'vip_status',
    'vip_growth',
    'activated_by_order_id',
    'activated_by_admin_uid',
    'plan_label',
    'activated_at',
    'expires_at',
    'last_decay_date_key',
    'last_decay_at',
    'grace_days_applied',
    'custom_benefits',
    'updated_at',
  ];

  const [tableRows, columnRows] = await Promise.all([
    pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [['users', 'vip_memberships', 'shop_items', 'user_bans', 'referrals', 'voice_rooms', 'withdrawal_requests', 'relationship_tags', 'media_assets']]
    ),
    pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [['users', 'vip_memberships', 'voice_rooms', 'profiles', 'wallets', 'payment_orders']]
    ),
  ]);

  const existingTables = new Set(tableRows.rows.map((r) => r.table_name));
  const colsByTable = new Map<string, Set<string>>();
  for (const row of columnRows.rows) {
    if (!colsByTable.has(row.table_name)) {
      colsByTable.set(row.table_name, new Set());
    }
    colsByTable.get(row.table_name)!.add(row.column_name);
  }

  const usersExists = existingTables.has('users') && Boolean(colsByTable.get('users')?.has('uid'));
  const usersHasReferredByUid = Boolean(colsByTable.get('users')?.has('referred_by_uid'));
  const vipCols = colsByTable.get('vip_memberships');
  const vipMembershipsReady =
    existingTables.has('vip_memberships') &&
    requiredVipColumns.every((col) => Boolean(vipCols?.has(col)));
  const shopItemsExists = existingTables.has('shop_items');
  const userBansExists = existingTables.has('user_bans');
  const referralsExists = existingTables.has('referrals');
  const mediaAssetsExists = existingTables.has('media_assets');
  const withdrawalRequestsExists = existingTables.has('withdrawal_requests');
  const relationshipTagsExists = existingTables.has('relationship_tags');
  const voiceRoomsHasRoomSettings =
    existingTables.has('voice_rooms') &&
    Boolean(colsByTable.get('voice_rooms')?.has('room_settings'));
  const profilesHasExtended =
    Boolean(colsByTable.get('profiles')?.has('theme_mode')) &&
    Boolean(colsByTable.get('profiles')?.has('equipped_emote_id'));
  const walletsHasFrozen = Boolean(colsByTable.get('wallets')?.has('is_frozen'));
  const ordersHasHolder =
    Boolean(colsByTable.get('payment_orders')?.has('account_holder_name')) &&
    Boolean(colsByTable.get('payment_orders')?.has('payment_date_time'));

  const allReady =
    usersExists &&
    usersHasReferredByUid &&
    vipMembershipsReady &&
    shopItemsExists &&
    userBansExists &&
    referralsExists &&
    mediaAssetsExists &&
    withdrawalRequestsExists &&
    relationshipTagsExists &&
    voiceRoomsHasRoomSettings &&
    profilesHasExtended &&
    walletsHasFrozen &&
    ordersHasHolder;

  return {
    allReady,
    usersExists,
    usersHasReferredByUid,
    vipMembershipsReady,
    shopItemsExists,
    userBansExists,
    referralsExists,
    mediaAssetsExists,
    voiceRoomsHasRoomSettings,
  };
}

export async function ensureDatabaseSchemaReady(): Promise<void> {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const status = await inspectExistingSchemaStatus();
    if (status.allReady) {
      return;
    }

    const hasAdminCreds = Boolean(
      process.env.SQL_ADMIN_USER && process.env.SQL_ADMIN_PASSWORD
    );
    const adminPool = hasAdminCreds
      ? new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_ADMIN_USER,
          password: process.env.SQL_ADMIN_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: 2,
          connectionTimeoutMillis: 15000,
        })
      : pool;

    try {
      // Never auto-create an orphan users table silently; ensure users(uid) exists before adding FK tables
      if (!status.usersExists) {
        throw new Error(
          'Database schema missing required users(uid) table. Run Drizzle schema push before starting the server.'
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

      if (!status.mediaAssetsExists) {
        await adminPool.query(`
          CREATE TABLE IF NOT EXISTS public.media_assets (
            id text PRIMARY KEY,
            owner_uid text NOT NULL,
            mime_type text NOT NULL,
            data_base64 text NOT NULL,
            byte_size integer NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );
        `);
      }

      const appRole = (process.env.SQL_USER || '').replace(/[^a-zA-Z0-9_]/g, '');
      if (hasAdminCreds && appRole && appRole !== process.env.SQL_ADMIN_USER) {
        await adminPool
          .query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appRole}";`)
          .catch(() => {});
        await adminPool
          .query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${appRole}";`)
          .catch(() => {});
      }
    } finally {
      if (hasAdminCreds && adminPool !== pool) {
        await adminPool.end().catch(() => {});
      }
    }
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });
  return schemaReadyPromise;
}

export interface VipDecayConfig {
  enabled: boolean;
  graceDays: number;
  mode: 'fixed' | 'percent';
  dailyAmount: number;
  dailyPercent: number;
}

export interface CpPartnerSummary {
  partnerUid: string;
  partnerName: string;
  partnerAvatarId: string;
  partnerPhotoUrl?: string | null;
  ringNumber: number;
  ringName: string;
  since: string;
  cpCharm: number;
  cpLevel: number;
}

export type BanType = 'complete' | 'mic' | 'seat' | 'chat';

export interface ActiveBanView {
  id: number;
  banType: BanType;
  durationDays: number | null;
  expiresAt: string | null;
  reason: string;
  createdAt: string;
}

export interface RelationshipTagSummary {
  id: string;
  tagType: RelationshipTagKey;
  partnerUid: string;
  partnerName: string;
  partnerPhotoUrl?: string | null;
  status: string;
  isIncoming: boolean;
  charmScore: number;
  level: number;
  startedAt: string;
}

export interface FullUserView {
  uid: string;
  zayroId: string;
  publicId: string;
  email: string | null;
  phone: string | null;
  provider: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: AccountRole;
  accountStatus: 'active' | 'suspended' | 'banned';
  banReason?: string | null;
  activeBans?: ActiveBanView[];
  referredByUid?: string | null;
  name: string;
  handle: string;
  photoUrl: string | null;
  coverUrl: string | null;
  bio: string;
  gender: 'Male' | 'Female' | 'Other';
  age: number;
  country: string;
  ornament: 'crown' | 'lotus' | 'halo' | 'visor' | 'crescent' | 'flame';
  themeMode: 'dark' | 'light';
  equippedEmoteId: string | null;
  equippedFrameId: string | null;
  equippedRingId: string | null;
  equippedEntryId: string | null;
  tags: string[];
  coins: number;
  walletFrozen: boolean;
  charmPoints: number;
  giftsReceived: number;
  vipLevel: number; // 0..18 (0 when inactive/expired)
  vipEarnedLevel: number; // progression level from current vipGrowth
  vipStatus: 'Not Active' | 'Active';
  vipStatusRaw: 'inactive' | 'active' | 'expired';
  vipGrowth: number;
  vipPlanLabel: string | null;
  vipExpiresAt: string | null;
  vipGraceEndsAt: string | null;
  vipNextDecayAt: string | null;
  vipInGracePeriod: boolean;
  vipGraceDays: number;
  vipCustomBenefits: string[];
  vipBenefits: string[];
  cpPartner: CpPartnerSummary | null;
  relationshipTags: RelationshipTagSummary[];
  createdAt: string;
  lastLoginAt: string;
  lastSeenAt: string;
}

const CP_CHARM_LEVEL_MINS = [
  0, 12_000, 42_000, 102_000, 182_000, 292_000, 442_000, 642_000, 900_000, 1_250_000,
];

export function computeCpLevelFromCharm(cpCharm: number): number {
  let lvl = 1;
  for (let i = 0; i < CP_CHARM_LEVEL_MINS.length; i++) {
    if (cpCharm >= CP_CHARM_LEVEL_MINS[i]) lvl = i + 1;
  }
  return lvl;
}

export const RELATIONSHIP_TAG_THRESHOLDS = [
  0, 15_000, 40_000, 100_000, 200_000, 350_000, 600_000, 800_000, 1_000_000, 1_200_000,
];

export const ALLOWED_RELATIONSHIP_TAGS = [
  'bro',
  'bestie',
  'sister',
  'soulmate',
  'lover',
  'confident',
  'cp_partner',
] as const;

export type RelationshipTagKey = (typeof ALLOWED_RELATIONSHIP_TAGS)[number];

export function normalizeRelationshipTagKey(raw: string): RelationshipTagKey {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'cp_partner') return 'lover';
  if (
    clean === 'bro' ||
    clean === 'bestie' ||
    clean === 'sister' ||
    clean === 'soulmate' ||
    clean === 'lover' ||
    clean === 'confident'
  ) {
    return clean;
  }
  return 'bro';
}

export function computeRelationshipTagLevel(charm: number): number {
  let lvl = 1;
  for (let i = 0; i < RELATIONSHIP_TAG_THRESHOLDS.length; i++) {
    if (charm >= RELATIONSHIP_TAG_THRESHOLDS[i]) lvl = i + 1;
  }
  return Math.min(10, Math.max(1, lvl));
}

const SUPER_ADMIN_EMAILS = new Set(
  (process.env.SUPER_ADMIN_EMAIL || 'weplayuser2024@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

let publicIdMigrationPromise: Promise<void> | null = null;

export function sanitizeUserForClient(user: FullUserView): FullUserView {
  return {
    ...user,
    uid: user.publicId,
    zayroId: user.publicId,
    publicId: user.publicId,
  };
}

export async function resolveUserByUidOrPublicId(
  identifier: string,
  executor: any = db
): Promise<{ uid: string; publicId: string; role: string; accountStatus: string } | null> {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const cleanedNumeric = raw.startsWith('#') ? raw.slice(1).trim() : raw;
  const [row] = await executor
    .select({
      uid: users.uid,
      publicId: users.publicId,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(
      or(
        eq(users.uid, raw),
        eq(users.publicId, raw),
        eq(users.publicId, cleanedNumeric),
        eq(users.publicId, raw.toUpperCase())
      )
    );
  return row || null;
}

export async function mapUidsToPublicIds(uids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(uids.map((u) => String(u || '').trim()).filter(Boolean)));
  if (unique.length === 0) return {};
  const rows = await db
    .select({ uid: users.uid, publicId: users.publicId })
    .from(users)
    .where(inArray(users.uid, unique));
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.uid] = r.publicId;
  }
  return out;
}

const PUBLIC_ID_COUNTER_KEY = 'public_id_counter';

async function getMaxNumericPublicId(tx: any): Promise<number> {
  const maxUserRow = await tx.execute(
    sql`SELECT COALESCE(MAX(CAST(public_id AS BIGINT)), 100000) AS max_id FROM users WHERE public_id ~ '^[0-9]+$'`
  );
  const maxResRow = await tx.execute(
    sql`SELECT COALESCE(MAX(CAST(public_id AS BIGINT)), 100000) AS max_id FROM reserved_public_ids WHERE public_id ~ '^[0-9]+$'`
  );
  const [counterRow] = await tx
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, PUBLIC_ID_COUNTER_KEY))
    .for('update');

  const maxUser = Number((maxUserRow as any)?.rows?.[0]?.max_id ?? 100000);
  const maxRes = Number((maxResRow as any)?.rows?.[0]?.max_id ?? 100000);
  const lastAssigned = Number((counterRow?.value as { lastAssigned?: number } | undefined)?.lastAssigned ?? 100000);
  return Math.max(100000, maxUser, maxRes, lastAssigned);
}

async function allocateNextNumericPublicId(tx: any, userUid: string): Promise<string> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(9021001)`);

  // New non-admin users receive a unique random 7-digit numeric ID (1000000 - 9999999),
  // preserving 100001 (Super Admin) and all existing 6-digit accounts.
  for (let i = 0; i < 120; i++) {
    const candidateNum = crypto.randomInt(1_000_000, 10_000_000);
    const nextId = String(candidateNum);
    if (nextId === '100001') continue;

    const existingUser = await tx.select({ uid: users.uid }).from(users).where(eq(users.publicId, nextId));
    const existingRes = await tx
      .select({ publicId: reservedPublicIds.publicId })
      .from(reservedPublicIds)
      .where(eq(reservedPublicIds.publicId, nextId));

    if (existingUser.length === 0 && existingRes.length === 0) {
      await tx.delete(reservedPublicIds).where(eq(reservedPublicIds.userUid, userUid));
      await tx.insert(reservedPublicIds).values({ publicId: nextId, userUid }).onConflictDoNothing();
      return nextId;
    }
  }
  throw new Error('Unable to allocate unique 7-digit numeric public ID.');
}

export async function ensureNumericPublicIdsMigrated(): Promise<void> {
  if (publicIdMigrationPromise) return publicIdMigrationPromise;

  publicIdMigrationPromise = (async () => {
    await ensureDatabaseSchemaReady();
    await ensureSeedData();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(9021001)`);

      // Preserve existing clean numeric public IDs, and migrate only legacy ZAY-/non-numeric IDs
      const legacyUsers = await tx
        .select({ uid: users.uid, publicId: users.publicId })
        .from(users)
        .where(sql`${users.publicId} !~ '^[0-9]{6,}$'`)
        .orderBy(asc(users.createdAt), asc(users.uid));

      for (const u of legacyUsers) {
        const nextId = await allocateNextNumericPublicId(tx, u.uid);
        await tx
          .update(users)
          .set({ publicId: nextId, updatedAt: new Date() })
          .where(eq(users.uid, u.uid));

        const [prof] = await tx
          .select({ handle: profiles.handle })
          .from(profiles)
          .where(eq(profiles.userUid, u.uid));
        if (prof?.handle && u.publicId) {
          const oldSuffix = u.publicId.replace(/^ZAY-/i, '').toLowerCase();
          if (oldSuffix && prof.handle.endsWith(`.${oldSuffix}`)) {
            const nextHandle = `${prof.handle.slice(0, -oldSuffix.length)}${nextId}`;
            await tx.update(profiles).set({ handle: nextHandle }).where(eq(profiles.userUid, u.uid));
          }
        }
      }

      // Ensure every valid numeric user has its public_id recorded in reserved_public_ids
      const numericUsers = await tx
        .select({ uid: users.uid, publicId: users.publicId })
        .from(users)
        .where(sql`${users.publicId} ~ '^[0-9]{6,}$'`);
      for (const u of numericUsers) {
        await tx
          .insert(reservedPublicIds)
          .values({ publicId: u.publicId, userUid: u.uid })
          .onConflictDoNothing();
      }

      // Ensure counter is synced at least to current max existing numeric ID
      const currentMax = await getMaxNumericPublicId(tx);
      await tx
        .insert(platformSettings)
        .values({
          key: PUBLIC_ID_COUNTER_KEY,
          value: { lastAssigned: currentMax },
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: { lastAssigned: currentMax }, updatedAt: new Date() },
        });
    });

    await ensureVoiceRoomsHaveOwners();
  })().catch((err) => {
    publicIdMigrationPromise = null;
    throw err;
  });

  return publicIdMigrationPromise;
}

export const DEFAULT_ROOM_CLOSED_REASON =
  'This room has been closed because the Owner and Admin are no longer present.';

export function getMaxRoomAdminSlots(roomLevel: number): number {
  const lvl = Math.max(1, Math.min(20, Number(roomLevel || 1)));
  return Math.min(15, 3 + Math.floor(((lvl - 1) * 12) / 19));
}

let lastRoomOwnerCheckAt = 0;
let roomOwnerCheckInFlight: Promise<void> | null = null;

export async function ensureVoiceRoomsHaveOwners(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRoomOwnerCheckAt < 30_000) return;
  if (roomOwnerCheckInFlight) return roomOwnerCheckInFlight;

  roomOwnerCheckInFlight = (async () => {
    const unownedRooms = await db
      .select({ id: voiceRooms.id })
      .from(voiceRooms)
      .where(or(eq(voiceRooms.ownerUid, 'system-official'), eq(voiceRooms.ownerUid, '')));
    if (unownedRooms.length > 0) {
      const [superAdmin] = await db
        .select({ uid: users.uid })
        .from(users)
        .where(and(eq(users.role, 'super_admin'), eq(users.accountStatus, 'active')))
        .orderBy(asc(users.createdAt))
        .limit(1);

      if (superAdmin) {
        await db
          .update(voiceRooms)
          .set({ ownerUid: superAdmin.uid, updatedAt: new Date() })
          .where(or(eq(voiceRooms.ownerUid, 'system-official'), eq(voiceRooms.ownerUid, '')));
      }
    }
    lastRoomOwnerCheckAt = Date.now();
  })().finally(() => {
    roomOwnerCheckInFlight = null;
  });

  return roomOwnerCheckInFlight;
}

export function serializeVoiceRoomForClient(
  room: typeof voiceRooms.$inferSelect,
  uidMap: Record<string, string>,
  onlineCount = 0
) {
  const lockedSeats = Array.isArray(room.lockedSeats)
    ? room.lockedSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const rawSettings =
    room.roomSettings && typeof room.roomSettings === 'object'
      ? (room.roomSettings as Record<string, unknown>)
      : {};
  const { passcodeHash: _secretHash, ...safeRoom } = room;
  return {
    ...safeRoom,
    dpUrl: room.dpUrl || null,
    hasPasscode: Boolean(room.isLocked && _secretHash),
    ownerUid: room.ownerUid === 'system-official' ? 'system-official' : (uidMap[room.ownerUid] || room.ownerUid),
    adminUids: Array.isArray(room.adminUids) ? room.adminUids.map((u) => uidMap[u] || u) : [],
    lockedSeats,
    roomSettings: rawSettings,
    status: room.status || 'active',
    closedAt: room.closedAt ? room.closedAt.toISOString() : null,
    closedReason: room.closedReason || null,
    onlineCount,
  };
}

async function reserveUniquePublicId(tx: any, userUid: string): Promise<string> {
  return allocateNextNumericPublicId(tx, userUid);
}

export async function getVipDecayConfig(executor: any = db): Promise<VipDecayConfig> {
  const [row] = await executor
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'vip_decay_config'));
  const val = (row?.value as Record<string, unknown> | undefined) || {};
  return {
    enabled: val.enabled !== undefined ? Boolean(val.enabled) : DEFAULT_VIP_DECAY_CONFIG.enabled,
    graceDays: Math.max(1, Math.min(90, Math.floor(Number(val.graceDays ?? DEFAULT_VIP_DECAY_CONFIG.graceDays)))),
    mode: val.mode === 'percent' ? 'percent' : 'fixed',
    dailyAmount: Math.max(0, Math.floor(Number(val.dailyAmount ?? DEFAULT_VIP_DECAY_CONFIG.dailyAmount))),
    dailyPercent: Math.max(0, Math.min(100, Number(val.dailyPercent ?? DEFAULT_VIP_DECAY_CONFIG.dailyPercent))),
  };
}

export async function updateVipDecayConfig(
  actorUid: string,
  updates: Partial<VipDecayConfig>
): Promise<VipDecayConfig> {
  const current = await getVipDecayConfig();
  const next: VipDecayConfig = {
    enabled: typeof updates.enabled === 'boolean' ? updates.enabled : current.enabled,
    graceDays:
      updates.graceDays !== undefined
        ? Math.max(1, Math.min(90, Math.floor(Number(updates.graceDays))))
        : current.graceDays,
    mode: updates.mode === 'percent' ? 'percent' : updates.mode === 'fixed' ? 'fixed' : current.mode,
    dailyAmount:
      updates.dailyAmount !== undefined
        ? Math.max(0, Math.floor(Number(updates.dailyAmount)))
        : current.dailyAmount,
    dailyPercent:
      updates.dailyPercent !== undefined
        ? Math.max(0, Math.min(100, Number(updates.dailyPercent)))
        : current.dailyPercent,
  };
  await db.transaction(async (tx) => {
    await tx
      .insert(platformSettings)
      .values({ key: 'vip_decay_config', value: next as unknown as Record<string, unknown>, updatedByUid: actorUid, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: next as unknown as Record<string, unknown>, updatedByUid: actorUid, updatedAt: new Date() },
      });
    await tx.insert(auditLogs).values({
      actorUid,
      actorRole: 'super_admin',
      action: 'update_vip_decay_config',
      targetType: 'platform_settings',
      targetId: 'vip_decay_config',
      details: next as unknown as Record<string, unknown>,
    });
  });
  return next;
}

export function computeVipStatusDetails(
  vipRow: typeof vipMemberships.$inferSelect | undefined,
  decayConfig: VipDecayConfig,
  now = new Date()
) {
  const nowMs = now.getTime();
  const graceDays = Math.max(1, Number(decayConfig.graceDays || 15));
  let vipStatusRaw: 'inactive' | 'active' | 'expired' =
    (vipRow?.vipStatus as 'inactive' | 'active' | 'expired') || 'inactive';
  if (vipStatusRaw === 'active' && vipRow?.expiresAt && vipRow.expiresAt.getTime() <= nowMs) {
    vipStatusRaw = 'expired';
  }
  const expiresMs = vipRow?.expiresAt ? vipRow.expiresAt.getTime() : null;
  const graceEndsAt = expiresMs ? new Date(expiresMs + graceDays * 86_400_000) : null;
  const inGracePeriod = Boolean(
    vipStatusRaw === 'expired' && graceEndsAt && nowMs <= graceEndsAt.getTime()
  );

  let nextDecayAt: Date | null = null;
  if (vipStatusRaw === 'expired' && decayConfig.enabled && Number(vipRow?.vipGrowth ?? 0) > 0 && graceEndsAt) {
    const anchorMs = Math.max(
      graceEndsAt.getTime(),
      vipRow?.lastDecayAt ? vipRow.lastDecayAt.getTime() : graceEndsAt.getTime()
    );
    nextDecayAt = new Date(anchorMs + 86_400_000);
  }

  return {
    vipStatusRaw,
    graceEndsAt,
    inGracePeriod,
    graceDays,
    nextDecayAt,
  };
}

export async function syncUserVipAndDecay(
  userUid: string,
  now = new Date(),
  txOverride?: any
): Promise<{ decayedTotal: number; daysApplied: number; vipStatus: string; vipGrowth: number; vipLevel: number }> {
  const run = async (tx: any) => {
    const [vipRow] = await tx
      .select()
      .from(vipMemberships)
      .where(eq(vipMemberships.userUid, userUid))
      .for('update');
    if (!vipRow) {
      return { decayedTotal: 0, daysApplied: 0, vipStatus: 'inactive', vipGrowth: 0, vipLevel: 0 };
    }

    const decayConfig = await getVipDecayConfig(tx);
    const nowMs = now.getTime();
    let status = vipRow.vipStatus as 'inactive' | 'active' | 'expired';
    let needsUpdate = false;

    if (status === 'active' && vipRow.expiresAt && vipRow.expiresAt.getTime() <= nowMs) {
      status = 'expired';
      needsUpdate = true;
    }

    let currentGrowth = Math.max(0, Number(vipRow.vipGrowth ?? 0));
    let currentLevel = Math.max(0, Math.min(MAX_VIP_LEVEL, Number(vipRow.vipLevel ?? 0)));
    let lastDecayAt = vipRow.lastDecayAt ? new Date(vipRow.lastDecayAt) : null;
    let lastDecayDateKey = vipRow.lastDecayDateKey || null;
    let decayedTotal = 0;
    let daysApplied = 0;

    if (
      status === 'expired' &&
      decayConfig.enabled &&
      vipRow.expiresAt &&
      currentGrowth > 0
    ) {
      const graceEndsMs = vipRow.expiresAt.getTime() + decayConfig.graceDays * 86_400_000;
      if (nowMs > graceEndsMs) {
        const baseMs =
          lastDecayAt && lastDecayAt.getTime() >= graceEndsMs ? lastDecayAt.getTime() : graceEndsMs;
        const elapsedDays = Math.min(365, Math.floor((nowMs - baseMs) / 86_400_000));
        for (let step = 1; step <= elapsedDays; step++) {
          if (currentGrowth <= 0) break;
          const stepDate = new Date(baseMs + step * 86_400_000);
          const dayKey = stepDate.toISOString().slice(0, 10);
          const idempotencyKey = `decay:${userUid}:${dayKey}`;

          const rawReduction =
            decayConfig.mode === 'percent'
              ? Math.max(1, Math.round((currentGrowth * decayConfig.dailyPercent) / 100))
              : Math.max(0, decayConfig.dailyAmount);
          const actualDelta = Math.min(currentGrowth, rawReduction);
          if (actualDelta <= 0) {
            lastDecayAt = stepDate;
            continue;
          }

          const nextGrowth = Math.max(0, currentGrowth - actualDelta);
          const nextProgLevel = nextGrowth > 0 ? computeVipLevelFromPoints(nextGrowth) : 1;

          const inserted = await tx
            .insert(vipPointLedger)
            .values({
              userUid,
              delta: -actualDelta,
              balanceAfter: nextGrowth,
              vipLevelAfter: nextProgLevel,
              source: 'decay',
              referenceId: dayKey,
              idempotencyKey,
              description: `Post-grace VIP point decay (-${actualDelta} pts · ${decayConfig.mode === 'percent' ? `${decayConfig.dailyPercent}%` : 'daily fixed'})`,
            })
            .onConflictDoNothing()
            .returning({ id: vipPointLedger.id });

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
      await tx
        .update(vipMemberships)
        .set({
          vipStatus: status,
          vipGrowth: currentGrowth,
          vipLevel: currentLevel,
          lastDecayAt,
          lastDecayDateKey,
          graceDaysApplied: decayConfig.graceDays,
          updatedAt: now,
        })
        .where(eq(vipMemberships.userUid, userUid));
    }

    return {
      decayedTotal,
      daysApplied,
      vipStatus: status,
      vipGrowth: currentGrowth,
      vipLevel: currentLevel,
    };
  };

  if (txOverride) {
    return run(txOverride);
  }
  return db.transaction(run);
}

export async function runVipDecaySweep(now = new Date()): Promise<{
  processedUsers: number;
  decayedUsers: number;
  totalPointsDecayed: number;
}> {
  await ensureSeedData();
  const candidates = await db
    .select({ userUid: vipMemberships.userUid })
    .from(vipMemberships)
    .where(
      or(
        eq(vipMemberships.vipStatus, 'active'),
        eq(vipMemberships.vipStatus, 'expired')
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
    totalPointsDecayed,
  };
}

async function getValidEquippedFrameId(
  uid: string,
  equippedFrameId: string | null | undefined,
  executor: any = db
): Promise<string | null> {
  if (!equippedFrameId) return null;
  const now = new Date();
  const [inv] = await executor
    .select({ itemId: userInventory.itemId, expiresAt: userInventory.expiresAt })
    .from(userInventory)
    .where(and(eq(userInventory.userUid, uid), eq(userInventory.itemId, equippedFrameId)));
  if (!inv) return null;
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() <= now.getTime()) {
    return null;
  }
  return inv.itemId;
}

export async function touchUserLastSeen(uid: string): Promise<void> {
  if (!uid) return;
  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.uid, uid))
    .catch(() => {});
}

const USER_VIEW_CACHE_TTL_MS = 2_500;
const VIP_DECAY_CHECK_TTL_MS = 5 * 60 * 1000;
const userViewCache = new Map<string, { value: FullUserView; expiresAt: number }>();
const lastVipDecaySyncAt = new Map<string, number>();

export function invalidateUserViewCache(uid?: string): void {
  if (!uid) {
    userViewCache.clear();
    return;
  }
  userViewCache.delete(uid);
}

export async function getFullUserView(uid: string, opts?: { bypassCache?: boolean }): Promise<FullUserView | null> {
  await ensureNumericPublicIdsMigrated();
  const nowMs = Date.now();
  if (!opts?.bypassCache) {
    const cached = userViewCache.get(uid);
    if (cached && cached.expiresAt > nowMs) {
      return cached.value;
    }
  }

  const [userRow] = await db.select().from(users).where(eq(users.uid, uid));
  if (!userRow) return null;

  const lastDecayAt = lastVipDecaySyncAt.get(uid) ?? 0;
  if (nowMs - lastDecayAt >= VIP_DECAY_CHECK_TTL_MS) {
    lastVipDecaySyncAt.set(uid, nowMs);
    if (lastVipDecaySyncAt.size > 2000) {
      const oldestKey = lastVipDecaySyncAt.keys().next().value;
      if (oldestKey) lastVipDecaySyncAt.delete(oldestKey);
    }
    await syncUserVipAndDecay(uid).catch((err) => {
      console.warn('[VIP] syncUserVipAndDecay skipped:', err instanceof Error ? err.message : err);
    });
  }

  let [
    [profileRow],
    [walletRow],
    [vipRow],
    charmAgg,
    giftAgg,
    decayConfig,
    activeCpRows,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userUid, uid)),
    db.select().from(wallets).where(eq(wallets.userUid, uid)),
    db.select().from(vipMemberships).where(eq(vipMemberships.userUid, uid)),
    db
      .select({ total: sql<number>`COALESCE(SUM(${charmRecords.delta}), 0)` })
      .from(charmRecords)
      .where(eq(charmRecords.userUid, uid)),
    db
      .select({ total: sql<number>`COALESCE(SUM(${giftTransactions.quantity}), 0)` })
      .from(giftTransactions)
      .where(eq(giftTransactions.recipientUid, uid)),
    getVipDecayConfig(),
    db
      .select()
      .from(cpRelationships)
      .where(
        and(
          eq(cpRelationships.status, 'active'),
          or(eq(cpRelationships.userAUid, uid), eq(cpRelationships.userBUid, uid))
        )
      )
      .limit(1),
  ]);

  // Safe non-destructive row auto-heal: create missing satellite rows only without overwriting existing data
  if (!profileRow) {
    const fallbackName = userRow.email
      ? userRow.email.split('@')[0].slice(0, 40)
      : `Player ${userRow.publicId}`;
    await db
      .insert(profiles)
      .values({
        userUid: uid,
        displayName: fallbackName,
        handle: `@${(fallbackName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ogplayer')}.${userRow.publicId}`,
        bio: '',
        gender: 'Male',
        age: 21,
        country: 'India',
        ornament: 'crown',
      })
      .onConflictDoNothing();
    [profileRow] = await db.select().from(profiles).where(eq(profiles.userUid, uid));
  }

  if (!walletRow) {
    await db
      .insert(wallets)
      .values({
        userUid: uid,
        coins: 0,
        totalPurchasedCoins: 0,
        totalSpentCoins: 0,
        totalReceivedCoins: 0,
      })
      .onConflictDoNothing();
    [walletRow] = await db.select().from(wallets).where(eq(wallets.userUid, uid));
  }

  if (!vipRow) {
    await db
      .insert(vipMemberships)
      .values({
        userUid: uid,
        vipLevel: 0,
        vipStatus: 'inactive',
        vipGrowth: 0,
        planLabel: null,
      })
      .onConflictDoNothing();
    [vipRow] = await db.select().from(vipMemberships).where(eq(vipMemberships.userUid, uid));
  }

  const activeBans = await getActiveUserBans(uid).catch(() => []);
  const now = new Date();
  const hasCompleteBan = activeBans.some((b) => b.banType === 'complete');
  const effectiveAccountStatus: 'active' | 'suspended' | 'banned' = hasCompleteBan
    ? 'banned'
    : ((userRow.accountStatus as 'active' | 'suspended' | 'banned') || 'active');

  const vipDetails = computeVipStatusDetails(vipRow, decayConfig, now);
  const vipEarnedLevel =
    Number(vipRow?.vipGrowth ?? 0) > 0
      ? computeVipLevelFromPoints(Number(vipRow?.vipGrowth ?? 0))
      : Number(vipRow?.vipLevel ?? 0);
  const effectiveVipLevel =
    vipDetails.vipStatusRaw === 'active'
      ? Math.max(1, Math.min(MAX_VIP_LEVEL, Number(vipRow?.vipLevel ?? 1)))
      : 0;

  const validFrameId = await getValidEquippedFrameId(uid, profileRow?.equippedFrameId);

  let cpPartner: CpPartnerSummary | null = null;
  const activeRel = activeCpRows[0];
  if (activeRel) {
    const partnerInternalUid = activeRel.userAUid === uid ? activeRel.userBUid : activeRel.userAUid;
    const [[partnerUser], [partnerProf]] = await Promise.all([
      db.select({ publicId: users.publicId }).from(users).where(eq(users.uid, partnerInternalUid)),
      db
        .select({ displayName: profiles.displayName, photoUrl: profiles.photoUrl })
        .from(profiles)
        .where(eq(profiles.userUid, partnerInternalUid)),
    ]);
    if (partnerUser) {
      const days = Math.max(
        1,
        Math.floor((now.getTime() - activeRel.startedAt.getTime()) / 86_400_000) + 1
      );
      cpPartner = {
        partnerUid: partnerUser.publicId,
        partnerName: partnerProf?.displayName || `Player ${partnerUser.publicId}`,
        partnerAvatarId: `user-${partnerUser.publicId}`,
        partnerPhotoUrl: partnerProf?.photoUrl || null,
        ringNumber: Number(activeRel.ringNumber || 1),
        ringName: activeRel.ringName || 'Couple Bond Ring',
        since: `${days} ${days === 1 ? 'day' : 'days'}`,
        cpCharm: Number(activeRel.cpCharm ?? 0),
        cpLevel: computeCpLevelFromCharm(Number(activeRel.cpCharm ?? 0)),
      };
    }
  }

  const activeTagList = await getUserRelationshipTags(uid, { activeOnly: true }).catch(() => []);

  const view: FullUserView = {
    uid: userRow.uid,
    zayroId: userRow.publicId,
    publicId: userRow.publicId,
    email: userRow.email,
    phone: userRow.phone,
    provider: userRow.primaryProvider,
    emailVerified: userRow.emailVerified,
    phoneVerified: userRow.phoneVerified,
    role: (userRow.role as AccountRole) || 'normal_user',
    accountStatus: effectiveAccountStatus,
    banReason: userRow.banReason || activeBans.find((b) => b.banType === 'complete')?.reason || null,
    activeBans,
    referredByUid: userRow.referredByUid || null,
    name: profileRow?.displayName || 'OG Player',
    handle: profileRow?.handle || `@${userRow.publicId.toLowerCase()}`,
    photoUrl: profileRow?.photoUrl || null,
    coverUrl: profileRow?.coverUrl || null,
    bio: profileRow?.bio || '',
    gender: (profileRow?.gender as 'Male' | 'Female' | 'Other') || 'Male',
    age: Number(profileRow?.age ?? 21),
    country: profileRow?.country || 'India',
    ornament: (profileRow?.ornament as FullUserView['ornament']) || 'crown',
    themeMode: profileRow?.themeMode === 'light' ? 'light' : 'dark',
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
    vipStatus: vipDetails.vipStatusRaw === 'active' ? 'Active' : 'Not Active',
    vipStatusRaw: vipDetails.vipStatusRaw,
    vipGrowth: Number(vipRow?.vipGrowth ?? 0),
    vipPlanLabel: vipDetails.vipStatusRaw === 'active' ? vipRow?.planLabel || `VIP ${effectiveVipLevel}` : null,
    vipExpiresAt: vipRow?.expiresAt ? vipRow.expiresAt.toISOString() : null,
    vipGraceEndsAt: vipDetails.graceEndsAt ? vipDetails.graceEndsAt.toISOString() : null,
    vipNextDecayAt: vipDetails.nextDecayAt ? vipDetails.nextDecayAt.toISOString() : null,
    vipInGracePeriod: vipDetails.inGracePeriod,
    vipGraceDays: vipDetails.graceDays,
    vipCustomBenefits: Array.isArray(vipRow?.customBenefits) ? vipRow.customBenefits : [],
    vipBenefits:
      effectiveVipLevel > 0
        ? Array.from(
            new Set([
              ...(VIP_PROGRESSION_SEED.find((r) => r.level === effectiveVipLevel)?.benefits || []),
              ...(Array.isArray(vipRow?.customBenefits) ? vipRow.customBenefits : []),
            ])
          )
        : [],
    cpPartner,
    relationshipTags: activeTagList,
    createdAt: userRow.createdAt.toISOString(),
    lastLoginAt: userRow.lastLoginAt.toISOString(),
    lastSeenAt: (userRow.lastSeenAt || userRow.lastLoginAt).toISOString(),
  };

  if (userViewCache.size > 1500) {
    const oldestKey = userViewCache.keys().next().value;
    if (oldestKey) userViewCache.delete(oldestKey);
  }
  userViewCache.set(uid, { value: view, expiresAt: Date.now() + USER_VIEW_CACHE_TTL_MS });
  return view;
}

export async function findOrCreateVerifiedUser(params: {
  firebaseUid: string;
  provider: 'google' | 'phone' | 'facebook';
  providerId: string;
  email?: string | null;
  emailVerified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  name?: string | null;
  photoUrl?: string | null;
}): Promise<{ user: FullUserView; isNewUser: boolean }> {
  await ensureNumericPublicIdsMigrated();
  try {
    const normalizedEmail = params.email ? params.email.trim().toLowerCase() : null;
    const normalizedPhone = params.phone ? params.phone.trim() : null;
    const isOwnerSuperAdmin = Boolean(
      normalizedEmail && params.emailVerified && SUPER_ADMIN_EMAILS.has(normalizedEmail)
    );

    const { userUid, isNew } = await db.transaction(async (tx) => {
      // 1. Check auth_identities by (provider, providerSubject) first so cross-project logins map cleanly
      const [identityMatch] = await tx
        .select({ userUid: authIdentities.userUid })
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.provider, params.providerId),
            eq(authIdentities.providerSubject, params.firebaseUid)
          )
        );

      let existing: typeof users.$inferSelect | undefined;
      if (identityMatch) {
        [existing] = await tx.select().from(users).where(eq(users.uid, identityMatch.userUid));
      }

      // 2. Check by Firebase UID
      if (!existing) {
        [existing] = await tx.select().from(users).where(eq(users.uid, params.firebaseUid));
      }

      // 3. Fallback check by verified email or verified phone (never duplicate profiles across Firebase projects)
      if (!existing && normalizedEmail && params.emailVerified) {
        [existing] = await tx.select().from(users).where(eq(users.email, normalizedEmail));
      }
      if (!existing && normalizedPhone && params.phoneVerified) {
        [existing] = await tx.select().from(users).where(eq(users.phone, normalizedPhone));
      }

      if (existing) {
        const nextRole = isOwnerSuperAdmin ? 'super_admin' : existing.role;
        const now = new Date();
        await tx
          .update(users)
          .set({
            email: existing.email || normalizedEmail,
            phone: existing.phone || normalizedPhone,
            emailVerified: existing.emailVerified || Boolean(params.emailVerified),
            phoneVerified: existing.phoneVerified || Boolean(params.phoneVerified),
            role: nextRole,
            lastLoginAt: now,
            lastSeenAt: now,
            updatedAt: now,
          })
          .where(eq(users.uid, existing.uid));

        await tx
          .insert(authIdentities)
          .values({
            userUid: existing.uid,
            provider: params.providerId,
            providerSubject: params.firebaseUid,
            email: normalizedEmail,
            phone: normalizedPhone,
            verified: Boolean(params.emailVerified || params.phoneVerified),
          })
          .onConflictDoUpdate({
            target: [authIdentities.provider, authIdentities.providerSubject],
            set: {
              email: normalizedEmail,
              phone: normalizedPhone,
              verified: Boolean(params.emailVerified || params.phoneVerified),
              lastUsedAt: new Date(),
            },
          });

        if (isOwnerSuperAdmin) {
          await tx
            .insert(adminUsers)
            .values({
              userUid: existing.uid,
              role: 'super_admin',
              assignedByUid: existing.uid,
              active: true,
            })
            .onConflictDoUpdate({
              target: adminUsers.userUid,
              set: { role: 'super_admin', active: true, updatedAt: new Date() },
            });
        }

        // Preserve profile photo if previously unset
        if (params.photoUrl) {
          await tx
            .update(profiles)
            .set({ photoUrl: sql`COALESCE(${profiles.photoUrl}, ${params.photoUrl})` })
            .where(eq(profiles.userUid, existing.uid));
        }

        return { userUid: existing.uid, isNew: false };
      }

      // 3. Create genuinely new user with strict starting defaults:
      // Coins: 0, Charm: 0, VIP: 0, VIP Status: inactive, Role: normal_user (unless owner Super Admin email)
      const publicId = await reserveUniquePublicId(tx, params.firebaseUid);
      const fallbackName = normalizedEmail
        ? normalizedEmail.split('@')[0]
        : normalizedPhone
          ? `Player ${normalizedPhone.slice(-4)}`
          : `Player ${publicId}`;
      const displayName = (params.name || '').trim().slice(0, 40) || fallbackName;
      const handleBase = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ogplayer';
      const handle = `@${handleBase}.${publicId}`;
      const startingRole: AccountRole = isOwnerSuperAdmin ? 'super_admin' : 'normal_user';

      await tx.insert(users).values({
        uid: params.firebaseUid,
        publicId,
        email: normalizedEmail,
        phone: normalizedPhone,
        primaryProvider: params.provider,
        emailVerified: Boolean(params.emailVerified),
        phoneVerified: Boolean(params.phoneVerified),
        role: startingRole,
        accountStatus: 'active',
      });

      await tx.insert(authIdentities).values({
        userUid: params.firebaseUid,
        provider: params.providerId,
        providerSubject: params.firebaseUid,
        email: normalizedEmail,
        phone: normalizedPhone,
        verified: Boolean(params.emailVerified || params.phoneVerified),
      });

      await tx.insert(profiles).values({
        userUid: params.firebaseUid,
        displayName,
        handle,
        photoUrl: params.photoUrl || null,
        bio: '',
        gender: 'Male',
        age: 21,
        country: 'India',
        ornament: 'crown',
      });

      await tx.insert(wallets).values({
        userUid: params.firebaseUid,
        coins: 0,
        totalPurchasedCoins: 0,
        totalSpentCoins: 0,
        totalReceivedCoins: 0,
      });

      await tx.insert(vipMemberships).values({
        userUid: params.firebaseUid,
        vipLevel: 0,
        vipStatus: 'inactive',
        vipGrowth: 0,
        planLabel: null,
      });

      if (isOwnerSuperAdmin) {
        await tx.insert(adminUsers).values({
          userUid: params.firebaseUid,
          role: 'super_admin',
          assignedByUid: params.firebaseUid,
          active: true,
        });
      }

      return { userUid: params.firebaseUid, isNew: true };
    });

    if (isOwnerSuperAdmin) {
      await ensureVoiceRoomsHaveOwners();
    }

    const fullUser = await getFullUserView(userUid);
    if (!fullUser) throw new Error('Failed to load created user.');
    return { user: fullUser, isNewUser: isNew };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown database error';
    console.error('[DB] findOrCreateVerifiedUser failed:', detail);
    throw new Error(`Failed to register or load verified user account: ${detail}`, { cause: err });
  }
}

export async function createDbSession(params: {
  userUid: string;
  identifier: string;
  provider: string;
  ttlMs: number;
}) {
  const sid = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const expiresAt = now + params.ttlMs;
  await db.insert(userSessions).values({
    sid,
    userUid: params.userUid,
    identifier: params.identifier,
    provider: params.provider,
    createdAt: now,
    expiresAt,
  });
  return { sid, userUid: params.userUid, identifier: params.identifier, provider: params.provider, createdAt: now, expiresAt };
}

export async function getDbSession(sid: string) {
  const [row] = await db.select().from(userSessions).where(eq(userSessions.sid, sid));
  return row || null;
}

export async function deleteDbSession(sid: string) {
  await db.delete(userSessions).where(eq(userSessions.sid, sid));
}

export function isSafeMediaReference(raw: unknown, allowVideo = false): boolean {
  if (typeof raw !== 'string') return false;
  const val = raw.trim();
  if (!val) return false;
  if (/^\/api\/media\/[A-Za-z0-9_-]{8,64}$/.test(val)) return true;
  if (/^https:\/\/[^\s<>"{}|\\^`[\]]{4,2048}$/i.test(val)) return true;
  if (allowVideo && /^data:video\/(mp4|webm|quicktime|ogg);base64,/i.test(val)) return true;
  return /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(val);
}

export async function updateSafeProfile(
  uid: string,
  updates: {
    name?: string;
    bio?: string;
    gender?: 'Male' | 'Female' | 'Other';
    age?: number;
    country?: string;
    ornament?: FullUserView['ornament'];
    themeMode?: 'dark' | 'light';
    equippedEmoteId?: string | null;
    handle?: string;
    photoUrl?: string | null;
    coverUrl?: string | null;
    tags?: string[];
  }
): Promise<FullUserView> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof updates.name === 'string' && updates.name.trim()) {
    patch.displayName = updates.name.trim().slice(0, 40);
  }
  if (typeof updates.bio === 'string') {
    patch.bio = updates.bio.trim().slice(0, 160);
  }
  if (updates.gender) patch.gender = updates.gender;
  if (typeof updates.age === 'number' && updates.age >= 13 && updates.age <= 120) {
    patch.age = Math.floor(updates.age);
  }
  if (typeof updates.country === 'string' && updates.country.trim()) {
    patch.country = updates.country.trim().slice(0, 40);
  }
  if (updates.ornament) patch.ornament = updates.ornament;
  if (updates.themeMode === 'dark' || updates.themeMode === 'light') {
    patch.themeMode = updates.themeMode;
  }
  if (updates.equippedEmoteId !== undefined) {
    patch.equippedEmoteId = updates.equippedEmoteId ? String(updates.equippedEmoteId).trim().slice(0, 40) : null;
  }
  if (typeof updates.handle === 'string' && updates.handle.trim()) {
    const cleaned = updates.handle.trim().replace(/^@+/, '').slice(0, 30);
    if (cleaned) patch.handle = `@${cleaned}`;
  }
  if (updates.photoUrl !== undefined) {
    const trimmed = typeof updates.photoUrl === 'string' ? updates.photoUrl.trim() : '';
    if (!trimmed) {
      patch.photoUrl = null;
    } else if (isSafeMediaReference(trimmed) && trimmed.length <= 2_500_000) {
      patch.photoUrl = trimmed;
    }
  }
  if (updates.coverUrl !== undefined) {
    const trimmed = typeof updates.coverUrl === 'string' ? updates.coverUrl.trim() : '';
    if (!trimmed) {
      patch.coverUrl = null;
    } else if (isSafeMediaReference(trimmed) && trimmed.length <= 3_500_000) {
      patch.coverUrl = trimmed;
    }
  }
  if (Array.isArray(updates.tags)) {
    patch.tags = updates.tags.slice(0, 6).map((t) => String(t).slice(0, 24));
  }

  await db.update(profiles).set(patch).where(eq(profiles.userUid, uid));
  invalidateUserViewCache(uid);
  const full = await getFullUserView(uid, { bypassCache: true });
  if (!full) throw new Error('User not found.');
  return full;
}

export interface DynamicUpiConfig {
  accountName: string;
  upiId: string;
  provider: string;
  customQrDataUrl: string | null;
  note: string;
  active: boolean;
  screens: string[];
  currentVersionId: number | null;
  updatedAt: string;
}

export async function getPermanentUpiConfig(): Promise<DynamicUpiConfig> {
  await ensureSeedData();
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'upi_payment_config'));
  const val = (row?.value as Record<string, unknown>) || PERMANENT_UPI_CONFIG;
  const screensRaw = Array.isArray(val.screens)
    ? val.screens.map((s) => String(s).trim()).filter(Boolean)
    : ['coins', 'vip'];
  return {
    accountName: String(val.accountName || PERMANENT_UPI_CONFIG.accountName),
    upiId: String(val.upiId || PERMANENT_UPI_CONFIG.upiId),
    provider: String(val.provider || PERMANENT_UPI_CONFIG.provider),
    customQrDataUrl: typeof val.customQrDataUrl === 'string' && val.customQrDataUrl ? val.customQrDataUrl : null,
    note: String(val.note || PERMANENT_UPI_CONFIG.note),
    active: val.active !== false,
    screens: screensRaw.length > 0 ? screensRaw : ['coins', 'vip'],
    currentVersionId: val.currentVersionId ? Number(val.currentVersionId) : null,
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function updatePermanentUpiConfig(
  actorUid: string,
  updates: {
    accountName?: string;
    upiId?: string;
    provider?: string;
    customQrDataUrl?: string | null;
    note?: string;
    active?: boolean;
    screens?: string[];
    actorRole?: AccountRole;
    changeSummary?: string;
  }
) {
  const current = await getPermanentUpiConfig();

  if (typeof updates.customQrDataUrl === 'string' && updates.customQrDataUrl.trim()) {
    const val = updates.customQrDataUrl.trim();
    if (!isSafeMediaReference(val)) {
      throw new Error('Uploaded QR image must be a valid PNG, JPEG, WEBP, SVG, or uploaded media URL.');
    }
    if (val.length > 4_800_000) {
      throw new Error('Uploaded QR image must be under 3.5 MB encoded.');
    }
  }

  const nextAccountName = updates.accountName?.trim() || current.accountName;
  const nextUpiId = updates.upiId?.trim() || current.upiId;
  const nextProvider = updates.provider?.trim() || current.provider;
  const nextCustomQr =
    updates.customQrDataUrl !== undefined ? updates.customQrDataUrl : current.customQrDataUrl;
  const nextNote = updates.note?.trim() || current.note;
  const nextActive = typeof updates.active === 'boolean' ? updates.active : current.active;
  const nextScreens =
    Array.isArray(updates.screens) && updates.screens.length > 0
      ? Array.from(new Set(updates.screens.map((s) => String(s).trim().toLowerCase()).filter(Boolean)))
      : current.screens;

  const upiUri = `upi://pay?pa=${encodeURIComponent(nextUpiId)}&pn=${encodeURIComponent(nextAccountName)}&cu=INR`;
  const qrPreviewDataUrl =
    nextCustomQr || (await QRCode.toDataURL(upiUri, { width: 320, margin: 1 }));

  return db.transaction(async (tx) => {
    const [actorProfile] = await tx
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userUid, actorUid));
    const [latestVer] = await tx
      .select({ versionNumber: paymentQrVersions.versionNumber })
      .from(paymentQrVersions)
      .orderBy(desc(paymentQrVersions.versionNumber))
      .limit(1);
    const nextVersionNumber = Number(latestVer?.versionNumber ?? 0) + 1;

    const changes: string[] = [];
    if (nextAccountName !== current.accountName) changes.push(`Account Name -> ${nextAccountName}`);
    if (nextUpiId !== current.upiId) changes.push(`UPI ID -> ${nextUpiId}`);
    if (nextProvider !== current.provider) changes.push(`Provider -> ${nextProvider}`);
    if (nextCustomQr !== current.customQrDataUrl) {
      changes.push(nextCustomQr ? 'Uploaded new QR image' : 'Reverted to auto-generated QR');
    }
    if (nextActive !== current.active) changes.push(nextActive ? 'Activated payment method' : 'Deactivated payment method');
    if (nextScreens.join(',') !== current.screens.join(',')) changes.push(`Screens -> ${nextScreens.join(', ')}`);

    const [createdVersion] = await tx
      .insert(paymentQrVersions)
      .values({
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
        updatedByName: actorProfile?.displayName || 'Super Admin',
        changeSummary:
          updates.changeSummary?.trim() ||
          (changes.length > 0 ? changes.join(' · ') : 'Republished active QR configuration'),
      })
      .returning();

    const nextConfig = {
      accountName: nextAccountName,
      upiId: nextUpiId,
      provider: nextProvider,
      customQrDataUrl: nextCustomQr,
      note: nextNote,
      active: nextActive,
      screens: nextScreens,
      currentVersionId: createdVersion.id,
      updatedAt: createdVersion.createdAt.toISOString(),
    };

    await tx
      .insert(platformSettings)
      .values({
        key: 'upi_payment_config',
        value: nextConfig,
        updatedByUid: actorUid,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: nextConfig, updatedByUid: actorUid, updatedAt: new Date() },
      });

    await tx.insert(auditLogs).values({
      actorUid,
      actorRole: updates.actorRole || 'super_admin',
      action: 'update_permanent_upi_qr',
      targetType: 'payment_qr_version',
      targetId: String(createdVersion.id),
      details: {
        versionNumber: nextVersionNumber,
        accountName: nextAccountName,
        upiId: nextUpiId,
        provider: nextProvider,
        active: nextActive,
        screens: nextScreens,
        hasCustomQr: Boolean(nextCustomQr),
      },
    });

    return {
      ...nextConfig,
      qrDataUrl: qrPreviewDataUrl,
      upiUri,
      versionNumber: createdVersion.versionNumber,
    };
  });
}

export async function getPaymentQrVersions(limit = 50) {
  await ensureSeedData();
  const rows = await db
    .select()
    .from(paymentQrVersions)
    .orderBy(desc(paymentQrVersions.versionNumber), desc(paymentQrVersions.createdAt))
    .limit(limit);
  const uidMap = await mapUidsToPublicIds(rows.map((r) => r.updatedByUid || '').filter(Boolean));
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
        updatedByPublicId: r.updatedByUid ? uidMap[r.updatedByUid] || r.updatedByUid : 'system',
        createdAt: r.createdAt.toISOString(),
      };
    })
  );
}

export async function getPaymentQrVersionById(versionId: number) {
  const [row] = await db
    .select()
    .from(paymentQrVersions)
    .where(eq(paymentQrVersions.id, versionId));
  return row || null;
}

// =========================================================================
// PERMANENT UPI QR PAYMENT ORDERS (Order-first QR Reveal + Snapshotting)
// =========================================================================
export async function createPaymentOrder(params: {
  userUid: string;
  orderType: 'vip' | 'coins';
  packageId: string;
  screen?: string;
}) {
  await ensureSeedData();
  const upiConfig = await getPermanentUpiConfig();
  if (!upiConfig.active) {
    throw new Error('UPI payments are currently paused by the administrator. Please check back soon.');
  }
  const requiredScreen = (params.screen || params.orderType).toLowerCase();
  if (upiConfig.screens.length > 0 && !upiConfig.screens.includes(requiredScreen)) {
    throw new Error(`UPI payments are currently disabled for ${requiredScreen} purchases.`);
  }

  let packageName = '';
  let amountInr = 0;
  let coinsAmount = 0;
  let grantedVipLevel = 0;
  let vipDurationDays = 0;
  let bonusGrowth = 0;

  if (params.orderType === 'vip') {
    const [pkg] = await db
      .select()
      .from(vipPackages)
      .where(and(eq(vipPackages.id, params.packageId), eq(vipPackages.active, true)));
    if (!pkg) throw new Error('VIP package not found or inactive.');
    packageName = pkg.name;
    amountInr = pkg.priceInr;
    grantedVipLevel = 1; // Always starts at VIP 1
    vipDurationDays = pkg.durationDays;
    bonusGrowth = 0;
  } else {
    const [pkg] = await db
      .select()
      .from(coinPackages)
      .where(and(eq(coinPackages.id, params.packageId), eq(coinPackages.active, true)));
    if (!pkg) throw new Error('Coin package not found or inactive.');
    packageName = pkg.label;
    amountInr = pkg.priceInr;
    coinsAmount = Number(pkg.coins) + Number(pkg.bonusCoins ?? 0);
  }

  const now = new Date();
  const [pendingProof] = await db
    .select()
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.userUid, params.userUid),
        eq(paymentOrders.orderType, params.orderType),
        eq(paymentOrders.packageId, params.packageId),
        eq(paymentOrders.status, 'pending_review')
      )
    )
    .orderBy(desc(paymentOrders.createdAt))
    .limit(1);

  if (pendingProof) {
    throw new Error(
      `You already have a payment order (${pendingProof.orderId}) pending Admin verification for ${packageName}.`
    );
  }

  const [existingUnexpired] = await db
    .select()
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.userUid, params.userUid),
        eq(paymentOrders.orderType, params.orderType),
        eq(paymentOrders.packageId, params.packageId),
        eq(paymentOrders.status, 'awaiting_payment'),
        gt(paymentOrders.expiresAt, now)
      )
    )
    .orderBy(desc(paymentOrders.createdAt))
    .limit(1);

  if (existingUnexpired) {
    const snapUpiId = existingUnexpired.upiIdUsed || upiConfig.upiId;
    const snapAccountName = existingUnexpired.accountNameUsed || upiConfig.accountName;
    const snapProvider = existingUnexpired.providerUsed || upiConfig.provider;
    const snapUpiUri = `upi://pay?pa=${encodeURIComponent(snapUpiId)}&pn=${encodeURIComponent(snapAccountName)}&am=${existingUnexpired.amountInr}&tn=${encodeURIComponent(existingUnexpired.orderId)}&cu=INR`;
    const snapQr =
      existingUnexpired.qrDataUrlSnapshot ||
      (await QRCode.toDataURL(snapUpiUri, { width: 320, margin: 1 }));
    return {
      order: existingUnexpired,
      upiConfig: {
        ...upiConfig,
        upiId: snapUpiId,
        accountName: snapAccountName,
        provider: snapProvider,
        upiUri: snapUpiUri,
        qrDataUrl: snapQr,
      },
      reused: true,
    };
  }

  const orderId = `ORD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiConfig.upiId)}&pn=${encodeURIComponent(upiConfig.accountName)}&am=${amountInr}&tn=${encodeURIComponent(orderId)}&cu=INR`;
  const qrDataUrl =
    upiConfig.customQrDataUrl || (await QRCode.toDataURL(upiUri, { width: 320, margin: 1 }));

  const [created] = await db
    .insert(paymentOrders)
    .values({
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
      status: 'awaiting_payment',
    })
    .returning();

  return {
    order: created,
    upiConfig: {
      ...upiConfig,
      upiUri,
      qrDataUrl,
    },
    reused: false,
  };
}

export async function submitPaymentProof(params: {
  userUid: string;
  orderId: string;
  utrNumber: string;
  accountHolderName: string;
  paymentDateTime?: string;
  screenshotDataUrl?: string;
  payerNote?: string;
}) {
  const cleanUtr = params.utrNumber.trim().toUpperCase();
  if (!/^[A-Z0-9]{8,35}$/.test(cleanUtr)) {
    throw new Error('UTR / Transaction Reference must be 8–35 alphanumeric characters.');
  }
  const cleanHolder = String(params.accountHolderName || '').trim().slice(0, 80);
  if (cleanHolder.length < 2) {
    throw new Error('Bank Account Holder / Sender Name is required.');
  }
  const cleanDateTime = String(params.paymentDateTime || '').trim().slice(0, 80) || new Date().toISOString();

  if (params.screenshotDataUrl) {
    if (!isSafeMediaReference(params.screenshotDataUrl) || params.screenshotDataUrl.length > 4_800_000) {
      throw new Error('Payment screenshot must be a valid PNG/JPEG/WEBP image or uploaded media URL.');
    }
  }

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderId, params.orderId))
      .for('update');

    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.userUid !== params.userUid) throw new Error('ORDER_OWNERSHIP_MISMATCH');
    if (order.status === 'approved') throw new Error('ORDER_ALREADY_APPROVED');
    if (order.status === 'cancelled' || order.status === 'expired') throw new Error('ORDER_CANCELLED');
    if (order.status === 'awaiting_payment' && order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
      await tx
        .update(paymentOrders)
        .set({ status: 'expired' })
        .where(eq(paymentOrders.orderId, params.orderId));
      throw new Error('ORDER_EXPIRED');
    }

    // Prevent duplicate UTR across ALL orders
    const duplicateUtr = await tx
      .select({ orderId: paymentOrders.orderId })
      .from(paymentOrders)
      .where(and(eq(paymentOrders.utrNumber, cleanUtr), ne(paymentOrders.orderId, params.orderId)));
    if (duplicateUtr.length > 0) {
      throw new Error('DUPLICATE_UTR');
    }

    const [updated] = await tx
      .update(paymentOrders)
      .set({
        utrNumber: cleanUtr,
        accountHolderName: cleanHolder,
        paymentDateTime: cleanDateTime,
        screenshotDataUrl: params.screenshotDataUrl || order.screenshotDataUrl,
        payerNote: params.payerNote?.trim().slice(0, 200) || null,
        status: 'pending_review',
        submittedAt: new Date(),
      })
      .where(eq(paymentOrders.orderId, params.orderId))
      .returning();

    await tx.insert(notifications).values({
      userUid: params.userUid,
      type: 'payment',
      title: 'Payment Proof Submitted',
      body: `Order ${order.orderId} (UTR ${cleanUtr} · Sender: ${cleanHolder}) is pending Admin review. VIP & Coins activate only upon Admin approval.`,
      metadata: { orderId: order.orderId, utr: cleanUtr, accountHolderName: cleanHolder },
    });

    // IMPORTANT: Never activate VIP or credit coins here! Only Admin approval activates VIP/Coins.
    return updated;
  });
}

export async function approvePaymentOrder(params: {
  adminUid: string;
  adminRole: AccountRole;
  orderId: string;
  reviewNote?: string;
}) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderId, params.orderId))
      .for('update');
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status === 'approved') throw new Error('ORDER_ALREADY_APPROVED');
    if (order.status === 'rejected' || order.status === 'cancelled' || order.status === 'expired') {
      throw new Error('ORDER_NOT_REVIEWABLE');
    }
    if (order.status === 'awaiting_payment' && order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
      throw new Error('ORDER_EXPIRED');
    }
    if (!order.utrNumber) {
      throw new Error('UTR_REQUIRED_BEFORE_APPROVAL');
    }

    const [approvedOrder] = await tx
      .update(paymentOrders)
      .set({
        status: 'approved',
        reviewedByUid: params.adminUid,
        reviewNote: params.reviewNote?.trim() || 'Verified & Approved',
        reviewedAt: new Date(),
      })
      .where(eq(paymentOrders.orderId, params.orderId))
      .returning();

    if (order.orderType === 'coins') {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userUid, order.userUid))
        .for('update');
      const nextCoins = Number(wallet?.coins ?? 0) + Number(order.coinsAmount);
      await tx
        .update(wallets)
        .set({
          coins: nextCoins,
          totalPurchasedCoins: Number(wallet?.totalPurchasedCoins ?? 0) + Number(order.coinsAmount),
          updatedAt: new Date(),
        })
        .where(eq(wallets.userUid, order.userUid));

      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        userUid: order.userUid,
        type: 'topup_credit',
        amount: Number(order.coinsAmount),
        balanceAfter: nextCoins,
        referenceType: 'payment_order',
        referenceId: order.orderId,
        idempotencyKey: `order-approve-${order.orderId}`,
        description: `Approved INR ₹${order.amountInr} (${order.packageName}) · UTR ${order.utrNumber}`,
        actorUid: params.adminUid,
      });

      await tx.insert(notifications).values({
        userUid: order.userUid,
        type: 'payment',
        title: 'Coins Credited!',
        body: `Your order ${order.orderId} was approved! +${Number(order.coinsAmount).toLocaleString()} coins credited to your wallet.`,
        metadata: { orderId: order.orderId, coins: Number(order.coinsAmount) },
      });
    } else {
      // Every subscription purchase starts at VIP 1 (never grants bonus points or jumps levels)
      const now = new Date();
      await syncUserVipAndDecay(order.userUid, now, tx);
      const decayConfig = await getVipDecayConfig(tx);

      const [vip] = await tx
        .select()
        .from(vipMemberships)
        .where(eq(vipMemberships.userUid, order.userUid))
        .for('update');
      const existingGrowth = Math.max(0, Number(vip?.vipGrowth ?? 0));
      const levelFromGrowth = computeVipLevelFromPoints(existingGrowth);
      const nextVipLevel = Math.min(MAX_VIP_LEVEL, Math.max(1, levelFromGrowth));
      const previousExpiresAt = vip?.expiresAt ? new Date(vip.expiresAt) : null;
      const isRenewal = Boolean(vip?.activatedAt);
      const baseExpiry =
        vip?.vipStatus === 'active' && vip.expiresAt && vip.expiresAt.getTime() > now.getTime()
          ? vip.expiresAt.getTime()
          : now.getTime();
      const durationDays = Math.max(1, Number(order.vipDurationDays || 30));
      const expiresAt = new Date(baseExpiry + durationDays * 86_400_000);

      await tx
        .update(vipMemberships)
        .set({
          vipLevel: nextVipLevel,
          vipStatus: 'active',
          vipGrowth: existingGrowth,
          activatedByOrderId: order.orderId,
          planLabel: `VIP ${nextVipLevel}`,
          activatedAt: vip?.activatedAt || now,
          expiresAt,
          lastDecayAt: now,
          lastDecayDateKey: null,
          graceDaysApplied: decayConfig.graceDays,
          updatedAt: now,
        })
        .where(eq(vipMemberships.userUid, order.userUid));

      await tx.insert(vipSubscriptionHistory).values({
        userUid: order.userUid,
        action: isRenewal ? 'renew' : 'activate',
        source: 'payment_order',
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
        reason: params.reviewNote?.trim() || `Verified UPI Order ${order.orderId}`,
      });

      await tx.insert(notifications).values({
        userUid: order.userUid,
        type: 'vip',
        title: isRenewal ? `VIP ${nextVipLevel} Renewed!` : `VIP ${nextVipLevel} Activated!`,
        body: `Your VIP payment (${order.packageName}, UTR ${order.utrNumber}) was approved! Valid until ${expiresAt.toLocaleDateString()}.`,
        metadata: { orderId: order.orderId, vipLevel: nextVipLevel, expiresAt: expiresAt.toISOString() },
      });
    }

    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: 'approve_payment_order',
      targetType: 'payment_order',
      targetId: order.orderId,
      details: {
        targetUserUid: order.userUid,
        orderType: order.orderType,
        amountInr: order.amountInr,
        utr: order.utrNumber,
        reviewNote: params.reviewNote || null,
      },
    });

    return approvedOrder;
  });
}

export async function rejectPaymentOrder(params: {
  adminUid: string;
  adminRole: AccountRole;
  orderId: string;
  reviewNote: string;
}) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderId, params.orderId))
      .for('update');
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status === 'approved') throw new Error('ORDER_ALREADY_APPROVED');

    const [rejected] = await tx
      .update(paymentOrders)
      .set({
        status: 'rejected',
        reviewedByUid: params.adminUid,
        reviewNote: params.reviewNote.trim() || 'Rejected by Admin',
        reviewedAt: new Date(),
      })
      .where(eq(paymentOrders.orderId, params.orderId))
      .returning();

    await tx.insert(notifications).values({
      userUid: order.userUid,
      type: 'payment',
      title: 'Payment Proof Rejected',
      body: `Order ${order.orderId} was rejected: ${rejected.reviewNote}`,
      metadata: { orderId: order.orderId },
    });

    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: 'reject_payment_order',
      targetType: 'payment_order',
      targetId: order.orderId,
      details: { targetUserUid: order.userUid, reason: rejected.reviewNote, utr: order.utrNumber },
    });

    return rejected;
  });
}

export async function adminGrantVipSubscription(params: {
  adminUid: string;
  adminRole: AccountRole;
  targetUserUid: string;
  months: number;
  reason: string;
}) {
  const months = Math.floor(Number(params.months));
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error('Subscription duration must be between 1 and 120 months.');
  }
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 3) {
    throw new Error('A mandatory reason (minimum 3 characters) is required to grant or renew VIP.');
  }
  const durationDays = months * 30;
  const now = new Date();

  await db.transaction(async (tx) => {
    const [targetUser] = await tx.select({ uid: users.uid }).from(users).where(eq(users.uid, params.targetUserUid));
    if (!targetUser) throw new Error('Target user not found.');

    await syncUserVipAndDecay(params.targetUserUid, now, tx);
    const decayConfig = await getVipDecayConfig(tx);

    const [vip] = await tx
      .select()
      .from(vipMemberships)
      .where(eq(vipMemberships.userUid, params.targetUserUid))
      .for('update');

    const existingGrowth = Math.max(0, Number(vip?.vipGrowth ?? 0));
    const resultingVipLevel = Math.min(MAX_VIP_LEVEL, Math.max(1, computeVipLevelFromPoints(existingGrowth)));
    const previousExpiresAt = vip?.expiresAt ? new Date(vip.expiresAt) : null;
    const baseExpiryMs =
      vip?.vipStatus === 'active' && vip.expiresAt && vip.expiresAt.getTime() > now.getTime()
        ? vip.expiresAt.getTime()
        : now.getTime();
    const expiresAt = new Date(baseExpiryMs + durationDays * 86_400_000);

    await tx
      .update(vipMemberships)
      .set({
        vipLevel: resultingVipLevel,
        vipStatus: 'active',
        vipGrowth: existingGrowth,
        activatedByAdminUid: params.adminUid,
        planLabel: `VIP ${resultingVipLevel}`,
        activatedAt: vip?.activatedAt || now,
        expiresAt,
        lastDecayAt: now,
        lastDecayDateKey: null,
        graceDaysApplied: decayConfig.graceDays,
        updatedAt: now,
      })
      .where(eq(vipMemberships.userUid, params.targetUserUid));

    const pkgLabel = `${months} ${months === 1 ? 'Month' : 'Months'} Admin Grant`;
    await tx.insert(vipSubscriptionHistory).values({
      userUid: params.targetUserUid,
      action: 'admin_grant',
      source: 'admin_grant',
      packageName: pkgLabel,
      months,
      durationDays,
      startingVipLevel: 1,
      resultingVipLevel,
      previousExpiresAt,
      newExpiresAt: expiresAt,
      actorUid: params.adminUid,
      reason: cleanReason,
    });

    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: 'admin_grant_vip_subscription',
      targetType: 'user',
      targetId: params.targetUserUid,
      details: {
        months,
        durationDays,
        startingVipLevel: 1,
        resultingVipLevel,
        expiresAt: expiresAt.toISOString(),
        reason: cleanReason,
      },
    });

    await tx.insert(notifications).values({
      userUid: params.targetUserUid,
      type: 'vip',
      title: `VIP ${resultingVipLevel} Subscription Active`,
      body: `Admin granted ${months} ${months === 1 ? 'month' : 'months'} of VIP validity (valid until ${expiresAt.toLocaleDateString()}): ${cleanReason}`,
      metadata: { months, durationDays, vipLevel: resultingVipLevel, expiresAt: expiresAt.toISOString() },
    });
  });

  return getFullUserView(params.targetUserUid);
}

export async function superAdminSetVip(params: {
  superAdminUid: string;
  actorRole?: AccountRole;
  targetUserUid: string;
  vipStatus: 'active' | 'inactive';
  durationDays?: number;
  customBenefits?: string[];
  reason: string;
}) {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 3) {
    throw new Error('Mandatory reason (minimum 3 characters) is required for VIP assignment.');
  }
  const actorRole: AccountRole = params.actorRole || 'super_admin';
  const actorLabel = actorRole === 'super_admin' ? 'Super Admin' : 'Admin';
  const now = new Date();
  const durationDays = Math.max(1, Math.floor(params.durationDays ?? 30));
  const expiresAt =
    params.vipStatus === 'active'
      ? new Date(now.getTime() + durationDays * 86_400_000)
      : null;
  const cleanBenefits =
    params.vipStatus === 'active' && Array.isArray(params.customBenefits)
      ? Array.from(new Set(params.customBenefits.map((b) => String(b || '').trim().slice(0, 80)).filter(Boolean))).slice(0, 12)
      : [];

  await db.transaction(async (tx) => {
    await syncUserVipAndDecay(params.targetUserUid, now, tx);
    const [prevVip] = await tx
      .select()
      .from(vipMemberships)
      .where(eq(vipMemberships.userUid, params.targetUserUid))
      .for('update');
    const prevGrowth = Math.max(0, Number(prevVip?.vipGrowth ?? 0));
    const safeLevel =
      params.vipStatus === 'active'
        ? Math.min(MAX_VIP_LEVEL, Math.max(1, computeVipLevelFromPoints(prevGrowth)))
        : 0;
    const previousExpiresAt = prevVip?.expiresAt ? new Date(prevVip.expiresAt) : null;

    await tx
      .update(vipMemberships)
      .set({
        vipLevel: safeLevel,
        vipStatus: params.vipStatus,
        vipGrowth: prevGrowth,
        activatedByAdminUid: params.superAdminUid,
        planLabel: params.vipStatus === 'active' ? `VIP ${safeLevel} (${actorLabel})` : null,
        activatedAt: params.vipStatus === 'active' ? (prevVip?.activatedAt || now) : null,
        expiresAt,
        customBenefits: cleanBenefits,
        lastDecayAt: params.vipStatus === 'active' ? now : prevVip?.lastDecayAt || null,
        lastDecayDateKey: params.vipStatus === 'active' ? null : prevVip?.lastDecayDateKey || null,
        updatedAt: now,
      })
      .where(eq(vipMemberships.userUid, params.targetUserUid));

    await tx.insert(vipSubscriptionHistory).values({
      userUid: params.targetUserUid,
      action: params.vipStatus === 'active' ? 'admin_vip_assign' : 'admin_vip_remove',
      source: 'super_admin_override',
      packageName:
        params.vipStatus === 'active'
          ? `${actorLabel} VIP ${safeLevel} Activation (${durationDays}d)`
          : `${actorLabel} VIP Removed (Inactive)`,
      months: Math.max(0, Math.round(durationDays / 30)),
      durationDays: params.vipStatus === 'active' ? durationDays : 0,
      startingVipLevel: safeLevel,
      resultingVipLevel: safeLevel,
      previousExpiresAt,
      newExpiresAt: expiresAt,
      actorUid: params.superAdminUid,
      reason: cleanReason,
    });

    await tx.insert(auditLogs).values({
      actorUid: params.superAdminUid,
      actorRole,
      action: params.vipStatus === 'active' ? 'admin_assign_vip' : 'admin_remove_vip',
      targetType: 'user',
      targetId: params.targetUserUid,
      details: {
        vipStatus: params.vipStatus,
        vipLevel: safeLevel,
        durationDays,
        customBenefits: cleanBenefits,
        reason: cleanReason,
      },
    });

    await tx.insert(notifications).values({
      userUid: params.targetUserUid,
      type: 'vip',
      title: params.vipStatus === 'active' ? `VIP ${safeLevel} Activated` : 'VIP Membership Removed',
      body:
        params.vipStatus === 'active'
          ? `${actorLabel} activated your VIP ${safeLevel} (${durationDays} days): ${cleanReason}`
          : `Your VIP membership was removed by ${actorLabel}: ${cleanReason}`,
    });
  });

  return getFullUserView(params.targetUserUid);
}

// =========================================================================
// ATOMIC WALLET OPERATIONS (Admin credit/deduct, Transfers, Refunds)
// =========================================================================
export async function adminAdjustCoinsBatch(params: {
  adminUid: string;
  adminRole: AccountRole;
  targetUids: string[];
  deltaCoins: number;
  reason: string;
}) {
  if (!Number.isInteger(params.deltaCoins) || params.deltaCoins === 0) {
    throw new Error('deltaCoins must be a non-zero integer.');
  }

  return db.transaction(async (tx) => {
    const results: Array<{ uid: string; coins: number }> = [];
    for (const targetUid of params.targetUids) {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userUid, targetUid))
        .for('update');
      if (!wallet) throw new Error(`Wallet not found for ${targetUid}`);

      const currentCoins = Number(wallet.coins);
      const nextCoins = currentCoins + params.deltaCoins;
      if (nextCoins < 0) {
        throw new Error(`Insufficient balance for ${targetUid} (current ${currentCoins}).`);
      }

      await tx
        .update(wallets)
        .set({ coins: nextCoins, updatedAt: new Date() })
        .where(eq(wallets.userUid, targetUid));

      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        userUid: targetUid,
        type: params.deltaCoins > 0 ? 'admin_credit' : 'admin_deduct',
        amount: params.deltaCoins,
        balanceAfter: nextCoins,
        referenceType: 'admin_adjustment',
        referenceId: params.adminUid,
        description: params.reason.trim() || 'Admin wallet adjustment',
        actorUid: params.adminUid,
      });

      await tx.insert(notifications).values({
        userUid: targetUid,
        type: 'payment',
        title: params.deltaCoins > 0 ? 'Coins Received' : 'Wallet Adjusted',
        body:
          params.deltaCoins > 0
            ? `+${params.deltaCoins.toLocaleString()} coins credited: ${params.reason}`
            : `${params.deltaCoins.toLocaleString()} coins deducted: ${params.reason}`,
      });

      results.push({ uid: targetUid, coins: nextCoins });
    }

    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: params.deltaCoins > 0 ? 'admin_credit_coins' : 'admin_deduct_coins',
      targetType: 'wallet',
      targetId: params.targetUids.join(','),
      details: { deltaCoins: params.deltaCoins, count: params.targetUids.length, reason: params.reason },
    });

    return results;
  });
}

export async function transferCoinsAtomic(_params: {
  senderUid: string;
  recipientPublicIdOrUid: string;
  amount: number;
  note?: string;
}) {
  throw new Error('User-to-user coin transfers are permanently disabled.');
}

// =========================================================================
// GIFTING, CHARM, VIP POINTS PROGRESSION & TOP 50 RANKINGS
// =========================================================================
export async function sendGiftAtomic(params: {
  senderUid: string;
  recipientUid: string;
  giftId: string;
  quantity: number;
  roomId?: string;
  customMessage?: string;
  now?: Date;
}) {
  await ensureSeedData();
  const qty = Math.max(1, Math.min(999, Math.floor(params.quantity)));
  const now = params.now || new Date();

  return db.transaction(async (tx) => {
    const [gift] = await tx
      .select()
      .from(gifts)
      .where(and(eq(gifts.id, params.giftId), eq(gifts.active, true)));
    if (!gift) throw new Error('UNKNOWN_GIFT');

    const totalCost = gift.cost * qty;
    const totalCharm = gift.charmValue * qty;
    const rewardCoins =
      (gift.randomCoinsMin +
        crypto.randomInt(0, Math.max(1, gift.randomCoinsMax - gift.randomCoinsMin + 1))) *
      qty;

    // Resolve recipient if publicId or uid exists in users table
    const [realRecipient] = await tx
      .select({ uid: users.uid })
      .from(users)
      .where(or(eq(users.uid, params.recipientUid), eq(users.publicId, params.recipientUid)));

    const lockUids =
      realRecipient && realRecipient.uid !== params.senderUid
        ? [params.senderUid, realRecipient.uid].sort()
        : [params.senderUid];
    const walletRows = await tx
      .select()
      .from(wallets)
      .where(inArray(wallets.userUid, lockUids))
      .orderBy(asc(wallets.userUid))
      .for('update');

    const senderWallet = walletRows.find((w) => w.userUid === params.senderUid);
    if (senderWallet?.isFrozen) {
      throw new Error('WALLET_FROZEN: Your wallet is currently frozen by Admin moderation.');
    }
    if (!senderWallet || Number(senderWallet.coins) < totalCost) {
      throw new Error('INSUFFICIENT_COINS');
    }

    // Sync sender VIP status/decay before checking eligibility for VIP progression points
    await syncUserVipAndDecay(params.senderUid, now, tx);
    const [senderVip] = await tx
      .select()
      .from(vipMemberships)
      .where(eq(vipMemberships.userUid, params.senderUid))
      .for('update');

    const txId = `GFT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const nextSenderCoins = Number(senderWallet.coins) - totalCost;
    await tx
      .update(wallets)
      .set({
        coins: nextSenderCoins,
        totalSpentCoins: Number(senderWallet.totalSpentCoins) + totalCost,
        updatedAt: now,
      })
      .where(eq(wallets.userUid, params.senderUid));

    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      userUid: params.senderUid,
      type: 'gift_spend',
      amount: -totalCost,
      balanceAfter: nextSenderCoins,
      referenceType: 'gift',
      referenceId: txId,
      description: `Sent ${qty}x ${gift.name} to ${params.recipientUid}`,
    });

    // Eligible gifting earns 1 VIP point per 100 coins ONLY if sender already has an active paid VIP subscription
    const senderHasActiveVip =
      senderVip?.vipStatus === 'active' &&
      (!senderVip.expiresAt || senderVip.expiresAt.getTime() > now.getTime());
    const vipPointsEarned = senderHasActiveVip ? Math.floor(totalCost / 100) : 0;

    if (vipPointsEarned > 0 && senderVip) {
      const nextGrowth = Math.max(0, Number(senderVip.vipGrowth ?? 0)) + vipPointsEarned;
      const nextVipLevel = Math.max(1, computeVipLevelFromPoints(nextGrowth));
      await tx
        .update(vipMemberships)
        .set({
          vipGrowth: nextGrowth,
          vipLevel: nextVipLevel,
          planLabel: `VIP ${nextVipLevel}`,
          updatedAt: now,
        })
        .where(eq(vipMemberships.userUid, params.senderUid));

      await tx.insert(vipPointLedger).values({
        userUid: params.senderUid,
        delta: vipPointsEarned,
        balanceAfter: nextGrowth,
        vipLevelAfter: nextVipLevel,
        source: 'gift_spend',
        referenceId: txId,
        idempotencyKey: `gift:${txId}`,
        description: `Earned +${vipPointsEarned} VIP pt${vipPointsEarned === 1 ? '' : 's'} for gifting ${qty}x ${gift.name} (${totalCost.toLocaleString()} coins)`,
      });
    }

    // Credit recipient charm & bonus coins if a registered user (NEVER activates recipient VIP!)
    const targetUidForCharm = realRecipient ? realRecipient.uid : params.recipientUid;
    if (realRecipient) {
      if (realRecipient.uid !== params.senderUid && rewardCoins > 0) {
        const recWallet = walletRows.find((w) => w.userUid === realRecipient.uid);
        if (recWallet) {
          const nextRecCoins = Number(recWallet.coins) + rewardCoins;
          await tx
            .update(wallets)
            .set({
              coins: nextRecCoins,
              totalReceivedCoins: Number(recWallet.totalReceivedCoins) + rewardCoins,
              updatedAt: now,
            })
            .where(eq(wallets.userUid, realRecipient.uid));
          await tx.insert(walletTransactions).values({
            txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
            userUid: realRecipient.uid,
            type: 'gift_receive',
            amount: rewardCoins,
            balanceAfter: nextRecCoins,
            referenceType: 'gift',
            referenceId: txId,
            description: `Received ${qty}x ${gift.name} bonus coins`,
          });
        }
      }

      const [existingCharm] = await tx
        .select({ total: sql<number>`COALESCE(SUM(${charmRecords.delta}), 0)` })
        .from(charmRecords)
        .where(eq(charmRecords.userUid, realRecipient.uid));
      const newCharmTotal = Number(existingCharm?.total ?? 0) + totalCharm;

      await tx.insert(charmRecords).values({
        userUid: realRecipient.uid,
        delta: totalCharm,
        totalAfter: newCharmTotal,
        source: 'gift_received',
        referenceId: txId,
      });

      const { weekly, monthly } = getCycleKeys(now);
      for (const pk of ['overall', weekly, monthly]) {
        await tx
          .insert(rankings)
          .values({ userUid: realRecipient.uid, periodKey: pk, charmScore: totalCharm, giftsSentScore: 0 })
          .onConflictDoUpdate({
            target: [rankings.userUid, rankings.periodKey],
            set: { charmScore: sql`${rankings.charmScore} + ${totalCharm}`, updatedAt: now },
          });
      }

      // Advance active CP charm if sender and recipient are active CP partners
      if (realRecipient.uid !== params.senderUid) {
        const [activeCp] = await tx
          .select()
          .from(cpRelationships)
          .where(
            and(
              eq(cpRelationships.status, 'active'),
              or(
                and(eq(cpRelationships.userAUid, params.senderUid), eq(cpRelationships.userBUid, realRecipient.uid)),
                and(eq(cpRelationships.userAUid, realRecipient.uid), eq(cpRelationships.userBUid, params.senderUid))
              )
            )
          )
          .for('update');
          if (activeCp) {
          await tx
            .update(cpRelationships)
            .set({ cpCharm: Number(activeCp.cpCharm ?? 0) + totalCharm })
            .where(eq(cpRelationships.id, activeCp.id));
        }

        // Auto-level active Relationship Tags (Lv.1-10) between sender & recipient
        const activeRelTags = await tx
          .select()
          .from(relationshipTags)
          .where(
            and(
              eq(relationshipTags.status, 'active'),
              or(
                and(eq(relationshipTags.userAUid, params.senderUid), eq(relationshipTags.userBUid, realRecipient.uid)),
                and(eq(relationshipTags.userAUid, realRecipient.uid), eq(relationshipTags.userBUid, params.senderUid))
              )
            )
          )
          .for('update');
        for (const tagRow of activeRelTags) {
          const nextCharm = Number(tagRow.charmScore ?? 0) + totalCharm;
          const nextLvl = computeRelationshipTagLevel(nextCharm);
          await tx
            .update(relationshipTags)
            .set({ charmScore: nextCharm, level: nextLvl, updatedAt: now })
            .where(eq(relationshipTags.id, tagRow.id));
        }
      }
    }

    // Track sender giftsSentScore in rankings
    const { weekly, monthly } = getCycleKeys(now);
    for (const pk of ['overall', weekly, monthly]) {
      await tx
        .insert(rankings)
        .values({ userUid: params.senderUid, periodKey: pk, charmScore: 0, giftsSentScore: totalCost })
        .onConflictDoUpdate({
          target: [rankings.userUid, rankings.periodKey],
          set: { giftsSentScore: sql`${rankings.giftsSentScore} + ${totalCost}`, updatedAt: now },
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
      customMessage: params.customMessage || null,
    });

    // Advance 'send_gift' daily task progress safely
    const { daily } = getCycleKeys(now);
    const dailyGiftTasks = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.actionType, 'send_gift'), eq(tasks.active, true)));
    for (const t of dailyGiftTasks) {
      await tx
        .insert(taskProgress)
        .values({ userUid: params.senderUid, taskId: t.id, cycleKey: daily, progress: 1, claimed: false })
        .onConflictDoUpdate({
          target: [taskProgress.userUid, taskProgress.taskId, taskProgress.cycleKey],
          set: { progress: sql`LEAST(${t.targetCount}, ${taskProgress.progress} + 1)` },
        });
    }

    return {
      txId,
      gift,
      quantity: qty,
      coinsSpent: totalCost,
      charmAwarded: totalCharm,
      bonusCoins: rewardCoins,
      vipPointsEarned,
    };
  });
}

export async function getTop50Rankings(period: 'overall' | 'weekly' | 'monthly' = 'overall') {
  await ensureSeedData();
  const keys = getCycleKeys();
  const periodKey =
    period === 'weekly' ? keys.weekly : period === 'monthly' ? keys.monthly : 'overall';

  const rows = await db
    .select({
      uid: users.uid,
      publicId: users.publicId,
      name: profiles.displayName,
      photoUrl: profiles.photoUrl,
      equippedFrameId: profiles.equippedFrameId,
      vipLevel: vipMemberships.vipLevel,
      vipStatus: vipMemberships.vipStatus,
      charmScore: rankings.charmScore,
      giftsSentScore: rankings.giftsSentScore,
    })
    .from(rankings)
    .innerJoin(users, eq(rankings.userUid, users.uid))
    .innerJoin(profiles, eq(users.uid, profiles.userUid))
    .leftJoin(vipMemberships, eq(users.uid, vipMemberships.userUid))
    .where(and(eq(rankings.periodKey, periodKey), eq(users.accountStatus, 'active')))
    .orderBy(desc(rankings.charmScore), desc(rankings.giftsSentScore))
    .limit(50);

  const now = Date.now();
  const framedUids = rows.filter((r) => Boolean(r.equippedFrameId)).map((r) => r.uid);
  const invRows =
    framedUids.length > 0
      ? await db
          .select({
            userUid: userInventory.userUid,
            itemId: userInventory.itemId,
            expiresAt: userInventory.expiresAt,
          })
          .from(userInventory)
          .where(inArray(userInventory.userUid, framedUids))
      : [];
  const validFrameSet = new Set(
    invRows
      .filter((inv) => !inv.expiresAt || new Date(inv.expiresAt).getTime() > now)
      .map((inv) => `${inv.userUid}:${inv.itemId}`)
  );

  return rows.map((r, idx) => ({
    rank: idx + 1,
    uid: r.publicId,
    publicId: r.publicId,
    name: r.name,
    photoUrl: r.photoUrl,
    equippedFrameId:
      r.equippedFrameId && validFrameSet.has(`${r.uid}:${r.equippedFrameId}`)
        ? r.equippedFrameId
        : null,
    vipLevel: r.vipStatus === 'active' ? Number(r.vipLevel ?? 0) : 0,
    charmPoints: Number(r.charmScore ?? 0),
    giftsSentCoins: Number(r.giftsSentScore ?? 0),
  }));
}

// =========================================================================
// TASKS & SHOP INVENTORY (Never unlocks VIP!)
// =========================================================================
export async function getUserTasksWithProgress(userUid: string) {
  await ensureSeedData();
  const allTasks = await db.select().from(tasks).where(eq(tasks.active, true)).orderBy(asc(tasks.sortOrder));
  const keys = getCycleKeys();

  const progRows = await db
    .select()
    .from(taskProgress)
    .where(eq(taskProgress.userUid, userUid));

  return allTasks.map((t) => {
    const cycleKey =
      t.category === 'weekly' ? keys.weekly : t.category === 'event' ? 'event' : keys.daily;
    const match = progRows.find((p) => p.taskId === t.id && p.cycleKey === cycleKey);
    return {
      ...t,
      cycleKey,
      progress: match?.progress ?? 0,
      claimed: match?.claimed ?? false,
    };
  });
}

export async function recordTaskActionProgress(userUid: string, actionType: string, increment = 1) {
  await ensureSeedData();
  const activeTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.actionType, actionType), eq(tasks.active, true)));
  const keys = getCycleKeys();

  for (const t of activeTasks) {
    const cycleKey =
      t.category === 'weekly' ? keys.weekly : t.category === 'event' ? 'event' : keys.daily;
    await db
      .insert(taskProgress)
      .values({ userUid, taskId: t.id, cycleKey, progress: Math.min(t.targetCount, increment), claimed: false })
      .onConflictDoUpdate({
        target: [taskProgress.userUid, taskProgress.taskId, taskProgress.cycleKey],
        set: { progress: sql`LEAST(${t.targetCount}, ${taskProgress.progress} + ${increment})` },
      });
  }
}

export async function claimTaskRewardAtomic(userUid: string, taskId: string) {
  await ensureSeedData();
  const [taskRow] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.active, true)));
  if (!taskRow) throw new Error('TASK_NOT_FOUND');

  const keys = getCycleKeys();
  const cycleKey =
    taskRow.category === 'weekly' ? keys.weekly : taskRow.category === 'event' ? 'event' : keys.daily;

  return db.transaction(async (tx) => {
    const [prog] = await tx
      .select()
      .from(taskProgress)
      .where(and(eq(taskProgress.userUid, userUid), eq(taskProgress.taskId, taskId), eq(taskProgress.cycleKey, cycleKey)))
      .for('update');

    // Allow daily check-in task to auto-complete on claim click
    if (taskRow.actionType === 'checkin' && !prog) {
      await tx.insert(taskProgress).values({
        userUid,
        taskId,
        cycleKey,
        progress: taskRow.targetCount,
        claimed: false,
      });
    } else if (!prog || prog.progress < taskRow.targetCount) {
      if (taskRow.actionType !== 'checkin') {
        throw new Error('TASK_NOT_COMPLETED');
      }
    }

    if (prog?.claimed) throw new Error('TASK_ALREADY_CLAIMED');

    await tx
      .update(taskProgress)
      .set({ progress: taskRow.targetCount, claimed: true, claimedAt: new Date() })
      .where(and(eq(taskProgress.userUid, userUid), eq(taskProgress.taskId, taskId), eq(taskProgress.cycleKey, cycleKey)));

    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userUid, userUid)).for('update');
    const nextCoins = Number(wallet?.coins ?? 0) + taskRow.rewardCoins;
    await tx.update(wallets).set({ coins: nextCoins, updatedAt: new Date() }).where(eq(wallets.userUid, userUid));

    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      userUid,
      type: 'task_reward',
      amount: taskRow.rewardCoins,
      balanceAfter: nextCoins,
      referenceType: 'task',
      referenceId: `${taskId}:${cycleKey}`,
      idempotencyKey: `task-${userUid}-${taskId}-${cycleKey}`,
      description: `Completed task: ${taskRow.title}`,
    });

    // Strict VIP rule: Tasks ONLY award coins — NEVER alter VIP status or VIP points!
    return { task: taskRow, coinsAwarded: taskRow.rewardCoins, coins: nextCoins };
  });
}

export const DAILY_TASK_CHEST_REWARDS: Record<number, { coins: number; label: string }> = {
  2: { coins: 500, label: 'OG Crystal Chest (2 Tasks)' },
  5: { coins: 10_000, label: 'OG Diamond Chest (5 Tasks)' },
  8: { coins: 25_000, label: 'OG Royal Gift Chest (8 Tasks)' },
};

export async function getClaimedTaskChests(userUid: string): Promise<number[]> {
  const keys = getCycleKeys();
  const prefix = `${keys.daily}:`;
  const rows = await db
    .select({ referenceId: walletTransactions.referenceId })
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.userUid, userUid),
        eq(walletTransactions.referenceType, 'task_chest'),
        ilike(walletTransactions.referenceId, `${prefix}%`)
      )
    );
  const steps = rows
    .map((r) => {
      const parts = String(r.referenceId || '').split(':');
      return Number(parts[parts.length - 1]);
    })
    .filter((n) => n === 2 || n === 5 || n === 8);
  return Array.from(new Set(steps)).sort((a, b) => a - b);
}

export async function claimTaskChestAtomic(userUid: string, rawStep: number) {
  await ensureSeedData();
  const step = Number(rawStep);
  const rewardCfg = DAILY_TASK_CHEST_REWARDS[step];
  if (!rewardCfg) throw new Error('INVALID_CHEST_STEP');

  const keys = getCycleKeys();
  const dailyTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.active, true), eq(tasks.category, 'daily')));
  const progRows = await db
    .select()
    .from(taskProgress)
    .where(and(eq(taskProgress.userUid, userUid), eq(taskProgress.cycleKey, keys.daily)));

  const completedCount = dailyTasks.filter((t) => {
    const p = progRows.find((r) => r.taskId === t.id);
    return p && (p.claimed || p.progress >= t.targetCount);
  }).length;

  if (completedCount < step) {
    throw new Error(`Complete at least ${step} daily tasks first (${completedCount}/${step}).`);
  }

  const idempotencyKey = `taskchest-${userUid}-${keys.daily}-${step}`;
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ txId: walletTransactions.txId })
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, idempotencyKey));
    if (existing) {
      throw new Error('CHEST_ALREADY_CLAIMED');
    }

    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userUid, userUid)).for('update');
    const nextCoins = Number(wallet?.coins ?? 0) + rewardCfg.coins;
    await tx.update(wallets).set({ coins: nextCoins, updatedAt: new Date() }).where(eq(wallets.userUid, userUid));

    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      userUid,
      type: 'task_reward',
      amount: rewardCfg.coins,
      balanceAfter: nextCoins,
      referenceType: 'task_chest',
      referenceId: `${keys.daily}:${step}`,
      idempotencyKey,
      description: `Claimed ${rewardCfg.label} (+${rewardCfg.coins.toLocaleString()} coins)`,
    });

    return { step, coinsAwarded: rewardCfg.coins, coins: nextCoins, label: rewardCfg.label };
  });
}

export async function adminGetTaskProgressList(limitCount = 120) {
  const keys = getCycleKeys();
  const [rows, allUsers, allTasks] = await Promise.all([
    db
      .select()
      .from(taskProgress)
      .orderBy(desc(taskProgress.id))
      .limit(Math.max(20, Math.min(300, limitCount))),
    db.select({ uid: users.uid, publicId: users.publicId, email: users.email }).from(users),
    db.select().from(tasks),
  ]);
  const userMap = new Map(allUsers.map((u) => [u.uid, u]));
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  return rows.map((r) => {
    const u = userMap.get(r.userUid);
    const t = taskMap.get(r.taskId);
    return {
      id: r.id,
      userPublicId: u?.publicId || r.userUid,
      userEmail: u?.email || '',
      taskId: r.taskId,
      taskTitle: t?.title || r.taskId,
      targetCount: t?.targetCount ?? 1,
      rewardCoins: t?.rewardCoins ?? 0,
      cycleKey: r.cycleKey,
      isCurrentDailyCycle: r.cycleKey === keys.daily,
      progress: r.progress,
      claimed: r.claimed,
      claimedAt: r.claimedAt ? r.claimedAt.toISOString() : null,
    };
  });
}

export async function adminUpdateUserTaskProgress(params: {
  userIdentifier: string;
  taskId: string;
  progress?: number;
  claimed?: boolean;
}) {
  const targetUser = await resolveUserByUidOrPublicId(params.userIdentifier);
  if (!targetUser) throw new Error('User not found.');
  const [taskRow] = await db.select().from(tasks).where(eq(tasks.id, params.taskId));
  if (!taskRow) throw new Error('Task not found.');
  const keys = getCycleKeys();
  const cycleKey =
    taskRow.category === 'weekly' ? keys.weekly : taskRow.category === 'event' ? 'event' : keys.daily;

  const nextProgress =
    typeof params.progress === 'number'
      ? Math.max(0, Math.min(taskRow.targetCount, Math.floor(params.progress)))
      : taskRow.targetCount;
  const nextClaimed = Boolean(params.claimed);

  const [saved] = await db
    .insert(taskProgress)
    .values({
      userUid: targetUser.uid,
      taskId: taskRow.id,
      cycleKey,
      progress: nextProgress,
      claimed: nextClaimed,
      claimedAt: nextClaimed ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [taskProgress.userUid, taskProgress.taskId, taskProgress.cycleKey],
      set: {
        progress: nextProgress,
        claimed: nextClaimed,
        claimedAt: nextClaimed ? new Date() : null,
      },
    })
    .returning();

  return {
    ...saved,
    userPublicId: targetUser.publicId,
    taskTitle: taskRow.title,
  };
}

export async function buyShopItemAtomic(params: {
  userUid: string;
  itemId: string;
  category: string;
  priceCoins: number;
  durationDays?: number;
}) {
  await ensureSeedData();
  if (params.priceCoins < 0) throw new Error('Invalid price.');
  return db.transaction(async (tx) => {
    const [catalogItem] = await tx.select().from(shopItems).where(eq(shopItems.id, params.itemId));
    if (catalogItem && !catalogItem.active) {
      throw new Error('This shop item is currently unavailable.');
    }
    const authoritativePrice = catalogItem ? Number(catalogItem.priceCoins) : params.priceCoins;
    const authoritativeCategory = catalogItem ? catalogItem.category : params.category;
    const authoritativeDurationDays = catalogItem ? catalogItem.durationDays : params.durationDays;

    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userUid, params.userUid)).for('update');
    if (wallet?.isFrozen) throw new Error('Your wallet is currently frozen by Admin moderation.');
    if (!wallet || Number(wallet.coins) < authoritativePrice) throw new Error('INSUFFICIENT_COINS');

    const nextCoins = Number(wallet.coins) - authoritativePrice;
    await tx
      .update(wallets)
      .set({
        coins: nextCoins,
        totalSpentCoins: Number(wallet.totalSpentCoins) + authoritativePrice,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userUid, params.userUid));

    const expiresAt = authoritativeDurationDays
      ? new Date(Date.now() + authoritativeDurationDays * 86_400_000)
      : null;

    await tx
      .insert(userInventory)
      .values({ userUid: params.userUid, itemId: params.itemId, category: authoritativeCategory, expiresAt })
      .onConflictDoUpdate({
        target: [userInventory.userUid, userInventory.itemId],
        set: { purchasedAt: new Date(), expiresAt },
      });

    if (authoritativePrice > 0) {
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        userUid: params.userUid,
        type: 'shop_spend',
        amount: -authoritativePrice,
        balanceAfter: nextCoins,
        referenceType: 'shop_item',
        referenceId: params.itemId,
        description: `Purchased ${authoritativeCategory}: ${catalogItem?.name || params.itemId}`,
      });
    }

    return { itemId: params.itemId, coins: nextCoins, expiresAt: expiresAt?.toISOString() ?? null };
  });
}

// =========================================================================
// SOCIAL: FRIENDS, BLOCKS, DIRECT CHAT, MOMENTS, REPORTS, NOTIFICATIONS
// =========================================================================
export function makeDmThreadId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('__');
}

export async function isBlockedBetween(uidA: string, uidB: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(friends)
    .where(
      and(
        eq(friends.status, 'blocked'),
        or(
          and(eq(friends.requesterUid, uidA), eq(friends.addresseeUid, uidB)),
          and(eq(friends.requesterUid, uidB), eq(friends.addresseeUid, uidA))
        )
      )
    );
  return rows.length > 0;
}

export async function areUsersAcceptedFriends(uidA: string, uidB: string): Promise<boolean> {
  if (!uidA || !uidB || uidA === uidB) return false;
  const rows = await db
    .select({ id: friends.id, status: friends.status })
    .from(friends)
    .where(
      or(
        and(eq(friends.requesterUid, uidA), eq(friends.addresseeUid, uidB)),
        and(eq(friends.requesterUid, uidB), eq(friends.addresseeUid, uidA))
      )
    );
  if (rows.some((r) => r.status === 'blocked')) return false;
  return rows.some((r) => r.status === 'accepted');
}

export async function cancelFriendRequest(actorUid: string, targetIdentifierOrRelId: string | number) {
  let rel: typeof friends.$inferSelect | undefined;
  if (typeof targetIdentifierOrRelId === 'number' || /^\d+$/.test(String(targetIdentifierOrRelId))) {
    const idNum = Number(targetIdentifierOrRelId);
    const [byId] = await db.select().from(friends).where(eq(friends.id, idNum));
    if (byId && byId.requesterUid === actorUid && byId.status === 'pending') {
      rel = byId;
    }
  }
  if (!rel) {
    const resolved = await resolveUserByUidOrPublicId(String(targetIdentifierOrRelId));
    if (resolved) {
      const [byTarget] = await db
        .select()
        .from(friends)
        .where(
          and(
            eq(friends.requesterUid, actorUid),
            eq(friends.addresseeUid, resolved.uid),
            eq(friends.status, 'pending')
          )
        );
      rel = byTarget;
    }
  }
  if (!rel) throw new Error('Outgoing pending friend request not found.');
  await db.delete(friends).where(eq(friends.id, rel.id));
  return { cancelledId: rel.id, addresseeUid: rel.addresseeUid };
}

export async function unfriendUser(actorUid: string, targetIdentifier: string) {
  const resolved = await resolveUserByUidOrPublicId(targetIdentifier);
  const targetUid = resolved?.uid || targetIdentifier;
  if (!targetUid || targetUid === actorUid) {
    throw new Error('Invalid target user.');
  }
  await db
    .delete(friends)
    .where(
      and(
        eq(friends.status, 'accepted'),
        or(
          and(eq(friends.requesterUid, actorUid), eq(friends.addresseeUid, targetUid)),
          and(eq(friends.requesterUid, targetUid), eq(friends.addresseeUid, actorUid))
        )
      )
    );
  return { unfriendedUid: targetUid, unfriendedPublicId: resolved?.publicId || targetIdentifier };
}

export async function unblockUser(actorUid: string, targetIdentifier: string) {
  const resolved = await resolveUserByUidOrPublicId(targetIdentifier);
  const targetUid = resolved?.uid || targetIdentifier;
  if (!targetUid || targetUid === actorUid) {
    throw new Error('Invalid target user.');
  }
  await db
    .delete(friends)
    .where(
      and(
        eq(friends.requesterUid, actorUid),
        eq(friends.addresseeUid, targetUid),
        eq(friends.status, 'blocked')
      )
    );
  return { unblockedPublicId: resolved?.publicId || targetIdentifier };
}

export async function getUserNotifications(userUid: string) {
  return db
    .select()
    .from(notifications)
    .where(or(eq(notifications.userUid, userUid), isNull(notifications.userUid)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

// =========================================================================
// PUBLIC PROFILE LOOKUP (Never exposes Firebase UIDs or private fields)
// =========================================================================
export async function getPublicUserProfile(
  identifier: string,
  viewerUid?: string,
  isOnlineOverride?: boolean
) {
  const resolved = await resolveUserByUidOrPublicId(identifier);
  if (!resolved) return null;
  const full = await getFullUserView(resolved.uid);
  if (!full || full.accountStatus !== 'active') return null;

  const [friendCountRow, giftsGivenRow, activeRoomRows, viewerRelRows] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(friends)
      .where(
        and(
          eq(friends.status, 'accepted'),
          or(eq(friends.requesterUid, resolved.uid), eq(friends.addresseeUid, resolved.uid))
        )
      ),
    db
      .select({ total: sql<number>`COALESCE(SUM(${giftTransactions.quantity}), 0)` })
      .from(giftTransactions)
      .where(eq(giftTransactions.senderUid, resolved.uid)),
    db
      .select({
        roomId: voiceRooms.id,
        roomTitle: voiceRooms.title,
        isLocked: voiceRooms.isLocked,
      })
      .from(roomParticipants)
      .innerJoin(voiceRooms, eq(roomParticipants.roomId, voiceRooms.id))
      .where(and(eq(roomParticipants.userUid, resolved.uid), eq(voiceRooms.status, 'active')))
      .limit(1),
    viewerUid && viewerUid !== resolved.uid
      ? db
          .select()
          .from(friends)
          .where(
            or(
              and(eq(friends.requesterUid, viewerUid), eq(friends.addresseeUid, resolved.uid)),
              and(eq(friends.requesterUid, resolved.uid), eq(friends.addresseeUid, viewerUid))
            )
          )
      : Promise.resolve([]),
  ]);

  let friendStatus:
    | 'self'
    | 'none'
    | 'friends'
    | 'pending_outgoing'
    | 'pending_incoming'
    | 'blocked_by_me'
    | 'blocked_by_them' = viewerUid === resolved.uid ? 'self' : 'none';
  let relationId: number | null = null;

  if (viewerUid && viewerUid !== resolved.uid && viewerRelRows.length > 0) {
    const blockedByMe = viewerRelRows.find((r) => r.status === 'blocked' && r.requesterUid === viewerUid);
    const blockedByThem = viewerRelRows.find((r) => r.status === 'blocked' && r.requesterUid === resolved.uid);
    const accepted = viewerRelRows.find((r) => r.status === 'accepted');
    const pendingOut = viewerRelRows.find((r) => r.status === 'pending' && r.requesterUid === viewerUid);
    const pendingIn = viewerRelRows.find((r) => r.status === 'pending' && r.addresseeUid === viewerUid);

    if (blockedByMe) {
      friendStatus = 'blocked_by_me';
      relationId = blockedByMe.id;
    } else if (blockedByThem) {
      friendStatus = 'blocked_by_them';
      relationId = blockedByThem.id;
    } else if (accepted) {
      friendStatus = 'friends';
      relationId = accepted.id;
    } else if (pendingOut) {
      friendStatus = 'pending_outgoing';
      relationId = pendingOut.id;
    } else if (pendingIn) {
      friendStatus = 'pending_incoming';
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
      photoUrl: full.photoUrl || undefined,
      coverUrl: full.coverUrl || undefined,
      gender: full.gender,
      age: full.age,
      country: full.country,
      blessing: full.charmPoints,
      cpPartner: full.cpPartner,
      skinTone: '#E0AC89',
      hairColor: '#1E293B',
      robeColor: '#F59E0B',
      accentColor: '#FBBF24',
      ornament: full.ornament,
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
    relationId,
  };
}

// =========================================================================
// CP PROPOSALS & SYNCHRONIZED RELATIONSHIPS (Decoupled from Avatar Ring Shop)
// =========================================================================
export async function getCpStateForUser(uid: string) {
  await ensureNumericPublicIdsMigrated();
  const [proposalRows, relationshipRows] = await Promise.all([
    db
      .select()
      .from(cpProposals)
      .where(or(eq(cpProposals.fromUid, uid), eq(cpProposals.toUid, uid)))
      .orderBy(desc(cpProposals.createdAt))
      .limit(40),
    db
      .select()
      .from(cpRelationships)
      .where(or(eq(cpRelationships.userAUid, uid), eq(cpRelationships.userBUid, uid)))
      .orderBy(desc(cpRelationships.startedAt))
      .limit(15),
  ]);

  const involvedUids = Array.from(
    new Set([
      uid,
      ...proposalRows.flatMap((p) => [p.fromUid, p.toUid]),
      ...relationshipRows.flatMap((r) => [r.userAUid, r.userBUid]),
    ])
  );

  const userSummaryRows =
    involvedUids.length > 0
      ? await db
          .select({
            uid: users.uid,
            publicId: users.publicId,
            name: profiles.displayName,
            photoUrl: profiles.photoUrl,
          })
          .from(users)
          .leftJoin(profiles, eq(users.uid, profiles.userUid))
          .where(inArray(users.uid, involvedUids))
      : [];

  const infoMap = new Map(
    userSummaryRows.map((u) => [
      u.uid,
      {
        publicId: u.publicId,
        name: u.name || `Player ${u.publicId}`,
        photoUrl: u.photoUrl || null,
        avatarId: `user-${u.publicId}`,
      },
    ])
  );

  const activeRel = relationshipRows.find((r) => r.status === 'active') || null;
  let cpPartner: CpPartnerSummary | null = null;
  if (activeRel) {
    const partnerInternalUid = activeRel.userAUid === uid ? activeRel.userBUid : activeRel.userAUid;
    const partnerInfo = infoMap.get(partnerInternalUid);
    if (partnerInfo) {
      const days = Math.max(
        1,
        Math.floor((Date.now() - activeRel.startedAt.getTime()) / 86_400_000) + 1
      );
      cpPartner = {
        partnerUid: partnerInfo.publicId,
        partnerName: partnerInfo.name,
        partnerAvatarId: partnerInfo.avatarId,
        partnerPhotoUrl: partnerInfo.photoUrl,
        ringNumber: Number(activeRel.ringNumber || 1),
        ringName: activeRel.ringName,
        since: `${days} ${days === 1 ? 'day' : 'days'}`,
        cpCharm: Number(activeRel.cpCharm ?? 0),
        cpLevel: computeCpLevelFromCharm(Number(activeRel.cpCharm ?? 0)),
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
        fromName: from?.name || 'Player',
        fromAvatarId: from?.avatarId || 'av-self',
        fromPhotoUrl: from?.photoUrl || null,
        toUid: to?.publicId || p.toUid,
        toName: to?.name || 'Player',
        toAvatarId: to?.avatarId || 'av-self',
        toPhotoUrl: to?.photoUrl || null,
        ringNumber: Number(p.ringNumber || 1),
        ringName: p.ringName,
        status: p.status === 'rejected' ? 'declined' : p.status,
        rawStatus: p.status,
        direction: p.fromUid === uid ? 'outgoing' : 'incoming',
        timestamp: p.createdAt.toISOString(),
        respondedAt: p.respondedAt ? p.respondedAt.toISOString() : null,
      };
    }),
    history: relationshipRows.map((r) => {
      const a = infoMap.get(r.userAUid);
      const b = infoMap.get(r.userBUid);
      const partner = r.userAUid === uid ? b : a;
      return {
        id: r.id,
        partnerUid: partner?.publicId || '',
        partnerName: partner?.name || 'Player',
        ringNumber: Number(r.ringNumber || 1),
        ringName: r.ringName,
        cpCharm: Number(r.cpCharm ?? 0),
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt ? r.endedAt.toISOString() : null,
      };
    }),
  };
}

export class CpDomainError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function proposeCpAtomic(params: {
  fromUid: string;
  toIdentifier: string;
  ringNumber: number;
  ringName: string;
}) {
  await ensureNumericPublicIdsMigrated();
  const ringNumber = Math.max(1, Math.min(20, Math.floor(Number(params.ringNumber || 1))));
  const ringName = String(params.ringName || 'Couple Bond Ring').trim().slice(0, 60) || 'Couple Bond Ring';

  const resolvedTarget = await resolveUserByUidOrPublicId(params.toIdentifier);
  if (!resolvedTarget) {
    throw new CpDomainError(404, 'Target user not found.');
  }
  if (resolvedTarget.uid === params.fromUid) {
    throw new CpDomainError(400, 'Cannot send a CP proposal to yourself.');
  }
  if (resolvedTarget.accountStatus !== 'active') {
    throw new CpDomainError(400, 'Target user account is not active.');
  }
  if (await isBlockedBetween(params.fromUid, resolvedTarget.uid)) {
    throw new CpDomainError(403, 'Cannot propose CP to a blocked user.');
  }

  return db.transaction(async (tx) => {
    const orderedUids = [params.fromUid, resolvedTarget.uid].sort();
    await tx
      .select({ uid: users.uid })
      .from(users)
      .where(inArray(users.uid, orderedUids))
      .orderBy(asc(users.uid))
      .for('update');

    const activeConflict = await tx
      .select({ id: cpRelationships.id, userAUid: cpRelationships.userAUid, userBUid: cpRelationships.userBUid })
      .from(cpRelationships)
      .where(
        and(
          eq(cpRelationships.status, 'active'),
          or(
            eq(cpRelationships.userAUid, params.fromUid),
            eq(cpRelationships.userBUid, params.fromUid),
            eq(cpRelationships.userAUid, resolvedTarget.uid),
            eq(cpRelationships.userBUid, resolvedTarget.uid)
          )
        )
      )
      .limit(1);

    if (activeConflict.length > 0) {
      throw new CpDomainError(409, 'One of the users already has an active CP partner.');
    }

    const pendingDup = await tx
      .select({ id: cpProposals.id })
      .from(cpProposals)
      .where(
        and(
          eq(cpProposals.status, 'pending'),
          or(
            and(eq(cpProposals.fromUid, params.fromUid), eq(cpProposals.toUid, resolvedTarget.uid)),
            and(eq(cpProposals.fromUid, resolvedTarget.uid), eq(cpProposals.toUid, params.fromUid))
          )
        )
      )
      .limit(1);

    if (pendingDup.length > 0) {
      throw new CpDomainError(409, 'A pending CP proposal already exists between you two.');
    }

    // Couple Ring Ownership Enforcement: sender MUST own this ring in user_inventory before proposing
    const matchingShopRings = await tx
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(and(eq(shopItems.category, 'ring'), eq(shopItems.ringNumber, ringNumber)));
    const allowedRingIds = Array.from(new Set([`ring-${ringNumber}`, ...matchingShopRings.map((r) => r.id)]));
    const ownedRings = await tx
      .select({ itemId: userInventory.itemId, expiresAt: userInventory.expiresAt })
      .from(userInventory)
      .where(and(eq(userInventory.userUid, params.fromUid), inArray(userInventory.itemId, allowedRingIds)));
    const hasUnexpiredRing = ownedRings.some(
      (r) => !r.expiresAt || new Date(r.expiresAt).getTime() > Date.now()
    );
    if (!hasUnexpiredRing) {
      throw new CpDomainError(
        403,
        `You must purchase and own "${ringName}" in the Shop before sending a CP proposal.`
      );
    }

    const proposalId = `CPPROP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const [created] = await tx
      .insert(cpProposals)
      .values({
        id: proposalId,
        fromUid: params.fromUid,
        toUid: resolvedTarget.uid,
        ringNumber,
        ringName,
        status: 'pending',
      })
      .returning();

    const [senderProfile] = await tx
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userUid, params.fromUid));
    const [senderUser] = await tx
      .select({ publicId: users.publicId })
      .from(users)
      .where(eq(users.uid, params.fromUid));

    await tx.insert(notifications).values({
      userUid: resolvedTarget.uid,
      type: 'cp',
      title: 'New CP Proposal Received',
      body: `${senderProfile?.displayName || 'Player'} (${senderUser?.publicId || ''}) sent you a ${ringName} CP proposal.`,
      metadata: { proposalId, ringNumber, ringName, fromPublicId: senderUser?.publicId },
    });

    return {
      proposal: created,
      fromUidInternal: params.fromUid,
      toUidInternal: resolvedTarget.uid,
      fromPublicId: senderUser?.publicId || params.fromUid,
      toPublicId: resolvedTarget.publicId,
    };
  });
}

export async function respondCpProposalAtomic(params: {
  actorUid: string;
  proposalId: string;
  accept: boolean;
}) {
  return db.transaction(async (tx) => {
    const [proposal] = await tx
      .select()
      .from(cpProposals)
      .where(eq(cpProposals.id, params.proposalId))
      .for('update');

    if (!proposal) {
      throw new CpDomainError(404, 'CP proposal not found.');
    }
    if (proposal.toUid !== params.actorUid) {
      throw new CpDomainError(403, 'Only the proposal recipient can accept or reject this CP proposal.');
    }
    if (proposal.status !== 'pending') {
      throw new CpDomainError(409, `CP proposal is already ${proposal.status}.`);
    }

    const now = new Date();
    const [[fromUser], [toUser], [fromProfile], [toProfile]] = await Promise.all([
      tx.select({ publicId: users.publicId }).from(users).where(eq(users.uid, proposal.fromUid)),
      tx.select({ publicId: users.publicId }).from(users).where(eq(users.uid, proposal.toUid)),
      tx.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.userUid, proposal.fromUid)),
      tx.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.userUid, proposal.toUid)),
    ]);

    if (!params.accept) {
      const [rejected] = await tx
        .update(cpProposals)
        .set({ status: 'rejected', respondedAt: now })
        .where(eq(cpProposals.id, proposal.id))
        .returning();

      await tx.insert(notifications).values({
        userUid: proposal.fromUid,
        type: 'cp',
        title: 'CP Proposal Declined',
        body: `${toProfile?.displayName || 'Player'} (${toUser?.publicId || ''}) declined your ${proposal.ringName} CP proposal.`,
        metadata: { proposalId: proposal.id },
      });

      return {
        status: 'rejected' as const,
        proposal: rejected,
        relationship: null,
        fromUidInternal: proposal.fromUid,
        toUidInternal: proposal.toUid,
      };
    }

    // Lock both user rows deterministically before verifying active CP conflicts
    const orderedUids = [proposal.fromUid, proposal.toUid].sort();
    await tx
      .select({ uid: users.uid })
      .from(users)
      .where(inArray(users.uid, orderedUids))
      .orderBy(asc(users.uid))
      .for('update');

    const activeConflict = await tx
      .select({ id: cpRelationships.id })
      .from(cpRelationships)
      .where(
        and(
          eq(cpRelationships.status, 'active'),
          or(
            eq(cpRelationships.userAUid, proposal.fromUid),
            eq(cpRelationships.userBUid, proposal.fromUid),
            eq(cpRelationships.userAUid, proposal.toUid),
            eq(cpRelationships.userBUid, proposal.toUid)
          )
        )
      )
      .limit(1);

    if (activeConflict.length > 0) {
      throw new CpDomainError(409, 'One of the users already has an active CP partner.');
    }

    const [accepted] = await tx
      .update(cpProposals)
      .set({ status: 'accepted', respondedAt: now })
      .where(eq(cpProposals.id, proposal.id))
      .returning();

    // Auto-reject any other lingering pending proposals for either user
    await tx
      .update(cpProposals)
      .set({ status: 'rejected', respondedAt: now })
      .where(
        and(
          ne(cpProposals.id, proposal.id),
          eq(cpProposals.status, 'pending'),
          or(
            eq(cpProposals.fromUid, proposal.fromUid),
            eq(cpProposals.toUid, proposal.fromUid),
            eq(cpProposals.fromUid, proposal.toUid),
            eq(cpProposals.toUid, proposal.toUid)
          )
        )
      );

    const relId = `CPREL-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const [relationship] = await tx
      .insert(cpRelationships)
      .values({
        id: relId,
        userAUid: proposal.fromUid,
        userBUid: proposal.toUid,
        proposalId: proposal.id,
        ringNumber: proposal.ringNumber,
        ringName: proposal.ringName,
        cpCharm: 0,
        status: 'active',
        startedAt: now,
      })
      .returning();

    await Promise.all([
      tx
        .update(profiles)
        .set({ cpPartnerUid: proposal.toUid, updatedAt: now })
        .where(eq(profiles.userUid, proposal.fromUid)),
      tx
        .update(profiles)
        .set({ cpPartnerUid: proposal.fromUid, updatedAt: now })
        .where(eq(profiles.userUid, proposal.toUid)),
      // Clear any stale manual Lover/CP Partner rows so active CP relationship is the single source of truth for the official Lover tag
      tx
        .update(relationshipTags)
        .set({ status: 'ended', updatedAt: now })
        .where(
          and(
            inArray(relationshipTags.tagType, ['lover', 'cp_partner']),
            or(
              eq(relationshipTags.userAUid, proposal.fromUid),
              eq(relationshipTags.userBUid, proposal.fromUid),
              eq(relationshipTags.userAUid, proposal.toUid),
              eq(relationshipTags.userBUid, proposal.toUid)
            )
          )
        ),
    ]);

    await tx.insert(notifications).values([
      {
        userUid: proposal.fromUid,
        type: 'cp',
        title: 'CP Bond Formed!',
        body: `${toProfile?.displayName || 'Player'} accepted your ${proposal.ringName} CP proposal! Your CP ring & official Lover tag are now active.`,
        metadata: { relationshipId: relId, ringNumber: proposal.ringNumber },
      },
      {
        userUid: proposal.toUid,
        type: 'cp',
        title: 'CP Bond Formed!',
        body: `You and ${fromProfile?.displayName || 'Player'} are now officially CP partners (${proposal.ringName}) with the Lover tag active!`,
        metadata: { relationshipId: relId, ringNumber: proposal.ringNumber },
      },
    ]);

    return {
      status: 'accepted' as const,
      proposal: accepted,
      relationship,
      fromUidInternal: proposal.fromUid,
      toUidInternal: proposal.toUid,
    };
  });
}

export async function breakCpRelationshipAtomic(actorUid: string) {
  return db.transaction(async (tx) => {
    const [activeRel] = await tx
      .select()
      .from(cpRelationships)
      .where(
        and(
          eq(cpRelationships.status, 'active'),
          or(eq(cpRelationships.userAUid, actorUid), eq(cpRelationships.userBUid, actorUid))
        )
      )
      .for('update');

    if (!activeRel) {
      throw new CpDomainError(404, 'No active CP relationship found.');
    }

    const now = new Date();
    const partnerInternalUid =
      activeRel.userAUid === actorUid ? activeRel.userBUid : activeRel.userAUid;

    await tx
      .update(cpRelationships)
      .set({ status: 'ended', endedByUid: actorUid, endedAt: now })
      .where(eq(cpRelationships.id, activeRel.id));

    await Promise.all([
      tx
        .update(profiles)
        .set({ cpPartnerUid: null, updatedAt: now })
        .where(eq(profiles.userUid, activeRel.userAUid)),
      tx
        .update(profiles)
        .set({ cpPartnerUid: null, updatedAt: now })
        .where(eq(profiles.userUid, activeRel.userBUid)),
      tx
        .update(relationshipTags)
        .set({ status: 'ended', updatedAt: now })
        .where(
          and(
            inArray(relationshipTags.tagType, ['lover', 'cp_partner']),
            or(
              eq(relationshipTags.userAUid, activeRel.userAUid),
              eq(relationshipTags.userBUid, activeRel.userAUid),
              eq(relationshipTags.userAUid, activeRel.userBUid),
              eq(relationshipTags.userBUid, activeRel.userBUid)
            )
          )
        ),
    ]);

    const [[actorProf], [actorUser]] = await Promise.all([
      tx.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.userUid, actorUid)),
      tx.select({ publicId: users.publicId }).from(users).where(eq(users.uid, actorUid)),
    ]);

    await tx.insert(notifications).values({
      userUid: partnerInternalUid,
      type: 'cp',
      title: 'CP Relationship Ended',
      body: `${actorProf?.displayName || 'Player'} (${actorUser?.publicId || ''}) ended your CP relationship. The CP ring has been removed from both profiles.`,
      metadata: { relationshipId: activeRel.id },
    });

    return {
      relationshipId: activeRel.id,
      userAUidInternal: activeRel.userAUid,
      userBUidInternal: activeRel.userBUid,
      partnerUidInternal: partnerInternalUid,
    };
  });
}

// =========================================================================
// DYNAMIC APP CONFIG & GRANULAR SUPER ADMIN RBAC PERMISSIONS
// =========================================================================
export const APP_PERMISSIONS_CATALOG = [
  'users:read',
  'users:manage',
  'users:moderate',
  'payments:read',
  'payments:review',
  'payments:qr_manage',
  'wallet:adjust',
  'vip:manage',
  'gifts:manage',
  'events:manage',
  'tasks:manage',
  'rooms:moderate',
  'posts:moderate',
  'reports:manage',
  'announcements:manage',
  'notifications:send',
  'config:manage',
  'roles:manage',
  'audit:read',
] as const;

export type AppConfigShape = typeof DEFAULT_APP_CONFIG;

export async function getAppConfig(): Promise<AppConfigShape> {
  await ensureSeedData();
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'app_config'));
  const val = (row?.value as Partial<AppConfigShape>) || {};
  return {
    appName: String(val.appName || DEFAULT_APP_CONFIG.appName),
    tagline: String(val.tagline || DEFAULT_APP_CONFIG.tagline),
    maintenanceMode: Boolean(val.maintenanceMode ?? DEFAULT_APP_CONFIG.maintenanceMode),
    maintenanceMessage: String(val.maintenanceMessage || DEFAULT_APP_CONFIG.maintenanceMessage),
    features: { ...DEFAULT_APP_CONFIG.features, ...(val.features || {}) },
    voiceRoomLimits: { ...DEFAULT_APP_CONFIG.voiceRoomLimits, ...(val.voiceRoomLimits || {}) },
    charmRankingConfig: { ...DEFAULT_APP_CONFIG.charmRankingConfig, ...(val.charmRankingConfig || {}) },
    homeBanner: { ...DEFAULT_APP_CONFIG.homeBanner, ...(val.homeBanner || {}) },
    profileDefaults: { ...DEFAULT_APP_CONFIG.profileDefaults, ...(val.profileDefaults || {}) },
    supportInfo: { ...DEFAULT_APP_CONFIG.supportInfo, ...(val.supportInfo || {}) },
  };
}

export async function updateAppConfig(
  actorUid: string,
  actorRole: AccountRole,
  updates: Partial<AppConfigShape>
): Promise<AppConfigShape> {
  const current = await getAppConfig();
  const next: AppConfigShape = {
    appName: typeof updates.appName === 'string' && updates.appName.trim() ? updates.appName.trim().slice(0, 60) : current.appName,
    tagline: typeof updates.tagline === 'string' ? updates.tagline.trim().slice(0, 140) : current.tagline,
    maintenanceMode: typeof updates.maintenanceMode === 'boolean' ? updates.maintenanceMode : current.maintenanceMode,
    maintenanceMessage:
      typeof updates.maintenanceMessage === 'string'
        ? updates.maintenanceMessage.trim().slice(0, 240)
        : current.maintenanceMessage,
    features: { ...current.features, ...(updates.features || {}) },
    voiceRoomLimits: { ...current.voiceRoomLimits, ...(updates.voiceRoomLimits || {}) },
    charmRankingConfig: { ...current.charmRankingConfig, ...(updates.charmRankingConfig || {}) },
    homeBanner: { ...current.homeBanner, ...(updates.homeBanner || {}) },
    profileDefaults: { ...current.profileDefaults, ...(updates.profileDefaults || {}) },
    supportInfo: { ...current.supportInfo, ...(updates.supportInfo || {}) },
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(platformSettings)
      .values({ key: 'app_config', value: next as unknown as Record<string, unknown>, updatedByUid: actorUid, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: next as unknown as Record<string, unknown>, updatedByUid: actorUid, updatedAt: new Date() },
      });
    await tx.insert(auditLogs).values({
      actorUid,
      actorRole,
      action: 'update_app_config',
      targetType: 'platform_settings',
      targetId: 'app_config',
      details: next as unknown as Record<string, unknown>,
    });
  });

  return next;
}

export async function getEffectiveAdminPermissions(userUid: string, role: AccountRole): Promise<string[]> {
  if (role === 'super_admin') return ['*'];
  if (!ADMIN_PANEL_ROLES.has(role)) return [];

  const [[roleRow], [userPermRow]] = await Promise.all([
    db.select().from(rolesPermissions).where(eq(rolesPermissions.role, role)),
    db.select().from(adminUserPermissions).where(eq(adminUserPermissions.userUid, userUid)),
  ]);

  const effective = new Set<string>(Array.isArray(roleRow?.permissions) ? roleRow.permissions : []);

  if (userPermRow) {
    const notExpired = !userPermRow.expiresAt || userPermRow.expiresAt.getTime() > Date.now();
    if (notExpired) {
      if (Array.isArray(userPermRow.customPermissions)) {
        for (const p of userPermRow.customPermissions) effective.add(String(p));
      }
      if (userPermRow.permissionSetId) {
        const [pSet] = await db
          .select()
          .from(adminPermissionSets)
          .where(eq(adminPermissionSets.id, userPermRow.permissionSetId));
        if (pSet && Array.isArray(pSet.permissions)) {
          for (const p of pSet.permissions) effective.add(String(p));
        }
      }
    }
  }

  return Array.from(effective);
}

export async function getAdminPermissionSets() {
  await ensureSeedData();
  return db.select().from(adminPermissionSets).orderBy(asc(adminPermissionSets.name));
}

export async function upsertAdminPermissionSet(params: {
  actorUid: string;
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
}) {
  const id =
    (params.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '') || `set-${crypto.randomBytes(3).toString('hex')}`;
  const cleanPerms = Array.from(new Set(params.permissions.map((p) => String(p).trim()).filter(Boolean)));
  const [saved] = await db
    .insert(adminPermissionSets)
    .values({
      id,
      name: params.name.trim().slice(0, 60),
      description: (params.description || '').trim().slice(0, 200),
      permissions: cleanPerms,
      createdByUid: params.actorUid,
    })
    .onConflictDoUpdate({
      target: adminPermissionSets.id,
      set: {
        name: params.name.trim().slice(0, 60),
        description: (params.description || '').trim().slice(0, 200),
        permissions: cleanPerms,
        updatedAt: new Date(),
      },
    })
    .returning();
  return saved;
}

export async function assignAdminUserPermissions(params: {
  actorUid: string;
  targetUid: string;
  customPermissions: string[];
  permissionSetId?: string | null;
  expiresAt?: string | null;
  reason?: string;
}) {
  const cleanPerms = Array.from(new Set(params.customPermissions.map((p) => String(p).trim()).filter(Boolean)));
  const expiresAtDate = params.expiresAt ? new Date(params.expiresAt) : null;
  if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
    throw new Error('Invalid expiresAt timestamp.');
  }

  return db.transaction(async (tx) => {
    const [prevRow] = await tx
      .select()
      .from(adminUserPermissions)
      .where(eq(adminUserPermissions.userUid, params.targetUid));

    const [saved] = await tx
      .insert(adminUserPermissions)
      .values({
        userUid: params.targetUid,
        customPermissions: cleanPerms,
        permissionSetId: params.permissionSetId || null,
        expiresAt: expiresAtDate,
        grantedByUid: params.actorUid,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: adminUserPermissions.userUid,
        set: {
          customPermissions: cleanPerms,
          permissionSetId: params.permissionSetId || null,
          expiresAt: expiresAtDate,
          grantedByUid: params.actorUid,
          updatedAt: new Date(),
        },
      })
      .returning();

    await tx.insert(adminPermissionHistory).values({
      targetUid: params.targetUid,
      actorUid: params.actorUid,
      action: 'update_custom_permissions',
      previousPermissions: Array.isArray(prevRow?.customPermissions) ? prevRow.customPermissions : [],
      nextPermissions: cleanPerms,
      expiresAt: expiresAtDate,
      reason: params.reason?.trim() || 'Super Admin permission update',
    });

    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: 'super_admin',
      action: 'assign_custom_permissions',
      targetType: 'user',
      targetId: params.targetUid,
      details: {
        customPermissions: cleanPerms,
        permissionSetId: params.permissionSetId || null,
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
      },
    });

    return saved;
  });
}

export async function getAdminPermissionHistory(limit = 60) {
  const rows = await db
    .select()
    .from(adminPermissionHistory)
    .orderBy(desc(adminPermissionHistory.createdAt))
    .limit(limit);
  const uids = Array.from(new Set(rows.flatMap((r) => [r.targetUid, r.actorUid])));
  const uidMap = await mapUidsToPublicIds(uids);
  return rows.map((r) => ({
    ...r,
    targetPublicId: uidMap[r.targetUid] || r.targetUid,
    actorPublicId: uidMap[r.actorUid] || r.actorUid,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
  }));
}

export async function addUserAdminNote(params: {
  actorUid: string;
  actorName: string;
  targetIdentifier: string;
  note: string;
}) {
  const cleanNote = params.note.trim().slice(0, 500);
  if (!cleanNote) throw new Error('Note text is required.');
  const resolved = await resolveUserByUidOrPublicId(params.targetIdentifier);
  if (!resolved) throw new Error('User not found.');

  const [userRow] = await db
    .select({ adminNotes: users.adminNotes })
    .from(users)
    .where(eq(users.uid, resolved.uid));
  const currentNotes = Array.isArray(userRow?.adminNotes) ? userRow.adminNotes : [];
  const nextNotes = [
    {
      id: `NOTE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      note: cleanNote,
      authorUid: params.actorUid,
      authorName: params.actorName,
      createdAt: new Date().toISOString(),
    },
    ...currentNotes,
  ].slice(0, 50);

  await db
    .update(users)
    .set({ adminNotes: nextNotes, updatedAt: new Date() })
    .where(eq(users.uid, resolved.uid));
  return nextNotes;
}

export async function getAdminUserInspection(targetIdentifier: string) {
  const resolved = await resolveUserByUidOrPublicId(targetIdentifier);
  if (!resolved) return null;
  const targetUid = resolved.uid;
  const [[userRow], fullUser, walletTx, orders, subHistory, pointLedger, inventoryRows, permRow] =
    await Promise.all([
      db.select({ adminNotes: users.adminNotes, banReason: users.banReason }).from(users).where(eq(users.uid, targetUid)),
      getFullUserView(targetUid),
      db.select().from(walletTransactions).where(eq(walletTransactions.userUid, targetUid)).orderBy(desc(walletTransactions.createdAt)).limit(30),
      db.select().from(paymentOrders).where(eq(paymentOrders.userUid, targetUid)).orderBy(desc(paymentOrders.createdAt)).limit(20),
      db.select().from(vipSubscriptionHistory).where(eq(vipSubscriptionHistory.userUid, targetUid)).orderBy(desc(vipSubscriptionHistory.createdAt)).limit(25),
      db.select().from(vipPointLedger).where(eq(vipPointLedger.userUid, targetUid)).orderBy(desc(vipPointLedger.createdAt)).limit(40),
      db.select().from(userInventory).where(eq(userInventory.userUid, targetUid)),
      db.select().from(adminUserPermissions).where(eq(adminUserPermissions.userUid, targetUid)),
    ]);

  const effectivePerms = fullUser
    ? await getEffectiveAdminPermissions(targetUid, fullUser.role)
    : [];

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
    effectivePermissions: effectivePerms,
  };
}

// =========================================================================
// VOICE ROOM REOPEN & OFFICIAL ROOM SECURITY ENFORCEMENT
// =========================================================================
export function isAppAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function ensureOfficialRoomsSecurityState(
  roomIdsWithLiveAppAdmin?: Set<string>
): Promise<string[]> {
  const officialActiveRooms = await db
    .select({ id: voiceRooms.id })
    .from(voiceRooms)
    .where(and(eq(voiceRooms.isOfficial, true), eq(voiceRooms.status, 'active')));

  const closedIds: string[] = [];
  for (const r of officialActiveRooms) {
    if (roomIdsWithLiveAppAdmin?.has(r.id)) continue;
    await db
      .update(voiceRooms)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedReason: 'Waiting for an authorized App Admin to open this Official Room.',
        updatedAt: new Date(),
      })
      .where(eq(voiceRooms.id, r.id));
    closedIds.push(r.id);
  }
  return closedIds;
}

export async function reopenVoiceRoom(params: {
  roomId: string;
  actorUser: FullUserView;
}) {
  const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, params.roomId));
  if (!room) {
    const err = new Error('Voice room not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const actorIsAppAdmin = isAppAdminRole(params.actorUser.role);
  if (room.isOfficial) {
    if (!actorIsAppAdmin) {
      const err = new Error('Only authorized App Admins can open or reopen Official Rooms.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 403;
      throw err;
    }
  } else {
    const isOwnerOrRoomAdmin =
      room.ownerUid === params.actorUser.uid ||
      (Array.isArray(room.adminUids) && room.adminUids.includes(params.actorUser.uid)) ||
      actorIsAppAdmin;
    if (!isOwnerOrRoomAdmin) {
      const err = new Error('Only the room Owner or an authorized Room Admin can reopen this room.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 403;
      throw err;
    }
  }

  const [updated] = await db
    .update(voiceRooms)
    .set({
      status: 'active',
      closedAt: null,
      closedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(voiceRooms.id, room.id))
    .returning();

  await db.insert(auditLogs).values({
    actorUid: params.actorUser.uid,
    actorRole: params.actorUser.role,
    action: room.isOfficial ? 'official_room_opened' : 'voice_room_reopened',
    targetType: 'voice_room',
    targetId: room.id,
    details: { title: room.title, isOfficial: room.isOfficial },
  });

  const uidMap = await mapUidsToPublicIds([
    updated.ownerUid,
    ...(Array.isArray(updated.adminUids) ? updated.adminUids : []),
  ]);
  return serializeVoiceRoomForClient(updated, uidMap, 0);
}

// =========================================================================
// CUSTOM GIFT SUBMISSIONS & ADMIN APPROVAL QUEUE
// =========================================================================
export async function submitCustomGift(params: {
  creatorUid: string;
  name: string;
  cost: number;
  charmValue: number;
  rarity?: string;
  description: string;
  primaryColor?: string;
  secondaryColor?: string;
  particleStyle?: string;
  artworkUrl?: string | null;
  animationVideoUrl?: string | null;
  videoFileName?: string | null;
}) {
  const name = params.name.trim().slice(0, 60);
  const description = params.description.trim().slice(0, 240);
  const cost = Math.max(10, Math.min(1_000_000, Math.floor(Number(params.cost || 100))));
  const charmValue = Math.max(1, Math.min(2_000_000, Math.floor(Number(params.charmValue || cost * 2))));
  if (!name || !description) {
    throw new Error('Gift name and description are required.');
  }

  const rarity = ['Standard', 'Signature', 'Mythic'].includes(String(params.rarity || ''))
    ? String(params.rarity)
    : cost >= 1500
      ? 'Mythic'
      : cost >= 300
        ? 'Signature'
        : 'Standard';

  const id = `CG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const [created] = await db
    .insert(customGifts)
    .values({
      id,
      creatorUid: params.creatorUid,
      name,
      cost,
      charmValue,
      rarity,
      description,
      primaryColor: (params.primaryColor || '#A855F7').slice(0, 24),
      secondaryColor: (params.secondaryColor || '#38BDF8').slice(0, 24),
      particleStyle: (params.particleStyle || 'crown').slice(0, 24),
      artworkUrl:
        params.artworkUrl && isSafeMediaReference(params.artworkUrl) && params.artworkUrl.length <= 2_500_000
          ? params.artworkUrl.trim()
          : null,
      animationVideoUrl:
        params.animationVideoUrl &&
        isSafeMediaReference(params.animationVideoUrl, true) &&
        params.animationVideoUrl.length <= 5_000_000
          ? params.animationVideoUrl.trim()
          : null,
      videoFileName: params.videoFileName ? params.videoFileName.slice(0, 120) : null,
      status: 'pending',
    })
    .returning();

  return created;
}

export async function getUserCustomGifts(creatorUid: string) {
  const [rows, [creatorUser], [creatorProf]] = await Promise.all([
    db
      .select()
      .from(customGifts)
      .where(eq(customGifts.creatorUid, creatorUid))
      .orderBy(desc(customGifts.createdAt)),
    db.select({ publicId: users.publicId }).from(users).where(eq(users.uid, creatorUid)),
    db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.userUid, creatorUid)),
  ]);

  const creatorPublicId = creatorUser?.publicId || creatorUid;
  const creatorName = creatorProf?.displayName || 'Player';
  return rows.map((r) => ({
    ...r,
    creatorUid: creatorPublicId,
    creatorName,
    submittedAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  }));
}

export async function adminListCustomGifts(statusFilter?: string) {
  const rows = statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)
    ? await db
        .select()
        .from(customGifts)
        .where(eq(customGifts.status, statusFilter))
        .orderBy(desc(customGifts.createdAt))
        .limit(100)
    : await db.select().from(customGifts).orderBy(desc(customGifts.createdAt)).limit(100);

  const uidCandidates = rows.flatMap((r) => [r.creatorUid, r.reviewedByUid || '']).filter(Boolean);
  const uidMap = await mapUidsToPublicIds(uidCandidates);
  const profRows =
    uidCandidates.length > 0
      ? await db
          .select({ userUid: profiles.userUid, displayName: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userUid, Array.from(new Set(uidCandidates))))
      : [];
  const nameMap = new Map(profRows.map((p) => [p.userUid, p.displayName]));

  return rows.map((r) => ({
    ...r,
    creatorUid: uidMap[r.creatorUid] || r.creatorUid,
    creatorName: nameMap.get(r.creatorUid) || 'Player',
    reviewedByPublicId: r.reviewedByUid ? uidMap[r.reviewedByUid] || r.reviewedByUid : null,
    submittedAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  }));
}

export async function adminUpdateCustomGift(params: {
  id: string;
  actorUid: string;
  actorRole: AccountRole;
  updates: {
    name?: string;
    cost?: number;
    charmValue?: number;
    rarity?: string;
    description?: string;
    primaryColor?: string;
    secondaryColor?: string;
    particleStyle?: string;
    artworkUrl?: string | null;
  };
}) {
  const [existing] = await db.select().from(customGifts).where(eq(customGifts.id, params.id));
  if (!existing) throw new Error('Custom gift submission not found.');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof params.updates.name === 'string' && params.updates.name.trim()) {
    patch.name = params.updates.name.trim().slice(0, 60);
  }
  if (typeof params.updates.cost === 'number' && Number.isFinite(params.updates.cost)) {
    patch.cost = Math.max(10, Math.min(1_000_000, Math.floor(params.updates.cost)));
  }
  if (typeof params.updates.charmValue === 'number' && Number.isFinite(params.updates.charmValue)) {
    patch.charmValue = Math.max(1, Math.min(2_000_000, Math.floor(params.updates.charmValue)));
  }
  if (typeof params.updates.rarity === 'string' && ['Standard', 'Signature', 'Mythic'].includes(params.updates.rarity)) {
    patch.rarity = params.updates.rarity;
  }
  if (typeof params.updates.description === 'string' && params.updates.description.trim()) {
    patch.description = params.updates.description.trim().slice(0, 240);
  }
  if (typeof params.updates.primaryColor === 'string' && params.updates.primaryColor.trim()) {
    patch.primaryColor = params.updates.primaryColor.trim().slice(0, 24);
  }
  if (typeof params.updates.secondaryColor === 'string' && params.updates.secondaryColor.trim()) {
    patch.secondaryColor = params.updates.secondaryColor.trim().slice(0, 24);
  }
  if (typeof params.updates.particleStyle === 'string' && params.updates.particleStyle.trim()) {
    patch.particleStyle = params.updates.particleStyle.trim().slice(0, 24);
  }
  if (params.updates.artworkUrl !== undefined) {
    const rawArt = params.updates.artworkUrl ? String(params.updates.artworkUrl).trim() : '';
    patch.artworkUrl = rawArt && isSafeMediaReference(rawArt) && rawArt.length <= 2_500_000 ? rawArt : null;
  }

  const [updated] = await db
    .update(customGifts)
    .set(patch)
    .where(eq(customGifts.id, params.id))
    .returning();

  // If already approved in catalog, sync edits to live gifts catalog too
  if (updated.approvedGiftId) {
    await db
      .update(gifts)
      .set({
        name: updated.name,
        cost: updated.cost,
        charmValue: updated.charmValue,
        rarity: updated.rarity,
        description: updated.description,
        primaryColor: updated.primaryColor,
        secondaryColor: updated.secondaryColor,
        particleStyle: updated.particleStyle,
        artworkUrl: updated.artworkUrl,
        updatedAt: new Date(),
      })
      .where(eq(gifts.id, updated.approvedGiftId));
  }

  await db.insert(auditLogs).values({
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    action: 'admin_edit_custom_gift',
    targetType: 'custom_gift',
    targetId: updated.id,
    details: patch,
  });

  return updated;
}

export async function adminApproveCustomGift(params: {
  id: string;
  actorUid: string;
  actorRole: AccountRole;
  reviewNote?: string;
  cost?: number;
  charmValue?: number;
  rarity?: string;
  name?: string;
  description?: string;
}) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(customGifts)
      .where(eq(customGifts.id, params.id))
      .for('update');
    if (!sub) throw new Error('Custom gift submission not found.');

    const resolvedName =
      typeof params.name === 'string' && params.name.trim() ? params.name.trim().slice(0, 60) : sub.name;
    const resolvedCost =
      typeof params.cost === 'number' && Number.isFinite(params.cost)
        ? Math.max(10, Math.min(1_000_000, Math.floor(params.cost)))
        : sub.cost;
    const resolvedCharm =
      typeof params.charmValue === 'number' && Number.isFinite(params.charmValue)
        ? Math.max(1, Math.min(2_000_000, Math.floor(params.charmValue)))
        : sub.charmValue;
    const resolvedRarity =
      typeof params.rarity === 'string' && ['Standard', 'Signature', 'Mythic'].includes(params.rarity)
        ? params.rarity
        : sub.rarity;
    const resolvedDescription =
      typeof params.description === 'string' && params.description.trim()
        ? params.description.trim().slice(0, 240)
        : sub.description;

    const giftId = sub.approvedGiftId || `gift-cg-${sub.id.toLowerCase()}`;
    const maxGiftRow = await tx
      .select({ maxNum: sql<number>`COALESCE(MAX(${gifts.giftNumber}), 900)` })
      .from(gifts);
    const nextGiftNumber = Math.max(901, Number(maxGiftRow[0]?.maxNum ?? 900) + 1);
    const randomCoinsMin = Math.max(5, Math.round(resolvedCost * 0.08));
    const randomCoinsMax = Math.max(15, Math.round(resolvedCost * 0.2));

    const [approvedGift] = await tx
      .insert(gifts)
      .values({
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
        updatedAt: now,
      })
      .onConflictDoUpdate({
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
          updatedAt: now,
        },
      })
      .returning();

    const [updatedSub] = await tx
      .update(customGifts)
      .set({
        name: resolvedName,
        cost: resolvedCost,
        charmValue: resolvedCharm,
        rarity: resolvedRarity,
        description: resolvedDescription,
        status: 'approved',
        approvedGiftId: giftId,
        reviewedByUid: params.actorUid,
        reviewNote: params.reviewNote?.trim() || 'Approved for OG VELOCITY Gift Store',
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(customGifts.id, sub.id))
      .returning();

    await tx.insert(notifications).values({
      userUid: sub.creatorUid,
      type: 'gift',
      title: 'Custom Gift Approved!',
      body: `Your custom gift "${resolvedName}" was approved by Admin and is now live in the Gift Store.`,
    });

    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'admin_approve_custom_gift',
      targetType: 'custom_gift',
      targetId: sub.id,
      details: { approvedGiftId: giftId, name: resolvedName, cost: resolvedCost },
    });

    return { submission: updatedSub, catalogGiftId: giftId, gift: approvedGift };
  });
}

export async function adminRejectCustomGift(params: {
  id: string;
  actorUid: string;
  actorRole: AccountRole;
  reviewNote?: string;
}) {
  const now = new Date();
  const note = (params.reviewNote || '').trim() || 'Declined during Admin gift review.';
  return db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(customGifts)
      .where(eq(customGifts.id, params.id))
      .for('update');
    if (!sub) throw new Error('Custom gift submission not found.');

    if (sub.approvedGiftId) {
      await tx.update(gifts).set({ active: false, updatedAt: now }).where(eq(gifts.id, sub.approvedGiftId));
    }

    const [updated] = await tx
      .update(customGifts)
      .set({
        status: 'rejected',
        reviewedByUid: params.actorUid,
        reviewNote: note,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(customGifts.id, sub.id))
      .returning();

    await tx.insert(notifications).values({
      userUid: sub.creatorUid,
      type: 'gift',
      title: 'Custom Gift Not Approved',
      body: `Your gift submission "${sub.name}" was not approved: ${note}`,
    });

    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'admin_reject_custom_gift',
      targetType: 'custom_gift',
      targetId: sub.id,
      details: { reason: note },
    });

    return updated;
  });
}

// =========================================================================
// ADMIN-MANAGED SHOP ITEMS CRUD (Rings, Frames, Entry FX, Seat FX, Themes)
// =========================================================================
export async function listShopItems(includeInactive = false) {
  await ensureSeedData();
  const rows = includeInactive
    ? await db.select().from(shopItems).orderBy(asc(shopItems.sortOrder), asc(shopItems.id))
    : await db
        .select()
        .from(shopItems)
        .where(eq(shopItems.active, true))
        .orderBy(asc(shopItems.sortOrder), asc(shopItems.id));
  return rows.map((r) => ({
    ...r,
    priceCoins: Number(r.priceCoins),
    durationDays: r.durationDays ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    ringNumber: r.ringNumber ?? undefined,
    seatFrameNumber: r.seatFrameNumber ?? undefined,
    styleVariant: r.styleVariant ?? undefined,
  }));
}

export async function upsertShopItem(params: {
  actorUid: string;
  actorRole: AccountRole;
  item: {
    id?: string;
    name: string;
    category: string;
    description?: string;
    priceCoins: number;
    durationDays?: number | null;
    imageUrl?: string | null;
    previewColor?: string;
    ringNumber?: number | null;
    seatFrameNumber?: number | null;
    styleVariant?: string | null;
    active?: boolean;
    sortOrder?: number;
  };
}) {
  await ensureSeedData();
  const name = String(params.item.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Item name is required.');
  const allowedCategories = new Set(['ring', 'frame', 'bubble', 'entry', 'seat-fx', 'room-theme']);
  const category = allowedCategories.has(params.item.category) ? params.item.category : 'ring';
  const priceCoins = Math.max(0, Math.floor(Number(params.item.priceCoins ?? 100000)));
  const durationDays =
    params.item.durationDays === null || params.item.durationDays === undefined || Number(params.item.durationDays) <= 0
      ? null
      : Math.max(1, Math.min(3650, Math.floor(Number(params.item.durationDays))));

  let imageUrl = params.item.imageUrl ? String(params.item.imageUrl).trim() : null;
  if (imageUrl) {
    if (!isSafeMediaReference(imageUrl) || imageUrl.length > 1_200_000) {
      throw new Error('Item image must be a valid uploaded media asset, HTTPS URL, or image under 1.2MB.');
    }
  }

  let ringNumber = params.item.ringNumber ? Math.max(1, Math.floor(Number(params.item.ringNumber))) : null;
  let seatFrameNumber = params.item.seatFrameNumber
    ? Math.max(1, Math.floor(Number(params.item.seatFrameNumber)))
    : null;

  if (category === 'ring' && !ringNumber) {
    const maxRow = await db
      .select({ maxN: sql<number>`COALESCE(MAX(${shopItems.ringNumber}), 20)` })
      .from(shopItems)
      .where(eq(shopItems.category, 'ring'));
    ringNumber = Number(maxRow[0]?.maxN ?? 20) + 1;
  }
  if (category === 'frame' && !seatFrameNumber) {
    const maxRow = await db
      .select({ maxN: sql<number>`COALESCE(MAX(${shopItems.seatFrameNumber}), 20)` })
      .from(shopItems)
      .where(eq(shopItems.category, 'frame'));
    seatFrameNumber = Number(maxRow[0]?.maxN ?? 20) + 1;
  }

  const cleanedId = String(params.item.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '');
  const id = cleanedId || `${category}-${crypto.randomBytes(4).toString('hex')}`;
  const previewColor = String(params.item.previewColor || '#38BDF8').trim().slice(0, 24);
  const description = String(params.item.description || '').trim().slice(0, 240);
  const active = params.item.active !== false;
  const sortOrder = Number.isFinite(Number(params.item.sortOrder))
    ? Math.floor(Number(params.item.sortOrder))
    : 100;

  const [saved] = await db
    .insert(shopItems)
    .values({
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
      sortOrder,
    })
    .onConflictDoUpdate({
      target: shopItems.id,
      set: {
        name,
        category,
        description,
        priceCoins,
        durationDays,
        imageUrl: params.item.imageUrl !== undefined ? imageUrl : sql`${shopItems.imageUrl}`,
        previewColor,
        ringNumber,
        seatFrameNumber,
        styleVariant: params.item.styleVariant ?? null,
        active,
        sortOrder,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db.insert(auditLogs).values({
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    action: 'upsert_shop_item',
    targetType: 'shop_item',
    targetId: saved.id,
    details: { name: saved.name, category: saved.category, priceCoins: Number(saved.priceCoins), active: saved.active },
  });

  return {
    ...saved,
    priceCoins: Number(saved.priceCoins),
    durationDays: saved.durationDays ?? undefined,
    imageUrl: saved.imageUrl ?? undefined,
    ringNumber: saved.ringNumber ?? undefined,
    seatFrameNumber: saved.seatFrameNumber ?? undefined,
    styleVariant: saved.styleVariant ?? undefined,
  };
}

export async function deleteShopItem(params: {
  actorUid: string;
  actorRole: AccountRole;
  id: string;
}) {
  const [deleted] = await db.delete(shopItems).where(eq(shopItems.id, params.id)).returning();
  if (!deleted) throw new Error('Shop item not found.');
  await db.insert(auditLogs).values({
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    action: 'delete_shop_item',
    targetType: 'shop_item',
    targetId: params.id,
    details: { name: deleted.name, category: deleted.category },
  });
  return deleted;
}

// =========================================================================
// GRANULAR USER BANS (Complete ID, Microphone, Voice Seat, Chat)
// =========================================================================
export async function getActiveUserBans(userUid: string): Promise<ActiveBanView[]> {
  const rows = await db
    .select()
    .from(userBans)
    .where(and(eq(userBans.userUid, userUid), eq(userBans.active, true)))
    .orderBy(desc(userBans.createdAt));

  const now = Date.now();
  const active: ActiveBanView[] = [];
  const expiredCompleteIds: number[] = [];

  for (const row of rows) {
    if (row.expiresAt && row.expiresAt.getTime() <= now) {
      await db
        .update(userBans)
        .set({ active: false, revokedAt: new Date(), revokedByUid: 'system-expiry' })
        .where(eq(userBans.id, row.id))
        .catch(() => {});
      if (row.banType === 'complete') expiredCompleteIds.push(row.id);
      continue;
    }
    active.push({
      id: row.id,
      banType: row.banType as BanType,
      durationDays: row.durationDays,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    });
  }

  if (expiredCompleteIds.length > 0 && !active.some((b) => b.banType === 'complete')) {
    await db
      .update(users)
      .set({ accountStatus: 'active', banReason: null, updatedAt: new Date() })
      .where(and(eq(users.uid, userUid), eq(users.accountStatus, 'banned')))
      .catch(() => {});
  }

  return active;
}

export async function assertUserNotBanned(userUid: string, types: BanType[]): Promise<void> {
  const activeBans = await getActiveUserBans(userUid);
  const hit = activeBans.find((b) => b.banType === 'complete' || types.includes(b.banType));
  if (!hit) return;
  const label =
    hit.banType === 'complete'
      ? 'Account banned'
      : hit.banType === 'mic'
        ? 'Microphone banned'
        : hit.banType === 'seat'
          ? 'Voice Room Seat banned'
          : 'Chat banned';
  const durationMsg = hit.expiresAt
    ? `until ${new Date(hit.expiresAt).toLocaleDateString()}`
    : 'permanently';
  throw new Error(`${label} ${durationMsg}: ${hit.reason}`);
}

export async function createUserBan(params: {
  actorUid: string;
  actorRole: AccountRole;
  targetIdentifier: string;
  banType: BanType;
  durationDays?: number | null; // null or <= 0 => permanent
  reason: string;
}) {
  const allowed: BanType[] = ['complete', 'mic', 'seat', 'chat'];
  if (!allowed.includes(params.banType)) {
    throw new Error('Invalid ban type. Use complete, mic, seat, or chat.');
  }
  const resolved = await resolveUserByUidOrPublicId(params.targetIdentifier);
  if (!resolved) throw new Error('Target user not found.');
  if (resolved.uid === params.actorUid) throw new Error('Cannot ban your own account.');
  if (resolved.role === 'super_admin' && params.actorRole !== 'super_admin') {
    throw new Error('Cannot ban Super Admin.');
  }

  const cleanReason = params.reason.trim().slice(0, 240) || 'Policy violation';
  const daysNum =
    params.durationDays === null || params.durationDays === undefined || Number(params.durationDays) <= 0
      ? null
      : Math.max(1, Math.min(3650, Math.floor(Number(params.durationDays))));
  const expiresAt = daysNum ? new Date(Date.now() + daysNum * 86_400_000) : null;

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(userBans)
      .values({
        userUid: resolved.uid,
        banType: params.banType,
        durationDays: daysNum,
        expiresAt,
        reason: cleanReason,
        bannedByUid: params.actorUid,
        active: true,
      })
      .returning();

    if (params.banType === 'complete') {
      await tx
        .update(users)
        .set({ accountStatus: 'banned', banReason: cleanReason, updatedAt: new Date() })
        .where(eq(users.uid, resolved.uid));
    }

    await tx.insert(notifications).values({
      userUid: resolved.uid,
      type: 'system',
      title: `Account Restriction Applied (${params.banType.toUpperCase()})`,
      body: `${params.banType.toUpperCase()} ban applied ${daysNum ? `for ${daysNum} day(s)` : 'permanently'}: ${cleanReason}`,
    });

    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: `ban_user_${params.banType}`,
      targetType: 'user',
      targetId: resolved.uid,
      details: { banType: params.banType, durationDays: daysNum, reason: cleanReason, banId: row.id },
    });

    return row;
  });

  return { ban: created, targetUid: resolved.uid, targetPublicId: resolved.publicId };
}

export async function revokeUserBan(params: {
  actorUid: string;
  actorRole: AccountRole;
  banId: number;
}) {
  const [ban] = await db.select().from(userBans).where(eq(userBans.id, params.banId));
  if (!ban) throw new Error('Ban record not found.');

  await db.transaction(async (tx) => {
    await tx
      .update(userBans)
      .set({ active: false, revokedByUid: params.actorUid, revokedAt: new Date() })
      .where(eq(userBans.id, ban.id));

    if (ban.banType === 'complete') {
      const remaining = await tx
        .select({ id: userBans.id })
        .from(userBans)
        .where(
          and(
            eq(userBans.userUid, ban.userUid),
            eq(userBans.banType, 'complete'),
            eq(userBans.active, true)
          )
        );
      if (remaining.length === 0) {
        await tx
          .update(users)
          .set({ accountStatus: 'active', banReason: null, updatedAt: new Date() })
          .where(eq(users.uid, ban.userUid));
      }
    }

    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: `revoke_ban_${ban.banType}`,
      targetType: 'user',
      targetId: ban.userUid,
      details: { banId: ban.id },
    });
  });

  return ban;
}

export async function listUserBans(params?: { userUid?: string; activeOnly?: boolean }) {
  const conds = [];
  if (params?.userUid) conds.push(eq(userBans.userUid, params.userUid));
  if (params?.activeOnly) conds.push(eq(userBans.active, true));

  const rows =
    conds.length > 0
      ? await db.select().from(userBans).where(and(...conds)).orderBy(desc(userBans.createdAt)).limit(100)
      : await db.select().from(userBans).orderBy(desc(userBans.createdAt)).limit(100);

  const allUids = Array.from(new Set(rows.flatMap((r) => [r.userUid, r.bannedByUid])));
  const uidMap = await mapUidsToPublicIds(allUids);
  const profRows =
    allUids.length > 0
      ? await db
          .select({ userUid: profiles.userUid, displayName: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userUid, allUids))
      : [];
  const nameMap = new Map(profRows.map((p) => [p.userUid, p.displayName]));

  return rows.map((r) => ({
    ...r,
    userPublicId: uidMap[r.userUid] || r.userUid,
    userName: nameMap.get(r.userUid) || 'Player',
    bannedByPublicId: uidMap[r.bannedByUid] || r.bannedByUid,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

// =========================================================================
// INVITE FRIENDS REFERRAL REWARDS (+25,000 Coins Each)
// =========================================================================
export async function getReferralSummaryForUser(userUid: string) {
  const [[selfUser], rows] = await Promise.all([
    db.select({ publicId: users.publicId, referredByUid: users.referredByUid }).from(users).where(eq(users.uid, userUid)),
    db.select().from(referrals).where(eq(referrals.inviterUid, userUid)).orderBy(desc(referrals.createdAt)).limit(50),
  ]);

  const invitedUids = rows.map((r) => r.invitedUid);
  const allLookupUids = selfUser?.referredByUid ? [...invitedUids, selfUser.referredByUid] : invitedUids;
  const uidMap = await mapUidsToPublicIds(allLookupUids);
  const profRows =
    invitedUids.length > 0
      ? await db
          .select({ userUid: profiles.userUid, displayName: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userUid, invitedUids))
      : [];
  const nameMap = new Map(profRows.map((p) => [p.userUid, p.displayName]));

  return {
    inviteCode: selfUser?.publicId || '',
    rewardCoins: REFERRAL_REWARD_COINS,
    referredByPublicId: selfUser?.referredByUid ? (uidMap[selfUser.referredByUid] || null) : null,
    totalInvited: rows.length,
    totalEarnedCoins: rows.reduce((sum, r) => sum + Number(r.rewardCoins || 0), 0),
    referrals: rows.map((r) => ({
      id: r.id,
      invitedPublicId: uidMap[r.invitedUid] || r.invitedUid,
      invitedName: nameMap.get(r.invitedUid) || 'OG Player',
      rewardCoins: Number(r.rewardCoins || REFERRAL_REWARD_COINS),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function claimReferralCodeAtomic(params: { invitedUid: string; inviteCode: string }) {
  const cleanCode = String(params.inviteCode || '').trim().replace(/^#/, '');
  if (!cleanCode) throw new Error('Referral code is required.');

  const inviter = await resolveUserByUidOrPublicId(cleanCode);
  if (!inviter) throw new Error('Invalid invite code. Inviter User ID not found.');
  if (inviter.uid === params.invitedUid) {
    throw new Error('You cannot claim your own referral invite code.');
  }
  if (inviter.accountStatus !== 'active') {
    throw new Error('Inviter account is not active.');
  }

  return db.transaction(async (tx) => {
    const orderedUids = [inviter.uid, params.invitedUid].sort();
    const lockedUsers = await tx
      .select({ uid: users.uid, publicId: users.publicId, referredByUid: users.referredByUid })
      .from(users)
      .where(inArray(users.uid, orderedUids))
      .orderBy(asc(users.uid))
      .for('update');

    const invitedUser = lockedUsers.find((u) => u.uid === params.invitedUid);
    if (!invitedUser) throw new Error('Your account could not be verified.');

    const existingRef = await tx
      .select({ id: referrals.id })
      .from(referrals)
      .where(eq(referrals.invitedUid, params.invitedUid))
      .limit(1);

    if (invitedUser.referredByUid || existingRef.length > 0) {
      throw new Error('Referral invite reward has already been claimed on your account.');
    }

    const reward = REFERRAL_REWARD_COINS;

    await tx
      .insert(referrals)
      .values({
        inviterUid: inviter.uid,
        invitedUid: params.invitedUid,
        inviteCode: inviter.publicId,
        rewardCoins: reward,
      });

    await tx
      .update(users)
      .set({ referredByUid: inviter.uid, updatedAt: new Date() })
      .where(eq(users.uid, params.invitedUid));

    const walletRows = await tx
      .select()
      .from(wallets)
      .where(inArray(wallets.userUid, orderedUids))
      .orderBy(asc(wallets.userUid))
      .for('update');

    const now = new Date();
    const updatedCoinsMap: Record<string, number> = {};

    for (const targetUid of orderedUids) {
      const existingWallet = walletRows.find((w) => w.userUid === targetUid);
      const nextCoins = Number(existingWallet?.coins ?? 0) + reward;
      updatedCoinsMap[targetUid] = nextCoins;
      if (existingWallet) {
        await tx
          .update(wallets)
          .set({ coins: nextCoins, updatedAt: now })
          .where(eq(wallets.userUid, targetUid));
      } else {
        await tx.insert(wallets).values({ userUid: targetUid, coins: nextCoins });
      }
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        userUid: targetUid,
        type: 'referral_reward',
        amount: reward,
        balanceAfter: nextCoins,
        referenceType: 'referral',
        referenceId: `${inviter.publicId}->${invitedUser.publicId}`,
        idempotencyKey: `ref:${targetUid}:${params.invitedUid}`,
        description:
          targetUid === inviter.uid
            ? `Friend invite bonus for inviting ${invitedUser.publicId}`
            : `Welcome invite bonus from ${inviter.publicId}`,
      });
    }

    await tx.insert(notifications).values([
      {
        userUid: inviter.uid,
        type: 'friend',
        title: '+25,000 Referral Coins Credited!',
        body: `Your invited friend (${invitedUser.publicId}) claimed your invite link! +25,000 coins added to your wallet.`,
      },
      {
        userUid: params.invitedUid,
        type: 'friend',
        title: '+25,000 Invite Welcome Bonus!',
        body: `Referral code ${inviter.publicId} verified! +25,000 coins added to your wallet.`,
      },
    ]);

    return {
      rewardCoins: reward,
      inviterUid: inviter.uid,
      inviterPublicId: inviter.publicId,
      inviterCoins: updatedCoinsMap[inviter.uid],
      invitedCoins: updatedCoinsMap[params.invitedUid],
    };
  });
}

// =========================================================================
// WITHDRAWAL REQUESTS & WALLET FREEZE (USER + ADMIN BANKING)
// =========================================================================
export const MIN_WITHDRAWAL_COINS = 10_000;

function parsePayoutDetails(raw: string | null | undefined): {
  upiOrAccount: string;
  ifscOrBank: string | null;
} {
  const parts = String(raw || '').split(' | ');
  return {
    upiOrAccount: (parts[0] || '').trim(),
    ifscOrBank: parts[1] ? parts[1].trim() : null,
  };
}

export async function createWithdrawalRequestAtomic(params: {
  userUid: string;
  amountCoins: number;
  payoutMethod: 'upi' | 'bank';
  accountHolderName: string;
  upiOrAccount: string;
  ifscOrBank?: string;
}) {
  const amountCoins = Math.floor(Number(params.amountCoins || 0));
  if (!Number.isFinite(amountCoins) || amountCoins < MIN_WITHDRAWAL_COINS) {
    throw new Error(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_COINS.toLocaleString()} coins.`);
  }
  const holder = String(params.accountHolderName || '').trim().slice(0, 80);
  const destination = String(params.upiOrAccount || '').trim().slice(0, 120);
  const ifscOrBank = params.ifscOrBank ? String(params.ifscOrBank).trim().slice(0, 80) : null;
  if (holder.length < 2 || destination.length < 4) {
    throw new Error('Account holder name and UPI ID / Bank account number are required.');
  }
  const payoutMethod = params.payoutMethod === 'bank' ? 'bank' : 'upi';
  const amountInr = Math.max(1, Math.floor(amountCoins / 100)); // 100 coins = ₹1 conversion baseline
  const upiOrBankDetails = ifscOrBank ? `${destination} | ${ifscOrBank}` : destination;
  const requestId = `WDR-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const now = new Date();

  return db.transaction(async (tx) => {
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userUid, params.userUid)).for('update');
    if (wallet?.isFrozen) {
      throw new Error('Your wallet is currently frozen. Withdrawals are suspended.');
    }
    if (!wallet || Number(wallet.coins) < amountCoins) {
      throw new Error('INSUFFICIENT_COINS');
    }

    const nextCoins = Number(wallet.coins) - amountCoins;
    await tx
      .update(wallets)
      .set({ coins: nextCoins, updatedAt: now })
      .where(eq(wallets.userUid, params.userUid));

    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      userUid: params.userUid,
      type: 'withdrawal_hold',
      amount: -amountCoins,
      balanceAfter: nextCoins,
      referenceType: 'withdrawal',
      referenceId: requestId,
      idempotencyKey: `wdr-hold-${requestId}`,
      description: `Withdrawal request ${requestId} (${payoutMethod.toUpperCase()} · ${holder})`,
    });

    const [created] = await tx
      .insert(withdrawalRequests)
      .values({
        requestId,
        userUid: params.userUid,
        coinsAmount: amountCoins,
        inrAmount: amountInr,
        payoutMethod,
        accountHolderName: holder,
        upiOrBankDetails,
        status: 'pending',
      })
      .returning();

    await tx.insert(notifications).values({
      userUid: params.userUid,
      type: 'payment',
      title: 'Withdrawal Request Submitted',
      body: `Withdrawal ${requestId} for ${amountCoins.toLocaleString()} coins (₹${amountInr}) is pending Admin review.`,
      metadata: { requestId, amountCoins, amountInr },
    });

    return {
      request: {
        ...created,
        amountCoins: Number(created.coinsAmount),
        amountInr: Number(created.inrAmount),
        upiOrAccount: destination,
        ifscOrBank,
        createdAt: created.createdAt.toISOString(),
        reviewedAt: created.reviewedAt ? created.reviewedAt.toISOString() : null,
      },
      coins: nextCoins,
    };
  });
}

export async function listUserWithdrawals(userUid: string) {
  const rows = await db
    .select()
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.userUid, userUid))
    .orderBy(desc(withdrawalRequests.createdAt))
    .limit(40);
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
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    };
  });
}

export async function adminListWithdrawals(statusFilter?: string) {
  const rows = statusFilter && ['pending', 'approved', 'completed', 'rejected'].includes(statusFilter)
    ? await db
        .select({
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
          reviewedAt: withdrawalRequests.reviewedAt,
        })
        .from(withdrawalRequests)
        .leftJoin(users, eq(withdrawalRequests.userUid, users.uid))
        .leftJoin(profiles, eq(withdrawalRequests.userUid, profiles.userUid))
        .leftJoin(wallets, eq(withdrawalRequests.userUid, wallets.userUid))
        .where(eq(withdrawalRequests.status, statusFilter))
        .orderBy(desc(withdrawalRequests.createdAt))
        .limit(100)
    : await db
        .select({
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
          reviewedAt: withdrawalRequests.reviewedAt,
        })
        .from(withdrawalRequests)
        .leftJoin(users, eq(withdrawalRequests.userUid, users.uid))
        .leftJoin(profiles, eq(withdrawalRequests.userUid, profiles.userUid))
        .leftJoin(wallets, eq(withdrawalRequests.userUid, wallets.userUid))
        .orderBy(desc(withdrawalRequests.createdAt))
        .limit(100);

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
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    };
  });
}

export async function adminReviewWithdrawalAtomic(params: {
  adminUid: string;
  adminRole: AccountRole;
  requestId: string;
  action: 'approve' | 'complete' | 'reject';
  reviewNote?: string;
}) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [reqRow] = await tx
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.requestId, params.requestId))
      .for('update');
    if (!reqRow) throw new Error('Withdrawal request not found.');
    if (reqRow.status === 'rejected' || reqRow.status === 'completed') {
      throw new Error(`Withdrawal already finalized as ${reqRow.status}.`);
    }

    const nextStatus =
      params.action === 'reject' ? 'rejected' : params.action === 'complete' ? 'completed' : 'approved';
    const note =
      params.reviewNote?.trim() ||
      (nextStatus === 'rejected'
        ? 'Rejected by Admin · Coins refunded'
        : nextStatus === 'completed'
          ? 'Payout completed'
          : 'Approved for payout');

    const [updated] = await tx
      .update(withdrawalRequests)
      .set({
        status: nextStatus,
        reviewedByUid: params.adminUid,
        reviewNote: note,
        reviewedAt: now,
      })
      .where(eq(withdrawalRequests.requestId, params.requestId))
      .returning();

    const coinsVal = Number(reqRow.coinsAmount);
    const inrVal = Number(reqRow.inrAmount);

    if (nextStatus === 'rejected') {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userUid, reqRow.userUid))
        .for('update');
      const nextCoins = Number(wallet?.coins ?? 0) + coinsVal;
      await tx
        .update(wallets)
        .set({ coins: nextCoins, updatedAt: now })
        .where(eq(wallets.userUid, reqRow.userUid));
      await tx.insert(walletTransactions).values({
        txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        userUid: reqRow.userUid,
        type: 'withdrawal_refund',
        amount: coinsVal,
        balanceAfter: nextCoins,
        referenceType: 'withdrawal',
        referenceId: reqRow.requestId,
        idempotencyKey: `wdr-refund-${reqRow.requestId}`,
        description: `Withdrawal rejected (${reqRow.requestId}) · Coins refunded`,
        actorUid: params.adminUid,
      });
    }

    await tx.insert(notifications).values({
      userUid: reqRow.userUid,
      type: 'payment',
      title: `Withdrawal ${nextStatus.toUpperCase()}`,
      body:
        nextStatus === 'rejected'
          ? `Withdrawal ${reqRow.requestId} was rejected (${note}). ${coinsVal.toLocaleString()} coins refunded.`
          : `Withdrawal ${reqRow.requestId} (${coinsVal.toLocaleString()} coins / ₹${inrVal}) is now ${nextStatus}.`,
      metadata: { requestId: reqRow.requestId, status: nextStatus },
    });

    await tx.insert(auditLogs).values({
      actorUid: params.adminUid,
      actorRole: params.adminRole,
      action: `withdrawal_${nextStatus}`,
      targetType: 'withdrawal',
      targetId: reqRow.requestId,
      details: { targetUid: reqRow.userUid, amountCoins: coinsVal, note },
    });

    const parsed = parsePayoutDetails(updated.upiOrBankDetails);
    return {
      ...updated,
      amountCoins: Number(updated.coinsAmount),
      amountInr: Number(updated.inrAmount),
      upiOrAccount: parsed.upiOrAccount,
      ifscOrBank: parsed.ifscOrBank,
    };
  });
}

export async function adminToggleWalletFreeze(params: {
  actorUid: string;
  actorRole: AccountRole;
  targetIdentifier: string;
  freeze: boolean;
  reason?: string;
}) {
  const resolved = await resolveUserByUidOrPublicId(params.targetIdentifier);
  if (!resolved) throw new Error('Target user not found.');
  const now = new Date();
  const cleanReason = (params.reason || '').trim().slice(0, 200) || (params.freeze ? 'Admin security hold' : 'Wallet unfrozen');

  await db.transaction(async (tx) => {
    await tx
      .update(wallets)
      .set({ isFrozen: params.freeze, updatedAt: now })
      .where(eq(wallets.userUid, resolved.uid));

    await tx.insert(notifications).values({
      userUid: resolved.uid,
      type: 'system',
      title: params.freeze ? 'Wallet Frozen' : 'Wallet Unfrozen',
      body: params.freeze
        ? `Your coin wallet has been frozen by Admin: ${cleanReason}`
        : 'Your coin wallet has been unfrozen and normal transactions are restored.',
    });

    await tx.insert(auditLogs).values({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: params.freeze ? 'freeze_wallet' : 'unfreeze_wallet',
      targetType: 'wallet',
      targetId: resolved.uid,
      details: { publicId: resolved.publicId, freeze: params.freeze, reason: cleanReason },
    });
  });

  return { uid: resolved.uid, publicId: resolved.publicId, isFrozen: params.freeze };
}

// =========================================================================
// RELATIONSHIP TAGS (Lv.1-Lv.10 PROGRESSION · Bro/Sister/Soulmate/CP Partner/Confident)
// =========================================================================
export async function getUserRelationshipTags(
  uid: string,
  opts?: { activeOnly?: boolean }
): Promise<RelationshipTagSummary[]> {
  const conds = [or(eq(relationshipTags.userAUid, uid), eq(relationshipTags.userBUid, uid))];
  if (opts?.activeOnly) conds.push(eq(relationshipTags.status, 'active'));
  else conds.push(or(eq(relationshipTags.status, 'active'), eq(relationshipTags.status, 'pending')));

  const [rows, activeCpRows] = await Promise.all([
    db
      .select()
      .from(relationshipTags)
      .where(and(...conds))
      .orderBy(desc(relationshipTags.charmScore), desc(relationshipTags.createdAt))
      .limit(40),
    db
      .select()
      .from(cpRelationships)
      .where(
        and(
          eq(cpRelationships.status, 'active'),
          or(eq(cpRelationships.userAUid, uid), eq(cpRelationships.userBUid, uid))
        )
      )
      .limit(1),
  ]);

  // Official Lover Tag derives automatically from active CP Partnership (no stale/duplicate manual lover rows)
  const nonLoverRows = rows.filter(
    (r) => r.tagType !== 'lover' && r.tagType !== 'cp_partner'
  );
  const activeCp = activeCpRows[0];
  const cpPartnerInternalUid = activeCp
    ? activeCp.userAUid === uid
      ? activeCp.userBUid
      : activeCp.userAUid
    : null;

  const otherUids = Array.from(
    new Set([
      ...nonLoverRows.map((r) => (r.userAUid === uid ? r.userBUid : r.userAUid)),
      ...(cpPartnerInternalUid ? [cpPartnerInternalUid] : []),
    ])
  );
  if (otherUids.length === 0) return [];

  const partnerRows = await db
    .select({
      uid: users.uid,
      publicId: users.publicId,
      name: profiles.displayName,
      photoUrl: profiles.photoUrl,
    })
    .from(users)
    .leftJoin(profiles, eq(users.uid, profiles.userUid))
    .where(inArray(users.uid, otherUids));

  const map = new Map(partnerRows.map((p) => [p.uid, p]));
  const result: RelationshipTagSummary[] = [];

  if (activeCp && cpPartnerInternalUid) {
    const partner = map.get(cpPartnerInternalUid);
    const cpCharm = Number(activeCp.cpCharm ?? 0);
    result.push({
      id: `cp-lover-${activeCp.id}`,
      tagType: 'lover',
      partnerUid: partner?.publicId || cpPartnerInternalUid,
      partnerName: partner?.name || `Player ${partner?.publicId || cpPartnerInternalUid}`,
      partnerPhotoUrl: partner?.photoUrl || null,
      status: 'active',
      isIncoming: false,
      charmScore: cpCharm,
      level: computeCpLevelFromCharm(cpCharm),
      startedAt: activeCp.startedAt.toISOString(),
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
      startedAt: (r.status === 'active' ? r.updatedAt : r.createdAt).toISOString(),
    });
  }

  return result;
}

export async function proposeOrActivateRelationshipTag(params: {
  fromUid: string;
  toIdentifier: string;
  tagType: string;
}) {
  const rawClean = String(params.tagType || '').trim().toLowerCase();
  if (!ALLOWED_RELATIONSHIP_TAGS.includes(rawClean as RelationshipTagKey)) {
    throw new Error('Invalid relationship tag. Supported: bro, bestie, sister, soulmate, lover, confident.');
  }
  const cleanTag = normalizeRelationshipTagKey(rawClean);
  if (cleanTag === 'lover') {
    throw new Error('Lover Tag is the official CP Partner tag and activates automatically when two players become CP Partners.');
  }
  const target = await resolveUserByUidOrPublicId(params.toIdentifier);
  if (!target) throw new Error('Target player not found.');
  if (target.uid === params.fromUid) throw new Error('Cannot tag yourself.');
  if (await isBlockedBetween(params.fromUid, target.uid)) {
    throw new Error('Cannot create relationship tag while a block is active.');
  }

  const [userA, userB] = [params.fromUid, target.uid].sort();
  const [existing] = await db
    .select()
    .from(relationshipTags)
    .where(
      and(
        eq(relationshipTags.userAUid, userA),
        eq(relationshipTags.userBUid, userB),
        eq(relationshipTags.tagType, cleanTag)
      )
    );

  if (existing && existing.status === 'active') {
    return { saved: existing, targetInternalUid: target.uid, targetPublicId: target.publicId };
  }

  const id = existing?.id || `TAG-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const now = new Date();
  const [saved] = await db
    .insert(relationshipTags)
    .values({
      id,
      userAUid: userA,
      userBUid: userB,
      requestedByUid: params.fromUid,
      tagType: cleanTag,
      status: 'pending',
      charmScore: existing?.charmScore ?? 0,
      level: existing?.level ?? 1,
    })
    .onConflictDoUpdate({
      target: relationshipTags.id,
      set: {
        requestedByUid: params.fromUid,
        status: 'pending',
        updatedAt: now,
      },
    })
    .returning();

  await db.insert(notifications).values({
    userUid: target.uid,
    type: 'friend',
    title: 'Relationship Tag Invitation',
    body: `You received a ${cleanTag.replace('_', ' ').toUpperCase()} relationship tag invitation!`,
    metadata: { tagId: saved.id, tagType: cleanTag },
  });

  return { saved, targetInternalUid: target.uid, targetPublicId: target.publicId };
}

export async function respondRelationshipTag(params: {
  actorUid: string;
  tagId: string;
  accept: boolean;
}) {
  const [row] = await db.select().from(relationshipTags).where(eq(relationshipTags.id, params.tagId));
  if (!row) throw new Error('Relationship tag invitation not found.');
  if (row.userAUid !== params.actorUid && row.userBUid !== params.actorUid) {
    throw new Error('You are not part of this relationship tag.');
  }
  if (row.requestedByUid === params.actorUid && params.accept) {
    throw new Error('Waiting for the invited player to accept.');
  }

  const nextStatus = params.accept ? 'active' : 'ended';
  const [updated] = await db
    .update(relationshipTags)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(relationshipTags.id, row.id))
    .returning();

  return updated;
}

export async function endRelationshipTag(params: { actorUid: string; tagId: string }) {
  const [row] = await db.select().from(relationshipTags).where(eq(relationshipTags.id, params.tagId));
  if (!row) throw new Error('Relationship tag not found.');
  if (row.userAUid !== params.actorUid && row.userBUid !== params.actorUid) {
    throw new Error('Unauthorized.');
  }
  const [updated] = await db
    .update(relationshipTags)
    .set({ status: 'ended', updatedAt: new Date() })
    .where(eq(relationshipTags.id, row.id))
    .returning();
  return updated;
}

export const ACTION_ROOM_TAG_PRICE_MAP: Record<'bro' | 'bestie' | 'sister' | 'soulmate' | 'confident', number> = {
  bro: 50_000,
  bestie: 80_000,
  sister: 100_000,
  soulmate: 150_000,
  confident: 200_000,
};

export async function purchaseActionRoomTagAtomic(params: {
  actorUid: string;
  partnerIdentifier: string;
  tagType: string;
  idempotencyKey?: string;
}) {
  const rawClean = String(params.tagType || '').trim().toLowerCase();
  if (!(rawClean in ACTION_ROOM_TAG_PRICE_MAP)) {
    throw new Error('Paid Action Room tags support: bro, bestie, sister, soulmate, confident.');
  }
  const cleanTag = rawClean as keyof typeof ACTION_ROOM_TAG_PRICE_MAP;
  const priceCoins = ACTION_ROOM_TAG_PRICE_MAP[cleanTag];

  const target = await resolveUserByUidOrPublicId(params.partnerIdentifier);
  if (!target) throw new Error('Target player not found.');
  if (target.uid === params.actorUid) throw new Error('Cannot activate a relationship tag with yourself.');
  if (await isBlockedBetween(params.actorUid, target.uid)) {
    throw new Error('Cannot activate relationship tag while a block is active.');
  }

  const [userA, userB] = [params.actorUid, target.uid].sort();
  const now = new Date();
  const cleanIdempotency = params.idempotencyKey ? params.idempotencyKey.trim().slice(0, 120) : undefined;

  return db.transaction(async (tx) => {
    if (cleanIdempotency) {
      const [existingTx] = await tx
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.idempotencyKey, cleanIdempotency));
      if (existingTx) {
        const [existingTag] = await tx
          .select()
          .from(relationshipTags)
          .where(
            and(
              eq(relationshipTags.userAUid, userA),
              eq(relationshipTags.userBUid, userB),
              eq(relationshipTags.tagType, cleanTag)
            )
          );
        if (existingTag) {
          return {
            saved: existingTag,
            targetInternalUid: target.uid,
            targetPublicId: target.publicId,
            coinsAfter: Number(existingTx.balanceAfter),
            priceCoins,
          };
        }
      }
    }

    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userUid, params.actorUid))
      .for('update');
    if (!wallet) throw new Error('Wallet not initialized.');
    if (wallet.isFrozen) throw new Error('Your wallet is currently frozen.');
    const currentCoins = Number(wallet.coins ?? 0);
    if (currentCoins < priceCoins) {
      throw new Error(`Insufficient coins. ${priceCoins.toLocaleString()} coins required to activate ${cleanTag.toUpperCase()} tag.`);
    }

    const [existingTag] = await tx
      .select()
      .from(relationshipTags)
      .where(
        and(
          eq(relationshipTags.userAUid, userA),
          eq(relationshipTags.userBUid, userB),
          eq(relationshipTags.tagType, cleanTag)
        )
      )
      .for('update');

    if (existingTag && existingTag.status === 'active') {
      throw new Error(`You already have an active ${cleanTag.toUpperCase()} tag with ${target.publicId}.`);
    }

    const coinsAfter = currentCoins - priceCoins;
    await tx
      .update(wallets)
      .set({
        coins: coinsAfter,
        totalSpentCoins: Number(wallet.totalSpentCoins ?? 0) + priceCoins,
        updatedAt: now,
      })
      .where(eq(wallets.userUid, params.actorUid));

    const tagId = existingTag?.id || `TAG-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const [saved] = await tx
      .insert(relationshipTags)
      .values({
        id: tagId,
        userAUid: userA,
        userBUid: userB,
        requestedByUid: params.actorUid,
        tagType: cleanTag,
        status: 'active',
        charmScore: existingTag?.charmScore ?? 0,
        level: existingTag?.level ?? 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: relationshipTags.id,
        set: {
          requestedByUid: params.actorUid,
          status: 'active',
          updatedAt: now,
        },
      })
      .returning();

    await tx.insert(walletTransactions).values({
      txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      userUid: params.actorUid,
      type: 'action_tag_purchase',
      amount: -priceCoins,
      balanceAfter: coinsAfter,
      referenceType: 'relationship_tag',
      referenceId: saved.id,
      idempotencyKey: cleanIdempotency || `action-tag-${saved.id}-${Date.now()}`,
      description: `Action Room Tag Activation: ${cleanTag.toUpperCase()} with ${target.publicId}`,
      actorUid: params.actorUid,
    });

    await tx.insert(notifications).values({
      userUid: target.uid,
      type: 'friend',
      title: 'Action Room Tag Activated',
      body: `Your ${cleanTag.toUpperCase()} relationship bond is now active!`,
      metadata: { tagId: saved.id, tagType: cleanTag },
    });

    return {
      saved,
      targetInternalUid: target.uid,
      targetPublicId: target.publicId,
      coinsAfter,
      priceCoins,
    };
  });
}

// =========================================================================
// MEDIA ASSET STORAGE (supports 3MB+ client uploads compressed to clean URLs)
// =========================================================================
let mediaTableEnsured = false;
async function ensureMediaAssetsTableExists(): Promise<void> {
  if (mediaTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.media_assets (
      id text PRIMARY KEY,
      owner_uid text NOT NULL,
      mime_type text NOT NULL,
      data_base64 text NOT NULL,
      byte_size integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  mediaTableEnsured = true;
}

const mediaAssetCache = new Map<string, { id: string; mimeType: string; buffer: Buffer; byteSize: number }>();

export async function saveMediaAsset(params: {
  ownerUid: string;
  dataUrl: string;
}): Promise<{ id: string; url: string; mimeType: string; byteSize: number }> {
  await ensureMediaAssetsTableExists();
  const raw = String(params.dataUrl || '').trim();
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw);
  if (!match) {
    throw new Error('Unsupported media format. Please upload a PNG, JPEG, WEBP, GIF, or short MP4/WEBM file.');
  }
  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64Clean = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  if (!buffer.length) {
    throw new Error('Uploaded file is empty.');
  }
  const maxBytes = mimeType.startsWith('video/') ? 5_242_880 : 4_194_304;
  if (buffer.length > maxBytes) {
    throw new Error(`Processed media exceeds server limit (${Math.round(maxBytes / (1024 * 1024))} MB).`);
  }

  const id = `m_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  await pool.query(
    `INSERT INTO public.media_assets (id, owner_uid, mime_type, data_base64, byte_size)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, params.ownerUid, mimeType, base64Clean, buffer.length]
  );

  if (buffer.length <= 750_000) {
    if (mediaAssetCache.size > 120) {
      const oldestKey = mediaAssetCache.keys().next().value;
      if (oldestKey) mediaAssetCache.delete(oldestKey);
    }
    mediaAssetCache.set(id, { id, mimeType, buffer, byteSize: buffer.length });
  }

  return {
    id,
    url: `/api/media/${id}`,
    mimeType,
    byteSize: buffer.length,
  };
}

export async function getMediaAsset(
  id: string
): Promise<{ id: string; mimeType: string; buffer: Buffer; byteSize: number } | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
  const cached = mediaAssetCache.get(id);
  if (cached) return cached;
  await ensureMediaAssetsTableExists();
  const res = await pool.query<{ id: string; mime_type: string; data_base64: string; byte_size: number }>(
    `SELECT id, mime_type, data_base64, byte_size FROM public.media_assets WHERE id = $1 LIMIT 1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  const buffer = Buffer.from(row.data_base64, 'base64');
  const asset = {
    id: row.id,
    mimeType: row.mime_type,
    buffer,
    byteSize: Number(row.byte_size ?? buffer.length),
  };
  if (buffer.length <= 750_000) {
    if (mediaAssetCache.size > 120) {
      const oldestKey = mediaAssetCache.keys().next().value;
      if (oldestKey) mediaAssetCache.delete(oldestKey);
    }
    mediaAssetCache.set(id, asset);
  }
  return asset;
}



