'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { GameCard } from '@/components/GameCard';
import { TicketIcon } from '@/components/Icons';
import { formatNumber } from '@/lib/format';
import { RARITIES } from '@/lib/rarity';
import { createProjector, soundPreference } from '@/lib/sound';
import type { Card } from '@/lib/types';
import styles from './Purchase.module.css';

/**
 * Achat réussi au Guichet : la salle s'assombrit, la carte arrive au centre sous ses rayons,
 * un tampon « VENDU » la marque et le prix payé s'affiche avec le nouveau solde.
 */
export function Purchase({ card, serial, price, balance, unlimited }: { card: Card; serial: number; price: number; balance: number; unlimited: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const rarity = RARITIES[card.rarity];

  useEffect(() => {
    setMounted(true);
    const p = createProjector(soundPreference());
    const t1 = window.setTimeout(() => p.coins(4), 150);
    const t2 = window.setTimeout(() => p.sting(rarity.tier >= 5 ? 3 : rarity.tier >= 4 ? 2 : 1), 700);
    const t3 = window.setTimeout(() => p.dispose(), 3000);
    return () => { [t1, t2, t3].forEach(window.clearTimeout); p.dispose(); };
  }, [rarity.tier]);

  const close = () => {
    setOpen(false);
    router.replace('/guichet', { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open || !mounted) return null;
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="achat-titre" style={{ '--rc': rarity.color } as CSSProperties} onClick={close}>
      <span className={styles.rays} aria-hidden="true" />
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <p className={styles.eyebrow}>✓ Achat réussi</p>
        <div className={styles.card}>
          <GameCard card={card} width={230} serial={serial} eager live />
          <span className={styles.stamp} aria-hidden="true">Vendu !</span>
        </div>
        <h2 id="achat-titre" className={`display ${styles.title}`}>{card.character ?? `${card.first} ${card.last}`}</h2>
        <p className={styles.sub}>rejoint votre collection{card.kind === 'role' ? ` · ${card.first} ${card.last}` : ''} · <span style={{ color: 'var(--rc)' }}>{rarity.label}</span></p>
        <div className={styles.receipt}>
          <span><TicketIcon size={16} /> −{formatNumber(price)} TK</span>
          <span>Solde : <b>{unlimited ? '∞' : formatNumber(balance)} TK</b></span>
        </div>
        <div className={styles.actions}>
          <Link href={`/collection`} className="btn">Voir ma collection</Link>
          <button type="button" className="btn btn-primary" onClick={close} autoFocus>Continuer mes achats</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
