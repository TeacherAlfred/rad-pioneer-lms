"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  CalendarDays, MapPin, Clock, Cpu, Zap, CheckCircle2,
  ShieldCheck, ArrowRight, Loader2, Play, 
  ChevronDown, AlertCircle, Info, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

const ICON_MAP: any = { 1: Cpu, 2: Zap, 3: ShieldCheck };

export default function EventWelcomePage() {
  const params = useParams();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      if (!eventId) return;
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
        
      if (data) setEvent(data);
      setLoading(false);
    }
    fetchEvent();
  }, [eventId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-yellow-500" size={48} />
        <p className="text-yellow-500 font-black uppercase tracking-widest text-xs">Initializing Experience...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Event Not Found</h1>
        <p className="text-slate-400 mt-2">This link may be invalid or the event has concluded.</p>
      </div>
    );
  }

  const formattedDate = new Date(event.event_date).toLocaleDateString('en-ZA', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-yellow-500/30 overflow-x-hidden">
      
      {/* --- HERO SECTION --- */}
      <section className="relative min-h-[90vh] flex flex-col justify-center px-6 lg:px-12 pt-20 pb-10">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        </div>

        <div className="max-w-6xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">
              <Sparkles size={14} /> VIP Access Confirmed
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9]">
              Welcome to the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                {event.title}
              </span>
            </h1>
            
            <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-xl">
              You are officially on the roster. Get ready for an intensive, hands-on engineering experience that will transform how your Pioneer sees the world of technology.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a href="#logistics" className="px-8 py-4 bg-yellow-500 text-[#020617] rounded-2xl font-black uppercase tracking-widest text-xs text-center hover:bg-yellow-400 transition-all shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                View Logistics
              </a>
              <a href="#preparation" className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-xs text-center hover:bg-white/10 transition-all">
                What to Bring
              </a>
            </div>
          </motion.div>

          {/* Hero Imagery Showcase (Replace with Supabase Storage Images later) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] md:aspect-square rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
              {event.cover_image_url ? (
                <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-[#020617] flex items-center justify-center">
                   {/* Abstract Placeholder Graphic */}
                   <Cpu size={120} className="text-white/5" />
                   <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent" />
                </div>
              )}
              
              {/* Floating Status Badge */}
              <div className="absolute bottom-8 left-8 right-8 bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center justify-between">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Status</p>
                   <p className="text-white font-bold">Ready for Launch</p>
                 </div>
                 <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30">
                   <ShieldCheck size={24} />
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="text-slate-600" size={32} />
        </div>
      </section>

      {/* --- LOGISTICS STRIP --- */}
      <section id="logistics" className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-white/5">
            
            <div className="flex items-center gap-6 pt-4 md:pt-0">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                <CalendarDays size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">The Date</p>
                <p className="text-lg font-black text-white">{formattedDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-8 md:pt-0 md:pl-8">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center border border-yellow-500/20 shrink-0">
                <Clock size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">The Time</p>
                <p className="text-lg font-black text-white">{event.start_time?.slice(0,5)} — {event.end_time?.slice(0,5)}</p>
                <p className="text-xs text-yellow-500 font-bold mt-1">Please arrive 15 mins early</p>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-8 md:pt-0 md:pl-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <MapPin size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">The Venue</p>
                <p className="text-lg font-black text-white">{event.location_details}</p>
                <p className="text-xs text-slate-400 font-bold mt-1">{event.location_type === 'online' ? 'Digital Stream' : 'In-Person Event'}</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- WHAT TO EXPECT --- */}
      <section className="py-24 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">The Experience</h2>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto font-medium">
              {event.description || "This is not a traditional classroom. This is a high-energy, hands-on engineering lab. Here is what your Pioneer will be doing."}
            </p>
          </div>

          {/* THE EXPERIENCE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(event.welcome_config?.experience_cards || []).map((card: any) => {
              const Icon = ICON_MAP[card.id] || Cpu;
              return (
                <motion.div key={card.id} whileHover={{ y: -10 }} className="bg-white/5 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
                  <Icon className="absolute -right-4 -bottom-4 size-32 text-white/5 group-hover:text-blue-500/10 transition-colors" />
                  <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-6 relative z-10">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tight mb-3 relative z-10">{card.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed relative z-10">{card.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- PREPARATION & CHECKLIST --- */}
      <section id="preparation" className="py-24 px-6 lg:px-12 bg-white/[0.02] border-t border-white/5">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#0f172a] to-[#020617] border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />

          <div className="flex items-center gap-4 mb-10 relative z-10">
            <div className="p-4 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <Info size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Preparation Checklist</h2>
              <p className="text-slate-400 font-medium">What you need to know before arrival.</p>
            </div>
          </div>

          {/* PREPARATION CHECKLIST */}
          <div className="space-y-6 relative z-10">
            {(event.welcome_config?.checklist || []).map((check: any) => (
              <div key={check.id} className="flex gap-4 items-start p-5 bg-white/5 rounded-2xl border border-white/5">
                 <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30"><CheckCircle2 size={16}/></div>
                 <div>
                   <h4 className="text-sm font-black text-white">{check.title}</h4>
                   <p className="text-xs text-slate-400 mt-1 leading-relaxed">{check.desc}</p>
                 </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-10 text-center border-t border-white/5 bg-[#020617]">
        <p className="text-2xl font-black tracking-tighter italic uppercase text-white/20 mb-2">RAD_Academy</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Need urgent assistance? Contact us directly via WhatsApp.</p>
      </footer>

    </div>
  );
}