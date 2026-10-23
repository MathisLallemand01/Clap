import type { ActorRarity, CardKind, Rarity, RoleRarity } from './rarity.ts';

export type Odds<R extends Rarity = Rarity> = Partial<Record<R, number>>;

export type Slot =
  | { kind: 'actor'; odds: Odds<ActorRarity> }
  | { kind: 'role'; odds: Odds<RoleRarity> };

export type BoosterGroup = 'permanent' | 'event' | 'country' | 'genre' | 'era';

/** Habillage du paquet : fond, motif, plaque du titre et teinte de la photo vedette. */
export type PackTheme = {
  bg: string;
  motif?: string;
  /** Bandeau en haut du paquet (sous la soudure). */
  band?: string;
  ink: string;
  plate: string;
  plateInk: string;
  accent: string;
  /** Couleur de teinte de la photo vedette (mode « color »), ou null pour la laisser en couleurs. */
  tint: string | null;
  tagline: string;
};

export type BoosterDef = {
  id: string;
  code: string;
  name: string;
  group: BoosterGroup;
  description: string;
  /** Prix en tickets quand on n'utilise pas une bobine offerte. */
  price: number;
  /** Les cartes doivent porter au moins un de ces tags (pays, genre, époque…). */
  tags?: string[];
  slots: Slot[];
  theme: PackTheme;
};

export const ACTOR_ODDS: Odds<ActorRarity> = { figurant: 58, second: 26, premier: 11, tete: 4, legende: 1 };
export const ROLE_ODDS: Odds<RoleRarity> = { serieb: 55, succes: 30, culte: 12, chef: 2.8, icone: 0.2 };
const ICON_ODDS: Odds<RoleRarity> = { serieb: 30, succes: 38, culte: 23, chef: 8, icone: 1 };
const THEME_ODDS: Odds<RoleRarity> = { serieb: 50, succes: 32, culte: 14, chef: 3.6, icone: 0.4 };
const SERIEB_ODDS: Odds<RoleRarity> = { serieb: 100 };

const actors = (n: number): Slot[] => Array.from({ length: n }, () => ({ kind: 'actor', odds: ACTOR_ODDS }));
const roles = (n: number, odds: Odds<RoleRarity> = ROLE_ODDS): Slot[] =>
  Array.from({ length: n }, () => ({ kind: 'role', odds }));
const mixed = (): Slot[] => [...actors(2), ...roles(3, THEME_ODDS)];

const stripes = (a: string, b: string, size = 1) =>
  `repeating-linear-gradient(-45deg, ${a} 0 ${size}em, ${b} ${size}em ${size * 2}em)`;
const halftone = (color: string, size = 0.55) => `radial-gradient(${color} 0.12em, transparent 0.15em) 0 0 / ${size}em ${size}em`;

