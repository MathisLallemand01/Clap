'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { buyListing, cancelListing, createListing } from '@/lib/market';
import { currentUser } from '@/lib/session';

async function playerId(): Promise<string> {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/guichet');
  return user.playerId;
}

function fail(err: unknown, back: string): never {
  if (err instanceof GameError) redirect(`${back}${back.includes('?') ? '&' : '?'}erreur=${encodeURIComponent(err.message)}`);
  throw err;
}

export async function buyAction(form: FormData): Promise<void> {
  const id = Number(form.get('listing'));
  const pid = await playerId();
  try {
    buyListing(getDb(), pid, id);
  } catch (err) {
    fail(err, `/guichet?annonce=${id}`);
  }
  redirect(`/guichet?achat=${id}`);
}

export async function sellAction(form: FormData): Promise<void> {
  const cardId = String(form.get('card'));
  const pid = await playerId();
  try {
    createListing(getDb(), pid, { cardId, price: Number(form.get('price')), days: Number(form.get('days')) });
  } catch (err) {
    fail(err, `/guichet?vue=vendre&carte=${encodeURIComponent(cardId)}`);
  }
  redirect('/guichet?vue=mes-annonces&vente=1');
}

export async function cancelAction(form: FormData): Promise<void> {
  const pid = await playerId();
  try {
    cancelListing(getDb(), pid, Number(form.get('listing')));
  } catch (err) {
    fail(err, '/guichet?vue=mes-annonces');
  }
  redirect('/guichet?vue=mes-annonces');
}
