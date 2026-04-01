"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, Mail, Phone, ArrowLeft, ArrowRight,
  Loader2, X, Save, CheckCircle2, ShieldCheck, 
  MessageSquare, Edit3, UserPlus, FileText, ChevronDown, ChevronUp,
  User, ListTree, Target
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// --- GLOBAL FORMATTER FOR PROGRAM NAMES ---
const formatProgramName = (rawName: string) => {
  if (!rawName) return "";
  const lower = rawName.toLowerCase();
  
  const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();

  if (lower.includes('(online)')) return `OL: ${cleanName}`;
  if (lower.includes('in-person') || lower.includes('(plk)')) return `IP: ${cleanName}`;
  
  return rawName;
};

const isNewInStage = (dateString: string) => {
  if (!dateString) return false;
  const diffInHours = (new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60);
  return diffInHours < 24; // Less than 24 hours = "New"
};

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  
  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFunnel, setFilterFunnel] = useState("all"); // Added Funnel Filter
  const [activeProgramTab, setActiveProgramTab] = useState<string>("all");
  
  // Dynamic Tabs State
  const [dynamicTabs, setDynamicTabs] = useState<{id: string, label: string}[]>([{ id: "all", label: "All Programs" }]);
  
  // Controls the full-page editing modal
  const [editingHousehold, setEditingHousehold] = useState<any>(null);
  const [householdFunnelStage, setHouseholdFunnelStage] = useState<string>("Lead (New)");

  const FUNNEL_STAGES = [
     "Lead (New)",
     "Contacted / In Review",
     "Onboarding (Trial LMS)",
     "Active (Paid Client)",
     "Inactive / Dropped"
  ];

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const leadsData = data || [];
      setRequests(leadsData);

      if (leadsData.length > 0) {
        const allPrograms = leadsData.flatMap(lead => lead.interested_programs || []);
        const formattedPrograms = allPrograms.map(prog => formatProgramName(prog as string));
        const uniquePrograms = Array.from(new Set(formattedPrograms)).filter(Boolean);
        
        const tabs = [
          { id: "all", label: "All Programs" },
          ...uniquePrograms.map(prog => ({ id: prog, label: prog }))
        ];
        setDynamicTabs(tabs);
      }

    } catch (err) {
      console.error("Fetch Leads Error:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      req.parent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || req.status === filterStatus;
    const matchesProgram = activeProgramTab === "all" || req.interested_programs?.some((p: string) => formatProgramName(p) === activeProgramTab);
    
    return matchesSearch && matchesStatus && matchesProgram;
  });

  const groupedByGuardian = filteredRequests.reduce((acc: any, req) => {
    const key = req.email;
    if (!acc[key]) {
      acc[key] = {
        parent_name: req.parent_name,
        email: req.email,
        phone: req.phone,
        funnel_stage: req.metadata?.funnel_stage || "Lead (New)", 
        funnel_stage_updated_at: req.metadata?.funnel_stage_updated_at || req.created_at, // Pull timestamp
        children: []
      };
    }
    acc[key].children.push(req);
    return acc;
  }, {});
  
  const guardianList = Object.values(groupedByGuardian).filter((h: any) => {
     if (filterFunnel === "all") return true;
     return h.funnel_stage === filterFunnel;
  });

  // --- FULL PAGE EDITOR LOGIC ---
  const openEditor = (household: any) => {
     setEditingHousehold(JSON.parse(JSON.stringify(household)));
     setHouseholdFunnelStage(household.funnel_stage);
  };

  const handleChildChange = (childId: string, field: string, value: any) => {
    setEditingHousehold((prev: any) => {
      const updatedChildren = prev.children.map((c: any) => 
        c.id === childId ? { ...c, [field]: value } : c
      );
      return { ...prev, children: updatedChildren };
    });
  };

  const handleSaveHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isStageChanged = householdFunnelStage !== editingHousehold.funnel_stage;
      const stageTimestamp = isStageChanged ? new Date().toISOString() : (editingHousehold.funnel_stage_updated_at || new Date().toISOString());

      const updatePromises = editingHousehold.children.map((child: any) => 
        supabase
          .from('registrations')
          .update({
            student_name: child.student_name,
            student_age: child.student_age,
            status: child.status,
            admin_notes: child.admin_notes,
            metadata: {
              ...child.metadata,
              pioneer_username: child.metadata?.pioneer_username || "",
              assigned_teacher: child.metadata?.assigned_teacher || "",
              access_code: child.metadata?.access_code || "",
              funnel_stage: householdFunnelStage, 
              funnel_stage_updated_at: stageTimestamp // Save the new timestamp if manually changed
            },
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          })
          .eq('id', child.id)
      );

      await Promise.all(updatePromises);
      
      setEditingHousehold(null);
      await fetchLeads();
      alert("Success: Household data and funnel updated.");
    } catch (err) {
      console.error("Save Error:", err);
      alert("System Error: Failed to save household data.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Accessing_Lead_Database...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 text-left relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
             <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Mission Control</span>
            </Link>
            <div className="space-y-1">
              <h1 className="text-5xl font-black uppercase italic tracking-tighter text-white">Lead_<span className="text-blue-500">Intake</span></h1>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Tracking {filteredRequests.length} Registered Profiles</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
             <div className="flex flex-wrap gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
               {["all", "new", "needs_info", "approved", "promoted", "archived"].map((s) => (
                 <button key={s} onClick={() => setFilterStatus(s)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>
                   {s.replace('_', ' ')}
                 </button>
               ))}
             </div>
             
             <div className="relative w-full">
               <select 
                 value={filterFunnel} 
                 onChange={e => setFilterFunnel(e.target.value)}
                 className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer shadow-lg"
               >
                 <option value="all">Filter by Funnel Stage: ALL</option>
                 {FUNNEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
               <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
             </div>
          </div>
        </header>

        {/* --- SEARCH BAR & DYNAMIC TABS --- */}
        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-400 transition-colors" size={20} />
            <input 
              type="text"
              placeholder="SCANNING PIONEER LEADS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e293b]/50 border border-white/5 rounded-[32px] py-6 pl-16 pr-8 text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-800 font-black italic uppercase tracking-tighter"
            />
          </div>

          <div className="flex flex-wrap gap-2 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-inner w-full">
            {dynamicTabs.map((tab) => {
              let colorClass = "text-slate-500 hover:text-slate-300 bg-transparent";
              if (activeProgramTab === tab.id) {
                if (tab.id.startsWith("OL:")) {
                  colorClass = "text-blue-400 border border-blue-500/50 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]";
                } else if (tab.id.startsWith("IP:")) {
                  colorClass = "text-purple-400 border border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]";
                } else {
                  colorClass = "text-white border border-white/20 bg-white/10 shadow-lg";
                }
              }
              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveProgramTab(tab.id)} 
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex-grow sm:flex-grow-0 text-center ${colorClass}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* --- GUARDIAN HOUSEHOLD LIST --- */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[48px] overflow-hidden shadow-2xl divide-y divide-white/5">
          {guardianList.map((household: any, idx) => (
            <div key={idx} className="p-8 md:p-10 hover:bg-white/[0.01] transition-colors">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-6">
                <div>
                  <h4 className="text-3xl font-black uppercase italic text-purple-400 leading-none">{household.parent_name}</h4>
                  <div className="flex items-center gap-6 mt-3 text-slate-500">
                    <span className="flex items-center gap-2 text-xs font-medium"><Mail size={14}/> {household.email}</span>
                    <span className="flex items-center gap-2 text-xs font-medium"><Phone size={14}/> {household.phone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end relative">
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Target size={10}/> Funnel Stage</span>
                     <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border relative flex items-center gap-2 ${
                        isNewInStage(household.funnel_stage_updated_at) ? 'shadow-[0_0_15px_rgba(34,197,94,0.15)] ring-1 ring-green-500/30 ' : ''
                     } ${
                        household.funnel_stage.includes('Paid') ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        household.funnel_stage.includes('Trial') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        household.funnel_stage.includes('Inactive') ? 'bg-white/5 text-slate-500 border-white/10' :
                        'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                     }`}>
                        {isNewInStage(household.funnel_stage_updated_at) && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                        )}
                        {household.funnel_stage}
                     </span>
                  </div>
                  <button 
                    onClick={() => openEditor(household)} 
                    className="inline-flex items-center gap-2 px-6 py-3 ml-4 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-[10px] font-black uppercase italic tracking-widest shadow-lg shadow-blue-600/20"
                  >
                    Open CRM <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              
              <div className="pl-6 border-l-2 border-white/10 space-y-4">
                {household.children.map((child: any) => (
                  <div key={child.id} className="flex flex-col lg:flex-row lg:items-center justify-between bg-white/[0.03] p-5 rounded-[24px] border border-white/5 gap-6">
                    <div className="flex items-center gap-5 shrink-0 min-w-[200px]">
                       <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
                          <User size={20} />
                       </div>
                       <div>
                         <p className="text-xl font-black text-white uppercase italic leading-none">{child.student_name}</p>
                         <p className="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">Age: {child.student_age}</p>
                       </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 flex-1">
                      {child.interested_programs?.map((prog: string, i: number) => {
                        const formatted = formatProgramName(prog);
                        const isOnline = formatted.startsWith('OL:');
                        const isInPerson = formatted.startsWith('IP:');
                        return (
                          <span key={i} className={`text-[9px] uppercase font-bold tracking-widest px-4 py-2 rounded-xl border leading-snug whitespace-normal text-left ${
                            isOnline ? 'bg-blue-500/5 text-blue-400 border-blue-500/20' : 
                            isInPerson ? 'bg-purple-500/5 text-purple-400 border-purple-500/20' : 
                            'bg-black/40 text-slate-400 border-white/5'
                          }`}>
                            {formatted}
                          </span>
                        );
                      })}
                    </div>

                    <div className="shrink-0 lg:text-right">
                       <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-xl border inline-block ${
                         child.status === 'new' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                         child.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                         child.status === 'promoted' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                         child.status === 'archived' ? 'bg-white/5 text-slate-500 border-white/10' :
                         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                       }`}>
                         {child.status.replace('_', ' ')}
                       </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ))}
          
          {guardianList.length === 0 && (
            <div className="py-24 text-center space-y-4">
              <ShieldCheck className="mx-auto text-slate-700" size={48} />
              <p className="text-slate-500 italic uppercase font-black text-xs tracking-[0.3em]">No_Households_Found</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editingHousehold && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#020617] overflow-y-auto"
          >
            <form onSubmit={handleSaveHousehold} className="max-w-5xl mx-auto min-h-screen p-6 md:p-12 flex flex-col">
              
              <div className="flex items-center justify-between pb-8 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setEditingHousehold(null)} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">Household_Editor</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 mt-2">Editing Guardian: {editingHousehold.parent_name}</p>
                  </div>
                </div>
                
                <button 
                  type="submit" disabled={isProcessing}
                  className="flex items-center gap-2 px-8 py-4 bg-blue-600 rounded-2xl text-xs font-black uppercase italic hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Save All Changes
                </button>
              </div>

              <div className="flex-1 py-10 space-y-12">
                <div className="bg-purple-500/5 border border-purple-500/20 p-8 rounded-[32px]">
                   <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center justify-between">
                     <div className="flex items-center gap-2"><ListTree size={16}/> Guardian Contact Info</div>
                     
                     {/* ADDED FUNNEL TRACKER HERE */}
                     <div className="flex items-center gap-3">
                        <Target size={16}/>
                        <select 
                           value={householdFunnelStage} 
                           onChange={(e) => setHouseholdFunnelStage(e.target.value)}
                           className="bg-[#0f172a] border border-purple-500/30 text-white rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-purple-500 transition-colors"
                        >
                           {FUNNEL_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                        </select>
                     </div>
                   </h3>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
                        <p className="text-white font-bold">{editingHousehold.parent_name}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                        <p className="text-slate-300 font-medium">{editingHousehold.email}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Phone Number</label>
                        <p className="text-slate-300 font-medium">{editingHousehold.phone}</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-xl font-black uppercase italic text-white flex items-center gap-3">
                    <User size={24} className="text-blue-500"/> Pioneer Profiles ({editingHousehold.children.length})
                  </h3>
                  
                  {editingHousehold.children.map((child: any, index: number) => (
                    <div key={child.id} className="bg-white/[0.02] border border-white/10 rounded-[40px] p-8 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                         <div className="md:col-span-5 space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Pioneer Name</label>
                            <input 
                              type="text" value={child.student_name}
                              onChange={(e) => handleChildChange(child.id, 'student_name', e.target.value)}
                              className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic text-lg outline-none focus:border-blue-500"
                            />
                         </div>
                         <div className="md:col-span-3 space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Age</label>
                            <input 
                              type="number" value={child.student_age}
                              onChange={(e) => handleChildChange(child.id, 'student_age', parseInt(e.target.value))}
                              className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-black italic text-lg outline-none focus:border-blue-500"
                            />
                         </div>
                         <div className="md:col-span-4 space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Workflow Status</label>
                            <select 
                              value={child.status}
                              onChange={(e) => handleChildChange(child.id, 'status', e.target.value)}
                              className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-black uppercase tracking-widest text-xs outline-none focus:border-blue-500 appearance-none cursor-pointer"
                            >
                              <option value="new">NEW INTAKE</option>
                              <option value="needs_info">NEEDS INFO</option>
                              <option value="approved">APPROVED / LINKED</option>
                              <option value="promoted">PROMOTED TO LMS</option>
                              <option value="archived">ARCHIVED</option>
                            </select>
                         </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Requested Programs</label>
                         <div className="flex flex-wrap gap-2">
                            {child.interested_programs?.map((prog: string, i: number) => {
                               const formatted = formatProgramName(prog);
                               const isOnline = formatted.startsWith('OL:');
                               const isInPerson = formatted.startsWith('IP:');
                               return (
                                 <span key={i} className={`text-[10px] font-black text-white uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
                                   isOnline ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                   isInPerson ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                   'bg-black/40 text-white border-white/10'
                                 }`}>
                                   {formatted}
                                 </span>
                               );
                            })}
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/10">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Assigned Teacher</label>
                            <input 
                              type="text" placeholder="e.g. Mr. Smith" 
                              value={child.metadata?.assigned_teacher || ""}
                              onChange={(e) => handleChildChange(child.id, 'metadata', { ...child.metadata, assigned_teacher: e.target.value })}
                              className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-blue-500"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Pioneer Username</label>
                            <input 
                              type="text" placeholder="e.g. pioneer_john" 
                              value={child.metadata?.pioneer_username || ""}
                              onChange={(e) => handleChildChange(child.id, 'metadata', { ...child.metadata, pioneer_username: e.target.value })}
                              className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-blue-500"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Portal Access Code</label>
                            <input 
                              type="text" placeholder="e.g. RAD-2026-X" 
                              value={child.metadata?.access_code || ""}
                              onChange={(e) => handleChildChange(child.id, 'metadata', { ...child.metadata, access_code: e.target.value })}
                              className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-blue-500 font-mono tracking-widest"
                            />
                         </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                          <MessageSquare size={12}/> Internal Admin Notes
                        </label>
                        <textarea 
                          placeholder="Enter internal notes, special requirements, or audit logs here..."
                          value={child.admin_notes || ""}
                          onChange={(e) => handleChildChange(child.id, 'admin_notes', e.target.value)}
                          className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 text-sm text-slate-300 focus:outline-none focus:border-blue-500 min-h-[100px] resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}