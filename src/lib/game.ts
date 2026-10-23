import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { FREE_BOOSTER_CAP, FREE_BOOSTER_EVERY_MS, getBooster } from './boosters.ts';
import { getCard, getCatalog, poolOf } from './catalog.ts';
import { rowToCard, transaction, type CardRow } from './db.ts';
import { logEvent, notify, notifyPlayer } from './notify.ts';
import { openBooster, type Rng } from './pull.ts';
import { RARITIES, suggestedTickets } from './rarity.ts';
import type { Card, OwnedCard } from './types.ts';

export { getCatalog };

export const STARTING_TICKETS = 600;
/** Récompense de parrainage, pour le parrain comme pour le filleul. */
export const REFERRAL_REWARD = 500;
/** Le parrainage est validé quand le filleul a ouvert ce nombre de bobines. */
export const REFERRAL_PULLS = 3;
/** Bonus du parrain quand il atteint un nombre d'amis parrainés. */
export const REFERRAL_TIERS: { friends: number; tickets?: number; card?: 'chef' }[] = [
  { friends: 3, tickets: 1200 },
  { friends: 5, tickets: 2000 },
  { friends: 10, card: 'chef' },
];

export type Player = {
  id: string;
  tickets: number;
  freeStock: number;
  /** Instant où la prochaine bobine offerte arrive, ou null si la réserve est pleine. */
  nextFreeAt: number | null;
  /** Compte de test : les tickets ne sont jamais débités. */
  unlimited: boolean;
};

/** Solde affiché pour un compte illimité : assez pour que tous les achats passent. */
export const UNLIMITED_TICKETS = 999_999_999;

type PlayerRow = { id: string; tickets: number; free_stock: number; free_updated_at: number; unlimited: number };

export class GameError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Recharge les bobines offertes accumulées depuis la dernière mise à jour. */
function regenerate(row: PlayerRow, now: number): { stock: number; updatedAt: number } {
  if (row.free_stock >= FREE_BOOSTER_CAP) return { stock: row.free_stock, updatedAt: now };
  const earned = Math.floor((now - row.free_updated_at) / FREE_BOOSTER_EVERY_MS);
  const stock = Math.min(FREE_BOOSTER_CAP, row.free_stock + earned);
  const updatedAt = stock >= FREE_BOOSTER_CAP ? now : row.free_updated_at + earned * FREE_BOOSTER_EVERY_MS;
  return { stock, updatedAt };
}

function toPlayer(row: PlayerRow, stock: number, updatedAt: number): Player {
  return {
    id: row.id,
    tickets: row.unlimited ? UNLIMITED_TICKETS : row.tickets,
    freeStock: stock,
    nextFreeAt: stock >= FREE_BOOSTER_CAP ? null : updatedAt + FREE_BOOSTER_EVERY_MS,
    unlimited: row.unlimited === 1,
  };
}

