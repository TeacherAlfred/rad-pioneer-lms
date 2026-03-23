"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Calendar, ArrowRight, 
  ShieldCheck, Zap, Star, MapPin, 
  ChevronLeft, ChevronRight, Clock 
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const FEATURED_ITEMS = [
  {
    id: "event-1",
    label: "In-Person Event",
    title: "Home Automation Bootcamp",
    location: "Polokwane, South Africa",
    details: "A hands-on intensive session where students build real-world smart home solutions using IoT sensors.",
    duration: "Weekend Workshop",
    image: "/events/polokwane-session.jpg", 
    accent: "bg-rad-teal",
    link: "/request-access"
  },
  {
    id: "prog-1",
    label: "Online Course",
    title: "Game Creator Bootcamp",
    location: "Virtual Classroom",
    details: "From player to creator. Students master the fundamentals of logic and coordinates to publish their own game.",
    duration: "6 Week Program",
    image: "/lesson_video_clips/click_green_flag.mp4", 
    isVideo: true,
    accent: "bg-rad-blue",
    link: "/request-access"
  },
  {
    id: "prog-2",
    label: "Full Term Course",
    title: "Smart Home Systems",
    location: "Online / Virtual",
    details: "An advanced 11-week dive into home automation, coding for smart environments, and the future of IoT.",
    duration: "11 Week Program",
    image: "/logo/rad-logo_white_2.png", 
    accent: "bg-rad-purple",
    link: "/request-access"
  }
];

export default function LandingPage() {
  const [index, setIndex] = useState(0);
  const pioneerLevels = ["Pioneer", "Explorer", "Builder", "Pathfinder", "Trailblazer", "Ambassador"];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % FEATURED_ITEMS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const next = () => setIndex((prev) => (prev + 1) % FEATURED_ITEMS.length);
  const prev = () => setIndex((prev) => (prev - 1 + FEATURED_ITEMS.length) % FEATURED_ITEMS.length);

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-rad-teal/30 overflow-x-hidden">
      
      {/* 1. NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-8 max-w-7xl mx-auto backdrop-blur-md bg-[#020617]/40 border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="relative w-[120px]">
            <Image 
              src="/logo/rad-logo_white_2.png" 
              alt="RAD Academy Logo" 
              width={120} height={40} priority unoptimized
              style={{ width: '100%', height: 'auto', display: 'block' }} 
            />
          </div>
        </div>
        <div className="flex items-center gap-8">
          <Link href="/login" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Student Login</Link>
          <Link href="/request-access" className="px-6 py-3 rounded-full bg-white text-[#020617] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Request Access</Link>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative min-h-[85vh] flex items-center px-8 overflow-hidden pt-20">
<div className="absolute inset-0 z-0 overflow-hidden">
  {/* 1. The Video: Increased opacity for clarity */}
  <video 
    autoPlay 
    muted 
    loop 
    playsInline 
    className="w-full h-full object-cover opacity-40 grayscale-[0.2]"
  >
    <source src="/video_clips/Learning Should Be Fun_1080p.mp4" type="video/mp4" />
  </video>

  {/* 2. Horizontal Overlay: Keeps left side dark for text, clears up on the right */}
  <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/40 to-transparent" />

  {/* 3. Bottom Fade: Smooth transition into the next section */}
  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#020617]" />
</div>
        
        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
              <Zap size={12} fill="currentColor" />
              <span className="text-[9px] font-black uppercase tracking-widest leading-none">Registration Open for 2026</span>
            </div>
            <h1 className="text-7xl md:text-[110px] font-black uppercase italic tracking-tighter leading-[0.85]">
              Building <br /><span className="text-rad-blue">African</span> <br />Giants.
            </h1>
            <p className="text-lg text-slate-400 font-medium max-w-xl italic">
              Elite technology training for the next generation of leaders in digital skills.
            </p>
          </div>
        </div>
      </section>

      {/* 3. CENTERED AUTO-SCROLLING DISPLAY */}
      <section className="py-24 px-8 relative">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-12 px-4">
            <div className="space-y-1">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 leading-none mb-2">Available Now</h2>
              <p className="text-3xl font-black uppercase italic tracking-tight text-white">Current Programs & Events</p>
            </div>
            <div className="flex gap-2">
              <button onClick={prev} className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><ChevronLeft size={20} /></button>
              <button onClick={next} className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="relative h-auto md:h-[500px] w-full group">
            <AnimatePresence mode="wait">
              <motion.div 
                key={FEATURED_ITEMS[index].id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="relative md:absolute inset-0 flex flex-col md:flex-row rounded-[48px] overflow-hidden bg-white/[0.03] border border-white/10 shadow-2xl"
              >
                {/* Left Side: Media */}
                <div className="w-full md:w-1/2 h-72 md:h-full relative bg-slate-900 overflow-hidden">
                  {FEATURED_ITEMS[index].isVideo ? (
                    <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                      <source src={FEATURED_ITEMS[index].image} type="video/mp4" />
                    </video>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-800 font-black uppercase italic text-center p-8">
                      [ {FEATURED_ITEMS[index].title} ]
                    </div>
                  )}
                  {/* Category Badge */}
                  <div className={`absolute top-8 left-8 px-4 py-2 rounded-2xl ${FEATURED_ITEMS[index].accent} text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl`}>
                    {FEATURED_ITEMS[index].label}
                  </div>
                </div>

                {/* Right Side: Content */}
                <div className="w-full md:w-1/2 p-10 md:p-16 flex flex-col justify-center gap-10">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none text-white">
                        {FEATURED_ITEMS[index].title}
                      </h3>
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin size={16} />
                        <span className="text-[11px] font-black uppercase tracking-widest">{FEATURED_ITEMS[index].location}</span>
                      </div>
                    </div>
                    
                    <p className="text-slate-400 text-lg font-medium leading-relaxed italic">
                      {FEATURED_ITEMS[index].details}
                    </p>

                    {/* NEW: Improved Readability for Duration */}
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 w-fit">
                        <Clock size={16} className="text-rad-blue" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                          {FEATURED_ITEMS[index].duration}
                        </span>
                    </div>
                  </div>
                  
                  <Link href={FEATURED_ITEMS[index].link} className="flex items-center justify-center gap-4 px-10 py-5 rounded-3xl bg-white text-[#020617] font-black uppercase italic tracking-tighter hover:bg-slate-200 transition-all text-sm group/btn">
                    Register Interest <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* 4. PIONEER LEVELS */}
      <section className="py-24 px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="flex items-center gap-4 mb-16">
          <Star size={16} className="text-rad-yellow" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Pioneer Progression Path</h2>
          <div className="h-[1px] flex-1 bg-white/5" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          {pioneerLevels.map((level) => (
            <div key={level} className="p-8 rounded-[48px] bg-white/[0.02] border border-white/5 text-center group hover:bg-white/[0.05] transition-all">
              <div className="w-16 h-16 mx-auto mb-6 relative opacity-30 group-hover:opacity-100 transition-all duration-500">
                 <Image src={`/pioneer-levels/${level.toLowerCase()}.png`} alt={level} fill sizes="100px" className="object-contain" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">{level}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="p-16 text-center border-t border-white/5 bg-black/40">
         <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">RAD Academy Admissions // 2026</p>
      </footer>
    </main>
  );
}