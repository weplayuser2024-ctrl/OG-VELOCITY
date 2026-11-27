import React from 'react';

// Clean transparent cutouts extracted from user-provided OG VELOCITY asset sheets
// Only the badge / ring / frame / gift itself is visible with zero background rectangle.

function getVipBadgeGlowColor(level: number): string {
  if (level <= 2) return 'rgba(56, 189, 248, 0.65)';
  if (level <= 4) return 'rgba(52, 211, 153, 0.65)';
  if (level <= 6) return 'rgba(168, 85, 247, 0.7)';
  if (level <= 8) return 'rgba(251, 113, 133, 0.72)';
  if (level <= 10) return 'rgba(251, 191, 36, 0.78)';
  if (level <= 12) return 'rgba(249, 115, 22, 0.8)';
  if (level <= 14) return 'rgba(236, 72, 153, 0.82)';
  if (level === 15) return 'rgba(34, 211, 238, 0.88)';
  if (level === 16) return 'rgba(168, 85, 247, 0.9)';
  if (level === 17) return 'rgba(236, 72, 153, 0.92)';
  return 'rgba(56, 189, 248, 0.96)';
}

export const VipBadgeArt: React.FC<{ level: number; size?: number; className?: string }> = ({
  level,
  size = 40,
  className = '',
}) => {
  if (level <= 0) return null;
  const clamped = Math.max(1, Math.min(18, Math.round(level)));
  const glowColor = getVipBadgeGlowColor(clamped);
  return (
    <img
      src={`/assets/cutouts/vip_${clamped}.png`}
      alt={`VIP ${clamped} Badge`}
      style={{
        height: size,
        width: 'auto',
        filter: `drop-shadow(0 0 ${Math.max(5, Math.round(size * 0.24))}px ${glowColor})`,
      }}
      className={`vip-badge-shine shrink-0 bg-transparent object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export const RoomLevelBadgeArt: React.FC<{
  level: number;
  size?: number;
  className?: string;
}> = ({ level, size = 42, className = '' }) => {
  const clamped = Math.max(1, Math.min(20, Math.round(level)));
  return (
    <img
      src={`/assets/cutouts/room_${clamped}.png`}
      alt={`Room Level ${clamped} Badge`}
      style={{ height: size, width: 'auto' }}
      className={`shrink-0 bg-transparent object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export const CharmBadgeArt: React.FC<{ level: number; size?: number; className?: string }> = ({
  level,
  size = 40,
  className = '',
}) => {
  const clamped = Math.max(1, Math.min(21, Math.round(level)));
  return (
    <img
      src={`/assets/cutouts/charm_${clamped}.png`}
      alt={`Charm Level ${clamped} Badge`}
      style={{ height: size, width: 'auto' }}
      className={`shrink-0 bg-transparent object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export const GiftSpriteArt: React.FC<{
  giftNumber: number;
  size?: number;
  alt?: string;
  className?: string;
}> = ({ giftNumber, size = 56, alt = 'Gift', className = '' }) => {
  const clamped = Math.max(1, Math.min(36, Math.round(giftNumber)));
  return (
    <img
      src={`/assets/cutouts/gift_${clamped}.png`}
      alt={alt}
      style={{ height: size, width: size }}
      className={`shrink-0 bg-transparent object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export const RingSpriteArt: React.FC<{
  ringNumber: number;
  size?: number;
  alt?: string;
  imageUrl?: string;
  className?: string;
}> = ({ ringNumber, size = 64, alt = 'Ring', imageUrl, className = '' }) => {
  const clamped = Math.max(1, Math.min(20, Math.round(ringNumber)));
  return (
    <img
      src={imageUrl || `/assets/cutouts/ring_${clamped}.png`}
      alt={alt}
      style={{ height: size, width: size }}
      className={`shrink-0 bg-transparent object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export const SeatFrameSpriteArt: React.FC<{
  frameNumber: number;
  size?: number;
  alt?: string;
  imageUrl?: string;
  className?: string;
}> = ({ frameNumber, size = 76, alt = 'Seat Frame', imageUrl, className = '' }) => {
  const clamped = Math.max(1, Math.min(20, Math.round(frameNumber)));
  return (
    <img
      src={imageUrl || `/assets/cutouts/seatframes/seat_frame_${clamped}.png`}
      alt={alt}
      style={{ height: size, width: size }}
      className={`pointer-events-none shrink-0 bg-transparent object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export const ChatFrameSpriteArt: React.FC<{
  frameNumber: number;
  alt?: string;
  className?: string;
}> = ({ frameNumber, alt = 'Chat Frame', className = '' }) => {
  const clamped = Math.max(1, Math.min(12, Math.round(frameNumber)));
  return (
    <img
      src={`/assets/cutouts/chatframes/chat_frame_${clamped}.png`}
      alt={alt}
      className={`pointer-events-none bg-transparent object-fill select-none ${className}`}
      draggable={false}
    />
  );
};

export const resolveChatFrameNumber = (frameIdOrBubble?: string): number | undefined => {
  if (!frameIdOrBubble) return undefined;
  const m = /^bubble-(\d+)$/.exec(frameIdOrBubble);
  if (m) return Math.max(1, Math.min(12, Number(m[1])));
  if (frameIdOrBubble === 'bubble-stars') return 4;
  if (frameIdOrBubble === 'bubble-phantom') return 6;
  if (frameIdOrBubble === 'bubble-waves') return 9;
  if (frameIdOrBubble === 'bubble-gold-ribbon') return 1;
  if (frameIdOrBubble === 'bubble-neon-pulse') return 7;
  return undefined;
};

export const ChatFrameMessage: React.FC<{
  frameNumber: number;
  avatarNode?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ frameNumber, avatarNode, children, className = '' }) => {
  const clamped = Math.max(1, Math.min(12, Math.round(frameNumber)));
  const isLightBanner = clamped === 5 || clamped === 8;
  return (
    <div
      className={`relative flex min-h-[56px] w-full max-w-[320px] items-center overflow-visible py-2 pr-8 pl-[27%] ${
        isLightBanner ? 'text-slate-950' : 'text-white'
      } ${className}`}
    >
      <img
        src={`/assets/cutouts/chatframes/chat_frame_${clamped}.png`}
        alt={`Chat Frame ${clamped}`}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill select-none"
        draggable={false}
      />
      {avatarNode && (
        <div className="pointer-events-none absolute top-1/2 left-[6.5%] z-10 flex h-[64%] aspect-square -translate-y-1/2 items-center justify-center overflow-hidden rounded-full">
          {avatarNode}
        </div>
      )}
      <div className="relative z-10 min-w-0 flex-1 text-left leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
        {children}
      </div>
    </div>
  );
};

export const ZayroCoinArt: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 20, className = '' }) => {
  return (
    <img
      src="/assets/cutouts/zayro_coin.png"
      alt="OG VELOCITY Coin"
      style={{ height: size, width: size }}
      className={`shrink-0 rounded-full bg-transparent object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export const EmoteSpriteArt: React.FC<{
  emoteNumber: number;
  size?: number;
  alt?: string;
  animated?: boolean;
  motion?: 'bounce' | 'sway' | 'shake' | 'pulse';
  className?: string;
}> = ({
  emoteNumber,
  size = 44,
  alt = 'Emote',
  animated = false,
  motion = 'bounce',
  className = '',
}) => {
  const clamped = Math.max(1, Math.min(30, Math.round(emoteNumber)));
  const animClass = animated
    ? motion === 'sway'
      ? 'animate-emote-sway'
      : motion === 'shake'
        ? 'animate-emote-shake'
        : motion === 'pulse'
          ? 'animate-emote-pulse'
          : 'animate-emote-bounce'
    : '';
  return (
    <img
      src={`/assets/cutouts/emotes/emote_${clamped}.png`}
      alt={alt}
      style={{ height: size, width: 'auto' }}
      className={`shrink-0 bg-transparent object-contain select-none ${animClass} ${className}`}
      draggable={false}
    />
  );
};

// Matches the user's Charm Badge + purple-gold pill reference image
export const CharmBadgePill: React.FC<{
  level: number;
  charm: number;
  className?: string;
}> = ({ level, charm, className = '' }) => {
  const clamped = Math.max(1, Math.min(21, Math.round(level)));
  const formatted =
    charm >= 1_000_000
      ? `${(charm / 1_000_000).toFixed(1)}M`
      : charm >= 1_000
        ? `${(charm / 1_000).toFixed(1)}K`
        : charm.toLocaleString();

  return (
    <div className={`relative inline-flex shrink-0 items-center overflow-visible select-none ${className}`}>
      {/* Horizontal purple-indigo pill with golden trim */}
      <div
        className="ml-5 flex h-7 shrink-0 items-center rounded-r-full border border-amber-400/80 pr-3.5 pl-6 shadow-md"
        style={{
          background: 'linear-gradient(90deg, #5B21B6 0%, #4338CA 65%, #312E81 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 10px rgba(91,33,182,0.45)',
        }}
      >
        <span className="font-mono-tabular whitespace-nowrap text-xs sm:text-sm font-extrabold tracking-tight text-white">
          {formatted}
        </span>
      </div>

      {/* Overlapping hexagonal crown charm badge + level circle */}
      <div className="pointer-events-none absolute left-0 flex items-center justify-center">
        <div
          className="flex h-9 w-9 items-center justify-center shadow-lg"
          style={{
            clipPath: 'polygon(50% 2%, 95% 26%, 95% 74%, 50% 98%, 5% 74%, 5% 26%)',
            background: 'linear-gradient(145deg, #FDE047 0%, #D97706 55%, #92400E 100%)',
            padding: '2px',
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              clipPath: 'polygon(50% 2%, 95% 26%, 95% 74%, 50% 98%, 5% 74%, 5% 26%)',
              background: 'radial-gradient(circle at 50% 35%, #0F766E 0%, #042F2E 85%)',
            }}
          >
            <CharmBadgeArt level={clamped} size={24} />
          </div>
        </div>
        <span className="absolute -right-1 -bottom-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-amber-300 bg-[#0D0C18] px-1 font-mono-tabular text-[9px] font-black text-amber-300 shadow">
          {clamped}
        </span>
      </div>
    </div>
  );
};

// Winged Golden-Pink Jeweled Heart Connector between connected CP seats in Voice Rooms
export const CpHeartConnectorArt: React.FC<{
  size?: number;
  cpLevel?: number;
  className?: string;
}> = ({ size = 56, cpLevel, className = '' }) => {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <svg
        width={size * 1.45}
        height={size}
        viewBox="0 0 116 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_12px_rgba(244,63,94,0.75)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="cpTendrilL" x1="0" y1="30" x2="40" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.1" />
            <stop offset="55%" stopColor="#FB7185" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FDE047" />
          </linearGradient>
          <linearGradient id="cpTendrilR" x1="76" y1="30" x2="116" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="45%" stopColor="#FB7185" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="cpGoldWing" x1="20" y1="12" x2="96" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <radialGradient id="cpHeartGem" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#FDA4AF" />
            <stop offset="45%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#9D174D" />
          </radialGradient>
        </defs>

        {/* Left & Right Flowing Pink Tendrils connecting partner seats */}
        <path
          d="M4 28 C18 22, 26 36, 40 31"
          stroke="url(#cpTendrilL)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M8 38 C20 42, 28 32, 41 35"
          stroke="#FDA4AF"
          strokeOpacity="0.65"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M112 28 C98 22, 90 36, 76 31"
          stroke="url(#cpTendrilR)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M108 38 C96 42, 88 32, 75 35"
          stroke="#FDA4AF"
          strokeOpacity="0.65"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Golden Wings */}
        <path
          d="M42 29 C30 22, 25 14, 29 10 C35 16, 40 20, 46 25 Z"
          fill="url(#cpGoldWing)"
          stroke="#FEF9C3"
          strokeWidth="0.9"
        />
        <path
          d="M40 35 C27 33, 21 26, 24 21 C31 26, 37 28, 43 32 Z"
          fill="url(#cpGoldWing)"
        />
        <path
          d="M74 29 C86 22, 91 14, 87 10 C81 16, 76 20, 70 25 Z"
          fill="url(#cpGoldWing)"
          stroke="#FEF9C3"
          strokeWidth="0.9"
        />
        <path
          d="M76 35 C89 33, 95 26, 92 21 C85 26, 79 28, 73 32 Z"
          fill="url(#cpGoldWing)"
        />

        {/* Top Crown Finial */}
        <path d="M53 16 L58 8 L63 16 Z" fill="#FDE047" stroke="#FFFBEB" strokeWidth="0.8" />
        <circle cx="58" cy="14" r="2.2" fill="#FB7185" />

        {/* Central Golden-Framed Pink-Crimson Heart Jewel */}
        <path
          d="M58 53 C58 53, 39 40, 39 27 C39 20, 45 16, 51 16 C55 16, 57 19, 58 21 C59 19, 61 16, 65 16 C71 16, 77 20, 77 27 C77 40, 58 53, 58 53 Z"
          fill="url(#cpHeartGem)"
          stroke="#FDE047"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* Specular Crystal Highlight */}
        <ellipse cx="50" cy="25" rx="4.5" ry="2.5" transform="rotate(-24 50 25)" fill="#FFFFFF" fillOpacity="0.65" />
        <circle cx="65" cy="24" r="1.4" fill="#FFFFFF" fillOpacity="0.7" />

        {/* 3 Hanging Crystal Drops */}
        <path d="M47 51 L49 58 L47 63 L45 58 Z" fill="#F472B6" stroke="#FDE047" strokeWidth="0.8" />
        <path d="M58 55 L61 63 L58 69 L55 63 Z" fill="#EC4899" stroke="#FDE047" strokeWidth="0.9" />
        <path d="M69 51 L71 58 L69 63 L67 58 Z" fill="#F472B6" stroke="#FDE047" strokeWidth="0.8" />
      </svg>
      {cpLevel && cpLevel >= 1 && (
        <span className="absolute -bottom-1 rounded-full border border-pink-300/60 bg-[#1B0F2E]/90 px-1.5 font-mono-tabular text-[8px] font-black text-pink-200 shadow">
          CP{cpLevel}
        </span>
      )}
    </div>
  );
};

export const normalizeRelationshipSpriteKey = (
  tagType?: string
): 'bro' | 'bestie' | 'sister' | 'soulmate' | 'lover' | 'confident' => {
  const clean = String(tagType || '').trim().toLowerCase();
  if (clean === 'cp_partner' || clean === 'lover') return 'lover';
  if (clean === 'bestie') return 'bestie';
  if (clean === 'sister') return 'sister';
  if (clean === 'soulmate') return 'soulmate';
  if (clean === 'confident') return 'confident';
  return 'bro';
};

export const RelationshipTagSpriteArt: React.FC<{
  tagType?: string;
  level?: number;
  showCrest?: boolean;
  size?: number;
  className?: string;
}> = ({ tagType = 'bro', level = 1, showCrest = false, size = 44, className = '' }) => {
  const key = normalizeRelationshipSpriteKey(tagType);
  const clamped = Math.max(1, Math.min(10, Math.round(level || 1)));
  const src = showCrest
    ? `/assets/cutouts/tags/${key}/crest.png`
    : `/assets/cutouts/tags/${key}/lv${clamped}.png`;

  return (
    <img
      src={src}
      alt={`${key} ${showCrest ? 'crest' : `Lv.${clamped}`}`}
      width={size}
      height={size}
      style={{ width: size, height: showCrest ? Math.round(size * 0.85) : size }}
      className={`inline-block shrink-0 object-contain select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] ${className}`}
      draggable={false}
    />
  );
};

export const TagFistConnectorArt: React.FC<{
  size?: number;
  level?: number;
  label?: string;
  className?: string;
}> = ({ size = 46, level, label, className = '' }) => {
  return (
    <div className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}>
      <img
        src="/assets/cutouts/tag_connector_fist.png"
        alt={label ? `${label} Tag Connector` : 'Tag Bond Connector'}
        style={{ width: Math.round(size * 1.48), height: size }}
        className="object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.65)]"
        draggable={false}
      />
      {(label || (level && level >= 1)) && (
        <span className=" -mt-1.5 rounded-full border border-cyan-300/60 bg-[#0B1733]/95 px-1.5 py-0.2 font-mono-tabular text-[8px] font-black text-cyan-200 shadow">
          {label ? `${label}` : ''}{level && level >= 1 ? ` Lv.${level}` : ''}
        </span>
      )}
    </div>
  );
};

