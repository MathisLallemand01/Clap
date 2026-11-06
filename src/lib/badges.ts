import type { DatabaseSync } from 'node:sqlite';
import { ownedCardIds } from './catalog.ts';
import { queueCelebration } from './celebrations.ts';
import { completedSagaCount } from './collections.ts';
import { transaction } from './db.ts';
import { addTickets, countDuos, GameError } from './game.ts';
import { visitStreak } from './missions.ts';
import { countEvents, notifyPlayer } from './notify.ts';
import { RARITIES } from './rarity.ts';

// Le Palmarès : des distinctions décrochées en jouant. Chacune a un à trois niveaux, couleur des lauriers :
// Court métrage (bronze), Long métrage (argent), Chef-d'œuvre (or). Chaque niveau rapporte des tickets.

export const LEVELS = [
  { level: 1, label: 'Court métrage', metal: 'bronze', color: '#C98A4B', weight: 1 },
  { level: 2, label: 'Long métrage', metal: 'argent', color: '#C9CED6', weight: 2 },
  { level: 3, label: 'Chef-d’œuvre', metal: 'or', color: '#FFC83D', weight: 3 },
] as const;
export const levelInfo = (level: number) => LEVELS[Math.min(3, Math.max(1, level)) - 1];

/** Icônes des distinctions (tracés SVG 24×24, au trait). */
export const BADGE_ICONS: Record<string, string> = {
  clap: 'M2 10h20v10H2z|M2 10 4 4l16-2 1 5',
  play: 'M7 4v16l13-8z',
  star: 'm12 3 2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 16.6 6.4 20l1.5-6.3L3 9.5 9.4 9z',
  diamond: 'M12 2 22 12 12 22 2 12z',
  film: 'M3 3h18v18H3z|M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4',
  duo: 'M4.5 9a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M12.5 9a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M2 20c1-4 4-6 6-6s5 2 6 6M10 20c1-4 4-6 6-6s5 2 6 6',
  reel: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0|M10 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0|M10 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0|M5 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0|M15 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  tv: 'M3 6h18v13H3z|m8 2 4 4 4-4',
  hammer: 'm14 4 6 6M4 20l9-9|M12 3l9 9-3 3-9-9z',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z|M14 7v10',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  producer: 'M12 2v20|M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  cal: 'M3 5h18v16H3z|M3 10h18M8 3v4M16 3v4',
  trailer: 'M4 5h16v14H4z|m10 9 5 3-5 3z',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  credits: 'M4 4h16M7 8h10M5 12h14M8 16h8M10 20h4',
  lock: 'M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4',
};

export type BadgeCategory = 'tournage' | 'collection' | 'commerce' | 'fidelite';
export const CATEGORIES: { id: BadgeCategory; label: string; sub: string }[] = [
  { id: 'tournage', label: 'Tournage', sub: 'Les bobines' },
  { id: 'collection', label: 'Collection', sub: 'La filmothèque' },
  { id: 'commerce', label: 'Guichet et échanges', sub: 'Le commerce' },
  { id: 'fidelite', label: 'Fidélité et secrets', sub: 'La séance' },
];

type Stats = {
  pulls: number; unique: number; duos: number; sagas: number; series: number; top: number; mythes: number;
  sales: number; trades: number; wins: number; flips: number; streak: number; trailers: number; midnight: number; credits: number;
};

export type BadgeDef = {
  id: string;
  name: string;
  icon: keyof typeof BADGE_ICONS;
  category: BadgeCategory;
  /** Ce qu'il faut faire, avec {n} pour le seuil du prochain niveau. */
  desc: string;
  /** Seuils par niveau (1 à 3 valeurs) ; le premier niveau correspond au premier seuil. */
  steps: number[];
  /** Niveau du premier seuil (une distinction unique peut valoir directement l'argent ou l'or). */
  firstLevel?: 1 | 2 | 3;
  /** Tickets versés à chaque niveau. */
  rewards: number[];
  secret?: boolean;
  /** Indice affiché tant qu'une distinction secrète n'est pas décrochée. */
  hint?: string;
  value: (s: Stats) => number;
};

