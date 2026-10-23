import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer, Nav } from '@/components/Nav';
import { NOTIFY_KINDS } from '@/lib/notify';
import { requireContext } from '@/lib/session';
import { logout } from '../actions';
import { removeAccount, saveAccount, saveNotifications } from './actions';
import { PlayPrefs } from './PlayPrefs';
import styles from './parametres.module.css';

export const metadata: Metadata = { title: 'Paramètres' };

const OK: Record<string, string> = { compte: 'Compte enregistré.', notifications: 'Préférences de notification enregistrées.' };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string; supprimer?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext('/parametres');
  const u = ctx.user;

  return (
    <>
      <Nav ctx={ctx} />
      <main className="container page">
        <header className="page-head">
          <h1 className="display h1">Paramètres</h1>
          <div className="meta"><span>CONNECTÉ EN TANT QUE <b>{ctx.user.name}</b></span></div>
        </header>
        <div className={styles.layout}>
          <aside className={styles.menu}>
            <nav aria-label="Sections">
              <a href="#jeu">Son &amp; animations</a>
              <a href="#notifications">Notifications</a>
              <a href="#compte">Compte</a>
              <Link href="/parrainage">Parrainage</Link>
            </nav>
            <form action={logout}><button type="submit" className="btn btn-sm btn-block">Se déconnecter</button></form>
          </aside>

          <div className={styles.sections}>
            {sp.ok && OK[sp.ok] && <p className="alert alert-ok" role="status">{OK[sp.ok]}</p>}
            {sp.erreur && !sp.supprimer && <p className="alert alert-error" role="alert">{sp.erreur}</p>}

            <section id="jeu" className={styles.section}>
              <h2 className="display">Son &amp; animations</h2>
              <PlayPrefs />
            </section>

            <section id="notifications" className={styles.section}>
              <h2 className="display">Notifications</h2>
              <form action={saveNotifications} className={styles.rows}>
                {NOTIFY_KINDS.map((k) => (
                  <label key={k.kind} className={styles.row}>
                    <div><strong>{k.label}</strong><span>{k.hint}</span></div>
                    <input type="checkbox" name={k.kind} defaultChecked={u.notify[k.kind] !== false} className={styles.check} />
                  </label>
                ))}
                <div className={styles.saveRow}><button type="submit" className="btn btn-sm btn-light">Enregistrer</button></div>
              </form>
            </section>

            <section id="compte" className={styles.section}>
              <h2 className="display">Compte</h2>
              <form action={saveAccount} className={styles.rows}>
                <label className={styles.row}>
                  <div><strong>Pseudo</strong><span>Visible par vos amis ; c’est avec lui qu’on vous ajoute.</span></div>
                  <input className="input" name="name" defaultValue={u.name} minLength={3} maxLength={20} required style={{ maxWidth: 260 }} />
                </label>
                <div className={styles.row}>
                  <div><strong>E-mail</strong><span>{u.hasPassword ? 'Pour vous connecter.' : 'Compte relié à Google.'}</span></div>
                  <span className="mono" style={{ fontSize: 14 }}>{u.email ?? '—'}</span>
                </div>
                <label className={styles.row}>
                  <div><strong>Profil public</strong><span>Vos amis peuvent voir votre collection pour vous proposer des échanges.</span></div>
                  <input type="checkbox" name="public" defaultChecked={u.publicProfile} className={styles.check} />
                </label>
                <div className={styles.saveRow}><button type="submit" className="btn btn-sm btn-light">Enregistrer</button></div>
              </form>
              <div className={`${styles.row} ${styles.danger}`}>
                <div><strong>Supprimer le compte</strong><span>Votre collection, vos tickets et vos échanges seront effacés pour toujours.</span></div>
                <Link href="/parametres?supprimer=1#compte" className="btn btn-sm btn-danger">Supprimer</Link>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />

      {sp.supprimer && (
        <div className="modal-backdrop">
          <form action={removeAccount} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="del-title">
            <h2 id="del-title" className="display">Supprimer<br />le compte ?</h2>
            <p style={{ margin: 0, color: 'var(--text-2)' }}>C’est définitif. Pour confirmer, tapez votre pseudo : <b style={{ color: 'var(--text)' }}>{u.name}</b></p>
            {sp.erreur && <p className="alert alert-error" role="alert">{sp.erreur}</p>}
            <input className="input" name="confirm" autoComplete="off" aria-label="Votre pseudo" />
            <div className="actions">
              <Link href="/parametres#compte" className="btn">Annuler</Link>
              <button type="submit" className="btn btn-danger">Supprimer définitivement</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
