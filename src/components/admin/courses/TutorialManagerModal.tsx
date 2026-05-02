"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Edit3, Trash2, Save, FileText, Link as LinkIcon, Loader2, BookOpen } from "lucide-react";

interface TutorialManagerModalProps {
  tutorialIds: string[]; // Array of UUIDs passed from the Component Editor
  onUpdateTutorialIds: (newIds: string[]) => void;
  onClose: () => void;
}

export default function TutorialManagerModal({ tutorialIds, onUpdateTutorialIds, onClose }: TutorialManagerModalProps) {
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [editingTutorial, setEditingTutorial] = useState<any | null>(null);

  useEffect(() => {
    fetchTutorials();
  }, [tutorialIds]);

  async function fetchTutorials() {
    setIsLoading(true);
    try {
      if (!tutorialIds || tutorialIds.length === 0) {
        setTutorials([]);
        return;
      }

      // Fetch the specific tutorials linked to this component
      const { data, error } = await supabase
        .from('makecode_tutorials')
        .select('*')
        .in('id', tutorialIds)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTutorials(data || []);
    } catch (err) {
      console.error("Failed to fetch tutorials", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSaveTutorial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingTutorial.id) {
        // UPDATE EXISTING
        const { error } = await supabase.from('makecode_tutorials').update({
          title: editingComponentPayload.title,
          description: editingComponentPayload.description,
          url: editingComponentPayload.url,
          xp_value: editingComponentPayload.xp_value,
          markdown_code: editingComponentPayload.markdown_code
        }).eq('id', editingTutorial.id);
        
        if (error) throw error;
      } else {
        // CREATE NEW
        const { data, error } = await supabase.from('makecode_tutorials').insert([{
          title: editingComponentPayload.title,
          description: editingComponentPayload.description,
          url: editingComponentPayload.url,
          xp_value: editingComponentPayload.xp_value,
          markdown_code: editingComponentPayload.markdown_code
        }]).select().single();

        if (error) throw error;
        
        // Pass the new ID up to the parent component's state
        onUpdateTutorialIds([...tutorialIds, data.id]);
      }

      setEditingTutorial(null);
      fetchTutorials();
    } catch (err: any) {
      alert("Failed to save tutorial.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = (idToRemove: string) => {
    const confirm = window.confirm("Unlink this tutorial from the hardware component? (It stays in the database).");
    if (!confirm) return;
    onUpdateTutorialIds(tutorialIds.filter(id => id !== idToRemove));
    setEditingTutorial(null);
  };

  const openNewTutorial = () => {
    setEditingTutorial({
      title: '', description: '', url: '', xp_value: 50, markdown_code: ''
    });
  };

  // Safe reference for the form
  const editingComponentPayload = editingTutorial || {};

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-blue-500/30 rounded-[40px] w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02] shrink-0">
          <h3 className="text-2xl font-black uppercase italic text-white tracking-tighter flex items-center gap-3">
            <BookOpen className="text-blue-400" /> Tutorial Source Manager
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        {/* Content Area - Two Columns */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Column: List of Attached Tutorials */}
          <div className="w-80 shrink-0 border-r border-white/10 bg-[#020617]/50 flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attached Modules</h4>
              <button onClick={openNewTutorial} className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1">
                <Plus size={12}/> Create New
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={24}/></div>
              ) : tutorials.length === 0 ? (
                <div className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-600 italic">No Tutorials Attached</div>
              ) : (
                tutorials.map((tut, idx) => (
                  <div key={tut.id} className={`bg-white/[0.03] border rounded-2xl p-4 cursor-pointer transition-all group ${editingTutorial?.id === tut.id ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/10 hover:border-white/30'}`} onClick={() => setEditingTutorial(tut)}>
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-white leading-tight pr-2">{idx + 1}. {tut.title}</p>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button 
                          type="button" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            navigator.clipboard.writeText(tut.markdown_code || ''); 
                            alert("Markdown copied to clipboard!"); 
                          }} 
                          className="text-blue-400 hover:text-blue-300" 
                          title="Copy Markdown"
                        >
                          <FileText size={14}/>
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleUnlink(tut.id); }} className="text-slate-500 hover:text-red-400">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                    <p className="text-[9px] font-mono text-blue-400 mt-2">{tut.xp_value} XP • Source Saved</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: The Editor Form */}
          <div className="flex-1 flex flex-col bg-[#0f172a]">
            {!editingTutorial ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-50">
                <FileText size={64} className="mb-4 text-slate-600" />
                <p className="text-sm font-black uppercase tracking-widest italic">Select a tutorial or create a new one.</p>
              </div>
            ) : (
              <form onSubmit={handleSaveTutorial} className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex flex-col gap-6">
                  
                  {/* Top Meta Data - REWRITTEN FOR FLAWLESS RESPONSIVENESS */}
                  <div className="bg-black/20 p-6 rounded-3xl border border-white/5 space-y-5">
                    
                    {/* Row 1: Title & XP */}
                    <div className="flex flex-col lg:flex-row gap-5">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tutorial Title</label>
                        <input required value={editingComponentPayload.title} onChange={e => setEditingTutorial({...editingTutorial, title: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none font-bold" />
                      </div>
                      <div className="lg:w-32 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">XP Value</label>
                        <input required type="number" value={editingComponentPayload.xp_value} onChange={e => setEditingTutorial({...editingTutorial, xp_value: parseInt(e.target.value) || 0})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-yellow-500 focus:border-blue-500 outline-none font-black text-center" />
                      </div>
                    </div>

                    {/* Row 2: URL */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><LinkIcon size={12}/> MakeCode Share URL</label>
                      <input required value={editingComponentPayload.url} onChange={e => setEditingTutorial({...editingTutorial, url: e.target.value})} className="w-full bg-blue-500/5 border border-blue-500/30 rounded-xl px-4 py-3 text-blue-300 focus:border-blue-500 outline-none font-mono text-xs" placeholder="https://makecode.microbit.org/#tutorial:..." />
                    </div>

                    {/* Row 3: Description */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                      <textarea rows={2} required value={editingComponentPayload.description} onChange={e => setEditingTutorial({...editingTutorial, description: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none resize-none text-sm leading-relaxed" />
                    </div>

                  </div>

                  {/* Markdown Editor */}
                  <div className="flex-1 flex flex-col min-h-[300px] space-y-2">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> Raw Markdown Code</label>
                    <textarea 
                      value={editingComponentPayload.markdown_code || ""} 
                      onChange={e => setEditingTutorial({...editingTutorial, markdown_code: e.target.value})} 
                      className="flex-1 w-full bg-[#020617] border border-emerald-500/20 rounded-3xl p-6 text-slate-300 focus:border-emerald-500 outline-none resize-none font-mono text-xs leading-relaxed custom-scrollbar shadow-inner" 
                      placeholder="## Step 1 \n Write your markdown here..."
                    />
                  </div>
                </div>

                {/* Save Bar */}
                <div className="p-6 border-t border-white/10 bg-white/[0.02] shrink-0 flex justify-end gap-4">
                  <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white font-black uppercase text-xs tracking-widest px-10 py-4 rounded-xl flex items-center gap-2 hover:bg-blue-500 transition-colors disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Source Data
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}