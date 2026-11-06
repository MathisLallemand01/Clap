'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { BoosterPack } from '@/components/BoosterPack';
import { Dust, Reel } from '@/components/Decor';
import { GameCard } from '@/components/GameCard';
import { broadcastChange } from '@/components/TabSync';
import { CloseIcon, SoundIcon } from '@/components/Icons';
import { Wordmark } from '@/components/Mark';
import type { BoosterDef } from '@/lib/boosters';
import { formatNumber } from '@/lib/format';
import type { OpenResult, PulledCard } from '@/lib/game';
import { FAMILY, ladderOf, RARITIES, rarityName } from '@/lib/rarity';
import type { Card } from '@/lib/types';
import { calmPreference, speedPreference } from '@/lib/prefs';
import { createProjector, saveSoundPreference, saveVolumePreference, soundPreference, volumePreference, type Projector } from '@/lib/sound';
import { createThemePlayer, loadTheme, type ThemeInfo } from '@/lib/themePlayer';
import { themeFor } from '@/lib/themes';
import styles from './Projection.module.css';

// L'ouverture se joue en trois gestes : déchirer le paquet (clic maintenu, glisser vers la droite),
// retourner les cartes une à une (de la moins rare à la plus rare), puis le générique de fin.

/** Le tutoriel de première ouverture : une fois par compte (et retenu dans ce navigateur). */
const GUIDE_KEY = 'clap:guide-v3';
/** Une carte rare s'annonce : il faut maintenir le clic pour la retourner (cran 4 et plus). */
const HOLD_MS: Record<number, number> = { 4: 600, 5: 1000, 6: 1500 };
/** Durée du retournement, par cran : plus c'est rare, plus c'est lent. */
const FLIP_MS: Record<number, number> = { 1: 280, 2: 320, 3: 440, 4: 620, 5: 760, 6: 900 };
/** Les cartes communes partent se ranger seules après ce délai (les rares attendent un clic). */
const AUTO_STORE_MS: Record<number, number> = { 1: 850, 2: 1000, 3: 1500 };
/** Réglage « vitesse » des paramètres : accélère les retournements et le rangement automatique. */
const SPEED_FACTOR = { normal: 1, rapide: 0.6, instant: 0.3 } as const;
/** Distance à parcourir pour arracher la bande, en part de la largeur du paquet. */
const TEAR_SPAN = 0.8;

/** Étincelles autour de la carte rare, en % de la carte. Les crans élevés en montrent davantage. */
const SPARKS = [
  { x: -8, y: 10, s: 16, d: 0 }, { x: 104, y: 20, s: 12, d: 120 }, { x: 94, y: -6, s: 18, d: 220 },
  { x: -6, y: 80, s: 11, d: 300 }, { x: 106, y: 74, s: 15, d: 80 }, { x: 42, y: -9, s: 11, d: 360 },
  { x: 54, y: 106, s: 13, d: 180 }, { x: -10, y: 46, s: 10, d: 420 },
];
const SPARK_COUNT: Record<number, number> = { 3: 3, 4: 5, 5: 7, 6: 8 };

type Phase = 'sealed' | 'opening' | 'stack' | 'summary';
type Pull = { id: number; batch: number; cards: PulledCard[]; paidWith: OpenResult['paidWith'] };
type Game = {
  phase: Phase;
  /** Avancée de la déchirure (0 à 1) et geste en cours. */
  tear: number;
  held: boolean;
  torn: boolean;
  pull: Pull | null;
  /** Prochaine carte à retourner (le dessus de la pile). */
  index: number;
  /** Carte retournée, montrée au centre, pas encore rangée. */
  shown: number | null;
  /** Cartes rangées dans la rangée du bas (toujours les premières de la bobine). */
  stored: number;
  /** Cartes en train de partir vers la rangée (animation de sortie). */
  leaving: number[];
  /** Carte rare qu'on maintient : son cran et la durée à tenir. */
  charging: { i: number; ms: number } | null;
  fast: boolean;
  error: string | null;
  /** Petite relance visuelle quand on clique sur une rare sans maintenir. */
  nudge: number;
};

const tierOf = (card: Pick<Card, 'rarity'>) => RARITIES[card.rarity].tier;
const cardTitle = (card: PulledCard) => card.character ?? `${card.first} ${card.last}`;

/** Le dos commun à toutes les cartes : logo Clap sur un fond de pellicule. */
function CardBack() {
  return (
    <div className={styles.back}>
      <span className={styles.backPerf} />
      <span className={`${styles.backPerf} ${styles.backPerfR}`} />
      <span className={styles.backFrame} />
      <span className={styles.backLogo}>
        <span className={styles.backDisc}><i /><i /><i /></span>
        <b>CLAP</b>
        <small>LE CINÉMA, CARTE PAR CARTE</small>
      </span>
    </div>
  );
}

