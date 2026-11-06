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

/** Même chose depuis les en-têtes d'une requête (actions serveur, pages). */
export function isHttpsHeaders(headers: Headers): boolean {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.startsWith('https://');
  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (proto) return proto === 'https';
  return process.env.NODE_ENV === 'production' && !/^(localhost|127\.|\[::1\])/.test(headers.get('host') ?? '');
}
