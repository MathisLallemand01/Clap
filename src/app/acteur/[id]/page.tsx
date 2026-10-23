import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { recycleAction } from '@/app/actions';
import { CardLink } from '@/components/CardLink';
import { ActionButton } from '@/components/Forms';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { bestSerial, getPerson, getPersonCards, ownedCounts } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { recycleValue } from '@/lib/economy';
import { formatNumber } from '@/lib/format';
import { age, countryName, formatDay } from '@/lib/people';
import { RARITIES } from '@/lib/rarity';
import { currentWallet } from '@/lib/session';
import styles from '../../fiche.module.css';

type Props = { params: Promise<{ id: string }> };

function load(id: string) {
  const personId = Number(id);
  if (!Number.isInteger(personId)) return null;
  const db = getDb();
  const { actor, roles } = getPersonCards(db, personId);
  if (!actor) return null;
  return { db, actor, roles, person: getPerson(db, personId) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = load((await params).id);
  return { title: data ? `${data.actor.first} ${data.actor.last}`.trim() : 'Acteur introuvable' };
}

const BIO_PREVIEW = 600;

export default async function ActorPage({ params }: Props) {
  const data = load((await params).id);
  if (!data) notFound();
  const { db, actor, roles, person } = data;
  const { player, wallet } = await currentWallet();
  const counts = ownedCounts(db, player?.id ?? null, [actor.id, ...roles.map((r) => r.id)]);
  const mine = counts.get(actor.id) ?? 0;
  const serial = bestSerial(db, player?.id ?? null, actor.id);
  const rarity = RARITIES[actor.rarity];
  const name = `${actor.first} ${actor.last}`.trim();
  const ownedRoles = roles.filter((r) => (counts.get(r.id) ?? 0) > 0).length;
  const bio = person?.biography ?? null;
  // L'extrait s'arrête à la fin d'une phrase (ou d'un mot) avant BIO_PREVIEW caractères.
  const cut = bio ? bio.slice(0, BIO_PREVIEW) : '';
  const preview = Math.max(cut.lastIndexOf('. ') + 1, 0) || cut.lastIndexOf(' ') || BIO_PREVIEW;
  const years = age(person?.birthday, person?.deathday);
  const born = formatDay(person?.birthday);
  const died = formatDay(person?.deathday);

  return (
    <>
      <Nav wallet={wallet} />
      <main className="container">
        <div className={styles.hero}>
          <div className={styles.cardCol}>
            <GameCard card={actor} width={280} serial={serial} />
            <span className={styles.owned}>
              {mine > 0 ? <>DANS VOTRE COLLECTION · <strong>×{mine}</strong></> : 'PAS ENCORE DANS VOTRE COLLECTION'}
            </span>
            {mine > 1 && (
              <ActionButton
                action={recycleAction}
                hidden={{ cardId: actor.id }}
                label={`Recycler ${mine - 1} doublon${mine > 2 ? 's' : ''} · +${formatNumber((mine - 1) * recycleValue(actor.rarity))} tickets`}
              />
            )}
          </div>

          <div className={styles.info}>
            <nav className={styles.crumbs} aria-label="Fil d’Ariane">
              <Link href="/catalogue">CATALOGUE</Link><span>/</span><span>ACTEUR</span>
            </nav>
            <h1 className="display">{name}</h1>
            <span className={styles.badge} style={{ '--rc': rarity.color } as CSSProperties}>
              {rarity.label.toUpperCase()} · {formatNumber(rarity.entries)} ENTRÉES
            </span>
            <dl className={styles.facts}>
              {born && (
                <div><dt>Naissance</dt><dd>{born}{!died && years !== null ? ` (${years} ans)` : ''}</dd></div>
              )}
              {died && <div><dt>Décès</dt><dd>{died}{years !== null ? ` (${years} ans)` : ''}</dd></div>}
              {person?.placeOfBirth && <div><dt>Lieu de naissance</dt><dd>{person.placeOfBirth}</dd></div>}
              {actor.origin && <div><dt>Cinéma</dt><dd>{countryName(actor.origin)}</dd></div>}
              <div><dt>Rôles dans Clap</dt><dd>{ownedRoles} / {roles.length} obtenus</dd></div>
            </dl>
            {bio ? (
              bio.length > BIO_PREVIEW ? (
                <div>
                  <p className={styles.bio}>{bio.slice(0, preview)}</p>
                  <details className={styles.bioMore}>
                    <summary>LIRE LA SUITE</summary>
                    <p className={styles.bio}>{bio.slice(preview).trimStart()}</p>
                  </details>
                </div>
              ) : (
                <p className={styles.bio}>{bio}</p>
              )
            ) : (
              <p className={styles.muted}>Pas encore de biographie pour cet acteur.</p>
            )}
            {person && <p className={styles.muted} style={{ fontSize: 12 }}>Biographie : TMDB.</p>}
          </div>
        </div>

        <section className={styles.section} aria-labelledby="roles">
          <div className="section-head">
            <h2 id="roles" className="display">Ses rôles</h2>
            <span className="rule" />
            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{ownedRoles} / {roles.length}</span>
          </div>
          {roles.length === 0 ? (
            <p className={styles.muted}>Aucune carte Rôle pour cet acteur.</p>
          ) : (
            <ul className={styles.grid}>
              {roles.map((r) => (
                <li key={r.id}><CardLink card={r} copies={player ? counts.get(r.id) ?? 0 : 0} /></li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
