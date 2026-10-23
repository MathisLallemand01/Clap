import type { Card } from './types.ts';

/** La fiche d'une carte : /acteur/1003 pour un Acteur, /role/1003:155 pour un Rôle (personne:film). */
export function cardHref(card: Pick<Card, 'id' | 'kind' | 'personId'>): string {
  return card.kind === 'actor' ? `/acteur/${card.personId}` : `/role/${card.id.slice('role:'.length)}`;
}

export function roleIdFromSlug(slug: string): string {
  return `role:${decodeURIComponent(slug)}`;
}
