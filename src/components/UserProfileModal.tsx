import React, { useState } from 'react';
import {
  Ban,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Heart,
  Lock,
  MessageCircle,
  MoreVertical,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  SHOP_ITEMS,
  getCharmLevelInfo,
  getCountryFlag,
  getCpLevelInfo,
  getGenderSymbol,
  getRelationshipTagDef,
  getRelationshipTagLevelInfo,
  getVipNameStyle,
} from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import {
  CharmBadgePill,
  RingSpriteArt,
  VipBadgeArt,
} from '../graphics/SpriteArtwork';
import type { AvatarConfig, PublicUserProfile, ShopItem } from '../types';
import { CoupleHomeModal } from './CoupleHomeModal';

interface UserProfileModalProps {
  profile: PublicUserProfile | null;
  currentUserUid?: string;
  ownedItemIds?: string[];
  shopItems?: ShopItem[];
  onOpenRingShop?: () => void;
  onClose: () => void;
  onInspectUser?: (profile: PublicUserProfile) => void;
  onInspectUserById?: (uid: string) => void;
  onJoinRoom?: (roomId: string) => void;
  onAddFriend?: (uid: string) => void;
  onCancelFriendRequest?: (uid: string) => void;
  onAcceptFriendRequest?: (uid: string) => void;
  onDeclineFriendRequest?: (uid: string) => void;
  onUnfriendUser?: (uid: string) => void;
  onBlockUser?: (uid: string) => void;
  onUnblockUser?: (uid: string) => void;
  onMessageUser?: (uid: string, name: string) => void;
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
}