export const BADGES: BadgeDef[] = [
  { id: 'premier-clap', name: 'Premier clap', icon: 'clap', category: 'tournage', desc: 'Ouvrir sa toute première bobine.', steps: [1], rewards: [50], value: (s) => s.pulls },
  { id: 'moteur', name: 'Moteur… Action !', icon: 'play', category: 'tournage', desc: 'Ouvrir {n} bobines.', steps: [100, 500, 2000], rewards: [150, 400, 1000], value: (s) => s.pulls },
  { id: 'tapis-rouge', name: 'Tapis rouge', icon: 'star', category: 'tournage', desc: 'Tirer une Légende ou une Icône.', steps: [1], firstLevel: 2, rewards: [200], value: (s) => s.top },
  { id: 'mythe-vivant', name: 'Mythe vivant', icon: 'diamond', category: 'tournage', desc: 'Posséder {n} carte(s) Mythe.', steps: [1, 5, 15], rewards: [500, 1000, 2500], value: (s) => s.mythes },
  { id: 'cinephile', name: 'Cinéphile', icon: 'film', category: 'collection', desc: 'Posséder {n} cartes différentes.', steps: [100, 1000, 5000], rewards: [200, 600, 2000], value: (s) => s.unique },
  { id: 'duo', name: 'Duo à l’écran', icon: 'duo', category: 'collection', desc: 'Former {n} duo(s) Acteur + Rôle.', steps: [1, 10, 50], rewards: [100, 300, 1000], value: (s) => s.duos },
  { id: 'integrale', name: 'Intégrale', icon: 'reel', category: 'collection', desc: 'Compléter {n} saga(s) de 5 cartes et plus.', steps: [1, 5, 20], rewards: [300, 800, 2500], value: (s) => s.sagas },
  { id: 'binge', name: 'Binge-watcher', icon: 'tv', category: 'collection', desc: 'Posséder {n} cartes Rôle tirées de séries.', steps: [25, 100, 300], rewards: [150, 400, 1000], value: (s) => s.series },
  { id: 'marteau', name: 'Coup de marteau', icon: 'hammer', category: 'commerce', desc: 'Remporter {n} enchère(s).', steps: [1, 10, 50], rewards: [100, 300, 1000], value: (s) => s.wins },
  { id: 'marchand', name: 'Marchand de rêves', icon: 'ticket', category: 'commerce', desc: 'Vendre {n} cartes au Guichet.', steps: [10, 50, 200], rewards: [200, 500, 1500], value: (s) => s.sales },
  { id: 'coproduction', name: 'Coproduction', icon: 'swap', category: 'commerce', desc: 'Conclure {n} échange(s) avec des amis.', steps: [1, 10, 50], rewards: [100, 300, 1000], value: (s) => s.trades },
  { id: 'producteur', name: 'Producteur', icon: 'producer', category: 'commerce', desc: 'Revendre une carte au moins deux fois sa cote.', steps: [1], firstLevel: 2, rewards: [300], value: (s) => s.flips },
  { id: 'fidele', name: 'Fidèle au poste', icon: 'cal', category: 'fidelite', desc: 'Passer en salle {n} jours d’affilée.', steps: [7, 30, 100], rewards: [150, 500, 2000], value: (s) => s.streak },
  { id: 'bande-annonce', name: 'Bande-annonce', icon: 'trailer', category: 'fidelite', desc: 'Regarder {n} bandes-annonces.', steps: [10, 50, 200], rewards: [80, 250, 800], value: (s) => s.trailers },
  { id: 'minuit', name: 'Séance de minuit', icon: 'moon', category: 'fidelite', desc: 'Ouvrir une bobine pendant la séance de minuit.', steps: [1], rewards: [120], secret: true, hint: 'Certaines séances commencent quand les autres se terminent.', value: (s) => s.midnight },
  { id: 'generique', name: 'Scène post-générique', icon: 'credits', category: 'fidelite', desc: 'Rester jusqu’au bout du générique.', steps: [1], firstLevel: 3, rewards: [300], secret: true, hint: 'Il y a toujours une scène après le générique.', value: (s) => s.credits },
];
export const badgeDef = (id: string) => BADGES.find((b) => b.id === id);

