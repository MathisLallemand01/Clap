import type { DatabaseSync } from 'node:sqlite';
import { getCard } from './catalog.ts';
import { queueCelebration } from './celebrations.ts';
import { cotes } from './cote.ts';
import { BUSY_OWNED_SQL, transaction } from './db.ts';
import { addSeats, GameError } from './game.ts';
import { MARKET_FEE, priceRange, sellerReceives } from './market.ts';
import { logEvent, notifyPlayer } from './notify.ts';
import { TRADE_MIN_PULLS } from './social.ts';
import type { Card } from './types.ts';
import { triggerWatches } from './watch.ts';

// La Salle des ventes : une carte = un lot. Les joueurs enchérissent en sièges ; à la fin du compte à rebours,
// le lot est adjugé au plus offrant.
//
// Enchère automatique : chaque enchérisseur donne un plafond (secret). Le lot monte par paliers de 5 % au-dessus
// de l'offre battue, sans jamais dépasser le plafond du meneur. Les sièges du meneur (tout son plafond) sont mis
// de côté ; dépassé, il les récupère aussitôt. À la fin, il ne paie que l'enchère atteinte.

export const AUCTION_HOURS = [1, 6, 24, 72] as const;
/** Palier minimum entre deux enchères. */
export const BID_STEP = 0.05;
/** Une enchère dans la dernière minute rallonge le lot de 2 minutes : pas de vol à la dernière seconde. */
export const SNIPE_WINDOW_MS = 60_000;
export const SNIPE_EXTENSION_MS = 120_000;
export const AUCTION_FEE = MARKET_FEE;

export type AuctionStatus = 'open' | 'sold' | 'unsold' | 'cancelled';
export type Auction = {
  id: number;
  card: Card;
  serial: number;
  sellerId: string;
  sellerName: string;
  startPrice: number;
  buyout: number | null;
  currentBid: number | null;
  leaderId: string | null;
  leaderName: string | null;
  bids: number;
  status: AuctionStatus;
  createdAt: number;
  endsAt: number;
  closedAt: number | null;
  /** Prochaine enchère acceptée. */
  minNext: number;
};
export type Bid = { bidderId: string; bidderName: string; amount: number; auto: boolean; at: number };

/** Le palier suivant : +5 % (au moins +1 siège). */
export const nextStep = (amount: number) => Math.max(amount + 1, Math.ceil(amount * (1 + BID_STEP)));

const SELECT = `
  SELECT a.*, o.serial, us.name AS seller_name, ul.name AS leader_name
  FROM auctions a JOIN owned o ON o.id = a.owned_id
  LEFT JOIN users us ON us.player_id = a.seller_id LEFT JOIN users ul ON ul.player_id = a.leader_id`;
type Row = {
  id: number; seller_id: string; owned_id: number; card_id: string; start_price: number; buyout: number | null; current_bid: number | null;
  leader_id: string | null; leader_max: number | null; bids: number; status: AuctionStatus; created_at: number; ends_at: number; closed_at: number | null;
  serial: number; seller_name: string | null; leader_name: string | null;
};

function toAuction(db: DatabaseSync, r: Row): Auction | null {
  const card = getCard(db, r.card_id);
  if (!card) return null;
  return {
    id: r.id, card, serial: r.serial, sellerId: r.seller_id, sellerName: r.seller_name ?? 'Joueur', startPrice: r.start_price, buyout: r.buyout,
    currentBid: r.current_bid, leaderId: r.leader_id, leaderName: r.leader_name, bids: r.bids, status: r.status,
    createdAt: r.created_at, endsAt: r.ends_at, closedAt: r.closed_at, minNext: r.current_bid === null ? r.start_price : nextStep(r.current_bid),
  };
}

const nameOf = (db: DatabaseSync, playerId: string) =>
  (db.prepare('SELECT name FROM users WHERE player_id = ?').get(playerId) as { name: string } | undefined)?.name ?? 'Un joueur';
