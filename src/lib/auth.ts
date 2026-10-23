import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { transaction } from './db.ts';
import { createPlayer, GameError } from './game.ts';
import { notify } from './notify.ts';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_DAYS = 60;

export type User = {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  playerId: string;
  referralCode: string;
  referredBy: string | null;
  publicProfile: boolean;
  notify: Record<string, boolean>;
  hasPassword: boolean;
  createdAt: number;
};

type UserRow = {
  id: string; name: string; email: string | null; avatar: string | null; player_id: string; referral_code: string;
  referred_by: string | null; public_profile: number; notify: string; password_hash: string | null; created_at: number;
};

function toUser(r: UserRow): User {
  return {
    id: r.id, name: r.name, email: r.email, avatar: r.avatar, playerId: r.player_id, referralCode: r.referral_code,
    referredBy: r.referred_by, publicProfile: r.public_profile === 1, notify: JSON.parse(r.notify) as Record<string, boolean>,
    hasPassword: r.password_hash !== null, createdAt: r.created_at,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Code de parrainage lisible, sans caractères ambigus : « JD-7K4Q ». */
function makeReferralCode(db: DatabaseSync, name: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const prefix = name.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  for (;;) {
    const bytes = randomBytes(4);
    const code = `${prefix}-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
    if (!db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code)) return code;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateName(name: string): string | null {
  if (!/^[\p{L}\p{N}_.-]{3,20}$/u.test(name)) return 'Le pseudo doit faire de 3 à 20 caractères (lettres, chiffres, . _ -).';
  return null;
}

/** Choisit un pseudo libre à partir d'un nom (pour les comptes Google). */
function availableName(db: DatabaseSync, wanted: string): string {
  const base = (wanted.normalize('NFD').replace(/[^\p{L}\p{N}_.-]/gu, '') || 'cinephile').slice(0, 16);
  let name = base.length >= 3 ? base : `${base}clap`;
  for (let i = 2; db.prepare('SELECT 1 FROM users WHERE name = ?').get(name); i++) name = `${base.slice(0, 16)}${i}`;
  return name;
}

function findReferrer(db: DatabaseSync, code: string | undefined): string | null {
  if (!code?.trim()) return null;
  const row = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code.trim().toUpperCase()) as { id: string } | undefined;
  if (!row) throw new GameError('bad-referral', 'Ce code de parrainage n’existe pas.');
  return row.id;
}

function insertUser(
  db: DatabaseSync,
  fields: { name: string; email: string | null; passwordHash: string | null; googleSub?: string | null; avatar?: string | null; referredBy: string | null },
  now: number,
): User {
  const id = randomUUID();
  const player = createPlayer(db, now);
  db.prepare(`INSERT INTO users (id, email, name, password_hash, google_sub, avatar, player_id, referral_code, referred_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, fields.email, fields.name, fields.passwordHash, fields.googleSub ?? null, fields.avatar ?? null,
    player.id, makeReferralCode(db, fields.name), fields.referredBy, now,
  );
  notify(db, id, 'welcome', 'Bienvenue en salle ! Trois bobines vous attendent.', '/bobines', now);
  if (fields.referredBy) {
    notify(db, fields.referredBy, 'referral', `${fields.name} s’est inscrit avec votre code. Plus que ${3} bobines à ouvrir pour valider.`, '/parrainage', now);
  }
  return getUser(db, id)!;
}

export async function signUp(
  db: DatabaseSync,
  input: { name: string; email: string; password: string; referral?: string },
  now = Date.now(),
): Promise<User> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const nameError = validateName(name);
  if (nameError) throw new GameError('bad-name', nameError);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GameError('bad-email', 'Adresse e-mail invalide.');
  if (input.password.length < 8) throw new GameError('weak-password', 'Le mot de passe doit faire au moins 8 caractères.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new GameError('email-taken', 'Un compte existe déjà avec cet e-mail.');
  if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(name)) throw new GameError('name-taken', 'Ce pseudo est déjà pris.');
  const referredBy = findReferrer(db, input.referral);
  const passwordHash = await hashPassword(input.password);
  return transaction(db, () => insertUser(db, { name, email, passwordHash, referredBy }, now));
}

export async function logIn(db: DatabaseSync, emailInput: string, password: string): Promise<User> {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(emailInput)) as UserRow | undefined;
  if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) {
    throw new GameError('bad-credentials', 'E-mail ou mot de passe incorrect.');
  }
  return toUser(row);
}

