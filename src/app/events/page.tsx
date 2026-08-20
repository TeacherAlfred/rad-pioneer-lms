'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarDays, MapPin, Loader2, ArrowRight, Star, Users, Rocket, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import RegisterInterestModal, { RegisterInterestProgram } from "@/components/RegisterInterestModal";

type FeaturedProgram = {
  id: string;
  title: string;
  location: string | null;
  details: string | null;
  image_url: string;
  form_label: string | null;
  date_options: { id: string; label: string; starts_at: string }[];
  allow_multi_date: boolean;
  sort_order: number;
};

// Sources from the same featured_programs table the homepage carousel
// reads (admin-managed at /admin/featured-programs, scoped to
// show_on_events_page=true here vs show_on_homepage=true there) - this
// used to read a separate, stale Drizzle/Neon `radEvents` table via
// src/app/actions/events.ts, disconnected from anything admins actually
// keep current. That table/action file is untouched by this change but no
// longer linked from here.
export default function EventsDirectoryPage() {
  const [events, setEvents] = useState<FeaturedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerProgram, setRegisterProgram] = useState<RegisterInterestProgram | null>(null);

  useEffect(() => {
    async function loadEvents() {
      // RLS scopes this to draft=false + inside the live_from/live_until
      // window (same as the homepage's read) - show_on_events_page is the
      // additional surface filter specific to this page.
      const { data, error } = await supabase
        .from('featured_programs')
        .select('id, title, location, details, image_url, form_label, date_options, allow_multi_date, sort_order')
        .eq('show_on_events_page', true)
        .order('sort_order', { ascending: true });
      if (!error && data) setEvents(data);
      setLoading(false);
    }
    loadEvents();
  }, []);

  function openRegister(event: FeaturedProgram) {
    setRegisterProgram({
      id: event.id,
      title: event.title,
      location: event.location,
      formLabel: event.form_label,
      date_options: event.date_options || [],
      allow_multi_date: event.allow_multi_date,
    });
  }

  function nextDate(event: FeaturedProgram): string | null {
    const upcoming = (event.date_options || [])
      .filter(d => d.starts_at)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return upcoming[0]?.starts_at || null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-blue-600 font-black uppercase tracking-widest text-xs">Loading Programs...</p>
      </div>
    );
  }

  // Auto-flag the closest upcoming event as the Lead Magnet
  const featuredEvent = events.length > 0 ? events[0] : null;
  const secondaryEvents = events.length > 1 ? events.slice(1) : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30 overflow-x-hidden">

      {/* 1. THE HOOK (Simple, Clear Value for Parents) */}
      <section className="relative pt-16 pb-8 px-6 lg:px-12 max-w-7xl mx-auto text-center z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-6">
          <Star size={14} /> Open to all skill levels
        </div>
        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-tight mb-4 text-slate-900">
          Turn Screen Time Into <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600">
            Real Skills
          </span>
        </h1>
        <p className="text-slate-600 font-medium max-w-2xl mx-auto text-sm md:text-base">
          We use fun, hands-on technology projects to help your child build confidence, logical thinking, and creativity in a safe environment.
        </p>
      </section>

      {/* 2. THE MAGNET (Featured Event - Conversion Focus) */}
      {featuredEvent ? (
        <section className="px-4 md:px-6 lg:px-12 max-w-7xl mx-auto mb-20 relative z-20">

          {/* Soft Background Highlight */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-transparent blur-3xl -z-10 rounded-[40px]" />

          <div className="bg-white border border-slate-200 rounded-[32px] md:rounded-[48px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] relative group">

            {/* Top Badge */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-1.5 rounded-b-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 z-30 shadow-md">
              <Rocket size={14} /> Now Enrolling
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Image Side */}
              <div className="w-full lg:w-1/2 aspect-square lg:aspect-auto relative overflow-hidden bg-slate-100">
                {featuredEvent.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featuredEvent.image_url} alt={featuredEvent.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <Rocket size={80} className="text-slate-300" />
                  </div>
                )}
              </div>

              {/* Content Side */}
              <div className="w-full lg:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center relative z-10">
                <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 mb-4">
                  {featuredEvent.title}
                </h2>

                <p className="text-slate-600 mb-8 font-medium leading-relaxed">
                  {featuredEvent.details || "A fun, interactive holiday program where kids learn to create, build, and code their own digital projects."}
                </p>

                {/* Clear, Simple Details */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><CalendarDays size={18}/></div>
                    <div>
                      <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Starts</p>
                      <p className="text-sm font-bold text-slate-900">{nextDate(featuredEvent) ? new Date(nextDate(featuredEvent)!).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'Dates TBA'}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-fuchsia-100 text-fuchsia-600 rounded-lg"><MapPin size={18}/></div>
                    <div>
                      <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Where</p>
                      <p className="text-sm font-bold text-slate-900 line-clamp-1">
                        {featuredEvent.location || 'TBA'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <span className="text-xs font-black uppercase text-blue-600 tracking-widest flex items-center gap-1.5"><Users size={14}/> Limited Group Size</span>
                </div>

                {/* The Conversion CTA */}
                <button
                  onClick={() => openRegister(featuredEvent)}
                  className="group/btn relative w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all overflow-hidden shadow-lg shadow-blue-600/20"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    View Details & Book a Spot <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="text-center py-24 text-slate-500 font-bold uppercase tracking-widest text-sm">
          No featured programs right now. Check back soon!
        </div>
      )}

      {/* 3. THE BACKLOG (Secondary Events) */}
      {secondaryEvents.length > 0 && (
        <section className="px-6 lg:px-12 max-w-7xl mx-auto pb-24">
          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
              More Upcoming <span className="text-slate-400">Programs</span>
            </h3>
            <div className="flex-1 h-px bg-slate-200 ml-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {secondaryEvents.map((event, i) => (
              <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <button
                  onClick={() => openRegister(event)}
                  className="group block w-full text-left bg-white border border-slate-200 hover:border-blue-300 rounded-3xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/5"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                        <Rocket size={18} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                        {event.location || 'TBA'}
                      </span>
                    </div>

                    <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tight mb-2 group-hover:text-blue-600 transition-colors">
                      {event.title}
                    </h4>

                    <p className="text-xs font-bold text-slate-500 flex items-center gap-2 mb-6">
                      <CalendarDays size={14}/> {nextDate(event) ? new Date(nextDate(event)!).toLocaleDateString() : 'Dates TBA'}
                    </p>

                    <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-600 gap-2 transition-colors">
                      Learn More <ArrowRight size={12} />
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {registerProgram && (
          <RegisterInterestModal program={registerProgram} onClose={() => setRegisterProgram(null)} />
        )}
      </AnimatePresence>

    </div>
  );
}
