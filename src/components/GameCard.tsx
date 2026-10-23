import type { CSSProperties } from 'react';
import { formatSerial } from '@/lib/format';
import { ladderOf, RARITIES } from '@/lib/rarity';
import type { Card } from '@/lib/types';
import styles from './GameCard.module.css';

type Props = {
  card: Card;
  width?: number;
  /** Numéro de série de l'exemplaire ; à défaut, le numéro du catalogue n'est pas affiché. */
  serial?: number;
  /** Charger la photo tout de suite (ouverture de bobine, haut de page). */
  eager?: boolean;
};

/**
 * Choisit la taille d'image TMDB pour garder deux pixels par point affiché (écrans haute densité).
 * Le photogramme d'un rôle est un plan large recadré en hauteur : il lui faut environ trois fois la largeur de la carte.
 */
function sized(url: string, kind: Card['kind'], width: number): string {
  const size = kind === 'actor'
    ? (width * 2 <= 185 ? 'w185' : width * 2 <= 342 ? 'w342' : width * 2 <= 500 ? 'w500' : 'h632')
    : (width * 3 <= 300 ? 'w300' : width * 3 <= 780 ? 'w780' : 'w1280');
  return url.replace(/\/t\/p\/\w+\//, `/t/p/${size}/`);
}

const FOILS: Record<string, string> = {
  legende: 'repeating-linear-gradient(115deg, transparent 0 1.4em, rgba(255,200,61,0.18) 1.4em 1.55em, rgba(140,210,255,0.14) 1.55em 1.7em, transparent 1.7em 3.4em)',
  chef: 'repeating-linear-gradient(65deg, transparent 0 1.2em, rgba(46,230,214,0.16) 1.2em 1.35em, rgba(242,239,232,0.12) 1.35em 1.5em, transparent 1.5em 3em)',
  icone: 'repeating-linear-gradient(65deg, transparent 0 1em, rgba(255,46,147,0.24) 1em 1.15em, rgba(255,200,230,0.16) 1.15em 1.3em, transparent 1.3em 2.6em)',
};

/** Une carte Acteur (portrait) ou Rôle (photogramme), dessinée comme dans la maquette. */
export function GameCard({ card, width = 240, serial, eager = false }: Props) {
  const rarity = RARITIES[card.rarity];
  const ladder = ladderOf(card.kind);
  const style = {
    width,
    fontSize: width / 20,
    '--rc': rarity.color,
    '--tone': card.tone,
  } as CSSProperties;
  const initials = `${card.first[0] ?? ''}${card.last[0] ?? ''}`;
  const number = serial ? `№ ${formatSerial(serial)}` : null;
  const top = rarity.tier === ladder.length;
  const image = card.image
    ? <img src={sized(card.image, card.kind, width)} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" />
    : null;
  const shine = rarity.foil && (
    <>
      <span className={styles.foil} style={{ backgroundImage: FOILS[card.rarity] }} />
      <span className={styles.sheen} />
    </>
  );
  const label = card.kind === 'actor'
    ? `${card.first} ${card.last}, carte Acteur ${rarity.label}`
    : `${card.first} ${card.last} dans ${card.film}, rôle de ${card.character}, carte Rôle ${rarity.label}`;

  if (card.kind === 'actor') {
    return (
      <div className={`${styles.card} ${styles.actor} ${top ? styles.top5 : ''}`} style={style} role="img" aria-label={label}>
        <div className={styles.head}>
          <span className={styles.rarity}><span className={styles.dot} />{rarity.label}</span>
          {number && <span className={styles.num}>{number}</span>}
        </div>
        <div className={styles.photo}>
          {image ?? (
            <>
              <span className={styles.initials}>{initials}</span>
              <span className={styles.source}>PORTRAIT · TMDB</span>
            </>
          )}
          {shine}
        </div>
        <div className={styles.names}>
          <span className={styles.first}>{card.first}</span>
          <span className={styles.last}>{card.last}</span>
        </div>
        <div className={styles.foot}>
          <div className={styles.meter}>
            {ladder.map((r, i) => <span key={r} className={i < rarity.tier ? styles.on : ''} />)}
          </div>
          <span className={styles.tag}>ACTEUR{card.origin ? ` · ${card.origin}` : ''}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${styles.role} ${top ? styles.top5 : ''} ${card.rarity === 'icone' ? styles.icon : ''}`} style={style} role="img" aria-label={label}>
      <div className={styles.rail}><span /></div>
      <div className={styles.roleBody}>
        <div className={styles.head}>
          <span className={styles.rarity}><span className={styles.diamond} />{rarity.label}</span>
          {number && <span className={styles.num}>{number}</span>}
        </div>
        <span className={styles.film}>{card.film}{card.year ? ` · ${card.year}` : ''}</span>
        <div className={`${styles.photo} ${styles.still}`}>
          {image ?? <span className={styles.source}>PHOTOGRAMME · TMDB</span>}
          {image && <span className={styles.scrim} />}
          {shine}
          <span className={styles.as}>DANS LE RÔLE DE</span>
          <span className={styles.character}>{card.character}</span>
        </div>
        <div className={styles.roleFoot}>
          <div className={styles.roleName}>
            <span className={styles.first}>{card.first}</span>
            <span className={styles.last}>{card.last}</span>
          </div>
          <div className={styles.diamonds}>
            {ladder.map((r, i) => <span key={r} className={i < rarity.tier ? styles.on : ''} />)}
          </div>
        </div>
      </div>
      <div className={styles.rail}><span /></div>
    </div>
  );
}
