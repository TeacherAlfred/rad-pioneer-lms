"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MapPin, ArrowLeft, Gift, Users, ChevronRight } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RegisterInterestModal, { RegisterInterestProgram } from "@/components/RegisterInterestModal";
import { headingFont, bodyFont } from "@/lib/termTheme";
import {
  normalizePageContent, parseHeadline,
  type FeaturedProgramPageContent, type HeadlineSegment,
} from "@/lib/featuredProgramPageContent";

type DateOption = { id: string; label: string; starts_at: string };

type FeaturedProgram = {
  id: string;
  title: string;
  location: string | null;
  details: string | null;
  duration: string | null;
  image_url: string;
  is_video: boolean;
  form_label: string | null;
  date_options: DateOption[];
  allow_multi_date: boolean;
  counts_general_attendees: boolean;
  page_content: FeaturedProgramPageContent;
};

const TZ = "Africa/Johannesburg";

const HEADLINE_TONE: Record<HeadlineSegment["tone"], string> = {
  plain: "",
  amber: "text-amber-500",
  emerald: "text-emerald-600",
};

// Alternating top accents on the "pick your day" cards - same amber/
// emerald pairing the headline highlights use.
const DAY_ACCENT = [
  { border: "border-t-amber-500", text: "text-amber-600" },
  { border: "border-t-emerald-500", text: "text-emerald-600" },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

function fmt(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("en-ZA", { timeZone: TZ, ...opts });
}

// duration is free text ("2.5 hours", "90 min") - only used to print an end
// time when it parses cleanly; otherwise the card just shows the start.
function durationMinutes(duration: string | null): number | null {
  if (!duration) return null;
  const h = duration.match(/([\d.]+)\s*h/i);
  if (h) return Math.round(parseFloat(h[1]) * 60);
  const m = duration.match(/(\d+)\s*min/i);
  return m ? parseInt(m[1], 10) : null;
}

function timeRange(startsAt: string, duration: string | null): string {
  const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  const start = fmt(startsAt, time);
  const mins = durationMinutes(duration);
  if (!mins) return start;
  const end = new Date(new Date(startsAt).getTime() + mins * 60_000).toISOString();
  return `${start} – ${fmt(end, time)}`;
}

// Route folder is still named [slug] but the param is the featured_programs
// row id. "View details first, register second" - /events links here, and
// registering is a separate, deliberate step via RegisterInterestModal.
//
// Styled on the /term-program page's system (Space Grotesk + IBM Plex Sans,
// slate-50 page, white rounded-2xl cards, slate-900 pill CTAs, amber
// accents) so public program pages read as one family. The optional
// flyer-style sections come from featured_programs.page_content - each
// renders only when an admin has filled it in.
export default function EventDetailPage() {
  const params = useParams();
  const id = params.slug as string;

  const [program, setProgram] = useState<FeaturedProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    async function fetchProgram() {
      if (!id) return;
      const { data, error } = await supabase
        .from('featured_programs')
        .select('id, title, location, details, duration, image_url, is_video, form_label, date_options, allow_multi_date, counts_general_attendees, page_content')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) setProgram({ ...data, page_content: normalizePageContent(data.page_content) });
      setLoading(false);
    }
    fetchProgram();
  }, [id]);

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 ${bodyFont.className}`}>
        <Loader2 className="animate-spin mr-2" size={20} /> Loading...
      </div>
    );
  }

  if (!program) {
    return (
      <div className={`min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-center px-6 text-slate-900 ${bodyFont.className}`}>
        <h1 className={`${headingFont.className} text-2xl font-bold`}>Program not found</h1>
        <p className="text-slate-500 text-sm">This one may have been taken down or the link is outdated.</p>
        <Link href="/events" className="mt-2 px-6 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold">
          Back to all programs
        </Link>
      </div>
    );
  }

  const content = program.page_content;
  const sortedDates = (program.date_options || [])
    .filter(d => d.starts_at)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const headline = parseHeadline(content.headline || program.title);
  const subheading = content.subheading || program.details;

  const registerProgram: RegisterInterestProgram = {
    id: program.id,
    title: program.title,
    location: program.location,
    formLabel: program.form_label,
    date_options: program.date_options || [],
    allow_multi_date: program.allow_multi_date,
    countsGeneralAttendees: program.counts_general_attendees,
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${bodyFont.className}`}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-10 pb-24 space-y-14">
        {/* Hero */}
        <motion.div {...fadeUp} className="space-y-5">
          <Link href="/events" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-4">
            <ArrowLeft size={14} /> All programs
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-bold tracking-widest uppercase text-slate-900">
              {content.eyebrow || `RAD Academy${program.location ? ` · ${program.location}` : ""}`}
            </span>
          </div>
          <h1 className={`${headingFont.className} text-4xl md:text-5xl font-bold tracking-tight leading-[1.08]`}>
            {headline.map((seg, i) => <span key={i} className={HEADLINE_TONE[seg.tone]}>{seg.text}</span>)}
          </h1>
          {subheading && <p className="text-lg text-slate-600 max-w-xl leading-relaxed">{subheading}</p>}
          {program.image_url && (
            program.is_video ? (
              <video src={program.image_url} autoPlay muted loop playsInline className="w-full h-auto rounded-2xl border border-slate-200" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={program.image_url} alt="" className="w-full h-auto rounded-2xl border border-slate-200" />
            )
          )}
        </motion.div>

        {/* Pick your day + venue */}
        {(sortedDates.length > 0 || program.location) && (
          <motion.section {...fadeUp} className="space-y-4">
            {sortedDates.length > 0 && (
              <>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {sortedDates.length > 1 ? "Pick your day — same content, every session" : "When"}
                </h2>
                <div className={`grid gap-4 ${sortedDates.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {sortedDates.map((d, i) => {
                    const accent = DAY_ACCENT[i % DAY_ACCENT.length];
                    return (
                      <motion.div
                        key={d.id}
                        whileHover={{ y: -3 }}
                        className={`bg-white rounded-2xl border border-slate-200 border-t-[3px] ${accent.border} px-4 py-6 text-center space-y-1`}
                      >
                        <div className={`text-[11px] font-bold uppercase tracking-widest ${accent.text}`}>{fmt(d.starts_at, { weekday: "long" })}</div>
                        <div className={`${headingFont.className} text-4xl md:text-5xl font-bold leading-none`}>{fmt(d.starts_at, { day: "numeric" })}</div>
                        <div className="text-sm text-slate-500">{fmt(d.starts_at, { month: "long" })}</div>
                        <div className="pt-3">
                          <span className={`${headingFont.className} inline-block text-sm md:text-base font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full`}>
                            {timeRange(d.starts_at, program.duration)}
                          </span>
                        </div>
                        {program.duration && <div className="text-xs text-slate-400 pt-1">{program.duration}</div>}
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}

            {program.location && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <div className={`${headingFont.className} font-semibold`}>{program.location}</div>
                  <div className="text-sm text-slate-500">Exact venue details shared on registration</div>
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* What your child learns */}
        {content.learn_items && (
          <motion.section {...fadeUp} className="space-y-4">
            <h2 className={`${headingFont.className} text-3xl md:text-4xl font-bold text-center`}>What your child learns</h2>
            <div className="space-y-3">
              {content.learn_items.map((item, i) => (
                <motion.div key={i} whileHover={{ y: -2 }} className="bg-white rounded-2xl border border-slate-200 p-6 flex items-start gap-4">
                  <span className={`${headingFont.className} w-9 h-9 rounded-lg bg-blue-50 text-blue-700 text-sm font-bold flex items-center justify-center shrink-0`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className={`${headingFont.className} text-lg font-semibold`}>{item.title}</h3>
                    {item.desc && <p className="text-slate-600 leading-relaxed mt-1">{item.desc}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Take-home */}
        {content.takeaway && (
          <motion.div {...fadeUp} className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Gift size={26} />
            </div>
            <div className="min-w-0">
              {content.takeaway.label && <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">{content.takeaway.label}</div>}
              <div className={`${headingFont.className} text-xl font-semibold text-emerald-950 mt-0.5`}>{content.takeaway.title}</div>
              {content.takeaway.desc && <p className="text-sm text-emerald-800 leading-relaxed mt-1">{content.takeaway.desc}</p>}
            </div>
          </motion.div>
        )}

        {/* Parent quote */}
        {content.quote && (
          <motion.blockquote {...fadeUp} className="bg-white border border-slate-200 border-l-[3px] border-l-amber-500 rounded-r-2xl px-6 py-5">
            <p className="text-slate-700 leading-relaxed">{content.quote}</p>
          </motion.blockquote>
        )}

        {/* Group size */}
        {content.scarcity_note && (
          <motion.div {...fadeUp} className="rounded-2xl bg-amber-50 border border-amber-100 px-5 py-4 flex items-center justify-center gap-2.5 text-center">
            <Users size={16} className="text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-900">{content.scarcity_note}</span>
          </motion.div>
        )}

        {/* Register */}
        <motion.div {...fadeUp} className="rounded-2xl border-t-[3px] border-t-amber-500 border border-slate-200 bg-white p-8 space-y-5">
          <div>
            <h2 className={`${headingFont.className} text-xl font-semibold`}>Ready to register?</h2>
            <p className="text-sm text-slate-600 mt-1">No payment today — tell us your preferred day and we&apos;ll confirm on WhatsApp.</p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setRegisterOpen(true)}
            className="px-6 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5"
          >
            Register interest <ChevronRight size={16} />
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {registerOpen && (
          <RegisterInterestModal program={registerProgram} onClose={() => setRegisterOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
