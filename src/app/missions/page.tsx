import type { Metadata } from 'next';
import { Countdown } from '@/components/Countdown';
import { TicketIcon } from '@/components/Icons';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { missionStates, periodStart, STREAK_BONUS, STREAK_DAYS, visitStreak, type MissionScope } from '@/lib/missions';
import { requireContext } from '@/lib/session';
import { ClaimButton } from './ClaimButton';
import styles from './missions.module.css';

export const metadata: Metadata = { title: 'Missions' };

const GROUPS: { scope: MissionScope; title: string }[] = [
  { scope: 'daily', title: 'Aujourd’hui' },
  { scope: 'weekly', title: 'Cette semaine' },
  { scope: 'saga', title: 'Sagas' },
];
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function show(scope: MissionScope, id: string, n: number): string {
  return id === 'saga-entries' ? formatEntries(n) : formatNumber(n);
}

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ gain?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/missions');
  const db = getDb();
  const now = Date.now();
  const states = missionStates(db, ctx.player.id, now);
  const streak = visitStreak(db, ctx.player.id, now);
  const cycle = streak % STREAK_DAYS || (streak > 0 ? STREAK_DAYS : 0);
  const ready = states.filter((m) => m.done && !m.claimed).length;

  return (
    <>
      <Nav ctx={ctx} current="/missions" />
      <SideRails left="CLAP · FEUILLE DE SERVICE DU JOUR" right="TOURNAGE · JOUR 1 · ÉQUIPE A" />
      <main className="container page">
        <p className="slug">INT. LE BUREAU DE PRODUCTION — JOUR <span>PLAN 03 / PRISE 04</span></p>
        <header className="page-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 className="display h1">Missions</h1>
            <p className="lead">Gagnez des tickets pour ouvrir plus de bobines ou faire vos achats au Guichet.</p>
          </div>
          <div className={styles.streak}>
            <div className={styles.streakHead}>
              <span>SÉRIE DE VISITES · <b>{streak} JOUR{streak > 1 ? 'S' : ''}</b></span>
              <span style={{ color: 'var(--ok)' }}>J{STREAK_DAYS} : +{STREAK_BONUS}</span>
            </div>
            <div className={styles.days}>
              {DAYS.map((d, i) => {
                const doneDay = i < cycle;
                const bonus = i === STREAK_DAYS - 1;
                return (
                  <div key={i} className={`${styles.day} ${doneDay ? styles.dayDone : ''} ${bonus ? styles.dayBonus : ''}`}>
                    <span>{d}</span><strong>{bonus ? `+${STREAK_BONUS}` : '+50'}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {sp.gain && <p className="alert alert-ok" role="status">Récompense récupérée : +{formatNumber(Number(sp.gain))} tickets.</p>}
        {sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}
        {ready > 0 && !sp.gain && <p className="alert alert-info">{ready} récompense{ready > 1 ? 's' : ''} à récupérer.</p>}

        {GROUPS.map((g) => {
          const items = states.filter((m) => m.scope === g.scope);
          const end = items[0]?.endsAt;
          return (
            <section key={g.scope} className={styles.group}>
              <div className="section-head">
                <h2 className="display h2">{g.title}</h2>
                <span className="rule" />
                <span className="eyebrow">{end ? <>Renouvelées dans <b style={{ color: 'var(--text)' }}><Countdown until={end} /></b></> : 'Objectifs au long cours'}</span>
              </div>
              <div className={styles.grid}>
                {items.map((m) => {
                  const pct = Math.min(100, (m.current / m.goal) * 100);
                  return (
                    <article key={m.id} className={`${styles.mission} ${m.done && !m.claimed ? styles.ready : ''} ${m.claimed ? styles.claimed : ''}`}>
                      <span className={styles.glyph} aria-hidden="true">{m.glyph}</span>
                      <div className={styles.body}>
                        <strong>{m.title}</strong>
                        <div className={styles.progress}>
                          <span className={styles.bar}><span style={{ width: `${pct}%` }} /></span>
                          <span className="mono">{show(g.scope, m.id, Math.min(m.current, m.goal))} / {show(g.scope, m.id, m.goal)}</span>
                        </div>
                      </div>
                      <div className={styles.reward}>
                        <span className={styles.amount}>+{formatNumber(m.reward)} <TicketIcon size={18} /></span>
                        {m.claimed ? (
                          <span className={styles.got}>✓ REÇU</span>
                        ) : m.done ? (
                          <ClaimButton missionId={m.id} />
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="eyebrow" style={{ textAlign: 'center' }}>Journées et semaines à l’heure de Paris · période en cours : {periodStart('daily', now).key}</p>
      </main>
      <Footer />
    </>
  );
}
