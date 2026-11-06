// Les deux échelles de rareté : cartes Acteur (portrait) et cartes Rôle (acteur dans un film).
// `entries` = valeur de base en entrées ; le prix conseillé en tickets vaut entries / 100.

export type CardKind = 'actor' | 'role';

export type ActorRarity = 'figurant' | 'second' | 'premier' | 'tete' | 'legende';
export type RoleRarity = 'serieb' | 'succes' | 'culte' | 'vedette' | 'icone' | 'mythe';
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
  /** Reflet holographique sur la carte. */
  foil: boolean;
  /** La règle, en une phrase, telle qu'on l'explique aux joueurs. */
  rule: string;
};

/** Les deux familles, telles qu'on les nomme partout sur le site. */
export const FAMILY: Record<CardKind, { label: string; plural: string; pack: string; mark: '●' | '◆' }> = {
  actor: { label: 'Acteur', plural: 'Acteurs', pack: 'Casting', mark: '●' },
  role: { label: 'Rôle', plural: 'Rôles', pack: 'Film', mark: '◆' },
};

export const RARITIES: Record<Rarity, RarityInfo> = {
  figurant: { id: 'figurant', kind: 'actor', label: 'Figurant', short: 'FIG', color: '#9A988F', tier: 1, entries: 500, foil: false,
    rule: 'Une carrière encore discrète.' },
  second: { id: 'second', kind: 'actor', label: 'Second rôle', short: '2ND', color: '#3DDC97', tier: 2, entries: 1_500, foil: false,
    rule: 'Un visage qu’on reconnaît.' },
  premier: { id: 'premier', kind: 'actor', label: 'Premier rôle', short: '1ER', color: '#4C8DFF', tier: 3, entries: 5_000, foil: false,
    rule: 'Un acteur qui tient des films sur ses épaules.' },
  tete: { id: 'tete', kind: 'actor', label: 'Tête d’affiche', short: 'TÊTE', color: '#B57BFF', tier: 4, entries: 20_000, foil: false,
    rule: 'Une star internationale.' },
  legende: { id: 'legende', kind: 'actor', label: 'Légende', short: 'LÉG', color: '#FFC83D', tier: 5, entries: 100_000, foil: true,
    rule: 'Un monstre sacré du cinéma, âge d’or compris.' },
  serieb: { id: 'serieb', kind: 'role', label: 'Série B', short: 'SÉRIE B', color: '#D9B48A', tier: 1, entries: 2_500, foil: false,
    rule: 'Un film peu vu : moins de 1 000 votes.' },
  succes: { id: 'succes', kind: 'role', label: 'Succès', short: 'SUCCÈS', color: '#C6F05A', tier: 2, entries: 8_000, foil: false,
    rule: 'Un film connu : 1 000 votes et plus.' },
  culte: { id: 'culte', kind: 'role', label: 'Culte', short: 'CULTE', color: '#2EE6D6', tier: 3, entries: 30_000, foil: false,
    rule: 'Un film vu par tous (5 000 votes) ou acclamé (note de 7,5 et plus).' },
  vedette: { id: 'vedette', kind: 'role', label: 'Vedette', short: 'VEDETTE', color: '#FFB547', tier: 4, entries: 100_000, foil: true,
    rule: 'Une star en tête d’affiche : Brad Pitt dans Bullet Train, Tom Cruise dans Top Gun : Maverick.' },
  icone: { id: 'icone', kind: 'role', label: 'Icône', short: 'ICÔNE', color: '#FF2E93', tier: 5, entries: 400_000, foil: true,
    rule: 'La tête d’affiche d’une saga ou d’un best-seller : Star Wars, Harry Potter, Fast & Furious…' },
  mythe: { id: 'mythe', kind: 'role', label: 'Mythe', short: 'MYTHE', color: '#FF2440', tier: 6, entries: 1_500_000, foil: true,
    rule: 'Un personnage entré dans la légende, choisi un à un : Vito Corleone, Jack Sparrow, Neo…' },
};

