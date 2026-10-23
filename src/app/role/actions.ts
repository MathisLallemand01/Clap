'use server';

import { getDb } from '@/lib/db';
import { logEvent } from '@/lib/notify';
import { currentUser } from '@/lib/session';

/** Compte une bande-annonce regardée (mission du jour). */
export async function trailerWatched(): Promise<void> {
  const user = await currentUser();
  if (user) logEvent(getDb(), user.playerId, 'trailer');
}
