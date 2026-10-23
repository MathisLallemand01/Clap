import type { ActorRarity, CardKind, Rarity, RoleRarity } from './rarity.ts';

export type Odds<R extends Rarity = Rarity> = Partial<Record<R, number>>;

export type Slot =
  | { kind: 'actor'; odds: Odds<ActorRarity> }
  | { kind: 'role'; odds: Odds<RoleRarity> };

export type BoosterGroup = 'permanent' | 'event' | 'country' | 'genre' | 'era';

/**
 * Habillage du paquet : un aluminium sombre teinté d'une seule couleur, la vedette en photo atténuée,
 * le titre en capitales condensées du site.
 */
export type PackTheme = {
  /** La teinte du thème (reflets, logo, filet sous le titre, pastille). */
  hue: string;
  /** Haut du fond, sombre et légèrement teinté (le bas tombe au noir). */
  base: string;
  /** Soudures métalliques en haut et en bas. */
  metal: string;
  /** Petite étiquette au-dessus du titre. */
  label: string;
  /** Titre imprimé sur le paquet, s'il diffère du nom (retours à la ligne permis). */
  title?: string;
  /** Pastille de chance, seulement quand elle apprend quelque chose : [petit texte, grand texte]. */
  chance?: [string, string];
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
  /**
   * Réserve spéciale : `themes` = uniquement les Rôles principaux des films à musique culte ;
   * `famous` = uniquement les grands rôles (Culte et au-dessus) des films les plus vus.
   */
  pool?: 'themes' | 'famous';
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

/** La réserve « Bande originale » est petite et déjà prestigieuse : les crans du bas y sont rares. */
const SOUNDTRACK_ODDS: Odds<RoleRarity> = { serieb: 4, succes: 36, culte: 42, chef: 14, icone: 4 };
/** Panthéon : que du très rare, l'Icône n'y est pas une exception. */
const PANTHEON_ODDS: Odds<RoleRarity> = { culte: 40, chef: 45, icone: 15 };
const CINEMATHEQUE_ODDS: Odds<RoleRarity> = { chef: 94, icone: 6 };

type Spec = Omit<BoosterDef, 'code' | 'slots' | 'theme'> & { slots?: Slot[]; theme: PackTheme };
const specs: Spec[] = [
  { id: 'casting', name: 'Casting', group: 'permanent', price: 300,
    description: 'Cinq cartes Acteur, du figurant à la légende.', slots: actors(5),
    theme: { hue: '#A9B8D0', base: '#1A2232', metal: '#2A3446', label: 'PERMANENTE', chance: ['LÉGENDE', '1 %'] } },
  { id: 'avant-premiere', name: 'Avant-première', group: 'permanent', price: 600,
    description: 'Quatre Acteurs et un Rôle garanti.', slots: [...actors(4), ...roles(1)],
    theme: { hue: '#E2A28A', base: '#2E1714', metal: '#4A2620', label: 'PERMANENTE', title: 'Avant-\npremière', chance: ['GARANTI', '1 RÔLE'] } },
  { id: 'icones', name: 'Personnages iconiques', group: 'event', price: 1200,
    description: 'Les rôles qui ont marqué l’histoire. Chances d’Icône ×5.', slots: roles(5, ICON_ODDS),
    theme: { hue: '#A88BFF', base: '#1E1640', metal: '#2E2458', label: 'ÉVÉNEMENT', title: 'Icônes', chance: ['ICÔNE', '×5'] } },
  { id: 'cinematheque', name: 'Cinémathèque', group: 'event', price: 1500,
    description: 'Uniquement des chefs-d’œuvre : des rôles Chef-d’œuvre et Icône, rien d’autre.', slots: roles(5, CINEMATHEQUE_ODDS),
    theme: { hue: '#E8DCC0', base: '#221F18', metal: '#38332A', label: 'ÉVÉNEMENT', title: 'Cinéma-\nthèque', chance: ['RANG', '4–5'] } },
  { id: 'france', name: 'Cinéma français', group: 'country', price: 800, tags: ['country:FR'],
    description: 'Des grands classiques au cinéma d’auteur d’aujourd’hui.',
    theme: { hue: '#8EA6E8', base: '#141B38', metal: '#232D5A', label: 'PAYS', title: 'Cinéma\nfrançais' } },
  { id: 'british', name: 'Cinéma britannique', group: 'country', price: 800, tags: ['country:GB'],
    description: 'Londres, les Ealing Studios et leurs héritiers.',
    theme: { hue: '#8FBFA0', base: '#10241A', metal: '#1B3828', label: 'PAYS', title: 'Royaume-\nUni' } },
  { id: 'hollywood', name: 'Hollywood', group: 'country', price: 800, tags: ['country:US'],
    description: 'Les studios américains, de l’âge d’or aux indépendants.',
    theme: { hue: '#E6B964', base: '#2C1F0A', metal: '#4A3512', label: 'PAYS · ÉTATS-UNIS' } },
  { id: 'asie', name: 'Cinéma asiatique', group: 'country', price: 800, tags: ['country:JP', 'country:KR', 'country:CN', 'country:HK', 'country:IN', 'country:TW'],
    description: 'Japon, Corée du Sud, Hong Kong, Chine, Inde…',
    theme: { hue: '#7FD1B9', base: '#0E241F', metal: '#183A32', label: 'PAYS', title: 'Asie' } },
  { id: 'coree', name: 'Cinéma coréen', group: 'country', price: 800, tags: ['country:KR'],
    description: 'De Bong Joon-ho à Park Chan-wook : la vague coréenne.',
    theme: { hue: '#E87A8E', base: '#2A0E16', metal: '#451824', label: 'PAYS', title: 'Corée' } },
  { id: 'bollywood', name: 'Bollywood', group: 'country', price: 800, tags: ['country:IN'],
    description: 'Le cinéma indien, de Bombay à Chennai.',
    theme: { hue: '#F0A84E', base: '#2C1A08', metal: '#4A2C10', label: 'PAYS · INDE' } },
  { id: 'europe', name: 'Cinéma européen', group: 'country', price: 800, tags: ['country:IT', 'country:ES', 'country:DE', 'country:BE', 'country:DK', 'country:SE'],
    description: 'Italie, Espagne, Allemagne, Belgique, Scandinavie.',
    theme: { hue: '#6FA8C8', base: '#0E1E2A', metal: '#18303F', label: 'PAYS', title: 'Europe' } },
  { id: 'italie', name: 'Dolce Vita', group: 'country', price: 800, tags: ['country:IT'],
    description: 'Cinecittà, Fellini, Loren et le cinéma italien.',
    theme: { hue: '#D98466', base: '#2A140E', metal: '#45221A', label: 'PAYS · ITALIE', title: 'Dolce\nVita' } },
  { id: 'espagne', name: 'Cine español', group: 'country', price: 800, tags: ['country:ES', 'country:MX'],
    description: 'Espagne et Mexique : Almodóvar, del Toro et compagnie.',
    theme: { hue: '#D9574E', base: '#2A0C0A', metal: '#451614', label: 'ESPAGNE · MEXIQUE', title: 'España' } },
  { id: 'blockbusters', name: 'Blockbusters', group: 'genre', price: 800, tags: ['blockbuster'],
    description: 'Les rôles des plus gros succès en salle.', slots: roles(5, THEME_ODDS),
    theme: { hue: '#F08A4B', base: '#2A1408', metal: '#46220E', label: 'GENRE', title: 'Block-\nbusters' } },
  { id: 'action', name: 'Action', group: 'genre', price: 800, tags: ['genre:action'],
    description: 'Cascades, poursuites et héros increvables.',
    theme: { hue: '#E0624A', base: '#2A0F0B', metal: '#461A12', label: 'GENRE' } },
  { id: 'scifi', name: 'Science-fiction', group: 'genre', price: 800, tags: ['genre:scifi'],
    description: 'Vaisseaux, androïdes et futurs proches.',
    theme: { hue: '#5FD3C8', base: '#0A2226', metal: '#12363B', label: 'GENRE', title: 'Science-\nfiction' } },
  { id: 'frissons', name: 'Frissons', group: 'genre', price: 800, tags: ['genre:horror'],
    description: 'Horreur et épouvante. À ouvrir la lumière allumée.',
    theme: { hue: '#C2483F', base: '#260808', metal: '#3E0E0E', label: 'GENRE' } },
  { id: 'comedie', name: 'Comédie', group: 'genre', price: 800, tags: ['genre:comedy'],
    description: 'Les rôles qui ont fait rire des générations.',
    theme: { hue: '#E8C35A', base: '#2A220A', metal: '#463814', label: 'GENRE' } },
  { id: 'drames', name: 'Grands drames', group: 'genre', price: 800, tags: ['genre:drama'],
    description: 'Les grands rôles dramatiques, ceux qui font les Oscars.',
    theme: { hue: '#C79BB8', base: '#24121F', metal: '#3A1E33', label: 'GENRE', title: 'Grands\ndrames' } },
  { id: 'western', name: 'Western', group: 'genre', price: 800, tags: ['genre:western'],
    description: 'Duels au soleil, saloons et grands espaces.', slots: [...actors(1), ...roles(4, THEME_ODDS)],
    theme: { hue: '#CFA066', base: '#2A1A0C', metal: '#45301A', label: 'GENRE' } },
  { id: 'serie-b', name: 'Série B', group: 'genre', price: 400,
    description: 'Nanars, navets et films oubliés. Série B garantie.', slots: roles(5, SERIEB_ODDS),
    theme: { hue: '#B9C76A', base: '#1E220C', metal: '#323817', label: 'GENRE', chance: ['GARANTI', 'NANAR'] } },
  { id: 'age-dor', name: 'Âge d’or', group: 'era', price: 800, tags: ['decade:1920', 'decade:1930', 'decade:1940', 'decade:1950', 'decade:1960'],
    description: 'Les classiques, des débuts du parlant aux années 60.',
    theme: { hue: '#D8CFC0', base: '#22201C', metal: '#3A372F', label: 'ÉPOQUE · 1920 – 1969' } },
  { id: 'annees-70', name: 'Années 70', group: 'era', price: 800, tags: ['decade:1970'],
    description: 'Le Nouvel Hollywood : Coppola, Scorsese, Pacino, De Niro.',
    theme: { hue: '#D9925A', base: '#2A160A', metal: '#452612', label: 'ÉPOQUE', title: 'Années\n70' } },
  { id: 'annees-80', name: 'Années 80', group: 'era', price: 800, tags: ['decade:1980'],
    description: 'VHS, néons et blockbusters de 1980 à 1989.',
    theme: { hue: '#E07AB8', base: '#2A0E26', metal: '#43173E', label: 'ÉPOQUE', title: 'Années\n80' } },
  { id: 'annees-90', name: 'Années 90', group: 'era', price: 800, tags: ['decade:1990'],
    description: 'Grunge, effets spéciaux et cinéma indépendant.',
    theme: { hue: '#6FB7E0', base: '#0E2030', metal: '#17334A', label: 'ÉPOQUE', title: 'Années\n90' } },
  { id: 'annees-2000', name: 'Années 2000', group: 'era', price: 800, tags: ['decade:2000'],
    description: 'Le passage au numérique et les grandes sagas.',
    theme: { hue: '#9FC9A8', base: '#12241A', metal: '#1C3A2A', label: 'ÉPOQUE', title: 'Années\n2000' } },
  { id: 'annees-2010', name: 'Années 2010', group: 'era', price: 800, tags: ['decade:2010'],
    description: 'Super-héros, plateformes et nouveaux auteurs.',
    theme: { hue: '#E8907A', base: '#2A1210', metal: '#451E1A', label: 'ÉPOQUE', title: 'Années\n2010' } },
  { id: 'nouveautes', name: 'Nouveautés', group: 'era', price: 800, tags: ['decade:2020'],
    description: 'Les films sortis depuis 2020.',
    theme: { hue: '#8C9BFF', base: '#141A3E', metal: '#222A60', label: 'DEPUIS 2020' } },
  { id: 'tout-clap', name: 'Tout Clap', group: 'permanent', price: 500,
    description: 'Tout le cinéma répertorié, sans thème : n’importe quel acteur, n’importe quel rôle.', slots: [...actors(2), ...roles(3)],
    theme: { hue: '#FF4A1C', base: '#2A0F08', metal: '#46190E', label: 'PERMANENTE', title: 'Tout\nClap', chance: ['TOUT LE', 'CINÉMA'] } },
  { id: 'bande-originale', name: 'Bande originale', group: 'event', price: 1000, pool: 'themes',
    description: 'Uniquement les acteurs principaux des films à musique culte : chaque carte lance sa musique.', slots: roles(5, SOUNDTRACK_ODDS),
    theme: { hue: '#F2C14E', base: '#2A2008', metal: '#463812', label: 'ÉVÉNEMENT', title: 'Bande\noriginale', chance: ['♪', 'MUSIQUE'] } },
  { id: 'pantheon', name: 'Panthéon', group: 'event', price: 2000, pool: 'famous',
    description: 'Uniquement les films que tout le monde a vus, et leurs plus grands rôles : Culte, Chef-d’œuvre, Icône.', slots: roles(5, PANTHEON_ODDS),
    theme: { hue: '#FFC83D', base: '#2A2008', metal: '#4A3A10', label: 'ÉVÉNEMENT', chance: ['ICÔNE', '15 %'] } },
];

export const BOOSTERS: BoosterDef[] = specs.map((s, i) => ({ ...s, code: String(i + 1).padStart(2, '0'), slots: s.slots ?? mixed() }));

/** L'ordre des catégories à l'écran : les événements d'abord. */
export const GROUP_LABELS: Record<BoosterGroup, string> = {
  event: 'Événements',
  permanent: 'Permanentes',
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

/** Bobines arrivées avec la refonte : marquées « Nouveau » sur la page des bobines. */
export const NEW_BOOSTERS = new Set(['pantheon', 'tout-clap', 'bande-originale', 'cinematheque', 'coree', 'bollywood', 'italie', 'espagne', 'drames', 'annees-70', 'annees-2010', 'nouveautes']);

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** Un lundi à minuit (UTC) : les semaines d'événement partent de là. */
const WEEK_ORIGIN = Date.UTC(2026, 0, 5);

/** La bobine du jour : une bobine thématique différente chaque jour. */
export function boosterOfTheDay(now = Date.now()): BoosterDef {
  const themed = BOOSTERS.filter((b) => b.group !== 'permanent' && b.group !== 'event');
  return themed[Math.floor(now / DAY_MS) % themed.length];
}

/** L'événement de la semaine (les bobines Événement tournent chaque lundi) et sa fin. */
export function featuredEvent(now = Date.now()): { booster: BoosterDef; endsAt: number } {
  const events = BOOSTERS.filter((b) => b.group === 'event');
  const week = Math.floor((now - WEEK_ORIGIN) / WEEK_MS);
  return { booster: events[((week % events.length) + events.length) % events.length], endsAt: WEEK_ORIGIN + (week + 1) * WEEK_MS };
}