function formatLastSeen(lastSeenAt?: string | null): string {
  if (!lastSeenAt) return 'Offline';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 1000));
  if (!Number.isFinite(diffSec)) return 'Offline';
  if (diffSec < 60) return 'Last seen just now';
  if (diffSec < 3600) return `Last seen ${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `Last seen ${Math.floor(diffSec / 3600)}h ago`;
  return `Last seen ${Math.floor(diffSec / 86400)}d ago`;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  profile,
  currentUserUid,
  ownedItemIds = [],
  shopItems = SHOP_ITEMS,
  onOpenRingShop,
  onClose,
  onInspectUser,
  onInspectUserById,
  onJoinRoom,
  onAddFriend,
  onCancelFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onUnfriendUser,
  onBlockUser,
  onUnblockUser,
  onMessageUser,
  onSupportUser,
  onProposeCp,
}) => {
  const [showCpPartnerId, setShowCpPartnerId] = useState(false);
  const [showRingCollection, setShowRingCollection] = useState(false);
  const [showRingPicker, setShowRingPicker] = useState(false);
  const ringItems = shopItems.filter((i) => i.category === 'ring');
  const ownedRingItems = ringItems.filter((r) => ownedItemIds.includes(r.id));
  const [selectedRingId, setSelectedRingId] = useState<string>('');
  const [proposalSentNotice, setProposalSentNotice] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedProfileId, setCopiedProfileId] = useState(false);

  if (!profile) return null;

  const { avatar, vipLevel, charm, ringNumber = 1, roomId, roomTitle, roomLocked } = profile;
  const activeCp = profile.cpPartner ?? avatar.cpPartner ?? null;
  const isSelf = currentUserUid && avatar.uid === currentUserUid;
  const charmLevel = getCharmLevelInfo(charm).current.level;
  const userRingNumbers = Array.from(
    new Set(
      [
        ...(isSelf ? ownedRingItems.map((r) => r.ringNumber ?? 1) : avatar.ownedRingNumbers ?? []),
        ...(activeCp?.ringNumber ? [activeCp.ringNumber] : []),
        ringNumber,
      ].filter((n) => n >= 1)
    )
  );
  const cpCharm = activeCp?.cpCharm ?? 0;
  const cpLevelInfo = getCpLevelInfo(cpCharm);
  const cpPartnerAvatar: AvatarConfig = activeCp
    ? {
        ...avatar,
        id: activeCp.partnerAvatarId || activeCp.partnerUid,
        uid: activeCp.partnerUid,
        name: activeCp.partnerName,
        photoUrl: activeCp.partnerPhotoUrl ?? undefined,
        equippedFrameId: null,
        seatFrameNumber: undefined,
      }
    : avatar;

  const isUserOnline = Boolean(profile.online || roomId);
  const resolvedFrameId =
    profile.equippedFrameId ??
    avatar.equippedFrameId ??
    (avatar.seatFrameNumber ? `frame-${avatar.seatFrameNumber}` : null);
  const hasEquippedFrame = Boolean(resolvedFrameId || avatar.seatFrameNumber);
  const friendStatus = profile.friendStatus ?? 'none';
  const canDirectMessage = Boolean(!isSelf && friendStatus === 'friends');

  const formattedCharm =
    charm >= 1_000_000
      ? `${(charm / 1_000_000).toFixed(1)}M`
      : charm >= 1_000
        ? `${(charm / 1_000).toFixed(1)}K`
        : String(charm);

  const sampleTags = profile.tags ?? [];

  const pickedRingItem =
    ownedRingItems.find((r) => r.id === selectedRingId) ?? ownedRingItems[0] ?? null;

  const handleCopyPartnerId = (uid: string) => {
    navigator.clipboard?.writeText(uid).catch(() => {});
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1800);
  };

  const openCpPartnerProfile = () => {
    if (!activeCp) return;
    if (onInspectUserById) {
      onInspectUserById(activeCp.partnerUid);
      return;
    }
    if (!onInspectUser) {
      setShowCpPartnerId((v) => !v);
      return;
    }
    const partnerBioAvatar: AvatarConfig = {
      ...cpPartnerAvatar,
      uid: activeCp.partnerUid,
      name: activeCp.partnerName,
      cpPartner: {
        partnerUid: avatar.uid,
        partnerName: avatar.name,
        partnerAvatarId: avatar.id,
        ringNumber: activeCp.ringNumber,
        ringName: activeCp.ringName,
        since: activeCp.since,
        cpCharm: activeCp.cpCharm,
        cpLevel: activeCp.cpLevel,
      },
    };
    onInspectUser({
      avatar: partnerBioAvatar,
      vipLevel: 0,
      charm: activeCp.cpCharm ?? 0,
      cpPartner: partnerBioAvatar.cpPartner,
      ringNumber: activeCp.ringNumber,
    });
  };

  const activeRelTags = (avatar.relationshipTags ?? []).filter(
    (t) => !t.status || t.status === 'active'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/85 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="zayro-scroll relative h-full w-full max-w-2xl overflow-y-auto bg-[#0D1526] shadow-2xl sm:h-[94vh] sm:rounded-3xl sm:border sm:border-cyan-400/20"
      >
        {/* Top Banner matching IMG_20261119_144826 */}
        <div
          className="relative h-48 w-full"
          style={
            avatar.coverUrl
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(7,11,20,0.28), rgba(13,21,38,0.9)), url(${avatar.coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {
                  background:
                    'radial-gradient(circle at 50% 35%, rgba(6,182,212,0.24), transparent 55%), linear-gradient(180deg, #060D1A 0%, #0F233C 72%, #0D1526 100%)',
                }
          }
        >
          <div className="flex items-center justify-between px-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <MoreVertical className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="pointer-events-none flex justify-center pt-2 font-display text-5xl font-black tracking-tight text-white/10">
            {avatar.name.slice(0, 2).toUpperCase()}
          </div>

          {/* Rose Frosted Ring / Couple Pill -> Shown ONLY when active CP partner is linked */}
          {activeCp && (
            <button
              type="button"
              onClick={() => setShowRingCollection(true)}
              className="absolute right-3 bottom-3 flex items-center gap-2 rounded-2xl border border-rose-200/35 bg-gradient-to-r from-[#E6859C]/90 via-[#EE9BAE]/88 to-[#F3B0BF]/85 px-2.5 py-1.5 shadow-xl backdrop-blur-md transition-transform hover:scale-105"
              title="View Ring Collection & Couple Home"
            >
              <RingSpriteArt
                ringNumber={activeCp.ringNumber}
                size={38}
                alt="CP Ring"
              />
              <div className="text-left leading-tight">
                <div className="flex items-center gap-1 text-[10px] font-bold text-white/95">
                  <Heart className="h-2.5 w-2.5 fill-white text-white" />
                  <span>CP Love</span>
                </div>
                <div className="font-mono-tabular text-xs font-extrabold text-white">
                  {(activeCp.cpCharm ?? profile.blessing ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded-full border border-white/80 bg-[#1B1226]">
                <AvatarArt avatar={cpPartnerAvatar} size={32} />
              </div>
            </button>
          )}
        </div>

        {/* Avatar + Name + Metadata */}
        <div className="px-5 pt-2 pb-24">
          <div className="flex items-end justify-between gap-3">
            <div className="relative -mt-12 inline-block overflow-visible">
              <div
                className={
                  hasEquippedFrame
                    ? 'relative overflow-visible'
                    : 'rounded-full border-2 border-cyan-300/35 bg-[#0D1526] p-0.5'
                }
              >
                <AvatarArt
                  avatar={avatar}
                  size={84}
                  frameId={resolvedFrameId ?? undefined}
                  seatFrameNumber={avatar.seatFrameNumber}
                />
              </div>
              {isUserOnline && (
                <span className="absolute right-2 bottom-2 z-30 h-3.5 w-3.5 rounded-full border-2 border-[#0D1526] bg-emerald-400" />
              )}
            </div>

            {!isSelf && onSupportUser && (
              <button
                type="button"
                onClick={() => {
                  const rNum = activeCp?.ringNumber ?? ringNumber;
                  const rName =
                    activeCp?.ringName ||
                    ringItems.find((r) => r.ringNumber === rNum)?.name ||
                    'Emerald Crown Ring';
                  onSupportUser(avatar.uid, avatar.name, rNum, rName);
                  setProposalSentNotice(`Sent Ring Support to ${avatar.name}!`);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-gradient-to-r from-pink-500/30 to-amber-500/30 px-3.5 py-1.5 text-xs font-extrabold text-amber-200 shadow-lg hover:from-pink-500/45 hover:to-amber-500/45"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Support Ring</span>
              </button>
            )}
          </div>

          {/* Gender (left of name) + Name + VIP Badge beside name */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="text-base leading-none"
              title={avatar.gender || 'Male'}
              aria-label={`Gender: ${avatar.gender || 'Male'}`}
            >
              {getGenderSymbol(avatar.gender)}
            </span>
            <h2
              className="font-display text-2xl font-black tracking-tight"
              style={getVipNameStyle(vipLevel)}
            >
              {avatar.name}
            </h2>
            <VipBadgeArt level={vipLevel} size={30} />
          </div>

          {/* Compact Metadata Row matching reference: ♂️ 25  🇮🇳 India • Online/Offline */}
          <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1 text-sky-300">
              <span>{getGenderSymbol(avatar.gender)}</span>
              <span className="font-mono-tabular text-slate-200">{avatar.age ?? 25}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-slate-200">
              <span>{getCountryFlag(avatar.country)}</span>
              <span>{avatar.country || 'India'}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span className={`h-2 w-2 rounded-full ${isUserOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className={isUserOnline ? 'text-emerald-400' : 'text-slate-400'}>
                {isUserOnline ? 'Online' : formatLastSeen(profile.lastSeenAt)}
              </span>
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <CharmBadgePill level={charmLevel} charm={charm} />
            <button
              type="button"
              onClick={() => {
                const targetId = avatar.publicId || avatar.uid;
                navigator.clipboard?.writeText(targetId).catch(() => {});
                setCopiedProfileId(true);
                window.setTimeout(() => setCopiedProfileId(false), 1800);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 font-mono-tabular text-xs text-slate-300 hover:border-cyan-400/40 hover:text-white"
            >
              <span>ID: {avatar.publicId || avatar.uid}</span>
              {copiedProfileId ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-300">Copied</span>
                </>
              ) : (
                <Copy className="h-3 w-3 text-cyan-300" />
              )}
            </button>
            {activeCp && (
              <button
                type="button"
                onClick={() => setShowCpPartnerId((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-pink-400/50 bg-pink-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-pink-200 hover:bg-pink-500/30"
                title="Click CP to view Partner ID & CP Level"
              >
                <Heart className="h-3 w-3 fill-pink-400 text-pink-400" />
                <span>
                  CP Lv.{cpLevelInfo.level} · {activeCp.partnerName}
                </span>
              </button>
            )}
          </div>

          {/* Revealed CP Partner ID & Open Profile Panel */}
          {activeCp && showCpPartnerId && (
            <div className="mt-2.5 space-y-2 rounded-2xl border border-rose-400/40 bg-gradient-to-r from-[#241328]/85 to-[#10213A]/85 px-3.5 py-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <RingSpriteArt ringNumber={activeCp.ringNumber} size={34} alt={activeCp.ringName} />
                  <div>
                    <div className="font-bold text-rose-200">
                      CP Lv.{cpLevelInfo.level} ({cpLevelInfo.title}) · {activeCp.partnerName}
                    </div>
                    <div className="font-mono-tabular text-[11px] font-bold text-white">
                      Partner ID: {activeCp.partnerUid}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openCpPartnerProfile}
                    className="inline-flex items-center gap-1 rounded-xl bg-cyan-500/25 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100 hover:bg-cyan-500/40"
                  >
                    <span>Open Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPartnerId(activeCp.partnerUid)}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-500/25 px-2.5 py-1.5 text-[11px] font-bold text-rose-100 hover:bg-rose-500/40"
                  >
                    {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                  </button>
                </div>
              </div>
              <div>
                <div className="flex justify-between font-mono-tabular text-[10px] text-rose-200">
                  <span>{cpCharm.toLocaleString()} CP Charms</span>
                  <span>
                    {cpLevelInfo.nextMin !== null
                      ? `Need ${cpLevelInfo.stepRemaining.toLocaleString()} for Lv.${cpLevelInfo.level + 1}`
                      : 'Max CP Level'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300"
                    style={{ width: `${cpLevelInfo.percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <p className="mt-2.5 text-xs text-slate-300">
            {avatar.bio || 'Voice Sanctuary Explorer · Badge Collector'}
          </p>

          {proposalSentNotice && (
            <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              {proposalSentNotice}
            </div>
          )}

          {/* Strict Ring-Ownership CP Proposal Drawer */}
          {!isSelf && showRingPicker && (
            <div className="mt-3 space-y-2.5 rounded-2xl border border-cyan-400/35 bg-[#132038] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-200">
                  Send CP Ring Proposal to {avatar.name}
                </span>
                <button
                  type="button"
                  onClick={() => setShowRingPicker(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {ownedRingItems.length === 0 ? (
                <div className="space-y-2.5 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-center">
                  <p className="text-xs font-semibold text-amber-200">
                    You must own a Ring before sending a CP proposal.
                  </p>
                  {onOpenRingShop && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRingShop();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Buy Ring in Shop</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-slate-300">
                    Choose one of your owned Rings to propose CP to {avatar.name}.
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ownedRingItems.map((ring) => {
                      const rNum = ring.ringNumber ?? 1;
                      const active = pickedRingItem?.id === ring.id;
                      return (
                        <button
                          key={ring.id}
                          type="button"
                          onClick={() => setSelectedRingId(ring.id)}
                          title={ring.name}
                          className={`flex flex-col items-center rounded-xl border p-1.5 transition-all ${
                            active
                              ? 'border-rose-400 bg-rose-500/25 ring-1 ring-rose-400'
                              : 'border-white/10 bg-[#0A101D] hover:border-cyan-400/40'
                          }`}
                        >
                          <RingSpriteArt
                            ringNumber={rNum}
                            imageUrl={ring.imageUrl}
                            size={32}
                            alt={ring.name}
                          />
                          <span className="mt-0.5 truncate w-full text-center font-mono-tabular text-[9px] text-slate-300">
                            {ring.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={!pickedRingItem}
                    onClick={() => {
                      if (!pickedRingItem) return;
                      const rNum = pickedRingItem.ringNumber ?? 1;
                      onProposeCp?.(
                        avatar.publicId || avatar.uid,
                        avatar.name,
                        avatar.id,
                        rNum,
                        pickedRingItem.name
                      );
                      setProposalSentNotice(
                        `CP proposal with ${pickedRingItem.name} sent to ${avatar.name}! Waiting for acceptance.`
                      );
                      setShowRingPicker(false);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-2 text-xs font-extrabold text-white shadow-md hover:opacity-95 disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Send {pickedRingItem?.name || 'Owned Ring'} Proposal</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* LIVE NOW Voice Room Card */}
          {roomTitle && roomId && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/25 px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                    <span>LIVE NOW</span>
                    {roomLocked && <Lock className="h-3 w-3 text-slate-300" />}
                  </div>
                  <div className="truncate text-xs font-bold text-white">{roomTitle}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onJoinRoom?.(roomId);
                  onClose();
                }}
                className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                JOIN
              </button>
            </div>
          )}

          {/* 4-Column Stat Strip */}
          <div className="mt-4 grid grid-cols-4 divide-x divide-white/10 rounded-2xl bg-[#132038] py-3.5 text-center">
            <div>
              <div className="font-mono-tabular text-base font-extrabold text-white">
                {profile.friendsCount ?? 0}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">FRIENDS</div>
            </div>
            <div>
              <div className="font-mono-tabular text-base font-extrabold text-white">
                {formattedCharm}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">CHARM</div>
            </div>
            <div>
              <div className="font-mono-tabular text-base font-extrabold text-white">
                {(profile.giftsReceived ?? 0).toLocaleString()}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">GIFTS</div>
            </div>
            <div>
              <div className="font-mono-tabular text-base font-extrabold text-white">
                {profile.giftsGiven ? `${profile.giftsGiven.toLocaleString()}` : '0'}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">GIVEN</div>
            </div>
          </div>

          {/* Relationship Tags Grid (including clickable CP partner profile card & Lv.1-10 Tags) */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">RELATIONSHIP TAGS</span>
              <span className="text-slate-400">
                {activeRelTags.length + sampleTags.length + (activeCp ? 1 : 0)} Active
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {activeCp && (
                <button
                  type="button"
                  onClick={openCpPartnerProfile}
                  className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-rose-500 to-amber-600 p-3 text-center text-white shadow-lg ring-1 ring-rose-300/40 transition-transform hover:scale-[1.02]"
                  title={`Open ${activeCp.partnerName}'s Profile (${activeCp.partnerUid})`}
                >
                  <span className="text-[10px] font-bold">CP Partner · {activeCp.since}</span>
                  <div className="my-1.5 flex items-center justify-center">
                    <RingSpriteArt
                      ringNumber={activeCp.ringNumber}
                      size={38}
                      alt={activeCp.ringName}
                    />
                  </div>
                  <span className="truncate text-[11px] font-bold">{activeCp.partnerName}</span>
                  <span className="mt-0.5 font-mono-tabular text-[9px] text-rose-100">
                    {activeCp.partnerUid}
                  </span>
                </button>
              )}
              {activeRelTags.map((rel) => {
                const def = getRelationshipTagDef(rel.tagType);
                const lvlInfo =
                  typeof rel.charmScore === 'number'
                    ? getRelationshipTagLevelInfo(rel.charmScore)
                    : { level: rel.level };
                const partnerName = rel.partnerName || `ID ${rel.partnerUid}`;
                return (
                  <div
                    key={rel.id || `${rel.tagType}-${rel.partnerUid}`}
                    className={`flex flex-col items-center rounded-2xl bg-gradient-to-b ${def.gradient} p-3 text-center text-white shadow-lg`}
                  >
                    <span className="text-[10px] font-bold">
                      {def.emoji} {def.label} · Lv.{lvlInfo.level}
                    </span>
                    <div className="my-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg shadow-inner">
                      {def.emoji}
                    </div>
                    <span className="w-full truncate text-[11px] font-bold">{partnerName}</span>
                    <span className="mt-0.5 font-mono-tabular text-[9px] text-white/85">
                      {typeof rel.charmScore === 'number'
                        ? `${rel.charmScore.toLocaleString()} Charm`
                        : `Partner ${rel.partnerUid}`}
                    </span>
                  </div>
                );
              })}
              {sampleTags.map((tag) => (
                <div
                  key={`${tag.title}-${tag.partnerName}`}
                  className={`flex flex-col items-center rounded-2xl bg-gradient-to-b ${tag.color} p-3 text-center text-white shadow-lg`}
                >
                  <span className="text-[10px] font-bold">
                    {tag.title} · Lv.{tag.level}
                  </span>
                  <div className="my-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                    {tag.partnerName.slice(0, 1)}
                  </div>
                  <span className="truncate text-[11px] font-semibold">{tag.partnerName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar: Friend Lifecycle, Propose CP, Friend-Only Message, Block */}
        {!isSelf && (
          <div className="sticky right-0 bottom-0 left-0 space-y-2 border-t border-white/10 bg-[#0A101D]/95 px-4 py-3.5 backdrop-blur-md">
            <div
              className={`grid gap-2 ${
                onProposeCp ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              {friendStatus === 'friends' ? (
                <button
                  type="button"
                  onClick={() => {
                    onUnfriendUser?.(avatar.uid);
                    onClose();
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-2 text-xs font-bold text-emerald-200 hover:bg-rose-500/20 hover:text-rose-200"
                  title="Remove friend"
                >
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span>Unfriend</span>
                </button>
              ) : friendStatus === 'pending_outgoing' ? (
                <button
                  type="button"
                  onClick={() => {
                    onCancelFriendRequest?.(avatar.uid);
                    onClose();
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Cancel Req</span>
                </button>
              ) : friendStatus === 'pending_incoming' ? (
                <button
                  type="button"
                  onClick={() => {
                    onAcceptFriendRequest?.(avatar.uid);
                    onClose();
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 px-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Accept</span>
                </button>
              ) : friendStatus === 'blocked_by_me' ? (
                <button
                  type="button"
                  onClick={() => {
                    onUnblockUser?.(avatar.uid);
                    onClose();
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
                >
                  <Ban className="h-4 w-4 shrink-0" />
                  <span>Unblock</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={friendStatus === 'blocked_by_them'}
                  onClick={() => {
                    onAddFriend?.(avatar.uid);
                    onClose();
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-[#132038] px-2 text-xs font-bold text-white hover:bg-[#192946] disabled:opacity-45"
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  <span>Add friend</span>
                </button>
              )}

              {onProposeCp && (
                <button
                  type="button"
                  disabled={friendStatus === 'blocked_by_me' || friendStatus === 'blocked_by_them'}
                  onClick={() => setShowRingPicker((v) => !v)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-rose-400/45 bg-rose-500/20 px-2 text-xs font-bold text-rose-200 hover:bg-rose-500/30 disabled:opacity-45"
                >
                  <Heart className="h-4 w-4 shrink-0 fill-rose-400 text-rose-400" />
                  <span>Propose CP</span>
                </button>
              )}

              <button
                type="button"
                disabled={!canDirectMessage}
                onClick={() => {
                  if (!canDirectMessage) return;
                  onMessageUser?.(avatar.uid, avatar.name);
                  onClose();
                }}
                title={canDirectMessage ? 'Open private chat' : 'Add & accept as friends to message'}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 px-2 text-xs font-extrabold text-slate-950 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>{canDirectMessage ? 'Message' : 'Friends Only'}</span>
              </button>
            </div>

            {friendStatus === 'pending_incoming' && onDeclineFriendRequest && (
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Incoming friend request from {avatar.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    onDeclineFriendRequest(avatar.uid);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 font-bold text-rose-300 hover:underline"
                >
                  <UserMinus className="h-3 w-3" />
                  <span>Decline</span>
                </button>
              </div>
            )}

            {friendStatus !== 'blocked_by_me' && friendStatus !== 'blocked_by_them' && onBlockUser && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onBlockUser(avatar.uid);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-300"
                >
                  <Ban className="h-3 w-3" />
                  <span>Block User</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <CoupleHomeModal
        isOpen={showRingCollection}
        ownerAvatar={avatar}
        ownerVipLevel={vipLevel}
        ownerCharm={charm}
        cpPartner={activeCp}
        ringNumbers={userRingNumbers}
        blessingCount={profile.blessing ?? avatar.blessing ?? 0}
        isSelf={!!isSelf}
        onClose={() => setShowRingCollection(false)}
        onOpenRingShop={onOpenRingShop}
        onInspectPartner={onInspectUser}
      />
    </div>
  );
};
