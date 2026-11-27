import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  Clock,
  Crown,
  Flame,
  Gem,
  Gift,
  Globe,
  Heart,
  HelpCircle,
  Home,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import rankingCrestImg from '../assets/images/ranking_crest_1795594821854.jpg';
import { VIP_TIERS, getVipNameStyle } from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import { RoomLevelBadgeArt, VipBadgeArt } from '../graphics/SpriteArtwork';
import type { AvatarConfig, PublicUserProfile, RankingLeaderboardRow, VoiceRoom } from '../types';

type RankingCategory = 'Popularity' | 'VIP' | 'Room' | 'BFF' | 'Gifts';
type RankingPeriod = 'Today' | 'Yesterday' | 'Celebrity' | 'Annual' | 'Global';

interface LeaderboardRow {
  rank: number;
  uid: string;
  name: string;
  vipLevel: number;
  score: number;
  avatar: AvatarConfig;
  roomId?: string;
  roomTitle?: string;
  roomLevel?: number;
  tagText?: string;
}

interface RankingSectionProps {
  userProfile: AvatarConfig;
  userVipLevel: number;
  userCharm: number;
  userVipGrowth: number;
  userGiftsGivenCoins?: number;
  rooms: VoiceRoom[];
  authToken?: string | null;
  onClose?: () => void;
  onInspectUser: (profile: PublicUserProfile) => void;
  onInspectUserById?: (uid: string) => void;
  onJoinRoom: (roomId: string) => void;
  onGetGifts: () => void;
}

const CATEGORIES: Array<{ id: RankingCategory; label: string; icon: React.ReactNode }> = [
  { id: 'Popularity', label: 'Popularity', icon: <Flame className="h-3.5 w-3.5 text-amber-300" /> },
  { id: 'VIP', label: 'VIP', icon: <Gem className="h-3.5 w-3.5 text-sky-300" /> },
  { id: 'Room', label: 'Room', icon: <Home className="h-3.5 w-3.5 text-indigo-300" /> },
  { id: 'BFF', label: 'BFF', icon: <Users className="h-3.5 w-3.5 text-cyan-300" /> },
  { id: 'Gifts', label: 'Gifts', icon: <Gift className="h-3.5 w-3.5 text-rose-300" /> },
];

const PERIODS: Array<{ id: RankingPeriod; icon: React.ReactNode }> = [
  { id: 'Today', icon: <Calendar className="h-3 w-3" /> },
  { id: 'Yesterday', icon: <Clock className="h-3 w-3" /> },
  { id: 'Celebrity', icon: <Crown className="h-3 w-3 text-pink-300" /> },
  { id: 'Annual', icon: <Trophy className="h-3 w-3 text-amber-300" /> },
  { id: 'Global', icon: <Globe className="h-3 w-3 text-cyan-300" /> },
];

