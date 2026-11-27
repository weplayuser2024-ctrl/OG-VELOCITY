import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  ArrowDownCircle,
  ArrowUpCircle,
  Award,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crown,
  Film,
  Flame,
  Flag,
  Gift,
  Heart,
  HelpCircle,
  ImagePlus,
  Lock,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  Music,
  Palette,
  Pause,
  Play,
  Plus,
  Power,
  Search,
  Send,
  Settings,
  Shield,
  Smile,
  Sparkles,
  Swords,
  Tag,
  Tv,
  Unlock,
  Upload,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  ACTION_ROOM_TAG_PRICES,
  RELATIONSHIP_TAG_DEFS,
  RELATIONSHIP_TAG_THRESHOLDS,
  ROOM_BACKGROUND_THEMES,
  ROOM_EMOTES,
  ROOM_LEVEL_INFO,
  SHOP_ITEMS,
  getAdminSlotCount,
  getCharmLevelInfo,
  getCpLevelInfo,
  getGenderSymbol,
  getRelationshipTagDef,
  getRelationshipTagLevelInfo,
  getRoomNextExp,
  getVipNameStyle,
} from '../data/zayroData';
import { resolveRoomBackgroundImage } from '../data/roomBackgroundAssets';
import { AvatarArt } from '../graphics/AvatarArt';
import { GiftArtwork } from '../graphics/GiftArtwork';
import {
  CharmBadgeArt,
  CharmBadgePill,
  ChatFrameMessage,
  CpHeartConnectorArt,
  EmoteSpriteArt,
  RelationshipTagSpriteArt,
  RingSpriteArt,
  RoomLevelBadgeArt,
  TagFistConnectorArt,
  VipBadgeArt,
  ZayroCoinArt,
  resolveChatFrameNumber,
} from '../graphics/SpriteArtwork';
import { uploadImageAsset } from '../utils/mediaUpload';
import { ogRealtime } from '../utils/realtimeClient';
import type {
  ActionRoomSlot,
  AvatarConfig,
  ClosedRoomNotice,
  EmoteMotion,
  FriendRecord,
  PublicUserProfile,
  RelationshipTagKey,
  RelationshipTagSummary,
  RoomListener,
  RoomSettingsConfig,
  RoomTaskItem,
  ShopItem,
  VirtualGift,
  VoiceRoom,
  VoiceSeat,
} from '../types';

export interface VipEntryShowcase {
  name: string;
  vipLevel: number;
  effectId?: string;
  fullScreenCinematic?: boolean;
}

interface VoiceRoomStageProps {
  authToken?: string | null;
  rooms: VoiceRoom[];
  activeRoom: VoiceRoom | null;
  closedRoomNotice?: ClosedRoomNotice | null;
  onDismissClosedRoomNotice?: () => void;
  onReopenRoom?: (roomId: string) => Promise<void> | void;
  isAppAdmin?: boolean;
  shopItems?: ShopItem[];
  userUid: string;
  userName: string;
  coins: number;
  charm: number;
  vipLevel: number;
  hasCreatedRoom: boolean;
  roomTasks: RoomTaskItem[];
  gifts: VirtualGift[];
  userSeatIndex: number | null;
  isMicMuted: boolean;
  isLiveMicActive: boolean;
  speakerEnabled: boolean;
  equippedBubbleColor?: string;
  equippedBubbleId?: string;
  equippedFrameId?: string;
  equippedSeatEffect?: string;
  ownedItemIds?: string[];
  vipEntryBanner: VipEntryShowcase | null;
  relationshipTags?: RelationshipTagSummary[];
  outgoingPendingFriendUids?: string[];
  roomVideoSync?: {
    roomId: string;
    sourceType: 'youtube' | 'local';
    youtubeUrl: string;
    playing: boolean;
    currentTimeSec?: number;
    title?: string;
    updatedByName?: string;
  } | null;
  onPurchaseActionTag?: (
    partnerUid: string,
    tagType: 'bro' | 'bestie' | 'sister' | 'soulmate' | 'confident'
  ) => Promise<{ ok: boolean; message: string }>;
  onRespondRelationshipTag?: (tagId: string, accept: boolean) => Promise<void> | void;
  onEndRelationshipTag?: (tagId: string) => Promise<void> | void;
  onUpdateActionRoom?: (
    actionMode: 'bidding' | 'relationship_advancement' | 'music',
    slots: ActionRoomSlot[]
  ) => void;
  onSyncVideoRoom?: (payload: {
    sourceType: 'youtube' | 'local';
    youtubeUrl: string;
    playing: boolean;
    currentTimeSec?: number;
    title?: string;
  }) => void;
  onDismissVipEntry: () => void;
  onOpenRingShop?: () => void;
  onSelectRoom: (roomId: string) => void;
  onMinimizeRoom?: () => void;
  onExitRoom: () => void;
  onOpenCreateRoom: () => void;
  onJumpToMyRoom: () => void;
  onToggleRoomMember: (roomId: string) => void;
  onUpdateRoomSettings: (
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
  ) => void;
  onToggleAdmin: (roomId: string, targetUid: string, targetName: string) => void;
  onKickUser: (roomId: string, targetUid: string, targetName: string) => void;
  onLiftUserToSeat: (roomId: string, listener: RoomListener) => void;
  onToggleMuteByUid: (roomId: string, targetUid: string) => void;
  onAddFriendByUid: (uid: string) => string;
  onJoinSeat: (seatIndex: number) => void;
  onLeaveSeat: () => void;
  onToggleMicMute: () => void;
  onToggleSpeaker: () => void;
  onToggleLockSeat: (seatIndex: number) => void;
  onToggleMuteSeat: (seatIndex: number) => void;
  onSendMessage: (text: string, imageUrl?: string) => void;
  onSendEmote: (
    emoteNumber: number,
    label: string,
    symbol: string,
    motion: EmoteMotion
  ) => void;
  friends: FriendRecord[];
  giftAnimationsEnabled: boolean;
  onToggleGiftAnimations: () => void;
  onInviteFriendToRoom: (roomId: string, friend: FriendRecord) => void;
  onSendGift: (
    gift: VirtualGift,
    recipientName: string,
    quantity?: number,
    recipientUid?: string,
    customMessage?: string
  ) => void;
  onClaimRoomTask: (taskId: string) => void;
  onInspectUser: (profile: PublicUserProfile) => void;
  onMessageUser: (uid: string, name: string) => void;
  onSendBackMessage: (uid: string, name: string, text: string) => void;
  onSupportUser?: (
    targetUid: string,
    targetName: string,
    ringNumber: number,
    ringName: string
  ) => void;
  onProposeCp?: (
    toUid: string,
    toName: string,
    toAvatarId: string,
    ringNumber: number,
    ringName: string
  ) => void;
  onTogglePkActive: (roomId: string) => void;
  onSetPkConfig: (
    roomId: string,
    config: {
      mode?: 'gifting' | 'voting';
      format?: '1v1' | 'multiplayer';
      durationMinutes?: 5 | 15 | 30 | 45 | 60;
    }
  ) => void;
  onStartPk: (roomId: string) => void;
  onEndPk: (roomId: string) => void;
  onJoinPkTeam: (roomId: string, side: 'pink' | 'blue') => void;
  onVotePkTeam: (roomId: string, side: 'pink' | 'blue') => void;
  onReportUser?: (targetType: 'user' | 'room', targetId: string, reason: string) => void;
}

interface SelectedRoomTarget {
  uid: string;
  name: string;
  avatar: AvatarConfig;
  vipLevel: number;
  charm: number;
  seatIndex?: number;
  isMuted?: boolean;
  isListener?: boolean;
}

const ROOM_DIRECTORY_TABS = ['Recents', 'Online', 'Joined', 'Games', 'Events'] as const;

const LiveVideoFeed: React.FC<{
  stream: MediaStream;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
}> = ({ stream, muted = false, mirrored = false, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`${mirrored ? '-scale-x-100' : ''} ${className}`}
    />
  );
};

