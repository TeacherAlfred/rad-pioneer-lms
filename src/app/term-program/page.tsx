"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import {
  Loader2, AlertCircle, CheckCircle2, MapPin, Users, ShoppingBag, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { RAD_WHATSAPP_NUMBER } from "@/lib/tutorialProgress";

const headingFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const bodyFont = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

type DateOption = { id: string; label: string; starts_at: string; description?: string };

type Card = {
  id: string;
  title: string;
  label: string | null;
  location: string | null;
  details: string | null;
  duration: string | null;
  image_url: string;
  date_options: DateOption[];
  age_label: string | null;
  fee_label: string | null;
  spots_label: string | null;
  status_label: string | null;
  card_kind: "session" | "interest" | "term";
  series: string | null;
};

// Page-level hero/section copy - admin-editable at /admin/term-program-
// settings (dashboard_settings.term_program_* columns) so it can be
// refreshed once a term with no code deploy. These are just the built-in
// fallback shown until an admin customizes something, same "null means
// default" convention as the welcome menu settings.
const DEFAULT_HERO_TITLE = "This Term's Workshops";
const DEFAULT_HERO_SUBTITLE = "A more focused structure this term — select what interests you below and we'll follow up on WhatsApp.";
const DEFAULT_HERO_IMAGE = "https://pub-5baa3fb9dc2549008c18dac88b524ed9.r2.dev/marketing_material/uncaptioned_images/2.jpg";
const DEFAULT_SESSIONS_HEADING = "This term's sessions";
// Shown on every "interest" card (topic/age still TBC).
const DEFAULT_TBC_DEADLINE = "mid-October";

type PageSettings = {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  sessionsHeading: string;
  tbcDeadline: string;
};

const CARD_STYLE: Record<Card["card_kind"], { border: string; ring: string; button: string }> = {
  session: { border: "border-slate-200", ring: "", button: "Select this session" },
  interest: { border: "border-dashed border-slate-300", ring: "", button: "Register interest" },
  term: { border: "border-violet-200", ring: "ring-1 ring-violet-300 shadow-[0_16px_40px_-15px_rgba(109,40,217,0.25)]", button: "Enrol for this term" },
};

// The top-of-card date pill is a quick-scan summary, not a schedule - times
// belong on the "choose your preferred day" buttons once a card is
// selected, not crammed in here where two options plus times reliably
// wraps to two lines on a phone.
function stripTime(label: string): string {
  const idx = label.indexOf(",");
  return idx === -1 ? label : label.slice(0, idx).trim();
}

function dateSummary(dateOptions: DateOption[]): string {
  if (!dateOptions || dateOptions.length === 0) return "";
  if (dateOptions.length === 1) return dateOptions[0].label;
  return `Choose ${dateOptions.map(d => stripTime(d.label)).join(" or ")}`;
}

// fee_label is one admin-typed string. Convention so far is "<amount> —
// <what's included>" (falling back to "<amount>, <what's included>") -
// split on whichever separator is present so the amount can lead as its
// own headline and the rest collapses behind Read more, without needing a
// second database column just for this page's layout.
function splitFee(feeLabel: string | null): { amount: string; includes: string | null } | null {
  if (!feeLabel) return null;
  const dashIdx = feeLabel.indexOf(" — ");
  if (dashIdx !== -1) return { amount: feeLabel.slice(0, dashIdx).trim(), includes: feeLabel.slice(dashIdx + 3).trim() };
  const commaIdx = feeLabel.indexOf(", ");
  if (commaIdx !== -1) return { amount: feeLabel.slice(0, commaIdx).trim(), includes: feeLabel.slice(commaIdx + 2).trim() };
  return { amount: feeLabel, includes: null };
}

