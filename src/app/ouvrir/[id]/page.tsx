import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getBooster } from '@/lib/boosters';
import { boosterCover } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { guestHasOpened } from '@/lib/game';
import { guestPlayerId, optionalContext } from '@/lib/session';
import { Projection } from './Projection';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const booster = getBooster((await params).id);
  return { title: booster ? `Projection · ${booster.name}` : 'Projection' };
}

export default async function OpenPage({ params }: Props) {
  const { id } = await params;
  const booster = getBooster(id);
  if (!booster) notFound();
  const db = getDb();
  const ctx = await optionalContext();
  // Sans compte : une seule bobine, offerte, puis il faut créer un compte pour garder les cartes.
  if (!ctx) {
    const guest = await guestPlayerId();
    if (guest && guestHasOpened(db, guest)) redirect('/connexion?mode=inscription&suite=/collection&garder=1');
  }
  return <Projection booster={booster} cover={boosterCover(db, booster)} guest={!ctx} />;
}
