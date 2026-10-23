import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Curtain } from '@/components/Curtain';
import { SESSION_COOKIE } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Clap — le cinéma, carte par carte', template: '%s · Clap' },
  description: 'Un jeu de cartes à collectionner sur le cinéma : ouvrez des bobines, collectionnez les acteurs et leurs rôles.',
};

export const viewport: Viewport = { themeColor: '#0b0b0d' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le rideau de connexion se lève quand la session change (connexion, déconnexion).
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body>
        {children}
        <Curtain signedIn={signedIn} />
      </body>
    </html>
  );
}
