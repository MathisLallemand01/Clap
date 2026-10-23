import type { Card } from './types.ts';

/**
 * Les musiques cultes : quand on tire le Rôle de l'acteur principal d'un de ces films, sa musique se lance
 * (Tom Cruise dans Top Gun : Maverick → « Hold My Hand »). Un extrait officiel de 30 secondes est cherché
 * dans le catalogue public d'Apple (iTunes Search) au moment de jouer, avec un lien vers le titre complet.
 *
 * Le film est reconnu dans le catalogue par son année de sortie, le nom de l'acteur et un mot du titre
 * (en français ou en anglais) : aucune dépendance aux identifiants d'un import TMDB particulier.
 */
export type Theme = { song: string; artist: string };
type Entry = { year: number; titles: string[]; leads: string[]; song: string; artist: string };

const e = (year: number, titles: string | string[], leads: string | string[], song: string, artist: string): Entry =>
  ({ year, titles: [titles].flat(), leads: [leads].flat(), song, artist });

const ENTRIES: Entry[] = [
  e(2022, 'maverick', 'Tom Cruise', 'Hold My Hand', 'Lady Gaga'),
  e(1986, 'top gun', 'Tom Cruise', 'Danger Zone', 'Kenny Loggins'),
  e(1996, 'mission', 'Tom Cruise', 'Theme from Mission: Impossible', 'Adam Clayton & Larry Mullen'),
  e(1983, 'risky business', 'Tom Cruise', 'Old Time Rock & Roll', 'Bob Seger'),
  e(1988, 'cocktail', 'Tom Cruise', 'Kokomo', 'The Beach Boys'),
  e(1997, 'titanic', ['Leonardo DiCaprio', 'Kate Winslet'], 'My Heart Will Go On', 'Céline Dion'),
  e(1996, ['romeo', 'roméo'], ['Leonardo DiCaprio', 'Claire Danes'], 'Kissing You', "Des'ree"),
  e(2010, 'inception', 'Leonardo DiCaprio', 'Time', 'Hans Zimmer'),
  e(1976, 'rocky', 'Sylvester Stallone', 'Gonna Fly Now', 'Bill Conti'),
  e(1982, 'rocky iii', 'Sylvester Stallone', 'Eye of the Tiger', 'Survivor'),
  e(1985, 'rocky iv', 'Sylvester Stallone', 'Burning Heart', 'Survivor'),
  e(1982, ['rambo', 'first blood'], 'Sylvester Stallone', "It's a Long Road", 'Dan Hill'),
  e(1992, 'bodyguard', ['Kevin Costner', 'Whitney Houston'], 'I Will Always Love You', 'Whitney Houston'),
  e(1991, ['robin hood', 'robin des bois'], 'Kevin Costner', '(Everything I Do) I Do It for You', 'Bryan Adams'),
  e(1987, 'dirty dancing', ['Patrick Swayze', 'Jennifer Grey'], "(I've Had) The Time of My Life", 'Bill Medley & Jennifer Warnes'),
  e(1990, 'ghost', ['Patrick Swayze', 'Demi Moore'], 'Unchained Melody', 'The Righteous Brothers'),
  e(1984, ['ghostbusters', 'sos fantômes'], ['Bill Murray', 'Dan Aykroyd'], 'Ghostbusters', 'Ray Parker Jr.'),
  e(1985, ['back to the future', 'retour vers le futur'], 'Michael J. Fox', 'The Power of Love', 'Huey Lewis & The News'),
  e(1984, 'footloose', 'Kevin Bacon', 'Footloose', 'Kenny Loggins'),
  e(1983, 'flashdance', 'Jennifer Beals', 'Flashdance... What a Feeling', 'Irene Cara'),
  e(1980, 'fame', 'Irene Cara', 'Fame', 'Irene Cara'),
  e(1977, ['saturday night fever', 'fièvre du samedi soir'], 'John Travolta', "Stayin' Alive", 'Bee Gees'),
  e(1978, 'grease', ['John Travolta', 'Olivia Newton-John'], "You're the One That I Want", 'John Travolta & Olivia Newton-John'),
  e(1994, 'pulp fiction', ['John Travolta', 'Samuel L. Jackson', 'Uma Thurman'], 'Misirlou', 'Dick Dale'),
  e(1992, 'reservoir dogs', ['Michael Madsen', 'Harvey Keitel'], 'Stuck in the Middle with You', 'Stealers Wheel'),
  e(2003, 'kill bill', 'Uma Thurman', 'Battle Without Honor or Humanity', 'Tomoyasu Hotei'),
  e(1997, 'jackie brown', 'Pam Grier', 'Across 110th Street', 'Bobby Womack'),
  e(1990, 'pretty woman', ['Julia Roberts', 'Richard Gere'], 'Oh, Pretty Woman', 'Roy Orbison'),
  e(1999, 'notting hill', ['Julia Roberts', 'Hugh Grant'], 'She', 'Elvis Costello'),
  e(2003, 'love actually', 'Hugh Grant', 'Jump (For My Love)', 'Girls Aloud'),
  e(1998, 'armageddon', 'Bruce Willis', "I Don't Want to Miss a Thing", 'Aerosmith'),
  e(1962, ['dr. no', 'dr no'], 'Sean Connery', 'James Bond Theme', 'Monty Norman'),
  e(1964, 'goldfinger', 'Sean Connery', 'Goldfinger', 'Shirley Bassey'),
  e(2006, 'casino royale', 'Daniel Craig', 'You Know My Name', 'Chris Cornell'),
  e(2012, 'skyfall', 'Daniel Craig', 'Skyfall', 'Adele'),
  e(2021, ['no time to die', 'mourir peut attendre'], 'Daniel Craig', 'No Time to Die', 'Billie Eilish'),
  e(2002, '8 mile', 'Eminem', 'Lose Yourself', 'Eminem'),
  e(2014, ['guardians of the galaxy', 'gardiens de la galaxie'], 'Chris Pratt', 'Hooked on a Feeling', 'Blue Swede'),
  e(1992, "wayne's world", 'Mike Myers', 'Bohemian Rhapsody', 'Queen'),
  e(2018, 'bohemian rhapsody', 'Rami Malek', 'Bohemian Rhapsody', 'Queen'),
  e(1986, 'highlander', 'Christopher Lambert', 'Princes of the Universe', 'Queen'),
  e(1985, 'breakfast club', ['Judd Nelson', 'Molly Ringwald', 'Emilio Estevez'], "Don't You (Forget About Me)", 'Simple Minds'),
  e(1986, 'ferris bueller', 'Matthew Broderick', 'Oh Yeah', 'Yello'),
  e(1994, 'forrest gump', 'Tom Hanks', 'Forrest Gump Suite', 'Alan Silvestri'),
  e(1993, 'philadelphia', 'Tom Hanks', 'Streets of Philadelphia', 'Bruce Springsteen'),
  e(1977, ['star wars', 'guerre des étoiles'], ['Mark Hamill', 'Harrison Ford', 'Carrie Fisher'], 'Main Title (Star Wars)', 'John Williams'),
  e(1980, ['empire strikes back', 'empire contre-attaque'], ['Mark Hamill', 'Harrison Ford', 'Carrie Fisher'], 'The Imperial March', 'John Williams'),
  e(1981, ['raiders', 'arche perdue'], 'Harrison Ford', 'Raiders March', 'John Williams'),
  e(1993, 'jurassic park', ['Sam Neill', 'Laura Dern', 'Jeff Goldblum'], 'Theme from Jurassic Park', 'John Williams'),
  e(1975, ['jaws', 'dents de la mer'], 'Roy Scheider', 'Main Title (Theme from Jaws)', 'John Williams'),
  e(1978, 'superman', 'Christopher Reeve', 'Superman March', 'John Williams'),
  e(1982, 'e.t.', 'Henry Thomas', 'Flying (Theme from E.T.)', 'John Williams'),
  e(2001, 'harry potter', ['Daniel Radcliffe', 'Emma Watson', 'Rupert Grint'], "Hedwig's Theme", 'John Williams'),
  e(1972, ['godfather', 'parrain'], ['Marlon Brando', 'Al Pacino'], 'Speak Softly Love (Love Theme from The Godfather)', 'Nino Rota'),
  e(1983, 'scarface', 'Al Pacino', 'Push It to the Limit', 'Paul Engemann'),
  e(1976, 'taxi driver', 'Robert De Niro', 'Main Title (Taxi Driver)', 'Bernard Herrmann'),
  e(1966, ['good, the bad', 'bon, la brute'], 'Clint Eastwood', 'The Good, the Bad and the Ugly', 'Ennio Morricone'),
  e(1968, ['once upon a time in the west', "il était une fois dans l'ouest"], ['Charles Bronson', 'Henry Fonda', 'Claudia Cardinale'], 'Man with a Harmonica', 'Ennio Morricone'),
  e(1988, 'paradiso', 'Philippe Noiret', 'Cinema Paradiso', 'Ennio Morricone'),
  e(2003, 'black pearl', ['Johnny Depp', 'Orlando Bloom', 'Keira Knightley'], "He's a Pirate", 'Klaus Badelt'),
  e(2000, 'gladiator', 'Russell Crowe', 'Now We Are Free', 'Hans Zimmer & Lisa Gerrard'),
  e(2014, 'interstellar', 'Matthew McConaughey', 'Cornfield Chase', 'Hans Zimmer'),
  e(2008, 'dark knight', ['Christian Bale', 'Heath Ledger'], 'Why So Serious?', 'Hans Zimmer & James Newton Howard'),
  e(2021, 'dune', 'Timothée Chalamet', "Paul's Dream", 'Hans Zimmer'),
  e(2023, 'oppenheimer', 'Cillian Murphy', 'Can You Hear the Music', 'Ludwig Göransson'),
  e(2001, ['fellowship', "communauté de l'anneau"], 'Elijah Wood', 'Concerning Hobbits', 'Howard Shore'),
  e(1996, 'trainspotting', 'Ewan McGregor', 'Lust for Life', 'Iggy Pop'),
  e(2001, 'moulin rouge', ['Nicole Kidman', 'Ewan McGregor'], 'Lady Marmalade', 'Christina Aguilera, Lil Kim, Mya & P!nk'),
  e(1999, 'fight club', ['Edward Norton', 'Brad Pitt'], 'Where Is My Mind?', 'Pixies'),
  e(2011, 'drive', 'Ryan Gosling', 'Nightcall', 'Kavinsky'),
  e(2016, 'la la land', ['Ryan Gosling', 'Emma Stone'], 'City of Stars', 'Ryan Gosling & Emma Stone'),
  e(2023, 'barbie', 'Margot Robbie', 'Dance the Night', 'Dua Lipa'),
  e(2023, 'barbie', 'Ryan Gosling', "I'm Just Ken", 'Ryan Gosling'),
  e(2018, 'star is born', ['Lady Gaga', 'Bradley Cooper'], 'Shallow', 'Lady Gaga & Bradley Cooper'),
  e(2017, 'greatest showman', 'Hugh Jackman', 'The Greatest Show', 'Hugh Jackman'),
  e(2008, 'mamma mia', ['Meryl Streep', 'Amanda Seyfried'], 'Mamma Mia', 'ABBA'),
  e(2019, 'rocketman', 'Taron Egerton', 'Your Song', 'Taron Egerton'),
  e(1984, 'beverly hills', 'Eddie Murphy', 'Axel F', 'Harold Faltermeyer'),
  e(1984, 'terminator', 'Arnold Schwarzenegger', 'The Terminator Theme', 'Brad Fiedel'),
  e(1991, 'terminator 2', 'Arnold Schwarzenegger', 'You Could Be Mine', "Guns N' Roses"),
  e(1997, 'men in black', 'Will Smith', 'Men in Black', 'Will Smith'),
  e(1995, 'bad boys', ['Will Smith', 'Martin Lawrence'], 'Bad Boys', 'Inner Circle'),
  e(1999, 'matrix', 'Keanu Reeves', 'Wake Up', 'Rage Against the Machine'),
  e(2015, 'fury road', ['Tom Hardy', 'Charlize Theron'], 'Brothers in Arms', 'Junkie XL'),
  e(2008, 'twilight', ['Kristen Stewart', 'Robert Pattinson'], 'Decode', 'Paramore'),
  e(2015, ['fifty shades', 'cinquante nuances'], 'Dakota Johnson', 'Love Me Like You Do', 'Ellie Goulding'),
  e(2015, ['furious 7', 'fast & furious 7'], ['Vin Diesel', 'Paul Walker'], 'See You Again', 'Wiz Khalifa'),
  e(2002, 'spider-man', 'Tobey Maguire', 'Hero', 'Chad Kroeger'),
  e(2008, 'iron man', 'Robert Downey Jr.', 'Back in Black', 'AC/DC'),
  e(2019, 'endgame', 'Robert Downey Jr.', 'Portals', 'Alan Silvestri'),
  e(2018, 'black panther', 'Chadwick Boseman', 'All the Stars', 'Kendrick Lamar & SZA'),
  e(2016, 'deadpool', 'Ryan Reynolds', 'Angel of the Morning', 'Juice Newton'),
  e(2019, 'joker', 'Joaquin Phoenix', 'Bathroom Dance', 'Hildur Guðnadóttir'),
  e(2014, 'whiplash', 'Miles Teller', 'Caravan', 'Hank Levy'),
  e(2017, 'baby driver', 'Ansel Elgort', 'Bellbottoms', 'The Jon Spencer Blues Explosion'),
  e(1989, 'batman', 'Michael Keaton', 'The Batman Theme', 'Danny Elfman'),
  e(1961, ["breakfast at tiffany", 'diamants sur canapé'], 'Audrey Hepburn', 'Moon River', 'Audrey Hepburn'),
  e(1943, 'casablanca', ['Humphrey Bogart', 'Ingrid Bergman'], 'As Time Goes By', 'Dooley Wilson'),
  e(1952, ["singin'", 'chantons sous la pluie'], 'Gene Kelly', "Singin' in the Rain", 'Gene Kelly'),
  e(1939, ['wizard of oz', "magicien d'oz"], 'Judy Garland', 'Over the Rainbow', 'Judy Garland'),
  e(1939, ['gone with the wind', 'autant en emporte le vent'], ['Vivien Leigh', 'Clark Gable'], "Tara's Theme", 'Max Steiner'),
  e(1965, ['sound of music', 'mélodie du bonheur'], 'Julie Andrews', 'The Sound of Music', 'Julie Andrews'),
  e(1964, 'mary poppins', 'Julie Andrews', 'Supercalifragilisticexpialidocious', 'Julie Andrews & Dick Van Dyke'),
  e(1960, ['psycho', 'psychose'], 'Anthony Perkins', 'Prelude (Psycho)', 'Bernard Herrmann'),
  e(1968, '2001', 'Keir Dullea', 'Also sprach Zarathustra', 'Richard Strauss'),
  e(1971, ['clockwork orange', 'orange mécanique'], 'Malcolm McDowell', 'Title Music from A Clockwork Orange', 'Wendy Carlos'),
  e(1962, 'lawrence', "Peter O'Toole", 'Lawrence of Arabia: Overture', 'Maurice Jarre'),
  e(1965, ['zhivago', 'jivago'], 'Omar Sharif', "Lara's Theme", 'Maurice Jarre'),
  e(1963, ['pink panther', 'panthère rose'], ['Peter Sellers', 'David Niven'], 'The Pink Panther Theme', 'Henry Mancini'),
  e(1971, ['shaft', 'nuits rouges de harlem'], 'Richard Roundtree', 'Theme from Shaft', 'Isaac Hayes'),
  e(1967, ['graduate', 'lauréat'], ['Dustin Hoffman', 'Anne Bancroft'], 'Mrs. Robinson', 'Simon & Garfunkel'),
  e(1969, ['midnight cowboy', 'macadam cowboy'], ['Jon Voight', 'Dustin Hoffman'], "Everybody's Talkin'", 'Harry Nilsson'),
  e(1969, 'easy rider', ['Peter Fonda', 'Dennis Hopper'], 'Born to Be Wild', 'Steppenwolf'),
  e(1980, 'blues brothers', ['John Belushi', 'Dan Aykroyd'], 'Everybody Needs Somebody to Love', 'The Blues Brothers'),
  e(1984, 'purple rain', 'Prince', 'Purple Rain', 'Prince'),
  e(1986, 'stand by me', ['Wil Wheaton', 'River Phoenix'], 'Stand by Me', 'Ben E. King'),
  e(1992, 'sister act', 'Whoopi Goldberg', 'I Will Follow Him', 'Sister Act'),
  e(1984, ['karate kid', 'karaté kid'], 'Ralph Macchio', "You're the Best", 'Joe Esposito'),
  e(1984, ['neverending', 'histoire sans fin'], 'Noah Hathaway', 'Never Ending Story', 'Limahl'),
  e(2000, 'billy elliot', 'Jamie Bell', 'Cosmic Dancer', 'T. Rex'),
  e(1997, 'full monty', 'Robert Carlyle', 'You Sexy Thing', 'Hot Chocolate'),
  e(2008, 'slumdog', 'Dev Patel', 'Jai Ho', 'A. R. Rahman'),
  e(1973, ['exorcist', 'exorciste'], ['Ellen Burstyn', 'Linda Blair'], 'Tubular Bells', 'Mike Oldfield'),
  e(1978, ['halloween', 'nuit des masques'], 'Jamie Lee Curtis', 'Halloween Theme', 'John Carpenter'),
  e(2000, 'requiem for a dream', ['Jared Leto', 'Ellen Burstyn'], 'Lux Aeterna', 'Clint Mansell'),
  e(2001, 'amélie', 'Audrey Tautou', "Comptine d'un autre été : l'après-midi", 'Yann Tiersen'),
  e(2011, 'intouchables', ['Omar Sy', 'François Cluzet'], 'Una mattina', 'Ludovico Einaudi'),
  e(1988, ['grand bleu', 'big blue'], ['Jean-Marc Barr', 'Jean Reno'], 'The Big Blue Overture', 'Éric Serra'),
  e(1994, 'léon', ['Jean Reno', 'Natalie Portman'], 'Shape of My Heart', 'Sting'),
  e(1966, 'un homme et une femme', ['Jean-Louis Trintignant', 'Anouk Aimée'], 'Un homme et une femme', 'Francis Lai'),
  e(1964, 'parapluies de cherbourg', 'Catherine Deneuve', 'Les parapluies de Cherbourg', 'Michel Legrand'),
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").trim();

const byLead = new Map<string, Entry[]>();
for (const entry of ENTRIES) for (const lead of entry.leads) {
  const key = norm(lead);
  byLead.set(key, [...(byLead.get(key) ?? []), entry]);
}

/** La musique culte d'une carte, si c'est le Rôle d'un acteur principal d'un film qui en a une. */
export function themeFor(card: Pick<Card, 'kind' | 'first' | 'last' | 'film' | 'year'>): Theme | null {
  if (card.kind !== 'role' || !card.film || !card.year) return null;
  const candidates = byLead.get(norm(`${card.first} ${card.last}`));
  if (!candidates) return null;
  const film = norm(card.film);
  // Le titre le plus précis l'emporte (« rocky iii » plutôt que « rocky », « terminator 2 » plutôt que « terminator »).
  // L'année exacte écarte les suites (Harry Potter 2, Kill Bill 2…).
  let best: { entry: Entry; length: number } | null = null;
  for (const entry of candidates) {
    if (entry.year !== card.year) continue;
    for (const t of entry.titles) {
      const title = norm(t);
      if (film.includes(title) && (!best || title.length > best.length)) best = { entry, length: title.length };
    }
  }
  return best ? { song: best.entry.song, artist: best.entry.artist } : null;
}

/** Nombre de films à musique culte connus (pour l'affichage). */
export const THEME_COUNT = ENTRIES.length;
