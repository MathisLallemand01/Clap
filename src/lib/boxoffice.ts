import type { DatabaseSync } from 'node:sqlite';
import { badgeScores } from './badges.ts';
import { getCatalog } from './catalog.ts';
import { completedSagaCount } from './collections.ts';
import { periodStart } from './missions.ts';
import { pointsBoard, rank, type RankRow } from './ranking.ts';
import { RARITIES } from './rarity.ts';

// Le box-office : cinq façons de monter les marches. Chaque catégorie a son podium et ses montées de la semaine.

export type BoardId = 'points' | 'filmotheque' | 'mythes' | 'integrales' | 'palmares';
export const BOARDS: { id: BoardId; label: string; desc: string; unit: string; col: string }[] = [
  { id: 'points', label: 'Box-office', desc: 'Les points : chaque carte différente selon sa rareté, plus 10 par duo.', unit: 'PTS', col: 'Points' },
  { id: 'filmotheque', label: 'Filmothèque', desc: 'Le plus de cartes différentes. Les Mythes départagent.', unit: 'CARTES', col: 'Cartes' },
  { id: 'mythes', label: 'Mythes', desc: 'Le plus de cartes Mythe. Les Icônes départagent.', unit: 'MYTHES', col: 'Mythes' },
  { id: 'integrales', label: 'Intégrales', desc: 'Le plus de sagas complétées (5 cartes et plus).', unit: 'SAGAS', col: 'Sagas' },
  { id: 'palmares', label: 'Palmarès', desc: 'Le plus de distinctions ; l’argent compte double, l’or triple.', unit: 'PTS', col: 'Distinctions' },
];
export const boardOf = (id: string | undefined) => BOARDS.find((b) => b.id === id) ?? BOARDS[0];

/** Ligne de classement ; `secondary` sert à départager et s'affiche en deuxième colonne. */
export type BoxRow = RankRow & { secondary: number; secondaryLabel: string };

function ownedByPlayer(db: DatabaseSync): Map<string, Set<string>> {
  const owned = new Map<string, Set<string>>();
  for (const r of db.prepare('SELECT DISTINCT player_id, card_id FROM owned').all() as { player_id: string; card_id: string }[]) {
    if (!owned.has(r.player_id)) owned.set(r.player_id, new Set());
    owned.get(r.player_id)!.add(r.card_id);
  }
  return owned;
}

export function boxOffice(db: DatabaseSync, id: BoardId): BoxRow[] {
  if (id === 'points') {
    return pointsBoard(db).map((r) => ({ ...r, secondary: r.days, secondaryLabel: 'cartes' }));
  }
  if (id === 'palmares') {
    const scores = badgeScores(db);
    const rows = [...scores].map(([playerId, s]) => ({ playerId, points: s.score, days: s.count, streak: 0 }));
    return rank(db, rows).map((r) => ({ ...r, secondary: r.days, secondaryLabel: 'distinctions' }));
  }
  const catalog = new Map(getCatalog(db).map((c) => [c.id, c]));
  const rows = [...ownedByPlayer(db)].map(([playerId, ids]) => {
    let mythes = 0;
    let icones = 0;
    for (const cid of ids) {
      const r = catalog.get(cid)?.rarity;
      if (r === 'mythe') mythes++;
      else if (r && RARITIES[r].tier === 5) icones++;
    }
    if (id === 'filmotheque') return { playerId, points: ids.size, days: mythes, streak: 0 };
    if (id === 'mythes') return { playerId, points: mythes, days: icones, streak: 0 };
    return { playerId, points: completedSagaCount(db, ids), days: ids.size, streak: 0 };
  });
  // Départage : la deuxième valeur (Mythes pour la filmothèque, Icônes pour les Mythes, cartes pour les sagas).
  return rank(db, rows).map((r) => ({ ...r, secondary: r.days, secondaryLabel: id === 'filmotheque' ? 'mythes' : id === 'mythes' ? 'légendes/icônes' : 'cartes' }));
}

/**
 * Montées et descentes depuis lundi : le premier passage de la semaine photographie les places de chacun,
 * comme le box-office compare les entrées d'une semaine à l'autre. Positif = places gagnées.
 */
export function weeklyMoves(db: DatabaseSync, id: BoardId, rows: BoxRow[], now = Date.now()): Map<string, number> {
  const week = periodStart('weekly', now).key;
  const has = db.prepare('SELECT 1 FROM rank_snapshots WHERE week = ? AND board = ? LIMIT 1').get(week, id);
  if (!has) {
    const ins = db.prepare('INSERT OR IGNORE INTO rank_snapshots (week, board, player_id, rank) VALUES (?, ?, ?, ?)');
    for (const r of rows) ins.run(week, id, r.playerId, r.rank);
    db.prepare('DELETE FROM rank_snapshots WHERE week < ?').run(periodStart('weekly', now - 21 * 24 * 3600 * 1000).key);
  }
  const before = new Map((db.prepare('SELECT player_id, rank FROM rank_snapshots WHERE week = ? AND board = ?').all(week, id) as { player_id: string; rank: number }[]).map((r) => [r.player_id, r.rank]));
  const moves = new Map<string, number>();
  for (const r of rows) {
    const b = before.get(r.playerId);
    // Entré au classement cette semaine : on l'ajoute à la photo pour ne pas le compter deux fois.
    if (b === undefined) db.prepare('INSERT OR IGNORE INTO rank_snapshots (week, board, player_id, rank) VALUES (?, ?, ?, ?)').run(week, id, r.playerId, r.rank);
    moves.set(r.playerId, b === undefined ? 0 : b - r.rank);
  }
  return moves;
}

/** Place du joueur dans chaque catégorie. */
export function myPlaces(db: DatabaseSync, playerId: string): { board: (typeof BOARDS)[number]; rank: number | null; value: number }[] {
  return BOARDS.map((b) => {
    const row = boxOffice(db, b.id).find((r) => r.playerId === playerId);
    return { board: b, rank: row?.rank ?? null, value: row?.points ?? 0 };
  });
}
