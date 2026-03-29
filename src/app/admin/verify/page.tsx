"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ShieldAlert, KeyRound, Loader2 } from "lucide-react";

export default function VerifyMFA() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Quick check: if they are already verified, kick them straight to the builder
    const checkStatus = async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.currentLevel === 'aal2') {
        router.push('/admin/courses');
      }
    };
    checkStatus();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Get the user's MFA factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factors?.totp[0];
      if (!totpFactor) {
        throw new Error("No Authenticator app found for this account.");
      }

      // 2. Create a verification challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ 
        factorId: totpFactor.id 
      });
      if (challengeError) throw challengeError;

      // 3. Verify the 6-digit code the user typed in
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: code,
      });

      if (verifyError) throw verifyError;

      // 4. Success! Redirect to the curriculum builder
      router.push("/admin/courses");
      
    } catch (err: any) {
      setError(err.message || "Invalid authentication code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f172a]/80 border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Background Glow Effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-rad-blue/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-rad-blue/10 border border-rad-blue/20 rounded-2xl flex items-center justify-center mb-4 text-rad-blue">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
            Security Checkpoint
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Open your authenticator app and enter the 6-digit code to access Mission Control.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6 relative z-10">
          <div className="relative">
            <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000" 
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} // Only allow numbers
              className="w-full bg-[#020617] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-2xl font-mono tracking-[0.5em] text-center text-white focus:outline-none focus:border-rad-blue transition-colors placeholder:text-slate-700 placeholder:tracking-normal"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={code.length !== 6 || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-rad-blue text-[#020617] py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-rad-blue/90 transition-colors shadow-lg shadow-rad-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> Verifying...</>
            ) : (
              "Verify Identity"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}