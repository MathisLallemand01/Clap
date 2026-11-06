'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { logIn, signUp } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { clientIp, rateLimit, resetRateLimit, safePath, waitText } from '@/lib/security';
import { startSession } from '@/lib/session';

export type AuthState = { error?: string; fields?: Record<string, string> };

const MINUTE = 60_000;

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').slice(0, 200);
  // Contre les essais de mots de passe en série : par adresse IP et par compte visé.
  const ip = clientIp(await headers());
  const wait = Math.max(rateLimit(`login:ip:${ip}`, 20, 15 * MINUTE), rateLimit(`login:email:${email.trim().toLowerCase()}`, 8, 15 * MINUTE));
  if (wait) return { error: `Trop de tentatives. Réessayez dans ${waitText(wait)}.`, fields: { email } };
  try {
    const user = await logIn(getDb(), email, String(form.get('password') ?? ''));
    resetRateLimit(`login:email:${email.trim().toLowerCase()}`);
    await startSession(user.id);
  } catch (err) {
    if (err instanceof GameError) return { error: err.message, fields: { email } };
    throw err;
  }
  redirect(safePath(form.get('suite')));
}

export async function signupAction(_: AuthState, form: FormData): Promise<AuthState> {
  const fields = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    referral: String(form.get('referral') ?? ''),
  };
  // Contre la création de comptes en série (bobines offertes, parrainage).
  const wait = rateLimit(`signup:ip:${clientIp(await headers())}`, 5, 60 * MINUTE);
  if (wait) return { error: `Trop de comptes créés depuis cette connexion. Réessayez dans ${waitText(wait)}.`, fields };
  try {
    const user = await signUp(getDb(), { ...fields, password: String(form.get('password') ?? '') });
    await startSession(user.id);
    (await cookies()).delete('clap_ref');
  } catch (err) {
    if (err instanceof GameError) return { error: err.message, fields };
    throw err;
  }
  redirect(safePath(form.get('suite')));
}
