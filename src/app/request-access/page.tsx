"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, ArrowRight, ShieldCheck, User, Users, 
  Mail, Phone, Brain, Cpu, Sparkles, Loader2, Key, AlertCircle
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 

type Intent = "math" | "robotics" | null;

export default function RequestAccessPage() {
  const router = useRouter();
  
  // Routing & Flow State
  const [intent, setIntent] = useState<Intent>(null);
  const [step, setStep] = useState(0); 
  
  // Loading & Error State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    parentName: "",
    email: "",
    phone: "",
    studentName: "",
    studentAge: "",
    grade: "5", 
    username: "", 
    pin: "",      
    botField: ""
  });

  // --- SUBMISSION HANDLERS (TRUE DB ARCHITECTURE) ---

  const handleMathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (formData.botField) return; 
    
    // Validation
    if (formData.pin.length !== 4 || isNaN(Number(formData.pin))) {
      setFormError("Your Secret PIN must be exactly 4 numbers.");
      return;
    }
    
    if (formData.username.length < 3) {
      setFormError("Pioneer ID must be at least 3 characters long.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Step A: Save to Registrations (Auto-Approved CRM Record)
      const { error: regError } = await supabase
        .from('registrations')
        .insert([{
          parent_name: formData.parentName || "Math Parent", 
          email: formData.email,
          student_name: formData.studentName,
          interested_programs: ["Free Math Lab"],
          status: 'approved',
          metadata: {
            funnel_stage: "Onboarding (Math Free Tier)",
            funnel_stage_updated_at: new Date().toISOString(),
            grade: formData.grade
          }
        }]);

      if (regError) throw new Error("Could not create registration record.");

      // Step B: Generate Auth & Profile (Active LMS Account)
      const cleanUsername = formData.username.trim().toLowerCase();
      const shadowEmail = `${cleanUsername.replace(/\s/g, '')}@pioneer.bot`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: shadowEmail,
        password: formData.pin,
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          throw new Error("That Pioneer ID is already taken! Please choose another one.");
        }
        throw authError;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([{
          auth_user_id: authData.user?.id,
          student_identifier: formData.username.trim(),
          temp_entry_pin: formData.pin,
          role: "student",
          xp: 0,
          sparks: 0,
          metadata: { grade: parseInt(formData.grade) } 
        }])
        .select()
        .single();

      if (profileError) throw new Error("Could not build student profile.");

      // Step C: Auto-Login & Proceed
      localStorage.setItem("pioneer_session", JSON.stringify(profileData));
      setStep(2); 

    } catch (error: any) {
      console.error("Math Account Creation failed:", error);
      setFormError(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoboticsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (formData.botField) return; 
    
    setIsSubmitting(true);
    
    try {
      // Save the High-Intent Lead to the CRM
      const { error } = await supabase
        .from('registrations')
        .insert([{
          parent_name: formData.parentName,
          email: formData.email,
          phone: formData.phone.trim(),
          student_name: formData.studentName,
          student_age: parseInt(formData.studentAge),
          interested_programs: ["Premium Robotics LMS"], 
          status: 'new', // Triggers sales follow-up
          metadata: {
            funnel_stage: "Lead (Robotics Intent)",
            funnel_stage_updated_at: new Date().toISOString()
          }
        }]);

      if (error) throw error;
      setStep(2); 

    } catch (error: any) {
      console.error("Robotics Registration failed:", error.message);
      setFormError("Database connection failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER HELPERS ---

  const renderIntentSelector = () => (
    <motion.div key="step0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full max-w-4xl mx-auto my-auto space-y-6 md:space-y-8 flex flex-col justify-center">
      
      {/* HEADER */}
      <div className="text-center space-y-1 md:space-y-4 shrink-0">
        <h1 className="text-3xl md:text-6xl font-black uppercase italic tracking-tighter leading-none drop-shadow-xl">
          Select <span className="text-rad-blue">Pathway</span>
        </h1>
        <p className="hidden md:block text-slate-300 text-base font-medium max-w-xl mx-auto drop-shadow-md">
          Are you looking to access our free mathematics tools, or are you applying for our premium robotics and coding mentorship?
        </p>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-2 gap-3 md:gap-6 w-full">
        
        {/* MATH LAB INTENT */}
        <button 
          onClick={() => { setIntent('math'); setStep(1); }}
          className="group text-left p-4 md:p-8 rounded-[24px] md:rounded-[40px] bg-black/40 backdrop-blur-md border border-emerald-500/20 md:border-2 hover:bg-black/60 hover:border-emerald-500/50 transition-all duration-300 md:hover:-translate-y-2 relative overflow-hidden flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-0 w-full shadow-2xl hover:shadow-[0_0_40px_rgba(16,185,129,0.2)]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-emerald-500/10 rounded-full blur-[40px] md:blur-[80px] group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          
          <div className="flex md:w-full items-center justify-between md:mb-8 shrink-0 relative z-10">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-500/20 text-emerald-400 rounded-xl md:rounded-2xl flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-inner">
              <Brain className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
              <Sparkles size={12} /> Free Forever
            </div>
          </div>
          
          <div className="flex-1 relative z-10 flex flex-col justify-center">
            <div className="md:hidden inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[8px] font-black uppercase tracking-widest mb-1 w-fit">
              <Sparkles size={8} /> Free
            </div>
            <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white mb-0.5 md:mb-4 leading-tight">Pioneer Math Lab</h2>
            <p className="hidden md:block text-slate-300 text-sm leading-relaxed mb-8">
              Access our CAPS-aligned interactive mathematics platform for Grades 4-6. Instant access, no credit card required.
            </p>
            <p className="md:hidden text-slate-300 text-[10px] leading-snug">
              Interactive CAPS math (Gr 4-6).
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest group-hover:gap-4 transition-all relative z-10">
            Enter Lab <ArrowRight size={16} />
          </div>
          
          <div className="md:hidden shrink-0 relative z-10 ml-auto">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <ArrowRight size={16} />
            </div>
          </div>
        </button>

        {/* ROBOTICS INTENT */}
        <button 
          onClick={() => { setIntent('robotics'); setStep(1); }}
          className="group text-left p-4 md:p-8 rounded-[24px] md:rounded-[40px] bg-black/40 backdrop-blur-md border border-blue-500/20 md:border-2 hover:bg-black/60 hover:border-blue-500/50 transition-all duration-300 md:hover:-translate-y-2 relative overflow-hidden flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-0 w-full shadow-2xl hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-blue-600/10 rounded-full blur-[40px] md:blur-[80px] group-hover:bg-blue-600/20 transition-all pointer-events-none" />
          
          <div className="flex md:w-full items-center justify-between md:mb-8 shrink-0 relative z-10">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-600/20 text-blue-400 rounded-xl md:rounded-2xl flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform shadow-inner">
              <Cpu className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
              Premium LMS
            </div>
          </div>
          
          <div className="flex-1 relative z-10 flex flex-col justify-center">
            <div className="md:hidden inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded text-[8px] font-black uppercase tracking-widest mb-1 w-fit">
              Mentorship
            </div>
            <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white mb-0.5 md:mb-4 leading-tight">Robotics Academy</h2>
            <p className="hidden md:block text-slate-300 text-sm leading-relaxed mb-8">
              Apply for our elite coding and robotics mentorship programs. Build real-world IoT systems and launch your own games.
            </p>
            <p className="md:hidden text-slate-300 text-[10px] leading-snug line-clamp-2">
              Elite coding & robotics mentorship.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-widest group-hover:gap-4 transition-all relative z-10">
            Apply Now <ArrowRight size={16} />
          </div>

          <div className="md:hidden shrink-0 relative z-10 ml-auto">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <ArrowRight size={16} />
            </div>
          </div>
        </button>
      </div>
    </motion.div>
  );

  return (
    <main className="h-[100dvh] bg-[#020617] text-white font-sans selection:bg-rad-teal/30 overflow-hidden flex flex-col relative">
      
      {/* SPAM PREVENTION: Honeypot */}
      <div className="hidden" aria-hidden="true">
        <input type="text" name="b_username" tabIndex={-1} autoComplete="off" />
      </div>

      {/* --- BACKGROUND VIDEO (NEW) --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30 grayscale mix-blend-luminosity">
          <source src="/video_clips/Learning Should Be Fun_1080p.mp4" type="video/mp4" />
        </video>
        {/* Heavy darkening overlay to ensure text contrast */}
        <div className="absolute inset-0 bg-[#020617]/80" />
      </div>

      {/* Ambient Glow tied to Intent (Sits above video, below UI) */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 z-0 ${
        intent === 'math' ? 'bg-emerald-500/15' : intent === 'robotics' ? 'bg-blue-600/15' : 'bg-transparent'
      }`} />

      {/* HEADER NAVIGATION */}
      <nav className="p-4 md:p-8 max-w-7xl mx-auto w-full flex justify-between items-center relative z-20 shrink-0">
        <Link href="/" className="flex items-center gap-3 md:gap-4 group">
           <div className="w-10 h-6 md:w-12 md:h-8 border border-white/10 rounded-md md:rounded-lg flex items-center justify-center bg-white/5 backdrop-blur-md p-1 transition-transform group-hover:scale-105">
             <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy Logo" width={120} height={40} unoptimized style={{ width: '100%', height: 'auto' }} />
           </div>
           <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors drop-shadow-md">Return Home</span>
        </Link>
        {step > 0 && (
          <button onClick={() => { setStep(0); setIntent(null); setFormError(""); }} className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-1.5 md:gap-2 transition-colors drop-shadow-md">
            <ArrowLeft size={12} className="md:w-3.5 md:h-3.5" /> <span className="hidden sm:inline">Change Pathway</span><span className="sm:hidden">Back</span>
          </button>
        )}
      </nav>

      {/* DYNAMIC FORM CONTAINER */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 pb-4 md:pb-6 relative z-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {step === 0 && renderIntentSelector()}

          {/* === MATH LAB PATHWAY === */}
          {step === 1 && intent === 'math' && (
            <motion.form key="math-form" onSubmit={handleMathSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md space-y-6 md:space-y-8 my-auto pb-8">
              <div className="text-center space-y-1 md:space-y-2">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500/20 text-emerald-400 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 border border-emerald-500/30 shrink-0 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <Brain className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg">Math Lab Setup</h2>
                <p className="text-slate-300 text-[10px] md:text-xs font-bold uppercase tracking-widest drop-shadow-md">Instant Free Access</p>
              </div>

              {formError && (
                <div className="p-3 md:p-4 rounded-xl bg-red-500/20 backdrop-blur-md border border-red-500/30 flex items-start gap-2 md:gap-3 shadow-lg">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5 w-4 h-4 md:w-4 md:h-4" />
                  <p className="text-red-100 text-xs md:text-sm font-bold">{formError}</p>
                </div>
              )}

              <div className="space-y-3 md:space-y-4 bg-black/50 p-5 md:p-8 rounded-[24px] md:rounded-[32px] border border-white/10 backdrop-blur-lg shadow-2xl">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Parent Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 md:w-4 md:h-4" />
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 pl-11 md:pl-14 pr-4 md:pr-6 font-bold focus:bg-white/10 focus:border-emerald-500 focus:outline-none transition-all text-xs md:text-sm text-white" placeholder="parent@email.com" />
                  </div>
                </div>

                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Student Real Name</label>
                  <div className="relative">
                    <User className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 md:w-4 md:h-4" />
                    <input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 pl-11 md:pl-14 pr-4 md:pr-6 font-bold focus:bg-white/10 focus:border-emerald-500 focus:outline-none transition-all text-xs md:text-sm text-white" placeholder="John" />
                  </div>
                </div>

                <div className="space-y-1.5 md:space-y-2 pt-1 md:pt-2">
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Curriculum Grade (CAPS)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[4, 5, 6].map(grade => (
                      <button 
                        key={grade} type="button" onClick={() => setFormData({...formData, grade: grade.toString()})}
                        className={`h-10 md:h-12 rounded-lg md:rounded-xl font-black text-xs md:text-base transition-all ${formData.grade === grade.toString() ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                      >
                        Gr {grade}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full h-px bg-white/10 my-4 md:my-6" />

                {/* USERNAME AND PIN GENERATOR */}
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-2">Choose Pioneer ID (Username)</label>
                  <div className="relative">
                    <User className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4 md:w-4 md:h-4" />
                    <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-emerald-500/10 border border-emerald-500/30 pl-11 md:pl-14 pr-4 md:pr-6 font-bold text-emerald-300 focus:bg-emerald-500/20 focus:border-emerald-400 focus:outline-none transition-all text-xs md:text-sm placeholder:text-emerald-700/50" placeholder="e.g. StarCoder99" />
                  </div>
                </div>

                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-2">Choose 4-Digit Secret PIN</label>
                  <div className="relative">
                    <Key className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4 md:w-4 md:h-4" />
                    <input required type="number" min="1000" max="9999" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-emerald-500/10 border border-emerald-500/30 pl-11 md:pl-14 pr-4 md:pr-6 font-black tracking-[0.2em] text-emerald-300 focus:bg-emerald-500/20 focus:border-emerald-400 focus:outline-none transition-all text-base md:text-lg placeholder:text-emerald-700/50" placeholder="1234" />
                  </div>
                  <p className="text-[8px] md:text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest leading-tight pt-1">Remember this! You will need it to log in tomorrow.</p>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full h-14 md:h-16 rounded-xl md:rounded-[24px] bg-emerald-500 text-black font-black uppercase italic tracking-widest flex items-center justify-center gap-2 md:gap-3 hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 text-xs md:text-base">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Create Account <ArrowRight size={16} /></>}
              </button>
            </motion.form>
          )}

          {/* === ROBOTICS ACADEMY PATHWAY === */}
          {step === 1 && intent === 'robotics' && (
            <motion.form key="robo-form" onSubmit={handleRoboticsSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-xl space-y-6 md:space-y-8 my-auto pb-8">
              <div className="text-center space-y-1 md:space-y-2">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600/20 text-blue-400 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 border border-blue-500/30 shrink-0 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                  <Cpu className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg">Robotics Admissions</h2>
                <p className="text-slate-300 text-[10px] md:text-xs font-bold uppercase tracking-widest drop-shadow-md">Premium Mentorship Application</p>
              </div>

              {formError && (
                <div className="p-3 md:p-4 rounded-xl bg-red-500/20 backdrop-blur-md border border-red-500/30 flex items-start gap-2 md:gap-3 shadow-lg">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5 w-4 h-4 md:w-4 md:h-4" />
                  <p className="text-red-100 text-xs md:text-sm font-bold">{formError}</p>
                </div>
              )}

              <div className="space-y-4 md:space-y-6 bg-black/50 p-5 md:p-8 rounded-[24px] md:rounded-[40px] border border-white/10 backdrop-blur-lg shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1.5 md:space-y-2 md:col-span-2">
                    <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Parent Name</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 md:w-4 md:h-4" />
                      <input required type="text" value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 pl-11 md:pl-14 pr-4 md:pr-6 font-bold focus:bg-white/10 focus:border-blue-500 focus:outline-none transition-all text-xs md:text-sm text-white" placeholder="Jane Doe" />
                    </div>
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 md:w-4 md:h-4" />
                      <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 pl-11 md:pl-14 pr-4 md:pr-6 font-bold focus:bg-white/10 focus:border-blue-500 focus:outline-none transition-all text-xs md:text-sm text-white" placeholder="jane@email.com" />
                    </div>
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 md:w-4 md:h-4" />
                      <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 pl-11 md:pl-14 pr-4 md:pr-6 font-bold focus:bg-white/10 focus:border-blue-500 focus:outline-none transition-all text-xs md:text-sm text-white" placeholder="+27..." />
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-white/10 my-2 md:my-4" />

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Student Name</label>
                    <div className="relative">
                      <Users className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 md:w-4 md:h-4" />
                      <input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 pl-11 md:pl-14 pr-4 md:pr-6 font-bold focus:bg-white/10 focus:border-blue-500 focus:outline-none transition-all text-xs md:text-sm text-white" placeholder="John" />
                    </div>
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 text-center block">Age</label>
                    <input required type="number" min="5" max="18" value={formData.studentAge} onChange={e => setFormData({...formData, studentAge: e.target.value})} className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 px-4 md:px-6 font-bold focus:bg-white/10 focus:border-blue-500 focus:outline-none transition-all text-xs md:text-sm text-center text-white" placeholder="e.g. 12" />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full h-14 md:h-16 rounded-xl md:rounded-[24px] bg-blue-600 text-white font-black uppercase italic tracking-widest flex items-center justify-center gap-2 md:gap-3 hover:bg-blue-500 transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] disabled:opacity-50 text-xs md:text-base">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Submit Application <ArrowRight size={16} /></>}
              </button>
            </motion.form>
          )}

          {/* === STEP 2: MATH SUCCESS (AUTO-LOGIN) === */}
          {step === 2 && intent === 'math' && (
            <motion.div key="math-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center space-y-6 md:space-y-8 my-auto p-6 bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-500/20 text-emerald-400 rounded-2xl md:rounded-[32px] flex items-center justify-center mx-auto border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)] shrink-0">
                <ShieldCheck className="w-10 h-10 md:w-10 md:h-10" />
              </div>
              
              <div className="space-y-1.5 md:space-y-2">
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Access Granted</h2>
                <p className="text-slate-300 text-xs md:text-sm px-4 font-medium">Your Pioneer ID is registered. Write it down!</p>
              </div>

              <div className="bg-black/50 border border-emerald-500/30 rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-inner space-y-4 md:space-y-6">
                <div className="space-y-1 text-left border-b border-white/10 pb-3 md:pb-4">
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-500">Pioneer ID (Username)</p>
                  <p className="text-lg md:text-xl font-bold text-white break-all">{formData.username}</p>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-500">Secret Code (PIN)</p>
                  <p className="text-3xl md:text-4xl font-black tracking-[0.2em] text-emerald-400">{formData.pin}</p>
                </div>
              </div>

              <button onClick={() => router.push('/math')} className="w-full h-14 md:h-16 rounded-xl md:rounded-[24px] bg-emerald-500 text-black font-black uppercase italic tracking-widest flex items-center justify-center gap-2 md:gap-3 hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] group text-xs md:text-base mt-2">
                Enter Math Lab <ArrowRight size={16} className="md:w-[18px] md:h-[18px] group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {/* === STEP 2: ROBOTICS SUCCESS === */}
          {step === 2 && intent === 'robotics' && (
            <motion.div key="robo-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 md:space-y-8 my-auto p-6 md:py-12 bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-[40px] bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(37,99,235,0.2)] shrink-0">
                 <ShieldCheck className="text-blue-400 w-10 h-10 md:w-12 md:h-12" />
              </div>
              
              <div className="space-y-3 md:space-y-4 max-w-sm mx-auto px-4">
                <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">
                  Application <br /><span className="text-blue-400">Received</span>
                </h1>
                <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
                  Thank you! Our admissions team will review your details and contact you via email or WhatsApp within 24 hours to arrange your trial session.
                </p>
              </div>

              <Link href="/" className="inline-flex items-center gap-2 md:gap-4 text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 hover:text-white transition-all group pt-4 md:pt-8">
                <ArrowLeft size={12} className="md:w-3.5 md:h-3.5 group-hover:-translate-x-1 transition-transform" /> Back to Homepage
              </Link>
            </motion.div>
          )}

        </AnimatePresence>
      </section>
    </main>
  );
}