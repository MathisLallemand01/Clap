import Link from 'next/link';
import { coteOf, MIN_SALES_FOR_COTE } from '@/lib/cote';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { suggestedSeats } from '@/lib/rarity';
import type { Card } from '@/lib/types';
import styles from './CoteBlock.module.css';

const MONTHS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];
const dayLabel = (key: string) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const when = (t: number) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(t).toUpperCase();

/**
 * La cote d'une carte sur sa fiche : médianes, fourchette, « la bobine des prix » (une image de pellicule par jour,
 * la ligne pointillée de la cote, l'image dorée du record), et les dernières ventes.
 */
export function CoteBlock({ card, span = 30, watched, openCount }: { card: Card; span?: 7 | 30 | 90; watched: boolean; openCount: number }) {
  const db = getDb();
  const c = coteOf(db, card.id, span);
  const values = c.days.map((d) => d.median).filter((v): v is number => v !== null);
  const lo = values.length ? Math.min(...values) * 0.7 : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const scale = (v: number) => Math.max(4, ((v - lo) / Math.max(1, hi - lo)) * 100);
  const record = values.length ? Math.max(...values) : null;
  const ref = c.cote ?? c.median30;
  const base = `/${card.kind === 'role' ? 'role' : 'acteur'}/${card.kind === 'role' ? encodeURIComponent(card.id) : card.personId}`;
  const ticks = [0, Math.floor(span / 4), Math.floor(span / 2), Math.floor((3 * span) / 4)].map((i) => c.days[i]?.day).filter(Boolean) as string[];

  return (
    <section className={styles.wrap} aria-labelledby="cote">
      <div className="section-head"><h2 id="cote" className="display h2">La cote</h2><span className="rule" /><span className="eyebrow">Médiane des ventes au Guichet</span></div>
      <div className={styles.kpis}>
        <div><span className="eyebrow">Cote · médiane 7 j</span><b>{c.median7 !== null ? formatNumber(c.median7) : '—'}</b>
          <small className={c.trend !== null && c.trend > 0 ? styles.up : c.trend !== null && c.trend < 0 ? styles.down : ''}>{c.trend !== null ? `${c.trend > 0 ? '▲ +' : c.trend < 0 ? '▼ ' : '= '}${c.trend} % vs 30 j` : 'pas de vente cette semaine'}</small></div>
        <div><span className="eyebrow">Médiane 30 j</span><b>{c.cote !== null ? formatNumber(c.cote) : '—'}</b><small>{c.cote !== null ? `sur ${c.count30} ventes` : `pas encore cotée (${c.count30}/${MIN_SALES_FOR_COTE} ventes)`}</small></div>
        <div><span className="eyebrow">Fourchette {span} j</span><b className={styles.small}>{c.low !== null ? `${formatNumber(c.low)} – ${formatNumber(c.high!)}` : '—'}</b><small>plus bas · plus haut</small></div>
        <div><span className="eyebrow">En vente maintenant</span><b>{openCount}</b><small>{openCount ? <Link href={`/guichet?q=${encodeURIComponent(card.character ?? `${card.first} ${card.last}`)}`} className="accent">voir au Guichet</Link> : `conseillé : ${formatNumber(suggestedSeats(card.rarity))} sièges`}</small></div>
      </div>

      <div className={styles.strip} aria-label={`Prix médian par jour sur ${span} jours`}>
        <div className={styles.stripHead}>
          <span className="eyebrow" style={{ color: 'var(--text)' }}>La bobine des prix · 1 image = 1 jour</span>
          <span className="segmented" role="tablist" aria-label="Période">
            {([7, 30, 90] as const).map((s) => <Link key={s} href={`${base}?cote=${s}#cote`} scroll={false} role="tab" aria-selected={s === span}>{s} j</Link>)}
          </span>
        </div>
        <span className={styles.perf} aria-hidden="true" />
        <div className={styles.frames} style={{ gridTemplateColumns: `repeat(${c.days.length}, 1fr)` }}>
          {c.days.map((d) => (
            <span key={d.day} className={`${styles.frame} ${d.median === null ? styles.empty : ''}`} title={d.median === null ? `${dayLabel(d.day)} : aucune vente` : `${dayLabel(d.day)} : ${d.median} sièges (${d.count} vente${d.count > 1 ? 's' : ''})`}>
              {d.median !== null && <i style={{ height: `${scale(d.median)}%` }} className={d.median === record ? styles.record : ''} />}
            </span>
          ))}
          {ref !== null && values.length > 0 && <span className={styles.med} style={{ bottom: `calc(${scale(ref)}% * 0.97 + 4px)` }}><span>COTE {formatNumber(ref)}</span></span>}
          {values.length === 0 && <span className={styles.none}>Aucune vente sur la période : la bobine est vierge.</span>}
        </div>
        <span className={styles.perf} aria-hidden="true" />
        <div className={styles.axis}>{ticks.map((t) => <span key={t}>{dayLabel(t)}</span>)}<span>AUJOURD’HUI</span></div>
      </div>
      <p className={styles.note}><b>La cote, c’est la médiane</b> : la moitié des ventes s’est faite au-dessus, l’autre en dessous. Une vente folle ne la fait pas bouger. Image vide : aucune vente ce jour-là ; image dorée : le record de la période. Moins de {MIN_SALES_FOR_COTE} ventes en 30 jours : la carte n’est pas encore cotée.</p>

      <div className={styles.bottom}>
        <div className={styles.sales}>
          <h3 className="display h3">Dernières ventes</h3>
          {c.recent.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucune vente pour l’instant.</p> : c.recent.map((s, i) => (
            <div key={i}><span className="mono muted">{when(s.at)}</span><span className={`${styles.tag} ${s.kind === 'enchere' ? styles.tagHot : ''}`}>{s.kind === 'enchere' ? 'ENCHÈRE' : 'PRIX FIXE'}</span><b className="mono">{formatNumber(s.price)}</b></div>
          ))}
        </div>
        <div className={styles.watch}>
          <h3 className="display h3">Guetter cette carte</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>La Régie vous envoie un télégramme dès qu’elle arrive au Guichet, selon votre condition (en vente, sous un prix, sous sa cote, aux enchères).</p>
          <Link href={`/regie?guetter=${encodeURIComponent(card.id)}`} className={`btn ${watched ? '' : 'btn-light'}`}>{watched ? '★ Guettée · modifier l’alerte' : '☆ Guetter cette carte'}</Link>
        </div>
      </div>
    </section>
  );
}
