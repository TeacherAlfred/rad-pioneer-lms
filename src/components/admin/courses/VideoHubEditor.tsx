"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Video, CheckSquare, Save, Loader2, GripVertical, X, Tag, Edit3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type VideoObj = { id: string; title: string; url: string; categories: string[]; };
type ChecklistObj = { id: string; text: string; is_required: boolean; };
type ConfigType = { videos: VideoObj[]; checklist_blueprint: ChecklistObj[]; };

const DEFAULT_CATEGORIES = ["Motion", "Looks", "Hardware", "Logic", "Workspace", "Sprites", "Events"];

export default function VideoHubEditor({ courseId }: { courseId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mission, setMission] = useState<any>(null);
  const [config, setConfig] = useState<ConfigType>({ videos: [], checklist_blueprint: [] });

  // Dynamic Category State
  const [availableCategories, setAvailableCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [customCategoryInput, setCustomCategoryInput] = useState("");

  // Unified Modal State
  const [activeVideoForm, setActiveVideoForm] = useState<VideoObj | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    async function fetchMission() {
      const { data } = await supabase
        .from('modules')
        .select(`missions(*)`)
        .eq('course_id', courseId)
        .single();
      
      if (data?.missions?.[0]) {
        setMission(data.missions[0]);
        
        const loadedVideos = (data.missions[0].mission_config?.videos || []).map((v: any) => ({
          ...v,
          categories: v.categories || (v.category ? [v.category] : [])
        }));

        setConfig({
            videos: loadedVideos,
            checklist_blueprint: data.missions[0].mission_config?.checklist_blueprint || []
        });

        // Extract custom categories
        const existingCats = new Set<string>(DEFAULT_CATEGORIES);
        loadedVideos.forEach((v: VideoObj) => v.categories.forEach(c => existingCats.add(c)));
        setAvailableCategories(Array.from(existingCats));
      }
    }
    fetchMission();
  }, [courseId]);

  const handleSave = async () => {
    if (!mission) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('missions')
        .update({ mission_config: config })
        .eq('id', mission.id);
      if (error) throw error;
      alert("Configuration saved successfully.");
    } catch (err) {
      console.error("Failed to save config", err);
      alert("Failed to save.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Category Management ---
  const handleAddCustomCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCat = customCategoryInput.trim();
    if (!cleanCat) return;
    
    if (!availableCategories.includes(cleanCat)) {
      setAvailableCategories([...availableCategories, cleanCat]);
    }
    setCustomCategoryInput("");
  };

  // --- Modal & Video Actions ---
  const openAddModal = () => {
    setEditIndex(null);
    setActiveVideoForm({ id: crypto.randomUUID(), title: "", url: "", categories: [] });
  };

  const confirmAndEdit = (index: number) => {
    if (window.confirm("Are you sure you want to edit this reference guide? Modifying an active link will break playback for students if the new URL is invalid.")) {
      setEditIndex(index);
      setActiveVideoForm({ ...config.videos[index] });
    }
  };

  const removeVideo = (index: number) => {
    if (window.confirm("Are you sure you want to delete this video guide? This action cannot be undone.")) {
      setConfig({
        ...config, 
        videos: config.videos.filter((_, idx) => idx !== index)
      });
    }
  };

  const saveModalVideo = () => {
    if (!activeVideoForm?.title || !activeVideoForm?.url) {
      alert("Title and URL are required.");
      return;
    }

    if (editIndex !== null) {
      // Update existing
      const newVids = [...config.videos];
      newVids[editIndex] = activeVideoForm;
      setConfig({ ...config, videos: newVids });
    } else {
      // Add new
      setConfig({ ...config, videos: [...config.videos, activeVideoForm] });
    }
    
    setActiveVideoForm(null);
    setEditIndex(null);
  };

  // --- Checklist Actions ---
  const addChecklistItem = () => setConfig({
    ...config,
    checklist_blueprint: [...config.checklist_blueprint, { id: crypto.randomUUID(), text: "", is_required: true }]
  });

  if (!mission) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 text-slate-900 relative">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-800">Video Hub Configuration</h1>
            <p className="text-slate-500 font-medium mt-1">Design the external lab environment</p>
          </div>
          <button 
            onClick={handleSave} disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            Save Configuration
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* VIDEO ASSETS - COMPACT LIST */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 self-start">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h4 className="font-black uppercase tracking-widest text-slate-700 text-xs flex items-center gap-2">
                <Video size={16} className="text-blue-500"/> Reference Guides
              </h4>
              <button onClick={openAddModal} className="text-blue-600 font-bold text-xs uppercase hover:underline flex items-center gap-1">
                <Plus size={14} /> Add Video
              </button>
            </div>
            
            <div className="space-y-3">
              {config.videos.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">No video guides added yet.</p>
              ) : (
                config.videos.map((vid, i) => (
                  <motion.div key={vid.id} layout className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center gap-3 group hover:border-blue-200 transition-colors">
                    <GripVertical className="text-slate-300 cursor-grab shrink-0" size={16} />
                    
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-bold text-slate-800 truncate">{vid.title}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{vid.url}</span>
                        <div className="flex gap-1 flex-wrap">
                          {vid.categories.map(c => (
                            <span key={c} className="text-[8px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => confirmAndEdit(i)} className="p-2 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all shadow-sm">
                        <Edit3 size={14}/>
                      </button>
                      <button onClick={() => removeVideo(i)} className="p-2 bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition-all shadow-sm">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* COLLAB CHECKLIST */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 self-start">
             <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h4 className="font-black uppercase tracking-widest text-slate-700 text-xs flex items-center gap-2">
                <CheckSquare size={16} className="text-emerald-500"/> Objective Blueprint
              </h4>
              <button onClick={addChecklistItem} className="text-emerald-600 font-bold text-xs uppercase hover:underline flex items-center gap-1">
                <Plus size={14} /> Add Task
              </button>
            </div>

            <div className="space-y-3">
               {config.checklist_blueprint.length === 0 ? (
                 <p className="text-sm text-slate-400 italic text-center py-4">No objectives added yet.</p>
               ) : (
                 config.checklist_blueprint.map((task, i) => (
                   <motion.div key={task.id} layout className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                     <div className="w-5 h-5 rounded border-2 border-slate-300 shrink-0 bg-white" />
                     <input 
                        placeholder="Task description..." 
                        value={task.text}
                        onChange={(e) => {
                          const newTasks = [...config.checklist_blueprint];
                          newTasks[i].text = e.target.value;
                          setConfig({...config, checklist_blueprint: newTasks});
                        }}
                        className="flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none" 
                      />
                      <button onClick={() => setConfig({...config, checklist_blueprint: config.checklist_blueprint.filter((_, idx) => idx !== i)})} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                   </motion.div>
                 ))
               )}
            </div>
          </div>
        </div>
      </div>

      {/* --- UNIFIED VIDEO MODAL (ADD & EDIT) --- */}
      <AnimatePresence>
        {activeVideoForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setActiveVideoForm(null)} 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200">
                    <Video size={20} />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-black text-lg uppercase tracking-tight leading-tight">
                      {editIndex !== null ? 'Edit Video Guide' : 'Add Video Guide'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Configure Reference Material</p>
                  </div>
                </div>
                <button onClick={() => setActiveVideoForm(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                  <X size={20}/>
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Video Title</label>
                  <input 
                    placeholder="e.g., Adding your first Sprite" 
                    value={activeVideoForm.title}
                    onChange={(e) => setActiveVideoForm({...activeVideoForm, title: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">R2 Bucket URL</label>
                  <input 
                    placeholder="https://pub-...r2.dev/video.mp4" 
                    value={activeVideoForm.url}
                    onChange={(e) => setActiveVideoForm({...activeVideoForm, url: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Tag Categories</label>
                  
                  {/* Category Selection */}
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map(cat => {
                      const isActive = activeVideoForm.categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            if (isActive) {
                              setActiveVideoForm({...activeVideoForm, categories: activeVideoForm.categories.filter(c => c !== cat)});
                            } else {
                              setActiveVideoForm({...activeVideoForm, categories: [...activeVideoForm.categories, cat]});
                            }
                          }}
                          className={`text-xs px-4 py-1.5 rounded-full border font-bold transition-all ${
                            isActive 
                            ? 'bg-blue-100 border-blue-300 text-blue-700' 
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 shadow-sm'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Create New Category Form */}
                  <form onSubmit={handleAddCustomCategory} className="flex items-center gap-2 mt-3">
                    <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:border-blue-400 transition-colors">
                      <Tag size={14} className="text-slate-400" />
                      <input 
                        placeholder="Create new tag..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="w-full bg-transparent px-3 py-2 text-xs outline-none text-slate-700"
                      />
                    </div>
                    <button type="submit" disabled={!customCategoryInput.trim()} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                      Add Tag
                    </button>
                  </form>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setActiveVideoForm(null)} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button onClick={saveModalVideo} className="px-8 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all">
                  {editIndex !== null ? 'Save Changes' : 'Confirm Video'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}