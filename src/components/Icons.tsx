type IconProps = { size?: number; color?: string };

/** Ticket de caisse : la monnaie que l'on dépense. */
export function TicketIcon({ size = 22, color = 'var(--accent)' }: IconProps) {
  return (
    <svg width={size} height={(size * 16) / 22} viewBox="0 0 22 16" aria-hidden="true">
      <path d="M2 1h18a1 1 0 0 1 1 1v3.5a2.5 2.5 0 0 0 0 5V14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3.5a2.5 2.5 0 0 0 0-5V2a1 1 0 0 1 1-1Z" fill={color} />
      <path d="M15 3v10" stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="1.6 1.6" />
    </svg>
  );
}

/** Fauteuil de salle : les entrées, valeur de la collection. */
export function SeatIcon({ size = 16, color = 'var(--text)' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4.5" y="2" width="11" height="9.5" rx="2.6" fill={color} />
      <rect x="2" y="10" width="16" height="4.6" rx="1.8" fill={color} />
      <rect x="4" y="14" width="2" height="4" rx="0.6" fill={color} />
      <rect x="14" y="14" width="2" height="4" rx="0.6" fill={color} />
    </svg>
  );
}

export function SoundIcon({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a10 10 0 0 1 0 14" />
        </>
      ) : (
        <path d="m22 9-6 6M16 9l6 6" />
      )}
    </svg>
  );
}

export function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
