import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { gameMatches, walletTransactions, wallets } from '../src/db/schema.ts';
import { recordTaskActionProgress } from '../src/db/repository.ts';

export type MultiplayerGameType = 'carrom' | 'uno' | 'laser_tag' | 'ludo';

export interface GamePlayer {
  uid: string;
  publicId: string;
  name: string;
  vipLevel: number;
  score: number;
  connected: boolean;
  ready: boolean;
  // Game-specific fields
  hand?: UnoCard[];
  saidUno?: boolean;
  x?: number;
  y?: number;
  hp?: number;
  shield?: number;
  lastShotAt?: number;
  tags?: number;
  ludoColor?: 'red' | 'green' | 'yellow' | 'blue';
  ludoTokens?: number[]; // 4 tokens: -1 = yard, 0..50 = loop progress, 51..55 = home stretch, 56 = home
}

export interface GameChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  vipLevel: number;
  text: string;
  createdAt: number;
}

export interface UnoCard {
  id: string;
  color: 'red' | 'blue' | 'green' | 'yellow' | 'wild';
  value: string; // '0'-'9' | 'skip' | 'reverse' | '+2' | 'wild' | '+4'
}

export interface CarromDisc {
  id: string;
  color: 'white' | 'black' | 'queen';
  x: number;
  y: number;
  pocketed: boolean;
}

export interface LiveMatchRoom {
  id: string;
  code: string;
  gameType: MultiplayerGameType;
  hostUid: string;
  status: 'lobby' | 'playing' | 'finished';
  players: GamePlayer[];
  turnIndex: number;
  winnerUid: string | null;
  createdAt: number;
  chatMessages: GameChatMessage[];
  // UNO state
  unoDeck?: UnoCard[];
  unoDiscard?: UnoCard[];
  unoActiveColor?: 'red' | 'blue' | 'green' | 'yellow';
  unoDirection?: 1 | -1;
  // Carrom state
  carromDiscs?: CarromDisc[];
  carromQueenClaimedBy?: string | null;
  // Laser Tag state
  laserEndsAt?: number;
  laserShots?: Array<{
    id: string;
    shooterUid: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    hitUid?: string;
    ts: number;
  }>;
  // Ludo state
  ludoDice?: number | null;
  ludoMustRoll?: boolean;
  ludoLastEvent?: string | null;
}

function buildUnoDeck(): UnoCard[] {
  const colors: Array<'red' | 'blue' | 'green' | 'yellow'> = ['red', 'blue', 'green', 'yellow'];
  const deck: UnoCard[] = [];
  let seq = 0;
  for (const color of colors) {
    deck.push({ id: `u-${seq++}`, color, value: '0' });
    for (const val of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2']) {
      deck.push({ id: `u-${seq++}`, color, value: val });
      deck.push({ id: `u-${seq++}`, color, value: val });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `u-${seq++}`, color: 'wild', value: 'wild' });
    deck.push({ id: `u-${seq++}`, color: 'wild', value: '+4' });
  }
  // Fisher-Yates cryptographic shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function buildCarromDiscs(): CarromDisc[] {
  const discs: CarromDisc[] = [{ id: 'queen', color: 'queen', x: 210, y: 210, pocketed: false }];
  for (let i = 0; i < 9; i++) {
    const angle = (i * Math.PI * 2) / 9;
    discs.push({
      id: `w-${i}`,
      color: 'white',
      x: Math.round(210 + Math.cos(angle) * 28),
      y: Math.round(210 + Math.sin(angle) * 28),
      pocketed: false,
    });
    discs.push({
      id: `b-${i}`,
      color: 'black',
      x: Math.round(210 + Math.cos(angle + 0.35) * 46),
      y: Math.round(210 + Math.sin(angle + 0.35) * 46),
      pocketed: false,
    });
  }
  return discs;
}

export class AuthoritativeGameEngine {
  private matches = new Map<string, LiveMatchRoom>();
  private userToMatch = new Map<string, string>();
  private lastActionByUser = new Map<string, number>();