const CosmicPodiumCrown: React.FC<{
  rank: 1 | 2 | 3;
  avatar: AvatarConfig;
  size: number;
}> = ({ rank, avatar, size }) => {
  const palette =
    rank === 1
      ? {
          ring: 'linear-gradient(135deg, #FEF08A 0%, #F59E0B 50%, #D97706 100%)',
          glow: '0 0 34px rgba(251, 191, 36, 0.8)',
          medalBg: 'linear-gradient(145deg, #FEF08A, #D97706)',
          medalBorder: '#FFFBEB',
          medalText: '#451A03',
          wingColor: '#FDE047',
          crownFill: '#FACC15',
        }
      : rank === 2
        ? {
            ring: 'linear-gradient(135deg, #E0F2FE 0%, #60A5FA 50%, #2563EB 100%)',
            glow: '0 0 28px rgba(96, 165, 250, 0.72)',
            medalBg: 'linear-gradient(145deg, #E0F2FE, #2563EB)',
            medalBorder: '#BAE6FD',
            medalText: '#FFFFFF',
            wingColor: '#93C5FD',
            crownFill: '#E0F2FE',
          }
        : {
            ring: 'linear-gradient(135deg, #FED7AA 0%, #FB7185 50%, #BE123C 100%)',
            glow: '0 0 28px rgba(244, 63, 94, 0.7)',
            medalBg: 'linear-gradient(145deg, #FDBA74, #E11D48)',
            medalBorder: '#FFE4E6',
            medalText: '#FFFFFF',
            wingColor: '#FDA4AF',
            crownFill: '#FDBA74',
          };

  return (
    <div className="relative flex flex-col items-center justify-center pt-3 pb-2">
      <svg
        width={size * 0.68}
        height={size * 0.36}
        viewBox="0 0 64 34"
        className="-mb-2.5 z-20 drop-shadow-[0_0_10px_rgba(255,255,255,0.55)]"
        aria-hidden="true"
      >
        <path
          d="M8 28L4 10L20 19L32 4L44 19L60 10L56 28Z"
          fill={palette.crownFill}
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="4" r="3" fill="#FFFFFF" />
        <circle cx="4" cy="10" r="2.2" fill="#FFFFFF" />
        <circle cx="60" cy="10" r="2.2" fill="#FFFFFF" />
      </svg>

      <div className="relative flex items-center justify-center">
        <svg
          width={size + 40}
          height={size + 22}
          viewBox="0 0 120 104"
          className="pointer-events-none absolute z-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.28)]"
          aria-hidden="true"
        >
          <path
            d="M28 84 C10 72, 6 44, 20 22 C16 44, 20 66, 36 80 Z"
            fill={palette.wingColor}
            opacity="0.95"
          />
          <path
            d="M21 68 C7 54, 7 34, 18 16 C16 36, 18 54, 30 68 Z"
            fill="#FFFFFF"
            opacity="0.45"
          />
          <path
            d="M92 84 C110 72, 114 44, 100 22 C104 44, 100 66, 84 80 Z"
            fill={palette.wingColor}
            opacity="0.95"
          />
          <path
            d="M99 68 C113 54, 113 34, 102 16 C104 36, 102 54, 90 68 Z"
            fill="#FFFFFF"
            opacity="0.45"
          />
        </svg>

        {avatar.seatFrameNumber || avatar.equippedFrameId ? (
          <div className="relative z-10 overflow-visible">
            <AvatarArt avatar={avatar} size={size} />
          </div>
        ) : (
          <div
            className="relative z-10 rounded-full p-[3px]"
            style={{ background: palette.ring, boxShadow: palette.glow }}
          >
            <div className="overflow-hidden rounded-full bg-[#120624]">
              <AvatarArt avatar={avatar} size={size} />
            </div>
          </div>
        )}

        <div
          className="absolute -bottom-2.5 z-20 flex h-6 w-6 items-center justify-center font-mono-tabular text-xs font-black shadow-lg"
          style={{
            clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
            background: palette.medalBg,
            color: palette.medalText,
            boxShadow: `0 0 14px ${palette.medalBorder}`,
          }}
        >
          {rank}
        </div>
      </div>
    </div>
  );
};

