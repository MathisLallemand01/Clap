import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signUpAction } from '@/app/actions';
import { AccountForm, AuthSwitch } from '@/components/Forms';
import { Footer, Nav } from '@/components/Nav';
import { SIGNUP_BONUS } from '@/lib/economy';
import { formatNumber } from '@/lib/format';
import { currentWallet } from '@/lib/session';
import styles from '../auth.module.css';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const { player, stats, wallet } = await currentWallet();
  if (player?.email) redirect('/compte');

  return (
    <>
      <Nav wallet={wallet} />
      <main className={`container ${styles.page}`}>
        <div className={styles.intro}>
          <span className="eyebrow">Compte gratuit</span>
          <h1 className="display">Gardez votre collection</h1>
          <p className="lead">Un compte garde vos cartes à l’abri et vous suit sur tous vos appareils.</p>
          <ul className={styles.perks}>
            <li>{formatNumber(SIGNUP_BONUS)} tickets de bienvenue</li>
            <li>Votre collection sur téléphone et ordinateur</li>
            <li>Aucun achat, aucune donnée revendue</li>
          </ul>
        </div>
        <div className={`panel ${styles.card}`}>
          {stats && stats.copies > 0 && (
            <p className={styles.note}>
              Votre partie en cours (<strong>{formatNumber(stats.copies)} cartes</strong>, {formatNumber(wallet.tickets)} tickets) sera rattachée à ce compte.
            </p>
          )}
          <AccountForm
            action={signUpAction}
            next={suite}
            submit="Créer mon compte"
            fields={[
              { name: 'name', label: 'Pseudo', type: 'text', autoComplete: 'nickname', hint: 'Visible par les autres joueurs. 2 à 24 caractères.' },
              { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' },
              { name: 'password', label: 'Mot de passe', type: 'password', autoComplete: 'new-password', hint: '8 caractères minimum.', minLength: 8 },
            ]}
            footer={<AuthSwitch text="Déjà un compte ?" href={suite ? `/connexion?suite=${encodeURIComponent(suite)}` : '/connexion'} label="Se connecter" />}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
