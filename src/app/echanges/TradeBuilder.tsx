'use client';

import { useMemo, useState } from 'react';
import { GameCard } from '@/components/GameCard';
import { TicketIcon } from '@/components/Icons';
import { formatNumber } from '@/lib/format';
import type { Card } from '@/lib/types';
import { giftAction, proposeAction } from './actions';
import styles from './echanges.module.css';

type Item = Card & { value: number; copies: number };
type Props = {
  friendId: string; friendName: string; mine: Item[]; theirs: Item[]; myTickets: number;
  /** Date (lisible) à partir de laquelle le compte pourra offrir ; null s'il le peut déjà. */
  giftLockedUntil: string | null;
};

function Picker({ title, who, items, name, picked, toggle, query, setQuery }: {
  title: string; who: string; items: Item[]; name: string; picked: Set<string>; toggle: (id: string) => void; query: string; setQuery: (q: string) => void;
}) {
  const q = query.toLowerCase();
  const shown = items.filter((c) => !q || `${c.first} ${c.last} ${c.film ?? ''} ${c.character ?? ''}`.toLowerCase().includes(q)).slice(0, 60);
  return (
    <div className={styles.side}>
      <div className={styles.sideHead}>
        <h3 className="display h3">{title}</h3>
        <span className="eyebrow">{who}</span>
      </div>
      <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer…" aria-label={`Filtrer : ${title}`} />
      <ul className={styles.pickGrid}>
        {shown.map((c) => {
          const on = picked.has(c.id);
          return (
            <li key={c.id}>
              <label className={`${styles.pick} ${on ? styles.picked : ''}`}>
                <input type="checkbox" name={name} value={c.id} checked={on} onChange={() => toggle(c.id)} className="visually-hidden" />
                <GameCard card={c} width={120} />
                <span className={styles.pickValue}><TicketIcon size={14} />{formatNumber(c.value)}{c.copies > 1 ? <em>×{c.copies}</em> : null}</span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 && <li className="muted" style={{ gridColumn: '1 / -1', fontSize: 14 }}>Aucune carte.</li>}
      </ul>
    </div>
  );
}

export function TradeBuilder({ friendId, friendName, mine, theirs, myTickets, giftLockedUntil }: Props) {
  const [mode, setMode] = useState<'trade' | 'gift'>('trade');
  const gift = mode === 'gift';
  const [give, setGive] = useState<Set<string>>(new Set());
  const [take, setTake] = useState<Set<string>>(new Set());
  const [giveTickets, setGiveTickets] = useState(0);
  const [takeTickets, setTakeTickets] = useState(0);
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const toggle = (set: Set<string>, update: (s: Set<string>) => void) => (id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };
  const values = useMemo(() => {
    const sum = (items: Item[], ids: Set<string>) => items.filter((c) => ids.has(c.id)).reduce((s, c) => s + c.value, 0);
    return { give: sum(mine, give) + (giveTickets || 0), take: sum(theirs, take) + (takeTickets || 0) };
  }, [mine, theirs, give, take, giveTickets, takeTickets]);
  const total = values.give + values.take;
  const gap = total ? Math.abs(values.give - values.take) / Math.max(values.give, values.take) : 0;
  const verdict = !total ? 'CHOISISSEZ DES CARTES' : gap <= 0.15 ? `ÉQUILIBRÉ · ÉCART ${Math.round(gap * 100)} %` : values.give > values.take ? `À SON AVANTAGE · +${formatNumber(values.give - values.take)}` : `À VOTRE AVANTAGE · +${formatNumber(values.take - values.give)}`;

  return (
    <form action={gift ? giftAction : proposeAction} className={styles.builder}>
      <input type="hidden" name="to" value={friendId} />
      <div className={styles.modeRow}>
        <div className="segmented" role="tablist" aria-label="Type d’envoi">
          <button type="button" role="tab" aria-selected={!gift} aria-current={!gift ? 'true' : undefined} onClick={() => setMode('trade')}>⇄ Échanger</button>
          <button type="button" role="tab" aria-selected={gift} aria-current={gift ? 'true' : undefined} onClick={() => setMode('gift')}>🎁 Offrir</button>
        </div>
        {gift && <span className={styles.modeHint}>{giftLockedUntil ? `Les cadeaux s’ouvrent après 7 jours d’ancienneté : le ${giftLockedUntil}.` : `${friendName} reçoit tout de suite, sans rien vous donner en retour.`}</span>}
      </div>
      <div className={`${styles.sides} ${gift ? styles.single : ''}`}>
        <Picker title={gift ? 'Vous offrez' : 'Vous donnez'} who="VOTRE COLLECTION" items={mine} name="give" picked={give} toggle={toggle(give, setGive)} query={q1} setQuery={setQ1} />
        {!gift && <Picker title="Vous recevez" who={`COLLECTION DE ${friendName.toUpperCase()}`} items={theirs} name="take" picked={take} toggle={toggle(take, setTake)} query={q2} setQuery={setQ2} />}
      </div>
      {gift ? (
        <div className={styles.balance}>
          <div className={styles.tickets}>
            <label className="field">Tickets offerts
              <input className="input" type="number" name="giveTickets" min={0} max={myTickets} value={giveTickets} onChange={(e) => setGiveTickets(Math.max(0, Number(e.target.value)))} />
            </label>
          </div>
          <div className={styles.meter}>
            <div className={styles.meterHead}><span>VALEUR DU CADEAU {formatNumber(values.give)} TK</span></div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!!giftLockedUntil || (give.size === 0 && !giveTickets)}>Offrir à {friendName}</button>
        </div>
      ) : (
      <div className={styles.balance}>
        <div className={styles.tickets}>
          <label className="field">Tickets que vous ajoutez
            <input className="input" type="number" name="giveTickets" min={0} max={myTickets} value={giveTickets} onChange={(e) => setGiveTickets(Math.max(0, Number(e.target.value)))} />
          </label>
          <label className="field">Tickets que vous demandez
            <input className="input" type="number" name="takeTickets" min={0} value={takeTickets} onChange={(e) => setTakeTickets(Math.max(0, Number(e.target.value)))} />
          </label>
        </div>
        <div className={styles.meter}>
          <div className={styles.meterHead}>
            <span>VOUS DONNEZ {formatNumber(values.give)}</span>
            <span style={{ color: gap <= 0.15 && total ? 'var(--ok)' : 'var(--muted)' }}>{verdict}</span>
            <span>VOUS RECEVEZ {formatNumber(values.take)}</span>
          </div>
          <div className={styles.meterBar}>
            <span style={{ flex: values.give || 1, background: 'var(--accent)' }} />
            <span style={{ flex: values.take || 1, background: 'var(--text)' }} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={give.size + take.size === 0}>Proposer à {friendName}</button>
      </div>
      )}
    </form>
  );
}
