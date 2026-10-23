// Importe le catalogue réel depuis TMDB : acteurs populaires, portraits, rôles principaux.
//
//   TMDB_API_KEY=… npm run import:tmdb            (500 acteurs : 25 pages de 20)
//   TMDB_API_KEY=… TMDB_PAGES=100 npm run import:tmdb
//
// Les hôtes api.themoviedb.org et image.tmdb.org doivent être joignables.
import { join } from 'node:path';
import { openDb, upsertCards } from '../src/lib/db.ts';
import { actorRarityFromRank, roleRarityFromMovie, type RoleRarity } from '../src/lib/rarity.ts';
import type { Card } from '../src/lib/types.ts';

const KEY = process.env.TMDB_API_KEY;
if (!KEY) {
  console.error('TMDB_API_KEY manquante (voir .env.example).');
  process.exit(1);
}
const PAGES = Number(process.env.TMDB_PAGES ?? 25);
const ROLES_PER_ACTOR = 8;
const IMG = 'https://image.tmdb.org/t/p';
const TONES = ['#352C22', '#2E2A36', '#22303A', '#2A2F26', '#30262A', '#232A38', '#2E2B27', '#2B2A30', '#2A1622', '#1F2A3A'];

/** Les Icônes sont choisies à la main : « acteur|titre original ». */
const ICONS = new Set([
  'Heath Ledger|The Dark Knight',
  'Al Pacino|The Godfather',
  'Harrison Ford|Star Wars',
  'Sigourney Weaver|Alien',
  'Jean-Paul Belmondo|À bout de souffle',
  'Audrey Tautou|Le Fabuleux Destin d\'Amélie Poulain',
]);

const GENRES: Record<number, string> = { 28: 'action', 35: 'comedy', 878: 'scifi', 27: 'horror', 18: 'drama', 16: 'animation', 37: 'western' };

type Person = { id: number; name: string; known_for_department: string };
type CastCredit = {
  id: number; title: string; original_title: string; character: string; order: number; release_date?: string;
  vote_count: number; vote_average: number; genre_ids: number[]; backdrop_path: string | null; poster_path: string | null;
};
type PersonDetails = { id: number; name: string; profile_path: string | null; movie_credits: { cast: CastCredit[] } };
type MovieDetails = { production_countries: { iso_3166_1: string }[]; revenue: number };

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const bearer = KEY!.startsWith('eyJ');
  if (!bearer) url.searchParams.set('api_key', KEY!);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${KEY}` } : {} });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`TMDB ${res.status} sur ${path}`);
    return res.json() as Promise<T>;
  }
}

/** Exécute `fn` sur chaque élément avec au plus `limit` appels en parallèle. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
}

const split = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? { first: '', last: name } : { first: name.slice(0, i), last: name.slice(i + 1) };
};

const movieCache = new Map<number, Promise<MovieDetails>>();
const movie = (id: number) => {
  if (!movieCache.has(id)) movieCache.set(id, tmdb<MovieDetails>(`/movie/${id}`));
  return movieCache.get(id)!;
};

async function main() {
  console.log(`Acteurs populaires : ${PAGES} pages…`);
  const pages = await pool(Array.from({ length: PAGES }, (_, i) => i + 1), 4, (page) =>
    tmdb<{ results: Person[] }>('/person/popular', { page: String(page) }));
  const people = pages.flatMap((p) => p.results).filter((p) => p.known_for_department === 'Acting');
  console.log(`${people.length} acteurs. Filmographies…`);

  const cards: Card[] = [];
  await pool(people, 6, async (person, rank) => {
    const d = await tmdb<PersonDetails>(`/person/${person.id}`, { append_to_response: 'movie_credits' });
    const { first, last } = split(d.name);
    const tone = TONES[d.id % TONES.length];
    cards.push({
      id: `actor:${d.id}`, kind: 'actor', personId: d.id, first, last, tone,
      rarity: actorRarityFromRank(rank + 1),
      image: d.profile_path ? `${IMG}/w500${d.profile_path}` : null,
      tags: [],
    });

    // Rôles principaux uniquement (4 premiers au générique), des films les plus vus.
    const roles = d.movie_credits.cast
      .filter((c) => c.order <= 3 && c.character && c.release_date && c.vote_count >= 50)
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, ROLES_PER_ACTOR);

    for (const c of roles) {
      const details = await movie(c.id);
      const year = Number(c.release_date!.slice(0, 4));
      const countries = details.production_countries.map((p) => `country:${p.iso_3166_1}`);
      const genres = c.genre_ids.filter((g) => GENRES[g]).map((g) => `genre:${GENRES[g]}`);
      const rarity: RoleRarity = ICONS.has(`${d.name}|${c.original_title}`) ? 'icone' : roleRarityFromMovie(c.vote_count, c.vote_average);
      const still = c.backdrop_path ?? c.poster_path;
      cards.push({
        id: `role:${d.id}:${c.id}`, kind: 'role', personId: d.id, first, last, tone, rarity,
        movieId: c.id, film: c.title, year, character: c.character.split(' / ')[0],
        image: still ? `${IMG}/w780${still}` : null,
        tags: [...countries, ...genres, `decade:${Math.floor(year / 10) * 10}`, ...(details.revenue >= 300_000_000 ? ['blockbuster'] : [])],
      });
    }
  });

  // Le pays d'un acteur : celui qui revient le plus dans ses rôles.
  for (const actor of cards.filter((c) => c.kind === 'actor')) {
    const counts = new Map<string, number>();
    for (const r of cards) {
      if (r.kind !== 'role' || r.personId !== actor.personId) continue;
      for (const t of r.tags.filter((t) => t.startsWith('country:'))) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) {
      actor.tags = [top];
      actor.origin = top.slice('country:'.length);
    }
  }

  const db = openDb(process.env.CLAP_DB_PATH || join(process.cwd(), 'data', 'clap.db'));
  upsertCards(db, cards);
  // Le catalogue de démarrage disparaît, sauf les cartes déjà possédées par des joueurs.
  db.exec('DELETE FROM cards WHERE person_id < 0 AND id NOT IN (SELECT card_id FROM owned)');
  const byKind = cards.reduce((acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }), {} as Record<string, number>);
  console.log(`Importé : ${byKind.actor ?? 0} cartes Acteur, ${byKind.role ?? 0} cartes Rôle.`);
}

await main();
