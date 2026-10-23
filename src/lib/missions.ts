import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './db.ts';
import { addTickets, GameError, getStats } from './game.ts';
import { countEvents, logEvent } from './notify.ts';

export type MissionScope = 'daily' | 'weekly' | 'saga';

export type MissionDef = {
  id: string;
  scope: MissionScope;
  title: string;
  goal: number;
  reward: number;
  /** Symbole affiché dans la vignette de la mission. */
  glyph: string;
  /** Progression : un type d'événement compté sur la période, ou un calcul sur la collection. */
  progress:
    | { event: string }
    | { distinct: string[] }
    | { stat: (db: DatabaseSync, playerId: string) => number };
};

export const MISSIONS: MissionDef[] = [
  { id: 'daily-visit', scope: 'daily', title: 'Passer en salle aujourd’hui', goal: 1, reward: 50, glyph: '◉', progress: { event: 'visit' } },
  { id: 'daily-open', scope: 'daily', title: 'Ouvrir 2 bobines', goal: 2, reward: 60, glyph: '▶', progress: { event: 'open' } },
  { id: 'daily-rare', scope: 'daily', title: 'Révéler une carte rare (3 crans ou plus)', goal: 1, reward: 120, glyph: '◆', progress: { event: 'rare' } },
  { id: 'daily-trailer', scope: 'daily', title: 'Regarder une bande-annonce', goal: 1, reward: 30, glyph: '▷', progress: { event: 'trailer' } },
  { id: 'weekly-open', scope: 'weekly', title: 'Ouvrir 15 bobines', goal: 15, reward: 400, glyph: '▶', progress: { event: 'open' } },
  { id: 'weekly-recycle', scope: 'weekly', title: 'Recycler 20 doublons', goal: 20, reward: 200, glyph: '♻', progress: { event: 'recycle' } },
  { id: 'weekly-sell', scope: 'weekly', title: 'Vendre 3 cartes au Guichet', goal: 3, reward: 300, glyph: 'TK', progress: { event: 'sell' } },
  { id: 'weekly-trade', scope: 'weekly', title: 'Conclure un échange avec un ami', goal: 1, reward: 250, glyph: '⇄', progress: { event: 'trade' } },
  { id: 'weekly-themes', scope: 'weekly', title: 'Ouvrir une bobine Pays, Genre et Époque', goal: 3, reward: 250, glyph: '◎', progress: { distinct: ['open:country', 'open:genre', 'open:era'] } },
  { id: 'saga-unique-100', scope: 'saga', title: 'Posséder 100 cartes différentes', goal: 100, reward: 1000, glyph: '▤', progress: { stat: (db, p) => getStats(db, p).unique } },
  { id: 'saga-entries', scope: 'saga', title: 'Atteindre 5 M d’entrées au box-office', goal: 5_000_000, reward: 1500, glyph: '★', progress: { stat: (db, p) => getStats(db, p).entries } },
  { id: 'saga-legends', scope: 'saga', title: 'Posséder 10 Légendes', goal: 10, reward: 2000, glyph: '★', progress: {
    stat: (db, p) => (db.prepare("SELECT COUNT(DISTINCT o.card_id) AS n FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ? AND c.rarity = 'legende'").get(p) as { n: number }).n,
  } },
  { id: 'saga-icon', scope: 'saga', title: 'Tirer votre première Icône', goal: 1, reward: 1500, glyph: '◆', progress: {
    stat: (db, p) => (db.prepare("SELECT COUNT(*) AS n FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ? AND c.rarity = 'icone'").get(p) as { n: number }).n,
  } },
];

