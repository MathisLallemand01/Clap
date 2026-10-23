// Importe le catalogue réel depuis TMDB : acteurs connus, portraits, biographies, rôles principaux,
// fiches des films et bandes-annonces.
//
//   TMDB_API_KEY=… npm run import:tmdb                 (800 acteurs du monde + 150 du cinéma français)
//   TMDB_API_KEY=… TMDB_ACTORS=2000 TMDB_FR_ACTORS=300 npm run import:tmdb
//
// Les candidats viennent des films les plus vus (monde, France, Royaume-Uni), des acteurs populaires
// du moment et des Icônes. Ils sont classés par notoriété : la somme des votes des films où ils
// tiennent un rôle principal, pondérés par époque. Les acteurs du cinéma français sont classés entre eux,
// sinon Hollywood les écraserait tous. Les raretés Acteur sont des parts de chaque classement
// (src/lib/rarity.ts).
//
// Les hôtes api.themoviedb.org et image.tmdb.org doivent être joignables.
import { join } from 'node:path';
import { upsertMovies, upsertPeople, type Movie, type Person } from '../src/lib/catalog.ts';
import { openDb, transaction, upsertCards } from '../src/lib/db.ts';
import { actorRarityFromRank, roleRarityFromMovie, type RoleRarity } from '../src/lib/rarity.ts';
import { cleanCharacter, isFrenchCinema, latinName, leadRoles, notoriety, pickTrailer, splitName, type CastCredit, type Video } from '../src/lib/tmdb.ts';
import type { Card } from '../src/lib/types.ts';

const KEY = process.env.TMDB_API_KEY;
if (!KEY) {
  console.error('TMDB_API_KEY manquante (voir .env.example).');
  process.exit(1);
}
const ACTORS = Number(process.env.TMDB_ACTORS) || 800;
const FR_ACTORS = Number(process.env.TMDB_FR_ACTORS) || 150;
const ROLES_PER_ACTOR = 8;
const IMG = 'https://image.tmdb.org/t/p';
const TONES = ['#352C22', '#2E2A36', '#22303A', '#2A2F26', '#30262A', '#232A38', '#2E2B27', '#2B2A30', '#2A1622', '#1F2A3A'];

/** Les Icônes sont choisies à la main : acteur, titre original. Leurs acteurs sont toujours importés. */
const ICONS: [string, string][] = [
  ['Heath Ledger', 'The Dark Knight'],
  ['Al Pacino', 'The Godfather'],
  ['Harrison Ford', 'Star Wars'],
  ['Sigourney Weaver', 'Alien'],
  ['Jean-Paul Belmondo', 'À bout de souffle'],
  ['Audrey Tautou', 'Le Fabuleux Destin d\'Amélie Poulain'],
  ['Marlon Brando', 'The Godfather'],
  ['Anthony Hopkins', 'The Silence of the Lambs'],
  ['Uma Thurman', 'Pulp Fiction'],
  ['Louis de Funès', 'La Grande Vadrouille'],
  ['Keanu Reeves', 'The Matrix'],
  ['Jodie Foster', 'The Silence of the Lambs'],
];
const iconKey = (person: number, title: string) => `${person}|${title}`;

const GENRES: Record<number, string> = { 28: 'action', 35: 'comedy', 878: 'scifi', 27: 'horror', 18: 'drama', 16: 'animation', 37: 'western' };

type PopularPerson = { id: number; known_for_department: string };
type DiscoverMovie = { id: number };
type PersonDetails = {
  id: number; name: string; also_known_as: string[]; biography: string; birthday: string | null; deathday: string | null;
  place_of_birth: string | null; profile_path: string | null; known_for_department: string; movie_credits: { cast: CastCredit[] };
};
type MovieDetails = {
  id: number; title: string; original_title: string; overview: string; release_date: string; poster_path: string | null;
  backdrop_path: string | null; runtime: number | null; revenue: number; vote_average: number; vote_count: number;
  genres: { id: number; name: string }[]; production_countries: { iso_3166_1: string }[];
  videos: { results: Video[] }; credits: { cast: { id: number; order: number; known_for_department: string }[]; crew: { job: string; name: string }[] };
};

