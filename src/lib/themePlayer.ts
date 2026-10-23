'use client';

/** La musique culte d'une carte, avec son extrait (url) quand on l'a trouvé. */
export type ThemeInfo = { song: string; artist: string; url: string | null; link: string | null };

const cache = new Map<string, Promise<ThemeInfo | null>>();

/** Cherche (une seule fois par carte) la musique culte et son extrait. */
export function loadTheme(cardId: string): Promise<ThemeInfo | null> {
  let p = cache.get(cardId);
  if (!p) {
    p = fetch(`/api/theme?card=${encodeURIComponent(cardId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ theme: ThemeInfo | null }>) : { theme: null }))
      .then((d) => d.theme)
      .catch(() => null);
    cache.set(cardId, p);
  }
  return p;
}

const VOLUME = 0.55;

/**
 * Joue un extrait à la fois : fondu d'entrée, puis fondu de sortie avant la fin de l'extrait (30 s)
 * ou quand on en lance un autre, qu'on coupe le son ou qu'on quitte la projection.
 */
export function createThemePlayer(onChange: (playing: ThemeInfo | null) => void) {
  let audio: HTMLAudioElement | null = null;
  let stopTimer = 0;
  // Un fondu par extrait : celui qui s'éteint et celui qui démarre ne se gênent pas.
  const fades = new WeakMap<HTMLAudioElement, number>();

  const ramp = (el: HTMLAudioElement, to: number, ms: number, done?: () => void) => {
    cancelAnimationFrame(fades.get(el) ?? 0);
    const from = el.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = ms > 0 ? Math.min(1, (now - start) / ms) : 1;
      el.volume = Math.min(1, Math.max(0, from + (to - from) * t));
      if (t < 1) fades.set(el, requestAnimationFrame(step));
      else done?.();
    };
    fades.set(el, requestAnimationFrame(step));
  };

  const stop = (ms = 700) => {
    window.clearTimeout(stopTimer);
    const el = audio;
    audio = null;
    onChange(null);
    if (!el) return;
    ramp(el, 0, ms, () => { el.pause(); el.src = ''; });
  };

  const play = (theme: ThemeInfo) => {
    if (!theme.url) return;
    stop(300);
    const el = new Audio(theme.url);
    el.volume = 0;
    audio = el;
    el.addEventListener('ended', () => { if (audio === el) stop(0); });
    void el.play().then(() => {
      if (audio !== el) return;
      onChange(theme);
      ramp(el, VOLUME, 900);
      stopTimer = window.setTimeout(() => { if (audio === el) stop(1500); }, 26_000);
    }).catch(() => { if (audio === el) audio = null; });
  };

  return { play, stop, dispose: () => stop(0) };
}
