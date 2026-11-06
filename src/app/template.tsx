import { ViewTransition } from 'react';

/**
 * Chaque page entre et sort en douceur : glissement dans le sens du menu (onglet à droite → la page part
 * vers la gauche), fondu pour les autres liens. Un template est recréé à chaque navigation, contrairement
 * au layout : c'est ce qui déclenche les animations d'entrée et de sortie. L'en-tête reste immobile.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const motion = { 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'page-fade' };
  return (
    <ViewTransition enter={motion} exit={motion} default="none">
      {children}
    </ViewTransition>
  );
}
