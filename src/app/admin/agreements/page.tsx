"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ShieldCheck, ArrowLeft, Plus, Save, Trash2, X, Edit3, CheckSquare, Square, Loader2, Type, ToggleLeft
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const PROGRAM_TAGS = [
  "Term (Monthly)", 
  "Term (Upfront)", 
  "Bootcamp", 
  "Online", 
  "In-Person",
  "Demo LMS Access"
];

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    title: "",
    description: "",
    type: "required_checkbox", // NEW: Added type selection
    applicable_to: [] as string[]
  });

  useEffect(() => {
    fetchAgreements();
  }, []);

  async function fetchAgreements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('core_agreements')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAgreements(data || []);
    } catch (error) {
      console.error("Failed to fetch agreements:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (agreement: any = null) => {
    if (agreement) {
      setEditingId(agreement.id);
      setFormData({
        id: agreement.id,
        title: agreement.title,
        description: agreement.description,
        type: agreement.type || "required_checkbox",
        applicable_to: agreement.applicable_to || []
      });
    } else {
      setEditingId(null);
      setFormData({ id: "", title: "", description: "", type: "required_checkbox", applicable_to: [] });
    }
    setIsModalOpen(true);
  };

  const handleToggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      applicable_to: prev.applicable_to.includes(tag) 
        ? prev.applicable_to.filter(t => t !== tag) 
        : [...prev.applicable_to, tag]
    }));
  };

  const handleSave = async () => {
    if (!formData.id || !formData.title || !formData.description) return alert("Please fill out all required fields.");
    
    setIsProcessing(true);
    try {
      const cleanId = formData.id.toLowerCase().replace(/\s+/g, '-');
      
      const payload = {
        id: cleanId,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        applicable_to: formData.applicable_to,
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        const { error } = await supabase.from('core_agreements').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('core_agreements').insert([payload]);
        if (error) throw error;
      }

      await fetchAgreements();
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Failed to save agreement: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this agreement?")) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('core_agreements').delete().eq('id', id);
      if (error) throw error;
      await fetchAgreements();
    } catch (err: any) {
      alert("Failed to delete agreement.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'yes_no':
        return <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg"><ToggleLeft size={12}/> Yes/No Choice</span>;
      case 'optional_text':
        return <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg"><Type size={12}/> Optional Text</span>;
      default:
        return <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg"><CheckSquare size={12}/> Mandatory Checkbox</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl transition-all w-fit hover:border-emerald-500/50">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
            </Link>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Core_<span className="text-emerald-500">Agreements</span></h1>
          </div>
          <button 
            onClick={() => handleOpenModal()} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black uppercase italic tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Plus size={16} /> New Agreement
          </button>
        </header>

        {/* AGREEMENTS LIST */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck size={24} className="text-emerald-500" />
            <h2 className="text-2xl font-black uppercase italic tracking-tight">Terms & Conditions Engine</h2>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {agreements.map((agreement) => (
                <div key={agreement.id} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative overflow-hidden group hover:border-white/10 transition-colors">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center flex-wrap gap-3">
                      <h3 className="text-xl font-black text-white">{agreement.title}</h3>
                      {getTypeBadge(agreement.type)}
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">{agreement.description}</p>
                    
                    <div className="flex flex-wrap gap-2 pt-2">
                      {agreement.applicable_to?.map((tag: string) => (
                        <span key={tag} className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                          {tag}
                        </span>
                      ))}
                      {(!agreement.applicable_to || agreement.applicable_to.length === 0) && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">Global (All Programs)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 mt-4 md:mt-0">
                    <button onClick={() => handleOpenModal(agreement)} className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-emerald-500 transition-colors">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => handleDelete(agreement.id)} className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-500 hover:bg-rose-500/10 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              
              {agreements.length === 0 && (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl">
                  <p className="text-slate-500 font-bold italic">No core agreements configured yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* EDITOR MODAL */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-[#0f172a] border border-white/10 rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/5 shrink-0">
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                      {editingId ? "Edit Agreement" : "New Agreement"}
                    </h3>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar">
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Unique ID *</label>
                        <input 
                          type="text" 
                          value={formData.id} 
                          disabled={!!editingId} 
                          onChange={e => setFormData({...formData, id: e.target.value})} 
                          placeholder="e.g. medical-concerns"
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all disabled:opacity-50" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Display Title *</label>
                        <input 
                          type="text" 
                          value={formData.title} 
                          onChange={e => setFormData({...formData, title: e.target.value})} 
                          placeholder="e.g. Medical Concerns"
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Response Type *</label>
                      <select 
                        value={formData.type} 
                        onChange={e => setFormData({...formData, type: e.target.value})}
                        className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                      >
                        <option value="required_checkbox">Mandatory Checkbox (Must Agree)</option>
                        <option value="yes_no">Yes / No Toggle (Must make a choice)</option>
                        <option value="optional_text">Text Input (Optional info)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Agreement Text / Description *</label>
                      <textarea 
                        rows={3}
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        placeholder={formData.type === 'optional_text' ? "Please list any allergies or medical conditions..." : "I agree to..."}
                        className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all resize-none" 
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Applicable Programs</label>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">Select which programs require this agreement. If none are selected, it applies globally to everyone.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PROGRAM_TAGS.map(tag => {
                        const isSelected = formData.applicable_to.includes(tag);
                        return (
                          <div 
                            key={tag} 
                            onClick={() => handleToggleTag(tag)}
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-[#020617] hover:border-white/20'}`}
                          >
                            <div className="shrink-0">
                              {isSelected ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} className="text-slate-500" />}
                            </div>
                            <span className={`text-sm font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>{tag}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>

                <div className="p-6 md:p-8 border-t border-white/5 bg-[#020617] shrink-0">
                  <button 
                    onClick={handleSave} 
                    disabled={isProcessing}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {isProcessing ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Agreement</>}
                  </button>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}