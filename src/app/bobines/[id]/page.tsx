import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoosterPack } from '@/components/BoosterPack';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { getBooster, GROUP_LABELS } from '@/lib/boosters';
import { boosterCover, byValue, countByRarity, ownedCardIds, poolOf, searchCards } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { RARITIES, RARITIES_BY_VALUE, type Rarity } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import styles from './contenu.module.css';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ rarete?: string; voir?: string; q?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = getBooster((await params).id);
  return { title: b ? `Contenu · ${b.name}` : 'Bobine' };
}

const PREVIEW = 12;
const PAGE = 96;

export default async function BoosterContentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const booster = getBooster(id);
  if (!booster) notFound();
  const ctx = await requireContext(`/bobines/${id}`);
  const db = getDb();
  const pool = poolOf(db, booster);
  const owned = ownedCardIds(db, ctx.player.id);
  const counts = countByRarity(pool);
  const have = pool.reduce((n, c) => n + (owned.has(c.id) ? 1 : 0), 0);
  const odds: Partial<Record<Rarity, number>> = {};
  for (const slot of booster.slots) for (const [r, w] of Object.entries(slot.odds)) odds[r as Rarity] = Math.max(odds[r as Rarity] ?? 0, w);
  // Ordre des chances : la rareté la moins probable d'abord, la plus courante à la fin.
  const tiers = RARITIES_BY_VALUE.filter((r) => counts[r] > 0 && (odds[r] ?? 0) > 0)
    .sort((a, b) => (odds[a] ?? 0) - (odds[b] ?? 0) || RARITIES[b].entries - RARITIES[a].entries);
  const focus = (sp.rarete && sp.rarete in RARITIES ? sp.rarete : null) as Rarity | null;
  const missingOnly = sp.voir === 'manquantes';
  const free = ctx.wallet.freeStock > 0;

  // Dans chaque rareté : d'abord les cartes possédées, puis les plus célèbres.
  const sortTier = (r: Rarity) => {
    const cards = pool.filter((c) => c.rarity === r && (!missingOnly || !owned.has(c.id))).sort(byValue);
    return [...cards.filter((c) => owned.has(c.id)), ...cards.filter((c) => !owned.has(c.id))];
  };
  const focusCards = focus ? searchCards(sortTier(focus), sp.q ?? '') : [];
  const page = Math.max(1, Number(sp.page) || 1);

  return (
    <>
      <Nav ctx={ctx} current="/bobines" />
      <main className="container page">
        <div className={styles.crumbs}>
          <Link href="/bobines">BOBINES</Link><span>/</span><span>{GROUP_LABELS[booster.group].toUpperCase()}</span><span>/</span><span style={{ color: 'var(--text)' }}>{booster.name.toUpperCase()}</span>
        </div>

        <header className={styles.hero}>
          <div className={styles.heroArt}>
            <BoosterPack booster={booster} cover={boosterCover(db, booster)} width={260} float interactive />
          </div>
          <div className={styles.heroText}>
            <span className="eyebrow">Bobine {booster.code} · {GROUP_LABELS[booster.group]} · {booster.slots.length} cartes</span>
            <h1 className="display h1">{booster.name}</h1>
            <p className="lead">{booster.description}</p>
            <div className={styles.meter}>
              <div className={styles.meterHead}><span><b>{formatNumber(have)}</b> / {formatNumber(pool.length)} cartes obtenues</span><b>{pool.length ? Math.floor((have / pool.length) * 100) : 0} %</b></div>
              <div className={styles.meterBar} aria-hidden="true">
                {tiers.map((r) => <span key={r} style={{ flex: Math.max(counts[r], pool.length / 120), background: RARITIES[r].color }} />)}
              </div>
              <span className={styles.meterNote}>Répartition des cartes possibles, de la moins probable à la plus probable.</span>
            </div>
            <div className={styles.ctas}>
              <Link href={`/ouvrir/${booster.id}`} className="btn btn-primary btn-lg">{free ? 'Ouvrir · offerte' : `Ouvrir · ${formatNumber(booster.price)} TK`}</Link>
              <Link href={missingOnly ? `/bobines/${id}` : `/bobines/${id}?voir=manquantes`} className="btn btn-lg">{missingOnly ? 'Tout afficher' : 'Voir les manquantes'}</Link>
            </div>
          </div>
        </header>

        <nav className={styles.jump} aria-label="Aller à une rareté">
          <span className="eyebrow">Aller à</span>
          {tiers.map((r) => (
            <a key={r} href={focus ? `/bobines/${id}#${r}` : `#${r}`} className="chip">
              <span className="dot" style={{ background: RARITIES[r].color, borderRadius: RARITIES[r].kind === 'role' ? 2 : '50%' }} />{RARITIES[r].label}<small>{formatNumber(counts[r])}</small>
            </a>
          ))}
        </nav>

        {focus ? (
          <section className={styles.tier}>
            <TierHead rarity={focus} rank={tiers.indexOf(focus) + 1} odds={odds[focus]} count={counts[focus]} have={pool.filter((c) => c.rarity === focus && owned.has(c.id)).length} />
            <form className={styles.search} action={`/bobines/${id}`}>
              <input type="hidden" name="rarete" value={focus} />
              {missingOnly && <input type="hidden" name="voir" value="manquantes" />}
              <input className="input" type="search" name="q" defaultValue={sp.q} placeholder="Chercher un acteur, un film…" aria-label="Chercher dans cette rareté" />
              <button className="btn btn-sm" type="submit">Chercher</button>
              <Link href={`/bobines/${id}`} className="btn btn-sm">← Toutes les raretés</Link>
            </form>
            <ul className="card-grid">
              {focusCards.slice(0, page * PAGE).map((c) => (
                <li key={c.id} className={owned.has(c.id) ? '' : 'missing'}>
                  <CardLink card={c}><GameCard card={c} width={176} /></CardLink>
                  <span className={styles.state} style={{ color: owned.has(c.id) ? 'var(--ok)' : 'var(--faint)' }}>{owned.has(c.id) ? 'OBTENUE' : 'NON OBTENUE'}</span>
                </li>
              ))}
            </ul>
            {focusCards.length > page * PAGE && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Link className="btn" scroll={false} href={`/bobines/${id}?rarete=${focus}${missingOnly ? '&voir=manquantes' : ''}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}&page=${page + 1}`}>
                  Afficher plus · {formatNumber(focusCards.length - page * PAGE)} restantes
                </Link>
              </div>
            )}
          </section>
        ) : (
          tiers.map((r, i) => {
            const cards = sortTier(r);
            const mine = pool.filter((c) => c.rarity === r && owned.has(c.id)).length;
            return (
              <section key={r} id={r} className={styles.tier}>
                <TierHead rarity={r} rank={i + 1} odds={odds[r]} count={counts[r]} have={mine} />
                <div className={styles.row}>
                  {cards.slice(0, PREVIEW).map((c) => (
                    <div key={c.id} className={`${styles.item} ${owned.has(c.id) ? '' : 'missing'}`}>
                      <CardLink card={c}><GameCard card={c} width={160} /></CardLink>
                      <span className={styles.state} style={{ color: owned.has(c.id) ? 'var(--ok)' : 'var(--faint)' }}>{owned.has(c.id) ? 'OBTENUE' : 'NON OBTENUE'}</span>
                    </div>
                  ))}
                  {cards.length > PREVIEW && (
                    <Link href={`/bobines/${id}?rarete=${r}${missingOnly ? '&voir=manquantes' : ''}`} className={styles.more}>
                      <strong className="display">+{formatNumber(cards.length - PREVIEW)}</strong>
                      <span className="eyebrow">Voir tout</span>
                    </Link>
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>
      <Footer />
    </>
  );
}

function TierHead({ rarity, rank, odds, count, have }: { rarity: Rarity; rank: number; odds?: number; count: number; have: number }) {
  const r = RARITIES[rarity];
  return (
    <div className={styles.tierHead} style={{ borderColor: r.color }}>
      <span className="mono muted">{String(rank).padStart(2, '0')}</span>
      <h2 className="display" style={{ color: r.color }}>{r.label}</h2>
      <span className={styles.kind}>CARTE {r.kind === 'actor' ? 'ACTEUR' : 'RÔLE'}</span>
      <span className={styles.spacer} />
      <div className={styles.facts}>
        <span>CHANCE <b>{odds ? `${String(odds).replace('.', ',')} %` : '—'}</b></span>
        <span>VALEUR <b>{formatNumber(r.entries)} ENTRÉES</b></span>
        <span>OBTENUES <b>{formatNumber(have)} / {formatNumber(count)}</b></span>
      </div>
    </div>
  );
}
