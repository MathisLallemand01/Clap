import type { Metadata } from 'next';
import Link from 'next/link';
import { Scene } from '@/components/Decor';
import { SeatIcon, TicketIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { FREE_BOOSTER_CAP, FREE_BOOSTER_EVERY_MS } from '@/lib/boosters';
import { formatNumber } from '@/lib/format';
import { DUO_BONUS, REFERRAL_REWARD, STARTING_SEATS, STARTING_TICKETS } from '@/lib/game';
import { MARKET_FEE } from '@/lib/market';
import { FAMILY, ladderOf, RARITIES, recycleSeats, suggestedSeats } from '@/lib/rarity';
import { optionalContext } from '@/lib/session';
import styles from './monnaies.module.css';

export const metadata: Metadata = {
  title: 'Tickets, sièges et points',
  description: 'À quoi servent les tickets, les sièges et les points de Clap, comment on les gagne et comment on les dépense.',
};

export default async function CurrenciesPage() {
  const ctx = await optionalContext();
  const tiers = ladderOf('role').map((r, i) => ({ role: r, actor: ladderOf('actor')[i] }));

  return (
    <>
      <Nav ctx={ctx} />
      <SideRails left="CLAP · LA CAISSE · TICKETS, SIÈGES ET POINTS" right="ZÉRO EURO · AUCUN ACHAT POSSIBLE" />
      <main className="container page">
        <p className="slug">INT. LA CAISSE DU CINÉMA — JOUR <span>PLAN 01 / PRISE 01</span></p>
        <header className={styles.head}>
          <h1 className="display h1">Tickets, sièges<br />et points</h1>
          <p className="lead">Deux monnaies pour deux usages, et un score. Rien ne s’achète avec de l’argent réel : tout se gagne en jouant.</p>
          {ctx && (
            <div className={styles.mine} aria-label="Vos soldes">
              <span><TicketIcon size={18} /><b>{ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.tickets)}</b> tickets</span>
              <span><SeatIcon size={18} /><b>{ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.seats)}</b> sièges</span>
              <span><b className={styles.star}>★</b><b>{formatNumber(ctx.wallet.points)}</b> points</span>
            </div>
          )}
        </header>

        <section className={styles.trio} aria-label="Les trois">
          <article className={`${styles.card} ${styles.tickets}`}>
            <span className={styles.icon}><TicketIcon size={34} /></span>
            <span className={styles.kicker}>Monnaie · les bobines</span>
            <h2 className="display">Tickets</h2>
            <p className={styles.what}>Pour <b>ouvrir des bobines</b> en plus de vos bobines offertes.</p>
            <div className={styles.cols}>
              <div>
                <span className={styles.colHead}>On les gagne</span>
                <ul>
                  <li>Avec les missions du jour, de la semaine et les grands objectifs</li>
                  <li>Avec le parrainage (+{formatNumber(REFERRAL_REWARD)} pour vous et votre ami)</li>
                  <li>Avec les sagas complètes</li>
                  <li>{formatNumber(STARTING_TICKETS)} pour bien démarrer</li>
                </ul>
              </div>
              <div>
                <span className={styles.colHead}>On les dépense</span>
                <ul>
                  <li>Ouvrir une bobine quand la réserve offerte est vide (de 300 à 2 000 tickets)</li>
                  <li>Les glisser dans un échange avec un ami</li>
                </ul>
              </div>
            </div>
            <p className={styles.note}>Et n’oubliez pas : une bobine offerte toutes les {FREE_BOOSTER_EVERY_MS / 60_000} minutes, {FREE_BOOSTER_CAP} en réserve au maximum.</p>
          </article>

          <article className={`${styles.card} ${styles.seats}`}>
            <span className={styles.icon}><SeatIcon size={34} /></span>
            <span className={styles.kicker}>Monnaie · le marché</span>
            <h2 className="display">Sièges</h2>
            <p className={styles.what}>Pour <b>acheter des cartes</b> aux autres joueurs, au Guichet.</p>
            <div className={styles.cols}>
              <div>
                <span className={styles.colHead}>On les gagne</span>
                <ul>
                  <li>En recyclant ses doublons (un quart du prix conseillé)</li>
                  <li>En vendant ses cartes au Guichet ({Math.round(MARKET_FEE * 100)} % de commission)</li>
                  <li>{STARTING_SEATS} pour bien démarrer</li>
                </ul>
              </div>
              <div>
                <span className={styles.colHead}>On les dépense</span>
                <ul>
                  <li>Acheter une carte précise au Guichet, celle qui manque à un duo ou à une saga</li>
                </ul>
              </div>
            </div>
            <p className={styles.note}>Les sièges se gagnent lentement, exprès : une carte rare se mérite.</p>
          </article>

          <article className={`${styles.card} ${styles.points}`}>
            <span className={styles.icon}><b>★</b></span>
            <span className={styles.kicker}>Score · le classement</span>
            <h2 className="display">Points</h2>
            <p className={styles.what}>Votre <b>score</b> : ils ne se dépensent pas, ils classent les collections.</p>
            <div className={styles.cols}>
              <div>
                <span className={styles.colHead}>Ce qui compte</span>
                <ul>
                  <li>Chaque carte <b>différente</b> possédée, selon sa rareté (tableau ci-dessous)</li>
                  <li>Chaque duo : +{DUO_BONUS}</li>
                </ul>
              </div>
              <div>
                <span className={styles.colHead}>Ce qui ne compte pas</span>
                <ul>
                  <li>Les doublons : recyclez-les sans rien perdre</li>
                </ul>
              </div>
            </div>
            <p className={styles.note}><Link href="/classement" className="accent">Voir le classement</Link></p>
          </article>
        </section>

        <section className={styles.section} aria-labelledby="bareme">
          <Scene n={2} label="Le barème" />
          <h2 id="bareme" className="display h2">Ce que vaut chaque carte</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Cran</th><th>{FAMILY.role.mark} Rôle</th><th>{FAMILY.actor.mark} Acteur</th><th className={styles.num}>Points</th><th className={styles.num}>Prix conseillé</th><th className={styles.num}>Recyclage</th></tr>
              </thead>
              <tbody>
                {tiers.map(({ role, actor }, i) => (
                  <tr key={role}>
                    <td className="mono">{i + 1}</td>
                    <td><span className={styles.rarity}><i className={styles.diamond} style={{ background: RARITIES[role].color }} />{RARITIES[role].label}</span></td>
                    <td>{actor ? <span className={styles.rarity}><i className={styles.round} style={{ background: RARITIES[actor].color }} />{RARITIES[actor].label}</span> : <span className="muted">—</span>}</td>
                    <td className={styles.num}><b>{RARITIES[role].points}</b></td>
                    <td className={styles.num}>{formatNumber(suggestedSeats(role))} sièges</td>
                    <td className={styles.num}>+{formatNumber(recycleSeats(role))} siège{recycleSeats(role) > 1 ? 's' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lead">Un même cran vaut la même chose dans les deux familles : une Légende (Acteur) vaut une Icône (Rôle). Le Mythe n’existe que côté Rôles. Au Guichet, le vendeur fixe son prix entre la moitié et le triple du prix conseillé.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
