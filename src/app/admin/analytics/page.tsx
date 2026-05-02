"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
  ArrowLeft, Search, BarChart3, Activity, 
  MousePointerClick, Users, Clock, Loader2, Database,
  ChevronDown, ChevronRight, Monitor, Smartphone, Globe, ShieldCheck, Wifi, EyeOff, Filter, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const parseUserAgent = (ua: string) => {
  if (!ua) return { device: 'Unknown', browser: 'Unknown', isMobile: false };
  const isMobile = /Mobile|Android|iP(hone|od|ad)/i.test(ua);
  const device = /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : isMobile ? 'Mobile' : 'Linux/Other';
  const browser = /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : /Firefox/.test(ua) ? 'Firefox' : 'Browser';
  return { device, browser, isMobile };
};

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("7d");
  
  // IP Filtering State
  const [ignoredIps, setIgnoredIps] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Load ignored IPs from local storage on mount
  useEffect(() => {
    const savedIps = localStorage.getItem('rad_ignored_ips');
    if (savedIps) {
      setIgnoredIps(JSON.parse(savedIps));
    }
  }, []);

  // Fetch & Realtime Subscription
  useEffect(() => {
    fetchAnalytics();

    // Setup Supabase Realtime Subscription for automatic updates
    const channel = supabase
      .channel('analytics-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_events' }, (payload) => {
        // Drop the new event directly into the top of our state
        setEvents(current => [payload.new, ...current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [timeRange]);

  async function fetchAnalytics() {
    setIsLoading(true);
    try {
      const dateBoundary = new Date();
      if (timeRange === "24h") dateBoundary.setDate(dateBoundary.getDate() - 1);
      if (timeRange === "7d") dateBoundary.setDate(dateBoundary.getDate() - 7);
      if (timeRange === "30d") dateBoundary.setDate(dateBoundary.getDate() - 30);

      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', dateBoundary.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // --- ACTIONS ---

  const toggleIgnoreIp = (ip: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!ip || ip === "Unknown IP") return;

    setIgnoredIps(prev => {
      const newIps = prev.includes(ip) ? prev.filter(i => i !== ip) : [...prev, ip];
      localStorage.setItem('rad_ignored_ips', JSON.stringify(newIps));
      return newIps;
    });
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(isoString));
  };
  
  const formatDate = (isoString: string) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoString));
  };

  // --- DATA PROCESSING (Calculated on the fly so Realtime updates apply instantly) ---

  // 1. Remove Whitelisted IPs
  const visibleEvents = events.filter(e => !ignoredIps.includes(e.metadata?.ip_address));

  // 2. Calculate Stats based on visible events
  const stats = useMemo(() => ({
    totalViews: visibleEvents.filter(e => e.event_type === 'page_view').length,
    uniqueVisitors: new Set(visibleEvents.map(e => e.user_identifier || e.metadata?.ip_address).filter(Boolean)).size,
    linkClicks: visibleEvents.filter(e => e.event_type === 'link_click').length
  }), [visibleEvents]);

  // 3. Apply Search Filter
  const filteredEvents = visibleEvents.filter(event => {
    const searchLower = searchQuery.toLowerCase();
    const matchPath = event.url_path?.toLowerCase().includes(searchLower);
    const matchUser = event.user_identifier?.toLowerCase().includes(searchLower);
    const matchAuth = event.metadata?.logged_in_user?.toLowerCase().includes(searchLower);
    const matchIp = event.metadata?.ip_address?.includes(searchLower);
    return matchPath || matchUser || matchAuth || matchIp;
  });

  // 4. Group by User/Lead/IP
  const groupedEvents = filteredEvents.reduce((groups: Record<string, any[]>, event) => {
    const groupId = event.metadata?.logged_in_user 
      || event.user_identifier 
      || event.metadata?.ip_address 
      || "Unknown Visitor";
    
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(event);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-[#020617] p-6 lg:p-12 text-left relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* --- HEADER --- */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors text-sm font-bold uppercase tracking-widest">
              <ArrowLeft size={16} /> Back to Hub
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none flex items-center gap-4">
                Telemetry <span className="text-blue-500">Node</span>
                {/* LIVE INDICATOR */}
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Live</span>
                </div>
              </h1>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                <Activity size={14} /> Workspace: Visitor & Event Analytics
              </p>
            </div>
            
            <div className="flex items-center gap-4 shrink-0">
              {/* Filter Manager Button */}
              <button 
                onClick={() => setShowFilterModal(true)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  ignoredIps.length > 0 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" 
                    : "bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10"
                }`}
              >
                <Filter size={14} /> {ignoredIps.length} Ignored
              </button>

              {/* Time Range Selector */}
              <div className="flex bg-[#0f172a] border border-white/10 rounded-2xl p-1">
                {[{ id: "24h", label: "24H" }, { id: "7d", label: "7D" }, { id: "30d", label: "30D" }, { id: "all", label: "ALL" }].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setTimeRange(range.id)}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      timeRange === range.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- STAT CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="absolute -right-6 -top-6 text-blue-500/10 group-hover:text-blue-500/20 transition-colors"><BarChart3 size={100} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Page Views</p>
            <p className="text-4xl font-black text-white italic tracking-tighter relative z-10">{isLoading ? "-" : stats.totalViews}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="absolute -right-6 -top-6 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors"><Users size={100} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Unique Sessions</p>
            <p className="text-4xl font-black text-white italic tracking-tighter relative z-10">{isLoading ? "-" : stats.uniqueVisitors}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className="absolute -right-6 -top-6 text-amber-500/10 group-hover:text-amber-500/20 transition-colors"><MousePointerClick size={100} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Link Clicks</p>
            <p className="text-4xl font-black text-white italic tracking-tighter relative z-10">{isLoading ? "-" : stats.linkClicks}</p>
          </div>
        </div>

        {/* --- SEARCH --- */}
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input 
            type="text"
            placeholder="SEARCH BY PATH, LEAD ID, NAME, OR IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a]/50 border border-white/5 rounded-3xl py-6 pl-16 pr-8 text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-800 font-black italic uppercase tracking-tighter text-sm"
          />
        </div>

        {/* --- GROUPED ACTIVITY FEED --- */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-[#0f172a] rounded-[32px] border border-white/5">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Syncing Telemetry...</p>
            </div>
          ) : Object.keys(groupedEvents).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-[#0f172a] rounded-[32px] border border-white/5 opacity-50">
              <Database className="text-slate-600" size={48} />
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest italic">No Data Nodes Found</p>
            </div>
          ) : (
            Object.entries(groupedEvents).map(([groupId, userEvents]) => {
              const isCollapsed = collapsedGroups[groupId];
              const mostRecentEvent = userEvents[0]; // Events are ordered by date DESC
              const uaInfo = parseUserAgent(mostRecentEvent.metadata?.user_agent);
              const ipAddress = mostRecentEvent.metadata?.ip_address;
              
              // Determine identity priority
              let identityColor = "text-slate-400";
              let IdentityIcon = Globe;
              
              if (mostRecentEvent.metadata?.logged_in_user) {
                identityColor = "text-purple-400";
                IdentityIcon = ShieldCheck;
              } else if (mostRecentEvent.user_identifier) {
                identityColor = "text-emerald-400";
                IdentityIcon = Users;
              }

              return (
                <div key={groupId} className="bg-[#0f172a] border border-white/5 rounded-[24px] overflow-hidden shadow-lg transition-all">
                  
                  {/* GROUP HEADER (Click to toggle) */}
                  <div 
                    onClick={() => toggleGroup(groupId)}
                    className="flex items-center justify-between p-5 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors border-b border-white/5 group/header"
                  >
                    <div className="flex items-center gap-4">
                      <button className="text-slate-500 hover:text-white transition-colors">
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                      </button>
                      
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${identityColor}`}>
                          <IdentityIcon size={16} />
                        </div>
                        <div>
                          <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-3 ${identityColor}`}>
                            {groupId}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span className="flex items-center gap-1"><Activity size={10}/> {userEvents.length} Events</span>
                            <span className="flex items-center gap-1 relative">
                              <Wifi size={10}/> {ipAddress || "Unknown IP"}
                              
                              {/* HIDE IP BUTTON (Always visible but subtle) */}
                              {ipAddress && (
                                <button 
                                  onClick={(e) => toggleIgnoreIp(ipAddress, e)}
                                  className="ml-2 text-slate-500 hover:text-rose-400 transition-all flex items-center gap-1 bg-white/5 hover:bg-rose-500/10 px-2 py-0.5 rounded"
                                  title="Hide this IP from Analytics"
                                >
                                  <EyeOff size={10} /> Hide IP
                                </button>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              {uaInfo.isMobile ? <Smartphone size={10}/> : <Monitor size={10}/>}
                              {uaInfo.device} • {uaInfo.browser}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Last Active: {formatDate(mostRecentEvent.created_at)}
                    </div>
                  </div>

                  {/* GROUP CHILDREN (Events) */}
                  {!isCollapsed && (
                    <div className="divide-y divide-white/5 bg-black/20">
                      {userEvents.map((event) => (
                        <div key={event.id} className="grid grid-cols-12 gap-4 p-4 pl-12 hover:bg-white/[0.02] transition-colors items-center">
                          
                          {/* Time */}
                          <div className="col-span-2 flex items-center gap-2">
                            <Clock size={12} className="text-slate-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                              {formatTime(event.created_at)}
                            </span>
                          </div>

                          {/* Event Badge */}
                          <div className="col-span-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                              event.event_type === 'page_view' 
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {event.event_type === 'page_view' ? <Activity size={10}/> : <MousePointerClick size={10}/>}
                              {event.event_type.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Path / Detail */}
                          <div className="col-span-7 flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-300 truncate" title={event.url_path}>
                              {event.url_path}
                            </span>
                            {event.metadata?.search_params && (
                              <span className="text-[9px] text-slate-600 font-mono truncate max-w-[200px]">
                                ?{event.metadata.search_params}
                              </span>
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* --- MANAGE IGNORED IPS MODAL --- */}
        <AnimatePresence>
          {showFilterModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f172a] border border-white/10 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02]">
                  <h3 className="text-xl font-black uppercase italic text-white tracking-tighter flex items-center gap-3">
                    <Filter className="text-amber-400" /> Whitelisted IPs
                  </h3>
                  <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-400 font-bold leading-relaxed">
                    Events from these IP addresses are saved in the database but hidden from your analytics dashboard calculations.
                  </p>
                  
                  {ignoredIps.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                      No IPs are currently ignored.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ignoredIps.map(ip => (
                        <div key={ip} className="flex items-center justify-between bg-black/50 border border-white/5 rounded-xl p-3">
                          <span className="text-sm font-mono text-slate-300">{ip}</span>
                          <button 
                            onClick={() => toggleIgnoreIp(ip)}
                            className="text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}