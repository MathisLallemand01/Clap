import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createPlayer, GameError, getPlayer, guestHasOpened, openBoosterFor } from '@/lib/game';
import { clientIp, rateLimit, waitText } from '@/lib/security';
import { currentUser, GUEST_COOKIE } from '@/lib/session';

/**
 * Ouvre une bobine pour le joueur connecté et renvoie les cartes tirées.
 * Un visiteur sans compte peut ouvrir une seule bobine : sa première carte est de la rareté maximale.
 */
export async function POST(request: Request) {
  // Seul le site lui-même peut ouvrir une bobine (pas un formulaire posté depuis un autre site).
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host) {
    let originHost: string | null = null;
    try { originHost = new URL(origin).host; } catch { originHost = null; }
    if (originHost !== host) return NextResponse.json({ error: 'Origine refusée.' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { boosterId?: unknown } | null;
  if (typeof body?.boosterId !== 'string') {
    return NextResponse.json({ error: 'Bobine manquante.' }, { status: 400 });
  }
  const db = getDb();
  const user = await currentUser();
  try {
    if (user) return NextResponse.json({ ...openBoosterFor(db, user.playerId, body.boosterId), guest: false });

    const jar = await cookies();
    let guestId = jar.get(GUEST_COOKIE)?.value;
    if (guestId && !getPlayer(db, guestId)) guestId = undefined;
    if (guestId && guestHasOpened(db, guestId)) {
      return NextResponse.json({ error: 'Créez un compte pour garder vos cartes et ouvrir d’autres bobines.', code: 'guest-used' }, { status: 401 });
    }
    if (!guestId) {
      // Une bobine offerte par visiteur : on limite les nouveaux visiteurs par adresse (cookies effacés en boucle).
      const wait = rateLimit(`guest:ip:${clientIp(request.headers)}`, 3, 24 * 60 * 60_000);
      if (wait) return NextResponse.json({ error: `Créez un compte pour ouvrir d’autres bobines (réessayez dans ${waitText(wait)}).`, code: 'guest-used' }, { status: 429 });
      guestId = createPlayer(db).id;
      jar.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 24 * 3600 });
    }
    return NextResponse.json({ ...openBoosterFor(db, guestId, body.boosterId, { topFirst: true }), guest: true });
  } catch (err) {
    if (err instanceof GameError) {
      const status = err.code === 'not-enough-tickets' ? 402 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
