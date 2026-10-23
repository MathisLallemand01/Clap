'use client';

import { useState } from 'react';

/** Copie une valeur dans le presse-papiers ; propose le partage natif sur mobile si demandé. */
export function CopyButton({ value, label, className, share }: { value: string; label: string; className?: string; share?: boolean }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      if (share && typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Clap', text: 'Viens collectionner le cinéma avec moi sur Clap !', url: value });
        return;
      }
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // Partage annulé ou presse-papiers refusé : rien à faire.
    }
  };
  return <button type="button" className={className} onClick={onClick} aria-live="polite">{done ? 'Copié ✓' : label}</button>;
}
