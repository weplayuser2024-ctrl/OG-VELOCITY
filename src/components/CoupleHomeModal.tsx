import React, { useState } from 'react';
import { ChevronLeft, Gift, Heart, ShoppingBag, Sparkles, UserCheck } from 'lucide-react';
import { SHOP_ITEMS, getCpLevelInfo } from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import { RingSpriteArt } from '../graphics/SpriteArtwork';
import type { AvatarConfig, CpPartnerInfo, PublicUserProfile, ShopItem } from '../types';

interface CoupleHomeModalProps {
  isOpen: boolean;
  ownerAvatar: AvatarConfig;
  ownerVipLevel: number;
  ownerCharm: number;
  cpPartner: CpPartnerInfo | null;
  ringNumbers: number[];
  blessingCount: number;
  isSelf: boolean;
  equippedRingId?: string;
  onClose: () => void;
  onEquipRing?: (item: ShopItem) => void;
  onOpenRingShop?: () => void;
  onInspectPartner?: (profile: PublicUserProfile) => void;
  onInspectPartnerById?: (uid: string) => void;
}

const RING_CATALOG = SHOP_ITEMS.filter((i) => i.category === 'ring');

export const CoupleHomeModal: React.FC<CoupleHomeModalProps> = ({
  isOpen,
  ownerAvatar,
  ownerVipLevel,
  ownerCharm,
  cpPartner,
  ringNumbers,
  blessingCount,
  isSelf,
  equippedRingId,
  onClose,
  onEquipRing,
  onOpenRingShop,
  onInspectPartner,
  onInspectPartnerById,
}) => {
  const [activeTab, setActiveTab] = useState<'ring-box' | 'recent-gifts'>('ring-box');
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const partnerAvatar: AvatarConfig = cpPartner
    ? {
        id: cpPartner.partnerAvatarId || cpPartner.partnerUid,
        uid: cpPartner.partnerUid,
        name: cpPartner.partnerName,
        handle: `@${cpPartner.partnerName.toLowerCase().replace(/\s+/g, '')}`,
        photoUrl: cpPartner.partnerPhotoUrl ?? undefined,
        skinTone: '#D69E76',
        hairColor: '#1E293B',
        robeColor: '#7C3AED',
        accentColor: '#DDD6FE',
        ornament: 'lotus',
      }
    : ownerAvatar;

  const primaryRingNum = cpPartner?.ringNumber ?? ringNumbers[0] ?? 1;
  const cpCharm = cpPartner?.cpCharm ?? 0;
  const cpLevel = getCpLevelInfo(cpCharm);
  const effectiveRings = ringNumbers.length > 0 ? ringNumbers : cpPartner ? [cpPartner.ringNumber] : [];

  const handleOpenPartnerFullProfile = () => {
    if (!cpPartner) return;
    if (onInspectPartnerById) {
      onClose();
      onInspectPartnerById(cpPartner.partnerUid);
      return;
    }
    if (!onInspectPartner) return;
    onClose();
    onInspectPartner({
      avatar: {
        ...partnerAvatar,
        uid: cpPartner.partnerUid,
        name: cpPartner.partnerName,
        cpPartner: {
          partnerUid: ownerAvatar.uid,
          partnerName: ownerAvatar.name,
          partnerAvatarId: ownerAvatar.id,
          ringNumber: cpPartner.ringNumber,
          ringName: cpPartner.ringName,
          since: cpPartner.since,
          cpCharm: cpPartner.cpCharm,
          cpLevel: cpPartner.cpLevel,
        },
      },
      vipLevel: 0,
      charm: cpPartner.cpCharm ?? 0,
      cpPartner: {
        partnerUid: ownerAvatar.uid,
        partnerName: ownerAvatar.name,
        partnerAvatarId: ownerAvatar.id,
        ringNumber: cpPartner.ringNumber,
        ringName: cpPartner.ringName,
        since: cpPartner.since,
        cpCharm: cpPartner.cpCharm,
      },
      ringNumber: cpPartner.ringNumber,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-[#0B0917] text-white">
      {/* Upper Moonlit Sanctuary Header (matching Couple Home screenshot) */}
      <div
        className="relative flex min-h-[290px] w-full flex-col justify-between overflow-hidden px-4 pt-4 pb-6"
        style={{
          background:
            'radial-gradient(circle at 50% 24%, rgba(167,139,250,0.4) 0%, rgba(44,30,78,0.88) 42%, #181028 100%)',
        }}
      >
        {/* Subtle Moonlit Window Silhouette & Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center opacity-50">
          <div className="relative h-44 w-44 rounded-t-3xl border border-indigo-200/20 bg-gradient-to-b from-indigo-900/50 via-purple-950/60 to-transparent shadow-inner">
            <div className="absolute top-4 left-1/2 h-11 w-11 -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-100 via-yellow-50 to-slate-300 shadow-[0_0_28px_rgba(254,243,199,0.75)]" />
            <div className="absolute inset-x-6 bottom-2 h-16 rounded-t-full bg-indigo-950/65" />
          </div>
        </div>

        {/* Top Bar + Couple Date Pill */}
        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back from Couple Home"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/55"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="font-display text-lg font-extrabold tracking-tight text-white">
                Couple Home
              </h1>
            </div>

            {cpPartner && onInspectPartner && (
              <button
                type="button"
                onClick={handleOpenPartnerFullProfile}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm hover:bg-black/55"
              >
                <UserCheck className="h-3.5 w-3.5 text-pink-300" />
                <span>Partner Profile</span>
              </button>
            )}
          </div>

          <div className="flex justify-center">
            <div className="rounded-full bg-black/45 px-3.5 py-1 text-[11px] font-medium text-slate-200 backdrop-blur-sm">
              {cpPartner ? (
                <>
                  <strong className="font-extrabold text-white">{ownerAvatar.name}</strong>
                  <span> and </span>
                  <strong className="font-extrabold text-white">{cpPartner.partnerName}</strong>
                  <span> became a couple on {cpPartner.since}</span>
                </>
              ) : (
                <>
                  <strong className="font-extrabold text-white">{ownerAvatar.name}</strong>
                  <span>&apos;s Ring Sanctuary · OG VELOCITY</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Overlay Row: Overlapping Twin Avatars with Ring in Center + Love / Blessing Stats */}
        <div className="relative z-10 flex items-end justify-between gap-3 pt-8">
          <div className="flex flex-col items-start gap-2">
            <div className="relative flex items-center overflow-visible">
              <div
                className={
                  ownerAvatar.seatFrameNumber || ownerAvatar.equippedFrameId
                    ? 'relative z-10 overflow-visible'
                    : 'relative z-10 rounded-full border-2 border-white/85 bg-[#120C22] shadow-lg'
                }
              >
                <AvatarArt avatar={ownerAvatar} size={58} />
              </div>
              {cpPartner && (
                <div
                  className={
                    partnerAvatar.seatFrameNumber || partnerAvatar.equippedFrameId
                      ? 'relative z-10 -ml-3 overflow-visible'
                      : 'relative z-10 -ml-3 rounded-full border-2 border-white/85 bg-[#120C22] shadow-lg'
                  }
                >
                  <AvatarArt avatar={partnerAvatar} size={58} />
                </div>
              )}
              {/* Ring overlapping center of twin avatars */}
              <div
                className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] ${
                  cpPartner ? 'left-1/2 -translate-x-1/2' : 'left-11'
                }`}
              >
                <RingSpriteArt ringNumber={primaryRingNum} size={46} alt="Couple Ring" />
              </div>
            </div>
            <span className="text-xs font-bold text-white drop-shadow">
              {cpPartner ? `CP Bond · ${cpPartner.since}` : `${effectiveRings.length} Ring(s) Collected`}
            </span>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2.5 rounded-full bg-black/50 py-1 pr-3.5 pl-1.5 backdrop-blur-md">
              <div className="flex h-8 w-8 flex-col items-center justify-center rounded-full bg-white text-rose-500 shadow">
                <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                <span className="-mt-3 text-[8px] font-black text-white">Lv{cpLevel.level}</span>
              </div>
              <div className="text-right leading-tight">
                <div className="text-[10px] text-slate-300">Love</div>
                <div className="font-mono-tabular text-xs font-extrabold text-white">
                  {cpCharm.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-full bg-black/50 py-1 pr-3.5 pl-1.5 backdrop-blur-md">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-rose-500 shadow">
                <Gift className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-right leading-tight">
                <div className="text-[10px] text-slate-300">Blessing</div>
                <div className="font-mono-tabular text-xs font-extrabold text-white">
                  {blessingCount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Royal Violet Sheet: Ring Box | Recent gifts */}
      <div
        className="-mt-3 flex-1 rounded-t-3xl px-5 pt-4 pb-10 shadow-[0_-12px_36px_rgba(0,0,0,0.65)]"
        style={{
          background:
            'linear-gradient(180deg, #32247B 0%, #24195C 42%, #181040 100%)',
        }}
      >
        {/* Underline Tabs */}
        <div className="grid grid-cols-2 border-b border-white/10 pb-2 text-center">
          <button
            type="button"
            onClick={() => setActiveTab('ring-box')}
            className={`relative pb-2 text-sm font-bold transition-colors ${
              activeTab === 'ring-box' ? 'text-white' : 'text-indigo-200/65 hover:text-white'
            }`}
          >
            <span>Ring Box</span>
            {activeTab === 'ring-box' && (
              <span className="absolute bottom-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recent-gifts')}
            className={`relative pb-2 text-sm font-bold transition-colors ${
              activeTab === 'recent-gifts' ? 'text-white' : 'text-indigo-200/65 hover:text-white'
            }`}
          >
            <span>Recent gifts</span>
            {activeTab === 'recent-gifts' && (
              <span className="absolute bottom-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-white" />
            )}
          </button>
        </div>

        {notice && (
          <div className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-100">
            {notice}
          </div>
        )}

        {activeTab === 'ring-box' ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono-tabular text-sm font-bold text-white">
                Rings: {effectiveRings.length}
              </span>
              {isSelf && onOpenRingShop && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRingShop();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-400/20 px-3 py-1 text-xs font-extrabold text-amber-200 hover:bg-amber-400/30"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Buy More Rings</span>
                </button>
              )}
            </div>

            {effectiveRings.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#231954]/80 p-6 text-center text-xs text-indigo-100">
                <p>No rings in this Ring Box yet. Purchase a ring in the Shop to showcase and equip it here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {effectiveRings.map((rNum) => {
                  const ringItem = RING_CATALOG.find((r) => r.ringNumber === rNum);
                  const isEquipped = ringItem && equippedRingId === ringItem.id;
                  return (
                    <button
                      key={rNum}
                      type="button"
                      onClick={() => {
                        if (isSelf && ringItem && onEquipRing) {
                          onEquipRing(ringItem);
                          setNotice(`Equipped ${ringItem.name}!`);
                        }
                      }}
                      title={ringItem?.name || `Ring #${rNum}`}
                      className={`group flex aspect-square flex-col items-center justify-center rounded-2xl border p-2.5 transition-transform hover:scale-[1.03] ${
                        isEquipped
                          ? 'border-amber-300 bg-[#3B2C7E]/90 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                          : 'border-amber-200/35 bg-[#31236B]/85 hover:border-amber-300/75'
                      }`}
                    >
                      <RingSpriteArt
                        ringNumber={rNum}
                        size={76}
                        alt={ringItem?.name ?? `Ring #${rNum}`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {cpPartner ? (
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#2A1D66]/80 px-4 py-3 text-xs">
                <div className="flex items-center gap-3">
                  <RingSpriteArt ringNumber={cpPartner.ringNumber} size={44} alt={cpPartner.ringName} />
                  <div>
                    <div className="font-bold text-white">{cpPartner.ringName}</div>
                    <div className="text-[11px] text-indigo-200">
                      Pledged with {cpPartner.partnerName} · {cpPartner.since}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/25 px-2.5 py-1 text-[10px] font-extrabold text-rose-200">
                  <Sparkles className="h-3 w-3" />
                  CP Ring
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#231954]/80 p-6 text-center text-xs text-indigo-100">
                Gift rings or send gifts in Voice Rooms to populate Recent Couple Gifts here!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