const cardName = (c: Card) => c.character ?? `${c.first} ${c.last}`;
const isUnlimited = (db: DatabaseSync, playerId: string) =>
  Boolean((db.prepare('SELECT unlimited FROM players WHERE id = ?').get(playerId) as { unlimited: number } | undefined)?.unlimited);

function requireVeteran(db: DatabaseSync, playerId: string): void {
  if (isUnlimited(db, playerId)) return;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM pulls WHERE player_id = ?').get(playerId) as { n: number };
  if (n < TRADE_MIN_PULLS) throw new GameError('trade-locked', `La Salle des ventes ouvre après ${TRADE_MIN_PULLS} bobines ouvertes (encore ${TRADE_MIN_PULLS - n}).`);
}

/** Adjuge les lots dont le compte à rebours est fini. Appelé à chaque lecture : pas besoin de tâche planifiée. */
export function settleAuctions(db: DatabaseSync, now = Date.now()): number {
  const due = db.prepare("SELECT id FROM auctions WHERE status = 'open' AND ends_at <= ?").all(now) as { id: number }[];
  for (const { id } of due) transaction(db, () => settleOne(db, id, now));
  return due.length;
}

function settleOne(db: DatabaseSync, id: number, now: number): void {
  const a = db.prepare("SELECT * FROM auctions WHERE id = ? AND status = 'open'").get(id) as Row | undefined;
  if (!a) return;
  const card = getCard(db, a.card_id)!;
  if (!a.leader_id || a.current_bid === null) {
    db.prepare("UPDATE auctions SET status = 'unsold', closed_at = ? WHERE id = ?").run(now, id);
    notifyPlayer(db, a.seller_id, 'auction', `Lot Nº ${String(id).padStart(3, '0')} · ${cardName(card)} : personne n’a enchéri, la carte revient dans votre collection.`, '/guichet?vue=activite', now);
    return;
  }
  closeSold(db, a, a.leader_id, a.current_bid, a.leader_max ?? a.current_bid, now);
}

/** Lot adjugé : la carte change de main, le gagnant récupère ce qu'il avait mis de côté au-delà du prix, le vendeur est payé. */
function closeSold(db: DatabaseSync, a: Row, winner: string, price: number, escrowed: number, now: number): void {
  const card = getCard(db, a.card_id)!;
  const cote = cotes(db, now).get(a.card_id);
  if (cote && price >= cote * 2) logEvent(db, a.seller_id, 'flip2x', 1, now);
  if (escrowed > price) addSeats(db, winner, escrowed - price);
  addSeats(db, a.seller_id, sellerReceives(price));
  db.prepare('UPDATE owned SET player_id = ?, obtained_at = ? WHERE id = ?').run(winner, now, a.owned_id);
  db.prepare("UPDATE auctions SET status = 'sold', current_bid = ?, leader_id = ?, closed_at = ?, ends_at = MIN(ends_at, ?) WHERE id = ?").run(price, winner, now, now, a.id);
  logEvent(db, a.seller_id, 'sell', 1, now);
  logEvent(db, winner, 'buy', 1, now);
  logEvent(db, winner, 'auction-won', 1, now);
  const lot = `Lot Nº ${String(a.id).padStart(3, '0')}`;
  const winnerName = nameOf(db, winner);
  queueCelebration(db, winner, { kind: 'auction', cardId: a.card_id, serial: a.serial ?? serialOf(db, a.owned_id), price, lot }, now);
  queueCelebration(db, a.seller_id, { kind: 'sale', cardId: a.card_id, serial: a.serial ?? serialOf(db, a.owned_id), price, received: sellerReceives(price), buyer: winnerName }, now);
  notifyPlayer(db, winner, 'auction', `Adjugé, vendu ! ${lot} · ${cardName(card)} est à vous pour ${price} sièges.`, `/guichet?vue=encheres&lot=${a.id}`, now);
  notifyPlayer(db, a.seller_id, 'auction', `${lot} · ${cardName(card)} adjugé à ${winnerName} pour ${price} sièges (+${sellerReceives(price)} après commission).`, '/guichet?vue=activite', now);
  // Les autres enchérisseurs : le lot leur échappe.
  const others = db.prepare('SELECT DISTINCT bidder_id FROM auction_bids WHERE auction_id = ? AND bidder_id != ?').all(a.id, winner) as { bidder_id: string }[];
  for (const o of others) notifyPlayer(db, o.bidder_id, 'auction', `${lot} · ${cardName(card)} adjugé à ${winnerName} pour ${price} sièges.`, `/guichet?vue=encheres&lot=${a.id}`, now);
}

