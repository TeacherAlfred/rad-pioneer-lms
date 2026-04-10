"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, Loader2, CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // NEW: Track if the secure session is active
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const checkRecoverySession = async () => {
      // 1. Check if Supabase successfully established a session from the URL token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setHasSession(true);
      } else {
        // If no session is found, give the client a moment to parse the URL hash
        setTimeout(async () => {
          const { data: { session: delayedSession } } = await supabase.auth.getSession();
          setHasSession(!!delayedSession);
        }, 1000);
      }
    };

    checkRecoverySession();

    // Listen for the specific 'PASSWORD_RECOVERY' event just in case
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      
      setSuccess(true);
      
      // Send them to the dashboard after 2 seconds
      setTimeout(() => {
        router.push("/teacher/dashboard"); 
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 selection:bg-purple-500/30">
      <div className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Lock size={28} />
          </div>
        </div>

        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Secure Protocol</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Establish New Credentials</p>
        </div>

        {/* LOADING STATE FOR SESSION CHECK */}
        {hasSession === null ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="animate-spin text-purple-500" size={32} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verifying Security Token...</p>
          </div>
        ) : hasSession === false ? (
          /* NO SESSION FOUND WARNING */
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-center space-y-4">
            <AlertTriangle size={32} className="text-rose-400 mx-auto" />
            <div>
              <p className="font-bold text-white">Invalid or Expired Link</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                We could not establish a secure recovery session. Please request a new password reset link and ensure you click it directly from your email.
              </p>
            </div>
          </div>
        ) : success ? (
          /* SUCCESS STATE */
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
            <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
            <div>
              <p className="font-bold text-white">Password Updated Successfully</p>
              <p className="text-xs text-slate-400 mt-1">Routing to command center...</p>
            </div>
          </div>
        ) : (
          /* THE ACTUAL FORM */
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">New Password</label>
              <input 
                type="password" 
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password..."
                className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold p-4 rounded-xl text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || password.length < 6}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-purple-900/20"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><ShieldCheck size={16}/> Lock Credentials <ArrowRight size={14}/></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}