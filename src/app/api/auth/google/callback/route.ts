import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { upsertGoogleUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { startSession } from '@/lib/session';

type Pending = { state: string; next: string; referral: string };

export async function GET(request: NextRequest) {
  const origin = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/+$/, '');
  const fail = () => NextResponse.redirect(new URL('/connexion?erreur=google', origin));
  const jar = await cookies();
  const raw = jar.get('clap_oauth')?.value;
  jar.delete('clap_oauth');
  const code = request.nextUrl.searchParams.get('code');
  let pending: Pending;
  try {
    pending = JSON.parse(raw ?? '') as Pending;
  } catch {
    return fail();
  }
  if (!code || pending.state !== request.nextUrl.searchParams.get('state')) return fail();

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail();
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!infoRes.ok) return fail();
    const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; given_name?: string; picture?: string };
    const user = upsertGoogleUser(getDb(), {
      sub: info.sub,
      email: info.email_verified ? (info.email ?? null) : null,
      name: info.given_name ?? info.name ?? 'cinephile',
      picture: info.picture ?? null,
    }, pending.referral || undefined);
    await startSession(user.id);
  } catch {
    return fail();
  }
  const next = pending.next.startsWith('/') && !pending.next.startsWith('//') ? pending.next : '/bobines';
  return NextResponse.redirect(new URL(next, origin));
}
