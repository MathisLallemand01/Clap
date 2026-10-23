import type { DatabaseSync } from 'node:sqlite';
import { getCard } from './catalog.ts';
import { transaction } from './db.ts';
import { addTickets, GameError } from './game.ts';
import { logEvent, notifyPlayer } from './notify.ts';
import { RARITIES, suggestedTickets, type Rarity } from './rarity.ts';
import type { Card } from './types.ts';

// Le Guichet : les joueurs vendent leurs cartes en tickets.
export const MARKET_FEE = 0.05;
export const MIN_PRICE_RATIO = 0.5;
export const MAX_PRICE_RATIO = 3;
export const LISTING_DAYS = [1, 3, 7] as const;
/** Il faut avoir ouvert ce nombre de bobines pour vendre (contre les comptes jetables). */
export const MIN_SELLER_PULLS = 3;

export type Listing = {
  id: number;
  card: Card;
  serial: number;
  price: number;
  suggested: number;
  sellerId: string;
  sellerName: string;
  createdAt: number;
  expiresAt: number;
  status: 'open' | 'sold' | 'cancelled' | 'expired';
};

export function priceRange(rarity: Rarity): { min: number; max: number; suggested: number } {
  const suggested = suggestedTickets(rarity);
  return { min: Math.max(1, Math.round(suggested * MIN_PRICE_RATIO)), max: Math.round(suggested * MAX_PRICE_RATIO), suggested };
}

export function sellerReceives(price: number): number {
  return price - Math.ceil(price * MARKET_FEE);
}

/** Les annonces arrivées à échéance sont fermées (l'exemplaire reste à son vendeur). */
export function expireListings(db: DatabaseSync, now = Date.now()): void {
  db.prepare("UPDATE listings SET status = 'expired', closed_at = ? WHERE status = 'open' AND expires_at <= ?").run(now, now);
}

type ListingRow = { id: number; card_id: string; serial: number; price: number; seller_id: string; seller_name: string | null; created_at: number; expires_at: number; status: Listing['status'] };

function toListing(db: DatabaseSync, r: ListingRow): Listing | null {
  const card = getCard(db, r.card_id);
  if (!card) return null;
  return {
    id: r.id, card, serial: r.serial, price: r.price, suggested: suggestedTickets(card.rarity), sellerId: r.seller_id,
    sellerName: r.seller_name ?? 'Joueur', createdAt: r.created_at, expiresAt: r.expires_at, status: r.status,
  };
}

const LISTING_SELECT = `
  SELECT l.id, l.card_id, o.serial, l.price, l.seller_id, u.name AS seller_name, l.created_at, l.expires_at, l.status
  FROM listings l JOIN owned o ON o.id = l.owned_id LEFT JOIN users u ON u.player_id = l.seller_id`;

export function openListings(db: DatabaseSync, now = Date.now()): Listing[] {
  expireListings(db, now);
  return (db.prepare(`${LISTING_SELECT} WHERE l.status = 'open' ORDER BY l.created_at DESC`).all() as ListingRow[])
    .map((r) => toListing(db, r))
    .filter((l): l is Listing => l !== null);
}

export function playerListings(db: DatabaseSync, playerId: string, now = Date.now()): Listing[] {
  expireListings(db, now);
  return (db.prepare(`${LISTING_SELECT} WHERE l.seller_id = ? ORDER BY l.status = 'open' DESC, l.created_at DESC LIMIT 40`).all(playerId) as ListingRow[])
    .map((r) => toListing(db, r))
    .filter((l): l is Listing => l !== null);
}

export function getListing(db: DatabaseSync, id: number): Listing | null {
  const row = db.prepare(`${LISTING_SELECT} WHERE l.id = ?`).get(id) as ListingRow | undefined;
  return row ? toListing(db, row) : null;
}

export function recentSales(db: DatabaseSync, limit = 12): Listing[] {
  return (db.prepare(`${LISTING_SELECT} WHERE l.status = 'sold' ORDER BY l.closed_at DESC LIMIT ?`).all(limit) as ListingRow[])
    .map((r) => toListing(db, r))
    .filter((l): l is Listing => l !== null);
}

