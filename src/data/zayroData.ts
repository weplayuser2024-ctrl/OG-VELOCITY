import type { CSSProperties } from 'react';
import type {
  AvatarConfig,
  BondTag,
  CharmLevelInfo,
  ChatThread,
  CoinPackage,
  DailyTaskItem,
  FriendRecord,
  GuardLeader,
  IntimateSpaceData,
  MomentPost,
  RoomBackgroundTheme,
  RoomLevelInfo,
  RoomTaskItem,
  ShopItem,
  VipPlan,
  VipTierInfo,
  VirtualGift,
  VoiceRoom,
  VoiceSeat,
} from '../types';

export const USER_PROFILE: AvatarConfig = {
  id: 'user-self',
  uid: '',
  name: 'Player',
  handle: '@ogvelocity',
  bio: 'OG VELOCITY Explorer',
  gender: 'Male',
  age: 21,
  country: 'India',
  blessing: 0,
  tags: [],
  email: '',
  cpPartner: null,
  equippedFrameId: null,
  skinTone: '#E0AC89',
  hairColor: '#1E293B',
  robeColor: '#F59E0B',
  accentColor: '#FBBF24',
  ornament: 'crown',
};

export function getGenderSymbol(gender?: AvatarConfig['gender']): string {
  if (gender === 'Female') return '♀️';
  if (gender === 'Other') return '⚧️';
  return '♂️';
}

export function getCountryFlag(country?: string): string {
  const clean = (country || 'India').trim().toLowerCase();
  if (clean.includes('india')) return '🇮🇳';
  if (clean.includes('usa') || clean.includes('united states')) return '🇺🇸';
  if (clean.includes('uk') || clean.includes('britain')) return '🇬🇧';
  if (clean.includes('uae') || clean.includes('dubai')) return '🇦🇪';
  if (clean.includes('canada')) return '🇨🇦';
  if (clean.includes('pakistan')) return '🇵🇰';
  if (clean.includes('bangladesh')) return '🇧🇩';
  return '🌍';
}

export interface CpLevelTier {
  level: number;
  title: string;
  minCharm: number;
}

// Level 1 -> Level 2 requires 12,000 charms; Level 2 -> Level 3 requires +30,000 charms (42,000 cumulative)
export const CP_LEVELS: CpLevelTier[] = [
  { level: 1, title: 'Spark Bond', minCharm: 0 },
  { level: 2, title: 'Sweetheart Bond', minCharm: 12_000 },
  { level: 3, title: 'Crimson Promise', minCharm: 42_000 },
  { level: 4, title: 'Twin Star', minCharm: 102_000 },
  { level: 5, title: 'Golden Oath', minCharm: 182_000 },
  { level: 6, title: 'Amethyst Soul', minCharm: 292_000 },
  { level: 7, title: 'Royal Sanctuary', minCharm: 442_000 },
  { level: 8, title: 'Celestial Pair', minCharm: 642_000 },
  { level: 9, title: 'Eternal Flame', minCharm: 900_000 },
  { level: 10, title: 'Mythic Destiny', minCharm: 1_250_000 },
];

export function getCpLevelInfo(cpCharm: number = 0): {
  level: number;
  title: string;
  currentMin: number;
  nextMin: number | null;
  stepRequired: number;
  progressInLevel: number;
  stepRemaining: number;
  percent: number;
} {
  let current = CP_LEVELS[0];
  for (const tier of CP_LEVELS) {
    if (cpCharm >= tier.minCharm) {
      current = tier;
    }
  }
  const next = CP_LEVELS.find((t) => t.level === current.level + 1) ?? null;
  const stepRequired = next ? next.minCharm - current.minCharm : 1;
  const progressInLevel = Math.max(0, cpCharm - current.minCharm);
  const stepRemaining = next ? Math.max(0, next.minCharm - cpCharm) : 0;
  const percent = next
    ? Math.min(100, Math.round((progressInLevel / Math.max(1, stepRequired)) * 100))
    : 100;

  return {
    level: current.level,
    title: current.title,
    currentMin: current.minCharm,
    nextMin: next ? next.minCharm : null,
    stepRequired,
    progressInLevel,
    stepRemaining,
    percent,
  };
}

export const AVATAR_ROSTER: AvatarConfig[] = [];

// Charm Levels Lv. 1 - 21 (1 Star up to 20 Crowns / Lv.21)
// Based on user's exact milestones: 5k, 13k, 40k, 100k, 150k, 300k, 500k, 1.2M, 3M, 5M, scaling to Lv.21
export const CHARM_LEVELS: CharmLevelInfo[] = [
  { level: 1, series: 'Star Series', minCharm: 0 },
  { level: 2, series: 'Star Series', minCharm: 5_000 },
  { level: 3, series: 'Diamond Series', minCharm: 13_000 },
  { level: 4, series: 'Diamond Series', minCharm: 40_000 },
  { level: 5, series: 'Diamond Series', minCharm: 100_000 },
  { level: 6, series: 'Diamond Series', minCharm: 150_000 },
  { level: 7, series: 'Diamond Series', minCharm: 300_000 },
  { level: 8, series: 'Normal Crown', minCharm: 500_000 },
  { level: 9, series: 'Normal Crown', minCharm: 1_200_000 },
  { level: 10, series: 'Normal Crown', minCharm: 3_000_000 },
  { level: 11, series: 'Advanced Crown', minCharm: 5_000_000 },
  { level: 12, series: 'Advanced Crown', minCharm: 8_000_000 },
  { level: 13, series: 'Advanced Crown', minCharm: 12_000_000 },
  { level: 14, series: 'Advanced Crown', minCharm: 18_000_000 },
  { level: 15, series: 'Advanced Crown', minCharm: 25_000_000 },
  { level: 16, series: 'Hard Crown', minCharm: 35_000_000 },
  { level: 17, series: 'Hard Crown', minCharm: 50_000_000 },
  { level: 18, series: 'Hard Crown', minCharm: 70_000_000 },
  { level: 19, series: 'Hard Crown', minCharm: 95_000_000 },
  { level: 20, series: 'Hard Crown', minCharm: 125_000_000 },
  { level: 21, series: 'Hard Crown', minCharm: 160_000_000 },
];

