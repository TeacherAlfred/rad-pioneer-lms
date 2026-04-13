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

  // --- SUBMISSION HANDLERS ---

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
      // Step A: CRM Log (Silently continue if this fails)
      try {
        await supabase.from('registrations').insert([{
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
      } catch (crmError) {
        console.warn("CRM Log failed, proceeding to account creation:", crmError);
      }

      // Step B: Generate Auth & Profile (Active LMS Account)
      const cleanUsername = formData.username.trim().toLowerCase();
      const shadowEmail = `${cleanUsername.replace(/\s/g, '')}@pioneer.bot`;
      
      /** * CODE WORKAROUND:
       * Supabase requires 6+ characters. 
       * We pad the 4-digit PIN so it passes Auth validation.
       */
      const paddedPassword = `PIONEER-${formData.pin}`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: shadowEmail,
        password: paddedPassword,
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
          temp_entry_pin: formData.pin, // Store the raw 4-digit pin for student display
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
      const { error } = await supabase
        .from('registrations')
        .insert([{
          parent_name: formData.parentName,
          email: formData.email,
          phone: formData.phone.trim(),
          student_name: formData.studentName,
          student_age: parseInt(formData.studentAge),
          interested_programs: ["Premium Robotics LMS"], 
          status: 'new', 
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
      <div className="text-center space-y-1 md:space-y-4 shrink-0">
        <h1 className="text-3xl md:text-6xl font-black uppercase italic tracking-tighter leading-none drop-shadow-xl">
          Select <span className="text-rad-blue">Pathway</span>
        </h1>
        <p className="hidden md:block text-slate-300 text-base font-medium max-w-xl mx-auto drop-shadow-md">
          Are you looking to access our free mathematics tools, or are you applying for our premium robotics and coding mentorship?
        </p>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-2 gap-3 md:gap-6 w-full">
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
          <div className="flex-1 relative z-10">
            <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white mb-0.5 md:mb-4 leading-tight">Pioneer Math Lab</h2>
            <p className="hidden md:block text-slate-300 text-sm leading-relaxed">Access our CAPS-aligned interactive math platform. Instant free access.</p>
          </div>
          <div className="shrink-0 relative z-10 ml-auto">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ArrowRight size={16} />
            </div>
          </div>
        </button>

        <button 
          onClick={() => { setIntent('robotics'); setStep(1); }}
          className="group text-left p-4 md:p-8 rounded-[24px] md:rounded-[40px] bg-black/40 backdrop-blur-md border border-blue-500/20 md:border-2 hover:bg-black/60 hover:border-blue-500/50 transition-all duration-300 md:hover:-translate-y-2 relative overflow-hidden flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-0 w-full shadow-2xl hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-blue-600/10 rounded-full blur-[40px] md:blur-[80px] group-hover:bg-blue-600/20 transition-all pointer-events-none" />
          <div className="flex md:w-full items-center justify-between md:mb-8 shrink-0 relative z-10">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-600/20 text-blue-400 rounded-xl md:rounded-2xl flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform shadow-inner">
              <Cpu className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/30">Premium Mentorship</div>
          </div>
          <div className="flex-1 relative z-10">
            <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white mb-0.5 md:mb-4 leading-tight">Robotics Academy</h2>
            <p className="hidden md:block text-slate-300 text-sm leading-relaxed">Apply for elite coding and robotics mentorship. Build real-world IoT systems.</p>
          </div>
          <div className="shrink-0 relative z-10 ml-auto">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <ArrowRight size={16} />
            </div>
          </div>
        </button>
      </div>
    </motion.div>
  );

  return (
    <main className="h-[100dvh] bg-[#020617] text-white font-sans selection:bg-rad-teal/30 overflow-hidden flex flex-col relative">
      
      {/* BACKGROUND VIDEO */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30 grayscale mix-blend-luminosity">
          <source src="/video_clips/Learning Should Be Fun_1080p.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[#020617]/80" />
      </div>

      <nav className="p-4 md:p-8 max-w-7xl mx-auto w-full flex justify-between items-center relative z-20 shrink-0">
        <Link href="/" className="flex items-center gap-3 md:gap-4 group">
           <div className="w-10 h-6 md:w-12 md:h-8 border border-white/10 rounded-md md:rounded-lg flex items-center justify-center bg-white/5 backdrop-blur-md p-1 transition-transform group-hover:scale-105">
             <Image src="/logo/rad-logo_white_2.png" alt="Logo" width={120} height={40} unoptimized style={{ width: '100%', height: 'auto' }} />
           </div>
        </Link>
        {step > 0 && (
          <button onClick={() => { setStep(0); setIntent(null); setFormError(""); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
            <ArrowLeft size={12} /> Back
          </button>
        )}
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 relative z-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {step === 0 && renderIntentSelector()}

          {step === 1 && intent === 'math' && (
            <motion.form key="math-form" onSubmit={handleMathSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md space-y-6 md:space-y-8 my-auto pb-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Math Lab Setup</h2>
                <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Instant Free Access</p>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 flex items-start gap-2 shadow-lg">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-red-100 text-xs font-bold">{formError}</p>
                </div>
              )}

              <div className="space-y-4 bg-black/50 p-6 md:p-8 rounded-[32px] border border-white/10 backdrop-blur-lg shadow-2xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Parent Email</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-12 md:h-14 rounded-xl bg-white/5 border border-white/10 px-4 font-bold focus:border-emerald-500 outline-none text-white text-sm" placeholder="parent@email.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Student Real Name</label>
                  <input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} className="w-full h-12 md:h-14 rounded-xl bg-white/5 border border-white/10 px-4 font-bold focus:border-emerald-500 outline-none text-white text-sm" placeholder="John" />
                </div>
                <div className="w-full h-px bg-white/10 my-4" />
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-2">Choose Pioneer ID</label>
                  <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full h-12 md:h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 font-bold text-emerald-300 focus:border-emerald-400 outline-none text-sm" placeholder="Username" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-2">4-Digit Secret PIN</label>
                  <input required type="number" min="1000" max="9999" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full h-12 md:h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 font-black tracking-[0.3em] text-emerald-300 focus:border-emerald-400 outline-none text-lg" placeholder="1234" />
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full h-14 md:h-16 rounded-xl md:rounded-[24px] bg-emerald-500 text-black font-black uppercase italic tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-xl disabled:opacity-50">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Create Account <ArrowRight size={16} /></>}
              </button>
            </motion.form>
          )}

          {step === 1 && intent === 'robotics' && (
            <motion.form key="robo-form" onSubmit={handleRoboticsSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-xl space-y-6 md:space-y-8 my-auto pb-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Robotics Admissions</h2>
                <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Premium Mentorship Application</p>
              </div>

              <div className="space-y-4 md:space-y-6 bg-black/50 p-6 md:p-8 rounded-[32px] border border-white/10 backdrop-blur-lg shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Parent Name</label>
                    <input required type="text" value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} className="w-full h-12 md:h-14 rounded-xl bg-white/5 border border-white/10 px-4 font-bold focus:border-blue-500 outline-none text-white text-sm" placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-12 md:h-14 rounded-xl bg-white/5 border border-white/10 px-4 font-bold focus:border-blue-500 outline-none text-white text-sm" placeholder="jane@email.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Phone Number</label>
                    <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full h-12 md:h-14 rounded-xl bg-white/5 border border-white/10 px-4 font-bold focus:border-blue-500 outline-none text-white text-sm" placeholder="+27..." />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full h-14 md:h-16 rounded-xl md:rounded-[24px] bg-blue-600 text-white font-black uppercase italic tracking-widest flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl disabled:opacity-50">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Submit Application <ArrowRight size={16} /></>}
              </button>
            </motion.form>
          )}

          {step === 2 && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm text-center space-y-8 p-8 bg-black/40 backdrop-blur-md rounded-[40px] border border-white/10 shadow-2xl">
              <ShieldCheck className={intent === 'math' ? "text-emerald-400 mx-auto" : "text-blue-400 mx-auto"} size={64} />
              <div className="space-y-2">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Access Granted</h2>
                <p className="text-slate-300 text-xs font-medium">Your request has been initialized.</p>
              </div>
              <button 
                onClick={() => router.push(intent === 'math' ? '/math' : '/')} 
                className={`w-full py-5 rounded-2xl font-black uppercase italic tracking-widest text-xs transition-all shadow-xl ${intent === 'math' ? 'bg-emerald-500 text-black' : 'bg-white text-black'}`}
              >
                Proceed to Lab <ArrowRight className="inline ml-2" size={16} />
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </section>
    </main>
  );
}