import type { DatabaseSync } from 'node:sqlite';
import { rowToCard, transaction } from './db.ts';
import { RARITIES } from './rarity.ts';
import type { Card } from './types.ts';

/** Fiche d'un acteur (remplie par l'import TMDB ; absente pour le catalogue de démarrage). */
export type Person = {
  id: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  image: string | null;
  notoriety: number;
};

/** Fiche d'un film, avec la clé YouTube de sa bande-annonce. */
export type Movie = {
  id: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  runtime: number | null;
  genres: string[];
  countries: string[];
  director: string | null;
  trailer: string | null;
  voteAverage: number | null;
  voteCount: number | null;
};

type PersonRow = {
  id: number; name: string; biography: string | null; birthday: string | null; deathday: string | null;
  place_of_birth: string | null; image: string | null; notoriety: number;
};
type MovieRow = {
  id: number; title: string; original_title: string | null; year: number | null; overview: string | null;
  poster: string | null; backdrop: string | null; runtime: number | null; genres: string; countries: string;
  director: string | null; trailer: string | null; vote_average: number | null; vote_count: number | null;
};
type CardRow = Parameters<typeof rowToCard>[0];

export function upsertPeople(db: DatabaseSync, people: Person[]): void {
  const stmt = db.prepare(`
    INSERT INTO people (id, name, biography, birthday, deathday, place_of_birth, image, notoriety)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, biography = excluded.biography, birthday = excluded.birthday,
      deathday = excluded.deathday, place_of_birth = excluded.place_of_birth, image = excluded.image, notoriety = excluded.notoriety`);
  transaction(db, () => {
    for (const p of people) stmt.run(p.id, p.name, p.biography, p.birthday, p.deathday, p.placeOfBirth, p.image, p.notoriety);
  });
}

export function upsertMovies(db: DatabaseSync, movies: Movie[]): void {
  const stmt = db.prepare(`
    INSERT INTO movies (id, title, original_title, year, overview, poster, backdrop, runtime, genres, countries, director, trailer, vote_average, vote_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET title = excluded.title, original_title = excluded.original_title, year = excluded.year,
      overview = excluded.overview, poster = excluded.poster, backdrop = excluded.backdrop, runtime = excluded.runtime,
      genres = excluded.genres, countries = excluded.countries, director = excluded.director, trailer = excluded.trailer,
      vote_average = excluded.vote_average, vote_count = excluded.vote_count`);
  transaction(db, () => {
    for (const m of movies) {
      stmt.run(m.id, m.title, m.originalTitle, m.year, m.overview, m.poster, m.backdrop, m.runtime, JSON.stringify(m.genres),
        JSON.stringify(m.countries), m.director, m.trailer, m.voteAverage, m.voteCount);
    }
  });
}

export function getPerson(db: DatabaseSync, id: number): Person | null {
  const r = db.prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow | undefined;
  return r
    ? { id: r.id, name: r.name, biography: r.biography, birthday: r.birthday, deathday: r.deathday, placeOfBirth: r.place_of_birth, image: r.image, notoriety: r.notoriety }
    : null;
}

export function getMovie(db: DatabaseSync, id: number): Movie | null {
  const r = db.prepare('SELECT * FROM movies WHERE id = ?').get(id) as MovieRow | undefined;
  return r
    ? {
      id: r.id, title: r.title, originalTitle: r.original_title, year: r.year, overview: r.overview, poster: r.poster,
      backdrop: r.backdrop, runtime: r.runtime, genres: JSON.parse(r.genres) as string[], countries: JSON.parse(r.countries) as string[],
      director: r.director, trailer: r.trailer, voteAverage: r.vote_average, voteCount: r.vote_count,
    }
    : null;
}

export function getCard(db: DatabaseSync, id: string): Card | null {
  const r = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined;
  return r ? rowToCard(r) : null;
}

const byValue = (a: Card, b: Card) => RARITIES[b.rarity].entries - RARITIES[a.rarity].entries;

