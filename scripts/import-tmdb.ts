// Importe le catalogue réel depuis TMDB, à partir de deux sources :
//   1. les films les plus vus au monde (5 000 par défaut), avec leurs 4 premiers rôles au générique ;
//   2. les séries les plus vues (1 000 par défaut), avec leurs 4 rôles principaux ;
//   3. les acteurs populaires (10 000 par défaut), avec leurs 10 rôles principaux les plus vus.
// Quand TMDB a une affiche où l'acteur est identifié (Tom Cruise sur l'affiche de Top Gun : Maverick),
// elle remplace le plan du film : on voit l'acteur dans son rôle.
// Ainsi aucun grand film ne manque, et les stars de l'âge d'or arrivent par leurs films.
//
//   npm run import:tmdb                                (complet : compter environ 1 h 30)
//   TMDB_PAGES=25 TMDB_FILM_PAGES=25 TMDB_TV_PAGES=5 npm run import:tmdb   (essai rapide)
//
// Les hôtes api.themoviedb.org et image.tmdb.org doivent être joignables.
import { join } from 'node:path';
import { openDb, upsertCards, upsertSagas } from '../src/lib/db.ts';
import { actorRarityFromRank, roleRarity, type ActorRarity } from '../src/lib/rarity.ts';
import type { Card } from '../src/lib/types.ts';

