import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getUserByDiscord, linkDiscord } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { currentUser, startSession } from '@/lib/session';

type Pending = { state: string; next: string };
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };

export async function GET(request: NextRequest) {
  const origin = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/+$/, '');
  const fail = (message = 'La liaison avec Discord a échoué. Réessayez.') =>
    NextResponse.redirect(new URL(`/parametres?erreur=${encodeURIComponent(message)}#compte`, origin));
  const jar = await cookies();
  const raw = jar.get('clap_discord')?.value;
  jar.delete('clap_discord');
  const code = request.nextUrl.searchParams.get('code');
  let pending: Pending;
  try {
    pending = JSON.parse(raw ?? '') as Pending;
  } catch {
    return fail();
  }
  if (!code || pending.state !== request.nextUrl.searchParams.get('state')) return fail();

  let profile: DiscordUser;
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/discord/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail();
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const meRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!meRes.ok) return fail();
    profile = (await meRes.json()) as DiscordUser;
  } catch {
    return fail();
  }

  const db = getDb();
  const user = await currentUser();
  if (!user) {
    // Déconnecté : connexion avec un compte Discord déjà lié.
    const linked = getUserByDiscord(db, profile.id);
    if (!linked) return NextResponse.redirect(new URL('/connexion?erreur=discord', origin));
    await startSession(linked.id);
    return NextResponse.redirect(new URL('/bobines', origin));
  }
  try {
    linkDiscord(db, user.id, { id: profile.id, name: profile.global_name || profile.username, avatar: profile.avatar ?? null });
  } catch (err) {
    if (err instanceof GameError) return fail(err.message);
    throw err;
  }
  const next = pending.next.startsWith('/') && !pending.next.startsWith('//') ? pending.next : '/parametres#compte';
  return NextResponse.redirect(new URL(next.includes('?') ? next : next.replace(/(#|$)/, '?ok=discord$1'), origin));
}
