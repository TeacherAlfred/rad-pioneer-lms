"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CalendarDays, MapPin, Clock, Loader2, Rocket, ArrowLeft, Star } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import RegisterInterestModal, { RegisterInterestProgram } from "@/components/RegisterInterestModal";

type FeaturedProgram = {
  id: string;
  title: string;
  location: string | null;
  details: string | null;
  duration: string | null;
  image_url: string;
  is_video: boolean;
  form_label: string | null;
  date_options: { id: string; label: string; starts_at: string }[];
  allow_multi_date: boolean;
};

// Route folder is still named [slug] (the id-holding value is passed as
// that param) rather than renamed to [id] - this page fully replaces what
// used to live here (a detail page for the old, now-unused radEvents
// table, reached via getEventBySlug in src/app/actions/events.ts), but
// renaming the folder needs a delete+recreate this environment's
// permission mode won't allow for a plain content swap. Nothing depends on
// the param actually being a human-readable slug; it's just the
// featured_programs row's id.
//
// This is the "view details first, register second" page /events links to
// - clicking a card here no longer jumps straight into RegisterInterestModal
// the way it briefly did; that's a deliberate two-step (view, then decide)
// rather than forcing a registration decision just to see more information.
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
        .select('id, title, location, details, duration, image_url, is_video, form_label, date_options, allow_multi_date')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) setProgram(data);
      setLoading(false);
    }
    fetchProgram();
  }, [id]);

  const registerProgram: RegisterInterestProgram | null = program ? {
    id: program.id,
    title: program.title,
    location: program.location,
    formLabel: program.form_label,
    date_options: program.date_options || [],
    allow_multi_date: program.allow_multi_date,
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Program not found</h1>
        <p className="text-slate-500 text-sm">This one may have been taken down or the link is outdated.</p>
        <Link href="/events" className="text-blue-600 font-black uppercase tracking-widest text-xs hover:underline">
          Back to all programs
        </Link>
      </div>
    );
  }

  const sortedDates = (program.date_options || [])
    .filter(d => d.starts_at)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-4xl mx-auto px-6 lg:px-12 py-10">
        <Link href="/events" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 mb-6">
          <ArrowLeft size={14} /> All Programs
        </Link>

        <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
          <div className="w-full aspect-[16/9] relative overflow-hidden bg-slate-100">
            {program.image_url ? (
              program.is_video ? (
                <video src={program.image_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={program.image_url} alt={program.title} className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Rocket size={80} className="text-slate-300" />
              </div>
            )}
          </div>

          <div className="p-8 md:p-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-6">
              <Star size={14} /> Open to all skill levels
            </div>

            <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 mb-6">
              {program.title}
            </h1>

            <p className="text-slate-600 mb-8 font-medium leading-relaxed text-base">
              {program.details || "A fun, interactive technology program where kids learn to create, build, and code their own digital projects."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0"><MapPin size={18}/></div>
                <div>
                  <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Where</p>
                  <p className="text-sm font-bold text-slate-900">{program.location || 'TBA'}</p>
                </div>
              </div>
              {program.duration && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-fuchsia-100 text-fuchsia-600 rounded-lg shrink-0"><Clock size={18}/></div>
                  <div>
                    <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Duration</p>
                    <p className="text-sm font-bold text-slate-900">{program.duration}</p>
                  </div>
                </div>
              )}
              {sortedDates.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0"><CalendarDays size={18}/></div>
                  <div>
                    <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Next Date</p>
                    <p className="text-sm font-bold text-slate-900">{new Date(sortedDates[0].starts_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              )}
            </div>

            {sortedDates.length > 0 && (
              <div className="mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Available Dates</p>
                <div className="flex flex-wrap gap-2">
                  {sortedDates.map(d => (
                    <span key={d.id} className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setRegisterOpen(true)}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-blue-600/20"
            >
              Register Interest
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {registerOpen && registerProgram && (
          <RegisterInterestModal program={registerProgram} onClose={() => setRegisterOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
