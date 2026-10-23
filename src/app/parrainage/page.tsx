import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Footer, Nav } from '@/components/Nav';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { REFERRAL_PULLS, REFERRAL_REWARD } from '@/lib/game';
import { requireContext } from '@/lib/session';
import { listReferrals } from '@/lib/social';
import { CopyButton } from './CopyButton';
import styles from './parrainage.module.css';

export const metadata: Metadata = { title: 'Parrainage' };

const TIERS = [
  { n: 1, title: '1 ami', reward: `${REFERRAL_REWARD} tickets pour vous et pour lui, à chaque ami.` },
  { n: 3, title: '3 amis', reward: '+1 200 tickets : de quoi ouvrir une bobine Personnages iconiques.' },
  { n: 5, title: '5 amis', reward: '+2 000 tickets bonus.' },
  { n: 10, title: '10 amis', reward: 'Une carte Rôle Chef-d’œuvre offerte.' },
];

export default async function ReferralPage() {
  const ctx = await requireContext('/parrainage');
  const referrals = listReferrals(getDb(), ctx.user.id);
  const validated = referrals.filter((r) => r.rewarded).length;
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const link = `${origin}/i/${ctx.user.referralCode}`;
  const nextTier = TIERS.find((t) => t.n > validated);

  return (
    <>
      <Nav ctx={ctx} />
      <main className="container page">
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Parrainage</span>
            <h1 className="display h1">Invitez vos amis<br />au cinéma</h1>
            <p className="lead">Chaque ami qui s’inscrit avec votre code et ouvre ses {REFERRAL_PULLS} premières bobines vous rapporte {formatNumber(REFERRAL_REWARD)} tickets, et lui en reçoit autant pour démarrer.</p>
          </div>
          <div className={styles.codeCard}>
            <span className="eyebrow">Votre code</span>
            <div className={styles.ticket}>
              <span className="display">{ctx.user.referralCode}</span>
              <span className={styles.cut} />
              <CopyButton value={ctx.user.referralCode} label="Copier" className={styles.copyCode} />
            </div>
            <div className={styles.linkRow}>
              <code>{link}</code>
              <CopyButton value={link} label="Copier le lien" className="btn btn-sm" share />
            </div>
          </div>
        </section>

        <section className={`tile ${styles.tiers}`}>
          <div className={styles.tiersHead}>
            <h2 className="display h2">Paliers</h2>
            <span className="eyebrow"><b style={{ color: 'var(--text)' }}>{validated}</b> ami{validated > 1 ? 's' : ''} parrainé{validated > 1 ? 's' : ''}{nextTier ? ` · prochain palier à ${nextTier.n}` : ''}</span>
          </div>
          <div className={styles.track}>
            <div className={styles.trackBar}><span style={{ width: `${Math.min(100, (validated / 10) * 100)}%` }} /></div>
            <ol className={styles.tierList}>
              {TIERS.map((t) => {
                const state = validated >= t.n ? 'done' : t === nextTier ? 'next' : 'todo';
                return (
                  <li key={t.n} data-state={state}>
                    <span className={styles.node} />
                    <strong className="display">{t.title}</strong>
                    <span>{t.reward}</span>
                    <small>{state === 'done' ? 'OBTENU' : state === 'next' ? 'PROCHAIN PALIER' : 'À DÉBLOQUER'}</small>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className={styles.list}>
          <h2 className="display h3">Vos filleuls</h2>
          {referrals.length === 0 ? (
            <p className="alert alert-info">Personne pour l’instant. Partagez votre lien : l’inscription prend vingt secondes.</p>
          ) : (
            <ul>
              {referrals.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong>
                  <span className={styles.steps} aria-label={`${Math.min(r.pulls, REFERRAL_PULLS)} bobines ouvertes sur ${REFERRAL_PULLS}`}>
                    {Array.from({ length: REFERRAL_PULLS }, (_, i) => <span key={i} className={i < r.pulls ? styles.stepOn : ''} />)}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: r.rewarded ? 'var(--ok)' : 'var(--muted)' }}>
                    {r.rewarded ? `VALIDÉ · +${REFERRAL_REWARD} TK` : `${Math.min(r.pulls, REFERRAL_PULLS)} / ${REFERRAL_PULLS} BOBINES`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