/** Retrouve ou crée le compte d'un utilisateur Google. */
export function upsertGoogleUser(
  db: DatabaseSync,
  profile: { sub: string; email: string | null; name: string; picture: string | null },
  referral: string | undefined,
  now = Date.now(),
): User {
  return transaction(db, () => {
    const bySub = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(profile.sub) as UserRow | undefined;
    if (bySub) return toUser(bySub);
    const email = profile.email ? normalizeEmail(profile.email) : null;
    const byEmail = email ? (db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined) : undefined;
    if (byEmail) {
      db.prepare('UPDATE users SET google_sub = ?, avatar = COALESCE(avatar, ?) WHERE id = ?').run(profile.sub, profile.picture, byEmail.id);
      return getUser(db, byEmail.id)!;
    }
    let referredBy: string | null = null;
    try {
      referredBy = findReferrer(db, referral);
    } catch {
      referredBy = null;
    }
    return insertUser(db, { name: availableName(db, profile.name), email, passwordHash: null, googleSub: profile.sub, avatar: profile.picture, referredBy }, now);
  });
}

export function getUser(db: DatabaseSync, id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function getUserByName(db: DatabaseSync, name: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE name = ?').get(name.trim()) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function createSession(db: DatabaseSync, userId: string, now = Date.now()): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function userForSession(db: DatabaseSync, token: string, now = Date.now()): User | null {
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as { user_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at < now) return null;
  return getUser(db, row.user_id);
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function updateProfile(db: DatabaseSync, userId: string, fields: { name?: string; publicProfile?: boolean; notify?: Record<string, boolean> }): void {
  if (fields.name !== undefined) {
    const name = fields.name.trim();
    const err = validateName(name);
    if (err) throw new GameError('bad-name', err);
    const taken = db.prepare('SELECT id FROM users WHERE name = ? AND id != ?').get(name, userId);
    if (taken) throw new GameError('name-taken', 'Ce pseudo est déjà pris.');
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
  }
  if (fields.publicProfile !== undefined) db.prepare('UPDATE users SET public_profile = ? WHERE id = ?').run(fields.publicProfile ? 1 : 0, userId);
  if (fields.notify !== undefined) db.prepare('UPDATE users SET notify = ? WHERE id = ?').run(JSON.stringify(fields.notify), userId);
}

/** Supprime un compte et tout ce qui lui appartient. */
export function deleteAccount(db: DatabaseSync, userId: string): void {
  const user = getUser(db, userId);
  if (!user) return;
  transaction(db, () => {
    const p = user.playerId;
    db.prepare("UPDATE listings SET status = 'cancelled' WHERE seller_id = ? AND status = 'open'").run(p);
    db.prepare("UPDATE trades SET status = 'cancelled' WHERE (from_user = ? OR to_user = ?) AND status = 'pending'").run(userId, userId);
    db.prepare('UPDATE users SET referred_by = NULL WHERE referred_by = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?').run(userId, userId);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM trades WHERE from_user = ? OR to_user = ?').run(userId, userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    db.prepare('DELETE FROM owned WHERE player_id = ?').run(p);
    db.prepare('DELETE FROM listings WHERE seller_id = ? OR buyer_id = ?').run(p, p);
    db.prepare('DELETE FROM events WHERE player_id = ?').run(p);
    db.prepare('DELETE FROM mission_claims WHERE player_id = ?').run(p);
    db.prepare('DELETE FROM pulls WHERE player_id = ?').run(p);
    db.prepare('DELETE FROM players WHERE id = ?').run(p);
  });
}
