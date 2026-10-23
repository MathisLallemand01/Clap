'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { GameCard } from '@/components/GameCard';
import { TicketIcon } from '@/components/Icons';
import { formatNumber } from '@/lib/format';
import { RARITIES } from '@/lib/rarity';
import { createProjector, soundPreference } from '@/lib/sound';
import { createThemePlayer, loadTheme, type ThemeInfo } from '@/lib/themePlayer';
import { themeFor } from '@/lib/themes';
import type { Card } from '@/lib/types';
import styles from './Celebrate.module.css';

export type CelebrateProps = {
  eyebrow: string;
  title: string;
  sub: string;
  cards: (Card & { serial?: number })[];
  /** Tampon posé en travers de la première carte (« Vendu ! », « Cadeau ! »…). */
  stamp?: string | null;
  /** Tickets gagnés (positif) ou dépensés (négatif). */
  tickets?: number;
  lines?: string[];
  link?: { href: string; label: string };
  closeLabel?: string;
  onClose: () => void;
};

/**
 * La grande annonce d'une bonne nouvelle : la salle s'assombrit, la ou les cartes arrivent au centre
 * sous leurs rayons, un tampon les marque, puis le bilan en tickets. Achat, vente, échange, cadeau.
 */
export function Celebrate({ eyebrow, title, sub, cards, stamp, tickets = 0, lines = [], link, closeLabel = 'Continuer', onClose }: CelebrateProps) {
  const [mounted, setMounted] = useState(false);
  const [music, setMusic] = useState<ThemeInfo | null>(null);
  const themed = cards.find((c) => themeFor(c))?.id ?? null;
  const top = cards.reduce<Card | null>((best, c) => (!best || RARITIES[c.rarity].tier > RARITIES[best.rarity].tier ? c : best), null);
  const rarity = top ? RARITIES[top.rarity] : null;
  const shown = cards.slice(0, 5);
  const width = shown.length > 3 ? 150 : shown.length > 1 ? 180 : 230;

  useEffect(() => {
    setMounted(true);
    const p = createProjector(soundPreference());
    const t1 = window.setTimeout(() => p.coins(tickets > 0 ? 6 : 3), 150);
    const t2 = window.setTimeout(() => rarity && p.sting(rarity.tier >= 5 ? 3 : rarity.tier >= 4 ? 2 : 1), 700);
    const t3 = window.setTimeout(() => p.dispose(), 3000);
    return () => { [t1, t2, t3].forEach(window.clearTimeout); p.dispose(); };
  }, [rarity, tickets]);

  // Une carte reçue est le Rôle principal d'un film à musique culte : sa musique accompagne l'annonce.
  useEffect(() => {
    if (!themed || !soundPreference()) return;
    const player = createThemePlayer(setMusic);
    let alive = true;
    void loadTheme(themed).then((t) => { if (alive && t) window.setTimeout(() => alive && player.play(t), 900); });
    return () => { alive = false; player.dispose(); };
  }, [themed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="celebrate-title" style={{ '--rc': rarity?.color ?? 'var(--accent)' } as CSSProperties} onClick={onClose}>
      <span className={styles.rays} aria-hidden="true" />
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        {shown.length > 0 && (
          <div className={styles.cards} style={{ '--n': shown.length } as CSSProperties}>
            {shown.map((c, i) => (
              <div key={`${c.id}-${i}`} className={styles.card} style={{ '--i': i - (shown.length - 1) / 2, animationDelay: `${i * 90}ms` } as CSSProperties}>
                <GameCard card={c} width={width} serial={c.serial} eager live={i === 0} />
              </div>
            ))}
            {stamp && <span className={styles.stamp} aria-hidden="true">{stamp}</span>}
          </div>
        )}
        {cards.length > shown.length && <span className={styles.more}>+{cards.length - shown.length} autres cartes</span>}
        <h2 id="celebrate-title" className={`display ${styles.title}`}>{title}</h2>
        {music && <p className={styles.music}><span aria-hidden="true">♪</span> {music.song} · {music.artist}</p>}
        <p className={styles.sub}>{sub}{rarity && cards.length === 1 && <> · <span style={{ color: 'var(--rc)' }}>{rarity.label}</span></>}</p>
        {(tickets !== 0 || lines.length > 0) && (
          <div className={styles.receipt}>
            {tickets !== 0 && <span className={tickets > 0 ? styles.gain : styles.spend}><TicketIcon size={16} /> {tickets > 0 ? '+' : '−'}{formatNumber(Math.abs(tickets))} TK</span>}
            {lines.map((l) => <span key={l}>{l}</span>)}
          </div>
        )}
        <div className={styles.actions}>
          {link && <Link href={link.href} className="btn" onClick={onClose}>{link.label}</Link>}
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>{closeLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
