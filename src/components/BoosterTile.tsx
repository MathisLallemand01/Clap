import Link from 'next/link';
import { slotKinds, type BoosterDef } from '@/lib/boosters';
import { formatNumber } from '@/lib/format';
import { RARITIES, type Rarity } from '@/lib/rarity';
import { BoosterCanister } from './BoosterCanister';
import styles from './BoosterTile.module.css';

function contents(def: BoosterDef): string {
  const { actor, role } = slotKinds(def);
  const parts = [actor && `${actor} ACTEUR${actor > 1 ? 'S' : ''}`, role && `${role} RÔLE${role > 1 ? 'S' : ''}`];
  return parts.filter(Boolean).join(' + ');
}

/** Répartition des raretés du dernier slot (le plus généreux) pour la barre de chances. */
function oddsBar(def: BoosterDef): { rarity: Rarity; weight: number }[] {
  const slot = def.slots[def.slots.length - 1];
  return (Object.entries(slot.odds) as [Rarity, number][]).map(([rarity, weight]) => ({ rarity, weight: Math.max(weight, 1.2) }));
}

export function BoosterTile({ booster, size = 230, free }: { booster: BoosterDef; size?: number; free: boolean }) {
  return (
    <article className={styles.tile}>
      <div className={styles.head}>
        <span className="eyebrow">BOBINE {booster.code}</span>
        <span className={styles.tag}>{contents(booster)}</span>
      </div>
      <div className={styles.art}>
        <BoosterCanister booster={booster} size={size} />
      </div>
      <div className={styles.text}>
        <h3 className="display">{booster.name}</h3>
        <p>{booster.description}</p>
      </div>
      <div className={styles.odds} aria-hidden="true">
        {oddsBar(booster).map(({ rarity, weight }) => (
          <span key={rarity} style={{ flex: weight, background: RARITIES[rarity].color }} />
        ))}
      </div>
      <Link href={`/ouvrir/${booster.id}`} className={`btn ${free ? 'btn-light' : ''}`}>
        {free ? 'Ouvrir · offerte' : `Ouvrir · ${formatNumber(booster.price)} tickets`}
      </Link>
    </article>
  );
}
