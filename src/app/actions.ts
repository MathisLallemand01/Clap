'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountError, changePassword, deleteOtherSessions, isLimited, LIMITS, normalizeEmail, record, resetLimit, signIn, signUp } from '@/lib/accounts';
import { getDb } from '@/lib/db';
import { claimDaily, recycleDuplicates } from '@/lib/economy';
import { GameError } from '@/lib/game';
import { currentPlayer, currentToken, ensurePlayer, logIn, logOut } from '@/lib/session';

export type FormState = { error?: string; field?: string | null; ok?: string; values?: Record<string, string> } | null;

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
};

/** Seules les redirections internes sont suivies (pas d'URL externe dans `?suite=`). */
const safeNext = (next: string) => (next.startsWith('/') && !next.startsWith('//') ? next : '/compte');

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local';
}

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { name: text(form, 'name'), email: text(form, 'email') };
  const ip = await clientKey();
  if (isLimited(`signup:${ip}`, LIMITS.signupPerIp)) return { error: 'Trop de comptes créés depuis cette connexion. Réessayez plus tard.', values };
  try {
    const guest = await currentPlayer();
    const playerId = await signUp(getDb(), guest && guest.email === null ? guest.id : null, { ...values, password: text(form, 'password') });
    record(`signup:${ip}`, LIMITS.signupPerIp);
    await logIn(playerId);
  } catch (err) {
    if (err instanceof AccountError) return { error: err.message, field: err.field, values };
    throw err;
  }
  redirect(safeNext(text(form, 'next')));
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(text(form, 'email'));
  const values = { email };
  const ip = await clientKey();
  if (isLimited(`login:${email}`, LIMITS.loginPerEmail) || isLimited(`login-ip:${ip}`, LIMITS.loginPerIp)) {
    return { error: 'Trop de tentatives. Réessayez dans quelques minutes.', values };
  }
  try {
    const playerId = await signIn(getDb(), email, text(form, 'password'));
    resetLimit(`login:${email}`);
    await logIn(playerId);
  } catch (err) {
    if (err instanceof AccountError) {
      record(`login:${email}`, LIMITS.loginPerEmail);
      record(`login-ip:${ip}`, LIMITS.loginPerIp);
      return { error: err.message, field: err.field, values };
    }
    throw err;
  }
  redirect(safeNext(text(form, 'next')));
}

export async function signOutAction(): Promise<void> {
  await logOut();
  redirect('/');
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const player = await currentPlayer();
  if (!player?.email) return { error: 'Connectez-vous d’abord.' };
  try {
    await changePassword(getDb(), player.id, text(form, 'current'), text(form, 'next'));
    // Les autres appareils sont déconnectés ; celui-ci reste connecté.
    deleteOtherSessions(getDb(), player.id, await currentToken());
  } catch (err) {
    if (err instanceof AccountError) return { error: err.message, field: err.field };
    throw err;
  }
  return { ok: 'Mot de passe changé. Vos autres appareils ont été déconnectés.' };
}

export async function claimDailyAction(_prev: FormState): Promise<FormState> {
  const player = await ensurePlayer();
  try {
    claimDaily(getDb(), player.id);
  } catch (err) {
    if (err instanceof GameError) return { error: err.message };
    throw err;
  }
  refresh();
  return { ok: 'Prime du jour encaissée.' };
}

export async function recycleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const player = await currentPlayer();
  if (!player) return { error: 'Aucune collection à recycler.' };
  const cardId = text(form, 'cardId') || undefined;
  try {
    const r = recycleDuplicates(getDb(), player.id, { cardId });
    refresh();
    return { ok: `${r.copies} doublon${r.copies > 1 ? 's' : ''} recyclé${r.copies > 1 ? 's' : ''} : +${r.tickets} tickets.` };
  } catch (err) {
    if (err instanceof GameError) return { error: err.message };
    throw err;
  }
}
