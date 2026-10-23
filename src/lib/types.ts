import type { CardKind, Rarity } from './rarity.ts';

/** Une carte du catalogue (le modèle, pas l'exemplaire possédé). */
export type Card = {
  id: string;
  kind: CardKind;
  personId: number;
  first: string;
  last: string;
  rarity: Rarity;
  /** Couleur de fond utilisée tant qu'aucune photo n'est disponible. */
  tone: string;
  /** URL de la photo (portrait pour un Acteur, photogramme pour un Rôle). */
  image?: string | null;
  origin?: string | null;
  movieId?: number | null;
  film?: string | null;
  year?: number | null;
  character?: string | null;
  /** Tags servant aux bobines thématiques : `country:FR`, `genre:scifi`, `decade:1980`, `blockbuster`. */
  tags: string[];
  /** Rang de popularité TMDB de l'acteur (1 = le plus populaire). */
  rank?: number | null;
  /** Nombre de votes TMDB du film (cartes Rôle). */
  votes?: number | null;
};

/** Un exemplaire possédé par un joueur. */
export type OwnedCard = Card & { serial: number; obtainedAt: number; copies: number };
