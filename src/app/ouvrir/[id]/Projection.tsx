'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BoosterPack } from '@/components/BoosterPack';
import { Beam, Dust } from '@/components/Decor';
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

/** Durée de l'animation de rareté, par cran (2 à 5) : la bande attend qu'elle se termine. */
const BURST_MS: Record<number, number> = { 2: 700, 3: 1000, 4: 1500, 5: 3600 };
/** Étincelles déterministes (pas de hasard au rendu) ; chaque cran en utilise davantage. */
const SPARKS = Array.from({ length: 56 }, (_, i) => ({
  a: (i * 137.5) % 360,
  d: 120 + ((i * 53) % 9) * 38,
  s: 0.6 + ((i * 29) % 5) * 0.18,
  delay: (i % 7) * 30,
}));
const SPARK_COUNT: Record<number, number> = { 2: 8, 3: 16, 4: 30, 5: 56 };

type Burst = { key: string; level: number; card: PulledCard; x: number; y: number };

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

export function Projection({ booster, cover, guest = false }: { booster: BoosterDef; cover: Card | null; guest?: boolean }) {
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
  const [burst, setBurst] = useState<Burst | null>(null);
  // La bande attend un clic avant chaque nouvelle vignette.
  const [awaiting, setAwaiting] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);

  const layout = LAYOUTS[layoutName];
  const framesRef = useRef<Frame[]>([]);
  const frameEls = useRef(new Map<string, HTMLDivElement>());
  const holesRef = useRef<SVGPathElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const projector = useRef<Projector | null>(null);
  const motion = useRef({ offset: layout.gate - SPACING, step: null as null | { from: number; start: number }, holdUntil: 0, moving: false, queued: 0, blockUntil: 0, awaiting: false });
  const scaleRef = useRef(1);
  const gatePos = useRef<{ x: number; y: number } | null>(null);
  const timecode = useRef<HTMLSpanElement>(null);
  const startedAt = useRef(0);
  const fastRef = useRef(false);
  const speedRef = useRef<readonly [number, number]>(SPEEDS.normal);
  const introDone = useRef(false);
  const started = useRef(false);
  const batchCount = useRef(0);
  const gateRef = useRef(layout.gate);
  const [gate, setGate] = useState<{ x: number; y: number; angle: number } | null>(null);

  framesRef.current = frames;
  fastRef.current = fast;
  scaleRef.current = scale;

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
    // Animation de rareté : plus la carte est rare, plus elle est grandiose (crans 2 à 5).
    const tier = RARITIES[frame.card.rarity].tier;
    if (tier >= 2 && !fastRef.current) {
      const g = gatePos.current;
      const s = scaleRef.current;
      const origin = tier >= 5 || !g
        ? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        : { x: window.innerWidth / 2 + (g.x - LAYOUTS[window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'].w / 2) * s, y: window.innerHeight / 2 + (g.y - LAYOUTS[window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'].h / 2) * s };
      motion.current.blockUntil = performance.now() + (tier >= 4 ? BURST_MS[tier] : 0);
      setBurst({ key: frame.key, level: tier, card: frame.card, ...origin });
      window.setTimeout(() => setBurst((b) => (b?.key === frame.key ? null : b)), BURST_MS[tier]);
    }
  }, []);

  /** Demande la vignette suivante (clic, Espace, Entrée ou flèche droite). */
  const advance = useCallback(() => {
    const m = motion.current;
    if (m.awaiting || m.step) m.queued = Math.min(m.queued + 1, 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button, a, input')) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

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
      } else if (pending && now >= m.holdUntil && now >= m.blockUntil) {
        // Les amorces passent seules ; chaque carte attend un clic (sauf « Tout révéler »).
        const next = list[Math.round((m.offset - layout.gate) / SPACING) + 1];
        const needsClick = next?.type === 'card' && !fastRef.current;
        if (!needsClick || m.queued > 0) {
          if (needsClick) m.queued -= 1;
          m.step = { from: m.offset, start: now };
        }
      }
      const waiting = !m.step && pending && now >= m.holdUntil && now >= m.blockUntil && !fastRef.current;
      if (waiting !== m.awaiting) {
        m.awaiting = waiting;
        setAwaiting(waiting);
      }
      if (timecode.current) {
        if (!startedAt.current) startedAt.current = now;
        const t = Math.floor((now - startedAt.current) / (1000 / 24));
        const pad = (n: number) => String(n).padStart(2, '0');
        timecode.current.textContent = `00:${pad(Math.floor(t / 1440) % 60)}:${pad(Math.floor(t / 24) % 60)}:${pad(t % 24)}`;
      }

      const moving = m.step !== null;
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
    gatePos.current = { x: p.x, y: p.y };
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
  const best = currentCards.map((f) => f.card).sort((a, b) => RARITIES[b.rarity].entries - RARITIES[a.rarity].entries)[0];

  // Visiteur sans compte : la fenêtre « gardez vos cartes » s'ouvre une fois la bobine révélée.
  useEffect(() => {
    if (!guest || !done) return;
    const id = window.setTimeout(() => setKeepOpen(true), 1400);
    return () => window.clearTimeout(id);
  }, [guest, done]);

  return (
    <div className={styles.screen}>
      <Beam from="left" className={styles.beam} />
      <Dust className={styles.dust} />
      <div className={styles.marks} aria-hidden="true">
        <span /><span /><span /><span />
        <b className={styles.rec}><i />REC</b>
        <b className={styles.tc} ref={timecode}>00:00:00:00</b>
        <em className={styles.sideL}>CLAP · PROJECTION · SALLE 7 · {booster.name.toUpperCase()}</em>
        <em className={styles.sideR}>35 MM · 24 IM/S · VERSION ORIGINALE</em>
      </div>
      {!calm && <button type="button" className={styles.advance} onClick={advance} aria-label="Vignette suivante" tabIndex={-1} />}
      {calm ? (
        <div className={styles.calm}>
          {frames.map((f) => f.type === 'card' && (
            <div key={f.key}><GameCard card={f.card} width={170} serial={f.card.serial} /></div>
          ))}
        </div>
      ) : (
        <div className={`${styles.stage} ${intro === 'done' ? styles.stageOn : ''} ${burst && burst.level >= 4 ? styles.shake : ''}`} style={{ width: layout.w, height: layout.h, transform: `translate(-50%, -50%) scale(${scale})` }}>
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

          {gate && awaiting && (
            <div className={styles.hint} style={{ left: gate.x, top: gate.y }} role="status">
              <span className={styles.hintRing}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" /></svg>
              </span>
              <span className={styles.hintText}>Cliquez pour avancer</span>
              <span className={styles.hintKey}>ou Espace</span>
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

      {burst && (
        <div
          key={burst.key}
          className={`${styles.burst} ${styles[`lv${burst.level}`]}`}
          style={{ '--rc': RARITIES[burst.card.rarity].color, '--bx': `${burst.x}px`, '--by': `${burst.y}px` } as CSSProperties}
          role={burst.level >= 5 ? 'status' : undefined}
          aria-hidden={burst.level < 5 || undefined}
        >
          <span className={styles.dim} />
          <span className={styles.flash} />
          <span className={styles.burstRays} />
          <span className={styles.ring} />
          <span className={`${styles.ring} ${styles.ring2}`} />
          <div className={styles.sparks}>
            {SPARKS.slice(0, SPARK_COUNT[burst.level] ?? 0).map((sp, i) => (
              <i key={i} style={{ '--a': `${sp.a}deg`, '--d': `${sp.d}px`, '--s': sp.s, animationDelay: `${sp.delay}ms` } as CSSProperties} />
            ))}
          </div>
          {burst.level >= 4 && (
            <div className={styles.banner}>
              <span className="eyebrow">◆ {RARITIES[burst.card.rarity].label} ◆</span>
              <strong className="display">{burst.card.character ?? `${burst.card.first} ${burst.card.last}`}</strong>
              <span>{burst.card.kind === 'role' ? `${burst.card.first} ${burst.card.last} · ${burst.card.film}` : `Carte Acteur${burst.card.origin ? ` · ${burst.card.origin}` : ''}`}</span>
            </div>
          )}
          {burst.level >= 5 && (
            <div className={styles.spotCard}><GameCard card={burst.card} width={260} eager live /></div>
          )}
        </div>
      )}

      {keepOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="garder">
          <div className={`modal ${styles.keep}`}>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Bobine offerte</span>
            <h2 id="garder" className="display">Gardez vos {currentCards.length} cartes</h2>
            <p>
              {best && <>Dont <b>{best.character ?? `${best.first} ${best.last}`}</b>, {RARITIES[best.rarity].label}. </>}
              Elles sont mises de côté : créez un compte gratuit et elles rejoignent votre collection, avec 3 bobines offertes et 600 tickets.
            </p>
            <div className={styles.keepCards}>
              {currentCards.map((f) => <GameCard key={f.key} card={f.card} width={92} eager />)}
            </div>
            <div className="actions">
              <Link href="/connexion?mode=inscription&suite=/collection" className="btn btn-primary">Créer mon compte</Link>
              <Link href="/connexion?suite=/collection" className="btn">J’ai déjà un compte</Link>
            </div>
          </div>
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
          <Link href={guest ? '/' : '/collection'} className={styles.round} aria-label="Fermer la projection"><CloseIcon /></Link>
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
            {done && guest && (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setKeepOpen(true)}>Garder mes cartes</button>
            )}
            {done && !guest && (
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
        {done && !guest && !canAfford && !error && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            PLUS DE BOBINE OFFERTE NI ASSEZ DE TICKETS POUR CELLE-CI.
          </span>
        )}
      </div>
    </div>
  );
}
