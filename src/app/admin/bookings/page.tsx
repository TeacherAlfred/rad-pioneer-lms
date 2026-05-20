"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Phone, CalendarClock, CheckCircle2, 
  XCircle, Inbox, User, MessageSquare, Clock
} from "lucide-react";

export default function BookingsAdminPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'history'>('pending');

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    const { data } = await supabase
      .from('pending_bookings')
      .select('*')
      .order('requested_time', { ascending: true });
    setRequests(data || []);
    setLoading(false);
  }

  const handleUpdate = async (id: string, status: 'approved' | 'rejected') => {
    // Optimistically update UI for immediate feedback
    setRequests(prev => prev.map(req => req.id === id ? { ...req, status } : req));
    
    // Background DB update
    await supabase.from('pending_bookings').update({ status }).eq('id', id);
  };

  // --- Dynamic Lifecycle Sorting Logic ---
  const nowMs = Date.now();
  
  const pendingReqs = requests.filter(r => r.status === 'pending');
  const upcomingReqs = requests.filter(r => r.status === 'approved' && new Date(r.requested_time).getTime() >= nowMs);
  const historyReqs = requests.filter(r => r.status === 'rejected' || (r.status === 'approved' && new Date(r.requested_time).getTime() < nowMs));

  const activeRequests = 
    activeTab === 'pending' ? pendingReqs : 
    activeTab === 'upcoming' ? upcomingReqs : 
    historyReqs;

  // --- Calendar Banner Logic (Next 14 Days) ---
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Generate a 14-day rolling window
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
          
          {/* Scrollable container for mobile to prevent tab squishing */}
          <div className="w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
            <div className="flex bg-[#0f172a] p-1.5 rounded-xl border border-white/5 shadow-inner min-w-max">
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'pending' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Pending ({pendingReqs.length})
              </button>
              <button 
                onClick={() => setActiveTab('upcoming')}
                className={`px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'upcoming' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Upcoming ({upcomingReqs.length})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'history' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                History ({historyReqs.length})
              </button>
            </div>
          </div>
        </div>

        {/* --- CALENDAR HEADER BANNER (Hidden on History Tab) --- */}
        <AnimatePresence>
          {activeTab !== 'history' && !loading && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
              animate={{ opacity: 1, height: 'auto', marginBottom: 40 }} 
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="overflow-x-auto custom-scrollbar pb-4 snap-x">
                <div className="flex gap-3 min-w-max">
                  {calendarDays.map((date) => {
                    const dayReqs = getRequestsForDay(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    
                    return (
                      <div key={date.toISOString()} className={`w-48 bg-[#0f172a]/50 rounded-2xl border flex flex-col overflow-hidden shrink-0 snap-start ${isToday ? 'border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]' : 'border-white/5'}`}>
                        {/* Column Header */}
                        <div className={`p-3 text-center border-b border-white/5 ${isToday ? 'bg-white/10' : 'bg-black/40'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                            {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </p>
                          <p className="text-sm font-bold text-white mt-0.5">
                            {date.getDate()} {date.toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                        </div>
                        
                        {/* Column Slots */}
                        <div className="p-2 space-y-2 flex-1 min-h-[120px] max-h-[250px] overflow-y-auto custom-scrollbar">
                          {dayReqs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 py-6">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No Calls</span>
                            </div>
                          ) : (
                            dayReqs.map(req => (
                              <div 
                                key={req.id} 
                                className={`p-3 rounded-xl border text-left shadow-sm ${req.status === 'pending' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}
                              >
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${req.status === 'pending' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                  <Clock size={10} />
                                  {new Date(req.requested_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-xs font-bold text-white truncate mb-1">{req.parent_name}</p>
                                <p className="text-[9px] text-slate-300 truncate flex items-center gap-1.5">
                                  <Phone size={10}/> {req.whatsapp_number}
                                </p>
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
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
          <Inbox size={16} /> Detailed View & Actions
        </h2>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-12 h-12" /></div>
        ) : activeRequests.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 bg-[#0f172a]/50 border border-white/5 rounded-[32px]">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-slate-600" />
            </div>
            <h3 className="text-lg font-black text-slate-300 uppercase tracking-widest">All Clear</h3>
            <p className="text-slate-500 mt-1 text-xs">No {activeTab} bookings to review.</p>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {activeRequests.map(req => {
                const reqDate = new Date(req.requested_time);
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    key={req.id} 
                    className={`flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-[24px] border backdrop-blur-md transition-all ${activeTab === 'pending' ? 'bg-[#0f172a]/80 border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:border-blue-500/40' : 'bg-white/[0.02] border-white/5 opacity-70'}`}
                  >
                    
                    {/* Left: Info */}
                    <div className="flex gap-5 w-full md:w-auto">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                        <User size={18} className="text-slate-400" />
                      </div>
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
                        {req.notes && (
                          <div className="mt-3 flex items-start gap-2 bg-black/40 p-3 rounded-xl border border-white/5 max-w-xl">
                            <MessageSquare size={14} className="text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-400 leading-relaxed italic break-words">{req.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions (Only shown in Pending) */}
                    {activeTab === 'pending' && (
                      <div className="flex gap-2 mt-6 md:mt-0 w-full md:w-auto shrink-0">
                        <button 
                          onClick={() => handleUpdate(req.id, 'rejected')} 
                          className="flex-1 md:flex-none p-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                        >
                          <XCircle size={16}/> Dismiss
                        </button>
                        <button 
                          onClick={() => handleUpdate(req.id, 'approved')} 
                          className="flex-1 md:flex-none p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:-translate-y-0.5"
                        >
                          <CheckCircle2 size={16}/> Approve
                        </button>
                      </div>
                    )}
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