'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { readNotifications } from '@/app/actions';
import type { Notification } from '@/lib/notify';
import styles from './NotificationBell.module.css';

function ago(t: number): string {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'À L’INSTANT';
  if (s < 3600) return `IL Y A ${Math.round(s / 60)} MIN`;
  if (s < 86400) return `IL Y A ${Math.round(s / 3600)} H`;
  return `IL Y A ${Math.round(s / 86400)} J`;
}

const DOT: Record<string, string> = { pull: 'var(--icon)', trade: 'var(--accent)', sale: 'var(--ok)', friend: 'var(--accent)', referral: 'var(--gold)' };

export function NotificationBell({ notifications, unread }: { notifications: Notification[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.bell}
        aria-label={unread ? `Notifications, ${unread} non lues` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.head}>
            <strong className="display">Notifications</strong>
            {unread > 0 && (
              <button type="button" onClick={() => startTransition(() => readNotifications())}>Tout marquer comme lu</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className={styles.empty}>Rien de neuf pour l’instant.</p>
          ) : (
            <ul>
              {notifications.map((n) => {
                const body = (
                  <>
                    <span className={styles.dot} style={{ background: n.read ? 'transparent' : (DOT[n.kind] ?? 'var(--accent)') }} />
                    <span className={styles.text}>
                      <span style={{ color: n.read ? 'var(--muted)' : 'var(--text)' }}>{n.text}</span>
                      <small>{ago(n.createdAt)}</small>
                    </span>
                  </>
                );
                return (
                  <li key={n.id} className={n.read ? '' : styles.unread}>
                    {n.href ? <Link href={n.href} onClick={() => setOpen(false)}>{body}</Link> : <div>{body}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
