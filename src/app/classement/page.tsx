import type { Metadata } from 'next';
import Link from 'next/link';
import { Scene, Searchlights } from '@/components/Decor';
import { Footer, Nav } from '@/components/Nav';
import { DiscordLogo } from '@/components/DiscordLogo';
import { SideRails } from '@/components/SideRails';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { boardOf, BOARDS, boxOffice, myPlaces, weeklyMoves, type BoxRow } from '@/lib/boxoffice';
import { DUO_BONUS } from '@/lib/game';
import { FAMILY, ladderOf, RARITIES } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import styles from './classement.module.css';

export const metadata: Metadata = { title: 'Classement' };

const AVATARS = ['#FFC83D', '#B57BFF', '#2EE6D6', '#4C8DFF', '#3DDC97', '#FF2E93', '#C6F05A', '#D9B48A', '#F2EFE8'];
const avatarColor = (name: string) => AVATARS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATARS.length];


export default async function RankingPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const ctx = await requireContext('/classement');
  const db = getDb();
  // Cinq catégories ; la première (Box-office) reste le classement aux points.
  const board = boardOf((await searchParams).cat);
  const rows: BoxRow[] = boxOffice(db, board.id);
  const moves = weeklyMoves(db, board.id, rows);
  const places = myPlaces(db, ctx.player.id);
  const unit = board.unit;
  const fmt = (n: number) => formatNumber(n);
  const me = rows.find((r) => r.playerId === ctx.player.id);
  const podium = [rows[1], rows[0], rows[2]];
  const list = rows.slice(0, 50);
  const meOutside = me && me.rank > 50;

  return (
    <>
      <Nav ctx={ctx} current="/classement" />
      <SideRails left="CLASSEMENT · POINTS DE COLLECTION · MIS À JOUR EN DIRECT" right="GÉNÉRIQUE DE FIN · PAR ORDRE D’APPARITION" />
      <main className={styles.main}>
        <section className={styles.stage}>
          <Searchlights />
          <div className={`container ${styles.head}`}>
            <div className={styles.headText}>
              <p className="slug">INT. SALLE DES FÊTES — SOIR <span>PLAN 01 / PRISE 01</span></p>
              <span className={styles.season}>★ {board.label.toUpperCase()} · {me ? `${formatNumber(me.points)} ${unit} · ${me.rank}${me.rank === 1 ? 'ER' : 'E'}` : 'PAS ENCORE CLASSÉ'}</span>
              <h1 className="display h1">Box-office</h1>
              <p className="lead">Cinq façons de monter les marches. {board.id === 'points' ? <>Chaque carte <b>différente</b> rapporte des points selon sa rareté, et chaque duo en ajoute {DUO_BONUS}. Les doublons ne comptent pas.</> : board.desc}</p>
            </div>
          </div>

          <nav className={`container ${styles.stubs}`} aria-label="Catégories du box-office">
            {BOARDS.map((b, i) => (
              <Link key={b.id} href={b.id === 'points' ? '/classement' : `/classement?cat=${b.id}`} scroll={false} className={styles.stub} aria-current={b.id === board.id ? 'page' : undefined}>
                <span className="eyebrow">Catégorie {String(i + 1).padStart(2, '0')}</span><b>{b.label}</b><small>{b.desc}</small>
              </Link>
            ))}
          </nav>

          <div className={`container ${styles.podium}`}>
            {podium.map((r, i) => {
              const place = i === 1 ? 1 : i === 0 ? 2 : 3;
              return (
                <div key={place} className={`${styles.step} ${styles[`p${place}`]}`}>
                  {r ? (
                    <div key={`${board.id}-${r.playerId}`} className={`${styles.winner} ${styles.winnerIn}`}>
                      <span className={styles.avatar} style={{ background: avatarColor(r.name) }}>{r.avatar ? <img src={r.avatar} alt="" referrerPolicy="no-referrer" /> : r.name.slice(0, 2).toUpperCase()}</span>
                      <span className={styles.who}>{r.name}{r.playerId === ctx.player.id && <em>VOUS</em>}</span>
                      {r.discord && <span className={styles.discord}><DiscordLogo size={11} />{r.discord}</span>}
                      <span key={board.id} className={`${styles.score} ${styles.scoreIn}`}>{fmt(r.points)} {unit}</span>
                    </div>
                  ) : <span className={styles.empty}>Place libre</span>}
                  <div className={styles.block}><span>{place}</span></div>
                </div>
              );
            })}
          </div>
        </section>

        <div className={`container ${styles.layout}`}>
          <section className={styles.board} aria-labelledby="tableau">
            <Scene n={1} label={`${formatNumber(rows.length)} joueur${rows.length > 1 ? 's' : ''} classé${rows.length > 1 ? 's' : ''}`} />
            <h2 id="tableau" className="visually-hidden">Tableau</h2>
            {rows.length === 0 ? (
              <p className={styles.none}>Personne n’est encore classé : ouvrez une bobine pour entrer au générique.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr><th>Rang</th><th>Joueur</th><th className={styles.opt}>{board.id === 'points' ? 'Cartes' : board.id === 'filmotheque' ? 'Mythes' : board.id === 'mythes' ? 'Lég./Icônes' : board.id === 'integrales' ? 'Cartes' : 'Distinctions'}</th><th className={styles.opt}>Semaine</th><th className={styles.num}>{board.col}</th></tr>
                </thead>
                <tbody key={board.id} className={styles.rowsIn}>
                  {[...list, ...(meOutside ? [me] : [])].map((r, i) => (
                    <tr key={r.playerId} className={r.playerId === ctx.player.id ? styles.mine : undefined} style={{ '--i': Math.min(i, 14) } as React.CSSProperties}>
                      <td className={styles.rank}>{r.rank}</td>
                      <td><Link href={`/v/${encodeURIComponent(r.name)}`} className={styles.player}><span className={styles.mini} style={{ background: avatarColor(r.name) }}>{r.avatar ? <img src={r.avatar} alt="" referrerPolicy="no-referrer" /> : r.name.slice(0, 2).toUpperCase()}</span><span className={styles.names}>{r.name}{r.discord && <small><DiscordLogo size={10} />{r.discord}</small>}</span>{r.playerId === ctx.player.id && <em>VOUS</em>}</Link></td>
                      <td className={styles.opt}>{formatNumber(r.secondary)}</td>
                      <td className={styles.opt}><span className={(moves.get(r.playerId) ?? 0) > 0 ? styles.up : (moves.get(r.playerId) ?? 0) < 0 ? styles.down : styles.same}>{(moves.get(r.playerId) ?? 0) > 0 ? `▲ ${moves.get(r.playerId)}` : (moves.get(r.playerId) ?? 0) < 0 ? `▼ ${-(moves.get(r.playerId) ?? 0)}` : '='}</span></td>
                      <td className={styles.num}>{fmt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!me && rows.length > 0 && <p className={styles.none}>Vous n’êtes pas encore classé : ouvrez une bobine.</p>}
          </section>

          <aside className={styles.aside}>
            <div className={styles.rules}>
              <h2 className="display">Votre place</h2>
              <ul>
                {places.map((p) => (
                  <li key={p.board.id}><Link href={p.board.id === 'points' ? '/classement' : `/classement?cat=${p.board.id}`} scroll={false}>{p.board.label}</Link><b>{p.rank ? `${p.rank}${p.rank === 1 ? 'ᵉʳ' : 'ᵉ'}${p.rank === 1 ? ' ★' : ''}` : '—'}</b></li>
                ))}
              </ul>
              <small className="muted" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>« Semaine » : places gagnées ou perdues depuis lundi, comme au box-office.</small>
            </div>
            <div className={styles.rules}>
              <h2 className="display">Le barème</h2>
              <ul>
                {(['role', 'actor'] as const).map((k) => [...ladderOf(k)].reverse().map((r) => (
                  <li key={r}><span><i style={{ display: 'inline-block', width: 8, height: 8, marginRight: 8, background: RARITIES[r].color, borderRadius: k === 'actor' ? '50%' : 1, transform: k === 'role' ? 'rotate(45deg)' : undefined }} />{FAMILY[k].label} · {RARITIES[r].label}</span><b>{RARITIES[r].points} pt{RARITIES[r].points > 1 ? 's' : ''}</b></li>
                )))}
                <li><span>Chaque duo (Acteur + un de ses Rôles)</span><b>+{DUO_BONUS}</b></li>
              </ul>
            </div>
            <div className={styles.rewards}>
              <span className={styles.perf} aria-hidden="true" />
              <span className="mono">À SAVOIR</span>
              <ul>
                <li><b className="display">1×</b><span>Une carte ne compte qu’une fois, même en plusieurs exemplaires.</span></li>
                <li><b className="display">♻</b><span>Recycler ses doublons ne fait rien perdre au classement.</span></li>
              </ul>
              <small><a href="/monnaies" style={{ textDecoration: 'underline' }}>Tickets, sièges et points : à quoi sert chaque chose</a></small>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