const serialOf = (db: DatabaseSync, ownedId: number) => (db.prepare('SELECT serial FROM owned WHERE id = ?').get(ownedId) as { serial: number }).serial;

export function openAuctions(db: DatabaseSync, now = Date.now()): Auction[] {
  settleAuctions(db, now);
  return (db.prepare(`${SELECT} WHERE a.status = 'open' ORDER BY a.ends_at`).all() as Row[]).flatMap((r) => toAuction(db, r) ?? []);
}

export function getAuction(db: DatabaseSync, id: number, now = Date.now()): Auction | null {
  settleAuctions(db, now);
  const r = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Row | undefined;
  return r ? toAuction(db, r) : null;
}

/** Le plafond secret du meneur : visible seulement par lui. */
export function leaderMax(db: DatabaseSync, id: number, playerId: string): number | null {
  const r = db.prepare('SELECT leader_max FROM auctions WHERE id = ? AND leader_id = ?').get(id, playerId) as { leader_max: number } | undefined;
  return r?.leader_max ?? null;
}

/** Le carnet du commissaire-priseur : les offres visibles (montants atteints), de la plus récente à la plus ancienne. */
export function auctionBids(db: DatabaseSync, id: number, limit = 12): Bid[] {
  return (db.prepare(`SELECT b.bidder_id, u.name, b.amount, b.auto, b.created_at FROM auction_bids b LEFT JOIN users u ON u.player_id = b.bidder_id
    WHERE b.auction_id = ? ORDER BY b.id DESC LIMIT ?`).all(id, limit) as { bidder_id: string; name: string | null; amount: number; auto: number; created_at: number }[])
    .map((r) => ({ bidderId: r.bidder_id, bidderName: r.name ?? 'Joueur', amount: r.amount, auto: r.auto === 1, at: r.created_at }));
}

export function auctionRange(card: Card): { min: number; max: number } {
  const r = priceRange(card.rarity);
  return { min: r.min, max: r.max * 3 };
}

