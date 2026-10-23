'use client';

import { useState } from 'react';
import type { Video } from '@/lib/tmdb';
import styles from '../../fiche.module.css';
import { trailerWatched } from '../actions';

const LANG: Record<string, string> = { fr: 'VF', en: 'VO' };

function label(v: Video, all: Video[]): string {
  const base = v.type === 'Teaser' ? 'Teaser' : (LANG[v.language] ?? v.language.toUpperCase());
  const same = all.filter((x) => (x.type === 'Teaser' ? 'Teaser' : (LANG[x.language] ?? x.language.toUpperCase())) === base);
  return same.length > 1 ? `${base} ${same.indexOf(v) + 1}` : base;
}

export function Trailer({ videos, title, backdrop }: { videos: Video[]; title: string; backdrop: string | null }) {
  const options = videos.slice(0, 4);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = options[current];

  const play = () => {
    setPlaying(true);
    void trailerWatched();
  };

  return (
    <>
      {playing && <div className={styles.cinema} aria-hidden="true" />}
      <div className={styles.versions}>
        <h2 className="display h2" style={{ position: 'relative', zIndex: playing ? 41 : undefined }}>Bande-annonce</h2>
        {options.length > 1 && (
          <div className="segmented" role="tablist" aria-label="Version de la vidéo" style={{ position: 'relative', zIndex: playing ? 41 : undefined }}>
            {options.map((v, i) => (
              <button key={v.key} type="button" role="tab" aria-selected={i === current} onClick={() => setCurrent(i)}>{label(v, options)}</button>
            ))}
          </div>
        )}
      </div>
      <div className={`${styles.player} ${playing ? styles.playerOn : ''}`}>
        <div className="sprockets" />
        {video ? (
          <div className={styles.frame}>
            {playing ? (
              <iframe
                key={video.key}
                src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0&modestbranding=1&hl=fr`}
                title={`${title} : ${video.name}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className={styles.poster} style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
                <button type="button" className={styles.play} onClick={play} aria-label={`Lire la bande-annonce de ${title}`}>
                  <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5Z" fill="currentColor" /></svg>
                </button>
                <span className={`display ${styles.posterTitle}`}>{title}</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.empty} style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
            <span className="display h3">Pas de bande-annonce</span>
            <span className="muted">TMDB n’a pas de vidéo pour ce film. Les photogrammes restent visibles sur la carte.</span>
          </div>
        )}
        <div className="sprockets" />
      </div>
      <div className={styles.note}>
        <span>{playing ? 'Mode cinéma : la page s’assombrit autour du lecteur.' : 'Vidéo YouTube fournie par TMDB.'}</span>
        {playing && <button type="button" className="btn btn-sm" style={{ position: 'relative', zIndex: 41 }} onClick={() => setPlaying(false)}>Fermer la vidéo</button>}
      </div>
    </>
  );
}
