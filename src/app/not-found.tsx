import Link from 'next/link';
import { Footer, Nav } from '@/components/Nav';
import { currentWallet } from '@/lib/session';

export default async function NotFound() {
  const { wallet } = await currentWallet();
  return (
    <>
      <Nav wallet={wallet} />
      <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, paddingTop: 96 }}>
        <span className="eyebrow">Erreur 404</span>
        <h1 className="display" style={{ fontSize: 'clamp(72px, 9vw, 132px)' }}>Coupez !</h1>
        <p className="lead">Cette scène n’existe pas, ou la carte a quitté le catalogue.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn-primary">Retour à l’accueil</Link>
          <Link href="/catalogue" className="btn">Le catalogue</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
