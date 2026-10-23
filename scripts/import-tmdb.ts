// Importe le catalogue réel depuis TMDB : acteurs populaires, portraits, rôles principaux.
//
//   npm run import:tmdb                  (10 000 acteurs : 500 pages de 20, le maximum de TMDB)
//   TMDB_PAGES=25 npm run import:tmdb    (500 acteurs, pour un essai rapide)
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
const PAGES = Math.min(500, Number(process.env.TMDB_PAGES ?? 500));
const ROLES_PER_ACTOR = 6;
const IMG = 'https://image.tmdb.org/t/p';
const TONES = ['#352C22', '#2E2A36', '#22303A', '#2A2F26', '#30262A', '#232A38', '#2E2B27', '#2B2A30', '#2A1622', '#1F2A3A'];

/** Les Icônes sont choisies à la main : « acteur|titre original ». */
const ICONS = new Set([
  'Heath Ledger|The Dark Knight',
  'Al Pacino|The Godfather',
  'Marlon Brando|The Godfather',
  'Harrison Ford|Star Wars',
  'Mark Hamill|Star Wars',
  'Carrie Fisher|Star Wars',
  'Harrison Ford|Raiders of the Lost Ark',
  'Sigourney Weaver|Alien',
  'Robert De Niro|Taxi Driver',
  'Jack Nicholson|The Shining',
  'Anthony Hopkins|The Silence of the Lambs',
  'Keanu Reeves|The Matrix',
  'Uma Thurman|Pulp Fiction',
  'John Travolta|Pulp Fiction',
  'Samuel L. Jackson|Pulp Fiction',
  'Arnold Schwarzenegger|The Terminator',
  'Johnny Depp|Pirates of the Caribbean: The Curse of the Black Pearl',
  'Leonardo DiCaprio|Titanic',
  'Audrey Hepburn|Breakfast at Tiffany\'s',
  'Marilyn Monroe|Some Like It Hot',
  'Sylvester Stallone|Rocky',
  'Bruce Willis|Die Hard',
  'Joaquin Phoenix|Joker',
  'Michael J. Fox|Back to the Future',
  'Tom Hanks|Forrest Gump',
  'Morgan Freeman|The Shawshank Redemption',
  'Russell Crowe|Gladiator',
  'Robert Downey Jr.|Iron Man',
  'Elijah Wood|The Lord of the Rings: The Fellowship of the Ring',
  'Ian McKellen|The Lord of the Rings: The Fellowship of the Ring',
  'Daniel Radcliffe|Harry Potter and the Philosopher\'s Stone',
  'Jean-Paul Belmondo|À bout de souffle',
  'Audrey Tautou|Le Fabuleux Destin d\'Amélie Poulain',
  'Jean Reno|Léon',
]);

const GENRES: Record<number, string> = { 28: 'action', 35: 'comedy', 878: 'scifi', 27: 'horror', 18: 'drama', 16: 'animation', 37: 'western' };

type Person = { id: number; name: string; known_for_department: string; adult: boolean; profile_path: string | null };
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
  const db = openDb(process.env.CLAP_DB_PATH || join(process.cwd(), 'data', 'clap.db'));
  console.log(`Acteurs populaires : ${PAGES} pages…`);
  const pages = await pool(Array.from({ length: PAGES }, (_, i) => i + 1), 8, (page) =>
    tmdb<{ results: Person[] }>('/person/popular', { page: String(page) }).catch(() => ({ results: [] as Person[] })));
  const seen = new Set<number>();
  const people = pages
    .flatMap((p) => p.results)
    .filter((p) => p.known_for_department === 'Acting' && !p.adult && p.profile_path && !seen.has(p.id) && seen.add(p.id));
  console.log(`${people.length} acteurs avec portrait. Filmographies…`);

  const cards: Card[] = [];
  const fame = new Map<number, number>();
  let done = 0;
  await pool(people, 8, async (person, index) => {
    const rank = index + 1;
    let d: PersonDetails;
    try {
      d = await tmdb<PersonDetails>(`/person/${person.id}`, { append_to_response: 'movie_credits' });
    } catch (err) {
      console.warn(`  ${person.name} ignoré : ${(err as Error).message}`);
      return;
    }
    const { first, last } = split(d.name);
    const tone = TONES[d.id % TONES.length];
    // Notoriété de carrière : votes cumulés des films où l'acteur tient un rôle principal.
    const leads = d.movie_credits.cast.filter((c) => c.order <= 3);
    fame.set(d.id, leads.reduce((sum, c) => sum + c.vote_count, 0) + 2_000 / rank);
    cards.push({
      id: `actor:${d.id}`, kind: 'actor', personId: d.id, first, last, tone, rank,
      rarity: 'figurant',
      image: d.profile_path ? `${IMG}/w500${d.profile_path}` : null,
      tags: [],
    });

    // Rôles principaux uniquement (4 premiers au générique), des films les plus vus.
    const roles = d.movie_credits.cast
      // On écarte le doublage (dessins animés, voix) et les apparitions dans son propre rôle :
      // une carte Rôle doit montrer l'acteur à l'image.
      .filter((c) => c.order <= 3 && c.character && c.release_date && c.vote_count >= 30 && (c.backdrop_path || c.poster_path)
        && !c.genre_ids.includes(16) && !/\((voice|voix|archive)/i.test(c.character) && !/^(him|her)?self\b/i.test(c.character))
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, ROLES_PER_ACTOR);

    for (const c of roles) {
      const details = await movie(c.id).catch(() => ({ production_countries: [], revenue: 0 }));
      const year = Number(c.release_date!.slice(0, 4));
      const countries = details.production_countries.map((p) => `country:${p.iso_3166_1}`);
      const genres = c.genre_ids.filter((g) => GENRES[g]).map((g) => `genre:${GENRES[g]}`);
      const rarity: RoleRarity = ICONS.has(`${d.name}|${c.original_title}`) ? 'icone' : roleRarityFromMovie(c.vote_count, c.vote_average);
      const still = c.backdrop_path ?? c.poster_path;
      cards.push({
        id: `role:${d.id}:${c.id}`, kind: 'role', personId: d.id, first, last, tone, rarity, rank, votes: c.vote_count,
        movieId: c.id, film: c.title, year, character: c.character.split(' / ')[0].replace(/\s*\(uncredited\)/i, ''),
        image: still ? `${IMG}/w780${still}` : null,
        tags: [...countries, ...genres, `decade:${Math.floor(year / 10) * 10}`, ...(details.revenue >= 300_000_000 ? ['blockbuster'] : [])],
      });
    }
    if (++done % 250 === 0) console.log(`  ${done} / ${people.length} acteurs, ${cards.length} cartes`);
  });

  // Rareté des acteurs : par rang de notoriété de carrière.
  const actors = cards.filter((c) => c.kind === 'actor').sort((a, b) => (fame.get(b.personId) ?? 0) - (fame.get(a.personId) ?? 0));
  actors.forEach((a, i) => {
    a.rank = i + 1;
    a.rarity = actorRarityFromRank(i + 1, actors.length);
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

  upsertCards(db, cards);
  // Le catalogue de démarrage disparaît, sauf les cartes déjà possédées par des joueurs.
  db.exec('DELETE FROM cards WHERE person_id < 0 AND id NOT IN (SELECT card_id FROM owned)');
  const byKind = cards.reduce((acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }), {} as Record<string, number>);
  console.log(`Importé : ${byKind.actor ?? 0} cartes Acteur, ${byKind.role ?? 0} cartes Rôle.`);
}

await main();
