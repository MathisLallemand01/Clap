import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { countEvents, logEvent } from '@/lib/notify';
import { publicOrigin } from '@/lib/origin';
import { currentUser } from '@/lib/session';

/** La scène post-générique : un lien discret tout en bas du pied de page décerne une distinction secrète. */
export async function GET(request: NextRequest) {
  const user = await currentUser();
  const origin = publicOrigin(request);
  if (!user) return NextResponse.redirect(new URL('/connexion?suite=/palmares', origin));
  const db = getDb();
  if (countEvents(db, user.playerId, 'credits') === 0) logEvent(db, user.playerId, 'credits');
  return NextResponse.redirect(new URL('/palmares', origin));
}
