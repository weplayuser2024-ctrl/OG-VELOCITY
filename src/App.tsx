import { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, Lock, Sparkles, X } from 'lucide-react';
import { getRedirectResult, onAuthStateChanged, signOut, type Auth, type User } from 'firebase/auth';
import { AdminPanel } from './components/AdminPanel';
import { AuthScreen, mapFirebaseAuthError, type AuthErrorInfo, type VerifiedLoginPayload } from './components/AuthScreen';
import { auth, firebasePersistenceReady, getAllAuthInstances } from './firebase';
import { BottomNav } from './components/BottomNav';
import { ChatSection } from './components/ChatSection';
import { CreateRoomModal } from './components/CreateRoomModal';
import { DiscoverSection } from './components/DiscoverSection';
import { HomeHub } from './components/HomeHub';
import { MeProfileShop, type MeViewMode } from './components/MeProfileShop';
import { UpiPaymentModal, type ActivePaymentOrderPayload } from './components/UpiPaymentModal';
import { UserProfileModal } from './components/UserProfileModal';
import { VoiceRoomStage, type VipEntryShowcase } from './components/VoiceRoomStage';
import {
  COIN_PACKAGES,
  INITIAL_DAILY_TASKS,
  INITIAL_INTIMATE_SPACE,
  INITIAL_ROOM_TASKS,
  ROOM_BACKGROUND_THEMES,
  SHOP_ITEMS,
  USER_PROFILE,
  VIP_PLANS,
  VIRTUAL_GIFTS,
  getAdminSlotCount,
  getCpLevelInfo,
  getRoomNextExp,
  getVipNameColor,
  getVipTierByGrowth,
  setDynamicShopItemsCache,
} from './data/zayroData';
import { AmbientCanvas } from './graphics/AmbientCanvas';
import { GiftArtwork } from './graphics/GiftArtwork';
import { GiftStageCanvas } from './graphics/GiftStageCanvas';
import type {
  AccountRole,
  ActiveGiftEvent,
  AppConfig,
  AuthProvider,
  AvatarConfig,
  BackendEventRecord,
  BackendNotificationRecord,
  BackendOrderRecord,
  BackendWalletTx,
  ChatThread,
  ClosedRoomNotice,
  CpRelationshipHistoryRecord,
  CpRequest,
  CustomGiftSubmission,
  DailyTaskItem,
  EmoteMotion,
  FriendRecord,
  IntimateSpaceData,
  MomentPost,
  NavSection,
  PublicUserProfile,
  ReferralSummary,
  RelationshipTagKey,
  RelationshipTagSummary,
  RoomListener,
  RoomSettingsConfig,
  RoomTaskItem,
  ShopCategory,
  ShopItem,
  SupportRingEvent,
  VipDecayConfig,
  VipPointLedgerRecord,
  VipSubscriptionHistoryRecord,
  VirtualGift,
  VoiceRoom,
  WithdrawalRequestRecord,
} from './types';
import { syncOwnFirestorePresenceAndProfile } from './utils/firestoreSync';
import { ogRealtime } from './utils/realtimeClient';
import { soundFx } from './utils/soundFx';

const ADMIN_ROLES = new Set<AccountRole>(['support_staff', 'moderator', 'admin', 'super_admin']);
const DEFAULT_ROOM_CLOSED_MESSAGE =
  'This room has been closed because the Owner and Admin are no longer present.';

function extractRequestedRoomIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const qRoom = params.get('room')?.trim();
  if (qRoom) return qRoom;
  const pathMatch = window.location.pathname.match(/^\/rooms\/([^/]+)/);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]).trim() || null;
    } catch {
      return pathMatch[1].trim() || null;
    }
  }
  return null;
}

interface BackendRoomSummary {
  id: string;
  roomCode: string;
  title: string;
  topic?: string;
  category: string;
  ownerUid: string;
  hostName: string;
  adminUids?: string[];
  memberUids?: string[];
  isOfficial?: boolean;
  seatCapacity?: number;
  roomLevel?: number;
  roomXp?: number;
  bgThemeId?: string;
  bgUrl?: string | null;
  dpUrl?: string | null;
  isLocked?: boolean;
  roomSettings?: RoomSettingsConfig;
  onlineCount?: number;
  status?: 'active' | 'closed';
  closedReason?: string | null;
}

