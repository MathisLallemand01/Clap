import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { FREE_BOOSTER_CAP, FREE_BOOSTER_EVERY_MS, getBooster } from './boosters.ts';
import { rowToCard, transaction } from './db.ts';
import { openBooster, type Rng } from './pull.ts';
import { RARITIES } from './rarity.ts';
import type { Card, OwnedCard } from './types.ts';

export const STARTING_TICKETS = 600;

export type Player = {
  id: string;
  /** Pseudo et e-mail d'un compte ; null pour un joueur invité. */
  name: string | null;
  email: string | null;
  /** Dernier jour (AAAA-MM-JJ, heure de Paris) où la prime quotidienne a été prise. */
  lastDaily: string | null;
  tickets: number;
  freeStock: number;
  /** Instant où la prochaine bobine offerte arrive, ou null si la réserve est pleine. */
  nextFreeAt: number | null;
};

type PlayerRow = {
  id: string; tickets: number; free_stock: number; free_updated_at: number;
  name: string | null; email: string | null; last_daily: string | null;
};
const PLAYER_COLUMNS = 'id, tickets, free_stock, free_updated_at, name, email, last_daily';

export class GameError extends Error {
  readonly code: 'unknown-booster' | 'not-enough-tickets' | 'unknown-player' | 'daily-taken' | 'nothing-to-recycle';
  constructor(code: GameError['code'], message: string) {
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
    name: row.name,
    email: row.email,
    lastDaily: row.last_daily,
    tickets: row.tickets,
    freeStock: stock,
    nextFreeAt: stock >= FREE_BOOSTER_CAP ? null : updatedAt + FREE_BOOSTER_EVERY_MS,
  };
}

export function createPlayer(db: DatabaseSync, now = Date.now()): Player {
  const id = randomUUID();
  db.prepare('INSERT INTO players (id, created_at, tickets, free_stock, free_updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, now, STARTING_TICKETS, FREE_BOOSTER_CAP, now);
  return { id, name: null, email: null, lastDaily: null, tickets: STARTING_TICKETS, freeStock: FREE_BOOSTER_CAP, nextFreeAt: null };
}

export function getPlayer(db: DatabaseSync, id: string, now = Date.now()): Player | null {
  const row = db.prepare(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = ?`).get(id) as
    | PlayerRow
    | undefined;
  if (!row) return null;
  const { stock, updatedAt } = regenerate(row, now);
  return toPlayer(row, stock, updatedAt);
}

export function getCatalog(db: DatabaseSync): Card[] {
  return (db.prepare('SELECT * FROM cards').all() as Parameters<typeof rowToCard>[0][]).map(rowToCard);
}

export type PulledCard = Card & { serial: number; isNew: boolean };

export type OpenResult = {
  pullId: number;
  boosterId: string;
  paidWith: 'free' | 'tickets';
  cards: PulledCard[];
  player: Player;
};

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

  return transaction(db, () => {
    const row = db.prepare(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = ?`).get(playerId) as
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
    } else if (tickets >= def.price) {
      tickets -= def.price;
      paidWith = 'tickets';
    } else {
      throw new GameError('not-enough-tickets', `Il faut ${def.price} tickets pour ouvrir ${def.name}.`);
    }

    db.prepare('UPDATE players SET tickets = ?, free_stock = ?, free_updated_at = ? WHERE id = ?')
      .run(tickets, stock, updatedAt, playerId);
    const { lastInsertRowid } = db.prepare('INSERT INTO pulls (player_id, booster_id, paid_with, created_at) VALUES (?, ?, ?, ?)')
      .run(playerId, boosterId, paidWith, now);
    const pullId = Number(lastInsertRowid);
    if (paidWith === 'tickets') {
      db.prepare('INSERT INTO ledger (player_id, amount, reason, detail, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(playerId, -def.price, 'booster', def.name, now);
    }

    // Le numéro suit le plus grand déjà attribué : il reste unique même après un recyclage.
    const lastSerial = db.prepare('SELECT COALESCE(MAX(serial), 0) AS n FROM owned WHERE card_id = ?');
    const countMine = db.prepare('SELECT COUNT(*) AS n FROM owned WHERE card_id = ? AND player_id = ?');
    const insertOwned = db.prepare('INSERT INTO owned (player_id, card_id, serial, pull_id, obtained_at) VALUES (?, ?, ?, ?, ?)');

    const cards = openBooster(def, getCatalog(db), rng).map((card): PulledCard => {
      const serial = (lastSerial.get(card.id) as { n: number }).n + 1;
      const isNew = (countMine.get(card.id, playerId) as { n: number }).n === 0;
      insertOwned.run(playerId, card.id, serial, pullId, now);
      return { ...card, serial, isNew };
    });

    return { pullId, boosterId, paidWith, cards, player: toPlayer({ ...row, tickets }, stock, updatedAt) };
  });
}

/** La collection d'un joueur : une entrée par carte, avec son meilleur numéro de série. */
export function getCollection(db: DatabaseSync, playerId: string): OwnedCard[] {
  const rows = db.prepare(`
    SELECT c.*, MIN(o.serial) AS serial, MAX(o.obtained_at) AS obtained_at, COUNT(*) AS copies
    FROM owned o JOIN cards c ON c.id = o.card_id
    WHERE o.player_id = ?
    GROUP BY c.id`).all(playerId) as (Parameters<typeof rowToCard>[0] & { serial: number; obtained_at: number; copies: number })[];
  return rows
    .map((r) => ({ ...rowToCard(r), serial: r.serial, obtainedAt: r.obtained_at, copies: r.copies }))
    .sort((a, b) => RARITIES[b.rarity].entries - RARITIES[a.rarity].entries || a.last.localeCompare(b.last, 'fr'));
}

export type PlayerStats = { entries: number; unique: number; copies: number; pulls: number };

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
  };
}

/** Les dernières cartes tirées, de la plus récente à la plus ancienne. */
export function getRecentCards(db: DatabaseSync, playerId: string, limit = 10): Card[] {
  const rows = db.prepare(`
    SELECT c.* FROM owned o JOIN cards c ON c.id = o.card_id
    WHERE o.player_id = ? ORDER BY o.id DESC LIMIT ?`).all(playerId, limit) as Parameters<typeof rowToCard>[0][];
  return rows.map(rowToCard);
}