/** Met en vente l'exemplaire le moins précieux (numéro le plus haut) d'une carte. */
export function createListing(
  db: DatabaseSync,
  playerId: string,
  input: { cardId: string; price: number; days: number },
  now = Date.now(),
): number {
  const card = getCard(db, input.cardId);
  if (!card) throw new GameError('unknown-card', 'Carte inconnue.');
  const { min, max } = priceRange(card.rarity);
  if (!Number.isInteger(input.price) || input.price < min || input.price > max) {
    throw new GameError('bad-price', `Le prix doit être compris entre ${min} et ${max} tickets.`);
  }
  if (!LISTING_DAYS.includes(input.days as (typeof LISTING_DAYS)[number])) throw new GameError('bad-duration', 'Durée invalide.');
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM pulls WHERE player_id = ?').get(playerId) as { n: number };
  if (n < MIN_SELLER_PULLS) {
    throw new GameError('too-new', `Ouvrez au moins ${MIN_SELLER_PULLS} bobines avant de vendre au Guichet.`);
  }
  return transaction(db, () => {
    expireListings(db, now);
    const copy = db.prepare(`
      SELECT o.id FROM owned o
      WHERE o.player_id = ? AND o.card_id = ? AND o.id NOT IN (SELECT owned_id FROM listings WHERE status = 'open')
      ORDER BY o.serial DESC LIMIT 1`).get(playerId, card.id) as { id: number } | undefined;
    if (!copy) throw new GameError('not-owned', 'Vous n’avez plus d’exemplaire libre de cette carte.');
    const { lastInsertRowid } = db.prepare('INSERT INTO listings (seller_id, owned_id, card_id, price, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(playerId, copy.id, card.id, input.price, now, now + input.days * 24 * 3600 * 1000);
    return Number(lastInsertRowid);
  });
}

export function cancelListing(db: DatabaseSync, playerId: string, listingId: number, now = Date.now()): void {
  const res = db.prepare("UPDATE listings SET status = 'cancelled', closed_at = ? WHERE id = ? AND seller_id = ? AND status = 'open'").run(now, listingId, playerId);
  if (res.changes === 0) throw new GameError('not-found', 'Annonce introuvable.');
}

export function buyListing(db: DatabaseSync, buyerId: string, listingId: number, now = Date.now()): Listing {
  return transaction(db, () => {
    expireListings(db, now);
    const row = db.prepare("SELECT id, seller_id, owned_id, card_id, price FROM listings WHERE id = ? AND status = 'open'").get(listingId) as
      | { id: number; seller_id: string; owned_id: number; card_id: string; price: number }
      | undefined;
    if (!row) throw new GameError('not-found', 'Cette annonce n’est plus disponible.');
    if (row.seller_id === buyerId) throw new GameError('own-listing', 'Vous ne pouvez pas acheter votre propre annonce.');
    addTickets(db, buyerId, -row.price);
    addTickets(db, row.seller_id, sellerReceives(row.price));
    db.prepare('UPDATE owned SET player_id = ?, obtained_at = ? WHERE id = ?').run(buyerId, now, row.owned_id);
    db.prepare("UPDATE listings SET status = 'sold', buyer_id = ?, closed_at = ? WHERE id = ?").run(buyerId, now, row.id);
    logEvent(db, row.seller_id, 'sell', 1, now);
    logEvent(db, buyerId, 'buy', 1, now);
    const card = getCard(db, row.card_id)!;
    notifyPlayer(db, row.seller_id, 'sale', `Vendu au Guichet : ${card.first} ${card.last}${card.character ? ` (${card.character})` : ''} pour ${row.price} tickets.`, '/guichet?vue=mes-annonces', now);
    return getListing(db, row.id)!;
  });
}

/** Tri « meilleure affaire » : le plus gros rabais par rapport au prix conseillé d'abord. */
export function byDeal(a: Listing, b: Listing): number {
  return a.price / a.suggested - b.price / b.suggested || RARITIES[b.card.rarity].entries - RARITIES[a.card.rarity].entries;
}
