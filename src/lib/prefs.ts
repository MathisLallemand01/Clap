// Préférences d'affichage gardées dans le navigateur (aucune donnée envoyée au serveur).

export type StripSpeed = 'normal' | 'rapide' | 'instant';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la préférence ne sera pas retenue.
  }
}

export function speedPreference(): StripSpeed {
  const v = read('clap:speed');
  return v === 'rapide' || v === 'instant' ? v : 'normal';
}
export const saveSpeedPreference = (v: StripSpeed) => write('clap:speed', v);

export function calmPreference(): boolean {
  return read('clap:calm') === 'on';
}
export const saveCalmPreference = (on: boolean) => write('clap:calm', on ? 'on' : 'off');