export const VoiceRoomStage: React.FC<VoiceRoomStageProps> = ({
  authToken,
  rooms,
  activeRoom,
  closedRoomNotice,
  onDismissClosedRoomNotice,
  onReopenRoom,
  isAppAdmin = false,
  shopItems,
  userUid,
  userName,
  coins,
  charm,
  vipLevel,
  hasCreatedRoom,
  roomTasks,
  gifts,
  userSeatIndex,
  isMicMuted,
  isLiveMicActive,
  speakerEnabled,
  equippedBubbleColor,
  equippedBubbleId,
  equippedFrameId,
  equippedSeatEffect,
  ownedItemIds = [],
  vipEntryBanner,
  relationshipTags = [],
  outgoingPendingFriendUids = [],
  roomVideoSync = null,
  onPurchaseActionTag,
  onRespondRelationshipTag,
  onEndRelationshipTag,
  onUpdateActionRoom,
  onSyncVideoRoom,
  onDismissVipEntry,
  onOpenRingShop,
  onSelectRoom,
  onMinimizeRoom,
  onExitRoom,
  onOpenCreateRoom,
  onJumpToMyRoom,
  onToggleRoomMember,
  onUpdateRoomSettings,
  onToggleAdmin,
  onKickUser,
  onLiftUserToSeat,
  onToggleMuteByUid,
  onAddFriendByUid,
  onJoinSeat,
  onLeaveSeat,
  onToggleMicMute,
  onToggleSpeaker,
  onToggleLockSeat,
  onToggleMuteSeat,
  onSendMessage,
  onSendEmote,
  friends,
  giftAnimationsEnabled,
  onToggleGiftAnimations,
  onInviteFriendToRoom,
  onSendGift,
  onClaimRoomTask,
  onInspectUser,
  onMessageUser,
  onSendBackMessage,
  onSupportUser,
  onProposeCp,
  onTogglePkActive,
  onSetPkConfig,
  onStartPk,
  onEndPk,
  onJoinPkTeam,
  onVotePkTeam,
  onReportUser,
}) => {
  const [showRoomSearch, setShowRoomSearch] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [directoryTab, setDirectoryTab] = useState<(typeof ROOM_DIRECTORY_TABS)[number]>('Recents');
  const [chatInput, setChatInput] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<string>(
    activeRoom?.hostName || 'Ananya'
  );
  const [selectedRecipientUid, setSelectedRecipientUid] = useState<string>('');
  const [customGiftUid, setCustomGiftUid] = useState<string>('');
  const [selectedGiftId, setSelectedGiftId] = useState<string>(gifts[0]?.id || 'rose');
  const [giftQty, setGiftQty] = useState<number>(1);
  const [bigGiftMessage, setBigGiftMessage] = useState<string>('');
  const [showGiftDock, setShowGiftDock] = useState(false);
  const [showEmoteDock, setShowEmoteDock] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRoomLevelsDrawer, setShowRoomLevelsDrawer] = useState(false);
  const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false);
  const [invitedFriendUids, setInvitedFriendUids] = useState<string[]>([]);
  const [showActionTagPanel, setShowActionTagPanel] = useState(false);
  const [actionTagBusy, setActionTagBusy] = useState(false);
  const [selectedTagKey, setSelectedTagKey] = useState<RelationshipTagKey>('bro');
  const [tagTargetUidInput, setTagTargetUidInput] = useState('');
  const [showRegulationModal, setShowRegulationModal] = useState(false);
  const [editingActionSlotIndex, setEditingActionSlotIndex] = useState<number | null>(null);
  const [actionSlotLabelDraft, setActionSlotLabelDraft] = useState('');
  const [youtubeUrlDraft, setYoutubeUrlDraft] = useState('');
  const [localVideoObjectUrl, setLocalVideoObjectUrl] = useState<string | null>(null);
  const [localVideoTitle, setLocalVideoTitle] = useState('');

  // Online / Members / Contribution Sheet state
  const [showListenersDrawer, setShowListenersDrawer] = useState(false);
  const [sheetTab, setSheetTab] = useState<'online' | 'members' | 'contribution'>('contribution');
  const [contribPeriod, setContribPeriod] = useState<'Daily' | 'Weekly' | 'Total'>('Daily');
  const [showContribTip, setShowContribTip] = useState(false);

  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomPasscodeDraft, setRoomPasscodeDraft] = useState('');
  const [settingsSubPage, setSettingsSubPage] = useState<
    | 'main'
    | 'title'
    | 'cover'
    | 'announcement'
    | 'mode'
    | 'tag'
    | 'background'
    | 'partner-seat'
    | 'fees'
    | 'admins'
    | 'blocklist'
    | 'operation-record'
    | 'associated-groups'
  >('main');
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [roomTagDraft, setRoomTagDraft] = useState('');
  const [membershipFeeDraft, setMembershipFeeDraft] = useState('0');
  const [blockUidDraft, setBlockUidDraft] = useState('');
  const [associatedGroupDraft, setAssociatedGroupDraft] = useState('');
  const [showPinEditor, setShowPinEditor] = useState(false);
  const [actionTarget, setActionTarget] = useState<SelectedRoomTarget | null>(null);
  const [showCardReplyInput, setShowCardReplyInput] = useState(false);
  const [showCardCpId, setShowCardCpId] = useState(false);
  const [showSeatCpPicker, setShowSeatCpPicker] = useState(false);
  const [selectedSeatCpRingNum, setSelectedSeatCpRingNum] = useState<number>(1);
  const [cardReplyDraft, setCardReplyDraft] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [uploadProgressPct, setUploadProgressPct] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [reopeningRoom, setReopeningRoom] = useState(false);
  const [cameraActive, setCameraActive] = useState(() => ogRealtime.isCameraEnabled());
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(() =>
    ogRealtime.getLocalVideoStream()
  );
  const [remoteVideoStreams, setRemoteVideoStreams] = useState<Record<string, MediaStream>>(() =>
    ogRealtime.getRemoteVideoStreams()
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const settingsAdminsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refreshStreams = () => {
      setCameraActive(ogRealtime.isCameraEnabled());
      setLocalVideoStream(ogRealtime.getLocalVideoStream());
      setRemoteVideoStreams(ogRealtime.getRemoteVideoStreams());
    };
    refreshStreams();
    return ogRealtime.subscribeVideoStreams(refreshStreams);
  }, []);

  const openSettingsModal = (
    initialSubPage:
      | 'main'
      | 'title'
      | 'cover'
      | 'announcement'
      | 'mode'
      | 'tag'
      | 'background'
      | 'partner-seat'
      | 'fees'
      | 'admins'
      | 'blocklist'
      | 'operation-record'
      | 'associated-groups' = 'main'
  ) => {
    if (!activeRoom) return;
    setRoomNameDraft(activeRoom.title);
    setRoomPasscodeDraft(activeRoom.roomPasscode || '');
    setAnnouncementDraft(activeRoom.roomSettings?.announcement || activeRoom.topic || '');
    setRoomTagDraft(activeRoom.roomSettings?.roomTag || activeRoom.category || 'Game');
    setMembershipFeeDraft(String(activeRoom.roomSettings?.membershipFeeCoins ?? 0));
    setAssociatedGroupDraft(activeRoom.roomSettings?.associatedGroupName || '');
    setBlockUidDraft('');
    setShowPinEditor(false);
    setSettingsSubPage(initialSubPage);
    setShowSettingsModal(true);
  };

  const activeShopCatalog = useMemo(
    () => (shopItems && shopItems.length > 0 ? shopItems : SHOP_ITEMS),
    [shopItems]
  );

  const bondRingItems = useMemo(
    () =>
      activeShopCatalog.filter(
        (i) => i.category === 'ring' && ownedItemIds.includes(i.id)
      ),
    [activeShopCatalog, ownedItemIds]
  );
  const selfChatFrameNum = resolveChatFrameNumber(equippedBubbleId);

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      !roomSearchQuery.trim() ||
      r.uid.toLowerCase().includes(roomSearchQuery.trim().toLowerCase()) ||
      r.title.toLowerCase().includes(roomSearchQuery.trim().toLowerCase());
    const matchesTab =
      directoryTab === 'Recents' ||
      directoryTab === 'Online' ||
      (directoryTab === 'Joined' &&
        (r.isUserCreated || r.memberUids.includes(userUid) || r.id === activeRoom?.id)) ||
      (directoryTab === 'Games' && (r.category === 'Popular' || r.tags.includes('Popular'))) ||
      (directoryTab === 'Events' &&
        (r.category === 'Music' || r.category === 'Teenagers' || r.tags.includes('Music')));
    return matchesSearch && matchesTab;
  });

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setChatInput('');
  };

  const handleRoomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadProgressPct(10);
    setActionNotice('Uploading photo...');
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 1080,
        quality: 0.82,
        maxCompressedBytes: 680_000,
        onProgress: (pct) => setUploadProgressPct(pct),
      });
      onSendMessage(chatInput.trim() || 'Shared a photo', uploadedUrl);
      setChatInput('');
      setActionNotice(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploadProgressPct(null);
    }
  };

  const handleRoomDpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!activeRoom || !file) return;
    setUploadProgressPct(10);
    setActionNotice('Uploading Room Cover DP...');
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 720,
        quality: 0.85,
        maxCompressedBytes: 550_000,
        onProgress: (pct) => setUploadProgressPct(pct),
      });
      onUpdateRoomSettings(activeRoom.id, { dpUrl: uploadedUrl });
      notify('Room profile picture updated!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not upload Room DP image.');
    } finally {
      setUploadProgressPct(null);
    }
  };

  const handleRoomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!activeRoom || !file) return;
    setUploadProgressPct(10);
    setActionNotice('Uploading Room Wallpaper...');
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 1440,
        quality: 0.84,
        maxCompressedBytes: 750_000,
        onProgress: (pct) => setUploadProgressPct(pct),
      });
      onUpdateRoomSettings(activeRoom.id, { bgUrl: uploadedUrl });
      notify('Room background image updated!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not upload wallpaper image.');
    } finally {
      setUploadProgressPct(null);
    }
  };

  const notify = (msg: string) => {
    setActionNotice(msg);
    window.setTimeout(() => setActionNotice(null), 2600);
  };

  const selectedGift = gifts.find((g) => g.id === selectedGiftId) ?? gifts[0];

  const roomRecipientCandidates: Array<{ uid: string; name: string; avatar: AvatarConfig }> = [];
  if (activeRoom) {
    for (const s of activeRoom.seats) {
      if (s.occupant && !roomRecipientCandidates.some((c) => c.uid === s.occupant!.uid)) {
        roomRecipientCandidates.push({
          uid: s.occupant.uid,
          name: s.occupant.name,
          avatar: s.occupant,
        });
      }
    }
    for (const l of activeRoom.listeners) {
      if (!roomRecipientCandidates.some((c) => c.uid === l.uid)) {
        const av: AvatarConfig = {
          id: l.avatarId || `lis-${l.uid}`,
          uid: l.uid,
          name: l.name,
          handle: `@${l.name.toLowerCase().replace(/\s+/g, '') || 'user'}`,
          skinTone: '#D69E76',
          hairColor: '#1E293B',
          robeColor: '#06B6D4',
          accentColor: '#A5F3FC',
          ornament: 'lotus',
        };
        roomRecipientCandidates.push({ uid: l.uid, name: l.name, avatar: av });
      }
    }
  }

  const activeRecipientCandidate =
    roomRecipientCandidates.find((c) => c.uid === selectedRecipientUid) ??
    roomRecipientCandidates.find((c) => c.name === selectedRecipient) ??
    roomRecipientCandidates[0];

  const activeBg =
    ROOM_BACKGROUND_THEMES.find((b) => b.id === activeRoom?.bgThemeId) ??
    ROOM_BACKGROUND_THEMES[0];
  const nextExpTarget = activeRoom ? getRoomNextExp(activeRoom.level) : 15_000;
  const activeLevelInfo = activeRoom
    ? ROOM_LEVEL_INFO[Math.max(0, Math.min(19, activeRoom.level - 1))]
    : null;

  const isOwner = activeRoom ? activeRoom.ownerUid === userUid : false;
  const isAdmin = activeRoom ? activeRoom.adminUids.includes(userUid) : false;
  const hasModAuthority = isOwner || isAdmin;
  const isJoinedMember = activeRoom ? activeRoom.memberUids.includes(userUid) : false;
  const isClosedRoom = activeRoom?.status === 'closed';
  const currentRoomMode = activeRoom?.roomSettings?.roomMode || 'Normal';
  const isActionRoom = currentRoomMode === 'Action';
  const isVideoRoom = currentRoomMode === 'Video';
  const pendingIncomingTags = relationshipTags.filter(
    (t) => t.status === 'pending' && t.isIncoming
  );
  const actionRoomState = activeRoom?.roomSettings?.actionRoom ?? {
    actionMode: 'bidding' as const,
    slots: [
      { index: 0, label: 'No relationship set', occupiedName: null },
      { index: 1, label: 'Empty', occupiedName: null },
      { index: 2, label: 'No price set', occupiedName: null },
    ],
  };

  const extractYoutubeEmbedUrl = (rawUrl?: string | null): string | null => {
    const clean = (rawUrl || '').trim();
    if (!clean) return null;
    const ytMatch =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/.exec(clean) ||
      (/^([A-Za-z0-9_-]{11})$/.exec(clean));
    if (!ytMatch) return null;
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  };

  // Compute Contributor Leaderboard (showing exact Coins Spent per user)
  const contributorRows = useMemo(() => {
    if (!activeRoom) return [];
    const spentMap: Record<string, number> = { ...(activeRoom.coinsSpentByUid ?? {}) };
    const periodMultiplier =
      contribPeriod === 'Daily' ? 1 : contribPeriod === 'Weekly' ? 3.4 : 9.2;

    const uids = new Set<string>(Object.keys(spentMap));
    activeRoom.seats.forEach((s) => s.occupant && uids.add(s.occupant.uid));
    activeRoom.listeners.forEach((l) => uids.add(l.uid));
    uids.add(userUid);

    const rows = Array.from(uids).map((uid) => {
      const seat = activeRoom.seats.find((s) => s.occupant?.uid === uid);
      const lis = activeRoom.listeners.find((l) => l.uid === uid);
      const isMe = uid === userUid;
      const avatar: AvatarConfig = isMe
        ? {
            id: 'user-self',
            uid: userUid,
            name: userName,
            handle: `@${userName.toLowerCase()}`,
            skinTone: '#E0AC89',
            hairColor: '#1E293B',
            robeColor: '#F59E0B',
            accentColor: '#FBBF24',
            ornament: 'crown',
          }
        : seat?.occupant ?? {
            id: lis?.avatarId ?? `u-${uid}`,
            uid,
            name: lis?.name ?? `User ${uid.slice(-4)}`,
            handle: `@user`,
            skinTone: '#D69E76',
            hairColor: '#1E293B',
            robeColor: '#06B6D4',
            accentColor: '#A5F3FC',
            ornament: 'lotus',
          };

      const rawSpend = spentMap[uid] ?? (seat ? seat.giftScore * 10 : 0);
      const coinsSpent = Math.round(rawSpend * periodMultiplier);
      const rowVip = isMe ? vipLevel : (seat?.vipLevel ?? lis?.vipLevel ?? 0);
      const rowCharm = isMe ? charm : (seat?.charmValue ?? lis?.charm ?? 0);

      return {
        uid,
        name: avatar.name,
        avatar,
        vipLevel: rowVip,
        charmLevel: getCharmLevelInfo(rowCharm).current.level,
        coinsSpent,
      };
    });

    return rows
      .filter((r) => r.coinsSpent > 0 || r.uid === userUid)
      .sort((a, b) => b.coinsSpent - a.coinsSpent);
  }, [activeRoom, contribPeriod, userUid, userName, vipLevel, charm]);

  const userContribIndex = contributorRows.findIndex((r) => r.uid === userUid);
  const userContribRow = userContribIndex >= 0 ? contributorRows[userContribIndex] : null;
  const top3Contributors = contributorRows.slice(0, 3);

  const entryItem = vipEntryBanner?.effectId
    ? SHOP_ITEMS.find((i) => i.id === vipEntryBanner.effectId)
    : undefined;

  const entryEffectMeta = (() => {
    const variant = entryItem?.styleVariant || 'flame';
    if (variant === 'car') {
      return {
        icon: '🏎️',
        gradient: 'linear-gradient(90deg, rgba(56,189,248,0.65), rgba(37,99,235,0.45), rgba(13,12,24,0.85))',
        border: '#38BDF8',
      };
    }
    if (variant === 'river') {
      return {
        icon: '🌊',
        gradient: 'linear-gradient(90deg, rgba(34,211,238,0.65), rgba(6,182,212,0.4), rgba(13,12,24,0.85))',
        border: '#22D3EE',
      };
    }
    if (variant === 'golden-palace') {
      return {
        icon: '🏛️',
        gradient: 'linear-gradient(90deg, rgba(253,224,71,0.7), rgba(245,158,11,0.45), rgba(13,12,24,0.85))',
        border: '#FDE047',
      };
    }
    if (variant === 'throne') {
      return {
        icon: '👑',
        gradient: 'linear-gradient(90deg, rgba(239,68,68,0.65), rgba(245,158,11,0.4), rgba(13,12,24,0.85))',
        border: '#EF4444',
      };
    }
    if (variant === 'crab') {
      return {
        icon: '🦀',
        gradient: 'linear-gradient(90deg, rgba(249,115,22,0.65), rgba(244,63,94,0.4), rgba(13,12,24,0.85))',
        border: '#F97316',
      };
    }
    return {
      icon: '🔥',
      gradient: 'linear-gradient(90deg, rgba(251,191,36,0.65), rgba(168,85,247,0.4), rgba(13,12,24,0.85))',
      border: '#FBBF24',
    };
  })();

  const openTargetByUid = (uid: string, fallbackName: string) => {
    if (!activeRoom) return;
    const seatMatch = activeRoom.seats.find((s) => s.occupant?.uid === uid);
    if (seatMatch?.occupant) {
      setActionTarget({
        uid: seatMatch.occupant.uid,
        name: seatMatch.occupant.name,
        avatar: seatMatch.occupant,
        vipLevel: seatMatch.isUser ? vipLevel : (seatMatch.vipLevel ?? 0),
        charm: seatMatch.isUser ? charm : (seatMatch.charmValue ?? 0),
        seatIndex: seatMatch.seatIndex,
        isMuted: seatMatch.isMuted,
      });
      return;
    }
    const listenerMatch = activeRoom.listeners.find((l) => l.uid === uid);
    const displayName = listenerMatch?.name ?? fallbackName;
    const av: AvatarConfig = {
      id: listenerMatch?.avatarId || `ext-${uid}`,
      uid,
      name: displayName,
      handle: `@${displayName.toLowerCase().replace(/\s+/g, '') || 'user'}`,
      skinTone: '#D69E76',
      hairColor: '#1E293B',
      robeColor: '#06B6D4',
      accentColor: '#A5F3FC',
      ornament: 'crown',
    };
    setActionTarget({
      uid,
      name: displayName,
      avatar: av,
      vipLevel: listenerMatch?.vipLevel ?? 0,
      charm: listenerMatch?.charm ?? 0,
      isMuted: listenerMatch?.isMuted,
      isListener: true,
    });
  };

  const openCpPartnerProfileFromCard = (target: SelectedRoomTarget) => {
    const cp = target.avatar.cpPartner;
    if (!cp || !activeRoom) return;
    const seatMatch = activeRoom.seats.find((s) => s.occupant?.uid === cp.partnerUid);
    const partnerAvatar: AvatarConfig = seatMatch?.occupant ?? {
      id: cp.partnerAvatarId || `cp-${cp.partnerUid}`,
      uid: cp.partnerUid,
      name: cp.partnerName,
      photoUrl: cp.partnerPhotoUrl || undefined,
      handle: `@${cp.partnerName.toLowerCase().replace(/\s+/g, '')}`,
      skinTone: '#D69E76',
      hairColor: '#1E293B',
      robeColor: '#06B6D4',
      accentColor: '#A5F3FC',
      ornament: 'lotus',
    };
    const reciprocalCp = {
      partnerUid: target.uid,
      partnerName: target.name,
      partnerAvatarId: target.avatar.id,
      ringNumber: cp.ringNumber,
      ringName: cp.ringName,
      cpCharm: cp.cpCharm,
      since: cp.since,
    };
    onInspectUser({
      avatar: { ...partnerAvatar, cpPartner: reciprocalCp },
      vipLevel: seatMatch?.isUser ? vipLevel : (seatMatch?.vipLevel ?? 0),
      charm: seatMatch?.isUser ? charm : (seatMatch?.charmValue ?? (cp.cpCharm ?? 0)),
      cpPartner: reciprocalCp,
      ringNumber: cp.ringNumber,
      roomId: activeRoom.id,
      roomTitle: activeRoom.title,
    });
    setActionTarget(null);
    setShowCardReplyInput(false);
    setShowCardCpId(false);
  };

  // Enlarged seat DPs; Seat 0 reserved exclusively for Room Owner ("Leave" when absent)
  const renderCircularSeat = (
    seat: VoiceSeat,
    isTopSeat: boolean,
    pkBadgeSide?: 'pink' | 'blue',
    isVideoCompact?: boolean
  ) => {
    const isStandardRoom = !activeRoom?.isOfficial;
    const avatarSize = isVideoCompact
      ? 38
      : pkBadgeSide
        ? 54
        : isStandardRoom
          ? isTopSeat
            ? 68
            : 56
          : isTopSeat
            ? 54
            : 44;
    const emptyRingClass = isVideoCompact
      ? 'h-[38px] w-[38px]'
      : pkBadgeSide
        ? 'h-[54px] w-[54px]'
        : isStandardRoom
          ? isTopSeat
            ? 'h-[68px] w-[68px]'
            : 'h-[56px] w-[56px]'
          : isTopSeat
            ? 'h-[54px] w-[54px]'
            : 'h-[44px] w-[44px]';

    const ringBorderClass =
      pkBadgeSide === 'pink'
        ? 'border-2 border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.55)]'
        : pkBadgeSide === 'blue'
          ? 'border-2 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.55)]'
          : '';

    const isOwnerOnlySeat = seat.seatIndex === 0;
    const rawOccupant = seat.occupant;
    const occupant =
      isOwnerOnlySeat && rawOccupant && activeRoom && rawOccupant.uid !== activeRoom.ownerUid
        ? null
        : rawOccupant;

    if (!occupant) {
      return (
        <div key={seat.seatIndex} className="relative flex flex-col items-center">
          {hasModAuthority && !isOwnerOnlySeat && (
            <button
              type="button"
              onClick={() => onToggleLockSeat(seat.seatIndex)}
              title={seat.isLocked ? 'Unlock seat' : 'Lock seat'}
              className="absolute -top-1 right-0 z-20 rounded-full border border-white/15 bg-[#0D1526] p-0.5 text-slate-300 hover:text-amber-300"
            >
              {seat.isLocked ? (
                <Lock className="h-2.5 w-2.5 text-rose-400" />
              ) : (
                <Unlock className="h-2.5 w-2.5" />
              )}
            </button>
          )}

          <button
            type="button"
            disabled={seat.isLocked || isClosedRoom}
            onClick={() => {
              if (isClosedRoom) {
                notify('Room is currently closed. Waiting for Owner or Room Admin to enter.');
                return;
              }
              if (isOwnerOnlySeat && !isOwner) {
                notify('Owner Seat is reserved exclusively for the Room Owner.');
                return;
              }
              if (isOwner && !isOwnerOnlySeat) {
                notify('Owner Seat (Seat 1) is permanent; Room Owner cannot switch seat positions.');
                return;
              }
              onJoinSeat(seat.seatIndex);
            }}
            className="group flex flex-col items-center disabled:cursor-not-allowed"
          >
            <div
              className={`flex items-center justify-center rounded-full border transition-colors ${emptyRingClass} ${
                pkBadgeSide === 'pink'
                  ? 'border-2 border-pink-400 bg-pink-500/15 text-pink-200'
                  : pkBadgeSide === 'blue'
                    ? 'border-2 border-sky-400 bg-sky-500/15 text-sky-200'
                    : seat.isLocked
                      ? 'border-rose-500/50 bg-rose-950/35 text-rose-400'
                      : isOwnerOnlySeat
                        ? 'border-amber-400/75 bg-amber-500/15 text-amber-200 hover:border-amber-300'
                        : 'border-[1.5px] border-purple-400/60 bg-[#120D1E]/75 text-amber-300 shadow-[0_0_12px_rgba(168,85,247,0.22)] hover:border-purple-300'
              }`}
            >
              {seat.isLocked ? (
                <Lock className="h-3 w-3" />
              ) : isOwnerOnlySeat && !isOwner ? (
                <Crown className="h-3.5 w-3.5 text-amber-300/80" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </div>
            {pkBadgeSide ? (
              <span
                className={`-mt-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black text-white shadow ${
                  pkBadgeSide === 'pink'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                    : 'bg-gradient-to-r from-sky-500 to-blue-600'
                }`}
              >
                PK
              </span>
            ) : (
              <span
                className={`mt-0.5 text-[8.5px] font-semibold ${
                  isOwnerOnlySeat && !seat.isLocked ? 'text-amber-300' : 'text-slate-300'
                }`}
              >
                {seat.isLocked ? 'Locked' : isOwnerOnlySeat ? 'Owner' : `Seat ${seat.seatIndex + 1}`}
              </span>
            )}
          </button>
        </div>
      );
    }

    const seatCharm = seat.isUser ? charm : (seat.charmValue ?? Math.round(seat.giftScore / 5));
    const seatCharmLevel = getCharmLevelInfo(seatCharm).current.level;
    const seatVip = Math.min(18, seat.isUser ? vipLevel : (seat.vipLevel ?? 0));
    const resolvedSeatFrameId = seat.isUser
      ? equippedFrameId
      : occupant.seatFrameNumber
        ? `frame-${occupant.seatFrameNumber}`
        : undefined;
    const resolvedSeatFrameImageUrl = resolvedSeatFrameId
      ? activeShopCatalog.find((s) => s.id === resolvedSeatFrameId)?.imageUrl
      : undefined;
    const hasBlazingFx =
      seat.seatEffect === 'Blazing Fire' ||
      (seat.isUser && equippedSeatEffect === 'Blazing Fire Seat FX');

    return (
      <div key={seat.seatIndex} className="relative flex flex-col items-center">
        <div
          onClick={() => {
            setSelectedRecipient(occupant.name);
            setActionTarget({
              uid: occupant.uid,
              name: occupant.name,
              avatar: occupant,
              vipLevel: seatVip,
              charm: seatCharm,
              seatIndex: seat.seatIndex,
              isMuted: seat.isMuted,
            });
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedRecipient(occupant.name);
              setActionTarget({
                uid: occupant.uid,
                name: occupant.name,
                avatar: occupant,
                vipLevel: seatVip,
                charm: seatCharm,
                seatIndex: seat.seatIndex,
                isMuted: seat.isMuted,
              });
            }
          }}
          className={`relative cursor-pointer overflow-visible rounded-full transition-transform hover:scale-105 ${ringBorderClass}`}
          style={hasBlazingFx ? { boxShadow: '0 0 16px rgba(249,115,22,0.5)' } : undefined}
        >
          {hasBlazingFx && (
            <span className="absolute -top-0.5 -left-0.5 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500/90 text-white">
              <Flame className="h-2 w-2" />
            </span>
          )}
          {seat.activeEmote && (
            <div
              style={{ width: avatarSize + 14, height: avatarSize + 14 }}
              className="pointer-events-none absolute inset-0 m-auto z-30 flex items-center justify-center rounded-full border-2 border-cyan-300/90 bg-cyan-950/35 shadow-[0_0_20px_rgba(34,211,238,0.7)] ring-4 ring-cyan-400/25"
            >
              <EmoteSpriteArt
                emoteNumber={seat.activeEmote.emoteNumber}
                size={Math.round(avatarSize * 0.72)}
                alt={seat.activeEmote.label}
                animated
                motion={seat.activeEmote.motion}
              />
            </div>
          )}
          <AvatarArt
            avatar={occupant}
            size={avatarSize}
            isMuted={seat.isMuted}
            frameId={resolvedSeatFrameId}
            frameImageUrl={resolvedSeatFrameImageUrl}
            seatFrameNumber={seat.isUser ? undefined : occupant.seatFrameNumber}
          />
          {seat.isMuted && (
            <span className="absolute right-0 bottom-0 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-white">
              <MicOff className="h-2 w-2" />
            </span>
          )}
        </div>

        {pkBadgeSide && (
          <span
            className={`-mt-1.5 z-10 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black text-white shadow ${
              pkBadgeSide === 'pink'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                : 'bg-gradient-to-r from-sky-500 to-blue-600'
            }`}
          >
            <Armchair className="h-2.5 w-2.5" />
            <span>PK</span>
          </span>
        )}

        {/* Name + Charm Badge + VIP Badge (Relationship Tag badges appear only when paired adjacent) */}
        <button
          type="button"
          onClick={() =>
            setActionTarget({
              uid: occupant.uid,
              name: occupant.name,
              avatar: occupant,
              vipLevel: seatVip,
              charm: seatCharm,
              seatIndex: seat.seatIndex,
              isMuted: seat.isMuted,
            })
          }
          className={`mt-0.5 flex items-center gap-0.5 rounded px-0.5 hover:bg-white/10 ${
            isVideoCompact ? 'max-w-[52px]' : 'max-w-[90px]'
          }`}
          title="Tap for Actions / ID"
        >
          <span
            className={`truncate font-bold ${isVideoCompact ? 'text-[8px]' : 'text-[9.5px]'}`}
            style={getVipNameStyle(seatVip)}
          >
            {occupant.name}
          </span>
          {!isVideoCompact && <CharmBadgeArt level={seatCharmLevel} size={11} />}
          <VipBadgeArt level={seatVip} size={isVideoCompact ? 10 : 12} />
        </button>

        {/* Clickable Public ID tag */}
        {!isVideoCompact && (
          <button
            type="button"
            onClick={() => openTargetByUid(occupant.publicId || occupant.uid, occupant.name)}
            className="font-mono-tabular text-[7.5px] text-slate-400 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            {occupant.publicId || occupant.uid}
          </button>
        )}
      </div>
    );
  };

  // ROOMS DIRECTORY VIEW (Direct Room Entry — no outside closed/reopen blocker)
  if (!activeRoom) {

    const myCreatedRoom = rooms.find((r) => r.isUserCreated || r.ownerUid === userUid);
    const orderedDirectoryRooms = [
      ...(myCreatedRoom ? [myCreatedRoom] : []),
      ...filteredRooms.filter((r) => r.id !== myCreatedRoom?.id),
    ];
    return (
      <div className="space-y-4">
        {/* Top YOUR ROOM Banner matching screenshot */}
        <div
          className="relative overflow-hidden rounded-2xl border border-purple-300/20 px-4 py-4 shadow-xl"
          style={{
            background:
              'linear-gradient(125deg, #2B1F4E 0%, #523269 55%, #C78F97 100%)',
          }}
        >
          {/* Subtle Decorative Watermark Emblem */}
          <svg
            width="126"
            height="86"
            viewBox="0 0 120 84"
            className="pointer-events-none absolute -right-1 -bottom-3 text-purple-200/25"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M60 12C50 28 48 48 60 66C72 48 70 28 60 12Z"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M60 66C42 56 26 42 22 24C36 28 50 42 60 66Z"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M60 66C78 56 94 42 98 24C84 28 70 42 60 66Z"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M60 68C36 66 16 58 8 44C24 44 42 52 60 68Z"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M60 68C84 66 104 58 112 44C96 44 78 52 60 68Z"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold tracking-widest text-white/75 uppercase">
                YOUR ROOM
              </div>
              <div className="font-display mt-0.5 truncate text-lg font-extrabold text-white">
                {myCreatedRoom ? myCreatedRoom.title : `${userName}'s Sanctuary`}
              </div>
              <div className="mt-0.5 text-xs text-white/80">
                {myCreatedRoom && myCreatedRoom.listenerCount > 0
                  ? `${myCreatedRoom.listenerCount} online · UID ${myCreatedRoom.uid}`
                  : 'Nobody in right now'}
              </div>
            </div>

            <button
              type="button"
              onClick={hasCreatedRoom ? onJumpToMyRoom : onOpenCreateRoom}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-[#43235C] shadow-lg transition-transform hover:scale-105"
            >
              <span>{hasCreatedRoom ? 'Enter' : 'Create'}</span>
              <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>
        </div>

        {/* Underline Directory Tabs + Search Toggle */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-0.5">
          <div className="flex items-center gap-5 overflow-x-auto">
            {ROOM_DIRECTORY_TABS.map((tab) => {
              const active = directoryTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDirectoryTab(tab)}
                  className={`relative pb-2.5 text-sm font-bold whitespace-nowrap transition-colors ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                  {active && (
                    <span className="absolute right-0 bottom-0 left-0 h-[3px] rounded-full bg-purple-400" />
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowRoomSearch((v) => !v)}
            aria-label="Search Room ID"
            className={`mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
              showRoomSearch
                ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                : 'border-white/10 bg-[#171124] text-slate-300 hover:text-white'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>

        {showRoomSearch && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={roomSearchQuery}
              onChange={(e) => setRoomSearchQuery(e.target.value)}
              placeholder="Search Room ID (e.g. 10482, 10001)..."
              className="w-full rounded-2xl border border-white/10 bg-[#171124] py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
            />
          </div>
        )}

        {/* Minimal Room Rows matching Screenshot_2026_1120_161814 */}
        <div className="space-y-1">
          {orderedDirectoryRooms.map((room) => {
            const hostAv = room.seats.find((s) => s.occupant?.uid === room.ownerUid)?.occupant;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => {
                  onSelectRoom(room.id);
                  setSelectedRecipient(room.hostName);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  {room.dpUrl ? (
                    <img
                      src={room.dpUrl}
                      alt={room.title}
                      className="h-13 w-13 shrink-0 rounded-2xl object-cover"
                    />
                  ) : hostAv?.photoUrl ? (
                    <img
                      src={hostAv.photoUrl}
                      alt={room.title}
                      className="h-13 w-13 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-[#251E38]">
                      <RoomLevelBadgeArt level={room.level} size={34} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {room.isRoomLocked && (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      )}
                      <h3 className="font-display truncate text-sm font-bold text-white">
                        {room.title}
                      </h3>
                      {(room.isUserCreated || room.ownerUid === userUid) && (
                        <span className="shrink-0 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-200">
                          Yours
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-emerald-400">
                        {room.listenerCount} online
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono-tabular text-[11px] text-slate-400">
                        ID {room.uid}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-slate-500" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // PK Helper State
  const pk = activeRoom.pkState;
  const pkActive = !!pk?.active;
  const pkTotalScore = (pk?.pinkScore ?? 0) + (pk?.blueScore ?? 0);
  const pinkPercent = pkTotalScore > 0 ? Math.max(12, Math.min(88, Math.round(((pk?.pinkScore ?? 0) / pkTotalScore) * 100))) : 50;
  const pkMins = pk ? String(Math.floor(pk.secondsLeft / 60)).padStart(2, '0') : '03';
  const pkSecs = pk ? String(pk.secondsLeft % 60).padStart(2, '0') : '00';

  const topSeatSliceEnd = activeRoom.isOfficial ? 3 : 2;
  const topSeats = activeRoom.seats.slice(0, topSeatSliceEnd);
  const bottomSeats = activeRoom.seats.slice(topSeatSliceEnd);
  const halfBottom = Math.ceil(bottomSeats.length / 2);

  // Detect active CP connections currently seated together in the Voice Room
  const checkCpPair = (a: AvatarConfig | null | undefined, b: AvatarConfig | null | undefined): number | null => {
    if (!a || !b) return null;
    const isLinked =
      a.cpPartner?.partnerUid === b.uid ||
      b.cpPartner?.partnerUid === a.uid;
    if (!isLinked) return null;
    const charmSum = Math.max(a.cpPartner?.cpCharm ?? 0, b.cpPartner?.cpCharm ?? 0);
    return getCpLevelInfo(charmSum).level;
  };

  const checkRelTagPair = (
    a: AvatarConfig | null | undefined,
    b: AvatarConfig | null | undefined
  ): { tagType: string; level: number } | null => {
    if (!a || !b) return null;
    const aTags = (a.relationshipTags ?? []).filter((t) => !t.status || t.status === 'active');
    const bTags = (b.relationshipTags ?? []).filter((t) => !t.status || t.status === 'active');
    const match =
      aTags.find((t) => t.partnerUid === b.uid || (b.publicId && t.partnerUid === b.publicId)) ||
      bTags.find((t) => t.partnerUid === a.uid || (a.publicId && t.partnerUid === a.publicId));
    if (!match) return null;
    return {
      tagType: match.tagType,
      level: match.level || getRelationshipTagLevelInfo(match.charmScore ?? 0).level,
    };
  };

  const renderSeatRowWithCpHearts = (
    rowSeats: VoiceSeat[],
    isTop: boolean,
    colsClass: string,
    maxWidthClass: string,
    isVideoCompact?: boolean
  ) => {
    const colCount = rowSeats.length;
    const adjacentPairs: Array<{ idx: number; cpLevel: number }> = [];
    const adjacentTagPairs: Array<{ idx: number; tagType: string; level: number }> = [];
    for (let i = 0; i < rowSeats.length - 1; i++) {
      const lvl = checkCpPair(rowSeats[i]?.occupant, rowSeats[i + 1]?.occupant);
      if (lvl !== null) {
        adjacentPairs.push({ idx: i, cpLevel: lvl });
      }
      const tagMatch = checkRelTagPair(rowSeats[i]?.occupant, rowSeats[i + 1]?.occupant);
      if (tagMatch) {
        const isLoverTag = tagMatch.tagType === 'lover' || tagMatch.tagType === 'cp_partner';
        if (isLoverTag && lvl === null) {
          adjacentPairs.push({ idx: i, cpLevel: tagMatch.level });
        } else if (!isLoverTag) {
          adjacentTagPairs.push({ idx: i, ...tagMatch });
        }
      }
    }
    return (
      <div className={`relative mx-auto grid justify-items-center ${isVideoCompact ? 'gap-1' : 'gap-2'} ${maxWidthClass} ${colsClass}`}>
        {rowSeats.map((seat) => renderCircularSeat(seat, isTop, undefined, isVideoCompact))}
        {adjacentPairs.map(({ idx, cpLevel }) => {
          const leftPercent = ((idx + 1) / colCount) * 100;
          return (
            <div
              key={`cp-heart-row-${rowSeats[idx]?.seatIndex}-${rowSeats[idx + 1]?.seatIndex}`}
              style={{ left: `${leftPercent}%` }}
              className="pointer-events-none absolute top-2.5 z-30 flex -translate-x-1/2 flex-col items-center animate-pulse"
              title={`Lover / CP Bond Lv.${cpLevel}`}
            >
              <CpHeartConnectorArt size={isTop ? 44 : 38} cpLevel={cpLevel} />
              <RelationshipTagSpriteArt tagType="lover" level={cpLevel} size={22} className="-mt-1" />
            </div>
          );
        })}
        {adjacentTagPairs.map(({ idx, tagType, level }) => {
          const leftPercent = ((idx + 1) / colCount) * 100;
          const def = getRelationshipTagDef(tagType);
          return (
            <div
              key={`rel-tag-row-${rowSeats[idx]?.seatIndex}-${rowSeats[idx + 1]?.seatIndex}`}
              style={{ left: `${leftPercent}%` }}
              className="pointer-events-none absolute top-3 z-30 flex -translate-x-1/2 flex-col items-center"
              title={`${def.label} Lv.${level}`}
            >
              <TagFistConnectorArt size={isTop ? 40 : 34} label={def.label} level={level} />
              <RelationshipTagSpriteArt
                tagType={tagType}
                level={level}
                size={22}
                className="-mt-1"
              />
            </div>
          );
        })}
      </div>
    );
  };

  const bottomSeatRows: VoiceSeat[][] = [];
  for (let i = 0; i < bottomSeats.length; i += 4) {
    bottomSeatRows.push(bottomSeats.slice(i, i + 4));
  }

  // Also detect any seated CP pair across different rows so the heart connector always renders when together
  const crossRowCpBonds = (() => {
    const seated = activeRoom.seats.filter((s) => s.occupant);
    const pairs: Array<{ aName: string; bName: string; cpLevel: number; key: string }> = [];
    const seen = new Set<string>();
    for (let i = 0; i < seated.length; i++) {
      for (let j = i + 1; j < seated.length; j++) {
        const sA = seated[i];
        const sB = seated[j];
        const lvl = checkCpPair(sA.occupant, sB.occupant);
        if (lvl !== null) {
          // Check if already adjacent in topSeats or within a 4-seat bottom row
          const sameTopAdjacent =
            sA.seatIndex < topSeatSliceEnd &&
            sB.seatIndex < topSeatSliceEnd &&
            Math.abs(sA.seatIndex - sB.seatIndex) === 1;
          const bA = sA.seatIndex - topSeatSliceEnd;
          const bB = sB.seatIndex - topSeatSliceEnd;
          const sameBottomAdjacent =
            bA >= 0 &&
            bB >= 0 &&
            Math.floor(bA / 4) === Math.floor(bB / 4) &&
            Math.abs(bA - bB) === 1;
          if (!sameTopAdjacent && !sameBottomAdjacent) {
            const pairKey = [sA.occupant!.uid, sB.occupant!.uid].sort().join(':');
            if (!seen.has(pairKey)) {
              seen.add(pairKey);
              pairs.push({
                aName: sA.occupant!.name,
                bName: sB.occupant!.name,
                cpLevel: lvl,
                key: pairKey,
              });
            }
          }
        }
      }
    }
    return pairs;
  })();

  // ACTIVE VOICE ROOM STAGE (True Full-Screen Edge-to-Edge Layout)
  const resolvedStageBg = activeRoom.bgUrl || resolveRoomBackgroundImage(activeRoom.bgThemeId);
  return (
    <div
      style={
        resolvedStageBg
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(7,11,20,0.42) 0%, rgba(7,11,20,0.8) 100%), url(${resolvedStageBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { background: activeBg.gradient }
      }
      className="fixed inset-0 z-50 h-dvh w-screen overflow-hidden"
    >
      <div className="relative mx-auto flex h-full w-full max-w-xl flex-col justify-between p-2.5 sm:p-4">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Top Bar: Minimize + Room Name & Room-Level Badge + Join (left) | Top-3 Avatars + Invite + Settings + Exit (right) */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={onMinimizeRoom ?? onExitRoom}
                aria-label="Minimize Room"
                title="Minimize Room (keeps room pill open)"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white hover:bg-black/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowRoomLevelsDrawer((v) => !v)}
                className="flex min-w-0 items-center gap-1 rounded-full border border-white/15 bg-black/45 py-0.5 pr-1.5 pl-1 text-left backdrop-blur-sm hover:border-cyan-400/50"
                title="View Room Level Batches (Lv.1–20)"
              >
                {activeRoom.dpUrl && (
                  <img
                    src={activeRoom.dpUrl}
                    alt={activeRoom.title}
                    className="h-5.5 w-5.5 shrink-0 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="max-w-[66px] truncate text-[10.5px] font-bold text-white">
                      {activeRoom.title}
                    </span>
                    <RoomLevelBadgeArt level={activeRoom.level} size={16} />
                    {activeRoom.isRoomLocked && <Lock className="h-2.5 w-2.5 text-amber-300" />}
                  </div>
                  <div className="font-mono-tabular text-[8px] text-slate-300">
                    ID {activeRoom.uid}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleRoomMember(activeRoom.id);
                  notify(
                    isJoinedMember
                      ? `Left membership of ${activeRoom.title}`
                      : `Joined ${activeRoom.title} as a Member!`
                  );
                }}
                className={`inline-flex h-6.5 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[9px] font-bold whitespace-nowrap transition-colors ${
                  isJoinedMember
                    ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:opacity-95'
                }`}
              >
                {isJoinedMember ? (
                  <>
                    <Check className="h-2.5 w-2.5" />
                    <span>Joined</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-2.5 w-2.5" />
                    <span>Join</span>
                  </>
                )}
              </button>
            </div>

            {/* Top-Right: Contribution Pill Only */}
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => {
                  setSheetTab('contribution');
                  setShowListenersDrawer((v) => !v);
                }}
                className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-0.5 hover:border-cyan-400/50"
                title="View Online, Members & Contribution"
              >
                <div className="flex -space-x-1">
                  {top3Contributors.map((c, idx) => (
                    <div key={c.uid} className="relative">
                      <AvatarArt avatar={c.avatar} size={19} />
                      <span
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1 font-mono-tabular text-[6.5px] font-black text-slate-950 ${
                          idx === 0
                            ? 'bg-amber-300'
                            : idx === 1
                              ? 'bg-slate-200'
                              : 'bg-orange-300'
                        }`}
                      >
                        {c.coinsSpent >= 1000 ? `${Math.round(c.coinsSpent / 1000)}k` : c.coinsSpent}
                      </span>
                    </div>
                  ))}
                </div>
                <span className="ml-0.5 rounded-full bg-white/10 px-1 py-0.5 font-mono-tabular text-[9.5px] font-bold text-white">
                  {activeRoom.listenerCount}
                </span>
              </button>
            </div>
          </div>

          {/* Relocated Quick Room Controls Row + Mode Switcher + Tags */}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/45 p-0.5">
              {(['Normal', 'Action', 'Video'] as const).map((m) => {
                const activeM = currentRoomMode === m || (m === 'Normal' && !isActionRoom && !isVideoRoom);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (!hasModAuthority) {
                        notify('Only Room Owner or Admin can switch the room mode.');
                        return;
                      }
                      if (m === 'Action') setShowGiftDock(false);
                      onUpdateRoomSettings(activeRoom.id, { roomSettings: { roomMode: m } });
                      notify(`Switched to ${m} Mode`);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold transition-colors ${
                      activeM
                        ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m === 'Video' && <Video className="h-2.5 w-2.5" />}
                    <span>{m}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowInviteFriendsModal(true)}
                aria-label="Invite Friends"
                title="Invite Friends to Voice Room"
                className="flex h-7 items-center gap-1 rounded-full border border-cyan-400/35 bg-cyan-500/20 px-2.5 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/35 hover:text-white"
              >
                <UserPlus className="h-3 w-3" />
                <span>Invite</span>
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => openSettingsModal('admins')}
                  aria-label="Manage Admins"
                  title="Manage Room Admins"
                  className="flex h-7 items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/20 px-2 text-[10px] font-bold text-sky-200 hover:bg-sky-500/35 hover:text-white"
                >
                  <Shield className="h-3 w-3" />
                  <span>Admins</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowRegulationModal(true)}
                aria-label="Room Regulations"
                title="Regulations Of The Voice Room"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/45 text-slate-200 hover:border-purple-400/60"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (showSettingsModal) {
                    setShowSettingsModal(false);
                  } else {
                    openSettingsModal('main');
                  }
                }}
                aria-label="Room Settings"
                title="Room Settings"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white hover:border-cyan-400/50 hover:bg-black/65"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>

              {onReportUser && activeRoom.ownerUid !== userUid && (
                <button
                  type="button"
                  onClick={() => {
                    onReportUser('room', activeRoom.id, `Room report for ${activeRoom.title}`);
                    notify('Room report submitted to moderation team');
                  }}
                  aria-label="Report Room"
                  title="Report Voice Room"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500 hover:text-slate-950"
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onExitRoom}
                aria-label="Exit Voice Room"
                title="Exit Voice Room Completely"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {actionNotice && (
            <div className="mt-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
              <div>{actionNotice}</div>
              {uploadProgressPct !== null && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-200"
                    style={{ width: `${uploadProgressPct}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* VIP 15 Full-Screen Non-Interrupting Entrance Showcase */}
          {vipEntryBanner && (vipEntryBanner.fullScreenCinematic || vipEntryBanner.vipLevel >= 15) ? (
            <div
              role="presentation"
              className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center overflow-hidden"
            >
              {/* Soft full-screen radial aura + light rays (non-blocking) */}
              <div
                className="absolute inset-0 animate-pulse"
                style={{
                  background:
                    'radial-gradient(circle at 50% 42%, rgba(250,204,21,0.22) 0%, rgba(168,85,247,0.18) 38%, rgba(15,23,42,0.08) 72%, transparent 100%)',
                }}
              />
              <div
                className="animate-entry-ribbon relative mx-4 flex w-full max-w-md flex-col items-center rounded-3xl border border-amber-300/60 bg-gradient-to-br from-[#1C1034]/90 via-[#2E1065]/90 to-[#0B1224]/92 px-6 py-5 text-center shadow-[0_0_60px_rgba(250,204,21,0.45)] backdrop-blur-sm"
              >
                <div className="mb-2 flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-500/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  <span>Sovereign Apex VIP {vipEntryBanner.vipLevel} Arrival</span>
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                </div>
                <div className="my-1 drop-shadow-[0_0_18px_rgba(250,204,21,0.8)]">
                  <VipBadgeArt level={vipEntryBanner.vipLevel} size={68} />
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {entryEffectMeta.icon && (
                    <span className="text-lg" aria-hidden="true">
                      {entryEffectMeta.icon}
                    </span>
                  )}
                  <span
                    className="font-display text-2xl font-black tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
                    style={getVipNameStyle(vipEntryBanner.vipLevel)}
                  >
                    {vipEntryBanner.name}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-amber-100/90">
                  has entered the Voice Sanctuary
                </p>
              </div>
            </div>
          ) : vipEntryBanner ? (
            <div
              onClick={onDismissVipEntry}
              role="presentation"
              className="pointer-events-none absolute inset-x-3 top-14 z-40 flex justify-center"
            >
              <div className="animate-entry-ribbon relative flex w-full max-w-[338px] items-center py-1 pl-1">
                {/* Horizontal magenta-violet ribbon fading smoothly to right */}
                <div
                  className="relative ml-5 flex h-9 flex-1 items-center overflow-hidden pl-7 pr-8 shadow-[0_6px_26px_rgba(217,70,239,0.45)]"
                  style={{
                    background:
                      vipEntryBanner.vipLevel >= 1
                        ? 'linear-gradient(90deg, rgba(168,85,247,0.92) 0%, rgba(236,72,153,0.94) 48%, rgba(192,38,211,0.55) 78%, rgba(168,85,247,0) 100%)'
                        : 'linear-gradient(90deg, rgba(139,92,246,0.9) 0%, rgba(217,70,239,0.88) 52%, rgba(168,85,247,0) 100%)',
                    maskImage: 'linear-gradient(90deg, black 0%, black 78%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(90deg, black 0%, black 78%, transparent 100%)',
                  }}
                >
                  {/* Sharp silver-white top edge highlight */}
                  <span
                    className="pointer-events-none absolute top-0 right-6 left-0 h-[1.5px] bg-gradient-to-r from-white via-slate-100/90 to-transparent"
                    aria-hidden="true"
                  />
                  {/* Bottom glow edge */}
                  <span
                    className="pointer-events-none absolute right-10 bottom-0 left-0 h-[1px] bg-gradient-to-r from-pink-200/70 via-white/30 to-transparent"
                    aria-hidden="true"
                  />
                  {/* Twinkling sparkles matching reference */}
                  <span
                    className="pointer-events-none absolute top-1.5 left-24 h-1.5 w-1.5 animate-pulse rounded-full bg-white shadow-[0_0_8px_#fff]"
                    aria-hidden="true"
                  />
                  <span
                    className="pointer-events-none absolute right-24 bottom-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-pink-100 shadow-[0_0_8px_#fff]"
                    aria-hidden="true"
                  />
                  <span
                    className="pointer-events-none absolute top-2 right-16 h-1 w-1 rounded-full bg-white/90 shadow-[0_0_6px_#fff]"
                    aria-hidden="true"
                  />
                  <span
                    className="animate-ribbon-sheen pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    aria-hidden="true"
                  />

                  <div className="relative flex items-center gap-1.5 text-sm font-black italic tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]">
                    {entryEffectMeta.icon && (
                      <span className="text-xs not-italic" aria-hidden="true">
                        {entryEffectMeta.icon}
                      </span>
                    )}
                    <span
                      className="max-w-[145px] truncate"
                      style={
                        vipEntryBanner.vipLevel > 0
                          ? getVipNameStyle(vipEntryBanner.vipLevel)
                          : { color: '#FFFFFF' }
                      }
                    >
                      {vipEntryBanner.name}
                    </span>
                    <span className="text-xs font-semibold not-italic text-white/95">entered</span>
                  </div>
                </div>

                {/* Left Overlapping Gold-Winged Hexagon Badge */}
                <div className="absolute left-0 z-10 flex items-center justify-center drop-shadow-[0_3px_10px_rgba(245,158,11,0.75)]">
                  {vipEntryBanner.vipLevel > 0 ? (
                    <VipBadgeArt level={vipEntryBanner.vipLevel} size={44} />
                  ) : (
                    <>
                      <svg
                        width="54"
                        height="44"
                        viewBox="0 0 54 44"
                        className="pointer-events-none absolute"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 31 C4 26, 2 16, 8 8 C8 16, 10 23, 16 28 Z"
                          fill="#FACC15"
                          stroke="#FEF08A"
                          strokeWidth="0.8"
                        />
                        <path
                          d="M42 31 C50 26, 52 16, 46 8 C46 16, 44 23, 38 28 Z"
                          fill="#FACC15"
                          stroke="#FEF08A"
                          strokeWidth="0.8"
                        />
                      </svg>
                      <div
                        className="relative flex h-10 w-9 items-center justify-center shadow-lg"
                        style={{
                          clipPath: 'polygon(50% 2%, 96% 24%, 96% 76%, 50% 98%, 4% 76%, 4% 24%)',
                          background: 'linear-gradient(180deg, #FEF08A 0%, #F59E0B 55%, #B45309 100%)',
                          padding: '2px',
                        }}
                      >
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{
                            clipPath: 'polygon(50% 2%, 96% 24%, 96% 76%, 50% 98%, 4% 76%, 4% 24%)',
                            background: 'linear-gradient(180deg, #FBBF24 0%, #D97706 70%, #92400E 100%)',
                          }}
                        >
                          <span className="font-display text-sm font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                            V0
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Full-Screen Room Settings Drawer — Structured Grouped List in OG VELOCITY Dark Neon Palette */}
          {showSettingsModal && (() => {
            const rs = activeRoom.roomSettings || {};
            const currentTheme = ROOM_BACKGROUND_THEMES.find((t) => t.id === activeRoom.bgThemeId);
            const roomMode = rs.roomMode || 'Normal';
            const roomTag = rs.roomTag || activeRoom.category || 'Game';
            const partnerSeatMode = rs.partnerSeatMode || 'Enable All';
            const highQualityMode = rs.highQualityMode ?? true;
            const banTextChat = Boolean(rs.banTextChat);
            const banPhotoChat = Boolean(rs.banPhotoChat);
            const banRedPacket = Boolean(rs.banRedPacket);
            const membershipFee = Number(rs.membershipFeeCoins ?? 0);
            const blockedUids = Array.isArray(rs.blockedUids) ? rs.blockedUids : [];
            const operationRecords = Array.isArray(rs.operationRecords) ? rs.operationRecords : [];
            const associatedGroupName = rs.associatedGroupName || '';
            const announcementText = rs.announcement || activeRoom.topic || '';
            const bgLabel = activeRoom.bgUrl ? 'Custom' : currentTheme?.name || 'Nebula';

            const roomParticipantsList: Array<{
              uid: string;
              publicId: string;
              name: string;
              vipLevel: number;
              seatIndex?: number;
              isMuted?: boolean;
            }> = [];
            const seenParticipantUids = new Set<string>();
            for (const s of activeRoom.seats) {
              if (!s.occupant || seenParticipantUids.has(s.occupant.uid)) continue;
              seenParticipantUids.add(s.occupant.uid);
              roomParticipantsList.push({
                uid: s.occupant.uid,
                publicId: s.occupant.publicId || s.occupant.uid,
                name: s.occupant.name,
                vipLevel: s.isUser ? vipLevel : (s.vipLevel ?? 0),
                seatIndex: s.seatIndex,
                isMuted: s.isMuted,
              });
            }
            for (const l of activeRoom.listeners) {
              if (seenParticipantUids.has(l.uid)) continue;
              seenParticipantUids.add(l.uid);
              roomParticipantsList.push({
                uid: l.uid,
                publicId: l.uid,
                name: l.name,
                vipLevel: l.vipLevel ?? 0,
                isMuted: l.isMuted,
              });
            }

            const subTitleMap: Record<typeof settingsSubPage, string> = {
              main: 'Settings',
              title: 'Room Title',
              cover: 'Room Cover',
              announcement: 'Announcement',
              mode: 'Room Mode',
              tag: 'Room Tag',
              background: 'Room Background',
              'partner-seat': 'Partner Seat',
              fees: 'Membership Fees',
              admins: 'Admin',
              blocklist: 'Blocklist',
              'operation-record': 'Operation Record',
              'associated-groups': 'Associated Groups',
            };

            const renderSwitch = (
              label: string,
              checked: boolean,
              onToggle: () => void,
              disabled = false
            ) => (
              <div className="flex min-h-[54px] items-center justify-between gap-3 px-4 py-3">
                <span className="text-[15px] font-medium text-white">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={label}
                  disabled={disabled}
                  onClick={onToggle}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 ${
                    disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'
                  } ${
                    checked
                      ? 'border-cyan-300/60 bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                      : 'border-white/15 bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                      checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );

            const requireModeratorAction = (fn: () => void) => {
              if (!hasModAuthority) {
                notify('Only Room Owner or Admin can modify this setting.');
                return;
              }
              fn();
            };

            return (
              <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1A102B] via-[#100B1B] to-[#08060F] text-white">
                {/* Clean Centered Header matching screenshot */}
                <header className="mx-auto grid w-full max-w-xl grid-cols-[48px_1fr_48px] items-center border-b border-purple-400/15 bg-[#120C20]/95 px-2 py-2.5 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => {
                      if (settingsSubPage !== 'main') {
                        setSettingsSubPage('main');
                      } else {
                        setShowSettingsModal(false);
                      }
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 hover:text-white"
                    aria-label={settingsSubPage !== 'main' ? 'Back to Settings' : 'Close Settings'}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <h3 className="truncate text-center font-display text-[17px] font-bold tracking-tight text-white">
                    {subTitleMap[settingsSubPage]}
                  </h3>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(false)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
                      aria-label="Close Room Settings"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </header>

                <div className="zayro-scroll mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto px-3 py-3.5 pb-10">
                  {settingsSubPage === 'main' && (
                    <>
                      {/* Group 1: Title, Cover, Announcement, Room Mode, Room Tag, Room Background */}
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95 divide-y divide-white/[0.07]">
                        <button
                          type="button"
                          onClick={() =>
                            requireModeratorAction(() => {
                              setRoomNameDraft(activeRoom.title);
                              setSettingsSubPage('title');
                            })
                          }
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="shrink-0 text-[15px] font-medium text-white">Title</span>
                          <span className="flex min-w-0 items-center gap-1.5 text-sm text-slate-400">
                            <span className="max-w-[180px] truncate">{activeRoom.title}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => requireModeratorAction(() => setSettingsSubPage('cover'))}
                          className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="shrink-0 text-[15px] font-medium text-white">Cover</span>
                          <span className="flex items-center gap-2">
                            {activeRoom.dpUrl ? (
                              <img
                                src={activeRoom.dpUrl}
                                alt={activeRoom.title}
                                className="h-10 w-10 rounded-full border border-purple-400/40 object-cover"
                              />
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-400/40 bg-gradient-to-br from-purple-600/40 to-cyan-500/30 text-xs font-bold text-cyan-200">
                                {activeRoom.title.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            requireModeratorAction(() => {
                              setAnnouncementDraft(announcementText);
                              setSettingsSubPage('announcement');
                            })
                          }
                          className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-medium text-white">Announcement</div>
                            <div className="mt-0.5 truncate text-xs text-slate-400">
                              {announcementText || 'Tap to add room announcement'}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        </button>

                        <button
                          type="button"
                          onClick={() => requireModeratorAction(() => setSettingsSubPage('mode'))}
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Room Mode</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            <span>{roomMode}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            requireModeratorAction(() => {
                              setRoomTagDraft(roomTag);
                              setSettingsSubPage('tag');
                            })
                          }
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Room Tag</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            <span>{roomTag}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => requireModeratorAction(() => setSettingsSubPage('background'))}
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Room Background</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            <span>{bgLabel}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>
                      </div>

                      {/* Group 2: Partner Seat */}
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95">
                        <button
                          type="button"
                          onClick={() => requireModeratorAction(() => setSettingsSubPage('partner-seat'))}
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Partner Seat</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            <span>{partnerSeatMode}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>
                      </div>

                      {/* Group 3: High Quality Mode, Ban Text Chatting, Ban Photo Chatting, Ban Red Packet, Gift Animations */}
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95 divide-y divide-white/[0.07]">
                        {renderSwitch(
                          'High Quality Mode',
                          highQualityMode,
                          () =>
                            requireModeratorAction(() => {
                              const next = !highQualityMode;
                              onUpdateRoomSettings(activeRoom.id, {
                                roomSettings: { highQualityMode: next },
                              });
                              notify(next ? 'High Quality Mode enabled' : 'High Quality Mode disabled');
                            }),
                          !hasModAuthority
                        )}
                        {renderSwitch(
                          'Ban Text Chatting',
                          banTextChat,
                          () =>
                            requireModeratorAction(() => {
                              const next = !banTextChat;
                              onUpdateRoomSettings(activeRoom.id, {
                                roomSettings: { banTextChat: next },
                              });
                              notify(next ? 'Text chatting banned for guests' : 'Text chatting allowed');
                            }),
                          !hasModAuthority
                        )}
                        {renderSwitch(
                          'Ban Photo Chatting',
                          banPhotoChat,
                          () =>
                            requireModeratorAction(() => {
                              const next = !banPhotoChat;
                              onUpdateRoomSettings(activeRoom.id, {
                                roomSettings: { banPhotoChat: next },
                              });
                              notify(next ? 'Photo chatting banned for guests' : 'Photo chatting allowed');
                            }),
                          !hasModAuthority
                        )}
                        {renderSwitch(
                          'Ban Red Packet',
                          banRedPacket,
                          () =>
                            requireModeratorAction(() => {
                              const next = !banRedPacket;
                              onUpdateRoomSettings(activeRoom.id, {
                                roomSettings: { banRedPacket: next },
                              });
                              notify(next ? 'Red Packet banned in room' : 'Red Packet allowed');
                            }),
                          !hasModAuthority
                        )}
                        {renderSwitch(
                          'Gift Animations',
                          giftAnimationsEnabled,
                          () => {
                            onToggleGiftAnimations();
                            notify(
                              giftAnimationsEnabled
                                ? 'Gift animations disabled'
                                : 'Gift animations enabled'
                            );
                          }
                        )}
                      </div>

                      {/* Group 4: Password */}
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95">
                        <div className="flex min-h-[54px] items-center justify-between gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              requireModeratorAction(() => setShowPinEditor((prev) => !prev))
                            }
                            className="flex flex-1 items-center justify-between pr-2 text-left"
                          >
                            <span className="text-[15px] font-medium text-white">Password</span>
                            {activeRoom.isRoomLocked && activeRoom.roomPasscode ? (
                              <span className="font-mono-tabular text-xs font-semibold text-amber-300">
                                PIN: {activeRoom.roomPasscode}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={Boolean(activeRoom.isRoomLocked)}
                            aria-label="Password"
                            disabled={!hasModAuthority}
                            onClick={() =>
                              requireModeratorAction(() => {
                                if (activeRoom.isRoomLocked) {
                                  onUpdateRoomSettings(activeRoom.id, { isRoomLocked: false });
                                  setShowPinEditor(false);
                                  notify('Room password disabled');
                                } else {
                                  setShowPinEditor(true);
                                }
                              })
                            }
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 ${
                              !hasModAuthority ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'
                            } ${
                              activeRoom.isRoomLocked
                                ? 'border-cyan-300/60 bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                                : 'border-white/15 bg-white/10'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                activeRoom.isRoomLocked ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {(showPinEditor || activeRoom.isRoomLocked) && hasModAuthority && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const clean = roomPasscodeDraft.replace(/\D/g, '').slice(0, 4);
                              if (clean.length !== 4) {
                                notify('Enter a 4-digit numeric password.');
                                return;
                              }
                              onUpdateRoomSettings(activeRoom.id, {
                                isRoomLocked: true,
                                roomPasscode: clean,
                              });
                              setRoomPasscodeDraft(clean);
                              setShowPinEditor(false);
                              notify(`Room password set to ${clean}`);
                            }}
                            className="flex items-center gap-2 border-t border-white/[0.07] bg-[#100B1C] px-4 py-3"
                          >
                            <Lock className="h-4 w-4 shrink-0 text-amber-300" />
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              value={roomPasscodeDraft}
                              onChange={(e) =>
                                setRoomPasscodeDraft(e.target.value.replace(/\D/g, '').slice(0, 4))
                              }
                              placeholder="Enter 4-digit PIN"
                              className="h-11 min-w-0 flex-1 rounded-xl border border-purple-400/25 bg-[#0A0712] px-3 font-mono-tabular text-sm tracking-widest text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="h-11 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-4 text-xs font-bold text-slate-950 transition hover:brightness-110"
                            >
                              Save
                            </button>
                          </form>
                        )}
                      </div>

                      {/* Group 5: Membership Fees, Admin, Blocklist, Operation Record */}
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95 divide-y divide-white/[0.07]">
                        <button
                          type="button"
                          onClick={() =>
                            requireModeratorAction(() => {
                              setMembershipFeeDraft(String(membershipFee));
                              setSettingsSubPage('fees');
                            })
                          }
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Membership Fees</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            <span className="font-mono-tabular">
                              {membershipFee === 0 ? 'Free' : `${membershipFee.toLocaleString()} Coins`}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSettingsSubPage('admins')}
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Admin</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            <span className="font-mono-tabular">
                              {activeRoom.adminUids.length}/{getAdminSlotCount(activeRoom.level)}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSettingsSubPage('blocklist')}
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Blocklist</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            {blockedUids.length > 0 && (
                              <span className="font-mono-tabular">{blockedUids.length}</span>
                            )}
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSettingsSubPage('operation-record')}
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Operation Record</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            {operationRecords.length > 0 && (
                              <span className="font-mono-tabular">{operationRecords.length}</span>
                            )}
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>
                      </div>

                      {/* Group 6: Associated Groups */}
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95">
                        <button
                          type="button"
                          onClick={() =>
                            requireModeratorAction(() => {
                              setAssociatedGroupDraft(associatedGroupName);
                              setSettingsSubPage('associated-groups');
                            })
                          }
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Associated Groups</span>
                          <span className="flex items-center gap-1.5 text-sm text-slate-400">
                            {associatedGroupName && (
                              <span className="max-w-[160px] truncate">{associatedGroupName}</span>
                            )}
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>
                      </div>

                      {/* Group 7: Room ID */}
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95">
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(activeRoom.uid).catch(() => {});
                            }
                            notify(`Copied Room ID ${activeRoom.uid}`);
                          }}
                          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="text-[15px] font-medium text-white">Room ID</span>
                          <span className="flex items-center gap-1.5 font-mono-tabular text-sm text-slate-400">
                            <span>ID: {activeRoom.uid}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {settingsSubPage === 'title' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = roomNameDraft.trim();
                        if (!trimmed) return;
                        onUpdateRoomSettings(activeRoom.id, { title: trimmed });
                        notify('Room title updated');
                        setSettingsSubPage('main');
                      }}
                      className="space-y-4 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-4"
                    >
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Room Title
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={roomNameDraft}
                          onChange={(e) => setRoomNameDraft(e.target.value)}
                          placeholder="Enter room title"
                          className="h-12 w-full rounded-xl border border-purple-400/25 bg-[#0A0712] px-3.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-bold text-slate-950 shadow-lg shadow-purple-500/25 transition hover:brightness-110"
                      >
                        Save Title
                      </button>
                    </form>
                  )}

                  {settingsSubPage === 'cover' && (
                    <div className="space-y-4 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-5 text-center">
                      <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-purple-400/40 bg-[#0A0712]">
                        {activeRoom.dpUrl ? (
                          <img
                            src={activeRoom.dpUrl}
                            alt={activeRoom.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="font-display text-2xl font-bold text-cyan-300">
                            {activeRoom.title.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-bold text-slate-950 transition hover:brightness-110">
                          <Upload className="h-4 w-4" />
                          <span>Upload New Cover Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleRoomDpUpload}
                            className="hidden"
                          />
                        </label>
                        {activeRoom.dpUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateRoomSettings(activeRoom.id, { dpUrl: '' });
                              notify('Room cover photo reset');
                            }}
                            className="h-11 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                          >
                            Remove Cover Photo
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {settingsSubPage === 'announcement' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = announcementDraft.trim();
                        onUpdateRoomSettings(activeRoom.id, {
                          roomSettings: { announcement: trimmed },
                        });
                        notify('Announcement saved');
                        setSettingsSubPage('main');
                      }}
                      className="space-y-4 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-4"
                    >
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Room Announcement
                        </label>
                        <textarea
                          rows={4}
                          maxLength={300}
                          value={announcementDraft}
                          onChange={(e) => setAnnouncementDraft(e.target.value)}
                          placeholder="Share rules, schedule, or welcome message..."
                          className="w-full rounded-xl border border-purple-400/25 bg-[#0A0712] p-3.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-bold text-slate-950 shadow-lg shadow-purple-500/25 transition hover:brightness-110"
                      >
                        Save Announcement
                      </button>
                    </form>
                  )}

                  {settingsSubPage === 'mode' && (
                    <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95 divide-y divide-white/[0.07]">
                      {(['Normal', 'Action', 'Video', 'Music', 'PK', 'Party'] as const).map((modeOption) => {
                        const selected = roomMode === modeOption;
                        return (
                          <button
                            key={modeOption}
                            type="button"
                            onClick={() => {
                              if (modeOption === 'Action') setShowGiftDock(false);
                              onUpdateRoomSettings(activeRoom.id, {
                                roomSettings: { roomMode: modeOption },
                              });
                              notify(`Room Mode set to ${modeOption}`);
                              setSettingsSubPage('main');
                            }}
                            className="flex min-h-[54px] w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.03]"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-medium text-white">{modeOption}</span>
                            </div>
                            {selected && <Check className="h-5 w-5 text-cyan-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {settingsSubPage === 'tag' && (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95 divide-y divide-white/[0.07]">
                        {(['Game', 'Music', 'Chats', 'Popular', 'Teenagers', 'Chill'] as const).map(
                          (tagOption) => {
                            const selected = roomTag === tagOption;
                            return (
                              <button
                                key={tagOption}
                                type="button"
                                onClick={() => {
                                  const categoryMap: Partial<Record<string, VoiceRoom['category']>> = {
                                    Music: 'Music',
                                    Chats: 'Chats',
                                    Popular: 'Popular',
                                    Teenagers: 'Teenagers',
                                  };
                                  onUpdateRoomSettings(activeRoom.id, {
                                    category: categoryMap[tagOption],
                                    roomSettings: { roomTag: tagOption },
                                  });
                                  notify(`Room Tag set to ${tagOption}`);
                                  setSettingsSubPage('main');
                                }}
                                className="flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.03]"
                              >
                                <span className="text-[15px] font-medium text-white">{tagOption}</span>
                                {selected && <Check className="h-5 w-5 text-cyan-400" />}
                              </button>
                            );
                          }
                        )}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = roomTagDraft.trim().slice(0, 32);
                          if (!trimmed) return;
                          onUpdateRoomSettings(activeRoom.id, {
                            roomSettings: { roomTag: trimmed },
                          });
                          notify(`Room Tag set to ${trimmed}`);
                          setSettingsSubPage('main');
                        }}
                        className="flex gap-2 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-3"
                      >
                        <input
                          type="text"
                          maxLength={32}
                          value={roomTagDraft}
                          onChange={(e) => setRoomTagDraft(e.target.value)}
                          placeholder="Custom Room Tag..."
                          className="h-11 min-w-0 flex-1 rounded-xl border border-purple-400/25 bg-[#0A0712] px-3 text-sm text-white focus:border-cyan-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="h-11 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-4 text-xs font-bold text-slate-950"
                        >
                          Apply
                        </button>
                      </form>
                    </div>
                  )}

                  {settingsSubPage === 'background' && (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95 divide-y divide-white/[0.07]">
                        {ROOM_BACKGROUND_THEMES.map((theme) => {
                          const selected = !activeRoom.bgUrl && activeRoom.bgThemeId === theme.id;
                          const thumbImg = resolveRoomBackgroundImage(theme.id);
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => {
                                onUpdateRoomSettings(activeRoom.id, {
                                  bgThemeId: theme.id,
                                  bgUrl: '',
                                });
                                notify(`Background switched to ${theme.name}`);
                                setSettingsSubPage('main');
                              }}
                              className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-cover bg-center"
                                  style={
                                    thumbImg
                                      ? { backgroundImage: `url(${thumbImg})` }
                                      : { background: theme.gradient }
                                  }
                                />
                                <span className="text-[14px] font-medium text-white">{theme.name}</span>
                              </div>
                              {selected && <Check className="h-5 w-5 text-cyan-400" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-col gap-2 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-3">
                        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/15 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25">
                          <Upload className="h-4 w-4" />
                          <span>Upload Custom Wallpaper</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleRoomBgUpload}
                            className="hidden"
                          />
                        </label>
                        {activeRoom.bgUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateRoomSettings(activeRoom.id, { bgUrl: '' });
                              notify('Cleared custom wallpaper');
                            }}
                            className="h-11 rounded-xl bg-white/10 text-xs font-semibold text-slate-200"
                          >
                            Reset Custom Wallpaper
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {settingsSubPage === 'partner-seat' && (
                    <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#150F24]/95 divide-y divide-white/[0.07]">
                      {(['Enable All', 'Owner & Admins', 'Locked'] as const).map((option) => {
                        const selected = partnerSeatMode === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              onUpdateRoomSettings(activeRoom.id, {
                                roomSettings: { partnerSeatMode: option },
                              });
                              notify(`Partner Seat set to ${option}`);
                              setSettingsSubPage('main');
                            }}
                            className="flex min-h-[54px] w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.03]"
                          >
                            <span className="text-[15px] font-medium text-white">{option}</span>
                            {selected && <Check className="h-5 w-5 text-cyan-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {settingsSubPage === 'fees' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const parsed = Math.max(
                          0,
                          Math.min(1_000_000, Math.floor(Number(membershipFeeDraft) || 0))
                        );
                        onUpdateRoomSettings(activeRoom.id, {
                          roomSettings: { membershipFeeCoins: parsed },
                        });
                        notify(
                          parsed === 0
                            ? 'Membership Fees set to Free'
                            : `Membership Fees set to ${parsed.toLocaleString()} Coins`
                        );
                        setSettingsSubPage('main');
                      }}
                      className="space-y-4 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-4"
                    >
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Room Membership Fee (Coins, 0 = Free)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={1000000}
                          value={membershipFeeDraft}
                          onChange={(e) => setMembershipFeeDraft(e.target.value)}
                          className="h-12 w-full rounded-xl border border-purple-400/25 bg-[#0A0712] px-3.5 font-mono-tabular text-sm text-white focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateRoomSettings(activeRoom.id, {
                              roomSettings: { membershipFeeCoins: 0 },
                            });
                            setMembershipFeeDraft('0');
                            notify('Membership Fees set to Free');
                            setSettingsSubPage('main');
                          }}
                          className="h-12 flex-1 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white"
                        >
                          Free
                        </button>
                        <button
                          type="submit"
                          className="h-12 flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-bold text-slate-950"
                        >
                          Save Fee
                        </button>
                      </div>
                    </form>
                  )}

                  {settingsSubPage === 'admins' && (
                    <div
                      ref={settingsAdminsRef}
                      className="space-y-2.5 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-4"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1.5 font-bold text-white">
                          <Shield className="h-4 w-4 text-cyan-300" />
                          Room Admins ({activeRoom.adminUids.length}/{getAdminSlotCount(activeRoom.level)})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {roomParticipantsList.map((p) => {
                          const isRowOwner = p.uid === activeRoom.ownerUid;
                          const isRowAdmin = activeRoom.adminUids.includes(p.uid);
                          return (
                            <div
                              key={p.uid}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0D0918] px-3 py-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold" style={getVipNameStyle(p.vipLevel)}>
                                  {p.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openTargetByUid(p.publicId, p.name)}
                                  className="font-mono-tabular text-[11px] text-cyan-300 underline"
                                >
                                  {p.publicId}
                                </button>
                                {isRowOwner && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                                    <Crown className="h-3 w-3" /> Owner
                                  </span>
                                )}
                                {!isRowOwner && isRowAdmin && (
                                  <span className="text-[10px] font-bold text-cyan-300">Admin</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isOwner && !isRowOwner && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onToggleAdmin(activeRoom.id, p.uid, p.name);
                                      notify(
                                        isRowAdmin
                                          ? `Removed ${p.name} from Admin`
                                          : `Appointed ${p.name} as Admin`
                                      );
                                    }}
                                    className={`min-h-[36px] rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                                      isRowAdmin
                                        ? 'bg-rose-500/20 text-rose-300'
                                        : 'bg-cyan-500/20 text-cyan-300'
                                    }`}
                                  >
                                    {isRowAdmin ? 'Remove Admin' : 'Make Admin'}
                                  </button>
                                )}
                                {hasModAuthority && !isRowOwner && p.seatIndex !== undefined && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onToggleMuteSeat(p.seatIndex!)}
                                      className="min-h-[36px] rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white"
                                    >
                                      {p.isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onKickUser(activeRoom.id, p.uid, p.name);
                                        notify(`Removed ${p.name} from seat`);
                                      }}
                                      className="min-h-[36px] rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white"
                                    >
                                      Kick
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {settingsSubPage === 'blocklist' && (
                    <div className="space-y-3 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-4">
                      {hasModAuthority && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const targetId = blockUidDraft.trim();
                            if (!targetId) return;
                            if (targetId === activeRoom.ownerUid) {
                              notify('Cannot block the Room Owner.');
                              return;
                            }
                            const next = Array.from(new Set([...blockedUids, targetId]));
                            onUpdateRoomSettings(activeRoom.id, {
                              roomSettings: { blockedUids: next },
                            });
                            setBlockUidDraft('');
                            notify(`Added ${targetId} to room blocklist`);
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={blockUidDraft}
                            onChange={(e) => setBlockUidDraft(e.target.value)}
                            placeholder="User ID to block (e.g. 100005)"
                            className="h-11 min-w-0 flex-1 rounded-xl border border-purple-400/25 bg-[#0A0712] px-3 font-mono-tabular text-sm text-white focus:border-cyan-400 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="h-11 rounded-xl bg-rose-500 px-4 text-xs font-bold text-white"
                          >
                            Block
                          </button>
                        </form>
                      )}
                      {blockedUids.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">
                          No users on the room blocklist.
                        </p>
                      ) : (
                        <div className="divide-y divide-white/[0.07]">
                          {blockedUids.map((uid) => (
                            <div
                              key={uid}
                              className="flex min-h-[48px] items-center justify-between py-2 text-sm"
                            >
                              <span className="font-mono-tabular text-white">ID: {uid}</span>
                              {hasModAuthority && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = blockedUids.filter((u) => u !== uid);
                                    onUpdateRoomSettings(activeRoom.id, {
                                      roomSettings: { blockedUids: next },
                                    });
                                    notify(`Removed ${uid} from blocklist`);
                                  }}
                                  className="min-h-[36px] rounded-lg bg-white/10 px-3 text-xs font-semibold text-cyan-300"
                                >
                                  Unblock
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {settingsSubPage === 'operation-record' && (
                    <div className="rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-4">
                      {operationRecords.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">
                          No room setting changes recorded yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-white/[0.07]">
                          {operationRecords.map((rec) => (
                            <div key={rec.id} className="py-3 text-xs">
                              <div className="font-semibold text-white">{rec.action}</div>
                              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                                <span>
                                  {rec.actorName} ({rec.actorUid})
                                </span>
                                <span className="font-mono-tabular">
                                  {new Date(rec.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {settingsSubPage === 'associated-groups' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = associatedGroupDraft.trim().slice(0, 80);
                        onUpdateRoomSettings(activeRoom.id, {
                          roomSettings: { associatedGroupName: trimmed },
                        });
                        notify(trimmed ? `Associated with "${trimmed}"` : 'Cleared associated group');
                        setSettingsSubPage('main');
                      }}
                      className="space-y-4 rounded-2xl border border-purple-400/20 bg-[#150F24]/95 p-4"
                    >
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Associated Club / Group Name
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={associatedGroupDraft}
                          onChange={(e) => setAssociatedGroupDraft(e.target.value)}
                          placeholder="Enter group or clan name..."
                          className="h-12 w-full rounded-xl border border-purple-400/25 bg-[#0A0712] px-3.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-bold text-slate-950"
                      >
                        Save Associated Group
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Online / Members / Contribution Bottom Sheet */}
          {showListenersDrawer && (
            <div className="absolute inset-x-0 bottom-0 z-40 flex max-h-[82%] flex-col overflow-hidden rounded-t-3xl border-t border-cyan-400/25 bg-[#0D1526] text-white shadow-[0_-12px_40px_rgba(0,0,0,0.75)]">
              {/* Top Handle + Small Clickable Details Strip right above tabs */}
              <div className="flex flex-col items-center pt-2">
                <div className="h-1 w-10 rounded-full bg-white/25" />
                <button
                  type="button"
                  onClick={() => setShowContribTip((v) => !v)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-[#132038] px-3 py-0.5 text-[10px] font-bold text-cyan-200 hover:bg-[#192946]"
                >
                  <span>
                    {sheetTab === 'contribution'
                      ? 'Top Coin Spenders · Tap for details'
                      : sheetTab === 'online'
                        ? `${activeRoom.listenerCount} Online Users · Tap ID for Actions`
                        : `${activeRoom.memberUids.length} Joined Members`}
                  </span>
                  <ChevronUp className={`h-3 w-3 transition-transform ${showContribTip ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showContribTip && (
                <div className="mx-4 mt-1.5 flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-[11px] text-amber-100">
                  <span>
                    Shows total Coins spent on gifts &amp; packs in {activeRoom.title}. Tap any user row to view profile or manage.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowContribTip(false)}
                    className="ml-2 text-amber-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Sheet Tabs: Online | Members | Contribution */}
              <div className="mt-2 flex items-center justify-between border-b border-white/10 px-4">
                <div className="flex flex-1 items-center justify-around">
                  {(
                    [
                      { id: 'online', label: `Online ${activeRoom.listenerCount}` },
                      { id: 'members', label: `Members ${activeRoom.memberUids.length}` },
                      { id: 'contribution', label: 'Contribution' },
                    ] as const
                  ).map((t) => {
                    const active = sheetTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSheetTab(t.id)}
                        className={`relative pb-2.5 text-xs font-bold transition-colors ${
                          active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t.label}
                        {active && (
                          <span className="absolute right-2 bottom-0 left-2 h-0.5 rounded-full bg-cyan-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowListenersDrawer(false)}
                  aria-label="Close Sheet"
                  className="mb-1 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* TAB: CONTRIBUTION (Daily / Weekly / Total + Coins Spent per user) */}
              {sheetTab === 'contribution' && (
                <>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {(['Daily', 'Weekly', 'Total'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setContribPeriod(p)}
                          className={`rounded-full px-3.5 py-1 text-[11px] font-bold transition-colors ${
                            contribPeriod === p
                              ? 'border border-cyan-400/35 bg-cyan-500/20 text-cyan-300'
                              : 'bg-[#132038] text-slate-400 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContribTip((v) => !v)}
                      aria-label="Contribution Help"
                      className="text-slate-400 hover:text-cyan-300"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="zayro-scroll flex-1 space-y-1 overflow-y-auto px-4 pb-3">
                    {contributorRows.map((row, idx) => {
                      const rank = idx + 1;
                      return (
                        <div
                          key={row.uid}
                          onClick={() => openTargetByUid(row.uid, row.name)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') openTargetByUid(row.uid, row.name);
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-2xl px-2 py-2 hover:bg-[#132038]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex w-6 shrink-0 items-center justify-center">
                              {rank === 1 ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 font-mono-tabular text-[11px] font-black text-amber-300">
                                  👑1
                                </span>
                              ) : rank === 2 ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-400/20 font-mono-tabular text-[11px] font-black text-slate-200">
                                  👑2
                                </span>
                              ) : rank === 3 ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 font-mono-tabular text-[11px] font-black text-orange-300">
                                  👑3
                                </span>
                              ) : (
                                <span className="font-mono-tabular text-xs font-bold text-slate-400">
                                  {rank}
                                </span>
                              )}
                            </div>

                            <AvatarArt avatar={row.avatar} size={36} />

                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span
                                  className="truncate text-xs font-extrabold"
                                  style={
                                    row.vipLevel >= 12
                                      ? getVipNameStyle(row.vipLevel)
                                      : { color: '#FFFFFF' }
                                  }
                                >
                                  {row.name}
                                </span>
                                <VipBadgeArt level={row.vipLevel} size={15} />
                                <CharmBadgeArt level={row.charmLevel} size={14} />
                              </div>
                              <div className="font-mono-tabular text-[9.5px] text-slate-400">
                                {row.uid}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="inline-flex items-center gap-1 font-mono-tabular text-xs font-black text-amber-300">
                              <ZayroCoinArt size={13} />
                              <span>{row.coinsSpent.toLocaleString()}</span>
                            </div>
                            <div className="text-[9.5px] font-semibold text-slate-400">
                              Coins Spent
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sticky Current User Footer */}
                  <div className="flex items-center justify-between border-t border-white/10 bg-[#0A101D] px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center font-mono-tabular text-xs font-black text-slate-400">
                        {userContribIndex >= 0 ? `#${userContribIndex + 1}` : '-'}
                      </span>
                      {userContribRow && <AvatarArt avatar={userContribRow.avatar} size={34} />}
                      <div>
                        <div className="flex items-center gap-1">
                          <span
                            className="text-xs font-extrabold"
                            style={
                              vipLevel >= 12 ? getVipNameStyle(vipLevel) : { color: '#FFFFFF' }
                            }
                          >
                            {userName}
                          </span>
                          <VipBadgeArt level={vipLevel} size={14} />
                        </div>
                        <div className="text-[10px] text-slate-400">Your {contribPeriod} Spend</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 font-mono-tabular text-xs font-black text-amber-300">
                        <ZayroCoinArt size={13} />
                        <span>{(userContribRow?.coinsSpent ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="text-[9.5px] font-semibold text-slate-400">Coins Spent</div>
                    </div>
                  </div>

                  {/* 3 Room Quick Actions (Invite Friends, Room Settings, Exit Room) below Contribution */}
                  <div className="grid grid-cols-3 gap-2 border-t border-white/10 bg-[#0A101D] px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowListenersDrawer(false);
                        setShowInviteFriendsModal(true);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-2 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Invite Friends</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowListenersDrawer(false);
                        openSettingsModal('main');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#132038] px-2.5 py-2 text-[11px] font-bold text-white hover:border-cyan-400/40"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Room Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowListenersDrawer(false);
                        onExitRoom();
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-500/20 px-2.5 py-2 text-[11px] font-bold text-rose-200 hover:bg-rose-500 hover:text-white"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Exit Room</span>
                    </button>
                  </div>
                </>
              )}

              {/* TAB: ONLINE USERS */}
              {sheetTab === 'online' && (
                <div className="zayro-scroll flex-1 space-y-2 overflow-y-auto p-4">
                  {activeRoom.listeners.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      All active users are currently seated on mics.
                    </p>
                  ) : (
                    activeRoom.listeners.map((lis) => (
                      <div
                        key={lis.uid}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#132038] px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="font-bold"
                            style={
                              lis.vipLevel >= 12 ? getVipNameStyle(lis.vipLevel) : { color: '#FFFFFF' }
                            }
                          >
                            {lis.name}
                          </span>
                          <VipBadgeArt level={lis.vipLevel} size={16} />
                          <button
                            type="button"
                            onClick={() => openTargetByUid(lis.uid, lis.name)}
                            className="font-mono-tabular text-[10.5px] text-cyan-300 underline"
                          >
                            {lis.uid}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => notify(onAddFriendByUid(lis.uid))}
                            className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-bold text-cyan-200"
                          >
                            Add Friend
                          </button>
                          {hasModAuthority && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onLiftUserToSeat(activeRoom.id, lis);
                                  notify(`Lifted ${lis.name} to a mic seat!`);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-bold text-slate-950"
                              >
                                <ArrowUpCircle className="h-3 w-3" />
                                Lift
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleMuteByUid(activeRoom.id, lis.uid)}
                                className="rounded-lg bg-[#192946] px-2 py-1 text-[10px] font-bold text-slate-200"
                              >
                                {lis.isMuted ? 'Unmute' : 'Mute'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onKickUser(activeRoom.id, lis.uid, lis.name);
                                  notify(`Kicked ${lis.name}`);
                                }}
                                className="rounded-lg bg-rose-500 px-2 py-1 text-[10px] font-bold text-white"
                              >
                                Kick
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: MEMBERS */}
              {sheetTab === 'members' && (
                <div className="zayro-scroll flex-1 space-y-2 overflow-y-auto p-4">
                  {activeRoom.memberUids.map((uid) => {
                    const seatOccupant = activeRoom.seats.find((s) => s.occupant?.uid === uid)?.occupant;
                    const listenerRec = activeRoom.listeners.find((l) => l.uid === uid);
                    const memberName =
                      uid === userUid
                        ? userName
                        : seatOccupant?.name ?? listenerRec?.name ?? `Member ${uid.slice(-4)}`;
                    const isRoomOwner = uid === activeRoom.ownerUid;
                    const isRoomAdmin = activeRoom.adminUids.includes(uid);
                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#132038] px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{memberName}</span>
                          <span className="font-mono-tabular text-[10.5px] text-slate-400">
                            {uid}
                          </span>
                        </div>
                        <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200">
                          {isRoomOwner ? 'Owner' : isRoomAdmin ? 'Admin' : 'Member'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Room EXP & Levels Overlay Drawer */}
          {showRoomLevelsDrawer && (
            <div className="zayro-scroll absolute inset-x-2.5 top-12 z-30 max-h-[75%] space-y-3 overflow-y-auto rounded-2xl border border-cyan-400/25 bg-[#0A101D]/95 p-3.5 shadow-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Room Level {activeRoom.level}/20 ({activeLevelInfo?.title})
                  </h3>
                  <p className="font-mono-tabular text-xs text-slate-300">
                    EXP: {activeRoom.xp.toLocaleString()} / {nextExpTarget.toLocaleString()} ·{' '}
                    {getAdminSlotCount(activeRoom.level)} Admin Slots
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRoomLevelsDrawer(false)}
                  className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roomTasks.map((rt) => (
                  <div
                    key={rt.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D1526] p-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{rt.title}</div>
                      <div className="text-[11px] text-slate-400">{rt.rule}</div>
                    </div>
                    <button
                      type="button"
                      disabled={rt.claimed}
                      onClick={() => onClaimRoomTask(rt.id)}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 disabled:bg-white/10 disabled:text-slate-400"
                    >
                      {rt.claimed
                        ? 'Claimed'
                        : `+${vipLevel > 1 && rt.vipDouble ? rt.rewardExp * 2 : rt.rewardExp} EXP`}
                    </button>
                  </div>
                ))}
              </div>

              <div className="zayro-scroll max-h-40 overflow-y-auto rounded-xl border border-white/10">
                <table className="w-full text-left font-mono-tabular text-[11px]">
                  <thead className="bg-[#0D1526] text-slate-400">
                    <tr>
                      <th className="px-2.5 py-1.5">Level</th>
                      <th className="px-2.5 py-1.5">Required EXP</th>
                      <th className="px-2.5 py-1.5">Members</th>
                      <th className="px-2.5 py-1.5">Admin Slots</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {ROOM_LEVEL_INFO.map((rl) => (
                      <tr key={rl.level}>
                        <td className="px-2.5 py-1.5 font-bold text-white">
                          Lv.{rl.level} ({rl.title})
                        </td>
                        <td className="px-2.5 py-1.5 text-amber-300">
                          {rl.requiredExp.toLocaleString()}
                        </td>
                        <td className="px-2.5 py-1.5">{rl.memberLimit}</td>
                        <td className="px-2.5 py-1.5 text-emerald-300">{rl.adminSlots}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CLOSED ROOM INSIDE STAGE OVERLAY (Matches Reference: Padlock + "This VR is closed" + listening pill) */}
          {isClosedRoom ? (
            <div className="mt-2 flex flex-col items-center">
              <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0A0A12]/72 px-6 py-7 text-center shadow-2xl backdrop-blur-md">
                <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-full border border-purple-400/25 bg-purple-500/20 text-purple-300 shadow-inner">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-extrabold text-white">
                  This VR is closed
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  The owner, co-owners and admins are offline or not in this VR. Seats open when one of them is here.
                </p>
                {onReopenRoom && (hasModAuthority || isAppAdmin) && (
                  <button
                    type="button"
                    disabled={reopeningRoom}
                    onClick={async () => {
                      setReopeningRoom(true);
                      try {
                        await onReopenRoom(activeRoom.id);
                      } finally {
                        setReopeningRoom(false);
                      }
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 text-[11px] font-extrabold text-slate-950 shadow hover:bg-emerald-400 disabled:opacity-60"
                  >
                    <Power className="h-3.5 w-3.5" />
                    <span>{reopeningRoom ? 'Reopening...' : 'Open VR'}</span>
                  </button>
                )}
              </div>

              <div className="mt-2.5 flex w-full max-w-sm items-center justify-between gap-2">
                <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-semibold text-slate-200">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>{activeRoom.listenerCount} listening</span>
                </div>
              </div>

              <div className="mt-2 flex w-full max-w-sm items-center justify-end">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-[#120E20]/80 px-3 py-1 text-[11px] text-slate-300 backdrop-blur-sm">
                  <Music className="h-3.5 w-3.5 text-purple-300" />
                  <span className="max-w-[140px] truncate">
                    {roomVideoSync?.title || 'No song'}
                  </span>
                </div>
              </div>
            </div>
          ) : isActionRoom ? (
            <div className="mt-1.5 space-y-2.5 rounded-3xl border border-purple-400/35 bg-gradient-to-b from-[#230E45]/90 via-[#15092A]/92 to-[#0D061A]/95 p-3 shadow-[0_0_30px_rgba(147,51,234,0.3)] backdrop-blur-md">
              {/* Top Host Crest + Mode Pills + Tag Hexagon (Owner strictly occupies clickable Host Seat) */}
              {(() => {
                const seat0Owner =
                  activeRoom.seats[0]?.occupant &&
                  (activeRoom.seats[0].occupant.uid === activeRoom.ownerUid ||
                    activeRoom.seats[0].occupant.publicId === activeRoom.ownerUid)
                    ? activeRoom.seats[0].occupant
                    : null;
                const ownerListener = activeRoom.listeners.find(
                  (l) => l.uid === activeRoom.ownerUid
                );
                const ownerHostAvatar: AvatarConfig = seat0Owner ?? {
                  id: ownerListener?.avatarId || `host-${activeRoom.ownerUid}`,
                  uid: activeRoom.ownerUid,
                  publicId: activeRoom.ownerUid,
                  name: activeRoom.hostName,
                  handle: `@${activeRoom.hostName.toLowerCase().replace(/\s+/g, '') || 'host'}`,
                  photoUrl: activeRoom.dpUrl || undefined,
                  skinTone: '#D69E76',
                  hairColor: '#1E293B',
                  robeColor: '#7C3AED',
                  accentColor: '#FBBF24',
                  ornament: 'crown',
                };
                const vipSeats: VoiceSeat[] = [1, 2, 3].map(
                  (idx) =>
                    activeRoom.seats[idx] ?? {
                      seatIndex: idx,
                      occupant: null,
                      isUser: false,
                      isLocked: false,
                      isMuted: false,
                      isSpeaking: false,
                      audioLevel: 0,
                      giftScore: 0,
                      role: 'empty' as const,
                    }
                );
                const actionBottomSeats: VoiceSeat[] = [4, 5, 6, 7, 8, 9, 10, 11].map(
                  (idx) =>
                    activeRoom.seats[idx] ?? {
                      seatIndex: idx,
                      occupant: null,
                      isUser: false,
                      isLocked: false,
                      isMuted: false,
                      isSpeaking: false,
                      audioLevel: 0,
                      giftScore: 0,
                      role: 'empty' as const,
                    }
                );
                const isLoverTagSelected =
                  selectedTagKey === 'lover' || selectedTagKey === 'cp_partner';
                const selectedTagPrice = isLoverTagSelected
                  ? null
                  : ACTION_ROOM_TAG_PRICES[selectedTagKey];
                return (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setActionTarget({
                              uid: ownerHostAvatar.uid,
                              name: ownerHostAvatar.name,
                              avatar: ownerHostAvatar,
                              vipLevel: activeRoom.seats[0]?.isUser ? vipLevel : (activeRoom.seats[0]?.vipLevel ?? 0),
                              charm: activeRoom.seats[0]?.isUser ? charm : (activeRoom.seats[0]?.charmValue ?? 0),
                              seatIndex: 0,
                              isMuted: activeRoom.seats[0]?.isMuted ?? false,
                            })
                          }
                          className="relative shrink-0 rounded-full ring-2 ring-amber-300/75 transition hover:scale-105"
                          title={`Room Owner Host Seat: ${ownerHostAvatar.name}`}
                        >
                          <AvatarArt avatar={ownerHostAvatar} size={46} />
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-500 to-purple-600 px-2 py-0.5 text-[8px] font-black text-white shadow">
                            Host
                          </span>
                        </button>
                        <div>
                          <div className="flex items-center gap-1 text-xs font-extrabold text-white">
                            <span>{ownerHostAvatar.name}</span>
                            <span className="font-mono-tabular text-[9px] text-amber-300">
                              (ID {ownerHostAvatar.publicId || ownerHostAvatar.uid})
                            </span>
                          </div>
                          <div className="mt-0.5 text-[9.5px] text-purple-200/80">
                            Room Owner Exclusive Host Seat
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {(
                              [
                                { id: 'bidding', label: 'Bidding', emoji: '💎' },
                                { id: 'relationship_advancement', label: 'Relationship Advancement', emoji: '💗' },
                                { id: 'music', label: 'Music', emoji: '🎵' },
                              ] as const
                            ).map((pill) => {
                              const isSel = actionRoomState.actionMode === pill.id;
                              return (
                                <button
                                  key={pill.id}
                                  type="button"
                                  onClick={() => {
                                    if (!hasModAuthority) {
                                      notify('Only Room Owner or Admin can switch Action Mode.');
                                      return;
                                    }
                                    onUpdateActionRoom?.(
                                      pill.id,
                                      (actionRoomState.slots || []).filter((s): s is ActionRoomSlot => Boolean(s))
                                    );
                                    if (pill.id === 'relationship_advancement') {
                                      setShowActionTagPanel(true);
                                    }
                                    notify(`Action Mode: ${pill.label}`);
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-all ${
                                    isSel
                                      ? 'border-cyan-300 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_10px_rgba(129,140,248,0.6)]'
                                      : 'border-purple-400/35 bg-[#120A22] text-purple-200 hover:border-purple-300'
                                  }`}
                                >
                                  <span>{pill.emoji}</span>
                                  <span>{pill.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Embedded Action Room Tag Drawer Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowActionTagPanel((v) => !v)}
                        className={`relative flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-2xl border text-white shadow-[0_0_14px_rgba(251,191,36,0.3)] hover:scale-105 ${
                          showActionTagPanel
                            ? 'border-cyan-300 bg-gradient-to-b from-cyan-600/80 to-purple-800'
                            : 'border-amber-300/60 bg-gradient-to-b from-purple-700/75 to-[#160B2C]'
                        }`}
                      >
                        <Tag className="h-4 w-4 text-amber-200" />
                        <span className="mt-0.5 text-[9px] font-extrabold text-amber-100">Tag</span>
                        {pendingIncomingTags.length > 0 && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                        )}
                      </button>
                    </div>

                    {/* Embedded Coin-Paid Action Room Relationship Tag Drawer */}
                    {showActionTagPanel && (
                      <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-[#0D061A]/95 p-3 text-xs shadow-xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div>
                            <div className="font-display text-xs font-extrabold text-amber-200">
                              Action Room · Coin-Paid Relationship Tags
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Tags appear on seats only when bonded partners sit side-by-side.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowActionTagPanel(false)}
                            className="rounded-lg bg-white/10 p-1 text-slate-300 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {RELATIONSHIP_TAG_DEFS.map((def) => {
                            const active = selectedTagKey === def.key;
                            const tagPrice =
                              def.key === 'lover' ? null : ACTION_ROOM_TAG_PRICES[def.key];
                            return (
                              <button
                                key={def.key}
                                type="button"
                                onClick={() => setSelectedTagKey(def.key)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold transition ${
                                  active
                                    ? `border-white/60 bg-gradient-to-r ${def.gradient} text-white shadow`
                                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
                                }`}
                              >
                                <RelationshipTagSpriteArt tagType={def.key} showCrest size={15} />
                                <span>{def.label}</span>
                                {tagPrice !== null && (
                                  <span className="font-mono-tabular text-[9px] text-amber-200">
                                    · {(tagPrice / 1000).toFixed(0)}K
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {selectedTagKey === 'lover' || selectedTagKey === 'cp_partner' ? (
                          <div className="rounded-xl border border-rose-400/35 bg-rose-950/35 p-2.5 text-[11px] text-rose-100">
                            <strong>Lover Tag:</strong> Official CP Partner tag activates automatically when you bind a CP Partner using an owned Ring (tap any user avatar &rarr; Propose CP).
                          </div>
                        ) : (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!onPurchaseActionTag || actionTagBusy) return;
                              const uid = tagTargetUidInput.trim();
                              if (!uid) {
                                notify('Select a partner or enter a Partner User ID.');
                                return;
                              }
                              setActionTagBusy(true);
                              try {
                                const res = await onPurchaseActionTag(uid, selectedTagKey);
                                notify(res.message);
                                if (res.ok) setTagTargetUidInput('');
                              } finally {
                                setActionTagBusy(false);
                              }
                            }}
                            className="space-y-2 rounded-xl border border-purple-400/25 bg-[#160D2D] p-2.5"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-purple-200">
                                Activate {getRelationshipTagDef(selectedTagKey).label} Tag
                              </span>
                              <span className="font-mono-tabular font-black text-amber-300">
                                Cost: {(selectedTagPrice ?? 0).toLocaleString()} Coins
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {roomRecipientCandidates
                                .filter((c) => c.uid !== userUid)
                                .slice(0, 6)
                                .map((cand) => (
                                  <button
                                    key={cand.uid}
                                    type="button"
                                    onClick={() => setTagTargetUidInput(cand.avatar.publicId || cand.uid)}
                                    className="rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:border-cyan-400"
                                  >
                                    {cand.name} ({cand.avatar.publicId || cand.uid})
                                  </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tagTargetUidInput}
                                onChange={(e) => setTagTargetUidInput(e.target.value)}
                                placeholder="Partner ID (e.g. 100002)"
                                className="h-8 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/55 px-2.5 font-mono-tabular text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                              />
                              <button
                                type="submit"
                                disabled={actionTagBusy || coins < (selectedTagPrice ?? 0)}
                                className="h-8 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 px-3 text-[11px] font-black text-slate-950 disabled:opacity-45"
                              >
                                {actionTagBusy
                                  ? 'Processing...'
                                  : coins < (selectedTagPrice ?? 0)
                                    ? 'Low Coins'
                                    : 'Pay & Activate'}
                              </button>
                            </div>
                          </form>
                        )}

                        {relationshipTags.length > 0 && (
                          <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                            {relationshipTags.map((rel) => {
                              const def = getRelationshipTagDef(rel.tagType);
                              const lvlInfo = getRelationshipTagLevelInfo(rel.charmScore);
                              const isIncoming = rel.status === 'pending' && rel.isIncoming;
                              return (
                                <div
                                  key={rel.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/45 px-2.5 py-1.5 text-[11px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <RelationshipTagSpriteArt tagType={rel.tagType} level={lvlInfo.level} size={22} />
                                    <div>
                                      <div className="font-bold text-white">
                                        {def.label} Lv.{lvlInfo.level} · {rel.partnerName}
                                      </div>
                                      <div className="font-mono-tabular text-[9px] text-slate-400">
                                        {rel.status.toUpperCase()} · {rel.charmScore.toLocaleString()} Charm
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {isIncoming && onRespondRelationshipTag && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => onRespondRelationshipTag(rel.id, true)}
                                          className="rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-slate-950"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onRespondRelationshipTag(rel.id, false)}
                                          className="rounded-lg bg-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-200"
                                        >
                                          Decline
                                        </button>
                                      </>
                                    )}
                                    {rel.status === 'active' && onEndRelationshipTag && (
                                      <button
                                        type="button"
                                        onClick={() => onEndRelationshipTag(rel.id)}
                                        className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-200"
                                      >
                                        End
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3 Upper Action Slots (No relationship set | Empty | No price set) */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {(actionRoomState.slots || []).slice(0, 3).map((slot, sIdx) => (
                        <div key={slot?.index ?? sIdx} className="flex flex-col items-center text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (!hasModAuthority) {
                                notify('Only Room Owner or Admin can configure Action slots.');
                                return;
                              }
                              setEditingActionSlotIndex(sIdx);
                              setActionSlotLabelDraft(slot?.label || '');
                            }}
                            className={`flex h-12 w-12 items-center justify-center border-2 border-amber-300/70 bg-[#140A28] text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.22)] transition-transform hover:scale-105 ${
                              sIdx === 1 ? 'rounded-full' : 'rounded-2xl'
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <span className="mt-1 line-clamp-1 text-[9.5px] font-semibold text-purple-100">
                            {slot?.label || (sIdx === 0 ? 'No relationship set' : sIdx === 1 ? 'Empty' : 'No price set')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {editingActionSlotIndex !== null && hasModAuthority && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const nextSlots = [0, 1, 2].map((i) => {
                            const prev = actionRoomState.slots?.[i] ?? { index: i, label: 'Empty' };
                            return i === editingActionSlotIndex
                              ? { ...prev, label: actionSlotLabelDraft.trim() || 'Empty' }
                              : prev;
                          });
                          onUpdateActionRoom?.(
                            (actionRoomState.actionMode === 'relationship_advancement' || actionRoomState.actionMode === 'music'
                              ? actionRoomState.actionMode
                              : 'bidding'),
                            nextSlots
                          );
                          setEditingActionSlotIndex(null);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-amber-400/35 bg-[#0D071A] p-2"
                      >
                        <input
                          type="text"
                          maxLength={28}
                          value={actionSlotLabelDraft}
                          onChange={(e) => setActionSlotLabelDraft(e.target.value)}
                          placeholder="Slot label (e.g. 50K Bid / Bro / Song)"
                          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-extrabold text-slate-950"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingActionSlotIndex(null)}
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs text-slate-300"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    {/* VIP 3-Seat Golden Stage (Seats 1-3, never duplicating Seat 0 Owner) */}
                    <div className="relative rounded-3xl border border-amber-400/60 bg-gradient-to-b from-[#2A1052]/90 to-[#140829]/95 px-3 pt-4 pb-2.5 shadow-[0_0_24px_rgba(251,191,36,0.22)]">
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-amber-200 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-4 py-0.5 text-[10px] font-black tracking-wider text-slate-950 shadow">
                        VIP
                      </div>
                      {renderSeatRowWithCpHearts(
                        vipSeats,
                        true,
                        'grid-cols-3',
                        'max-w-[300px]'
                      )}
                    </div>

                    {/* Bottom 8 Glowing Seats (Seats 4-11) with Adjacent Bond & Tag Connectors */}
                    <div className="space-y-2 pt-0.5">
                      {[actionBottomSeats.slice(0, 4), actionBottomSeats.slice(4, 8)].map((rowSeats, rIdx) => (
                        <React.Fragment key={`action-bottom-row-${rIdx}`}>
                          {renderSeatRowWithCpHearts(rowSeats, false, 'grid-cols-4', 'w-full')}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Action Room System Notice Card */}
                    <div className="rounded-2xl border border-purple-400/35 bg-[#120922]/90 px-3 py-2 text-[10.5px] leading-relaxed text-slate-200">
                      <span className="font-extrabold text-amber-300">System: </span>
                      Welcome to <strong className="text-fuchsia-300">OG VELOCITY</strong> Voice Room.
                      Please abide by{' '}
                      <button
                        type="button"
                        onClick={() => setShowRegulationModal(true)}
                        className="font-bold text-purple-300 underline hover:text-purple-200"
                      >
                        Regulations Of The Voice Room
                      </button>
                      .
                    </div>
                  </>
                );
              })()}
            </div>
          ) : isVideoRoom ? (
            <div className="mt-1.5 space-y-2 rounded-3xl border border-cyan-400/30 bg-[#0B1426]/90 p-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-cyan-200">
                  <Tv className="h-4 w-4 text-cyan-300" />
                  <span>
                    Video Theater {roomVideoSync?.title ? `· ${roomVideoSync.title}` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setCameraError(null);
                      try {
                        await ogRealtime.enableRoomCamera(!cameraActive);
                      } catch (err) {
                        setCameraError(
                          err instanceof Error ? err.message : 'Unable to access camera.'
                        );
                      }
                    }}
                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-bold transition ${
                      cameraActive
                        ? 'border-rose-400/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                        : 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                    }`}
                  >
                    {cameraActive ? (
                      <>
                        <VideoOff className="h-3 w-3" />
                        <span>Camera Off</span>
                      </>
                    ) : (
                      <>
                        <Camera className="h-3 w-3" />
                        <span>Live Camera</span>
                      </>
                    )}
                  </button>
                  {hasModAuthority &&
                    (activeRoom.level >= 15 ? (
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-purple-400/40 bg-purple-500/20 px-2.5 py-1 text-[10px] font-bold text-purple-200 hover:bg-purple-500/30">
                        <Film className="h-3 w-3" />
                        <span>Mobile Video</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            if (localVideoObjectUrl) URL.revokeObjectURL(localVideoObjectUrl);
                            const objUrl = URL.createObjectURL(file);
                            setLocalVideoObjectUrl(objUrl);
                            setLocalVideoTitle(file.name);
                            onSyncVideoRoom?.({
                              sourceType: 'local',
                              youtubeUrl: '',
                              playing: true,
                              title: file.name,
                            });
                          }}
                        />
                      </label>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          notify('Mobile Video upload unlocks at Room Level 15. Use Live Camera or YouTube anytime.')
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-400"
                        title="Unlocks at Room Level 15"
                      >
                        <Lock className="h-3 w-3 text-amber-300" />
                        <span>Mobile Video (Lv.15)</span>
                      </button>
                    ))}
                </div>
              </div>

              {cameraError && (
                <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-[11px] font-semibold text-rose-200">
                  {cameraError}
                </div>
              )}

              {/* Live WebRTC Camera Feeds Grid */}
              {(localVideoStream || Object.keys(remoteVideoStreams).length > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {localVideoStream && (
                    <div className="relative overflow-hidden rounded-2xl border border-emerald-400/45 bg-black">
                      <LiveVideoFeed
                        stream={localVideoStream}
                        muted
                        mirrored
                        className="aspect-video w-full object-cover"
                      />
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/75 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                        You (Live Cam)
                      </span>
                    </div>
                  )}
                  {Object.entries(remoteVideoStreams).map(([peerUid, rStream]) => {
                    const peerName =
                      roomRecipientCandidates.find((c) => c.uid === peerUid)?.name ||
                      `User ${peerUid.slice(-4)}`;
                    return (
                      <div
                        key={peerUid}
                        className="relative overflow-hidden rounded-2xl border border-cyan-400/45 bg-black"
                      >
                        <LiveVideoFeed stream={rStream} className="aspect-video w-full object-cover" />
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/75 px-2 py-0.5 text-[9px] font-bold text-cyan-200">
                          {peerName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasModAuthority && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const clean = youtubeUrlDraft.trim();
                    if (!clean) return;
                    setLocalVideoObjectUrl(null);
                    onSyncVideoRoom?.({
                      sourceType: 'youtube',
                      youtubeUrl: clean,
                      playing: true,
                      title: 'YouTube Stream',
                    });
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={youtubeUrlDraft}
                    onChange={(e) => setYoutubeUrlDraft(e.target.value)}
                    placeholder="Paste YouTube URL or Video ID..."
                    className="h-8 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/50 px-2.5 text-xs text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1 rounded-xl bg-cyan-500 px-3 text-[11px] font-extrabold text-slate-950"
                  >
                    <Play className="h-3 w-3" />
                    <span>Play</span>
                  </button>
                </form>
              )}

              {localVideoObjectUrl ? (
                <div className="overflow-hidden rounded-2xl border border-white/15 bg-black">
                  <video
                    src={localVideoObjectUrl}
                    controls
                    autoPlay
                    playsInline
                    className="aspect-video max-h-40 w-full object-contain"
                  />
                  <div className="px-2.5 py-1 text-[10px] text-slate-300">
                    Playing local file: {localVideoTitle}
                  </div>
                </div>
              ) : extractYoutubeEmbedUrl(roomVideoSync?.youtubeUrl) ? (
                <div className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-black">
                  <iframe
                    src={extractYoutubeEmbedUrl(roomVideoSync?.youtubeUrl)!}
                    title={roomVideoSync?.title || 'Room Video'}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="aspect-video max-h-40 w-full border-0"
                  />
                </div>
              ) : (
                <div className="flex aspect-video max-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/40 px-3 text-center text-xs text-slate-400">
                  <Video className="mb-1 h-6 w-6 text-cyan-300/70" />
                  <span>
                    {hasModAuthority
                      ? activeRoom.level >= 15
                        ? 'Tap Live Camera above, paste a YouTube link, or upload a mobile video.'
                        : 'Tap Live Camera above or paste a YouTube link (Mobile Video unlocks at Lv.15).'
                      : 'Tap Live Camera to stream or wait for Host/Admin theater video.'}
                  </span>
                </div>
              )}

              {/* 12 Video Room Seats arranged strictly in 2 rows of 6 */}
              {(() => {
                const videoSeats: VoiceSeat[] = Array.from({ length: 12 }, (_, idx) =>
                  activeRoom.seats[idx] ?? {
                    seatIndex: idx,
                    occupant: null,
                    isUser: false,
                    isLocked: false,
                    isMuted: false,
                    isSpeaking: false,
                    audioLevel: 0,
                    giftScore: 0,
                    role: 'empty' as const,
                  }
                );
                return (
                  <div className="space-y-1.5 pt-1">
                    {renderSeatRowWithCpHearts(videoSeats.slice(0, 6), false, 'grid-cols-6', 'w-full', true)}
                    {renderSeatRowWithCpHearts(videoSeats.slice(6, 12), false, 'grid-cols-6', 'w-full', true)}
                  </div>
                );
              })()}
            </div>
          ) : pkActive && pk ? (
            <div className="mt-1.5 space-y-2 rounded-2xl border border-white/15 bg-gradient-to-b from-pink-950/35 via-[#0D1526]/85 to-sky-950/35 p-2 shadow-[0_0_24px_rgba(236,72,153,0.18)] backdrop-blur-md">
              {/* Owner's Seat & Neighbor Seat Always Visible Above PK Stage (with CP Heart Connector if paired) */}
              {renderSeatRowWithCpHearts(
                topSeats,
                true,
                activeRoom.isOfficial ? 'grid-cols-3' : 'grid-cols-2',
                activeRoom.isOfficial ? 'max-w-[310px]' : 'max-w-[260px]'
              )}

              {/* Owner/Admin PK Setup Controls (Gifting/Voting, Duration 5-60m, 1v1/Multiplayer) */}
              {hasModAuthority && (
                <div className="flex flex-wrap items-center justify-between gap-1 text-[9px]">
                  <div className="flex items-center gap-1 rounded-full bg-black/45 p-0.5">
                    <button
                      type="button"
                      onClick={() => onSetPkConfig(activeRoom.id, { mode: 'gifting' })}
                      className={`rounded-full px-2 py-0.5 font-bold whitespace-nowrap ${
                        pk.mode === 'gifting' ? 'bg-pink-500 text-white' : 'text-slate-300'
                      }`}
                    >
                      Gifting PK
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetPkConfig(activeRoom.id, { mode: 'voting' })}
                      className={`rounded-full px-2 py-0.5 font-bold whitespace-nowrap ${
                        pk.mode === 'voting' ? 'bg-sky-500 text-white' : 'text-slate-300'
                      }`}
                    >
                      Voting PK
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5 rounded-full bg-black/45 p-0.5">
                    {([5, 15, 30, 45, 60] as const).map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        disabled={pk.running}
                        onClick={() => onSetPkConfig(activeRoom.id, { durationMinutes: mins })}
                        className={`rounded-full px-1.5 py-0.5 font-mono-tabular text-[8.5px] font-bold transition-colors disabled:opacity-50 ${
                          (pk.durationMinutes ?? 5) === mins
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 rounded-full bg-black/45 p-0.5">
                    <button
                      type="button"
                      onClick={() => onSetPkConfig(activeRoom.id, { format: '1v1' })}
                      className={`rounded-full px-2 py-0.5 font-bold whitespace-nowrap ${
                        pk.format === '1v1' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      1v1
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetPkConfig(activeRoom.id, { format: 'multiplayer' })}
                      className={`rounded-full px-2 py-0.5 font-bold whitespace-nowrap ${
                        pk.format === 'multiplayer' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      Multiplayer
                    </button>
                  </div>
                </div>
              )}

              {/* Top PK Row: Pink Chair+ Pill (left) | Centered Title | Blue Chair+ Pill (right) */}
              <div className="flex items-center justify-between px-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onJoinPkTeam(activeRoom.id, 'pink');
                    notify('Joined Pink PK Side!');
                  }}
                  title="Join Pink PK Side"
                  className="flex h-7 items-center gap-1 rounded-full bg-gradient-to-b from-pink-400 to-rose-500 px-3 text-white shadow-[0_0_12px_rgba(244,63,94,0.65)] transition-transform hover:scale-105"
                >
                  <Armchair className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black">+</span>
                </button>

                <div className="flex items-center gap-1.5 text-center">
                  <span className="font-display text-xs font-extrabold tracking-wide text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)]">
                    {activeRoom.hostName}
                  </span>
                  <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-pink-200">
                    {pk.mode === 'gifting' ? 'Gifting' : 'Voting'} · {pk.format === '1v1' ? '1v1' : 'Multi'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onJoinPkTeam(activeRoom.id, 'blue');
                    notify('Joined Blue PK Side!');
                  }}
                  title="Join Blue PK Side"
                  className="flex h-7 items-center gap-1 rounded-full bg-gradient-to-b from-sky-400 to-blue-600 px-3 text-white shadow-[0_0_12px_rgba(56,189,248,0.65)] transition-transform hover:scale-105"
                >
                  <Armchair className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black">+</span>
                </button>
              </div>

              {/* Exact PK Split Score Bar + Hanging Frosted Tray matching Reference Screenshot */}
              <div>
                <div className="relative flex h-6 w-full overflow-hidden rounded-full font-mono-tabular text-xs font-black text-white shadow-[0_0_18px_rgba(236,72,153,0.3)]">
                  <div
                    className="flex items-center justify-start bg-gradient-to-r from-rose-500 via-pink-500 to-pink-400 pl-3 transition-all duration-300"
                    style={{ width: `${pinkPercent}%` }}
                  >
                    {pk.pinkScore.toLocaleString()}
                  </div>
                  <div className="flex flex-1 items-center justify-end bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500 pr-3 transition-all duration-300">
                    {pk.blueScore.toLocaleString()}
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center justify-center">
                    <Zap className="h-5 w-5 fill-white text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                  </div>
                </div>

                {/* Frosted Glass Tray Directly Beneath Bar */}
                <div className="relative mx-0.5 -mt-0.5 flex items-center justify-between rounded-b-2xl border border-t-0 border-white/25 bg-white/10 px-2.5 pt-2 pb-2 backdrop-blur-md">
                  {/* Left 3 Pink Chair Dots */}
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`flex h-5.5 w-5.5 items-center justify-center rounded-full border border-pink-200/60 ${
                          i < pk.pinkTeamUids.length
                            ? 'bg-pink-500 text-white shadow-[0_0_8px_rgba(236,72,153,0.85)]'
                            : 'bg-pink-400/55 text-white/95'
                        }`}
                      >
                        <Armchair className="h-3 w-3" />
                      </div>
                    ))}
                  </div>

                  {/* Center Hanging Cyan Trapezoid Start/Timer Tab + Power Off Button Below */}
                  <div className="flex flex-col items-center">
                    {pk.running ? (
                      <div
                        className="-mt-2 flex h-6 items-center justify-center bg-gradient-to-b from-slate-800/95 to-slate-900/95 px-5 font-mono-tabular text-[11px] font-black text-white shadow-md"
                        style={{ clipPath: 'polygon(0 0, 100% 0, 86% 100%, 14% 100%)' }}
                      >
                        <span className="text-pink-400">PK</span>
                        <span className="ml-1.5">
                          {pkMins}:{pkSecs}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!hasModAuthority) {
                            notify('Only Room Owner or Admin can start PK!');
                            return;
                          }
                          onStartPk(activeRoom.id);
                        }}
                        className="-mt-2 flex h-6 items-center justify-center bg-gradient-to-b from-sky-300/90 to-cyan-500/90 px-6 text-[11px] font-black text-white shadow-md transition-transform hover:scale-105"
                        style={{ clipPath: 'polygon(0 0, 100% 0, 86% 100%, 14% 100%)' }}
                      >
                        Start
                      </button>
                    )}

                    {hasModAuthority && (
                      <button
                        type="button"
                        onClick={() => onEndPk(activeRoom.id)}
                        title="End PK"
                        aria-label="End PK"
                        className="mt-1 flex h-5 w-6 items-center justify-center rounded-md border border-white/25 bg-black/25 text-white/90 hover:bg-rose-500 hover:text-white"
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Right 3 Blue Chair Dots */}
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`flex h-5.5 w-5.5 items-center justify-center rounded-full border border-sky-200/60 ${
                          i < pk.blueTeamUids.length
                            ? 'bg-sky-500 text-white shadow-[0_0_8px_rgba(56,189,248,0.85)]'
                            : 'bg-sky-400/55 text-white/95'
                        }`}
                      >
                        <Armchair className="h-3 w-3" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Voting PK quick-vote buttons (STRICTLY 1 VOTE PER USER) */}
              {pk.mode === 'voting' && (() => {
                const alreadyVoted = pk.votedUids.includes(userUid);
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={alreadyVoted}
                      onClick={() => {
                        if (alreadyVoted) return;
                        onVotePkTeam(activeRoom.id, 'pink');
                        notify('Voted +1 for Pink Team! (1 vote per user)');
                      }}
                      className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-1.5 text-[11px] font-extrabold text-white shadow hover:opacity-95 disabled:opacity-50"
                    >
                      {alreadyVoted ? 'Voted ✓' : 'Vote Pink (+1)'}
                    </button>
                    <button
                      type="button"
                      disabled={alreadyVoted}
                      onClick={() => {
                        if (alreadyVoted) return;
                        onVotePkTeam(activeRoom.id, 'blue');
                        notify('Voted +1 for Blue Team! (1 vote per user)');
                      }}
                      className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-1.5 text-[11px] font-extrabold text-white shadow hover:opacity-95 disabled:opacity-50"
                    >
                      {alreadyVoted ? 'Voted ✓' : 'Vote Blue (+1)'}
                    </button>
                  </div>
                );
              })()}

              {/* PK Seat Layout: 1v1 (bottom-left Pink PK, bottom-right Blue PK) OR Multiplayer (split Pink Left vs Blue Right halves) */}
              {pk.format === '1v1' ? (
                <div className="grid grid-cols-4 justify-items-center gap-2 pt-1">
                  {bottomSeats.slice(0, 8).map((seat, idx) => {
                    const side = idx === 4 ? 'pink' : idx === 7 ? 'blue' : undefined;
                    return renderCircularSeat(seat, false, side);
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/15">
                  <div className="grid grid-cols-2 justify-items-center gap-2 bg-pink-500/20 p-2">
                    {bottomSeats.slice(0, halfBottom).map((seat) => renderCircularSeat(seat, false, 'pink'))}
                  </div>
                  <div className="grid grid-cols-2 justify-items-center gap-2 bg-sky-500/20 p-2">
                    {bottomSeats.slice(halfBottom).map((seat) => renderCircularSeat(seat, false, 'blue'))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STANDARD 10-SEAT (2 Top + 8 Bottom, Larger Seats) OR OFFICIAL 15-SEAT (3 Top + 12 Bottom) */
            <div className="mt-1.5 space-y-2">
              {renderSeatRowWithCpHearts(
                topSeats,
                true,
                activeRoom.isOfficial ? 'grid-cols-3' : 'grid-cols-2',
                activeRoom.isOfficial ? 'max-w-[310px]' : 'max-w-[260px]'
              )}

              {crossRowCpBonds.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {crossRowCpBonds.map((bond) => (
                    <div
                      key={bond.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/40 bg-pink-950/50 px-2.5 py-0.5 text-[10px] font-bold text-pink-100 shadow-[0_0_12px_rgba(236,72,153,0.35)]"
                    >
                      <span>{bond.aName}</span>
                      <CpHeartConnectorArt size={24} cpLevel={bond.cpLevel} />
                      <span>{bond.bName}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {bottomSeatRows.map((rowSeats, rIdx) => (
                  <React.Fragment key={`bottom-row-${rIdx}`}>
                    {renderSeatRowWithCpHearts(rowSeats, false, 'grid-cols-4', 'w-full')}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Room Chat Feed (supports Photos + VIP Two-Color Names + Clickable IDs) */}
          <div className="zayro-scroll mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {activeRoom.messages.map((msg) => {
              const senderSeat = msg.senderUid
                ? activeRoom.seats.find((s) => s.occupant?.uid === msg.senderUid)
                : undefined;
              const msgAvatar = senderSeat?.occupant;
              const isSelfMsg = msg.senderUid === userUid || msg.senderName === userName;
              const msgVip = isSelfMsg ? vipLevel : (senderSeat?.vipLevel ?? 0);
              const msgCharm = isSelfMsg ? charm : (senderSeat?.charmValue ?? 0);
              const msgCharmLvl = getCharmLevelInfo(msgCharm).current.level;
              const activeBubble = isSelfMsg ? equippedBubbleColor : msg.bubbleColor;

              if (msg.kind === 'system') {
                return (
                  <div
                    key={msg.id}
                    className="max-w-lg rounded-xl border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] text-slate-200 backdrop-blur-sm"
                  >
                    <span className="font-bold" style={{ color: msg.senderColor }}>
                      {msg.senderName}:{' '}
                    </span>
                    <span>{msg.text}</span>
                  </div>
                );
              }

              if (isSelfMsg && selfChatFrameNum && !msg.imageUrl && !msg.emoteNumber) {
                return (
                  <div key={msg.id} className="max-w-lg space-y-1">
                    <div className="flex flex-wrap items-center gap-1 pl-1">
                      <span
                        className="text-xs font-bold"
                        style={
                          msgVip >= 2 ? getVipNameStyle(msgVip) : { color: msg.senderColor }
                        }
                      >
                        {msg.senderName}
                      </span>
                      {msgVip >= 1 && <VipBadgeArt level={msgVip} size={15} />}
                      {msg.senderUid && <CharmBadgeArt level={msgCharmLvl} size={14} />}
                    </div>
                    <ChatFrameMessage
                      frameNumber={selfChatFrameNum}
                      avatarNode={
                        msgAvatar ? <AvatarArt avatar={msgAvatar} size={36} /> : undefined
                      }
                    >
                      <span className="text-xs font-semibold">{msg.text}</span>
                    </ChatFrameMessage>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex max-w-lg items-start gap-2">
                  {msgAvatar && (
                    <button
                      type="button"
                      onClick={() =>
                        msg.senderUid && openTargetByUid(msg.senderUid, msg.senderName)
                      }
                      className="mt-0.5 shrink-0"
                    >
                      <AvatarArt avatar={msgAvatar} size={28} />
                    </button>
                  )}
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-1">
                      <span
                        className="text-xs font-bold"
                        style={
                          msgVip >= 2 ? getVipNameStyle(msgVip) : { color: msg.senderColor }
                        }
                      >
                        {msg.senderName}
                      </span>
                      {msgVip >= 1 && <VipBadgeArt level={msgVip} size={15} />}
                      {msg.senderUid && <CharmBadgeArt level={msgCharmLvl} size={14} />}
                      {msg.senderUid && (
                        <button
                          type="button"
                          onClick={() => openTargetByUid(msg.senderUid!, msg.senderName)}
                          className="font-mono-tabular text-[9.5px] text-cyan-300 underline-offset-2 hover:underline"
                          title="Click ID to Mute or Add Friend"
                        >
                          [{msg.senderUid}]
                        </button>
                      )}
                    </div>
                    <div
                      style={
                        activeBubble
                          ? {
                              borderColor: activeBubble,
                              background: `linear-gradient(180deg, rgba(16,11,20,0.94) 0%, ${activeBubble}38 100%)`,
                              boxShadow: `0 0 12px ${activeBubble}44`,
                            }
                          : undefined
                      }
                      className="inline-block min-w-[88px] rounded-2xl border border-white/15 bg-slate-950/45 px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_18px_rgba(0,0,0,0.28)] backdrop-blur-md"
                    >
                      {msg.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setLightboxImage(msg.imageUrl!)}
                          className="mb-1 block overflow-hidden rounded-xl border border-white/15"
                        >
                          <img
                            src={msg.imageUrl}
                            alt="Room upload"
                            className="max-h-36 w-auto rounded-xl object-cover"
                          />
                        </button>
                      )}
                      {msg.emoteNumber && (
                        <div className="mb-1 flex items-center gap-2">
                          <EmoteSpriteArt
                            emoteNumber={msg.emoteNumber}
                            size={34}
                            alt={msg.text}
                            animated
                          />
                        </div>
                      )}
                      {msg.text && <span>{msg.text}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Dock: Emotes (30 Animated Cutouts) + Menu + Gift Dock + Photo Upload + Speaker at Bottom */}
        <div className="mt-1.5 shrink-0 space-y-2 border-t border-white/10 pt-2">
          {showEmoteDock && (
            <div className="zayro-scroll max-h-56 overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#0A101D]/95 p-2.5 shadow-2xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold text-slate-300">
                <span>Emotes (Triggers on Seat)</span>
                <button
                  type="button"
                  onClick={() => setShowEmoteDock(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close Emotes"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {ROOM_EMOTES.map((em) => (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => {
                      onSendEmote(em.emoteNumber, em.label, em.symbol, em.motion);
                      setShowEmoteDock(false);
                      notify(`Triggered "${em.label}" emote!`);
                    }}
                    className="flex flex-col items-center rounded-xl border border-white/5 bg-[#132038] px-1 py-1.5 transition-colors hover:border-cyan-400/50 hover:bg-[#192946]"
                  >
                    <EmoteSpriteArt
                      emoteNumber={em.emoteNumber}
                      size={32}
                      alt={em.label}
                      animated
                      motion={em.motion}
                    />
                    <span className="mt-1 line-clamp-1 text-[9px] font-semibold text-slate-200">
                      {em.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showRoomMenu && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/75 p-2.5 text-xs backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowRoomLevelsDrawer((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  <Award className="h-3 w-3 text-sky-300" />
                  Room EXP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteFriendsModal(true);
                    setShowRoomMenu(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/35 bg-cyan-500/20 px-2.5 py-1 text-[11px] font-semibold text-cyan-200"
                >
                  <UserPlus className="h-3 w-3" />
                  Invite Friends
                </button>
                {hasModAuthority && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = isVideoRoom ? 'Normal' : 'Video';
                        onUpdateRoomSettings(activeRoom.id, { roomSettings: { roomMode: nextMode } });
                        setShowRoomMenu(false);
                        notify(`Switched to ${nextMode} Room`);
                      }}
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${
                        isVideoRoom
                          ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                          : 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200'
                      }`}
                    >
                      <Video className="h-3 w-3" />
                      {isVideoRoom ? 'Normal Room' : 'Video Room'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = isActionRoom ? 'Normal' : 'Action';
                        if (nextMode === 'Action') setShowGiftDock(false);
                        onUpdateRoomSettings(activeRoom.id, { roomSettings: { roomMode: nextMode } });
                        setShowRoomMenu(false);
                        notify(`Switched to ${nextMode} Room`);
                      }}
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${
                        isActionRoom
                          ? 'border-purple-400 bg-purple-500/30 text-purple-100'
                          : 'border-purple-400/35 bg-purple-500/15 text-purple-200'
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      {isActionRoom ? 'Normal Room' : 'Action Room'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePkActive(activeRoom.id);
                        setShowRoomMenu(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-400/40 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200"
                    >
                      <Swords className="h-3 w-3" />
                      {pkActive ? 'Hide PK' : 'Start PK'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowRoomMenu(false);
                    onExitRoom();
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-400/45 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500 hover:text-white"
                >
                  <LogOut className="h-3 w-3" />
                  Exit Room
                </button>
              </div>
              <div className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-amber-300">
                <ZayroCoinArt size={14} />
                <span>{coins.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Gift Section Overlay Sheet (Disabled in Action Room) */}
          {!isActionRoom && showGiftDock && selectedGift && (
            <div className="zayro-scroll absolute inset-x-2 bottom-14 z-30 max-h-[68%] overflow-y-auto rounded-3xl border border-cyan-400/30 bg-[#0A101D]/95 p-3 shadow-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1">
                  {roomRecipientCandidates.slice(0, 8).map((cand) => {
                    const isPicked =
                      !customGiftUid.trim() && activeRecipientCandidate?.uid === cand.uid;
                    return (
                      <button
                        key={cand.uid}
                        type="button"
                        onClick={() => {
                          setCustomGiftUid('');
                          setSelectedRecipientUid(cand.uid);
                          setSelectedRecipient(cand.name);
                        }}
                        className={`relative flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[11px] font-semibold transition-colors ${
                          isPicked
                            ? 'border-rose-400 bg-rose-500/20 text-white'
                            : 'border-white/10 bg-[#132038] text-slate-300 hover:border-cyan-400/40'
                        }`}
                      >
                        <AvatarArt avatar={cand.avatar} size={24} />
                        <span>{cand.name}</span>
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={customGiftUid}
                  onChange={(e) => setCustomGiftUid(e.target.value)}
                  placeholder="Any User ID (e.g. 100001)"
                  className="w-40 rounded-xl border border-white/15 bg-[#070B14] px-2.5 py-1.5 font-mono-tabular text-[11px] text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="my-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                <span>
                  To{' '}
                  <strong className="text-rose-300">
                    {customGiftUid.trim()
                      ? `ID ${customGiftUid.trim()}`
                      : `${activeRecipientCandidate?.name || selectedRecipient} (${activeRecipientCandidate?.uid || ''})`}
                  </strong>{' '}
                  · Charm +{(selectedGift.charmValue * giftQty).toLocaleString()} · Random Coins
                </span>
                <button
                  type="button"
                  onClick={() => setShowGiftDock(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close Gift Drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="zayro-scroll grid max-h-60 grid-cols-4 gap-2 overflow-y-auto pr-1">
                {gifts.map((gift) => {
                  const isSelected = gift.id === selectedGift.id;
                  const isMythic = gift.rarity === 'Mythic';
                  return (
                    <button
                      key={gift.id}
                      type="button"
                      onClick={() => setSelectedGiftId(gift.id)}
                      className={`relative flex flex-col items-center rounded-2xl border p-2 text-center transition-all ${
                        isSelected
                          ? 'border-rose-400 bg-[#192946] ring-2 ring-rose-400/60'
                          : isMythic
                            ? 'border-amber-400/50 bg-[#132038] hover:border-rose-400/60'
                            : 'border-white/10 bg-[#0D1526] hover:border-cyan-400/50'
                      }`}
                    >
                      {isMythic && (
                        <span className="mb-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-1.5 py-0.5 text-[8px] font-extrabold text-white">
                          LEGENDARY
                        </span>
                      )}
                      {isSelected && (
                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <GiftArtwork giftId={gift.id} gift={gift} size={44} />
                      <span className="mt-1 line-clamp-1 text-[10px] font-semibold text-white">
                        {gift.name}
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-0.5 font-mono-tabular text-[10px] font-bold text-amber-300">
                        <ZayroCoinArt size={11} />
                        {gift.cost.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/10 bg-[#070B14] px-2.5 py-1.5">
                <input
                  type="text"
                  maxLength={30}
                  value={bigGiftMessage}
                  onChange={(e) => setBigGiftMessage(e.target.value.slice(0, 30))}
                  placeholder="Big gift broadcast message (max 30 chars)..."
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-white placeholder-slate-500 focus:outline-none"
                />
                <span className="shrink-0 font-mono-tabular text-[10px] text-slate-400">
                  {bigGiftMessage.length}/30
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#132038] px-3 py-1.5 font-mono-tabular text-xs font-extrabold text-amber-300">
                  <ZayroCoinArt size={16} />
                  <span>{coins.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={giftQty}
                    onChange={(e) => setGiftQty(Number(e.target.value))}
                    aria-label="Gift Quantity"
                    className="rounded-xl border border-white/15 bg-[#132038] px-2.5 py-2 font-mono-tabular text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={99}>99</option>
                  </select>

                  <button
                    type="button"
                    disabled={coins < selectedGift.cost * giftQty}
                    onClick={() => {
                      const typedUid = customGiftUid.trim().toUpperCase();
                      const matchedCustom = typedUid
                        ? roomRecipientCandidates.find((c) => c.uid.toUpperCase() === typedUid)
                        : undefined;
                      const finalUid = typedUid || activeRecipientCandidate?.uid;
                      const finalName = typedUid
                        ? (matchedCustom?.name ?? `User ${typedUid}`)
                        : (activeRecipientCandidate?.name || selectedRecipient);
                      const cleanNote = bigGiftMessage.trim().slice(0, 30) || undefined;
                      onSendGift(selectedGift, finalName, giftQty, finalUid, cleanNote);
                      setBigGiftMessage('');
                      notify(`Sent ${giftQty}x ${selectedGift.name} to ${finalName}!`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2 text-xs font-extrabold text-white shadow-lg shadow-rose-500/30 hover:opacity-95 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Control Row */}
          <div className="flex items-center gap-1.5">
            {userSeatIndex !== null && (
              <button
                type="button"
                onClick={onToggleMicMute}
                title={
                  isMicMuted
                    ? 'Unmute Mic'
                    : isLiveMicActive
                      ? 'Mute Live Mic'
                      : 'Mute Mic'
                }
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                  isMicMuted
                    ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                    : 'border-emerald-400/50 bg-emerald-500 text-slate-950'
                }`}
              >
                {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleSpeaker}
              title={speakerEnabled ? 'Mute Room Speaker' : 'Turn Room Speaker On'}
              aria-label="Room Speaker"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                speakerEnabled
                  ? 'border-emerald-400/45 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/15 bg-black/45 text-slate-400'
              }`}
            >
              {speakerEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <form
              onSubmit={(e) => {
                if (!hasModAuthority && activeRoom.roomSettings?.banTextChat) {
                  e.preventDefault();
                  notify('Text chatting is disabled by the room host.');
                  return;
                }
                handleChatSubmit(e);
              }}
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              <input
                type="text"
                value={chatInput}
                disabled={isClosedRoom || (!hasModAuthority && Boolean(activeRoom.roomSettings?.banTextChat))}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  isClosedRoom
                    ? 'Room closed until Owner or Admin enters'
                    : !hasModAuthority && activeRoom.roomSettings?.banTextChat
                      ? 'Text chat disabled by host'
                      : 'Say something...'
                }
                className="h-9 min-w-0 flex-1 rounded-full border border-white/15 bg-black/45 px-3 text-xs text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              {(!activeRoom.roomSettings?.banPhotoChat || hasModAuthority) && !isClosedRoom && (
                <label
                  title="Send Photo in Voice Room"
                  aria-label="Send Photo in Voice Room"
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/45 text-cyan-300 hover:border-cyan-400/60 hover:text-white"
                >
                  <ImagePlus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleRoomPhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
              {chatInput.trim() && !isClosedRoom && (
                <button
                  type="submit"
                  aria-label="Send"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            <button
              type="button"
              onClick={() => setShowEmoteDock((v) => !v)}
              aria-label="Emotes"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                showEmoteDock
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-white/15 bg-black/45 text-slate-200'
              }`}
            >
              <Smile className="h-4 w-4" />
            </button>

            {!isActionRoom && (
              <button
                type="button"
                onClick={() => setShowGiftDock((v) => !v)}
                aria-label="Toggle Gifts"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/30"
              >
                <Gift className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowRoomMenu((v) => !v)}
              aria-label="Room Controls"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                showRoomMenu
                  ? 'border-cyan-400 bg-cyan-500/25 text-white'
                  : 'border-white/15 bg-black/45 text-slate-200'
              }`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Room Profile Card Popup */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 backdrop-blur-xs sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-cyan-400/25 bg-[#0D1526] shadow-2xl">
            <div
              className="relative h-24 w-full"
              style={
                actionTarget.avatar.coverUrl
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(7,11,20,0.25), rgba(13,21,38,0.92)), url(${actionTarget.avatar.coverUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : {
                      background:
                        'radial-gradient(circle at 30% 35%, rgba(34,211,238,0.4), transparent 55%), linear-gradient(145deg, #071326 0%, #0D1526 65%, #132038 100%)',
                    }
              }
            >
              <div className="pointer-events-none flex h-full items-center justify-center font-display text-4xl font-black tracking-widest text-white/25">
                {actionTarget.name.slice(0, 2).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActionTarget(null);
                  setShowCardReplyInput(false);
                  setCardReplyDraft('');
                }}
                aria-label="Close Profile Card"
                className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-slate-200 hover:bg-black/75 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 pb-4">
              <div className="flex items-end gap-2.5">
                <div className="relative -mt-10 inline-block overflow-visible">
                  <AvatarArt
                    avatar={actionTarget.avatar}
                    size={64}
                    frameId={
                      actionTarget.uid === userUid
                        ? equippedFrameId
                        : actionTarget.avatar.seatFrameNumber
                          ? `frame-${actionTarget.avatar.seatFrameNumber}`
                          : undefined
                    }
                    seatFrameNumber={
                      actionTarget.uid === userUid ? undefined : actionTarget.avatar.seatFrameNumber
                    }
                  />
                  {(actionTarget.uid === userUid ||
                    activeRoom.seats.some((s) => s.occupant?.uid === actionTarget.uid) ||
                    activeRoom.listeners.some((l) => l.uid === actionTarget.uid)) && (
                    <span className="absolute right-1 bottom-1 h-3 w-3 rounded-full border-2 border-[#0D1526] bg-emerald-400" />
                  )}
                </div>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className="text-sm leading-none"
                  title={actionTarget.avatar.gender || 'Male'}
                  aria-label={`Gender: ${actionTarget.avatar.gender || 'Male'}`}
                >
                  {getGenderSymbol(actionTarget.avatar.gender)}
                </span>
                <span
                  className="font-display text-lg font-extrabold"
                  style={getVipNameStyle(actionTarget.vipLevel)}
                >
                  {actionTarget.name}
                </span>
                <VipBadgeArt level={actionTarget.vipLevel} size={22} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CharmBadgePill
                  level={getCharmLevelInfo(actionTarget.charm).current.level}
                  charm={actionTarget.charm}
                />
                <span className="rounded-full border border-cyan-400/35 bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200">
                  {activeRoom.title}
                </span>
                {actionTarget.avatar.cpPartner && (
                  <button
                    type="button"
                    onClick={() => openCpPartnerProfileFromCard(actionTarget)}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-400/45 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200 hover:bg-rose-500/30"
                    title="Open CP Partner Profile Page"
                  >
                    <Heart className="h-2.5 w-2.5 fill-rose-400 text-rose-400" />
                    <span>CP · {actionTarget.avatar.cpPartner.partnerName}</span>
                  </button>
                )}
              </div>

              {actionTarget.avatar.cpPartner && showCardCpId && (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-rose-400/35 bg-rose-950/40 px-2.5 py-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <RingSpriteArt
                      ringNumber={actionTarget.avatar.cpPartner.ringNumber}
                      size={24}
                      alt={actionTarget.avatar.cpPartner.ringName}
                    />
                    <span className="font-mono-tabular font-bold text-rose-100">
                      Partner ID: {actionTarget.avatar.cpPartner.partnerUid}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-rose-300">
                  Lv.{getCharmLevelInfo(actionTarget.charm).current.level}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(actionTarget.uid).catch(() => {});
                    notify(`Copied ID ${actionTarget.uid}`);
                  }}
                  className="inline-flex items-center gap-1 font-mono-tabular text-xs text-slate-300 hover:text-white"
                >
                  <span>ID: {actionTarget.uid}</span>
                  <Copy className="h-3 w-3 text-slate-400" />
                </button>
              </div>

              <div className="mt-3 rounded-xl bg-[#132038] px-3 py-2 text-xs italic text-slate-200">
                “{actionTarget.avatar.bio || 'Voice Sanctuary Explorer · Catch me on mic!'}”
              </div>

              <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onInspectUser({
                      avatar: actionTarget.avatar,
                      vipLevel: actionTarget.vipLevel,
                      charm: actionTarget.charm,
                      cpPartner: actionTarget.avatar.cpPartner ?? null,
                      ringNumber: actionTarget.avatar.cpPartner?.ringNumber ?? 1,
                      roomId: activeRoom.id,
                      roomTitle: activeRoom.title,
                    });
                    setActionTarget(null);
                    setShowCardReplyInput(false);
                    setShowCardCpId(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#192946] px-2.5 py-2.5 font-bold text-white hover:bg-[#22365c]"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCardReplyInput((v) => !v)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 px-2.5 py-2.5 font-bold text-slate-950 shadow-md hover:opacity-95"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Message</span>
                </button>

                {!isActionRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomGiftUid('');
                      setSelectedRecipientUid(actionTarget.uid);
                      setSelectedRecipient(actionTarget.name);
                      setShowGiftDock(true);
                      setActionTarget(null);
                      setShowCardReplyInput(false);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#192946] px-2.5 py-2.5 font-bold text-rose-300 hover:bg-[#22365c]"
                  >
                    <Gift className="h-3.5 w-3.5 text-rose-400" />
                    <span>Gift</span>
                  </button>
                )}
              </div>

              {showCardReplyInput && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!cardReplyDraft.trim()) return;
                    onSendBackMessage(actionTarget.uid, actionTarget.name, cardReplyDraft);
                    notify(`Sent message to ${actionTarget.name}`);
                    setCardReplyDraft('');
                    setShowCardReplyInput(false);
                  }}
                  className="mt-2.5 flex items-center gap-1.5 rounded-2xl border border-cyan-400/35 bg-[#070B14] p-1.5"
                >
                  <input
                    type="text"
                    value={cardReplyDraft}
                    onChange={(e) => setCardReplyDraft(e.target.value)}
                    placeholder={`Send back message to ${actionTarget.name}...`}
                    className="min-w-0 flex-1 bg-transparent px-2 text-xs text-white placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-400"
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMessageUser(actionTarget.uid, actionTarget.name);
                      setActionTarget(null);
                      setShowCardReplyInput(false);
                    }}
                    className="rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/20"
                  >
                    Chat
                  </button>
                </form>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                {(() => {
                  const targetIds = [actionTarget.uid, actionTarget.avatar.publicId].filter(Boolean) as string[];
                  const isSelfTarget = targetIds.includes(userUid);
                  const isAlreadyFriend = friends.some((f) =>
                    targetIds.includes(f.uid) || (f.publicId ? targetIds.includes(f.publicId) : false)
                  );
                  const isOutgoingPending = outgoingPendingFriendUids.some((id) =>
                    targetIds.includes(id)
                  );
                  if (isSelfTarget) return null;
                  if (isAlreadyFriend) {
                    return (
                      <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1.5 font-semibold text-emerald-300">
                        <UserCheck className="h-3 w-3" />
                        Friends
                      </span>
                    );
                  }
                  if (isOutgoingPending) {
                    return (
                      <span className="inline-flex items-center gap-1 rounded-xl border border-amber-400/35 bg-amber-500/15 px-2.5 py-1.5 font-semibold text-amber-200">
                        <Check className="h-3 w-3" />
                        Request Sent
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        notify(onAddFriendByUid(actionTarget.avatar.publicId || actionTarget.uid));
                        setActionTarget(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#132038] px-2.5 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-500/20"
                    >
                      <UserPlus className="h-3 w-3" />
                      Add Friend
                    </button>
                  );
                })()}

                {isOwner && actionTarget.uid !== activeRoom.ownerUid && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleAdmin(activeRoom.id, actionTarget.uid, actionTarget.name);
                      const alreadyAdmin = activeRoom.adminUids.includes(actionTarget.uid);
                      notify(
                        alreadyAdmin
                          ? `Removed ${actionTarget.name} as Admin`
                          : `Appointed ${actionTarget.name} as Admin`
                      );
                      setActionTarget(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-sky-400/40 bg-sky-500/20 px-2.5 py-1.5 font-bold text-sky-200 hover:bg-sky-500/30"
                  >
                    <Shield className="h-3 w-3" />
                    {activeRoom.adminUids.includes(actionTarget.uid) ? 'Remove Admin' : 'Make Admin'}
                  </button>
                )}

                {onSupportUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onSupportUser(
                        actionTarget.uid,
                        actionTarget.name,
                        actionTarget.avatar.cpPartner?.ringNumber ?? 1,
                        actionTarget.avatar.cpPartner?.ringName ?? 'Emerald Crown Ring'
                      );
                      notify(`Sent Ring Support blessing to ${actionTarget.name}!`);
                      setActionTarget(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-400/45 bg-gradient-to-r from-rose-500/30 to-amber-500/25 px-2.5 py-1.5 font-bold text-rose-100 hover:brightness-110"
                  >
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    Support Ring
                  </button>
                )}

                {onProposeCp && actionTarget.uid !== userUid && (
                  <button
                    type="button"
                    onClick={() => setShowSeatCpPicker((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-xl border border-pink-400/40 bg-pink-500/15 px-2.5 py-1.5 font-semibold text-pink-200 hover:bg-pink-500/25"
                  >
                    <Heart className="h-3 w-3 fill-pink-400 text-pink-400" />
                    Propose CP
                  </button>
                )}

                {showSeatCpPicker && onProposeCp && actionTarget.uid !== userUid && (
                  <div className="w-full space-y-2 rounded-2xl border border-rose-400/35 bg-[#0A101D] p-2.5 text-[11px]">
                    {bondRingItems.length === 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-amber-200">
                          You must purchase &amp; own a Ring in the Shop before sending a CP proposal.
                        </div>
                        {onOpenRingShop && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSeatCpPicker(false);
                              setActionTarget(null);
                              onOpenRingShop();
                            }}
                            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 py-1.5 text-[11px] font-extrabold text-white"
                          >
                            Buy Ring in Shop
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="font-bold text-rose-200">
                          Pick an Owned CP Bond Ring to Propose to {actionTarget.name}:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {bondRingItems.map((ring) => {
                            const rNum = ring.ringNumber ?? 1;
                            const chosen =
                              (bondRingItems.find((r) => r.ringNumber === selectedSeatCpRingNum)
                                ?.ringNumber ?? bondRingItems[0]?.ringNumber) === rNum;
                            return (
                              <button
                                key={ring.id}
                                type="button"
                                onClick={() => setSelectedSeatCpRingNum(rNum)}
                                title={ring.name}
                                className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${
                                  chosen
                                    ? 'border-rose-400 bg-rose-500/25 text-white'
                                    : 'border-white/10 bg-[#132038] text-slate-300'
                                }`}
                              >
                                <RingSpriteArt ringNumber={rNum} size={22} alt={ring.name} imageUrl={ring.imageUrl} />
                                <span className="text-[10px] font-bold">#{rNum}</span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const ringObj =
                              bondRingItems.find((r) => r.ringNumber === selectedSeatCpRingNum) ??
                              bondRingItems[0];
                            if (!ringObj) return;
                            onProposeCp(
                              actionTarget.avatar.publicId || actionTarget.uid,
                              actionTarget.name,
                              actionTarget.avatar.id,
                              ringObj.ringNumber ?? 1,
                              ringObj.name
                            );
                            notify(`Sent CP Ring proposal (${ringObj.name}) to ${actionTarget.name}!`);
                            setShowSeatCpPicker(false);
                            setActionTarget(null);
                          }}
                          className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 py-1.5 text-[11px] font-extrabold text-white"
                        >
                          Send Bond Ring Proposal
                        </button>
                      </>
                    )}
                  </div>
                )}

                {hasModAuthority && actionTarget.uid !== activeRoom.ownerUid && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (actionTarget.seatIndex !== undefined) {
                          onToggleMuteSeat(actionTarget.seatIndex);
                        } else {
                          onToggleMuteByUid(activeRoom.id, actionTarget.uid);
                        }
                        notify(
                          actionTarget.isMuted
                            ? `Unmuted ${actionTarget.name}`
                            : `Muted ${actionTarget.name}`
                        );
                        setActionTarget(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold text-white"
                    >
                      {actionTarget.isMuted ? (
                        <Mic className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <MicOff className="h-3 w-3 text-amber-300" />
                      )}
                      {actionTarget.isMuted ? 'Unmute' : 'Mute'}
                    </button>

                    {actionTarget.isListener ? (
                      <button
                        type="button"
                        onClick={() => {
                          onLiftUserToSeat(activeRoom.id, {
                            uid: actionTarget.uid,
                            name: actionTarget.name,
                            avatarId: actionTarget.avatar.id,
                            vipLevel: actionTarget.vipLevel,
                            charm: actionTarget.charm,
                          });
                          notify(`Lifted ${actionTarget.name} to seat`);
                          setActionTarget(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1.5 font-bold text-slate-950"
                      >
                        <ArrowUpCircle className="h-3 w-3" />
                        Lift
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onKickUser(activeRoom.id, actionTarget.uid, actionTarget.name);
                          notify(`Removed ${actionTarget.name} from seat`);
                          setActionTarget(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-2.5 py-1.5 font-bold text-white"
                      >
                        <UserMinus className="h-3 w-3" />
                        Kick
                      </button>
                    )}
                  </>
                )}

                {actionTarget.uid === userUid && userSeatIndex !== null && !(isOwner && userSeatIndex === 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      onLeaveSeat();
                      notify('Stepped down from mic seat');
                      setActionTarget(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 font-bold text-amber-200"
                  >
                    <ArrowDownCircle className="h-3 w-3" />
                    Leave Seat
                  </button>
                )}

                {onReportUser && actionTarget.uid !== userUid && (
                  <button
                    type="button"
                    onClick={() => {
                      onReportUser('user', actionTarget.uid, `Reported ${actionTarget.name} inside ${activeRoom.title}`);
                      notify(`Reported ${actionTarget.name} to moderation`);
                      setActionTarget(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-400/35 bg-amber-500/15 px-2.5 py-1.5 font-bold text-amber-200"
                  >
                    <Flag className="h-3 w-3" />
                    Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends to Voice Room Modal */}
      {showInviteFriendsModal && (
        <div
          onClick={() => setShowInviteFriendsModal(false)}
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-cyan-400/30 bg-[#0D1526] p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <h3 className="font-display text-base font-bold text-white">Invite Friends</h3>
                <p className="text-[11px] text-slate-400">
                  Invite friends to {activeRoom.title} (ID {activeRoom.uid})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteFriendsModal(false)}
                aria-label="Close Invite Friends"
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="zayro-scroll mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {friends.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  No friends yet. Add friends by UID first!
                </p>
              ) : (
                friends.map((fr) => {
                  const av: AvatarConfig = {
                    id: fr.avatarId || fr.uid,
                    uid: fr.uid,
                    publicId: fr.publicId || fr.uid,
                    name: fr.name,
                    handle: `@${fr.name.toLowerCase().replace(/\s+/g, '') || 'user'}`,
                    photoUrl: fr.photoUrl || undefined,
                    equippedFrameId: fr.equippedFrameId ?? null,
                    skinTone: '#D69E76',
                    hairColor: '#1E293B',
                    robeColor: '#7C3AED',
                    accentColor: '#38BDF8',
                    ornament: 'crown',
                  };
                  const isInvited = invitedFriendUids.includes(fr.uid);
                  return (
                    <div
                      key={fr.uid}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#132038] px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <AvatarArt avatar={av} size={34} frameId={fr.equippedFrameId ?? undefined} />
                        <div>
                          <div className="text-xs font-bold text-white">{fr.name}</div>
                          <div className="font-mono-tabular text-[10px] text-slate-400">
                            {fr.uid} · {fr.status}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isInvited}
                        onClick={() => {
                          onInviteFriendToRoom(activeRoom.id, fr);
                          setInvitedFriendUids((prev) => [...prev, fr.uid]);
                          notify(`Invited ${fr.name} to ${activeRoom.title}!`);
                        }}
                        className={`rounded-xl px-3 py-1.5 text-[11px] font-bold whitespace-nowrap ${
                          isInvited
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:opacity-95'
                        }`}
                      >
                        {isInvited ? 'Invited' : 'Invite'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            aria-label="Close photo"
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Full preview"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Voice Room Regulations Modal */}
      {showRegulationModal && (
        <div
          onClick={() => setShowRegulationModal(false)}
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-purple-400/35 bg-[#120A24] p-5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="font-display text-base font-extrabold text-amber-300">
                Regulations Of The Voice Room
              </h3>
              <button
                type="button"
                onClick={() => setShowRegulationModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-200">
              <li>1. Respect all hosts, guests, and moderators on stage.</li>
              <li>2. Harassment, hate speech, explicit, or illegal content is strictly forbidden.</li>
              <li>3. No unauthorized external links, scams, or payment solicitation in room chat.</li>
              <li>4. Minors may only use voice features with parental or guardian knowledge.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
