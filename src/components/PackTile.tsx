import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { BoosterDef } from '@/lib/boosters';
import { formatNumber } from '@/lib/format';
import type { Card } from '@/lib/types';
import { BoosterPack } from './BoosterPack';
import styles from './PackTile.module.css';

type Props = {
  booster: BoosterDef;
  cover: Card | null;
  free: boolean;
  canAfford: boolean;
  owned?: number;
  total?: number;
  delay?: number;
  /** Autocollant sur le paquet : « Nouveau », « Du jour », « Populaire ». */
  flag?: string;
};

/** Un paquet posé sur l'étagère : la bobine, son prix en ticket, la part de la collection déjà obtenue. */
export function PackTile({ booster, cover, free, canAfford, owned, total, delay = 0, flag }: Props) {
  const pct = total ? Math.round(((owned ?? 0) / total) * 100) : null;
  return (
    <article className={styles.tile} style={{ '--hue': booster.theme.hue } as CSSProperties}>
      <Link href={`/bobines/${booster.id}`} className={styles.art} aria-label={`Contenu de la bobine ${booster.name}`}>
        <BoosterPack booster={booster} cover={cover} width={200} float interactive style={{ animationDelay: `${delay}s` }} />
        {flag && <span className={styles.flag}>{flag}</span>}
      </Link>
      <span className={styles.shelf} aria-hidden="true" />
      <h3 className={styles.name}>{booster.name}</h3>
      <div className={styles.meta}>
        <span className={styles.price}>
          <b>{formatNumber(booster.price)} TK</b>
          <span>{free ? 'OU OFFERTE' : 'TICKETS'}</span>
        </span>
        {pct !== null && <span className={styles.pct} title={`${owned} cartes sur ${total}`}>{pct} %</span>}
      </div>
      <div className={styles.actions}>
        <Link href={`/bobines/${booster.id}`} className="btn btn-sm">Contenu</Link>
        {free || canAfford ? (
          <Link href={`/ouvrir/${booster.id}`} className={`btn btn-sm ${free ? 'btn-primary' : 'btn-light'}`}>{free ? 'Ouvrir · offerte' : 'Ouvrir'}</Link>
        ) : (
          <span className="btn btn-sm" aria-disabled="true">Trop cher</span>
        )}
      </div>
    </article>
  );
}
