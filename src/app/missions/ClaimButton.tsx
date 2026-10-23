'use client';

import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { TicketIcon } from '@/components/Icons';
import { formatNumber } from '@/lib/format';
import { createProjector, soundPreference } from '@/lib/sound';
import { claimAction, claimMissionNow } from './actions';
import styles from './ClaimButton.module.css';

type Show = { amount: number; phase: 'pop' | 'fly'; target: { x: number; y: number } };

/**
 * Récupère une récompense de mission : bruit de pièces, le gain s'affiche au centre sur un fond
 * assombri, puis file se ranger dans le compteur de tickets de la navigation, qui s'anime.
 * Sans JavaScript, le formulaire classique prend le relais.
 */
export function ClaimButton({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<Show | null>(null);

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // Le son est préparé pendant le clic : les navigateurs n'autorisent l'audio qu'après un geste.
    const projector = createProjector(soundPreference());
    const res = await claimMissionNow(missionId);
    if (!res.reward) {
      setBusy(false);
      projector.dispose();
      router.push(`/missions?erreur=${encodeURIComponent(res.error ?? 'Récompense indisponible.')}`);
      return;
    }
    const amount = res.reward;
    const pill = document.getElementById('wallet-tickets')?.getBoundingClientRect();
    const target = pill ? { x: pill.left + pill.width / 2, y: pill.top + pill.height / 2 } : { x: window.innerWidth - 120, y: 36 };
    projector.coins(Math.round(amount / 40));
    setShow({ amount, phase: 'pop', target });
    window.setTimeout(() => setShow((s) => (s ? { ...s, phase: 'fly' } : s)), 1300);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('clap:tickets', { detail: amount }));
      projector.coins(3);
    }, 1950);
    window.setTimeout(() => {
      setShow(null);
      setBusy(false);
      projector.dispose();
      router.refresh();
    }, 2700);
  };

  return (
    <>
      <form action={claimAction} onSubmit={claim}>
        <input type="hidden" name="mission" value={missionId} />
        <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>Récupérer</button>
      </form>
      {show && createPortal(
        <div className={`${styles.overlay} ${show.phase === 'fly' ? styles.flying : ''}`} role="status" aria-live="assertive">
          <span className={styles.dim} />
          <span className={styles.rays} aria-hidden="true" />
          <div
            className={styles.ticket}
            style={{ '--tx': `${show.target.x}px`, '--ty': `${show.target.y}px` } as CSSProperties}
          >
            <span className={styles.label}>Récompense de mission</span>
            <strong className="display">+{formatNumber(show.amount)}</strong>
            <span className={styles.unit}><TicketIcon size={22} color="var(--ink)" /> TICKETS</span>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
