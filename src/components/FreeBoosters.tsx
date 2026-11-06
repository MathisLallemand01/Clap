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
      <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><circle cx="12" cy="7.5" r="1.6" /><circle cx="16.3" cy="13.4" r="1.6" /><circle cx="7.7" cy="13.4" r="1.6" /><circle cx="12" cy="12" r="0.8" fill="currentColor" />
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
