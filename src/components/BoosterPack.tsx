import type { CSSProperties } from 'react';
import { slotKinds, type BoosterDef } from '@/lib/boosters';
import type { Card } from '@/lib/types';
import styles from './BoosterPack.module.css';

type Props = {
  booster: BoosterDef;
  /** La vedette photographiée sur le paquet. */
  cover?: Card | null;
  width?: number;
  float?: boolean;
  interactive?: boolean;
  /** Animation d'ouverture (le haut se déchire). */
  tearing?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** Contour cranté (dents de soudure) en haut et en bas, en pourcentages. */
function crimpPath(teeth = 24, depth = 1): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const x = (i / (teeth * 2)) * 100;
    top.push(`${x.toFixed(2)}% ${i % 2 ? 0 : depth}%`);
    bottom.push(`${(100 - x).toFixed(2)}% ${i % 2 ? 100 : 100 - depth}%`);
  }
  return `polygon(${[...top, ...bottom].join(', ')})`;
}

const CLIP = crimpPath();
/** La bande du haut qui s'arrache à l'ouverture : seulement les dents du haut. */
const CLIP_TOP_ONLY = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) pts.push(`${((i / 48) * 100).toFixed(2)}% ${i % 2 ? 0 : 9}%`);
  return `polygon(${pts.join(', ')}, 100% 100%, 0% 100%)`;
})();

function contents(booster: BoosterDef): string {
  const { actor, role } = slotKinds(booster);
  if (!role) return `${actor} ACTEURS`;
  if (!actor) return `${role} RÔLES`;
  return `${actor} ACTEUR${actor > 1 ? 'S' : ''} + ${role} RÔLE${role > 1 ? 'S' : ''}`;
}

/** Un sachet de cartes en aluminium sombre : la vedette sérigraphiée en points, dans la teinte du thème. */
export function BoosterPack({ booster, cover, width = 240, float, interactive, tearing, className, style }: Props) {
  const t = booster.theme;
  const vars = {
    width,
    fontSize: width / 20,
    '--hue': t.hue,
    '--base': t.base,
    '--metal': t.metal,
    ...style,
  } as CSSProperties;
  // Les bobines Événement sont des éditions limitées : leurs accents sont holographiques (multicolores).
  const holo = booster.group === 'event';
  const classes = [styles.pack, holo && styles.holo, float && styles.float, interactive && styles.interactive, tearing && styles.tearing, className].filter(Boolean).join(' ');
  const image = cover?.image?.replace(/\/t\/p\/\w+\//, width * 2 > 500 ? '/t/p/h632/' : '/t/p/w500/');

  return (
    <div className={classes} style={vars} role="img" aria-label={`Bobine ${booster.name}`}>
      <div className={styles.body} style={{ clipPath: CLIP }}>
        {image && (
          <div className={styles.art}>
            <img className={styles.dots} src={image} alt="" loading="lazy" decoding="async" />
            <span className={styles.ink} />
            <img className={styles.ghost} src={image} alt="" loading="lazy" decoding="async" />
          </div>
        )}
        <span className={styles.fade} />
        <span className={styles.crinkle} />
        <span className={`${styles.perf} ${styles.perfL}`} />
        <span className={`${styles.perf} ${styles.perfR}`} />

        <div className={styles.head}>
          <span className={styles.logo}><span className={styles.bars}><i /><i /><i /></span>CLAP</span>
          <span>BOBINE {booster.code}</span>
        </div>
        {t.chance && (
          <span className={styles.chance}><small>{t.chance[0]}</small>{t.chance[1]}</span>
        )}
        <div className={styles.title}>
          <span className={styles.label}>{t.label}</span>
          <span className={styles.name}>{t.title ?? booster.name}</span>
          <span className={styles.rule} />
        </div>
        <div className={styles.foot}><span>{contents(booster)}</span></div>
        <span className={styles.seal2026} aria-hidden="true"><i /><b>2026</b></span>

        <span className={`${styles.seal} ${styles.sealBottom}`} />
        <span className={styles.edges} />
        <span className={styles.sheen} />
      </div>
      <div className={styles.strip} style={{ clipPath: CLIP_TOP_ONLY }}>
        <span className={`${styles.seal} ${styles.sealTop}`} />
        <span className={styles.tear}>ouvrir ici</span>
      </div>
    </div>
  );
}
