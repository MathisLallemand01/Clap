// Catalogue de démarrage, utilisé tant que l'import TMDB n'a pas tourné.
// Les raretés suivent les règles de src/lib/rarity.ts ; les Icônes sont choisies à la main.
import type { ActorRarity, RoleRarity } from '../lib/rarity.ts';
import type { Card } from '../lib/types.ts';

const TONES = ['#352C22', '#2E2A36', '#22303A', '#2A2F26', '#30262A', '#232A38', '#2E2B27', '#2B2A30', '#2A1622', '#1F2A3A'];

type ActorSeed = [first: string, last: string, origin: string, rarity: ActorRarity];
type RoleSeed = [actor: string, film: string, year: number, character: string, rarity: RoleRarity, tags: string[]];

const ACTORS: ActorSeed[] = [
  ['Tom', 'Cruise', 'US', 'legende'],
  ['Meryl', 'Streep', 'US', 'legende'],
  ['Al', 'Pacino', 'US', 'legende'],
  ['Harrison', 'Ford', 'US', 'legende'],
  ['Sigourney', 'Weaver', 'US', 'legende'],
  ['Alain', 'Delon', 'FR', 'legende'],
  ['Catherine', 'Deneuve', 'FR', 'legende'],
  ['Jean-Paul', 'Belmondo', 'FR', 'legende'],
  ['Louis', 'de Funès', 'FR', 'legende'],
  ['Isabelle', 'Huppert', 'FR', 'tete'],
  ['Marion', 'Cotillard', 'FR', 'tete'],
  ['Jean', 'Gabin', 'FR', 'tete'],
  ['Jean', 'Dujardin', 'FR', 'tete'],
  ['Omar', 'Sy', 'FR', 'tete'],
  ['Mahershala', 'Ali', 'US', 'tete'],
  ['Denzel', 'Washington', 'US', 'tete'],
  ['Heath', 'Ledger', 'AU', 'tete'],
  ['Kate', 'Winslet', 'GB', 'tete'],
  ['Hugh', 'Grant', 'GB', 'tete'],
  ['Léa', 'Seydoux', 'FR', 'premier'],
  ['Adèle', 'Exarchopoulos', 'FR', 'premier'],
  ['Tahar', 'Rahim', 'FR', 'premier'],
  ['Vincent', 'Cassel', 'FR', 'premier'],
  ['Jean', 'Reno', 'FR', 'premier'],
  ['Audrey', 'Tautou', 'FR', 'premier'],
  ['Dany', 'Boon', 'FR', 'premier'],
  ['Paul', 'Mescal', 'IE', 'premier'],
  ['Florence', 'Pugh', 'GB', 'premier'],
  ['Tilda', 'Swinton', 'GB', 'premier'],
  ['Hong', 'Chau', 'US', 'second'],
  ['Denis', 'Ménochet', 'FR', 'second'],
  ['Swann', 'Arlaud', 'FR', 'second'],
  ['Romain', 'Duris', 'FR', 'second'],
  ['Mathieu', 'Kassovitz', 'FR', 'second'],
  ['Val', 'Kilmer', 'US', 'second'],
  ['Kelly', 'McGillis', 'US', 'second'],
  ['Anthony', 'Edwards', 'US', 'second'],
  ['Philippe', 'Rebbot', 'FR', 'figurant'],
  ['Grégoire', 'Colin', 'FR', 'figurant'],
];