export const ACTOR_LADDER: ActorRarity[] = ['figurant', 'second', 'premier', 'tete', 'legende'];
export const ROLE_LADDER: RoleRarity[] = ['serieb', 'succes', 'culte', 'vedette', 'icone', 'mythe'];

/** Toutes les raretés, de la plus précieuse à la plus commune (ordre par valeur). */
export const RARITIES_BY_VALUE: Rarity[] = (Object.keys(RARITIES) as Rarity[]).sort(
  (a, b) => RARITIES[b].entries - RARITIES[a].entries,
);

export function ladderOf(kind: CardKind): Rarity[] {
  return kind === 'actor' ? ACTOR_LADDER : ROLE_LADDER;
}

/** « Acteur · Légende », « Rôle · Icône » : une rareté s'écrit toujours avec sa famille. */
export function rarityName(rarity: Rarity): string {
  return `${FAMILY[RARITIES[rarity].kind].label} · ${RARITIES[rarity].label}`;
}

/** Le cran le plus haut de chaque famille : 5 pour les Acteurs, 6 pour les Rôles. */
export function isTopRarity(rarity: Rarity): boolean {
  return RARITIES[rarity].tier === ladderOf(RARITIES[rarity].kind).length;
}

export function suggestedTickets(rarity: Rarity): number {
  return Math.round(RARITIES[rarity].entries / 100);
}

/**
 * Rareté d'un acteur selon son rang de popularité TMDB (1 = le plus populaire)
 * parmi `total` acteurs importés : 1 % de Légendes, 4 % de Têtes d'affiche,
 * 15 % de Premiers rôles, 25 % de Seconds rôles, le reste en Figurants.
 */
export function actorRarityFromRank(rank: number, total: number): ActorRarity {
  const p = rank / Math.max(total, 1);
  if (p <= 0.01) return 'legende';
  if (p <= 0.05) return 'tete';
  if (p <= 0.2) return 'premier';
  if (p <= 0.45) return 'second';
  return 'figurant';
}

/** Ce qu'on sait d'un rôle au moment de l'import, pour lui donner sa rareté. */
export type RoleFacts = {
  /** Votes TMDB du film et note moyenne. */
  votes: number;
  average: number;
  /** Recettes mondiales en dollars (0 si inconnues). */
  revenue: number;
  /** Place au générique : 0 = premier nom. */
  order: number;
  /** Le film appartient à une saga (collection TMDB). */
  saga: boolean;
  /** Rang de notoriété de l'acteur parmi tous les acteurs importés (1 = le plus connu). */
  actorRank: number;
  /** Personnage choisi à la main parmi les Mythes. */
  mythe: boolean;
};

/** Seuils de l'échelle des Rôles (voir la règle de chaque rareté). */
export const ROLE_RULES = {
  sagaVotes: 5_000,
  bestSellerVotes: 12_000,
  bestSellerRevenue: 700_000_000,
  starRank: 400,
  starVotes: 3_000,
  culteVotes: 5_000,
  acclaimedAverage: 7.5,
  acclaimedVotes: 2_000,
  succesVotes: 1_000,
};

/** La rareté d'un rôle : la première règle qui correspond l'emporte, du Mythe à la Série B. */
export function roleRarity(f: RoleFacts): RoleRarity {
  const R = ROLE_RULES;
  if (f.mythe) return 'mythe';
  const bestSeller = f.votes >= R.bestSellerVotes || f.revenue >= R.bestSellerRevenue;
  // Icône : la tête d'affiche (deux premiers noms) d'une saga très vue ou d'un best-seller.
  if (f.order <= 1 && f.votes >= R.sagaVotes && (f.saga || bestSeller)) return 'icone';
  if (f.order <= 1 && f.actorRank <= R.starRank && f.votes >= R.starVotes) return 'vedette';
  if (f.votes >= R.culteVotes || (f.average >= R.acclaimedAverage && f.votes >= R.acclaimedVotes)) return 'culte';
  if (f.votes >= R.succesVotes) return 'succes';
  return 'serieb';
}
