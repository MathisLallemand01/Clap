import type { Metadata } from 'next';
import Link from 'next/link';
import { Scene, Searchlights } from '@/components/Decor';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { periodStart } from '@/lib/missions';
import { boxOfficeBoard, presenceBoard, PRESENCE, SEASON_REWARDS, seasonOf, type RankRow } from '@/lib/ranking';
import { requireContext } from '@/lib/session';
import styles from './classement.module.css';

export const metadata: Metadata = { title: 'Classement' };

const VIEWS = [
  { id: 'saison', label: 'Saison' },
  { id: 'semaine', label: 'Cette semaine' },
  { id: 'box-office', label: 'Box-office' },
] as const;
type View = (typeof VIEWS)[number]['id'];

const AVATARS = ['#FFC83D', '#B57BFF', '#2EE6D6', '#4C8DFF', '#3DDC97', '#FF2E93', '#C6F05A', '#D9B48A', '#F2EFE8'];
const avatarColor = (name: string) => AVATARS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATARS.length];

function Flame() {
  return <svg className={styles.flame} width="12" height="14" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 3-8 0 3 1 4 3 5-1-4 0-8 1-12z" /></svg>;
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const ctx = await requireContext('/classement');
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.id === sp.vue) ? (sp.vue as View) : 'saison';
  const db = getDb();
  const now = Date.now();
  const season = seasonOf(now);
  const daysLeft = Math.max(1, Math.ceil((season.end - now) / 86_400_000));
  const rows: RankRow[] = view === 'box-office' ? boxOfficeBoard(db)
    : view === 'semaine' ? presenceBoard(db, periodStart('weekly', now).start, now + 1, now)
    : presenceBoard(db, season.start, season.end, now);
  const unit = view === 'box-office' ? 'ENTRÉES' : 'PTS';
  const fmt = (n: number) => (view === 'box-office' ? formatEntries(n) : formatNumber(n));
  const me = rows.find((r) => r.playerId === ctx.player.id);
  const podium = [rows[1], rows[0], rows[2]];
  const list = rows.slice(0, 50);
  const meOutside = me && me.rank > 50;

  return (
    <>
      <Nav ctx={ctx} current="/classement" />
      <SideRails left={`CLASSEMENT · SAISON ${season.label.toUpperCase()} · MIS À JOUR À CHAQUE VISITE`} right="GÉNÉRIQUE DE FIN · PAR ORDRE D’APPARITION" />
      <main className={styles.main}>
        <section className={styles.stage}>
          <Searchlights />
          <div className={`container ${styles.head}`}>
            <div className={styles.headText}>
              <p className="slug">INT. SALLE DES FÊTES — SOIR <span>PLAN 01 / PRISE 01</span></p>
              <span className={styles.season}>★ SAISON · {season.label.toUpperCase()} · FIN DANS {daysLeft} JOUR{daysLeft > 1 ? 'S' : ''}</span>
              <h1 className="display h1">Classement</h1>
              <p className="lead">
                {view === 'box-office'
                  ? 'La valeur des collections, en entrées. Le box-office ne repart jamais à zéro.'
                  : <>Chaque jour où vous passez en salle rapporte des <strong>points de présence</strong>. Plus votre série est longue, plus chaque visite compte.</>}
              </p>
            </div>
            <nav className="segmented" aria-label="Classements">
              {VIEWS.map((v) => <Link key={v.id} href={`/classement?vue=${v.id}`} aria-current={v.id === view ? 'true' : undefined}>{v.label}</Link>)}
            </nav>
          </div>

          <div className={`container ${styles.podium}`}>
            {podium.map((r, i) => {
              const place = i === 1 ? 1 : i === 0 ? 2 : 3;
              return (
                <div key={place} className={`${styles.step} ${styles[`p${place}`]}`}>
                  {r ? (
                    <div className={styles.winner}>
                      <span className={styles.avatar} style={{ background: avatarColor(r.name) }}>{r.name.slice(0, 2).toUpperCase()}</span>
                      <span className={styles.who}>{r.name}{r.playerId === ctx.player.id && <em>VOUS</em>}</span>
                      <span className={styles.score}>{fmt(r.points)} {unit}{r.streak > 1 && <> · <Flame /> {r.streak} J</>}</span>
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
              <p className={styles.none}>Personne n’est encore classé. Revenez demain : votre première visite vous met en tête.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr><th>Rang</th><th>Joueur</th>{view !== 'box-office' && <><th className={styles.opt}>Série</th><th className={styles.opt}>Jours</th></>}<th className={styles.num}>{view === 'box-office' ? 'Entrées' : 'Points'}</th></tr>
                </thead>
                <tbody>
                  {[...list, ...(meOutside ? [me] : [])].map((r) => (
                    <tr key={r.playerId} className={r.playerId === ctx.player.id ? styles.mine : undefined}>
                      <td className={styles.rank}>{r.rank}</td>
                      <td><span className={styles.player}><span className={styles.mini} style={{ background: avatarColor(r.name) }}>{r.name.slice(0, 2).toUpperCase()}</span>{r.name}{r.playerId === ctx.player.id && <em>VOUS</em>}</span></td>
                      {view !== 'box-office' && <><td className={`${styles.opt} ${styles.streak}`}>{r.streak > 0 ? <><Flame /> {r.streak} j</> : '—'}</td><td className={styles.opt}>{r.days}</td></>}
                      <td className={styles.num}>{fmt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!me && rows.length > 0 && <p className={styles.none}>Vous n’êtes pas encore classé sur cette période.</p>}
          </section>

          <aside className={styles.aside}>
            <div className={styles.rules}>
              <h2 className="display">Points de présence</h2>
              <ul>
                <li><span>Passer en salle (une fois par jour)</span><b>+{PRESENCE.visit}</b></li>
                <li><span>Chaque jour de série en plus (jusqu’à {PRESENCE.streakCap} jours)</span><b>+{PRESENCE.streakStep} / j</b></li>
                <li><span>Tous les 7 jours d’affilée</span><b>+{PRESENCE.weekBonus}</b></li>
                <li><span>Bobine offerte ouverte</span><b>+{PRESENCE.freeOpen}</b></li>
              </ul>
            </div>
            <div className={styles.rewards}>
              <span className={styles.perf} aria-hidden="true" />
              <span className="mono">RÉCOMPENSES DE FIN DE SAISON</span>
              <ul>
                {SEASON_REWARDS.map((r) => <li key={r.upTo}><b className="display">{r.upTo === 1 ? '1er' : `Top ${r.upTo}`}</b><span>{r.label}</span></li>)}
              </ul>
              <small>Versées automatiquement à votre première visite de la saison suivante.</small>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
