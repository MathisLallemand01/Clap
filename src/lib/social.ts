import type { DatabaseSync } from 'node:sqlite';
import { getUser, getUserByName, type User } from './auth.ts';
import { getCard } from './catalog.ts';
import { queueCelebration } from './celebrations.ts';
import { transaction } from './db.ts';
import { addTickets, GameError, getPlayer, getStats } from './game.ts';
import { logEvent, notify } from './notify.ts';
import { suggestedTickets } from './rarity.ts';
import type { Card } from './types.ts';

export type Friend = { id: string; name: string; avatar: string | null; unique: number; entries: number };

export type FriendLists = { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] };

function toFriend(db: DatabaseSync, u: User): Friend {
  const s = getStats(db, u.playerId);
  return { id: u.id, name: u.name, avatar: u.avatar, unique: s.unique, entries: s.entries };
}

export function listFriends(db: DatabaseSync, userId: string): FriendLists {
  const rows = db.prepare('SELECT user_id, friend_id, status FROM friendships WHERE user_id = ? OR friend_id = ?').all(userId, userId) as
    { user_id: string; friend_id: string; status: 'pending' | 'accepted' }[];
  const out: FriendLists = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    if (r.status === 'accepted' && r.user_id === userId) {
      const u = getUser(db, r.friend_id);
      if (u) out.friends.push(toFriend(db, u));
    } else if (r.status === 'pending') {
      const otherId = r.user_id === userId ? r.friend_id : r.user_id;
      const u = getUser(db, otherId);
      if (u) (r.user_id === userId ? out.outgoing : out.incoming).push(toFriend(db, u));
    }
  }
  out.friends.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return out;
}

export function areFriends(db: DatabaseSync, a: string, b: string): boolean {
  return !!db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'").get(a, b);
}