export function getCharmLevelInfo(charmPoints: number): {
  current: CharmLevelInfo;
  next: CharmLevelInfo | null;
} {
  let current = CHARM_LEVELS[0];
  for (const tier of CHARM_LEVELS) {
    if (charmPoints >= tier.minCharm) {
      current = tier;
    }
  }
  const next = CHARM_LEVELS.find((t) => t.level === current.level + 1) ?? null;
  return { current, next };
}

// VIP Levels (Lv. 1 - 18) matching VIP_PROGRESSION_SEED cumulative thresholds
export const VIP_TIERS: VipTierInfo[] = [
  { level: 1, minGrowth: 0, title: 'VIP 1 Initiate', perk: 'Silver Shield Emblem & Standard Room Entry', accentColor: '#38BDF8' },
  { level: 2, minGrowth: 5_000, title: 'VIP 2 Azure', perk: 'Azure Winged Shield + Azure Entrance Banner', accentColor: '#38BDF8' },
  { level: 3, minGrowth: 14_000, title: 'VIP 3 Crystal', perk: 'VIP3 Glasses Gift Unlock + Priority Seat Queue', giftReward: 'V3 Glasses', frameUnlock: 'Crystal Halo Frame', accentColor: '#34D399' },
  { level: 4, minGrowth: 30_000, title: 'VIP 4 Amethyst', perk: 'Emerald-Amethyst Banner + Double Room Task EXP', accentColor: '#34D399' },
  { level: 5, minGrowth: 70_000, title: 'VIP 5 Solar', perk: 'VIP5 Sun Gift Unlock + Rose Sceptre Frame', giftReward: 'V5 Sun', frameUnlock: 'Rose Sceptre', accentColor: '#A855F7' },
  { level: 6, minGrowth: 130_000, title: 'VIP 6 Sovereign', perk: 'Gilded Violet Wings + Custom Entry Ribbon', accentColor: '#A855F7' },
  { level: 7, minGrowth: 220_000, title: 'VIP 7 Crimson', perk: 'VIP7 Star Gift + Advanced Frame Unlock', giftReward: 'V7 Star', frameUnlock: 'Brave of Love', accentColor: '#FB7185' },
  { level: 8, minGrowth: 340_000, title: 'VIP 8 Monarch', perk: 'Royal Gold & Rose Crown + Anti-Mute Shield', accentColor: '#FB7185' },
  { level: 9, minGrowth: 490_000, title: 'VIP 9 Imperial', perk: 'VIP9 Diamond Gift + Rainbow Unicorn Frame', giftReward: 'V9 Diamond', frameUnlock: 'Rainbow Unicorn', accentColor: '#FBBF24' },
  { level: 10, minGrowth: 680_000, title: 'VIP 10 Celestial', perk: 'Golden Flame Entrance Effect + Seat Aura', accentColor: '#FBBF24' },
  { level: 11, minGrowth: 920_000, title: 'VIP 11 Legend', perk: 'VIP11 Customized Motorcycle Gift + Foxie Frame', giftReward: 'V11 Motorcycle', frameUnlock: 'Foxie', accentColor: '#F97316' },
  { level: 12, minGrowth: 1_220_000, title: 'VIP 12 Frost', perk: 'Blazing Sovereign Wings + VIP Lounge Pass', accentColor: '#F97316' },
  { level: 13, minGrowth: 1_580_000, title: 'VIP 13 Ember', perk: 'Magenta Phoenix Crest + Global Broadcast', accentColor: '#EC4899' },
  { level: 14, minGrowth: 2_000_000, title: 'VIP 14 Astral', perk: 'Astral Crown Wings + Custom Tag Color', accentColor: '#EC4899' },
  { level: 15, minGrowth: 2_500_000, title: 'VIP 15 Sovereign Apex', perk: 'Full-Screen Animated Room Entrance + Apex Crown Aura', accentColor: '#22D3EE' },
  { level: 16, minGrowth: 3_100_000, title: 'VIP 16 Celestial Sovereign', perk: 'Celestial Prismatic Wings + Royal Entrance Shield', accentColor: '#A855F7' },
  { level: 17, minGrowth: 3_800_000, title: 'VIP 17 Eternal Emperor', perk: 'Imperial Crimson-Gold Fanfare + Priority Stage Lock', accentColor: '#EC4899' },
  { level: 18, minGrowth: 4_600_000, title: 'VIP 18 Cosmic Legend', perk: 'Max VIP 18 Cosmic Crown + Supreme Entrance & All Perks', accentColor: '#22D3EE' },
];

export const NO_VIP_TIER: VipTierInfo = {
  level: 0,
  minGrowth: 0,
  title: 'VIP 0 Starter',
  perk: 'Purchase a verified VIP package via Permanent UPI QR to activate VIP',
  accentColor: '#94A3B8',
};

export function getVipTierByGrowth(
  growthPoints: number,
  isVipActive = true
): {
  current: VipTierInfo;
  next: VipTierInfo | null;
} {
  if (!isVipActive) {
    return { current: NO_VIP_TIER, next: VIP_TIERS[0] };
  }
  let current = VIP_TIERS[0];
  for (const tier of VIP_TIERS) {
    if (growthPoints >= tier.minGrowth) {
      current = tier;
    }
  }
  const next = VIP_TIERS.find((t) => t.level === current.level + 1) ?? null;
  return { current, next };
}

