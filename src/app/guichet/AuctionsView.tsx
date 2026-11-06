import Link from 'next/link';
import { AuctionClock, LeaderCountdown } from '@/components/AuctionClock';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { auctionBids, getAuction, leaderMax, openAuctions } from '@/lib/auctions';
import { cotes, vsCote } from '@/lib/cote';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { RARITIES, rarityName } from '@/lib/rarity';
import { TRADE_MIN_PULLS } from '@/lib/social';
import type { Context } from '@/lib/session';
import { cancelAuctionAction } from './actions';
import { BidForm } from './BidForm';
import styles from './auctions.module.css';

const lotNo = (id: number) => `LOT Nº ${String(id).padStart(3, '0')}`;
const tc = (t: number) => `TC ${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' }).format(t)}`;

/** La Salle des ventes : le lot sous le projecteur, le carnet du commissaire-priseur, les lots en salle. */
export function AuctionsView({ ctx, lot, offre, nouveau }: { ctx: Context; lot?: string; offre?: string; nouveau?: string }) {
  const db = getDb();
  const lots = openAuctions(db);
  const selected = lot ? getAuction(db, Number(lot)) : (lots.find((a) => a.sellerId !== ctx.player.id) ?? lots[0] ?? null);
  const cote = new Map(cotes(db));
  const locked = !ctx.player.unlimited && ctx.stats.pulls < TRADE_MIN_PULLS;

  return (
    <div className={styles.wrap}>
      {nouveau && <p className="alert alert-ok" role="status">Votre lot est en salle. Les joueurs qui guettent cette carte ont reçu un télégramme.</p>}
      {offre === 'leading' && <p className="alert alert-ok" role="status">Vous menez ! Vos sièges sont mis de côté jusqu’à la fin du lot.</p>}
      {offre === 'outbid' && <p className="alert alert-error" role="alert">Le plafond secret du meneur couvre votre offre : il reste devant. Relancez plus haut.</p>}
      {offre === 'won' && <p className="alert alert-ok" role="status">Adjugé ! La carte est dans votre collection.</p>}
      {locked && <p className="alert alert-info">La Salle des ventes ouvre après {TRADE_MIN_PULLS} bobines ouvertes : encore {TRADE_MIN_PULLS - ctx.stats.pulls}. Vous pouvez déjà regarder les lots.</p>}

      {selected ? <LotPanel ctx={ctx} a={selected} cote={cote.get(selected.card.id) ?? null} locked={locked} /> : (
        <div className={`panel ${styles.empty}`}>
          <h2 className="display h3">La salle est vide pour l’instant</h2>
          <p className="muted" style={{ margin: 0 }}>Mettez une carte aux enchères : choisissez-la dans « Vendre », puis « Aux enchères ».</p>
          <Link href="/guichet?vue=vendre" className="btn btn-primary">Mettre une carte aux enchères</Link>
        </div>
      )}

      {lots.length > 0 && (
        <section className={styles.room}>
          <div className="section-head"><h2 className="display h2">Lots en salle</h2><span className="rule" /><span className="eyebrow">Bientôt adjugés d’abord · en rouge : moins de 5 min</span></div>
          <ul className={styles.lots}>
            {lots.map((a) => {
              const d = vsCote(a.currentBid ?? a.startPrice, cote.get(a.card.id));
              return (
                <li key={a.id}>
                  <Link href={`/guichet?vue=encheres&lot=${a.id}`} scroll={false} className={`${styles.lotCard} ${selected?.id === a.id ? styles.lotOn : ''}`}>
                    <GameCard card={a.card} width={150} serial={a.serial} />
                    <span className="eyebrow">{lotNo(a.id)}</span>
                    <b className={styles.lotPrice}>{formatNumber(a.currentBid ?? a.startPrice)} <small>sièges</small></b>
                    <span className={styles.lotMeta}>{a.currentBid === null ? 'MISE À PRIX' : `${a.bids} OFFRE${a.bids > 1 ? 'S' : ''}`}{d !== null && <> · <span className={d < 0 ? styles.good : styles.bad}>{d > 0 ? '+' : ''}{d} %</span></>}</span>
                    <AuctionClock endsAt={a.endsAt} className={styles.clock} hotClassName={styles.hot} />
                    {a.leaderId === ctx.player.id && <span className={styles.leadTag}>VOUS MENEZ</span>}
                    {a.sellerId === ctx.player.id && <span className={styles.mineTag}>VOTRE LOT</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={styles.rules}>
        <div><b>Sièges mis de côté</b>Votre plafond est bloqué tant que vous menez. Dépassé ? Il vous revient aussitôt.</div>
        <div><b>Pas de vol à la dernière seconde</b>Une enchère dans la dernière minute rallonge le lot de 2 minutes.</div>
        <div><b>Durées</b>Le vendeur choisit 1 h, 6 h, 24 h ou 3 jours, une mise à prix et, s’il veut, un prix d’achat immédiat.</div>
        <div><b>Commission</b>5 % prélevés au vendeur, comme les ventes à prix fixe. Ouvert après {TRADE_MIN_PULLS} bobines ouvertes.</div>
      </section>
    </div>
  );
}

function LotPanel({ ctx, a, cote, locked }: { ctx: Context; a: NonNullable<ReturnType<typeof getAuction>>; cote: number | null; locked: boolean }) {
  const db = getDb();
  const bids = auctionBids(db, a.id);
  const color = RARITIES[a.card.rarity].color;
  const mine = a.sellerId === ctx.player.id;
  const leading = a.leaderId === ctx.player.id;
  const myMax = leading ? leaderMax(db, a.id, ctx.player.id) : null;
  const shown = a.currentBid ?? a.startPrice;
  const d = vsCote(shown, cote);
  const title = a.card.character ?? `${a.card.first} ${a.card.last}`;
  return (
    <>
      <section className={`panel ${styles.lot}`} style={{ '--rc': color } as React.CSSProperties}>
        <div className={styles.stage}>
          <span className={styles.lotNo}>{lotNo(a.id)}</span>
          <CardLink card={a.card}><GameCard card={a.card} width={230} serial={a.serial} eager /></CardLink>
          <span className={styles.pedestal} aria-hidden="true" />
          <span className="eyebrow" style={{ color }}>{rarityName(a.card.rarity)}{a.card.character ? ` · ${a.card.character}` : ''}</span>
        </div>
        <div className={styles.info}>
          <div className={styles.infoHead}>
            <div>
              <span className="eyebrow">Mis en vente par <b style={{ color: 'var(--text)' }}>{mine ? 'vous' : a.sellerName}</b> · mise à prix {formatNumber(a.startPrice)} sièges</span>
              <h2 className="display h2" style={{ marginTop: 10 }}>{title}</h2>
              <p className="muted" style={{ margin: '6px 0 0' }}>{a.card.first} {a.card.last}{a.card.film ? ` · ${a.card.film}${a.card.year ? ` (${a.card.year})` : ''}` : ''} · exemplaire Nº {String(a.serial).padStart(4, '0')}</p>
            </div>
            {a.status === 'open' ? (
              <div className={styles.timer}><LeaderCountdown endsAt={a.endsAt} total={Math.max(1, a.endsAt - a.createdAt)} /><span className="eyebrow">Le marteau tombe dans</span><AuctionClock endsAt={a.endsAt} className={styles.timerText} hotClassName={styles.hot} /></div>
            ) : <span className={styles.stamp}>{a.status === 'sold' ? 'Adjugé !' : a.status === 'unsold' ? 'Invendu' : 'Retiré'}</span>}
          </div>
          <div className={styles.stats}>
            <div><span className="eyebrow">{a.status === 'sold' ? 'Adjugé à' : 'Enchère actuelle'}</span><b>{formatNumber(shown)} <small>sièges</small></b><span>{a.currentBid === null ? 'aucune offre : mise à prix' : `par ${leading ? 'vous' : a.leaderName ?? 'un joueur'} · ${a.bids} offre${a.bids > 1 ? 's' : ''}`}</span></div>
            <div><span className="eyebrow">La cote · médiane 30 j</span><b>{cote !== null ? formatNumber(cote) : '—'}</b><span className={d === null ? '' : d <= 0 ? styles.good : styles.bad}>{cote === null ? 'pas encore cotée' : `${d! > 0 ? '▲ +' : d! < 0 ? '▼ ' : ''}${d} % de la cote`}</span></div>
            <div><span className="eyebrow">Adjuger tout de suite</span><b>{a.buyout !== null ? formatNumber(a.buyout) : '—'}</b><span>{a.buyout !== null ? 'prix d’achat immédiat fixé par le vendeur' : 'pas d’achat immédiat'}</span></div>
          </div>
          {a.status === 'open' && !mine && !locked && (
            <BidForm lot={a.id} minNext={a.minNext} buyout={a.buyout} balance={ctx.wallet.seats} unlimited={ctx.player.unlimited} leading={leading} myMax={myMax} />
          )}
          {leading && myMax !== null && <p className={styles.hint}>Votre plafond secret : <b>{formatNumber(myMax)} sièges</b> (mis de côté).</p>}
          {mine && a.status === 'open' && (
            a.bids === 0
              ? <form action={cancelAuctionAction}><input type="hidden" name="lot" value={a.id} /><button className="btn" type="submit">Retirer mon lot</button></form>
              : <p className={styles.hint}>Des enchères sont posées : le lot ira jusqu’au bout.</p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/regie?guetter=${encodeURIComponent(a.card.id)}`} className="btn btn-sm">☆ Guetter cette carte</Link>
            <CardLink card={a.card} className="btn btn-sm">La cote et la fiche</CardLink>
          </div>
        </div>
      </section>
      <section className={`panel ${styles.log}`}>
        <div className="section-head"><h2 className="display h3">Le carnet du commissaire-priseur</h2><span className="rule" /></div>
        <ol>
          {bids.map((b, i) => (
            <li key={i}><span className="mono muted">{tc(b.at)}</span><span><b>{b.bidderId === ctx.player.id ? 'Vous' : b.bidderName}</b> · {b.auto ? 'enchère automatique' : 'enchère'}</span><b className="mono">{formatNumber(b.amount)}</b></li>
          ))}
          <li><span className="mono muted">{tc(a.createdAt)}</span><span className="muted">Ouverture du lot · mise à prix</span><b className="mono">{formatNumber(a.startPrice)}</b></li>
        </ol>
      </section>
    </>
  );
}
