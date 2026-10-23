import type { DatabaseSync } from 'node:sqlite';
import { getCard } from './catalog.ts';
import type { Card } from './types.ts';

/**
 * Les bonnes nouvelles qui arrivent pendant l'absence du joueur (une carte vendue au Guichet,
 * un échange accepté, un cadeau reçu) : elles l'attendent et s'affichent en grand à sa prochaine visite.
 */
export type CelebrationPayload =
  | { kind: 'sale'; cardId: string; serial: number; price: number; received: number; buyer: string }
  | { kind: 'trade'; partner: string; received: { cardId: string; serial: number }[]; tickets: number; gave: number; gaveTickets: number }
  | { kind: 'gift'; from: string; received: { cardId: string; serial: number }[]; tickets: number };

/** Ce que la popup affiche, prêt à l'emploi. */
export type Celebration = {
  id: number;
  kind: CelebrationPayload['kind'];
  eyebrow: string;
  title: string;
  sub: string;
  cards: (Card & { serial: number })[];
  stamp: string | null;
  /** Gain en tickets (positif) ou dépense (négatif), à mettre en valeur. */
  tickets: number;
  lines: string[];
  href: string;
  hrefLabel: string;
};

export function queueCelebration(db: DatabaseSync, playerId: string, payload: CelebrationPayload, now = Date.now()): void {
  db.prepare('INSERT INTO celebrations (player_id, kind, payload, created_at) VALUES (?, ?, ?, ?)').run(playerId, payload.kind, JSON.stringify(payload), now);
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

function view(db: DatabaseSync, id: number, p: CelebrationPayload): Celebration | null {
  const cards = (list: { cardId: string; serial: number }[]) =>
    list.flatMap((o) => { const c = getCard(db, o.cardId); return c ? [{ ...c, serial: o.serial }] : []; });
  switch (p.kind) {
    case 'sale': {
      const card = getCard(db, p.cardId);
      if (!card) return null;
      return {
        id, kind: p.kind, eyebrow: '✓ Carte vendue au Guichet', stamp: 'Vendu !',
        title: card.character ?? `${card.first} ${card.last}`,
        sub: `${p.buyer} l’a achetée ${p.price.toLocaleString('fr-FR')} tickets.`,
        cards: [{ ...card, serial: p.serial }], tickets: p.received,
        lines: [`Commission du Guichet : ${(p.price - p.received).toLocaleString('fr-FR')} TK`],
        href: '/guichet?vue=mes-annonces', hrefLabel: 'Mes annonces',
      };
    }
    case 'trade': {
      const got = cards(p.received);
      return {
        id, kind: p.kind, eyebrow: '⇄ Échange conclu', stamp: 'Échangé !',
        title: got.length === 1 ? (got[0].character ?? `${got[0].first} ${got[0].last}`) : got.length ? `${plural(got.length, 'carte')} reçues` : 'Tickets reçus',
        sub: `Avec ${p.partner} · vous avez donné ${p.gave ? plural(p.gave, 'carte') : ''}${p.gave && p.gaveTickets ? ' et ' : ''}${p.gaveTickets ? `${p.gaveTickets.toLocaleString('fr-FR')} tickets` : ''}${!p.gave && !p.gaveTickets ? 'rien' : ''}.`,
        cards: got, tickets: p.tickets, lines: [],
        href: '/collection', hrefLabel: 'Voir ma collection',
      };
    }
    case 'gift': {
      const got = cards(p.received);
      return {
        id, kind: p.kind, eyebrow: '🎁 Cadeau reçu', stamp: 'Cadeau !',
        title: got.length === 1 ? (got[0].character ?? `${got[0].first} ${got[0].last}`) : got.length ? `${plural(got.length, 'carte')} offertes` : `${p.tickets.toLocaleString('fr-FR')} tickets`,
        sub: `${p.from} vous fait un cadeau.`,
        cards: got, tickets: p.tickets, lines: [],
        href: '/collection', hrefLabel: 'Voir ma collection',
      };
    }
  }
}

/** La plus ancienne bonne nouvelle pas encore vue. */
export function nextCelebration(db: DatabaseSync, playerId: string): Celebration | null {
  const rows = db.prepare('SELECT id, payload FROM celebrations WHERE player_id = ? AND seen_at IS NULL ORDER BY id LIMIT 5').all(playerId) as { id: number; payload: string }[];
  for (const r of rows) {
    const v = view(db, r.id, JSON.parse(r.payload) as CelebrationPayload);
    if (v) return v;
    markCelebrationSeen(db, playerId, r.id);
  }
  return null;
}

export function markCelebrationSeen(db: DatabaseSync, playerId: string, id: number, now = Date.now()): void {
  db.prepare('UPDATE celebrations SET seen_at = ? WHERE id = ? AND player_id = ?').run(now, id, playerId);
}
