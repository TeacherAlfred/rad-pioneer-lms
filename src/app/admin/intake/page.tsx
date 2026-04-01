"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  UserPlus, Mail, Phone, User, Plus, X, 
  Save, Loader2, ShieldCheck, ArrowLeft, BookOpen, Calendar
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function ManualIntakeTerminal() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Guardian State
  const [guardian, setGuardian] = useState({
    name: "",
    email: "",
    phone: ""
  });

  // Pioneer State
  const [pioneers, setPioneers] = useState([
    { id: 1, name: "", dob: "", programs: [] as string[] }
  ]);

  const availablePrograms = [
    "IP: Home Automation Bootcamp",
    "OL: Game Creator Bootcamp",
    "IP: Term Program - Smart Home Systems",
    "OL: Term Program - Smart Home Systems"
  ];

  const handleAddPioneer = () => {
    setPioneers([...pioneers, { id: Date.now(), name: "", dob: "", programs: [] }]);
  };

  const handleRemovePioneer = (id: number) => {
    if (pioneers.length === 1) return;
    setPioneers(pioneers.filter(p => p.id !== id));
  };

  const handlePioneerChange = (id: number, field: string, value: any) => {
    setPioneers(pioneers.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const toggleProgram = (pioneerId: number, program: string) => {
    setPioneers(pioneers.map(p => {
      if (p.id === pioneerId) {
        const hasProgram = p.programs.includes(program);
        return {
          ...p,
          programs: hasProgram ? p.programs.filter(pr => pr !== program) : [...p.programs, program]
        };
      }
      return p;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Capture the exact timestamp of injection
    const injectionTime = new Date().toISOString();

    try {
      // 1. Create the Guardian Profile first (Now with timestamps)
      const { data: guardianData, error: guardianError } = await supabase
        .from('profiles')
        .insert({
          display_name: guardian.name,
          role: 'guardian',
          created_at: injectionTime, // Explicitly filling the field
          updated_at: injectionTime, // Explicitly filling the field
          metadata: {
            email: guardian.email, 
            phone: guardian.phone,
            admin_notes: "Manually entered via Admin Intake Terminal."
          }
        })
        .select()
        .single();

      if (guardianError) throw guardianError;

      // 2. Create the Pioneer Profiles (Now with timestamps)
      const pioneersToInsert = pioneers.map(p => ({
        display_name: p.name,
        role: 'student',
        date_of_birth: p.dob || null,
        linked_parent_id: guardianData.id,
        created_at: injectionTime, // Explicitly filling the field
        updated_at: injectionTime, // Explicitly filling the field
        metadata: {
          interested_programs: p.programs,
          onboarding_status: 'pending_onboarding'
        }
      }));

      const { error: pioneerError } = await supabase
        .from('profiles')
        .insert(pioneersToInsert);

      if (pioneerError) throw pioneerError;
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setGuardian({ name: "", email: "", phone: "" });
        setPioneers([{ id: Date.now(), name: "", dob: "", programs: [] }]);
      }, 3000);

    } catch (error: any) {
      console.error("Intake Error:", error);
      alert(`Failed to inject records: ${error?.message || "Unknown database error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left">
      <div className="max-w-4xl mx-auto space-y-10">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
             <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
            </Link>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Manual_<span className="text-yellow-500">Intake</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Inject directly into Profiles</p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* GUARDIAN SECTION */}
          <div className="bg-white/[0.02] border border-white/10 p-8 rounded-[40px] shadow-xl space-y-6">
            <div className="flex items-center gap-2 text-purple-400 border-b border-white/5 pb-4">
              <UserPlus size={20} />
              <h2 className="text-lg font-black uppercase tracking-widest">Guardian Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input required type="text" value={guardian.name} onChange={e => setGuardian({...guardian, name: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500 transition-all font-bold text-white" placeholder="e.g. Jane Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input required type="email" value={guardian.email} onChange={e => setGuardian({...guardian, email: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500 transition-all text-slate-300" placeholder="jane@example.com" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input required type="tel" value={guardian.phone} onChange={e => setGuardian({...guardian, phone: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500 transition-all text-slate-300" placeholder="071 234 5678" />
                </div>
              </div>
            </div>
          </div>

          {/* PIONEERS SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Pioneer Manifest</h2>
              <button type="button" onClick={handleAddPioneer} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-4 py-2 rounded-xl">
                <Plus size={14} /> Add Pioneer
              </button>
            </div>

            <AnimatePresence>
              {pioneers.map((pioneer, index) => (
                <motion.div 
                  key={pioneer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/5 border border-white/10 p-8 rounded-[32px] relative group"
                >
                  {pioneers.length > 1 && (
                    <button type="button" onClick={() => handleRemovePioneer(pioneer.id)} className="absolute top-6 right-6 p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                      <X size={16} />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Pioneer Name #{index + 1}</label>
                      <input required type="text" value={pioneer.name} onChange={e => handlePioneerChange(pioneer.id, 'name', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-all font-black italic text-lg text-white" placeholder="Pioneer Full Name" />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-1">
                         <Calendar size={12}/> Date of Birth
                      </label>
                      <input 
                        required 
                        type="date" 
                        value={pioneer.dob} 
                        onChange={e => handlePioneerChange(pioneer.id, 'dob', e.target.value)} 
                        className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-all font-bold text-slate-300" 
                      />
                    </div>
                    
                    <div className="md:col-span-4 space-y-3 pt-4 border-t border-white/5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14}/> Sector Interests</label>
                       <div className="flex flex-wrap gap-3">
                         {availablePrograms.map(prog => {
                           const isSelected = pioneer.programs.includes(prog);
                           return (
                             <button 
                               key={prog} type="button"
                               onClick={() => toggleProgram(pioneer.id, prog)}
                               className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isSelected ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-[#0f172a] border-white/10 text-slate-500 hover:border-white/30'}`}
                             >
                               {prog}
                             </button>
                           )
                         })}
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="pt-8">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full py-6 rounded-[24px] font-black uppercase italic tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl ${success ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50'}`}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : success ? <><ShieldCheck size={20}/> Profiles Injected Successfully</> : <><Save size={20}/> Inject directly to Profiles</>}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}