/** La carte Acteur d'une personne et ses cartes Rôle, de la plus précieuse à la plus commune. */
export function getPersonCards(db: DatabaseSync, personId: number): { actor: Card | null; roles: Card[] } {
  const cards = (db.prepare('SELECT * FROM cards WHERE person_id = ?').all(personId) as CardRow[]).map(rowToCard);
  return {
    actor: cards.find((c) => c.kind === 'actor') ?? null,
    roles: cards.filter((c) => c.kind === 'role').sort((a, b) => byValue(a, b) || (b.year ?? 0) - (a.year ?? 0)),
  };
}

/** Les cartes Rôle d'un même film (le casting du film dans le jeu). */
export function getMovieRoles(db: DatabaseSync, movieId: number): Card[] {
  return (db.prepare("SELECT * FROM cards WHERE kind = 'role' AND movie_id = ?").all(movieId) as CardRow[])
    .map(rowToCard)
    .sort(byValue);
}

/** Combien d'exemplaires de chaque carte un joueur possède, pour les cartes demandées. */
export function ownedCounts(db: DatabaseSync, playerId: string | null, cardIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  if (!playerId || cardIds.length === 0) return counts;
  const rows = db.prepare(
    `SELECT card_id, COUNT(*) AS n FROM owned WHERE player_id = ? AND card_id IN (${cardIds.map(() => '?').join(',')}) GROUP BY card_id`,
  ).all(playerId, ...cardIds) as { card_id: string; n: number }[];
  for (const r of rows) counts.set(r.card_id, r.n);
  return counts;
}

/** Le meilleur (plus petit) numéro de série d'une carte chez un joueur, s'il la possède. */
export function bestSerial(db: DatabaseSync, playerId: string | null, cardId: string): number | undefined {
  if (!playerId) return undefined;
  const r = db.prepare('SELECT MIN(serial) AS s FROM owned WHERE player_id = ? AND card_id = ?').get(playerId, cardId) as { s: number | null };
  return r.s ?? undefined;
}

export type ActorQuery = { q?: string; rarity?: string; origin?: string; page?: number; perPage?: number };

/** Les cartes Acteur du catalogue, filtrées et paginées, de la plus précieuse à la moins précieuse. */
export function listActors(db: DatabaseSync, { q, rarity, origin, page = 1, perPage = 48 }: ActorQuery): { cards: Card[]; total: number } {
  const where = ["kind = 'actor'"];
  // Après un import TMDB, le catalogue est celui des fiches importées : les cartes retirées
  // (catalogue de démarrage, acteurs sortis du classement) restent dans les collections mais plus ici.
  if (db.prepare('SELECT 1 FROM people LIMIT 1').get()) where.push('person_id IN (SELECT id FROM people)');
  const args: (string | number)[] = [];
  const term = q?.trim();
  if (term) {
    where.push("(first || ' ' || last) LIKE ? ESCAPE '\\'");
    args.push(`%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  }
  if (rarity && rarity in RARITIES) {
    where.push('rarity = ?');
    args.push(rarity);
  }
  if (origin) {
    where.push('origin = ?');
    args.push(origin);
  }
  const sql = where.join(' AND ');
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE ${sql}`).get(...args) as { n: number };
  const order = `CASE rarity ${Object.values(RARITIES).map((r) => `WHEN '${r.id}' THEN ${r.entries}`).join(' ')} ELSE 0 END DESC, last, first`;
  const rows = db.prepare(`SELECT * FROM cards WHERE ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...args, perPage, (Math.max(1, page) - 1) * perPage) as CardRow[];
  return { cards: rows.map(rowToCard), total: n };
}

/** Les pays des acteurs du catalogue, du plus représenté au moins représenté. */
export function actorOrigins(db: DatabaseSync, min = 3): { origin: string; n: number }[] {
  return db.prepare("SELECT origin, COUNT(*) AS n FROM cards WHERE kind = 'actor' AND origin IS NOT NULL GROUP BY origin HAVING n >= ? ORDER BY n DESC")
    .all(min) as { origin: string; n: number }[];
}
