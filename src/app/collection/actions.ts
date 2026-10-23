'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { recycleDuplicates } from '@/lib/game';
import { currentUser } from '@/lib/session';

export async function recycleAction(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/collection');
  const { cards, tickets } = recycleDuplicates(getDb(), user.playerId);
  redirect(`/collection?recycle=${cards}-${tickets}`);
}
