export type NavSection = 'home' | 'rooms' | 'chat' | 'discover' | 'me';

export type GiftId = string;

export type AuthProvider = 'gmail' | 'google' | 'phone' | 'facebook';

export type ShopCategory = 'ring' | 'bubble' | 'frame' | 'entry' | 'seat-fx' | 'room-theme';

export type BondTagId = 'brother' | 'sister' | 'confident';

export type RelationshipTagKey =
  | 'bro'
  | 'bestie'
  | 'sister'
  | 'soulmate'
  | 'lover'
  | 'confident'
  | 'cp_partner';

export interface RelationshipTagSummary {
  id: string;
  tagType: RelationshipTagKey;
  partnerUid: string;
  partnerName: string;
  partnerPhotoUrl?: string | null;
  status: 'pending' | 'active' | 'ended' | string;
  isIncoming: boolean;
  charmScore: number;
  level: number; // 1..10
  startedAt: string;
}

export interface WithdrawalRequestRecord {
  requestId: string;
  userUid: string;
  amountCoins: number;
  amountInr: number;
  payoutMethod: 'upi' | 'bank' | string;
  accountHolderName: string;
  upiOrAccount: string;
  ifscOrBank?: string | null;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | string;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface BondTag {
  id: BondTagId;
  label: string;
  emoji: string;
  color: string;
  requiredGiftCost: number;
}

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  priceCoins: number;
  previewColor: string;
  description: string;
  imageUrl?: string;
  ringNumber?: number;
  seatFrameNumber?: number;
  chatFrameNumber?: number;
  styleVariant?: string;
  durationDays?: number;
  active?: boolean;
  sortOrder?: number;
}

export interface CharmLevelInfo {
  level: number;
  series: 'Star Series' | 'Diamond Series' | 'Normal Crown' | 'Advanced Crown' | 'Hard Crown';
  minCharm: number;
}

export interface VipTierInfo {
  level: number;
  minGrowth: number;
  title: string;
  perk: string;
  giftReward?: string;
  frameUnlock?: string;
  accentColor: string;
}

export interface RoomLevelInfo {
  level: number;
  title: string;
  requiredExp: number;
  memberLimit: string;
  adminSlots: number;
}

export interface RoomBackgroundTheme {
  id: string;
  name: string;
  gradient: string;
  imageUrl?: string;
  accent: string;
  ambiance: VoiceRoom['ambiance'];
}

export interface RoomTaskItem {
  id: string;
  title: string;
  rule: string;
  progress: number;
  target: number;
  rewardExp: number;
  vipDouble: boolean;
  claimed: boolean;
}

export interface MomentPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorVipLevel?: number;
  avatarId: string;
  mediaType: 'photo' | 'video';
  mediaUrl?: string;
  caption: string;
  mediaTitle: string;
  mediaGradient: string;
  timestamp: string;
  likes: number;
  liked: boolean;
  visibility?: 'public' | 'selected';
  allowedUids?: string[];
}

export interface GuardLeader {
  rank: number;
  name: string;
  uid: string;
  avatarId: string;
  guardPoints: number;
  vipLevel: number;
}

export interface IntimateSpaceData {
  partnerName: string;
  partnerAvatarId: string;
  togetherDays: number;
  relationType: 'Couple' | 'BFF';
  level: number;
  progress: number;
  target: number;
  bffTokenName: string;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  isSelf: boolean;
  bubbleColor?: string;
  bubbleFrameNumber?: number;
}

export interface ChatThread {
  friendUid: string;
  friendPublicId?: string;
  friendName: string;
  avatarId: string;
  photoUrl?: string;
  friendPhotoUrl?: string;
  friendVipLevel?: number;
  equippedFrameId?: string | null;
  status: FriendRecord['status'];
  online?: boolean;
  lastSeenAt?: string | null;
  voiceRoomUid?: string;
  voiceRoomTitle?: string;
  unread: number;
  messages: ChatMessageItem[];
}

export interface CoinPackage {
  id: string;
  coins: number;
  bonusCoins?: number;
  label: string;
  priceInr: number;
  highlight?: string;
}

export interface VipPlan {
  id: string;
  name: string;
  durationDays: number;
  priceInr: number;
  grantedVipLevel: number;
  perks: string[];
}

export interface DailyTaskItem {
  id: string;
  title: string;
  subtitle?: string;
  rewardCoins: number;
  progress: number;
  target: number;
  claimed: boolean;
}

