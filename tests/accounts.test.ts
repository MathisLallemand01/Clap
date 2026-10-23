import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AccountError, changePassword, createSession, deleteOtherSessions, deleteSession, hashPassword, isLimited, LIMITS, record, resetLimit,
  SESSION_TTL_MS, sessionPlayer, signIn, signUp, verifyPassword,
} from '../src/lib/accounts.ts';
import { openDb } from '../src/lib/db.ts';
import { SIGNUP_BONUS } from '../src/lib/economy.ts';
import { createPlayer, getCollection, getPlayer, openBoosterFor, STARTING_TICKETS } from '../src/lib/game.ts';

const rejects = (p: Promise<unknown>, field: string | null) =>
  assert.rejects(p, (e: unknown) => e instanceof AccountError && e.field === field);

test('mots de passe : empreinte salée, vérification', async () => {
  const a = await hashPassword('motdepasse');
  const b = await hashPassword('motdepasse');
  assert.notEqual(a, b);
  assert.ok(!a.includes('motdepasse'));
  assert.ok(await verifyPassword('motdepasse', a));
  assert.ok(!(await verifyPassword('motdepassE', a)));
  assert.ok(!(await verifyPassword('x', 'n’importe quoi')));
});

test('l’inscription rattache la partie invitée et verse le bonus', async () => {
  const db = openDb(':memory:');
  const guest = createPlayer(db);
  openBoosterFor(db, guest.id, 'casting');
  const id = await signUp(db, guest.id, { name: '  Cinéphile  ', email: ' Moi@Exemple.FR ', password: 'secret123' });
  assert.equal(id, guest.id);
  const player = getPlayer(db, id)!;
  assert.equal(player.name, 'Cinéphile');
  assert.equal(player.email, 'moi@exemple.fr');
  assert.equal(player.tickets, STARTING_TICKETS + SIGNUP_BONUS);
  assert.equal(getCollection(db, id).reduce((s, c) => s + c.copies, 0), 5);
});

test('inscription : validations et e-mail unique', async () => {
  const db = openDb(':memory:');
  await signUp(db, null, { name: 'Alice', email: 'alice@exemple.fr', password: 'secret123' });
  await rejects(signUp(db, null, { name: 'Alice 2', email: 'ALICE@exemple.fr', password: 'secret123' }), 'email');
  await rejects(signUp(db, null, { name: 'A', email: 'b@exemple.fr', password: 'secret123' }), 'name');
  await rejects(signUp(db, null, { name: 'Bob<script>', email: 'b@exemple.fr', password: 'secret123' }), 'name');
  await rejects(signUp(db, null, { name: 'Bob', email: 'pas-un-email', password: 'secret123' }), 'email');
  await rejects(signUp(db, null, { name: 'Bob', email: 'b@exemple.fr', password: 'court' }), 'password');
});

test('un compte ne peut pas « réclamer » la partie d’un autre compte', async () => {
  const db = openDb(':memory:');
  const alice = await signUp(db, null, { name: 'Alice', email: 'alice@exemple.fr', password: 'secret123' });
  const bob = await signUp(db, alice, { name: 'Bob', email: 'bob@exemple.fr', password: 'secret123' });
  assert.notEqual(bob, alice);
  assert.equal(getPlayer(db, alice)!.email, 'alice@exemple.fr');
});

test('connexion : bon mot de passe seulement, e-mail insensible à la casse', async () => {
  const db = openDb(':memory:');
  const id = await signUp(db, null, { name: 'Alice', email: 'alice@exemple.fr', password: 'secret123' });
  assert.equal(await signIn(db, 'ALICE@exemple.fr ', 'secret123'), id);
  await rejects(signIn(db, 'alice@exemple.fr', 'mauvais!!'), null);
  await rejects(signIn(db, 'inconnu@exemple.fr', 'secret123'), null);
});

test('changer de mot de passe', async () => {
  const db = openDb(':memory:');
  const id = await signUp(db, null, { name: 'Alice', email: 'alice@exemple.fr', password: 'secret123' });
  await rejects(changePassword(db, id, 'faux-faux', 'nouveau123'), 'password');
  await changePassword(db, id, 'secret123', 'nouveau123');
  assert.equal(await signIn(db, 'alice@exemple.fr', 'nouveau123'), id);
  await rejects(signIn(db, 'alice@exemple.fr', 'secret123'), null);
});

test('sessions : jeton opaque, expiration, déconnexion des autres appareils', () => {
  const db = openDb(':memory:');
  const { id } = createPlayer(db);
  const now = 1_000_000;
  const a = createSession(db, id, now);
  const b = createSession(db, id, now);
  assert.equal(sessionPlayer(db, a, now + 1000), id);
  assert.equal(sessionPlayer(db, 'inventé', now), null);
  const stored = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
  assert.ok(stored.every((s) => s.token_hash !== a && s.token_hash !== b), 'le jeton n’est pas stocké en clair');
  assert.equal(sessionPlayer(db, a, now + SESSION_TTL_MS), null, 'session expirée');
  deleteOtherSessions(db, id, b);
  assert.equal(sessionPlayer(db, b, now), id);
  deleteSession(db, b);
  assert.equal(sessionPlayer(db, b, now), null);
});

test('limite de tentatives : seuls les événements comptés bloquent, puis la fenêtre se réinitialise', () => {
  const now = 5_000;
  const limit = LIMITS.loginPerEmail;
  for (let i = 0; i < limit.max - 1; i++) record('test:x', limit, now);
  assert.ok(!isLimited('test:x', limit, now));
  record('test:x', limit, now);
  assert.ok(isLimited('test:x', limit, now));
  assert.ok(!isLimited('test:x', limit, now + limit.windowMs), 'la fenêtre se réinitialise');
  resetLimit('test:x');
  assert.ok(!isLimited('test:x', limit, now));
  assert.ok(!isLimited('test:autre', limit, now));
});

test('une base de la première version est migrée sans perte', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { mkdtempSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const path = join(mkdtempSync(join(tmpdir(), 'clap-')), 'v1.db');
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE players (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, tickets INTEGER NOT NULL,
    free_stock INTEGER NOT NULL, free_updated_at INTEGER NOT NULL);
    INSERT INTO players VALUES ('ancien', 1, 777, 2, 1);`);
  old.close();
  const db = openDb(path);
  const player = getPlayer(db, 'ancien')!;
  assert.equal(player.tickets, 777);
  assert.equal(player.email, null);
  const id = await signUp(db, 'ancien', { name: 'Ancien', email: 'ancien@exemple.fr', password: 'secret123' });
  assert.equal(id, 'ancien');
  assert.equal(getPlayer(db, 'ancien')!.tickets, 777 + SIGNUP_BONUS);
});