export function Projection({ booster, cover, guest = false, firstOpen = false }: { booster: BoosterDef; cover: Card | null; guest?: boolean; firstOpen?: boolean }) {
  // L'état du jeu vit dans une référence (les minuteries lisent toujours la valeur à jour) ; `render` redessine.
  const g = useRef<Game>({ phase: 'sealed', tear: 0, held: false, torn: false, pull: null, index: 0, shown: null, stored: 0, leaving: [], charging: null, fast: false, error: null, nudge: 0 });
  const [, render] = useReducer((n: number) => n + 1, 0);
  const set = useCallback((patch: Partial<Game>) => {
    Object.assign(g.current, patch);
    render();
  }, []);

  const [tickets, setTickets] = useState<number | null>(null);
  const [freeStock, setFreeStock] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [nowPlaying, setNowPlaying] = useState<ThemeInfo | null>(null);
  const [calm, setCalm] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const [guide, setGuide] = useState<number | null>(null);
  const [dims, setDims] = useState({ cw: 230, pw: 240, tw: 900 });

  const family = booster.slots[0].kind;
  const projector = useRef<Projector | null>(null);
  const themes = useRef<ReturnType<typeof createThemePlayer> | null>(null);
  const soundRef = useRef(true);
  const wantedTheme = useRef<string | null>(null);
  const factor = useRef(1);
  const calmRef = useRef(false);
  const guideOpen = useRef(false);
  guideOpen.current = guide !== null;
  calmRef.current = calm;
  const batchCount = useRef(0);
  const opening = useRef(false);
  const openedAt = useRef(0);
  const timers = useRef(new Set<number>());
  const holdTimer = useRef<number | null>(null);
  const stopRise = useRef<(() => void) | null>(null);
  const autoStore = useRef<number | null>(null);
  const fastTimer = useRef<number | null>(null);
  const gesture = useRef({ active: false, startX: 0, width: 1, lastX: 0, lastT: 0 });
  const pointerHold = useRef(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const timecode = useRef<HTMLSpanElement>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  // Taille des cartes et du paquet : on remplit la table (entre l'en-tête et la rangée du bas).
  useLayoutEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setDims({
        // Place gardée sous la carte et le paquet pour la consigne (une ou deux lignes).
        cw: Math.round(Math.max(110, Math.min(270, (h - (w < 560 ? 120 : 100)) / 1.4, w * 0.6))),
        pw: Math.round(Math.max(110, Math.min(280, (h - (w < 560 ? 130 : 100)) / 1.55, w * 0.62))),
        tw: w,
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setCalm(window.matchMedia('(prefers-reduced-motion: reduce)').matches || calmPreference());
    factor.current = SPEED_FACTOR[speedPreference()];
    const on = soundPreference();
    setSound(on);
    setVolume(volumePreference());
    if (firstOpen) {
      try {
        if (!localStorage.getItem(GUIDE_KEY)) setGuide(0);
      } catch {
        setGuide(0);
      }
    }
    soundRef.current = on;
    projector.current = createProjector(on);
    themes.current = createThemePlayer(setNowPlaying);
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      stopRise.current?.();
      projector.current?.dispose();
      themes.current?.dispose();
    };
  }, [firstOpen]);

  // Time-code de la salle, à 24 images par seconde.
  useEffect(() => {
    const start = performance.now();
    const pad = (n: number) => String(n).padStart(2, '0');
    const id = window.setInterval(() => {
      const t = Math.floor((performance.now() - start) / (1000 / 24));
      if (timecode.current) timecode.current.textContent = `TC 00:${pad(Math.floor(t / 1440) % 60)}:${pad(Math.floor(t / 24) % 60)}:${pad(t % 24)}`;
    }, 1000 / 24);
    return () => window.clearInterval(id);
  }, []);

  /** Demande la bobine au serveur, une fois la bande arrachée. */
  const fetchPull = useCallback(async () => {
    if (opening.current) return;
    opening.current = true;
    setLoading(true);
    // Identifiant de cette ouverture : si la requête est rejouée, le serveur renvoie la même bobine.
    const requestId = crypto.randomUUID();
    try {
      const res = await fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boosterId: booster.id, requestId }),
      });
      const data = (await res.json()) as OpenResult | { error: string };
      if (!res.ok || 'error' in data) {
        // Pas de bobine : le paquet se referme et l'on explique pourquoi.
        set({ error: 'error' in data ? data.error : 'L’ouverture a échoué.', phase: 'sealed', torn: false, tear: 0 });
        return;
      }
      setTickets(data.player.tickets);
      setFreeStock(data.player.freeStock);
      const batch = batchCount.current++;
      set({ pull: { id: data.pullId, batch, cards: data.cards, paidWith: data.paidWith }, index: 0, shown: null, stored: 0, leaving: [] });
      // Les extraits des musiques cultes sont cherchés dès maintenant, pour démarrer pile à la révélation.
      for (const card of data.cards) if (themeFor(card)) void loadTheme(card.id);
      // Les autres onglets ouverts se mettent à jour (réserve, tickets) : rien ne reste périmé.
      broadcastChange();
      // La pile monte quand la bande a fini de s'envoler.
      later(() => set({ phase: 'stack' }), Math.max(0, 760 - (performance.now() - openedAt.current)));
    } catch {
      set({ error: 'Connexion perdue. Réessayez.', phase: 'sealed', torn: false, tear: 0 });
    } finally {
      opening.current = false;
      setLoading(false);
    }
  }, [booster.id, later, set]);

  /** La bande est arrachée jusqu'au bout. */
  const completeTear = useCallback(() => {
    gesture.current.active = false;
    projector.current?.tearEnd(true);
    navigator.vibrate?.(18);
    openedAt.current = performance.now();
    set({ tear: 1, held: false, torn: true, phase: 'opening', error: null });
    later(() => projector.current?.pop(), 140);
    void fetchPull();
  }, [fetchPull, later, set]);

  const releaseTear = useCallback(() => {
    const t = gesture.current;
    if (!t.active) return;
    t.active = false;
    projector.current?.tearEnd(false);
    set({ held: false, tear: 0 });
  }, [set]);

  const canTear = () => g.current.phase === 'sealed' && !guideOpen.current && !opening.current;

  const onPackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canTear() || e.button > 0) return;
    if (calmRef.current) {
      completeTear();
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    gesture.current = { active: true, startX: e.clientX, width: r.width, lastX: e.clientX, lastT: performance.now() };
    set({ held: true, error: null });
  };

  const onPackMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = gesture.current;
    if (!t.active) return;
    const now = performance.now();
    const dx = e.clientX - t.lastX;
    const speed = dx > 0 ? Math.min(1, dx / Math.max(1, now - t.lastT) / 1.6) : 0;
    t.lastX = e.clientX;
    t.lastT = now;
    const progress = Math.min(1, Math.max(0, (e.clientX - t.startX) / (t.width * TEAR_SPAN)));
    projector.current?.tear(speed);
    if (progress >= 1) completeTear();
    else set({ tear: progress });
  };

  /** Range la carte retournée dans la rangée du bas. */
  const store = useCallback(() => {
    const s = g.current;
    if (s.shown === null || !s.pull) return;
    const i = s.shown;
    if (autoStore.current) window.clearTimeout(autoStore.current);
    autoStore.current = null;
    projector.current?.slide();
    const stored = s.stored + 1;
    set({ shown: null, stored, leaving: [...s.leaving, i] });
    later(() => set({ leaving: g.current.leaving.filter((x) => x !== i) }), 420);
    if (stored === s.pull.cards.length) {
      later(() => {
        set({ phase: 'summary', fast: false });
        projector.current?.fanfare();
        if (guest) later(() => setKeepOpen(true), 1500);
      }, 380);
    }
  }, [guest, later, set]);

  /** Retourne la carte du dessus. */
  const flip = useCallback((i: number) => {
    const s = g.current;
    if (!s.pull) return;
    const card = s.pull.cards[i];
    const tier = tierOf(card);
    const fast = s.fast;
    set({ shown: i, index: i + 1, charging: null });
    projector.current?.flip(i, fast ? 1 : tier);
    if (tier >= 4 && !fast) later(() => projector.current?.hit(tier), Math.round(FLIP_MS[tier] * 0.45));
    if (tier >= 4) navigator.vibrate?.(tier >= 5 ? [20, 40, 30] : 20);
    // Le Rôle principal d'un film à musique culte : sa musique se lance (la dernière révélée l'emporte).
    if (themeFor(card) && soundRef.current) {
      const id = card.id;
      wantedTheme.current = id;
      void loadTheme(id).then((t) => {
        if (t && wantedTheme.current === id && soundRef.current) later(() => wantedTheme.current === id && themes.current?.play(t), fast ? 0 : 500);
      });
    }
    // Les cartes communes partent seules ; les rares restent au centre jusqu'au clic suivant.
    if (!fast && tier <= 3) autoStore.current = later(store, AUTO_STORE_MS[tier] * factor.current + FLIP_MS[tier]);
  }, [later, set, store]);

  /** Commence à maintenir une carte rare. Renvoie faux si la carte du dessus n'en demande pas. */
  const startHold = useCallback(() => {
    const s = g.current;
    if (s.phase !== 'stack' || !s.pull || s.shown !== null || s.index >= s.pull.cards.length || s.charging) return false;
    const tier = tierOf(s.pull.cards[s.index]);
    if (tier < 4 || s.fast || calmRef.current) return false;
    const ms = HOLD_MS[tier];
    const i = s.index;
    set({ charging: { i, ms } });
    stopRise.current = projector.current?.rise(ms, tier) ?? null;
    holdTimer.current = later(() => {
      holdTimer.current = null;
      stopRise.current?.();
      stopRise.current = null;
      flip(i);
    }, ms);
    return true;
  }, [flip, later, set]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current === null) return;
    window.clearTimeout(holdTimer.current);
    timers.current.delete(holdTimer.current);
    holdTimer.current = null;
    stopRise.current?.();
    stopRise.current = null;
    set({ charging: null });
  }, [set]);

  /** Un clic (ou Espace) : range la carte montrée, sinon retourne la suivante. */
  const advance = useCallback(() => {
    const s = g.current;
    if (s.phase !== 'stack' || !s.pull || s.fast) return;
    if (s.shown !== null) {
      store();
      return;
    }
    if (s.index >= s.pull.cards.length) return;
    if (tierOf(s.pull.cards[s.index]) >= 4 && !calmRef.current) {
      set({ nudge: s.nudge + 1 });
      return;
    }
    flip(s.index);
  }, [flip, set, store]);

  /** « Tout révéler » : les cartes restantes défilent seules, sans attente. */
  const revealAll = useCallback(() => {
    cancelHold();
    set({ fast: true });
    const step = () => {
      const s = g.current;
      if (!s.pull) return;
      if (s.shown !== null) store();
      if (s.index < s.pull.cards.length) flip(s.index);
      if (g.current.shown !== null) fastTimer.current = later(step, 240);
    };
    step();
  }, [cancelHold, flip, later, set, store]);

  // Clavier : maintenir → (ou Espace) déchire le paquet ; ensuite Espace / Entrée / → retournent.
  useEffect(() => {
    const keys = new Set([' ', 'Enter', 'ArrowRight', 'ArrowUp']);
    const onDown = (e: KeyboardEvent) => {
      if (!keys.has(e.key) || guideOpen.current) return;
      if (e.target instanceof HTMLElement && e.target.closest('button, a, input')) return;
      e.preventDefault();
      const s = g.current;
      if (s.phase === 'sealed' && canTear()) {
        if (calmRef.current) {
          completeTear();
          return;
        }
        const t = gesture.current;
        if (!t.active) {
          t.active = true;
          s.error = null;
        }
        projector.current?.tear(0.55);
        const next = s.tear + 0.08;
        if (next >= 1) completeTear();
        else set({ tear: next, held: true });
        return;
      }
      if (e.repeat) return;
      if (!startHold()) advance();
    };
    const onUp = (e: KeyboardEvent) => {
      if (!keys.has(e.key)) return;
      if (g.current.phase === 'sealed') releaseTear();
      else cancelHold();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [advance, cancelHold, completeTear, releaseTear, set, startHold]);

  // La table : appuyer (et maintenir pour une rare), relâcher pour retourner ou ranger.
  const onTableDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (guideOpen.current || e.button > 0 || g.current.phase !== 'stack') return;
    pointerHold.current = startHold();
  };
  const onTableUp = () => {
    if (g.current.phase !== 'stack') return;
    if (pointerHold.current) {
      pointerHold.current = false;
      cancelHold();
      return;
    }
    advance();
  };

  const another = () => {
    if (fastTimer.current) window.clearTimeout(fastTimer.current);
    themes.current?.stop();
    set({ phase: 'sealed', tear: 0, held: false, torn: false, pull: null, index: 0, shown: null, stored: 0, leaving: [], charging: null, fast: false, error: null });
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    soundRef.current = next;
    saveSoundPreference(next);
    projector.current?.setEnabled(next);
    if (!next) themes.current?.stop();
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    saveVolumePreference(v);
    projector.current?.setVolume(v);
    themes.current?.setVolume(v);
  };

  const finishGuide = () => {
    try {
      localStorage.setItem(GUIDE_KEY, '1');
    } catch {
      // Stockage indisponible : le compte a de toute façon ouvert sa première bobine juste après.
    }
    setGuide(null);
  };

  const s = g.current;
  const cards = s.pull?.cards ?? [];
  const n = cards.length || booster.slots.length;
  const top = s.phase === 'stack' && s.shown === null ? cards[s.index] : undefined;
  const topTier = top ? tierOf(top) : 0;
  const shownCard = s.shown !== null ? cards[s.shown] : undefined;
  const shownTier = shownCard ? tierOf(shownCard) : 0;
  const { cw, pw } = dims;
  const best = [...cards].sort((a, b) => RARITIES[b.rarity].entries - RARITIES[a.rarity].entries)[0];
  const bestIndex = best ? cards.indexOf(best) : -1;
  const newCount = cards.filter((c) => c.isNew).length;
  const gained = cards.reduce((sum, c) => sum + RARITIES[c.rarity].entries, 0);
  const nextCost = freeStock && freeStock > 0 ? `offerte (${freeStock} en réserve)` : `${formatNumber(booster.price)} tickets`;
  const canAfford = (freeStock ?? 0) > 0 || (tickets ?? 0) >= booster.price;
  const summaryW = Math.floor(Math.max(56, Math.min(cw * 0.62, (dims.tw - 32 - (n - 1) * 12) / Math.max(1, n) / 1.08)));
  const mark = FAMILY[family].mark;
  // Salle teintée à la couleur d'une carte de cran 5 ou 6 (et assombrie pendant qu'on maintient un Mythe).
  const tint = shownCard && shownTier >= 5 && !s.fast ? RARITIES[shownCard.rarity].color : null;
  const dimRoom = s.charging && top && topTier >= 6;

  return (
    <div className={`${styles.screen} ${calm ? styles.calmMode : ''} ${guide !== null ? styles.locked : ''}`}>
      {/* Décor de la salle : faisceau, poussière, rideaux, bobines, fauteuils, repères de cadrage. */}
      <div className={styles.room} aria-hidden="true">
        <div className={styles.beam} />
        <Dust className={styles.dust} />
        <div className={styles.floor} />
        <div className={`${styles.tint} ${tint ? styles.tintOn : ''}`} style={{ '--tc': tint ?? 'transparent' } as CSSProperties} />
        <div className={`${styles.dim} ${dimRoom ? styles.dimOn : ''}`} style={{ '--hold': `${s.charging?.ms ?? 0}ms` } as CSSProperties} />
        <div className={`${styles.curtain} ${styles.curtainL}`} />
        <div className={`${styles.curtain} ${styles.curtainR}`} />
        <div className={styles.valance} />
        <Reel size={110} className={`${styles.reel} ${styles.reelL}`} />
        <Reel size={110} reverse className={`${styles.reel} ${styles.reelR}`} />
        <div className={styles.seats}>{Array.from({ length: 26 }, (_, i) => <span key={i} style={{ height: 30 + (i % 2) * 6 + ((i * 7) % 5) }} />)}</div>
        <div className={styles.marks}>
          <span /><span /><span /><span />
          <b className={styles.rec}><i />REC</b>
          <b className={styles.tc} ref={timecode}>TC 00:00:00:00</b>
          <em className={styles.info}>{booster.name.toUpperCase()} · {n} CARTES {FAMILY[family].label.toUpperCase()}</em>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" aria-label="Clap, accueil"><Wordmark size={26} /></Link>
          <span className="eyebrow">Ouverture · {booster.name}</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.soundBox}>
            <button type="button" className={styles.soundBtn} onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Couper le son' : 'Activer le son'}>
              <SoundIcon on={sound} />
            </button>
            <input
              type="range" min={0} max={100} step={1} value={Math.round(volume * 100)} disabled={!sound}
              className={styles.volume} aria-label="Volume" style={{ '--v': `${Math.round(volume * 100)}%` } as CSSProperties}
              onChange={(e) => changeVolume(Number(e.target.value) / 100)}
            />
            <span className={styles.volumeValue} aria-hidden="true">{sound ? `${Math.round(volume * 100)} %` : 'COUPÉ'}</span>
          </div>
          <Link href={guest ? '/' : '/collection'} className={styles.round} aria-label="Fermer l’ouverture"><CloseIcon /></Link>
        </div>
      </header>

      <main
        ref={tableRef}
        className={`${styles.table} ${s.phase === 'stack' ? styles.tableActive : ''}`}
        onPointerDown={onTableDown}
        onPointerUp={onTableUp}
        onPointerCancel={() => { pointerHold.current = false; cancelHold(); }}
        onPointerLeave={() => { if (pointerHold.current) { pointerHold.current = false; cancelHold(); } }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Le paquet : on attrape la bande du haut et on glisse vers la droite. */}
        {(s.phase === 'sealed' || s.phase === 'opening') && (
          <div className={`${styles.packZone} ${s.phase === 'opening' ? styles.packOut : ''}`} key={`pack-${batchCount.current}`}>
            <div
              className={`${styles.packGrip} ${s.held ? styles.packHeld : ''}`}
              style={{ width: pw }}
              onPointerDown={onPackDown}
              onPointerMove={onPackMove}
              onPointerUp={() => (gesture.current.active ? releaseTear() : undefined)}
              onPointerCancel={releaseTear}
              role="button"
              tabIndex={0}
              aria-label={`Déchirer la bobine ${booster.name} : maintenez le clic et glissez vers la droite, ou maintenez la flèche droite`}
            >
              <BoosterPack booster={booster} cover={cover} width={pw} tear={s.tear} torn={s.torn} held={s.held} className={styles.pack} />
              {s.phase === 'opening' && <span className={styles.leak} />}
              {s.held && s.tear > 0.02 && (
                <span className={styles.flecks}>
                  {Array.from({ length: 8 }, (_, i) => <i key={`${i}-${Math.floor(s.tear * 10)}`} style={{ left: `${Math.min(96, s.tear * TEAR_SPAN * 100 + (i % 3) * 2)}%`, '--fx': `${(i % 2 ? 1 : -1) * (6 + i * 3)}px`, '--fy': `${-18 - (i % 4) * 10}px` } as CSSProperties} />)}
                </span>
              )}
              {s.phase === 'sealed' && !s.held && guide === null && !calm && (
                <span className={styles.ghostHand} style={{ '--hand-x': `${Math.round(pw * 0.72)}px` } as CSSProperties} aria-hidden="true">
                  <svg width="34" height="34" viewBox="0 0 32 32"><path d="M7 3l16 9-7 2 4 9-4 2-4-9-5 5z" fill="#F2EFE8" stroke="#0B0B0D" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                </span>
              )}
            </div>
            <div className={styles.packHint} role="status">
              {s.error ? (
                <span className={styles.error}>{s.error} <Link href="/bobines">Voir les bobines</Link></span>
              ) : s.phase === 'opening' ? (
                <span className="eyebrow">{loading ? 'Ouverture…' : ''}</span>
              ) : calm ? (
                <span className={styles.chip}>Touchez le paquet pour l’ouvrir</span>
              ) : (
                <span className={styles.chip}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" /></svg>
                  Attrapez la bande du haut, maintenez et glissez <b className={styles.arrow}>⟶</b>
                </span>
              )}
            </div>
          </div>
        )}

        {/* La pile de cartes, puis la carte retournée au centre. */}
        {s.phase === 'stack' && s.pull && (
          <div className={styles.pileZone}>
            <div className={styles.pile} key={`pile-${s.pull.id}`} style={{ width: cw, height: Math.round(cw * 1.4) }}>
              {cards.map((card, i) => {
                const isShown = i === s.shown;
                const isLeaving = s.leaving.includes(i);
                const depth = i - s.index;
                if (!isShown && !isLeaving && (depth < 0 || depth > 3)) return null;
                const tier = tierOf(card);
                const isTop = depth === 0 && s.shown === null;
                const charging = isTop && s.charging?.i === i;
                const cls = [
                  styles.card,
                  isShown && styles.shown,
                  isLeaving && styles.leaving,
                  isTop && tier >= 3 && !s.fast && styles.announce,
                  isTop && tier >= 4 && !s.fast && styles.restless,
                  charging && styles.charging,
                  isTop && s.nudge > 0 && (s.nudge % 2 ? styles.nudgeA : styles.nudgeB),
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={`${s.pull!.id}-${i}`}
                    className={cls}
                    style={{
                      '--rc': RARITIES[card.rarity].color,
                      '--depth': Math.max(0, depth),
                      '--flip': `${s.fast ? 200 : FLIP_MS[tier]}ms`,
                      '--hold': `${s.charging?.ms ?? 0}ms`,
                      '--lift': isShown && tier >= 4 && !s.fast ? 1.06 : 1,
                      zIndex: isShown ? 60 : isLeaving ? 55 : 40 - Math.max(0, depth),
                    } as CSSProperties}
                  >
                    <div className={styles.flipper}>
                      <div className={styles.face}><CardBack /></div>
                      <div className={`${styles.face} ${styles.front}`}>
                        <GameCard card={card} width={cw} serial={card.serial} eager live={isShown} />
                        {isShown && tier >= 4 && !s.fast && <span className={styles.sweep} />}
                      </div>
                    </div>
                    {charging && <span className={styles.holdBar}><i /></span>}
                    {isShown && tier >= 2 && !s.fast && (
                      <div className={`${styles.fx} ${styles[`fx${Math.min(tier, 6)}`]}`} aria-hidden="true">
                        <span className={styles.halo} />
                        {tier >= 3 && <span className={styles.ring} />}
                        {tier >= 6 && <span className={styles.rainbow} />}
                        {SPARKS.slice(0, SPARK_COUNT[tier] ?? 0).map((p, k) => (
                          <i key={k} className={styles.spark} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDelay: `${Math.round(FLIP_MS[tier] * 0.6) + p.d}ms` }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={styles.pileHint} role="status">
              {shownCard && shownTier >= 4 && !s.fast ? (
                <span className={styles.banner} style={{ '--rc': RARITIES[shownCard.rarity].color } as CSSProperties} key={`b-${s.shown}`}>
                  <em>{mark} {rarityName(shownCard.rarity)}{shownCard.isNew ? ' · NOUVELLE' : ''}</em>
                  <span><b>{cardTitle(shownCard)}</b>{shownCard.kind === 'role' ? ` · ${shownCard.first} ${shownCard.last} · ${shownCard.film}` : shownCard.origin ? ` · ${shownCard.origin}` : ''}</span>
                </span>
              ) : shownCard && !s.fast ? (
                <span className={styles.chip}>{shownTier >= 3 ? 'Cliquez pour la ranger' : `${rarityName(shownCard.rarity)}${shownCard.isNew ? ' · nouvelle' : ''}`}</span>
              ) : top && topTier >= 4 && !s.fast ? (
                <span className={`${styles.chip} ${styles.chipRare}`} style={{ '--rc': RARITIES[top.rarity].color } as CSSProperties} key={`h-${s.nudge}`}>
                  {mark} Une carte rare s’annonce : <b>maintenez</b> le clic pour la retourner
                </span>
              ) : top && !s.fast ? (
                <span className={styles.chip}>Cliquez (ou Espace) pour retourner · {s.index + 1} / {n}</span>
              ) : null}
            </div>
          </div>
        )}

        {/* Le générique de fin : les cartes alignées, la meilleure soulevée. */}
        {s.phase === 'summary' && s.pull && (
          <div className={styles.summary}>
            <span className="eyebrow">Bobine {String(s.pull.batch + 1).padStart(2, '0')} · {booster.name} · résumé</span>
            <div className={styles.summaryRow}>
              {cards.map((card, i) => (
                <div key={`${s.pull!.id}-${i}`} className={`${styles.summaryCard} ${i === bestIndex ? styles.summaryBest : ''}`} style={{ animationDelay: `${i * 70}ms`, '--rc': RARITIES[card.rarity].color } as CSSProperties}>
                  <GameCard card={card} width={i === bestIndex ? Math.round(summaryW * 1.08) : summaryW} serial={card.serial} eager />
                  <span className={styles.summaryTag} style={{ color: i === bestIndex ? RARITIES[card.rarity].color : card.isNew ? '#3DDC97' : undefined }}>
                    {i === bestIndex ? `★ MEILLEURE${card.isNew ? ' · NOUVELLE' : ''}` : card.isNew ? 'NOUVELLE' : RARITIES[card.rarity].short}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.summaryStats}>
              <span>+{newCount} NOUVELLE{newCount > 1 ? 'S' : ''}</span>
              <span className={styles.gain}>+{formatNumber(gained)} ENTRÉES</span>
              {best && <span style={{ color: RARITIES[best.rarity].color }}>{mark} {rarityName(best.rarity).toUpperCase()}</span>}
            </div>
          </div>
        )}
      </main>

      {nowPlaying && (
        <div className={styles.nowPlaying} role="status">
          <span className={styles.eq} aria-hidden="true"><i /><i /><i /><i /></span>
          <span className={styles.npText}>
            <em>♪ Musique culte</em>
            <b>{nowPlaying.song}</b>
            <span>{nowPlaying.artist}</span>
          </span>
          {nowPlaying.link && <a href={nowPlaying.link} target="_blank" rel="noreferrer" className={styles.npLink}>Écouter en entier ↗</a>}
          <button type="button" className={styles.npStop} onClick={() => themes.current?.stop()} aria-label="Arrêter la musique">■</button>
        </div>
      )}

      {/* La rangée du bas : les cartes s'y rangent au fil des retournements. */}
      <footer className={styles.tray} aria-live="polite">
        <div className={styles.trayHead}>
          <strong className="display">Bobine {String(Math.max(1, (s.pull?.batch ?? batchCount.current) + 1)).padStart(2, '0')}</strong>
          <span className={`${styles.familyBadge} ${family === 'actor' ? styles.familyActor : styles.familyRole}`}>
            {mark} {n} cartes {FAMILY[family].label}
          </span>
          <span className="eyebrow">{s.pull ? `${s.stored} / ${n} rangées` : s.phase === 'sealed' ? 'scellée' : 'ouverture…'}</span>
        </div>
        <div className={styles.trayRow}>
          <div className={styles.slots}>
            {Array.from({ length: n }, (_, i) => {
              const card = i < s.stored ? cards[i] : undefined;
              return card ? (
                <span key={`${s.pull?.id}-${i}`} className={`${styles.mini} ${styles.miniIn}`} style={{ '--rc': RARITIES[card.rarity].color } as CSSProperties} title={`${cardTitle(card)} · ${rarityName(card.rarity)}`}>
                  <GameCard card={card} width={dims.tw < 560 ? 38 : 48} eager />
                </span>
              ) : (
                <span key={`e-${i}`} className={styles.mini}><i>{String(i + 1).padStart(2, '0')}</i></span>
              );
            })}
          </div>
          <div className={styles.actions}>
            {s.phase === 'stack' && !s.fast && (
              <button type="button" className="btn btn-sm" onClick={revealAll}>Tout révéler</button>
            )}
            {s.phase === 'summary' && guest && (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setKeepOpen(true)}>Garder mes cartes</button>
            )}
            {s.phase === 'summary' && !guest && (
              <>
                <button type="button" className="btn btn-sm btn-primary" onClick={another} disabled={loading || !canAfford}>Une autre · {nextCost}</button>
                <Link href="/bobines" className="btn btn-sm">Changer de bobine</Link>
                <Link href="/collection" className="btn btn-sm">Ranger</Link>
              </>
            )}
          </div>
        </div>
        <div className={styles.scale} aria-label={`Échelle des cartes ${FAMILY[family].label}`}>
          <span>{FAMILY[family].plural.toUpperCase()}, DU PLUS COMMUN AU PLUS RARE :</span>
          {ladderOf(family).map((id) => (
            <span key={id} className={styles.scaleStep}>
              <i className={family === 'actor' ? styles.markRound : styles.markDiamond} style={{ background: RARITIES[id].color }} />
              {RARITIES[id].label}
            </span>
          ))}
        </div>
        {s.phase === 'summary' && !guest && !canAfford && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>PLUS DE BOBINE OFFERTE NI ASSEZ DE TICKETS POUR CELLE-CI.</span>
        )}
      </footer>

      {/* Tutoriel de première ouverture : rien n'est cliquable derrière tant qu'il n'est pas lu. */}
      {guide !== null && (
        <div className={styles.guideBackdrop} role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <div className={styles.guide}>
            <div className={styles.guideBars}>{[0, 1, 2].map((k) => <span key={k} className={k <= guide ? styles.guideBarOn : ''} />)}</div>
            <span className={styles.guideStep}>{guide + 1} / 3 · Votre première bobine</span>
            {guide === 0 && (
              <>
                <h2 id="guide-title" className="display">Déchirez le paquet</h2>
                <div className={styles.guideDemo} aria-hidden="true">
                  <span className={styles.demoStrip}><i /></span>
                  <span className={styles.demoHand}>
                    <svg width="26" height="26" viewBox="0 0 32 32"><path d="M7 3l16 9-7 2 4 9-4 2-4-9-5 5z" fill="#F2EFE8" stroke="#0B0B0D" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                  </span>
                </div>
                <p>Attrapez <b>la bande du haut</b> du paquet, <b>maintenez le clic</b> et glissez jusqu’au bout, vers la droite. Sur téléphone, glissez le doigt. Au clavier, maintenez la flèche →.</p>
                <p className={styles.guideMuted}>Relâché trop tôt, la bande se recolle : il suffit de recommencer.</p>
              </>
            )}
            {guide === 1 && (
              <>
                <h2 id="guide-title" className="display">Retournez les cartes</h2>
                <p>Cliquez (ou Espace) pour retourner la carte du dessus. Elles arrivent <b>de la moins rare à la plus rare</b> : la meilleure est toujours la dernière.</p>
                <p>Une carte rare <b>s’annonce</b> : son dos s’allume à sa couleur. Pour celles-là, <b>maintenez le clic</b> pour la retourner.</p>
                <div className={styles.guideScale}>
                  {ladderOf(family).map((id) => (
                    <span key={id}><i className={family === 'actor' ? styles.markRound : styles.markDiamond} style={{ background: RARITIES[id].color }} />{RARITIES[id].label}</span>
                  ))}
                </div>
              </>
            )}
            {guide === 2 && (
              <>
                <h2 id="guide-title" className="display">{family === 'actor' ? 'Acteurs' : 'Rôles'} et duos</h2>
                <p>Cette bobine contient <b>{booster.slots.length} cartes {FAMILY[family].label}</b>. {family === 'actor'
                  ? 'Une carte Acteur, c’est une personne et toute sa carrière (marqueurs ronds).'
                  : 'Une carte Rôle, c’est un acteur dans un film précis (marqueurs en losange).'}</p>
                <p>La <b>carte Acteur</b> d’une personne + <b>un de ses Rôles</b> = un duo, qui ajoute des entrées à votre box-office. Les sagas se complètent de la même façon.</p>
                <p className={styles.guideMuted}>Tout est expliqué sur la page « Raretés et règles », depuis le menu.</p>
              </>
            )}
            <div className={styles.guideActions}>
              {guide > 0 && <button type="button" className="btn btn-sm" onClick={() => setGuide(guide - 1)}>Retour</button>}
              {guide < 2
                ? <button type="button" className="btn btn-sm btn-primary" onClick={() => setGuide(guide + 1)} autoFocus>Suivant</button>
                : <button type="button" className="btn btn-sm btn-primary" onClick={finishGuide} autoFocus>C’est parti</button>}
            </div>
          </div>
        </div>
      )}

      {keepOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="garder">
          <div className={`modal ${styles.keep}`}>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Bobine offerte</span>
            <h2 id="garder" className="display">Gardez vos {cards.length} cartes</h2>
            <p>
              {best && <>Dont <b>{cardTitle(best)}</b>, {RARITIES[best.rarity].label}. </>}
              Elles sont mises de côté : créez un compte gratuit et elles rejoignent votre collection, avec 10 bobines offertes et 600 tickets.
            </p>
            <div className={styles.keepCards}>
              {cards.map((c, i) => <GameCard key={i} card={c} width={92} eager />)}
            </div>
            <div className="actions">
              <Link href="/connexion?mode=inscription&suite=/collection" className="btn btn-primary">Créer mon compte</Link>
              <Link href="/connexion?suite=/collection" className="btn">J’ai déjà un compte</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
