"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, ArrowRight, Zap, CheckCircle2, Loader2, LayoutDashboard, Map as MapIcon, 
  Cpu, ExternalLink, ShieldAlert, Lock, Camera, X, ListTodo, Edit2
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { calculateDiminishingXP } from "@/lib/xp-engine";

type UIPhase = 'loading' | 'intro' | 'select-input' | 'select-output' | 'training' | 'workspace' | 'capture' | 'success';

interface SandboxState {
  stage: 'standard' | 'advanced_mix' | 'free_reign';
  used_inputs: string[];
  used_outputs: string[];
}

export default function MakecodeSandboxPage() {
  const { course_id } = useParams();
  const router = useRouter();
  
  const [phase, setPhase] = useState<UIPhase>('loading');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hardware, setHardware] = useState<any[]>([]);
  const [tutorials, setTutorials] = useState<any[]>([]);
  
  // Sandbox State Management
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [sandboxState, setSandboxState] = useState<SandboxState>({ stage: 'standard', used_inputs: [], used_outputs: [] });
  
  // Active Build State
  const [selectedInput, setSelectedInput] = useState<any | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<any | null>(null);
  
  // Training Progress
  const [trainingTab, setTrainingTab] = useState<'input' | 'output'>('input');
  const [trainingProgress, setTrainingProgress] = useState<Record<string, boolean>>({});
  const [submissionUrls, setSubmissionUrls] = useState<Record<string, string>>({});
  const [verifyingTut, setVerifyingTut] = useState<string | null>(null); // Loading state for DB insert
  
  // Capture State
  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [tempCaptureBlob, setTempCaptureBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function initSandbox() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const user = JSON.parse(sessionData);
      setCurrentUser(user);

      try {
        // We also fetch the existing tech_archive to pre-fill completed tutorials
        const [tutRes, enrollRes, archiveRes] = await Promise.all([
          // ADDED: .eq('is_hidden', false) to filter out WIP missions!
          supabase.from('makecode_tutorials').select('*').eq('is_hidden', false),
          supabase.from('enrollments').select('id, sandbox_state').eq('student_id', user.id).eq('course_id', course_id).single(),
          supabase.from('tech_archive').select('mission_id, media_url').eq('student_id', user.id).eq('type', 'makecode_tutorial')
        ]);

        if (tutRes.data) setTutorials(tutRes.data);
        
        if (enrollRes.data) {
          setEnrollmentId(enrollRes.data.id);
          const dbState = enrollRes.data.sandbox_state || {};
          setSandboxState({
            stage: dbState.stage || 'standard',
            used_inputs: dbState.used_inputs || [],
            used_outputs: dbState.used_outputs || []
          });
        }

        // Restore previously submitted tutorial links from DB
        if (archiveRes.data) {
          const restoredProgress: Record<string, boolean> = {};
          const restoredUrls: Record<string, string> = {};
          
          archiveRes.data.forEach(arch => {
            // DEFENSIVE CHECK: Skip if mission_id is null or undefined
            if (!arch.mission_id) return; 

            const tutId = String(arch.mission_id).replace('tut-', '');
            restoredProgress[tutId] = true;
            if (arch.media_url) restoredUrls[tutId] = arch.media_url;
          });
          
          setTrainingProgress(restoredProgress);
          setSubmissionUrls(restoredUrls);
        }

        const { data: hardwareData } = await supabase
          .from('course_components')
          .select(`
            unlock_tier,
            is_required,
            platform_components (*)
          `)
          .eq('course_id', course_id);

        if (hardwareData) {
          const mappedHardware = hardwareData.map(h => ({
            ...h.platform_components,
            unlock_tier: h.unlock_tier,
            is_required: h.is_required
          }));
          setHardware(mappedHardware);
        }
        
        setPhase('intro');
      } catch (err) {
        console.error(err);
        alert("Failed to initialize sandbox.");
        router.push("/student/courses");
      }
    }
    initSandbox();
  }, [course_id, router]);

  const inputs = hardware.filter(h => h.category === 'input');
  const outputs = hardware.filter(h => h.category === 'output');

  // Lock logic
  const isInputUsed = (id: string) => sandboxState.used_inputs.includes(id);
  const isOutputUsed = (id: string) => sandboxState.used_outputs.includes(id);

  // Global Sandbox Mastery Logic
  const functionalHardware = hardware.filter(h => h.category === 'input' || h.category === 'output');
  const beginnerHardware = functionalHardware.filter(h => h.unlock_tier === 'beginner');
  const masteredBeginnerCount = beginnerHardware.filter(h => sandboxState.used_inputs.includes(h.id) || sandboxState.used_outputs.includes(h.id)).length;
  const isBeginnerMastered = beginnerHardware.length > 0 && masteredBeginnerCount >= beginnerHardware.length;

  // Tutorial Logic Split by Component (Now explicitly sorted by array order)
  const inputTutorials = useMemo(() => {
    const ids = selectedInput?.tutorial_ids || [];
    return tutorials
      .filter(t => ids.includes(t.id))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }, [selectedInput, tutorials]);

  const outputTutorials = useMemo(() => {
    const ids = selectedOutput?.tutorial_ids || [];
    return tutorials
      .filter(t => ids.includes(t.id))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }, [selectedOutput, tutorials]);

  const activeTutorials = useMemo(() => {
    const combined = [...inputTutorials, ...outputTutorials];
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [inputTutorials, outputTutorials]);

  const trainingCompletedCount = activeTutorials.filter(t => trainingProgress[t.id]).length;
  const isTrainingComplete = activeTutorials.length === 0 || trainingCompletedCount >= activeTutorials.length;

  // --- UPDATED: Tutorial Submission Logic (Removes "tut-" prefix for UUID column) ---
  const handleLinkSubmission = async (tut: any, url: string) => {
    if (!url.includes('makecode.microbit.org')) return alert("Paste a valid MakeCode Share Link!");
    
    setVerifyingTut(tut.id);
    try {
       // If they are updating an existing link
       if (trainingProgress[tut.id]) {
          const { error } = await supabase.from('tech_archive')
            .update({ media_url: url, review_status: 'pending' }) 
            .eq('student_id', currentUser.id)
            .eq('mission_id', tut.id); // <-- FIXED: Removed "tut-" prefix
          
          if (error) throw error;
            
          setSubmissionUrls(prev => ({ ...prev, [tut.id]: url }));
       } else {
          // New Submission
          const potentialXp = tut.xp_value || 100;
          const earnedXp = Math.floor(potentialXp * 0.5); 

          const { error } = await supabase.from('tech_archive').insert({
             student_id: currentUser.id,
             mission_id: tut.id, // <-- FIXED: Removed "tut-" prefix
             title: `MakeCode Training: ${tut.title}`,
             description: tut.description,
             media_url: url,
             status: 'completed',
             review_status: 'pending', 
             xp_earned: earnedXp,
             potential_xp: potentialXp,
             type: 'makecode_tutorial'
          });

          if (error) throw error;

          if (earnedXp > 0) {
             const newXp = (currentUser.xp || 0) + earnedXp;
             const { error: profileErr } = await supabase.from('profiles').update({ xp: newXp }).eq('id', currentUser.id);
             if (profileErr) throw profileErr;
             
             const updatedUser = { ...currentUser, xp: newXp };
             setCurrentUser(updatedUser);
             localStorage.setItem("pioneer_session", JSON.stringify(updatedUser));
          }

          setTrainingProgress(prev => ({ ...prev, [tut.id]: true }));
          setSubmissionUrls(prev => ({ ...prev, [tut.id]: url }));
       }
    } catch (err: any) {
       console.error("DB ERROR:", err);
       alert(`Submission Failed: ${err.message || err.details || "Unknown Database Error"}`);
    } finally {
       setVerifyingTut(null);
    }
  };

  const startCapture = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { displaySurface: "browser", preferCurrentTab: true }, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream; video.play();
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d"); ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => { if (blob) { setTempCaptureBlob(blob); setShowCapturePreview(true); } }, "image/png");
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }, 600);
      };
    } catch (err) { console.error("Capture failed:", err); }
  };

  // --- UPDATED: Custom Logic Capture (Uses random UUID instead of "sandbox-" string) ---
  const confirmAndSaveBuild = async () => {
    if (!tempCaptureBlob || !selectedInput || !selectedOutput) return;
    setIsSaving(true);
    
    try {
      const fileName = `${currentUser.id}-sandbox-${Date.now()}.png`;
      await supabase.storage.from('tech-archive-assets').upload(`blueprints/${fileName}`, tempCaptureBlob);
      const { data: urlData } = supabase.storage.from('tech-archive-assets').getPublicUrl(`blueprints/${fileName}`);

      const { count } = await supabase.from('tech_archive').select('*', { count: 'exact', head: true }).eq('student_id', currentUser.id).eq('type', 'custom_logic');
      
      const potentialXp = await calculateDiminishingXP(150, count || 0);
      const earnedXp = Math.floor(potentialXp * 0.5); 

      await supabase.from('tech_archive').insert({
        student_id: currentUser.id,
        mission_id: crypto.randomUUID(), // <-- FIXED: Generates a valid UUID instead of a string
        title: `Custom Logic: ${selectedInput.name} + ${selectedOutput.name}`,
        description: `Integration of ${selectedInput.name} and ${selectedOutput.name} via MakeCode Sandbox.`,
        media_url: urlData.publicUrl,
        status: 'completed',
        review_status: 'pending', 
        xp_earned: earnedXp,
        potential_xp: potentialXp,
        type: 'custom_logic'
      });

      if (earnedXp > 0) {
        const newXp = (currentUser.xp || 0) + earnedXp;
        await supabase.from('profiles').update({ xp: newXp }).eq('id', currentUser.id);
        localStorage.setItem("pioneer_session", JSON.stringify({ ...currentUser, xp: newXp }));
      }

      const newUsedInputs = Array.from(new Set([...sandboxState.used_inputs, selectedInput.id]));
      const newUsedOutputs = Array.from(new Set([...sandboxState.used_outputs, selectedOutput.id]));
      
      let newStage = sandboxState.stage;
      if (newUsedInputs.length >= inputs.length && newUsedOutputs.length >= outputs.length) {
        newStage = 'advanced_mix';
      }

      const newState = { stage: newStage, used_inputs: newUsedInputs, used_outputs: newUsedOutputs };
      await supabase.from('enrollments').update({ sandbox_state: newState }).eq('id', enrollmentId);
      
      setSandboxState(newState);
      setShowCapturePreview(false);
      setPhase('success');
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });

    } catch (err) {
      alert("Failed to save build. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (phase === 'loading') return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const currentSelectionItems = phase === 'select-input' ? inputs : outputs;
  const coreItems = currentSelectionItems.filter(i => i.unlock_tier !== 'advanced');
  const advancedItems = currentSelectionItems.filter(i => i.unlock_tier === 'advanced');

  return (
    <main className="min-h-[100dvh] bg-[#020617] text-white font-sans flex flex-col selection:bg-blue-500/30">
      
      {/* NAVBAR */}
      <nav className="h-auto md:h-20 border-b border-white/5 py-3 px-4 md:px-6 flex flex-wrap items-center justify-between shrink-0 bg-black/20 backdrop-blur-md sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/student/course/${course_id}`} className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <MapIcon size={14} className="shrink-0" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Course Map</span>
          </Link>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-500 leading-none mb-1">Hardware Sandbox</p>
            <h1 className="text-sm md:text-lg font-black uppercase italic tracking-tighter leading-none">Modular Integration</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 ml-auto">
          <Link href="/student/dashboard" className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all">
            <LayoutDashboard size={14} className="shrink-0" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Dashboard</span>
          </Link>
          <Link href={`/student/course/${course_id}`} className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <MapIcon size={14} className="shrink-0" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Course Map</span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto relative flex flex-col items-center p-4">
        <AnimatePresence mode="wait">
          
          {/* PHASE 1: INTRO */}
          {phase === 'intro' && (
            <motion.div key="intro" initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} className="max-w-3xl w-full p-8 py-16 text-center space-y-10">
              <div className="w-24 h-24 bg-blue-500/10 border-2 border-blue-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                <Cpu className="text-blue-400 w-10 h-10" />
              </div>
              <h2 className="text-5xl font-black italic uppercase tracking-tighter">Hardware Lab</h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Welcome to the sandbox. Here you will define your own missions. Select an input and an output to master, then combine them to build custom logic.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="px-8 py-4 bg-white/5 rounded-2xl border border-white/10 text-center w-full sm:w-auto">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inputs Mastered</p>
                  <p className="text-3xl font-black text-blue-400">{sandboxState.used_inputs.length} <span className="text-lg text-slate-600">/ {inputs.length}</span></p>
                </div>
                <div className="px-8 py-4 bg-white/5 rounded-2xl border border-white/10 text-center w-full sm:w-auto">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Outputs Mastered</p>
                  <p className="text-3xl font-black text-purple-400">{sandboxState.used_outputs.length} <span className="text-lg text-slate-600">/ {outputs.length}</span></p>
                </div>
              </div>

              <button 
                onClick={() => setPhase('select-input')} 
                className="mx-auto flex items-center justify-center gap-3 px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all hover:scale-105 shadow-xl shadow-blue-900/20"
              >
                Commence Build <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* PHASE 2 & 3: HARDWARE SELECTION (SPLIT INTO CORE & ADVANCED) */}
          {(phase === 'select-input' || phase === 'select-output') && (
            <motion.div key="select" initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0}} className="max-w-5xl w-full py-12 space-y-12">
              <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-6">
                <h2 className="text-3xl font-black italic uppercase">{phase === 'select-input' ? "1. Select an Input" : "2. Select an Actuator"}</h2>
                <button onClick={() => setPhase(phase === 'select-input' ? 'intro' : 'select-input')} className="text-slate-500 hover:text-white uppercase text-[10px] font-black tracking-widest flex items-center gap-2">
                  <ArrowLeft size={14} /> Back
                </button>
              </div>

              {/* CORE SYSTEMS GRID */}
              <div className="space-y-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Cpu className="text-blue-500 w-5 h-5" />
                    <h3 className="text-xl font-black tracking-widest uppercase text-white">Core Systems</h3>
                  </div>
                  <p className="text-sm text-slate-400 max-w-2xl">
                    Initialize your build by selecting your primary hardware. You must master all fundamental modules here to authorize access to the Advanced Tech drawer.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {coreItems.map(item => {
                    const used = phase === 'select-input' ? isInputUsed(item.id) : isOutputUsed(item.id);
                    const isSelected = (phase === 'select-input' && selectedInput?.id === item.id) || (phase === 'select-output' && selectedOutput?.id === item.id);
                    
                    return (
                      <button 
                        key={item.id} 
                        disabled={used}
                        onClick={() => {
                          if (phase === 'select-input') { setSelectedInput(item); setPhase('select-output'); } 
                          else { setSelectedOutput(item); setPhase('training'); }
                        }} 
                        className={`group flex flex-col text-left border rounded-[32px] transition-all duration-300 relative overflow-hidden ${
                          used ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70 cursor-not-allowed' :
                          isSelected ? 'bg-blue-500/10 border-blue-500 scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.15)]' : 'bg-[#0f172a]/50 border-white/10 hover:border-blue-500/40 hover:scale-[1.02] shadow-xl'
                        }`}
                      >
                        {/* PREMIUM IMAGE STAGE */}
                        <div className="w-full h-40 md:h-48 relative bg-black/60 flex items-center justify-center p-6 border-b border-white/5 overflow-hidden">
                          {/* Inner glow effect on hover */}
                          <div className={`absolute inset-0 transition-opacity duration-500 blur-2xl ${isSelected ? 'bg-blue-500/20 opacity-100' : 'bg-blue-500/10 opacity-0 group-hover:opacity-100'}`} />
                          
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              className={`relative z-10 w-full h-full object-contain transition-transform duration-700 ease-out group-hover:scale-110 drop-shadow-2xl ${used ? 'grayscale opacity-40' : ''}`} 
                              alt={item.name} 
                            />
                          ) : (
                            <Cpu className="text-slate-600 w-12 h-12 relative z-10" />
                          )}

                          {/* Top Right Status Badge */}
                          {used && (
                            <div className="absolute top-4 right-4 z-20 bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5 backdrop-blur-md">
                              <CheckCircle2 size={12} className="text-emerald-400" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Mastered</span>
                            </div>
                          )}
                        </div>

                        {/* TEXT DETAILS SECTION */}
                        <div className="p-6 md:p-8 flex flex-col flex-1 w-full bg-gradient-to-b from-white/[0.02] to-transparent">
                          <h3 className="text-lg md:text-xl font-black uppercase mb-3 text-white tracking-tight leading-tight">{item.name}</h3>
                          <p className="text-xs md:text-sm text-slate-400 line-clamp-3 leading-relaxed flex-1">{item.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ADVANCED TECH DRAWER */}
              {advancedItems.length > 0 && (
                <div className="relative pt-8">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent" />
                  
                  <div className="bg-[#0f172a]/50 backdrop-blur-md border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
                    
                    {/* The Running Log / Progress Tracker */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-white/5 pb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <Zap className={`w-5 h-5 ${isBeginnerMastered ? 'text-fuchsia-500' : 'text-slate-500'}`} />
                          <h3 className={`text-xl font-black tracking-widest uppercase ${isBeginnerMastered ? 'text-fuchsia-400' : 'text-slate-400'}`}>Advanced Tech</h3>
                        </div>
                        <p className="text-sm text-slate-400 max-w-md">
                          High-tier components require a solid foundation. Master the Core Systems to override the security lock.
                        </p>
                      </div>
                      
                      <div className="bg-[#020617]/80 border border-white/5 rounded-[24px] p-5 md:p-6 shrink-0 min-w-[280px] shadow-inner">
                        <div className="flex items-center justify-between mb-4 gap-4">
                          <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                            <ListTodo size={14} className="text-blue-500"/> Core Log
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
                            isBeginnerMastered 
                              ? 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20 shadow-[0_0_15px_rgba(217,70,239,0.1)]' 
                              : 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                          }`}>
                            {isBeginnerMastered ? 'AUTHORISED' : `${masteredBeginnerCount} / ${beginnerHardware.length} SECURED`}
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/5">
                          <div 
                            className={`h-full transition-all duration-1000 relative ${
                              isBeginnerMastered 
                                ? 'bg-gradient-to-r from-fuchsia-600 to-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.5)]' 
                                : 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                            }`}
                            style={{ width: `${Math.min(100, (masteredBeginnerCount / Math.max(1, beginnerHardware.length)) * 100)}%` }}
                          >
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:10px_10px] animate-[shimmer_1s_linear_infinite]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 relative">
                      {!isBeginnerMastered && (
                        <div className="absolute inset-0 z-20 bg-[#020617]/40 backdrop-blur-[2px] rounded-3xl flex items-center justify-center border border-white/5">
                           <div className="bg-black/80 px-6 py-4 rounded-2xl border border-amber-500/20 flex items-center gap-3 shadow-2xl">
                             <Lock className="text-amber-500" size={18} />
                             <span className="text-xs font-black uppercase tracking-widest text-amber-500">System Locked</span>
                           </div>
                        </div>
                      )}

                      {advancedItems.map(item => {
                        const used = phase === 'select-input' ? isInputUsed(item.id) : isOutputUsed(item.id);
                        const isSelected = (phase === 'select-input' && selectedInput?.id === item.id) || (phase === 'select-output' && selectedOutput?.id === item.id);
                        
                        return (
                          <button 
                            key={item.id} 
                            disabled={!isBeginnerMastered || used}
                            onClick={() => {
                              if (phase === 'select-input') { setSelectedInput(item); setPhase('select-output'); } 
                              else { setSelectedOutput(item); setPhase('training'); }
                            }} 
                            className={`group flex flex-col text-left border rounded-[32px] transition-all duration-300 relative overflow-hidden ${
                              !isBeginnerMastered ? 'bg-[#0f172a]/30 border-white/5 opacity-50 grayscale cursor-not-allowed' :
                              used ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70 cursor-not-allowed' :
                              isSelected ? 'bg-fuchsia-500/10 border-fuchsia-500 scale-[1.02] shadow-[0_0_30px_rgba(217,70,239,0.2)]' : 'bg-[#0f172a]/50 border-white/10 hover:border-fuchsia-500/40 hover:scale-[1.02] shadow-xl'
                            }`}
                          >
                            {/* PREMIUM IMAGE STAGE */}
                            <div className="w-full h-40 md:h-48 relative bg-black/60 flex items-center justify-center p-6 border-b border-white/5 overflow-hidden">
                              <div className={`absolute inset-0 transition-opacity duration-500 blur-2xl ${isSelected ? 'bg-fuchsia-500/20 opacity-100' : 'bg-fuchsia-500/10 opacity-0 group-hover:opacity-100'}`} />
                              
                              {item.image_url ? (
                                <img 
                                  src={item.image_url} 
                                  className={`relative z-10 w-full h-full object-contain transition-transform duration-700 ease-out ${!isBeginnerMastered ? '' : 'group-hover:scale-110'} drop-shadow-2xl ${used ? 'grayscale opacity-40' : ''}`} 
                                  alt={item.name} 
                                />
                              ) : (
                                <Cpu className="text-slate-600 w-12 h-12 relative z-10" />
                              )}

                              {used && (
                                <div className="absolute top-4 right-4 z-20 bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5 backdrop-blur-md">
                                  <CheckCircle2 size={12} className="text-emerald-400" />
                                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Mastered</span>
                                </div>
                              )}
                            </div>

                            {/* TEXT DETAILS SECTION */}
                            <div className="p-6 md:p-8 flex flex-col flex-1 w-full bg-gradient-to-b from-white/[0.02] to-transparent">
                              <h3 className="text-lg md:text-xl font-black uppercase mb-3 text-white tracking-tight leading-tight">{item.name}</h3>
                              <p className="text-xs md:text-sm text-slate-400 line-clamp-3 leading-relaxed flex-1">{item.description}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* PHASE 4: TRAINING & TUTORIALS */}
          {phase === 'training' && (
            <motion.div key="training" initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0}} className="max-w-4xl w-full py-12 space-y-8 md:space-y-10 relative">
              
              <div className="text-center space-y-4">
                <span className="px-4 py-1.5 bg-blue-500/10 text-blue-400 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest border border-blue-500/20">Pre-Requisite Training</span>
                <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white leading-none">Master Your Tech</h2>
                <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">Complete the core MakeCode tutorials for your selected components before Command authorizes you to enter the custom free-build workspace.</p>
              </div>
              
              {/* Premium Organization Tabs */}
              <div className="flex justify-center mt-10">
                <div className="flex bg-[#0f172a] p-2 rounded-[24px] border border-white/10 shadow-inner overflow-x-auto w-full sm:w-auto z-10 relative">
                  <button 
                    onClick={() => setTrainingTab('input')}
                    className={`flex-1 sm:flex-none whitespace-nowrap px-6 py-4 md:px-12 rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all duration-300 gap-2 flex items-center justify-center ${
                      trainingTab === 'input' 
                        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="opacity-50">INPUT:</span> {selectedInput?.name}
                  </button>
                  <button 
                    onClick={() => setTrainingTab('output')}
                    className={`flex-1 sm:flex-none whitespace-nowrap px-6 py-4 md:px-12 rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all duration-300 gap-2 flex items-center justify-center ${
                      trainingTab === 'output' 
                        ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="opacity-50">OUTPUT:</span> {selectedOutput?.name}
                  </button>
                </div>
              </div>

              {/* Tab Content (Upgraded Premium Cards) */}
              <div className="space-y-6 md:space-y-8 pt-4">
                {/* Empty State */}
                {(trainingTab === 'input' ? inputTutorials : outputTutorials).length === 0 && (
                  <div className="text-center p-12 md:p-16 bg-[#0f172a]/50 rounded-[32px] md:rounded-[40px] border border-white/10 text-slate-400 flex flex-col items-center shadow-xl">
                    <div className={`w-16 h-16 rounded-3xl border flex items-center justify-center mb-6 shadow-inner ${trainingTab === 'input' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-purple-500/10 border-purple-500/20'}`}>
                       <CheckCircle2 size={32} className={`${trainingTab === 'input' ? 'text-blue-500/50' : 'text-purple-500/50'}`} />
                    </div>
                    <p className="font-black uppercase tracking-widest text-sm text-white">Clearance Authorized</p>
                    <p className="text-sm md:text-base mt-2 max-w-sm leading-relaxed text-slate-400">You are fully cleared to use the {trainingTab === 'input' ? selectedInput?.name : selectedOutput?.name} in your custom build. No specific training is required.</p>
                  </div>
                )}
                
                {/* Render Active Tab Tutorials with Premium Styling */}
                {(trainingTab === 'input' ? inputTutorials : outputTutorials).map((tut) => {
                  const isDone = trainingProgress[tut.id];
                  const accentColor = trainingTab === 'input' ? 'text-blue-400' : 'text-purple-400';
                  const bgColor = trainingTab === 'input' ? 'blue' : 'purple';
                  
                  // Grab the actual hardware component being trained on
                  const activeComponent = trainingTab === 'input' ? selectedInput : selectedOutput;
                  
                  return (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={tut.id} 
                        className={`group rounded-[32px] md:rounded-[48px] border transition-all relative overflow-hidden flex flex-col md:flex-row ${isDone ? 'border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_40px_rgba(16,185,129,0.1)]' : 'bg-[#0f172a]/70 border-white/10 shadow-2xl hover:border-white/20'}`}
                    >
                        
                      {/* Left: Component Blueprint Stage (UPGRADED PREMIUM AESTHETIC) */}
                      <div className={`shrink-0 w-full md:w-80 h-64 md:h-auto md:min-h-[320px] relative flex flex-col items-center justify-center p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/5 overflow-hidden transition-all duration-700 z-0 ${isDone ? 'bg-[#061c13]' : 'bg-[#030812]'}`}>
                        
                        {/* Blueprint Grid Background */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none" />

                        {/* Top Spotlight */}
                        <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] opacity-40 transition-colors duration-1000 pointer-events-none z-0 ${isDone ? 'bg-emerald-500' : trainingTab === 'input' ? 'bg-blue-500' : 'bg-purple-500'}`} />

                        {/* Hardware Hero Image */}
                        <div className="relative z-10 flex-1 flex items-center justify-center w-full mb-16 mt-4">
                          {activeComponent?.image_url ? (
                            <img 
                              src={activeComponent.image_url} 
                              alt={activeComponent.name} 
                              className={`w-full h-full max-w-[140px] max-h-[140px] md:max-w-[180px] md:max-h-[180px] object-contain transition-transform duration-700 ease-out group-hover:scale-[1.15] ${isDone ? 'drop-shadow-[0_10px_30px_rgba(16,185,129,0.3)]' : 'drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]'}`} 
                            />
                          ) : (
                            <Cpu className={`w-20 h-20 md:w-28 md:h-28 transition-transform duration-700 ease-out group-hover:scale-110 ${isDone ? 'text-emerald-400' : accentColor}`} />
                          )}
                        </div>

                        {/* Glassmorphic Telemetry Badge */}
                        <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 px-5 py-3.5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-0.5">Hardware Link</span>
                            <span className="text-[11px] font-bold text-white tracking-wide truncate pr-4">{activeComponent?.name}</span>
                          </div>
                          {/* Pulsing Status Dot */}
                          <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10">
                              <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${isDone ? 'text-emerald-400 bg-emerald-400' : trainingTab === 'input' ? 'text-blue-500 bg-blue-500 animate-pulse' : 'text-purple-500 bg-purple-500 animate-pulse'}`} />
                          </div>
                        </div>
                      </div>

                      {/* Right: Technical Details & Actions */}
                      <div className="p-6 md:p-8 lg:p-10 flex-1 flex flex-col justify-center w-full min-w-0 bg-gradient-to-br from-transparent to-black/20">
                        
                        {/* Title & Description */}
                        <div className="mb-6 lg:mb-8 min-w-0">
                          <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight flex items-center gap-3 text-white leading-tight">
                            <span className="truncate">{tut.title}</span> {isDone && <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />}
                          </h3>
                          <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">{tut.description}</p>
                        </div>
                        
                        {/* Premium Gradient Divider */}
                        <div className="w-full h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent mb-6 lg:mb-8" />

                        {/* Action Stack */}
                        <div className="flex flex-col gap-4 w-full max-w-2xl">
                          
                          {/* Primary Action: Launch */}
                          <a 
                            href={tut.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={`w-full text-center flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 text-white bg-${bgColor}-600 hover:bg-${bgColor}-500 hover:-translate-y-0.5 shadow-[0_10px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)] ring-1 ring-white/10`}
                          >
                            Launch Tutorial <ExternalLink size={16} />
                          </a>

                          {/* Secondary Action: Verification Zone */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input 
                              type="text" 
                              placeholder="Paste Share Link to verify completion..."
                              className={`flex-1 min-w-0 border rounded-xl py-4 px-5 text-xs outline-none transition-all shadow-inner ${isDone ? 'bg-black/40 border-green-500/20 text-green-100 ring-2 ring-green-500/10' : 'bg-[#020617]/80 border-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10 text-white placeholder:text-slate-600'}`}
                              value={submissionUrls[tut.id] || ""}
                              onChange={(e) => setSubmissionUrls(prev => ({...prev, [tut.id]: e.target.value}))}
                            />
                            <button 
                              onClick={() => handleLinkSubmission(tut, submissionUrls[tut.id])}
                              disabled={verifyingTut === tut.id}
                              className={`shrink-0 px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 flex items-center justify-center gap-2.5 whitespace-nowrap ${isDone ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10' : 'bg-white text-black hover:bg-slate-200 hover:-translate-y-0.5 shadow-[0_10px_20px_rgba(0,0,0,0.2)]'}`}
                            >
                              {verifyingTut === tut.id ? <Loader2 size={14} className="animate-spin" /> : (isDone ? <Edit2 size={14} /> : null)}
                              {verifyingTut === tut.id ? "Saving..." : (isDone ? "Update Link" : "Verify Build")}
                            </button>
                          </div>
                          
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
              
              {/* Master Completion / Blocked Proceed Section (PREMIUM DASHBOARD STYLE) */}
              <div className="flex flex-col items-center pt-12 mt-8 relative">
                {/* Divider Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <div className="w-full max-w-2xl bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 rounded-[40px] p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-800 to-black border border-white/10 flex items-center justify-center shadow-inner relative overflow-hidden shrink-0">
                          <div className={`absolute inset-0 opacity-20 ${isTrainingComplete ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          <Cpu size={24} className={isTrainingComplete ? 'text-emerald-400' : 'text-blue-400'}/>
                      </div>
                      <div className="text-center sm:text-left">
                        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">System Override</h4>
                        <p className="text-xs text-slate-400 mt-1">Complete diagnostics to advance</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center sm:items-end shrink-0">
                      <span className={`text-3xl font-black italic tracking-tighter leading-none ${isTrainingComplete ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-white'}`}>
                        {trainingCompletedCount} <span className="text-lg text-slate-500 not-italic tracking-widest">/ {activeTutorials.length}</span>
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-2">Modules Verified</span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden shadow-inner mb-10 border border-white/5">
                      <div 
                          className={`h-full transition-all duration-1000 relative ${isTrainingComplete ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-blue-700 to-blue-500'}`}
                          style={{ width: `${Math.min(100, (trainingCompletedCount / Math.max(1, activeTutorials.length)) * 100)}%` }}
                      >
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:10px_10px] animate-[shimmer_1s_linear_infinite]" />
                      </div>
                  </div>

                  <button 
                    disabled={!isTrainingComplete}
                    onClick={() => setPhase('workspace')} 
                    className={`w-full py-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden group ${isTrainingComplete ? 'bg-white text-black hover:scale-[1.02] shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'bg-[#020617] text-slate-600 border border-white/5 cursor-not-allowed'}`}
                  >
                    {isTrainingComplete && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />}
                    <span className="relative z-10">{isTrainingComplete ? "Initialize Custom Workspace" : "Awaiting Sub-System Verification"}</span>
                    <ArrowRight size={16} className={`relative z-10 transition-transform ${isTrainingComplete ? 'group-hover:translate-x-1' : ''}`} />
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* PHASE 5: CUSTOM WORKSPACE */}
          {phase === 'workspace' && (
            <motion.div key="workspace" initial={{opacity: 0}} animate={{opacity: 1}} className="max-w-6xl w-full h-[80vh] flex flex-col space-y-4 pt-6">
              <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl">
                <div>
                  <h3 className="font-black uppercase tracking-widest text-xs text-blue-400">Custom Integration</h3>
                  <p className="text-xl font-black italic uppercase">{selectedInput?.name} + {selectedOutput?.name}</p>
                </div>
                <button onClick={() => setPhase('capture')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-transform hover:scale-105">
                  <Camera size={14} /> Capture Build
                </button>
              </div>
              <div className="flex-1 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
                <iframe src="https://makecode.microbit.org/" className="w-full h-full border-none" />
              </div>
            </motion.div>
          )}

          {/* PHASE 6: CAPTURE UPLINK */}
          {phase === 'capture' && (
            <motion.div key="capture" initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="max-w-2xl w-full py-20 text-center space-y-8">
              <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Camera className="w-10 h-10 text-blue-400" />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter">Submit Logic</h2>
              <p className="text-slate-400">Test your code in the simulator. When you are confident it works, initiate a system capture to archive this build.</p>
              
              <div className="flex justify-center gap-4 pt-4">
                <button onClick={() => setPhase('workspace')} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-colors">
                  Return to Editor
                </button>
                <button onClick={startCapture} className="px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-105 transition-transform flex items-center gap-2">
                  <Camera size={16} /> Launch Capture
                </button>
              </div>
            </motion.div>
          )}

          {/* SUCCESS SCREEN */}
          {phase === 'success' && (
             <motion.div key="success" initial={{opacity: 0}} animate={{opacity: 1}} className="max-w-2xl w-full py-20 text-center space-y-8">
               <CheckCircle2 size={80} className="text-green-500 mx-auto" />
               <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Logic <br/><span className="text-green-400">Archived</span></h2>
               <p className="text-slate-400">Incredible work, Pioneer. Your logic has been saved and sent to Command for review.</p>
               
               <button 
                 onClick={() => router.push(`/student/course/${course_id}`)} 
                 className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black rounded-2xl font-black uppercase transition-all hover:scale-105 tracking-widest text-sm mt-8"
               >
                 Return to Roadmap <ArrowRight size={18} />
               </button>
             </motion.div>
          )}

        </AnimatePresence>

        {/* SCREENSHOT PREVIEW MODAL */}
        <AnimatePresence>
          {showCapturePreview && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-6">
              <div className="max-w-4xl w-full bg-[#020617] border border-white/10 rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 md:p-8 border-b border-white/5 flex justify-between items-center shrink-0">
                  <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tighter text-white">Review_Snapshot</h3>
                  <button onClick={() => setShowCapturePreview(false)} className="text-slate-500 hover:text-white p-2"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-4 md:p-8 bg-black/40 text-center flex-1 overflow-y-auto">
                  {tempCaptureBlob && <img src={URL.createObjectURL(tempCaptureBlob)} className="max-h-[60vh] object-contain rounded-2xl border border-white/10 mx-auto" alt="Preview" /> }
                </div>
                <div className="p-4 md:p-8 border-t border-white/5 flex gap-3 md:gap-4 shrink-0">
                  <button onClick={() => setShowCapturePreview(false)} className="flex-1 py-4 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5">Discard</button>
                  <button onClick={confirmAndSaveBuild} disabled={isSaving} className="flex-1 py-4 rounded-2xl bg-blue-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-400 shadow-xl">
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : "Archive & Earn XP"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}