'use client';

import { useId, useRef, useState } from 'react';
import s from '@/app/labs/[slug]/rad-lab.module.css';
import { useLabEdit } from './LabEditContext';

// Body of Fork Card A ("send me the next lab") and Card B ("workshop
// waitlist"); the card heading itself is ForkCard's. Same 3-step flow for
// both - number + consent, name + role, grade (students only) - posting to
// /api/labs/optin. Card B starts collapsed behind its CTA so the fork reads
// as three clear choices, not two forms.

type Role = 'parent' | 'student';
type Intent = 'next_lab' | 'waitlist';

const GRADES = [
  { value: '4-6', label: 'Grade 4 – 6' },
  { value: '7-9', label: 'Grade 7 – 9' },
  { value: '10-12', label: 'Grade 10 – 12' },
];

// Mirrors normaliseSaPhone in src/lib/labLeads.ts (server is the source of
// truth; this just lets us catch typos before a round trip).
function toIntl(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `27${d.slice(1)}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

function pretty(intl: string): string {
  return intl.startsWith('27') && intl.length === 11
    ? `+27 ${intl.slice(2, 4)} ${intl.slice(4, 7)} ${intl.slice(7)}`
    : `+${intl}`;
}

export function ForkOptIn({
  labSlug, intent, body, ctaLabel, submitLabel, successBody,
}: {
  labSlug: string;
  intent: Intent;
  body: string;
  ctaLabel?: string;          // when set, the form starts collapsed behind this button
  submitLabel: string;
  successBody: string;
}) {
  const uid = useId();
  const editing = !!useLabEdit();
  const [open, setOpen] = useState(!ctaLabel);
  const [step, setStep] = useState<0 | 1 | 2 | 'done'>(0);
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [botField, setBotField] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const intl = toIntl(phone);
  const totalSteps = role === 'student' ? 3 : 2;
  const stepIndex = step === 'done' ? totalSteps : step;

  const focusFirst = () => requestAnimationFrame(() => {
    cardRef.current?.querySelector<HTMLElement>('input:not([tabindex="-1"]), [role="radio"]')?.focus();
  });

  const next = (n: 0 | 1 | 2) => { setError(null); setStep(n); focusFirst(); };

  const submit = async () => {
    if (editing) return setError('Preview only — forms don\'t submit inside the editor.');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/labs/optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, role, grade: role === 'student' ? grade : null, consent, intent, labSlug, bot_field: botField }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onStep0 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intl) return setError('That number doesn\'t look right — try the format 082 123 4567.');
    if (!consent) return setError('Please tick the box so we\'re allowed to WhatsApp you.');
    next(1);
  };
  const onStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Please tell us your name so we know who we\'re talking to.');
    if (!role) return setError('Let us know if you\'re a parent or a student.');
    if (role === 'student') return next(2);
    submit();
  };
  const onStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) return setError('Pick your grade so we send the right level.');
    submit();
  };

  const pips = (
    <div className={s.stepPips} aria-label={`Step ${Math.min(stepIndex + 1, totalSteps)} of ${totalSteps}`} role="img">
      {Array.from({ length: totalSteps }, (_, i) => (
        <span key={i} className={`${s.stepPip} ${i <= stepIndex ? s.stepPipOn : ''}`} />
      ))}
    </div>
  );

  const errorBox = error ? <div className={s.error} role="alert">{error}</div> : null;

  return (
    <div ref={cardRef} className={`${s.fstep} ${s.fillCard}`} style={{ animation: 'none' }}>
      {step === 'done' ? (
        <div className={s.success} role="status">
          <div className={s.successIcon} aria-hidden="true">✓</div>
          <p className={s.successTitle}>You&apos;re on the list, {name.trim().split(' ')[0]}!</p>
          <p className={s.fcardBody}>
            {successBody} We&apos;ll message <strong>{intl ? pretty(intl) : phone}</strong> on WhatsApp.
          </p>
        </div>
      ) : !open ? (
        <>
          <p className={s.fcardBody}>{body}</p>
          <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.pushDown}`} onClick={() => { setOpen(true); focusFirst(); }}>
            {ctaLabel}
          </button>
        </>
      ) : (
        <>
          {step === 0 && <p className={s.fcardBody}>{body}</p>}
          {pips}

          {step === 0 && (
            <form className={s.fstep} onSubmit={onStep0} noValidate>
              <label className={s.fieldLabel} htmlFor={`${uid}-phone`}>Your WhatsApp number</label>
              <input
                id={`${uid}-phone`}
                className={`${s.input} ${error && !intl ? s.inputInvalid : ''}`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="082 123 4567"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(null); }}
              />
              <input className={s.honeypot} tabIndex={-1} autoComplete="off" aria-hidden="true" value={botField} onChange={e => setBotField(e.target.value)} name="company" />
              <label className={s.consent}>
                <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError(null); }} />
                <span>
                  {intent === 'waitlist'
                    ? 'Yes, RAD Academy may WhatsApp me about workshops near me. I can reply STOP at any time.'
                    : 'Yes, RAD Academy may WhatsApp me new labs and occasional workshop news. I can reply STOP at any time.'}
                </span>
              </label>
              {errorBox}
              <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnFull}`}>Continue →</button>
            </form>
          )}

          {step === 1 && (
            <form className={s.fstep} onSubmit={onStep1} noValidate>
              <label className={s.fieldLabel} htmlFor={`${uid}-name`}>Your name</label>
              <input
                id={`${uid}-name`}
                className={s.input}
                type="text"
                autoComplete="given-name"
                placeholder="Your first name"
                maxLength={80}
                aria-required="true"
                value={name}
                onChange={e => { setName(e.target.value); setError(null); }}
              />
              <span className={s.fieldLabel} id={`${uid}-role`}>I am a…</span>
              <div className={s.seg} role="radiogroup" aria-labelledby={`${uid}-role`}>
                {(['parent', 'student'] as Role[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    className={s.segBtn}
                    onClick={() => { setRole(r); setError(null); }}
                  >
                    {r === 'parent' ? 'Parent' : 'Student'}
                  </button>
                ))}
              </div>
              {role === 'student' && (
                <p className={s.hint}>Under 18? Please check with a parent or guardian before sharing a phone number.</p>
              )}
              {errorBox}
              <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnFull}`} disabled={busy}>
                {busy ? <span className={s.spinner} aria-label="Sending" /> : role === 'student' ? 'Next →' : submitLabel}
              </button>
              <button type="button" className={s.backLink} onClick={() => next(0)}>← Change number</button>
            </form>
          )}

          {step === 2 && (
            <form className={s.fstep} onSubmit={onStep2} noValidate>
              <span className={s.fieldLabel} id={`${uid}-grade`}>What grade are you in?</span>
              <div className={`${s.seg} ${s.segCol}`} role="radiogroup" aria-labelledby={`${uid}-grade`}>
                {GRADES.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    role="radio"
                    aria-checked={grade === g.value}
                    className={s.segBtn}
                    onClick={() => { setGrade(g.value); setError(null); }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {errorBox}
              <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnFull}`} disabled={busy}>
                {busy ? <span className={s.spinner} aria-label="Sending" /> : submitLabel}
              </button>
              <button type="button" className={s.backLink} onClick={() => next(1)}>← Back</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
