import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { isHttpsHeaders, publicOrigin } from '@/lib/origin';

// Discord (OAuth2, flux « authorization code », portées « identify email » : pseudo, photo et e-mail vérifié).
// Il faut DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET (discord.com/developers > Applications > OAuth2),
// avec pour redirection autorisée, à l'identique : <adresse du site>/api/auth/discord/callback.
// Connecté : lie le compte Discord. Déconnecté : connexion, ou création d'un compte au nom de Discord.
export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const origin = publicOrigin(request);
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET?.trim()) {
    return NextResponse.redirect(new URL('/connexion?erreur=discord-config', origin));
  }
  // Discord renverra le joueur sur l'adresse publique (APP_URL). Le cookie de vérification doit être posé sur
  // ce même site : si l'on est arrivé par une autre adresse (127.0.0.1 au lieu de localhost…), on y repasse une
  // fois. Le paramètre « via » empêche toute boucle (derrière un proxy, l'hôte vu ici peut rester différent).
  const params = request.nextUrl.searchParams;
  const seenHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? request.headers.get('host') ?? request.nextUrl.host;
  if (!params.has('via') && new URL(origin).host !== seenHost) {
    const again = new URL('/api/auth/discord', origin);
    params.forEach((v, k) => again.searchParams.set(k, v));
    again.searchParams.set('via', '1');
    return NextResponse.redirect(again);
  }
  const state = randomBytes(24).toString('base64url');
  const next = params.get('suite') ?? '';
  const referral = params.get('parrain') ?? '';
  (await cookies()).set('clap_discord', JSON.stringify({ state, next, referral }), {
    // « Secure » seulement si cette page est réellement servie en HTTPS (sinon le cookie serait ignoré).
    httpOnly: true, sameSite: 'lax', secure: isHttpsHeaders(request.headers, request.url), path: '/', maxAge: 600,
  });
  // L'adresse de retour doit être enregistrée À L'IDENTIQUE dans le portail Discord (OAuth2 → Redirects).
  console.info(`[discord] redirect_uri envoyée : ${origin}/api/auth/discord/callback`);
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
