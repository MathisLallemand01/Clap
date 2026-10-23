import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Card } from '@/lib/types';
import { Tilt } from './Tilt';

export function cardHref(card: Pick<Card, 'kind' | 'id' | 'personId'>): string {
  return card.kind === 'role' ? `/role/${encodeURIComponent(card.id)}` : `/acteur/${card.personId}`;
}

/** Lien vers la fiche d'une carte (acteur ou rôle) : la carte se soulève et s'incline vers la souris. */
export function CardLink({ card, children, className }: { card: Card; children: ReactNode; className?: string }) {
  return (
    <Link href={cardHref(card)} className={`card-link ${className ?? ''}`} aria-label={`Fiche de ${card.first} ${card.last}${card.character ? `, ${card.character}` : ''}`}>
      <Tilt>{children}</Tilt>
    </Link>
  );
}
