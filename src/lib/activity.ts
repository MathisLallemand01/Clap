import type { DatabaseSync } from 'node:sqlite';
import { myAuctions, myLiveBids, settleAuctions } from './auctions.ts';
import { getCard } from './catalog.ts';
import { expireListings, sellerReceives } from './market.ts';
import { listTrades } from './social.ts';
import type { Card } from './types.ts';

// Le journal de tournage : tout ce qui passe par le Guichet et les échanges, au même endroit.

export type ActivityType = 'vente' | 'achat' | 'enchere' | 'echange' | 'cadeau' | 'expire';
export const ACTIVITY_FILTERS: { id: ActivityType | 'tout'; label: string }[] = [
  { id: 'tout', label: 'Tout' },
  { id: 'vente', label: 'Ventes' },
  { id: 'achat', label: 'Achats' },
  { id: 'enchere', label: 'Enchères' },
  { id: 'echange', label: 'Échanges' },
  { id: 'cadeau', label: 'Cadeaux' },
];

export type ActivityEntry = {
  at: number;
  type: ActivityType;
  title: string;
  sub: string;
  /** Sièges gagnés (positif) ou dépensés (négatif) ; null quand il n'y a pas d'argent en jeu. */
  seats: number | null;
  /** Texte à la place du montant (échanges, cadeaux). */
  label?: string;
  card: (Card & { serial?: number }) | null;
  href: string | null;
};

const DAY = 24 * 3600 * 1000;
const lot = (id: number) => `Lot Nº ${String(id).padStart(3, '0')}`;
const nameOf = (c: Card) => (c.character ? `${c.character} (${c.film ?? `${c.first} ${c.last}`})` : `${c.first} ${c.last}`);

