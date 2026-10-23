// Recrée le catalogue de démarrage dans la base (sans toucher aux joueurs).
import { join } from 'node:path';
import { seedCatalog } from '../src/data/seed.ts';
import { openDb, upsertCards } from '../src/lib/db.ts';

const db = openDb(process.env.CLAP_DB_PATH || join(process.cwd(), 'data', 'clap.db'));
const cards = seedCatalog();
upsertCards(db, cards);
console.log(`${cards.length} cartes de démarrage en base.`);
