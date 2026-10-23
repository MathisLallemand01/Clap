import Link from 'next/link';
import type { TickerItem } from '@/lib/ticker';
import { SeatIcon } from './Icons';
import styles from './Ticker.module.css';

type Variant = 'live' | 'market' | 'news';

const LABELS: Record<Variant, string> = { live: 'EN DIRECT', market: 'GUICHET', news: 'À l’affiche' };

/** Le bandeau d'infos qui défile sous la navigation. S'arrête au survol ; chaque élément mène à sa fiche. */
export function Ticker({ items, variant = 'live' }: { items: TickerItem[]; variant?: Variant }) {
  if (!items.length) return null;
  // Deux copies côte à côte pour une boucle sans à-coup ; la seconde est ignorée des lecteurs d'écran.
  const speed = Math.max(30, items.length * 6);
  const row = (copy: number) => items.map((it) => {
    const body = (
      <>
        {variant === 'news' ? (
          <svg className={styles.star} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.6L21 9.3l-5 4.6 1.4 6.8L12 17.3 6.6 20.7 8 13.9 3 9.3l6.4-.7z" /></svg>
        ) : (
          <span className={it.shape === 'diamond' ? styles.diamond : styles.dot} style={{ background: it.color, color: it.color }} />
        )}
        {it.who && <span className={styles.who}>{it.who}</span>}
        <span className={styles.text}>{it.text}</span>
        {it.value && variant === 'live' && <><SeatIcon size={15} color="var(--gold)" /><span className={styles.value}>{it.value}</span></>}
        {it.value && variant === 'market' && <span className={styles.price}>{it.value}</span>}
        {it.delta && <span className={`${styles.delta} ${styles[it.delta.tone]}`}>{it.delta.text}</span>}
      </>
    );
    const key = `${copy}-${it.key}`;
    const hidden = copy === 1 ? { 'aria-hidden': true, tabIndex: -1 } : {};
    return it.href
      ? <Link key={key} href={it.href} className={styles.item} {...hidden}>{body}</Link>
      : <span key={key} className={styles.item} {...(copy === 1 ? { 'aria-hidden': true } : {})}>{body}</span>;
  });
  return (
    <div className={`${styles.ticker} ${styles[variant]}`} role="region" aria-label={variant === 'live' ? 'Derniers grands tirages' : variant === 'market' ? 'Dernières ventes du Guichet' : 'À l’affiche'}>
      <span className={styles.label}>
        {variant === 'live' && <span className={styles.pulse} />}
        {LABELS[variant]}
      </span>
      <div className={styles.viewport}>
        <div className={styles.track} style={{ animationDuration: `${speed}s` }}>
          {row(0)}
          {row(1)}
        </div>
      </div>
    </div>
  );
}
