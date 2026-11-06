'use client';

import { useEffect, useRef } from 'react';

/** Applique les filtres dès qu'un choix change (le bouton « Appliquer » reste pour la recherche et sans JavaScript). */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement).matches('select, input[type=radio]')) form.requestSubmit();
    };
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
  }, []);
  return <span ref={ref} hidden />;
}