/** Début de la journée et de la semaine (lundi), en heure de Paris. */
export function periodStart(scope: MissionScope, now: number): { start: number; key: string } {
  if (scope === 'saga') return { start: 0, key: 'saga' };
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const sinceMidnight = (Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second'))) * 1000 + (now % 1000);
  const dayStart = now - sinceMidnight;
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  if (scope === 'daily') return { start: dayStart, key: day };
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  const weekStart = dayStart - weekday * 24 * 60 * 60 * 1000;
  return { start: weekStart, key: `w${new Date(weekStart + 12 * 3600 * 1000).toISOString().slice(0, 10)}` };
}

export function periodEnd(scope: MissionScope, now: number): number | null {
  if (scope === 'saga') return null;
  const { start } = periodStart(scope, now);
  // Marge de 2 h pour absorber le passage à l'heure d'été ou d'hiver.
  return periodStart(scope, start + (scope === 'daily' ? 26 : 7 * 24 + 2) * 3600 * 1000).start;
}

export type MissionState = MissionDef & { current: number; done: boolean; claimed: boolean; endsAt: number | null };

function progressOf(db: DatabaseSync, playerId: string, m: MissionDef, start: number): number {
  const p = m.progress;
  if ('event' in p) return countEvents(db, playerId, p.event, start);
  if ('distinct' in p) return p.distinct.filter((k) => countEvents(db, playerId, k, start) > 0).length;
  return p.stat(db, playerId);
}

/** Note la visite du jour (mission « Passer en salle »). */
export function recordVisit(db: DatabaseSync, playerId: string, now = Date.now()): void {
  const { start } = periodStart('daily', now);
  if (countEvents(db, playerId, 'visit', start) === 0) logEvent(db, playerId, 'visit', 1, now);
}

export function missionStates(db: DatabaseSync, playerId: string, now = Date.now()): MissionState[] {
  const claimed = db.prepare('SELECT mission_id, period FROM mission_claims WHERE player_id = ?').all(playerId) as { mission_id: string; period: string }[];
  const claimedSet = new Set(claimed.map((c) => `${c.mission_id}|${c.period}`));
  return MISSIONS.map((m) => {
    const { start, key } = periodStart(m.scope, now);
    const current = progressOf(db, playerId, m, start);
    return { ...m, current, done: current >= m.goal, claimed: claimedSet.has(`${m.id}|${key}`), endsAt: periodEnd(m.scope, now) };
  });
}

export function claimMission(db: DatabaseSync, playerId: string, missionId: string, now = Date.now()): number {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) throw new GameError('unknown-mission', 'Mission inconnue.');
  return transaction(db, () => {
    const { start, key } = periodStart(m.scope, now);
    if (progressOf(db, playerId, m, start) < m.goal) throw new GameError('mission-not-done', 'Mission pas encore accomplie.');
    const res = db.prepare('INSERT OR IGNORE INTO mission_claims (player_id, mission_id, period, claimed_at) VALUES (?, ?, ?, ?)').run(playerId, m.id, key, now);
    if (res.changes === 0) throw new GameError('mission-claimed', 'Récompense déjà récupérée.');
    let reward = m.reward;
    // Tous les 7 jours d'affilée, un bonus s'ajoute à la visite du jour.
    if (m.id === 'daily-visit' && visitStreak(db, playerId, now) % STREAK_DAYS === 0) reward += STREAK_BONUS;
    addTickets(db, playerId, reward);
    return reward;
  });
}

/** Jours consécutifs (jusqu'à aujourd'hui) où la mission « Passer en salle » a été récupérée. */
export function visitStreak(db: DatabaseSync, playerId: string, now = Date.now()): number {
  const days = new Set((db.prepare("SELECT period FROM mission_claims WHERE player_id = ? AND mission_id = 'daily-visit'").all(playerId) as { period: string }[]).map((r) => r.period));
  let streak = 0;
  let t = now;
  // Aujourd'hui compte s'il est déjà récupéré ; sinon on part d'hier.
  if (!days.has(periodStart('daily', t).key)) t -= 24 * 3600 * 1000;
  while (days.has(periodStart('daily', t).key)) {
    streak++;
    t -= 24 * 3600 * 1000;
  }
  return streak;
}

export const STREAK_BONUS = 500;
export const STREAK_DAYS = 7;
