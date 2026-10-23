import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Card } from '@/lib/types';

export function cardHref(card: Pick<Card, 'kind' | 'id' | 'personId'>): string {
  return card.kind === 'role' ? `/role/${encodeURIComponent(card.id)}` : `/acteur/${card.personId}`;
}

/** Lien vers la fiche d'une carte (acteur ou rôle), avec un léger soulèvement au survol. */
export function CardLink({ card, children, className }: { card: Card; children: ReactNode; className?: string }) {
  return (
    <Link href={cardHref(card)} className={`card-link ${className ?? ''}`} aria-label={`Fiche de ${card.first} ${card.last}${card.character ? `, ${card.character}` : ''}`}>
      {children}
    </Link>
  );
}
