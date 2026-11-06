import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { isHttpsOrigin, publicOrigin } from '@/lib/origin';

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
  // Le retour de Discord arrive sur l'adresse publique (APP_URL). Si l'on est venu par une autre adresse
  // (127.0.0.1 au lieu de localhost, IP au lieu du domaine…), on y repasse d'abord : sinon le cookie de
  // vérification serait posé sur un autre site que celui du retour, et la connexion échouerait.
  if (new URL(origin).host !== request.nextUrl.host && !request.headers.get('x-forwarded-host')) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, origin));
  }
  const state = randomBytes(24).toString('base64url');
  const next = request.nextUrl.searchParams.get('suite') ?? '';
  const referral = request.nextUrl.searchParams.get('parrain') ?? '';
  (await cookies()).set('clap_discord', JSON.stringify({ state, next, referral }), {
    httpOnly: true, sameSite: 'lax', secure: isHttpsOrigin(origin), path: '/', maxAge: 600,
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
    // Déjà autorisé : Discord ne redemande pas la permission, il renvoie directement.
    prompt: 'none',
  }).toString();
  return NextResponse.redirect(url);
}
