import Link from 'next/link';
import { BoosterPack } from '@/components/BoosterPack';
import { CardLink } from '@/components/CardLink';
import { Beam, Clapper, CropMarks, Dust, Leader, EventFrame, Rays, Reel, Scene, Searchlights, TicketStub } from '@/components/Decor';
import { GameCard } from '@/components/GameCard';
import { ArrowIcon, SeatIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { RarityLadder } from '@/components/RarityLadder';
import { SideRails } from '@/components/SideRails';
import { Reveal } from '@/components/Reveal';
import { Ticker } from '@/components/Ticker';
import { Tilt } from '@/components/Tilt';
import { ACTOR_ODDS, BOOSTERS, FAMILY_SHELVES, getBooster, ROLE_ODDS } from '@/lib/boosters';
import { boosterCover, getCatalog, showcase } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { DUO_BONUS } from '@/lib/game';
import { ACTOR_LADDER, FAMILY, RARITIES, rarityName, ROLE_LADDER, type Rarity } from '@/lib/rarity';
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
  const fanCenter = one('mythe') ?? one('icone');
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

  const packs = ['casting', 'sagas', 'tout-clap'].map((id) => getBooster(id)).filter((b) => b !== undefined);

  return (
    <>
      <Nav ctx={ctx} />
      <SideRails left="CLAP · LE CINÉMA, CARTE PAR CARTE · 35 MM" right="EN SALLE · SÉANCE PERMANENTE" />
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
                Deux familles de cartes : les <b>Acteurs</b>, du figurant à la légende, et leurs <b>Rôles</b> au cinéma et en série, de la série B au mythe. Ouvrez des bobines, formez des duos, complétez les sagas.
              </p>
              <div className={styles.ctas}>
                <Link href={ctx ? '/bobines' : '/ouvrir/tout-clap'} className="btn btn-primary btn-lg">{ctx ? 'Ouvrir une bobine' : 'Ouvrir ma bobine offerte'} <ArrowIcon /></Link>
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
              <span className={styles.halo} aria-hidden="true" />
              <Rays color="rgba(255, 46, 147, 0.3)" className={styles.rays} />
              <Rays color="rgba(255, 200, 61, 0.16)" className={`${styles.rays} ${styles.raysB}`} />
              <Reel size={260} className={styles.reel} />
              {fanLeft && <div className={styles.fanL}><div className={styles.float} style={{ animationDelay: '-2s' }}><Tilt><GameCard card={fanLeft} width={230} eager live /></Tilt></div></div>}
              {fanRight && <div className={styles.fanR}><div className={styles.float} style={{ animationDelay: '-4s' }}><Tilt><GameCard card={fanRight} width={230} eager live /></Tilt></div></div>}
              {fanCenter && <div className={styles.fanC}><div className={styles.float}><Tilt><GameCard card={fanCenter} width={300} eager live /></Tilt></div></div>}
              {fanCenter && (
                <TicketStub
                  className={styles.ticket}
                  top={`${rarityName(fanCenter.rarity).toUpperCase()} · ${pct(ODDS[fanCenter.rarity])}`}
                  big={formatNumber(RARITIES[fanCenter.rarity].points)}
                  bottom="POINTS"
                />
              )}
            </div>
          </div>
        </section>

        {/* Les derniers grands tirages, entre l'accroche et la suite de la page. */}
        <div className={styles.tickerSlot}><Ticker items={tickerDrops(db)} variant="live" /></div>

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
              { t: 'Choisissez une bobine', d: 'Casting : cinq cartes Acteur. Film : cinq cartes Rôle. Une bobine offerte toutes les 10 minutes (10 en réserve), des tickets pour en ouvrir plus.', art: <Leader size={150} /> },
              { t: 'Révélez les cartes', d: 'Cliquez pour faire défiler la pellicule : les cartes arrivent de la moins rare à la plus rare. La dernière peut être un Mythe.', art: <Reel size={150} reverse /> },
              { t: 'Formez des duos', d: 'La carte Acteur + un de ses Rôles = un duo. Complétez les sagas, échangez avec vos amis, vendez vos doublons au Guichet.', art: <TicketStub top="CLAP · SÉANCE 21:00" big="DUO" bottom="ACTEUR + RÔLE" /> },
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

        {/* Deux familles */}
        <section className={`container ${styles.section}`} aria-labelledby="raretes">
          <Scene n={3} label="Deux familles, onze raretés" />
          <div className={styles.sectionTitle}>
            <h2 id="raretes" className={`display h2 ${styles.h2}`}>Acteur<br />ou Rôle ?</h2>
            <Link href="/raretes" className={styles.more}>Tout comprendre ▸</Link>
          </div>
          <div className={styles.families}>
            {([['actor', fanLeft], ['role', fanCenter]] as const).map(([kind, card], i) => (
              <Reveal key={kind} className={`${styles.familyPanel} ${kind === 'actor' ? styles.familyActor : styles.familyRole}`} delay={i * 120}>
                <div className={styles.familyIntro}>
                  {card && (
                    <div className={styles.ladderCard}>
                      <Rays color={`color-mix(in srgb, ${RARITIES[card.rarity].color} 30%, transparent)`} className={styles.ladderRays} />
                      <CardLink card={card}><GameCard card={card} width={170} live /></CardLink>
                    </div>
                  )}
                  <div className={styles.familyText}>
                    <span className={styles.familyKicker}>{FAMILY[kind].mark} CARTE {FAMILY[kind].label.toUpperCase()}</span>
                    <h3 className="display h3">{kind === 'actor' ? 'Une personne' : 'Un rôle, film ou série'}</h3>
                    <p>{kind === 'actor'
                      ? 'Le portrait d’un acteur et toute sa carrière. Sa rareté dit à quel point il est célèbre.'
                      : 'Un acteur dans un film ou une série, avec son personnage. Sa rareté dit à quel point l’œuvre et le rôle sont mythiques.'}</p>
                    <span className={styles.familyWhere}>Dans les bobines <b>{FAMILY_SHELVES[kind].title}</b> · {kind === 'actor' ? 'marqueurs ronds' : 'marqueurs en losange'}</span>
                  </div>
                </div>
                <RarityLadder kind={kind} />
              </Reveal>
            ))}
          </div>
          <div className={styles.links}>
            <span className={styles.linkItem}><b>Duo</b> la carte Acteur + un de ses Rôles = +{formatNumber(DUO_BONUS)} points</span>
            <span className={styles.linkItem}><b>Saga</b> tous les rôles d’une saga (Star Wars, Harry Potter…) = des tickets</span>
            <span className={styles.linkItem}><b>Ordre</b> les cartes se révèlent de la moins rare à la plus rare</span>
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
                  <Link href={ctx ? `/bobines/${b.id}` : `/ouvrir/${b.id}`} aria-label={ctx ? `Bobine ${b.name}` : `Ouvrir la bobine ${b.name}, offerte sans compte`}>
                    <BoosterPack booster={b} cover={boosterCover(db, b)} width={i === 1 ? 260 : 210} float interactive style={{ animationDelay: `${-i * 1.3}s` }} />
                  </Link>
                  <span className={styles.packName}>{b.name}</span>
                  <span className={`${styles.packFamily} ${b.family === 'actor' ? styles.familyActor : styles.familyRole}`}>{FAMILY[b.family].mark} {FAMILY_SHELVES[b.family].title} · {b.slots.length} cartes {FAMILY[b.family].label}</span>
                  <span className="eyebrow">{ctx ? `${b.price} tickets · ou offerte` : 'Première bobine offerte, sans compte'}</span>
                </div>
              ))}
            </div>
          </EventFrame>
        </section>

        {/* Monnaies */}
        <section className={`container ${styles.section}`} aria-labelledby="monnaies">
          <Scene n={5} label="Zéro euro" />
          <h2 id="monnaies" className={`display h2 ${styles.h2}`}>Deux monnaies, un score</h2>
          <div className={styles.currencies}>
            <Reveal className={styles.entries}>
              <span className={styles.bgIcon} aria-hidden="true"><SeatIcon size={260} color="var(--gold)" /></span>
              <span className="eyebrow" style={{ color: 'var(--gold)' }}>Pour le Guichet</span>
              <span className={`display ${styles.currencyName}`}>Sièges</span>
              <p>La monnaie du marché : on les gagne en recyclant ses doublons et en vendant ses cartes, et on les dépense pour acheter des cartes aux autres joueurs. Ils se gagnent lentement, exprès. Votre score, lui, se compte en <b>points</b> : de {formatNumber(RARITIES.figurant.points)} pour une carte commune à {formatNumber(RARITIES.mythe.points)} pour un Mythe.</p>
            </Reveal>
            <Reveal className={styles.tickets} delay={120}>
              <span className={styles.perf} aria-hidden="true" />
              <span className="eyebrow" style={{ color: 'var(--ink)' }}>À dépenser</span>
              <span className={`display ${styles.currencyName}`}>Tickets</span>
              <p>Gagnés avec les missions et le parrainage. Ils ouvrent des bobines en plus de vos bobines offertes. Impossible à acheter. <a href="/monnaies" style={{ textDecoration: 'underline' }}>Tout comprendre</a></p>
            </Reveal>
          </div>
        </section>

        {/* Appel final */}
        <section className={styles.final} aria-labelledby="action">
          <Searchlights />
          <div className={`container ${styles.finalInner}`}>
            <Clapper />
            <h2 id="action" className={`display ${styles.finalTitle}`}>Moteur…<br /><span className="accent">action !</span></h2>
            <p className="lead">Dix bobines offertes et 600 tickets à l’inscription, puis une bobine gratuite toutes les 10 minutes.</p>
            <Link href={play} className="btn btn-primary btn-lg">{ctx ? 'Ouvrir une bobine' : 'Jouer gratuitement'} <ArrowIcon /></Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
