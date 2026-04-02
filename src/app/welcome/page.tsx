"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Rocket, Mail, Star, Users, Zap, CheckCircle2,
  ChevronRight, Award, ShieldCheck, Gamepad2,
  RotateCcw, UserPlus
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

// --- FAQ DATA ---
const LAUNCH_FAQS = [
  {
    icon: Mail,
    color: "text-rad-blue",
    title: "How do I log in?",
    details: "If you are currently enrolled for lessons, you do not need to register. Check your email for a secure link from `onboarding@updates.radacademy.co.za`. Click the button 'Complete Onboarding' and follow the 3 step process to finalise creation of your profile and your child's profile. If you cannot find the email, please check your spam folder or contact us via WhatsApp."
  },
  {
    icon: Gamepad2,
    color: "text-rad-purple",
    title: "Why do we need a username?",
    details: "During the onboarding process, you will be asked to create a username (e.g., 'CodeNinja' or 'Alex2026') and a 4-digit PIN (e.g., '4234') The Username is their display name on the platform for leaderboards and projects."
  },
  {
    icon: Zap,
    color: "text-rad-teal",
    title: "What is new on the platform?",
    details: "We have built a completely new dashboard. Students now have a clear learning path, progress tracking, an archive of past projects, and a number of other features in the pipeline."
  },
  {
    icon: ShieldCheck,
    color: "text-rad-yellow",
    title: "Is the platform secure?",
    details: "Yes. We use industry-standard security and authentication. The learning environment is private, age-appropriate, and restricted only to enrolled RAD Academy students. Additionally, all Admins and Educators have to use MFA for system access."
  }
];

