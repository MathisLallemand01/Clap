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
  /** Papier qui se déchire, en continu pendant le geste : `speed` (0 à 1) monte le grain et le volume. */
  tear(speed: number): void;
  /** Fin du geste : arraché (true) ou relâché trop tôt (false, petit froissement). */
  tearEnd(done: boolean): void;
  /** Le paquet s'ouvre : pop de carton, souffle et accord grave qui monte. */
  pop(): void;
  /** Une carte se retourne : claquement + une note qui monte à chaque carte (`step` 0, 1, 2…). */
  flip(step: number, tier: number): void;
  /** La carte part se ranger : léger glissement. */
  slide(): void;
  /** Suspense d'une carte rare qu'on maintient : roulement de cordes qui monte. Renvoie de quoi l'arrêter. */
  rise(ms: number, tier: number): () => void;
  /** Frappe orchestrale + scintillement, au retournement d'une carte rare (cran 4 à 6). */
  hit(tier: number): void;
  /** Petite fanfare du générique de fin. */
  fanfare(): void;
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

  /** Une note douce (attaque courte, extinction exponentielle) passée dans un passe-bas. */
  function note(c: AudioContext, m: AudioNode, f: number, at: number, len: number, level: number, type: OscillatorType = 'sine', cutoff = 2400) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0006, at + len);
    osc.connect(lp).connect(g).connect(m);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }

  /** Un souffle de bruit filtré (froissement, glissement, souffle). */
  function breath(c: AudioContext, m: AudioNode, at: number, len: number, level: number, from: number, to: number, q = 0.8) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, len + 0.05);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(from, at);
    bp.frequency.exponentialRampToValueAtTime(to, at + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + Math.min(0.04, len / 3));
    g.gain.exponentialRampToValueAtTime(0.0006, at + len);
    src.connect(bp).connect(g).connect(m);
    src.start(at);
  }

  // Déchirure continue : une source de bruit en boucle, dont le filtre et le volume suivent la vitesse du geste.
  let tearing: { src: AudioBufferSourceNode; bp: BiquadFilterNode; crackle: GainNode; gain: GainNode } | null = null;

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
    tear(speed) {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      if (!tearing) {
        const src = c.createBufferSource();
        // Bruit « granuleux » : des impulsions éparses, comme des fibres de papier qui cèdent.
        const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.18 ? 1 : 0.25);
        src.buffer = buffer;
        src.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.7;
        bp.frequency.value = 1200;
        const crackle = c.createGain();
        crackle.gain.value = 1;
        const gain = c.createGain();
        gain.gain.value = 0;
        src.connect(bp).connect(crackle).connect(gain).connect(m);
        src.start();
        tearing = { src, bp, crackle, gain };
      }
      const v = Math.min(1, Math.max(0, speed));
      tearing.bp.frequency.setTargetAtTime(900 + v * 2600, c.currentTime, 0.03);
      tearing.gain.gain.setTargetAtTime(v < 0.02 ? 0 : 0.05 + v * 0.16, c.currentTime, 0.03);
    },
    tearEnd(done) {
      if (tearing && ctx) {
        const t = tearing;
        tearing = null;
        t.gain.gain.cancelScheduledValues(ctx.currentTime);
        t.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
        setTimeout(() => t.src.stop(), 300);
      }
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const t = c.currentTime;
      if (done) {
        // Le dernier morceau qui cède : un « scratch » sec et aigu.
        breath(c, m, t, 0.16, 0.2, 2600, 5200, 1.2);
      } else {
        // La bande se recolle : un petit froissement grave.
        breath(c, m, t, 0.22, 0.07, 700, 380, 0.9);
      }
    },
    pop() {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const t = c.currentTime + 0.05;
      // Pop de carton : une note grave qui tombe vite + un claquement.
      const osc = c.createOscillator();
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g).connect(m);
      osc.start(t);
      osc.stop(t + 0.2);
      breath(c, m, t, 0.08, 0.16, 1400, 900, 1.5);
      // Souffle d'air qui sort du paquet, puis un accord grave qui monte (la pile arrive).
      breath(c, m, t + 0.04, 0.7, 0.08, 300, 1800, 0.6);
      for (const [i, f] of [110, 164.81, 220, 277.18].entries()) note(c, m, f, t + 0.12 + i * 0.07, 1.4, 0.05, i ? 'sine' : 'triangle', 1200);
    },
    flip(step, tier) {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const t = c.currentTime;
      // Claquement de carte : bruit très court et brillant, puis le « tac » de la carte qui retombe.
      breath(c, m, t, 0.05, 0.22, 3200, 1800, 1.4);
      breath(c, m, t + 0.07, 0.04, 0.12, 1200, 700, 2);
      // Une note qui monte à chaque carte (gamme pentatonique), plus riche si la carte est rare.
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
      const f = scale[Math.min(scale.length - 1, step)];
      note(c, m, f, t + 0.05, 0.5, 0.06, 'triangle', 3000);
      if (tier >= 2) note(c, m, f * 1.5, t + 0.09, 0.6, 0.035, 'sine');
      if (tier >= 3) {
        note(c, m, f * 2, t + 0.13, 0.9, 0.03, 'sine');
        for (const k of [1, 1.25, 1.5]) note(c, m, f / 2 * k, t + 0.06, 1.1, 0.03, 'sine', 1600);
      }
    },
    slide() {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      breath(c, m, c.currentTime, 0.28, 0.045, 1800, 600, 0.7);
    },
    rise(ms, tier) {
      const a = audio();
      if (!a) return () => {};
      const { ctx: c, master: m } = a;
      const t = c.currentTime;
      const len = ms / 1000;
      // Roulement de cordes : quelques dents de scie désaccordées, passe-bas qui s'ouvre, trémolo qui accélère.
      const root = tier >= 6 ? 73.42 : tier >= 5 ? 98 : 110;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(380, t);
      lp.frequency.exponentialRampToValueAtTime(2200, t + len);
      const trem = c.createGain();
      trem.gain.value = 0.6;
      const lfo = c.createOscillator();
      lfo.frequency.setValueAtTime(7, t);
      lfo.frequency.linearRampToValueAtTime(15, t + len);
      const depth = c.createGain();
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(trem.gain);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + len);
      lp.connect(trem).connect(g).connect(m);
      const oscs = [1, 1.5, 2, 2.004, 3].map((k, i) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(root * k, t);
        // Le tout monte d'un ton pendant l'attente.
        o.frequency.exponentialRampToValueAtTime(root * k * 1.122, t + len);
        o.detune.value = (i - 2) * 6;
        o.connect(lp);
        o.start(t);
        return o;
      });
      lfo.start(t);
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        const now = c.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + 0.12);
        for (const o of oscs) o.stop(now + 0.15);
        lfo.stop(now + 0.15);
      };
    },
    hit(tier) {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const t = c.currentTime;
      // Frappe orchestrale : basse + accord cuivré (dents de scie filtrées) + timbale.
      const chord = tier >= 6 ? [73.42, 146.83, 220, 277.18, 369.99, 440] : tier >= 5 ? [98, 196, 246.94, 293.66, 392] : [110, 220, 277.18, 329.63];
      for (const f of chord) note(c, m, f, t, tier >= 5 ? 2.6 : 1.6, 0.07 / Math.sqrt(chord.length) * 2, 'sawtooth', 1500);
      const kick = c.createOscillator();
      kick.frequency.setValueAtTime(120, t);
      kick.frequency.exponentialRampToValueAtTime(42, t + 0.3);
      const kg = c.createGain();
      kg.gain.setValueAtTime(0.3, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      kick.connect(kg).connect(m);
      kick.start(t);
      kick.stop(t + 0.55);
      breath(c, m, t, 0.5, 0.06, 5000, 2500, 0.5);
      // Scintillement : petites notes aiguës qui tombent en cascade.
      const sparkle = [2093, 2637, 3136, 2349, 2794, 3520, 2637, 3951];
      const count = tier >= 6 ? 8 : tier >= 5 ? 6 : 4;
      for (let i = 0; i < count; i++) note(c, m, sparkle[i], t + 0.18 + i * 0.07, 0.6, 0.022, 'sine', 6000);
    },
    fanfare() {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const t = c.currentTime + 0.05;
      const line = [392, 523.25, 659.25, 783.99];
      line.forEach((f, i) => note(c, m, f, t + i * 0.09, i === line.length - 1 ? 1.2 : 0.3, 0.05, 'square', 1800));
      for (const f of [261.63, 329.63, 392]) note(c, m, f, t + 0.27, 1.3, 0.035, 'triangle', 1600);
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
      if (tearing) {
        tearing.src.stop();
        tearing = null;
      }
      void ctx?.close();
      ctx = null;
    },
  };
}
