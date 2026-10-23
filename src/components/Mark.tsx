type MarkProps = {
  size?: number;
  bg?: string;
  fg?: string;
  /** Couleur des perforations : celle du fond sur lequel le symbole est posé. */
  hole?: string;
};

/** Le symbole « photogramme » : 3 perforations, une ligne d'image et le C. */
export function Mark({ size = 40, bg = 'var(--accent)', fg = 'var(--ink)', hole = 'var(--ink)' }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Clap">
      <rect width="120" height="120" rx="26" fill={bg} />
      <rect x="13" y="22" width="15" height="19" rx="4" fill={hole} />
      <rect x="13" y="50.5" width="15" height="19" rx="4" fill={hole} />
      <rect x="13" y="79" width="15" height="19" rx="4" fill={hole} />
      <rect x="38" y="14" width="2.5" height="92" rx="1.25" fill={hole} opacity="0.35" />
      <text x="80" y="101" textAnchor="middle" fontSize="104" fontWeight="900" fill={fg} style={{ fontStretch: '62%', fontFamily: 'var(--display)' }}>
        C
      </text>
    </svg>
  );
}

/** Le logotype de navigation : perforations + CLAP. */
export function Wordmark({ size = 28 }: { size?: number }) {
  const hole = { width: size * 0.29, height: size * 0.21, borderRadius: 2, background: 'var(--accent)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.43 }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: size * 0.1 }} aria-hidden="true">
        <span style={hole} />
        <span style={hole} />
        <span style={hole} />
      </span>
      <span className="display" style={{ fontSize: size, letterSpacing: '0.02em', lineHeight: 1 }}>CLAP</span>
    </span>
  );
}
