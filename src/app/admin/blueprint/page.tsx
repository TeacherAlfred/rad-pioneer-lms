"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, ListTree, Zap, BookOpen, Clock, Users, 
  Target, ShieldAlert, ArrowLeft, ChevronUp, ChevronDown, Save, Trash2, X, Loader2, Info, Activity, History, CheckCircle2, Circle, Tag
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function GrowthBlueprint() {
  const [loading, setLoading] = useState(true);
  const [issaving, setIsSaving] = useState(false);
  const [features, setFeatures] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // WORKSPACE STATES
  const [showAddModal, setShowAddModal] = useState<'feature' | 'course' | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ type: 'feature' | 'course', data: any } | null>(null);
  
  // TASK & TAG STATES
  const [newTaskText, setNewTaskText] = useState("");
  const [taggingTaskId, setTaggingTaskId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([
    "Dictionary", "Media", "Workspace", "Translator", "Core UI", "Database", "Bug Fix", "High Priority"
  ]);

  // FORM STATES
  const [featureForm, setFeatureForm] = useState({ title: '', description: '', effort: 1, impact: 'Finance' });
  const [courseForm, setCourseForm] = useState({ title: '', description: '', age: '8-12', objective: 'Lead Gen' });

  useEffect(() => {
    fetchBlueprint();
  }, []);

  async function fetchBlueprint() {
    const { data: f } = await supabase.from('roadmap_features').select('*').order('priority_order', { ascending: true });
    const { data: c } = await supabase.from('roadmap_courses').select('*').order('priority_order', { ascending: true });
    setFeatures(f || []);
    setCourses(c || []);
    
    // Extract any unique tags already stored in the DB to populate the datalist
    const allTags = new Set(availableTags);
    const extractTags = (items: any[]) => {
      items.forEach(item => {
        (item.tasks || []).forEach((t: any) => {
          (t.tags || []).forEach((tag: string) => allTags.add(tag));
        });
      });
    };
    extractTags(f || []);
    extractTags(c || []);
    setAvailableTags(Array.from(allTags));
    
    setLoading(false);
  }

  const handleUpdateNode = async (updatedData: any) => {
    setIsSaving(true);
    const table = selectedNode?.type === 'feature' ? 'roadmap_features' : 'roadmap_courses';
    const { error } = await supabase.from(table).update(updatedData).eq('id', selectedNode?.data.id);
    
    if (!error) {
      await fetchBlueprint();
      setSelectedNode(null);
    }
    setIsSaving(false);
  };

  const handleAddFeature = async () => {
    if (!featureForm.title) return;
    setIsSaving(true);
    await supabase.from('roadmap_features').insert({
      title: featureForm.title,
      description: featureForm.description,
      effort_hours: featureForm.effort,
      impact_area: featureForm.impact,
      priority_order: features.length + 1,
      tasks: [] 
    });
    setFeatureForm({ title: '', description: '', effort: 1, impact: 'Finance' });
    setShowAddModal(null);
    fetchBlueprint();
    setIsSaving(false);
  };

  const handleAddCourse = async () => {
    if (!courseForm.title) return;
    setIsSaving(true);
    await supabase.from('roadmap_courses').insert({
      title: courseForm.title,
      description: courseForm.description,
      target_age: courseForm.age,
      objective: courseForm.objective,
      priority_order: courses.length + 1,
      tasks: [] 
    });
    setCourseForm({ title: '', description: '', age: '8-12', objective: 'Lead Gen' });
    setShowAddModal(null);
    fetchBlueprint();
    setIsSaving(false);
  };

  // --- SUB-TASK MANAGEMENT LOGIC ---
  const handleAddTask = () => {
    if (!newTaskText.trim() || !selectedNode) return;
    
    const newTask = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTaskText,
      status: 'Planned',
      tags: [] // Initialize with empty tags array
    };

    const currentTasks = selectedNode.data.tasks || [];
    setSelectedNode({
      ...selectedNode,
      data: { ...selectedNode.data, tasks: [...currentTasks, newTask] }
    });
    setNewTaskText("");
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: string) => {
    if (!selectedNode) return;
    const updatedTasks = (selectedNode.data.tasks || []).map((t: any) => 
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, tasks: updatedTasks } });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!selectedNode) return;
    const updatedTasks = (selectedNode.data.tasks || []).filter((t: any) => t.id !== taskId);
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, tasks: updatedTasks } });
  };

  // --- NEW: MULTI-SELECT TAG LOGIC ---
  const handleAddTag = (taskId: string) => {
    if (!tagInput.trim() || !selectedNode) return;
    const formattedTag = tagInput.trim();

    // Add to global available tags if it's completely new
    if (!availableTags.includes(formattedTag)) {
      setAvailableTags(prev => [...prev, formattedTag]);
    }

    const updatedTasks = (selectedNode.data.tasks || []).map((t: any) => {
      if (t.id === taskId) {
        const currentTags = t.tags || [];
        if (!currentTags.includes(formattedTag)) {
          return { ...t, tags: [...currentTags, formattedTag] };
        }
      }
      return t;
    });

    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, tasks: updatedTasks } });
    setTagInput("");
    setTaggingTaskId(null);
  };

  const handleRemoveTag = (taskId: string, tagToRemove: string) => {
    if (!selectedNode) return;
    const updatedTasks = (selectedNode.data.tasks || []).map((t: any) => {
      if (t.id === taskId) {
        return { ...t, tags: (t.tags || []).filter((tag: string) => tag !== tagToRemove) };
      }
      return t;
    });
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, tasks: updatedTasks } });
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-fuchsia-500" /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-fuchsia-500/30 text-left">
      
      {/* Hidden Datalist for Tag Auto-complete */}
      <datalist id="available-tags-list">
        {availableTags.map(tag => <option key={tag} value={tag} />)}
      </datalist>

      <div className="max-w-7xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all">
              <ArrowLeft size={14} /> Back to Command Center
            </Link>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Growth_<span className="text-fuchsia-500">Blueprint</span></h1>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 text-left">
          <BlueprintSection title="Feature_Forge" icon={<Zap size={20}/>} color="text-blue-400" onAdd={() => setShowAddModal('feature')}>
            {features.map((item) => <BlueprintCard key={item.id} type="feature" data={item} onDetail={() => setSelectedNode({ type: 'feature', data: item })} />)}
          </BlueprintSection>

          <BlueprintSection title="Curriculum_Pipeline" icon={<BookOpen size={20}/>} color="text-emerald-400" onAdd={() => setShowAddModal('course')}>
            {courses.map((item) => <BlueprintCard key={item.id} type="course" data={item} onDetail={() => setSelectedNode({ type: 'course', data: item })} />)}
          </BlueprintSection>
        </div>
      </div>

      {/* --- ADD MODAL --- */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-lg bg-[#0f172a] shadow-2xl flex flex-col p-8 rounded-[40px] border border-white/10 max-h-[90vh] overflow-y-auto text-left"
            >
              <div className="flex items-center justify-between pb-6 border-b border-white/5 mb-6">
                <div>
                  <h2 className={`text-2xl font-black uppercase italic ${showAddModal === 'feature' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {showAddModal === 'feature' ? 'Add New Feature' : 'Add New Course'}
                  </h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Define project scope</p>
                </div>
                <button onClick={() => setShowAddModal(null)} className="p-3 rounded-full bg-white/5 hover:bg-white/10 shrink-0"><X size={20}/></button>
              </div>

              {showAddModal === 'feature' ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Feature Title</label>
                    <input value={featureForm.title} onChange={e => setFeatureForm({...featureForm, title: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-blue-500" placeholder="e.g. Automated Billing..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Impact Area</label>
                    <select value={featureForm.impact} onChange={e => setFeatureForm({...featureForm, impact: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                      <option>Finance</option>
                      <option>Content</option>
                      <option>Infrastructure</option>
                      <option>UX</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Effort (Hours)</label>
                    <input type="number" min="1" value={featureForm.effort} onChange={e => setFeatureForm({...featureForm, effort: parseInt(e.target.value) || 1})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Description / Notes</label>
                    <textarea value={featureForm.description} onChange={e => setFeatureForm({...featureForm, description: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm text-slate-300 outline-none focus:border-blue-500 min-h-[100px]" placeholder="Feature objectives..." />
                  </div>
                  <button onClick={handleAddFeature} disabled={issaving || !featureForm.title} className="w-full py-4 bg-blue-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                    {issaving ? <Loader2 size={18} className="animate-spin"/> : <><Plus size={18}/> Commit Feature</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Course Title</label>
                    <input value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-emerald-500" placeholder="e.g. Python for Beginners..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Target Age</label>
                      <select value={courseForm.age} onChange={e => setCourseForm({...courseForm, age: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                        <option>6-8</option>
                        <option>8-12</option>
                        <option>13+</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Primary Objective</label>
                      <select value={courseForm.objective} onChange={e => setCourseForm({...courseForm, objective: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                        <option>Lead Gen</option>
                        <option>Retention</option>
                        <option>Upsell</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Curriculum Outline</label>
                    <textarea value={courseForm.description} onChange={e => setCourseForm({...courseForm, description: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm text-slate-300 outline-none focus:border-emerald-500 min-h-[100px]" placeholder="Brief syllabus..." />
                  </div>
                  <button onClick={handleAddCourse} disabled={issaving || !courseForm.title} className="w-full py-4 bg-emerald-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                    {issaving ? <Loader2 size={18} className="animate-spin"/> : <><Plus size={18}/> Commit Course</>}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- FULL-SCREEN DETAIL INSPECTOR SLIDE-OVER --- */}
      <AnimatePresence>
        {selectedNode && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedNode(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            {/* UPDATED: max-w-5xl for a massive, full-screen canvas feel */}
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }} className="relative w-full max-w-5xl bg-[#0f172a] border-l border-white/10 h-full shadow-2xl flex flex-col p-8 md:p-12 space-y-8 overflow-y-auto text-left custom-scrollbar">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-3xl ${selectedNode.type === 'feature' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {selectedNode.type === 'feature' ? <Zap size={32}/> : <BookOpen size={32}/>}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Node_Inspector // Command Canvas</p>
                    <h2 className="text-4xl font-black uppercase italic tracking-tight">{selectedNode.data.title}</h2>
                  </div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="p-3 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
              </div>

              <div className="space-y-8 flex-1">
                
                {/* --- GRID LAYOUT FOR STATUS AND TIME LOGGING --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* STATUS SELECTOR */}
                  <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[32px] space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Status</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Planned', 'Working', 'Parked', 'Finished'].map((s) => (
                        <button 
                          key={s} 
                          onClick={() => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, status: s } })}
                          className={`py-4 px-4 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedNode.data.status === s ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-lg' : 'bg-[#020617] border-white/5 text-slate-500 hover:border-white/20'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* LOGGING HOURS */}
                  <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[32px] flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest"><History size={14}/> Total_Work_Duration</label>
                       <span className="text-3xl font-black italic text-fuchsia-500 leading-none">{selectedNode.data.actual_hours || 0}<span className="text-sm text-fuchsia-500/50 not-italic ml-1">HRS</span></span>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={() => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, actual_hours: (selectedNode.data.actual_hours || 0) + 1 } })} className="flex-1 py-4 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-colors">+ Log 1 Hour</button>
                       <button onClick={() => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, actual_hours: Math.max(0, (selectedNode.data.actual_hours || 0) - 1) } })} className="px-6 py-4 bg-[#020617] border border-white/5 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-colors">- 1h</button>
                    </div>
                  </div>
                </div>

                {/* --- SUB-TASKS & IDEAS SECTION --- */}
                <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <label className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <ListTree size={18} className="text-fuchsia-500" /> Sub-Tasks & Ideas Matrix
                    </label>
                    <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-white/10">
                      {(selectedNode.data.tasks || []).length} Items Tracked
                    </span>
                  </div>
                  
                  {/* Task Input */}
                  <div className="flex gap-3">
                    <input 
                      value={newTaskText} 
                      onChange={e => setNewTaskText(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                      placeholder="Type a new idea, feature requirement, or task..." 
                      className="flex-1 bg-[#020617] border border-white/10 rounded-2xl px-6 py-5 text-sm text-white font-medium outline-none focus:border-fuchsia-500 transition-colors"
                    />
                    <button onClick={handleAddTask} disabled={!newTaskText.trim()} className="px-8 bg-fuchsia-600/20 text-fuchsia-500 border border-fuchsia-500/30 hover:bg-fuchsia-600 hover:text-white disabled:opacity-30 rounded-2xl transition-all shadow-lg">
                      <Plus size={24} />
                    </button>
                  </div>

                  {/* Task List */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {(selectedNode.data.tasks || []).map((task: any) => (
                      <div key={task.id} className={`group flex flex-col p-5 rounded-2xl border transition-all ${task.status === 'Finished' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-[#020617] border-white/5 hover:border-white/10'}`}>
                        
                        <div className="flex items-start justify-between gap-6 w-full">
                          <div className="flex items-start gap-4 flex-1 overflow-hidden mt-1">
                             <button onClick={() => handleUpdateTaskStatus(task.id, task.status === 'Finished' ? 'Planned' : 'Finished')} className="text-slate-500 hover:text-emerald-400 shrink-0 transition-colors mt-0.5">
                               {task.status === 'Finished' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} />}
                             </button>
                             <span className={`text-base font-medium leading-relaxed ${task.status === 'Finished' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                               {task.text}
                             </span>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <select 
                              value={task.status} 
                              onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                              className={`text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer appearance-none bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl ${
                                task.status === 'Finished' ? 'text-emerald-500 border-emerald-500/20' : 
                                task.status === 'Working' ? 'text-blue-400 border-blue-500/20' : 
                                task.status === 'Parked' ? 'text-amber-500 border-amber-500/20' : 
                                'text-slate-400'
                              }`}
                            >
                              <option value="Planned" className="bg-[#0f172a] text-slate-300">PLANNED</option>
                              <option value="Working" className="bg-[#0f172a] text-blue-400">WORKING</option>
                              <option value="Parked" className="bg-[#0f172a] text-amber-500">PARKED</option>
                              <option value="Finished" className="bg-[#0f172a] text-emerald-500">FINISHED</option>
                            </select>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-2.5 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-500/10">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>

                        {/* --- TAGS ROW --- */}
                        <div className="flex flex-wrap items-center gap-2 mt-4 pl-10">
                          <Tag size={12} className="text-slate-600 mr-1" />
                          {(task.tags || []).map((tag: string) => (
                            <span key={tag} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[9px] font-black uppercase tracking-widest">
                              {tag}
                              <button onClick={() => handleRemoveTag(task.id, tag)} className="hover:text-white"><X size={10}/></button>
                            </span>
                          ))}
                          
                          {taggingTaskId === task.id ? (
                            <div className="flex items-center gap-1">
                              <input 
                                autoFocus
                                list="available-tags-list"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddTag(task.id);
                                  if (e.key === 'Escape') { setTaggingTaskId(null); setTagInput(""); }
                                }}
                                onBlur={() => { if(!tagInput) { setTaggingTaskId(null); setTagInput(""); } }}
                                placeholder="Type tag..."
                                className="bg-[#020617] border border-fuchsia-500/50 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white outline-none w-28"
                              />
                              <button onClick={() => handleAddTag(task.id)} className="p-1 bg-fuchsia-500/20 text-fuchsia-400 rounded hover:bg-fuchsia-500 hover:text-white"><CheckCircle2 size={12}/></button>
                              <button onClick={() => { setTaggingTaskId(null); setTagInput(""); }} className="p-1 text-slate-500 hover:text-white"><X size={12}/></button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setTaggingTaskId(task.id); setTagInput(""); }} 
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-400 rounded-md text-[9px] font-black uppercase tracking-widest border border-white/5 border-dashed transition-colors flex items-center gap-1"
                            >
                              <Plus size={10}/> Add Tag
                            </button>
                          )}
                        </div>

                      </div>
                    ))}
                    {(!selectedNode.data.tasks || selectedNode.data.tasks.length === 0) && (
                      <div className="border border-dashed border-white/5 rounded-2xl py-12 flex flex-col items-center justify-center text-slate-600">
                        <ListTree size={32} className="mb-3 opacity-50" />
                        <p className="text-xs font-bold uppercase tracking-widest italic">No tasks tracked yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* DESCRIPTION EDIT */}
                <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] space-y-4">
                   <label className="text-sm font-black text-white uppercase tracking-widest ml-1">General Notes & Objectives</label>
                   <textarea 
                    value={selectedNode.data.description || ""}
                    onChange={(e) => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, description: e.target.value } })}
                    className="w-full bg-[#020617] border border-white/10 rounded-2xl p-6 text-sm text-slate-300 min-h-[160px] outline-none focus:border-fuchsia-500 transition-colors leading-relaxed" 
                   />
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 mt-auto">
                <button onClick={() => handleUpdateNode(selectedNode.data)} className="w-full py-6 bg-fuchsia-600 rounded-3xl font-black uppercase italic text-sm tracking-widest hover:bg-fuchsia-500 shadow-[0_0_40px_rgba(217,70,239,0.3)] transition-all flex items-center justify-center gap-3">
                  {issaving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24}/> Synchronize_Changes_To_Server</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function BlueprintSection({ title, icon, color, onAdd, children }: any) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-xl font-black italic uppercase ${color} flex items-center gap-3`}>{icon} {title}</h2>
        <button onClick={onAdd} className={`p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all ${color}`}><Plus size={20}/></button>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function BlueprintCard({ type, data, onDetail }: any) {
  const isFeature = type === 'feature';
  
  // Status Color Logic
  const getStatusColor = (s: string) => {
    if (s === 'Working') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (s === 'Finished') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (s === 'Parked') return 'text-slate-400 bg-white/5 border-white/10';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  // Calculate Task Progress
  const totalTasks = data.tasks ? data.tasks.length : 0;
  const finishedTasks = data.tasks ? data.tasks.filter((t: any) => t.status === 'Finished').length : 0;

  return (
    <div className={`bg-white/[0.02] border border-white/5 p-6 rounded-[32px] group hover:border-white/20 transition-all relative overflow-hidden text-left shadow-lg`}>
      <div className={`absolute left-0 top-0 w-1 h-full ${isFeature ? 'bg-blue-500' : 'bg-emerald-500'} opacity-30`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black uppercase italic tracking-tight leading-none">{data.title}</h3>
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${getStatusColor(data.status)}`}>{data.status || 'Planned'}</span>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
             <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Clock size={10}/> Est: {isFeature ? `${data.effort_hours}h` : `${data.effort_days}d`}</span>
             <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Activity size={10}/> Work: {data.actual_hours || 0}h</span>
             
             {/* Task Indicator Badge */}
             {totalTasks > 0 && (
               <span className={`flex items-center gap-1 px-2 py-1 rounded-md border ${finishedTasks === totalTasks ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                 <ListTree size={10}/> {finishedTasks}/{totalTasks} Tasks
               </span>
             )}
          </div>
        </div>
      </div>

      {data.description && <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-2 border-l border-white/10 pl-3">{data.description}</p>}

      <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-3 pt-2">
         <button onClick={onDetail} className="text-[9px] font-black uppercase text-slate-500 hover:text-white flex items-center gap-1 transition-all border border-white/5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"><Info size={12}/> Detail</button>
         <button className="text-[9px] font-black uppercase text-slate-500 hover:text-rose-500 flex items-center gap-1 transition-all px-2"><Trash2 size={12}/> Delete</button>
      </div>
    </div>
  );
}