import type { Metadata } from 'next';
import Link from 'next/link';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { PendingBar } from '@/components/PendingBar';
import { SideRails } from '@/components/SideRails';
import { TabContent } from '@/components/TabContent';
import { Ticker } from '@/components/Ticker';
import { countByRarity, getCatalog, searchCards } from '@/lib/catalog';
import { playerDuos, playerSagas } from '@/lib/collections';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { DUO_BONUS, getCollection, recyclePlan } from '@/lib/game';
import { FAMILY, ladderOf, RARITIES, type CardKind, type Rarity } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { tickerDrops } from '@/lib/ticker';
import { claimSagaAction, recycleAction } from './actions';
import styles from './collection.module.css';

export const metadata: Metadata = { title: 'Collection' };

type Search = { vue?: string; type?: string; rarete?: string; q?: string; tri?: string; page?: string; recycler?: string; recycle?: string; saga?: string; erreur?: string };
type View = 'acteurs' | 'roles' | 'duos' | 'sagas';
const PAGE = 120;

export default async function CollectionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/collection');
  const db = getDb();
  const owned = getCollection(db, ctx.player.id);
  const totals = countByRarity(getCatalog(db));
  const mine = countByRarity(owned);

  // Quatre onglets : les deux familles de cartes, puis ce qui les relie (duos, sagas).
  const view: View = sp.vue === 'roles' || sp.type === 'role' ? 'roles' : sp.vue === 'duos' ? 'duos' : sp.vue === 'sagas' ? 'sagas' : 'acteurs';
  const type: CardKind = view === 'roles' ? 'role' : 'actor';
  const rarity = (sp.rarete && sp.rarete in RARITIES && RARITIES[sp.rarete as Rarity].kind === type ? sp.rarete : null) as Rarity | null;
  let visible = searchCards(owned.filter((c) => c.kind === type && (!rarity || c.rarity === rarity)), sp.q ?? '');
  const ownedOf = (k: CardKind) => owned.filter((c) => c.kind === k).length;
  const catalogOf = (k: CardKind) => getCatalog(db).filter((c) => c.kind === k).length;
  const duos = view === 'duos' ? playerDuos(db, ctx.player.id) : [];
  const sagas = view === 'sagas' ? playerSagas(db, ctx.player.id, { started: true }) : [];
  const sagaCount = playerSagas(db, ctx.player.id, { started: true }).length;
  if (sp.tri === 'recent') visible = [...visible].sort((a, b) => b.obtainedAt - a.obtainedAt);
  if (sp.tri === 'doublons') visible = [...visible].sort((a, b) => b.copies - a.copies);
  const page = Math.max(1, Number(sp.page) || 1);
  const shown = visible.slice(0, page * PAGE);

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { vue: view === 'acteurs' ? undefined : view, rarete: rarity ?? undefined, q: sp.q, tri: sp.tri, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/collection?${s}` : '/collection';
  };
  const plan = sp.recycler ? recyclePlan(db, ctx.player.id) : null;
  const [recycledCards, recycledTickets] = (sp.recycle ?? '').split('-').map(Number);

  return (
    <>
      <Nav ctx={ctx} current="/collection" />
      <Ticker items={tickerDrops(db)} variant="live" />
      <SideRails left="CLAP · COLLECTION · INVENTAIRE DES BOBINES" right="RÉSERVE · RAYON A · ÉTAGÈRE 3" />
      <main className="container page">
        <p className="slug">INT. LA RÉSERVE DES BOBINES — NUIT <span>PLAN 02 / PRISE 01</span></p>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className="display h1">Collection</h1>
            <div className={styles.kpis}>
              <span><b>{formatNumber(ctx.stats.unique)}</b> / {formatNumber(getCatalog(db).length)} cartes</span>
              <span>Box-office <b>{formatEntries(ctx.stats.entries)}</b> entrées</span>
              <span><b>{formatNumber(ctx.stats.duos)}</b> duo{ctx.stats.duos > 1 ? 's' : ''}</span>
              <span><b>{formatNumber(ctx.stats.duplicates)}</b> doublons</span>
            </div>
            <div className={styles.headActions}>
              <Link href="/catalogue?possession=manquantes" className="btn btn-sm">Voir les cartes qui me manquent</Link>
              {ctx.stats.duplicates > 0 && (
                <Link href={href({ recycler: '1' })} className="btn btn-sm" scroll={false}>♻ Recycler les doublons</Link>
              )}
            </div>
          </div>
          {(view === 'acteurs' || view === 'roles') && <ul className={styles.progress} aria-label={`Complétion des cartes ${FAMILY[type].label} par rareté`}>
            <li className={styles.progressHead}>{FAMILY[type].mark} CARTES {FAMILY[type].label.toUpperCase()} · DE LA PLUS RARE À LA PLUS COMMUNE</li>
            {[...ladderOf(type)].reverse().map((r) => (
              <li key={r}>
                <Link href={href({ rarete: rarity === r ? undefined : r, page: undefined })} aria-current={rarity === r ? 'true' : undefined}>
                  <span className={styles.rarityLabel}><i className={type === 'actor' ? styles.round : styles.diamond} style={{ background: RARITIES[r].color }} />{RARITIES[r].label}</span>
                  <span className={styles.bar}><span style={{ width: `${totals[r] ? Math.max(mine[r] ? 2 : 0, (mine[r] / totals[r]) * 100) : 0}%`, background: RARITIES[r].color }} /></span>
                  <span className="mono" style={{ color: RARITIES[r].color }}>{formatNumber(mine[r])}<small> / {formatNumber(totals[r])}</small></span>
                </Link>
              </li>
            ))}
          </ul>}
        </header>

        {recycledCards > 0 && <p className="alert alert-ok" role="status">{recycledCards} doublon{recycledCards > 1 ? 's' : ''} recyclé{recycledCards > 1 ? 's' : ''} : +{formatNumber(recycledTickets)} tickets.</p>}

        <div className={styles.toolbar}>
          <nav className="segmented" aria-label="Onglets de la collection">
            <Link href="/collection" aria-current={view === 'acteurs' ? 'true' : undefined}><i className={styles.round} />Acteurs · {formatNumber(ownedOf('actor'))}<small> / {formatNumber(catalogOf('actor'))}</small><PendingBar /></Link>
            <Link href="/collection?vue=roles" aria-current={view === 'roles' ? 'true' : undefined}><i className={styles.diamond} />Rôles · {formatNumber(ownedOf('role'))}<small> / {formatNumber(catalogOf('role'))}</small><PendingBar /></Link>
            <Link href="/collection?vue=duos" aria-current={view === 'duos' ? 'true' : undefined} className={styles.tabDuo}>Duos · {formatNumber(ctx.stats.duos)}<PendingBar /></Link>
            <Link href="/collection?vue=sagas" aria-current={view === 'sagas' ? 'true' : undefined} className={styles.tabSaga}>Sagas · {formatNumber(sagaCount)} commencée{sagaCount > 1 ? 's' : ''}<PendingBar /></Link>
          </nav>
          {(view === 'acteurs' || view === 'roles') && <form className={styles.search} role="search" action="/collection">
            {view === 'roles' && <input type="hidden" name="vue" value="roles" />}
            {rarity && <input type="hidden" name="rarete" value={rarity} />}
            <label className={styles.searchBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span className="visually-hidden">Rechercher</span>
              <input type="search" name="q" defaultValue={sp.q} placeholder="Acteur, film, personnage…" />
            </label>
            <select name="tri" defaultValue={sp.tri ?? ''} className="input" aria-label="Trier">
              <option value="">Rareté</option>
              <option value="recent">Récentes</option>
              <option value="doublons">Doublons</option>
            </select>
            <button type="submit" className="btn btn-sm">OK</button>
          </form>}
        </div>

        <TabContent tab={view}>
        {view === 'duos' && (
          <section className={styles.explain} aria-label="Les duos">
            <p className="lead"><b>Un duo = la carte Acteur d’une personne + au moins un de ses Rôles.</b> Chaque duo ajoute <b>{formatNumber(DUO_BONUS)} entrées</b> à votre box-office. Les cartes Acteur viennent des bobines Casting, les Rôles des bobines Film.</p>
            <Link href="/raretes#duos" className={styles.help}>Comment ça marche</Link>
          </section>
        )}
        {view === 'duos' && (duos.length === 0
          ? <p className="alert alert-info">Aucun duo pour l’instant. Ouvrez une <Link href="/bobines?rayon=castings#rayons" className="accent">bobine Casting</Link> pour obtenir la carte Acteur d’un de vos Rôles.</p>
          : <ul className={styles.duos}>
              {duos.map((d) => (
                <li key={d.personId} className={styles.duo}>
                  <CardLink card={d.actor!}><GameCard card={d.actor!} width={150} /></CardLink>
                  <span className={styles.plus} aria-hidden="true">+</span>
                  <div className={styles.duoRoles}>
                    {d.ownedRoles.slice(0, 4).map((r) => <CardLink key={r.id} card={r}><GameCard card={r} width={110} /></CardLink>)}
                  </div>
                  <div className={styles.duoText}>
                    <span className={styles.duoTag}>DUO · +{formatNumber(DUO_BONUS)} ENTRÉES</span>
                    <strong className="display">{d.name}</strong>
                    <span className="muted">{d.ownedRoles.length} rôle{d.ownedRoles.length > 1 ? 's' : ''} sur {d.roles.length} · <Link href={`/acteur/${encodeURIComponent(d.actor!.id)}`} className="accent">voir sa filmographie</Link></span>
                  </div>
                </li>
              ))}
            </ul>)}

        {view === 'sagas' && (
          <section className={styles.explain} aria-label="Les sagas">
            <p className="lead"><b>Une saga = les Rôles de ses films + les cartes Acteur de leurs interprètes.</b> Complétez-la pour gagner des tickets (150 par carte, de 1 000 à 8 000).</p>
            <Link href="/raretes#sagas" className={styles.help}>Comment ça marche</Link>
          </section>
        )}
        {view === 'sagas' && sp.saga && <p className="alert alert-ok" role="status">Saga complète : +{formatNumber(Number(sp.saga))} tickets !</p>}
        {view === 'sagas' && sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}
        {view === 'sagas' && (sagas.length === 0
          ? <p className="alert alert-info">Aucune saga commencée. La bobine <Link href="/bobines/sagas" className="accent">Sagas</Link> ne contient que leurs grands rôles.</p>
          : <ul className={styles.sagas}>
              {sagas.slice(0, 40).map((sg) => {
                const ownedIds = new Set(owned.map((c) => c.id));
                const done = sg.owned === sg.total;
                return (
                  <li key={sg.id} className={styles.saga}>
                    <div className={styles.sagaHead}>
                      <strong className="display">{sg.name}</strong>
                      <span className="mono">{sg.owned} / {sg.total} CARTES · {sg.claimed ? 'RÉCOMPENSE REÇUE' : `${formatNumber(sg.reward)} TK À LA CLÉ`}</span>
                      {done && !sg.claimed && (
                        <form action={claimSagaAction}><input type="hidden" name="saga" value={sg.id} /><button type="submit" className="btn btn-sm btn-primary">Récupérer {formatNumber(sg.reward)} TK</button></form>
                      )}
                    </div>
                    <span className={styles.sagaBar}><span style={{ width: `${(sg.owned / sg.total) * 100}%` }} /></span>
                    <div className={styles.sagaCards}>
                      {sg.members.slice(0, 14).map((m) => (
                        <CardLink key={m.id} card={m}><span className={ownedIds.has(m.id) ? undefined : styles.missing}><GameCard card={m} width={92} /></span></CardLink>
                      ))}
                      {sg.members.length > 14 && <span className={styles.more}>+{sg.members.length - 14}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>)}

        {(view === 'duos' || view === 'sagas') ? null : owned.length === 0 ? (
          <div className={`panel ${styles.empty}`}>
            <h2 className="display h2">Votre salle est vide</h2>
            <p className="lead">Ouvrez votre première bobine : trois vous sont offertes.</p>
            <Link href="/bobines" className="btn btn-primary btn-lg">Choisir une bobine</Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="alert alert-info">
            {view === 'acteurs'
              ? <>Aucune carte Acteur ici. Elles viennent des <Link href="/bobines?rayon=castings#rayons" className="accent">bobines Casting</Link>.</>
              : <>Aucune carte Rôle ici. Elles viennent des <Link href="/bobines?rayon=films#rayons" className="accent">bobines Film</Link>.</>}
          </p>
        ) : (
          <>
            <ul className="card-grid">
              {shown.map((c) => (
                <li key={c.id}>
                  <CardLink card={c}><GameCard card={c} width={188} serial={c.serial} /></CardLink>
                  {c.copies > 1 && <span className="copies-badge">×{c.copies}</span>}
                </li>
              ))}
            </ul>
            {visible.length > shown.length && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Link href={href({ page: String(page + 1) })} className="btn" scroll={false}>Afficher plus · {formatNumber(visible.length - shown.length)} restantes</Link>
              </div>
            )}
          </>
        )}
        </TabContent>
      </main>
      <Footer />

      {plan && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="recycle-title">
            <h2 id="recycle-title" className="display">Recycler<br />les doublons</h2>
            {plan.cards === 0 ? (
              <p className="lead">Aucun doublon à recycler (les cartes en vente au Guichet sont mises de côté).</p>
            ) : (
              <>
                <p style={{ margin: 0, color: 'var(--text-2)' }}>On garde toujours votre meilleur exemplaire de chaque carte. Chaque doublon rapporte son prix conseillé en tickets.</p>
                <ul className="list-rows">
                  {plan.items.slice(0, 8).map((it) => (
                    <li key={it.card.id}>
                      <span className="sw" style={{ background: RARITIES[it.card.rarity].color }} />
                      <span className="name">{it.card.first} {it.card.last}{it.card.character ? ` · ${it.card.character}` : ''}</span>
                      <span className="mono muted">×{it.extra}</span>
                      <span className="mono" style={{ color: 'var(--ok)' }}>+{formatNumber(it.tickets)}</span>
                    </li>
                  ))}
                  {plan.items.length > 8 && <li><span /><span className="name muted">et {plan.items.length - 8} autres cartes</span><span /><span /></li>}
                </ul>
              </>
            )}
            <div className="actions">
              <Link href={href({})} className="btn" scroll={false}>Annuler</Link>
              {plan.cards > 0 && (
                <form action={recycleAction} style={{ display: 'flex' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Recycler {plan.cards} · +{formatNumber(plan.tickets)} TK</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
