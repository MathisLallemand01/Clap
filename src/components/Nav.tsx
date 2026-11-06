import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import type { Context } from '@/lib/session';
import { Telegram } from './Telegram';
import { CelebrationHost } from './CelebrationHost';
import { DiscordLogo } from './DiscordLogo';
import { FreeBoosters } from './FreeBoosters';
import { SeatIcon, TicketIcon } from './Icons';
import { LogoutButton } from './LogoutButton';
import { PendingBar } from './PendingBar';
import { Wordmark } from './Mark';
import { NotificationBell } from './NotificationBell';
import { TicketCounter } from './TicketCounter';
import styles from './Nav.module.css';

/**
 * Le menu suit le parcours du joueur : obtenir des cartes (Bobines), les consulter (Collection, Catalogue),
 * les échanger (Échanges, Guichet), puis progresser (Missions, Classement).
 */
export const NAV_LINKS = [
  { href: '/bobines', label: 'Bobines' },
  { href: '/collection', label: 'Collection' },
  { href: '/catalogue', label: 'Catalogue' },
  { href: '/echanges', label: 'Échanges' },
  { href: '/guichet', label: 'Le Guichet' },
  { href: '/missions', label: 'Missions' },
  { href: '/classement', label: 'Classement' },
] as const;

/** Pastille « récompense à récupérer » sur le lien Missions. */
function ReadyBadge({ n }: { n: number }) {
  return <span className={styles.ready} title={`${n} récompense${n > 1 ? 's' : ''} à récupérer`}>{n}<span className="visually-hidden"> récompense{n > 1 ? 's' : ''} à récupérer</span></span>;
}

/** Sens de la transition : vers un onglet à droite, la page glisse vers la gauche, et inversement. */
function direction(target: number, current: number): string[] {
  if (current < 0 || target === current) return ['nav-fade'];
  return [target > current ? 'nav-forward' : 'nav-back'];
}

export type NavKey = (typeof NAV_LINKS)[number]['href'];

export function Nav({ ctx, current }: { ctx: Context | null; current?: NavKey }) {
  return (
    <header className={styles.nav} style={{ viewTransitionName: 'site-header' }}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label="Clap, accueil">
          <Wordmark />
        </Link>

        {ctx ? (
          <>
            <nav className={styles.links} aria-label="Navigation principale">
              {NAV_LINKS.map((l, i) => (
                <Link key={l.href} href={l.href} aria-current={current === l.href ? 'page' : undefined}
                  transitionTypes={direction(i, NAV_LINKS.findIndex((x) => x.href === current))}>{l.label}{l.href === '/missions' && ctx.missionsReady > 0 && <ReadyBadge n={ctx.missionsReady} />}<PendingBar types={direction(i, NAV_LINKS.findIndex((x) => x.href === current))} /></Link>
              ))}
            </nav>
            <div className={styles.right}>
              <FreeBoosters stock={ctx.wallet.freeStock} nextFreeAt={ctx.wallet.nextFreeAt} />
              <Link href="/guichet" className={`pill ${styles.wallet} ${styles.entries}`} title="Sièges : la monnaie du Guichet, pour acheter des cartes aux autres joueurs">
                <SeatIcon />{ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.seats)}<span className="visually-hidden"> sièges</span>
              </Link>
              <Link href="/missions" id="wallet-tickets" className={`pill ${styles.wallet}`} title="Tickets : pour ouvrir des bobines en plus de vos bobines offertes">
                <TicketIcon /><TicketCounter value={ctx.wallet.tickets} unlimited={ctx.player.unlimited} /><span className="visually-hidden"> tickets</span>
              </Link>
              <NotificationBell notifications={ctx.notifications} unread={ctx.unread} />
              <details className={styles.menu}>
                <summary aria-label={ctx.missionsReady > 0 ? `Mon compte · ${ctx.missionsReady} récompense${ctx.missionsReady > 1 ? 's' : ''} à récupérer` : 'Mon compte'} className={`${styles.avatar} ${ctx.missionsReady > 0 ? styles.avatarDot : ''}`}>
                  {ctx.user.avatar ? <img src={ctx.user.avatar} alt="" referrerPolicy="no-referrer" /> : ctx.user.name.slice(0, 2).toUpperCase()}
                </summary>
                <div className={styles.dropdown}>
                  <div className={styles.who}>
                    <strong>{ctx.user.name}</strong>
                    {ctx.user.discord && <span className={styles.discord}><DiscordLogo size={11} />{ctx.user.discord.name}</span>}
                    <span className="mono">{formatNumber(ctx.wallet.points)} POINTS · {ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.seats)} SIÈGES</span>
                  </div>
                  <nav className={styles.mobileLinks} aria-label="Navigation">
                    {NAV_LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}{l.href === '/missions' && ctx.missionsReady > 0 && <ReadyBadge n={ctx.missionsReady} />}</Link>)}
                  </nav>
                  <Link href={`/v/${encodeURIComponent(ctx.user.name)}`}>Ma vitrine</Link>
                  <Link href="/palmares">Palmarès</Link>
                  <Link href="/regie">La Régie{ctx.unread > 0 ? ` · ${ctx.unread}` : ''}</Link>
                  <Link href="/guichet?vue=activite">Mon activité</Link>
                  <Link href="/raretes">Raretés et règles</Link>
                  <Link href="/monnaies">Tickets, sièges et points</Link>
                  <Link href="/parrainage">Parrainage</Link>
                  <Link href="/parametres">Paramètres</Link>
                  <LogoutButton />
                </div>
              </details>
            </div>
          </>
        ) : (
          <div className={styles.right}>
            <Link href="/catalogue" className={styles.ghostLink}>Catalogue</Link>
            <Link href="/raretes" className={styles.ghostLink}>Comment jouer</Link>
            <Link href="/connexion" className={`btn btn-sm ${styles.login}`}>Se connecter</Link>
            <Link href="/connexion?mode=inscription" className="btn btn-sm btn-primary">Jouer gratuitement</Link>
          </div>
        )}
      </div>
      {ctx?.celebration && <CelebrationHost celebration={ctx.celebration} />}
      {ctx?.telegram && !ctx.celebration && <Telegram key={ctx.telegram.id} telegram={ctx.telegram} />}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© Clap · Gratuit, sans achat intégré. Les tickets, sièges et points n’ont aucune valeur réelle.</span>
        <nav aria-label="Liens de bas de page">
          <Link href="/raretes">Raretés et règles</Link>
          <Link href="/catalogue">Catalogue</Link>
          <Link href="/bobines">Bobines</Link>
          <Link href="/guichet">Le Guichet</Link>
          <Link href="/parrainage">Parrainage</Link>
        </nav>
        <span>Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</span>
        {/* Scène post-générique : il faut rester jusqu'au bout pour la trouver. */}
        <Link href="/generique" prefetch={false} className="footer-credits" aria-label="Scène post-générique">· · ·</Link>
      </div>
    </footer>
  );
}
