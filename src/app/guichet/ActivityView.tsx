import Link from 'next/link';
import { AuctionClock } from '@/components/AuctionClock';
import { GameCard } from '@/components/GameCard';
import { ACTIVITY_FILTERS, activityOf, liveActivity, summarize, type ActivityEntry, type ActivityType } from '@/lib/activity';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { playerListings } from '@/lib/market';
import { periodStart } from '@/lib/missions';
import type { Context } from '@/lib/session';
import styles from './activity.module.css';

const DAY = 24 * 3600 * 1000;
const ICONS: Record<ActivityType, string> = {
  vente: 'M12 19V5M5 12l7-7 7 7',
  achat: 'M12 5v14M19 12l-7 7-7-7',
  enchere: 'm14 4 6 6M4 20l9-9M12 3l9 9-3 3-9-9z',
  echange: 'M4 8h14l-3-3M20 16H6l3 3',
  cadeau: 'M3 8h18v13H3zM12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1',
  expire: 'M6 6l12 12M18 6 6 18',
};
const COLORS: Record<ActivityType, string> = { vente: 'var(--ok)', achat: '#4C8DFF', enchere: '#FFC83D', echange: '#B57BFF', cadeau: 'var(--icon)', expire: 'var(--faint)' };
const time = (t: number) => `TC ${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(t)}`;
const dayName = (t: number) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(t).toUpperCase();

