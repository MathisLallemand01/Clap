'use server';

import { redirect } from 'next/navigation';
import { deleteAccount, unlinkDiscord, updateProfile } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { NOTIFY_KINDS } from '@/lib/notify';
import { currentUser, endSession } from '@/lib/session';

async function user() {
  const u = await currentUser();
  if (!u) redirect('/connexion?suite=/parametres');
  return u;
}

export async function saveAccount(form: FormData): Promise<void> {
  const u = await user();
  try {
    updateProfile(getDb(), u.id, { name: String(form.get('name') ?? u.name), publicProfile: form.get('public') === 'on' });
  } catch (err) {
    if (err instanceof GameError) redirect(`/parametres?erreur=${encodeURIComponent(err.message)}#compte`);
    throw err;
  }
  redirect('/parametres?ok=compte#compte');
}

export async function saveNotifications(form: FormData): Promise<void> {
  const u = await user();
  const prefs = Object.fromEntries(NOTIFY_KINDS.map((k) => [k.kind, form.get(k.kind) === 'on']));
  updateProfile(getDb(), u.id, { notify: prefs });
  redirect('/parametres?ok=notifications#notifications');
}

export async function removeAccount(form: FormData): Promise<void> {
  const u = await user();
  if (String(form.get('confirm') ?? '').trim() !== u.name) {
    redirect(`/parametres?supprimer=1&erreur=${encodeURIComponent('Tapez exactement votre pseudo pour confirmer.')}`);
  }
  deleteAccount(getDb(), u.id);
  await endSession();
  redirect('/?au-revoir=1');
}

export async function removeDiscord(): Promise<void> {
  const u = await user();
  unlinkDiscord(getDb(), u.id);
  redirect('/parametres?ok=discord-off#compte');
}