const ROLES: RoleSeed[] = [
  ['Heath Ledger', 'The Dark Knight', 2008, 'Le Joker', 'icone', ['country:US', 'blockbuster', 'genre:action']],
  ['Al Pacino', 'Le Parrain', 1972, 'Michael Corleone', 'icone', ['country:US']],
  ['Harrison Ford', 'La Guerre des étoiles', 1977, 'Han Solo', 'icone', ['country:US', 'genre:scifi', 'blockbuster']],
  ['Sigourney Weaver', 'Alien', 1979, 'Ripley', 'icone', ['country:US', 'country:GB', 'genre:scifi']],
  ['Jean-Paul Belmondo', 'À bout de souffle', 1960, 'Michel Poiccard', 'icone', ['country:FR']],
  ['Audrey Tautou', 'Le Fabuleux Destin d’Amélie Poulain', 2001, 'Amélie', 'icone', ['country:FR']],
  ['Mahershala Ali', 'Moonlight', 2016, 'Juan', 'chef', ['country:US']],
  ['Jean Gabin', 'La Grande Illusion', 1937, 'Maréchal', 'chef', ['country:FR']],
  ['Isabelle Huppert', 'Elle', 2016, 'Michèle', 'chef', ['country:FR']],
  ['Alain Delon', 'Le Samouraï', 1967, 'Jef Costello', 'chef', ['country:FR']],
  ['Harrison Ford', 'Blade Runner', 1982, 'Rick Deckard', 'chef', ['country:US', 'genre:scifi']],
  ['Tom Cruise', 'Top Gun', 1986, 'Maverick', 'culte', ['country:US', 'blockbuster', 'genre:action']],
  ['Val Kilmer', 'Top Gun', 1986, 'Iceman', 'culte', ['country:US', 'blockbuster', 'genre:action']],
  ['Kelly McGillis', 'Top Gun', 1986, 'Charlie', 'culte', ['country:US', 'blockbuster', 'genre:action']],
  ['Anthony Edwards', 'Top Gun', 1986, 'Goose', 'culte', ['country:US', 'blockbuster', 'genre:action']],
  ['Tom Cruise', 'Collateral', 2004, 'Vincent', 'culte', ['country:US']],
  ['Al Pacino', 'Scarface', 1983, 'Tony Montana', 'culte', ['country:US']],
  ['Meryl Streep', 'Le Diable s’habille en Prada', 2006, 'Miranda Priestly', 'culte', ['country:US', 'genre:comedy']],
  ['Denzel Washington', 'Training Day', 2001, 'Alonzo Harris', 'culte', ['country:US']],
  ['Kate Winslet', 'Titanic', 1997, 'Rose', 'culte', ['country:US', 'blockbuster']],
  ['Jean Reno', 'Léon', 1994, 'Léon', 'culte', ['country:FR', 'genre:action']],
  ['Vincent Cassel', 'La Haine', 1995, 'Vinz', 'culte', ['country:FR']],
  ['Omar Sy', 'Intouchables', 2011, 'Driss', 'culte', ['country:FR', 'genre:comedy']],
  ['Louis de Funès', 'La Grande Vadrouille', 1966, 'Stanislas', 'culte', ['country:FR', 'genre:comedy']],
  ['Catherine Deneuve', 'Les Parapluies de Cherbourg', 1964, 'Geneviève', 'culte', ['country:FR']],
  ['Marion Cotillard', 'La Môme', 2007, 'Édith Piaf', 'culte', ['country:FR']],
  ['Tahar Rahim', 'Un prophète', 2009, 'Malik', 'culte', ['country:FR']],
  ['Léa Seydoux', 'La Vie d’Adèle', 2013, 'Emma', 'culte', ['country:FR']],
  ['Adèle Exarchopoulos', 'La Vie d’Adèle', 2013, 'Adèle', 'culte', ['country:FR']],
  ['Jean Dujardin', 'The Artist', 2011, 'George Valentin', 'culte', ['country:FR']],
  ['Denis Ménochet', 'Inglourious Basterds', 2009, 'LaPadite', 'culte', ['country:US']],
  ['Tom Cruise', 'Mission: Impossible', 1996, 'Ethan Hunt', 'succes', ['country:US', 'blockbuster', 'genre:action']],
  ['Tom Cruise', 'Minority Report', 2002, 'John Anderton', 'succes', ['country:US', 'genre:scifi']],
  ['Tom Cruise', 'Edge of Tomorrow', 2014, 'William Cage', 'succes', ['country:US', 'genre:scifi', 'blockbuster']],
  ['Jean Reno', 'Les Visiteurs', 1993, 'Godefroy', 'succes', ['country:FR', 'genre:comedy']],
  ['Jean Dujardin', 'OSS 117 : Le Caire, nid d’espions', 2006, 'OSS 117', 'succes', ['country:FR', 'genre:comedy']],
  ['Dany Boon', 'Bienvenue chez les Ch’tis', 2008, 'Antoine', 'succes', ['country:FR', 'genre:comedy']],
  ['Hong Chau', 'The Whale', 2022, 'Liz', 'succes', ['country:US']],
  ['Hugh Grant', 'Coup de foudre à Notting Hill', 1999, 'William Thacker', 'succes', ['country:GB', 'genre:comedy']],
  ['Paul Mescal', 'Aftersun', 2022, 'Calum', 'succes', ['country:GB']],
  ['Florence Pugh', 'Midsommar', 2019, 'Dani', 'succes', ['country:US']],
  ['Tilda Swinton', 'Michael Clayton', 2007, 'Karen Crowder', 'succes', ['country:US']],
  ['Tom Cruise', 'Losin’ It', 1983, 'Woody', 'serieb', ['country:US']],
  ['Romain Duris', 'Le Péril jeune', 1994, 'Tomasi', 'serieb', ['country:FR']],
  ['Mathieu Kassovitz', 'Métisse', 1993, 'Félix', 'serieb', ['country:FR']],
];

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const decadeTag = (year: number) => `decade:${Math.floor(year / 10) * 10}`;

export function seedCatalog(): Card[] {
  const byName = new Map<string, { personId: number; first: string; last: string; origin: string }>();
  const cards: Card[] = ACTORS.map(([first, last, origin, rarity], i) => {
    const personId = -(i + 1);
    byName.set(`${first} ${last}`, { personId, first, last, origin });
    return {
      id: `actor:${slug(`${first} ${last}`)}`,
      kind: 'actor',
      personId,
      first,
      last,
      origin,
      rarity,
      tone: TONES[i % TONES.length],
      tags: [`country:${origin}`],
    };
  });

  ROLES.forEach(([actor, film, year, character, rarity, tags], i) => {
    const person = byName.get(actor);
    if (!person) throw new Error(`Rôle sans acteur dans le catalogue : ${actor}`);
    cards.push({
      id: `role:${slug(actor)}:${slug(film)}`,
      kind: 'role',
      personId: person.personId,
      first: person.first,
      last: person.last,
      origin: person.origin,
      rarity,
      tone: TONES[(i * 3) % TONES.length],
      film,
      year,
      character,
      tags: [...tags, decadeTag(year)],
    });
  });

  return cards;
}
