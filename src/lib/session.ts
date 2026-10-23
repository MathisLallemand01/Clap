import 'server-only';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { FREE_BOOSTER_CAP } from './boosters';
import { createPlayer, getPlayer, getStats, STARTING_TICKETS, type Player, type PlayerStats } from './game';

// En attendant les comptes (connexion Google / Apple / e-mail), chaque visiteur
// reçoit un joueur invité identifié par un cookie.
export const PLAYER_COOKIE = 'clap_pid';
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Le joueur courant, ou null pour un visiteur qui n'a encore rien ouvert. */
export async function currentPlayer(): Promise<Player | null> {
  const id = (await cookies()).get(PLAYER_COOKIE)?.value;
  return id ? getPlayer(getDb(), id) : null;
}

/** Le joueur courant, créé s'il n'existe pas. À appeler depuis un route handler ou une server action. */
export async function ensurePlayer(): Promise<Player> {
  const jar = await cookies();
  const existing = jar.get(PLAYER_COOKIE)?.value;
  const db = getDb();
  const player = (existing && getPlayer(db, existing)) || createPlayer(db);
  if (player.id !== existing) {
    jar.set(PLAYER_COOKIE, player.id, { httpOnly: true, sameSite: 'lax', maxAge: ONE_YEAR, path: '/' });
  }
  return player;
}

export type Wallet = { tickets: number; entries: number; freeStock: number; nextFreeAt: number | null };

/** Ce qu'affiche la barre de navigation ; un visiteur voit les valeurs de départ. */
export async function currentWallet(): Promise<{ player: Player | null; stats: PlayerStats | null; wallet: Wallet }> {
  const player = await currentPlayer();
  const stats = player ? getStats(getDb(), player.id) : null;
  return {
    player,
    stats,
    wallet: {
      tickets: player?.tickets ?? STARTING_TICKETS,
      entries: stats?.entries ?? 0,
      freeStock: player?.freeStock ?? FREE_BOOSTER_CAP,
      nextFreeAt: player?.nextFreeAt ?? null,
    },
  };
}
