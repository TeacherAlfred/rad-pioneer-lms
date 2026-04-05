"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, ListTree, Zap, BookOpen, Clock, Users, 
  Target, ShieldAlert, ArrowLeft, ChevronUp, ChevronDown, Save, Trash2, X, Loader2, Info, Activity, History
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
      priority_order: features.length + 1
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
      priority_order: courses.length + 1
    });
    setCourseForm({ title: '', description: '', age: '8-12', objective: 'Lead Gen' });
    setShowAddModal(null);
    fetchBlueprint();
    setIsSaving(false);
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-fuchsia-500" /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-fuchsia-500/30 text-left">
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

      {/* --- ADD MODAL (Existing logic but with styled selects) --- */}
      {/* ... Add Modal implementation remains similar to previous step ... */}

      {/* --- DETAIL INSPECTOR SLIDE-OVER --- */}
      <AnimatePresence>
        {selectedNode && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedNode(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }} className="relative w-full max-w-xl bg-[#0f172a] border-l border-white/10 h-full shadow-2xl flex flex-col p-10 space-y-8 overflow-y-auto text-left">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${selectedNode.type === 'feature' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {selectedNode.type === 'feature' ? <Zap size={24}/> : <BookOpen size={24}/>}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Node_Inspector</p>
                    <h2 className="text-2xl font-black uppercase italic tracking-tight">{selectedNode.data.title}</h2>
                  </div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
              </div>

              <div className="space-y-6 flex-1">
                {/* STATUS SELECTOR */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Planned', 'Working', 'Parked', 'Finished'].map((s) => (
                      <button 
                        key={s} 
                        onClick={() => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, status: s } })}
                        className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedNode.data.status === s ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* LOGGING HOURS */}
                <div className="bg-[#020617] border border-white/5 p-6 rounded-[32px] space-y-4">
                  <div className="flex items-center justify-between">
                     <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><History size={14}/> Total_Work_Duration</label>
                     <span className="text-xl font-black italic text-fuchsia-500">{selectedNode.data.actual_hours || 0} Hours</span>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, actual_hours: (selectedNode.data.actual_hours || 0) + 1 } })} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase hover:bg-white/10">+ Log 1 Hour</button>
                     <button onClick={() => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, actual_hours: Math.max(0, (selectedNode.data.actual_hours || 0) - 1) } })} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20">- 1h</button>
                  </div>
                </div>

                {/* DESCRIPTION EDIT */}
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Notes / Objectives</label>
                   <textarea 
                    value={selectedNode.data.description || ""}
                    onChange={(e) => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, description: e.target.value } })}
                    className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 text-sm text-slate-300 min-h-[150px] outline-none focus:border-fuchsia-500" 
                   />
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <button onClick={() => handleUpdateNode(selectedNode.data)} className="w-full py-5 bg-fuchsia-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-fuchsia-500 shadow-xl shadow-fuchsia-900/20 transition-all flex items-center justify-center gap-2">
                  {issaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> Synchronize_Changes</>}
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

  return (
    <div className={`bg-white/[0.02] border border-white/5 p-6 rounded-[32px] group hover:border-white/20 transition-all relative overflow-hidden text-left`}>
      <div className={`absolute left-0 top-0 w-1 h-full ${isFeature ? 'bg-blue-500' : 'bg-emerald-500'} opacity-30`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black uppercase italic tracking-tight leading-none">{data.title}</h3>
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${getStatusColor(data.status)}`}>{data.status || 'Planned'}</span>
          </div>
          <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
             <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Clock size={10}/> Est: {isFeature ? `${data.effort_hours}h` : `${data.effort_days}d`}</span>
             <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Activity size={10}/> Work: {data.actual_hours || 0}h</span>
          </div>
        </div>
      </div>

      {data.description && <p className="text-[11px] text-slate-500 italic line-clamp-1 mt-1 border-l border-white/10 pl-3">{data.description}</p>}

      <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-3 pt-2">
         <button onClick={onDetail} className="text-[9px] font-black uppercase text-slate-500 hover:text-white flex items-center gap-1 transition-all border border-white/5 px-3 py-1.5 rounded-lg"><Info size={12}/> Detail</button>
         <button className="text-[9px] font-black uppercase text-slate-500 hover:text-rose-500 flex items-center gap-1 transition-all"><Trash2 size={12}/> Delete</button>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="border border-dashed border-white/10 rounded-[32px] p-12 text-center text-xs text-slate-600 font-bold italic">{label}</div>;
}