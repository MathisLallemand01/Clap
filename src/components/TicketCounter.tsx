'use client';

import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@/lib/format';

/** Le solde de tickets de la navigation : il compte jusqu'au nouveau total quand une récompense s'y range. */
export function TicketCounter({ value, unlimited }: { value: number; unlimited: boolean }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(false);
  const raf = useRef(0);

  useEffect(() => setShown(value), [value]);

  useEffect(() => {
    const onReward = (e: Event) => {
      const delta = Number((e as CustomEvent<number>).detail) || 0;
      setBump(true);
      window.setTimeout(() => setBump(false), 900);
      const start = performance.now();
      setShown((from) => {
        const to = from + delta;
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / 800);
          setShown(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
          if (t < 1) raf.current = requestAnimationFrame(step);
        };
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(step);
        return from;
      });
    };
    window.addEventListener('clap:tickets', onReward);
    return () => {
      window.removeEventListener('clap:tickets', onReward);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return <span className={bump ? 'ticket-bump' : undefined}>{unlimited ? '∞' : formatNumber(shown)}</span>;
}