// Distinct shining colors across VIP 1 - VIP 18
export function getVipNameColor(vipLevel: number): string {
  if (vipLevel <= 0) return '#F8FAFC';
  const level = Math.max(1, Math.min(18, Math.round(vipLevel)));
  if (level <= 2) return '#38BDF8'; // V1-V2: Sky Crystal Blue
  if (level <= 4) return '#34D399'; // V3-V4: Emerald Mint
  if (level <= 6) return '#C084FC'; // V5-V6: Amethyst Violet
  if (level <= 8) return '#FB7185'; // V7-V8: Rose Coral
  if (level <= 10) return '#FBBF24'; // V9-V10: Sovereign Gold
  if (level <= 12) return '#FB923C'; // V11-V12: Blazing Ember
  if (level <= 14) return '#F472B6'; // V13-V14: Astral Magenta
  if (level === 15) return '#22D3EE'; // V15: Apex Glacier Cyan
  if (level === 16) return '#A855F7'; // V16: Celestial Prismatic Violet
  if (level === 17) return '#EC4899'; // V17: Eternal Crimson Rose
  return '#38BDF8'; // V18: Cosmic Legend Diamond Cyan
}

// Animated shining gradient name styling for ALL active VIP users (VIP 1 - VIP 18) with exact 2s shimmer
export function getVipNameStyle(vipLevel: number): CSSProperties {
  if (vipLevel <= 0) {
    return {};
  }
  const level = Math.max(1, Math.min(18, Math.round(vipLevel)));
  const palettes: Record<number, [string, string, string, string]> = {
    1: ['#7DD3FC', '#E0F2FE', '#38BDF8', 'rgba(56,189,248,0.45)'],
    2: ['#38BDF8', '#BAE6FD', '#0EA5E9', 'rgba(14,165,233,0.5)'],
    3: ['#34D399', '#D1FAE5', '#10B981', 'rgba(16,185,129,0.5)'],
    4: ['#2DD4BF', '#FEF08A', '#10B981', 'rgba(45,212,191,0.52)'],
    5: ['#C084FC', '#F5D0FE', '#8B5CF6', 'rgba(168,85,247,0.55)'],
    6: ['#A855F7', '#FDE68A', '#7C3AED', 'rgba(168,85,247,0.58)'],
    7: ['#FB7185', '#FFE4E6', '#F43F5E', 'rgba(251,113,133,0.58)'],
    8: ['#F43F5E', '#FDE047', '#FB7185', 'rgba(244,63,94,0.6)'],
    9: ['#FBBF24', '#FEF9C3', '#F59E0B', 'rgba(251,191,36,0.62)'],
    10: ['#FDE047', '#FFFFFF', '#F59E0B', 'rgba(253,224,71,0.68)'],
    11: ['#FB923C', '#FEF08A', '#EA580C', 'rgba(249,115,22,0.65)'],
    12: ['#F97316', '#7DD3FC', '#FBBF24', 'rgba(249,115,22,0.68)'],
    13: ['#F472B6', '#FDE68A', '#EC4899', 'rgba(236,72,153,0.7)'],
    14: ['#EC4899', '#A855F7', '#38BDF8', 'rgba(236,72,153,0.72)'],
    15: ['#22D3EE', '#FEF08A', '#F472B6', 'rgba(34,211,238,0.8)'],
    16: ['#C084FC', '#FFFFFF', '#38BDF8', 'rgba(168,85,247,0.85)'],
    17: ['#F43F5E', '#FEF08A', '#EC4899', 'rgba(236,72,153,0.88)'],
    18: ['#22D3EE', '#FFFFFF', '#FDE047', 'rgba(56,189,248,0.92)'],
  };
  const [c1, c2, c3, glow] = palettes[level] || palettes[1];
  return {
    backgroundImage: `linear-gradient(110deg, ${c1} 0%, ${c2} 42%, ${c3} 72%, ${c1} 100%)`,
    backgroundSize: '220% auto',
    animation: 'vipTextShimmer 2s linear infinite',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    display: 'inline-block',
    filter: `drop-shadow(0 0 8px ${glow})`,
  };
}

// Room Level EXP requirements (Lv. 1 -> 20):
// Lv 1->2: 15,000 EXP, Lv 2->3: 40,000 EXP, Lv 3->4: 100,000 EXP, scaling up to Lv 20
// Admin slots scale from 3 (Level 1) up to 15 (Level 20)
const ROOM_EXP_DELTAS = [
  0, // Lv 1 base
  15_000, // 1->2
  40_000, // 2->3
  100_000, // 3->4
  180_000, // 4->5
  280_000, // 5->6
  420_000, // 6->7
  600_000, // 7->8
  850_000, // 8->9
  1_150_000, // 9->10
  1_500_000, // 10->11
  1_950_000, // 11->12
  2_500_000, // 12->13
  3_150_000, // 13->14
  3_900_000, // 14->15
  4_800_000, // 15->16
  5_850_000, // 16->17
  7_100_000, // 17->18
  8_500_000, // 18->19
  10_200_000, // 19->20
];

const ROOM_TITLES = [
  'Newbie Explorer',
  'Bronze Spark',
  'Amber Flame',
  'Amethyst Pulse',
  'Royal Spark',
  'Premium Jade',
  'Frost Guardian',
  'Royal Crest',
  'Crimson Valor',
  'Power Shield',
  'Royal Star',
  'Sapphire Wing',
  'Imperial Crest',
  'Legend Guard',
  'Cosmic Star',
  'Astral Halo',
  'Thunder Lord',
  'Solar Sovereign',
  'Super Legend',
  'Supreme Legend',
];

