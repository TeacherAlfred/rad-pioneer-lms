"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  CalendarDays, Users, DollarSign, MessageCircle, FileImage, 
  ArrowLeft, Plus, MapPin, Clock, TrendingUp, Search, X, Edit3,
  Send, Upload, Receipt, ArrowUpRight, CheckCircle2, Shield, Loader2
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function EventsHub() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'comms' | 'assets' | 'roi'>('overview');
  
  // States for interactive modules
  const [whatsappBody, setWhatsappBody] = useState("Hi [Name],\n\nJust a quick reminder about the upcoming event!\n\nPlease make sure to arrive 15 minutes early.\n\nSee you there,\nRAD Academy");
  const [newCostDesc, setNewCostDesc] = useState("");
  const [newCostAmt, setNewCostAmt] = useState("");

  // Fetch events from Supabase on load
  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
      
      if (error) {
        console.error("Error fetching events:", error);
      }
      
      if (data) {
        // Map the DB columns to our UI structure, adding empty arrays for attendees/finances for now
        const formattedEvents = data.map(evt => ({
          ...evt,
          date: evt.event_date,
          time: `${evt.start_time?.slice(0,5)} - ${evt.end_time?.slice(0,5)}`,
          venue: evt.location_details,
          attendees: [], // We will wire up the attendees table next
          finances: { revenue: 0, costs: [] },
          assets: []
        }));
        setEvents(formattedEvents);
      }
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const totalCosts = activeEvent?.finances.costs.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
  const netRoi = (activeEvent?.finances.revenue || 0) - totalCosts;
  const margin = activeEvent?.finances.revenue > 0 ? (netRoi / activeEvent.finances.revenue) * 100 : 0;

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-yellow-500" size={40} />
        <p className="text-yellow-400 font-black uppercase tracking-widest text-[10px]">Loading_Event_Matrix...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-yellow-500/30">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-yellow-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-500">
                <CalendarDays size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Experiential_Marketing</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Events_<span className="text-yellow-500">Hub</span>
              </h1>
            </div>
          </div>
          <Link href="/admin/events/create" className="px-6 py-4 bg-yellow-600 hover:bg-yellow-500 text-[#020617] rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-900/20 flex items-center gap-2">
            <Plus size={16}/> Create New Event
          </Link>
        </header>

        {/* MAIN VIEW: LIST vs DETAIL */}
        <AnimatePresence mode="wait">
          {!activeEvent ? (
            /* --- DASHBOARD LIST VIEW --- */
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {events.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center border border-white/5 bg-white/[0.02] rounded-[32px] text-center">
                  <CalendarDays size={48} className="text-slate-600 mb-4" />
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight">No Events Found</h3>
                  <p className="text-slate-400 text-sm mt-2">Click "Create New Event" to schedule your first Bootcamp or Workshop.</p>
                </div>
              )}

              {events.map(evt => (
                <div 
                  key={evt.id} 
                  onClick={() => setActiveEvent(evt)}
                  className="bg-white/5 border border-white/10 hover:border-yellow-500/50 rounded-[32px] p-8 cursor-pointer group transition-all relative overflow-hidden"
                >
                  <CalendarDays className="absolute -right-4 -bottom-4 size-32 text-yellow-500/5 group-hover:text-yellow-500/10 group-hover:rotate-12 transition-all" />
                  
                  <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest">
                        {evt.status}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{evt.attendees.length} / {evt.capacity} Pax</span>
                    </div>
                    
                    <div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tight leading-tight line-clamp-2">{evt.title}</h3>
                      <div className="space-y-2 mt-4">
                        <p className="text-xs text-slate-400 flex items-center gap-2 font-medium"><CalendarDays size={14} className="text-slate-500"/> {new Date(evt.date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-2 font-medium"><Clock size={14} className="text-slate-500"/> {evt.time}</p>
                        <p className="text-xs text-slate-400 flex items-start gap-2 font-medium"><MapPin size={14} className="text-slate-500 shrink-0 mt-0.5"/> <span className="line-clamp-1">{evt.venue}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>

          ) : (

            /* --- EVENT DETAIL WORKSPACE --- */
            <motion.div key="detail" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
              
              {/* Detail Header */}
              <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-[40px] p-8 md:p-10 flex flex-col lg:flex-row justify-between gap-8 relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <button onClick={() => {setActiveEvent(null); setActiveTab('overview');}} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white flex items-center gap-2 mb-4">
                    <ArrowLeft size={14}/> Back to Events
                  </button>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">{activeEvent.title}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-400">
                    <span className="flex items-center gap-2"><CalendarDays size={16} className="text-yellow-500"/> {activeEvent.date}</span>
                    <span className="flex items-center gap-2"><MapPin size={16} className="text-yellow-500"/> {activeEvent.venue}</span>
                    <span className="flex items-center gap-2"><Users size={16} className="text-yellow-500"/> {activeEvent.attendees.length} Registered</span>
                  </div>
                  
                  {/* NEW: Action Buttons for the Share Link */}
                  <div className="flex items-center gap-3 pt-3">
                    <Link 
                      href={`/event/${activeEvent.id}/welcome`} 
                      target="_blank" 
                      className="px-5 py-2.5 bg-yellow-500 text-[#020617] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                    >
                      <ArrowUpRight size={14}/> View Event Page
                    </Link>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/event/${activeEvent.id}/welcome`);
                        alert("Event link copied to clipboard!");
                      }}
                      className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
                    >
                      Copy Link
                    </button>

                    {/* NEW: Action Buttons for the Share Link & Builder */}
                  <div className="flex flex-wrap items-center gap-3 pt-3">
                    <Link 
                      href={`/event/${activeEvent.id}/welcome`} 
                      target="_blank" 
                      className="px-5 py-2.5 bg-yellow-500 text-[#020617] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                    >
                      <ArrowUpRight size={14}/> View Page
                    </Link>
                    <Link 
                      href={`/admin/events/${activeEvent.id}/builder`} 
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                    >
                      <Edit3 size={14}/> Visual Builder
                    </Link>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/event/${activeEvent.id}/welcome`);
                        alert("Event link copied to clipboard!");
                      }}
                      className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
                    >
                      Copy Link
                    </button>
                  </div>
                  </div>
                </div>

                {/* Quick ROI Glance */}
                <div className="relative z-10 bg-[#020617]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-8 backdrop-blur-md">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Gross Revenue</p>
                    <p className="text-2xl font-black text-white">R {activeEvent.finances.revenue}</p>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Net ROI</p>
                    <p className="text-2xl font-black text-emerald-400 italic flex items-center gap-2">
                      R {netRoi} <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 not-italic">{margin.toFixed(0)}%</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                {[
                  { id: 'overview', icon: Shield, label: 'Overview' },
                  { id: 'attendees', icon: Users, label: 'Attendees & Leads' },
                  { id: 'comms', icon: MessageCircle, label: 'Batch Dispatch' },
                  { id: 'assets', icon: FileImage, label: 'Marketing Assets' },
                  { id: 'roi', icon: DollarSign, label: 'Financial ROI' },
                ].map(tab => (
                  <button 
                    key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      activeTab === tab.id ? 'bg-yellow-500 text-[#020617] shadow-lg shadow-yellow-900/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <tab.icon size={16}/> {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT AREAS */}
              <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 min-h-[400px]">
                
                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-6 max-w-3xl">
                    <h3 className="text-lg font-black uppercase italic tracking-tighter border-b border-white/5 pb-4">Event Description</h3>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {activeEvent.description || "No description provided."}
                    </p>
                  </motion.div>
                )}

                {/* 2. ATTENDEES TAB */}
                {activeTab === 'attendees' && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-8">
                    <div className="flex justify-between items-center border-b border-white/5 pb-6">
                      <h3 className="text-lg font-black uppercase italic tracking-tighter">Guest List</h3>
                      <button className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-white transition-all flex items-center gap-2">
                        <Plus size={14}/> Add Prospect/Parent
                      </button>
                    </div>
                    
                    {activeEvent.attendees.length === 0 && (
                      <p className="text-slate-500 italic font-medium py-8 text-center">No attendees registered yet.</p>
                    )}

                    <div className="space-y-3">
                      {activeEvent.attendees.map((guest: any) => (
                        <div key={guest.id} className="flex items-center justify-between p-4 bg-[#020617] border border-white/10 rounded-2xl">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border ${guest.type === 'guardian' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                              {guest.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{guest.name}</p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{guest.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${guest.paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                              {guest.paid ? 'Paid' : 'Pending Payment'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 3. COMMS TAB */}
                {activeTab === 'comms' && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h3 className="text-lg font-black uppercase italic tracking-tighter border-b border-white/5 pb-4">WhatsApp Broadcast</h3>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Message Template</label>
                        <textarea 
                          value={whatsappBody}
                          onChange={(e) => setWhatsappBody(e.target.value)}
                          className="w-full h-48 bg-[#020617] border border-white/10 rounded-2xl p-5 text-sm text-slate-300 outline-none focus:border-green-500 resize-none custom-scrollbar"
                        />
                      </div>
                      <button className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transition-all">
                        <Send size={16}/> Dispatch to {activeEvent.attendees.length} Attendees
                      </button>
                    </div>
                    <div className="bg-[#020617] border border-white/5 rounded-3xl p-8">
                       <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6"><MessageCircle size={16} className="inline mr-2"/> Communication Rules</h4>
                       <ul className="space-y-4 text-sm text-slate-400 font-medium">
                         <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5"/> System automatically swaps [Name] with the recipient's first name.</li>
                         <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5"/> Prospects without phone numbers will be skipped.</li>
                         <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5"/> Messages are queued and sent with a slight delay to prevent WhatsApp spam blocks.</li>
                       </ul>
                    </div>
                  </motion.div>
                )}

                {/* 4. MARKETING ASSETS TAB */}
                {activeTab === 'assets' && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-8">
                    <div className="flex justify-between items-center border-b border-white/5 pb-6">
                      <h3 className="text-lg font-black uppercase italic tracking-tighter">Campaign Assets</h3>
                      <button className="text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white transition-all flex items-center gap-2 shadow-lg">
                        <Upload size={14}/> Upload Asset
                      </button>
                    </div>
                    
                    {activeEvent.assets.length === 0 && (
                      <p className="text-slate-500 italic font-medium text-center py-8">No marketing assets uploaded yet.</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       {activeEvent.assets.map((asset: any, i: number) => (
                         <div key={i} className="bg-[#020617] border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 hover:border-blue-500/50 cursor-pointer transition-all group">
                           <FileImage size={40} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
                           <p className="text-xs font-bold text-slate-300 break-all">{asset.name}</p>
                         </div>
                       ))}
                    </div>
                  </motion.div>
                )}

                {/* 5. ROI / FINANCIALS TAB */}
                {activeTab === 'roi' && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    
                    <div className="space-y-8">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2"><Receipt size={20} className="text-rose-400"/> Event Expenses</h3>
                      </div>
                      
                      {activeEvent.finances.costs.length === 0 && (
                        <p className="text-slate-500 italic font-medium">No expenses logged yet.</p>
                      )}

                      <div className="space-y-3">
                        {activeEvent.finances.costs.map((cost: any, i: number) => (
                          <div key={i} className="flex justify-between items-center bg-[#020617] p-4 rounded-xl border border-white/5">
                            <span className="text-sm font-bold text-slate-300">{cost.desc}</span>
                            <span className="text-sm font-black text-rose-400">- R {cost.amount}</span>
                          </div>
                        ))}
                      </div>

                      {/* Add Cost Form */}
                      <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row gap-4">
                         <input type="text" placeholder="Expense Description" value={newCostDesc} onChange={e=>setNewCostDesc(e.target.value)} className="flex-1 bg-[#020617] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-rose-500" />
                         <input type="number" placeholder="Amount (R)" value={newCostAmt} onChange={e=>setNewCostAmt(e.target.value)} className="w-32 bg-[#020617] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-white outline-none focus:border-rose-500" />
                         <button className="bg-white/10 hover:bg-rose-500 text-white rounded-xl px-4 py-2 transition-all"><Plus size={18}/></button>
                      </div>
                    </div>

                    <div className="bg-[#020617] rounded-[32px] border border-emerald-500/20 p-8 flex flex-col justify-center relative overflow-hidden">
                       <TrendingUp className="absolute -right-10 -bottom-10 size-64 text-emerald-500/5 rotate-12" />
                       <div className="relative z-10 space-y-6">
                         <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Return on Investment</h3>
                         
                         <div className="space-y-4">
                           <div className="flex justify-between items-center text-slate-400 font-bold">
                             <span>Gross Ticket Revenue</span>
                             <span className="text-white">R {activeEvent.finances.revenue}</span>
                           </div>
                           <div className="flex justify-between items-center text-slate-400 font-bold border-b border-white/10 pb-4">
                             <span>Total Event Expenses</span>
                             <span className="text-rose-400">- R {totalCosts}</span>
                           </div>
                           <div className="flex justify-between items-center text-xl font-black italic pt-2">
                             <span className="text-white">Net Profit</span>
                             <span className="text-emerald-400">R {netRoi}</span>
                           </div>
                         </div>

                         <div className="mt-8 bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
                           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Profit Margin</span>
                           <span className="text-2xl font-black text-emerald-400">{margin.toFixed(1)}%</span>
                         </div>
                       </div>
                    </div>

                  </motion.div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}