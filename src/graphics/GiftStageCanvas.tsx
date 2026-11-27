import React, { useEffect, useRef } from 'react';
import type { ActiveGiftEvent, SupportRingEvent } from '../types';
import { ChromaKeyVideo, GiftArtwork } from './GiftArtwork';
import { RingSpriteArt } from './SpriteArtwork';

interface GiftStageCanvasProps {
  activeEvent: ActiveGiftEvent | null;
  supportRingEvent?: SupportRingEvent | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  angle: number;
  spin: number;
  shape: 'circle' | 'spark' | 'petal' | 'heart' | 'streak';
}

export const GiftStageCanvas: React.FC<GiftStageCanvasProps> = ({
  activeEvent,
  supportRingEvent = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Only animate background canvas rings/particles for Ring Support Blessing (no background animation for gifts)
    if (!supportRingEvent || activeEvent) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = width * 0.5;
    const cy = height * 0.44;
    const gift = {
      rarity: 'Mythic' as const,
      primaryColor: '#F472B6',
      secondaryColor: '#FACC15',
      particleStyle: 'heart' as const,
    };
    const count = 90;
    const colors = [gift.primaryColor, gift.secondaryColor, '#FFFFFF', '#FDE68A'];

    const particles: Particle[] = Array.from({ length: count }, (_, idx) => {
      const angle = (idx / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const speed = 2.5 + Math.random() * 7.5;
      const shape: Particle['shape'] = idx % 2 === 0 ? 'heart' : 'spark';

      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.4,
        size: 3 + Math.random() * 5.2,
        alpha: 1,
        decay: 0.008 + Math.random() * 0.01,
        color: colors[idx % colors.length],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.14,
        shape,
      };
    });

    let frame = 0;
    let rafId = 0;

    const animate = () => {
      frame += 1;
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      if (frame < 70) {
        const ringProgress = frame / 70;
        const ringRadius = 40 + ringProgress * Math.min(width, height) * 0.42;
        ctx.strokeStyle = gift.primaryColor;
        ctx.globalAlpha = (1 - ringProgress) * 0.6;
        ctx.lineWidth = 3 * (1 - ringProgress) + 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      let aliveCount = 0;
      for (const p of particles) {
        if (p.alpha <= 0.01) continue;
        aliveCount += 1;

        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        p.vy -= 0.035;
        p.vx *= 0.99;

        p.alpha -= p.decay;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        if (p.shape === 'heart') {
          const s = p.size * 0.65;
          ctx.beginPath();
          ctx.moveTo(0, s);
          ctx.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.9, -s * 1.5, 0, -s * 0.6);
          ctx.bezierCurveTo(s * 0.9, -s * 1.5, s * 1.6, -s * 0.2, 0, s);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.5);
          ctx.lineTo(p.size * 0.4, 0);
          ctx.lineTo(0, p.size * 1.5);
          ctx.lineTo(-p.size * 0.4, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();

      if (aliveCount > 0 && frame < 180) {
        rafId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [activeEvent, supportRingEvent]);

  if (!activeEvent && !supportRingEvent) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {!activeEvent && supportRingEvent && (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      )}
      {activeEvent ? (
        <div
          key={activeEvent.eventId}
          className="relative flex flex-col items-center gap-3 rounded-3xl border border-cyan-400/35 bg-[#0D1526]/95 px-8 py-6 text-center shadow-2xl"
        >
          {activeEvent.gift.customVideoUrl ? (
            <ChromaKeyVideo
              src={activeEvent.gift.customVideoUrl}
              width={180}
              height={180}
              className="drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]"
            />
          ) : (
            <GiftArtwork giftId={activeEvent.gift.id} gift={activeEvent.gift} size={110} />
          )}
          <div>
            <p className="text-xs font-medium tracking-wide text-cyan-300">
              {activeEvent.gift.rarity} Gift Spectacle
            </p>
            <h3 className="font-display mt-0.5 text-3xl font-bold text-white">
              {activeEvent.gift.name}
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              <span className="font-semibold text-white">{activeEvent.senderName}</span> sent to{' '}
              <span className="font-semibold text-amber-300">{activeEvent.recipientName}</span>
            </p>
            {(activeEvent.charmEarned || activeEvent.randomCoinsEarned) && (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2.5 font-mono-tabular text-xs font-bold">
                {activeEvent.charmEarned ? (
                  <span className="rounded-lg border border-rose-400/35 bg-rose-500/15 px-2.5 py-1 text-rose-300">
                    +{activeEvent.charmEarned.toLocaleString()} Charm
                  </span>
                ) : null}
                {activeEvent.randomCoinsEarned ? (
                  <span className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-amber-300">
                    +{activeEvent.randomCoinsEarned.toLocaleString()} Random Coins
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : supportRingEvent ? (
        <div
          key={supportRingEvent.eventId}
          className="animate-bounce-in relative flex flex-col items-center gap-3 rounded-3xl border border-cyan-400/50 bg-gradient-to-b from-[#132038]/95 via-[#0D1526]/95 to-[#070B14]/95 px-8 py-6 text-center shadow-[0_0_50px_rgba(34,211,238,0.45)]"
        >
          <div className="relative flex items-center justify-center">
            <span
              className="absolute h-28 w-28 animate-ping rounded-full border-2 border-amber-300/60"
              aria-hidden="true"
            />
            <span
              className="absolute h-24 w-24 animate-spin rounded-full border-2 border-dashed border-pink-400/75"
              style={{ animationDuration: '4s' }}
              aria-hidden="true"
            />
            <div className="relative z-10 animate-pulse drop-shadow-[0_0_24px_rgba(251,191,36,0.85)]">
              <RingSpriteArt
                ringNumber={supportRingEvent.ringNumber}
                size={96}
                alt={supportRingEvent.ringName}
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-extrabold tracking-widest text-pink-300 uppercase">
              Ring Blessing Support
            </p>
            <h3 className="font-display mt-0.5 text-2xl font-black text-amber-200">
              {supportRingEvent.ringName}
            </h3>
            <p className="mt-1 text-sm text-slate-200">
              <span className="font-bold text-white">{supportRingEvent.senderName}</span> supported{' '}
              <span className="font-bold text-pink-300">{supportRingEvent.recipientName}</span>
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-pink-400/45 bg-pink-500/20 px-3 py-1 font-mono-tabular text-xs font-extrabold text-pink-200">
              <span>♡ +{supportRingEvent.blessingAdded.toLocaleString()} Blessing</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
