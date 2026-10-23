'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { FormState } from '@/app/actions';

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

function Message({ state }: { state: FormState }) {
  if (state?.error) return <p className="form-error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="form-ok" role="status">{state.ok}</p>;
  return null;
}

type Field = { name: string; label: string; type: string; autoComplete: string; hint?: string; minLength?: number };

/** Formulaire de compte (inscription, connexion, mot de passe) avec erreurs renvoyées par le serveur. */
export function AccountForm({
  action, fields, submit, next, footer,
}: { action: Action; fields: Field[]; submit: string; next?: string; footer?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="form" noValidate={false}>
      {next && <input type="hidden" name="next" value={next} />}
      {fields.map((f) => (
        <label key={f.name} className="field">
          <span>{f.label}</span>
          <input
            className="input"
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            required
            minLength={f.minLength}
            defaultValue={f.type === 'password' ? undefined : state?.values?.[f.name]}
            aria-invalid={state?.field === f.name || undefined}
          />
          {f.hint && <small>{f.hint}</small>}
        </label>
      ))}
      <Message state={state} />
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Un instant…' : submit}</button>
      {footer}
    </form>
  );
}

/** Un bouton qui déclenche une action serveur (prime du jour, recyclage) et affiche le résultat. */
export function ActionButton({
  action, label, hidden, className = 'btn btn-sm', disabled,
}: { action: Action; label: string; hidden?: Record<string, string>; className?: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="action-form">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className={className} disabled={pending || disabled}>{pending ? 'Un instant…' : label}</button>
      <Message state={state} />
    </form>
  );
}

export function AuthSwitch({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <p className="form-switch">
      {text} <Link href={href}>{label}</Link>
    </p>
  );
}
