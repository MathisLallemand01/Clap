'use server';

import { redirect } from 'next/navigation';
import { updateProfile } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { markAllRead, markRead, REGIE_CATEGORIES } from '@/lib/notify';
import { safePath, tooFast } from '@/lib/security';
import { currentUser } from '@/lib/session';
import { removeWatch, setWatch, toggleWatch, type WatchCond } from '@/lib/watch';

async function me() {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/regie');
  const slow = tooFast('regie', user.playerId, 40);
  if (slow) redirect(`/regie?erreur=${encodeURIComponent(slow)}`);
  return user;
}

export async function markAllAction(form: FormData): Promise<void> {
  const user = await me();
  const cat = REGIE_CATEGORIES.find((c) => c.id === form.get('cat'));
  markAllRead(getDb(), user.id, Date.now(), cat?.kinds);
  redirect(cat ? `/regie?cat=${cat.id}` : '/regie');
}

/** Ouvre une notification : elle passe en « vue », puis on suit son lien. */
export async function openNotificationAction(form: FormData): Promise<void> {
  const user = await me();
  markRead(getDb(), user.id, Number(form.get('id')));
  // Seulement un chemin du site (refuse //autre-site, /\\autre-site, javascript:…).
  redirect(safePath(form.get('href'), '/regie'));
}

export async function watchAction(form: FormData): Promise<void> {
  const user = await me();
  const card = String(form.get('card'));
  const max = Number(form.get('max'));
  try {
    setWatch(getDb(), user.id, card, String(form.get('cond')) as WatchCond, Number.isFinite(max) && max > 0 ? Math.round(max) : null);
  } catch (err) {
    if (err instanceof GameError) redirect(`/regie?guetter=${encodeURIComponent(card)}&erreur=${encodeURIComponent(err.message)}`);
    throw err;
  }
  redirect('/regie?guet=1');
}

export async function toggleWatchAction(form: FormData): Promise<void> {
  const user = await me();
  toggleWatch(getDb(), user.id, String(form.get('card')));
  redirect('/regie');
}

export async function removeWatchAction(form: FormData): Promise<void> {
  const user = await me();
  removeWatch(getDb(), user.id, String(form.get('card')));
  redirect('/regie');
}

export async function channelAction(form: FormData): Promise<void> {
  const user = await me();
  const key = String(form.get('key'));
  if (key !== 'ch_discord') redirect('/regie');
  updateProfile(getDb(), user.id, { notify: { ...user.notify, [key]: user.notify[key] === false } });
  redirect('/regie');
}

/** Ferme le télégramme (bandeau des urgences). */
export async function dismissTelegramAction(id: number): Promise<void> {
  const user = await currentUser();
  if (user) markRead(getDb(), user.id, id);
}
