'use client';

import { useState } from 'react';
import { SeatIcon } from '@/components/Icons';
import { auctionAction } from './actions';
import styles from './guichet.module.css';

type Props = { cardId: string; min: number; max: number; suggested: number; cote: number | null; hours: readonly number[] };
const LABEL: Record<number, string> = { 1: '1 h', 6: '6 h', 24: '24 h', 72: '3 jours' };

/** Mettre une carte aux enchères : mise à prix, prix d'achat immédiat (facultatif), durée. */
export function AuctionSellForm({ cardId, min, max, suggested, cote, hours }: Props) {
  const [start, setStart] = useState(Math.max(min, Math.round((cote ?? suggested) * 0.6)));
  const [buyout, setBuyout] = useState(0);
  const [h, setH] = useState(24);
  const validStart = Number.isInteger(start) && start >= min && start <= max;
  const validBuyout = buyout === 0 || (Number.isInteger(buyout) && buyout > start && buyout <= max * 2);
  return (
    <form action={auctionAction} className={styles.sellForm}>
      <input type="hidden" name="card" value={cardId} />
      <input type="hidden" name="hours" value={h} />
      <label className="field">Mise à prix
        <span className={styles.priceBox}>
          <SeatIcon size={26} />
          <input type="number" name="start" min={min} max={max} step={1} value={Number.isNaN(start) ? '' : start} onChange={(e) => setStart(Number(e.target.value))} required />
          <span className="mono muted" style={{ fontSize: 13 }}>{cote ? `cote ${cote}` : `conseillé ${suggested}`}</span>
        </span>
      </label>
      <label className="field">Achat immédiat <span className="muted" style={{ fontWeight: 400 }}>(facultatif : 0 = aucun)</span>
        <span className={styles.priceBox} style={{ borderColor: 'var(--line-2)' }}>
          <SeatIcon size={26} />
          <input type="number" name="buyout" min={0} max={max * 2} step={1} value={Number.isNaN(buyout) ? '' : buyout} onChange={(e) => setBuyout(Number(e.target.value))} />
          <span className="mono muted" style={{ fontSize: 13 }}>au-delà de la mise à prix</span>
        </span>
      </label>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Mise à prix entre {min} et {max} sièges. 5 % de commission sur le prix d’adjudication. Une fois une enchère posée, le lot ne peut plus être retiré. Les joueurs qui guettent cette carte reçoivent un télégramme.</p>
      <div className={styles.sellFoot}>
        <div className="segmented" role="radiogroup" aria-label="Durée de l’enchère">
          {hours.map((x) => <button key={x} type="button" role="radio" aria-checked={x === h} aria-selected={x === h} onClick={() => setH(x)}>{LABEL[x] ?? `${x} h`}</button>)}
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={!validStart || !validBuyout}>Mettre aux enchères</button>
      </div>
    </form>
  );
}
