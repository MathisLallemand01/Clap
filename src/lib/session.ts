import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, deleteSession, getUser, SESSION_DAYS, userForSession, type User } from './auth';
import { nextCelebration, type Celebration } from './celebrations';
import { getDb } from './db';
import { adoptGuest, getPlayer, getStats, type Player, type PlayerStats } from './game';
import { claimSeasonReward } from './ranking';
import { recordVisit } from './missions';
import { listNotifications, notify, unreadCount, type Notification } from './notify';

export const SESSION_COOKIE = 'clap_session';
/** Le joueur provisoire d'un visiteur qui a ouvert sa première bobine sans compte. */
export const GUEST_COOKIE = 'clap_guest';

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? userForSession(getDb(), token) : null;
}

/**
 * À appeler depuis une server action ou un route handler. Si le visiteur avait ouvert sa première
 * bobine sans compte, ses cartes rejoignent maintenant sa collection.
 */
export async function startSession(userId: string): Promise<void> {
  const db = getDb();
  const { token } = createSession(db, userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_DAYS * 24 * 3600,
  });
  const guest = jar.get(GUEST_COOKIE)?.value;
  const user = getUser(db, userId);
  if (guest && user) {
    const moved = adoptGuest(db, guest, user.playerId);
    if (moved) notify(db, user.id, 'pull', `Vos ${moved} cartes de la première bobine sont rangées dans votre collection.`, '/collection');
    jar.delete(GUEST_COOKIE);
  }
}

export async function guestPlayerId(): Promise<string | null> {
  return (await cookies()).get(GUEST_COOKIE)?.value ?? null;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(getDb(), token);
  jar.delete(SESSION_COOKIE);
}

export type Wallet = { tickets: number; entries: number; freeStock: number; nextFreeAt: number | null };

export type Context = {
  user: User;
  player: Player;
  stats: PlayerStats;
  wallet: Wallet;
  notifications: Notification[];
  unread: number;
  /** Une bonne nouvelle arrivée pendant l'absence du joueur, à lui montrer en grand. */
  celebration: Celebration | null;
};

function contextFor(user: User): Context | null {
  const db = getDb();
  const player = getPlayer(db, user.playerId);
  if (!player) return null;
  recordVisit(db, player.id);
  claimSeasonReward(db, player.id);
  const stats = getStats(db, player.id);
  return {
    user,
    player,
    stats,
    wallet: { tickets: player.tickets, entries: stats.entries, freeStock: player.freeStock, nextFreeAt: player.nextFreeAt },
    notifications: listNotifications(db, user.id, 10),
    unread: unreadCount(db, user.id),
    celebration: nextCelebration(db, player.id),
  };
}

/** Le contexte du joueur connecté, ou null pour un visiteur. */
export async function optionalContext(): Promise<Context | null> {
  const user = await currentUser();
  return user ? contextFor(user) : null;
}

/** Le contexte du joueur connecté ; les visiteurs sont envoyés vers la connexion puis ramenés ici. */
export async function requireContext(back: string): Promise<Context> {
  const ctx = await optionalContext();
  if (!ctx) redirect(`/connexion?suite=${encodeURIComponent(back)}`);
  return ctx;
}