function statsOf(db: DatabaseSync, playerId: string): Stats {
  const owned = ownedCardIds(db, playerId);
  const rows = db.prepare('SELECT DISTINCT c.rarity, c.kind, c.tags FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ?')
    .all(playerId) as { rarity: keyof typeof RARITIES; kind: string; tags: string }[];
  const pulls = (db.prepare('SELECT COUNT(*) AS n FROM pulls WHERE player_id = ?').get(playerId) as { n: number }).n;
  const best = (db.prepare("SELECT MAX(level) AS l FROM badges WHERE player_id = ? AND badge_id = 'fidele'").get(playerId) as { l: number | null }).l;
  return {
    pulls,
    unique: owned.size,
    duos: countDuos(db, playerId),
    sagas: completedSagaCount(db, owned),
    series: (db.prepare(`SELECT COUNT(DISTINCT c.id) AS n FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ? AND c.kind = 'role' AND c.tags LIKE '%"media:tv"%'`).get(playerId) as { n: number }).n,
    top: rows.filter((r) => RARITIES[r.rarity].tier >= 5).length,
    mythes: (db.prepare("SELECT COUNT(DISTINCT o.card_id) AS n FROM owned o JOIN cards c ON c.id = o.card_id WHERE o.player_id = ? AND c.rarity = 'mythe'").get(playerId) as { n: number }).n,
    sales: countEvents(db, playerId, 'sell'),
    trades: countEvents(db, playerId, 'trade'),
    wins: countEvents(db, playerId, 'auction-won'),
    flips: countEvents(db, playerId, 'flip2x'),
    // La série en cours ; un niveau décroché reste acquis même si la série casse.
    streak: Math.max(visitStreak(db, playerId), best ? [0, 7, 30, 100][best] : 0),
    trailers: countEvents(db, playerId, 'trailer'),
    midnight: countEvents(db, playerId, 'midnight'),
    credits: countEvents(db, playerId, 'credits'),
  };
}

/** Niveau atteint (0 = pas encore) pour une valeur. */
export function levelFor(def: BadgeDef, value: number): number {
  const first = def.firstLevel ?? 1;
  let reached = 0;
  def.steps.forEach((need, i) => { if (value >= need) reached = first + i; });
  return Math.min(3, reached);
}

export type BadgeState = {
  def: BadgeDef;
  level: number;
  value: number;
  /** Seuil du prochain niveau, ou null si le dernier est atteint. */
  next: number | null;
  /** Progression vers le prochain niveau, de 0 à 1. */
  progress: number;
  awardedAt: number | null;
  pinned: boolean;
  desc: string;
};

export function pinnedBadges(db: DatabaseSync, playerId: string): string[] {
  const r = db.prepare('SELECT pinned_badges FROM players WHERE id = ?').get(playerId) as { pinned_badges: string } | undefined;
  try { return r ? (JSON.parse(r.pinned_badges) as string[]) : []; } catch { return []; }
}

export function badgeStates(db: DatabaseSync, playerId: string): BadgeState[] {
  const s = statsOf(db, playerId);
  const got = new Map((db.prepare('SELECT badge_id, level, awarded_at FROM badges WHERE player_id = ?').all(playerId) as { badge_id: string; level: number; awarded_at: number }[])
    .map((r) => [r.badge_id, r]));
  const pins = new Set(pinnedBadges(db, playerId));
  return BADGES.map((def) => {
    const value = def.value(s);
    const level = got.get(def.id)?.level ?? 0;
    const idx = def.steps.findIndex((need, i) => (def.firstLevel ?? 1) + i > level);
    const next = idx === -1 ? null : def.steps[idx];
    const prev = idx > 0 ? def.steps[idx - 1] : 0;
    const progress = next === null ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev)));
    const n = next ?? def.steps[def.steps.length - 1];
    return {
      def, level, value, next, progress, awardedAt: got.get(def.id)?.awarded_at ?? null, pinned: pins.has(def.id),
      desc: def.desc.replace('{n}', n.toLocaleString('fr-FR')),
    };
  });
}

