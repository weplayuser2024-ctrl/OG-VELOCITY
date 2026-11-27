import React, { useEffect, useRef, useState } from 'react';
import { Gift } from 'lucide-react';
import type { GiftId, VirtualGift } from '../types';

interface ChromaVideoProps {
  src: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Plays .mp4 custom gift animations through an HTML5 <canvas> with chroma-key background removal
 * (samples corner backdrop / green screen pixels and smoothly feathers alpha to transparent).
 * Falls back cleanly to a plain muted <video> if cross-origin prevents pixel access.
 */
export const ChromaKeyVideo: React.FC<ChromaVideoProps> = ({
  src,
  width,
  height,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallbackRaw, setFallbackRaw] = useState(false);

  useEffect(() => {
    setFallbackRaw(false);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let rafId = 0;
    let cancelled = false;
    let keyR = 0;
    let keyG = 255;
    let keyB = 0;
    let sampledKey = false;

    const renderFrame = () => {
      if (cancelled) return;
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        try {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(video, 0, 0, width, height);
          const frame = ctx.getImageData(0, 0, width, height);
          const data = frame.data;

          if (!sampledKey) {
            // Sample top-left pixel to detect green screen or solid black/white backdrop
            const r0 = data[0];
            const g0 = data[1];
            const b0 = data[2];
            const isGreenScreen = g0 > 120 && g0 > r0 * 1.35 && g0 > b0 * 1.35;
            const isSolidDark = r0 < 24 && g0 < 24 && b0 < 24;
            const isSolidWhite = r0 > 235 && g0 > 235 && b0 > 235;
            if (isGreenScreen || isSolidDark || isSolidWhite) {
              keyR = r0;
              keyG = g0;
              keyB = b0;
            }
            sampledKey = true;
          }

          const isGreenKey = keyG > 120 && keyG > keyR * 1.3 && keyG > keyB * 1.3;
          const isDarkKey = keyR < 26 && keyG < 26 && keyB < 26;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (isGreenKey) {
              const greenDom = g - Math.max(r, b);
              if (greenDom > 55 && g > 90) {
                data[i + 3] = 0;
              } else if (greenDom > 24 && g > 70) {
                data[i + 3] = Math.round(data[i + 3] * Math.max(0, 1 - (greenDom - 24) / 36));
                data[i + 1] = Math.min(g, Math.max(r, b));
              }
            } else if (isDarkKey) {
              const lum = r * 0.299 + g * 0.587 + b * 0.114;
              if (lum < 18) {
                data[i + 3] = 0;
              } else if (lum < 42) {
                data[i + 3] = Math.round(((lum - 18) / 24) * data[i + 3]);
              }
            } else {
              const dist = Math.abs(r - keyR) + Math.abs(g - keyG) + Math.abs(b - keyB);
              if (dist < 65) {
                data[i + 3] = 0;
              } else if (dist < 110) {
                data[i + 3] = Math.round(((dist - 65) / 45) * data[i + 3]);
              }
            }
          }

          ctx.putImageData(frame, 0, 0);
        } catch {
          // Cross-origin video security error -> fallback safely
          setFallbackRaw(true);
          return;
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    void video.play().catch(() => {});
    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [src, width, height]);

  return (
    <div style={{ width, height }} className={`relative shrink-0 select-none ${className}`}>
      <video
        ref={videoRef}
        src={src}
        crossOrigin="anonymous"
        autoPlay
        loop
        muted
        playsInline
        className={
          fallbackRaw
            ? 'h-full w-full rounded-xl bg-transparent object-contain mix-blend-screen'
            : 'pointer-events-none absolute h-0 w-0 opacity-0'
        }
      />
      {!fallbackRaw && (
        <canvas
          ref={canvasRef}
          style={{ width, height }}
          className="h-full w-full rounded-xl bg-transparent object-contain"
        />
      )}
    </div>
  );
};

interface GiftArtworkProps {
  giftId: GiftId;
  gift?: VirtualGift;
  size?: number;
  className?: string;
}

export const GiftArtwork: React.FC<GiftArtworkProps> = ({
  gift,
  size = 64,
  className = '',
}) => {
  if (gift?.customVideoUrl) {
    return (
      <ChromaKeyVideo
        src={gift.customVideoUrl}
        width={size}
        height={size}
        className={className}
      />
    );
  }
  if (gift?.customArtworkUrl) {
    return (
      <img
        src={gift.customArtworkUrl}
        alt={gift.name}
        style={{ height: size, width: size }}
        className={`shrink-0 rounded-xl bg-transparent object-contain select-none ${className}`}
        draggable={false}
      />
    );
  }
  return (
    <div
      style={{
        height: size,
        width: size,
        background: gift
          ? `linear-gradient(135deg, ${gift.primaryColor}33, ${gift.secondaryColor}33)`
          : 'rgba(6, 182, 212, 0.16)',
        borderColor: gift?.primaryColor || 'rgba(34, 211, 238, 0.45)',
      }}
      className={`flex shrink-0 items-center justify-center rounded-xl border select-none ${className}`}
    >
      <Gift
        style={{
          height: Math.round(size * 0.52),
          width: Math.round(size * 0.52),
          color: gift?.secondaryColor || '#22D3EE',
        }}
      />
    </div>
  );
};
