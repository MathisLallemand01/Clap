import type { Metadata } from 'next';
import { BoosterTile } from '@/components/BoosterTile';
import { Countdown } from '@/components/Countdown';
import { Footer, Nav } from '@/components/Nav';
import { BOOSTERS, GROUP_LABELS, type BoosterGroup } from '@/lib/boosters';
import { currentWallet } from '@/lib/session';

export const metadata: Metadata = { title: 'Bobines' };

export default async function BoostersPage() {
  const { wallet } = await currentWallet();
  const groups = (Object.keys(GROUP_LABELS) as BoosterGroup[])
    .map((g) => ({ id: g, label: GROUP_LABELS[g], boosters: BOOSTERS.filter((b) => b.group === g) }))
    .filter((g) => g.boosters.length > 0);

  return (
    <>
      <Nav wallet={wallet} current="/bobines" />
      <main className="container" style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, paddingTop: 56 }}>
          <h1 className="display" style={{ fontSize: 'clamp(72px, 9vw, 132px)' }}>Bobines</h1>
          <div className="mono" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
            <span>
              <span style={{ color: 'var(--text)' }}>{wallet.freeStock}</span> BOBINE{wallet.freeStock > 1 ? 'S' : ''} OFFERTE{wallet.freeStock > 1 ? 'S' : ''}
            </span>
            {wallet.nextFreeAt && (
              <span>PROCHAINE DANS <span style={{ color: 'var(--text)' }}><Countdown until={wallet.nextFreeAt} /></span></span>
            )}
          </div>
        </header>
        {groups.map((g, i) => (
          <section key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="section-head">
              <span className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>{String(i + 1).padStart(2, '0')}</span>
              <h2 className="display">{g.label}</h2>
              <span className="rule" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {g.boosters.map((b) => <BoosterTile key={b.id} booster={b} free={wallet.freeStock > 0} />)}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
