import Link from 'next/link';
import { formatEntries, formatNumber } from '@/lib/format';
import type { Wallet } from '@/lib/session';
import { SeatIcon, TicketIcon } from './Icons';
import { Wordmark } from './Mark';

const LINKS = [
  { href: '/bobines', label: 'Bobines' },
  { href: '/collection', label: 'Collection' },
  { href: '/catalogue', label: 'Catalogue' },
] as const;

export function Nav({ wallet, current }: { wallet: Wallet; current?: (typeof LINKS)[number]['href'] | '/compte' }) {
  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="container nav-inner">
        <Link href="/" className="nav-brand" aria-label="Clap, accueil">
          <Wordmark />
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav-wallet">
          <span className="pill" title="Box-office : la valeur de votre collection, en entrées">
            <SeatIcon />
            {formatEntries(wallet.entries)}
            <span className="visually-hidden"> entrées</span>
          </span>
          <span className="pill" title="Tickets à dépenser">
            <TicketIcon />
            {formatNumber(wallet.tickets)}
            <span className="visually-hidden"> tickets</span>
          </span>
          <Link
            href="/compte"
            className={`pill nav-account ${wallet.name ? '' : 'nav-login'}`}
            aria-current={current === '/compte' ? 'page' : undefined}
            title={wallet.dailyAvailable ? 'Prime du jour disponible' : undefined}
          >
            {wallet.name ?? 'Compte'}
            {wallet.dailyAvailable && <span className="nav-dot" aria-label="prime du jour disponible" />}
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>Gratuit, sans achat intégré. Les entrées et les tickets n’ont aucune valeur réelle.</span>
        <span>Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</span>
      </div>
    </footer>
  );
}
