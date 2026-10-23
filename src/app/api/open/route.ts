import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createPlayer, GameError, getPlayer, guestHasOpened, openBoosterFor } from '@/lib/game';
import { currentUser, GUEST_COOKIE } from '@/lib/session';

/**
 * Ouvre une bobine pour le joueur connecté et renvoie les cartes tirées.
 * Un visiteur sans compte peut ouvrir une seule bobine : sa première carte est de la rareté maximale.
 */
export async function POST(request: Request) {
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
