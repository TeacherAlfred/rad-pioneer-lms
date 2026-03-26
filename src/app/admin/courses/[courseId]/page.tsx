"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Plus, Edit3, Trash2, 
  Gamepad2, GripVertical, Trophy, Code, FileText,
  X, Loader2, Save, Video, Key, Settings, BookOpen, ChevronRight, Layers, Target, Palette, Zap, PlaySquare
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
};

type Module = {
  id: string;
  title: string;
  description: string;
  order_index: number;
  missions: Mission[];
};

type Course = {
  id: string;
  title: string;
};

export default function CourseModulesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- EDIT STATE ---
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [missionEditMode, setMissionEditMode] = useState<'quick' | 'deep' | null>(null);
  
  // View states for the Deep Dive Config
  const [deepDiveView, setDeepDiveView] = useState<'main' | 'steps' | 'globals'>('main');
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

  const handleOpenMissionEdit = (mission: Mission, mode: 'quick' | 'deep') => {
    let safeMission = { ...mission };

    if (typeof safeMission.mission_config === 'string') {
      try { safeMission.mission_config = JSON.parse(safeMission.mission_config); } catch (e) {}
    }
    if (typeof safeMission.sandbox_config === 'string') {
      try { safeMission.sandbox_config = JSON.parse(safeMission.sandbox_config); } catch (e) {}
    }

    safeMission.mission_config = safeMission.mission_config || {};
    safeMission.sandbox_config = safeMission.sandbox_config || {};

    // Safely initialize all storyboard arrays and objects
    if (!safeMission.mission_config.steps) safeMission.mission_config.steps = [];
    if (!safeMission.mission_config.events) safeMission.mission_config.events = [];
    if (!safeMission.mission_config.actions) safeMission.mission_config.actions = [];
    if (!safeMission.mission_config.theme) safeMission.mission_config.theme = {};

    setEditingMission(safeMission);
    setMissionEditMode(mode);
    setDeepDiveView('main');
    setActiveStepIndex(0);
  };

  const closeMissionEdit = () => {
    setEditingMission(null);
    setMissionEditMode(null);
    setDeepDiveView('main');
  };

  async function handleUpdateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!editingModule) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('modules').update({ title: editingModule.title, description: editingModule.description }).eq('id', editingModule.id);
      if (error) throw error;
      setEditingModule(null);
      fetchCourseData();
    } catch (error: any) { alert("Failed to update module."); } finally { setIsSubmitting(false); }
  }

  async function handleUpdateMission(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editingMission) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('missions').update({
          title: editingMission.title,
          lore_text: editingMission.lore_text,
          video_url: editingMission.video_url,
          xp_reward: editingMission.xp_reward,
          sandbox_type: editingMission.sandbox_type,
          secret_code: editingMission.secret_code,
          secret_xp_bonus: editingMission.secret_xp_bonus,
          mission_config: editingMission.mission_config,
          sandbox_config: editingMission.sandbox_config
        }).eq('id', editingMission.id);

      if (error) throw error;
      closeMissionEdit(); 
      fetchCourseData();
    } catch (error: any) { alert("Failed to update mission."); } finally { setIsSubmitting(false); }
  }

  // --- STORYBOARD STEP UPDATERS ---
  const updateActiveStep = (key: string, value: any) => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const newSteps = [...(prev.mission_config.steps || [])];
      newSteps[activeStepIndex] = { ...newSteps[activeStepIndex], [key]: value };
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const addVocabularyToActiveStep = () => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      const currentVocab = newSteps[activeStepIndex].vocabulary || [];
      newSteps[activeStepIndex].vocabulary = [...currentVocab, { term: "New Term", definition: "Definition here" }];
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const updateVocabularyInActiveStep = (vIndex: number, key: 'term'|'definition', value: string) => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].vocabulary[vIndex][key] = value;
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const removeVocabularyFromActiveStep = (vIndex: number) => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      newSteps[activeStepIndex].vocabulary.splice(vIndex, 1);
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  const addWinSequenceToActionStep = () => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const newSteps = [...prev.mission_config.steps];
      const currentSeq = newSteps[activeStepIndex].win_sequence || [];
      newSteps[activeStepIndex].win_sequence = [...currentSeq, "NEW_ACTION"];
      return { ...prev, mission_config: { ...prev.mission_config, steps: newSteps } };
    });
  };

  // --- GLOBAL THEME & EVENTS UPDATERS ---
  const updateTheme = (key: string, value: string) => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const currentTheme = prev.mission_config.theme || {};
      return { ...prev, mission_config: { ...prev.mission_config, theme: { ...currentTheme, [key]: value } } };
    });
  };

  const addGlobalItem = (type: 'events' | 'actions') => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const currentList = prev.mission_config[type] || [];
      return { ...prev, mission_config: { ...prev.mission_config, [type]: [...currentList, { label: "NEW LABEL", value: "NEW_VALUE" }] } };
    });
  };

  const updateGlobalItem = (type: 'events' | 'actions', index: number, key: 'label'|'value', val: string) => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const newList = [...(prev.mission_config[type] || [])];
      newList[index] = { ...newList[index], [key]: val };
      return { ...prev, mission_config: { ...prev.mission_config, [type]: newList } };
    });
  };

  const removeGlobalItem = (type: 'events' | 'actions', index: number) => {
    setEditingMission(prev => {
      if (!prev) return prev;
      const newList = [...(prev.mission_config[type] || [])];
      newList.splice(index, 1);
      return { ...prev, mission_config: { ...prev.mission_config, [type]: newList } };
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-rad-blue border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* HEADER & MODULES LIST */}
      <div className="space-y-4">
        <Link href="/admin/courses" className="inline-flex items-center gap-2 text-slate-400 hover:text-rad-blue transition-colors text-sm font-bold uppercase tracking-widest"><ArrowLeft size={16} /> Back to Curriculum</Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">{course?.title || "Loading Course..."}</h1>
            <p className="text-rad-blue text-xs font-black uppercase tracking-widest mt-1 flex items-center gap-2"><Gamepad2 size={14} /> Gamified Path Modules</p>
          </div>
          <button className="flex items-center gap-2 bg-rad-blue text-[#020617] px-6 py-3 rounded-xl font-bold text-sm hover:bg-rad-blue/90 transition-colors shadow-lg shadow-rad-blue/20"><Plus size={18} /> Add New Module</button>
        </div>
      </div>

      <div className="space-y-6">
        {modules.map((mod, index) => (
          <div key={mod.id} className="bg-[#0f172a]/80 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-start gap-4">
              <div className="mt-1 cursor-grab text-slate-600 hover:text-white transition-colors"><GripVertical size={20} /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-black text-white flex items-center gap-3"><span className="text-slate-500 font-bold text-sm">MOD {index + 1}</span>{mod.title}</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingModule(mod)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"><Edit3 size={16} /></button>
                    <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{mod.description || "No description provided."}</p>
              </div>
            </div>
            
            <div className="p-6 bg-[#020617]/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Missions in this Module</h4>
                <button className="text-xs font-bold text-rad-blue hover:text-white transition-colors flex items-center gap-1"><Plus size={14} /> Add Mission</button>
              </div>
              {mod.missions.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                  <p className="text-slate-500 text-sm italic">No missions added yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mod.missions.map((mission) => (
                    <div key={mission.id} className="group flex items-center justify-between bg-white/[0.03] border border-white/5 hover:border-white/10 p-4 rounded-2xl transition-all">
                      <div className="flex items-center gap-4">
                        <div className="cursor-grab text-slate-600 hover:text-white transition-colors"><GripVertical size={16} /></div>
                        <div className="w-8 h-8 rounded-full bg-rad-purple/20 text-rad-purple flex items-center justify-center border border-rad-purple/30 shrink-0">
                          {mission.sandbox_type === 'code' ? <Code size={14} /> : <Gamepad2 size={14} />}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{mission.title}</p>
                          <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-0.5 flex items-center gap-1">Type: {mission.sandbox_type || 'Standard'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-rad-yellow/10 border border-rad-yellow/20 text-rad-yellow">
                          <Trophy size={12} />
                          <span className="text-xs font-black">{mission.xp_reward || 0} XP</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button title="Quick Edit" onClick={() => handleOpenMissionEdit(mission, 'quick')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all"><Edit3 size={14} /></button>
                          <button title="Storyboard Editor" onClick={() => handleOpenMissionEdit(mission, 'deep')} className="p-1.5 text-slate-400 hover:text-rad-blue hover:bg-rad-blue/10 rounded-md transition-all"><Settings size={14} /></button>
                          <button className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- EDIT MODULE MODAL --- */}
      <AnimatePresence>
        {editingModule && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#020617] border border-white/10 rounded-[32px] w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02]">
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Edit Module</h3>
                <button onClick={() => setEditingModule(null)} className="text-slate-400 hover:text-white transition-all"><X size={20} /></button>
              </div>
              <form onSubmit={handleUpdateModule} className="p-6 space-y-6 bg-black/20">
                <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Module Title</label><input required type="text" value={editingModule.title} onChange={e => setEditingModule({...editingModule, title: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</label><textarea rows={4} value={editingModule.description || ""} onChange={e => setEditingModule({...editingModule, description: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none" /></div>
                <div className="pt-4 border-t border-white/10 flex justify-end gap-3"><button type="button" onClick={() => setEditingModule(null)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-400">Cancel</button><button type="submit" disabled={isSubmitting} className="px-6 py-3 rounded-xl bg-rad-blue text-[#020617] font-bold text-sm"><Loader2 size={16} className={isSubmitting ? "animate-spin" : "hidden"} /> Save</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- QUICK EDIT MISSION MODAL --- */}
      <AnimatePresence>
        {editingMission && missionEditMode === 'quick' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#020617] border border-white/10 rounded-[32px] w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02] shrink-0"><h3 className="text-lg font-black uppercase italic text-white">Quick Edit</h3><button onClick={closeMissionEdit} className="text-slate-400"><X size={20} /></button></div>
              <form onSubmit={handleUpdateMission} className="p-5 space-y-5 bg-black/20">
                <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mission Title</label><input required type="text" value={editingMission.title || ""} onChange={e => setEditingMission({...editingMission, title: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1"><Trophy size={12} className="text-rad-yellow" /> XP Reward</label><input required type="number" value={editingMission.xp_reward || 0} onChange={e => setEditingMission({...editingMission, xp_reward: parseInt(e.target.value) || 0})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white" /></div>
                <div className="pt-2 flex justify-end gap-3 shrink-0"><button type="button" onClick={closeMissionEdit} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400">Cancel</button><button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-rad-blue text-[#020617] font-bold text-sm">Save</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DEEP DIVE STORYBOARD MODAL --- */}
      <AnimatePresence>
        {editingMission && missionEditMode === 'deep' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#020617] border border-white/10 rounded-[32px] w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-4">
                  {deepDiveView !== 'main' && <button onClick={() => setDeepDiveView('main')} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"><ArrowLeft size={16} /></button>}
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">
                      {deepDiveView === 'main' && "Storyboard Configuration"}
                      {deepDiveView === 'steps' && "Mission Steps Editor"}
                      {deepDiveView === 'globals' && "Global Theme & Events"}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rad-blue mt-1">{editingMission.title}</p>
                  </div>
                </div>
                <button onClick={closeMissionEdit} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white"><X size={20} /></button>
              </div>

              {/* VIEW 1: MAIN DASHBOARD */}
              {deepDiveView === 'main' && (
                <div className="p-8 overflow-y-auto no-scrollbar space-y-8 bg-black/20 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button type="button" onClick={() => setDeepDiveView('steps')} className="text-left flex flex-col justify-center p-8 rounded-3xl bg-gradient-to-br from-rad-purple/20 to-[#0f172a] border border-rad-purple/30 hover:border-rad-purple/60 transition-all group">
                      <Layers size={32} className="text-rad-purple mb-4" />
                      <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Storyboard Steps</h3>
                      <p className="text-slate-400 text-sm mt-2">Edit intros, code challenges, vocab, and blueprints.</p>
                      <div className="mt-6 flex items-center gap-2 text-xs font-bold text-rad-purple uppercase tracking-widest group-hover:translate-x-2 transition-transform">Enter Editor <ArrowLeft size={14} className="rotate-180" /></div>
                    </button>

                    {/* NEW: WIRED UP GLOBALS BUTTON */}
                    <button type="button" onClick={() => setDeepDiveView('globals')} className="text-left flex flex-col justify-center p-8 rounded-3xl bg-gradient-to-br from-rad-blue/10 to-[#0f172a] border border-rad-blue/30 hover:border-rad-blue/60 transition-all group">
                      <Settings size={32} className="text-rad-blue mb-4" />
                      <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Global Theme & Events</h3>
                      <p className="text-slate-400 text-sm mt-2">Configure environment terms, triggers, and allowed actions.</p>
                      <div className="mt-6 flex items-center gap-2 text-xs font-bold text-rad-blue uppercase tracking-widest group-hover:translate-x-2 transition-transform">Enter Editor <ArrowLeft size={14} className="rotate-180" /></div>
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 2: THE STORYBOARD STEPS EDITOR */}
              {deepDiveView === 'steps' && (
                <div className="flex flex-1 overflow-hidden bg-black/20">
                  <div className="w-1/3 border-r border-white/10 flex flex-col bg-[#0f172a]/50">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mission Sequence</h4>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                      {editingMission.mission_config.steps?.map((step: any, idx: number) => (
                        <button key={idx} onClick={() => setActiveStepIndex(idx)} className={`w-full text-left p-4 rounded-xl border transition-all ${activeStepIndex === idx ? 'bg-rad-purple/10 border-rad-purple/50' : 'bg-[#020617] border-white/5 hover:border-white/20'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Step {idx + 1}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${step.type === 'code' ? 'bg-rad-blue/20 text-rad-blue' : step.type === 'blueprint' ? 'bg-rad-teal/20 text-rad-teal' : 'bg-slate-800 text-slate-300'}`}>{step.type}</span>
                          </div>
                          <p className="text-white text-sm font-medium line-clamp-1">{step.lore_text || "No lore text..."}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 no-scrollbar relative">
                    {editingMission.mission_config.steps && editingMission.mission_config.steps[activeStepIndex] ? (
                      <div className="space-y-8 max-w-2xl">
                        <div className="flex items-center justify-between">
                          <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Editing Step {activeStepIndex + 1}</h3>
                          <select value={editingMission.mission_config.steps[activeStepIndex].type} onChange={(e) => updateActiveStep('type', e.target.value)} className="bg-[#020617] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-rad-purple">
                            <option value="intro">Intro</option>
                            <option value="code">Code Task</option>
                            <option value="blueprint">Blueprint</option>
                            <option value="capture">Capture</option>
                          </select>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lore Text (The Narrative)</label><textarea rows={4} value={editingMission.mission_config.steps[activeStepIndex].lore_text || ""} onChange={e => updateActiveStep('lore_text', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-purple" /></div>
                          <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Media URL (Image / Video)</label><input type="text" value={editingMission.mission_config.steps[activeStepIndex].media_url || ""} onChange={e => updateActiveStep('media_url', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-purple" /></div>
                        </div>

                        {['intro', 'code'].includes(editingMission.mission_config.steps[activeStepIndex].type) && (
                          <div className="space-y-3 pt-6 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2"><BookOpen size={12}/> Highlighted Vocabulary</label>
                              <button onClick={addVocabularyToActiveStep} className="text-[10px] font-bold text-rad-purple flex items-center gap-1 hover:text-white"><Plus size={12}/> Add Term</button>
                            </div>
                            {(editingMission.mission_config.steps[activeStepIndex].vocabulary || []).map((vItem: any, vIdx: number) => (
                              <div key={vIdx} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                <div className="flex-1 space-y-2">
                                  <input type="text" value={vItem.term} onChange={e => updateVocabularyInActiveStep(vIdx, 'term', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-sm text-rad-purple font-bold focus:outline-none focus:border-rad-purple" placeholder="Term..." />
                                  <input type="text" value={vItem.definition} onChange={e => updateVocabularyInActiveStep(vIdx, 'definition', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-rad-purple" placeholder="Definition..." />
                                </div>
                                <button onClick={() => removeVocabularyFromActiveStep(vIdx)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                              </div>
                            ))}
                          </div>
                        )}

                        {editingMission.mission_config.steps[activeStepIndex].type === 'code' && (
                          <div className="space-y-3 pt-6 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-rad-blue flex items-center gap-2"><Target size={12}/> Win Sequence (Action Array)</label>
                              <button onClick={addWinSequenceToActionStep} className="text-[10px] font-bold text-rad-blue flex items-center gap-1 hover:text-white"><Plus size={12}/> Add Block</button>
                            </div>
                            <div className="flex flex-col gap-2 p-4 rounded-xl bg-rad-blue/5 border border-rad-blue/20">
                              {(editingMission.mission_config.steps[activeStepIndex].win_sequence || []).map((action: string, sIdx: number) => (
                                <div key={sIdx} className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-500 w-4">{sIdx + 1}.</span>
                                  <input type="text" value={action} onChange={e => { const newSeq = [...editingMission.mission_config.steps[activeStepIndex].win_sequence]; newSeq[sIdx] = e.target.value; updateActiveStep('win_sequence', newSeq); }} className="flex-1 bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rad-blue" />
                                  <button onClick={() => { const newSeq = [...editingMission.mission_config.steps[activeStepIndex].win_sequence]; newSeq.splice(sIdx, 1); updateActiveStep('win_sequence', newSeq); }} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={14}/></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {editingMission.mission_config.steps[activeStepIndex].type === 'blueprint' && (
                          <div className="space-y-3 pt-6 border-t border-white/10">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-rad-teal flex items-center gap-2"><FileText size={12}/> Blueprint Prompts (Raw JSON)</label>
                            <textarea rows={10} value={JSON.stringify(editingMission.mission_config.steps[activeStepIndex].prompts, null, 2) || "{}"} onChange={e => { try { updateActiveStep('prompts', JSON.parse(e.target.value)); } catch(err) {} }} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-rad-teal" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500 text-sm">Select a step to edit.</div>
                    )}
                  </div>
                </div>
              )}

              {/* NEW VIEW 3: GLOBAL THEME & EVENTS EDITOR */}
              {deepDiveView === 'globals' && (
                <div className="flex-1 overflow-y-auto p-8 bg-black/20 no-scrollbar">
                  <div className="max-w-4xl mx-auto space-y-12">
                    
                    {/* SECTION 1: THEME OVERLAY */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Palette size={18} className="text-rad-teal" />
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-300">Theme Overlay</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Console Title</label>
                          <input type="text" value={editingMission.mission_config.theme?.console || ""} onChange={e => updateTheme('console', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-teal" placeholder="e.g. Engine_Compile_Logs" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Briefing Title</label>
                          <input type="text" value={editingMission.mission_config.theme?.briefing || ""} onChange={e => updateTheme('briefing', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-teal" placeholder="e.g. Director's_Brief" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Verify Button Text</label>
                          <input type="text" value={editingMission.mission_config.theme?.verifyBtn || ""} onChange={e => updateTheme('verifyBtn', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-teal" placeholder="e.g. Test Logic" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Success Code Prefix</label>
                          <input type="text" value={editingMission.mission_config.theme?.successCode || ""} onChange={e => updateTheme('successCode', e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rad-teal" placeholder="e.g. LOGIC_VERIFIED" />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2 & 3: TRIGGERS AND ACTIONS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* EVENTS (TRIGGERS) */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="flex items-center gap-2">
                            <Zap size={16} className="text-rad-yellow" />
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-300">Allowed Events (Triggers)</h4>
                          </div>
                          <button onClick={() => addGlobalItem('events')} className="text-[10px] font-bold text-rad-yellow flex items-center gap-1 hover:text-white"><Plus size={12}/> Add Trigger</button>
                        </div>
                        <div className="space-y-3">
                          {editingMission.mission_config.events?.map((ev: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                              <div className="flex-1 space-y-2">
                                <input type="text" value={ev.label} onChange={e => updateGlobalItem('events', idx, 'label', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-sm text-white font-bold focus:outline-none focus:border-rad-yellow" placeholder="Label (e.g. UP ARROW)" />
                                <input type="text" value={ev.value} onChange={e => updateGlobalItem('events', idx, 'value', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-xs font-mono text-slate-400 focus:outline-none focus:border-rad-yellow" placeholder="Value (e.g. UP_ARROW)" />
                              </div>
                              <button onClick={() => removeGlobalItem('events', idx)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                            </div>
                          ))}
                          {editingMission.mission_config.events?.length === 0 && <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-white/5 rounded-xl">No events configured.</p>}
                        </div>
                      </div>

                      {/* ACTIONS (OUTPUTS) */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="flex items-center gap-2">
                            <PlaySquare size={16} className="text-rad-blue" />
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-300">Allowed Actions (Outputs)</h4>
                          </div>
                          <button onClick={() => addGlobalItem('actions')} className="text-[10px] font-bold text-rad-blue flex items-center gap-1 hover:text-white"><Plus size={12}/> Add Action</button>
                        </div>
                        <div className="space-y-3">
                          {editingMission.mission_config.actions?.map((act: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                              <div className="flex-1 space-y-2">
                                <input type="text" value={act.label} onChange={e => updateGlobalItem('actions', idx, 'label', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-sm text-white font-bold focus:outline-none focus:border-rad-blue" placeholder="Label (e.g. MOVE 10 STEPS)" />
                                <input type="text" value={act.value} onChange={e => updateGlobalItem('actions', idx, 'value', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-xs font-mono text-slate-400 focus:outline-none focus:border-rad-blue" placeholder="Value (e.g. MOVE_10)" />
                              </div>
                              <button onClick={() => removeGlobalItem('actions', idx)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                            </div>
                          ))}
                          {editingMission.mission_config.actions?.length === 0 && <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-white/5 rounded-xl">No actions configured.</p>}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div className="p-6 border-t border-white/10 bg-[#020617] flex justify-end gap-3 shrink-0">
                <button type="button" onClick={closeMissionEdit} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="button" onClick={handleUpdateMission} disabled={isSubmitting} className="px-6 py-3 rounded-xl bg-rad-blue text-[#020617] font-bold text-sm hover:bg-rad-blue/90 transition-colors flex items-center gap-2">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}