import Link from 'next/link';
import { BoosterPack } from '@/components/BoosterPack';
import { GameCard } from '@/components/GameCard';
import { ArrowIcon, SeatIcon, TicketIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { Reveal } from '@/components/Reveal';
import { ACTOR_ODDS, BOOSTERS, getBooster, ROLE_ODDS } from '@/lib/boosters';
import { boosterCover, getCatalog, showcase } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { RARITIES, RARITIES_BY_VALUE } from '@/lib/rarity';
import { optionalContext } from '@/lib/session';
import type { Card } from '@/lib/types';
import styles from './home.module.css';

const ODDS: Record<string, number | undefined> = { ...ACTOR_ODDS, ...ROLE_ODDS };

function Reel({ className }: { className?: string }) {
  const holes = Array.from({ length: 6 }, (_, k) => {
    const a = ((k * 60 + 30) * Math.PI) / 180;
    return { x: 100 + 58 * Math.cos(a), y: 100 + 58 * Math.sin(a) };
  });
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#0f0f12" stroke="#26262b" strokeWidth="2" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="#1c1c21" strokeWidth="1" />
      {holes.map((h, i) => <circle key={i} cx={h.x} cy={h.y} r="22" fill="#0b0b0d" stroke="#26262b" strokeWidth="1.5" />)}
      <circle cx="100" cy="100" r="15" fill="#141417" stroke="#33333a" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="5" fill="#ff4a1c" />
    </svg>
  );
}

