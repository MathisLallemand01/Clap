import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ACTOR_ODDS, FAMILY_SHELVES, ROLE_ODDS } from '@/lib/boosters';
import { FAMILY, ladderOf, RARITIES, type CardKind, type Rarity } from '@/lib/rarity';
import styles from './RarityLadder.module.css';

const ODDS: Partial<Record<Rarity, number>> = { ...ACTOR_ODDS, ...ROLE_ODDS };
const pct = (n: number | undefined) => `${String(n ?? 0).replace('.', ',')} %`;

/**
 * L'échelle d'une famille de cartes, de la plus rare à la plus commune : marqueur (rond = Acteur,
 * losange = Rôle), nom, règle en une phrase, chance dans une bobine standard et points au classement.
 */
export function RarityLadder({ kind, detailed = false }: { kind: CardKind; detailed?: boolean }) {
  const family = FAMILY[kind];
  const rows = [...ladderOf(kind)].reverse();
  const max = Math.max(...rows.map((r) => ODDS[r] ?? 0));
  return (
    <div className={`${styles.ladder} ${kind === 'actor' ? styles.actor : styles.role}`}>
      <div className={styles.head}>
        <span className={styles.kicker}><i className={kind === 'actor' ? styles.round : styles.diamond} />CARTES {family.label.toUpperCase()} · BOBINES {FAMILY_SHELVES[kind].title.toUpperCase()}</span>
        <span className={styles.basis}>{kind === 'actor' ? 'La personne, toute sa carrière.' : 'Un acteur dans un film ou une série.'}</span>
      </div>
      <ol className={styles.rows}>
        {rows.map((r) => {
          const info = RARITIES[r];
          return (
            <li key={r} id={detailed ? r : undefined} className={styles.row} style={{ '--rc': info.color } as CSSProperties}>
              <span className={styles.name}><i className={kind === 'actor' ? styles.round : styles.diamond} />{info.label}</span>
              <span className={styles.bar}><b style={{ width: `${Math.max(3, ((ODDS[r] ?? 0) / max) * 100)}%` }} /></span>
              <span className={styles.odds}>{pct(ODDS[r])}</span>
              <span className={styles.rule}>{info.rule}{detailed && <> · <b>{info.points} point{info.points > 1 ? 's' : ''}</b></>}</span>
            </li>
          );
        })}
      </ol>
      <span className={styles.foot}>Chances par carte dans une bobine standard ({kind === 'actor' ? 'Tout Casting' : 'Tout Clap'}). {!detailed && <Link href={`/raretes#${kind === 'actor' ? 'acteurs' : 'roles'}`}>Toutes les règles ▸</Link>}</span>
    </div>
  );
}
