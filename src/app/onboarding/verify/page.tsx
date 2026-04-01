"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ShieldAlert, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function SecureGate() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ identifier: "", pin: "" });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Find the user by Email or Name
    const { data: user, error: fetchError } = await supabase
      .from('profiles') // Search profiles first
      .select('id, temp_entry_pin, auth_attempts, is_locked, role')
      .or(`display_name.ilike.${formData.identifier},student_identifier.eq.${formData.identifier}`)
      .single();

    if (!user || fetchError) {
      setLoading(false);
      return setError("Credentials not recognized.");
    }

    if (user.is_locked) {
      setLoading(false);
      return setError("Account locked due to too many attempts. Contact Admin.");
    }

    // 2. Validate PIN
    if (user.temp_entry_pin === formData.pin) {
      // SUCCESS: Clear attempts and redirect
      await supabase.from('profiles').update({ auth_attempts: 0 }).eq('id', user.id);
      
      const targetPage = user.role === 'student' ? 'pioneer' : 'guardian';
      router.push(`/onboarding/${targetPage}?id=${user.id}`);
    } else {
      // FAILURE: Increment attempts
      const newAttempts = (user.auth_attempts || 0) + 1;
      const shouldLock = newAttempts >= 3;
      
      await supabase.from('profiles')
        .update({ auth_attempts: newAttempts, is_locked: shouldLock })
        .eq('id', user.id);

      setError(shouldLock ? "Account Locked." : `Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 font-sans">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-3xl flex items-center justify-center mx-auto text-blue-400 mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-black uppercase italic">Secure Entry</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Identify yourself to access onboarding</p>
        </div>

        <form onSubmit={handleVerify} className="bg-white/[0.02] border border-white/5 p-8 rounded-[32px] space-y-6 shadow-2xl">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Email or Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
              <input 
                required type="text"
                placeholder="Enter your registered name..."
                className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none font-bold"
                value={formData.identifier}
                onChange={(e) => setFormData({...formData, identifier: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Temporary Access PIN</label>
            <input 
              required type="text" maxLength={4}
              placeholder="0000"
              className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 text-center text-2xl tracking-[1em] font-black focus:border-teal-500 outline-none"
              value={formData.pin}
              onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20 text-xs font-bold">
              <ShieldAlert size={16} /> {error}
            </div>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>Verify & Enter <ArrowRight size={18}/></>}
          </button>
        </form>
      </motion.div>
    </main>
  );
}