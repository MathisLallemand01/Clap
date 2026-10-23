'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BoosterPack } from '@/components/BoosterPack';
import { GameCard } from '@/components/GameCard';
import { CloseIcon, SoundIcon } from '@/components/Icons';
import { Wordmark } from '@/components/Mark';
import type { BoosterDef } from '@/lib/boosters';
import { formatNumber } from '@/lib/format';
import type { OpenResult, PulledCard } from '@/lib/game';
import { RARITIES } from '@/lib/rarity';
import type { Card } from '@/lib/types';
import { calmPreference, speedPreference } from '@/lib/prefs';
import { createProjector, saveSoundPreference, soundPreference, type Projector } from '@/lib/sound';
import styles from './Projection.module.css';

// La bande avance d'une vignette (SPACING px) à chaque pas, puis marque une pause :
// c'est le tempo de l'ouverture. Une carte se révèle quand sa vignette s'arrête à l'obturateur.
const SPACING = 180;
const MOVE_MS = 550;
const HOLD_MS = 650;
const FAST_MOVE_MS = 220;
const FAST_HOLD_MS = 60;
/** Vitesses choisies dans les paramètres : [déplacement, pause] en millisecondes. */
const SPEEDS = { normal: [MOVE_MS, HOLD_MS], rapide: [320, 280], instant: [FAST_MOVE_MS, FAST_HOLD_MS] } as const;

type Layout = {
  w: number;
  h: number;
  path: string;
  /** Distance de l'obturateur le long du trajet (multiple de SPACING). */
  gate: number;
  reels: { cx: number; cy: number; r: number }[];
  ghost: CSSProperties | null;
};

const LAYOUTS: Record<'landscape' | 'portrait', Layout> = {
  landscape: {
    w: 1440,
    h: 900,
    path: 'M -220 240 L 520 240 A 1000 1000 0 0 1 1486 981 L 1590 1367',
    gate: 720,
    reels: [{ cx: -60, cy: 300, r: 190 }, { cx: 1400, cy: 900, r: 240 }],
    ghost: { left: 40, top: 440 },
  },
  portrait: {
    w: 800,
    h: 1400,
    path: 'M -220 300 L 300 300 A 380 380 0 0 1 680 680 L 680 1800',
    gate: 360,
    reels: [{ cx: -70, cy: 360, r: 150 }, { cx: 800, cy: 1420, r: 200 }],
    ghost: null,
  },
};

type Frame =
  | { key: string; type: 'leader'; batch: number; name: string }
  | { key: string; type: 'card'; batch: number; slot: number; card: PulledCard };

type Batch = { index: number; size: number; paidWith: OpenResult['paidWith'] };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function stingLevel(card: PulledCard): 0 | 1 | 2 | 3 {
  const tier = RARITIES[card.rarity].tier;
  if (tier >= 5) return 3;
  if (tier === 4) return 2;
  if (tier === 3) return 1;
  return 0;
}

function Reel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const holes = Array.from({ length: 6 }, (_, k) => {
    const a = ((k * 60 + 30) * Math.PI) / 180;
    return { x: cx + r * 0.57 * Math.cos(a), y: cy + r * 0.57 * Math.sin(a) };
  });
  return (
    <g data-reel={r} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      <circle cx={cx} cy={cy} r={r} fill="#0F0F12" stroke="#26262B" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke="#1A1A1F" />
      {holes.map((h, i) => <circle key={i} cx={h.x} cy={h.y} r={r * 0.23} fill="#0B0B0D" stroke="#26262B" strokeWidth="1.5" />)}
      <circle cx={cx} cy={cy} r={r * 0.15} fill="#141417" stroke="#33333A" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="7" fill="#FF4A1C" />
    </g>
  );
}