export function sendFriendRequest(db: DatabaseSync, userId: string, friendName: string, now = Date.now()): string {
  const friend = getUserByName(db, friendName);
  if (!friend) throw new GameError('unknown-user', `Aucun joueur ne s’appelle « ${friendName.trim()} ».`);
  if (friend.id === userId) throw new GameError('self', 'Vous ne pouvez pas vous ajouter vous-même.');
  if (areFriends(db, userId, friend.id)) throw new GameError('already', `${friend.name} est déjà votre ami.`);
  const reverse = db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'").get(friend.id, userId);
  if (reverse) {
    acceptFriend(db, userId, friend.id, now);
    return `${friend.name} et vous êtes maintenant amis.`;
  }
  db.prepare("INSERT OR IGNORE INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(userId, friend.id, now);
  const me = getUser(db, userId)!;
  notify(db, friend.id, 'friend', `${me.name} vous demande en ami.`, '/echanges', now);
  return `Demande envoyée à ${friend.name}.`;
}

export function acceptFriend(db: DatabaseSync, userId: string, requesterId: string, now = Date.now()): void {
  transaction(db, () => {
    const res = db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ? AND status = 'pending'").run(requesterId, userId);
    if (res.changes === 0) throw new GameError('not-found', 'Demande introuvable.');
    db.prepare("INSERT OR REPLACE INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', ?)").run(userId, requesterId, now);
  });
  const me = getUser(db, userId)!;
  notify(db, requesterId, 'friend', `${me.name} a accepté votre demande d’ami.`, '/echanges', now);
}

export function removeFriend(db: DatabaseSync, userId: string, otherId: string): void {
  db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(userId, otherId, otherId, userId);
}

/** Exemplaires libres (ni en vente, ni promis dans un échange en attente) d'un joueur pour une carte, du moins précieux au plus précieux. */
function freeCopies(db: DatabaseSync, playerId: string, cardId: string, exclude: Set<number>): number[] {
  const busy = new Set([
    ...(db.prepare("SELECT owned_id FROM listings WHERE status = 'open'").all() as { owned_id: number }[]).map((r) => r.owned_id),
    ...exclude,
  ]);
  return (db.prepare('SELECT id FROM owned WHERE player_id = ? AND card_id = ? ORDER BY serial DESC').all(playerId, cardId) as { id: number }[])
    .map((r) => r.id)
    .filter((id) => !busy.has(id));
}

function pendingTradeOwnedIds(db: DatabaseSync): Set<number> {
  const rows = db.prepare("SELECT give, take FROM trades WHERE status = 'pending'").all() as { give: string; take: string }[];
  return new Set(rows.flatMap((r) => [...(JSON.parse(r.give) as number[]), ...(JSON.parse(r.take) as number[])]));
}

export type TradeSide = { cards: (Card & { ownedId: number; serial: number })[]; tickets: number; value: number };
export type Trade = {
  id: number; from: { id: string; name: string }; to: { id: string; name: string };
  give: TradeSide; take: TradeSide; status: string; createdAt: number; gift: boolean;
};

function side(db: DatabaseSync, ownedIds: number[], tickets: number): TradeSide {
  const cards = ownedIds.flatMap((id) => {
    const o = db.prepare('SELECT card_id, serial FROM owned WHERE id = ?').get(id) as { card_id: string; serial: number } | undefined;
    const card = o && getCard(db, o.card_id);
    return card ? [{ ...card, ownedId: id, serial: o.serial }] : [];
  });
  return { cards, tickets, value: cards.reduce((s, c) => s + suggestedTickets(c.rarity), 0) + tickets };
}

export function proposeTrade(
  db: DatabaseSync,
  fromId: string,
  toId: string,
  offer: { give: string[]; take: string[]; giveTickets: number; takeTickets: number },
  now = Date.now(),
): number {
  if (!areFriends(db, fromId, toId)) throw new GameError('not-friends', 'Vous ne pouvez échanger qu’avec vos amis.');
  if (!offer.give.length && !offer.take.length) throw new GameError('empty', 'Choisissez au moins une carte.');
  if (![offer.giveTickets, offer.takeTickets].every((t) => Number.isInteger(t) && t >= 0)) throw new GameError('bad-tickets', 'Nombre de tickets invalide.');
  const from = getUser(db, fromId)!;
  const to = getUser(db, toId)!;
  return transaction(db, () => {
    const used = pendingTradeOwnedIds(db);
    const pick = (playerId: string, cardIds: string[], who: string) => cardIds.map((cardId) => {
      const id = freeCopies(db, playerId, cardId, used)[0];
      if (!id) {
        const name = getCard(db, cardId)?.last ?? 'cette carte';
        throw new GameError('not-owned', who === 'Vous' ? `Vous n’avez plus d’exemplaire libre de ${name} (en vente ou déjà promis).` : `${who} n’a plus d’exemplaire libre de ${name}.`);
      }
      used.add(id);
      return id;
    });
    const give = pick(from.playerId, offer.give, 'Vous');
    const take = pick(to.playerId, offer.take, to.name);
    const { lastInsertRowid } = db.prepare('INSERT INTO trades (from_user, to_user, give, take, give_tickets, take_tickets, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(fromId, toId, JSON.stringify(give), JSON.stringify(take), offer.giveTickets, offer.takeTickets, now);
    notify(db, toId, 'trade', `${from.name} vous propose un échange.`, '/echanges', now);
    return Number(lastInsertRowid);
  });
}

type TradeRow = { id: number; from_user: string; to_user: string; give: string; take: string; give_tickets: number; take_tickets: number; status: string; created_at: number; gift: number };

function toTrade(db: DatabaseSync, r: TradeRow): Trade {
  const name = (id: string) => getUser(db, id)?.name ?? 'Joueur';
  return {
    id: r.id, from: { id: r.from_user, name: name(r.from_user) }, to: { id: r.to_user, name: name(r.to_user) },
    give: side(db, JSON.parse(r.give) as number[], r.give_tickets), take: side(db, JSON.parse(r.take) as number[], r.take_tickets),
    status: r.status, createdAt: r.created_at, gift: r.gift === 1,
  };
}

export function listTrades(db: DatabaseSync, userId: string): { pending: Trade[]; history: Trade[] } {
  const rows = db.prepare('SELECT * FROM trades WHERE from_user = ? OR to_user = ? ORDER BY id DESC LIMIT 30').all(userId, userId) as TradeRow[];
  const trades = rows.map((r) => toTrade(db, r));
  return { pending: trades.filter((t) => t.status === 'pending'), history: trades.filter((t) => t.status !== 'pending') };
}

export function respondTrade(db: DatabaseSync, userId: string, tradeId: number, accept: boolean, now = Date.now()): void {
  const row = db.prepare("SELECT * FROM trades WHERE id = ? AND status = 'pending'").get(tradeId) as TradeRow | undefined;
  if (!row) throw new GameError('not-found', 'Échange introuvable.');
  if (row.to_user !== userId) throw new GameError('forbidden', 'Seul le destinataire peut répondre.');
  const from = getUser(db, row.from_user)!;
  const to = getUser(db, row.to_user)!;
  if (!accept) {
    db.prepare("UPDATE trades SET status = 'refused', closed_at = ? WHERE id = ?").run(now, tradeId);
    notify(db, from.id, 'trade', `${to.name} a refusé votre échange.`, '/echanges', now);
    return;
  }
  try {
    transaction(db, () => {
      const listed = new Set((db.prepare("SELECT owned_id FROM listings WHERE status = 'open'").all() as { owned_id: number }[]).map((r) => r.owned_id));
      const check = (ids: number[], playerId: string) => {
        for (const id of ids) {
          const o = db.prepare('SELECT player_id FROM owned WHERE id = ?').get(id) as { player_id: string } | undefined;
          if (!o || o.player_id !== playerId || listed.has(id)) throw new GameError('stale', 'Une des cartes n’est plus disponible.');
        }
      };
      const give = JSON.parse(row.give) as number[];
      const take = JSON.parse(row.take) as number[];
      check(give, from.playerId);
      check(take, to.playerId);
      const move = db.prepare('UPDATE owned SET player_id = ?, obtained_at = ? WHERE id = ?');
      for (const id of give) move.run(to.playerId, now, id);
      for (const id of take) move.run(from.playerId, now, id);
      if (row.give_tickets) {
        addTickets(db, from.playerId, -row.give_tickets);
        addTickets(db, to.playerId, row.give_tickets);
      }
      if (row.take_tickets) {
        addTickets(db, to.playerId, -row.take_tickets);
        addTickets(db, from.playerId, row.take_tickets);
      }
      db.prepare("UPDATE trades SET status = 'accepted', closed_at = ? WHERE id = ?").run(now, tradeId);
      // Les deux joueurs voient l'échange conclu en grand : l'un tout de suite, l'autre à sa prochaine visite.
      const serials = (ids: number[]) => ids.map((id) => db.prepare('SELECT card_id AS cardId, serial FROM owned WHERE id = ?').get(id) as { cardId: string; serial: number });
      queueCelebration(db, from.playerId, { kind: 'trade', partner: to.name, received: serials(take), tickets: row.take_tickets, gave: give.length, gaveTickets: row.give_tickets }, now);
      queueCelebration(db, to.playerId, { kind: 'trade', partner: from.name, received: serials(give), tickets: row.give_tickets, gave: take.length, gaveTickets: row.take_tickets }, now);
      logEvent(db, from.playerId, 'trade', 1, now);
      logEvent(db, to.playerId, 'trade', 1, now);
    });
  } catch (err) {
    if (err instanceof GameError && (err.code === 'stale' || err.code === 'not-enough-tickets')) {
      db.prepare("UPDATE trades SET status = 'failed', closed_at = ? WHERE id = ?").run(now, tradeId);
      notify(db, from.id, 'trade', `L’échange avec ${to.name} n’a pas pu se faire : ${err.message}`, '/echanges', now);
    }
    throw err;
  }
  notify(db, from.id, 'trade', `${to.name} a accepté votre échange.`, '/echanges', now);
}

/** Ancienneté minimale pour offrir des cartes ou des tickets (contre les comptes jetables). */
export const GIFT_MIN_AGE_DAYS = 7;

/** Le jour où un compte pourra offrir, ou null s'il le peut déjà (les comptes de test illimités le peuvent toujours). */
export function giftUnlockAt(db: DatabaseSync, userId: string, now = Date.now()): number | null {
  const user = getUser(db, userId);
  if (!user) return null;
  if (getPlayer(db, user.playerId)?.unlimited) return null;
  const at = user.createdAt + GIFT_MIN_AGE_DAYS * 86_400_000;
  return at > now ? at : null;
}

/** Offre des cartes et/ou des tickets à un ami : rien à accepter, c'est conclu tout de suite. */
export function sendGift(db: DatabaseSync, fromId: string, toId: string, gift: { cards: string[]; tickets: number }, now = Date.now()): number {
  if (!areFriends(db, fromId, toId)) throw new GameError('not-friends', 'Vous ne pouvez faire de cadeau qu’à vos amis.');
  if (giftUnlockAt(db, fromId, now)) throw new GameError('too-young', `Les cadeaux s’ouvrent après ${GIFT_MIN_AGE_DAYS} jours d’ancienneté.`);
  if (!Number.isInteger(gift.tickets) || gift.tickets < 0) throw new GameError('bad-tickets', 'Nombre de tickets invalide.');
  if (!gift.cards.length && !gift.tickets) throw new GameError('empty', 'Choisissez au moins une carte ou des tickets à offrir.');
  const from = getUser(db, fromId)!;
  const to = getUser(db, toId)!;
  return transaction(db, () => {
    const used = pendingTradeOwnedIds(db);
    const ids = gift.cards.map((cardId) => {
      const id = freeCopies(db, from.playerId, cardId, used)[0];
      if (!id) throw new GameError('not-owned', `Vous n’avez plus d’exemplaire libre de ${getCard(db, cardId)?.last ?? 'cette carte'}.`);
      used.add(id);
      return id;
    });
    const move = db.prepare('UPDATE owned SET player_id = ?, obtained_at = ? WHERE id = ?');
    for (const id of ids) move.run(to.playerId, now, id);
    if (gift.tickets) {
      addTickets(db, from.playerId, -gift.tickets);
      addTickets(db, to.playerId, gift.tickets);
    }
    const { lastInsertRowid } = db.prepare("INSERT INTO trades (from_user, to_user, give, take, give_tickets, take_tickets, status, created_at, closed_at, gift) VALUES (?, ?, ?, '[]', ?, 0, 'accepted', ?, ?, 1)")
      .run(fromId, toId, JSON.stringify(ids), gift.tickets, now, now);
    const received = ids.map((id) => db.prepare('SELECT card_id AS cardId, serial FROM owned WHERE id = ?').get(id) as { cardId: string; serial: number });
    queueCelebration(db, to.playerId, { kind: 'gift', from: from.name, received, tickets: gift.tickets }, now);
    notify(db, toId, 'trade', `${from.name} vous a fait un cadeau.`, '/collection', now);
    return Number(lastInsertRowid);
  });
}

export function cancelTrade(db: DatabaseSync, userId: string, tradeId: number, now = Date.now()): void {
  const res = db.prepare("UPDATE trades SET status = 'cancelled', closed_at = ? WHERE id = ? AND from_user = ? AND status = 'pending'").run(now, tradeId, userId);
  if (res.changes === 0) throw new GameError('not-found', 'Échange introuvable.');
}

export type Referral = { name: string; pulls: number; rewarded: boolean; createdAt: number };

export function listReferrals(db: DatabaseSync, userId: string): Referral[] {
  const rows = db.prepare('SELECT name, player_id, referral_rewarded, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC').all(userId) as
    { name: string; player_id: string; referral_rewarded: number; created_at: number }[];
  return rows.map((r) => ({
    name: r.name,
    pulls: (db.prepare('SELECT COUNT(*) AS n FROM pulls WHERE player_id = ?').get(r.player_id) as { n: number }).n,
    rewarded: r.referral_rewarded === 1,
    createdAt: r.created_at,
  }));
}

/** Collection échangeable : seuls les exemplaires ni en vente ni promis dans un échange en attente comptent. */
export function tradableCollection(db: DatabaseSync, playerId: string): (Card & { copies: number })[] {
  const busy = pendingTradeOwnedIds(db);
  for (const r of db.prepare("SELECT owned_id FROM listings WHERE status = 'open'").all() as { owned_id: number }[]) busy.add(r.owned_id);
  const counts = new Map<string, number>();
  for (const r of db.prepare('SELECT id, card_id FROM owned WHERE player_id = ?').all(playerId) as { id: number; card_id: string }[]) {
    if (!busy.has(r.id)) counts.set(r.card_id, (counts.get(r.card_id) ?? 0) + 1);
  }
  return [...counts].flatMap(([id, copies]) => {
    const card = getCard(db, id);
    return card ? [{ ...card, copies }] : [];
  });
}