/** Met un exemplaire (le numéro le plus haut) aux enchères. */
export function createAuction(
  db: DatabaseSync,
  playerId: string,
  input: { cardId: string; startPrice: number; buyout: number | null; hours: number },
  now = Date.now(),
): number {
  const card = getCard(db, input.cardId);
  if (!card) throw new GameError('unknown-card', 'Carte inconnue.');
  requireVeteran(db, playerId);
  const { min, max } = auctionRange(card);
  if (!Number.isInteger(input.startPrice) || input.startPrice < min || input.startPrice > max) {
    throw new GameError('bad-price', `La mise à prix doit être comprise entre ${min} et ${max} sièges.`);
  }
  if (input.buyout !== null && (!Number.isInteger(input.buyout) || input.buyout <= input.startPrice || input.buyout > max * 2)) {
    throw new GameError('bad-buyout', `Le prix d’achat immédiat doit dépasser la mise à prix (au plus ${max * 2} sièges).`);
  }
  if (!AUCTION_HOURS.includes(input.hours as (typeof AUCTION_HOURS)[number])) throw new GameError('bad-duration', 'Durée invalide.');
  const id = transaction(db, () => {
    const copy = db.prepare(`SELECT o.id FROM owned o WHERE o.player_id = ? AND o.card_id = ? AND o.id NOT IN (${BUSY_OWNED_SQL}) ORDER BY o.serial DESC LIMIT 1`)
      .get(playerId, card.id) as { id: number } | undefined;
    if (!copy) throw new GameError('not-owned', 'Vous n’avez plus d’exemplaire libre de cette carte.');
    const res = db.prepare('INSERT INTO auctions (seller_id, owned_id, card_id, start_price, buyout, created_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(playerId, copy.id, card.id, input.startPrice, input.buyout, now, now + input.hours * 3600 * 1000);
    return Number(res.lastInsertRowid);
  });
  triggerWatches(db, { cardId: card.id, price: input.startPrice, kind: 'enchere', href: `/guichet?vue=encheres&lot=${id}`, sellerId: playerId }, now);
  return id;
}

export function cancelAuction(db: DatabaseSync, playerId: string, id: number, now = Date.now()): void {
  transaction(db, () => {
    const a = db.prepare("SELECT bids FROM auctions WHERE id = ? AND seller_id = ? AND status = 'open'").get(id, playerId) as { bids: number } | undefined;
    if (!a) throw new GameError('not-found', 'Lot introuvable.');
    if (a.bids > 0) throw new GameError('has-bids', 'Des enchères sont déjà posées : le lot ne peut plus être retiré.');
    db.prepare("UPDATE auctions SET status = 'cancelled', closed_at = ? WHERE id = ?").run(now, id);
  });
}

export type BidResult = { outcome: 'leading' | 'outbid' | 'won'; current: number };

/**
 * Pose une enchère. `amount` est l'offre affichée ; `max` (facultatif) le plafond de l'enchère automatique.
 * Atteindre le prix d'achat immédiat adjuge le lot tout de suite.
 */
export function placeBid(db: DatabaseSync, bidderId: string, id: number, amount: number, max: number | null = null, now = Date.now()): BidResult {
  settleAuctions(db, now);
  requireVeteran(db, bidderId);
  return transaction(db, () => {
    const a = db.prepare("SELECT a.*, o.serial FROM auctions a JOIN owned o ON o.id = a.owned_id WHERE a.id = ? AND a.status = 'open'").get(id) as Row | undefined;
    if (!a || a.ends_at <= now) throw new GameError('closed', 'Ce lot est déjà adjugé.');
    if (a.seller_id === bidderId) throw new GameError('own-lot', 'Vous ne pouvez pas enchérir sur votre propre lot.');
    if (!Number.isInteger(amount) || amount < 1) throw new GameError('bad-bid', 'Enchère invalide.');
    const card = getCard(db, a.card_id)!;
    const lot = `Lot Nº ${String(a.id).padStart(3, '0')}`;
    const minNext = a.current_bid === null ? a.start_price : nextStep(a.current_bid);

    // Achat immédiat.
    if (a.buyout !== null && amount >= a.buyout) {
      if (a.leader_id && a.leader_max) {
        addSeats(db, a.leader_id, a.leader_max);
        if (a.leader_id !== bidderId) notifyPlayer(db, a.leader_id, 'auction', `${lot} · ${cardName(card)} : ${nameOf(db, bidderId)} l’a adjugé à son prix d’achat immédiat. Vos ${a.leader_max} sièges vous sont rendus.`, `/guichet?vue=encheres&lot=${a.id}`, now, { urgent: true });
      }
      addSeats(db, bidderId, -a.buyout);
      db.prepare('INSERT INTO auction_bids (auction_id, bidder_id, amount, auto, created_at) VALUES (?, ?, ?, 0, ?)').run(a.id, bidderId, a.buyout, now);
      db.prepare('UPDATE auctions SET bids = bids + 1 WHERE id = ?').run(a.id);
      closeSold(db, a, bidderId, a.buyout, a.buyout, now);
      return { outcome: 'won', current: a.buyout };
    }

    // Le meneur relève son plafond.
    if (a.leader_id === bidderId) {
      const newMax = Math.max(amount, max ?? 0);
      if (newMax <= (a.leader_max ?? 0)) throw new GameError('already-leading', 'Vous menez déjà ce lot. Pour aller plus loin, relevez votre plafond.');
      addSeats(db, bidderId, -(newMax - (a.leader_max ?? 0)));
      db.prepare('UPDATE auctions SET leader_max = ? WHERE id = ?').run(newMax, a.id);
      return { outcome: 'leading', current: a.current_bid ?? a.start_price };
    }

    if (amount < minNext) throw new GameError('too-low', `L’enchère minimum est de ${minNext} sièges.`);
    const myMax = Math.max(amount, max ?? 0);
    const extend = a.ends_at - now < SNIPE_WINDOW_MS ? now + SNIPE_EXTENSION_MS : a.ends_at;
    const log = db.prepare('INSERT INTO auction_bids (auction_id, bidder_id, amount, auto, created_at) VALUES (?, ?, ?, ?, ?)');

    if (!a.leader_id || a.leader_max === null) {
      addSeats(db, bidderId, -myMax);
      log.run(a.id, bidderId, amount, 0, now);
      db.prepare('UPDATE auctions SET current_bid = ?, leader_id = ?, leader_max = ?, bids = bids + 1, ends_at = ? WHERE id = ?').run(amount, bidderId, myMax, extend, a.id);
      logEvent(db, bidderId, 'bid', 1, now);
      return { outcome: 'leading', current: amount };
    }

    if (myMax > a.leader_max) {
      // Le nouveau venu passe devant : l'ancien meneur récupère ses sièges.
      const current = Math.min(myMax, Math.max(amount, nextStep(a.leader_max)));
      addSeats(db, a.leader_id, a.leader_max);
      addSeats(db, bidderId, -myMax);
      if (a.leader_max > (a.current_bid ?? 0)) log.run(a.id, a.leader_id, a.leader_max, 1, now);
      log.run(a.id, bidderId, current, current > amount ? 1 : 0, now);
      db.prepare('UPDATE auctions SET current_bid = ?, leader_id = ?, leader_max = ?, bids = bids + 1, ends_at = ? WHERE id = ?').run(current, bidderId, myMax, extend, a.id);
      notifyPlayer(db, a.leader_id, 'auction', `Vous avez été surenchéri : ${lot} · ${cardName(card)} monte à ${current} sièges. Vos sièges vous sont rendus.`, `/guichet?vue=encheres&lot=${a.id}`, now, { urgent: true });
      logEvent(db, bidderId, 'bid', 1, now);
      return { outcome: 'leading', current };
    }

    // Le plafond du meneur couvre l'offre : il reste devant, l'enchère monte d'un palier au-dessus.
    const current = Math.min(a.leader_max, nextStep(myMax));
    log.run(a.id, bidderId, myMax, 0, now);
    log.run(a.id, a.leader_id, current, 1, now);
    db.prepare('UPDATE auctions SET current_bid = ?, bids = bids + 1, ends_at = ? WHERE id = ?').run(current, extend, a.id);
    logEvent(db, bidderId, 'bid', 1, now);
    return { outcome: 'outbid', current };
  });
}

/** Les lots où un joueur a enchéri et qui sont encore en salle, avec sa situation. */
export function myLiveBids(db: DatabaseSync, playerId: string, now = Date.now()): (Auction & { leading: boolean; myMax: number | null })[] {
  settleAuctions(db, now);
  const ids = (db.prepare("SELECT DISTINCT b.auction_id AS id FROM auction_bids b JOIN auctions a ON a.id = b.auction_id WHERE b.bidder_id = ? AND a.status = 'open'").all(playerId) as { id: number }[]).map((r) => r.id);
  return ids.flatMap((id) => {
    const a = getAuction(db, id, now);
    return a ? [{ ...a, leading: a.leaderId === playerId, myMax: leaderMax(db, id, playerId) }] : [];
  }).sort((x, y) => x.endsAt - y.endsAt);
}

/** Les lots d'un joueur (vendeur), récents d'abord. */
export function myAuctions(db: DatabaseSync, playerId: string, limit = 40, now = Date.now()): Auction[] {
  settleAuctions(db, now);
  return (db.prepare(`${SELECT} WHERE a.seller_id = ? ORDER BY a.status = 'open' DESC, a.created_at DESC LIMIT ?`).all(playerId, limit) as Row[]).flatMap((r) => toAuction(db, r) ?? []);
}

export { AUCTION_FEE as FEE };
export { sellerReceives };
