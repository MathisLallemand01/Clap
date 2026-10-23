import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBooster } from '@/lib/boosters';
import { Projection } from './Projection';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const booster = getBooster((await params).id);
  return { title: booster ? `Projection · ${booster.name}` : 'Projection' };
}

export default async function OpenPage({ params }: Props) {
  const booster = getBooster((await params).id);
  if (!booster) notFound();
  return <Projection booster={booster} />;
}
