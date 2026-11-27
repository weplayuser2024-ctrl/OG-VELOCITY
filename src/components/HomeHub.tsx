import React, { useState } from 'react';
import {
  Bell,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  SHOP_ITEMS,
  getCharmLevelInfo,
  getVipNameStyle,
} from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import {
  CharmBadgeArt,
  RingSpriteArt,
  RoomLevelBadgeArt,
  SeatFrameSpriteArt,
  VipBadgeArt,
  ZayroCoinArt,
} from '../graphics/SpriteArtwork';
import type {
  AvatarConfig,
  AccountRole,
  BackendNotificationRecord,
  DailyTaskItem,
  FriendRecord,
  PublicUserProfile,
  ShopCategory,
  ShopItem,
  VoiceRoom,
} from '../types';
import { GamesSection } from './GamesSection';
import { RankingSection } from './RankingSection';

interface HomeHubProps {
  userProfile: AvatarConfig;
  userRole?: AccountRole;
  notifications?: BackendNotificationRecord[];
  authToken?: string | null;
  coins: number;
  charm: number;
  vipLevel: number;
  vipGrowth: number;
  vipLabel: string | null;
  userGiftsGivenCoins?: number;
  ownedItemIds?: string[];
  ownedItemExpiries?: Record<string, number>;
  equippedItems: Partial<Record<ShopCategory, string>>;
  dailyTasks: DailyTaskItem[];
  claimedTaskChests?: number[];
  friends: FriendRecord[];
  rooms: VoiceRoom[];
  dailyLoginClaimed?: boolean;
  onOpenMe: () => void;
  onOpenTopUp: () => void;
  onOpenShop: () => void;
  onOpenAdmin?: () => void;
  onMarkNotificationsRead?: () => void;
  onBuyShopItem?: (item: ShopItem) => void;
  onEquipShopItem?: (item: ShopItem) => void;
  onJoinRoom: (roomId: string) => void;
  onSeeAllRooms: () => void;
  onClaimTask: (taskId: string) => void;
  onClaimTaskChest?: (step: number, rewardCoins: number) => void;
  onAddFriendByUid: (uid: string) => string;
  onInviteFriendToGame?: (friend: FriendRecord, gameTitle: string) => void;
  onEarnCoins: (amount: number, reason: string) => void;
  onInspectUser: (profile: PublicUserProfile) => void;
  onInspectUserById?: (uid: string) => void;
}

