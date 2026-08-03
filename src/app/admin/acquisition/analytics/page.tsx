'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Activity, Loader2 } from 'lucide-react';
import Link from 'next/link';
import LeadAnalyticsDashboard from '@/components/admin/LeadAnalyticsDashboard';

const MY_ADMIN_ID = 'adfefd6c-954c-4e13-9423-5519aa89980a';
const STAGES = ['Sourced', 'Contacted', 'Engaged', 'Active Trial', 'Pitch', 'Won', 'Lost'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    fetchAndProcessData();
  }, []);

  async function fetchAndProcessData() {
    setLoading(true);
    try {
      // 1. Fetch all leads
      const { data: leads } = await supabase
        .from('growth_leads')
        .select('*')
        .eq('admin_id', MY_ADMIN_ID);

      // 2. Fetch all completed interactions to calculate velocity & effort
      const { data: interactions } = await supabase
        .from('growth_interactions')
        .select('*')
        .eq('admin_id', MY_ADMIN_ID)
        .eq('status', 'Completed')
        .order('actual_date', { ascending: true });

      if (!leads || !interactions) throw new Error("Failed to load data");

      // --- DATA PROCESSING FOR WIDGET ---

      // Metric 1: Current Funnel Distribution
      const funnelDistribution = STAGES.map(stage => ({
        stage,
        count: leads.filter(l => l.stage === stage).length
      }));

      // Metric 2: Stage & Source Breakdown
      const sourceDistribution: Record<string, any> = {};
      leads.forEach(l => {
        const source = l.lead_source || 'Unknown';
        if (!sourceDistribution[source]) {
          sourceDistribution[source] = { source, total: 0 };
          STAGES.forEach(s => sourceDistribution[source][s] = 0);
        }
        sourceDistribution[source].total += 1;
        sourceDistribution[source][l.stage] += 1;
      });
      const sourceData = Object.values(sourceDistribution).sort((a, b) => b.total - a.total);

      // Metric 3 & 4: Velocity (Time in Stage) and Effort (Contacts in Stage)
      const stageMetrics: Record<string, { totalDays: number, totalContacts: number, leadCount: number }> = {};
      STAGES.forEach(s => stageMetrics[s] = { totalDays: 0, totalContacts: 0, leadCount: 0 });

      // Group interactions by lead
      const interactionsByLead: Record<string, any[]> = {};
      interactions.forEach(int => {
        if (!interactionsByLead[int.lead_id]) interactionsByLead[int.lead_id] = [];
        interactionsByLead[int.lead_id].push(int);
      });

      // Calculate averages based on historical interaction logs
      leads.forEach(lead => {
        const leadInts = interactionsByLead[lead.id] || [];
        if (leadInts.length === 0) return;

        // Count contacts per stage
        const contactsPerStage: Record<string, number> = {};
        leadInts.forEach(int => {
          const stageAtTime = int.lead_stage || 'Unknown';
          contactsPerStage[stageAtTime] = (contactsPerStage[stageAtTime] || 0) + 1;
        });

        // Add to global metrics for the stages this lead has passed through
        Object.keys(contactsPerStage).forEach(stage => {
            if(stageMetrics[stage]) {
                stageMetrics[stage].totalContacts += contactsPerStage[stage];
                stageMetrics[stage].leadCount += 1;
                
                // Approximation: Time in current stage
                if (lead.stage === stage) {
                   const lastContact = new Date(leadInts[leadInts.length - 1].actual_date).getTime();
                   const created = new Date(lead.created_at).getTime();
                   const daysInStage = Math.max(0, Math.floor((lastContact - created) / (1000 * 60 * 60 * 24)));
                   stageMetrics[stage].totalDays += daysInStage;
                }
            }
        });
      });

      // Finalize Velocity & Effort Averages
      const effortData = STAGES.map(stage => {
        const sm = stageMetrics[stage];
        return {
          stage,
          avgContacts: sm.leadCount > 0 ? (sm.totalContacts / sm.leadCount).toFixed(1) : 0,
          avgDaysInStage: sm.leadCount > 0 ? Math.round(sm.totalDays / sm.leadCount) : 0
        };
      });

      setAnalyticsData({
        funnelDistribution,
        sourceData,
        effortData,
        totalLeads: leads.length,
        totalInteractions: interactions.length
      });

    } catch (err) {
      console.error(err);
      alert("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-fuchsia-600">
        <Loader2 className="animate-spin" size={32} />
        <p className="font-black uppercase tracking-widest text-xs animate-pulse">Compiling Analytics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 overflow-x-hidden font-sans selection:bg-fuchsia-500/30">
      <div className="max-w-[1600px] mx-auto space-y-10">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-4">
            <Link href="/admin/acquisition" className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-fuchsia-500/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">
                Back to Pipeline
              </span>
            </Link>
            <div>
              <div className="flex items-center gap-2 text-fuchsia-600 mb-2">
                <Activity size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Growth_Metrics_v1</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Pipeline <span className="text-fuchsia-600">Analytics</span>
              </h1>
            </div>
          </div>
          
          <div className="flex gap-4">
             <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm text-center min-w-[120px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Leads</p>
                <p className="text-3xl font-black text-slate-900 italic">{analyticsData?.totalLeads}</p>
             </div>
             <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm text-center min-w-[120px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Contacts</p>
                <p className="text-3xl font-black text-fuchsia-600 italic">{analyticsData?.totalInteractions}</p>
             </div>
          </div>
        </header>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm min-h-[600px]">
           {analyticsData && <LeadAnalyticsDashboard data={analyticsData} />}
        </div>

      </div>
    </div>
  );
}