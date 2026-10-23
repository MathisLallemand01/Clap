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
import { BOOSTERS, boosterOfTheDay, featuredEvent, FREE_BOOSTER_CAP, getBooster, GROUP_LABELS, NEW_BOOSTERS, slotKinds, type BoosterGroup } from '@/lib/boosters';
import { boosterCover, ownedCardIds, poolOf } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { RARITIES, type Rarity } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { tickerNews } from '@/lib/ticker';
import styles from './bobines.module.css';

export const metadata: Metadata = { title: 'Bobines' };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function BoostersPage() {
  const ctx = await requireContext('/bobines');
  const db = getDb();
  const owned = ownedCardIds(db, ctx.player.id);
  const free = ctx.wallet.freeStock > 0;
  const tickets = ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.tickets);
  const daily = boosterOfTheDay();
  const { booster: event, endsAt } = featuredEvent();
  const fan = [getBooster('casting')!, event, getBooster('avant-premiere')!];

  // La bobine la plus ouverte de la semaine reçoit l'autocollant « Populaire ».
  const popular = (db.prepare('SELECT booster_id FROM pulls WHERE created_at > ? GROUP BY booster_id ORDER BY COUNT(*) DESC LIMIT 1').get(Date.now() - WEEK_MS) as { booster_id: string } | undefined)?.booster_id;
  const flagOf = (id: string) => (id === daily.id ? 'DU JOUR' : NEW_BOOSTERS.has(id) ? 'NOUVEAU' : id === popular ? 'POPULAIRE' : undefined);

  const groups = (Object.keys(GROUP_LABELS) as BoosterGroup[])
    .map((g) => ({ id: g, label: GROUP_LABELS[g], boosters: BOOSTERS.filter((b) => b.group === g) }))
    .filter((g) => g.boosters.length > 0);
  const progress = (id: string) => {
    const pool = poolOf(db, getBooster(id)!);
    return { owned: pool.reduce((n, c) => n + (owned.has(c.id) ? 1 : 0), 0), total: pool.length };
  };
  const eventOdds = event.slots[event.slots.length - 1].odds as Partial<Record<Rarity, number>>;
  const { actor, role } = slotKinds(event);

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
                  <span><b>{actor + role}</b> CARTES {role && !actor ? 'RÔLE' : ''}</span>
                  {(Object.entries(eventOdds) as [Rarity, number][]).filter(([, w]) => w > 0).slice(-2).reverse().map(([r, w]) => (
                    <span key={r}>{RARITIES[r].label.toUpperCase()} <b style={{ color: RARITIES[r].color }}>{String(w).replace('.', ',')} %</b></span>
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

        <nav className={`container ${styles.groups}`} aria-label="Catégories">
          {groups.map((g) => <a key={g.id} href={`#${g.id}`} className="chip">{g.label} <small>{g.boosters.length}</small></a>)}
        </nav>

        {groups.map((g, i) => (
          <section key={g.id} id={g.id} className={`container ${styles.group}`} aria-labelledby={`t-${g.id}`}>
            <Scene n={i + 1} label={`${g.boosters.length} bobine${g.boosters.length > 1 ? 's' : ''}`} />
            <h2 id={`t-${g.id}`} className="display h2">{g.label}</h2>
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
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
