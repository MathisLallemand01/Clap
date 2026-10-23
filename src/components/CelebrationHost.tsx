'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { dismissCelebration } from '@/app/actions';
import type { Celebration } from '@/lib/celebrations';
import { Celebrate } from './Celebrate';

/** Affiche la prochaine bonne nouvelle en attente (vente, échange, cadeau), puis la suivante s'il y en a. */
export function CelebrationHost({ celebration }: { celebration: Celebration }) {
  const router = useRouter();
  const [closed, setClosed] = useState<number | null>(null);
  const close = useCallback(() => {
    setClosed(celebration.id);
    void dismissCelebration(celebration.id).then(() => router.refresh());
  }, [celebration.id, router]);
  if (closed === celebration.id) return null;
  return (
    <Celebrate
      key={celebration.id}
      eyebrow={celebration.eyebrow}
      stamp={celebration.stamp}
      title={celebration.title}
      sub={celebration.sub}
      cards={celebration.cards}
      tickets={celebration.tickets}
      lines={celebration.lines}
      link={{ href: celebration.href, label: celebration.hrefLabel }}
      onClose={close}
    />
  );
}
