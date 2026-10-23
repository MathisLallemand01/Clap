import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// Discord (OAuth2, flux « authorization code », portées « identify email » : pseudo, photo et e-mail vérifié).
// Il faut DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET (discord.com/developers > Applications > OAuth2),
// avec pour redirection autorisée, à l'identique : <adresse du site>/api/auth/discord/callback.
// Connecté : lie le compte Discord. Déconnecté : connexion, ou création d'un compte au nom de Discord.
export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const origin = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/+$/, '');
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET?.trim()) {
    return NextResponse.redirect(new URL('/connexion?erreur=discord-config', origin));
  }
  const state = randomBytes(24).toString('base64url');
  const next = request.nextUrl.searchParams.get('suite') ?? '';
  const referral = request.nextUrl.searchParams.get('parrain') ?? '';
  (await cookies()).set('clap_discord', JSON.stringify({ state, next, referral }), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600,
  });
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify email',
    state,
  }).toString();
  return NextResponse.redirect(url);
}
