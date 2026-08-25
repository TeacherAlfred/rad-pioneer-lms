"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle2, ShieldCheck, ArrowRight, MapPin, Star } from "lucide-react";

type DateOption = { id: string; label: string; starts_at: string; description?: string };

export type RegisterInterestProgram = {
  id: string;
  title: string;
  location: string | null;
  formLabel: string | null;
  date_options?: DateOption[];
  allow_multi_date?: boolean;
  // Admin-set per program (featured_programs.counts_general_attendees) -
  // some programs (e.g. an online webinar) might be attended by a parent
  // alone, a parent and kids, or just kids, so "number of children" isn't
  // always the right question. Swaps the headcount label, consent wording,
  // and validation message to attendee-neutral phrasing when true.
  countsGeneralAttendees?: boolean;
};

// When a program allows it, offer one extra "all dates" choice alongside
// the individual ones (e.g. Polokwane's Sat+Sun circuit) - synthesized
// client-side by joining every date's id ("+") and label (" + "), rather
// than a new relational structure. The submit route splits the composite
// id back apart to resolve it (see /api/register-interest/submit).
export function dateOptionsWithCombo(dateOptions: DateOption[], allowMultiDate: boolean | undefined): DateOption[] {
  if (!allowMultiDate || dateOptions.length < 2) return dateOptions;
  return [
    ...dateOptions,
    {
      id: dateOptions.map(d => d.id).join('+'),
      label: dateOptions.map(d => d.label).join(' + '),
      starts_at: dateOptions[0].starts_at,
      description: dateOptions.map(d => d.description).filter(Boolean).join(' · '),
    },
  ];
}

type Step = 'email' | 'confirm' | 'details' | 'package' | 'success';

type PackageOption = {
  id: string;
  tier_role: 'anchor' | 'recommended' | 'lighter' | null;
  display_order: number;
  final_fee: number;
  package: { id: string; name: string; event_type: string; description: string | null; child_facing_blurb: string | null };
};

const INPUT_CLS = "w-full h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 font-bold focus:border-rad-blue outline-none text-slate-900 text-sm placeholder:text-slate-400 placeholder:font-normal";
const LABEL_CLS = "text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1";

// Preview-mode dummy data - only used when previewMode is true, never sent
// anywhere real (the fields exist purely so the "details" step isn't blank).
const PREVIEW_DEFAULTS = {
  email: 'preview@example.com',
  fullName: 'Preview Parent',
  whatsapp: '+27000000000',
  numberOfChildren: '2',
};

