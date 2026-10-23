// L'économie des tickets : ce qui en fait gagner (prime du jour, recyclage, compte) et le journal.
// Les tickets n'ont aucune valeur réelle et ne s'achètent pas.
import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './db.ts';
import { GameError } from './game.ts';
import { RARITIES, suggestedTickets, type Rarity } from './rarity.ts';

export const DAILY_BONUS = 100;
export const SIGNUP_BONUS = 300;
/** Un doublon recyclé rapporte la moitié du prix conseillé de sa rareté. */
export const RECYCLE_RATE = 0.5;

export type LedgerReason = 'booster' | 'daily' | 'recycle' | 'signup';

export const REASON_LABELS: Record<LedgerReason, string> = {
  booster: 'Bobine',
  daily: 'Prime du jour',
  recycle: 'Recyclage',
  signup: 'Bienvenue',
};

export type LedgerEntry = { id: number; amount: number; reason: LedgerReason; detail: string | null; createdAt: number };

/** Le jour (AAAA-MM-JJ) à Paris : la prime du jour se renouvelle à minuit, heure française. */
export function parisDay(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function recycleValue(rarity: Rarity): number {
  return Math.max(2, Math.round(suggestedTickets(rarity) * RECYCLE_RATE));
}

/** Crédite (ou débite) des tickets et l'inscrit au journal. À appeler dans une transaction. */
export function credit(db: DatabaseSync, playerId: string, amount: number, reason: LedgerReason, detail: string | null, now: number): void {
  db.prepare('UPDATE players SET tickets = tickets + ? WHERE id = ?').run(amount, playerId);
  db.prepare('INSERT INTO ledger (player_id, amount, reason, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(playerId, amount, reason, detail, now);
}

export function dailyAvailable(lastDaily: string | null, now = Date.now()): boolean {
  return lastDaily !== parisDay(now);
}

/** Prend la prime du jour ; refusée si elle a déjà été prise aujourd'hui. Renvoie le nouveau solde. */
export function claimDaily(db: DatabaseSync, playerId: string, now = Date.now()): number {
  return transaction(db, () => {
    const day = parisDay(now);
    const { changes } = db.prepare('UPDATE players SET last_daily = ? WHERE id = ? AND (last_daily IS NULL OR last_daily <> ?)')
      .run(day, playerId, day);
    if (Number(changes) === 0) throw new GameError('daily-taken', 'La prime du jour a déjà été prise. Revenez demain.');
    credit(db, playerId, DAILY_BONUS, 'daily', null, now);
    return (db.prepare('SELECT tickets FROM players WHERE id = ?').get(playerId) as { tickets: number }).tickets;
  });
}

export type Duplicate = { cardId: string; rarity: Rarity; extra: number; value: number };

/** Les doublons d'un joueur : les exemplaires en trop de chaque carte (on garde le meilleur numéro). */
export function getDuplicates(db: DatabaseSync, playerId: string, cardId?: string): Duplicate[] {
  const rows = db.prepare(`
    SELECT o.card_id AS card_id, c.rarity AS rarity, COUNT(*) - 1 AS extra
    FROM owned o JOIN cards c ON c.id = o.card_id
    WHERE o.player_id = ? ${cardId ? 'AND o.card_id = ?' : ''}
    GROUP BY o.card_id HAVING COUNT(*) > 1`).all(...(cardId ? [playerId, cardId] : [playerId])) as { card_id: string; rarity: Rarity; extra: number }[];
  return rows.map((r) => ({ cardId: r.card_id, rarity: r.rarity, extra: r.extra, value: r.extra * recycleValue(r.rarity) }));
}

export type RecycleResult = { cards: number; copies: number; tickets: number; balance: number };

/**
 * Recycle les doublons (tous, ou ceux d'une carte) : chaque carte garde son exemplaire au plus petit
 * numéro de série, les autres sont échangés contre des tickets.
 */
export function recycleDuplicates(db: DatabaseSync, playerId: string, { cardId, now = Date.now() }: { cardId?: string; now?: number } = {}): RecycleResult {
  return transaction(db, () => {
    const dups = getDuplicates(db, playerId, cardId);
    if (dups.length === 0) throw new GameError('nothing-to-recycle', 'Aucun doublon à recycler.');
    const remove = db.prepare(`
      DELETE FROM owned WHERE player_id = ? AND card_id = ?
        AND id <> (SELECT id FROM owned WHERE player_id = ? AND card_id = ? ORDER BY serial, id LIMIT 1)`);
    let copies = 0;
    let tickets = 0;
    for (const d of dups) {
      copies += Number(remove.run(playerId, d.cardId, playerId, d.cardId).changes);
      tickets += d.value;
    }
    const detail = dups.length === 1 ? `${copies} × ${RARITIES[dups[0].rarity].label}` : `${copies} doublons`;
    credit(db, playerId, tickets, 'recycle', detail, now);
    const balance = (db.prepare('SELECT tickets FROM players WHERE id = ?').get(playerId) as { tickets: number }).tickets;
    return { cards: dups.length, copies, tickets, balance };
  });
}

/** Le bonus de bienvenue, versé une seule fois par joueur (à la création du compte). */
export function grantSignupBonus(db: DatabaseSync, playerId: string, now = Date.now()): boolean {
  const already = db.prepare("SELECT 1 FROM ledger WHERE player_id = ? AND reason = 'signup'").get(playerId);
  if (already) return false;
  credit(db, playerId, SIGNUP_BONUS, 'signup', null, now);
  return true;
}

export function getLedger(db: DatabaseSync, playerId: string, limit = 30): LedgerEntry[] {
  return (db.prepare('SELECT id, amount, reason, detail, created_at FROM ledger WHERE player_id = ? ORDER BY id DESC LIMIT ?')
    .all(playerId, limit) as { id: number; amount: number; reason: LedgerReason; detail: string | null; created_at: number }[])
    .map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, detail: r.detail, createdAt: r.created_at }));
}
