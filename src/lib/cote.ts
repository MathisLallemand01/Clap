import type { DatabaseSync } from 'node:sqlite';
import { periodStart } from './missions.ts';

// La cote d'une carte : la médiane de ses ventes (prix fixe et enchères adjugées) sur une période.
// La moitié des ventes s'est faite au-dessus, l'autre en dessous : une vente folle ne la fait pas bouger.

const DAY = 24 * 3600 * 1000;
/** En dessous de ce nombre de ventes sur 30 jours, la carte n'est « pas encore cotée ». */
export const MIN_SALES_FOR_COTE = 3;

export type Sale = { cardId: string; price: number; at: number; kind: 'fixe' | 'enchere'; sellerId: string; buyerId: string };

const SALES_SQL = `
  SELECT card_id, price, closed_at AS at, 'fixe' AS kind, seller_id, buyer_id FROM listings WHERE status = 'sold'
  UNION ALL
  SELECT card_id, current_bid AS price, closed_at AS at, 'enchere' AS kind, seller_id, leader_id AS buyer_id FROM auctions WHERE status = 'sold'`;

type SaleRow = { card_id: string; price: number; at: number; kind: Sale['kind']; seller_id: string; buyer_id: string };
const toSale = (r: SaleRow): Sale => ({ cardId: r.card_id, price: r.price, at: r.at, kind: r.kind, sellerId: r.seller_id, buyerId: r.buyer_id });

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Ventes d'une carte depuis un instant, de la plus récente à la plus ancienne. */
export function salesOf(db: DatabaseSync, cardId: string, since = 0): Sale[] {
  return (db.prepare(`SELECT * FROM (${SALES_SQL}) WHERE card_id = ? AND at >= ? ORDER BY at DESC`).all(cardId, since) as SaleRow[]).map(toSale);
}

export type CoteDay = { day: string; median: number | null; count: number };
export type Cote = {
  /** Médiane sur 30 jours, ou null si la carte n'est pas encore cotée. */
  cote: number | null;
  median7: number | null;
  median30: number | null;
  count30: number;
  low: number | null;
  high: number | null;
  /** Évolution de la médiane 7 jours par rapport à la médiane 30 jours, en %. */
  trend: number | null;
  days: CoteDay[];
  recent: Sale[];
};

/** Tout ce qu'il faut pour la fiche d'une carte : médianes, fourchette, une valeur par jour, dernières ventes. */
export function coteOf(db: DatabaseSync, cardId: string, span = 30, now = Date.now()): Cote {
  const since = now - Math.max(span, 30) * DAY;
  const sales = salesOf(db, cardId, since);
  const last30 = sales.filter((s) => s.at >= now - 30 * DAY).map((s) => s.price);
  const last7 = sales.filter((s) => s.at >= now - 7 * DAY).map((s) => s.price);
  const median30 = median(last30);
  const median7 = median(last7);
  const days: CoteDay[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const { key, start } = periodStart('daily', now - i * DAY);
    const end = start + DAY;
    const prices = sales.filter((s) => s.at >= start && s.at < end).map((s) => s.price);
    days.push({ day: key, median: median(prices), count: prices.length });
  }
  const inSpan = sales.filter((s) => s.at >= now - span * DAY).map((s) => s.price);
  return {
    cote: last30.length >= MIN_SALES_FOR_COTE ? median30 : null,
    median7,
    median30,
    count30: last30.length,
    low: inSpan.length ? Math.min(...inSpan) : null,
    high: inSpan.length ? Math.max(...inSpan) : null,
    trend: median7 !== null && median30 ? Math.round((median7 / median30 - 1) * 100) : null,
    days,
    recent: sales.slice(0, 8),
  };
}

/** Cotes de plusieurs cartes d'un coup (Guichet, collection) : médiane 30 jours, seulement si assez de ventes. */
export function cotes(db: DatabaseSync, now = Date.now()): Map<string, number> {
  const rows = db.prepare(`SELECT card_id, price FROM (${SALES_SQL}) WHERE at >= ?`).all(now - 30 * DAY) as { card_id: string; price: number }[];
  const by = new Map<string, number[]>();
  for (const r of rows) by.set(r.card_id, [...(by.get(r.card_id) ?? []), r.price]);
  const out = new Map<string, number>();
  for (const [id, prices] of by) if (prices.length >= MIN_SALES_FOR_COTE) out.set(id, median(prices)!);
  return out;
}

/** Écart d'un prix à la cote, en % (négatif = sous la cote, une bonne affaire). */
export function vsCote(price: number, cote: number | null | undefined): number | null {
  return cote ? Math.round((price / cote - 1) * 100) : null;
}

/** Toutes les ventes d'un joueur (comme vendeur ou acheteur), pour son journal. */
export function playerSales(db: DatabaseSync, playerId: string, since = 0): Sale[] {
  return (db.prepare(`SELECT * FROM (${SALES_SQL}) WHERE (seller_id = ? OR buyer_id = ?) AND at >= ? ORDER BY at DESC`).all(playerId, playerId, since) as SaleRow[]).map(toSale);
}
