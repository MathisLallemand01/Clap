import type { Metadata } from 'next';
import Link from 'next/link';
import { Laurel } from '@/components/Laurel';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { badgeStates, CATEGORIES, levelInfo, LEVELS, MAX_PINS } from '@/lib/badges';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { requireContext } from '@/lib/session';
import { pinAction } from './actions';
import styles from './palmares.module.css';

export const metadata: Metadata = { title: 'Palmarès', description: 'Les distinctions de Clap : lauriers de bronze, d’argent et d’or à décrocher en jouant.' };

export default async function PalmaresPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/palmares');
  const states = badgeStates(getDb(), ctx.player.id);
  const got = states.filter((s) => s.level > 0).length;
  const levels = states.reduce((n, s) => n + s.level, 0);
  const max = states.reduce((n, s) => n + Math.min(3, (s.def.firstLevel ?? 1) + s.def.steps.length - 1), 0);
  const pins = states.filter((s) => s.pinned).length;

  return (
    <>
      <Nav ctx={ctx} />
      <SideRails left="CLAP · CÉRÉMONIE DE CLÔTURE · PALMARÈS" right="LAURIERS · BRONZE · ARGENT · OR" />
      <main className="container page">
        <p className="slug">INT. CÉRÉMONIE DE CLÔTURE — SOIR <span>PLAN 09 / PRISE 01</span></p>
        <header className="page-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 className="display h1">Palmarès</h1>
            <p className="lead">Des distinctions à décrocher en jouant. Chacune rapporte des tickets, monte de niveau et peut être épinglée dans <Link href={`/v/${encodeURIComponent(ctx.user.name)}`} className="accent">votre vitrine</Link> (jusqu’à {MAX_PINS}).</p>
          </div>
          <div className={styles.count}><b>{got} <span>/ {states.length}</span></b><span className="eyebrow">Distinctions décrochées · {levels}/{max} niveaux</span></div>
        </header>
        {sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}
        <div className={styles.tiers}>
          {LEVELS.map((l) => (
            <span key={l.level} className={styles.tier}><Laurel color={l.color} icon="star" size={34} /><span><b style={{ color: l.color }}>{l.label}</b> · {l.metal} · ×{l.weight}{l.level === 3 ? ' au box-office Palmarès' : ''}</span></span>
          ))}
        </div>

        {CATEGORIES.map((cat) => (
          <section key={cat.id} className={styles.cat}>
            <div className="section-head"><h2 className="display h2">{cat.label}</h2><span className="rule" /><span className="eyebrow">{cat.sub}</span></div>
            <ul className={styles.grid}>
              {states.filter((s) => s.def.category === cat.id).map((s) => {
                const info = levelInfo(Math.max(1, s.level));
                const hidden = s.def.secret && s.level === 0;
                const nextLevel = s.next === null ? null : levelInfo((s.def.firstLevel ?? 1) + s.def.steps.indexOf(s.next));
                return (
                  <li key={s.def.id} className={`${styles.bd} ${s.level ? styles.got : ''}`} style={{ '--t': s.level ? info.color : '#5b5b63' } as React.CSSProperties}>
                    <Laurel color={info.color} icon={hidden ? 'lock' : s.def.icon} size={78} locked={s.level === 0} label={s.level ? `${s.def.name}, ${info.label}` : undefined} />
                    <div className={styles.text}>
                      <span className={styles.lvl}>{s.level ? info.label : 'À décrocher'}{s.def.secret ? ' · secrète' : ''}</span>
                      <h3>{hidden ? '???' : s.def.name}</h3>
                      <p>{hidden ? `Distinction secrète. Indice : « ${s.def.hint} »` : s.desc}</p>
                      {!hidden && s.next !== null && (s.def.steps.length > 1 || s.def.steps[0] > 1) ? (
                        <div className={styles.progress}>
                          <span className="bar"><i style={{ width: `${Math.round(s.progress * 100)}%`, background: nextLevel?.color ?? 'var(--accent)' }} /></span>
                          <small className="mono">{formatNumber(s.value)} / {formatNumber(s.next ?? s.def.steps[s.def.steps.length - 1])}{nextLevel && s.level ? ` · vers ${nextLevel.label}` : ''}</small>
                        </div>
                      ) : null}
                      {s.level > 0 && (
                        <form action={pinAction}>
                          <input type="hidden" name="badge" value={s.def.id} />
                          <button type="submit" className={styles.pin} disabled={!s.pinned && pins >= MAX_PINS}>{s.pinned ? '★ Épinglée en vitrine' : '☆ Épingler en vitrine'}</button>
                        </form>
                      )}
                    </div>
                    <span className={styles.rew}>+{formatNumber(s.def.rewards[Math.max(0, s.def.steps.indexOf(s.next ?? -1))] ?? s.def.rewards[s.def.rewards.length - 1])} TK</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
