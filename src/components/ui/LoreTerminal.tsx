"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Camera, ShieldAlert, Terminal as TerminalIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";

export default function LoreTerminal({ text, mission, challenges, challengePassed }: any) {
  const [displayedLore, setDisplayedLore] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [command, setCommand] = useState("");
  const [codeStatus, setCodeStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    let i = 0;
    setDisplayedLore("");
    setIsTyping(true);
    const interval = setInterval(() => {
      if (text && i < text.length) {
        setDisplayedLore((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [text]);

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (command.toUpperCase() === mission?.secret_code?.toUpperCase()) {
      setCodeStatus('success');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.2, y: 0.8 },
        colors: ['#4ade80', '#ffffff']
      });
      
      const sessionData = localStorage.getItem("pioneer_session");
      const user = sessionData ? JSON.parse(sessionData) : null;
      if (user) {
        await supabase.from('xp_logs').insert({
          student_id: user.id,
          amount: mission.secret_xp_bonus || 150,
          reason: `OVERRIDE_KEY_ACCEPTED: ${command.toUpperCase()}`
        });
      }
    } else {
      setCodeStatus('error');
      setTimeout(() => setCodeStatus('idle'), 2000);
    }
    setCommand("");
  };

  return (
    <div className="p-8 space-y-8 font-mono text-left">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2 text-green-500">
             <Zap size={14} fill="currentColor" />
             <span className="text-[10px] font-black uppercase tracking-widest leading-none">Incoming_Uplink</span>
           </div>
        </div>

        <div className="bg-green-500/5 border border-green-500/10 rounded-[32px] p-6 relative">
           <p className="text-green-400 text-sm leading-relaxed mb-2">
             {displayedLore}
             {isTyping && <span className="inline-block w-2 h-4 bg-green-500 ml-1 animate-pulse" />}
           </p>

           {/* COMMAND LINE - Only shows when typing finishes and code exists */}
           {!isTyping && mission?.secret_code && (
             <motion.form 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }}
               onSubmit={handleCommandSubmit} 
               className="mt-6 pt-4 border-t border-green-500/20"
             >
               <div className="flex items-center gap-3">
                 <TerminalIcon size={14} className={codeStatus === 'error' ? 'text-red-500' : 'text-green-500'} />
                 <input 
                   type="text"
                   value={command}
                   onChange={(e) => setCommand(e.target.value)}
                   disabled={codeStatus === 'success'}
                   placeholder={codeStatus === 'success' ? "ACCESS_GRANTED" : "ENTER_OVERRIDE_CODE..."}
                   className={`bg-transparent border-none outline-none text-xs w-full uppercase placeholder:text-green-900 transition-colors ${
                     codeStatus === 'success' ? 'text-green-400 font-black' : 
                     codeStatus === 'error' ? 'text-red-500' : 'text-green-500'
                   }`}
                 />
               </div>
             </motion.form>
           )}
        </div>
      </div>

      {/* CHALLENGES */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <ShieldAlert size={12} /> Security_Clearance
        </h4>
        {challenges?.map((c: any) => (
          <div key={c.id} className={`p-6 rounded-[32px] border transition-all ${challengePassed ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-slate-300 font-bold mb-4">{c.question_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}