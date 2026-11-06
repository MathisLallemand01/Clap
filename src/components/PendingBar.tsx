'use client';

import { useLinkStatus } from 'next/link';

/**
 * Retour immédiat au clic, le temps que la page arrive : une fine barre de projection en haut de l'écran
 * et un trait sous le lien cliqué. À placer dans un <Link>. Toujours rendu : aucun saut de mise en page.
 */
export function PendingBar() {
  const { pending } = useLinkStatus();
  return (
    <>
      <span aria-hidden="true" className={`pending-underline ${pending ? 'is-pending' : ''}`} />
      {pending && <span role="progressbar" aria-label="Chargement de la page" className="pending-top" />}
    </>
  );
}
