'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

/**
 * Filtres dynamiques : à placer dans un formulaire de filtres (méthode GET). Chaque choix (liste, bouton radio,
 * case) s'applique tout de suite ; la saisie dans un champ de recherche s'applique après une courte pause.
 * Le bouton « Filtrer » est masqué (il reste pour les navigateurs sans JavaScript). La page change sans
 * rechargement ni retour en haut.
 */
export function LiveFilters({ delay = 320 }: { delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    form.querySelectorAll<HTMLButtonElement>('button[type=submit], button:not([type])').forEach((b) => { b.hidden = true; });
    let timer = 0;
    const apply = () => {
      const action = new URL(form.getAttribute('action') || window.location.pathname, window.location.href);
      const params = new URLSearchParams();
      new FormData(form).forEach((v, k) => { if (typeof v === 'string' && v !== '') params.set(k, v); });
      const qs = params.toString();
      start(() => router.replace(`${action.pathname}${qs ? `?${qs}` : ''}${action.hash}`, { scroll: false }));
    };
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement).matches('input[type=search], input[type=text]')) return;
      window.clearTimeout(timer);
      apply();
    };
    const onInput = (e: Event) => {
      if (!(e.target as HTMLElement).matches('input[type=search], input[type=text], input[type=number]')) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, delay);
    };
    const onSubmit = (e: Event) => { e.preventDefault(); window.clearTimeout(timer); apply(); };
    form.addEventListener('change', onChange);
    form.addEventListener('input', onInput);
    form.addEventListener('submit', onSubmit);
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener('change', onChange);
      form.removeEventListener('input', onInput);
      form.removeEventListener('submit', onSubmit);
    };
  }, [router, delay]);

  useEffect(() => {
    const form = ref.current?.closest('form');
    form?.toggleAttribute('data-pending', pending);
    form?.setAttribute('aria-busy', pending ? 'true' : 'false');
  }, [pending]);

  return <span ref={ref} hidden />;
}
