import type { DatabaseSync } from 'node:sqlite';
import { getCatalog, ownedCardIds } from './catalog.ts';
import { transaction } from './db.ts';
import { addTickets, GameError, getPlayer } from './game.ts';
import { notifyPlayer } from './notify.ts';
import { RARITIES } from './rarity.ts';
import type { Card } from './types.ts';

// Ce qui relie les deux familles de cartes :
// - un duo : la carte Acteur d'une personne et au moins un de ses Rôles ;
// - une saga : les Rôles de ses films et les cartes Acteur de leurs interprètes.

export type Duo = { actor: Card | null; personId: number; name: string; roles: Card[]; ownedRoles: Card[]; complete: boolean };

/** Les Rôles d'une personne et sa carte Acteur, avec ce que le joueur en possède. */
export function duoOf(db: DatabaseSync, playerId: string, personId: number): Duo {
  const owned = ownedCardIds(db, playerId);
  const cards = getCatalog(db).filter((c) => c.personId === personId);
  const actor = cards.find((c) => c.kind === 'actor') ?? null;
  const roles = cards.filter((c) => c.kind === 'role').sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || (b.votes ?? 0) - (a.votes ?? 0));
  const ownedRoles = roles.filter((r) => owned.has(r.id));
  const first = cards[0];
  return {
    actor, personId, roles, ownedRoles, name: first ? `${first.first} ${first.last}`.trim() : '',
    complete: !!actor && owned.has(actor.id) && ownedRoles.length > 0,
  };
}

/** Les duos complets du joueur, du plus prestigieux au moins prestigieux. */
export function playerDuos(db: DatabaseSync, playerId: string): Duo[] {
  const owned = ownedCardIds(db, playerId);
  const catalog = getCatalog(db);
  const people = new Set(catalog.filter((c) => c.kind === 'actor' && owned.has(c.id)).map((c) => c.personId));
  const withRole = new Set(catalog.filter((c) => c.kind === 'role' && owned.has(c.id) && people.has(c.personId)).map((c) => c.personId));
  return [...withRole]
    .map((p) => duoOf(db, playerId, p))
    .sort((a, b) => RARITIES[b.actor!.rarity].tier - RARITIES[a.actor!.rarity].tier || b.ownedRoles.length - a.ownedRoles.length);
}

export type Saga = { id: number; name: string; members: Card[]; owned: number; total: number; reward: number; claimed: boolean };

const sagaCache = new WeakMap<Card[], Map<number, Card[]>>();

/** Membres de chaque saga : ses Rôles et les cartes Acteur de leurs interprètes (calculé une fois par catalogue). */
function sagaMembers(db: DatabaseSync): Map<number, Card[]> {
  const catalog = getCatalog(db);
  const hit = sagaCache.get(catalog);
  if (hit) return hit;
  const actors = new Map(catalog.filter((c) => c.kind === 'actor').map((c) => [c.personId, c]));
  const map = new Map<number, Card[]>();
  for (const c of catalog) {
    if (c.kind !== 'role') continue;
    for (const t of c.tags) {
      if (!t.startsWith('saga:')) continue;
      const id = Number(t.slice(5));
      const list = map.get(id) ?? [];
      list.push(c);
      map.set(id, list);
    }
  }
  for (const [id, roles] of map) {
    const people = [...new Set(roles.map((r) => r.personId))].flatMap((p) => (actors.has(p) ? [actors.get(p)!] : []));
    map.set(id, [...roles.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)), ...people]);
  }
  sagaCache.set(catalog, map);
  return map;
}

/** Récompense d'une saga complétée : 150 tickets par carte, entre 1 000 et 8 000. */
export function sagaReward(size: number): number {
  return Math.min(8_000, Math.max(1_000, size * 150));
}

/** Les sagas, avec la progression du joueur ; `started` ne garde que celles dont il a au moins une carte. */
export function playerSagas(db: DatabaseSync, playerId: string, { started = false } = {}): Saga[] {
  const owned = ownedCardIds(db, playerId);
  const names = new Map((db.prepare('SELECT id, name FROM sagas').all() as { id: number; name: string }[]).map((s) => [s.id, s.name]));
  const claimed = new Set((db.prepare('SELECT saga_id FROM saga_rewards WHERE player_id = ?').all(playerId) as { saga_id: number }[]).map((r) => r.saga_id));
  const list: Saga[] = [];
  for (const [id, members] of sagaMembers(db)) {
    // Une « saga » d'un seul film n'en est pas une.
    if (new Set(members.filter((m) => m.kind === 'role').map((m) => m.movieId)).size < 2) continue;
    const have = members.filter((m) => owned.has(m.id)).length;
    if (started && have === 0) continue;
    list.push({ id, name: names.get(id) ?? `Saga ${id}`, members, owned: have, total: members.length, reward: sagaReward(members.length), claimed: claimed.has(id) });
  }
  // Les sagas les plus avancées d'abord (en nombre de cartes), puis les plus grandes.
  return list.sort((a, b) => b.owned - a.owned || b.owned / b.total - a.owned / a.total || b.total - a.total);
}

/** Verse la récompense d'une saga complétée (une seule fois). */
export function claimSaga(db: DatabaseSync, playerId: string, sagaId: number, now = Date.now()): number {
  const saga = playerSagas(db, playerId).find((s) => s.id === sagaId);
  if (!saga) throw new GameError('not-found', 'Saga introuvable.');
  if (saga.owned < saga.total) throw new GameError('incomplete', `Il vous manque encore ${saga.total - saga.owned} cartes.`);
  if (saga.claimed) throw new GameError('claimed', 'Récompense déjà récupérée.');
  return transaction(db, () => {
    db.prepare('INSERT INTO saga_rewards (player_id, saga_id, tickets, created_at) VALUES (?, ?, ?, ?)').run(playerId, sagaId, saga.reward, now);
    if (getPlayer(db, playerId)) addTickets(db, playerId, saga.reward);
    notifyPlayer(db, playerId, 'mission', `Saga ${saga.name} complète : +${saga.reward} tickets !`, '/collection?vue=sagas', now);
    return saga.reward;
  });
}
