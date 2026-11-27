import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Dices,
  Maximize2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  ShieldAlert,
  Target,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import carromCoverImg from '../assets/images/game_cover_carrom_1795082843964.jpg';
import ludoCoverImg from '../assets/images/game_cover_ludo_1795771427952.jpg';
import poolCoverImg from '../assets/images/game_cover_pool_1795082844449.jpg';
import racingCoverImg from '../assets/images/game_cover_racing_1795082843175.jpg';
import { USER_PROFILE } from '../data/zayroData';
import { AvatarArt } from '../graphics/AvatarArt';
import { ZayroCoinArt } from '../graphics/SpriteArtwork';
import type { AvatarConfig, FriendRecord, GameVoicePeer } from '../types';
import { ogRealtime } from '../utils/realtimeClient';
import { soundFx } from '../utils/soundFx';

interface GamesSectionProps {
  friends?: FriendRecord[];
  currentUserUid?: string;
  currentUserName?: string;
  authToken?: string | null;
  onInviteFriend?: (friend: FriendRecord, gameTitle: string) => void;
  onEarnCoins: (amount: number, reason: string) => void;
}

type GameId = 'carrom' | 'pool' | 'racing' | 'ludo';
type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

interface SquadPlayer {
  id: string;
  name: string;
  color: string;
}

const SQUAD_COLORS = ['#F59E0B', '#38BDF8', '#EC4899', '#34D399'];

const ARENA_BACKGROUNDS: Record<GameId, string> = {
  carrom:
    'radial-gradient(circle at 20% 18%, rgba(245,158,11,0.28) 0%, transparent 45%), radial-gradient(circle at 82% 80%, rgba(99,102,241,0.28) 0%, transparent 48%), linear-gradient(160deg, #0D1024 0%, #1B1436 52%, #070B14 100%)',
  pool:
    'radial-gradient(circle at 22% 20%, rgba(14,165,233,0.28) 0%, transparent 45%), radial-gradient(circle at 80% 78%, rgba(16,185,129,0.24) 0%, transparent 48%), linear-gradient(160deg, #061726 0%, #0A2538 52%, #050C14 100%)',
  racing:
    'radial-gradient(circle at 50% 15%, rgba(236,72,153,0.32) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(34,211,238,0.25) 0%, transparent 45%), linear-gradient(160deg, #130728 0%, #240B3B 50%, #070B14 100%)',
  ludo:
    'radial-gradient(circle at 20% 25%, rgba(245,158,11,0.26) 0%, transparent 45%), radial-gradient(circle at 82% 75%, rgba(16,185,129,0.24) 0%, transparent 48%), linear-gradient(160deg, #0E172A 0%, #1A1236 52%, #070B14 100%)',
};

