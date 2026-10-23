import styles from './SideRails.module.css';

type Mark = 'frame' | 'reel' | 'cross' | 'perfs' | 'code' | 'star' | 'tc' | 'bars';
const PATTERN: Mark[] = ['frame', 'cross', 'reel', 'perfs', 'tc', 'star', 'bars', 'frame', 'code', 'cross'];
/** Espacement vertical entre deux petits symboles. */
const STEP = 190;
const COUNT = 60;

function Symbol({ kind, i, side }: { kind: Mark; i: number; side: 'l' | 'r' }) {
  switch (kind) {
    case 'frame': return <span className={styles.txt}>{12 + Math.floor(i / 2)}{i % 2 ? 'A' : ''}</span>;
    case 'reel':
      return (
        <svg className={styles.reel} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" />
          {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={10 + 4.6 * Math.cos((a * Math.PI) / 180)} cy={10 + 4.6 * Math.sin((a * Math.PI) / 180)} r="1.8" fill="currentColor" />)}
        </svg>
      );
    case 'cross': return <span className={styles.cross} />;
    case 'perfs': return <span className={styles.perfs}><i /><i /><i /></span>;
    case 'tc': return <span className={`${styles.txt} ${styles.vertical}`}>{`00:${String(i % 60).padStart(2, '0')}:${String((i * 7) % 24).padStart(2, '0')}`}</span>;
    case 'star': return <span className={side === 'l' ? styles.accent : styles.star}>✦</span>;
    case 'bars': return <span className={styles.bars}><i /><i /><i /><i /></span>;
    case 'code': return <span className={`${styles.txt} ${styles.vertical}`}>{side === 'l' ? 'KODAK 5219' : '35 MM'}</span>;
  }
}

/**
 * Les marges de la page, habillées comme le bord d'une pellicule : de petits symboles discrets
 * (numéros d'image, bobines, croix de repère, perforations, codes temporels) à intervalles réguliers
 * sur toute la hauteur. Posés sur la page, tout au bord de l'écran ; masqués quand la place manque.
 */
export function SideRails({ left, right }: { left?: string; right?: string }) {
  const column = (side: 'l' | 'r', label?: string) => (
    <div className={`${styles.rail} ${side === 'l' ? styles.left : styles.right}`}>
      {label && <span className={`${styles.label} ${side === 'l' ? styles.up : ''}`}>{label}</span>}
      {Array.from({ length: COUNT }, (_, i) => {
        const kind = PATTERN[(i + (side === 'r' ? 4 : 0)) % PATTERN.length];
        return (
          <span key={i} className={styles.slot} style={{ top: 420 + i * STEP + (side === 'r' ? STEP / 2 : 0) }}>
            <Symbol kind={kind} i={i} side={side} />
          </span>
        );
      })}
    </div>
  );
  return (
    <div className={styles.rails} aria-hidden="true">
      {column('l', left)}
      {column('r', right)}
    </div>
  );
}
