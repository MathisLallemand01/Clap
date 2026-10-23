import type { Metadata } from 'next';
import Link from 'next/link';
import { GameCard } from '@/components/GameCard';
import { Footer, Nav } from '@/components/Nav';
import { CropMarks } from '@/components/Decor';
import { SideRails } from '@/components/SideRails';
import { showcase } from '@/lib/catalog';
import { getUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { formatEntries, formatNumber } from '@/lib/format';
import { suggestedTickets } from '@/lib/rarity';
import { requireContext } from '@/lib/session';
import { areFriends, giftUnlockAt, listFriends, listTrades, tradableCollection, type Trade } from '@/lib/social';
import { acceptFriendAction, addFriendAction, cancelTradeAction, removeFriendAction, respondAction } from './actions';
import { TradeBuilder } from './TradeBuilder';
import styles from './echanges.module.css';

export const metadata: Metadata = { title: 'Échanges' };

const STATUS: Record<string, [string, string]> = {
  accepted: ['CONCLU', 'var(--ok)'], refused: ['REFUSÉ', 'var(--faint)'], cancelled: ['ANNULÉ', 'var(--faint)'], failed: ['ÉCHOUÉ', '#ff8a6b'],
};

function Avatar({ name }: { name: string }) {
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return <span className={styles.avatar} style={{ background: `hsl(${hue} 70% 68%)` }}>{name.slice(0, 2).toUpperCase()}</span>;
}

function TradeSummary({ t, me }: { t: Trade; me: string }) {
  const mineGive = t.from.id === me ? t.give : t.take;
  const mineTake = t.from.id === me ? t.take : t.give;
  const side = (label: string, s: Trade['give']) => (
    <div className={styles.tradeSide}>
      <span className="eyebrow">{label}</span>
      <div className={styles.tradeCards}>
        {s.cards.map((c) => <GameCard key={c.ownedId} card={c} width={84} serial={c.serial} />)}
        {s.tickets > 0 && <span className={styles.tradeTk}>+{formatNumber(s.tickets)} TK</span>}
        {s.cards.length === 0 && s.tickets === 0 && <span className="muted" style={{ fontSize: 14 }}>Rien</span>}
      </div>
    </div>
  );
  return (
    <div className={styles.tradeBody}>
      {side('VOUS DONNEZ', mineGive)}
      <span className={styles.swap} aria-hidden="true">⇄</span>
      {side('VOUS RECEVEZ', mineTake)}
    </div>
  );
}

export default async function TradesPage({ searchParams }: { searchParams: Promise<{ ami?: string; ok?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/echanges');
  const db = getDb();
  const demo = [...showcase(db, { count: 1, kind: 'actor', rarities: ['tete'] }), ...showcase(db, { count: 1, kind: 'role', rarities: ['chef'] })];
  const me = ctx.user.id;
  const { friends, incoming, outgoing } = listFriends(db, me);
  const { pending, history } = listTrades(db, me);
  const giftLocked = giftUnlockAt(db, me);
  const friend = sp.ami && areFriends(db, me, sp.ami) ? getUser(db, sp.ami) : null;
  const toItems = (playerId: string) => tradableCollection(db, playerId)
    .map((c) => ({ ...c, value: suggestedTickets(c.rarity) }))
    .sort((a, b) => b.copies - a.copies || b.value - a.value)
    .slice(0, 300);

  return (
    <>
      <Nav ctx={ctx} current="/echanges" />
      <SideRails left="CLAP · PELLICULE 35 MM · KODAK VISION3 5219 · 24 IPS" right="TC 00:42:17:08 · BOBINE 06 / 19" />
      <main className="container page">
        <p className="slug">INT. SALLE DES ÉCHANGES — NUIT <span>PLAN 04 / PRISE 02</span></p>
        <header className="page-head">
          <h1 className="display h1">Échanges</h1>
          <div className="meta">
            <span><b>{friends.length}</b> AMI{friends.length > 1 ? 'S' : ''} · <b>{pending.length}</b> EN COURS</span>
            <span>VOTRE PSEUDO : <b>{ctx.user.name}</b></span>
          </div>
        </header>
        {sp.ok && <p className="alert alert-ok" role="status">{sp.ok}</p>}
        {sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}

        <div className={styles.layout}>
          <aside className={styles.friends}>
            <form action={addFriendAction} className={styles.addFriend}>
              <label className="visually-hidden" htmlFor="friend-name">Pseudo d’un ami</label>
              <input id="friend-name" className="input" name="name" placeholder="Pseudo d’un ami" required />
              <button type="submit" className="btn btn-sm btn-light">Ajouter</button>
            </form>

            {incoming.length > 0 && (
              <div className={styles.block}>
                <span className="eyebrow">Demandes reçues</span>
                {incoming.map((f) => (
                  <div key={f.id} className={styles.friendRow}>
                    <Avatar name={f.name} />
                    <span className={styles.friendName}>{f.name}</span>
                    <form action={acceptFriendAction}><input type="hidden" name="id" value={f.id} /><button className="btn btn-sm btn-primary" type="submit">Accepter</button></form>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.block}>
              <span className="eyebrow">Amis · {friends.length}</span>
              {friends.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Ajoutez un ami avec son pseudo pour lui proposer des échanges.</p>}
              {friends.map((f) => (
                <Link key={f.id} href={`/echanges?ami=${f.id}`} className={`${styles.friendRow} ${styles.friendLink} ${friend?.id === f.id ? styles.active : ''}`}>
                  <Avatar name={f.name} />
                  <span className={styles.friendName}>{f.name}<small>{formatNumber(f.unique)} CARTES · {formatEntries(f.entries)} ENTRÉES</small></span>
                </Link>
              ))}
            </div>

            {outgoing.length > 0 && (
              <div className={styles.block}>
                <span className="eyebrow">En attente de réponse</span>
                {outgoing.map((f) => (
                  <div key={f.id} className={styles.friendRow}>
                    <Avatar name={f.name} />
                    <span className={styles.friendName}>{f.name}</span>
                    <form action={removeFriendAction}><input type="hidden" name="id" value={f.id} /><button className="btn btn-sm" type="submit">Annuler</button></form>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className={styles.main}>
            {friend ? (
              <TradeBuilder
                friendId={friend.id} friendName={friend.name} mine={toItems(ctx.player.id)} theirs={toItems(friend.playerId)}
                myTickets={ctx.player.unlimited ? 999_999 : ctx.wallet.tickets}
                giftLockedUntil={giftLocked ? new Date(giftLocked).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : null}
              />
            ) : (
              <div className={styles.placeholder}>
                <CropMarks className={styles.crop} />
                <div className={styles.swapDemo} aria-hidden="true">
                  {demo[0] && <div className={styles.swapA}><GameCard card={demo[0]} width={150} /></div>}
                  {demo[1] && <div className={styles.swapB}><GameCard card={demo[1]} width={150} /></div>}
                  <span className={styles.swapIcon}>⇄</span>
                </div>
                <div className={styles.placeholderText}>
                  <h2 className="display h2">Nouvel échange</h2>
                  <p className="lead">Choisissez un ami à gauche : vous verrez sa collection et la vôtre, côte à côte, avec la valeur de chaque carte.</p>
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <div className={styles.list}>
                <h2 className="display h3">En cours</h2>
                {pending.map((t) => {
                  const incomingTrade = t.to.id === me;
                  return (
                    <article key={t.id} className={styles.trade}>
                      <div className={styles.tradeHead}>
                        <Avatar name={incomingTrade ? t.from.name : t.to.name} />
                        <strong>{incomingTrade ? `${t.from.name} vous propose un échange` : `Proposé à ${t.to.name}`}</strong>
                        <span className="mono" style={{ fontSize: 12, color: incomingTrade ? 'var(--accent)' : 'var(--muted)' }}>{incomingTrade ? 'À RÉPONDRE' : 'EN ATTENTE'}</span>
                      </div>
                      <TradeSummary t={t} me={me} />
                      <div className={styles.tradeActions}>
                        {incomingTrade ? (
                          <>
                            <form action={respondAction}><input type="hidden" name="trade" value={t.id} /><input type="hidden" name="decision" value="refuse" /><button className="btn btn-sm" type="submit">Refuser</button></form>
                            <Link href={`/echanges?ami=${t.from.id}`} className="btn btn-sm">Contre-proposer</Link>
                            <form action={respondAction}><input type="hidden" name="trade" value={t.id} /><input type="hidden" name="decision" value="accept" /><button className="btn btn-sm btn-primary" type="submit">Accepter</button></form>
                          </>
                        ) : (
                          <form action={cancelTradeAction}><input type="hidden" name="trade" value={t.id} /><button className="btn btn-sm" type="submit">Annuler la proposition</button></form>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {history.length > 0 && (
              <div className={styles.list}>
                <h2 className="display h3">Historique</h2>
                {history.slice(0, 10).map((t) => (
                  <article key={t.id} className={`${styles.trade} ${styles.past}`}>
                    <div className={styles.tradeHead}>
                      <Avatar name={t.from.id === me ? t.to.name : t.from.name} />
                      <strong>{t.gift ? (t.from.id === me ? `Cadeau pour ${t.to.name}` : `Cadeau de ${t.from.name}`) : t.from.id === me ? `Avec ${t.to.name}` : `Avec ${t.from.name}`}</strong>
                      {t.gift
                        ? <span className={`mono ${styles.giftTag}`} style={{ fontSize: 12 }}>🎁 CADEAU</span>
                        : <span className="mono" style={{ fontSize: 12, color: STATUS[t.status]?.[1] }}>{STATUS[t.status]?.[0] ?? t.status}</span>}
                    </div>
                    <TradeSummary t={t} me={me} />
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