export const ROOM_LEVEL_INFO: RoomLevelInfo[] = Array.from({ length: 20 }, (_, i) => {
  const level = i + 1;
  const adminSlots = Math.min(15, 3 + Math.floor(((level - 1) * 12) / 19));
  const memberNumeric = level < 5 ? `${level * 1}k` : level < 12 ? `${level * 2}k` : `${Math.min(50, level * 2.5)}k`;
  return {
    level,
    title: ROOM_TITLES[i],
    requiredExp: ROOM_EXP_DELTAS[i],
    memberLimit: memberNumeric.replace('.5k', 'k'),
    adminSlots,
  };
});

export function getAdminSlotCount(roomLevel: number): number {
  const found = ROOM_LEVEL_INFO.find((r) => r.level === Math.max(1, Math.min(20, roomLevel)));
  return found ? found.adminSlots : 3;
}

export function getRoomNextExp(roomLevel: number): number {
  const next = ROOM_LEVEL_INFO.find((r) => r.level === roomLevel + 1);
  return next ? next.requiredExp : ROOM_EXP_DELTAS[19];
}

export const ROOM_BACKGROUND_THEMES: RoomBackgroundTheme[] = [
  {
    id: 'bg-velocity-royal',
    name: 'OG Royal Indigo',
    gradient: 'linear-gradient(145deg, rgba(16,8,38,0.98) 0%, rgba(44,18,86,0.92) 52%, rgba(10,8,24,0.98) 100%)',
    accent: '#A855F7',
    ambiance: 'indigo',
  },
  {
    id: 'bg-velocity-neon',
    name: 'OG Neon Cyber',
    gradient: 'linear-gradient(145deg, rgba(8,14,34,0.98) 0%, rgba(58,14,72,0.9) 52%, rgba(6,24,44,0.98) 100%)',
    accent: '#EC4899',
    ambiance: 'crimson',
  },
  {
    id: 'bg-velocity-gold',
    name: 'OG Sovereign Gold',
    gradient: 'linear-gradient(145deg, rgba(18,12,8,0.98) 0%, rgba(56,34,12,0.92) 52%, rgba(10,8,12,0.98) 100%)',
    accent: '#FBBF24',
    ambiance: 'saffron',
  },
  {
    id: 'bg-velocity-cyber',
    name: 'OG Holo Sapphire',
    gradient: 'linear-gradient(145deg, rgba(6,16,34,0.98) 0%, rgba(12,48,84,0.9) 52%, rgba(6,12,24,0.98) 100%)',
    accent: '#22D3EE',
    ambiance: 'indigo',
  },
  {
    id: 'bg-velocity-celestial',
    name: 'OG Celestial Aurora',
    gradient: 'linear-gradient(145deg, rgba(6,22,24,0.98) 0%, rgba(16,52,64,0.9) 52%, rgba(8,12,28,0.98) 100%)',
    accent: '#34D399',
    ambiance: 'emerald',
  },
];

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pkg-1m', coins: 1_000_000, label: '1 Million Coins', priceInr: 100 },
  {
    id: 'pkg-2.2m',
    coins: 2_200_000,
    bonusCoins: 200_000,
    label: '2.2 Million Coins',
    priceInr: 200,
    highlight: 'Includes +200K Bonus',
  },
  { id: 'pkg-8m', coins: 8_000_000, label: '8 Million Coins', priceInr: 500, highlight: 'Popular Value' },
  { id: 'pkg-12m', coins: 12_000_000, label: '12 Million Coins', priceInr: 1000 },
  { id: 'pkg-30m', coins: 30_000_000, label: '30 Million Coins', priceInr: 2000, highlight: 'Best Mega Pack' },
];

export const VIP_PLANS: VipPlan[] = [
  {
    id: 'vip-1m',
    name: '1 Month VIP',
    durationDays: 30,
    priceInr: 200,
    grantedVipLevel: 1,
    perks: [
      'Starts at VIP 1 (30 Days Validity)',
      'Unlocks 1 VIP Point per 100 Coins spent on eligible gifts',
      'Renewal extends validity & stops decay (preserves earned level)',
    ],
  },
  {
    id: 'vip-3m',
    name: '3 Months VIP',
    durationDays: 90,
    priceInr: 500,
    grantedVipLevel: 1,
    perks: [
      'Starts at VIP 1 (90 Days Validity)',
      'Unlocks 1 VIP Point per 100 Coins spent on eligible gifts',
      'Renewal extends validity & stops decay (preserves earned level)',
    ],
  },
];

