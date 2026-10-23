// Crée (ou remet à neuf) un compte de test aux tickets illimités.
// npm run account:test -- [e-mail] [mot de passe] [pseudo]
import { join } from 'node:path';
import { signUp } from '../src/lib/auth.ts';
import { openDb } from '../src/lib/db.ts';

const [email = 'test@clap.local', password = 'clap-test-2026', name = 'Testeur'] = process.argv.slice(2);
const db = openDb(process.env.CLAP_DB_PATH || join(process.cwd(), 'data', 'clap.db'));

let row = db.prepare('SELECT player_id FROM users WHERE email = ?').get(email.toLowerCase()) as { player_id: string } | undefined;
if (!row) {
  const user = await signUp(db, { name, email, password });
  row = { player_id: user.playerId };
  console.log(`Compte créé : ${name}`);
} else {
  console.log('Compte existant : tickets illimités réactivés.');
}
db.prepare('UPDATE players SET unlimited = 1, free_stock = 3 WHERE id = ?').run(row.player_id);
console.log(`E-mail : ${email}\nMot de passe : ${password}\nTickets : illimités`);
