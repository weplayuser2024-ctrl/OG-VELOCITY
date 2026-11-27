import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Coins,
  Crown,
  Edit3,
  Eye,
  Layers,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Trophy,
  Upload,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import type { AccountRole, AppConfig, PaymentQrVersionRecord, ShopCategory, ShopItem } from '../types';
import { uploadImageAsset } from '../utils/mediaUpload';

interface AdminPanelProps {
  authToken: string | null;
  currentUserRole: AccountRole;
  currentUserEmail?: string | null;
  onExitAdmin: () => void;
  onRefreshApp: () => void;
  onShopItemsChanged?: () => void;
  onCustomGiftsChanged?: () => void;
}

type AdminTab =
  | 'overview'
  | 'payments'
  | 'withdrawals'
  | 'users'
  | 'vip'
  | 'catalog'
  | 'moderation'
  | 'bans'
  | 'permissions'
  | 'config'
  | 'security';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  activeVipUsers: number;
  totalCoinsInCirculation: number;
  pendingPaymentReviews: number;
  approvedRevenueInr: number;
  totalGiftTransactions: number;
  openReports: number;
  totalVoiceRooms: number;
  liveEvents: number;
}

interface AdminPaymentRow {
  orderId: string;
  userUid: string;
  userPublicId: string | null;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  orderType: 'vip' | 'coins';
  packageId: string;
  packageName: string;
  amountInr: number;
  coinsAmount: number;
  grantedVipLevel: number;
  vipDurationDays: number;
  upiIdUsed: string;
  qrVersionId?: number | null;
  accountNameUsed?: string | null;
  providerUsed?: string | null;
  utrNumber: string | null;
  accountHolderName?: string | null;
  paymentDateTime?: string | null;
  screenshotDataUrl: string | null;
  payerNote: string | null;
  status: string;
  reviewedByUid: string | null;
  reviewNote: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
}

interface AdminWithdrawalRow {
  requestId: string;
  userUid: string;
  userPublicId: string | null;
  userName: string | null;
  walletFrozen: boolean;
  walletCoins: number;
  amountCoins: number;
  amountInr: number;
  payoutMethod: string;
  accountHolderName: string;
  upiOrAccount: string;
  ifscOrBank?: string | null;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

interface AdminUserRow {
  uid: string;
  publicId: string;
  email: string | null;
  phone: string | null;
  primaryProvider: string;
  role: AccountRole;
  accountStatus: 'active' | 'suspended' | 'banned';
  banReason: string | null;
  createdAt: string;
  lastLoginAt: string;
  name: string | null;
  handle: string | null;
  photoUrl: string | null;
  coins: number | null;
  walletFrozen?: boolean | null;
  vipLevel: number | null;
  vipStatus: string | null;
  vipGrowth: number | null;
  vipExpiresAt?: string | null;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  authToken,
  currentUserRole,
  currentUserEmail,
  onExitAdmin,
  onRefreshApp,
  onShopItemsChanged,
  onCustomGiftsChanged,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);