// 20 Rings (1M-20M) + 12 Chat Frames (150K-2M) + 20 Seat Frames (200K-2M) + Voice Room Effects
export const SHOP_ITEMS: ShopItem[] = [
  // 20 Rings (transparent cutouts, 1M to 20M Coins)
  { id: 'ring-1', name: 'Imperial Ruby Crest Ring', category: 'ring', priceCoins: 1_000_000, previewColor: '#F59E0B', description: '24K gold sovereign band crowned with a fiery ruby.', ringNumber: 1 },
  { id: 'ring-2', name: 'Astral Cryo Sapphire Ring', category: 'ring', priceCoins: 2_000_000, previewColor: '#38BDF8', description: 'Frost-forged platinum spiral holding an ocean sapphire.', ringNumber: 2 },
  { id: 'ring-3', name: 'Rose Ember Filigree Ring', category: 'ring', priceCoins: 3_000_000, previewColor: '#FB7185', description: 'Sculpted rose-gold petals encircling a radiant pink diamond.', ringNumber: 3 },
  { id: 'ring-4', name: 'Seraphim Wing Halo Ring', category: 'ring', priceCoins: 4_000_000, previewColor: '#E2E8F0', description: 'Twin silver angel wings cradling a celestial star gem.', ringNumber: 4 },
  { id: 'ring-5', name: 'Flame Trident Monarch Ring', category: 'ring', priceCoins: 5_000_000, previewColor: '#F97316', description: 'Blazing amber-gold crest forged for CP champions.', ringNumber: 5 },
  { id: 'ring-6', name: 'Amethyst Violet Signet Ring', category: 'ring', priceCoins: 6_000_000, previewColor: '#A855F7', description: 'Royal filigree band set with a deep prism amethyst.', ringNumber: 6 },
  { id: 'ring-7', name: 'Solar Sunburst Halo Ring', category: 'ring', priceCoins: 7_000_000, previewColor: '#FBBF24', description: 'Sun-flare gold spokes framing a luminous opal core.', ringNumber: 7 },
  { id: 'ring-8', name: 'Glacier Teardrop Ring', category: 'ring', priceCoins: 8_000_000, previewColor: '#60A5FA', description: 'Refined silver vinework locked with an aquamarine gem.', ringNumber: 8 },
  { id: 'ring-9', name: 'Celestial Compass Ring', category: 'ring', priceCoins: 9_000_000, previewColor: '#FDE68A', description: 'Dual-tone navigator jewel engraved with star runes.', ringNumber: 9 },
  { id: 'ring-10', name: 'Emerald Dragon Claw Ring', category: 'ring', priceCoins: 10_000_000, previewColor: '#10B981', description: 'Golden wyrm talons clutching an imperial emerald.', ringNumber: 10 },
  { id: 'ring-11', name: 'Prism Aurora Diamond Ring', category: 'ring', priceCoins: 11_000_000, previewColor: '#67E8F9', description: 'Rainbow-faceted diamond heart glowing in starlight.', ringNumber: 11 },
  { id: 'ring-12', name: 'Void Singularity Ring', category: 'ring', priceCoins: 12_000_000, previewColor: '#818CF8', description: 'Obsidian-violet astral coils orbiting a cosmic pearl.', ringNumber: 12 },
  { id: 'ring-13', name: 'Sakura Blossom Crown Ring', category: 'ring', priceCoins: 13_000_000, previewColor: '#F472B6', description: 'Enamel cherry-blossom bouquet blooming in 3D gold.', ringNumber: 13 },
  { id: 'ring-14', name: 'Clockwork Magenta Ruby Ring', category: 'ring', priceCoins: 14_000_000, previewColor: '#FB923C', description: 'Precision-cut gear halo centered on a royal magenta stone.', ringNumber: 14 },
  { id: 'ring-15', name: 'Arctic Rune Titanium Ring', category: 'ring', priceCoins: 15_000_000, previewColor: '#38BDF8', description: 'Engraved glacial runes crowned by a midnight cabochon.', ringNumber: 15 },
  { id: 'ring-16', name: 'Phoenix Feather Ruby Ring', category: 'ring', priceCoins: 16_000_000, previewColor: '#EF4444', description: 'Sculpted crimson plumes rising from molten gold.', ringNumber: 16 },
  { id: 'ring-17', name: 'Starlight Lotus Halo Ring', category: 'ring', priceCoins: 17_000_000, previewColor: '#2DD4BF', description: 'Delicate jade lotus petals cradling a star-cut crystal.', ringNumber: 17 },
  { id: 'ring-18', name: 'Royal Lion Sovereign Ring', category: 'ring', priceCoins: 18_000_000, previewColor: '#F59E0B', description: 'Crowned heraldic crest inlaid with golden diamonds.', ringNumber: 18 },
  { id: 'ring-19', name: 'Eternal Twin Heart Ring', category: 'ring', priceCoins: 19_000_000, previewColor: '#EC4899', description: 'Interlocking rose-quartz hearts bound by white gold.', ringNumber: 19 },
  { id: 'ring-20', name: 'OG VELOCITY Mythic Crown Ring', category: 'ring', priceCoins: 20_000_000, previewColor: '#FDE047', description: 'The ultimate 20M Sovereign Ring for eternal CP royalty.', ringNumber: 20 },

  // 20 Seat Frames (transparent cutouts, 3-day duration, 200K to 2M Coins)
  { id: 'frame-1', name: 'Royal Sapphire Crown Frame', category: 'frame', priceCoins: 200_000, previewColor: '#38BDF8', description: 'Blue-winged sovereign crown framing your mic seat & DP.', seatFrameNumber: 1, durationDays: 3 },
  { id: 'frame-2', name: 'Diamond Ice Crystal Frame', category: 'frame', priceCoins: 300_000, previewColor: '#67E8F9', description: 'Glacial crystalline frost halo crowned with an ice diamond.', seatFrameNumber: 2, durationDays: 3 },
  { id: 'frame-3', name: 'Crimson Rose Wreath Frame', category: 'frame', priceCoins: 400_000, previewColor: '#EF4444', description: 'Velvet red roses twined around a golden royal wreath.', seatFrameNumber: 3, durationDays: 3 },
  { id: 'frame-4', name: 'Winged Star Crest Frame', category: 'frame', priceCoins: 500_000, previewColor: '#FBBF24', description: 'Golden laurel & azure wings topped with a champion star.', seatFrameNumber: 4, durationDays: 3 },
  { id: 'frame-5', name: 'Amethyst Dragon Coil Frame', category: 'frame', priceCoins: 600_000, previewColor: '#A855F7', description: 'Fierce neon-purple cyber dragon coiling around your seat.', seatFrameNumber: 5, durationDays: 3 },
  { id: 'frame-6', name: 'Sakura Neko Ears Frame', category: 'frame', priceCoins: 700_000, previewColor: '#F472B6', description: 'Playful glowing pink cat ears and paw gems.', seatFrameNumber: 6, durationDays: 3 },
  { id: 'frame-7', name: 'Solar Flame Dragon Frame', category: 'frame', priceCoins: 800_000, previewColor: '#F97316', description: 'Blazing golden-crimson fire dragon circling your portrait.', seatFrameNumber: 7, durationDays: 3 },
  { id: 'frame-8', name: 'Azure Morpho Garden Frame', category: 'frame', priceCoins: 900_000, previewColor: '#3B82F6', description: 'Luminous blue butterflies & sakura blossoms on your mic.', seatFrameNumber: 8, durationDays: 3 },
  { id: 'frame-9', name: 'Seraphic Halo Wings Frame', category: 'frame', priceCoins: 1_000_000, previewColor: '#FDE68A', description: 'White angel wings and golden star halo.', seatFrameNumber: 9, durationDays: 3 },
  { id: 'frame-10', name: 'Obsidian Ruby Crown Frame', category: 'frame', priceCoins: 1_100_000, previewColor: '#DC2626', description: 'Gothic silver-steel crown encrusted with dark rubies.', seatFrameNumber: 10, durationDays: 3 },
  { id: 'frame-11', name: 'Bamboo Panda Guardian Frame', category: 'frame', priceCoins: 1_200_000, previewColor: '#4ADE80', description: 'Adorable bamboo panda hugging your voice seat.', seatFrameNumber: 11, durationDays: 3 },
  { id: 'frame-12', name: 'Valkyrie Wing Crest Frame', category: 'frame', priceCoins: 1_300_000, previewColor: '#9333EA', description: 'Crystal violet valkyrie wings with silver chains.', seatFrameNumber: 12, durationDays: 3 },
  { id: 'frame-13', name: 'Sovereign Golden Stars Frame', category: 'frame', priceCoins: 1_400_000, previewColor: '#F59E0B', description: 'Radiant constellation of 24K golden stars.', seatFrameNumber: 13, durationDays: 3 },
  { id: 'frame-14', name: 'Tidal Dolphin Wave Frame', category: 'frame', priceCoins: 1_500_000, previewColor: '#0EA5E9', description: 'Ocean crest wave with a leaping luminous dolphin.', seatFrameNumber: 14, durationDays: 3 },
  { id: 'frame-15', name: 'Blossom Sakura Ring Frame', category: 'frame', priceCoins: 1_600_000, previewColor: '#EC4899', description: 'Full ring of radiant spring sakura petals.', seatFrameNumber: 15, durationDays: 3 },
  { id: 'frame-16', name: 'Neon DJ Beats Frame', category: 'frame', priceCoins: 1_700_000, previewColor: '#38BDF8', description: 'Glowing cyber headphones & music equalizer waves.', seatFrameNumber: 16, durationDays: 3 },
  { id: 'frame-17', name: 'Kitsune Blossom Mask Frame', category: 'frame', priceCoins: 1_800_000, previewColor: '#F43F5E', description: 'Mystic scarlet kitsune spirit mask & camellia flowers.', seatFrameNumber: 17, durationDays: 3 },
  { id: 'frame-18', name: 'Imperial Lion Laurel Frame', category: 'frame', priceCoins: 1_900_000, previewColor: '#D97706', description: 'Crowned golden lion crest wreathed in victory laurels.', seatFrameNumber: 18, durationDays: 3 },
  { id: 'frame-19', name: 'Pink Ribbon Heart Frame', category: 'frame', priceCoins: 1_950_000, previewColor: '#F472B6', description: 'Floating heart-shaped pink aura tied with a satin bow.', seatFrameNumber: 19, durationDays: 3 },
  { id: 'frame-20', name: 'Immortal Phoenix Crest Frame', category: 'frame', priceCoins: 2_000_000, previewColor: '#FBBF24', description: 'Supreme blazing golden phoenix wings for room legends.', seatFrameNumber: 20, durationDays: 3 },

  // Voice Room Entrance Effects (Flame, Throne, Crab, Car, River, Golden Place)
  { id: 'entry-golden-flame', name: 'Golden Flame Entry', category: 'entry', priceCoins: 80_000, previewColor: '#FBBF24', description: 'Blazing golden flame ribbon with your VIP badge & colored name.', styleVariant: 'flame' },
  { id: 'entry-throne', name: 'Royal Throne Entry', category: 'entry', priceCoins: 140_000, previewColor: '#EF4444', description: 'Grand imperial throne entrance alert across the room.', styleVariant: 'throne' },
  { id: 'entry-car', name: 'Luxury Car Entry', category: 'entry', priceCoins: 180_000, previewColor: '#38BDF8', description: 'Sleek neon supercar streaks across the stage on VIP entry.', styleVariant: 'car' },
  { id: 'entry-river', name: 'Crystal River Entry', category: 'entry', priceCoins: 160_000, previewColor: '#22D3EE', description: 'Shimmering azure river wave banner announces your arrival.', styleVariant: 'river' },
  { id: 'entry-golden-palace', name: 'Golden Place Entry', category: 'entry', priceCoins: 240_000, previewColor: '#FDE047', description: 'Radiant Golden Place archway entrance with royal sparkles.', styleVariant: 'golden-palace' },
  { id: 'entry-crab', name: 'Red Crab Entry', category: 'entry', priceCoins: 110_000, previewColor: '#F97316', description: 'Playful neon coral crab entrance spectacle.', styleVariant: 'crab' },

  // Seat Effects
  { id: 'seatfx-blazing-fire', name: 'Blazing Fire Seat FX', category: 'seat-fx', priceCoins: 95_000, previewColor: '#F97316', description: 'Blazing amber flames pulsing around your active mic seat.' },
  { id: 'seatfx-astral-halo', name: 'Astral Pulse Seat FX', category: 'seat-fx', priceCoins: 130_000, previewColor: '#38BDF8', description: 'Dual cyan harmonic rings radiating as you speak.' },

  // Room Themes
  { id: 'theme-aurora', name: 'Aurora Nebula Theme', category: 'room-theme', priceCoins: 120_000, previewColor: '#38BDF8', description: 'Unlocks luminous northern-lights room stage theme.' },
  { id: 'theme-golden', name: 'Golden Palace Theme', category: 'room-theme', priceCoins: 180_000, previewColor: '#FBBF24', description: 'Imperial gilded room backdrop for level-up celebrations.' },
  { id: 'theme-river', name: 'Crystal River Theme', category: 'room-theme', priceCoins: 150_000, previewColor: '#22D3EE', description: 'Serene flowing river light gradients for your voice room.' },
];

