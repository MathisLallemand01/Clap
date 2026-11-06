import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveFilters } from '@/components/LiveFilters';
import { notFound } from 'next/navigation';
import { CardLink } from '@/components/CardLink';
import { GameCard } from '@/components/GameCard';
import { Laurel } from '@/components/Laurel';
import { Footer, Nav } from '@/components/Nav';
import { getUserByName } from '@/lib/auth';
import { badgeStates, levelInfo } from '@/lib/badges';
import { boxOffice } from '@/lib/boxoffice';
import { searchCards } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { getCollection, getStats } from '@/lib/game';
import { RARITIES, rarityName } from '@/lib/rarity';
import { optionalContext } from '@/lib/session';
import { bigPulls, getShowcase, SHOWCASE_SLOTS } from '@/lib/showcase';
import { areFriends } from '@/lib/social';
import { befriendAction, moveSlotAction, setSlotAction } from './actions';
import styles from './vitrine.module.css';

type Props = { params: Promise<{ name: string }>; searchParams: Promise<{ montage?: string; case?: string; q?: string; erreur?: string; ami?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeURIComponent((await params).name);
  return { title: `Vitrine de ${name}`, description: `Les plus belles cartes de ${name} sur Clap.` };
}

const since = (t: number) => new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(t);
const ago = (t: number) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(t).toUpperCase();

/** La vitrine d'un joueur : son nom au fronton du cinéma, six caissons éclairés, son palmarès, ses grands tirages. */
export default async function ShowcasePage({ params, searchParams }: Props) {
  const name = decodeURIComponent((await params).name);
  const sp = await searchParams;
  const db = getDb();
  const owner = getUserByName(db, name);
  if (!owner) notFound();
  const ctx = await optionalContext();
  const mine = ctx?.user.id === owner.id;
  if (!owner.publicProfile && !mine) {
    return (
      <>
        <Nav ctx={ctx} />
        <main className="container page"><p className="slug">EXT. FRONTON DU CINÉMA — NUIT <span>RIDEAU BAISSÉ</span></p><h1 className="display h1">Vitrine fermée</h1><p className="lead">{owner.name} garde sa collection pour lui : son profil est privé.</p><Link href="/classement" className="btn">Retour au box-office</Link></main>
        <Footer />
      </>
    );
  }
  const editing = mine && sp.montage === '1';
  const stats = getStats(db, owner.playerId);
  const rank = boxOffice(db, 'points').find((r) => r.playerId === owner.playerId)?.rank ?? null;
  const badges = badgeStates(db, owner.playerId);
  const pinned = badges.filter((b) => b.pinned && b.level > 0);
  const awarded = badges.filter((b) => b.level > 0).length;
  const { slots, chosen } = getShowcase(db, owner.playerId);
  const pulls = bigPulls(db, owner.playerId, 3);
  const friend = ctx && !mine ? areFriends(db, ctx.user.id, owner.id) : false;
  const picking = editing && sp.case !== undefined ? Number(sp.case) : null;
  const letters = [...owner.name.toUpperCase()].slice(0, 20);
  const avatar = owner.discord?.avatar ?? owner.avatar;

  let collection = picking !== null ? getCollection(db, owner.playerId) : [];
  if (sp.q) collection = searchCards(collection, sp.q);

  return (
    <>
      <Nav ctx={ctx} />
      <main className="container page">
        <p className="slug">EXT. FRONTON DU CINÉMA — NUIT <span>LA VITRINE DE {owner.name.toUpperCase()}</span></p>
        {sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}
        {sp.ami && <p className="alert alert-ok" role="status">Demande d’ami envoyée à {owner.name}.</p>}

        <section className={styles.marquee} aria-label={`Ce soir à l’affiche : ${owner.name}`}>
          <span className={`${styles.bulbs} ${styles.top}`} aria-hidden="true" />
          <span className={`${styles.bulbs} ${styles.bottom}`} aria-hidden="true" />
          <div className={styles.board}>
            <span className={styles.avatar}>{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : owner.name.slice(0, 2).toUpperCase()}</span>
            <div className={styles.boardText}>
              <span className={styles.kicker}>Ce soir à l’affiche</span>
              <h1 className={styles.letters} style={{ '--n': letters.length } as React.CSSProperties}>
                {letters.map((l, i) => <span key={i} className={l === ' ' ? styles.space : ''} aria-hidden="true">{l}</span>)}
                <span className="visually-hidden">{owner.name}</span>
              </h1>
              <div className={styles.facts}>
                <span><b>{formatNumber(stats.unique)}</b> cartes</span>
                <span><b>{formatNumber(stats.points)}</b> points</span>
                {rank && <span><b>{rank}{rank === 1 ? 'ᵉʳ' : 'ᵉ'}</b> au box-office</span>}
                <span><b>{awarded}</b> distinction{awarded > 1 ? 's' : ''}</span>
                <span>en salle depuis <b>{since(owner.createdAt)}</b></span>
              </div>
            </div>
            <div className={styles.cta}>
              {mine ? (
                editing ? <Link href={`/v/${encodeURIComponent(owner.name)}`} className="btn btn-primary">Terminer le montage</Link>
                  : <Link href={`/v/${encodeURIComponent(owner.name)}?montage=1`} className="btn btn-primary">Monter ma vitrine</Link>
              ) : ctx ? (
                friend ? (
                  <>
                    <Link href={`/echanges?ami=${owner.id}`} className="btn btn-primary">Proposer un échange</Link>
                    <Link href={`/echanges?ami=${owner.id}`} className={`btn ${styles.paperBtn}`}>Voir sa collection</Link>
                  </>
                ) : (
                  <form action={befriendAction}><input type="hidden" name="name" value={owner.name} /><button type="submit" className="btn btn-primary">+ Ajouter en ami</button></form>
                )
              ) : <Link href={`/connexion?suite=/v/${encodeURIComponent(owner.name)}`} className="btn btn-primary">Se connecter pour échanger</Link>}
              {mine && <span className={styles.share}>clap · /v/{owner.name}</span>}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="vitrine">
          <div className="section-head"><h2 id="vitrine" className="display h2">La vitrine</h2><span className="rule" /><span className="eyebrow">{chosen ? '6 cases éclairées · choisies par le joueur' : 'Ses 6 cartes les plus rares'}</span></div>
          {editing && <p className="alert alert-info">Mode montage : choisissez une carte pour chaque case, réordonnez avec ← →. La case 1 est votre tête d’affiche.</p>}
          <ol className={styles.cases}>
            {slots.map((s) => (
              <li key={s.slot} className={`${styles.case} ${picking === s.slot ? styles.casePicking : ''}`}>
                {s.card ? (
                  <CardLink card={s.card}><GameCard card={s.card} width={170} serial={s.card.serial} /></CardLink>
                ) : editing ? (
                  <Link href={`/v/${encodeURIComponent(owner.name)}?montage=1&case=${s.slot}#tiroir`} className={styles.emptyCase}><span aria-hidden="true">+</span>Case libre<small>CHOISIR UNE CARTE</small></Link>
                ) : <span className={styles.emptyCase}><span aria-hidden="true">·</span>Case vide</span>}
                <div className={styles.plate}>
                  {s.slot === 0 ? 'TÊTE D’AFFICHE' : `CASE ${String(s.slot + 1).padStart(2, '0')}`}{s.card ? ` · ${RARITIES[s.card.rarity].label.toUpperCase()}` : ''}
                  <b>{s.card ? (s.card.character ?? `${s.card.first} ${s.card.last}`) : editing ? 'À vous de jouer' : '—'}</b>
                </div>
                {editing && (
                  <div className={styles.tools}>
                    <form action={moveSlotAction}><input type="hidden" name="slot" value={s.slot} /><input type="hidden" name="dir" value="-1" /><button type="submit" disabled={s.slot === 0} aria-label="Déplacer à gauche">←</button></form>
                    <Link href={`/v/${encodeURIComponent(owner.name)}?montage=1&case=${s.slot}#tiroir`}>Changer</Link>
                    {s.card && <form action={setSlotAction}><input type="hidden" name="slot" value={s.slot} /><input type="hidden" name="card" value="" /><button type="submit">Vider</button></form>}
                    <form action={moveSlotAction}><input type="hidden" name="slot" value={s.slot} /><input type="hidden" name="dir" value="1" /><button type="submit" disabled={s.slot === SHOWCASE_SLOTS - 1} aria-label="Déplacer à droite">→</button></form>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>

        {picking !== null && (
          <section id="tiroir" className={`panel ${styles.drawer}`}>
            <div className="section-head"><h2 className="display h3">Case {picking + 1} : choisissez une carte</h2><span className="rule" /><Link href={`/v/${encodeURIComponent(owner.name)}?montage=1`} className="btn btn-sm">Fermer</Link></div>
            <form className={styles.search} action={`/v/${encodeURIComponent(owner.name)}#tiroir`}>
              <LiveFilters />
              <input type="hidden" name="montage" value="1" /><input type="hidden" name="case" value={picking} />
              <input type="search" name="q" defaultValue={sp.q} placeholder="Acteur, film, personnage…" aria-label="Rechercher dans ma collection" className="input" />
              <button type="submit" className="btn btn-sm">Chercher</button>
            </form>
            <ul className={styles.pick}>
              {collection.slice(0, 60).map((c) => (
                <li key={c.id}>
                  <form action={setSlotAction}>
                    <input type="hidden" name="slot" value={picking} /><input type="hidden" name="card" value={c.id} />
                    <button type="submit" aria-label={`Mettre ${c.character ?? `${c.first} ${c.last}`} dans la case ${picking + 1}`}><GameCard card={c} width={130} serial={c.serial} /></button>
                  </form>
                </li>
              ))}
            </ul>
            {collection.length > 60 && <p className="muted" style={{ margin: 0 }}>Les 60 plus rares sont affichées : cherchez pour trouver les autres.</p>}
          </section>
        )}

        <div className={styles.grid2}>
          <section className={`panel ${styles.box}`}>
            <div className="section-head"><h2 className="display h3">Palmarès</h2><span className="rule" />{mine && <Link href="/palmares" className="eyebrow accent">Tout voir →</Link>}</div>
            {pinned.length === 0 ? <p className="muted" style={{ margin: 0 }}>{mine ? 'Décrochez des distinctions et épinglez-les ici depuis le palmarès.' : 'Pas encore de distinction épinglée.'}</p> : (
              <ul className={styles.badges}>
                {pinned.map((b) => {
                  const info = levelInfo(b.level);
                  return <li key={b.def.id}><Laurel color={info.color} icon={b.def.icon} size={84} label={`${b.def.name}, ${info.label}`} /><b>{b.def.name}</b><small>{info.label.toUpperCase()}</small></li>;
                })}
              </ul>
            )}
          </section>
          <section className={`panel ${styles.box}`}>
            <div className="section-head"><h2 className="display h3">Grands tirages</h2><span className="rule" /></div>
            {pulls.length === 0 ? <p className="muted" style={{ margin: 0 }}>Pas encore de Légende, d’Icône ou de Mythe sorti d’une bobine.</p> : pulls.map((c) => (
              <div key={`${c.id}-${c.at}`} className={styles.pull}>
                <GameCard card={c} width={56} />
                <div className={styles.pullText}><b>{c.character ?? `${c.first} ${c.last}`}</b><span className="eyebrow" style={{ color: RARITIES[c.rarity].color }}>{rarityName(c.rarity)} · {ago(c.at)}</span></div>
                <CardLink card={c} className="btn btn-sm">Voir la fiche</CardLink>
              </div>
            ))}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
