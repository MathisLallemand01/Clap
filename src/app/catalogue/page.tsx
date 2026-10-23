import type { Metadata } from 'next';
import Link from 'next/link';
import { CardLink } from '@/components/CardLink';
import { Footer, Nav } from '@/components/Nav';
import { actorOrigins, listActors, ownedCounts } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { countryName } from '@/lib/people';
import { ACTOR_LADDER, RARITIES } from '@/lib/rarity';
import { currentWallet } from '@/lib/session';
import styles from '../collection/collection.module.css';

export const metadata: Metadata = { title: 'Catalogue' };

const PER_PAGE = 48;

type Search = { q?: string; rarete?: string; pays?: string; page?: string };

function href(params: Search): string {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/catalogue?${qs}` : '/catalogue';
}

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const q = (params.q ?? '').slice(0, 80);
  const rarete = ACTOR_LADDER.find((r) => r === params.rarete);
  const db = getDb();
  const origins = actorOrigins(db);
  const pays = origins.find((o) => o.origin === params.pays)?.origin;
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const { player, wallet } = await currentWallet();
  const { cards, total } = listActors(db, { q, rarity: rarete, origin: pays, page, perPage: PER_PAGE });
  const counts = ownedCounts(db, player?.id ?? null, cards.map((c) => c.id));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const base = { q: q || undefined, rarete, pays };

  return (
    <>
      <Nav wallet={wallet} current="/catalogue" />
      <main className="container">
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className="display">Catalogue</h1>
            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--text)' }}>{formatNumber(total)}</span> ACTEUR{total > 1 ? 'S' : ''} · CLIQUEZ SUR UNE CARTE POUR SA FICHE ET SES RÔLES
            </span>
          </div>
          <form action="/catalogue" role="search" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {rarete && <input type="hidden" name="rarete" value={rarete} />}
            {pays && <input type="hidden" name="pays" value={pays} />}
            <label className="visually-hidden" htmlFor="q">Rechercher un acteur</label>
            <input id="q" className="input" type="search" name="q" defaultValue={q} placeholder="Rechercher un acteur…" style={{ width: 280 }} />
            <button type="submit" className="btn">Chercher</button>
          </form>
        </header>

        <div className={styles.toolbar} role="group" aria-label="Filtres">
          <Link href={href({ ...base, rarete: undefined })} className={`btn btn-sm ${!rarete ? 'btn-light' : ''}`} aria-current={!rarete ? 'true' : undefined}>
            Toutes raretés
          </Link>
          {[...ACTOR_LADDER].reverse().map((r) => (
            <Link key={r} href={href({ ...base, rarete: r })} className={`btn btn-sm ${rarete === r ? 'btn-light' : ''}`} aria-current={rarete === r ? 'true' : undefined}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: RARITIES[r].color }} />
              {RARITIES[r].label}
            </Link>
          ))}
          <span style={{ width: 1, background: 'var(--line)', margin: '0 8px' }} />
          <Link href={href({ ...base, pays: undefined })} className={`btn btn-sm ${!pays ? 'btn-light' : ''}`}>Tous pays</Link>
          {origins.slice(0, 6).map((o) => (
            <Link key={o.origin} href={href({ ...base, pays: o.origin })} className={`btn btn-sm ${pays === o.origin ? 'btn-light' : ''}`}>
              {countryName(o.origin)}
            </Link>
          ))}
        </div>

        {cards.length === 0 ? (
          <div className={`panel ${styles.empty}`}>
            <h2 className="display">Personne à l’affiche</h2>
            <p className="lead">Aucun acteur ne correspond à cette recherche.</p>
            <Link href="/catalogue" className="btn">Tout le catalogue</Link>
          </div>
        ) : (
          <ul className={styles.grid}>
            {cards.map((c) => (
              <li key={c.id}><CardLink card={c} copies={player ? counts.get(c.id) ?? 0 : undefined} /></li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 48 }}>
            {page > 1 ? <Link className="btn btn-sm" href={href({ ...base, page: String(page - 1) })}>◂ Précédente</Link> : <span className="btn btn-sm" aria-disabled="true">◂ Précédente</span>}
            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', padding: '0 12px' }}>PAGE {page} / {pages}</span>
            {page < pages ? <Link className="btn btn-sm" href={href({ ...base, page: String(page + 1) })}>Suivante ▸</Link> : <span className="btn btn-sm" aria-disabled="true">Suivante ▸</span>}
          </nav>
        )}
      </main>
      <Footer />
    </>
  );
}
