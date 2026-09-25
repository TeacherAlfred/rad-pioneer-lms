'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import s from '@/app/labs/[slug]/rad-lab.module.css';
import { STEP_EVENT } from './StepSlider';
import { useLabEdit } from './LabEditContext';

// Zone 8: floating "I need help" button + dialog. Posts to /api/labs/help,
// which flags the lead needs_human and alerts admin. The step the child is
// on (broadcast by StepSlider) rides along so we know where they're stuck.

type Role = 'parent' | 'student';
type Urgency = 'medium' | 'high';

const URGENCY: { value: Urgency; label: string }[] = [
  { value: 'medium', label: 'Soon as possible' },
  { value: 'high', label: 'Blocking me right now' },
];

// "Online" = inside published response hours (Mon–Fri 10:00–18:00 SAST).
// Computed client-side so the page stays static; no admin flag needed.
function isOnlineNow(): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const day = parts.find(p => p.type === 'weekday')?.value;
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  return !!day && !['Sat', 'Sun'].includes(day) && hour >= 10 && hour < 18;
}

const toIntl = (raw: string) => {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `27${d.slice(1)}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
};

export function HelpSheet({ labSlug }: { labSlug: string }) {
  const uid = useId();
  const editing = !!useLabEdit();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [online, setOnline] = useState(false);
  const [hideFab, setHideFab] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [botField, setBotField] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const stepRef = useRef<string>('');
  const fabRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOnline(isOnlineNow());
    const id = setInterval(() => setOnline(isOnlineNow()), 60_000);
    const onStep = (e: Event) => { stepRef.current = (e as CustomEvent).detail?.title || ''; };
    window.addEventListener(STEP_EVENT, onStep);
    // On phones the on-screen keyboard pushes the FAB over the fork form's
    // inputs - tuck it away while any other field on the page has focus.
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (window.innerWidth <= 640 && t.matches('input, textarea') && !sheetRef.current?.contains(t)) setHideFab(true);
    };
    const onFocusOut = () => setHideFab(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      clearInterval(id);
      window.removeEventListener(STEP_EVENT, onStep);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }, []);

  // Dialog behaviour: lock page scroll, Esc closes, Tab stays inside.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const f = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([tabindex="-1"]), textarea, [href]'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prevOverflow; document.removeEventListener('keydown', onKey); };
  }, [open, close]);

  const reset = () => { setDone(false); setMessage(''); setError(null); setUrgency('medium'); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Please tell us your name so we know who to ask for.');
    if (!role) return setError('Let us know if you\'re a parent or a student.');
    if (message.trim().length < 3) return setError('Tell us a little about what\'s going on.');
    if (!toIntl(phone)) return setError('Please add a number we can reach you on, e.g. 082 123 4567.');
    if (editing) return setError('Preview only — forms don\'t submit inside the editor.');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/labs/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, urgency, message, phone, labSlug, step: stepRef.current, bot_field: botField }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setDone(true);
      requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className={`${s.fab} ${hideFab || open ? s.fabHidden : ''}`}
        onClick={() => { if (done) reset(); setOpen(true); }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={`${s.presence} ${online ? s.presenceOn : ''}`} aria-hidden="true" />
        I need help
        <span className={s.srOnly}>{online ? '(we\'re online now)' : '(we\'ll reply in business hours)'}</span>
      </button>

      {open && (
        <div className={s.overlay}>
          <div className={s.backdrop} onClick={close} aria-hidden="true" />
          <div ref={sheetRef} className={s.sheet} role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
            <div className={s.handle} aria-hidden="true" />

            {done ? (
              <div className={s.sheetSuccess} role="status">
                <div className={s.successIcon} aria-hidden="true">✓</div>
                <h2 className={s.sheetTitle} id={`${uid}-title`}>Message received</h2>
                <p className={s.fcardBody} style={{ maxWidth: 340 }}>
                  {online
                    ? 'Thanks — someone from the team will get back to you shortly.'
                    : 'Thanks — we\'re offline right now, and we\'ll get back to you first thing in business hours (Mon–Fri, 10:00–18:00).'}
                </p>
                <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={close} data-autofocus>Back to the lab</button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className={s.sheetHead}>
                  <div>
                    <h2 className={s.sheetTitle} id={`${uid}-title`}>Get help</h2>
                    <p className={s.sheetSub}>
                      <span className={`${s.presence} ${online ? s.presenceOn : ''}`} aria-hidden="true" />
                      {online ? 'We\'re online now.' : 'We\'re offline — we\'ll reply in business hours.'}
                    </p>
                  </div>
                  <button type="button" className={s.closeBtn} onClick={close} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                </div>

                <div className={s.sheetForm}>
                  <div className={s.field}>
                    <label className={s.fieldLabel} htmlFor={`${uid}-name`}>Your name</label>
                    <input
                      id={`${uid}-name`}
                      className={s.input}
                      type="text"
                      autoComplete="name"
                      placeholder="So we know who to ask for"
                      maxLength={80}
                      aria-required="true"
                      value={name}
                      onChange={e => { setName(e.target.value); setError(null); }}
                      data-autofocus
                    />
                  </div>

                  <fieldset className={s.field}>
                    <legend className={s.fieldLabel} style={{ marginBottom: 8 }}>I am a…</legend>
                    <div className={s.seg} role="radiogroup">
                      {(['parent', 'student'] as Role[]).map(r => (
                        <button key={r} type="button" role="radio" aria-checked={role === r} className={s.segBtn}
                          onClick={() => { setRole(r); setError(null); }}>
                          {r === 'parent' ? 'Parent' : 'Student'}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className={s.field}>
                    <label className={s.fieldLabel} htmlFor={`${uid}-msg`}>What do you need help with?</label>
                    <textarea
                      id={`${uid}-msg`}
                      className={`${s.input} ${s.textarea}`}
                      placeholder="e.g. The simulator won't respond when I press A."
                      maxLength={1000}
                      value={message}
                      onChange={e => { setMessage(e.target.value); setError(null); }}
                    />
                  </div>

                  <fieldset className={s.field}>
                    <legend className={s.fieldLabel} style={{ marginBottom: 8 }}>How urgent is it?</legend>
                    <div className={s.seg} role="radiogroup">
                      {URGENCY.map(u => (
                        <button key={u.value} type="button" role="radio" aria-checked={urgency === u.value} className={s.segBtn}
                          onClick={() => setUrgency(u.value)}>
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className={s.field}>
                    <label className={s.fieldLabel} htmlFor={`${uid}-tel`}>Your number, so we can call or WhatsApp you back</label>
                    <input
                      id={`${uid}-tel`}
                      className={s.input}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="082 123 4567"
                      value={phone}
                      onChange={e => { setPhone(e.target.value); setError(null); }}
                    />
                    <input className={s.honeypot} tabIndex={-1} autoComplete="off" aria-hidden="true" value={botField} onChange={e => setBotField(e.target.value)} name="company" />
                  </div>

                  {error && <div className={s.error} role="alert">{error}</div>}
                </div>

                <div className={s.sheetActions}>
                  <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnFull}`} disabled={busy}>
                    {busy ? <span className={s.spinner} aria-label="Sending" /> : 'Send →'}
                  </button>
                  <p className={s.hint} style={{ textAlign: 'center' }}>
                    We reply during business hours: Mon–Fri, 10:00–18:00, and some weekends.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
