'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Target, Plus, Search, ChevronRight, Activity, Flame, Snowflake, Award, CalendarClock, ArrowLeft, BarChart3, Ticket, Filter } from 'lucide-react';
import Link from 'next/link';
import InjectLeadModal from '@/components/admin/InjectLeadModal';

// Import Drizzle Server Actions for Neon DB
import { getRadGrowthLeads, updateRadGrowthLead } from '@/app/actions/rad-admin';

const MY_ADMIN_ID = 'adfefd6c-954c-4e13-9423-5519aa89980a';

const STAGES = ['Sourced', 'Contacted', 'Engaged', 'Active Trial', 'Pitch', 'Won', 'Lost'];

const WARMTH_LEVELS = [
  { level: 'Cold', desc: 'Cold: New lead or currently unresponsive. Needs nurturing.' },
  { level: 'Warm', desc: 'Warm: Engaged, asking questions, showing interest.' },
  { level: 'Hot', desc: 'Hot: High intent, active in trial, or ready to close.' }
];

const isToday = (dateString: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const today = new Date();
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
};

export default function AcquisitionEngine() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [todayProgress, setTodayProgress] = useState({ actual: 0, target: 10 });
  const [searchQuery, setSearchQuery] = useState('');
  const [showScheduledOnly, setShowScheduledOnly] = useState(false);
  
  // New State for Quick Filters
  const [activeSourceFilter, setActiveSourceFilter] = useState<string | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    
    // 1. FETCH LEADS DIRECTLY VIA SUPABASE (Bypasses Next.js Server Cache)
    const { data: rawLeads } = await supabase
      .from('growth_leads')
      .select('*')
      .eq('admin_id', MY_ADMIN_ID);
      
    const leadsData = rawLeads || [];

    // 2. FETCH INTERACTIONS & TARGETS FROM SUPABASE
    const { data: plannedData } = await supabase
      .from('growth_interactions')
      .select('lead_id, planned_date')
      .eq('admin_id', MY_ADMIN_ID)
      .eq('status', 'Planned')
      .order('planned_date', { ascending: true }); 

    if (leadsData) {
      const leadsWithDates = leadsData.map((lead: any) => {
        const nextAction = plannedData?.find(p => p.lead_id === lead.id);
        return {
          ...lead,
          // Map snake_case to camelCase so your UI renders it perfectly
          fullName: lead.full_name || lead.fullName,
          contactNumber: lead.contact_number || lead.contactNumber,
          leadSource: lead.lead_source || lead.leadSource,
          nextActionDate: nextAction ? nextAction.planned_date : null
        };
      });
      setLeads(leadsWithDates);
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: actualCount } = await supabase
      .from('growth_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', MY_ADMIN_ID)
      .eq('status', 'Completed')
      .gte('actual_date', startOfDay.toISOString());

    const { data: targetData } = await supabase
      .from('growth_targets')
      .select('target_count')
      .eq('admin_id', MY_ADMIN_ID)
      .eq('target_date', startOfDay.toISOString().split('T')[0])
      .single();

    setTodayProgress({
      actual: actualCount || 0,
      target: targetData?.target_count || 10
    });

    setLoading(false);
  }
  const handleStageChange = async (leadId: string, newStage: string) => {
    setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
    const res = await updateRadGrowthLead(leadId, { stage: newStage });
    if (!res.success) {
      alert("Failed to move lead: " + res.error);
      fetchDashboardData();
    }
  };

  const handleWarmthChange = async (leadId: string, newWarmth: string) => {
    setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, warmth: newWarmth } : l));
    const res = await updateRadGrowthLead(leadId, { warmth: newWarmth });
    if (!res.success) {
      alert("Failed to update warmth: " + res.error);
      fetchDashboardData();
    }
  };

  let finalLeads = leads.filter(l => {
    // 1. Text Search Filtering
    const queryLower = searchQuery.toLowerCase();
    const cleanSearchQuery = searchQuery.replace(/\D/g, '');
    const cleanContactNumber = l.contactNumber ? l.contactNumber.replace(/\D/g, '') : '';

    // CRITICAL FIX: Allow all leads through if search query is empty
    const matchesSearch = searchQuery.trim() === '' || (
      (l.fullName && l.fullName.toLowerCase().includes(queryLower)) || 
      (l.leadSource && l.leadSource.toLowerCase().includes(queryLower)) ||
      (cleanSearchQuery !== '' && cleanContactNumber.includes(cleanSearchQuery))
    );

    // 2. Source Quick Filter
    const matchesSource = activeSourceFilter ? l.leadSource === activeSourceFilter : true;

    return matchesSearch && matchesSource;
  });

  if (showScheduledOnly) {
    finalLeads = finalLeads.filter(l => l.nextActionDate !== null);
  }

  finalLeads.sort((a, b) => {
    if (a.nextActionDate && b.nextActionDate) {
      return new Date(a.nextActionDate).getTime() - new Date(b.nextActionDate).getTime();
    }
    if (a.nextActionDate && !b.nextActionDate) return -1;
    if (!a.nextActionDate && b.nextActionDate) return 1;
    return 0; 
  });

  const progressPercentage = Math.min(100, Math.round((todayProgress.actual / todayProgress.target) * 100));

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600 font-black uppercase tracking-widest text-xs animate-pulse">Initializing Engine...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 overflow-x-hidden font-sans selection:bg-fuchsia-500/30 relative">
      
      {/* LEFT HOVERING QUICK NAV */}
      <div className="fixed top-36 left-6 z-50 flex flex-col gap-3 opacity-30 hover:opacity-100 transition-opacity duration-300 hidden md:flex">
        <Link 
          href="/admin/irene-entry/claims" 
          title="Irene Voucher Claims Engine" 
          className="px-4 py-3 bg-white text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-200 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          <Ticket size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest">Claims</span>
        </Link>

        {/* Divider */}
        <div className="w-full h-px bg-slate-200 my-2" />
        
        {/* Quick Filters */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">Filters</p>
          
          <button 
            onClick={() => setActiveSourceFilter(activeSourceFilter === 'Irene Voucher Claim' ? null : 'Irene Voucher Claim')}
            title="Filter by Irene Claims"
            className={`px-4 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all border ${
              activeSourceFilter === 'Irene Voucher Claim' 
                ? 'bg-fuchsia-500 text-white border-fuchsia-600 shadow-fuchsia-500/30' 
                : 'bg-white text-slate-500 hover:text-fuchsia-500 hover:bg-fuchsia-50 hover:border-fuchsia-200 border-slate-200'
            }`}
          >
            <Filter size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Irene Claims</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto space-y-10 pl-0 md:pl-28">
        
        {/* HEADER & ACCOUNTABILITY HUD */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-slate-200 pb-8">
          <div className="space-y-4">
            
            {/* Top Navigation Links */}
            <div className="flex items-center gap-3">
              <Link 
                href="/admin/dashboard" 
                className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-fuchsia-500/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm"
              >
                <ArrowLeft size={16} className="text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">
                  Mission Control
                </span>
              </Link>

              <Link 
                href="/admin/acquisition/analytics" 
                className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-fuchsia-500/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm"
              >
                <BarChart3 size={16} className="text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">
                  Pipeline Analytics
                </span>
              </Link>
            </div>

            <div>
              <div className="flex items-center gap-2 text-fuchsia-600 mb-2">
                <Target size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Acquisition_Engine_v1</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Growth <span className="text-fuchsia-600">Pipeline</span>
              </h1>
            </div>
          </div>

          <div className="w-full lg:w-1/2 bg-white border border-slate-200 rounded-[32px] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-fuchsia-50 to-transparent pointer-events-none" />
            <div className="flex justify-between items-end mb-5 relative z-10">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Accountability Target</p>
                <p className="text-sm font-bold text-slate-700 mt-1">Meaningful Contact Log</p>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black italic text-slate-900">{todayProgress.actual}</span>
                <span className="text-xl font-bold text-slate-400"> / {todayProgress.target}</span>
              </div>
            </div>
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative z-10 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-fuchsia-500 to-rose-500 transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
              </div>
            </div>
            {progressPercentage >= 100 && (
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-3 flex items-center gap-1.5">
                <Award size={12}/> Daily Target Achieved. Excellent work.
              </p>
            )}
          </div>
        </header>

        {/* TOOLBAR */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search leads or sources..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setShowScheduledOnly(!showScheduledOnly)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${showScheduledOnly ? 'bg-fuchsia-100 text-fuchsia-700 border-2 border-fuchsia-200' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm'}`}
            >
              <CalendarClock size={14}/> {showScheduledOnly ? 'All Leads' : 'Scheduled'}
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-fuchsia-600/20"
            >
              <Plus size={14}/> Add New Lead
            </button>
          </div>
        </div>

        {/* KANBAN BOARD */}
        <div className="flex gap-6 overflow-x-auto pb-8 pt-4 custom-scrollbar snap-x snap-mandatory">
          {STAGES.map((stage) => {
            const stageLeads = finalLeads.filter(l => l.stage === stage);
            
            return (
              <div key={stage} className="min-w-[340px] max-w-[340px] w-full flex flex-col snap-start">
                <div className="flex justify-between items-center mb-5 bg-white border border-slate-200 p-5 rounded-[24px] shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                    {stage === 'Won' && <Award size={14} className="text-emerald-500"/>}
                    {stage === 'Pitch' && <Flame size={14} className="text-rose-500"/>}
                    {stage}
                  </h3>
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-lg border border-slate-200">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="flex-1 space-y-4">
                  {stageLeads.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-[24px] p-8 text-center flex flex-col items-center justify-center text-slate-400 italic bg-white/50">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Empty Stage</span>
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const glowActive = isToday(lead.nextActionDate);
                      
                      return (
                        <Link 
                          key={lead.id}
                          href={`/admin/acquisition/${lead.id}`} 
                          className={`block bg-white border rounded-[24px] p-6 cursor-pointer transition-all group relative overflow-hidden ${
                            glowActive 
                            ? 'border-fuchsia-400 ring-4 ring-fuchsia-500/10 shadow-[0_0_20px_-5px_rgba(217,70,239,0.3)] -translate-y-1' 
                            : 'border-slate-200 hover:border-fuchsia-400 hover:-translate-y-1 hover:shadow-lg shadow-sm'
                          }`}
                        >
                          <div className="absolute top-0 right-0 p-4 flex items-center justify-end gap-2 w-full pointer-events-none">
                            {lead.nextActionDate && (
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md z-10 ${
                                glowActive ? 'bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/30' : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}>
                                {new Date(lead.nextActionDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ChevronRight size={16} className="text-fuchsia-500" />
                            </div>
                          </div>
                          
                          <div className="flex items-start justify-between mb-4 mt-2">
                            <div className="pr-16">
                              <p className="font-bold text-slate-900 text-base leading-tight group-hover:text-fuchsia-600 transition-colors">{lead.fullName}</p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1.5">{lead.leadSource || 'Unknown Source'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 relative z-10">
                            <div 
                              className="flex items-center gap-1.5" 
                              title={WARMTH_LEVELS.find(w => w.level === lead.warmth)?.desc || 'Select Warmth'}
                            >
                              {lead.warmth === 'Hot' ? <Flame size={12} className="text-rose-500"/> : lead.warmth === 'Warm' ? <Activity size={12} className="text-amber-500"/> : <Snowflake size={12} className="text-blue-500"/>}
                              <select 
                                value={lead.warmth}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onChange={(e) => { e.preventDefault(); e.stopPropagation(); handleWarmthChange(lead.id, e.target.value); }}
                                className="text-[9px] font-black uppercase tracking-widest bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-2 py-1 outline-none cursor-pointer hover:border-fuchsia-400 transition-colors"
                              >
                                {WARMTH_LEVELS.map(w => <option key={w.level} value={w.level}>{w.level}</option>)}
                              </select>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <select 
                                value={lead.stage}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onChange={(e) => { e.preventDefault(); e.stopPropagation(); handleStageChange(lead.id, e.target.value); }}
                                className="text-[9px] font-black uppercase tracking-widest bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-2 py-1 outline-none cursor-pointer hover:border-fuchsia-400 transition-colors"
                              >
                                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* COMPONENTIZED ADD LEAD MODAL */}
      <InjectLeadModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchDashboardData();
        }}
        adminId={MY_ADMIN_ID}
      />

    </div>
  );
}