'use client';

import { logout } from '@/app/actions';
import { raiseCurtain } from './Curtain';

/** « Se déconnecter », avec l'écran de fin de séance pendant la transition. */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout} onSubmit={() => raiseCurtain('deconnexion')}>
      <button type="submit" className={className}>Se déconnecter</button>
    </form>
  );
}