const dynamicShopItemImageCache = new Map<string, string>();

export function setDynamicShopItemsCache(items: ShopItem[]) {
  dynamicShopItemImageCache.clear();
  for (const item of items) {
    if (item.id && item.imageUrl) {
      dynamicShopItemImageCache.set(item.id, item.imageUrl);
    }
  }
}

export function getCustomShopItemImage(itemId?: string | null): string | undefined {
  if (!itemId) return undefined;
  return dynamicShopItemImageCache.get(itemId);
}

export const BOND_TAGS: BondTag[] = [
  { id: 'brother', label: 'Bro', emoji: '🤝', color: '#38BDF8', requiredGiftCost: 50 },
  { id: 'sister', label: 'Sister', emoji: '🍀', color: '#34D399', requiredGiftCost: 100 },
  { id: 'confident', label: 'Confident', emoji: '✨', color: '#FBBF24', requiredGiftCost: 300 },
];

export const RELATIONSHIP_TAG_THRESHOLDS = [
  0, 15_000, 40_000, 100_000, 200_000, 350_000, 600_000, 800_000, 1_000_000, 1_200_000,
] as const;

export const RELATIONSHIP_TAG_DEFS: Array<{
  key: 'bro' | 'bestie' | 'sister' | 'soulmate' | 'lover' | 'confident';
  label: string;
  emoji: string;
  color: string;
  gradient: string;
}> = [
  { key: 'bro', label: 'Bro', emoji: '🤜🤛', color: '#38BDF8', gradient: 'from-sky-500 to-cyan-500' },
  { key: 'bestie', label: 'Bestie', emoji: '🎀', color: '#F472B6', gradient: 'from-pink-500 to-purple-500' },
  { key: 'sister', label: 'Sister', emoji: '💎', color: '#818CF8', gradient: 'from-indigo-400 to-purple-600' },
  { key: 'soulmate', label: 'Soulmate', emoji: '🪽', color: '#60A5FA', gradient: 'from-sky-400 to-amber-400' },
  { key: 'lover', label: 'Lover', emoji: '💞', color: '#FB7185', gradient: 'from-rose-500 to-amber-400' },
  { key: 'confident', label: 'Confident', emoji: '👑', color: '#FBBF24', gradient: 'from-amber-400 to-cyan-500' },
];

