import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminPermissionSets,
  coinPackages,
  events,
  gifts,
  paymentQrVersions,
  platformSettings,
  rolesPermissions,
  roomBackgrounds,
  shopItems,
  tasks,
  users,
  vipMemberships,
  vipPackages,
  vipPointLedger,
  vipProgressionRules,
  voiceRooms,
} from './schema.ts';

export const DEFAULT_VIP_DECAY_CONFIG = {
  enabled: true,
  graceDays: 15,
  mode: 'fixed' as 'fixed' | 'percent',
  dailyAmount: 50,
  dailyPercent: 5,
};

export const PERMANENT_UPI_CONFIG = {
  accountName: 'Imamuddin',
  upiId: '9871913389@yespop',
  provider: 'YesPop',
  customQrDataUrl: null as string | null,
  active: true,
  screens: ['coins', 'vip'] as string[],
  currentVersionId: 1,
  note: 'Scan & Pay via any UPI app (PhonePe, GPay, Paytm, BHIM), then submit your 12-digit UTR & screenshot for verification.',
};

export const DEFAULT_APP_CONFIG = {
  appName: 'OG VELOCITY',
  tagline: '4K Multiplayer Voice Squads, Social Rooms & Arcade',
  maintenanceMode: false,
  maintenanceMessage: 'OG VELOCITY is undergoing scheduled maintenance. Please check back shortly.',
  features: {
    voiceRooms: true,
    games: true,
    moments: true,
    shop: true,
    cpProposals: true,
  },
  voiceRoomLimits: {
    maxRoomsPerUser: 1,
    maxRoomLevel: 20,
    allowedCapacities: [10, 15, 19],
    defaultCapacity: 15,
  },
  charmRankingConfig: {
    weeklyEnabled: true,
    monthlyEnabled: true,
    overallEnabled: true,
    topLimit: 50,
  },
  homeBanner: {
    headline: 'Live Voice Rooms & Multiplayer Arena',
    subheadline: 'Real players, live WebRTC voice stages, and verified community rankings.',
  },
  profileDefaults: {
    defaultCountry: 'India',
    defaultBio: '',
  },
  supportInfo: {
    supportEmail: 'support@ogvelocity.xyz',
    supportNote: 'Report issues or submit payment inquiries through official in-app support.',
  },
};

export const VIP_PROGRESSION_SEED = [
  { level: 1, title: 'Initiate VIP', requiredPoints: 0, stepPoints: 0, badgeColor: '#38BDF8', benefits: ['Active VIP 1 Crest', 'VIP Room Entry Tag'] },
  { level: 2, title: 'Azure Guard', requiredPoints: 5000, stepPoints: 5000, badgeColor: '#60A5FA', benefits: ['5,000 VIP Points', 'Azure Chat Accent'] },
  { level: 3, title: 'Emerald Noble', requiredPoints: 14000, stepPoints: 9000, badgeColor: '#34D399', benefits: ['14,000 VIP Points', 'Emerald Aura Frame'] },
  { level: 4, title: 'Amethyst Baron', requiredPoints: 30000, stepPoints: 16000, badgeColor: '#A78BFA', benefits: ['30,000 VIP Points', 'Amethyst Entrance Ribbon'] },
  { level: 5, title: 'Crimson Knight', requiredPoints: 70000, stepPoints: 40000, badgeColor: '#FB7185', benefits: ['70,000 VIP Points', 'Crimson Mic Halo'] },
  { level: 6, title: 'Solar Viscount', requiredPoints: 130000, stepPoints: 60000, badgeColor: '#FBBF24', benefits: ['130,000 VIP Points', 'VIP 6 Priority Seat Entry', 'Golden Profile Showcase'] },
  { level: 7, title: 'Solaris Earl', requiredPoints: 220000, stepPoints: 90000, badgeColor: '#F59E0B', benefits: ['220,000 VIP Points', 'VIP 7 Animated Crest', 'Custom Name Glow'] },
  { level: 8, title: 'Celestial Marquis', requiredPoints: 340000, stepPoints: 120000, badgeColor: '#22D3EE', benefits: ['340,000 VIP Points', 'VIP 8 Entrance Banner', 'Room XP Boost 1.5x'] },
  { level: 9, title: 'Starlight Duke', requiredPoints: 490000, stepPoints: 150000, badgeColor: '#818CF8', benefits: ['490,000 VIP Points', 'VIP 9 Starlight Frame', 'Private Lounge Flair'] },
  { level: 10, title: 'Imperial Crown', requiredPoints: 680000, stepPoints: 190000, badgeColor: '#F43F5E', benefits: ['680,000 VIP Points', 'VIP 10 Crown Seal', 'Imperial Seat Highlight'] },
  { level: 11, title: 'Aether Archduke', requiredPoints: 920000, stepPoints: 240000, badgeColor: '#C084FC', benefits: ['920,000 VIP Points', 'VIP 11 Dual-Glow Name', 'VIP 11 Priority Desk'] },
  { level: 12, title: 'Eclipse Monarch', requiredPoints: 1220000, stepPoints: 300000, badgeColor: '#FDE047', benefits: ['1,220,000 VIP Points', 'VIP 12 Dual-Color Nameplate', 'Eclipse Entry Spark'] },
  { level: 13, title: 'Astral Emperor', requiredPoints: 1580000, stepPoints: 360000, badgeColor: '#38BDF8', benefits: ['1,580,000 VIP Points', 'VIP 13 Astral Crest', 'Extended Emote Deck'] },
  { level: 14, title: 'Mythic Overlord', requiredPoints: 2000000, stepPoints: 420000, badgeColor: '#FB923C', benefits: ['2,000,000 VIP Points', 'VIP 14 Mythic Halo', 'Pre-Sovereign Aura'] },
  { level: 15, title: 'Sovereign Apex', requiredPoints: 2500000, stepPoints: 500000, badgeColor: '#FACC15', benefits: ['2,500,000 VIP Points', 'VIP 15 Full-Screen Entrance', 'Sovereign Room Crest'] },
  { level: 16, title: 'Celestial Sovereign', requiredPoints: 3100000, stepPoints: 600000, badgeColor: '#A855F7', benefits: ['3,100,000 VIP Points', 'VIP 16 Celestial Wings', 'Prismatic Name Aura'] },
  { level: 17, title: 'Eternal Emperor', requiredPoints: 3800000, stepPoints: 700000, badgeColor: '#EC4899', benefits: ['3,800,000 VIP Points', 'VIP 17 Eternal Seal', 'Royal Entrance Fanfare'] },
  { level: 18, title: 'Cosmic Legend', requiredPoints: 4600000, stepPoints: 800000, badgeColor: '#22D3EE', benefits: ['4,600,000 VIP Points', 'Max VIP 18 Cosmic Legend Crown', 'All Exclusive Perks'] },
];

