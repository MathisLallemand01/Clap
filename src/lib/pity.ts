import type { CardKind } from './rarity.ts';

// Les garanties : au bout d'un certain nombre de bobines sans grosse carte, la suivante en contient une.
// Les compteurs sont propres à chaque joueur et repartent à zéro dès que la carte tombe (garantie ou non).

/** « Tapis rouge » : au moins une carte de cran 5 (Légende côté Acteurs, Icône côté Rôles) toutes les 25 bobines. */
export const TAPIS_ROUGE_EVERY = 25;
/** « Bobine mythique » : un Mythe garanti au bout de 200 bobines. Le Mythe n'existe que côté Rôles. */
export const MYTHIQUE_AT = 200;

export type Special = 'tapis-rouge' | 'mythique';
/** Bobines ouvertes depuis la dernière carte de cran 5 (ou plus), et depuis le dernier Mythe. */
export type Pity = { legend: number; mythe: number };

export const SPECIALS: Record<Special, { name: string; short: string; color: string; guarantee: (family: CardKind) => string; explain: string }> = {
  'tapis-rouge': {
    name: 'Tapis rouge',
    short: 'TAPIS ROUGE',
    color: '#FFC83D',
    guarantee: (family) => (family === 'actor' ? 'Légende garantie' : 'Icône ou mieux garantie'),
    explain: `Toutes les ${TAPIS_ROUGE_EVERY} bobines sans grosse carte, la suivante déroule le tapis rouge : au moins une Légende (Casting) ou une Icône (Film).`,
  },
  mythique: {
    name: 'Bobine mythique',
    short: 'MYTHIQUE',
    color: '#FF2440',
    guarantee: () => 'Mythe garanti',
    explain: `Au bout de ${MYTHIQUE_AT} bobines sans Mythe, la prochaine bobine Film est mythique : un Mythe garanti.`,
  },
};

/** La garantie que portera la prochaine bobine de cette famille (la mythique passe avant le tapis rouge). */
export function nextSpecial(pity: Pity, family: CardKind): Special | null {
  if (family === 'role' && pity.mythe + 1 >= MYTHIQUE_AT) return 'mythique';
  if (pity.legend + 1 >= TAPIS_ROUGE_EVERY) return 'tapis-rouge';
  return null;
}

/** Les garanties d'une série de `count` bobines (en supposant qu'aucune grosse carte ne tombe par chance). */
export function specialsAhead(pity: Pity, family: CardKind, count: number): (Special | null)[] {
  const out: (Special | null)[] = [];
  let p = { ...pity };
  for (let i = 0; i < count; i++) {
    const s = nextSpecial(p, family);
    out.push(s);
    p = { legend: s ? 0 : p.legend + 1, mythe: s === 'mythique' ? 0 : p.mythe + 1 };
  }
  return out;
}

/** Bobines restantes avant chaque garantie (1 = la prochaine). */
export function pityLeft(pity: Pity): { tapisRouge: number; mythique: number } {
  return { tapisRouge: Math.max(1, TAPIS_ROUGE_EVERY - pity.legend), mythique: Math.max(1, MYTHIQUE_AT - pity.mythe) };
}
