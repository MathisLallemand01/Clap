import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { publicOrigin } from '@/lib/origin';

// Connexion Google (OpenID Connect, flux « authorization code »).
// Il faut GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (console Google Cloud > Identifiants),
// avec pour URI de redirection autorisée : <adresse du site>/api/auth/google/callback.
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = publicOrigin(request);
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/connexion?erreur=google-config', origin));
  }
  const state = randomBytes(24).toString('base64url');
  const next = request.nextUrl.searchParams.get('suite') ?? '/bobines';
  const referral = request.nextUrl.searchParams.get('parrain') ?? '';
  (await cookies()).set('clap_oauth', JSON.stringify({ state, next, referral }), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600,
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  return NextResponse.redirect(url);
}
