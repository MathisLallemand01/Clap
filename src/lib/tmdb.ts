import 'server-only';
import { getDb } from './db';

// Fiches TMDB à la demande (biographie, film, bandes-annonces), mises en cache 7 jours.
const TTL = 7 * 24 * 3600 * 1000;
export const TMDB_IMG = 'https://image.tmdb.org/t/p';

async function cached<T>(key: string, load: () => Promise<T>): Promise<T | null> {
  const db = getDb();
  const row = db.prepare('SELECT value, fetched_at FROM tmdb_cache WHERE key = ?').get(key) as { value: string; fetched_at: number } | undefined;
  if (row && Date.now() - row.fetched_at < TTL) return JSON.parse(row.value) as T;
  try {
    const value = await load();
    db.prepare('INSERT OR REPLACE INTO tmdb_cache (key, value, fetched_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), Date.now());
    return value;
  } catch {
    // TMDB injoignable : on sert l'ancienne version si elle existe.
    return row ? (JSON.parse(row.value) as T) : null;
  }
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY manquante');
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const bearer = key.startsWith('eyJ');
  if (!bearer) url.searchParams.set('api_key', key);
  const res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${key}` } : {}, cache: 'no-store' });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json() as Promise<T>;
}

export type PersonInfo = {
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  department: string | null;
};

export function personInfo(personId: number): Promise<PersonInfo | null> {
  if (personId < 0) return Promise.resolve(null);
  return cached(`person:${personId}`, async () => {
    type P = { name: string; biography: string; birthday: string | null; deathday: string | null; place_of_birth: string | null; known_for_department: string | null };
    const fr = await tmdb<P>(`/person/${personId}`, { language: 'fr-FR' });
    // Pas de biographie en français : on prend l'anglaise.
    const bio = fr.biography || (await tmdb<P>(`/person/${personId}`, { language: 'en-US' })).biography;
    return { name: fr.name, biography: bio, birthday: fr.birthday, deathday: fr.deathday, placeOfBirth: fr.place_of_birth, department: fr.known_for_department };
  });
}

export type Video = { key: string; name: string; type: string; language: string; official: boolean };

export type MovieInfo = {
  title: string;
  originalTitle: string;
  overview: string;
  runtime: number | null;
  releaseDate: string | null;
  genres: string[];
  directors: string[];
  backdrop: string | null;
  videos: Video[];
};

export function movieInfo(movieId: number): Promise<MovieInfo | null> {
  return cached(`movie:${movieId}`, async () => {
    type M = {
      title: string; original_title: string; overview: string; runtime: number | null; release_date: string | null;
      genres: { name: string }[]; backdrop_path: string | null;
      credits: { crew: { job: string; name: string }[] };
      videos: { results: { key: string; name: string; type: string; site: string; iso_639_1: string; official: boolean }[] };
    };
    const m = await tmdb<M>(`/movie/${movieId}`, { language: 'fr-FR', append_to_response: 'credits,videos', include_video_language: 'fr,en,null' });
    const videos = m.videos.results
      .filter((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
      .map((v) => ({ key: v.key, name: v.name, type: v.type, language: v.iso_639_1, official: v.official }))
      // Bande-annonce officielle française d'abord, puis anglaise, puis les teasers.
      .sort((a, b) => Number(b.type === 'Trailer') - Number(a.type === 'Trailer') || Number(b.language === 'fr') - Number(a.language === 'fr') || Number(b.official) - Number(a.official));
    return {
      title: m.title, originalTitle: m.original_title, overview: m.overview, runtime: m.runtime, releaseDate: m.release_date,
      genres: m.genres.map((g) => g.name), directors: m.credits.crew.filter((c) => c.job === 'Director').map((c) => c.name),
      backdrop: m.backdrop_path ? `${TMDB_IMG}/w1280${m.backdrop_path}` : null, videos,
    };
  });
}
