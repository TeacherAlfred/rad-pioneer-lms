"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { 
  ArrowLeft, Plus, Edit3, Trash2, 
  Gamepad2, GripVertical, Trophy, Code, FileText,
  X, Loader2, Save, Video, Settings, BookOpen, Layers, Zap, Download,
  LayoutDashboard, CheckCircle2, Calendar, Link as LinkIcon, Presentation, FileDown,
  MonitorPlay, ExternalLink, PlayCircle, PanelRightClose, PanelRightOpen
} from "lucide-react";

type Mission = {
  id: string;
  title: string;
  lore_text: string | null;
  video_url: string | null;
  xp_reward: number;
  order_index: number;
  sandbox_type: string;
  secret_code: string | null;
  secret_xp_bonus: number | null;
  sandbox_config: any | null;
  mission_config: any | null;
  unlock_date?: string | null;
};

type Module = {
  id: string;
  title: string;
  description: string;
  order_index: number;
  unlock_date?: string | null;
  missions: Mission[];
};

type Course = {
  id: string;
  title: string;
};

const formatDateTimeLocal = (dateString: string | null | undefined) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function CourseModulesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingMission, setEditingMission] = useState<any | null>(null);
  
  const [viewingMission, setViewingMission] = useState<any | null>(null);
  const [showTeacherToolkit, setShowTeacherToolkit] = useState(true);

  const [deepDiveView, setDeepDiveView] = useState<'main' | 'steps' | 'globals' | 'resources'>('main');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  async function fetchCourseData() {
    setIsLoading(true);
    try {
      const { data: courseData, error: courseError } = await supabase.from('courses').select('id, title').eq('id', courseId).single();
      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: modulesData, error: modulesError } = await supabase.from('modules').select(`*, missions (*)`).eq('course_id', courseId).order('order_index', { ascending: true });
      if (modulesError) throw modulesError;

      const sortedModules = (modulesData || []).map(mod => ({
        ...mod,
        missions: (mod.missions || []).sort((a: Mission, b: Mission) => a.order_index - b.order_index)
      }));

      setModules(sortedModules);
    } catch (error) {
      console.error("Error fetching module data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleExportCSV = () => {
    const headers = ["Module", "Mission", "Step", "Type", "XP", "Lore/Narrative", "Technical_Config", "Vocabulary_Glossary"];
    const rows = modules.flatMap(mod => 
      mod.missions.flatMap(miss => {
        const steps = miss.mission_config?.steps || [];
        if (steps.length === 0) {
          return [[mod.title, miss.title, "N/A", "N/A", miss.xp_reward, miss.lore_text || "", "No Config", ""]];
        }
        return steps.map((step: any, idx: number) => {
          const vocabGlossary = (step.vocabulary || [])
            .map((v: any) => `${v.term.toUpperCase()}: ${v.definition}`)
            .join(" | ");

          return [
            mod.title,
            miss.title,
            idx + 1,
            step.type,
            idx === 0 ? miss.xp_reward : 0, 
            `"${(step.lore_text || "").replace(/"/g, '""')}"`, 
            `"${JSON.stringify(step.win_sequence || step.prompts || {}).replace(/"/g, '""')}"`,
            `"${vocabGlossary.replace(/"/g, '""')}"`
          ];
        });
      })
    );

    const csvString = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${course?.title?.replace(/\s+/g, '_')}_Curriculum.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewMission = (mission: Mission) => {
    let safeMission = { ...mission };
    if (typeof safeMission.mission_config === 'string') {
      try { safeMission.mission_config = JSON.parse(safeMission.mission_config); } catch (e) {}
    }
    safeMission.mission_config = safeMission.mission_config || {};
    setViewingMission(safeMission);
    setShowTeacherToolkit(true); 
  };

  const handleOpenMissionEdit = (mission: Mission) => {
    let safeMission = { ...mission };
    if (typeof safeMission.mission_config === 'string') {
      try { safeMission.mission_config = JSON.parse(safeMission.mission_config); } catch (e) {}
    }
    if (typeof safeMission.sandbox_config === 'string') {
      try { safeMission.sandbox_config = JSON.parse(safeMission.sandbox_config); } catch (e) {}
    }
    
    safeMission.mission_config = safeMission.mission_config || {};
    safeMission.sandbox_config = safeMission.sandbox_config || {};
    
    (safeMission as any).unlock_date_input = formatDateTimeLocal(safeMission.unlock_date);
    
    if (!safeMission.mission_config.steps) safeMission.mission_config.steps = [];
    if (!safeMission.mission_config.theme) safeMission.mission_config.theme = {};
    if (!safeMission.mission_config.resources) {
        safeMission.mission_config.resources = { teacher_guide_url: "", slides_url: "", video_links: [] };
    }
    if (!safeMission.mission_config.toolbox) {
      safeMission.mission_config.toolbox = [];
      if (safeMission.mission_config.events?.length > 0) {
        safeMission.mission_config.toolbox.push({ category: "Events", color: "#eab308", blocks: safeMission.mission_config.events });
      }
      if (safeMission.mission_config.actions?.length > 0) {
        safeMission.mission_config.toolbox.push({ category: "Actions", color: "#3b82f6", blocks: safeMission.mission_config.actions });
      }
    }

    safeMission.mission_config.steps.forEach((step: any) => {
      if (step.cards && Array.isArray(step.cards)) {
        step.cards.sort((a: any, b: any) => a.order - b.order);
        step.cards.forEach((c: any, i: number) => {
          c.order = i + 1; 
          if (!c._dndId) c._dndId = `dnd-${Math.random().toString(36).substr(2, 9)}`;
        });
      }
    });

    setEditingMission(safeMission);
    setDeepDiveView('main');
    setActiveStepIndex(0);
  };

  const closeMissionEdit = () => {
    setEditingMission(null);
    setDeepDiveView('main');
  };

  async function handleUpdateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!editingModule) return;
    setIsSubmitting(true);
    try {
      const finalUnlockDate = (editingModule as any).unlock_date_input 
        ? new Date((editingModule as any).unlock_date_input).toISOString() 
        : null;

      const { error } = await supabase.from('modules').update({ 
        title: editingModule.title, 
        description: editingModule.description,
        unlock_date: finalUnlockDate 
      }).eq('id', editingModule.id);
      
      if (error) throw error;
      setEditingModule(null);
      fetchCourseData();
    } catch (error: any) { alert("Failed to update module."); } finally { setIsSubmitting(false); }
  }

  async function handleUpdateMission(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editingMission) return;
    setIsSubmitting(true);
    
    const payloadConfig = { ...editingMission.mission_config };
    delete payloadConfig.events;
    delete payloadConfig.actions;

    const finalUnlockDate = editingMission.unlock_date_input 
      ? new Date(editingMission.unlock_date_input).toISOString() 
      : null;

    try {
      const { error } = await supabase.from('missions').update({
          title: editingMission.title,
          lore_text: editingMission.lore_text,
          video_url: editingMission.video_url,
          xp_reward: editingMission.xp_reward,
          sandbox_type: editingMission.sandbox_type,
          secret_code: editingMission.secret_code,
          secret_xp_bonus: editingMission.secret_xp_bonus,
          mission_config: payloadConfig,
          sandbox_config: editingMission.sandbox_config,
          unlock_date: finalUnlockDate
        }).eq('id', editingMission.id);
      if (error) throw error;
      closeMissionEdit(); 
      fetchCourseData();
    } catch (error: any) { alert("Failed to update mission."); } finally { setIsSubmitting(false); }
  }

  const updateActiveStep = (key: string, value: any) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...(prev.mission_config.steps || [])];
      newSteps[activeStepIndex] = { ...newSteps[activeStepIndex], [key]: value };
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const updateResource = (key: string, value: any) => {
      setEditingMission((prev: any) => {
          if (!prev) return prev;
          const currentResources = prev.mission_config.resources || { teacher_guide_url: "", slides_url: "", video_links: [] };
          return {
              ...prev,
              mission_config: {
                  ...prev.mission_config,
                  resources: { ...currentResources, [key]: value }
              }
          };
      });
  };

  const addVideoLink = () => {
    setEditingMission((prev: any) => {
        if (!prev) return prev;
        const currentResources = prev.mission_config.resources || { teacher_guide_url: "", slides_url: "", video_links: [] };
        const currentVideos = currentResources.video_links || [];
        return {
            ...prev,
            mission_config: {
                ...prev.mission_config,
                resources: { ...currentResources, video_links: [...currentVideos, ""] }
            }
        };
    });
  };

  const updateVideoLink = (idx: number, val: string) => {
    setEditingMission((prev: any) => {
        if (!prev) return prev;
        const currentResources = prev.mission_config.resources || { teacher_guide_url: "", slides_url: "", video_links: [] };
        const currentVideos = [...(currentResources.video_links || [])];
        currentVideos[idx] = val;
        return {
            ...prev,
            mission_config: {
                ...prev.mission_config,
                resources: { ...currentResources, video_links: currentVideos }
            }
        };
    });
  };

  const removeVideoLink = (idx: number) => {
    setEditingMission((prev: any) => {
        if (!prev) return prev;
        const currentResources = prev.mission_config.resources || { teacher_guide_url: "", slides_url: "", video_links: [] };
        const currentVideos = [...(currentResources.video_links || [])];
        currentVideos.splice(idx, 1);
        return {
            ...prev,
            mission_config: {
                ...prev.mission_config,
                resources: { ...currentResources, video_links: currentVideos }
            }
        };
    });
  };

  const addCardToActiveStep = () => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      const currentCards = newSteps[activeStepIndex].cards || [];
      newSteps[activeStepIndex].cards = [
        ...currentCards, 
        { _dndId: `dnd-${Math.random().toString(36).substr(2, 9)}`, order: currentCards.length + 1, title: "", content: "", media_url: "" }
      ];
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const updateCardInActiveStep = (cIndex: number, key: 'title'|'content'|'media_url', value: string) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].cards[cIndex][key] = value;
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const removeCardFromActiveStep = (cIndex: number) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].cards.splice(cIndex, 1);
      newSteps[activeStepIndex].cards.forEach((c: any, i: number) => c.order = i + 1);
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      const cardsList = Array.from(newSteps[activeStepIndex].cards);
      const [reorderedItem] = cardsList.splice(sourceIndex, 1);
      cardsList.splice(destinationIndex, 0, reorderedItem);
      cardsList.forEach((c: any, i: number) => { c.order = i + 1; });
      newSteps[activeStepIndex].cards = cardsList;
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const addVocabularyToActiveStep = () => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      const currentVocab = newSteps[activeStepIndex].vocabulary || [];
      newSteps[activeStepIndex].vocabulary = [...currentVocab, { term: "New Term", definition: "Definition here" }];
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const updateVocabularyInActiveStep = (vIndex: number, key: 'term'|'definition', value: string) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].vocabulary[vIndex][key] = value;
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const removeVocabularyFromActiveStep = (vIndex: number) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].vocabulary.splice(vIndex, 1);
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const addWinSequenceItem = () => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      const currentSeq = newSteps[activeStepIndex].win_sequence || [];
      newSteps[activeStepIndex].win_sequence = [...currentSeq, ""];
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const updateWinSequenceItem = (sIndex: number, value: string) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].win_sequence[sIndex] = value;
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const removeWinSequenceItem = (sIndex: number) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].win_sequence.splice(sIndex, 1);
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const updateTheme = (key: string, value: string) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const currentTheme = prev.mission_config.theme || {};
      return { ...prev, mission_config: { ...prev.mission_config, theme: { ...currentTheme, [key]: value } } };
    });
  };

  const addToolboxCategory = () => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newToolbox = [...(prev.mission_config.toolbox || []), { category: "New Category", color: "#4ade80", blocks: [] }];
      return { ...prev, mission_config: { ...prev.mission_config, toolbox: newToolbox } };
    });
  };

  const updateToolboxCategory = (cIdx: number, key: string, val: string) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newToolbox = [...(prev.mission_config.toolbox || [])];
      newToolbox[cIdx] = { ...newToolbox[cIdx], [key]: val };
      return { ...prev, mission_config: { ...prev.mission_config, toolbox: newToolbox } };
    });
  };

  const removeToolboxCategory = (cIdx: number) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newToolbox = [...(prev.mission_config.toolbox || [])];
      newToolbox.splice(cIdx, 1);
      return { ...prev, mission_config: { ...prev.mission_config, toolbox: newToolbox } };
    });
  };

  const addToolboxBlock = (cIdx: number) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newToolbox = [...(prev.mission_config.toolbox || [])];
      newToolbox[cIdx].blocks = [...(newToolbox[cIdx].blocks || []), { label: "NEW BLOCK", value: "NEW_VALUE" }];
      return { ...prev, mission_config: { ...prev.mission_config, toolbox: newToolbox } };
    });
  };

  const updateToolboxBlock = (cIdx: number, bIdx: number, key: string, val: string) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newToolbox = [...(prev.mission_config.toolbox || [])];
      const newBlocks = [...(newToolbox[cIdx].blocks || [])];
      newBlocks[bIdx] = { ...newBlocks[bIdx], [key]: val };
      newToolbox[cIdx].blocks = newBlocks;
      return { ...prev, mission_config: { ...prev.mission_config, toolbox: newToolbox } };
    });
  };

  const removeToolboxBlock = (cIdx: number, bIdx: number) => {
    setEditingMission((prev: any) => {
      if (!prev) return prev;
      const newToolbox = [...(prev.mission_config.toolbox || [])];
      const newBlocks = [...(newToolbox[cIdx].blocks || [])];
      newBlocks.splice(bIdx, 1);
      newToolbox[cIdx].blocks = newBlocks;
      return { ...prev, mission_config: { ...prev.mission_config, toolbox: newToolbox } };
    });
  };

  if (isLoading) return <div className="flex justify-center py-20 bg-[#020617] h-screen items-center"><Loader2 className="animate-spin text-rad-blue" /></div>;

  return (
    <div className="min-h-screen bg-[#020617] p-6 lg:p-12 text-left">
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/courses" className="inline-flex items-center gap-2 text-slate-400 hover:text-rad-blue transition-colors text-sm font-bold uppercase tracking-widest">
              <ArrowLeft size={16} /> Back to Curriculum
            </Link>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
              <LayoutDashboard size={14} className="text-blue-400" /> Mission Control Hub
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">{course?.title}</h1>
              <p className="text-rad-blue text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                <Gamepad2 size={14} /> Workspace: Curriculum_Builder_v3.0
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-white/10 transition-colors">
                <Download size={18} className="text-rad-teal" /> Export CSV
              </button>
              <button className="flex items-center gap-2 bg-rad-blue text-[#020617] px-6 py-3 rounded-xl font-bold text-sm hover:bg-rad-blue/90 shadow-lg shadow-rad-blue/20">
                <Plus size={18} /> New Module
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {modules.map((mod, index) => (
            <div key={mod.id} className="bg-[#0f172a]/80 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-start gap-6">
                <div className="mt-1 text-slate-600 cursor-grab hover:text-white transition-colors"><GripVertical size={24} /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-black text-white italic uppercase flex items-center gap-4">
                      <span className="text-slate-500 font-bold text-[10px] tracking-widest bg-white/5 px-3 py-1 rounded-full uppercase not-italic">Module {index + 1}</span>
                      {mod.title}
                    </h2>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingModule({ ...mod, unlock_date_input: formatDateTimeLocal(mod.unlock_date) } as any)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl"><Edit3 size={18} /></button>
                      <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  {mod.unlock_date && (
                    <div className="mb-3 flex items-center gap-2 text-blue-400 bg-blue-400/5 py-1.5 px-3 rounded-lg border border-blue-400/10 w-fit">
                      <Calendar size={12} />
                      <span className="text-[9px] font-black uppercase tracking-widest italic">
                        Releases: {new Date(mod.unlock_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <p className="text-slate-400 text-sm leading-relaxed">{mod.description || "No description provided."}</p>
                </div>
              </div>
              <div className="p-8 bg-[#020617]/50 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Layers size={14} /> Mission Sequence
                  </h4>
                  <button className="text-[10px] font-bold text-rad-blue uppercase hover:text-white transition-colors">+ Add Mission</button>
                </div>
                {mod.missions.map((miss) => (
                  <div key={miss.id} className="group flex items-center justify-between bg-white/[0.02] border border-white/5 p-5 rounded-3xl hover:border-white/20 transition-all hover:bg-white/[0.04]">
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-2xl bg-rad-purple/10 text-rad-purple flex items-center justify-center border border-rad-purple/20">
                        {miss.sandbox_type === 'code' ? <Code size={18} /> : <Gamepad2 size={18} />}
                      </div>
                      <div>
                        <p className="text-white font-black text-base italic uppercase">{miss.title}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-slate-500 text-[9px] uppercase font-black tracking-widest">{miss.sandbox_type}</span>
                          <div className="flex items-center gap-1 text-rad-yellow text-[10px] font-black"><Trophy size={12}/>{miss.xp_reward} XP</div>
                          {miss.unlock_date && (
                             <div className="flex items-center gap-1 text-blue-400 text-[9px] font-black uppercase tracking-widest">
                               <Calendar size={10} /> {new Date(miss.unlock_date).toLocaleDateString()}
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleViewMission(miss)} 
                        className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 rounded-xl transition-all border border-transparent hover:border-emerald-400/30"
                        title="Present Lesson"
                      >
                        <MonitorPlay size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenMissionEdit(miss)} 
                        className="p-2 text-slate-400 hover:text-rad-blue hover:bg-rad-blue/10 rounded-xl transition-all border border-transparent hover:border-rad-blue/30"
                        title="Edit Logic"
                      >
                        <Edit3 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {editingModule && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div className="bg-[#020617] border border-white/10 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-8 border-b border-white/10 bg-white/[0.02]">
                  <h3 className="text-2xl font-black uppercase italic text-white tracking-tighter">Edit Module</h3>
                  <button onClick={() => setEditingModule(null)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                <form onSubmit={handleUpdateModule} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Module Title</label>
                    <input required type="text" value={editingModule.title} onChange={e => setEditingModule({...editingModule, title: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-rad-blue outline-none transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                    <textarea rows={4} value={editingModule.description || ""} onChange={e => setEditingModule({...editingModule, description: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 text-white resize-none focus:border-rad-blue outline-none transition-colors" />
                  </div>
                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Release Date</label>
                    <input type="datetime-local" value={(editingModule as any).unlock_date_input || ""} onChange={e => setEditingModule({...editingModule, unlock_date_input: e.target.value} as any)} className="w-full bg-[#0f172a] border border-blue-500/30 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-colors cursor-pointer" />
                    <p className="text-[9px] text-slate-500 italic mt-1 pl-1">Leave blank to inherit course settings or unlock immediately.</p>
                  </div>
                  <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={() => setEditingModule(null)} className="text-slate-500 font-bold uppercase text-xs tracking-widest px-6">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="bg-rad-blue text-[#020617] font-black uppercase text-xs tracking-widest px-10 py-4 rounded-2xl flex items-center gap-2 hover:bg-rad-blue/90 shadow-xl shadow-rad-blue/10">
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Module
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editingMission && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div className="bg-[#020617] border border-white/10 rounded-[48px] w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-8 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-6">
                    {deepDiveView !== 'main' && <button type="button" onClick={() => setDeepDiveView('main')} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all"><ArrowLeft size={20} /></button>}
                    <div>
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Storyboard_Config</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-rad-blue mt-1 italic">{editingMission.title}</p>
                    </div>
                  </div>
                  <button type="button" onClick={closeMissionEdit} className="text-slate-400 hover:text-white transition-colors"><X size={28} /></button>
                </div>

                {deepDiveView === 'main' && (
                  <div className="p-12 flex-1 bg-black/20 overflow-y-auto no-scrollbar space-y-12">
                    <div className="bg-[#0f172a]/60 border border-white/5 p-8 rounded-[32px] space-y-6">
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-white/5 pb-4">Mission Metadata</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                         <div className="space-y-2 lg:col-span-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mission Title</label>
                           <input required type="text" value={editingMission.title || ""} onChange={e => setEditingMission({...editingMission, title: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-rad-blue font-black uppercase italic tracking-tighter text-xl" />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">XP Reward</label>
                           <input required type="number" value={editingMission.xp_reward || 0} onChange={e => setEditingMission({...editingMission, xp_reward: parseInt(e.target.value) || 0})} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-rad-yellow font-black outline-none focus:border-rad-blue text-xl" />
                         </div>
                       </div>
                       <div className="space-y-2 pt-2 border-t border-white/5 mt-4">
                         <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Specific Mission Release Date</label>
                         <input type="datetime-local" value={editingMission.unlock_date_input || ""} onChange={e => setEditingMission({...editingMission, unlock_date_input: e.target.value})} className="w-full max-w-sm bg-[#020617] border border-blue-500/30 rounded-2xl px-6 py-4 text-white font-bold text-sm outline-none focus:border-blue-500 transition-colors cursor-pointer" />
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <button type="button" onClick={() => setDeepDiveView('steps')} className="text-left p-10 rounded-[40px] bg-rad-purple/5 border border-rad-purple/20 hover:border-rad-purple/50 transition-all group relative overflow-hidden">
                        <Layers size={40} className="text-rad-purple mb-6" />
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Sequence Editor</h3>
                      </button>
                      <button type="button" onClick={() => setDeepDiveView('globals')} className="text-left p-10 rounded-[40px] bg-rad-blue/5 border border-rad-blue/20 hover:border-rad-blue/50 transition-all group relative overflow-hidden">
                        <Settings size={40} className="text-rad-blue mb-6" />
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Global Context</h3>
                      </button>
                      <button type="button" onClick={() => setDeepDiveView('resources')} className="text-left p-10 rounded-[40px] bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/50 transition-all group relative overflow-hidden">
                        <BookOpen size={40} className="text-emerald-500 mb-6" />
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Educator Materials</h3>
                      </button>
                    </div>
                  </div>
                )}

                {deepDiveView === 'resources' && (
                  <div className="flex-1 overflow-y-auto p-12 bg-[#020617]/40 space-y-12 no-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-12">
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-white italic uppercase flex items-center gap-4">
                                <BookOpen className="text-rad-teal" /> Core Lesson Assets
                            </h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileDown size={14}/> Teacher Guide (PDF URL)</label>
                                    <input type="text" value={editingMission.mission_config.resources?.teacher_guide_url || ""} onChange={e => updateResource('teacher_guide_url', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-rad-teal text-sm" placeholder="https://..." />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Presentation size={14}/> Lesson Slides (PDF/URL)</label>
                                    <input type="text" value={editingMission.mission_config.resources?.slides_url || ""} onChange={e => updateResource('slides_url', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-rad-teal text-sm" placeholder="https://..." />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 border-t border-white/5 pt-12">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-black text-white italic uppercase flex items-center gap-4">
                                    <Video className="text-rad-teal" /> Reference Video Links
                                </h3>
                                <button type="button" onClick={addVideoLink} className="text-[10px] font-black text-rad-teal uppercase border border-rad-teal/30 px-5 py-2 rounded-2xl hover:bg-rad-teal/10 transition-all">+ Add Video</button>
                            </div>
                            <div className="space-y-4">
                                {editingMission.mission_config.resources?.video_links?.map((v: string, vIdx: number) => (
                                    <div key={vIdx} className="flex gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl items-center group">
                                        <LinkIcon className="text-slate-600" size={16} />
                                        <input type="text" value={v} onChange={e => updateVideoLink(vIdx, e.target.value)} className="flex-1 bg-transparent border-b border-white/10 text-white outline-none focus:border-rad-teal text-sm py-2" placeholder="https://youtube.com/..." />
                                        <button type="button" onClick={() => removeVideoLink(vIdx)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={18}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                  </div>
                )}

                {deepDiveView === 'steps' && (
                  <div className="flex flex-1 overflow-hidden bg-black/20">
                    <div className="w-80 border-r border-white/10 flex flex-col bg-[#0f172a]/40 shrink-0">
                      <div className="p-6 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Step_Timeline</h4>
                        <button type="button" onClick={() => {
                            const newStep = { type: 'intro', lore_text: 'New narrative...', media_url: '', cards: [], vocabulary: [] };
                            setEditingMission((prev: any) => ({ ...prev, mission_config: { ...prev.mission_config, steps: [...(prev.mission_config.steps || []), newStep] } }));
                        }} className="text-rad-purple text-[10px] font-black uppercase hover:underline">+ Add Step</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                        {editingMission.mission_config.steps?.map((step: any, idx: number) => (
                          <button type="button" key={idx} onClick={() => setActiveStepIndex(idx)} className={`w-full text-left p-5 rounded-3xl border transition-all ${activeStepIndex === idx ? 'bg-rad-purple/10 border-rad-purple/40 shadow-xl' : 'bg-black/40 border-white/5 hover:border-white/20'}`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black text-slate-500 uppercase">Step_{idx + 1}</span>
                              <span className="text-[8px] uppercase px-3 py-1 rounded-full bg-white/5 text-slate-300 font-black tracking-widest">{step.type}</span>
                            </div>
                            <p className="text-white text-xs font-bold italic line-clamp-1 uppercase tracking-tight">{step.lore_text || "Awaiting_Narrative"}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 no-scrollbar bg-[#020617]/40 w-full">
                      {editingMission.mission_config.steps?.[activeStepIndex] ? (
                        <div className="space-y-10 max-w-3xl">
                          <div className="flex justify-between items-center border-b border-white/5 pb-6">
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Step_Configuration</h3>
                            <select value={editingMission.mission_config.steps[activeStepIndex].type} onChange={(e) => updateActiveStep('type', e.target.value)} className="bg-[#020617] border border-white/10 rounded-2xl px-6 py-3 text-[10px] font-black uppercase text-white tracking-widest focus:border-rad-purple outline-none">
                              <option value="intro">Narrative Briefing</option>
                              <option value="code">Sandbox Code Task</option>
                              <option value="blueprint">Blueprint Selector</option>
                            </select>
                          </div>
                          <div className="space-y-8">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Briefing Narrative</label>
                              <textarea rows={6} value={editingMission.mission_config.steps[activeStepIndex].lore_text || ""} onChange={e => updateActiveStep('lore_text', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-[32px] px-8 py-6 text-white text-sm leading-relaxed outline-none focus:border-rad-purple transition-all" placeholder="Enter instructions here..." />
                            </div>
                          </div>

                          <div className="space-y-6 pt-10 border-t border-white/10">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2"><FileText size={16}/> Sequence Cards</label>
                              <button type="button" onClick={addCardToActiveStep} className="text-[10px] font-black text-blue-400 uppercase border border-blue-400/30 px-5 py-2 rounded-2xl hover:bg-blue-400/10 transition-all">+ Add Card</button>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="sequence-cards">
                                  {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                                      {editingMission.mission_config.steps[activeStepIndex].cards?.map((card: any, cIdx: number) => (
                                        <Draggable key={card._dndId} draggableId={card._dndId} index={cIdx}>
                                          {(provided, snapshot) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} className={`flex flex-col gap-4 p-6 bg-white/[0.02] border rounded-[32px] group transition-all ${snapshot.isDragging ? 'border-blue-500 shadow-2xl bg-[#0f172a]' : 'border-white/5 hover:border-white/20'}`}>
                                              <div className="flex justify-between items-center">
                                                <div {...provided.dragHandleProps} className="text-slate-600 hover:text-white cursor-grab active:cursor-grabbing"><GripVertical size={20} /></div>
                                                <button type="button" onClick={() => removeCardFromActiveStep(cIdx)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                              </div>
                                              <div className="space-y-3">
                                                 <input type="text" value={card.title || ""} onChange={e => updateCardInActiveStep(cIdx, 'title', e.target.value)} className="w-full bg-transparent border-b border-white/10 text-white font-black uppercase text-xl py-2 outline-none focus:border-blue-400" placeholder="CARD TITLE"/>
                                                 <textarea rows={3} value={card.content || ""} onChange={e => updateCardInActiveStep(cIdx, 'content', e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-sm text-slate-300 outline-none focus:border-blue-400 resize-none leading-relaxed" placeholder="Content..."/>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </DragDropContext>
                            </div>
                          </div>
                        </div>
                      ) : <div className="h-full flex items-center justify-center text-slate-500 font-black uppercase tracking-[0.4em] italic opacity-20">Initialize_Step_Editor</div>}
                    </div>
                  </div>
                )}

                {deepDiveView === 'globals' && (
                  <div className="flex-1 overflow-y-auto p-12 bg-[#020617]/40 space-y-16 no-scrollbar">
                    <div className="space-y-8">
                      <h4 className="text-xs font-black text-rad-teal uppercase border-b border-white/10 pb-4 tracking-[0.4em] italic">Interface_Calibration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Console Title Label</label>
                          <input type="text" value={editingMission.mission_config.theme?.console || ""} onChange={e => updateTheme('console', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-rad-teal outline-none font-bold uppercase italic" />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Objectives Label</label>
                          <input type="text" value={editingMission.mission_config.theme?.briefing || ""} onChange={e => updateTheme('briefing', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-rad-teal outline-none font-bold uppercase italic" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between border-b border-white/10 pb-4 items-center">
                        <h4 className="text-[10px] font-black text-rad-teal uppercase tracking-[0.2em] italic flex items-center gap-2"><Layers size={14}/> Sandbox Toolbox Configuration</h4>
                        <button type="button" onClick={addToolboxCategory} className="text-[9px] text-rad-teal font-black uppercase hover:underline">+ New Category</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                         {editingMission.mission_config.toolbox?.map((cat: any, cIdx: number) => (
                           <div key={cIdx} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-5">
                              <div className="flex items-center justify-between gap-4">
                                 <input type="color" value={cat.color || "#ffffff"} onChange={e => updateToolboxCategory(cIdx, 'color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-none p-0 shrink-0" />
                                 <input value={cat.category || ""} onChange={e => updateToolboxCategory(cIdx, 'category', e.target.value)} className="flex-1 bg-transparent border-b border-white/10 text-white font-black uppercase tracking-widest text-sm outline-none focus:border-rad-teal" placeholder="Category Name" />
                                 <button type="button" onClick={() => removeToolboxCategory(cIdx)} className="text-slate-600 hover:text-red-400 p-2"><Trash2 size={18}/></button>
                              </div>
                              <div className="space-y-2">
                                {cat.blocks?.map((block: any, bIdx: number) => (
                                  <div key={bIdx} className="flex gap-3 bg-[#020617] p-3 rounded-2xl items-center border border-white/5">
                                    <input value={block.label || ""} onChange={e => updateToolboxBlock(cIdx, bIdx, 'label', e.target.value)} className="bg-transparent text-white font-bold uppercase text-xs w-1/2 outline-none focus:border-rad-teal" />
                                    <input value={block.value || ""} onChange={e => updateToolboxBlock(cIdx, bIdx, 'value', e.target.value)} className="bg-transparent text-slate-500 font-mono text-[10px] w-1/2 outline-none focus:border-rad-teal uppercase" />
                                    <button type="button" onClick={() => removeToolboxBlock(cIdx, bIdx)} className="text-slate-700 hover:text-red-400 p-1"><X size={14}/></button>
                                  </div>
                                ))}
                              </div>
                              <button type="button" onClick={() => addToolboxBlock(cIdx)} className="text-[10px] text-slate-400 hover:text-white font-black uppercase w-full py-3 border border-dashed border-white/10 rounded-2xl"> + Add Block </button>
                           </div>
                         ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-8 border-t border-white/10 flex justify-end gap-6 shrink-0 bg-[#020617] items-center">
                  <button type="button" onClick={closeMissionEdit} className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">Discard_Session</button>
                  <button type="button" onClick={handleUpdateMission} disabled={isSubmitting} className="bg-rad-blue text-[#020617] font-black uppercase italic text-xs px-16 py-5 rounded-[20px] flex items-center gap-3 hover:bg-rad-blue/90 transition-all shadow-2xl shadow-rad-blue/20">
                    {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Sync_to_Terminal
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- PRESENTATION MODE MODAL --- */}
        <AnimatePresence>
          {viewingMission && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-[#020617] flex flex-col overflow-hidden">
              
              {/* Header */}
              <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
                    <MonitorPlay size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">{viewingMission.title}</h2>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Presentation Mode</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowTeacherToolkit(!showTeacherToolkit)} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showTeacherToolkit ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'}`}
                  >
                    {showTeacherToolkit ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                    {showTeacherToolkit ? 'Hide Toolkit' : 'Show Toolkit'}
                  </button>
                  <button 
                    onClick={() => setViewingMission(null)} 
                    className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 transition-colors px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    <X size={16} /> Exit Presentation
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* Left: The Lesson Narrative & Cards */}
                <div className="flex-1 overflow-y-auto p-12 bg-black/40 space-y-16 scroll-smooth">
                  {viewingMission.mission_config?.steps?.map((step: any, sIdx: number) => (
                    <div key={sIdx} className="max-w-4xl mx-auto space-y-10 relative">
                      
                      {step.lore_text && (
                        <div className="bg-blue-500/5 border border-blue-500/20 p-10 rounded-[40px]">
                          <p className="text-xl md:text-2xl font-medium text-blue-100 leading-relaxed font-mono">
                            {step.lore_text}
                          </p>
                        </div>
                      )}

                      {step.cards && step.cards.length > 0 && (
                        <div className="space-y-6">
                          {step.cards.map((card: any, cIdx: number) => (
                            <div key={cIdx} className="bg-white/[0.03] border border-white/10 rounded-[32px] p-8 flex flex-col md:flex-row gap-8 items-start">
                              <div className="w-12 h-12 shrink-0 bg-blue-500/20 text-blue-400 font-black italic text-xl flex items-center justify-center rounded-2xl border border-blue-500/30">
                                {card.order}
                              </div>
                              <div className="flex-1 space-y-4">
                                <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">{card.title}</h3>
                                <p className="text-slate-300 text-lg leading-relaxed">{card.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {(!viewingMission.mission_config?.steps || viewingMission.mission_config.steps.length === 0) && (
                    <div className="h-full flex items-center justify-center text-slate-500 font-black uppercase tracking-[0.4em] italic opacity-50">
                      No Narrative Steps Found
                    </div>
                  )}
                </div>

                {/* Right: Educator Toolkit Sidebar */}
                <AnimatePresence>
                  {showTeacherToolkit && (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }} 
                      animate={{ width: 400, opacity: 1 }} 
                      exit={{ width: 0, opacity: 0 }} 
                      className="border-l border-white/10 bg-[#0f172a] shrink-0 flex flex-col overflow-y-auto"
                    >
                      <div className="p-8 border-b border-white/5 space-y-2">
                        <h4 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                          <BookOpen className="text-emerald-400" size={20} /> Educator Toolkit
                        </h4>
                        <p className="text-slate-400 text-xs">Resources and media for this specific mission.</p>
                      </div>

                      <div className="p-8 space-y-10">
                        {/* Core Docs */}
                        <div className="space-y-4">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 pb-2">Core Materials</h5>
                          
                          {viewingMission.mission_config?.resources?.teacher_guide_url ? (
                            <a href={viewingMission.mission_config.resources.teacher_guide_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors group">
                              <div className="flex items-center gap-3">
                                <FileDown className="text-emerald-400" size={20} />
                                <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Teacher Guide</span>
                              </div>
                              <ExternalLink size={16} className="text-slate-500 group-hover:text-emerald-400" />
                            </a>
                          ) : (
                            <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-slate-600 text-xs font-bold italic uppercase">No Guide Attached</div>
                          )}

                          {viewingMission.mission_config?.resources?.slides_url ? (
                            <a href={viewingMission.mission_config.resources.slides_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors group">
                              <div className="flex items-center gap-3">
                                <Presentation className="text-emerald-400" size={20} />
                                <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Lesson Slides</span>
                              </div>
                              <ExternalLink size={16} className="text-slate-500 group-hover:text-emerald-400" />
                            </a>
                          ) : (
                            <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-slate-600 text-xs font-bold italic uppercase">No Slides Attached</div>
                          )}
                        </div>

                        {/* Videos */}
                        <div className="space-y-4">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 pb-2">Reference Videos</h5>
                          
                          {viewingMission.mission_config?.resources?.video_links && viewingMission.mission_config.resources.video_links.length > 0 ? (
                            <div className="space-y-3">
                              {viewingMission.mission_config.resources.video_links.map((url: string, idx: number) => (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl transition-colors group">
                                  <div className="flex items-center gap-3">
                                    <PlayCircle className="text-blue-400" size={20} />
                                    <span className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">Play Video {idx + 1}</span>
                                  </div>
                                  <ExternalLink size={16} className="text-blue-500/50 group-hover:text-blue-400" />
                                </a>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center text-slate-600 text-xs font-bold italic uppercase">No Videos Attached</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}