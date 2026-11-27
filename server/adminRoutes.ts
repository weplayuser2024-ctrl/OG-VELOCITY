import crypto from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import appletFirebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { db } from '../src/db/index.ts';
import QRCode from 'qrcode';
import {
  ADMIN_PANEL_ROLES,
  APP_PERMISSIONS_CATALOG,
  addUserAdminNote,
  adminAdjustCoinsBatch,
  adminApproveCustomGift,
  adminGetTaskProgressList,
  adminGrantVipSubscription,
  adminListCustomGifts,
  adminListWithdrawals,
  adminRejectCustomGift,
  adminReviewWithdrawalAtomic,
  adminToggleWalletFreeze,
  adminUpdateCustomGift,
  adminUpdateUserTaskProgress,
  approvePaymentOrder,
  assignAdminUserPermissions,
  createUserBan,
  deleteShopItem,
  ensureOfficialRoomsSecurityState,
  getAdminPermissionHistory,
  getAdminPermissionSets,
  getAdminUserInspection,
  getAppConfig,
  getEffectiveAdminPermissions,
  getFullUserView,
  getPaymentQrVersions,
  getPermanentUpiConfig,
  getVipDecayConfig,
  isAppAdminRole,
  isSafeMediaReference,
  listShopItems,
  listUserBans,
  mapUidsToPublicIds,
  rejectPaymentOrder,
  reopenVoiceRoom,
  resolveUserByUidOrPublicId,
  revokeUserBan,
  runVipDecaySweep,
  sanitizeUserForClient,
  superAdminSetVip,
  updateAppConfig,
  updatePermanentUpiConfig,
  updateVipDecayConfig,
  upsertAdminPermissionSet,
  upsertShopItem,
  type AccountRole,
  type BanType,
  type FullUserView,
} from '../src/db/repository.ts';
import {
  adminUsers,
  auditLogs,
  coinPackages,
  events,
  giftTransactions,
  gifts,
  notifications,
  paymentOrders,
  platformSettings,
  posts,
  profiles,
  reports,
  rolesPermissions,
  roomBackgrounds,
  tasks,
  users,
  vipMemberships,
  vipPackages,
  vipPointLedger,
  vipSubscriptionHistory,
  voiceRooms,
  walletTransactions,
  wallets,
} from '../src/db/schema.ts';
import type { RealtimeHub } from './realtime.ts';

export interface AdminAuthedRequest extends Request {
  authUser?: FullUserView;
}

