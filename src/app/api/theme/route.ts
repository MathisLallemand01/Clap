import { NextResponse, type NextRequest } from 'next/server';
import { getCard } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { themeFor, type Theme } from '@/lib/themes';

type Preview = { url: string; link: string | null };
const DAY = 86_400_000;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Extrait officiel de 30 s dans le catalogue public d'Apple (iTunes Search), avec le lien vers le titre. */
async function fromItunes(t: Theme): Promise<Preview | null> {
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({ term: `${t.song} ${t.artist}`, entity: 'song', limit: '10', country: 'FR' }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const { results } = (await res.json()) as { results: { trackName: string; artistName: string; previewUrl?: string; trackViewUrl?: string }[] };
  const song = norm(t.song);
  const withPreview = results.filter((r) => r.previewUrl);
  const best = withPreview.find((r) => norm(r.trackName).startsWith(song)) ?? withPreview.find((r) => norm(r.trackName).includes(song.split(' ')[0])) ?? null;
  return best ? { url: best.previewUrl!, link: best.trackViewUrl ?? null } : null;
}

/** Repli : l'extrait de 30 s de Deezer. */
async function fromDeezer(t: Theme): Promise<Preview | null> {
  const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`track:"${t.song}" artist:"${t.artist}"`)}&limit=5`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const { data } = (await res.json()) as { data?: { preview?: string; link?: string }[] };
  const best = data?.find((d) => d.preview);
  return best ? { url: best.preview!, link: best.link ?? null } : null;
}

/** GET /api/theme?card=<id> : la musique culte d'une carte, si elle en a une. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('card') ?? '';
  const db = getDb();
  const card = getCard(db, id);
  const theme = card && themeFor(card);
  if (!theme) return NextResponse.json({ theme: null });
  const key = `${theme.song}|${theme.artist}`;
  const cached = db.prepare('SELECT url, link, fetched_at FROM theme_previews WHERE key = ?').get(key) as { url: string; link: string | null; fetched_at: number } | undefined;
  let preview: Preview | null = cached ? { url: cached.url, link: cached.link } : null;
  // Rien trouvé la dernière fois : on retente au bout d'un jour. Un extrait trouvé est gardé 30 jours.
  if (!cached || Date.now() - cached.fetched_at > (cached.url ? 30 * DAY : DAY)) {
    try {
      preview = (await fromItunes(theme).catch(() => null)) ?? (await fromDeezer(theme).catch(() => null));
      db.prepare('INSERT INTO theme_previews (key, url, link, fetched_at) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET url = excluded.url, link = excluded.link, fetched_at = excluded.fetched_at')
        .run(key, preview?.url ?? '', preview?.link ?? null, Date.now());
    } catch {
      preview = null;
    }
  }
  return NextResponse.json({ theme: { ...theme, url: preview?.url || null, link: preview?.link ?? null } });
}
