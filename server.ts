import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import QRCode from 'qrcode';
import { and, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import appletFirebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { db } from './src/db/index.ts';
import {
  CpDomainError,
  DEFAULT_ROOM_CLOSED_REASON,
  areUsersAcceptedFriends,
  assertUserNotBanned,
  breakCpRelationshipAtomic,
  buyShopItemAtomic,
  cancelFriendRequest,
  claimReferralCodeAtomic,
  claimTaskChestAtomic,
  claimTaskRewardAtomic,
  createDbSession,
  createPaymentOrder,
  createWithdrawalRequestAtomic,
  deleteDbSession,
  endRelationshipTag,
  ensureDatabaseSchemaReady,
  ensureNumericPublicIdsMigrated,
  ensureOfficialRoomsSecurityState,
  ensureVoiceRoomsHaveOwners,
  findOrCreateVerifiedUser,
  getAppConfig,
  getClaimedTaskChests,
  getCpStateForUser,
  getDbSession,
  getFullUserView,
  getMaxRoomAdminSlots,
  getMediaAsset,
  getPublicUserProfile,
  getReferralSummaryForUser,
  getTop50Rankings,
  getUserCustomGifts,
  getUserNotifications,
  getUserRelationshipTags,
  getUserTasksWithProgress,
  getVipDecayConfig,
  invalidateUserViewCache,
  isAppAdminRole,
  isBlockedBetween,
  isSafeMediaReference,
  listShopItems,
  listUserWithdrawals,
  makeDmThreadId,
  mapUidsToPublicIds,
  proposeCpAtomic,
  proposeOrActivateRelationshipTag,
  purchaseActionRoomTagAtomic,
  recordTaskActionProgress,
  reopenVoiceRoom,
  resolveUserByUidOrPublicId,
  respondCpProposalAtomic,
  respondRelationshipTag,
  runVipDecaySweep,
  sanitizeUserForClient,
  saveMediaAsset,
  sendGiftAtomic,
  serializeVoiceRoomForClient,
  submitCustomGift,
  submitPaymentProof,
  touchUserLastSeen,
  unblockUser,
  unfriendUser,
  updateSafeProfile,
  type FullUserView,
} from './src/db/repository.ts';
import {
  coinPackages,
  comments,
  eventParticipants,
  events,
  friends,
  gameMatches,
  gifts,
  likes,
  messages,
  notifications,
  paymentOrders,
  platformSettings,
  posts,
  profiles,
  reports,
  roomBackgrounds,
  roomParticipants,
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
} from './src/db/schema.ts';
import { ensureSeedData } from './src/db/seed.ts';
import { createAdminRouter } from './server/adminRoutes.ts';
import { RealtimeHub } from './server/realtime.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const FIREBASE_PROJECT_ID = 'og-velocity';
const FIREBASE_WEB_API_KEY = 'AIzaSyCWMhFzpTkrcWEEjGEwkItHtGJ8AYjKg_Q';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = 'ogv_session';

const ENV_SESSION_SECRET = process.env.SESSION_SECRET?.trim();
const SESSION_SECRET =
  ENV_SESSION_SECRET && !ENV_SESSION_SECRET.startsWith('MY_')
    ? ENV_SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const adminAuthApps = new Map<string, ReturnType<typeof getAdminAuth>>();
function getAdminAuthForProject(projectId: string) {
  const existing = adminAuthApps.get(projectId);
  if (existing) return existing;
  if (projectId === FIREBASE_PROJECT_ID) {
    const appInstance = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp({ projectId });
    const authInstance = getAdminAuth(appInstance);
    adminAuthApps.set(projectId, authInstance);
    return authInstance;
  }
  const appName = `ogv-${projectId}`;
  const found = getApps().find((a) => a.name === appName);
  const appInstance = found || initializeApp({ projectId }, appName);
  const authInstance = getAdminAuth(appInstance);
  adminAuthApps.set(projectId, authInstance);
  return authInstance;
}

function decodeJwtAudience(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { aud?: unknown };
    return typeof payload.aud === 'string' ? payload.aud : null;
  } catch {
    return null;
  }
}

