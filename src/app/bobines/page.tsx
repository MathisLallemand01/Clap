import type { Metadata } from 'next';
import Link from 'next/link';
import { BoosterPack } from '@/components/BoosterPack';
import { Countdown } from '@/components/Countdown';
import { Footer, Nav } from '@/components/Nav';
import { PackTile } from '@/components/PackTile';
import { Ticker } from '@/components/Ticker';
import { BOOSTERS, getBooster, GROUP_LABELS, type BoosterGroup } from '@/lib/boosters';
import { boosterCover, ownedCardIds, poolOf } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { requireContext } from '@/lib/session';
import { tickerNews } from '@/lib/ticker';
import styles from './bobines.module.css';

export const metadata: Metadata = { title: 'Bobines' };

export default async function BoostersPage() {
  const ctx = await requireContext('/bobines');
  const db = getDb();
  const owned = ownedCardIds(db, ctx.player.id);
  const free = ctx.wallet.freeStock > 0;
  const featured = getBooster('icones')!;
  const groups = (Object.keys(GROUP_LABELS) as BoosterGroup[])
    .map((g) => ({ id: g, label: GROUP_LABELS[g], boosters: BOOSTERS.filter((b) => b.group === g) }))
    .filter((g) => g.boosters.length > 0);
  const progress = (id: string) => {
    const pool = poolOf(db, getBooster(id)!);
    return { owned: pool.reduce((n, c) => n + (owned.has(c.id) ? 1 : 0), 0), total: pool.length };
  };

  return (
    <>
      <Nav ctx={ctx} current="/bobines" />
      <Ticker items={tickerNews(db)} variant="news" />
      <main className="container page">
        <header className="page-head">
          <h1 className="display h1">Bobines</h1>
          <div className="meta">
            <span><b>{ctx.wallet.freeStock}</b> BOBINE{ctx.wallet.freeStock > 1 ? 'S' : ''} OFFERTE{ctx.wallet.freeStock > 1 ? 'S' : ''} · <b>{ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.tickets)}</b> TICKETS</span>
            {ctx.wallet.nextFreeAt && <span>PROCHAINE OFFERTE DANS <b><Countdown until={ctx.wallet.nextFreeAt} /></b></span>}
          </div>
        </header>

        {free && (
          <div className={styles.ready} role="status">
            <span className={styles.pulse} />
            <span><strong>{ctx.wallet.freeStock === 1 ? 'Une bobine offerte vous attend.' : `${ctx.wallet.freeStock} bobines offertes vous attendent.`}</strong> Choisissez-en une : elle ne vous coûte rien.</span>
          </div>
        )}

        <section className={styles.featured}>
          <div className={styles.featuredText}>
            <span className={styles.badge}><span />ÉVÉNEMENT · ÉDITION LIMITÉE</span>
            <h2 className="display">Personnages<br /><span style={{ color: 'var(--icon)' }}>iconiques</span></h2>
            <p className="lead">{featured.description} Uniquement des cartes Rôle : le Joker, Forrest Gump, Ripley, Léon…</p>
            <div className={styles.featuredStats}>
              <span><b>5</b> CARTES RÔLE</span><span>ICÔNE <b style={{ color: 'var(--icon)' }}>1 %</b></span><span>CHEF-D’ŒUVRE <b>8 %</b></span>
            </div>
            <div className={styles.featuredCtas}>
              <Link href="/ouvrir/icones" className={`btn btn-lg ${styles.pink}`}>{free ? 'Ouvrir · offerte' : `Ouvrir · ${formatNumber(featured.price)} TK`}</Link>
              <Link href="/bobines/icones" className="btn btn-lg">Voir le contenu</Link>
            </div>
          </div>
          <div className={styles.featuredArt}>
            <BoosterPack booster={featured} cover={boosterCover(db, featured)} width={300} float interactive page="#1a0c14" />
          </div>
        </section>

        <nav className={styles.groups} aria-label="Catégories">
          {groups.map((g) => <a key={g.id} href={`#${g.id}`} className="chip">{g.label} <small>{g.boosters.length}</small></a>)}
        </nav>

        {groups.map((g, i) => (
          <section key={g.id} id={g.id} className={styles.group}>
            <div className="section-head">
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="display h2">{g.label}</h2>
              <span className="rule" />
            </div>
            <div className={styles.grid}>
              {g.boosters.map((b, k) => (
                <PackTile
                  key={b.id}
                  booster={b}
                  cover={boosterCover(db, b)}
                  free={free}
                  canAfford={ctx.wallet.tickets >= b.price}
                  delay={-k * 1.3}
                  {...progress(b.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
