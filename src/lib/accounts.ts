// Comptes (e-mail + mot de passe) et sessions. Tout joueur, invité ou non, est identifié par une
// session : le cookie porte un jeton aléatoire, la base n'en garde que l'empreinte SHA-256.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './db.ts';
import { grantSignupBonus } from './economy.ts';
import { createPlayer } from './game.ts';

export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export class AccountError extends Error {
  readonly field: 'email' | 'password' | 'name' | null;
  constructor(message: string, field: AccountError['field'] = null) {
    super(message);
    this.field = field;
  }
}

// --- Mots de passe -----------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${(await derive(password, salt)).toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Empreinte factice : une connexion avec un e-mail inconnu prend le même temps qu'avec un mauvais mot de passe.
const DUMMY = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);

// --- Validation --------------------------------------------------------------------------------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateSignup(input: { name: string; email: string; password: string }): { name: string; email: string; password: string } {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const email = normalizeEmail(input.email);
  if (name.length < 2 || name.length > 24) throw new AccountError('Le pseudo fait entre 2 et 24 caractères.', 'name');
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(name)) throw new AccountError('Le pseudo ne peut contenir que des lettres, chiffres, espaces et . _ \' -', 'name');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountError('Adresse e-mail invalide.', 'email');
  if (input.password.length < 8) throw new AccountError('Le mot de passe fait au moins 8 caractères.', 'password');
  if (input.password.length > 200) throw new AccountError('Le mot de passe est trop long.', 'password');
  return { name, email, password: input.password };
}

// --- Inscription et connexion ------------------------------------------------------------------

/**
 * Crée un compte. Si le visiteur jouait déjà en invité (`guestId`), sa partie (cartes, tickets,
 * bobines) devient celle du compte ; sinon un nouveau joueur est créé. Le bonus de bienvenue est versé.
 */
export async function signUp(
  db: DatabaseSync,
  guestId: string | null,
  input: { name: string; email: string; password: string },
  now = Date.now(),
): Promise<string> {
  const { name, email, password } = validateSignup(input);
  const hash = await hashPassword(password);
  return transaction(db, () => {
    if (db.prepare('SELECT 1 FROM players WHERE email = ?').get(email)) {
      throw new AccountError('Un compte existe déjà avec cette adresse. Connectez-vous.', 'email');
    }
    const guest = guestId
      ? (db.prepare('SELECT id FROM players WHERE id = ? AND email IS NULL').get(guestId) as { id: string } | undefined)
      : undefined;
    const playerId = guest?.id ?? createPlayer(db, now).id;
    db.prepare('UPDATE players SET email = ?, password_hash = ?, name = ? WHERE id = ?').run(email, hash, name, playerId);
    grantSignupBonus(db, playerId, now);
    return playerId;
  });
}

/** Vérifie e-mail et mot de passe ; renvoie l'identifiant du joueur. */
export async function signIn(db: DatabaseSync, email: string, password: string): Promise<string> {
  const row = db.prepare('SELECT id, password_hash FROM players WHERE email = ?').get(normalizeEmail(email)) as
    | { id: string; password_hash: string }
    | undefined;
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY);
  if (!row || !ok) throw new AccountError('E-mail ou mot de passe incorrect.');
  return row.id;
}

export async function changePassword(db: DatabaseSync, playerId: string, current: string, next: string): Promise<void> {
  const row = db.prepare('SELECT password_hash FROM players WHERE id = ?').get(playerId) as { password_hash: string | null } | undefined;
  if (!row?.password_hash || !(await verifyPassword(current, row.password_hash))) {
    throw new AccountError('Mot de passe actuel incorrect.', 'password');
  }
  if (next.length < 8) throw new AccountError('Le nouveau mot de passe fait au moins 8 caractères.', 'password');
  const hash = await hashPassword(next);
  db.prepare('UPDATE players SET password_hash = ? WHERE id = ?').run(hash, playerId);
}

// --- Sessions ----------------------------------------------------------------------------------

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(db: DatabaseSync, playerId: string, now = Date.now()): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, player_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(digest(token), playerId, now, now + SESSION_TTL_MS);
  return token;
}

/** Le joueur d'une session valide, ou null (session inconnue ou expirée). */
export function sessionPlayer(db: DatabaseSync, token: string, now = Date.now()): string | null {
  const row = db.prepare('SELECT player_id, expires_at FROM sessions WHERE token_hash = ?').get(digest(token)) as
    | { player_id: string; expires_at: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at <= now) {
    deleteSession(db, token);
    return null;
  }
  return row.player_id;
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
}

/** Ferme toutes les sessions d'un joueur sauf (éventuellement) celle en cours. */
export function deleteOtherSessions(db: DatabaseSync, playerId: string, keepToken?: string): void {
  db.prepare('DELETE FROM sessions WHERE player_id = ? AND token_hash <> ?').run(playerId, keepToken ? digest(keepToken) : '');
}

// --- Limitation des tentatives -----------------------------------------------------------------
// Seuls les échecs de connexion comptent (une box ou un lycée partagent la même adresse IP) ;
// pour l'inscription, ce sont les comptes créés.

const counters = new Map<string, { count: number; resetAt: number }>();

export const LIMITS = {
  loginPerEmail: { max: 8, windowMs: 15 * 60 * 1000 },
  loginPerIp: { max: 50, windowMs: 15 * 60 * 1000 },
  signupPerIp: { max: 20, windowMs: 60 * 60 * 1000 },
} as const;

type Limit = (typeof LIMITS)[keyof typeof LIMITS];

/** Vrai si la clé (e-mail, adresse IP) a atteint sa limite dans la fenêtre en cours. */
export function isLimited(key: string, limit: Limit, now = Date.now()): boolean {
  const entry = counters.get(key);
  return !!entry && entry.resetAt > now && entry.count >= limit.max;
}

/** Compte un événement (échec de connexion, compte créé) pour une clé. */
export function record(key: string, limit: Limit, now = Date.now()): void {
  const entry = counters.get(key);
  if (!entry || entry.resetAt <= now) counters.set(key, { count: 1, resetAt: now + limit.windowMs });
  else entry.count += 1;
}

export function resetLimit(key: string): void {
  counters.delete(key);
}
