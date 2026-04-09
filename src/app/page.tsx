"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Calendar, ArrowRight, 
  ShieldCheck, Zap, Star, MapPin, 
  ChevronLeft, ChevronRight, Clock, X,
  Mail, Phone, Linkedin, Instagram, Facebook, Award, Image as ImageIcon,
  CheckSquare, Square, Loader2, Sparkles, UserCircle, Rocket
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase"; 

const INITIAL_PROGRAMS = [
  {
    id: "event-1",
    label: "In-Person Event",
    title: "Home Automation Bootcamp",
    location: "Polokwane, South Africa",
    details: "A hands-on intensive session where students build real-world smart home solutions using IoT sensors.",
    duration: "Weekend Workshop",
    folderPath: "bootcamps/polokwane_bootcamp",
    image: "/events/polokwane-session.jpg", 
    fallbackImage: "/events/polokwane-session.jpg", 
    isVideo: false,
    accent: "bg-rad-teal",
    formLabel: "Home Automation Bootcamp (PLK)" 
  },
  {
    id: "prog-1",
    label: "Online Course",
    title: "Game Creator Bootcamp",
    location: "Virtual Classroom",
    details: "From player to creator. Students master the fundamentals of logic and coordinates to publish their own game.",
    duration: "6 Week Program",
    folderPath: "short_programs/game_creator",
    image: "/lesson_video_clips/click_green_flag.mp4", 
    fallbackImage: "/lesson_video_clips/click_green_flag.mp4", 
    isVideo: true, 
    accent: "bg-rad-blue",
    formLabel: "Game Creator Bootcamp (Online)"
  },
  {
    id: "prog-2",
    label: "Full Term Course",
    title: "Smart Home Systems",
    location: "Online / Virtual",
    details: "An advanced 11-week dive into home automation, coding for smart environments, and the future of IoT.",
    duration: "11 Week Program",
    folderPath: "term_programs/term_2_2026",
    image: "/logo/rad-logo_white_2.png", 
    fallbackImage: "/logo/rad-logo_white_2.png", 
    isVideo: false,
    accent: "bg-rad-purple",
    formLabel: "Term Program - Smart Home Systems"
  }
];

const EVENT_FOLDERS = [
  { id: "gallery-1", title: "Pretoria Lessons", location: "Menlyn, Pretoria", folderName: "pretoria-lessons" },
  { id: "gallery-2", title: "Polokwane Bootcamp", location: "Polokwane, Limpopo", folderName: "polokwane-bootcamp" },
  { id: "gallery-3", title: "Pretoria Bootcamp", location: "Menlyn, Pretoria", folderName: "pretoria-bootcamp" }
];

const ALL_PROGRAM_OPTIONS = [
  "Demo LMS Access",
  "Home Automation Bootcamp (PLK)",
  "Game Creator Bootcamp (Online)",
  "Term Program - Smart Home Systems"
];

