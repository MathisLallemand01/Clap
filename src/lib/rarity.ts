// Les deux échelles de rareté : cartes Acteur (portrait) et cartes Rôle (acteur dans un film).
// `entries` = valeur de base en entrées ; le prix conseillé en tickets vaut entries / 100.

export type CardKind = 'actor' | 'role';

export type ActorRarity = 'figurant' | 'second' | 'premier' | 'tete' | 'legende';
export type RoleRarity = 'serieb' | 'succes' | 'culte' | 'chef' | 'icone';
export type Rarity = ActorRarity | RoleRarity;

export type RarityInfo = {
  id: Rarity;
  kind: CardKind;
  label: string;
  short: string;
  color: string;
  /** Position dans l'échelle de son type, 1 = la plus commune. */
  tier: number;
  entries: number;
  /** Teinte de fond reflet (foil) ou null. */
  foil: boolean;
};

export const RARITIES: Record<Rarity, RarityInfo> = {
  figurant: { id: 'figurant', kind: 'actor', label: 'Figurant', short: 'FIG', color: '#9A988F', tier: 1, entries: 500, foil: false },
  second: { id: 'second', kind: 'actor', label: 'Second rôle', short: '2ND', color: '#3DDC97', tier: 2, entries: 1_500, foil: false },
  premier: { id: 'premier', kind: 'actor', label: 'Premier rôle', short: '1ER', color: '#4C8DFF', tier: 3, entries: 5_000, foil: false },
  tete: { id: 'tete', kind: 'actor', label: 'Tête d’affiche', short: 'TÊTE', color: '#B57BFF', tier: 4, entries: 20_000, foil: false },
  legende: { id: 'legende', kind: 'actor', label: 'Légende', short: 'LÉG', color: '#FFC83D', tier: 5, entries: 100_000, foil: true },
  serieb: { id: 'serieb', kind: 'role', label: 'Série B', short: 'SÉRIE B', color: '#D9B48A', tier: 1, entries: 2_500, foil: false },
  succes: { id: 'succes', kind: 'role', label: 'Succès', short: 'SUCCÈS', color: '#C6F05A', tier: 2, entries: 8_000, foil: false },
  culte: { id: 'culte', kind: 'role', label: 'Culte', short: 'CULTE', color: '#2EE6D6', tier: 3, entries: 30_000, foil: false },
  chef: { id: 'chef', kind: 'role', label: 'Chef-d’œuvre', short: 'CHEF', color: '#F2EFE8', tier: 4, entries: 150_000, foil: true },
  icone: { id: 'icone', kind: 'role', label: 'Icône', short: 'ICÔNE', color: '#FF2E93', tier: 5, entries: 1_000_000, foil: true },
};

export const ACTOR_LADDER: ActorRarity[] = ['figurant', 'second', 'premier', 'tete', 'legende'];
export const ROLE_LADDER: RoleRarity[] = ['serieb', 'succes', 'culte', 'chef', 'icone'];

/** Toutes les raretés, de la plus précieuse à la plus commune (ordre par valeur). */
export const RARITIES_BY_VALUE: Rarity[] = (Object.keys(RARITIES) as Rarity[]).sort(
  (a, b) => RARITIES[b].entries - RARITIES[a].entries,
);

export function ladderOf(kind: CardKind): Rarity[] {
  return kind === 'actor' ? ACTOR_LADDER : ROLE_LADDER;
}

export function suggestedTickets(rarity: Rarity): number {
  return Math.round(RARITIES[rarity].entries / 100);
}

/** Rareté d'un acteur selon son rang de popularité TMDB (1 = le plus populaire). */
export function actorRarityFromRank(rank: number): ActorRarity {
  if (rank <= 100) return 'legende';
  if (rank <= 1_000) return 'tete';
  if (rank <= 5_000) return 'premier';
  if (rank <= 20_000) return 'second';
  return 'figurant';
}

/**
 * Rareté d'un rôle selon la notoriété du film (nombre de votes TMDB et note moyenne).
 * Les Icônes ne sont jamais calculées : elles viennent d'une liste choisie à la main.
 */
export function roleRarityFromMovie(voteCount: number, voteAverage: number): RoleRarity {
  if (voteCount >= 15_000 && voteAverage >= 8.0) return 'chef';
  if (voteCount >= 5_000 && voteAverage >= 7.3) return 'culte';
  if (voteCount >= 1_500) return 'succes';
  return 'serieb';
}