const GameStartOverlay: React.FC<{
  title: string;
  rule: string;
  accentClass: string;
  realPlayerCount?: number;
  onInviteFriends?: () => void;
  onStart: () => void;
}> = ({ title, rule, accentClass, realPlayerCount = 2, onInviteFriends, onStart }) => {
  const needsMorePlayers = realPlayerCount < 2;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060913]/85 p-5 text-center backdrop-blur-sm">
      <div className="font-display text-xl font-black text-white">{title}</div>
      <p className="mt-1.5 max-w-xs text-xs text-slate-300">{rule}</p>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1 text-[10px] font-bold text-amber-200">
        <span>Rewards: Winner +2,500 Coins · Participant +500 Coins</span>
      </div>
      {needsMorePlayers ? (
        <div className="mt-4 space-y-2.5">
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[11px] font-semibold text-rose-200">
            Invite at least 1 real friend to start a live multiplayer match (AI bots disabled).
          </div>
          {onInviteFriends && (
            <button
              type="button"
              onClick={onInviteFriends}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-2 text-xs font-black text-slate-950 shadow-lg hover:brightness-110"
            >
              <UserPlus className="h-4 w-4" />
              <span>Invite Real Friend</span>
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onStart}
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-black text-slate-950 shadow-xl transition-transform hover:scale-105 ${accentClass}`}
        >
          <Play className="h-4 w-4 fill-slate-950" />
          <span>Start Match ({realPlayerCount} Real Players)</span>
        </button>
      )}
    </div>
  );
};

const GameOutcomeOverlay: React.FC<{
  phase: 'won' | 'lost';
  headline: string;
  detail: string;
  onRetry: () => void;
}> = ({ phase, headline, detail, onRetry }) => (
  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060913]/88 p-5 text-center backdrop-blur-sm">
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
        phase === 'won'
          ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
          : 'border-rose-400/50 bg-rose-500/20 text-rose-300'
      }`}
    >
      {phase === 'won' ? <Trophy className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
    </div>
    <div
      className={`font-display mt-2.5 text-2xl font-black ${
        phase === 'won' ? 'text-emerald-300' : 'text-rose-400'
      }`}
    >
      {headline}
    </div>
    <p className="mt-1 max-w-xs text-xs text-slate-200">{detail}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-6 py-2.5 text-xs font-black text-slate-950 shadow-lg hover:brightness-110"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      <span>Retry</span>
    </button>
  </div>
);

// ============================================================
// 1. MULTIPLAYER CARROM BOARD (2-4 Players + Win/Loss)
// ============================================================
interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: 'white' | 'black' | 'queen' | 'striker';
  pocketed: boolean;
}

const CarromBoardGame: React.FC<{
  players: SquadPlayer[];
  onInviteFriends?: () => void;
  onReward: (coins: number, msg: string) => void;
}> = ({ players, onInviteFriends, onReward }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const discsRef = useRef<Disc[]>([]);
  const draggingRef = useRef(false);
  const dragEndRef = useRef<{ x: number; y: number } | null>(null);
  const strikerPosRef = useRef<number>(210);
  const shotPendingRef = useRef(false);
  const pocketedOnTurnRef = useRef(false);
  const turnRef = useRef(0);
  const phaseRef = useRef<GamePhase>('idle');
  const foulsRef = useRef(0);
  const scoreTotalRef = useRef(0);
  const onRewardRef = useRef(onReward);

  useEffect(() => {
    onRewardRef.current = onReward;
  }, [onReward]);

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [fouls, setFouls] = useState(0);
  const [turnIdx, setTurnIdx] = useState(0);
  const [scores, setScores] = useState<number[]>(() => players.map(() => 0));
  const [status, setStatus] = useState('Press Start to launch your Carrom match!');
  const [strikerX, setStrikerX] = useState(210);

  const SIZE = 420;
  const PAD = 34;
  const TARGET_SCORE = 60;
  const MAX_FOULS = 3;

  const setupBoard = (nextPhase: GamePhase) => {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const pieces: Disc[] = [
      { x: cx, y: cy, vx: 0, vy: 0, r: 10, color: 'queen', pocketed: false },
    ];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      pieces.push({
        x: cx + Math.cos(a) * 22,
        y: cy + Math.sin(a) * 22,
        vx: 0,
        vy: 0,
        r: 10,
        color: i % 2 === 0 ? 'white' : 'black',
        pocketed: false,
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      pieces.push({
        x: cx + Math.cos(a) * 43,
        y: cy + Math.sin(a) * 43,
        vx: 0,
        vy: 0,
        r: 10,
        color: i % 2 === 0 ? 'black' : 'white',
        pocketed: false,
      });
    }
    pieces.push({
      x: 210,
      y: SIZE - 76,
      vx: 0,
      vy: 0,
      r: 13,
      color: 'striker',
      pocketed: false,
    });
    discsRef.current = pieces;
    strikerPosRef.current = 210;
    shotPendingRef.current = false;
    pocketedOnTurnRef.current = false;
    turnRef.current = 0;
    foulsRef.current = 0;
    scoreTotalRef.current = 0;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    setFouls(0);
    setTurnIdx(0);
    setStrikerX(210);
    setScores(players.map(() => 0));
    setStatus(
      nextPhase === 'playing'
        ? `Turn: ${players[0]?.name} · Drag striker to shoot (Target ${TARGET_SCORE} pts)!`
        : 'Press Start to launch your Carrom match!'
    );
  };

  useEffect(() => {
    setupBoard('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const pockets = [
      { x: PAD + 14, y: PAD + 14 },
      { x: SIZE - PAD - 14, y: PAD + 14 },
      { x: PAD + 14, y: SIZE - PAD - 14 },
      { x: SIZE - PAD - 14, y: SIZE - PAD - 14 },
    ];

    const step = () => {
      const discs = discsRef.current;
      let anyMoving = false;

      if (phaseRef.current === 'playing') {
        for (const d of discs) {
          if (d.pocketed) continue;
          d.x += d.vx;
          d.y += d.vy;
          d.vx *= 0.982;
          d.vy *= 0.982;
          if (Math.hypot(d.vx, d.vy) < 0.08) {
            d.vx = 0;
            d.vy = 0;
          } else {
            anyMoving = true;
          }

          const minB = PAD + d.r;
          const maxB = SIZE - PAD - d.r;
          if (d.x < minB) {
            d.x = minB;
            d.vx = Math.abs(d.vx) * 0.85;
          } else if (d.x > maxB) {
            d.x = maxB;
            d.vx = -Math.abs(d.vx) * 0.85;
          }
          if (d.y < minB) {
            d.y = minB;
            d.vy = Math.abs(d.vy) * 0.85;
          } else if (d.y > maxB) {
            d.y = maxB;
            d.vy = -Math.abs(d.vy) * 0.85;
          }

          for (const p of pockets) {
            if (Math.hypot(d.x - p.x, d.y - p.y) < 16) {
              if (d.color === 'striker') {
                d.vx = 0;
                d.vy = 0;
                d.x = strikerPosRef.current;
                d.y = SIZE - 76;
                pocketedOnTurnRef.current = false;
                foulsRef.current += 1;
                setFouls(foulsRef.current);
                setStatus(
                  `${players[turnRef.current]?.name || 'Player'} striker foul (${foulsRef.current}/${MAX_FOULS})!`
                );
              } else {
                d.pocketed = true;
                d.vx = 0;
                d.vy = 0;
                pocketedOnTurnRef.current = true;
                const pts = d.color === 'queen' ? 50 : d.color === 'white' ? 20 : 10;
                const activeIdx = turnRef.current;
                scoreTotalRef.current += pts;
                setScores((prev) => prev.map((sc, i) => (i === activeIdx ? sc + pts : sc)));
                onRewardRef.current(
                  pts * 10,
                  `${players[activeIdx]?.name || 'Player'} pocketed ${d.color} (+${pts * 10} Coins)`
                );
                soundFx.playVictory();
                setStatus(`${players[activeIdx]?.name || 'Player'} pocketed ${d.color.toUpperCase()} (+${pts} pts)!`);
                if (scoreTotalRef.current >= TARGET_SCORE) {
                  phaseRef.current = 'won';
                  setPhase('won');
                  onRewardRef.current(2500, 'Carrom Match Victory Bonus (+2,500 Winner / +500 Participant)');
                }
              }
            }
          }
        }

        for (let i = 0; i < discs.length; i++) {
          for (let j = i + 1; j < discs.length; j++) {
            const a = discs[i];
            const b = discs[j];
            if (a.pocketed || b.pocketed) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r;
            if (dist > 0 && dist < minDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (minDist - dist) * 0.5;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              b.x += nx * overlap;
              b.y += ny * overlap;

              const dvx = a.vx - b.vx;
              const dvy = a.vy - b.vy;
              const impact = dvx * nx + dvy * ny;
              if (impact > 0) {
                a.vx -= impact * nx * 0.92;
                a.vy -= impact * ny * 0.92;
                b.vx += impact * nx * 0.92;
                b.vy += impact * ny * 0.92;
              }
            }
          }
        }

        const striker = discs.find((d) => d.color === 'striker');
        if (!anyMoving && striker && !draggingRef.current) {
          if (Math.abs(striker.y - (SIZE - 76)) > 2) {
            striker.x = strikerPosRef.current;
            striker.y = SIZE - 76;
          }
          if (shotPendingRef.current) {
            shotPendingRef.current = false;
            if (foulsRef.current >= MAX_FOULS && phaseRef.current === 'playing') {
              phaseRef.current = 'lost';
              setPhase('lost');
              setStatus(`Too many fouls (${MAX_FOULS}/${MAX_FOULS})! Press Retry for a fresh board.`);
            } else if (!pocketedOnTurnRef.current) {
              const nextTurn = (turnRef.current + 1) % players.length;
              turnRef.current = nextTurn;
              setTurnIdx(nextTurn);
              setStatus(`Turn: ${players[nextTurn]?.name} · Drag striker to shoot!`);
            }
            pocketedOnTurnRef.current = false;
          }
        }
      }

      // Refreshed Midnight Indigo & Royal Gold Outer Frame
      const frameGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      frameGrad.addColorStop(0, '#1E1B4B');
      frameGrad.addColorStop(0.5, '#312E81');
      frameGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = frameGrad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(10, 10, SIZE - 20, SIZE - 20);
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(PAD - 2, PAD - 2, SIZE - 2 * PAD + 4, SIZE - 2 * PAD + 4);

      const woodGrad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 24, SIZE / 2, SIZE / 2, SIZE * 0.7);
      woodGrad.addColorStop(0, '#FEF3C7');
      woodGrad.addColorStop(0.55, '#FDE68A');
      woodGrad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = woodGrad;
      ctx.fillRect(PAD, PAD, SIZE - 2 * PAD, SIZE - 2 * PAD);

      ctx.strokeStyle = 'rgba(180, 83, 9, 0.09)';
      ctx.lineWidth = 1;
      for (let y = PAD + 6; y < SIZE - PAD; y += 9) {
        ctx.beginPath();
        ctx.moveTo(PAD, y);
        ctx.lineTo(SIZE - PAD, y);
        ctx.stroke();
      }

      const drawBaseline = (x1: number, y1: number, x2: number, y2: number, vertical: boolean) => {
        ctx.strokeStyle = '#1E1B4B';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(x1 - 5, y1);
          ctx.lineTo(x2 - 5, y2);
          ctx.moveTo(x1 + 5, y1);
          ctx.lineTo(x2 + 5, y2);
        } else {
          ctx.moveTo(x1, y1 - 5);
          ctx.lineTo(x2, y2 - 5);
          ctx.moveTo(x1, y1 + 5);
          ctx.lineTo(x2, y2 + 5);
        }
        ctx.stroke();
        for (const [ex, ey] of [
          [x1, y1],
          [x2, y2],
        ]) {
          ctx.fillStyle = '#E11D48';
          ctx.beginPath();
          ctx.arc(ex, ey, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };

      drawBaseline(104, PAD + 42, SIZE - 104, PAD + 42, false);
      drawBaseline(104, SIZE - PAD - 42, SIZE - 104, SIZE - PAD - 42, false);
      drawBaseline(PAD + 42, 104, PAD + 42, SIZE - 104, true);
      drawBaseline(SIZE - PAD - 42, 104, SIZE - PAD - 42, SIZE - 104, true);

      ctx.strokeStyle = '#1E1B4B';
      ctx.lineWidth = 1.2;
      const arrows = [
        [124, 124, 72, 72],
        [SIZE - 124, 124, SIZE - 72, 72],
        [124, SIZE - 124, 72, SIZE - 72],
        [SIZE - 124, SIZE - 124, SIZE - 72, SIZE - 72],
      ];
      for (const [ax, ay, bx, by] of arrows) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ax, ay, 11, 0, Math.PI * 2);
        ctx.stroke();
      }

      const cx = SIZE / 2;
      const cy = SIZE / 2;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i * Math.PI) / 4);
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(7, -19, 0, -32);
        ctx.quadraticCurveTo(-7, -19, 0, -4);
        ctx.fill();
        ctx.restore();
      }

      for (const p of pockets) {
        const pocketGrad = ctx.createRadialGradient(p.x, p.y, 3, p.x, p.y, 17);
        pocketGrad.addColorStop(0, '#020203');
        pocketGrad.addColorStop(0.8, '#09090B');
        pocketGrad.addColorStop(1, '#27272A');
        ctx.fillStyle = pocketGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      const striker = discs.find((d) => d.color === 'striker');
      if (draggingRef.current && dragEndRef.current && striker) {
        const dx = striker.x - dragEndRef.current.x;
        const dy = striker.y - dragEndRef.current.y;
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(striker.x + dx * 2.2, striker.y + dy * 2.2);
        ctx.stroke();
        ctx.restore();
      }

      for (const d of discs) {
        if (d.pocketed) continue;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.48)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2.5;

        const dg = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 1, d.x, d.y, d.r);
        if (d.color === 'white') {
          dg.addColorStop(0, '#FFFFFF');
          dg.addColorStop(0.65, '#E0F2FE');
          dg.addColorStop(1, '#0284C7');
          ctx.strokeStyle = '#0369A1';
        } else if (d.color === 'black') {
          dg.addColorStop(0, '#6B7280');
          dg.addColorStop(0.55, '#1F2937');
          dg.addColorStop(1, '#09090B');
          ctx.strokeStyle = '#9CA3AF';
        } else if (d.color === 'queen') {
          dg.addColorStop(0, '#FDA4AF');
          dg.addColorStop(0.5, '#E11D48');
          dg.addColorStop(1, '#881337');
          ctx.strokeStyle = '#FDE047';
        } else {
          const strikerHex = players[turnRef.current]?.color || '#F59E0B';
          dg.addColorStop(0, '#FEF9C3');
          dg.addColorStop(0.55, strikerHex);
          dg.addColorStop(1, '#92400E');
          ctx.strokeStyle = '#FEF08A';
        }
        ctx.fillStyle = dg;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = d.color === 'striker' ? 2.5 : 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [players]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'playing') return;
    const pt = getCanvasPoint(e);
    const striker = discsRef.current.find((d) => d.color === 'striker');
    if (!striker) return;
    if (Math.hypot(pt.x - striker.x, pt.y - striker.y) < 36) {
      draggingRef.current = true;
      dragEndRef.current = pt;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    dragEndRef.current = getCanvasPoint(e);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current || !dragEndRef.current) return;
    const striker = discsRef.current.find((d) => d.color === 'striker');
    if (striker && phaseRef.current === 'playing') {
      const dx = striker.x - dragEndRef.current.x;
      const dy = striker.y - dragEndRef.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const power = Math.min(18, dist * 0.24);
        striker.vx = (dx / dist) * power;
        striker.vy = (dy / dist) * power;
        shotPendingRef.current = true;
        pocketedOnTurnRef.current = false;
        soundFx.playMove();
      }
    }
    draggingRef.current = false;
    dragEndRef.current = null;
  };

  const totalScore = scores.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {players.map((pl, idx) => {
          const isTurn = idx === turnIdx;
          return (
            <div
              key={pl.id}
              className={`flex items-center justify-between rounded-xl border px-3 py-1.5 text-xs ${
                isTurn
                  ? 'border-amber-400 bg-amber-500/15 text-white'
                  : 'border-white/10 bg-[#070B14] text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: pl.color }} />
                <span className="truncate font-bold">{pl.name}</span>
              </div>
              <span className="font-mono-tabular font-extrabold text-amber-300">{scores[idx] ?? 0}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#070B14]/85 px-3 py-2 text-xs font-bold">
        <span className="text-amber-300">
          Target: {totalScore}/{TARGET_SCORE} pts
        </span>
        <span className={fouls >= 2 ? 'text-rose-400' : 'text-slate-300'}>
          Fouls: {fouls}/{MAX_FOULS}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-amber-300">{status}</div>
        <button
          type="button"
          onClick={() => setupBoard('playing')}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/20"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      </div>

      <div className="relative mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-indigo-400/45 shadow-[0_18px_50px_rgba(0,0,0,0.75)]">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="h-auto w-full touch-none select-none"
        />
        {phase === 'idle' && (
          <GameStartOverlay
            title="Carrom Strike Arena"
            rule={`Score ${TARGET_SCORE} points to win! Avoid ${MAX_FOULS} striker pocket fouls.`}
            accentClass="bg-gradient-to-r from-amber-400 to-yellow-300"
            realPlayerCount={players.length}
            onInviteFriends={onInviteFriends}
            onStart={() => setupBoard('playing')}
          />
        )}
        {(phase === 'won' || phase === 'lost') && (
          <GameOutcomeOverlay
            phase={phase}
            headline={phase === 'won' ? 'VICTORY!' : 'GAME OVER'}
            detail={
              phase === 'won'
                ? `Squad cleared ${totalScore} Carrom points! (+2,500 Winner / +500 Participant Coins)`
                : `Game over after ${MAX_FOULS} striker fouls at ${totalScore}/${TARGET_SCORE} points.`
            }
            onRetry={() => setupBoard('playing')}
          />
        )}
      </div>

      <div className="mx-auto flex max-w-[340px] items-center gap-3 px-2">
        <span className="text-[11px] font-semibold text-slate-400">Position</span>
        <input
          type="range"
          min={110}
          max={310}
          value={strikerX}
          disabled={phase !== 'playing'}
          onChange={(e) => {
            const val = Number(e.target.value);
            setStrikerX(val);
            strikerPosRef.current = val;
            const striker = discsRef.current.find((d) => d.color === 'striker');
            if (striker && striker.vx === 0 && striker.vy === 0) {
              striker.x = val;
              striker.y = SIZE - 76;
            }
          }}
          className="flex-1 accent-amber-400 disabled:opacity-40"
        />
      </div>
    </div>
  );
};

// ============================================================
// 2. MULTIPLAYER 8-BALL POOL TABLE (Sapphire Cloth + Win/Loss)
// ============================================================
const EightBallPoolGame: React.FC<{
  players: SquadPlayer[];
  onInviteFriends?: () => void;
  onReward: (coins: number, msg: string) => void;
}> = ({ players, onInviteFriends, onReward }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<
    Array<{ x: number; y: number; vx: number; vy: number; num: number; color: string; pocketed: boolean }>
  >([]);
  const draggingRef = useRef(false);
  const dragPtRef = useRef<{ x: number; y: number } | null>(null);
  const shotPendingRef = useRef(false);
  const pocketedOnTurnRef = useRef(false);
  const turnRef = useRef(0);
  const phaseRef = useRef<GamePhase>('idle');
  const scratchesRef = useRef(0);
  const totalPocketsRef = useRef(0);
  const onRewardRef = useRef(onReward);

  useEffect(() => {
    onRewardRef.current = onReward;
  }, [onReward]);

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [scratches, setScratches] = useState(0);
  const [turnIdx, setTurnIdx] = useState(0);
  const [playerPockets, setPlayerPockets] = useState<number[]>(() => players.map(() => 0));
  const [poolMsg, setPoolMsg] = useState('Press Start to rack the Sapphire Pool Table!');

  const W = 440;
  const H = 260;
  const RAIL = 22;
  const TARGET_BALLS = 4;
  const MAX_SCRATCHES = 3;

  const initPool = (nextPhase: GamePhase) => {
    const rackColors = ['#FACC15', '#2563EB', '#DC2626', '#7C3AED', '#F97316', '#16A34A', '#111827'];
    const balls: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      num: number;
      color: string;
      pocketed: boolean;
    }> = [{ x: 115, y: H / 2, vx: 0, vy: 0, num: 0, color: '#F8FAFC', pocketed: false }];

    let idx = 1;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row <= col; row++) {
        balls.push({
          x: 290 + col * 18,
          y: H / 2 + (row - col / 2) * 20,
          vx: 0,
          vy: 0,
          num: idx,
          color: idx === 5 ? '#09090B' : rackColors[idx % rackColors.length],
          pocketed: false,
        });
        idx++;
      }
    }
    ballsRef.current = balls;
    shotPendingRef.current = false;
    pocketedOnTurnRef.current = false;
    turnRef.current = 0;
    scratchesRef.current = 0;
    totalPocketsRef.current = 0;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    setScratches(0);
    setTurnIdx(0);
    setPlayerPockets(players.map(() => 0));
    setPoolMsg(
      nextPhase === 'playing'
        ? `${players[0]?.name}'s Break · Pocket ${TARGET_BALLS} balls to clear the table!`
        : 'Press Start to rack the Sapphire Pool Table!'
    );
  };

  useEffect(() => {
    initPool('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pockets = [
      { x: RAIL + 4, y: RAIL + 4 },
      { x: W / 2, y: RAIL + 2 },
      { x: W - RAIL - 4, y: RAIL + 4 },
      { x: RAIL + 4, y: H - RAIL - 4 },
      { x: W / 2, y: H - RAIL - 2 },
      { x: W - RAIL - 4, y: H - RAIL - 4 },
    ];

    let raf = 0;
    const loop = () => {
      const balls = ballsRef.current;
      let anyMoving = false;
      if (phaseRef.current === 'playing') {
        for (const b of balls) {
          if (b.pocketed) continue;
          b.x += b.vx;
          b.y += b.vy;
          b.vx *= 0.985;
          b.vy *= 0.985;
          if (Math.hypot(b.vx, b.vy) < 0.08) {
            b.vx = 0;
            b.vy = 0;
          } else {
            anyMoving = true;
          }
          const r = 9;
          if (b.x < RAIL + r) {
            b.x = RAIL + r;
            b.vx = Math.abs(b.vx) * 0.85;
          } else if (b.x > W - RAIL - r) {
            b.x = W - RAIL - r;
            b.vx = -Math.abs(b.vx) * 0.85;
          }
          if (b.y < RAIL + r) {
            b.y = RAIL + r;
            b.vy = Math.abs(b.vy) * 0.85;
          } else if (b.y > H - RAIL - r) {
            b.y = H - RAIL - r;
            b.vy = -Math.abs(b.vy) * 0.85;
          }
          for (const p of pockets) {
            if (Math.hypot(b.x - p.x, b.y - p.y) < 14) {
              if (b.num === 0) {
                b.x = 115;
                b.y = H / 2;
                b.vx = 0;
                b.vy = 0;
                pocketedOnTurnRef.current = false;
                scratchesRef.current += 1;
                setScratches(scratchesRef.current);
                setPoolMsg(
                  `${players[turnRef.current]?.name} scratched cue ball (${scratchesRef.current}/${MAX_SCRATCHES})!`
                );
              } else {
                b.pocketed = true;
                b.vx = 0;
                b.vy = 0;
                pocketedOnTurnRef.current = true;
                totalPocketsRef.current += 1;
                const activeIdx = turnRef.current;
                setPlayerPockets((prev) => prev.map((c, i) => (i === activeIdx ? c + 1 : c)));
                onRewardRef.current(
                  250,
                  `${players[activeIdx]?.name} pocketed ball #${b.num} (+250 Coins)`
                );
                soundFx.playVictory();
                setPoolMsg(`${players[activeIdx]?.name} pocketed #${b.num}!`);
                if (totalPocketsRef.current >= TARGET_BALLS) {
                  phaseRef.current = 'won';
                  setPhase('won');
                  onRewardRef.current(2500, '8-Ball Pool Match Victory (+2,500 Winner / +500 Participant)');
                }
              }
            }
          }
        }

        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i];
            const b = balls[j];
            if (a.pocketed || b.pocketed) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < 18) {
              const nx = dx / dist;
              const ny = dy / dist;
              const ov = (18 - dist) * 0.5;
              a.x -= nx * ov;
              a.y -= ny * ov;
              b.x += nx * ov;
              b.y += ny * ov;
              const imp = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
              if (imp > 0) {
                a.vx -= imp * nx * 0.94;
                a.vy -= imp * ny * 0.94;
                b.vx += imp * nx * 0.94;
                b.vy += imp * ny * 0.94;
              }
            }
          }
        }

        if (!anyMoving && shotPendingRef.current && !draggingRef.current) {
          shotPendingRef.current = false;
          if (scratchesRef.current >= MAX_SCRATCHES && phaseRef.current === 'playing') {
            phaseRef.current = 'lost';
            setPhase('lost');
            setPoolMsg(`Too many scratches (${MAX_SCRATCHES}/${MAX_SCRATCHES})! Hit Retry to rack again.`);
          } else if (!pocketedOnTurnRef.current) {
            const next = (turnRef.current + 1) % players.length;
            turnRef.current = next;
            setTurnIdx(next);
            setPoolMsg(`Turn: ${players[next]?.name} · Aim & shoot!`);
          }
          pocketedOnTurnRef.current = false;
        }
      }

      // Refreshed Obsidian Titanium Rails + Ocean Sapphire Championship Felt
      const railGrad = ctx.createLinearGradient(0, 0, W, H);
      railGrad.addColorStop(0, '#0F172A');
      railGrad.addColorStop(0.5, '#1E293B');
      railGrad.addColorStop(1, '#090D18');
      ctx.fillStyle = railGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, W - 8, H - 8);

      ctx.fillStyle = '#E0F2FE';
      for (const sx of [95, 165, 275, 345]) {
        ctx.beginPath();
        ctx.arc(sx, 11, 2.2, 0, Math.PI * 2);
        ctx.arc(sx, H - 11, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      const feltGrad = ctx.createRadialGradient(W / 2, H / 2, 16, W / 2, H / 2, 235);
      feltGrad.addColorStop(0, '#0EA5E9');
      feltGrad.addColorStop(0.55, '#0369A1');
      feltGrad.addColorStop(1, '#082F49');
      ctx.fillStyle = feltGrad;
      ctx.fillRect(RAIL, RAIL, W - 2 * RAIL, H - 2 * RAIL);

      ctx.strokeStyle = 'rgba(255,255,255,0.24)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(115, RAIL);
      ctx.lineTo(115, H - RAIL);
      ctx.stroke();

      for (const p of pockets) {
        const pg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 13);
        pg.addColorStop(0, '#000000');
        pg.addColorStop(1, '#18181B');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      const cue = balls[0];
      if (draggingRef.current && dragPtRef.current && cue) {
        const dx = cue.x - dragPtRef.current.x;
        const dy = cue.y - dragPtRef.current.y;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cue.x, cue.y);
        ctx.lineTo(cue.x + dx * 2.4, cue.y + dy * 2.4);
        ctx.stroke();

        ctx.setLineDash([]);
        const stickGrad = ctx.createLinearGradient(
          dragPtRef.current.x,
          dragPtRef.current.y,
          dragPtRef.current.x - dx * 1.5,
          dragPtRef.current.y - dy * 1.5
        );
        stickGrad.addColorStop(0, '#F8FAFC');
        stickGrad.addColorStop(0.18, players[turnRef.current]?.color || '#38BDF8');
        stickGrad.addColorStop(1, '#0F172A');
        ctx.strokeStyle = stickGrad;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(dragPtRef.current.x, dragPtRef.current.y);
        ctx.lineTo(dragPtRef.current.x - dx * 1.5, dragPtRef.current.y - dy * 1.5);
        ctx.stroke();
        ctx.restore();
      }

      for (const b of balls) {
        if (b.pocketed) continue;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        const bg = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, 9.5);
        bg.addColorStop(0, '#FFFFFF');
        bg.addColorStop(0.28, b.color);
        bg.addColorStop(1, '#09090B');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
        ctx.fill();
        if (b.num > 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#09090B';
          ctx.font = 'bold 6.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(b.num), b.x, b.y + 0.4);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(b.x - 2.8, b.y - 2.8, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [players]);

  const ptOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  };

  const totalPocketed = playerPockets.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {players.map((pl, idx) => (
          <div
            key={pl.id}
            className={`flex items-center justify-between rounded-xl border px-3 py-1.5 text-xs ${
              idx === turnIdx
                ? 'border-sky-400 bg-sky-500/15 text-white'
                : 'border-white/10 bg-[#070B14] text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: pl.color }} />
              <span className="truncate font-bold">{pl.name}</span>
            </div>
            <span className="font-mono-tabular font-extrabold text-sky-300">
              {playerPockets[idx] ?? 0} balls
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#070B14]/85 px-3 py-2 text-xs font-bold">
        <span className="text-sky-300">
          Pocketed: {totalPocketed}/{TARGET_BALLS} balls
        </span>
        <span className={scratches >= 2 ? 'text-rose-400' : 'text-slate-300'}>
          Scratches: {scratches}/{MAX_SCRATCHES}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-sky-300">{poolMsg}</span>
        <button
          type="button"
          onClick={() => initPool('playing')}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/20"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      </div>

      <div className="relative mx-auto max-w-[540px] overflow-hidden rounded-2xl border border-sky-400/45 shadow-[0_18px_50px_rgba(0,0,0,0.75)]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={(e) => {
            if (phaseRef.current !== 'playing') return;
            const pt = ptOf(e);
            const cue = ballsRef.current[0];
            if (cue && Math.hypot(pt.x - cue.x, pt.y - cue.y) < 38) {
              draggingRef.current = true;
              dragPtRef.current = pt;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) dragPtRef.current = ptOf(e);
          }}
          onPointerUp={() => {
            const cue = ballsRef.current[0];
            if (draggingRef.current && dragPtRef.current && cue && phaseRef.current === 'playing') {
              const dx = cue.x - dragPtRef.current.x;
              const dy = cue.y - dragPtRef.current.y;
              const d = Math.hypot(dx, dy);
              if (d > 5) {
                const p = Math.min(18, d * 0.25);
                cue.vx = (dx / d) * p;
                cue.vy = (dy / d) * p;
                shotPendingRef.current = true;
                pocketedOnTurnRef.current = false;
                soundFx.playMove();
              }
            }
            draggingRef.current = false;
            dragPtRef.current = null;
          }}
          className="h-auto w-full touch-none select-none"
        />
        {phase === 'idle' && (
          <GameStartOverlay
            title="Sapphire 8-Ball Lounge"
            rule={`Pocket ${TARGET_BALLS} balls to win! Avoid scratching the cue ball ${MAX_SCRATCHES} times.`}
            accentClass="bg-gradient-to-r from-sky-400 to-cyan-300"
            realPlayerCount={players.length}
            onInviteFriends={onInviteFriends}
            onStart={() => initPool('playing')}
          />
        )}
        {(phase === 'won' || phase === 'lost') && (
          <GameOutcomeOverlay
            phase={phase}
            headline={phase === 'won' ? 'TABLE CLEARED!' : 'GAME OVER'}
            detail={
              phase === 'won'
                ? `Victory! ${totalPocketed} balls pocketed! (+2,500 Winner / +500 Participant Coins)`
                : `Game over after ${MAX_SCRATCHES} cue-ball scratches (${totalPocketed}/${TARGET_BALLS} pocketed).`
            }
            onRetry={() => initPool('playing')}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================
// 3. MULTIPLAYER SUNSET TURBO RACING (300m Win/Loss)
// ============================================================
const CarRacingGame: React.FC<{
  players: SquadPlayer[];
  onInviteFriends?: () => void;
  onReward: (coins: number, msg: string) => void;
}> = ({ players, onInviteFriends, onReward }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const laneRef = useRef<number>(1);
  const distanceRef = useRef<number>(0);
  const phaseRef = useRef<GamePhase>('idle');
  const onRewardRef = useRef(onReward);

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [lane, setLane] = useState(1);
  const [distance, setDistance] = useState(0);
  const [racerDistances, setRacerDistances] = useState<number[]>(() => players.map(() => 0));

  useEffect(() => {
    onRewardRef.current = onReward;
  }, [onReward]);

  const W = 360;
  const H = 290;
  const LANES = [85, 180, 275];
  const FINISH_DISTANCE = 300;

  const moveLane = (dir: -1 | 1) => {
    if (phaseRef.current !== 'playing') return;
    setLane((prev) => {
      const next = Math.max(0, Math.min(2, prev + dir));
      laneRef.current = next;
      return next;
    });
  };

  const resetRace = (nextPhase: GamePhase) => {
    distanceRef.current = 0;
    laneRef.current = 1;
    phaseRef.current = nextPhase;
    setLane(1);
    setDistance(0);
    setRacerDistances(players.map(() => 0));
    setPhase(nextPhase);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') moveLane(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') moveLane(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setRacerDistances(players.map(() => 0));
  }, [players]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let roadOffset = 0;
    let carX = LANES[laneRef.current];
    let frame = 0;

    const rivals = players.slice(1).map((pl, idx) => ({
      name: pl.name,
      color: pl.color,
      lane: idx === 0 ? 0 : 2,
      y: H - 110 - idx * 55,
      speedBias: (idx % 2 === 0 ? 1 : -1) * 0.45,
    }));

    const traffic: Array<{ lane: number; y: number; color: string }> = [
      { lane: 1, y: -60, color: '#64748B' },
      { lane: 2, y: -200, color: '#F43F5E' },
    ];

    let raf = 0;
    const tick = () => {
      if (phaseRef.current === 'playing') {
        frame += 1;
        roadOffset = (roadOffset + 7) % 44;
        const targetX = LANES[laneRef.current];
        carX += (targetX - carX) * 0.22;

        if (frame % 22 === 0 && phaseRef.current === 'playing') {
          const nextDist = distanceRef.current + 10;
          distanceRef.current = nextDist;
          setDistance(nextDist);
          setRacerDistances((prev) =>
            prev.map((val, idx) =>
              idx === 0 ? nextDist : Math.max(0, val + 8 + Math.floor(Math.random() * 5))
            )
          );
          if (nextDist % 100 === 0 && nextDist < FINISH_DISTANCE) {
            onRewardRef.current(300, `Multiplayer Race ${nextDist}m milestone (+300 Coins)`);
          }
          if (nextDist >= FINISH_DISTANCE) {
            phaseRef.current = 'won';
            setPhase('won');
            soundFx.playVictory();
            onRewardRef.current(2500, `Race Victory at ${FINISH_DISTANCE}m (+2,500 Winner / +500 Participant)`);
          }
        }

        for (const t of traffic) {
          t.y += 4.3;
          if (t.y > H + 50) {
            t.y = -60 - Math.random() * 90;
            t.lane = Math.floor(Math.random() * 3);
          }
          const tx = LANES[t.lane];
          if (Math.abs(tx - carX) < 28 && Math.abs(t.y - (H - 54)) < 44) {
            phaseRef.current = 'lost';
            setPhase('lost');
            soundFx.playMove();
          }
        }
      }

      // Sunset Cyber Highway Background
      const skyRoadBg = ctx.createLinearGradient(0, 0, 0, H);
      skyRoadBg.addColorStop(0, '#2A0845');
      skyRoadBg.addColorStop(0.5, '#4C1D95');
      skyRoadBg.addColorStop(1, '#0F172A');
      ctx.fillStyle = skyRoadBg;
      ctx.fillRect(0, 0, W, H);

      const asphaltGrad = ctx.createLinearGradient(42, 0, W - 42, 0);
      asphaltGrad.addColorStop(0, '#090D16');
      asphaltGrad.addColorStop(0.5, '#1E293B');
      asphaltGrad.addColorStop(1, '#090D16');
      ctx.fillStyle = asphaltGrad;
      ctx.fillRect(42, 0, W - 84, H);

      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(38, 0, 4, H);
      ctx.shadowColor = '#F59E0B';
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(W - 42, 0, 4, H);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 2;
      for (let sy = (frame * 12) % 60; sy < H; sy += 60) {
        ctx.beginPath();
        ctx.moveTo(18, sy);
        ctx.lineTo(18, sy + 24);
        ctx.moveTo(W - 18, sy + 14);
        ctx.lineTo(W - 18, sy + 38);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      for (let y = -44 + roadOffset; y < H; y += 44) {
        ctx.beginPath();
        ctx.moveTo(132, y);
        ctx.lineTo(132, y + 22);
        ctx.moveTo(228, y);
        ctx.lineTo(228, y + 22);
        ctx.stroke();
      }

      for (const rv of rivals) {
        if (phaseRef.current === 'playing') {
          rv.y += Math.sin(frame * 0.04 + rv.speedBias) * 0.9;
          rv.y = Math.max(40, Math.min(H - 80, rv.y));
          if (frame % 110 === 0) {
            rv.lane = (rv.lane + 1) % 3;
          }
        }
        const rx = LANES[rv.lane];
        ctx.save();
        ctx.shadowColor = rv.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = rv.color;
        ctx.beginPath();
        ctx.roundRect(rx - 15, rv.y - 24, 30, 48, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(rx - 10, rv.y - 11, 20, 14);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(rv.name.slice(0, 6), rx, rv.y - 29);
        ctx.restore();
      }

      for (const t of traffic) {
        const tx = LANES[t.lane];
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.roundRect(tx - 17, t.y - 26, 34, 52, 8);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(tx - 12, t.y - 11, 24, 16);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(tx - 13, t.y + 21, 7, 4);
        ctx.fillRect(tx + 6, t.y + 21, 7, 4);
      }

      // Player supercar
      const headGrad = ctx.createLinearGradient(carX, H - 70, carX, H - 175);
      headGrad.addColorStop(0, 'rgba(253,224,71,0.52)');
      headGrad.addColorStop(1, 'rgba(253,224,71,0)');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.moveTo(carX - 15, H - 80);
      ctx.lineTo(carX - 42, H - 175);
      ctx.lineTo(carX + 42, H - 175);
      ctx.lineTo(carX + 15, H - 80);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 16;
      const bodyGrad = ctx.createLinearGradient(carX - 19, H - 82, carX + 19, H - 22);
      bodyGrad.addColorStop(0, '#FDE047');
      bodyGrad.addColorStop(0.45, '#F59E0B');
      bodyGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(carX - 19, H - 82, 38, 60, 10);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(carX - 14, H - 68, 28, 22);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(carX - 15, H - 82, 8, 4);
      ctx.fillRect(carX + 7, H - 82, 8, 4);
      ctx.fillStyle = frame % 4 < 2 ? '#38BDF8' : '#EC4899';
      ctx.beginPath();
      ctx.arc(carX - 9, H - 19, 3.5, 0, Math.PI * 2);
      ctx.arc(carX + 9, H - 19, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(players[0]?.name.slice(0, 6) || 'You', carX, H - 88);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [players]);

  const rankedRacers = players
    .map((pl, i) => ({ ...pl, dist: racerDistances[i] ?? 0 }))
    .sort((a, b) => b.dist - a.dist);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rankedRacers.map((r, rankIdx) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-[#070B14] px-2.5 py-1.5 text-xs"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono-tabular font-black text-amber-300">#{rankIdx + 1}</span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="truncate font-bold text-white">{r.name}</span>
            </div>
            <span className="font-mono-tabular text-[11px] text-cyan-300">{r.dist}m</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-mono-tabular font-bold text-amber-300">
          Lane {lane + 1} · Distance {distance}/{FINISH_DISTANCE}m
        </span>
        <button
          type="button"
          onClick={() => resetRace('playing')}
          className="inline-flex items-center gap-1 rounded-xl bg-cyan-500 px-3 py-1 text-[11px] font-bold text-slate-950"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      </div>

      <div className="relative mx-auto max-w-[440px] overflow-hidden rounded-2xl border border-cyan-400/45 shadow-[0_18px_50px_rgba(0,0,0,0.75)]">
        <canvas ref={canvasRef} width={W} height={H} className="h-auto w-full" />
        {phase === 'idle' && (
          <GameStartOverlay
            title="Sunset Cyber Sprint"
            rule={`Race ${FINISH_DISTANCE}m to win! Dodge oncoming traffic across 3 turbo lanes.`}
            accentClass="bg-gradient-to-r from-cyan-400 to-teal-300"
            realPlayerCount={players.length}
            onInviteFriends={onInviteFriends}
            onStart={() => resetRace('playing')}
          />
        )}
        {(phase === 'won' || phase === 'lost') && (
          <GameOutcomeOverlay
            phase={phase}
            headline={phase === 'won' ? 'FINISH LINE!' : 'CRASHED!'}
            detail={
              phase === 'won'
                ? `You finished the ${FINISH_DISTANCE}m sprint in 1st place! (+2,500 Winner / +500 Participant Coins)`
                : `Collision at ${distance}m against ${players.length - 1} squad rivals!`
            }
            onRetry={() => resetRace('playing')}
          />
        )}
      </div>

      <div className="mx-auto grid max-w-[260px] grid-cols-2 gap-3">
        <button
          type="button"
          disabled={phase !== 'playing'}
          onClick={() => moveLane(-1)}
          className="rounded-xl border border-white/15 bg-[#132038] py-2.5 text-xs font-bold text-white hover:bg-cyan-500/25 disabled:opacity-40"
        >
          ◀ Left Lane
        </button>
        <button
          type="button"
          disabled={phase !== 'playing'}
          onClick={() => moveLane(1)}
          className="rounded-xl border border-white/15 bg-[#132038] py-2.5 text-xs font-bold text-white hover:bg-cyan-500/25 disabled:opacity-40"
        >
          Right Lane ▶
        </button>
      </div>
    </div>
  );
};

// ============================================================
// 4. MULTIPLAYER LUDO KING (4-Color Classic Board + Safe Stars)
// ============================================================
type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

const LUDO_COLORS: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

const LUDO_PALETTE: Record<LudoColor, { name: string; fill: string; light: string }> = {
  red: { name: 'Ruby Red', fill: '#EF4444', light: '#FCA5A5' },
  green: { name: 'Emerald', fill: '#10B981', light: '#6EE7B7' },
  yellow: { name: 'Sun Gold', fill: '#F59E0B', light: '#FDE68A' },
  blue: { name: 'Sapphire', fill: '#3B82F6', light: '#93C5FD' },
};

const LUDO_TRACK: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

const LUDO_HOME_PATH: Record<LudoColor, Array<[number, number]>> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

const LUDO_YARD_COORDS: Record<LudoColor, Array<[number, number]>> = {
  red: [[1.6, 1.6], [3.6, 1.6], [1.6, 3.6], [3.6, 3.6]],
  green: [[1.6, 10.6], [3.6, 10.6], [1.6, 12.6], [3.6, 12.6]],
  yellow: [[10.6, 10.6], [12.6, 10.6], [10.6, 12.6], [12.6, 12.6]],
  blue: [[10.6, 1.6], [12.6, 1.6], [10.6, 3.6], [12.6, 3.6]],
};

const LUDO_START_OFFSETS: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const LUDO_SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function ludoCellForToken(color: LudoColor, pos: number, tokenIdx: number): [number, number] {
  if (pos < 0) return LUDO_YARD_COORDS[color][tokenIdx] ?? [2, 2];
  if (pos <= 50) return LUDO_TRACK[(LUDO_START_OFFSETS[color] + pos) % 52];
  return LUDO_HOME_PATH[color][Math.min(5, pos - 51)];
}

const LUDO_PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

const LudoDiceSvg: React.FC<{ value: number; rolling: boolean; accentColor: string }> = ({
  value,
  rolling,
  accentColor,
}) => {
  const pips = LUDO_PIP_LAYOUTS[Math.max(1, Math.min(6, value))] ?? LUDO_PIP_LAYOUTS[1];
  return (
    <div
      className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-[0_8px_22px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.9)] transition-transform duration-150 ${
        rolling ? 'animate-spin scale-110' : 'hover:scale-105'
      }`}
      style={{ borderColor: accentColor, boxShadow: `0 0 18px ${accentColor}55, inset 0 2px 4px rgba(255,255,255,0.95)` }}
    >
      <svg viewBox="0 0 100 100" className="h-11 w-11">
        {pips.map(([cx, cy], idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={value === 1 ? 13 : 9.5}
            fill={value === 1 || value === 6 ? '#E11D48' : '#0F172A'}
          />
        ))}
      </svg>
    </div>
  );
};

const LudoGame: React.FC<{
  players: SquadPlayer[];
  onInviteFriends?: () => void;
  onReward: (coins: number, msg: string) => void;
}> = ({ players, onInviteFriends, onReward }) => {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [turnIdx, setTurnIdx] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [displayDice, setDisplayDice] = useState<number>(6);
  const [isRolling, setIsRolling] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [mustRoll, setMustRoll] = useState(true);
  const [tokensByPlayer, setTokensByPlayer] = useState<number[][]>(() =>
    players.map(() => [-1, -1, -1, -1])
  );
  const [winnerName, setWinnerName] = useState<string>('');
  const [statusLog, setStatusLog] = useState<string>('Roll the 3D dice to deploy a token!');

  const activeCount = Math.max(2, Math.min(4, players.length));
  const safeTurnIdx = turnIdx % activeCount;
  const activePlayer = players[safeTurnIdx] ?? players[0];
  const activeColor = LUDO_COLORS[safeTurnIdx % 4];

  const resetLudo = (nextPhase: GamePhase) => {
    setTokensByPlayer(Array.from({ length: activeCount }, () => [-1, -1, -1, -1]));
    setTurnIdx(0);
    setDice(null);
    setDisplayDice(6);
    setIsRolling(false);
    setIsStepping(false);
    setConsecutiveSixes(0);
    setMustRoll(true);
    setWinnerName('');
    setStatusLog(`${players[0]?.name || 'Player 1'}'s turn — Tap Roll Dice!`);
    setPhase(nextPhase);
  };

  const handleRollDice = () => {
    if (phase !== 'playing' || !mustRoll || isRolling || isStepping) return;
    setIsRolling(true);
    soundFx.playMove();

    let ticks = 0;
    const rollAnim = window.setInterval(() => {
      ticks += 1;
      setDisplayDice(1 + Math.floor(Math.random() * 6));
      if (ticks >= 7) {
        window.clearInterval(rollAnim);
        const rolled = 1 + Math.floor(Math.random() * 6);
        setDisplayDice(rolled);
        setIsRolling(false);

        const nextSixStreak = rolled === 6 ? consecutiveSixes + 1 : 0;
        if (nextSixStreak >= 3) {
          const nextTurn = (safeTurnIdx + 1) % activeCount;
          setConsecutiveSixes(0);
          setDice(null);
          setMustRoll(true);
          setTurnIdx(nextTurn);
          setStatusLog(
            `${activePlayer?.name || 'Player'} rolled three 6s in a row — turn forfeited! ${players[nextTurn]?.name || 'Next'}'s turn.`
          );
          return;
        }

        setConsecutiveSixes(nextSixStreak);
        setDice(rolled);
        const myTokens = tokensByPlayer[safeTurnIdx] || [-1, -1, -1, -1];
        const hasLegal = myTokens.some((pos) => (pos === -1 ? rolled === 6 : pos + rolled <= 56));
        if (!hasLegal) {
          const nextTurn = (safeTurnIdx + 1) % activeCount;
          setConsecutiveSixes(0);
          setDice(null);
          setMustRoll(true);
          setTurnIdx(nextTurn);
          setStatusLog(
            `${activePlayer?.name || 'Player'} rolled ${rolled} (no legal move). ${players[nextTurn]?.name || 'Next'}'s turn.`
          );
          return;
        }
        setMustRoll(false);
        setStatusLog(`${activePlayer?.name || 'Player'} rolled ${rolled}! Select a glowing token.`);
      }
    }, 55);
  };

  const finalizeTokenMove = (nextAll: number[][], nextPos: number, rolledValue: number) => {
    let capturedOpponent: string | null = null;
    if (nextPos >= 0 && nextPos <= 50) {
      const globalSq = (LUDO_START_OFFSETS[activeColor] + nextPos) % 52;
      if (!LUDO_SAFE_CELLS.has(globalSq)) {
        for (let p = 0; p < activeCount; p++) {
          if (p === safeTurnIdx) continue;
          const oppColor = LUDO_COLORS[p % 4];
          nextAll[p].forEach((opPos, opIdx) => {
            if (opPos >= 0 && opPos <= 50 && (LUDO_START_OFFSETS[oppColor] + opPos) % 52 === globalSq) {
              nextAll[p][opIdx] = -1;
              capturedOpponent = players[p]?.name || 'Opponent';
            }
          });
        }
      }
    }

    setTokensByPlayer(nextAll);
    setDice(null);
    setMustRoll(true);
    setIsStepping(false);

    const finished = nextAll[safeTurnIdx].filter((p) => p === 56).length;
    if (finished === 4) {
      const winName = activePlayer?.name || 'Player';
      setWinnerName(winName);
      setPhase('won');
      setStatusLog(`${winName} brought all 4 tokens Home!`);
      onReward(2500, `${winName} won Ludo King (+2,500 Winner / +500 Participant Coins)`);
      soundFx.playVictory();
      return;
    }

    if (rolledValue === 6 || capturedOpponent || nextPos === 56) {
      setStatusLog(
        capturedOpponent
          ? `${activePlayer?.name} captured ${capturedOpponent}! Bonus roll!`
          : nextPos === 56
            ? `${activePlayer?.name} reached Home! Bonus roll!`
            : `${activePlayer?.name} rolled 6! Bonus roll!`
      );
      if (capturedOpponent || nextPos === 56) soundFx.playVictory();
    } else {
      const nextTurn = (safeTurnIdx + 1) % activeCount;
      setConsecutiveSixes(0);
      setTurnIdx(nextTurn);
      setStatusLog(`${activePlayer?.name} moved ${rolledValue}. ${players[nextTurn]?.name || 'Next'}'s turn.`);
    }
  };

  const handleMoveToken = (tokenIdx: number) => {
    if (phase !== 'playing' || mustRoll || dice === null || isRolling || isStepping) return;
    const myTokens = [...(tokensByPlayer[safeTurnIdx] || [-1, -1, -1, -1])];
    const curPos = myTokens[tokenIdx];
    const rolledValue = dice;
    if (curPos === -1 && rolledValue !== 6) return;
    if (curPos >= 0 && curPos + rolledValue > 56) return;

    const targetPos = curPos === -1 ? 0 : curPos + rolledValue;
    if (curPos === -1) {
      const nextAll = tokensByPlayer.map((arr) => [...arr]);
      nextAll[safeTurnIdx][tokenIdx] = 0;
      soundFx.playMove();
      finalizeTokenMove(nextAll, 0, rolledValue);
      return;
    }

    // Stepped hop transition along the path
    setIsStepping(true);
    let stepPos = curPos;
    const hopTimer = window.setInterval(() => {
      stepPos += 1;
      soundFx.playMove();
      const stepAll = tokensByPlayer.map((arr) => [...arr]);
      stepAll[safeTurnIdx][tokenIdx] = stepPos;
      setTokensByPlayer(stepAll);
      if (stepPos >= targetPos) {
        window.clearInterval(hopTimer);
        finalizeTokenMove(stepAll, targetPos, rolledValue);
      }
    }, 95);
  };

  // Precompute per-square token stacking offsets so shared squares stay crystal clear
  const tokenRenderEntries = useMemo(() => {
    const groups = new Map<string, Array<{ pIdx: number; tIdx: number; pos: number; r: number; c: number; clr: LudoColor }>>();
    for (let pIdx = 0; pIdx < activeCount; pIdx++) {
      const clr = LUDO_COLORS[pIdx % 4];
      const pTokens = tokensByPlayer[pIdx] || [-1, -1, -1, -1];
      pTokens.forEach((pos, tIdx) => {
        const [r, c] = ludoCellForToken(clr, pos, tIdx);
        const key = pos < 0 ? `yard-${pIdx}-${tIdx}` : `${r.toFixed(1)},${c.toFixed(1)}`;
        const arr = groups.get(key) ?? [];
        arr.push({ pIdx, tIdx, pos, r, c, clr });
        groups.set(key, arr);
      });
    }
    const entries: Array<{
      pIdx: number;
      tIdx: number;
      pos: number;
      cx: number;
      cy: number;
      clr: LudoColor;
      scale: number;
    }> = [];
    for (const list of groups.values()) {
      const n = list.length;
      const scale = n === 1 ? 1 : n === 2 ? 0.82 : 0.72;
      list.forEach((item, idx) => {
        const angle = n === 1 ? 0 : (idx / n) * Math.PI * 2;
        const spread = n === 1 ? 0 : n === 2 ? 4.2 : 5.2;
        entries.push({
          pIdx: item.pIdx,
          tIdx: item.tIdx,
          pos: item.pos,
          clr: item.clr,
          cx: item.c * 24 + 12 + Math.cos(angle) * spread,
          cy: item.r * 24 + 12 + Math.sin(angle) * spread,
          scale,
        });
      });
    }
    return entries;
  }, [activeCount, tokensByPlayer]);

  return (
    <div className="relative flex flex-col items-center gap-3 py-1">
      <div className="flex w-full items-center justify-between rounded-2xl border border-amber-400/25 bg-[#070B14]/90 px-3.5 py-2 text-xs font-bold shadow-lg">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full shadow-[0_0_8px_currentColor]"
            style={{ backgroundColor: LUDO_PALETTE[activeColor].fill, color: LUDO_PALETTE[activeColor].fill }}
          />
          <span className="text-amber-300">
            {activePlayer?.name || 'Player'} ({LUDO_PALETTE[activeColor].name})
          </span>
        </div>
        <span className="text-cyan-300">
          {isRolling ? 'Rolling...' : isStepping ? 'Advancing...' : dice ? `Rolled: ${dice}` : 'Ready to Roll'}
        </span>
      </div>

      {/* Turn Ring */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {players.slice(0, activeCount).map((pl, idx) => {
          const clr = LUDO_COLORS[idx % 4];
          const isCurrent = idx === safeTurnIdx;
          const homeCount = (tokensByPlayer[idx] || []).filter((p) => p === 56).length;
          return (
            <div
              key={pl.id}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
                isCurrent
                  ? 'scale-105 border-amber-400 bg-amber-500/20 text-white shadow-[0_0_14px_rgba(245,158,11,0.4)]'
                  : 'border-white/10 bg-[#070B14] text-slate-400'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LUDO_PALETTE[clr].fill }} />
              <span>{pl.name}</span>
              <span className="font-mono text-[10px] text-slate-300">{homeCount}/4</span>
            </div>
          );
        })}
      </div>

      {/* High-Definition 4K Vector Ludo Arena Board */}
      <div className="relative rounded-[28px] border-4 border-amber-400/80 bg-gradient-to-br from-[#78350F] via-[#1E1B4B] to-[#451A03] p-2 shadow-[0_22px_55px_rgba(0,0,0,0.88),0_0_38px_rgba(245,158,11,0.3)] ring-1 ring-amber-200/35">
        <div className="pointer-events-none absolute inset-1.5 rounded-[20px] border border-amber-300/30" />
        <svg
          viewBox="0 0 360 360"
          className="h-72 w-72 rounded-2xl bg-[#F8FAFC] shadow-[inset_0_2px_10px_rgba(15,23,42,0.35)] sm:h-84 sm:w-84"
        >
          <defs>
            <linearGradient id="ludoRedGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="55%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>
            <linearGradient id="ludoGreenGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="55%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="ludoYellowGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="55%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id="ludoBlueGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="55%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id="ludoBoardTile" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
            <radialGradient id="ludoSafeStar" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </radialGradient>
            <filter id="ludoTokenShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000000" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* 4 Glossy Corner Yards */}
          <rect x={0} y={0} width={144} height={144} fill="url(#ludoRedGrad)" />
          <rect x={18} y={18} width={108} height={108} rx={18} fill="#FFF1F2" stroke="#FCA5A5" strokeWidth={2.5} />
          <rect x={216} y={0} width={144} height={144} fill="url(#ludoGreenGrad)" />
          <rect x={234} y={18} width={108} height={108} rx={18} fill="#ECFDF5" stroke="#6EE7B7" strokeWidth={2.5} />
          <rect x={216} y={216} width={144} height={144} fill="url(#ludoYellowGrad)" />
          <rect x={234} y={234} width={108} height={108} rx={18} fill="#FFFBEB" stroke="#FDE68A" strokeWidth={2.5} />
          <rect x={0} y={216} width={144} height={144} fill="url(#ludoBlueGrad)" />
          <rect x={18} y={234} width={108} height={108} rx={18} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={2.5} />

          {/* 52 Main Track Squares */}
          {LUDO_TRACK.map(([r, c], idx) => {
            const isSafe = LUDO_SAFE_CELLS.has(idx);
            const startFill =
              idx === 0
                ? 'url(#ludoRedGrad)'
                : idx === 13
                  ? 'url(#ludoGreenGrad)'
                  : idx === 26
                    ? 'url(#ludoYellowGrad)'
                    : idx === 39
                      ? 'url(#ludoBlueGrad)'
                      : null;
            return (
              <g key={`lt-${idx}`}>
                <rect
                  x={c * 24}
                  y={r * 24}
                  width={24}
                  height={24}
                  fill={startFill ?? (isSafe ? 'url(#ludoSafeStar)' : 'url(#ludoBoardTile)')}
                  stroke="#94A3B8"
                  strokeWidth={0.85}
                />
                {isSafe && (
                  <text
                    x={c * 24 + 12}
                    y={r * 24 + 16}
                    textAnchor="middle"
                    fontSize={12.5}
                    fill={startFill ? '#FFFFFF' : '#FBBF24'}
                  >
                    ★
                  </text>
                )}
              </g>
            );
          })}

          {/* Colored Home Stretch Lanes */}
          {LUDO_COLORS.map((clr) =>
            LUDO_HOME_PATH[clr].slice(0, 5).map(([r, c], i) => {
              const grad =
                clr === 'red'
                  ? 'url(#ludoRedGrad)'
                  : clr === 'green'
                    ? 'url(#ludoGreenGrad)'
                    : clr === 'yellow'
                      ? 'url(#ludoYellowGrad)'
                      : 'url(#ludoBlueGrad)';
              return (
                <rect
                  key={`lhs-${clr}-${i}`}
                  x={c * 24}
                  y={r * 24}
                  width={24}
                  height={24}
                  fill={grad}
                  stroke="#FFFFFF"
                  strokeOpacity={0.6}
                  strokeWidth={0.9}
                />
              );
            })
          )}

          {/* Home Center Prism */}
          <polygon points="144,144 180,180 144,216" fill="url(#ludoRedGrad)" stroke="#FFFFFF" strokeWidth={1} />
          <polygon points="144,144 216,144 180,180" fill="url(#ludoGreenGrad)" stroke="#FFFFFF" strokeWidth={1} />
          <polygon points="216,144 216,216 180,180" fill="url(#ludoYellowGrad)" stroke="#FFFFFF" strokeWidth={1} />
          <polygon points="144,216 216,216 180,180" fill="url(#ludoBlueGrad)" stroke="#FFFFFF" strokeWidth={1} />
          <circle cx={180} cy={180} r={14} fill="#0F172A" stroke="#FDE047" strokeWidth={2} />
          <text x={180} y={185} textAnchor="middle" fontSize={13}>
            👑
          </text>

          {/* Yard Base Circles */}
          {LUDO_COLORS.map((clr) =>
            LUDO_YARD_COORDS[clr].map(([r, c], idx) => (
              <g key={`ly-${clr}-${idx}`}>
                <circle
                  cx={c * 24 + 12}
                  cy={r * 24 + 12}
                  r={11.5}
                  fill={LUDO_PALETTE[clr].fill}
                  fillOpacity={0.2}
                  stroke={LUDO_PALETTE[clr].fill}
                  strokeWidth={1.8}
                />
                <circle
                  cx={c * 24 + 12}
                  cy={r * 24 + 12}
                  r={6}
                  fill="#FFFFFF"
                  fillOpacity={0.65}
                />
              </g>
            ))
          )}

          {/* 3D Glossy Tokens with Multi-Token Stacking */}
          {tokenRenderEntries.map(({ pIdx, tIdx, pos, cx, cy, clr, scale }) => {
            const isTurnOwner =
              pIdx === safeTurnIdx && !mustRoll && dice !== null && phase === 'playing' && !isStepping;
            const isLegal = isTurnOwner && (pos === -1 ? dice === 6 : pos + (dice ?? 0) <= 56);
            const rOuter = 8.5 * scale;
            const rInner = 5.5 * scale;
            return (
              <g
                key={`ltok-${pIdx}-${tIdx}`}
                onClick={() => isLegal && handleMoveToken(tIdx)}
                style={{ cursor: isLegal ? 'pointer' : 'default' }}
                filter="url(#ludoTokenShadow)"
              >
                {isLegal && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={rOuter + 3.5}
                    fill="none"
                    stroke="#FDE047"
                    strokeWidth={2.2}
                    strokeDasharray="3.5 2"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`0 ${cx} ${cy}`}
                      to={`360 ${cx} ${cy}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={rOuter}
                  fill={LUDO_PALETTE[clr].fill}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <circle
                  cx={cx}
                  cy={cy - 1 * scale}
                  r={rInner}
                  fill={LUDO_PALETTE[clr].light}
                  fillOpacity={0.45}
                />
                <circle
                  cx={cx - 2.3 * scale}
                  cy={cy - 2.5 * scale}
                  r={1.7 * scale}
                  fill="#FFFFFF"
                  fillOpacity={0.85}
                />
                <text
                  x={cx}
                  y={cy + 2.8 * scale}
                  textAnchor="middle"
                  fontSize={7.8 * scale}
                  fontWeight="900"
                  fill="#FFFFFF"
                >
                  {tIdx + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 3D Animated Dice & Status Strip */}
      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-gradient-to-r from-[#0B1224]/95 via-[#131C35]/95 to-[#0B1224]/95 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.65)]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/15 bg-black/40 p-1 shadow-inner">
            <LudoDiceSvg
              value={dice ?? displayDice}
              rolling={isRolling}
              accentColor={LUDO_PALETTE[activeColor].fill}
            />
          </div>
          <div className="max-w-[185px] text-left text-[11px] leading-snug font-semibold text-slate-100">
            {statusLog}
            {consecutiveSixes > 0 && (
              <div className="mt-0.5 text-[10px] font-bold text-amber-300">
                6-Streak: {consecutiveSixes}/3
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={phase !== 'playing' || !mustRoll || isRolling || isStepping}
          onClick={handleRollDice}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-[0_6px_18px_rgba(245,158,11,0.4)] transition hover:scale-[1.02] hover:brightness-110 disabled:opacity-40"
        >
          <Dices className="h-4 w-4" />
          <span>{isRolling ? 'Rolling...' : 'Roll Dice'}</span>
        </button>
      </div>

      {/* Quick Token Selector Row */}
      {phase === 'playing' && !mustRoll && dice !== null && !isStepping && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {(tokensByPlayer[safeTurnIdx] || [-1, -1, -1, -1]).map((pos, idx) => {
            const legal = pos === -1 ? dice === 6 : pos + dice <= 56;
            return (
              <button
                key={idx}
                type="button"
                disabled={!legal}
                onClick={() => handleMoveToken(idx)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${
                  legal
                    ? 'bg-emerald-500 text-slate-950 shadow hover:bg-emerald-400'
                    : 'border border-white/10 bg-white/5 text-slate-500'
                }`}
              >
                Token #{idx + 1} ({pos < 0 ? 'Yard' : pos === 56 ? 'Home' : `Sq ${pos}`})
              </button>
            );
          })}
        </div>
      )}

      {phase === 'idle' && (
        <GameStartOverlay
          title="Ludo King 4K Arena"
          rule="Roll 6 to deploy tokens, hop along the 52-tile track, shelter on ★ Safe Stars, capture rivals, and bring all 4 tokens Home first!"
          accentClass="bg-gradient-to-r from-amber-400 to-emerald-400"
          realPlayerCount={players.length}
          onInviteFriends={onInviteFriends}
          onStart={() => resetLudo('playing')}
        />
      )}
      {(phase === 'won' || phase === 'lost') && (
        <GameOutcomeOverlay
          phase={phase}
          headline="LUDO CHAMPION!"
          detail={`${winnerName || activePlayer?.name} reached Home with all 4 tokens! (+2,500 Winner / +500 Participant Coins)`}
          onRetry={() => resetLudo('playing')}
        />
      )}
    </div>
  );
};

