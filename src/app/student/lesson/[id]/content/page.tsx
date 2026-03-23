"use client";

import { use, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, PlayCircle } from "lucide-react";
import Link from "next/link";
import UplinkQuiz from "@/components/mission/UplinkQuiz";

export default function MissionPlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [view, setView] = useState<"video" | "quiz">("video");
  const [missionComplete, setMissionComplete] = useState(false);

  const steps = [
    { title: "Introduction to Logic", duration: "05:00", completed: true },
    { title: "The AND Gate Deep Dive", duration: "12:00", completed: false },
    { title: "Building an OR Gate", duration: "10:00", completed: false },
    { title: "The NOT Gate Challenge", duration: "08:00", completed: false },
  ];

  return (
    <main className="h-screen bg-[#020617] flex flex-col font-sans overflow-hidden">
      {/* 1. Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#020617]">
        <Link href={`/student/lesson/${id}`} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Exit_Mission</span>
        </Link>
        <span className="text-[10px] font-black text-[#45a79a] uppercase tracking-widest bg-[#45a79a]/10 px-3 py-1 rounded-full border border-[#45a79a]/20">
          Uplink Active
        </span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 2. Viewport (Video or Quiz) */}
        <section className="flex-1 bg-black relative flex items-center justify-center border-r border-white/5">
          <AnimatePresence mode="wait">
            {view === "video" ? (
              <motion.div 
                key="video"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-700"
              >
                <PlayCircle size={64} className="text-[#5574a9] opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest italic">Video_Stream_Active</p>
              </motion.div>
            ) : (
              <motion.div 
                key="quiz"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="w-full p-12"
              >
                <UplinkQuiz onComplete={() => setMissionComplete(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 3. Mission Log Sidebar */}
        <aside className="w-96 bg-[#020617] border-l border-white/5 flex flex-col overflow-y-auto">
          <div className="p-8 space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Logic Gates</h2>
              <p className="text-[#45a79a] text-[10px] font-bold uppercase tracking-widest">Mission ID: {id}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Mission_Checkpoints</h3>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border ${step.completed ? "bg-[#45a79a]/5 border-[#45a79a]/20 text-[#45a79a]" : "bg-white/5 border-white/5 text-slate-400"}`}>
                    {step.completed ? <CheckCircle2 size={18} /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                    <span className="text-xs font-bold">{step.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => setView("quiz")}
              className={`w-full h-16 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${
                view === "quiz" ? "border-[#45a79a] bg-[#45a79a]/10 text-[#45a79a]" : "border-[#5574a9] bg-[#5574a9]/10 text-white hover:bg-[#5574a9]/20"
              }`}
            >
              {view === "quiz" ? "Verification In Progress" : "Initiate Final Verification"}
            </button>
          </div>
        </aside>
      </div>

      {/* 4. Footer */}
      <footer className="h-20 border-t border-white/5 bg-[#020617] flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
           <div className={`w-2 h-2 rounded-full ${missionComplete ? 'bg-[#88be56]' : 'bg-[#d7a94a] animate-pulse'}`} />
           <span className="text-[10px] font-black uppercase text-white tracking-widest">
             {missionComplete ? "Mission Accomplished" : "Uplink Processing..."}
           </span>
        </div>
        
        {missionComplete && (
          <Link 
            href="/student/mission-complete"
            className="bg-[#88be56] text-white px-8 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center hover:scale-105 transition-transform"
          >
            Claim Reward <ChevronRight size={14} className="ml-2" />
          </Link>
        )}
      </footer>
    </main>
  );
}