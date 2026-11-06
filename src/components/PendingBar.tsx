'use client';

import { useLinkStatus } from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Durée du remplissage de la barre : la page ne change qu'une fois la barre arrivée au bout. */
const FILL_MS = 650;

/**
 * Barre de chargement d'un lien : une fine barre en haut de l'écran et un trait sous le lien cliqué.
 * À placer dans un <Link>. Au clic, la barre se remplit en entier, puis seulement la page change
 * (si la page n'est pas encore prête, la barre reste pleine et scintille jusqu'à son arrivée).
 * `types` : les types de transition du lien (sens de l'animation entre les pages).
 */
export function PendingBar({ types }: { types?: string[] }) {
  const { pending } = useLinkStatus();
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<'idle' | 'fill' | 'wait'>('idle');
  const busy = useRef(false);
  const typesRef = useRef(types);
  typesRef.current = types;

  useEffect(() => {
    const a = ref.current?.closest('a');
    if (!a) return;
    const timers: number[] = [];
    let poll = 0;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const target = url.pathname + url.search + url.hash;
      // Même page : rien à charger, le lien fait son travail habituel.
      if (url.pathname === location.pathname && url.search === location.search) return;
      // Mouvement réduit : pas d'attente artificielle.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // Le lien ne navigue pas tout de suite : c'est nous qui le ferons, barre remplie.
      e.preventDefault();
      if (busy.current) return;
      busy.current = true;
      setPhase('fill');
      router.prefetch(url.pathname + url.search);
      timers.push(window.setTimeout(() => {
        setPhase('wait');
        router.push(target, { transitionTypes: typesRef.current });
        // Même composant après la navigation (changement d'onglet) : on éteint la barre à l'arrivée.
        poll = window.setInterval(() => {
          if (location.pathname + location.search === url.pathname + url.search) {
            window.clearInterval(poll);
            busy.current = false;
            setPhase('idle');
          }
        }, 80);
      }, FILL_MS));
    };
    a.addEventListener('click', onClick);
    return () => {
      a.removeEventListener('click', onClick);
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(poll);
    };
  }, [router]);

  const active = phase !== 'idle' || pending;
  return (
    <>
      <span ref={ref} aria-hidden="true" className={`pending-underline ${active ? 'is-pending' : ''} ${phase === 'fill' ? 'is-filling' : ''}`} style={{ '--fill': `${FILL_MS}ms` } as React.CSSProperties} />
      {active && (
        <span
          role="progressbar"
          aria-label="Chargement de la page"
          className={`pending-top ${phase === 'fill' ? 'is-filling' : 'is-waiting'}`}
          style={{ '--fill': `${FILL_MS}ms` } as React.CSSProperties}
        />
      )}
    </>
  );
}
