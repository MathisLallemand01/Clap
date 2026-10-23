'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { acceptFriend, cancelTrade, proposeTrade, removeFriend, respondTrade, sendFriendRequest, sendGift } from '@/lib/social';
import { currentUser } from '@/lib/session';

async function userId(): Promise<string> {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/echanges');
  return user.id;
}

function back(params: Record<string, string>): never {
  redirect(`/echanges?${new URLSearchParams(params).toString()}`);
}

async function attempt(fn: () => string | void, keep: Record<string, string> = {}): Promise<never> {
  let ok: string | void;
  try {
    ok = fn();
  } catch (err) {
    if (err instanceof GameError) back({ ...keep, erreur: err.message });
    throw err;
  }
  back({ ...keep, ...(ok ? { ok } : {}) });
}

export async function addFriendAction(form: FormData): Promise<void> {
  const me = await userId();
  await attempt(() => sendFriendRequest(getDb(), me, String(form.get('name') ?? '')));
}

export async function acceptFriendAction(form: FormData): Promise<void> {
  const me = await userId();
  await attempt(() => { acceptFriend(getDb(), me, String(form.get('id'))); return 'Ami ajouté.'; });
}

export async function removeFriendAction(form: FormData): Promise<void> {
  const me = await userId();
  await attempt(() => { removeFriend(getDb(), me, String(form.get('id'))); });
}

export async function proposeAction(form: FormData): Promise<void> {
  const me = await userId();
  const to = String(form.get('to'));
  await attempt(() => {
    proposeTrade(getDb(), me, to, {
      give: form.getAll('give').map(String),
      take: form.getAll('take').map(String),
      giveTickets: Number(form.get('giveTickets') || 0),
      takeTickets: Number(form.get('takeTickets') || 0),
    });
    return 'Proposition envoyée.';
  }, { ami: to });
}

export async function giftAction(form: FormData): Promise<void> {
  const me = await userId();
  const to = String(form.get('to'));
  await attempt(() => {
    sendGift(getDb(), me, to, { cards: form.getAll('give').map(String), tickets: Number(form.get('giveTickets') || 0) });
    return 'Cadeau envoyé ! Votre ami le découvrira à sa prochaine visite.';
  }, { ami: to });
}

export async function respondAction(form: FormData): Promise<void> {
  const me = await userId();
  const accept = form.get('decision') === 'accept';
  await attempt(() => { respondTrade(getDb(), me, Number(form.get('trade')), accept); return accept ? 'Échange conclu !' : 'Échange refusé.'; });
}

export async function cancelTradeAction(form: FormData): Promise<void> {
  const me = await userId();
  await attempt(() => { cancelTrade(getDb(), me, Number(form.get('trade'))); return 'Proposition annulée.'; });
}
