import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Edit3,
  Eye,
  FileText,
  Gamepad2,
  Gem,
  Gift,
  Heart,
  Image,
  Lock,
  LogOut,
  Mic,
  Moon,
  MoreVertical,
  Plus,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Upload,
  User,
  UserPlus,
  Video,
  Wand2,
  XCircle,
} from 'lucide-react';
import {
  CHARM_LEVELS,
  COIN_PACKAGES,
  CP_LEVELS,
  ROOM_LEVEL_INFO,
  SHOP_ITEMS,
  VIP_PLANS,
  VIP_TIERS,
  getCharmLevelInfo,
  getCountryFlag,
  getCpLevelInfo,
  getGenderSymbol,
  getVipNameStyle,
  getVipTierByGrowth,
} from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import { GiftArtwork } from '../graphics/GiftArtwork';
import {
  CharmBadgeArt,
  CharmBadgePill,
  RingSpriteArt,
  RoomLevelBadgeArt,
  SeatFrameSpriteArt,
  VipBadgeArt,
  ZayroCoinArt,
} from '../graphics/SpriteArtwork';
import type {
  AvatarConfig,
  BackendOrderRecord,
  BackendWalletTx,
  CpRelationshipHistoryRecord,
  CpRequest,
  CustomGiftSubmission,
  FriendRecord,
  MomentPost,
  PublicUserProfile,
  ReferralSummary,
  ShopCategory,
  ShopItem,
  VipDecayConfig,
  VipPointLedgerRecord,
  VipSubscriptionHistoryRecord,
  VirtualGift,
  VoiceRoom,
} from '../types';
import { uploadImageAsset, uploadVideoAsset } from '../utils/mediaUpload';
import { soundFx } from '../utils/soundFx';
import { CoupleHomeModal } from './CoupleHomeModal';

export type MeViewMode =
  | 'profile'
  | 'shop'
  | 'vip'
  | 'charm'
  | 'badges'
  | 'edit'
  | 'moments'
  | 'gifts'
  | 'visitors'
  | 'cp'
  | 'create-gift'
  | 'invite'
  | 'privacy';

interface MeProfileShopProps {
  authToken?: string | null;
  userProfile: AvatarConfig;
  coins: number;
  charm: number;
  vipGrowth: number;
  vipLevel: number;
  vipEarnedLevel?: number;
  vipStatus?: 'Not Active' | 'Active';
  vipLabel: string | null;
  vipExpiresAt?: string | null;
  vipGraceEndsAt?: string | null;
  vipNextDecayAt?: string | null;
  vipInGracePeriod?: boolean;
  vipGraceDays?: number;
  vipDecayConfig?: VipDecayConfig | null;
  vipPointLedger?: VipPointLedgerRecord[];
  vipSubscriptionHistory?: VipSubscriptionHistoryRecord[];
  giftsReceivedCount?: number;
  accountStatus?: 'Active' | 'Suspended';
  ownedItemIds: string[];
  ownedItemExpiries?: Record<string, number>;
  equippedItems: Partial<Record<ShopCategory, string>>;
  moments: MomentPost[];
  rooms: VoiceRoom[];
  friends?: FriendRecord[];
  cpRequests?: CpRequest[];
  cpRelationshipHistory?: CpRelationshipHistoryRecord[];
  customGifts?: CustomGiftSubmission[];
  receivedGiftIds: string[];
  vipPackages?: Array<{ id: string; name: string; priceInr: number; durationDays?: number; coinsIncluded?: number; vipLevel?: number; perks?: string[] }>;
  coinPackages?: Array<{ id: string; label: string; coins: number; priceInr: number; highlight?: string }>;
  orders?: BackendOrderRecord[];
  walletFrozen?: boolean;
  themeMode?: 'dark' | 'light';
  walletTransactions?: BackendWalletTx[];
  defaultTab?: MeViewMode;
  giftAnimationsEnabled?: boolean;
  onToggleGiftAnimations?: () => void;
  onToggleThemeMode?: () => void;
  onUpdateProfile: (updates: Partial<AvatarConfig>) => void;
  onCreatePaymentOrder?: (orderType: 'vip' | 'coins', packageId: string) => Promise<void>;
  onReopenOrderModal?: (order: BackendOrderRecord) => void;
  onBuyCoins: (packageId: string) => Promise<{ ok: boolean; message: string }>;
  onBuyVip: (planId: string) => Promise<{ ok: boolean; message: string }>;
  onBuyShopItem: (item: ShopItem) => void;
  onEquipShopItem: (item: ShopItem) => void;
  onJoinRoom: (roomId: string) => void;
  onInspectUser?: (profile: PublicUserProfile) => void;
  onInspectUserById?: (uid: string) => void;
  onProposeCp?: (
    toUid: string,
    toName: string,
    toAvatarId: string,
    ringNumber: number,
    ringName: string
  ) => void;
  onRespondCpRequest?: (requestId: string, accept: boolean) => void;
  onBreakCp?: () => void;
  shopItems?: ShopItem[];
  referralSummary?: ReferralSummary | null;
  onClaimReferralCode?: (code: string) => Promise<{ ok: boolean; message: string }>;
  onSubmitCustomGift?: (
    submission: Omit<CustomGiftSubmission, 'id' | 'creatorUid' | 'creatorName' | 'status' | 'submittedAt'>
  ) => void;
  onInviteFriendApp?: () => void;
  onLogout?: () => void;
}

