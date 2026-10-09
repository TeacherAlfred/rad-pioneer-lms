"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCircle2, AlertCircle, Loader2, Sparkles, QrCode, X, HelpCircle, MessageCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { headingFont, bodyFont } from "@/lib/termTheme";
import { RAD_WHATSAPP_NUMBER } from "@/lib/tutorialProgress";

export type CommunityOffer = {
  id: string;
  title: string;
  details: string | null;
  imageUrl: string;
  dates: string[];
  ageLabel: string | null;
};

type Props = {
  slug: string;
  audienceLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  bonusLine: string | null;
  disclaimer: string;
  offers: CommunityOffer[];
};

const inputClass = "w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-base outline-none focus:border-slate-400 transition-colors";

export default function CommunityInterest({ slug, audienceLabel, heroTitle, heroSubtitle, bonusLine, disclaimer, offers }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", childAge: "" });
  const [consent, setConsent] = useState(false);
  const [botField, setBotField] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The wa.me link to the RAD business number, prefilled from what was
  // just submitted - built at submit time so it captures ?code= too.
  const [done, setDone] = useState<{ waLink: string } | null>(null);
  // "Not sure which fits" is its own choice, exclusive with picking a
  // workshop - the API flags these leads for a personal recommendation.
  const [notSure, setNotSure] = useState(false);
  // Full URL (keeps ?code=MOON) captured when the QR sheet opens, so a
  // parent scanning from a shared/stand device lands on the same page,
  // same attribution, on their own phone.
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qrUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setQrUrl(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qrUrl]);

  function toggle(id: string) {
    setError(null);
    setNotSure(false);
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  }

  function toggleNotSure() {
    setError(null);
    setSelected([]);
    setNotSure(v => !v);
  }

  // A stand device gets handed from family to family - clear everything
  // for the next one.
  function startOver() {
    setSelected([]);
    setNotSure(false);
    setForm({ name: "", phone: "", childAge: "" });
    setConsent(false);
    setError(null);
    setDone(null);
  }

  const hasChoice = selected.length > 0 || notSure;

  // No template goes out from us - the parent sends this themselves, which
  // opens WhatsApp's 24-hour window so we can reply freely. Carrying the
  // code in the text also lets the webhook's voucher match attribute it if
  // this number reaches us before the form's lead row does.
  function buildWaLink(code: string | null): string {
    const picked = notSure
      ? "help choosing a workshop"
      : offers.filter(o => selected.includes(o.id)).map(o => o.title).join(" & ");
    const text = `Hi RAD Academy! I'm ${form.name.trim()} and I've just registered for ${picked} for my child (${form.childAge.trim()}).${code ? ` Code: ${code.toUpperCase()}` : ""}`;
    return `https://wa.me/${RAD_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasChoice) return setError("Pick a workshop above, or tap \"Not sure\".");
    if (!form.name.trim()) return setError("Please enter your name.");
    if (!form.phone.trim()) return setError("Please enter your WhatsApp number.");
    if (!form.childAge.trim()) return setError("Please enter your child's age or grade.");
    if (!consent) return setError("Please tick the consent box so we can contact you.");

    const code = new URLSearchParams(window.location.search).get("code");
    setSubmitting(true);
    try {
      const res = await fetch("/api/community-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community: slug,
          parent_name: form.name.trim(),
          phone: form.phone.trim(),
          child_age: form.childAge.trim(),
          program_ids: notSure ? [] : selected,
          not_sure: notSure,
          consent: true,
          // Hidden attribution - the follow-up link carries ?code=MOON etc.
          voucher_code: code,
          bot_field: botField,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setDone({ waLink: buildWaLink(code) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const chosenTitles = offers.filter(o => selected.includes(o.id)).map(o => o.title);

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${bodyFont.className}`}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-12 pb-28 space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-bold tracking-widest uppercase">{audienceLabel}</span>
          </div>
          <h1 className={`${headingFont.className} text-4xl font-bold tracking-tight leading-[1.1]`}>
            {done ? "You're in. Thank you!" : heroTitle}
          </h1>
          {!done && <p className="text-lg text-slate-600 leading-relaxed">{heroSubtitle}</p>}
        </header>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="rounded-2xl border-t-[3px] border-t-amber-500 border border-slate-200 bg-white p-6 space-y-3"
            >
              <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}>
                <CheckCircle2 className="text-emerald-600" size={36} />
              </motion.div>
              <p className="font-semibold">{notSure ? "We'll help you choose" : chosenTitles.join(" & ")}</p>
              <p className="text-slate-600 leading-relaxed">
                {notSure
                  ? "We'll contact you on WhatsApp to recommend the right workshop for your child."
                  : "We'll contact you on WhatsApp to confirm your day and sort out the rest."}
                {" "}On your own phone? Send us a quick message now and we can reply straight away.
              </p>
              {/* A link, not an automatic redirect: on a shared stand device
                  this would otherwise message us from the wrong phone. */}
              <motion.a
                href={done.waLink}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-full bg-emerald-600 text-white font-semibold"
              >
                <MessageCircle size={18} /> Message us on WhatsApp
              </motion.a>
              <button type="button" onClick={startOver} className="text-sm font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900">
                Start again for another family
              </button>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0, y: -10 }} className="space-y-8">
              {offers.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white border border-slate-200 text-slate-600">
                  These workshops are full or finished.{" "}
                  <a href={`https://wa.me/${RAD_WHATSAPP_NUMBER}`} className="font-semibold underline underline-offset-2">Message us on WhatsApp</a>{" "}
                  and we'll tell you what's next.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {offers.map(offer => {
                    const isOn = selected.includes(offer.id);
                    return (
                      <motion.button
                        key={offer.id}
                        type="button"
                        onClick={() => toggle(offer.id)}
                        whileTap={{ scale: 0.97 }}
                        animate={{ y: isOn ? -2 : 0 }}
                        aria-pressed={isOn}
                        className={`relative text-left bg-white rounded-2xl border overflow-hidden transition-shadow ${isOn ? "border-slate-900 ring-2 ring-slate-900 shadow-lg" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={offer.imageUrl} alt="" className="w-full aspect-[4/3] object-cover" />
                        <AnimatePresence>
                          {isOn && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow"
                            >
                              <Check size={18} strokeWidth={3} className="text-slate-900" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <div className="p-4 space-y-2">
                          {offer.ageLabel && (
                            <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{offer.ageLabel}</span>
                          )}
                          <h2 className={`${headingFont.className} text-lg font-semibold leading-snug`}>{offer.title}</h2>
                          {offer.dates.length > 0 && <p className="text-sm text-slate-500">{offer.dates.join(" or ")}</p>}
                        </div>
                      </motion.button>
                    );
                  })}

                  <motion.button
                    type="button"
                    onClick={toggleNotSure}
                    whileTap={{ scale: 0.98 }}
                    aria-pressed={notSure}
                    className={`sm:col-span-2 flex items-center gap-3 text-left rounded-2xl border border-dashed p-4 transition-colors ${notSure ? "border-slate-900 bg-white ring-2 ring-slate-900" : "border-slate-300 bg-white/60 hover:border-slate-400"}`}
                  >
                    <motion.span
                      animate={{ rotate: notSure ? 360 : 0, backgroundColor: notSure ? "#f59e0b" : "#f1f5f9" }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center"
                    >
                      {notSure ? <Check size={18} strokeWidth={3} className="text-slate-900" /> : <HelpCircle size={18} className="text-slate-500" />}
                    </motion.span>
                    <span>
                      <span className="block font-semibold">Not sure which one fits?</span>
                      <span className="block text-sm text-slate-500">Tell us your child's age and we'll contact you with a recommendation.</span>
                    </span>
                  </motion.button>
                </div>
              )}

              {bonusLine && offers.length > 0 && (
                <div className="flex items-start gap-2.5 p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-900">
                  <Sparkles size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>{bonusLine}</span>
                </div>
              )}

              {offers.length > 0 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="ci-name" className="block text-sm font-semibold mb-1.5">Your name</label>
                    <input id="ci-name" autoComplete="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="ci-phone" className="block text-sm font-semibold mb-1.5">WhatsApp number</label>
                    <input id="ci-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="082 123 4567" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="ci-age" className="block text-sm font-semibold mb-1.5">Child's age or grade</label>
                    <input id="ci-age" placeholder="e.g. 9, or Grade 4" value={form.childAge} onChange={e => setForm(f => ({ ...f, childAge: e.target.value }))} className={inputClass} />
                  </div>

                  <input type="text" value={botField} onChange={e => setBotField(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                  <label className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
                    <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 w-4 h-4 shrink-0 accent-slate-900" />
                    I agree to RAD Academy contacting me on WhatsApp about these workshops, and using my child's age or grade to recommend the right session.
                  </label>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2"
                      >
                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-rose-700 text-sm">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-full bg-slate-900 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 size={18} className="animate-spin" />}
                    {submitting ? "Sending..." : !hasChoice ? "Pick a workshop above" : "Send my details"}
                  </motion.button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-slate-400 text-center leading-relaxed">{disclaimer}</p>
      </div>

      {/* Hand-off: show a QR so the parent (or child) can finish on their
          own phone instead of typing on someone else's device. */}
      <motion.button
        type="button"
        onClick={() => setQrUrl(window.location.href)}
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.4 }}
        aria-label="Show a QR code to open this page on your own phone"
        className="fixed bottom-5 right-4 sm:right-6 z-40 flex items-center gap-2 pl-3.5 pr-4 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-xl shadow-slate-900/25"
      >
        <QrCode size={18} />
        <span>Use your phone</span>
      </motion.button>

      <AnimatePresence>
        {qrUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setQrUrl(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Scan to open on your phone"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-sm bg-white rounded-2xl p-6 text-center space-y-4"
            >
              <button type="button" onClick={() => setQrUrl(null)} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
              <h2 className={`${headingFont.className} text-xl font-semibold`}>Scan to fill this in on your phone</h2>
              {/* White quiet zone baked in so it still scans if the page ever goes dark. */}
              <div className="mx-auto w-fit p-3 bg-white rounded-xl border border-slate-200">
                <QRCodeSVG value={qrUrl} size={220} level="M" marginSize={1} />
              </div>
              <p className="text-sm text-slate-500">Point your camera at the code and tap the link that appears.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
