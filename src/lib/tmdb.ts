// Règles de lecture des données TMDB, sans accès réseau (utilisées par l'import et testées).

const LATIN = /^[\p{Script=Latin}\p{M}\s.'’\-]+$/u;

/** Le nom à afficher : celui de TMDB s'il est en alphabet latin, sinon un alias latin, sinon null. */
export function latinName(name: string, aliases: string[] = []): string | null {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
  if (LATIN.test(clean(name))) return clean(name);
  const alias = aliases.map(clean).find((a) => a.length > 1 && LATIN.test(a));
  return alias ?? null;
}

const PARTICLES = new Set(['de', 'du', 'des', 'da', 'di', 'del', 'della', 'van', 'von', 'der', 'den', 'le', 'la', 'st.', 'mac', 'dos']);

/** Coupe un nom en prénom / nom : « Louis de Funès » → Louis + de Funès, « Zendaya » → '' + Zendaya. */
export function splitName(name: string): { first: string; last: string } {
  const words = name.split(' ');
  if (words.length === 1) return { first: '', last: name };
  let i = words.length - 1;
  // Les suffixes (Jr., Sr., III) restent avec le nom ; les particules aussi.
  if (i > 1 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(words[i])) i -= 1;
  while (i > 1 && PARTICLES.has(words[i - 1].toLowerCase())) i -= 1;
  return { first: words.slice(0, i).join(' '), last: words.slice(i).join(' ') };
}

/** Nettoie un nom de personnage : un seul personnage, sans « (voice) » ni « (uncredited) ». */
export function cleanCharacter(character: string): string {
  return character
    .split(/\s+\/\s+|;/)[0]
    .replace(/\s*\((voices?|uncredited|archive \w+|segment .+?|aka .+?|as .+?|\w+ version)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Les personnages qui ne sont pas des rôles de fiction (documentaires, apparitions). */
export function isSelf(character: string): boolean {
  return /^(self|himself|herself|themselves|lui-même|elle-même|narrator)\b/i.test(character.trim());
}

export type CastCredit = {
  id: number; title: string; original_title: string; original_language: string; character: string; order: number; release_date?: string;
  vote_count: number; vote_average: number; genre_ids: number[]; backdrop_path: string | null; poster_path: string | null;
};

const DOCUMENTARY = 99;

/** Rôles principaux retenus pour un acteur : 4 premiers au générique, films vus, du plus vu au moins vu. */
export function leadRoles(cast: CastCredit[], max: number, minVotes = 50): CastCredit[] {
  const seen = new Set<number>();
  return cast
    .filter((c) => c.order <= 3 && c.character && cleanCharacter(c.character) && !isSelf(c.character))
    .filter((c) => c.release_date && c.vote_count >= minVotes && !c.genre_ids.includes(DOCUMENTARY))
    .sort((a, b) => b.vote_count - a.vote_count)
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .slice(0, max);
}

/**
 * Poids des votes selon l'année du film : les votants TMDB regardent surtout des films récents,
 * un classique de 1965 récolte dix fois moins de votes qu'un succès de 2015 aussi connu.
 */
export function eraWeight(year: number): number {
  return Math.min(5, Math.max(1, (2015 - year) / 12));
}

/** Notoriété d'un acteur : la somme des votes (pondérés par époque) de ses rôles principaux retenus. */
export function notoriety(roles: CastCredit[]): number {
  return Math.round(roles.reduce((sum, r) => sum + r.vote_count * eraWeight(Number(r.release_date?.slice(0, 4))), 0));
}

export type Video = { iso_639_1: string; site: string; type: string; official: boolean; key: string; published_at?: string };

/** La bande-annonce à montrer : YouTube, Trailer avant Teaser, français avant anglais, officielle d'abord. */
export function pickTrailer(videos: Video[]): string | null {
  const score = (v: Video) =>
    (v.type === 'Trailer' ? 8 : 0) + (v.iso_639_1 === 'fr' ? 4 : v.iso_639_1 === 'en' ? 2 : 0) + (v.official ? 1 : 0);
  const best = videos
    .filter((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser') && /^[\w-]{6,20}$/.test(v.key))
    .sort((a, b) => score(b) - score(a))[0];
  return best?.key ?? null;
}

/**
 * Un acteur du cinéma français : au moins 3 de ses rôles principaux (ou la moitié) sont en français,
 * ou il est né en France et en a au moins un.
 */
export function isFrenchCinema(roles: CastCredit[], placeOfBirth?: string | null): boolean {
  const french = roles.filter((r) => r.original_language === 'fr').length;
  const bornInFrance = /\bFrance\b/i.test(placeOfBirth ?? '');
  return french >= 3 || (roles.length > 0 && french / roles.length >= 0.5) || (bornInFrance && french >= 1);
}