export default function LaunchPortal() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [pathway, setPathway] = useState<"current" | "past" | "new" | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check URL parameters on load for deep-linking
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('p');
      if (p === 'current' || p === 'past' || p === 'new') {
        setPathway(p);
      }
      setIsInitializing(false);
    }
  }, []);

  // --- DYNAMIC CONTENT: PLAIN ENGLISH ---
  const content = {
    current: {
      badge: "System Update: RAD LMS v2.0 is Live",
      title: "Welcome to the New Platform.",
      subtitle: "We've built a brand new digital learning environment for our students. Your account is already active and ready to go.",
      objectiveTitle: "Choose a Student Username",
      objectiveText: "When your child logs in for the first time they will use their username and PIN that you set during the onboarding process.",
      objectiveNote: "Note: You can easily change this username later in the profile settings.",
    },
    past: {
      badge: "Welcome Back",
      title: "Continue Your Learning.",
      subtitle: "Welcome back! You can access our lesson material on a 1-month trial basis. Before the month is over, you can decide if you want to continue your LMS access or take things higher and register for online or in-person lessons.",
      objectiveTitle: "Start Your 1-Month Trial",
      objectiveText: "Click below to request LMS Access. We will set up your dashboard so your child can get started with our dynamic and self-paced learning material.",
      objectiveNote: "Your 1-month trial starts as soon as your account is activated.",
    },
    new: {
      badge: "Welcome to RAD Academy",
      title: "Start Your Tech Journey.",
      subtitle: "Our platform gives your child access to interactive coding and robotics lessons, project tracking, and mentorship. You will get a 7-day trial to explore everything.",
      objectiveTitle: "Start Your 7-Day Trial",
      objectiveText: "Click below to request Demo LMS Access. After your 7-day trial, you can decide what to do next—continue with platform access or enroll in our premium online or in-person programs.",
      objectiveNote: "No prior coding experience is required. We teach everything from scratch.",
    }
  };

  const activeContent = content[pathway || "current"]; // fallback to current for safety

  if (isInitializing) return <div className="min-h-screen bg-[#020617]" />;

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-rad-blue/30 overflow-x-hidden relative flex flex-col">
      
      {/* 1. THE GATEWAY MODAL (Plain English Options) */}
      <AnimatePresence>
        {!pathway && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020617]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-full max-h-[500px] bg-gradient-to-r from-rad-blue/20 via-rad-purple/20 to-rad-teal/20 blur-[100px] pointer-events-none rounded-full" />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
              className="relative w-full max-w-4xl bg-white/[0.02] border border-white/10 rounded-[48px] p-8 md:p-16 shadow-2xl backdrop-blur-xl z-10"
            >
              <div className="text-center mb-12">
                <div className="w-16 h-16 bg-[#0f172a] rounded-2xl flex items-center justify-center border border-white/10 mx-auto mb-6 shadow-inner">
                  <ShieldCheck size={28} className="text-rad-blue" />
                </div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">Welcome</h2>
                <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Select Your Status</h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Option 1: Current */}
                <button onClick={() => setPathway("current")} className="group p-8 rounded-[32px] bg-gradient-to-b from-[#0f172a] to-[#020617] border border-white/10 hover:border-rad-blue shadow-xl transition-all hover:-translate-y-2 text-left">
                  <div className="w-12 h-12 rounded-xl bg-rad-blue/10 flex items-center justify-center text-rad-blue mb-6 group-hover:scale-110 transition-transform">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-xl font-black uppercase italic text-white mb-2">Currently Enrolled</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">I am currently registered and actively taking classes at RAD Academy.</p>
                </button>

                {/* Option 2: Past */}
                <button onClick={() => setPathway("past")} className="group p-8 rounded-[32px] bg-gradient-to-b from-[#0f172a] to-[#020617] border border-white/10 hover:border-rad-purple shadow-xl transition-all hover:-translate-y-2 text-left">
                  <div className="w-12 h-12 rounded-xl bg-rad-purple/10 flex items-center justify-center text-rad-purple mb-6 group-hover:scale-110 transition-transform">
                    <RotateCcw size={24} />
                  </div>
                  <h3 className="text-xl font-black uppercase italic text-white mb-2">Returning Parent/Student</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">I have registered in the past, and I want to see what is new.</p>
                </button>

                {/* Option 3: New */}
                <button onClick={() => setPathway("new")} className="group p-8 rounded-[32px] bg-gradient-to-b from-[#0f172a] to-[#020617] border border-white/10 hover:border-rad-teal shadow-xl transition-all hover:-translate-y-2 text-left">
                  <div className="w-12 h-12 rounded-xl bg-rad-teal/10 flex items-center justify-center text-rad-teal mb-6 group-hover:scale-110 transition-transform">
                    <UserPlus size={24} />
                  </div>
                  <h3 className="text-xl font-black uppercase italic text-white mb-2">New to RAD</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">I am brand new to RAD Academy and want to learn more.</p>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. NAVIGATION */}
      <nav className="relative z-50 p-6 md:p-10 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="relative w-[100px] md:w-[120px]">
          <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy Logo" width={120} height={40} priority unoptimized style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <Link href="/" className="px-5 py-2 rounded-full border border-white/10 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors shadow-lg">
          Main Site
        </Link>
      </nav>

      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 py-12">
        <AnimatePresence mode="wait">
          
          {/* STATE 2: CURRENTLY ENROLLED */}
          {pathway === "current" && (
            <motion.div 
              key="current"
              initial={{ opacity: 0, y: 20, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full max-w-4xl"
            >
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 mb-6">
                  <CheckCircle2 size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeContent.badge}</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg mb-4" dangerouslySetInnerHTML={{ __html: activeContent.title }} />
                <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto italic">
                  {activeContent.subtitle}
                </p>
              </div>

              <div className="bg-[#0f172a] border border-white/10 rounded-[32px] p-8 md:p-12 text-center relative shadow-xl max-w-2xl mx-auto">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-rad-teal mb-2">Next Step</h3>
                <h4 className="text-2xl font-black uppercase italic text-white mb-3">{activeContent.objectiveTitle}</h4>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  {activeContent.objectiveText}
                </p>
                <div className="inline-flex items-center gap-3 p-3 px-4 rounded-xl border border-rad-yellow/20 bg-rad-yellow/5 text-rad-yellow text-xs font-bold italic">
                   {activeContent.objectiveNote}
                </div>
              </div>

              <div className="mt-12 text-center">
                <button onClick={() => setPathway(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                  &larr; Change Status
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 3: PAST & NEW (Redirecting to Landing Page) */}
          {(pathway === "past" || pathway === "new") && (
            <motion.div 
              key="redirect"
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="w-full max-w-2xl text-center space-y-8 bg-white/[0.02] border border-white/10 p-12 rounded-[48px] backdrop-blur-md shadow-2xl"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-rad-purple/30 bg-rad-purple/10 text-rad-purple mb-2">
                  <Star size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeContent.badge}</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white" dangerouslySetInnerHTML={{ __html: activeContent.title }} />
                <p className="text-slate-400 text-base md:text-lg leading-relaxed">
                  {activeContent.subtitle}
                </p>
              </div>
              
              <div className="bg-[#0f172a] border border-white/5 rounded-3xl p-8 mt-6">
                 <h4 className="text-xl font-black uppercase italic text-white mb-3">{activeContent.objectiveTitle}</h4>
                 <p className="text-sm text-slate-400 mb-6">{activeContent.objectiveText}</p>
                 <Link href="/?register=demo" className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-white text-[#020617] font-black uppercase italic tracking-widest text-sm hover:bg-slate-200 transition-all shadow-xl hover:-translate-y-1 w-full sm:w-auto">
                   Request LMS Access <ChevronRight size={16} />
                 </Link>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6">{activeContent.objectiveNote}</p>
              </div>

              <div className="pt-4">
                <button onClick={() => setPathway(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                  &larr; Change Status
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* 5. Dynamic FAQ / Details */}
      <section className="py-20 px-8 border-t border-white/5 bg-[#010410] relative z-10">
        <div className="max-w-5xl mx-auto w-full space-y-12">
          <div className="text-center space-y-3">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Got Questions?</h3>
             <p className="text-3xl font-black uppercase italic tracking-tight text-white">Frequently Asked Questions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {LAUNCH_FAQS.map((faq, i) => {
              const Icon = faq.icon;
              const isActive = activeFaq === i;
              return (
                <motion.div 
                    key={i} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1, duration: 0.6 }}
                    className={`bg-white/[0.02] border border-white/5 rounded-[32px] p-8 space-y-4 hover:bg-white/[0.04] transition-colors cursor-pointer ${isActive ? 'bg-white/[0.04]' : ''}`}
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner ${faq.color} bg-opacity-10`}><Icon size={20} /></div>
                      <h4 className="text-lg font-black uppercase italic tracking-widest text-white">{faq.title}</h4>
                    </div>
                    <motion.div animate={{ rotate: isActive ? 180 : 0 }} className="text-slate-600"><ChevronRight size={18} /></motion.div>
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <p className="text-slate-400 text-sm font-medium leading-relaxed italic pt-4 pl-1">{faq.details}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8 text-center relative z-10 bg-[#010410]">
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">RAD Academy // © 2026</p>
      </footer>
    </main>
  );
}