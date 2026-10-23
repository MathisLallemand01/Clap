import type { BoosterDef } from '@/lib/boosters';
import styles from './BoosterCanister.module.css';

/** Une bobine : la boîte de pellicule, avec l'étiquette propre à son thème. */
export function BoosterCanister({ booster, size = 240 }: { booster: BoosterDef; size?: number }) {
  const { look } = booster;
  return (
    <div className={styles.wrap} style={{ width: size, height: size, fontSize: size / 24 }} aria-hidden="true">
      <div className={styles.tail} />
      <div className={styles.tin}>
        <span className={styles.hole} />
        <span className={styles.hole} />
        <span className={styles.hole} />
        <div className={styles.disc} style={{ background: look.disc, color: look.ink }}>
          {look.pattern && <div className={styles.pattern} style={{ background: look.pattern }} />}
          <span className={styles.code}>CLAP · {booster.code}</span>
          <span className={styles.label}>{booster.label}</span>
        </div>
      </div>
    </div>
  );
}
