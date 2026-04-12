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
    username: "", // Added for custom Pioneer ID
    pin: "",      // Added for custom PIN
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
          parent_name: formData.parentName || "Math Parent", // Fallback if we don't ask for it
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
          student_identifier: formData.username.trim(), // Keep their original casing for display
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

      // Optional: Trigger background confirmation email here
      
      setStep(2); // Move to Success Screen

    } catch (error: any) {
      console.error("Robotics Registration failed:", error.message);
      setFormError("Database connection failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER HELPERS ---

  const renderIntentSelector = () => (
    <motion.div key="step0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8 w-full max-w-4xl mx-auto">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
          Select Your <span className="text-rad-blue">Pathway</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base font-medium max-w-xl mx-auto">
          Are you looking to access our free mathematics tools, or are you applying for our premium robotics and coding mentorship?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MATH LAB INTENT */}
        <button 
          onClick={() => { setIntent('math'); setStep(1); }}
          className="group text-left p-8 rounded-[40px] bg-emerald-500/5 border-2 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-[0_0_50px_rgba(16,185,129,0.1)] hover:-translate-y-2 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-8 border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-inner">
            <Brain size={32} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest mb-4">
            <Sparkles size={12} /> Free Forever
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white mb-4">Pioneer Math Lab</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Access our CAPS-aligned interactive mathematics platform for Grades 4-6. Instant access, no credit card required.
          </p>
          <div className="flex items-center gap-2 text-emerald-500 text-xs font-black uppercase tracking-widest group-hover:gap-4 transition-all">
            Enter Lab <ArrowRight size={16} />
          </div>
        </button>

        {/* ROBOTICS INTENT */}
        <button 
          onClick={() => { setIntent('robotics'); setStep(1); }}
          className="group text-left p-8 rounded-[40px] bg-blue-600/5 border-2 border-blue-500/20 hover:bg-blue-600/10 hover:border-blue-500/50 transition-all duration-300 hover:shadow-[0_0_50px_rgba(37,99,235,0.1)] hover:-translate-y-2 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] group-hover:bg-blue-600/20 transition-all pointer-events-none" />
          <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/30 group-hover:scale-110 transition-transform shadow-inner">
            <Cpu size={32} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest mb-4">
            Premium LMS
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white mb-4">Robotics Academy</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Apply for our elite coding and robotics mentorship programs. Build real-world IoT systems and launch your own games.
          </p>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-widest group-hover:gap-4 transition-all">
            Apply Now <ArrowRight size={16} />
          </div>
        </button>
      </div>
    </motion.div>
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-rad-teal/30 overflow-hidden flex flex-col relative">
      
      {/* SPAM PREVENTION: Honeypot */}
      <div className="hidden" aria-hidden="true">
        <input type="text" name="b_username" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Ambient Glow tied to Intent */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${
        intent === 'math' ? 'bg-emerald-500/10' : intent === 'robotics' ? 'bg-blue-600/10' : 'bg-transparent'
      }`} />

      {/* HEADER NAVIGATION */}
      <nav className="p-8 max-w-7xl mx-auto w-full flex justify-between items-center relative z-20">
        <Link href="/" className="flex items-center gap-4 group">
           <div className="w-12 h-8 border border-white/10 rounded-lg flex items-center justify-center bg-white/5 p-1 transition-transform group-hover:scale-105">
             <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy Logo" width={120} height={40} unoptimized style={{ width: '100%', height: 'auto' }} />
           </div>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">Return Home</span>
        </Link>
        {step > 0 && (
          <button onClick={() => { setStep(0); setIntent(null); setFormError(""); }} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white flex items-center gap-2 transition-colors">
            <ArrowLeft size={14} /> Change Pathway
          </button>
        )}
      </nav>

      {/* DYNAMIC FORM CONTAINER */}
      <section className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <AnimatePresence mode="wait">
          
          {step === 0 && renderIntentSelector()}

          {/* === MATH LAB PATHWAY === */}
          {step === 1 && intent === 'math' && (
            <motion.form key="math-form" onSubmit={handleMathSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md space-y-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                  <Brain size={32} />
                </div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Math Lab Setup</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Instant Free Access</p>
              </div>

              {formError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-red-400 text-sm font-bold">{formError}</p>
                </div>
              )}

              <div className="space-y-4 bg-white/[0.02] p-8 rounded-[32px] border border-white/5 backdrop-blur-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Parent Email</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 pl-14 pr-6 font-bold focus:border-emerald-500 focus:outline-none transition-all text-sm" placeholder="parent@email.com" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Student Real Name</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 pl-14 pr-6 font-bold focus:border-emerald-500 focus:outline-none transition-all text-sm" placeholder="John" />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Curriculum Grade (CAPS)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[4, 5, 6].map(grade => (
                      <button 
                        key={grade} type="button" onClick={() => setFormData({...formData, grade: grade.toString()})}
                        className={`h-12 rounded-xl font-black transition-all ${formData.grade === grade.toString() ? 'bg-emerald-500 text-white shadow-inner' : 'bg-white/5 border border-white/10 text-slate-500 hover:bg-white/10'}`}
                      >
                        Gr {grade}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full h-px bg-white/5 my-6" />

                {/* USERNAME AND PIN GENERATOR */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-2">Choose Pioneer ID (Username)</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                    <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full h-14 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 pl-14 pr-6 font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none transition-all text-sm" placeholder="e.g. StarCoder99" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-2">Choose 4-Digit Secret PIN</label>
                  <div className="relative">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                    <input required type="number" min="1000" max="9999" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full h-14 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 pl-14 pr-6 font-black tracking-[0.2em] text-emerald-400 focus:border-emerald-500 focus:outline-none transition-all text-lg" placeholder="1234" />
                  </div>
                  <p className="text-[9px] text-slate-500 text-center font-bold uppercase tracking-widest">Remember this! You will need it to log in tomorrow.</p>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[24px] bg-emerald-500 text-black font-black uppercase italic tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50">
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <>Create Account <ArrowRight size={18} /></>}
              </button>
            </motion.form>
          )}

          {/* === ROBOTICS ACADEMY PATHWAY === */}
          {step === 1 && intent === 'robotics' && (
            <motion.form key="robo-form" onSubmit={handleRoboticsSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-xl space-y-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                  <Cpu size={32} />
                </div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Robotics Admissions</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Premium Mentorship Application</p>
              </div>

              {formError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-red-400 text-sm font-bold">{formError}</p>
                </div>
              )}

              <div className="space-y-6 bg-white/[0.02] p-8 rounded-[40px] border border-white/5 backdrop-blur-sm">
                {/* Parent Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Parent Name</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                      <input required type="text" value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 pl-14 pr-6 font-bold focus:border-blue-500 focus:outline-none transition-all text-sm" placeholder="Jane Doe" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                      <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 pl-14 pr-6 font-bold focus:border-blue-500 focus:outline-none transition-all text-sm" placeholder="jane@email.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                      <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 pl-14 pr-6 font-bold focus:border-blue-500 focus:outline-none transition-all text-sm" placeholder="+27..." />
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-white/5 my-4" />

                {/* Student Block */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Student Name</label>
                    <div className="relative">
                      <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                      <input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 pl-14 pr-6 font-bold focus:border-blue-500 focus:outline-none transition-all text-sm" placeholder="John" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Student Age</label>
                    <input required type="number" min="5" max="18" value={formData.studentAge} onChange={e => setFormData({...formData, studentAge: e.target.value})} className="w-full h-14 rounded-2xl bg-black/40 border border-white/10 px-6 font-bold focus:border-blue-500 focus:outline-none transition-all text-sm text-center" placeholder="e.g. 12" />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-[24px] bg-blue-600 text-white font-black uppercase italic tracking-widest flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] disabled:opacity-50">
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <>Submit Application <ArrowRight size={18} /></>}
              </button>
            </motion.form>
          )}

          {/* === STEP 2: MATH SUCCESS (AUTO-LOGIN) === */}
          {step === 2 && intent === 'math' && (
            <motion.div key="math-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center space-y-8">
              <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-[32px] flex items-center justify-center mx-auto border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                <ShieldCheck size={40} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Access Granted</h2>
                <p className="text-slate-400 text-sm">Your Pioneer ID is registered. Write it down so you don't forget!</p>
              </div>

              <div className="bg-[#0f172a] border-2 border-emerald-500/30 rounded-3xl p-6 shadow-inner space-y-6">
                <div className="space-y-1 text-left border-b border-white/10 pb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pioneer ID (Username)</p>
                  <p className="text-xl font-bold text-white">{formData.username}</p>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Secret Code (PIN)</p>
                  <p className="text-4xl font-black tracking-[0.2em] text-emerald-400">{formData.pin}</p>
                </div>
              </div>

              <button onClick={() => router.push('/math')} className="w-full h-16 rounded-[24px] bg-emerald-500 text-black font-black uppercase italic tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-xl group">
                Enter Math Lab <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {/* === STEP 2: ROBOTICS SUCCESS === */}
          {step === 2 && intent === 'robotics' && (
            <motion.div key="robo-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 py-12">
              <div className="w-28 h-28 rounded-[40px] bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(37,99,235,0.2)]">
                 <ShieldCheck size={48} className="text-blue-400" />
              </div>
              
              <div className="space-y-4 max-w-sm mx-auto">
                <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
                  Application <br /><span className="text-blue-400">Received</span>
                </h1>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Thank you! Our admissions team will review your details and contact you via email or WhatsApp within 24 hours to arrange your trial session.
                </p>
              </div>

              <Link href="/" className="inline-flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 hover:text-white transition-all group pt-8">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Homepage
              </Link>
            </motion.div>
          )}

        </AnimatePresence>
      </section>
    </main>
  );
}