export function Projection({ booster, cover }: { booster: BoosterDef; cover: Card | null }) {
  const [layoutName, setLayoutName] = useState<keyof typeof LAYOUTS>('landscape');
  const [scale, setScale] = useState(1);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tickets, setTickets] = useState<number | null>(null);
  const [freeStock, setFreeStock] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fast, setFast] = useState(false);
  const [sound, setSound] = useState(true);
  const [calm, setCalm] = useState(false);
  // Le paquet s'affiche, se déchire, puis la bande démarre.
  const [intro, setIntro] = useState<'pack' | 'tearing' | 'done'>('pack');
  const [celebration, setCelebration] = useState<PulledCard | null>(null);

  const layout = LAYOUTS[layoutName];
  const framesRef = useRef<Frame[]>([]);
  const frameEls = useRef(new Map<string, HTMLDivElement>());
  const holesRef = useRef<SVGPathElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const projector = useRef<Projector | null>(null);
  const motion = useRef({ offset: layout.gate - SPACING, step: null as null | { from: number; start: number }, holdUntil: 0, moving: false });
  const fastRef = useRef(false);
  const speedRef = useRef<readonly [number, number]>(SPEEDS.normal);
  const introDone = useRef(false);
  const started = useRef(false);
  const batchCount = useRef(0);
  const gateRef = useRef(layout.gate);
  const [gate, setGate] = useState<{ x: number; y: number; angle: number } | null>(null);

  framesRef.current = frames;
  fastRef.current = fast;

  // Orientation et mise à l'échelle de la scène.
  useLayoutEffect(() => {
    const fit = () => {
      const name = window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
      const l = LAYOUTS[name];
      // On garde la position relative de la bande par rapport à l'obturateur.
      motion.current.offset += l.gate - gateRef.current;
      gateRef.current = l.gate;
      setLayoutName(name);
      setScale(Math.min(window.innerWidth / l.w, window.innerHeight / l.h));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    setCalm(window.matchMedia('(prefers-reduced-motion: reduce)').matches || calmPreference());
    speedRef.current = SPEEDS[speedPreference()];
    const on = soundPreference();
    setSound(on);
    projector.current = createProjector(on);
    return () => projector.current?.dispose();
  }, []);

  const open = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boosterId: booster.id }),
      });
      const data = (await res.json()) as OpenResult | { error: string };
      if (!res.ok || 'error' in data) {
        setError('error' in data ? data.error : 'L’ouverture a échoué.');
        return;
      }
      setTickets(data.player.tickets);
      setFreeStock(data.player.freeStock);
      setFast(false);
      if (!introDone.current) {
        setIntro('tearing');
        projector.current?.rip();
        window.setTimeout(() => {
          introDone.current = true;
          setIntro('done');
        }, 1250);
      }
      const index = batchCount.current++;
      setFrames((f) => [
        ...f,
        { key: `leader-${data.pullId}`, type: 'leader', batch: index, name: booster.name },
        ...data.cards.map((card, slot): Frame => ({ key: `${data.pullId}-${slot}`, type: 'card', batch: index, slot, card })),
      ]);
      setBatches((prev) => [...prev, { index, size: data.cards.length, paidWith: data.paidWith }]);
    } catch {
      setError('Connexion perdue. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, [booster]);

  // Première bobine dès l'arrivée sur la page (une seule fois, même en mode strict).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void open();
  }, [open]);

  const reveal = useCallback((frame: Frame) => {
    if (frame.type !== 'card') return;
    setRevealed((prev) => new Set(prev).add(frame.key));
    const p = projector.current;
    p?.click();
    const level = stingLevel(frame.card);
    if (level && !fastRef.current) p?.sting(level as 1 | 2 | 3);
    if (level === 3) {
      setCelebration(frame.card);
      window.setTimeout(() => setCelebration((c) => (c === frame.card ? null : c)), 3200);
    }
  }, []);

  // Moteur de la bande.
  useEffect(() => {
    if (calm) return;
    const m = motion.current;
    let raf = 0;
    const total = () => pathRef.current?.getTotalLength() ?? 3000;

    const tick = (now: number) => {
      const list = framesRef.current;
      const moveMs = fastRef.current ? FAST_MOVE_MS : speedRef.current[0];
      const holdMs = fastRef.current ? FAST_HOLD_MS : speedRef.current[1];
      const lastDistance = m.offset - (list.length - 1) * SPACING;
      const pending = introDone.current && list.length > 0 && lastDistance < layout.gate;

      if (m.step) {
        const t = Math.min(1, (now - m.step.start) / moveMs);
        m.offset = m.step.from + SPACING * ease(t);
        if (t >= 1) {
          m.offset = m.step.from + SPACING;
          m.step = null;
          m.holdUntil = now + holdMs;
          const atGate = Math.round((m.offset - layout.gate) / SPACING);
          if (atGate >= 0 && atGate < list.length) reveal(list[atGate]);
        }
      } else if (pending && now >= m.holdUntil) {
        m.step = { from: m.offset, start: now };
      }

      const moving = m.step !== null || (pending && now < m.holdUntil);
      if (moving !== m.moving) {
        m.moving = moving;
        projector.current?.hum(moving);
      }

      const end = total();
      list.forEach((f, i) => {
        const el = frameEls.current.get(f.key);
        if (!el) return;
        const d = m.offset - i * SPACING;
        el.style.offsetDistance = `${Math.max(0, d)}px`;
        el.style.visibility = d < 0 || d > end ? 'hidden' : 'visible';
      });
      if (holesRef.current) holesRef.current.style.strokeDashoffset = String(-m.offset);
      svgRef.current?.querySelectorAll<SVGGElement>('[data-reel]').forEach((g) => {
        g.style.transform = `rotate(${(m.offset / Number(g.dataset.reel)) * (180 / Math.PI)}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      projector.current?.hum(false);
      m.moving = false;
    };
  }, [calm, layout, reveal]);

  // En mouvement réduit, tout est révélé d'un coup.
  useEffect(() => {
    if (calm) setRevealed(new Set(frames.filter((f) => f.type === 'card').map((f) => f.key)));
  }, [calm, frames]);

  // Position et orientation de l'obturateur sur le trajet.
  useEffect(() => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', layout.path);
    const p = path.getPointAtLength(layout.gate);
    const q = path.getPointAtLength(layout.gate + 1);
    setGate({ x: p.x, y: p.y, angle: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI });
  }, [layout]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSoundPreference(next);
    projector.current?.setEnabled(next);
  };

  const current = batches[batches.length - 1];
  const currentCards = frames.filter((f): f is Extract<Frame, { type: 'card' }> => f.type === 'card' && f.batch === current?.index);
  const revealedCount = currentCards.filter((f) => revealed.has(f.key)).length;
  const done = current !== undefined && revealedCount === current.size;
  const nextCost = freeStock && freeStock > 0 ? 'offerte' : `${formatNumber(booster.price)} tickets`;
  const canAfford = (freeStock ?? 0) > 0 || (tickets ?? 0) >= booster.price;
  const pathStyle = { offsetPath: `path('${layout.path}')` } as CSSProperties;

  return (
    <div className={styles.screen}>
      {calm ? (
        <div className={styles.calm}>
          {frames.map((f) => f.type === 'card' && (
            <div key={f.key}><GameCard card={f.card} width={170} serial={f.card.serial} /></div>
          ))}
        </div>
      ) : (
        <div className={`${styles.stage} ${intro === 'done' ? styles.stageOn : ''}`} style={{ width: layout.w, height: layout.h, transform: `translate(-50%, -50%) scale(${scale})` }}>
          <svg ref={svgRef} width={layout.w} height={layout.h} viewBox={`0 0 ${layout.w} ${layout.h}`} aria-hidden="true">
            {layout.reels.map((r) => <Reel key={`${r.cx}-${r.cy}`} {...r} />)}
            <path ref={pathRef} d={layout.path} fill="none" stroke="#111114" strokeWidth="252" />
            <path ref={holesRef} d={layout.path} fill="none" stroke="#2E2E35" strokeWidth="236" strokeDasharray="9 11" />
            <path d={layout.path} fill="none" stroke="#111114" strokeWidth="210" />
          </svg>

          {layout.ghost && (
            <div className={styles.ghost} style={layout.ghost} aria-hidden="true">
              <span className={styles.ghostNumber}>{String(Math.max(1, batches.length)).padStart(2, '0')}</span>
              <div className={styles.ghostInfo}>
                <span>Bobine en cours</span>
                <span>{booster.name}</span>
                <span>35 mm · 24 im/s</span>
                <span>{booster.slots.length} vignettes</span>
              </div>
            </div>
          )}

          {gate && (
            <div className={styles.gate} style={{ left: gate.x, top: gate.y, transform: `rotate(${gate.angle}deg)` }} aria-hidden="true">
              <span /><span /><span /><span />
              <span className={styles.gateLabel}>▸ OBTURATEUR</span>
            </div>
          )}

          {frames.map((f) => {
            const isRevealed = revealed.has(f.key);
            const rc = f.type === 'card' ? RARITIES[f.card.rarity].color : 'var(--line)';
            return (
              <div
                key={f.key}
                ref={(el) => {
                  if (el) frameEls.current.set(f.key, el);
                  else frameEls.current.delete(f.key);
                }}
                className={styles.frame}
                data-revealed={isRevealed}
                style={{ ...pathStyle, '--rc': rc, visibility: 'hidden' } as CSSProperties}
              >
                {f.type === 'leader' ? (
                  <div className={styles.leader}>
                    <div className={styles.leaderRing}><span>{f.batch + 1}</span></div>
                    <span className="eyebrow" style={{ fontSize: 10 }}>BOBINE {String(f.batch + 1).padStart(2, '0')}</span>
                    <span className={styles.leaderName}>{f.name}</span>
                  </div>
                ) : (
                  <>
                    <div className={styles.cardWrap}><GameCard card={f.card} width={150} serial={f.card.serial} eager live /></div>
                    <div className={styles.shutter}><span>VIGN. {String(f.slot + 1).padStart(2, '0')}</span></div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {intro !== 'done' && !calm && (
        <div className={styles.intro} aria-hidden="true">
          <BoosterPack booster={booster} cover={cover} width={Math.round(Math.min(300, 260 / Math.max(scale, 0.6)) * Math.max(scale, 0.6))} float={intro === 'pack'} tearing={intro === 'tearing'} />
          <span className="eyebrow">{intro === 'pack' ? (error ? '' : 'Chargement de la bobine…') : 'Moteur…'}</span>
        </div>
      )}

      {celebration && (
        <div className={styles.celebration} style={{ ['--rc' as string]: RARITIES[celebration.rarity].color }} role="status">
          <span className="eyebrow">◆ Nouvelle {RARITIES[celebration.rarity].label} ◆</span>
          <strong className="display">{celebration.character ?? `${celebration.first} ${celebration.last}`}</strong>
          <span>{celebration.first} {celebration.last}{celebration.film ? ` · ${celebration.film}` : ''}</span>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" aria-label="Clap, accueil"><Wordmark size={26} /></Link>
          <span className="eyebrow">Projection en cours</span>
        </div>
        <div className={styles.headerRight}>
          <button type="button" className={styles.soundBtn} onClick={toggleSound} aria-pressed={sound} aria-label="Son de la projection">
            <SoundIcon on={sound} />
            <span className={styles.soundLabel}>{sound ? 'Son activé' : 'Son coupé'}</span>
            
          </button>
          <Link href="/collection" className={styles.round} aria-label="Fermer la projection"><CloseIcon /></Link>
        </div>
      </header>

      <div className={styles.tray} aria-live="polite">
        <div className={styles.trayHead}>
          <strong className="display">Bobine {String(Math.max(1, batches.length)).padStart(2, '0')}</strong>
          <span className="eyebrow">
            {booster.name} · {current ? `${revealedCount} / ${current.size} révélées` : loading ? 'chargement…' : ''}
          </span>
        </div>
        <div className={styles.trayRow}>
          <div className={styles.slots}>
            {currentCards.map((f) => {
              const r = RARITIES[f.card.rarity];
              const shown = revealed.has(f.key);
              return (
                <span key={f.key} className={styles.slot} style={shown ? { borderColor: r.color, color: r.color } : undefined}>
                  {shown ? r.short : '—'}
                </span>
              );
            })}
          </div>
          <div className={styles.actions}>
            {!done && current && (
              <button type="button" className="btn btn-sm" onClick={() => setFast(true)} disabled={fast}>Tout révéler</button>
            )}
            {done && (
              <>
                <button type="button" className="btn btn-sm" onClick={() => void open()} disabled={loading || !canAfford}>
                  Une autre · {nextCost}
                </button>
                <Link href="/bobines" className="btn btn-sm">Changer de bobine</Link>
                <Link href="/collection" className="btn btn-sm btn-primary">Ranger</Link>
              </>
            )}
          </div>
        </div>
        {error && (
          <span className={styles.error} role="alert">
            {error} <Link href="/bobines" style={{ textDecoration: 'underline' }}>Voir les bobines</Link>
          </span>
        )}
        {done && !canAfford && !error && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            PLUS DE BOBINE OFFERTE NI ASSEZ DE TICKETS POUR CELLE-CI.
          </span>
        )}
      </div>
    </div>
  );
}
