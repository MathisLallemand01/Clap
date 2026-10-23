const nf = new Intl.NumberFormat('fr-FR');

export function formatNumber(n: number): string {
  return nf.format(n);
}

/** Entrées au format box-office : 2,41 M · 184 000 · 950. */
export function formatEntries(n: number): string {
  if (n >= 1_000_000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n / 1_000_000)} M`;
  }
  return nf.format(n);
}

/** Durée restante au format 02:14:09. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function formatSerial(n: number): string {
  return String(n).padStart(4, '0');
}
