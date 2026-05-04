"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, Lock, Play, Zap, ChevronRight, 
  Map, Cpu, Link as LinkIcon, ExternalLink, Target, UploadCloud, X, Edit2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { calculateDiminishingXP } from "@/lib/xp-engine";

export default function PioneerSimulator({ mission }: { mission: any }) {
  const router = useRouter();
  
  // State Machine
  const [currentView, setCurrentView] = useState<'roadmap' | 'workspace'>('roadmap');
  
  // Progress Tracking (Maps the Win Index to an object containing url, status, and XP breakdowns)
  const [completedWins, setCompletedWins] = useState<Record<number, { url: string, status: string, xp_earned: number, bonus_xp: number }>>({});
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  
  // Interaction States
  const [isVerifying, setIsVerifying] = useState(false);
  const [makecodeLink, setMakecodeLink] = useState("");
  const [tutorialLaunched, setTutorialLaunched] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Extract the data from the JSON config
  const introStep = mission.mission_config.steps.find((s: any) => s.type === 'intro');
  
  // Dynamically build the Roadmap Levels
  const roadmapLevels = [
    ...(introStep?.cards || []),
    {
      order: (introStep?.cards?.length || 0) + 1,
      title: "Final Output: System Uplink",
      content: "You did it! Now, add your own custom flair. Change the colors or add a secret melody. When you are done, click the 'Share' button in your tutorial and paste your link below to send it to HQ for evaluation.",
      isSubmission: true
    }
  ];

  const highestUnlocked = Object.keys(completedWins).length;

  // FETCH PREVIOUS SUBMISSIONS ON MOUNT
  useEffect(() => {
    async function fetchStudentSubmissions() {
      const sessionStr = localStorage.getItem("pioneer_session");
      if (!sessionStr || !mission?.id) return;
      const student = JSON.parse(sessionStr);

      const { data, error } = await supabase
        .from('tutorial_submissions')
        .select('win_index, share_url, status, xp_earned, bonus_xp')
        .eq('student_id', student.id)
        .eq('mission_id', mission.id);

      if (!error && data) {
        // Create a map of completed wins capturing ALL data for the UI footer
        const winMap: Record<number, { url: string, status: string, xp_earned: number, bonus_xp: number }> = {};
        data.forEach(sub => {
          winMap[sub.win_index - 1] = { 
            url: sub.share_url, 
            status: sub.status,
            xp_earned: sub.xp_earned || 0,
            bonus_xp: sub.bonus_xp || 0
          };
        });
        setCompletedWins(winMap);
      }
    }

    fetchStudentSubmissions();
  }, [mission?.id]);

  // Reset interaction states when changing steps
  useEffect(() => {
    setTutorialLaunched(false);
  }, [activeStepIndex]);

  const handleLaunchTutorial = () => {
    setTutorialLaunched(true);
    const customUrl = roadmapLevels[activeStepIndex].tutorial_url || "https://makecode.microbit.org/";
    window.open(customUrl, "_blank");
  };

  const handleVerifyStep = async () => {
    if (makecodeLink.length < 10) {
      alert("Pioneer, please paste your valid tutorial link first!");
      return;
    }

    setIsVerifying(true);
    
    try {
      const sessionStr = localStorage.getItem("pioneer_session");
      if (!sessionStr) throw new Error("No active session found.");
      const student = JSON.parse(sessionStr);

      const isUpdate = !!completedWins[activeStepIndex];
      const isFinalStep = roadmapLevels[activeStepIndex].isSubmission;
      
      // Calculate Upfront XP using the Engine! (Applies to ANY first-time submission)
      let upfrontXp = 0;
      if (!isUpdate) {
        // Calculate the base 50% upfront reward
        const baseUpfront = Math.floor((mission.xp_reward || 250) * 0.5);
        
        // Pass it through the XP Engine (0 previous attempts because they only get this upfront XP once)
        upfrontXp = await calculateDiminishingXP(baseUpfront, 0); 
      }

      // 1. Insert OR Update the submission in the unified portfolio table
      if (isUpdate) {
        const { error } = await supabase
          .from('tutorial_submissions')
          .update({ share_url: makecodeLink })
          .eq('student_id', student.id)
          .eq('mission_id', mission.id)
          .eq('win_index', activeStepIndex + 1);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tutorial_submissions')
          .insert({
            student_id: student.id,
            mission_id: mission.id,
            win_index: activeStepIndex + 1,
            share_url: makecodeLink,
            status: 'pending',
            xp_earned: upfrontXp // <--- SAVED FROM THE ENGINE
          });
        if (error) throw error;
      }

      // 2. Handle successful DB save
      setIsLinkModalOpen(false); 
      setCompletedWins(prev => ({ 
        ...prev, 
        [activeStepIndex]: { 
          url: makecodeLink, 
          status: 'pending',
          xp_earned: isUpdate ? prev[activeStepIndex].xp_earned : upfrontXp,
          bonus_xp: isUpdate ? prev[activeStepIndex].bonus_xp : 0
        } 
      }));

      // 3. Grant Profile XP (If first time)
      if (!isUpdate && upfrontXp > 0) {
        const newXp = (student.xp || 0) + upfrontXp;
        // Update DB
        await supabase.from('profiles').update({ xp: newXp }).eq('id', student.id);
        // Update Local Session
        student.xp = newXp;
        localStorage.setItem("pioneer_session", JSON.stringify(student));
      }

      // 4. Alerts and Routing
      if (isFinalStep) {
        if (!isUpdate && upfrontXp > 0) {
          alert(`UPLINK SUCCESSFUL! +${upfrontXp} XP Awarded instantly! Your teacher will review your code to award the remaining XP. Returning to HQ...`);
        } else {
          alert(`UPLINK UPDATED! Your teacher will review your latest code.`);
        }
        router.push('/trial/hub');
        return;
      } else {
        if (!isUpdate && upfrontXp > 0) {
          alert(`PROGRESS SAVED! +${upfrontXp} XP Awarded instantly! Keep up the great work.`);
        }
        setCurrentView('roadmap');
      }

    } catch (err: any) {
      console.error("Submission failed:", err.message);
      alert("Failed to save your project to the HQ Database. Please try again!");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] text-white flex flex-col font-sans overflow-hidden">
      
      <AnimatePresence mode="wait">

        {/* ==========================================
            SCREEN 1: THE ROADMAP (Level Selector)
            ========================================== */}
        {currentView === 'roadmap' && (
          <motion.div 
            key="roadmap"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
            className="absolute inset-0 z-40 bg-[#020617] flex flex-col overflow-y-auto no-scrollbar"
          >
            <div className="sticky top-0 z-50 bg-[#020617]/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
              <button onClick={() => router.push('/trial/hub')} className="text-slate-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest flex items-center gap-1">
                <ChevronRight className="rotate-180" size={14} /> Back to HQ
              </button>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-400">
                <Map size={14} /> Mission Roadmap
              </div>
            </div>

            <div className="flex-1 max-w-3xl mx-auto w-full p-6 md:p-12 relative">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white">System Architecture</h2>
                <p className="text-slate-400 mt-2 font-medium">Complete each component to build the final alarm system.</p>
              </div>

              <div className="relative">
                <div className="absolute top-10 bottom-10 left-[23px] w-1 bg-white/10 rounded-full" />
                <motion.div 
                  className="absolute top-10 left-[23px] w-1 bg-blue-500 rounded-full z-0 origin-top shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: highestUnlocked / (roadmapLevels.length - 1) }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />

                <div className="space-y-8 relative z-10">
                  {roadmapLevels.map((level, index) => {
                    const submissionData = completedWins[index];
                    const isCompleted = !!submissionData;
                    const isReviewed = submissionData?.status === 'reviewed';
                    const isUnlocked = index <= highestUnlocked;
                    const isLocked = index > highestUnlocked;

                    // --- XP BREAKDOWN MATH ---
                    const maxBase = mission.xp_reward || 250;
                    const standardUpfront = Math.floor(maxBase * 0.5);
                    const totalXp = isCompleted ? ((submissionData.xp_earned || 0) + (submissionData.bonus_xp || 0)) : 0;
                    
                    let multiplierXp = 0;
                    let teacherXp = 0;

                    if (isCompleted) {
                      if (!isReviewed) {
                        multiplierXp = Math.max(0, submissionData.xp_earned - standardUpfront);
                      } else {
                        teacherXp = Math.max(0, submissionData.xp_earned - standardUpfront);
                      }
                    }

                    return (
                      <div key={index} className="flex gap-6 relative group">
                        <div className="shrink-0 mt-1 relative">
                          <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center bg-[#020617] z-10 relative transition-colors duration-500 ${
                            isCompleted ? 'border-emerald-500 text-emerald-400' :
                            isUnlocked ? 'border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)]' :
                            'border-white/10 text-slate-600'
                          }`}>
                            {isCompleted ? <CheckCircle2 size={20} /> : isUnlocked ? <Play size={18} fill="currentColor" className="ml-1" /> : <Lock size={18} />}
                          </div>
                          {isUnlocked && !isCompleted && <div className="absolute inset-[-4px] border border-blue-500/50 rounded-full animate-ping z-0" />}
                        </div>

                        <div 
                          onClick={() => {
                            if (!isLocked) {
                              setActiveStepIndex(index);
                              setCurrentView('workspace');
                            }
                          }}
                          className={`flex-1 p-6 rounded-3xl border transition-all ${
                            isCompleted ? 'bg-emerald-950/20 border-emerald-500/20 cursor-pointer hover:bg-emerald-950/40' :
                            isUnlocked ? 'bg-blue-900/20 border-blue-500/50 cursor-pointer hover:-translate-y-1 hover:shadow-xl shadow-blue-900/20' :
                            'bg-white/5 border-white/5 opacity-50 grayscale cursor-not-allowed'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className={`text-lg md:text-xl font-black uppercase italic tracking-tight ${isUnlocked ? 'text-white' : 'text-slate-300'}`}>
                              {level.title}
                            </h3>
                            
                            {/* TOP RIGHT: XP PILL OR FINAL PROJECT TAG */}
                            <div className="flex items-center gap-2">
                              {level.isSubmission && !isCompleted && (
                                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-purple-500/30 shrink-0">
                                  Final Project
                                </span>
                              )}
                              {isCompleted && (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)] shrink-0">
                                  <Zap size={12} className="fill-emerald-400" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{totalXp} XP</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <p className={`text-sm ${isUnlocked ? 'text-blue-100' : 'text-slate-400'} font-medium leading-relaxed line-clamp-2`}>
                            {level.content}
                          </p>

                          {isUnlocked && !isCompleted && (
                            <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 group-hover:text-blue-300">
                              <Play size={14} fill="currentColor" /> {level.isSubmission ? "Initiate Final Uplink" : "Start Component"}
                            </div>
                          )}
                          
                          {isCompleted && (
                            <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                              <CheckCircle2 size={14} /> {isReviewed ? "Reviewed & Locked" : "Submitted (Awaiting Teacher Review)"}
                            </div>
                          )}

                          {/* FOOTER: CALCULATION BREAKDOWN */}
                          {isCompleted && (
                            <div className="mt-8 pt-6 border-t border-white/5">
                              <div className="bg-black/20 rounded-[20px] p-1 border border-white/5 shadow-inner">
                                <div className="bg-[#020617] rounded-[16px] flex flex-col">
                                  
                                  {/* Top Row: Automated System XP */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-white/5">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                       <Cpu size={14} className="text-blue-500" /> System Core XP
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 bg-white/5 border border-white/5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                      <div className="flex items-center gap-1.5 text-slate-500">
                                         <span>Base (50%)</span> <span className="text-white text-xs ml-1">{standardUpfront}</span>
                                      </div>
                                      <span className="text-slate-600">+</span>
                                      <div className="flex items-center gap-1.5 text-slate-500">
                                         <span>Event</span> <span className="text-purple-400 text-xs ml-1">{multiplierXp}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bottom Row: Teacher Manual XP */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                       <Target size={14} className="text-amber-500" /> HQ Review XP
                                    </div>

                                    {!isReviewed ? (
                                      <div className="px-6 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest italic animate-pulse flex items-center justify-center">
                                        Under Review
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-3 bg-white/5 border border-white/5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                          <span>Teacher</span> <span className="text-emerald-400 text-xs ml-1">{teacherXp}</span>
                                        </div>
                                        <span className="text-slate-600">+</span>
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                          <span>Bonus</span> <span className="text-amber-400 text-xs ml-1">{submissionData.bonus_xp || 0}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ==========================================
            SCREEN 2: THE WORKSPACE (Cinematic Briefing)
            ========================================== */}
        {currentView === 'workspace' && (
          <motion.div 
            key="workspace"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 z-50 flex flex-col bg-[url('/noise.png')] bg-blend-overlay bg-[#020617]"
          >
            <div className="h-14 bg-[#020617]/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
              <button onClick={() => setCurrentView('roadmap')} className="text-slate-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest flex items-center gap-1">
                <ChevronRight className="rotate-180" size={14} /> Back to Roadmap
              </button>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-400">
                <Cpu size={14} /> Briefing // Phase {activeStepIndex + 1}
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

              <div className="w-full max-w-3xl bg-[#0a0f1d]/80 backdrop-blur-2xl border border-white/10 rounded-[32px] md:rounded-[48px] shadow-2xl relative z-10 overflow-hidden flex flex-col">
                <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-500" />

                <div className="p-8 md:p-12 text-center flex flex-col items-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] md:text-xs font-black uppercase tracking-widest mb-6 md:mb-8">
                    <Target size={16} /> Current Objective
                  </div>

                  <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white mb-6">
                    {roadmapLevels[activeStepIndex].title}
                  </h2>

                  <p className="text-slate-300 text-lg md:text-xl font-medium leading-relaxed max-w-2xl mb-12">
                    {roadmapLevels[activeStepIndex].content}
                  </p>

                  {/* ACTION BUTTONS */}
                  <div className="w-full flex flex-col md:flex-row gap-4 justify-center items-center">
                    
                    {completedWins[activeStepIndex] ? (
                      // === COMPLETED STATE UI ===
                      <>
                        <div className={`w-full md:w-auto py-5 px-8 rounded-2xl font-black uppercase tracking-widest text-sm border flex items-center justify-center gap-3 ${completedWins[activeStepIndex].status === 'reviewed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                           <CheckCircle2 size={20} /> {completedWins[activeStepIndex].status === 'reviewed' ? 'Reviewed & Locked' : 'Submitted for Review'}
                        </div>
                        <button 
                          onClick={() => window.open(completedWins[activeStepIndex].url, "_blank")}
                          className="w-full md:w-auto py-5 px-8 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3"
                        >
                           <ExternalLink size={20} /> Review My Code
                        </button>

                        {/* Edit Button (Only visible if NOT reviewed yet) */}
                        {completedWins[activeStepIndex].status !== 'reviewed' && (
                          <button 
                            onClick={() => {
                              setMakecodeLink(completedWins[activeStepIndex].url);
                              setIsLinkModalOpen(true);
                            }}
                            className="w-full md:w-auto py-5 px-8 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3"
                          >
                             <Edit2 size={20} /> Edit Link
                          </button>
                        )}
                      </>
                    ) : (
                      // === NOT YET COMPLETED STATE UI ===
                      <>
                        {/* Launch Tutorial Button */}
                        {!roadmapLevels[activeStepIndex].isSubmission && (
                          <button 
                            onClick={handleLaunchTutorial}
                            className="w-full md:w-auto py-5 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_50px_rgba(59,130,246,0.6)] hover:scale-105 hover:-translate-y-1 flex items-center justify-center gap-3"
                          >
                            <ExternalLink size={20} /> 1. Launch Tutorial
                          </button>
                        )}

                        {/* Mark Complete / Submit Button (Opens Modal) */}
                        <button 
                          onClick={() => setIsLinkModalOpen(true)}
                          disabled={!roadmapLevels[activeStepIndex].isSubmission && !tutorialLaunched}
                          className={`w-full md:w-auto py-5 px-8 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
                            (roadmapLevels[activeStepIndex].isSubmission || tutorialLaunched) 
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-105 hover:-translate-y-1' 
                              : 'bg-white/5 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {roadmapLevels[activeStepIndex].isSubmission ? (
                            <><UploadCloud size={20} /> Initiate System Uplink</>
                          ) : tutorialLaunched ? (
                            <><CheckCircle2 size={20} /> 2. Mark Complete</>
                          ) : (
                            <><Lock size={20} /> 2. Share your link</>
                          )}
                        </button>
                      </>
                    )}

                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==========================================
          LINK SUBMISSION MODAL
          ========================================== */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="max-w-md w-full bg-[#0a0f1d] border border-blue-500/30 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(59,130,246,0.2)] relative"
            >
              {/* Close Button */}
              <button 
                onClick={() => !isVerifying && setIsLinkModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white p-2"
              >
                <X size={20} />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
                <LinkIcon className="text-purple-400" size={24} />
              </div>
              
              <h3 className="text-2xl font-black uppercase italic tracking-tight text-white mb-2">
                {completedWins[activeStepIndex] ? 'Update Submission' : 'Submit Progress'}
              </h3>
              <p className="text-slate-300 text-base font-medium mb-6 leading-relaxed">
                <strong className="text-white font-black">{completedWins[activeStepIndex] ? 'Update your tutorial share link' : 'Paste your tutorial share link'}</strong> below so one of our teachers can review your logic. 
                
                {/* Notice the condition here changed to just check if it's the first time they are submitting this step! */}
                {!completedWins[activeStepIndex] && (
                   <span className="block mt-2 text-emerald-400"><strong className="font-black">You will immediately receive 50% of the Base XP</strong> just for submitting, and the rest when a teacher reviews it!</span>
                )}
              </p>

              <div className="space-y-4">
                <input 
                  type="url"
                  value={makecodeLink}
                  onChange={(e) => setMakecodeLink(e.target.value)}
                  placeholder="https://makecode.microbit.org/..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
                />
                
                <button 
                  onClick={handleVerifyStep}
                  disabled={isVerifying || makecodeLink.length < 10}
                  className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
                    isVerifying ? 'bg-purple-600/50 text-white/50 cursor-not-allowed' :
                    makecodeLink.length > 10 ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]' : 'bg-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isVerifying ? <><Zap className="animate-pulse" size={18} /> Processing...</> : <><CheckCircle2 size={18} /> {completedWins[activeStepIndex] ? 'Update & Save' : 'Submit & Save'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}