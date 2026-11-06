import type { Special } from './pity.ts';
import type { BoosterDef, Slot } from './boosters.ts';
import { ladderOf, RARITIES, type Rarity } from './rarity.ts';
import { themeFor } from './themes.ts';
import type { Card } from './types.ts';

export type Rng = () => number;

/** Un rôle de série (et non de film). */
export function isSeries(card: Pick<Card, 'tags'>): boolean {
  return card.tags.includes('media:tv');
}

/** Un film « que tout le monde a vu » : au moins 15 000 votes sur TMDB. */
export const FAMOUS_VOTES = 15_000;

/** Tire une rareté selon les poids du slot. */
export function rollRarity(slot: Slot, rng: Rng): Rarity {
  const entries = Object.entries(slot.odds) as [Rarity, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll < 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

/**
 * Cartes éligibles pour une bobine thématique. Un Acteur est éligible s'il porte
 * l'un des tags ou s'il a au moins un Rôle qui en porte un (ex. un acteur d'un film des années 80).
 */
export function boosterPool(def: BoosterDef, catalog: Card[]): Card[] {
  // Une bobine ne contient que sa famille : des Acteurs pour un Casting, des Rôles pour un Film.
  const family = def.slots[0]?.kind;
  return candidates(def, catalog).filter((c) => !family || c.kind === family);
}

function candidates(def: BoosterDef, catalog: Card[]): Card[] {
  // Séries et cinéma ne se mélangent pas : une bobine Séries ne donne que des séries, les autres que du cinéma.
  // Les cartes Acteur (une personne, toute sa carrière) restent communes aux deux.
  const series = def.media === 'tv';
  catalog = catalog.filter((c) => c.kind === 'actor' || isSeries(c) === series);
  if (def.pool === 'themes') return catalog.filter((c) => themeFor(c));
  if (def.pool === 'famous') return catalog.filter((c) => c.kind === 'role' && (c.votes ?? 0) >= FAMOUS_VOTES && RARITIES[c.rarity].tier >= 3);
  if (def.pool === 'sagas' || def.pool === 'acclaimed') {
    const wanted = def.pool === 'sagas' ? (t: string) => t.startsWith('saga:') : (t: string) => t === 'acclaimed';
    const pool = catalog.filter((c) => c.kind === 'role' && c.tags.some(wanted));
    // Catalogue importé avant les sagas : on se rabat sur les grands rôles des films très vus.
    return pool.length ? pool : catalog.filter((c) => c.kind === 'role' && (c.votes ?? 0) >= 5_000);
  }
  const tags = def.tags;
  if (!tags?.length) return catalog;
  const matches = (c: Card) => c.tags.some((t) => tags.includes(t));
  const peopleWithTaggedRole = new Set(catalog.filter((c) => c.kind === 'role' && matches(c)).map((c) => c.personId));
  return catalog.filter((c) => matches(c) || (c.kind === 'actor' && peopleWithTaggedRole.has(c.personId)));
}

/**
 * Choisit une carte de la rareté voulue. Si le catalogue n'en a pas, on descend
 * l'échelle (jamais de cadeau involontaire), puis on remonte en dernier recours.
 */
function pickCard(kind: Card['kind'], rarity: Rarity, pool: Card[], rng: Rng): Card | null {
  const ladder = ladderOf(kind);
  const start = ladder.indexOf(rarity);
  const order = [...ladder.slice(0, start + 1).reverse(), ...ladder.slice(start + 1)];
  for (const r of order) {
    const candidates = pool.filter((c) => c.kind === kind && c.rarity === r);
    if (candidates.length) return candidates[Math.floor(rng() * candidates.length)];
  }
  return null;
}

/** La rareté la plus haute qu'un slot peut donner. */
export function topRarity(slot: Slot): Rarity {
  const ladder = ladderOf(slot.kind);
  const possible = (Object.entries(slot.odds) as [Rarity, number][]).filter(([, w]) => w > 0).map(([r]) => r);
  return possible.sort((a, b) => ladder.indexOf(b) - ladder.indexOf(a))[0];
}

/**
 * Ouvre une bobine : une carte par slot, puis rangées de la moins rare à la plus rare, comme dans un vrai
 * paquet de cartes : on révèle d'abord le commun, la meilleure carte arrive toujours en dernier.
 * `topFirst` : le premier slot donne la rareté la plus haute qu'il permet (cadeau de la toute première bobine) ;
 * cette carte-là est donc révélée en dernier.
 */
export function openBooster(
  def: BoosterDef,
  catalog: Card[],
  rng: Rng = Math.random,
  { topFirst = false, guarantee, fallback }: { topFirst?: boolean; guarantee?: Special | null; fallback?: Card[] } = {},
): Card[] {
  const pool = boosterPool(def, catalog);
  const cards: Card[] = [];
  for (const [i, slot] of def.slots.entries()) {
    const card = pickCard(slot.kind, topFirst && i === 0 ? topRarity(slot) : rollRarity(slot, rng), pool, rng);
    if (card) cards.push(card);
  }
  // Garantie (tapis rouge, bobine mythique) : si la chance ne l'a pas déjà donnée, la carte la plus commune
  // est remplacée par une carte du cran garanti, prise dans la bobine (ou, à défaut, dans tout le catalogue).
  const family = def.slots[0]?.kind;
  if (guarantee && family) {
    const want: Rarity = guarantee === 'mythique' ? 'mythe' : family === 'actor' ? 'legende' : 'icone';
    const meets = (c: Card) => (guarantee === 'mythique' ? c.rarity === 'mythe' : RARITIES[c.rarity].tier >= 5);
    if (!cards.some(meets)) {
      const series = def.media === 'tv';
      const fromPool = pool.filter((c) => c.rarity === want);
      const wider = (fallback ?? []).filter((c) => c.kind === family && c.rarity === want);
      const sameMedia = wider.filter((c) => c.kind === 'actor' || isSeries(c) === series);
      const source = fromPool.length ? fromPool : sameMedia.length ? sameMedia : wider;
      if (source.length) {
        const lowest = cards.reduce((lo, c, i) => (RARITIES[c.rarity].tier < RARITIES[cards[lo].rarity].tier ? i : lo), 0);
        const pick = source[Math.floor(rng() * source.length)];
        if (cards.length) cards[lowest] = pick;
        else cards.push(pick);
      }
    }
  }
  return sortForReveal(cards);
}

/** Du moins rare au plus rare ; à cran égal, la carte qui rapporte le plus d'entrées passe après. Tri stable. */
export function sortForReveal<T extends Pick<Card, 'rarity'>>(cards: T[]): T[] {
  return cards
    .map((card, i) => ({ card, i }))
    .sort((a, b) => RARITIES[a.card.rarity].tier - RARITIES[b.card.rarity].tier
      || RARITIES[a.card.rarity].entries - RARITIES[b.card.rarity].entries
      || a.i - b.i)
    .map(({ card }) => card);
}