export const DEFAULT_SHOP_ITEMS_SEED = [
  { id: 'ring-1', name: 'Imperial Ruby Crest Ring', category: 'ring', priceCoins: 1_000_000, previewColor: '#F59E0B', description: '24K gold sovereign band crowned with a fiery ruby.', ringNumber: 1, sortOrder: 1 },
  { id: 'ring-2', name: 'Astral Cryo Sapphire Ring', category: 'ring', priceCoins: 2_000_000, previewColor: '#38BDF8', description: 'Frost-forged platinum spiral holding an ocean sapphire.', ringNumber: 2, sortOrder: 2 },
  { id: 'ring-3', name: 'Rose Ember Filigree Ring', category: 'ring', priceCoins: 3_000_000, previewColor: '#FB7185', description: 'Sculpted rose-gold petals encircling a radiant pink diamond.', ringNumber: 3, sortOrder: 3 },
  { id: 'ring-4', name: 'Seraphim Wing Halo Ring', category: 'ring', priceCoins: 4_000_000, previewColor: '#E2E8F0', description: 'Twin silver angel wings cradling a celestial star gem.', ringNumber: 4, sortOrder: 4 },
  { id: 'ring-5', name: 'Flame Trident Monarch Ring', category: 'ring', priceCoins: 5_000_000, previewColor: '#F97316', description: 'Blazing amber-gold crest forged for CP champions.', ringNumber: 5, sortOrder: 5 },
  { id: 'ring-6', name: 'Amethyst Violet Signet Ring', category: 'ring', priceCoins: 6_000_000, previewColor: '#A855F7', description: 'Royal filigree band set with a deep prism amethyst.', ringNumber: 6, sortOrder: 6 },
  { id: 'ring-7', name: 'Solar Sunburst Halo Ring', category: 'ring', priceCoins: 7_000_000, previewColor: '#FBBF24', description: 'Sun-flare gold spokes framing a luminous opal core.', ringNumber: 7, sortOrder: 7 },
  { id: 'ring-8', name: 'Glacier Teardrop Ring', category: 'ring', priceCoins: 8_000_000, previewColor: '#60A5FA', description: 'Refined silver vinework locked with an aquamarine gem.', ringNumber: 8, sortOrder: 8 },
  { id: 'ring-9', name: 'Celestial Compass Ring', category: 'ring', priceCoins: 9_000_000, previewColor: '#FDE68A', description: 'Dual-tone navigator jewel engraved with star runes.', ringNumber: 9, sortOrder: 9 },
  { id: 'ring-10', name: 'Emerald Dragon Claw Ring', category: 'ring', priceCoins: 10_000_000, previewColor: '#10B981', description: 'Golden wyrm talons clutching an imperial emerald.', ringNumber: 10, sortOrder: 10 },
  { id: 'ring-11', name: 'Prism Aurora Diamond Ring', category: 'ring', priceCoins: 11_000_000, previewColor: '#67E8F9', description: 'Rainbow-faceted diamond heart glowing in starlight.', ringNumber: 11, sortOrder: 11 },
  { id: 'ring-12', name: 'Void Singularity Ring', category: 'ring', priceCoins: 12_000_000, previewColor: '#818CF8', description: 'Obsidian-violet astral coils orbiting a cosmic pearl.', ringNumber: 12, sortOrder: 12 },
  { id: 'ring-13', name: 'Sakura Blossom Crown Ring', category: 'ring', priceCoins: 13_000_000, previewColor: '#F472B6', description: 'Enamel cherry-blossom bouquet blooming in 3D gold.', ringNumber: 13, sortOrder: 13 },
  { id: 'ring-14', name: 'Clockwork Magenta Ruby Ring', category: 'ring', priceCoins: 14_000_000, previewColor: '#FB923C', description: 'Precision-cut gear halo centered on a royal magenta stone.', ringNumber: 14, sortOrder: 14 },
  { id: 'ring-15', name: 'Arctic Rune Titanium Ring', category: 'ring', priceCoins: 15_000_000, previewColor: '#38BDF8', description: 'Engraved glacial runes crowned by a midnight cabochon.', ringNumber: 15, sortOrder: 15 },
  { id: 'ring-16', name: 'Phoenix Feather Ruby Ring', category: 'ring', priceCoins: 16_000_000, previewColor: '#EF4444', description: 'Sculpted crimson plumes rising from molten gold.', ringNumber: 16, sortOrder: 16 },
  { id: 'ring-17', name: 'Starlight Lotus Halo Ring', category: 'ring', priceCoins: 17_000_000, previewColor: '#2DD4BF', description: 'Delicate jade lotus petals cradling a star-cut crystal.', ringNumber: 17, sortOrder: 17 },
  { id: 'ring-18', name: 'Royal Lion Sovereign Ring', category: 'ring', priceCoins: 18_000_000, previewColor: '#F59E0B', description: 'Crowned heraldic crest inlaid with golden diamonds.', ringNumber: 18, sortOrder: 18 },
  { id: 'ring-19', name: 'Eternal Twin Heart Ring', category: 'ring', priceCoins: 19_000_000, previewColor: '#EC4899', description: 'Interlocking rose-quartz hearts bound by white gold.', ringNumber: 19, sortOrder: 19 },
  { id: 'ring-20', name: 'OG VELOCITY Mythic Crown Ring', category: 'ring', priceCoins: 20_000_000, previewColor: '#FDE047', description: 'The ultimate 20M Sovereign Ring for eternal CP royalty.', ringNumber: 20, sortOrder: 20 },
  { id: 'frame-1', name: 'Royal Sapphire Crown Frame', category: 'frame', priceCoins: 200_000, previewColor: '#38BDF8', description: 'Blue-winged sovereign crown framing your mic seat & DP.', seatFrameNumber: 1, durationDays: 3, sortOrder: 21 },
  { id: 'frame-2', name: 'Diamond Ice Crystal Frame', category: 'frame', priceCoins: 300_000, previewColor: '#67E8F9', description: 'Glacial crystalline frost halo crowned with an ice diamond.', seatFrameNumber: 2, durationDays: 3, sortOrder: 22 },
  { id: 'frame-3', name: 'Crimson Rose Wreath Frame', category: 'frame', priceCoins: 400_000, previewColor: '#EF4444', description: 'Velvet red roses twined around a golden royal wreath.', seatFrameNumber: 3, durationDays: 3, sortOrder: 23 },
  { id: 'frame-4', name: 'Winged Star Crest Frame', category: 'frame', priceCoins: 500_000, previewColor: '#FBBF24', description: 'Golden laurel & azure wings topped with a champion star.', seatFrameNumber: 4, durationDays: 3, sortOrder: 24 },
  { id: 'frame-5', name: 'Amethyst Dragon Coil Frame', category: 'frame', priceCoins: 600_000, previewColor: '#A855F7', description: 'Fierce neon-purple cyber dragon coiling around your seat.', seatFrameNumber: 5, durationDays: 3, sortOrder: 25 },
  { id: 'frame-6', name: 'Sakura Neko Ears Frame', category: 'frame', priceCoins: 700_000, previewColor: '#F472B6', description: 'Playful glowing pink cat ears and paw gems.', seatFrameNumber: 6, durationDays: 3, sortOrder: 26 },
  { id: 'frame-7', name: 'Solar Flame Dragon Frame', category: 'frame', priceCoins: 800_000, previewColor: '#F97316', description: 'Blazing golden-crimson fire dragon circling your portrait.', seatFrameNumber: 7, durationDays: 3, sortOrder: 27 },
  { id: 'frame-8', name: 'Azure Morpho Garden Frame', category: 'frame', priceCoins: 900_000, previewColor: '#3B82F6', description: 'Luminous blue butterflies & sakura blossoms on your mic.', seatFrameNumber: 8, durationDays: 3, sortOrder: 28 },
  { id: 'frame-9', name: 'Seraphic Halo Wings Frame', category: 'frame', priceCoins: 1_000_000, previewColor: '#FDE68A', description: 'White angel wings and golden star halo.', seatFrameNumber: 9, durationDays: 3, sortOrder: 29 },
  { id: 'frame-10', name: 'Obsidian Ruby Crown Frame', category: 'frame', priceCoins: 1_100_000, previewColor: '#DC2626', description: 'Gothic silver-steel crown encrusted with dark rubies.', seatFrameNumber: 10, durationDays: 3, sortOrder: 30 },
  { id: 'frame-11', name: 'Bamboo Panda Guardian Frame', category: 'frame', priceCoins: 1_200_000, previewColor: '#4ADE80', description: 'Adorable bamboo panda hugging your voice seat.', seatFrameNumber: 11, durationDays: 3, sortOrder: 31 },
  { id: 'frame-12', name: 'Valkyrie Wing Crest Frame', category: 'frame', priceCoins: 1_300_000, previewColor: '#9333EA', description: 'Crystal violet valkyrie wings with silver chains.', seatFrameNumber: 12, durationDays: 3, sortOrder: 32 },
  { id: 'frame-13', name: 'Sovereign Golden Stars Frame', category: 'frame', priceCoins: 1_400_000, previewColor: '#F59E0B', description: 'Radiant constellation of 24K golden stars.', seatFrameNumber: 13, durationDays: 3, sortOrder: 33 },
  { id: 'frame-14', name: 'Tidal Dolphin Wave Frame', category: 'frame', priceCoins: 1_500_000, previewColor: '#0EA5E9', description: 'Ocean crest wave with a leaping luminous dolphin.', seatFrameNumber: 14, durationDays: 3, sortOrder: 34 },
  { id: 'frame-15', name: 'Blossom Sakura Ring Frame', category: 'frame', priceCoins: 1_600_000, previewColor: '#EC4899', description: 'Full ring of radiant spring sakura petals.', seatFrameNumber: 15, durationDays: 3, sortOrder: 35 },
  { id: 'frame-16', name: 'Neon DJ Beats Frame', category: 'frame', priceCoins: 1_700_000, previewColor: '#38BDF8', description: 'Glowing cyber headphones & music equalizer waves.', seatFrameNumber: 16, durationDays: 3, sortOrder: 36 },
  { id: 'frame-17', name: 'Kitsune Blossom Mask Frame', category: 'frame', priceCoins: 1_800_000, previewColor: '#F43F5E', description: 'Mystic scarlet kitsune spirit mask & camellia flowers.', seatFrameNumber: 17, durationDays: 3, sortOrder: 37 },
  { id: 'frame-18', name: 'Imperial Lion Laurel Frame', category: 'frame', priceCoins: 1_900_000, previewColor: '#D97706', description: 'Crowned golden lion crest wreathed in victory laurels.', seatFrameNumber: 18, durationDays: 3, sortOrder: 38 },
  { id: 'frame-19', name: 'Pink Ribbon Heart Frame', category: 'frame', priceCoins: 1_950_000, previewColor: '#F472B6', description: 'Floating heart-shaped pink aura tied with a satin bow.', seatFrameNumber: 19, durationDays: 3, sortOrder: 39 },
  { id: 'frame-20', name: 'Immortal Phoenix Crest Frame', category: 'frame', priceCoins: 2_000_000, previewColor: '#FBBF24', description: 'Supreme blazing golden phoenix wings for room legends.', seatFrameNumber: 20, durationDays: 3, sortOrder: 40 },
  { id: 'entry-golden-flame', name: 'Golden Flame Entry', category: 'entry', priceCoins: 80_000, previewColor: '#FBBF24', description: 'Blazing golden flame ribbon with your VIP badge & colored name.', styleVariant: 'flame', sortOrder: 41 },
  { id: 'entry-throne', name: 'Royal Throne Entry', category: 'entry', priceCoins: 140_000, previewColor: '#EF4444', description: 'Grand imperial throne entrance alert across the room.', styleVariant: 'throne', sortOrder: 42 },
  { id: 'entry-car', name: 'Luxury Car Entry', category: 'entry', priceCoins: 180_000, previewColor: '#38BDF8', description: 'Sleek neon supercar streaks across the stage on VIP entry.', styleVariant: 'car', sortOrder: 43 },
  { id: 'entry-river', name: 'Crystal River Entry', category: 'entry', priceCoins: 160_000, previewColor: '#22D3EE', description: 'Shimmering azure river wave banner announces your arrival.', styleVariant: 'river', sortOrder: 44 },
  { id: 'entry-golden-palace', name: 'Golden Place Entry', category: 'entry', priceCoins: 240_000, previewColor: '#FDE047', description: 'Radiant Golden Place archway entrance with royal sparkles.', styleVariant: 'golden-palace', sortOrder: 45 },
  { id: 'entry-crab', name: 'Red Crab Entry', category: 'entry', priceCoins: 110_000, previewColor: '#F97316', description: 'Playful neon coral crab entrance spectacle.', styleVariant: 'crab', sortOrder: 46 },
  { id: 'seatfx-blazing-fire', name: 'Blazing Fire Seat FX', category: 'seat-fx', priceCoins: 95_000, previewColor: '#F97316', description: 'Blazing amber flames pulsing around your active mic seat.', sortOrder: 47 },
  { id: 'seatfx-astral-halo', name: 'Astral Pulse Seat FX', category: 'seat-fx', priceCoins: 130_000, previewColor: '#38BDF8', description: 'Dual cyan harmonic rings radiating as you speak.', sortOrder: 48 },
  { id: 'theme-aurora', name: 'Aurora Nebula Theme', category: 'room-theme', priceCoins: 120_000, previewColor: '#38BDF8', description: 'Unlocks luminous northern-lights room stage theme.', sortOrder: 49 },
  { id: 'theme-golden', name: 'Golden Palace Theme', category: 'room-theme', priceCoins: 180_000, previewColor: '#FBBF24', description: 'Imperial gilded room backdrop for level-up celebrations.', sortOrder: 50 },
  { id: 'theme-river', name: 'Crystal River Theme', category: 'room-theme', priceCoins: 150_000, previewColor: '#22D3EE', description: 'Serene flowing river light gradients for your voice room.', sortOrder: 51 },
];

