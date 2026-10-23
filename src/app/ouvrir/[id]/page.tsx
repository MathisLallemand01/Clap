import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBooster } from '@/lib/boosters';
import { boosterCover } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { requireContext } from '@/lib/session';
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
  await requireContext(`/ouvrir/${id}`);
  return <Projection booster={booster} cover={boosterCover(getDb(), booster)} />;
}
