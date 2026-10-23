'use client';

import { useEffect, useState } from 'react';
import styles from './FlipClock.module.css';

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

/** Compte à rebours en volets (jours, heures, minutes, secondes), comme un panneau d'horaires. */
export function FlipClock({ until }: { until: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = now === null ? null : Math.max(0, Math.floor((until - now) / 1000));
  const parts = [
    { k: 'JOURS', v: s === null ? '--' : pad(Math.floor(s / 86400)) },
    { k: 'HEURES', v: s === null ? '--' : pad(Math.floor((s % 86400) / 3600)) },
    { k: 'MIN', v: s === null ? '--' : pad(Math.floor((s % 3600) / 60)) },
    { k: 'SEC', v: s === null ? '--' : pad(s % 60) },
  ];
  return (
    <div className={styles.clock} role="timer" aria-label="Fin de l’événement">
      {parts.map((p) => (
        <div key={p.k} className={styles.unit}>
          <span className={styles.digits} suppressHydrationWarning>{p.v}</span>
          <span className={styles.label}>{p.k}</span>
        </div>
      ))}
    </div>
  );
}