export const ROLES_SEED = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    permissions: ['*'],
  },
  {
    role: 'admin',
    label: 'Admin',
    permissions: [
      'users:read',
      'users:manage',
      'payments:review',
      'wallet:adjust',
      'gifts:manage',
      'events:manage',
      'tasks:manage',
      'announcements:manage',
      'reports:manage',
      'audit:read',
    ],
  },
  {
    role: 'moderator',
    label: 'Moderator',
    permissions: ['users:read', 'users:moderate', 'reports:manage', 'posts:moderate', 'rooms:moderate'],
  },
  {
    role: 'support_staff',
    label: 'Support Staff',
    permissions: ['users:read', 'payments:read', 'reports:read', 'notifications:send'],
  },
];

let seedPromise: Promise<void> | null = null;

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

const DEFAULT_VIP_PACKAGES = [
  {
    id: 'vip-1m',
    name: '1 Month VIP',
    priceInr: 200,
    durationDays: 30,
    grantedVipLevel: 1,
    bonusGrowth: 0,
    perks: ['Starts at VIP 1', '30 Days Membership Validity', 'Earn 1 VIP Pt / 100 Coins Gifted'],
    active: true,
    sortOrder: 1,
  },
  {
    id: 'vip-3m',
    name: '3 Months VIP',
    priceInr: 500,
    durationDays: 90,
    grantedVipLevel: 1,
    bonusGrowth: 0,
    perks: ['Starts at VIP 1', '90 Days Membership Validity', 'Earn 1 VIP Pt / 100 Coins Gifted'],
    active: true,
    sortOrder: 2,
  },
];

