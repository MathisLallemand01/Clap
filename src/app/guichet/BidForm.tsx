'use client';

import { useState } from 'react';
import { bidAction } from './actions';
import styles from './auctions.module.css';

type Props = { lot: number; minNext: number; buyout: number | null; balance: number; unlimited: boolean; leading: boolean; myMax: number | null };

/** Enchérir : une offre (au moins le palier suivant), et en option un plafond secret pour l'enchère automatique. */
export function BidForm({ lot, minNext, buyout, balance, unlimited, leading, myMax }: Props) {
  const [amount, setAmount] = useState(leading ? Math.max(minNext, (myMax ?? 0) + 1) : minNext);
  const [auto, setAuto] = useState(leading);
  const [max, setMax] = useState(Math.round((leading ? Math.max(minNext, (myMax ?? 0) + 1) : minNext) * 1.5));
  const engaged = auto ? Math.max(amount, max) : amount;
  const enough = unlimited || balance >= engaged;
  const valid = Number.isInteger(amount) && amount >= (leading ? 1 : minNext) && (!auto || max >= amount);

  return (
    <div className={styles.bidWrap}>
      <form action={bidAction} className={styles.bidForm}>
        <input type="hidden" name="lot" value={lot} />
        <div className={styles.bidRow}>
          <label className={styles.field}>
            <span className="eyebrow">{leading ? 'Vous menez · relever votre plafond' : `Votre enchère · minimum ${minNext} (+5 %)`}</span>
            <input name="amount" type="number" inputMode="numeric" min={leading ? 1 : minNext} step={1} value={Number.isNaN(amount) ? '' : amount} onChange={(e) => setAmount(Number(e.target.value))} required />
          </label>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!valid || !enough}>{leading ? 'Relever' : 'Enchérir'} · {engaged} sièges</button>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" name="auto" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <span className={styles.sw} aria-hidden="true" />
          <span className={styles.toggleText}><b>Enchère automatique</b><span>Clap surenchérit pour vous, par paliers de 5 %, jusqu’à un plafond secret.</span></span>
          {auto && (
            <span className={styles.maxBox}>plafond
              <input name="max" type="number" inputMode="numeric" min={amount} step={1} value={Number.isNaN(max) ? '' : max} onChange={(e) => setMax(Number(e.target.value))} aria-label="Plafond de l’enchère automatique" />
            </span>
          )}
        </label>
        <p className={styles.hint}>{enough ? `${engaged} sièges seront mis de côté ; dépassé, ils vous reviennent aussitôt. Gagnant, vous ne payez que l’enchère atteinte.` : `Il vous faut ${engaged} sièges (vous en avez ${balance}).`}</p>
      </form>
      {buyout !== null && (
        <form action={bidAction}>
          <input type="hidden" name="lot" value={lot} />
          <input type="hidden" name="amount" value={buyout} />
          <input type="hidden" name="buyout" value={buyout} />
          <button type="submit" className="btn" disabled={!unlimited && balance < buyout}>Adjuger maintenant · {buyout} sièges</button>
        </form>
      )}
    </div>
  );
}
