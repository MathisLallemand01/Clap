import Link from 'next/link';
import { formatEntries, formatNumber } from '@/lib/format';
import type { Context } from '@/lib/session';
import { logout } from '@/app/actions';
import { SeatIcon, TicketIcon } from './Icons';
import { Wordmark } from './Mark';
import { NotificationBell } from './NotificationBell';
import styles from './Nav.module.css';

export const NAV_LINKS = [
  { href: '/bobines', label: 'Bobines' },
  { href: '/collection', label: 'Collection' },
  { href: '/guichet', label: 'Le Guichet' },
  { href: '/missions', label: 'Missions' },
  { href: '/echanges', label: 'Échanges' },
] as const;

export type NavKey = (typeof NAV_LINKS)[number]['href'];

export function Nav({ ctx, current }: { ctx: Context | null; current?: NavKey }) {
  return (
    <header className={styles.nav}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label="Clap, accueil">
          <Wordmark />
        </Link>

        {ctx ? (
          <>
            <nav className={styles.links} aria-label="Navigation principale">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} aria-current={current === l.href ? 'page' : undefined}>{l.label}</Link>
              ))}
            </nav>
            <div className={styles.right}>
              <Link href="/collection" className={`pill ${styles.wallet}`} title="Box-office : la valeur de votre collection, en entrées">
                <SeatIcon />{formatEntries(ctx.wallet.entries)}<span className="visually-hidden"> entrées</span>
              </Link>
              <Link href="/missions" className={`pill ${styles.wallet}`} title="Tickets à dépenser : bobines en plus, achats au Guichet">
                <TicketIcon />{ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.tickets)}<span className="visually-hidden"> tickets</span>
              </Link>
              <NotificationBell notifications={ctx.notifications} unread={ctx.unread} />
              <details className={styles.menu}>
                <summary aria-label="Mon compte" className={styles.avatar}>
                  {ctx.user.avatar ? <img src={ctx.user.avatar} alt="" referrerPolicy="no-referrer" /> : ctx.user.name.slice(0, 2).toUpperCase()}
                </summary>
                <div className={styles.dropdown}>
                  <div className={styles.who}>
                    <strong>{ctx.user.name}</strong>
                    <span className="mono">{formatEntries(ctx.wallet.entries)} ENTRÉES</span>
                  </div>
                  <nav className={styles.mobileLinks} aria-label="Navigation">
                    {NAV_LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
                  </nav>
                  <Link href="/parrainage">Parrainage</Link>
                  <Link href="/parametres">Paramètres</Link>
                  <form action={logout}><button type="submit">Se déconnecter</button></form>
                </div>
              </details>
            </div>
          </>
        ) : (
          <div className={styles.right}>
            <Link href="/#comment-jouer" className={styles.ghostLink}>Comment jouer</Link>
            <Link href="/connexion" className={`btn btn-sm ${styles.login}`}>Se connecter</Link>
            <Link href="/connexion?mode=inscription" className="btn btn-sm btn-primary">Jouer gratuitement</Link>
          </div>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© Clap · Gratuit, sans achat intégré. Les entrées et les tickets n’ont aucune valeur réelle.</span>
        <nav aria-label="Liens de bas de page">
          <Link href="/bobines">Bobines</Link>
          <Link href="/guichet">Le Guichet</Link>
          <Link href="/parrainage">Parrainage</Link>
        </nav>
        <span>Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</span>
      </div>
    </footer>
  );
}
