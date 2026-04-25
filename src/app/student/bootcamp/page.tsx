"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, ArrowRight, Zap, CheckCircle2, Loader2, Play, 
  Cpu, ExternalLink, ShieldAlert, Trophy, Link as LinkIcon, 
  Lock, Unlock, Edit2, Users, X, ChevronLeft, RefreshCcw
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import NestedLogicBuilder, { LogicBlock } from "@/components/lms/NestedLogicBuilder";

type BootcampPhase = 'intro' | 'select-input' | 'select-output' | 'context' | 'training-input' | 'training-output' | 'workspace' | 'success';

export default function BootcampDashboard() {
  const [phase, setPhase] = useState<BootcampPhase>('intro');
  const [hardware, setHardware] = useState<any[]>([]);
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [labLockedByTeacher, setLabLockedByTeacher] = useState(true);

  // Student Selections & Team
  const [selectedInput, setSelectedInput] = useState<any | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<any | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState<string[]>([]);

  // Training & Submission State
  const [trainingProgress, setTrainingProgress] = useState<Record<string, boolean>>({});
  const [submissionUrls, setSubmissionUrls] = useState<Record<string, string>>({});
  const [submittedList, setSubmittedList] = useState<Record<string, boolean>>({});
  const [bootcampXp, setBootcampXp] = useState(0);

  // --- INITIALIZATION & DB SYNC ---
  useEffect(() => {
    async function fetchData() {
      const userStr = localStorage.getItem("pioneer_session");
      const user = userStr ? JSON.parse(userStr) : null;
      setCurrentUser(user);

      // 1. Restore Local Storage Checkpoints
      const savedState = localStorage.getItem(`bootcamp_state_${user?.id}`);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.phase) setPhase(parsed.phase);
        if (parsed.selectedInput) setSelectedInput(parsed.selectedInput);
        if (parsed.selectedOutput) setSelectedOutput(parsed.selectedOutput);
      }

      const savedTeamName = localStorage.getItem("bootcamp_team_name");
      if (savedTeamName) setTeamName(savedTeamName);
      
      const savedMembers = localStorage.getItem("bootcamp_team_members");
      if (savedMembers) {
        setTeamMembers(JSON.parse(savedMembers));
      } else if (user) {
        setTeamMembers([user.id]); // Default to selecting themselves
      }

      // 2. Fetch Master Data & Filter Roster by Enrollment
      const [compRes, tutRes, profileRes, lockRes, bootcampCourseRes] = await Promise.all([
        supabase.from('bootcamp_components').select('*'),
        supabase.from('makecode_tutorials').select('*'),
        user ? supabase.from('profiles').select('bootcamp_xp').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('bootcamp_settings').select('lab_unlocked').eq('id', 1).single(),
        supabase.from('courses').select('id').eq('title', 'Robotics Pioneer Bootcamp').single()
      ]);

      let enrolledStudents: any[] = [];
      if (bootcampCourseRes.data) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('course_id', bootcampCourseRes.data.id)
          .eq('status', 'active');
          
        const studentIds = enrollments?.map(e => e.student_id) || [];
        
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('role', 'student')
            .in('id', studentIds)
            .order('display_name');
          
          if (profiles) enrolledStudents = profiles;
        }
      }
      
      if (compRes.data) setHardware(compRes.data);
      if (tutRes.data) setTutorials(tutRes.data);
      if (profileRes.data) setBootcampXp(profileRes.data.bootcamp_xp || 0);
      if (lockRes.data) setLabLockedByTeacher(!lockRes.data.lab_unlocked);
      setAllStudents(enrolledStudents);

      // 3. Fetch Existing Submissions
      if (user) {
        const { data: subs } = await supabase.from('tutorial_submissions').select('*').eq('student_id', user.id);
        if (subs && subs.length > 0) {
          const newSubmitted: Record<string, boolean> = {};
          const newUrls: Record<string, string> = {};
          let latestGroupText = "";

          subs.forEach(s => {
            newSubmitted[s.tutorial_id] = true;
            newUrls[s.tutorial_id] = s.share_url;
            if (s.group_names) latestGroupText = s.group_names;
          });

          setSubmittedList(newSubmitted);
          setTrainingProgress(newSubmitted);
          setSubmissionUrls(prev => ({ ...prev, ...newUrls }));
          
          if (latestGroupText) {
            setTeamName(latestGroupText.split(' (')[0] || "");
          }
        }
      }
      
      setLoading(false);
    }
    
    fetchData();

    // Listen for Teacher Lab Unlocks
    const lockSubscription = supabase
      .channel('bootcamp_lock')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bootcamp_settings' }, (payload) => {
        setLabLockedByTeacher(!payload.new.lab_unlocked);
      })
      .subscribe();

    return () => { supabase.removeChannel(lockSubscription); };
  }, []);

  // --- SAVE CHECKPOINTS TO BROWSER ---
  useEffect(() => {
    if (currentUser && phase !== 'intro') {
      localStorage.setItem(`bootcamp_state_${currentUser.id}`, JSON.stringify({
        phase, selectedInput, selectedOutput
      }));
    }
  }, [phase, selectedInput, selectedOutput, currentUser]);

  useEffect(() => {
    localStorage.setItem("bootcamp_team_name", teamName);
    localStorage.setItem("bootcamp_team_members", JSON.stringify(teamMembers));
  }, [teamName, teamMembers]);

  // --- NAVIGATION CONTROLS ---
  const goBack = () => {
    switch(phase) {
      case 'select-input': setPhase('intro'); break;
      case 'select-output': setPhase('select-input'); break;
      case 'context': setPhase('select-output'); break;
      case 'training-input': setPhase('context'); break;
      case 'training-output': setPhase('training-input'); break;
      case 'workspace': setPhase('training-output'); break;
      default: break;
    }
  };

  const startOver = () => {
    if (window.confirm("Return to start? Your completed tutorials are saved, but you can pick new hardware.")) {
      setSelectedInput(null);
      setSelectedOutput(null);
      setPhase('intro');
      if (currentUser) localStorage.removeItem(`bootcamp_state_${currentUser.id}`);
    }
  };

  const addTeamMember = (id: string) => {
    if (id && !teamMembers.includes(id)) {
      setTeamMembers([...teamMembers, id]);
    }
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers(teamMembers.filter(m => m !== id));
  };

  const inputs = hardware.filter(h => h.category === 'input');
  const outputs = hardware.filter(h => h.category === 'output');

  const activeTutorials = Array.from(new Set([
    ...(selectedInput?.tutorial_ids || []),
    ...(selectedOutput?.tutorial_ids || [])
  ])).map(id => tutorials.find(t => t.id === id)).filter(Boolean);

  const inputCompletedCount = Object.keys(submittedList).filter(id => selectedInput?.tutorial_ids.includes(id)).length;
  const outputCompletedCount = Object.keys(submittedList).filter(id => selectedOutput?.tutorial_ids.includes(id)).length;

  const getComputedGroupNames = () => {
    const memberNames = teamMembers.map(id => allStudents.find(s => s.id === id)?.display_name).filter(Boolean);
    const membersString = memberNames.length > 0 ? memberNames.join(' & ') : "Individual Pioneer";
    return teamName.trim() ? `${teamName} (${membersString})` : membersString;
  };

  // --- UPSERT SUBMISSION LOGIC ---
  const handleLinkSubmission = async (tutId: string) => {
    const shareUrl = submissionUrls[tutId];
    if (!shareUrl || !shareUrl.includes('makecode.microbit.org')) {
      alert("Please paste a valid MakeCode Share Link!");
      return;
    }

    const userStr = localStorage.getItem("pioneer_session");
    const user = userStr ? JSON.parse(userStr) : { id: 'demo_user' };
    const currentGroupNames = getComputedGroupNames();

    const { data: existing } = await supabase
      .from('tutorial_submissions')
      .select('id')
      .eq('student_id', user.id)
      .eq('tutorial_id', tutId)
      .single();

    let error;
    if (existing) {
      const res = await supabase.from('tutorial_submissions').update({
        share_url: shareUrl,
        group_names: currentGroupNames,
        status: 'pending' // Resets to pending so teacher can re-review
      }).eq('id', existing.id);
      error = res.error;
    } else {
      const res = await supabase.from('tutorial_submissions').insert({
        student_id: user.id,
        tutorial_id: tutId,
        share_url: shareUrl,
        group_names: currentGroupNames,
        status: 'pending'
      });
      error = res.error;
    }

    if (error) {
      alert("Error submitting link. Check your connection.");
    } else {
      setSubmittedList(prev => ({ ...prev, [tutId]: true }));
      setTrainingProgress(prev => ({ ...prev, [tutId]: true }));
    }
  };

  const saveBlueprintArchive = async (blueprintData: LogicBlock[]) => {
    setIsSaving(true);
    try {
      const payload = {
        student_id: currentUser.id,
        mission_id: 'bootcamp-custom-logic',
        title: `Custom Logic: ${selectedInput?.name} & ${selectedOutput?.name}`,
        description: JSON.stringify(blueprintData),
        status: 'completed',
        type: 'blueprint',
        xp_earned: 100
      };
      await supabase.from('tech_archive').upsert(payload, { onConflict: 'student_id,mission_id' });
      setPhase('success');
    } catch (e) {
      console.error(e);
      alert("Failed to save blueprint.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- DYNAMIC TUTORIAL CARD ---
  const TutorialSubmissionCard = ({ tut, color }: { tut: any, color: 'blue' | 'purple' }) => {
    const isSubmitted = submittedList[tut.id];
    const [isEditing, setIsEditing] = useState(!isSubmitted);

    useEffect(() => {
      if (isSubmitted) setIsEditing(false);
    }, [isSubmitted]);

    const accentClass = color === 'blue' ? 'border-blue-500/30 bg-blue-500/5' : 'border-purple-500/30 bg-purple-500/5';
    const btnClass = color === 'blue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500';

    return (
      <div className={`p-6 rounded-[28px] border transition-all ${isSubmitted && !isEditing ? accentClass : 'bg-white/5 border-white/10'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="space-y-1">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              {tut.title}
              {isSubmitted && !isEditing && <CheckCircle2 size={16} className={color === 'blue' ? 'text-blue-400' : 'text-purple-400'} />}
            </h3>
            <p className="text-xs text-slate-400">{tut.description}</p>
          </div>
          <a href={tut.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all text-white ${btnClass}`}>
            Launch <ExternalLink size={14} />
          </a>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Paste Share Link..."
              className={`w-full border rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all ${
                isEditing 
                  ? 'bg-black/40 border-white/20 focus:border-blue-500 text-white' 
                  : 'bg-transparent border-transparent text-slate-400 cursor-default'
              }`}
              value={submissionUrls[tut.id] || ""}
              onChange={(e) => setSubmissionUrls(prev => ({...prev, [tut.id]: e.target.value}))}
              disabled={!isEditing}
            />
          </div>
          
          {isEditing ? (
            <button 
              onClick={() => {
                handleLinkSubmission(tut.id);
                setIsEditing(false);
              }}
              className={`px-6 rounded-xl font-black uppercase text-[10px] transition-all bg-white/10 hover:bg-white/20 text-white`}
            >
              {isSubmitted ? "Update" : "Submit"}
            </button>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-6 rounded-xl font-black uppercase text-[10px] transition-all bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black flex items-center gap-2"
            >
              <Edit2 size={12} /> Edit
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <main className="min-h-[100dvh] bg-[#020617] text-white font-sans flex flex-col selection:bg-blue-500/30">
      
      {/* NAVBAR */}
      <nav className="h-16 md:h-20 border-b border-white/5 px-6 flex items-center justify-between shrink-0 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/student/dashboard" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <ArrowLeft size={18} />
          </Link>
          <div className="hidden sm:block">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-500 leading-none mb-1">RAD Academy</p>
            <h1 className="text-sm md:text-lg font-black uppercase italic tracking-tighter leading-none">Student Dashboard</h1>
          </div>
        </div>

        {/* TACTICAL NAVIGATION (Shows when inside the flow) */}
        {phase !== 'intro' && phase !== 'success' && (
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-2xl">
            <button onClick={goBack} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
              <ChevronLeft size={14} /> Back
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button onClick={startOver} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all">
              <RefreshCcw size={12} /> Reboot
            </button>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
            <Trophy size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{bootcampXp} Bootcamp XP</span>
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto relative flex flex-col items-center">
        <AnimatePresence mode="wait">
          
          {/* PHASE 1: INTRO & TEAM SELECTION */}
          {phase === 'intro' && (
            <motion.div key="intro" initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} className="max-w-3xl w-full p-8 py-16 space-y-10">
              <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-blue-500/10 border-2 border-blue-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                  <Play className="text-blue-400 w-10 h-10 ml-1" />
                </div>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter">Welcome to the Lab</h2>
                <p className="text-lg text-slate-400">Master your hardware components individually before building your integrated system. First, secure your workstation and define your engineering team.</p>
              </div>
              
              {/* ADVANCED TEAM SELECTION */}
              <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-8">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 block">Team Designation (Optional)</label>
                  <input 
                    type="text" 
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. The Cybernauts"
                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3 block">Engineering Roster</label>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {teamMembers.map(id => {
                      const student = allStudents.find(s => s.id === id);
                      const isMe = id === currentUser?.id;
                      return (
                        <div key={id} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border ${
                          isMe ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/10 border-white/20 text-slate-300'
                        }`}>
                          <Users size={12} />
                          {student?.display_name || "Loading..."}
                          {isMe ? (
                             <span className="text-[8px] bg-black/30 px-1.5 py-0.5 rounded text-white ml-1">You</span>
                          ) : (
                            <button onClick={() => removeTeamMember(id)} className="ml-1 p-0.5 hover:bg-black/30 rounded-full transition-colors">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <select 
                    value=""
                    onChange={(e) => addTeamMember(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-slate-400 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">+ Select Teammate from Classroom Roster...</option>
                    {allStudents.filter(s => !teamMembers.includes(s.id)).map(student => (
                      <option key={student.id} value={student.id} className="bg-slate-900 text-white">
                        {student.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={() => setPhase('select-input')} 
                className="w-full sm:w-auto mx-auto flex items-center justify-center gap-3 px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all hover:scale-105 shadow-xl shadow-blue-900/20"
              >
                Initialize System <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* PHASE 2 & 3: HARDWARE SELECTION */}
          {(phase === 'select-input' || phase === 'select-output') && (
            <motion.div key="select" initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0}} className="max-w-5xl w-full p-8 py-12 space-y-8">
              <h2 className="text-3xl font-black italic uppercase text-center">{phase === 'select-input' ? "Select Your Sensor" : "Select Your Actuator"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {(phase === 'select-input' ? inputs : outputs).map(item => (
                  <button key={item.id} onClick={() => {
                    if (phase === 'select-input') { setSelectedInput(item); setPhase('select-output'); } 
                    else { setSelectedOutput(item); setPhase('context'); }
                  }} className={`flex flex-col text-left border p-6 rounded-[32px] transition-all hover:scale-[1.02] ${
                    (phase === 'select-input' && selectedInput?.id === item.id) || (phase === 'select-output' && selectedOutput?.id === item.id)
                      ? 'bg-blue-500/10 border-blue-500'
                      : 'bg-white/5 border-white/10 hover:border-blue-500/50'
                  }`}>
                    <div className="w-16 h-16 rounded-2xl mb-4 bg-black/50 flex items-center justify-center overflow-hidden">
                      {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" alt="hardware" /> : <Cpu className="text-slate-500" />}
                    </div>
                    <h3 className="text-lg font-black uppercase mb-2">{item.name}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* PHASE 4: CONTEXT */}
          {phase === 'context' && (
             <motion.div key="context" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="max-w-4xl w-full p-8 py-20 space-y-12 text-center">
                <h2 className="text-4xl font-black italic uppercase italic">System Context</h2>
                <div className="grid grid-cols-2 gap-8 text-center">
                   <div className="p-8 bg-blue-500/5 rounded-[32px] border border-blue-500/20">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Input Sensor</span>
                      <h3 className="text-2xl font-black uppercase mt-2">{selectedInput?.name}</h3>
                   </div>
                   <div className="p-8 bg-purple-500/5 rounded-[32px] border border-purple-500/20">
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Output Actuator</span>
                      <h3 className="text-2xl font-black uppercase mt-2">{selectedOutput?.name}</h3>
                   </div>
                </div>
                <button onClick={() => setPhase('training-input')} className="px-12 py-6 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all">
                   Begin Sensor Training
                </button>
             </motion.div>
          )}

          {/* PHASE 5: INPUT TRAINING */}
          {phase === 'training-input' && (
            <motion.div key="training-in" initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0}} className="max-w-4xl w-full p-8 py-12 space-y-8">
              <div className="text-center space-y-4">
                <span className="px-4 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest">Part 1: Input Mastery</span>
                <h2 className="text-4xl font-black italic uppercase">{selectedInput?.name}</h2>
                <p className="text-slate-400">Complete 3 tutorials for your sensor to continue.</p>
                <div className="flex justify-center gap-2 py-2">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className={`w-16 h-2 rounded-full transition-all ${inputCompletedCount >= step ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {activeTutorials.filter(t => selectedInput?.tutorial_ids.includes(t.id)).map((tut) => (
                  <TutorialSubmissionCard key={tut.id} tut={tut} color="blue" />
                ))}
              </div>
              <div className="flex justify-center pt-8">
                {inputCompletedCount >= 3 ? (
                  <button onClick={() => setPhase('training-output')} className="px-10 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl">
                    Next: Actuator Training <ArrowRight size={18} className="inline ml-2" />
                  </button>
                ) : (
                  <div className="px-8 py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest italic flex items-center gap-2">
                    <Lock size={12} /> Complete 3 sensor tutorials to unlock outputs
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* PHASE 6: OUTPUT TRAINING */}
          {phase === 'training-output' && (
            <motion.div key="training-out" initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0}} className="max-w-4xl w-full p-8 py-12 space-y-8">
              <div className="text-center space-y-4">
                <span className="px-4 py-1 bg-purple-500/10 text-purple-400 rounded-full text-[10px] font-black uppercase tracking-widest">Part 2: Actuator Mastery</span>
                <h2 className="text-4xl font-black italic uppercase">{selectedOutput?.name}</h2>
                <p className="text-slate-400">Complete 3 tutorials for your actuator to unlock the Lab.</p>
                <div className="flex justify-center gap-2 py-2">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className={`w-16 h-2 rounded-full transition-all ${outputCompletedCount >= step ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {activeTutorials.filter(t => selectedOutput?.tutorial_ids.includes(t.id)).map((tut) => (
                  <TutorialSubmissionCard key={tut.id} tut={tut} color="purple" />
                ))}
              </div>
              <div className="flex justify-center pt-8">
                {outputCompletedCount >= 3 ? (
                  <div className="flex flex-col items-center gap-4">
                    {labLockedByTeacher ? (
                      <div className="flex flex-col items-center gap-3 animate-pulse bg-white/5 border border-red-500/20 p-8 rounded-3xl">
                        <Lock size={30} className="text-red-500" />
                        <p className="text-red-500 font-black uppercase tracking-tighter text-sm">Lab is currently Locked by Teacher</p>
                        <p className="text-xs text-slate-500 italic">Wait for the signal to begin integration...</p>
                      </div>
                    ) : (
                      <button onClick={() => setPhase('workspace')} className="px-10 py-5 bg-emerald-500 text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center gap-2">
                        <Unlock size={18} /> Enter Logic Lab <ArrowRight size={18} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="px-8 py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest italic flex items-center gap-2">
                    <Lock size={12} /> Complete 3 actuator tutorials to request lab access
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* PHASE 7: WORKSPACE */}
          {phase === 'workspace' && (
            <motion.div key="workspace" initial={{opacity: 0}} animate={{opacity: 1}} className="w-full h-full p-6 relative">
              <NestedLogicBuilder selectedInput={selectedInput} selectedOutput={selectedOutput} onSubmitBlueprint={saveBlueprintArchive} />
            </motion.div>
          )}

          {/* PHASE 8: SUCCESS */}
          {phase === 'success' && (
             <motion.div key="success" initial={{opacity: 0}} animate={{opacity: 1}} className="p-20 text-center space-y-6">
                <CheckCircle2 size={80} className="text-emerald-500 mx-auto" />
                <h2 className="text-4xl font-black uppercase italic">Mission Complete</h2>
                <Link 
                  href="/student/dashboard" 
                  onClick={() => localStorage.removeItem(`bootcamp_state_${JSON.parse(localStorage.getItem("pioneer_session") || "{}").id}`)}
                  className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black rounded-xl font-black uppercase transition-all hover:scale-105"
                >
                  Return to Dashboard <ArrowRight size={18} />
                </Link>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}