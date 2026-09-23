"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, Info } from "lucide-react";

const DEFAULT_HERO_TITLE = "This Term's Workshops";
const DEFAULT_HERO_SUBTITLE = "A more focused structure this term — select what interests you below and we'll follow up on WhatsApp.";
const DEFAULT_HERO_IMAGE = "https://pub-5baa3fb9dc2549008c18dac88b524ed9.r2.dev/marketing_material/uncaptioned_images/2.jpg";
const DEFAULT_SESSIONS_HEADING = "This term's sessions";
const DEFAULT_TBC_DEADLINE = "mid-October";

export default function TermProgramSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingDefaults, setUsingDefaults] = useState(false);

  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [sessionsHeading, setSessionsHeading] = useState("");
  const [tbcDeadline, setTbcDeadline] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/admin/api/term-program-settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        const s = data.settings || {};
        const hasCustom = !!(s.term_program_hero_title || s.term_program_hero_subtitle || s.term_program_hero_image_url || s.term_program_sessions_heading || s.term_program_tbc_deadline_label);
        setUsingDefaults(!hasCustom);
        setHeroTitle(s.term_program_hero_title || DEFAULT_HERO_TITLE);
        setHeroSubtitle(s.term_program_hero_subtitle || DEFAULT_HERO_SUBTITLE);
        setHeroImageUrl(s.term_program_hero_image_url || DEFAULT_HERO_IMAGE);
        setSessionsHeading(s.term_program_sessions_heading || DEFAULT_SESSIONS_HEADING);
        setTbcDeadline(s.term_program_tbc_deadline_label || DEFAULT_TBC_DEADLINE);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/admin/api/term-program-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term_program_hero_title: heroTitle,
          term_program_hero_subtitle: heroSubtitle,
          term_program_hero_image_url: heroImageUrl,
          term_program_sessions_heading: sessionsHeading,
          term_program_tbc_deadline_label: tbcDeadline,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setUsingDefaults(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/featured-programs" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Featured Programs
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-blue-500" /> Term Program Page
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            The hero banner and section heading on <Link href="/term-program" target="_blank" className="underline hover:text-slate-700">/term-program</Link> - the evergreen, self-contained landing page for a term's workshops and online lessons. Update these once a term; the individual session cards themselves are managed on the <Link href="/admin/featured-programs" className="underline hover:text-slate-700">Featured Programs</Link> page.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <div className="space-y-4">
            {usingDefaults && (
              <div className="flex items-start gap-2 text-xs bg-blue-50 text-blue-700 rounded-xl px-3.5 py-2.5">
                <Info size={14} className="shrink-0 mt-0.5" />
                Showing the built-in default copy - nothing's been customized yet. Saving below starts overriding it.
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Hero title</label>
                <p className="text-[11px] text-slate-400 mb-2">e.g. "Term 4 Programs"</p>
                <input value={heroTitle} onChange={e => setHeroTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Hero subtitle</label>
                <textarea value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Hero image URL</label>
                <input value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)} placeholder="https://...r2.dev/..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Sessions section heading</label>
                <p className="text-[11px] text-slate-400 mb-2">e.g. "Term 4 Sessions" - shown above the card list.</p>
                <input value={sessionsHeading} onChange={e => setSessionsHeading(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">"Topic TBC" deadline</label>
                <p className="text-[11px] text-slate-400 mb-2">e.g. "mid-October" - used on any "Event details to be announced" card as "Details land by ___".</p>
                <input value={tbcDeadline} onChange={e => setTbcDeadline(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && <span className="text-xs text-emerald-600 font-semibold">Saved ✓</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
