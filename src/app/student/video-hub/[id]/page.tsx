"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { Check, PlayCircle, Loader2, ArrowLeft, Copy, Puzzle, CheckSquare, Cpu, Rocket, Code2, X, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORY_STYLES: Record<string, { text: string, border: string, borderFaded: string, shadow: string, shadowFaded: string, bgActive: string, icon: any }> = {
  "Getting started": { 
    text: "text-emerald-600", border: "border-emerald-500", borderFaded: "border-emerald-200", 
    shadow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]", shadowFaded: "shadow-[0_0_15px_rgba(16,185,129,0.1)]", 
    bgActive: "bg-emerald-50", icon: Rocket 
  },
  "Input & Output Sensors": { 
    text: "text-amber-500", border: "border-amber-500", borderFaded: "border-amber-200", 
    shadow: "shadow-[0_0_20px_rgba(245,158,11,0.4)]", shadowFaded: "shadow-[0_0_15px_rgba(245,158,11,0.1)]", 
    bgActive: "bg-amber-50", icon: Cpu 
  },
  "Coding Logic": { 
    text: "text-blue-600", border: "border-blue-600", borderFaded: "border-blue-200", 
    shadow: "shadow-[0_0_20px_rgba(37,99,235,0.4)]", shadowFaded: "shadow-[0_0_15px_rgba(37,99,235,0.1)]", 
    bgActive: "bg-blue-50", icon: Code2 
  },
};