const DEFAULT_PERMISSION_SETS = [
  {
    id: 'set-payment-reviewer',
    name: 'Payment Reviewer',
    description: 'Inspect payment orders, QR history, and approve/reject UTR submissions.',
    permissions: ['users:read', 'payments:read', 'payments:review', 'audit:read'],
  },
  {
    id: 'set-community-moderator',
    name: 'Community Moderator',
    description: 'Moderate voice rooms, moments, user reports, and temporary suspensions.',
    permissions: ['users:read', 'users:moderate', 'reports:manage', 'posts:moderate', 'rooms:moderate'],
  },
  {
    id: 'set-vip-manager',
    name: 'VIP & Economy Operator',
    description: 'Manage VIP packages, coin packages, gifts, and manual coin/VIP adjustments.',
    permissions: ['users:read', 'vip:manage', 'wallet:adjust', 'gifts:manage', 'events:manage', 'tasks:manage'],
  },
  {
    id: 'set-platform-operator',
    name: 'Platform Config Operator',
    description: 'Manage app settings, banners, announcements, and feature switches.',
    permissions: ['users:read', 'config:manage', 'announcements:manage', 'notifications:send'],
  },
];

async function runSeed(): Promise<void> {
  for (const r of ROLES_SEED) {
    await db
      .insert(rolesPermissions)
      .values(r)
      .onConflictDoUpdate({
        target: rolesPermissions.role,
        set: { label: r.label, permissions: r.permissions },
      });
  }

  for (const rule of VIP_PROGRESSION_SEED) {
    await db
      .insert(vipProgressionRules)
      .values(rule)
      .onConflictDoUpdate({
        target: vipProgressionRules.level,
        set: {
          title: rule.title,
          requiredPoints: rule.requiredPoints,
          stepPoints: rule.stepPoints,
          badgeColor: rule.badgeColor,
          benefits: rule.benefits,
        },
      });
  }

  const existingSettings = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'upi_payment_config'));
  let activeUpiVal = PERMANENT_UPI_CONFIG;
  if (existingSettings.length === 0) {
    await db.insert(platformSettings).values({
      key: 'upi_payment_config',
      value: PERMANENT_UPI_CONFIG,
    });
  } else {
    activeUpiVal = { ...PERMANENT_UPI_CONFIG, ...(existingSettings[0].value as Record<string, unknown>) } as typeof PERMANENT_UPI_CONFIG;
  }

  const existingQrVersions = await db.select().from(paymentQrVersions).limit(1);
  if (existingQrVersions.length === 0) {
    const [createdVer] = await db
      .insert(paymentQrVersions)
      .values({
        versionNumber: 1,
        accountName: String(activeUpiVal.accountName || PERMANENT_UPI_CONFIG.accountName),
        upiId: String(activeUpiVal.upiId || PERMANENT_UPI_CONFIG.upiId),
        provider: String(activeUpiVal.provider || PERMANENT_UPI_CONFIG.provider),
        customQrDataUrl: activeUpiVal.customQrDataUrl || null,
        qrPreviewDataUrl: activeUpiVal.customQrDataUrl || null,
        note: String(activeUpiVal.note || PERMANENT_UPI_CONFIG.note),
        active: activeUpiVal.active !== false,
        screens: Array.isArray(activeUpiVal.screens) ? activeUpiVal.screens : ['coins', 'vip'],
        updatedByUid: 'system',
        updatedByName: 'System Baseline',
        changeSummary: 'Initial dynamic payment QR version recorded.',
      })
      .returning();
    if (createdVer) {
      await db
        .update(platformSettings)
        .set({
          value: { ...activeUpiVal, currentVersionId: createdVer.id, active: createdVer.active, screens: createdVer.screens },
          updatedAt: new Date(),
        })
        .where(eq(platformSettings.key, 'upi_payment_config'));
    }
  }

  const existingAppCfg = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'app_config'));
  if (existingAppCfg.length === 0) {
    await db.insert(platformSettings).values({
      key: 'app_config',
      value: DEFAULT_APP_CONFIG,
    });
  }

  for (const pSet of DEFAULT_PERMISSION_SETS) {
    await db
      .insert(adminPermissionSets)
      .values(pSet)
      .onConflictDoNothing();
  }

  const existingDecayCfg = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'vip_decay_config'));
  if (existingDecayCfg.length === 0) {
    await db.insert(platformSettings).values({
      key: 'vip_decay_config',
      value: DEFAULT_VIP_DECAY_CONFIG,
    });
  }

  const [v2Migrated] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'vip_system_v2_migrated'));

  const [v3Migrated] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'vip_system_2plan_v3_migrated'));

  const existingVipPkgs = await db.select().from(vipPackages);
  if (existingVipPkgs.length === 0) {
    await db.insert(vipPackages).values(DEFAULT_VIP_PACKAGES);
  }

  if (!v2Migrated || !v3Migrated) {
    // Keep ONLY the 2 active VIP plans (1 Month ₹200 / 3 Months ₹500) both starting at VIP 1
    for (const pkg of DEFAULT_VIP_PACKAGES) {
      await db
        .insert(vipPackages)
        .values(pkg)
        .onConflictDoUpdate({
          target: vipPackages.id,
          set: {
            name: pkg.name,
            priceInr: pkg.priceInr,
            durationDays: pkg.durationDays,
            grantedVipLevel: 1,
            bonusGrowth: 0,
            perks: pkg.perks,
            active: true,
            sortOrder: pkg.sortOrder,
            updatedAt: new Date(),
          },
        });
    }

    // Deactivate vip-6m, vip-5y, vip-12m and any non-default VIP packages without altering user memberships
    const keepIds = new Set(DEFAULT_VIP_PACKAGES.map((p) => p.id));
    for (const oldPkg of existingVipPkgs) {
      if (!keepIds.has(oldPkg.id)) {
        await db
          .update(vipPackages)
          .set({ active: false, grantedVipLevel: 1, bonusGrowth: 0, updatedAt: new Date() })
          .where(eq(vipPackages.id, oldPkg.id));
      }
    }

    if (!v2Migrated) {
      const vipRows = await db.select().from(vipMemberships);
      for (const row of vipRows) {
        if (Number(row.vipGrowth || 0) > 0) {
          await db
            .insert(vipPointLedger)
            .values({
              userUid: row.userUid,
              delta: Number(row.vipGrowth),
              balanceAfter: Number(row.vipGrowth),
              vipLevelAfter: Math.max(0, Math.min(18, Number(row.vipLevel || 1))),
              source: 'migration',
              referenceId: 'vip_system_v2_migrated',
              idempotencyKey: `migration:${row.userUid}`,
              description: `Preserved existing VIP progression points (${Number(row.vipGrowth).toLocaleString()} pts, VIP ${row.vipLevel})`,
            })
            .onConflictDoNothing();
        }
      }

      await db
        .insert(platformSettings)
        .values({
          key: 'vip_system_v2_migrated',
          value: { migratedAt: new Date().toISOString() },
        })
        .onConflictDoNothing();
    }

    if (!v3Migrated) {
      await db
        .insert(platformSettings)
        .values({
          key: 'vip_system_2plan_v3_migrated',
          value: { migratedAt: new Date().toISOString(), activePlans: ['vip-1m', 'vip-3m'] },
        })
        .onConflictDoNothing();
    }
  }

  const existingCoinPkgs = await db.select().from(coinPackages);
  if (existingCoinPkgs.length === 0) {
    await db.insert(coinPackages).values([
      { id: 'pkg-1m', label: '1 Million Coins', coins: 1_000_000, bonusCoins: 0, priceInr: 100, highlight: 'Starter Pack', sortOrder: 1 },
      { id: 'pkg-2.2m', label: '2.2 Million Coins', coins: 2_200_000, bonusCoins: 200_000, priceInr: 200, highlight: '+10% Bonus', sortOrder: 2 },
      { id: 'pkg-8m', label: '8 Million Coins', coins: 8_000_000, bonusCoins: 1_000_000, priceInr: 500, highlight: 'Best Value', sortOrder: 3 },
      { id: 'pkg-12m', label: '12 Million Coins', coins: 12_000_000, bonusCoins: 1_500_000, priceInr: 1000, highlight: 'VIP Favorite', sortOrder: 4 },
      { id: 'pkg-30m', label: '30 Million Coins', coins: 30_000_000, bonusCoins: 5_000_000, priceInr: 2000, highlight: 'High Roller', sortOrder: 5 },
    ]);
  }

  const existingGifts = await db.select().from(gifts);
  if (existingGifts.length === 0) {
    await db.insert(gifts).values([
      {
        id: 'rose',
        name: 'Velvet Rose',
        cost: 100,
        charmValue: 100,
        randomCoinsMin: 10,
        randomCoinsMax: 50,
        rarity: 'Standard',
        primaryColor: '#F43F5E',
        secondaryColor: '#FB7185',
        description: 'Classic crimson petal tribute for hosts and friends.',
        particleStyle: 'rose',
        giftNumber: 1,
      },
      {
        id: 'kiss',
        name: 'Neon Heart',
        cost: 200,
        charmValue: 200,
        randomCoinsMin: 20,
        randomCoinsMax: 100,
        rarity: 'Standard',
        primaryColor: '#EC4899',
        secondaryColor: '#F472B6',
        description: 'Electric heart burst across the live room stage.',
        particleStyle: 'heart',
        giftNumber: 2,
      },
      {
        id: 'ring',
        name: 'Lotus Lantern',
        cost: 500,
        charmValue: 500,
        randomCoinsMin: 50,
        randomCoinsMax: 250,
        rarity: 'Signature',
        primaryColor: '#F59E0B',
        secondaryColor: '#FDE047',
        description: 'Radiant golden lantern illuminating the voice sanctuary.',
        particleStyle: 'lantern',
        giftNumber: 3,
      },
      {
        id: 'diamond-ring',
        name: 'Celestial Crown',
        cost: 2000,
        charmValue: 2000,
        randomCoinsMin: 200,
        randomCoinsMax: 1000,
        rarity: 'Signature',
        primaryColor: '#38BDF8',
        secondaryColor: '#818CF8',
        description: 'Sovereign diamond crown honoring top performers.',
        particleStyle: 'crown',
        giftNumber: 4,
      },
      {
        id: 'sports_car',
        name: 'Velocity Hypercar',
        cost: 5000,
        charmValue: 5000,
        randomCoinsMin: 500,
        randomCoinsMax: 2500,
        rarity: 'Mythic',
        primaryColor: '#22D3EE',
        secondaryColor: '#A855F7',
        description: 'Neon turbo supercar drifting across every seat.',
        particleStyle: 'vehicle',
        giftNumber: 5,
      },
      {
        id: 'castle',
        name: 'Astral Citadel',
        cost: 20000,
        charmValue: 20000,
        randomCoinsMin: 2000,
        randomCoinsMax: 10000,
        rarity: 'Mythic',
        primaryColor: '#FACC15',
        secondaryColor: '#F97316',
        description: 'Monumental floating citadel lighting up the whole arena.',
        particleStyle: 'meteor',
        giftNumber: 6,
      },
      {
        id: 'phoenix',
        name: 'Solar Phoenix',
        cost: 50000,
        charmValue: 50000,
        randomCoinsMin: 5000,
        randomCoinsMax: 25000,
        rarity: 'Mythic',
        primaryColor: '#EF4444',
        secondaryColor: '#FDE047',
        description: 'Supreme mythic phoenix sweeping across the entire room.',
        particleStyle: 'phoenix',
        giftNumber: 7,
      },
    ]);
  }

  const existingTasks = await db.select().from(tasks);
  if (existingTasks.length === 0) {
    await db.insert(tasks).values([
      { id: 'task-checkin', title: 'Daily Check-In', subtitle: 'Check in inside OG VELOCITY today', category: 'daily', actionType: 'checkin', targetCount: 1, rewardCoins: 200, sortOrder: 1 },
      { id: 'task-friend', title: 'Add a Friend', subtitle: 'Send or accept a friend request', category: 'daily', actionType: 'add_friend', targetCount: 1, rewardCoins: 250, sortOrder: 2 },
      { id: 'task-moment', title: 'Share a Moment', subtitle: 'Post a photo, video, or update in Discover', category: 'daily', actionType: 'post_moment', targetCount: 1, rewardCoins: 300, sortOrder: 3 },
      { id: 'task-game', title: 'Play Multiplayer Arena', subtitle: 'Complete a match in Ludo, Carrom, UNO, or Laser Tag', category: 'daily', actionType: 'play_game', targetCount: 1, rewardCoins: 500, sortOrder: 4 },
      { id: 'task-gift', title: 'Send a Gift', subtitle: 'Send any gift in a voice room or chat', category: 'daily', actionType: 'send_gift', targetCount: 1, rewardCoins: 350, sortOrder: 5 },
      { id: 'task-weekly-voice', title: 'Weekly Voice Host', subtitle: 'Host or participate across 5 voice sessions', category: 'weekly', actionType: 'voice_time', targetCount: 5, rewardCoins: 2500, sortOrder: 6 },
    ]);
  }

  const existingShopItems = await db.select().from(shopItems).limit(1);
  if (existingShopItems.length === 0) {
    await db
      .insert(shopItems)
      .values(DEFAULT_SHOP_ITEMS_SEED)
      .onConflictDoNothing();
  }

  const existingEvents = await db.select().from(events);
  if (existingEvents.length === 0) {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 86_400_000);
    await db.insert(events).values([
      {
        id: 'evt-velocity-cup',
        title: 'OG VELOCITY Season 1 Cup',
        subtitle: 'Live Carrom, UNO & Laser Tag Championship',
        description: 'Compete in live multiplayer matches and climb the weekly arena standings for bonus coin rewards.',
        eventType: 'tournament',
        rewardCoins: 10000,
        startsAt: now,
        endsAt: inSevenDays,
        status: 'live',
      },
      {
        id: 'evt-voice-gala',
        title: 'Midnight Voice Sanctuary Gala',
        subtitle: '19-Seat Official Audio Room Gathering',
        description: 'Join featured 19-seat official rooms, connect over WebRTC live audio, and celebrate top hosts.',
        eventType: 'voice',
        rewardCoins: 5000,
        startsAt: now,
        endsAt: inSevenDays,
        status: 'live',
      },
    ]);
  }

  const velBgs = [
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
  for (const bg of velBgs) {
    await db
      .insert(roomBackgrounds)
      .values(bg)
      .onConflictDoUpdate({
        target: roomBackgrounds.id,
        set: { name: bg.name, gradient: bg.gradient, accent: bg.accent, ambiance: bg.ambiance, active: true, updatedAt: new Date() },
      });
  }

  // Default starter rooms removed safely; rooms are now created permanently by users/admins via Create Room.
}
