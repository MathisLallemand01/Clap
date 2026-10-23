import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { recycleAction } from '@/app/actions';
import { CardLink } from '@/components/CardLink';
import { ActionButton } from '@/components/Forms';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { Trailer } from '@/components/Trailer';
import { bestSerial, getCard, getMovie, getMovieRoles, getPersonCards, ownedCounts } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { recycleValue } from '@/lib/economy';
import { formatNumber } from '@/lib/format';
import { roleIdFromSlug } from '@/lib/links';
import { countryName, formatRuntime } from '@/lib/people';
import { RARITIES } from '@/lib/rarity';
import { currentWallet } from '@/lib/session';
import styles from '../../fiche.module.css';

type Props = { params: Promise<{ id: string }> };

function load(slug: string) {
  const db = getDb();
  const card = getCard(db, roleIdFromSlug(slug));
  if (!card || card.kind !== 'role') return null;
  return { db, card, movie: card.movieId ? getMovie(db, card.movieId) : null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = load((await params).id);
  return { title: data ? `${data.card.character} · ${data.card.film}` : 'Rôle introuvable' };
}

export default async function RolePage({ params }: Props) {
  const data = load((await params).id);
  if (!data) notFound();
  const { db, card, movie } = data;
  const { player, wallet } = await currentWallet();
  const actorCard = getPersonCards(db, card.personId).actor;
  const castCards = card.movieId ? getMovieRoles(db, card.movieId).filter((c) => c.id !== card.id) : [];
  const counts = ownedCounts(db, player?.id ?? null, [card.id, ...castCards.map((c) => c.id), ...(actorCard ? [actorCard.id] : [])]);
  const mine = counts.get(card.id) ?? 0;
  const serial = bestSerial(db, player?.id ?? null, card.id);
  const rarity = RARITIES[card.rarity];
  const name = `${card.first} ${card.last}`.trim();
  const runtime = formatRuntime(movie?.runtime);

  return (
    <>
      <Nav wallet={wallet} />
      <main className="container">
        <div className={styles.hero}>
          <div className={styles.cardCol}>
            <GameCard card={card} width={280} serial={serial} />
            <span className={styles.owned}>
              {mine > 0 ? <>DANS VOTRE COLLECTION · <strong>×{mine}</strong></> : 'PAS ENCORE DANS VOTRE COLLECTION'}
            </span>
            {mine > 1 && (
              <ActionButton
                action={recycleAction}
                hidden={{ cardId: card.id }}
                label={`Recycler ${mine - 1} doublon${mine > 2 ? 's' : ''} · +${formatNumber((mine - 1) * recycleValue(card.rarity))} tickets`}
              />
            )}
          </div>

          <div className={styles.info}>
            <nav className={styles.crumbs} aria-label="Fil d’Ariane">
              <Link href="/catalogue">CATALOGUE</Link><span>/</span>
              <Link href={`/acteur/${card.personId}`}>{name.toUpperCase()}</Link><span>/</span><span>RÔLE</span>
            </nav>
            <h1 className="display">{card.character}</h1>
            <p className="lead" style={{ maxWidth: 'none' }}>
              <Link href={`/acteur/${card.personId}`} style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 4 }}>{name}</Link>
              {' '}dans <em style={{ color: 'var(--text)', fontStyle: 'normal', fontWeight: 700 }}>{card.film}</em> ({card.year})
            </p>
            <span className={styles.badge} style={{ '--rc': rarity.color } as CSSProperties}>
              {rarity.label.toUpperCase()} · {formatNumber(rarity.entries)} ENTRÉES
            </span>

            {movie?.trailer ? (
              <Trailer videoKey={movie.trailer} title={movie.title} />
            ) : (
              <p className={styles.muted}>Pas de bande-annonce disponible pour ce film.</p>
            )}

            <div className={styles.film}>
              {movie?.poster && <img src={movie.poster} alt={`Affiche de ${movie.title}`} loading="lazy" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <dl className={styles.facts}>
                  {movie?.director && <div><dt>Réalisation</dt><dd>{movie.director}</dd></div>}
                  {runtime && <div><dt>Durée</dt><dd>{runtime}</dd></div>}
                  {movie && movie.genres.length > 0 && <div><dt>Genres</dt><dd>{movie.genres.join(', ')}</dd></div>}
                  {movie && movie.countries.length > 0 && (
                    <div><dt>Pays</dt><dd>{movie.countries.slice(0, 3).map((c) => countryName(c)).join(', ')}</dd></div>
                  )}
                  {movie?.voteAverage != null && movie.voteCount != null && (
                    <div><dt>Note TMDB</dt><dd>{movie.voteAverage.toFixed(1).replace('.', ',')} / 10 · {formatNumber(movie.voteCount)} votes</dd></div>
                  )}
                  {movie?.originalTitle && movie.originalTitle !== movie.title && (
                    <div><dt>Titre original</dt><dd>{movie.originalTitle}</dd></div>
                  )}
                </dl>
                {movie?.overview ? <p className={styles.bio}>{movie.overview}</p> : <p className={styles.muted}>Pas de synopsis pour ce film.</p>}
              </div>
            </div>
          </div>
        </div>

        {actorCard && (
          <section className={styles.section} aria-labelledby="actor">
            <div className="section-head">
              <h2 id="actor" className="display">L’acteur</h2>
              <span className="rule" />
            </div>
            <ul className={styles.grid}>
              <li><CardLink card={actorCard} copies={player ? counts.get(actorCard.id) ?? 0 : 0} /></li>
            </ul>
          </section>
        )}

        {castCards.length > 0 && (
          <section className={styles.section} aria-labelledby="cast">
            <div className="section-head">
              <h2 id="cast" className="display">Dans le même film</h2>
              <span className="rule" />
            </div>
            <ul className={styles.grid}>
              {castCards.map((c) => (
                <li key={c.id}><CardLink card={c} copies={player ? counts.get(c.id) ?? 0 : 0} /></li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
