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
