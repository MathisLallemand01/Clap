import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { publicOrigin } from '@/lib/origin';
import { linkDiscord, upsertDiscordUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { safePath } from '@/lib/security';
import { currentUser, signupOrigin, startSession } from '@/lib/session';

type Pending = { state: string; next: string; referral?: string };
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; email?: string | null; verified?: boolean };

/** Discord peut répondre lentement : au-delà, on abandonne proprement au lieu de laisser la page tourner. */
const TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const user = await currentUser();
  // Une erreur ramène là d'où l'on vient : les paramètres (liaison) ou la page de connexion.
  const fail = (code: string, message: string) => NextResponse.redirect(new URL(
    user ? `/parametres?erreur=${encodeURIComponent(message)}#compte` : `/connexion?erreur=${code}`,
    origin,
  ));
  const jar = await cookies();
  const raw = jar.get('clap_discord')?.value;
  jar.delete('clap_discord');
  const params = request.nextUrl.searchParams;
  const refused = params.get('error');
  if (refused) {
    // access_denied : l'utilisateur a cliqué « Annuler » ; le reste vient d'une mauvaise configuration.
    if (refused !== 'access_denied') console.error('[discord] refus à l’autorisation', refused, params.get('error_description'));
    return refused === 'access_denied'
      ? fail('discord-refus', 'Liaison annulée sur Discord.')
      : fail('discord-cle', 'Discord a refusé la demande : vérifiez la redirection enregistrée dans le portail Discord.');
  }
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const secret = process.env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return fail('discord-config', 'La connexion Discord n’est pas configurée sur ce serveur.');

  let pending: Pending | null = null;
  try {
    pending = JSON.parse(raw ?? '') as Pending;
  } catch {
    pending = null;
  }
  // Cookie absent : la page a mis plus de 10 minutes, ou l'on est revenu sur une autre adresse que celle de départ.
  if (!pending) return fail('discord-expire', 'La connexion Discord a expiré. Réessayez.');
  const code = params.get('code');
  if (!code || pending.state !== params.get('state')) return fail('discord-expire', 'La connexion Discord a expiré. Réessayez.');

  let profile: DiscordUser;
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: secret,
        redirect_uri: `${origin}/api/auth/discord/callback`,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('[discord] échange du code refusé', tokenRes.status, body);
      if (tokenRes.status === 429) return fail('discord-lent', 'Discord est saturé pour le moment. Réessayez dans une minute.');
      // invalid_grant : code déjà utilisé (page rechargée, double clic) ou redirection différente de celle du départ.
      if (body.includes('invalid_grant')) return fail('discord-expire', 'La connexion Discord a expiré. Réessayez.');
      return fail('discord-cle', 'Discord a refusé la connexion : vérifiez DISCORD_CLIENT_SECRET et la redirection dans le portail Discord.');
    }
    const { access_token, token_type } = (await tokenRes.json()) as { access_token: string; token_type?: string };
    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${token_type ?? 'Bearer'} ${access_token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!meRes.ok) {
      console.error('[discord] profil illisible', meRes.status, await meRes.text());
      return fail('discord', 'La liaison avec Discord a échoué. Réessayez.');
    }
    profile = (await meRes.json()) as DiscordUser;
  } catch (err) {
    console.error('[discord] Discord injoignable', err);
    return fail('discord-lent', 'Discord ne répond pas pour le moment. Réessayez dans un instant.');
  }

  const db = getDb();
  const name = (profile.global_name || profile.username || 'cinephile').slice(0, 32);
  const safeNext = (fallback: string) => safePath(pending.next, fallback);
  if (!user) {
    let signed;
    try {
      signed = upsertDiscordUser(db, { id: profile.id, name, avatar: profile.avatar ?? null, email: profile.verified ? (profile.email ?? null) : null }, pending.referral || undefined, Date.now(), await signupOrigin());
    } catch (err) {
      // Compte refusé (une machine = un compte, 5 comptes par adresse) : on dit pourquoi.
      if (err instanceof GameError) return NextResponse.redirect(new URL(`/connexion?erreur=${err.code}`, origin));
      throw err;
    }
    await startSession(signed.id);
    return NextResponse.redirect(new URL(safeNext('/bobines'), origin));
  }
  try {
    linkDiscord(db, user.id, { id: profile.id, name, avatar: profile.avatar ?? null });
  } catch (err) {
    if (err instanceof GameError) return fail('discord', err.message);
    throw err;
  }
  const next = safeNext('/parametres#compte');
  return NextResponse.redirect(new URL(next.includes('?') ? next : next.replace(/(#|$)/, '?ok=discord$1'), origin));
}