// Self-contained read-more: measures whether the text actually overflows
// its line-clamp (rather than guessing from character count, which can be
// wrong at any given viewport width/font size), so the toggle only ever
// appears when there's truly more to read. Re-measures on resize and once
// web fonts finish loading, since a font swap can change how the text
// wraps after the first paint.
function ClampedText({ text, clampClass = "line-clamp-3", className = "" }: { text: string; clampClass?: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      setOverflowing(el.scrollHeight - el.clientHeight > 1);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready?.then(measure);

    return () => ro.disconnect();
  }, [text, clampClass]);

  return (
    <div>
      <p ref={ref} className={`${className} ${expanded ? "" : clampClass}`}>{text}</p>
      {(overflowing || expanded) && (
        <button type="button" onClick={() => setExpanded(v => !v)} className="text-xs font-semibold text-slate-900 underline underline-offset-2 mt-1">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

// Shared between the footer summary and the registration modal - both show
// the same selected-sessions list with a remove button per row.
function RecapList({ cards, recapLabel, onRemove }: { cards: Card[]; recapLabel: (c: Card) => string; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {cards.map(c => (
        <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-sm">{recapLabel(c)}</span>
          <button type="button" onClick={() => onRemove(c.id)} aria-label="Remove" className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function TermProgramPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PageSettings>({
    heroTitle: DEFAULT_HERO_TITLE,
    heroSubtitle: DEFAULT_HERO_SUBTITLE,
    heroImage: DEFAULT_HERO_IMAGE,
    sessionsHeading: DEFAULT_SESSIONS_HEADING,
    tbcDeadline: DEFAULT_TBC_DEADLINE,
  });

  // program_id -> chosen date_option_id (or '' when not yet chosen / no dates)
  const [cart, setCart] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ parentName: "", phone: "", email: "", childrenInfo: "", numberOfChildren: "1", note: "" });
  const [consent, setConsent] = useState(false);
  const [botField, setBotField] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("featured_programs")
        .select("id,title,label,location,details,duration,image_url,date_options,age_label,fee_label,spots_label,status_label,card_kind,series,sort_order")
        .eq("show_on_term_page", true)
        .order("sort_order", { ascending: true });
      if (error) {
        setLoadError(error.message);
      } else {
        setCards((data as Card[]) || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    fetch("/api/term-program/settings")
      .then(res => res.json())
      .then(data => {
        const s = data.settings || {};
        setSettings({
          heroTitle: s.term_program_hero_title || DEFAULT_HERO_TITLE,
          heroSubtitle: s.term_program_hero_subtitle || DEFAULT_HERO_SUBTITLE,
          heroImage: s.term_program_hero_image_url || DEFAULT_HERO_IMAGE,
          sessionsHeading: s.term_program_sessions_heading || DEFAULT_SESSIONS_HEADING,
          tbcDeadline: s.term_program_tbc_deadline_label || DEFAULT_TBC_DEADLINE,
        });
      })
      .catch(() => {}); // keep the built-in defaults already in state
  }, []);

  const selectedIds = Object.keys(cart);
  const selectedCards = useMemo(
    () => selectedIds.map(id => cards.find(c => c.id === id)).filter(Boolean) as Card[],
    [selectedIds, cards]
  );

  function toggleCard(card: Card) {
    setCart(prev => {
      const next = { ...prev };
      if (next[card.id] !== undefined) {
        delete next[card.id];
      } else {
        next[card.id] = card.date_options.length === 1 ? card.date_options[0].id : "";
      }
      return next;
    });
  }

  function chooseDate(cardId: string, dateOptionId: string) {
    setCart(prev => ({ ...prev, [cardId]: dateOptionId }));
  }

  function removeCard(cardId: string) {
    setCart(prev => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  }

  function recapLabel(card: Card): string {
    const dateOptionId = cart[card.id];
    const match = card.date_options.find(d => d.id === dateOptionId);
    if (match) return `${card.title} — ${match.label}`;
    // A day pick isn't required to submit - flag it here rather than
    // silently leaving it out, so it's clear (to the parent and to us)
    // that the day still needs confirming when we follow up.
    if (card.date_options.length > 1) return `${card.title} — day to be confirmed`;
    return card.title;
  }

  function buildWaLink(): string {
    const lines = ["Hi RAD Academy! I'd like to register for:"];
    selectedCards.forEach(c => lines.push(`- ${recapLabel(c)}`));
    lines.push("");
    if (form.parentName) lines.push(`Parent: ${form.parentName}`);
    if (form.childrenInfo) lines.push(`Child(ren): ${form.childrenInfo}`);
    if (form.note) lines.push(`Note: ${form.note}`);
    return `https://wa.me/${RAD_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (selectedCards.length === 0) return setSubmitError("Select at least one session first.");
    if (!form.parentName.trim()) return setSubmitError("Please enter your name.");
    if (!form.phone.trim()) return setSubmitError("Please enter a WhatsApp number.");
    const nChildren = parseInt(form.numberOfChildren, 10);
    if (!nChildren || nChildren < 1) return setSubmitError("Please enter at least 1 child.");
    if (!consent) return setSubmitError("Please confirm you consent to being contacted.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/term-program/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_name: form.parentName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          children_info: form.childrenInfo.trim(),
          number_of_children: nChildren,
          note: form.note.trim() || undefined,
          selections: selectedCards.map(c => ({ program_id: c.id, date_option_id: cart[c.id] || null })),
          consent: true,
          bot_field: botField,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      window.open(buildWaLink(), "_blank", "noopener");
      setModalOpen(false);
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${bodyFont.className}`}>
      {/* Floating cart */}
      <AnimatePresence>
        {selectedCards.length > 0 && !modalOpen && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => setModalOpen(true)}
            className="fixed top-5 right-5 z-40 flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold shadow-xl shadow-slate-900/20"
          >
            <ShoppingBag size={16} /> {selectedCards.length} selected — Message us
          </motion.button>
        )}
      </AnimatePresence>

      {/* Registration modal - the floating button above and the footer's
          "Complete registration" button both just open this; the actual
          form lives here only, not duplicated inline in the page. */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-2xl p-6 md:p-8 space-y-5 relative"
            >
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>

              <div className="pr-6">
                <h2 className={`${headingFont.className} text-xl font-semibold`}>Complete your registration</h2>
                <p className="text-sm text-slate-500 mt-1">We'll confirm availability and sort out the rest with you directly.</p>
              </div>

              {selectedCards.length === 0 ? (
                <p className="text-sm text-slate-400">No sessions selected yet — close this and choose one or more first.</p>
              ) : (
                <>
                  <RecapList cards={selectedCards} recapLabel={recapLabel} onRemove={removeCard} />

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Parent's name</label>
                        <input value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} placeholder="e.g. Thandi Mokoena" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">WhatsApp number</label>
                        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 082 123 4567" type="tel" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Child's name &amp; age (or names, if more than one)</label>
                      <input value={form.childrenInfo} onChange={e => setForm(f => ({ ...f, childrenInfo: e.target.value }))} placeholder="e.g. Lindiwe, 11" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Number of children</label>
                        <input type="number" min={1} value={form.numberOfChildren} onChange={e => setForm(f => ({ ...f, numberOfChildren: e.target.value }))} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Email (optional)</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Anything else we should know? (optional)</label>
                      <textarea rows={3} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. she's done a bit of Scratch before" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 resize-none" />
                    </div>

                    <input type="text" value={botField} onChange={e => setBotField(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                    <label className="flex items-start gap-2.5 text-xs text-slate-500">
                      <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-slate-900" />
                      I consent to RAD Academy contacting me about these sessions on WhatsApp.
                    </label>

                    {submitError && (
                      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={15} />
                        <p className="text-rose-700 text-xs font-medium">{submitError}</p>
                      </div>
                    )}

                    <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                      {submitting ? "Sending..." : "Send via WhatsApp"}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-16 pb-24 space-y-14">
        {/* Hero */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-bold tracking-widest uppercase text-slate-900">RAD Academy · Pretoria</span>
          </div>
          <h1 className={`${headingFont.className} text-4xl md:text-5xl font-bold tracking-tight leading-[1.08]`}>{settings.heroTitle}</h1>
          <p className="text-lg text-slate-600 max-w-xl leading-relaxed">{settings.heroSubtitle}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={settings.heroImage} alt="" className="w-full h-auto rounded-2xl border border-slate-200" />
        </div>

        {/* Quick select - a checkbox here is the same toggle as "Select this
            session" on the full card below, sharing the same cart state, so
            either one stays in sync with the other. */}
        {!loading && cards.some(card => card.card_kind !== "interest") && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Quick select</h3>
            <p className="text-xs text-slate-400 mb-2">Tick what interests you - scroll down to pick a day and register.</p>
            <div className="divide-y divide-slate-100">
              {cards.filter(card => card.card_kind !== "interest").map(card => {
                const isSelected = cart[card.id] !== undefined;
                const summary = dateSummary(card.date_options);
                return (
                  <label key={card.id} className="flex items-center gap-3 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCard(card)}
                      className="w-4 h-4 shrink-0 accent-slate-900"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">{card.title}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5">
                        {summary && <span>{summary}</span>}
                        {summary && card.location && <span className="text-slate-300">·</span>}
                        {card.location && <span>{card.location}</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <hr className="border-slate-200" />

        {/* Sessions */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className={`${headingFont.className} text-3xl md:text-4xl font-bold`}>{settings.sessionsHeading}</h2>
            <p className="text-sm text-slate-500 mt-2">Select any that interest you — you can choose more than one.</p>
          </div>

          {loading && (
            <div className="py-16 flex items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mr-2" size={20} /> Loading this term's sessions...
            </div>
          )}
          {loadError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm">{loadError}</div>
          )}
          {!loading && !loadError && cards.length === 0 && (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-sm">
              Nothing published for this term yet — check back soon.
            </div>
          )}

          <div className="space-y-5">
            {cards.map((card, idx) => {
              const isSelected = cart[card.id] !== undefined;
              const style = CARD_STYLE[card.card_kind] || CARD_STYLE.session;
              const summary = dateSummary(card.date_options);
              const fee = splitFee(card.fee_label);
              const prevKind = idx > 0 ? cards[idx - 1].card_kind : null;
              const showSectionDivider = card.card_kind === "term" && prevKind !== "term";

              return (
                <Fragment key={card.id}>
                  {showSectionDivider && (
                    <div className="flex items-center gap-3 pt-2">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className={`${headingFont.className} text-sm md:text-base font-extrabold uppercase tracking-widest text-slate-400 whitespace-nowrap`}>Online Term Lessons</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}

                  <div className={`bg-white rounded-2xl border p-7 space-y-5 ${style.border} ${style.ring}`}>
                    {card.image_url && card.card_kind !== "interest" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image_url} alt="" className="w-full h-auto rounded-xl" />
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {card.label && (
                          <span className="text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full bg-amber-500 text-slate-900">{card.label}</span>
                        )}
                        {card.age_label && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{card.age_label}</span>
                        )}
                        {card.status_label && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">{card.status_label}</span>
                        )}
                        {card.location && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
                            <MapPin size={11} /> {card.location}
                          </span>
                        )}
                      </div>
                      {summary && (
                        <span className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full whitespace-nowrap">{summary}</span>
                      )}
                    </div>

                    <h3 className={`${headingFont.className} text-xl font-semibold`}>{card.title}</h3>

                    {card.card_kind === "interest" ? (
                      <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 space-y-1.5">
                        <p className="text-sm font-semibold text-amber-900">Details land by {settings.tbcDeadline}</p>
                        {card.details && <p className="text-sm text-amber-800 leading-relaxed">{card.details}</p>}
                        <p className="text-xs text-amber-700 leading-relaxed">Register your interest now and help decide what we cover — we'll ask everyone who's registered interest before locking in the topic.</p>
                      </div>
                    ) : (
                      card.details && <ClampedText text={card.details} className="text-slate-600 leading-relaxed" />
                    )}

                    {card.card_kind !== "interest" && (fee || card.spots_label) && (
                      <div className="space-y-2 pt-3 border-t border-slate-100">
                        {fee && (
                          <div>
                            <div className={`${headingFont.className} text-2xl font-semibold`}>{fee.amount}</div>
                            {fee.includes && <ClampedText text={fee.includes} clampClass="line-clamp-2" className="text-sm text-slate-600 mt-0.5" />}
                          </div>
                        )}
                        {card.spots_label && <div className="text-sm text-slate-500">{card.spots_label}</div>}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCard(card)}
                      className={`px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors ${isSelected ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900 border-slate-900 hover:bg-slate-50"}`}
                    >
                      {isSelected ? "Selected ✓" : style.button}
                    </button>

                    {isSelected && card.date_options.length > 1 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold">Choose your preferred day</div>
                        <div className="grid grid-flow-col auto-cols-fr gap-2">
                          {card.date_options.map(d => {
                            const chosen = cart[card.id] === d.id;
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => chooseDate(card.id, d.id)}
                                className={`px-2.5 py-2 rounded-full text-xs font-semibold border truncate ${chosen ? "bg-amber-500 border-amber-500 text-slate-900" : "bg-slate-50 border-slate-200 hover:border-slate-300"}`}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Ready to register - a summary only; the actual form lives in the
            modal above, opened from here or from the floating button. */}
        {!loading && cards.length > 0 && (
          <div className="rounded-2xl border-t-[3px] border-t-amber-500 border border-slate-200 bg-white p-8 space-y-5">
            <div>
              <h2 className={`${headingFont.className} text-xl font-semibold`}>Ready to register?</h2>
              <p className="text-sm text-slate-600 mt-1">Select the session(s) you're interested in above, then complete your registration.</p>
            </div>

            {success ? (
              <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="font-semibold text-emerald-900">Request received</p>
                  <p className="text-sm text-emerald-700 mt-1">We've noted your selections and opened WhatsApp so you can send us your message — we'll confirm availability and sort out the rest with you directly.</p>
                </div>
              </div>
            ) : selectedCards.length === 0 ? (
              <p className="text-sm text-slate-400">No sessions selected yet — choose one or more above to get started.</p>
            ) : (
              <>
                <RecapList cards={selectedCards} recapLabel={recapLabel} onRemove={removeCard} />
                <button type="button" onClick={() => setModalOpen(true)} className="px-6 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold">
                  Complete registration
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
