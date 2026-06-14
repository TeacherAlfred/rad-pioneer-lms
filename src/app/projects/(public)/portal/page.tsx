"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, ArrowRight, UploadCloud, CheckCircle2, FileText, 
  Link as LinkIcon, Save, ShieldAlert, Edit2, X, ChevronRight, ChevronLeft, Circle,
  Target, Palette, Type, Building2, Briefcase, Plus, Trash2, Camera, ChevronDown,
  LogOut
} from "lucide-react";

// Import your newly created Server Actions
import { getClientPortal, updatePortalProgress } from "@/app/actions/portal";

// ---------------------------------------------------------
// PRE-DEFINED SELECTIONS
// ---------------------------------------------------------
const EXAMPLE_GOALS = ["Increase keynote bookings", "Consolidate industry authority", "Secure board advisory seats", "Shape policy discourse"];
const PRESET_TIMEFRAMES = ["3 Months", "6 Months", "12 Months"];
const COLOR_PALETTES = [
  { id: "executive", name: "The Executive", desc: "Project timeless authority, corporate stability, and global trust.", colors: ["bg-slate-900", "bg-[#FDFBF7]"] },
  { id: "innovator", name: "The Innovator", desc: "Project modern vision, dynamic energy, and approachability.", colors: ["bg-[#2A2421]", "bg-[#A86F52]"] },
  { id: "strategist", name: "The Strategist", desc: "Project grounded intelligence, strategic foresight, and wealth.", colors: ["bg-emerald-900", "bg-amber-400"] },
  { id: "minimalist", name: "The Minimalist", desc: "Let your track record and data take center stage with unapologetic clarity.", colors: ["bg-black", "bg-gray-100"] }
];
const TYPOGRAPHY_STYLES = [
  { id: "editorial", name: "Editorial Serif", desc: "Traditional, Academic, Highly Trusted", styleClass: "font-serif" },
  { id: "modern", name: "Modern Sans", desc: "Clean, Accessible, Tech-Forward", styleClass: "font-sans tracking-tight" },
  { id: "bold", name: "Bold Command", desc: "Heavy weights, High contrast, Unignorable", styleClass: "font-sans font-black uppercase" }
];
const CATEGORIES = [
  { id: "strategy", title: "Strategy & Narrative", desc: "Define your objectives and the core pillars of your expertise." },
  { id: "identity", title: "Brand Identity", desc: "Set the visual and typographic tone for your digital flagship." },
  { id: "assets", title: "Authority & Media", desc: "Upload your proof of work, visual data, and broadcast history." }
];

