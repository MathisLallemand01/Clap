import type { DatabaseSync } from 'node:sqlite';
import { getCatalog } from './catalog.ts';
import { addTickets } from './game.ts';
import { periodStart } from './missions.ts';
import { notifyPlayer } from './notify.ts';
import { RARITIES } from './rarity.ts';

// Le classement : des points de présence gagnés en passant en salle, remis à zéro chaque mois (une saison).

/** Barème des points de présence. */
export const PRESENCE = {
  /** Premier passage de la journée. */
  visit: 100,
  /** En plus, par jour de série au-delà du premier… */
  streakStep: 20,
  /** …dans la limite de ce nombre de jours. */
  streakCap: 10,
  /** Chaque 7e jour d'affilée. */
  weekBonus: 500,
  /** Chaque bobine offerte ouverte. */
  freeOpen: 10,
} as const;

export const SEASON_REWARDS: { upTo: number; label: string; tickets?: number; card?: 'icone' }[] = [
  { upTo: 1, label: 'Une carte Icône', card: 'icone' },
  { upTo: 10, label: '2 000 tickets', tickets: 2000 },
  { upTo: 100, label: '500 tickets', tickets: 500 },
];

const DAY = 24 * 3600 * 1000;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export type Season = { key: string; label: string; start: number; end: number };

/** La saison (le mois, heure de Paris) qui contient cet instant. */
export function seasonOf(now = Date.now()): Season {
  const today = periodStart('daily', now);
  const [y, m, d] = today.key.split('-').map(Number);
  const start = periodStart('daily', today.start - (d - 1) * DAY + 12 * 3600 * 1000).start;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = periodStart('daily', start + days * DAY + 12 * 3600 * 1000).start;
  return { key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1]} ${y}`, start, end };
}

export type RankRow = { rank: number; playerId: string; name: string; points: number; streak: number; days: number };

const dayIndex = (t: number) => {
  const [y, m, d] = periodStart('daily', t).key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};

/** Points de présence de chaque joueur entre deux instants, du meilleur au moins bon. */
export function presenceBoard(db: DatabaseSync, from: number, to: number, now = Date.now()): RankRow[] {
  const visits = db.prepare("SELECT player_id, created_at FROM events WHERE kind = 'visit' AND created_at >= ? AND created_at < ? ORDER BY created_at")
    .all(from, to) as { player_id: string; created_at: number }[];
  const free = new Map((db.prepare("SELECT player_id, COUNT(*) AS n FROM pulls WHERE paid_with = 'free' AND created_at >= ? AND created_at < ? GROUP BY player_id")
    .all(from, to) as { player_id: string; n: number }[]).map((r) => [r.player_id, r.n]));
  const byPlayer = new Map<string, number[]>();
  for (const v of visits) {
    const list = byPlayer.get(v.player_id) ?? [];
    const d = dayIndex(v.created_at);
    if (list[list.length - 1] !== d) list.push(d);
    byPlayer.set(v.player_id, list);
  }
  for (const id of free.keys()) if (!byPlayer.has(id)) byPlayer.set(id, []);
  const today = dayIndex(now);
  const rows = [...byPlayer].map(([playerId, days]) => {
    let points = (free.get(playerId) ?? 0) * PRESENCE.freeOpen;
    let run = 0;
    days.forEach((d, i) => {
      run = i > 0 && days[i - 1] === d - 1 ? run + 1 : 1;
      points += PRESENCE.visit + PRESENCE.streakStep * Math.min(run - 1, PRESENCE.streakCap) + (run % 7 === 0 ? PRESENCE.weekBonus : 0);
    });
    const last = days[days.length - 1];
    return { playerId, points, days: days.length, streak: last !== undefined && last >= today - 1 ? run : 0 };
  });
  return rank(db, rows);
}

/** Valeur des collections, en entrées (tous temps). */
export function boxOfficeBoard(db: DatabaseSync): RankRow[] {
  const value = new Map(getCatalog(db).map((c) => [c.id, RARITIES[c.rarity].entries]));
  const totals = new Map<string, number>();
  for (const r of db.prepare('SELECT player_id, card_id FROM owned').all() as { player_id: string; card_id: string }[]) {
    totals.set(r.player_id, (totals.get(r.player_id) ?? 0) + (value.get(r.card_id) ?? 0));
  }
  return rank(db, [...totals].map(([playerId, points]) => ({ playerId, points, days: 0, streak: 0 })));
}

function rank(db: DatabaseSync, rows: Omit<RankRow, 'rank' | 'name'>[]): RankRow[] {
  const users = new Map((db.prepare('SELECT player_id, name, public_profile FROM users').all() as { player_id: string; name: string; public_profile: number }[])
    .map((u) => [u.player_id, u.public_profile ? u.name : 'Spectateur anonyme']));
  return rows
    .filter((r) => users.has(r.playerId) && r.points > 0)
    .sort((a, b) => b.points - a.points || b.days - a.days)
    .map((r, i) => ({ ...r, rank: i + 1, name: users.get(r.playerId)! }));
}

/**
 * Verse une fois la récompense de la saison précédente, au premier passage de la nouvelle saison.
 * Retourne le libellé versé, ou null.
 */
export function claimSeasonReward(db: DatabaseSync, playerId: string, now = Date.now()): string | null {
  const previous = seasonOf(seasonOf(now).start - DAY);
  if (db.prepare('SELECT 1 FROM season_rewards WHERE player_id = ? AND season = ?').get(playerId, previous.key)) return null;
  const row = presenceBoard(db, previous.start, previous.end, previous.end - 1).find((r) => r.playerId === playerId);
  const reward = row ? SEASON_REWARDS.find((r) => row.rank <= r.upTo) : undefined;
  db.prepare('INSERT OR IGNORE INTO season_rewards (player_id, season, rank, created_at) VALUES (?, ?, ?, ?)').run(playerId, previous.key, row?.rank ?? null, now);
  if (!row || !reward) return null;
  if (reward.tickets) addTickets(db, playerId, reward.tickets);
  if (reward.card) {
    const pool = getCatalog(db).filter((c) => c.rarity === reward.card);
    const card = pool[Math.floor(Math.random() * pool.length)];
    if (card) {
      const serial = (db.prepare('SELECT COUNT(*) AS n FROM owned WHERE card_id = ?').get(card.id) as { n: number }).n + 1;
      db.prepare('INSERT INTO owned (player_id, card_id, serial, pull_id, obtained_at) VALUES (?, ?, ?, NULL, ?)').run(playerId, card.id, serial, now);
    }
  }
  notifyPlayer(db, playerId, 'pull', `Saison de ${previous.label} : ${row.rank}e au classement. Récompense : ${reward.label.toLowerCase()} !`, '/classement', now);
  return reward.label;
}
