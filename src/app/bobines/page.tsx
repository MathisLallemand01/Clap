import type { Metadata } from 'next';
import Link from 'next/link';
import { BoosterPack } from '@/components/BoosterPack';
import { Countdown } from '@/components/Countdown';
import { Beam, EventFrame, Rays, Scene } from '@/components/Decor';
import { FlipClock } from '@/components/FlipClock';
import { ArrowIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { PackTile } from '@/components/PackTile';
import { SideRails } from '@/components/SideRails';
import { Ticker } from '@/components/Ticker';
import { BOOSTERS, boosterOfTheDay, FAMILY_SHELVES, featuredEvent, FREE_BOOSTER_CAP, getBooster, GROUP_LABELS, NEW_BOOSTERS, type BoosterFamily, type BoosterGroup } from '@/lib/boosters';
import { boosterCover, ownedCardIds, poolOf } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { FAMILY, ladderOf, RARITIES, rarityName, type Rarity } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { tickerNews } from '@/lib/ticker';
import styles from './bobines.module.css';

export const metadata: Metadata = { title: 'Bobines' };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const SHELVES: { id: string; family: BoosterFamily | null; label: string }[] = [
  { id: 'tout', family: null, label: 'Tout' },
  { id: 'castings', family: 'actor', label: 'Castings · cartes Acteur' },
  { id: 'films', family: 'role', label: 'Films · cartes Rôle' },
];

export default async function BoostersPage({ searchParams }: { searchParams: Promise<{ rayon?: string }> }) {
  const sp = await searchParams;
  const shelf = SHELVES.find((x) => x.id === sp.rayon) ?? SHELVES[0];
  const ctx = await requireContext('/bobines');
  const db = getDb();
  const owned = ownedCardIds(db, ctx.player.id);
  const free = ctx.wallet.freeStock > 0;
  const tickets = ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.tickets);
  const daily = boosterOfTheDay();
  const { booster: event, endsAt } = featuredEvent();
  const fan = [getBooster('casting')!, event, getBooster('tout-clap')!];

  // La bobine la plus ouverte de la semaine reçoit l'autocollant « Populaire ».
  const popular = (db.prepare('SELECT booster_id FROM pulls WHERE created_at > ? GROUP BY booster_id ORDER BY COUNT(*) DESC LIMIT 1').get(Date.now() - WEEK_MS) as { booster_id: string } | undefined)?.booster_id;
  const flagOf = (id: string) => (id === daily.id ? 'DU JOUR' : NEW_BOOSTERS.has(id) ? 'NOUVEAU' : id === popular ? 'POPULAIRE' : undefined);

  // Deux rayons : les Castings (cartes Acteur), puis les Films (cartes Rôle) rangés par catégorie.
  const families = (['actor', 'role'] as BoosterFamily[])
    .filter((f) => !shelf.family || shelf.family === f)
    .map((f) => ({
      family: f,
      // Les Castings tiennent sur une étagère ; les Films sont rangés par catégorie.
      groups: f === 'actor'
        ? [{ id: 'castings', label: 'Toutes les bobines Casting', boosters: BOOSTERS.filter((b) => b.family === 'actor') }]
        : (Object.keys(GROUP_LABELS) as BoosterGroup[])
          .map((g) => ({ id: `film-${g}`, label: GROUP_LABELS[g], boosters: BOOSTERS.filter((b) => b.family === f && b.group === g) }))
          .filter((g) => g.boosters.length > 0),
    }));
  const progress = (id: string) => {
    const pool = poolOf(db, getBooster(id)!);
    return { owned: pool.reduce((n, c) => n + (owned.has(c.id) ? 1 : 0), 0), total: pool.length };
  };
  const eventOdds = event.slots[event.slots.length - 1].odds as Partial<Record<Rarity, number>>;

  return (
    <>
      <Nav ctx={ctx} current="/bobines" />
      <Ticker items={tickerNews(db)} variant="news" />
      <SideRails left="CLAP · PELLICULE 35 MM · KODAK VISION3 5219 · 24 IPS" right={`BOBINES ${BOOSTERS.length} · SALLE 7 · SÉANCE EN COURS`} />
      <main className={styles.main}>
        <section className={styles.hero}>
          <Beam />
          <div className={`container ${styles.heroGrid}`}>
            <div className={styles.heroText}>
              <span className="eyebrow">
                {free
                  ? <><b className={styles.hot}>{ctx.wallet.freeStock} bobine{ctx.wallet.freeStock > 1 ? 's' : ''} offerte{ctx.wallet.freeStock > 1 ? 's' : ''}</b> vous attend{ctx.wallet.freeStock > 1 ? 'ent' : ''}</>
                  : <>Prochaine bobine offerte dans <b><Countdown until={ctx.wallet.nextFreeAt ?? Date.now()} /></b></>}
                {' · '}{tickets} tickets
              </span>
              <h1 className={`display ${styles.title}`}>Choisissez<br />votre <span className="accent">bobine.</span></h1>
              <p className="lead">Déchirez le paquet, la pellicule se déroule, cinq cartes défilent. La dernière est toujours la plus rare.</p>
              <div className={styles.ctas}>
                <Link href={`/ouvrir/${daily.id}`} className={`btn btn-primary btn-lg ${free ? styles.glow : ''}`}>
                  {free ? 'Ouvrir la bobine du jour' : `Bobine du jour · ${formatNumber(daily.price)} TK`} <ArrowIcon />
                </Link>
                <span className={styles.dailyName}>{daily.name}</span>
              </div>
              <div className={styles.reserve} aria-label={`Réserve : ${ctx.wallet.freeStock} sur ${FREE_BOOSTER_CAP}`}>
                {Array.from({ length: FREE_BOOSTER_CAP }, (_, i) => <span key={i} className={i < ctx.wallet.freeStock ? styles.full : ''} />)}
                <small>{ctx.wallet.freeStock >= FREE_BOOSTER_CAP ? 'RÉSERVE PLEINE' : 'RÉSERVE'} · {ctx.wallet.freeStock} / {FREE_BOOSTER_CAP}</small>
              </div>
            </div>
            <div className={styles.fan}>
              <Rays color="rgba(255, 74, 28, 0.1)" className={styles.rays} />
              {fan.map((b, i) => (
                <Link key={b.id} href={`/bobines/${b.id}`} className={`${styles.fanPack} ${styles[`fan${i}`]}`} aria-label={`Bobine ${b.name}`}>
                  <BoosterPack booster={b} cover={boosterCover(db, b)} width={i === 1 ? 270 : 220} float interactive style={{ animationDelay: `${-i * 2}s` }} />
                </Link>
              ))}
              {free && <span className={styles.sticker}>×{ctx.wallet.freeStock}<small>OFFERTE{ctx.wallet.freeStock > 1 ? 'S' : ''}</small></span>}
            </div>
          </div>
        </section>

        <section className="container" aria-labelledby="evenement" style={{ ['--hue' as string]: event.theme.hue }}>
          <EventFrame holo className={styles.event}>
            <div className={styles.eventGrid}>
              <div className={styles.eventArt}>
                <BoosterPack booster={event} cover={boosterCover(db, event)} width={290} float interactive />
              </div>
              <div className={styles.eventText}>
                <span className={styles.badge}><span />Événement de la semaine</span>
                <h2 id="evenement" className="display">{event.name}</h2>
                <p className="lead">{event.description}</p>
                <div className={styles.eventStats}>
                  <span><b>{event.slots.length}</b> CARTES {FAMILY[event.family].label.toUpperCase()}</span>
                  {(Object.entries(eventOdds) as [Rarity, number][]).filter(([, w]) => w > 0).slice(-2).reverse().map(([r, w]) => (
                    <span key={r}>{rarityName(r).toUpperCase()} <b style={{ color: RARITIES[r].color }}>{String(w).replace('.', ',')} %</b></span>
                  ))}
                </div>
                <FlipClock until={endsAt} />
                <div className={styles.ctas}>
                  <Link href={`/ouvrir/${event.id}`} className={`btn btn-lg ${styles.eventBtn}`}>{free ? 'Ouvrir · offerte' : `Ouvrir · ${formatNumber(event.price)} TK`}</Link>
                  <Link href={`/bobines/${event.id}`} className="btn btn-lg">Voir le contenu</Link>
                </div>
              </div>
            </div>
          </EventFrame>
        </section>

        <nav className={`container ${styles.shelfTabs}`} aria-label="Rayons">
          <div className="segmented">
            {SHELVES.map((x) => (
              <Link key={x.id} href={x.id === 'tout' ? '/bobines#rayons' : `/bobines?rayon=${x.id}#rayons`} aria-current={x.id === shelf.id ? 'true' : undefined} scroll={false}>
                {x.family && <i className={x.family === 'actor' ? styles.markRound : styles.markDiamond} />}{x.label}
              </Link>
            ))}
          </div>
          <Link href="/raretes" className={styles.help}>Acteur ou Rôle ? Comment ça marche</Link>
        </nav>

        {families.map(({ family, groups }, fi) => (
          <section key={family} id={fi === 0 ? 'rayons' : undefined} className={`${styles.familyShelf} ${family === 'actor' ? styles.shelfActor : styles.shelfRole}`} aria-labelledby={`rayon-${family}`}>
            <div className={`container ${styles.familyHead}`}>
              <div className={styles.familyTitle}>
                <span className={styles.familyKicker}>
                  <i className={family === 'actor' ? styles.markRound : styles.markDiamond} />
                  {FAMILY_SHELVES[family].chip} PAR BOBINE · UNIQUEMENT DES CARTES {FAMILY[family].label.toUpperCase()}
                </span>
                <h2 id={`rayon-${family}`} className="display h1">{FAMILY_SHELVES[family].title}</h2>
                <p className="lead">{FAMILY_SHELVES[family].description}</p>
              </div>
              <div className={styles.familyLegend} aria-label={`Raretés des cartes ${FAMILY[family].label}`}>
                <span>DU PLUS COMMUN AU PLUS RARE</span>
                {ladderOf(family).map((id) => (
                  <span key={id} className={styles.legendStep}>
                    <i className={family === 'actor' ? styles.markRound : styles.markDiamond} style={{ background: RARITIES[id].color }} />
                    {RARITIES[id].label}
                  </span>
                ))}
                <Link href={`/raretes#${family === 'actor' ? 'acteurs' : 'roles'}`} className={styles.help}>Les règles</Link>
              </div>
            </div>
            {groups.map((g, i) => (
              <div key={g.id} id={g.id} className={`container ${styles.group}`}>
                <Scene n={i + 1} label={`${g.boosters.length} bobine${g.boosters.length > 1 ? 's' : ''} ${FAMILY_SHELVES[family].title}`} />
                <h3 className="display h2">{g.label}</h3>
                <div className={styles.grid}>
                  {g.boosters.map((b, k) => (
                    <PackTile
                      key={b.id}
                      booster={b}
                      cover={boosterCover(db, b)}
                      free={free}
                      canAfford={ctx.wallet.tickets >= b.price}
                      delay={-k * 1.3}
                      flag={flagOf(b.id)}
                      {...progress(b.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
