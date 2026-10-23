import Link from 'next/link';
import { BoosterTile } from '@/components/BoosterTile';
import { Countdown } from '@/components/Countdown';
import { GameCard } from '@/components/GameCard';
import { ArrowIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { ACTOR_ODDS, getBooster, ROLE_ODDS } from '@/lib/boosters';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { getRecentCards } from '@/lib/game';
import { ACTOR_LADDER, RARITIES, ROLE_LADDER, type Rarity } from '@/lib/rarity';
import { currentWallet } from '@/lib/session';
import styles from './home.module.css';

const RULES: Record<Rarity, string> = {
  legende: 'Top 100 de popularité', tete: 'Top 1 000', premier: 'Top 5 000', second: 'Top 20 000', figurant: 'Tous les autres',
  icone: 'Une légende dans le rôle d’une vie', chef: 'Classique majeur', culte: 'Film culte, très noté', succes: 'Succès public', serieb: 'Film peu vu ou oublié',
};

function odds(n: number | undefined): string {
  return `${String(n ?? 0).replace('.', ',')} %`;
}

export default async function HomePage() {
  const { player, stats, wallet } = await currentWallet();
  const recent = player ? getRecentCards(getDb(), player.id, 10) : [];
  const featured = [getBooster('casting')!, getBooster('avant-premiere')!];
  const ladders = [
    { title: 'Acteurs', basis: 'POPULARITÉ TMDB', rows: [...ACTOR_LADDER].reverse().map((r) => ({ r, odds: odds(ACTOR_ODDS[r as keyof typeof ACTOR_ODDS]) })) },
    { title: 'Rôles', basis: 'NOTORIÉTÉ DU FILM', rows: [...ROLE_LADDER].reverse().map((r) => ({ r, odds: odds(ROLE_ODDS[r as keyof typeof ROLE_ODDS]) })) },
  ];

  return (
    <>
      <Nav wallet={wallet} />
      <main>
        <section className={`container ${styles.hero}`}>
          <div className={styles.heroText}>
            <span className="eyebrow">TCG gratuit · sans achat · données TMDB</span>
            <h1 className={`display ${styles.title}`}>
              Le cinéma,<br />
              <span className={styles.accent}>carte</span> par carte.
            </h1>
            <p className="lead">
              Du figurant oublié à la légende d’Hollywood. Ouvrez des bobines, collectionnez les acteurs, puis traquez-les dans leurs rôles — chefs-d’œuvre comme séries B.
            </p>
            <div className={styles.ctas}>
              <Link href="/ouvrir/casting" className="btn btn-primary">
                Ouvrir une bobine <ArrowIcon />
              </Link>
              <Link href="/collection" className="btn">Ma collection</Link>
            </div>
            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
              {wallet.freeStock > 0 ? (
                <>
                  <span style={{ color: 'var(--text)' }}>{wallet.freeStock}</span> BOBINE{wallet.freeStock > 1 ? 'S' : ''} OFFERTE{wallet.freeStock > 1 ? 'S' : ''} À OUVRIR
                </>
              ) : wallet.nextFreeAt ? (
                <>
                  PROCHAINE BOBINE OFFERTE DANS <span style={{ color: 'var(--text)' }}><Countdown until={wallet.nextFreeAt} /></span>
                </>
              ) : null}
            </span>
          </div>
          <div className={styles.featured}>
            {featured.map((b) => <BoosterTile key={b.id} booster={b} free={wallet.freeStock > 0} />)}
          </div>
        </section>

        {recent.length > 0 && (
          <section className={styles.recent}>
            <div className={`container section-head ${styles.recentHead}`}>
              <h2 className="display">Vos derniers tirages</h2>
              <span className="rule" />
              <Link href="/collection" className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>TOUT VOIR ▸</Link>
            </div>
            <div className={styles.strip}>
              <div className={styles.sprockets} />
              <div className={styles.stripCards}>
                {recent.map((c, i) => <GameCard key={`${c.id}-${i}`} card={c} width={176} />)}
              </div>
              <div className={styles.sprockets} />
            </div>
          </section>
        )}

        <section className={`container ${styles.ladders}`}>
          {ladders.map((l) => (
            <div key={l.title} className={`panel ${styles.ladder}`}>
              <div className={styles.ladderHead}>
                <h3 className="display">{l.title}</h3>
                <span className="eyebrow">{l.basis}</span>
              </div>
              <ul>
                {l.rows.map(({ r, odds: o }) => (
                  <li key={r}>
                    <span className={styles.swatch} style={{ background: RARITIES[r].color }} />
                    <span>
                      <strong>{RARITIES[r].label}</strong>
                      <small>{RULES[r]}</small>
                    </span>
                    <span className="mono" style={{ color: RARITIES[r].color }}>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="container">
          <div className={styles.stats}>
            <div>
              <span className="eyebrow">Box-office</span>
              <strong className="display">{formatEntries(stats?.entries ?? 0)}</strong>
              <small>entrées : la valeur de votre collection</small>
            </div>
            <div>
              <span className="eyebrow">Cartes uniques</span>
              <strong className="display">{formatNumber(stats?.unique ?? 0)}</strong>
              <small>{formatNumber(stats?.copies ?? 0)} exemplaires au total</small>
            </div>
            <div>
              <span className="eyebrow">Tickets</span>
              <strong className="display">{formatNumber(wallet.tickets)}</strong>
              <small>pour ouvrir des bobines en plus</small>
            </div>
            <div>
              <span className="eyebrow">Bobines ouvertes</span>
              <strong className="display">{formatNumber(stats?.pulls ?? 0)}</strong>
              <small>depuis votre arrivée</small>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
