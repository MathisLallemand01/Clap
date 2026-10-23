// Sons de la projection, synthétisés avec la Web Audio API (aucun fichier à charger).

const STORAGE_KEY = 'clap:sound';

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

export type Projector = {
  /** Clic d'obturateur, à chaque vignette révélée. */
  click(): void;
  /** Accroche de rareté : 1 = rare, 2 = très rare, 3 = Légende ou Icône. */
  sting(level: 1 | 2 | 3): void;
  /** Ronron du projecteur pendant que la bande avance. */
  hum(on: boolean): void;
  setEnabled(on: boolean): void;
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
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
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
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 140;
    band.Q.value = 0.8;
    // Battement à 24 Hz : le défilement des images.
    const flutter = c.createGain();
    flutter.gain.value = 0.5;
    const lfo = c.createOscillator();
    lfo.frequency.value = 24;
    const lfoDepth = c.createGain();
    lfoDepth.gain.value = 0.35;
    lfo.connect(lfoDepth).connect(flutter.gain);
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.25);
    src.connect(band).connect(flutter).connect(gain).connect(m);
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
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    setTimeout(stop, 400);
  }

  return {
    click() {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.06);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2200;
      const g = c.createGain();
      g.gain.setValueAtTime(0.5, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
      src.connect(hp).connect(g).connect(m);
      src.start();
    },
    sting(level) {
      const a = audio();
      if (!a) return;
      const { ctx: c, master: m } = a;
      // Légende / Icône : le projecteur se tait un instant avant l'accord.
      const delay = level === 3 ? 0.3 : 0;
      const notes = level === 1 ? [220] : level === 2 ? [220, 330] : [146.83, 220, 293.66, 440];
      const start = c.currentTime + delay;
      const length = level === 3 ? 2.2 : 0.9;
      for (const f of notes) {
        const osc = c.createOscillator();
        osc.type = level === 3 ? 'sawtooth' : 'triangle';
        osc.frequency.value = f;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = level === 3 ? 1800 : 900;
        const g = c.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.16 / notes.length + 0.04, start + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, start + length);
        osc.connect(lp).connect(g).connect(m);
        osc.start(start);
        osc.stop(start + length);
      }
      if (level === 3 && hum) {
        hum.gain.gain.setValueAtTime(0, c.currentTime);
        hum.gain.gain.linearRampToValueAtTime(0.18, c.currentTime + 1.2);
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
    dispose() {
      stopHum();
      void ctx?.close();
      ctx = null;
    },
  };
}
