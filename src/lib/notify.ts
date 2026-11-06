import type { DatabaseSync } from 'node:sqlite';

export type Notification = { id: number; kind: string; text: string; href: string | null; createdAt: number; read: boolean; urgent: boolean };

/** Types de notifications réglables dans les paramètres. */
export const NOTIFY_KINDS: { kind: string; label: string; hint: string }[] = [
  { kind: 'trade', label: 'Propositions d’échange', hint: 'Quand un ami vous propose, accepte ou refuse un échange.' },
  { kind: 'sale', label: 'Ventes au Guichet', hint: 'Quand une de vos cartes trouve preneur.' },
  { kind: 'friend', label: 'Demandes d’ami', hint: 'Quand quelqu’un vous ajoute.' },
  { kind: 'pull', label: 'Grands tirages', hint: 'Vos Légendes et Icônes, pour les retrouver facilement.' },
  { kind: 'referral', label: 'Parrainage', hint: 'Quand un filleul s’inscrit ou valide son parrainage.' },
  { kind: 'auction', label: 'Enchères', hint: 'Quand on vous dépasse, quand vous remportez un lot, quand votre lot est adjugé.' },
  { kind: 'alert', label: 'Cartes guettées', hint: 'Quand une carte que vous guettez arrive au Guichet.' },
  { kind: 'badge', label: 'Palmarès', hint: 'Quand vous décrochez une distinction.' },
];

/** Les rayons de la Régie : chaque type de notification y a sa catégorie. */
export const REGIE_CATEGORIES: { id: string; label: string; kinds: string[]; color: string }[] = [
  { id: 'encheres', label: 'Enchères', kinds: ['auction'], color: '#FF4A1C' },
  { id: 'alertes', label: 'Alertes', kinds: ['alert'], color: '#FFC83D' },
  { id: 'guichet', label: 'Guichet', kinds: ['sale', 'buy'], color: '#3DDC97' },
  { id: 'echanges', label: 'Échanges', kinds: ['trade', 'gift'], color: '#B57BFF' },
  { id: 'amis', label: 'Amis', kinds: ['friend', 'referral'], color: '#4C8DFF' },
  { id: 'palmares', label: 'Palmarès', kinds: ['badge'], color: '#FFC83D' },
  { id: 'tirages', label: 'Tirages', kinds: ['pull'], color: '#FF2E93' },
];
export const categoryOf = (kind: string) => REGIE_CATEGORIES.find((c) => c.kinds.includes(kind)) ?? REGIE_CATEGORIES[REGIE_CATEGORIES.length - 1];

/** Canaux de la Régie, réglables : la cloche du site (toujours), un message privé Discord. */
export type Channels = { discord: boolean };
export function channelsOf(prefs: Record<string, boolean>): Channels {
  return { discord: prefs.ch_discord !== false };
}
/** Le message privé Discord n'est possible que si un bot est configuré sur le serveur (DISCORD_BOT_TOKEN). */
export const discordDmAvailable = () => Boolean(process.env.DISCORD_BOT_TOKEN?.trim());

/** Envoie un message privé Discord (sans attendre : un échec ne bloque jamais le jeu). */
function discordDm(discordId: string, text: string, href: string | null): void {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return;
  const base = process.env.APP_URL?.replace(/\/$/, '') ?? '';
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Clap (https://github.com/MathisLallemand01/Clap, 1.0)' };
  void (async () => {
    try {
      const ch = await fetch('https://discord.com/api/v10/users/@me/channels', { method: 'POST', headers, body: JSON.stringify({ recipient_id: discordId }), signal: AbortSignal.timeout(8000) });
      if (!ch.ok) return;
      const { id } = (await ch.json()) as { id: string };
      await fetch(`https://discord.com/api/v10/channels/${id}/messages`, {
        method: 'POST', headers, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ content: `🎬 **La Régie de Clap** · ${text}${href && base ? `\n${base}${href}` : ''}` }),
      });
    } catch {
      // Discord injoignable : la notification reste dans la cloche.
    }
  })();
}

