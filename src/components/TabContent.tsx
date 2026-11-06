import { ViewTransition } from 'react';

/** Contenu d'un onglet : quand l'onglet change (`tab`), l'ancien contenu s'efface en fondu au profit du nouveau. */
export function TabContent({ tab, name = 'tab-content', children }: { tab: string; name?: string; children: React.ReactNode }) {
  return (
    <ViewTransition key={tab} name={name} share="auto" enter="auto" default="none">
      <div className="tab-content">{children}</div>
    </ViewTransition>
  );
}