let requests = 0;

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const bearer = KEY!.startsWith('eyJ');
  if (!bearer) url.searchParams.set('api_key', KEY!);
  for (let attempt = 0; ; attempt++) {
    requests++;
    let res: Response;
    try {
      res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${KEY}` } : {}, signal: AbortSignal.timeout(20_000) });
    } catch (err) {
      if (attempt < 5) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw err;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 404) return null;
    if (res.status === 401) throw new Error('TMDB refuse la clé (401) : vérifiez TMDB_API_KEY.');
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

const movieCache = new Map<number, Promise<MovieDetails | null>>();
const movie = (id: number) => {
  if (!movieCache.has(id)) {
    movieCache.set(id, tmdb<MovieDetails>(`/movie/${id}`, { append_to_response: 'videos,credits', include_video_language: 'fr,en' }));
  }
  return movieCache.get(id)!;
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** Les acteurs principaux (4 premiers au générique) des films les plus vus d'une sélection. */
async function leadsOfTopMovies(pages: number, params: Record<string, string> = {}): Promise<number[]> {
  const lists = await pool(range(pages), 4, (page) =>
    tmdb<{ results: DiscoverMovie[] }>('/discover/movie', { sort_by: 'vote_count.desc', page: String(page), ...params }));
  const ids = lists.flatMap((l) => l?.results ?? []).map((m) => m.id);
  const details = await pool(ids, 8, (id) => movie(id));
  return details.flatMap((d) => d?.credits.cast.filter((c) => c.order <= 3 && c.known_for_department === 'Acting').map((c) => c.id) ?? []);
}

async function main() {
  const started = Date.now();
  const candidates = new Set<number>();
  const add = (ids: number[]) => ids.forEach((id) => candidates.add(id));

  console.log('Candidats : films les plus vus…');
  add(await leadsOfTopMovies(40));
  add(await leadsOfTopMovies(12, { with_origin_country: 'FR' }));
  add(await leadsOfTopMovies(6, { with_origin_country: 'GB' }));
  console.log('Candidats : acteurs populaires du moment…');
  const popular = await pool(range(10), 4, (page) => tmdb<{ results: PopularPerson[] }>('/person/popular', { page: String(page) }));
  add(popular.flatMap((p) => p?.results ?? []).filter((p) => p.known_for_department === 'Acting').map((p) => p.id));

  const iconPeople = new Set<number>();
  for (const [name] of ICONS) {
    const found = await tmdb<{ results: { id: number; known_for_department: string }[] }>('/search/person', { query: name });
    const hit = found?.results.find((r) => r.known_for_department === 'Acting');
    if (hit) {
      candidates.add(hit.id);
      iconPeople.add(hit.id);
    } else console.warn(`  Icône introuvable : ${name}`);
  }
  console.log(`${candidates.size} candidats. Filmographies…`);

  type Ranked = { details: PersonDetails; name: string; roles: CastCredit[]; score: number; french: boolean };
  let skippedName = 0;
  let skippedRoles = 0;
  const ranked = (await pool([...candidates], 8, async (id): Promise<Ranked | null> => {
    const d = await tmdb<PersonDetails>(`/person/${id}`, { append_to_response: 'movie_credits' });
    if (!d || d.known_for_department !== 'Acting') return null;
    const name = latinName(d.name, d.also_known_as);
    if (!name) {
      skippedName++;
      return null;
    }
    const roles = leadRoles(d.movie_credits.cast, ROLES_PER_ACTOR);
    if (roles.length === 0) {
      skippedRoles++;
      return null;
    }
    return { details: d, name, roles, score: notoriety(roles), french: isFrenchCinema(roles, d.place_of_birth) };
  })).filter((r): r is Ranked => r !== null).sort((a, b) => b.score - a.score);

  // Deux classements : le cinéma français, et tous les autres. Les Icônes sont gardées dans tous les cas.
  const keep = (list: Ranked[], n: number) => [...list.slice(0, n), ...list.slice(n).filter((r) => iconPeople.has(r.details.id))];
  const french = keep(ranked.filter((r) => r.french), FR_ACTORS);
  const world = keep(ranked.filter((r) => !r.french), ACTORS);
  const rarityOf = new Map<number, ReturnType<typeof actorRarityFromRank>>();
  for (const list of [french, world]) list.forEach((r, i) => rarityOf.set(r.details.id, actorRarityFromRank(i + 1, list.length)));
  const kept = [...world, ...french];
  console.log(`${ranked.length} acteurs retenus (${skippedName} sans nom latin, ${skippedRoles} sans rôle principal au cinéma) ; ${world.length} + ${french.length} du cinéma français importés.`);

  const icons = new Set(ICONS.map(([name, title]) => {
    const person = kept.find((r) => r.name === name || r.details.name === name);
    return person ? iconKey(person.details.id, title) : '';
  }));

  console.log('Fiches des films et bandes-annonces…');
  const cards: Card[] = [];
  const people: Person[] = [];
  const movies = new Map<number, Movie>();

  await pool(kept, 8, async (r, i) => {
    const d = r.details;
    const { first, last } = splitName(r.name);
    const tone = TONES[d.id % TONES.length];
    const portrait = d.profile_path ? `${IMG}/w500${d.profile_path}` : null;
    let biography = d.biography.trim();
    if (!biography) biography = (await tmdb<{ biography: string }>(`/person/${d.id}`, { language: 'en-US' }))?.biography.trim() ?? '';
    people.push({
      id: d.id, name: r.name, biography: biography || null, birthday: d.birthday, deathday: d.deathday,
      placeOfBirth: d.place_of_birth, image: portrait, notoriety: r.score,
    });
    const actor: Card = {
      id: `actor:${d.id}`, kind: 'actor', personId: d.id, first, last, tone,
      rarity: rarityOf.get(d.id)!, image: portrait, tags: [],
    };
    cards.push(actor);

    const countryCount = new Map<string, number>();
    for (const c of r.roles) {
      const m = await movie(c.id);
      if (!m) continue;
      const year = Number(c.release_date!.slice(0, 4));
      const countries = m.production_countries.map((p) => p.iso_3166_1);
      countries.forEach((k) => countryCount.set(k, (countryCount.get(k) ?? 0) + 1));
      if (!movies.has(m.id)) {
        let overview = m.overview.trim();
        if (!overview) overview = (await tmdb<{ overview: string }>(`/movie/${m.id}`, { language: 'en-US' }))?.overview.trim() ?? '';
        movies.set(m.id, {
          id: m.id, title: m.title, originalTitle: m.original_title, year, overview: overview || null,
          poster: m.poster_path ? `${IMG}/w500${m.poster_path}` : null,
          backdrop: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : null,
          runtime: m.runtime || null, genres: m.genres.map((g) => g.name), countries,
          director: m.credits.crew.filter((p) => p.job === 'Director').map((p) => p.name).join(', ') || null,
          trailer: pickTrailer(m.videos.results), voteAverage: m.vote_average, voteCount: m.vote_count,
        });
      }
      const genres = c.genre_ids.filter((g) => GENRES[g]).map((g) => `genre:${GENRES[g]}`);
      const rarity: RoleRarity = icons.has(iconKey(d.id, c.original_title)) ? 'icone' : roleRarityFromMovie(c.vote_count, c.vote_average);
      const still = c.backdrop_path ?? c.poster_path;
      cards.push({
        id: `role:${d.id}:${c.id}`, kind: 'role', personId: d.id, first, last, tone, rarity,
        movieId: c.id, film: m.title, year, character: cleanCharacter(c.character),
        image: still ? `${IMG}/w780${still}` : null,
        tags: [...countries.map((k) => `country:${k}`), ...genres, `decade:${Math.floor(year / 10) * 10}`, ...(m.revenue >= 300_000_000 ? ['blockbuster'] : [])],
      });
    }

    // Le pays d'un acteur : celui qui revient le plus dans ses rôles.
    const top = [...countryCount].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) {
      actor.origin = top;
      actor.tags = [`country:${top}`];
    }
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1} / ${kept.length}`);
  });

  const db = openDb(process.env.CLAP_DB_PATH || join(process.cwd(), 'data', 'clap.db'));
  upsertPeople(db, people);
  upsertMovies(db, [...movies.values()]);
  upsertCards(db, cards);
  // Les cartes qui ne font plus partie du catalogue (dont le catalogue de démarrage) disparaissent,
  // sauf celles que des joueurs possèdent déjà.
  const removed = transaction(db, () => {
    db.exec('CREATE TEMP TABLE IF NOT EXISTS imported (id TEXT PRIMARY KEY); DELETE FROM imported;');
    const ins = db.prepare('INSERT OR IGNORE INTO imported (id) VALUES (?)');
    for (const c of cards) ins.run(c.id);
    const { changes } = db.prepare('DELETE FROM cards WHERE id NOT IN (SELECT id FROM imported) AND id NOT IN (SELECT card_id FROM owned)').run();
    return Number(changes);
  });

  const count = (kind: Card['kind']) => cards.filter((c) => c.kind === kind).length;
  const trailers = [...movies.values()].filter((m) => m.trailer).length;
  console.log(`Importé : ${count('actor')} cartes Acteur, ${count('role')} cartes Rôle, ${movies.size} films (${trailers} avec bande-annonce).`);
  console.log(`${removed} anciennes cartes retirées · ${requests} requêtes TMDB · ${Math.round((Date.now() - started) / 1000)} s.`);
}

await main();
