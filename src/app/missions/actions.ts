'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { GameError } from '@/lib/game';
import { claimMission } from '@/lib/missions';
import { currentUser } from '@/lib/session';

export async function claimAction(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect('/connexion?suite=/missions');
  let reward = 0;
  try {
    reward = claimMission(getDb(), user.playerId, String(form.get('mission')));
  } catch (err) {
    if (err instanceof GameError) redirect(`/missions?erreur=${encodeURIComponent(err.message)}`);
    throw err;
  }
  redirect(`/missions?gain=${reward}`);
}

/** Version sans rechargement, pour l'animation de récompense : renvoie le gain ou l'erreur. */
export async function claimMissionNow(missionId: string): Promise<{ reward?: number; error?: string }> {
  const user = await currentUser();
  if (!user) return { error: 'Connectez-vous pour récupérer vos récompenses.' };
  try {
    return { reward: claimMission(getDb(), user.playerId, missionId) };
  } catch (err) {
    if (err instanceof GameError) return { error: err.message };
    throw err;
  }
}
