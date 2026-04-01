"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Loader2, CheckCircle2, ShieldCheck, 
  ChevronRight, AlertCircle, Plus, Trash2, 
  BellRing, Shield, ChevronDown, GraduationCap, RotateCcw, UserCircle, Key
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const RELATIONSHIP_OPTIONS = ["Mom", "Dad", "Guardian", "Other"];

interface AdditionalGuardian {
  id?: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  isPrimaryContact: boolean;
}

interface StudentData {
  id?: string;
  name: string;
  dob: string;
  username: string;
  pin: string;
  _originalMetadata?: any;
}

export default function GuardianOnboarding() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>}>
      <GuardianWizardCore />
    </Suspense>
  );
}

function GuardianWizardCore() {
  const searchParams = useSearchParams();
  const guardianId = searchParams.get("id");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [originalData, setOriginalData] = useState<any>(null);
  const [initialFormData, setInitialFormData] = useState<any>(null); 
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    relationship: "",
    isPrimaryContact: true,
    additionalGuardians: [] as AdditionalGuardian[],
    students: [] as StudentData[],
    paymentPlan: "" // Kept in state to prevent DB errors if expected, but not used in UI
  });
  
  useEffect(() => {
    async function fetchHousehold() {
      if (!guardianId) {
        setError("Invalid link. Please check your invitation email.");
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch Lead Guardian
        const { data: profile, error: fetchErr } = await supabase.from('profiles').select('*').eq('id', guardianId).single();
        if (fetchErr || !profile) throw new Error("Not found");

        // 2. Fetch Students linked to this Guardian
        const { data: kids } = await supabase.from('profiles').select('*').eq('linked_parent_id', guardianId);
        
        // 3. Fetch Additional Guardians linked to this Guardian
        const { data: crew } = await supabase.from('profiles').select('*').eq('metadata->>household_lead_id', guardianId);

        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});

        const formattedCrew = (crew || []).map(c => {
          const cMeta = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : (c.metadata || {});
          return {
            id: c.id,
            name: c.display_name || "",
            email: cMeta?.email || "",
            phone: cMeta?.phone || "",
            relationship: cMeta?.relationship || "",
            isPrimaryContact: cMeta?.is_primary_contact ?? false
          }
        });

        const formattedStudents = (kids || []).map(k => {
          const kMeta = typeof k.metadata === 'string' ? JSON.parse(k.metadata) : (k.metadata || {});
          return {
            id: k.id,
            name: k.display_name || "",
            // Pull from top-level DB column first, fallback to metadata
            dob: k.date_of_birth || kMeta?.date_of_birth || "",
            username: k.student_identifier || kMeta?.username || "",
            pin: k.temp_entry_pin || "",
            _originalMetadata: kMeta
          };
        });

        const initial = {
          name: profile.display_name || "",
          email: meta?.email || "",
          phone: meta?.phone || "",
          relationship: meta?.relationship || "",
          isPrimaryContact: meta?.is_primary_contact ?? true,
          paymentPlan: profile.payment_plan_preference || "",
          additionalGuardians: formattedCrew,
          students: formattedStudents,
        };

        if (meta?.account_tier === 'demo') {
           initial.paymentPlan = 'demo'; 
        }

        setOriginalData({ ...profile, metadata: meta });
        setInitialFormData(initial);
        setFormData(prev => ({ ...prev, ...initial }));
      } catch (err) {
        setError("Could not load your profile. Please contact support.");
      } finally {
        setLoading(false);
      }
    }
    fetchHousehold();
  }, [guardianId]);

  const handleReset = () => {
    if (initialFormData) {
      setFormData(initialFormData);
      alert("Form changes have been cleared.");
    }
  };

  const addGuardian = () => {
    setFormData(prev => ({
      ...prev,
      additionalGuardians: [...prev.additionalGuardians, { name: "", email: "", phone: "", relationship: "", isPrimaryContact: false }]
    }));
  };

  const setPrimary = (index: number | 'main') => {
    const nextMain = index === 'main';
    const nextAdditional = formData.additionalGuardians.map((g: AdditionalGuardian, i: number) => ({
      ...g,
      isPrimaryContact: i === index
    }));
    setFormData(prev => ({ ...prev, isPrimaryContact: nextMain, additionalGuardians: nextAdditional }));
  };

  const deleteAdditionalGuardian = async (index: number) => {
    const member = formData.additionalGuardians[index];
    if (member.id) {
       const confirmDelete = window.confirm(`Remove ${member.name || 'this person'} from your account?`);
       if (!confirmDelete) return;
       setIsSubmitting(true);
       try { await supabase.from('profiles').delete().eq('id', member.id); } 
       catch (err) { alert("Failed to remove. Please try again."); setIsSubmitting(false); return; }
       setIsSubmitting(false);
    }
    const next = formData.additionalGuardians.filter((_: any, idx: number) => idx !== index);
    setFormData((prev:any) => ({...prev, additionalGuardians: next}));
  };

  const addStudent = () => {
    setFormData(prev => ({
      ...prev,
      students: [...prev.students, { name: "", dob: "", username: "", pin: "" }]
    }));
  };

  const deleteStudent = async (index: number) => {
    const kid = formData.students[index];
    if (kid.id) {
       const confirmDelete = window.confirm(`Remove ${kid.name || 'this student'} from enrollment?`);
       if (!confirmDelete) return;
       setIsSubmitting(true);
       try { await supabase.from('profiles').delete().eq('id', kid.id); } 
       catch (err) { alert("Failed to remove student."); setIsSubmitting(false); return; }
       setIsSubmitting(false);
    }
    const next = formData.students.filter((_: any, idx: number) => idx !== index);
    setFormData((prev:any) => ({...prev, students: next}));
  };

  // --- SUBMISSION WITH SMART UPSERTS ---
  const handleUpdate = async () => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      const targetFunnelStage = formData.paymentPlan === 'demo' ? "Onboarding (Trial LMS)" : "Active (Paid Client)";
      
      // 1. Update Lead Guardian
      const { error: guardErr } = await supabase.from('profiles').update({
        display_name: formData.name,
        payment_plan_preference: formData.paymentPlan,
        updated_at: now,
        metadata: {
          ...originalData.metadata,
          email: formData.email,
          phone: formData.phone,
          relationship: formData.relationship,
          is_primary_contact: formData.isPrimaryContact,
          onboarding_status: 'completed',
          funnel_stage: targetFunnelStage,
          funnel_stage_updated_at: now
        }
      }).eq('id', guardianId);
      if (guardErr) throw guardErr;

      // Sync the funnel stage back to the registrations table for the Leads CRM
      await supabase.from('registrations').update({
         metadata: { funnel_stage: targetFunnelStage, funnel_stage_updated_at: now }
      }).eq('email', formData.email);

      // 2. Process Additional Guardians
      for (const member of formData.additionalGuardians) {
         const memberPayload = {
            role: 'guardian',
            display_name: member.name,
            status: 'active',
            updated_at: now,
            metadata: {
               email: member.email,
               phone: member.phone,
               relationship: member.relationship,
               is_primary_contact: member.isPrimaryContact,
               household_lead_id: guardianId 
            }
         };

         if (member.id) {
            await supabase.from('profiles').update(memberPayload).eq('id', member.id);
         } else if (member.name && member.email) {
            // Anti-Duplication Check
            const { data: existingGuardian } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'guardian')
              .eq('metadata->>email', member.email)
              .maybeSingle();

            if (existingGuardian) {
               await supabase.from('profiles').update(memberPayload).eq('id', existingGuardian.id);
            } else {
               await supabase.from('profiles').insert({ ...memberPayload, created_at: now });
            }
         }
      }

      // 3. Process Students
      for (const kid of formData.students) {
         const kidPayload = {
            role: 'student',
            display_name: kid.name,
            linked_parent_id: guardianId,
            status: 'active',
            temp_entry_pin: kid.pin, 
            date_of_birth: kid.dob || null, // Map directly to top-level DB column
            student_identifier: kid.username || null, // Map directly to top-level DB column
            updated_at: now,
            metadata: {
               ...(kid._originalMetadata || {}),
               date_of_birth: kid.dob,
               username: kid.username
            }
         };

         if (kid.id) {
            await supabase.from('profiles').update(kidPayload).eq('id', kid.id);
         } else if (kid.name) {
            // Anti-Duplication Check
            const { data: existingStudent } = await supabase
              .from('profiles')
              .select('id')
              .eq('linked_parent_id', guardianId)
              .ilike('display_name', kid.name) // Check by name within this household
              .maybeSingle();

            if (existingStudent) {
               await supabase.from('profiles').update(kidPayload).eq('id', existingStudent.id);
            } else {
               await supabase.from('profiles').insert({ ...kidPayload, created_at: now });
            }
         }
      }

      setStep(4);
    } catch (err) {
      alert("An error occurred submitting your details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allGuardiansHaveRole = formData.additionalGuardians.every(g => g.relationship !== "");
  const allStudentsValid = formData.students.every(p => p.name.trim() !== "" && p.username.trim() !== "" && p.pin.trim() !== "");
  const isDemoAccount = originalData?.metadata?.account_tier === 'demo';

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (error) return <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6"><AlertCircle size={48} className="text-red-500 mb-4"/><h2 className="text-2xl font-bold mb-2">Access Denied</h2><p className="text-slate-400 text-sm">{error}</p></div>;

  return (
    <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 font-sans selection:bg-blue-500/30 text-left py-12">
      <div className="max-w-2xl w-full space-y-6">
        
        {/* Progress Bar */}
        <div className="flex justify-between items-center px-2">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Step {step} of 3</span>
            <div className="flex gap-1">
                {[1, 2, 3].map(i => <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? "w-8 bg-blue-500" : "w-2 bg-white/10"}`} />)}
            </div>
        </div>

        <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: GUARDIAN DETAILS */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="space-y-2 border-b border-white/10 pb-6">
                  <h2 className="text-3xl font-bold text-white">Parent & Guardian Details</h2>
                  <p className="text-slate-400 text-sm">Please review and confirm your contact information.</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-sm uppercase tracking-wide">
                      <Shield size={16}/> Primary Guardian
                    </div>
                    <button onClick={() => setPrimary('main')} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${formData.isPrimaryContact ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                      <BellRing size={14}/> {formData.isPrimaryContact ? 'Primary Contact' : 'Set as Primary Contact'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Full Name</label>
                      <input className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Relationship</label>
                      <div className="relative">
                        <select className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm appearance-none focus:border-blue-500 transition-all outline-none" value={formData.relationship} onChange={e => setFormData({...formData, relationship: e.target.value})}>
                          <option value="" disabled>Select Relationship</option>
                          {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Email Address</label>
                        <input className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phone Number</label>
                        <input className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2 pt-4">
                    <span className="text-sm font-bold text-white">Additional Parent/Guardian (Optional)</span>
                    <button onClick={addGuardian} className="text-xs font-bold text-blue-400 bg-blue-500/10 px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all">+ Add Person</button>
                  </div>

                  {formData.additionalGuardians.map((g: AdditionalGuardian, i: number) => (
                    <div key={g.id || i} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative group mt-4">
                      <button onClick={() => deleteAdditionalGuardian(i)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 transition-all hover:bg-red-500 hover:text-white"><Trash2 size={14}/></button>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="col-span-1 md:col-span-2 flex justify-between items-center border-b border-white/5 pb-4 mb-2">
                            <div className="space-y-2 flex-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Relationship to Student</label>
                              <div className="relative max-w-[250px]">
                                  <select className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm appearance-none focus:border-blue-500 transition-all outline-none" value={g.relationship} onChange={e => {
                                      const next = [...formData.additionalGuardians];
                                      next[i].relationship = e.target.value;
                                      setFormData({...formData, additionalGuardians: next});
                                  }}>
                                      <option value="" disabled>Select Relationship</option>
                                      {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                              </div>
                            </div>
                            
                            <button onClick={() => setPrimary(i)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all mt-4 ${g.isPrimaryContact ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                                <BellRing size={14}/> {g.isPrimaryContact ? 'Primary Contact' : 'Set as Primary Contact'}
                            </button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Full Name</label>
                          <input placeholder="Name" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" value={g.name} onChange={e => {
                              const next = [...formData.additionalGuardians];
                              next[i].name = e.target.value;
                              setFormData({...formData, additionalGuardians: next});
                          }} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phone Number</label>
                          <input placeholder="Phone" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" value={g.phone} onChange={e => {
                              const next = [...formData.additionalGuardians];
                              next[i].phone = e.target.value;
                              setFormData({...formData, additionalGuardians: next});
                          }} />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Email Address</label>
                          <input placeholder="Email" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" value={g.email} onChange={e => {
                              const next = [...formData.additionalGuardians];
                              next[i].email = e.target.value;
                              setFormData({...formData, additionalGuardians: next});
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => setStep(2)} disabled={!formData.name || !formData.email || !allGuardiansHaveRole || !formData.relationship} className="w-full py-4 bg-blue-600 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:bg-blue-500 transition-all disabled:opacity-50">
                  Next: Student Details <ChevronRight size={18}/>
                </button>
              </motion.div>
            )}

            {/* STEP 2: STUDENTS */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="space-y-2 border-b border-white/10 pb-6">
                  <h2 className="text-3xl font-bold text-white">Student Details</h2>
                  <p className="text-slate-400 text-sm">Please confirm the details and set up login credentials for the student(s).</p>
                </div>

                <div className="space-y-6">
                  {formData.students.map((kid: StudentData, i: number) => (
                    <div key={kid.id || i} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative group">
                      <button onClick={() => deleteStudent(i)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"><Trash2 size={14}/></button>
                      
                      <div className="flex items-center gap-2 text-blue-400 border-b border-white/5 pb-4 mb-4 font-bold text-sm uppercase tracking-wide">
                        <GraduationCap size={16}/> Student {i + 1}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Full Name</label>
                          <input className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" value={kid.name} onChange={e => {
                              const next = [...formData.students];
                              next[i].name = e.target.value;
                              setFormData({...formData, students: next});
                          }} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">Date of Birth <span className="text-slate-500 normal-case font-normal">(Optional)</span></label>
                          <input type="date" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none text-white" value={kid.dob} onChange={e => {
                              const next = [...formData.students];
                              next[i].dob = e.target.value;
                              setFormData({...formData, students: next});
                          }} />
                        </div>
                        
                        <div className="space-y-2 pt-2 md:pt-0">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            <UserCircle size={14}/> Profile Username
                          </label>
                          <input 
                            placeholder="e.g. CodeNinja99"
                            className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none" 
                            value={kid.username} 
                            onChange={e => {
                              const next = [...formData.students];
                              next[i].username = e.target.value;
                              setFormData({...formData, students: next});
                            }} 
                          />
                        </div>
                        <div className="space-y-2 pt-2 md:pt-0">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            <Key size={14}/> Secure Access PIN
                          </label>
                          <input 
                            type="text" 
                            maxLength={4}
                            placeholder="4-Digit Code"
                            className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-all outline-none tracking-widest" 
                            value={kid.pin} 
                            onChange={e => {
                              const next = [...formData.students];
                              next[i].pin = e.target.value.replace(/[^0-9]/g, '');
                              setFormData({...formData, students: next});
                            }} 
                          />
                        </div>

                      </div>
                    </div>
                  ))}
                  
                  <button onClick={addStudent} className="w-full py-4 border border-dashed border-white/20 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                    <Plus size={16}/> Add Another Student
                  </button>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setStep(1)} className="py-4 px-6 bg-white/5 rounded-xl font-bold text-slate-300 hover:text-white transition-all">Back</button>
                  <button onClick={() => setStep(3)} disabled={formData.students.length === 0 || !allStudentsValid} className="flex-1 py-4 bg-blue-600 rounded-xl font-bold text-white hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    Next: Review Details <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: REVIEW */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="space-y-2 border-b border-white/10 pb-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-white">Review Details</h2>
                    <button onClick={handleReset} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-2 rounded-lg">
                      <RotateCcw size={14}/> Reset Form
                    </button>
                  </div>
                  <p className="text-slate-400 text-sm mt-2">Please verify the information below before finalizing your registration.</p>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                   <div className="flex justify-between items-center text-sm"><span className="text-slate-400 font-bold">Primary Contact:</span> <span className="text-white font-bold">{formData.name} ({formData.relationship})</span></div>
                   
                   {formData.additionalGuardians.length > 0 && (
                     <div className="flex justify-between items-center text-sm"><span className="text-slate-400 font-bold">Additional Contacts:</span> <span className="text-white font-bold">{formData.additionalGuardians.length} Person(s)</span></div>
                   )}

                   {isDemoAccount && (
                     <div className="flex justify-between items-center text-sm pt-4 border-t border-white/10"><span className="text-slate-400 font-bold">Registration Type:</span> <span className="text-purple-400 font-bold uppercase">LMS Access</span></div>
                   )}
                   
                   {/* Student Summary */}
                   <div className="pt-4 border-t border-white/10 space-y-3">
                     <span className="text-slate-400 font-bold text-sm">Student(s):</span>
                     <div className="flex flex-col gap-2 mt-2">
                       {formData.students.map((p, i) => (
                         <div key={i} className="flex items-center justify-between bg-[#020617] px-4 py-3 rounded-lg border border-white/5">
                           <span className="font-bold text-white text-sm">{p.name || 'Unnamed Student'}</span>
                           {p.username && <span className="text-slate-400 text-xs font-medium bg-white/5 px-2 py-1 rounded-md">@{p.username}</span>}
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setStep(2)} className="py-4 px-6 bg-white/5 rounded-xl font-bold text-slate-300 hover:text-white transition-all">Back</button>
                  <button onClick={handleUpdate} disabled={isSubmitting} className="flex-1 py-4 bg-blue-600 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:bg-blue-500 transition-all disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="animate-spin"/> : "Submit Registration"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: SUCCESS */}
            {step === 4 && (
              <motion.div key="s4" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12 space-y-6">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-500 mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h2 className="text-3xl font-bold text-white">Registration Complete</h2>
                  <p className="text-slate-400 text-base max-w-md mx-auto">
                    Thank you for confirming your details. Your account has been successfully updated and your household is now active.
                  </p>
                  <div className="pt-8">
                    <button onClick={() => window.location.href = 'https://radacademy.co.za'} className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-white hover:bg-white/10 transition-all">
                      Return to Website
                    </button>
                  </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}