export function activityOf(db: DatabaseSync, userId: string, playerId: string, now = Date.now()): ActivityEntry[] {
  settleAuctions(db, now);
  expireListings(db, now);
  const out: ActivityEntry[] = [];
  const users = (id: string | null) => (id ? (db.prepare('SELECT name FROM users WHERE player_id = ?').get(id) as { name: string } | undefined)?.name ?? 'un joueur' : 'un joueur');

  // Prix fixe : ce que j'ai vendu ou laissé expirer, ce que j'ai acheté.
  const listings = db.prepare(`SELECT l.id, l.card_id, l.price, l.status, l.seller_id, l.buyer_id, l.closed_at, l.created_at, o.serial FROM listings l JOIN owned o ON o.id = l.owned_id
    WHERE (l.seller_id = ? OR l.buyer_id = ?) AND l.status IN ('sold', 'expired') ORDER BY l.closed_at DESC LIMIT 200`).all(playerId, playerId) as
    { id: number; card_id: string; price: number; status: string; seller_id: string; buyer_id: string | null; closed_at: number; created_at: number; serial: number }[];
  for (const l of listings) {
    const card = getCard(db, l.card_id);
    if (!card) continue;
    if (l.status === 'expired') {
      out.push({ at: l.closed_at, type: 'expire', title: `Annonce expirée · ${nameOf(card)}`, sub: 'Personne n’a acheté à temps : la carte reste dans votre collection.', seats: null, label: '—', card, href: '/guichet?vue=mes-annonces' });
    } else if (l.seller_id === playerId) {
      out.push({ at: l.closed_at, type: 'vente', title: `Vente conclue · ${nameOf(card)}`, sub: `Achetée par ${users(l.buyer_id)} · prix ${l.price} − commission 5 %`, seats: sellerReceives(l.price), card: { ...card, serial: l.serial }, href: '/guichet?vue=mes-annonces' });
    } else {
      out.push({ at: l.closed_at, type: 'achat', title: `Achat · ${nameOf(card)}`, sub: `Vendue par ${users(l.seller_id)}`, seats: -l.price, card: { ...card, serial: l.serial }, href: `/guichet?annonce=${l.id}` });
    }
  }

  // Enchères : mes lots (adjugés, invendus), les lots remportés, ceux qui m'ont échappé.
  for (const a of myAuctions(db, playerId, 200, now)) {
    if (a.status === 'sold') out.push({ at: a.closedAt ?? a.endsAt, type: 'enchere', title: `${lot(a.id)} adjugé · ${nameOf(a.card)}`, sub: `À ${a.leaderName ?? 'un joueur'} après ${a.bids} offre${a.bids > 1 ? 's' : ''} · prix ${a.currentBid} − commission 5 %`, seats: sellerReceives(a.currentBid ?? 0), card: { ...a.card, serial: a.serial }, href: `/guichet?vue=encheres&lot=${a.id}` });
    else if (a.status === 'unsold') out.push({ at: a.closedAt ?? a.endsAt, type: 'expire', title: `${lot(a.id)} invendu · ${nameOf(a.card)}`, sub: 'Aucune enchère : la carte reste dans votre collection.', seats: null, label: '—', card: a.card, href: `/guichet?vue=encheres&lot=${a.id}` });
  }
  const bidOn = db.prepare(`SELECT DISTINCT a.id, a.card_id, a.current_bid, a.leader_id, a.closed_at, a.ends_at, a.bids, o.serial FROM auction_bids b JOIN auctions a ON a.id = b.auction_id JOIN owned o ON o.id = a.owned_id
    WHERE b.bidder_id = ? AND a.status = 'sold' AND a.seller_id != ?`).all(playerId, playerId) as { id: number; card_id: string; current_bid: number; leader_id: string; closed_at: number | null; ends_at: number; bids: number; serial: number }[];
  for (const a of bidOn) {
    const card = getCard(db, a.card_id);
    if (!card) continue;
    if (a.leader_id === playerId) out.push({ at: a.closed_at ?? a.ends_at, type: 'enchere', title: `Enchère remportée · ${lot(a.id)} · ${nameOf(card)}`, sub: `Adjugé à ${a.current_bid} sièges après ${a.bids} offre${a.bids > 1 ? 's' : ''}`, seats: -a.current_bid, card: { ...card, serial: a.serial }, href: `/guichet?vue=encheres&lot=${a.id}` });
    else out.push({ at: a.closed_at ?? a.ends_at, type: 'enchere', title: `Lot échappé · ${lot(a.id)} · ${nameOf(card)}`, sub: `Adjugé à ${users(a.leader_id)} pour ${a.current_bid} sièges · vos sièges vous ont été rendus`, seats: null, label: '—', card, href: `/guichet?vue=encheres&lot=${a.id}` });
  }

  // Échanges et cadeaux conclus.
  for (const t of listTrades(db, userId).history.filter((x) => x.status === 'accepted')) {
    const mine = t.from.id === userId;
    const partner = mine ? t.to.name : t.from.name;
    const gave = mine ? t.give : t.take;
    const got = mine ? t.take : t.give;
    const first = (got.cards[0] ?? gave.cards[0]) ?? null;
    if (t.gift) {
      out.push({ at: t.createdAt, type: 'cadeau', title: mine ? `Cadeau pour ${partner}` : `Cadeau reçu de ${partner}`, sub: [...(mine ? gave : got).cards.map((c) => `${c.first} ${c.last}`), (mine ? gave : got).tickets ? `${(mine ? gave : got).tickets} tickets` : ''].filter(Boolean).join(' · ') || '—', seats: null, label: mine ? `−${gave.cards.length} carte${gave.cards.length > 1 ? 's' : ''}` : `+${got.cards.length} carte${got.cards.length > 1 ? 's' : ''}`, card: first, href: '/echanges' });
    } else {
      out.push({ at: t.createdAt, type: 'echange', title: `Échange conclu avec ${partner}`, sub: `Vous donnez ${gave.cards.length} carte${gave.cards.length > 1 ? 's' : ''}${gave.tickets ? ` et ${gave.tickets} tickets` : ''} · vous recevez ${got.cards.length} carte${got.cards.length > 1 ? 's' : ''}${got.tickets ? ` et ${got.tickets} tickets` : ''}`, seats: null, label: `${gave.cards.length} ⇄ ${got.cards.length}`, card: first, href: '/echanges' });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

export type ActivitySummary = { income: number; incomeCount: number; spent: number; spentCount: number; trades: number };

export function summarize(entries: ActivityEntry[], now = Date.now()): ActivitySummary {
  const recent = entries.filter((e) => e.at >= now - 30 * DAY);
  const plus = recent.filter((e) => (e.seats ?? 0) > 0);
  const minus = recent.filter((e) => (e.seats ?? 0) < 0);
  return {
    income: plus.reduce((s, e) => s + (e.seats ?? 0), 0), incomeCount: plus.length,
    spent: -minus.reduce((s, e) => s + (e.seats ?? 0), 0), spentCount: minus.length,
    trades: recent.filter((e) => e.type === 'echange' || e.type === 'cadeau').length,
  };
}

/** Ce qui tourne encore : mes enchères en cours (en tête ou dépassé), mes lots et mes annonces ouvertes. */
export function liveActivity(db: DatabaseSync, playerId: string, now = Date.now()) {
  const bids = myLiveBids(db, playerId, now);
  const lots = myAuctions(db, playerId, 40, now).filter((a) => a.status === 'open');
  return { bids, lots };
}
