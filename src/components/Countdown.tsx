'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/format';

/** Compte à rebours jusqu'à la prochaine bobine offerte ; rafraîchit la page à l'échéance. */
export function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) window.location.reload();
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  return <time suppressHydrationWarning>{now === null ? '--:--:--' : formatCountdown(until - now)}</time>;
}
