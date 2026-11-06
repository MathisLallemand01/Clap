import type { Metadata } from 'next';
import Link from 'next/link';
import { CardLink } from '@/components/CardLink';
import { Scene } from '@/components/Decor';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { RarityLadder } from '@/components/RarityLadder';
import { SideRails } from '@/components/SideRails';
import { BOOSTERS, FAMILY_SHELVES } from '@/lib/boosters';
import { getCatalog, showcase } from '@/lib/catalog';
import { playerSagas, sagaReward } from '@/lib/collections';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { DUO_BONUS } from '@/lib/game';
import { FAMILY, RARITIES } from '@/lib/rarity';
import { optionalContext } from '@/lib/session';
import type { Card } from '@/lib/types';
import styles from './raretes.module.css';

export const metadata: Metadata = {
  title: 'Raretés',
  description: 'Cartes Acteur et cartes Rôle, leurs raretés, l’ordre de révélation, les duos et les sagas : tout comprendre en une page.',
};

export default async function RaritiesPage() {
  const ctx = await optionalContext();
  const db = getDb();
  const catalog = getCatalog(db);
  const actorExample = showcase(db, { count: 1, kind: 'actor', rarities: ['legende'] })[0];
  const roleExample = showcase(db, { count: 1, kind: 'role', rarities: ['mythe', 'icone'] })[0];
  // Un duo d'exemple : une Légende dont le catalogue a aussi un grand Rôle.
  const duoActor = showcase(db, { count: 40, kind: 'actor', rarities: ['legende', 'tete'] })
    .find((a) => catalog.some((c) => c.kind === 'role' && c.personId === a.personId && RARITIES[c.rarity].tier >= 4));
  const duoRole = duoActor && catalog
    .filter((c): c is Card => c.kind === 'role' && c.personId === duoActor.personId)
    .sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier)[0];
  const sagas = playerSagas(db, ctx?.player.id ?? '').sort((a, b) => b.total - a.total).slice(0, 12);
  const castings = BOOSTERS.filter((b) => b.family === 'actor');
  const films = BOOSTERS.filter((b) => b.family === 'role');

  return (
    <>
      <Nav ctx={ctx} />
      <SideRails left="CLAP · MODE D’EMPLOI · RARETÉS" right="ACTEURS · RÔLES · DUOS · SAGAS" />
      <main className="container page">
        <p className="slug">INT. LA CABINE DU PROJECTIONNISTE — JOUR <span>PLAN 00 / NOTICE</span></p>
        <header className={styles.hero}>
          <h1 className="display h1">Acteur ou Rôle ?<br /><span className="accent">Tout comprendre.</span></h1>
          <ul className={styles.facts}>
            <li><b>Deux familles de cartes</b> : la carte <b>Acteur</b> (une personne) et la carte <b>Rôle</b> (un acteur dans un film).</li>
            <li><b>Deux sortes de bobines</b> : les <b>Castings</b> ne donnent que des Acteurs, les <b>Films</b> que des Rôles. Jamais de mélange.</li>
            <li><b>Les cartes se révèlent de la moins rare à la plus rare.</b> La dernière est toujours la meilleure.</li>
            <li><b>Les deux familles se complètent</b> : une carte Acteur + un de ses Rôles = un <b>duo</b> ; tous les rôles d’une saga = une <b>saga complète</b>.</li>
          </ul>
        </header>

        <section className={styles.section} aria-labelledby="familles">
          <Scene n={1} label="Les reconnaître en une seconde" />
          <h2 id="familles" className="display h2">Deux familles</h2>
          <div className={styles.families}>
            {[
              { kind: 'actor' as const, card: actorExample, what: 'Une personne et toute sa carrière : pas de film, pas de personnage.', points: ['Pastille « ● ACTEUR » sur la photo', 'Portrait plein cadre, nom en grand, pays', 'Des ronds : de 1 (Figurant) à 5 (Légende)', 'Couleurs : gris, vert, bleu, violet, or'] },
              { kind: 'role' as const, card: roleExample, what: 'Un acteur dans un film précis, avec son personnage.', points: ['Pastille « ◆ RÔLE » sur la photo', 'Pellicule perforée, titre du film, « Dans le rôle de… »', 'Des losanges : de 1 (Série B) à 6 (Mythe)', 'Couleurs : beige, lime, cyan, ambre, rose, rouge'] },
            ].map((f) => (
              <article key={f.kind} className={`${styles.family} ${f.kind === 'actor' ? styles.familyActor : styles.familyRole}`}>
                {f.card && <CardLink card={f.card}><GameCard card={f.card} width={210} live /></CardLink>}
                <div className={styles.familyText}>
                  <span className={styles.kicker}>{FAMILY[f.kind].mark} CARTE {FAMILY[f.kind].label.toUpperCase()} · BOBINES {FAMILY_SHELVES[f.kind].title.toUpperCase()}</span>
                  <h3 className="display h3">Carte {FAMILY[f.kind].label}</h3>
                  <p>{f.what}</p>
                  <ul>{f.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="echelles">
          <Scene n={2} label="Deux échelles, onze raretés" />
          <h2 id="echelles" className="display h2">Les raretés</h2>
          <p className="lead">Chaque famille a sa propre échelle. Une rareté s’écrit toujours avec sa famille : « Acteur · Légende », « Rôle · Mythe ».</p>
          <div className={styles.ladders}>
            <div id="acteurs" className={styles.anchor}><RarityLadder kind="actor" detailed /></div>
            <div id="roles" className={styles.anchor}><RarityLadder kind="role" detailed /></div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="ordre">
          <Scene n={3} label="À l’ouverture" />
          <h2 id="ordre" className="display h2">L’ordre de révélation</h2>
          <div className={styles.order}>
            {['Série B', 'Succès', 'Culte', 'Vedette', 'Mythe'].map((n, i) => (
              <span key={n} className={styles.orderStep} style={{ ['--rc' as string]: RARITIES[(['serieb', 'succes', 'culte', 'vedette', 'mythe'] as const)[i]].color }}>
                <small>CARTE {i + 1}</small>{n}
              </span>
            ))}
          </div>
          <p className="lead">Les cinq cartes défilent <b>de la moins rare à la plus rare</b>, comme dans un vrai paquet. Vous cliquez pour passer à la suivante ; plus la carte est rare, plus l’animation est grande. Le bandeau en bas de l’écran rappelle la famille de la bobine et son échelle.</p>
        </section>

        <section id="duos" className={styles.section} aria-labelledby="t-duos">
          <Scene n={4} label="Ce qui relie les deux familles" />
          <h2 id="t-duos" className="display h2">Les duos</h2>
          <div className={styles.duo}>
            {duoActor && <CardLink card={duoActor}><GameCard card={duoActor} width={180} /></CardLink>}
            <span className={styles.plus} aria-hidden="true">+</span>
            {duoRole && <CardLink card={duoRole}><GameCard card={duoRole} width={180} /></CardLink>}
            <div className={styles.duoText}>
              <span className={styles.duoTag}>DUO · +{formatNumber(DUO_BONUS)} ENTRÉES</span>
              <p className="lead"><b>La carte Acteur d’une personne + au moins un de ses Rôles = un duo.</b> Chaque duo ajoute {formatNumber(DUO_BONUS)} entrées à votre box-office et s’affiche sur sa fiche.</p>
              <p className="muted">La carte Acteur vient d’une bobine <b>Casting</b>, le Rôle d’une bobine <b>Film</b>. La fiche de chaque acteur indique ce qu’il vous manque.</p>
            </div>
          </div>
        </section>

        <section id="sagas" className={styles.section} aria-labelledby="t-sagas">
          <Scene n={5} label="Star Wars, Harry Potter, 007…" />
          <h2 id="t-sagas" className="display h2">Les sagas</h2>
          <p className="lead"><b>Une saga = les Rôles de tous ses films + les cartes Acteur de leurs interprètes.</b> Complétez-la pour gagner des tickets : 150 par carte, de {formatNumber(sagaReward(1))} à {formatNumber(sagaReward(1000))}. Suivez votre progression dans <Link href="/collection?vue=sagas" className="accent">Collection → Sagas</Link>.</p>
          {sagas.length > 0 && (
            <ul className={styles.sagaList}>
              {sagas.map((s) => <li key={s.id}><b>{s.name}</b><span>{s.total} cartes · {formatNumber(s.reward)} TK</span></li>)}
            </ul>
          )}
        </section>

        <section className={styles.section} aria-labelledby="ou">
          <Scene n={6} label={`${BOOSTERS.length} bobines`} />
          <h2 id="ou" className="display h2">Où trouver quoi</h2>
          <div className={styles.where}>
            {[{ kind: 'actor' as const, list: castings }, { kind: 'role' as const, list: films }].map(({ kind, list }) => (
              <div key={kind} className={`${styles.whereCol} ${kind === 'actor' ? styles.familyActor : styles.familyRole}`}>
                <span className={styles.kicker}>{FAMILY[kind].mark} {FAMILY_SHELVES[kind].chip} PAR BOBINE</span>
                <h3 className="display h3">{FAMILY_SHELVES[kind].title}</h3>
                <p className="muted">{FAMILY_SHELVES[kind].description}</p>
                <div className={styles.chips}>{list.map((b) => <Link key={b.id} href={`/bobines/${b.id}`} className="chip">{b.name}</Link>)}</div>
              </div>
            ))}
          </div>
          <Link href={ctx ? '/bobines' : '/ouvrir/tout-clap'} className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }}>
            {ctx ? 'Choisir une bobine' : 'Ouvrir ma bobine offerte'}
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