export const RankingSection: React.FC<RankingSectionProps> = ({
  userProfile,
  userVipLevel,
  userCharm,
  userVipGrowth,
  userGiftsGivenCoins = 0,
  rooms,
  authToken = null,
  onClose,
  onInspectUser,
  onInspectUserById,
  onJoinRoom,
  onGetGifts,
}) => {
  const [activeCategory, setActiveCategory] = useState<RankingCategory>('Popularity');
  const [activePeriod, setActivePeriod] = useState<RankingPeriod>('Today');
  const [showRules, setShowRules] = useState(false);
  const [serverLeaderboard, setServerLeaderboard] = useState<RankingLeaderboardRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const apiPeriod =
      activePeriod === 'Yesterday'
        ? 'weekly'
        : activePeriod === 'Celebrity'
          ? 'monthly'
          : 'overall';
    fetch(`/api/rankings?period=${apiPeriod}`, {
      credentials: 'include',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; leaderboard?: RankingLeaderboardRow[] } | null) => {
        if (!cancelled && data?.ok && Array.isArray(data.leaderboard)) {
          setServerLeaderboard(data.leaderboard);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activePeriod, authToken]);

  const periodFactor = useMemo(() => {
    switch (activePeriod) {
      case 'Today':
        return 1;
      case 'Yesterday':
        return 0.84;
      case 'Celebrity':
        return 1.35;
      case 'Annual':
        return 4.2;
      case 'Global':
        return 6.5;
    }
  }, [activePeriod]);

  const metricLabel = useMemo(() => {
    switch (activeCategory) {
      case 'Popularity':
        return 'Charm';
      case 'VIP':
        return 'Growth';
      case 'Room':
        return 'Room EXP';
      case 'BFF':
        return 'Bond';
      case 'Gifts':
        return 'Given';
    }
  }, [activeCategory]);

  const rows: LeaderboardRow[] = useMemo(() => {
    if (activeCategory === 'Room') {
      return rooms
        .map((room) => {
          const totalSpend = Object.values(room.coinsSpentByUid ?? {}).reduce(
            (sum, v) => sum + v,
            0
          );
          const rawScore = room.xp + totalSpend;
          const hostAv: AvatarConfig =
            room.seats.find((s) => s.occupant?.uid === room.ownerUid)?.occupant ?? {
              id: room.ownerUid,
              uid: room.ownerUid,
              name: room.hostName || 'Host',
              handle: `@${(room.hostName || 'host').toLowerCase().replace(/\s+/g, '')}`,
              skinTone: '#D69E76',
              hairColor: '#1E293B',
              robeColor: '#7C3AED',
              accentColor: '#DDD6FE',
              ornament: 'crown',
            };
          return {
            uid: room.ownerUid,
            name: room.title,
            vipLevel: Math.min(18, Math.max(0, room.level)),
            score: Math.round(rawScore * periodFactor),
            avatar: hostAv,
            roomId: room.id,
            roomTitle: room.title,
            roomLevel: room.level,
          };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map((r, idx) => ({ ...r, rank: idx + 1 }));
    }

    const userMap = new Map<
      string,
      {
        uid: string;
        name: string;
        vipLevel: number;
        charm: number;
        growth: number;
        coinsGiven: number;
        avatar: AvatarConfig;
        roomId?: string;
        roomTitle?: string;
      }
    >();

    const upsertUser = (
      uid: string,
      avatar: AvatarConfig,
      vipLvl: number,
      charmVal: number,
      growthVal: number,
      coinsGivenVal: number,
      roomId?: string,
      roomTitle?: string
    ) => {
      const prev = userMap.get(uid);
      if (!prev) {
        userMap.set(uid, {
          uid,
          name: avatar.name,
          vipLevel: vipLvl,
          charm: charmVal,
          growth: growthVal,
          coinsGiven: coinsGivenVal,
          avatar,
          roomId,
          roomTitle,
        });
      } else {
        prev.vipLevel = Math.max(prev.vipLevel, vipLvl);
        prev.charm = Math.max(prev.charm, charmVal);
        prev.growth = Math.max(prev.growth, growthVal);
        prev.coinsGiven += coinsGivenVal;
        if (!prev.roomId && roomId) {
          prev.roomId = roomId;
          prev.roomTitle = roomTitle;
        }
      }
    };

    upsertUser(
      userProfile.uid,
      userProfile,
      userVipLevel,
      userCharm,
      userVipGrowth,
      userGiftsGivenCoins
    );

    const tierGrowthEstimate = (vipLvl: number) =>
      vipLvl > 0
        ? VIP_TIERS[Math.min(VIP_TIERS.length - 1, Math.max(0, vipLvl - 1))]?.minGrowth ??
          vipLvl * 500
        : 0;

    for (const room of rooms) {
      const spentMap = room.coinsSpentByUid ?? {};

      for (const seat of room.seats) {
        if (!seat.occupant) continue;
        const occ = seat.occupant;
        const isSelf = occ.uid === userProfile.uid;
        const vipLvl = isSelf ? userVipLevel : (seat.vipLevel ?? 0);
        const charmVal = isSelf ? userCharm : (seat.charmValue ?? seat.giftScore ?? 0);
        const coinsSpent = isSelf ? 0 : (spentMap[occ.uid] ?? 0);
        upsertUser(
          occ.uid,
          occ,
          vipLvl,
          charmVal,
          isSelf ? userVipGrowth : tierGrowthEstimate(vipLvl),
          coinsSpent,
          room.id,
          room.title
        );
      }

      for (const lis of room.listeners) {
        const av: AvatarConfig = {
          id: lis.avatarId,
          uid: lis.uid,
          name: lis.name,
          handle: `@${lis.name.toLowerCase().replace(/\s+/g, '')}`,
          skinTone: '#D69E76',
          hairColor: '#1E293B',
          robeColor: '#7C3AED',
          accentColor: '#DDD6FE',
          ornament: 'lotus',
        };
        const isSelf = lis.uid === userProfile.uid;
        const coinsSpent = isSelf ? 0 : (spentMap[lis.uid] ?? 0);
        upsertUser(
          lis.uid,
          av,
          isSelf ? userVipLevel : lis.vipLevel,
          isSelf ? userCharm : lis.charm,
          isSelf ? userVipGrowth : tierGrowthEstimate(lis.vipLevel),
          coinsSpent,
          room.id,
          room.title
        );
      }
    }

    if (activeCategory === 'BFF') {
      const bondMap = new Map<
        string,
        {
          uid: string;
          name: string;
          vipLevel: number;
          score: number;
          avatar: AvatarConfig;
          roomId?: string;
          roomTitle?: string;
        }
      >();

      userMap.forEach((u) => {
        const cp = u.avatar.cpPartner;
        const cpScore = cp?.cpCharm ?? 0;
        if (!cp || cpScore <= 0) return;
        const pairKey = [u.uid, cp.partnerUid].sort().join(':');
        const existing = bondMap.get(pairKey);
        const scaled = Math.round(cpScore * periodFactor);
        if (!existing || scaled > existing.score) {
          bondMap.set(pairKey, {
            uid: u.uid,
            name: `${u.name} ♥ ${cp.partnerName}`,
            vipLevel: u.vipLevel,
            score: scaled,
            avatar: u.avatar,
            roomId: u.roomId,
            roomTitle: u.roomTitle,
          });
        }
      });

      return Array.from(bondMap.values())
        .filter((b) => b.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map((b, idx) => ({ ...b, rank: idx + 1 }));
    }

    for (const srvRow of serverLeaderboard) {
      const av: AvatarConfig = {
        id: `srv-${srvRow.uid}`,
        uid: srvRow.uid,
        publicId: srvRow.publicId,
        name: srvRow.name,
        handle: `@${srvRow.name.toLowerCase().replace(/\s+/g, '')}`,
        photoUrl: srvRow.photoUrl || undefined,
        equippedFrameId: srvRow.equippedFrameId ?? null,
        skinTone: '#D69E76',
        hairColor: '#1E293B',
        robeColor: '#7C3AED',
        accentColor: '#DDD6FE',
        ornament: 'crown',
      };
      upsertUser(
        srvRow.uid,
        av,
        Math.min(18, srvRow.vipLevel),
        srvRow.charmPoints,
        tierGrowthEstimate(srvRow.vipLevel),
        srvRow.giftsSentCoins
      );
    }

    return Array.from(userMap.values())
      .map((u) => {
        const raw =
          activeCategory === 'Popularity'
            ? u.charm
            : activeCategory === 'VIP'
              ? u.growth
              : u.coinsGiven;
        return {
          uid: u.uid,
          name: u.name,
          vipLevel: Math.min(18, u.vipLevel),
          score: Math.round(raw * periodFactor),
          avatar: u.avatar,
          roomId: u.roomId,
          roomTitle: u.roomTitle,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [
    activeCategory,
    periodFactor,
    rooms,
    serverLeaderboard,
    userProfile,
    userVipLevel,
    userCharm,
    userVipGrowth,
    userGiftsGivenCoins,
  ]);

  const top1 = rows[0];
  const top2 = rows[1];
  const top3 = rows[2];
  const restRows = rows.slice(3);

  const userMetricScore =
    activeCategory === 'VIP'
      ? userVipGrowth
      : activeCategory === 'Room'
        ? rooms.find((r) => r.ownerUid === userProfile.uid)?.xp ?? 0
        : activeCategory === 'Gifts'
          ? userGiftsGivenCoins
          : activeCategory === 'BFF'
            ? userProfile.cpPartner?.cpCharm ?? 0
            : userCharm;

  const userRankIdx = rows.findIndex(
    (r) =>
      r.uid === userProfile.uid ||
      (activeCategory === 'BFF' &&
        userProfile.cpPartner &&
        r.name.includes(userProfile.name) &&
        r.name.includes(userProfile.cpPartner.partnerName))
  );
  const userRankText = userRankIdx >= 0 ? `#${userRankIdx + 1}` : 'Unranked';

  const handleRowClick = (row: LeaderboardRow) => {
    if (activeCategory === 'Room' && row.roomId) {
      onJoinRoom(row.roomId);
      return;
    }
    if (onInspectUserById && row.uid) {
      onInspectUserById(row.uid);
      return;
    }
    onInspectUser({
      avatar: {
        ...row.avatar,
        uid: row.uid,
        publicId: row.avatar.publicId || row.uid,
        name: row.name,
      },
      vipLevel: row.vipLevel,
      charm: row.score,
      equippedFrameId: row.avatar.equippedFrameId ?? null,
      cpPartner: null,
      ringNumber: 0,
      roomId: row.roomId,
      roomTitle: row.roomTitle,
    });
  };

  return (
    <section
      aria-label="OG VELOCITY Ranking"
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-purple-400/45 shadow-[0_0_50px_rgba(168,85,247,0.35)]"
      style={{
        background:
          'radial-gradient(circle at 50% 22%, rgba(168, 85, 247, 0.34) 0%, rgba(46, 16, 101, 0.85) 36%, #0D0521 72%, #070314 100%)',
      }}
    >
      {/* Subtle Cosmic Spotlight Backdrop behind Top Crest & Podium */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 left-0 h-56 opacity-25 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, rgba(250,204,21,0.3), transparent 65%), url(${rankingCrestImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* Top Header: < + Winged Golden Crown "Ranking" + ? */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-400/50 bg-[#1B0D36]/85 text-white shadow-[0_0_16px_rgba(168,85,247,0.45)] hover:bg-purple-500/30"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>

        {/* Winged Golden Ranking Crest */}
        <div className="relative flex flex-col items-center">
          <Crown className="-mb-1 h-5 w-5 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]" />
          <div className="flex items-center gap-1.5">
            <svg width="26" height="14" viewBox="0 0 28 14" className="opacity-90" aria-hidden="true">
              <path d="M27 12 C16 11, 8 6, 1 1 C9 3, 18 5, 27 8 Z" fill="#C084FC" />
              <path d="M27 13 C18 13, 12 10, 6 7 C14 9, 20 10, 27 11 Z" fill="#FDE047" />
            </svg>
            <h2 className="font-display bg-gradient-to-b from-amber-100 via-amber-400 to-orange-500 bg-clip-text text-2xl font-black tracking-wide text-transparent drop-shadow-[0_2px_12px_rgba(245,158,11,0.6)]">
              Ranking
            </h2>
            <svg width="26" height="14" viewBox="0 0 28 14" className="opacity-90" aria-hidden="true">
              <path d="M1 12 C12 11, 20 6, 27 1 C19 3, 10 5, 1 8 Z" fill="#C084FC" />
              <path d="M1 13 C10 13, 16 10, 22 7 C14 9, 8 10, 1 11 Z" fill="#FDE047" />
            </svg>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-label="Ranking Rules"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-400/50 bg-[#1B0D36]/85 text-slate-100 shadow-[0_0_16px_rgba(168,85,247,0.45)] hover:bg-purple-500/30"
        >
          <HelpCircle className="h-4.5 w-4.5" />
        </button>
      </div>

      {showRules && (
        <div className="relative z-10 mx-3.5 mb-2 flex items-start justify-between gap-2 rounded-2xl border border-purple-400/45 bg-[#170B30]/95 p-3 text-[11px] text-slate-200 shadow-lg">
          <p>
            Send or receive gifts in Voice Rooms to climb Popularity (Charm), advance VIP 1–18 Growth, level up your Room, and earn BFF &amp; Top Gifter honors.
          </p>
          <button
            type="button"
            onClick={() => setShowRules(false)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Primary Neon Capsule Tabs: Popularity | VIP | Room | BFF | Gifts */}
      <div className="relative z-10 mx-3 mt-1.5 flex items-center justify-between gap-1 overflow-x-auto rounded-full border border-purple-300/30 bg-[#14082C]/90 p-1 shadow-[0_0_22px_rgba(168,85,247,0.3)]">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap transition-all ${
                active
                  ? 'bg-gradient-to-r from-[#9333EA] via-[#C026D3] to-[#EC4899] text-white shadow-[0_0_18px_rgba(217,70,239,0.75)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Period Filter Pill Bar: Today | Yesterday | Celebrity | Annual | Global */}
      <div className="relative z-10 mx-3 mt-2.5 mb-3 flex items-center justify-between gap-1 overflow-x-auto rounded-full border border-purple-300/25 bg-[#120726]/85 p-1">
        {PERIODS.map((period) => {
          const active = activePeriod === period.id;
          return (
            <React.Fragment key={period.id}>
              {period.id === 'Global' && (
                <span className="h-3.5 w-px shrink-0 bg-purple-300/25" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => setActivePeriod(period.id)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#7E22CE] to-[#A855F7] text-white shadow-[0_0_14px_rgba(168,85,247,0.7)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {period.icon}
                <span>{period.id}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* 3D Glowing Podium (#2 Left Blue, #1 Center Gold, #3 Right Crimson-Rose) */}
      {rows.length === 0 ? (
        <div className="relative z-10 mx-3 mb-4 rounded-2xl border border-purple-400/30 bg-[#170B30]/85 px-4 py-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-amber-300/85" />
          <div className="mt-2 text-sm font-bold text-white">No Contributors Yet</div>
          <p className="mt-1 text-xs text-slate-300">
            Enter a Voice Room, send gifts, or build your CP Bond to claim #1 in {activeCategory}!
          </p>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-3 items-end gap-2 px-3 pt-2 pb-4">
          {/* #2 Left Pedestal */}
          {top2 ? (
            <button
              type="button"
              onClick={() => handleRowClick(top2)}
              className="flex flex-col items-center text-center transition-transform hover:-translate-y-0.5"
            >
              <CosmicPodiumCrown rank={2} avatar={top2.avatar} size={52} />
              <div className="mt-1.5 flex max-w-full items-center justify-center gap-1">
                <span
                  className="truncate text-[11px] font-bold"
                  style={getVipNameStyle(top2.vipLevel)}
                >
                  {top2.name}
                </span>
                {activeCategory === 'Room' && top2.roomLevel ? (
                  <RoomLevelBadgeArt level={top2.roomLevel} size={14} />
                ) : (
                  <VipBadgeArt level={top2.vipLevel} size={15} />
                )}
              </div>
              <div
                className="mt-1.5 w-full rounded-t-2xl border border-sky-400/60 px-1.5 py-2.5 shadow-[0_0_26px_rgba(59,130,246,0.48)]"
                style={{
                  background: 'linear-gradient(180deg, rgba(37,99,235,0.72) 0%, rgba(17,12,48,0.95) 100%)',
                }}
              >
                <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/35 bg-black/60 px-2 py-0.5 font-mono-tabular text-[10px] font-extrabold text-white">
                  <Heart className="h-2.5 w-2.5 fill-pink-500 text-pink-500" />
                  <span>{top2.score.toLocaleString()}</span>
                </div>
              </div>
            </button>
          ) : (
            <div />
          )}

          {/* #1 Center Elevated Golden Pedestal */}
          {top1 && (
            <button
              type="button"
              onClick={() => handleRowClick(top1)}
              className="-mt-3 flex flex-col items-center text-center transition-transform hover:-translate-y-0.5"
            >
              <CosmicPodiumCrown rank={1} avatar={top1.avatar} size={64} />
              <div className="mt-1.5 flex max-w-full items-center justify-center gap-1">
                <span
                  className="truncate text-xs font-black"
                  style={getVipNameStyle(top1.vipLevel)}
                >
                  {top1.name}
                </span>
                {activeCategory === 'Room' && top1.roomLevel ? (
                  <RoomLevelBadgeArt level={top1.roomLevel} size={16} />
                ) : (
                  <VipBadgeArt level={top1.vipLevel} size={17} />
                )}
              </div>
              <div
                className="mt-1.5 w-full rounded-t-2xl border border-amber-400/75 px-1.5 py-4 shadow-[0_0_32px_rgba(245,158,11,0.58)]"
                style={{
                  background: 'linear-gradient(180deg, rgba(217,119,6,0.78) 0%, rgba(45,16,8,0.96) 100%)',
                }}
              >
                <div className="inline-flex items-center gap-1 rounded-full border border-amber-300/45 bg-black/65 px-2.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-white">
                  <Heart className="h-2.5 w-2.5 fill-pink-500 text-pink-500" />
                  <span>{top1.score.toLocaleString()}</span>
                </div>
              </div>
            </button>
          )}

          {/* #3 Right Pedestal */}
          {top3 ? (
            <button
              type="button"
              onClick={() => handleRowClick(top3)}
              className="flex flex-col items-center text-center transition-transform hover:-translate-y-0.5"
            >
              <CosmicPodiumCrown rank={3} avatar={top3.avatar} size={50} />
              <div className="mt-1.5 flex max-w-full items-center justify-center gap-1">
                <span
                  className="truncate text-[11px] font-bold"
                  style={getVipNameStyle(top3.vipLevel)}
                >
                  {top3.name}
                </span>
                {activeCategory === 'Room' && top3.roomLevel ? (
                  <RoomLevelBadgeArt level={top3.roomLevel} size={14} />
                ) : (
                  <VipBadgeArt level={top3.vipLevel} size={15} />
                )}
              </div>
              <div
                className="mt-1.5 w-full rounded-t-2xl border border-rose-400/60 px-1.5 py-2 shadow-[0_0_26px_rgba(236,72,153,0.48)]"
                style={{
                  background: 'linear-gradient(180deg, rgba(219,39,119,0.72) 0%, rgba(30,8,38,0.95) 100%)',
                }}
              >
                <div className="inline-flex items-center gap-1 rounded-full border border-rose-300/35 bg-black/60 px-2 py-0.5 font-mono-tabular text-[10px] font-extrabold text-white">
                  <Heart className="h-2.5 w-2.5 fill-pink-500 text-pink-500" />
                  <span>{top3.score.toLocaleString()}</span>
                </div>
              </div>
            </button>
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Ranks #4+ Neon Cosmic Rows */}
      <div className="relative z-10 space-y-1.5 px-3 pb-3">
        {restRows.map((row, idx) => {
          const ringAccent =
            idx % 3 === 0
              ? 'border-purple-400/55 shadow-[0_0_14px_rgba(168,85,247,0.3)]'
              : idx % 3 === 1
                ? 'border-sky-400/55 shadow-[0_0_14px_rgba(56,189,248,0.28)]'
                : 'border-amber-400/55 shadow-[0_0_14px_rgba(251,191,36,0.28)]';
          return (
            <button
              key={`${activeCategory}-${row.rank}-${row.uid}`}
              type="button"
              onClick={() => handleRowClick(row)}
              className={`flex w-full items-center justify-between gap-2.5 rounded-2xl border bg-gradient-to-r from-[#1A0D35]/95 via-[#120726]/95 to-[#221042]/95 px-3 py-2 text-left transition-transform hover:scale-[1.01] ${ringAccent}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center border border-amber-300/45 bg-[#241145] font-mono-tabular text-xs font-extrabold text-white"
                  style={{
                    clipPath: 'polygon(50% 2%, 95% 26%, 95% 74%, 50% 98%, 5% 74%, 5% 26%)',
                  }}
                >
                  {row.rank}
                </div>

                <div
                  className={
                    row.avatar.seatFrameNumber || row.avatar.equippedFrameId
                      ? 'shrink-0 overflow-visible'
                      : 'shrink-0 rounded-full border-2 border-purple-400/75 p-0.5 shadow-[0_0_12px_rgba(192,132,252,0.5)]'
                  }
                >
                  <AvatarArt avatar={row.avatar} size={34} />
                </div>

                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="truncate text-xs font-bold"
                    style={getVipNameStyle(row.vipLevel)}
                  >
                    {row.name}
                  </span>
                  {activeCategory === 'Room' && row.roomLevel ? (
                    <RoomLevelBadgeArt level={row.roomLevel} size={16} />
                  ) : (
                    <VipBadgeArt level={row.vipLevel} size={17} />
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 font-mono-tabular">
                <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
                <div className="text-right">
                  <div className="text-xs font-extrabold text-white">
                    {row.score.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-purple-200">{metricLabel}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Sticky Neon "YOU" Bar + "Get gifts" Button */}
      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-purple-400/45 bg-gradient-to-r from-[#1A0D35] via-[#2B1252] to-[#1A0D35] px-3.5 py-2.5 shadow-[0_-4px_24px_rgba(168,85,247,0.3)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="text-center leading-tight">
            <div className="text-[10px] font-extrabold text-purple-200">YOU</div>
            <div className="font-mono-tabular text-xs font-black text-white">{userRankText}</div>
          </div>

          <div
            className={
              userProfile.seatFrameNumber || userProfile.equippedFrameId
                ? 'shrink-0 overflow-visible'
                : 'rounded-full border-2 border-purple-400 p-0.5 shadow-[0_0_12px_rgba(192,132,252,0.65)]'
            }
          >
            <AvatarArt avatar={userProfile} size={34} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span
                className="truncate text-xs font-bold"
                style={getVipNameStyle(userVipLevel)}
              >
                {userProfile.name}
              </span>
              {userVipLevel > 0 ? (
                <VipBadgeArt level={userVipLevel} size={16} />
              ) : (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono-tabular text-[9px] font-bold text-slate-300">
                  VIP 0
                </span>
              )}
            </div>
            <div className="font-mono-tabular text-[11px] font-bold text-slate-100">
              {metricLabel} {userMetricScore.toLocaleString()}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onGetGifts}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-3.5 py-2 text-xs font-extrabold text-white shadow-[0_0_18px_rgba(236,72,153,0.55)] hover:opacity-95"
        >
          <Gift className="h-3.5 w-3.5" />
          <span>Get gifts</span>
        </button>
      </div>
    </section>
  );
};
