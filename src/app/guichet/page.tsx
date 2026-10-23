import type { Metadata } from 'next';
import Link from 'next/link';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { TicketIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { Ticker } from '@/components/Ticker';
import { getCard, ownedCardIds, searchCards } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { getCollection, ownedCopies } from '@/lib/game';
import { byDeal, getListing, LISTING_DAYS, MARKET_FEE, openListings, playerListings, priceRange, type Listing } from '@/lib/market';
import { RARITIES, RARITIES_BY_VALUE, type Rarity } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { tickerSales } from '@/lib/ticker';
import { buyAction, cancelAction } from './actions';
import { Purchase } from './Purchase';
import { SellForm } from './SellForm';
import styles from './guichet.module.css';

export const metadata: Metadata = { title: 'Le Guichet' };

type Search = { vue?: string; rarete?: string; q?: string; tri?: string; annonce?: string; carte?: string; erreur?: string; achat?: string; vente?: string };

function remaining(t: number): string {
  const h = Math.max(0, Math.round((t - Date.now()) / 3600000));
  return h >= 24 ? `${Math.round(h / 24)} J` : `${h} H`;
}

function Delta({ l }: { l: Listing }) {
  const d = Math.round((l.price / l.suggested - 1) * 100);
  return <span className="mono" style={{ fontSize: 12, color: d > 5 ? '#ff9a6c' : d < 0 ? 'var(--ok)' : 'var(--muted)' }}>{d > 0 ? '+' : d < 0 ? '−' : '±'}{Math.abs(d)} %</span>;
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/guichet');
  const db = getDb();
  const view = sp.vue === 'vendre' || sp.vue === 'mes-annonces' ? sp.vue : 'acheter';
  const owned = ownedCardIds(db, ctx.player.id);

  const rarity = (sp.rarete && sp.rarete in RARITIES ? sp.rarete : null) as Rarity | null;
  let listings = openListings(db).filter((l) => !rarity || l.card.rarity === rarity);
  if (sp.q) listings = listings.filter((l) => searchCards([l.card], sp.q!).length > 0);
  if (sp.tri === 'prix') listings.sort((a, b) => a.price - b.price);
  else if (sp.tri === 'rarete') listings.sort((a, b) => RARITIES[b.card.rarity].entries - RARITIES[a.card.rarity].entries);
  else if (sp.tri === 'fin') listings.sort((a, b) => a.expiresAt - b.expiresAt);
  else listings.sort(byDeal);
  const selected = sp.annonce ? getListing(db, Number(sp.annonce)) : (listings.find((l) => l.sellerId !== ctx.player.id) ?? null);
  const bought = sp.achat ? getListing(db, Number(sp.achat)) : null;

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ vue: view === 'acheter' ? undefined : view, rarete: rarity ?? undefined, q: sp.q, tri: sp.tri, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/guichet?${s}` : '/guichet';
  };

  return (
    <>
      <Nav ctx={ctx} current="/guichet" />
      <Ticker items={tickerSales(db)} variant="market" />
      <SideRails left="CLAP · BILLETTERIE · MARCHÉ DES SPECTATEURS" right="CAISSE 2 · TICKETS UNIQUEMENT" />
      <main className="page" style={{ paddingTop: 0 }}>
        <div className="container page" style={{ paddingBottom: 0 }}>
          <p className="slug">INT. LE GUICHET — SOIR <span>PLAN 07 / PRISE 03</span></p>
          <header className="page-head">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h1 className="display h1">Le Guichet</h1>
              <p className="lead">Le marché des joueurs. Achetez et vendez vos cartes en tickets, 5 % de commission sur chaque vente.</p>
            </div>
            <div className="segmented" role="tablist" aria-label="Le Guichet">
              <Link href="/guichet" role="tab" aria-selected={view === 'acheter'}>Acheter</Link>
              <Link href="/guichet?vue=vendre" role="tab" aria-selected={view === 'vendre'}>Vendre</Link>
              <Link href="/guichet?vue=mes-annonces" role="tab" aria-selected={view === 'mes-annonces'}>Mes annonces</Link>
            </div>
          </header>
        </div>

        <div className="container page no-glow" style={{ paddingTop: 0 }}>
          {sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}
          {bought && bought.status === 'sold' && bought.sellerId !== ctx.player.id && (
            <Purchase card={bought.card} serial={bought.serial} price={bought.price} balance={ctx.wallet.tickets} unlimited={ctx.player.unlimited} />
          )}
          {sp.vente && <p className="alert alert-ok" role="status">Votre annonce est en ligne.</p>}

          {view === 'acheter' && (
            <>
              <form className={styles.filters} action="/guichet">
                <label className={styles.searchBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <span className="visually-hidden">Rechercher</span>
                  <input type="search" name="q" defaultValue={sp.q} placeholder="Acteur, film, personnage…" />
                </label>
                <select name="rarete" defaultValue={rarity ?? ''} className="input" aria-label="Rareté">
                  <option value="">Toutes les raretés</option>
                  {RARITIES_BY_VALUE.map((r) => <option key={r} value={r}>{RARITIES[r].label}</option>)}
                </select>
                <select name="tri" defaultValue={sp.tri ?? ''} className="input" aria-label="Tri">
                  <option value="">Meilleure affaire</option>
                  <option value="prix">Prix croissant</option>
                  <option value="rarete">Rareté</option>
                  <option value="fin">Fin bientôt</option>
                </select>
                <button type="submit" className="btn btn-sm">Filtrer</button>
              </form>

              <div className={styles.layout}>
                {listings.length === 0 ? (
                  <div className={`panel ${styles.empty}`}>
                    <h2 className="display h3">Aucune annonce pour l’instant</h2>
                    <p className="muted" style={{ margin: 0 }}>Soyez le premier à vendre : mettez en vente un doublon.</p>
                    <Link href="/guichet?vue=vendre" className="btn btn-primary">Vendre une carte</Link>
                  </div>
                ) : (
                  <ul className={styles.listings}>
                    {listings.slice(0, 120).map((l) => (
                      <li key={l.id}>
                        <Link href={href({ annonce: String(l.id) })} scroll={false} className={`${styles.listing} ${selected?.id === l.id ? styles.selected : ''}`}>
                          <GameCard card={l.card} width={168} serial={l.serial} />
                          <div className={styles.price}>
                            <span><TicketIcon size={20} />{formatNumber(l.price)}</span>
                            <Delta l={l} />
                          </div>
                          <div className={styles.seller}><span>{l.sellerId === ctx.player.id ? 'VOUS' : l.sellerName.toUpperCase()}</span><span>{remaining(l.expiresAt)}</span></div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {selected && selected.status === 'open' && (
                  <aside className={styles.panel} style={{ borderColor: RARITIES[selected.card.rarity].color }}>
                    <div className={styles.panelHead}><span>ANNONCE · {selected.sellerName.toUpperCase()}</span><span>FIN DANS {remaining(selected.expiresAt)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <CardLink card={selected.card}><GameCard card={selected.card} width={230} serial={selected.serial} /></CardLink>
                    </div>
                    <ul className={styles.rows}>
                      <li><span>Prix conseillé</span><b>{formatNumber(selected.suggested)} TK</b></li>
                      <li><span>Valeur</span><b>{formatEntries(RARITIES[selected.card.rarity].entries)} entrées</b></li>
                      <li><span>Vous l’avez déjà</span><b style={{ color: owned.has(selected.card.id) ? 'var(--ok)' : 'var(--accent)' }}>{owned.has(selected.card.id) ? 'Oui' : 'Non'}</b></li>
                      <li><span>Votre solde</span><b>{ctx.player.unlimited ? '∞' : formatNumber(ctx.wallet.tickets)} TK</b></li>
                    </ul>
                    {selected.sellerId === ctx.player.id ? (
                      <form action={cancelAction}><input type="hidden" name="listing" value={selected.id} /><button className="btn btn-block" type="submit">Retirer mon annonce</button></form>
                    ) : (
                      <form action={buyAction}>
                        <input type="hidden" name="listing" value={selected.id} />
                        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={ctx.wallet.tickets < selected.price}>Acheter · {formatNumber(selected.price)} TK</button>
                      </form>
                    )}
                    <span className={styles.after}>{ctx.wallet.tickets >= selected.price ? `Solde après achat : ${formatNumber(ctx.wallet.tickets - selected.price)} TK` : 'Pas assez de tickets : faites quelques missions.'}</span>
                  </aside>
                )}
              </div>
            </>
          )}

          {view === 'vendre' && <SellView ctxPlayer={ctx.player.id} cardId={sp.carte} />}

          {view === 'mes-annonces' && <MyListings playerId={ctx.player.id} />}
        </div>
      </main>
      <Footer />
    </>
  );
}

async function SellView({ ctxPlayer, cardId }: { ctxPlayer: string; cardId?: string }) {
  const db = getDb();
  const collection = getCollection(db, ctxPlayer).sort((a, b) => b.copies - a.copies || RARITIES[b.rarity].entries - RARITIES[a.rarity].entries);
  const card = cardId ? getCard(db, cardId) : null;
  const copies = card ? ownedCopies(db, ctxPlayer, card.id) : [];
  const free = copies.filter((c) => !c.listed);

  if (!card || free.length === 0) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="section-head"><h2 className="display h2">Choisissez une carte</h2><span className="rule" /><span className="eyebrow">Vos doublons d’abord</span></div>
        {collection.length === 0 ? (
          <p className="alert alert-info">Votre collection est vide. <Link href="/bobines" className="accent">Ouvrez une bobine</Link></p>
        ) : (
          <ul className="card-grid">
            {collection.slice(0, 96).map((c) => (
              <li key={c.id}>
                <Link href={`/guichet?vue=vendre&carte=${encodeURIComponent(c.id)}`} className="card-link"><GameCard card={c} width={176} serial={c.serial} /></Link>
                {c.copies > 1 && <span className="copies-badge" style={{ right: 'calc(50% - 96px)' }}>×{c.copies}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const range = priceRange(card.rarity);
  return (
    <section className={`panel ${styles.sell}`}>
      <div className={styles.sellCard}>
        <GameCard card={card} width={240} serial={free[free.length - 1].serial} />
        <span className="eyebrow">{copies.length > 1 ? `Vous en avez ${copies.length} · on vend le n° ${String(free[free.length - 1].serial).padStart(4, '0')}` : 'Votre seul exemplaire'}</span>
      </div>
      <div className={styles.sellText}>
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>Vendre une carte</span>
        <h2 className="display h2">{card.first} {card.last}{card.character ? ` · ${card.character}` : ''}</h2>
        <SellForm cardId={card.id} min={range.min} max={range.max} suggested={range.suggested} fee={MARKET_FEE} days={LISTING_DAYS} />
        <Link href="/guichet?vue=vendre" className="muted" style={{ fontSize: 14 }}>← Choisir une autre carte</Link>
      </div>
    </section>
  );
}

async function MyListings({ playerId }: { playerId: string }) {
  const mine = playerListings(getDb(), playerId);
  const label: Record<Listing['status'], string> = { open: 'EN VENTE', sold: 'VENDUE', cancelled: 'RETIRÉE', expired: 'EXPIRÉE' };
  const color: Record<Listing['status'], string> = { open: 'var(--accent)', sold: 'var(--ok)', cancelled: 'var(--faint)', expired: 'var(--faint)' };
  if (mine.length === 0) return <p className="alert alert-info">Aucune annonce. <Link href="/guichet?vue=vendre" className="accent">Vendre une carte</Link></p>;
  return (
    <ul className={styles.mine}>
      {mine.map((l) => (
        <li key={l.id}>
          <GameCard card={l.card} width={96} serial={l.serial} />
          <div className={styles.mineText}>
            <strong>{l.card.first} {l.card.last}{l.card.character ? ` · ${l.card.character}` : ''}</strong>
            <span className="mono muted" style={{ fontSize: 12 }}>{formatNumber(l.price)} TK · CONSEILLÉ {formatNumber(l.suggested)}{l.status === 'open' ? ` · FIN DANS ${remaining(l.expiresAt)}` : ''}</span>
          </div>
          <span className="mono" style={{ fontSize: 12, color: color[l.status], border: `1px solid ${color[l.status]}`, borderRadius: 999, padding: '5px 12px' }}>{label[l.status]}</span>
          {l.status === 'open' && (
            <form action={cancelAction}><input type="hidden" name="listing" value={l.id} /><button className="btn btn-sm" type="submit">Retirer</button></form>
          )}
        </li>
      ))}
    </ul>
  );
}