export function notify(db: DatabaseSync, userId: string, kind: string, text: string, href: string | null = null, now = Date.now(), opts: { urgent?: boolean } = {}): void {
  const row = db.prepare('SELECT notify, discord_id FROM users WHERE id = ?').get(userId) as { notify: string; discord_id: string | null } | undefined;
  const prefs = row ? (JSON.parse(row.notify) as Record<string, boolean>) : {};
  if (prefs[kind] === false) return;
  db.prepare('INSERT INTO notifications (user_id, kind, text, href, created_at, urgent) VALUES (?, ?, ?, ?, ?, ?)').run(userId, kind, text, href, now, opts.urgent ? 1 : 0);
  // Les urgences (cartes guettées, enchères dépassées) partent aussi en message privé Discord.
  if (opts.urgent && row?.discord_id && channelsOf(prefs).discord) discordDm(row.discord_id, text, href);
}

/** Notifie le compte lié à un joueur, s'il y en a un. */
export function notifyPlayer(db: DatabaseSync, playerId: string, kind: string, text: string, href: string | null = null, now = Date.now(), opts: { urgent?: boolean } = {}): void {
  const user = db.prepare('SELECT id FROM users WHERE player_id = ?').get(playerId) as { id: string } | undefined;
  if (user) notify(db, user.id, kind, text, href, now, opts);
}

type NotifRow = { id: number; kind: string; text: string; href: string | null; created_at: number; read_at: number | null; urgent: number };
const toNotification = (r: NotifRow): Notification => ({ id: r.id, kind: r.kind, text: r.text, href: r.href, createdAt: r.created_at, read: r.read_at !== null, urgent: r.urgent === 1 });

export function listNotifications(db: DatabaseSync, userId: string, limit = 12, kinds?: string[]): Notification[] {
  const filter = kinds?.length ? ` AND kind IN (${kinds.map(() => '?').join(', ')})` : '';
  const rows = db.prepare(`SELECT id, kind, text, href, created_at, read_at, urgent FROM notifications WHERE user_id = ?${filter} ORDER BY id DESC LIMIT ?`)
    .all(userId, ...(kinds ?? []), limit) as NotifRow[];
  return rows.map(toNotification);
}

/** Non lues par type, pour les compteurs de la Régie. */
export function unreadByKind(db: DatabaseSync, userId: string): Map<string, number> {
  const rows = db.prepare('SELECT kind, COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL GROUP BY kind').all(userId) as { kind: string; n: number }[];
  return new Map(rows.map((r) => [r.kind, r.n]));
}

/** Le télégramme : la dernière urgence non lue des dernières 24 heures. */
export function pendingTelegram(db: DatabaseSync, userId: string, now = Date.now()): Notification | null {
  const r = db.prepare('SELECT id, kind, text, href, created_at, read_at, urgent FROM notifications WHERE user_id = ? AND urgent = 1 AND read_at IS NULL AND created_at >= ? ORDER BY id DESC LIMIT 1')
    .get(userId, now - 24 * 3600 * 1000) as NotifRow | undefined;
  return r ? toNotification(r) : null;
}

export function markRead(db: DatabaseSync, userId: string, id: number, now = Date.now()): void {
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL').run(now, userId, id);
}

export function unreadCount(db: DatabaseSync, userId: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId) as { n: number }).n;
}

export function markAllRead(db: DatabaseSync, userId: string, now = Date.now(), kinds?: string[]): void {
  const filter = kinds?.length ? ` AND kind IN (${kinds.map(() => '?').join(', ')})` : '';
  db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL${filter}`).run(now, userId, ...(kinds ?? []));
}

export function logEvent(db: DatabaseSync, playerId: string, kind: string, amount = 1, now = Date.now()): void {
  db.prepare('INSERT INTO events (player_id, kind, amount, created_at) VALUES (?, ?, ?, ?)').run(playerId, kind, amount, now);
}

export function countEvents(db: DatabaseSync, playerId: string, kind: string, since = 0): number {
  return (db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM events WHERE player_id = ? AND kind = ? AND created_at >= ?')
    .get(playerId, kind, since) as { n: number }).n;
}
