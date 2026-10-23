import type { ActorRarity, CardKind, Rarity, RoleRarity } from './rarity.ts';

export type Odds<R extends Rarity = Rarity> = Partial<Record<R, number>>;

export type Slot =
  | { kind: 'actor'; odds: Odds<ActorRarity> }
  | { kind: 'role'; odds: Odds<RoleRarity> };

export type BoosterGroup = 'permanent' | 'event' | 'country' | 'genre' | 'era';

export type BoosterDef = {
  id: string;
  code: string;
  name: string;
  /** Texte de l'étiquette ronde ; `\n` coupe la ligne. */
  label: string;
  group: BoosterGroup;
  description: string;
  /** Prix en tickets quand on n'utilise pas une bobine offerte. */
  price: number;
  /** Les cartes doivent porter ce tag (pays, genre, époque…). */
  tag?: string;
  slots: Slot[];
  look: { disc: string; ink: string; pattern?: string; accent: string };
};

export const ACTOR_ODDS: Odds<ActorRarity> = { figurant: 58, second: 26, premier: 11, tete: 4, legende: 1 };
export const ROLE_ODDS: Odds<RoleRarity> = { serieb: 55, succes: 30, culte: 12, chef: 2.8, icone: 0.2 };
const ICON_ODDS: Odds<RoleRarity> = { serieb: 30, succes: 38, culte: 23, chef: 8, icone: 1 };
const SERIEB_ODDS: Odds<RoleRarity> = { serieb: 100 };

const actors = (n: number): Slot[] => Array.from({ length: n }, () => ({ kind: 'actor', odds: ACTOR_ODDS }));
const roles = (n: number, odds: Odds<RoleRarity> = ROLE_ODDS): Slot[] =>
  Array.from({ length: n }, () => ({ kind: 'role', odds }));
const mixed = (): Slot[] => [...actors(3), ...roles(2)];

const stripes = (color: string) =>
  `repeating-linear-gradient(115deg, rgba(0,0,0,0) 0 1em, ${color} 1em 1.2em, rgba(0,0,0,0) 1.2em 2.4em)`;

export const BOOSTERS: BoosterDef[] = [
  {
    id: 'casting', code: '01', name: 'Casting', label: 'Casting', group: 'permanent', price: 300,
    description: 'Cinq cartes Acteur, du figurant à la légende.',
    slots: actors(5),
    look: { disc: '#F2EFE8', ink: '#0B0B0D', accent: '#F2EFE8' },
  },
  {
    id: 'avant-premiere', code: '02', name: 'Avant-première', label: 'Avant-\npremière', group: 'permanent', price: 600,
    description: 'Quatre Acteurs et un Rôle garanti.',
    slots: [...actors(4), ...roles(1)],
    look: { disc: '#FF4A1C', ink: '#0B0B0D', accent: '#FF4A1C' },
  },
  {
    id: 'icones', code: '03', name: 'Personnages iconiques', label: 'Icônes', group: 'event', price: 1200,
    description: 'Les rôles qui ont marqué l’histoire. Chances d’Icône ×5.',
    slots: roles(5, ICON_ODDS),
    look: { disc: '#FF2E93', ink: '#0B0B0D', pattern: stripes('rgba(255,255,255,0.22)'), accent: '#FF2E93' },
  },
  {
    id: 'france', code: '05', name: 'Cinéma français', label: 'Cinéma\nfrançais', group: 'country', price: 800, tag: 'country:FR',
    description: 'Des grands classiques au cinéma d’auteur d’aujourd’hui.',
    slots: mixed(),
    look: { disc: 'linear-gradient(90deg, #5B83FF 0 33.4%, #F2EFE8 33.4% 66.6%, #FF5A3C 66.6% 100%)', ink: '#0B0B0D', accent: '#5B83FF' },
  },
  {
    id: 'british', code: '06', name: 'Cinéma britannique', label: 'British', group: 'country', price: 800, tag: 'country:GB',
    description: 'Londres, les Ealing Studios et leurs héritiers.',
    slots: mixed(),
    look: {
      disc: '#1E5C43', ink: '#F2EFE8', accent: '#3DDC97',
      pattern: 'radial-gradient(circle, rgba(0,0,0,0) 0 4.4em, #F2EFE8 4.4em 4.5em, rgba(0,0,0,0) 4.5em 4.75em, #F2EFE8 4.75em 4.85em, rgba(0,0,0,0) 4.85em)',
    },
  },
  {
    id: 'hollywood', code: '07', name: 'Hollywood', label: 'Holly-\nwood', group: 'country', price: 800, tag: 'country:US',
    description: 'Les studios américains, de l’âge d’or aux indépendants.',
    slots: mixed(),
    look: { disc: '#FFC83D', ink: '#0B0B0D', accent: '#FFC83D', pattern: 'repeating-conic-gradient(from 0deg, rgba(11,11,13,0.12) 0 9deg, rgba(0,0,0,0) 9deg 18deg)' },
  },
  {
    id: 'blockbusters', code: '09', name: 'Blockbusters', label: 'Block-\nbusters', group: 'genre', price: 800, tag: 'blockbuster',
    description: 'Les rôles des plus gros succès en salle.',
    slots: roles(5),
    look: { disc: 'linear-gradient(#0B0B0D 0 22%, #4C8DFF 22% 78%, #0B0B0D 78%)', ink: '#0B0B0D', accent: '#4C8DFF' },
  },
  {
    id: 'scifi', code: '11', name: 'Science-fiction', label: 'Sci-fi', group: 'genre', price: 800, tag: 'genre:scifi',
    description: 'Vaisseaux, androïdes et futurs proches.',
    slots: [...actors(1), ...roles(4)],
    look: { disc: '#2EE6D6', ink: '#0B0B0D', accent: '#2EE6D6', pattern: 'repeating-radial-gradient(circle, rgba(11,11,13,0.2) 0 0.12em, rgba(0,0,0,0) 0.12em 0.9em)' },
  },
  {
    id: 'serie-b', code: '13', name: 'Série B', label: 'Série B', group: 'genre', price: 400,
    description: 'Nanars, navets et films oubliés. Série B garantie.',
    slots: roles(5, SERIEB_ODDS),
    look: { disc: '#D9B48A', ink: '#0B0B0D', accent: '#D9B48A', pattern: 'radial-gradient(rgba(11,11,13,0.28) 0.12em, rgba(0,0,0,0) 0.15em) 0 0 / 0.55em 0.55em' },
  },
  {
    id: 'annees-80', code: '15', name: 'Années 80', label: '80’s', group: 'era', price: 800, tag: 'decade:1980',
    description: 'VHS, néons et blockbusters de 1980 à 1989.',
    slots: mixed(),
    look: { disc: 'linear-gradient(135deg, #FF2E93 0 50%, #2EE6D6 50% 100%)', ink: '#0B0B0D', accent: '#2EE6D6', pattern: 'repeating-linear-gradient(0deg, rgba(11,11,13,0.16) 0 0.1em, rgba(0,0,0,0) 0.1em 0.4em)' },
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
