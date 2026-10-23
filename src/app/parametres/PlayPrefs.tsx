'use client';

import { useEffect, useState } from 'react';
import { saveSoundPreference, saveVolumePreference, soundPreference, volumePreference } from '@/lib/sound';
import { calmPreference, saveCalmPreference, saveSpeedPreference, speedPreference, type StripSpeed } from '@/lib/prefs';
import styles from './parametres.module.css';

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={styles.switch} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

/** Préférences de jeu, gardées dans ce navigateur. */
export function PlayPrefs() {
  const [ready, setReady] = useState(false);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [speed, setSpeed] = useState<StripSpeed>('normal');
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    setSound(soundPreference());
    setVolume(volumePreference());
    setSpeed(speedPreference());
    setCalm(calmPreference());
    setReady(true);
  }, []);

  return (
    <div className={styles.rows} aria-busy={!ready}>
      <div className={styles.row}>
        <div><strong>Sons de la projection</strong><span>Projecteur, obturateur et accroches de rareté.</span></div>
        <Switch on={sound} label="Sons de la projection" onChange={(v) => { setSound(v); saveSoundPreference(v); }} />
      </div>
      <div className={styles.row}>
        <div><strong>Volume</strong><span>Les sons restent doux et feutrés, même au maximum.</span></div>
        <label className={styles.slider}>
          <input type="range" min={0} max={100} value={Math.round(volume * 100)} disabled={!sound} aria-label="Volume"
            onChange={(e) => { const v = Number(e.target.value) / 100; setVolume(v); saveVolumePreference(v); }} />
          <span className="mono">{Math.round(volume * 100)} %</span>
        </label>
      </div>
      <div className={styles.row}>
        <div><strong>Vitesse de la bande</strong><span>Le rythme de la pellicule à l’ouverture.</span></div>
        <div className="segmented" role="radiogroup" aria-label="Vitesse de la bande">
          {([['normal', 'Normale'], ['rapide', 'Rapide'], ['instant', 'Instantanée']] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={speed === v} aria-selected={speed === v} onClick={() => { setSpeed(v); saveSpeedPreference(v); }}>{l}</button>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <div><strong>Réduire les animations</strong><span>Bande immobile, cartes en fondu. Suit aussi le réglage de votre appareil.</span></div>
        <Switch on={calm} label="Réduire les animations" onChange={(v) => { setCalm(v); saveCalmPreference(v); }} />
      </div>
    </div>
  );
}