// ============================================================
// HIGH-DETAIL COVER ARTWORK FOR GAME CARDS
// ============================================================
const GameCoverArtwork: React.FC<{ gameId: GameId; isHero?: boolean }> = ({
  gameId,
}) => {
  const coverMap: Record<GameId, { img: string; alt: string; gradient: string }> = {
    ludo: {
      img: ludoCoverImg,
      alt: 'Ludo King 4K Cover',
      gradient: 'linear-gradient(145deg, #1E1B4B 0%, #0F766E 55%, #090D1F 100%)',
    },
    carrom: {
      img: carromCoverImg,
      alt: 'Carrom Board Cover',
      gradient: 'linear-gradient(145deg, #1E1B4B 0%, #B45309 55%, #0F172A 100%)',
    },
    pool: {
      img: poolCoverImg,
      alt: '8-Ball Pool Cover',
      gradient: 'linear-gradient(145deg, #062E4E 0%, #0EA5E9 55%, #05131E 100%)',
    },
    racing: {
      img: racingCoverImg,
      alt: 'Car Racing Cover',
      gradient: 'linear-gradient(145deg, #2E1065 0%, #EC4899 55%, #090D1F 100%)',
    },
  };

  const entry = coverMap[gameId];
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: entry.gradient }}
    >
      <img
        src={entry.img}
        alt={entry.alt}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  );
};

