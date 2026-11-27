import React from 'react';
import { getCustomShopItemImage } from '../data/zayroData';
import type { AvatarConfig } from '../types';
import { SeatFrameSpriteArt } from './SpriteArtwork';

interface AvatarArtProps {
  avatar: AvatarConfig;
  size?: number;
  isSpeaking?: boolean;
  audioLevel?: number;
  isMuted?: boolean;
  frameId?: string;
  seatFrameNumber?: number;
  frameImageUrl?: string;
}

export const resolveSeatFrameNumber = (
  frameId?: string,
  explicit?: number
): number | undefined => {
  if (explicit && explicit >= 1) return Math.max(1, Math.min(20, Math.round(explicit)));
  if (!frameId) return undefined;
  const m = /^frame-(\d+)$/.exec(frameId);
  if (m) {
    const num = Number(m[1]);
    if (num >= 1 && num <= 20) return num;
    return undefined;
  }
  if (frameId === 'frame-fire') return 7;
  if (frameId === 'frame-ice') return 2;
  if (frameId === 'frame-flower') return 15;
  if (frameId === 'frame-chair') return 18;
  if (frameId === 'frame-room') return 1;
  if (frameId === 'frame-rose-sceptre') return 3;
  if (frameId === 'frame-brave-love') return 19;
  if (frameId === 'frame-unicorn') return 8;
  if (frameId === 'frame-foxie') return 17;
  return undefined;
};

