'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Curtain.module.css';

export type CurtainKind = 'connexion' | 'inscription' | 'deconnexion';

const KEY = 'clap:curtain';
/** Le décompte 3, 2, 1 (0,6 s par chiffre) : la page n'apparaît qu'une fois le « 1 » terminé. */
const COUNT_MS = 1800;
/** Au retour de Google ou Discord (rechargement complet), on rejoue au moins le dernier chiffre. */
const LAST_STEP_MS = 600;
/** Au-delà, on lève le rideau quoi qu'il arrive (réseau coupé, retour arrière…). */
const MAX_MS = 9000;
const TEXT: Record<CurtainKind, [string, string]> = {
  connexion: ['Ouverture de la salle', 'VÉRIFICATION DU BILLET · BOBINE 01 EN PLACE'],
  inscription: ['Votre siège est prêt', '3 BOBINES OFFERTES · 600 TICKETS'],
  deconnexion: ['Fin de la séance', 'À BIENTÔT EN SALLE'],
};

type Shown = { kind: CurtainKind; at: number };

/**
 * À appeler juste avant une connexion, une inscription ou une déconnexion. Le rideau survit au
 * changement de page (y compris l'aller-retour chez Google ou Discord) grâce au sessionStorage.
 */
export function raiseCurtain(kind: CurtainKind): void {
  const shown: Shown = { kind, at: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(shown));
  } catch {
    // Stockage indisponible : le rideau ne survivra pas à un rechargement complet, tant pis.
  }
  document.documentElement.setAttribute('data-curtain', '');
  window.dispatchEvent(new CustomEvent('clap:curtain', { detail: shown }));
}

/** La connexion a échoué (mauvais mot de passe…) : on rend la main tout de suite. */
export function lowerCurtain(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Voir raiseCurtain.
  }
  window.dispatchEvent(new CustomEvent('clap:curtain', { detail: null }));
}

/**
 * L'écran de chargement des connexions : une amorce de film (3, 2, 1, le cercle qui balaye,
 * la pellicule qui défile), puis un fondu vers la page d'arrivée.
 */
export function Curtain({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [shown, setShown] = useState<Shown | null>(null);
  const [leaving, setLeaving] = useState(false);
  const from = useRef<{ path: string; signedIn: boolean } | null>(null);
  const timers = useRef<number[]>([]);

  const clear = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };

  const finish = useCallback((at: number) => {
    clear();
    const wait = Math.max(0, at + COUNT_MS - Date.now());
    timers.current.push(window.setTimeout(() => {
      setLeaving(true);
      try { sessionStorage.removeItem(KEY); } catch { /* Voir raiseCurtain. */ }
      timers.current.push(window.setTimeout(() => { setShown(null); setLeaving(false); }, 450));
    }, wait));
  }, []);

  const show = useCallback((s: Shown, arrived: boolean) => {
    clear();
    setLeaving(false);
    // Arrivée après un long aller-retour : le décompte reprend sur le « 1 », jamais en plein milieu.
    if (arrived && Date.now() - s.at > COUNT_MS - LAST_STEP_MS) s = { ...s, at: Date.now() - (COUNT_MS - LAST_STEP_MS) };
    setShown(s);
    from.current = arrived ? null : { path: window.location.pathname, signedIn };
    if (arrived) finish(s.at);
    else timers.current.push(window.setTimeout(() => finish(0), MAX_MS));
  }, [finish, signedIn]);

  // Arrivée sur une page après un rechargement complet (retour de Google ou Discord) : on finit le fondu.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as Shown) : null;
      if (s && Date.now() - s.at < MAX_MS) show(s, true);
      else {
        if (raw) sessionStorage.removeItem(KEY);
        document.documentElement.classList.remove('curtain-pending');
      }
    } catch {
      // Voir raiseCurtain.
    }
    const onEvent = (e: Event) => {
      const s = (e as CustomEvent<Shown | null>).detail;
      if (s) show(s, false);
      else { clear(); setShown(null); setLeaving(false); }
    };
    window.addEventListener('clap:curtain', onEvent);
    return () => { window.removeEventListener('clap:curtain', onEvent); clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le décompte reprend là où il en est (délai négatif) : il ne repart jamais de 3 au milieu d'une connexion.
  // Calculé une fois par rideau : un nouveau rendu ne doit pas recaler (et donc faire sauter) les animations.
  const timing = useMemo(() => (shown ? {
    '--count-ms': `${COUNT_MS}ms`,
    '--delay': `${-Math.max(0, Math.min(COUNT_MS, Date.now() - shown.at))}ms`,
    tc: `00:00:0${Math.floor((shown.at / 1000) % 10)}:14`,
  } : null), [shown]);

  // Le rideau est peint : le masque d'attente (posé avant React) peut partir sans laisser voir la page.
  // Tant qu'il est levé, les transitions de page sont coupées (voir globals.css).
  useEffect(() => {
    const html = document.documentElement;
    if (shown && !leaving) {
      html.classList.remove('curtain-pending');
      html.setAttribute('data-curtain', '');
    } else html.removeAttribute('data-curtain');
  }, [shown, leaving]);

  // Navigation côté client (server action qui redirige) : la page ou la session a changé, on lève le rideau.
  useEffect(() => {
    if (!shown || !from.current) return;
    if (pathname !== from.current.path || signedIn !== from.current.signedIn) {
      from.current = null;
      finish(shown.at);
    }
  }, [pathname, signedIn, shown, finish]);

  if (!shown) return null;
  const [title, sub] = TEXT[shown.kind];
  const vars = timing!;
  return (
    <div data-curtain-root="" className={`${styles.curtain} ${leaving ? styles.leaving : ''}`} style={{ '--count-ms': vars['--count-ms'], '--delay': vars['--delay'] } as React.CSSProperties} role="status" aria-live="polite" aria-label={title}>
      <span className={styles.beam} aria-hidden="true" />
      <div className={`${styles.film} ${styles.filmTop}`} aria-hidden="true"><i /></div>
      <div className={`${styles.film} ${styles.filmBottom}`} aria-hidden="true"><i /></div>
      <span className={styles.rec} aria-hidden="true"><i />REC</span>
      <span className={styles.tc} aria-hidden="true">{timing!.tc}</span>
      <span className={styles.sideA} aria-hidden="true">CLAP · AMORCE SMPTE · 35 MM</span>
      <span className={styles.sideB} aria-hidden="true">SALLE 7 · 24 IM/S</span>
      <div className={styles.center}>
        <div className={styles.leader} aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.ringIn} />
          <span className={styles.crossV} />
          <span className={styles.crossH} />
          <span className={styles.sweep} />
          <span className={styles.count}><span className={styles.d3}>3</span><span className={styles.d2}>2</span><span className={styles.d1}>1</span></span>
        </div>
        <strong className={`display ${styles.title}`}>{title}</strong>
        <span className={styles.sub}>{sub}</span>
        <span className={styles.bar} aria-hidden="true"><i /></span>
      </div>
      <span className={styles.brand} aria-hidden="true"><b><i /><i /><i /></b>CLAP</span>
    </div>
  );
}