export default function VideoHubViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const router = useRouter();
  
  // 11 Strict Hook Calls to prevent React Hook Order Violations
  const [loading, setLoading] = useState(true);
  const [mission, setMission] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedExtension, setCopiedExtension] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [dbComponents, setDbComponents] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const [enrollRes, modulesRes, componentsRes] = await Promise.all([
          supabase.from('enrollments').select('*').eq('student_id', localUser.id).eq('course_id', courseId).single(),
          supabase.from('modules').select('missions(*)').eq('course_id', courseId).single(),
          supabase.from('bootcamp_components').select('*')
        ]);

        const activeMission = modulesRes.data?.missions?.[0];

        if (enrollRes.data && activeMission) {
          setEnrollment(enrollRes.data);
          setMission(activeMission);
          
          if (enrollRes.data.sandbox_state?.checklist_progress?.[activeMission.id]) {
            setChecklistState(enrollRes.data.sandbox_state.checklist_progress[activeMission.id]);
          }
        }
        if (componentsRes.data) {
          setDbComponents(componentsRes.data);
        }
      } catch (err) {
        console.error("Error loading workspace", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [courseId, router]);

  // SAFE DATA PARSING & Auto-Selection Logic
  const config = mission?.mission_config || {};
  const isRobotics = mission?.sandbox_type === 'video_makecode';
  
  const videos = (config.videos || []).map((v: any) => ({
    ...v,
    category: v.category || "Getting started",
    topic: v.topic || "General",
    explainer_text: v.explainer_text || "",
    objectives: Array.isArray(v.objectives) ? v.objectives : [],
    extensions: Array.isArray(v.extensions) ? v.extensions : []
  }));

  const getComponents = (vid: any) => vid.extensions.length > 0 ? vid.extensions.map((e: any) => e.name) : ["Micro:bit Core"];
  const allComponents = Array.from(new Set(videos.flatMap(getComponents))) as string[];

  const toggleComponent = (comp: string) => {
    setSelectedComponents(prev => prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp]);
  };

  const videosFilteredByComponent = videos.filter((v: any) => 
    selectedComponents.length === 0 || getComponents(v).some((c: string) => selectedComponents.includes(c))
  );

  const availableCategories = Array.from(new Set(videosFilteredByComponent.map((v: any) => v.category))) as string[];
  const availableCategoriesStr = availableCategories.join(',');

  useEffect(() => {
    if (isRobotics && availableCategories.length > 0) {
      let currentCat = activeCategory;
      if (!activeCategory || !availableCategories.includes(activeCategory)) {
        currentCat = availableCategories[0];
        setActiveCategory(currentCat);
      }
      if (currentCat) {
        const topicsForCat = Array.from(new Set(videosFilteredByComponent.filter((v: any) => v.category === currentCat).map((v: any) => v.topic))) as string[];
        if (topicsForCat.length > 0 && (!activeTopic || !topicsForCat.includes(activeTopic))) {
          setActiveTopic(topicsForCat[0]);
        }
      }
    }
  }, [availableCategoriesStr, activeCategory, activeTopic, isRobotics, videosFilteredByComponent.length]);

  // EARLY RETURNS
  if (loading) return <div className="h-screen flex items-center justify-center bg-[#FAFAFA]"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>;
  if (!mission) return <div className="p-10">Workspace offline. No mission data found.</div>;

  const toggleTask = async (taskId: string) => {
    const newState = { ...checklistState, [taskId]: !checklistState[taskId] };
    setChecklistState(newState); 
    setIsSyncing(true);

    try {
      const currentSandboxState = enrollment.sandbox_state || {};
      const updatedSandboxState = { ...currentSandboxState, checklist_progress: { ...(currentSandboxState.checklist_progress || {}), [mission.id]: newState } };
      await supabase.from('enrollments').update({ sandbox_state: updatedSandboxState }).eq('id', enrollment.id);
    } catch (err) {
      console.error("Failed to sync checklist", err);
      setChecklistState({ ...checklistState, [taskId]: checklistState[taskId] });
    } finally {
      setIsSyncing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedExtension(text);
      setTimeout(() => setCopiedExtension(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleTopicClick = (cat: string, topic: string) => {
    setActiveCategory(cat);
    setActiveTopic(topic);
    setActiveVideo(null); 
  };

  // Video Filtering Execution
  const videosToDisplay = videosFilteredByComponent.filter((v: any) => v.category === activeCategory && v.topic === activeTopic);
  
  // Database lookup to render component information on the right
  const activeDbComponent = dbComponents.find(c => {
    if (!activeTopic) return false;
    const topicLower = activeTopic.toLowerCase();
    const nameLower = c.name.toLowerCase();
    return nameLower === topicLower || nameLower.includes(topicLower) || topicLower.includes(nameLower.replace(' sensor', '').replace(' motor', ''));
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 font-sans flex flex-col p-6 lg:p-8">
      
      <AnimatePresence>
        {!activeVideo && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full mb-8"
          >
            <div className="max-w-[1600px] mx-auto space-y-6">
              <Link href={`/student/course/${courseId}`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-xs uppercase tracking-widest transition-colors">
                <ArrowLeft size={16} /> Exit Workspace
              </Link>
              
              <div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900">{mission.title}</h1>
                <p className="text-slate-500 font-medium mt-3 max-w-2xl leading-relaxed text-lg">{mission.lore_text}</p>
              </div>

              {isRobotics && (
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    <Cpu size={14} /> Active Hardware Loadout
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allComponents.map((comp: string) => {
                      const isSelected = selectedComponents.includes(comp);
                      return (
                        <button 
                          key={comp} onClick={() => toggleComponent(comp)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                            isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {comp}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 max-w-[1600px] w-full mx-auto">
        
        {isRobotics ? (
          <>
            {/* LEFT PANEL: Distinct Categories & Nested Topics */}
            <div className={`w-full ${activeVideo ? 'lg:w-[300px]' : 'lg:w-[280px]'} shrink-0 flex flex-col gap-3`}>
              
              {activeVideo ? (
                // PLAYER MODE: Keep Sidebar focused on current Topic's video list
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full max-h-[calc(100vh-64px)]">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <button onClick={() => setActiveVideo(null)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">
                      <ArrowLeft size={14} /> Back to Dashboard
                    </button>
                    <h3 className={`font-black text-lg mt-3 ${CATEGORY_STYLES[activeCategory || ""]?.text || "text-slate-900"}`}>{activeTopic}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{activeCategory}</p>
                  </div>
                  <div className="overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {videosToDisplay.map((vid: any) => {
                      const isActive = activeVideo.id === vid.id;
                      return (
                        <button
                          key={vid.id} onClick={() => setActiveVideo(vid)}
                          className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border ${
                            isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <PlayCircle size={18} className={`shrink-0 mt-0.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className={`text-sm leading-tight ${isActive ? 'font-bold text-blue-900' : 'font-medium text-slate-600'}`}>{vid.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // DASHBOARD MODE: The Nested Topic Navigation
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Pathways</h3>
                  {["Getting started", "Input & Output Sensors", "Coding Logic"].map((cat: string) => {
                    if (!availableCategories.includes(cat)) return null;
                    const isActiveCat = activeCategory === cat;
                    const style = CATEGORY_STYLES[cat] || { text: "text-slate-900", border: "border-slate-900", borderFaded: "border-slate-300", shadow: "shadow-md", shadowFaded: "shadow-sm", bgActive: "bg-slate-50" };
                    const Icon = style.icon;
                    
                    const topicsInThisCat = Array.from(new Set(videosFilteredByComponent.filter((v:any) => v.category === cat).map((v:any) => v.topic))) as string[];

                    return (
                      <div 
                        key={cat} 
                        className={`rounded-2xl transition-all border-2 bg-white overflow-hidden mb-4 ${
                          isActiveCat ? `${style.border} ${style.shadow}` : `${style.borderFaded} ${style.shadowFaded}`
                        }`}
                      >
                        <div className={`px-5 py-4 flex items-center justify-between border-b ${isActiveCat ? `border-slate-100 ${style.bgActive}` : 'border-transparent'}`}>
                          <div className="flex items-center gap-3">
                            <Icon size={18} className={isActiveCat ? style.text : "text-slate-400"} />
                            <span className={`font-black tracking-wide ${isActiveCat ? style.text : 'text-slate-500'}`}>{cat}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col p-2 space-y-1 bg-white">
                          {topicsInThisCat.map(topic => {
                            const isActiveTopic = isActiveCat && activeTopic === topic;
                            return (
                              <button 
                                key={topic} onClick={() => handleTopicClick(cat, topic)} 
                                className={`text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${
                                  isActiveTopic ? `${style.bgActive} ${style.text} font-bold` : 'text-slate-600 hover:bg-slate-50 font-medium'
                                }`}
                              >
                                {topic}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CENTER PANEL */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6">
              <div className="flex-1 flex flex-col">
                {activeVideo ? (
                  <div className="flex flex-col gap-6 w-full">
                    {/* EXPLAINER TEXT BLOCK */}
                    {activeVideo.explainer_text && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Info size={18} className="text-blue-500" />
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Context</h3>
                        </div>
                        <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                          {activeVideo.explainer_text}
                        </p>
                      </motion.div>
                    )}
                    
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-slate-900/5 aspect-video w-full">
                      <video key={activeVideo.id} src={activeVideo.url} controls autoPlay className="w-full h-full object-contain outline-none" />
                    </motion.div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm min-h-[500px] flex-1">
                    <h2 className={`text-3xl font-black mb-2 ${CATEGORY_STYLES[activeCategory || ""]?.text || "text-slate-900"}`}>{activeTopic}</h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">{activeCategory} Guides</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {videosToDisplay.length === 0 && <p className="text-slate-500 italic">No guides available for this topic.</p>}
                      {videosToDisplay.map((vid: any) => (
                        <button key={vid.id} onClick={() => setActiveVideo(vid)} className="group flex flex-col text-left text-slate-900 hover:text-blue-600 transition-colors">
                          <div className="w-full aspect-video bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden mb-3 relative shadow-sm group-hover:shadow-md transition-shadow">
                            <video src={vid.url} className="w-full h-full object-cover" preload="metadata" />
                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                              <div className="bg-white/90 backdrop-blur rounded-full p-3 shadow-lg transform group-hover:scale-110 transition-transform"><PlayCircle size={24} className="text-slate-900" /></div>
                            </div>
                          </div>
                          <h3 className="font-bold text-sm leading-snug px-1">{vid.title}</h3>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Details */}
              <AnimatePresence mode="popLayout">
                {activeVideo && (
                  <motion.div key="player-details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="w-full lg:w-[350px] xl:w-[400px] shrink-0 flex flex-col gap-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                      <h2 className="text-2xl font-black text-slate-900 leading-tight mb-6">{activeVideo.title}</h2>
                      
                      {activeVideo.extensions && activeVideo.extensions.length > 0 && (
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                          <div className="flex items-center gap-2 mb-4 text-blue-800">
                            <Puzzle size={18} />
                            <h3 className="font-bold uppercase tracking-widest text-xs">Required Extensions</h3>
                          </div>
                          <div className="space-y-3">
                            {activeVideo.extensions.map((ext: any, idx: number) => (
                              <div key={idx} className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                                <span className="font-bold text-slate-700 text-sm">{ext.name}</span>
                                <button onClick={() => copyToClipboard(ext.url)} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all w-full border ${copiedExtension === ext.url ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {copiedExtension === ext.url ? <><Check size={14} /> Copied URL!</> : <><Copy size={14} /> Copy Repository URL</>}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex-1">
                      <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-5">
                        <div>
                          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><CheckSquare size={20} className="text-emerald-500" /> Objectives</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live Sync Active</p>
                        </div>
                        {isSyncing && <Loader2 className="w-4 h-4 text-blue-500 animate-spin mb-1" />}
                      </div>
                      
                      <div className="space-y-3">
                        {activeVideo.objectives.length === 0 ? (
                          <p className="text-slate-400 text-sm italic">No tasks assigned.</p>
                        ) : (
                          activeVideo.objectives.map((task: any) => {
                            const isDone = checklistState[task.id] || false;
                            return (
                              <button key={task.id} onClick={() => toggleTask(task.id)} className={`w-full text-left p-4 rounded-xl border transition-all flex gap-3 items-start ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                <div className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-all mt-0.5 ${isDone ? 'bg-emerald-500 border-emerald-500 shadow-sm' : 'bg-transparent border-slate-300'}`}>
                                  {isDone && <Check size={12} className="text-white stroke-[3]" />}
                                </div>
                                <span className={`text-sm leading-snug transition-colors ${isDone ? 'text-emerald-700 font-medium' : 'text-slate-700 font-bold'}`}>{task.text}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {!activeVideo && activeDbComponent && (
                  <motion.div key="hardware-profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="w-full lg:w-[320px] xl:w-[350px] shrink-0">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-full">
                      <div className="flex items-center gap-2 mb-6"><Cpu size={16} className="text-blue-500" /><h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Hardware Profile</h3></div>
                      <div className="w-full aspect-square bg-slate-50 rounded-2xl mb-6 overflow-hidden border border-slate-100">
                        {activeDbComponent.image_url ? <img src={activeDbComponent.image_url} alt={activeDbComponent.name} className="w-full h-full object-cover mix-blend-multiply" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Cpu size={48} /></div>}
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 mb-3 leading-tight">{activeDbComponent.name}</h2>
                      <div className="inline-flex px-3 py-1 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-md mb-6 uppercase tracking-wider">
                        {activeDbComponent.category === 'input' ? 'Input Sensor' : activeDbComponent.category === 'output' ? 'Output Device' : 'Component'}
                      </div>
                      <div className="space-y-6">
                        <div><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</h4><p className="text-sm text-slate-700 font-medium leading-relaxed">{activeDbComponent.description}</p></div>
                        <div className="pt-4 border-t border-slate-100"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Real World Use</h4><p className="text-sm text-slate-700 font-medium leading-relaxed">{activeDbComponent.real_world_use}</p></div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          /* ================================================= */
          /* UI 2: SCRATCH LAYOUT (Legacy Grid view)            */
          /* ================================================= */
          <div className="flex flex-col lg:flex-row gap-8 flex-1 w-full max-w-7xl mx-auto">
            <div className="flex-1 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {videos.map((vid: any) => (
                  <button key={vid.id} onClick={() => setActiveVideo(vid)} className="bg-white border border-slate-200 rounded-[24px] p-2 hover:shadow-xl hover:border-blue-300 transition-all group cursor-pointer block text-left flex flex-col">
                    <div className="w-full aspect-video bg-slate-900 rounded-[18px] flex items-center justify-center relative overflow-hidden group-hover:bg-black transition-colors">
                      <video src={vid.url} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity pointer-events-none" />
                      <PlayCircle className="text-white/80 group-hover:text-white group-hover:scale-110 transition-all w-14 h-14 z-10 relative drop-shadow-xl" />
                    </div>
                    <div className="p-5 flex-1 flex items-center"><h3 className="font-black text-slate-800 text-lg leading-tight">{vid.title}</h3></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isRobotics && (
        <AnimatePresence>
          {activeVideo && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md" onClick={() => setActiveVideo(null)} />
              <div className="relative w-full max-w-6xl bg-black rounded-[32px] overflow-hidden shadow-2xl flex flex-col z-10">
                <div className="flex justify-between items-center p-5 bg-slate-900">
                  <h3 className="text-white font-bold text-lg">{activeVideo.title}</h3>
                  <button onClick={() => setActiveVideo(null)} className="p-2 bg-slate-800 text-slate-400 rounded-full"><X size={20}/></button>
                </div>
                <video src={activeVideo.url} controls autoPlay className="w-full aspect-video outline-none" />
              </div>
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}