/** Le journal de tournage : bilan du mois, ce qui tourne encore, puis l'historique jour par jour. */
export function ActivityView({ ctx, type }: { ctx: Context; type?: string }) {
  const db = getDb();
  const now = Date.now();
  const filter = (ACTIVITY_FILTERS.some((f) => f.id === type) ? type : 'tout') as ActivityType | 'tout';
  const all = activityOf(db, ctx.user.id, ctx.player.id, now);
  const sum = summarize(all, now);
  const entries = all.filter((e) => filter === 'tout' || e.type === filter || (filter === 'vente' && e.type === 'expire')).slice(0, 120);
  const live = liveActivity(db, ctx.player.id, now);
  const listings = playerListings(db, ctx.player.id).filter((l) => l.status === 'open');
  const today = periodStart('daily', now).start;
  const signup = periodStart('daily', ctx.user.createdAt).start;
  const groups = new Map<number, ActivityEntry[]>();
  for (const e of entries) {
    const d = periodStart('daily', e.at).start;
    groups.set(d, [...(groups.get(d) ?? []), e]);
  }

  return (
    <div className={styles.wrap}>
      <nav className={styles.filters} aria-label="Filtrer le journal">
        {ACTIVITY_FILTERS.map((f) => (
          <Link key={f.id} href={f.id === 'tout' ? '/guichet?vue=activite' : `/guichet?vue=activite&type=${f.id}`} scroll={false} className="chip" aria-current={filter === f.id ? 'true' : undefined}>
            {f.label}{f.id === 'enchere' && live.bids.length > 0 && <small>{live.bids.length}</small>}
          </Link>
        ))}
      </nav>

      <div className={styles.sum}>
        <div><span className="eyebrow">Recettes · 30 j</span><b className={styles.plus}>+{formatNumber(sum.income)}</b><small>sièges · {sum.incomeCount} vente{sum.incomeCount > 1 ? 's' : ''}</small></div>
        <div><span className="eyebrow">Dépenses · 30 j</span><b className={styles.minus}>−{formatNumber(sum.spent)}</b><small>sièges · {sum.spentCount} achat{sum.spentCount > 1 ? 's' : ''} et enchère{sum.spentCount > 1 ? 's' : ''}</small></div>
        <div><span className="eyebrow">Bilan</span><b>{sum.income - sum.spent >= 0 ? '+' : '−'}{formatNumber(Math.abs(sum.income - sum.spent))}</b><small>sièges gagnés au Guichet</small></div>
        <div><span className="eyebrow">Échanges et cadeaux</span><b>{sum.trades}</b><small>conclus ces 30 jours</small></div>
      </div>

      {(live.bids.length > 0 || live.lots.length > 0 || listings.length > 0) && (
        <section className={styles.section}>
          <div className="section-head"><h2 className="display h3">En cours de tournage</h2><span className="rule" /><span className="eyebrow" style={{ color: 'var(--accent)' }}>● En direct</span></div>
          <ul className={styles.live}>
            {live.bids.map((a) => (
              <li key={`b${a.id}`} className={a.leading ? styles.lead : styles.out}>
                <GameCard card={a.card} width={64} serial={a.serial} />
                <div className={styles.liveText}><span className={`${styles.st} ${a.leading ? styles.stOk : styles.stBad}`}>{a.leading ? 'VOUS MENEZ' : 'DÉPASSÉ'}</span><b>Lot {String(a.id).padStart(3, '0')} · {a.card.character ?? `${a.card.first} ${a.card.last}`}</b>
                  <span className="mono muted">{formatNumber(a.currentBid ?? a.startPrice)}{a.leading && a.myMax ? ` · auto jusqu’à ${formatNumber(a.myMax)}` : ''} · <AuctionClock endsAt={a.endsAt} /></span></div>
                {!a.leading && <Link href={`/guichet?vue=encheres&lot=${a.id}`} className="btn btn-sm btn-primary">Relancer</Link>}
              </li>
            ))}
            {live.lots.map((a) => (
              <li key={`l${a.id}`}>
                <GameCard card={a.card} width={64} serial={a.serial} />
                <div className={styles.liveText}><span className={styles.st}>AUX ENCHÈRES</span><b>Lot {String(a.id).padStart(3, '0')} · {formatNumber(a.currentBid ?? a.startPrice)}</b>
                  <span className="mono muted">{a.bids} offre{a.bids > 1 ? 's' : ''} · <AuctionClock endsAt={a.endsAt} /></span></div>
                <Link href={`/guichet?vue=encheres&lot=${a.id}`} className="btn btn-sm">Voir</Link>
              </li>
            ))}
            {listings.map((l) => (
              <li key={`f${l.id}`}>
                <GameCard card={l.card} width={64} serial={l.serial} />
                <div className={styles.liveText}><span className={styles.st}>EN VENTE</span><b>{l.card.character ?? `${l.card.first} ${l.card.last}`} · {formatNumber(l.price)}</b>
                  <span className="mono muted">conseillé {formatNumber(l.suggested)} · <AuctionClock endsAt={l.expiresAt} /></span></div>
                <Link href="/guichet?vue=mes-annonces" className="btn btn-sm">Gérer</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`panel ${styles.journal}`}>
        {entries.length === 0 && <p className="muted" style={{ margin: 0, padding: '18px 0' }}>Rien au journal pour l’instant. Vendez, achetez, enchérissez ou échangez : tout s’inscrira ici.</p>}
        {[...groups].map(([day, list]) => (
          <div key={day}>
            <div className={styles.day}>
              <span className={styles.slate}><span aria-hidden="true" /><span>JOUR {Math.max(1, Math.round((day - signup) / DAY) + 1)}</span><span>{day === today ? `AUJOURD’HUI · ${dayName(day + DAY / 2)}` : dayName(day + DAY / 2)}</span></span>
              <span className={styles.line} />
            </div>
            {list.map((e, i) => (
              <div key={i} className={styles.ev}>
                <span className="mono muted">{time(e.at)}</span>
                <span className={styles.ic} style={{ color: COLORS[e.type] }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[e.type]} /></svg></span>
                {e.card ? <GameCard card={e.card} width={46} serial={e.card.serial} /> : <span />}
                <div className={styles.evText}><b>{e.title}</b><span>{e.sub}</span></div>
                <span className={`${styles.amt} ${e.seats !== null ? (e.seats > 0 ? styles.plus : styles.minus) : ''}`}>{e.seats !== null ? `${e.seats > 0 ? '+' : '−'}${formatNumber(Math.abs(e.seats))}` : e.label}</span>
                {e.href ? <Link href={e.href} className="btn btn-sm">Détail</Link> : <span />}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
