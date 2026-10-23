import type { Metadata } from 'next';
import Link from 'next/link';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { countByRarity, getCatalog, searchCards } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { getCollection, recyclePlan } from '@/lib/game';
import { RARITIES, RARITIES_BY_VALUE, type Rarity } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { recycleAction } from './actions';
import styles from './collection.module.css';

export const metadata: Metadata = { title: 'Collection' };

type Search = { type?: string; rarete?: string; q?: string; tri?: string; page?: string; recycler?: string; recycle?: string };
const PAGE = 120;

export default async function CollectionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/collection');
  const db = getDb();
  const owned = getCollection(db, ctx.player.id);
  const totals = countByRarity(getCatalog(db));
  const mine = countByRarity(owned);

  const type = sp.type === 'actor' || sp.type === 'role' ? sp.type : 'all';
  const rarity = (sp.rarete && sp.rarete in RARITIES ? sp.rarete : null) as Rarity | null;
  let visible = searchCards(owned.filter((c) => (type === 'all' || c.kind === type) && (!rarity || c.rarity === rarity)), sp.q ?? '');
  if (sp.tri === 'recent') visible = [...visible].sort((a, b) => b.obtainedAt - a.obtainedAt);
  if (sp.tri === 'doublons') visible = [...visible].sort((a, b) => b.copies - a.copies);
  const page = Math.max(1, Number(sp.page) || 1);
  const shown = visible.slice(0, page * PAGE);

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { type: type === 'all' ? undefined : type, rarete: rarity ?? undefined, q: sp.q, tri: sp.tri, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/collection?${s}` : '/collection';
  };
  const plan = sp.recycler ? recyclePlan(db, ctx.player.id) : null;
  const [recycledCards, recycledTickets] = (sp.recycle ?? '').split('-').map(Number);

  return (
    <>
      <Nav ctx={ctx} current="/collection" />
      <main className="container page">
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className="display h1">Collection</h1>
            <div className={styles.kpis}>
              <span><b>{formatNumber(ctx.stats.unique)}</b> / {formatNumber(getCatalog(db).length)} cartes</span>
              <span>Box-office <b>{formatEntries(ctx.stats.entries)}</b> entrées</span>
              <span><b>{formatNumber(ctx.stats.duplicates)}</b> doublons</span>
            </div>
            {ctx.stats.duplicates > 0 && (
              <Link href={href({ recycler: '1' })} className="btn btn-sm" scroll={false}>♻ Recycler les doublons</Link>
            )}
          </div>
          <ul className={styles.progress} aria-label="Complétion par rareté">
            {RARITIES_BY_VALUE.map((r) => (
              <li key={r}>
                <Link href={href({ rarete: rarity === r ? undefined : r, page: undefined })} aria-current={rarity === r ? 'true' : undefined}>
                  <span>{RARITIES[r].label}</span>
                  <span className={styles.bar}><span style={{ width: `${totals[r] ? Math.max(mine[r] ? 2 : 0, (mine[r] / totals[r]) * 100) : 0}%`, background: RARITIES[r].color }} /></span>
                  <span className="mono" style={{ color: RARITIES[r].color }}>{formatNumber(mine[r])}<small> / {formatNumber(totals[r])}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        </header>

        {recycledCards > 0 && <p className="alert alert-ok" role="status">{recycledCards} doublon{recycledCards > 1 ? 's' : ''} recyclé{recycledCards > 1 ? 's' : ''} : +{formatNumber(recycledTickets)} tickets.</p>}

        <div className={styles.toolbar}>
          <div className="segmented" role="group" aria-label="Type de carte">
            <Link href={href({ type: undefined, page: undefined })} aria-current={type === 'all' ? 'true' : undefined}>Toutes · {formatNumber(owned.length)}</Link>
            <Link href={href({ type: 'actor', page: undefined })} aria-current={type === 'actor' ? 'true' : undefined}>Acteurs</Link>
            <Link href={href({ type: 'role', page: undefined })} aria-current={type === 'role' ? 'true' : undefined}>Rôles</Link>
          </div>
          <form className={styles.search} role="search" action="/collection">
            {type !== 'all' && <input type="hidden" name="type" value={type} />}
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
          </form>
        </div>

        {owned.length === 0 ? (
          <div className={`panel ${styles.empty}`}>
            <h2 className="display h2">Votre salle est vide</h2>
            <p className="lead">Ouvrez votre première bobine : trois vous sont offertes.</p>
            <Link href="/bobines" className="btn btn-primary btn-lg">Choisir une bobine</Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="alert alert-info">Aucune carte ne correspond. <Link href="/collection" className="accent">Tout afficher</Link></p>
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
