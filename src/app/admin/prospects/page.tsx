"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, Plus, X, Save, PhoneCall, Mail, MessageSquare, 
  Calendar, Clock, Target, ClipboardList, Loader2, ArrowRight, ArrowLeft, Trash2, CheckCircle2, User, Users, FilterX, FileText, FileSignature, MessageCircle
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_OPTIONS = ["New Lead", "Attempted Contact", "Engaged", "Warm (Pending Close)", "Converted (Won)", "Lost"];
const SOURCE_OPTIONS = ["Meta Ad - Polokwane Bootcamp", "Meta Ad - General", "Google Search", "Referral", "Website Contact Form", "Other"];

const formatWhatsAppNumber = (phone: string) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, ''); 
  if (cleaned.startsWith('0')) {
    cleaned = '27' + cleaned.substring(1); 
  }
  return cleaned;
};

export default function ProspectsCRM() {
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prospects, setProspects] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPipeline, setFilterPipeline] = useState<string>("All");
  const [filterAction, setFilterAction] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterQuote, setFilterQuote] = useState<"All" | "Sent" | "Not Sent">("All");
  
  const [stats, setStats] = useState({ 
    total: 0, active: 0, newLead: 0, attempted: 0, 
    engaged: 0, warm: 0, converted: 0, lost: 0 
  });

  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false); 
  const [newLogText, setNewLogText] = useState("");
  const [newLogType, setNewLogType] = useState("Note");

  useEffect(() => {
    fetchProspects();
  }, []);

  async function fetchProspects() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const fetchedData = data || [];
      setProspects(fetchedData);
      
      setStats({
        total: fetchedData.length,
        active: fetchedData.filter(p => !['Lost', 'Converted (Won)'].includes(p.status)).length,
        newLead: fetchedData.filter(p => p.status === 'New Lead').length,
        attempted: fetchedData.filter(p => p.status === 'Attempted Contact').length,
        engaged: fetchedData.filter(p => p.status === 'Engaged').length,
        warm: fetchedData.filter(p => p.status === 'Warm (Pending Close)').length,
        converted: fetchedData.filter(p => p.status === 'Converted (Won)').length,
        lost: fetchedData.filter(p => p.status === 'Lost').length
      });

    } catch (err) {
      console.error("Failed to fetch prospects:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const payload = {
        name: selectedProspect.name,
        email: selectedProspect.email,
        phone: selectedProspect.phone,
        source: selectedProspect.source,
        raw_form_data: selectedProspect.raw_form_data,
        status: selectedProspect.status,
        quote_sent: selectedProspect.quote_sent || false,
        next_action_task: selectedProspect.next_action_task,
        next_action_deadline: selectedProspect.next_action_deadline || null,
        updated_at: new Date().toISOString()
      };

      if (isCreating) {
        const { data, error } = await supabase.from('prospects').insert([{ ...payload, contact_log: [] }]).select().single();
        if (error) throw error;
        setProspects([data, ...prospects]);
        setSuccessMessage("New prospect created successfully!");
      } else {
        const { error } = await supabase.from('prospects').update(payload).eq('id', selectedProspect.id);
        if (error) throw error;
        setProspects(prospects.map(p => p.id === selectedProspect.id ? { ...p, ...payload } : p));
        setSuccessMessage("Prospect updated successfully!");
      }
      
      setIsCreating(false);
      setSelectedProspect(null);
      await fetchProspects();
    } catch (err) {
      alert("Failed to save prospect data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddLogEntry = async () => {
    if (!newLogText.trim() || !selectedProspect?.id) return;
    setIsProcessing(true);
    
    try {
      const newEntry = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        type: newLogType,
        text: newLogText
      };

      const updatedLogs = [newEntry, ...(selectedProspect.contact_log || [])];
      
      const { error } = await supabase
        .from('prospects')
        .update({ contact_log: updatedLogs, updated_at: new Date().toISOString() })
        .eq('id', selectedProspect.id);
        
      if (error) throw error;

      const updatedProspect = { ...selectedProspect, contact_log: updatedLogs };
      setSelectedProspect(updatedProspect);
      setProspects(prospects.map(p => p.id === selectedProspect.id ? updatedProspect : p));
      setNewLogText("");
      setSuccessMessage("Log entry added successfully.");
    } catch (err) {
      alert("Failed to add log entry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    const updatedLogs = selectedProspect.contact_log.filter((l: any) => l.id !== logId);
    try {
      await supabase.from('prospects').update({ contact_log: updatedLogs }).eq('id', selectedProspect.id);
      setSelectedProspect({ ...selectedProspect, contact_log: updatedLogs });
      setProspects(prospects.map(p => p.id === selectedProspect.id ? { ...p, contact_log: updatedLogs } : p));
      setSuccessMessage("Log entry removed.");
    } catch (err) {
      alert("Failed to delete log.");
    }
  };

  const openNewProspect = () => {
    setSelectedProspect({
      name: "", email: "", phone: "", source: "Meta Ad - Polokwane Bootcamp", raw_form_data: "", status: "New Lead", quote_sent: false, next_action_task: "", next_action_deadline: "", contact_log: []
    });
    setIsCreating(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterPipeline("All");
    setFilterAction("");
    setFilterDate("");
    setFilterQuote("All");
  };

  const filteredProspects = prospects.filter(p => {
    // Clean the search query and the phone number for better matching (digits only)
    const cleanSearch = searchQuery.replace(/\D/g, '');
    const cleanPhone = p.phone ? p.phone.replace(/\D/g, '') : '';

    const matchesSearch = 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.phone?.includes(searchQuery) || // Matches exact string (e.g. "082 123")
      (cleanSearch !== "" && cleanPhone.includes(cleanSearch)); // Matches digits only (e.g. "082123")
    
    const matchesPipeline = filterPipeline === "All" ? true 
      : filterPipeline === "Active" ? !['Lost', 'Converted (Won)'].includes(p.status)
      : p.status === filterPipeline;
    
    const matchesAction = filterAction ? p.next_action_task?.toLowerCase().includes(filterAction.toLowerCase()) : true;
    const matchesDate = filterDate ? p.next_action_deadline === filterDate : true;

    const matchesQuote = filterQuote === "All" ? true 
      : filterQuote === "Sent" ? p.quote_sent === true 
      : p.quote_sent === false;

    return matchesSearch && matchesPipeline && matchesAction && matchesDate && matchesQuote;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New Lead': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Attempted Contact': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'Engaged': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Warm (Pending Close)': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Converted (Won)': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Lost': return 'bg-white/5 text-slate-500 border-white/10';
      default: return 'bg-white/5 text-slate-400 border-white/10';
    }
  };

  const isDeadlinePast = (date: string) => {
     if (!date) return false;
     return new Date(date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-fuchsia-500" size={40} />
      <p className="text-fuchsia-400 font-black uppercase tracking-widest text-[10px]">Loading Sales Pipeline...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {!selectedProspect && !isCreating ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
              <div className="space-y-4">
                <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-fuchsia-500/50 px-4 py-2 rounded-xl transition-all w-fit">
                  <ArrowLeft size={16} className="text-slate-500 group-hover:text-fuchsia-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Mission Control</span>
                </Link>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-fuchsia-500">
                    <Target size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Ad_Targeting_System</span>
                  </div>
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter text-white">Sales_<span className="text-fuchsia-500">Pipeline</span></h1>
                </div>
              </div>
              
              <button onClick={openNewProspect} className="px-6 py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl shadow-fuchsia-900/20 transition-all">
                <Plus size={16}/> Manual Entry
              </button>
            </header>

            {/* CLICKABLE STATS DASHBOARD */}
            <section className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-8">
              {[
                { label: "All Active", value: stats.active, icon: Target, color: "text-white", filter: "Active" },
                { label: "New Lead", value: stats.newLead, icon: Users, color: "text-blue-400", filter: "New Lead" },
                { label: "Attempted", value: stats.attempted, icon: PhoneCall, color: "text-yellow-400", filter: "Attempted Contact" },
                { label: "Engaged", value: stats.engaged, icon: MessageSquare, color: "text-purple-400", filter: "Engaged" },
                { label: "Warm (Pending)", value: stats.warm, icon: Clock, color: "text-amber-400", filter: "Warm (Pending Close)" },
                { label: "Converted", value: stats.converted, icon: CheckCircle2, color: "text-green-400", filter: "Converted (Won)" },
                { label: "Lost Deals", value: stats.lost, icon: X, color: "text-slate-500", filter: "Lost" },
              ].map((card: any, i) => (
                <button 
                  key={i} 
                  onClick={() => setFilterPipeline(card.filter)}
                  className={`text-left border p-3 rounded-xl relative overflow-hidden group transition-all ${filterPipeline === card.filter ? `bg-white/10 border-white/30 shadow-md shadow-${card.color.split('-')[1]}-900/20` : `bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]`}`}
                >
                  <card.icon className={`absolute -right-2 -bottom-2 size-10 opacity-10 ${card.color} group-hover:scale-110 transition-transform`} />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${filterPipeline === card.filter ? 'text-white' : 'text-slate-500'}`}>{card.label}</p>
                  <h4 className={`text-xl font-black italic mt-0.5 ${card.color}`}>{card.value}</h4>
                </button>
              ))}
            </section>

            {/* FILTERS & SEARCH */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-[32px]">
              
              <div className="relative group w-full lg:max-w-md">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-fuchsia-400 transition-colors" size={20} />
                <input 
                  type="text" placeholder="Search prospects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1e293b]/50 border border-white/5 rounded-[24px] py-4 pl-16 pr-8 text-white focus:outline-none focus:border-fuchsia-500/50 transition-all placeholder:text-slate-600 font-bold"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-[#1e293b]/50 border border-white/5 rounded-2xl px-4 py-2">
                  <ClipboardList size={14} className="text-slate-500" />
                  <input 
                    type="text" placeholder="Filter Next Action..." value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
                    className="bg-transparent text-sm text-white placeholder:text-slate-600 outline-none w-full sm:w-32"
                  />
                </div>
                <div className="flex items-center gap-2 bg-[#1e293b]/50 border border-white/5 rounded-2xl px-4 py-2">
                  <Calendar size={14} className="text-slate-500" />
                  <input 
                    type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-transparent text-sm text-white outline-none w-full sm:w-auto [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]"
                  />
                </div>
                <div className="flex items-center gap-2 bg-[#1e293b]/50 border border-white/5 rounded-2xl px-4 py-2">
                  <FileText size={14} className="text-slate-500" />
                  <select 
                    value={filterQuote} onChange={(e) => setFilterQuote(e.target.value as any)}
                    className="bg-transparent text-sm text-white outline-none w-full sm:w-auto cursor-pointer"
                  >
                    <option value="All" className="bg-[#0f172a]">Quote: Any</option>
                    <option value="Sent" className="bg-[#0f172a]">Quote Sent</option>
                    <option value="Not Sent" className="bg-[#0f172a]">No Quote</option>
                  </select>
                </div>
                {(searchQuery || filterPipeline !== "All" || filterAction || filterDate || filterQuote !== "All") && (
                  <button onClick={handleResetFilters} className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-colors shrink-0">
                    <FilterX size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative min-h-[500px]">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="px-8 py-5">Prospect Details</th>
                    <th className="px-8 py-5">Status / Source</th>
                    <th className="px-8 py-5">Next Action</th>
                    <th className="px-8 py-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProspects.length === 0 ? (
                    <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 font-black uppercase tracking-widest text-sm italic">No prospects found matching your filters.</td></tr>
                  ) : (
                    filteredProspects.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="px-8 py-6 align-top">
                          <div className="flex items-center gap-3">
                            <p className="font-black text-white uppercase italic text-lg leading-none">{p.name}</p>
                            {p.quote_sent && <span className="px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-400 rounded-md text-[8px] font-black uppercase tracking-widest border border-fuchsia-500/30">Quote Sent</span>}
                          </div>
                          <div className="flex flex-col gap-1 mt-2 text-[10px] text-slate-400 font-bold">
                            {p.email && <span className="flex items-center gap-2"><Mail size={12}/> {p.email}</span>}
                            {p.phone && (
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-2"><PhoneCall size={12}/> {p.phone}</span>
                                <a 
                                  href={`whatsapp://send?phone=${formatWhatsAppNumber(p.phone)}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[#25D366] hover:text-white bg-[#25D366]/10 hover:bg-[#25D366] p-1 rounded transition-colors" 
                                  title="Open in WhatsApp Desktop"
                                >
                                  <MessageCircle size={12} />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 align-top space-y-2">
                          <span className={`inline-flex px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${getStatusColor(p.status)}`}>
                            {p.status}
                          </span>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><ClipboardList size={10}/> {p.source}</p>
                        </td>
                        <td className="px-8 py-6 align-top">
                          {p.next_action_task ? (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-300 max-w-[250px] truncate">{p.next_action_task}</p>
                              {p.next_action_deadline && (
                                  <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isDeadlinePast(p.next_action_deadline) ? 'text-red-400' : 'text-blue-400'}`}>
                                    <Calendar size={12}/> {new Date(p.next_action_deadline).toLocaleDateString()}
                                  </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-600 uppercase italic">No action scheduled</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right align-top">
                          <button onClick={() => { setIsCreating(false); setSelectedProspect(p); }} className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[9px] font-black uppercase italic tracking-widest border border-white/10 text-white">
                            Inspect <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20">
            
            {/* EDITOR HEADER */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-white/5 pb-8">
              <div className="space-y-4">
                <button onClick={() => { setSelectedProspect(null); setIsCreating(false); }} className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-fuchsia-400 transition-colors">
                  <ArrowLeft size={16} /> Back to Pipeline
                </button>
                <div>
                  <h2 className="text-4xl font-black uppercase italic text-fuchsia-400 leading-none">
                    {isCreating ? 'New Prospect Setup' : 'Prospect Workspace'}
                  </h2>
                  {!isCreating && <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Tracking since {new Date(selectedProspect.created_at).toLocaleDateString()}</p>}
                </div>
              </div>
              <button type="submit" form="prospectForm" disabled={isProcessing} className="w-full md:w-auto px-8 py-4 bg-fuchsia-600 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 hover:bg-fuchsia-500 transition-all shadow-xl shadow-fuchsia-900/20 disabled:opacity-50">
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> Commit Changes</>}
              </button>
            </div>

            {/* TWO COLUMN LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* LEFT COLUMN: Data & Forms */}
              <div className="lg:col-span-2 space-y-8">
                <form id="prospectForm" onSubmit={handleSaveProspect} className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl space-y-8">
                  
                  <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <User className="text-fuchsia-500" size={20} />
                    <h3 className="text-lg font-black uppercase tracking-widest text-white">Core Details</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Prospect Name</label>
                      <input required value={selectedProspect.name} onChange={e => setSelectedProspect({...selectedProspect, name: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-white font-bold text-lg outline-none focus:border-fuchsia-500" placeholder="e.g. Sarah Connor" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Email Address</label>
                      <input type="email" value={selectedProspect.email} onChange={e => setSelectedProspect({...selectedProspect, email: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-fuchsia-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Phone Number</label>
                      <input value={selectedProspect.phone} onChange={e => setSelectedProspect({...selectedProspect, phone: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-fuchsia-500" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Lead Source</label>
                      <select value={selectedProspect.source} onChange={e => setSelectedProspect({...selectedProspect, source: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm font-bold outline-none focus:border-fuchsia-500">
                        {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-6 border-t border-white/5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-2"><ClipboardList size={14}/> Raw Ad Response / Form Data</label>
                    <textarea 
                      value={selectedProspect.raw_form_data || ""} onChange={e => setSelectedProspect({...selectedProspect, raw_form_data: e.target.value})}
                      placeholder="Paste raw data from Meta/Facebook here for record keeping..."
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl p-6 text-sm font-mono text-slate-400 min-h-[300px] outline-none focus:border-fuchsia-500 resize-y leading-relaxed"
                    />
                  </div>
                </form>
              </div>

              {/* RIGHT COLUMN: Pipeline & Log */}
              <div className="lg:col-span-1 space-y-8">
                
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 p-8 rounded-[40px] shadow-2xl shadow-fuchsia-900/10 space-y-6 relative overflow-hidden">
                  <h3 className="text-sm font-black uppercase tracking-widest text-fuchsia-400 flex items-center gap-2 border-b border-fuchsia-500/20 pb-4"><Target size={18}/> Pipeline Control</h3>
                  
                  <div className="space-y-5 relative z-10">

                    {selectedProspect.phone && !isCreating && (
                      <a 
                        href={`whatsapp://send?phone=${formatWhatsAppNumber(selectedProspect.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 bg-[#25D366] text-white font-black uppercase italic text-xs rounded-xl shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 mb-3"
                        title="Open in WhatsApp Desktop"
                      >
                        <MessageCircle size={16}/> WhatsApp Contact
                      </a>
                    )}
                    
                    {!isCreating && (
                      <button 
                        onClick={() => setIsQuoteModalOpen(true)}
                        className="w-full py-4 bg-white text-black font-black uppercase italic text-xs rounded-xl shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
                      >
                        <FileSignature size={16}/> Launch Quote Engine
                      </button>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Current Status</label>
                      <select value={selectedProspect.status} onChange={e => setSelectedProspect({...selectedProspect, status: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-fuchsia-500 shadow-inner">
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-fuchsia-500/20 mt-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedProspect.quote_sent ? 'bg-fuchsia-500 border-fuchsia-500' : 'bg-[#020617] border-white/20 group-hover:border-fuchsia-500/50'}`}>
                          {selectedProspect.quote_sent && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-white transition-colors">Formal Quote Sent</span>
                        <input type="checkbox" className="hidden" checked={selectedProspect.quote_sent || false} onChange={e => setSelectedProspect({...selectedProspect, quote_sent: e.target.checked})} />
                      </label>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Next Action / Task</label>
                      <input 
                        list="action-tasks"
                        value={selectedProspect.next_action_task} 
                        onChange={e => setSelectedProspect({...selectedProspect, next_action_task: e.target.value})} 
                        placeholder="e.g. Send Quote" 
                        className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-fuchsia-500 shadow-inner" 
                      />
                      <datalist id="action-tasks">
                         <option value="Call" />
                         <option value="Email" />
                         <option value="Quote" />
                         <option value="Invoice" />
                         <option value="Follow-up" />
                      </datalist>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Action Deadline</label>
                      <input type="date" value={selectedProspect.next_action_deadline || ''} onChange={e => setSelectedProspect({...selectedProspect, next_action_deadline: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-fuchsia-500 shadow-inner [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                    </div>
                  </div>
                </div>

                {!isCreating && (
                  <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] shadow-2xl space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 border-b border-white/5 pb-4"><Clock size={18}/> Contact Log</h3>
                    
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                       <div className="flex flex-col gap-3">
                         <select value={newLogType} onChange={e => setNewLogType(e.target.value)} className="bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none">
                           <option>Note</option><option>Call</option><option>Email</option><option>Quote Sent</option>
                         </select>
                         <textarea value={newLogText} onChange={e => setNewLogText(e.target.value)} placeholder="Type update..." className="w-full bg-[#020617] border border-white/10 rounded-lg px-4 py-3 text-sm text-slate-300 outline-none focus:border-fuchsia-500 min-h-[80px]" onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddLogEntry()}/>
                         <button onClick={handleAddLogEntry} disabled={!newLogText.trim() || isProcessing} className="bg-fuchsia-600 text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-fuchsia-500 transition-all">Add Entry</button>
                       </div>
                    </div>

                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent mt-8">
                      {(selectedProspect.contact_log || []).map((log: any) => (
                        <div key={log.id} className="relative flex items-start group is-active mb-6">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-slate-800 text-slate-400 shadow shrink-0 z-10">
                            {log.type === 'Call' ? <PhoneCall size={14}/> : log.type === 'Email' ? <Mail size={14}/> : <MessageSquare size={14}/>}
                          </div>
                          <div className="ml-4 w-full bg-white/5 p-4 rounded-2xl border border-white/5 relative mt-1">
                            <button onClick={() => handleDeleteLog(log.id)} className="absolute top-3 right-3 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                            <div className="flex items-center justify-between mb-2 pr-6">
                              <span className="text-[10px] font-black uppercase text-fuchsia-400 tracking-widest">{log.type}</span>
                              <span className="text-[9px] font-bold text-slate-500">{new Date(log.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{log.text}</p>
                          </div>
                        </div>
                      ))}
                      {(!selectedProspect.contact_log || selectedProspect.contact_log.length === 0) && (
                         <p className="text-center text-xs font-bold text-slate-600 uppercase tracking-widest italic pt-4">No logs recorded.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}

      </div>

      {/* QUOTE ENGINE MODAL */}
      <AnimatePresence>
        {isQuoteModalOpen && selectedProspect && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8"
          >
            <div className="w-full max-w-6xl h-full max-h-[90vh] bg-[#020617] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl shadow-fuchsia-900/20 flex flex-col relative">
              
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/30">
                    <FileSignature size={18} className="text-fuchsia-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Quote Composer Active</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing for: {selectedProspect.name}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setIsQuoteModalOpen(false)} 
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all text-slate-300 hover:text-white"
                >
                  <X size={14} /> Close Composer
                </button>
              </div>

              <div className="flex-1 w-full bg-[#0f172a] relative">
                <iframe 
                  src={`/admin/finance/composer?mode=quote&prospectName=${encodeURIComponent(selectedProspect.name)}&prospectEmail=${encodeURIComponent(selectedProspect.email || '')}&prospectPhone=${encodeURIComponent(selectedProspect.phone || '')}`} 
                  className="w-full h-full absolute inset-0 border-none"
                  title="Finance Composer"
                />
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUCCESS NOTIFICATION WIDGET */}
      <SuccessModal 
        message={successMessage} 
        onClose={() => setSuccessMessage(null)} 
      />
    </div>
  );
}

// ---------------------------------------------------------
// SUCCESS MODAL NOTIFICATION WIDGET
// ---------------------------------------------------------
function SuccessModal({ message, onClose }: { message: string | null, onClose: () => void }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <div className="fixed bottom-10 right-10 z-[300] flex justify-end pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 20, scale: 0.9 }} 
            className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl p-5 shadow-2xl shadow-emerald-900/20 flex items-center gap-4 max-w-sm w-full pointer-events-auto relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="text-emerald-400" size={20} />
            </div>
            <div className="flex-1 pr-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none mb-1">Success</h3>
              <p className="text-[10px] font-bold text-slate-400 leading-tight">{message}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors shrink-0">
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}