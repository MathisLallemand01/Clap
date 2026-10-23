import Link from 'next/link';
import { BoosterPack } from '@/components/BoosterPack';
import { CardLink } from '@/components/CardLink';
import { Beam, Clapper, CropMarks, Dust, Leader, EventFrame, Rays, Reel, Scene, Searchlights, TicketStub } from '@/components/Decor';
import { GameCard } from '@/components/GameCard';
import { ArrowIcon, SeatIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { Reveal } from '@/components/Reveal';
import { Ticker } from '@/components/Ticker';
import { Tilt } from '@/components/Tilt';
import { ACTOR_ODDS, BOOSTERS, getBooster, ROLE_ODDS } from '@/lib/boosters';
import { boosterCover, getCatalog, showcase } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { ACTOR_LADDER, RARITIES, ROLE_LADDER, type Rarity } from '@/lib/rarity';
import { optionalContext } from '@/lib/session';
import { tickerDrops } from '@/lib/ticker';
import type { Card } from '@/lib/types';
import styles from './home.module.css';

const ODDS: Partial<Record<Rarity, number>> = { ...ACTOR_ODDS, ...ROLE_ODDS };
const pct = (n: number | undefined) => `${String(n ?? 0).replace('.', ',')} %`;

export default async function LandingPage() {
  const ctx = await optionalContext();
  const db = getDb();
  const catalog = getCatalog(db);
  const actorsCount = catalog.filter((c) => c.kind === 'actor').length;
  const rolesCount = catalog.length - actorsCount;
  const play = ctx ? '/bobines' : '/connexion?mode=inscription';

  const one = (rarity: Rarity, skip = 0) => showcase(db, { count: skip + 1, rarities: [rarity], kind: RARITIES[rarity].kind })[skip];
  const fanLeft = one('legende');
  const fanCenter = one('icone');
  const fanRight = one('culte', 2);

  // Une seule bande qui alterne Acteurs et Rôles, de la plus haute rareté à la plus commune.
  const strip: Card[] = [];
  const actorsDesc = [...ACTOR_LADDER].reverse();
  const rolesDesc = [...ROLE_LADDER].reverse();
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 5; i++) {
      const a = one(actorsDesc[i], round + 1);
      const r = one(rolesDesc[i], round + 1);
      if (a) strip.push(a);
      if (r) strip.push(r);
    }
  }

  const ladders = [
    { title: 'Acteurs', basis: 'Notoriété de carrière', top: fanLeft, rows: [...ACTOR_LADDER].reverse() },
    { title: 'Rôles', basis: 'Notoriété du film', top: fanCenter, rows: [...ROLE_LADDER].reverse() },
  ];
  const maxOdds = 58;
  const packs = ['france', 'icones', 'scifi'].map((id) => getBooster(id)).filter((b) => b !== undefined);

  return (
    <>
      <Nav ctx={ctx} />
      <Ticker items={tickerDrops(db)} variant="live" />
      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          <Beam />
          <Dust className={styles.heroDust} />
          <div className={`container ${styles.heroGrid}`}>
            <div className={styles.heroText}>
              <span className={styles.heroEyebrow}>
                <span className={styles.rec}><i />REC</span>
                <span>TCG gratuit · sans achat · données TMDB</span>
              </span>
              <h1 className={`display ${styles.title}`}>
                <span className={styles.nowrap}>Le cinéma,</span><br />
                <span className="accent">carte</span> par<br />carte.
              </h1>
              <p className="lead">
                Du figurant oublié à la légende d’Hollywood. Ouvrez des bobines, collectionnez les acteurs, puis traquez-les dans leurs plus grands rôles.
              </p>
              <div className={styles.ctas}>
                <Link href={play} className="btn btn-primary btn-lg">{ctx ? 'Ouvrir une bobine' : 'Ouvrir ma première bobine'} <ArrowIcon /></Link>
                <Link href="#comment-jouer" className="btn btn-lg">Comment jouer</Link>
              </div>
              <dl className={styles.proof}>
                <div><dt>Acteurs</dt><dd>{formatNumber(actorsCount)}</dd></div>
                <div><dt>Rôles</dt><dd>{formatNumber(rolesCount)}</dd></div>
                <div><dt>Bobines</dt><dd>{BOOSTERS.length}</dd></div>
              </dl>
            </div>
            <div className={styles.stage}>
              <CropMarks timecode="00:00:12:07" className={styles.crop} />
              <Rays className={styles.rays} />
              <Reel size={260} className={styles.reel} />
              {fanLeft && <div className={styles.fanL}><div className={styles.float} style={{ animationDelay: '-2s' }}><Tilt><GameCard card={fanLeft} width={230} eager live /></Tilt></div></div>}
              {fanRight && <div className={styles.fanR}><div className={styles.float} style={{ animationDelay: '-4s' }}><Tilt><GameCard card={fanRight} width={230} eager live /></Tilt></div></div>}
              {fanCenter && <div className={styles.fanC}><div className={styles.float}><Tilt><GameCard card={fanCenter} width={300} eager live /></Tilt></div></div>}
              {fanCenter && (
                <TicketStub
                  className={styles.ticket}
                  top={`${RARITIES[fanCenter.rarity].label.toUpperCase()} · ${pct(ODDS[fanCenter.rarity])}`}
                  big={formatEntries(RARITIES[fanCenter.rarity].entries)}
                  bottom="ENTRÉES"
                />
              )}
            </div>
          </div>
        </section>

        {/* Bande de cartes */}
        <section aria-labelledby="generique">
          <div className="container">
            <Scene n={1} label="Au générique ce soir" />
            <div className={styles.sectionTitle}>
              <h2 id="generique" className="display h2">Le générique</h2>
              <Link href={play} className={styles.more}>Tout le catalogue ▸</Link>
            </div>
          </div>
          <div className={`container ${styles.strip}`}>
            <div className={styles.stripViewport}>
              <div className={`keep-moving ${styles.stripTrack}`}>
                {[0, 1].map((copy) => strip.map((c) => (
                  <div key={`${copy}-${c.id}`} aria-hidden={copy === 1 || undefined}>
                    {copy === 0 ? <CardLink card={c}><GameCard card={c} width={200} /></CardLink> : <GameCard card={c} width={200} />}
                  </div>
                )))}
              </div>
            </div>
          </div>
        </section>

        {/* Comment jouer */}
        <section id="comment-jouer" className={`container ${styles.section}`} aria-labelledby="jouer">
          <Scene n={2} label="3 prises, 30 secondes" />
          <h2 id="jouer" className={`display h2 ${styles.h2}`}>Comment jouer</h2>
          <div className={styles.steps}>
            {[
              { t: 'Ouvrez une bobine', d: 'Une bobine offerte toutes les 4 heures, et des tickets pour en ouvrir plus. Le paquet se déchire, la pellicule se déroule.', art: <Leader size={150} /> },
              { t: 'Suivez la bande', d: 'Cinq cartes défilent sur la pellicule, des moins connues aux plus célèbres. La dernière peut être une Icône.', art: <Reel size={150} reverse /> },
              { t: 'Complétez le générique', d: 'Retrouvez chaque acteur dans ses grands rôles, échangez avec vos amis, vendez vos doublons au Guichet.', art: <TicketStub top="CLAP · SÉANCE 21:00" big="ENTRÉE" bottom="RANG F · PLACE 12" /> },
            ].map((s, i) => (
              <Reveal key={s.t} className={styles.step} delay={i * 120}>
                <div className={styles.stepArt}>{s.art}</div>
                <div className={styles.stepHead}>
                  <span className={styles.stepNum} style={i === 2 ? { color: 'var(--accent)' } : undefined}>{i + 1}</span>
                  <span className="eyebrow">Prise {i + 1}</span>
                </div>
                <h3 className="display h3">{s.t}</h3>
                <p>{s.d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Raretés */}
        <section className={`container ${styles.section}`} aria-labelledby="raretes">
          <Scene n={3} label="Deux échelles, dix raretés" />
          <h2 id="raretes" className={`display h2 ${styles.h2}`}>Du figurant<br />à l’icône</h2>
          <div className={styles.ladders}>
            {ladders.map((l, li) => (
              <Reveal key={l.title} className={styles.ladder} delay={li * 120}>
                {l.top && <div className={styles.ladderCard}><CardLink card={l.top}><GameCard card={l.top} width={180} /></CardLink></div>}
                <div className={styles.ladderRows}>
                  <div className={styles.ladderHead}>
                    <h3 className="display h3">{l.title}</h3>
                    <span className="eyebrow">{l.basis}</span>
                  </div>
                  {l.rows.map((r) => (
                    <div key={r} className={styles.ladderRow} style={{ ['--rc' as string]: RARITIES[r].color }}>
                      <span className={styles.rowName}><i className={RARITIES[r].kind === 'role' ? styles.diamond : undefined} />{RARITIES[r].label}</span>
                      <span className={styles.rowBar}><b style={{ width: `${Math.max(3, ((ODDS[r] ?? 0) / maxOdds) * 100)}%` }} /></span>
                      <span className={styles.rowOdds}>{pct(ODDS[r])}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* À l'affiche */}
        <section className={`container ${styles.section}`} aria-labelledby="affiche">
          <Scene n={4} label={`${BOOSTERS.length} bobines`} />
          <div className={styles.sectionTitle}>
            <h2 id="affiche" className={`display h2 ${styles.h2}`}>À l’affiche</h2>
            <Link href={play} className={styles.more}>Toutes les bobines ▸</Link>
          </div>
          <EventFrame holo className={styles.marquee}>
            <div className={styles.packs}>
              {packs.map((b, i) => (
                <div key={b.id} className={styles.pack}>
                  <Link href={ctx ? `/bobines/${b.id}` : play} aria-label={`Bobine ${b.name}`}>
                    <BoosterPack booster={b} cover={boosterCover(db, b)} width={i === 1 ? 260 : 210} float interactive style={{ animationDelay: `${-i * 1.3}s` }} />
                  </Link>
                  <span className={styles.packName}>{b.name}</span>
                  <span className="eyebrow">{b.price} tickets · ou offerte</span>
                </div>
              ))}
            </div>
          </EventFrame>
        </section>

        {/* Monnaies */}
        <section className={`container ${styles.section}`} aria-labelledby="monnaies">
          <Scene n={5} label="Zéro euro" />
          <h2 id="monnaies" className={`display h2 ${styles.h2}`}>Deux monnaies</h2>
          <div className={styles.currencies}>
            <Reveal className={styles.entries}>
              <span className={styles.bgIcon} aria-hidden="true"><SeatIcon size={260} color="var(--gold)" /></span>
              <span className="eyebrow" style={{ color: 'var(--gold)' }}>Box-office</span>
              <span className={`display ${styles.currencyName}`}>Entrées</span>
              <p>La valeur de votre collection. Chaque carte rapporte des entrées selon sa rareté : de {formatNumber(RARITIES.figurant.entries)} pour un figurant à {formatEntries(RARITIES.icone.entries)} pour une Icône.</p>
            </Reveal>
            <Reveal className={styles.tickets} delay={120}>
              <span className={styles.perf} aria-hidden="true" />
              <span className="eyebrow" style={{ color: 'var(--ink)' }}>À dépenser</span>
              <span className={`display ${styles.currencyName}`}>Tickets</span>
              <p>Gagnés avec les missions, les doublons et le parrainage. Ils ouvrent des bobines en plus ou achètent des cartes au Guichet. Impossible à acheter.</p>
            </Reveal>
          </div>
        </section>

        {/* Appel final */}
        <section className={styles.final} aria-labelledby="action">
          <Searchlights />
          <div className={`container ${styles.finalInner}`}>
            <Clapper />
            <h2 id="action" className={`display ${styles.finalTitle}`}>Moteur…<br /><span className="accent">action !</span></h2>
            <p className="lead">Trois bobines offertes et 600 tickets à l’inscription. Une bobine gratuite toutes les 4 heures.</p>
            <Link href={play} className="btn btn-primary btn-lg">{ctx ? 'Ouvrir une bobine' : 'Jouer gratuitement'} <ArrowIcon /></Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