/**
 * Décerne les niveaux nouvellement atteints : tickets, pop-up « Et la distinction est attribuée à… » et notification.
 * Appelé à chaque passage du joueur (session) : rien à brancher dans chaque action du jeu.
 */
export function checkBadges(db: DatabaseSync, playerId: string, now = Date.now()): number {
  const s = statsOf(db, playerId);
  const got = new Map((db.prepare('SELECT badge_id, level FROM badges WHERE player_id = ?').all(playerId) as { badge_id: string; level: number }[]).map((r) => [r.badge_id, r.level]));
  let awarded = 0;
  for (const def of BADGES) {
    const reached = levelFor(def, def.value(s));
    const had = got.get(def.id) ?? 0;
    if (reached <= had) continue;
    transaction(db, () => {
      db.prepare('INSERT INTO badges (player_id, badge_id, level, awarded_at) VALUES (?, ?, ?, ?) ON CONFLICT (player_id, badge_id) DO UPDATE SET level = excluded.level, awarded_at = excluded.awarded_at')
        .run(playerId, def.id, reached, now);
      // Chaque niveau franchi rapporte sa récompense (on peut en franchir plusieurs d'un coup).
      let tickets = 0;
      def.steps.forEach((_, i) => { const lvl = (def.firstLevel ?? 1) + i; if (lvl > had && lvl <= reached) tickets += def.rewards[i] ?? 0; });
      if (tickets) addTickets(db, playerId, tickets);
      const info = levelInfo(reached);
      queueCelebration(db, playerId, {
        kind: 'badge', badgeId: def.id, level: reached, name: def.name, levelLabel: info.label, color: info.color, icon: def.icon, tickets,
        desc: def.desc.replace('{n}', def.steps[Math.max(0, reached - (def.firstLevel ?? 1))].toLocaleString('fr-FR')),
      }, now);
      notifyPlayer(db, playerId, 'badge', `Nouvelle distinction : ${def.name} · ${info.label}${tickets ? ` (+${tickets} tickets)` : ''}.`, '/palmares', now);
      // Les premières distinctions s'épinglent d'elles-mêmes dans la vitrine.
      const pins = pinnedBadges(db, playerId);
      if (pins.length < 5 && !pins.includes(def.id)) db.prepare('UPDATE players SET pinned_badges = ? WHERE id = ?').run(JSON.stringify([...pins, def.id]), playerId);
    });
    awarded++;
  }
  return awarded;
}

export const MAX_PINS = 5;
export function togglePin(db: DatabaseSync, playerId: string, badgeId: string): void {
  const level = (db.prepare('SELECT level FROM badges WHERE player_id = ? AND badge_id = ?').get(playerId, badgeId) as { level: number } | undefined)?.level;
  if (!level) throw new GameError('not-awarded', 'Distinction pas encore décrochée.');
  const pins = pinnedBadges(db, playerId);
  const next = pins.includes(badgeId) ? pins.filter((p) => p !== badgeId) : [...pins, badgeId];
  if (next.length > MAX_PINS) throw new GameError('too-many', `Au plus ${MAX_PINS} distinctions dans la vitrine : retirez-en une d’abord.`);
  db.prepare('UPDATE players SET pinned_badges = ? WHERE id = ?').run(JSON.stringify(next), playerId);
}

/** Score « Palmarès » du box-office : bronze ×1, argent ×2, or ×3. */
export function badgeScores(db: DatabaseSync): Map<string, { score: number; count: number }> {
  const rows = db.prepare('SELECT player_id, level FROM badges').all() as { player_id: string; level: number }[];
  const out = new Map<string, { score: number; count: number }>();
  for (const r of rows) {
    const cur = out.get(r.player_id) ?? { score: 0, count: 0 };
    out.set(r.player_id, { score: cur.score + levelInfo(r.level).weight, count: cur.count + 1 });
  }
  return out;
}