async function verifyTokenAcrossProjects(idToken: string): Promise<DecodedFirebaseTokenLike> {
  const allowedProjects = Array.from(
    new Set([FIREBASE_PROJECT_ID, appletFirebaseConfig.projectId].filter(Boolean))
  );
  const aud = decodeJwtAudience(idToken);
  const ordered =
    aud && allowedProjects.includes(aud)
      ? [aud, ...allowedProjects.filter((p) => p !== aud)]
      : allowedProjects;
  let lastErr: unknown = null;
  for (const projectId of ordered) {
    try {
      return (await getAdminAuthForProject(projectId).verifyIdToken(
        idToken
      )) as DecodedFirebaseTokenLike;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Firebase ID token verification failed.');
}

// Initialize default project lazily ready
getAdminAuthForProject(FIREBASE_PROJECT_ID);

const PRIVILEGED_PROFILE_FIELDS = new Set([
  'viplevel',
  'vip_level',
  'vipstatus',
  'vip_status',
  'vipgrowth',
  'vip_growth',
  'vipplanlabel',
  'vip_plan_label',
  'charm',
  'charmpoints',
  'charm_points',
  'coins',
  'giftsreceived',
  'gifts_received',
  'zayroid',
  'zayro_id',
  'publicid',
  'public_id',
  'uid',
  'firebaseuid',
  'firebase_uid',
  'email',
  'phone',
  'role',
  'emailverified',
  'email_verified',
  'phoneverified',
  'phone_verified',
  'accountstatus',
  'account_status',
  'provider',
]);

interface RateBucket {
  count: number;
  resetAt: number;
}
const ipRateBuckets = new Map<string, RateBucket>();
let cachedAuthorizedDomains: { byProject: Record<string, string[]>; domains: string[]; expiresAt: number } | null = null;
let lastOfficialRoomCheckAt = 0;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipRateBuckets.entries()) {
    if (v.resetAt <= now) ipRateBuckets.delete(k);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cur = ipRateBuckets.get(key);
  if (!cur || cur.resetAt <= now) {
    if (ipRateBuckets.size > 10_000) {
      const oldestKey = ipRateBuckets.keys().next().value;
      if (oldestKey) ipRateBuckets.delete(oldestKey);
    }
    ipRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (cur.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signSessionToken(params: { sid: string; userUid: string; identifier: string; expiresAt: number }) {
  const payload = Buffer.from(
    JSON.stringify({
      sid: params.sid,
      uid: params.userUid,
      id: params.identifier,
      exp: params.expiresAt,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

async function verifySessionToken(token: string) {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (!safeEqualString(sig, expectedSig)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sid?: string;
      uid?: string;
      exp?: number;
    };
    if (!decoded.sid || !decoded.uid || !decoded.exp) return null;
    if (Date.now() > decoded.exp) {
      await deleteDbSession(decoded.sid).catch(() => {});
      return null;
    }
    const stored = await getDbSession(decoded.sid);
    if (!stored || stored.userUid !== decoded.uid) return null;
    return stored;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
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

function extractTokenFromHeaders(headers: http.IncomingHttpHeaders): string | null {
  const authHeader = headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

export async function authenticateWebSocketRequest(
  req: http.IncomingMessage
): Promise<{ userUid: string } | null> {
  let token: string | null = null;
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    token = url.searchParams.get('token');
  } catch {
    token = null;
  }
  if (!token) token = extractTokenFromHeaders(req.headers);
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session ? { userUid: session.userUid } : null;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    attrs.push('Secure');
    attrs.push('Partitioned');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    attrs.push('Secure');
    attrs.push('Partitioned');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

async function fetchAuthorizedDomainsForApiKey(apiKey: string): Promise<string[]> {
  if (!apiKey) return [];
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${apiKey}`);
  if (!resp.ok) return [];
  const data = (await resp.json()) as { authorizedDomains?: string[] };
  return Array.isArray(data.authorizedDomains) ? data.authorizedDomains : [];
}

async function fetchAuthorizedDomainsByProject(): Promise<{
  byProject: Record<string, string[]>;
  domains: string[];
}> {
  const now = Date.now();
  if (cachedAuthorizedDomains && cachedAuthorizedDomains.expiresAt > now) {
    return { byProject: cachedAuthorizedDomains.byProject, domains: cachedAuthorizedDomains.domains };
  }
  const projectKeys: Array<{ projectId: string; apiKey: string }> = [
    { projectId: FIREBASE_PROJECT_ID, apiKey: FIREBASE_WEB_API_KEY },
  ];
  if (appletFirebaseConfig.projectId && appletFirebaseConfig.apiKey) {
    projectKeys.push({
      projectId: appletFirebaseConfig.projectId,
      apiKey: appletFirebaseConfig.apiKey,
    });
  }
  const byProject: Record<string, string[]> = {};
  await Promise.all(
    projectKeys.map(async ({ projectId, apiKey }) => {
      byProject[projectId] = await fetchAuthorizedDomainsForApiKey(apiKey).catch(() => []);
    })
  );
  const domains = Array.from(new Set(Object.values(byProject).flat()));
  cachedAuthorizedDomains = { byProject, domains, expiresAt: now + 60 * 1000 };
  return { byProject, domains };
}

export interface DecodedFirebaseTokenLike {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase?: { sign_in_provider?: string };
}

export interface CreateAppOptions {
  verifyIdTokenFn?: (idToken: string) => Promise<DecodedFirebaseTokenLike>;
  getRealtimeHub?: () => RealtimeHub | null;
}

export interface AuthenticatedRequest extends Request {
  authSessionSid?: string;
  authUser?: FullUserView;
}

export function createApp(options: CreateAppOptions = {}) {
  const verifyIdTokenFn = options.verifyIdTokenFn ?? verifyTokenAcrossProjects;

  const app = express();
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '10mb' }));

  const requireVerifiedSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = extractTokenFromHeaders(req.headers);
      const session = token ? await verifySessionToken(token) : null;
      if (!session) {
        res.status(401).json({ error: 'Authentication required. Please sign in.' });
        return;
      }
      const user = await getFullUserView(session.userUid);
      if (!user || user.accountStatus !== 'active') {
        res.status(403).json({
          error:
            user?.accountStatus === 'banned'
              ? user.banReason
                ? `Account banned: ${user.banReason}`
                : 'This account has been banned.'
              : user?.accountStatus === 'suspended'
                ? 'This account is currently suspended.'
                : 'Verified active account required.',
        });
        return;
      }
      req.authSessionSid = session.sid;
      req.authUser = user;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.on('finish', () => {
          invalidateUserViewCache(session.userUid);
        });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Session error.' });
    }
  };

  app.get('/api/health', (_req, res) => {
    res.json({
      name: 'OG VELOCITY Production Server',
      status: 'ok',
      firebaseProjectId: FIREBASE_PROJECT_ID,
      appletProjectId: appletFirebaseConfig.projectId,
      providers: ['google.com', 'facebook.com'],
    });
  });

  app.get('/api/app-config', async (_req, res) => {
    try {
      const config = await getAppConfig();
      res.json({ ok: true, config });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load app config.' });
    }
  });

  app.get('/api/auth/domain-check', async (req, res) => {
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(':')[0]
      .trim()
      .toLowerCase();
    const expectedDomains = [
      'ogvelocity.xyz',
      'ais-dev-tmyxn2f2uyfmeagcwxc4c42-997874239735.asia-southeast1.run.app',
      'ais-dev-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app',
      'ais-pre-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app',
    ];
    try {
      const { byProject, domains: authorizedDomains } = await fetchAuthorizedDomainsByProject();
      const hostAuthorizedOn = (domainList: string[]) =>
        Boolean(rawHost) &&
        (rawHost === 'localhost' ||
          domainList.some(
            (d) => rawHost === d.toLowerCase() || rawHost.endsWith(`.${d.toLowerCase()}`)
          ));
      const authorizedProjects = Object.entries(byProject)
        .filter(([, domainList]) => hostAuthorizedOn(domainList))
        .map(([projectId]) => projectId);
      const isDomainAuthorized = authorizedProjects.length > 0;
      res.json({
        ok: true,
        projectId: FIREBASE_PROJECT_ID,
        appletProjectId: appletFirebaseConfig.projectId,
        currentHost: rawHost,
        authorizedDomains,
        authorizedDomainsByProject: byProject,
        authorizedProjects,
        expectedDomains,
        isDomainAuthorized,
      });
    } catch {
      res.json({
        ok: false,
        projectId: FIREBASE_PROJECT_ID,
        appletProjectId: appletFirebaseConfig.projectId,
        currentHost: rawHost,
        authorizedDomains: [],
        authorizedDomainsByProject: {},
        authorizedProjects: [],
        expectedDomains,
        isDomainAuthorized: false,
      });
    }
  });

  // Explicitly block unauthenticated/password/fake bypass auth routes
  app.all(['/api/auth/login', '/api/auth/register', '/api/auth/password', '/api/auth/email'], (_req, res) => {
    res.status(403).json({
      error: 'Direct email/password authentication is disabled. Authenticate using Firebase Google or Facebook.',
    });
  });

  // Unified Firebase Multi-Provider Auth Verification (Google, Phone SMS OTP, Facebook)
  const handleVerifyFirebase = async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = consumeRateLimit(`auth:${ip}`, 50, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: `Too many sign-in attempts. Retry in ${limit.retryAfterSec}s.` });
      return;
    }

    const idToken = String(req.body?.idToken ?? '').trim();
    if (!idToken) {
      res.status(400).json({ error: 'Missing Firebase ID token.' });
      return;
    }

    let decoded: DecodedFirebaseTokenLike;
    try {
      decoded = await verifyIdTokenFn(idToken);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      console.error('[Auth] Firebase ID token verification failed:', code || 'unknown_code');
      if (code === 'auth/id-token-expired') {
        res.status(401).json({ error: 'Firebase session expired. Please sign in again.' });
        return;
      }
      res.status(401).json({
        error: err instanceof Error ? err.message : 'Firebase ID token verification failed.',
      });
      return;
    }

    const signInProvider = decoded.firebase?.sign_in_provider;

    if (!decoded.uid || !signInProvider) {
      res.status(401).json({ error: 'Firebase token missing subject or provider.' });
      return;
    }

    let provider: 'google' | 'facebook';
    if (signInProvider === 'google.com') {
      if (!decoded.email || decoded.email_verified !== true) {
        console.warn('[Auth] Rejected Google sign-in without verified email for uid:', decoded.uid);
        res.status(403).json({ error: 'Verified Google email address is required.' });
        return;
      }
      provider = 'google';
    } else if (signInProvider === 'phone') {
      res.status(403).json({ error: 'Phone SMS OTP sign-in is disabled. Please sign in with Google or Facebook.' });
      return;
    } else if (signInProvider === 'facebook.com') {
      provider = 'facebook';
    } else {
      res.status(403).json({
        error: `Unsupported authentication provider "${signInProvider}". Use Google or Facebook.`,
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
        name: typeof decoded.name === 'string' ? decoded.name : null,
        photoUrl: typeof decoded.picture === 'string' ? decoded.picture : null,
      });

      if (user.accountStatus !== 'active') {
        res.status(403).json({ error: `Account is ${user.accountStatus}. Contact support.` });
        return;
      }

      void touchUserLastSeen(user.uid);
      const identifier = user.email || user.phone || user.publicId;
      const session = await createDbSession({
        userUid: user.uid,
        identifier,
        provider,
        ttlMs: SESSION_TTL_MS,
      });
      const token = signSessionToken({
        sid: session.sid,
        userUid: user.uid,
        identifier,
        expiresAt: session.expiresAt,
      });
      setSessionCookie(req, res, token);

      console.log(
        `[Auth] Verified ${provider} session for publicId=${user.publicId} isNew=${isNewUser}`
      );
      res.json({ ok: true, token, user: sanitizeUserForClient(user), isNewUser });
    } catch (err) {
      console.error(
        '[Auth] Failed to create/load user profile or session:',
        err instanceof Error ? err.message : err
      );
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to initialize user profile on server. Please try again.',
      });
    }
  };

  app.post('/api/auth/verify-firebase', handleVerifyFirebase);
  app.post('/api/auth/verify-google', handleVerifyFirebase);

  app.get('/api/auth/session', requireVerifiedSession, (req: AuthenticatedRequest, res) => {
    const token = extractTokenFromHeaders(req.headers);
    res.json({ ok: true, token, user: sanitizeUserForClient(req.authUser!) });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = extractTokenFromHeaders(req.headers);
    if (token) {
      const session = await verifySessionToken(token);
      if (session) await deleteDbSession(session.sid);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Media Upload & Immutable Asset Serving (handles 3MB+ client uploads cleanly)
  app.post('/api/media/upload', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const limit = consumeRateLimit(`media:${req.authUser!.uid}`, 40, 5 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: `Too many uploads. Retry in ${limit.retryAfterSec}s.` });
      return;
    }
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    if (!dataUrl) {
      res.status(400).json({ error: 'Missing image/media payload.' });
      return;
    }
    try {
      const saved = await saveMediaAsset({
        ownerUid: req.authUser!.uid,
        dataUrl,
      });
      res.json({ ok: true, id: saved.id, url: saved.url, mimeType: saved.mimeType, byteSize: saved.byteSize });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
    }
  });

  app.get('/api/media/:id', async (req, res) => {
    const id = String(req.params.id || '').trim();
    try {
      const asset = await getMediaAsset(id);
      if (!asset) {
        res.status(404).json({ error: 'Media asset not found.' });
        return;
      }
      const etag = `"${asset.id}"`;
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(asset.buffer);
    } catch {
      res.status(500).json({ error: 'Failed to serve media asset.' });
    }
  });

  // Bootstrap Full Authenticated Payload (never pre-loads QR or UPI ID before an order!)
  app.get('/api/protected/bootstrap', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    await ensureDatabaseSchemaReady();
    await ensureSeedData();
    await ensureVoiceRoomsHaveOwners();
    const uid = req.authUser!.uid;
    const hub = options.getRealtimeHub?.();
    if (Date.now() - lastOfficialRoomCheckAt > 15_000) {
      lastOfficialRoomCheckAt = Date.now();
      await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin()).catch(() => {});
    }
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
      claimedTaskChests,
    ] = await Promise.all([
      getAppConfig(),
      db.select().from(vipPackages).where(eq(vipPackages.active, true)).orderBy(vipPackages.sortOrder),
      db.select().from(coinPackages).where(eq(coinPackages.active, true)).orderBy(coinPackages.sortOrder),
      db.select().from(vipProgressionRules).orderBy(vipProgressionRules.level),
      db.select().from(gifts).where(eq(gifts.active, true)).orderBy(gifts.giftNumber),
      listShopItems(false),
      getUserCustomGifts(uid),
      getUserTasksWithProgress(uid),
      db.select().from(events).orderBy(desc(events.createdAt)),
      db
        .select()
        .from(voiceRooms)
        .orderBy(desc(voiceRooms.isOfficial), desc(voiceRooms.roomLevel)),
      getUserNotifications(uid),
      db.select().from(paymentOrders).where(eq(paymentOrders.userUid, uid)).orderBy(desc(paymentOrders.createdAt)).limit(20),
      db.select().from(userInventory).where(eq(userInventory.userUid, uid)),
      db.select().from(roomBackgrounds).where(eq(roomBackgrounds.active, true)),
      db.select().from(vipPointLedger).where(eq(vipPointLedger.userUid, uid)).orderBy(desc(vipPointLedger.createdAt)).limit(40),
      db.select().from(vipSubscriptionHistory).where(eq(vipSubscriptionHistory.userUid, uid)).orderBy(desc(vipSubscriptionHistory.createdAt)).limit(25),
      getVipDecayConfig(),
      getCpStateForUser(uid),
      getReferralSummaryForUser(uid),
      listUserWithdrawals(uid),
      getUserRelationshipTags(uid, { activeOnly: false }),
      getClaimedTaskChests(uid),
    ]);

    const roomsList = allRoomsList;

    const roomUidCandidates = roomsList.flatMap((r) => [
      r.ownerUid,
      ...(Array.isArray(r.adminUids) ? r.adminUids : []),
    ]);
    const roomUidMap = await mapUidsToPublicIds(roomUidCandidates);
    const selfPublicId = req.authUser!.publicId;

    res.json({
      ok: true,
      user: sanitizeUserForClient(req.authUser!),
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
      rooms: roomsList.map((r) =>
        serializeVoiceRoomForClient(r, roomUidMap, hub ? hub.getRoomParticipants(r.id).length : 0)
      ),
      notifications: myNotifs.map((n) => ({ ...n, userUid: n.userUid ? selfPublicId : null })),
      orders: myOrders.map((o) => ({ ...o, userUid: selfPublicId, reviewedByUid: null })),
      inventory: inventoryRows.map((inv) => ({ ...inv, userUid: selfPublicId })),
      roomBackgrounds: bgRows,
      serverTime: new Date().toISOString(),
    });
  });

  app.get('/api/vip/status', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const uid = req.authUser!.uid;
    const selfPublicId = req.authUser!.publicId;
    const [decayConfig, ledger, history] = await Promise.all([
      getVipDecayConfig(),
      db.select().from(vipPointLedger).where(eq(vipPointLedger.userUid, uid)).orderBy(desc(vipPointLedger.createdAt)).limit(40),
      db.select().from(vipSubscriptionHistory).where(eq(vipSubscriptionHistory.userUid, uid)).orderBy(desc(vipSubscriptionHistory.createdAt)).limit(25),
    ]);
    res.json({
      ok: true,
      user: sanitizeUserForClient(req.authUser!),
      decayConfig,
      pointLedger: ledger.map((l) => ({ ...l, userUid: selfPublicId, actorUid: null })),
      subscriptionHistory: history.map((h) => ({ ...h, userUid: selfPublicId, actorUid: null })),
    });
  });

  app.post('/api/protected/profile', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const attemptedPrivileged = Object.keys(body).filter((k) =>
      PRIVILEGED_PROFILE_FIELDS.has(k.toLowerCase())
    );
    if (attemptedPrivileged.length > 0) {
      res.status(403).json({
        error: `Modification of protected fields (${attemptedPrivileged.join(', ')}) from the client is forbidden.`,
      });
      return;
    }

    const updated = await updateSafeProfile(req.authUser!.uid, {
      name: typeof body.name === 'string' ? body.name : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
      gender: body.gender === 'Male' || body.gender === 'Female' || body.gender === 'Other' ? body.gender : undefined,
      age: typeof body.age === 'number' ? body.age : undefined,
      country: typeof body.country === 'string' ? body.country : undefined,
      ornament:
        body.ornament === 'crown' ||
        body.ornament === 'lotus' ||
        body.ornament === 'halo' ||
        body.ornament === 'visor' ||
        body.ornament === 'crescent' ||
        body.ornament === 'flame'
          ? body.ornament
          : undefined,
      handle: typeof body.handle === 'string' ? body.handle : undefined,
      photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : undefined,
      coverUrl: typeof body.coverUrl === 'string' ? body.coverUrl : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
      themeMode: body.themeMode === 'light' || body.themeMode === 'dark' ? body.themeMode : undefined,
      equippedEmoteId:
        body.equippedEmoteId === null || typeof body.equippedEmoteId === 'string'
          ? (body.equippedEmoteId as string | null)
          : undefined,
    });

    res.json({ ok: true, user: sanitizeUserForClient(updated) });
  });

  // =========================================================================
  // ORDER-FIRST UPI QR REVEAL & ADMIN APPROVAL FLOW (NEVER PRE-LOADS QR)
  // =========================================================================
  app.get('/api/payments/upi-config', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const orderId = String(req.query.orderId || '').trim();
    if (!orderId) {
      res.status(400).json({
        error: 'An active payment orderId is required before accessing payment QR details.',
      });
      return;
    }

    const [order] = await db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderId, orderId));

    if (!order) {
      res.status(404).json({ error: 'Payment order not found.' });
      return;
    }
    if (order.userUid !== req.authUser!.uid) {
      res.status(403).json({ error: 'You do not have access to this payment order.' });
      return;
    }
    if (order.status === 'expired' || order.status === 'cancelled' || order.status === 'rejected') {
      res.status(410).json({ error: `This payment order is ${order.status}. Please create a new order.` });
      return;
    }
    if (order.status === 'approved') {
      res.status(400).json({ error: 'This payment order has already been approved.' });
      return;
    }
    if (order.status === 'awaiting_payment' && order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
      await db
        .update(paymentOrders)
        .set({ status: 'expired' })
        .where(eq(paymentOrders.orderId, orderId));
      res.status(410).json({ error: 'Payment session expired. Please create a new order.' });
      return;
    }

    const accountName = order.accountNameUsed || 'Merchant';
    const upiId = order.upiIdUsed;
    const provider = order.providerUsed || 'UPI';
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(accountName)}&am=${order.amountInr}&tn=${encodeURIComponent(order.orderId)}&cu=INR`;
    const qrDataUrl =
      order.qrDataUrlSnapshot || (await QRCode.toDataURL(upiUri, { width: 320, margin: 1 }));

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
        active: true,
      },
    });
  });

  app.get('/api/payments/orders', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rows = await db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.userUid, req.authUser!.uid))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(40);
    const selfPublicId = req.authUser!.publicId;
    res.json({ ok: true, orders: rows.map((o) => ({ ...o, userUid: selfPublicId, reviewedByUid: null })) });
  });

  app.post('/api/payments/orders', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const orderType = req.body?.orderType === 'coins' ? 'coins' : req.body?.orderType === 'vip' ? 'vip' : null;
    const packageId = String(req.body?.packageId || '').trim();
    const screen = typeof req.body?.screen === 'string' && req.body.screen.trim() ? req.body.screen.trim() : undefined;
    if (!orderType || !packageId) {
      res.status(400).json({ error: 'Specify orderType ("vip" | "coins") and packageId.' });
      return;
    }

    try {
      const { order, upiConfig, reused } = await createPaymentOrder({
        userUid: req.authUser!.uid,
        orderType,
        packageId,
        screen: screen || orderType,
      });

      res.json({
        ok: true,
        reused: Boolean(reused),
        order: { ...order, userUid: req.authUser!.publicId, reviewedByUid: null },
        upiConfig,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create order.' });
    }
  });

  app.post('/api/payments/orders/:orderId/submit-proof', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const orderId = String(req.params.orderId);
    const utrNumber = String(req.body?.utrNumber || '').trim();
    const accountHolderName = String(req.body?.accountHolderName || '').trim();
    const paymentDateTime = typeof req.body?.paymentDateTime === 'string' ? req.body.paymentDateTime.trim() : undefined;
    const screenshotDataUrl = typeof req.body?.screenshotDataUrl === 'string' ? req.body.screenshotDataUrl : undefined;
    const payerNote = typeof req.body?.payerNote === 'string' ? req.body.payerNote : undefined;

    if (!utrNumber) {
      res.status(400).json({ error: 'UTR / Transaction Reference number is required.' });
      return;
    }
    if (accountHolderName.length < 2) {
      res.status(400).json({ error: 'Bank Account Holder / Sender Name is required.' });
      return;
    }

    try {
      const order = await submitPaymentProof({
        userUid: req.authUser!.uid,
        orderId,
        utrNumber,
        accountHolderName,
        paymentDateTime,
        screenshotDataUrl,
        payerNote,
      });
      const user = await getFullUserView(req.authUser!.uid);
      res.json({
        ok: true,
        order: { ...order, userUid: req.authUser!.publicId, reviewedByUid: null },
        user: user ? sanitizeUserForClient(user) : null,
        message: 'UTR & proof submitted for Admin verification. VIP/Coins activate only after Admin approval.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Proof submission failed.';
      const code = msg === 'DUPLICATE_UTR' ? 409 : msg === 'ORDER_OWNERSHIP_MISMATCH' ? 403 : 400;
      res.status(code).json({
        error: msg === 'DUPLICATE_UTR' ? 'Duplicate UTR detected. This UTR was already submitted.' : msg,
      });
    }
  });

  // =========================================================================
  // WALLET, WITHDRAWALS, TRANSFERS & SHOP INVENTORY
  // =========================================================================
  app.get('/api/wallet/state', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const [txs, withdrawals] = await Promise.all([
      db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userUid, req.authUser!.uid))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(50),
      listUserWithdrawals(req.authUser!.uid),
    ]);
    const selfPublicId = req.authUser!.publicId;
    res.json({
      ok: true,
      user: sanitizeUserForClient(req.authUser!),
      transactions: txs.map((t) => ({ ...t, userUid: selfPublicId, actorUid: null })),
      withdrawals: withdrawals.map((w) => ({ ...w, userUid: selfPublicId, reviewedByUid: null })),
    });
  });

  app.get('/api/withdrawals', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rows = await listUserWithdrawals(req.authUser!.uid);
    const selfPublicId = req.authUser!.publicId;
    res.json({
      ok: true,
      withdrawals: rows.map((w) => ({ ...w, userUid: selfPublicId, reviewedByUid: null })),
    });
  });

  app.post('/api/withdrawals', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await createWithdrawalRequestAtomic({
        userUid: req.authUser!.uid,
        amountCoins: Number(req.body?.amountCoins || 0),
        payoutMethod: req.body?.payoutMethod === 'bank' ? 'bank' : 'upi',
        accountHolderName: String(req.body?.accountHolderName || ''),
        upiOrAccount: String(req.body?.upiOrAccount || ''),
        ifscOrBank: typeof req.body?.ifscOrBank === 'string' ? req.body.ifscOrBank : undefined,
      });
      const [user, withdrawals] = await Promise.all([
        getFullUserView(req.authUser!.uid),
        listUserWithdrawals(req.authUser!.uid),
      ]);
      const selfPublicId = req.authUser!.publicId;
      res.json({
        ok: true,
        request: { ...result.request, userUid: selfPublicId, reviewedByUid: null },
        withdrawals: withdrawals.map((w) => ({ ...w, userUid: selfPublicId, reviewedByUid: null })),
        user: user ? sanitizeUserForClient(user) : null,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Withdrawal request failed.' });
    }
  });

  app.post('/api/wallet/transfer', requireVerifiedSession, (_req, res) => {
    res.status(403).json({
      error: 'User-to-user coin transfers are permanently disabled.',
    });
  });

  app.post('/api/shop/buy', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const itemId = String(req.body?.itemId || '').trim();
    const category = String(req.body?.category || 'ring').trim();
    const priceCoins = Math.max(0, Math.floor(Number(req.body?.priceCoins ?? 0)));
    const durationDays = req.body?.durationDays ? Math.max(1, Math.floor(Number(req.body.durationDays))) : undefined;
    if (!itemId) {
      res.status(400).json({ error: 'Missing itemId.' });
      return;
    }
    try {
      const result = await buyShopItemAtomic({
        userUid: req.authUser!.uid,
        itemId,
        category,
        priceCoins,
        durationDays,
      });
      const user = await getFullUserView(req.authUser!.uid);
      res.json({ ok: true, purchase: result, user: user ? sanitizeUserForClient(user) : null });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Purchase failed.' });
    }
  });

  app.post('/api/shop/equip', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const category = String(req.body?.category || '');
    const itemId = req.body?.itemId ? String(req.body.itemId) : null;
    if (itemId) {
      const [owned] = await db
        .select()
        .from(userInventory)
        .where(and(eq(userInventory.userUid, req.authUser!.uid), eq(userInventory.itemId, itemId)));
      if (!owned) {
        res.status(403).json({ error: 'You do not own this item.' });
        return;
      }
      if (owned.expiresAt && owned.expiresAt.getTime() <= Date.now()) {
        res.status(403).json({ error: 'This 3-day item has expired.' });
        return;
      }
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (category === 'frame') patch.equippedFrameId = itemId;
    else if (category === 'ring') patch.equippedRingId = itemId;
    else if (category === 'entry') patch.equippedEntryId = itemId;
    else {
      res.status(400).json({ error: 'Unsupported equip category.' });
      return;
    }
    await db.update(profiles).set(patch).where(eq(profiles.userUid, req.authUser!.uid));
    const user = await getFullUserView(req.authUser!.uid);
    res.json({ ok: true, user: user ? sanitizeUserForClient(user) : null });
  });

  app.get('/api/shop/items', requireVerifiedSession, async (_req, res) => {
    try {
      const items = await listShopItems(false);
      res.json({ ok: true, items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load shop items.' });
    }
  });

  app.get('/api/referrals/me', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const summary = await getReferralSummaryForUser(req.authUser!.uid);
      res.json({ ok: true, referralSummary: summary });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load referral summary.' });
    }
  });

  app.post('/api/referrals/claim', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const inviteCode = String(req.body?.inviteCode || '').trim();
    if (!inviteCode) {
      res.status(400).json({ error: 'Invite code is required.' });
      return;
    }
    try {
      const result = await claimReferralCodeAtomic({
        invitedUid: req.authUser!.uid,
        inviteCode,
      });
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.inviterUid, { type: 'wallet:updated', coins: result.inviterCoins });
      hub?.sendToUser(req.authUser!.uid, { type: 'wallet:updated', coins: result.invitedCoins });
      const [user, referralSummary] = await Promise.all([
        getFullUserView(req.authUser!.uid),
        getReferralSummaryForUser(req.authUser!.uid),
      ]);
      res.json({
        ok: true,
        rewardCoins: result.rewardCoins,
        inviterPublicId: result.inviterPublicId,
        user: user ? sanitizeUserForClient(user) : null,
        referralSummary,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to claim referral reward.' });
    }
  });

  // =========================================================================
  // GIFTS, CHARM & TOP 50 RANKINGS (Weekly / Monthly / Overall)
  // =========================================================================
  app.get('/api/gifts', requireVerifiedSession, async (_req, res) => {
    const rows = await db.select().from(gifts).where(eq(gifts.active, true)).orderBy(gifts.giftNumber);
    res.json({ ok: true, gifts: rows });
  });

  app.get('/api/gifts/custom', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const items = await getUserCustomGifts(req.authUser!.uid);
      res.json({ ok: true, submissions: items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load custom gifts.' });
    }
  });

  app.get('/api/gifts/my-submissions', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const items = await getUserCustomGifts(req.authUser!.uid);
      res.json({ ok: true, submissions: items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load submissions.' });
    }
  });

  app.post('/api/gifts/submit', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const submission = await submitCustomGift({
        creatorUid: req.authUser!.uid,
        name: String(req.body?.name || ''),
        cost: Number(req.body?.cost || 100),
        charmValue: Number(req.body?.charmValue || req.body?.cost || 100),
        rarity: String(req.body?.rarity || 'Signature'),
        description: String(req.body?.description || ''),
        primaryColor: String(req.body?.primaryColor || '#F43F5E'),
        secondaryColor: String(req.body?.secondaryColor || '#F59E0B'),
        particleStyle: String(req.body?.particleStyle || 'heart'),
        artworkUrl: typeof req.body?.artworkUrl === 'string' ? req.body.artworkUrl : null,
        animationVideoUrl: typeof req.body?.animationVideoUrl === 'string' ? req.body.animationVideoUrl : null,
        videoFileName: typeof req.body?.videoFileName === 'string' ? req.body.videoFileName : null,
      });
      res.json({ ok: true, submission });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Custom gift submission failed.' });
    }
  });

  app.post('/api/gifts/send', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const giftId = String(req.body?.giftId || '').trim();
    const rawRecipient = String(req.body?.recipientUid || '').trim();
    const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId : undefined;
    const customMessage = typeof req.body?.customMessage === 'string' ? req.body.customMessage : undefined;
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(req.body?.quantity ?? 1))));

    if (!giftId || !rawRecipient) {
      res.status(400).json({ error: 'giftId and recipientUid required.' });
      return;
    }

    try {
      const resolvedRecipient = await resolveUserByUidOrPublicId(rawRecipient);
      const giftRes = await sendGiftAtomic({
        senderUid: req.authUser!.uid,
        recipientUid: resolvedRecipient ? resolvedRecipient.uid : rawRecipient,
        giftId,
        quantity,
        roomId,
        customMessage,
      });
      const updatedUser = await getFullUserView(req.authUser!.uid);

      if (roomId) {
        options.getRealtimeHub?.()?.broadcastToRoom(roomId, {
          type: 'room:gift-fx',
          roomId,
          gift: giftRes.gift,
          quantity: giftRes.quantity,
          senderUid: req.authUser!.publicId,
          senderName: req.authUser!.name,
          recipientUid: resolvedRecipient ? resolvedRecipient.publicId : rawRecipient,
          charmEarned: giftRes.charmAwarded,
          customMessage,
        });
      }

      res.json({
        ok: true,
        charmEarned: giftRes.charmAwarded,
        randomCoinsEarned: giftRes.bonusCoins,
        vipPointsEarned: giftRes.vipPointsEarned,
        user: updatedUser ? sanitizeUserForClient(updatedUser) : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gift send failed.';
      res.status(400).json({ error: msg === 'INSUFFICIENT_COINS' ? 'Insufficient coins balance.' : msg });
    }
  });

  app.get('/api/rankings', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rawPeriod = String(req.query.period || 'overall').toLowerCase();
    const period =
      rawPeriod === 'weekly' ? 'weekly' : rawPeriod === 'monthly' ? 'monthly' : 'overall';
    const leaderboard = await getTop50Rankings(period);
    res.json({ ok: true, period, leaderboard, currentUser: sanitizeUserForClient(req.authUser!) });
  });

  // =========================================================================
  // TASKS (DAILY / WEEKLY / EVENT)
  // =========================================================================
  app.get('/api/tasks', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const [list, claimedTaskChests] = await Promise.all([
      getUserTasksWithProgress(req.authUser!.uid),
      getClaimedTaskChests(req.authUser!.uid),
    ]);
    res.json({ ok: true, tasks: list, claimedTaskChests });
  });

  app.post('/api/tasks/:taskId/claim', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await claimTaskRewardAtomic(req.authUser!.uid, String(req.params.taskId));
      const [user, claimedTaskChests] = await Promise.all([
        getFullUserView(req.authUser!.uid),
        getClaimedTaskChests(req.authUser!.uid),
      ]);
      res.json({
        ok: true,
        coinsAwarded: result.coinsAwarded,
        claimedTaskChests,
        user: user ? sanitizeUserForClient(user) : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Task claim failed.';
      const status = msg === 'TASK_ALREADY_CLAIMED' ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/tasks/chests/:step/claim', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const step = Number(req.params.step);
      const result = await claimTaskChestAtomic(req.authUser!.uid, step);
      const [user, claimedTaskChests] = await Promise.all([
        getFullUserView(req.authUser!.uid),
        getClaimedTaskChests(req.authUser!.uid),
      ]);
      res.json({
        ok: true,
        step: result.step,
        label: result.label,
        coinsAwarded: result.coinsAwarded,
        claimedTaskChests,
        user: user ? sanitizeUserForClient(user) : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chest claim failed.';
      const status = msg === 'CHEST_ALREADY_CLAIMED' ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });

  // =========================================================================
  // VOICE ROOMS
  // =========================================================================
  app.get('/api/rooms', requireVerifiedSession, async (_req: AuthenticatedRequest, res) => {
    await ensureSeedData();
    await ensureVoiceRoomsHaveOwners();
    const hub = options.getRealtimeHub?.();
    if (Date.now() - lastOfficialRoomCheckAt > 15_000) {
      lastOfficialRoomCheckAt = Date.now();
      await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin()).catch(() => {});
    }
    const rows = await db
      .select()
      .from(voiceRooms)
      .orderBy(desc(voiceRooms.isOfficial), desc(voiceRooms.roomLevel));
    const uidMap = await mapUidsToPublicIds(
      rows.flatMap((r) => [
        r.ownerUid,
        ...(Array.isArray(r.adminUids) ? r.adminUids : []),
      ])
    );
    res.json({
      ok: true,
      rooms: rows.map((r) =>
        serializeVoiceRoomForClient(r, uidMap, hub ? hub.getRoomParticipants(r.id).length : 0)
      ),
    });
  });

  app.get('/api/rooms/:roomId', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const requested = String(req.params.roomId || '').trim();
    if (!requested) {
      res.status(400).json({ ok: false, error: 'Missing roomId.' });
      return;
    }
    await ensureSeedData();
    await ensureVoiceRoomsHaveOwners();
    const hub = options.getRealtimeHub?.();
    if (Date.now() - lastOfficialRoomCheckAt > 15_000) {
      lastOfficialRoomCheckAt = Date.now();
      await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin()).catch(() => {});
    }

    const [room] = await db
      .select()
      .from(voiceRooms)
      .where(or(eq(voiceRooms.id, requested), eq(voiceRooms.roomCode, requested)));

    if (!room) {
      res.status(404).json({ ok: false, error: 'Voice room not found.' });
      return;
    }
    // Rooms are always enterable directly; closed status & overlay render inside VoiceRoomStage
    // whenever Owner and Admins are offline or absent.

    const uidMap = await mapUidsToPublicIds([
      room.ownerUid,
      ...(Array.isArray(room.adminUids) ? room.adminUids : []),
    ]);
    res.json({
      ok: true,
      room: serializeVoiceRoomForClient(room, uidMap, hub ? hub.getRoomParticipants(room.id).length : 0),
    });
  });

  app.post('/api/rooms/:roomId/reopen', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const roomId = String(req.params.roomId || '').trim();
    if (!roomId) {
      res.status(400).json({ error: 'Missing roomId.' });
      return;
    }
    try {
      const reopened = await reopenVoiceRoom({
        roomId,
        actorUser: req.authUser!,
      });
      const hub = options.getRealtimeHub?.();
      if (!reopened.isOfficial) {
        hub?.scheduleInitialRoomGrace(reopened.id);
      }
      hub?.broadcastToRoom(reopened.id, {
        type: 'room:status-changed',
        roomId: reopened.id,
        status: 'active',
        reason: null,
      });
      hub?.broadcastAll({ type: 'room:list-updated', updatedRoomId: reopened.id });
      res.json({
        ok: true,
        room: reopened,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reopen room.';
      const status = msg.toLowerCase().includes('only ') ? 403 : msg.includes('not found') ? 404 : 400;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/rooms/:roomId/verify-passcode', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const roomId = String(req.params.roomId || '').trim();
    const passcode = String(req.body?.passcode || '').trim();
    if (!roomId || !passcode) {
      res.status(400).json({ error: 'Room passcode is required.' });
      return;
    }
    const [room] = await db
      .select()
      .from(voiceRooms)
      .where(or(eq(voiceRooms.id, roomId), eq(voiceRooms.roomCode, roomId)));
    if (!room) {
      res.status(404).json({ error: 'Voice room not found.' });
      return;
    }
    if (!room.isLocked || !room.passcodeHash) {
      res.json({ ok: true });
      return;
    }
    const candidateHash = crypto
      .createHash('sha256')
      .update(`${SESSION_SECRET}:${passcode}`)
      .digest('hex');
    if (candidateHash !== room.passcodeHash) {
      res.status(403).json({ error: 'Incorrect room password. Please try again.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/rooms', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    const topic = String(req.body?.topic || 'Open Voice Sanctuary').trim();
    const categoryRaw = String(req.body?.category || 'Popular').trim();
    const category = ['Popular', 'Music', 'Chats', 'Teenagers'].includes(categoryRaw)
      ? categoryRaw
      : 'Popular';
    const seatCapacityRaw = Number(req.body?.seatCapacity || 15);
    const seatCapacity = [10, 15, 19].includes(seatCapacityRaw) ? seatCapacityRaw : 15;
    const ambianceRaw = String(req.body?.ambiance || 'indigo').trim().toLowerCase();
    const ambiance = ['indigo', 'saffron', 'emerald', 'crimson'].includes(ambianceRaw)
      ? ambianceRaw
      : 'indigo';
    const dpUrlRaw = typeof req.body?.dpUrl === 'string' ? req.body.dpUrl.trim() : '';
    const dpUrl =
      dpUrlRaw && isSafeMediaReference(dpUrlRaw) && dpUrlRaw.length <= 2_500_000
        ? dpUrlRaw
        : null;

    if (!title) {
      res.status(400).json({ error: 'Room name is required.' });
      return;
    }

    let roomCode = '';
    const customCodeRaw = String(req.body?.roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (customCodeRaw) {
      if (customCodeRaw.length < 3 || customCodeRaw.length > 24) {
        res.status(400).json({ error: 'Custom Room ID must be between 3 and 24 characters (A-Z, 0-9, -, _).' });
        return;
      }
      const [dup] = await db
        .select({ id: voiceRooms.id })
        .from(voiceRooms)
        .where(or(eq(voiceRooms.roomCode, customCodeRaw), eq(voiceRooms.id, customCodeRaw)));
      if (dup) {
        res.status(409).json({ error: `Room ID "${customCodeRaw}" is already taken. Choose a unique Room ID.` });
        return;
      }
      roomCode = customCodeRaw;
    } else {
      roomCode = `RM-${100000 + crypto.randomInt(0, 899999)}`;
    }

    const wantLock = Boolean(req.body?.isRoomLocked ?? req.body?.isLocked);
    const rawPasscode = String(req.body?.roomPasscode ?? req.body?.passcode ?? '').trim();
    if (wantLock && rawPasscode.length < 4) {
      res.status(400).json({ error: 'Please provide a 4-digit room password when lock is enabled.' });
      return;
    }
    const passcodeHash =
      wantLock && rawPasscode
        ? crypto.createHash('sha256').update(`${SESSION_SECRET}:${rawPasscode}`).digest('hex')
        : null;

    const roomModeRaw = String(req.body?.roomMode || 'Normal').trim();
    const roomMode = ['Normal', 'Action', 'Video', 'Music', 'PK', 'Party'].includes(roomModeRaw)
      ? roomModeRaw
      : 'Normal';
    const bgThemeByAmbiance: Record<string, string> = {
      indigo: 'bg-velocity-royal',
      saffron: 'bg-velocity-gold',
      emerald: 'bg-velocity-celestial',
      crimson: 'bg-velocity-neon',
    };

    const id = `room-${crypto.randomBytes(4).toString('hex')}`;
    let created: typeof voiceRooms.$inferSelect;
    try {
      created = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${req.authUser!.uid}))`);
        const existingOwned = await tx
          .select({ id: voiceRooms.id })
          .from(voiceRooms)
          .where(and(eq(voiceRooms.ownerUid, req.authUser!.uid), eq(voiceRooms.isOfficial, false)));
        if (existingOwned.length >= 1) {
          throw new Error('ROOM_LIMIT_REACHED');
        }
        if (customCodeRaw) {
          const [dupInsideTx] = await tx
            .select({ id: voiceRooms.id })
            .from(voiceRooms)
            .where(or(eq(voiceRooms.roomCode, roomCode), eq(voiceRooms.id, roomCode)));
          if (dupInsideTx) {
            throw new Error('ROOM_CODE_TAKEN');
          }
        }
        const [inserted] = await tx
          .insert(voiceRooms)
          .values({
            id,
            roomCode,
            title: title.slice(0, 60),
            topic: topic.slice(0, 120),
            category,
            ownerUid: req.authUser!.uid,
            hostName: req.authUser!.name,
            seatCapacity,
            activeSpeakerSlots: Math.min(seatCapacity, 12),
            isOfficial: false,
            isLocked: wantLock && Boolean(passcodeHash),
            passcodeHash,
            dpUrl,
            status: 'active',
            bgThemeId: bgThemeByAmbiance[ambiance] || 'bg-velocity-royal',
            ambiance,
            roomSettings: {
              roomMode,
              partnerSeatMode: 'Enable All',
              membershipFeeCoins: 0,
            },
          })
          .returning();
        return inserted;
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'ROOM_LIMIT_REACHED') {
        res.status(409).json({ error: 'You can only create 1 personal Voice Room.' });
        return;
      }
      if (err instanceof Error && err.message === 'ROOM_CODE_TAKEN') {
        res.status(409).json({ error: `Room ID "${roomCode}" is already taken. Choose a unique Room ID.` });
        return;
      }
      throw err;
    }

    const hub = options.getRealtimeHub?.();
    hub?.broadcastAll({ type: 'room:list-updated', addedRoomId: created.id });

    res.json({
      ok: true,
      room: serializeVoiceRoomForClient(created, { [req.authUser!.uid]: req.authUser!.publicId }, 0),
    });
  });

  app.post('/api/rooms/:roomId/admins/toggle', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const roomId = String(req.params.roomId || '').trim();
    const rawTarget = String(req.body?.targetUid || '').trim();
    if (!roomId || !rawTarget) {
      res.status(400).json({ error: 'roomId and targetUid are required.' });
      return;
    }

    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
    if (!room) {
      res.status(404).json({ error: 'Voice room not found.' });
      return;
    }
    if (room.isOfficial) {
      res.status(403).json({
        error: 'Official Rooms are controlled exclusively by App Admins.',
      });
      return;
    }
    if (room.status === 'closed') {
      res.status(410).json({
        ok: false,
        closed: true,
        roomId: room.id,
        reason: room.closedReason || DEFAULT_ROOM_CLOSED_REASON,
      });
      return;
    }
    if (room.ownerUid !== req.authUser!.uid) {
      res.status(403).json({ error: 'Only the room Owner can appoint or remove room Admins.' });
      return;
    }

    const resolvedTarget = await resolveUserByUidOrPublicId(rawTarget);
    if (!resolvedTarget) {
      res.status(404).json({ error: 'Target user not found.' });
      return;
    }
    if (resolvedTarget.uid === room.ownerUid) {
      res.status(400).json({ error: 'Room Owner already holds full Owner authority.' });
      return;
    }

    const currentAdmins = Array.isArray(room.adminUids) ? room.adminUids.map(String) : [];
    const isCurrentlyAdmin = currentAdmins.includes(resolvedTarget.uid);
    const maxAdmins = getMaxRoomAdminSlots(room.roomLevel);
    if (!isCurrentlyAdmin && currentAdmins.length >= maxAdmins) {
      res.status(400).json({ error: `Maximum ${maxAdmins} room Admin slots reached for Room Level ${room.roomLevel}.` });
      return;
    }

    const nextAdminUids = isCurrentlyAdmin
      ? currentAdmins.filter((u) => u !== resolvedTarget.uid)
      : [...currentAdmins, resolvedTarget.uid];

    const existingRoomSettings =
      room.roomSettings && typeof room.roomSettings === 'object'
        ? (room.roomSettings as Record<string, unknown>)
        : {};
    const existingRecords = Array.isArray(existingRoomSettings.operationRecords)
      ? existingRoomSettings.operationRecords
      : [];
    const nextOperationRecords = [
      {
        id: crypto.randomUUID(),
        action: isCurrentlyAdmin
          ? `Removed ${resolvedTarget.publicId} from Room Admin`
          : `Appointed ${resolvedTarget.publicId} as Room Admin`,
        actorName: req.authUser!.name || req.authUser!.publicId,
        actorUid: req.authUser!.publicId,
        createdAt: new Date().toISOString(),
      },
      ...existingRecords,
    ].slice(0, 50);

    await db
      .update(voiceRooms)
      .set({
        adminUids: nextAdminUids,
        roomSettings: { ...existingRoomSettings, operationRecords: nextOperationRecords },
        updatedAt: new Date(),
      })
      .where(eq(voiceRooms.id, room.id));

    const uidMap = await mapUidsToPublicIds(nextAdminUids);
    const publicAdminUids = nextAdminUids.map((u) => uidMap[u] || u);

    const hub = options.getRealtimeHub?.();
    if (hub) {
      await hub.syncRoomAdmins(room.id, nextAdminUids, publicAdminUids);
      hub.broadcastAll({ type: 'room:list-updated', updatedRoomId: room.id });
    }

    res.json({
      ok: true,
      roomId: room.id,
      targetUid: resolvedTarget.publicId,
      isAdmin: !isCurrentlyAdmin,
      adminUids: publicAdminUids,
      operationRecords: nextOperationRecords,
    });
  });

  app.patch('/api/rooms/:roomId/settings', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const roomId = String(req.params.roomId || '').trim();
    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
    if (!room) {
      res.status(404).json({ error: 'Voice room not found.' });
      return;
    }
    if (room.status === 'closed') {
      res.status(410).json({
        ok: false,
        closed: true,
        roomId: room.id,
        reason: room.closedReason || DEFAULT_ROOM_CLOSED_REASON,
      });
      return;
    }
    const isAuthorized = room.isOfficial
      ? isAppAdminRole(req.authUser!.role)
      : room.ownerUid === req.authUser!.uid ||
        (Array.isArray(room.adminUids) && room.adminUids.includes(req.authUser!.uid));
    if (!isAuthorized) {
      res.status(403).json({
        error: room.isOfficial
          ? 'Only App Admins can update Official Room settings.'
          : 'Only the room Owner or Admin can update room settings.',
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const changedLabels: string[] = [];

    if (typeof body.title === 'string' && body.title.trim()) {
      patch.title = body.title.trim().slice(0, 60);
      changedLabels.push(`Updated room title to "${patch.title}"`);
    }
    if (typeof body.topic === 'string') {
      patch.topic = body.topic.trim().slice(0, 120);
      changedLabels.push('Updated room topic');
    }
    if (typeof body.category === 'string' && ['Popular', 'Music', 'Chats', 'Teenagers'].includes(body.category)) {
      patch.category = body.category;
      changedLabels.push(`Changed category to ${body.category}`);
    }
    if (typeof body.dpUrl === 'string') {
      const cleanDp = body.dpUrl.trim();
      if (!cleanDp) {
        patch.dpUrl = null;
        changedLabels.push('Reset room cover photo');
      } else if (isSafeMediaReference(cleanDp) && cleanDp.length <= 2_500_000) {
        patch.dpUrl = cleanDp;
        changedLabels.push('Updated room cover photo');
      }
    }
    if (typeof body.bgThemeId === 'string' && body.bgThemeId.trim()) {
      patch.bgThemeId = body.bgThemeId.trim().slice(0, 40);
      changedLabels.push(`Changed room background theme`);
    }
    if (typeof body.bgUrl === 'string') {
      const cleanBg = body.bgUrl.trim();
      if (!cleanBg) {
        patch.bgUrl = null;
        changedLabels.push('Cleared custom wallpaper');
      } else if (isSafeMediaReference(cleanBg) && cleanBg.length <= 3_500_000) {
        patch.bgUrl = cleanBg;
        changedLabels.push('Uploaded custom room background');
      }
    }
    if (typeof body.isRoomLocked === 'boolean') {
      patch.isLocked = body.isRoomLocked;
      if (!body.isRoomLocked) {
        patch.passcodeHash = null;
        changedLabels.push('Disabled room password');
      } else {
        changedLabels.push('Enabled room password');
      }
    }
    if (typeof body.roomPasscode === 'string' && body.roomPasscode.trim()) {
      patch.passcodeHash = crypto
        .createHash('sha256')
        .update(`${SESSION_SECRET}:${body.roomPasscode.trim()}`)
        .digest('hex');
      changedLabels.push('Updated 4-digit room password');
    }

    const currentSettings =
      room.roomSettings && typeof room.roomSettings === 'object'
        ? { ...(room.roomSettings as Record<string, unknown>) }
        : {};
    const incomingSettings =
      body.roomSettings && typeof body.roomSettings === 'object'
        ? (body.roomSettings as Record<string, unknown>)
        : null;

    if (incomingSettings) {
      if (typeof incomingSettings.announcement === 'string') {
        currentSettings.announcement = incomingSettings.announcement.trim().slice(0, 300);
        changedLabels.push('Updated room announcement');
      }
      if (
        typeof incomingSettings.roomMode === 'string' &&
        ['Normal', 'Action', 'Video', 'Music', 'PK', 'Party'].includes(incomingSettings.roomMode)
      ) {
        currentSettings.roomMode = incomingSettings.roomMode;
        changedLabels.push(`Switched Room Mode to ${incomingSettings.roomMode}`);
      }
      if (typeof incomingSettings.roomTag === 'string' && incomingSettings.roomTag.trim()) {
        currentSettings.roomTag = incomingSettings.roomTag.trim().slice(0, 32);
        changedLabels.push(`Updated Room Tag to ${currentSettings.roomTag}`);
      }
      if (
        typeof incomingSettings.partnerSeatMode === 'string' &&
        ['Enable All', 'Owner & Admins', 'Locked'].includes(incomingSettings.partnerSeatMode)
      ) {
        currentSettings.partnerSeatMode = incomingSettings.partnerSeatMode;
        changedLabels.push(`Partner Seat set to ${incomingSettings.partnerSeatMode}`);
      }
      if (typeof incomingSettings.highQualityMode === 'boolean') {
        currentSettings.highQualityMode = incomingSettings.highQualityMode;
        changedLabels.push(
          incomingSettings.highQualityMode ? 'Enabled High Quality Mode' : 'Disabled High Quality Mode'
        );
      }
      if (typeof incomingSettings.banTextChat === 'boolean') {
        currentSettings.banTextChat = incomingSettings.banTextChat;
        changedLabels.push(
          incomingSettings.banTextChat ? 'Banned Text Chatting' : 'Allowed Text Chatting'
        );
      }
      if (typeof incomingSettings.banPhotoChat === 'boolean') {
        currentSettings.banPhotoChat = incomingSettings.banPhotoChat;
        changedLabels.push(
          incomingSettings.banPhotoChat ? 'Banned Photo Chatting' : 'Allowed Photo Chatting'
        );
      }
      if (typeof incomingSettings.banRedPacket === 'boolean') {
        currentSettings.banRedPacket = incomingSettings.banRedPacket;
        changedLabels.push(
          incomingSettings.banRedPacket ? 'Banned Red Packet' : 'Allowed Red Packet'
        );
      }
      if (incomingSettings.membershipFeeCoins !== undefined) {
        const fee = Math.max(0, Math.min(1_000_000, Math.floor(Number(incomingSettings.membershipFeeCoins) || 0)));
        currentSettings.membershipFeeCoins = fee;
        changedLabels.push(fee === 0 ? 'Set Membership Fees to Free' : `Set Membership Fees to ${fee} coins`);
      }
      if (Array.isArray(incomingSettings.blockedUids)) {
        const cleaned = Array.from(
          new Set(incomingSettings.blockedUids.map((u) => String(u || '').trim()).filter(Boolean))
        ).slice(0, 200);
        currentSettings.blockedUids = cleaned;
        changedLabels.push('Updated room blocklist');
      }
      if (typeof incomingSettings.associatedGroupName === 'string') {
        currentSettings.associatedGroupName = incomingSettings.associatedGroupName.trim().slice(0, 80);
        changedLabels.push(
          currentSettings.associatedGroupName
            ? `Linked group "${currentSettings.associatedGroupName}"`
            : 'Cleared associated group'
        );
      }
    }

    if (changedLabels.length > 0) {
      const existingRecords = Array.isArray(currentSettings.operationRecords)
        ? currentSettings.operationRecords
        : [];
      currentSettings.operationRecords = [
        {
          id: crypto.randomUUID(),
          action: changedLabels.join(' · '),
          actorName: req.authUser!.name || req.authUser!.publicId,
          actorUid: req.authUser!.publicId,
          createdAt: new Date().toISOString(),
        },
        ...existingRecords,
      ].slice(0, 50);
      patch.roomSettings = currentSettings;
    }

    const [updated] = await db
      .update(voiceRooms)
      .set(patch)
      .where(eq(voiceRooms.id, room.id))
      .returning();

    const hub = options.getRealtimeHub?.();
    const uidMap = await mapUidsToPublicIds([
      updated.ownerUid,
      ...(Array.isArray(updated.adminUids) ? updated.adminUids : []),
    ]);
    const serialized = serializeVoiceRoomForClient(
      updated,
      uidMap,
      hub ? hub.getRoomParticipants(updated.id).length : 0
    );

    if (hub) {
      hub.broadcastToRoom(room.id, {
        type: 'room:settings-updated',
        roomId: room.id,
        room: serialized,
      });
      hub.broadcastAll({ type: 'room:list-updated', updatedRoomId: room.id });
    }

    res.json({
      ok: true,
      room: serialized,
    });
  });

  app.post('/api/rooms/:roomId/leave', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const roomId = String(req.params.roomId || '').trim();
    if (!roomId) {
      res.status(400).json({ error: 'Missing roomId.' });
      return;
    }

    const hub = options.getRealtimeHub?.();
    if (hub) {
      await hub.forceUserLeaveRoom(roomId, req.authUser!.uid, { intentional: true });
    } else {
      await db
        .delete(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userUid, req.authUser!.uid)));
    }

    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId));
    res.json({
      ok: true,
      roomStatus: room?.status || 'closed',
    });
  });

  // =========================================================================
  // USERS SEARCH, PUBLIC PROFILE, FRIENDS, BLOCKS & PRIVATE DM CHAT
  // =========================================================================
  app.get('/api/users/search', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rl = consumeRateLimit(`search:${req.authUser!.uid}`, 60, 60_000);
    if (!rl.allowed) {
      res.status(429).json({ error: `Too many searches. Retry in ${rl.retryAfterSec}s.` });
      return;
    }
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
    const limit = Math.min(30, Math.max(5, Math.floor(Number(req.query.limit || 20))));
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        uid: users.uid,
        publicId: users.publicId,
        lastSeenAt: users.lastSeenAt,
        name: profiles.displayName,
        handle: profiles.handle,
        photoUrl: profiles.photoUrl,
        equippedFrameId: profiles.equippedFrameId,
        vipLevel: vipMemberships.vipLevel,
        vipStatus: vipMemberships.vipStatus,
      })
      .from(users)
      .innerJoin(profiles, eq(users.uid, profiles.userUid))
      .leftJoin(vipMemberships, eq(users.uid, vipMemberships.userUid))
      .where(
        and(
          eq(users.accountStatus, 'active'),
          q
            ? or(
                ilike(users.publicId, `%${q}%`),
                ilike(profiles.displayName, `%${q}%`),
                ilike(profiles.handle, `%${q}%`)
              )
            : undefined
        )
      )
      .orderBy(desc(users.lastSeenAt), desc(users.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const slice = rows.slice(0, limit);
    const uids = slice.map((r) => r.uid);
    const viewerUid = req.authUser!.uid;
    const now = Date.now();

    const [invRows, relRows] = await Promise.all([
      uids.length > 0
        ? db
            .select({
              userUid: userInventory.userUid,
              itemId: userInventory.itemId,
              expiresAt: userInventory.expiresAt,
            })
            .from(userInventory)
            .where(inArray(userInventory.userUid, uids))
        : Promise.resolve([]),
      uids.length > 0
        ? db
            .select()
            .from(friends)
            .where(
              or(
                and(eq(friends.requesterUid, viewerUid), inArray(friends.addresseeUid, uids)),
                and(inArray(friends.requesterUid, uids), eq(friends.addresseeUid, viewerUid))
              )
            )
        : Promise.resolve([]),
    ]);

    const validFrameSet = new Set(
      invRows
        .filter((inv) => !inv.expiresAt || new Date(inv.expiresAt).getTime() > now)
        .map((inv) => `${inv.userUid}:${inv.itemId}`)
    );

    const hub = options.getRealtimeHub?.();
    res.json({
      ok: true,
      page,
      hasMore,
      users: slice.map((r) => {
        let friendStatus: string = r.uid === viewerUid ? 'self' : 'none';
        let relationId: number | null = null;
        if (r.uid !== viewerUid) {
          const matches = relRows.filter((rel) => rel.requesterUid === r.uid || rel.addresseeUid === r.uid);
          const blocked = matches.find((m) => m.status === 'blocked');
          const accepted = matches.find((m) => m.status === 'accepted');
          const pendOut = matches.find((m) => m.status === 'pending' && m.requesterUid === viewerUid);
          const pendIn = matches.find((m) => m.status === 'pending' && m.addresseeUid === viewerUid);
          if (blocked) {
            friendStatus = blocked.requesterUid === viewerUid ? 'blocked_by_me' : 'blocked_by_them';
            relationId = blocked.id;
          } else if (accepted) {
            friendStatus = 'friends';
            relationId = accepted.id;
          } else if (pendOut) {
            friendStatus = 'pending_outgoing';
            relationId = pendOut.id;
          } else if (pendIn) {
            friendStatus = 'pending_incoming';
            relationId = pendIn.id;
          }
        }
        return {
          uid: r.publicId,
          publicId: r.publicId,
          name: r.name,
          handle: r.handle,
          photoUrl: r.photoUrl,
          equippedFrameId:
            r.equippedFrameId && validFrameSet.has(`${r.uid}:${r.equippedFrameId}`)
              ? r.equippedFrameId
              : null,
          vipLevel: r.vipStatus === 'active' ? Number(r.vipLevel ?? 0) : 0,
          online: hub ? hub.isUserOnline(r.uid) : false,
          lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
          friendStatus,
          relationId,
        };
      }),
    });
  });

  app.get('/api/users/:id/profile', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const requested = String(req.params.id || '').trim();
    const resolved = await resolveUserByUidOrPublicId(requested);
    const hub = options.getRealtimeHub?.();
    const isOnline = resolved && hub ? hub.isUserOnline(resolved.uid) : false;
    const profile = await getPublicUserProfile(requested, req.authUser!.uid, isOnline);
    if (!profile) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }
    res.json({ ok: true, profile });
  });

  // =========================================================================
  // CP PROPOSALS & SYNCHRONIZED RELATIONSHIPS
  // =========================================================================
  app.get('/api/cp/state', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const state = await getCpStateForUser(req.authUser!.uid);
    res.json({ ok: true, ...state });
  });

  app.post('/api/cp/propose', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const toUid = String(req.body?.toUid || req.body?.toPublicId || req.body?.targetId || '').trim();
    const ringNumber = Number(req.body?.ringNumber || 1);
    const ringName = String(req.body?.ringName || 'Couple Bond Ring').trim();
    if (!toUid) {
      res.status(400).json({ error: 'Target Public User ID is required.' });
      return;
    }
    try {
      const result = await proposeCpAtomic({
        fromUid: req.authUser!.uid,
        toIdentifier: toUid,
        ringNumber,
        ringName,
      });
      const [senderState, recipientState] = await Promise.all([
        getCpStateForUser(result.fromUidInternal),
        getCpStateForUser(result.toUidInternal),
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.toUidInternal, {
        type: 'cp:proposal',
        fromName: req.authUser!.name,
        fromUid: result.fromPublicId,
        ringName,
        cpState: recipientState,
      });
      hub?.sendToUser(result.fromUidInternal, { type: 'cp:updated', cpState: senderState });
      res.json({ ok: true, proposalId: result.proposal.id, cpState: senderState });
    } catch (err) {
      const status = err instanceof CpDomainError ? err.statusCode : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : 'CP proposal failed.' });
    }
  });

  app.post('/api/cp/proposals/:proposalId/respond', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const proposalId = String(req.params.proposalId || '').trim();
    const accept = Boolean(req.body?.accept);
    try {
      const result = await respondCpProposalAtomic({
        actorUid: req.authUser!.uid,
        proposalId,
        accept,
      });
      const [fromUser, toUser, fromState, toState, fromTags, toTags] = await Promise.all([
        getFullUserView(result.fromUidInternal),
        getFullUserView(result.toUidInternal),
        getCpStateForUser(result.fromUidInternal),
        getCpStateForUser(result.toUidInternal),
        getUserRelationshipTags(result.fromUidInternal, { activeOnly: false }),
        getUserRelationshipTags(result.toUidInternal, { activeOnly: false }),
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.fromUidInternal, {
        type: 'cp:updated',
        action: result.status,
        cpState: fromState,
        user: fromUser ? sanitizeUserForClient(fromUser) : null,
      });
      hub?.sendToUser(result.toUidInternal, {
        type: 'cp:updated',
        action: result.status,
        cpState: toState,
        user: toUser ? sanitizeUserForClient(toUser) : null,
      });
      hub?.sendToUser(result.fromUidInternal, {
        type: 'tag:updated',
        tags: fromTags,
        user: fromUser ? sanitizeUserForClient(fromUser) : null,
      });
      hub?.sendToUser(result.toUidInternal, {
        type: 'tag:updated',
        tags: toTags,
        user: toUser ? sanitizeUserForClient(toUser) : null,
      });
      if (result.status === 'accepted') {
        if (fromUser) {
          hub?.sendToUser(result.fromUidInternal, { type: 'user:refresh', user: sanitizeUserForClient(fromUser) });
        }
        if (toUser) {
          hub?.sendToUser(result.toUidInternal, { type: 'user:refresh', user: sanitizeUserForClient(toUser) });
        }
      }
      await hub?.refreshParticipantSocialState([result.fromUidInternal, result.toUidInternal]);
      res.json({
        ok: true,
        status: result.status,
        cpState: toState,
        user: toUser ? sanitizeUserForClient(toUser) : null,
      });
    } catch (err) {
      const status = err instanceof CpDomainError ? err.statusCode : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to respond to CP proposal.' });
    }
  });

  app.post('/api/cp/break', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await breakCpRelationshipAtomic(req.authUser!.uid);
      const [userA, userB, stateA, stateB, tagsA, tagsB] = await Promise.all([
        getFullUserView(result.userAUidInternal),
        getFullUserView(result.userBUidInternal),
        getCpStateForUser(result.userAUidInternal),
        getCpStateForUser(result.userBUidInternal),
        getUserRelationshipTags(result.userAUidInternal, { activeOnly: false }),
        getUserRelationshipTags(result.userBUidInternal, { activeOnly: false }),
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.userAUidInternal, {
        type: 'cp:updated',
        action: 'ended',
        cpState: stateA,
        user: userA ? sanitizeUserForClient(userA) : null,
      });
      hub?.sendToUser(result.userBUidInternal, {
        type: 'cp:updated',
        action: 'ended',
        cpState: stateB,
        user: userB ? sanitizeUserForClient(userB) : null,
      });
      hub?.sendToUser(result.userAUidInternal, {
        type: 'tag:updated',
        tags: tagsA,
        user: userA ? sanitizeUserForClient(userA) : null,
      });
      hub?.sendToUser(result.userBUidInternal, {
        type: 'tag:updated',
        tags: tagsB,
        user: userB ? sanitizeUserForClient(userB) : null,
      });
      if (userA) hub?.sendToUser(result.userAUidInternal, { type: 'user:refresh', user: sanitizeUserForClient(userA) });
      if (userB) hub?.sendToUser(result.userBUidInternal, { type: 'user:refresh', user: sanitizeUserForClient(userB) });
      await hub?.refreshParticipantSocialState([result.userAUidInternal, result.userBUidInternal]);

      const actorUser = result.userAUidInternal === req.authUser!.uid ? userA : userB;
      const actorState = result.userAUidInternal === req.authUser!.uid ? stateA : stateB;
      res.json({
        ok: true,
        cpState: actorState,
        user: actorUser ? sanitizeUserForClient(actorUser) : null,
      });
    } catch (err) {
      const status = err instanceof CpDomainError ? err.statusCode : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to end CP relationship.' });
    }
  });

  // =========================================================================
  // RELATIONSHIP TAGS (Bro, Bestie, Sister, Soulmate, Lover, Confident · Lv.1-10)
  // =========================================================================
  app.get('/api/tags', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const tags = await getUserRelationshipTags(req.authUser!.uid, { activeOnly: false });
    res.json({ ok: true, tags });
  });

  app.post('/api/tags/propose', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const toUid = String(req.body?.toUid || req.body?.targetId || '').trim();
    const tagType = String(req.body?.tagType || '').trim();
    if (!toUid || !tagType) {
      res.status(400).json({ error: 'Target Player ID and tagType are required.' });
      return;
    }
    try {
      const result = await proposeOrActivateRelationshipTag({
        fromUid: req.authUser!.uid,
        toIdentifier: toUid,
        tagType,
      });
      const [senderTags, targetTags] = await Promise.all([
        getUserRelationshipTags(req.authUser!.uid, { activeOnly: false }),
        getUserRelationshipTags(result.targetInternalUid, { activeOnly: false }),
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(result.targetInternalUid, {
        type: 'tag:updated',
        tags: targetTags,
        fromName: req.authUser!.name,
      });
      hub?.sendToUser(req.authUser!.uid, { type: 'tag:updated', tags: senderTags });
      res.json({ ok: true, tags: senderTags, tag: result.saved });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to invite relationship tag.' });
    }
  });

  app.post('/api/tags/:tagId/respond', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const tagId = String(req.params.tagId || '').trim();
    const accept = Boolean(req.body?.accept);
    try {
      const updated = await respondRelationshipTag({
        actorUid: req.authUser!.uid,
        tagId,
        accept,
      });
      const otherUid = updated.userAUid === req.authUser!.uid ? updated.userBUid : updated.userAUid;
      const [actorTags, otherTags, actorFull, otherFull] = await Promise.all([
        getUserRelationshipTags(req.authUser!.uid, { activeOnly: false }),
        getUserRelationshipTags(otherUid, { activeOnly: false }),
        getFullUserView(req.authUser!.uid),
        getFullUserView(otherUid),
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(otherUid, {
        type: 'tag:updated',
        tags: otherTags,
        user: otherFull ? sanitizeUserForClient(otherFull) : null,
      });
      hub?.sendToUser(req.authUser!.uid, {
        type: 'tag:updated',
        tags: actorTags,
        user: actorFull ? sanitizeUserForClient(actorFull) : null,
      });
      await hub?.refreshParticipantSocialState([req.authUser!.uid, otherUid]);
      res.json({ ok: true, tags: actorTags, user: actorFull ? sanitizeUserForClient(actorFull) : null });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to respond to tag invitation.' });
    }
  });

  app.post('/api/tags/:tagId/end', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const tagId = String(req.params.tagId || '').trim();
    try {
      const updated = await endRelationshipTag({ actorUid: req.authUser!.uid, tagId });
      const otherUid = updated.userAUid === req.authUser!.uid ? updated.userBUid : updated.userAUid;
      const [actorTags, otherTags, actorFull] = await Promise.all([
        getUserRelationshipTags(req.authUser!.uid, { activeOnly: false }),
        getUserRelationshipTags(otherUid, { activeOnly: false }),
        getFullUserView(req.authUser!.uid),
      ]);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(otherUid, { type: 'tag:updated', tags: otherTags });
      await hub?.refreshParticipantSocialState([req.authUser!.uid, otherUid]);
      res.json({ ok: true, tags: actorTags, user: actorFull ? sanitizeUserForClient(actorFull) : null });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to remove relationship tag.' });
    }
  });

  app.post('/api/action-room/tags/purchase', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const partnerUid = String(req.body?.partnerUid || req.body?.toUid || req.body?.targetId || '').trim();
    const tagType = String(req.body?.tagType || '').trim();
    const idempotencyKey =
      typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : undefined;
    if (!partnerUid || !tagType) {
      res.status(400).json({ error: 'partnerUid and tagType are required.' });
      return;
    }
    try {
      const result = await purchaseActionRoomTagAtomic({
        actorUid: req.authUser!.uid,
        partnerIdentifier: partnerUid,
        tagType,
        idempotencyKey,
      });
      const [actorTags, targetTags, actorFull, targetFull] = await Promise.all([
        getUserRelationshipTags(req.authUser!.uid, { activeOnly: false }),
        getUserRelationshipTags(result.targetInternalUid, { activeOnly: false }),
        getFullUserView(req.authUser!.uid),
        getFullUserView(result.targetInternalUid),
      ]);
      const sanitizedActor = actorFull ? sanitizeUserForClient(actorFull) : null;
      const sanitizedTarget = targetFull ? sanitizeUserForClient(targetFull) : null;
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(req.authUser!.uid, {
        type: 'wallet:updated',
        coins: result.coinsAfter,
        user: sanitizedActor,
      });
      hub?.sendToUser(req.authUser!.uid, {
        type: 'tag:updated',
        tags: actorTags,
        user: sanitizedActor,
      });
      hub?.sendToUser(result.targetInternalUid, {
        type: 'tag:updated',
        tags: targetTags,
        fromName: req.authUser!.name,
        user: sanitizedTarget,
      });
      await hub?.refreshParticipantSocialState([req.authUser!.uid, result.targetInternalUid]);
      res.json({
        ok: true,
        tag: result.saved,
        tags: actorTags,
        user: sanitizedActor,
        priceCoins: result.priceCoins,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to purchase Action Room tag.' });
    }
  });

  app.get('/api/friends', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const uid = req.authUser!.uid;
    const q = String(req.query.q || '').trim().toLowerCase();
    const rows = await db
      .select()
      .from(friends)
      .where(or(eq(friends.requesterUid, uid), eq(friends.addresseeUid, uid)));
    const hub = options.getRealtimeHub?.();

    const peerUids = Array.from(
      new Set(rows.map((r) => (r.requesterUid === uid ? r.addresseeUid : r.requesterUid)))
    );
    const peerDetails: Record<string, FullUserView> = {};
    for (const pid of peerUids) {
      const p = await getFullUserView(pid);
      if (p) peerDetails[pid] = p;
    }

    const serialized = rows
      .map((r) => {
        const peerUid = r.requesterUid === uid ? r.addresseeUid : r.requesterUid;
        const peer = peerDetails[peerUid];
        const reqPublic = r.requesterUid === uid ? req.authUser!.publicId : (peerDetails[r.requesterUid]?.publicId || r.requesterUid);
        const addPublic = r.addresseeUid === uid ? req.authUser!.publicId : (peerDetails[r.addresseeUid]?.publicId || r.addresseeUid);
        return {
          ...r,
          requesterUid: reqPublic,
          addresseeUid: addPublic,
          direction: r.requesterUid === uid ? 'outgoing' : 'incoming',
          peer: peer ? sanitizeUserForClient(peer) : null,
          online: hub ? hub.isUserOnline(peerUid) : false,
          lastSeenAt: peer?.lastSeenAt ?? null,
        };
      })
      .filter((rel) => {
        if (!q) return true;
        const nameMatch = (rel.peer?.name || '').toLowerCase().includes(q);
        const idMatch = (rel.peer?.publicId || '').toLowerCase().includes(q);
        const handleMatch = (rel.peer?.handle || '').toLowerCase().includes(q);
        return nameMatch || idMatch || handleMatch;
      });

    res.json({ ok: true, relations: serialized });
  });

  app.post('/api/friends/request', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const targetIdentifier = String(req.body?.targetUidOrPublicId || '').trim();
    const target = await resolveUserByUidOrPublicId(targetIdentifier);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.uid === req.authUser!.uid) {
      res.status(400).json({ error: 'Cannot add yourself as a friend.' });
      return;
    }
    if (await isBlockedBetween(req.authUser!.uid, target.uid)) {
      res.status(403).json({ error: 'Action blocked.' });
      return;
    }

    const existingRows = await db
      .select()
      .from(friends)
      .where(
        or(
          and(eq(friends.requesterUid, req.authUser!.uid), eq(friends.addresseeUid, target.uid)),
          and(eq(friends.requesterUid, target.uid), eq(friends.addresseeUid, req.authUser!.uid))
        )
      );

    const alreadyAccepted = existingRows.find((r) => r.status === 'accepted');
    if (alreadyAccepted) {
      res.status(409).json({ error: 'You are already friends.' });
      return;
    }
    const existingOutgoing = existingRows.find(
      (r) => r.requesterUid === req.authUser!.uid && r.status === 'pending'
    );
    if (existingOutgoing) {
      res.json({
        ok: true,
        alreadyPending: true,
        relation: {
          ...existingOutgoing,
          requesterUid: req.authUser!.publicId,
          addresseeUid: target.publicId,
        },
      });
      return;
    }

    const existingIncoming = existingRows.find(
      (r) => r.requesterUid === target.uid && r.addresseeUid === req.authUser!.uid && r.status === 'pending'
    );
    const hub = options.getRealtimeHub?.();
    if (existingIncoming) {
      const [acceptedRel] = await db
        .update(friends)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(friends.id, existingIncoming.id))
        .returning();
      hub?.sendToUser(target.uid, {
        type: 'friend:accepted',
        byName: req.authUser!.name,
        byPublicId: req.authUser!.publicId,
      });
      hub?.sendToUser(target.uid, { type: 'friend:updated', peerPublicId: req.authUser!.publicId });
      hub?.sendToUser(req.authUser!.uid, { type: 'friend:updated', peerPublicId: target.publicId });
      res.json({
        ok: true,
        autoAccepted: true,
        relation: {
          ...acceptedRel,
          requesterUid: target.publicId,
          addresseeUid: req.authUser!.publicId,
        },
      });
      return;
    }

    const [saved] = await db
      .insert(friends)
      .values({ requesterUid: req.authUser!.uid, addresseeUid: target.uid, status: 'pending' })
      .onConflictDoUpdate({
        target: [friends.requesterUid, friends.addresseeUid],
        set: { status: 'pending', updatedAt: new Date() },
      })
      .returning();

    await recordTaskActionProgress(req.authUser!.uid, 'add_friend', 1).catch(() => {});
    await db.insert(notifications).values({
      userUid: target.uid,
      type: 'friend',
      title: 'New Friend Request',
      body: `${req.authUser!.name} (${req.authUser!.publicId}) sent you a friend request.`,
    });
    hub?.sendToUser(target.uid, { type: 'friend:request', from: req.authUser!.name, fromPublicId: req.authUser!.publicId });
    hub?.sendToUser(target.uid, { type: 'friend:updated', peerPublicId: req.authUser!.publicId });
    hub?.sendToUser(req.authUser!.uid, { type: 'friend:updated', peerPublicId: target.publicId });
    res.json({
      ok: true,
      relation: { ...saved, requesterUid: req.authUser!.publicId, addresseeUid: target.publicId },
    });
  });

  app.post('/api/friends/respond', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const relationId = Number(req.body?.relationId);
    const accept = Boolean(req.body?.accept);
    const [rel] = await db.select().from(friends).where(eq(friends.id, relationId));
    if (!rel || rel.addresseeUid !== req.authUser!.uid) {
      res.status(404).json({ error: 'Friend request not found.' });
      return;
    }
    const [updated] = await db
      .update(friends)
      .set({ status: accept ? 'accepted' : 'rejected', updatedAt: new Date() })
      .where(eq(friends.id, relationId))
      .returning();
    const uidMap = await mapUidsToPublicIds([updated.requesterUid, updated.addresseeUid]);
    const hub = options.getRealtimeHub?.();
    if (accept) {
      hub?.sendToUser(updated.requesterUid, {
        type: 'friend:accepted',
        byName: req.authUser!.name,
        byPublicId: req.authUser!.publicId,
      });
    }
    hub?.sendToUser(updated.requesterUid, { type: 'friend:updated' });
    hub?.sendToUser(updated.addresseeUid, { type: 'friend:updated' });
    res.json({
      ok: true,
      relation: {
        ...updated,
        requesterUid: uidMap[updated.requesterUid] || updated.requesterUid,
        addresseeUid: uidMap[updated.addresseeUid] || updated.addresseeUid,
      },
    });
  });

  app.post('/api/friends/cancel', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const identifier = req.body?.relationId ?? req.body?.targetUidOrPublicId ?? req.body?.targetUid;
    if (!identifier) {
      res.status(400).json({ error: 'Specify relationId or targetUidOrPublicId.' });
      return;
    }
    try {
      const result = await cancelFriendRequest(req.authUser!.uid, identifier);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(req.authUser!.uid, { type: 'friend:updated' });
      if (result.addresseeUid) {
        hub?.sendToUser(result.addresseeUid, { type: 'friend:updated' });
      }
      res.json({ ok: true, cancelledId: result.cancelledId });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Unable to cancel friend request.' });
    }
  });

  app.delete('/api/friends/:targetId', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.targetId || '').trim();
    if (!targetId) {
      res.status(400).json({ error: 'Missing targetId.' });
      return;
    }
    try {
      const result = await unfriendUser(req.authUser!.uid, targetId);
      const hub = options.getRealtimeHub?.();
      hub?.sendToUser(req.authUser!.uid, { type: 'friend:updated' });
      if (result.unfriendedUid) {
        hub?.sendToUser(result.unfriendedUid, { type: 'friend:updated' });
      }
      res.json({ ok: true, unfriendedPublicId: result.unfriendedPublicId });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to unfriend user.' });
    }
  });

  app.post('/api/friends/block', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rawTarget = String(req.body?.targetUidOrPublicId || req.body?.targetUid || '').trim();
    const resolvedTarget = await resolveUserByUidOrPublicId(rawTarget);
    const targetInternalUid = resolvedTarget?.uid || rawTarget;
    if (!targetInternalUid || targetInternalUid === req.authUser!.uid) {
      res.status(400).json({ error: 'Invalid target user.' });
      return;
    }
    const [saved] = await db
      .insert(friends)
      .values({ requesterUid: req.authUser!.uid, addresseeUid: targetInternalUid, status: 'blocked' })
      .onConflictDoUpdate({
        target: [friends.requesterUid, friends.addresseeUid],
        set: { status: 'blocked', updatedAt: new Date() },
      })
      .returning();
    res.json({
      ok: true,
      relation: {
        ...saved,
        requesterUid: req.authUser!.publicId,
        addresseeUid: resolvedTarget?.publicId || rawTarget,
      },
    });
  });

  app.post('/api/friends/unblock', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rawTarget = String(req.body?.targetUidOrPublicId || req.body?.targetUid || '').trim();
    if (!rawTarget) {
      res.status(400).json({ error: 'Missing target user ID.' });
      return;
    }
    try {
      const result = await unblockUser(req.authUser!.uid, rawTarget);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to unblock user.' });
    }
  });

  app.get('/api/messages/dm/:peerUid', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rawPeer = String(req.params.peerUid);
    const resolvedPeer = await resolveUserByUidOrPublicId(rawPeer);
    const internalPeerUid = resolvedPeer?.uid || rawPeer;

    if (await isBlockedBetween(req.authUser!.uid, internalPeerUid)) {
      res.status(403).json({ error: 'Messages unavailable because a block is active.' });
      return;
    }
    if (!(await areUsersAcceptedFriends(req.authUser!.uid, internalPeerUid))) {
      res.status(403).json({ error: 'Only accepted friends can access direct messages.' });
      return;
    }

    const threadId = makeDmThreadId(req.authUser!.uid, internalPeerUid);
    const limit = Math.min(80, Math.max(10, Math.floor(Number(req.query.limit || 40))));
    const beforeParam = String(req.query.before || '').trim();
    let beforeDate: Date | null = null;
    if (beforeParam) {
      const d = new Date(beforeParam);
      if (!Number.isNaN(d.getTime())) beforeDate = d;
    }

    const rowsDesc = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.scope, 'dm'),
          eq(messages.threadId, threadId),
          beforeDate ? lt(messages.createdAt, beforeDate) : undefined
        )
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);

    const hasMore = rowsDesc.length > limit;
    const rows = rowsDesc.slice(0, limit).reverse();
    const uidMap = await mapUidsToPublicIds([req.authUser!.uid, internalPeerUid]);
    res.json({
      ok: true,
      hasMore,
      messages: rows.map((m) => ({
        ...m,
        senderUid: uidMap[m.senderUid] || m.senderUid,
        recipientUid: m.recipientUid ? (uidMap[m.recipientUid] || m.recipientUid) : null,
      })),
    });
  });

  app.post('/api/messages/dm/:peerUid/read', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rawPeer = String(req.params.peerUid);
    const resolvedPeer = await resolveUserByUidOrPublicId(rawPeer);
    const internalPeerUid = resolvedPeer?.uid || rawPeer;
    const threadId = makeDmThreadId(req.authUser!.uid, internalPeerUid);
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.scope, 'dm'),
          eq(messages.threadId, threadId),
          eq(messages.recipientUid, req.authUser!.uid),
          isNull(messages.readAt)
        )
      );
    res.json({ ok: true });
  });

  app.get('/api/messages/unread-count', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.scope, 'dm'),
          eq(messages.recipientUid, req.authUser!.uid),
          isNull(messages.readAt)
        )
      );
    res.json({ ok: true, unreadCount: Number(row?.count ?? 0) });
  });

  // =========================================================================
  // MOMENTS (POSTS, PHOTO/VIDEO UPLOAD, LIKES, COMMENTS, SHARE, REPORT)
  // =========================================================================
  app.get('/api/moments', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const viewerUid = req.authUser!.uid;
    const [rows, aclRows, myLikes] = await Promise.all([
      db
        .select({
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
          authorVipStatus: vipMemberships.vipStatus,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorUid, users.uid))
        .innerJoin(profiles, eq(posts.authorUid, profiles.userUid))
        .leftJoin(vipMemberships, eq(posts.authorUid, vipMemberships.userUid))
        .where(eq(posts.status, 'active'))
        .orderBy(desc(posts.createdAt))
        .limit(80),
      db
        .select()
        .from(platformSettings)
        .where(ilike(platformSettings.key, 'moment_acl:%')),
      db.select().from(likes).where(eq(likes.userUid, viewerUid)),
    ]);

    const aclMap = new Map<string, { visibility: 'public' | 'selected'; allowedUids: string[] }>();
    for (const row of aclRows) {
      const postId = row.key.replace(/^moment_acl:/, '');
      const val = (row.value && typeof row.value === 'object' ? row.value : {}) as Record<string, unknown>;
      aclMap.set(postId, {
        visibility: val.visibility === 'selected' ? 'selected' : 'public',
        allowedUids: Array.isArray(val.allowedUids)
          ? val.allowedUids.map((u) => String(u || '').trim()).filter(Boolean)
          : [],
      });
    }

    const likedSet = new Set(myLikes.map((l) => l.postId));
    const visibleRows = rows.filter((p) => {
      const acl = aclMap.get(p.id);
      if (!acl || acl.visibility === 'public') return true;
      return p.authorInternalUid === viewerUid || acl.allowedUids.includes(viewerUid);
    });

    res.json({
      ok: true,
      posts: visibleRows.slice(0, 50).map(({ authorInternalUid: _internal, ...p }) => {
        const acl = aclMap.get(p.id);
        return {
          ...p,
          authorUid: p.authorPublicId,
          authorVipLevel: p.authorVipStatus === 'active' ? Number(p.authorVipLevel ?? 0) : 0,
          likedByMe: likedSet.has(p.id),
          visibility: acl?.visibility ?? 'public',
        };
      }),
    });
  });

  app.get('/api/moments/shared', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const viewerUid = req.authUser!.uid;
    const [rows, aclRows, myLikes, friendRows] = await Promise.all([
      db
        .select({
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
          authorVipStatus: vipMemberships.vipStatus,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorUid, users.uid))
        .innerJoin(profiles, eq(posts.authorUid, profiles.userUid))
        .leftJoin(vipMemberships, eq(posts.authorUid, vipMemberships.userUid))
        .where(eq(posts.status, 'active'))
        .orderBy(desc(posts.createdAt))
        .limit(80),
      db
        .select()
        .from(platformSettings)
        .where(ilike(platformSettings.key, 'moment_acl:%')),
      db.select().from(likes).where(eq(likes.userUid, viewerUid)),
      db
        .select()
        .from(friends)
        .where(
          and(
            eq(friends.status, 'accepted'),
            or(eq(friends.requesterUid, viewerUid), eq(friends.addresseeUid, viewerUid))
          )
        ),
    ]);

    const acceptedFriendUids = new Set(
      friendRows.map((r) => (r.requesterUid === viewerUid ? r.addresseeUid : r.requesterUid))
    );
    const aclMap = new Map<string, { visibility: 'public' | 'selected'; allowedUids: string[] }>();
    for (const row of aclRows) {
      const postId = row.key.replace(/^moment_acl:/, '');
      const val = (row.value && typeof row.value === 'object' ? row.value : {}) as Record<string, unknown>;
      aclMap.set(postId, {
        visibility: val.visibility === 'selected' ? 'selected' : 'public',
        allowedUids: Array.isArray(val.allowedUids)
          ? val.allowedUids.map((u) => String(u || '').trim()).filter(Boolean)
          : [],
      });
    }
    const likedSet = new Set(myLikes.map((l) => l.postId));

    const sharedRows = rows.filter((p) => {
      const acl = aclMap.get(p.id);
      if (acl?.visibility === 'selected') {
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
          authorVipLevel: p.authorVipStatus === 'active' ? Number(p.authorVipLevel ?? 0) : 0,
          likedByMe: likedSet.has(p.id),
          visibility: acl?.visibility ?? 'public',
        };
      }),
    });
  });

  app.post('/api/moments', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      await assertUserNotBanned(req.authUser!.uid, ['chat', 'complete']);
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : 'Restricted from posting.' });
      return;
    }
    const caption = String(req.body?.caption || '').trim().slice(0, 1000);
    const mediaType = req.body?.mediaType === 'video' ? 'video' : req.body?.mediaUrl ? 'photo' : 'text';
    const mediaUrl = typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl.trim() : null;
    if (mediaUrl && !isSafeMediaReference(mediaUrl, true)) {
      res.status(400).json({ error: 'Invalid media format.' });
      return;
    }
    if (!caption && !mediaUrl) {
      res.status(400).json({ error: 'Caption or media is required.' });
      return;
    }

    const visibility = req.body?.visibility === 'selected' ? 'selected' : 'public';
    const rawAllowed = Array.isArray(req.body?.allowedUids)
      ? req.body.allowedUids.map((u: unknown) => String(u || '').trim()).filter(Boolean).slice(0, 100)
      : [];

    const resolvedAllowedUids: string[] = [];
    if (visibility === 'selected' && rawAllowed.length > 0) {
      for (const ident of rawAllowed) {
        const u = await resolveUserByUidOrPublicId(ident);
        if (u && !resolvedAllowedUids.includes(u.uid)) {
          resolvedAllowedUids.push(u.uid);
        }
      }
    }

    const id = `PST-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const [created] = await db
      .insert(posts)
      .values({ id, authorUid: req.authUser!.uid, mediaType, mediaUrl, caption })
      .returning();

    if (visibility === 'selected') {
      await db
        .insert(platformSettings)
        .values({
          key: `moment_acl:${created.id}`,
          value: { visibility: 'selected', allowedUids: resolvedAllowedUids },
          updatedByUid: req.authUser!.uid,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: {
            value: { visibility: 'selected', allowedUids: resolvedAllowedUids },
            updatedByUid: req.authUser!.uid,
            updatedAt: new Date(),
          },
        });
    }

    await recordTaskActionProgress(req.authUser!.uid, 'post_moment', 1).catch(() => {});
    res.json({
      ok: true,
      post: {
        ...created,
        authorUid: req.authUser!.publicId,
        authorPublicId: req.authUser!.publicId,
        authorVipLevel: req.authUser!.vipStatusRaw === 'active' ? req.authUser!.vipLevel : 0,
        visibility,
        allowedUids: rawAllowed,
      },
    });
  });

  app.post('/api/moments/:postId/like', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const postId = String(req.params.postId);
    const uid = req.authUser!.uid;
    const outcome = await db.transaction(async (tx) => {
      const [post] = await tx.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
      if (!post) return { found: false as const, liked: false };

      const deleted = await tx
        .delete(likes)
        .where(and(eq(likes.postId, postId), eq(likes.userUid, uid)))
        .returning({ id: likes.id });

      if (deleted.length > 0) {
        await tx
          .update(posts)
          .set({ likesCount: sql`GREATEST(0, ${posts.likesCount} - 1)` })
          .where(eq(posts.id, postId));
        return { found: true as const, liked: false };
      }

      const inserted = await tx
        .insert(likes)
        .values({ postId, userUid: uid })
        .onConflictDoNothing()
        .returning({ id: likes.id });

      if (inserted.length > 0) {
        await tx
          .update(posts)
          .set({ likesCount: sql`${posts.likesCount} + 1` })
          .where(eq(posts.id, postId));
      }
      return { found: true as const, liked: true };
    });

    if (!outcome.found) {
      res.status(404).json({ error: 'Moment post not found.' });
      return;
    }
    res.json({ ok: true, liked: outcome.liked });
  });

  app.get('/api/moments/:postId/comments', requireVerifiedSession, async (req, res) => {
    const postId = String(req.params.postId);
    const rows = await db
      .select({
        id: comments.id,
        postId: comments.postId,
        body: comments.body,
        createdAt: comments.createdAt,
        authorName: profiles.displayName,
        authorPublicId: users.publicId,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorUid, users.uid))
      .innerJoin(profiles, eq(comments.authorUid, profiles.userUid))
      .where(eq(comments.postId, postId))
      .orderBy(comments.createdAt);
    res.json({ ok: true, comments: rows.map((c) => ({ ...c, authorUid: c.authorPublicId })) });
  });

  app.post('/api/moments/:postId/comments', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    try {
      await assertUserNotBanned(req.authUser!.uid, ['chat', 'complete']);
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : 'Restricted from commenting.' });
      return;
    }
    const postId = String(req.params.postId);
    const body = String(req.body?.body || '').trim().slice(0, 400);
    if (!body) {
      res.status(400).json({ error: 'Comment text required.' });
      return;
    }
    const [created] = await db
      .insert(comments)
      .values({ postId, authorUid: req.authUser!.uid, body })
      .returning();
    await db.update(posts).set({ commentsCount: sql`${posts.commentsCount} + 1` }).where(eq(posts.id, postId));
    res.json({
      ok: true,
      comment: {
        ...created,
        authorUid: req.authUser!.publicId,
        authorName: req.authUser!.name,
        authorPublicId: req.authUser!.publicId,
      },
    });
  });

  app.post('/api/moments/:postId/share', requireVerifiedSession, async (req, res) => {
    const postId = String(req.params.postId);
    const updated = await db
      .update(posts)
      .set({ sharesCount: sql`${posts.sharesCount} + 1` })
      .where(eq(posts.id, postId))
      .returning({ id: posts.id });
    if (updated.length === 0) {
      res.status(404).json({ error: 'Moment post not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // =========================================================================
  // EVENTS, NOTIFICATIONS, REPORTS & MULTIPLAYER GAMES HISTORY
  // =========================================================================
  app.get('/api/events', requireVerifiedSession, async (_req, res) => {
    await ensureSeedData();
    const rows = await db.select().from(events).orderBy(desc(events.createdAt));
    res.json({ ok: true, events: rows });
  });

  app.post('/api/events/:eventId/join', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const eventId = String(req.params.eventId);
    await db
      .insert(eventParticipants)
      .values({ eventId, userUid: req.authUser!.uid, score: 0 })
      .onConflictDoNothing();
    res.json({ ok: true });
  });

  app.get('/api/notifications', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const rows = await getUserNotifications(req.authUser!.uid);
    const selfPublicId = req.authUser!.publicId;
    res.json({ ok: true, notifications: rows.map((n) => ({ ...n, userUid: n.userUid ? selfPublicId : null })) });
  });

  app.post('/api/notifications/read-all', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userUid, req.authUser!.uid));
    res.json({ ok: true });
  });

  app.post('/api/reports', requireVerifiedSession, async (req: AuthenticatedRequest, res) => {
    const targetType = String(req.body?.targetType || 'user');
    const rawTargetId = String(req.body?.targetId || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const details = typeof req.body?.details === 'string' ? req.body.details.trim() : null;
    if (!rawTargetId || !reason) {
      res.status(400).json({ error: 'targetId and reason required.' });
      return;
    }
    const resolvedTarget = targetType === 'user' ? await resolveUserByUidOrPublicId(rawTargetId) : null;
    const storedTargetId = resolvedTarget?.uid || rawTargetId;
    const [saved] = await db
      .insert(reports)
      .values({ reporterUid: req.authUser!.uid, targetType, targetId: storedTargetId, reason, details })
      .returning();
    res.json({
      ok: true,
      report: {
        ...saved,
        reporterUid: req.authUser!.publicId,
        targetId: resolvedTarget?.publicId || rawTargetId,
      },
    });
  });

  app.get('/api/games/matches', requireVerifiedSession, (_req, res) => {
    const hub = options.getRealtimeHub?.();
    res.json({ ok: true, matches: hub ? hub.gameEngine.listMatches() : [] });
  });

  app.get('/api/games/history', requireVerifiedSession, async (_req, res) => {
    const rows = await db.select().from(gameMatches).orderBy(desc(gameMatches.createdAt)).limit(25);
    const uidCandidates = rows.flatMap((m) => [
      m.hostUid,
      m.winnerUid || '',
      ...(Array.isArray(m.players) ? m.players.map((p: any) => String(p?.uid || '')) : []),
    ]);
    const uidMap = await mapUidsToPublicIds(uidCandidates);
    res.json({
      ok: true,
      history: rows.map((m) => ({
        ...m,
        hostUid: uidMap[m.hostUid] || m.hostUid,
        winnerUid: m.winnerUid ? (uidMap[m.winnerUid] || m.winnerUid) : null,
        players: Array.isArray(m.players)
          ? m.players.map((p: any) => ({ ...p, uid: uidMap[p.uid] || p.uid }))
          : [],
      })),
    });
  });

  // Mount Admin RBAC Router
  app.use(
    '/api/admin',
    createAdminRouter({
      requireAuth: requireVerifiedSession,
      getRealtimeHub: options.getRealtimeHub,
    })
  );

  // Guard all remaining /api/*
  app.use('/api', requireVerifiedSession, (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return app;
}

async function startServer() {
  let realtimeHub: RealtimeHub | null = null;
  const app = createApp({ getRealtimeHub: () => realtimeHub });
  const server = http.createServer(app);

  realtimeHub = new RealtimeHub(server, authenticateWebSocketRequest);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const candidateA = path.resolve(process.cwd(), 'dist');
    const candidateB = path.join(__dirname, 'dist');
    const candidateC = path.join(__dirname, '../dist');
    const distPath = [candidateA, candidateB, candidateC].find((p) =>
      fs.existsSync(path.join(p, 'index.html'))
    ) || candidateA;
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Listen immediately so Cloud Run startup/health checks pass without waiting on background DB sweeps
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`OG VELOCITY server listening on http://0.0.0.0:${PORT}`);
    void (async () => {
      await ensureDatabaseSchemaReady().catch((err) => {
        console.error('Schema readiness startup warning:', err);
      });
      await ensureNumericPublicIdsMigrated().catch((err) => {
        console.error('Public ID startup migration warning:', err);
      });
      await ensureSeedData().catch((err) => {
        console.error('Seed data initialization warning:', err);
      });
      await ensureOfficialRoomsSecurityState().catch((err) => {
        console.error('Official rooms security state initialization warning:', err);
      });
      await runVipDecaySweep().catch((err) => {
        console.error('Initial VIP decay sweep warning:', err);
      });
    })();
    setInterval(() => {
      void runVipDecaySweep().catch((err) => {
        console.error('Scheduled VIP decay sweep error:', err);
      });
      void db
        .delete(userSessions)
        .where(lt(userSessions.expiresAt, Date.now()))
        .catch(() => {});
    }, 3_600_000).unref();
  });
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
  startServer();
}
