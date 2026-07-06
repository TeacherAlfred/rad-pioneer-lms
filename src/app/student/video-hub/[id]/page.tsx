"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { Check, PlayCircle, Loader2, ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function VideoHubViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [mission, setMission] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);

  useEffect(() => {
    async function fetchData() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: enrollData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('student_id', localUser.id)
          .eq('course_id', courseId)
          .single();

        const { data: modulesData } = await supabase
          .from('modules')
          .select('missions(*)')
          .eq('course_id', courseId)
          .single();

        const activeMission = modulesData?.missions?.[0];

        if (enrollData && activeMission) {
          setEnrollment(enrollData);
          setMission(activeMission);
          
          if (enrollData.sandbox_state?.checklist_progress?.[activeMission.id]) {
            setChecklistState(enrollData.sandbox_state.checklist_progress[activeMission.id]);
          }
        }
      } catch (err) {
        console.error("Error loading workspace", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [courseId, router]);

  const toggleTask = async (taskId: string) => {
    const newState = { ...checklistState, [taskId]: !checklistState[taskId] };
    setChecklistState(newState); 
    setIsSyncing(true);

    try {
      const currentSandboxState = enrollment.sandbox_state || {};
      const updatedSandboxState = {
        ...currentSandboxState,
        checklist_progress: {
          ...(currentSandboxState.checklist_progress || {}),
          [mission.id]: newState
        }
      };

      await supabase
        .from('enrollments')
        .update({ sandbox_state: updatedSandboxState })
        .eq('id', enrollment.id);
        
    } catch (err) {
      console.error("Failed to sync checklist", err);
      setChecklistState({ ...checklistState, [taskId]: checklistState[taskId] });
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>;
  if (!mission) return <div className="p-10">Workspace offline. No mission data found.</div>;

  const config = mission.mission_config || {};
  
  // Hardened parser: explicitly ensures every video gets a clean array of strings
  const videos = (config.videos || []).map((v: any) => {
    let cats: string[] = [];
    if (Array.isArray(v.categories)) {
      cats = v.categories;
    } else if (v.categories && typeof v.categories === 'string') {
      cats = [v.categories];
    } else if (v.category) {
      cats = [v.category];
    }
    return { ...v, categories: cats };
  });
  
  const blueprint = config.checklist_blueprint || [];
  
  // Bulletproof Extraction: Manually build the Set by looping through all arrays
  const usedCategorySet = new Set<string>();
  videos.forEach((vid: any) => {
    if (Array.isArray(vid.categories)) {
      vid.categories.forEach((cat: string) => {
        if (cat) usedCategorySet.add(cat);
      });
    }
  });

  // Construct final array with "All" fixed at the front
  const categories: string[] = ["All", ...Array.from(usedCategorySet)];

  // Filter logic: Show video if it's "All" OR if the video's array includes the active pill
  const filteredVideos = activeCategory === "All" 
    ? videos 
    : videos.filter((v: any) => v.categories.includes(activeCategory));

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 font-sans flex flex-col lg:flex-row gap-8 text-slate-800">
      
      {/* LEFT: VIDEO HUB */}
      <div className="flex-1 space-y-8">
        <Link href={`/student/course/${courseId}`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-xs uppercase tracking-widest transition-colors">
          <ArrowLeft size={16} /> Exit Workspace
        </Link>
        
        <div>
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tight text-slate-900">{mission.title}</h1>
          <p className="text-slate-500 font-medium mt-3 max-w-2xl leading-relaxed text-lg">{mission.lore_text || "Follow the guides and complete the objectives in your external workspace."}</p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat: string) => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                activeCategory === cat 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredVideos.map((vid: any) => (
            <button 
              key={vid.id} 
              onClick={() => setActiveVideo(vid)}
              className="bg-white border border-slate-200 rounded-[24px] p-2 hover:shadow-xl hover:border-blue-300 transition-all group cursor-pointer block text-left flex flex-col"
            >
              <div className="w-full aspect-video bg-slate-900 rounded-[18px] flex items-center justify-center relative overflow-hidden group-hover:bg-black transition-colors">
                 
                 <video 
                   src={vid.url} 
                   autoPlay 
                   muted 
                   loop 
                   playsInline 
                   className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity pointer-events-none"
                 />
                 
                 <PlayCircle className="text-white/80 group-hover:text-white group-hover:scale-110 transition-all w-14 h-14 z-10 relative drop-shadow-xl" />
                 
                 {/* Render ALL assigned categories on the card */}
                 <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 max-w-[90%]">
                   {vid.categories.length > 0 ? (
                     vid.categories.map((cat: string, idx: number) => (
                       <span key={idx} className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-white/90 backdrop-blur-md text-slate-800 shadow-sm border border-slate-200/50">
                         {cat}
                       </span>
                     ))
                   ) : (
                     <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-white/90 backdrop-blur-md text-slate-800 shadow-sm border border-slate-200/50">
                       Guide
                     </span>
                   )}
                 </div>
              </div>
              <div className="p-5 flex-1 flex items-center">
                <h3 className="font-black text-slate-800 text-lg leading-tight">{vid.title}</h3>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: COLLAB CHECKLIST */}
      <div className="w-full lg:w-[400px] shrink-0">
        <div className="sticky top-12 bg-white border border-slate-200 rounded-[32px] p-8 shadow-md">
          <div className="flex justify-between items-end border-b border-slate-100 pb-5 mb-6">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">Objectives</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live Sync Active</p>
            </div>
            {isSyncing && <Loader2 className="w-5 h-5 text-blue-500 animate-spin mb-1" />}
          </div>

          <div className="space-y-3">
            {blueprint.length === 0 ? (
              <p className="text-slate-400 text-sm italic">No tasks assigned for this sector.</p>
            ) : (
              blueprint.map((task: any) => {
                const isDone = checklistState[task.id] || false;
                return (
                  <button 
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex gap-4 items-start ${
                      isDone 
                      ? 'bg-emerald-50 border-emerald-100' 
                      : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors mt-0.5 ${
                      isDone ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-slate-300'
                    }`}>
                      {isDone && <Check size={14} className="text-white stroke-[3]" />}
                    </div>
                    <span className={`text-sm font-bold leading-snug transition-colors ${
                      isDone ? 'text-emerald-700 line-through opacity-60' : 'text-slate-700'
                    }`}>
                      {task.text}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* CINEMATIC VIDEO MODAL */}
      <AnimatePresence>
        {activeVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/95 backdrop-blur-md" 
              onClick={() => setActiveVideo(null)} 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-6xl bg-black rounded-[32px] overflow-hidden shadow-2xl border border-slate-800 flex flex-col"
            >
              <div className="flex justify-between items-center p-5 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Render ALL assigned categories in the modal header */}
                  {activeVideo.categories?.map((cat: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      {cat}
                    </span>
                  ))}
                  <h3 className="text-white font-bold text-lg ml-2">{activeVideo.title}</h3>
                </div>
                <button 
                  onClick={() => setActiveVideo(null)} 
                  className="p-2 bg-slate-800 hover:bg-red-500 hover:text-white rounded-full text-slate-400 transition-colors"
                >
                  <X size={20}/>
                </button>
              </div>
              
              <div className="w-full aspect-video bg-black relative">
                <video 
                  src={activeVideo.url} 
                  controls 
                  autoPlay 
                  className="w-full h-full outline-none" 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}