export const ACTION_ROOM_TAG_PRICES: Record<'bro' | 'bestie' | 'sister' | 'soulmate' | 'confident', number> = {
  bro: 50_000,
  bestie: 80_000,
  sister: 100_000,
  soulmate: 150_000,
  confident: 200_000,
};

export function getRelationshipTagDef(tagType?: string) {
  const clean = String(tagType || '').trim().toLowerCase();
  const normalized = clean === 'cp_partner' ? 'lover' : clean;
  return (
    RELATIONSHIP_TAG_DEFS.find((d) => d.key === normalized) ?? RELATIONSHIP_TAG_DEFS[0]
  );
}

export function getRelationshipTagLevelInfo(charmScore: number = 0) {
  let level = 1;
  for (let i = 0; i < RELATIONSHIP_TAG_THRESHOLDS.length; i++) {
    if (charmScore >= RELATIONSHIP_TAG_THRESHOLDS[i]) level = i + 1;
  }
  const currentMin = RELATIONSHIP_TAG_THRESHOLDS[level - 1] ?? 0;
  const nextMin = level < 10 ? RELATIONSHIP_TAG_THRESHOLDS[level] : null;
  const progress = Math.max(0, charmScore - currentMin);
  const stepTotal = nextMin ? Math.max(1, nextMin - currentMin) : 1;
  const percent = nextMin ? Math.min(100, Math.round((progress / stepTotal) * 100)) : 100;
  return { level, currentMin, nextMin, progress, stepTotal, percent };
}

