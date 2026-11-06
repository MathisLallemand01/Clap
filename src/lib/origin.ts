import type { NextRequest } from 'next/server';

/**
 * L'adresse publique du site, pour les redirections OAuth : APP_URL si elle est renseignée (non vide),
 * sinon l'hôte de la requête tel que le navigateur l'a vu (derrière un proxy : X-Forwarded-*).
 */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  // Derrière plusieurs proxys, ces en-têtes peuvent contenir une liste : « a.com, b.com ». On garde le premier.
  const first = (v: string | null) => v?.split(',')[0]?.trim() || null;
  const host = first(request.headers.get('x-forwarded-host')) ?? request.headers.get('host');
  const proto = first(request.headers.get('x-forwarded-proto')) ?? request.nextUrl.protocol.replace(':', '');
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/** Le site est-il servi en HTTPS ? Les cookies « Secure » ne sont posés qu'en HTTPS (sinon le navigateur les ignore). */
export function isHttpsOrigin(origin: string): boolean {
  return origin.startsWith('https://');
}

/**
 * La requête arrive-t-elle en HTTPS ? On regarde la requête elle-même (proxy : X-Forwarded-Proto), pas APP_URL :
 * un cookie « Secure » posé sur une page servie en HTTP est ignoré par le navigateur, et la connexion échoue.
 */
export function isHttpsHeaders(headers: Headers, url?: string): boolean {
  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (proto) return proto === 'https';
  if (url) return url.startsWith('https:');
  const host = headers.get('host') ?? '';
  if (/^(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
  return process.env.APP_URL?.trim().startsWith('https://') ?? process.env.NODE_ENV === 'production';
}
