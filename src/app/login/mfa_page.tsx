"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, User, 
  ChevronRight, ArrowLeft, 
  Zap, Loader2, Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type LoginMode = "initial" | "student-standard" | "student-combo" | "staff" | "parent";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("initial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [identifier, setIdentifier] = useState(""); 
  const [secret, setSecret] = useState(""); 
  const [combo, setCombo] = useState({ emoji: "", color: "", number: "" });

  const emojis = ["🚀", "🤖", "🎮", "👾", "🎨", "⚡"];
  const colors = ["bg-rad-blue", "bg-rad-purple", "bg-rad-teal", "bg-rad-yellow", "bg-rad-green", "bg-rad-red"];

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
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: typedName,
          password: typedPin,
        });

        if (authError) throw authError;

        // NEW: Fetch the profile to securely route based on their actual database role
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
          // Send true admins to the main command center / courses
          window.location.href = "/admin/dashboard"; 
        } else if (userProfile.role === 'educator') {
          // Send teachers directly to their new instructional portal
          router.push("/teacher/dashboard");
        } else if (userProfile.role === 'guardian') {
          // Send parents to their portal
          router.push("/parent/dashboard");
        } else {
          // Fallback safety
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
        
        // BUG FIX: Check temp_entry_pin (where Onboarding saves it) OR pin_hash
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

          // Attempt to log them into Supabase Auth with shadow email
          // We don't check for an error here in case the shadow auth account hasn't been generated yet
          const shadowEmail = `${typedName.toLowerCase()}@pioneer.bot`;
          await supabase.auth.signInWithPassword({
            email: shadowEmail,
            password: typedPin,
          });

          // Set the critical local session variable
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

  const handleComboLogin = async () => {
    if (!combo.emoji || !combo.color || !combo.number) {
      setError("Pick all 3 pictures!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: profiles, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .filter('picture_sequence->>emoji', 'eq', combo.emoji)
        .filter('picture_sequence->>color', 'eq', combo.color)
        .filter('picture_sequence->>number', 'eq', combo.number);

      if (dbError) throw dbError;

      if (profiles && profiles.length > 0) {
        const dbUser = profiles[0];
        const todayUTC = new Date().toISOString().split('T')[0];
        let newStreak = dbUser.current_streak || 0;
        if (!dbUser.last_active_date) {
            newStreak = 1;
        } else {
            const diffDays = Math.floor((new Date(todayUTC).getTime() - new Date(dbUser.last_active_date).getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) newStreak += 1;
            else if (diffDays > 1) newStreak = 1;
        }

        if (todayUTC !== dbUser.last_active_date) {
            await supabase.from('profiles').update({ current_streak: newStreak, last_active_date: todayUTC }).eq('id', dbUser.id);
        }

        const shadowEmail = `${dbUser.student_identifier.toLowerCase()}@pioneer.bot`;
        const authPassword = dbUser.temp_entry_pin || dbUser.pin_hash; // Safety check
        await supabase.auth.signInWithPassword({ email: shadowEmail, password: String(authPassword) });

        localStorage.setItem("pioneer_session", JSON.stringify(dbUser));
        router.push("/student/dashboard");
      } else {
        setError("That's not the right combo!");
      }
    } catch (err: any) {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 relative">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rad-blue/10 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-12 relative">
             <Image 
                src="/logo/rad-logo_white_2.png" 
                alt="RAD Academy" 
                fill 
                priority
                unoptimized 
                className="object-contain" 
              />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {mode === "initial" && (
            <motion.div key="initial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-center mb-8">Welcome!</h1>
              
              {/* STUDENT NAME LOGIN - HIGH EMPHASIS */}
              <LoginOption 
                title="Pioneer Login" 
                desc="Type your username & code" 
                icon={<User size={24} />} 
                onClick={() => setMode("student-standard")} 
                accent="blue"
              />
              
              {/* COMBO LOGIN - DISABLED */}
              <LoginOption 
                title="Use my Picture Combo" 
                desc="Emoji + Color + Number" 
                icon={<Zap size={24} />} 
                onClick={() => setMode("student-combo")} 
                disabled={true} 
                accent="yellow"
              />
              
              <div className="py-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Adults</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* TEACHER PORTAL - HIGH EMPHASIS */}
                <LoginOption 
                  title="Teacher Portal" 
                  small 
                  icon={<ShieldCheck size={18} />} 
                  onClick={() => setMode("staff")} 
                  accent="purple"
                />
                
                {/* PARENT PORTAL - NOW ENABLED */}
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

          {mode === "student-combo" && (
            <motion.div key="combo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <button onClick={() => setMode("initial")} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black uppercase text-center italic tracking-tighter">Your <span className="text-rad-yellow">Combo</span></h2>
              <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-8 shadow-2xl">
                <div className="flex justify-center gap-4">
                  <BigSlot value={combo.emoji} label="Emoji" />
                  <BigSlot value={combo.color} label="Color" isColor />
                  <BigSlot value={combo.number} label="Number" />
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {emojis.map(e => <button key={e} onClick={() => setCombo({...combo, emoji: e})} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all ${combo.emoji === e ? 'bg-white/20 ring-2 ring-white/40' : 'bg-white/5 hover:bg-white/10'}`}>{e}</button>)}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {colors.map(c => <button key={c} onClick={() => setCombo({...combo, color: c})} className={`w-11 h-11 rounded-xl ${c} border transition-all ${combo.color === c ? 'border-white border-2 scale-110' : 'border-white/10 hover:bg-white/5'}`} />)}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4,5,6,7,8,9,0].map(n => <button key={n} onClick={() => setCombo({...combo, number: n.toString()})} className={`h-11 rounded-xl font-black transition-all ${combo.number === n.toString() ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{n}</button>)}
                </div>
              </div>
              {error && <p className="text-rad-red text-sm font-bold text-center">{error}</p>}
              <button onClick={handleComboLogin} className="w-full h-20 rounded-3xl bg-rad-yellow text-black font-black uppercase italic text-xl shadow-lg hover:scale-105 transition-all">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "Let's Go!"}
              </button>
            </motion.div>
          )}

          {(mode === "student-standard" || mode === "staff" || mode === "parent") && (
            <form key="form" onSubmit={handleStandardLogin} className="space-y-8">
              <button type="button" onClick={() => setMode("initial")} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-center">{mode === "staff" ? "Teacher Login" : mode === "parent" ? "Parent Login" : "Student Login"}</h2>
              <div className="space-y-4">
                <input required type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full h-16 rounded-2xl bg-white/5 border border-white/10 px-6 font-bold text-lg focus:border-rad-blue outline-none transition-all" placeholder={mode === "student-standard" ? "Profile Username" : "Email"} />
                <input required type={mode === "student-standard" ? "number" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full h-16 rounded-2xl bg-white/5 border border-white/10 px-6 font-bold text-lg focus:border-rad-blue outline-none transition-all" placeholder={mode === "student-standard" ? "4-Digit PIN" : "Password"} />
              </div>
              {error && (
                <div className="p-4 rounded-xl bg-rad-red/10 border border-rad-red/20">
                   <p className="text-rad-red text-sm font-bold text-center">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading} className={`w-full h-20 rounded-3xl font-black uppercase italic text-xl shadow-lg hover:scale-105 transition-all ${mode === "staff" ? 'bg-rad-purple' : mode === "parent" ? 'bg-rad-green' : 'bg-rad-blue'}`}>
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "Sign In"}
              </button>
            </form>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function LoginOption({ title, desc, icon, onClick, small = false, disabled = false, accent = "default" }: any) {
  
  // High Emphasis Container Styles for Active Buttons
  const containerStyles: Record<string, string> = {
    disabled: "bg-white/5 border border-white/5 opacity-40 cursor-not-allowed grayscale",
    blue: "bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 group hover:-translate-y-1",
    purple: "bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 group hover:-translate-y-1",
    green: "bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 hover:border-green-500/50 hover:shadow-2xl hover:shadow-green-500/20 group hover:-translate-y-1",
    yellow: "bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 hover:border-yellow-500/50 hover:shadow-2xl hover:shadow-yellow-500/20 group hover:-translate-y-1",
    default: "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 group hover:-translate-y-1"
  };

  // Colored Icon Backgrounds
  const iconBgStyles: Record<string, string> = {
    disabled: "bg-white/5",
    blue: "bg-blue-500/20 text-blue-400 shadow-inner shadow-blue-500/50",
    purple: "bg-purple-500/20 text-purple-400 shadow-inner shadow-purple-500/50",
    green: "bg-green-500/20 text-green-400 shadow-inner shadow-green-500/50",
    yellow: "bg-yellow-500/20 text-yellow-400 shadow-inner shadow-yellow-500/50",
    default: "bg-white/10"
  };

  const activeContainerClass = disabled ? containerStyles.disabled : (containerStyles[accent] || containerStyles.default);
  const activeIconBgClass = disabled ? iconBgStyles.disabled : (iconBgStyles[accent] || iconBgStyles.default);

  return (
    <button 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      type="button"
      className={`w-full ${small ? 'p-4' : 'p-6'} rounded-[32px] flex items-center justify-between text-left transition-all duration-300 ${activeContainerClass}`}
    >
      <div className="flex items-center gap-4">
        <div className={`${small ? 'w-10 h-10' : 'w-14 h-14'} rounded-2xl flex items-center justify-center transition-transform duration-300 ${!disabled && 'group-hover:scale-110 group-hover:rotate-3'} ${activeIconBgClass}`}>
          {icon}
        </div>
        <div>
          <h3 className={`font-black uppercase italic ${small ? 'text-sm' : 'text-xl'} ${disabled ? 'text-slate-400' : 'text-white'} leading-none mb-1`}>{title}</h3>
          {!small && <p className={`text-xs font-bold ${disabled ? 'text-slate-600' : 'text-slate-400'}`}>{desc}</p>}
        </div>
      </div>
      {!small && !disabled && <ChevronRight size={20} className="text-slate-400 group-hover:text-white transition-all duration-300 group-hover:translate-x-1" />}
      
      {/* COMING SOON BADGES */}
      {!small && disabled && (
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">
          Coming Soon
        </span>
      )}
      {small && disabled && (
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded-md border border-white/5 ml-2">
          Soon
        </span>
      )}
    </button>
  );
}

function BigSlot({ value, label, isColor }: any) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl transition-all ${value ? 'border-white/30 bg-white/10' : 'border-dashed border-white/10 bg-transparent'}`}>
        {isColor ? <div className={`w-10 h-10 rounded-lg ${value || 'bg-transparent'}`} /> : value}
      </div>
      <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{label}</span>
    </div>
  );
}