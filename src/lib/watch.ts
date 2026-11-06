import type { DatabaseSync } from 'node:sqlite';
import { getCard } from './catalog.ts';
import { cotes } from './cote.ts';
import { GameError } from './game.ts';
import { notify } from './notify.ts';
import type { Card } from './types.ts';

// Cartes guettées : la Régie prévient quand une de ces cartes arrive au Guichet, selon une condition.

export const MAX_WATCHES = 20;
export type WatchCond = 'any' | 'below' | 'cote' | 'auction';
export const WATCH_CONDS: { id: WatchCond; label: string; short: string }[] = [
  { id: 'any', label: 'Dès qu’elle est en vente', short: 'DÈS QU’ELLE EST EN VENTE' },
  { id: 'below', label: 'Sous un prix', short: 'SOUS' },
  { id: 'cote', label: 'Sous sa cote', short: 'SOUS LA COTE' },
  { id: 'auction', label: 'En enchère seulement', short: 'EN ENCHÈRE SEULEMENT' },
];

export type Watch = { card: Card; cond: WatchCond; maxPrice: number | null; active: boolean; createdAt: number };

export function condLabel(w: { cond: WatchCond; maxPrice: number | null }): string {
  return w.cond === 'below' ? `SOUS ${w.maxPrice ?? 0} SIÈGES` : WATCH_CONDS.find((c) => c.id === w.cond)!.short;
}

export function listWatches(db: DatabaseSync, userId: string): Watch[] {
  const rows = db.prepare('SELECT card_id, cond, max_price, active, created_at FROM watches WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as { card_id: string; cond: WatchCond; max_price: number | null; active: number; created_at: number }[];
  return rows.flatMap((r) => {
    const card = getCard(db, r.card_id);
    return card ? [{ card, cond: r.cond, maxPrice: r.max_price, active: r.active === 1, createdAt: r.created_at }] : [];
  });
}

export function isWatched(db: DatabaseSync, userId: string, cardId: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM watches WHERE user_id = ? AND card_id = ?').get(userId, cardId));
}

export function setWatch(db: DatabaseSync, userId: string, cardId: string, cond: WatchCond, maxPrice: number | null, now = Date.now()): void {
  if (!getCard(db, cardId)) throw new GameError('unknown-card', 'Carte inconnue.');
  if (!WATCH_CONDS.some((c) => c.id === cond)) throw new GameError('bad-cond', 'Condition inconnue.');
  if (cond === 'below' && (!Number.isInteger(maxPrice) || (maxPrice ?? 0) < 1)) throw new GameError('bad-price', 'Indiquez un prix en sièges.');
  const exists = isWatched(db, userId, cardId);
  if (!exists) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM watches WHERE user_id = ?').get(userId) as { n: number };
    if (n >= MAX_WATCHES) throw new GameError('too-many', `Vous guettez déjà ${MAX_WATCHES} cartes : retirez-en une d’abord.`);
  }
  db.prepare(`INSERT INTO watches (user_id, card_id, cond, max_price, active, created_at) VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT (user_id, card_id) DO UPDATE SET cond = excluded.cond, max_price = excluded.max_price, active = 1`)
    .run(userId, cardId, cond, cond === 'below' ? maxPrice : null, now);
}

export function toggleWatch(db: DatabaseSync, userId: string, cardId: string): void {
  db.prepare('UPDATE watches SET active = 1 - active WHERE user_id = ? AND card_id = ?').run(userId, cardId);
}

export function removeWatch(db: DatabaseSync, userId: string, cardId: string): void {
  db.prepare('DELETE FROM watches WHERE user_id = ? AND card_id = ?').run(userId, cardId);
}

/**
 * Une carte arrive au Guichet : chaque joueur qui la guette (hors vendeur) reçoit un télégramme si la condition
 * est remplie. Les cartes déjà possédées par le guetteur ne le dérangent pas moins : c'est lui qui a choisi.
 */
export function triggerWatches(db: DatabaseSync, input: { cardId: string; price: number; kind: 'fixe' | 'enchere'; href: string; sellerId: string }, now = Date.now()): number {
  const rows = db.prepare(`SELECT w.user_id, w.cond, w.max_price FROM watches w JOIN users u ON u.id = w.user_id
    WHERE w.card_id = ? AND w.active = 1 AND u.player_id != ?`).all(input.cardId, input.sellerId) as { user_id: string; cond: WatchCond; max_price: number | null }[];
  if (rows.length === 0) return 0;
  const card = getCard(db, input.cardId);
  if (!card) return 0;
  const cote = rows.some((r) => r.cond === 'cote') ? cotes(db, now).get(input.cardId) ?? null : null;
  const name = card.character ? `${card.character} (${card.first} ${card.last})` : `${card.first} ${card.last}`;
  const diff = cote ? Math.round((input.price / cote - 1) * 100) : null;
  let sent = 0;
  for (const r of rows) {
    const ok = r.cond === 'any'
      || (r.cond === 'below' && r.max_price !== null && input.price <= r.max_price)
      || (r.cond === 'cote' && cote !== null && input.price < cote)
      || (r.cond === 'auction' && input.kind === 'enchere');
    if (!ok) continue;
    const how = input.kind === 'enchere' ? `aux enchères, mise à prix ${input.price} sièges` : `en vente à ${input.price} sièges`;
    notify(db, r.user_id, 'alert', `Carte guettée : ${name} est ${how}${diff !== null && diff < 0 ? `, ${-diff} % sous sa cote` : ''}.`, input.href, now, { urgent: true });
    sent++;
  }
  return sent;
}
