const regions = new Intl.DisplayNames(['fr'], { type: 'region' });
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

/** « 30 juillet 1948 » à partir de « 1948-07-30 ». */
export function formatDay(day: string | null | undefined): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return longDate.format(new Date(`${day}T00:00:00Z`));
}

/** Âge à une date donnée (aujourd'hui, ou la date du décès). */
export function age(birthday: string | null | undefined, until: string | null | undefined, now = new Date()): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const end = until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? new Date(`${until}T00:00:00Z`) : now;
  const start = new Date(`${birthday}T00:00:00Z`);
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  if (end.getUTCMonth() < start.getUTCMonth() || (end.getUTCMonth() === start.getUTCMonth() && end.getUTCDate() < start.getUTCDate())) years -= 1;
  return years;
}

/** Durée d'un film : « 2 h 32 ». */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
