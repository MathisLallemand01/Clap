import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedCatalog } from '../data/seed.ts';
import type { Card } from './types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('actor', 'role')),
  person_id INTEGER NOT NULL,
  first TEXT NOT NULL,
  last TEXT NOT NULL,
  rarity TEXT NOT NULL,
  tone TEXT NOT NULL,
  image TEXT,
  origin TEXT,
  movie_id INTEGER,
  film TEXT,
  year INTEGER,
  character TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  rank INTEGER,
  votes INTEGER
);
CREATE INDEX IF NOT EXISTS cards_kind_rarity ON cards (kind, rarity);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  tickets INTEGER NOT NULL,
  free_stock INTEGER NOT NULL,
  free_updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pulls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players (id),
  booster_id TEXT NOT NULL,
  paid_with TEXT NOT NULL CHECK (paid_with IN ('free', 'tickets')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS owned (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players (id),
  card_id TEXT NOT NULL REFERENCES cards (id),
  serial INTEGER NOT NULL,
  pull_id INTEGER REFERENCES pulls (id),
  obtained_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS owned_player ON owned (player_id);
CREATE INDEX IF NOT EXISTS owned_card ON owned (card_id);
CREATE INDEX IF NOT EXISTS cards_person ON cards (person_id);
CREATE INDEX IF NOT EXISTS cards_movie ON cards (movie_id);

-- Comptes
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  avatar TEXT,
  player_id TEXT NOT NULL UNIQUE REFERENCES players (id),
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT REFERENCES users (id),
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  public_profile INTEGER NOT NULL DEFAULT 1,
  notify TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- Ce que fait un joueur (pour les missions) : open, rare, trade, trailer, recycle, sell, buy
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players (id),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_player ON events (player_id, kind, created_at);
CREATE TABLE IF NOT EXISTS mission_claims (
  player_id TEXT NOT NULL REFERENCES players (id),
  mission_id TEXT NOT NULL,
  period TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, mission_id, period)
);

-- Le Guichet
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id TEXT NOT NULL REFERENCES players (id),
  owned_id INTEGER NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards (id),
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sold', 'cancelled', 'expired')),
  buyer_id TEXT REFERENCES players (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS listings_open_owned ON listings (owned_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS listings_status ON listings (status, created_at);

-- Amis et échanges
CREATE TABLE IF NOT EXISTS friendships (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user TEXT NOT NULL REFERENCES users (id),
  to_user TEXT NOT NULL REFERENCES users (id),
  give TEXT NOT NULL DEFAULT '[]',
  take TEXT NOT NULL DEFAULT '[]',
  give_tickets INTEGER NOT NULL DEFAULT 0,
  take_tickets INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled', 'failed')),
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  href TEXT,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, created_at);

-- Cache des fiches TMDB (biographies, films, bandes-annonces)
CREATE TABLE IF NOT EXISTS tmdb_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
`;

export type CardRow = {
  id: string; kind: Card['kind']; person_id: number; first: string; last: string; rarity: Card['rarity'];
  tone: string; image: string | null; origin: string | null; movie_id: number | null; film: string | null;
  year: number | null; character: string | null; tags: string; rank?: number | null; votes?: number | null;
};

export function rowToCard(r: CardRow): Card {
  return {
    id: r.id, kind: r.kind, personId: r.person_id, first: r.first, last: r.last, rarity: r.rarity,
    tone: r.tone, image: r.image, origin: r.origin, movieId: r.movie_id, film: r.film, year: r.year,
    character: r.character, tags: JSON.parse(r.tags) as string[], rank: r.rank ?? null, votes: r.votes ?? null,
  };
}

export function upsertCards(db: DatabaseSync, cards: Card[]): void {
  const stmt = db.prepare(`
    INSERT INTO cards (id, kind, person_id, first, last, rarity, tone, image, origin, movie_id, film, year, character, tags, rank, votes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      person_id = excluded.person_id, first = excluded.first, last = excluded.last, rarity = excluded.rarity,
      image = excluded.image, origin = excluded.origin, movie_id = excluded.movie_id, film = excluded.film,
      year = excluded.year, character = excluded.character, tags = excluded.tags, rank = excluded.rank, votes = excluded.votes`);
  transaction(db, () => {
    for (const c of cards) {
      stmt.run(c.id, c.kind, c.personId, c.first, c.last, c.rarity, c.tone, c.image ?? null, c.origin ?? null,
        c.movieId ?? null, c.film ?? null, c.year ?? null, c.character ?? null, JSON.stringify(c.tags), c.rank ?? null, c.votes ?? null);
    }
  });
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Ajoute les colonnes apparues après la création d'une base existante. */
function migrate(db: DatabaseSync): void {
  const columns = new Set((db.prepare('PRAGMA table_info(cards)').all() as { name: string }[]).map((c) => c.name));
  if (!columns.has('rank')) db.exec('ALTER TABLE cards ADD COLUMN rank INTEGER');
  if (!columns.has('votes')) db.exec('ALTER TABLE cards ADD COLUMN votes INTEGER');
}

/** Ouvre (ou crée) une base ; le catalogue de démarrage est inséré si la table est vide. */
export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM cards').get() as { n: number };
  if (n === 0) upsertCards(db, seedCatalog());
  return db;
}

const globalForDb = globalThis as unknown as { clapDb?: DatabaseSync };

/** Base partagée par le serveur (une seule connexion, réutilisée entre rechargements). */
export function getDb(): DatabaseSync {
  const path = process.env.CLAP_DB_PATH
    ? resolve(/* turbopackIgnore: true */ process.env.CLAP_DB_PATH)
    : join(process.cwd(), 'data', 'clap.db');
  globalForDb.clapDb ??= openDb(path);
  return globalForDb.clapDb;
}
