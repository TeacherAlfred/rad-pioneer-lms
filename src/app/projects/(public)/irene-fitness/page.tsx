'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const GRADES = ['R', '1', '2', '3', '4', '5', '6', '7'];
const MAX_CHILDREN = 6;

type ChildRow = { grade: string; class: string };
type Step = 'loading' | 'consent' | 'submission' | 'confirmation';

const SOURCE_MAP: Record<string, string> = {
  paper_qr: 'irene_paper_qr',
  web_direct: 'irene_web_direct',
  gallery_cta: 'irene_gallery_cta',
};

function emptyChild(): ChildRow {
  return { grade: '', class: '' };
}

function IreneFitnessPageInner() {
  const searchParams = useSearchParams();
  const consentSource = SOURCE_MAP[searchParams.get('src') || ''] || 'irene_web_direct';

  const [step, setStep] = useState<Step>('loading');
  const [isReturning, setIsReturning] = useState(false);

  const [consentTicked, setConsentTicked] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([emptyChild()]);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedName, setConfirmedName] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/irene-fitness/family')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.family) {
          setDisplayName(data.family.display_name || '');
          setWhatsapp(data.family.whatsapp || '');
          setEmail(data.family.email || '');
          setChildren(data.family.children?.length ? data.family.children : [emptyChild()]);
          setIsReturning(true);
          setConsentTicked(true);
          setStep('submission');
        } else {
          setStep('consent');
        }
      })
      .catch(() => {
        if (!cancelled) setStep('consent');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateChild(index: number, field: keyof ChildRow, value: string) {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addChild() {
    setChildren((prev) => (prev.length >= MAX_CHILDREN ? prev : [...prev, emptyChild()]));
  }

  function removeChild(index: number) {
    setChildren((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const waDigits = whatsapp.replace(/\D/g, '');
  const canSubmit =
    displayName.trim().length > 0 &&
    displayName.trim().length <= 40 &&
    (waDigits.length > 0 || email.trim().length > 0) &&
    children.every((c) => c.grade && c.class.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/irene-fitness/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          consent_source: consentSource,
          display_name: displayName.trim(),
          whatsapp: waDigits || null,
          email: email.trim() || null,
          children,
          consent_marketing: marketingOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setConfirmedName(data.display_name);
      setStep('confirmation');
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLateOptIn() {
    setMarketingOptIn(true);
    try {
      await fetch('/api/irene-fitness/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          consent_source: consentSource,
          display_name: confirmedName || displayName.trim(),
          whatsapp: waDigits || null,
          email: email.trim() || null,
          children,
          consent_marketing: true,
        }),
      });
    } catch {
      // Best-effort — the family record is already saved, this only adds the
      // marketing opt-in on top of it.
    }
  }

  if (step === 'loading') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center text-slate-400 text-sm">Loading…</div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-16">
      {step === 'consent' && (
        <div>
          <h2 className="text-2xl font-black tracking-tight mb-4">Before we start</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            Irene Primary is running a fitness challenge alongside our health &amp; wellness community
            initiative — shared events, guest speakers, and getting kids active and involved.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            To take part, we just need one thing from you first.
          </p>

          <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={consentTicked}
              onChange={(e) => setConsentTicked(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
            />
            <span className="text-sm leading-relaxed">
              I consent to my family&apos;s response being shown publicly, under the name I choose to give it
              below. <strong>Nothing about my child</strong> — name, grade, class, or any other detail — is ever
              displayed.
            </span>
          </label>

          <button
            disabled={!consentTicked}
            onClick={() => setStep('submission')}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {step === 'submission' && (
        <div>
          <h2 className="text-2xl font-black tracking-tight mb-1">
            {isReturning ? 'Update your response' : 'Your family\'s response'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {isReturning ? 'Change anything below, then save.' : 'Just a couple of quick things.'}
          </p>

          {/* Public section */}
          <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#0066cc]/10 px-2 py-1 rounded-full">
                Public
              </span>
              <span className="text-xs text-slate-500">Anyone can see this</span>
            </div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Display name</label>
            <input
              type="text"
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sarah or The Smith Family"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
            />
            <p className="text-xs text-slate-400 mt-2">
              This is the only thing anyone sees. You could use a first name, but it&apos;s your choice.
            </p>
          </div>

          {/* Private: children */}
          <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                Private
              </span>
              <span className="text-xs text-slate-500">Never shown to anyone</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              We only use this to work out which class wins the class prize.
            </p>

            {children.map((child, i) => (
              <div key={i} className="flex items-end gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Grade</label>
                  <select
                    value={child.grade}
                    onChange={(e) => updateChild(i, 'grade', e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  >
                    <option value="">Select</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class</label>
                  <input
                    type="text"
                    value={child.class}
                    onChange={(e) => updateChild(i, 'class', e.target.value)}
                    placeholder="e.g. 3A"
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  />
                </div>
                {children.length > 1 && (
                  <button
                    onClick={() => removeChild(i)}
                    aria-label="Remove child"
                    className="mb-1 w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {children.length < MAX_CHILDREN && (
              <button
                onClick={addChild}
                className="text-xs font-bold text-[#0066cc] hover:underline"
              >
                + Add another child
              </button>
            )}
          </div>

          {/* Private: linking */}
          <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                Private
              </span>
              <span className="text-xs text-slate-500">Never displayed publicly</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              We ask for a contact number or email so your family&apos;s response stays as one entry, even if
              you come back and update it later — not to sign you up for anything.
            </p>

            <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp number (preferred)</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="e.g. 082 123 4567"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
            />
            <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
            />
            {!waDigits && !email.trim() && (
              <p className="text-xs text-amber-600 mt-2">Please provide at least one of these.</p>
            )}
          </div>

          {/* Marketing opt-in, separate */}
          <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
            />
            <span className="text-sm leading-relaxed text-slate-600">
              I&apos;d also like to be notified of next steps in this community initiative, and to receive
              information about RAD Academy&apos;s coding and robotics programmes.
            </span>
          </label>

          {submitError && <p className="text-sm text-red-600 mb-4">{submitError}</p>}

          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          >
            {submitting ? 'Saving…' : isReturning ? 'Save changes' : 'Submit'}
          </button>
        </div>
      )}

      {step === 'confirmation' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center text-3xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-3">Thanks, {confirmedName}!</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-2">
            Your family&apos;s response has been saved. Don&apos;t forget — there are class prizes for Grade
            R–3 and Grade 4–7.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Voting hasn&apos;t opened yet — we&apos;ll share the link and date once it&apos;s live.
          </p>
          {!marketingOptIn && (
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-6 cursor-pointer text-left">
              <input
                type="checkbox"
                onChange={(e) => e.target.checked && handleLateOptIn()}
                className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
              />
              <span className="text-sm leading-relaxed text-slate-600">
                Actually, I&apos;d like to be notified of next steps and RAD Academy&apos;s coding &amp;
                robotics programmes.
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export default function IreneFitnessPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-24 text-center text-slate-400 text-sm">Loading…</div>}>
      <IreneFitnessPageInner />
    </Suspense>
  );
}
