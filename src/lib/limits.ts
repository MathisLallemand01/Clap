// Constantes partagées entre le serveur et les pages (sans accès à la base).

/** Nombre maximal de bobines ouvertes d'un coup (« Tout ouvrir »). */
export const MAX_OPEN_AT_ONCE = 50;

/** Combien de bobines on peut ouvrir d'un coup : la réserve offerte, puis ce que les tickets paient. */
export function affordable(wallet: { freeStock: number; tickets: number; unlimited: boolean }, price: number): number {
  if (wallet.unlimited) return MAX_OPEN_AT_ONCE;
  return Math.max(0, Math.min(MAX_OPEN_AT_ONCE, wallet.freeStock + Math.floor(wallet.tickets / Math.max(1, price))));
}