const KEY = process.env.TMDB_API_KEY;
if (!KEY) {
  console.error('TMDB_API_KEY manquante (voir .env.example).');
  process.exit(1);
}
/** Acteurs populaires : pages de 20 (500 au maximum chez TMDB). */
const PAGES = Math.min(500, Number(process.env.TMDB_PAGES ?? 500));
/** Films les plus vus : pages de 20 (250 pages = 5 000 films). */
const FILM_PAGES = Math.min(500, Number(process.env.TMDB_FILM_PAGES ?? 250));
/** Séries les plus vues : pages de 20 (50 pages = 1 000 séries). */
const TV_PAGES = Math.min(500, Number(process.env.TMDB_TV_PAGES ?? 50));
const ROLES_PER_ACTOR = 10;
/** Un rôle de série compte s'il apparaît dans au moins ce nombre d'épisodes. */
const MIN_EPISODES = 6;
/** Les séries ont environ deux fois moins de votes que les films : on double pour appliquer les mêmes seuils. */
const TV_VOTE_FACTOR = 2;
/** Les 4 premiers noms au générique (0 à 3). */
const MAX_ORDER = 3;
const IMG = 'https://image.tmdb.org/t/p';
const TONES = ['#352C22', '#2E2A36', '#22303A', '#2A2F26', '#30262A', '#232A38', '#2E2B27', '#2B2A30', '#2A1622', '#1F2A3A'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

/**
 * Les Mythes, choisis un à un : « acteur|titre » (titre original ou français, peu importe la casse et les accents).
 * Ce sont les personnages que tout le monde reconnaît, au-delà du film.
 */
const MYTHES = new Set([
  'Marlon Brando|The Godfather', 'Al Pacino|The Godfather', 'Robert De Niro|The Godfather Part II', 'Al Pacino|Scarface',
  'Robert De Niro|Taxi Driver', 'Harrison Ford|Star Wars', 'Mark Hamill|Star Wars', 'Carrie Fisher|Star Wars',
  'Harrison Ford|Raiders of the Lost Ark', 'Sigourney Weaver|Alien', 'Arnold Schwarzenegger|The Terminator',
  'Arnold Schwarzenegger|Terminator 2: Judgment Day', 'Linda Hamilton|Terminator 2: Judgment Day', 'Keanu Reeves|The Matrix',
  'Keanu Reeves|John Wick', 'Johnny Depp|Pirates of the Caribbean: The Curse of the Black Pearl', 'Heath Ledger|The Dark Knight',
  'Christian Bale|The Dark Knight', 'Joaquin Phoenix|Joker', 'Jack Nicholson|The Shining', "Jack Nicholson|One Flew Over the Cuckoo's Nest",
  'Jack Nicholson|Batman', 'Michael Keaton|Batman', 'Anthony Hopkins|The Silence of the Lambs', 'Jodie Foster|The Silence of the Lambs',
  'Tom Hanks|Forrest Gump', 'Morgan Freeman|The Shawshank Redemption', 'Tim Robbins|The Shawshank Redemption',
  'Leonardo DiCaprio|Titanic', 'Kate Winslet|Titanic', 'Leonardo DiCaprio|The Wolf of Wall Street', 'Leonardo DiCaprio|Inception',
  'Russell Crowe|Gladiator', 'Brad Pitt|Fight Club', 'Edward Norton|Fight Club', 'Uma Thurman|Pulp Fiction', 'John Travolta|Pulp Fiction',
  'Samuel L. Jackson|Pulp Fiction', 'Uma Thurman|Kill Bill: Vol. 1', 'Bruce Willis|Die Hard', 'Sylvester Stallone|Rocky',
  'Sylvester Stallone|First Blood', 'Michael J. Fox|Back to the Future', 'Christopher Lloyd|Back to the Future',
  "Daniel Radcliffe|Harry Potter and the Philosopher's Stone", "Emma Watson|Harry Potter and the Philosopher's Stone",
  "Rupert Grint|Harry Potter and the Philosopher's Stone", 'Elijah Wood|The Lord of the Rings: The Fellowship of the Ring',
  'Ian McKellen|The Lord of the Rings: The Fellowship of the Ring', 'Viggo Mortensen|The Lord of the Rings: The Return of the King',
  'Robert Downey Jr.|Iron Man', 'Christian Bale|American Psycho', 'Mel Gibson|Mad Max', 'Mel Gibson|Braveheart',
  'Charlize Theron|Mad Max: Fury Road', 'Tom Hardy|Mad Max: Fury Road', 'Tom Cruise|Top Gun', 'Tom Cruise|Mission: Impossible',
  'Matt Damon|The Bourne Identity', 'Daniel Craig|Casino Royale', 'Sean Connery|Goldfinger', 'Sean Connery|Dr. No',
  'Clint Eastwood|Il buono, il brutto, il cattivo', 'Clint Eastwood|Dirty Harry', 'Humphrey Bogart|Casablanca', 'Ingrid Bergman|Casablanca',
  'Marilyn Monroe|Some Like It Hot', "Audrey Hepburn|Breakfast at Tiffany's", 'Vivien Leigh|Gone with the Wind', 'Clark Gable|Gone with the Wind',
  'Judy Garland|The Wizard of Oz', 'Charlie Chaplin|Modern Times', 'Anthony Perkins|Psycho', 'Malcolm McDowell|A Clockwork Orange',
  'Dustin Hoffman|Rain Man', 'Jim Carrey|The Mask', 'Jim Carrey|The Truman Show', 'Will Smith|Men in Black', 'Tommy Lee Jones|Men in Black',
  'Bill Murray|Ghostbusters', 'Eddie Murphy|Beverly Hills Cop', 'Liam Neeson|Taken', 'Hugh Jackman|X-Men', 'Hugh Jackman|Logan',
  'Ryan Reynolds|Deadpool', 'Chris Evans|The Avengers', 'Chris Hemsworth|Thor', 'Tobey Maguire|Spider-Man', 'Gal Gadot|Wonder Woman',
  'Vin Diesel|The Fast and the Furious', 'Paul Walker|The Fast and the Furious', 'Ryan Gosling|Drive', 'Margot Robbie|Barbie',
  'Cillian Murphy|Oppenheimer', 'Matthew McConaughey|Interstellar', 'Timothée Chalamet|Dune', 'Natalie Portman|Léon', 'Jean Reno|Léon',
  "Audrey Tautou|Le Fabuleux Destin d'Amélie Poulain", 'Jean-Paul Belmondo|À bout de souffle', 'Omar Sy|Intouchables',
  'François Cluzet|Intouchables', 'Louis de Funès|La Grande Vadrouille', 'Bourvil|La Grande Vadrouille', 'Alain Delon|Le Samouraï',
  'Gérard Depardieu|Cyrano de Bergerac', 'Christian Clavier|Les Visiteurs', 'Jean Reno|Les Visiteurs', 'Song Kang-ho|기생충',
  'Toshirō Mifune|七人の侍', 'Bruce Lee|Enter the Dragon', 'Shah Rukh Khan|Dilwale Dulhania Le Jayenge', "Robin Williams|Dead Poets Society",
  'Martin Sheen|Apocalypse Now', 'Ray Liotta|Goodfellas', 'Daniel Day-Lewis|There Will Be Blood', 'Javier Bardem|No Country for Old Men',
  'Kevin Costner|Dances with Wolves', 'Julia Roberts|Pretty Woman', 'Patrick Swayze|Dirty Dancing', 'Sharon Stone|Basic Instinct',
  // Séries.
  'Bryan Cranston|Breaking Bad', 'Aaron Paul|Breaking Bad', 'Peter Dinklage|Game of Thrones', 'Emilia Clarke|Game of Thrones',
  'Kit Harington|Game of Thrones', 'Millie Bobby Brown|Stranger Things', 'Úrsula Corberó|La casa de papel', 'Álvaro Morte|La casa de papel',
  'Lee Jung-jae|오징어 게임', 'Jennifer Aniston|Friends', 'Matthew Perry|Friends', 'Matt LeBlanc|Friends', 'David Schwimmer|Friends',
  'Courteney Cox|Friends', 'Lisa Kudrow|Friends', 'Jim Parsons|The Big Bang Theory', 'Steve Carell|The Office', 'Hugh Laurie|House',
  'Benedict Cumberbatch|Sherlock', 'Cillian Murphy|Peaky Blinders', 'Andrew Lincoln|The Walking Dead', 'Norman Reedus|The Walking Dead',
  'Wentworth Miller|Prison Break', 'Jenna Ortega|Wednesday', 'Pedro Pascal|The Mandalorian', 'Pedro Pascal|The Last of Us',
  'Bella Ramsey|The Last of Us', 'Omar Sy|Lupin', 'James Gandolfini|The Sopranos', 'Kiefer Sutherland|24', 'David Duchovny|The X-Files',
  'Gillian Anderson|The X-Files', 'Sarah Jessica Parker|Sex and the City', 'Neil Patrick Harris|How I Met Your Mother',
  'Sarah Michelle Gellar|Buffy the Vampire Slayer', 'Henry Cavill|The Witcher', 'Tom Ellis|Lucifer', 'Jon Hamm|Mad Men',
  'Rami Malek|Mr. Robot', 'Jared Padalecki|Supernatural', 'Jensen Ackles|Supernatural', 'Matthew Fox|Lost',
].map((k) => norm(k)));

/** Monstres sacrés : Légendes d'office, même si les votes TMDB favorisent les films récents. */
const LEGENDS = new Set([
  'Humphrey Bogart', 'Marilyn Monroe', 'Audrey Hepburn', 'Cary Grant', 'James Stewart', 'Marlon Brando', 'James Dean', 'Grace Kelly',
  'Ingrid Bergman', 'Katharine Hepburn', 'Bette Davis', 'Clark Gable', 'Vivien Leigh', 'Charlie Chaplin', 'Elizabeth Taylor',
  'Gregory Peck', 'Henry Fonda', 'John Wayne', 'Paul Newman', 'Steve McQueen', 'Sophia Loren', 'Marcello Mastroianni', 'Jean Gabin',
  'Alain Delon', 'Jean-Paul Belmondo', 'Brigitte Bardot', 'Catherine Deneuve', 'Louis de Funès', 'Simone Signoret', 'Toshirō Mifune',
  'Bruce Lee', 'Orson Welles', 'Kirk Douglas', 'Burt Lancaster', 'Gene Kelly', 'Fred Astaire', 'Judy Garland', 'Greta Garbo',
  'Lauren Bacall', 'Jack Lemmon', "Peter O'Toole", 'Sean Connery', 'Clint Eastwood', 'Robert Redford', 'Dustin Hoffman', 'Al Pacino',
  'Robert De Niro', 'Jack Nicholson', 'Meryl Streep', 'Gérard Depardieu', 'Jean Reno', 'Tom Hanks', 'Denzel Washington',
].map(norm));

const GENRES: Record<number, string> = { 28: 'action', 35: 'comedy', 878: 'scifi', 27: 'horror', 18: 'drama', 16: 'animation', 37: 'western' };

/** Genres TMDB des séries (l'animation, les documentaires, la télé-réalité et les talk-shows sont écartés). */
const TV_GENRES: Record<number, string> = { 10759: 'action', 35: 'comedy', 80: 'crime', 18: 'drama', 9648: 'mystery', 10765: 'scifi', 10768: 'war', 37: 'western', 10751: 'family' };

type Person = { id: number; name: string; known_for_department: string; adult: boolean; profile_path: string | null };
type CastCredit = {
  id: number; title: string; original_title: string; character: string; order: number; release_date?: string;
  vote_count: number; vote_average: number; genre_ids: number[]; backdrop_path: string | null; poster_path: string | null;
};
type PersonDetails = { id: number; name: string; profile_path: string | null; movie_credits: { cast: CastCredit[] } };
type MovieDetails = {
  id: number; title: string; original_title: string; release_date?: string; vote_count: number; vote_average: number; revenue: number;
  genres: { id: number }[]; production_countries: { iso_3166_1: string }[]; backdrop_path: string | null; poster_path: string | null;
  belongs_to_collection: { id: number; name: string } | null;
  credits?: { cast: { id: number; name: string; character: string; order: number; profile_path: string | null; known_for_department?: string }[] };
};
/** Un rôle repéré, en attendant de connaître le rang de son acteur pour calculer sa rareté. */
type RoleFacts = { personId: number; order: number; character: string; movie: MovieDetails; tv?: boolean };
type TvDetails = {
  id: number; name: string; original_name: string; first_air_date?: string; vote_count: number; vote_average: number;
  genres: { id: number }[]; origin_country: string[]; backdrop_path: string | null; poster_path: string | null;
  aggregate_credits?: { cast: { id: number; name: string; profile_path: string | null; order: number; total_episode_count: number; roles: { character: string; episode_count: number }[] }[] };
};
type Tagged = { results: { file_path: string; image_type: string; media_type: string; vote_average: number; media?: { id: number } }[] };

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const bearer = KEY!.startsWith('eyJ');
  if (!bearer) url.searchParams.set('api_key', KEY!);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${KEY}` } : {} }).catch(() => null);
    if ((!res || res.status === 429 || res.status >= 500) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res) throw new Error(`TMDB injoignable sur ${path}`);
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

/** Doublage, archives, apparitions dans son propre rôle : une carte Rôle doit montrer l'acteur à l'image. */
const playsOnScreen = (character: string) =>
  !!character && !/\((voice|voix|archive)/i.test(character) && !/^(him|her)?self\b/i.test(character) && !/^(lui|elle)-même/i.test(character);

const movieCache = new Map<number, Promise<MovieDetails | null>>();
const movie = (id: number, withCredits = false) => {
  if (!movieCache.has(id)) {
    movieCache.set(id, tmdb<MovieDetails>(`/movie/${id}`, withCredits ? { append_to_response: 'credits' } : {}).catch(() => null));
  }
  return movieCache.get(id)!;
};

async function main() {
  const db = openDb(process.env.CLAP_DB_PATH || join(process.cwd(), 'data', 'clap.db'));
  const people = new Map<number, { id: number; name: string; profile: string | null; popRank: number | null }>();
  const roles = new Map<string, RoleFacts>();
  const addRole = (personId: number, order: number, character: string, m: MovieDetails, tv = false) => {
    const key = `role:${personId}:${tv ? 'tv' : ''}${m.id}`;
    const prev = roles.get(key);
    if (!prev || order < prev.order) roles.set(key, { personId, order, character, movie: m, tv });
  };

  // 1. Les films les plus vus, avec leurs premiers rôles.
  console.log(`Films les plus vus : ${FILM_PAGES} pages…`);
  const filmPages = await pool(Array.from({ length: FILM_PAGES }, (_, i) => i + 1), 8, (page) =>
    tmdb<{ results: { id: number }[] }>('/discover/movie', { sort_by: 'vote_count.desc', page: String(page), without_genres: '16,99', include_adult: 'false' })
      .catch(() => ({ results: [] })));
  const filmIds = [...new Set(filmPages.flatMap((p) => p.results.map((r) => r.id)))];
  let done = 0;
  await pool(filmIds, 8, async (id) => {
    const m = await movie(id, true);
    if (m?.credits && m.release_date) {
      for (const c of m.credits.cast) {
        if (c.order > MAX_ORDER || !c.profile_path || !playsOnScreen(c.character)) continue;
        if (!people.has(c.id)) people.set(c.id, { id: c.id, name: c.name, profile: c.profile_path, popRank: null });
        addRole(c.id, c.order, c.character, m);
      }
    }
    if (++done % 500 === 0) console.log(`  ${done} / ${filmIds.length} films, ${people.size} acteurs, ${roles.size} rôles`);
  });

  // 2. Les séries les plus vues, avec leurs rôles principaux.
  console.log(`Séries les plus vues : ${TV_PAGES} pages…`);
  const tvPages = await pool(Array.from({ length: TV_PAGES }, (_, i) => i + 1), 8, (page) =>
    tmdb<{ results: { id: number }[] }>('/discover/tv', { sort_by: 'vote_count.desc', page: String(page), without_genres: '16,99,10762,10763,10764,10767' })
      .catch(() => ({ results: [] })));
  const tvIds = [...new Set(tvPages.flatMap((p) => p.results.map((r) => r.id)))];
  done = 0;
  await pool(tvIds, 8, async (id) => {
    const t = await tmdb<TvDetails>(`/tv/${id}`, { append_to_response: 'aggregate_credits' }).catch(() => null);
    if (t?.aggregate_credits && t.first_air_date) {
      // La série prend la forme d'un film pour le reste de l'import ; son genre et son pays suivent ses propres règles.
      const asMovie: MovieDetails = {
        id: t.id, title: t.name, original_title: t.original_name, release_date: t.first_air_date,
        vote_count: t.vote_count * TV_VOTE_FACTOR, vote_average: t.vote_average, revenue: 0,
        genres: t.genres, production_countries: t.origin_country.map((c) => ({ iso_3166_1: c })),
        backdrop_path: t.backdrop_path, poster_path: t.poster_path, belongs_to_collection: null,
      };
      for (const c of t.aggregate_credits.cast) {
        const main = [...c.roles].sort((a, b) => b.episode_count - a.episode_count)[0];
        if (c.order > MAX_ORDER || c.total_episode_count < MIN_EPISODES || !c.profile_path || !main || !playsOnScreen(main.character)) continue;
        if (!people.has(c.id)) people.set(c.id, { id: c.id, name: c.name, profile: c.profile_path, popRank: null });
        addRole(c.id, c.order, main.character, asMovie, true);
      }
    }
    if (++done % 250 === 0) console.log(`  ${done} / ${tvIds.length} séries, ${roles.size} rôles`);
  });

  // 3. Les acteurs populaires, avec leurs rôles principaux les plus vus.
  console.log(`Acteurs populaires : ${PAGES} pages…`);
  const pages = await pool(Array.from({ length: PAGES }, (_, i) => i + 1), 8, (page) =>
    tmdb<{ results: Person[] }>('/person/popular', { page: String(page) }).catch(() => ({ results: [] as Person[] })));
  const popular = pages.flatMap((p) => p.results).filter((p) => p.known_for_department === 'Acting' && !p.adult && p.profile_path);
  popular.forEach((p, i) => {
    const known = people.get(p.id);
    if (known) known.popRank ??= i + 1;
    else people.set(p.id, { id: p.id, name: p.name, profile: p.profile_path, popRank: i + 1 });
  });
  done = 0;
  await pool(popular, 8, async (person) => {
    let d: PersonDetails;
    try {
      d = await tmdb<PersonDetails>(`/person/${person.id}`, { append_to_response: 'movie_credits' });
    } catch (err) {
      console.warn(`  ${person.name} ignoré : ${(err as Error).message}`);
      return;
    }
    const best = d.movie_credits.cast
      .filter((c) => c.order <= MAX_ORDER && c.release_date && c.vote_count >= 30 && (c.backdrop_path || c.poster_path)
        && !c.genre_ids.includes(16) && playsOnScreen(c.character))
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, ROLES_PER_ACTOR);
    for (const c of best) {
      const m = await movie(c.id);
      if (m) addRole(d.id, c.order, c.character, m);
    }
    if (++done % 500 === 0) console.log(`  ${done} / ${popular.length} acteurs populaires, ${roles.size} rôles`);
  });

  // 3. Notoriété de carrière : votes cumulés des films où l'acteur tient un rôle principal, plus sa popularité du moment.
  const fame = new Map<number, number>();
  for (const r of roles.values()) fame.set(r.personId, (fame.get(r.personId) ?? 0) + r.movie.vote_count * (r.order <= 1 ? 1 : 0.5));
  for (const p of people.values()) if (p.popRank) fame.set(p.id, (fame.get(p.id) ?? 0) + 200_000 / p.popRank);
  const ranked = [...people.values()].filter((p) => fame.has(p.id)).sort((a, b) => fame.get(b.id)! - fame.get(a.id)!);
  const rankOf = new Map(ranked.map((p, i) => [p.id, i + 1]));

  // 4. Les affiches où l'acteur est identifié : l'acteur dans son rôle, plutôt qu'un plan sans lui.
  console.log(`Affiches identifiées : ${ranked.length} acteurs…`);
  const tagged = new Map<string, { path: string; poster: boolean; score: number }>();
  done = 0;
  await pool(ranked, 8, async (p) => {
    const t = await tmdb<Tagged>(`/person/${p.id}/tagged_images`).catch(() => null);
    for (const im of t?.results ?? []) {
      if (!im.media?.id || (im.media_type !== 'movie' && im.media_type !== 'tv')) continue;
      if (im.image_type !== 'poster' && im.image_type !== 'backdrop') continue;
      const key = `role:${p.id}:${im.media_type === 'tv' ? 'tv' : ''}${im.media.id}`;
      // Un plan de scène (backdrop) passe avant une affiche ; à égalité, la mieux notée.
      const score = (im.image_type === 'backdrop' ? 100 : 0) + im.vote_average;
      const prev = tagged.get(key);
      if (!prev || score > prev.score) tagged.set(key, { path: im.file_path, poster: im.image_type === 'poster', score });
    }
    if (++done % 1000 === 0) console.log(`  ${done} / ${ranked.length} acteurs, ${tagged.size} affiches`);
  });

  const cards: Card[] = [];
  const sagas = new Map<number, string>();
  const countryCount = new Map<number, Map<string, number>>();
  for (const p of ranked) {
    const { first, last } = split(p.name);
    const rank = rankOf.get(p.id)!;
    const rarity: ActorRarity = LEGENDS.has(norm(p.name)) ? 'legende' : actorRarityFromRank(rank, ranked.length);
    cards.push({
      id: `actor:${p.id}`, kind: 'actor', personId: p.id, first, last, tone: TONES[p.id % TONES.length], rank, rarity,
      image: p.profile ? `${IMG}/w500${p.profile}` : null, tags: [],
    });
  }
  const byId = new Map(ranked.map((p) => [p.id, p]));
  for (const [id, r] of roles) {
    const p = byId.get(r.personId);
    const m = r.movie;
    if (!p || !m.release_date) continue;
    const { first, last } = split(p.name);
    const year = Number(m.release_date.slice(0, 4));
    const countries = m.production_countries.map((c) => `country:${c.iso_3166_1}`);
    const genres = r.tv
      ? m.genres.map((g) => TV_GENRES[g.id]).filter(Boolean).map((g) => `tvgenre:${g}`)
      : m.genres.map((g) => GENRES[g.id]).filter(Boolean).map((g) => `genre:${g}`);
    const saga = m.belongs_to_collection;
    if (saga) sagas.set(saga.id, saga.name.replace(/\s*-\s*Saga$/i, '').replace(/^Saga\s+/i, ''));
    const mythe = MYTHES.has(norm(`${p.name}|${m.original_title}`)) || MYTHES.has(norm(`${p.name}|${m.title}`));
    const rarity = roleRarity({
      votes: m.vote_count, average: m.vote_average, revenue: m.revenue ?? 0, order: r.order,
      saga: !!saga, actorRank: rankOf.get(p.id) ?? Infinity, mythe,
    });
    const own = tagged.get(id);
    const still = own?.path ?? m.backdrop_path ?? m.poster_path;
    const isPoster = own ? own.poster : !m.backdrop_path;
    const counts = countryCount.get(p.id) ?? new Map<string, number>();
    for (const c of countries) counts.set(c, (counts.get(c) ?? 0) + 1);
    countryCount.set(p.id, counts);
    cards.push({
      id, kind: 'role', personId: p.id, first, last, tone: TONES[p.id % TONES.length], rarity, rank: rankOf.get(p.id),
      votes: r.tv ? Math.round(m.vote_count / TV_VOTE_FACTOR) : m.vote_count,
      // Une série est rangée sous un identifiant négatif pour ne jamais croiser un film du même numéro.
      movieId: r.tv ? -m.id : m.id, film: m.title, year, character: r.character.split(' / ')[0].replace(/\s*\(uncredited\)/i, ''),
      image: still ? `${IMG}/w780${still}` : null,
      tags: [
        ...countries, ...genres, `decade:${Math.floor(year / 10) * 10}`,
        ...(r.tv ? ['media:tv'] : []),
        ...(own ? ['img:actor'] : []),
        ...(isPoster ? ['img:poster'] : []),
        ...(m.revenue >= 300_000_000 ? ['blockbuster'] : []),
        ...(saga ? [`saga:${saga.id}`] : []),
        ...(!r.tv && m.vote_average >= 7.8 && m.vote_count >= 3_000 ? ['acclaimed'] : []),
      ],
    });
  }

  // Le pays d'un acteur : celui qui revient le plus dans ses rôles.
  for (const actor of cards.filter((c) => c.kind === 'actor')) {
    const top = [...(countryCount.get(actor.personId) ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) {
      actor.tags = [top];
      actor.origin = top.slice('country:'.length);
    }
  }

  upsertCards(db, cards);
  upsertSagas(db, [...sagas].map(([id, name]) => ({ id, name })));
  // Le catalogue de démarrage disparaît, sauf les cartes déjà possédées par des joueurs.
  db.exec('DELETE FROM cards WHERE person_id < 0 AND id NOT IN (SELECT card_id FROM owned)');
  const count = (kind: string, rarity?: string) => cards.filter((c) => c.kind === kind && (!rarity || c.rarity === rarity)).length;
  const series = cards.filter((c) => c.tags.includes('media:tv')).length;
  const withActor = cards.filter((c) => c.tags.includes('img:actor')).length;
  console.log(`Importé : ${count('actor')} cartes Acteur, ${count('role')} cartes Rôle (dont ${series} de séries), ${sagas.size} sagas.`);
  console.log(`  ${withActor} rôles illustrés par une image où l'acteur est identifié.`);
  console.log(`  Rôles : ${['mythe', 'icone', 'vedette', 'culte', 'succes', 'serieb'].map((r) => `${r} ${count('role', r)}`).join(' · ')}`);
  console.log(`  Acteurs : ${['legende', 'tete', 'premier', 'second', 'figurant'].map((r) => `${r} ${count('actor', r)}`).join(' · ')}`);
}

await main();
