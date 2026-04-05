"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, Mail, Phone, ArrowLeft, ArrowRight,
  Loader2, X, Save, CheckCircle2, Edit3, 
  MessageSquare, UserPlus, ChevronDown, ChevronUp,
  User, Target, CreditCard, Plus, Globe, Trash2
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// --- GLOBAL FORMATTER ---
const formatProgramName = (rawName: string) => {
  if (!rawName) return "";
  const lower = rawName.toLowerCase();
  const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  if (lower.includes('(online)')) return `OL: ${cleanName}`;
  if (lower.includes('in-person') || lower.includes('(plk)')) return `IP: ${cleanName}`;
  return rawName;
};

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // DATA STATES
  const [requests, setRequests] = useState<any[]>([]);
  const [manualLeads, setManualLeads] = useState<any[]>([]);
  
  // MODAL STATES
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState<any>(null);
  
  // FORM STATES
  const [newLeadForm, setNewLeadForm] = useState({ 
    name: '', email: '', phone: '', notes: '', 
    source: 'Personal Network', interest: 'Bootcamp' 
  });
  const [householdFunnelStage, setHouseholdFunnelStage] = useState<string>("Lead (New)");

  // FILTER & BULK STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFunnel, setFilterFunnel] = useState("all");
  const [selectedLeads, setSelectedLeads] = useState<{id: string, source: string}[]>([]);
  const [bulkStage, setBulkStage] = useState("");

  const LEADS_STAGES = ["Lead (New)", "Contacted / In Review", "Onboarding (Trial LMS)", "Dropped"];
  const LEAD_SOURCES = ["Social Media", "Google Ad", "Event / Workshop", "Personal Network", "Referral", "Other"];
  const SERVICES = ["LMS Access", "Bootcamp", "Term Lessons", "Robotics Kits", "Private Tutoring"];

  useEffect(() => { 
    fetchData(); 
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [regRes, profRes] = await Promise.all([
        supabase.from('registrations').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').in('status', ['lead', 'dropped']).order('created_at', { ascending: false })
      ]);
      setRequests(regRes.data || []);
      setManualLeads(profRes.data || []);
    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setLoading(false); 
    }
  }

  const handleManualLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.email && !newLeadForm.phone) {
      alert("Validation Error: Provide at least one contact method (Email or Phone).");
      return;
    }
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('profiles').insert({
        display_name: newLeadForm.name,
        role: 'guardian',
        status: 'lead',
        lead_source: newLeadForm.source,
        interested_service: newLeadForm.interest,
        metadata: { email: newLeadForm.email, phone: newLeadForm.phone, admin_notes: newLeadForm.notes, lead_origin: 'manual' },
        funnel_stage: 'Lead (New)'
      });
      if (error) throw error;
      setShowAddLeadModal(false);
      setNewLeadForm({ name: '', email: '', phone: '', notes: '', source: 'Personal Network', interest: 'Bootcamp' });
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsProcessing(false); }
  };

  const handleDropLead = async (id: string, source: string) => {
    if (!confirm("Move this lead to 'Dropped'?")) return;
    setIsProcessing(true);
    const table = source === "website" ? 'registrations' : 'profiles';
    await supabase.from(table).update({ funnel_stage: 'Dropped', status: 'dropped' }).eq('id', id);
    fetchData();
    setIsProcessing(false);
  }

  const handleSaveHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const isRegistration = editingHousehold.source === "website";
      const table = isRegistration ? 'registrations' : 'profiles';
      
      const payload = isRegistration ? {
        admin_notes: editingHousehold.admin_notes,
        metadata: { ...editingHousehold.metadata, funnel_stage: householdFunnelStage }
      } : {
        display_name: editingHousehold.parent_name,
        funnel_stage: householdFunnelStage,
        metadata: { ...editingHousehold.metadata, admin_notes: editingHousehold.admin_notes }
      };

      const { error } = await supabase.from(table).update(payload).eq('id', editingHousehold.id);
      if (error) throw error;
      setEditingHousehold(null);
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsProcessing(false); }
  };

  const toggleLeadSelection = (id: string, source: string) => {
    setSelectedLeads(prev => {
      const exists = prev.find(l => l.id === id);
      if (exists) return prev.filter(l => l.id !== id);
      return [...prev, { id, source }];
    });
  };

  const handleBulkUpdate = async () => {
    if (!bulkStage) return;
    setIsProcessing(true);
    try {
      const regIds = selectedLeads.filter(l => l.source === 'website').map(l => l.id);
      const profIds = selectedLeads.filter(l => l.source === 'manual').map(l => l.id);

      if (regIds.length > 0) {
        await supabase.from('registrations').update({ funnel_stage: bulkStage, status: bulkStage === 'Dropped' ? 'dropped' : 'lead' }).in('id', regIds);
      }
      if (profIds.length > 0) {
        await supabase.from('profiles').update({ funnel_stage: bulkStage, status: bulkStage === 'Dropped' ? 'dropped' : 'lead' }).in('id', profIds);
      }
      
      setSelectedLeads([]);
      setBulkStage("");
      fetchData();
    } catch (err) {
      alert("Failed to perform bulk update.");
    } finally {
      setIsProcessing(false);
    }
  };

  // UNIFIED GROUPING LOGIC (STRICTLY LEADS)
  const getDisplayData = () => {
    const combined: any[] = [];

    // 1. Process Website Registrations
    const groupedRegs = requests.reduce((acc: any, req) => {
      const key = req.email || `reg_${req.id}`;
      if (!acc[key]) {
        acc[key] = {
          id: req.id,
          parent_name: req.parent_name,
          email: req.email,
          phone: req.phone,
          funnel_stage: req.metadata?.funnel_stage || "Lead (New)", 
          admin_notes: req.admin_notes,
          metadata: req.metadata,
          source: 'website',
          children: []
        };
      }
      acc[key].children.push({ ...req, role: 'Pioneer' });
      return acc;
    }, {});
    combined.push(...Object.values(groupedRegs));

    // 2. Process Manual Leads (Only top-level guardians, nest the rest)
    const topLevelManual = manualLeads.filter(l => l.role === 'guardian' && !l.metadata?.household_lead_id);
    const manualList = topLevelManual.map(lead => {
      const pioneers = manualLeads.filter(p => p.role === 'student' && p.linked_parent_id === lead.id).map(p => ({
        id: p.id, student_name: p.display_name, role: 'Pioneer', interested_programs: p.interested_programs
      }));
      const crew = manualLeads.filter(p => p.role === 'guardian' && p.metadata?.household_lead_id === lead.id).map(p => ({
        id: p.id, student_name: p.display_name, role: 'Support Crew'
      }));

      return {
        id: lead.id,
        parent_name: lead.display_name,
        email: lead.metadata?.email || lead.email,
        phone: lead.metadata?.phone || lead.phone,
        funnel_stage: lead.funnel_stage || lead.metadata?.funnel_stage || "Lead (New)",
        admin_notes: lead.metadata?.admin_notes,
        metadata: lead.metadata,
        interested_service: lead.interested_service,
        source: 'manual',
        children: [...pioneers, ...crew]
      };
    });
    combined.push(...manualList);

    // 3. Filter by Funnel and Search (Exclude active clients entirely)
    return combined.filter(item => {
      const stage = item.funnel_stage || "Lead (New)";
      
      // Strict Isolation: If they somehow got marked Active here, they belong in Directory
      if (stage.includes("Active") || stage.includes("Past")) return false;

      const name = (item.parent_name || "").toLowerCase();
      const searchMatch = name.includes(searchQuery.toLowerCase()) || (item.email && item.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let funnelMatch = false;
      if (filterFunnel === "all") funnelMatch = stage !== "Dropped";
      else funnelMatch = stage === filterFunnel;

      return searchMatch && funnelMatch;
    });
  };

  const openEditor = (item: any) => {
    setEditingHousehold({
      id: item.id,
      parent_name: item.parent_name,
      email: item.email,
      phone: item.phone,
      admin_notes: item.admin_notes,
      metadata: item.metadata || {},
      funnel_stage: item.funnel_stage,
      source: item.source
    });
    setHouseholdFunnelStage(item.funnel_stage);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 text-left relative overflow-hidden pb-32">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
             <Link href="/admin/dashboard" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={14} /> Mission Control
            </Link>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter">Lead_<span className="text-blue-500">Pipeline</span></h1>
          </div>
          
          <div className="flex gap-4">
            <button onClick={() => setShowAddLeadModal(true)} className="flex items-center gap-2 px-6 py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl text-[10px] font-black uppercase italic transition-all shadow-xl shadow-purple-900/20">
              <Plus size={14}/> Create New Lead
            </button>
            <Link href="/admin/directory" className="flex items-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase italic transition-all text-slate-400 hover:text-white">
               Go to Directory <ArrowRight size={14}/>
            </Link>
          </div>
        </header>

        {/* --- FILTERS --- */}
        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" size={20} />
            <input 
              placeholder="SCANNING LEADS..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e293b]/50 border border-white/5 rounded-[32px] py-6 pl-16 pr-8 text-white focus:outline-none focus:border-blue-500/50 transition-all font-black italic uppercase tracking-tighter"
            />
          </div>
          <div className="flex flex-wrap gap-2 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-inner">
            <button onClick={() => setFilterFunnel("all")} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterFunnel === "all" ? "bg-white/10 text-white" : "text-slate-500"}`}>All Stages</button>
            {LEADS_STAGES.map(stage => (
              <button key={stage} onClick={() => setFilterFunnel(stage)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterFunnel === stage ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>
                {stage}
              </button>
            ))}
          </div>
        </div>

        {/* --- MAIN LIST --- */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[48px] overflow-hidden shadow-2xl divide-y divide-white/5">
          {getDisplayData().map((household: any, idx: number) => (
            <div key={idx} className="p-8 md:p-10 hover:bg-white/[0.01] transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    {/* BULK EDIT CHECKBOX */}
                    <input 
                       type="checkbox" 
                       checked={selectedLeads.some(l => l.id === household.id)}
                       onChange={() => toggleLeadSelection(household.id, household.source)}
                       className="w-5 h-5 rounded border-white/10 bg-[#020617] text-purple-500 focus:ring-purple-500 cursor-pointer"
                    />
                    <h4 className={`text-3xl font-black uppercase italic leading-none ${household.source === 'manual' ? 'text-purple-400' : 'text-blue-400'}`}>{household.parent_name || household.display_name}</h4>
                    {household.source === 'website' ? (
                       <span className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20"><Globe size={10}/> Web</span>
                    ) : (
                       <span className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20"><User size={10}/> Manual</span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 mt-3 pl-8 text-slate-500">
                    <span className="flex items-center gap-2 text-xs font-medium"><Mail size={14}/> {household.email || 'N/A'}</span>
                    <span className="flex items-center gap-2 text-xs font-medium"><Phone size={14}/> {household.phone || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${household.funnel_stage === 'Dropped' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                    {household.funnel_stage || "Lead (New)"}
                  </div>
                  <Link href={`/admin/finance/composer?leadId=${household.id}&type=quote`} className="p-3 bg-white/5 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-600 hover:text-white transition-all">
                    <CreditCard size={18}/>
                  </Link>
                  <button onClick={() => openEditor(household)} className="p-3 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all border border-white/5">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => handleDropLead(household.id, household.source)} className="p-3 rounded-xl bg-white/5 text-slate-500 hover:text-rose-500 transition-all border border-white/5">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {/* NESTED CHILDREN VIEW */}
              {household.children && household.children.length > 0 && (
                <div className="mt-8 pl-10 border-l-2 border-white/10 space-y-3 ml-2">
                  {household.children.map((child: any, i: number) => (
                    <div key={child.id || i} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                         <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${child.role === 'Support Crew' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                           {child.role}
                         </span>
                         <p className="text-sm font-black text-white uppercase italic">{child.student_name} {child.student_age && <span className="text-[10px] text-slate-500 normal-case italic ml-2">Age {child.student_age}</span>}</p>
                      </div>
                      <div className="flex gap-2">
                        {child.interested_programs?.map((p: string, i: number) => (
                          <span key={i} className="text-[8px] font-black uppercase tracking-widest bg-white/5 text-slate-400 px-2 py-1 rounded border border-white/10">{formatProgramName(p)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {getDisplayData().length === 0 && (
            <div className="p-16 text-center text-slate-500 font-black uppercase tracking-widest text-xs">
              Pipeline Empty. No leads found.
            </div>
          )}
        </div>
      </div>

      {/* --- BULK EDIT FLOATING ACTION BAR --- */}
      <AnimatePresence>
        {selectedLeads.length > 0 && (
          <motion.div 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} 
            className="fixed bottom-0 left-0 w-full bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 p-6 z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center font-black">
                  {selectedLeads.length}
                </div>
                <div>
                  <h4 className="font-black uppercase italic text-white leading-none">Leads Selected</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready for Bulk Update</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <select 
                   value={bulkStage} 
                   onChange={(e) => setBulkStage(e.target.value)} 
                   className="w-full md:w-auto bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-xs font-bold text-white outline-none focus:border-purple-500 appearance-none"
                >
                  <option value="" disabled>--- Move to Stage ---</option>
                  {LEADS_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button 
                   onClick={handleBulkUpdate} 
                   disabled={!bulkStage || isProcessing} 
                   className="w-full md:w-auto bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <><CheckCircle2 size={16}/> Apply Update</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ADD MANUAL LEAD MODAL --- */}
      <AnimatePresence>
        {showAddLeadModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0f172a] border border-white/10 p-10 rounded-[40px] w-full max-w-2xl shadow-2xl space-y-6 text-left">
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-black uppercase italic text-purple-400 leading-none">Initialize_Lead</h3>
                <button onClick={() => setShowAddLeadModal(false)}><X /></button>
              </div>
              <form onSubmit={handleManualLeadSubmit} className="space-y-4">
                <input required placeholder="Guardian Full Name" value={newLeadForm.name} onChange={e => setNewLeadForm({...newLeadForm, name: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 outline-none focus:border-purple-500 font-bold" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="email" placeholder="Email (Optional if phone provided)" value={newLeadForm.email} onChange={e => setNewLeadForm({...newLeadForm, email: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 outline-none focus:border-purple-500" />
                  <input placeholder="Phone (Optional if email provided)" value={newLeadForm.phone} onChange={e => setNewLeadForm({...newLeadForm, phone: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 outline-none focus:border-purple-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select value={newLeadForm.source} onChange={e => setNewLeadForm({...newLeadForm, source: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 outline-none focus:border-purple-500 font-bold text-slate-400">
                    {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={newLeadForm.interest} onChange={e => setNewLeadForm({...newLeadForm, interest: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 outline-none focus:border-purple-500 font-bold text-slate-400">
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <textarea placeholder="Initial Inquiry Notes..." value={newLeadForm.notes} onChange={e => setNewLeadForm({...newLeadForm, notes: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 outline-none focus:border-purple-500 min-h-[100px] text-sm" />
                <button type="submit" disabled={isProcessing} className="w-full bg-purple-600 p-5 rounded-2xl font-black uppercase italic tracking-widest hover:bg-purple-500 flex justify-center shadow-xl shadow-purple-900/20 disabled:opacity-50">
                  {isProcessing ? <Loader2 className="animate-spin" /> : 'Commit Lead to Record'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* --- CRM HOUSEHOLD EDITOR MODAL --- */}
        {editingHousehold && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-[#020617] overflow-y-auto text-left">
            <form onSubmit={handleSaveHousehold} className="max-w-5xl mx-auto min-h-screen p-6 md:p-12 flex flex-col space-y-10">
              <div className="flex items-center justify-between pb-8 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setEditingHousehold(null)} className="p-3 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"><X size={20} /></button>
                  <h2 className="text-4xl font-black uppercase italic leading-none">Lead_CRM_Node</h2>
                </div>
                <button type="submit" disabled={isProcessing} className="px-8 py-4 bg-blue-600 rounded-2xl text-xs font-black uppercase italic hover:bg-blue-500 transition-all shadow-xl">
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Synchronize CRM
                </button>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><Target size={14}/> Funnel Progression</label>
                    <select value={householdFunnelStage} onChange={(e) => setHouseholdFunnelStage(e.target.value)} className="w-full bg-[#0f172a] border border-white/10 text-white rounded-xl p-4 font-bold text-sm outline-none focus:border-blue-500">
                      {LEADS_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><MessageSquare size={14}/> Internal Admin Dossier</label>
                  <textarea value={editingHousehold.admin_notes || ""} onChange={(e) => setEditingHousehold({...editingHousehold, admin_notes: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl p-6 text-sm text-slate-300 min-h-[200px] outline-none focus:border-blue-500" placeholder="Log interactions..." />
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}