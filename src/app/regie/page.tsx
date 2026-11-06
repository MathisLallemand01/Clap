import type { Metadata } from 'next';
import Link from 'next/link';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { SideRails } from '@/components/SideRails';
import { getCard } from '@/lib/catalog';
import { cotes } from '@/lib/cote';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { categoryOf, channelsOf, discordDmAvailable, listNotifications, REGIE_CATEGORIES, unreadByKind } from '@/lib/notify';
import { suggestedSeats } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { condLabel, listWatches, MAX_WATCHES, WATCH_CONDS } from '@/lib/watch';
import { channelAction, markAllAction, openNotificationAction, removeWatchAction, toggleWatchAction, watchAction } from './actions';
import styles from './regie.module.css';

export const metadata: Metadata = { title: 'La Régie', description: 'Notifications et alertes : enchères, ventes, échanges, distinctions et cartes guettées.' };

const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'À L’INSTANT';
  if (s < 3600) return `IL Y A ${Math.round(s / 60)} MIN`;
  if (s < 86400) return `IL Y A ${Math.round(s / 3600)} H`;
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(t).toUpperCase();
};

type Search = { cat?: string; guetter?: string; erreur?: string; guet?: string };

/** La Régie : tout ce qui se passe pendant que le joueur n'est pas dans la salle, et les cartes qu'il guette. */
export default async function RegiePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/regie');
  const db = getDb();
  const cat = REGIE_CATEGORIES.find((c) => c.id === sp.cat) ?? null;
  const items = listNotifications(db, ctx.user.id, 80, cat?.kinds);
  const unread = unreadByKind(db, ctx.user.id);
  const unreadOf = (kinds: string[]) => kinds.reduce((n, k) => n + (unread.get(k) ?? 0), 0);
  const total = [...unread.values()].reduce((a, b) => a + b, 0);
  const watches = listWatches(db, ctx.user.id);
  const target = sp.guetter ? getCard(db, sp.guetter) : null;
  const current = target ? watches.find((w) => w.card.id === target.id) : undefined;
  const targetCote = target ? cotes(db).get(target.id) ?? null : null;
  const channels = channelsOf(ctx.user.notify);
  const dm = discordDmAvailable();

  return (
    <>
      <Nav ctx={ctx} />
      <SideRails left="CLAP · LA RÉGIE · PENDANT LA SÉANCE" right="TÉLÉGRAMMES · CARTES GUETTÉES" />
      <main className="container page">
        <p className="slug">INT. LA RÉGIE — PENDANT LA SÉANCE <span>PLAN 10 / PRISE 01</span></p>
        <header className="page-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 className="display h1">La Régie</h1>
            <p className="lead">Tout ce qui se passe pendant que vous n’êtes pas dans la salle : enchères, ventes, échanges, distinctions, et les cartes que vous guettez.</p>
          </div>
          <form action={markAllAction}><input type="hidden" name="cat" value={cat?.id ?? ''} /><button type="submit" className="btn" disabled={total === 0}>Tout marquer comme vu</button></form>
        </header>
        {sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}
        {sp.guet && <p className="alert alert-ok" role="status">Alerte enregistrée : la Régie vous enverra un télégramme.</p>}

        {target && (
          <section className={`panel ${styles.guet}`} aria-labelledby="guetter">
            <GameCard card={target} width={130} />
            <form action={watchAction} className={styles.guetForm}>
              <input type="hidden" name="card" value={target.id} />
              <h2 id="guetter" className="display h3">{current ? 'Modifier l’alerte' : 'Guetter'} · {target.character ?? `${target.first} ${target.last}`}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>Prévenez-moi quand cette carte arrive au Guichet{targetCote ? ` (cote : ${formatNumber(targetCote)} sièges)` : ''} :</p>
              <fieldset className={styles.conds}>
                <legend className="visually-hidden">Condition</legend>
                {WATCH_CONDS.map((c) => (
                  <label key={c.id}><input type="radio" name="cond" value={c.id} defaultChecked={(current?.cond ?? 'any') === c.id} /><span>{c.label}</span></label>
                ))}
              </fieldset>
              <label className={styles.maxField}>Prix maximum (pour « Sous un prix »)
                <input type="number" name="max" min={1} defaultValue={current?.maxPrice ?? targetCote ?? suggestedSeats(target.rarity)} className="input" />
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="submit" className="btn btn-primary">Enregistrer l’alerte</button><Link href="/regie" className="btn">Annuler</Link></div>
            </form>
          </section>
        )}

        <div className={styles.layout}>
          <nav className={`panel ${styles.side}`} aria-label="Catégories">
            <Link href="/regie" scroll={false} aria-current={!cat ? 'page' : undefined}>Tout <span>{total ? `● ${total}` : '0'}</span></Link>
            {REGIE_CATEGORIES.map((c) => (
              <Link key={c.id} href={`/regie?cat=${c.id}`} scroll={false} aria-current={cat?.id === c.id ? 'page' : undefined}>{c.label} <span>{unreadOf(c.kinds)}</span></Link>
            ))}
          </nav>

          <section key={cat?.id ?? 'tout'} className={`panel ${styles.feed} stagger-in`} aria-label="Notifications">
            <div className={styles.feedHead}><span className="eyebrow" style={{ color: 'var(--text)' }}><span style={{ color: 'var(--accent)' }}>● REC</span> · {unreadOf(cat?.kinds ?? [...unread.keys()])} non vue{unreadOf(cat?.kinds ?? [...unread.keys()]) > 1 ? 's' : ''}</span><span className="eyebrow">{cat?.label ?? 'Tout'}</span></div>
            {items.length === 0 && <p className="muted" style={{ margin: 0, padding: 22 }}>Rien en régie pour l’instant.</p>}
            {items.map((n) => {
              const c = categoryOf(n.kind);
              return (
                <form key={n.id} action={openNotificationAction} className={`${styles.nt} ${n.read ? '' : styles.unread}`}>
                  <input type="hidden" name="id" value={n.id} /><input type="hidden" name="href" value={n.href ?? '/regie'} />
                  <span className={styles.rec} aria-hidden="true">{!n.read && <i />}</span>
                  <div className={styles.ntText}>
                    <span className={styles.kind} style={{ color: c.color }}>{c.label.toUpperCase()}{n.urgent ? ' · TÉLÉGRAMME' : ''}</span> <span className={styles.when}>· {ago(n.createdAt)}</span>
                    <p>{n.text}</p>
                  </div>
                  {n.href && <button type="submit" className={`btn btn-sm ${n.read ? '' : styles.openNew}`}>Ouvrir</button>}
                </form>
              );
            })}
          </section>

          <aside className={styles.aside}>
            <section className={`panel ${styles.box}`} aria-labelledby="guettees">
              <div className={styles.boxHead}><h2 id="guettees" className="display h3">Cartes guettées</h2><span className="eyebrow">{watches.length} / {MAX_WATCHES}</span></div>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Un télégramme dès qu’une de ces cartes arrive au Guichet, selon votre condition.</p>
              {watches.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Aucune pour l’instant : « ☆ Guetter cette carte » sur une fiche ou un lot.</p>}
              {watches.map((w) => (
                <div key={w.card.id} className={styles.watch}>
                  <GameCard card={w.card} width={40} />
                  <div><Link href={`/regie?guetter=${encodeURIComponent(w.card.id)}`}><b>{w.card.character ?? `${w.card.first} ${w.card.last}`}</b></Link><span>{condLabel(w)}</span></div>
                  <form action={toggleWatchAction}><input type="hidden" name="card" value={w.card.id} /><button type="submit" className={`${styles.sw} ${w.active ? styles.on : ''}`} role="switch" aria-checked={w.active} aria-label={`Alerte ${w.card.first} ${w.card.last}`} /></form>
                  <form action={removeWatchAction}><input type="hidden" name="card" value={w.card.id} /><button type="submit" className={styles.x} aria-label={`Ne plus guetter ${w.card.first} ${w.card.last}`}>×</button></form>
                </div>
              ))}
              <Link href="/catalogue" className="btn btn-sm">+ Guetter une carte (depuis le catalogue)</Link>
            </section>
            <section className={`panel ${styles.box}`} aria-labelledby="canaux">
              <h2 id="canaux" className="display h3">Où vous prévenir</h2>
              <div className={styles.channel}><div><b>Dans le site</b><span>cloche et télégramme, toujours</span></div><span className={`${styles.sw} ${styles.on} ${styles.fixed}`} aria-hidden="true" /></div>
              <div className={styles.channel}>
                <div><b>Message privé Discord</b><span>{!ctx.user.discord ? 'liez votre Discord dans les paramètres' : !dm ? 'pas encore activé sur ce serveur (bot Discord à configurer)' : 'pour les télégrammes seulement'}</span></div>
                <form action={channelAction}><input type="hidden" name="key" value="ch_discord" /><button type="submit" className={`${styles.sw} ${channels.discord && ctx.user.discord && dm ? styles.on : ''}`} role="switch" aria-checked={channels.discord && Boolean(ctx.user.discord) && dm} aria-label="Message privé Discord" disabled={!ctx.user.discord || !dm} /></form>
              </div>
              <Link href="/parametres#notifications" className="muted" style={{ fontSize: 13, textDecoration: 'underline' }}>Choisir les types de notifications</Link>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
