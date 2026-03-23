"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  User, 
  Users, 
  Mail, 
  MapPin, 
  Phone, 
  PlusCircle,
  ChevronDown
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function RequestAccessPage() {
  const [step, setStep] = useState(1);
  const [multiChild, setMultiChild] = useState(false);

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-rad-teal/30 overflow-hidden flex flex-col">
      
      {/* SPAM PREVENTION: Honeypot (Invisible to humans) */}
      <div className="hidden" aria-hidden="true">
        <input type="text" name="b_username" tabIndex={-1} autoComplete="off" />
      </div>

      {/* 1. HEADER NAVIGATION */}
      <nav className="p-8 max-w-7xl mx-auto w-full flex justify-between items-center relative z-20">
        <Link href="/" className="flex items-center gap-4 group">
           <div className="w-12 h-8 border border-white/10 rounded-lg flex items-center justify-center bg-white/5 p-1 transition-transform group-hover:scale-105">
             <Image 
                src="/logo/rad-logo_white_2.png" 
                alt="RAD Academy Logo" 
                width={120} 
                height={40} 
                unoptimized 
                style={{ width: '100%', height: 'auto' }} 
              />
           </div>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors tracking-[0.2em]">Return Home</span>
        </Link>
        <div className="flex items-center gap-4">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Step {step} of 3</span>
        </div>
      </nav>

      {/* 2. THE APPLICATION FORM */}
      <section className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rad-blue/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-xl relative z-10">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: CHILD INFO */}
            {step === 1 && (
              <motion.div 
                key="step1" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                  <div className="space-y-1">
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">
                      Child <span className="text-rad-blue">Info</span>
                    </h1>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Student Details</p>
                  </div>
                  
                  {/* MULTI-CHILD TOGGLE */}
                  <button 
                    type="button"
                    onClick={() => setMultiChild(!multiChild)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${multiChild ? 'bg-rad-blue text-white border-rad-blue' : 'bg-white/5 border-white/10 text-slate-500'}`}
                  >
                    <PlusCircle size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Add more than one child</span>
                  </button>
                </div>

                <div className="space-y-6 bg-white/[0.02] p-8 rounded-[40px] border border-white/5 backdrop-blur-sm">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">
                      {multiChild ? "First Child's Name" : "Child's First Name"}
                    </label>
                    <div className="relative">
                      <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        type="text" 
                        className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 pl-16 pr-6 font-bold focus:border-rad-blue focus:outline-none transition-all placeholder:text-slate-800" 
                        placeholder="Enter name..." 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Age</label>
                      <input 
                        type="number" 
                        className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 px-6 font-bold focus:border-rad-blue focus:outline-none transition-all placeholder:text-slate-800" 
                        placeholder="Years" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Interest</label>
                      <div className="relative">
                        <select className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 px-6 font-bold focus:border-rad-blue focus:outline-none transition-all appearance-none text-slate-400">
                          <option>Game Creator</option>
                          <option>Robotics</option>
                          <option>Minecraft</option>
                          <option>Web Design</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {multiChild && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 rounded-2xl bg-rad-blue/10 border border-rad-blue/20"
                    >
                      <p className="text-[10px] text-slate-300 font-bold uppercase leading-relaxed tracking-tight">
                        Note: You only need to provide the first child&apos;s details here. We will collect the rest of the family information during our follow-up call.
                      </p>
                    </motion.div>
                  )}
                </div>

                <button 
                  onClick={() => setStep(2)} 
                  className="w-full h-20 rounded-[32px] bg-rad-blue text-white font-black uppercase italic tracking-tighter flex items-center justify-center gap-4 hover:bg-rad-teal transition-all shadow-xl text-lg group"
                >
                  Continue to Parent Info <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {/* STEP 2: PARENT INFO */}
            {step === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-1 border-b border-white/5 pb-6">
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">
                    Parent <span className="text-rad-purple">Info</span>
                  </h1>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Contact Details</p>
                </div>

                <div className="grid grid-cols-1 gap-6 bg-white/[0.02] p-8 rounded-[40px] border border-white/5 shadow-2xl">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Parent / Guardian Full Name</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        type="text" 
                        className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 pl-16 pr-6 font-bold focus:border-rad-purple focus:outline-none transition-all placeholder:text-slate-800" 
                        placeholder="Full Name" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input 
                          type="email" 
                          className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 pl-16 pr-6 font-bold focus:border-rad-purple focus:outline-none transition-all placeholder:text-slate-800" 
                          placeholder="email@address.com" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Contact Number</label>
                      <div className="relative">
                        <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input 
                          type="tel" 
                          className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 pl-16 pr-6 font-bold focus:border-rad-purple focus:outline-none transition-all placeholder:text-slate-800" 
                          placeholder="+27..." 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">City / Area</label>
                    <div className="relative">
                      <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        type="text" 
                        className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 pl-16 pr-6 font-bold focus:border-rad-purple focus:outline-none transition-all placeholder:text-slate-800" 
                        placeholder="e.g. Sandton, JHB" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                   <button 
                     onClick={() => setStep(1)} 
                     className="w-20 h-20 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all group"
                   >
                      <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                   </button>
                   <button 
                     onClick={() => setStep(3)} 
                     className="flex-1 h-20 rounded-[32px] bg-rad-purple text-white font-black uppercase italic tracking-tighter flex items-center justify-center gap-4 hover:bg-rad-blue transition-all shadow-xl text-lg"
                   >
                    Submit Request <ArrowRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 3 && (
              <motion.div 
                key="step3" 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-10 py-12"
              >
                <div className="w-32 h-32 rounded-[40px] bg-rad-green/10 border-2 border-rad-green/30 flex items-center justify-center mx-auto shadow-2xl relative">
                   <ShieldCheck size={56} className="text-rad-green" />
                </div>
                
                <div className="space-y-4">
                  <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
                    Request <br /><span className="text-rad-green">Received</span>
                  </h1>
                  <p className="text-slate-400 text-sm font-medium italic max-w-sm mx-auto leading-relaxed">
                    Thank you for your interest in RAD Academy. Our team will contact you within 24 hours to discuss enrollment for your {multiChild ? "children" : "child"}.
                  </p>
                </div>

                <Link 
                  href="/" 
                  className="inline-flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 hover:text-white transition-all group"
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
                  Back to Homepage
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="p-8 text-center border-t border-white/5 bg-black/20">
         <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">RAD Academy Admissions 2026</p>
      </footer>
    </main>
  );
}