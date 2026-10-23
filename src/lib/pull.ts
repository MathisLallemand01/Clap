import type { BoosterDef, Slot } from './boosters.ts';
import { ladderOf, type Rarity } from './rarity.ts';
import { themeFor } from './themes.ts';
import type { Card } from './types.ts';

export type Rng = () => number;

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
  if (def.pool === 'themes') return catalog.filter((c) => themeFor(c));
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
 * Ouvre une bobine : une carte par slot, dans l'ordre des slots.
 * `topFirst` : la première carte est de la rareté la plus haute du slot (cadeau de la toute première bobine).
 */
export function openBooster(def: BoosterDef, catalog: Card[], rng: Rng = Math.random, { topFirst = false } = {}): Card[] {
  const pool = boosterPool(def, catalog);
  const cards: Card[] = [];
  for (const [i, slot] of def.slots.entries()) {
    const card = pickCard(slot.kind, topFirst && i === 0 ? topRarity(slot) : rollRarity(slot, rng), pool, rng);
    if (card) cards.push(card);
  }
  return cards;
}
