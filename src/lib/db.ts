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
  tags TEXT NOT NULL DEFAULT '[]'
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
`;

type CardRow = {
  id: string; kind: Card['kind']; person_id: number; first: string; last: string; rarity: Card['rarity'];
  tone: string; image: string | null; origin: string | null; movie_id: number | null; film: string | null;
  year: number | null; character: string | null; tags: string;
};

export function rowToCard(r: CardRow): Card {
  return {
    id: r.id, kind: r.kind, personId: r.person_id, first: r.first, last: r.last, rarity: r.rarity,
    tone: r.tone, image: r.image, origin: r.origin, movieId: r.movie_id, film: r.film, year: r.year,
    character: r.character, tags: JSON.parse(r.tags) as string[],
  };
}

export function upsertCards(db: DatabaseSync, cards: Card[]): void {
  const stmt = db.prepare(`
    INSERT INTO cards (id, kind, person_id, first, last, rarity, tone, image, origin, movie_id, film, year, character, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      person_id = excluded.person_id, first = excluded.first, last = excluded.last, rarity = excluded.rarity,
      image = excluded.image, origin = excluded.origin, movie_id = excluded.movie_id, film = excluded.film,
      year = excluded.year, character = excluded.character, tags = excluded.tags`);
  transaction(db, () => {
    for (const c of cards) {
      stmt.run(c.id, c.kind, c.personId, c.first, c.last, c.rarity, c.tone, c.image ?? null, c.origin ?? null,
        c.movieId ?? null, c.film ?? null, c.year ?? null, c.character ?? null, JSON.stringify(c.tags));
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

/** Ouvre (ou crée) une base ; le catalogue de démarrage est inséré si la table est vide. */
export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
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
