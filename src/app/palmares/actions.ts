'use server';

import { redirect } from 'next/navigation';
import { togglePin } from '@/lib/badges';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { currentUser } from '@/lib/session';

export async function pinAction(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/palmares');
  try {
    togglePin(getDb(), user.playerId, String(form.get('badge')));
  } catch (err) {
    if (err instanceof GameError) redirect(`/palmares?erreur=${encodeURIComponent(err.message)}`);
    throw err;
  }
  redirect('/palmares');
}
