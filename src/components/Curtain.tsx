'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Curtain.module.css';

export type CurtainKind = 'connexion' | 'inscription' | 'deconnexion';

const KEY = 'clap:curtain';
/** Durée minimale d'affichage : assez pour voir l'amorce, pas assez pour attendre. */
const MIN_MS = 1100;
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
    const wait = Math.max(0, at + MIN_MS - Date.now());
    timers.current.push(window.setTimeout(() => {
      setLeaving(true);
      try { sessionStorage.removeItem(KEY); } catch { /* Voir raiseCurtain. */ }
      timers.current.push(window.setTimeout(() => { setShown(null); setLeaving(false); }, 450));
    }, wait));
  }, []);

  const show = useCallback((s: Shown, arrived: boolean) => {
    clear();
    setLeaving(false);
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
      else if (raw) sessionStorage.removeItem(KEY);
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
  return (
    <div className={`${styles.curtain} ${leaving ? styles.leaving : ''}`} role="status" aria-live="polite" aria-label={title}>
      <span className={styles.beam} aria-hidden="true" />
      <div className={`${styles.film} ${styles.filmTop}`} aria-hidden="true"><i /></div>
      <div className={`${styles.film} ${styles.filmBottom}`} aria-hidden="true"><i /></div>
      <span className={styles.rec} aria-hidden="true"><i />REC</span>
      <span className={styles.tc} aria-hidden="true">00:00:0{Math.floor((Date.now() / 1000) % 10)}:14</span>
      <span className={styles.sideA} aria-hidden="true">CLAP · AMORCE SMPTE · 35 MM</span>
      <span className={styles.sideB} aria-hidden="true">SALLE 7 · 24 IM/S</span>
      <div className={styles.center}>
        <div className={styles.leader} aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.ringIn} />
          <span className={styles.crossV} />
          <span className={styles.crossH} />
          <span className={styles.sweep} />
          <span className={styles.count} />
        </div>
        <strong className={`display ${styles.title}`}>{title}</strong>
        <span className={styles.sub}>{sub}</span>
        <span className={styles.bar} aria-hidden="true"><i /></span>
      </div>
      <span className={styles.brand} aria-hidden="true"><b><i /><i /><i /></b>CLAP</span>
    </div>
  );
}