export default function ClientPortal() {
  const [accessCode, setAccessCode] = useState("");
  const [placeholderText, setPlaceholderText] = useState("Enter your code");
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [clientData, setClientData] = useState<any | null>(null);
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const [isIntroExpanded, setIsIntroExpanded] = useState(false);

  // Scroll Hint State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowScrollHint(scrollHeight > clientHeight && scrollTop < scrollHeight - clientHeight - 10);
    }
  };

  const handleScrollDown = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ top: 200, behavior: 'smooth' });
  };

  // --- Login via Server Action ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    // Call the Neon DB via Next.js Server Action
    const res = await getClientPortal(accessCode);
    
    if (res.success && res.data) {
      setClientData(res.data);
      // Ensure we load their previously submitted data
      setFormData(res.data.submittedData || {});
      setError(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
    setIsLoggingIn(false);
  };

  const handleDataChange = (taskId: string, value: any) => {
    if (clientData?.isLocked) return;
    setFormData(prev => ({ ...prev, [taskId]: value }));
  };

  const handleGoalAdd = (taskId: string, goal: string) => {
    if (clientData?.isLocked || !goal.trim()) return;
    const currentData = formData[taskId] || { goals: [], timeframe: "" };
    if (!currentData.goals.includes(goal)) {
      handleDataChange(taskId, { ...currentData, goals: [...currentData.goals, goal] });
    }
  };

  const handleGoalRemove = (taskId: string, goal: string) => {
    if (clientData?.isLocked) return;
    const currentData = formData[taskId];
    handleDataChange(taskId, { ...currentData, goals: currentData.goals.filter((g: string) => g !== goal) });
  };

  const handlePillarUpdate = (taskId: string, index: number, field: 'title' | 'desc', value: string) => {
    if (clientData?.isLocked) return;
    const currentPillars = formData[taskId] || [{ title: "", desc: "" }];
    const newPillars = [...currentPillars];
    newPillars[index] = { ...newPillars[index], [field]: value };
    handleDataChange(taskId, newPillars);
  };

  const handlePillarAdd = (taskId: string) => {
    if (clientData?.isLocked) return;
    const currentPillars = formData[taskId] || [{ title: "", desc: "" }];
    handleDataChange(taskId, [...currentPillars, { title: "", desc: "" }]);
  };

  // Cloudflare R2 Upload
  const handleFileUpload = async (taskId: string, file: File) => {
    if (clientData?.isLocked) return;
    setUploadingTask(taskId);
    try {
      const uniqueFileName = `${taskId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const filePath = `portals/${accessCode.toUpperCase()}/${uniqueFileName}`;
      
      const res = await fetch('/api/upload/r2', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filePath, fileType: file.type }) 
      });

      if (!res.ok) throw new Error("Failed to get presigned URL");
      const { signedUrl } = await res.json();
      const uploadRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!uploadRes.ok) throw new Error("Failed to upload file to R2");

      const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://your-public-r2-domain.com";
      const finalFileUrl = `${publicR2Domain}/${filePath}`;
      
      // NEW: Check if there's already data. If so, append to an array. If not, start an array.
      const currentData = formData[taskId];
      const newData = Array.isArray(currentData) 
        ? [...currentData, finalFileUrl] 
        : (currentData ? [currentData, finalFileUrl] : [finalFileUrl]);

      handleDataChange(taskId, newData);
      setUploadingTask(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file. Please try again.");
      setUploadingTask(null);
    }
  };

  const handleRemoveFile = (taskId: string, fileUrlToRemove: string) => {
    if (clientData?.isLocked) return;
    
    const currentData = formData[taskId];
    if (Array.isArray(currentData)) {
      const newData = currentData.filter((url: string) => url !== fileUrlToRemove);
      // If the array is empty after deleting, set to empty string so the task shows as "incomplete"
      handleDataChange(taskId, newData.length > 0 ? newData : ""); 
    } else {
      handleDataChange(taskId, "");
    }
  };

  // --- Save via Server Action ---
  const handleSaveProgress = async () => {
    if (clientData?.isLocked) return;
    setIsSaving(true);
    
    const res = await updatePortalProgress(clientData.accessCode, formData);
    
    if (res.success) {
      setIsModalOpen(false);
    } else {
      alert("Failed to save progress. Please try again.");
    }
    setIsSaving(false);
  };

  const isTaskComplete = (taskId: string) => {
    const val = formData[taskId];
    if (!val) return false;

    // 1. Goal Builder (Object with goals array)
    if (typeof val === 'object' && !Array.isArray(val) && val.goals) {
      return val.goals.length > 0 && val.timeframe !== "";
    }

    // 2. Arrays (Pillars OR File Upload grids)
    if (Array.isArray(val)) {
      if (val.length === 0) return false;
      
      // If the first item is a string, it's our new File Upload array
      if (typeof val[0] === 'string') return true;
      
      // Otherwise, it's the Pillar Builder. Safely check for title/desc.
      return val.some((p: any) => p && p.title && p.title.trim() !== "" && p.desc && p.desc.trim() !== "");
    }

    // 3. Simple strings (Textareas, Links, single selections)
    if (typeof val === 'string') {
      return val.trim() !== "";
    }

    return true;
  };

  // Note: we use tasksSchema from the DB instead of tasks
  const categoryTasks = useMemo(() => {
    if (!clientData || !activeCategoryId) return [];
    return clientData.tasksSchema.filter((t: any) => t.categoryId === activeCategoryId);
  }, [clientData, activeCategoryId]);

  const visibleTasks = useMemo(() => {
    if (showAllTasks) return categoryTasks;
    return categoryTasks.filter((t: any) => !isTaskComplete(t.id));
  }, [categoryTasks, showAllTasks, formData]);

  const currentTaskIndex = useMemo(() => visibleTasks.findIndex((t: any) => t.id === currentTaskId), [visibleTasks, currentTaskId]);
  const activeTask = visibleTasks[currentTaskIndex];

  const openCategoryModal = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    const tasksInCategory = clientData.tasksSchema.filter((t: any) => t.categoryId === categoryId);

    if (tasksInCategory.length === 0) {
      alert("No tasks have been assigned to this section yet.");
      return;
    }

    const allComplete = tasksInCategory.every((t: any) => isTaskComplete(t.id));
    
    if (allComplete) {
      setShowAllTasks(true);
      setCurrentTaskId(tasksInCategory[0].id);
    } else {
      setShowAllTasks(false);
      const firstMissing = tasksInCategory.find((t: any) => !isTaskComplete(t.id));
      setCurrentTaskId(firstMissing.id);
    }
    setIsModalOpen(true);
  };

  const handleToggleShowAll = () => {
    const nextState = !showAllTasks;
    setShowAllTasks(nextState);
    
    if (nextState) {
      // Switched to "All Steps": Immediately jump to the absolute first task in this category
      if (categoryTasks.length > 0) {
        setCurrentTaskId(categoryTasks[0].id);
      }
    } else {
      // Switched to "Missing": Find the first incomplete task and jump to it
      const firstMissing = categoryTasks.find((t: any) => !isTaskComplete(t.id));
      setCurrentTaskId(firstMissing ? firstMissing.id : null);
    }
  };

  const goNext = async () => {
    if (currentTaskIndex < visibleTasks.length - 1) {
      if (!clientData?.isLocked) {
        setIsSaving(true);
        await updatePortalProgress(clientData.accessCode, formData);
        setIsSaving(false);
      }
      setCurrentTaskId(visibleTasks[currentTaskIndex + 1].id);
    }
  };

  const goPrev = async () => {
    if (currentTaskIndex > 0) {
      if (!clientData?.isLocked) {
        setIsSaving(true);
        await updatePortalProgress(clientData.accessCode, formData);
        setIsSaving(false);
      }
      setCurrentTaskId(visibleTasks[currentTaskIndex - 1].id);
    }
  };

  useEffect(() => {
    // If the user clicks into the input, stop rotating
    if (isFocused) return;

    const placeholders = ["Enter your code", "e.g. AC1234"];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % placeholders.length;
      setPlaceholderText(placeholders[currentIndex]);
    }, 2500); // Swaps every 2.5 seconds

    return () => clearInterval(interval); // Cleanup when unmounted or focused
  }, [isFocused]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : 'unset';
    if (isModalOpen) setTimeout(checkScroll, 100); 
    return () => { document.body.style.overflow = 'unset'; }
  }, [isModalOpen, activeTask]);

  const [customGoal, setCustomGoal] = useState("");
  const [customTimeframe, setCustomTimeframe] = useState("");

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] font-sans selection:bg-black/10 pb-24">
      <header className="absolute top-0 w-full px-6 py-8 md:p-8 flex justify-between items-center z-40">
        <span className="font-serif text-lg md:text-xl font-bold tracking-tight">RAD Academy.</span>
        <span className="font-sans text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 text-right">Secure Client Portal</span>
      </header>

      <main className="flex flex-col items-center justify-center px-4 md:px-6 pt-32">
        <AnimatePresence mode="wait">
          {!clientData ? (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md flex flex-col items-center text-center mt-12 md:mt-24">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-black/5"><Lock className="text-black/40" /></div>
              <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4">Project Access</h1>
              <form onSubmit={handleLogin} className="w-full mt-8">
                <input 
                  type="text" 
                  value={accessCode} 
                  onChange={(e) => setAccessCode(e.target.value)} 
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={placeholderText} 
                  className={`w-full bg-transparent border-b-2 py-4 text-center text-xl md:text-2xl font-serif tracking-[0.2em] uppercase outline-none placeholder:text-black/20 transition-all ${error ? 'border-red-500 text-red-500' : 'border-black/10 focus:border-black'}`} 
                />
                <button type="submit" disabled={isLoggingIn} className="mt-10 flex w-full items-center justify-center gap-3 rounded-full bg-[#1A1A1A] px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-black/80 disabled:opacity-50">
                  {isLoggingIn ? "Verifying..." : <>Unlock Portal <ArrowRight size={14} /></>}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-5xl">
              
              {clientData.isLocked && (
                <div className="mb-10 flex items-center gap-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 text-amber-900">
                  <ShieldAlert className="shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">Development has commenced.</h4>
                    <p className="text-xs mt-1 opacity-80">Portal is locked in read-only mode to prevent data conflicts.</p>
                  </div>
                </div>
              )}

              <div className="mb-12 border-b border-black/5 pb-8 md:flex md:items-end md:justify-between">
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-black/40 mb-3 flex items-center gap-3">
                    <div className={`h-[1px] w-6 ${clientData.brandColor}`} /> {clientData.projectName}
                  </h2>
                  <h1 className="text-4xl md:text-6xl font-serif tracking-tight mb-4">Welcome, {clientData.clientName.split(' ')[0]}</h1>
                  
                  <div className="max-w-2xl">
                    <p className={`text-sm md:text-base text-black/60 leading-relaxed transition-all duration-300 ${isIntroExpanded ? '' : 'line-clamp-2'}`}>
                      This secure vault is your central hub for project collaboration. Complete the sections below to define your narrative, establish your brand identity, and upload the foundational assets required to build your digital flagship.
                    </p>
                    <button 
                      onClick={() => setIsIntroExpanded(!isIntroExpanded)}
                      className="mt-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                    >
                      {isIntroExpanded ? "Read Less" : "Read More"} 
                      <ChevronDown size={14} className={`transition-transform duration-300 ${isIntroExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {CATEGORIES.map(category => {
                  const tasksInCat = clientData.tasksSchema.filter((t: any) => t.categoryId === category.id);
                  const completedInCat = tasksInCat.filter((t: any) => isTaskComplete(t.id)).length;
                  const totalInCat = tasksInCat.length;
                  const isCatComplete = completedInCat === totalInCat;

                  return (
                    <div key={category.id} className={`flex flex-col justify-between p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all ${isCatComplete ? 'border-green-500/30 bg-green-50/20' : 'border-black/10 bg-white hover:border-black/20 hover:shadow-xl'}`}>
                      <div>
                        <div className="flex justify-between items-start mb-4 md:mb-6">
                          <div className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center ${isCatComplete ? 'bg-green-500 text-white' : 'bg-black/5 text-black/40'}`}>
                            {isCatComplete ? <CheckCircle2 size={20} className="md:w-6 md:h-6" /> : <span className="font-serif text-base md:text-lg">{completedInCat}/{totalInCat}</span>}
                          </div>
                        </div>
                        <h3 className="text-xl md:text-2xl font-serif mb-2">{category.title}</h3>
                        <p className="text-xs md:text-sm text-black/50 mb-5 md:mb-8 leading-relaxed">{category.desc}</p>
                      </div>
                      
                      <button 
                        onClick={() => openCategoryModal(category.id)}
                        className={`w-full py-2.5 md:py-3 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all ${isCatComplete ? 'bg-green-500/10 text-green-700 hover:bg-green-500/20' : 'bg-[#1A1A1A] text-white hover:bg-black/80'}`}
                      >
                        {isCatComplete ? "Review Section" : "Begin Section"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-20 flex justify-center pb-12">
                <button 
                  onClick={() => setClientData(null)} 
                  className="flex items-center gap-2 rounded-full border border-black/10 bg-transparent px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-black/40 transition-all hover:border-red-500/30 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={14} />
                  Lock Vault & Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOCUS MODAL (WIZARD) */}
      <AnimatePresence>
        {/* REMOVED the 'visibleTasks.length > 0' check from this line so it stays open */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#FDFBF7] w-full max-w-2xl rounded-[1.5rem] md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative"
            >
              <div className="flex items-center justify-between p-4 md:px-10 md:py-6 border-b border-black/5">
                <div className="flex items-center bg-black/5 rounded-full p-1">
                  <button onClick={() => showAllTasks && handleToggleShowAll()} className={`px-3 py-2 rounded-full text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all ${!showAllTasks ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/80'}`}>Missing</button>
                  <button onClick={() => !showAllTasks && handleToggleShowAll()} className={`px-3 py-2 rounded-full text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all ${showAllTasks ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/80'}`}>All Steps</button>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-black/5 text-black/50"><X size={18} /></button>
              </div>

              {/* THE NEW SUCCESS STATE */}
              {visibleTasks.length === 0 || !activeTask ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 py-20 text-center">
                  <div className="h-24 w-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <CheckCircle2 size={48} />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-serif mb-4">Section Complete</h2>
                  <p className="text-black/50 mb-10 max-w-sm mx-auto leading-relaxed">You have provided all the required information for this section. Save your progress to securely store it in the database.</p>
                  <button onClick={handleSaveProgress} disabled={isSaving || clientData.isLocked} className="flex mx-auto items-center justify-center gap-3 rounded-full bg-[#1A1A1A] px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-black/80 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all">
                    {isSaving ? "Saving to Vault..." : <><Save size={16} /> Save & Close Section</>}
                  </button>
                </div>
              ) : (
                <>
                  {/* Scrollable Body */}
                  <div ref={scrollContainerRef} onScroll={checkScroll} className="flex-1 overflow-y-auto p-5 md:p-10 relative">
                    
                    {/* ---------------------------------------------------- */}
                    {/* KEEP ALL YOUR EXISTING TASK INPUTS AND GRID UI HERE! */}
                    {/* ---------------------------------------------------- */}
                <div className="mb-8">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-black/40">Step {currentTaskIndex + 1} of {visibleTasks.length}</span>
                  <h2 className="text-2xl md:text-4xl font-serif mt-2 mb-2">{activeTask.title}</h2>
                  <p className="text-sm md:text-base text-black/60 leading-relaxed">{activeTask.desc}</p>
                </div>

                <div className="mt-8 space-y-6 pb-8">
                  {activeTask.type === 'goal_builder' && (
                    <div className="space-y-10">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-black/40 mb-3 block">Primary Goals (Max 3)</label>
                        <div className="flex flex-col gap-2 mb-4">
                          {(formData[activeTask.id]?.goals || []).map((g: string) => (
                            <div key={g} className="flex justify-between items-center bg-white border border-black/10 p-4 rounded-xl shadow-sm">
                              <span className="text-sm font-medium">{g}</span>
                              <button disabled={clientData.isLocked} onClick={() => handleGoalRemove(activeTask.id, g)} className="text-red-500/50 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                          ))}
                        </div>
                        {(!formData[activeTask.id]?.goals || formData[activeTask.id].goals.length < 3) && (
                          <div className="mb-4">
                            <span className="text-xs text-black/40 mb-2 block italic">Tap an example to add:</span>
                            <div className="flex flex-wrap gap-2">
                              {EXAMPLE_GOALS.filter(eg => !(formData[activeTask.id]?.goals || []).includes(eg)).map(eg => (
                                <button key={eg} disabled={clientData.isLocked} onClick={() => handleGoalAdd(activeTask.id, eg)} className="text-xs bg-black/5 hover:bg-black/10 text-black px-3 py-2 rounded-lg transition-colors text-left flex items-center gap-2">
                                  <Plus size={12} /> {eg}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {(!formData[activeTask.id]?.goals || formData[activeTask.id].goals.length < 3) && (
                          <div className="flex gap-2">
                            <input type="text" disabled={clientData.isLocked} value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} placeholder="Or type your own objective..." className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30" onKeyDown={(e) => { if(e.key === 'Enter'){ e.preventDefault(); handleGoalAdd(activeTask.id, customGoal); setCustomGoal(""); } }}/>
                            <button disabled={clientData.isLocked || !customGoal.trim()} onClick={() => { handleGoalAdd(activeTask.id, customGoal); setCustomGoal(""); }} className="bg-[#1A1A1A] text-white px-4 rounded-xl disabled:opacity-50"><Plus size={18} /></button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-black/40 mb-3 block">Target Timeframe</label>
                        <div className="flex flex-wrap gap-3 mb-3">
                          {PRESET_TIMEFRAMES.map(time => (
                            <button key={time} disabled={clientData.isLocked} onClick={() => handleDataChange(activeTask.id, { ...formData[activeTask.id], timeframe: time })} className={`px-5 py-2.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${formData[activeTask.id]?.timeframe === time ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black/60 hover:border-black/30'}`}>{time}</button>
                          ))}
                        </div>
                        <input type="text" disabled={clientData.isLocked} value={customTimeframe} onChange={(e) => { setCustomTimeframe(e.target.value); handleDataChange(activeTask.id, { ...formData[activeTask.id], timeframe: e.target.value }); }} placeholder="Or specify custom timeframe..." className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30" />
                      </div>
                    </div>
                  )}

                  {activeTask.type === 'pillar_builder' && (
                    <div className="space-y-6">
                      {(formData[activeTask.id] || [{title: "", desc: ""}]).map((pillar: any, index: number) => (
                        <div key={index} className="p-5 bg-white border border-black/10 rounded-2xl shadow-sm">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-black/40 mb-2 block">Pillar {index + 1} Title</label>
                          <input type="text" disabled={clientData.isLocked} value={pillar.title} onChange={(e) => handlePillarUpdate(activeTask.id, index, 'title', e.target.value)} placeholder="e.g. Enterprise Architecture" className="w-full bg-transparent border-b border-black/10 pb-2 mb-4 text-lg font-serif outline-none focus:border-black/40" />
                          <label className="text-[9px] font-bold uppercase tracking-widest text-black/40 mb-2 block">Explanation & Perception</label>
                          <textarea disabled={clientData.isLocked} value={pillar.desc} onChange={(e) => handlePillarUpdate(activeTask.id, index, 'desc', e.target.value)} placeholder="Briefly explain what this means and how you want to be perceived..." rows={3} className="w-full bg-black/5 rounded-xl p-3 text-sm outline-none resize-none focus:bg-black/10 transition-colors" />
                        </div>
                      ))}
                      {(formData[activeTask.id] || []).length < 3 && (
                        <button disabled={clientData.isLocked} onClick={() => handlePillarAdd(activeTask.id)} className="w-full py-4 border-2 border-dashed border-black/15 rounded-2xl text-xs font-bold text-black/50 hover:text-black hover:border-black/30 hover:bg-white transition-all flex items-center justify-center gap-2">
                          <Plus size={16} /> Add Another Pillar
                        </button>
                      )}
                    </div>
                  )}

                  {activeTask.type === 'color_picker' && (
                    <div className="grid gap-4">
                      {COLOR_PALETTES.map(palette => (
                        <button key={palette.id} disabled={clientData.isLocked} onClick={() => handleDataChange(activeTask.id, palette.id)} className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left ${formData[activeTask.id] === palette.id ? 'border-green-500 bg-green-50/30 ring-1 ring-green-500' : 'border-black/10 bg-white hover:border-black/30'}`}>
                          <div className="flex h-12 w-12 shrink-0 rounded-full overflow-hidden shadow-inner border border-black/5 mt-1"><div className={`w-1/2 h-full ${palette.colors[0]}`} /><div className={`w-1/2 h-full ${palette.colors[1]}`} /></div>
                          <div><h4 className="font-serif text-xl text-black">{palette.name}</h4><p className="text-sm text-black/60 mt-1 leading-relaxed">{palette.desc}</p></div>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeTask.type === 'font_picker' && (
                    <div className="grid gap-4">
                      {TYPOGRAPHY_STYLES.map(font => (
                        <button key={font.id} disabled={clientData.isLocked} onClick={() => handleDataChange(activeTask.id, font.id)} className={`flex items-center justify-between p-5 rounded-2xl border transition-all text-left ${formData[activeTask.id] === font.id ? 'border-green-500 bg-green-50/30 ring-1 ring-green-500' : 'border-black/10 bg-white hover:border-black/30'}`}>
                          <div><h4 className={`text-xl text-black ${font.styleClass}`}>{font.name}</h4><p className="text-xs text-black/50 mt-1 font-sans">{font.desc}</p></div>
                          <span className={`text-3xl text-black/10 ${font.styleClass}`}>Ag</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeTask.type === 'hybrid_asset' && (
                    <div className="space-y-4">
                      {/* 1. Paste Web Link Input */}
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-3 rounded-2xl border px-4 py-3 border-black/10 bg-white focus-within:border-black/40 transition-colors">
                          <LinkIcon size={16} className="text-black/30" />
                          <input
                            type="text"
                            id={`link-input-${activeTask.id}`}
                            disabled={clientData.isLocked}
                            placeholder="Paste web link here..."
                            className="w-full bg-transparent text-sm outline-none placeholder:text-black/20"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = e.currentTarget.value.trim();
                                if (val) {
                                  const currentData = formData[activeTask.id];
                                  const newData = Array.isArray(currentData) ? [...currentData, val] : (currentData ? [currentData, val] : [val]);
                                  handleDataChange(activeTask.id, newData);
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                          />
                        </div>
                        <button 
                          onClick={() => {
                            const input = document.getElementById(`link-input-${activeTask.id}`) as HTMLInputElement;
                            const val = input?.value.trim();
                            if (val) {
                              const currentData = formData[activeTask.id];
                              const newData = Array.isArray(currentData) ? [...currentData, val] : (currentData ? [currentData, val] : [val]);
                              handleDataChange(activeTask.id, newData);
                              input.value = "";
                            }
                          }}
                          disabled={clientData.isLocked}
                          className="bg-[#1A1A1A] text-white px-5 rounded-2xl disabled:opacity-50 hover:bg-black/80 transition-colors text-xs font-bold uppercase tracking-widest"
                        >
                          Add
                        </button>
                      </div>

                      <div className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-black/20 my-2">OR</div>

                      {/* 2. File Dropzone */}
                      <div className="relative border border-dashed border-black/15 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-white hover:border-black/30 transition-colors">
                        <input type="file" disabled={clientData.isLocked} onChange={(e) => e.target.files && handleFileUpload(activeTask.id, e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                        {uploadingTask === activeTask.id ? (
                          <span className="text-xs font-medium animate-pulse text-black/50">Uploading to secure vault...</span>
                        ) : (
                          <span className="text-xs font-medium text-black/50 flex items-center gap-2"><UploadCloud size={14}/> Upload high-res file</span>
                        )}
                      </div>

                      {/* 3. The Unified Grid View (Images, PDFs, and Links) */}
                      {formData[activeTask.id] && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-black/5">
                          {(Array.isArray(formData[activeTask.id]) ? formData[activeTask.id] : [formData[activeTask.id]]).map((url: string, index: number) => {
                            if (!url) return null;
                            
                            // Sort out if it's an uploaded file vs a pasted text link
                            const isUploadedFile = url.includes('.r2.dev') || url.includes('pub-');
                            const isImage = isUploadedFile && /\.(jpeg|jpg|gif|png|webp|avif)$/i.test(url);

                            return (
                              <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-black/10 group bg-black/5">
                                {isImage ? (
                                  // Render Image Thumbnail
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={url} alt="Uploaded asset" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : isUploadedFile ? (
                                  // Render PDF / Document Icon with Filename
                                  <div className="w-full h-full flex flex-col items-center justify-center text-black/40 p-4">
                                    <FileText size={24} className="mb-2" />
                                    <span className="text-[8px] uppercase tracking-widest text-center truncate w-full break-all">
                                      {url.split('/').pop()}
                                    </span>
                                  </div>
                                ) : (
                                  // Render Pasted Web Link
                                  <div className="w-full h-full flex flex-col items-center justify-center text-blue-600 p-4 bg-blue-50/50">
                                    <LinkIcon size={24} className="mb-2" />
                                    <span className="text-[10px] font-medium text-center truncate w-full break-all px-2">
                                      {url.replace(/^https?:\/\//, '')}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Hover Delete Button */}
                                <button 
                                  onClick={() => handleRemoveFile(activeTask.id, url)} 
                                  disabled={clientData.isLocked}
                                  className="absolute top-2 right-2 p-2 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 disabled:hidden"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTask.type === 'file' && (
                    <div className="space-y-4">
                      {/* 1. The Upload Dropzone */}
                      <div className="relative border border-dashed border-black/15 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-white transition-colors hover:border-black/30">
                        <input type="file" disabled={clientData.isLocked} onChange={(e) => e.target.files && handleFileUpload(activeTask.id, e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                        {uploadingTask === activeTask.id ? (
                          <span className="text-xs md:text-sm font-medium animate-pulse text-black/50">Uploading to secure vault...</span>
                        ) : (
                          <>
                            <UploadCloud className="h-8 w-8 text-black/20 mb-2" />
                            <span className="text-xs font-medium text-black">Tap to upload files</span>
                          </>
                        )}
                      </div>

                      {/* 2. The Thumbnail Grid View */}
                      {formData[activeTask.id] && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-black/5">
                          {(Array.isArray(formData[activeTask.id]) ? formData[activeTask.id] : [formData[activeTask.id]]).map((url: string, index: number) => {
                            // Check if it's an image based on the file extension in the URL
                            const isImage = /\.(jpeg|jpg|gif|png|webp|avif)$/i.test(url);
                            
                            return (
                              <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-black/10 group bg-black/5">
                                {isImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={url} alt="Uploaded asset" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-black/40 p-4">
                                    <FileText size={24} className="mb-2" />
                                    <span className="text-[8px] uppercase tracking-widest text-center truncate w-full break-all">
                                      {url.split('/').pop()}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Hover Delete Button */}
                                <button 
                                  onClick={() => handleRemoveFile(activeTask.id, url)} 
                                  disabled={clientData.isLocked}
                                  className="absolute top-2 right-2 p-2 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 disabled:hidden"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTask.type === 'links' && (
                    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 md:py-4 transition-colors ${formData[activeTask.id] ? 'border-green-500/30 bg-white' : 'border-black/10 bg-white focus-within:border-black/40'}`}>
                      <LinkIcon size={16} className={formData[activeTask.id] ? 'text-green-500' : 'text-black/30'} />
                      <input type="text" disabled={clientData.isLocked} value={formData[activeTask.id] || ""} onChange={(e) => handleDataChange(activeTask.id, e.target.value)} placeholder="https://..." className="w-full bg-transparent text-sm outline-none placeholder:text-black/20" />
                    </div>
                  )}

                  {activeTask.type === 'textarea' && (
                    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 md:py-4 transition-colors ${formData[activeTask.id] ? 'border-green-500/30 bg-white' : 'border-black/10 bg-white focus-within:border-black/40'}`}>
                      <FileText size={16} className={`mt-1 ${formData[activeTask.id] ? 'text-green-500' : 'text-black/30'}`} />
                      <textarea disabled={clientData.isLocked} value={formData[activeTask.id] || ""} onChange={(e) => handleDataChange(activeTask.id, e.target.value)} placeholder={activeTask.placeholder} rows={5} className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-black/20" />
                    </div>
                  )}

                </div>
              </div>

              {/* BOUNCING SCROLL INDICATOR */}
              <AnimatePresence>
                {showScrollHint && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <button onClick={handleScrollDown} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_5px_15px_rgba(0,0,0,0.15)] border border-black/5 text-black animate-bounce hover:bg-gray-50 transition-colors pointer-events-auto">
                      <ChevronDown size={20} className="mt-0.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Modal Footer */}
              <div className="border-t border-black/5 p-4 md:p-6 bg-black/[0.02] flex justify-between items-center relative z-20">
                <button onClick={goPrev} disabled={currentTaskIndex === 0 || isSaving} className="flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-black/50 hover:text-black disabled:opacity-20 transition-colors">
                  <ChevronLeft size={14} /> Back
                </button>
                {currentTaskIndex === visibleTasks.length - 1 ? (
                  <button onClick={handleSaveProgress} disabled={isSaving || clientData.isLocked} className="flex items-center gap-2 rounded-full bg-[#1A1A1A] px-6 md:px-8 py-3 md:py-4 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white hover:bg-black/80 disabled:opacity-50 shadow-md">
                    {isSaving ? "Saving..." : <><Save size={14} /> Save Section</>}
                  </button>
                ) : (
                  <button onClick={goNext} disabled={isSaving || clientData.isLocked} className="flex items-center gap-2 rounded-full bg-black/10 px-6 md:px-8 py-3 md:py-4 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black/20 disabled:opacity-50 transition-all">
                    {isSaving ? "Saving..." : <>Next Step <ChevronRight size={14} /></>}
                  </button>
                )}
              </div>
            </>
            )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}