function mapBackendRoomToVoiceRoom(
  br: BackendRoomSummary,
  currentUid: string,
  existing?: VoiceRoom
): VoiceRoom {
  const capacity =
    br.seatCapacity && [10, 15, 19].includes(br.seatCapacity)
      ? br.seatCapacity
      : br.isOfficial
        ? 19
        : 10;
  const existingSeats =
    existing && existing.seats.length === capacity
      ? existing.seats
      : Array.from({ length: capacity }, (_, i) => ({
          seatIndex: i,
          occupant: null,
          role: 'empty' as const,
          isMuted: false,
          isLocked: false,
          isSpeaking: false,
          audioLevel: 0,
          giftScore: 0,
        }));
  const foundTheme = ROOM_BACKGROUND_THEMES.find((t) => t.id === br.bgThemeId);
  return {
    id: br.id,
    uid: br.roomCode || br.id,
    title: br.title,
    topic: br.topic || 'Live Voice Sanctuary',
    category: (br.category as VoiceRoom['category']) || 'Popular',
    tags: [br.category || 'Voice'],
    hostName: br.hostName,
    ownerUid: br.ownerUid,
    adminUids: Array.isArray(br.adminUids) ? br.adminUids : [],
    memberUids: Array.isArray(br.memberUids) ? br.memberUids : [br.ownerUid],
    dpUrl: br.dpUrl || existing?.dpUrl || undefined,
    isOfficial: Boolean(br.isOfficial),
    isUserCreated: !br.isOfficial && br.ownerUid === currentUid,
    roomType: 'voice',
    level: Number(br.roomLevel ?? 1),
    xp: Number(br.roomXp ?? 0),
    listenerCount:
      br.onlineCount !== undefined && br.onlineCount !== null
        ? Math.max(0, Number(br.onlineCount))
        : (existing?.listenerCount ?? existing?.listeners?.length ?? 0),
    ambiance: foundTheme?.ambiance ?? 'saffron',
    bgThemeId: br.bgThemeId || 'bg-nebula',
    bgUrl: br.bgUrl || undefined,
    isRoomLocked: Boolean(br.isLocked),
    roomSettings: br.roomSettings ?? existing?.roomSettings,
    status: br.status || 'active',
    closedReason: br.closedReason || null,
    seats: existingSeats,
    coinsSpentByUid: existing?.coinsSpentByUid ?? {},
    listeners: existing?.listeners ?? [],
    micRequests: existing?.micRequests ?? [],
    messages: existing?.messages ?? [],
    pkState: existing?.pkState,
  };
}

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRetryNonce, setSessionRetryNonce] = useState<number>(0);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AccountRole>('normal_user');

  const isAuthenticatedRef = useRef<boolean>(false);
  const authenticatedUidRef = useRef<string | null>(null);
  const isLoggingOutRef = useRef<boolean>(false);
  const startupDoneRef = useRef<boolean>(false);
  const inFlightVerifyRef = useRef<{ uid: string; promise: Promise<VerifiedLoginPayload> } | null>(null);
  const pendingRoomLinkRef = useRef<string | null>(extractRequestedRoomIdFromLocation());
  const activeRoomIdRef = useRef<string | null>(null);
  const userSeatIndexRef = useRef<number | null>(null);
  const isMicMutedRef = useRef<boolean>(false);
  const exitingRoomIdRef = useRef<string | null>(null);
  const pendingRoomJoinIdRef = useRef<string | null>(null);
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
  );
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [userProfile, setUserProfile] = useState<AvatarConfig>(() => ({
    ...USER_PROFILE,
    email: '',
  }));

  const [vipStatus, setVipStatus] = useState<'Not Active' | 'Active'>('Not Active');
  const [giftsReceivedCount, setGiftsReceivedCount] = useState<number>(0);
  const [accountStatus, setAccountStatus] = useState<'Active' | 'Suspended'>('Active');

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [hasMoreMessagesByUid, setHasMoreMessagesByUid] = useState<Record<string, boolean>>({});
  const oldestMsgCreatedAtRef = useRef<Record<string, string>>({});
  const [vipPackages, setVipPackages] = useState<
    Array<{ id: string; name: string; priceInr: number; durationDays?: number; coinsIncluded?: number; vipLevel?: number; perks?: string[] }>
  >(() =>
    VIP_PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      priceInr: p.priceInr,
      durationDays: p.durationDays,
      vipLevel: p.grantedVipLevel,
      perks: p.perks,
    }))
  );
  const [coinPackages, setCoinPackages] = useState<
    Array<{ id: string; label: string; coins: number; priceInr: number; highlight?: string }>
  >(() =>
    COIN_PACKAGES.map((c) => ({
      id: c.id,
      label: c.label,
      coins: c.coins + (c.bonusCoins ?? 0),
      priceInr: c.priceInr,
      highlight: c.highlight,
    }))
  );
  const [orders, setOrders] = useState<BackendOrderRecord[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<BackendWalletTx[]>([]);
  const [events, setEvents] = useState<BackendEventRecord[]>([]);
  const [notifications, setNotifications] = useState<BackendNotificationRecord[]>([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<
    Array<{ id: number; requesterUid: string; name: string; publicId: string; photoUrl?: string }>
  >([]);
  const [activePaymentOrder, setActivePaymentOrder] = useState<ActivePaymentOrderPayload | null>(null);
  const [appNotice, setAppNotice] = useState<string | null>(null);

  const authTokenRef = useRef<string | null>(authToken);
  authTokenRef.current = authToken;
  const toastTimeoutRef = useRef<number | null>(null);
  const roomsRefreshTimerRef = useRef<number | null>(null);
  const exitingRoomTimerRef = useRef<number | null>(null);
  const tokenRefreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const showToast = useCallback((msg: string) => {
    setAppNotice(msg);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      toastTimeoutRef.current = null;
      setAppNotice((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  const refreshBackendSessionToken = useCallback(async (): Promise<string | null> => {
    if (tokenRefreshPromiseRef.current) {
      return tokenRefreshPromiseRef.current;
    }
    const task = (async (): Promise<string | null> => {
      try {
        const activeFbUser = getAllAuthInstances().find((inst) => inst.currentUser)?.currentUser ?? null;
        if (!activeFbUser) return null;
        const idToken = await activeFbUser.getIdToken(true);
        const verifyResp = await fetch('/api/auth/verify-firebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
        if (!verifyResp.ok) return null;
        const data = (await verifyResp.json().catch(() => null)) as { ok?: boolean; token?: string } | null;
        if (data?.ok && data.token) {
          authTokenRef.current = data.token;
          setAuthToken(data.token);
          return data.token;
        }
        return null;
      } catch {
        return null;
      } finally {
        tokenRefreshPromiseRef.current = null;
      }
    })();
    tokenRefreshPromiseRef.current = task;
    return task;
  }, []);

  const apiFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers || {});
      const token = authTokenRef.current || authToken;
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const resp = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
      });
      if (resp.status === 401 && !isLoggingOutRef.current) {
        const renewed = await refreshBackendSessionToken();
        if (renewed) {
          const retryHeaders = new Headers(init?.headers || {});
          retryHeaders.set('Authorization', `Bearer ${renewed}`);
          return fetch(url, {
            ...init,
            headers: retryHeaders,
            credentials: 'include',
          });
        }
      }
      return resp;
    },
    [authToken, refreshBackendSessionToken]
  );

  // VIP Growth: starts at 0 for new users (VIP 0 · Not Active)
  const [vipGrowth, setVipGrowth] = useState<number>(0);
  const [subscribedVipLevel, setSubscribedVipLevel] = useState<number>(0);
  const [vipEarnedLevel, setVipEarnedLevel] = useState<number>(0);
  const [vipLabel, setVipLabel] = useState<string | null>(null);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [vipGraceEndsAt, setVipGraceEndsAt] = useState<string | null>(null);
  const [vipNextDecayAt, setVipNextDecayAt] = useState<string | null>(null);
  const [vipInGracePeriod, setVipInGracePeriod] = useState<boolean>(false);
  const [vipGraceDays, setVipGraceDays] = useState<number>(15);
  const [vipDecayConfig, setVipDecayConfig] = useState<VipDecayConfig | null>(null);
  const [vipPointLedger, setVipPointLedger] = useState<VipPointLedgerRecord[]>([]);
  const [vipSubscriptionHistory, setVipSubscriptionHistory] = useState<VipSubscriptionHistoryRecord[]>([]);
  const [cpRelationshipHistory, setCpRelationshipHistory] = useState<CpRelationshipHistoryRecord[]>([]);

  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [closedRoomNotice, setClosedRoomNotice] = useState<ClosedRoomNotice | null>(null);
  const [pendingLockedRoomId, setPendingLockedRoomId] = useState<string | null>(null);
  const [pinEntry, setPinEntry] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [unlockedRoomIds, setUnlockedRoomIds] = useState<string[]>([]);
  const [hasCreatedRoom, setHasCreatedRoom] = useState<boolean>(false);
  const [inspectedUser, setInspectedUser] = useState<PublicUserProfile | null>(null);

  const [coins, setCoins] = useState<number>(0);
  const [dailyLoginClaimed, setDailyLoginClaimed] = useState<boolean>(false);
  const [charm, setCharm] = useState<number>(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);
  const [giftAnimationsEnabled, setGiftAnimationsEnabled] = useState<boolean>(true);
  const [activeGiftEvent, setActiveGiftEvent] = useState<ActiveGiftEvent | null>(null);
  const [bigGiftBanner, setBigGiftBanner] = useState<ActiveGiftEvent | null>(null);
  const [supportRingEvent, setSupportRingEvent] = useState<SupportRingEvent | null>(null);

  // Social, Tasks, Moments, CP Requests, Custom Gifts & Intimate Space
  const [dailyTasks, setDailyTasks] = useState<DailyTaskItem[]>(INITIAL_DAILY_TASKS);
  const [claimedTaskChests, setClaimedTaskChests] = useState<number[]>([]);
  const [roomTasks, setRoomTasks] = useState<RoomTaskItem[]>(INITIAL_ROOM_TASKS);
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [outgoingPendingFriendUids, setOutgoingPendingFriendUids] = useState<string[]>([]);
  const [cpRequests, setCpRequests] = useState<CpRequest[]>([]);
  const [customGifts, setCustomGifts] = useState<CustomGiftSubmission[]>([]);
  const [serverGifts, setServerGifts] = useState<VirtualGift[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>(SHOP_ITEMS);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [userGiftsGivenCoins, setUserGiftsGivenCoins] = useState<number>(0);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [moments, setMoments] = useState<MomentPost[]>([]);
  const [sharedMoments, setSharedMoments] = useState<MomentPost[]>([]);
  const [intimateSpace, setIntimateSpace] = useState<IntimateSpaceData>(INITIAL_INTIMATE_SPACE);
  const [receivedGiftIds, setReceivedGiftIds] = useState<string[]>([]);

  // Me Profile & Shop state (zero items for fresh account; 3-day duration on frames)
  const [meDefaultTab, setMeDefaultTab] = useState<MeViewMode>('profile');
  const [ownedItemExpiries, setOwnedItemExpiries] = useState<Record<string, number>>({});
  const [ownedItemIds, setOwnedItemIds] = useState<string[]>([]);
  const [equippedItems, setEquippedItems] = useState<Partial<Record<ShopCategory, string>>>({});

  const [, setWithdrawals] = useState<WithdrawalRequestRecord[]>([]);
  const [relationshipTags, setRelationshipTags] = useState<RelationshipTagSummary[]>([]);
  const [walletFrozen, setWalletFrozen] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('ogv_theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });
  const [roomVideoSync, setRoomVideoSync] = useState<{
    roomId: string;
    sourceType: 'youtube' | 'local';
    youtubeUrl: string;
    playing: boolean;
    title: string;
    updatedBy?: string;
    ts: number;
  } | null>(null);

  // Live microphone state for Voice Rooms (backed strictly by ogRealtime WebRTC + WebAudio AnalyserNode)
  const [userSeatIndex, setUserSeatIndex] = useState<number | null>(null);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isLiveMicActive, setIsLiveMicActive] = useState<boolean>(false);
  const [vipEntryBanner, setVipEntryBanner] = useState<VipEntryShowcase | null>(null);

  const roomParticipantUidsRef = useRef<string[]>([]);
  const prevSpeakingEmitRef = useRef<boolean>(false);
  const giftTimeoutRef = useRef<number | null>(null);
  const bigGiftTimeoutRef = useRef<number | null>(null);
  const supportTimeoutRef = useRef<number | null>(null);
  const vipEntryTimeoutRef = useRef<number | null>(null);
  const emoteSeatTimeoutRef = useRef<number | null>(null);

  const applyServerUserSnapshot = useCallback(
    (srvUser: {
      uid: string;
      publicId?: string;
      email?: string | null;
      phone?: string | null;
      role?: AccountRole;
      name: string;
      photoUrl?: string | null;
      coverUrl?: string | null;
      handle: string;
      charmPoints?: number;
      vipLevel?: number;
      vipEarnedLevel?: number;
      vipStatus?: 'Not Active' | 'Active';
      vipGrowth?: number;
      vipPlanLabel?: string | null;
      vipExpiresAt?: string | null;
      vipGraceEndsAt?: string | null;
      vipNextDecayAt?: string | null;
      vipInGracePeriod?: boolean;
      vipGraceDays?: number;
      cpPartner?: AvatarConfig['cpPartner'];
      coins?: number;
      giftsReceived?: number;
      accountStatus?: string;
      bio?: string;
      gender?: 'Male' | 'Female' | 'Other';
      age?: number;
      country?: string;
      ornament?: AvatarConfig['ornament'];
      equippedFrameId?: string | null;
      equippedRingId?: string | null;
      equippedEntryId?: string | null;
      equippedEmoteId?: string | null;
      themeMode?: 'dark' | 'light';
      walletFrozen?: boolean;
      relationshipTags?: RelationshipTagSummary[];
    }) => {
      setVerifiedEmail(srvUser.email || srvUser.phone || srvUser.publicId || srvUser.uid);
      if (srvUser.role) {
        setUserRole(srvUser.role);
      }
      if (srvUser.themeMode === 'light' || srvUser.themeMode === 'dark') {
        setThemeMode(srvUser.themeMode);
      }
      if (srvUser.walletFrozen !== undefined) {
        setWalletFrozen(Boolean(srvUser.walletFrozen));
      }
      if (Array.isArray(srvUser.relationshipTags)) {
        setRelationshipTags(srvUser.relationshipTags);
      }
      setUserProfile((prev) => ({
        ...prev,
        uid: srvUser.uid,
        publicId: srvUser.publicId ?? prev.publicId,
        email: srvUser.email ?? '',
        name: srvUser.name || prev.name,
        photoUrl: srvUser.photoUrl ?? prev.photoUrl,
        coverUrl: srvUser.coverUrl ?? prev.coverUrl,
        handle: srvUser.handle || prev.handle,
        bio: srvUser.bio !== undefined ? srvUser.bio : prev.bio,
        gender: srvUser.gender ?? prev.gender,
        age: srvUser.age ?? prev.age,
        country: srvUser.country ?? prev.country,
        ornament: srvUser.ornament ?? prev.ornament,
        themeMode: srvUser.themeMode ?? prev.themeMode,
        equippedEmoteId:
          srvUser.equippedEmoteId !== undefined ? srvUser.equippedEmoteId : prev.equippedEmoteId,
        cpPartner: srvUser.cpPartner !== undefined ? srvUser.cpPartner : prev.cpPartner,
      }));
      setCoins(Number(srvUser.coins ?? 0));
      setCharm(Number(srvUser.charmPoints ?? 0));
      setVipGrowth(Number(srvUser.vipGrowth ?? 0));
      setSubscribedVipLevel(Math.min(18, Number(srvUser.vipLevel ?? 0)));
      if (srvUser.vipEarnedLevel !== undefined) {
        setVipEarnedLevel(Math.min(18, Number(srvUser.vipEarnedLevel ?? 0)));
      }
      setVipStatus(srvUser.vipStatus === 'Active' ? 'Active' : 'Not Active');
      setVipLabel(srvUser.vipPlanLabel ?? null);
      if (srvUser.vipExpiresAt !== undefined) setVipExpiresAt(srvUser.vipExpiresAt ?? null);
      if (srvUser.vipGraceEndsAt !== undefined) setVipGraceEndsAt(srvUser.vipGraceEndsAt ?? null);
      if (srvUser.vipNextDecayAt !== undefined) setVipNextDecayAt(srvUser.vipNextDecayAt ?? null);
      if (srvUser.vipInGracePeriod !== undefined) setVipInGracePeriod(Boolean(srvUser.vipInGracePeriod));
      if (srvUser.vipGraceDays !== undefined) setVipGraceDays(Number(srvUser.vipGraceDays ?? 15));
      setGiftsReceivedCount(Number(srvUser.giftsReceived ?? 0));
      const rawStatus = String(srvUser.accountStatus || 'active').toLowerCase();
      setAccountStatus(rawStatus === 'suspended' || rawStatus === 'banned' ? 'Suspended' : 'Active');

      if (
        srvUser.equippedFrameId !== undefined ||
        srvUser.equippedRingId !== undefined ||
        srvUser.equippedEntryId !== undefined
      ) {
        setEquippedItems((prev) => ({
          ...prev,
          frame: srvUser.equippedFrameId || undefined,
          ring: srvUser.equippedRingId || undefined,
          entry: srvUser.equippedEntryId || undefined,
        }));
      }
    },
    []
  );

  // Sync HTML root classes (Tailwind .dark & .ogv-theme-light) and localStorage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', themeMode === 'dark');
      document.documentElement.classList.toggle('ogv-theme-light', themeMode === 'light');
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ogv_theme_mode', themeMode);
    }
  }, [themeMode]);

  // Sync browser /admin URL history
  useEffect(() => {
    const onPopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openAdminConsole = useCallback(() => {
    if (!ADMIN_ROLES.has(userRole)) return;
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
      window.history.pushState(null, '', '/admin');
    }
    setIsAdminRoute(true);
  }, [userRole]);

  const exitAdminConsole = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      window.history.pushState(null, '', '/');
    }
    setIsAdminRoute(false);
  }, []);

  const applyVerifiedPayloadToApp = useCallback(
    (payload: VerifiedLoginPayload) => {
      if (!payload.token || !payload.uid) return;
      setAuthToken(payload.token);
      authenticatedUidRef.current = payload.uid;
      isAuthenticatedRef.current = true;
      applyServerUserSnapshot({
        uid: payload.uid,
        publicId: payload.publicId,
        role: payload.role,
        email: payload.identifier.includes('@') ? payload.identifier : null,
        phone: payload.identifier.startsWith('+') ? payload.identifier : null,
        name: payload.name,
        photoUrl: payload.photoUrl,
        handle: payload.handle,
        charmPoints: payload.charmPoints,
        vipLevel: payload.vipLevel,
        vipStatus: payload.vipStatus,
        vipGrowth: payload.vipGrowth,
        vipPlanLabel: payload.vipPlanLabel,
        coins: payload.coins,
        giftsReceived: payload.giftsReceived,
        accountStatus: payload.accountStatus,
      });

      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && ADMIN_ROLES.has(payload.role)) {
        setIsAdminRoute(true);
      } else if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        const roomFromPath = window.location.pathname.match(/^\/rooms\/([^/]+)/)?.[1];
        const nextUrl = roomFromPath
          ? `/?room=${encodeURIComponent(roomFromPath)}`
          : `/${window.location.search}`;
        window.history.replaceState(null, '', nextUrl);
        setIsAdminRoute(false);
      }
      setAuthError(null);
      setIsAuthenticated(true);
      setActiveSection('home');
    },
    [applyServerUserSnapshot]
  );

  const verifyFirebaseUserPayload = useCallback(
    async (
      fbUser: User,
      opts?: { forceRefresh?: boolean; preferredProvider?: AuthProvider }
    ): Promise<VerifiedLoginPayload> => {
      if (inFlightVerifyRef.current?.uid === fbUser.uid) {
        return inFlightVerifyRef.current.promise;
      }

      const promise = (async (): Promise<VerifiedLoginPayload> => {
        const idToken = await fbUser.getIdToken(Boolean(opts?.forceRefresh));
        const verifyResp = await fetch('/api/auth/verify-firebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken }),
        });

        const verifyData = (await verifyResp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          token?: string;
          isNewUser?: boolean;
          user?: Parameters<typeof applyServerUserSnapshot>[0] & {
            provider?: AuthProvider;
          };
        };

        if (!verifyResp.ok || !verifyData.ok || !verifyData.token || !verifyData.user) {
          const message =
            verifyData.error || 'Backend verification of your Google session failed. Please try again.';
          console.error('[Auth] Backend verify-firebase rejected:', verifyResp.status, message);
          if (auth) {
            await signOut(auth).catch(() => {});
          }
          setAuthError({
            code: verifyResp.status === 403 ? 'auth/backend-rejected' : 'auth/backend-error',
            message,
          });
          throw new Error(message);
        }

        const srv = verifyData.user;
        const rawStatus = String(srv.accountStatus || 'active').toLowerCase();
        return {
          provider: opts?.preferredProvider || srv.provider || 'google',
          name: srv.name,
          identifier: srv.email || srv.phone || srv.publicId || srv.uid,
          photoUrl: srv.photoUrl || fbUser.photoURL || undefined,
          token: verifyData.token,
          uid: srv.uid,
          publicId: srv.publicId || srv.uid,
          handle: srv.handle,
          role: srv.role || 'normal_user',
          charmPoints: Number(srv.charmPoints ?? 0),
          vipLevel: Number(srv.vipLevel ?? 0),
          vipStatus: srv.vipStatus === 'Active' ? 'Active' : 'Not Active',
          vipGrowth: Number(srv.vipGrowth ?? 0),
          vipPlanLabel: srv.vipPlanLabel ?? null,
          coins: Number(srv.coins ?? 0),
          giftsReceived: Number(srv.giftsReceived ?? 0),
          accountStatus:
            rawStatus === 'banned'
              ? 'Banned'
              : rawStatus === 'suspended'
                ? 'Suspended'
                : 'Active',
          isNewUser: Boolean(verifyData.isNewUser),
        };
      })();

      inFlightVerifyRef.current = { uid: fbUser.uid, promise };
      try {
        return await promise;
      } finally {
        if (inFlightVerifyRef.current?.promise === promise) {
          inFlightVerifyRef.current = null;
        }
      }
    },
    []
  );

  // Capture ?ref=CODE referral code from invite links on first load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const refCode = url.searchParams.get('ref')?.trim().toUpperCase();
      if (refCode) {
        localStorage.setItem('ogv_pending_ref', refCode);
        url.searchParams.delete('ref');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    } catch {
      // Ignore malformed URL
    }
  }, []);

  // Authoritative Firebase persistence + getRedirectResult + onAuthStateChanged + backend session restore
  useEffect(() => {
    let cancelled = false;
    startupDoneRef.current = false;
    setIsCheckingSession(true);
    setSessionError(null);

    const withTimeout = <T,>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
        promise.then(
          (val) => {
            window.clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            window.clearTimeout(timer);
            reject(err);
          }
        );
      });

    const unsubAuth = auth
      ? onAuthStateChanged(auth, async (fbUser) => {
          if (cancelled || !startupDoneRef.current || isLoggingOutRef.current || !fbUser) {
            return;
          }
          if (isAuthenticatedRef.current && authenticatedUidRef.current === fbUser.uid) {
            return;
          }
          try {
            const payload = await verifyFirebaseUserPayload(fbUser, { forceRefresh: false });
            if (!cancelled && !isLoggingOutRef.current && !isAuthenticatedRef.current) {
              applyVerifiedPayloadToApp(payload);
            }
          } catch {
            // Error state and logging handled inside verifyFirebaseUserPayload
          }
        })
      : undefined;

    (async () => {
      try {
        await withTimeout(
          firebasePersistenceReady,
          8000,
          'Firebase persistence initialization timed out'
        ).catch((err) => {
          console.warn('[Auth] Persistence readiness warning:', err instanceof Error ? err.message : err);
        });

        const authCandidates = getAllAuthInstances();
        if (authCandidates.length > 0) {
          // Always process redirect result BEFORE checking backend cookies or rendering Login
          try {
            let redirectUser: User | null = null;
            let redirectProvider: string | null = null;
            for (const candidateAuth of authCandidates) {
              const redirectResult = await withTimeout(
                getRedirectResult(candidateAuth),
                15000,
                'Google redirect verification timed out. Please try again.'
              );
              if (redirectResult?.user) {
                redirectUser = redirectResult.user;
                redirectProvider = redirectResult.providerId || 'google.com';
                break;
              }
            }
            if (!cancelled && redirectUser) {
              console.log(
                '[Auth] Processed Firebase redirect result for provider:',
                redirectProvider || 'google.com'
              );
              const payload = await verifyFirebaseUserPayload(redirectUser, {
                forceRefresh: true,
              });
              if (!cancelled) {
                applyVerifiedPayloadToApp(payload);
                return;
              }
            }
          } catch (redirectErr) {
            const isTimeout =
              redirectErr instanceof Error &&
              redirectErr.message.includes('timed out');
            const mapped = isTimeout
              ? { code: 'auth/redirect-timeout', message: redirectErr.message }
              : mapFirebaseAuthError(redirectErr);
            console.error('[Auth] getRedirectResult error:', mapped.code);
            if (!cancelled) {
              setAuthError(mapped);
              setIsAuthenticated(false);
              isAuthenticatedRef.current = false;
              authenticatedUidRef.current = null;
            }
            return;
          }

          // Wait for Firebase Auth indexedDB/localStorage state to finish hydrating across configured instances
          for (const candidateAuth of authCandidates) {
            const authWithReady = candidateAuth as Auth & { authStateReady?: () => Promise<void> };
            if (typeof authWithReady.authStateReady === 'function') {
              await withTimeout(
                authWithReady.authStateReady(),
                8000,
                'Firebase authStateReady timed out'
              ).catch((err) => {
                console.warn('[Auth] authStateReady warning:', err instanceof Error ? err.message : err);
              });
            }
          }

          const hydratedFbUser =
            auth?.currentUser ||
            authCandidates.find((inst) => inst.currentUser)?.currentUser ||
            null;
          if (!cancelled && hydratedFbUser) {
            try {
              const payload = await verifyFirebaseUserPayload(hydratedFbUser, {
                forceRefresh: false,
              });
              if (!cancelled) {
                applyVerifiedPayloadToApp(payload);
                return;
              }
            } catch {
              if (!cancelled) {
                setIsAuthenticated(false);
                isAuthenticatedRef.current = false;
                authenticatedUidRef.current = null;
              }
              return;
            }
          }
        }

        // Fall back to existing backend HTTP-only session cookie on refresh
        const resp = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            ok?: boolean;
            token?: string | null;
            user?: Parameters<typeof applyServerUserSnapshot>[0];
          };
          if (!cancelled && data.ok && data.user) {
            if (data.token) {
              setAuthToken(data.token);
            }
            authenticatedUidRef.current = data.user.uid;
            isAuthenticatedRef.current = true;
            applyServerUserSnapshot(data.user);
            setAuthError(null);
            setIsAuthenticated(true);
            return;
          }
        }

        if (!cancelled) {
          isAuthenticatedRef.current = false;
          authenticatedUidRef.current = null;
          setIsAuthenticated(false);
          setVerifiedEmail(null);
          setAuthToken(null);
          setUserRole('normal_user');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to verify your session right now.';
        console.error('[Auth] Startup session verification error:', msg);
        if (!cancelled) {
          setSessionError(msg);
          isAuthenticatedRef.current = false;
          authenticatedUidRef.current = null;
          setIsAuthenticated(false);
          setVerifiedEmail(null);
          setAuthToken(null);
        }
      } finally {
        startupDoneRef.current = true;
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubAuth?.();
    };
  }, [applyServerUserSnapshot, applyVerifiedPayloadToApp, verifyFirebaseUserPayload, sessionRetryNonce]);

  const hydrateBackendState = useCallback(async () => {
    try {
      const [
        bootResp,
        walletResp,
        friendsResp,
        momentsResp,
        sharedMomentsResp,
      ] = await Promise.all([
        apiFetch('/api/protected/bootstrap'),
        apiFetch('/api/wallet/state'),
        apiFetch('/api/friends'),
        apiFetch('/api/moments'),
        apiFetch('/api/moments/shared').catch(() => null),
      ]);

      if (bootResp.ok) {
        const boot = (await bootResp.json()) as {
          ok?: boolean;
          appConfig?: AppConfig;
          shopItems?: ShopItem[];
          customGifts?: CustomGiftSubmission[];
          referralSummary?: ReferralSummary;
          gifts?: Array<{
            id: string;
            name: string;
            cost: number;
            charmValue: number;
            randomCoinsMin?: number;
            randomCoinsMax?: number;
            rarity?: string;
            primaryColor?: string;
            secondaryColor?: string;
            description?: string;
            particleStyle?: string;
            giftNumber?: number;
            artworkUrl?: string | null;
            animationUrl?: string | null;
          }>;
          user?: Parameters<typeof applyServerUserSnapshot>[0];
          vipPackages?: Array<{ id: string; name: string; priceInr: number; durationDays?: number; grantedVipLevel?: number; perks?: string[] }>;
          coinPackages?: Array<{ id: string; label: string; coins: number; bonusCoins?: number; priceInr: number; highlight?: string }>;
          vipDecayConfig?: VipDecayConfig;
          vipPointLedger?: VipPointLedgerRecord[];
          vipSubscriptionHistory?: VipSubscriptionHistoryRecord[];
          cpState?: {
            cpPartner?: AvatarConfig['cpPartner'];
            proposals?: CpRequest[];
            history?: CpRelationshipHistoryRecord[];
          };
          tasks?: Array<{
            id: string;
            title: string;
            subtitle?: string | null;
            rewardCoins: number;
            progress?: number;
            targetCount?: number;
            claimed?: boolean;
          }>;
          claimedTaskChests?: number[];
          events?: BackendEventRecord[];
          notifications?: BackendNotificationRecord[];
          orders?: BackendOrderRecord[];
          withdrawals?: WithdrawalRequestRecord[];
          relationshipTags?: RelationshipTagSummary[];
          inventory?: Array<{ itemId: string; expiresAt?: string | null }>;
          rooms?: BackendRoomSummary[];
        };

        if (boot.appConfig) setAppConfig(boot.appConfig);
        if (Array.isArray(boot.shopItems) && boot.shopItems.length > 0) {
          setShopItems(boot.shopItems);
          setDynamicShopItemsCache(boot.shopItems);
        }
        if (Array.isArray(boot.customGifts)) {
          setCustomGifts(boot.customGifts);
        }
        if (Array.isArray(boot.gifts) && boot.gifts.length > 0) {
          setServerGifts(
            boot.gifts.map((g, idx) => ({
              id: String(g.id),
              name: String(g.name),
              cost: Number(g.cost ?? 10),
              charmValue: Number(g.charmValue ?? 10),
              randomCoinsMin: Number(g.randomCoinsMin ?? 5),
              randomCoinsMax: Number(g.randomCoinsMax ?? 15),
              rarity: (['Standard', 'Signature', 'Mythic'].includes(String(g.rarity))
                ? g.rarity
                : 'Standard') as VirtualGift['rarity'],
              primaryColor: String(g.primaryColor || '#A855F7'),
              secondaryColor: String(g.secondaryColor || '#38BDF8'),
              description: String(g.description || ''),
              particleStyle: (g.particleStyle || 'heart') as VirtualGift['particleStyle'],
              giftNumber: Number(g.giftNumber ?? idx + 1),
              customArtworkUrl: g.artworkUrl || undefined,
              customVideoUrl: g.animationUrl || undefined,
              isCustomApproved:
                String(g.id).startsWith('gift-cg-') || Boolean(g.artworkUrl || g.animationUrl),
            }))
          );
        }
        if (boot.referralSummary) {
          setReferralSummary(boot.referralSummary);
        }
        if (boot.user) applyServerUserSnapshot(boot.user);
        if (boot.vipDecayConfig) setVipDecayConfig(boot.vipDecayConfig);
        if (Array.isArray(boot.vipPointLedger)) setVipPointLedger(boot.vipPointLedger);
        if (Array.isArray(boot.vipSubscriptionHistory)) setVipSubscriptionHistory(boot.vipSubscriptionHistory);
        if (Array.isArray(boot.withdrawals)) setWithdrawals(boot.withdrawals);
        if (Array.isArray(boot.relationshipTags)) setRelationshipTags(boot.relationshipTags);
        if (boot.cpState) {
          setUserProfile((prev) => ({ ...prev, cpPartner: boot.cpState!.cpPartner ?? null }));
          if (Array.isArray(boot.cpState.proposals)) setCpRequests(boot.cpState.proposals);
          if (Array.isArray(boot.cpState.history)) setCpRelationshipHistory(boot.cpState.history);
          if (boot.cpState.cpPartner) {
            setIntimateSpace((prev) => ({
              ...prev,
              partnerName: boot.cpState!.cpPartner!.partnerName,
              partnerAvatarId: boot.cpState!.cpPartner!.partnerAvatarId,
              progress: boot.cpState!.cpPartner!.cpCharm ?? 0,
            }));
          } else {
            setIntimateSpace(INITIAL_INTIMATE_SPACE);
          }
        }
        if (Array.isArray(boot.vipPackages) && boot.vipPackages.length > 0) {
          setVipPackages(
            boot.vipPackages.map((p) => ({
              id: p.id,
              name: p.name,
              priceInr: Number(p.priceInr),
              durationDays: Number(p.durationDays ?? 30),
              vipLevel: Number(p.grantedVipLevel ?? 1),
              perks: Array.isArray(p.perks) ? p.perks : [],
            }))
          );
        }
        if (Array.isArray(boot.coinPackages) && boot.coinPackages.length > 0) {
          setCoinPackages(
            boot.coinPackages.map((c) => ({
              id: c.id,
              label: c.label,
              coins: Number(c.coins) + Number(c.bonusCoins ?? 0),
              priceInr: Number(c.priceInr),
              highlight: c.highlight,
            }))
          );
        }
        if (Array.isArray(boot.tasks)) {
          setDailyTasks(
            boot.tasks.map((t) => ({
              id: String(t.id),
              title: String(t.title),
              subtitle: t.subtitle ? String(t.subtitle) : undefined,
              rewardCoins: Number(t.rewardCoins ?? 0),
              progress: Number(t.progress ?? 0),
              target: Number(t.targetCount ?? 1),
              claimed: Boolean(t.claimed),
            }))
          );
          const checkin = boot.tasks.find((t) => t.id === 'task-checkin');
          if (checkin) setDailyLoginClaimed(Boolean(checkin.claimed));
        }
        if (Array.isArray(boot.claimedTaskChests)) {
          setClaimedTaskChests(boot.claimedTaskChests.map(Number));
        }
        if (Array.isArray(boot.events)) setEvents(boot.events);
        if (Array.isArray(boot.notifications)) setNotifications(boot.notifications);
        if (Array.isArray(boot.orders)) setOrders(boot.orders);

        if (Array.isArray(boot.inventory)) {
          const now = Date.now();
          const ids: string[] = [];
          const expiries: Record<string, number> = {};
          for (const row of boot.inventory) {
            if (row.expiresAt) {
              const expMs = new Date(row.expiresAt).getTime();
              if (expMs <= now) continue;
              expiries[row.itemId] = expMs;
            }
            if (!ids.includes(row.itemId)) ids.push(row.itemId);
          }
          setOwnedItemIds(ids);
          setOwnedItemExpiries(expiries);
        }

        if (Array.isArray(boot.rooms)) {
          const currentUid = boot.user?.uid ?? userProfile.uid;
          setHasCreatedRoom(boot.rooms.some((r) => !r.isOfficial && r.ownerUid === currentUid));
          setRooms((prev) =>
            boot.rooms!.map((br) =>
              mapBackendRoomToVoiceRoom(
                br,
                currentUid,
                prev.find((p) => p.id === br.id)
              )
            )
          );
        }
      }

      if (walletResp.ok) {
        const wData = (await walletResp.json()) as { transactions?: BackendWalletTx[] };
        if (Array.isArray(wData.transactions)) {
          setWalletTransactions(wData.transactions);
        }
      }

      if (friendsResp.ok) {
        const fData = (await friendsResp.json()) as {
          relations?: Array<{
            id: number;
            status: string;
            direction: 'incoming' | 'outgoing';
            online?: boolean;
            lastSeenAt?: string | null;
            peer?: {
              uid: string;
              publicId?: string;
              name: string;
              photoUrl?: string | null;
              equippedFrameId?: string | null;
              vipLevel?: number;
            } | null;
          }>;
        };
        if (Array.isArray(fData.relations)) {
          const acceptedFriends: FriendRecord[] = [];
          const outgoingIds: string[] = [];
          const incomingPending: Array<{
            id: number;
            requesterUid: string;
            name: string;
            publicId: string;
            photoUrl?: string;
          }> = [];
          for (const rel of fData.relations) {
            if (!rel.peer) continue;
            if (rel.status === 'accepted') {
              const peerPublicId = rel.peer.publicId || rel.peer.uid;
              acceptedFriends.push({
                uid: peerPublicId,
                publicId: peerPublicId,
                name: rel.peer.name,
                avatarId: peerPublicId,
                photoUrl: rel.peer.photoUrl || undefined,
                equippedFrameId: rel.peer.equippedFrameId ?? null,
                vipLevel: Number(rel.peer.vipLevel ?? 0),
                online: Boolean(rel.online),
                lastSeenAt: rel.lastSeenAt ?? null,
                status: rel.online ? 'Online' : 'Offline',
              });
            } else if (rel.status === 'pending' && rel.direction === 'incoming') {
              incomingPending.push({
                id: rel.id,
                requesterUid: rel.peer.uid,
                name: rel.peer.name,
                publicId: rel.peer.publicId || rel.peer.uid,
                photoUrl: rel.peer.photoUrl || undefined,
              });
            } else if (rel.status === 'pending' && rel.direction === 'outgoing') {
              if (rel.peer.uid) outgoingIds.push(rel.peer.uid);
              if (rel.peer.publicId) outgoingIds.push(rel.peer.publicId);
            }
          }
          setFriends(acceptedFriends);
          setOutgoingPendingFriendUids(Array.from(new Set(outgoingIds)));
          setPendingFriendRequests(incomingPending);
          setChatThreads((prev) => {
            const existingMap = new Map(prev.map((t) => [t.friendUid, t]));
            const nextThreads: ChatThread[] = [];
            for (const fr of acceptedFriends) {
              const cur = existingMap.get(fr.uid);
              if (cur) {
                nextThreads.push({
                  ...cur,
                  friendPublicId: fr.publicId || fr.uid,
                  friendName: fr.name,
                  photoUrl: fr.photoUrl,
                  friendVipLevel: fr.vipLevel,
                  equippedFrameId: fr.equippedFrameId ?? null,
                  online: fr.online,
                  lastSeenAt: fr.lastSeenAt ?? null,
                  status: fr.status,
                });
              } else {
                nextThreads.push({
                  friendUid: fr.uid,
                  friendPublicId: fr.publicId || fr.uid,
                  friendName: fr.name,
                  avatarId: fr.avatarId,
                  photoUrl: fr.photoUrl,
                  friendVipLevel: fr.vipLevel,
                  equippedFrameId: fr.equippedFrameId ?? null,
                  online: fr.online,
                  lastSeenAt: fr.lastSeenAt ?? null,
                  status: fr.status,
                  unread: 0,
                  messages: [],
                });
              }
            }
            return nextThreads;
          });
        }
      }

      if (momentsResp.ok) {
        const mData = (await momentsResp.json()) as {
          posts?: Array<{
            id: string;
            authorUid: string;
            authorName: string;
            mediaType?: string;
            mediaUrl?: string | null;
            caption?: string;
            visibility?: string;
            allowedUids?: string[];
            likesCount?: number;
            likedByMe?: boolean;
            createdAt?: string;
          }>;
        };
        if (Array.isArray(mData.posts)) {
          setMoments(
            mData.posts.map((p) => ({
              id: p.id,
              authorUid: p.authorUid,
              authorName: p.authorName,
              avatarId: p.authorUid || 'member',
              mediaType: p.mediaType === 'video' ? 'video' : 'photo',
              mediaUrl: p.mediaUrl || undefined,
              mediaTitle: `${p.authorName}'s Moment`,
              caption: p.caption || '',
              visibility: p.visibility === 'selected' ? 'selected' : 'public',
              allowedUids: Array.isArray(p.allowedUids) ? p.allowedUids : [],
              mediaGradient:
                p.mediaType === 'video'
                  ? 'linear-gradient(135deg, #4c0519 0%, #7c2d12 45%, #0f172a 100%)'
                  : 'linear-gradient(135deg, #064e3b 0%, #1e3a8a 50%, #090b12 100%)',
              timestamp: p.createdAt ? new Date(p.createdAt).toLocaleString() : 'Recently',
              likes: Number(p.likesCount ?? 0),
              liked: Boolean(p.likedByMe),
            }))
          );
        }
      }

      if (sharedMomentsResp && sharedMomentsResp.ok) {
        const smData = (await sharedMomentsResp.json().catch(() => null)) as {
          posts?: Array<{
            id: string;
            authorUid: string;
            authorName: string;
            mediaType?: string;
            mediaUrl?: string | null;
            caption?: string;
            visibility?: string;
            allowedUids?: string[];
            likesCount?: number;
            likedByMe?: boolean;
            createdAt?: string;
          }>;
        } | null;
        if (Array.isArray(smData?.posts)) {
          setSharedMoments(
            smData.posts.map((p) => ({
              id: p.id,
              authorUid: p.authorUid,
              authorName: p.authorName,
              avatarId: p.authorUid || 'member',
              mediaType: p.mediaType === 'video' ? 'video' : 'photo',
              mediaUrl: p.mediaUrl || undefined,
              mediaTitle: `${p.authorName}'s Moment`,
              caption: p.caption || '',
              visibility: p.visibility === 'selected' ? 'selected' : 'public',
              allowedUids: Array.isArray(p.allowedUids) ? p.allowedUids : [],
              mediaGradient:
                p.mediaType === 'video'
                  ? 'linear-gradient(135deg, #4c0519 0%, #7c2d12 45%, #0f172a 100%)'
                  : 'linear-gradient(135deg, #064e3b 0%, #1e3a8a 50%, #090b12 100%)',
              timestamp: p.createdAt ? new Date(p.createdAt).toLocaleString() : 'Recently',
              likes: Number(p.likesCount ?? 0),
              liked: Boolean(p.likedByMe),
            }))
          );
        }
      }
    } catch {
      // Network retry handled naturally on next action or WS event
    }
  }, [apiFetch, applyServerUserSnapshot, userProfile.uid]);

  useEffect(() => {
    if (isAuthenticated) {
      void hydrateBackendState();
    }
  }, [isAuthenticated, hydrateBackendState]);

  useEffect(() => {
    if (!isAuthenticated || !userProfile.uid) return;
    void syncOwnFirestorePresenceAndProfile({
      publicId: userProfile.publicId || userProfile.uid,
      name: userProfile.name,
      handle: userProfile.handle,
      photoUrl: userProfile.photoUrl ?? null,
      equippedFrameId: equippedItems.frame ?? null,
      vipLevel: vipStatus === 'Active' ? subscribedVipLevel : 0,
      online: true,
      email: userProfile.email ?? null,
    });
  }, [
    isAuthenticated,
    userProfile.uid,
    userProfile.publicId,
    userProfile.name,
    userProfile.handle,
    userProfile.photoUrl,
    userProfile.email,
    equippedItems.frame,
    vipStatus,
    subscribedVipLevel,
  ]);

  // Server determines authoritative active VIP tier (0 when Not Active, >= 1 when Active)
  const effectiveVipLevel = vipStatus === 'Active' ? Math.max(1, Math.min(18, subscribedVipLevel)) : 0;

  const handleClaimReferralCode = useCallback(
    async (rawCode: string): Promise<{ ok: boolean; message: string }> => {
      const inviteCode = rawCode.trim().toUpperCase();
      if (!inviteCode) {
        return { ok: false, message: 'Enter an invite code to claim your reward.' };
      }
      try {
        const resp = await apiFetch('/api/referrals/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          rewardCoins?: number;
          inviterPublicId?: string;
          user?: Parameters<typeof applyServerUserSnapshot>[0];
          referralSummary?: ReferralSummary;
        };
        if (!resp.ok || !data.ok) {
          return { ok: false, message: data.error || 'Could not claim invite code.' };
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ogv_pending_ref');
        }
        if (data.user) applyServerUserSnapshot(data.user);
        if (data.referralSummary) setReferralSummary(data.referralSummary);
        soundFx.playVictory();
        const msg = `Referral linked! +${Number(data.rewardCoins ?? 25000).toLocaleString()} Coins credited.`;
        showToast(msg);
        void hydrateBackendState();
        return { ok: true, message: msg };
      } catch {
        return { ok: false, message: 'Network error claiming invite code.' };
      }
    },
    [apiFetch, applyServerUserSnapshot, hydrateBackendState, showToast]
  );

  useEffect(() => {
    if (!isAuthenticated || !referralSummary || typeof window === 'undefined') return;
    const pendingRef = localStorage.getItem('ogv_pending_ref')?.trim().toUpperCase();
    if (!pendingRef) return;
    if (
      referralSummary.referredByPublicId ||
      pendingRef === referralSummary.inviteCode.toUpperCase() ||
      pendingRef === (userProfile.publicId || '').toUpperCase()
    ) {
      localStorage.removeItem('ogv_pending_ref');
      return;
    }
    void handleClaimReferralCode(pendingRef).then((res) => {
      if (!res.ok) {
        localStorage.removeItem('ogv_pending_ref');
      }
    });
  }, [isAuthenticated, referralSummary, userProfile.publicId, handleClaimReferralCode]);

  const inspectUserProfile = useCallback(
    (profile: PublicUserProfile) => {
      setInspectedUser(profile);
      const lookupId = profile.avatar.publicId || profile.avatar.uid;
      if (!lookupId) return;
      void apiFetch(`/api/users/${encodeURIComponent(lookupId)}/profile`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { ok?: boolean; profile?: PublicUserProfile } | null) => {
          if (d?.ok && d.profile) {
            setInspectedUser(d.profile);
          }
        })
        .catch(() => {});
    },
    [apiFetch]
  );

  const inspectUserById = useCallback(
    (uidOrPublicId: string) => {
      const clean = uidOrPublicId.trim();
      if (!clean) return;
      void apiFetch(`/api/users/${encodeURIComponent(clean)}/profile`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { ok?: boolean; profile?: PublicUserProfile } | null) => {
          if (d?.ok && d.profile) {
            setInspectedUser(d.profile);
          } else {
            showToast('Player profile could not be loaded.');
          }
        })
        .catch(() => showToast('Unable to load user profile.'));
    },
    [apiFetch, showToast]
  );

  const activeRoom = activeRoomId ? (rooms.find((r) => r.id === activeRoomId) ?? null) : null;

  const approvedCustomGifts: VirtualGift[] = customGifts
    .filter((g) => g.status === 'approved')
    .map((g, idx) => ({
      id: g.id,
      name: g.name,
      cost: g.cost,
      charmValue: g.charmValue,
      randomCoinsMin: Math.max(5, Math.round(g.cost * 0.08)),
      randomCoinsMax: Math.max(15, Math.round(g.cost * 0.2)),
      rarity: g.cost >= 1500 ? 'Mythic' : g.cost >= 300 ? 'Signature' : 'Standard',
      primaryColor: g.primaryColor,
      secondaryColor: g.secondaryColor,
      description: g.description,
      particleStyle: g.particleStyle,
      giftNumber: 900 + idx,
      customArtworkUrl: g.artworkUrl,
      customVideoUrl: g.animationVideoUrl,
      isCustomApproved: true,
    }));

  const allGifts: VirtualGift[] =
    serverGifts.length > 0 ? serverGifts : [...VIRTUAL_GIFTS, ...approvedCustomGifts];

  const equippedRingColor = shopItems.find((i) => i.id === equippedItems.ring)?.previewColor;
  const equippedBubbleColor = shopItems.find((i) => i.id === equippedItems.bubble)?.previewColor;
  const equippedFrameId = equippedItems.frame;
  const equippedSeatEffect = shopItems.find((i) => i.id === equippedItems['seat-fx'])?.name;

  const unreadChats = chatThreads.reduce((sum, t) => sum + t.unread, 0);

  const handleToggleSpeaker = () => {
    setSpeakerEnabled((prev) => {
      const next = !prev;
      soundFx.enabled = next;
      ogRealtime.setSpeakerMuted(!next);
      if (next) {
        void ogRealtime.unlockAudioPlayback();
        soundFx.playMove();
      }
      return next;
    });
  };

  // Cleanup microphone stream on unmount
  const stopMicrophone = useCallback(() => {
    roomParticipantUidsRef.current = [];
    prevSpeakingEmitRef.current = false;
    setIsLiveMicActive(false);
    ogRealtime.leaveVoiceAudio();
  }, []);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    userSeatIndexRef.current = userSeatIndex;
  }, [userSeatIndex]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Connect persistent WebSocket hub when authenticated
  useEffect(() => {
    if (!isAuthenticated || !userProfile.uid) {
      ogRealtime.disconnect();
      return;
    }

    ogRealtime.connect(authToken, userProfile.uid);

    const unsubscribe = ogRealtime.subscribe((msg) => {
      const type = String(msg.type || '');

      if (type === 'error') {
        if (msg.message) showToast(String(msg.message));
        return;
      }

      if (type === 'welcome') {
        if (activeRoomIdRef.current) {
          ogRealtime.send({ type: 'room:join', roomId: activeRoomIdRef.current });
        }
        return;
      }

      if (type === 'room:list-updated') {
        if (typeof msg.removedRoomId === 'string' && msg.removedRoomId) {
          const removedId = msg.removedRoomId;
          setRooms((prev) => prev.filter((r) => r.id !== removedId));
        }
        if (roomsRefreshTimerRef.current) {
          window.clearTimeout(roomsRefreshTimerRef.current);
        }
        // Debounce + add jitter (250–900ms) so 500 concurrent clients do not burst /api/rooms simultaneously
        const jitterMs = 250 + Math.floor(Math.random() * 650);
        roomsRefreshTimerRef.current = window.setTimeout(() => {
          roomsRefreshTimerRef.current = null;
          void apiFetch('/api/rooms')
            .then((r) => (r.ok ? r.json() : null))
            .then((d: { ok?: boolean; rooms?: BackendRoomSummary[] } | null) => {
              if (!d?.ok || !Array.isArray(d.rooms)) return;
              const currentUid = authenticatedUidRef.current || '';
              setHasCreatedRoom(d.rooms.some((r) => !r.isOfficial && r.ownerUid === currentUid));
              setRooms((prev) =>
                d.rooms!.map((br) =>
                  mapBackendRoomToVoiceRoom(
                    br,
                    currentUid,
                    prev.find((p) => p.id === br.id)
                  )
                )
              );
            })
            .catch(() => {});
        }, jitterMs);
        return;
      }

      if (type === 'room:host-reconnecting') {
        if (String(msg.roomId || '') === activeRoomIdRef.current) {
          const secs = Math.max(1, Number(msg.graceSeconds ?? 30));
          showToast(`Owner connection interrupted. Waiting ${secs}s for reconnection...`);
        }
        return;
      }

      if (type === 'room:host-reconnected') {
        if (String(msg.roomId || '') === activeRoomIdRef.current) {
          showToast('Host reconnected. Voice room remains active.');
        }
        return;
      }

      if (type === 'room:admins-updated') {
        const roomId = String(msg.roomId || '');
        const nextAdminUids = Array.isArray(msg.adminUids) ? msg.adminUids.map(String) : [];
        setRooms((prev) =>
          prev.map((room) => (room.id === roomId ? { ...room, adminUids: nextAdminUids } : room))
        );
        return;
      }

      if (type === 'room:settings-updated') {
        const roomId = String(msg.roomId || '');
        const updatedRoom = msg.room as BackendRoomSummary | undefined;
        if (roomId && updatedRoom) {
          setRooms((prev) =>
            prev.map((room) =>
              room.id === roomId
                ? mapBackendRoomToVoiceRoom(updatedRoom, authenticatedUidRef.current || '', room)
                : room
            )
          );
        }
        return;
      }

      if (type === 'room:status-changed') {
        const roomId = String(msg.roomId || '');
        const nextStatus = msg.status === 'closed' ? 'closed' : 'active';
        const reason = typeof msg.reason === 'string' ? msg.reason : null;
        setRooms((prev) =>
          prev.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  status: nextStatus,
                  closedReason: reason,
                  seats:
                    nextStatus === 'closed'
                      ? room.seats.map((s) => ({
                          ...s,
                          occupant: null,
                          role: 'empty' as const,
                          isUser: false,
                          isSpeaking: false,
                          audioLevel: 0,
                        }))
                      : room.seats,
                }
              : room
          )
        );
        if (roomId === activeRoomIdRef.current && nextStatus === 'closed') {
          setUserSeatIndex(null);
          ogRealtime.setMicMuted(true);
          setIsLiveMicActive(false);
        }
        return;
      }

      if (type === 'room:action-update') {
        const roomId = String(msg.roomId || '');
        const actionRoom = msg.actionRoom as RoomSettingsConfig['actionRoom'] | undefined;
        if (roomId && actionRoom) {
          setRooms((prev) =>
            prev.map((room) =>
              room.id === roomId
                ? {
                    ...room,
                    roomSettings: { ...(room.roomSettings || {}), actionRoom },
                  }
                : room
            )
          );
        }
        return;
      }

      if (type === 'room:video-sync') {
        const roomId = String(msg.roomId || '');
        if (roomId) {
          setRoomVideoSync({
            roomId,
            sourceType: msg.sourceType === 'local' ? 'local' : 'youtube',
            youtubeUrl: String(msg.youtubeUrl || ''),
            playing: Boolean(msg.playing),
            title: String(msg.title || ''),
            updatedBy: typeof msg.updatedBy === 'string' ? msg.updatedBy : undefined,
            ts: Date.now(),
          });
        }
        return;
      }

      if (type === 'tag:updated') {
        if (Array.isArray(msg.tags)) {
          setRelationshipTags(msg.tags as RelationshipTagSummary[]);
        }
        if (msg.user) {
          applyServerUserSnapshot(msg.user as Parameters<typeof applyServerUserSnapshot>[0]);
        }
        if (msg.fromName) {
          showToast(`${String(msg.fromName)} sent you a Relationship Tag invitation!`);
        }
        return;
      }

      if (type === 'room:closed') {
        const closedId = String(msg.roomId || '');
        const reason =
          typeof msg.reason === 'string' && msg.reason.trim()
            ? msg.reason.trim()
            : DEFAULT_ROOM_CLOSED_MESSAGE;
        setRooms((prev) =>
          prev.map((room) =>
            room.id === closedId
              ? {
                  ...room,
                  status: 'closed',
                  closedReason: reason,
                  seats: room.seats.map((s) => ({
                    ...s,
                    occupant: null,
                    role: 'empty' as const,
                    isUser: false,
                    isSpeaking: false,
                    audioLevel: 0,
                  })),
                }
              : room
          )
        );
        if (activeRoomIdRef.current === closedId) {
          setUserSeatIndex(null);
          ogRealtime.setMicMuted(true);
          setIsLiveMicActive(false);
        }
        return;
      }

      if (
        type === 'wallet:updated' ||
        type === 'payment:approved' ||
        type === 'payment:rejected' ||
        type === 'user:refresh' ||
        type === 'event:updated' ||
        type === 'catalog:updated' ||
        type === 'tasks:updated'
      ) {
        void hydrateBackendState();
        if (type === 'payment:approved') {
          soundFx.playVictory();
          showToast('Payment approved! Coins / VIP have been activated.');
        } else if (type === 'payment:rejected') {
          showToast('Payment order rejected. Check your Order Tracker for details.');
        }
        return;
      }

      if (type === 'app:config-updated' && msg.config) {
        setAppConfig(msg.config as AppConfig);
        return;
      }

      if (type === 'announcement:new' || type === 'notification:new') {
        void apiFetch('/api/notifications')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.notifications) setNotifications(d.notifications);
          })
          .catch(() => {});
        return;
      }

      if (type === 'friend:request') {
        void hydrateBackendState();
        showToast(`${String(msg.from || 'A player')} sent you a friend request!`);
        return;
      }

      if (type === 'friend:accepted') {
        void hydrateBackendState();
        showToast(`${String(msg.byName || 'A player')} accepted your friend request!`);
        return;
      }

      if (type === 'friend:updated' || type === 'tag:updated') {
        void hydrateBackendState();
        return;
      }

      if (type === 'presence:update') {
        const targetUid = String(msg.uid || '');
        const targetPublicId = String(msg.publicId || targetUid);
        const isOnline = Boolean(msg.online);
        const lastSeenAt = typeof msg.lastSeenAt === 'string' ? msg.lastSeenAt : null;
        if (targetUid || targetPublicId) {
          setFriends((prev) =>
            prev.map((fr) =>
              fr.uid === targetUid ||
              fr.uid === targetPublicId ||
              fr.publicId === targetUid ||
              fr.publicId === targetPublicId
                ? {
                    ...fr,
                    online: isOnline,
                    lastSeenAt: lastSeenAt ?? fr.lastSeenAt,
                    status: isOnline ? 'Online' : 'Offline',
                  }
                : fr
            )
          );
          setChatThreads((prev) =>
            prev.map((t) =>
              t.friendUid === targetUid ||
              t.friendUid === targetPublicId ||
              t.friendPublicId === targetUid ||
              t.friendPublicId === targetPublicId
                ? {
                    ...t,
                    online: isOnline,
                    lastSeenAt: lastSeenAt ?? t.lastSeenAt,
                    status: isOnline ? 'Online' : 'Offline',
                  }
                : t
            )
          );
        }
        return;
      }

      if (type === 'cp:proposal') {
        const cpState = msg.cpState as
          | { cpPartner?: AvatarConfig['cpPartner']; proposals?: CpRequest[]; history?: CpRelationshipHistoryRecord[] }
          | undefined;
        if (cpState?.proposals) setCpRequests(cpState.proposals);
        if (cpState?.history) setCpRelationshipHistory(cpState.history);
        showToast(`${String(msg.fromName || 'A player')} sent you a CP Ring proposal (${String(msg.ringName || 'Bond Ring')})!`);
        return;
      }

      if (type === 'cp:updated') {
        const cpState = msg.cpState as
          | { cpPartner?: AvatarConfig['cpPartner']; proposals?: CpRequest[]; history?: CpRelationshipHistoryRecord[] }
          | undefined;
        if (cpState) {
          setUserProfile((prev) => ({ ...prev, cpPartner: cpState.cpPartner ?? null }));
          if (Array.isArray(cpState.proposals)) setCpRequests(cpState.proposals);
          if (Array.isArray(cpState.history)) setCpRelationshipHistory(cpState.history);
        }
        if (msg.user) {
          applyServerUserSnapshot(msg.user as Parameters<typeof applyServerUserSnapshot>[0]);
        }
        void hydrateBackendState();
        if (msg.action === 'accepted') {
          soundFx.playVictory();
          showToast('CP Bond accepted and synced across both profiles!');
        } else if (msg.action === 'broken') {
          showToast('CP relationship has ended.');
        } else if (msg.action === 'rejected') {
          showToast('CP proposal was declined.');
        }
        return;
      }

      if (type === 'dm:message') {
        const raw = msg.message as
          | {
              id?: number | string;
              senderUid?: string;
              recipientUid?: string;
              senderName?: string;
              body?: string;
              imageUrl?: string | null;
              createdAt?: string;
            }
          | undefined;
        if (!raw || !raw.senderUid || !raw.recipientUid) return;
        const isSelf = raw.senderUid === userProfile.uid;
        const peerUid = isSelf ? raw.recipientUid : raw.senderUid;
        const peerName = raw.senderName || 'Player';
        const ts = raw.createdAt
          ? new Date(raw.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Now';

        setChatThreads((prev) => {
          const existing = prev.find((t) => t.friendUid === peerUid);
          const msgObj = {
            id: String(raw.id ?? `dm-${Date.now()}`),
            senderId: raw.senderUid!,
            senderName: isSelf ? userProfile.name : peerName,
            text: String(raw.body || (raw.imageUrl ? '📷 Photo' : '')),
            imageUrl: raw.imageUrl || undefined,
            timestamp: ts,
            isSelf,
            bubbleColor: isSelf ? equippedBubbleColor : undefined,
          };
          if (existing) {
            const already = existing.messages.some((m) => m.id === msgObj.id);
            if (already) return prev;
            return prev.map((t) =>
              t.friendUid === peerUid
                ? {
                    ...t,
                    unread: isSelf ? 0 : t.unread + 1,
                    messages: [...t.messages, msgObj],
                  }
                : t
            );
          }
          return [
            {
              friendUid: peerUid,
              friendName: peerName,
              avatarId: peerUid,
              status: 'Online',
              online: true,
              unread: isSelf ? 0 : 1,
              messages: [msgObj],
            },
            ...prev,
          ];
        });
        return;
      }

      if (
        type === 'room:joined' ||
        type === 'room:roster-updated' ||
        type === 'room:participant-joined' ||
        type === 'room:participant-left'
      ) {
        const roomId = String(msg.roomId || '');
        const participants = (msg.participants as Array<{
          userUid: string;
          publicId?: string;
          name: string;
          photoUrl?: string | null;
          equippedFrameId?: string | null;
          vipLevel: number;
          seatIndex: number | null;
          role: 'owner' | 'admin' | 'speaker' | 'listener';
          isMuted: boolean;
          isSpeaking: boolean;
          relationshipTags?: Array<{ partnerUid: string; tagType: string; level: number }>;
        }>) || [];

        const selfKey = userProfile.publicId || userProfile.uid;
        const myParticipant = participants.find(
          (p) => p.userUid === selfKey || p.userUid === userProfile.uid || p.publicId === selfKey
        );
        const mySeated = myParticipant ? myParticipant.seatIndex !== null : userSeatIndexRef.current !== null;
        if (myParticipant) {
          setUserSeatIndex(myParticipant.seatIndex);
        }

        if (roomId === activeRoomIdRef.current) {
          const allUids = participants.map((p) => p.userUid).filter(Boolean);
          roomParticipantUidsRef.current = allUids;
          void ogRealtime
            .syncRoomPeers(roomId, allUids, {
              seated: mySeated,
              muted: isMicMutedRef.current,
            })
            .then((stream) => {
              setIsLiveMicActive(Boolean(mySeated && stream));
            });
        }

        setRooms((prev) =>
          prev.map((room) => {
            if (room.id !== roomId) return room;
            const seatMap = new Map(participants.filter((p) => p.seatIndex !== null).map((p) => [p.seatIndex!, p]));
            const nextSeats = room.seats.map((seat) => {
              const p = seatMap.get(seat.seatIndex);
              if (!p) {
                return {
                  ...seat,
                  occupant: null,
                  role: 'empty' as const,
                  isUser: false,
                  isSpeaking: false,
                  audioLevel: 0,
                  relationshipTags: [],
                };
              }
              const isSelf =
                p.userUid === userProfile.uid ||
                p.userUid === userProfile.publicId ||
                p.publicId === userProfile.publicId;
              const av: AvatarConfig = isSelf
                ? { ...userProfile, relationshipTags: p.relationshipTags ?? [] }
                : {
                    id: p.userUid,
                    uid: p.userUid,
                    publicId: p.publicId,
                    name: p.name,
                    handle: `@${p.name.toLowerCase().replace(/\s+/g, '')}`,
                    photoUrl: p.photoUrl || undefined,
                    equippedFrameId: p.equippedFrameId ?? null,
                    relationshipTags: p.relationshipTags ?? [],
                    skinTone: '#D69E76',
                    hairColor: '#1E293B',
                    robeColor: '#7C3AED',
                    accentColor: '#38BDF8',
                    ornament: 'crown',
                  };
              return {
                ...seat,
                occupant: av,
                role:
                  p.role === 'owner'
                    ? ('owner' as const)
                    : p.role === 'admin'
                      ? ('admin' as const)
                      : ('speaker' as const),
                isUser: isSelf,
                isMuted: p.isMuted,
                isSpeaking: p.isSpeaking,
                audioLevel: p.isSpeaking && !p.isMuted ? 0.4 : 0,
                vipLevel: Math.min(18, p.vipLevel),
                relationshipTags: p.relationshipTags ?? [],
              };
            });

            const nextListeners: RoomListener[] = participants
              .filter((p) => p.seatIndex === null)
              .map((p) => ({
                uid: p.userUid,
                name: p.name,
                avatarId: p.userUid,
                vipLevel: Math.min(18, p.vipLevel),
                charm: 0,
                isMuted: p.isMuted,
              }));

            const initialMsgs =
              type === 'room:joined' && Array.isArray(msg.messages)
                ? (
                    msg.messages as Array<{
                      id?: string | number;
                      senderUid?: string;
                      senderName?: string;
                      body?: string;
                      imageUrl?: string | null;
                      kind?: string;
                      createdAt?: string;
                    }>
                  ).map((m) => {
                    const matchedName =
                      m.senderName ||
                      participants.find((p) => p.userUid === m.senderUid)?.name ||
                      (m.senderUid === userProfile.uid ? userProfile.name : 'Member');
                    return {
                      id: String(m.id ?? `rm-${Math.random()}`),
                      senderUid: m.senderUid,
                      senderName: matchedName,
                      senderColor: '#38BDF8',
                      text: String(m.body || ''),
                      imageUrl: m.imageUrl || undefined,
                      timestamp: m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Now',
                      kind: (m.kind === 'system' || m.kind === 'gift' || m.kind === 'emote' || m.kind === 'tag'
                        ? m.kind
                        : 'chat') as 'chat' | 'system' | 'gift' | 'emote' | 'tag',
                    };
                  })
                : room.messages;

            const joinedStatus =
              type === 'room:joined' && (msg.roomStatus === 'closed' || msg.roomStatus === 'active')
                ? (msg.roomStatus as 'active' | 'closed')
                : room.status;
            const joinedReason =
              type === 'room:joined' && msg.closedReason !== undefined
                ? (msg.closedReason ? String(msg.closedReason) : null)
                : room.closedReason;

            return {
              ...room,
              status: joinedStatus,
              closedReason: joinedReason,
              listenerCount: Math.max(1, participants.length),
              listeners: nextListeners,
              seats: nextSeats,
              messages: initialMsgs,
            };
          })
        );
        return;
      }

      if (type === 'room:chat') {
        const roomId = String(msg.roomId || '');
        const raw = msg.message as
          | {
              id?: string | number;
              senderUid?: string;
              senderName?: string;
              vipLevel?: number;
              body?: string;
              imageUrl?: string | null;
              kind?: string;
              createdAt?: string;
            }
          | undefined;
        if (!raw || (!raw.body && !raw.imageUrl)) return;
        const msgId = String(raw.id ?? `rc-${Date.now()}`);
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id !== roomId) return r;
            if (r.messages.some((m) => m.id === msgId)) return r;
            return {
              ...r,
              messages: [
                ...r.messages,
                {
                  id: msgId,
                  senderUid: raw.senderUid,
                  senderName: raw.senderName || 'Player',
                  senderColor: getVipNameColor(Math.min(18, Number(raw.vipLevel ?? 0))),
                  text: raw.body || (raw.imageUrl ? '📷 Photo' : ''),
                  imageUrl: raw.imageUrl || undefined,
                  timestamp: raw.createdAt
                    ? new Date(raw.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Now',
                  kind: 'chat' as const,
                },
              ],
            };
          })
        );
        return;
      }

      if (type === 'room:vip-entrance') {
        const vipLvl = Math.min(18, Number(msg.vipLevel ?? 0));
        const fullCinematic = Boolean(msg.fullScreenCinematic) || vipLvl >= 15;
        if (vipEntryTimeoutRef.current) clearTimeout(vipEntryTimeoutRef.current);
        setVipEntryBanner({
          name: String(msg.name || 'VIP Guest'),
          vipLevel: vipLvl,
          effectId: 'entry-golden-flame',
          fullScreenCinematic: fullCinematic,
        });
        vipEntryTimeoutRef.current = window.setTimeout(
          () => setVipEntryBanner(null),
          fullCinematic ? 4800 : 3200
        );
        return;
      }

      if (type === 'room:gift-fx') {
        const giftObj = msg.gift as VirtualGift | undefined;
        if (!giftObj || msg.senderUid === userProfile.uid) return;
        const payload: ActiveGiftEvent = {
          eventId: `ws-gift-${Date.now()}`,
          gift: giftObj,
          senderName: String(msg.senderName || 'Player'),
          recipientName: String(msg.recipientUid || 'Host'),
          charmEarned: Number(msg.charmEarned ?? 0),
          randomCoinsEarned: 0,
          customMessage: typeof msg.customMessage === 'string' ? msg.customMessage : undefined,
          isBigGift: Number(giftObj.cost ?? 0) >= 500,
        };
        if (giftTimeoutRef.current) clearTimeout(giftTimeoutRef.current);
        setActiveGiftEvent(payload);
        giftTimeoutRef.current = window.setTimeout(() => setActiveGiftEvent(null), 3200);
        if (payload.isBigGift) {
          if (bigGiftTimeoutRef.current) clearTimeout(bigGiftTimeoutRef.current);
          setBigGiftBanner(payload);
          bigGiftTimeoutRef.current = window.setTimeout(() => setBigGiftBanner(null), 5500);
        }
        return;
      }

      if (type === 'room:emote') {
        const roomId = String(msg.roomId || '');
        const senderUid = String(msg.userUid || '');
        const senderPublicId = String(msg.publicId || senderUid);
        const emoteNumber = Number(msg.emoteNumber ?? 1);
        const label = String(msg.label || 'Emote');
        const motion = (msg.motion as EmoteMotion) || 'bounce';
        const triggeredAt = Number(msg.triggeredAt ?? Date.now());
        if (!roomId || (!senderUid && !senderPublicId)) return;
        const nextEmote = { emoteNumber, label, motion, triggeredAt };
        setRooms((prev) =>
          prev.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  seats: room.seats.map((seat) => {
                    const occ = seat.occupant;
                    const matches =
                      occ &&
                      (occ.uid === senderUid ||
                        occ.uid === senderPublicId ||
                        occ.publicId === senderUid ||
                        occ.publicId === senderPublicId);
                    return matches ? { ...seat, activeEmote: nextEmote } : seat;
                  }),
                }
              : room
          )
        );
        if (emoteSeatTimeoutRef.current) {
          clearTimeout(emoteSeatTimeoutRef.current);
        }
        emoteSeatTimeoutRef.current = window.setTimeout(() => {
          emoteSeatTimeoutRef.current = null;
          setRooms((prev) =>
            prev.map((room) =>
              room.id === roomId
                ? {
                    ...room,
                    seats: room.seats.map((seat) =>
                      seat.activeEmote?.triggeredAt === triggeredAt
                        ? { ...seat, activeEmote: undefined }
                        : seat
                    ),
                  }
                : room
            )
          );
        }, 3200);
        return;
      }

      if (type === 'room:kicked') {
        const kickedRoomId = String(msg.roomId || '');
        if (kickedRoomId === activeRoomIdRef.current) {
          stopMicrophone();
          setUserSeatIndex(null);
          setActiveRoomId(null);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('room');
            window.history.replaceState(null, '', url.pathname + url.search);
          }
          showToast('You were removed from the voice room.');
        }
      }
    });

    return () => {
      unsubscribe();
      ogRealtime.disconnect();
    };
  }, [
    isAuthenticated,
    authToken,
    userProfile.uid,
    userProfile.name,
    equippedBubbleColor,
    hydrateBackendState,
    apiFetch,
    showToast,
    stopMicrophone,
  ]);

  // Periodically prune expired 3-day frames from client view state
  useEffect(() => {
    const pruneExpired = () => {
      const now = Date.now();
      const expiredIds = Object.entries(ownedItemExpiries)
        .filter(([, exp]) => exp <= now)
        .map(([id]) => id);
      if (expiredIds.length === 0) return;

      setOwnedItemIds((prev) => prev.filter((id) => !expiredIds.includes(id)));
      setOwnedItemExpiries((prev) => {
        const next = { ...prev };
        for (const id of expiredIds) delete next[id];
        return next;
      });
      setEquippedItems((prev) => {
        const next = { ...prev };
        for (const cat of Object.keys(next) as ShopCategory[]) {
          if (next[cat] && expiredIds.includes(next[cat]!)) {
            delete next[cat];
          }
        }
        return next;
      });
    };
    const timer = window.setInterval(pruneExpired, 60_000);
    return () => clearInterval(timer);
  }, [ownedItemExpiries]);



  useEffect(() => {
    return () => {
      stopMicrophone();
      if (giftTimeoutRef.current) clearTimeout(giftTimeoutRef.current);
      if (bigGiftTimeoutRef.current) clearTimeout(bigGiftTimeoutRef.current);
      if (supportTimeoutRef.current) clearTimeout(supportTimeoutRef.current);
      if (vipEntryTimeoutRef.current) clearTimeout(vipEntryTimeoutRef.current);
      if (emoteSeatTimeoutRef.current) clearTimeout(emoteSeatTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (roomsRefreshTimerRef.current) clearTimeout(roomsRefreshTimerRef.current);
      if (exitingRoomTimerRef.current) clearTimeout(exitingRoomTimerRef.current);
    };
  }, [stopMicrophone]);

  // Real-time audio levels from Web Audio AnalyserNode (skips React re-renders when levels haven't changed)
  useEffect(() => {
    if (activeSection !== 'rooms' || !activeRoomId) return;

    const intervalId = window.setInterval(() => {
      const rawMicLevel = userSeatIndex !== null && !isMicMuted ? ogRealtime.getLocalMicLevel() : 0;
      const userMicLevel = Math.round(rawMicLevel * 20) / 20;
      const isUserSpeaking = userSeatIndex !== null && !isMicMuted && userMicLevel > 0.08;
      if (isUserSpeaking !== prevSpeakingEmitRef.current) {
        prevSpeakingEmitRef.current = isUserSpeaking;
        ogRealtime.send({ type: 'room:speaking', isSpeaking: isUserSpeaking });
      }
      const remoteLevels = ogRealtime.getRemoteAudioLevels();

      setRooms((prevRooms) => {
        const targetRoom = prevRooms.find((r) => r.id === activeRoomId);
        if (!targetRoom) return prevRooms;

        let anySeatChanged = false;
        const nextSeats = targetRoom.seats.map((seat) => {
          if (!seat.occupant) return seat;
          if (seat.isUser) {
            const nextLevel = isMicMuted ? 0 : userMicLevel;
            const changed =
              seat.isMuted !== isMicMuted ||
              seat.isSpeaking !== isUserSpeaking ||
              Math.abs((seat.audioLevel ?? 0) - nextLevel) >= 0.04 ||
              seat.vipLevel !== effectiveVipLevel ||
              seat.charmValue !== charm ||
              seat.occupant !== userProfile;
            if (!changed) return seat;
            anySeatChanged = true;
            return {
              ...seat,
              occupant: userProfile,
              isMuted: isMicMuted,
              isSpeaking: isUserSpeaking,
              audioLevel: nextLevel,
              vipLevel: effectiveVipLevel,
              charmValue: charm,
            };
          }
          if (seat.isMuted) {
            if (!seat.isSpeaking && (seat.audioLevel ?? 0) === 0) return seat;
            anySeatChanged = true;
            return { ...seat, isSpeaking: false, audioLevel: 0 };
          }
          const peerKey = seat.occupant.publicId || seat.occupant.uid;
          const rawRemote = remoteLevels[peerKey] ?? remoteLevels[seat.occupant.uid] ?? 0;
          const liveRemoteLevel = Math.round(rawRemote * 20) / 20;
          const speakingNow =
            liveRemoteLevel > 0.08 ||
            (liveRemoteLevel === 0 && seat.isSpeaking && (seat.audioLevel ?? 0) > 0.08);
          const nextRemoteLevel = liveRemoteLevel > 0 ? liveRemoteLevel : speakingNow ? 0.25 : 0;
          if (
            seat.isSpeaking === speakingNow &&
            Math.abs((seat.audioLevel ?? 0) - nextRemoteLevel) < 0.04
          ) {
            return seat;
          }
          anySeatChanged = true;
          return {
            ...seat,
            isSpeaking: speakingNow,
            audioLevel: nextRemoteLevel,
          };
        });

        if (!anySeatChanged) return prevRooms;
        return prevRooms.map((room) =>
          room.id === activeRoomId ? { ...room, seats: nextSeats } : room
        );
      });
    }, 150);

    return () => clearInterval(intervalId);
  }, [activeSection, activeRoomId, userSeatIndex, isMicMuted, userProfile, effectiveVipLevel, charm]);

  // PK Countdown Timer (no-op fast path when no PK is running)
  useEffect(() => {
    const pkTimer = window.setInterval(() => {
      setRooms((prev) => {
        if (!prev.some((r) => r.pkState?.active && r.pkState?.running)) {
          return prev;
        }
        return prev.map((room) => {
          const pk = room.pkState;
          if (!pk || !pk.active || !pk.running) return room;
          if (pk.secondsLeft <= 1) {
            const winner =
              pk.pinkScore > pk.blueScore
                ? 'Pink Team Wins!'
                : pk.blueScore > pk.pinkScore
                  ? 'Blue Team Wins!'
                  : 'PK Ended in a Tie!';
            return {
              ...room,
              pkState: { ...pk, running: false, secondsLeft: 0 },
              messages: [
                ...room.messages,
                {
                  id: `pk-end-${Date.now()}`,
                  senderName: 'PK Referee',
                  senderColor: '#EC4899',
                  text: `${winner} Final Score: Pink ${pk.pinkScore.toLocaleString()} vs Blue ${pk.blueScore.toLocaleString()}`,
                  timestamp: 'Now',
                  kind: 'system' as const,
                },
              ],
            };
          }
          return {
            ...room,
            pkState: { ...pk, secondsLeft: pk.secondsLeft - 1 },
          };
        });
      });
    }, 1000);
    return () => clearInterval(pkTimer);
  }, []);

  const handleVerifyFirebaseUser = useCallback(
    (fbUser: User, preferredProvider?: AuthProvider) =>
      verifyFirebaseUserPayload(fbUser, { forceRefresh: true, preferredProvider }),
    [verifyFirebaseUserPayload]
  );

  const handleLogin = (payload: VerifiedLoginPayload) => {
    if (!payload.token || !payload.uid) {
      return;
    }
    applyVerifiedPayloadToApp(payload);
    soundFx.playVictory();
  };

  const handleLogout = async () => {
    isLoggingOutRef.current = true;
    isAuthenticatedRef.current = false;
    authenticatedUidRef.current = null;
    try {
      await syncOwnFirestorePresenceAndProfile({
        publicId: userProfile.publicId || userProfile.uid,
        name: userProfile.name,
        handle: userProfile.handle,
        photoUrl: userProfile.photoUrl ?? null,
        equippedFrameId: equippedItems.frame ?? null,
        vipLevel: vipStatus === 'Active' ? subscribedVipLevel : 0,
        online: false,
        email: userProfile.email ?? null,
      });
    } catch {
      // Best-effort offline sync
    }
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
    } catch {
      // Ignore network errors during logout cleanup
    }
    try {
      if (auth) await signOut(auth);
    } catch {
      // Ignore Firebase signOut error
    } finally {
      isLoggingOutRef.current = false;
    }
    ogRealtime.disconnect();
    pendingRoomLinkRef.current = null;
    pendingRoomJoinIdRef.current = null;
    exitingRoomIdRef.current = null;
    setClosedRoomNotice(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    setActiveRoomId(null);
    setUserSeatIndex(null);
    setAuthToken(null);
    setVerifiedEmail(null);
    setAuthError(null);
    setUserRole('normal_user');
    setIsAdminRoute(false);
    setCoins(0);
    setCharm(0);
    setVipGrowth(0);
    setSubscribedVipLevel(0);
    setVipStatus('Not Active');
    setVipLabel(null);
    setGiftsReceivedCount(0);
    setOrders([]);
    setWalletTransactions([]);
    setOwnedItemIds([]);
    setOwnedItemExpiries({});
    setEquippedItems({});
    setFriends([]);
    setOutgoingPendingFriendUids([]);
    setPendingFriendRequests([]);
    setChatThreads([]);
    setMoments([]);
    setSharedMoments([]);
    setIsAuthenticated(false);
    setActiveSection('home');
  };

  const handleJoinSeat = async (seatIndex: number) => {
    if (!activeRoomId) return;
    const targetRoom = rooms.find((r) => r.id === activeRoomId);
    if (!targetRoom) return;
    if (targetRoom.status === 'closed') {
      showToast('Room is closed until the Owner or Room Admin enters.');
      return;
    }
    const isRoomOwner = targetRoom.ownerUid === userProfile.uid || targetRoom.ownerUid === userProfile.publicId;
    if (seatIndex === 0 && !isRoomOwner) return;
    if (isRoomOwner && seatIndex !== 0) return;
    const targetSeat = targetRoom.seats.find((s) => s.seatIndex === seatIndex);
    if (!targetSeat || targetSeat.isLocked || targetSeat.occupant) return;

    soundFx.playMove();
    setUserSeatIndex(seatIndex);
    setIsMicMuted(false);
    ogRealtime.send({ type: 'room:seat-take', seatIndex });

    const seatPeerUids = targetRoom.seats
      .map((s) => s.occupant?.publicId || s.occupant?.uid)
      .filter((id): id is string => Boolean(id && id !== userProfile.uid && id !== userProfile.publicId));
    const allPeerUids = Array.from(new Set([...roomParticipantUidsRef.current, ...seatPeerUids]));

    const stream = await ogRealtime.syncRoomPeers(activeRoomId, allPeerUids, {
      seated: true,
      muted: false,
    });
    setIsLiveMicActive(Boolean(stream));

    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== activeRoomId) return room;
        return {
          ...room,
          seats: room.seats.map((seat) => {
            if (seat.isUser) {
              return {
                ...seat,
                occupant: null,
                role: 'empty',
                isUser: false,
                isSpeaking: false,
                audioLevel: 0,
              };
            }
            if (seat.seatIndex === seatIndex && !seat.occupant && !seat.isLocked) {
              return {
                ...seat,
                occupant: userProfile,
                role: seat.seatIndex === 0 ? 'owner' : 'speaker',
                isUser: true,
                isMuted: false,
                isSpeaking: false,
                audioLevel: 0,
                vipLevel: effectiveVipLevel,
                charmValue: charm,
              };
            }
            return seat;
          }),
        };
      })
    );
  };

  const handleLeaveSeat = useCallback(
    (allowOwnerVacate = false) => {
      if (!allowOwnerVacate && activeRoomId) {
        const current = rooms.find((r) => r.id === activeRoomId);
        if (current?.ownerUid === userProfile.uid) return;
      }
      if (!allowOwnerVacate) {
        ogRealtime.send({ type: 'room:seat-leave' });
      }
      stopMicrophone();
      setUserSeatIndex(null);
      if (!activeRoomId) return;
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== activeRoomId) return room;
          return {
            ...room,
            seats: room.seats.map((seat) =>
              seat.isUser
                ? {
                    ...seat,
                    occupant: null,
                    role: 'empty',
                    isUser: false,
                    isSpeaking: false,
                    audioLevel: 0,
                  }
                : seat
            ),
          };
        })
      );
    },
    [activeRoomId, rooms, stopMicrophone, userProfile.uid]
  );

  const setRoomUrlParam = useCallback((roomId: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (roomId) {
      url.searchParams.set('room', roomId);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  const enterRoomDirect = useCallback(
    (roomId: string) => {
      if (activeRoomId && activeRoomId !== roomId) {
        handleLeaveSeat(true);
        ogRealtime.send({ type: 'room:leave' });
        void apiFetch(`/api/rooms/${encodeURIComponent(activeRoomId)}/leave`, { method: 'POST' }).catch(() => {});
      }
      exitingRoomIdRef.current = null;
      pendingRoomJoinIdRef.current = roomId;
      setClosedRoomNotice(null);
      setActiveRoomId(roomId);
      setRoomUrlParam(roomId);
      ogRealtime.send({ type: 'room:join', roomId });
      const targetRoom = rooms.find((r) => r.id === roomId);
      const isOwnerEntering = targetRoom?.ownerUid === userProfile.uid;

      if (isOwnerEntering && targetRoom) {
        setRooms((prev) =>
          prev.map((room) => {
            if (room.id !== roomId) return room;
            return {
              ...room,
              seats: room.seats.map((seat) => {
                if (seat.seatIndex === 0) {
                  return {
                    ...seat,
                    occupant: userProfile,
                    role: 'owner',
                    isUser: true,
                    isLocked: false,
                    isMuted: isMicMuted,
                    isSpeaking: !isMicMuted,
                    audioLevel: isMicMuted ? 0 : 0.45,
                    vipLevel: effectiveVipLevel,
                    charmValue: charm,
                  };
                }
                if (seat.isUser || seat.occupant?.uid === userProfile.uid) {
                  return {
                    ...seat,
                    occupant: null,
                    role: 'empty',
                    isUser: false,
                    isSpeaking: false,
                    audioLevel: 0,
                  };
                }
                return seat;
              }),
            };
          })
        );
        setUserSeatIndex(0);
      } else {
        const existingSeat = targetRoom?.seats.find(
          (s) => s.isUser || s.occupant?.uid === userProfile.uid
        );
        setUserSeatIndex(existingSeat ? existingSeat.seatIndex : null);
      }

      if (speakerEnabled) {
        soundFx.playMove();
      }

      if (vipEntryTimeoutRef.current) clearTimeout(vipEntryTimeoutRef.current);
      const isFullCinematic = effectiveVipLevel >= 15;
      setVipEntryBanner({
        name: userProfile.name,
        vipLevel: effectiveVipLevel,
        effectId: equippedItems.entry || 'entry-golden-flame',
        fullScreenCinematic: isFullCinematic,
      });
      vipEntryTimeoutRef.current = window.setTimeout(() => {
        setVipEntryBanner(null);
      }, isFullCinematic ? 4800 : 3200);
    },
    [
      activeRoomId,
      apiFetch,
      charm,
      effectiveVipLevel,
      equippedItems.entry,
      handleLeaveSeat,
      isMicMuted,
      rooms,
      setRoomUrlParam,
      speakerEnabled,
      userProfile,
    ]
  );

  const openRoomByIdOrLink = useCallback(
    async (roomIdOrCode: string): Promise<boolean> => {
      const cleanId = roomIdOrCode.trim();
      if (!cleanId) return false;
      try {
        const resp = await apiFetch(`/api/rooms/${encodeURIComponent(cleanId)}`);
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          closed?: boolean;
          roomId?: string;
          roomTitle?: string;
          reason?: string;
          error?: string;
          room?: BackendRoomSummary;
        };

        if (!resp.ok || !data.ok || !data.room) {
          setRoomUrlParam(null);
          showToast(data.error || 'Voice room could not be found.');
          setActiveSection('rooms');
          return false;
        }

        const mapped = mapBackendRoomToVoiceRoom(
          data.room,
          userProfile.uid,
          rooms.find((r) => r.id === data.room!.id)
        );
        setRooms((prev) => {
          const exists = prev.some((r) => r.id === mapped.id);
          return exists ? prev.map((r) => (r.id === mapped.id ? mapped : r)) : [mapped, ...prev];
        });

        const isOwnerOrAdmin =
          mapped.ownerUid === userProfile.uid ||
          mapped.ownerUid === userProfile.publicId ||
          mapped.adminUids.includes(userProfile.uid);
        if (
          mapped.isRoomLocked &&
          (mapped.hasPasscode || mapped.roomPasscode) &&
          !isOwnerOrAdmin &&
          !unlockedRoomIds.includes(mapped.id)
        ) {
          setClosedRoomNotice(null);
          setPendingLockedRoomId(mapped.id);
          setPinEntry('');
          setPinError('');
          return false;
        }

        enterRoomDirect(mapped.id);
        setActiveSection('rooms');
        return true;
      } catch {
        showToast('Unable to verify voice room status right now.');
        return false;
      }
    },
    [apiFetch, enterRoomDirect, rooms, setRoomUrlParam, showToast, unlockedRoomIds, userProfile.publicId, userProfile.uid]
  );

  useEffect(() => {
    if (!isAuthenticated || !pendingRoomLinkRef.current) return;
    const requested = pendingRoomLinkRef.current;
    pendingRoomLinkRef.current = null;
    void openRoomByIdOrLink(requested);
  }, [isAuthenticated, openRoomByIdOrLink]);

  const handleSelectRoom = (roomId: string): boolean => {
    const targetRoom = rooms.find((r) => r.id === roomId);
    if (!targetRoom) {
      void openRoomByIdOrLink(roomId);
      return false;
    }
    const isOwnerOrAdmin =
      targetRoom.ownerUid === userProfile.uid ||
      targetRoom.ownerUid === userProfile.publicId ||
      Boolean(targetRoom.adminUids.includes(userProfile.uid));
    if (
      targetRoom.isRoomLocked &&
      (targetRoom.hasPasscode || targetRoom.roomPasscode) &&
      !isOwnerOrAdmin &&
      !unlockedRoomIds.includes(roomId)
    ) {
      setPendingLockedRoomId(roomId);
      setPinEntry('');
      setPinError('');
      return false;
    }
    enterRoomDirect(roomId);
    return true;
  };

  const handleUnlockRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLockedRoomId) return;
    const id = pendingLockedRoomId;
    const targetRoom = rooms.find((r) => r.id === id);
    if (!targetRoom) {
      setPendingLockedRoomId(null);
      return;
    }
    if (targetRoom.roomPasscode && pinEntry === targetRoom.roomPasscode) {
      setUnlockedRoomIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setPendingLockedRoomId(null);
      setPinEntry('');
      setPinError('');
      enterRoomDirect(id);
      setActiveSection('rooms');
      return;
    }
    try {
      const resp = await apiFetch(`/api/rooms/${encodeURIComponent(id)}/verify-passcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: pinEntry }),
      });
      const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        setPinError(data.error || 'Incorrect 4-digit passcode. Please try again.');
        return;
      }
      setUnlockedRoomIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setPendingLockedRoomId(null);
      setPinEntry('');
      setPinError('');
      enterRoomDirect(id);
      setActiveSection('rooms');
    } catch {
      setPinError('Unable to verify room passcode.');
    }
  };

  const handleExitRoom = () => {
    const exitingId = activeRoomId;
    if (exitingId) {
      exitingRoomIdRef.current = exitingId;
      if (exitingRoomTimerRef.current) {
        window.clearTimeout(exitingRoomTimerRef.current);
      }
      exitingRoomTimerRef.current = window.setTimeout(() => {
        exitingRoomTimerRef.current = null;
        if (exitingRoomIdRef.current === exitingId) {
          exitingRoomIdRef.current = null;
        }
      }, 4000);
    }
    handleLeaveSeat(true);
    ogRealtime.send({ type: 'room:leave' });
    if (exitingId) {
      void apiFetch(`/api/rooms/${encodeURIComponent(exitingId)}/leave`, { method: 'POST' })
        .then(() =>
          apiFetch('/api/rooms')
            .then((r) => (r.ok ? r.json() : null))
            .then((d: { ok?: boolean; rooms?: BackendRoomSummary[] } | null) => {
              if (!d?.ok || !Array.isArray(d.rooms)) return;
              const currentUid = authenticatedUidRef.current || '';
              setRooms((prev) =>
                d.rooms!.map((br) =>
                  mapBackendRoomToVoiceRoom(
                    br,
                    currentUid,
                    prev.find((p) => p.id === br.id)
                  )
                )
              );
            })
        )
        .catch(() => {});
      setRooms((prev) =>
        prev.map((room) => (room.id === exitingId ? { ...room, messages: [] } : room))
      );
    }
    pendingRoomJoinIdRef.current = null;
    setRoomUrlParam(null);
    setClosedRoomNotice(null);
    setActiveRoomId(null);
    setVipEntryBanner(null);
    soundFx.playMove();
  };

  const handleDismissClosedRoomNotice = () => {
    setClosedRoomNotice(null);
    setRoomUrlParam(null);
    void hydrateBackendState();
  };

  const handleReopenRoom = async (roomId: string) => {
    try {
      const resp = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/reopen`, {
        method: 'POST',
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        showToast(data.error || 'Could not reopen voice room.');
        return;
      }
      setClosedRoomNotice(null);
      await hydrateBackendState();
      enterRoomDirect(roomId);
      setActiveSection('rooms');
      soundFx.playVictory();
    } catch {
      showToast('Network error reopening voice room.');
    }
  };

  const handleToggleRoomMember = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId) return room;
        const alreadyMember = room.memberUids.includes(userProfile.uid);
        return {
          ...room,
          memberUids: alreadyMember
            ? room.memberUids.filter((id) => id !== userProfile.uid)
            : [...room.memberUids, userProfile.uid],
        };
      })
    );
    soundFx.playVictory();
  };

  const handleUpdateRoomSettings = (
    roomId: string,
    updates: {
      title?: string;
      category?: VoiceRoom['category'];
      dpUrl?: string;
      bgThemeId?: string;
      bgUrl?: string;
      isRoomLocked?: boolean;
      roomPasscode?: string;
      roomSettings?: Partial<RoomSettingsConfig>;
    }
  ) => {
    const foundTheme = updates.bgThemeId
      ? ROOM_BACKGROUND_THEMES.find((t) => t.id === updates.bgThemeId)
      : undefined;
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId) return room;
        const canEdit = room.isOfficial
          ? ADMIN_ROLES.has(userRole)
          : room.ownerUid === userProfile.uid || room.adminUids.includes(userProfile.uid);
        if (!canEdit) return room;
        const mergedSettings: RoomSettingsConfig | undefined = updates.roomSettings
          ? { ...(room.roomSettings || {}), ...updates.roomSettings }
          : room.roomSettings;
        return {
          ...room,
          title: updates.title ?? room.title,
          category: updates.category ?? room.category,
          tags: updates.category ? [updates.category] : room.tags,
          dpUrl: updates.dpUrl !== undefined ? updates.dpUrl : room.dpUrl,
          bgThemeId: updates.bgThemeId ?? room.bgThemeId,
          bgUrl: updates.bgUrl !== undefined ? updates.bgUrl || undefined : room.bgUrl,
          ambiance: foundTheme?.ambiance ?? room.ambiance,
          isRoomLocked:
            updates.isRoomLocked !== undefined ? updates.isRoomLocked : room.isRoomLocked,
          roomPasscode:
            updates.roomPasscode !== undefined ? updates.roomPasscode : room.roomPasscode,
          roomSettings: mergedSettings,
        };
      })
    );
    void apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
      .then(async (r) => {
        if (!r.ok) return;
        const payload = (await r.json()) as { room?: BackendRoomSummary };
        if (payload?.room) {
          setRooms((prev) =>
            prev.map((rm) =>
              rm.id === roomId ? mapBackendRoomToVoiceRoom(payload.room!, userProfile.uid, rm) : rm
            )
          );
        }
      })
      .catch(() => {});
    soundFx.playMove();
  };

  const handleToggleAdmin = (roomId: string, targetUid: string, targetName: string) => {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const targetRoom = rooms.find((r) => r.id === roomId);
    if (!targetRoom || targetRoom.ownerUid !== userProfile.uid || targetUid === targetRoom.ownerUid) {
      return;
    }
    const isCurrentlyAdmin = targetRoom.adminUids.includes(targetUid);
    const maxAdmins = getAdminSlotCount(targetRoom.level);
    if (!isCurrentlyAdmin && targetRoom.adminUids.length >= maxAdmins) {
      showToast(`Maximum ${maxAdmins} Admin slots reached.`);
      return;
    }

    void (async () => {
      try {
        const resp = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/admins/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUid }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          adminUids?: string[];
          isAdmin?: boolean;
          error?: string;
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Could not update Room Admin.');
          return;
        }
        const nextAdminUids = Array.isArray(data.adminUids)
          ? data.adminUids
          : isCurrentlyAdmin
            ? targetRoom.adminUids.filter((id) => id !== targetUid)
            : [...targetRoom.adminUids, targetUid];
        const granted = Boolean(data.isAdmin);
        setRooms((prev) =>
          prev.map((room) => {
            if (room.id !== roomId) return room;
            return {
              ...room,
              adminUids: nextAdminUids,
              seats: room.seats.map((seat) =>
                seat.occupant?.uid === targetUid
                  ? { ...seat, role: granted ? 'admin' : 'speaker' }
                  : seat
              ),
              messages: [
                ...room.messages,
                {
                  id: `sys-adm-${Date.now()}`,
                  senderName: 'System',
                  senderColor: '#38BDF8',
                  text: granted
                    ? `${targetName} was appointed as Room Admin.`
                    : `${targetName} was removed from Room Admin.`,
                  timestamp,
                  kind: 'system',
                },
              ],
            };
          })
        );
        soundFx.playVictory();
      } catch {
        showToast('Network error updating Room Admin.');
      }
    })();
  };

  const handleKickUser = (roomId: string, targetUid: string, targetName: string) => {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (targetUid === userProfile.uid) {
      stopMicrophone();
      setUserSeatIndex(null);
    }
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId) return room;
        const canMod =
          room.ownerUid === userProfile.uid || room.adminUids.includes(userProfile.uid);
        if (!canMod || targetUid === room.ownerUid) return room;

        return {
          ...room,
          listenerCount: Math.max(1, room.listenerCount - 1),
          listeners: room.listeners.filter((l) => l.uid !== targetUid),
          seats: room.seats.map((seat) =>
            seat.occupant?.uid === targetUid
              ? {
                  ...seat,
                  occupant: null,
                  role: 'empty',
                  isUser: false,
                  isMuted: false,
                  isSpeaking: false,
                  audioLevel: 0,
                }
              : seat
          ),
          messages: [
            ...room.messages,
            {
              id: `sys-kick-${Date.now()}`,
              senderName: 'System',
              senderColor: '#FB7185',
              text: `${targetName} (${targetUid}) was removed from the stage.`,
              timestamp,
              kind: 'system',
            },
          ],
        };
      })
    );
    soundFx.playMove();
  };

  const handleLiftUserToSeat = (roomId: string, listener: RoomListener) => {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let selfSeatedIndex: number | null = null;

    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId) return room;
        const canMod =
          room.ownerUid === userProfile.uid || room.adminUids.includes(userProfile.uid);
        if (!canMod) return room;

        const bottomStart = room.isOfficial ? 3 : 2;
        const openSeat =
          room.seats.find((s) => s.seatIndex >= bottomStart && !s.occupant && !s.isLocked) ??
          room.seats.find((s) => !s.occupant && !s.isLocked);
        if (!openSeat) return room;

        const isSelf = listener.uid === userProfile.uid;
        if (isSelf) {
          selfSeatedIndex = openSeat.seatIndex;
        }

        const matchedAvatar: AvatarConfig = isSelf
          ? userProfile
          : {
              id: listener.avatarId || listener.uid,
              uid: listener.uid,
              name: listener.name,
              handle: `@${listener.name.toLowerCase().replace(/\s+/g, '')}`,
              skinTone: '#D69E76',
              hairColor: '#1E293B',
              robeColor: '#10B981',
              accentColor: '#6EE7B7',
              ornament: 'lotus',
            };

        return {
          ...room,
          listeners: room.listeners.filter((l) => l.uid !== listener.uid),
          seats: room.seats.map((seat) =>
            seat.seatIndex === openSeat.seatIndex
              ? {
                  ...seat,
                  occupant: matchedAvatar,
                  role: room.adminUids.includes(listener.uid) ? 'admin' : 'speaker',
                  isUser: isSelf,
                  isMuted: false,
                  isSpeaking: true,
                  audioLevel: 0.4,
                  vipLevel: isSelf ? effectiveVipLevel : listener.vipLevel,
                  charmValue: isSelf ? charm : listener.charm,
                }
              : seat
          ),
          messages: [
            ...room.messages,
            {
              id: `sys-lift-${Date.now()}`,
              senderName: 'System',
              senderColor: '#34D399',
              text: `${listener.name} was lifted to Seat ${openSeat.seatIndex + 1}.`,
              timestamp,
              kind: 'system',
            },
          ],
        };
      })
    );

    if (selfSeatedIndex !== null) {
      setUserSeatIndex(selfSeatedIndex);
      setIsMicMuted(false);
    }
    soundFx.playVictory();
  };

  const handleToggleMuteByUid = (roomId: string, targetUid: string) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId) return room;
        return {
          ...room,
          seats: room.seats.map((seat) => {
            if (seat.occupant?.uid !== targetUid) return seat;
            if (seat.isUser) {
              setIsMicMuted(!seat.isMuted);
            }
            return { ...seat, isMuted: !seat.isMuted };
          }),
          listeners: room.listeners.map((lis) =>
            lis.uid === targetUid ? { ...lis, isMuted: !lis.isMuted } : lis
          ),
        };
      })
    );
    soundFx.playMove();
  };

  const handleToggleLockSeat = (seatIndex: number) => {
    if (!activeRoomId || seatIndex === 0) return;
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== activeRoomId) return room;
        return {
          ...room,
          seats: room.seats.map((seat) => {
            if (seat.seatIndex !== seatIndex) return seat;
            if (seat.occupant) {
              if (seat.isUser) {
                setUserSeatIndex(null);
              }
              return {
                ...seat,
                occupant: null,
                role: 'empty',
                isUser: false,
                isMuted: false,
                isSpeaking: false,
                audioLevel: 0,
                isLocked: true,
              };
            }
            return { ...seat, isLocked: !seat.isLocked };
          }),
        };
      })
    );
    soundFx.playMove();
  };

  const handleToggleMuteSeat = (seatIndex: number) => {
    if (!activeRoomId) return;
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== activeRoomId) return room;
        return {
          ...room,
          seats: room.seats.map((seat) => {
            if (seat.seatIndex !== seatIndex) return seat;
            if (seat.isUser) {
              setIsMicMuted(!seat.isMuted);
            }
            return { ...seat, isMuted: !seat.isMuted };
          }),
        };
      })
    );
    soundFx.playMove();
  };

  const handleSendMessage = (text: string, imageUrl?: string) => {
    if (!activeRoomId) return;
    const clean = text.trim();
    if (!clean && !imageUrl) return;
    ogRealtime.send({
      type: 'room:chat',
      text: clean || (imageUrl ? '📷 Photo' : ''),
      imageUrl,
    });
    soundFx.playMove();
  };

  // Voice Room Emotes appear ONLY on the seated avatar in the Voice Room (never on profiles or chat text)
  const handleSendEmote = (
    emoteNumber: number,
    label: string,
    symbol: string,
    motion: EmoteMotion
  ) => {
    const triggeredAt = Date.now();
    const nextEmote = { emoteNumber, label, motion, triggeredAt };

    if (activeRoomId) {
      ogRealtime.send({
        type: 'room:emote',
        emoteNumber,
        label,
        symbol,
        motion,
        triggeredAt,
      });

      setRooms((prev) =>
        prev.map((room) =>
          room.id === activeRoomId
            ? {
                ...room,
                seats: room.seats.map((seat) =>
                  seat.isUser || seat.occupant?.uid === userProfile.uid
                    ? { ...seat, activeEmote: nextEmote }
                    : seat
                ),
              }
            : room
        )
      );

      if (emoteSeatTimeoutRef.current) clearTimeout(emoteSeatTimeoutRef.current);
      emoteSeatTimeoutRef.current = window.setTimeout(() => {
        setRooms((prev) =>
          prev.map((room) => ({
            ...room,
            seats: room.seats.map((seat) =>
              seat.activeEmote?.triggeredAt === triggeredAt
                ? { ...seat, activeEmote: undefined }
                : seat
            ),
          }))
        );
      }, 3200);
    }

    soundFx.playBeat(true);
  };

  const grantRoomExp = useCallback(
    (roomId: string, expGained: number, extraSystemText?: string) => {
      const now = new Date();
      const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== roomId) return room;

          let nextXp = room.xp + expGained;
          let nextLevel = room.level;
          let leveledUp = false;

          while (nextLevel < 20 && nextXp >= getRoomNextExp(nextLevel)) {
            nextXp -= getRoomNextExp(nextLevel);
            nextLevel += 1;
            leveledUp = true;
          }
          if (nextLevel >= 20) {
            nextXp = Math.min(getRoomNextExp(20), nextXp);
          }

          const updatedMessages = [...room.messages];
          if (extraSystemText) {
            updatedMessages.push({
              id: `exp-${Date.now()}`,
              senderName: 'System',
              senderColor: '#34D399',
              text: extraSystemText,
              timestamp,
              kind: 'system',
            });
          }
          if (leveledUp) {
            updatedMessages.push({
              id: `lvl-${Date.now()}-${nextLevel}`,
              senderName: 'System',
              senderColor: '#F59E0B',
              text: `Room reached Level ${nextLevel}/20! ${getAdminSlotCount(nextLevel)} Admin Slots unlocked.`,
              timestamp,
              kind: 'system',
            });
          }

          return {
            ...room,
            level: nextLevel,
            xp: nextXp,
            messages: updatedMessages,
          };
        })
      );
    },
    []
  );

  // Sending a gift executes atomically on the backend (PostgreSQL FOR UPDATE + Gift FX broadcast)
  const handleSendGift = (
    gift: VirtualGift,
    recipientName: string,
    quantity = 1,
    recipientUid?: string,
    customMessage?: string
  ) => {
    const qty = Math.max(1, quantity);
    const totalCost = gift.cost * qty;
    if (coins < totalCost) {
      showToast('Insufficient coins balance.');
      return;
    }

    const cleanMessage = customMessage?.trim().slice(0, 30) || undefined;
    const resolvedRecipientUid = recipientUid || userProfile.uid;
    const targetRoomId = activeRoomId ?? rooms[0]?.id;

    void (async () => {
      try {
        const resp = await apiFetch('/api/gifts/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            giftId: gift.id,
            recipientUid: resolvedRecipientUid,
            roomId: targetRoomId,
            customMessage: cleanMessage,
            quantity: qty,
          }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          charmEarned?: number;
          randomCoinsEarned?: number;
          user?: Parameters<typeof applyServerUserSnapshot>[0];
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Gift send failed.');
          return;
        }
        if (data.user) {
          applyServerUserSnapshot(data.user);
        }
        void hydrateBackendState();

        const charmEarned = Number(data.charmEarned ?? gift.charmValue * qty);
        const randomCoinsEarned = Number(data.randomCoinsEarned ?? 0);
        const roomExpEarned = Math.max(1, Math.round(totalCost / 10));
        const isBigGift = totalCost >= 500 || gift.rarity !== 'Standard' || Boolean(cleanMessage);

        setUserGiftsGivenCoins((prev) => prev + totalCost);
        soundFx.playGiftFanfare(gift.rarity);
        setReceivedGiftIds((prev) => (prev.includes(gift.id) ? prev : [...prev, gift.id]));

        const now = new Date();
        const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        if (targetRoomId) {
          setRooms((prev) =>
            prev.map((room) => {
              if (room.id !== targetRoomId) return room;
              let nextXp = room.xp + roomExpEarned;
              let nextLevel = room.level;
              while (nextLevel < 20 && nextXp >= getRoomNextExp(nextLevel)) {
                nextXp -= getRoomNextExp(nextLevel);
                nextLevel += 1;
              }
              return {
                ...room,
                level: nextLevel,
                xp: nextXp,
                coinsSpentByUid: {
                  ...(room.coinsSpentByUid ?? {}),
                  [userProfile.uid]: (room.coinsSpentByUid?.[userProfile.uid] ?? 0) + totalCost,
                },
                seats: room.seats.map((seat) => {
                  const matchesUid = recipientUid && seat.occupant?.uid === recipientUid;
                  const matchesName = seat.occupant?.name === recipientName;
                  return matchesUid || matchesName
                    ? {
                        ...seat,
                        giftScore: seat.giftScore + totalCost,
                        charmValue: (seat.charmValue ?? 0) + charmEarned,
                      }
                    : seat;
                }),
                messages: [
                  ...room.messages,
                  {
                    id: `gift-${Date.now()}`,
                    senderUid: userProfile.uid,
                    senderName: userProfile.name,
                    senderColor: '#FBBF24',
                    text: `sent ${qty > 1 ? `${qty}x ` : ''}${gift.name} to ${recipientName}${cleanMessage ? ` · "${cleanMessage}"` : ''} (+${charmEarned.toLocaleString()} Charm, +${randomCoinsEarned.toLocaleString()} Bonus Coins)`,
                    timestamp,
                    kind: 'gift' as const,
                  },
                ],
              };
            })
          );
        }

        const giftPayload: ActiveGiftEvent = {
          eventId: `ev-${Date.now()}`,
          gift,
          senderName: userProfile.name,
          recipientName,
          charmEarned,
          randomCoinsEarned,
          customMessage: cleanMessage,
          isBigGift,
        };
        if (giftTimeoutRef.current) clearTimeout(giftTimeoutRef.current);
        setActiveGiftEvent(giftPayload);
        giftTimeoutRef.current = window.setTimeout(() => setActiveGiftEvent(null), 3200);

        if (isBigGift) {
          if (bigGiftTimeoutRef.current) clearTimeout(bigGiftTimeoutRef.current);
          setBigGiftBanner(giftPayload);
          bigGiftTimeoutRef.current = window.setTimeout(() => setBigGiftBanner(null), 5500);
        }
        void hydrateBackendState();
      } catch {
        showToast('Network error while sending gift.');
      }
    })();
  };

  // PK Battle Handlers (Owner/Admin-only setup & start/end, 1 vote per user in Voting PK)
  const handleTogglePkActive = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId) return room;
        const canMod =
          room.ownerUid === userProfile.uid || room.adminUids.includes(userProfile.uid);
        if (!canMod) return room;
        const currentlyActive = Boolean(room.pkState?.active);
        const durMins = room.pkState?.durationMinutes ?? 5;
        return {
          ...room,
          pkState: currentlyActive
            ? { ...(room.pkState!), active: false, running: false }
            : {
                active: true,
                mode: room.pkState?.mode ?? 'gifting',
                format: room.pkState?.format ?? '1v1',
                durationMinutes: durMins,
                running: false,
                secondsLeft: durMins * 60,
                pinkScore: 0,
                blueScore: 0,
                pinkTeamUids: [],
                blueTeamUids: [],
                votedUids: [],
              },
        };
      })
    );
    soundFx.playMove();
  };

  const handleSetPkConfig = (
    roomId: string,
    config: {
      mode?: 'gifting' | 'voting';
      format?: '1v1' | 'multiplayer';
      durationMinutes?: 5 | 15 | 30 | 45 | 60;
    }
  ) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId || !room.pkState) return room;
        const canMod =
          room.ownerUid === userProfile.uid || room.adminUids.includes(userProfile.uid);
        if (!canMod) return room;
        const nextDur = config.durationMinutes ?? room.pkState.durationMinutes ?? 5;
        return {
          ...room,
          pkState: {
            ...room.pkState,
            mode: config.mode ?? room.pkState.mode,
            format: config.format ?? room.pkState.format,
            durationMinutes: nextDur,
            secondsLeft:
              !room.pkState.running && config.durationMinutes
                ? nextDur * 60
                : room.pkState.secondsLeft,
          },
        };
      })
    );
    soundFx.playMove();
  };

  const handleStartPk = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId || !room.pkState) return room;
        const canMod =
          room.ownerUid === userProfile.uid || room.adminUids.includes(userProfile.uid);
        if (!canMod) return room;
        const durMins = room.pkState.durationMinutes ?? 5;
        return {
          ...room,
          pkState: {
            ...room.pkState,
            running: true,
            durationMinutes: durMins,
            secondsLeft: durMins * 60,
            pinkScore: 0,
            blueScore: 0,
            votedUids: [],
          },
          messages: [
            ...room.messages,
            {
              id: `pk-start-${Date.now()}`,
              senderName: 'PK Referee',
              senderColor: '#38BDF8',
              text: `${room.pkState.mode === 'gifting' ? 'Gifting PK' : 'Voting PK'} (${
                room.pkState.format === '1v1' ? '1v1' : 'Multiplayer'
              }) started for ${String(durMins).padStart(2, '0')}:00!`,
              timestamp: 'Now',
              kind: 'system' as const,
            },
          ],
        };
      })
    );
    soundFx.playVictory();
  };

  const handleEndPk = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId || !room.pkState) return room;
        const canMod =
          room.ownerUid === userProfile.uid || room.adminUids.includes(userProfile.uid);
        if (!canMod) return room;
        return {
          ...room,
          pkState: {
            ...room.pkState,
            active: false,
            running: false,
          },
        };
      })
    );
    soundFx.playMove();
  };

  const handleJoinPkTeam = (roomId: string, side: 'pink' | 'blue') => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId || !room.pkState) return room;
        const cleanPink = room.pkState.pinkTeamUids.filter((id) => id !== userProfile.uid);
        const cleanBlue = room.pkState.blueTeamUids.filter((id) => id !== userProfile.uid);
        return {
          ...room,
          pkState: {
            ...room.pkState,
            pinkTeamUids: side === 'pink' ? [...cleanPink, userProfile.uid] : cleanPink,
            blueTeamUids: side === 'blue' ? [...cleanBlue, userProfile.uid] : cleanBlue,
          },
        };
      })
    );
    soundFx.playMove();
  };

  const handleVotePkTeam = (roomId: string, side: 'pink' | 'blue') => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId || !room.pkState) return room;
        const pk = room.pkState;
        if (pk.votedUids.includes(userProfile.uid)) return room;
        return {
          ...room,
          pkState: {
            ...pk,
            pinkScore: side === 'pink' ? pk.pinkScore + 1 : pk.pinkScore,
            blueScore: side === 'blue' ? pk.blueScore + 1 : pk.blueScore,
            votedUids: [...pk.votedUids, userProfile.uid],
          },
        };
      })
    );
    soundFx.playMove();
  };

  const handleClaimRoomTask = (taskId: string) => {
    const task = roomTasks.find((t) => t.id === taskId);
    if (!task || task.claimed || task.progress < task.target) return;
    const reward = task.vipDouble && effectiveVipLevel >= 2 ? task.rewardExp * 2 : task.rewardExp;
    setRoomTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, claimed: true } : t)));
    const targetId = activeRoomId ?? rooms[0]?.id;
    if (targetId) {
      grantRoomExp(targetId, reward, `Claimed Room Task "${task.title}" (+${reward} Room EXP).`);
    }
    soundFx.playVictory();
  };

  // Create persistent voice room in PostgreSQL (strict 1 personal room per account)
  const handleCreateRoom = async (data: {
    title: string;
    topic: string;
    category: VoiceRoom['category'];
    ambiance: VoiceRoom['ambiance'];
    roomType: VoiceRoom['roomType'];
    seatCapacity: 10 | 15 | 19;
    roomCode?: string;
    dpUrl?: string;
    isRoomLocked?: boolean;
    roomPasscode?: string;
  }): Promise<boolean> => {
    if (hasCreatedRoom) {
      showToast('Each user can create at most 1 personal Voice Room.');
      return false;
    }
    try {
      const resp = await apiFetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          topic: data.topic,
          category: data.category,
          ambiance: data.ambiance,
          seatCapacity: data.seatCapacity,
          roomCode: data.roomCode,
          dpUrl: data.dpUrl,
          isRoomLocked: data.isRoomLocked,
          roomPasscode: data.roomPasscode,
        }),
      });
      const resData = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        room?: { id: string };
      };
      if (!resp.ok || !resData.ok || !resData.room) {
        showToast(resData.error || 'Could not create voice room.');
        return false;
      }
      await hydrateBackendState();
      setHasCreatedRoom(true);
      enterRoomDirect(resData.room.id);
      setActiveSection('rooms');
      soundFx.playVictory();
      return true;
    } catch {
      showToast('Network error creating voice room.');
      return false;
    }
  };

  // Home Hub handlers (Daily Tasks backed by PostgreSQL; NEVER grants VIP)
  const handleClaimTask = (taskId: string) => {
    void (async () => {
      try {
        const resp = await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}/claim`, {
          method: 'POST',
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          coinsAwarded?: number;
          claimedTaskChests?: number[];
          error?: string;
          user?: Parameters<typeof applyServerUserSnapshot>[0];
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Task not ready to claim.');
          return;
        }
        if (data.user) applyServerUserSnapshot(data.user);
        if (Array.isArray(data.claimedTaskChests)) {
          setClaimedTaskChests(data.claimedTaskChests.map(Number));
        }
        setDailyTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, claimed: true } : t)));
        soundFx.playVictory();
        showToast(`Claimed +${Number(data.coinsAwarded ?? 0).toLocaleString()} Coins!`);
        void hydrateBackendState();
      } catch {
        showToast('Unable to claim task right now.');
      }
    })();
  };

  const handleClaimTaskChest = (step: number, _rewardCoins: number) => {
    void (async () => {
      try {
        const resp = await apiFetch(`/api/tasks/chests/${encodeURIComponent(String(step))}/claim`, {
          method: 'POST',
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          label?: string;
          coinsAwarded?: number;
          claimedTaskChests?: number[];
          error?: string;
          user?: Parameters<typeof applyServerUserSnapshot>[0];
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Complete more daily tasks to unlock this chest.');
          return;
        }
        if (data.user) applyServerUserSnapshot(data.user);
        if (Array.isArray(data.claimedTaskChests)) {
          setClaimedTaskChests(data.claimedTaskChests.map(Number));
        }
        soundFx.playVictory();
        showToast(
          `Unlocked ${data.label || 'Milestone Chest'}: +${Number(data.coinsAwarded ?? 0).toLocaleString()} Coins!`
        );
        void hydrateBackendState();
      } catch {
        showToast('Unable to claim chest reward right now.');
      }
    })();
  };

  const handleInviteFriendApp = () => {
    soundFx.playVictory();
    showToast('Share your OG VELOCITY ID to invite friends!');
  };

  const handleAddFriendByUid = (rawUid: string): string => {
    const cleanUid = rawUid.trim();
    if (!cleanUid) return 'Enter a valid User ID.';
    if (cleanUid === userProfile.uid || (userProfile.publicId && cleanUid === userProfile.publicId)) {
      return 'That is your own permanent OG VELOCITY ID.';
    }
    void (async () => {
      try {
        const resp = await apiFetch('/api/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUidOrPublicId: cleanUid }),
        });
        const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Could not send friend request.');
          return;
        }
        setOutgoingPendingFriendUids((prev) =>
          prev.includes(cleanUid) ? prev : [...prev, cleanUid]
        );
        showToast(`Friend request sent to ${cleanUid}!`);
        void hydrateBackendState();
        if (inspectedUser && (inspectedUser.avatar.uid === cleanUid || inspectedUser.avatar.publicId === cleanUid)) {
          inspectUserById(cleanUid);
        }
      } catch {
        showToast('Failed to send friend request.');
      }
    })();
    return `Sending friend request to ${cleanUid}...`;
  };

  const handleCancelFriendRequest = async (targetUid: string): Promise<string> => {
    try {
      const resp = await apiFetch('/api/friends/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUidOrPublicId: targetUid }),
      });
      const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        showToast(data.error || 'Unable to cancel friend request.');
        return data.error || 'Unable to cancel friend request.';
      }
      setOutgoingPendingFriendUids((prev) => prev.filter((id) => id !== targetUid));
      showToast('Friend request cancelled.');
      void hydrateBackendState();
      if (inspectedUser && (inspectedUser.avatar.uid === targetUid || inspectedUser.avatar.publicId === targetUid)) {
        inspectUserById(targetUid);
      }
      return 'Friend request cancelled.';
    } catch {
      showToast('Failed to cancel friend request.');
      return 'Failed to cancel friend request.';
    }
  };

  const handleRespondFriendRequest = (relationId: number, accept: boolean) => {
    void (async () => {
      try {
        const resp = await apiFetch('/api/friends/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relationId, accept }),
        });
        if (resp.ok) {
          soundFx.playVictory();
          showToast(accept ? 'Friend request accepted!' : 'Friend request declined.');
          void hydrateBackendState();
          if (inspectedUser) {
            inspectUserById(inspectedUser.avatar.publicId || inspectedUser.avatar.uid);
          }
        }
      } catch {
        showToast('Failed to respond to friend request.');
      }
    })();
  };

  const handleRespondByPeerUid = (peerUid: string, accept: boolean) => {
    const rel =
      inspectedUser?.relationId &&
      (inspectedUser.avatar.uid === peerUid || inspectedUser.avatar.publicId === peerUid)
        ? { id: inspectedUser.relationId }
        : pendingFriendRequests.find((r) => r.requesterUid === peerUid || r.publicId === peerUid);
    if (!rel?.id) {
      showToast('Pending friend request not found.');
      return;
    }
    handleRespondFriendRequest(rel.id, accept);
  };

  const handleUnfriendUser = (targetUid: string, targetName: string) => {
    void (async () => {
      try {
        const resp = await apiFetch(`/api/friends/${encodeURIComponent(targetUid)}`, {
          method: 'DELETE',
        });
        if (resp.ok) {
          showToast(`Removed ${targetName} from friends.`);
          setChatThreads((prev) => prev.filter((t) => t.friendUid !== targetUid));
          void hydrateBackendState();
          if (inspectedUser && (inspectedUser.avatar.uid === targetUid || inspectedUser.avatar.publicId === targetUid)) {
            inspectUserById(targetUid);
          }
        }
      } catch {
        showToast('Failed to unfriend user.');
      }
    })();
  };

  const handleBlockUser = (targetUid: string, targetName: string) => {
    void (async () => {
      try {
        const resp = await apiFetch('/api/friends/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUid }),
        });
        if (resp.ok) {
          showToast(`Blocked ${targetName}.`);
          setChatThreads((prev) => prev.filter((t) => t.friendUid !== targetUid));
          void hydrateBackendState();
          if (inspectedUser && (inspectedUser.avatar.uid === targetUid || inspectedUser.avatar.publicId === targetUid)) {
            inspectUserById(targetUid);
          }
        }
      } catch {
        showToast('Failed to block user.');
      }
    })();
  };

  const handleUnblockUser = (targetUid: string, targetName: string) => {
    void (async () => {
      try {
        const resp = await apiFetch('/api/friends/unblock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUid }),
        });
        if (resp.ok) {
          showToast(`Unblocked ${targetName}.`);
          void hydrateBackendState();
          if (inspectedUser && (inspectedUser.avatar.uid === targetUid || inspectedUser.avatar.publicId === targetUid)) {
            inspectUserById(targetUid);
          }
        }
      } catch {
        showToast('Failed to unblock user.');
      }
    })();
  };

  const handleReportContent = (
    targetType: 'user' | 'post' | 'room',
    targetId: string,
    reason: string
  ) => {
    void (async () => {
      try {
        const resp = await apiFetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType, targetId, reason }),
        });
        if (resp.ok) {
          showToast('Report submitted to OG VELOCITY moderation.');
        }
      } catch {
        showToast('Failed to submit report.');
      }
    })();
  };

  const handleJoinEvent = async (eventId: string) => {
    const resp = await apiFetch(`/api/events/${encodeURIComponent(eventId)}/join`, {
      method: 'POST',
    });
    if (resp.ok) {
      soundFx.playVictory();
      showToast('Joined event! Check notifications for live updates.');
    }
  };

  const handleMarkNotificationsRead = () => {
    void apiFetch('/api/notifications/read-all', { method: 'POST' })
      .then((r) => {
        if (r.ok) {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }
      })
      .catch(() => {});
  };

  // Chat handlers (backed by PostgreSQL DM persistence & WebSocket dm:send; accepted friends only)
  const handleSelectChatThread = (friendUid: string) => {
    setChatThreads((prev) =>
      prev.map((t) => (t.friendUid === friendUid ? { ...t, unread: 0 } : t))
    );
    void apiFetch(`/api/messages/dm/${encodeURIComponent(friendUid)}/read`, {
      method: 'POST',
    }).catch(() => {});
    void apiFetch(`/api/messages/dm/${encodeURIComponent(friendUid)}?limit=40`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            hasMore?: boolean;
            messages?: Array<{
              id: number | string;
              senderUid: string;
              body: string;
              imageUrl?: string | null;
              createdAt?: string;
            }>;
          } | null
        ) => {
          if (!d?.messages) return;
          const oldest = d.messages[0]?.createdAt;
          if (oldest) oldestMsgCreatedAtRef.current[friendUid] = oldest;
          setHasMoreMessagesByUid((prev) => ({ ...prev, [friendUid]: Boolean(d.hasMore) }));
          setChatThreads((prev) =>
            prev.map((t) =>
              t.friendUid === friendUid
                ? {
                    ...t,
                    unread: 0,
                    messages: d.messages!.map((m) => ({
                      id: String(m.id),
                      senderId: m.senderUid,
                      senderName: m.senderUid === userProfile.uid ? userProfile.name : t.friendName,
                      text: m.body,
                      imageUrl: m.imageUrl || undefined,
                      timestamp: m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Now',
                      isSelf: m.senderUid === userProfile.uid,
                    })),
                  }
                : t
            )
          );
        }
      )
      .catch(() => {});
  };

  const handleLoadOlderMessages = (friendUid: string) => {
    const beforeCursor = oldestMsgCreatedAtRef.current[friendUid];
    if (!beforeCursor) return;
    void apiFetch(
      `/api/messages/dm/${encodeURIComponent(friendUid)}?limit=40&before=${encodeURIComponent(beforeCursor)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            hasMore?: boolean;
            messages?: Array<{
              id: number | string;
              senderUid: string;
              body: string;
              imageUrl?: string | null;
              createdAt?: string;
            }>;
          } | null
        ) => {
          if (!d?.messages) return;
          const oldest = d.messages[0]?.createdAt;
          if (oldest) oldestMsgCreatedAtRef.current[friendUid] = oldest;
          setHasMoreMessagesByUid((prev) => ({ ...prev, [friendUid]: Boolean(d.hasMore) }));
          setChatThreads((prev) =>
            prev.map((t) => {
              if (t.friendUid !== friendUid) return t;
              const existingIds = new Set(t.messages.map((m) => m.id));
              const olderMapped = d.messages!
                .filter((m) => !existingIds.has(String(m.id)))
                .map((m) => ({
                  id: String(m.id),
                  senderId: m.senderUid,
                  senderName: m.senderUid === userProfile.uid ? userProfile.name : t.friendName,
                  text: m.body,
                  imageUrl: m.imageUrl || undefined,
                  timestamp: m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Now',
                  isSelf: m.senderUid === userProfile.uid,
                }));
              return { ...t, messages: [...olderMapped, ...t.messages] };
            })
          );
        }
      )
      .catch(() => {});
  };

  const handleSendChatMessage = (friendUid: string, text: string, imageUrl?: string) => {
    const clean = text.trim();
    if (!clean && !imageUrl) return;
    ogRealtime.send({
      type: 'dm:send',
      recipientUid: friendUid,
      body: clean || (imageUrl ? '📷 Photo' : ''),
      imageUrl,
    });
    soundFx.playMove();
  };

  const handleJoinFriendVoiceRoom = (roomUid: string) => {
    void openRoomByIdOrLink(roomUid);
  };

  const handleMessageUser = (uid: string, name: string) => {
    const isFriend = friends.some((f) => f.uid === uid || f.publicId === uid);
    if (!isFriend) {
      showToast('Send and accept a friend request first to chat in Direct Messages.');
      return;
    }
    const existing = chatThreads.find((t) => t.friendUid === uid);
    if (!existing) {
      setChatThreads((prev) => [
        {
          friendUid: uid,
          friendName: name,
          avatarId: uid,
          status: 'Online',
          online: true,
          unread: 0,
          messages: [],
        },
        ...prev,
      ]);
    }
    handleSelectChatThread(uid);
    setActiveSection('chat');
  };

  const handleSendBackMessage = (uid: string, name: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const isFriend = friends.some((f) => f.uid === uid || f.publicId === uid);
    if (!isFriend) {
      showToast('Direct messages are available only between accepted friends.');
      return;
    }
    const existing = chatThreads.find((t) => t.friendUid === uid);
    if (!existing) {
      setChatThreads((prev) => [
        {
          friendUid: uid,
          friendName: name,
          avatarId: uid,
          status: 'Online',
          online: true,
          unread: 0,
          messages: [],
        },
        ...prev,
      ]);
    }
    ogRealtime.send({ type: 'dm:send', recipientUid: uid, body: clean });
    soundFx.playMove();
  };

  // Discover Moments handlers (PostgreSQL backed)
  const handleToggleLikeMoment = (momentId: string) => {
    void (async () => {
      try {
        const resp = await apiFetch(`/api/moments/${encodeURIComponent(momentId)}/like`, {
          method: 'POST',
        });
        const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; liked?: boolean };
        if (resp.ok && data.ok) {
          setMoments((prev) =>
            prev.map((m) =>
              m.id === momentId
                ? {
                    ...m,
                    liked: Boolean(data.liked),
                    likes: data.liked ? m.likes + 1 : Math.max(0, m.likes - 1),
                  }
                : m
            )
          );
          soundFx.playMove();
        }
      } catch {
        // Ignore transient like error
      }
    })();
  };

  const handleAddMoment = (
    caption: string,
    mediaType: 'photo' | 'video',
    mediaUrl?: string,
    visibility: 'public' | 'selected' = 'public',
    allowedUids: string[] = []
  ) => {
    void (async () => {
      try {
        const resp = await apiFetch('/api/moments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption, mediaType, mediaUrl, visibility, allowedUids }),
        });
        const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Could not publish moment.');
          return;
        }
        soundFx.playVictory();
        void hydrateBackendState();
      } catch {
        showToast('Network error publishing moment.');
      }
    })();
  };

  const handlePurchaseActionTag = async (
    partnerUid: string,
    tagType: 'bro' | 'bestie' | 'sister' | 'soulmate' | 'confident'
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const resp = await apiFetch('/api/action-room/tags/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerUid,
          tagType,
          idempotencyKey: `act-tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        coinsAfter?: number;
        user?: Parameters<typeof applyServerUserSnapshot>[0];
      };
      if (!resp.ok || !data.ok) {
        return { ok: false, message: data.error || 'Unable to activate Action Room tag.' };
      }
      if (data.user) applyServerUserSnapshot(data.user);
      else if (typeof data.coinsAfter === 'number') setCoins(data.coinsAfter);
      soundFx.playVictory();
      void hydrateBackendState();
      return { ok: true, message: `Tag ${tagType.toUpperCase()} invitation sent & Coins deducted!` };
    } catch {
      return { ok: false, message: 'Network error activating Action Room tag.' };
    }
  };

  const handleInviteFriendToRoom = (roomId: string, friend: FriendRecord) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    handleSendBackMessage(
      friend.uid,
      friend.name,
      `Join me in "${room.title}" Voice Room (ID: ${room.uid})!`
    );
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              messages: [
                ...r.messages,
                {
                  id: `inv-${Date.now()}`,
                  senderName: 'System',
                  senderColor: '#22D3EE',
                  text: `${userProfile.name} invited ${friend.name} (${friend.uid}) to the room.`,
                  timestamp: 'Now',
                  kind: 'system',
                },
              ],
            }
          : r
      )
    );
    soundFx.playVictory();
  };

  const handleInviteFriendToGame = (friend: FriendRecord, gameTitle: string) => {
    handleSendBackMessage(
      friend.uid,
      friend.name,
      `Hey ${friend.name}, join my ${gameTitle} match on OG VELOCITY!`
    );
    soundFx.playVictory();
  };

  // CP (Couple / Partner) Synchronized Backend Workflow (Decoupled from Shop Rings)
  const handleProposeCp = (
    toUid: string,
    _toName: string,
    _toAvatarId: string,
    ringNumber: number,
    ringName: string
  ) => {
    const cleanTarget = toUid.trim();
    if (!cleanTarget || cleanTarget === userProfile.uid || cleanTarget === userProfile.publicId) {
      showToast('Please select another user to propose CP.');
      return;
    }
    void (async () => {
      try {
        const resp = await apiFetch('/api/cp/propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toUid: cleanTarget, ringNumber, ringName }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          cpState?: {
            cpPartner?: AvatarConfig['cpPartner'];
            proposals?: CpRequest[];
            history?: CpRelationshipHistoryRecord[];
          };
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Could not send CP proposal.');
          return;
        }
        if (data.cpState) {
          setUserProfile((prev) => ({ ...prev, cpPartner: data.cpState!.cpPartner ?? null }));
          if (Array.isArray(data.cpState.proposals)) setCpRequests(data.cpState.proposals);
          if (Array.isArray(data.cpState.history)) setCpRelationshipHistory(data.cpState.history);
        }
        soundFx.playGiftFanfare('Signature');
        showToast(`CP Bond proposal (${ringName}) sent!`);
      } catch {
        showToast('Network error while sending CP proposal.');
      }
    })();
  };

  const handleRespondCpRequest = (requestId: string, accept: boolean) => {
    void (async () => {
      try {
        const resp = await apiFetch(`/api/cp/proposals/${encodeURIComponent(requestId)}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accept }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          cpState?: {
            cpPartner?: AvatarConfig['cpPartner'];
            proposals?: CpRequest[];
            history?: CpRelationshipHistoryRecord[];
          };
          user?: Parameters<typeof applyServerUserSnapshot>[0];
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Failed to respond to CP proposal.');
          return;
        }
        if (data.cpState) {
          setUserProfile((prev) => ({ ...prev, cpPartner: data.cpState!.cpPartner ?? null }));
          if (Array.isArray(data.cpState.proposals)) setCpRequests(data.cpState.proposals);
          if (Array.isArray(data.cpState.history)) setCpRelationshipHistory(data.cpState.history);
          if (data.cpState.cpPartner) {
            setIntimateSpace((prev) => ({
              ...prev,
              partnerName: data.cpState!.cpPartner!.partnerName,
              partnerAvatarId: data.cpState!.cpPartner!.partnerAvatarId,
              progress: data.cpState!.cpPartner!.cpCharm ?? 0,
            }));
          }
        }
        if (data.user) {
          applyServerUserSnapshot(data.user);
        }
        if (accept) {
          soundFx.playVictory();
          showToast('CP Bond accepted! Both profiles are now linked.');
        } else {
          soundFx.playMove();
          showToast('CP proposal declined.');
        }
      } catch {
        showToast('Network error responding to CP proposal.');
      }
    })();
  };

  const handleBreakCp = () => {
    void (async () => {
      try {
        const resp = await apiFetch('/api/cp/break', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          cpState?: {
            cpPartner?: AvatarConfig['cpPartner'];
            proposals?: CpRequest[];
            history?: CpRelationshipHistoryRecord[];
          };
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Could not unbind CP.');
          return;
        }
        setUserProfile((prev) => ({ ...prev, cpPartner: null }));
        setIntimateSpace(INITIAL_INTIMATE_SPACE);
        if (data.cpState) {
          if (Array.isArray(data.cpState.proposals)) setCpRequests(data.cpState.proposals);
          if (Array.isArray(data.cpState.history)) setCpRelationshipHistory(data.cpState.history);
        }
        soundFx.playMove();
        showToast('CP relationship unbound.');
      } catch {
        showToast('Network error ending CP relationship.');
      }
    })();
  };

  // Ring Support Animation & Blessing Boost Handler
  const handleSupportUser = (
    targetUid: string,
    targetName: string,
    ringNumber: number,
    ringName: string
  ) => {
    const blessingBoost = 100;

    if (targetUid === userProfile.uid) {
      setUserProfile((prev) => ({
        ...prev,
        blessing: (prev.blessing ?? 0) + blessingBoost,
      }));
    } else if (userProfile.cpPartner?.partnerUid === targetUid) {
      setUserProfile((prev) => {
        if (!prev.cpPartner) return prev;
        const nextCpCharm = (prev.cpPartner.cpCharm ?? 0) + blessingBoost;
        return {
          ...prev,
          cpPartner: {
            ...prev.cpPartner,
            cpCharm: nextCpCharm,
            cpLevel: getCpLevelInfo(nextCpCharm).level,
          },
        };
      });
    }

    setInspectedUser((prev) =>
      prev && prev.avatar.uid === targetUid
        ? {
            ...prev,
            avatar: {
              ...prev.avatar,
              blessing: (prev.avatar.blessing ?? 0) + blessingBoost,
            },
          }
        : prev
    );

    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        seats: room.seats.map((seat) =>
          seat.occupant?.uid === targetUid
            ? {
                ...seat,
                occupant: {
                  ...seat.occupant,
                  blessing: (seat.occupant.blessing ?? 0) + blessingBoost,
                },
              }
            : seat
        ),
      }))
    );

    if (supportTimeoutRef.current) clearTimeout(supportTimeoutRef.current);
    setSupportRingEvent({
      eventId: `sup-${Date.now()}`,
      senderName: userProfile.name,
      recipientUid: targetUid,
      recipientName: targetName,
      ringNumber,
      ringName,
      blessingAdded: blessingBoost,
    });
    supportTimeoutRef.current = window.setTimeout(() => {
      setSupportRingEvent(null);
    }, 3200);

    soundFx.playGiftFanfare('Signature');
  };

  // Create Gift Submission (Admin-reviewed on server)
  const handleSubmitCustomGift = (
    submission: Omit<CustomGiftSubmission, 'id' | 'creatorUid' | 'creatorName' | 'status' | 'submittedAt'>
  ) => {
    void (async () => {
      try {
        const rarity =
          submission.cost >= 1500 ? 'Mythic' : submission.cost >= 300 ? 'Signature' : 'Standard';
        const resp = await apiFetch('/api/gifts/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: submission.name,
            cost: submission.cost,
            charmValue: submission.charmValue,
            rarity,
            description: submission.description,
            primaryColor: submission.primaryColor,
            secondaryColor: submission.secondaryColor,
            particleStyle: submission.particleStyle,
            artworkUrl: submission.artworkUrl ?? null,
            animationVideoUrl: submission.animationVideoUrl ?? null,
            videoFileName: submission.videoFileName ?? null,
          }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          submission?: CustomGiftSubmission & { createdAt?: string };
        };
        if (!resp.ok || !data.ok || !data.submission) {
          showToast(data.error || 'Could not submit custom gift.');
          return;
        }
        const entry: CustomGiftSubmission = {
          ...data.submission,
          creatorUid: userProfile.publicId || userProfile.uid,
          creatorName: userProfile.name,
          submittedAt: data.submission.submittedAt || data.submission.createdAt || new Date().toISOString(),
        };
        setCustomGifts((prev) => [entry, ...prev]);
        soundFx.playVictory();
        showToast('Custom gift submitted for Admin approval!');
        void hydrateBackendState();
      } catch {
        showToast('Network error submitting custom gift.');
      }
    })();
  };

  // Profile & Shop handlers (UID and verified identity stay locked; wallet/VIP strictly server-backed)
  const handleUpdateProfile = (updates: Partial<AvatarConfig>) => {
    if (updates.themeMode === 'light' || updates.themeMode === 'dark') {
      setThemeMode(updates.themeMode);
    }
    setUserProfile((prev) => ({
      ...prev,
      name: updates.name ?? prev.name,
      handle: updates.handle ?? prev.handle,
      bio: updates.bio ?? prev.bio,
      gender: updates.gender ?? prev.gender,
      age: updates.age ?? prev.age,
      country: updates.country ?? prev.country,
      tags: updates.tags ?? prev.tags,
      ornament: updates.ornament ?? prev.ornament,
      themeMode: updates.themeMode ?? prev.themeMode,
      equippedEmoteId:
        updates.equippedEmoteId !== undefined ? updates.equippedEmoteId : prev.equippedEmoteId,
      photoUrl: updates.photoUrl !== undefined ? updates.photoUrl : prev.photoUrl,
      coverUrl: updates.coverUrl !== undefined ? updates.coverUrl : prev.coverUrl,
      uid: prev.uid,
    }));
    void apiFetch('/api/protected/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updates.name,
        bio: updates.bio,
        gender: updates.gender,
        age: updates.age,
        country: updates.country,
        ornament: updates.ornament,
        handle: updates.handle,
        photoUrl: updates.photoUrl,
        themeMode: updates.themeMode,
        equippedEmoteId: updates.equippedEmoteId,
      }),
    }).catch(() => {});
  };

  const handleRequestWithdrawal = async (payload: {
    amountCoins: number;
    payoutMethod: 'upi' | 'bank';
    accountHolderName: string;
    upiOrAccount: string;
    ifscOrBank?: string;
  }): Promise<{ ok: boolean; message: string }> => {
    try {
      const resp = await apiFetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        withdrawals?: WithdrawalRequestRecord[];
        user?: Parameters<typeof applyServerUserSnapshot>[0];
      };
      if (!resp.ok || !data.ok) {
        return { ok: false, message: data.error || 'Could not submit withdrawal request.' };
      }
      if (data.user) applyServerUserSnapshot(data.user);
      if (Array.isArray(data.withdrawals)) setWithdrawals(data.withdrawals);
      soundFx.playVictory();
      void hydrateBackendState();
      return { ok: true, message: 'Withdrawal request submitted for Super Admin review.' };
    } catch {
      return { ok: false, message: 'Network error submitting withdrawal request.' };
    }
  };

  const handleProposeRelationshipTag = async (
    toUid: string,
    tagType: RelationshipTagKey
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const resp = await apiFetch('/api/tags/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUid, tagType }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tags?: RelationshipTagSummary[];
      };
      if (!resp.ok || !data.ok) {
        return { ok: false, message: data.error || 'Could not send tag invitation.' };
      }
      if (Array.isArray(data.tags)) setRelationshipTags(data.tags);
      soundFx.playVictory();
      return { ok: true, message: 'Relationship Tag invitation sent!' };
    } catch {
      return { ok: false, message: 'Network error sending relationship tag invitation.' };
    }
  };

  const handleRespondRelationshipTag = async (tagId: string, accept: boolean) => {
    try {
      const resp = await apiFetch(`/api/tags/${encodeURIComponent(tagId)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tags?: RelationshipTagSummary[];
        user?: Parameters<typeof applyServerUserSnapshot>[0];
      };
      if (!resp.ok || !data.ok) {
        showToast(data.error || 'Unable to respond to invitation.');
        return;
      }
      if (Array.isArray(data.tags)) setRelationshipTags(data.tags);
      if (data.user) applyServerUserSnapshot(data.user);
      soundFx.playVictory();
      showToast(accept ? 'Relationship Tag activated!' : 'Tag invitation declined.');
    } catch {
      showToast('Network error responding to invitation.');
    }
  };

  const handleEndRelationshipTag = async (tagId: string) => {
    try {
      const resp = await apiFetch(`/api/tags/${encodeURIComponent(tagId)}/end`, {
        method: 'POST',
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tags?: RelationshipTagSummary[];
        user?: Parameters<typeof applyServerUserSnapshot>[0];
      };
      if (!resp.ok || !data.ok) {
        showToast(data.error || 'Unable to remove relationship tag.');
        return;
      }
      if (Array.isArray(data.tags)) setRelationshipTags(data.tags);
      if (data.user) applyServerUserSnapshot(data.user);
      showToast('Relationship Tag removed.');
    } catch {
      showToast('Network error removing tag.');
    }
  };

  const handleCreatePaymentOrder = async (orderType: 'vip' | 'coins', packageId: string) => {
    try {
      const resp = await apiFetch('/api/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderType, packageId, screen: orderType }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        order?: ActivePaymentOrderPayload['order'];
        upiConfig?: ActivePaymentOrderPayload['upiConfig'];
      };
      if (!resp.ok || !data.ok || !data.order || !data.upiConfig) {
        showToast(data.error || 'Could not initiate payment order.');
        return;
      }
      setActivePaymentOrder({ order: data.order, upiConfig: data.upiConfig });
      void hydrateBackendState();
    } catch {
      showToast('Unable to connect to payment server.');
    }
  };

  const handleReopenOrderModal = (order: BackendOrderRecord) => {
    void (async () => {
      try {
        const resp = await apiFetch(
          `/api/payments/upi-config?orderId=${encodeURIComponent(order.orderId)}`
        );
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          expiresAt?: string | null;
          upiConfig?: ActivePaymentOrderPayload['upiConfig'];
        };
        if (resp.ok && data.ok && data.upiConfig) {
          setActivePaymentOrder({
            order: {
              orderId: order.orderId,
              orderType: order.orderType,
              packageId: order.packageId,
              packageName: order.packageName,
              amountInr: order.amountInr,
              coinsAmount: order.coinsAmount,
              grantedVipLevel: order.grantedVipLevel,
              qrVersionId: data.upiConfig.currentVersionId ?? data.upiConfig.qrVersionId ?? order.qrVersionId ?? null,
              expiresAt: data.expiresAt ?? order.expiresAt ?? null,
              status: order.status,
              utrNumber: order.utrNumber,
            },
            upiConfig: data.upiConfig,
          });
        } else {
          showToast(data.error || 'This payment session is no longer active.');
        }
      } catch {
        showToast('Could not load UPI QR details for this order.');
      }
    })();
  };

  const handleBuyCoins = async (packageId: string): Promise<{ ok: boolean; message: string }> => {
    await handleCreatePaymentOrder('coins', packageId);
    return {
      ok: false,
      message: 'Scan the official UPI QR and submit your UTR for Admin approval.',
    };
  };

  const handleBuyVip = async (planId: string): Promise<{ ok: boolean; message: string }> => {
    await handleCreatePaymentOrder('vip', planId);
    return {
      ok: false,
      message: 'Scan the official UPI QR and submit your UTR. VIP activates only after Admin approval.',
    };
  };

  const handleBuyShopItem = (item: ShopItem) => {
    if (coins < item.priceCoins || ownedItemIds.includes(item.id)) return;
    void (async () => {
      try {
        const resp = await apiFetch('/api/shop/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: item.id,
            category: item.category,
            priceCoins: item.priceCoins,
            durationDays: item.durationDays,
          }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          user?: Parameters<typeof applyServerUserSnapshot>[0];
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Shop purchase failed.');
          return;
        }
        if (data.user) applyServerUserSnapshot(data.user);
        setOwnedItemIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
        if (item.durationDays) {
          setOwnedItemExpiries((prev) => ({
            ...prev,
            [item.id]: Date.now() + item.durationDays! * 86_400_000,
          }));
        }
        await apiFetch('/api/shop/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: item.category, itemId: item.id }),
        }).catch(() => {});
        setEquippedItems((prev) => ({ ...prev, [item.category]: item.id }));
        soundFx.playVictory();
        void hydrateBackendState();
      } catch {
        showToast('Network error purchasing shop item.');
      }
    })();
  };

  const handleEquipShopItem = (item: ShopItem) => {
    if (!ownedItemIds.includes(item.id)) return;
    void (async () => {
      try {
        const resp = await apiFetch('/api/shop/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: item.category, itemId: item.id }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          user?: Parameters<typeof applyServerUserSnapshot>[0];
        };
        if (!resp.ok || !data.ok) {
          showToast(data.error || 'Cannot equip item.');
          return;
        }
        if (data.user) applyServerUserSnapshot(data.user);
        setEquippedItems((prev) => ({ ...prev, [item.category]: item.id }));
        soundFx.playMove();
      } catch {
        showToast('Network error equipping item.');
      }
    })();
  };

  if (isCheckingSession) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] p-4 text-slate-100">
        <AmbientCanvas ambiance="saffron" energy={0.3} />
        <div className="relative z-10 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-purple-400/20 bg-[#161024]/90 px-8 py-6 text-center backdrop-blur-md">
          {sessionError ? (
            <>
              <p className="text-sm font-bold text-rose-300">Session Verification Failed</p>
              <p className="text-xs text-slate-300">{sessionError}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionRetryNonce((n) => n + 1)}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-xs font-extrabold text-white"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/15"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              <p className="text-xs font-semibold tracking-wide text-slate-300">
                Verifying OG VELOCITY session...
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] text-slate-100">
        <AmbientCanvas ambiance="saffron" energy={0.35} />
        <div className="relative z-10">
          <AuthScreen
            onLogin={handleLogin}
            onVerifyFirebaseUser={handleVerifyFirebaseUser}
            initialError={authError}
            onClearError={() => setAuthError(null)}
          />
        </div>
      </div>
    );
  }

  if (isAdminRoute && ADMIN_ROLES.has(userRole)) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] text-slate-100">
        <AdminPanel
          authToken={authToken}
          currentUserRole={userRole}
          currentUserEmail={verifiedEmail}
          onExitAdmin={exitAdminConsole}
          onRefreshApp={() => void hydrateBackendState()}
          onShopItemsChanged={() => void hydrateBackendState()}
          onCustomGiftsChanged={() => void hydrateBackendState()}
        />
      </div>
    );
  }

  if (appConfig?.maintenanceMode && !ADMIN_ROLES.has(userRole)) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] p-6 text-slate-100">
        <AmbientCanvas ambiance="saffron" energy={0.25} />
        <div className="relative z-10 max-w-md rounded-3xl border border-amber-400/35 bg-[#161024]/90 p-7 text-center shadow-2xl backdrop-blur-md">
          <h1 className="font-display text-xl font-black text-amber-300">
            {appConfig.appName || 'OG VELOCITY'} Maintenance
          </h1>
          <p className="mt-3 text-sm text-slate-200">
            {appConfig.maintenanceMessage || 'Scheduled maintenance is in progress. Please check back shortly.'}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/15"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-screen transition-colors ${
        themeMode === 'light'
          ? 'bg-gradient-to-b from-slate-100 via-slate-50 to-indigo-50 text-slate-900'
          : 'bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] text-slate-100'
      }`}
    >
      <AmbientCanvas ambiance={activeRoom?.ambiance ?? 'saffron'} energy={0.42} />

      <div className="relative z-10 flex min-h-screen flex-col">
        {appNotice && (
          <div className="pointer-events-none fixed inset-x-4 top-3 z-[70] mx-auto max-w-md">
            <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl border border-cyan-400/40 bg-[#0D1526]/95 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
              <span>{appNotice}</span>
              <button
                type="button"
                onClick={() => setAppNotice(null)}
                className="rounded-full p-0.5 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Global Top Notification Bar for Big Gifts (visible across all tabs) */}
        {bigGiftBanner && (
          <div className="pointer-events-none fixed inset-x-3 top-2 z-50 mx-auto max-w-xl">
            <div className="pointer-events-auto flex items-center justify-between gap-2.5 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-[#0A1628]/95 via-[#0F233C]/95 to-[#0D1526]/95 px-3.5 py-2 shadow-[0_8px_32px_rgba(6,182,212,0.38)] backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-black/40">
                  <GiftArtwork giftId={bigGiftBanner.gift.id} gift={bigGiftBanner.gift} size={34} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1 text-xs font-extrabold text-white">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span className="text-amber-300">{bigGiftBanner.senderName}</span>
                    <span className="text-slate-300">sent</span>
                    <span className="text-rose-300">{bigGiftBanner.gift.name}</span>
                    <span className="text-slate-300">to</span>
                    <span className="text-cyan-300">{bigGiftBanner.recipientName}</span>
                  </div>
                  {bigGiftBanner.customMessage && (
                    <div className="mt-0.5 truncate text-[11px] font-bold text-amber-200">
                      “{bigGiftBanner.customMessage}”
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBigGiftBanner(null)}
                aria-label="Dismiss gift alert"
                className="shrink-0 rounded-full p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <main
          className={
            activeSection === 'rooms' && activeRoom
              ? 'flex-1'
              : 'mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 sm:px-6'
          }
        >
          {activeSection === 'home' && (
            <HomeHub
              userProfile={userProfile}
              userRole={userRole}
              notifications={notifications}
              authToken={authToken}
              coins={coins}
              charm={charm}
              vipLevel={effectiveVipLevel}
              vipGrowth={vipGrowth}
              vipLabel={vipLabel}
              userGiftsGivenCoins={userGiftsGivenCoins}
              dailyLoginClaimed={dailyLoginClaimed}
              ownedItemIds={ownedItemIds}
              ownedItemExpiries={ownedItemExpiries}
              equippedItems={equippedItems}
              dailyTasks={dailyTasks}
              claimedTaskChests={claimedTaskChests}
              friends={friends}
              rooms={rooms}
              onOpenMe={() => {
                setMeDefaultTab('profile');
                setActiveSection('me');
              }}
              onOpenTopUp={() => {
                setMeDefaultTab('vip');
                setActiveSection('me');
              }}
              onOpenShop={() => {
                setMeDefaultTab('shop');
                setActiveSection('me');
              }}
              onOpenAdmin={openAdminConsole}
              onMarkNotificationsRead={handleMarkNotificationsRead}
              onBuyShopItem={handleBuyShopItem}
              onEquipShopItem={handleEquipShopItem}
              onJoinRoom={(roomId) => {
                if (handleSelectRoom(roomId)) {
                  setActiveSection('rooms');
                }
              }}
              onSeeAllRooms={() => {
                setClosedRoomNotice(null);
                setRoomUrlParam(null);
                setActiveRoomId(null);
                setActiveSection('rooms');
              }}
              onClaimTask={handleClaimTask}
              onClaimTaskChest={handleClaimTaskChest}
              onAddFriendByUid={handleAddFriendByUid}
              onInviteFriendToGame={handleInviteFriendToGame}
              onEarnCoins={() => {
                void hydrateBackendState();
              }}
              onInspectUser={inspectUserProfile}
              onInspectUserById={inspectUserById}
            />
          )}

          {activeSection === 'rooms' && (
            <VoiceRoomStage
              authToken={authToken}
              rooms={rooms}
              activeRoom={activeRoom}
              closedRoomNotice={closedRoomNotice}
              onDismissClosedRoomNotice={handleDismissClosedRoomNotice}
              onReopenRoom={handleReopenRoom}
              isAppAdmin={ADMIN_ROLES.has(userRole)}
              shopItems={shopItems}
              userUid={userProfile.publicId || userProfile.uid}
              userName={userProfile.name}
              coins={coins}
              charm={charm}
              vipLevel={effectiveVipLevel}
              hasCreatedRoom={hasCreatedRoom}
              roomTasks={roomTasks}
              gifts={allGifts}
              userSeatIndex={userSeatIndex}
              isMicMuted={isMicMuted}
              isLiveMicActive={isLiveMicActive}
              speakerEnabled={speakerEnabled}
              equippedBubbleColor={equippedBubbleColor}
              equippedBubbleId={equippedItems.bubble}
              equippedFrameId={equippedFrameId}
              equippedSeatEffect={equippedSeatEffect}
              ownedItemIds={ownedItemIds}
              vipEntryBanner={vipEntryBanner}
              relationshipTags={relationshipTags}
              outgoingPendingFriendUids={outgoingPendingFriendUids}
              roomVideoSync={roomVideoSync && roomVideoSync.roomId === activeRoom?.id ? roomVideoSync : null}
              onPurchaseActionTag={handlePurchaseActionTag}
              onRespondRelationshipTag={handleRespondRelationshipTag}
              onEndRelationshipTag={handleEndRelationshipTag}
              onUpdateActionRoom={(actionMode, slots) => {
                ogRealtime.send({ type: 'room:action-update', actionMode, slots });
              }}
              onSyncVideoRoom={(payload) => {
                ogRealtime.send({ type: 'room:video-sync', ...payload });
              }}
              onDismissVipEntry={() => setVipEntryBanner(null)}
              onOpenRingShop={() => {
                setMeDefaultTab('shop');
                setActiveSection('me');
              }}
              onSelectRoom={handleSelectRoom}
              onMinimizeRoom={() => setActiveSection('home')}
              onExitRoom={handleExitRoom}
              onOpenCreateRoom={() => setIsCreateModalOpen(true)}
              onJumpToMyRoom={() => {
                const myRoom = rooms.find(
                  (r) => r.isUserCreated || r.ownerUid === userProfile.uid || r.ownerUid === userProfile.publicId
                );
                if (myRoom && handleSelectRoom(myRoom.id)) {
                  setActiveSection('rooms');
                }
              }}
              onToggleRoomMember={handleToggleRoomMember}
              onUpdateRoomSettings={handleUpdateRoomSettings}
              onToggleAdmin={handleToggleAdmin}
              onKickUser={handleKickUser}
              onLiftUserToSeat={handleLiftUserToSeat}
              onToggleMuteByUid={handleToggleMuteByUid}
              onAddFriendByUid={handleAddFriendByUid}
              onJoinSeat={handleJoinSeat}
              onLeaveSeat={handleLeaveSeat}
              onToggleMicMute={() => {
                setIsMicMuted((m) => {
                  const next = !m;
                  ogRealtime.setMicMuted(next);
                  return next;
                });
              }}
              onToggleSpeaker={handleToggleSpeaker}
              onToggleLockSeat={handleToggleLockSeat}
              onToggleMuteSeat={handleToggleMuteSeat}
              onSendMessage={handleSendMessage}
              onSendEmote={handleSendEmote}
              friends={friends}
              giftAnimationsEnabled={giftAnimationsEnabled}
              onToggleGiftAnimations={() => setGiftAnimationsEnabled((v) => !v)}
              onInviteFriendToRoom={handleInviteFriendToRoom}
              onSendGift={handleSendGift}
              onClaimRoomTask={handleClaimRoomTask}
              onInspectUser={inspectUserProfile}
              onMessageUser={handleMessageUser}
              onSendBackMessage={handleSendBackMessage}
              onSupportUser={handleSupportUser}
              onProposeCp={handleProposeCp}
              onTogglePkActive={handleTogglePkActive}
              onSetPkConfig={handleSetPkConfig}
              onStartPk={handleStartPk}
              onEndPk={handleEndPk}
              onJoinPkTeam={handleJoinPkTeam}
              onVotePkTeam={handleVotePkTeam}
              onReportUser={handleReportContent}
            />
          )}

          {activeSection === 'chat' && (
            <ChatSection
              threads={chatThreads}
              coins={coins}
              gifts={allGifts}
              userProfile={userProfile}
              authToken={authToken}
              equippedBubbleColor={equippedBubbleColor}
              equippedBubbleId={equippedItems.bubble}
              pendingFriendRequests={pendingFriendRequests}
              outgoingPendingFriendUids={outgoingPendingFriendUids}
              sharedMoments={sharedMoments}
              onSelectThread={handleSelectChatThread}
              onSendChatMessage={handleSendChatMessage}
              onSendGift={handleSendGift}
              onJoinFriendVoiceRoom={handleJoinFriendVoiceRoom}
              onAddFriendByUid={handleAddFriendByUid}
              onCancelFriendRequest={handleCancelFriendRequest}
              onRespondFriendRequest={handleRespondFriendRequest}
              onUnfriendUser={handleUnfriendUser}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              onLoadOlderMessages={handleLoadOlderMessages}
              hasMoreMessagesByUid={hasMoreMessagesByUid}
              onInspectUserById={inspectUserById}
              onReportUser={(uid, _name, reason) => handleReportContent('user', uid, reason)}
            />
          )}

          {activeSection === 'discover' && (
            <DiscoverSection
              moments={moments}
              rooms={rooms}
              friends={friends}
              ownedItemIds={ownedItemIds}
              shopItems={shopItems}
              events={events}
              authToken={authToken}
              onToggleLikeMoment={handleToggleLikeMoment}
              onAddMoment={handleAddMoment}
              onInspectUser={inspectUserProfile}
              onProposeCp={handleProposeCp}
              onOpenRingShop={() => {
                setMeDefaultTab('shop');
                setActiveSection('me');
              }}
              onJoinRoom={(roomId) => {
                if (handleSelectRoom(roomId)) {
                  setActiveSection('rooms');
                }
              }}
              onJoinEvent={handleJoinEvent}
              onReportContent={handleReportContent}
              onClaimGiftPack={() => {
                setActiveSection('home');
                showToast('Complete Daily Tasks on Home to earn verified coins.');
              }}
            />
          )}

          {activeSection === 'me' && (
            <MeProfileShop
              key={`me-${meDefaultTab}`}
              authToken={authToken}
              userProfile={userProfile}
              coins={coins}
              charm={charm}
              vipGrowth={vipGrowth}
              vipLevel={effectiveVipLevel}
              vipEarnedLevel={vipEarnedLevel}
              vipStatus={vipStatus}
              vipLabel={vipLabel}
              vipExpiresAt={vipExpiresAt}
              vipGraceEndsAt={vipGraceEndsAt}
              vipNextDecayAt={vipNextDecayAt}
              vipInGracePeriod={vipInGracePeriod}
              vipGraceDays={vipGraceDays}
              vipDecayConfig={vipDecayConfig}
              vipPointLedger={vipPointLedger}
              vipSubscriptionHistory={vipSubscriptionHistory}
              giftsReceivedCount={giftsReceivedCount}
              accountStatus={accountStatus}
              ownedItemIds={ownedItemIds}
              ownedItemExpiries={ownedItemExpiries}
              equippedItems={equippedItems}
              shopItems={shopItems}
              referralSummary={referralSummary}
              moments={moments}
              rooms={rooms}
              friends={friends}
              cpRequests={cpRequests}
              cpRelationshipHistory={cpRelationshipHistory}
              customGifts={customGifts}
              receivedGiftIds={receivedGiftIds}
              vipPackages={vipPackages}
              coinPackages={coinPackages}
              orders={orders}
              walletFrozen={walletFrozen}
              themeMode={themeMode}
              walletTransactions={walletTransactions}
              defaultTab={meDefaultTab}
              giftAnimationsEnabled={giftAnimationsEnabled}
              onToggleGiftAnimations={() => setGiftAnimationsEnabled((v) => !v)}
              onToggleThemeMode={() => {
                const next = themeMode === 'dark' ? 'light' : 'dark';
                handleUpdateProfile({ themeMode: next });
              }}
              onUpdateProfile={handleUpdateProfile}
              onCreatePaymentOrder={handleCreatePaymentOrder}
              onReopenOrderModal={handleReopenOrderModal}
              onBuyCoins={handleBuyCoins}
              onBuyVip={handleBuyVip}
              onBuyShopItem={handleBuyShopItem}
              onEquipShopItem={handleEquipShopItem}
              onJoinRoom={(roomId) => {
                if (handleSelectRoom(roomId)) {
                  setActiveSection('rooms');
                }
              }}
              onProposeCp={handleProposeCp}
              onRespondCpRequest={handleRespondCpRequest}
              onBreakCp={handleBreakCp}
              onSubmitCustomGift={handleSubmitCustomGift}
              onClaimReferralCode={handleClaimReferralCode}
              onInviteFriendApp={handleInviteFriendApp}
              onInspectUser={inspectUserProfile}
              onInspectUserById={inspectUserById}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* Floating Minimized Voice Room Pill */}
      {activeRoom && activeSection !== 'rooms' && (
        <div className="fixed bottom-[76px] left-1/2 z-40 -translate-x-1/2">
          <div
            onClick={() => setActiveSection('rooms')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveSection('rooms');
              }
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-full border border-cyan-400/30 bg-[#0D1526]/95 py-1.5 pr-1.5 pl-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.75)] backdrop-blur-md transition hover:border-cyan-400/60"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
            <Headphones className="h-4 w-4 shrink-0 text-cyan-300" />
            <span className="max-w-[170px] truncate text-xs font-extrabold tracking-wide text-white uppercase">
              {activeRoom.title}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleExitRoom();
              }}
              aria-label="Exit Voice Room"
              title="Exit Voice Room"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-rose-400/50 hover:bg-rose-500/25 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {!(activeSection === 'rooms' && activeRoom) && (
        <BottomNav
          activeSection={activeSection}
          unreadChats={unreadChats}
          onNavigate={(section) => {
            if (section === 'me') setMeDefaultTab('profile');
            if (section === 'rooms' && activeSection === 'rooms') {
              handleExitRoom();
            }
            setActiveSection(section);
          }}
        />
      )}

      <GiftStageCanvas
        activeEvent={giftAnimationsEnabled ? activeGiftEvent : null}
        supportRingEvent={giftAnimationsEnabled ? supportRingEvent : null}
      />

      <UserProfileModal
        key={inspectedUser?.avatar.uid ?? 'none'}
        profile={inspectedUser}
        currentUserUid={userProfile.uid}
        ownedItemIds={ownedItemIds}
        shopItems={shopItems}
        onOpenRingShop={() => {
          setMeDefaultTab('shop');
          setActiveSection('me');
        }}
        onClose={() => setInspectedUser(null)}
        onInspectUser={inspectUserProfile}
        onInspectUserById={inspectUserById}
        onJoinRoom={(roomId) => {
          if (handleSelectRoom(roomId)) {
            setActiveSection('rooms');
          }
        }}
        onAddFriend={(uid) => handleAddFriendByUid(uid)}
        onCancelFriendRequest={(uid) => void handleCancelFriendRequest(uid)}
        onAcceptFriendRequest={(uid) => handleRespondByPeerUid(uid, true)}
        onDeclineFriendRequest={(uid) => handleRespondByPeerUid(uid, false)}
        onUnfriendUser={(uid) => handleUnfriendUser(uid, inspectedUser?.avatar.name || uid)}
        onBlockUser={(uid) => handleBlockUser(uid, inspectedUser?.avatar.name || uid)}
        onUnblockUser={(uid) => handleUnblockUser(uid, inspectedUser?.avatar.name || uid)}
        onMessageUser={handleMessageUser}
        onSupportUser={handleSupportUser}
        onProposeCp={handleProposeCp}
      />

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        coins={coins}
        authToken={authToken}
        hasCreatedRoom={hasCreatedRoom}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateRoom={handleCreateRoom}
      />

      <UpiPaymentModal
        activeOrder={activePaymentOrder}
        authToken={authToken}
        onClose={() => setActivePaymentOrder(null)}
        onProofSubmitted={(_order, message) => {
          setActivePaymentOrder(null);
          showToast(message);
          void hydrateBackendState();
        }}
      />

      {/* 4-Digit Room Passcode Unlock Modal */}
      {pendingLockedRoomId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPendingLockedRoomId(null)}
        >
          <form
            onSubmit={handleUnlockRoomSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl border border-amber-400/35 bg-[#0D1526] p-5 text-slate-100 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-white">Room Locked</h4>
                  <p className="text-[11px] text-slate-400">
                    Enter 4-digit passcode to enter
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingLockedRoomId(null)}
                aria-label="Close unlock prompt"
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pinEntry}
              onChange={(e) => {
                setPinEntry(e.target.value.replace(/\D/g, '').slice(0, 4));
                setPinError('');
              }}
              placeholder="••••"
              className="mt-4 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-center font-mono-tabular text-lg font-bold tracking-[0.5em] text-amber-300 outline-none focus:border-amber-400"
            />

            {pinError && <p className="mt-2 text-center text-[11px] text-rose-400">{pinError}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingLockedRoomId(null)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pinEntry.length !== 4}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-xs font-extrabold text-slate-950 disabled:opacity-40"
              >
                Unlock Room
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
