'use server';

import { redirect } from 'next/navigation';
import { claimSaga } from '@/lib/collections';
import { getDb } from '@/lib/db';
import { GameError, recycleDuplicates } from '@/lib/game';
import { currentUser } from '@/lib/session';

export async function recycleAction(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/collection');
  const { cards, seats } = recycleDuplicates(getDb(), user.playerId);
  redirect(`/collection?recycle=${cards}-${seats}`);
}

export async function claimSagaAction(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/collection?vue=sagas');
  try {
    const tickets = claimSaga(getDb(), user.playerId, Number(form.get('saga')));
    redirect(`/collection?vue=sagas&saga=${tickets}`);
  } catch (err) {
    if (err instanceof GameError) redirect(`/collection?vue=sagas&erreur=${encodeURIComponent(err.message)}`);
    throw err;
  }
}
