import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GameCard } from '@/components/GameCard';
import { Mark } from '@/components/Mark';
import { getCatalog, showcase } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { AuthForm } from './AuthForm';
import styles from './connexion.module.css';

export const metadata: Metadata = { title: 'Connexion' };

const GOOGLE_ERRORS: Record<string, string> = {
  'google-config': 'La connexion Google n’est pas encore activée sur ce serveur : utilisez votre e-mail en attendant.',
  google: 'La connexion avec Google a échoué. Réessayez, ou utilisez votre e-mail.',
  discord: 'Aucun compte CLAP n’est lié à ce Discord. Connectez-vous d’abord, puis liez-le dans Paramètres.',
};

type Search = { mode?: string; suite?: string; parrain?: string; erreur?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const next = sp.suite?.startsWith('/') && !sp.suite.startsWith('//') ? sp.suite : '/bobines';
  if (await currentUser()) redirect(next);
  const referral = sp.parrain ?? (await cookies()).get('clap_ref')?.value ?? '';
  const mode = sp.mode === 'inscription' || referral ? 'inscription' : 'connexion';

  const db = getDb();
  const [icon] = showcase(db, { count: 1, kind: 'role', rarities: ['icone'] });
  const legends = showcase(db, { count: 2, kind: 'actor', rarities: ['legende'] });
  const fan = [legends[0], icon, legends[1]].filter(Boolean);
  const total = getCatalog(db).length;

  return (
    <main className={styles.screen}>
      <section className={styles.visual} aria-hidden="true">
        <Link href="/" className={styles.brand}>
          <Mark size={44} />
          <span className="display" style={{ fontSize: 34 }}>CLAP</span>
        </Link>
        <div className={styles.fan}>
          {fan.map((c, i) => (
            <div key={c.id} className={styles.fanCard} style={{ ['--i' as string]: i - 1 }}>
              <GameCard card={c} width={230} eager />
            </div>
          ))}
        </div>
        <div className={styles.tagline}>
          <h2 className="display">Le cinéma,<br /><span className="accent">carte</span> par carte.</h2>
          <span className="eyebrow">{formatNumber(total)} cartes · gratuit · sans achat · données TMDB</span>
        </div>
      </section>
      <section className={styles.panel}>
        <AuthForm mode={mode} next={next} referral={referral} googleError={sp.erreur ? (GOOGLE_ERRORS[sp.erreur] ?? GOOGLE_ERRORS.google) : null} />
      </section>
    </main>
  );
}
