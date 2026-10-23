import type { DatabaseSync } from 'node:sqlite';
import { BOOSTERS, type BoosterDef } from './boosters.ts';
import { rowToCard, type CardRow } from './db.ts';
import { boosterPool } from './pull.ts';
import { RARITIES, type Rarity } from './rarity.ts';
import type { Card } from './types.ts';

// Le catalogue complet (des dizaines de milliers de cartes) est gardé en mémoire et
// rechargé seulement quand la table change (nouvel import).
const cache = new WeakMap<DatabaseSync, { version: string; cards: Card[]; byId: Map<string, Card>; sorted: Card[] }>();

function version(db: DatabaseSync): string {
  const { n, m } = db.prepare('SELECT COUNT(*) AS n, MAX(rowid) AS m FROM cards').get() as { n: number; m: number | null };
  return `${n}:${m}`;
}

function load(db: DatabaseSync) {
  const v = version(db);
  const hit = cache.get(db);
  if (hit && hit.version === v) return hit;
  const cards = (db.prepare('SELECT * FROM cards').all() as CardRow[]).map(rowToCard);
  const entry = { version: v, cards, byId: new Map(cards.map((c) => [c.id, c])), sorted: cards.filter((c) => c.image).sort(byValue) };
  cache.set(db, entry);
  return entry;
}

export function getCatalog(db: DatabaseSync): Card[] {
  return load(db).cards;
}

export function getCard(db: DatabaseSync, id: string): Card | undefined {
  return load(db).byId.get(id);
}

/** Tri par valeur décroissante, puis par notoriété (rang). */
export function byValue(a: Card, b: Card): number {
  return RARITIES[b.rarity].entries - RARITIES[a.rarity].entries || (a.rank ?? 1e9) - (b.rank ?? 1e9) || (b.votes ?? 0) - (a.votes ?? 0);
}

export function cardsOfPerson(db: DatabaseSync, personId: number): Card[] {
  return getCatalog(db).filter((c) => c.personId === personId).sort(byValue);
}

export function cardsOfMovie(db: DatabaseSync, movieId: number): Card[] {
  return getCatalog(db).filter((c) => c.kind === 'role' && c.movieId === movieId).sort(byValue);
}

export function countByRarity(cards: Card[]): Record<Rarity, number> {
  const counts = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, 0])) as Record<Rarity, number>;
  for (const c of cards) counts[c.rarity]++;
  return counts;
}

/** Les plus belles cartes illustrées, pour les vitrines (accueil, paquets, connexion). */
export function showcase(db: DatabaseSync, { count = 12, kind, rarities }: { count?: number; kind?: Card['kind']; rarities?: Rarity[] } = {}): Card[] {
  const seenPeople = new Set<number>();
  const out: Card[] = [];
  for (const c of load(db).sorted) {
    if ((kind && c.kind !== kind) || (rarities && !rarities.includes(c.rarity))) continue;
    if (seenPeople.has(c.personId)) continue;
    seenPeople.add(c.personId);
    out.push(c);
    if (out.length >= count) break;
  }
  return out;
}

export function searchCards<T extends Card>(cards: T[], query: string): T[] {
  const q = query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (!q) return cards;
  const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return cards.filter((c) => norm(`${c.first} ${c.last} ${c.film ?? ''} ${c.character ?? ''}`).includes(q));
}

const covers = new WeakMap<DatabaseSync, { version: string; byBooster: Map<string, Card | null> }>();

/** La vedette d'une bobine : l'acteur le plus célèbre de son thème, avec portrait. */
export function boosterCover(db: DatabaseSync, def: BoosterDef): Card | null {
  const { version: v, cards } = load(db);
  let entry = covers.get(db);
  if (!entry || entry.version !== v) {
    entry = { version: v, byBooster: new Map() };
    covers.set(db, entry);
  }
  if (entry.byBooster.size === 0) {
    // Calculées une fois pour toutes les bobines, dans l'ordre, pour que chacune ait sa propre vedette.
    const used = new Set<number>();
    for (const b of BOOSTERS) {
      const actors = boosterPool(b, cards).filter((c) => c.kind === 'actor' && c.image);
      // Pour une bobine Pays, la vedette doit être un acteur de ce pays, pas un invité d'une coproduction.
      const native = actors.filter((c) => c.tags.some((t) => b.tags?.includes(t)));
      const best = (native.length ? native : actors).sort((x, y) => (x.rank ?? 1e9) - (y.rank ?? 1e9));
      const pick = best.find((c) => !used.has(c.personId)) ?? best[0] ?? null;
      if (pick) used.add(pick.personId);
      entry.byBooster.set(b.id, pick);
    }
  }
  return entry.byBooster.get(def.id) ?? null;
}

const pools = new WeakMap<DatabaseSync, { version: string; byBooster: Map<string, Card[]> }>();

/** Les cartes d'une bobine (mises en cache tant que le catalogue ne change pas). */
export function poolOf(db: DatabaseSync, def: BoosterDef): Card[] {
  const { version: v, cards } = load(db);
  let entry = pools.get(db);
  if (!entry || entry.version !== v) {
    entry = { version: v, byBooster: new Map() };
    pools.set(db, entry);
  }
  let pool = entry.byBooster.get(def.id);
  if (!pool) {
    pool = boosterPool(def, cards);
    entry.byBooster.set(def.id, pool);
  }
  return pool;
}

/** Identifiants des cartes distinctes possédées par un joueur. */
export function ownedCardIds(db: DatabaseSync, playerId: string): Set<string> {
  return new Set((db.prepare('SELECT DISTINCT card_id FROM owned WHERE player_id = ?').all(playerId) as { card_id: string }[]).map((r) => r.card_id));
}
