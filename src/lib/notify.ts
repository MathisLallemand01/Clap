import type { DatabaseSync } from 'node:sqlite';

export type Notification = { id: number; kind: string; text: string; href: string | null; createdAt: number; read: boolean };

/** Types de notifications réglables dans les paramètres. */
export const NOTIFY_KINDS: { kind: string; label: string; hint: string }[] = [
  { kind: 'trade', label: 'Propositions d’échange', hint: 'Quand un ami vous propose, accepte ou refuse un échange.' },
  { kind: 'sale', label: 'Ventes au Guichet', hint: 'Quand une de vos cartes trouve preneur.' },
  { kind: 'friend', label: 'Demandes d’ami', hint: 'Quand quelqu’un vous ajoute.' },
  { kind: 'pull', label: 'Grands tirages', hint: 'Vos Légendes et Icônes, pour les retrouver facilement.' },
  { kind: 'referral', label: 'Parrainage', hint: 'Quand un filleul s’inscrit ou valide son parrainage.' },
];

export function notify(db: DatabaseSync, userId: string, kind: string, text: string, href: string | null = null, now = Date.now()): void {
  const prefs = db.prepare('SELECT notify FROM users WHERE id = ?').get(userId) as { notify: string } | undefined;
  if (prefs && (JSON.parse(prefs.notify) as Record<string, boolean>)[kind] === false) return;
  db.prepare('INSERT INTO notifications (user_id, kind, text, href, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, kind, text, href, now);
}

/** Notifie le compte lié à un joueur, s'il y en a un. */
export function notifyPlayer(db: DatabaseSync, playerId: string, kind: string, text: string, href: string | null = null, now = Date.now()): void {
  const user = db.prepare('SELECT id FROM users WHERE player_id = ?').get(playerId) as { id: string } | undefined;
  if (user) notify(db, user.id, kind, text, href, now);
}

export function listNotifications(db: DatabaseSync, userId: string, limit = 12): Notification[] {
  const rows = db.prepare('SELECT id, kind, text, href, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit) as { id: number; kind: string; text: string; href: string | null; created_at: number; read_at: number | null }[];
  return rows.map((r) => ({ id: r.id, kind: r.kind, text: r.text, href: r.href, createdAt: r.created_at, read: r.read_at !== null }));
}

export function unreadCount(db: DatabaseSync, userId: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId) as { n: number }).n;
}

export function markAllRead(db: DatabaseSync, userId: string, now = Date.now()): void {
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now, userId);
}

export function logEvent(db: DatabaseSync, playerId: string, kind: string, amount = 1, now = Date.now()): void {
  db.prepare('INSERT INTO events (player_id, kind, amount, created_at) VALUES (?, ?, ?, ?)').run(playerId, kind, amount, now);
}

export function countEvents(db: DatabaseSync, playerId: string, kind: string, since = 0): number {
  return (db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM events WHERE player_id = ? AND kind = ? AND created_at >= ?')
    .get(playerId, kind, since) as { n: number }).n;
}
