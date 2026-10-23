import styles from './SideRails.module.css';

/**
 * Les marges de la page habillées comme le bord d'une pellicule : texte vertical, règle graduée,
 * numéros d'image à gauche ; code temporel, perforations qui défilent et code-barres à droite.
 * Purement décoratif, masqué quand les marges sont trop étroites.
 */
export function SideRails({ left, right }: { left: string; right: string }) {
  return (
    <div className={styles.rails} aria-hidden="true">
      <div className={`${styles.rail} ${styles.left}`}>
        <span className={styles.rec}>◉ REC</span>
        <span className={`${styles.text} ${styles.up}`}>{left}</span>
        <span className={styles.ruler}>
          <i style={{ top: '30%' }}>12</i>
          <i style={{ top: '50%' }}>12A</i>
          <i style={{ top: '70%' }}>13</i>
        </span>
        <span className={styles.small}>◀ A</span>
      </div>
      <div className={`${styles.rail} ${styles.right}`}>
        <span className={styles.blink} />
        <span className={styles.text}>{right}</span>
        <span className={styles.perfs} />
        <span className={styles.barcode}><i /><i /><i /><i /><i /><i /></span>
        <span className={styles.small}>B ▶</span>
      </div>
    </div>
  );
}
