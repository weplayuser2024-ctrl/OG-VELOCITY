import React, { useCallback, useEffect, useState } from 'react';
import {
  Crosshair,
  Dices,
  Gamepad2,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import type { FriendRecord } from '../types';
import { ogRealtime } from '../utils/realtimeClient';

type MultiplayerGameType = 'carrom' | 'uno' | 'laser_tag' | 'ludo';

interface UnoCard {
  id: string;
  color: 'red' | 'blue' | 'green' | 'yellow' | 'wild';
  value: string;
}

interface CarromDisc {
  id: string;
  color: 'white' | 'black' | 'queen';
  x: number;
  y: number;
  pocketed: boolean;
}

interface SanitizedPlayer {
  uid: string;
  publicId: string;
  name: string;
  score: number;
  connected: boolean;
  cardCount: number;
  hand?: UnoCard[];
  saidUno?: boolean;
  x?: number;
  y?: number;
  hp?: number;
  tags?: number;
  vipLevel?: number;
  ludoColor?: 'red' | 'green' | 'yellow' | 'blue';
  ludoTokens?: number[];
}

interface SanitizedMatch {
  id: string;
  code: string;
  gameType: MultiplayerGameType;
  hostUid: string;
  status: 'lobby' | 'playing' | 'finished';
  turnIndex: number;
  turnPlayerUid: string | null;
  winnerUid: string | null;
  unoTopCard: UnoCard | null;
  unoActiveColor: 'red' | 'blue' | 'green' | 'yellow' | null;
  unoDirection: 1 | -1;
  carromDiscs: CarromDisc[];
  laserEndsAt: number | null;
  laserShots: Array<{
    id: string;
    shooterUid: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    hitUid?: string;
    ts: number;
  }>;
  ludoDice?: number | null;
  ludoMustRoll?: boolean;
  ludoLastEvent?: string | null;
  players: SanitizedPlayer[];
}

interface MatchSummary {
  id: string;
  code: string;
  gameType: MultiplayerGameType;
  status: string;
  playerCount: number;
  players: Array<{ uid: string; publicId: string; name: string; score: number }>;
}

interface MultiplayerArenaProps {
  currentUserUid: string;
  authToken?: string | null;
  friends?: FriendRecord[];
}

const UNO_COLOR_STYLES: Record<string, string> = {
  red: 'from-rose-600 to-red-700 border-rose-300/60 text-white',
  blue: 'from-sky-600 to-blue-700 border-sky-300/60 text-white',
  green: 'from-emerald-600 to-teal-700 border-emerald-300/60 text-white',
  yellow: 'from-amber-400 to-yellow-500 border-amber-200/80 text-slate-950',
  wild: 'from-purple-600 via-pink-600 to-amber-500 border-white/60 text-white',
};

const LUDO_MAIN_TRACK: Array<[number, number]> = [
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

const LUDO_HOME_STRETCH: Record<'red' | 'green' | 'yellow' | 'blue', Array<[number, number]>> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

const LUDO_YARD_SLOTS: Record<'red' | 'green' | 'yellow' | 'blue', Array<[number, number]>> = {
  red: [[1.6, 1.6], [3.6, 1.6], [1.6, 3.6], [3.6, 3.6]],
  green: [[1.6, 10.6], [3.6, 10.6], [1.6, 12.6], [3.6, 12.6]],
  yellow: [[10.6, 10.6], [12.6, 10.6], [10.6, 12.6], [12.6, 12.6]],
  blue: [[10.6, 1.6], [12.6, 1.6], [10.6, 3.6], [12.6, 3.6]],
};

const LUDO_COLOR_OFFSET: Record<'red' | 'green' | 'yellow' | 'blue', number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const LUDO_HEX: Record<'red' | 'green' | 'yellow' | 'blue', { fill: string; light: string }> = {
  red: { fill: '#EF4444', light: '#FCA5A5' },
  green: { fill: '#10B981', light: '#6EE7B7' },
  yellow: { fill: '#F59E0B', light: '#FDE68A' },
  blue: { fill: '#3B82F6', light: '#93C5FD' },
};

const LUDO_SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function getLudoTokenCoords(
  color: 'red' | 'green' | 'yellow' | 'blue',
  pos: number,
  tokenIndex: number
): [number, number] {
  if (pos < 0) return LUDO_YARD_SLOTS[color][tokenIndex] ?? [2, 2];
  if (pos <= 50) {
    const idx = (LUDO_COLOR_OFFSET[color] + pos) % 52;
    return LUDO_MAIN_TRACK[idx];
  }
  const stretchIdx = Math.min(5, pos - 51);
  return LUDO_HOME_STRETCH[color][stretchIdx];
}

export const MultiplayerArena: React.FC<MultiplayerArenaProps> = ({
  currentUserUid,
  authToken,
  friends = [],
}) => {
  const [selectedGame, setSelectedGame] = useState<MultiplayerGameType>('carrom');
  const [activeMatch, setActiveMatch] = useState<SanitizedMatch | null>(null);
  const [openMatches, setOpenMatches] = useState<MatchSummary[]>([]);
  const [joinMatchId, setJoinMatchId] = useState('');
  const [incomingInvite, setIncomingInvite] = useState<{
    matchId: string;
    gameType: MultiplayerGameType;
    fromName: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrom controls
  const [strikerX, setStrikerX] = useState(210);
  const [carromAngleDeg, setCarromAngleDeg] = useState(-90);
  const [carromPower, setCarromPower] = useState(0.8);

  // UNO wild color picker
  const [wildColor, setWildColor] = useState<'red' | 'blue' | 'green' | 'yellow'>('red');

  const fetchOpenMatches = useCallback(async () => {
    try {
      const resp = await fetch('/api/games/matches', {
        credentials: 'include',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as { matches?: MatchSummary[] };
      setOpenMatches(data.matches || []);
    } catch {
      // Ignore network hiccup
    }
  }, [authToken]);

  useEffect(() => {
    fetchOpenMatches();
    const unsub = ogRealtime.subscribe((msg) => {
      if (msg.type === 'game:sync' && msg.match) {
        setActiveMatch(msg.match as SanitizedMatch);
        setErrorMsg(null);
      } else if (msg.type === 'game:invited') {
        setIncomingInvite({
          matchId: String(msg.matchId || ''),
          gameType: (msg.gameType as MultiplayerGameType) || 'carrom',
          fromName: String(msg.fromName || 'Friend'),
        });
      } else if (msg.type === 'error' && msg.message) {
        setErrorMsg(String(msg.message));
      }
    });
    return () => {
      unsub();
    };
  }, [fetchOpenMatches]);

  const sendMatchmake = () => {
    setErrorMsg(null);
    ogRealtime.send({ type: 'game:matchmake', gameType: selectedGame });
    window.setTimeout(fetchOpenMatches, 350);
  };

  const sendCreateMatch = () => {
    setErrorMsg(null);
    ogRealtime.send({ type: 'game:create', gameType: selectedGame });
    window.setTimeout(fetchOpenMatches, 350);
  };

  const sendJoinMatch = (id: string) => {
    const clean = id.trim().toUpperCase();
    if (!clean) return;
    setErrorMsg(null);
    ogRealtime.send({ type: 'game:join', matchId: clean });
    setIncomingInvite(null);
  };

  const sendStartMatch = () => {
    if (!activeMatch) return;
    setErrorMsg(null);
    ogRealtime.send({ type: 'game:start', matchId: activeMatch.id });
  };

  const sendInviteFriend = (friendUid: string) => {
    if (!activeMatch) return;
    ogRealtime.send({ type: 'game:invite', targetUid: friendUid, matchId: activeMatch.id });
  };

  const meInMatch = activeMatch?.players.find((p) => p.uid === currentUserUid);
  const isMyTurn = activeMatch?.turnPlayerUid === currentUserUid;

  const handleCarromStrike = () => {
    if (!activeMatch) return;
    ogRealtime.send({
      type: 'game:action',
      matchId: activeMatch.id,
      action: {
        strikerX,
        angle: (carromAngleDeg * Math.PI) / 180,
        power: carromPower,
      },
    });
  };

  const handleUnoPlay = (card: UnoCard) => {
    if (!activeMatch) return;
    ogRealtime.send({
      type: 'game:action',
      matchId: activeMatch.id,
      action: { type: 'play', cardId: card.id, chosenColor: wildColor },
    });
  };

  const handleUnoDraw = () => {
    if (!activeMatch) return;
    ogRealtime.send({
      type: 'game:action',
      matchId: activeMatch.id,
      action: { type: 'draw' },
    });
  };

  const handleCallUno = () => {
    if (!activeMatch) return;
    ogRealtime.send({
      type: 'game:action',
      matchId: activeMatch.id,
      action: { type: 'call_uno' },
    });
  };

  const handleLaserArenaClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!activeMatch || !meInMatch || activeMatch.status !== 'playing') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 700;
    const clickY = ((e.clientY - rect.top) / rect.height) * 440;
    const myX = meInMatch.x ?? 200;
    const myY = meInMatch.y ?? 200;
    const angle = Math.atan2(clickY - myY, clickX - myX);

    if (e.shiftKey) {
      // Shift+click moves toward point (capped to 80px step server-side)
      const dist = Math.hypot(clickX - myX, clickY - myY);
      const step = Math.min(80, dist);
      ogRealtime.send({
        type: 'game:action',
        matchId: activeMatch.id,
        action: {
          type: 'move',
          x: Math.round(myX + Math.cos(angle) * step),
          y: Math.round(myY + Math.sin(angle) * step),
        },
      });
    } else {
      ogRealtime.send({
        type: 'game:action',
        matchId: activeMatch.id,
        action: { type: 'fire', angle },
      });
    }
  };

  const moveLaser = (dx: number, dy: number) => {
    if (!activeMatch || !meInMatch || activeMatch.status !== 'playing') return;
    ogRealtime.send({
      type: 'game:action',
      matchId: activeMatch.id,
      action: {
        type: 'move',
        x: Math.round((meInMatch.x ?? 200) + dx),
        y: Math.round((meInMatch.y ?? 200) + dy),
      },
    });
  };

  return (
    <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-[#0A1324] via-[#10192F] to-[#070B14] p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-black text-white sm:text-base">
              Live WebSocket Multiplayer Arena
            </h3>
            <p className="text-[11px] text-slate-400">
              Server-Authoritative Real Players · Winner +2,500 Coins · Participant +500 Coins
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'carrom', label: 'Carrom Clash', icon: <Target className="h-3.5 w-3.5" /> },
              { id: 'ludo', label: 'Ludo King', icon: <Dices className="h-3.5 w-3.5" /> },
              { id: 'uno', label: 'OG UNO Clash', icon: <Sparkles className="h-3.5 w-3.5" /> },
              { id: 'laser_tag', label: '4K Laser Tag', icon: <Crosshair className="h-3.5 w-3.5" /> },
            ] as const
          ).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGame(g.id)}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedGame === g.id
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950'
                  : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {g.icon}
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {incomingInvite && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/45 bg-amber-500/15 px-3.5 py-2.5 text-xs">
          <span className="font-bold text-amber-200">
            {incomingInvite.fromName} invited you to {incomingInvite.gameType.toUpperCase()} ({incomingInvite.matchId})!
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => sendJoinMatch(incomingInvite.matchId)}
              className="rounded-lg bg-amber-400 px-3 py-1 font-black text-slate-950"
            >
              Accept &amp; Join
            </button>
            <button
              type="button"
              onClick={() => setIncomingInvite(null)}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-slate-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Lobby Controls when no active match or creating/joining */}
      {!activeMatch ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={sendMatchmake}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs font-black text-slate-950 shadow-lg hover:brightness-105"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Quick Matchmake ({selectedGame.toUpperCase()})</span>
            </button>
            <button
              type="button"
              onClick={sendCreateMatch}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Host Private Match</span>
            </button>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={joinMatchId}
                onChange={(e) => setJoinMatchId(e.target.value)}
                placeholder="Match ID (GM-...)"
                className="w-32 rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => sendJoinMatch(joinMatchId)}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Join
              </button>
            </div>
            <button
              type="button"
              onClick={fetchOpenMatches}
              className="ml-auto inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Lobbies</span>
            </button>
          </div>

          {openMatches.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {openMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-cyan-300">
                      {m.id} · {m.gameType.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {m.playerCount}/4 players · {m.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendJoinMatch(m.id)}
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 text-[11px] font-black text-slate-950"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Match Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-black text-amber-300">{activeMatch.id}</span>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200 uppercase">
                {activeMatch.gameType} · {activeMatch.status}
              </span>
              <span className="text-slate-300">
                <Users className="inline h-3.5 w-3.5 mr-1 text-emerald-300" />
                {activeMatch.players.map((p) => `${p.name} (${p.score})`).join(' vs ')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeMatch.status === 'lobby' && activeMatch.hostUid === currentUserUid && (
                <button
                  type="button"
                  disabled={activeMatch.players.length < 2}
                  onClick={sendStartMatch}
                  className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-black text-slate-950 disabled:opacity-45"
                >
                  {activeMatch.players.length < 2 ? 'Waiting for 2+ Players' : 'Start Match'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveMatch(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300"
              >
                Leave View
              </button>
            </div>
          </div>

          {/* Invite Friends Bar in Lobby */}
          {activeMatch.status === 'lobby' && friends.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">
                <UserPlus className="inline h-3.5 w-3.5 mr-1 text-cyan-300" />
                Invite Friend:
              </span>
              {friends.slice(0, 5).map((f) => (
                <button
                  key={f.uid}
                  type="button"
                  onClick={() => sendInviteFriend(f.uid)}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                >
                  <Send className="h-3 w-3" />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Winner Banner */}
          {activeMatch.status === 'finished' && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-400/50 bg-amber-500/15 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 font-black text-amber-200">
                <Trophy className="h-5 w-5 text-amber-300" />
                <span>
                  Winner:{' '}
                  {activeMatch.players.find((p) => p.uid === activeMatch.winnerUid)?.name ||
                    activeMatch.winnerUid}{' '}
                  (+2,500 Winner / +500 Participant Coins Credited)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMatch(null)}
                className="rounded-lg bg-amber-400 px-3 py-1.5 font-black text-slate-950"
              >
                New Match
              </button>
            </div>
          )}

          {/* LIVE BOARD: CARROM */}
          {activeMatch.status === 'playing' && activeMatch.gameType === 'carrom' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="flex justify-center md:col-span-7">
                <svg
                  viewBox="0 0 420 420"
                  className="h-72 w-72 rounded-2xl border-8 border-amber-900 bg-[#F5DEB3] shadow-inner"
                >
                  {/* Pockets */}
                  {[
                    [28, 28],
                    [392, 28],
                    [28, 392],
                    [392, 392],
                  ].map(([cx, cy], idx) => (
                    <circle key={idx} cx={cx} cy={cy} r={18} fill="#1E1B18" />
                  ))}
                  {/* Center circle */}
                  <circle cx={210} cy={210} r={54} fill="none" stroke="#9A3412" strokeWidth={2} />
                  {/* Discs */}
                  {activeMatch.carromDiscs
                    .filter((d) => !d.pocketed)
                    .map((d) => (
                      <circle
                        key={d.id}
                        cx={d.x}
                        cy={d.y}
                        r={10}
                        fill={
                          d.color === 'queen'
                            ? '#E11D48'
                            : d.color === 'white'
                              ? '#FFFBEB'
                              : '#1E293B'
                        }
                        stroke="#78350F"
                        strokeWidth={2}
                      />
                    ))}
                  {/* Striker + Aim Line */}
                  <line
                    x1={strikerX}
                    y1={344}
                    x2={strikerX + Math.cos((carromAngleDeg * Math.PI) / 180) * 90}
                    y2={344 + Math.sin((carromAngleDeg * Math.PI) / 180) * 90}
                    stroke="#0284C7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <circle cx={strikerX} cy={344} r={13} fill="#38BDF8" stroke="#0F172A" strokeWidth={2.5} />
                </svg>
              </div>
              <div className="space-y-3 text-xs md:col-span-5">
                <div className="font-bold text-cyan-300">
                  {isMyTurn ? 'Your Turn to Strike!' : 'Waiting for opponent strike...'}
                </div>
                <label className="block">
                  <span className="text-slate-300">Striker X ({strikerX})</span>
                  <input
                    type="range"
                    min={85}
                    max={335}
                    value={strikerX}
                    onChange={(e) => setStrikerX(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-300">Angle ({carromAngleDeg}°)</span>
                  <input
                    type="range"
                    min={-165}
                    max={-15}
                    value={carromAngleDeg}
                    onChange={(e) => setCarromAngleDeg(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-300">Power ({Math.round(carromPower * 100)}%)</span>
                  <input
                    type="range"
                    min={0.25}
                    max={1}
                    step={0.05}
                    value={carromPower}
                    onChange={(e) => setCarromPower(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <button
                  type="button"
                  disabled={!isMyTurn}
                  onClick={handleCarromStrike}
                  className="w-full rounded-xl bg-amber-500 py-2.5 font-black text-slate-950 disabled:opacity-40"
                >
                  Strike Striker
                </button>
              </div>
            </div>
          )}

          {/* LIVE BOARD: OG UNO CLASH */}
          {activeMatch.status === 'playing' && activeMatch.gameType === 'uno' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="text-slate-400">Top Discard:</div>
                  {activeMatch.unoTopCard && (
                    <div
                      className={`rounded-xl border-2 bg-gradient-to-br px-4 py-2 font-black uppercase shadow-lg ${
                        UNO_COLOR_STYLES[activeMatch.unoTopCard.color] || UNO_COLOR_STYLES.wild
                      }`}
                    >
                      {activeMatch.unoTopCard.color} {activeMatch.unoTopCard.value}
                    </div>
                  )}
                  <span className="text-slate-300">
                    Active Color:{' '}
                    <strong className="uppercase text-amber-300">
                      {activeMatch.unoActiveColor}
                    </strong>
                  </span>
                </div>
                <div className="font-bold text-cyan-300">
                  {isMyTurn ? 'Your Turn!' : 'Opponent Turn...'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400">Wild Color:</span>
                {(['red', 'blue', 'green', 'yellow'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setWildColor(c)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase ${
                      wildColor === c ? 'ring-2 ring-white ' : 'opacity-65 '
                    }bg-gradient-to-r ${UNO_COLOR_STYLES[c]}`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!isMyTurn}
                  onClick={handleUnoDraw}
                  className="ml-auto rounded-xl bg-white/15 px-3 py-1.5 font-bold text-white disabled:opacity-40"
                >
                  Draw Card
                </button>
                <button
                  type="button"
                  onClick={handleCallUno}
                  className="rounded-xl bg-rose-500 px-3 py-1.5 font-black text-white"
                >
                  UNO!
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(meInMatch?.hand || []).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    disabled={!isMyTurn}
                    onClick={() => handleUnoPlay(card)}
                    className={`rounded-xl border-2 bg-gradient-to-br px-3 py-3 text-xs font-black uppercase shadow transition hover:-translate-y-1 disabled:opacity-50 ${
                      UNO_COLOR_STYLES[card.color] || UNO_COLOR_STYLES.wild
                    }`}
                  >
                    {card.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LIVE BOARD: 4K LASER TAG */}
          {activeMatch.status === 'playing' && activeMatch.gameType === 'laser_tag' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-cyan-300 font-bold">
                  Click arena to fire laser · Use D-Pad (or Shift+Click) to move · First to 250 pts wins!
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveLaser(-45, 0)} className="rounded bg-white/10 px-2.5 py-1 font-bold">←</button>
                  <button type="button" onClick={() => moveLaser(0, -45)} className="rounded bg-white/10 px-2.5 py-1 font-bold">↑</button>
                  <button type="button" onClick={() => moveLaser(0, 45)} className="rounded bg-white/10 px-2.5 py-1 font-bold">↓</button>
                  <button type="button" onClick={() => moveLaser(45, 0)} className="rounded bg-white/10 px-2.5 py-1 font-bold">→</button>
                </div>
              </div>
              <svg
                viewBox="0 0 700 440"
                onClick={handleLaserArenaClick}
                className="w-full cursor-crosshair rounded-2xl border border-cyan-400/40 bg-[#050914]"
              >
                {/* Arena grid */}
                <rect x={10} y={10} width={680} height={420} rx={16} fill="none" stroke="#1E293B" strokeWidth={2} />
                {/* Recent laser beams */}
                {activeMatch.laserShots.map((s) => (
                  <line
                    key={s.id}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    stroke={s.hitUid ? '#FB7185' : '#22D3EE'}
                    strokeWidth={3}
                  />
                ))}
                {/* Players */}
                {activeMatch.players.map((p) => {
                  const isSelf = p.uid === currentUserUid;
                  return (
                    <g key={p.uid}>
                      <circle
                        cx={p.x ?? 200}
                        cy={p.y ?? 200}
                        r={16}
                        fill={isSelf ? '#22D3EE' : '#F43F5E'}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                      <text
                        x={p.x ?? 200}
                        y={(p.y ?? 200) - 22}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize={11}
                        fontWeight="bold"
                      >
                        {p.name} ({p.hp ?? 100}HP · {p.score})
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* LIVE BOARD: LUDO KING */}
          {activeMatch.status === 'playing' && activeMatch.gameType === 'ludo' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="flex justify-center md:col-span-7">
                <svg
                  viewBox="0 0 360 360"
                  className="h-72 w-72 rounded-2xl border-4 border-amber-400/50 bg-[#0B1526] shadow-2xl sm:h-80 sm:w-80"
                >
                  {/* 4 Corner Yards */}
                  <rect x={0} y={0} width={144} height={144} fill="#EF4444" fillOpacity={0.85} />
                  <rect x={24} y={24} width={96} height={96} rx={14} fill="#0F172A" stroke="#FCA5A5" strokeWidth={2} />
                  <rect x={216} y={0} width={144} height={144} fill="#10B981" fillOpacity={0.85} />
                  <rect x={240} y={24} width={96} height={96} rx={14} fill="#0F172A" stroke="#6EE7B7" strokeWidth={2} />
                  <rect x={216} y={216} width={144} height={144} fill="#F59E0B" fillOpacity={0.85} />
                  <rect x={240} y={240} width={96} height={96} rx={14} fill="#0F172A" stroke="#FDE68A" strokeWidth={2} />
                  <rect x={0} y={216} width={144} height={144} fill="#3B82F6" fillOpacity={0.85} />
                  <rect x={24} y={240} width={96} height={96} rx={14} fill="#0F172A" stroke="#93C5FD" strokeWidth={2} />

                  {/* 52 Outer Track Cells */}
                  {LUDO_MAIN_TRACK.map(([r, c], idx) => {
                    const isSafe = LUDO_SAFE_SQUARES.has(idx);
                    const startColor =
                      idx === 0
                        ? '#EF4444'
                        : idx === 13
                          ? '#10B981'
                          : idx === 26
                            ? '#F59E0B'
                            : idx === 39
                              ? '#3B82F6'
                              : null;
                    return (
                      <g key={`track-${idx}`}>
                        <rect
                          x={c * 24}
                          y={r * 24}
                          width={24}
                          height={24}
                          fill={startColor ?? (isSafe ? '#1E293B' : '#0F172A')}
                          stroke="#334155"
                          strokeWidth={1}
                        />
                        {isSafe && !startColor && (
                          <text
                            x={c * 24 + 12}
                            y={r * 24 + 16}
                            textAnchor="middle"
                            fontSize={12}
                            fill="#FBBF24"
                          >
                            ★
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Colored Home Stretches */}
                  {(['red', 'green', 'yellow', 'blue'] as const).map((clr) =>
                    LUDO_HOME_STRETCH[clr].slice(0, 5).map(([r, c], i) => (
                      <rect
                        key={`hs-${clr}-${i}`}
                        x={c * 24}
                        y={r * 24}
                        width={24}
                        height={24}
                        fill={LUDO_HEX[clr].fill}
                        fillOpacity={0.75}
                        stroke="#0F172A"
                        strokeWidth={1}
                      />
                    ))
                  )}

                  {/* Center Home Goal */}
                  <polygon points="144,144 180,180 144,216" fill="#EF4444" />
                  <polygon points="144,144 216,144 180,180" fill="#10B981" />
                  <polygon points="216,144 216,216 180,180" fill="#F59E0B" />
                  <polygon points="144,216 216,216 180,180" fill="#3B82F6" />

                  {/* Yard Base Circles */}
                  {(['red', 'green', 'yellow', 'blue'] as const).map((clr) =>
                    LUDO_YARD_SLOTS[clr].map(([r, c], idx) => (
                      <circle
                        key={`base-${clr}-${idx}`}
                        cx={c * 24 + 12}
                        cy={r * 24 + 12}
                        r={9}
                        fill="#1E293B"
                        stroke={LUDO_HEX[clr].light}
                        strokeWidth={1.5}
                      />
                    ))
                  )}

                  {/* Player Tokens */}
                  {activeMatch.players.map((pl, pIdx) => {
                    const clr = pl.ludoColor || (['red', 'green', 'yellow', 'blue'][pIdx % 4] as 'red' | 'green' | 'yellow' | 'blue');
                    const tokens = pl.ludoTokens || [-1, -1, -1, -1];
                    const canMoveMine =
                      isMyTurn &&
                      pl.uid === currentUserUid &&
                      !activeMatch.ludoMustRoll &&
                      typeof activeMatch.ludoDice === 'number';
                    return tokens.map((pos, tIdx) => {
                      const [r, c] = getLudoTokenCoords(clr, pos, tIdx);
                      const dice = activeMatch.ludoDice ?? 0;
                      const isLegal = canMoveMine && (pos === -1 ? dice === 6 : pos + dice <= 56);
                      const cx = c * 24 + 12 + (pIdx % 2 === 0 ? -1.5 : 1.5);
                      const cy = r * 24 + 12 + (tIdx % 2 === 0 ? -1.5 : 1.5);
                      return (
                        <g
                          key={`tok-${pl.uid}-${tIdx}`}
                          onClick={() => {
                            if (!isLegal) return;
                            ogRealtime.send({
                              type: 'game:action',
                              matchId: activeMatch.id,
                              action: { type: 'move_token', tokenIndex: tIdx },
                            });
                          }}
                          style={{ cursor: isLegal ? 'pointer' : 'default' }}
                        >
                          {isLegal && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={11}
                              fill="none"
                              stroke="#FFFFFF"
                              strokeWidth={2}
                              strokeDasharray="3 2"
                            />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={8}
                            fill={LUDO_HEX[clr].fill}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                          <text
                            x={cx}
                            y={cy + 3}
                            textAnchor="middle"
                            fontSize={8}
                            fontWeight="bold"
                            fill="#FFFFFF"
                          >
                            {tIdx + 1}
                          </text>
                        </g>
                      );
                    });
                  })}
                </svg>
              </div>

              <div className="space-y-3 text-xs md:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
                  <div className="font-bold text-cyan-300">
                    {isMyTurn
                      ? activeMatch.ludoMustRoll
                        ? 'Your Turn — Roll the Dice!'
                        : `Rolled ${activeMatch.ludoDice}! Pick a glowing token.`
                      : 'Waiting for opponent move...'}
                  </div>
                  {activeMatch.ludoLastEvent && (
                    <div className="mt-1 text-[11px] text-amber-200">{activeMatch.ludoLastEvent}</div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-400/60 bg-black/50 font-mono text-2xl font-black text-amber-300 shadow-inner">
                    {activeMatch.ludoDice ?? '—'}
                  </div>
                  <button
                    type="button"
                    disabled={!isMyTurn || !activeMatch.ludoMustRoll}
                    onClick={() =>
                      ogRealtime.send({
                        type: 'game:action',
                        matchId: activeMatch.id,
                        action: { type: 'roll' },
                      })
                    }
                    className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-black text-slate-950 shadow disabled:opacity-40"
                  >
                    Roll Dice
                  </button>
                </div>

                {/* Quick Token Move Buttons for Current User */}
                {meInMatch && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300">Your Tokens ({meInMatch.ludoColor || 'red'})</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(meInMatch.ludoTokens || [-1, -1, -1, -1]).map((pos, idx) => {
                        const dice = activeMatch.ludoDice ?? 0;
                        const legal =
                          isMyTurn &&
                          !activeMatch.ludoMustRoll &&
                          dice > 0 &&
                          (pos === -1 ? dice === 6 : pos + dice <= 56);
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={!legal}
                            onClick={() =>
                              ogRealtime.send({
                                type: 'game:action',
                                matchId: activeMatch.id,
                                action: { type: 'move_token', tokenIndex: idx },
                              })
                            }
                            className={`rounded-xl border px-2.5 py-2 text-left text-[11px] font-bold transition ${
                              legal
                                ? 'border-amber-300 bg-amber-500/25 text-amber-100 hover:bg-amber-500/35'
                                : 'border-white/10 bg-white/5 text-slate-400 opacity-60'
                            }`}
                          >
                            Token #{idx + 1} · {pos < 0 ? 'Yard' : pos === 56 ? 'Home' : `Step ${pos}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {activeMatch.players.map((pl, idx) => {
                    const clr = pl.ludoColor || (['red', 'green', 'yellow', 'blue'][idx % 4] as 'red' | 'green' | 'yellow' | 'blue');
                    const homeCount = (pl.ludoTokens || []).filter((p) => p === 56).length;
                    return (
                      <div key={pl.uid} className="flex items-center justify-between rounded-xl bg-black/30 px-2.5 py-1.5 text-[11px]">
                        <span className="flex items-center gap-1.5 font-bold text-white">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LUDO_HEX[clr].fill }} />
                          <span>{pl.name}</span>
                        </span>
                        <span className="font-mono text-slate-300">{homeCount}/4 Home · {pl.score} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
