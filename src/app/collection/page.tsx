import type { Metadata } from 'next';
import Link from 'next/link';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { getCatalog, getCollection } from '@/lib/game';
import { RARITIES, RARITIES_BY_VALUE, type CardKind } from '@/lib/rarity';
import { currentWallet } from '@/lib/session';
import styles from './collection.module.css';

export const metadata: Metadata = { title: 'Collection' };

const FILTERS: { id: 'all' | CardKind; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'actor', label: 'Acteurs' },
  { id: 'role', label: 'Rôles' },
];

export default async function CollectionPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const filter = FILTERS.find((f) => f.id === type)?.id ?? 'all';
  const { player, stats, wallet } = await currentWallet();
  const db = getDb();
  const owned = player ? getCollection(db, player.id) : [];
  const catalog = getCatalog(db);
  const visible = owned.filter((c) => filter === 'all' || c.kind === filter);

  const progress = RARITIES_BY_VALUE.map((r) => ({
    rarity: RARITIES[r],
    have: owned.filter((c) => c.rarity === r).length,
    total: catalog.filter((c) => c.rarity === r).length,
  }));

  return (
    <>
      <Nav wallet={wallet} current="/collection" />
      <main className="container">
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className="display">Collection</h1>
            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--text)' }}>{formatNumber(owned.length)}</span> / {formatNumber(catalog.length)} CARTES · BOX-OFFICE{' '}
              <span style={{ color: 'var(--text)' }}>{formatEntries(stats?.entries ?? 0)}</span> ENTRÉES
            </span>
          </div>
          <ul className={styles.progress} aria-label="Complétion par rareté">
            {progress.map(({ rarity, have, total }) => (
              <li key={rarity.id}>
                <span>{rarity.label}</span>
                <span className={styles.bar}>
                  <span style={{ width: `${total ? (have / total) * 100 : 0}%`, background: rarity.color }} />
                </span>
                <span className="mono" style={{ color: rarity.color }}>{have} / {total}</span>
              </li>
            ))}
          </ul>
        </header>

        <div className={styles.toolbar} role="group" aria-label="Type de carte">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.id === 'all' ? '/collection' : `/collection?type=${f.id}`}
              className={`btn btn-sm ${filter === f.id ? 'btn-light' : ''}`}
              aria-current={filter === f.id ? 'true' : undefined}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className={`panel ${styles.empty}`}>
            <h2 className="display">Votre salle est vide</h2>
            <p className="lead">Ouvrez votre première bobine : trois vous sont offertes.</p>
            <Link href="/ouvrir/casting" className="btn btn-primary">Ouvrir une bobine</Link>
          </div>
        ) : (
          <ul className={styles.grid}>
            {visible.map((c) => (
              <li key={c.id}>
                <GameCard card={c} width={190} serial={c.serial} />
                {c.copies > 1 && <span className={styles.copies}>×{c.copies}</span>}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
