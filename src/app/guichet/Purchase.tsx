'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Celebrate } from '@/components/Celebrate';
import { formatNumber } from '@/lib/format';
import type { Card } from '@/lib/types';

/** Achat réussi au Guichet : la carte arrive au centre, tampon « Vendu ! », prix payé et nouveau solde. */
export function Purchase({ card, serial, price, balance, unlimited }: { card: Card; serial: number; price: number; balance: number; unlimited: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = useCallback(() => {
    setOpen(false);
    router.replace('/guichet', { scroll: false });
  }, [router]);
  if (!open) return null;
  return (
    <Celebrate
      eyebrow="✓ Achat réussi"
      stamp="Vendu !"
      title={card.character ?? `${card.first} ${card.last}`}
      sub={`rejoint votre collection${card.kind === 'role' ? ` · ${card.first} ${card.last}` : ''}`}
      cards={[{ ...card, serial }]}
      tickets={-price}
      lines={[`Solde : ${unlimited ? '∞' : formatNumber(balance)} TK`]}
      link={{ href: '/collection', label: 'Voir ma collection' }}
      closeLabel="Continuer mes achats"
      onClose={close}
    />
  );
}
