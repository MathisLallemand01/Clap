import type { CSSProperties } from 'react';
import { formatSerial } from '@/lib/format';
import { FAMILY, isTopRarity, ladderOf, RARITIES } from '@/lib/rarity';
import type { Card } from '@/lib/types';
import styles from './GameCard.module.css';

type Props = {
  card: Card;
  width?: number;
  /** Numéro de série de l'exemplaire ; à défaut, le numéro du catalogue n'est pas affiché. */
  serial?: number;
  /** Charger la photo tout de suite (ouverture de bobine, haut de page). */
  eager?: boolean;
  /** Carte en vitrine : l'éclat holographique balaie la photo en continu. */
  live?: boolean;
};

/**
 * Choisit la taille d'image TMDB pour garder deux pixels par point affiché (écrans haute densité).
 * Le photogramme d'un rôle est un plan large recadré en hauteur : il lui faut environ trois fois la largeur de la carte.
 */
function sized(url: string, kind: Card['kind'], width: number, poster: boolean): string {
  // Une affiche est déjà au format portrait : deux pixels par point suffisent (tailles d'affiche TMDB).
  const size = kind === 'actor' || poster
    ? (width * 2 <= 185 ? 'w185' : width * 2 <= 342 ? 'w342' : width * 2 <= 500 ? 'w500' : 'w780')
    : (width * 3 <= 300 ? 'w300' : width * 3 <= 780 ? 'w780' : 'w1280');
  return url.replace(/\/t\/p\/\w+\//, `/t/p/${size}/`);
}

const FOILS: Record<string, string> = {
  legende: 'repeating-linear-gradient(115deg, transparent 0 1.4em, rgba(255,200,61,0.18) 1.4em 1.55em, rgba(140,210,255,0.14) 1.55em 1.7em, transparent 1.7em 3.4em)',
  vedette: 'repeating-linear-gradient(65deg, transparent 0 1.3em, rgba(255,181,71,0.18) 1.3em 1.45em, rgba(255,240,200,0.12) 1.45em 1.6em, transparent 1.6em 3.2em)',
  mythe: 'repeating-linear-gradient(65deg, transparent 0 0.9em, rgba(255,36,64,0.24) 0.9em 1.05em, rgba(255,230,0,0.14) 1.05em 1.2em, rgba(46,230,214,0.14) 1.2em 1.35em, rgba(181,123,255,0.14) 1.35em 1.5em, transparent 1.5em 2.8em)',
  icone: 'repeating-linear-gradient(65deg, transparent 0 1em, rgba(255,46,147,0.24) 1em 1.15em, rgba(255,200,230,0.16) 1.15em 1.3em, transparent 1.3em 2.6em)',
};

/** Une carte Acteur (portrait) ou Rôle (photogramme), dessinée comme dans la maquette. */
export function GameCard({ card, width = 240, serial, eager = false, live = false }: Props) {
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
  const top = isTopRarity(card.rarity);
  const poster = card.tags.includes('img:poster');
  const series = card.tags.includes('media:tv');
  const family = FAMILY[card.kind];
  const liveClass = live ? styles.live : '';
  const image = card.image
    ? <img src={sized(card.image, card.kind, width, poster)} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" className={poster ? styles.posterImg : undefined} />
    : null;
  const shine = rarity.foil && (
    <>
      <span className={styles.foil} style={{ backgroundImage: FOILS[card.rarity] }} />
      <span className={styles.sheen} />
    </>
  );
  const label = card.kind === 'actor'
    ? `${card.first} ${card.last}, carte Acteur · ${rarity.label}`
    : `${card.first} ${card.last} dans ${series ? 'la série ' : ''}${card.film}, rôle de ${card.character}, carte Rôle · ${rarity.label}`;
  // La famille, écrite sur la photo : on ne confond jamais une carte Acteur et une carte Rôle.
  const chip = <span className={`${styles.family} ${card.kind === 'actor' ? styles.familyActor : styles.familyRole}`}>{family.mark} {family.label.toUpperCase()}</span>;

  if (card.kind === 'actor') {
    return (
      <div className={`${styles.card} ${styles.actor} ${top ? styles.top5 : ''} ${liveClass}`} style={style} role="img" aria-label={label}>
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
          {chip}
        </div>
        <div className={styles.names}>
          <span className={styles.first}>{card.first}</span>
          <span className={styles.last}>{card.last}</span>
        </div>
        <div className={styles.foot}>
          <div className={styles.meter}>
            {ladder.map((r, i) => <span key={r} className={i < rarity.tier ? styles.on : ''} />)}
          </div>
          <span className={styles.tag}>{card.origin ?? ''}</span>
        </div>
      </div>
    );
  }

  // Le portrait de l'acteur est toujours incrusté : deux cartes du même film (même affiche, même plan)
  // ne se confondent jamais, on voit d'abord qui joue.
  const withPortrait = Boolean(card.portrait);
  return (
    <div className={`${styles.card} ${styles.role} ${top ? styles.top5 : ''} ${card.rarity === 'icone' ? styles.icon : ''} ${card.rarity === 'mythe' ? styles.mythe : ''} ${liveClass}`} style={style} role="img" aria-label={label}>
      <div className={styles.rail}><span /></div>
      <div className={styles.roleBody}>
        <div className={styles.head}>
          <span className={styles.rarity}><span className={styles.diamond} />{rarity.label}</span>
          {number && <span className={styles.num}>{number}</span>}
        </div>
        {/* Le titre du film, en grand : deux cartes du même film se distinguent par l'acteur, pas par le titre. */}
        <div className={styles.filmBand}>
          {series && <b className={styles.series}>SÉRIE</b>}
          <span className={styles.filmTitle}>{card.film}</span>
          {card.year && <span className={styles.filmYear}>{card.year}</span>}
        </div>
        <div className={`${styles.photo} ${styles.still} ${withPortrait ? styles.withPortrait : ''}`}>
          {image ?? <span className={styles.source}>PHOTOGRAMME · TMDB</span>}
          {image && <span className={styles.scrim} />}
          {shine}
          {chip}
          {withPortrait && (
            <span className={styles.portrait}>
              <img src={sized(card.portrait!, 'actor', Math.round(width * 0.4), false)} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" />
            </span>
          )}
          <div className={styles.asBlock}>
            <span className={styles.as}>DANS LE RÔLE DE</span>
            <span className={styles.character}>{card.character}</span>
          </div>
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