export default async function LandingPage() {
  const ctx = await optionalContext();
  const db = getDb();
  const catalog = getCatalog(db);
  const actorsCount = catalog.filter((c) => c.kind === 'actor').length;
  const rolesCount = catalog.length - actorsCount;

  const icons = showcase(db, { count: 3, kind: 'role', rarities: ['icone'] });
  const legends = showcase(db, { count: 3, kind: 'actor', rarities: ['legende'] });
  const fan = [legends[1], icons[1], legends[0], icons[0], legends[2]].filter(Boolean) as Card[];
  const rowA = showcase(db, { count: 16, kind: 'actor', rarities: ['legende', 'tete'] });
  const rowB = showcase(db, { count: 16, kind: 'role', rarities: ['icone', 'chef', 'culte'] }).slice(3);
  const ladder = RARITIES_BY_VALUE.map((r) => showcase(db, { count: 1, rarities: [r], kind: RARITIES[r].kind })[0]).filter(Boolean) as Card[];
  const packs = ['icones', 'france', 'hollywood', 'scifi', 'annees-80', 'serie-b'].map((id) => getBooster(id)!);
  const play = ctx ? '/bobines' : '/connexion?mode=inscription';

  return (
    <>
      <Nav ctx={ctx} />
      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.spot} aria-hidden="true" />
          <div className={`container ${styles.heroGrid}`}>
            <div className={styles.heroText}>
              <span className="eyebrow">TCG de cinéma · 100 % gratuit · données TMDB</span>
              <h1 className={`display ${styles.title}`}>
                Le cinéma,<br />
                <span className="accent">carte</span> par carte.
              </h1>
              <p className="lead">
                Ouvrez des bobines, collectionnez {formatNumber(actorsCount)} acteurs, du figurant oublié à la légende d’Hollywood, puis traquez-les dans leurs rôles : le Joker, Ripley, Forrest Gump…
              </p>
              <div className={styles.ctas}>
                <Link href={play} className="btn btn-primary btn-lg">{ctx ? 'Ouvrir une bobine' : 'Jouer gratuitement'} <ArrowIcon /></Link>
                <Link href="#comment-jouer" className="btn btn-lg">Comment ça marche</Link>
              </div>
              <dl className={styles.proof}>
                <div><dt>Acteurs</dt><dd>{formatNumber(actorsCount)}</dd></div>
                <div><dt>Rôles</dt><dd>{formatNumber(rolesCount)}</dd></div>
                <div><dt>Bobines</dt><dd>{BOOSTERS.length}</dd></div>
                <div><dt>Prix</dt><dd>0 €</dd></div>
              </dl>
            </div>
            <div className={styles.stage} aria-hidden="true">
              <Reel className={styles.reelBig} />
              <Reel className={styles.reelSmall} />
              <div className={styles.beam} />
              <div className={styles.fan}>
                {fan.map((c, i) => (
                  <div key={c.id} className={styles.fanCard} style={{ ['--i' as string]: i - 2 }}>
                    <GameCard card={c} width={210} eager />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Défilé de cartes */}
        <section className={styles.marquee} aria-label="Un aperçu des cartes">
          <div className="sprockets" />
          <div className={styles.track}>
            <div className={styles.row}>{[...rowA, ...rowA].map((c, i) => <GameCard key={`a${i}`} card={c} width={150} />)}</div>
          </div>
          <div className={`${styles.track} ${styles.reverse}`}>
            <div className={styles.row}>{[...rowB, ...rowB].map((c, i) => <GameCard key={`b${i}`} card={c} width={150} />)}</div>
          </div>
          <div className="sprockets" />
        </section>

        {/* Comment jouer */}
        <section id="comment-jouer" className={`container ${styles.how}`}>
          <Reveal className="section-head">
            <span className="num">01</span>
            <h2 className="display h2">Comment jouer</h2>
            <span className="rule" />
          </Reveal>
          <div className={styles.steps}>
            <Reveal className={styles.step}>
              <div className={styles.stepArt}>
                <BoosterPack booster={getBooster('casting')!} cover={boosterCover(db, getBooster('casting')!)} width={150} float page="var(--panel)" />
              </div>
              <span className={styles.stepNum}>1</span>
              <h3 className="display h3">Ouvrez une bobine</h3>
              <p>Une bobine offerte toutes les 4 heures, et des tickets pour en ouvrir plus. 18 thèmes : Cinéma français, Science-fiction, Années 80…</p>
            </Reveal>
            <Reveal className={styles.step} delay={120}>
              <div className={styles.stepArt}>
                <div className={styles.shutterDemo}>
                  <div className={styles.shutterCard}>{icons[2] && <GameCard card={icons[2]} width={130} />}</div>
                  <div className={styles.shutter}><span>VIGN. 03</span></div>
                </div>
              </div>
              <span className={styles.stepNum}>2</span>
              <h3 className="display h3">Révélez à l’obturateur</h3>
              <p>La pellicule défile image par image et chaque carte se dévoile en glissant, au rythme du projecteur.</p>
            </Reveal>
            <Reveal className={styles.step} delay={240}>
              <div className={styles.stepArt}>
                <div className={styles.trade}>
                  {legends[2] && <div className={styles.tradeA}><GameCard card={legends[2]} width={110} /></div>}
                  <span className={styles.tradeArrows}>⇄</span>
                  {icons[0] && <div className={styles.tradeB}><GameCard card={icons[0]} width={110} /></div>}
                </div>
              </div>
              <span className={styles.stepNum}>3</span>
              <h3 className="display h3">Collectionnez, échangez</h3>
              <p>Complétez les castings, échangez avec vos amis, vendez vos doublons au Guichet et grimpez au box-office.</p>
            </Reveal>
          </div>
        </section>

        {/* Raretés */}
        <section className={styles.rarities}>
          <div className="container">
            <Reveal className="section-head">
              <span className="num">02</span>
              <h2 className="display h2">Dix raretés, deux échelles</h2>
              <span className="rule" />
            </Reveal>
            <p className="lead" style={{ marginTop: 18 }}>Les cartes Acteur suivent la carrière de l’acteur ; les cartes Rôle, la notoriété du film. Tout en haut : les Icônes, une légende dans le rôle de sa vie.</p>
          </div>
          <div className={styles.ladder}>
            {ladder.map((c, i) => (
              <Reveal key={c.id} className={`${styles.rung} ${c.rarity === 'icone' ? styles.iconRung : ''}`} delay={i * 60}>
                <GameCard card={c} width={176} />
                <div className={styles.rungLabel} style={{ borderColor: RARITIES[c.rarity].color }}>
                  <strong>{RARITIES[c.rarity].label}</strong>
                  <span className="mono" style={{ color: RARITIES[c.rarity].color }}>{String(ODDS[c.rarity] ?? '').replace('.', ',')} %</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Bobines */}
        <section className={`container ${styles.packsSection}`}>
          <Reveal className="section-head">
            <span className="num">03</span>
            <h2 className="display h2">{BOOSTERS.length} bobines thématiques</h2>
            <span className="rule" />
            <Link href={play} className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>TOUTES LES BOBINES ▸</Link>
          </Reveal>
          <div className={styles.packs}>
            {packs.map((b, i) => (
              <Reveal key={b.id} className={styles.packItem} delay={i * 80}>
                <Link href={ctx ? `/bobines/${b.id}` : play} aria-label={b.name}>
                  <BoosterPack booster={b} cover={boosterCover(db, b)} width={190} float interactive style={{ animationDelay: `${-i * 0.9}s` }} />
                </Link>
                <span className="eyebrow">{b.name}</span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Économie et social */}
        <section className={`container ${styles.economy}`}>
          <Reveal className="section-head">
            <span className="num">04</span>
            <h2 className="display h2">Deux monnaies, zéro euro</h2>
            <span className="rule" />
          </Reveal>
          <div className={styles.currencies}>
            <Reveal className={styles.currency}>
              <span className={styles.currencyIcon} style={{ background: 'var(--text)' }}><SeatIcon size={56} color="var(--ink)" /></span>
              <div>
                <h3 className="display h3">Entrées</h3>
                <p>La valeur de votre collection, comme le box-office d’un film. Une Icône vaut un million d’entrées.</p>
              </div>
            </Reveal>
            <Reveal className={styles.currency} delay={120}>
              <span className={styles.currencyIcon} style={{ background: 'var(--accent)' }}><TicketIcon size={64} color="var(--ink)" /></span>
              <div>
                <h3 className="display h3">Tickets</h3>
                <p>Gagnés avec les missions et les doublons, dépensés en bobines ou au Guichet. Impossible à acheter.</p>
              </div>
            </Reveal>
          </div>
          <div className={styles.features}>
            {[
              ['Missions', 'Défis du jour, de la semaine et sagas au long cours.'],
              ['Le Guichet', 'Le marché des joueurs : achetez et vendez en tickets.'],
              ['Échanges', 'Proposez vos doublons à vos amis, carte contre carte.'],
              ['Bandes-annonces', 'Chaque carte Rôle ouvre la bande-annonce du film.'],
            ].map(([t, d], i) => (
              <Reveal key={t} className={styles.feature} delay={i * 80}>
                <span className="mono" style={{ color: 'var(--accent)', fontSize: 13 }}>{String(i + 1).padStart(2, '0')}</span>
                <strong className="display">{t}</strong>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Appel final */}
        <section className="container">
          <Reveal className={styles.final}>
            <div className={styles.clapper} aria-hidden="true" />
            <span className="eyebrow">Scène 1 · prise 1</span>
            <h2 className="display">Moteur…<br /><span className="accent">action !</span></h2>
            <p className="lead">Trois bobines offertes et 600 tickets à l’inscription. Sans carte bancaire, sans achat, sans piège.</p>
            <Link href={play} className="btn btn-primary btn-lg">{ctx ? 'Ouvrir une bobine' : 'Créer mon compte'} <ArrowIcon /></Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
