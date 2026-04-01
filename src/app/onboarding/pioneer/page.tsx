"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Loader2, Send, User as UserIcon, BookOpen, 
  Users as TeamIcon, Monitor, MapPin, ChevronRight, 
  ChevronLeft, CheckCircle2, AlertCircle, RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LegalTerminal from "@/components/LegalTerminal";

const DIRECTIVES_VERSION = "2026.1";

export default function PioneerOnboarding() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    }>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const searchParams = useSearchParams();
  const pioneerId = searchParams.get("id");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pioneerData, setPioneerData] = useState<any>(null);
  
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const initialState = {
    username: "",
    accessCode: "",
    dob: "",
    agreed: false
  };

  const [formData, setFormData] = useState(initialState);

  const handleReset = () => {
    setFormData(initialState);
    setStep(1);
    setUsernameStatus('idle');
  };

  useEffect(() => {
    async function fetchPioneerInfo() {
      if (!pioneerId) {
        setPioneerData({
          display_name: "Alfred Chingombe",
          squad_name: "Pillar Strength",
          lesson_format: "In Person",
          enrollment: { 
            course: { 
              title: "Game Creator Bootcamp", 
              description: "A 6-week Scratch-based project course where students design and build their own game." 
            } 
          }
        });
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', pioneerId).single();
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select(`course:courses(title, description)`)
          .eq('student_id', pioneerId)
          .eq('status', 'active')
          .single();

        if (profile) {
          setPioneerData({ ...profile, enrollment });
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPioneerInfo();
  }, [pioneerId]);

  const checkUsername = async () => {
    if (!formData.username || formData.username.length < 3) return;
    setUsernameStatus('checking');
    
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('student_identifier', formData.username.toLowerCase().trim())
      .maybeSingle();

    if (data) setUsernameStatus('taken');
    else setUsernameStatus('available');
  };

  const handleSubmit = async () => {
    if (formData.accessCode.length !== 4) return alert("PIN must be 4 digits.");
    setIsSubmitting(true);
    
    try {
      if (pioneerId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            student_identifier: formData.username.toLowerCase().trim(),
            metadata: {
              ...pioneerData?.metadata,
              temp_access_code: formData.accessCode,
              date_of_birth: formData.dob || null,
              student_completed_at: new Date().toISOString(),
              directives_version: DIRECTIVES_VERSION,
              onboarding_status: 'pending_guardian_approval'
            }
          })
          .eq('id', pioneerId);

        if (error) throw error;
      } else {
        await new Promise(res => setTimeout(res, 1000));
      }
      setStep(4);
    } catch (err) {
      alert("Error: Username might be taken.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Loading Profile...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full space-y-8">
        
        {/* Progress Dots */}
        <div className="flex justify-center gap-3">
          {[1, 2, 3].map((num) => (
            <div key={num} className={`h-1.5 rounded-full transition-all duration-300 ${step === num ? "w-8 bg-blue-500" : "w-2 bg-white/10"}`} />
          ))}
        </div>

        <div className="bg-white/[0.02] border border-white/5 p-8 md:p-12 rounded-[32px] shadow-2xl backdrop-blur-sm">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: IDENTITY */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase italic">Student Details</h2>
                  <p className="text-slate-500 text-sm">Verify your name and set your login credentials.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
                    <p className="text-lg font-bold mt-1 uppercase">{pioneerData?.display_name || pioneerData?.student_name}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Team</label>
                    <p className="text-lg font-bold text-blue-400 mt-1 uppercase">{pioneerData?.squad_name || "None"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Choose Username</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.username}
                      onChange={(e) => { setFormData({...formData, username: e.target.value}); setUsernameStatus('idle'); }}
                      className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-5 outline-none font-bold text-lg focus:border-blue-500 transition-all" 
                      placeholder="e.g. alfred.c" 
                    />
                    <button 
                      type="button"
                      onClick={checkUsername}
                      className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all"
                    >
                      {usernameStatus === 'checking' ? <Loader2 size={12} className="animate-spin" /> : "Check Availability"}
                    </button>
                  </div>
                  {usernameStatus === 'available' && <p className="text-green-400 text-[10px] font-bold flex items-center gap-2 ml-2"><CheckCircle2 size={14}/> Username available.</p>}
                  {usernameStatus === 'taken' && <p className="text-red-400 text-[10px] font-bold flex items-center gap-2 ml-2"><AlertCircle size={14}/> Username is already taken.</p>}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">4-Digit Login PIN</label>
                  <input 
                    type="text" maxLength={4} inputMode="numeric"
                    value={formData.accessCode} 
                    onChange={(e) => setFormData({...formData, accessCode: e.target.value.replace(/\D/g, '')})} 
                    className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-5 text-center text-3xl tracking-[0.8em] text-teal-400 font-black outline-none focus:border-teal-500" 
                    placeholder="0000" 
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={handleReset}
                    className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={16} /> Reset
                  </button>
                  <button 
                    onClick={() => setStep(2)}
                    disabled={!formData.username || formData.accessCode.length !== 4 || usernameStatus !== 'available'}
                    className="flex-[2] py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 transition-all disabled:opacity-20 shadow-lg shadow-blue-900/20"
                  >
                    Next <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: COURSE INFO */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase italic">Course Enrollment</h2>
                  <p className="text-slate-500 text-sm">Review your course and assigned format.</p>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-teal-400">
                    <BookOpen size={20} />
                    <h3 className="text-lg font-black uppercase">{pioneerData?.enrollment?.course?.title || "Pending"}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-3 italic">
                    {pioneerData?.enrollment?.course?.description}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {pioneerData?.lesson_format === 'Online' ? <Monitor size={20} className="text-blue-400" /> : <MapPin size={20} className="text-purple-400" />}
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Lesson Format</label>
                      <p className="text-sm font-bold text-white uppercase">{pioneerData?.lesson_format || "Unset"}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black text-slate-600 uppercase">Set by Admin</div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep(1)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2 hover:bg-white/10 transition-all"><ChevronLeft size={18} /> Back</button>
                  <button onClick={handleReset} className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-all flex items-center justify-center gap-2"><RotateCcw size={16} /> Reset</button>
                  <button onClick={() => setStep(3)} className="flex-[2] py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">Next</button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: DIRECTIVES */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase italic">Directives</h2>
                  <p className="text-slate-500 text-sm">Please review the RAD Academy requirements.</p>
                </div>

                <LegalTerminal userType="student" />

                <div className="flex items-center gap-4 p-6 bg-white/5 rounded-2xl border border-white/10">
                  <input 
                    type="checkbox" id="terms" 
                    checked={formData.agreed} 
                    onChange={(e) => setFormData({...formData, agreed: e.target.checked})} 
                    className="accent-blue-500 w-6 h-6 rounded-lg cursor-pointer shrink-0" 
                  />
                  <label htmlFor="terms" className="text-xs text-slate-400 italic cursor-pointer">
                    I acknowledge and confirm the Student Directives.
                  </label>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep(2)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2 hover:bg-white/10 transition-all"><ChevronLeft size={18} /> Back</button>
                  <button onClick={handleReset} className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-all flex items-center justify-center gap-2"><RotateCcw size={16} /> Reset</button>
                  <button 
                    disabled={!formData.agreed || isSubmitting}
                    onClick={handleSubmit} 
                    className="flex-[2] py-5 bg-green-600 rounded-2xl font-black uppercase tracking-widest hover:bg-green-500 transition-all disabled:opacity-30 shadow-lg shadow-green-900/20"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: SUCCESS */}
            {step === 4 && (
              <motion.div key="step4" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-10 space-y-6">
                <div className="w-24 h-24 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto text-green-500">
                  <CheckCircle2 size={48} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black uppercase italic">Submitted</h2>
                  <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">
                    Your details were sent to your Parent/Guardian. They need to approve before you can log in.
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}