export interface FriendRecord {
  uid: string;
  publicId?: string;
  name: string;
  avatarId: string;
  photoUrl?: string;
  equippedFrameId?: string | null;
  vipLevel?: number;
  status: 'Online' | 'Offline' | 'In Voice Room' | 'In Chats';
  online?: boolean;
  lastSeenAt?: string | null;
  voiceRoomUid?: string;
  bondTag?: string;
}

export type EmoteMotion = 'bounce' | 'sway' | 'shake' | 'pulse';

export interface ActiveEmoteState {
  emoteNumber: number;
  label: string;
  motion: EmoteMotion;
  triggeredAt: number;
}

export interface CpPartnerInfo {
  partnerUid: string;
  partnerName: string;
  partnerAvatarId: string;
  partnerPhotoUrl?: string | null;
  ringNumber: number;
  ringName: string;
  since: string;
  cpCharm?: number;
  cpLevel?: number;
}

export interface CpRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatarId: string;
  fromPhotoUrl?: string | null;
  toUid: string;
  toName: string;
  toAvatarId: string;
  toPhotoUrl?: string | null;
  ringNumber: number;
  ringName: string;
  status: 'pending' | 'accepted' | 'declined' | 'rejected';
  direction?: 'incoming' | 'outgoing';
  timestamp: string;
  respondedAt?: string | null;
}

export interface VipDecayConfig {
  enabled: boolean;
  graceDays: number;
  mode: 'fixed' | 'percent';
  dailyAmount: number;
  dailyPercent: number;
}

export interface VipPointLedgerRecord {
  id: number;
  userUid: string;
  deltaPoints: number;
  pointsAfter: number;
  vipLevelAfter: number;
  eventType: string;
  reason: string;
  actorUid?: string | null;
  actorPublicId?: string | null;
  createdAt: string;
}

export interface VipSubscriptionHistoryRecord {
  id: number;
  userUid: string;
  userPublicId?: string | null;
  userName?: string | null;
  actionType: string;
  packageId?: string | null;
  packageName?: string | null;
  monthsGranted: number;
  daysGranted: number;
  vipLevelAssigned: number;
  expiresAtBefore?: string | null;
  expiresAtAfter?: string | null;
  reason?: string | null;
  actorUid?: string | null;
  actorPublicId?: string | null;
  actorRole?: string | null;
  createdAt: string;
}

export interface CpRelationshipHistoryRecord {
  id: string;
  partnerUid: string;
  partnerName: string;
  partnerAvatarId: string;
  partnerPhotoUrl?: string | null;
  ringNumber: number;
  ringName: string;
  cpCharm: number;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt?: string | null;
}

export interface AvatarConfig {
  id: string;
  uid: string;
  publicId?: string;
  name: string;
  handle: string;
  bio?: string;
  photoUrl?: string;
  coverUrl?: string;
  gender?: 'Male' | 'Female' | 'Other';
  age?: number;
  country?: string;
  blessing?: number;
  tags?: string[];
  email?: string;
  themeMode?: 'dark' | 'light';
  equippedEmoteId?: string | null;
  activeEmote?: ActiveEmoteState;
  cpPartner?: CpPartnerInfo | null;
  relationshipTags?: Array<{
    id?: string;
    partnerUid: string;
    partnerName?: string;
    tagType: string;
    level: number;
    charmScore?: number;
    status?: string;
  }>;
  equippedFrameId?: string | null;
  lastSeenAt?: string | null;
  seatFrameNumber?: number;
  chatFrameNumber?: number;
  ownedRingNumbers?: number[];
  skinTone: string;
  hairColor: string;
  robeColor: string;
  accentColor: string;
  ornament: 'crown' | 'lotus' | 'halo' | 'visor' | 'crescent' | 'flame';
}

export interface VoiceSeat {
  seatIndex: number;
  occupant: AvatarConfig | null;
  role: 'owner' | 'admin' | 'speaker' | 'empty';
  isMuted: boolean;
  isLocked: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isUser?: boolean;
  giftScore: number;
  charmValue?: number;
  vipLevel?: number;
  bondTag?: string;
  seatEffect?: string;
  activeEmote?: ActiveEmoteState;
  relationshipTags?: Array<{
    id?: string;
    partnerUid: string;
    partnerName?: string;
    tagType: string;
    level: number;
    charmScore?: number;
    status?: string;
  }>;
}

export interface RoomListener {
  uid: string;
  name: string;
  avatarId: string;
  vipLevel: number;
  charm: number;
  isMuted?: boolean;
}

export interface MicRequest {
  userId: string;
  name: string;
  requestedAt: string;
}

