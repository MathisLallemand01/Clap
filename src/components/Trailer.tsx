'use client';

import { useState } from 'react';
import styles from './Trailer.module.css';

/**
 * Bande-annonce YouTube. La vidéo (et les cookies de YouTube) ne se chargent qu'au clic :
 * d'ici là, seule la vignette est affichée.
 */
export function Trailer({ videoKey, title }: { videoKey: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState(true);
  return (
    <div className={styles.frame}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0`}
          title={`Bande-annonce : ${title}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className={styles.poster} onClick={() => setPlaying(true)} aria-label={`Lire la bande-annonce de ${title}`}>
          {thumb && <img src={`https://i.ytimg.com/vi/${videoKey}/hqdefault.jpg`} alt="" loading="lazy" onError={() => setThumb(false)} />}
          <span className={styles.play} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          </span>
          <span className={styles.caption}>BANDE-ANNONCE · YOUTUBE</span>
        </button>
      )}
    </div>
  );
}
