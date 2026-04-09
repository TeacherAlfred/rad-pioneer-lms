"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, User, Calendar, BookOpen, Shield, 
  ChevronRight, ArrowLeft, Loader2, Filter, Users,
  Mail, Phone, Info, Award, Clock, CheckCircle2, 
  AlertCircle, LayoutGrid, List, Zap, CreditCard,
  X, ArrowRight, TrendingUp, Activity, Smartphone, Globe, Monitor, Play, CheckSquare, Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function PioneerDashboard() {
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pioneers, setPioneers] = useState<any[]>([]);
  const [selectedPioneer, setSelectedPioneer] = useState<null | any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Advanced Filtering
  const [filterType, setFilterType] = useState<"all" | "term" | "trial">("all");
  const [filterMode, setFilterMode] = useState<"all" | "in-person" | "online" | "self-paced">("all");
  
  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [pulse, setPulse] = useState({
    total: 0,
    adopted: 0,
    termCount: 0,
    avgAttendance: 0
  });

  useEffect(() => {
    fetchPioneerData();
  }, []);

  async function fetchPioneerData() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, parent:linked_parent_id(display_name, metadata)')
        .eq('role', 'student')
        .order('display_name', { ascending: true });

      if (!error && data) {
        setPioneers(data);
        const adopted = data.filter(p => p.metadata?.username).length;
        const terms = data.filter(p => p.metadata?.account_tier === 'full').length;
        setPulse({ total: data.length, adopted, termCount: terms, avgAttendance: 0 });
      }
    } finally {
      setLoading(false);
    }
  }

  // --- BULK ACTION HANDLER ---
  const handleBulkUpdate = async (tier: 'full' | 'demo', mode?: string) => {
    if (selectedIds.length === 0) return;
    const confirm = window.confirm(`Update license for ${selectedIds.length} pioneers?`);
    if (!confirm) return;

    setIsProcessing(true);
    try {
      // In a real DB, we'd use a RPC call for batch metadata updates, 
      // but for this scale, we'll map the updates.
      for (const id of selectedIds) {
        const p = pioneers.find(p => p.id === id);
        const updatedMetadata = { 
          ...p.metadata, 
          account_tier: tier,
          learning_mode: tier === 'full' ? (mode || 'online') : null
        };
        await supabase.from('profiles').update({ metadata: updatedMetadata }).eq('id', id);
      }
      
      await fetchPioneerData();
      setSelectedIds([]);
      alert("Bulk update complete.");
    } catch (err) {
      alert("Bulk update failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredPioneers = pioneers.filter(p => {
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const license = p.metadata?.account_tier === "full" ? "term" : "trial";
    const mode = p.metadata?.learning_mode || "none";
    
    const matchesType = filterType === "all" || filterType === license;
    const matchesMode = filterMode === "all" || filterMode === mode;
    
    return matchesSearch && matchesType && matchesMode;
  });

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Syncing_Pioneer_Database...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* NAV & TITLE */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-500/50 px-4 py-2 rounded-xl transition-all w-fit text-slate-400 hover:text-white">
              <ArrowLeft size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Command Center</span>
            </Link>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Student_<span className="text-blue-500">Ledger</span></h1>
          </div>
          {selectedIds.length > 0 && (
             <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3 bg-blue-600 p-2 rounded-2xl shadow-xl shadow-blue-900/40 border border-blue-400">
                <span className="px-4 text-[10px] font-black uppercase tracking-widest">{selectedIds.length} Selected</span>
                <div className="h-8 w-px bg-white/20 mx-2" />
                <button onClick={() => handleBulkUpdate('demo')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase transition-all">Set Trial</button>
                <button onClick={() => handleBulkUpdate('full', 'in-person')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-[9px] font-black uppercase transition-all">Set In-Person</button>
                <button onClick={() => setSelectedIds([])} className="p-2 hover:bg-black/20 rounded-xl transition-all"><X size={16}/></button>
             </motion.div>
          )}
        </header>

        {/* HEARTBEAT ROW */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { label: "Active Pioneers", value: pulse.total > 0 ? pulse.total : "---", icon: Users, color: "text-blue-400" },
                { label: "LMS Adoption", value: pulse.total > 0 ? `${Math.round((pulse.adopted / pulse.total) * 100)}%` : "---", icon: Activity, color: "text-emerald-400" },
                { label: "Term Licenses", value: pulse.termCount > 0 ? pulse.termCount : "---", icon: CreditCard, color: "text-purple-400" },
                { label: "Avg Attendance", value: pulse.avgAttendance > 0 ? `${pulse.avgAttendance}%` : "---", icon: Clock, color: "text-orange-400" },
            ].map((stat, i) => (
                <div key={i} className={`bg-white/[0.03] border border-white/5 p-5 rounded-[24px] relative overflow-hidden group ${stat.value === "---" ? 'opacity-40 grayscale' : ''}`}>
                    <stat.icon className={`absolute -right-2 -bottom-2 size-12 opacity-5 ${stat.color}`} />
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">{stat.label}</p>
                    <h4 className={`text-2xl font-black italic ${stat.color}`}>{stat.value}</h4>
                </div>
            ))}
        </section>

        {/* MULTI-LEVEL FILTERS */}
        <div className="space-y-4 bg-white/[0.02] border border-white/5 p-6 rounded-[32px]">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="relative group w-full lg:max-w-md">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-400 transition-colors" size={20} />
                    <input type="text" placeholder="Search by Pioneer Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-[24px] py-4 pl-16 pr-8 text-white focus:outline-none focus:border-blue-500 transition-all font-bold" />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setSelectedIds(filteredPioneers.map(p => p.id))} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase text-slate-400 transition-all border border-white/5">Select All Visible</button>
                    {selectedIds.length > 0 && <button onClick={() => setSelectedIds([])} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-[9px] font-black uppercase text-red-400 transition-all border border-red-500/20">Clear Selection</button>}
                </div>
            </div>

            <div className="flex flex-wrap gap-4 border-t border-white/5 pt-4">
                <div className="flex bg-black/20 p-1 rounded-2xl border border-white/5">
                    {["all", "term", "trial"].map(t => (
                        <button key={t} onClick={() => setFilterType(t as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterType === t ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}>{t}</button>
                    ))}
                </div>
                <div className="flex bg-black/20 p-1 rounded-2xl border border-white/5">
                    {["all", "in-person", "online", "self-paced"].map(m => (
                        <button key={m} onClick={() => setFilterMode(m as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterMode === m ? "bg-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}>{m.replace('-', ' ')}</button>
                    ))}
                </div>
            </div>
        </div>

        {/* CARD GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPioneers.map((p) => {
            const isFull = p.metadata?.account_tier === "full";
            const mode = p.metadata?.learning_mode;
            const isSelected = selectedIds.includes(p.id);

            return (
              <motion.div 
                key={p.id}
                whileHover={{ y: -5 }}
                className={`cursor-pointer bg-[#0f172a] border p-8 rounded-[40px] relative overflow-hidden group transition-all shadow-2xl ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/10 hover:border-blue-500/50'}`}
              >
                {/* SELECTOR OVERLAY */}
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleSelection(p.id); }}
                    className={`absolute top-6 left-6 z-20 transition-all ${isSelected ? 'text-blue-500' : 'text-slate-700 opacity-0 group-hover:opacity-100 hover:text-blue-400'}`}
                >
                    {isSelected ? <CheckSquare size={24} fill="currentColor" className="text-white" /> : <Square size={24} />}
                </button>

                <div onClick={() => setSelectedPioneer(p)}>
                    <div className="flex justify-between items-start mb-6 pl-8">
                        <div className={`size-12 rounded-2xl flex items-center justify-center border ${isFull ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-purple-500/30 bg-purple-500/10 text-purple-400'}`}>
                            <User size={24} />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isFull ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                {isFull ? 'Term License' : 'Trial Access'}
                            </span>
                            {isFull && mode && <span className="text-[8px] font-black uppercase text-slate-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">{mode.replace('-', ' ')}</span>}
                        </div>
                    </div>
                    <h3 className="text-2xl font-black uppercase italic group-hover:text-blue-400 transition-colors leading-none">{p.display_name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Guardian: {p.parent?.display_name || "Unlinked"}</p>
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Username</span>
                            <span className="text-xs font-bold text-slate-300">{p.metadata?.username || 'not_set'}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Progress</span>
                            <span className="text-sm font-black text-blue-400 italic">{p.metadata?.progress || 0}%</span>
                        </div>
                    </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* DEEP DIVE SLIDE-OVER (KEEPING FROM PREVIOUS VERSION) */}
      <AnimatePresence>
        {selectedPioneer && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPioneer(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }} className="relative w-full max-w-2xl bg-[#020617] border-l border-white/10 h-full p-10 overflow-y-auto space-y-10 shadow-2xl">
                {/* ... slide over content from previous build ... */}
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black uppercase italic text-white">{selectedPioneer.display_name}</h2>
                        <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">Active_Pioneer_File</p>
                    </div>
                    <button onClick={() => setSelectedPioneer(null)} className="p-3 bg-white/5 rounded-full"><X size={24}/></button>
                </div>

                <div className="bg-white/[0.03] border border-white/10 p-8 rounded-[40px] space-y-6 text-left">
                    <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 flex items-center gap-2"><Shield size={18}/> Licensing_Update</h3>
                    <div className="grid grid-cols-1 gap-3">
                         <button onClick={() => handleBulkUpdate('demo')} className={`p-5 rounded-2xl border text-left transition-all ${selectedPioneer.metadata?.account_tier === 'demo' ? 'bg-purple-600 border-purple-400' : 'bg-white/5 border-white/10'}`}>
                            <p className="text-[10px] font-black uppercase opacity-60">Tier 01</p>
                            <p className="text-lg font-black uppercase italic">Trial LMS Access</p>
                         </button>
                         <div className="grid grid-cols-3 gap-2">
                            {['in-person', 'online', 'self-paced'].map(m => (
                                <button key={m} onClick={() => handleBulkUpdate('full', m)} className={`p-3 rounded-xl border text-[9px] font-black uppercase transition-all ${selectedPioneer.metadata?.learning_mode === m ? 'bg-emerald-600 border-emerald-400' : 'bg-white/5 border-white/10'}`}>Set {m}</button>
                            ))}
                         </div>
                    </div>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}