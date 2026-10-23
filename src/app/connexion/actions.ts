'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logIn, signUp } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { startSession } from '@/lib/session';

export type AuthState = { error?: string; fields?: Record<string, string> };

/** N'accepte que les chemins internes, pour éviter les redirections vers un autre site. */
function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === 'string' ? value : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/bobines';
}

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '');
  try {
    const user = await logIn(getDb(), email, String(form.get('password') ?? ''));
    await startSession(user.id);
  } catch (err) {
    if (err instanceof GameError) return { error: err.message, fields: { email } };
    throw err;
  }
  redirect(safeNext(form.get('suite')));
}

export async function signupAction(_: AuthState, form: FormData): Promise<AuthState> {
  const fields = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    referral: String(form.get('referral') ?? ''),
  };
  try {
    const user = await signUp(getDb(), { ...fields, password: String(form.get('password') ?? '') });
    await startSession(user.id);
    (await cookies()).delete('clap_ref');
  } catch (err) {
    if (err instanceof GameError) return { error: err.message, fields };
    throw err;
  }
  redirect(safeNext(form.get('suite')));
}
