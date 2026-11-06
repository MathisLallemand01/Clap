import type { DatabaseSync } from 'node:sqlite';
import { getCard, ownedCardIds } from './catalog.ts';
import { rowToCard, type CardRow } from './db.ts';
import { GameError } from './game.ts';
import { RARITIES } from './rarity.ts';
import type { Card } from './types.ts';

// La vitrine d'un joueur : six caissons éclairés, choisis par lui. La case 1 est sa tête d'affiche.

export const SHOWCASE_SLOTS = 6;
export type ShowcaseSlot = { slot: number; card: (Card & { serial: number }) | null };

const bestSerial = (db: DatabaseSync, playerId: string, cardId: string) =>
  (db.prepare('SELECT MIN(serial) AS s FROM owned WHERE player_id = ? AND card_id = ?').get(playerId, cardId) as { s: number | null }).s;

/** Les six cases. Sans choix du joueur, la vitrine montre ses six cartes les plus rares. */
export function getShowcase(db: DatabaseSync, playerId: string): { slots: ShowcaseSlot[]; chosen: boolean } {
  const rows = db.prepare('SELECT slot, card_id FROM showcase WHERE player_id = ?').all(playerId) as { slot: number; card_id: string }[];
  const owned = ownedCardIds(db, playerId);
  if (rows.length === 0) {
    const best = (db.prepare(`SELECT c.*, MIN(o.serial) AS serial FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ? GROUP BY c.id`).all(playerId) as (CardRow & { serial: number })[])
      .map((r) => ({ ...rowToCard(r), serial: r.serial }))
      .sort((a, b) => RARITIES[b.rarity].points - RARITIES[a.rarity].points || a.serial - b.serial)
      .slice(0, SHOWCASE_SLOTS);
    return { slots: Array.from({ length: SHOWCASE_SLOTS }, (_, i) => ({ slot: i, card: best[i] ?? null })), chosen: false };
  }
  const by = new Map(rows.map((r) => [r.slot, r.card_id]));
  const slots = Array.from({ length: SHOWCASE_SLOTS }, (_, i) => {
    const id = by.get(i);
    // Une carte vendue ou échangée depuis quitte la vitrine.
    if (!id || !owned.has(id)) return { slot: i, card: null };
    const card = getCard(db, id);
    return { slot: i, card: card ? { ...card, serial: bestSerial(db, playerId, id) ?? 0 } : null };
  });
  return { slots, chosen: true };
}

/** Fige la vitrine par défaut avant la première modification, pour que changer une case ne vide pas les autres. */
function materialize(db: DatabaseSync, playerId: string): void {
  if (db.prepare('SELECT 1 FROM showcase WHERE player_id = ? LIMIT 1').get(playerId)) return;
  const { slots } = getShowcase(db, playerId);
  const ins = db.prepare('INSERT INTO showcase (player_id, slot, card_id) VALUES (?, ?, ?)');
  for (const s of slots) if (s.card) ins.run(playerId, s.slot, s.card.id);
}

export function setShowcaseSlot(db: DatabaseSync, playerId: string, slot: number, cardId: string | null): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SHOWCASE_SLOTS) throw new GameError('bad-slot', 'Case inconnue.');
  materialize(db, playerId);
  if (!cardId) {
    db.prepare('DELETE FROM showcase WHERE player_id = ? AND slot = ?').run(playerId, slot);
    return;
  }
  if (!ownedCardIds(db, playerId).has(cardId)) throw new GameError('not-owned', 'Cette carte n’est pas dans votre collection.');
  // Une carte n'occupe qu'une case : si elle était ailleurs, elle change de place.
  db.prepare('DELETE FROM showcase WHERE player_id = ? AND card_id = ?').run(playerId, cardId);
  db.prepare('INSERT INTO showcase (player_id, slot, card_id) VALUES (?, ?, ?) ON CONFLICT (player_id, slot) DO UPDATE SET card_id = excluded.card_id').run(playerId, slot, cardId);
}

/** Échange deux cases voisines (← →). */
export function moveShowcaseSlot(db: DatabaseSync, playerId: string, slot: number, dir: -1 | 1): void {
  const other = slot + dir;
  if (other < 0 || other >= SHOWCASE_SLOTS) return;
  materialize(db, playerId);
  const get = (s: number) => (db.prepare('SELECT card_id FROM showcase WHERE player_id = ? AND slot = ?').get(playerId, s) as { card_id: string } | undefined)?.card_id ?? null;
  const a = get(slot);
  const b = get(other);
  db.prepare('DELETE FROM showcase WHERE player_id = ? AND slot IN (?, ?)').run(playerId, slot, other);
  const ins = db.prepare('INSERT INTO showcase (player_id, slot, card_id) VALUES (?, ?, ?)');
  if (a) ins.run(playerId, other, a);
  if (b) ins.run(playerId, slot, b);
}

/** Les derniers grands tirages (Légende, Icône, Mythe) sortis d'une bobine. */
export function bigPulls(db: DatabaseSync, playerId: string, limit = 3): (Card & { at: number })[] {
  return (db.prepare(`SELECT c.*, o.obtained_at AS at FROM owned o JOIN cards c ON c.id = o.card_id
    WHERE o.player_id = ? AND o.pull_id IS NOT NULL AND c.rarity IN ('legende', 'icone', 'mythe') ORDER BY o.obtained_at DESC LIMIT ?`).all(playerId, limit) as (CardRow & { at: number })[])
    .map((r) => ({ ...rowToCard(r), at: r.at }));
}
