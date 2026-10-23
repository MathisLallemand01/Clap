import Link from 'next/link';
import type { BoosterDef } from '@/lib/boosters';
import { formatNumber } from '@/lib/format';
import { RARITIES, type Rarity } from '@/lib/rarity';
import type { Card } from '@/lib/types';
import { BoosterPack } from './BoosterPack';
import styles from './PackTile.module.css';

/** Barre de chances du dernier slot (le plus généreux de la bobine). */
function oddsBar(def: BoosterDef): { rarity: Rarity; weight: number }[] {
  const slot = def.slots[def.slots.length - 1];
  return (Object.entries(slot.odds) as [Rarity, number][]).map(([rarity, weight]) => ({ rarity, weight: Math.max(weight, 1.5) }));
}

type Props = { booster: BoosterDef; cover: Card | null; free: boolean; canAfford: boolean; owned?: number; total?: number; delay?: number };

export function PackTile({ booster, cover, free, canAfford, owned, total, delay = 0 }: Props) {
  const pct = total ? Math.round(((owned ?? 0) / total) * 100) : null;
  return (
    <article className={styles.tile}>
      <Link href={`/bobines/${booster.id}`} className={styles.art} aria-label={`Contenu de la bobine ${booster.name}`}>
        <BoosterPack booster={booster} cover={cover} width={200} float interactive page="var(--panel)" style={{ animationDelay: `${delay}s` }} />
      </Link>
      <div className={styles.text}>
        <h3 className="display">{booster.name}</h3>
        <p>{booster.description}</p>
      </div>
      <div className={styles.odds} aria-hidden="true">
        {oddsBar(booster).map(({ rarity, weight }) => <span key={rarity} style={{ flex: weight, background: RARITIES[rarity].color }} />)}
      </div>
      {pct !== null && (
        <div className={styles.progress}>
          <span>COMPLÉTÉE</span>
          <span className={styles.bar}><span style={{ width: `${pct}%`, background: booster.theme.accent === '#0B0B0D' ? 'var(--text)' : booster.theme.accent }} /></span>
          <span>{pct} %</span>
        </div>
      )}
      <div className={styles.actions}>
        <Link href={`/bobines/${booster.id}`} className="btn btn-sm">Contenu</Link>
        {free || canAfford ? (
          <Link href={`/ouvrir/${booster.id}`} className={`btn btn-sm ${free ? 'btn-primary' : 'btn-light'}`}>
            {free ? 'Ouvrir · offerte' : `Ouvrir · ${formatNumber(booster.price)} TK`}
          </Link>
        ) : (
          <span className="btn btn-sm" aria-disabled="true">{formatNumber(booster.price)} TK</span>
        )}
      </div>
    </article>
  );
}