export interface RoomChatMessage {
  id: string;
  senderUid?: string;
  senderName: string;
  senderColor: string;
  bubbleColor?: string;
  bubbleFrameNumber?: number;
  text: string;
  imageUrl?: string;
  emoteNumber?: number;
  timestamp: string;
  kind: 'chat' | 'gift' | 'system' | 'emote' | 'tag';
}

export interface RoomPkState {
  active: boolean;
  mode: 'gifting' | 'voting';
  format: '1v1' | 'multiplayer';
  durationMinutes?: 5 | 15 | 30 | 45 | 60;
  running: boolean;
  secondsLeft: number;
  pinkScore: number;
  blueScore: number;
  pinkTeamUids: string[];
  blueTeamUids: string[];
  votedUids: string[];
}

export interface RoomOperationRecord {
  id: string;
  actorName: string;
  actorUid?: string;
  action: string;
  detail?: string;
  createdAt: string;
}

export interface ActionRoomSlot {
  index?: number;
  uid?: string | null;
  name?: string | null;
  label?: string | null;
  occupiedName?: string | null;
  priceCoins?: number | null;
}

export interface ActionRoomState {
  actionMode: 'bidding' | 'relationship_advancement' | 'music' | 'Bidding' | 'Relationship Advancement' | 'Music';
  slots?: Array<ActionRoomSlot | null>;
  updatedBy?: string;
}

export interface RoomSettingsConfig {
  announcement?: string;
  roomMode?: 'Normal' | 'Action' | 'Video' | 'Music' | 'Game' | 'PK' | 'Chill' | 'Party';
  roomTag?: string;
  partnerSeatMode?: 'Enable All' | 'Owner & Admins' | 'Locked';
  highQualityMode?: boolean;
  banTextChat?: boolean;
  banPhotoChat?: boolean;
  banRedPacket?: boolean;
  membershipFeeCoins?: number;
  blockedUids?: string[];
  associatedGroupName?: string;
  operationRecords?: RoomOperationRecord[];
  actionRoom?: ActionRoomState;
}

export interface VoiceRoom {
  id: string;
  uid: string;
  title: string;
  topic: string;
  category: 'Popular' | 'Music' | 'Chats' | 'Teenagers';
  tags: string[];
  hostName: string;
  ownerUid: string;
  adminUids: string[];
  memberUids: string[];
  dpUrl?: string;
  isOfficial: boolean;
  isUserCreated?: boolean;
  isRoomLocked?: boolean;
  hasPasscode?: boolean;
  roomPasscode?: string;
  coinsSpentByUid?: Record<string, number>;
  pkState?: RoomPkState;
  roomType: 'voice' | 'youtube';
  level: number; // 1 to 20
  xp: number;
  listenerCount: number;
  ambiance: 'saffron' | 'emerald' | 'indigo' | 'crimson';
  bgThemeId?: string;
  bgUrl?: string;
  roomSettings?: RoomSettingsConfig;
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeQueue?: { title: string; videoId: string }[];
  status?: 'active' | 'closed';
  closedReason?: string | null;
  lockedSeats?: number[];
  seats: VoiceSeat[];
  listeners: RoomListener[];
  micRequests: MicRequest[];
  messages: RoomChatMessage[];
}

export interface ClosedRoomNotice {
  roomId: string;
  roomTitle?: string;
  reason: string;
  closedAt?: string;
}

export interface VirtualGift {
  id: GiftId;
  name: string;
  cost: number;
  charmValue: number;
  randomCoinsMin: number;
  randomCoinsMax: number;
  rarity: 'Standard' | 'Signature' | 'Mythic';
  primaryColor: string;
  secondaryColor: string;
  description: string;
  particleStyle: 'lotus' | 'crown' | 'phoenix' | 'lantern' | 'rose' | 'meteor' | 'heart' | 'vehicle';
  giftNumber: number;
  customArtworkUrl?: string;
  customVideoUrl?: string;
  isCustomApproved?: boolean;
}

export interface CustomGiftSubmission {
  id: string;
  name: string;
  cost: number;
  charmValue: number;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  particleStyle: VirtualGift['particleStyle'];
  animationVideoUrl?: string;
  videoFileName?: string;
  artworkUrl?: string;
  creatorUid: string;
  creatorName: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  submittedAt: string;
}

export interface SupportRingEvent {
  eventId: string;
  senderName: string;
  recipientUid: string;
  recipientName: string;
  ringNumber: number;
  ringName: string;
  blessingAdded: number;
}

export interface ActiveGiftEvent {
  eventId: string;
  gift: VirtualGift;
  senderName: string;
  recipientName: string;
  charmEarned?: number;
  randomCoinsEarned?: number;
  customMessage?: string;
  isBigGift?: boolean;
}