  private checkRateLimit(uid: string, minMs = 80): boolean {
    const now = Date.now();
    const prev = this.lastActionByUser.get(uid) ?? 0;
    if (now - prev < minMs) return false;
    this.lastActionByUser.set(uid, now);
    return true;
  }

  public listMatches(gameType?: MultiplayerGameType) {
    const list: Array<{
      id: string;
      code: string;
      gameType: MultiplayerGameType;
      hostUid: string;
      status: string;
      playerCount: number;
      players: Array<{ uid: string; publicId: string; name: string; vipLevel: number; score: number }>;
    }> = [];
    for (const m of this.matches.values()) {
      if (gameType && m.gameType !== gameType) continue;
      if (m.status === 'finished') continue;
      const uidToPublic = new Map(m.players.map((p) => [p.uid, p.publicId]));
      list.push({
        id: m.id,
        code: m.code,
        gameType: m.gameType,
        hostUid: uidToPublic.get(m.hostUid) || m.hostUid,
        status: m.status,
        playerCount: m.players.length,
        players: m.players.map((p) => ({
          uid: p.publicId,
          publicId: p.publicId,
          name: p.name,
          vipLevel: p.vipLevel ?? 0,
          score: p.score,
        })),
      });
    }
    return list;
  }

  public createMatch(
    player: { uid: string; publicId: string; name: string; vipLevel?: number },
    gameType: MultiplayerGameType
  ): LiveMatchRoom {
    const id = `GM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const code = String(1000 + crypto.randomInt(0, 8999));
    const match: LiveMatchRoom = {
      id,
      code,
      gameType,
      hostUid: player.uid,
      status: 'lobby',
      players: [
        {
          uid: player.uid,
          publicId: player.publicId,
          name: player.name,
          vipLevel: Number(player.vipLevel ?? 0),
          score: 0,
          connected: true,
          ready: true,
          x: 120,
          y: 220,
          hp: 100,
          shield: 50,
          tags: 0,
        },
      ],
      turnIndex: 0,
      winnerUid: null,
      createdAt: Date.now(),
      chatMessages: [],
    };
    this.matches.set(id, match);
    this.userToMatch.set(player.uid, id);
    return match;
  }

  public findOrCreateMatchmaking(
    player: { uid: string; publicId: string; name: string; vipLevel?: number },
    gameType: MultiplayerGameType
  ): LiveMatchRoom {
    for (const m of this.matches.values()) {
      if (m.gameType === gameType && m.status === 'lobby' && m.players.length < 4) {
        if (!m.players.some((p) => p.uid === player.uid)) {
          return this.joinMatch(m.id, player);
        }
        return m;
      }
    }
    return this.createMatch(player, gameType);
  }

  public joinMatch(
    matchId: string,
    player: { uid: string; publicId: string; name: string; vipLevel?: number }
  ): LiveMatchRoom {
    const m = this.matches.get(matchId);
    if (!m) throw new Error('Match not found.');
    const existing = m.players.find((p) => p.uid === player.uid);
    if (existing) {
      existing.connected = true;
      existing.vipLevel = Number(player.vipLevel ?? existing.vipLevel ?? 0);
      this.userToMatch.set(player.uid, m.id);
      return m;
    }
    if (m.status !== 'lobby') throw new Error('Match already in progress.');
    if (m.players.length >= 4) throw new Error('Match lobby is full (max 4 players).');

    const spawns = [
      { x: 120, y: 220 },
      { x: 580, y: 220 },
      { x: 350, y: 80 },
      { x: 350, y: 360 },
    ];
    const sp = spawns[m.players.length % spawns.length];
    m.players.push({
      uid: player.uid,
      publicId: player.publicId,
      name: player.name,
      vipLevel: Number(player.vipLevel ?? 0),
      score: 0,
      connected: true,
      ready: true,
      x: sp.x,
      y: sp.y,
      hp: 100,
      shield: 50,
      tags: 0,
    });
    this.userToMatch.set(player.uid, m.id);
    return m;
  }

  public getMatch(matchId: string) {
    return this.matches.get(matchId) || null;
  }

  public getMatchByUser(uid: string) {
    const id = this.userToMatch.get(uid);
    return id ? this.matches.get(id) || null : null;
  }

  public markDisconnected(uid: string): LiveMatchRoom | null {
    const m = this.getMatchByUser(uid);
    if (!m) return null;
    const p = m.players.find((pl) => pl.uid === uid);
    if (p) p.connected = false;
    return m;
  }

  public async leaveMatch(uid: string, matchId?: string): Promise<{ match: LiveMatchRoom | null; leftMatchId: string | null }> {
    const targetId = matchId || this.userToMatch.get(uid) || null;
    if (!targetId) return { match: null, leftMatchId: null };
    const m = this.matches.get(targetId);
    if (this.userToMatch.get(uid) === targetId) {
      this.userToMatch.delete(uid);
    }
    if (!m) return { match: null, leftMatchId: targetId };

    const idx = m.players.findIndex((p) => p.uid === uid);
    if (idx < 0) return { match: null, leftMatchId: targetId };

    m.players.splice(idx, 1);
    if (m.players.length === 0) {
      this.matches.delete(m.id);
      return { match: null, leftMatchId: m.id };
    }

    if (m.hostUid === uid) {
      m.hostUid = m.players[0].uid;
    }

    if (m.status === 'playing') {
      m.turnIndex = m.turnIndex % m.players.length;
      if (m.players.length === 1) {
        m.winnerUid = m.players[0].uid;
        m.status = 'finished';
        await this.persistFinishedMatch(m);
      }
    }

    return { match: m, leftMatchId: m.id };
  }

  public addChatMessage(matchId: string, actorUid: string, rawText: string): LiveMatchRoom {
    const m = this.matches.get(matchId);
    if (!m) throw new Error('Match not found.');
    const player = m.players.find((p) => p.uid === actorUid);
    if (!player) throw new Error('You are not a participant in this match.');
    const text = rawText.trim().slice(0, 300);
    if (!text) throw new Error('Empty chat message.');
    m.chatMessages = [
      ...(m.chatMessages || []).slice(-49),
      {
        id: `gm-chat-${crypto.randomBytes(4).toString('hex')}`,
        senderUid: player.publicId,
        senderName: player.name,
        vipLevel: player.vipLevel ?? 0,
        text,
        createdAt: Date.now(),
      },
    ];
    return m;
  }

  public startMatch(matchId: string, actorUid: string): LiveMatchRoom {
    const m = this.matches.get(matchId);
    if (!m) throw new Error('Match not found.');
    if (m.hostUid !== actorUid) throw new Error('Only host can start the match.');
    if (m.players.length < 2) throw new Error('At least 2 real players must join to start.');
    if (m.status !== 'lobby') throw new Error('Match already started.');

    m.status = 'playing';
    m.turnIndex = 0;

    if (m.gameType === 'uno') {
      const deck = buildUnoDeck();
      for (const p of m.players) {
        p.hand = deck.splice(0, 7);
        p.saidUno = false;
      }
      let firstIdx = deck.findIndex((c) => c.color !== 'wild');
      if (firstIdx < 0) firstIdx = 0;
      const [firstCard] = deck.splice(firstIdx, 1);
      m.unoDeck = deck;
      m.unoDiscard = [firstCard];
      m.unoActiveColor = firstCard.color === 'wild' ? 'red' : firstCard.color;
      m.unoDirection = 1;
    } else if (m.gameType === 'carrom') {
      m.carromDiscs = buildCarromDiscs();
      m.carromQueenClaimedBy = null;
    } else if (m.gameType === 'laser_tag') {
      m.laserEndsAt = Date.now() + 90_000;
      m.laserShots = [];
    } else if (m.gameType === 'ludo') {
      const ludoColors: Array<'red' | 'green' | 'yellow' | 'blue'> = ['red', 'green', 'yellow', 'blue'];
      m.players.forEach((p, idx) => {
        p.ludoColor = ludoColors[idx % 4];
        p.ludoTokens = [-1, -1, -1, -1];
        p.score = 0;
      });
      m.ludoDice = null;
      m.ludoMustRoll = true;
      m.ludoLastEvent = `${m.players[0].name}'s turn — Roll the dice!`;
    }

