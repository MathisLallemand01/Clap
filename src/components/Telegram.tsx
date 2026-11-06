'use client';

import Link from 'next/link';
import { useState } from 'react';
import { dismissTelegramAction } from '@/app/regie/actions';
import type { Notification } from '@/lib/notify';
import styles from './Telegram.module.css';

/** Le télégramme de la Régie : une urgence (carte guettée en vente, enchère dépassée) affichée à l'arrivée. */
export function Telegram({ telegram }: { telegram: Notification }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  const close = () => { setClosed(true); void dismissTelegramAction(telegram.id); };
  const words = telegram.text.replace(/\s*:\s*/g, '. STOP. ').replace(/\.\s*$/, '').toUpperCase();
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.paper}>
        <b className={styles.head}>Télégramme de la Régie</b>
        <p className={styles.text}>{words}. STOP.</p>
        <div className={styles.actions}>
          {telegram.href && <Link href={telegram.href} className="btn btn-sm btn-primary" onClick={close}>Voir</Link>}
          <button type="button" className={`btn btn-sm ${styles.later}`} onClick={close}>Plus tard</button>
        </div>
      </div>
    </div>
  );
}
