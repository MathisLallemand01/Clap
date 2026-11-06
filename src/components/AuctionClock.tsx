'use client';

import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** Le temps qui reste avant que le marteau tombe, à la seconde ; « 1 J 04 H » au-delà d'un jour. */
export function formatLeft(ms: number): string {
  if (ms <= 0) return 'ADJUGÉ';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  if (d >= 1) return `${d} J ${pad(Math.floor((s % 86400) / 3600))} H`;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Compte à rebours en direct (texte seul) ; « hot » sous 5 minutes. */
export function AuctionClock({ endsAt, className, hotClassName }: { endsAt: number; className?: string; hotClassName?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = now === null ? null : endsAt - now;
  const hot = left !== null && left < 5 * 60_000;
  return <time suppressHydrationWarning className={`${className ?? ''} ${hot && hotClassName ? hotClassName : ''}`} dateTime={new Date(endsAt).toISOString()}>{left === null ? '--:--:--' : formatLeft(left)}</time>;
}

/** Le décompte d'amorce de pellicule : un cercle qui se vide, le chiffre des minutes (ou heures) au centre. */
export function LeaderCountdown({ endsAt, total, size = 120 }: { endsAt: number; total: number; size?: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = now === null ? total : Math.max(0, endsAt - now);
  const frac = Math.max(0, Math.min(1, left / total));
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const big = left >= 3600_000 ? Math.floor(left / 3600_000) : Math.floor(left / 60_000);
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '2px solid var(--line-2)', background: 'radial-gradient(#1a1a1f, #0d0d10)' }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: -2, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(c * frac).toFixed(1)} ${c.toFixed(1)}`} />
      </svg>
      <span style={{ position: 'absolute', left: '50%', top: 6, bottom: 6, width: 1, background: 'var(--line-2)' }} />
      <span style={{ position: 'absolute', top: '50%', left: 6, right: 6, height: 1, background: 'var(--line-2)' }} />
      <span suppressHydrationWarning style={{ position: 'relative', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: size * 0.28 }}>{pad(big)}</span>
    </span>
  );
}