export default function RegisterInterestModal({ program, onClose, previewMode }: { program: RegisterInterestProgram; onClose: () => void; previewMode?: boolean }) {
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [botField, setBotField] = useState('');

  const [hasWhatsappOnFile, setHasWhatsappOnFile] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'last4' | 'code'>('last4');
  const [confirmValue, setConfirmValue] = useState('');
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [retypeEmail, setRetypeEmail] = useState('');

  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [numberOfChildren, setNumberOfChildren] = useState('1');
  const [dateOptionId, setDateOptionId] = useState('');
  const [consent, setConsent] = useState(false);

  const [attribution, setAttribution] = useState<{ utm_source?: string; utm_campaign?: string; referrer?: string }>({});

  const [leadId, setLeadId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectingPackageId, setSelectingPackageId] = useState<string | null>(null);
  const [quoteLink, setQuoteLink] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAttribution({
      utm_source: params.get('utm_source') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      referrer: document.referrer || undefined,
    });
  }, []);

  const dateOptions = dateOptionsWithCombo(program.date_options || [], program.allow_multi_date);

  // Pre-fill every field a real visitor would type, so clicking through
  // every screen needs zero typing - nothing here is ever sent to a
  // mutating endpoint (see submitEmail/submitDetails/choosePackage below).
  useEffect(() => {
    if (!previewMode) return;
    setEmail(PREVIEW_DEFAULTS.email);
    setFullName(PREVIEW_DEFAULTS.fullName);
    setWhatsapp(PREVIEW_DEFAULTS.whatsapp);
    setNumberOfChildren(PREVIEW_DEFAULTS.numberOfChildren);
    setConsent(true);
    if (dateOptions.length > 0) setDateOptionId(dateOptions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // Preview mode always walks the "new visitor" path (skips the real
    // lookup + the confirm step it can lead to) - confirm exists purely to
    // verify a real returning lead's identity, which doesn't apply here.
    if (previewMode) { setStep('details'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/register-interest/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      if (data.found) {
        setHasWhatsappOnFile(data.hasWhatsapp);
        setConfirmValue('');
        setRetypeEmail('');
        setStep('confirm');
        if (data.hasWhatsapp) {
          // Something on file to check the last 4 digits against.
          setConfirmMode('last4');
          setCodeSent(false);
        }
        // No phone on file: nothing to check last-4 digits against, and
        // no unsolicited email code either - the "confirm" step renders a
        // plain retype-your-email-or-just-fill-in-the-form choice instead
        // (see the !hasWhatsappOnFile branch below).
      } else {
        setStep('details');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmByEmailRetype() {
    if (retypeEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setError("That doesn't match the email you entered - check for typos, or just continue below.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/register-interest/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), method: 'email', value: retypeEmail.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError("That doesn't match the email you entered - check for typos, or just continue below.");
        return;
      }
      setConfirmToken(data.token);
      setStep('details');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function continueWithFreshForm() {
    setError(null);
    setStep('details');
  }

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/register-interest/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send a code.');
      setConfirmMode('code');
      setConfirmValue('');
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/register-interest/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), method: confirmMode, value: confirmValue.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfirmToken(data.token);
        setStep('details');
        return;
      }
      if (data.exhausted) {
        // SOP §3.5 - a shortcut, never a gate. Fall through silently.
        setStep('details');
        return;
      }
      setError(`That didn't match. ${data.remainingAttempts ?? ''} attempt${data.remainingAttempts === 1 ? '' : 's'} left.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function skipConfirmation() {
    setStep('details');
  }

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const n = parseInt(numberOfChildren, 10);
    if (!n || n < 1) return setError(program.countsGeneralAttendees ? 'Please enter at least 1 attendee.' : 'Please enter at least 1 child.');
    if (!confirmToken && !fullName.trim()) return setError('Please enter your name.');
    if (!consent) return setError('Please confirm the consent checkbox to continue.');

    setBusy(true);
    try {
      // Preview mode never calls /submit - that's the route that actually
      // writes the leads/lead_activities/event_registrations rows and pings
      // admin on WhatsApp. The packages list below is still the real,
      // published-pricing endpoint (read-only) so what you see here is
      // accurate, just fed by a fake leadId that never touches select-package.
      if (previewMode) {
        setLeadId('preview');
        try {
          const pkgRes = await fetch(`/api/register-interest/packages?program_id=${program.id}`);
          const pkgData = await pkgRes.json();
          if (pkgRes.ok && Array.isArray(pkgData.rows) && pkgData.rows.length > 0) {
            setPackages(pkgData.rows);
            setStep('package');
            return;
          }
        } catch {
          // Same graceful fallback as the real flow below.
        }
        setStep('success');
        return;
      }

      const res = await fetch('/api/register-interest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: program.id,
          date_option_id: dateOptionId || null,
          number_of_children: n,
          preferred_channel: preferredChannel,
          email: email.trim(),
          full_name: confirmToken ? undefined : fullName.trim(),
          whatsapp_number: confirmToken ? undefined : (whatsapp.trim() || undefined),
          consent: true,
          confirm_token: confirmToken || undefined,
          utm_source: attribution.utm_source,
          utm_campaign: attribution.utm_campaign,
          referrer: attribution.referrer,
          bot_field: botField,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setLeadId(data.leadId);

      // Fully automatic self-serve pricing: if this program has any
      // published packages, show them immediately rather than waiting for
      // an admin - the founder's call, since this ICP isn't price-sensitive
      // and seeing price now speeds the funnel rather than slowing it.
      try {
        const pkgRes = await fetch(`/api/register-interest/packages?program_id=${program.id}`);
        const pkgData = await pkgRes.json();
        if (pkgRes.ok && Array.isArray(pkgData.rows) && pkgData.rows.length > 0) {
          setPackages(pkgData.rows);
          setStep('package');
          return;
        }
      } catch {
        // Fall through to the plain success screen - pricing is a bonus on
        // top of the confirmed registration, not a blocker for it.
      }
      setStep('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function choosePackage(eventPackageId: string) {
    if (!leadId) return;
    // Preview mode never calls /select-package - that's the route that
    // creates a real quote and sends a real WhatsApp/email. Simulate the
    // transition instead, no quote link since none was created.
    if (previewMode) {
      setSelectingPackageId(eventPackageId);
      setQuoteLink(null);
      setStep('success');
      setSelectingPackageId(null);
      return;
    }
    setSelectingPackageId(eventPackageId);
    setError(null);
    try {
      const res = await fetch('/api/register-interest/select-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, eventPackageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send that quote. Please try again.');
      setQuoteLink(data.quoteLink);
      setStep('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSelectingPackageId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />

      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }}
        className="relative w-full max-w-md bg-white rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <button onClick={onClose} className="absolute top-5 right-5 p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-900 z-20">
          <X size={18} />
        </button>

        <div className="p-8 overflow-y-auto">
          {previewMode && (
            <div className="mb-5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold text-center">
              🧪 Preview mode — nothing here gets saved or sent
            </div>
          )}
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rad-blue mb-2">Register Interest</p>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-tight">{program.title}</h2>
            {program.location && (
              <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                <MapPin size={12} />
                <span className="text-[11px] font-bold uppercase tracking-widest">{program.location}</span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.form key="email" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onSubmit={submitEmail} className="space-y-4">
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Email</label>
                  <input required type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} className={INPUT_CLS} placeholder="parent@email.com" />
                </div>
                <input type="text" value={botField} onChange={e => setBotField(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                {error && <p className="text-red-600 text-xs font-bold">{error}</p>}
                <button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ArrowRight size={14} /></>}
                </button>
              </motion.form>
            )}

            {step === 'confirm' && !hasWhatsappOnFile && (
              <motion.div key="confirm-email-only" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="p-3 rounded-xl bg-rad-blue/10 border border-rad-blue/20 text-[12px] text-slate-700">
                  We found this email on file, but don't have a phone number saved to double-check it's you the usual way. Retype your email to confirm, or just continue and fill in your details below — we'll match it up on our end either way.
                </div>

                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Retype your email to confirm</label>
                  <input type="email" autoFocus value={retypeEmail} onChange={e => setRetypeEmail(e.target.value)} className={INPUT_CLS} placeholder="parent@email.com" />
                </div>

                {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

                <div className="space-y-2">
                  <button type="button" onClick={confirmByEmailRetype} disabled={busy} className="w-full h-12 rounded-xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <>Confirm — this is me <ShieldCheck size={14} /></>}
                  </button>
                  <button type="button" onClick={continueWithFreshForm} disabled={busy} className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-black uppercase italic tracking-widest text-xs hover:bg-slate-100 transition-all disabled:opacity-50">
                    Just let me fill in the form
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'confirm' && hasWhatsappOnFile && (
              <motion.form key="confirm" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onSubmit={submitConfirm} className="space-y-4">
                <div className="p-3 rounded-xl bg-rad-blue/10 border border-rad-blue/20 text-[12px] text-slate-700">
                  Looks like we've got your details on file — confirm it's you and we'll fill in the rest.
                </div>

                {confirmMode === 'last4' ? (
                  <div className="space-y-1.5">
                    <label className={LABEL_CLS}>Last 4 digits of your WhatsApp number</label>
                    <input required inputMode="numeric" maxLength={4} autoFocus value={confirmValue} onChange={e => setConfirmValue(e.target.value.replace(/\D/g, ''))} className={`${INPUT_CLS} tracking-[0.3em] text-center`} placeholder="••••" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className={LABEL_CLS}>{codeSent ? 'Enter the code we emailed you' : 'We\'ll email you a code'}</label>
                    <input required inputMode="numeric" maxLength={6} autoFocus value={confirmValue} onChange={e => setConfirmValue(e.target.value.replace(/\D/g, ''))} className={`${INPUT_CLS} tracking-[0.3em] text-center`} placeholder="••••••" />
                  </div>
                )}

                {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

                <button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Confirm <ShieldCheck size={14} /></>}
                </button>

                <div className="flex items-center justify-between text-[11px] font-bold">
                  {confirmMode === 'last4' && hasWhatsappOnFile ? (
                    <button type="button" onClick={requestCode} className="text-rad-blue hover:text-slate-900 transition-colors">Send me a code instead</button>
                  ) : confirmMode === 'code' ? (
                    <button type="button" onClick={requestCode} disabled={busy} className="text-rad-blue hover:text-slate-900 transition-colors disabled:opacity-50">Resend code</button>
                  ) : <span />}
                  <button type="button" onClick={skipConfirmation} className="text-slate-400 hover:text-slate-900 transition-colors">This isn't me</button>
                </div>
              </motion.form>
            )}

            {step === 'details' && (
              <motion.form key="details" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onSubmit={submitDetails} className="space-y-4">
                {!confirmToken && (
                  <>
                    <div className="space-y-1.5">
                      <label className={LABEL_CLS}>Your Name</label>
                      <input required autoFocus value={fullName} onChange={e => setFullName(e.target.value)} className={INPUT_CLS} placeholder="Jane Doe" />
                    </div>
                    <div className="space-y-1.5">
                      <label className={LABEL_CLS}>WhatsApp Number</label>
                      <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={INPUT_CLS} placeholder="+27..." />
                      <p className="text-[11px] text-slate-400 ml-1">Add a WhatsApp number for faster updates — or leave blank for email.</p>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>{program.countsGeneralAttendees ? 'Number of Attendees' : 'Number of Children'}</label>
                  <input required type="number" min={1} value={numberOfChildren} onChange={e => setNumberOfChildren(e.target.value)} className={INPUT_CLS} />
                </div>

                {dateOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <label className={LABEL_CLS}>Preferred Date</label>
                    <select required value={dateOptionId} onChange={e => setDateOptionId(e.target.value)} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
                      <option value="" disabled className="bg-white text-slate-900">Select a date...</option>
                      {dateOptions.map(d => <option key={d.id} value={d.id} className="bg-white text-slate-900">{d.label}</option>)}
                    </select>
                    {(() => {
                      const selected = dateOptions.find(d => d.id === dateOptionId);
                      return selected?.description ? <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{selected.description}</p> : null;
                    })()}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Preferred Contact Channel</label>
                  <div className="flex gap-2">
                    {(['whatsapp', 'email'] as const).map(ch => (
                      <button
                        key={ch} type="button" onClick={() => setPreferredChannel(ch)}
                        className={`flex-1 h-11 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${preferredChannel === ch ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}
                      >
                        {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 pt-1 cursor-pointer">
                  <input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0 accent-rad-blue" />
                  <span className="text-[11px] text-slate-500 leading-relaxed">
                    By submitting, you consent to RAD Academy contacting you, and to {program.countsGeneralAttendees ? 'this information' : "your child's information"} being used to prepare a quotation, in line with our privacy policy.
                  </span>
                </label>

                {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

                <button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Submit <ArrowRight size={14} /></>}
                </button>
              </motion.form>
            )}

            {step === 'package' && (() => {
              const byOrder = (a: PackageOption, b: PackageOption) => a.display_order - b.display_order;
              const anchorTiers = packages.filter(p => p.tier_role === 'anchor').sort(byOrder);
              const recommendedTiers = packages.filter(p => p.tier_role === 'recommended').sort(byOrder);
              const lighterTiers = packages.filter(p => p.tier_role !== 'anchor' && p.tier_role !== 'recommended').sort(byOrder);
              const priceLabel = (opt: PackageOption) => `R ${opt.final_fee.toLocaleString('en-ZA')}${opt.package.event_type === 'term_lessons' || opt.package.event_type === 'priority_coaching' ? '/mo' : ''}`;

              return (
                <motion.div key="package" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  <div className="p-3 rounded-xl bg-rad-blue/10 border border-rad-blue/20 text-[12px] text-slate-700">
                    Got your details — pick the package that fits, and we'll send your quote right away.
                  </div>

                  <div className="space-y-4">
                    {/* Anchor - small and muted, sets a real ceiling without competing for attention. */}
                    {anchorTiers.length > 0 && (
                      <div className="space-y-2">
                        {anchorTiers.map(opt => (
                          <div key={opt.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                                <Star size={10} className="shrink-0 text-amber-500" /> {opt.package.name}
                              </span>
                              {opt.package.description && <p className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-2">{opt.package.description}</p>}
                            </div>
                            <button
                              onClick={() => choosePackage(opt.id)}
                              disabled={!!selectingPackageId}
                              className="shrink-0 px-3 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-[11px] flex items-center gap-1.5 hover:bg-slate-100 transition-all disabled:opacity-50"
                            >
                              {selectingPackageId === opt.id ? <Loader2 size={12} className="animate-spin" /> : priceLabel(opt)}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommended - the one dominant card, everything else defers to it. */}
                    {recommendedTiers.map(opt => (
                      <div key={opt.id} className="rounded-2xl border-2 border-rad-blue bg-rad-blue/[0.06] p-5 space-y-3 shadow-lg shadow-rad-blue/10">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-base text-slate-900">{opt.package.name}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-rad-blue text-white flex items-center gap-1 shrink-0"><Star size={10} /> Recommended</span>
                        </div>
                        {opt.package.description && <p className="text-[13px] text-slate-600 leading-relaxed">{opt.package.description}</p>}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-2xl font-black italic text-slate-900">{priceLabel(opt)}</span>
                          <button
                            onClick={() => choosePackage(opt.id)}
                            disabled={!!selectingPackageId}
                            className="px-5 h-11 rounded-xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-[11px] flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                          >
                            {selectingPackageId === opt.id ? <Loader2 size={14} className="animate-spin" /> : <>Choose <ArrowRight size={12} /></>}
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Lighter - a quiet line, not a competing box. */}
                    {lighterTiers.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {lighterTiers.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => choosePackage(opt.id)}
                            disabled={!!selectingPackageId}
                            className="w-full flex items-center justify-between gap-3 px-1 py-1.5 text-left hover:opacity-70 transition-opacity disabled:opacity-50"
                          >
                            <span className="text-[12px] text-slate-500">{opt.package.name}</span>
                            <span className="text-[12px] font-bold text-slate-600 underline decoration-slate-300 underline-offset-2 shrink-0">
                              {selectingPackageId === opt.id ? <Loader2 size={12} className="animate-spin inline" /> : `${priceLabel(opt)} instead`}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

                  <button type="button" onClick={() => setStep('success')} disabled={!!selectingPackageId} className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-black uppercase italic tracking-widest text-xs hover:bg-slate-100 transition-all disabled:opacity-50">
                    I'll decide later
                  </button>
                </motion.div>
              );
            })()}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                <CheckCircle2 className="text-emerald-500 mx-auto" size={56} />
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
                    {previewMode ? "That's the end of the flow" : quoteLink ? 'Quote sent!' : 'Thanks!'}
                  </h3>
                  <p className="text-slate-500 text-sm">
                    {previewMode
                      ? 'On a real submission, this is where the quote gets sent via WhatsApp or email and you\'d get pinged too.'
                      : quoteLink
                      ? "Check your WhatsApp or email — it's valid for 48 hours."
                      : "We'll follow up with pricing and next steps within 1 business day."}
                  </p>
                </div>
                {quoteLink && (
                  <a href={quoteLink} target="_blank" rel="noreferrer" className="block w-full h-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                    View your quote <ArrowRight size={12} />
                  </a>
                )}
                <button onClick={onClose} className="w-full h-12 rounded-xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-xs hover:bg-slate-800 transition-all">
                  Close
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
