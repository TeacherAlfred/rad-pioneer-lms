"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Lock, Play, CheckCircle2, Timer, 
  CloudLightning, ShieldAlert, Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PioneerTrialHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 47, minutes: 59, seconds: 59 });

  // UPDATED: Now points to the Sibling Intruder Alarm (Mission 01)
  const ACTIVE_MISSION_ID = '90000000-0900-0000-0000-000000000001';

  useEffect(() => {
    async function initHQ() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const user = JSON.parse(sessionData);

      try {
        // Did they already beat the mission?
        const { data: archive } = await supabase
          .from('tech_archive')
          .select('id')
          .eq('student_id', user.id)
          .eq('mission_id', ACTIVE_MISSION_ID)
          .single();

        if (archive) setIsCompleted(true);

      } catch (err) {
        console.error("HQ Error:", err);
      } finally {
        setLoading(false);
      }
    }
    initHQ();
  }, [router]);

  // Mock Countdown Timer for the Parent Urgency Banner
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        if (seconds > 0) { seconds--; } 
        else if (minutes > 0) { minutes--; seconds = 59; } 
        else if (hours > 0) { hours--; minutes = 59; seconds = 59; }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Zap className="animate-pulse text-blue-500 w-12 h-12" /></div>;

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans overflow-hidden flex flex-col relative">
      
      {/* =========================================
          THE PARENT BANNER (Kept strictly for conversions)
          ========================================= */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 border-b border-blue-400/30 sticky top-0 z-50 shadow-[0_0_40px_rgba(79,70,229,0.3)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-black/20 p-2 rounded-lg flex items-center gap-2 border border-white/10">
              <Timer size={16} className="text-yellow-400 animate-pulse" />
              <span className="font-mono text-xs md:text-sm font-black text-yellow-400">
                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-blue-100">
              <span className="hidden md:inline">Pioneer Offer: </span>Free Hardware Kit with Upgrade
            </p>
          </div>
          <button 
            onClick={() => router.push('/trial/guardian')} 
            className="w-full sm:w-auto px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-yellow-400/50 hover:scale-105 active:scale-95"
          >
            Claim Offer Now
          </button>
        </div>
      </div>

      {/* =========================================
          PIONEER COMMAND CENTER (Kid UI)
          ========================================= */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative p-4 md:p-8 pb-32">
        {/* Glow Effects */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-2xl mx-auto relative z-10 space-y-8 md:space-y-12 mt-8 md:mt-12">
          
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg">
              Welcome to <span className="text-blue-500">HQ</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-lg max-w-md mx-auto font-medium">
              We need your engineering skills, Pioneer! Complete your first mission to prove you have what it takes.
            </p>
          </div>

          {/* THE HERO MISSION CARD */}
          <motion.div 
            whileHover={!isCompleted ? { scale: 1.02, y: -4 } : {}}
            className={`relative rounded-[32px] md:rounded-[40px] border-[3px] overflow-hidden transition-all duration-300 ${
              isCompleted 
                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)]'
                : 'bg-blue-950/40 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)] cursor-pointer'
            }`}
            onClick={() => !isCompleted && router.push(`/student/lesson/${ACTIVE_MISSION_ID}`)}
          >
            {/* Card Background Pattern */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
            
            <div className="p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10 relative z-10">
              
              {/* Mission Icon (Updated to ShieldAlert) */}
              <div className={`w-24 h-24 md:w-32 md:h-32 rounded-3xl shrink-0 flex items-center justify-center border-4 ${
                isCompleted ? 'bg-emerald-500/20 border-emerald-400' : 'bg-blue-500/20 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.5)]'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-emerald-400" /> : <ShieldAlert className="w-12 h-12 md:w-16 md:h-16 text-blue-400" />}
              </div>

              {/* Mission Intel (Updated to Sibling Alarm) */}
              <div className="flex-1 text-center md:text-left space-y-2">
                <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-300 mb-2">
                  Mission 01
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-white leading-tight">
                  Sibling Intruder Alarm
                </h2>
                <p className="text-sm md:text-base text-slate-300 font-medium">
                  Your room is your top-secret base, but your sibling keeps sneaking in! Let's build a smart alarm system to catch them using movement sensors and flashing lights.
                </p>

                <div className="pt-4">
                  {isCompleted ? (
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm border border-emerald-500/30">
                      <CheckCircle2 size={18} /> Mission Accomplished
                    </div>
                  ) : (
                    <button className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm md:text-base transition-all shadow-[0_10px_20px_rgba(59,130,246,0.4)] hover:shadow-[0_10px_30px_rgba(59,130,246,0.6)]">
                      <Play size={20} fill="currentColor" /> Boot Simulator
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* THE DRIP MISSION (Locked) */}
          <div className="opacity-60 saturate-50 pointer-events-none">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-16 bg-white/20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Incoming Transmission</p>
              <div className="h-px w-16 bg-white/20" />
            </div>

            <div className="p-6 md:p-8 rounded-[32px] border-2 border-white/5 bg-white/5 flex flex-col md:flex-row items-center gap-6 relative">
              <div className="absolute top-4 right-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-full">
                <Timer size={14} /> Unlocks in 24 Hrs
              </div>

              <div className="w-20 h-20 rounded-2xl bg-black/40 border-2 border-white/10 flex items-center justify-center shrink-0">
                <Lock className="w-8 h-8 text-slate-600" />
              </div>
              
              <div className="text-center md:text-left flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Mission 02</p>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-400">
                  Storm-Proof Smart Window
                </h3>
                <p className="text-xs md:text-sm text-slate-500 font-medium mt-2">
                  Top secret clearance required. Master the basics in Mission 01 to unlock this hardware protocol tomorrow.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}