    return m;
  }

  public async handleAction(
    matchId: string,
    actorUid: string,
    action: Record<string, unknown>
  ): Promise<{ match: LiveMatchRoom; finishedJustNow: boolean; error?: string }> {
    const m = this.matches.get(matchId);
    if (!m) throw new Error('Match not found.');
    if (!this.checkRateLimit(actorUid, m.gameType === 'laser_tag' ? 40 : 120)) {
      throw new Error('Action rate limit exceeded.');
    }

    const playerIdx = m.players.findIndex((p) => p.uid === actorUid);
    if (playerIdx < 0) throw new Error('You are not a participant in this match.');
    if (m.status !== 'playing') throw new Error('Match is not currently playing.');

    let finishedJustNow = false;

    if (m.gameType === 'uno') {
      if (m.turnIndex !== playerIdx) throw new Error('Not your turn.');
      const actType = String(action.type || '');
      const player = m.players[playerIdx];
      const top = m.unoDiscard![m.unoDiscard!.length - 1];

      if (actType === 'draw') {
        if (!m.unoDeck!.length) {
          const keep = m.unoDiscard!.pop()!;
          m.unoDeck = m.unoDiscard!.splice(0);
          m.unoDiscard = [keep];
        }
        const drawn = m.unoDeck!.pop();
        if (drawn) player.hand!.push(drawn);
        player.saidUno = false;
        m.turnIndex = (m.turnIndex + m.unoDirection! + m.players.length) % m.players.length;
      } else if (actType === 'play') {
        const cardId = String(action.cardId || '');
        const chosenColor = String(action.chosenColor || 'red') as 'red' | 'blue' | 'green' | 'yellow';
        const cardIdx = player.hand!.findIndex((c) => c.id === cardId);
        if (cardIdx < 0) throw new Error('Card not in your hand.');
        const card = player.hand![cardIdx];

        const playable =
          card.color === 'wild' ||
          card.color === m.unoActiveColor ||
          card.value === top.value;
        if (!playable) throw new Error('Illegal UNO card play.');

        player.hand!.splice(cardIdx, 1);
        m.unoDiscard!.push(card);
        m.unoActiveColor =
          card.color === 'wild'
            ? (['red', 'blue', 'green', 'yellow'].includes(chosenColor) ? chosenColor : 'red')
            : card.color;

        if (player.hand!.length === 0) {
          player.score += 100;
          m.winnerUid = player.uid;
          m.status = 'finished';
          finishedJustNow = true;
        } else {
          let steps = 1;
          if (card.value === 'reverse') {
            if (m.players.length === 2) steps = 2;
            else m.unoDirection = m.unoDirection === 1 ? -1 : 1;
          } else if (card.value === 'skip') {
            steps = 2;
          } else if (card.value === '+2' || card.value === '+4') {
            const drawCount = card.value === '+4' ? 4 : 2;
            const victimIdx = (m.turnIndex + m.unoDirection! + m.players.length) % m.players.length;
            for (let k = 0; k < drawCount; k++) {
              const d = m.unoDeck!.pop();
              if (d) m.players[victimIdx].hand!.push(d);
            }
            steps = 2;
          }
          m.turnIndex = (m.turnIndex + steps * m.unoDirection! + m.players.length * 4) % m.players.length;
        }
      } else if (actType === 'call_uno') {
        if (player.hand!.length <= 2) player.saidUno = true;
      }
    } else if (m.gameType === 'carrom') {
      if (m.turnIndex !== playerIdx) throw new Error('Not your turn.');
      const angle = Number(action.angle ?? 0);
      const power = Math.max(0.2, Math.min(1, Number(action.power ?? 0.6)));
      const strikerX = Math.max(85, Math.min(335, Number(action.strikerX ?? 210)));

      if (!Number.isFinite(angle)) throw new Error('Invalid shot angle.');

      // Authoritative deterministic shot resolution against remaining discs along ray
      const discs = m.carromDiscs!;
      const activeDiscs = discs.filter((d) => !d.pocketed);
      const sx = strikerX;
      const sy = 344;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let scored = false;

      // Check closest disc intersecting aim corridor scaled by power
      let bestDisc: CarromDisc | null = null;
      let bestProj = Infinity;
      for (const d of activeDiscs) {
        const vx = d.x - sx;
        const vy = d.y - sy;
        const proj = vx * dx + vy * dy;
        if (proj <= 0 || proj > 360 * power) continue;
        const perp = Math.abs(vx * -dy + vy * dx);
        if (perp <= 28 && proj < bestProj) {
          bestProj = proj;
          bestDisc = d;
        }
      }

      const player = m.players[playerIdx];
      if (bestDisc) {
        // Server determines if hit angle/power pockets disc cleanly
        const pocketChance = power >= 0.45 && bestProj < 320;
        if (pocketChance) {
          bestDisc.pocketed = true;
          scored = true;
          if (bestDisc.color === 'queen') {
            player.score += 30;
            m.carromQueenClaimedBy = player.uid;
          } else {
            player.score += bestDisc.color === 'white' ? 20 : 10;
          }
        } else {
          bestDisc.x = Math.max(55, Math.min(365, Math.round(bestDisc.x + dx * 45 * power)));
          bestDisc.y = Math.max(55, Math.min(365, Math.round(bestDisc.y + dy * 45 * power)));
        }
      }

      const remaining = discs.filter((d) => !d.pocketed).length;
      if (remaining === 0) {
        const sorted = [...m.players].sort((a, b) => b.score - a.score);
        m.winnerUid = sorted[0].uid;
        m.status = 'finished';
        finishedJustNow = true;
      } else if (!scored) {
        m.turnIndex = (m.turnIndex + 1) % m.players.length;
      }
    } else if (m.gameType === 'laser_tag') {
      const player = m.players[playerIdx];
      const actType = String(action.type || '');
      const now = Date.now();

      if (m.laserEndsAt && now >= m.laserEndsAt) {
        const sorted = [...m.players].sort((a, b) => b.score - a.score);
        m.winnerUid = sorted[0].uid;
        m.status = 'finished';
        finishedJustNow = true;
      } else if (actType === 'move') {
        const nextX = Math.max(24, Math.min(676, Number(action.x ?? player.x ?? 200)));
        const nextY = Math.max(24, Math.min(416, Number(action.y ?? player.y ?? 200)));
        // Anti-cheat max step clamp
        const dist = Math.hypot(nextX - (player.x ?? 200), nextY - (player.y ?? 200));
        if (dist <= 90) {
          player.x = nextX;
          player.y = nextY;
        }
      } else if (actType === 'fire') {
        if (player.lastShotAt && now - player.lastShotAt < 320) {
          return { match: m, finishedJustNow: false };
        }
        player.lastShotAt = now;
        const aimAngle = Number(action.angle ?? 0);
        const x1 = player.x ?? 200;
        const y1 = player.y ?? 200;
        const dx = Math.cos(aimAngle);
        const dy = Math.sin(aimAngle);
        let hitPlayer: GamePlayer | undefined;
        let hitDist = 720;

        for (const target of m.players) {
          if (target.uid === player.uid || (target.hp ?? 100) <= 0) continue;
          const tx = (target.x ?? 200) - x1;
          const ty = (target.y ?? 200) - y1;
          const proj = tx * dx + ty * dy;
          if (proj <= 0 || proj > hitDist) continue;
          const perp = Math.abs(tx * -dy + ty * dx);
          if (perp <= 24) {
            hitDist = proj;
            hitPlayer = target;
          }
        }

        const x2 = Math.max(10, Math.min(690, Math.round(x1 + dx * Math.min(hitDist, 420))));
        const y2 = Math.max(10, Math.min(430, Math.round(y1 + dy * Math.min(hitDist, 420))));

        if (hitPlayer) {
          player.score += 25;
          player.tags = (player.tags ?? 0) + 1;
          const nextHp = Math.max(0, (hitPlayer.hp ?? 100) - 34);
          hitPlayer.hp = nextHp;
          if (nextHp === 0) {
            player.score += 50;
            // Respawn target after hit
            hitPlayer.hp = 100;
            hitPlayer.x = 60 + crypto.randomInt(0, 560);
            hitPlayer.y = 60 + crypto.randomInt(0, 320);
          }
        }

        m.laserShots = [
          ...(m.laserShots || []).slice(-8),
          {
            id: `ls-${crypto.randomBytes(3).toString('hex')}`,
            shooterUid: player.uid,
            x1,
            y1,
            x2,
            y2,
            hitUid: hitPlayer?.uid,
            ts: now,
          },
        ];
      }
    } else if (m.gameType === 'ludo') {
      if (m.turnIndex !== playerIdx) throw new Error('Not your turn.');
      const player = m.players[playerIdx];
      const actType = String(action.type || '');
      const colorOffsets: Record<string, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
      const safeSquares = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
      const tokens = player.ludoTokens || [-1, -1, -1, -1];
      player.ludoTokens = tokens;

      if (actType === 'roll') {
        if (!m.ludoMustRoll && m.ludoDice !== null) {
          throw new Error('Select a token to move first.');
        }
        const rolled = crypto.randomInt(1, 7);
        m.ludoDice = rolled;
        const canMoveAny = tokens.some((pos) => (pos === -1 ? rolled === 6 : pos + rolled <= 56));
        if (!canMoveAny) {
          m.ludoDice = null;
          m.ludoMustRoll = true;
          m.turnIndex = (m.turnIndex + 1) % m.players.length;
          m.ludoLastEvent = `${player.name} rolled ${rolled} (no legal move). ${m.players[m.turnIndex].name}'s turn.`;
        } else {
          m.ludoMustRoll = false;
          m.ludoLastEvent = `${player.name} rolled a ${rolled}! Select a token to move.`;
        }
      } else if (actType === 'move_token') {
        const dice = m.ludoDice;
        if (!dice || m.ludoMustRoll) throw new Error('Roll the dice first.');
        const tokenIndex = Number(action.tokenIndex);
        if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex > 3) {
          throw new Error('Invalid token index.');
        }
        const curPos = tokens[tokenIndex];
        let nextPos = curPos;
        if (curPos === -1) {
          if (dice !== 6) throw new Error('Need a 6 to deploy a token from yard.');
          nextPos = 0;
        } else {
          if (curPos + dice > 56) throw new Error('Move overshoots Home finish.');
          nextPos = curPos + dice;
        }
        tokens[tokenIndex] = nextPos;

        let capturedName: string | null = null;
        if (nextPos >= 0 && nextPos <= 50) {
          const offset = colorOffsets[player.ludoColor || 'red'] ?? 0;
          const globalSq = (offset + nextPos) % 52;
          if (!safeSquares.has(globalSq)) {
            for (const opp of m.players) {
              if (opp.uid === player.uid || !opp.ludoTokens) continue;
              const oppOffset = colorOffsets[opp.ludoColor || 'green'] ?? 13;
              opp.ludoTokens.forEach((opPos, opIdx) => {
                if (opPos >= 0 && opPos <= 50 && (oppOffset + opPos) % 52 === globalSq) {
                  opp.ludoTokens![opIdx] = -1;
                  player.score += 15;
                  capturedName = opp.name;
                }
              });
            }
          }
        }

        const finishedCount = tokens.filter((p) => p === 56).length;
        if (nextPos === 56) player.score += 25;

        m.ludoDice = null;
        m.ludoMustRoll = true;

        if (finishedCount === 4) {
          m.winnerUid = player.uid;
          m.status = 'finished';
          finishedJustNow = true;
          m.ludoLastEvent = `${player.name} brought all 4 tokens Home and won!`;
        } else if (dice === 6 || capturedName || nextPos === 56) {
          m.ludoLastEvent = capturedName
            ? `${player.name} captured ${capturedName}'s token! Bonus roll!`
            : nextPos === 56
              ? `${player.name} reached Home! Bonus roll!`
              : `${player.name} rolled 6! Bonus roll!`;
        } else {
          m.turnIndex = (m.turnIndex + 1) % m.players.length;
          m.ludoLastEvent = `${player.name} moved ${dice}. ${m.players[m.turnIndex].name}'s turn.`;
        }
      }
    }

    if (finishedJustNow) {
      await this.persistFinishedMatch(m);
    }

    return { match: m, finishedJustNow };
  }

  private async persistFinishedMatch(m: LiveMatchRoom) {
    try {
      await db
        .insert(gameMatches)
        .values({
          id: m.id,
          gameType: m.gameType,
          hostUid: m.hostUid,
          status: 'finished',
          winnerUid: m.winnerUid,
          players: m.players.map((p) => ({ uid: p.uid, name: p.name, score: p.score })),
          stateJson: { code: m.code },
          finishedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gameMatches.id,
          set: {
            status: 'finished',
            winnerUid: m.winnerUid,
            players: m.players.map((p) => ({ uid: p.uid, name: p.name, score: p.score })),
            finishedAt: new Date(),
          },
        });

      // Award winner 2,500 Coins and each participant 500 Coins + advance daily game task (NEVER touches VIP!)
      for (const p of m.players) {
        await recordTaskActionProgress(p.uid, 'play_game', 1).catch(() => {});
      }
      await db.transaction(async (tx) => {
        for (const p of m.players) {
          const isWinner = m.winnerUid === p.uid;
          const rewardAmount = isWinner ? 2500 : 500;
          const [w] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userUid, p.uid))
            .for('update');
          if (!w) continue;
          const nextCoins = Number(w.coins) + rewardAmount;
          await tx
            .update(wallets)
            .set({ coins: nextCoins, updatedAt: new Date() })
            .where(eq(wallets.userUid, p.uid));
          await tx.insert(walletTransactions).values({
            txId: `TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
            userUid: p.uid,
            type: 'game_reward',
            amount: rewardAmount,
            balanceAfter: nextCoins,
            referenceType: 'game_match',
            referenceId: m.id,
            idempotencyKey: `match-${isWinner ? 'win' : 'play'}-${m.id}-${p.uid}`,
            description: isWinner
              ? `Won ${m.gameType.toUpperCase()} multiplayer match (+2,500 Coins)`
              : `Played ${m.gameType.toUpperCase()} multiplayer match (+500 Coins)`,
          });
        }
      });
    } catch (err) {
      console.error('Failed to persist match:', err);
    }
  }

  public sanitizeMatchForPlayer(m: LiveMatchRoom, viewerUid: string) {
    const uidToPublic = new Map(m.players.map((p) => [p.uid, p.publicId]));
    const turnPlayer = m.players[m.turnIndex];
    return {
      id: m.id,
      code: m.code,
      gameType: m.gameType,
      hostUid: uidToPublic.get(m.hostUid) || m.hostUid,
      status: m.status,
      turnIndex: m.turnIndex,
      turnPlayerUid: turnPlayer ? turnPlayer.publicId : null,
      winnerUid: m.winnerUid ? (uidToPublic.get(m.winnerUid) || m.winnerUid) : null,
      unoTopCard: m.unoDiscard?.[m.unoDiscard.length - 1] || null,
      unoActiveColor: m.unoActiveColor || null,
      unoDirection: m.unoDirection || 1,
      carromDiscs: m.carromDiscs || [],
      laserEndsAt: m.laserEndsAt || null,
      laserShots: (m.laserShots || []).map((s) => ({
        ...s,
        shooterUid: uidToPublic.get(s.shooterUid) || s.shooterUid,
        hitUid: s.hitUid ? (uidToPublic.get(s.hitUid) || s.hitUid) : undefined,
      })),
      chatMessages: (m.chatMessages || []).slice(-40),
      ludoDice: m.ludoDice ?? null,
      ludoMustRoll: m.ludoMustRoll ?? true,
      ludoLastEvent: m.ludoLastEvent ?? null,
      players: m.players.map((p) => ({
        uid: p.publicId,
        publicId: p.publicId,
        name: p.name,
        vipLevel: p.vipLevel ?? 0,
        score: p.score,
        connected: p.connected,
        cardCount: p.hand?.length ?? 0,
        hand: p.uid === viewerUid ? p.hand : undefined, // Hide opponents' private cards!
        saidUno: p.saidUno,
        x: p.x,
        y: p.y,
        hp: p.hp,
        tags: p.tags,
        ludoColor: p.ludoColor,
        ludoTokens: p.ludoTokens,
      })),
    };
  }
}
