import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { cardsOfMovie, cardsOfPerson, getCard, ownedCardIds } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { ownedCopies } from '@/lib/game';
import { RARITIES } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { movieInfo } from '@/lib/tmdb';
import styles from '../../fiche.module.css';
import { Trailer } from './Trailer';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = getCard(getDb(), decodeURIComponent((await params).id));
  return { title: card ? `${card.character} · ${card.film}` : 'Rôle' };
}

function runtime(min: number | null): string | null {
  if (!min) return null;
  return `${Math.floor(min / 60)} H ${String(min % 60).padStart(2, '0')}`;
}

export default async function RolePage({ params }: Props) {
  const id = decodeURIComponent((await params).id);
  const db = getDb();
  const card = getCard(db, id);
  if (!card || card.kind !== 'role') notFound();
  const ctx = await requireContext(`/role/${encodeURIComponent(id)}`);
  const owned = ownedCardIds(db, ctx.player.id);
  const copies = ownedCopies(db, ctx.player.id, card.id);
  const info = card.movieId ? await movieInfo(card.movieId) : null;
  const rarity = RARITIES[card.rarity];
  const cast = card.movieId ? cardsOfMovie(db, card.movieId) : [card];
  const otherRoles = cardsOfPerson(db, card.personId).filter((c) => c.kind === 'role' && c.id !== card.id).slice(0, 12);
  const actorCard = cardsOfPerson(db, card.personId).find((c) => c.kind === 'actor');

  return (
    <>
      <Nav ctx={ctx} current="/collection" />
      <SideRails left="CLAP · FICHE RÔLE · PHOTOGRAMME" right="BANDE-ANNONCE · VERSION ORIGINALE" />
      <main className="container page">
        <div className={styles.crumbs}>
          <Link href="/collection?type=role">COLLECTION</Link><span>/</span><span>RÔLES</span><span>/</span><span style={{ color: rarity.color }}>{(card.character ?? '').toUpperCase()}</span>
        </div>

        <section className={styles.hero}>
          <div className={`${styles.heroCard} ${owned.has(card.id) ? '' : 'missing'}`}>
            <GameCard card={card} width={360} serial={copies[0]?.serial} eager />
          </div>
          <div className={styles.heroText}>
            <span className={styles.rarityPill} style={{ color: rarity.color, borderColor: rarity.color }}>
              <span style={{ background: rarity.color, borderRadius: 2, transform: 'rotate(45deg)' }} />Rôle · {rarity.label}
            </span>
            <h1 className="display">{card.film}</h1>
            <p className={styles.lead2}>
              <Link href={`/acteur/${card.personId}`}><b>{card.first} {card.last}</b></Link> dans le rôle de <b style={{ color: rarity.color }}>{card.character}</b>
            </p>
            <div className={styles.facts}>
              <span>{card.year}</span>
              {info?.directors.length ? <span>Réal. {info.directors.join(', ')}</span> : null}
              {runtime(info?.runtime ?? null) && <span>{runtime(info!.runtime)}</span>}
              {info?.genres.length ? <span>{info.genres.slice(0, 3).join(' · ')}</span> : null}
            </div>
            {info?.overview && <p className="lead">{info.overview}</p>}
            <div className="stat-row">
              <div><span className="eyebrow">Valeur</span><strong>{formatEntries(rarity.entries)}</strong><small>entrées · {formatNumber(rarity.entries / 100)} TK conseillés</small></div>
              <div><span className="eyebrow">Exemplaires</span><strong>×{copies.length}</strong><small>{copies.length ? `Meilleur n° ${String(copies[0].serial).padStart(4, '0')}` : 'Pas encore obtenue'}</small></div>
              <div><span className="eyebrow">Votes TMDB</span><strong>{formatNumber(card.votes ?? 0)}</strong><small>notoriété du film</small></div>
            </div>
            {info?.videos.length ? <a href="#bande-annonce" className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }}>▶ Voir la bande-annonce</a> : null}
          </div>
        </section>

        <section id="bande-annonce" className={styles.section} style={{ scrollMarginTop: 96 }}>
          <Trailer videos={info?.videos ?? []} title={card.film ?? ''} backdrop={info?.backdrop ?? null} />
        </section>

        {cast.length > 1 && (
          <section className={styles.section}>
            <div className="section-head">
              <h2 className="display h2">Le casting du film</h2>
              <span className="rule" />
              <span className="eyebrow"><b style={{ color: 'var(--text)' }}>{cast.filter((c) => owned.has(c.id)).length}</b> / {cast.length} rôles obtenus</span>
            </div>
            <ul className="card-grid">
              {cast.map((c) => (
                <li key={c.id} className={owned.has(c.id) ? '' : 'missing'}>
                  <CardLink card={c}><GameCard card={c} width={188} /></CardLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(otherRoles.length > 0 || actorCard) && (
          <section className={styles.section}>
            <div className="section-head">
              <h2 className="display h2">Autres rôles de {card.first} {card.last}</h2>
              <span className="rule" />
            </div>
            <ul className="card-grid">
              {actorCard && <li className={owned.has(actorCard.id) ? '' : 'missing'}><CardLink card={actorCard}><GameCard card={actorCard} width={188} /></CardLink></li>}
              {otherRoles.map((c) => (
                <li key={c.id} className={owned.has(c.id) ? '' : 'missing'}>
                  <CardLink card={c}><GameCard card={c} width={188} /></CardLink>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
