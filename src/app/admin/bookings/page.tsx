"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Phone, CalendarClock, CheckCircle2, 
  XCircle, Inbox, User, MessageSquare, Clock, Link2, Search
} from "lucide-react";

export default function BookingsAdminPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'history'>('pending');

  // Linking UI State
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLinkingTarget, setIsLinkingTarget] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    
    // 1. Fetch Bookings
    const { data: bookings } = await supabase
      .from('pending_bookings')
      .select('*')
      .order('requested_time', { ascending: true });
    
    // 2. Fetch Registrations
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, parent_name, email, phone, metadata');
      
    // 3. Fetch Prospects
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id, name, email, phone, metadata');

    // Combine leads for the searchable dropdown
    const combinedLeads = [
      ...(regs || []).map(r => ({ ...r, dbTable: 'registrations', displayName: r.parent_name })),
      ...(prospects || []).map(p => ({ ...p, dbTable: 'prospects', displayName: p.name }))
    ];

    setRequests(bookings || []);
    setAvailableLeads(combinedLeads);
    setLoading(false);
  }

  const handleUpdate = async (id: string, status: 'approved' | 'rejected') => {
    setRequests(prev => prev.map(req => req.id === id ? { ...req, status } : req));
    await supabase.from('pending_bookings').update({ status }).eq('id', id);
  };

  const handleLinkLead = async (bookingId: string, lead: any) => {
    setIsLinkingTarget(true);
    try {
      const booking = requests.find(r => r.id === bookingId);
      if (!booking) return;

      // 1. Create a system note with the CRM details instead of overwriting
      const existingNotes = booking.notes ? `${booking.notes}\n\n` : '';
      const appendedNotes = `${existingNotes}[LINKED CRM RECORD]: Name: ${lead.displayName} | Phone: ${lead.phone || 'N/A'} | Email: ${lead.email || 'N/A'}`;

      // 2. Update the Booking to include this new note
      const { error: bookingErr } = await supabase.from('pending_bookings').update({
        notes: appendedNotes
      }).eq('id', bookingId);
      if (bookingErr) throw bookingErr;

      // 3. Update the Lead's Metadata with the Meeting Details
      const updatedMetadata = {
        ...(lead.metadata || {}),
        intro_call_status: 'booked',
        intro_call_time: booking.requested_time,
        intro_call_notes: booking.notes // We just pass their original booking notes to the CRM
      };

      const { error: leadErr } = await supabase.from(lead.dbTable).update({
        metadata: updatedMetadata
      }).eq('id', lead.id);
      if (leadErr) throw leadErr;

      // 4. Update Local UI State (Updating the notes, keeping original name/number)
      setRequests(prev => prev.map(req => 
        req.id === bookingId 
          ? { ...req, notes: appendedNotes } 
          : req
      ));
      
      alert(`Success! Linked to ${lead.displayName}. Original booking details preserved.`);
    } catch (error) {
      console.error("Linking failed:", error);
      alert("Failed to link lead. See console for details.");
    } finally {
      setIsLinkingTarget(false);
      setLinkingId(null);
      setSearchQuery("");
    }
  };

  // --- Dynamic Lifecycle Sorting Logic ---
  const nowMs = Date.now();
  const pendingReqs = requests.filter(r => r.status === 'pending');
  const upcomingReqs = requests.filter(r => r.status === 'approved' && new Date(r.requested_time).getTime() >= nowMs);
  const historyReqs = requests.filter(r => r.status === 'rejected' || (r.status === 'approved' && new Date(r.requested_time).getTime() < nowMs));

  const activeRequests = activeTab === 'pending' ? pendingReqs : activeTab === 'upcoming' ? upcomingReqs : historyReqs;

  const filteredLeads = availableLeads.filter(l => 
    l.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Calendar Banner Logic (Next 14 Days) ---
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const getRequestsForDay = (date: Date) => {
    return activeRequests.filter(req => {
      const reqDate = new Date(req.requested_time);
      return reqDate.getFullYear() === date.getFullYear() &&
             reqDate.getMonth() === date.getMonth() &&
             reqDate.getDate() === date.getDate();
    });
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto">
        
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <CalendarClock className="text-blue-500" size={32} /> Lead Inbox
            </h1>
            <p className="text-slate-400 mt-2">Manage incoming "Getting Started" intro calls.</p>
          </div>
          
          <div className="w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
            <div className="flex bg-[#0f172a] p-1.5 rounded-xl border border-white/5 shadow-inner min-w-max">
              <button onClick={() => setActiveTab('pending')} className={`px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'pending' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}>Pending ({pendingReqs.length})</button>
              <button onClick={() => setActiveTab('upcoming')} className={`px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'upcoming' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:text-slate-300'}`}>Upcoming ({upcomingReqs.length})</button>
              <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'history' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>History ({historyReqs.length})</button>
            </div>
          </div>
        </div>

        {/* --- CALENDAR HEADER BANNER (Hidden on History Tab) --- */}
        <AnimatePresence>
          {activeTab !== 'history' && !loading && (
            <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: 40 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar pb-4 snap-x">
                <div className="flex gap-3 min-w-max">
                  {calendarDays.map((date) => {
                    const dayReqs = getRequestsForDay(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    
                    return (
                      <div key={date.toISOString()} className={`w-48 bg-[#0f172a]/50 rounded-2xl border flex flex-col overflow-hidden shrink-0 snap-start ${isToday ? 'border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]' : 'border-white/5'}`}>
                        <div className={`p-3 text-center border-b border-white/5 ${isToday ? 'bg-white/10' : 'bg-black/40'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>{isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                          <p className="text-sm font-bold text-white mt-0.5">{date.getDate()} {date.toLocaleDateString('en-US', { month: 'short' })}</p>
                        </div>
                        <div className="p-2 space-y-2 flex-1 min-h-[120px] max-h-[250px] overflow-y-auto custom-scrollbar">
                          {dayReqs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 py-6"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No Calls</span></div>
                          ) : (
                            dayReqs.map(req => (
                              <div key={req.id} className={`p-3 rounded-xl border text-left shadow-sm ${req.status === 'pending' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${req.status === 'pending' ? 'text-blue-400' : 'text-emerald-400'}`}><Clock size={10} />{new Date(req.requested_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="text-xs font-bold text-white truncate mb-1">{req.parent_name}</p>
                                <p className="text-[9px] text-slate-300 truncate flex items-center gap-1.5"><Phone size={10}/> {req.whatsapp_number}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- DETAILED LIST VIEW --- */}
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Inbox size={16} /> Detailed View & Actions</h2>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-12 h-12" /></div>
        ) : activeRequests.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 bg-[#0f172a]/50 border border-white/5 rounded-[32px]">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={24} className="text-slate-600" /></div>
            <h3 className="text-lg font-black text-slate-300 uppercase tracking-widest">All Clear</h3>
            <p className="text-slate-500 mt-1 text-xs">No {activeTab} bookings to review.</p>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {activeRequests.map(req => {
                const reqDate = new Date(req.requested_time);
                const isLinking = linkingId === req.id;

                return (
                  <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} key={req.id} className={`flex flex-col p-6 rounded-[24px] border backdrop-blur-md transition-all ${activeTab === 'pending' ? 'bg-[#0f172a]/80 border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:border-blue-500/40' : 'bg-white/[0.02] border-white/5 opacity-70'}`}>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full">
                      {/* Left: Info */}
                      <div className="flex gap-5 w-full md:w-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0"><User size={18} className="text-slate-400" /></div>
                        <div className="space-y-1 min-w-0">
                          <h3 className="text-xl font-black text-white flex items-center flex-wrap gap-3">
                            <span className="truncate">{req.parent_name}</span>
                            {req.status === 'approved' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest shrink-0">Approved</span>}
                            {req.status === 'rejected' && <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest shrink-0">Dismissed</span>}
                          </h3>
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-1.5 text-slate-300"><Phone size={14} className="text-slate-500 shrink-0"/> {req.whatsapp_number}</span>
                            <span className="flex items-center gap-1.5 text-blue-300"><Clock size={14} className="text-blue-500 shrink-0"/> {reqDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric'})} @ {reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {req.notes && (() => {
                            const hasLinkedData = req.notes.includes('[LINKED CRM RECORD]:');
                            const splitNotes = req.notes.split('[LINKED CRM RECORD]:');
                            const originalNote = splitNotes[0]?.trim();
                            const linkedRaw = splitNotes[1]?.trim();
                            
                            const linkedDetails = linkedRaw ? linkedRaw.split(' | ').map((s: string) => s.trim()) : [];

                            return (
                              <div className="mt-3 flex flex-col gap-2 max-w-xl">
                                {/* 1. Original Parent Note */}
                                {originalNote && (
                                  <div className="flex items-start gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
                                    <MessageSquare size={14} className="text-slate-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-400 leading-relaxed italic break-words">{originalNote}</p>
                                  </div>
                                )}

                                {/* 2. Beautifully Formatted CRM Data */}
                                {hasLinkedData && linkedRaw && (
                                  <div className="flex flex-col bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                      <Link2 size={12} className="text-blue-400" />
                                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Linked CRM Record</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {linkedDetails.map((detail: string, idx: number) => {
                                        const [key, ...valArr] = detail.split(': ');
                                        const value = valArr.join(': ');
                                        return (
                                          <div key={idx} className="bg-[#0f172a] border border-blue-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">{key}:</span>
                                            <span className="text-[10px] font-black text-blue-100">{value}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap gap-2 mt-6 md:mt-0 w-full md:w-auto shrink-0 justify-end">
                        <button onClick={() => setLinkingId(isLinking ? null : req.id)} className={`px-4 py-3 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border ${isLinking ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'}`}>
                          <Link2 size={16}/> {isLinking ? 'Cancel Link' : 'Link Lead'}
                        </button>
                        {activeTab === 'pending' && (
                          <>
                            <button onClick={() => handleUpdate(req.id, 'rejected')} className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><XCircle size={16}/> Dismiss</button>
                            <button onClick={() => handleUpdate(req.id, 'approved')} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Approve</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expandable Linking Dropdown UI */}
                    <AnimatePresence>
                      {isLinking && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden w-full mt-4">
                          <div className="pt-4 border-t border-white/10">
                            <div className="relative mb-4">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                              <input autoFocus type="text" placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500" />
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                              {filteredLeads.length === 0 ? (
                                <div className="text-center py-6 text-sm text-slate-500 font-bold">No leads found.</div>
                              ) : (
                                filteredLeads.map(lead => (
                                  <button key={lead.id} onClick={() => handleLinkLead(req.id, lead)} disabled={isLinkingTarget} className="w-full text-left p-4 bg-white/5 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/30 rounded-xl transition-colors flex items-center justify-between group disabled:opacity-50">
                                    <div>
                                      <p className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">{lead.displayName}</p>
                                      <p className="text-xs text-slate-400 mt-0.5">{lead.email || 'No email'} • {lead.phone || 'No phone'}</p>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${lead.dbTable === 'registrations' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>{lead.dbTable === 'registrations' ? 'Registration' : 'Prospect'}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}