import React, { useEffect, useRef } from 'react';

interface AmbientCanvasProps {
  ambiance: 'saffron' | 'emerald' | 'indigo' | 'crimson';
  energy?: number;
}

interface SoftOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  useSecondary: boolean;
}

const PALETTES: Record<
  AmbientCanvasProps['ambiance'],
  { primary: [number, number, number]; secondary: [number, number, number]; glow: string }
> = {
  saffron: {
    primary: [139, 92, 246],
    secondary: [192, 132, 252],
    glow: 'rgba(139, 92, 246, 0.14)',
  },
  emerald: {
    primary: [16, 185, 129],
    secondary: [99, 102, 241],
    glow: 'rgba(16, 185, 129, 0.12)',
  },
  indigo: {
    primary: [124, 58, 237],
    secondary: [56, 189, 248],
    glow: 'rgba(124, 58, 237, 0.14)',
  },
  crimson: {
    primary: [225, 29, 72],
    secondary: [168, 85, 247],
    glow: 'rgba(225, 29, 72, 0.12)',
  },
};

export const AmbientCanvas: React.FC<AmbientCanvasProps> = ({ ambiance, energy = 0.35 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const energyRef = useRef(energy);
  energyRef.current = energy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // Calm, smooth low-distraction floating ambient orbs (zero concentric K8 rings or mesh lines)
    const orbs: SoftOrb[] = Array.from({ length: 14 }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.08 - Math.random() * 0.14,
      radius: 42 + Math.random() * 88,
      alpha: 0.035 + Math.random() * 0.035,
      phase: idx * 0.7,
      useSecondary: idx % 2 === 1,
    }));

    let time = 0;
    const render = () => {
      time += 0.008;
      const palette = PALETTES[ambiance];
      const [pr, pg, pb] = palette.primary;
      const [sr, sg, sb] = palette.secondary;
      const isLightMode =
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('ogv-theme-light');

      ctx.clearRect(0, 0, width, height);

      // Clean smooth base wash matching active Light/Dark theme
      const baseGrad = ctx.createLinearGradient(0, 0, width * 0.4, height);
      if (isLightMode) {
        baseGrad.addColorStop(0, '#EEF2FF');
        baseGrad.addColorStop(0.5, '#F5F7FF');
        baseGrad.addColorStop(1, '#EDE9FE');
      } else {
        baseGrad.addColorStop(0, '#130E24');
        baseGrad.addColorStop(0.5, '#0B0E1D');
        baseGrad.addColorStop(1, '#070912');
      }
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // Gentle slow breathing radial glow (understated, never glaring)
      const cx = width * (0.48 + Math.sin(time * 0.45) * 0.08);
      const cy = height * (0.24 + Math.cos(time * 0.35) * 0.05);
      const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.65);
      halo.addColorStop(
        0,
        isLightMode ? `rgba(${pr}, ${pg}, ${pb}, 0.09)` : palette.glow
      );
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // Smooth drifting ambient clouds
      const speedFactor = 0.75 + energyRef.current * 0.35;
      for (const orb of orbs) {
        if (!prefersReduced) {
          orb.x += (orb.vx + Math.sin(time * 0.5 + orb.phase) * 0.08) * speedFactor;
          orb.y += orb.vy * speedFactor;
          if (orb.y < -orb.radius * 1.5) {
            orb.y = height + orb.radius * 1.5;
            orb.x = Math.random() * width;
          }
          if (orb.x < -orb.radius * 1.5) orb.x = width + orb.radius * 1.5;
          if (orb.x > width + orb.radius * 1.5) orb.x = -orb.radius * 1.5;
        }

        const [r, g, b] = orb.useSecondary ? [sr, sg, sb] : [pr, pg, pb];
        const pulse = 0.8 + 0.2 * Math.sin(time + orb.phase);
        const alpha = (isLightMode ? orb.alpha * 0.75 : orb.alpha) * pulse;
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(4)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReduced) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [ambiance]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
};
