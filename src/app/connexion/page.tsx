import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signInAction } from '@/app/actions';
import { AccountForm, AuthSwitch } from '@/components/Forms';
import { Footer, Nav } from '@/components/Nav';
import { formatNumber } from '@/lib/format';
import { currentWallet } from '@/lib/session';
import styles from '../auth.module.css';

export const metadata: Metadata = { title: 'Connexion' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const { player, stats, wallet } = await currentWallet();
  if (player?.email) redirect('/compte');

  return (
    <>
      <Nav wallet={wallet} />
      <main className={`container ${styles.page}`}>
        <div className={styles.intro}>
          <span className="eyebrow">Bon retour</span>
          <h1 className="display">Connexion</h1>
          <p className="lead">Retrouvez votre collection, vos tickets et vos bobines offertes.</p>
        </div>
        <div className={`panel ${styles.card}`}>
          {stats && stats.copies > 0 && (
            <p className={styles.note}>
              Vous jouez en invité avec <strong>{formatNumber(stats.copies)} cartes</strong>. Elles restent sur cette partie invitée :
              pour les garder, <Link href="/inscription" style={{ textDecoration: 'underline' }}>créez plutôt un compte</Link>.
            </p>
          )}
          <AccountForm
            action={signInAction}
            next={suite}
            submit="Se connecter"
            fields={[
              { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' },
              { name: 'password', label: 'Mot de passe', type: 'password', autoComplete: 'current-password' },
            ]}
            footer={<AuthSwitch text="Pas encore de compte ?" href={suite ? `/inscription?suite=${encodeURIComponent(suite)}` : '/inscription'} label="Créer un compte" />}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
