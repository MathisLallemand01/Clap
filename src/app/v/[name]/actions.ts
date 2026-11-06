'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { currentUser } from '@/lib/session';
import { moveShowcaseSlot, setShowcaseSlot } from '@/lib/showcase';
import { sendFriendRequest } from '@/lib/social';

async function me() {
  const user = await currentUser();
  if (!user) redirect('/connexion');
  return user;
}
const back = (name: string, extra = '') => `/v/${encodeURIComponent(name)}${extra}`;

export async function setSlotAction(form: FormData): Promise<void> {
  const user = await me();
  const card = String(form.get('card') ?? '');
  try {
    setShowcaseSlot(getDb(), user.playerId, Number(form.get('slot')), card || null);
  } catch (err) {
    if (err instanceof GameError) redirect(back(user.name, `?montage=1&erreur=${encodeURIComponent(err.message)}`));
    throw err;
  }
  redirect(back(user.name, '?montage=1'));
}

export async function moveSlotAction(form: FormData): Promise<void> {
  const user = await me();
  moveShowcaseSlot(getDb(), user.playerId, Number(form.get('slot')), Number(form.get('dir')) < 0 ? -1 : 1);
  redirect(back(user.name, '?montage=1'));
}

export async function befriendAction(form: FormData): Promise<void> {
  const user = await me();
  const name = String(form.get('name') ?? '');
  try {
    sendFriendRequest(getDb(), user.id, name);
  } catch (err) {
    if (err instanceof GameError) redirect(back(name, `?erreur=${encodeURIComponent(err.message)}`));
    throw err;
  }
  redirect(back(name, '?ami=1'));
}
