import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { cardsOfPerson, ownedCardIds } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { ownedCopies } from '@/lib/game';
import { RARITIES } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { personInfo } from '@/lib/tmdb';
import styles from '../../fiche.module.css';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cards = cardsOfPerson(getDb(), Number((await params).id));
  return { title: cards[0] ? `${cards[0].first} ${cards[0].last}` : 'Acteur' };
}

function dateFr(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default async function ActorPage({ params }: Props) {
  const personId = Number((await params).id);
  const db = getDb();
  const cards = cardsOfPerson(db, personId);
  const actor = cards.find((c) => c.kind === 'actor');
  if (!actor) notFound();
  const ctx = await requireContext(`/acteur/${personId}`);
  const roles = cards.filter((c) => c.kind === 'role');
  const owned = ownedCardIds(db, ctx.player.id);
  const copies = ownedCopies(db, ctx.player.id, actor.id);
  const info = await personInfo(personId);
  const rarity = RARITIES[actor.rarity];
  const bio = info?.biography?.split('\n').filter(Boolean).slice(0, 3) ?? [];
  const born = dateFr(info?.birthday ?? null);
  const died = dateFr(info?.deathday ?? null);

  return (
    <>
      <Nav ctx={ctx} current="/collection" />
      <SideRails left="CLAP · FICHE ACTEUR · ARCHIVES" right="FILMOGRAPHIE · TMDB" />
      <main className="container page">
        <div className={styles.crumbs}>
          <Link href="/collection">COLLECTION</Link><span>/</span><span>ACTEURS</span><span>/</span><span style={{ color: rarity.color }}>{actor.first.toUpperCase()} {actor.last.toUpperCase()}</span>
        </div>

        <section className={styles.hero}>
          <div className={`${styles.heroCard} ${owned.has(actor.id) ? '' : 'missing'}`}>
            <GameCard card={actor} width={380} serial={copies[0]?.serial} eager />
          </div>
          <div className={styles.heroText}>
            <span className={styles.rarityPill} style={{ color: rarity.color, borderColor: rarity.color }}>
              <span style={{ background: rarity.color }} />{rarity.label}{actor.rank ? ` · n° ${formatNumber(actor.rank)} au classement` : ''}
            </span>
            <h1 className="display">{actor.first}<br />{actor.last}</h1>
            <div className={styles.facts}>
              {born && <span>{died ? `${born} – ${died}` : `Né·e le ${born}`}</span>}
              {info?.placeOfBirth && <span>{info.placeOfBirth}</span>}
              <span>{formatNumber(roles.length)} rôle{roles.length > 1 ? 's' : ''} à collectionner</span>
            </div>
            {bio.length > 0 ? (
              <div className={styles.bio}>{bio.map((p, i) => <p key={i}>{p}</p>)}<span className="eyebrow">Biographie · TMDB</span></div>
            ) : (
              <p className="lead">Pas encore de biographie pour {actor.first} {actor.last}.</p>
            )}
            <div className="stat-row">
              <div><span className="eyebrow">Exemplaires</span><strong>×{copies.length}</strong><small>{copies.length ? `Meilleur n° ${String(copies[0].serial).padStart(4, '0')}` : 'Pas encore obtenue'}</small></div>
              <div><span className="eyebrow">Valeur</span><strong>{formatEntries(rarity.entries)}</strong><small>entrées · {formatNumber(rarity.entries / 100)} TK conseillés</small></div>
              <div><span className="eyebrow">Rôles</span><strong>{formatNumber(roles.filter((r) => owned.has(r.id)).length)} / {formatNumber(roles.length)}</strong><small>obtenus</small></div>
            </div>
          </div>
        </section>

        {roles.length > 0 && (
          <section className={styles.section}>
            <div className="section-head">
              <h2 className="display h2">Ses rôles</h2>
              <span className="rule" />
              <span className="eyebrow">Cliquez pour voir la bande-annonce</span>
            </div>
            <ul className="card-grid">
              {roles.map((r) => (
                <li key={r.id} className={owned.has(r.id) ? '' : 'missing'}>
                  <CardLink card={r}><GameCard card={r} width={188} /></CardLink>
                  <span className="mono" style={{ fontSize: 11, color: owned.has(r.id) ? 'var(--ok)' : 'var(--faint)' }}>{owned.has(r.id) ? 'OBTENUE' : 'NON OBTENUE'}</span>
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
