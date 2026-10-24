import type { NextRequest } from 'next/server';

/**
 * L'adresse publique du site, pour les redirections OAuth : APP_URL si elle est renseignée (non vide),
 * sinon l'hôte de la requête tel que le navigateur l'a vu (derrière un proxy : X-Forwarded-*).
 */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
