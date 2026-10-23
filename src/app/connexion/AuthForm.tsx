'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { DiscordLogo } from '@/components/DiscordLogo';
import { loginAction, signupAction, type AuthState } from './actions';
import styles from './connexion.module.css';

type Props = { mode: 'connexion' | 'inscription'; next: string; referral: string; googleError: string | null };

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );
}

export function AuthForm({ mode, next, referral, googleError }: Props) {
  const isSignup = mode === 'inscription';
  const [state, action, pending] = useActionState<AuthState, FormData>(isSignup ? signupAction : loginAction, {});
  const googleHref = `/api/auth/google?suite=${encodeURIComponent(next)}${referral ? `&parrain=${encodeURIComponent(referral)}` : ''}`;
  const switchHref = (m: string) => `/connexion?mode=${m}${next !== '/bobines' ? `&suite=${encodeURIComponent(next)}` : ''}${referral ? `&parrain=${encodeURIComponent(referral)}` : ''}`;

  return (
    <div className={styles.formWrap}>
      <div className="segmented" role="tablist" aria-label="Connexion ou inscription">
        <Link href={switchHref('connexion')} role="tab" aria-selected={!isSignup}>Se connecter</Link>
        <Link href={switchHref('inscription')} role="tab" aria-selected={isSignup}>Créer un compte</Link>
      </div>

      <div className={styles.title}>
        <h1 className="display">{isSignup ? <>Votre place<br />vous attend</> : <>Bon retour<br />en salle</>}</h1>
        <p>{isSignup ? 'Trois bobines offertes et 600 tickets pour commencer.' : 'Vos bobines vous attendent.'}</p>
      </div>

      <a href={googleHref} className={`btn btn-lg btn-block ${styles.google}`}>
        <GoogleLogo /> {isSignup ? 'S’inscrire avec Google' : 'Continuer avec Google'}
      </a>
      {!isSignup && (
        <a href={`/api/auth/discord?suite=${encodeURIComponent(next)}`} className={`btn btn-lg btn-block ${styles.discord}`}>
          <DiscordLogo /> Continuer avec Discord
        </a>
      )}
      {googleError && <p className="alert alert-info" role="status">{googleError}</p>}

      <div className={styles.or}><span />OU PAR E-MAIL<span /></div>

      <form action={action} className={styles.form}>
        <input type="hidden" name="suite" value={next} />
        {isSignup && (
          <label className="field">Pseudo
            <input className="input" name="name" required minLength={3} maxLength={20} autoComplete="username" defaultValue={state.fields?.name} placeholder="cinephile_92" />
          </label>
        )}
        <label className="field">E-mail
          <input className="input" name="email" type="email" required autoComplete="email" defaultValue={state.fields?.email} placeholder="vous@exemple.fr" />
        </label>
        <label className="field">
          <span className={styles.labelRow}>Mot de passe {isSignup && <small>8 caractères minimum</small>}</span>
          <input className="input" name="password" type="password" required minLength={isSignup ? 8 : 1} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="••••••••" />
        </label>
        {isSignup && (
          <label className="field">
            <span className={styles.labelRow}>Code de parrainage <small>facultatif</small></span>
            <input className="input" name="referral" defaultValue={state.fields?.referral ?? referral} placeholder="JD-7K4Q" autoCapitalize="characters" />
          </label>
        )}
        {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
          {pending ? 'Un instant…' : isSignup ? 'Créer mon compte' : 'Entrer en salle'}
        </button>
      </form>

      <p className={styles.switch}>
        {isSignup ? <>Déjà un compte ? <Link href={switchHref('connexion')}>Se connecter</Link></> : <>Pas encore de compte ? <Link href={switchHref('inscription')}>Créer un compte</Link></>}
      </p>
    </div>
  );
}