export default function LandingPage() {
  const [index, setIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  
  // --- WELCOME POPUP STATE ---
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  const [pastEvents, setPastEvents] = useState<any[]>(
    EVENT_FOLDERS.map(e => ({ ...e, thumbnail: '/logo/rad-logo_white_2.png', gallery: [] }))
  );

  const [featuredPrograms, setFeaturedPrograms] = useState(INITIAL_PROGRAMS);

  // --- FORM STATE ---
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  
  const [formData, setFormData] = useState({
    parentName: "",
    email: "",
    phone: "",
    studentName: "",
    studentAge: "",
    selectedPrograms: [] as string[],
    smartHomeMode: "",
    botField: "" // Honeypot field for spam bots
  });

  useEffect(() => {
    // TEMPORARY DISABLE: Paused for the Polokwane Bootcamp Ad Campaign
    const isPopupDisabled = true; 

    const hasSeenPopup = sessionStorage.getItem("rad_welcome_seen");
    if (!hasSeenPopup && !isPopupDisabled) {
      // 2 seconds delay for suspenseful dramatic entry
      const timer = setTimeout(() => {
        setShowWelcomePopup(true);
        sessionStorage.setItem("rad_welcome_seen", "true");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
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

      const updatedPrograms = await Promise.all(
        INITIAL_PROGRAMS.map(async (prog) => {
          try {
            const { data, error } = await supabase.storage.from('programs').list(prog.folderPath);
            if (data && data.length > 0) {
              const validFiles = data.filter(f => f.name && !f.name.startsWith('.'));
              if (validFiles.length > 0) {
                const { data: urlData } = supabase.storage.from('programs').getPublicUrl(`${prog.folderPath}/${validFiles[0].name}`);
                return { ...prog, image: urlData.publicUrl, isVideo: false };
              }
            }
            return { ...prog, image: prog.fallbackImage };
          } catch (err) {
            return { ...prog, image: prog.fallbackImage };
          }
        })
      );
      setFeaturedPrograms(updatedPrograms);
    }
    fetchSupabaseData();
  }, []);

  const next = () => setIndex((prev) => (prev + 1) % featuredPrograms.length);
  const prev = () => setIndex((prev) => (prev - 1 + featuredPrograms.length) % featuredPrograms.length);

  const handleOpenRegister = (prefilledProgram?: string) => {
    setSubmitSuccess(false);
    setFormError("");
    setFormData({
      parentName: "", email: "", phone: "", studentName: "", studentAge: "",
      selectedPrograms: prefilledProgram ? [prefilledProgram] : [],
      smartHomeMode: "", botField: ""
    });
    setIsRegisterOpen(true);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('register') === 'plk-bootcamp') {
        setTimeout(() => {
          handleOpenRegister("Home Automation Bootcamp (PLK)");
        }, 300);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const toggleProgram = (program: string) => {
    setFormError("");
    setFormData(prev => ({
      ...prev,
      selectedPrograms: prev.selectedPrograms.includes(program)
        ? prev.selectedPrograms.filter(p => p !== program)
        : [...prev.selectedPrograms, program]
    }));
  };

const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    
    if (formData.botField) {
      setSubmitSuccess(true);
      setTimeout(() => setIsRegisterOpen(false), 3000); 
      return;
    }

    const phoneRegex = /^\+?[0-9\s\-()]{9,15}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      setFormError("Please enter a valid phone number.");
      return;
    }

    const age = parseInt(formData.studentAge);
    if (isNaN(age) || age < 5 || age > 18) {
      setFormError("Student age must be a number between 5 and 18.");
      return;
    }

    if (formData.selectedPrograms.length === 0) {
      setFormError("Please select at least one program of interest.");
      return;
    }

    if (formData.selectedPrograms.includes("Term Program - Smart Home Systems") && !formData.smartHomeMode) {
      setFormError("Please select an attendance mode (Online/In-Person) for the Term Program.");
      return;
    }

    setIsSubmitting(true);

    const finalProgramsList = formData.selectedPrograms.map(prog => {
      if (prog === "Term Program - Smart Home Systems") {
        return `${prog} (${formData.smartHomeMode})`;
      }
      return prog;
    });

try {
      const { error } = await supabase
        .from('registrations')
        .insert([{
          parent_name: formData.parentName,
          email: formData.email,
          phone: formData.phone.trim(),
          student_name: formData.studentName,
          student_age: age,
          interested_programs: finalProgramsList, 
          status: 'new',
          metadata: {
            funnel_stage: "Lead (New)",
            funnel_stage_updated_at: new Date().toISOString()
          }
        }]);

      if (error) throw error;
      
      fetch('/api/send-registration-conf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          parentName: formData.parentName,
          studentName: formData.studentName
        })
      }).catch(err => console.error("Silent background email error:", err));

      setSubmitSuccess(true);
      setTimeout(() => setIsRegisterOpen(false), 3000); 
      
    } catch (error: any) {
      console.error("Registration failed:", error.message);
      setFormError("Database error: Could not submit registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-rad-teal/30 overflow-x-hidden relative">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* --- NEW: PREMIUM WELCOME POPUP WITH ANIMATED EFFECTS --- */}
      <AnimatePresence>
        {showWelcomePopup && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            {/* Dark blur backdrop */}
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
              {/* Sweeping Glass Glare Effect */}
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 1.8, ease: "easeInOut", delay: 0.2 }}
                className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 z-0 pointer-events-none"
              />

              {/* Ambient Orbs */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none" />
              
              <div className="p-10 md:p-14 flex flex-col items-center text-center relative z-10">
                <button onClick={() => setShowWelcomePopup(false)} className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white z-50">
                  <X size={20} />
                </button>

                {/* Animated Icon with Particle Burst */}
                <div className="relative mb-10 mt-4">
                  {/* Central Core */}
                  <motion.div 
                    initial={{ rotate: -90, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", duration: 1, delay: 0.3 }}
                    className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[28px] flex items-center justify-center border border-white/20 shadow-2xl relative z-10"
                  >
                    <Rocket size={40} className="text-white" />
                  </motion.div>
                  
                  {/* Expanding Ring */}
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
                    className="absolute inset-0 border-2 border-blue-400 rounded-[28px] z-0 pointer-events-none"
                  />

                  {/* Explosive Starburst Particles */}
                  {[...Array(12)].map((_, i) => {
                    const angle = (i * 360) / 12;
                    return (
                      <motion.div
                        key={i}
                        initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                        animate={{
                          x: Math.cos((angle * Math.PI) / 180) * 120,
                          y: Math.sin((angle * Math.PI) / 180) * 120,
                          scale: [0, 1.5, 0],
                          opacity: [1, 1, 0]
                        }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                        className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,1)] z-0 pointer-events-none"
                      />
                    );
                  })}
                </div>

                <div className="space-y-4 mb-10 overflow-hidden">
                  <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400"
                  >
                    System Online
                  </motion.p>
                  <motion.h2 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-[0.9]"
                  >
                    Welcome to the <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-fuchsia-400">
                      Revamped LMS
                    </span>
                  </motion.h2>
                  <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-slate-400 text-sm md:text-base leading-relaxed max-w-sm mx-auto pt-2"
                  >
                    We've entirely rebuilt the RAD Academy platform from the ground up to give our Pioneers the ultimate digital learning experience. 
                  </motion.p>
                </div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex flex-col sm:flex-row items-center gap-4 w-full"
                >
                  <button onClick={() => { setShowWelcomePopup(false); handleOpenRegister("Demo LMS Access"); }} className="w-full py-5 bg-white text-[#020617] rounded-2xl font-black uppercase italic tracking-widest text-xs hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02]">
                    Request Access
                  </button>
                  <Link href="/login" onClick={() => setShowWelcomePopup(false)} className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase italic tracking-widest text-xs hover:bg-white/10 transition-all shadow-inner flex items-center justify-center gap-2 group hover:scale-[1.02]">
                     <UserCircle size={18} className="text-slate-400 group-hover:text-blue-400 transition-colors" /> Pioneer Login
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* 1. NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex flex-col md:flex-row items-center justify-center md:justify-between p-4 md:p-8 gap-4 md:gap-0 max-w-7xl mx-auto backdrop-blur-xl bg-[#020617]/80 md:bg-[#020617]/40 border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="relative w-[100px] md:w-[120px]">
            <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy Logo" width={120} height={40} priority unoptimized style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
          {/* LOGIN BUTTON */}
          <Link href="/login" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
            <UserCircle size={16} /> Login
          </Link>
          <button onClick={() => handleOpenRegister("Demo LMS Access")} className="px-6 py-3 rounded-full bg-white text-[#020617] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg">Request Access</button>
        </div>

        <div className="flex md:hidden flex-col items-center gap-3 mt-2 w-full max-w-[250px]">
          {/* LOGIN BUTTON MOBILE */}
          <div className="w-full flex gap-3">
             <Link href="/login" className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-white/10 bg-white/5 text-white text-[11px] font-black uppercase tracking-widest">
               <UserCircle size={14} /> Login
             </Link>
             <button onClick={() => handleOpenRegister("Demo LMS Access")} className="flex-1 text-center py-3.5 rounded-full bg-white text-[#020617] text-[11px] font-black uppercase tracking-widest shadow-lg">Register</button>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative min-h-[100dvh] md:min-h-[85vh] flex items-center px-8 overflow-hidden pt-44 md:pt-20">
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
          <div className="max-w-3xl space-y-8 backdrop-blur-[2px]">
            <div className="inline-flex items-center gap-3 px-1">
              <div className="w-8 h-[1px] bg-rad-blue" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rad-blue leading-none">2026 Intake Open</span>
            </div>
            
            <h1 className="font-black uppercase italic tracking-tighter leading-[0.85] text-5xl md:text-[90px] drop-shadow-2xl">
              <span className="text-rad-teal">
                <span className="text-7xl md:text-[130px]">R</span>edefining
              </span> <br />
              <span className="text-rad-blue">
                <span className="text-7xl md:text-[130px]">A</span>frican
              </span> <br />
              <span className="text-rad-purple">
                <span className="text-7xl md:text-[130px]">D</span>reams.
              </span>
            </h1>
            
            <div className="pl-6 border-l-2 border-rad-teal space-y-4">
              <p className="text-lg md:text-xl text-white font-medium italic leading-relaxed drop-shadow-md">
                Empowering the African child to build globally impactful solutions.
              </p>
              <p className="text-sm md:text-base text-slate-300 font-light italic leading-relaxed drop-shadow-md">
                We believe in re-igniting the brilliance of their dreams, empowering them with the confidence to shape their future.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. CENTERED AUTO-SCROLLING DISPLAY */}
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
              <motion.div key={featuredPrograms[index].id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }} className="relative md:absolute inset-0 flex flex-col md:flex-row rounded-[32px] md:rounded-[48px] overflow-hidden bg-white/[0.03] border border-white/10 shadow-2xl">
                <div className="w-full md:w-1/2 h-48 md:h-full relative bg-[#0f172a] overflow-hidden shrink-0">
                  {featuredPrograms[index].isVideo ? (
                    <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                      <source src={featuredPrograms[index].image || featuredPrograms[index].fallbackImage} type="video/mp4" />
                    </video>
                  ) : (
                    <Image src={featuredPrograms[index].image || featuredPrograms[index].fallbackImage || "/logo/rad-logo_white_2.png"} alt={featuredPrograms[index].title} fill className="object-cover" />
                  )}
                  <div className={`absolute top-6 left-6 md:top-8 md:left-8 px-4 py-2 rounded-2xl ${featuredPrograms[index].accent} text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl`}>
                    {featuredPrograms[index].label}
                  </div>
                </div>

                <div className="w-full md:w-1/2 p-6 md:p-16 flex flex-col justify-center gap-6 md:gap-10">
                  <div className="space-y-4 md:space-y-6">
                    <div className="space-y-2 md:space-y-3">
                      <h3 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter leading-none text-white">{featuredPrograms[index].title}</h3>
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin size={14} className="md:w-4 md:h-4" />
                        <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{featuredPrograms[index].location}</span>
                      </div>
                    </div>
                    
                    <p className="text-slate-400 text-sm md:text-lg font-medium leading-relaxed italic line-clamp-3 md:line-clamp-none">{featuredPrograms[index].details}</p>

                    <div className="flex items-center gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/5 border border-white/5 w-fit">
                        <Clock size={14} className="text-rad-blue md:w-4 md:h-4" />
                        <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-white">{featuredPrograms[index].duration}</span>
                    </div>
                  </div>
                  
                  <button onClick={() => handleOpenRegister(featuredPrograms[index].formLabel)} className="flex items-center justify-center gap-4 px-6 md:px-10 py-4 md:py-5 rounded-2xl md:rounded-3xl bg-white text-[#020617] font-black uppercase italic tracking-tighter hover:bg-slate-200 transition-all text-sm group/btn shadow-xl">
                    Register Interest <ArrowRight size={16} className="md:w-[18px] md:h-[18px] group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
            
            <div className="flex md:hidden items-center justify-center gap-4 mt-6 absolute -bottom-16 left-0 right-0">
              <button onClick={prev} className="p-3 rounded-full bg-white/5 border border-white/10 active:bg-white/10 transition-all"><ChevronLeft size={18} /></button>
              <div className="flex gap-2">
                {featuredPrograms.map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/20'}`} />))}
              </div>
              <button onClick={next} className="p-3 rounded-full bg-white/5 border border-white/10 active:bg-white/10 transition-all"><ChevronRight size={18} /></button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 4. DYNAMIC DESKTOP EVENTS GALLERY */}
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

      {/* 5. MOBILE EVENTS GALLERY */}
      <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="md:hidden py-16 relative border-t border-white/5 mt-10">
        <div className="space-y-1 mb-8 px-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 leading-none mb-2">Academy Memories</h2>
          <p className="text-3xl font-black uppercase italic tracking-tight text-white">Past Events</p>
        </div>
        
        <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-8 px-6 w-full no-scrollbar">
           {pastEvents.map((item) => (
              <div key={item.id} onClick={() => item.gallery.length > 0 && setSelectedEvent(item)} className={`min-w-[85vw] shrink-0 snap-center rounded-[32px] overflow-hidden bg-white/[0.02] border border-white/5 p-4 flex flex-col active:scale-[0.98] transition-transform select-none ${item.gallery.length > 0 ? 'cursor-pointer shadow-lg' : 'opacity-50 grayscale'}`} onContextMenu={(e) => e.preventDefault()}>
                <div className="w-full h-56 bg-[#0f172a] rounded-[24px] overflow-hidden relative shadow-inner">
                  <Image src={item.thumbnail || '/logo/rad-logo_white_2.png'} alt={item.title} fill className="object-cover opacity-80" draggable={false} />
                  {item.gallery.length > 0 ? (
                    <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                      <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-white rounded-full" /><div className="w-1.5 h-1.5 bg-white/50 rounded-full" /><div className="w-1.5 h-1.5 bg-white/30 rounded-full" /></div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"><span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Awaiting Uploads</span></div>
                  )}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-4 bg-white/10 backdrop-blur-sm -rotate-2" />
                </div>
                <div className="pt-5 pb-2 px-2 text-center">
                  <p className="text-sm font-black uppercase italic tracking-widest text-white leading-tight mb-1">{item.title}</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{item.location}</p>
                </div>
              </div>
           ))}
        </div>
      </motion.section>

      {/* POPUP GALLERY MODAL */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-[#020617] border border-white/10 rounded-[32px] md:rounded-[48px] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div>
                  <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white">{selectedEvent.title}</h3>
                  <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-rad-blue">{selectedEvent.location}</p>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-black/20">
                <div className={`grid gap-4 md:gap-6 grid-cols-2 ${selectedEvent.gallery.length <= 4 ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
                  {selectedEvent.gallery.map((imgSrc: string, i: number) => (
                    <div key={i} className="w-full aspect-square rounded-[20px] md:rounded-[32px] overflow-hidden border border-white/5 relative bg-[#0f172a] shadow-lg group select-none" onContextMenu={(e) => e.preventDefault()}>
                      <Image src={imgSrc || '/logo/rad-logo_white_2.png'} alt={`Gallery image ${i + 1}`} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" draggable={false} />
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/10">
                        <div className="-rotate-[35deg] flex flex-col items-center opacity-[0.20] mix-blend-overlay">
                          <p className="text-white font-black uppercase tracking-[0.3em] text-lg md:text-2xl whitespace-nowrap">RAD Gallery</p>
                          <p className="text-white font-black uppercase tracking-[0.1em] text-[10px] md:text-sm whitespace-nowrap mt-1">{selectedEvent.title}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- REGISTRATION MODAL --- */}
      <AnimatePresence>
        {isRegisterOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[#020617] border border-white/10 rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Enrollment Hub</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rad-blue">Register your interest</p>
                </div>
                <button onClick={() => setIsRegisterOpen(false)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar bg-black/20">
                {submitSuccess ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12">
                    <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center border border-green-500/30">
                      <ShieldCheck size={40} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black uppercase italic text-white mb-2">Transmission Received</h4>
                      <p className="text-slate-400">Thank you for registering your interest! Our team will contact you shortly.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-8">
                    
                    {/* Error Message Display */}
                    {formError && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                        {formError}
                      </div>
                    )}

                    {/* HIDDEN HONEYPOT FIELD FOR SPAM BOTS */}
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="botField">Do not fill this out if you are human</label>
                      <input type="text" id="botField" name="botField" value={formData.botField} onChange={e => setFormData({...formData, botField: e.target.value})} tabIndex={-1} autoComplete="off" />
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Users size={16} className="text-rad-blue" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-300">Guardian Details</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Parent / Guardian Name *</label>
                          <input required type="text" value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-blue transition-colors" placeholder="Jane Doe" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact Number *</label>
                          <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-blue transition-colors" placeholder="e.g. +27 82 123 4567" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email Address *</label>
                          <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-blue transition-colors" placeholder="jane@example.com" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Student Name *</label>
                          <input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-blue transition-colors" placeholder="John Doe" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Student Age *</label>
                          <input required type="number" min="5" max="18" value={formData.studentAge} onChange={e => setFormData({...formData, studentAge: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-blue transition-colors" placeholder="e.g. 12" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Star size={16} className="text-rad-yellow" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-300">Programs of Interest *</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ALL_PROGRAM_OPTIONS.map((prog) => {
                          const isSelected = formData.selectedPrograms.includes(prog);
                          const needsModeSelection = prog === "Term Program - Smart Home Systems";
                          
                          return (
                            <div key={prog} className={`flex flex-col p-4 rounded-xl border-2 transition-all duration-300 ${isSelected ? 'bg-gradient-to-br from-rad-teal/20 to-[#0f172a] border-rad-teal shadow-lg shadow-rad-teal/20 text-white' : 'bg-[#0f172a] border-white/5 text-slate-500 hover:border-white/20'}`}>
                              <div className="flex items-start gap-3 cursor-pointer group" onClick={() => toggleProgram(prog)}>
                                <div className="mt-0.5 shrink-0 transition-transform group-active:scale-90">
                                  {isSelected ? <CheckSquare size={20} className="text-rad-teal fill-rad-teal/20" /> : <Square size={20} className="group-hover:text-slate-300" />}
                                </div>
                                <span className={`text-sm font-bold leading-snug transition-colors ${isSelected ? 'text-white' : 'group-hover:text-slate-300'}`}>{prog}</span>
                              </div>

                              {isSelected && needsModeSelection && (
                                <div className="mt-4 pl-8 flex flex-col gap-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Select Mode *</p>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="smartHomeMode" value="Online" checked={formData.smartHomeMode === "Online"} onChange={(e) => setFormData({...formData, smartHomeMode: e.target.value})} className="accent-rad-teal" />
                                    <span className="text-xs text-white">Online</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="smartHomeMode" value="In-Person" checked={formData.smartHomeMode === "In-Person"} onChange={(e) => setFormData({...formData, smartHomeMode: e.target.value})} className="accent-rad-teal" />
                                    <span className="text-xs text-white">In-Person (Menlyn, PTA)</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                      <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl bg-white text-[#020617] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                        {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Transmitting...</> : "Submit Registration"}
                      </button>
                    </div>

                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. NEW GLOBAL FOOTER */}
      <footer className="border-t border-white/5 bg-[#020617] pt-16 pb-8 px-8 md:px-12 relative overflow-hidden mt-10 md:mt-0">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-48 bg-rad-blue/5 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 md:gap-12 justify-between relative z-10">
          <div className="space-y-8 md:w-1/3">
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
            <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-white/5 text-slate-300 border border-white/10"><MapPin size={20} /></div>
                <h4 className="text-white font-black uppercase tracking-[0.2em] text-[11px]">In-Person Lessons</h4>
              </div>
              <h5 className="text-white text-lg font-black italic tracking-tighter uppercase mb-3">Menlyn, Pretoria</h5>
              <p className="text-slate-400 text-sm leading-relaxed italic mb-6">
                Join our collaborative weekend sessions to get hands-on experience with real-world robotics and hardware.
              </p>
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-[#020617] border border-white/5 shadow-inner">
                <div className="flex items-center justify-between"><span className="text-white text-[10px] font-black uppercase tracking-widest">Saturday</span><span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">10:00 - 11:00</span></div>
                <div className="h-[1px] w-full bg-white/5" />
                <div className="flex items-center justify-between"><span className="text-white text-[10px] font-black uppercase tracking-widest">Sunday</span><span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">14:00 - 15:00</span></div>
              </div>
            </div>
          </div>

          <div className="md:w-1/3">
            <div className="p-8 rounded-[32px] bg-gradient-to-b from-rad-blue/10 to-[#020617] border border-rad-blue/20 relative overflow-hidden group hover:border-rad-blue/40 transition-colors shadow-2xl h-full flex flex-col justify-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rad-blue via-rad-purple to-rad-teal" />
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-rad-blue/20 text-rad-blue border border-rad-blue/30"><Award size={20} /></div>
                <h4 className="text-white font-black uppercase tracking-[0.2em] text-[11px]">Premium Online Lessons</h4>
              </div>
              <h5 className="text-white text-lg font-black italic tracking-tighter uppercase mb-3">1-on-1 Mentorship</h5>
              <p className="text-slate-400 text-sm leading-relaxed italic mb-6">
                Avoid crowded group classes. Our premium online students receive dedicated, personalized coaching from expert instructors.
              </p>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/5 shadow-inner mt-auto">
                <Clock size={16} className="text-rad-blue" />
                <div className="space-y-0.5">
                  <p className="text-white text-[10px] font-black uppercase tracking-widest">Monday - Friday</p>
                  <p className="text-rad-blue text-[10px] font-black uppercase tracking-widest">15:00 - 18:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 pb-6">
           <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">RAD Academy // © 2026</p>
           <div className="flex gap-8 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
             {/* PENDING CREATION
             <Link href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
             <Link href="#" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
             */}
           </div>
        </div>
      </footer>
    </main>
  );
}