// ============================================================
// GAMES ARCADE WRAPPER FOR HOME HUB (Play Together Layout + Invite Friends)
// ============================================================
export const GamesSection: React.FC<GamesSectionProps> = ({
  friends = [],
  currentUserUid,
  currentUserName = USER_PROFILE.name,
  onInviteFriend,
  onEarnCoins,
}) => {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [featuredGameId, setFeaturedGameId] = useState<GameId>('carrom');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [showAllGames, setShowAllGames] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitedFriendUids, setInvitedFriendUids] = useState<string[]>([]);
  const [lastRewardMsg, setLastRewardMsg] = useState<string | null>(null);
  const [gameVoiceJoined, setGameVoiceJoined] = useState(false);
  const [gameVoiceMuted, setGameVoiceMuted] = useState(false);
  const [gameSpeakerMuted, setGameSpeakerMuted] = useState(false);
  const [gameVoicePeers, setGameVoicePeers] = useState<GameVoicePeer[]>([]);

  // Strictly real players only (zero AI bots)
  const squadPlayers: SquadPlayer[] = useMemo(() => {
    const invitedRecords = friends.filter((f) => invitedFriendUids.includes(f.uid));
    const others: SquadPlayer[] = [];

    for (const fr of invitedRecords) {
      if (others.length >= playerCount - 1) break;
      others.push({
        id: fr.uid,
        name: fr.name,
        color: SQUAD_COLORS[(others.length + 1) % SQUAD_COLORS.length],
      });
    }

    return [
      { id: currentUserUid || USER_PROFILE.uid, name: currentUserName || USER_PROFILE.name, color: SQUAD_COLORS[0] },
      ...others,
    ];
  }, [friends, invitedFriendUids, playerCount, currentUserUid, currentUserName]);

  const matchVoiceId = useMemo(() => {
    if (!activeGame) return '';
    const ids = squadPlayers.map((p) => p.id).filter(Boolean).sort();
    return `ogv-game-${activeGame}-${ids.join('-')}`;
  }, [activeGame, squadPlayers]);

  useEffect(() => {
    const unsub = ogRealtime.subscribe((msg) => {
      if (msg.type === 'game:voice-peers' && String(msg.matchId || '') === matchVoiceId) {
        const peers = Array.isArray(msg.peers) ? (msg.peers as GameVoicePeer[]) : [];
        setGameVoicePeers(peers);
      }
    });
    return unsub;
  }, [matchVoiceId]);

  useEffect(() => {
    if (!activeGame && gameVoiceJoined) {
      ogRealtime.leaveGameVoice();
      setGameVoiceJoined(false);
      setGameVoiceMuted(false);
      setGameVoicePeers([]);
    }
  }, [activeGame, gameVoiceJoined]);

  const handleToggleGameVoice = async () => {
    if (!matchVoiceId) return;
    if (gameVoiceJoined) {
      ogRealtime.leaveGameVoice(matchVoiceId);
      setGameVoiceJoined(false);
      setGameVoicePeers([]);
    } else {
      const ok = await ogRealtime.joinGameVoice(matchVoiceId);
      if (ok) {
        setGameVoiceJoined(true);
        setGameVoiceMuted(false);
      } else {
        setLastRewardMsg('Microphone permission required for live in-game voice chat.');
      }
    }
  };

  const handleToggleGameMic = () => {
    if (!matchVoiceId || !gameVoiceJoined) return;
    const next = !gameVoiceMuted;
    setGameVoiceMuted(next);
    ogRealtime.setGameMicMuted(matchVoiceId, next);
  };

  const handleToggleGameSpeaker = () => {
    const next = !gameSpeakerMuted;
    setGameSpeakerMuted(next);
    ogRealtime.setSpeakerMuted(next);
  };

  const handleReward = (coins: number, msg: string) => {
    onEarnCoins(coins, msg);
    setLastRewardMsg(msg);
  };

  const GAME_CARDS: Array<{
    id: GameId;
    title: string;
    subtitle: string;
    tag?: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'carrom',
      title: 'Carrom Board',
      subtitle: 'Strike & Pocket · 2–4P',
      tag: 'HOT',
      icon: <Target className="h-5 w-5 text-amber-200" />,
    },
    {
      id: 'racing',
      title: 'Car Racing',
      subtitle: 'Sunset Sprint · 2–4P',
      tag: 'NEW',
      icon: <Car className="h-5 w-5 text-sky-200" />,
    },
    {
      id: 'ludo',
      title: 'Ludo King',
      subtitle: '4-Color Race · 2–4P',
      tag: 'CLASSIC',
      icon: <Dices className="h-5 w-5 text-amber-200" />,
    },
    {
      id: 'pool',
      title: '8-Ball Pool',
      subtitle: 'Sapphire Table · 2–4P',
      icon: <CircleDot className="h-5 w-5 text-emerald-200" />,
    },
  ];

  const heroGame = GAME_CARDS.find((g) => g.id === featuredGameId) ?? GAME_CARDS[0];
  const gridGames = GAME_CARDS.filter((g) => g.id !== heroGame.id);

  const handleInviteFriendToSquad = (friend: FriendRecord) => {
    setInvitedFriendUids((prev) => (prev.includes(friend.uid) ? prev : [friend.uid, ...prev]));
    if (playerCount < 4) {
      setPlayerCount((c) => Math.min(4, Math.max(c, invitedFriendUids.length + 2)) as 2 | 3 | 4);
    }
    const targetTitle = GAME_CARDS.find((g) => g.id === (activeGame ?? heroGame.id))?.title ?? 'Party Game';
    onInviteFriend?.(friend, targetTitle);
    setLastRewardMsg(`Invited ${friend.name} (${friend.uid}) to ${targetTitle} squad!`);
    soundFx.playVictory();
  };

  return (
    <section className="space-y-3">
      {/* Header matching "Play together" + Invite Friends + Squad Size + See all */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-white">Play together</h2>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 text-[10.5px] font-bold text-cyan-200 hover:bg-cyan-500/35"
          >
            <UserPlus className="h-3 w-3" />
            <span>Invite Friends</span>
          </button>

          {([2, 3, 4] as const).map((cnt) => (
            <button
              key={cnt}
              type="button"
              onClick={() => setPlayerCount(cnt)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                playerCount === cnt
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-white/10 bg-[#0D1526] text-slate-300 hover:text-white'
              }`}
            >
              <Users className="h-2.5 w-2.5" />
              {cnt}P
            </button>
          ))}

          {activeGame ? (
            <button
              type="button"
              onClick={() => setActiveGame(null)}
              className="ml-1 text-xs font-semibold text-cyan-300 hover:text-white"
            >
              Close Game
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAllGames((v) => !v)}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-400 hover:text-white"
            >
              <span>{showAllGames ? 'Compact' : 'See all'}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {lastRewardMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-200">
          <ZayroCoinArt size={15} />
          <span>{lastRewardMsg}</span>
        </div>
      )}

      {/* Featured Hero Game Cover Card */}
      <div
        onClick={() => setActiveGame(heroGame.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveGame(heroGame.id);
          }
        }}
        className={`relative flex h-40 cursor-pointer flex-col justify-end overflow-hidden rounded-3xl border p-4 shadow-xl transition-transform hover:scale-[1.01] sm:h-44 ${
          activeGame === heroGame.id
            ? 'border-amber-300 ring-2 ring-amber-300/60'
            : 'border-white/15'
        }`}
      >
        <GameCoverArtwork gameId={heroGame.id} isHero />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-end justify-between gap-3">
          <div>
            {heroGame.tag && (
              <span className="inline-block rounded-full bg-cyan-400 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                {heroGame.tag}
              </span>
            )}
            <h3 className="font-display mt-1.5 text-2xl font-black text-white">
              {heroGame.title}
            </h3>
            <p className="text-xs font-medium text-white/80">
              {heroGame.subtitle} · Squad {playerCount}P
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveGame(activeGame === heroGame.id ? null : heroGame.id);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-amber-100"
          >
            <Play className="h-3.5 w-3.5 fill-slate-950" />
            <span>{activeGame === heroGame.id ? 'Playing' : 'Play'}</span>
          </button>
        </div>
      </div>

      {/* Surrounding Game Cover Cards Row */}
      {showAllGames && (
        <div className="grid grid-cols-3 gap-3">
          {gridGames.map((g) => {
            const isSelected = activeGame === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setFeaturedGameId(g.id);
                  setActiveGame(g.id);
                }}
                className={`group relative flex h-32 flex-col justify-end overflow-hidden rounded-2xl border p-3 text-left shadow-lg transition-transform hover:scale-[1.02] sm:h-36 ${
                  isSelected
                    ? 'border-amber-300 ring-2 ring-amber-300/70'
                    : 'border-white/10'
                }`}
              >
                <GameCoverArtwork gameId={g.id} />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                  aria-hidden="true"
                />
                {g.tag && (
                  <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-cyan-400 px-2 py-0.5 text-[9px] font-extrabold text-slate-950">
                    {g.tag}
                  </span>
                )}
                <div className="relative z-10">
                  <div className="font-display text-sm font-extrabold text-white">{g.title}</div>
                  <div className="text-[10px] font-medium text-white/75">{g.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* FULL-SCREEN MODE GAME ARENA + LIVE IN-GAME VOICE CHAT */}
      {activeGame && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto text-white"
          style={{ background: ARENA_BACKGROUNDS[activeGame] }}
        >
          {/* Sticky Top Full-Screen Bar */}
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 bg-[#0A101D]/90 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (gameVoiceJoined) {
                    ogRealtime.leaveGameVoice(matchVoiceId);
                    setGameVoiceJoined(false);
                  }
                  setActiveGame(null);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Exit</span>
              </button>
              <div className="flex items-center gap-2">
                {heroGame.id === activeGame
                  ? heroGame.icon
                  : GAME_CARDS.find((c) => c.id === activeGame)?.icon}
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-display text-base font-extrabold text-white">
                      {GAME_CARDS.find((c) => c.id === activeGame)?.title}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-200">
                      <Maximize2 className="h-2.5 w-2.5" />
                      LIVE MATCH
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-300">
                    Real Squad ({squadPlayers.length}): {squadPlayers.map((p) => p.name).join(' · ')}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {([2, 3, 4] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setPlayerCount(cnt)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                    playerCount === cnt
                      ? 'bg-cyan-500 text-slate-950'
                      : 'border border-white/15 bg-black/45 text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="h-3 w-3" />
                  {cnt}P
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-400/45 bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/35"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Invite Friends</span>
              </button>
            </div>
          </header>

          {/* Live Game Voice Chat Bar */}
          <div className="mx-auto mt-3 flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-4">
            <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-400/30 bg-[#0A1324]/90 px-3.5 py-2 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    gameVoiceJoined ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'
                  }`}
                />
                <div className="text-xs font-bold text-white">
                  Game Voice Chat{' '}
                  <span className="font-normal text-slate-400">
                    ({gameVoiceJoined ? `${Math.max(1, gameVoicePeers.length)} connected` : 'Disconnected'})
                  </span>
                </div>
                {gameVoicePeers.length > 0 && (
                  <div className="flex items-center gap-1">
                    {gameVoicePeers.slice(0, 4).map((peer) => (
                      <span
                        key={peer.publicId}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          peer.muted
                            ? 'bg-white/10 text-slate-400'
                            : 'bg-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        {peer.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleGameVoice}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition-colors ${
                    gameVoiceJoined
                      ? 'border border-rose-400/45 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>{gameVoiceJoined ? 'Leave Voice' : 'Join Voice'}</span>
                </button>

                {gameVoiceJoined && (
                  <button
                    type="button"
                    onClick={handleToggleGameMic}
                    aria-label={gameVoiceMuted ? 'Unmute game mic' : 'Mute game mic'}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                      gameVoiceMuted
                        ? 'border-rose-400/45 bg-rose-500/20 text-rose-200'
                        : 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200'
                    }`}
                  >
                    {gameVoiceMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleGameSpeaker}
                  aria-label={gameSpeakerMuted ? 'Unmute game audio' : 'Mute game audio'}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                    gameSpeakerMuted
                      ? 'border-amber-400/45 bg-amber-500/20 text-amber-200'
                      : 'border-white/15 bg-white/5 text-slate-200'
                  }`}
                >
                  {gameSpeakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Centered Full-Screen Playable Stage */}
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-4">
            {lastRewardMsg && (
              <div className="mb-3 flex items-center justify-center gap-2 rounded-2xl border border-amber-400/35 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-200 backdrop-blur-md">
                <ZayroCoinArt size={16} />
                <span>{lastRewardMsg}</span>
              </div>
            )}

            <div className="rounded-3xl border border-white/15 bg-[#0A101E]/90 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-md sm:p-5">
              {activeGame === 'carrom' && (
                <CarromBoardGame
                  players={squadPlayers}
                  onInviteFriends={() => setShowInviteModal(true)}
                  onReward={handleReward}
                />
              )}
              {activeGame === 'pool' && (
                <EightBallPoolGame
                  players={squadPlayers}
                  onInviteFriends={() => setShowInviteModal(true)}
                  onReward={handleReward}
                />
              )}
              {activeGame === 'racing' && (
                <CarRacingGame
                  players={squadPlayers}
                  onInviteFriends={() => setShowInviteModal(true)}
                  onReward={handleReward}
                />
              )}
              {activeGame === 'ludo' && (
                <LudoGame
                  players={squadPlayers}
                  onInviteFriends={() => setShowInviteModal(true)}
                  onReward={handleReward}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends to Game Modal */}
      {showInviteModal && (
        <div
          onClick={() => setShowInviteModal(false)}
          role="presentation"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-cyan-400/30 bg-[#0D1526] p-5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">Invite Friends to Play</h3>
                <p className="text-[11px] text-slate-400">
                  Add friends into your multiplayer game squad
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                aria-label="Close Invite Friends"
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="zayro-scroll mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {friends.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Add friends from Home or Voice Rooms to invite them here!
                </p>
              ) : (
                friends.map((fr) => {
                  const av: AvatarConfig = {
                    id: fr.avatarId || 'av-neutral',
                    uid: fr.uid,
                    publicId: fr.publicId || fr.uid,
                    name: fr.name,
                    handle: `@${fr.name.toLowerCase().replace(/\s+/g, '')}`,
                    photoUrl: fr.photoUrl ?? undefined,
                    skinTone: '#D69E76',
                    hairColor: '#1E293B',
                    robeColor: '#06B6D4',
                    accentColor: '#A5F3FC',
                    ornament: 'crown',
                  };
                  const invited = invitedFriendUids.includes(fr.uid);
                  return (
                    <div
                      key={fr.uid}
                      className="flex items-center justify-between rounded-2xl bg-[#132038] px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <AvatarArt avatar={av} size={34} frameId={fr.equippedFrameId ?? undefined} />
                        <div>
                          <div className="text-xs font-bold text-white">{fr.name}</div>
                          <div className="font-mono-tabular text-[10px] text-slate-400">
                            {fr.uid} · {fr.status}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInviteFriendToSquad(fr)}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold ${
                          invited
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                        }`}
                      >
                        {invited ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>In Squad</span>
                          </>
                        ) : (
                          <span>Invite</span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
