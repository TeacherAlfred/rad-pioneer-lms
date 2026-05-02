"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Plus, Edit3, Trash2, 
  Cpu, Image as ImageIcon, FileText,
  X, Loader2, Save, LayoutDashboard, Database,
  Zap, BookOpen, Link as LinkIcon, ShieldCheck,
  Settings
} from "lucide-react";
import TutorialManagerModal from "@/components/admin/courses/TutorialManagerModal";

// Define the order of tiers and their distinct color themes
const TIER_ORDER = ["beginner", "intermediate", "advanced", "master"];

const TIER_STYLES: Record<string, { header: string, cardBorder: string, badge: string }> = {
  beginner: {
    header: "text-emerald-400 border-emerald-500/20",
    cardBorder: "border-emerald-500/20 hover:border-emerald-400/50",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  intermediate: {
    header: "text-blue-400 border-blue-500/20",
    cardBorder: "border-blue-500/20 hover:border-blue-400/50",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  advanced: {
    header: "text-purple-400 border-purple-500/20",
    cardBorder: "border-purple-500/20 hover:border-purple-400/50",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  master: {
    header: "text-rose-400 border-rose-500/20",
    cardBorder: "border-rose-500/20 hover:border-rose-400/50",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
};

export default function MakecodeCourseEditor({ courseId }: { courseId: string }) {
  
  const [showTutorialManager, setShowTutorialManager] = useState(false);
  const [course, setCourse] = useState<any>(null);
  
  // Data State
  const [courseComponents, setCourseComponents] = useState<any[]>([]);
  const [platformLibrary, setPlatformLibrary] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  
  // Form States
  const [selectedPlatformCompId, setSelectedPlatformCompId] = useState<string>("");
  const [linkConfig, setLinkConfig] = useState({ unlock_tier: 'beginner', is_required: true });
  
  // Separate states for creating vs editing
  const [newComponent, setNewComponent] = useState<any>({
    name: '', category: 'input', description: '', real_world_use: '', 
    engine_drawer: 'Basic', engine_color: '#333333', image_url: '', tutorial_ids: '[]'
  });
  const [editingComponent, setEditingComponent] = useState<any>(null);

  useEffect(() => {
    if (courseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)) {
      fetchSandboxData();
    } else {
      setIsLoading(false);
    }
  }, [courseId]);

  async function fetchSandboxData() {
    setIsLoading(true);
    try {
      const { data: courseData, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single();
      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: linkedData, error: linkedError } = await supabase
        .from('course_components')
        .select(`
          is_required,
          unlock_tier,
          platform_components (*)
        `)
        .eq('course_id', courseId);
      
      if (linkedError) throw linkedError;

      const formattedComponents = (linkedData || []).map((row: any) => ({
        ...(row.platform_components || {}),
        course_link: {
          is_required: row.is_required,
          unlock_tier: row.unlock_tier
        }
      }));
      setCourseComponents(formattedComponents);

      const { data: libraryData, error: libError } = await supabase.from('platform_components').select('*').order('name');
      if (libError) throw libError;
      setPlatformLibrary(libraryData || []);

    } catch (error: any) {
      console.error("Error fetching sandbox data:", error.message || error);
    } finally {
      setIsLoading(false);
    }
  }

  // --- ACTIONS ---

  const handleLinkExistingComponent = async () => {
    if (!selectedPlatformCompId) return alert("Please select a component");
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('course_components').insert({
        course_id: courseId,
        component_id: selectedPlatformCompId,
        is_required: linkConfig.is_required,
        unlock_tier: linkConfig.unlock_tier
      });
      if (error) throw error;
      
      setShowAddModal(false);
      resetForms();
      fetchSandboxData();
    } catch (err: any) {
      alert("Failed to link component. It might already be linked!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: newComp, error: insertError } = await supabase
        .from('platform_components')
        .insert([newComponent])
        .select()
        .single();
        
      if (insertError) throw insertError;

      const { error: linkError } = await supabase.from('course_components').insert({
        course_id: courseId,
        component_id: newComp.id,
        is_required: linkConfig.is_required,
        unlock_tier: linkConfig.unlock_tier
      });
      
      if (linkError) throw linkError;

      setShowAddModal(false);
      resetForms();
      fetchSandboxData();
    } catch (err: any) {
      alert("Failed to create and link component.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingComponent({ ...item });
    setLinkConfig({
      unlock_tier: item.course_link.unlock_tier,
      is_required: item.course_link.is_required
    });
    setShowEditModal(true);
  };

  const handleUpdateComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error: globalError } = await supabase.from('platform_components').update({
        name: editingComponent.name,
        category: editingComponent.category,
        description: editingComponent.description,
        real_world_use: editingComponent.real_world_use,
        engine_drawer: editingComponent.engine_drawer,
        engine_color: editingComponent.engine_color,
        image_url: editingComponent.image_url,
        tutorial_ids: editingComponent.tutorial_ids
      }).eq('id', editingComponent.id);

      if (globalError) throw globalError;

      const { error: linkError } = await supabase.from('course_components').update({
        unlock_tier: linkConfig.unlock_tier,
        is_required: linkConfig.is_required
      }).eq('course_id', courseId).eq('component_id', editingComponent.id);

      if (linkError) throw linkError;

      setShowEditModal(false);
      resetForms();
      fetchSandboxData();
    } catch (err: any) {
      alert("Failed to update component.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLink = async (componentId: string) => {
    const confirm = window.confirm("Remove this hardware component from this course? (It will remain in the global platform library).");
    if (!confirm) return;

    try {
      await supabase.from('course_components').delete().eq('course_id', courseId).eq('component_id', componentId);
      setCourseComponents(courseComponents.filter(c => c.id !== componentId));
    } catch (err) {
      alert("Failed to remove component link.");
    }
  };

  const resetForms = () => {
    setSelectedPlatformCompId("");
    setLinkConfig({ unlock_tier: 'beginner', is_required: true });
    setNewComponent({
      name: '', category: 'input', description: '', real_world_use: '', 
      engine_drawer: 'Basic', engine_color: '#333333', image_url: '', tutorial_ids: '[]'
    });
    setEditingComponent(null);
  };

  if (isLoading) return <div className="flex justify-center py-20 bg-[#020617] h-screen items-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

  if (courseId === "{courseId}") return (
    <div className="flex flex-col items-center justify-center py-20 bg-[#020617] h-screen text-center space-y-4">
      <X size={48} className="text-red-500" />
      <h2 className="text-2xl font-black text-white uppercase tracking-widest">Routing Error</h2>
      <p className="text-slate-400">The URL contains a literal {"{courseId}"} string. Please check the Link on the previous page.</p>
      <Link href="/admin/courses" className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold">Go Back</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] p-6 lg:p-12 text-left">
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        
        {/* HEADER */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/courses" className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-bold uppercase tracking-widest">
              <ArrowLeft size={16} /> Back to Curriculum
            </Link>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
              <LayoutDashboard size={14} className="text-emerald-400" /> Mission Control Hub
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">{course?.title}</h1>
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                <Cpu size={14} /> Workspace: Hardware_Inventory_Manager
              </p>
            </div>
            <button 
              onClick={() => { resetForms(); setShowAddModal(true); }}
              className="flex items-center gap-2 bg-emerald-500 text-[#020617] px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Plus size={18} /> Add Hardware to Course
            </button>
          </div>
        </div>

        {/* INVENTORY DASHBOARD (Grouped by Category -> Tier) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['input', 'output', 'reference'].map((category) => {
            const categoryItems = courseComponents.filter(c => c.category === category);
            
            return (
              <div key={category} className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 space-y-6">
                <h3 className="text-xl font-black uppercase italic text-white flex items-center gap-3 border-b border-white/5 pb-4">
                  {category === 'input' && <Database className="text-blue-400" />}
                  {category === 'output' && <Zap className="text-amber-400" />}
                  {category === 'reference' && <BookOpen className="text-slate-400" />}
                  {category}s ({categoryItems.length})
                </h3>
                
                <div className="space-y-8">
                  {categoryItems.length === 0 ? (
                    <div className="text-center p-6 border border-dashed border-white/10 rounded-2xl text-slate-600 text-xs font-black uppercase tracking-widest italic">
                      No components linked
                    </div>
                  ) : (
                    TIER_ORDER.map((tier) => {
                      const tierItems = categoryItems.filter(item => item.course_link.unlock_tier === tier);
                      if (tierItems.length === 0) return null;

                      const styles = TIER_STYLES[tier] || TIER_STYLES.beginner;

                      return (
                        <div key={tier} className="space-y-4">
                          <h4 className={`text-[10px] font-black uppercase tracking-widest border-b pb-2 ${styles.header}`}>
                            {tier} Tier
                          </h4>
                          <div className="space-y-4">
                            {tierItems.map(item => (
                              <div key={item.id} className={`bg-[#0f172a] border rounded-2xl p-4 flex gap-4 items-start group transition-all relative overflow-hidden ${styles.cardBorder}`}>
                                <div className="w-16 h-16 rounded-xl bg-black/50 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative z-10">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <ImageIcon className="text-slate-600" />
                                  )}
                                  {item.engine_color && (
                                    <div className="absolute bottom-0 left-0 w-full h-1.5" style={{ backgroundColor: item.engine_color }} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 relative z-10">
                                  <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-black text-white truncate pr-2">{item.name}</h4>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button onClick={() => handleOpenEdit(item)} className="text-slate-500 hover:text-emerald-400" title="Edit Component">
                                        <Edit3 size={14} />
                                      </button>
                                      <button onClick={() => handleRemoveLink(item.id)} className="text-slate-500 hover:text-red-400" title="Remove from Course">
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                      {item.engine_drawer || 'No Drawer'}
                                    </span>
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${styles.badge}`}>
                                      {item.course_link.unlock_tier}
                                    </span>
                                    {item.course_link.is_required && (
                                      <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                        <ShieldCheck size={8} /> Required
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ADD NEW COMPONENT MODAL */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-emerald-500/30 rounded-[40px] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02] shrink-0">
                  <h3 className="text-2xl font-black uppercase italic text-white tracking-tighter flex items-center gap-3">
                    <LinkIcon className="text-emerald-400" /> Map Hardware
                  </h3>
                  <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex bg-[#020617] p-2 mx-8 mt-6 rounded-2xl border border-white/5 shrink-0">
                  <button 
                    onClick={() => setAddMode('existing')} 
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${addMode === 'existing' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Select from Library
                  </button>
                  <button 
                    onClick={() => setAddMode('new')} 
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${addMode === 'new' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Create New Component
                  </button>
                </div>
                
                {addMode === 'existing' ? (
                  <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Platform Library Component</label>
                      <select 
                        value={selectedPlatformCompId} 
                        onChange={e => setSelectedPlatformCompId(e.target.value)} 
                        className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-white focus:border-emerald-500 outline-none font-bold"
                      >
                        <option value="">-- Select a Component --</option>
                        {platformLibrary.map(libItem => {
                          const isAlreadyLinked = courseComponents.some(c => c.id === libItem.id);
                          return (
                            <option key={libItem.id} value={libItem.id} disabled={isAlreadyLinked}>
                              {libItem.name} {isAlreadyLinked ? '(Already Linked)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unlock Tier</label>
                         <select value={linkConfig.unlock_tier} onChange={e => setLinkConfig({...linkConfig, unlock_tier: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-emerald-500">
                           <option value="beginner">Beginner</option>
                           <option value="intermediate">Intermediate</option>
                           <option value="advanced">Advanced</option>
                           <option value="master">Master</option>
                         </select>
                      </div>
                      <div className="space-y-2 flex flex-col justify-center items-start pt-4 pl-4">
                         <label className="flex items-center gap-3 cursor-pointer group">
                           <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${linkConfig.is_required ? 'bg-amber-500 border-amber-500' : 'bg-[#020617] border-white/20'}`}>
                             {linkConfig.is_required && <ShieldCheck size={14} className="text-black" />}
                           </div>
                           <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">Required Hardware</span>
                           <input type="checkbox" className="hidden" checked={linkConfig.is_required} onChange={e => setLinkConfig({...linkConfig, is_required: e.target.checked})} />
                         </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-6 border-t border-white/10 mt-6">
                      <button onClick={() => setShowAddModal(false)} className="text-slate-500 font-bold uppercase text-xs tracking-widest px-6 hover:text-white">Cancel</button>
                      <button onClick={handleLinkExistingComponent} disabled={isSubmitting || !selectedPlatformCompId} className="bg-emerald-500 text-black font-black uppercase text-xs tracking-widest px-10 py-4 rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-colors disabled:opacity-50">
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />} Map to Course
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateNewComponent} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* COLUMN 1: Core Definition */}
                        <div className="space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
                          <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                            <BookOpen size={14}/> Core Definition
                          </h4>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Component Name</label>
                            <input required value={newComponent.name || ""} onChange={e => setNewComponent({...newComponent, name: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none font-bold" />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
                            <select value={newComponent.category || "input"} onChange={e => setNewComponent({...newComponent, category: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none">
                              <option value="input">Input (Sensor)</option>
                              <option value="output">Output (Motor/LED)</option>
                              <option value="reference">Reference (Board/Chassis)</option>
                            </select>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                            <textarea rows={3} value={newComponent.description || ""} onChange={e => setNewComponent({...newComponent, description: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none resize-none" />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real World Use (Optional)</label>
                            <input value={newComponent.real_world_use || ""} onChange={e => setNewComponent({...newComponent, real_world_use: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none" placeholder="e.g. Microwave screens..." />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Image URL</label>
                            <input value={newComponent.image_url || ""} onChange={e => setNewComponent({...newComponent, image_url: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none font-mono text-xs" placeholder="https://..." />
                          </div>
                        </div>

                        {/* COLUMN 2: Technical Mapping */}
                        <div className="space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl flex flex-col justify-between">
                          <div className="space-y-6">
                            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                              <Settings size={14}/> Technical Mapping
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MakeCode Drawer</label>
                                <input value={newComponent.engine_drawer || ""} onChange={e => setNewComponent({...newComponent, engine_drawer: e.target.value})} placeholder="e.g. Pins" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Drawer Color Hex</label>
                                <div className="flex gap-2 items-center bg-[#020617] border border-white/10 rounded-xl px-2 py-1.5 focus-within:border-emerald-500">
                                  <input type="color" value={newComponent.engine_color || "#333333"} onChange={e => setNewComponent({...newComponent, engine_color: e.target.value})} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0 shrink-0" />
                                  <input value={newComponent.engine_color || ""} onChange={e => setNewComponent({...newComponent, engine_color: e.target.value})} className="flex-1 bg-transparent border-none text-white outline-none font-mono text-xs w-full" />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tutorial IDs (JSON Array)</label>
                              <input value={newComponent.tutorial_ids || "[]"} onChange={e => setNewComponent({...newComponent, tutorial_ids: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none font-mono text-xs" placeholder='["uuid-1", "uuid-2"]' />
                            </div>

                            <div className="bg-[#020617]/50 border border-emerald-500/20 p-5 rounded-2xl space-y-3">
                                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tutorial Linkages</h5>
                                    <button 
                                    type="button" 
                                    onClick={() => setShowTutorialManager(true)}
                                    className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
                                    >
                                    Manage Source Code
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <FileText size={16} className="text-slate-500" />
                                    <span className="text-xs font-bold text-white">
                                    {(() => {
                                        // Handle stringified JSON from legacy database setups
                                        const tuts = typeof (addMode === 'new' ? newComponent : editingComponent)?.tutorial_ids === 'string'
                                        ? JSON.parse((addMode === 'new' ? newComponent : editingComponent).tutorial_ids || '[]')
                                        : (addMode === 'new' ? newComponent : editingComponent)?.tutorial_ids || [];
                                        
                                        return `${tuts.length} Tutorial(s) Mapped`;
                                    })()}
                                    </span>
                                </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    <div className="flex justify-end gap-4 p-6 border-t border-white/10 bg-white/[0.02] shrink-0">
                      <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-500 font-bold uppercase text-xs tracking-widest px-6 hover:text-white">Cancel</button>
                      <button type="submit" disabled={isSubmitting} className="bg-emerald-500 text-black font-black uppercase text-xs tracking-widest px-10 py-4 rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-colors disabled:opacity-50">
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save & Map
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* EDIT COMPONENT MODAL (Updates both tables) */}
        <AnimatePresence>
          {showEditModal && editingComponent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-blue-500/30 rounded-[40px] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02] shrink-0">
                  <h3 className="text-2xl font-black uppercase italic text-white tracking-tighter flex items-center gap-3">
                    <Edit3 className="text-blue-400" /> Edit Hardware Config
                  </h3>
                  <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                
                <form onSubmit={handleUpdateComponent} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-6">
                      <p className="text-[10px] uppercase tracking-widest font-black text-blue-400">
                        Warning: Changes to Core Definition or MakeCode Drawer affect the GLOBAL Platform Library. Changes to Unlock Tier or Requirements only affect THIS Course.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* COLUMN 1: Core Definition */}
                      <div className="space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
                        <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                          <BookOpen size={14}/> Core Definition
                        </h4>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Component Name</label>
                          <input required value={editingComponent.name || ""} onChange={e => setEditingComponent({...editingComponent, name: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none font-bold" />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
                          <select value={editingComponent.category || "input"} onChange={e => setEditingComponent({...editingComponent, category: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none">
                            <option value="input">Input (Sensor)</option>
                            <option value="output">Output (Motor/LED)</option>
                            <option value="reference">Reference (Board/Chassis)</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                          <textarea rows={3} value={editingComponent.description || ""} onChange={e => setEditingComponent({...editingComponent, description: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none resize-none" />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real World Use (Optional)</label>
                          <input value={editingComponent.real_world_use || ""} onChange={e => setEditingComponent({...editingComponent, real_world_use: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="e.g. Microwave screens..." />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Image URL</label>
                          <input value={editingComponent.image_url || ""} onChange={e => setEditingComponent({...editingComponent, image_url: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none font-mono text-xs" placeholder="https://..." />
                        </div>
                      </div>

                      {/* COLUMN 2: Technical Mapping */}
                      <div className="space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl flex flex-col justify-between">
                        <div className="space-y-6">
                          <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                            <Settings size={14}/> Technical Mapping
                          </h4>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MakeCode Drawer</label>
                              <input value={editingComponent.engine_drawer || ""} onChange={e => setEditingComponent({...editingComponent, engine_drawer: e.target.value})} placeholder="e.g. Pins" className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Drawer Color Hex</label>
                              <div className="flex gap-2 items-center bg-[#020617] border border-white/10 rounded-xl px-2 py-1.5 focus-within:border-blue-500">
                                <input type="color" value={editingComponent.engine_color || "#333333"} onChange={e => setEditingComponent({...editingComponent, engine_color: e.target.value})} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0 shrink-0" />
                                <input value={editingComponent.engine_color || ""} onChange={e => setEditingComponent({...editingComponent, engine_color: e.target.value})} className="flex-1 bg-transparent border-none text-white outline-none font-mono text-xs w-full" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tutorial IDs (JSON Array)</label>
                            <input value={editingComponent.tutorial_ids || "[]"} onChange={e => setEditingComponent({...editingComponent, tutorial_ids: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none font-mono text-xs" placeholder='["uuid-1", "uuid-2"]' />
                          </div>

                          <div className="bg-[#020617]/50 border border-blue-500/20 p-5 rounded-2xl space-y-3">
                              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tutorial Linkages</h5>
                                  <button 
                                  type="button" 
                                  onClick={() => setShowTutorialManager(true)}
                                  className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20"
                                  >
                                  Manage Source Code
                                  </button>
                              </div>
                              <div className="flex items-center gap-3">
                                  <FileText size={16} className="text-slate-500" />
                                  <span className="text-xs font-bold text-white">
                                  {(() => {
                                      const tuts = typeof editingComponent?.tutorial_ids === 'string'
                                      ? JSON.parse(editingComponent.tutorial_ids || '[]')
                                      : editingComponent?.tutorial_ids || [];
                                      return `${tuts.length} Tutorial(s) Mapped`;
                                  })()}
                                  </span>
                              </div>
                          </div>

                          <div className="bg-[#020617]/50 border border-blue-500/20 p-4 rounded-2xl space-y-4 mt-auto">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Local Course Link Settings</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Unlock Tier</label>
                                <select value={linkConfig.unlock_tier} onChange={e => setLinkConfig({...linkConfig, unlock_tier: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-500">
                                  <option value="beginner">Beginner</option>
                                  <option value="intermediate">Intermediate</option>
                                  <option value="advanced">Advanced</option>
                                  <option value="master">Master</option>
                                </select>
                              </div>
                              <div className="flex items-center pt-5 pl-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${linkConfig.is_required ? 'bg-amber-500 border-amber-500' : 'bg-[#020617] border-white/20'}`}>
                                    {linkConfig.is_required && <ShieldCheck size={12} className="text-black" />}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-widest">Required</span>
                                  <input type="checkbox" className="hidden" checked={linkConfig.is_required} onChange={e => setLinkConfig({...linkConfig, is_required: e.target.checked})} />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="flex justify-end gap-4 p-6 border-t border-white/10 bg-white/[0.02] shrink-0">
                    <button type="button" onClick={() => setShowEditModal(false)} className="text-slate-500 font-bold uppercase text-xs tracking-widest px-6 hover:text-white">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white font-black uppercase text-xs tracking-widest px-10 py-4 rounded-xl flex items-center gap-2 hover:bg-blue-500 transition-colors disabled:opacity-50">
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTutorialManager && (
            <TutorialManagerModal 
              tutorialIds={
                typeof (showEditModal ? editingComponent : newComponent)?.tutorial_ids === 'string'
                  ? JSON.parse((showEditModal ? editingComponent : newComponent).tutorial_ids || '[]')
                  : (showEditModal ? editingComponent : newComponent)?.tutorial_ids || []
              }
              onUpdateTutorialIds={(newIds) => {
                if (showEditModal) {
                  setEditingComponent({...editingComponent, tutorial_ids: JSON.stringify(newIds)});
                } else {
                  setNewComponent({...newComponent, tutorial_ids: JSON.stringify(newIds)});
                }
              }}
              onClose={() => setShowTutorialManager(false)}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}