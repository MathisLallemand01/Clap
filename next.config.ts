import type { NextConfig } from 'next';

/**
 * En-têtes de sécurité sur toutes les pages : pas d'affichage du site dans un cadre étranger (clickjacking),
 * pas de devinette de type de fichier, référent limité, capteurs désactivés, HTTPS imposé en production.
 */
const dev = process.env.NODE_ENV !== 'production';
/**
 * Politique de contenu : seules les sources réellement utilisées sont permises. Un script injecté depuis un autre
 * site, une image ou un son venus d'ailleurs, ou un envoi de formulaire vers un domaine tiers sont bloqués.
 * (Next.js insère des scripts en ligne : 'unsafe-inline' reste nécessaire pour eux ; 'unsafe-eval' en dev seulement.)
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://image.tmdb.org https://cdn.discordapp.com https://*.googleusercontent.com",
  "media-src 'self' https://*.itunes.apple.com https://*.mzstatic.com https://*.dzcdn.net",
  `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
  'frame-src https://www.youtube-nocookie.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://discord.com",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org' }],
  },
};

export default nextConfig;
