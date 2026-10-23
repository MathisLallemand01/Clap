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
  /** Couleur du fond de page, pour les encoches de déchirure. */
  page?: string;
  className?: string;
  style?: CSSProperties;
};

/** Contour cranté (dents de soudure) en haut et en bas, en pourcentages. */
function crimpPath(teeth = 22, depth = 1.1): string {
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
const CLIP_TOP_ONLY = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 44; i++) pts.push(`${((i / 44) * 100).toFixed(2)}% ${i % 2 ? 0 : 10}%`);
  return `polygon(${pts.join(', ')}, 100% 100%, 0% 100%)`;
})();

export function BoosterPack({ booster, cover, width = 240, float, interactive, tearing, page, className, style }: Props) {
  const t = booster.theme;
  const { actor, role } = slotKinds(booster);
  const vars = {
    width,
    fontSize: width / 20,
    '--bg': t.bg,
    '--motif': t.motif ?? 'none',
    '--band': t.band ?? 'none',
    '--ink-c': t.ink,
    '--plate': t.plate,
    '--plate-ink': t.plateInk,
    '--page': page ?? 'var(--ink)',
    ...style,
  } as CSSProperties;
  const classes = [styles.pack, float && styles.float, interactive && styles.interactive, tearing && styles.tearing, className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={vars} role="img" aria-label={`Bobine ${booster.name}`}>
      <div className={styles.body} style={{ clipPath: CLIP }}>
        <div className={styles.motif} />
        {t.band && <div className={styles.band} />}
        <div className={`${styles.cover} ${t.tint ? styles.tinted : ''}`}>
          {cover?.image && <img src={cover.image.replace(/\/w\d+\//, width > 260 ? '/w500/' : '/w342/')} alt="" loading="lazy" decoding="async" />}
          {t.tint && <span className={styles.tint} style={{ background: t.tint }} />}
          {cover && <span className={styles.coverLabel}>{cover.first} {cover.last}</span>}
        </div>
        <div className={styles.plate}>
          <div className={styles.plateTop}><span>CLAP · {booster.code}</span><span>{actor + role} CARTES</span></div>
          <div className={styles.name}>{booster.name}</div>
          <div className={styles.tagline}>{t.tagline}</div>
        </div>
        <div className={styles.foot}>
          <span>{[actor && `${actor} ACT.`, role && `${role} RÔLE${role > 1 ? 'S' : ''}`].filter(Boolean).join(' + ')}</span>
          <span>35 MM</span>
        </div>
        <div className={`${styles.crimp} ${styles.crimpBottom}`} />
        <div className={styles.sheen} />
      </div>
      <div className={styles.strip} style={{ clipPath: CLIP_TOP_ONLY }}>
        <div>
          <div className={styles.motif} />
          <div className={`${styles.crimp} ${styles.crimpTop}`}><span>CLAP</span></div>
          {t.band && <div className={styles.band} />}
        </div>
      </div>
      <span className={styles.notch} />
      <span className={styles.notch} />
      <div className={styles.tear} style={{ color: t.ink }}>ouvrir ici</div>
    </div>
  );
}
