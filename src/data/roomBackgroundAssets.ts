import bgRoyal from '../assets/images/room_bg_velocity_royal_1795771428441.jpg';
import bgNeon from '../assets/images/room_bg_velocity_neon_1795771428635.jpg';
import bgGold from '../assets/images/room_bg_velocity_gold_1795771427901.jpg';
import bgCyber from '../assets/images/room_bg_velocity_cyber_1795771427683.jpg';
import bgCelestial from '../assets/images/room_bg_velocity_celestial_1795771427938.jpg';

export const ROOM_BACKGROUND_IMAGES: Record<string, string> = {
  'bg-velocity-royal': bgRoyal,
  'bg-velocity-neon': bgNeon,
  'bg-velocity-gold': bgGold,
  'bg-velocity-cyber': bgCyber,
  'bg-velocity-celestial': bgCelestial,
  // Legacy theme ID aliases so existing rooms automatically render branded OG VELOCITY themes
  'bg-nebula': bgRoyal,
  'bg-aurora': bgCyber,
  'bg-saffron': bgGold,
  'bg-golden': bgGold,
  'bg-emerald': bgCelestial,
  'bg-crimson': bgNeon,
  'bg-river': bgCyber,
};

export function resolveRoomBackgroundImage(themeId?: string | null): string | undefined {
  if (!themeId) return bgRoyal;
  return ROOM_BACKGROUND_IMAGES[themeId] ?? bgRoyal;
}
