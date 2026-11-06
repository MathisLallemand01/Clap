'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const CHANNEL = 'clap-sync';

/**
 * Prévient les autres onglets du site qu'une action a changé l'état du joueur (bobine ouverte, achat,
 * mission…). Ils se rafraîchissent aussitôt : la réserve et les tickets affichés ne restent jamais périmés.
 */
export function broadcastChange(): void {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ at: Date.now() });
    ch.close();
  } catch {
    // Navigateur sans BroadcastChannel : le retour sur l'onglet suffira à le mettre à jour.
  }
}

/** À placer une fois dans la mise en page : écoute les autres onglets et le retour sur cet onglet. */
export function TabSync() {
  const router = useRouter();
  const last = useRef(0);
  useEffect(() => {
    const refresh = (minGap: number) => {
      if (Date.now() - last.current < minGap) return;
      last.current = Date.now();
      router.refresh();
    };
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = () => refresh(500);
    } catch {
      ch = null;
    }
    // Retour sur un onglet resté en arrière-plan : on relit l'état du serveur.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(4000); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      ch?.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);
  return null;
}
