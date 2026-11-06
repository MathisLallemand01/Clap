import { BADGE_ICONS } from '@/lib/badgeIcons';

/** Couronne de lauriers de festival, avec l'icône de la distinction au centre. */
export function Laurel({ color, icon, size = 78, locked = false, label }: { color: string; icon: string; size?: number; locked?: boolean; label?: string }) {
  const leaves: { cx: number; cy: number; rot: number }[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const deg = side === -1 ? 250 - i * 20 : 290 + i * 20;
      const a = (deg * Math.PI) / 180;
      leaves.push({ cx: 50 + 38 * Math.cos(a), cy: 50 - 38 * Math.sin(a), rot: -deg + 22 * side });
    }
  }
  const paths = (BADGE_ICONS[icon] ?? BADGE_ICONS.star).split('|');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ opacity: locked ? 0.35 : 1, flex: 'none' }}>
      {leaves.map((l, i) => (
        <ellipse key={i} cx={l.cx.toFixed(1)} cy={l.cy.toFixed(1)} rx="4.4" ry="9.5" transform={`rotate(${l.rot} ${l.cx.toFixed(1)} ${l.cy.toFixed(1)})`} fill={locked ? '#5b5b63' : color} />
      ))}
      <circle cx="50" cy="50" r="25" fill="#141418" stroke={locked ? '#5b5b63' : color} strokeWidth="2" />
      <g transform="translate(38 38)" fill="none" stroke={locked ? '#5b5b63' : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
}
