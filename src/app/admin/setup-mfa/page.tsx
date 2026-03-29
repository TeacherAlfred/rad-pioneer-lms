"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { QrCode, ShieldCheck, KeyRound, Loader2, CheckCircle2 } from "lucide-react";

export default function SetupMFA() {
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const beginEnrollment = async () => {
      try {
        // 1. Check if they already have a verified authenticator app
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const existingTotp = factors?.totp[0];

        if (existingTotp?.status === 'verified') {
          router.push('/admin/courses');
          return;
        }

        // 2. If not, ask Supabase to generate a new QR code and Secret
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
        });

        if (enrollError) throw enrollError;

        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (err: any) {
        setError(err.message || "Failed to initialize security setup.");
      }
    };

    beginEnrollment();
  }, [router]);

  async function handleFinalizeSetup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Create a challenge for the new factor
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ 
        factorId 
      });
      if (challengeError) throw challengeError;

      // 2. Verify the code the user just scanned and typed in
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // 3. Success! Show the green checkmark then redirect
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/admin/courses");
      }, 1500);
      
    } catch (err: any) {
      setError(err.message || "Invalid code. Make sure you are using the newest code from your app.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
          <CheckCircle2 size={80} className="text-green-400 mb-6 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
          <h2 className="text-3xl font-black uppercase tracking-widest text-white">Secured</h2>
          <p className="text-slate-400 mt-2">Mission Control is now locked. Rerouting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f172a]/80 border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-rad-blue/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-rad-blue/10 border border-rad-blue/20 rounded-2xl flex items-center justify-center mb-4 text-rad-blue">
            <QrCode size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
            Initialize Security
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Scan this QR code with your Authenticator app (Google, Microsoft, Authy) to link your device.
          </p>
        </div>

        {qrCode ? (
          <form onSubmit={handleFinalizeSetup} className="space-y-6 relative z-10">
            
            {/* White background is MANDATORY for phone cameras to read the SVG */}
            <div className="flex justify-center mb-6">
              <div 
                className="bg-white p-4 rounded-2xl shadow-inner"
                dangerouslySetInnerHTML={{ __html: qrCode }} 
              />
            </div>

            <div className="text-center mb-6">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Manual Entry Secret</p>
              <code className="text-rad-blue bg-rad-blue/10 px-3 py-1 rounded text-sm font-mono tracking-wider select-all">
                {secret}
              </code>
            </div>

            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000" 
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
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
              disabled={verifyCode.length !== 6 || isLoading}
              className="w-full flex items-center justify-center gap-2 bg-rad-blue text-[#020617] py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-rad-blue/90 transition-colors shadow-lg shadow-rad-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Finalizing...</>
              ) : (
                <><ShieldCheck size={18} /> Lock In Device</>
              )}
            </button>
          </form>
        ) : (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="text-rad-blue animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}