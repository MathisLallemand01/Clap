// Garde-fous communs : redirections internes uniquement, limitation des tentatives, adresse du client.

/**
 * N'accepte qu'un chemin interne au site. Refuse « //site.com » et « /\site.com », que les navigateurs
 * prennent pour une adresse externe, ainsi que les caractères de contrôle.
 */
export function safePath(value: unknown, fallback = '/bobines'): string {
  if (typeof value !== 'string' || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  return value;
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/**
 * Compte une tentative pour `key` et dit si elle est permise : au plus `limit` tentatives par fenêtre
 * de `windowMs`. Mémoire du serveur : suffisant pour un seul processus, remis à zéro au redémarrage.
 * Renvoie le délai d'attente en secondes quand la limite est atteinte, sinon 0.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): number {
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  b.count++;
  return b.count > limit ? Math.ceil((b.resetAt - now) / 1000) : 0;
}

/** Remet un compteur à zéro (par exemple après une connexion réussie). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** L'adresse du visiteur, derrière un proxy éventuel (première adresse de X-Forwarded-For). */
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local';
}

/** « 4 minutes », « 30 secondes » : pour les messages d'attente. */
export function waitText(seconds: number): string {
  return seconds >= 90 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} secondes`;
}

/** Code de parrainage tel qu'on le génère (« CA-7K4Q ») : tout le reste est ignoré. */
export function cleanReferral(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{2,16}$/.test(value) ? value.toUpperCase() : '';
}

/** N'accepte qu'une adresse https:// d'un des hôtes attendus (lecteurs audio, liens externes). */
export function safeExternalUrl(value: unknown, hosts: RegExp): string | null {
  if (typeof value !== 'string' || value.length > 1024) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && hosts.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Freine les actions répétées d'un joueur (enchères, ventes, échanges, demandes d'ami…) : au plus `limit`
 * par minute. Renvoie le message d'attente, ou null si l'action est permise.
 */
export function tooFast(kind: string, playerId: string, limit = 30, windowMs = 60_000): string | null {
  const wait = rateLimit(`act:${kind}:${playerId}`, limit, windowMs);
  return wait ? `Doucement : trop d’actions d’affilée. Réessayez dans ${waitText(wait)}.` : null;
}
