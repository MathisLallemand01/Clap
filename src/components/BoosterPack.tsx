import type { CSSProperties } from 'react';
import { slotKinds, type BoosterDef } from '@/lib/boosters';
import type { Card } from '@/lib/types';
import { SPECIALS, type Special } from '@/lib/pity';
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
  /** Ouverture à la main : avancée de la déchirure (0 à 1), qui suit le geste. */
  tear?: number;
  /** La bande est arrachée : elle s'envole et le corps n'a plus de haut (bord déchiré). */
  torn?: boolean;
  /** Le geste est en cours (pas de transition : la fente colle au doigt). */
  held?: boolean;
  /** Paquet garanti : Tapis rouge (Légende / Icône minimum) ou Bobine mythique (Mythe garanti). */
  special?: Special | null;
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

/** Hauteur de la bande du haut, en % de la hauteur du paquet (3,6 em sur 31). */
const STRIP_PCT = (3.6 / 31) * 100;
/** Le corps une fois la bande arrachée : bord du haut déchiré (dents irrégulières), dents de soudure en bas. */
const CLIP_TORN = (() => {
  const top: string[] = [];
  const teeth = 34;
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    const y = STRIP_PCT - 0.2 + (i % 2 ? 0.9 : 0) + ((i * 7) % 5) * 0.12;
    top.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  const bottom: string[] = [];
  for (let i = 0; i <= 48; i++) bottom.push(`${(100 - (i / 48) * 100).toFixed(2)}% ${i % 2 ? 100 : 99}%`);
  return `polygon(${[...top, ...bottom].join(', ')})`;
})();

function contents(booster: BoosterDef): string {
  const { actor, role } = slotKinds(booster);
  if (!role) return `${actor} ACTEURS`;
  if (!actor) return `${role} RÔLES`;
  return `${actor} ACTEUR${actor > 1 ? 'S' : ''} + ${role} RÔLE${role > 1 ? 'S' : ''}`;
}

/** Un sachet de cartes en aluminium sombre : la vedette sérigraphiée en points, dans la teinte du thème. */
export function BoosterPack({ booster, cover, width = 240, float, interactive, tearing, tear, torn, held, special, className, style }: Props) {
  const t = booster.theme;
  const vars = {
    width,
    fontSize: width / 20,
    '--hue': t.hue,
    '--base': t.base,
    '--metal': t.metal,
    '--tear': tear ?? 0,
    ...style,
  } as CSSProperties;
  // Les bobines Événement sont des éditions limitées : leurs accents sont holographiques (multicolores).
  const holo = booster.group === 'event';
  const classes = [styles.pack, holo && styles.holo, float && styles.float, interactive && styles.interactive, tearing && styles.tearing, torn && styles.torn, tear !== undefined && styles.manual, held && styles.dragging, special === 'tapis-rouge' && styles.tapis, special === 'mythique' && styles.mythique, className].filter(Boolean).join(' ');
  const image = cover?.image?.replace(/\/t\/p\/\w+\//, width * 2 > 500 ? '/t/p/h632/' : '/t/p/w500/');

  return (
    <div className={classes} style={vars} role="img" aria-label={`Bobine ${booster.name}`}>
      <div className={styles.body} style={{ clipPath: torn ? CLIP_TORN : CLIP }}>
        {image && (
          <div className={styles.art}>
            <img className={styles.dots} src={image} alt="" loading="lazy" decoding="async" />
            <span className={styles.ink} />
            <img className={styles.ghost} src={image} alt="" loading="lazy" decoding="async" />
          </div>
        )}
        <span className={styles.fade} />
        {special && <span className={styles.specialTint} />}
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

        {special && (
          // L'habit des paquets garantis : un bandeau en travers et un ruban en bas.
          <>
            <span className={styles.sash}><b>{SPECIALS[special].short}</b></span>
            <span className={styles.ribbon}>★ {SPECIALS[special].guarantee(booster.slots[0].kind)} ★</span>
          </>
        )}
        <span className={`${styles.seal} ${styles.sealBottom}`} />
        <span className={styles.edges} />
        <span className={styles.sheen} />
      </div>
      <div className={styles.strip} style={{ clipPath: CLIP_TOP_ONLY }}>
        <span className={`${styles.seal} ${styles.sealTop}`} />
        <span className={styles.tear}>ouvrir ici</span>
      </div>
      {special && <span className={styles.specialRing} aria-hidden="true" />}
      {tear !== undefined && (
        <>
          {/* La fente lumineuse qui suit le geste, et le liseré de papier déchiré qui apparaît derrière. */}
          <span className={styles.slit} aria-hidden="true" />
          <span className={styles.rip} aria-hidden="true" />
        </>
      )}
    </div>
  );
}
