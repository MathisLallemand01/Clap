import type { BoosterDef, Slot } from './boosters.ts';
import { ladderOf, type Rarity } from './rarity.ts';
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
 * le tag ou s'il a au moins un Rôle qui le porte (ex. un acteur d'un film des années 80).
 */
export function boosterPool(def: BoosterDef, catalog: Card[]): Card[] {
  const tag = def.tag;
  if (!tag) return catalog;
  const peopleWithTaggedRole = new Set(
    catalog.filter((c) => c.kind === 'role' && c.tags.includes(tag)).map((c) => c.personId),
  );
  return catalog.filter(
    (c) => c.tags.includes(tag) || (c.kind === 'actor' && peopleWithTaggedRole.has(c.personId)),
  );
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

/** Ouvre une bobine : une carte par slot, dans l'ordre des slots. */
export function openBooster(def: BoosterDef, catalog: Card[], rng: Rng = Math.random): Card[] {
  const pool = boosterPool(def, catalog);
  const cards: Card[] = [];
  for (const slot of def.slots) {
    const card = pickCard(slot.kind, rollRarity(slot, rng), pool, rng);
    if (card) cards.push(card);
  }
  return cards;
}
