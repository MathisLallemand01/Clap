import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer, Nav } from '@/components/Nav';
import { optionalContext } from '@/lib/session';
import styles from './not-found.module.css';

export const metadata: Metadata = { title: 'Scène introuvable' };

/** Adresse inconnue, carte ou acteur disparu : une page « coupé au montage » plutôt que l'écran blanc par défaut. */
export default async function NotFound() {
  const ctx = await optionalContext();
  return (
    <>
      <Nav ctx={ctx} />
      <main className={`container page ${styles.wrap}`}>
        <p className="slug">INT. SALLE DE MONTAGE — NUIT <span>ERREUR 404</span></p>
        <div className={styles.clap} aria-hidden="true">
          <span className={styles.top} />
          <span className={styles.board}><b>SCÈNE 404</b><i>PRISE —</i></span>
        </div>
        <h1 className="display h1">Coupé au<br /><span className="accent">montage.</span></h1>
        <p className="lead">Cette page n’existe pas, ou plus. Le lien est peut-être incomplet, ou la carte a quitté le catalogue.</p>
        <div className={styles.actions}>
          <Link href={ctx ? '/bobines' : '/'} className="btn btn-primary">{ctx ? 'Retour aux bobines' : 'Retour à l’accueil'}</Link>
          <Link href="/catalogue" className="btn">Parcourir le catalogue</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
