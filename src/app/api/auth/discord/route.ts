import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// Liaison Discord (OAuth2, flux « authorization code », portée « identify » : pseudo et photo, rien d'autre).
// Il faut DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET (discord.com/developers > Applications > OAuth2),
// avec pour redirection autorisée : <adresse du site>/api/auth/discord/callback.
// Connecté : lie le compte Discord. Déconnecté : se connecte avec un compte Discord déjà lié.
export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const origin = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/+$/, '');
  const next = request.nextUrl.searchParams.get('suite') ?? '/parametres#compte';
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET) {
    return NextResponse.redirect(new URL(`/parametres?erreur=${encodeURIComponent('La liaison Discord n’est pas encore activée sur ce serveur.')}#compte`, origin));
  }
  const state = randomBytes(24).toString('base64url');
  (await cookies()).set('clap_discord', JSON.stringify({ state, next }), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600,
  });
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  }).toString();
  return NextResponse.redirect(url);
}
