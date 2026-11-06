import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getBooster } from '@/lib/boosters';
import { boosterCover } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { guestHasOpened } from '@/lib/game';
import { guestPlayerId, optionalContext } from '@/lib/session';
import { affordable } from '@/lib/limits';
import { Projection } from './Projection';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const booster = getBooster((await params).id);
  return { title: booster ? `Projection · ${booster.name}` : 'Projection' };
}

export default async function OpenPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { n } = await searchParams;
  const booster = getBooster(id);
  if (!booster) notFound();
  const db = getDb();
  const ctx = await optionalContext();
  // Sans compte : une seule bobine, offerte, puis il faut créer un compte pour garder les cartes.
  if (!ctx) {
    const guest = await guestPlayerId();
    if (guest && guestHasOpened(db, guest)) redirect('/connexion?mode=inscription&suite=/collection&garder=1');
  }
  // Premier paquet du compte (ou du visiteur) : le tutoriel passe avant tout.
  const firstOpen = ctx ? ctx.stats.pulls === 0 : true;
  // ?n=5, ?n=10, ?n=tout : plusieurs bobines d'un coup (limité à ce que le joueur peut payer).
  const can = ctx ? affordable({ freeStock: ctx.player.freeStock, tickets: ctx.player.tickets, unlimited: ctx.player.unlimited }, booster.price) : 1;
  const wanted = n === 'tout' ? can : Number(n) || 1;
  const initialCount = ctx ? Math.max(1, Math.min(can || 1, wanted)) : 1;
  return (
    <Projection
      booster={booster} cover={boosterCover(db, booster)} guest={!ctx} firstOpen={firstOpen} initialCount={initialCount}
      wallet={ctx ? { freeStock: ctx.player.freeStock, tickets: ctx.player.tickets, unlimited: ctx.player.unlimited } : undefined}
      initialPity={ctx?.player.pity}
    />
  );
}