export function createAdminRouter(options: {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  getRealtimeHub?: () => RealtimeHub | null;
}) {
  const router = Router();

  const requireAdminRole = (allowedRoles?: AccountRole[], requiredPermission?: string) => {
    return async (req: AdminAuthedRequest, res: Response, next: NextFunction) => {
      const user = req.authUser;
      if (!user || !ADMIN_PANEL_ROLES.has(user.role)) {
        res.status(403).json({ error: 'Admin panel access denied.' });
        return;
      }
      if (user.role === 'super_admin') {
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
        if (effectivePerms.includes('*') || effectivePerms.includes(requiredPermission)) {
          next();
          return;
        }
      }
      res.status(403).json({ error: `Role "${user.role}" does not have permission for this action.` });
    };
  };

  router.use(options.requireAuth, requireAdminRole());

  // 1. Dashboard Overview Stats
  router.get('/stats', async (_req, res) => {
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
        eventCount,
      ] = await Promise.all([
        db
          .select({
            total: sql<number>`COUNT(*)`,
            active: sql<number>`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'active')`,
            suspended: sql<number>`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'suspended')`,
            banned: sql<number>`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'banned')`,
          })
          .from(users),
        db
          .select({ activeVip: sql<number>`COUNT(*) FILTER (WHERE ${vipMemberships.vipStatus} = 'active')` })
          .from(vipMemberships),
        db.select({ totalCoins: sql<number>`COALESCE(SUM(${wallets.coins}), 0)` }).from(wallets),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(paymentOrders)
          .where(eq(paymentOrders.status, 'pending_review')),
        db
          .select({ inr: sql<number>`COALESCE(SUM(${paymentOrders.amountInr}), 0)` })
          .from(paymentOrders)
          .where(eq(paymentOrders.status, 'approved')),
        db.select({ count: sql<number>`COUNT(*)` }).from(giftTransactions),
        db.select({ count: sql<number>`COUNT(*)` }).from(reports).where(eq(reports.status, 'open')),
        db.select({ count: sql<number>`COUNT(*)` }).from(voiceRooms).where(eq(voiceRooms.status, 'active')),
        db.select({ count: sql<number>`COUNT(*)` }).from(events).where(eq(events.status, 'live')),
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
          liveEvents: Number(eventCount[0]?.count ?? 0),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load stats.' });
    }
  });

  // 2. Users Management (search, inspect, suspend/ban/restore, history)
  router.get('/users', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));

    const rows = await db
      .select({
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
        vipCustomBenefits: vipMemberships.customBenefits,
      })
      .from(users)
      .leftJoin(profiles, eq(users.uid, profiles.userUid))
      .leftJoin(wallets, eq(users.uid, wallets.userUid))
      .leftJoin(vipMemberships, eq(users.uid, vipMemberships.userUid))
      .where(
        q
          ? or(
              eq(users.uid, q),
              ilike(users.publicId, `%${q}%`),
              ilike(users.email, `%${q}%`),
              ilike(users.phone, `%${q}%`),
              ilike(profiles.displayName, `%${q}%`)
            )
          : undefined
      )
      .orderBy(desc(users.createdAt))
      .limit(limit);

    res.json({ ok: true, users: rows });
  });

  router.get('/users/:uid/history', async (req, res) => {
    const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
    if (!resolved) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const targetUid = resolved.uid;
    const [walletTx, orders, subHistory, pointLedger, userDetail] = await Promise.all([
      db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userUid, targetUid))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(30),
      db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.userUid, targetUid))
        .orderBy(desc(paymentOrders.createdAt))
        .limit(20),
      db
        .select()
        .from(vipSubscriptionHistory)
        .where(eq(vipSubscriptionHistory.userUid, targetUid))
        .orderBy(desc(vipSubscriptionHistory.createdAt))
        .limit(25),
      db
        .select()
        .from(vipPointLedger)
        .where(eq(vipPointLedger.userUid, targetUid))
        .orderBy(desc(vipPointLedger.createdAt))
        .limit(40),
      getFullUserView(targetUid),
    ]);
    res.json({
      ok: true,
      user: userDetail,
      walletTransactions: walletTx,
      paymentOrders: orders,
      vipSubscriptionHistory: subHistory,
      vipPointLedger: pointLedger,
    });
  });

  router.post(
    '/users/:uid/status',
    requireAdminRole(['moderator', 'admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
      const targetUid = resolved?.uid || String(req.params.uid);
      const status = String(req.body?.status || '').toLowerCase();
      const reason = String(req.body?.reason || '').trim();
      if (!['active', 'suspended', 'banned'].includes(status)) {
        res.status(400).json({ error: 'Invalid account status.' });
        return;
      }
      if (targetUid === req.authUser!.uid) {
        res.status(400).json({ error: 'Cannot suspend/ban your own account.' });
        return;
      }

      const [targetUser] = await db.select().from(users).where(eq(users.uid, targetUid));
      if (!targetUser) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      if (targetUser.role === 'super_admin' && req.authUser!.role !== 'super_admin') {
        res.status(403).json({ error: 'Cannot change Super Admin status.' });
        return;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            accountStatus: status,
            banReason: status === 'active' ? null : reason || 'Moderated by Admin',
            updatedAt: new Date(),
          })
          .where(eq(users.uid, targetUid));

        await tx.insert(auditLogs).values({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          action: `user_status_${status}`,
          targetType: 'user',
          targetId: targetUid,
          details: { status, reason },
        });
      });

      const updated = await getFullUserView(targetUid);
      res.json({ ok: true, user: updated });
    }
  );

  // Admin & Super Admin: Grant/Extend VIP Subscription by Duration (Months Only — No VIP Level selection)
  router.post(
    '/vip-subscriptions/grant',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (req.body?.vipLevel !== undefined && req.body?.vipLevel !== null) {
        res.status(400).json({
          error:
            'VIP level selection is forbidden on subscription grants. Subscriptions always start at VIP 1 (or preserve earned progression).',
        });
        return;
      }
      const rawTarget = String(req.body?.targetUserUid || req.body?.targetUid || '').trim();
      const months = Number(req.body?.months);
      const reason = String(req.body?.reason || '').trim();
      if (!rawTarget) {
        res.status(400).json({ error: 'Target Public User ID is required.' });
        return;
      }
      if (reason.length < 3) {
        res.status(400).json({ error: 'Mandatory reason (at least 3 characters) is required.' });
        return;
      }
      const resolved = await resolveUserByUidOrPublicId(rawTarget);
      if (!resolved) {
        res.status(404).json({ error: 'Target user not found.' });
        return;
      }
      try {
        const updated = await adminGrantVipSubscription({
          adminUid: req.authUser!.uid,
          adminRole: req.authUser!.role,
          targetUserUid: resolved.uid,
          months,
          reason,
        });
        options.getRealtimeHub?.()?.sendToUser(resolved.uid, {
          type: 'user:refresh',
          user: updated ? sanitizeUserForClient(updated) : null,
        });
        res.json({ ok: true, user: updated ? sanitizeUserForClient(updated) : null });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'VIP grant failed.' });
      }
    }
  );

  // Admin VIP Control Overview: Subscription Grant History, Renewal History & Point Decay Logs
  router.get(
    '/vip-subscriptions/overview',
    requireAdminRole(['admin', 'super_admin', 'support_staff']),
    async (_req, res) => {
      try {
        const [subRows, ledgerRows, decayConfig] = await Promise.all([
          db
            .select()
            .from(vipSubscriptionHistory)
            .orderBy(desc(vipSubscriptionHistory.createdAt))
            .limit(60),
          db
            .select()
            .from(vipPointLedger)
            .orderBy(desc(vipPointLedger.createdAt))
            .limit(80),
          getVipDecayConfig(),
        ]);

        const allUids = Array.from(
          new Set([
            ...subRows.flatMap((r) => [r.userUid, r.actorUid || '']),
            ...ledgerRows.flatMap((r) => [r.userUid, r.actorUid || '']),
          ].filter(Boolean))
        );
        const uidMap = await mapUidsToPublicIds(allUids);
        const profileRows =
          allUids.length > 0
            ? await db
                .select({ userUid: profiles.userUid, displayName: profiles.displayName })
                .from(profiles)
                .where(sql`${profiles.userUid} = ANY(ARRAY[${sql.join(allUids.map((u) => sql`${u}`), sql`, `)}]::text[])`)
            : [];
        const nameMap = new Map(profileRows.map((p) => [p.userUid, p.displayName]));

        res.json({
          ok: true,
          decayConfig,
          subscriptionHistory: subRows.map((r) => ({
            ...r,
            userPublicId: uidMap[r.userUid] || r.userUid,
            userName: nameMap.get(r.userUid) || 'Player',
            actorPublicId: r.actorUid ? uidMap[r.actorUid] || r.actorUid : null,
            actorName: r.actorUid ? nameMap.get(r.actorUid) || 'Admin' : null,
          })),
          pointLedger: ledgerRows.map((l) => ({
            ...l,
            userPublicId: uidMap[l.userUid] || l.userUid,
            userName: nameMap.get(l.userUid) || 'Player',
            actorPublicId: l.actorUid ? uidMap[l.actorUid] || l.actorUid : null,
          })),
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load VIP overview.' });
      }
    }
  );

  // Super Admin ONLY: Configure VIP Decay Rules & Trigger Sweep
  router.put(
    '/vip-decay-config',
    requireAdminRole(['super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (req.authUser!.role !== 'super_admin') {
        res.status(403).json({ error: 'Only Super Admin can configure VIP point decay settings.' });
        return;
      }
      const next = await updateVipDecayConfig(req.authUser!.uid, {
        enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
        graceDays: req.body?.graceDays !== undefined ? Number(req.body.graceDays) : undefined,
        mode: req.body?.mode === 'percent' ? 'percent' : req.body?.mode === 'fixed' ? 'fixed' : undefined,
        dailyAmount: req.body?.dailyAmount !== undefined ? Number(req.body.dailyAmount) : undefined,
        dailyPercent: req.body?.dailyPercent !== undefined ? Number(req.body.dailyPercent) : undefined,
      });
      res.json({ ok: true, decayConfig: next });
    }
  );

  router.post(
    '/vip-decay/run',
    requireAdminRole(['super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (req.authUser!.role !== 'super_admin') {
        res.status(403).json({ error: 'Only Super Admin can manually run the VIP decay sweep.' });
        return;
      }
      const summary = await runVipDecaySweep(new Date());
      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: 'super_admin',
        action: 'manual_vip_decay_sweep',
        targetType: 'vip_decay',
        targetId: 'global',
        details: summary,
      });
      res.json({ ok: true, summary });
    }
  );

  // Admin & Super Admin: Activate / Renew / Remove VIP Membership (No manual level override)
  router.post(
    '/users/:uid/vip',
    requireAdminRole(['admin', 'super_admin'], 'vip:manage'),
    async (req: AdminAuthedRequest, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
      if (!resolved) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const targetUid = resolved.uid;
      const vipStatus = req.body?.vipStatus === 'active' ? 'active' : 'inactive';
      const durationDays = Number(req.body?.durationDays ?? 30);
      const customBenefits = Array.isArray(req.body?.customBenefits)
        ? req.body.customBenefits.map((b: unknown) => String(b).trim()).filter(Boolean)
        : undefined;
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 3) {
        res.status(400).json({ error: 'Mandatory reason (minimum 3 characters) is required for VIP assignment.' });
        return;
      }

      const updated = await superAdminSetVip({
        superAdminUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        targetUserUid: targetUid,
        vipStatus,
        durationDays,
        customBenefits,
        reason,
      });

      options.getRealtimeHub?.()?.sendToUser(targetUid, {
        type: 'user:refresh',
        user: updated ? sanitizeUserForClient(updated) : null,
      });
      res.json({ ok: true, user: updated ? sanitizeUserForClient(updated) : null });
    }
  );

  // 2b. Granular User Bans Management (Complete ID, Microphone, Voice Seat, Chat)
  router.get(
    '/bans',
    requireAdminRole(['moderator', 'admin', 'super_admin'], 'users:moderate'),
    async (req, res) => {
      try {
        const rawUid = String(req.query.userUid || '').trim();
        let resolvedUid: string | undefined;
        if (rawUid) {
          const found = await resolveUserByUidOrPublicId(rawUid);
          if (!found) {
            res.json({ ok: true, bans: [] });
            return;
          }
          resolvedUid = found.uid;
        }
        const activeOnly = req.query.activeOnly === 'true';
        const bans = await listUserBans({ userUid: resolvedUid, activeOnly });
        res.json({ ok: true, bans });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load user bans.' });
      }
    }
  );

  router.get(
    '/users/:uid/bans',
    requireAdminRole(['moderator', 'admin', 'super_admin'], 'users:moderate'),
    async (req, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid));
      if (!resolved) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const bans = await listUserBans({ userUid: resolved.uid });
      res.json({ ok: true, bans });
    }
  );

  router.post(
    '/users/:uid/bans',
    requireAdminRole(['moderator', 'admin', 'super_admin'], 'users:moderate'),
    async (req: AdminAuthedRequest, res) => {
      const banType = String(req.body?.banType || 'complete').trim().toLowerCase() as BanType;
      const durationRaw = req.body?.durationDays;
      const durationDays =
        durationRaw === null || durationRaw === undefined || durationRaw === ''
          ? null
          : Number(durationRaw);
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 2) {
        res.status(400).json({ error: 'Ban reason (at least 2 characters) is required.' });
        return;
      }
      try {
        const result = await createUserBan({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          targetIdentifier: String(req.params.uid),
          banType,
          durationDays,
          reason,
        });
        const hub = options.getRealtimeHub?.();
        if (hub) {
          await hub.enforceRealtimeBan(result.targetUid, banType, reason);
          const refreshed = await getFullUserView(result.targetUid);
          if (refreshed && banType !== 'complete') {
            hub.sendToUser(result.targetUid, {
              type: 'user:refresh',
              user: sanitizeUserForClient(refreshed),
            });
          }
        }
        res.json({ ok: true, ban: result.ban, targetPublicId: result.targetPublicId });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to apply ban.' });
      }
    }
  );

  const handleRevokeBan = async (req: AdminAuthedRequest, res: Response) => {
    const banId = Number(req.params.banId);
    if (!Number.isInteger(banId) || banId <= 0) {
      res.status(400).json({ error: 'Invalid banId.' });
      return;
    }
    try {
      const revoked = await revokeUserBan({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        banId,
      });
      const refreshed = await getFullUserView(revoked.userUid);
      if (refreshed) {
        options.getRealtimeHub?.()?.sendToUser(revoked.userUid, {
          type: 'user:refresh',
          user: sanitizeUserForClient(refreshed),
        });
      }
      res.json({ ok: true, revoked });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to revoke ban.' });
    }
  };

  router.post(
    '/bans/:banId/revoke',
    requireAdminRole(['moderator', 'admin', 'super_admin'], 'users:moderate'),
    handleRevokeBan
  );
  router.delete(
    '/bans/:banId',
    requireAdminRole(['moderator', 'admin', 'super_admin'], 'users:moderate'),
    handleRevokeBan
  );

  // 2c. Shop Rings, Frames & Effects CRUD
  router.get('/shop-items', async (_req, res) => {
    try {
      const items = await listShopItems(true);
      res.json({ ok: true, items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load shop items.' });
    }
  });

  router.post(
    '/shop-items',
    requireAdminRole(['admin', 'super_admin'], 'config:manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const saved = await upsertShopItem({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          item: {
            id: typeof req.body?.id === 'string' ? req.body.id : undefined,
            name: String(req.body?.name || ''),
            category: String(req.body?.category || 'ring'),
            description: typeof req.body?.description === 'string' ? req.body.description : '',
            priceCoins: Number(req.body?.priceCoins ?? 100000),
            durationDays:
              req.body?.durationDays === null || req.body?.durationDays === undefined || req.body?.durationDays === ''
                ? null
                : Number(req.body.durationDays),
            imageUrl: typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : null,
            previewColor: typeof req.body?.previewColor === 'string' ? req.body.previewColor : '#38BDF8',
            ringNumber: req.body?.ringNumber !== undefined && req.body?.ringNumber !== null ? Number(req.body.ringNumber) : null,
            seatFrameNumber:
              req.body?.seatFrameNumber !== undefined && req.body?.seatFrameNumber !== null
                ? Number(req.body.seatFrameNumber)
                : null,
            styleVariant: typeof req.body?.styleVariant === 'string' ? req.body.styleVariant : null,
            active: req.body?.active !== false,
            sortOrder: req.body?.sortOrder !== undefined ? Number(req.body.sortOrder) : 100,
          },
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: 'catalog:updated', kind: 'shop' });
        res.json({ ok: true, item: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save shop item.' });
      }
    }
  );

  router.patch(
    '/shop-items/:id',
    requireAdminRole(['admin', 'super_admin'], 'config:manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const id = String(req.params.id || '').trim();
        const existingList = await listShopItems(true);
        const existing = existingList.find((i) => i.id === id);
        if (!existing) {
          res.status(404).json({ error: 'Shop item not found.' });
          return;
        }
        const saved = await upsertShopItem({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          item: {
            id,
            name: typeof req.body?.name === 'string' ? req.body.name : existing.name,
            category: typeof req.body?.category === 'string' ? req.body.category : existing.category,
            description: typeof req.body?.description === 'string' ? req.body.description : existing.description,
            priceCoins: req.body?.priceCoins !== undefined ? Number(req.body.priceCoins) : existing.priceCoins,
            durationDays:
              req.body?.durationDays !== undefined
                ? req.body.durationDays === null || req.body.durationDays === ''
                  ? null
                  : Number(req.body.durationDays)
                : (existing.durationDays ?? null),
            imageUrl: req.body?.imageUrl !== undefined ? req.body.imageUrl : undefined,
            previewColor: typeof req.body?.previewColor === 'string' ? req.body.previewColor : existing.previewColor,
            ringNumber: req.body?.ringNumber !== undefined ? (req.body.ringNumber ? Number(req.body.ringNumber) : null) : (existing.ringNumber ?? null),
            seatFrameNumber:
              req.body?.seatFrameNumber !== undefined
                ? req.body.seatFrameNumber
                  ? Number(req.body.seatFrameNumber)
                  : null
                : (existing.seatFrameNumber ?? null),
            styleVariant: typeof req.body?.styleVariant === 'string' ? req.body.styleVariant : (existing.styleVariant ?? null),
            active: typeof req.body?.active === 'boolean' ? req.body.active : existing.active,
            sortOrder: req.body?.sortOrder !== undefined ? Number(req.body.sortOrder) : existing.sortOrder,
          },
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: 'catalog:updated', kind: 'shop' });
        res.json({ ok: true, item: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update shop item.' });
      }
    }
  );

  router.delete(
    '/shop-items/:id',
    requireAdminRole(['admin', 'super_admin'], 'config:manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const deleted = await deleteShopItem({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          id: String(req.params.id || '').trim(),
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: 'catalog:updated', kind: 'shop' });
        res.json({ ok: true, deleted });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete shop item.' });
      }
    }
  );

  // 3. Coin Wallet Adjustments (Single & Multi-User)
  router.post(
    '/wallets/adjust',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const rawTargets = Array.isArray(req.body?.targetUids)
        ? req.body.targetUids.map((s: unknown) => String(s).trim()).filter(Boolean)
        : req.body?.targetUid
          ? [String(req.body.targetUid).trim()]
          : [];
      const resolvedTargets: string[] = [];
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
      const reason = String(req.body?.reason || '').trim();

      if (targetUids.length === 0 || !Number.isInteger(deltaCoins) || deltaCoins === 0) {
        res.status(400).json({ error: 'Provide targetUids[] and a non-zero integer deltaCoins.' });
        return;
      }

      try {
        const results = await adminAdjustCoinsBatch({
          adminUid: req.authUser!.uid,
          adminRole: req.authUser!.role,
          targetUids,
          deltaCoins,
          reason: reason || (deltaCoins > 0 ? 'Admin Coin Grant' : 'Admin Coin Deduction'),
        });
        for (const r of results) {
          options.getRealtimeHub?.()?.sendToUser(r.uid, { type: 'wallet:updated', coins: r.coins });
        }
        res.json({ ok: true, results });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Coin adjustment failed.' });
      }
    }
  );

  // 4. Payment Orders Verification Queue (Permanent UPI QR + UTR + Screenshot)
  router.get('/payments', async (req, res) => {
    const statusFilter = String(req.query.status || '').trim();
    const rows = await db
      .select({
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
        reviewedAt: paymentOrders.reviewedAt,
      })
      .from(paymentOrders)
      .leftJoin(users, eq(paymentOrders.userUid, users.uid))
      .leftJoin(profiles, eq(paymentOrders.userUid, profiles.userUid))
      .where(statusFilter ? eq(paymentOrders.status, statusFilter) : undefined)
      .orderBy(desc(paymentOrders.createdAt))
      .limit(100);

    res.json({ ok: true, orders: rows });
  });

  // 4b. Withdrawal Requests & Wallet Freeze (Admin / Super Admin Banking)
  router.get(
    '/withdrawals',
    requireAdminRole(['admin', 'super_admin'], 'payments:read'),
    async (req, res) => {
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
      const list = await adminListWithdrawals(statusFilter);
      res.json({ ok: true, withdrawals: list });
    }
  );

  router.post(
    '/withdrawals/:requestId/review',
    requireAdminRole(['admin', 'super_admin'], 'payments:review'),
    async (req: AdminAuthedRequest, res) => {
      const requestId = String(req.params.requestId || '').trim();
      const action = req.body?.action === 'reject' ? 'reject' : req.body?.action === 'complete' ? 'complete' : 'approve';
      const reviewNote = typeof req.body?.reviewNote === 'string' ? req.body.reviewNote : undefined;
      try {
        const updated = await adminReviewWithdrawalAtomic({
          adminUid: req.authUser!.uid,
          adminRole: req.authUser!.role,
          requestId,
          action,
          reviewNote,
        });
        const updatedUser = await getFullUserView(updated.userUid);
        options.getRealtimeHub?.()?.sendToUser(updated.userUid, {
          type: 'wallet:updated',
          coins: updatedUser?.coins,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null,
        });
        res.json({
          ok: true,
          withdrawal: updated,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null,
        });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Withdrawal review failed.' });
      }
    }
  );

  router.post(
    '/wallets/:uid/freeze',
    requireAdminRole(['admin', 'super_admin'], 'wallet:adjust'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const result = await adminToggleWalletFreeze({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          targetIdentifier: String(req.params.uid || '').trim(),
          freeze: Boolean(req.body?.freeze),
          reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
        });
        const updatedUser = await getFullUserView(result.uid);
        if (updatedUser) {
          options.getRealtimeHub?.()?.sendToUser(result.uid, {
            type: 'user:refresh',
            user: sanitizeUserForClient(updatedUser),
          });
        }
        res.json({ ok: true, ...result, user: updatedUser ? sanitizeUserForClient(updatedUser) : null });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update wallet freeze state.' });
      }
    }
  );

  router.post(
    '/payments/:orderId/approve',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const orderId = String(req.params.orderId);
      const reviewNote = String(req.body?.reviewNote || '').trim();
      try {
        const order = await approvePaymentOrder({
          adminUid: req.authUser!.uid,
          adminRole: req.authUser!.role,
          orderId,
          reviewNote,
        });
        const updatedUser = await getFullUserView(order.userUid);
        options.getRealtimeHub?.()?.sendToUser(order.userUid, {
          type: 'payment:approved',
          order: updatedUser ? { ...order, userUid: updatedUser.publicId, reviewedByUid: null } : order,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null,
        });
        res.json({ ok: true, order, user: updatedUser });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Approval failed.';
        const status = msg === 'ORDER_ALREADY_APPROVED' ? 409 : 400;
        res.status(status).json({ error: msg });
      }
    }
  );

  router.post(
    '/payments/:orderId/reject',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const orderId = String(req.params.orderId);
      const reviewNote = String(req.body?.reviewNote || 'Invalid or unverified payment proof.').trim();
      try {
        const order = await rejectPaymentOrder({
          adminUid: req.authUser!.uid,
          adminRole: req.authUser!.role,
          orderId,
          reviewNote,
        });
        const updatedUser = await getFullUserView(order.userUid);
        options.getRealtimeHub?.()?.sendToUser(order.userUid, {
          type: 'payment:rejected',
          order: updatedUser ? { ...order, userUid: updatedUser.publicId, reviewedByUid: null } : order,
          user: updatedUser ? sanitizeUserForClient(updatedUser) : null,
        });
        res.json({ ok: true, order, user: updatedUser });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Rejection failed.' });
      }
    }
  );

  // 5. Super Admin ONLY: Dynamic Payment QR Management + Version History & Audit Trail
  router.get(
    '/upi-config',
    requireAdminRole(['admin', 'super_admin'], 'payments:qr_manage'),
    async (_req, res) => {
      const cfg = await getPermanentUpiConfig();
      const upiUri = `upi://pay?pa=${encodeURIComponent(cfg.upiId)}&pn=${encodeURIComponent(cfg.accountName)}&cu=INR`;
      const qrDataUrl =
        cfg.customQrDataUrl || (await QRCode.toDataURL(upiUri, { width: 320, margin: 1 }));
      res.json({ ok: true, upiConfig: { ...cfg, upiUri, qrDataUrl } });
    }
  );

  router.get(
    '/upi-config/history',
    requireAdminRole(['admin', 'super_admin'], 'payments:qr_manage'),
    async (_req, res) => {
      const versions = await getPaymentQrVersions(80);
      res.json({ ok: true, versions });
    }
  );

  router.put(
    '/upi-config',
    requireAdminRole(['super_admin'], 'payments:qr_manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const next = await updatePermanentUpiConfig(req.authUser!.uid, {
          actorRole: req.authUser!.role,
          accountName: typeof req.body?.accountName === 'string' ? req.body.accountName : undefined,
          upiId: typeof req.body?.upiId === 'string' ? req.body.upiId : undefined,
          provider: typeof req.body?.provider === 'string' ? req.body.provider : undefined,
          customQrDataUrl:
            req.body?.customQrDataUrl === null || typeof req.body?.customQrDataUrl === 'string'
              ? req.body.customQrDataUrl
              : undefined,
          note: typeof req.body?.note === 'string' ? req.body.note : undefined,
          active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
          screens: Array.isArray(req.body?.screens) ? req.body.screens.map(String) : undefined,
          changeSummary:
            typeof req.body?.changeSummary === 'string' ? req.body.changeSummary : undefined,
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: 'catalog:updated', kind: 'upiConfig' });
        res.json({ ok: true, upiConfig: next });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Failed to update UPI QR configuration.',
        });
      }
    }
  );

  // 6. Gift CRUD
  router.get('/gifts', async (_req, res) => {
    const rows = await db.select().from(gifts).orderBy(gifts.giftNumber);
    res.json({ ok: true, gifts: rows });
  });

  router.post(
    '/gifts',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id =
        String(req.body?.id || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') ||
        `gift-${crypto.randomBytes(3).toString('hex')}`;
      const name = String(req.body?.name || '').trim();
      const cost = Math.max(1, Math.floor(Number(req.body?.cost || 100)));
      const charmValue = Math.max(1, Math.floor(Number(req.body?.charmValue || cost)));
      if (!name) {
        res.status(400).json({ error: 'Gift name is required.' });
        return;
      }

      const rawArtworkUrl = typeof req.body?.artworkUrl === 'string' && req.body.artworkUrl.trim() ? req.body.artworkUrl.trim() : null;
      const rawAnimationUrl = typeof req.body?.animationUrl === 'string' && req.body.animationUrl.trim() ? req.body.animationUrl.trim() : null;
      if (rawArtworkUrl && !isSafeMediaReference(rawArtworkUrl, false)) {
        res.status(400).json({ error: 'Gift artwork must be a valid image URL or uploaded asset.' });
        return;
      }
      if (rawAnimationUrl && !isSafeMediaReference(rawAnimationUrl, true)) {
        res.status(400).json({ error: 'Gift animation must be a valid media URL or uploaded clip.' });
        return;
      }

      const [saved] = await db
        .insert(gifts)
        .values({
          id,
          name,
          cost,
          charmValue,
          randomCoinsMin: Math.max(0, Math.floor(Number(req.body?.randomCoinsMin || Math.round(cost * 0.1)))),
          randomCoinsMax: Math.max(0, Math.floor(Number(req.body?.randomCoinsMax || Math.round(cost * 0.5)))),
          rarity: String(req.body?.rarity || 'Signature'),
          primaryColor: String(req.body?.primaryColor || '#22D3EE'),
          secondaryColor: String(req.body?.secondaryColor || '#FBBF24'),
          description: String(req.body?.description || 'Custom OG VELOCITY gift'),
          particleStyle: String(req.body?.particleStyle || 'heart'),
          giftNumber: Math.max(1, Math.floor(Number(req.body?.giftNumber || 10))),
          artworkUrl: rawArtworkUrl,
          animationUrl: rawAnimationUrl,
          active: req.body?.active !== false,
        })
        .onConflictDoUpdate({
          target: gifts.id,
          set: {
            name,
            cost,
            charmValue,
            rarity: String(req.body?.rarity || 'Signature'),
            primaryColor: String(req.body?.primaryColor || '#22D3EE'),
            secondaryColor: String(req.body?.secondaryColor || '#FBBF24'),
            description: String(req.body?.description || 'Custom OG VELOCITY gift'),
            ...(rawArtworkUrl !== null ? { artworkUrl: rawArtworkUrl } : {}),
            ...(rawAnimationUrl !== null ? { animationUrl: rawAnimationUrl } : {}),
            active: req.body?.active !== false,
            updatedAt: new Date(),
          },
        })
        .returning();

      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'upsert_gift',
        targetType: 'gift',
        targetId: saved.id,
        details: { name: saved.name, cost: saved.cost },
      });

      options.getRealtimeHub?.()?.broadcastAll({ type: 'catalog:updated', kind: 'gifts' });
      res.json({ ok: true, gift: saved });
    }
  );

  router.delete(
    '/gifts/:id',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.params.id);
      await db.update(gifts).set({ active: false, updatedAt: new Date() }).where(eq(gifts.id, id));
      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'deactivate_gift',
        targetType: 'gift',
        targetId: id,
      });
      options.getRealtimeHub?.()?.broadcastAll({ type: 'catalog:updated', kind: 'gifts' });
      res.json({ ok: true });
    }
  );

  // 6b. User-Submitted Custom Gifts Approval Queue
  router.get(
    '/custom-gifts',
    requireAdminRole(['admin', 'super_admin'], 'gifts:manage'),
    async (_req, res) => {
      try {
        const items = await adminListCustomGifts();
        res.json({ ok: true, customGifts: items });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load custom gifts.' });
      }
    }
  );

  router.patch(
    '/custom-gifts/:id',
    requireAdminRole(['admin', 'super_admin'], 'gifts:manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const updated = await adminUpdateCustomGift({
          id: String(req.params.id || '').trim(),
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          updates: {
            name: typeof req.body?.name === 'string' ? req.body.name : undefined,
            cost: req.body?.cost !== undefined ? Number(req.body.cost) : undefined,
            charmValue: req.body?.charmValue !== undefined ? Number(req.body.charmValue) : undefined,
            rarity: typeof req.body?.rarity === 'string' ? req.body.rarity : undefined,
            description: typeof req.body?.description === 'string' ? req.body.description : undefined,
            primaryColor: typeof req.body?.primaryColor === 'string' ? req.body.primaryColor : undefined,
            secondaryColor: typeof req.body?.secondaryColor === 'string' ? req.body.secondaryColor : undefined,
            particleStyle: typeof req.body?.particleStyle === 'string' ? req.body.particleStyle : undefined,
          },
        });
        res.json({ ok: true, customGift: updated });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update custom gift.' });
      }
    }
  );

  router.post(
    '/custom-gifts/:id/approve',
    requireAdminRole(['admin', 'super_admin'], 'gifts:manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const result = await adminApproveCustomGift({
          id: String(req.params.id || '').trim(),
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          reviewNote: typeof req.body?.reviewNote === 'string' ? req.body.reviewNote : undefined,
          cost: req.body?.cost !== undefined ? Number(req.body.cost) : undefined,
          charmValue: req.body?.charmValue !== undefined ? Number(req.body.charmValue) : undefined,
          rarity: typeof req.body?.rarity === 'string' ? req.body.rarity : undefined,
          name: typeof req.body?.name === 'string' ? req.body.name : undefined,
          description: typeof req.body?.description === 'string' ? req.body.description : undefined,
        });
        const hub = options.getRealtimeHub?.();
        hub?.broadcastAll({ type: 'catalog:updated', kind: 'gifts' });
        hub?.sendToUser(result.submission.creatorUid, {
          type: 'notification:new',
          notification: {
            title: 'Custom Gift Approved!',
            body: `"${result.gift.name}" is now live in the Gift Catalog.`,
          },
        });
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Custom gift approval failed.' });
      }
    }
  );

  router.post(
    '/custom-gifts/:id/reject',
    requireAdminRole(['admin', 'super_admin'], 'gifts:manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const updated = await adminRejectCustomGift({
          id: String(req.params.id || '').trim(),
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          reviewNote: typeof req.body?.reviewNote === 'string' ? req.body.reviewNote : undefined,
        });
        options.getRealtimeHub?.()?.sendToUser(updated.creatorUid, {
          type: 'notification:new',
          notification: {
            title: 'Custom Gift Reviewed',
            body: `"${updated.name}" was rejected: ${updated.reviewNote || 'Did not meet guidelines.'}`,
          },
        });
        res.json({ ok: true, customGift: updated });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Custom gift rejection failed.' });
      }
    }
  );

  // 7. Live Event Management (syncs immediately to User App!)
  router.get('/events', async (_req, res) => {
    const rows = await db.select().from(events).orderBy(desc(events.createdAt));
    res.json({ ok: true, events: rows });
  });

  router.post(
    '/events',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.body?.id || `evt-${crypto.randomBytes(4).toString('hex')}`).trim();
      const title = String(req.body?.title || '').trim();
      if (!title) {
        res.status(400).json({ error: 'Event title is required.' });
        return;
      }
      const now = new Date();
      const [saved] = await db
        .insert(events)
        .values({
          id,
          title,
          subtitle: String(req.body?.subtitle || '').trim(),
          description: String(req.body?.description || '').trim(),
          bannerUrl: typeof req.body?.bannerUrl === 'string' ? req.body.bannerUrl : null,
          eventType: String(req.body?.eventType || 'tournament'),
          rewardCoins: Math.max(0, Math.floor(Number(req.body?.rewardCoins || 0))),
          startsAt: req.body?.startsAt ? new Date(String(req.body.startsAt)) : now,
          endsAt: req.body?.endsAt ? new Date(String(req.body.endsAt)) : new Date(now.getTime() + 7 * 86_400_000),
          status: String(req.body?.status || 'live'),
          createdByUid: req.authUser!.uid,
        })
        .onConflictDoUpdate({
          target: events.id,
          set: {
            title,
            subtitle: String(req.body?.subtitle || '').trim(),
            description: String(req.body?.description || '').trim(),
            rewardCoins: Math.max(0, Math.floor(Number(req.body?.rewardCoins || 0))),
            status: String(req.body?.status || 'live'),
            updatedAt: new Date(),
          },
        })
        .returning();

      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'upsert_event',
        targetType: 'event',
        targetId: saved.id,
        details: { title: saved.title, status: saved.status },
      });

      options.getRealtimeHub?.()?.broadcastAll({ type: 'event:updated', event: saved });
      res.json({ ok: true, event: saved });
    }
  );

  router.delete(
    '/events/:id',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.params.id);
      await db.delete(events).where(eq(events.id, id));
      options.getRealtimeHub?.()?.broadcastAll({ type: 'event:updated', deletedId: id });
      res.json({ ok: true });
    }
  );

  // 8. Tasks & Backgrounds & Packages Management
  router.get('/tasks', async (_req, res) => {
    const rows = await db.select().from(tasks).orderBy(tasks.sortOrder);
    res.json({ ok: true, tasks: rows });
  });

  router.post(
    '/tasks',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.body?.id || `task-${crypto.randomBytes(3).toString('hex')}`).trim();
      const title = String(req.body?.title || '').trim();
      if (!title) {
        res.status(400).json({ error: 'Task title is required.' });
        return;
      }
      const subtitle = String(req.body?.subtitle || '').trim();
      const category = String(req.body?.category || 'daily').trim() || 'daily';
      const actionType = String(req.body?.actionType || 'checkin').trim() || 'checkin';
      const targetCount = Math.max(1, Math.floor(Number(req.body?.targetCount || 1)));
      const rewardCoins = Math.max(1, Math.floor(Number(req.body?.rewardCoins || 200)));
      const active = req.body?.active !== false;
      const sortOrder = Math.floor(Number(req.body?.sortOrder ?? 10));

      const [saved] = await db
        .insert(tasks)
        .values({
          id,
          title,
          subtitle,
          category,
          actionType,
          targetCount,
          rewardCoins,
          active,
          sortOrder,
        })
        .onConflictDoUpdate({
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
            updatedAt: new Date(),
          },
        })
        .returning();
      options.getRealtimeHub?.()?.broadcastAll({ type: 'tasks:updated', taskId: saved.id });
      res.json({ ok: true, task: saved });
    }
  );

  router.patch(
    '/tasks/:id',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.params.id || '').trim();
      const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!existing) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof req.body?.title === 'string' && req.body.title.trim()) patch.title = req.body.title.trim();
      if (typeof req.body?.subtitle === 'string') patch.subtitle = req.body.subtitle.trim();
      if (typeof req.body?.category === 'string' && req.body.category.trim()) patch.category = req.body.category.trim();
      if (typeof req.body?.actionType === 'string' && req.body.actionType.trim()) patch.actionType = req.body.actionType.trim();
      if (req.body?.targetCount !== undefined) patch.targetCount = Math.max(1, Math.floor(Number(req.body.targetCount)));
      if (req.body?.rewardCoins !== undefined) patch.rewardCoins = Math.max(1, Math.floor(Number(req.body.rewardCoins)));
      if (req.body?.sortOrder !== undefined) patch.sortOrder = Math.floor(Number(req.body.sortOrder));
      if (typeof req.body?.active === 'boolean') patch.active = req.body.active;

      const [updated] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
      options.getRealtimeHub?.()?.broadcastAll({ type: 'tasks:updated', taskId: updated.id });
      res.json({ ok: true, task: updated });
    }
  );

  router.delete(
    '/tasks/:id',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.params.id || '').trim();
      await db.delete(tasks).where(eq(tasks.id, id));
      options.getRealtimeHub?.()?.broadcastAll({ type: 'tasks:updated', deletedId: id });
      res.json({ ok: true, deletedId: id });
    }
  );

  router.get('/tasks/progress', async (req, res) => {
    const limit = Number(req.query.limit || 120);
    const list = await adminGetTaskProgressList(limit);
    res.json({ ok: true, progress: list });
  });

  router.post(
    '/tasks/progress',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      try {
        const userIdentifier = String(req.body?.userIdentifier || '').trim();
        const taskId = String(req.body?.taskId || '').trim();
        if (!userIdentifier || !taskId) {
          res.status(400).json({ error: 'userIdentifier and taskId are required.' });
          return;
        }
        const saved = await adminUpdateUserTaskProgress({
          userIdentifier,
          taskId,
          progress: req.body?.progress !== undefined ? Number(req.body.progress) : undefined,
          claimed: req.body?.claimed !== undefined ? Boolean(req.body.claimed) : undefined,
        });
        options.getRealtimeHub?.()?.broadcastAll({ type: 'tasks:updated', taskId });
        res.json({ ok: true, progress: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update task progress.' });
      }
    }
  );

  router.get('/packages', async (_req, res) => {
    const [vipPkgs, coinPkgs] = await Promise.all([
      db.select().from(vipPackages).orderBy(vipPackages.sortOrder),
      db.select().from(coinPackages).orderBy(coinPackages.sortOrder),
    ]);
    res.json({ ok: true, vipPackages: vipPkgs, coinPackages: coinPkgs });
  });

  router.post(
    '/packages/vip',
    requireAdminRole(['super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (req.authUser!.role !== 'super_admin') {
        res.status(403).json({ error: 'Only Super Admin can configure VIP subscription packages.' });
        return;
      }
      if (
        (req.body?.grantedVipLevel !== undefined && Number(req.body.grantedVipLevel) !== 1) ||
        (req.body?.bonusGrowth !== undefined && Number(req.body.bonusGrowth) !== 0)
      ) {
        res.status(400).json({
          error:
            'Every VIP subscription package must start at VIP 1 with 0 bonus points. Only price and duration are configurable.',
        });
        return;
      }
      const id = String(req.body?.id || `vip-${crypto.randomBytes(3).toString('hex')}`).trim();
      const name = String(req.body?.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Package name required.' });
        return;
      }
      const priceInr = Math.max(1, Math.floor(Number(req.body?.priceInr || 200)));
      const durationDays = Math.max(1, Math.floor(Number(req.body?.durationDays || 30)));
      const perks = Array.isArray(req.body?.perks)
        ? req.body.perks.map(String)
        : ['Starts at VIP 1', `${durationDays} Days Membership Validity`, 'Earn 1 VIP Pt / 100 Coins Gifted'];

      const [saved] = await db
        .insert(vipPackages)
        .values({
          id,
          name,
          priceInr,
          durationDays,
          grantedVipLevel: 1,
          bonusGrowth: 0,
          perks,
          active: req.body?.active !== false,
        })
        .onConflictDoUpdate({
          target: vipPackages.id,
          set: {
            name,
            priceInr,
            durationDays,
            grantedVipLevel: 1,
            bonusGrowth: 0,
            perks,
            active: req.body?.active !== false,
            updatedAt: new Date(),
          },
        })
        .returning();

      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: 'super_admin',
        action: 'upsert_vip_package',
        targetType: 'vip_package',
        targetId: saved.id,
        details: { name: saved.name, priceInr: saved.priceInr, durationDays: saved.durationDays, grantedVipLevel: 1 },
      });

      options.getRealtimeHub?.()?.broadcastAll({ type: 'catalog:updated', kind: 'vipPackages' });
      res.json({ ok: true, package: saved });
    }
  );

  router.post(
    '/packages/coins',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.body?.id || `pkg-${crypto.randomBytes(3).toString('hex')}`).trim();
      const label = String(req.body?.label || '').trim();
      if (!label) {
        res.status(400).json({ error: 'Package label required.' });
        return;
      }
      const [saved] = await db
        .insert(coinPackages)
        .values({
          id,
          label,
          coins: Math.max(1, Math.floor(Number(req.body?.coins || 100000))),
          bonusCoins: Math.max(0, Math.floor(Number(req.body?.bonusCoins || 0))),
          priceInr: Math.max(1, Math.floor(Number(req.body?.priceInr || 100))),
          highlight: typeof req.body?.highlight === 'string' ? req.body.highlight : null,
          active: req.body?.active !== false,
        })
        .onConflictDoUpdate({
          target: coinPackages.id,
          set: {
            label,
            coins: Math.max(1, Math.floor(Number(req.body?.coins || 100000))),
            bonusCoins: Math.max(0, Math.floor(Number(req.body?.bonusCoins || 0))),
            priceInr: Math.max(1, Math.floor(Number(req.body?.priceInr || 100))),
            active: req.body?.active !== false,
            updatedAt: new Date(),
          },
        })
        .returning();
      res.json({ ok: true, package: saved });
    }
  );

  router.get('/backgrounds', async (_req, res) => {
    const rows = await db.select().from(roomBackgrounds);
    res.json({ ok: true, backgrounds: rows });
  });

  router.post(
    '/backgrounds',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = String(req.body?.id || `bg-${crypto.randomBytes(3).toString('hex')}`).trim();
      const name = String(req.body?.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Background name required.' });
        return;
      }
      const bgImageUrl = typeof req.body?.imageUrl === 'string' && req.body.imageUrl.trim() ? req.body.imageUrl.trim() : null;
      if (bgImageUrl && !isSafeMediaReference(bgImageUrl, false)) {
        res.status(400).json({ error: 'Background imageUrl must be a valid image URL or uploaded asset.' });
        return;
      }
      const [saved] = await db
        .insert(roomBackgrounds)
        .values({
          id,
          name,
          gradient: String(req.body?.gradient || 'linear-gradient(160deg, #0D0B1D 0%, #191134 55%, #070912 100%)'),
          imageUrl: bgImageUrl,
          accent: String(req.body?.accent || '#A855F7'),
          ambiance: String(req.body?.ambiance || 'indigo'),
          active: req.body?.active !== false,
        })
        .onConflictDoUpdate({
          target: roomBackgrounds.id,
          set: {
            name,
            gradient: String(req.body?.gradient || 'linear-gradient(160deg, #0D0B1D 0%, #191134 55%, #070912 100%)'),
            imageUrl: bgImageUrl,
            accent: String(req.body?.accent || '#A855F7'),
            active: req.body?.active !== false,
            updatedAt: new Date(),
          },
        })
        .returning();
      res.json({ ok: true, background: saved });
    }
  );

  // 9. Announcements & User Notifications
  router.post(
    '/announcements',
    requireAdminRole(['admin', 'super_admin', 'support_staff']),
    async (req: AdminAuthedRequest, res) => {
      const title = String(req.body?.title || '').trim();
      const body = String(req.body?.body || '').trim();
      const rawTargetUid = req.body?.targetUid ? String(req.body.targetUid).trim() : null;
      if (!title || !body) {
        res.status(400).json({ error: 'Announcement title and body are required.' });
        return;
      }
      const resolvedTarget = rawTargetUid ? await resolveUserByUidOrPublicId(rawTargetUid) : null;
      if (rawTargetUid && !resolvedTarget) {
        res.status(404).json({ error: 'Target user not found.' });
        return;
      }
      const targetUid = resolvedTarget?.uid || null;
      const [created] = await db
        .insert(notifications)
        .values({
          userUid: targetUid,
          type: targetUid ? 'system' : 'announcement',
          title,
          body,
        })
        .returning();

      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'publish_announcement',
        targetType: 'notification',
        targetId: String(created.id),
        details: { title, targetUid },
      });

      const hub = options.getRealtimeHub?.();
      if (targetUid && resolvedTarget) {
        hub?.sendToUser(targetUid, {
          type: 'notification:new',
          notification: { ...created, userUid: resolvedTarget.publicId },
        });
      } else {
        hub?.broadcastAll({ type: 'announcement:new', notification: { ...created, userUid: null } });
      }
      res.json({ ok: true, notification: created });
    }
  );

  // 10. Reports Moderation
  router.get('/reports', async (_req, res) => {
    const rows = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(100);
    res.json({ ok: true, reports: rows });
  });

  router.post(
    '/reports/:id/resolve',
    requireAdminRole(['moderator', 'admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      const id = Number(req.params.id);
      const status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
      const note = String(req.body?.resolutionNote || '').trim();
      const removePost = Boolean(req.body?.removePost);

      const [updated] = await db
        .update(reports)
        .set({
          status,
          resolvedByUid: req.authUser!.uid,
          resolutionNote: note || 'Handled by moderation team',
          resolvedAt: new Date(),
        })
        .where(eq(reports.id, id))
        .returning();

      if (updated && removePost && updated.targetType === 'post') {
        await db.update(posts).set({ status: 'removed' }).where(eq(posts.id, updated.targetId));
      }

      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: `report_${status}`,
        targetType: 'report',
        targetId: String(id),
        details: { note, removePost },
      });

      res.json({ ok: true, report: updated });
    }
  );

  // 11. Admin Roles & Audit Logs
  router.get('/roles', async (_req, res) => {
    const [roles, admins] = await Promise.all([
      db.select().from(rolesPermissions),
      db
        .select({
          userUid: adminUsers.userUid,
          role: adminUsers.role,
          active: adminUsers.active,
          publicId: users.publicId,
          email: users.email,
          name: profiles.displayName,
        })
        .from(adminUsers)
        .leftJoin(users, eq(adminUsers.userUid, users.uid))
        .leftJoin(profiles, eq(adminUsers.userUid, profiles.userUid)),
    ]);
    res.json({ ok: true, roles, admins });
  });

  router.post(
    '/roles/assign',
    requireAdminRole(['super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (req.authUser!.role !== 'super_admin') {
        res.status(403).json({ error: 'Only Super Admin can assign admin panel roles.' });
        return;
      }
      const rawTarget = String(req.body?.userUid || '').trim();
      const role = String(req.body?.role || 'normal_user') as AccountRole;
      if (!rawTarget) {
        res.status(400).json({ error: 'Missing userUid.' });
        return;
      }
      const resolved = await resolveUserByUidOrPublicId(rawTarget);
      if (!resolved) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const targetUid = resolved.uid;

      await db.transaction(async (tx) => {
        await tx.update(users).set({ role, updatedAt: new Date() }).where(eq(users.uid, targetUid));
        if (ADMIN_PANEL_ROLES.has(role)) {
          await tx
            .insert(adminUsers)
            .values({ userUid: targetUid, role, assignedByUid: req.authUser!.uid, active: true })
            .onConflictDoUpdate({
              target: adminUsers.userUid,
              set: { role, assignedByUid: req.authUser!.uid, active: true, updatedAt: new Date() },
            });
        } else {
          await tx.delete(adminUsers).where(eq(adminUsers.userUid, targetUid));
        }

        await tx.insert(auditLogs).values({
          actorUid: req.authUser!.uid,
          actorRole: 'super_admin',
          action: 'assign_role',
          targetType: 'user',
          targetId: targetUid,
          details: { role },
        });
      });

      res.json({ ok: true });
    }
  );

  router.get('/audit-logs', async (_req, res) => {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(150);
    res.json({ ok: true, logs: rows });
  });

  // 12. User Detailed Inspection & Admin Notes
  router.get(
    '/users/:uid/inspect',
    requireAdminRole(['admin', 'super_admin', 'moderator'], 'users:read'),
    async (req, res) => {
      const inspection = await getAdminUserInspection(String(req.params.uid || '').trim());
      if (!inspection || !inspection.user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      res.json({ ok: true, ...inspection });
    }
  );

  router.put(
    '/users/:uid/notes',
    requireAdminRole(['admin', 'super_admin', 'moderator'], 'users:manage'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const notes = await addUserAdminNote({
          actorUid: req.authUser!.uid,
          actorName: req.authUser!.name,
          targetIdentifier: String(req.params.uid || '').trim(),
          note: String(req.body?.note || ''),
        });
        res.json({ ok: true, adminNotes: notes });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save admin note.' });
      }
    }
  );

  // 13. Granular RBAC Permissions Management
  router.get('/permissions/catalog', (_req, res) => {
    res.json({ ok: true, permissions: APP_PERMISSIONS_CATALOG });
  });

  router.get('/permissions/sets', async (_req, res) => {
    const sets = await getAdminPermissionSets();
    res.json({ ok: true, sets });
  });

  router.post(
    '/permissions/sets',
    requireAdminRole(['super_admin'], 'roles:manage'),
    async (req: AdminAuthedRequest, res) => {
      const name = String(req.body?.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Permission set name is required.' });
        return;
      }
      const saved = await upsertAdminPermissionSet({
        actorUid: req.authUser!.uid,
        id: typeof req.body?.id === 'string' ? req.body.id : undefined,
        name,
        description: typeof req.body?.description === 'string' ? req.body.description : undefined,
        permissions: Array.isArray(req.body?.permissions) ? req.body.permissions.map(String) : [],
      });
      res.json({ ok: true, set: saved });
    }
  );

  router.post(
    '/permissions/users/:uid',
    requireAdminRole(['super_admin'], 'roles:manage'),
    async (req: AdminAuthedRequest, res) => {
      const resolved = await resolveUserByUidOrPublicId(String(req.params.uid || '').trim());
      if (!resolved) {
        res.status(404).json({ error: 'Target user not found.' });
        return;
      }
      try {
        const saved = await assignAdminUserPermissions({
          actorUid: req.authUser!.uid,
          targetUid: resolved.uid,
          customPermissions: Array.isArray(req.body?.customPermissions)
            ? req.body.customPermissions.map(String)
            : [],
          permissionSetId:
            typeof req.body?.permissionSetId === 'string' && req.body.permissionSetId.trim()
              ? req.body.permissionSetId.trim()
              : null,
          expiresAt:
            typeof req.body?.expiresAt === 'string' && req.body.expiresAt.trim()
              ? req.body.expiresAt.trim()
              : null,
          reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
        });
        res.json({ ok: true, userPermissions: saved });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign permissions.' });
      }
    }
  );

  router.get('/permissions/history', async (_req, res) => {
    const history = await getAdminPermissionHistory(60);
    res.json({ ok: true, history });
  });

  // 14. Dynamic Global App Config (Super Admin Control)
  router.get('/app-config', async (_req, res) => {
    const config = await getAppConfig();
    res.json({ ok: true, config });
  });

  router.put(
    '/app-config',
    requireAdminRole(['super_admin'], 'config:manage'),
    async (req: AdminAuthedRequest, res) => {
      const config = await updateAppConfig(
        req.authUser!.uid,
        req.authUser!.role,
        (req.body ?? {}) as Record<string, unknown>
      );
      options.getRealtimeHub?.()?.broadcastAll({ type: 'app:config-updated', config });
      res.json({ ok: true, config });
    }
  );

  // 15. Live Voice Rooms Moderation, Official Room Control & Closure
  router.get('/rooms', async (_req, res) => {
    const hub = options.getRealtimeHub?.();
    await ensureOfficialRoomsSecurityState(hub?.getOfficialRoomsWithLiveAppAdmin());
    const rows = await db.select().from(voiceRooms).orderBy(desc(voiceRooms.createdAt)).limit(80);
    const uidMap = await mapUidsToPublicIds(rows.map((r) => r.ownerUid));
    res.json({
      ok: true,
      rooms: rows.map((r) => ({
        ...r,
        ownerUid: uidMap[r.ownerUid] || r.ownerUid,
        lockedSeats: Array.isArray(r.lockedSeats) ? r.lockedSeats : [],
        liveParticipantsCount: hub ? hub.getRoomParticipants(r.id).length : 0,
      })),
    });
  });

  router.post(
    '/rooms/:roomId/reopen',
    requireAdminRole(['admin', 'super_admin'], 'rooms:moderate'),
    async (req: AdminAuthedRequest, res) => {
      try {
        const reopened = await reopenVoiceRoom({
          roomId: String(req.params.roomId || '').trim(),
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
        res.json({ ok: true, room: reopened });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reopen room.' });
      }
    }
  );

  router.patch(
    '/rooms/:roomId/level',
    requireAdminRole(['admin', 'super_admin'], 'rooms:moderate'),
    async (req: AdminAuthedRequest, res) => {
      const roomId = String(req.params.roomId || '').trim();
      const level = Math.max(1, Math.min(30, Math.floor(Number(req.body?.roomLevel || 15))));
      const [updated] = await db
        .update(voiceRooms)
        .set({ roomLevel: level, updatedAt: new Date() })
        .where(eq(voiceRooms.id, roomId))
        .returning();
      if (!updated) {
        res.status(404).json({ error: 'Voice room not found.' });
        return;
      }
      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'admin_set_room_level',
        targetType: 'voice_room',
        targetId: roomId,
        details: { roomLevel: level },
      });
      const hub = options.getRealtimeHub?.();
      hub?.broadcastToRoom(roomId, {
        type: 'room:settings-updated',
        roomId,
        room: { ...updated, roomLevel: level },
      });
      hub?.broadcastAll({ type: 'room:list-updated', updatedRoomId: roomId });
      res.json({ ok: true, room: updated });
    }
  );

  router.delete(
    '/rooms/:roomId',
    requireAdminRole(['moderator', 'admin', 'super_admin'], 'rooms:moderate'),
    async (req: AdminAuthedRequest, res) => {
      const roomId = String(req.params.roomId || '').trim();
      const reason = String(req.body?.reason || 'Closed by App Admin moderation.').trim();
      const hub = options.getRealtimeHub?.();
      let closed = false;
      if (hub) {
        closed = await hub.closeRoom(roomId, reason);
      } else {
        const [updated] = await db
          .update(voiceRooms)
          .set({ status: 'closed', closedAt: new Date(), closedReason: reason, updatedAt: new Date() })
          .where(eq(voiceRooms.id, roomId))
          .returning();
        closed = Boolean(updated);
      }
      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'admin_close_room',
        targetType: 'voice_room',
        targetId: roomId,
        details: { reason },
      });
      res.json({ ok: true, closed });
    }
  );

  // 16. App Publishing, Production Build, Domain Connection & Deployment Management
  interface DeploymentStateRecord {
    primaryDomain: string;
    previewDomain: string;
    sharedDomain: string;
    customDomains: string[];
    publishStatus: 'draft' | 'building' | 'ready' | 'live' | 'failed';
    lastBuildStatus: 'idle' | 'running' | 'success' | 'failed';
    lastBuildAt: string | null;
    lastBuildDurationMs: number | null;
    lastBuildLogs: string;
    lastBuildError: string | null;
    publishedVersion: number;
    publishedAt: string | null;
    publishedBy: string | null;
    environmentMode: string;
  }

  const DEFAULT_DEPLOYMENT_STATE: DeploymentStateRecord = {
    primaryDomain: 'ogvelocity.xyz',
    previewDomain: 'ais-dev-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app',
    sharedDomain: 'ais-pre-tmyxn2f2uyfmeagcwxec42-997874239735.asia-southeast1.run.app',
    customDomains: ['ogvelocity.xyz'],
    publishStatus: 'draft',
    lastBuildStatus: 'idle',
    lastBuildAt: null,
    lastBuildDurationMs: null,
    lastBuildLogs: '',
    lastBuildError: null,
    publishedVersion: 0,
    publishedAt: null,
    publishedBy: null,
    environmentMode: process.env.NODE_ENV || 'development',
  };

  let activeBuildRunning = false;

  async function loadDeploymentState(): Promise<DeploymentStateRecord> {
    const [row] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'deployment_state'));
    const raw = (row?.value ?? {}) as Partial<DeploymentStateRecord>;
    return {
      ...DEFAULT_DEPLOYMENT_STATE,
      ...raw,
      customDomains: Array.isArray(raw.customDomains) && raw.customDomains.length > 0
        ? raw.customDomains.map(String)
        : DEFAULT_DEPLOYMENT_STATE.customDomains,
      environmentMode: process.env.NODE_ENV || 'development',
    };
  }

  async function saveDeploymentState(next: DeploymentStateRecord, updatedByUid: string) {
    await db
      .insert(platformSettings)
      .values({
        key: 'deployment_state',
        value: next as unknown as Record<string, unknown>,
        updatedByUid,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: next as unknown as Record<string, unknown>,
          updatedByUid,
          updatedAt: new Date(),
        },
      });
  }

  async function fetchFirebaseAuthorizedDomainsMap() {
    const entries: Array<{ projectId: string; apiKey: string }> = [
      { projectId: 'og-velocity', apiKey: process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCWMhFzpTkrcWEEjGEwkItHtGJ8AYjKg_Q' },
      ...(appletFirebaseConfig.projectId && appletFirebaseConfig.apiKey
        ? [{ projectId: appletFirebaseConfig.projectId, apiKey: appletFirebaseConfig.apiKey }]
        : []),
    ];
    const results: Record<string, string[]> = {};
    await Promise.all(
      entries.map(async ({ projectId, apiKey }) => {
        try {
          const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${apiKey}`);
          if (!resp.ok) {
            results[projectId] = [];
            return;
          }
          const json = (await resp.json()) as { authorizedDomains?: string[] };
          results[projectId] = Array.isArray(json.authorizedDomains) ? json.authorizedDomains : [];
        } catch {
          results[projectId] = [];
        }
      })
    );
    return results;
  }

  router.get(
    '/deployment/status',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      try {
        const state = await loadDeploymentState();
        const distHtmlPath = path.resolve(process.cwd(), 'dist', 'index.html');
        const distReady = fs.existsSync(distHtmlPath);
        const authorizedDomainsByProject = await fetchFirebaseAuthorizedDomainsMap();
        const allAuthorized = Array.from(new Set(Object.values(authorizedDomainsByProject).flat()));
        const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
          .split(':')[0]
          .trim()
          .toLowerCase();

        const requiredHosts = Array.from(
          new Set(
            [state.primaryDomain, state.previewDomain, state.sharedDomain, rawHost]
              .map((h) => h.trim().toLowerCase())
              .filter(Boolean)
          )
        );
        const domainChecks = requiredHosts.map((host) => ({
          host,
          authorized: allAuthorized.some(
            (d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`)
          ),
        }));

        res.json({
          ok: true,
          deployment: {
            ...state,
            distReady,
            buildInProgress: activeBuildRunning,
            currentHost: rawHost,
            authorizedDomainsByProject,
            domainChecks,
          },
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to inspect deployment status.' });
      }
    }
  );

  router.put(
    '/deployment/domains',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (!isAppAdminRole(req.authUser!.role)) {
        res.status(403).json({ error: 'Only App Admins can update domain configuration.' });
        return;
      }
      const cleanDomain = (v: unknown) =>
        String(v || '')
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '');

      const cur = await loadDeploymentState();
      const primaryDomain = req.body?.primaryDomain ? cleanDomain(req.body.primaryDomain) : cur.primaryDomain;
      const previewDomain = req.body?.previewDomain ? cleanDomain(req.body.previewDomain) : cur.previewDomain;
      const sharedDomain = req.body?.sharedDomain ? cleanDomain(req.body.sharedDomain) : cur.sharedDomain;
      const customDomains = Array.isArray(req.body?.customDomains)
        ? Array.from(new Set<string>(req.body.customDomains.map(cleanDomain).filter(Boolean)))
        : Array.from(new Set<string>([primaryDomain, ...cur.customDomains].filter(Boolean)));

      if (!primaryDomain) {
        res.status(400).json({ error: 'Primary website domain is required.' });
        return;
      }

      const next: DeploymentStateRecord = {
        ...cur,
        primaryDomain,
        previewDomain,
        sharedDomain,
        customDomains,
      };
      await saveDeploymentState(next, req.authUser!.uid);
      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'update_deployment_domains',
        targetType: 'deployment',
        targetId: 'global',
        details: { primaryDomain, previewDomain, sharedDomain, customDomains },
      });
      res.json({ ok: true, deployment: next });
    }
  );

  router.post(
    '/deployment/build',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (activeBuildRunning) {
        res.status(409).json({ error: 'A production build is already in progress.' });
        return;
      }
      activeBuildRunning = true;
      const startedAt = Date.now();
      const cur = await loadDeploymentState();
      await saveDeploymentState(
        {
          ...cur,
          publishStatus: 'building',
          lastBuildStatus: 'running',
          lastBuildError: null,
        },
        req.authUser!.uid
      );

      try {
        const result = await new Promise<{ code: number; output: string }>((resolve) => {
          const child = spawn('npm', ['run', 'build'], {
            cwd: process.cwd(),
            shell: false,
            env: { ...process.env, FORCE_COLOR: '0' },
          });
          let out = '';
          const append = (chunk: Buffer) => {
            out += chunk.toString('utf8');
            if (out.length > 24_000) {
              out = out.slice(-24_000);
            }
          };
          child.stdout?.on('data', append);
          child.stderr?.on('data', append);
          child.on('error', (err) => {
            resolve({ code: 1, output: `${out}\n${err.message}`.trim() });
          });
          child.on('close', (code) => {
            resolve({ code: code ?? 1, output: out.trim() });
          });
        });

        const durationMs = Date.now() - startedAt;
        const distReady = fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'));
        const success = result.code === 0 && distReady;
        const next: DeploymentStateRecord = {
          ...cur,
          publishStatus: success ? (cur.publishedVersion > 0 ? 'live' : 'ready') : 'failed',
          lastBuildStatus: success ? 'success' : 'failed',
          lastBuildAt: new Date().toISOString(),
          lastBuildDurationMs: durationMs,
          lastBuildLogs: result.output || (success ? 'Vite production build completed.' : 'Build failed with no output.'),
          lastBuildError: success ? null : `Production build exited with code ${result.code}`,
        };
        await saveDeploymentState(next, req.authUser!.uid);
        await db.insert(auditLogs).values({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          action: success ? 'production_build_success' : 'production_build_failed',
          targetType: 'deployment',
          targetId: 'global',
          details: { durationMs, code: result.code, distReady },
        });
        res.status(success ? 200 : 500).json({
          ok: success,
          deployment: { ...next, distReady, buildInProgress: false },
          error: success ? undefined : next.lastBuildError,
        });
      } finally {
        activeBuildRunning = false;
      }
    }
  );

  router.post(
    '/deployment/publish',
    requireAdminRole(['admin', 'super_admin']),
    async (req: AdminAuthedRequest, res) => {
      if (activeBuildRunning) {
        res.status(409).json({ error: 'Wait for the active production build to finish before publishing.' });
        return;
      }
      const distReady = fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'));
      if (!distReady) {
        res.status(400).json({
          error: 'No production bundle found in dist/. Run Production Build first before publishing.',
        });
        return;
      }
      const cur = await loadDeploymentState();
      const next: DeploymentStateRecord = {
        ...cur,
        publishStatus: 'live',
        lastBuildStatus: cur.lastBuildStatus === 'idle' ? 'success' : cur.lastBuildStatus,
        publishedVersion: cur.publishedVersion + 1,
        publishedAt: new Date().toISOString(),
        publishedBy: `${req.authUser!.name} (${req.authUser!.publicId})`,
      };
      await saveDeploymentState(next, req.authUser!.uid);
      await db.insert(auditLogs).values({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'publish_production_release',
        targetType: 'deployment',
        targetId: `v${next.publishedVersion}`,
        details: {
          publishedVersion: next.publishedVersion,
          primaryDomain: next.primaryDomain,
          customDomains: next.customDomains,
        },
      });
      res.json({
        ok: true,
        deployment: { ...next, distReady: true, buildInProgress: false },
      });
    }
  );

  return router;
}
