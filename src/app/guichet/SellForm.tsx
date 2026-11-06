'use client';

import { useState } from 'react';
import { SeatIcon } from '@/components/Icons';
import { sellAction } from './actions';
import styles from './guichet.module.css';

type Props = { cardId: string; min: number; max: number; suggested: number; fee: number; days: readonly number[]; cote?: number | null };

export function SellForm({ cardId, min, max, suggested, fee, days, cote = null }: Props) {
  const [price, setPrice] = useState(cote ? Math.min(max, Math.max(min, cote)) : suggested);
  const [duration, setDuration] = useState(days[days.length - 1]);
  const valid = Number.isInteger(price) && price >= min && price <= max;
  const cut = Math.ceil(price * fee);
  const ref = cote ?? suggested;
  const diff = Math.round((price / ref - 1) * 100);

  return (
    <form action={sellAction} className={styles.sellForm}>
      <input type="hidden" name="card" value={cardId} />
      <input type="hidden" name="days" value={duration} />
      <label className="field">Votre prix
        <span className={styles.priceBox}>
          <SeatIcon size={26} />
          <input type="number" name="price" min={min} max={max} step={1} value={Number.isNaN(price) ? '' : price} onChange={(e) => setPrice(Number(e.target.value))} required />
          <span className="mono" style={{ fontSize: 13, color: diff > 5 ? '#ff9a6c' : diff < 0 ? 'var(--ok)' : 'var(--muted)' }}>{diff > 0 ? '+' : ''}{diff} %</span>
        </span>
      </label>
      <div className={styles.range}>
        <input type="range" min={min} max={max} value={valid ? price : suggested} onChange={(e) => setPrice(Number(e.target.value))} aria-label="Prix" />
        <div className={styles.rangeLabels}><span>MIN {min}</span><button type="button" onClick={() => setPrice(Math.min(max, Math.max(min, ref)))}>{cote ? `COTE ${cote}` : `CONSEILLÉ ${suggested}`}</button><span>MAX {max}</span></div>
      </div>
      {cote && <p className="mono" style={{ margin: 0, fontSize: 12, color: diff <= 5 ? 'var(--ok)' : '#ff9a6c' }}>{diff < 0 ? `${-diff} % SOUS LA COTE : ÇA PART VITE` : diff <= 5 ? 'AU NIVEAU DE LA COTE' : `${diff} % AU-DESSUS DE LA COTE`}</p>}
      <div className={styles.sum}>
        <div><span className="eyebrow">Prix</span><strong>{valid ? price : '—'}</strong></div>
        <div><span className="eyebrow">Commission {Math.round(fee * 100)} %</span><strong className="muted">−{valid ? cut : '—'}</strong></div>
        <div><span className="eyebrow">Vous recevez (sièges)</span><strong style={{ color: 'var(--ok)' }}>{valid ? price - cut : '—'}</strong></div>
      </div>
      <div className={styles.sellFoot}>
        <div className="segmented" role="radiogroup" aria-label="Durée de l’annonce">
          {days.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={d === duration} aria-selected={d === duration} onClick={() => setDuration(d)}>{d} jour{d > 1 ? 's' : ''}</button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={!valid}>Mettre en vente</button>
      </div>
    </form>
  );
}
