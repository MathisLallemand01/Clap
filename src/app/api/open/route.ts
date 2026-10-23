import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GameError, openBoosterFor } from '@/lib/game';
import { currentUser } from '@/lib/session';

/** Ouvre une bobine pour le joueur connecté et renvoie les cartes tirées. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Connectez-vous pour ouvrir une bobine.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { boosterId?: unknown } | null;
  if (typeof body?.boosterId !== 'string') {
    return NextResponse.json({ error: 'Bobine manquante.' }, { status: 400 });
  }
  try {
    return NextResponse.json(openBoosterFor(getDb(), user.playerId, body.boosterId));
  } catch (err) {
    if (err instanceof GameError) {
      const status = err.code === 'not-enough-tickets' ? 402 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
