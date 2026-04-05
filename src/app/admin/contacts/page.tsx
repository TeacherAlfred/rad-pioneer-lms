"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, Mail, Phone, ArrowLeft, Loader2, X, Save, 
  User, ShieldAlert, Globe, Tag, Database, Activity, Archive, PowerOff, Info, CornerDownRight 
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function MasterContactsPage() {
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  
  // FILTER STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "lead" | "active" | "inactive" | "dropped">("all");
  
  // WORKSPACE STATES
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => { 
    fetchData(); 
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // God Mode: Fetch EVERYONE in the profiles table regardless of status
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setLoading(false); 
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editForm.display_name,
          status: editForm.status,
          funnel_stage: editForm.funnel_stage,
          metadata: { 
            ...editingProfile.metadata, 
            email: editForm.email, 
            phone: editForm.phone,
            admin_notes: editForm.admin_notes 
          }
        })
        .eq('id', editingProfile.id);

      if (error) throw error;
      
      setEditingProfile(null);
      fetchData();
      alert("Master record updated successfully.");
    } catch (err: any) { 
      alert("Update failed: " + err.message); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  // --- HOUSEHOLD GROUPING & FILTERING LOGIC ---
  const getFilteredData = () => {
    const familyMap = new Map();
    const orphans: any[] = [];

    // 1. Identify Top-Level Parents (Lead Guardians & Admins)
    profiles.forEach(p => {
      if ((p.role === 'guardian' && !p.metadata?.household_lead_id) || p.role === 'admin') {
        familyMap.set(p.id, { ...p, children: [] });
      }
    });

    // 2. Attach Children (Pioneers & Support Crew) to their Parents
    profiles.forEach(p => {
      if (p.role === 'student') {
        if (p.linked_parent_id && familyMap.has(p.linked_parent_id)) {
          familyMap.get(p.linked_parent_id).children.push(p);
        } else {
          orphans.push({ ...p, children: [] });
        }
      } else if (p.role === 'guardian' && p.metadata?.household_lead_id) {
        if (familyMap.has(p.metadata.household_lead_id)) {
          familyMap.get(p.metadata.household_lead_id).children.push(p);
        } else {
          orphans.push({ ...p, children: [] });
        }
      }
    });

    const allTopLevel = [...Array.from(familyMap.values()), ...orphans];

    // 3. Apply Filters
    return allTopLevel.filter(parent => {
      const pName = (parent.display_name || "").toLowerCase();
      const pEmail = (parent.metadata?.email || parent.email || "").toLowerCase();
      
      const parentMatchesSearch = pName.includes(searchQuery.toLowerCase()) || pEmail.includes(searchQuery.toLowerCase());
      
      const childMatchesSearch = parent.children.some((c: any) => {
         const cName = (c.display_name || "").toLowerCase();
         const cEmail = (c.metadata?.email || c.email || "").toLowerCase();
         return cName.includes(searchQuery.toLowerCase()) || cEmail.includes(searchQuery.toLowerCase());
      });

      const searchMatch = parentMatchesSearch || childMatchesSearch;
      const statusMatch = statusFilter === "all" || parent.status === statusFilter;

      return searchMatch && statusMatch;
    });
  };

  const openEditor = (item: any) => {
    setEditingProfile(item);
    setEditForm({
      display_name: item.display_name,
      status: item.status || 'lead',
      funnel_stage: item.funnel_stage || 'Lead (New)',
      email: item.metadata?.email || item.email || '',
      phone: item.metadata?.phone || item.phone || '',
      admin_notes: item.metadata?.admin_notes || ''
    });
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 text-left relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
             <Link href="/admin/dashboard" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={14} /> Mission Control
            </Link>
            <div className="flex items-center gap-3 text-rose-500">
               <Database size={18} />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Global_Data_Core</span>
            </div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter">Master_<span className="text-rose-500">Contacts</span></h1>
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shrink-0">
             {(['all', 'lead', 'active', 'inactive', 'dropped'] as const).map((s) => (
                <button 
                  key={s}
                  onClick={() => setStatusFilter(s)} 
                  className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                    statusFilter === s ? "bg-rose-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                  }`}
                >
                  {s}
                </button>
             ))}
          </div>
        </header>

        {/* --- SEARCH --- */}
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" size={20} />
          <input 
            placeholder="SCANNING ENTIRE DATABASE..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e293b]/50 border border-white/5 rounded-[32px] py-6 pl-16 pr-8 text-white focus:outline-none focus:border-rose-500/50 transition-all font-black italic uppercase tracking-tighter"
          />
        </div>

        {/* --- MAIN LIST --- */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[48px] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
              <tr>
                <th className="px-8 py-5">Entity Name</th>
                <th className="px-8 py-5">Contact Details</th>
                <th className="px-8 py-5">System Status</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredData().map((profile: any) => (
                <React.Fragment key={profile.id}>
                  {/* --- LEAD GUARDIAN / TOP-LEVEL ROW --- */}
                  <tr className="hover:bg-white/[0.02] transition-colors group border-b border-white/5 bg-white/[0.01]">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                            {profile.role === 'admin' ? <ShieldAlert size={14}/> : <Globe size={14}/>}
                         </div>
                         <div>
                           <p className="font-bold text-white text-sm">{profile.display_name}</p>
                           <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest flex items-center gap-2">
                              Role: {profile.role === 'guardian' ? 'Lead Guardian' : profile.role}
                           </p>
                         </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs text-slate-300 space-y-1">
                      {profile.metadata?.email && <p className="flex items-center gap-2"><Mail size={12} className="text-slate-500"/> {profile.metadata.email}</p>}
                      {profile.metadata?.phone && <p className="flex items-center gap-2"><Phone size={12} className="text-slate-500"/> {profile.metadata.phone}</p>}
                      {!profile.metadata?.email && !profile.metadata?.phone && <span className="italic opacity-50">No contact data</span>}
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${
                        profile.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        profile.status === 'lead' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        profile.status === 'dropped' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {profile.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button onClick={() => openEditor(profile)} className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white transition-all border border-white/10">
                        Override
                      </button>
                    </td>
                  </tr>

                  {/* --- NESTED CHILDREN ROWS --- */}
                  {profile.children?.map((child: any) => (
                    <tr key={child.id} className="hover:bg-white/[0.03] transition-colors border-b border-white/5 bg-transparent">
                      <td className="px-8 py-4 pl-14">
                        <div className="flex items-center gap-3">
                           <CornerDownRight size={14} className="text-slate-600 shrink-0"/>
                           <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-400 shrink-0">
                              {child.role === 'student' ? <User size={12}/> : <Globe size={12}/>}
                           </div>
                           <div>
                             <p className="font-bold text-slate-300 text-xs">{child.display_name}</p>
                             <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5 tracking-widest">
                                Role: {child.role === 'student' ? 'Pioneer' : 'Support Crew'}
                             </p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-[11px] text-slate-400 space-y-1">
                        {child.metadata?.email && <p className="flex items-center gap-2"><Mail size={10} className="text-slate-600"/> {child.metadata.email}</p>}
                        {child.metadata?.phone && <p className="flex items-center gap-2"><Phone size={10} className="text-slate-600"/> {child.metadata.phone}</p>}
                        {!child.metadata?.email && !child.metadata?.phone && <span className="text-[10px] italic text-slate-600">Uses Lead Contact</span>}
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic">
                          Linked to Lead
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => openEditor(child)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-300 transition-all border border-white/10">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {getFilteredData().length === 0 && (
                <tr>
                  <td colSpan={4} className="p-16 text-center text-slate-500 font-black uppercase tracking-widest text-xs">
                    No records found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MASTER OVERRIDE MODAL --- */}
      <AnimatePresence>
        {editingProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-[#020617] overflow-y-auto text-left">
            <form onSubmit={handleSaveProfile} className="max-w-3xl mx-auto min-h-screen p-6 md:p-12 flex flex-col space-y-10">
              <div className="flex items-center justify-between pb-8 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setEditingProfile(null)} className="p-3 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"><X size={20} /></button>
                  <div>
                    <h2 className="text-4xl font-black uppercase italic leading-none text-rose-500">Master_Override</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">ID: {editingProfile.id}</p>
                  </div>
                </div>
                <button type="submit" disabled={isProcessing} className="px-8 py-4 bg-rose-600 rounded-2xl text-xs font-black uppercase italic hover:bg-rose-500 transition-all shadow-xl shadow-rose-900/20 disabled:opacity-50">
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} className="inline mr-2"/> Force Update</>}
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-8">
                
                {/* CONDITIONAL ROUTING BLOCK: ONLY VISIBLE TO LEAD GUARDIANS */}
                {editingProfile.role === 'guardian' && !editingProfile.metadata?.household_lead_id && (
                  <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                     <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-2 mb-2"><ShieldAlert size={14}/> System Routing Control</h4>
                     <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                       Changing the <strong>System Status</strong> dictates where this household appears in your CRM. <br/>
                       • <strong>Lead / Dropped</strong> = Appears in Leads Pipeline.<br/>
                       • <strong>Active / Inactive</strong> = Appears in Active Directory.
                     </p>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 ml-1">System Status (Routing)</label>
                          <select 
                            value={editForm.status} 
                            onChange={(e) => {
                              setEditForm({...editForm, status: e.target.value, funnel_stage: ""});
                            }} 
                            className="w-full bg-[#0f172a] border border-amber-500/30 rounded-xl p-4 font-bold text-sm outline-none focus:border-amber-500 text-amber-400"
                          >
                            <option value="lead">Lead (Pipeline)</option>
                            <option value="dropped">Dropped (Pipeline)</option>
                            <option value="active">Active (Directory)</option>
                            <option value="inactive">Inactive (Directory)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Funnel Tag</label>
                          <select 
                            value={editForm.funnel_stage} 
                            onChange={e => setEditForm({...editForm, funnel_stage: e.target.value})} 
                            className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-rose-500"
                          >
                            <option value="" disabled>--- Select Funnel Stage ---</option>
                            {(editForm.status === 'lead' || editForm.status === 'dropped') && (
                              <>
                                <option value="Lead (New)">Lead (New)</option>
                                <option value="Contacted / In Review">Contacted / In Review</option>
                                <option value="Onboarding (Trial LMS)">Onboarding (Trial LMS)</option>
                                <option value="Dropped">Dropped</option>
                              </>
                            )}
                            {(editForm.status === 'active' || editForm.status === 'inactive') && (
                              <>
                                <option value="Active (Paid Client)">Active (Paid Client)</option>
                                <option value="Past / Inactive">Past / Inactive</option>
                              </>
                            )}
                          </select>
                        </div>
                     </div>
                  </div>
                )}

                {/* IF NOT A LEAD GUARDIAN, SHOW WHY ROUTING IS HIDDEN */}
                {(editingProfile.role === 'student' || editingProfile.metadata?.household_lead_id) && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
                    <Info className="text-slate-500 shrink-0" size={16}/>
                    <p className="text-xs text-slate-400">
                      System routing is disabled for Pioneers and Support Crew. Only the <strong className="text-rose-400">Lead Guardian</strong> can be routed between pipelines.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Display Name</label>
                    <input required value={editForm.display_name} onChange={e => setEditForm({...editForm, display_name: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-rose-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Email</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-rose-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Phone</label>
                    <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-rose-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Master Notes</label>
                  <textarea value={editForm.admin_notes} onChange={e => setEditForm({...editForm, admin_notes: e.target.value})} className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-rose-500 min-h-[150px]" />
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}