import 'server-only';
import { cookies } from 'next/headers';
import { createSession, deleteSession, SESSION_TTL_MS, sessionPlayer } from './accounts';
import { getDb } from './db';
import { FREE_BOOSTER_CAP } from './boosters';
import { dailyAvailable } from './economy';
import { createPlayer, getPlayer, getStats, STARTING_TICKETS, type Player, type PlayerStats } from './game';

// Chaque visiteur qui ouvre une bobine reçoit un joueur invité ; créer un compte rattache ce joueur
// à un e-mail. Dans les deux cas, le cookie porte un jeton de session (voir lib/accounts.ts).
export const SESSION_COOKIE = 'clap_sid';
/** Ancien cookie (identifiant du joueur invité en clair), migré vers une session à la première action. */
const LEGACY_COOKIE = 'clap_pid';

type Jar = Awaited<ReturnType<typeof cookies>>;

function setSessionCookie(jar: Jar, token: string): void {
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.CLAP_INSECURE_COOKIES !== '1',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  });
}

/** L'identifiant du joueur courant d'après les cookies, sans rien écrire. */
function playerIdFrom(jar: Jar): string | null {
  const db = getDb();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const id = sessionPlayer(db, token);
    if (id) return id;
  }
  // Un ancien cookie invité reste lisible tant qu'il désigne un joueur sans compte.
  const legacy = jar.get(LEGACY_COOKIE)?.value;
  if (legacy && getPlayer(db, legacy)?.email === null) return legacy;
  return null;
}

/** Le joueur courant, ou null pour un visiteur qui n'a encore rien ouvert. */
export async function currentPlayer(): Promise<Player | null> {
  const id = playerIdFrom(await cookies());
  return id ? getPlayer(getDb(), id) : null;
}

/** Le joueur courant, créé s'il n'existe pas. À appeler depuis un route handler ou une server action. */
export async function ensurePlayer(): Promise<Player> {
  const jar = await cookies();
  const db = getDb();
  const id = playerIdFrom(jar);
  const player = (id && getPlayer(db, id)) || createPlayer(db);
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || sessionPlayer(db, token) !== player.id) startSession(jar, player.id);
  return player;
}

function startSession(jar: Jar, playerId: string): void {
  const old = jar.get(SESSION_COOKIE)?.value;
  if (old) deleteSession(getDb(), old);
  setSessionCookie(jar, createSession(getDb(), playerId));
  if (jar.get(LEGACY_COOKIE)) jar.delete(LEGACY_COOKIE);
}

/** Ouvre une session pour ce joueur (après inscription ou connexion). */
export async function logIn(playerId: string): Promise<void> {
  startSession(await cookies(), playerId);
}

/** Ferme la session en cours ; le visiteur redevient anonyme. */
export async function logOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(getDb(), token);
  jar.delete(SESSION_COOKIE);
  jar.delete(LEGACY_COOKIE);
}

/** Le jeton de la session en cours (pour garder cette session quand on ferme les autres). */
export async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export type Wallet = {
  tickets: number;
  entries: number;
  freeStock: number;
  nextFreeAt: number | null;
  /** Pseudo du compte, null pour un invité ou un visiteur. */
  name: string | null;
  dailyAvailable: boolean;
};

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
      name: player?.name ?? null,
      dailyAvailable: dailyAvailable(player?.lastDaily ?? null),
    },
  };
}