export const AvatarArt: React.FC<AvatarArtProps> = ({
  avatar,
  size = 76,
  isMuted: _isMuted = false,
  frameId,
  seatFrameNumber,
  frameImageUrl,
}) => {
  const uid = avatar.id.replace(/[^a-zA-Z0-9_-]/g, '');

  const frameRingStyle = (): React.CSSProperties | undefined => {
    if (!frameId) return undefined;
    if (frameId === 'frame-fire') {
      return {
        boxShadow: '0 0 18px rgba(249,115,22,0.85), inset 0 0 8px rgba(250,204,21,0.8)',
        border: '2.5px solid #FB923C',
      };
    }
    if (frameId === 'frame-ice') {
      return {
        boxShadow: '0 0 18px rgba(56,189,248,0.85), inset 0 0 8px rgba(224,242,254,0.85)',
        border: '2.5px solid #38BDF8',
      };
    }
    if (frameId === 'frame-flower') {
      return {
        boxShadow: '0 0 16px rgba(244,114,182,0.85)',
        border: '2.5px dashed #F472B6',
      };
    }
    if (frameId === 'frame-chair') {
      return {
        boxShadow: '0 0 18px rgba(251,191,36,0.9)',
        border: '2.5px solid #F59E0B',
      };
    }
    if (frameId === 'frame-room') {
      return {
        boxShadow: '0 0 18px rgba(34,211,238,0.85)',
        border: '2.5px solid #22D3EE',
      };
    }
    return undefined;
  };

  const frameGlyph =
    frameId === 'frame-fire'
      ? '🔥'
      : frameId === 'frame-ice'
        ? '❄️'
        : frameId === 'frame-flower'
          ? '🌸'
          : frameId === 'frame-chair'
            ? '🪑'
            : frameId === 'frame-room'
              ? '🏛️'
              : null;

  const effectiveFrameId = frameId ?? avatar.equippedFrameId ?? undefined;
  const resolvedCustomImageUrl = frameImageUrl ?? getCustomShopItemImage(effectiveFrameId);
  const resolvedSeatFrame = resolveSeatFrameNumber(
    effectiveFrameId,
    seatFrameNumber ?? avatar.seatFrameNumber
  );
  const hasOverlayFrame = Boolean(resolvedCustomImageUrl || resolvedSeatFrame);
  const frameSpriteSize = Math.round(size * 1.48);
  const outerSize = hasOverlayFrame ? Math.ceil(size * 1.54) : size;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center overflow-visible select-none"
      style={{ width: outerSize, height: outerSize }}
    >
      {hasOverlayFrame && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-visible"
        >
          <SeatFrameSpriteArt
            frameNumber={resolvedSeatFrame ?? 1}
            imageUrl={resolvedCustomImageUrl}
            size={frameSpriteSize}
            alt={`Seat Frame ${resolvedSeatFrame ?? effectiveFrameId ?? ''}`}
          />
        </div>
      )}
      {!hasOverlayFrame && frameGlyph && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 left-1/2 z-30 -translate-x-1/2 text-xs drop-shadow"
        >
          {frameGlyph}
        </span>
      )}
      {avatar.photoUrl ? (
        <img
          src={avatar.photoUrl}
          alt={avatar.name}
          style={{ width: size, height: size, ...(hasOverlayFrame ? {} : (frameRingStyle() ?? {})) }}
          className="relative z-10 rounded-full object-cover shadow-xl"
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          fill="none"
          style={hasOverlayFrame ? undefined : frameRingStyle()}
          className="relative z-10 rounded-full shadow-xl"
          aria-label={`${avatar.name} portrait`}
        >
        <defs>
          <radialGradient id={`bg-${uid}`} cx="32%" cy="22%" r="78%">
            <stop offset="0%" stopColor={avatar.accentColor} stopOpacity="0.55" />
            <stop offset="52%" stopColor={avatar.robeColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor="#090D18" />
          </radialGradient>
          <linearGradient id={`skin-${uid}`} x1="42" y1="26" x2="78" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={avatar.skinTone} />
            <stop offset="100%" stopColor={avatar.skinTone} stopOpacity="0.82" />
          </linearGradient>
          <linearGradient id={`robe-${uid}`} x1="25" y1="76" x2="95" y2="115" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={avatar.robeColor} />
            <stop offset="100%" stopColor="#0B0F1A" />
          </linearGradient>
          <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="50%" stopColor={avatar.accentColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={avatar.robeColor} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        <circle cx="60" cy="60" r="58.5" fill={`url(#bg-${uid})`} stroke={`url(#rim-${uid})`} strokeWidth="2" />

        {/* Subtle geometric studio rim arc */}
        <circle cx="60" cy="60" r="53" stroke={avatar.accentColor} strokeOpacity="0.18" strokeWidth="1" />

        {/* Armored collar & tunic shoulders */}
        <path d="M20 113C24 88 40 78 60 78C80 78 96 88 100 113" fill={`url(#robe-${uid})`} />
        <path
          d="M42 80L60 98L78 80"
          stroke={avatar.accentColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M35 88L48 106M85 88L72 106" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" />

        {/* Hair back */}
        <circle cx="60" cy="48" r="25" fill={avatar.hairColor} />

        {/* Neck & Head with soft ambient occlusion shadow */}
        <rect x="53" y="65" width="14" height="17" rx="6" fill={avatar.skinTone} />
        <ellipse cx="60" cy="67" rx="8" ry="3.5" fill="#000000" fillOpacity="0.22" />
        <ellipse cx="60" cy="51" rx="19.5" ry="22" fill={`url(#skin-${uid})`} />

        {/* Specular cheek highlight */}
        <ellipse cx="52" cy="54" rx="4.5" ry="2.2" fill="#FFFFFF" fillOpacity="0.14" />
        <ellipse cx="68" cy="54" rx="4.5" ry="2.2" fill="#FFFFFF" fillOpacity="0.14" />

        {/* Hair fringe */}
        <path
          d="M40 46C42 30 53 26 65 26C75 26 80 34 80 45C72 38 54 37 40 46Z"
          fill={avatar.hairColor}
        />

        {/* Eyes with catchlight speculars & eyebrows */}
        <path d="M48 47.5Q52 45.5 55.5 47" stroke="#0F172A" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M64.5 47Q68 45.5 72 47.5" stroke="#0F172A" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="52" cy="51.5" r="2.3" fill="#0F172A" />
        <circle cx="68" cy="51.5" r="2.3" fill="#0F172A" />
        <circle cx="51.3" cy="50.7" r="0.8" fill="#FFFFFF" />
        <circle cx="67.3" cy="50.7" r="0.8" fill="#FFFFFF" />
        <path d="M54.5 61.5C57.5 64 62.5 64 65.5 61.5" stroke="#7C2D12" strokeWidth="1.8" strokeLinecap="round" />

        {/* 4K Character Ornaments */}
        {avatar.ornament === 'crown' && (
          <g>
            <path d="M45 30L49 18L60 25L71 18L75 30H45Z" fill="#FBBF24" stroke="#FEF9C3" strokeWidth="1.4" strokeLinejoin="round" />
            <circle cx="60" cy="24" r="1.8" fill="#10B981" />
          </g>
        )}
        {avatar.ornament === 'halo' && (
          <ellipse cx="60" cy="21" rx="18" ry="4.5" stroke="#6EE7B7" strokeWidth="2.4" />
        )}
        {avatar.ornament === 'visor' && (
          <g>
            <rect x="44" y="46.5" width="32" height="9" rx="4.5" fill="#38BDF8" fillOpacity="0.42" stroke="#E0F2FE" strokeWidth="1.4" />
            <line x1="48" y1="49" x2="62" y2="49" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}
        {avatar.ornament === 'crescent' && (
          <path d="M62 16C56 17.5 55 24.5 61 27C57.5 24.5 57.5 18.5 62 16Z" fill="#FDA4AF" stroke="#FFE4E6" strokeWidth="0.9" />
        )}
        {avatar.ornament === 'lotus' && (
          <circle cx="60" cy="40" r="2.6" fill="#FBBF24" stroke="#FEF9C3" strokeWidth="0.8" />
        )}
        {avatar.ornament === 'flame' && (
          <path d="M60 14C64 19 64 24 60 27C56 24 56 19 60 14Z" fill="#FB923C" stroke="#FEF08A" strokeWidth="1" />
        )}
        </svg>
      )}
    </div>
  );
};
