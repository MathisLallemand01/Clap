import type { Metadata } from 'next';
import Link from 'next/link';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { TabContent } from '@/components/TabContent';
import { BOOSTERS, getBooster } from '@/lib/boosters';
import { boostersOfCard, getCatalog, ownedCardIds, poolOf, searchCards, sortedCatalog, type CatalogSort } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { FAMILY, ladderOf, RARITIES, type CardKind, type Rarity } from '@/lib/rarity';
import { optionalContext } from '@/lib/session';
import type { Card } from '@/lib/types';
import { LiveFilters } from '@/components/LiveFilters';
import styles from './catalogue.module.css';

export const metadata: Metadata = {
  title: 'Catalogue',
  description: 'Toutes les cartes du jeu, Acteurs et Rôles, films et séries, avec leurs raretés et les bobines où les trouver.',
};

type Search = {
  famille?: string; media?: string; rarete?: string; bobine?: string; genre?: string; epoque?: string; pays?: string;
  possession?: string; q?: string; tri?: string; page?: string;
};

const PAGE = 96;
const GENRES: [string, string][] = [
  ['genre:action', 'Action'], ['genre:comedy', 'Comédie'], ['genre:drama', 'Drame'], ['genre:scifi', 'Science-fiction'],
  ['genre:horror', 'Horreur'], ['genre:western', 'Western'],
  ['tvgenre:crime', 'Série · Crime'], ['tvgenre:mystery', 'Série · Mystère'], ['tvgenre:scifi', 'Série · SF & fantastique'],
  ['tvgenre:comedy', 'Série · Comédie'], ['tvgenre:drama', 'Série · Drame'], ['tvgenre:action', 'Série · Action'],
];
const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920];
const COUNTRIES: [string, string][] = [
  ['US', 'États-Unis'], ['FR', 'France'], ['GB', 'Royaume-Uni'], ['KR', 'Corée du Sud'], ['JP', 'Japon'], ['IN', 'Inde'],
  ['IT', 'Italie'], ['ES', 'Espagne'], ['DE', 'Allemagne'], ['CA', 'Canada'], ['AU', 'Australie'], ['CN', 'Chine'], ['HK', 'Hong Kong'], ['MX', 'Mexique'],
];
const SORTS: [string, string][] = [['rarete', 'Rareté (la plus rare d’abord)'], ['populaire', 'Popularité'], ['recent', 'Année (récent d’abord)'], ['ancien', 'Année (ancien d’abord)'], ['nom', 'Nom (A → Z)']];

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ctx = await optionalContext();
  const db = getDb();
  const catalog = getCatalog(db);
  const owned = ctx ? ownedCardIds(db, ctx.player.id) : new Set<string>();

  const famille: CardKind | null = sp.famille === 'actor' || sp.famille === 'role' ? sp.famille : null;
  const media = sp.media === 'films' || sp.media === 'series' ? sp.media : null;
  const rarete = sp.rarete && sp.rarete in RARITIES ? (sp.rarete as Rarity) : null;
  const booster = sp.bobine ? getBooster(sp.bobine) ?? null : null;
  const decade = DECADES.includes(Number(sp.epoque)) ? Number(sp.epoque) : null;
  const tri = SORTS.some(([v]) => v === sp.tri) ? sp.tri! : 'rarete';

  // Filtres, du plus large au plus précis. Le genre, l'époque et le pays ne concernent que les Rôles,
  // sauf pour un Acteur : il correspond s'il a au moins un Rôle qui correspond.
  const roleMatch = (pred: (c: Card) => boolean) => {
    const people = new Set(catalog.filter((c) => c.kind === 'role' && pred(c)).map((c) => c.personId));
    return (c: Card) => (c.kind === 'role' ? pred(c) : people.has(c.personId));
  };
  // On part du catalogue déjà trié (en cache) : chaque filtre garde l'ordre.
  let cards: Card[] = sortedCatalog(db, tri as CatalogSort);
  if (booster) {
    const pool = new Set(poolOf(db, booster).map((c) => c.id));
    cards = cards.filter((c) => pool.has(c.id));
  }
  if (famille) cards = cards.filter((c) => c.kind === famille);
  if (media) cards = cards.filter((c) => c.kind === 'role' && c.tags.includes('media:tv') === (media === 'series'));
  if (rarete) cards = cards.filter((c) => c.rarity === rarete);
  if (sp.genre) cards = cards.filter(roleMatch((c) => c.tags.includes(sp.genre!)));
  if (decade) cards = cards.filter(roleMatch((c) => c.tags.includes(`decade:${decade}`)));
  if (sp.pays) cards = cards.filter((c) => (c.kind === 'actor' ? c.origin === sp.pays : c.tags.includes(`country:${sp.pays}`)));
  if (ctx && sp.possession === 'possedees') cards = cards.filter((c) => owned.has(c.id));
  if (ctx && sp.possession === 'manquantes') cards = cards.filter((c) => !owned.has(c.id));
  cards = searchCards(cards, sp.q ?? '');
  const sorted = cards;
  const page = Math.max(1, Number(sp.page) || 1);
  const shown = sorted.slice(0, page * PAGE);
  const have = ctx ? cards.filter((c) => owned.has(c.id)).length : 0;

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/catalogue?${s}` : '/catalogue';
  };
  const label = (v: string | undefined, list: [string, string][]) => list.find(([k]) => k === v)?.[1];
  const active: [string, keyof Search][] = [
    ...(famille ? [[`Cartes ${FAMILY[famille].label}`, 'famille']] as [string, keyof Search][] : []),
    ...(media ? [[media === 'series' ? 'Séries' : 'Films', 'media']] as [string, keyof Search][] : []),
    ...(rarete ? [[`${FAMILY[RARITIES[rarete].kind].label} · ${RARITIES[rarete].label}`, 'rarete']] as [string, keyof Search][] : []),
    ...(booster ? [[`Bobine ${booster.name}`, 'bobine']] as [string, keyof Search][] : []),
    ...(sp.genre ? [[label(sp.genre, GENRES) ?? sp.genre, 'genre']] as [string, keyof Search][] : []),
    ...(decade ? [[`Années ${decade}`, 'epoque']] as [string, keyof Search][] : []),
    ...(sp.pays ? [[label(sp.pays, COUNTRIES) ?? sp.pays, 'pays']] as [string, keyof Search][] : []),
    ...(ctx && sp.possession ? [[sp.possession === 'possedees' ? 'Possédées' : 'Manquantes', 'possession']] as [string, keyof Search][] : []),
    ...(sp.q ? [[`« ${sp.q} »`, 'q']] as [string, keyof Search][] : []),
  ];

  return (
    <>
      <Nav ctx={ctx} current="/catalogue" />
      <SideRails left="CLAP · CATALOGUE · TOUTES LES CARTES" right="FILMS · SÉRIES · ACTEURS" />
      <main className="container page">
        <p className="slug">INT. LES ARCHIVES DU CINÉMA — JOUR <span>PLAN 08 / CATALOGUE</span></p>
        <header className="page-head">
          <div className={styles.titleBlock}>
            <h1 className="display h1">Catalogue</h1>
            <p className="lead">Toutes les cartes du jeu. Filtrez par famille, rareté, bobine, genre, époque ou pays ; chaque carte indique où la trouver.</p>
          </div>
          <div className="meta">
            <span><b>{formatNumber(catalog.length)}</b> CARTES AU TOTAL</span>
            {ctx && <span>VOUS EN AVEZ <b>{formatNumber(owned.size)}</b></span>}
          </div>
        </header>

        <div className={styles.layout}>
          <form className={styles.filters} action="/catalogue" aria-label="Filtres">
            <LiveFilters />
            <label className={styles.searchBox}>
              <span className="visually-hidden">Rechercher</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" name="q" defaultValue={sp.q} placeholder="Acteur, film, série, personnage…" />
            </label>

            <fieldset className={styles.group}>
              <legend>Famille</legend>
              <div className={styles.radios}>
                {([['', 'Toutes'], ['actor', '● Acteurs'], ['role', '◆ Rôles']] as const).map(([v, l]) => (
                  <label key={v} className={styles.radio}><input type="radio" name="famille" value={v} defaultChecked={(sp.famille ?? '') === v} /><span>{l}</span></label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Rôles de…</legend>
              <div className={styles.radios}>
                {([['', 'Tout'], ['films', 'Films'], ['series', 'Séries']] as const).map(([v, l]) => (
                  <label key={v} className={styles.radio}><input type="radio" name="media" value={v} defaultChecked={(sp.media ?? '') === v} /><span>{l}</span></label>
                ))}
              </div>
            </fieldset>

            <div className={styles.selects}>
            <label className={styles.field}>Rareté
              <select name="rarete" defaultValue={rarete ?? ''} className="input">
                <option value="">Toutes</option>
                {(['actor', 'role'] as const).map((k) => (
                  <optgroup key={k} label={`${FAMILY[k].mark} Cartes ${FAMILY[k].label}`}>
                    {[...ladderOf(k)].reverse().map((r) => <option key={r} value={r}>{FAMILY[k].label} · {RARITIES[r].label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className={styles.field}>Bobine
              <select name="bobine" defaultValue={booster?.id ?? ''} className="input">
                <option value="">Toutes</option>
                {(['actor', 'role'] as const).map((k) => (
                  <optgroup key={k} label={k === 'actor' ? 'Castings (cartes Acteur)' : 'Films & séries (cartes Rôle)'}>
                    {BOOSTERS.filter((b) => b.family === k).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className={styles.field}>Genre
              <select name="genre" defaultValue={sp.genre ?? ''} className="input">
                <option value="">Tous</option>
                {GENRES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>

            <label className={styles.field}>Époque
              <select name="epoque" defaultValue={decade ?? ''} className="input">
                <option value="">Toutes</option>
                {DECADES.map((d) => <option key={d} value={d}>Années {d}</option>)}
              </select>
            </label>

            <label className={styles.field}>Pays
              <select name="pays" defaultValue={sp.pays ?? ''} className="input">
                <option value="">Tous</option>
                {COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className={styles.field}>Tri
              <select name="tri" defaultValue={tri} className="input">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            </div>

            {ctx && (
              <fieldset className={styles.group}>
                <legend>Ma collection</legend>
                <div className={styles.radios}>
                  {([['', 'Toutes'], ['possedees', 'Possédées'], ['manquantes', 'Manquantes']] as const).map(([v, l]) => (
                    <label key={v} className={styles.radio}><input type="radio" name="possession" value={v} defaultChecked={(sp.possession ?? '') === v} /><span>{l}</span></label>
                  ))}
                </div>
              </fieldset>
            )}



            <div className={styles.formActions}>
              <button type="submit" className="btn btn-sm btn-primary">Appliquer</button>
              <Link href="/catalogue" className="btn btn-sm" scroll={false}>Réinitialiser les filtres</Link>
            </div>
          </form>

          <TabContent tab={active.map(([, k]) => `${k}=${sp[k]}`).join('&') + tri}>
          <section className={styles.results} aria-labelledby="resultats">
            <div className={styles.resultsHead}>
              <h2 id="resultats" className={styles.count}>
                <b>{formatNumber(cards.length)}</b> carte{cards.length > 1 ? 's' : ''}
                {ctx && cards.length > 0 && <span> · vous en avez {formatNumber(have)} ({have && have < cards.length ? `${((have / cards.length) * 100 < 10 ? Math.floor((have / cards.length) * 1000) / 10 : Math.floor((have / cards.length) * 100)).toLocaleString('fr-FR')} %` : have ? '100 %' : '0 %'})</span>}
              </h2>
              {active.length > 0 && (
                <div className={styles.active} aria-label="Filtres actifs">
                  {active.map(([l, k]) => (
                    <Link key={k} href={href({ [k]: undefined })} className={styles.activeChip} aria-label={`Retirer le filtre ${l}`}>{l} <span aria-hidden="true">×</span></Link>
                  ))}
                </div>
              )}
            </div>

            {cards.length === 0 ? (
              <p className="alert alert-info">Aucune carte ne correspond à ces filtres. <Link href="/catalogue" className="accent">Tout afficher</Link></p>
            ) : (
              <>
                <ul className="card-grid">
                  {shown.map((c) => {
                    const where = boostersOfCard(db, c.id);
                    const best = where.length ? getBooster(where[0]) : undefined;
                    return (
                      <li key={c.id} className={ctx && !owned.has(c.id) ? styles.notOwned : undefined}>
                        <CardLink card={c}><GameCard card={c} width={176} /></CardLink>
                        <span className={styles.where}>
                          {ctx && <b className={owned.has(c.id) ? styles.ok : styles.no}>{owned.has(c.id) ? 'OBTENUE' : 'MANQUANTE'}</b>}
                          {best && <Link href={`/bobines/${best.id}`} title={`À tirer dans : ${where.map((id) => getBooster(id)?.name).join(', ')}`}>{best.name}{where.length > 1 ? ` +${where.length - 1}` : ''}</Link>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {sorted.length > shown.length && (
                  <div className={styles.more}>
                    <Link href={`${href({})}${href({}).includes('?') ? '&' : '?'}page=${page + 1}`} className="btn" scroll={false}>
                      Afficher plus · {formatNumber(sorted.length - shown.length)} restantes
                    </Link>
                  </div>
                )}
              </>
            )}
          </section>
          </TabContent>
        </div>
      </main>
      <Footer />
    </>
  );
}
