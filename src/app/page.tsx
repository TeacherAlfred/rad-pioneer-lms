"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Calendar, ArrowRight, 
  ShieldCheck, Zap, Star, MapPin, 
  ChevronLeft, ChevronRight, Clock, X,
  Mail, Phone, Linkedin, Instagram, Facebook, Award, Image as ImageIcon,
  CheckSquare, Square, Loader2, Sparkles, UserCircle, Rocket, ShieldAlert, Lock, Cpu
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import RegisterInterestModal, { RegisterInterestProgram } from "@/components/RegisterInterestModal";

const EVENT_FOLDERS = [
  { id: "gallery-1", title: "Pretoria Lessons", location: "Menlyn, Pretoria", folderName: "pretoria-lessons" },
  { id: "gallery-2", title: "Polokwane Bootcamp", location: "Polokwane, Limpopo", folderName: "polokwane-bootcamp" },
  { id: "gallery-3", title: "Pretoria Bootcamp", location: "Menlyn, Pretoria", folderName: "pretoria-bootcamp" }
];

export default function LandingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  
  // --- MASTER LAUNCH STATE ---
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

  const [pastEvents, setPastEvents] = useState<any[]>(
    EVENT_FOLDERS.map(e => ({ ...e, thumbnail: '/logo/rad-logo_white_2.png', gallery: [] }))
  );
  const [featuredPrograms, setFeaturedPrograms] = useState<any[]>([]);
  const [registerProgram, setRegisterProgram] = useState<RegisterInterestProgram | null>(null);

  // --- FOMO LAUNCH TIMER ---
  useEffect(() => {
    // Exactly 02 May 2026, 00:00 SAST (Midnight)
    const targetDate = new Date("2026-05-02T09:00:00+02:00").getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      // If time has passed, disable the countdown (unveiling the entire page)
      if (difference <= 0) {
        setTimeLeft(null);
      } else {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    updateCountdown(); 
    const timerInterval = setInterval(updateCountdown, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  useEffect(() => {
    if (timeLeft) return; 

    const isPopupDisabled = true; 
    const hasSeenPopup = sessionStorage.getItem("rad_welcome_seen");
    
    if (!hasSeenPopup && !isPopupDisabled) {
      const timer = setTimeout(() => {
        setShowWelcomePopup(true);
        sessionStorage.setItem("rad_welcome_seen", "true");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  useEffect(() => {
    if (featuredPrograms.length === 0) return;
    const timer = setInterval(() => { setIndex((prev) => (prev + 1) % featuredPrograms.length); }, 8000);
    return () => clearInterval(timer);
  }, [featuredPrograms.length]);

  useEffect(() => {
    async function fetchSupabaseData() {
      const updatedEvents = await Promise.all(
        EVENT_FOLDERS.map(async (event) => {
          try {
            const { data, error } = await supabase.storage.from('events_gallery').list(event.folderName);
            if (data && data.length > 0) {
              const validFiles = data.filter(f => f.name && !f.name.startsWith('.'));
              const imageUrls = validFiles.map(file => {
                const { data: urlData } = supabase.storage.from('events_gallery').getPublicUrl(`${event.folderName}/${file.name}`);
                return urlData.publicUrl;
              });
              return { ...event, thumbnail: imageUrls.length > 0 ? imageUrls[0] : '/logo/rad-logo_white_2.png', gallery: imageUrls };
            }
            return { ...event, thumbnail: '/logo/rad-logo_white_2.png', gallery: [] };
          } catch (err) {
            return { ...event, thumbnail: '/logo/rad-logo_white_2.png', gallery: [] };
          }
        })
      );
      setPastEvents(updatedEvents);

      // Admin-managed via /admin/featured-programs. RLS on featured_programs
      // scopes this select to rows whose live_from/live_until window covers
      // now(), so no client-side date filtering is needed here.
      const { data: programRows, error: programError } = await supabase
        .from('featured_programs')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!programError && programRows) {
        setFeaturedPrograms(programRows.map((p: any) => ({
          id: p.id,
          label: p.label,
          title: p.title,
          location: p.location,
          details: p.details,
          duration: p.duration,
          image: p.image_url,
          fallbackImage: p.image_url,
          isVideo: p.is_video,
          accent: p.accent,
          formLabel: p.form_label,
          dateOptions: p.date_options || [],
        })));
      }
    }
    fetchSupabaseData();
  }, []);

  const next = () => setIndex((prev) => (prev + 1) % featuredPrograms.length);
  const prev = () => setIndex((prev) => (prev - 1 + featuredPrograms.length) % featuredPrograms.length);

  const TimeUnit = ({ label, value }: { label: string, value: number }) => (
    <div className="bg-black/60 border border-amber-500/20 rounded-xl md:rounded-2xl p-2 sm:p-3 md:p-6 flex flex-col items-center justify-center shadow-inner relative overflow-hidden group w-full min-w-0">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black italic tracking-tighter text-amber-500 leading-none drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[8px] sm:text-[9px] md:text-xs font-black text-amber-500/50 uppercase tracking-[0.1em] sm:tracking-[0.2em] mt-1 sm:mt-2 truncate w-full text-center">
        {label}
      </span>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-rad-teal/30 overflow-x-hidden relative">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* =========================================
          THE FOMO VAULT (Blocks Entire Site until Launch)
          ========================================= */}
      {timeLeft ? (
        <section className="relative min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto no-scrollbar">
          <div className="absolute inset-0 z-0 overflow-hidden bg-[#020617]">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-20 grayscale mix-blend-luminosity">
              <source src="/video_clips/Learning Should Be Fun_1080p.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/80 to-[#020617]/50" />
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center my-auto py-8">
            
            <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy Logo" width={140} height={46} className="mb-6 md:mb-8 opacity-80 shrink-0" unoptimized />

            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="w-full bg-gradient-to-br from-amber-900/40 via-[#0f172a]/80 to-[#020617]/80 backdrop-blur-xl border border-amber-500/30 rounded-[32px] sm:rounded-[40px] md:rounded-[60px] p-6 sm:p-8 md:p-12 relative overflow-hidden shadow-[0_0_80px_rgba(245,158,11,0.15)] flex flex-col items-center shrink min-h-0"
            >
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse shadow-[0_0_20px_rgba(245,158,11,1)]" />
              
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-amber-500/10 border border-amber-500/40 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.2)] mb-4 md:mb-6 shrink-0"
              >
                <Cpu className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-amber-400" />
              </motion.div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white italic uppercase tracking-tighter leading-[0.9] drop-shadow-md mb-2 sm:mb-4 shrink-0">
                System Boot Sequence <br className="hidden sm:block"/> <span className="text-amber-500">Initiated</span>
              </h2>

              <p className="text-slate-300 text-xs sm:text-sm md:text-base font-medium max-w-xl mx-auto mb-6 md:mb-8 leading-relaxed italic shrink-0">
                Our engineers are wiring the hardware and squashing the final bugs. All systems go live at exactly <span className="text-amber-500 font-black">09:00 Saturday 2 May 2026.</span>
              </p>

              <h3 className="text-[10px] md:text-xs font-black text-amber-500/80 uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-2 sm:mb-4 shrink-0 flex items-center gap-2">
                <ShieldAlert size={14} className="hidden sm:block" />System Live In...
              </h3>

              <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-6 w-full max-w-2xl mb-6 md:mb-10 shrink-0">
                <TimeUnit label="Days" value={timeLeft.days} />
                <TimeUnit label="Hours" value={timeLeft.hours} />
                <TimeUnit label="Minutes" value={timeLeft.minutes} />
                <TimeUnit label="Seconds" value={timeLeft.seconds} />
              </div>

              {/* 2X XP FOMO Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-4 sm:p-5 md:p-6 rounded-2xl md:rounded-3xl w-full text-left relative overflow-hidden group shrink-0">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(245,158,11,0.05)_50%,transparent_75%)] bg-[length:20px_20px] animate-[shimmer_3s_linear_infinite]" />
                <Zap className="absolute -right-10 -bottom-10 w-32 h-32 md:w-48 md:h-48 text-amber-500/10 group-hover:scale-110 group-hover:text-amber-500/20 transition-all duration-700" />
                
                <div className="relative z-10 flex flex-row items-center gap-4 md:gap-6">
                   <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-amber-500/20 rounded-xl md:rounded-2xl border border-amber-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                     <span className="text-xl md:text-2xl font-black text-amber-400 italic">2x</span>
                   </div>
                   <div className="flex-1">
                     <h4 className="text-sm sm:text-base md:text-xl font-black text-white uppercase tracking-tighter italic mb-1">Launch Week Protocol</h4>
                     <p className="text-[9px] sm:text-[10px] md:text-sm font-bold text-amber-100/70 leading-snug md:leading-relaxed max-w-xl">
                       All registered learners receive <span className="text-amber-400 font-black">DOUBLE XP</span> on missions and daily claims during <span className="text-amber-500 font-black">launch week (Sat - Fri 8 May)</span>.
                     </p>
                     <p className="text-[9px] sm:text-[10px] md:text-sm font-bold text-amber-100/70 leading-snug md:leading-relaxed max-w-xl">
                       Secure your spot on the leaderboard.
                     </p>
                   </div>
                </div>
              </div>
            </motion.div>

            <div className="flex flex-row gap-3 md:gap-4 mt-6 md:mt-8 w-full max-w-sm shrink-0">
               <Link href="/login" className="flex-1 flex items-center justify-center gap-2 py-3.5 md:py-4 rounded-xl md:rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all">
                 <UserCircle size={14} className="text-slate-400" /> Login
               </Link>
               <Link href="/request-access" className="flex-1 text-center flex items-center justify-center py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white hover:bg-slate-200 text-[#020617] text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg transition-all">
                 Register Interest
               </Link>
            </div>
          </div>
        </section>
      ) : (
        /* =========================================
           THE UNVEILED PAGE (Post-Launch)
           ========================================= */
        <>
          <AnimatePresence>
            {showWelcomePopup && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => setShowWelcomePopup(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                
                <motion.div 
                  initial={{ scale: 0.8, y: 50, opacity: 0 }} 
                  animate={{ scale: 1, y: 0, opacity: 1 }} 
                  exit={{ scale: 0.9, y: 30, opacity: 0 }}
                  transition={{ type: "spring", damping: 20, stiffness: 100, mass: 1 }}
                  className="relative w-full max-w-2xl bg-gradient-to-b from-[#0f172a] to-[#020617] rounded-[48px] overflow-hidden shadow-[0_0_100px_rgba(59,130,246,0.15)] border border-white/10"
                >
                  <div className="p-10 md:p-14 flex flex-col items-center text-center relative z-10">
                    <button onClick={() => setShowWelcomePopup(false)} className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white z-50">
                      <X size={20} />
                    </button>

                    <div className="relative mb-10 mt-4">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[28px] flex items-center justify-center border border-white/20 shadow-2xl relative z-10">
                        <Rocket size={40} className="text-white" />
                      </div>
                    </div>

                    <div className="space-y-4 mb-10 overflow-hidden">
                      <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-[0.9]">
                        Welcome to the <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-fuchsia-400">
                          Revamped LMS
                        </span>
                      </h2>
                      <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-sm mx-auto pt-2">
                        We've entirely rebuilt the RAD Academy platform from the ground up to give our Pioneers the ultimate digital learning experience. 
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                      <Link href="/request-access" className="w-full py-5 bg-white text-[#020617] rounded-2xl font-black uppercase italic tracking-widest text-xs hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02]">
                        Request Access
                      </Link>
                      <Link href="/login" onClick={() => setShowWelcomePopup(false)} className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase italic tracking-widest text-xs hover:bg-white/10 transition-all shadow-inner flex items-center justify-center gap-2 group hover:scale-[1.02]">
                         <UserCircle size={18} className="text-slate-400 group-hover:text-blue-400 transition-colors" /> Pioneer Login
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* NAVIGATION */}
          <nav className="fixed top-0 left-0 right-0 z-50 flex flex-col md:flex-row items-center justify-center md:justify-between p-4 md:p-8 gap-4 md:gap-0 max-w-7xl mx-auto backdrop-blur-xl bg-[#020617]/80 md:bg-[#020617]/40 border-b border-white/5">
            <div className="flex items-center gap-6">
              <div className="relative w-[100px] md:w-[120px]">
                <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy Logo" width={120} height={40} priority unoptimized style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <Link href="/login" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                <UserCircle size={16} /> Login
              </Link>
              <Link href="/request-access" className="px-6 py-3 rounded-full bg-white text-[#020617] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg">Request Access</Link>
            </div>

            <div className="flex md:hidden flex-col items-center gap-3 mt-4 w-full sm:max-w-sm px-2">
              <div className="w-full flex gap-4">
                 <Link href="/login" className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-white/10 bg-white/5 text-white text-[11px] font-black uppercase tracking-widest">
                   <UserCircle size={14} /> Login
                 </Link>
                 <Link href="/request-access" className="flex-1 text-center flex items-center justify-center py-3.5 rounded-full bg-white text-[#020617] text-[11px] font-black uppercase tracking-widest shadow-lg">Register</Link>
              </div>
            </div>
          </nav>

          {/* HERO SECTION */}
          <section className="relative min-h-[100dvh] md:min-h-[85vh] flex items-center px-6 md:px-8 overflow-hidden pt-36 md:pt-20">
            <div className="absolute inset-0 z-0 overflow-hidden bg-[#020617]">
              <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-40 grayscale mix-blend-luminosity">
                <source src="/video_clips/Learning Should Be Fun_1080p.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/50 to-transparent" />
            </div>
            
            <div aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 left-0 right-0 overflow-hidden pointer-events-none flex justify-center opacity-30 select-none z-0">
              <div className="text-[30vw] font-black italic tracking-tighter leading-none text-transparent" style={{ WebkitTextStroke: '2px rgba(255,255,255,0.2)' }}>
                <span className="text-rad-teal/20" style={{ WebkitTextStroke: '2px rgba(45,212,191,0.5)' }}>R</span>
                <span className="text-rad-blue/20" style={{ WebkitTextStroke: '2px rgba(96,165,250,0.5)' }}>A</span>
                <span className="text-rad-purple/20" style={{ WebkitTextStroke: '2px rgba(192,132,252,0.5)' }}>D</span>
              </div>
            </div>
            
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-7xl mx-auto w-full relative z-10">
              <div className="max-w-3xl space-y-6 md:space-y-8 backdrop-blur-[2px]">
                <div className="inline-flex items-center gap-3 px-1">
                  <div className="w-8 h-[1px] bg-rad-blue" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rad-blue leading-none">2026 Intake Open</span>
                </div>
                
                <h1 className="font-black uppercase italic tracking-tighter leading-[0.9] md:leading-[0.85] text-[44px] sm:text-5xl md:text-[90px] drop-shadow-2xl">
                  <span className="text-rad-teal">
                    <span className="text-[64px] sm:text-7xl md:text-[130px]">R</span>edefining
                  </span> <br />
                  <span className="text-rad-blue">
                    <span className="text-[64px] sm:text-7xl md:text-[130px]">A</span>frican
                  </span> <br />
                  <span className="text-rad-purple">
                    <span className="text-[64px] sm:text-7xl md:text-[130px]">D</span>reams.
                  </span>
                </h1>
                
                <div className="pl-4 md:pl-6 border-l-2 border-rad-teal space-y-4">
                  <p className="text-base sm:text-lg md:text-xl text-white font-medium italic leading-relaxed drop-shadow-md">
                    Empowering the African child to build globally impactful solutions.
                  </p>
                  <p className="text-sm md:text-base text-slate-300 font-light italic leading-relaxed drop-shadow-md">
                    We believe in re-igniting the brilliance of their dreams, empowering them with the confidence to shape their future.
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* PROGRAMS CAROUSEL */}
          {featuredPrograms.length > 0 && (
          <section className="py-16 md:py-24 px-6 md:px-8 relative min-h-[100dvh] md:min-h-0 flex flex-col justify-center">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-5xl mx-auto w-full">
              <div className="flex items-end justify-between mb-8 md:mb-12 px-2 md:px-4">
                <div className="space-y-1">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 leading-none mb-2">Available Now</h2>
                  <p className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-white">Current Programs</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={prev} className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all hidden md:block"><ChevronLeft size={20} /></button>
                  <button onClick={next} className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all hidden md:block"><ChevronRight size={20} /></button>
                </div>
              </div>

              <div className="relative h-auto md:h-[500px] w-full group">
                <AnimatePresence mode="wait">
                  <motion.div key={featuredPrograms[index].id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }} className="relative md:absolute inset-0 flex flex-col md:flex-row rounded-[24px] md:rounded-[48px] overflow-hidden bg-white/[0.03] border border-white/10 shadow-2xl">
                    
                    <div className="w-full md:w-1/2 h-56 sm:h-64 md:h-full relative bg-[#0f172a] overflow-hidden shrink-0">
                      {featuredPrograms[index].isVideo ? (
                        <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                          <source src={featuredPrograms[index].image || featuredPrograms[index].fallbackImage} type="video/mp4" />
                        </video>
                      ) : (
                        <Image src={featuredPrograms[index].image || featuredPrograms[index].fallbackImage || "/logo/rad-logo_white_2.png"} alt={featuredPrograms[index].title} fill className="object-cover" />
                      )}
                      <div className={`absolute top-4 left-4 md:top-8 md:left-8 px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl ${featuredPrograms[index].accent} text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] shadow-xl`}>
                        {featuredPrograms[index].label}
                      </div>
                    </div>

                    <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-16 flex flex-col justify-center gap-5 md:gap-10">
                      <div className="space-y-4 md:space-y-6">
                        <div className="space-y-2 md:space-y-3">
                          <h3 className="text-[28px] sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-[1.1] md:leading-none text-white">{featuredPrograms[index].title}</h3>
                          <div className="flex items-center gap-2 text-slate-500">
                            <MapPin size={14} className="md:w-4 md:h-4" />
                            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{featuredPrograms[index].location}</span>
                          </div>
                        </div>
                        
                        <p className="text-slate-400 text-sm md:text-lg font-medium leading-relaxed italic">{featuredPrograms[index].details}</p>

                        <div className="flex items-center gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/5 border border-white/5 w-fit">
                            <Clock size={14} className="text-rad-blue md:w-4 md:h-4" />
                            <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-white">{featuredPrograms[index].duration}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setRegisterProgram({
                          id: featuredPrograms[index].id,
                          title: featuredPrograms[index].title,
                          location: featuredPrograms[index].location,
                          formLabel: featuredPrograms[index].formLabel,
                          date_options: featuredPrograms[index].dateOptions,
                        })}
                        className="flex items-center justify-center gap-3 md:gap-4 px-6 md:px-10 py-3.5 md:py-5 rounded-2xl md:rounded-3xl bg-white text-[#020617] font-black uppercase italic tracking-tighter hover:bg-slate-200 transition-all text-xs md:text-sm group/btn shadow-xl mt-2 md:mt-0"
                      >
                        Register Interest <ArrowRight size={16} className="md:w-[18px] md:h-[18px] group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
                
                <div className="flex md:hidden items-center justify-center gap-4 mt-8 absolute -bottom-20 left-0 right-0">
                  <button onClick={prev} className="p-3 rounded-full bg-white/5 border border-white/10 active:bg-white/10 transition-all"><ChevronLeft size={18} /></button>
                  <div className="flex gap-2">
                    {featuredPrograms.map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/20'}`} />))}
                  </div>
                  <button onClick={next} className="p-3 rounded-full bg-white/5 border border-white/10 active:bg-white/10 transition-all"><ChevronRight size={18} /></button>
                </div>
              </div>
            </motion.div>
          </section>
          )}

          {/* GALLERIES & FOOTER */}
          <section className="hidden md:block py-24 px-8 max-w-7xl mx-auto border-t border-white/5">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
              <div className="flex items-end justify-between mb-12">
                <div className="space-y-1">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 leading-none mb-2">Academy Memories</h2>
                  <p className="text-3xl font-black uppercase italic tracking-tight text-white">Past Events Gallery</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8">
                {pastEvents.map((item) => (
                  <div key={item.id} onClick={() => item.gallery.length > 0 && setSelectedEvent(item)} className={`group rounded-[40px] bg-white/[0.02] border border-white/5 p-4 flex flex-col transition-all hover:bg-white/[0.05] shadow-inner select-none ${item.gallery.length > 0 ? 'cursor-pointer hover:border-white/10 hover:shadow-2xl hover:-translate-y-2' : 'opacity-50 grayscale'}`} onContextMenu={(e) => e.preventDefault()}>
                    <div className="w-full h-64 bg-[#0f172a] rounded-[28px] overflow-hidden relative shadow-inner">
                      <Image src={item.thumbnail || '/logo/rad-logo_white_2.png'} alt={item.title} fill className="object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700" draggable={false} />
                      {item.gallery.length > 0 && (
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                          <ImageIcon size={14} className="text-rad-blue" />
                          <span className="text-[10px] font-black tracking-widest text-white">{item.gallery.length} PHOTOS</span>
                        </div>
                      )}
                      {item.gallery.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"><span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Awaiting Uploads</span></div>
                      )}
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-4 bg-white/10 backdrop-blur-sm -rotate-2 group-hover:bg-white/20 transition-all" />
                    </div>
                    <div className="pt-6 pb-2 px-4 text-center">
                      <p className="text-lg font-black uppercase italic tracking-widest text-white leading-tight mb-2 group-hover:text-rad-blue transition-colors">{item.title}</p>
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <MapPin size={14} />
                        <p className="text-[10px] uppercase tracking-[0.2em]">{item.location}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="md:hidden py-16 relative border-t border-white/5 mt-10">
            <div className="space-y-1 mb-8 px-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 leading-none mb-2">Academy Memories</h2>
              <p className="text-3xl font-black uppercase italic tracking-tight text-white">Past Events</p>
            </div>
            
            <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-8 px-6 w-full no-scrollbar">
               {pastEvents.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => item.gallery.length > 0 && setSelectedEvent(item)} 
                    className={`min-w-[80vw] sm:min-w-[60vw] aspect-[4/5] shrink-0 snap-center rounded-[32px] overflow-hidden relative flex flex-col justify-end active:scale-[0.98] transition-transform select-none ${item.gallery.length > 0 ? 'cursor-pointer shadow-2xl border border-white/10' : 'opacity-50 grayscale border border-white/5'}`} 
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <div className="absolute inset-0 bg-[#0f172a] z-0">
                      <Image src={item.thumbnail || '/logo/rad-logo_white_2.png'} alt={item.title} fill className="object-cover opacity-90" draggable={false} />
                    </div>

                    {item.gallery.length > 0 ? (
                      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-lg z-10">
                        <ImageIcon size={12} className="text-rad-blue" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white">{item.gallery.length} Photos</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase bg-black/40 px-4 py-2 rounded-full border border-white/5">Awaiting Uploads</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/70 to-transparent z-0" />

                    <div className="relative z-10 p-6 w-full">
                      <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none mb-2 shadow-sm">{item.title}</h3>
                      <div className="flex items-center gap-1.5 text-rad-blue">
                        <MapPin size={12} />
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">{item.location}</p>
                      </div>
                    </div>
                  </div>
               ))}
            </div>
          </motion.section>

          <AnimatePresence>
            {selectedEvent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-center justify-center md:p-8">
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-[#020617] md:border border-white/10 rounded-none md:rounded-[48px] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl flex flex-col shadow-2xl overflow-hidden relative">
                  
                  <div className="flex items-center justify-between p-5 sm:p-6 md:p-8 border-b border-white/10 bg-black/40 md:bg-white/[0.02] backdrop-blur-2xl shrink-0 sticky top-0 z-20">
                    <div>
                      <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg">{selectedEvent.title}</h3>
                      <div className="flex items-center gap-1.5 text-rad-blue mt-1">
                        <MapPin size={12} className="md:w-4 md:h-4" />
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">{selectedEvent.location}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedEvent(null)} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 md:bg-white/5 border border-white/20 md:border-white/10 flex items-center justify-center text-white md:text-slate-400 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md shrink-0"><X size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 no-scrollbar bg-black/40 md:bg-black/20 relative z-10">
                    <div className={`grid gap-6 md:gap-6 grid-cols-1 sm:grid-cols-2 ${selectedEvent.gallery.length <= 4 ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
                      {selectedEvent.gallery.map((imgSrc: string, i: number) => (
                        <div key={i} className="w-full aspect-[4/3] sm:aspect-square md:aspect-square rounded-[24px] md:rounded-[32px] overflow-hidden border border-white/10 md:border-white/5 relative bg-[#0f172a] shadow-2xl md:shadow-lg group select-none" onContextMenu={(e) => e.preventDefault()}>
                          <Image src={imgSrc || '/logo/rad-logo_white_2.png'} alt={`Gallery image ${i + 1}`} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-105" draggable={false} />
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/10 pointer-events-none">
                            <div className="-rotate-[35deg] flex flex-col items-center opacity-[0.20] mix-blend-overlay">
                              <p className="text-white font-black uppercase tracking-[0.3em] text-2xl md:text-2xl whitespace-nowrap drop-shadow-md">RAD Gallery</p>
                              <p className="text-white font-black uppercase tracking-[0.1em] text-xs md:text-sm whitespace-nowrap mt-1 drop-shadow-md">{selectedEvent.title}</p>
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 md:opacity-0 pointer-events-none" />
                        </div>
                      ))}
                    </div>
                    <div className="h-12 md:hidden" />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="border-t border-white/5 bg-[#020617] pt-12 md:pt-16 pb-8 px-6 md:px-12 relative overflow-hidden mt-10 md:mt-0">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-48 bg-rad-blue/5 blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-10 md:gap-12 justify-between relative z-10">
              <div className="space-y-6 md:space-y-8 md:w-1/3">
                <div className="space-y-6">
                  <div className="relative w-[120px]">
                    <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy Logo" width={120} height={40} unoptimized style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-xs md:max-w-sm">
                    Building African Giants through elite technology training, practical bootcamps, and dedicated mentorship.
                  </p>
                </div>
                
                <div className="space-y-4 pt-2">
                  <a href="mailto:info@radacademy.co.za" className="flex items-center gap-4 text-slate-400 hover:text-white transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-rad-teal/20 transition-colors"><Mail size={16} className="text-rad-teal" /></div>
                    <span className="text-sm font-medium">info@radacademy.co.za</span>
                  </a>
                  <a href="https://wa.me/27769065959" target="_blank" className="flex items-center gap-4 text-slate-400 hover:text-white transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-green-500/20 transition-colors"><Phone size={16} className="text-green-400" /></div>
                    <span className="text-sm font-medium">+27 76 906 5959</span>
                  </a>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/5">
                  <Link href="https://www.linkedin.com/company/rad-academy-digital" target="_blank" className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-rad-blue hover:border-rad-blue hover:bg-rad-blue/10 transition-all"><Linkedin size={20} /></Link>
                  <Link href="https://www.instagram.com/academy_rad1" target="_blank" className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-rad-purple hover:border-rad-purple hover:bg-rad-purple/10 transition-all"><Instagram size={20} /></Link>
                  <Link href="https://www.facebook.com/radacademy1" target="_blank" className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-rad-teal hover:border-rad-teal hover:bg-rad-teal/10 transition-all"><Facebook size={20} /></Link>
                </div>
              </div>

              <div className="md:w-1/3 flex flex-col justify-center">
                <div className="p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-white/5 text-slate-300 border border-white/10"><MapPin size={20} /></div>
                    <h4 className="text-white font-black uppercase tracking-[0.2em] text-[11px]">In-Person Lessons</h4>
                  </div>
                  <h5 className="text-white text-base md:text-lg font-black italic tracking-tighter uppercase mb-2 md:mb-3">Menlyn, Pretoria</h5>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed italic mb-5 md:mb-6">
                    Join our collaborative weekend sessions to get hands-on experience with real-world robotics and hardware.
                  </p>
                  <div className="flex flex-col gap-1.5 md:gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl bg-[#020617] border border-white/5 shadow-inner">
                    <div className="flex items-center justify-between"><span className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest">Saturday</span><span className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">10:00 - 11:00</span></div>
                    <div className="h-[1px] w-full bg-white/5" />
                    <div className="flex items-center justify-between"><span className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest">Sunday</span><span className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">14:00 - 15:00</span></div>
                  </div>
                </div>
              </div>

              <div className="md:w-1/3">
                <div className="p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-gradient-to-b from-rad-blue/10 to-[#020617] border border-rad-blue/20 relative overflow-hidden group hover:border-rad-blue/40 transition-colors shadow-2xl h-full flex flex-col justify-center">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rad-blue via-rad-purple to-rad-teal" />
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-rad-blue/20 text-rad-blue border border-rad-blue/30"><Award size={20} /></div>
                    <h4 className="text-white font-black uppercase tracking-[0.2em] text-[11px]">Premium Online Lessons</h4>
                  </div>
                  <h5 className="text-white text-base md:text-lg font-black italic tracking-tighter uppercase mb-2 md:mb-3">1-on-1 Mentorship</h5>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed italic mb-5 md:mb-6">
                    Avoid crowded group classes. Our premium online students receive dedicated, personalized coaching from expert instructors.
                  </p>
                  <div className="flex items-center gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl bg-[#020617] border border-white/5 shadow-inner mt-auto">
                    <Clock size={16} className="text-rad-blue" />
                    <div className="space-y-0.5">
                      <p className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest">Monday - Friday</p>
                      <p className="text-rad-blue text-[9px] md:text-[10px] font-black uppercase tracking-widest">15:00 - 18:00</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto mt-10 md:mt-16 pt-6 md:pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 pb-6 text-center md:text-left">
               <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">RAD Academy // © 2026</p>
               <div className="flex gap-8 text-[10px] font-bold text-slate-600 uppercase tracking-widest"></div>
            </div>
          </footer>
        </>
      )}

      <AnimatePresence>
        {registerProgram && (
          <RegisterInterestModal program={registerProgram} onClose={() => setRegisterProgram(null)} />
        )}
      </AnimatePresence>
    </main>
  );
}