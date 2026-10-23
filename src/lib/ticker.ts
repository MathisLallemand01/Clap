import type { DatabaseSync } from 'node:sqlite';
import { BOOSTERS } from './boosters.ts';
import { getCard, getCatalog, showcase } from './catalog.ts';
import { formatEntries, formatNumber } from './format.ts';
import { recentSales } from './market.ts';
import { MISSIONS } from './missions.ts';
import { RARITIES } from './rarity.ts';
import type { Card } from './types.ts';

// Les lignes du bandeau défilant : de vraies données du jeu, jamais inventées.

export type TickerItem = {
  key: string;
  color: string;
  /** Pastille ronde (acteur) ou losange (rôle). */
  shape: 'dot' | 'diamond';
  who?: string;
  text: string;
  value?: string;
  /** Variation en couleur (ventes). */
  delta?: { text: string; tone: 'up' | 'down' | 'flat' };
  href?: string;
};

function cardText(c: Card): string {
  return c.kind === 'role' ? `${c.first} ${c.last} — ${c.film}`.trim() : `${c.first} ${c.last}`.trim();
}

function cardHref(c: Card): string {
  return c.kind === 'role' ? `/role/${encodeURIComponent(c.id)}` : `/acteur/${c.personId}`;
}

function fromCard(c: Card, key: string, who?: string): TickerItem {
  const r = RARITIES[c.rarity];
  return { key, color: r.color, shape: c.kind === 'role' ? 'diamond' : 'dot', who, text: cardText(c), value: formatEntries(r.entries), href: cardHref(c) };
}

/** Les plus beaux tirages récents (rang 3 et plus). Complété par les vedettes du catalogue tant que le jeu est calme. */
export function tickerDrops(db: DatabaseSync, limit = 24): TickerItem[] {
  const rows = db.prepare(`
    SELECT o.id, o.card_id, u.name FROM owned o
    JOIN pulls p ON p.id = o.pull_id
    LEFT JOIN users u ON u.player_id = o.player_id
    ORDER BY o.obtained_at DESC LIMIT 400`).all() as { id: number; card_id: string; name: string | null }[];
  const items: TickerItem[] = [];
  for (const r of rows) {
    const c = getCard(db, r.card_id);
    if (!c || RARITIES[c.rarity].tier < 3) continue;
    items.push(fromCard(c, `o${r.id}`, r.name ?? 'Un joueur'));
    if (items.length >= limit) break;
  }
  if (items.length < 8) {
    for (const c of showcase(db, { count: 12 - items.length, rarities: ['icone', 'legende', 'chef'] })) {
      items.push({ ...fromCard(c, `s${c.id}`), who: 'À gagner' });
    }
  }
  return items;
}

/** Les dernières ventes du Guichet, avec l'écart au prix conseillé. */
export function tickerSales(db: DatabaseSync, limit = 20): TickerItem[] {
  return recentSales(db, limit).map((l) => {
    const diff = Math.round(((l.price - l.suggested) / l.suggested) * 100);
    const r = RARITIES[l.card.rarity];
    return {
      key: `l${l.id}`, color: r.color, shape: l.card.kind === 'role' ? 'diamond' : 'dot',
      text: l.card.kind === 'role' ? `${l.card.last} · ${l.card.character}` : `${l.card.first} ${l.card.last}`.trim(),
      value: `${formatNumber(l.price)} T`,
      delta: { text: diff > 0 ? `▲ ${diff} %` : diff < 0 ? `▼ ${-diff} %` : '= 0 %', tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' },
      href: cardHref(l.card),
    } satisfies TickerItem;
  });
}

/** Les infos « À l'affiche » : catalogue, bobines, rythme du jeu. */
export function tickerNews(db: DatabaseSync): TickerItem[] {
  const catalog = getCatalog(db);
  const actors = catalog.filter((c) => c.kind === 'actor').length;
  const icons = catalog.filter((c) => c.rarity === 'icone').length;
  const themed = BOOSTERS.filter((b) => b.group !== 'permanent').map((b) => b.name);
  const daily = MISSIONS.filter((m) => m.scope === 'daily').reduce((sum, m) => sum + m.reward, 0);
  const pick = themed[Math.floor(Date.now() / 86_400_000) % Math.max(themed.length, 1)];
  const plain = (key: string, text: string): TickerItem => ({ key, color: 'var(--ink)', shape: 'dot', text });
  return [
    plain('cat', `${formatNumber(actors)} acteurs · ${formatNumber(catalog.length - actors)} rôles`),
    plain('free', 'Une bobine offerte toutes les 4 heures'),
    plain('day', `Bobine du jour : ${pick}`),
    plain('icons', `${icons} Icônes à débusquer`),
    plain('mission', `Missions du jour : jusqu’à +${daily} tickets`),
    plain('packs', `${BOOSTERS.length} bobines thématiques`),
  ];
}
