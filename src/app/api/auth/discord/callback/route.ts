import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { linkDiscord, upsertDiscordUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { currentUser, startSession } from '@/lib/session';

type Pending = { state: string; next: string; referral?: string };
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; email?: string | null; verified?: boolean };

export async function GET(request: NextRequest) {
  const origin = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/+$/, '');
  const user = await currentUser();
  // Une erreur ramène là d'où l'on vient : les paramètres (liaison) ou la page de connexion.
  const fail = (code: string, message?: string) => NextResponse.redirect(new URL(
    user ? `/parametres?erreur=${encodeURIComponent(message ?? 'La liaison avec Discord a échoué. Réessayez.')}#compte` : `/connexion?erreur=${code}`,
    origin,
  ));
  const jar = await cookies();
  const raw = jar.get('clap_discord')?.value;
  jar.delete('clap_discord');
  const params = request.nextUrl.searchParams;
  if (params.get('error')) return fail('discord-refus', 'Liaison annulée sur Discord.');
  let pending: Pending;
  try {
    pending = JSON.parse(raw ?? '') as Pending;
  } catch {
    return fail('discord');
  }
  const code = params.get('code');
  if (!code || pending.state !== params.get('state')) return fail('discord');

  let profile: DiscordUser;
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.DISCORD_CLIENT_ID!.trim(),
        client_secret: process.env.DISCORD_CLIENT_SECRET!.trim(),
        redirect_uri: `${origin}/api/auth/discord/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      // Le plus souvent : secret erroné ou redirection qui ne correspond pas exactement à celle du portail.
      console.error('[discord] échange du code refusé', tokenRes.status, await tokenRes.text());
      return fail('discord-cle', 'Discord a refusé la connexion : vérifiez DISCORD_CLIENT_SECRET et la redirection dans le portail Discord.');
    }
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const meRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!meRes.ok) {
      console.error('[discord] profil illisible', meRes.status, await meRes.text());
      return fail('discord');
    }
    profile = (await meRes.json()) as DiscordUser;
  } catch (err) {
    console.error('[discord] Discord injoignable', err);
    return fail('discord');
  }

  const db = getDb();
  const name = profile.global_name || profile.username;
  const safeNext = (fallback: string) => (pending.next.startsWith('/') && !pending.next.startsWith('//') ? pending.next : fallback);
  if (!user) {
    const signed = upsertDiscordUser(db, { id: profile.id, name, avatar: profile.avatar ?? null, email: profile.verified ? (profile.email ?? null) : null }, pending.referral || undefined);
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
