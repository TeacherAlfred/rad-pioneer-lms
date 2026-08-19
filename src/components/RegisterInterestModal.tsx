"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle2, ShieldCheck, ArrowRight, MapPin } from "lucide-react";

type DateOption = { id: string; label: string; starts_at: string };

export type RegisterInterestProgram = {
  id: string;
  title: string;
  location: string | null;
  formLabel: string | null;
  date_options?: DateOption[];
};

type Step = 'email' | 'confirm' | 'details' | 'success';

const INPUT_CLS = "w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 font-bold focus:border-rad-blue outline-none text-white text-sm placeholder:text-slate-500 placeholder:font-normal";
const LABEL_CLS = "text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1";

export default function RegisterInterestModal({ program, onClose }: { program: RegisterInterestProgram; onClose: () => void }) {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAttribution({
      utm_source: params.get('utm_source') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      referrer: document.referrer || undefined,
    });
  }, []);

  const dateOptions = program.date_options || [];

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
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
    if (!n || n < 1) return setError('Please enter at least 1 child.');
    if (!confirmToken && !fullName.trim()) return setError('Please enter your name.');
    if (!consent) return setError('Please confirm the consent checkbox to continue.');

    setBusy(true);
    try {
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
      setStep('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }}
        className="relative w-full max-w-md bg-gradient-to-b from-[#0f172a] to-[#020617] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <button onClick={onClose} className="absolute top-5 right-5 p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white z-20">
          <X size={18} />
        </button>

        <div className="p-8 overflow-y-auto">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rad-blue mb-2">Register Interest</p>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-tight">{program.title}</h2>
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
                {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
                <button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-white text-[#020617] font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ArrowRight size={14} /></>}
                </button>
              </motion.form>
            )}

            {step === 'confirm' && !hasWhatsappOnFile && (
              <motion.div key="confirm-email-only" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="p-3 rounded-xl bg-rad-blue/10 border border-rad-blue/20 text-[12px] text-slate-300">
                  We found this email on file, but don't have a phone number saved to double-check it's you the usual way. Retype your email to confirm, or just continue and fill in your details below — we'll match it up on our end either way.
                </div>

                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Retype your email to confirm</label>
                  <input type="email" autoFocus value={retypeEmail} onChange={e => setRetypeEmail(e.target.value)} className={INPUT_CLS} placeholder="parent@email.com" />
                </div>

                {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

                <div className="space-y-2">
                  <button type="button" onClick={confirmByEmailRetype} disabled={busy} className="w-full h-12 rounded-xl bg-white text-[#020617] font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <>Confirm — this is me <ShieldCheck size={14} /></>}
                  </button>
                  <button type="button" onClick={continueWithFreshForm} disabled={busy} className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-black uppercase italic tracking-widest text-xs hover:bg-white/10 transition-all disabled:opacity-50">
                    Just let me fill in the form
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'confirm' && hasWhatsappOnFile && (
              <motion.form key="confirm" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onSubmit={submitConfirm} className="space-y-4">
                <div className="p-3 rounded-xl bg-rad-blue/10 border border-rad-blue/20 text-[12px] text-slate-300">
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

                {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

                <button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-white text-[#020617] font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Confirm <ShieldCheck size={14} /></>}
                </button>

                <div className="flex items-center justify-between text-[11px] font-bold">
                  {confirmMode === 'last4' && hasWhatsappOnFile ? (
                    <button type="button" onClick={requestCode} className="text-rad-blue hover:text-white transition-colors">Send me a code instead</button>
                  ) : confirmMode === 'code' ? (
                    <button type="button" onClick={requestCode} disabled={busy} className="text-rad-blue hover:text-white transition-colors disabled:opacity-50">Resend code</button>
                  ) : <span />}
                  <button type="button" onClick={skipConfirmation} className="text-slate-500 hover:text-white transition-colors">This isn't me</button>
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
                      <p className="text-[11px] text-slate-500 ml-1">Add a WhatsApp number for faster updates — or leave blank for email.</p>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Number of Children</label>
                  <input required type="number" min={1} value={numberOfChildren} onChange={e => setNumberOfChildren(e.target.value)} className={INPUT_CLS} />
                </div>

                {dateOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <label className={LABEL_CLS}>Preferred Date</label>
                    <select required value={dateOptionId} onChange={e => setDateOptionId(e.target.value)} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
                      <option value="" disabled>Select a date...</option>
                      {dateOptions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Preferred Contact Channel</label>
                  <div className="flex gap-2">
                    {(['whatsapp', 'email'] as const).map(ch => (
                      <button
                        key={ch} type="button" onClick={() => setPreferredChannel(ch)}
                        className={`flex-1 h-11 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${preferredChannel === ch ? 'bg-white text-[#020617] border-white' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'}`}
                      >
                        {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 pt-1 cursor-pointer">
                  <input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0 accent-rad-blue" />
                  <span className="text-[11px] text-slate-400 leading-relaxed">
                    By submitting, you consent to RAD Academy contacting you, and to your child's information being used to prepare a quotation, in line with our privacy policy.
                  </span>
                </label>

                {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

                <button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-white text-[#020617] font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Submit <ArrowRight size={14} /></>}
                </button>
              </motion.form>
            )}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                <CheckCircle2 className="text-emerald-400 mx-auto" size={56} />
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Thanks!</h3>
                  <p className="text-slate-400 text-sm">We'll follow up with pricing and next steps within 1 business day.</p>
                </div>
                <button onClick={onClose} className="w-full h-12 rounded-xl bg-white text-[#020617] font-black uppercase italic tracking-widest text-xs hover:bg-slate-200 transition-all">
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
