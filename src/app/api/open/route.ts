import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GameError, openBoosterFor } from '@/lib/game';
import { ensurePlayer } from '@/lib/session';

/** Ouvre une bobine pour le joueur courant et renvoie les cartes tirées. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { boosterId?: unknown } | null;
  if (typeof body?.boosterId !== 'string') {
    return NextResponse.json({ error: 'Bobine manquante.' }, { status: 400 });
  }
  const player = await ensurePlayer();
  try {
    return NextResponse.json(openBoosterFor(getDb(), player.id, body.boosterId));
  } catch (err) {
    if (err instanceof GameError) {
      const status = err.code === 'not-enough-tickets' ? 402 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