export type FriendRelationStatus =
  | 'self'
  | 'none'
  | 'friends'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'blocked_by_me'
  | 'blocked_by_them';

export interface PublicUserProfile {
  avatar: AvatarConfig;
  equippedFrameId?: string | null;
  vipLevel: number;
  charm: number;
  blessing?: number;
  ringNumber?: number;
  roomId?: string;
  roomTitle?: string;
  roomLocked?: boolean;
  friendsCount?: number;
  giftsReceived?: number;
  giftsGiven?: number;
  cpPartner?: CpPartnerInfo | null;
  activeEmote?: ActiveEmoteState;
  tags?: Array<{ title: string; level: number; partnerName: string; color: string }>;
  online?: boolean;
  lastSeenAt?: string | null;
  friendStatus?: FriendRelationStatus;
  relationId?: number | null;
}

export type AccountRole = 'normal_user' | 'support_staff' | 'moderator' | 'admin' | 'super_admin';

export interface PermanentUpiConfig {
  accountName: string;
  upiId: string;
  provider: string;
  qrDataUrl?: string;
  upiUri?: string;
  customQrDataUrl?: string | null;
  note?: string;
  active?: boolean;
  screens?: string[];
  currentVersionId?: number | null;
  updatedAt?: string;
  versionNumber?: number;
}

export interface PaymentQrVersionRecord {
  id: number;
  versionNumber: number;
  upiId: string;
  accountName: string;
  provider: string;
  customQrDataUrl?: string | null;
  qrPreviewDataUrl?: string | null;
  note?: string | null;
  active: boolean;
  screens: string[];
  updatedByUid?: string | null;
  updatedByPublicId?: string | null;
  updatedByName?: string | null;
  changeSummary?: string | null;
  createdAt: string;
}

export interface AppConfig {
  appName: string;
  tagline: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  features: {
    voiceRooms: boolean;
    discoverMoments: boolean;
    games: boolean;
    cpSystem: boolean;
    gifting: boolean;
    coinPurchases: boolean;
    vipPurchases: boolean;
  };
  voiceRoomLimits: {
    maxRoomsPerUser: number;
    defaultSeatCapacity: number;
    reconnectGraceSeconds: number;
  };
  charmRankingConfig: {
    leaderboardLimit: number;
    showWeekly: boolean;
    showMonthly: boolean;
  };
  homeBanner: {
    title: string;
    subtitle: string;
    enabled: boolean;
  };
  profileDefaults: {
    defaultBio: string;
    defaultCountry: string;
  };
  supportInfo: {
    supportEmail: string;
    notice: string;
  };
}

export interface BackendOrderRecord {
  orderId: string;
  userUid: string;
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
  expiresAt?: string | null;
  utrNumber: string | null;
  accountHolderName?: string | null;
  paymentDateTime?: string | null;
  screenshotDataUrl?: string | null;
  payerNote?: string | null;
  status: 'awaiting_payment' | 'pending_proof' | 'pending_review' | 'approved' | 'rejected' | 'expired' | 'cancelled' | string;
  reviewNote?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

export interface BackendEventRecord {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  eventType?: string;
  rewardCoins: number;
  startsAt?: string | null;
  endsAt?: string | null;
  status: string;
}

export interface BackendNotificationRecord {
  id: number;
  userUid: string | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface BackendWalletTx {
  txId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description?: string | null;
  createdAt: string;
}

export interface UserInventoryRow {
  id: number;
  userUid: string;
  itemId: string;
  category: string;
  expiresAt?: string | null;
  purchasedAt: string;
}

export interface RankingLeaderboardRow {
  rank: number;
  uid: string;
  publicId: string;
  name: string;
  photoUrl?: string | null;
  equippedFrameId?: string | null;
  vipLevel: number;
  charmPoints: number;
  giftsSentCoins: number;
  score: number;
}

export interface ActiveBanRecord {
  id: number;
  banType: 'complete' | 'mic' | 'seat' | 'chat';
  durationDays: number | null;
  expiresAt: string | null;
  reason: string;
  createdAt: string;
}

export interface ReferralSummary {
  inviteCode: string;
  rewardCoins: number;
  referredByPublicId: string | null;
  totalInvited: number;
  totalEarnedCoins: number;
  referrals: Array<{
    id: number;
    invitedPublicId: string;
    invitedName: string;
    rewardCoins: number;
    createdAt: string;
  }>;
}

export interface GameVoicePeer {
  publicId: string;
  name: string;
  muted: boolean;
}


