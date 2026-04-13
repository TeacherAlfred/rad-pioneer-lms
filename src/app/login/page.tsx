"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, User, 
  ChevronRight, ArrowLeft, 
  Loader2, Users, AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type LoginMode = "initial" | "student-standard" | "staff" | "parent";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("initial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [identifier, setIdentifier] = useState(""); 
  const [secret, setSecret] = useState(""); 

  useEffect(() => {
    setError("");
  }, [mode]);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const typedName = identifier.trim(); 
    const typedPin = secret.trim();

    try {
      if (mode === "staff" || mode === "parent") {
        // DIRECT LOGIN - MFA DISABLED FOR NOW
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: typedName,
          password: typedPin,
        });

        if (authError) throw authError;

        // Fetch the profile to securely route based on their actual database role
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('auth_user_id', authData.user?.id)
          .single();

        if (profileError || !userProfile) {
          throw new Error("Profile access denied. Please contact support.");
        }

        // SMART ROUTING ENGINE
        if (userProfile.role === 'admin') {
          window.location.href = "/admin/dashboard"; 
        } else if (userProfile.role === 'educator') {
          router.push("/teacher/dashboard");
        } else if (userProfile.role === 'guardian') {
          router.push("/parent/dashboard");
        } else {
          router.push("/");
        }
        
        return;
      }

      // --- STUDENT LOGIN LOGIC ---
      const { data: userFound, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('student_identifier', typedName);

      if (dbError) throw new Error("Connection failed.");

      if (userFound && userFound.length > 0) {
        const dbUser = userFound[0];
        
        const isPinMatch = 
          String(dbUser.temp_entry_pin).trim() === String(typedPin).trim() || 
          String(dbUser.pin_hash).trim() === String(typedPin).trim();

        if (isPinMatch) {
          const todayUTC = new Date().toISOString().split('T')[0];
          const lastActive = dbUser.last_active_date;
          let newStreak = dbUser.current_streak || 0;

          if (!lastActive) {
            newStreak = 1;
          } else {
            const lastDate = new Date(lastActive);
            const currentDate = new Date(todayUTC);
            const diffTime = currentDate.getTime() - lastDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              newStreak += 1;
            } else if (diffDays > 1) {
              newStreak = 1;
            }
          }

          if (todayUTC !== lastActive) {
            await supabase
              .from('profiles')
              .update({ current_streak: newStreak, last_active_date: todayUTC })
              .eq('id', dbUser.id);
          }

          const shadowEmail = `${typedName.toLowerCase()}@pioneer.bot`;
          await supabase.auth.signInWithPassword({
            email: shadowEmail,
            password: typedPin,
          });

          localStorage.setItem("pioneer_session", JSON.stringify(dbUser));
          router.push("/student/dashboard");
        } else {
          setError("Oops! That Secret Code didn't work.");
        }
      } else {
        setError("Oops! We don't know that username.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-[100dvh] bg-[#020617] text-white flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
      
      {/* --- BACKGROUND VIDEO --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30 grayscale mix-blend-luminosity">
          <source src="/video_clips/Learning Should Be Fun_1080p.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[#020617]/80" />
      </div>

      {/* Dynamic Ambient Glow based on mode */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[600px] md:h-[600px] blur-[100px] md:blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 z-0 ${
        mode === 'student-standard' ? 'bg-blue-600/20' : 
        mode === 'staff' ? 'bg-purple-600/20' : 
        mode === 'parent' ? 'bg-green-600/20' : 
        'bg-rad-blue/10'
      }`} />

      <div className="w-full max-w-md relative z-10 flex flex-col justify-center h-full">
        
        {/* LOGO HEADER */}
        <div className="flex flex-col items-center mb-6 md:mb-10 shrink-0">
          <button onClick={() => router.push('/')} className="w-20 h-10 md:w-24 md:h-12 relative transition-transform hover:scale-105 active:scale-95">
             <Image 
                src="/logo/rad-logo_white_2.png" 
                alt="RAD Academy" 
                fill 
                priority
                unoptimized 
                className="object-contain" 
              />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "initial" && (
            <motion.div key="initial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 md:space-y-4">
              <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-center mb-4 md:mb-8 drop-shadow-lg">Welcome!</h1>
              
              {/* STUDENT NAME LOGIN - HIGH EMPHASIS */}
              <LoginOption 
                title="Pioneer Login" 
                desc="Type your username & code" 
                icon={<User className="w-6 h-6 md:w-8 md:h-8" />} 
                onClick={() => setMode("student-standard")} 
                accent="blue"
              />
              
              <div className="py-2 md:py-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest drop-shadow-md">Adults</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* TEACHER PORTAL */}
                <LoginOption 
                  title="Teacher Portal" 
                  small 
                  icon={<ShieldCheck size={18} />} 
                  onClick={() => setMode("staff")} 
                  accent="purple"
                />
                
                {/* PARENT PORTAL */}
                <LoginOption 
                  title="Parent Portal" 
                  small 
                  icon={<Users size={18} />} 
                  onClick={() => setMode("parent")} 
                  accent="green"
                />
              </div>
            </motion.div>
          )}

          {(mode === "student-standard" || mode === "staff" || mode === "parent") && (
            <motion.form 
              key="form" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }} 
              onSubmit={handleStandardLogin} 
              className="space-y-5 md:space-y-8 bg-black/50 backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl"
            >
              <button type="button" onClick={() => { setMode("initial"); setError(""); }} className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">
                <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back
              </button>
              
              <div className="text-center space-y-1">
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg">
                  {mode === "staff" ? "Teacher Portal" : mode === "parent" ? "Parent Portal" : "Pioneer Login"}
                </h2>
                <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${mode === 'staff' ? 'text-purple-400' : mode === 'parent' ? 'text-green-400' : 'text-blue-400'}`}>
                  Authentication Required
                </p>
              </div>
              
              {error && (
                <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-red-500/20 backdrop-blur-md border border-red-500/30 flex items-start gap-2 shadow-inner">
                   <AlertCircle className="text-red-400 shrink-0 mt-0.5 w-4 h-4" />
                   <p className="text-red-100 text-xs md:text-sm font-bold">{error}</p>
                </div>
              )}

              <div className="space-y-3 md:space-y-4">
                <input 
                  required 
                  type="text" 
                  value={identifier} 
                  onChange={(e) => setIdentifier(e.target.value)} 
                  className={`w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 px-5 md:px-6 font-bold text-sm md:text-base text-white outline-none transition-all placeholder:text-slate-500 focus:bg-white/10 ${mode === 'staff' ? 'focus:border-purple-500' : mode === 'parent' ? 'focus:border-green-500' : 'focus:border-blue-500'}`} 
                  placeholder={mode === "student-standard" ? "Pioneer ID (Username)" : "Email Address"} 
                />
                <input 
                  required 
                  type={mode === "student-standard" ? "number" : "password"} 
                  value={secret} 
                  onChange={(e) => setSecret(e.target.value)} 
                  className={`w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 px-5 md:px-6 font-bold text-sm md:text-base text-white outline-none transition-all placeholder:text-slate-500 focus:bg-white/10 ${mode === "student-standard" ? "tracking-[0.2em] font-black" : ""} ${mode === 'staff' ? 'focus:border-purple-500' : mode === 'parent' ? 'focus:border-green-500' : 'focus:border-blue-500'}`} 
                  placeholder={mode === "student-standard" ? "4-Digit PIN" : "Password"} 
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading} 
                className={`w-full h-14 md:h-16 rounded-xl md:rounded-[24px] font-black uppercase italic tracking-widest text-sm md:text-base shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                  mode === "staff" ? 'bg-purple-600 text-white hover:bg-purple-500' : 
                  mode === "parent" ? 'bg-green-600 text-white hover:bg-green-500' : 
                  'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Initialize Link"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function LoginOption({ title, desc, icon, onClick, small = false, disabled = false, accent = "default" }: any) {
  
  // High Emphasis Container Styles (Cinematic Glassmorphism)
  const containerStyles: Record<string, string> = {
    disabled: "bg-white/5 border border-white/5 opacity-40 cursor-not-allowed grayscale",
    blue: "bg-black/40 backdrop-blur-md border border-blue-500/20 md:border-blue-500/30 hover:bg-black/60 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] group md:hover:-translate-y-1",
    purple: "bg-black/40 backdrop-blur-md border border-purple-500/20 md:border-purple-500/30 hover:bg-black/60 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] group md:hover:-translate-y-1",
    green: "bg-black/40 backdrop-blur-md border border-green-500/20 md:border-green-500/30 hover:bg-black/60 hover:border-green-500/50 hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] group md:hover:-translate-y-1",
    default: "bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 hover:border-white/20 group md:hover:-translate-y-1"
  };

  // Colored Icon Backgrounds
  const iconBgStyles: Record<string, string> = {
    disabled: "bg-white/5 text-slate-500",
    blue: "bg-blue-500/20 text-blue-400 shadow-inner border border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 shadow-inner border border-purple-500/30",
    green: "bg-green-500/20 text-green-400 shadow-inner border border-green-500/30",
    default: "bg-white/10 text-white border border-white/10"
  };

  const activeContainerClass = disabled ? containerStyles.disabled : (containerStyles[accent] || containerStyles.default);
  const activeIconBgClass = disabled ? iconBgStyles.disabled : (iconBgStyles[accent] || iconBgStyles.default);

  return (
    <button 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      type="button"
      className={`w-full ${small ? 'p-3 md:p-5' : 'p-4 md:p-6'} rounded-[20px] md:rounded-[32px] flex items-center justify-between text-left transition-all duration-300 ${activeContainerClass}`}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <div className={`${small ? 'w-10 h-10 md:w-12 md:h-12' : 'w-12 h-12 md:w-16 md:h-16'} rounded-xl md:rounded-2xl flex items-center justify-center transition-transform duration-300 ${!disabled && 'group-hover:scale-110 group-hover:rotate-3'} shrink-0 ${activeIconBgClass}`}>
          {icon}
        </div>
        <div className="flex flex-col justify-center">
          <h3 className={`font-black uppercase italic ${small ? 'text-xs md:text-sm' : 'text-lg md:text-2xl'} ${disabled ? 'text-slate-500' : 'text-white'} leading-tight md:leading-none mb-0.5 md:mb-1`}>{title}</h3>
          {!small && <p className={`text-[10px] md:text-xs font-bold leading-none ${disabled ? 'text-slate-600' : 'text-slate-400'}`}>{desc}</p>}
        </div>
      </div>
      {!small && !disabled && (
        <div className="hidden md:flex w-8 h-8 rounded-full bg-white/5 items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors ml-2">
           <ChevronRight size={16} className="text-slate-400 group-hover:text-white transition-all duration-300 group-hover:translate-x-0.5" />
        </div>
      )}
    </button>
  );
}