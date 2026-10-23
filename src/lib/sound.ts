// Sons de la projection, synthétisés avec la Web Audio API (aucun fichier à charger).
// Tout est volontairement feutré : filtres passe-bas, attaques douces, volume modéré.

const STORAGE_KEY = 'clap:sound';
const VOLUME_KEY = 'clap:volume';
/** Volume de départ : modéré. Réglable dans la projection et dans les paramètres. */
const DEFAULT_VOLUME = 0.3;
/** Gain maximal des sons synthétisés (à volume 100 %). */
const SFX_GAIN = 0.32;

export function soundPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSoundPreference(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Stockage indisponible (navigation privée) : la préférence ne sera simplement pas retenue.
  }
}

/** Volume choisi dans les paramètres, de 0 à 1. */
export function volumePreference(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function saveVolumePreference(v: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, v))));
  } catch {
    // Voir saveSoundPreference.
  }
}

/**
 * Le volume perçu suit une courbe : à 30 % du curseur, on entend environ 15 % de la puissance.
 * Ça rend le bas du curseur utilisable (un réglage linéaire saute de « trop fort » à « muet »).
 */
export function loudness(v: number): number {
  return Math.pow(Math.min(1, Math.max(0, v)), 1.6);
}

export type Projector = {
  /** Clic d'obturateur, à chaque vignette révélée. */
  click(): void;
  /** Accroche de rareté : 1 = rare, 2 = très rare, 3 = Légende ou Icône. */
  sting(level: 1 | 2 | 3): void;
  /** Pièces qui tombent dans la caisse : récompense de mission (plus le gain est gros, plus il y en a). */
  coins(count: number): void;
  /** Déchirure du paquet, au début de l'ouverture. */
  rip(): void;
  /** Ronron du projecteur pendant que la bande avance. */
  hum(on: boolean): void;
  setEnabled(on: boolean): void;
  /** Change le volume (0 à 1) en direct. */
  setVolume(v: number): void;
  dispose(): void;
};

export function createProjector(enabled: boolean): Projector {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let hum: { gain: GainNode; stop: () => void } | null = null;
  let on = enabled;

  function audio(): { ctx: AudioContext; master: GainNode } | null {
    if (!on) return null;
    if (!ctx) {
      ctx = new AudioContext();
      // Un compresseur doux évite tout pic désagréable quand les sons se superposent.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = SFX_GAIN * Math.max(0.08, Math.sqrt(loudness(volumePreference())));
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ctx, master: master! };
  }

  function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function startHum() {
    const a = audio();
    if (!a || hum) return;
    const { ctx: c, master: m } = a;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 2);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    // Léger battement à 24 Hz : le défilement des images.
    const flutter = c.createGain();
    flutter.gain.value = 0.7;
    const lfo = c.createOscillator();
    lfo.frequency.value = 24;
    const lfoDepth = c.createGain();
    lfoDepth.gain.value = 0.2;
    lfo.connect(lfoDepth).connect(flutter.gain);
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.4);
    src.connect(lp).connect(flutter).connect(gain).connect(m);
    src.start();
    lfo.start();
    hum = { gain, stop: () => { src.stop(); lfo.stop(); } };
  }

  function stopHum() {
    if (!ctx || !hum) return;
    const { gain, stop } = hum;
    hum = null;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    setTimeout(stop, 500);
  }

  return {
    click() {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const t = c.currentTime;
      // Un « toc » mat : bruit court très filtré + une petite note grave.
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.05);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 1.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(bp).connect(g).connect(m);
      src.start(t);
      const thump = c.createOscillator();
      thump.frequency.setValueAtTime(160, t);
      thump.frequency.exponentialRampToValueAtTime(70, t + 0.06);
      const tg = c.createGain();
      tg.gain.setValueAtTime(0.12, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      thump.connect(tg).connect(m);
      thump.start(t);
      thump.stop(t + 0.1);
    },
    rip() {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.5);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(500, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      src.connect(bp).connect(g).connect(m);
      src.start(t);
    },
    sting(level) {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      // Légende / Icône : le projecteur s'efface un instant avant l'accord.
      const delay = level === 3 ? 0.3 : 0.05;
      const notes = level === 1 ? [293.66, 440] : level === 2 ? [261.63, 392, 523.25] : [196, 293.66, 392, 587.33];
      const start = c.currentTime + delay;
      const length = level === 3 ? 2.4 : 1.2;
      for (const [i, f] of notes.entries()) {
        const osc = c.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        const g = c.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.09 / Math.sqrt(notes.length), start + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0008, start + length);
        osc.connect(lp).connect(g).connect(m);
        osc.start(start);
        osc.stop(start + length + 0.05);
      }
      if (level === 3 && hum) {
        hum.gain.gain.setValueAtTime(0, c.currentTime);
        hum.gain.gain.linearRampToValueAtTime(0.07, c.currentTime + 1.6);
      }
    },
    coins(count) {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const n = Math.max(3, Math.min(10, count));
      for (let i = 0; i < n; i++) {
        const t = c.currentTime + 0.05 + i * 0.075;
        for (const f of [1318.5 * (1 + (i % 3) * 0.06), 1975.5]) {
          const osc = c.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t);
          const g = c.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.05, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0006, t + 0.22);
          osc.connect(g).connect(m);
          osc.start(t);
          osc.stop(t + 0.25);
        }
      }
    },
    hum(play) {
      if (play) startHum();
      else stopHum();
    },
    setEnabled(next) {
      on = next;
      if (!next) stopHum();
    },
    setVolume(v) {
      if (master && ctx) master.gain.setTargetAtTime(SFX_GAIN * Math.max(0.08, Math.sqrt(loudness(v))), ctx.currentTime, 0.05);
    },
    dispose() {
      stopHum();
      void ctx?.close();
      ctx = null;
    },
  };
}