  // Payments
  const [paymentFilter, setPaymentFilter] = useState<string>('pending_review');
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});

  // Withdrawals & Banking
  const [withdrawalFilter, setWithdrawalFilter] = useState<string>('pending');
  const [withdrawalsList, setWithdrawalsList] = useState<AdminWithdrawalRow[]>([]);
  const [withdrawNoteMap, setWithdrawNoteMap] = useState<Record<string, string>>({});

  // Users & Coins
  const [userSearch, setUserSearch] = useState('');
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [coinDeltaInput, setCoinDeltaInput] = useState<string>('50000');
  const [coinReasonInput, setCoinReasonInput] = useState<string>('Admin Adjustment');
  const [vipOverrideTarget, setVipOverrideTarget] = useState<AdminUserRow | null>(null);
  const [vipOverrideStatus, setVipOverrideStatus] = useState<'active' | 'inactive'>('active');
  const [vipOverrideDays, setVipOverrideDays] = useState<number>(30);
  const [vipOverrideReason, setVipOverrideReason] = useState('Super Admin status update');
  const [historyModal, setHistoryModal] = useState<{
    user: Record<string, unknown> | null;
    walletTransactions: Array<Record<string, unknown>>;
    paymentOrders: Array<Record<string, unknown>>;
    vipSubscriptionHistory?: Array<Record<string, unknown>>;
    vipPointLedger?: Array<Record<string, unknown>>;
  } | null>(null);

  // VIP Control (Months-only Grants, Decay Config, Grant/Decay Logs)
  const [vipGrantTargetId, setVipGrantTargetId] = useState('');
  const [vipGrantMonths, setVipGrantMonths] = useState('1');
  const [vipGrantReason, setVipGrantReason] = useState('');
  const [vipDecayEnabled, setVipDecayEnabled] = useState(true);
  const [vipDecayGraceDays, setVipDecayGraceDays] = useState('15');
  const [vipDecayMode, setVipDecayMode] = useState<'fixed' | 'percent'>('fixed');
  const [vipDecayDailyAmount, setVipDecayDailyAmount] = useState('50');
  const [vipDecayDailyPercent, setVipDecayDailyPercent] = useState('5');
  const [vipSubHistory, setVipSubHistory] = useState<Array<Record<string, unknown>>>([]);
  const [vipPointLedgerRows, setVipPointLedgerRows] = useState<Array<Record<string, unknown>>>([]);

  // Catalog & Events
  const [catalogSubTab, setCatalogSubTab] = useState<
    'events' | 'gifts' | 'packages' | 'tasks' | 'backgrounds' | 'shop' | 'custom-gifts'
  >('events');
  const [eventsList, setEventsList] = useState<Array<Record<string, unknown>>>([]);
  const [giftsList, setGiftsList] = useState<Array<Record<string, unknown>>>([]);
  const [vipPkgs, setVipPkgs] = useState<Array<Record<string, unknown>>>([]);
  const [coinPkgs, setCoinPkgs] = useState<Array<Record<string, unknown>>>([]);
  const [tasksList, setTasksList] = useState<Array<Record<string, unknown>>>([]);
  const [bgsList, setBgsList] = useState<Array<Record<string, unknown>>>([]);
  const [shopItemsAdminList, setShopItemsAdminList] = useState<ShopItem[]>([]);
  const [shopEditingId, setShopEditingId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState<ShopCategory>('frame');
  const [shopPriceCoins, setShopPriceCoins] = useState('25000');
  const [shopDurationDays, setShopDurationDays] = useState('3');
  const [shopDescription, setShopDescription] = useState('');
  const [shopPreviewColor, setShopPreviewColor] = useState('#22D3EE');
  const [shopImageUrl, setShopImageUrl] = useState('');
  const [shopActive, setShopActive] = useState(true);
  const [customGiftsQueue, setCustomGiftsQueue] = useState<Array<Record<string, unknown>>>([]);
  const [customGiftOverrides, setCustomGiftOverrides] = useState<
    Record<string, { cost?: string; charmValue?: string; reviewNote?: string }>
  >({});

  // Granular User Bans
  const [bansList, setBansList] = useState<Array<Record<string, unknown>>>([]);
  const [banSearchUid, setBanSearchUid] = useState('');
  const [banActiveOnly, setBanActiveOnly] = useState(true);
  const [banTargetUid, setBanTargetUid] = useState('');
  const [banType, setBanType] = useState<'complete' | 'mic' | 'seat' | 'chat'>('mic');
  const [banDurationPreset, setBanDurationPreset] = useState<
    '1' | '3' | '7' | '30' | 'permanent' | 'custom'
  >('3');
  const [banCustomDays, setBanCustomDays] = useState('14');
  const [banReason, setBanReason] = useState('');

  // Quick creation forms
  const [evtTitle, setEvtTitle] = useState('');
  const [evtSub, setEvtSub] = useState('');
  const [evtReward, setEvtReward] = useState('5000');
  const [giftName, setGiftName] = useState('');
  const [giftCost, setGiftCost] = useState('300');
  const [giftRarity, setGiftRarity] = useState<'Standard' | 'Signature' | 'Mythic'>('Signature');
  const [taskEditingId, setTaskEditingId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubtitle, setTaskSubtitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('daily');
  const [taskActionType, setTaskActionType] = useState('checkin');
  const [taskTargetCount, setTaskTargetCount] = useState('1');
  const [taskReward, setTaskReward] = useState('500');
  const [taskSortOrder, setTaskSortOrder] = useState('10');
  const [taskActive, setTaskActive] = useState(true);
  const [taskProgressList, setTaskProgressList] = useState<Array<Record<string, unknown>>>([]);
  const [progUserId, setProgUserId] = useState('');
  const [progTaskId, setProgTaskId] = useState('');
  const [progValue, setProgValue] = useState('1');
  const [progClaimed, setProgClaimed] = useState(false);
  const [bgName, setBgName] = useState('');
  const [bgGradient, setBgGradient] = useState(
    'linear-gradient(160deg, #0D0B1D 0%, #1F123E 55%, #070912 100%)'
  );
  const [pkgType, setPkgType] = useState<'vip' | 'coins'>('coins');
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgPriceInr, setPkgPriceInr] = useState('250');
  const [pkgValue, setPkgValue] = useState('3000000');
  const [pkgDays, setPkgDays] = useState('30');

  // Moderation & Announcements
  const [reportsList, setReportsList] = useState<Array<Record<string, unknown>>>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annTargetUid, setAnnTargetUid] = useState('');

  // Dynamic Payment QR Management & Audit Trail (Super Admin ONLY — never hardcoded)
  const [upiAccName, setUpiAccName] = useState('');
  const [upiIdInput, setUpiIdInput] = useState('');
  const [upiProvider, setUpiProvider] = useState('');
  const [upiNote, setUpiNote] = useState('');
  const [upiActive, setUpiActive] = useState(true);
  const [upiScreens, setUpiScreens] = useState<string[]>(['coins', 'vip']);
  const [upiCustomQr, setUpiCustomQr] = useState<string | null | undefined>(undefined);
  const [upiLiveQrPreview, setUpiLiveQrPreview] = useState<string | null>(null);
  const [upiCurrentVersionNum, setUpiCurrentVersionNum] = useState<number | null>(null);
  const [upiChangeSummary, setUpiChangeSummary] = useState('');
  const [qrVersions, setQrVersions] = useState<PaymentQrVersionRecord[]>([]);
  const [previewQrVersion, setPreviewQrVersion] = useState<PaymentQrVersionRecord | null>(null);

  // User Detailed Inspector & Admin Notes
  const [inspectModal, setInspectModal] = useState<{
    user: Record<string, unknown> | null;
    banReason?: string | null;
    adminNotes: Array<{ id: string; note: string; authorName: string; createdAt: string }>;
    inventory: Array<Record<string, unknown>>;
    effectivePermissions: string[];
    walletTransactions: Array<Record<string, unknown>>;
    paymentOrders: Array<Record<string, unknown>>;
  } | null>(null);
  const [newAdminNote, setNewAdminNote] = useState('');

  // Granular RBAC Permissions
  const [permCatalog, setPermCatalog] = useState<string[]>([]);
  const [permSets, setPermSets] = useState<
    Array<{ id: string; name: string; description?: string; permissions: string[] }>
  >([]);
  const [permHistory, setPermHistory] = useState<Array<Record<string, unknown>>>([]);
  const [permSetName, setPermSetName] = useState('');
  const [permSetDesc, setPermSetDesc] = useState('');
  const [permSetSelected, setPermSetSelected] = useState<string[]>([]);
  const [permTargetUid, setPermTargetUid] = useState('');
  const [permTargetSetId, setPermTargetSetId] = useState('');
  const [permTargetCustom, setPermTargetCustom] = useState<string[]>([]);
  const [permTargetExpires, setPermTargetExpires] = useState('');
  const [permTargetReason, setPermTargetReason] = useState('');

  // Global App Config & Voice Rooms Moderation
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [adminRooms, setAdminRooms] = useState<Array<Record<string, unknown>>>([]);
  const [roomLevelDrafts, setRoomLevelDrafts] = useState<Record<string, string>>({});

  const [rolesAdmins, setRolesAdmins] = useState<Array<Record<string, unknown>>>([]);
  const [roleTargetUid, setRoleTargetUid] = useState('');
  const [roleAssignValue, setRoleAssignValue] = useState<AccountRole>('moderator');
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);

  const isSuperAdmin = currentUserRole === 'super_admin';
  const canApprove = currentUserRole === 'admin' || isSuperAdmin;
  const canModerate =
    currentUserRole === 'moderator' || currentUserRole === 'admin' || isSuperAdmin;

  const apiFetch = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const resp = await fetch(url, {
        ...init,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(init?.headers || {}),
        },
      });
      const data = (await resp.json().catch(() => ({}))) as T & { error?: string };
      if (!resp.ok) {
        throw new Error(data.error || `Request failed (${resp.status})`);
      }
      return data;
    },
    [authToken]
  );

  const flash = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const loadStats = useCallback(async () => {
    const res = await apiFetch<{ ok: boolean; stats: AdminStats }>('/api/admin/stats');
    setStats(res.stats);
  }, [apiFetch]);

  const loadPayments = useCallback(async () => {
    const q = paymentFilter ? `?status=${encodeURIComponent(paymentFilter)}` : '';
    const res = await apiFetch<{ ok: boolean; orders: AdminPaymentRow[] }>(`/api/admin/payments${q}`);
    setPayments(res.orders || []);
  }, [apiFetch, paymentFilter]);

  const loadWithdrawals = useCallback(async () => {
    const q = withdrawalFilter ? `?status=${encodeURIComponent(withdrawalFilter)}` : '';
    const res = await apiFetch<{ ok: boolean; withdrawals: AdminWithdrawalRow[] }>(`/api/admin/withdrawals${q}`);
    setWithdrawalsList(res.withdrawals || []);
  }, [apiFetch, withdrawalFilter]);

  const loadUsers = useCallback(async () => {
    const q = userSearch.trim() ? `?q=${encodeURIComponent(userSearch.trim())}` : '';
    const res = await apiFetch<{ ok: boolean; users: AdminUserRow[] }>(`/api/admin/users${q}`);
    setUsersList(res.users || []);
  }, [apiFetch, userSearch]);

  const loadCatalog = useCallback(async () => {
    const [ev, gf, pk, tk, tkProg, bg, sh, cg] = await Promise.all([
      apiFetch<{ events: Array<Record<string, unknown>> }>('/api/admin/events'),
      apiFetch<{ gifts: Array<Record<string, unknown>> }>('/api/admin/gifts'),
      apiFetch<{ vipPackages: Array<Record<string, unknown>>; coinPackages: Array<Record<string, unknown>> }>(
        '/api/admin/packages'
      ),
      apiFetch<{ tasks: Array<Record<string, unknown>> }>('/api/admin/tasks'),
      apiFetch<{ progress?: Array<Record<string, unknown>> }>('/api/admin/tasks/progress').catch(() => ({
        progress: [],
      })),
      apiFetch<{ backgrounds: Array<Record<string, unknown>> }>('/api/admin/backgrounds'),
      apiFetch<{ items?: ShopItem[] }>('/api/admin/shop-items').catch(() => ({ items: [] })),
      apiFetch<{ customGifts?: Array<Record<string, unknown>> }>('/api/admin/custom-gifts').catch(() => ({
        customGifts: [],
      })),
    ]);
    setEventsList(ev.events || []);
    setGiftsList(gf.gifts || []);
    setVipPkgs(pk.vipPackages || []);
    setCoinPkgs(pk.coinPackages || []);
    setTasksList(tk.tasks || []);
    setTaskProgressList(tkProg.progress || []);
    if (!progTaskId && (tk.tasks || []).length > 0) {
      setProgTaskId(String(tk.tasks[0].id));
    }
    setBgsList(bg.backgrounds || []);
    setShopItemsAdminList(sh.items || []);
    setCustomGiftsQueue(cg.customGifts || []);
  }, [apiFetch, progTaskId]);

  const loadBans = useCallback(async () => {
    const params = new URLSearchParams();
    if (banSearchUid.trim()) params.set('userUid', banSearchUid.trim());
    if (banActiveOnly) params.set('activeOnly', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch<{ bans?: Array<Record<string, unknown>> }>(`/api/admin/bans${qs}`);
    setBansList(res.bans || []);
  }, [apiFetch, banSearchUid, banActiveOnly]);

  const loadModeration = useCallback(async () => {
    const res = await apiFetch<{ reports: Array<Record<string, unknown>> }>('/api/admin/reports');
    setReportsList(res.reports || []);
  }, [apiFetch]);

  const loadVipOverview = useCallback(async () => {
    const [ov, usr] = await Promise.all([
      apiFetch<{
        decayConfig?: {
          enabled: boolean;
          graceDays: number;
          mode: 'fixed' | 'percent';
          dailyAmount: number;
          dailyPercent: number;
        };
        subscriptionHistory?: Array<Record<string, unknown>>;
        pointLedger?: Array<Record<string, unknown>>;
      }>('/api/admin/vip-subscriptions/overview'),
      apiFetch<{ ok: boolean; users: AdminUserRow[] }>('/api/admin/users?limit=50'),
    ]);
    if (ov.decayConfig) {
      setVipDecayEnabled(Boolean(ov.decayConfig.enabled));
      setVipDecayGraceDays(String(ov.decayConfig.graceDays ?? 15));
      setVipDecayMode(ov.decayConfig.mode === 'percent' ? 'percent' : 'fixed');
      setVipDecayDailyAmount(String(ov.decayConfig.dailyAmount ?? 50));
      setVipDecayDailyPercent(String(ov.decayConfig.dailyPercent ?? 5));
    }
    setVipSubHistory(ov.subscriptionHistory || []);
    setVipPointLedgerRows(ov.pointLedger || []);
    setUsersList(usr.users || []);
  }, [apiFetch]);

  const loadSecurity = useCallback(async () => {
    const [r, l, qrCfg, qrHist] = await Promise.all([
      apiFetch<{ admins: Array<Record<string, unknown>> }>('/api/admin/roles'),
      apiFetch<{ logs: Array<Record<string, unknown>> }>('/api/admin/audit-logs'),
      apiFetch<{
        upiConfig?: {
          accountName: string;
          upiId: string;
          provider: string;
          note?: string;
          active?: boolean;
          screens?: string[];
          customQrDataUrl?: string | null;
          qrDataUrl?: string;
          versionNumber?: number;
        };
      }>('/api/admin/upi-config').catch(() => ({ upiConfig: undefined })),
      apiFetch<{ versions?: PaymentQrVersionRecord[] }>('/api/admin/upi-config/history').catch(() => ({
        versions: [],
      })),
    ]);
    setRolesAdmins(r.admins || []);
    setAuditLogs(l.logs || []);
    if (qrCfg.upiConfig) {
      const cfg = qrCfg.upiConfig;
      setUpiAccName(cfg.accountName || '');
      setUpiIdInput(cfg.upiId || '');
      setUpiProvider(cfg.provider || '');
      setUpiNote(cfg.note || '');
      setUpiActive(cfg.active !== false);
      setUpiScreens(Array.isArray(cfg.screens) && cfg.screens.length > 0 ? cfg.screens : ['coins', 'vip']);
      setUpiCustomQr(cfg.customQrDataUrl ?? null);
      setUpiLiveQrPreview(cfg.customQrDataUrl || cfg.qrDataUrl || null);
      setUpiCurrentVersionNum(cfg.versionNumber ?? null);
    }
    setQrVersions(qrHist.versions || []);
  }, [apiFetch]);

  const loadPermissions = useCallback(async () => {
    const [cat, sets, hist, rolesRes] = await Promise.all([
      apiFetch<{ permissions: string[] }>('/api/admin/permissions/catalog'),
      apiFetch<{ sets: Array<{ id: string; name: string; description?: string; permissions: string[] }> }>(
        '/api/admin/permissions/sets'
      ),
      apiFetch<{ history: Array<Record<string, unknown>> }>('/api/admin/permissions/history'),
      apiFetch<{ admins: Array<Record<string, unknown>> }>('/api/admin/roles'),
    ]);
    setPermCatalog(cat.permissions || []);
    setPermSets(sets.sets || []);
    setPermHistory(hist.history || []);
    setRolesAdmins(rolesRes.admins || []);
  }, [apiFetch]);

  const loadConfigAndRooms = useCallback(async () => {
    const [cfgRes, roomsRes] = await Promise.all([
      apiFetch<{ config: AppConfig }>('/api/admin/app-config'),
      apiFetch<{ rooms: Array<Record<string, unknown>> }>('/api/admin/rooms'),
    ]);
    setAppConfig(cfgRes.config);
    setAdminRooms(roomsRes.rooms || []);
  }, [apiFetch]);

  const refreshActiveTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'overview') await loadStats();
      else if (tab === 'payments') await loadPayments();
      else if (tab === 'withdrawals') await loadWithdrawals();
      else if (tab === 'users') await loadUsers();
      else if (tab === 'vip') await loadVipOverview();
      else if (tab === 'catalog') await loadCatalog();
      else if (tab === 'moderation') await loadModeration();
      else if (tab === 'bans') await loadBans();
      else if (tab === 'permissions') await loadPermissions();
      else if (tab === 'config') await loadConfigAndRooms();
      else if (tab === 'security') await loadSecurity();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    loadStats,
    loadPayments,
    loadWithdrawals,
    loadUsers,
    loadVipOverview,
    loadCatalog,
    loadModeration,
    loadBans,
    loadPermissions,
    loadConfigAndRooms,
    loadSecurity,
  ]);

  useEffect(() => {
    refreshActiveTab();
  }, [refreshActiveTab]);

  // Actions
  const handleApproveOrder = async (orderId: string) => {
    try {
      await apiFetch(`/api/admin/payments/${encodeURIComponent(orderId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: 'Verified UTR & screenshot' }),
      });
      flash(true, `Order ${orderId} approved! VIP/Coins activated immediately.`);
      await Promise.all([loadPayments(), loadStats()]);
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Approval failed.');
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      const reason = rejectReasonMap[orderId]?.trim() || 'Invalid or unverified payment proof.';
      await apiFetch(`/api/admin/payments/${encodeURIComponent(orderId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: reason }),
      });
      flash(true, `Order ${orderId} rejected. VIP remains inactive.`);
      await Promise.all([loadPayments(), loadStats()]);
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Rejection failed.');
    }
  };

  const handleReviewWithdrawal = async (
    requestId: string,
    action: 'approve' | 'complete' | 'reject'
  ) => {
    try {
      const reviewNote = withdrawNoteMap[requestId]?.trim() || undefined;
      await apiFetch(`/api/admin/withdrawals/${encodeURIComponent(requestId)}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, reviewNote }),
      });
      flash(
        true,
        action === 'reject'
          ? `Withdrawal ${requestId} rejected & coins refunded.`
          : action === 'complete'
            ? `Withdrawal ${requestId} marked as completed payout!`
            : `Withdrawal ${requestId} approved for payout.`
      );
      await loadWithdrawals();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Withdrawal review failed.');
    }
  };

  const handleToggleWalletFreeze = async (targetUid: string, freeze: boolean, label?: string) => {
    try {
      await apiFetch(`/api/admin/wallets/${encodeURIComponent(targetUid)}/freeze`, {
        method: 'POST',
        body: JSON.stringify({
          freeze,
          reason: freeze ? 'Frozen by Admin moderation via /admin' : 'Unfrozen by Admin via /admin',
        }),
      });
      flash(true, `${label || targetUid} wallet ${freeze ? 'frozen' : 'unfrozen'}.`);
      await Promise.all([
        tab === 'users' ? loadUsers() : Promise.resolve(),
        tab === 'withdrawals' ? loadWithdrawals() : Promise.resolve(),
      ]);
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Wallet freeze toggle failed.');
    }
  };

  const handleAdjustCoins = async (sign: 1 | -1) => {
    const mag = Math.abs(Math.floor(Number(coinDeltaInput || 0)));
    if (selectedUids.length === 0 || !mag) {
      flash(false, 'Select at least one user and enter a positive coin quantity.');
      return;
    }
    try {
      await apiFetch('/api/admin/wallets/adjust', {
        method: 'POST',
        body: JSON.stringify({
          targetUids: selectedUids,
          deltaCoins: sign * mag,
          reason: coinReasonInput.trim() || (sign > 0 ? 'Admin Coin Grant' : 'Admin Coin Deduction'),
        }),
      });
      flash(
        true,
        `${sign > 0 ? 'Added' : 'Deducted'} ${mag.toLocaleString()} Coins for ${selectedUids.length} user(s).`
      );
      await loadUsers();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Coin adjustment failed.');
    }
  };

  const handleSetUserStatus = async (uid: string, status: 'active' | 'suspended' | 'banned') => {
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, reason: `Updated to ${status} via /admin` }),
      });
      flash(true, `Account status updated to "${status}".`);
      await loadUsers();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleOpenUserHistory = async (uid: string) => {
    try {
      const data = await apiFetch<{
        user: Record<string, unknown> | null;
        walletTransactions: Array<Record<string, unknown>>;
        paymentOrders: Array<Record<string, unknown>>;
        vipSubscriptionHistory?: Array<Record<string, unknown>>;
        vipPointLedger?: Array<Record<string, unknown>>;
      }>(`/api/admin/users/${encodeURIComponent(uid)}/history`);
      setHistoryModal(data);
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to fetch user history.');
    }
  };

  const handleSubmitVipOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipOverrideTarget) return;
    if (vipOverrideReason.trim().length < 3) {
      flash(false, 'Mandatory reason (minimum 3 characters) is required for VIP status update.');
      return;
    }
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(vipOverrideTarget.uid)}/vip`, {
        method: 'POST',
        body: JSON.stringify({
          vipStatus: vipOverrideStatus,
          durationDays: vipOverrideDays,
          reason: vipOverrideReason.trim(),
        }),
      });
      flash(true, `VIP status updated for ${vipOverrideTarget.publicId}.`);
      setVipOverrideTarget(null);
      await loadUsers();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'VIP update failed.');
    }
  };

  const handleSaveShopItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      flash(false, 'Item name is required.');
      return;
    }
    const parsedDays = shopDurationDays.trim() ? Math.max(1, Math.floor(Number(shopDurationDays))) : null;
    try {
      await apiFetch('/api/admin/shop-items', {
        method: 'POST',
        body: JSON.stringify({
          id: shopEditingId || undefined,
          name: shopName.trim(),
          category: shopCategory,
          description: shopDescription.trim() || `${shopName.trim()} (${shopCategory})`,
          priceCoins: Math.max(0, Math.floor(Number(shopPriceCoins || 0))),
          durationDays: parsedDays,
          imageUrl: shopImageUrl.trim() || null,
          previewColor: shopPreviewColor || '#22D3EE',
          active: shopActive,
        }),
      });
      flash(true, shopEditingId ? `Updated shop item "${shopName.trim()}".` : `Created shop item "${shopName.trim()}".`);
      setShopEditingId(null);
      setShopName('');
      setShopDescription('');
      setShopImageUrl('');
      await loadCatalog();
      onShopItemsChanged?.();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save shop item.');
    }
  };

  const handleToggleShopItemActive = async (item: ShopItem) => {
    try {
      await apiFetch(`/api/admin/shop-items/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: item.active === false }),
      });
      flash(true, `${item.name} ${item.active === false ? 'activated' : 'deactivated'}.`);
      await loadCatalog();
      onShopItemsChanged?.();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to toggle shop item.');
    }
  };

  const handleDeleteShopItem = async (item: ShopItem) => {
    try {
      await apiFetch(`/api/admin/shop-items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      flash(true, `Deleted shop item "${item.name}".`);
      await loadCatalog();
      onShopItemsChanged?.();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to delete shop item.');
    }
  };

  const handleApproveCustomGift = async (giftId: string, defaultCost: number, defaultCharm: number) => {
    const ov = customGiftOverrides[giftId] || {};
    const cost = Math.max(1, Math.floor(Number(ov.cost ?? defaultCost)));
    const charmValue = Math.max(1, Math.floor(Number(ov.charmValue ?? defaultCharm)));
    try {
      await apiFetch(`/api/admin/custom-gifts/${encodeURIComponent(giftId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          cost,
          charmValue,
          reviewNote: ov.reviewNote?.trim() || 'Approved & published to Gift Dock',
        }),
      });
      flash(true, 'Custom gift approved & published live!');
      await loadCatalog();
      onCustomGiftsChanged?.();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to approve custom gift.');
    }
  };

  const handleRejectCustomGift = async (giftId: string) => {
    const ov = customGiftOverrides[giftId] || {};
    try {
      await apiFetch(`/api/admin/custom-gifts/${encodeURIComponent(giftId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reviewNote: ov.reviewNote?.trim() || 'Did not meet artwork guidelines.',
        }),
      });
      flash(true, 'Custom gift submission rejected.');
      await loadCatalog();
      onCustomGiftsChanged?.();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to reject custom gift.');
    }
  };

  const handleCreateBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTargetUid.trim()) {
      flash(false, 'Target User ID / Public ID is required.');
      return;
    }
    if (banReason.trim().length < 2) {
      flash(false, 'Ban reason (min 2 characters) is required.');
      return;
    }
    const durationDays =
      banDurationPreset === 'permanent'
        ? null
        : banDurationPreset === 'custom'
          ? Math.max(1, Math.floor(Number(banCustomDays || 1)))
          : Number(banDurationPreset);
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(banTargetUid.trim())}/bans`, {
        method: 'POST',
        body: JSON.stringify({
          banType,
          durationDays,
          reason: banReason.trim(),
        }),
      });
      flash(true, `Applied ${banType.toUpperCase()} ban to ${banTargetUid.trim()}.`);
      setBanReason('');
      await loadBans();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to create ban.');
    }
  };

  const handleRevokeBan = async (banId: number) => {
    try {
      await apiFetch(`/api/admin/bans/${banId}/revoke`, { method: 'POST' });
      flash(true, `Ban #${banId} revoked.`);
      await loadBans();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to revoke ban.');
    }
  };

  const handleAdminGrantVip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipGrantTargetId.trim()) {
      flash(false, 'Enter target Public User ID.');
      return;
    }
    if (vipGrantReason.trim().length < 3) {
      flash(false, 'Mandatory audit reason (minimum 3 characters) is required.');
      return;
    }
    try {
      await apiFetch('/api/admin/vip-subscriptions/grant', {
        method: 'POST',
        body: JSON.stringify({
          targetUserUid: vipGrantTargetId.trim(),
          months: Number(vipGrantMonths || 1),
          reason: vipGrantReason.trim(),
        }),
      });
      flash(true, `Granted ${vipGrantMonths} month(s) VIP subscription to ${vipGrantTargetId.trim()}.`);
      setVipGrantReason('');
      await loadVipOverview();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'VIP subscription grant failed.');
    }
  };

  const handleSaveDecayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/vip-decay-config', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: vipDecayEnabled,
          graceDays: Number(vipDecayGraceDays || 15),
          mode: vipDecayMode,
          dailyAmount: Number(vipDecayDailyAmount || 50),
          dailyPercent: Number(vipDecayDailyPercent || 5),
        }),
      });
      flash(true, 'VIP Point Decay configuration saved.');
      await loadVipOverview();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save decay config.');
    }
  };

  const handleRunDecaySweepNow = async () => {
    try {
      const res = await apiFetch<{
        ok: boolean;
        summary?: { expiredUpdated?: number; decayedUsers?: number; totalPointsDeducted?: number };
      }>('/api/admin/vip-decay/run', { method: 'POST' });
      const s = res.summary;
      flash(
        true,
        `Decay sweep done: ${s?.expiredUpdated ?? 0} expired, ${s?.decayedUsers ?? 0} decayed (-${s?.totalPointsDeducted ?? 0} pts).`
      );
      await loadVipOverview();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to run decay sweep.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim()) return;
    try {
      await apiFetch('/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          title: evtTitle.trim(),
          subtitle: evtSub.trim(),
          rewardCoins: Number(evtReward || 0),
          status: 'live',
        }),
      });
      setEvtTitle('');
      setEvtSub('');
      flash(true, 'Live event published and synced to all users!');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to create event.');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await apiFetch(`/api/admin/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
      flash(true, 'Event removed.');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to delete event.');
    }
  };

  const handleCreateGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftName.trim()) return;
    try {
      await apiFetch('/api/admin/gifts', {
        method: 'POST',
        body: JSON.stringify({
          name: giftName.trim(),
          cost: Number(giftCost || 100),
          charmValue: Number(giftCost || 100),
          rarity: giftRarity,
        }),
      });
      setGiftName('');
      flash(true, 'Gift added to live catalog!');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to create gift.');
    }
  };

  const handleDeactivateGift = async (id: string) => {
    try {
      await apiFetch(`/api/admin/gifts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      flash(true, 'Gift deactivated.');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to deactivate gift.');
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgTitle.trim()) return;
    try {
      if (pkgType === 'vip') {
        await apiFetch('/api/admin/packages/vip', {
          method: 'POST',
          body: JSON.stringify({
            name: pkgTitle.trim(),
            priceInr: Number(pkgPriceInr || 200),
            grantedVipLevel: 1,
            bonusGrowth: 0,
            durationDays: Number(pkgDays || 30),
          }),
        });
      } else {
        await apiFetch('/api/admin/packages/coins', {
          method: 'POST',
          body: JSON.stringify({
            label: pkgTitle.trim(),
            priceInr: Number(pkgPriceInr || 100),
            coins: Number(pkgValue || 1000000),
          }),
        });
      }
      setPkgTitle('');
      flash(true, 'Package saved to catalog!');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save package.');
    }
  };

  const resetTaskForm = () => {
    setTaskEditingId(null);
    setTaskTitle('');
    setTaskSubtitle('');
    setTaskCategory('daily');
    setTaskActionType('checkin');
    setTaskTargetCount('1');
    setTaskReward('500');
    setTaskSortOrder('10');
    setTaskActive(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const payload = {
        title: taskTitle.trim(),
        subtitle: taskSubtitle.trim(),
        category: taskCategory,
        actionType: taskActionType,
        targetCount: Math.max(1, Number(taskTargetCount || 1)),
        rewardCoins: Math.max(1, Number(taskReward || 500)),
        sortOrder: Number(taskSortOrder || 10),
        active: taskActive,
      };
      if (taskEditingId) {
        await apiFetch(`/api/admin/tasks/${encodeURIComponent(taskEditingId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        flash(true, 'Task updated!');
      } else {
        await apiFetch('/api/admin/tasks', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        flash(true, 'Task created!');
      }
      resetTaskForm();
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save task.');
    }
  };

  const handleEditTask = (t: Record<string, unknown>) => {
    setTaskEditingId(String(t.id));
    setTaskTitle(String(t.title || ''));
    setTaskSubtitle(String(t.subtitle || ''));
    setTaskCategory(String(t.category || 'daily'));
    setTaskActionType(String(t.actionType || 'checkin'));
    setTaskTargetCount(String(t.targetCount ?? 1));
    setTaskReward(String(t.rewardCoins ?? 500));
    setTaskSortOrder(String(t.sortOrder ?? 10));
    setTaskActive(t.active !== false);
  };

  const handleToggleTaskActive = async (t: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/admin/tasks/${encodeURIComponent(String(t.id))}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: t.active === false }),
      });
      flash(true, t.active === false ? 'Task activated!' : 'Task paused!');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to toggle task.');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await apiFetch(`/api/admin/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (taskEditingId === id) resetTaskForm();
      flash(true, 'Task deleted!');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to delete task.');
    }
  };

  const handleAdminUpdateTaskProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progUserId.trim() || !progTaskId.trim()) return;
    try {
      await apiFetch('/api/admin/tasks/progress', {
        method: 'POST',
        body: JSON.stringify({
          userIdentifier: progUserId.trim(),
          taskId: progTaskId.trim(),
          progress: Math.max(0, Number(progValue || 0)),
          claimed: progClaimed,
        }),
      });
      flash(true, `Updated task progress for ${progUserId.trim()}!`);
      setProgUserId('');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to update task progress.');
    }
  };

  const handleCreateBg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgName.trim()) return;
    try {
      await apiFetch('/api/admin/backgrounds', {
        method: 'POST',
        body: JSON.stringify({ name: bgName.trim(), gradient: bgGradient }),
      });
      setBgName('');
      flash(true, 'Room background saved!');
      await loadCatalog();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save background.');
    }
  };

  const handleResolveReport = async (id: number, status: 'resolved' | 'dismissed', removePost = false) => {
    try {
      await apiFetch(`/api/admin/reports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status, removePost, resolutionNote: `${status} via /admin` }),
      });
      flash(true, `Report #${id} marked ${status}.`);
      await loadModeration();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to resolve report.');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    try {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: annTitle.trim(),
          body: annBody.trim(),
          targetUid: annTargetUid.trim() || undefined,
        }),
      });
      setAnnTitle('');
      setAnnBody('');
      setAnnTargetUid('');
      flash(true, 'Announcement dispatched in real time!');
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to publish announcement.');
    }
  };

  const handleOpenUserInspect = async (uid: string) => {
    try {
      const data = await apiFetch<{
        user: Record<string, unknown> | null;
        banReason?: string | null;
        adminNotes?: Array<{ id: string; note: string; authorName: string; createdAt: string }>;
        inventory?: Array<Record<string, unknown>>;
        effectivePermissions?: string[];
        walletTransactions?: Array<Record<string, unknown>>;
        paymentOrders?: Array<Record<string, unknown>>;
      }>(`/api/admin/users/${encodeURIComponent(uid)}/inspect`);
      setInspectModal({
        user: data.user,
        banReason: data.banReason ?? null,
        adminNotes: data.adminNotes ?? [],
        inventory: data.inventory ?? [],
        effectivePermissions: data.effectivePermissions ?? [],
        walletTransactions: data.walletTransactions ?? [],
        paymentOrders: data.paymentOrders ?? [],
      });
      setNewAdminNote('');
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to inspect user.');
    }
  };

  const handleAddAdminNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = String(inspectModal?.user?.uid || '');
    if (!targetId || !newAdminNote.trim()) return;
    try {
      const res = await apiFetch<{
        adminNotes: Array<{ id: string; note: string; authorName: string; createdAt: string }>;
      }>(`/api/admin/users/${encodeURIComponent(targetId)}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ note: newAdminNote.trim() }),
      });
      setInspectModal((prev) => (prev ? { ...prev, adminNotes: res.adminNotes } : null));
      setNewAdminNote('');
      flash(true, 'Admin note saved.');
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save admin note.');
    }
  };

  const handleUpdateUpiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiAccName.trim() || !upiIdInput.trim() || !upiProvider.trim()) {
      flash(false, 'Account holder name, UPI ID, and Payment provider are required.');
      return;
    }
    if (upiScreens.length === 0) {
      flash(false, 'Select at least one purchase screen (Coin Purchase or VIP Purchase).');
      return;
    }
    try {
      const res = await apiFetch<{
        upiConfig?: { qrDataUrl?: string; versionNumber?: number };
      }>('/api/admin/upi-config', {
        method: 'PUT',
        body: JSON.stringify({
          accountName: upiAccName.trim(),
          upiId: upiIdInput.trim(),
          provider: upiProvider.trim(),
          note: upiNote.trim(),
          active: upiActive,
          screens: upiScreens,
          customQrDataUrl: upiCustomQr,
          changeSummary: upiChangeSummary.trim() || undefined,
        }),
      });
      if (res.upiConfig?.qrDataUrl) setUpiLiveQrPreview(res.upiConfig.qrDataUrl);
      if (res.upiConfig?.versionNumber) setUpiCurrentVersionNum(res.upiConfig.versionNumber);
      setUpiChangeSummary('');
      flash(true, 'Payment QR settings published! New orders will automatically use this version.');
      await loadSecurity();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to update UPI configuration.');
    }
  };

  const handleUpiQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      flash(false, 'Please upload a valid PNG, JPEG, WEBP, or GIF QR image.');
      return;
    }
    try {
      flash(true, 'Uploading QR image...');
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 1080,
        quality: 0.9,
        maxCompressedBytes: 750_000,
      });
      setUpiCustomQr(uploadedUrl);
      setUpiLiveQrPreview(uploadedUrl);
      flash(true, 'QR image ready. Tap Publish Payment QR Settings to activate.');
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to upload QR image.');
    }
  };

  const handleSavePermissionSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permSetName.trim()) return;
    try {
      await apiFetch('/api/admin/permissions/sets', {
        method: 'POST',
        body: JSON.stringify({
          name: permSetName.trim(),
          description: permSetDesc.trim(),
          permissions: permSetSelected,
        }),
      });
      setPermSetName('');
      setPermSetDesc('');
      setPermSetSelected([]);
      flash(true, 'Permission set saved.');
      await loadPermissions();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save permission set.');
    }
  };

  const handleAssignUserPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permTargetUid.trim()) return;
    try {
      await apiFetch(`/api/admin/permissions/users/${encodeURIComponent(permTargetUid.trim())}`, {
        method: 'POST',
        body: JSON.stringify({
          customPermissions: permTargetCustom,
          permissionSetId: permTargetSetId || null,
          expiresAt: permTargetExpires ? new Date(permTargetExpires).toISOString() : null,
          reason: permTargetReason.trim() || undefined,
        }),
      });
      flash(true, `Permissions updated for ${permTargetUid.trim()}.`);
      setPermTargetReason('');
      await loadPermissions();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to assign user permissions.');
    }
  };

  const handleSaveAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appConfig) return;
    try {
      const res = await apiFetch<{ config: AppConfig }>('/api/admin/app-config', {
        method: 'PUT',
        body: JSON.stringify(appConfig),
      });
      setAppConfig(res.config);
      flash(true, 'Global app configuration updated & broadcasted!');
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to save app config.');
    }
  };

  const handleAdminCloseRoom = async (roomId: string, title: string) => {
    try {
      await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: `Room "${title}" closed by Admin moderation.` }),
      });
      flash(true, `Voice room "${title}" closed.`);
      await loadConfigAndRooms();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to close voice room.');
    }
  };

  const handleSetRoomLevel = async (roomId: string, title: string, rawLevel: string) => {
    const parsed = Math.max(1, Math.min(30, Math.floor(Number(rawLevel || 1))));
    try {
      await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}/level`, {
        method: 'PATCH',
        body: JSON.stringify({ roomLevel: parsed }),
      });
      flash(true, `Updated "${title}" room level to Lv.${parsed}.`);
      await loadConfigAndRooms();
      onRefreshApp();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Failed to update room level.');
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTargetUid.trim()) return;
    try {
      await apiFetch('/api/admin/roles/assign', {
        method: 'POST',
        body: JSON.stringify({ userUid: roleTargetUid.trim(), role: roleAssignValue }),
      });
      flash(true, `Assigned role "${roleAssignValue}" to ${roleTargetUid.trim()}.`);
      setRoleTargetUid('');
      await loadSecurity();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Role assignment failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 border-b border-amber-400/25 bg-[#0A101E]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to App</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <h1 className="font-display text-base font-black tracking-wide text-white uppercase sm:text-lg">
                  OG VELOCITY Admin Portal
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                Role: <strong className="text-amber-300 uppercase">{currentUserRole}</strong>
                {currentUserEmail ? ` · ${currentUserEmail}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshActiveTab}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Nav Tabs */}
        <div className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6">
          {(
            [
              { id: 'overview', label: 'Overview', icon: <Trophy className="h-3.5 w-3.5" /> },
              { id: 'payments', label: 'Payments & VIP Queue', icon: <QrCode className="h-3.5 w-3.5" /> },
              { id: 'withdrawals', label: 'Withdrawals & Banking', icon: <Wallet className="h-3.5 w-3.5" /> },
              { id: 'users', label: 'Users & Coins', icon: <Users className="h-3.5 w-3.5" /> },
              { id: 'vip', label: 'VIP Control', icon: <Crown className="h-3.5 w-3.5" /> },
              { id: 'catalog', label: 'Gifts, Events & Catalog', icon: <Layers className="h-3.5 w-3.5" /> },
              { id: 'moderation', label: 'Moderation & Notices', icon: <Bell className="h-3.5 w-3.5" /> },
              { id: 'bans', label: 'User Bans', icon: <XCircle className="h-3.5 w-3.5" /> },
              { id: 'permissions', label: 'Permissions', icon: <Shield className="h-3.5 w-3.5" /> },
              { id: 'config', label: 'App Config & Rooms', icon: <Layers className="h-3.5 w-3.5" /> },
              { id: 'security', label: 'Payment QR & Audit Trail', icon: <Lock className="h-3.5 w-3.5" /> },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                tab === item.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {notice && (
          <div
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-bold ${
              notice.ok
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-rose-400/40 bg-rose-500/15 text-rose-200'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { label: 'Total Users', value: stats?.totalUsers ?? '—', accent: 'text-white' },
                { label: 'Active VIPs', value: stats?.activeVipUsers ?? '—', accent: 'text-amber-300' },
                {
                  label: 'Pending Payment Reviews',
                  value: stats?.pendingPaymentReviews ?? '—',
                  accent: 'text-rose-300',
                },
                {
                  label: 'Approved Revenue (INR)',
                  value: stats ? `₹${stats.approvedRevenueInr.toLocaleString()}` : '—',
                  accent: 'text-emerald-300',
                },
                {
                  label: 'Coins in Circulation',
                  value: stats ? stats.totalCoinsInCirculation.toLocaleString() : '—',
                  accent: 'text-amber-300',
                },
                { label: 'Gift Transactions', value: stats?.totalGiftTransactions ?? '—', accent: 'text-pink-300' },
                { label: 'Open Reports', value: stats?.openReports ?? '—', accent: 'text-orange-300' },
                { label: 'Live Voice Rooms / Events', value: stats ? `${stats.totalVoiceRooms} / ${stats.liveEvents}` : '—', accent: 'text-cyan-300' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-[#0D1526] p-4"
                >
                  <div className="text-[11px] font-bold text-slate-400 uppercase">{card.label}</div>
                  <div className={`font-mono-tabular mt-2 text-2xl font-black ${card.accent}`}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTab('payments')}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950"
              >
                <QrCode className="h-4 w-4" />
                <span>Review Payment Queue ({stats?.pendingPaymentReviews ?? 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('users')}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-200"
              >
                <Coins className="h-4 w-4" />
                <span>Manage Users &amp; Coins</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENTS & VIP APPROVAL QUEUE */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-white">
                Permanent UPI Payment Verification Queue
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'pending_review', label: 'Pending Review' },
                  { id: 'pending_proof', label: 'Awaiting UTR' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                  { id: '', label: 'All' },
                ].map((f) => (
                  <button
                    key={f.id || 'all'}
                    type="button"
                    onClick={() => setPaymentFilter(f.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      paymentFilter === f.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'border border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-8 text-center text-sm text-slate-400">
                No payment orders matching &ldquo;{paymentFilter || 'all'}&rdquo;.
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((ord) => (
                  <div
                    key={ord.orderId}
                    className="rounded-2xl border border-white/10 bg-[#0D1526] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-amber-300">{ord.orderId}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                              ord.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : ord.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : ord.status === 'pending_review'
                                    ? 'bg-amber-500/20 text-amber-200'
                                    : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {ord.status}
                          </span>
                          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                            {ord.orderType === 'vip'
                              ? `VIP Lv.${ord.grantedVipLevel} (${ord.vipDurationDays}d)`
                              : `${ord.coinsAmount.toLocaleString()} Coins`}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {ord.packageName} ·{' '}
                          <span className="text-emerald-300">₹{ord.amountInr} INR</span>
                        </div>
                        <div className="text-slate-300">
                          User: <strong>{ord.userName || ord.userUid}</strong> ({ord.userPublicId || ord.userUid})
                          {ord.userEmail ? ` · ${ord.userEmail}` : ''}
                          {ord.userPhone ? ` · ${ord.userPhone}` : ''}
                        </div>
                        <div className="font-mono text-slate-400">
                          UPI: <span className="text-slate-200">{ord.upiIdUsed}</span>
                          {ord.providerUsed ? ` (${ord.providerUsed})` : ''}
                          {ord.qrVersionId ? ` · QR #${ord.qrVersionId}` : ''} · UTR:{' '}
                          <strong className="text-amber-200">{ord.utrNumber || 'Not submitted'}</strong>
                        </div>
                        {(ord.accountHolderName || ord.paymentDateTime) && (
                          <div className="text-cyan-200">
                            {ord.accountHolderName ? `Payer Name: ${ord.accountHolderName}` : ''}
                            {ord.accountHolderName && ord.paymentDateTime ? ' · ' : ''}
                            {ord.paymentDateTime ? `Payment Time: ${ord.paymentDateTime}` : ''}
                          </div>
                        )}
                        {ord.payerNote && (
                          <div className="text-slate-400">Payer Note: {ord.payerNote}</div>
                        )}
                        {ord.reviewNote && (
                          <div className="text-cyan-300">Review Note: {ord.reviewNote}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {ord.screenshotDataUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewScreenshot(ord.screenshotDataUrl)}
                            className="group relative overflow-hidden rounded-xl border border-white/20 bg-black/40 p-1"
                            title="Inspect Payment Screenshot"
                          >
                            <img
                              src={ord.screenshotDataUrl}
                              alt="UTR Screenshot"
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                            <span className="mt-1 block text-[10px] font-bold text-cyan-300">
                              View Proof
                            </span>
                          </button>
                        )}

                        {canApprove && ord.status === 'pending_review' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleApproveOrder(ord.orderId)}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Approve &amp; Activate</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectOrder(ord.orderId)}
                                className="inline-flex items-center gap-1 rounded-xl bg-rose-500/20 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/35"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={rejectReasonMap[ord.orderId] || ''}
                              onChange={(e) =>
                                setRejectReasonMap((m) => ({ ...m, [ord.orderId]: e.target.value }))
                              }
                              placeholder="Optional rejection reason..."
                              className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white placeholder-slate-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2B: WITHDRAWALS & BANKING */}
        {tab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-white">
                Coin Withdrawal Requests &amp; Wallet Freeze
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'pending', label: 'Pending' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'rejected', label: 'Rejected' },
                  { id: '', label: 'All' },
                ].map((f) => (
                  <button
                    key={f.id || 'all'}
                    type="button"
                    onClick={() => setWithdrawalFilter(f.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      withdrawalFilter === f.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'border border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {withdrawalsList.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-8 text-center text-sm text-slate-400">
                No withdrawal requests matching &ldquo;{withdrawalFilter || 'all'}&rdquo;.
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawalsList.map((w) => (
                  <div key={w.requestId} className="rounded-2xl border border-white/10 bg-[#0D1526] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-amber-300">{w.requestId}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                              w.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : w.status === 'approved'
                                  ? 'bg-cyan-500/20 text-cyan-200'
                                  : w.status === 'rejected'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-200'
                            }`}
                          >
                            {w.status}
                          </span>
                          {w.walletFrozen && (
                            <span className="rounded-full bg-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                              WALLET FROZEN
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-white">
                          {w.amountCoins.toLocaleString()} Coins ·{' '}
                          <span className="text-emerald-300">₹{w.amountInr.toLocaleString()} INR</span>{' '}
                          ({w.payoutMethod.toUpperCase()})
                        </div>
                        <div className="text-slate-300">
                          User: <strong>{w.userName || w.userUid}</strong> ({w.userPublicId || w.userUid}) · Wallet Bal:{' '}
                          <span className="font-mono text-amber-200">{w.walletCoins.toLocaleString()}</span>
                        </div>
                        <div className="font-mono text-cyan-200">
                          Holder: {w.accountHolderName} · Dest: {w.upiOrAccount}
                          {w.ifscOrBank ? ` · IFSC/Bank: ${w.ifscOrBank}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Requested: {new Date(w.createdAt).toLocaleString()}
                          {w.reviewNote ? ` · Note: ${w.reviewNote}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {canApprove && (w.status === 'pending' || w.status === 'approved') && (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {w.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleReviewWithdrawal(w.requestId, 'approve')}
                                  className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-cyan-400"
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleReviewWithdrawal(w.requestId, 'complete')}
                                className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-emerald-400"
                              >
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewWithdrawal(w.requestId, 'reject')}
                                className="rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/35"
                              >
                                Reject &amp; Refund
                              </button>
                            </div>
                            <input
                              type="text"
                              value={withdrawNoteMap[w.requestId] || ''}
                              onChange={(e) =>
                                setWithdrawNoteMap((m) => ({ ...m, [w.requestId]: e.target.value }))
                              }
                              placeholder="Optional review / UTR payout note..."
                              className="w-60 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white placeholder-slate-500"
                            />
                          </>
                        )}
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleWalletFreeze(
                                w.userPublicId || w.userUid,
                                !w.walletFrozen,
                                w.userName || w.userPublicId || w.userUid
                              )
                            }
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                              w.walletFrozen
                                ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/35'
                                : 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/30'
                            }`}
                          >
                            {w.walletFrozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: USERS & COINS */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadUsers();
                }}
                className="flex flex-1 items-center gap-2"
              >
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by User ID (e.g. 100001), name, email, or phone..."
                    className="w-full rounded-xl border border-white/15 bg-[#0D1526] py-2 pr-3 pl-9 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950"
                >
                  Search
                </button>
              </form>

              {canApprove && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-400/25 bg-[#0D1526] p-2.5">
                  <span className="text-[11px] font-bold text-amber-300">
                    Selected ({selectedUids.length})
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={coinDeltaInput}
                    onChange={(e) => setCoinDeltaInput(e.target.value)}
                    className="w-28 rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-white"
                  />
                  <input
                    type="text"
                    value={coinReasonInput}
                    onChange={(e) => setCoinReasonInput(e.target.value)}
                    placeholder="Reason"
                    className="w-36 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustCoins(1)}
                    className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-black text-slate-950"
                  >
                    + Add Coins
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustCoins(-1)}
                    className="rounded-lg bg-rose-500/25 px-3 py-1 text-xs font-bold text-rose-200"
                  >
                    - Deduct
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0D1526]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold text-slate-400 uppercase">
                  <tr>
                    <th className="p-3">
                      <input
                        type="checkbox"
                        checked={usersList.length > 0 && selectedUids.length === usersList.length}
                        onChange={(e) =>
                          setSelectedUids(e.target.checked ? usersList.map((u) => u.uid) : [])
                        }
                      />
                    </th>
                    <th className="p-3">User</th>
                    <th className="p-3">Contact / Role</th>
                    <th className="p-3">Coins</th>
                    <th className="p-3">VIP Status</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usersList.map((u) => {
                    const checked = selectedUids.includes(u.uid);
                    return (
                      <tr key={u.uid} className="hover:bg-white/5">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedUids((prev) =>
                                e.target.checked ? [...prev, u.uid] : prev.filter((id) => id !== u.uid)
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white">{u.name || 'OG Player'}</div>
                          <div className="font-mono text-[11px] text-cyan-300">{u.publicId}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-slate-300">{u.email || u.phone || u.primaryProvider}</div>
                          <div className="text-[10px] font-bold text-amber-300 uppercase">{u.role}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-300">
                          <div>{Number(u.coins ?? 0).toLocaleString()}</div>
                          {u.walletFrozen && (
                            <span className="mt-0.5 inline-block rounded bg-rose-500/25 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-200">
                              FROZEN
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {u.vipStatus === 'active' ? (
                            <div>
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                                VIP {u.vipLevel} · Active
                              </span>
                              {u.vipExpiresAt && (
                                <div className="mt-0.5 text-[10px] text-slate-400">
                                  Exp: {new Date(u.vipExpiresAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="text-slate-400">Not Active</span>
                              {u.vipGrowth ? (
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                  {Number(u.vipGrowth).toLocaleString()} pts saved
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              u.accountStatus === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : u.accountStatus === 'suspended'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {u.accountStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenUserInspect(u.uid)}
                              className="rounded-lg bg-cyan-500/20 px-2 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/35"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenUserHistory(u.uid)}
                              className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/20"
                            >
                              <Eye className="inline h-3 w-3 mr-1" />History
                            </button>
                            {canApprove && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleWalletFreeze(u.uid, !u.walletFrozen, u.name || u.publicId)
                                }
                                className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                                  u.walletFrozen
                                    ? 'bg-emerald-500/20 text-emerald-200'
                                    : 'bg-rose-500/15 text-rose-200'
                                }`}
                              >
                                {u.walletFrozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}
                              </button>
                            )}
                            {canModerate && u.accountStatus === 'active' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSetUserStatus(u.uid, 'suspended')}
                                  className="rounded-lg bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-200"
                                >
                                  Suspend
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetUserStatus(u.uid, 'banned')}
                                  className="rounded-lg bg-rose-500/20 px-2 py-1 text-[10px] font-bold text-rose-200"
                                >
                                  Ban
                                </button>
                              </>
                            )}
                            {canModerate && u.accountStatus !== 'active' && (
                              <button
                                type="button"
                                onClick={() => handleSetUserStatus(u.uid, 'active')}
                                className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-200"
                              >
                                Restore
                              </button>
                            )}
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVipOverrideTarget(u);
                                  setVipOverrideStatus(u.vipStatus === 'active' ? 'active' : 'active');
                                }}
                                className="rounded-lg bg-purple-500/25 px-2 py-1 text-[10px] font-bold text-purple-200"
                              >
                                <Crown className="inline h-3 w-3 mr-1" />VIP Status
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3B: VIP CONTROL (Admin Duration Grants, Super Admin Decay Config & History) */}
        {tab === 'vip' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Admin & Super Admin: Grant/Extend Subscription by Months Only */}
              <form
                onSubmit={handleAdminGrantVip}
                className="space-y-3 rounded-2xl border border-amber-400/25 bg-[#0D1526] p-5 text-xs lg:col-span-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-white">
                    Grant / Extend VIP Subscription (Months Only)
                  </h3>
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    Starts at VIP 1
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Admins can grant or extend VIP subscription duration (in months) with a mandatory audit reason. VIP level selection is disabled — new subscriptions start at VIP 1 and renewals preserve existing earned level.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Target Public User ID
                  </label>
                  <input
                    type="text"
                    required
                    value={vipGrantTargetId}
                    onChange={(e) => setVipGrantTargetId(e.target.value)}
                    placeholder="e.g. 100002"
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-white"
                  />
                  {usersList.length > 0 && (
                    <select
                      aria-label="Quick pick user"
                      value={vipGrantTargetId}
                      onChange={(e) => setVipGrantTargetId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] text-slate-300"
                    >
                      <option value="">-- Pick from recent users --</option>
                      {usersList.map((u) => (
                        <option key={u.uid} value={u.publicId}>
                          {u.name || 'OG Player'} ({u.publicId}) · VIP {u.vipLevel ?? 0} ({u.vipStatus})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Subscription Duration (Months)
                  </label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {[1, 3, 6, 12, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setVipGrantMonths(String(m))}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          Number(vipGrantMonths) === m
                            ? 'bg-amber-500 text-slate-950'
                            : 'border border-white/15 bg-black/30 text-slate-300'
                        }`}
                      >
                        {m === 60 ? '5 Years (60m)' : `${m}m`}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={vipGrantMonths}
                    onChange={(e) => setVipGrantMonths(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Mandatory Audit Reason (min 3 chars)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={vipGrantReason}
                    onChange={(e) => setVipGrantReason(e.target.value)}
                    placeholder="e.g. Offline bank verification / compensation"
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
                  />
                </div>

                {canApprove ? (
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-black text-slate-950"
                  >
                    Grant / Extend VIP Subscription
                  </button>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-center text-slate-400">
                    Admin or Super Admin role required to grant VIP subscriptions.
                  </div>
                )}
              </form>

              {/* Super Admin Only: VIP Point Decay Settings */}
              <form
                onSubmit={handleSaveDecayConfig}
                className="space-y-3 rounded-2xl border border-purple-400/25 bg-[#0D1526] p-5 text-xs lg:col-span-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-white">
                    VIP Point Decay Engine Settings
                  </h3>
                  <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-200">
                    Super Admin Only
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Expired VIP points enter a grace period first. After the grace period expires, points decay once per UTC day until renewed.
                </p>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="font-bold text-white">Enable Automatic Daily Decay</span>
                  <input
                    type="checkbox"
                    disabled={!isSuperAdmin}
                    checked={vipDecayEnabled}
                    onChange={(e) => setVipDecayEnabled(e.target.checked)}
                    className="h-4 w-4 accent-purple-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Grace Period (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      disabled={!isSuperAdmin}
                      value={vipDecayGraceDays}
                      onChange={(e) => setVipDecayGraceDays(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Decay Mode
                    </label>
                    <select
                      disabled={!isSuperAdmin}
                      value={vipDecayMode}
                      onChange={(e) => setVipDecayMode(e.target.value === 'percent' ? 'percent' : 'fixed')}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                    >
                      <option value="fixed">Fixed Points / Day</option>
                      <option value="percent">Percentage / Day</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Fixed Daily Points
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50000}
                      disabled={!isSuperAdmin}
                      value={vipDecayDailyAmount}
                      onChange={(e) => setVipDecayDailyAmount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Daily Percent (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      disabled={!isSuperAdmin}
                      value={vipDecayDailyPercent}
                      onChange={(e) => setVipDecayDailyPercent(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                {isSuperAdmin ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 rounded-xl bg-purple-500 py-2.5 text-xs font-black text-white hover:bg-purple-400"
                    >
                      Save Decay Config
                    </button>
                    <button
                      type="button"
                      onClick={handleRunDecaySweepNow}
                      className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
                    >
                      Run Sweep Now
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-center text-slate-400">
                    Read-only for regular Admins. Only Super Admin can modify VIP decay rules.
                  </div>
                )}
              </form>
            </div>

            {/* VIP Grant / Renewal Logs & VIP Point Decay Ledger */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 text-xs">
              <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-4">
                <h4 className="font-display text-sm font-bold text-amber-300">
                  Subscription Grant &amp; Renewal History ({vipSubHistory.length})
                </h4>
                <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {vipSubHistory.length === 0 ? (
                    <p className="text-slate-400">No subscription events logged yet.</p>
                  ) : (
                    vipSubHistory.map((row) => (
                      <div key={String(row.id)} className="flex justify-between gap-2 rounded-xl bg-black/35 px-3 py-2">
                        <div>
                          <div className="font-bold text-white">
                            {String(row.userName || 'Player')} ({String(row.userPublicId || row.userUid)}) · {String(row.packageName || row.actionType)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {String(row.reason || '')} {row.actorPublicId ? `· by ${String(row.actorPublicId)} (${String(row.actorRole || '')})` : ''}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-300">+{Number(row.daysGranted || 0)}d · VIP {Number(row.vipLevelAssigned || 1)}</div>
                          <div className="text-[10px] text-slate-400">
                            {row.expiresAtAfter ? `Exp: ${new Date(String(row.expiresAtAfter)).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-4">
                <h4 className="font-display text-sm font-bold text-cyan-300">
                  VIP Point Decay &amp; Earned Points Logs ({vipPointLedgerRows.length})
                </h4>
                <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {vipPointLedgerRows.length === 0 ? (
                    <p className="text-slate-400">No point ledger entries recorded yet.</p>
                  ) : (
                    vipPointLedgerRows.map((l) => (
                      <div key={String(l.id)} className="flex justify-between gap-2 rounded-xl bg-black/35 px-3 py-2">
                        <div>
                          <div className="font-bold text-white">
                            {String(l.userName || 'Player')} ({String(l.userPublicId || l.userUid)}) · {String(l.eventType)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {String(l.reason || '')} · {new Date(String(l.createdAt)).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className={Number(l.deltaPoints) >= 0 ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>
                            {Number(l.deltaPoints) >= 0 ? `+${l.deltaPoints}` : String(l.deltaPoints)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {Number(l.pointsAfter).toLocaleString()} pts (Lv.{Number(l.vipLevelAfter)})
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CATALOG & EVENTS */}
        {tab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'events', label: 'Events' },
                  { id: 'gifts', label: 'Gifts' },
                  { id: 'packages', label: 'Packages' },
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'backgrounds', label: 'Backgrounds' },
                  { id: 'shop', label: 'Rings & Frames Shop' },
                  { id: 'custom-gifts', label: 'Custom Gifts Queue' },
                ] as const
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setCatalogSubTab(sub.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold ${
                    catalogSubTab === sub.id
                      ? 'bg-cyan-500 text-slate-950'
                      : 'border border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {catalogSubTab === 'events' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <form
                  onSubmit={handleCreateEvent}
                  className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 lg:col-span-5"
                >
                  <h3 className="font-display text-sm font-bold text-white">Create / Update Live Event</h3>
                  <input
                    type="text"
                    required
                    value={evtTitle}
                    onChange={(e) => setEvtTitle(e.target.value)}
                    placeholder="Event Title (e.g. Weekend Voice Crown Gala)"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={evtSub}
                    onChange={(e) => setEvtSub(e.target.value)}
                    placeholder="Subtitle / Reward rule"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={evtReward}
                    onChange={(e) => setEvtReward(e.target.value)}
                    placeholder="Reward Coins"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950"
                  >
                    <Plus className="inline h-3.5 w-3.5 mr-1" /> Publish Live Event
                  </button>
                </form>

                <div className="space-y-2 lg:col-span-7">
                  {eventsList.map((ev) => (
                    <div
                      key={String(ev.id)}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0D1526] p-3.5 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{String(ev.title)}</div>
                        <div className="text-slate-400">
                          {String(ev.subtitle || '')} · Reward: {Number(ev.rewardCoins || 0).toLocaleString()} Coins
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(String(ev.id))}
                        className="rounded-lg bg-rose-500/20 p-2 text-rose-300 hover:bg-rose-500/35"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {catalogSubTab === 'gifts' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <form
                  onSubmit={handleCreateGift}
                  className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 lg:col-span-5"
                >
                  <h3 className="font-display text-sm font-bold text-white">Add / Update Gift</h3>
                  <input
                    type="text"
                    required
                    value={giftName}
                    onChange={(e) => setGiftName(e.target.value)}
                    placeholder="Gift Name"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    value={giftCost}
                    onChange={(e) => setGiftCost(e.target.value)}
                    placeholder="Coin Cost"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <select
                    value={giftRarity}
                    onChange={(e) => setGiftRarity(e.target.value as 'Standard' | 'Signature' | 'Mythic')}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Signature">Signature</option>
                    <option value="Mythic">Mythic</option>
                  </select>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950"
                  >
                    Save Gift to Catalog
                  </button>
                </form>

                <div className="space-y-2 lg:col-span-7">
                  {giftsList.map((g) => (
                    <div
                      key={String(g.id)}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0D1526] p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{String(g.name)}</span>{' '}
                        <span className="text-amber-300 font-mono">({Number(g.cost).toLocaleString()} Coins)</span>
                        <span className="ml-2 text-[10px] text-slate-400">
                          {String(g.rarity)} · {g.active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      {Boolean(g.active) && (
                        <button
                          type="button"
                          onClick={() => handleDeactivateGift(String(g.id))}
                          className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-300"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {catalogSubTab === 'packages' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <form
                  onSubmit={handleCreatePackage}
                  className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 lg:col-span-5"
                >
                  <h3 className="font-display text-sm font-bold text-white">Create Coin / VIP Package</h3>
                  <select
                    value={pkgType}
                    onChange={(e) => setPkgType(e.target.value as 'vip' | 'coins')}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  >
                    <option value="coins">Coin Package (INR)</option>
                    {isSuperAdmin && <option value="vip">VIP Subscription (INR · Super Admin Only)</option>}
                  </select>
                  <input
                    type="text"
                    required
                    value={pkgTitle}
                    onChange={(e) => setPkgTitle(e.target.value)}
                    placeholder={pkgType === 'vip' ? 'VIP Plan Name (e.g. 12 Months VIP)' : 'Coin Pack Label'}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    value={pkgPriceInr}
                    onChange={(e) => setPkgPriceInr(e.target.value)}
                    placeholder="Price INR"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  {pkgType === 'coins' ? (
                    <input
                      type="number"
                      min={1}
                      value={pkgValue}
                      onChange={(e) => setPkgValue(e.target.value)}
                      placeholder="Coins Amount"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                  ) : (
                    <>
                      <input
                        type="number"
                        min={1}
                        value={pkgDays}
                        onChange={(e) => setPkgDays(e.target.value)}
                        placeholder="Duration Days (e.g. 30, 90, 180, 1825)"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                      />
                      <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                        Starting VIP is locked to <strong>VIP 1</strong> with 0 bonus points. Only price and duration are configurable.
                      </div>
                    </>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-black text-slate-950"
                  >
                    Save Package
                  </button>
                </form>
                <div className="space-y-3 lg:col-span-7 text-xs">
                  <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-3">
                    <div className="mb-2 font-bold text-amber-300">VIP Packages ({vipPkgs.length})</div>
                    {vipPkgs.map((p) => (
                      <div key={String(p.id)} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                        <span>{String(p.name)} (VIP {Number(p.grantedVipLevel)} · {Number(p.durationDays)}d)</span>
                        <span className="font-mono text-emerald-300">₹{Number(p.priceInr)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-3">
                    <div className="mb-2 font-bold text-cyan-300">Coin Packages ({coinPkgs.length})</div>
                    {coinPkgs.map((p) => (
                      <div key={String(p.id)} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                        <span>{String(p.label)} ({Number(p.coins).toLocaleString()} Coins)</span>
                        <span className="font-mono text-amber-300">₹{Number(p.priceInr)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {catalogSubTab === 'tasks' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <form
                    onSubmit={handleSaveTask}
                    className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 lg:col-span-5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold text-white">
                        {taskEditingId ? 'Edit Daily Task' : 'Add Daily / Event Task'}
                      </h3>
                      {taskEditingId && (
                        <button
                          type="button"
                          onClick={resetTaskForm}
                          className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Task Title (e.g. Daily Login)"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={taskSubtitle}
                      onChange={(e) => setTaskSubtitle(e.target.value)}
                      placeholder="Subtitle / Rule description"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="event">Event</option>
                      </select>
                      <select
                        value={taskActionType}
                        onChange={(e) => setTaskActionType(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                      >
                        <option value="checkin">Daily Check-In</option>
                        <option value="send_gift">Send Gift</option>
                        <option value="receive_gift">Receive Gift</option>
                        <option value="play_game">Play Multiplayer Game</option>
                        <option value="voice_time">Join Voice Room</option>
                        <option value="send_message">Send Room Message</option>
                        <option value="post_moment">Post Moment</option>
                        <option value="add_friend">Add Friend</option>
                        <option value="invite_friend">Invite Friend</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400">Target Count</label>
                        <input
                          type="number"
                          min={1}
                          value={taskTargetCount}
                          onChange={(e) => setTaskTargetCount(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400">Reward Coins</label>
                        <input
                          type="number"
                          min={1}
                          value={taskReward}
                          onChange={(e) => setTaskReward(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400">Sort Order</label>
                        <input
                          type="number"
                          value={taskSortOrder}
                          onChange={(e) => setTaskSortOrder(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={taskActive}
                        onChange={(e) => setTaskActive(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span>Task Active (Visible to users)</span>
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400"
                    >
                      {taskEditingId ? 'Update Task' : 'Create Task'}
                    </button>
                  </form>

                  <div className="space-y-2 lg:col-span-7 text-xs">
                    {tasksList.map((t) => {
                      const isActiveTask = t.active !== false;
                      return (
                        <div
                          key={String(t.id)}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0D1526] p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{String(t.title)}</span>
                              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-200 uppercase">
                                {String(t.category || 'daily')}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                  isActiveTask
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {isActiveTask ? 'ACTIVE' : 'PAUSED'}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {String(t.subtitle || '—')} · action: <span className="text-slate-300">{String(t.actionType)}</span> · target: {String(t.targetCount ?? 1)} · order #{String(t.sortOrder ?? 0)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="mr-1 font-mono font-bold text-amber-300">
                              +{Number(t.rewardCoins).toLocaleString()} Coins
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleTaskActive(t)}
                              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/10"
                            >
                              {isActiveTask ? 'Pause' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditTask(t)}
                              aria-label="Edit task"
                              className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 p-1.5 text-cyan-200 hover:bg-cyan-500/25"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(String(t.id))}
                              aria-label="Delete task"
                              className="rounded-lg border border-rose-400/40 bg-rose-500/15 p-1.5 text-rose-200 hover:bg-rose-500/25"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* User Daily Task Progress Control */}
                <div className="rounded-2xl border border-cyan-400/20 bg-[#0D1526] p-4 space-y-3">
                  <h3 className="font-display text-sm font-bold text-white">
                    User Task Progress Control
                  </h3>
                  <form
                    onSubmit={handleAdminUpdateTaskProgress}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                  >
                    <input
                      type="text"
                      required
                      value={progUserId}
                      onChange={(e) => setProgUserId(e.target.value)}
                      placeholder="User Public ID or UID"
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                    <select
                      value={progTaskId}
                      onChange={(e) => setProgTaskId(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    >
                      {tasksList.map((t) => (
                        <option key={String(t.id)} value={String(t.id)}>
                          {String(t.title)} (target {String(t.targetCount ?? 1)})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={progValue}
                      onChange={(e) => setProgValue(e.target.value)}
                      placeholder="Progress"
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                    <label className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={progClaimed}
                        onChange={(e) => setProgClaimed(e.target.checked)}
                      />
                      <span>Claimed</span>
                    </label>
                    <button
                      type="submit"
                      className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-400"
                    >
                      Set Progress
                    </button>
                  </form>

                  {taskProgressList.length > 0 && (
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/35">
                      <table className="w-full text-left text-[11px]">
                        <thead className="border-b border-white/10 text-slate-400">
                          <tr>
                            <th className="px-3 py-2">User</th>
                            <th className="px-3 py-2">Task</th>
                            <th className="px-3 py-2">Progress</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200">
                          {taskProgressList.slice(0, 40).map((row, i) => (
                            <tr key={`${String(row.userUid)}-${String(row.taskId)}-${i}`}>
                              <td className="px-3 py-1.5 font-mono">
                                {String(row.userName || row.userPublicId || row.userUid)} ({String(row.userPublicId || row.userUid)})
                              </td>
                              <td className="px-3 py-1.5">{String(row.taskTitle || row.taskId)}</td>
                              <td className="px-3 py-1.5 font-mono">
                                {Number(row.progress ?? 0)} / {Number(row.targetCount ?? 1)}
                              </td>
                              <td className="px-3 py-1.5">
                                {row.claimed ? (
                                  <span className="text-emerald-300 font-bold">Claimed</span>
                                ) : (
                                  <span className="text-amber-300">Open</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {catalogSubTab === 'backgrounds' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <form
                  onSubmit={handleCreateBg}
                  className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 lg:col-span-5"
                >
                  <h3 className="font-display text-sm font-bold text-white">Add Room Background</h3>
                  <input
                    type="text"
                    required
                    value={bgName}
                    onChange={(e) => setBgName(e.target.value)}
                    placeholder="Theme Name"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={bgGradient}
                    onChange={(e) => setBgGradient(e.target.value)}
                    placeholder="CSS linear-gradient(...)"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-purple-500 py-2.5 text-xs font-black text-white"
                  >
                    Save Background
                  </button>
                </form>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-7 text-xs">
                  {bgsList.map((b) => (
                    <div
                      key={String(b.id)}
                      className="rounded-xl border border-white/10 p-3 font-bold text-white"
                      style={{ background: String(b.gradient) }}
                    >
                      {String(b.name)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {catalogSubTab === 'shop' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <form
                  onSubmit={handleSaveShopItem}
                  className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 lg:col-span-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-white">
                      {shopEditingId ? 'Edit Shop Item' : 'Add Ring / Frame / Gear'}
                    </h3>
                    {shopEditingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setShopEditingId(null);
                          setShopName('');
                          setShopDescription('');
                          setShopImageUrl('');
                        }}
                        className="text-[11px] font-bold text-slate-400 hover:text-white"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Item Name (e.g. Celestial Aurora Frame)"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <select
                    value={shopCategory}
                    onChange={(e) => setShopCategory(e.target.value as ShopCategory)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  >
                    <option value="frame">Profile / Seat Frame</option>
                    <option value="ring">CP Bond Ring</option>
                    <option value="entry">Room Entry Effect</option>
                    <option value="seat-fx">Seat FX</option>
                    <option value="bubble">Chat Bubble</option>
                    <option value="room-theme">Room Theme</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={shopPriceCoins}
                      onChange={(e) => setShopPriceCoins(e.target.value)}
                      placeholder="Price (Coins)"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="number"
                      min={1}
                      value={shopDurationDays}
                      onChange={(e) => setShopDurationDays(e.target.value)}
                      placeholder="Days (blank = Permanent)"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    placeholder="Short Description"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-300">Accent Color</label>
                    <input
                      type="color"
                      value={shopPreviewColor}
                      onChange={(e) => setShopPreviewColor(e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
                    />
                    <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 py-1.5 text-[11px] font-bold text-cyan-200">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          try {
                            flash(true, 'Uploading shop item image...');
                            const uploaded = await uploadImageAsset(f, {
                              authToken,
                              maxDim: 640,
                              quality: 0.86,
                              maxCompressedBytes: 550_000,
                            });
                            setShopImageUrl(uploaded);
                            flash(true, 'Shop item image uploaded cleanly.');
                          } catch (err) {
                            flash(false, err instanceof Error ? err.message : 'Failed to upload shop item image.');
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={shopImageUrl}
                    onChange={(e) => setShopImageUrl(e.target.value)}
                    placeholder="Or paste image URL / data URI"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={shopActive}
                      onChange={(e) => setShopActive(e.target.checked)}
                    />
                    <span>Active in Shop</span>
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 py-2.5 text-xs font-black text-slate-950"
                  >
                    {shopEditingId ? 'Update Shop Item' : 'Publish Shop Item'}
                  </button>
                </form>

                <div className="space-y-2 lg:col-span-7 text-xs">
                  {shopItemsAdminList.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#0D1526] p-3"
                    >
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-10 w-10 rounded-xl border border-white/15 object-contain"
                          />
                        ) : (
                          <div
                            className="h-10 w-10 rounded-xl border border-white/15"
                            style={{ backgroundColor: item.previewColor }}
                          />
                        )}
                        <div>
                          <div className="font-bold text-white">
                            {item.name}{' '}
                            <span className="text-[10px] text-cyan-300 uppercase">[{item.category}]</span>
                          </div>
                          <div className="font-mono text-[11px] text-amber-300">
                            {item.priceCoins.toLocaleString()} Coins ·{' '}
                            {item.durationDays ? `${item.durationDays}d` : 'Permanent'} ·{' '}
                            <span className={item.active === false ? 'text-rose-300' : 'text-emerald-300'}>
                              {item.active === false ? 'Inactive' : 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShopEditingId(item.id);
                            setShopName(item.name);
                            setShopCategory(item.category);
                            setShopPriceCoins(String(item.priceCoins));
                            setShopDurationDays(item.durationDays ? String(item.durationDays) : '');
                            setShopDescription(item.description || '');
                            setShopPreviewColor(item.previewColor || '#22D3EE');
                            setShopImageUrl(item.imageUrl || '');
                            setShopActive(item.active !== false);
                          }}
                          className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleShopItemActive(item)}
                          className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200"
                        >
                          {item.active === false ? 'Activate' : 'Hide'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteShopItem(item)}
                          className="rounded-lg bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {catalogSubTab === 'custom-gifts' && (
              <div className="space-y-3">
                {customGiftsQueue.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 text-center text-xs text-slate-400">
                    No custom gift submissions in the queue.
                  </div>
                ) : (
                  customGiftsQueue.map((cg) => {
                    const gid = String(cg.id);
                    const ov = customGiftOverrides[gid] || {};
                    const statusStr = String(cg.status || 'pending');
                    return (
                      <div
                        key={gid}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0D1526] p-4 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          {cg.animationVideoUrl ? (
                            <video
                              src={String(cg.animationVideoUrl)}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="h-14 w-14 rounded-xl object-cover"
                            />
                          ) : cg.artworkUrl ? (
                            <img
                              src={String(cg.artworkUrl)}
                              alt={String(cg.name)}
                              className="h-14 w-14 rounded-xl object-contain"
                            />
                          ) : (
                            <div
                              className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/15 bg-black/40"
                              style={{ borderColor: String(cg.primaryColor || '#F43F5E') }}
                            >
                              <Crown className="h-6 w-6" style={{ color: String(cg.primaryColor || '#F43F5E') }} />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white">
                              {String(cg.name)}{' '}
                              <span
                                className={`ml-1 rounded-full px-2 py-0.5 text-[10px] uppercase ${
                                  statusStr === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : statusStr === 'rejected'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {statusStr}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Creator: {String(cg.creatorName || cg.creatorUid)} · Cost: {Number(cg.cost).toLocaleString()} Coins · Charm: +{Number(cg.charmValue).toLocaleString()}
                            </div>
                            {Boolean(cg.description) && (
                              <div className="text-[11px] text-slate-300">{String(cg.description)}</div>
                            )}
                          </div>
                        </div>

                        {statusStr === 'pending' && canApprove && (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={ov.cost ?? String(cg.cost)}
                              onChange={(e) =>
                                setCustomGiftOverrides((prev) => ({
                                  ...prev,
                                  [gid]: { ...prev[gid], cost: e.target.value },
                                }))
                              }
                              placeholder="Coins"
                              className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-amber-300"
                            />
                            <input
                              type="number"
                              min={1}
                              value={ov.charmValue ?? String(cg.charmValue)}
                              onChange={(e) =>
                                setCustomGiftOverrides((prev) => ({
                                  ...prev,
                                  [gid]: { ...prev[gid], charmValue: e.target.value },
                                }))
                              }
                              placeholder="Charm"
                              className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-rose-300"
                            />
                            <input
                              type="text"
                              value={ov.reviewNote ?? ''}
                              onChange={(e) =>
                                setCustomGiftOverrides((prev) => ({
                                  ...prev,
                                  [gid]: { ...prev[gid], reviewNote: e.target.value },
                                }))
                              }
                              placeholder="Review note..."
                              className="w-36 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleApproveCustomGift(gid, Number(cg.cost || 100), Number(cg.charmValue || 100))
                              }
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-slate-950"
                            >
                              Approve &amp; Publish
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectCustomGift(gid)}
                              className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-[11px] font-bold text-rose-200"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MODERATION & ANNOUNCEMENTS */}
        {tab === 'moderation' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form
              onSubmit={handlePublishAnnouncement}
              className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-5 lg:col-span-5"
            >
              <h3 className="font-display text-base font-bold text-white">
                Broadcast System Announcement
              </h3>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Announcement Title"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
              />
              <textarea
                rows={3}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Message to broadcast across OG VELOCITY..."
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={annTargetUid}
                onChange={(e) => setAnnTargetUid(e.target.value)}
                placeholder="Optional User ID (e.g. 100001) or leave blank for ALL"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 py-2.5 text-xs font-black text-slate-950"
              >
                Dispatch Announcement
              </button>
            </form>

            <div className="space-y-3 lg:col-span-7">
              <h3 className="font-display text-base font-bold text-white">
                User &amp; Content Reports ({reportsList.length})
              </h3>
              {reportsList.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 text-center text-xs text-slate-400">
                  No moderation reports yet.
                </div>
              ) : (
                reportsList.map((rep) => (
                  <div
                    key={String(rep.id)}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        [{String(rep.targetType)}] {String(rep.targetId)} ·{' '}
                        <span className="text-amber-300 uppercase">{String(rep.status)}</span>
                      </div>
                      <div className="text-slate-300">Reason: {String(rep.reason)}</div>
                      {Boolean(rep.details) && <div className="text-slate-400">{String(rep.details)}</div>}
                    </div>
                    {canModerate && String(rep.status) === 'open' && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleResolveReport(Number(rep.id), 'resolved', rep.targetType === 'post')}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-slate-950"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveReport(Number(rep.id), 'dismissed', false)}
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5B: GRANULAR USER BANS */}
        {tab === 'bans' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleCreateBan}
              className="space-y-3 rounded-2xl border border-rose-400/25 bg-[#0D1526] p-5 text-xs lg:col-span-5"
            >
              <h3 className="font-display text-base font-bold text-white">
                Issue Granular User Ban
              </h3>
              <p className="text-[11px] text-slate-400">
                Restrict a user&apos;s Complete ID, Voice Mic, Voice Room Seats, or Chat messaging for 1–30 days or permanently.
              </p>
              <input
                type="text"
                required
                value={banTargetUid}
                onChange={(e) => setBanTargetUid(e.target.value)}
                placeholder="Target Public ID (e.g. 100002) or UID"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-white"
              />
              <select
                value={banType}
                onChange={(e) => setBanType(e.target.value as 'complete' | 'mic' | 'seat' | 'chat')}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
              >
                <option value="mic">Microphone Ban (Mute across all rooms)</option>
                <option value="seat">Voice Seat Ban (Cannot take seats)</option>
                <option value="chat">Chat Ban (No DM / Room Chat)</option>
                <option value="complete">Complete ID Ban (Full account lock)</option>
              </select>
              <select
                value={banDurationPreset}
                onChange={(e) =>
                  setBanDurationPreset(
                    e.target.value as '1' | '3' | '7' | '30' | 'permanent' | 'custom'
                  )
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
              >
                <option value="1">1 Day</option>
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="permanent">Permanent</option>
                <option value="custom">Custom Days...</option>
              </select>
              {banDurationPreset === 'custom' && (
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={banCustomDays}
                  onChange={(e) => setBanCustomDays(e.target.value)}
                  placeholder="Number of days"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
                />
              )}
              <textarea
                rows={2}
                required
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban (mandatory)..."
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
              />
              <button
                type="submit"
                disabled={!canModerate}
                className="w-full rounded-xl bg-rose-500 py-2.5 font-black text-white hover:bg-rose-400 disabled:opacity-40"
              >
                Apply Ban
              </button>
            </form>

            <div className="space-y-3 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-white">
                  Ban Records ({bansList.length})
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={banSearchUid}
                    onChange={(e) => setBanSearchUid(e.target.value)}
                    placeholder="Filter by UID / ID..."
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-white"
                  />
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input
                      type="checkbox"
                      checked={banActiveOnly}
                      onChange={(e) => setBanActiveOnly(e.target.checked)}
                    />
                    <span>Active Only</span>
                  </label>
                  <button
                    type="button"
                    onClick={loadBans}
                    className="rounded-xl bg-cyan-500/20 px-3 py-1.5 font-bold text-cyan-200"
                  >
                    Filter
                  </button>
                </div>
              </div>

              {bansList.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 text-center text-xs text-slate-400">
                  No ban records matching filter.
                </div>
              ) : (
                bansList.map((b) => {
                  const isActiveBan = Boolean(b.active);
                  return (
                    <div
                      key={String(b.id)}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0D1526] p-4 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span>{String(b.userName || b.userPublicId || b.userUid)}</span>
                          <span className="font-mono text-cyan-300">
                            ({String(b.userPublicId || b.userUid)})
                          </span>
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-black text-rose-300 uppercase">
                            {String(b.banType)}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isActiveBan
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-white/10 text-slate-400'
                            }`}
                          >
                            {isActiveBan ? 'Active' : 'Revoked / Expired'}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-300">Reason: {String(b.reason)}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {b.expiresAt
                            ? `Expires: ${new Date(String(b.expiresAt)).toLocaleString()}`
                            : 'Duration: Permanent'}{' '}
                          · Issued {new Date(String(b.createdAt)).toLocaleDateString()}
                        </div>
                      </div>
                      {isActiveBan && canModerate && (
                        <button
                          type="button"
                          onClick={() => handleRevokeBan(Number(b.id))}
                          className="rounded-xl bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-slate-950"
                        >
                          Revoke Ban
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 6: GRANULAR RBAC PERMISSIONS */}
        {tab === 'permissions' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <form
                onSubmit={handleSavePermissionSet}
                className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-white">
                    Create / Update Permission Set
                  </h3>
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                    Super Admin Only
                  </span>
                </div>
                <input
                  type="text"
                  required
                  disabled={!isSuperAdmin}
                  value={permSetName}
                  onChange={(e) => setPermSetName(e.target.value)}
                  placeholder="Set Name (e.g. Payment Reviewer)"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                />
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={permSetDesc}
                  onChange={(e) => setPermSetDesc(e.target.value)}
                  placeholder="Description"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                />
                <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2.5">
                  {permCatalog.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-[11px] text-slate-200">
                      <input
                        type="checkbox"
                        disabled={!isSuperAdmin}
                        checked={permSetSelected.includes(perm)}
                        onChange={(e) =>
                          setPermSetSelected((prev) =>
                            e.target.checked ? [...prev, perm] : prev.filter((p) => p !== perm)
                          )
                        }
                      />
                      <span className="font-mono">{perm}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!isSuperAdmin}
                  className="w-full rounded-xl bg-purple-500 py-2.5 font-black text-white disabled:opacity-40"
                >
                  Save Permission Set
                </button>
              </form>

              <form
                onSubmit={handleAssignUserPermissions}
                className="space-y-3 rounded-2xl border border-cyan-400/25 bg-[#0D1526] p-5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-white">
                    Assign Staff / User Permissions
                  </h3>
                  <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200 uppercase">
                    Super Admin Only
                  </span>
                </div>
                <input
                  type="text"
                  required
                  disabled={!isSuperAdmin}
                  value={permTargetUid}
                  onChange={(e) => setPermTargetUid(e.target.value)}
                  placeholder="User Public ID (e.g. 100002) or UID"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-white disabled:opacity-50"
                />
                <select
                  disabled={!isSuperAdmin}
                  value={permTargetSetId}
                  onChange={(e) => setPermTargetSetId(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                >
                  <option value="">-- Optional Permission Set --</option>
                  {permSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.permissions.length} perms)
                    </option>
                  ))}
                </select>
                <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2.5">
                  {permCatalog.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-[11px] text-slate-200">
                      <input
                        type="checkbox"
                        disabled={!isSuperAdmin}
                        checked={permTargetCustom.includes(perm)}
                        onChange={(e) =>
                          setPermTargetCustom((prev) =>
                            e.target.checked ? [...prev, perm] : prev.filter((p) => p !== perm)
                          )
                        }
                      />
                      <span className="font-mono">{perm}</span>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    disabled={!isSuperAdmin}
                    value={permTargetExpires}
                    onChange={(e) => setPermTargetExpires(e.target.value)}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                  />
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={permTargetReason}
                    onChange={(e) => setPermTargetReason(e.target.value)}
                    placeholder="Reason for grant"
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!isSuperAdmin}
                  className="w-full rounded-xl bg-cyan-500 py-2.5 font-black text-slate-950 disabled:opacity-40"
                >
                  Apply Custom Permissions
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 text-xs">
              <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-4">
                <h4 className="font-display mb-2 text-sm font-bold text-amber-300">
                  Saved Permission Sets ({permSets.length})
                </h4>
                <div className="space-y-2">
                  {permSets.map((s) => (
                    <div key={s.id} className="rounded-xl bg-black/35 p-3">
                      <div className="font-bold text-white">{s.name}</div>
                      {s.description && <div className="text-[11px] text-slate-400">{s.description}</div>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.permissions.map((p) => (
                          <span key={p} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-4">
                <h4 className="font-display mb-2 text-sm font-bold text-cyan-300">
                  Permission Assignment History ({permHistory.length})
                </h4>
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {permHistory.map((h) => (
                    <div key={String(h.id)} className="rounded-xl bg-black/35 px-3 py-2">
                      <div className="flex justify-between font-bold text-white">
                        <span>Target: {String(h.targetPublicId || h.targetUid)}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(String(h.createdAt)).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        By {String(h.actorPublicId || h.actorUid)} · {String(h.reason || '')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: GLOBAL APP CONFIG & ACTIVE VOICE ROOMS MODERATION */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 text-xs">
            <form
              onSubmit={handleSaveAppConfig}
              className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-5 lg:col-span-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-white">Global App Configuration</h3>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                  Super Admin Only
                </span>
              </div>
              {appConfig && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={appConfig.appName}
                      onChange={(e) => setAppConfig({ ...appConfig, appName: e.target.value })}
                      placeholder="App Name"
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                    />
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={appConfig.tagline}
                      onChange={(e) => setAppConfig({ ...appConfig, tagline: e.target.value })}
                      placeholder="Tagline"
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                    />
                  </div>
                  <label className="flex items-center justify-between rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2">
                    <span className="font-bold text-rose-200">Maintenance Mode</span>
                    <input
                      type="checkbox"
                      disabled={!isSuperAdmin}
                      checked={appConfig.maintenanceMode}
                      onChange={(e) => setAppConfig({ ...appConfig, maintenanceMode: e.target.checked })}
                      className="h-4 w-4 accent-rose-500"
                    />
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={appConfig.maintenanceMessage}
                    onChange={(e) => setAppConfig({ ...appConfig, maintenanceMessage: e.target.value })}
                    placeholder="Maintenance notice message"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                  />
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
                    {(Object.keys(appConfig.features) as Array<keyof AppConfig['features']>).map((fk) => (
                      <label key={fk} className="flex items-center justify-between gap-2 text-[11px] text-slate-200">
                        <span>{fk}</span>
                        <input
                          type="checkbox"
                          disabled={!isSuperAdmin}
                          checked={appConfig.features[fk]}
                          onChange={(e) =>
                            setAppConfig({
                              ...appConfig,
                              features: { ...appConfig.features, [fk]: e.target.checked },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={appConfig.homeBanner.title}
                      onChange={(e) =>
                        setAppConfig({
                          ...appConfig,
                          homeBanner: { ...appConfig.homeBanner, title: e.target.value },
                        })
                      }
                      placeholder="Home Banner Title"
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                    />
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={appConfig.supportInfo.supportEmail}
                      onChange={(e) =>
                        setAppConfig({
                          ...appConfig,
                          supportInfo: { ...appConfig.supportInfo, supportEmail: e.target.value },
                        })
                      }
                      placeholder="Support Email"
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!isSuperAdmin}
                    className="w-full rounded-xl bg-amber-500 py-2.5 font-black text-slate-950 disabled:opacity-40"
                  >
                    Publish Global App Config
                  </button>
                </>
              )}
            </form>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1526] p-5 lg:col-span-6">
              <h3 className="font-display text-base font-bold text-white">
                Voice Rooms Moderation ({adminRooms.length})
              </h3>
              <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {adminRooms.map((rm) => {
                  const roomId = String(rm.id);
                  const currentLv = Number(rm.roomLevel ?? 1);
                  const draftLv = roomLevelDrafts[roomId] ?? String(currentLv);
                  return (
                    <div
                      key={roomId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/35 p-3"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {String(rm.title)}{' '}
                          <span className="font-mono text-[10px] text-cyan-300">#{String(rm.roomCode)}</span>{' '}
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                            Lv.{currentLv}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Owner: {String(rm.ownerUid)} · Status:{' '}
                          <span className={rm.status === 'active' ? 'text-emerald-300 uppercase' : 'text-rose-300 uppercase'}>
                            {String(rm.status)}
                          </span>{' '}
                          · Live: {Number(rm.liveParticipantsCount || 0)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canApprove && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={draftLv}
                              onChange={(e) =>
                                setRoomLevelDrafts((prev) => ({ ...prev, [roomId]: e.target.value }))
                              }
                              aria-label={`Level for ${String(rm.title)}`}
                              className="w-14 rounded-lg border border-white/15 bg-black/50 px-2 py-1 font-mono text-[11px] text-amber-200"
                            />
                            <button
                              type="button"
                              onClick={() => handleSetRoomLevel(roomId, String(rm.title), draftLv)}
                              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-black text-slate-950 hover:bg-amber-400"
                            >
                              Set Lv.
                            </button>
                          </div>
                        )}
                        {canModerate && String(rm.status) === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleAdminCloseRoom(roomId, String(rm.title))}
                            className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-[11px] font-bold text-rose-200 hover:bg-rose-500/35"
                          >
                            Close Room
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: DYNAMIC PAYMENT QR MANAGEMENT, AUDIT TRAIL, ROLES & LOGS */}
        {tab === 'security' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Dynamic Payment QR Config + Live Preview Before Publish (Super Admin ONLY) */}
              <form
                onSubmit={handleUpdateUpiConfig}
                className="space-y-4 rounded-2xl border border-amber-400/25 bg-[#0D1526] p-5 lg:col-span-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      Dynamic Payment QR Management
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Live database-backed payment QR for Coin &amp; VIP Purchase screens. Active pending orders keep their original snapshot.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {upiCurrentVersionNum !== null && (
                      <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
                        Active v{upiCurrentVersionNum}
                      </span>
                    )}
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                      Super Admin Only
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="space-y-2.5 sm:col-span-7">
                    <input
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={upiAccName}
                      onChange={(e) => setUpiAccName(e.target.value)}
                      placeholder="Account Holder Name"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white disabled:opacity-50"
                    />
                    <input
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={upiIdInput}
                      onChange={(e) => setUpiIdInput(e.target.value)}
                      placeholder="Merchant UPI ID (e.g. merchant@bank)"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white disabled:opacity-50"
                    />
                    <input
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={upiProvider}
                      onChange={(e) => setUpiProvider(e.target.value)}
                      placeholder="Payment Provider (e.g. YesPop / PhonePe / GPay)"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white disabled:opacity-50"
                    />
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={upiNote}
                      onChange={(e) => setUpiNote(e.target.value)}
                      placeholder="Checkout Note (shown on payment instructions)"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white disabled:opacity-50"
                    />

                    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                      <span className="font-bold text-white">Payment Method Status</span>
                      <span className="flex items-center gap-2">
                        <span className={upiActive ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>
                          {upiActive ? 'Active' : 'Paused'}
                        </span>
                        <input
                          type="checkbox"
                          disabled={!isSuperAdmin}
                          checked={upiActive}
                          onChange={(e) => setUpiActive(e.target.checked)}
                          className="h-4 w-4 accent-emerald-500"
                        />
                      </span>
                    </label>

                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                      <div className="mb-1.5 text-[11px] font-bold text-slate-300">
                        Enabled Purchase Screens
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { id: 'coins', label: 'Coin Purchase' },
                          { id: 'vip', label: 'VIP Purchase' },
                        ].map((scr) => (
                          <label key={scr.id} className="flex items-center gap-1.5 text-[11px] text-slate-200">
                            <input
                              type="checkbox"
                              disabled={!isSuperAdmin}
                              checked={upiScreens.includes(scr.id)}
                              onChange={(e) =>
                                setUpiScreens((prev) =>
                                  e.target.checked
                                    ? Array.from(new Set([...prev, scr.id]))
                                    : prev.filter((s) => s !== scr.id)
                                )
                              }
                            />
                            <span>{scr.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-amber-400/40 bg-black/30 px-3 py-2 text-xs text-slate-200 hover:bg-black/45">
                          <Upload className="h-4 w-4 text-amber-300" />
                          <span>{upiCustomQr ? 'Replace Uploaded QR Image' : 'Upload New UPI QR Image'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={handleUpiQrUpload}
                            className="hidden"
                          />
                        </label>
                        {upiCustomQr && (
                          <button
                            type="button"
                            onClick={() => {
                              setUpiCustomQr(null);
                              setUpiLiveQrPreview(null);
                            }}
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/10"
                          >
                            Use Auto-QR
                          </button>
                        )}
                      </div>
                    )}

                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={upiChangeSummary}
                      onChange={(e) => setUpiChangeSummary(e.target.value)}
                      placeholder="Audit Change Note (optional)"
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white disabled:opacity-50"
                    />
                  </div>

                  {/* Live Preview Before Publish */}
                  <div className="flex flex-col items-center justify-between rounded-2xl border border-white/10 bg-black/35 p-4 text-center sm:col-span-5">
                    <div className="text-[11px] font-extrabold tracking-wider text-amber-300 uppercase">
                      Preview Before Publishing
                    </div>
                    {upiLiveQrPreview ? (
                      <div className="my-3 rounded-2xl bg-white p-2.5 shadow-lg">
                        <img
                          src={upiLiveQrPreview}
                          alt="Payment QR Preview"
                          className="h-40 w-40 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="my-3 flex h-44 w-44 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/30 p-3 text-[11px] text-slate-400">
                        Auto-generated QR will appear after publishing from UPI ID
                      </div>
                    )}
                    <div className="w-full space-y-1 text-xs">
                      <div className="truncate font-bold text-white">{upiAccName || 'Account Name'}</div>
                      <div className="truncate font-mono text-[11px] text-cyan-300">{upiIdInput || 'UPI ID'}</div>
                      <div className="text-[10px] text-slate-400">
                        {upiProvider || 'Provider'} · {upiActive ? 'Active' : 'Paused'}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isSuperAdmin}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40"
                >
                  Save &amp; Publish Payment Settings
                </button>
              </form>

              {/* RBAC Role Assignment (Super Admin ONLY) */}
              <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0D1526] p-5 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-white">Staff &amp; Admin Roles</h3>
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                    Super Admin Only
                  </span>
                </div>

                {isSuperAdmin && (
                  <form onSubmit={handleAssignRole} className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      required
                      value={roleTargetUid}
                      onChange={(e) => setRoleTargetUid(e.target.value)}
                      placeholder="User ID (e.g. 100001) or UID"
                      className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    />
                    <select
                      value={roleAssignValue}
                      onChange={(e) => setRoleAssignValue(e.target.value as AccountRole)}
                      className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                    >
                      <option value="normal_user">normal_user</option>
                      <option value="support_staff">support_staff</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-xl bg-purple-500 px-4 py-2 text-xs font-black text-white"
                    >
                      Assign
                    </button>
                  </form>
                )}

                <div className="space-y-1.5 text-xs">
                  {rolesAdmins.map((adm) => (
                    <div
                      key={String(adm.userUid)}
                      className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2"
                    >
                      <span>
                        <strong>{String(adm.name || adm.userUid)}</strong> ({String(adm.publicId || '')})
                      </span>
                      <span className="font-mono text-amber-300 uppercase">{String(adm.role)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment QR Audit Trail (Chronological Version History with Preview Links) */}
            <div className="rounded-2xl border border-amber-400/25 bg-[#0D1526] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-white">
                  Audit Trail — Payment QR Update History ({qrVersions.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Chronological record of every QR &amp; UPI configuration change
                </span>
              </div>
              {qrVersions.length === 0 ? (
                <p className="text-xs text-slate-400">No QR update history recorded yet.</p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1 text-xs">
                  {qrVersions.map((ver) => (
                    <div
                      key={ver.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-black text-amber-300">
                            v{ver.versionNumber}
                          </span>
                          <span className="font-bold text-white">
                            {ver.accountName} · <span className="font-mono text-cyan-300">{ver.upiId}</span>
                          </span>
                          <span className="text-[11px] text-slate-400">({ver.provider})</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              ver.active
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {ver.active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Updated by{' '}
                          <strong>{ver.updatedByName || 'Super Admin'}</strong> (
                          {ver.updatedByPublicId || ver.updatedByUid || 'system'}) on{' '}
                          {new Date(ver.createdAt).toLocaleString()}
                        </div>
                        {ver.changeSummary && (
                          <div className="text-[10px] text-slate-400">
                            Summary: {ver.changeSummary} · Screens: {(ver.screens || []).join(', ')}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewQrVersion(ver)}
                        className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/30"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Preview Version</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit Logs */}
            <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-5">
              <h3 className="font-display mb-3 text-base font-bold text-white">
                Immutable Admin Audit Trail
              </h3>
              <div className="max-h-80 space-y-1.5 overflow-y-auto text-xs">
                {auditLogs.map((log) => (
                  <div
                    key={String(log.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2"
                  >
                    <div>
                      <span className="font-mono font-bold text-cyan-300">{String(log.action)}</span>{' '}
                      <span className="text-slate-400">
                        by {String(log.actorUid)} ({String(log.actorRole)}) → {String(log.targetType)}:
                        {String(log.targetId)}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(String(log.createdAt)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Older QR Version Preview Modal */}
      {previewQrVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewQrVersion(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-3xl border border-amber-400/35 bg-[#0D1526] p-5 text-center text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-white">
                QR Audit Version v{previewQrVersion.versionNumber}
              </span>
              <button
                type="button"
                onClick={() => setPreviewQrVersion(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {(previewQrVersion.qrPreviewDataUrl || previewQrVersion.customQrDataUrl) && (
              <div className="mx-auto inline-block rounded-2xl bg-white p-3">
                <img
                  src={previewQrVersion.qrPreviewDataUrl || previewQrVersion.customQrDataUrl || ''}
                  alt={`QR Version ${previewQrVersion.versionNumber}`}
                  className="h-52 w-52 object-contain"
                />
              </div>
            )}
            <div className="space-y-1 text-left rounded-xl bg-black/35 p-3">
              <div className="font-bold text-white">{previewQrVersion.accountName}</div>
              <div className="font-mono text-cyan-300">{previewQrVersion.upiId}</div>
              <div className="text-slate-400">
                Provider: {previewQrVersion.provider} · Screens: {(previewQrVersion.screens || []).join(', ')}
              </div>
              <div className="text-slate-400">
                Updated by {previewQrVersion.updatedByName || 'Super Admin'} on{' '}
                {new Date(previewQrVersion.createdAt).toLocaleString()}
              </div>
              {previewQrVersion.changeSummary && (
                <div className="text-amber-200">{previewQrVersion.changeSummary}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Detailed Inspector & Admin Notes Modal */}
      {inspectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setInspectModal(null)}
        >
          <div
            className="zayro-scroll max-h-[88vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-cyan-400/35 bg-[#0D1526] p-5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  User Inspector · {String(inspectModal.user?.name || 'Player')} (
                  {String(inspectModal.user?.publicId || inspectModal.user?.uid || '')})
                </h3>
                <p className="text-[11px] text-slate-400">
                  {String(inspectModal.user?.email || '')} · Role:{' '}
                  <strong className="text-amber-300 uppercase">{String(inspectModal.user?.role || '')}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setInspectModal(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {inspectModal.banReason && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-rose-200">
                Moderation Reason: {inspectModal.banReason}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-black/35 p-3">
                <div className="text-[10px] text-slate-400 uppercase">Coins</div>
                <div className="font-mono text-sm font-black text-amber-300">
                  {Number(inspectModal.user?.coins ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl bg-black/35 p-3">
                <div className="text-[10px] text-slate-400 uppercase">VIP</div>
                <div className="font-mono text-sm font-black text-purple-300">
                  Lv.{Number(inspectModal.user?.vipLevel ?? 0)} ({String(inspectModal.user?.vipStatus || 'Not Active')})
                </div>
              </div>
              <div className="rounded-xl bg-black/35 p-3">
                <div className="text-[10px] text-slate-400 uppercase">Inventory Items</div>
                <div className="font-mono text-sm font-black text-cyan-300">
                  {inspectModal.inventory.length}
                </div>
              </div>
            </div>

            {inspectModal.effectivePermissions.length > 0 && (
              <div>
                <div className="mb-1 font-bold text-purple-300">Effective RBAC Permissions</div>
                <div className="flex flex-wrap gap-1">
                  {inspectModal.effectivePermissions.map((p) => (
                    <span key={p} className="rounded bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] text-purple-200">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleAddAdminNote} className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="font-bold text-cyan-300">Admin Notes ({inspectModal.adminNotes.length})</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAdminNote}
                  onChange={(e) => setNewAdminNote(e.target.value)}
                  placeholder="Add internal investigation or moderation note..."
                  className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-3.5 py-2 font-black text-slate-950"
                >
                  Save Note
                </button>
              </div>
              <div className="max-h-36 space-y-1.5 overflow-y-auto">
                {inspectModal.adminNotes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-white/5 px-3 py-1.5">
                    <div className="text-white">{n.note}</div>
                    <div className="text-[10px] text-slate-400">
                      {n.authorName} · {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div className="relative max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewScreenshot(null)}
              className="absolute -top-3 -right-3 rounded-full bg-white p-1.5 text-slate-950 shadow-lg"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={previewScreenshot} alt="Payment Proof" className="max-h-[82vh] rounded-2xl" />
          </div>
        </div>
      )}

      {/* Super Admin VIP Status Modal */}
      {vipOverrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSubmitVipOverride}
            className="w-full max-w-sm space-y-3 rounded-2xl border border-purple-400/35 bg-[#0D1526] p-5 text-xs"
          >
            <h3 className="font-display text-base font-bold text-white">
              Super Admin VIP Status · {vipOverrideTarget.publicId}
            </h3>
            <p className="text-[11px] text-slate-400">
              Activate, extend, or revoke VIP membership. Earned VIP level is preserved automatically.
            </p>
            <select
              value={vipOverrideStatus}
              onChange={(e) => setVipOverrideStatus(e.target.value as 'active' | 'inactive')}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Not Active (Revoke)</option>
            </select>
            {vipOverrideStatus === 'active' && (
              <input
                type="number"
                min={1}
                value={vipOverrideDays}
                onChange={(e) => setVipOverrideDays(Number(e.target.value))}
                placeholder="Duration Days"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
              />
            )}
            <input
              type="text"
              value={vipOverrideReason}
              onChange={(e) => setVipOverrideReason(e.target.value)}
              placeholder="Audit Reason"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVipOverrideTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-2 font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-purple-500 py-2 font-black text-white"
              >
                Apply VIP
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Transaction History Modal */}
      {historyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setHistoryModal(null)}
        >
          <div
            className="zayro-scroll max-h-[85vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#0D1526] p-5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-base font-bold text-white">
                Account History · {String(historyModal.user?.publicId || '')}
              </h3>
              <button type="button" onClick={() => setHistoryModal(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <div className="mb-1.5 font-bold text-amber-300">Wallet Ledger</div>
              <div className="space-y-1">
                {historyModal.walletTransactions.map((tx) => (
                  <div key={String(tx.txId)} className="flex justify-between rounded bg-black/30 px-3 py-1.5">
                    <span>{String(tx.description || tx.type)}</span>
                    <span className={Number(tx.amount) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      {Number(tx.amount) >= 0 ? `+${tx.amount}` : String(tx.amount)} (Bal: {String(tx.balanceAfter)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-bold text-cyan-300">Payment Orders</div>
              <div className="space-y-1">
                {historyModal.paymentOrders.map((po) => (
                  <div key={String(po.orderId)} className="flex justify-between rounded bg-black/30 px-3 py-1.5">
                    <span>{String(po.packageName)} ({String(po.utrNumber || 'no UTR')})</span>
                    <span className="font-bold uppercase text-amber-200">{String(po.status)}</span>
                  </div>
                ))}
              </div>
            </div>
            {Array.isArray(historyModal.vipSubscriptionHistory) && historyModal.vipSubscriptionHistory.length > 0 && (
              <div>
                <div className="mb-1.5 font-bold text-amber-300">VIP Subscription History</div>
                <div className="space-y-1">
                  {historyModal.vipSubscriptionHistory.map((sh) => (
                    <div key={String(sh.id)} className="flex justify-between rounded bg-black/30 px-3 py-1.5">
                      <span>{String(sh.packageName || sh.actionType)} · {String(sh.reason || '')}</span>
                      <span className="font-mono text-emerald-300">+{String(sh.daysGranted)}d · VIP {String(sh.vipLevelAssigned)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(historyModal.vipPointLedger) && historyModal.vipPointLedger.length > 0 && (
              <div>
                <div className="mb-1.5 font-bold text-purple-300">VIP Point Ledger</div>
                <div className="space-y-1">
                  {historyModal.vipPointLedger.map((pl) => (
                    <div key={String(pl.id)} className="flex justify-between rounded bg-black/30 px-3 py-1.5">
                      <span>{String(pl.eventType)} · {String(pl.reason)}</span>
                      <span className={Number(pl.deltaPoints) >= 0 ? 'font-mono text-emerald-300' : 'font-mono text-rose-300'}>
                        {Number(pl.deltaPoints) >= 0 ? `+${pl.deltaPoints}` : String(pl.deltaPoints)} (Bal: {String(pl.pointsAfter)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
