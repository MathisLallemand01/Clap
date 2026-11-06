'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FREE_BOOSTER_CAP, FREE_BOOSTER_EVERY_MS } from '@/lib/boosters';
import styles from './FreeBoosters.module.css';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Réserve de bobines offertes, dans la barre du haut : combien sont prêtes, et dans combien de temps
 * (minutes et secondes) la suivante arrive. Le décompte continue seul : à l'échéance, la réserve monte d'une
 * bobine et le décompte repart, sans recharger la page.
 */
export function FreeBoosters({ stock, nextFreeAt }: { stock: number; nextFreeAt: number | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Les recharges écoulées depuis l'affichage de la page sont ajoutées ici.
  let ready = stock;
  let next = nextFreeAt;
  if (now !== null && next !== null && now >= next) {
    const gained = Math.floor((now - next) / FREE_BOOSTER_EVERY_MS) + 1;
    ready = Math.min(FREE_BOOSTER_CAP, stock + gained);
    next = ready >= FREE_BOOSTER_CAP ? null : next + gained * FREE_BOOSTER_EVERY_MS;
  }
  const full = ready >= FREE_BOOSTER_CAP || next === null;
  const left = !full && now !== null && next !== null ? Math.max(0, next - now) : null;
  const clock = left === null ? '--:--' : `${pad(Math.floor(left / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`;
  const title = full
    ? `Réserve pleine : ${ready} bobines offertes prêtes.`
    : `${ready} bobine${ready > 1 ? 's' : ''} offerte${ready > 1 ? 's' : ''} sur ${FREE_BOOSTER_CAP}. La prochaine arrive dans ${clock} (une toutes les ${FREE_BOOSTER_EVERY_MS / 60_000} minutes).`;

  return (
    <Link href="/bobines" className={`pill ${styles.free} ${ready === 0 ? styles.empty : ''}`} title={title} aria-label={title}>
      {/* Un clap de cinéma : la bobine offerte qui arrive. */}
      <svg className={styles.icon} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        <path d="M3.5 10.5h17v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
        <path d="M3.2 10.4 2.6 7.3a1 1 0 0 1 .8-1.2l15.2-2.9a1 1 0 0 1 1.2.8l.6 3.1z" />
        <path d="m7.4 5.5 2.8 3.6M12.4 4.6l2.8 3.6M17.3 3.6l2.3 3" />
      </svg>
      <b suppressHydrationWarning>{ready}</b><span className={styles.cap}>/{FREE_BOOSTER_CAP}</span>
      {!full && (
        <span className={styles.timer} suppressHydrationWarning>
          <span className={styles.plus}>+1 dans</span> <time suppressHydrationWarning>{clock}</time>
        </span>
      )}
    </Link>
  );
}