export const BOOSTERS: BoosterDef[] = [
  {
    id: 'casting', code: '01', name: 'Casting', group: 'permanent', price: 300,
    description: 'Cinq cartes Acteur, du figurant à la légende.',
    slots: actors(5),
    theme: {
      bg: '#F2EFE8', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#F2EFE8', accent: '#FF4A1C', tint: null,
      band: stripes('#0B0B0D', '#F2EFE8', 0.9), motif: halftone('rgba(11,11,13,0.08)', 0.5), tagline: 'Audition générale',
    },
  },
  {
    id: 'avant-premiere', code: '02', name: 'Avant-première', group: 'permanent', price: 600,
    description: 'Quatre Acteurs et un Rôle garanti.',
    slots: [...actors(4), ...roles(1)],
    theme: {
      bg: '#FF4A1C', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#FF4A1C', accent: '#FFC83D', tint: null,
      motif: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.16) 0 0.5em, rgba(0,0,0,0) 0.5em 1.4em, rgba(255,255,255,0.06) 1.4em 1.6em, rgba(0,0,0,0) 1.6em 2.2em)',
      tagline: 'Tapis rouge · 1 rôle garanti',
    },
  },
  {
    id: 'icones', code: '03', name: 'Personnages iconiques', group: 'event', price: 1200,
    description: 'Les rôles qui ont marqué l’histoire. Chances d’Icône ×5.',
    slots: roles(5, ICON_ODDS),
    theme: {
      bg: 'linear-gradient(160deg, #FF2E93 0%, #FF6FB1 45%, #C21F72 100%)', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#FF2E93', accent: '#FFFFFF', tint: '#FF2E93',
      motif: 'repeating-linear-gradient(115deg, rgba(255,255,255,0) 0 1.2em, rgba(255,255,255,0.28) 1.2em 1.4em, rgba(255,255,255,0) 1.4em 2.8em)',
      tagline: 'Édition limitée · Icône ×5',
    },
  },
  {
    id: 'france', code: '05', name: 'Cinéma français', group: 'country', price: 800, tags: ['country:FR'],
    description: 'Des grands classiques au cinéma d’auteur d’aujourd’hui.',
    slots: mixed(),
    theme: {
      bg: 'linear-gradient(90deg, #2F4FCF 0 33.4%, #F2EFE8 33.4% 66.6%, #E5402A 66.6% 100%)', ink: '#0B0B0D', plate: '#F2EFE8', plateInk: '#0B0B0D', accent: '#2F4FCF', tint: null,
      motif: halftone('rgba(11,11,13,0.1)', 0.45), tagline: 'Nouvelle Vague et compagnie',
    },
  },
  {
    id: 'british', code: '06', name: 'Cinéma britannique', group: 'country', price: 800, tags: ['country:GB'],
    description: 'Londres, les Ealing Studios et leurs héritiers.',
    slots: mixed(),
    theme: {
      bg: '#1E5C43', ink: '#F2EFE8', plate: '#F2EFE8', plateInk: '#1E5C43', accent: '#E8C66A', tint: '#1E5C43',
      motif: 'repeating-linear-gradient(90deg, rgba(242,239,232,0) 0 1.8em, rgba(242,239,232,0.12) 1.8em 1.9em)', tagline: 'Keep calm and roll film',
    },
  },
  {
    id: 'hollywood', code: '07', name: 'Hollywood', group: 'country', price: 800, tags: ['country:US'],
    description: 'Les studios américains, de l’âge d’or aux indépendants.',
    slots: mixed(),
    theme: {
      bg: 'repeating-conic-gradient(from 0deg at 50% 38%, #1A1408 0 6deg, #2B210B 6deg 12deg)', ink: '#FFC83D', plate: '#FFC83D', plateInk: '#0B0B0D', accent: '#FFC83D', tint: null,
      tagline: 'Les projecteurs de L.A.',
    },
  },
  {
    id: 'asie', code: '08', name: 'Cinéma asiatique', group: 'country', price: 800, tags: ['country:JP', 'country:KR', 'country:CN', 'country:HK', 'country:IN', 'country:TW'],
    description: 'Japon, Corée du Sud, Hong Kong, Chine, Inde…',
    slots: mixed(),
    theme: {
      bg: 'radial-gradient(circle at 50% 36%, #E8202A 0 26%, #F2EFE8 26.5%)', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#F2EFE8', accent: '#E8202A', tint: null,
      motif: 'repeating-linear-gradient(0deg, rgba(11,11,13,0) 0 1.4em, rgba(11,11,13,0.05) 1.4em 1.5em)', tagline: 'De Tokyo à Bombay',
    },
  },
  {
    id: 'europe', code: '09', name: 'Cinéma européen', group: 'country', price: 800, tags: ['country:IT', 'country:ES', 'country:DE', 'country:BE', 'country:DK', 'country:SE'],
    description: 'Italie, Espagne, Allemagne, Belgique, Scandinavie.',
    slots: mixed(),
    theme: {
      bg: '#16307A', ink: '#FFD43B', plate: '#FFD43B', plateInk: '#16307A', accent: '#FFD43B', tint: '#16307A',
      motif: 'radial-gradient(circle at 50% 36%, rgba(0,0,0,0) 0 32%, rgba(255,212,59,0.5) 32% 32.6%, rgba(0,0,0,0) 33.2%)', tagline: 'Cinecittà, Madrid, Berlin',
    },
  },
  {
    id: 'blockbusters', code: '10', name: 'Blockbusters', group: 'genre', price: 800, tags: ['blockbuster'],
    description: 'Les rôles des plus gros succès en salle.',
    slots: roles(5, THEME_ODDS),
    theme: {
      bg: 'linear-gradient(#0B0B0D 0 12%, #123A8A 12% 88%, #0B0B0D 88%)', ink: '#F2EFE8', plate: '#4C8DFF', plateInk: '#0B0B0D', accent: '#4C8DFF', tint: null,
      motif: 'radial-gradient(circle at 50% 40%, rgba(76,141,255,0.55) 0, rgba(76,141,255,0) 60%)', tagline: 'Plus de 300 M$ au box-office',
    },
  },
  {
    id: 'action', code: '11', name: 'Action', group: 'genre', price: 800, tags: ['genre:action'],
    description: 'Cascades, poursuites et héros increvables.',
    slots: mixed(),
    theme: {
      bg: '#FFB000', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#FFB000', accent: '#0B0B0D', tint: '#FF4A1C',
      motif: 'repeating-conic-gradient(from 0deg at 50% 36%, rgba(11,11,13,0.14) 0 8deg, rgba(0,0,0,0) 8deg 16deg)', tagline: 'Boum. Fondu au noir.',
    },
  },
  {
    id: 'scifi', code: '12', name: 'Science-fiction', group: 'genre', price: 800, tags: ['genre:scifi'],
    description: 'Vaisseaux, androïdes et futurs proches.',
    slots: mixed(),
    theme: {
      bg: 'linear-gradient(#050A12 0 55%, #0B2530 100%)', ink: '#2EE6D6', plate: '#2EE6D6', plateInk: '#050A12', accent: '#2EE6D6', tint: '#2EE6D6',
      motif: 'linear-gradient(rgba(46,230,214,0.18) 0.06em, transparent 0.06em) 0 0 / 1.6em 1.6em, linear-gradient(90deg, rgba(46,230,214,0.18) 0.06em, transparent 0.06em) 0 0 / 1.6em 1.6em',
      tagline: 'Signal reçu de l’espace',
    },
  },
  {
    id: 'frissons', code: '13', name: 'Frissons', group: 'genre', price: 800, tags: ['genre:horror'],
    description: 'Horreur et épouvante. À ouvrir la lumière allumée.',
    slots: mixed(),
    theme: {
      bg: 'radial-gradient(circle at 50% 30%, #6E0B1F 0, #1A0207 70%)', ink: '#F2EFE8', plate: '#9E1230', plateInk: '#F2EFE8', accent: '#E0294F', tint: '#9E1230',
      motif: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 0.06em, rgba(0,0,0,0) 0.06em 1.3em)', tagline: 'Interdit aux âmes sensibles',
    },
  },
  {
    id: 'comedie', code: '14', name: 'Comédie', group: 'genre', price: 800, tags: ['genre:comedy'],
    description: 'Les rôles qui ont fait rire des générations.',
    slots: mixed(),
    theme: {
      bg: '#FFE14D', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#FFE14D', accent: '#FF4A1C', tint: null,
      motif: halftone('rgba(255,74,28,0.35)', 1.1), tagline: 'Fou rire garanti',
    },
  },
  {
    id: 'western', code: '15', name: 'Western', group: 'genre', price: 800, tags: ['genre:western'],
    description: 'Duels au soleil, saloons et grands espaces.',
    slots: [...actors(1), ...roles(4, THEME_ODDS)],
    theme: {
      bg: 'linear-gradient(#E9A35A 0 50%, #B65A2A 50% 100%)', ink: '#2A1205', plate: '#2A1205', plateInk: '#F4D7A8', accent: '#2A1205', tint: '#8A3C12',
      motif: halftone('rgba(42,18,5,0.18)', 0.6), tagline: 'Wanted · mort ou vif',
    },
  },
  {
    id: 'serie-b', code: '16', name: 'Série B', group: 'genre', price: 400,
    description: 'Nanars, navets et films oubliés. Série B garantie.',
    slots: roles(5, SERIEB_ODDS),
    theme: {
      bg: '#D9B48A', ink: '#2A1A0C', plate: '#B5302A', plateInk: '#F4E3C8', accent: '#B5302A', tint: '#8A5A2A',
      motif: halftone('rgba(42,26,12,0.28)'), tagline: 'Pulp · 100 % nanar',
    },
  },
  {
    id: 'age-dor', code: '17', name: 'Âge d’or', group: 'era', price: 800, tags: ['decade:1920', 'decade:1930', 'decade:1940', 'decade:1950', 'decade:1960'],
    description: 'Les classiques, des débuts du parlant aux années 60.',
    slots: mixed(),
    theme: {
      bg: '#E9E6DE', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#E9E6DE', accent: '#0B0B0D', tint: '#0B0B0D',
      motif: halftone('rgba(11,11,13,0.14)', 0.32), tagline: 'En noir et blanc',
    },
  },
  {
    id: 'annees-80', code: '18', name: 'Années 80', group: 'era', price: 800, tags: ['decade:1980'],
    description: 'VHS, néons et blockbusters de 1980 à 1989.',
    slots: mixed(),
    theme: {
      bg: 'linear-gradient(#1A0B2E 0 45%, #3B0F4F 100%)', ink: '#FF2E93', plate: '#2EE6D6', plateInk: '#1A0B2E', accent: '#FF2E93', tint: '#FF2E93',
      motif: 'repeating-linear-gradient(0deg, rgba(255,46,147,0.18) 0 0.08em, rgba(0,0,0,0) 0.08em 0.9em)', tagline: 'Rembobinez avant de rendre',
    },
  },
  {
    id: 'annees-90', code: '19', name: 'Années 90', group: 'era', price: 800, tags: ['decade:1990'],
    description: 'Du grunge au tournant du millénaire.',
    slots: mixed(),
    theme: {
      bg: '#B57BFF', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#C6F05A', accent: '#C6F05A', tint: null,
      motif: stripes('rgba(11,11,13,0.12)', 'rgba(0,0,0,0)', 0.5), tagline: 'Club vidéo · rayon nouveautés',
    },
  },
  {
    id: 'annees-2000', code: '20', name: 'Années 2000', group: 'era', price: 800, tags: ['decade:2000'],
    description: 'DVD, sagas et premiers super-héros.',
    slots: mixed(),
    theme: {
      bg: 'linear-gradient(135deg, #C9D3DD 0%, #8C9AA8 50%, #DCE3EA 100%)', ink: '#0B0B0D', plate: '#0B0B0D', plateInk: '#DCE3EA', accent: '#4C8DFF', tint: null,
      motif: 'repeating-radial-gradient(circle at 50% 36%, rgba(255,255,255,0.25) 0 0.1em, rgba(0,0,0,0) 0.1em 0.7em)', tagline: 'Bonus inclus sur le disque',
    },
  },
];

export const GROUP_LABELS: Record<BoosterGroup, string> = {
  permanent: 'Permanentes',
  event: 'Événements',
  country: 'Pays',
  genre: 'Genres',
  era: 'Époques',
};

export function getBooster(id: string): BoosterDef | undefined {
  return BOOSTERS.find((b) => b.id === id);
}

export function slotKinds(def: BoosterDef): Record<CardKind, number> {
  return def.slots.reduce(
    (acc, s) => ({ ...acc, [s.kind]: acc[s.kind] + 1 }),
    { actor: 0, role: 0 } as Record<CardKind, number>,
  );
}

/** Bobines offertes : une toutes les 4 heures, 3 en réserve au maximum. */
export const FREE_BOOSTER_EVERY_MS = 4 * 60 * 60 * 1000;
export const FREE_BOOSTER_CAP = 3;
