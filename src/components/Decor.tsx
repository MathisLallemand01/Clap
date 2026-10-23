import type { CSSProperties, ReactNode } from 'react';
import styles from './Decor.module.css';

// Les décors du plateau : du vrai matériel de cinéma, toujours derrière le contenu (aria-hidden).

export function Reel({ size = 260, className = '', reverse = false, style }: { size?: number; className?: string; reverse?: boolean; style?: CSSProperties }) {
  const holes = Array.from({ length: 5 }, (_, k) => {
    const a = ((k * 72 - 90) * Math.PI) / 180;
    return { x: 100 + 48 * Math.cos(a), y: 100 + 48 * Math.sin(a) };
  });
  return (
    <svg className={`${styles.reel} ${reverse ? styles.reverse : ''} ${className}`} style={{ width: size, height: size, ...style }} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="#16161a" stroke="#2e2e35" strokeWidth="3" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#222227" strokeWidth="10" />
      {holes.map((h, i) => <circle key={i} cx={h.x} cy={h.y} r="20" fill="#0b0b0d" />)}
      <circle cx="100" cy="100" r="14" fill="#ff4a1c" />
      <circle cx="100" cy="100" r="5" fill="#0b0b0d" />
    </svg>
  );
}

/** Le compte à rebours d'amorce, 3 · 2 · 1. */
export function Leader({ size = 190, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`${styles.leader} ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.58) }} aria-hidden="true">
      <span className={styles.sweep} />
      <span className={styles.crossV} />
      <span className={styles.crossH} />
      <span className={styles.ring} />
      <span className={`${styles.n} ${styles.n3}`}>3</span>
      <span className={`${styles.n} ${styles.n2}`}>2</span>
      <span className={`${styles.n} ${styles.n1}`}>1</span>
    </div>
  );
}

/** Le faisceau du projecteur, qui part d'un coin et scintille légèrement. */
export function Beam({ className = '', from = 'right' }: { className?: string; from?: 'left' | 'right' }) {
  return <div className={`${styles.beam} ${from === 'left' ? styles.beamLeft : ''} ${className}`} aria-hidden="true" />;
}

/** Poussière dans la lumière. */
export function Dust({ className = '' }: { className?: string }) {
  const specks = [[30, 60], [45, 40], [20, 35], [55, 70], [38, 82], [62, 52], [26, 75], [50, 28], [70, 40], [80, 66]];
  return (
    <div className={`${styles.dust} ${className}`} aria-hidden="true">
      {specks.map(([x, y], i) => <span key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-i * 0.7}s` }} />)}
    </div>
  );
}

export function Clapper({ scene = '06', take = '01', who = 'VOUS', className = '' }: { scene?: string; take?: string; who?: string; className?: string }) {
  return (
    <div className={`${styles.clapper} ${className}`} aria-hidden="true">
      <div className={styles.arm} />
      <div className={styles.stick} />
      <div className={styles.slate}>
        <span>SCÈNE<b>{scene}</b></span>
        <span>PRISE<b className={styles.hot}>{take}</b></span>
        <span>JOUEUR<b>{who}</b></span>
      </div>
    </div>
  );
}

/**
 * Le cadre des événements : un trait de lumière fait lentement le tour du bord, et un faisceau de
 * projecteur traverse le bloc. En édition limitée (`holo`), la lumière est multicolore.
 */
export function EventFrame({ children, className = '', holo = false, style }: { children: ReactNode; className?: string; holo?: boolean; style?: CSSProperties }) {
  return (
    <div className={`${styles.eframe} ${holo ? styles.eholo : ''} ${className}`} style={style}>
      <span className={styles.ering} aria-hidden="true" />
      <div className={styles.einner}>
        <span className={styles.ebeam} aria-hidden="true" />
        <div className={styles.econtent}>{children}</div>
      </div>
    </div>
  );
}

/** Ticket d'entrée détachable. */
export function TicketStub({ top, big, bottom, className = '', style }: { top: string; big: string; bottom: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`${styles.ticket} ${className}`} style={style} aria-hidden="true">
      <div className={styles.ticketMain}>
        <span>{top}</span>
        <b>{big}</b>
        <span>{bottom}</span>
      </div>
      <div className={styles.ticketStub} />
    </div>
  );
}

/** Repères de cadrage aux quatre coins de l'élément parent, avec un code temporel. */
export function CropMarks({ timecode, rec = false, className = '' }: { timecode?: string; rec?: boolean; className?: string }) {
  return (
    <div className={`${styles.crop} ${className}`} aria-hidden="true">
      <span className={styles.tl} /><span className={styles.tr} /><span className={styles.bl} /><span className={styles.br} />
      {rec && <span className={styles.rec}><i />REC</span>}
      {timecode && <span className={styles.tc}>{timecode}</span>}
    </div>
  );
}

/** Rayons qui tournent lentement derrière une carte de rang 5. */
export function Rays({ color = 'rgba(255, 46, 147, 0.1)', className = '' }: { color?: string; className?: string }) {
  return <div className={`${styles.rays} ${className}`} style={{ ['--ray' as string]: color }} aria-hidden="true" />;
}

/** Deux projecteurs qui balaient le ciel (avant-première). */
export function Searchlights({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.search} ${className}`} aria-hidden="true">
      <span className={styles.searchL} />
      <span className={styles.searchR} />
    </div>
  );
}

/** L'en-tête de section façon claquette : « SCÈNE 02 », pellicule qui défile, légende. */
export function Scene({ n, label, className = '' }: { n: number | string; label?: string; className?: string }) {
  return (
    <div className={`${styles.scene} ${className}`}>
      <span className={styles.sceneTag}>SCÈNE {String(n).padStart(2, '0')}</span>
      <span className={styles.sceneLine} aria-hidden="true" />
      {label && <span className={styles.sceneLabel}>{label}</span>}
    </div>
  );
}
