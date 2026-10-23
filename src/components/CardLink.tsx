import Link from 'next/link';
import { cardHref } from '@/lib/links';
import { RARITIES } from '@/lib/rarity';
import type { Card } from '@/lib/types';
import { GameCard } from './GameCard';
import styles from './CardLink.module.css';

type Props = {
  card: Card;
  width?: number;
  serial?: number;
  /** Nombre d'exemplaires possédés : 0 grise la carte (« pas encore obtenue »), plus de 1 affiche ×N. */
  copies?: number;
};

/** Une carte cliquable qui mène à sa fiche. */
export function CardLink({ card, width = 190, serial, copies }: Props) {
  const missing = copies === 0;
  const name = `${card.first} ${card.last}`.trim();
  const label = card.kind === 'actor'
    ? `${name}, ${RARITIES[card.rarity].label}${missing ? ', pas encore obtenue' : ''}`
    : `${name} dans ${card.film}, ${RARITIES[card.rarity].label}${missing ? ', pas encore obtenue' : ''}`;
  return (
    <Link href={cardHref(card)} className={`${styles.link} ${missing ? styles.missing : ''}`} aria-label={label}>
      <GameCard card={card} width={width} serial={serial} />
      {copies !== undefined && copies > 1 && <span className={styles.copies}>×{copies}</span>}
      {missing && <span className={styles.badge}>À TROUVER</span>}
    </Link>
  );
}
