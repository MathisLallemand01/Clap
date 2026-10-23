'use client';

import { useState } from 'react';
import { TicketIcon } from '@/components/Icons';
import { sellAction } from './actions';
import styles from './guichet.module.css';

type Props = { cardId: string; min: number; max: number; suggested: number; fee: number; days: readonly number[] };

export function SellForm({ cardId, min, max, suggested, fee, days }: Props) {
  const [price, setPrice] = useState(suggested);
  const [duration, setDuration] = useState(days[days.length - 1]);
  const valid = Number.isInteger(price) && price >= min && price <= max;
  const cut = Math.ceil(price * fee);
  const diff = Math.round((price / suggested - 1) * 100);

  return (
    <form action={sellAction} className={styles.sellForm}>
      <input type="hidden" name="card" value={cardId} />
      <input type="hidden" name="days" value={duration} />
      <label className="field">Votre prix
        <span className={styles.priceBox}>
          <TicketIcon size={26} />
          <input type="number" name="price" min={min} max={max} step={1} value={Number.isNaN(price) ? '' : price} onChange={(e) => setPrice(Number(e.target.value))} required />
          <span className="mono" style={{ fontSize: 13, color: diff > 5 ? '#ff9a6c' : diff < 0 ? 'var(--ok)' : 'var(--muted)' }}>{diff > 0 ? '+' : ''}{diff} %</span>
        </span>
      </label>
      <div className={styles.range}>
        <input type="range" min={min} max={max} value={valid ? price : suggested} onChange={(e) => setPrice(Number(e.target.value))} aria-label="Prix" />
        <div className={styles.rangeLabels}><span>MIN {min}</span><button type="button" onClick={() => setPrice(suggested)}>CONSEILLÉ {suggested}</button><span>MAX {max}</span></div>
      </div>
      <div className={styles.sum}>
        <div><span className="eyebrow">Prix</span><strong>{valid ? price : '—'}</strong></div>
        <div><span className="eyebrow">Commission {Math.round(fee * 100)} %</span><strong className="muted">−{valid ? cut : '—'}</strong></div>
        <div><span className="eyebrow">Vous recevez</span><strong style={{ color: 'var(--ok)' }}>{valid ? price - cut : '—'}</strong></div>
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
