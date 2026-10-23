import type { Metadata } from 'next';
import Link from 'next/link';
import { changePasswordAction, claimDailyAction, recycleAction, signOutAction } from '@/app/actions';
import { Countdown } from '@/components/Countdown';
import { AccountForm, ActionButton } from '@/components/Forms';
import { Footer, Nav } from '@/components/Nav';
import { getDb } from '@/lib/db';
import { DAILY_BONUS, getDuplicates, getLedger, REASON_LABELS, recycleValue, SIGNUP_BONUS } from '@/lib/economy';
import { formatEntries, formatNumber } from '@/lib/format';
import { RARITIES_BY_VALUE, RARITIES } from '@/lib/rarity';
import { currentWallet } from '@/lib/session';
import styles from './compte.module.css';

export const metadata: Metadata = { title: 'Compte' };

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' });

/** Minuit (heure de Paris) suivant : quand la prime du jour revient. */
function nextParisMidnight(now: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000;
  return now - elapsed + 24 * 60 * 60 * 1000;
}

export default async function AccountPage() {
  const { player, stats, wallet } = await currentWallet();
  const db = getDb();
  const duplicates = player ? getDuplicates(db, player.id) : [];
  const dupCopies = duplicates.reduce((s, d) => s + d.extra, 0);
  const dupValue = duplicates.reduce((s, d) => s + d.value, 0);
  const ledger = player ? getLedger(db, player.id, 30) : [];
  const now = Date.now();

  return (
    <>
      <Nav wallet={wallet} current="/compte" />
      <main className="container">
        <header className={styles.header}>
          <div className={styles.who}>
            <span className="eyebrow">{player?.email ? player.email : player ? 'Partie invitée' : 'Visiteur'}</span>
            <h1 className="display">{player?.name ?? 'Votre compte'}</h1>
          </div>
          {player?.email ? (
            <form action={signOutAction}><button type="submit" className="btn btn-sm">Se déconnecter</button></form>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/inscription" className="btn btn-primary">Créer un compte · +{formatNumber(SIGNUP_BONUS)} tickets</Link>
              <Link href="/connexion" className="btn">Se connecter</Link>
            </div>
          )}
        </header>

        {!player?.email && (
          <p className="lead" style={{ marginBottom: 40, maxWidth: 680 }}>
            {player
              ? 'Vous jouez en invité : votre collection n’existe que dans ce navigateur. Créez un compte pour la garder et la retrouver partout.'
              : 'Ouvrez une bobine pour commencer une partie, ou connectez-vous pour retrouver la vôtre.'}
          </p>
        )}

        <div className={styles.grid}>
          <section className={`panel ${styles.box}`} aria-labelledby="daily">
            <span className="eyebrow">Chaque jour</span>
            <h2 id="daily" className="display">Prime du jour</h2>
            <p>{formatNumber(DAILY_BONUS)} tickets offerts chaque jour, à prendre avant minuit (heure de Paris).</p>
            {wallet.dailyAvailable ? (
              <ActionButton action={claimDailyAction} label={`Prendre ${formatNumber(DAILY_BONUS)} tickets`} className="btn btn-primary" />
            ) : (
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
                PRISE · LA PROCHAINE DANS <span style={{ color: 'var(--text)' }}><Countdown until={nextParisMidnight(now)} /></span>
              </span>
            )}
          </section>

          <section className={`panel ${styles.box}`} aria-labelledby="recycle">
            <span className="eyebrow">Doublons</span>
            <h2 id="recycle" className="display">Recyclage</h2>
            <p>
              Chaque carte garde son meilleur numéro de série ; les exemplaires en trop s’échangent contre des tickets.
            </p>
            <span className={styles.big}>{formatNumber(dupCopies)} doublon{dupCopies > 1 ? 's' : ''} · +{formatNumber(dupValue)} tickets</span>
            <ActionButton action={recycleAction} label="Recycler tous les doublons" disabled={dupCopies === 0} />
            <details>
              <summary className="mono" style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>BARÈME</summary>
              <ul className={styles.rates} style={{ marginTop: 12 }}>
                {RARITIES_BY_VALUE.map((r) => (
                  <li key={r} style={{ display: 'contents' }}>
                    <span>{RARITIES[r].label} <small style={{ color: 'var(--muted)' }}>({RARITIES[r].kind === 'actor' ? 'Acteur' : 'Rôle'})</small></span>
                    <span>{formatNumber(recycleValue(r))}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className={`panel ${styles.box}`} aria-labelledby="bo">
            <span className="eyebrow">Votre salle</span>
            <h2 id="bo" className="display">Box-office</h2>
            <span className={styles.big}>{formatEntries(stats?.entries ?? 0)} entrées</span>
            <p>
              {formatNumber(stats?.unique ?? 0)} cartes uniques, {formatNumber(stats?.copies ?? 0)} exemplaires,{' '}
              {formatNumber(stats?.pulls ?? 0)} bobine{(stats?.pulls ?? 0) > 1 ? 's' : ''} ouverte{(stats?.pulls ?? 0) > 1 ? 's' : ''}. {formatNumber(wallet.tickets)} tickets en poche.
            </p>
            <Link href="/collection" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>Voir la collection</Link>
          </section>
        </div>

        <section className={styles.section} aria-labelledby="history">
          <div className="section-head">
            <h2 id="history" className="display">Historique des tickets</h2>
            <span className="rule" />
          </div>
          {ledger.length === 0 ? (
            <p className="lead">Aucun mouvement pour l’instant.</p>
          ) : (
            <ul className={`panel ${styles.ledger}`} style={{ padding: '8px 24px' }}>
              {ledger.map((e) => (
                <li key={e.id}>
                  <span>{REASON_LABELS[e.reason]}{e.detail ? ` · ${e.detail}` : ''}</span>
                  <span className={e.amount > 0 ? styles.plus : styles.minus}>{e.amount > 0 ? '+' : '−'}{formatNumber(Math.abs(e.amount))}</span>
                  <small>{dateFormat.format(e.createdAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {player?.email && (
          <section className={styles.section} aria-labelledby="security">
            <div className="section-head">
              <h2 id="security" className="display">Mot de passe</h2>
              <span className="rule" />
            </div>
            <AccountForm
              action={changePasswordAction}
              submit="Changer le mot de passe"
              fields={[
                { name: 'current', label: 'Mot de passe actuel', type: 'password', autoComplete: 'current-password' },
                { name: 'next', label: 'Nouveau mot de passe', type: 'password', autoComplete: 'new-password', hint: '8 caractères minimum.', minLength: 8 },
              ]}
            />
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