export const ROOM_EMOTES: Array<{
  id: string;
  emoteNumber: number;
  label: string;
  symbol: string;
  motion: 'bounce' | 'sway' | 'shake' | 'pulse';
}> = [
  { id: 'em-1', emoteNumber: 1, label: 'Thanks', symbol: '🙏', motion: 'bounce' },
  { id: 'em-2', emoteNumber: 2, label: 'Tears of Joy', symbol: '😂', motion: 'shake' },
  { id: 'em-3', emoteNumber: 3, label: 'Cheer Up', symbol: '🎉', motion: 'sway' },
  { id: 'em-4', emoteNumber: 4, label: 'Kiss', symbol: '😘', motion: 'pulse' },
  { id: 'em-5', emoteNumber: 5, label: 'Love', symbol: '😍', motion: 'pulse' },
  { id: 'em-6', emoteNumber: 6, label: 'DJ', symbol: '🎧', motion: 'bounce' },
  { id: 'em-7', emoteNumber: 7, label: 'Bow', symbol: '🙇', motion: 'sway' },
  { id: 'em-8', emoteNumber: 8, label: 'Confused', symbol: '❓', motion: 'sway' },
  { id: 'em-9', emoteNumber: 9, label: 'Tongue', symbol: '😛', motion: 'bounce' },
  { id: 'em-10', emoteNumber: 10, label: 'Shocked', symbol: '😱', motion: 'shake' },
  { id: 'em-11', emoteNumber: 11, label: 'Sob', symbol: '😭', motion: 'shake' },
  { id: 'em-12', emoteNumber: 12, label: 'Angry', symbol: '😡', motion: 'shake' },
  { id: 'em-13', emoteNumber: 13, label: 'Cool', symbol: '😎', motion: 'sway' },
  { id: 'em-14', emoteNumber: 14, label: 'Wink', symbol: '😉', motion: 'pulse' },
  { id: 'em-15', emoteNumber: 15, label: 'Heart', symbol: '💖', motion: 'pulse' },
  { id: 'em-16', emoteNumber: 16, label: 'Thumbs Up', symbol: '👍', motion: 'bounce' },
  { id: 'em-17', emoteNumber: 17, label: 'Laugh', symbol: '😆', motion: 'bounce' },
  { id: 'em-18', emoteNumber: 18, label: 'Facepalm', symbol: '🤦', motion: 'sway' },
  { id: 'em-19', emoteNumber: 19, label: 'Hug', symbol: '🤗', motion: 'pulse' },
  { id: 'em-20', emoteNumber: 20, label: 'Aww', symbol: '🥰', motion: 'pulse' },
  { id: 'em-21', emoteNumber: 21, label: 'Blow Kiss', symbol: '💋', motion: 'pulse' },
  { id: 'em-22', emoteNumber: 22, label: 'Hurray', symbol: '🙌', motion: 'bounce' },
  { id: 'em-23', emoteNumber: 23, label: 'Furious', symbol: '💢', motion: 'shake' },
  { id: 'em-24', emoteNumber: 24, label: 'Crying', symbol: '😢', motion: 'shake' },
  { id: 'em-25', emoteNumber: 25, label: 'Sleep', symbol: '😴', motion: 'sway' },
  { id: 'em-26', emoteNumber: 26, label: 'Peek', symbol: '👀', motion: 'sway' },
  { id: 'em-27', emoteNumber: 27, label: 'Boss', symbol: '🕶️', motion: 'bounce' },
  { id: 'em-28', emoteNumber: 28, label: 'King', symbol: '👑', motion: 'pulse' },
  { id: 'em-29', emoteNumber: 29, label: 'I Love You', symbol: '💌', motion: 'pulse' },
  { id: 'em-30', emoteNumber: 30, label: 'Rose', symbol: '🌹', motion: 'sway' },
];

export const INITIAL_DAILY_TASKS: DailyTaskItem[] = [
  { id: 'dt-1', title: 'Daily Login', subtitle: 'Open OG VELOCITY today', rewardCoins: 100_000, progress: 1, target: 1, claimed: false },
  { id: 'dt-2', title: 'Add a Friend', subtitle: 'Add anyone to your friends list', rewardCoins: 5_000, progress: 0, target: 1, claimed: false },
  { id: 'dt-3', title: 'Send a Gift', subtitle: 'Send a gift to a friend or host', rewardCoins: 10_000, progress: 0, target: 1, claimed: false },
  { id: 'dt-4', title: 'Receive a Gift', subtitle: 'Receive support or gift in a room', rewardCoins: 10_000, progress: 0, target: 1, claimed: false },
  { id: 'dt-5', title: 'Post a Moment', subtitle: 'Share a photo or video on Discover', rewardCoins: 8_000, progress: 0, target: 1, claimed: false },
  { id: 'dt-6', title: 'Play a Game', subtitle: 'Complete a match in Ludo, Carrom, UNO, or Laser Tag', rewardCoins: 15_000, progress: 0, target: 1, claimed: false },
  { id: 'dt-7', title: 'Spend Time in a Voice Room', subtitle: 'Join any Voice Room stage & take a seat', rewardCoins: 20_000, progress: 0, target: 1, claimed: false },
  { id: 'dt-8', title: 'Send a Room Message', subtitle: 'Chat with members in a Voice Room or DM', rewardCoins: 5_000, progress: 0, target: 1, claimed: false },
  { id: 'dt-9', title: 'Invite a Friend', subtitle: 'Share your invite code from Me -> Invite Friend', rewardCoins: 25_000, progress: 0, target: 1, claimed: false },
];

export const INITIAL_ROOM_TASKS: RoomTaskItem[] = [
  { id: 'rt-play', title: 'Playing Voice Room', rule: '5 Minutes = 5 EXP (Double for VIP, max 5k/50k)', progress: 5, target: 5, rewardExp: 5, vipDouble: true, claimed: false },
  { id: 'rt-gift', title: 'Sending Gifts or Red Packets', rule: '10 Coins = 1 EXP toward Room Level', progress: 0, target: 100, rewardExp: 10, vipDouble: false, claimed: false },
];

export const INITIAL_FRIENDS: FriendRecord[] = [];

export const INITIAL_CHAT_THREADS: ChatThread[] = [];

export const INITIAL_MOMENTS: MomentPost[] = [];

export const GUARD_LEADERBOARD: GuardLeader[] = [];

export const INITIAL_INTIMATE_SPACE: IntimateSpaceData = {
  partnerName: 'No Partner Linked',
  partnerAvatarId: '',
  togetherDays: 0,
  relationType: 'Couple',
  level: 1,
  progress: 0,
  target: 1000,
  bffTokenName: 'CP Bond Space',
};

// All built-in gifts removed per user request — only user-created & approved custom gifts appear
export const VIRTUAL_GIFTS: VirtualGift[] = [];

export const INITIAL_ROOMS: VoiceRoom[] = [];
