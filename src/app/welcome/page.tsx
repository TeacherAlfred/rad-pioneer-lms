"use client";

import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, Lock, User, Users, GraduationCap, CreditCard, 
  ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, ChevronRight, 
  Check, Info, Zap, RotateCcw, UserPlus, Mail, Gamepad2, X, Loader2, Square, CheckSquare, Star, Plus, Trash2, AlertTriangle
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";

// --- CONSTANTS ---
const ALL_PROGRAM_OPTIONS = [
  "Demo LMS Access",
  "Home Automation Bootcamp (PLK)",
  "Game Creator Bootcamp (Online)",
  "Term Program - Smart Home Systems"
];

const LAUNCH_FAQS = [
  { icon: Mail, color: "text-blue-500", bg: "bg-blue-50", title: "How do I log in?", details: "If you are enrolled, check your email for a secure link from `onboarding@updates.radacademy.co.za`. Click it to securely set your password and access your dashboard. No complex registration needed!" },
  { icon: Gamepad2, color: "text-purple-500", bg: "bg-purple-50", title: "Why do we need a username?", details: "During onboarding, you will create a username (e.g., 'CodeNinja') and a 4-digit PIN. The Username is your child's display name for leaderboards, keeping their real identity secure." },
  { icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50", title: "What is new on the platform?", details: "We have built a completely new dashboard. Students now have a clear learning path, progress tracking, an archive of past projects, and much more." },
  { icon: ShieldCheck, color: "text-amber-500", bg: "bg-amber-50", title: "Is the platform secure?", details: "Yes. The learning environment is private, age-appropriate, and restricted only to enrolled RAD Academy students." }
];

export default function WelcomePortal() {
  // --- MASTER STATE ---
  const [isInitializing, setIsInitializing] = useState(true);
  const [personalToken, setPersonalToken] = useState<string | null>(null);

  // --- GATEWAY STATE (No Token) ---
  const [pathway, setPathway] = useState<"current" | "past" | "new" | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSubmittingGateway, setIsSubmittingGateway] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  const [gatewayData, setGatewayData] = useState({
    parentName: "", email: "", phone: "", studentName: "", studentAge: "", selectedPrograms: [] as string[], smartHomeMode: "", botField: ""
  });

  // --- WIZARD STATE (Has Token) ---
  const [step, setStep] = useState(0);
  const [isSubmittingWizard, setIsSubmittingWizard] = useState(false);
  
  const [requiredAgreements, setRequiredAgreements] = useState<any[]>([]);
  const [activeGuardianTab, setActiveGuardianTab] = useState(0);
  const [activeLearnerTab, setActiveLearnerTab] = useState(0);

  const [wizardData, setWizardData] = useState({
    password: "", confirmPassword: "",
    planType: "", // NEW: Stores plan type to dynamically hide steps
    guardians: [{ id: 'primary', name: "", email: "", phone: "", isPrimary: true, removalRequested: false }],
    learners: [{ id: 1 as any, name: "", dob: "", grade: "", schoolCoding: false, removalRequested: false }],
    billing: { frequency: "monthly", date: "1st" },
    agreements: {} as Record<string, any>
  });

  // --- REAL-TIME PASSWORD CHECKS ---
  const pwdLength = wizardData.password.length >= 8;
  const pwdHasUpper = /[A-Z]/.test(wizardData.password);
  const pwdHasNum = /\d/.test(wizardData.password);
  const pwdMatch = wizardData.password.length > 0 && wizardData.password === wizardData.confirmPassword;

  // --- DYNAMIC WIZARD PATHING ---
  // If their plan type has "LMS Access" OR "Bootcamp", remove step 3 (Billing) from the flow
  const skipBilling = wizardData.planType?.includes("LMS Access") || wizardData.planType?.includes("Bootcamp");
  const wizardSteps = skipBilling ? [0, 1, 2, 4] : [0, 1, 2, 3, 4];

  // --- INITIALIZATION (Connected to Supabase) ---
  useEffect(() => {
    const initializeOnboarding = async () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('t'); 
        
        if (token) {
          try {
            // Fetch Guardian
            const { data: guardianData, error: guardianErr } = await supabase
              .from('profiles')
              .select('id, display_name, metadata, funnel_stage, payment_plan_preference')
              .eq('onboarding_token', token)
              .single();

            if (guardianErr || !guardianData) {
              console.warn("Token invalid, expired, or already used.");
              setPersonalToken(null);
              setIsInitializing(false);
              return;
            }

            const meta = typeof guardianData.metadata === 'string' ? JSON.parse(guardianData.metadata) : (guardianData.metadata || {});

            // Fetch Co-Guardians
            const { data: coGuardiansData } = await supabase
              .from('profiles')
              .select('id, display_name, metadata')
              .eq('linked_parent_id', guardianData.id)
              .eq('role', 'guardian');

            let loadedGuardians = [{
              id: guardianData.id,
              name: guardianData.display_name || "",
              email: meta.email || "",
              phone: meta.phone || "",
              isPrimary: true,
              removalRequested: false
            }];

            if (coGuardiansData && coGuardiansData.length > 0) {
              coGuardiansData.forEach((cg: any) => {
                const cgMeta = typeof cg.metadata === 'string' ? JSON.parse(cg.metadata) : (cg.metadata || {});
                loadedGuardians.push({
                  id: cg.id,
                  name: cg.display_name || "",
                  email: cgMeta.email || "",
                  phone: cgMeta.phone || "",
                  isPrimary: false,
                  removalRequested: false
                });
              });
            }

            // Fetch Learners
            const { data: learnersData } = await supabase
              .from('profiles')
              .select('id, display_name, metadata')
              .eq('linked_parent_id', guardianData.id)
              .eq('role', 'student');

            let loadedLearners = [];
            if (learnersData && learnersData.length > 0) {
              loadedLearners = learnersData.map((l: any) => {
                const lMeta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : (l.metadata || {});
                return {
                  id: l.id, 
                  name: l.display_name || "",
                  dob: lMeta.dob || lMeta.date_of_birth || "",
                  grade: lMeta.grade || "",
                  schoolCoding: lMeta.school_coding || false,
                  removalRequested: false
                }
              });
            } else {
              loadedLearners = [{ id: Date.now(), name: "", dob: "", grade: "", schoolCoding: false, removalRequested: false }];
            }

            // DYNAMIC AGREEMENT FETCH
            const { data: agreementsData } = await supabase
              .from('core_agreements')
              .select('*')
              .order('created_at', { ascending: true });

            // SMART FILTERING
            const parentTags = [
              guardianData.payment_plan_preference,
              meta.lesson_delivery_format
            ].filter(Boolean);

            let filteredAgreements = (agreementsData || []).filter((a: any) => {
              if (!a.applicable_to || a.applicable_to.length === 0) return true;
              return a.applicable_to.some((tag: string) => parentTags.includes(tag));
            });

            setRequiredAgreements(filteredAgreements);
            
            const initialAgreementsState: Record<string, any> = {};
            filteredAgreements.forEach((a: any) => {
              if (a.type === 'required_checkbox') initialAgreementsState[a.id] = false;
              else if (a.type === 'yes_no') initialAgreementsState[a.id] = null;
              else if (a.type === 'optional_text') initialAgreementsState[a.id] = "";
            });

            setWizardData(prev => ({
              ...prev,
              planType: guardianData.payment_plan_preference || "", // Track plan type
              guardians: loadedGuardians,
              learners: loadedLearners,
              agreements: initialAgreementsState
            }));

            setPersonalToken(token);
          } catch (err) {
            console.error("Critical error during onboarding initialization:", err);
            setPersonalToken(null);
          } finally {
            setIsInitializing(false);
          }
        } else {
          setIsInitializing(false);
        }
      }
    };

    initializeOnboarding();
  }, []);

  useEffect(() => {
    if (pathway !== null) setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }, [pathway]);

  // --- GATEWAY HANDLERS ---
  const handleOpenRegister = (prefilledProgram?: string) => {
    setSubmitSuccess(false); setFormError("");
    setGatewayData(prev => ({ ...prev, selectedPrograms: prefilledProgram ? [prefilledProgram] : [] }));
    setIsRegisterOpen(true);
  };

  const toggleProgram = (program: string) => {
    setFormError("");
    setGatewayData(prev => ({
      ...prev,
      selectedPrograms: prev.selectedPrograms.includes(program) ? prev.selectedPrograms.filter(p => p !== program) : [...prev.selectedPrograms, program]
    }));
  };

  const handleGatewaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gatewayData.botField) { setSubmitSuccess(true); setTimeout(() => setIsRegisterOpen(false), 3000); return; }
    setIsSubmittingGateway(true);
    setTimeout(() => {
      setIsSubmittingGateway(false);
      setSubmitSuccess(true);
      setTimeout(() => setIsRegisterOpen(false), 3000);
    }, 1500);
  };

  // --- SMART WIZARD HANDLERS ---
  const handleNext = () => {
    const currentIndex = wizardSteps.indexOf(step);
    if (currentIndex < wizardSteps.length - 1) {
      setStep(wizardSteps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = wizardSteps.indexOf(step);
    if (currentIndex > 0) {
      setStep(wizardSteps[currentIndex - 1]);
    }
  };
  
  // Tab Functions for Guardians
  const handleAddGuardian = () => {
    const newGuardians = [...wizardData.guardians, { id: Date.now().toString(), name: "", email: "", phone: "", isPrimary: false, removalRequested: false }];
    setWizardData({ ...wizardData, guardians: newGuardians });
    setActiveGuardianTab(newGuardians.length - 1);
  };

  const handleRemoveGuardian = (indexToRemove: number) => {
    const guardian = wizardData.guardians[indexToRemove];
    if (guardian.isPrimary) return; 

    if (typeof guardian.id === 'string' && guardian.id.length > 20) {
      const confirmed = window.confirm(`Are you sure you want to remove ${guardian.name || 'this guardian'}?\n\nThis will safely send a removal request to our admin team.`);
      if (confirmed) {
        const newGuardians = [...wizardData.guardians];
        newGuardians[indexToRemove].removalRequested = true;
        setWizardData({ ...wizardData, guardians: newGuardians });
      }
    } else {
      const newGuardians = wizardData.guardians.filter((_, idx) => idx !== indexToRemove);
      setWizardData({ ...wizardData, guardians: newGuardians });
      setActiveGuardianTab(Math.max(0, activeGuardianTab - 1));
    }
  };

  // Tab Functions for Learners
  const handleAddLearner = () => {
    const newLearners = [...wizardData.learners, { id: Date.now(), name: "", dob: "", grade: "", schoolCoding: false, removalRequested: false }];
    setWizardData({ ...wizardData, learners: newLearners });
    setActiveLearnerTab(newLearners.length - 1);
  };

  const handleRemoveLearner = (indexToRemove: number) => {
    const learner = wizardData.learners[indexToRemove];
    if (typeof learner.id === 'string' && learner.id.length > 20) {
      const confirmed = window.confirm(`Are you sure you want to remove ${learner.name || 'this child'}?\n\nTo prevent accidental loss of learning progress or billing issues, this will safely send a removal request to our admin team.`);
      if (confirmed) {
        const newLearners = [...wizardData.learners];
        newLearners[indexToRemove].removalRequested = true;
        setWizardData({ ...wizardData, learners: newLearners });
      }
    } else {
      if (wizardData.learners.length <= 1) return;
      const newLearners = wizardData.learners.filter((_, idx) => idx !== indexToRemove);
      setWizardData({ ...wizardData, learners: newLearners });
      setActiveLearnerTab(Math.max(0, activeLearnerTab - 1));
    }
  };

  const handleCompleteWizard = async () => {
    setIsSubmittingWizard(true);
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: personalToken,
          password: wizardData.password,
          guardians: wizardData.guardians, 
          learners: wizardData.learners,
          billing: wizardData.billing, // If it's LMS access, this just sends default values and safely does nothing
          agreements: wizardData.agreements
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to complete onboarding");

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#3b82f6', '#10b981', '#8b5cf6'] });
      setStep(6); 
    } catch (err: any) {
      alert("Something went wrong: " + err.message);
    } finally {
      setIsSubmittingWizard(false);
    }
  };

  // DYNAMIC VALIDATION LOGIC
  const isWizardNextDisabled = () => {
    if (step === 0) return !(pwdLength && pwdHasUpper && pwdHasNum && pwdMatch);
    if (step === 1) return wizardData.guardians.some(g => !g.removalRequested && (!g.name || !g.email));
    if (step === 2) return wizardData.learners.some(l => !l.removalRequested && !l.name);
    
    if (step === 4) {
      return requiredAgreements.some(req => {
        if (req.type === 'required_checkbox') return wizardData.agreements[req.id] !== true;
        if (req.type === 'yes_no') return wizardData.agreements[req.id] === null || wizardData.agreements[req.id] === undefined;
        return false;
      });
    }
    
    return false;
  };

  // ============================================================================
  // RENDER: WIZARD (Active if Token Exists)
  // ============================================================================
  if (personalToken && !isInitializing) {
    const slideVariants = {
      enter: { x: 50, opacity: 0, scale: 0.98 },
      center: { x: 0, opacity: 1, scale: 1 },
      exit: { x: -50, opacity: 0, scale: 0.98 }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans selection:bg-blue-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50 to-slate-50 -z-10" />
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-200/40 rounded-full blur-[100px] pointer-events-none -z-10" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-200/40 rounded-full blur-[100px] pointer-events-none -z-10" />

        <div className="w-full max-w-2xl relative z-10">
          
          <div className="flex justify-center mb-8">
             <Image src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png" alt="RAD Academy" width={150} height={45} unoptimized />
          </div>

          {step < 6 && (
            <div className="mb-8 flex items-center justify-center gap-2">
              {wizardSteps.map((s, idx) => {
                const currentVisualIndex = wizardSteps.indexOf(step);
                const isActive = idx === currentVisualIndex;
                const isPast = idx < currentVisualIndex;
                return (
                  <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${isActive ? 'w-12 bg-blue-600' : isPast ? 'w-6 bg-blue-300' : 'w-6 bg-slate-200'}`} />
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
            <div className="p-8 md:p-12">
              <AnimatePresence mode="wait" custom={step}>
                <motion.div key={step} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                  
                  {/* STEP 0: Auth */}
                  {step === 0 && (
                    <div className="space-y-8">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-blue-100"><Sparkles size={28} /></div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                          Welcome{wizardData.guardians[0]?.name ? `, ${wizardData.guardians[0].name.split(' ')[0]}` : ' to RAD Academy'}!
                        </h1>
                        <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">We are thrilled to have your family join us. Let's secure your account and personalize your pioneer's journey.</p>
                      </div>
                      <div className="bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-100 space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                          <Lock className="text-blue-500" size={20} /><h3 className="font-bold text-slate-900">Secure Your Account</h3>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Create Password</label>
                              <input type="password" value={wizardData.password} onChange={e => setWizardData({...wizardData, password: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" placeholder="••••••••" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Confirm Password</label>
                              <input type="password" value={wizardData.confirmPassword} onChange={e => setWizardData({...wizardData, confirmPassword: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" placeholder="••••••••" />
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm mt-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Security Requirements</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                              <div className={`flex items-center gap-2.5 transition-colors ${pwdLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {pwdLength ? <CheckCircle2 size={16} className="text-emerald-500"/> : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0"/>}
                                At least 8 Characters
                              </div>
                              <div className={`flex items-center gap-2.5 transition-colors ${pwdHasUpper ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {pwdHasUpper ? <CheckCircle2 size={16} className="text-emerald-500"/> : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0"/>}
                                1 Uppercase Letter
                              </div>
                              <div className={`flex items-center gap-2.5 transition-colors ${pwdHasNum ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {pwdHasNum ? <CheckCircle2 size={16} className="text-emerald-500"/> : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0"/>}
                                1 Number
                              </div>
                              <div className={`flex items-center gap-2.5 transition-colors ${pwdMatch ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {pwdMatch ? <CheckCircle2 size={16} className="text-emerald-500"/> : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0"/>}
                                Passwords Match
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 1: Guardians */}
                  {step === 1 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3"><User className="text-emerald-500" /> Verify Your Details</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Please confirm we have the correct contact information for you.</p>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                        {wizardData.guardians.map((g, idx) => (
                          <button 
                            key={g.id}
                            onClick={() => setActiveGuardianTab(idx)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                              activeGuardianTab === idx 
                                ? (g.removalRequested ? 'bg-rose-500 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md') 
                                : (g.removalRequested ? 'bg-rose-50 border border-rose-200 text-rose-400 opacity-60' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50')
                            }`}
                          >
                            {g.removalRequested && <AlertTriangle size={12} />}
                            {g.isPrimary && !g.removalRequested && <Star size={12} className={activeGuardianTab === idx ? "text-emerald-200" : "text-amber-400"} />}
                            {g.name ? g.name.split(' ')[0] : `Guardian ${idx + 1}`}
                          </button>
                        ))}
                        <button onClick={handleAddGuardian} className="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap border border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-1.5">
                          <Plus size={14} /> Add Guardian
                        </button>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div 
                          key={activeGuardianTab}
                          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                          className={`border rounded-3xl p-6 shadow-sm space-y-5 relative overflow-hidden transition-colors ${wizardData.guardians[activeGuardianTab].removalRequested ? 'bg-rose-50/30 border-rose-200' : 'bg-white border-slate-200'}`}
                        >
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${wizardData.guardians[activeGuardianTab].removalRequested ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          
                          {wizardData.guardians[activeGuardianTab].removalRequested ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                              <div className="w-16 h-16 bg-white text-rose-500 rounded-full flex items-center justify-center border border-rose-100 shadow-sm"><ShieldCheck size={28}/></div>
                              <div>
                                <h3 className="text-xl font-black uppercase italic text-slate-900">Removal Requested</h3>
                                <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto mt-2 leading-relaxed">
                                  A request has been sent to our team to safely remove this guardian.
                                </p>
                              </div>
                              <button 
                                onClick={() => {
                                  const ng = [...wizardData.guardians];
                                  ng[activeGuardianTab].removalRequested = false;
                                  setWizardData({...wizardData, guardians: ng});
                                }} 
                                className="mt-4 px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                              >
                                Undo Request
                              </button>
                            </div>
                          ) : (
                            <>
                              {!wizardData.guardians[activeGuardianTab].isPrimary && (
                                <button 
                                  onClick={() => handleRemoveGuardian(activeGuardianTab)}
                                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove this guardian"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}

                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Full Name</label>
                                <input 
                                  type="text" 
                                  value={wizardData.guardians[activeGuardianTab].name} 
                                  onChange={e => { const ng = [...wizardData.guardians]; ng[activeGuardianTab].name = e.target.value; setWizardData({...wizardData, guardians: ng}); }} 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all pr-12" 
                                />
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Email Address</label>
                                  <input 
                                    type="email" 
                                    value={wizardData.guardians[activeGuardianTab].email} 
                                    onChange={e => { const ng = [...wizardData.guardians]; ng[activeGuardianTab].email = e.target.value; setWizardData({...wizardData, guardians: ng}); }} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:border-emerald-500 outline-none transition-all" 
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Mobile Number</label>
                                  <input 
                                    type="tel" 
                                    value={wizardData.guardians[activeGuardianTab].phone} 
                                    onChange={e => { const ng = [...wizardData.guardians]; ng[activeGuardianTab].phone = e.target.value; setWizardData({...wizardData, guardians: ng}); }} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:border-emerald-500 outline-none transition-all" 
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}

                  {/* STEP 2: Learner */}
                  {step === 2 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3"><GraduationCap className="text-purple-500" /> Pioneer Details</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Tell us a bit about your child so we can tailor their experience.</p>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                        {wizardData.learners.map((l, idx) => (
                          <button 
                            key={l.id}
                            onClick={() => setActiveLearnerTab(idx)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                              activeLearnerTab === idx 
                                ? (l.removalRequested ? 'bg-rose-500 text-white shadow-md' : 'bg-purple-600 text-white shadow-md') 
                                : (l.removalRequested ? 'bg-rose-50 border border-rose-200 text-rose-400 opacity-60' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50')
                            }`}
                          >
                            {l.removalRequested && <AlertTriangle size={12} />}
                            {l.name ? l.name.split(' ')[0] : `Pioneer ${idx + 1}`}
                          </button>
                        ))}
                        <button onClick={handleAddLearner} className="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap border border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-1.5">
                          <Plus size={14} /> Add Child
                        </button>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div 
                          key={activeLearnerTab}
                          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                          className={`border rounded-3xl p-6 shadow-sm space-y-5 relative overflow-hidden transition-colors ${wizardData.learners[activeLearnerTab].removalRequested ? 'bg-rose-50/30 border-rose-200' : 'bg-white border-slate-200'}`}
                        >
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${wizardData.learners[activeLearnerTab].removalRequested ? 'bg-rose-500' : 'bg-purple-500'}`} />
                          
                          {wizardData.learners[activeLearnerTab].removalRequested ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                              <div className="w-16 h-16 bg-white text-rose-500 rounded-full flex items-center justify-center border border-rose-100 shadow-sm"><ShieldCheck size={28}/></div>
                              <div>
                                <h3 className="text-xl font-black uppercase italic text-slate-900">Removal Requested</h3>
                                <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto mt-2 leading-relaxed">
                                  A request has been sent to our team to safely remove this profile. This prevents accidental loss of historical learning data.
                                </p>
                              </div>
                              <button 
                                onClick={() => {
                                  const nl = [...wizardData.learners];
                                  nl[activeLearnerTab].removalRequested = false;
                                  setWizardData({...wizardData, learners: nl});
                                }} 
                                className="mt-4 px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                              >
                                Undo Request
                              </button>
                            </div>
                          ) : (
                            <>
                              {wizardData.learners.length > 1 && (
                                <button 
                                  onClick={() => handleRemoveLearner(activeLearnerTab)}
                                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove this child"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}

                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Learner Full Name</label>
                                <input type="text" value={wizardData.learners[activeLearnerTab].name} placeholder="e.g. Sarah Louw" onChange={e => { const nl = [...wizardData.learners]; nl[activeLearnerTab].name = e.target.value; setWizardData({...wizardData, learners: nl}); }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:border-purple-500 outline-none transition-all pr-12" />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Date of Birth</label>
                                  <input type="date" value={wizardData.learners[activeLearnerTab].dob} onChange={e => { const nl = [...wizardData.learners]; nl[activeLearnerTab].dob = e.target.value; setWizardData({...wizardData, learners: nl}); }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:border-purple-500 outline-none transition-all cursor-pointer" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Current Grade</label>
                                  <select value={wizardData.learners[activeLearnerTab].grade} onChange={e => { const nl = [...wizardData.learners]; nl[activeLearnerTab].grade = e.target.value; setWizardData({...wizardData, learners: nl}); }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:border-purple-500 outline-none transition-all cursor-pointer appearance-none">
                                    <option value="" disabled>Select Grade...</option>
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-slate-800 text-sm">School Coding Experience?</p>
                                  <p className="text-xs text-slate-500 font-medium">Does their school offer coding/robotics?</p>
                                </div>
                                <button type="button" onClick={() => { const nl = [...wizardData.learners]; nl[activeLearnerTab].schoolCoding = !nl[activeLearnerTab].schoolCoding; setWizardData({...wizardData, learners: nl}); }} className={`w-14 h-8 rounded-full transition-colors relative ${wizardData.learners[activeLearnerTab].schoolCoding ? 'bg-purple-500' : 'bg-slate-200'}`}>
                                  <motion.div layout className="w-6 h-6 bg-white rounded-full shadow-md absolute top-1" animate={{ left: wizardData.learners[activeLearnerTab].schoolCoding ? '30px' : '4px' }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                                </button>
                              </div>
                            </>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}

                  {/* STEP 3: Billing (HIDDEN FOR LMS ACCESS & BOOTCAMP PARENTS) */}
                  {step === 3 && !skipBilling && (
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3"><CreditCard className="text-blue-500" /> Tailor Your Billing</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Select a payment schedule that works best for your household.</p>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-3 block">Payment Frequency</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div onClick={() => setWizardData({...wizardData, billing: {...wizardData.billing, frequency: 'monthly'}})} className={`cursor-pointer p-5 rounded-3xl border-2 transition-all relative overflow-hidden ${wizardData.billing.frequency === 'monthly' ? 'border-blue-500 bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-blue-200 bg-white'}`}>
                              {wizardData.billing.frequency === 'monthly' && <CheckCircle2 className="absolute top-4 right-4 text-blue-500" size={20} />}
                              <p className="font-black text-slate-900 mb-1">Monthly</p>
                              <p className="text-xs text-slate-500 font-medium">Billed across 11 months.</p>
                            </div>
                            <div onClick={() => setWizardData({...wizardData, billing: {...wizardData.billing, frequency: 'termly'}})} className={`cursor-pointer p-5 rounded-3xl border-2 transition-all relative overflow-hidden ${wizardData.billing.frequency === 'termly' ? 'border-blue-500 bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-blue-200 bg-white'}`}>
                              {wizardData.billing.frequency === 'termly' && <CheckCircle2 className="absolute top-4 right-4 text-blue-500" size={20} />}
                              <span className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-b-lg">Discounted</span>
                              <p className="font-black text-slate-900 mb-1 mt-2">Termly (Upfront)</p>
                              <p className="text-xs text-slate-500 font-medium">Billed at start of term.</p>
                            </div>
                          </div>
                        </div>
                        <AnimatePresence>
                          {wizardData.billing.frequency === 'monthly' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-1 block mt-2">Preferred Payment Date</label>
                              <p className="text-[10px] text-slate-400 font-medium ml-1 mb-3 leading-relaxed">
                                This is the date by which you intend to make payment. Your invoice will be generated and emailed to you 10-14 days prior to this date.
                              </p>
                              <div className="grid grid-cols-3 gap-3">
                                {['1st', '15th', '25th'].map(day => (
                                  <div key={day} onClick={() => setWizardData({...wizardData, billing: {...wizardData.billing, date: day}})} className={`cursor-pointer py-3 text-center rounded-2xl border transition-all font-bold text-sm ${wizardData.billing.date === day ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    {day}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="bg-blue-50/50 p-4 rounded-2xl flex gap-3 border border-blue-100">
                        <Info className="text-blue-500 shrink-0" size={20} />
                        <p className="text-xs text-blue-800 leading-relaxed font-medium">Invoices generate automatically. You will receive an email with a secure PayFast link when ready.</p>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Agreements (DYNAMIC ENGINE) */}
                  {step === 4 && (
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3"><ShieldCheck className="text-emerald-500" /> Intake & Agreements</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">The final step! Please review and complete our core intake policies.</p>
                      </div>
                      <div className="space-y-5">
                        {requiredAgreements.map(policy => {
                          const val = wizardData.agreements[policy.id];

                          // RENDER: OPTIONAL TEXT
                          if (policy.type === 'optional_text') {
                            return (
                              <div key={policy.id} className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 space-y-3">
                                <div>
                                  <p className="font-bold text-slate-900 text-sm flex items-center gap-2">{policy.title} <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-black">Optional</span></p>
                                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{policy.description}</p>
                                </div>
                                <textarea 
                                  value={val || ''}
                                  onChange={e => setWizardData({...wizardData, agreements: {...wizardData.agreements, [policy.id]: e.target.value}})}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-medium focus:border-blue-500 outline-none transition-all resize-none text-sm"
                                  rows={3}
                                  placeholder="Type your response here..."
                                />
                              </div>
                            );
                          }

                          // RENDER: YES/NO CHOICE
                          if (policy.type === 'yes_no') {
                            return (
                              <div key={policy.id} className={`border-2 rounded-3xl p-5 md:p-6 transition-all ${val !== null ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{policy.title}</p>
                                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{policy.description}</p>
                                </div>
                                <div className="flex gap-3 mt-5">
                                  <button 
                                    onClick={() => setWizardData({...wizardData, agreements: {...wizardData.agreements, [policy.id]: true}})}
                                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border-2 flex items-center justify-center gap-2 ${val === true ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                  >
                                    <Check size={14} className={val === true ? 'block' : 'hidden'} /> Yes, I agree
                                  </button>
                                  <button 
                                    onClick={() => setWizardData({...wizardData, agreements: {...wizardData.agreements, [policy.id]: false}})}
                                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border-2 flex items-center justify-center gap-2 ${val === false ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300'}`}
                                  >
                                    <X size={14} className={val === false ? 'block' : 'hidden'} /> No, I decline
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          // RENDER: REQUIRED CHECKBOX
                          return (
                            <label key={policy.id} className={`flex items-start gap-4 p-5 md:p-6 rounded-3xl border-2 cursor-pointer transition-all ${val ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-emerald-200 bg-white'}`}>
                              <div className={`mt-0.5 flex items-center justify-center w-6 h-6 rounded border-2 transition-colors shrink-0 ${val ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                <input 
                                  type="checkbox" 
                                  className="sr-only" 
                                  checked={val || false} 
                                  onChange={e => setWizardData({...wizardData, agreements: {...wizardData.agreements, [policy.id]: e.target.checked}})} 
                                />
                                <Check size={14} className={`text-white transition-opacity ${val ? 'opacity-100' : 'opacity-0'}`} strokeWidth={4} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{policy.title}</p>
                                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{policy.description}</p>
                              </div>
                            </label>
                          )
                        })}
                        {requiredAgreements.length === 0 && (
                          <div className="text-center py-10 border border-dashed border-slate-200 rounded-3xl">
                            <p className="text-slate-500 font-bold italic">No specific agreements are required for your selected plan.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 5: Success */}
                  {step === 6 && (
                    <div className="text-center space-y-6 py-10">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border-4 border-white shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 size={48} />
                      </motion.div>
                      <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">You're All Set!</h2>
                      <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">Your profile is fully configured. Welcome to the RAD Academy family!</p>
                      <button onClick={() => window.location.href = '/login'} className="mt-8 w-full md:w-auto px-10 py-4 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg flex items-center justify-center gap-2 mx-auto">
                        Go to Parent Dashboard <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Nav */}
            {step < 6 && (
              <div className="bg-slate-50 border-t border-slate-100 p-6 md:px-12 flex items-center justify-between">
                {step > 0 ? (
                  <button onClick={handleBack} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"><ArrowLeft size={16} /> Back</button>
                ) : <div />}
                
                {step !== wizardSteps[wizardSteps.length - 1] ? (
                  <button onClick={handleNext} disabled={isWizardNextDisabled()} className="bg-slate-900 hover:bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md">
                    Continue <ChevronRight size={16} />
                  </button>
                ) : (
                  <button onClick={handleCompleteWizard} disabled={isWizardNextDisabled() || isSubmittingWizard} className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
                    {isSubmittingWizard ? "Transmitting..." : "Submit"} <Sparkles size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: GATEWAY (Active if NO Token) - Fully Light Theme Adapted
  // ============================================================================
  if (isInitializing) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;

  const content = {
    current: {
      badge: "System Update: RAD LMS v2.0 is Live",
      title: "Welcome to the<br/>New Platform.",
      subtitle: "We've built a brand new digital learning environment for our students. Your account is already active and ready to go.",
      objectiveTitle: "Check Your Email",
      objectiveText: "You have been sent a personalized, secure link. Click it to set your password and access your new dashboard immediately.",
      objectiveNote: "Can't find it? Check your spam folder or reach out via WhatsApp.",
    },
    past: {
      badge: "Welcome Back",
      title: "Continue Your<br/>Learning.",
      subtitle: "Welcome back! You can access our lesson material on a 1-month trial basis before deciding to fully register.",
      objectiveTitle: "Start Your 1-Month Trial",
      objectiveText: "Click below to request LMS Access. We will set up your dashboard so your child can get started.",
      objectiveNote: "Your trial starts as soon as your account is activated.",
    },
    new: {
      badge: "Welcome to RAD Academy",
      title: "Start Your Tech<br/>Journey.",
      subtitle: "Our platform gives your child access to interactive coding lessons, project tracking, and mentorship.",
      objectiveTitle: "Start Your 7-Day Trial",
      objectiveText: "Click below to request Demo LMS Access. No prior coding experience is required.",
      objectiveNote: "We teach everything from scratch.",
    }
  };
  const activeContent = pathway ? content[pathway] : content.current;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30 overflow-x-hidden relative flex flex-col">
      
      {/* 1. GATEWAY MODAL (Plain English Options) */}
      <AnimatePresence>
        {!pathway && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-50/95 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
              className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-[32px] md:rounded-[48px] p-6 md:p-16 shadow-2xl z-10 max-h-[90vh] overflow-y-auto flex flex-col"
            >
              <div className="text-center mb-8 md:mb-12 shrink-0">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 mx-auto mb-6 shadow-inner">
                  <ShieldCheck size={28} className="text-blue-600" />
                </div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Welcome</h2>
                <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">Select Your Status</h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pb-4">
                <button onClick={() => setPathway("current")} className="group p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-white border-2 border-slate-100 hover:border-blue-500 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2 text-left">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 md:mb-6 group-hover:scale-110 transition-transform"><Zap size={24} /></div>
                  <h3 className="text-lg md:text-xl font-black uppercase italic text-slate-900 mb-2">Currently Enrolled</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">I am currently registered and actively taking classes at RAD Academy.</p>
                </button>

                <button onClick={() => setPathway("past")} className="group p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-white border-2 border-slate-100 hover:border-purple-500 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2 text-left">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 md:mb-6 group-hover:scale-110 transition-transform"><RotateCcw size={24} /></div>
                  <h3 className="text-lg md:text-xl font-black uppercase italic text-slate-900 mb-2">Returning Parent</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">I have registered in the past, and I want to see what is new.</p>
                </button>

                <button onClick={() => setPathway("new")} className="group p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-white border-2 border-slate-100 hover:border-emerald-500 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2 text-left">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 md:mb-6 group-hover:scale-110 transition-transform"><UserPlus size={24} /></div>
                  <h3 className="text-lg md:text-xl font-black uppercase italic text-slate-900 mb-2">New to RAD</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">I am brand new to RAD Academy and want to learn more.</p>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. NAVIGATION */}
      <nav className="relative z-50 p-6 md:p-10 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="relative w-[100px] md:w-[120px]">
          <Image src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png" alt="RAD Academy Logo" width={120} height={40} priority unoptimized style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <Link href="/" className="px-5 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm">
          Main Site
        </Link>
      </nav>

      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 py-12">
        <AnimatePresence mode="wait">
          {pathway && (
            <motion.div key="redirect" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl text-center space-y-8 bg-white border border-slate-200 p-8 md:p-12 rounded-[48px] shadow-xl">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-600 mb-2">
                  <Star size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeContent.badge}</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900" dangerouslySetInnerHTML={{ __html: activeContent.title }} />
                <p className="text-slate-500 text-base md:text-lg leading-relaxed">{activeContent.subtitle}</p>
              </div>
              
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 md:p-8 mt-6">
                 <h4 className="text-xl font-black uppercase italic text-slate-900 mb-3">{activeContent.objectiveTitle}</h4>
                 <p className="text-sm text-slate-500 mb-6">{activeContent.objectiveText}</p>
                 
                 {pathway === "current" ? (
                   <div className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-blue-50 text-blue-700 font-bold text-sm w-full sm:w-auto border border-blue-100">
                     <Mail size={18}/> Check your inbox
                   </div>
                 ) : (
                   <button onClick={() => handleOpenRegister("Demo LMS Access")} className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-sm hover:bg-blue-600 transition-all shadow-xl hover:-translate-y-1 w-full sm:w-auto">
                     Request LMS Access <ChevronRight size={16} />
                   </button>
                 )}
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">{activeContent.objectiveNote}</p>
              </div>

              <div className="pt-4">
                <button onClick={() => setPathway(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
                  &larr; Change Status
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. FAQs */}
      <section className="py-20 px-8 border-t border-slate-200 bg-white relative z-10">
        <div className="max-w-5xl mx-auto w-full space-y-12">
          <div className="text-center space-y-3">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Got Questions?</h3>
             <p className="text-3xl font-black uppercase italic tracking-tight text-slate-900">Frequently Asked Questions</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {LAUNCH_FAQS.map((faq, i) => {
              const Icon = faq.icon;
              const isActive = activeFaq === i;
              return (
                <div key={i} className={`bg-white border-2 rounded-[32px] p-8 space-y-4 cursor-pointer transition-all ${isActive ? 'border-blue-500 shadow-md' : 'border-slate-100 hover:border-slate-300'}`} onClick={() => setActiveFaq(isActive ? null : i)}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${faq.bg} ${faq.color}`}><Icon size={20} /></div>
                      <h4 className="text-lg font-black uppercase italic tracking-widest text-slate-900">{faq.title}</h4>
                    </div>
                    <motion.div animate={{ rotate: isActive ? 180 : 0 }} className="text-slate-400"><ChevronRight size={18} /></motion.div>
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <p className="text-slate-500 text-sm font-medium leading-relaxed pt-4 pl-1">{faq.details}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. REGISTRATION MODAL */}
      <AnimatePresence>
        {isRegisterOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white border border-slate-200 rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100 bg-slate-50 shrink-0">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Enrollment Hub</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Register your interest</p>
                </div>
                <button onClick={() => setIsRegisterOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-all"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white">
                {submitSuccess ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12">
                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center border border-green-200"><ShieldCheck size={40} /></div>
                    <div>
                      <h4 className="text-2xl font-black uppercase italic text-slate-900 mb-2">Request Received</h4>
                      <p className="text-slate-500 font-medium">Thank you for registering! Our team will contact you shortly.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleGatewaySubmit} className="space-y-8">
                    {formError && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold">{formError}</div>}
                    <div className="hidden" aria-hidden="true"><input type="text" value={gatewayData.botField} onChange={e => setGatewayData({...gatewayData, botField: e.target.value})} tabIndex={-1} autoComplete="off" /></div>
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><Users size={16} className="text-blue-500" /><h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Guardian Details</h4></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Parent Name *</label><input required type="text" value={gatewayData.parentName} onChange={e => setGatewayData({...gatewayData, parentName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-colors" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact Number *</label><input required type="tel" value={gatewayData.phone} onChange={e => setGatewayData({...gatewayData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-colors" /></div>
                        <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email Address *</label><input required type="email" value={gatewayData.email} onChange={e => setGatewayData({...gatewayData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-colors" /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Student Name *</label><input required type="text" value={gatewayData.studentName} onChange={e => setGatewayData({...gatewayData, studentName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-colors" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Student Age *</label><input required type="number" min="5" max="18" value={gatewayData.studentAge} onChange={e => setGatewayData({...gatewayData, studentAge: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-colors" /></div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><Star size={16} className="text-amber-400" /><h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Programs of Interest *</h4></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ALL_PROGRAM_OPTIONS.map((prog) => {
                          const isSelected = gatewayData.selectedPrograms.includes(prog);
                          return (
                            <div key={prog} className={`flex flex-col p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-500 shadow-sm text-blue-900' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200'}`} onClick={() => toggleProgram(prog)}>
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 shrink-0">{isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} className="text-slate-300" />}</div>
                                <span className={`text-sm font-bold leading-snug ${isSelected ? 'text-slate-900' : ''}`}>{prog}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <button type="submit" disabled={isSubmittingGateway} className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg">
                        {isSubmittingGateway ? <><Loader2 size={18} className="animate-spin" /> Transmitting...</> : "Submit Registration"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-slate-200 py-8 text-center relative z-10 bg-slate-50">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">RAD Academy Portal // © {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}