export function createPlayer(db: DatabaseSync, now = Date.now()): Player {
  const id = randomUUID();
  db.prepare('INSERT INTO players (id, created_at, tickets, free_stock, free_updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, now, STARTING_TICKETS, FREE_BOOSTER_CAP, now);
  return { id, tickets: STARTING_TICKETS, freeStock: FREE_BOOSTER_CAP, nextFreeAt: null, unlimited: false };
}

export function getPlayer(db: DatabaseSync, id: string, now = Date.now()): Player | null {
  const row = db.prepare('SELECT id, tickets, free_stock, free_updated_at, unlimited FROM players WHERE id = ?').get(id) as
    | PlayerRow
    | undefined;
  if (!row) return null;
  const { stock, updatedAt } = regenerate(row, now);
  return toPlayer(row, stock, updatedAt);
}

/** Crédite (ou débite, si négatif) des tickets ; refuse de passer sous zéro. */
export function addTickets(db: DatabaseSync, playerId: string, amount: number): void {
  if (amount < 0 && (db.prepare('SELECT unlimited FROM players WHERE id = ?').get(playerId) as { unlimited: number } | undefined)?.unlimited) return;
  const res = db.prepare('UPDATE players SET tickets = tickets + ? WHERE id = ? AND tickets + ? >= 0').run(amount, playerId, amount);
  if (res.changes === 0) throw new GameError('not-enough-tickets', 'Pas assez de tickets.');
}

export type PulledCard = Card & { serial: number; isNew: boolean };

export type OpenResult = {
  pullId: number;
  boosterId: string;
  paidWith: 'free' | 'tickets';
  cards: PulledCard[];
  player: Player;
};

/** Valide le parrainage quand le filleul vient d'ouvrir sa N-ième bobine. */
function rewardReferral(db: DatabaseSync, playerId: string, now: number): void {
  const user = db.prepare('SELECT id, name, referred_by, referral_rewarded FROM users WHERE player_id = ?').get(playerId) as
    | { id: string; name: string; referred_by: string | null; referral_rewarded: number }
    | undefined;
  if (!user?.referred_by || user.referral_rewarded) return;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM pulls WHERE player_id = ?').get(playerId) as { n: number };
  if (n < REFERRAL_PULLS) return;
  const sponsor = db.prepare('SELECT id, player_id FROM users WHERE id = ?').get(user.referred_by) as { id: string; player_id: string } | undefined;
  db.prepare('UPDATE users SET referral_rewarded = 1 WHERE id = ?').run(user.id);
  addTickets(db, playerId, REFERRAL_REWARD);
  notify(db, user.id, 'referral', `Parrainage validé : +${REFERRAL_REWARD} tickets pour bien démarrer.`, '/missions', now);
  if (sponsor) {
    addTickets(db, sponsor.player_id, REFERRAL_REWARD);
    notify(db, sponsor.id, 'referral', `${user.name} a ouvert ses ${REFERRAL_PULLS} premières bobines : +${REFERRAL_REWARD} tickets.`, '/parrainage', now);
    const { n: validated } = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_rewarded = 1').get(sponsor.id) as { n: number };
    const tier = REFERRAL_TIERS.find((t) => t.friends === validated);
    if (tier?.tickets) {
      addTickets(db, sponsor.player_id, tier.tickets);
      notify(db, sponsor.id, 'referral', `Palier de parrainage ${tier.friends} amis : +${tier.tickets} tickets !`, '/parrainage', now);
    }
    if (tier?.card) {
      const chef = getCatalog(db).filter((c) => c.rarity === tier.card);
      const card = chef[Math.floor(Math.random() * chef.length)];
      if (card) {
        const serial = (db.prepare('SELECT COUNT(*) AS n FROM owned WHERE card_id = ?').get(card.id) as { n: number }).n + 1;
        db.prepare('INSERT INTO owned (player_id, card_id, serial, pull_id, obtained_at) VALUES (?, ?, ?, NULL, ?)').run(sponsor.player_id, card.id, serial, now);
        notify(db, sponsor.id, 'pull', `Palier de parrainage ${tier.friends} amis : ${card.first} ${card.last} dans ${card.film}, un Chef-d’œuvre !`, `/role/${encodeURIComponent(card.id)}`, now);
      }
    }
  }
}

/**
 * Ouvre une bobine pour un joueur : utilise une bobine offerte s'il en reste,
 * sinon débite le prix en tickets. Tout se fait dans une seule transaction.
 */
export function openBoosterFor(
  db: DatabaseSync,
  playerId: string,
  boosterId: string,
  { now = Date.now(), rng = Math.random as Rng } = {},
): OpenResult {
  const def = getBooster(boosterId);
  if (!def) throw new GameError('unknown-booster', `Bobine inconnue : ${boosterId}`);
  const pool = poolOf(db, def);

  return transaction(db, () => {
    const row = db.prepare('SELECT id, tickets, free_stock, free_updated_at, unlimited FROM players WHERE id = ?').get(playerId) as
      | PlayerRow
      | undefined;
    if (!row) throw new GameError('unknown-player', 'Joueur inconnu');

    let { stock, updatedAt } = regenerate(row, now);
    let tickets = row.tickets;
    let paidWith: OpenResult['paidWith'];
    if (stock > 0) {
      // La recharge repart de maintenant quand on entame une réserve pleine.
      if (stock >= FREE_BOOSTER_CAP) updatedAt = now;
      stock -= 1;
      paidWith = 'free';
    } else if (row.unlimited || tickets >= def.price) {
      if (!row.unlimited) tickets -= def.price;
      paidWith = 'tickets';
    } else {
      throw new GameError('not-enough-tickets', `Il faut ${def.price} tickets pour ouvrir ${def.name}.`);
    }

    db.prepare('UPDATE players SET tickets = ?, free_stock = ?, free_updated_at = ? WHERE id = ?')
      .run(tickets, stock, updatedAt, playerId);
    const { lastInsertRowid } = db.prepare('INSERT INTO pulls (player_id, booster_id, paid_with, created_at) VALUES (?, ?, ?, ?)')
      .run(playerId, boosterId, paidWith, now);
    const pullId = Number(lastInsertRowid);

    const countCopies = db.prepare('SELECT COUNT(*) AS n FROM owned WHERE card_id = ?');
    const countMine = db.prepare('SELECT COUNT(*) AS n FROM owned WHERE card_id = ? AND player_id = ?');
    const insertOwned = db.prepare('INSERT INTO owned (player_id, card_id, serial, pull_id, obtained_at) VALUES (?, ?, ?, ?, ?)');

    const cards = openBooster({ ...def, tags: undefined }, pool, rng).map((card): PulledCard => {
      const serial = (countCopies.get(card.id) as { n: number }).n + 1;
      const isNew = (countMine.get(card.id, playerId) as { n: number }).n === 0;
      insertOwned.run(playerId, card.id, serial, pullId, now);
      return { ...card, serial, isNew };
    });

    logEvent(db, playerId, 'open', 1, now);
    logEvent(db, playerId, `open:${def.group}`, 1, now);
    const rare = cards.filter((c) => RARITIES[c.rarity].tier >= 3).length;
    if (rare) logEvent(db, playerId, 'rare', rare, now);
    for (const c of cards.filter((c) => c.rarity === 'icone' || c.rarity === 'legende')) {
      notifyPlayer(db, playerId, 'pull', `Vous avez tiré ${c.first} ${c.last}${c.character ? ` (${c.character})` : ''} : ${RARITIES[c.rarity].label} !`, c.kind === 'role' ? `/role/${encodeURIComponent(c.id)}` : `/acteur/${c.personId}`, now);
    }
    rewardReferral(db, playerId, now);
    const fresh = db.prepare('SELECT tickets FROM players WHERE id = ?').get(playerId) as { tickets: number };

    return { pullId, boosterId, paidWith, cards, player: toPlayer({ ...row, tickets: fresh.tickets }, stock, updatedAt) };
  });
}

/** Exemplaires d'un joueur actuellement en vente au Guichet. */
function listedOwnedIds(db: DatabaseSync, playerId: string): Set<number> {
  return new Set((db.prepare("SELECT owned_id FROM listings WHERE seller_id = ? AND status = 'open'").all(playerId) as { owned_id: number }[]).map((r) => r.owned_id));
}

/** La collection d'un joueur : une entrée par carte, avec son meilleur numéro de série. */
export function getCollection(db: DatabaseSync, playerId: string): OwnedCard[] {
  const rows = db.prepare(`
    SELECT c.*, MIN(o.serial) AS serial, MAX(o.obtained_at) AS obtained_at, COUNT(*) AS copies
    FROM owned o JOIN cards c ON c.id = o.card_id
    WHERE o.player_id = ?
    GROUP BY c.id`).all(playerId) as (CardRow & { serial: number; obtained_at: number; copies: number })[];
  return rows
    .map((r) => ({ ...rowToCard(r), serial: r.serial, obtainedAt: r.obtained_at, copies: r.copies }))
    .sort((a, b) => RARITIES[b.rarity].entries - RARITIES[a.rarity].entries || a.last.localeCompare(b.last, 'fr'));
}

/** Les exemplaires possédés d'une carte, du meilleur numéro au moins bon. */
export function ownedCopies(db: DatabaseSync, playerId: string, cardId: string): { id: number; serial: number; listed: boolean }[] {
  const listed = listedOwnedIds(db, playerId);
  return (db.prepare('SELECT id, serial FROM owned WHERE player_id = ? AND card_id = ? ORDER BY serial').all(playerId, cardId) as { id: number; serial: number }[])
    .map((r) => ({ ...r, listed: listed.has(r.id) }));
}

export type PlayerStats = { entries: number; unique: number; copies: number; pulls: number; duplicates: number };

/** Box-office personnel : la somme des entrées de tous les exemplaires possédés. */
export function getStats(db: DatabaseSync, playerId: string): PlayerStats {
  const owned = db.prepare('SELECT c.rarity AS rarity FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ?')
    .all(playerId) as { rarity: Card['rarity'] }[];
  const unique = (db.prepare('SELECT COUNT(DISTINCT card_id) AS n FROM owned WHERE player_id = ?').get(playerId) as { n: number }).n;
  const pulls = (db.prepare('SELECT COUNT(*) AS n FROM pulls WHERE player_id = ?').get(playerId) as { n: number }).n;
  return {
    entries: owned.reduce((sum, o) => sum + RARITIES[o.rarity].entries, 0),
    unique,
    copies: owned.length,
    pulls,
    duplicates: owned.length - unique,
  };
}

/** Les dernières cartes tirées, de la plus récente à la plus ancienne. */
export function getRecentCards(db: DatabaseSync, playerId: string, limit = 10): Card[] {
  const rows = db.prepare(`
    SELECT c.* FROM owned o JOIN cards c ON c.id = o.card_id
    WHERE o.player_id = ? ORDER BY o.id DESC LIMIT ?`).all(playerId, limit) as CardRow[];
  return rows.map(rowToCard);
}

export type RecyclePlan = { items: { card: Card; extra: number; tickets: number }[]; cards: number; tickets: number };

/** Ce que rapporterait le recyclage des doublons (on garde toujours le meilleur numéro de chaque carte). */
export function recyclePlan(db: DatabaseSync, playerId: string): RecyclePlan {
  const listed = listedOwnedIds(db, playerId);
  const rows = db.prepare('SELECT id, card_id FROM owned WHERE player_id = ? ORDER BY card_id, serial').all(playerId) as { id: number; card_id: string }[];
  const byCard = new Map<string, number[]>();
  for (const r of rows) byCard.set(r.card_id, [...(byCard.get(r.card_id) ?? []), r.id]);
  const items: RecyclePlan['items'] = [];
  for (const [cardId, ids] of byCard) {
    const extra = ids.slice(1).filter((id) => !listed.has(id)).length;
    const card = getCard(db, cardId);
    if (extra > 0 && card) items.push({ card, extra, tickets: extra * suggestedTickets(card.rarity) });
  }
  items.sort((a, b) => b.tickets - a.tickets);
  return { items, cards: items.reduce((s, i) => s + i.extra, 0), tickets: items.reduce((s, i) => s + i.tickets, 0) };
}

/** Recycle tous les doublons (hors cartes en vente) contre leur prix conseillé en tickets. */
export function recycleDuplicates(db: DatabaseSync, playerId: string, now = Date.now()): { cards: number; tickets: number } {
  return transaction(db, () => {
    const listed = listedOwnedIds(db, playerId);
    const rows = db.prepare('SELECT o.id, o.card_id, c.rarity FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ? ORDER BY o.card_id, o.serial')
      .all(playerId) as { id: number; card_id: string; rarity: Card['rarity'] }[];
    const seen = new Set<string>();
    const remove = db.prepare('DELETE FROM owned WHERE id = ?');
    let cards = 0;
    let tickets = 0;
    for (const r of rows) {
      if (!seen.has(r.card_id)) {
        seen.add(r.card_id);
        continue;
      }
      if (listed.has(r.id)) continue;
      remove.run(r.id);
      cards++;
      tickets += suggestedTickets(r.rarity);
    }
    if (cards) {
      addTickets(db, playerId, tickets);
      logEvent(db, playerId, 'recycle', cards, now);
    }
    return { cards, tickets };
  });
}