function formatRemainingDuration(expiresAt?: number, durationDays?: number): string {
  if (expiresAt) {
    const diffMs = Math.max(0, expiresAt - Date.now());
    const totalHours = Math.floor(diffMs / 3_600_000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return '<1h left';
  }
  return durationDays ? `${durationDays} Days` : 'Permanent';
}

const ORNAMENTS: AvatarConfig['ornament'][] = [
  'crown',
  'lotus',
  'halo',
  'visor',
  'crescent',
  'flame',
];

export const MeProfileShop: React.FC<MeProfileShopProps> = ({
  authToken,
  userProfile,
  coins,
  charm,
  vipGrowth,
  vipLevel,
  vipEarnedLevel = 0,
  vipStatus = vipLevel > 0 ? 'Active' : 'Not Active',
  vipLabel,
  vipExpiresAt = null,
  vipGraceEndsAt = null,
  vipNextDecayAt = null,
  vipInGracePeriod = false,
  vipGraceDays = 15,
  vipDecayConfig = null,
  vipPointLedger = [],
  vipSubscriptionHistory = [],
  giftsReceivedCount,
  accountStatus = 'Active',
  ownedItemIds,
  ownedItemExpiries = {},
  equippedItems,
  moments,
  rooms,
  friends = [],
  cpRequests = [],
  cpRelationshipHistory = [],
  customGifts = [],
  receivedGiftIds,
  vipPackages,
  coinPackages,
  orders = [],
  walletFrozen = false,
  themeMode = 'dark',
  walletTransactions = [],
  defaultTab = 'profile',
  giftAnimationsEnabled = true,
  onToggleGiftAnimations,
  onToggleThemeMode,
  onUpdateProfile,
  onCreatePaymentOrder,
  onReopenOrderModal,
  onBuyCoins,
  onBuyVip,
  onBuyShopItem,
  onEquipShopItem,
  onJoinRoom,
  onInspectUser,
  onInspectUserById,
  onProposeCp,
  onRespondCpRequest,
  onBreakCp,
  shopItems,
  referralSummary = null,
  onClaimReferralCode,
  onSubmitCustomGift,
  onInviteFriendApp,
  onLogout,
}) => {
  const [activeView, setActiveView] = useState<MeViewMode>(defaultTab);
  const [shopCategory, setShopCategory] = useState<
    'ring' | 'decorations' | 'voice' | 'items' | 'inventory' | 'all'
  >('ring');
  const [nameInput, setNameInput] = useState(userProfile.name);
  const [handleInput, setHandleInput] = useState(userProfile.handle.replace(/^@/, ''));
  const [bioInput, setBioInput] = useState((userProfile.bio || '').slice(0, 100));
  const [genderInput, setGenderInput] = useState<'Male' | 'Female' | 'Other'>(
    userProfile.gender || 'Male'
  );
  const [ageInput, setAgeInput] = useState<number>(userProfile.age ?? 21);
  const [countryInput, setCountryInput] = useState<string>(userProfile.country || 'India');
  const [tagsInput, setTagsInput] = useState<string[]>(userProfile.tags ?? []);
  const [newTagDraft, setNewTagDraft] = useState('');
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [showCpPartnerId, setShowCpPartnerId] = useState(false);
  const [showRingCollection, setShowRingCollection] = useState(false);
  const [cpTargetUid, setCpTargetUid] = useState(friends[0]?.publicId || friends[0]?.uid || '');
  const [cpTargetNameDraft, setCpTargetNameDraft] = useState('');
  const [cpRingNumber, setCpRingNumber] = useState(1);
  const [copiedPartnerId, setCopiedPartnerId] = useState(false);
  const [copiedOwnId, setCopiedOwnId] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [ornamentInput, setOrnamentInput] = useState<AvatarConfig['ornament']>(
    userProfile.ornament
  );
  const [language, setLanguage] = useState('English');
  const [parentalMode, setParentalMode] = useState(false);
  const [hideOnlineStatus, setHideOnlineStatus] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [mediaUploadPct, setMediaUploadPct] = useState<number | null>(null);
  const [selectedVipPreview] = useState<number>(Math.max(1, vipLevel));
  const [coverIndex, setCoverIndex] = useState(0);

  // Create Gift Studio state
  const [cgName, setCgName] = useState('');
  const [cgCost, setCgCost] = useState(500);
  const [cgCharm, setCgCharm] = useState(500);
  const [cgDesc, setCgDesc] = useState('Custom sanctuary gift forged with starlight');
  const [cgPrimary, setCgPrimary] = useState('#22D3EE');
  const [cgSecondary, setCgSecondary] = useState('#FBBF24');
  const [cgParticle, setCgParticle] = useState<VirtualGift['particleStyle']>('heart');
  const [cgArtworkUrl, setCgArtworkUrl] = useState<string | undefined>(undefined);
  const [cgVideoUrl, setCgVideoUrl] = useState<string | undefined>(undefined);
  const [cgVideoName, setCgVideoName] = useState('');
  const [claimInviteInput, setClaimInviteInput] = useState('');
  const [claimingInvite, setClaimingInvite] = useState(false);
  const [claimInviteFeedback, setClaimInviteFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const COVER_GRADIENTS = [
    'radial-gradient(circle at 50% 35%, rgba(34,211,238,0.22), transparent 55%), linear-gradient(180deg, #070B14 0%, #0D1526 72%, #0A101D 100%)',
    'radial-gradient(circle at 25% 30%, rgba(20,184,166,0.34), transparent 55%), linear-gradient(155deg, #081A2E 0%, #0D1526 70%, #070B14 100%)',
    'radial-gradient(circle at 75% 25%, rgba(244,63,94,0.26), transparent 55%), linear-gradient(155deg, #16182E 0%, #0D1526 70%, #070B14 100%)',
  ];

  const openCpPartnerProfile = () => {
    if (!userProfile.cpPartner) return;
    const cp = userProfile.cpPartner;
    if (onInspectUserById) {
      onInspectUserById(cp.partnerUid);
      return;
    }
    if (!onInspectUser) return;
    onInspectUser({
      avatar: {
        id: cp.partnerAvatarId || 'av-neutral',
        uid: cp.partnerUid,
        name: cp.partnerName,
        handle: `@${cp.partnerName.toLowerCase().replace(/\s+/g, '')}`,
        photoUrl: cp.partnerPhotoUrl ?? undefined,
        skinTone: '#D69E76',
        hairColor: '#1E293B',
        robeColor: '#06B6D4',
        accentColor: '#A5F3FC',
        ornament: 'lotus',
        cpPartner: {
          partnerUid: userProfile.uid,
          partnerName: userProfile.name,
          partnerAvatarId: userProfile.id,
          ringNumber: cp.ringNumber,
          ringName: cp.ringName,
          since: cp.since,
          cpCharm: cp.cpCharm,
        },
      },
      vipLevel: 0,
      charm: cp.cpCharm ?? 0,
      cpPartner: {
        partnerUid: userProfile.uid,
        partnerName: userProfile.name,
        partnerAvatarId: userProfile.id,
        ringNumber: cp.ringNumber,
        ringName: cp.ringName,
        since: cp.since,
        cpCharm: cp.cpCharm,
      },
      ringNumber: cp.ringNumber,
    });
  };

  const catalogItems = shopItems && shopItems.length > 0 ? shopItems : SHOP_ITEMS;
  const { current: charmInfo, next: nextCharmInfo } = getCharmLevelInfo(charm);
  const isVipActive = vipStatus === 'Active';
  const { current: growthVipTier, next: nextVipTier } = getVipTierByGrowth(vipGrowth, isVipActive);
  const effectiveVipLevel = isVipActive ? Math.min(18, Math.max(vipLevel, growthVipTier.level)) : 0;
  const equippedRing = catalogItems.find((i) => i.id === equippedItems.ring);
  const equippedFrame = catalogItems.find((i) => i.id === equippedItems.frame);
  const ringCatalog = catalogItems.filter((i) => i.category === 'ring');
  const ownedRings = ringCatalog.filter((r) => ownedItemIds.includes(r.id));
  const selectedBondRing =
    ownedRings.find((r) => r.ringNumber === cpRingNumber) ?? ownedRings[0];

  const formattedCharm =
    charm >= 1_000_000
      ? `${(charm / 1_000_000).toFixed(1)}M`
      : charm.toLocaleString();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = handleInput.trim().replace(/^@+/, '');
    onUpdateProfile({
      name: nameInput.trim() || userProfile.name,
      handle: cleanHandle ? `@${cleanHandle}` : userProfile.handle,
      bio: bioInput.trim().slice(0, 100),
      gender: genderInput,
      age: Number.isFinite(ageInput) ? Math.max(13, Math.min(99, ageInput)) : 21,
      country: countryInput,
      tags: tagsInput.slice(0, 5),
      ornament: ornamentInput,
    });
    setSavedBanner(true);
    soundFx.playVictory();
    window.setTimeout(() => setSavedBanner(false), 2200);
  };

  const handleAvatarPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMediaUploadPct(10);
    setPurchaseNotice('Uploading profile photo...');
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 720,
        quality: 0.85,
        maxCompressedBytes: 550_000,
        onProgress: (pct) => setMediaUploadPct(pct),
      });
      onUpdateProfile({ photoUrl: uploadedUrl });
      setPurchaseNotice('Profile photo updated!');
      soundFx.playVictory();
    } catch (err) {
      setPurchaseNotice(err instanceof Error ? err.message : 'Could not upload photo. Please try again.');
    } finally {
      setMediaUploadPct(null);
    }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMediaUploadPct(10);
    setPurchaseNotice('Uploading profile cover photo...');
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 1440,
        quality: 0.85,
        maxCompressedBytes: 750_000,
        onProgress: (pct) => setMediaUploadPct(pct),
      });
      onUpdateProfile({ coverUrl: uploadedUrl });
      setPurchaseNotice('Profile cover photo updated!');
      soundFx.playVictory();
    } catch (err) {
      setPurchaseNotice(err instanceof Error ? err.message : 'Could not upload cover photo. Please try again.');
    } finally {
      setMediaUploadPct(null);
    }
  };

  const visibleShopItems = (
    shopCategory === 'inventory'
      ? catalogItems.filter((i) => ownedItemIds.includes(i.id))
      : shopCategory === 'all'
        ? catalogItems
        : shopCategory === 'ring'
          ? catalogItems.filter((i) => i.category === 'ring')
          : shopCategory === 'decorations'
            ? catalogItems.filter((i) => i.category === 'frame')
            : shopCategory === 'voice'
              ? catalogItems.filter(
                  (i) =>
                    i.category === 'entry' ||
                    i.category === 'seat-fx' ||
                    i.category === 'room-theme'
                )
              : catalogItems.filter((i) => i.category === 'seat-fx' || i.category === 'room-theme')
  )
    .slice()
    .sort((a, b) => (a.ringNumber ?? 999) - (b.ringNumber ?? 999));

  const previewVipInfo = VIP_TIERS.find((v) => v.level === selectedVipPreview) ?? VIP_TIERS[1];

  return (
    <div className="space-y-5">
      {/* Sub-view Back Header (hidden on Shop & Edit Profile which have dedicated headers) */}
      {activeView !== 'profile' && activeView !== 'shop' && activeView !== 'edit' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-[#0D1526] px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveView('profile')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Profile</span>
          </button>

          <div className="flex items-center gap-2 font-mono-tabular text-xs font-bold text-amber-300">
            <ZayroCoinArt size={18} />
            <span>{coins.toLocaleString()} Coins</span>
          </div>
        </div>
      )}

      {walletFrozen && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-400/50 bg-rose-500/15 px-4 py-3 text-xs font-bold text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
          <span>
            Wallet Frozen by Admin Moderation — Gift sending and Shop purchases are temporarily suspended. Contact Super Admin support for review.
          </span>
        </div>
      )}

      {purchaseNotice && (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-200">
          <div>{purchaseNotice}</div>
          {mediaUploadPct !== null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-emerald-400 transition-all duration-200"
                style={{ width: `${mediaUploadPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Default Profile Hub */}
      {activeView === 'profile' && (() => {
        const myCpCharm = userProfile.cpPartner?.cpCharm ?? 0;
        const myCpLvl = getCpLevelInfo(myCpCharm);
        return (
        <div className="space-y-5">
          {/* Top Cover Banner */}
          <section className="overflow-visible rounded-3xl border border-cyan-500/15 bg-[#0D1526]">
            <div
              className="relative h-48 w-full overflow-hidden rounded-t-3xl bg-cover bg-center"
              style={
                userProfile.coverUrl
                  ? { backgroundImage: `linear-gradient(to bottom, rgba(7,11,20,0.22), rgba(7,11,20,0.78)), url(${userProfile.coverUrl})` }
                  : { background: COVER_GRADIENTS[coverIndex % COVER_GRADIENTS.length] }
              }
            >
              <div className="flex items-center justify-between px-4 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveView('edit')}
                  aria-label="Edit Profile"
                  className="flex h-10 items-center gap-1.5 rounded-full bg-black/45 px-3.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/65"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
                <div className="flex items-center gap-2">
                  <label
                    title="Upload Cover Photo"
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-black/50 px-3 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-black/75"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Cover</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverPhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setCoverIndex((c) => c + 1)}
                    title="Cycle Cover Theme"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/70"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('privacy')}
                    aria-label="Settings & Privacy"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/70"
                  >
                    <MoreVertical className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Rose Frosted Ring / Couple Pill -> Shown ONLY when user has an active CP partner */}
              {userProfile.cpPartner && (() => {
                const cp = userProfile.cpPartner;
                const cpAv: AvatarConfig = {
                  ...userProfile,
                  id: cp.partnerAvatarId || 'av-neutral',
                  uid: cp.partnerUid,
                  name: cp.partnerName,
                  photoUrl: cp.partnerPhotoUrl ?? undefined,
                };
                return (
                  <button
                    type="button"
                    onClick={() => setShowRingCollection(true)}
                    className="absolute right-3 bottom-3 flex items-center gap-2 rounded-2xl border border-rose-200/35 bg-gradient-to-r from-[#E6859C]/90 via-[#EE9BAE]/88 to-[#F3B0BF]/85 px-2.5 py-1.5 shadow-xl backdrop-blur-md transition-transform hover:scale-105"
                    title="View Ring Collection & Couple Home"
                  >
                    <RingSpriteArt
                      ringNumber={cp.ringNumber}
                      size={38}
                      alt="CP Ring"
                    />
                    <div className="text-left leading-tight">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-white/95">
                        <Heart className="h-2.5 w-2.5 fill-white text-white" />
                        <span>CP Love</span>
                      </div>
                      <div className="font-mono-tabular text-xs font-extrabold text-white">
                        {(cp.cpCharm ?? userProfile.blessing ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-full border border-white/80 bg-[#1B1226]">
                      <AvatarArt avatar={cpAv} size={32} />
                    </div>
                  </button>
                );
              })()}
            </div>

            <div className="px-5 pb-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="relative -mt-12 inline-block overflow-visible">
                  <div
                    className={
                      equippedFrame
                        ? 'relative overflow-visible'
                        : 'rounded-full border-2 border-white/25 bg-[#0D1526] p-0.5'
                    }
                    style={
                      equippedFrame && !equippedItems.frame?.startsWith('frame-fire') && !equippedItems.frame?.startsWith('frame-ice') && !equippedItems.frame?.startsWith('frame-flower') && !equippedItems.frame?.startsWith('frame-chair') && !equippedItems.frame?.startsWith('frame-room')
                        ? { filter: `drop-shadow(0 0 12px ${equippedFrame.previewColor})` }
                        : undefined
                    }
                  >
                    <AvatarArt
                      avatar={userProfile}
                      size={82}
                      frameId={equippedItems.frame}
                      frameImageUrl={equippedFrame?.imageUrl}
                    />
                  </div>
                  <label
                    title="Upload Real Profile Photo"
                    aria-label="Upload Real Profile Photo"
                    className="absolute right-0.5 bottom-0.5 z-30 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-[#0D1526] bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarPhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveView('vip')}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-[#132038] px-4 py-2 font-mono-tabular text-xs font-bold text-amber-300 hover:border-amber-400/60"
                >
                  <ZayroCoinArt size={18} />
                  <span>{coins.toLocaleString()}</span>
                </button>
              </div>

              {/* Gender (left of name) + Bold VIP-Colored Name + VIP Badge */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="text-base leading-none"
                  title={userProfile.gender || 'Male'}
                  aria-label={`Gender: ${userProfile.gender || 'Male'}`}
                >
                  {getGenderSymbol(userProfile.gender)}
                </span>
                <h1
                  className="font-display text-2xl font-black tracking-tight"
                  style={getVipNameStyle(effectiveVipLevel)}
                >
                  {userProfile.name}
                </h1>
                <VipBadgeArt level={effectiveVipLevel} size={30} />
              </div>

              {/* Metadata Row matching reference: ♂️ 21  🇮🇳 India • Online */}
              <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-300">
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <span>{getGenderSymbol(userProfile.gender)}</span>
                  <span className="font-mono-tabular text-slate-200">{userProfile.age ?? 21}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-slate-200">
                  <span>{getCountryFlag(userProfile.country)}</span>
                  <span>{userProfile.country || 'India'}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{hideOnlineStatus ? 'Hidden' : 'Online'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const idToCopy = userProfile.publicId || userProfile.uid;
                    navigator.clipboard?.writeText(idToCopy).catch(() => {});
                    setCopiedOwnId(true);
                    window.setTimeout(() => setCopiedOwnId(false), 1800);
                  }}
                  title="Copy User ID"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 font-mono-tabular text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-white"
                >
                  <span>ID: {userProfile.publicId || userProfile.uid}</span>
                  {copiedOwnId ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-cyan-300" />
                  )}
                </button>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {accountStatus}
                </span>
              </div>

              {/* Charm Badge Pill + VIP Center + CP Level + All Badges */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveView('charm')}
                  className="inline-flex items-center transition-transform hover:scale-105"
                  title={`Charm Lv.${charmInfo.level} · ${charm.toLocaleString()}`}
                >
                  <CharmBadgePill level={charmInfo.level} charm={charm} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('vip')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#132038] px-3 py-1 text-xs font-bold text-amber-300"
                >
                  <VipBadgeArt level={effectiveVipLevel} size={22} />
                  <span style={effectiveVipLevel >= 12 ? getVipNameStyle(effectiveVipLevel) : undefined}>
                    {vipStatus === 'Active' && effectiveVipLevel > 0
                      ? vipLabel || `VIP ${effectiveVipLevel}`
                      : 'VIP 0 · Not Active'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('gifts')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/30 bg-[#132038] px-3 py-1 text-xs font-bold text-pink-200 hover:border-pink-400/60"
                >
                  <Gift className="h-3.5 w-3.5 text-pink-400" />
                  <span>Gifts {(giftsReceivedCount ?? receivedGiftIds.length).toLocaleString()}</span>
                </button>

                {userProfile.cpPartner ? (
                  <button
                    type="button"
                    onClick={() => setShowCpPartnerId((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200 hover:bg-rose-500/30"
                    title="Click CP to view Partner ID & Level"
                  >
                    <Heart className="h-2.5 w-2.5 fill-rose-400 text-rose-400" />
                    <span>
                      CP Lv.{myCpLvl.level} · {userProfile.cpPartner.partnerName}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveView('cp')}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-200 hover:bg-rose-500/20"
                  >
                    <Heart className="h-2.5 w-2.5 text-rose-300" />
                    <span>CP ({cpRequests.filter((r) => r.status === 'pending').length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveView('badges')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-[#132038] px-3 py-1 text-xs font-bold text-cyan-200 hover:border-cyan-400/65"
                >
                  <Award className="h-3.5 w-3.5 text-amber-300" />
                  <span>All Badges</span>
                </button>
              </div>

              {/* Clicking CP reveals Partner ID, Profile shortcut & CP Level Progress */}
              {userProfile.cpPartner && showCpPartnerId && (
                <div className="mt-3 space-y-2 rounded-2xl border border-rose-400/40 bg-gradient-to-r from-[#2D1426]/90 to-[#0B1A2E]/90 px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={openCpPartnerProfile}
                      className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-85"
                    >
                      <RingSpriteArt
                        ringNumber={userProfile.cpPartner.ringNumber}
                        size={34}
                        alt={userProfile.cpPartner.ringName}
                      />
                      <div>
                        <div className="font-bold text-rose-200">
                          CP Lv.{myCpLvl.level} ({myCpLvl.title}) · {userProfile.cpPartner.partnerName}
                        </div>
                        <div className="font-mono-tabular text-[11px] font-bold text-white">
                          Partner ID: {userProfile.cpPartner.partnerUid}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      {onInspectUser && (
                        <button
                          type="button"
                          onClick={openCpPartnerProfile}
                          className="rounded-xl bg-cyan-500 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-950 hover:bg-cyan-400"
                        >
                          View Profile
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(userProfile.cpPartner!.partnerUid).catch(() => {});
                          setCopiedPartnerId(true);
                          window.setTimeout(() => setCopiedPartnerId(false), 1800);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-500/25 px-2.5 py-1.5 text-[11px] font-bold text-rose-100 hover:bg-rose-500/40"
                      >
                        {copiedPartnerId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedPartnerId ? 'Copied' : 'Copy ID'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView('cp')}
                        className="rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/20"
                      >
                        Manage CP
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-mono-tabular text-[10px] text-rose-200">
                      <span>{myCpCharm.toLocaleString()} CP Charms</span>
                      <span>
                        {myCpLvl.nextMin !== null
                          ? `Need ${myCpLvl.stepRemaining.toLocaleString()} for Lv.${myCpLvl.level + 1}`
                          : 'Max CP Level'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300"
                        style={{ width: `${myCpLvl.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 4-Icon Quick Card Row: CP Life, Avatar, Shop, VIP Center */}
          <section className="grid grid-cols-4 gap-3 rounded-3xl border border-white/10 bg-[#0D1526] p-4 text-center">
            <button
              type="button"
              onClick={() => setActiveView('cp')}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
                <Heart className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-slate-200">CP Life</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('edit')}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                <User className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-slate-200">Avatar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('shop')}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-slate-200">Shop</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('vip')}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-slate-200">VIP Center</span>
            </button>
          </section>

          {/* ACTIVITY List Section */}
          <section className="space-y-2">
            <h2 className="px-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              ACTIVITY
            </h2>
            <div className="divide-y divide-white/5 overflow-hidden rounded-3xl border border-white/10 bg-[#0D1526]">
              <button
                type="button"
                onClick={() => setActiveView('moments')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                    <Image className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Moments</div>
                    <div className="text-xs text-slate-400">Share your sanctuary journey</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('gifts')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Gift Wall &amp; Rings</div>
                    <div className="text-xs text-slate-400">
                      Showcased gifts ({receivedGiftIds.length}) &amp; joined rooms
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('badges')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">All Badges Gallery</div>
                    <div className="text-xs text-slate-400">
                      View all VIP (Lv.1–18), Charm (Lv.1–21) &amp; Room Badges
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('charm')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Stats &amp; Charm</div>
                    <div className="text-xs text-slate-400">
                      Charm Lv.{charmInfo.level} ·{' '}
                      {nextCharmInfo
                        ? `Need ${(nextCharmInfo.minCharm - charm).toLocaleString()} for Lv.${nextCharmInfo.level}`
                        : 'Max Charm Tier'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('create-gift')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                    <Wand2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Create Gift</div>
                    <div className="text-xs text-slate-400">
                      Upload custom gift animation videos &amp; track Approval queue
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {customGifts.some((g) => g.status === 'pending') && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 font-mono-tabular text-[10px] font-extrabold text-slate-950">
                      {customGifts.filter((g) => g.status === 'pending').length} Pending
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('visitors')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Visitors</div>
                    <div className="text-xs text-slate-400">Profile visit tracking</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
              </button>
            </div>
          </section>

          {/* MORE Section */}
          <section className="space-y-2">
            <h2 className="px-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              MORE
            </h2>
            <div className="divide-y divide-white/5 overflow-hidden rounded-3xl border border-white/10 bg-[#0D1526]">

              <button
                type="button"
                onClick={() => setActiveView('invite')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Invite Friend</div>
                    <div className="text-xs text-slate-400">
                      Share invite code {referralSummary?.inviteCode || `OGV-${userProfile.publicId || userProfile.uid}`} &amp; earn +25,000 Coins each
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('privacy')}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      Privacy, Language &amp; Security
                    </div>
                    <div className="text-xs text-slate-400">
                      {language} · Parental control &amp; visibility settings
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </section>
        </div>
        );
      })()}

      {/* SUB-VIEW: Obsidian-Teal & Golden ZAYRO Shop */}
      {activeView === 'shop' && (
        <div
          className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-cyan-400/45 shadow-[0_0_40px_rgba(6,182,212,0.28)]"
          style={{
            background:
              'radial-gradient(circle at 50% 14%, rgba(34,211,238,0.24) 0%, rgba(11,26,46,0.96) 48%, #060D1A 100%)',
          }}
        >
          {/* Top Header: Back < + Winged Golden "Shop" + Golden Bag */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <button
              type="button"
              onClick={() => setActiveView('profile')}
              aria-label="Back to Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/50 bg-[#0B1A2E]/90 text-white shadow-[0_0_14px_rgba(34,211,238,0.35)] hover:bg-cyan-500/25"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>

            <div className="relative flex flex-col items-center">
              <Crown className="-mb-1 h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-teal-300" />
                <h2 className="font-display bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-2xl font-black tracking-wide text-transparent drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
                  Shop
                </h2>
                <span className="h-1.5 w-6 rounded-full bg-gradient-to-l from-transparent via-cyan-400 to-teal-300" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShopCategory('inventory')}
              aria-label="My Inventory"
              title="My Inventory"
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-extrabold transition-colors ${
                shopCategory === 'inventory'
                  ? 'border-amber-300 bg-amber-400 text-slate-950 shadow-[0_0_14px_rgba(251,191,36,0.6)]'
                  : 'border-amber-400/45 bg-[#2A1712]/80 text-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.4)] hover:bg-amber-500/20'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Inventory</span>
            </button>
          </div>

          {/* Balance Strip */}
          <div className="mx-3 mt-1 flex items-center justify-between rounded-2xl border border-cyan-400/40 bg-[#07111F]/90 px-3.5 py-2 shadow-[0_0_16px_rgba(6,182,212,0.22)]">
            <span className="text-xs font-bold text-slate-200">Balance:</span>
            <div className="flex items-center gap-3 font-mono-tabular text-xs font-extrabold">
              <span className="inline-flex items-center gap-1 text-sky-300">
                <Gem className="h-3.5 w-3.5 text-sky-400" />
                <span>{vipGrowth.toLocaleString()}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-amber-300">
                <ZayroCoinArt size={15} />
                <span>
                  {coins >= 1_000_000
                    ? `${(coins / 1_000_000).toFixed(2)}M`
                    : coins >= 1_000
                      ? `${Math.round(coins / 1_000)}K`
                      : coins}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setActiveView('vip')}
                aria-label="Top Up Coins"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.7)] hover:scale-105"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mx-3 mt-2.5 flex items-center gap-1 overflow-x-auto pb-1">
            {(
              [
                {
                  id: 'ring',
                  label: 'Relationship',
                  icon: <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />,
                },
                {
                  id: 'decorations',
                  label: 'Decorations',
                  icon: <Gift className="h-3 w-3 text-cyan-300" />,
                },
                {
                  id: 'voice',
                  label: 'Voice Room',
                  icon: <Mic className="h-3 w-3 text-sky-300" />,
                },
                {
                  id: 'items',
                  label: 'Items',
                  icon: <Star className="h-3 w-3 fill-amber-300 text-amber-300" />,
                },
                {
                  id: 'inventory',
                  label: `My Inventory (${ownedItemIds.length})`,
                  icon: <ShoppingBag className="h-3 w-3 text-amber-300" />,
                },
                {
                  id: 'all',
                  label: 'All',
                  icon: <Gamepad2 className="h-3 w-3 text-teal-300" />,
                },
              ] as const
            ).map((cat) => {
              const active = shopCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setShopCategory(cat.id)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                    active
                      ? 'border border-cyan-300/80 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.55)]'
                      : 'border border-cyan-400/30 bg-[#0B1A2E]/90 text-slate-300 hover:text-white'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Golden Section Title Banner */}
          <div className="mx-5 mt-2 mb-3 flex items-center justify-center gap-2 rounded-full border border-amber-400/70 bg-gradient-to-r from-[#0B1A2E] via-[#152B47] to-[#0B1A2E] py-1.5 shadow-[0_0_18px_rgba(245,158,11,0.3)]">
            <Crown className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-display text-sm font-black tracking-wide text-amber-200">
              {shopCategory === 'ring'
                ? 'Rings Collection'
                : shopCategory === 'decorations'
                  ? 'Avatar & Seat Frames (3 Days)'
                  : shopCategory === 'voice'
                    ? 'Voice Room Effects'
                    : shopCategory === 'items'
                      ? 'Seat & Room Items'
                      : shopCategory === 'inventory'
                        ? 'My Inventory · Purchased Gear'
                        : 'All OG VELOCITY Gear'}
            </span>
            <Crown className="h-3.5 w-3.5 text-amber-300" />
          </div>

          {shopCategory === 'inventory' && visibleShopItems.length === 0 && (
            <div className="mx-3 mb-4 rounded-2xl border border-purple-400/30 bg-[#120D1E]/90 p-5 text-center text-xs text-slate-300">
              <p>You have not purchased any items yet. Buy rings, frames, or entry effects in the Shop to see them here.</p>
              <button
                type="button"
                onClick={() => setShopCategory('ring')}
                className="mt-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-xs font-extrabold text-slate-950"
              >
                Browse Rings
              </button>
            </div>
          )}

          {/* 3-Column Obsidian-Teal & Gold-Framed Item Cards */}
          <div className="grid grid-cols-3 gap-2.5 px-3 pb-3">
            {visibleShopItems.map((item) => {
              const owned = ownedItemIds.includes(item.id);
              const equipped = equippedItems[item.category] === item.id;
              const canAfford = coins >= item.priceCoins;
              const coinLabel =
                item.priceCoins >= 1_000_000
                  ? `${item.priceCoins / 1_000_000}M Coin`
                  : `${Math.round(item.priceCoins / 1000)}K Coin`;

              const isRingOnly = !!item.ringNumber;
              return (
                <div
                  key={item.id}
                  className={
                    isRingOnly
                      ? 'relative flex flex-col items-center justify-between bg-transparent p-1.5 text-center'
                      : 'relative flex flex-col items-center justify-between overflow-hidden rounded-2xl border-2 border-amber-400/75 p-2 text-center shadow-[0_0_16px_rgba(6,182,212,0.28)]'
                  }
                  style={
                    isRingOnly
                      ? undefined
                      : {
                          background:
                            'radial-gradient(circle at 50% 42%, rgba(34,211,238,0.34) 0%, rgba(15,39,68,0.9) 58%, #07111F 100%)',
                        }
                  }
                >
                  <div className="line-clamp-1 w-full text-[9px] font-bold text-cyan-100/90">
                    {item.name}
                  </div>
                  {(shopCategory === 'inventory' || item.durationDays) && (
                    <span
                      className={`mt-0.5 rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase ${
                        item.durationDays
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {shopCategory === 'inventory'
                        ? formatRemainingDuration(ownedItemExpiries[item.id], item.durationDays)
                        : `${item.durationDays} Days`}
                    </span>
                  )}

                  {/* Transparent Cutouts for Rings & Seat Frames */}
                  <div className="my-1.5 flex h-18 items-center justify-center bg-transparent">
                    {item.ringNumber ? (
                      <RingSpriteArt
                        ringNumber={item.ringNumber}
                        size={70}
                        alt={item.name}
                        imageUrl={item.imageUrl}
                      />
                    ) : item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 rounded-xl object-contain"
                      />
                    ) : item.seatFrameNumber ? (
                      <SeatFrameSpriteArt
                        frameNumber={item.seatFrameNumber}
                        size={64}
                        alt={item.name}
                      />
                    ) : item.category === 'frame' ? (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full border-3 text-base"
                        style={{
                          borderColor: item.previewColor,
                          boxShadow: `0 0 14px ${item.previewColor}88`,
                        }}
                      >
                        {item.styleVariant === 'fire'
                          ? '🔥'
                          : item.styleVariant === 'ice'
                            ? '❄️'
                            : item.styleVariant === 'flower'
                              ? '🌸'
                              : item.styleVariant === 'chair'
                                ? '🪑'
                                : item.styleVariant === 'room'
                                  ? '🏛️'
                                  : '✨'}
                      </div>
                    ) : item.category === 'entry' ? (
                      <span className="text-3xl">
                        {item.styleVariant === 'car'
                          ? '🏎️'
                          : item.styleVariant === 'river'
                            ? '🌊'
                            : item.styleVariant === 'golden-palace'
                              ? '🏛️'
                              : item.styleVariant === 'throne'
                                ? '👑'
                                : item.styleVariant === 'crab'
                                  ? '🦀'
                                  : '🔥'}
                      </span>
                    ) : (
                      <Sparkles className="h-8 w-8" style={{ color: item.previewColor }} />
                    )}
                  </div>

                  {owned ? (
                    <button
                      type="button"
                      onClick={() => {
                        onEquipShopItem(item);
                        setPurchaseNotice(`Equipped ${item.name}!`);
                      }}
                      className={`w-full rounded-full border py-1 text-[10px] font-extrabold ${
                        equipped
                          ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                          : 'border-cyan-300/50 bg-[#0B1A2E]/90 text-white hover:bg-cyan-500/30'
                      }`}
                    >
                      {equipped ? 'Equipped' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        onBuyShopItem(item);
                        setPurchaseNotice(`Unlocked ${item.name}!`);
                      }}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-amber-400/70 bg-[#07111F]/90 py-1 font-mono-tabular text-[10px] font-extrabold text-white hover:bg-amber-500/25 disabled:opacity-45"
                    >
                      <ZayroCoinArt size={12} />
                      <span>{coinLabel}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Sticky YOU Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-cyan-400/40 bg-gradient-to-r from-[#0B1A2E] via-[#132B4A] to-[#0B1A2E] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="text-center leading-tight">
                <div className="text-[10px] font-extrabold text-cyan-200">YOU</div>
                <div className="font-mono-tabular text-xs font-black text-white">#500+</div>
              </div>
              <div className="overflow-visible rounded-full border-2 border-cyan-400 p-0.5">
                <AvatarArt avatar={userProfile} size={32} frameId={equippedItems.frame} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <VipBadgeArt level={effectiveVipLevel} size={16} />
                  <span
                    className="truncate text-xs font-bold"
                    style={getVipNameStyle(effectiveVipLevel)}
                  >
                    {userProfile.name}
                  </span>
                </div>
                <div className="font-mono-tabular text-[10px] text-slate-200">
                  Charm {charm.toLocaleString()}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('vip')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.55)] hover:opacity-95"
            >
              <Gift className="h-3.5 w-3.5" />
              <span>Get gifts</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-VIEW: VIP Center & Official Permanent Merchant UPI Checkout + Wallet Ledger */}
      {activeView === 'vip' && (() => {
        const displayVipPlans = (vipPackages && vipPackages.length > 0 ? vipPackages : VIP_PLANS).map((p) => {
          const dDays = 'durationDays' in p && p.durationDays ? Number(p.durationDays) : undefined;
          return {
            id: p.id,
            name: p.name,
            priceInr: p.priceInr,
            durationDays: dDays,
            perks:
              'perks' in p && Array.isArray(p.perks) && p.perks.length > 0
                ? p.perks
                : [
                    'Starts at VIP 1 (or preserves existing earned VIP tier)',
                    dDays ? `${dDays.toLocaleString()} Days Membership Validity` : 'Verified Membership Validity',
                    'Earn 1 VIP Point per 100 Coins spent on eligible gifts',
                  ],
          };
        });
        const displayCoinPacks = coinPackages && coinPackages.length > 0 ? coinPackages : COIN_PACKAGES;
        const expiryMs = vipExpiresAt ? new Date(vipExpiresAt).getTime() : 0;
        const daysUntilExpiry = expiryMs > Date.now() ? Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000)) : 0;
        const isExpiringSoon = vipStatus === 'Active' && expiryMs > 0 && daysUntilExpiry <= 7;
        const graceEndsFormatted = vipGraceEndsAt ? new Date(vipGraceEndsAt).toLocaleDateString() : null;
        const nextDecayFormatted = vipNextDecayAt ? new Date(vipNextDecayAt).toLocaleDateString() : null;
        const expiresFormatted = vipExpiresAt ? new Date(vipExpiresAt).toLocaleDateString() : null;
        const decayActiveAfterGrace = vipStatus !== 'Active' && !vipInGracePeriod && vipGrowth > 0 && Boolean(vipExpiresAt);

        return (
        <div className="space-y-6">
          <div className="rounded-3xl border border-amber-400/25 bg-[#0D1526] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  My Membership · VIP Levels (Lv. 1 – 15)
                </h2>
                <p className="text-xs text-slate-400">
                  Earn <strong className="text-amber-300">1 VIP Point per 100 Coins</strong> spent on eligible gifts while your VIP subscription is Active. All subscriptions start at VIP 1.
                </p>
              </div>
              <VipBadgeArt level={effectiveVipLevel} size={50} />
            </div>

            {/* VIP Expiry / Grace / Decay Alerts */}
            {isExpiringSoon && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-xs text-amber-200">
                <span>
                  Your VIP subscription expires in <strong>{daysUntilExpiry} day(s)</strong> ({expiresFormatted}). Renew early to extend validity and prevent point decay!
                </span>
              </div>
            )}
            {vipStatus !== 'Active' && vipInGracePeriod && vipGrowth > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-xs text-cyan-200">
                <span>
                  <strong>Grace Period Active ({vipGraceDays} days):</strong> Your VIP expired on {expiresFormatted || 'recently'}. Point decay is paused until <strong>{graceEndsFormatted}</strong> (Next decay: {nextDecayFormatted}). Renew to stop decay and restore VIP {Math.max(1, vipEarnedLevel || 1)}.
                </span>
              </div>
            )}
            {decayActiveAfterGrace && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-400/45 bg-rose-500/15 px-4 py-2.5 text-xs text-rose-200">
                <span>
                  <strong>VIP Point Decay Active:</strong> Grace period ended ({graceEndsFormatted}). Remaining {vipGrowth.toLocaleString()} VIP points decay daily ({vipDecayConfig?.mode === 'percent' ? `${vipDecayConfig.dailyPercent}%/day` : `${vipDecayConfig?.dailyAmount ?? 50} pts/day`}). Renew any VIP plan to stop decay immediately!
                </span>
              </div>
            )}

            {/* Status Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#132038] p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">VIP Status</div>
                <div className={`mt-1 text-sm font-extrabold ${vipStatus === 'Active' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {vipStatus}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#132038] p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">VIP Level</div>
                <div className="mt-1 font-mono-tabular text-sm font-extrabold text-amber-300">
                  {vipStatus === 'Active'
                    ? `VIP ${effectiveVipLevel}`
                    : vipEarnedLevel > 0
                      ? `Inactive (Saved Lv.${vipEarnedLevel})`
                      : 'VIP 0'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#132038] p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</div>
                <div className="mt-1 font-mono-tabular text-xs font-bold text-white">
                  {expiresFormatted || 'No Active Plan'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#132038] p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Grace / Next Decay</div>
                <div className="mt-1 font-mono-tabular text-[11px] font-bold text-cyan-200">
                  {vipStatus === 'Active'
                    ? `${vipGraceDays}d grace after expiry`
                    : nextDecayFormatted
                      ? `Decay: ${nextDecayFormatted}`
                      : `${vipGraceDays}d grace`}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between font-mono-tabular text-xs text-amber-300">
                <span>
                  {vipStatus === 'Active'
                    ? `Current VIP ${effectiveVipLevel} Points: ${vipGrowth.toLocaleString()}`
                    : `Saved VIP Points: ${vipGrowth.toLocaleString()} ${vipEarnedLevel > 0 ? `(Tier Lv.${vipEarnedLevel})` : ''}`}
                </span>
                {nextVipTier && (
                  <span className="text-slate-400">
                    Next VIP {nextVipTier.level}: {nextVipTier.minGrowth.toLocaleString()} pts
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                  style={{
                    width: `${
                      vipStatus !== 'Active'
                        ? 0
                        : nextVipTier
                          ? Math.min(100, Math.max(6, Math.round((vipGrowth / nextVipTier.minGrowth) * 100)))
                          : 100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Entrance Effect Preview Banner */}
            <div
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
              style={{
                borderColor: `${previewVipInfo.accentColor}66`,
                background: `linear-gradient(90deg, ${previewVipInfo.accentColor}22, rgba(7,11,20,0.95))`,
              }}
            >
              <div className="flex items-center gap-3">
                <VipBadgeArt level={previewVipInfo.level} size={40} />
                <div>
                  <div className="text-xs font-semibold">
                    <span className="text-amber-300">Entrance Preview · </span>
                    <span style={getVipNameStyle(previewVipInfo.level)}>{previewVipInfo.title}</span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {userProfile.name} entered
                  </div>
                  <div className="text-[11px] text-slate-300">{previewVipInfo.perk}</div>
                </div>
              </div>
              <div className="font-mono-tabular text-xs text-amber-200">
                {previewVipInfo.minGrowth.toLocaleString()} Pts
              </div>
            </div>
          </div>

          {/* VIP Subscriptions (Permanent UPI Checkout) */}
          <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">VIP Subscriptions (INR · UPI)</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Every package activates at VIP 1 (or extends your current membership validity while preserving earned VIP progression).
                </p>
              </div>
              <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-200">
                All Packages Start at VIP 1
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {displayVipPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between rounded-2xl border border-amber-400/30 bg-[#132038] p-5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-xl font-bold text-white">{plan.name}</h3>
                        <span className="text-[11px] font-semibold text-cyan-300">
                          Starts at VIP 1{plan.durationDays ? ` · ${plan.durationDays} Days` : ''}
                        </span>
                      </div>
                      <span className="font-mono-tabular text-lg font-bold text-amber-300">
                        ₹{plan.priceInr} INR
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                      {plan.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (onCreatePaymentOrder) {
                        await onCreatePaymentOrder('vip', plan.id);
                      } else {
                        const result = await onBuyVip(plan.id);
                        setPurchaseNotice(result.message);
                      }
                    }}
                    className="mt-5 w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    {vipStatus === 'Active' ? 'Renew / Extend' : 'Pay via UPI'} · ₹{plan.priceInr} INR
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* VIP Point Ledger & Subscription History */}
          {(vipPointLedger.length > 0 || vipSubscriptionHistory.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-5 shadow-xl">
                <h3 className="font-display text-base font-bold text-amber-300">VIP Point Ledger</h3>
                {vipPointLedger.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No VIP point transactions recorded yet.</p>
                ) : (
                  <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-xs">
                    {vipPointLedger.map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-xl bg-[#132038] px-3 py-2">
                        <div>
                          <div className="font-semibold text-white">{row.reason}</div>
                          <div className="text-[10px] text-slate-400">
                            {row.eventType} · {new Date(row.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right font-mono-tabular">
                          <div className={row.deltaPoints >= 0 ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>
                            {row.deltaPoints >= 0 ? `+${row.deltaPoints}` : row.deltaPoints} pts
                          </div>
                          <div className="text-[10px] text-slate-400">Bal: {row.pointsAfter.toLocaleString()} (Lv.{row.vipLevelAfter})</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-5 shadow-xl">
                <h3 className="font-display text-base font-bold text-cyan-300">VIP Subscription History</h3>
                {vipSubscriptionHistory.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No VIP subscriptions or grants recorded yet.</p>
                ) : (
                  <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-xs">
                    {vipSubscriptionHistory.map((h) => (
                      <div key={h.id} className="flex items-center justify-between rounded-xl bg-[#132038] px-3 py-2">
                        <div>
                          <div className="font-semibold text-white">
                            {h.packageName || h.actionType}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {h.reason || `${h.daysGranted} days`} · {new Date(h.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right font-mono-tabular">
                          <div className="font-bold text-amber-300">VIP {h.vipLevelAssigned}</div>
                          <div className="text-[10px] text-emerald-300">
                            {h.expiresAtAfter ? `Exp: ${new Date(h.expiresAtAfter).toLocaleDateString()}` : `${h.daysGranted}d`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coin Top-Up (Order-First UPI Checkout) */}
          <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Coin Top-Up (INR · UPI)
                </h2>
                <p className="text-xs text-slate-400">
                  Select a coin package to create an order and load the latest verified payment QR inside checkout.
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300">
                Order-First Verified UPI
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {displayCoinPacks.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex flex-col justify-between rounded-2xl border border-white/15 bg-[#132038] p-4"
                >
                  <div>
                    <div className="text-[11px] font-semibold text-amber-300">
                      {pkg.highlight || 'Coin Bundle'}
                    </div>
                    <div className="font-display mt-2 text-lg font-extrabold text-white">
                      {pkg.label}
                    </div>
                    <div className="mt-1 font-mono-tabular text-xs text-slate-400">
                      {Number(pkg.coins).toLocaleString()} Coins
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (onCreatePaymentOrder) {
                        await onCreatePaymentOrder('coins', pkg.id);
                      } else {
                        const result = await onBuyCoins(pkg.id);
                        setPurchaseNotice(result.message);
                      }
                    }}
                    className="mt-4 w-full rounded-xl bg-amber-500 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    Pay ₹{pkg.priceInr}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Orders Status Tracker */}
          {orders.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-6 shadow-xl">
              <h3 className="font-display text-lg font-bold text-white">My UPI Payment Orders</h3>
              <div className="mt-3 space-y-2">
                {orders.map((ord) => (
                  <div
                    key={ord.orderId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#132038] px-4 py-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {ord.packageName} · ₹{ord.amountInr} INR
                      </div>
                      <div className="font-mono-tabular text-[11px] text-slate-400">
                        {ord.orderId}
                        {ord.utrNumber ? ` · UTR: ${ord.utrNumber}` : ''}
                      </div>
                      {ord.reviewNote && (
                        <div className="mt-0.5 text-[11px] text-rose-300">Note: {ord.reviewNote}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                          ord.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : ord.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300'
                              : ord.status === 'pending_review'
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-cyan-500/20 text-cyan-200'
                        }`}
                      >
                        {ord.status.replace('_', ' ')}
                      </span>
                      {ord.status === 'pending_proof' && onReopenOrderModal && (
                        <button
                          type="button"
                          onClick={() => onReopenOrderModal(ord)}
                          className="rounded-xl bg-cyan-500 px-3 py-1.5 text-[11px] font-extrabold text-slate-950"
                        >
                          Submit UTR
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wallet Transaction Ledger */}
          <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-white">Wallet Ledger</h3>
            <div className="zayro-scroll mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {walletTransactions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No wallet transactions yet.</p>
                ) : (
                  walletTransactions.map((tx) => (
                    <div
                      key={tx.txId}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#132038] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{tx.description}</div>
                        <div className="font-mono-tabular text-[10px] text-slate-400">
                          {tx.txId} · Balance: {Number(tx.balanceAfter).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-mono-tabular font-extrabold ${
                          tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUB-VIEW: Charm Levels (Lv. 1 - 21) & Joined Rooms */}
      {activeView === 'charm' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-rose-400/25 bg-[#0D1526] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Charm Levels (Lv. 1 – 21 · Star to 20 Crowns)
                </h2>
                <p className="text-xs text-slate-400">
                  Current: {charm.toLocaleString()} Charm ·{' '}
                  {nextCharmInfo
                    ? `Need ${(nextCharmInfo.minCharm - charm).toLocaleString()} for Lv.${nextCharmInfo.level}`
                    : 'Max Charm Level Achieved'}
                </p>
              </div>
              <CharmBadgeArt level={charmInfo.level} size={52} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
              {CHARM_LEVELS.map((tier) => {
                const unlocked = charm >= tier.minCharm;
                const isCurrent = charmInfo.level === tier.level;
                return (
                  <div
                    key={tier.level}
                    className={`flex flex-col items-center rounded-2xl border p-3 text-center ${
                      isCurrent
                        ? 'border-rose-400 bg-rose-500/15'
                        : unlocked
                          ? 'border-white/15 bg-[#132038]'
                          : 'border-white/5 bg-[#070B14] opacity-60'
                    }`}
                  >
                    <CharmBadgeArt level={tier.level} size={48} />
                    <div className="mt-1.5 text-xs font-bold text-white">Lv.{tier.level}</div>
                    <div className="text-[10px] text-slate-400">{tier.series}</div>
                    <div className="mt-0.5 font-mono-tabular text-[11px] font-semibold text-rose-300">
                      {tier.minCharm.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-6">
            <h3 className="font-display text-xl font-bold text-white">Joined Voice Rooms</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {rooms.slice(0, 3).map((rm) => (
                <div
                  key={rm.id}
                  className="flex items-center justify-between rounded-2xl bg-[#132038] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{rm.title}</div>
                    <div className="font-mono-tabular text-[11px] text-slate-400">
                      ID {rm.uid} · Lv.{rm.level}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoinRoom(rm.id)}
                    className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                  >
                    Enter
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW: All Badges Gallery (VIP Lv.1-15 with Name Colors, Charm Lv.1-21, Room Lv.1-20) */}
      {activeView === 'badges' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-amber-400/25 bg-[#0D1526] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  VIP Badges &amp; Name Colors (Lv. 1 – 18)
                </h2>
                <p className="text-xs text-slate-400">
                  Name colors change every 2 VIP levels (V1–V11) &amp; shine in animated dual/celestial colors beyond VIP 11 (V12–V18).
                </p>
              </div>
              <VipBadgeArt level={effectiveVipLevel} size={46} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {VIP_TIERS.map((tier) => {
                const unlocked = effectiveVipLevel >= tier.level;
                const isCurrent = effectiveVipLevel === tier.level;
                const nameStyle = getVipNameStyle(tier.level);
                return (
                  <div
                    key={tier.level}
                    className={`flex flex-col items-center rounded-2xl border p-3 text-center ${
                      isCurrent
                        ? 'border-amber-400 bg-amber-500/15'
                        : unlocked
                          ? 'border-white/15 bg-[#132038]'
                          : 'border-white/5 bg-[#070B14] opacity-65'
                    }`}
                  >
                    <VipBadgeArt level={tier.level} size={42} />
                    <div className="mt-1.5 text-xs font-extrabold" style={nameStyle}>
                      V{tier.level} Name
                    </div>
                    <div
                      className={`mt-0.5 text-[10px] font-bold ${tier.level > 11 ? '' : 'text-slate-300'}`}
                      style={tier.level > 11 ? nameStyle : undefined}
                    >
                      {tier.title}
                    </div>
                    <div className="mt-1 font-mono-tabular text-[9px] text-slate-400">
                      {unlocked ? (isCurrent ? 'Current' : 'Unlocked') : 'Locked'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-rose-400/25 bg-[#0D1526] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Charm Badges (Lv. 1 – 21)
                </h2>
                <p className="text-xs text-slate-400">
                  Star Series, Diamond Series &amp; Crown Series earned via gifts.
                </p>
              </div>
              <CharmBadgeArt level={charmInfo.level} size={46} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-7">
              {CHARM_LEVELS.map((tier) => {
                const unlocked = charm >= tier.minCharm;
                const isCurrent = charmInfo.level === tier.level;
                return (
                  <div
                    key={tier.level}
                    className={`flex flex-col items-center rounded-2xl border p-2.5 text-center ${
                      isCurrent
                        ? 'border-rose-400 bg-rose-500/15'
                        : unlocked
                          ? 'border-white/15 bg-[#132038]'
                          : 'border-white/5 bg-[#070B14] opacity-65'
                    }`}
                  >
                    <CharmBadgeArt level={tier.level} size={42} />
                    <div className="mt-1 text-xs font-bold text-white">Lv.{tier.level}</div>
                    <div className="text-[9px] text-slate-400">{tier.series}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-sky-400/25 bg-[#0D1526] p-6 shadow-xl">
            <div className="border-b border-white/10 pb-4">
              <h2 className="font-display text-2xl font-bold text-white">
                Room Level Badges (Lv. 1 – 20)
              </h2>
              <p className="text-xs text-slate-400">
                Level up rooms with daily activity and gifts to unlock up to 15 Admin Slots.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
              {ROOM_LEVEL_INFO.map((rl) => (
                <div
                  key={rl.level}
                  className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#132038] p-2.5 text-center"
                >
                  <RoomLevelBadgeArt level={rl.level} size={40} />
                  <div className="mt-1 text-xs font-bold text-white">Lv.{rl.level}</div>
                  <div className="line-clamp-1 text-[9px] text-sky-300">{rl.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW: Edit Profile & Photo Management */}
      {activeView === 'edit' && (
        <form
          onSubmit={handleSaveProfile}
          className="space-y-5 rounded-3xl border border-cyan-500/20 bg-[#0D1526] p-5 shadow-2xl sm:p-6"
        >
          {/* Top Header: < | Edit Profile | Save */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => setActiveView('profile')}
              aria-label="Back to Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-200 hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="font-display text-lg font-bold text-white">Edit Profile</h2>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 py-1.5 text-xs font-extrabold text-slate-950 shadow hover:from-cyan-400 hover:to-teal-300"
            >
              Save
            </button>
          </div>

          {savedBanner && (
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 py-2 text-xs font-bold text-emerald-300">
              <Check className="h-4 w-4" />
              Profile &amp; Photo Settings Saved
            </div>
          )}

          {/* Centered Circular Avatar + Camera Button + Photo Management Controls */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <AvatarArt avatar={userProfile} size={88} frameId={equippedItems.frame} />
              <label
                title="Change Profile Photo"
                className="absolute right-0 bottom-0 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-[#0D1526] bg-cyan-400 text-slate-950 shadow hover:bg-cyan-300"
              >
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarPhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-[#132038] px-3 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-[#192946]">
                <Upload className="h-3.5 w-3.5" />
                <span>Cover Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverPhotoUpload}
                  className="hidden"
                />
              </label>
              {userProfile.photoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateProfile({ photoUrl: '' });
                    setPurchaseNotice('Profile photo removed.');
                  }}
                  className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25"
                >
                  Remove Photo
                </button>
              )}
              {userProfile.coverUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateProfile({ coverUrl: '' });
                    setPurchaseNotice('Cover photo removed.');
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
                >
                  Reset Cover
                </button>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-300">
              Name
            </label>
            <input
              id="prof-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#132038] px-3.5 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Username */}
          <div>
            <label htmlFor="prof-handle" className="block text-xs font-semibold text-slate-300">
              Username
            </label>
            <div className="mt-1.5 flex items-center rounded-xl border border-white/10 bg-[#132038] px-3.5 focus-within:border-cyan-400">
              <span className="mr-2 font-mono-tabular text-sm text-slate-400">@</span>
              <input
                id="prof-handle"
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value.replace(/^@+/, ''))}
                className="w-full bg-transparent py-3 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Bio with 100-char counter */}
          <div>
            <label htmlFor="prof-bio" className="block text-xs font-semibold text-slate-300">
              Bio
            </label>
            <textarea
              id="prof-bio"
              rows={3}
              maxLength={100}
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value.slice(0, 100))}
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-[#132038] px-3.5 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
            <div className="mt-1 text-right font-mono-tabular text-[11px] text-slate-400">
              {bioInput.length}/100
            </div>
          </div>

          {/* Gender */}
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-300">Gender</span>
              <span className="text-[11px] text-slate-400">locked for 48 hours after a change</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['Male', 'Female', 'Other'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenderInput(g)}
                  className={`rounded-xl py-2.5 text-xs font-bold transition-colors ${
                    genderInput === g
                      ? 'border border-cyan-400 bg-cyan-500/20 text-white'
                      : 'border border-white/5 bg-[#132038] text-slate-300 hover:bg-[#192946]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Age & Country */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-5">
              <div className="text-xs font-semibold text-slate-300">Age</div>
              <div className="text-[10px] leading-tight text-slate-400">
                only you · locked 48h after change
              </div>
              <input
                type="number"
                min={13}
                max={99}
                value={ageInput}
                onChange={(e) => setAgeInput(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#132038] px-3.5 py-2.5 font-mono-tabular text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="col-span-7 flex flex-col justify-end">
              <label htmlFor="prof-country" className="block text-xs font-semibold text-slate-300">
                Country
              </label>
              <select
                id="prof-country"
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#132038] px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="India">🇮🇳 India</option>
                <option value="United States">🇺🇸 United States</option>
                <option value="UAE">🇦🇪 UAE</option>
                <option value="United Kingdom">🇬🇧 United Kingdom</option>
                <option value="Canada">🇨🇦 Canada</option>
                <option value="Singapore">🇸🇬 Singapore</option>
              </select>
            </div>
          </div>

          {/* Tags 0/5 */}
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-300">Tags</span>
              <span className="font-mono-tabular text-slate-400">{tagsInput.length}/5</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {tagsInput.map((tg) => (
                <button
                  key={tg}
                  type="button"
                  onClick={() => setTagsInput((prev) => prev.filter((item) => item !== tg))}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-400/35 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200"
                >
                  <span>{tg}</span>
                  <span className="text-slate-400">×</span>
                </button>
              ))}
              {tagsInput.length < 5 && !showAddTagInput && (
                <button
                  type="button"
                  onClick={() => setShowAddTagInput(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/25 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              )}
              {showAddTagInput && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={18}
                    value={newTagDraft}
                    onChange={(e) => setNewTagDraft(e.target.value)}
                    placeholder="e.g. Gamer"
                    className="w-28 rounded-full border border-cyan-400/40 bg-[#132038] px-3 py-1 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newTagDraft.trim();
                      if (clean && tagsInput.length < 5 && !tagsInput.includes(clean)) {
                        setTagsInput((prev) => [...prev, clean]);
                      }
                      setNewTagDraft('');
                      setShowAddTagInput(false);
                    }}
                    className="rounded-full bg-cyan-500 px-2.5 py-1 text-[11px] font-bold text-slate-950"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Verified Gmail (Locked) */}
          <div>
            <div className="text-xs font-semibold text-slate-300">Verified Gmail</div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#132038] px-3.5 py-2.5 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="truncate text-slate-200">
                  {userProfile.email || 'Verified @gmail.com'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono-tabular text-[11px] font-extrabold text-emerald-400">
                  VERIFIED
                </span>
              </div>
            </div>
          </div>

          {/* Locked UID & Ornament */}
          <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-slate-400">User ID (Permanent)</div>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2 font-mono-tabular text-xs text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-300" />
                  <span>{userProfile.publicId || userProfile.uid}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const idToCopy = userProfile.publicId || userProfile.uid;
                    navigator.clipboard?.writeText(idToCopy).catch(() => {});
                    setCopiedOwnId(true);
                    window.setTimeout(() => setCopiedOwnId(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200 hover:bg-white/20"
                >
                  {copiedOwnId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedOwnId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-400">Avatar Ornament</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ORNAMENTS.map((orn) => (
                  <button
                    key={orn}
                    type="button"
                    onClick={() => setOrnamentInput(orn)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize ${
                      ornamentInput === orn
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'border border-white/10 bg-[#070B14] text-slate-300'
                    }`}
                  >
                    {orn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SUB-VIEW: Gift Wall & Equipped Rings */}
      {activeView === 'gifts' && (
        <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0D1526] p-6">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-300" />
            <h2 className="font-display text-2xl font-bold text-white">
              Gift Wall &amp; Ring Showcase
            </h2>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {receivedGiftIds.map((gid, i) => (
              <div
                key={`${gid}-${i}`}
                className="flex items-center justify-center rounded-2xl bg-[#132038] p-3"
              >
                <GiftArtwork giftId={gid} size={48} />
              </div>
            ))}
          </div>
          {equippedRing?.ringNumber && (
            <div className="flex items-center gap-4 bg-transparent py-2">
              <RingSpriteArt
                ringNumber={equippedRing.ringNumber}
                size={68}
                alt={equippedRing.name}
              />
              <div>
                <div className="text-xs text-amber-300">Equipped Ring</div>
                <div className="font-display text-lg font-bold text-white">
                  {equippedRing.name}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW: Moments */}
      {activeView === 'moments' && (
        <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-6">
          <h2 className="font-display text-2xl font-bold text-white">My Moments</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {moments.map((m) => (
              <div key={m.id} className="rounded-2xl bg-[#132038] p-4 text-xs">
                <div className="font-bold text-amber-300">{m.mediaTitle}</div>
                <p className="mt-1 text-slate-300">{m.caption}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW: CP Life, Ring Proposals & Clickable Partner ID */}
      {activeView === 'cp' && (
        <div className="space-y-5 rounded-3xl border border-rose-400/25 bg-[#0D1526] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">CP Life &amp; Ring Proposals</h2>
              <p className="mt-1 text-xs text-slate-400">
                Send a ring proposal to form a CP bond. Clicking your CP partner opens their Profile Page.
              </p>
            </div>
          </div>

          {/* Current CP Status & CP Level System */}
          {userProfile.cpPartner ? (() => {
            const cpCharm = userProfile.cpPartner.cpCharm ?? 0;
            const cpLvl = getCpLevelInfo(cpCharm);
            return (
              <div className="space-y-3 rounded-2xl border border-rose-400/40 bg-gradient-to-r from-[#2D1426]/90 via-[#192038] to-[#0B1A2E]/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <RingSpriteArt
                      ringNumber={userProfile.cpPartner.ringNumber}
                      size={56}
                      alt={userProfile.cpPartner.ringName}
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (onInspectUser) {
                            openCpPartnerProfile();
                          } else {
                            setShowCpPartnerId((v) => !v);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/25 px-3 py-1 text-xs font-extrabold text-rose-200 hover:bg-rose-500/35"
                      >
                        <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
                        <span>
                          CP Lv.{cpLvl.level} ({cpLvl.title}) · {userProfile.cpPartner.partnerName}
                        </span>
                      </button>
                      <div className="mt-1 font-mono-tabular text-xs font-bold text-white">
                        Partner ID: {userProfile.cpPartner.partnerUid}
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {userProfile.cpPartner.ringName} · Since {userProfile.cpPartner.since}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onInspectUser && (
                      <button
                        type="button"
                        onClick={openCpPartnerProfile}
                        className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-400"
                      >
                        Open Profile
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onBreakCp?.();
                        setPurchaseNotice('CP status ended.');
                      }}
                      className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
                    >
                      Unbind CP
                    </button>
                  </div>
                </div>

                {/* CP Level Charm Progress */}
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular text-[11px]">
                    <span className="font-bold text-rose-200">
                      CP Charms: {cpCharm.toLocaleString()}
                    </span>
                    <span className="text-amber-300">
                      {cpLvl.nextMin !== null
                        ? `${cpLvl.progressInLevel.toLocaleString()} / ${cpLvl.stepRequired.toLocaleString()} for CP Lv.${cpLvl.level + 1}`
                        : 'Max CP Level Reached'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-400 to-amber-300 transition-all"
                      style={{ width: `${cpLvl.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="rounded-2xl border border-white/10 bg-[#132038] p-4 text-xs text-slate-300">
              No active CP yet. Send a Ring proposal below or from any user profile!
            </div>
          )}

          {/* CP Level Milestones Ladder */}
          <div className="rounded-2xl border border-white/10 bg-[#132038] p-3.5">
            <div className="mb-2 text-xs font-bold text-rose-200">
              CP Bond Level Milestones (Gift Charms Exchanged)
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {CP_LEVELS.slice(0, 5).map((tier, idx) => {
                const prevMin = idx === 0 ? 0 : CP_LEVELS[idx - 1].minCharm;
                const step = tier.minCharm - prevMin;
                return (
                  <div
                    key={tier.level}
                    className="rounded-xl border border-rose-400/20 bg-[#0A101D] p-2 text-center"
                  >
                    <div className="text-[10px] font-black text-rose-300">CP Lv.{tier.level}</div>
                    <div className="truncate text-[9.5px] font-semibold text-white">{tier.title}</div>
                    <div className="mt-0.5 font-mono-tabular text-[9px] text-amber-300">
                      {idx === 0
                        ? '0 Charms'
                        : `+${step.toLocaleString()} (${tier.minCharm.toLocaleString()})`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Send New CP Bond Ring Proposal (Strict Owned-Ring Requirement) */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#132038] p-4">
            <div>
              <div className="text-sm font-bold text-white">Send CP Bond Ring Proposal</div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Enter any user&apos;s Public ID or pick a friend, choose one of your owned Bond Rings, and send a synchronized CP proposal.
              </p>
            </div>
            {ownedRings.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3.5 text-xs">
                <div>
                  <div className="font-bold text-amber-200">Ring Purchase Required</div>
                  <p className="mt-0.5 text-[11px] text-slate-300">
                    You must purchase &amp; own a Ring in the Shop before sending a CP proposal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShopCategory('ring');
                    setActiveView('shop');
                  }}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-3.5 py-2 text-xs font-extrabold text-white shadow hover:brightness-110"
                >
                  Buy Ring in Shop
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="cp-target-id" className="block text-[11px] font-semibold text-slate-400">
                      Partner Public User ID (e.g. 100002)
                    </label>
                    <input
                      id="cp-target-id"
                      type="text"
                      value={cpTargetUid}
                      onChange={(e) => {
                        setCpTargetUid(e.target.value);
                        const matchedFriend = friends.find(
                          (f) => f.publicId === e.target.value || f.uid === e.target.value
                        );
                        setCpTargetNameDraft(matchedFriend?.name || '');
                      }}
                      placeholder="Enter Public User ID (e.g. 100002)"
                      className="w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 font-mono-tabular text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                    {friends.length > 0 && (
                      <select
                        aria-label="Or choose a friend"
                        value={friends.some((f) => (f.publicId || f.uid) === cpTargetUid) ? cpTargetUid : ''}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const fr = friends.find((f) => (f.publicId || f.uid) === e.target.value);
                          setCpTargetUid(e.target.value);
                          setCpTargetNameDraft(fr?.name || '');
                        }}
                        className="w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-1.5 text-[11px] text-slate-300 focus:border-cyan-400 focus:outline-none"
                      >
                        <option value="">-- Quick pick from Friends --</option>
                        {friends.map((f) => (
                          <option key={f.uid} value={f.publicId || f.uid}>
                            {f.name} ({f.publicId || f.uid})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label htmlFor="cp-ring-select" className="block text-[11px] font-semibold text-slate-400">
                      Choose Owned CP Bond Ring
                    </label>
                    <select
                      id="cp-ring-select"
                      value={selectedBondRing?.ringNumber ?? 1}
                      onChange={(e) => setCpRingNumber(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {ownedRings.map((r) => (
                        <option key={r.id} value={r.ringNumber ?? 1}>
                          Ring #{r.ringNumber}: {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2.5">
                    <RingSpriteArt
                      ringNumber={selectedBondRing?.ringNumber ?? 1}
                      size={42}
                      alt={selectedBondRing?.name || 'Bond Ring'}
                      imageUrl={selectedBondRing?.imageUrl}
                    />
                    <span className="text-xs font-semibold text-rose-200">
                      {selectedBondRing?.name || `Ring #${cpRingNumber}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!selectedBondRing || !cpTargetUid.trim()}
                    onClick={() => {
                      const targetId = cpTargetUid.trim();
                      if (!selectedBondRing || !targetId) return;
                      const matchedFriend = friends.find((f) => (f.publicId || f.uid) === targetId);
                      const targetName =
                        cpTargetNameDraft ||
                        matchedFriend?.name ||
                        `User ${targetId}`;
                      const ringNum = selectedBondRing.ringNumber ?? 1;
                      onProposeCp?.(
                        targetId,
                        targetName,
                        matchedFriend?.avatarId || 'av-neutral',
                        ringNum,
                        selectedBondRing.name
                      );
                      setPurchaseNotice(
                        `Sending CP Bond proposal (${selectedBondRing.name}) to ${targetId}...`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-xs font-extrabold text-white shadow hover:opacity-95 disabled:opacity-40"
                  >
                    <Heart className="h-3.5 w-3.5 fill-white" />
                    <span>Send Bond Ring Proposal</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Pending & Sent CP Requests (Receiver-Only Accept/Decline) */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              CP Proposal Requests ({cpRequests.length})
            </h3>
            {cpRequests.length === 0 ? (
              <p className="text-xs text-slate-400">No CP requests yet.</p>
            ) : (
              cpRequests.map((req) => {
                const selfPublicId = userProfile.publicId || userProfile.uid;
                const isIncoming =
                  req.direction === 'incoming' ||
                  req.toUid === selfPublicId ||
                  req.toUid === userProfile.uid;
                return (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#132038] p-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <RingSpriteArt ringNumber={req.ringNumber} size={38} alt={req.ringName} />
                      <div>
                        <div className="font-bold text-white">
                          {isIncoming
                            ? `${req.fromName} (${req.fromUid}) proposed to you`
                            : `You proposed to ${req.toName} (${req.toUid})`}
                        </div>
                        <div className="text-[11px] text-rose-200">
                          {req.ringName} · Status:{' '}
                          <span className="font-bold uppercase">{req.status}</span> · {req.timestamp}
                        </div>
                      </div>
                    </div>

                    {req.status === 'pending' && isIncoming && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRespondCpRequest?.(req.id, true)}
                          className="rounded-xl bg-emerald-500 px-3 py-1.5 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400"
                        >
                          Accept CP
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondCpRequest?.(req.id, false)}
                          className="rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-rose-500/25 hover:text-rose-200"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {req.status === 'pending' && !isIncoming && (
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-[10px] font-bold text-amber-200">
                        Awaiting Partner Response
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* CP Relationship History */}
          {cpRelationshipHistory.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                CP Relationship History ({cpRelationshipHistory.length})
              </h3>
              <div className="space-y-2">
                {cpRelationshipHistory.map((hist) => (
                  <div
                    key={hist.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#132038] px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <RingSpriteArt ringNumber={hist.ringNumber} size={32} alt={hist.ringName} />
                      <div>
                        <div className="font-bold text-white">
                          {hist.partnerName} ({hist.partnerUid}) · {hist.ringName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Started {new Date(hist.startedAt).toLocaleDateString()}
                          {hist.endedAt ? ` · Ended ${new Date(hist.endedAt).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        hist.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {hist.status} · {hist.cpCharm.toLocaleString()} Charm
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW: Visitors */}
      {activeView === 'visitors' && (
        <div className="rounded-3xl border border-white/10 bg-[#0D1526] p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-white">Recent Visitors</h2>
          </div>
          <p className="mt-4 rounded-2xl border border-white/10 bg-[#132038] p-5 text-center text-xs text-slate-400">
            Real-time profile visitor history is not enabled yet.
          </p>
        </div>
      )}

      {/* SUB-VIEW: Create Gift Studio & Gift Animation Video Upload */}
      {activeView === 'create-gift' && (
        <div className="space-y-5 rounded-3xl border border-cyan-400/25 bg-[#0D1526] p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-400 text-slate-950 shadow">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-white">Create Custom Gift</h2>
                <p className="text-xs text-slate-400">
                  Upload a gift animation video &amp; submit for approval. Approved gifts unlock across Voice Rooms &amp; DMs!
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!cgName.trim()) return;
              onSubmitCustomGift?.({
                name: cgName.trim(),
                cost: Math.max(50, cgCost),
                charmValue: Math.max(50, cgCharm),
                description: cgDesc.trim() || `Custom OG VELOCITY Gift: ${cgName.trim()}`,
                primaryColor: cgPrimary,
                secondaryColor: cgSecondary,
                particleStyle: cgParticle,
                artworkUrl: cgArtworkUrl,
                animationVideoUrl: cgVideoUrl,
                videoFileName: cgVideoName || undefined,
              });
              setPurchaseNotice(`Gift "${cgName.trim()}" submitted for review!`);
              setCgName('');
              setCgArtworkUrl(undefined);
              setCgVideoUrl(undefined);
              setCgVideoName('');
            }}
            className="grid grid-cols-1 gap-5 lg:grid-cols-5"
          >
            {/* Left: Form Inputs */}
            <div className="space-y-3 lg:col-span-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Gift Name
                  <input
                    type="text"
                    required
                    maxLength={24}
                    value={cgName}
                    onChange={(e) => setCgName(e.target.value)}
                    placeholder="e.g. Celestial Heart"
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-300">
                  Particle Effect
                  <select
                    value={cgParticle}
                    onChange={(e) => setCgParticle(e.target.value as VirtualGift['particleStyle'])}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="heart">Floating Hearts</option>
                    <option value="crown">Royal Crown</option>
                    <option value="rose">Rose Petals</option>
                    <option value="lotus">Lotus Spark</option>
                    <option value="phoenix">Phoenix Flame</option>
                    <option value="lantern">Sky Lantern</option>
                    <option value="meteor">Meteor Shower</option>
                    <option value="vehicle">Neon Speed</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Coin Price
                  <input
                    type="number"
                    min={50}
                    max={500000}
                    step={50}
                    value={cgCost}
                    onChange={(e) => setCgCost(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 font-mono-tabular text-xs text-amber-300 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-300">
                  Charm Reward
                  <input
                    type="number"
                    min={50}
                    max={500000}
                    step={50}
                    value={cgCharm}
                    onChange={(e) => setCgCharm(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 font-mono-tabular text-xs text-rose-300 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
              </div>

              {/* Gift Animation Video Upload (replaces removed Gift Shape selector) */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">Gift Animation Video</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25">
                    <Video className="h-3.5 w-3.5" />
                    <span>{cgVideoName || 'Upload Gift Animation Video'}</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        setMediaUploadPct(15);
                        setPurchaseNotice(`Uploading video ${f.name}...`);
                        try {
                          const uploadedVideo = await uploadVideoAsset(f, {
                            authToken,
                            maxBytes: 5_000_000,
                            onProgress: (pct) => setMediaUploadPct(pct),
                          });
                          setCgVideoName(f.name);
                          setCgVideoUrl(uploadedVideo);
                          setPurchaseNotice('Gift animation video ready.');
                        } catch (err) {
                          setCgVideoName('');
                          setCgVideoUrl(undefined);
                          setPurchaseNotice(err instanceof Error ? err.message : 'Failed to upload gift video.');
                        } finally {
                          setMediaUploadPct(null);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {cgVideoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCgVideoUrl(undefined);
                        setCgVideoName('');
                      }}
                      className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
                    >
                      Clear Video
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Primary</span>
                  <input
                    type="color"
                    value={cgPrimary}
                    onChange={(e) => setCgPrimary(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-white/20 bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Accent</span>
                  <input
                    type="color"
                    value={cgSecondary}
                    onChange={(e) => setCgSecondary(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-white/20 bg-transparent"
                  />
                </label>
                <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{cgArtworkUrl ? 'Change Art' : 'Upload Gift Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      setMediaUploadPct(10);
                      setPurchaseNotice('Uploading gift artwork...');
                      try {
                        const uploadedArt = await uploadImageAsset(f, {
                          authToken,
                          maxDim: 640,
                          quality: 0.86,
                          maxCompressedBytes: 550_000,
                          onProgress: (pct) => setMediaUploadPct(pct),
                        });
                        setCgArtworkUrl(uploadedArt);
                        setPurchaseNotice('Gift artwork uploaded!');
                      } catch (err) {
                        setPurchaseNotice(err instanceof Error ? err.message : 'Could not upload gift artwork image.');
                      } finally {
                        setMediaUploadPct(null);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-300">
                Description
                <input
                  type="text"
                  maxLength={80}
                  value={cgDesc}
                  onChange={(e) => setCgDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:opacity-95"
              >
                Submit Gift for Review
              </button>
            </div>

            {/* Right: Live Gift Preview Card */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#070B14] p-5 text-center lg:col-span-2">
              <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200">
                LIVE GIFT PREVIEW
              </span>
              <div
                className="my-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#132038]"
                style={{ boxShadow: `0 0 24px ${cgPrimary}33` }}
              >
                {cgVideoUrl ? (
                  <video
                    src={cgVideoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : cgArtworkUrl ? (
                  <img
                    src={cgArtworkUrl}
                    alt="Custom gift preview"
                    className="h-24 w-24 rounded-xl object-contain"
                  />
                ) : (
                  <Sparkles className="h-12 w-12" style={{ color: cgPrimary }} />
                )}
              </div>
              <div className="font-display text-lg font-extrabold text-white">
                {cgName.trim() || 'Untitled Gift'}
              </div>
              <div className="mt-1 flex items-center gap-3 font-mono-tabular text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                  <ZayroCoinArt size={14} />
                  {cgCost.toLocaleString()}
                </span>
                <span className="font-bold text-rose-300">+{cgCharm.toLocaleString()} Charm</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{cgDesc}</p>
            </div>
          </form>

          {/* Review Queue: Pending / Approved / Rejected */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                Custom Gift Submissions ({customGifts.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Reviewed by OG VELOCITY Admins before publishing
              </span>
            </div>

            {customGifts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#132038] p-5 text-center text-xs text-slate-400">
                No custom gifts submitted yet. Create one above to send it for Admin approval!
              </div>
            ) : (
              <div className="space-y-2.5">
                {customGifts.map((cg) => (
                  <div
                    key={cg.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#132038] p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      {cg.animationVideoUrl ? (
                        <video
                          src={cg.animationVideoUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : cg.artworkUrl ? (
                        <img
                          src={cg.artworkUrl}
                          alt={cg.name}
                          className="h-12 w-12 rounded-xl object-contain"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-[#070B14]"
                          style={{ boxShadow: `0 0 12px ${cg.primaryColor}44` }}
                        >
                          <Gift className="h-5 w-5" style={{ color: cg.primaryColor }} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{cg.name}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              cg.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : cg.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {cg.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                            {cg.status === 'rejected' && <XCircle className="h-3 w-3" />}
                            {cg.status === 'pending' && <Clock className="h-3 w-3" />}
                            {cg.status === 'pending' ? 'Pending Admin Review' : cg.status}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono-tabular text-[11px] text-slate-300">
                          {cg.cost.toLocaleString()} Coins · +{cg.charmValue.toLocaleString()} Charm · {cg.submittedAt}
                          {cg.videoFileName ? ` · 🎬 ${cg.videoFileName}` : ''}
                        </div>
                        {cg.reviewNote && (
                          <div className="mt-0.5 text-[11px] text-rose-300">
                            Admin Note: {cg.reviewNote}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW: Privacy, Photo Management, Gift Animations & Security */}
      {activeView === 'privacy' && (
        <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0D1526] p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-cyan-300" />
              <h2 className="font-display text-2xl font-bold text-white">
                Profile Settings &amp; Privacy
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('edit')}
              className="rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
            >
              Open Full Edit Profile
            </button>
          </div>

          {/* Photo Management Panel inside Settings */}
          <div className="rounded-2xl border border-cyan-400/20 bg-[#132038] p-4">
            <div className="text-sm font-bold text-white">Photo Management</div>
            <p className="text-xs text-slate-400">
              Update or clear your profile photo and cover banner
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <AvatarArt
                avatar={userProfile}
                size={44}
                frameId={equippedItems.frame}
                frameImageUrl={equippedFrame?.imageUrl}
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400">
                <Camera className="h-3.5 w-3.5" />
                <span>Change Profile Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarPhotoUpload}
                  className="hidden"
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 text-xs font-semibold text-white hover:border-cyan-400">
                <Upload className="h-3.5 w-3.5" />
                <span>Change Cover Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverPhotoUpload}
                  className="hidden"
                />
              </label>
              {userProfile.photoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateProfile({ photoUrl: '' });
                    setPurchaseNotice('Profile photo removed.');
                  }}
                  className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200"
                >
                  Remove Photo
                </button>
              )}
              {userProfile.coverUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateProfile({ coverUrl: '' });
                    setPurchaseNotice('Cover photo removed.');
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300"
                >
                  Reset Cover
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Dark / Light Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#132038] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                  {themeMode === 'light' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Appearance Theme</div>
                  <div className="text-xs text-slate-400">
                    Current: {themeMode === 'light' ? 'Light Mode' : 'Dark Mode'} (saved to your profile)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleThemeMode?.()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/35"
              >
                {themeMode === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                <span>Switch to {themeMode === 'light' ? 'Dark' : 'Light'} Mode</span>
              </button>
            </div>

            {/* Disable Gift Animations Toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#132038] p-4">
              <div>
                <div className="text-sm font-bold text-white">Disable Gift Animations</div>
                <div className="text-xs text-slate-400">
                  Turn off full-screen gift spectacle animations (top big-gift bar stays active)
                </div>
              </div>
              <input
                type="checkbox"
                checked={!giftAnimationsEnabled}
                onChange={() => onToggleGiftAnimations?.()}
                className="h-4.5 w-4.5 accent-cyan-400"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#132038] p-4">
              <div>
                <div className="text-sm font-bold text-white">App Language</div>
                <div className="text-xs text-slate-400">Choose your preferred interface language</div>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 text-xs text-white"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Arabic">Arabic</option>
              </select>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#132038] p-4">
              <div>
                <div className="text-sm font-bold text-white">Hide Online Presence</div>
                <div className="text-xs text-slate-400">
                  Hide your live Voice Room status from public friend lists
                </div>
              </div>
              <input
                type="checkbox"
                checked={hideOnlineStatus}
                onChange={(e) => setHideOnlineStatus(e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#132038] p-4">
              <div>
                <div className="text-sm font-bold text-white">Parental Control Mode</div>
                <div className="text-xs text-slate-400">
                  Require confirmation before high-value INR top-ups
                </div>
              </div>
              <input
                type="checkbox"
                checked={parentalMode}
                onChange={(e) => setParentalMode(e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
            </label>

            {onLogout && (
              <div className="flex items-center justify-between rounded-2xl border border-red-400/20 bg-red-500/5 p-4">
                <div>
                  <div className="text-sm font-bold text-white">Account Session</div>
                  <div className="text-xs text-slate-400">
                    Signed in as {userProfile.email || userProfile.uid}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/15 px-3.5 py-2 text-xs font-bold text-red-200 transition-colors hover:bg-red-500/25"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW: Invite Friend & Referral Rewards */}
      {activeView === 'invite' && (() => {
        const activeInviteCode = referralSummary?.inviteCode || `OGV-${userProfile.publicId || userProfile.uid}`;
        const shareLink =
          typeof window !== 'undefined'
            ? `${window.location.origin}/?ref=${encodeURIComponent(activeInviteCode)}`
            : `/?ref=${encodeURIComponent(activeInviteCode)}`;
        const rewardEach = referralSummary?.rewardCoins ?? 25000;
        return (
          <div className="space-y-5 rounded-3xl border border-emerald-400/25 bg-[#0D1526] p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-lg">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Invite Friends &amp; Earn</h2>
                <p className="text-xs text-slate-400">
                  +{rewardEach.toLocaleString()} Coins for you &amp; +{rewardEach.toLocaleString()} Coins for your friend on every verified referral!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-[#132038] p-3.5 text-center">
                <div className="text-[11px] text-slate-400">Friends Invited</div>
                <div className="mt-0.5 font-mono-tabular text-xl font-black text-emerald-300">
                  {referralSummary?.totalInvited ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-[#132038] p-3.5 text-center">
                <div className="text-[11px] text-slate-400">Referral Coins Earned</div>
                <div className="mt-0.5 inline-flex items-center justify-center gap-1 font-mono-tabular text-xl font-black text-amber-300">
                  <ZayroCoinArt size={16} />
                  <span>{(referralSummary?.totalEarnedCoins ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/30 bg-[#132038] p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-300">Your Personal Invite Code &amp; Link</div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2.5">
                  <div>
                    <div className="font-mono-tabular text-sm font-black tracking-wider text-emerald-300">
                      {activeInviteCode}
                    </div>
                    <div className="truncate max-w-[220px] text-[10px] text-slate-400">{shareLink}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(shareLink).catch(() => {});
                      setInviteCopied(true);
                      onInviteFriendApp?.();
                      setPurchaseNotice('Invite link copied! Share it with friends to earn +25,000 Coins.');
                      window.setTimeout(() => setInviteCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
                  >
                    {inviteCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{inviteCopied ? 'Copied!' : 'Copy Invite Link'}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: 'Join OG VELOCITY',
                        text: `Join me on OG VELOCITY with code ${activeInviteCode} to get +25,000 Coins!`,
                        url: shareLink,
                      });
                    } catch {
                      navigator.clipboard?.writeText(shareLink).catch(() => {});
                    }
                  } else {
                    navigator.clipboard?.writeText(shareLink).catch(() => {});
                  }
                  onInviteFriendApp?.();
                  setPurchaseNotice('Invite link ready! Friends get +25,000 Coins upon claiming.');
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 py-3 text-xs font-extrabold text-slate-950 shadow-lg hover:brightness-105"
              >
                <Share2 className="h-4 w-4" />
                <span>Share Invite Link (+25,000 Coins Each)</span>
              </button>
            </div>

            {onClaimReferralCode && (
              <div className="rounded-2xl border border-cyan-400/25 bg-[#132038] p-4 space-y-2.5">
                <div className="text-xs font-bold text-white">Claim a Friend&apos;s Invite Code</div>
                {referralSummary?.referredByPublicId ? (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                    Referral reward already claimed (Invited by User #{referralSummary.referredByPublicId}).
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const clean = claimInviteInput.trim();
                      if (!clean) return;
                      setClaimingInvite(true);
                      setClaimInviteFeedback(null);
                      try {
                        const res = await onClaimReferralCode(clean);
                        setClaimInviteFeedback(res);
                        if (res.ok) setClaimInviteInput('');
                      } finally {
                        setClaimingInvite(false);
                      }
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      type="text"
                      value={claimInviteInput}
                      onChange={(e) => setClaimInviteInput(e.target.value)}
                      placeholder="Enter code (e.g. OGV-100001)"
                      className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#070B14] px-3 py-2 font-mono-tabular text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={claimingInvite || !claimInviteInput.trim()}
                      className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {claimingInvite ? 'Claiming...' : 'Claim +25,000'}
                    </button>
                  </form>
                )}
                {claimInviteFeedback && (
                  <div
                    className={`text-xs font-semibold ${
                      claimInviteFeedback.ok ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {claimInviteFeedback.message}
                  </div>
                )}
              </div>
            )}

            {(referralSummary?.referrals?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Referral History ({referralSummary!.referrals.length})
                </h3>
                <div className="space-y-2">
                  {referralSummary!.referrals.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#132038] px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{ref.invitedName}</div>
                        <div className="font-mono-tabular text-[10px] text-slate-400">
                          ID {ref.invitedPublicId} · {new Date(ref.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="font-mono-tabular font-extrabold text-emerald-300">
                        +{ref.rewardCoins.toLocaleString()} Coins
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <CoupleHomeModal
        isOpen={showRingCollection}
        ownerAvatar={userProfile}
        ownerVipLevel={effectiveVipLevel}
        ownerCharm={charm}
        cpPartner={userProfile.cpPartner ?? null}
        ringNumbers={Array.from(
          new Set([
            ...ownedRings.map((r) => r.ringNumber ?? 1),
            ...(userProfile.cpPartner?.ringNumber ? [userProfile.cpPartner.ringNumber] : []),
          ])
        )}
        blessingCount={userProfile.blessing ?? 0}
        isSelf={true}
        equippedRingId={equippedItems.ring}
        onClose={() => setShowRingCollection(false)}
        onEquipRing={(ringItem) => {
          onEquipShopItem(ringItem);
          setPurchaseNotice(`Equipped ${ringItem.name}!`);
        }}
        onOpenRingShop={() => {
          setShopCategory('ring');
          setActiveView('shop');
        }}
        onInspectPartner={onInspectUser}
        onInspectPartnerById={onInspectUserById}
      />
    </div>
  );
};