function formatItemDuration(expiresAt?: number, durationDays?: number): string {
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

export const HomeHub: React.FC<HomeHubProps> = ({
  userProfile,
  userRole = 'normal_user',
  notifications = [],
  authToken = null,
  coins,
  charm,
  vipLevel,
  vipGrowth,
  vipLabel,
  userGiftsGivenCoins = 0,
  ownedItemIds = [],
  ownedItemExpiries = {},
  equippedItems,
  dailyTasks,
  claimedTaskChests = [],
  friends,
  rooms,
  dailyLoginClaimed = false,
  onOpenMe,
  onOpenTopUp,
  onOpenShop,
  onOpenAdmin,
  onMarkNotificationsRead,
  onBuyShopItem,
  onEquipShopItem,
  onJoinRoom,
  onSeeAllRooms,
  onClaimTask,
  onClaimTaskChest,
  onAddFriendByUid,
  onInviteFriendToGame,
  onEarnCoins,
  onInspectUser,
  onInspectUserById,
}) => {
  const [activeQuickPanel, setActiveQuickPanel] = useState<
    'ranking' | 'tasks' | 'friends' | 'shop' | null
  >(null);
  const [fullShopCat, setFullShopCat] = useState<
    'all' | 'ring' | 'frame' | 'entry' | 'inventory'
  >('all');
  const [shopNotice, setShopNotice] = useState('');
  const [friendSearchUid, setFriendSearchUid] = useState('');
  const [friendNotice, setFriendNotice] = useState('');
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [unboxedTaskPreview, setUnboxedTaskPreview] = useState<DailyTaskItem | null>(null);

  const onlineFriendsCount = friends.filter(
    (f) => Boolean(f.online) || f.status === 'Online' || f.status === 'In Voice Room'
  ).length;

  const canOpenAdmin =
    userRole === 'support_staff' ||
    userRole === 'moderator' ||
    userRole === 'admin' ||
    userRole === 'super_admin';
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const { current: charmInfo } = getCharmLevelInfo(charm);

  const handleFriendSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendSearchUid.trim()) return;
    const msg = onAddFriendByUid(friendSearchUid.trim());
    setFriendNotice(msg);
    setFriendSearchUid('');
  };

  const formattedCoins =
    coins >= 1_000_000
      ? `${(coins / 1_000_000).toFixed(2)}M`
      : coins >= 1_000
        ? `${(coins / 1_000).toFixed(1)}K`
        : coins.toLocaleString();

  const fullShopItems = (
    fullShopCat === 'inventory'
      ? SHOP_ITEMS.filter((i) => ownedItemIds.includes(i.id))
      : fullShopCat === 'all'
        ? SHOP_ITEMS
        : SHOP_ITEMS.filter((i) => i.category === fullShopCat)
  )
    .slice()
    .sort((a, b) => (a.ringNumber ?? 999) - (b.ringNumber ?? 999));

  return (
    <div className="space-y-5">
      {/* Top Bar inside Home */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenMe}
          className="flex items-center gap-3 text-left transition-opacity hover:opacity-90"
        >
          <AvatarArt avatar={userProfile} size={44} frameId={equippedItems.frame} />
          <div>
            <div className="flex items-center gap-2">
              <span
                className="font-display text-lg font-bold"
                style={getVipNameStyle(vipLevel)}
              >
                Hi, {userProfile.name}
              </span>
              <VipBadgeArt level={vipLevel} size={26} />
              {charm > 0 && <CharmBadgeArt level={charmInfo.level} size={24} />}
            </div>
            <div className="flex items-center gap-2 font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
              <span style={vipLevel >= 12 ? getVipNameStyle(vipLevel) : undefined}>
                {vipLabel || `VIP ${vipLevel}`}
              </span>
              <span>·</span>
              <span className="text-rose-500 dark:text-rose-300">{charm.toLocaleString()} Charm</span>
              <span>·</span>
              <span>Growth {vipGrowth.toLocaleString()}</span>
            </div>
          </div>
        </button>

        <div className="relative flex items-center gap-2">
          {canOpenAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-500/15 px-3 py-1.5 text-[11px] font-black text-violet-700 hover:bg-violet-500/25 dark:bg-purple-500/20 dark:text-purple-200 dark:hover:bg-purple-500/30"
              title="Open /admin RBAC Control Portal"
            >
              <span>Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowNotifPopover((v) => !v);
              if (!showNotifPopover && unreadNotifsCount > 0) {
                onMarkNotificationsRead?.();
              }
            }}
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-white text-slate-700 shadow-sm hover:border-violet-400 dark:border-white/15 dark:bg-[#131730] dark:text-slate-200 dark:hover:border-violet-400/50"
          >
            <Bell className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/45 bg-white py-1.5 pr-1.5 pl-3 shadow-sm dark:bg-[#131730]">
            <ZayroCoinArt size={22} />
            <span className="font-mono-tabular text-sm font-extrabold text-amber-600 dark:text-amber-300">
              {formattedCoins}
            </span>
            <button
              type="button"
              onClick={onOpenTopUp}
              aria-label="Top Up Coins"
              title="Go to Coin Top-Up"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 transition-transform hover:scale-105 hover:bg-amber-300"
            >
              <Plus className="h-4 w-4 stroke-[2.75]" />
            </button>
          </div>

          {showNotifPopover && (
            <div className="absolute top-12 right-0 z-40 w-72 rounded-2xl border border-indigo-200 bg-white p-3 text-slate-900 shadow-2xl dark:border-violet-400/30 dark:bg-[#131730] dark:text-white">
              <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-bold dark:border-white/10">
                <span>Notifications</span>
                <button type="button" onClick={() => setShowNotifPopover(false)}>
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>
              {notifications.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
                  No new notifications yet.
                </p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto text-[11px]">
                  {notifications.slice(0, 12).map((n) => (
                    <div key={n.id} className="rounded-xl bg-slate-100 p-2.5 dark:bg-black/35">
                      <div className="font-bold text-violet-700 dark:text-violet-200">{n.title}</div>
                      <div className="mt-0.5 text-slate-600 dark:text-slate-300">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Announcement Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-200/80 bg-white/90 px-4 py-3 text-xs text-slate-700 shadow-sm dark:border-violet-400/20 dark:bg-[#151A36]/90 dark:text-slate-200">
        <Bell className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
        <p className="leading-relaxed">
          <span className="font-bold text-slate-900 dark:text-white">Welcome to OG VELOCITY</span>
          <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
          {dailyLoginClaimed
            ? 'Daily Login Bonus (+100,000 Coins) credited! Spend 100 Coins = +1 VIP Growth.'
            : 'Live Voice Rooms, Ludo, Carrom, UNO & Laser Tag! Spend 100 Coins = +1 VIP Growth.'}
        </p>
      </div>

      {/* Home Four Main Options — Exact Extracted Reference Artwork */}
      <section className="grid grid-cols-4 gap-2 sm:gap-3.5">
        <button
          type="button"
          onClick={() => setActiveQuickPanel('ranking')}
          aria-label="Ranking"
          className="group relative aspect-[550/724] w-full overflow-hidden rounded-2xl border border-purple-500/35 bg-[#0A021C] shadow-[0_8px_24px_rgba(124,58,237,0.28)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-amber-300/70 focus:outline-none"
        >
          <img
            src="/assets/cutouts/home_opt_ranking.png"
            alt="Ranking"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickPanel('tasks')}
          aria-label="Daily Tasks"
          className="group relative aspect-[550/724] w-full overflow-hidden rounded-2xl border border-sky-400/35 bg-[#06092A] shadow-[0_8px_24px_rgba(56,189,248,0.25)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-cyan-300/70 focus:outline-none"
        >
          <img
            src="/assets/cutouts/home_opt_tasks.png"
            alt="Tasks"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
          {dailyTasks.some((t) => t.progress >= t.target && !t.claimed) && (
            <span className="absolute top-1.5 left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/80 bg-rose-500 px-1 text-[9px] font-black text-white shadow">
              !
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickPanel('friends')}
          aria-label="Friends"
          className="group relative aspect-[550/724] w-full overflow-hidden rounded-2xl border border-fuchsia-400/35 bg-[#16032B] shadow-[0_8px_24px_rgba(232,121,249,0.26)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-pink-300/70 focus:outline-none"
        >
          <img
            src="/assets/cutouts/home_opt_friends.png"
            alt="Friends"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
          <span
            className="absolute top-1.5 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/70 bg-emerald-500 px-1.5 font-mono-tabular text-[9px] font-black text-slate-950 shadow"
            title={`${onlineFriendsCount} friends online now`}
          >
            {onlineFriendsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickPanel('shop')}
          aria-label="Shop"
          className="group relative aspect-[550/724] w-full overflow-hidden rounded-2xl border border-amber-400/35 bg-[#180710] shadow-[0_8px_24px_rgba(245,158,11,0.26)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-amber-300/80 focus:outline-none"
        >
          <img
            src="/assets/cutouts/home_opt_shop.png"
            alt="Shop"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        </button>
      </section>

      {/* FULL-SCREEN OVERLAY: RANKING */}
      {activeQuickPanel === 'ranking' && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#070B14] text-white">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-cyan-400/20 bg-[#0A101D]/95 px-4 py-3 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveQuickPanel(null)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-cyan-400/35 bg-[#0D1526] px-3.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-300" />
              <span className="font-display text-sm font-extrabold text-white">
                OG VELOCITY Ranking
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-[#0D1526] px-3 py-1 font-mono-tabular text-xs font-bold text-amber-300">
              <ZayroCoinArt size={14} />
              <span>{formattedCoins}</span>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-start p-4 sm:p-6">
            <RankingSection
              userProfile={userProfile}
              userVipLevel={vipLevel}
              userCharm={charm}
              userVipGrowth={vipGrowth}
              userGiftsGivenCoins={userGiftsGivenCoins}
              rooms={rooms}
              authToken={authToken}
              onClose={() => setActiveQuickPanel(null)}
              onInspectUser={onInspectUser}
              onInspectUserById={onInspectUserById}
              onJoinRoom={(roomId) => {
                setActiveQuickPanel(null);
                onJoinRoom(roomId);
              }}
              onGetGifts={() => {
                setActiveQuickPanel(null);
                if (rooms[0]) {
                  onJoinRoom(rooms[0].id);
                } else {
                  onOpenShop();
                }
              }}
            />
          </div>
        </div>
      )}

      {/* FULL-SCREEN OVERLAY: DAILY TASKS (Exact Reference Artwork Banner & OG Chests) */}
      {activeQuickPanel === 'tasks' && (() => {
        const doneCount = dailyTasks.filter((t) => t.claimed || t.progress >= t.target).length;
        const pct = Math.min(100, Math.round((doneCount / Math.max(1, dailyTasks.length)) * 100));
        return (
          <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-gradient-to-b from-[#160A30] via-[#0E0720] to-[#080412] text-white">
            <header className="sticky top-0 z-20 flex items-center justify-between border-b border-purple-500/20 bg-[#120926]/95 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4.5 w-4.5 text-emerald-400" />
                <span className="font-display text-lg font-extrabold text-white">Daily Tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-[#1B1035] px-3 py-1 font-mono-tabular text-xs font-bold text-amber-300">
                  <ZayroCoinArt size={14} />
                  <span>{formattedCoins}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveQuickPanel(null)}
                  aria-label="Close Daily Tasks"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </header>

            <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
              {/* Top Header Row matching Reference: Overlapping Daily Tasks Ribbon + Resets at 00:00 */}
              <div className="relative pt-4">
                <div className="relative z-10 flex items-center justify-between gap-2 px-1">
                  <img
                    src="/assets/cutouts/daily_tasks_ribbon.png"
                    alt="Daily Tasks"
                    className="-mb-4 h-16 w-auto max-w-[66%] object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.75)] sm:h-20"
                    draggable={false}
                  />
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#8B5CF6]/70 bg-[#170938] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]">
                    <Clock className="h-3.5 w-3.5 text-purple-300" />
                    <span>Resets at 00:00</span>
                  </div>
                </div>

                {/* Main Neon Purple Progress & Chest Card */}
                <div className="relative overflow-hidden rounded-3xl border border-[#8B5CF6]/70 bg-gradient-to-b from-[#1D0B40] via-[#13072C] to-[#0B041B] px-4 pt-5 pb-3.5 shadow-[0_14px_40px_rgba(139,92,246,0.35)] sm:px-6">
                  <div className="flex items-center justify-between text-sm font-bold text-white">
                    <span>
                      Today&apos;s tasks{' '}
                      <strong className="font-mono-tabular text-base font-black text-white">
                        {doneCount}/{dailyTasks.length}
                      </strong>
                    </span>
                  </div>

                  <div className="relative mt-3 grid grid-cols-3 gap-2 text-center sm:gap-4">
                    {/* Glowing Horizontal Progress Rail */}
                    <div className="pointer-events-none absolute top-[44%] right-6 left-6 h-2.5 -translate-y-1/2 overflow-hidden rounded-full border border-white/10 bg-[#23124A]/90 shadow-inner">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D946EF] via-[#A855F7] to-[#6366F1] shadow-[0_0_14px_rgba(217,70,239,0.85)] transition-all duration-500"
                        style={{ width: `${Math.max(doneCount > 0 ? 12 : 4, pct)}%` }}
                      />
                    </div>

                    {[
                      {
                        step: 2,
                        label: '500',
                        isGift: false,
                        rewardCoins: 500,
                        img: '/assets/cutouts/daily_chest_2.png',
                        unlocked: doneCount >= 2,
                        hexBorder: 'border-[#C026D3] bg-[#250747] shadow-[0_0_14px_rgba(192,38,211,0.5)]',
                      },
                      {
                        step: 5,
                        label: '10K',
                        isGift: false,
                        rewardCoins: 10000,
                        img: '/assets/cutouts/daily_chest_5.png',
                        unlocked: doneCount >= 5,
                        hexBorder: 'border-[#0EA5E9] bg-[#061C47] shadow-[0_0_14px_rgba(14,165,233,0.55)]',
                      },
                      {
                        step: 8,
                        label: 'Gift',
                        isGift: true,
                        rewardCoins: 25000,
                        img: '/assets/cutouts/daily_chest_8.png',
                        unlocked: doneCount >= 8,
                        hexBorder: 'border-[#F59E0B] bg-[#301905] shadow-[0_0_14px_rgba(245,158,11,0.6)]',
                      },
                    ].map((chest) => {
                      const isChestClaimed = claimedTaskChests.includes(chest.step);
                      const canClaimChest = chest.unlocked && !isChestClaimed;
                      return (
                        <button
                          key={chest.step}
                          type="button"
                          disabled={!canClaimChest}
                          onClick={() => onClaimTaskChest?.(chest.step, chest.rewardCoins)}
                          className="group relative z-10 flex flex-col items-center disabled:cursor-default"
                        >
                          <div
                            className={`relative flex h-14 w-full items-center justify-center transition-transform sm:h-16 ${
                              isChestClaimed
                                ? 'opacity-65 grayscale-[30%]'
                                : canClaimChest
                                  ? 'scale-105 animate-pulse hover:scale-110'
                                  : 'group-hover:scale-105'
                            }`}
                          >
                            <img
                              src={chest.img}
                              alt={`Chest ${chest.step}`}
                              className="h-full w-auto max-w-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
                              draggable={false}
                            />
                          </div>
                          <span
                            className={`-mt-1 inline-flex min-w-16 items-center justify-center rounded-lg border-2 px-4 py-0.5 font-mono-tabular text-sm font-black text-white ${chest.hexBorder}`}
                            style={{
                              clipPath:
                                'polygon(14% 0%, 86% 0%, 100% 50%, 86% 100%, 14% 100%, 0% 50%)',
                            }}
                          >
                            {chest.step}
                          </span>
                          <span
                            className={`mt-1.5 inline-flex items-center gap-1 text-xs font-extrabold ${
                              isChestClaimed
                                ? 'text-emerald-300'
                                : canClaimChest
                                  ? 'text-amber-300'
                                  : 'text-white'
                            }`}
                          >
                            {isChestClaimed ? (
                              <span>Claimed</span>
                            ) : chest.isGift ? (
                              <>
                                <span aria-hidden="true">🎁</span>
                                <span>{canClaimChest ? 'Tap Gift!' : 'Gift'}</span>
                              </>
                            ) : (
                              <>
                                <ZayroCoinArt size={14} />
                                <span>{canClaimChest ? `Tap +${chest.label}` : chest.label}</span>
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Add a Friend quick banner matching reference */}
              <button
                type="button"
                onClick={() => setActiveQuickPanel('friends')}
                className="flex w-full items-center justify-between rounded-2xl border border-[#7C3AED]/45 bg-gradient-to-r from-[#180A36] to-[#120728] px-4 py-3 text-left shadow-md transition-colors hover:border-purple-400/70"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600/25 text-purple-300">
                    <UserPlus className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-sm font-bold text-white">Add a Friend</span>
                </div>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-purple-400/60 bg-purple-600/20 text-purple-200">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>

              {/* Clean Task List */}
              <div className="divide-y divide-white/5 rounded-3xl border border-purple-400/20 bg-[#140B2A]/95 px-4">
                {dailyTasks.map((task) => {
                  const ready = task.progress >= task.target && !task.claimed;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 py-4"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{task.title}</div>
                        {task.subtitle && (
                          <div className="mt-0.5 text-[11px] text-slate-400">{task.subtitle}</div>
                        )}
                        <div className="mt-1 inline-flex items-center gap-1.5 font-mono-tabular text-xs font-bold text-amber-300">
                          <ZayroCoinArt size={14} />
                          <span>x{task.rewardCoins.toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!ready && !task.claimed}
                        onClick={() => {
                          if (task.claimed) {
                            setUnboxedTaskPreview(task);
                            return;
                          }
                          if (ready) {
                            onClaimTask(task.id);
                          }
                        }}
                        className={`min-h-[38px] min-w-[82px] shrink-0 rounded-full px-4 py-1.5 text-xs font-extrabold transition-colors ${
                          task.claimed
                            ? 'border border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                            : ready
                              ? 'bg-gradient-to-r from-violet-400 to-purple-500 text-slate-950 shadow-md hover:brightness-110'
                              : 'border border-white/10 bg-[#221A34] font-mono-tabular text-slate-400'
                        }`}
                      >
                        {task.claimed ? 'UNBOX' : ready ? 'Claim' : `${task.progress}/${task.target}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {unboxedTaskPreview && (
              <div
                onClick={() => setUnboxedTaskPreview(null)}
                role="presentation"
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xs rounded-3xl border border-amber-400/45 bg-gradient-to-b from-[#231047] via-[#130829] to-[#0A0516] p-5 text-center text-white shadow-2xl"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/20">
                    <ZayroCoinArt size={28} />
                  </div>
                  <h3 className="mt-3 font-display text-base font-extrabold text-amber-200">
                    Reward Unboxed
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-200">
                    {unboxedTaskPreview.title}
                  </p>
                  <div className="mt-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 font-mono-tabular text-sm font-black text-emerald-300">
                    +{unboxedTaskPreview.rewardCoins.toLocaleString()} Coins Credited
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    This daily task reward has already been claimed and added to your wallet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUnboxedTaskPreview(null)}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-2 text-xs font-black text-slate-950 hover:brightness-110"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* FULL-SCREEN OVERLAY: FRIENDS */}
      {activeQuickPanel === 'friends' && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#070B14] text-white">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-cyan-400/20 bg-[#0A101D]/95 px-4 py-3 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveQuickPanel(null)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-cyan-400/35 bg-[#0D1526] px-3.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-cyan-300" />
              <span className="font-display text-sm font-extrabold text-white">
                Friends ({onlineFriendsCount} Online / {friends.length})
              </span>
            </div>
            <div className="w-16" />
          </header>

          <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 sm:p-6">
            <div className="rounded-3xl border border-cyan-400/20 bg-[#0D1526] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">Your Friends</h2>
                  <p className="text-xs text-slate-400">
                    Tap any friend to open their Profile Page or add by User ID
                  </p>
                </div>
                <form onSubmit={handleFriendSearch} className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={friendSearchUid}
                      onChange={(e) => setFriendSearchUid(e.target.value)}
                      placeholder="Enter User ID (e.g. 100001)"
                      className="rounded-xl border border-white/15 bg-[#070B14] py-2 pr-3 pl-8 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:opacity-95"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </form>
              </div>
              {friendNotice && <p className="mt-2.5 text-xs text-cyan-300">{friendNotice}</p>}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {friends.map((fr) => {
                  const friendAvatar: AvatarConfig = {
                    id: fr.avatarId || fr.uid,
                    uid: fr.uid,
                    publicId: fr.publicId || fr.uid,
                    name: fr.name,
                    handle: `@${fr.name.toLowerCase().replace(/\s+/g, '')}`,
                    photoUrl: fr.photoUrl,
                    skinTone: '#D69E76',
                    hairColor: '#1E293B',
                    robeColor: '#7C3AED',
                    accentColor: '#DDD6FE',
                    ornament: 'lotus',
                  };
                  return (
                    <button
                      key={fr.uid}
                      type="button"
                      onClick={() => {
                        if (onInspectUserById) {
                          onInspectUserById(fr.uid);
                          return;
                        }
                        onInspectUser({
                          avatar: friendAvatar,
                          vipLevel: 0,
                          charm: 0,
                          cpPartner: null,
                          ringNumber: 0,
                          lastSeenAt: fr.lastSeenAt,
                          online: fr.status === 'Online' || fr.status === 'In Voice Room',
                          friendStatus: 'friends',
                          roomId: rooms.find((r) => r.uid === fr.voiceRoomUid)?.id,
                          roomTitle: rooms.find((r) => r.uid === fr.voiceRoomUid)?.title,
                        });
                      }}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#132038] px-4 py-3 text-left transition-colors hover:border-cyan-400/45 hover:bg-[#192946]"
                    >
                      <div className="flex items-center gap-3">
                        <AvatarArt avatar={friendAvatar} size={40} />
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span>{fr.name}</span>
                            {fr.bondTag && <span className="text-xs text-rose-300">{fr.bondTag}</span>}
                          </div>
                          <div className="font-mono-tabular text-[11px] text-cyan-300 underline-offset-2 hover:underline">
                            {fr.publicId || fr.uid}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          fr.status === 'Offline' ? 'text-slate-400' : 'text-emerald-400'
                        }`}
                      >
                        {fr.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN OVERLAY: SHOP */}
      {activeQuickPanel === 'shop' && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto text-white"
          style={{
            background:
              'radial-gradient(circle at 50% 10%, rgba(6,182,212,0.22) 0%, rgba(11,26,46,0.98) 45%, #060D1A 100%)',
          }}
        >
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-cyan-400/25 bg-[#060D1A]/95 px-4 py-3 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveQuickPanel(null)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-cyan-400/35 bg-[#0D1526] px-3.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-amber-300" />
              <span className="font-display bg-gradient-to-b from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-lg font-black text-transparent">
                OG VELOCITY Shop
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-[#0D1526] px-3 py-1 font-mono-tabular text-xs font-bold text-amber-300">
                <ZayroCoinArt size={14} />
                <span>{formattedCoins}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveQuickPanel(null);
                  onOpenShop();
                }}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:opacity-95"
              >
                Me Shop
              </button>
            </div>
          </header>

          <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 sm:p-6">
            {shopNotice && (
              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-200">
                {shopNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'All Items' },
                  { id: 'ring', label: 'Rings' },
                  { id: 'frame', label: 'Frames (3 Days)' },
                  { id: 'entry', label: 'Entry Effects' },
                  { id: 'inventory', label: `My Inventory (${ownedItemIds.length})` },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFullShopCat(cat.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    fullShopCat === cat.id
                      ? cat.id === 'inventory'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.45)]'
                        : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.45)]'
                      : 'border border-cyan-400/25 bg-[#0D1526] text-slate-300 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {fullShopCat === 'inventory' && fullShopItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-8 text-center">
                <p className="text-sm font-semibold text-slate-300">
                  Your Inventory is empty. Purchase Rings, Frames, or Entry Effects in the Shop!
                </p>
                <button
                  type="button"
                  onClick={() => setFullShopCat('ring')}
                  className="mt-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 px-4 py-2 text-xs font-extrabold text-slate-950"
                >
                  Browse Rings
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {fullShopItems.map((item) => {
                  const owned = ownedItemIds.includes(item.id);
                  const equipped = equippedItems[item.category] === item.id;
                  const canAfford = coins >= item.priceCoins;
                  const isRingOnly = !!item.ringNumber;

                  return (
                    <div
                      key={item.id}
                      className={
                        isRingOnly
                          ? 'flex flex-col items-center justify-between bg-transparent p-2 text-center'
                          : 'flex flex-col items-center justify-between rounded-2xl border border-amber-400/45 bg-gradient-to-b from-[#0F2744] to-[#081224] p-3 text-center shadow-[0_0_18px_rgba(6,182,212,0.22)]'
                      }
                    >
                      <div className="line-clamp-1 w-full text-xs font-bold text-cyan-100">
                        {item.name}
                      </div>
                      <div className="my-2.5 flex h-16 items-center justify-center bg-transparent">
                        {item.ringNumber ? (
                          <RingSpriteArt ringNumber={item.ringNumber} size={64} alt={item.name} />
                        ) : item.seatFrameNumber ? (
                          <SeatFrameSpriteArt frameNumber={item.seatFrameNumber} size={62} alt={item.name} />
                        ) : (
                          <Sparkles className="h-8 w-8" style={{ color: item.previewColor }} />
                        )}
                      </div>
                      {(owned && fullShopCat === 'inventory') || item.durationDays ? (
                        <span
                          className={`mb-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            item.durationDays
                              ? 'bg-amber-500/20 text-amber-200'
                              : 'bg-slate-800/80 text-emerald-300'
                          }`}
                        >
                          {owned && fullShopCat === 'inventory'
                            ? formatItemDuration(ownedItemExpiries[item.id], item.durationDays)
                            : `${item.durationDays} Days`}
                        </span>
                      ) : null}
                      {owned ? (
                        <button
                          type="button"
                          onClick={() => {
                            onEquipShopItem?.(item);
                            setShopNotice(`Equipped ${item.name}!`);
                          }}
                          className={`w-full rounded-full border py-1.5 text-[11px] font-extrabold ${
                            equipped
                              ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                              : 'border-cyan-400/45 bg-[#0D1526] text-cyan-100 hover:bg-cyan-500/25'
                          }`}
                        >
                          {equipped ? 'Equipped' : 'Equip'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford || !onBuyShopItem}
                          onClick={() => {
                            if (!onBuyShopItem) {
                              setActiveQuickPanel(null);
                              onOpenShop();
                              return;
                            }
                            onBuyShopItem(item);
                            setShopNotice(`Unlocked ${item.name}!`);
                          }}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-amber-400/65 bg-[#0A101D] py-1.5 font-mono-tabular text-[11px] font-extrabold text-amber-200 hover:bg-amber-500/20 disabled:opacity-45"
                        >
                          <ZayroCoinArt size={12} />
                          <span>
                            {item.priceCoins >= 1_000_000
                              ? `${item.priceCoins / 1_000_000}M`
                              : `${Math.round(item.priceCoins / 1000)}K`}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Play together: Featured Hero + Game Covers + Multiplayer Games + Invite Friends */}
      <GamesSection
        friends={friends}
        currentUserUid={userProfile.uid}
        authToken={authToken}
        onInviteFriend={onInviteFriendToGame}
        onEarnCoins={onEarnCoins}
      />

      {/* Popular Voice Rooms Section (Relocated Below Games, Matching Reference) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Popular rooms</h2>
          </div>
          <button
            type="button"
            onClick={onSeeAllRooms}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-purple-300"
          >
            <span>See all</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.map((room) => {
            const hostAv: AvatarConfig =
              room.seats.find((s) => s.occupant?.uid === room.ownerUid)?.occupant ?? {
                id: room.ownerUid,
                uid: room.ownerUid,
                name: room.hostName || 'Host',
                handle: `@${(room.hostName || 'host').toLowerCase().replace(/\s+/g, '')}`,
                photoUrl: room.dpUrl || undefined,
                skinTone: '#D69E76',
                hairColor: '#1E293B',
                robeColor: '#7C3AED',
                accentColor: '#DDD6FE',
                ornament: 'crown',
              };
            return (
              <div
                key={room.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200/80 bg-white p-3.5 shadow-sm transition-colors hover:border-violet-400 dark:border-white/10 dark:bg-[#131730]/95 dark:hover:border-violet-400/45"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0 overflow-visible">
                    <AvatarArt avatar={hostAv} size={46} />
                    <div className="absolute -right-1 -bottom-1 z-30">
                      <RoomLevelBadgeArt level={room.level} size={20} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{room.title}</h3>
                      {room.isRoomLocked && (
                        <span title="Locked with passcode" className="inline-flex shrink-0">
                          <Lock className="h-3 w-3 text-amber-500 dark:text-amber-300" />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Users className="h-3 w-3" />
                        {room.listenerCount}
                      </span>
                      <span>·</span>
                      <span className="font-mono-tabular">ID {room.uid}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJoinRoom(room.id)}
                  className="shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:opacity-95"
                >
                  Join
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

