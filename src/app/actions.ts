'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { markCelebrationSeen } from '@/lib/celebrations';
import { markAllRead } from '@/lib/notify';
import { currentUser, endSession } from '@/lib/session';

export async function logout(): Promise<void> {
  await endSession();
  redirect('/');
}

export async function readNotifications(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  markAllRead(getDb(), user.id);
  revalidatePath('/', 'layout');
}

export async function dismissCelebration(id: number): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  markCelebrationSeen(getDb(), user.playerId, id);
}
