"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, TrendingUp, Activity, Loader2, 
  BarChart3, Zap, Target, Crown, PieChart, Users,
  Layers, Percent, ArrowUpRight, ArrowDownRight, Gem
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function RevenueIntelligencePortal() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [billingItems, setBillingItems] = useState<any[]>([]);

  useEffect(() => {
    fetchIntelligenceData();
  }, []);

  async function fetchIntelligenceData() {
    setLoading(true);
    try {
      // 1. Fetch Paid Invoices
      const { data: invData } = await supabase
        .from('billing_records')
        .select('*')
        .eq('doc_type', 'invoice')
        .in('status', ['paid', 'settled'])
        .order('created_at', { ascending: true });

      // 2. Fetch Profiles for Cohort mapping
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, lead_source, metadata')
        .eq('role', 'guardian');

      // 3. CRITICAL: Fetch items to determine actual COGS (Cost of Goods Sold)
      const { data: itemsData } = await supabase
        .from('billing_items')
        .select('name, cost');

      if (invData) setInvoices(invData);
      if (profData) setProfiles(profData);
      if (itemsData) setBillingItems(itemsData);
    } catch (err) {
      console.error("Error fetching unit economics:", err);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UNIT ECONOMICS & PROFITABILITY ENGINE
  // ==========================================
  const economics = useMemo(() => {
    const parentStats = new Map();
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const itemCostMap = new Map(billingItems.map(i => [i.name, Number(i.cost) || 0]));

    // 1. Compile per-parent lifetime unit economics
    invoices.forEach(inv => {
      const gId = inv.guardian_id;
      if (!gId) return;

      if (!parentStats.has(gId)) {
        parentStats.set(gId, {
          id: gId,
          totalGross: 0,
          totalProfit: 0, // GP tracking
          invoiceCount: 0,
          firstDate: new Date(inv.created_at),
          lastDate: new Date(inv.created_at),
          firstItemDesc: inv.line_items?.[0]?.desc || "",
          profile: profileMap.get(gId) || {}
        });
      }

      const stat = parentStats.get(gId);
      const grossRevenue = Number(inv.total_amount) || 0;
      
      // Calculate real Cost of Delivery for this specific invoice
      let invoiceCost = 0;
      inv.line_items?.forEach((item: any) => {
        const unitCost = itemCostMap.get(item.desc || item.description) || 0;
        invoiceCost += unitCost * (Number(item.qty) || 1);
      });

      const grossProfit = grossRevenue - invoiceCost;

      stat.totalGross += grossRevenue;
      stat.totalProfit += grossProfit;
      stat.invoiceCount += 1;
      
      const invDate = new Date(inv.created_at);
      if (invDate < stat.firstDate) stat.firstDate = invDate;
      if (invDate > stat.lastDate) stat.lastDate = invDate;
    });

    let globalGross = 0;
    let globalProfit = 0;
    let totalRetentionMonths = 0;
    let recurringParentsCount = 0;
    
    let grossMRR30Days = 0;
    let netMRR30Days = 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Cohort Mapping Structure
    const cohorts: Record<string, { count: number, grossLTV: number, netLTV: number, totalMonths: number }> = {
      "Bootcamp to Ongoing": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 },
      "Referral Network": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 },
      "Online Direct": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 },
      "Organic / Unknown": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 }
    };

    // 2. Calculate Margins, MRR, and Cohorts
    parentStats.forEach(stat => {
      globalGross += stat.totalGross;
      globalProfit += stat.totalProfit;
      
      const diffTime = Math.abs(stat.lastDate.getTime() - stat.firstDate.getTime());
      const diffMonths = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)));
      totalRetentionMonths += diffMonths;

      if (stat.lastDate >= thirtyDaysAgo) {
        grossMRR30Days += (stat.totalGross / diffMonths); 
        netMRR30Days += (stat.totalProfit / diffMonths); 
      }

      if (stat.invoiceCount > 1) recurringParentsCount++;

      // Intelligent Cohort Router
      let cohort = "Organic / Unknown";
      const source = (stat.profile.lead_source || "").toLowerCase();
      const firstItem = (stat.firstItemDesc || "").toLowerCase();

      if (source.includes('referral')) cohort = "Referral Network";
      else if (firstItem.includes('bootcamp')) cohort = "Bootcamp to Ongoing";
      else if (firstItem.includes('online')) cohort = "Online Direct";

      cohorts[cohort].count++;
      cohorts[cohort].grossLTV += stat.totalGross;
      cohorts[cohort].netLTV += stat.totalProfit;
      cohorts[cohort].totalMonths += diffMonths;
    });

    const activeParents = parentStats.size;
    const globalMargin = globalGross > 0 ? (globalProfit / globalGross) * 100 : 0;
    const avgNetLTV = activeParents > 0 ? globalProfit / activeParents : 0;
    const avgGrossLTV = activeParents > 0 ? globalGross / activeParents : 0;
    const avgRetention = activeParents > 0 ? totalRetentionMonths / activeParents : 0;

    // Process Cohorts and RANK BY NET LTV (PROFIT), not Gross
    const processedCohorts = Object.entries(cohorts)
      .filter(([_, data]) => data.count > 0)
      .map(([name, data]) => {
        const avgGross = data.grossLTV / data.count;
        const avgNet = data.netLTV / data.count;
        const margin = avgGross > 0 ? (avgNet / avgGross) * 100 : 0;
        return {
          name,
          count: data.count,
          avgGrossLtv: avgGross,
          avgNetLtv: avgNet,
          marginPct: margin,
          avgRetention: data.totalMonths / data.count
        };
      })
      .sort((a, b) => b.avgNetLtv - a.avgNetLtv); // Brutal truth ranking

    return {
      activeParents,
      recurringParentsCount,
      grossMRR: grossMRR30Days,
      netMRR: netMRR30Days,
      globalMargin,
      avgGrossLTV,
      avgNetLTV,
      avgRetention,
      cohorts: processedCohorts
    };
  }, [invoices, profiles, billingItems]);

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
      <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-[10px]">Synthesizing_Unit_Economics...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/finance" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-emerald-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Finance Ledger</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <PieChart size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Unit_Economics_Online</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
                Revenue_<span className="text-emerald-500">Intelligence</span>
              </h1>
            </div>
          </div>
        </header>

        {/* ====================================================
            NORTH STAR METRICS (Focus: Profitability over Volume)
            ==================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-gradient-to-br from-emerald-500/10 to-[#020617] border border-emerald-500/20 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="absolute -right-4 -top-4 p-8 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"/>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1 flex items-center gap-2"><Zap size={14}/> Net MRR (GP)</p>
            <p className="text-4xl font-black text-white tracking-tighter mt-2">R {Math.round(economics.netMRR).toLocaleString()}</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 border-t border-white/5 pt-4">
               <span>Gross: R {Math.round(economics.grossMRR).toLocaleString()}</span>
               <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[9px] uppercase tracking-widest">Top Line</span>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8 shadow-xl hover:bg-white/[0.04] transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-2"><Target size={14}/> Avg Net LTV</p>
            <p className="text-4xl font-black text-white tracking-tighter mt-2">R {Math.round(economics.avgNetLTV).toLocaleString()}</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 border-t border-white/5 pt-4">
               <span>Gross: R {Math.round(economics.avgGrossLTV).toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8 shadow-xl hover:bg-white/[0.04] transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-2"><Percent size={14}/> Blended Margin</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-4xl font-black text-white tracking-tighter">{economics.globalMargin.toFixed(1)}%</p>
              {economics.globalMargin >= 70 ? <ArrowUpRight className="text-emerald-500" size={24}/> : <ArrowDownRight className="text-rose-500" size={24}/>}
            </div>
            <div className="mt-4 flex flex-col gap-1.5 border-t border-white/5 pt-4">
               {/* Mini margin progress bar */}
               <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                 <div className={`h-full rounded-full ${economics.globalMargin >= 70 ? 'bg-emerald-500' : economics.globalMargin >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${economics.globalMargin}%` }} />
               </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8 shadow-xl hover:bg-white/[0.04] transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-2"><TrendingUp size={14}/> Retention Avg</p>
            <p className="text-4xl font-black text-purple-400 tracking-tighter mt-2">{economics.avgRetention.toFixed(1)} <span className="text-lg text-slate-500">Mths</span></p>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-400 border-t border-white/5 pt-4">
               <span>Active Base</span>
               <span className="text-white bg-white/10 px-3 py-1 rounded-lg">{economics.recurringParentsCount} / {economics.activeParents}</span>
            </div>
          </div>

        </div>

        {/* ====================================================
            COHORT LEADERBOARD (Ranked by Profitability)
            ==================================================== */}
        <div className="space-y-8 pt-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                <Layers className="text-emerald-500"/> Cohort Profitability Matrix
              </h2>
              <p className="text-slate-500 text-sm italic">Ranked aggressively by actual Gross Profit retained (Net LTV).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {economics.cohorts.length === 0 ? (
              <p className="text-slate-500 text-sm italic col-span-2 p-12 bg-white/5 rounded-[32px] text-center border border-white/10">Insufficient data to map cohorts. Process COGS and Invoices to unlock matrix.</p>
            ) : (
              economics.cohorts.map((cohort, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={cohort.name} 
                  className={`border rounded-[40px] p-8 md:p-10 relative overflow-hidden transition-all ${
                    index === 0 
                    ? 'bg-gradient-to-br from-emerald-900/20 to-[#020617] border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)]' 
                    : 'bg-[#0f172a]/50 border-white/5 shadow-xl hover:border-white/10'
                  }`}
                >
                  {/* Decorative rank number */}
                  <div className={`absolute -right-6 -top-10 text-[180px] font-black italic leading-none opacity-5 select-none ${index === 0 ? 'text-emerald-500' : 'text-white'}`}>
                    {index + 1}
                  </div>

                  {index === 0 && <Crown className="absolute top-8 right-8 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" size={32} strokeWidth={2}/>}
                  
                  <div className="relative z-10 space-y-8">
                    
                    {/* Header */}
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${index === 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                          Rank 0{index + 1}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> {cohort.count} Active</span>
                      </div>
                      <h3 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white leading-none">{cohort.name}</h3>
                    </div>

                    {/* Core Economics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#020617] border border-white/5 p-5 rounded-3xl">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><Gem size={10} className="text-emerald-500"/> Net LTV (GP)</p>
                        <p className="text-2xl md:text-3xl font-black tracking-tighter text-white">R {Math.round(cohort.avgNetLtv).toLocaleString()}</p>
                      </div>
                      <div className="bg-[#020617] border border-white/5 p-5 rounded-3xl">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><TrendingUp size={10} className="text-purple-400"/> Avg Retention</p>
                        <p className="text-2xl md:text-3xl font-black tracking-tighter text-white">{cohort.avgRetention.toFixed(1)} <span className="text-sm text-slate-500 font-bold">mths</span></p>
                      </div>
                    </div>

                    {/* Secondary Metrics & Margin Bar */}
                    <div className="pt-4 border-t border-white/5 space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gross LTV (Top Line)</p>
                          <p className="text-lg font-bold text-slate-300">R {Math.round(cohort.avgGrossLtv).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Profit Margin</p>
                          <p className={`text-xl font-black ${cohort.marginPct >= 70 ? 'text-emerald-400' : cohort.marginPct >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {cohort.marginPct.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      
                      {/* Margin Progress Bar */}
                      <div className="w-full h-2 bg-[#020617] rounded-full overflow-hidden border border-white/5 relative">
                        {/* 50% marker line */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20 z-10" />
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 relative z-0 ${cohort.marginPct >= 70 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : cohort.marginPct >= 40 ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'}`} 
                          style={{ width: `${cohort.marginPct}%` }} 
                        />
                      </div>
                    </div>

                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* INSIGHTS FOOTER */}
        <div className="bg-gradient-to-r from-blue-900/20 to-emerald-900/10 border border-blue-500/20 rounded-[32px] p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-8 mt-12 shadow-2xl">
           <div className="p-5 bg-[#020617] border border-blue-500/30 rounded-3xl shrink-0 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
             <Activity className="text-blue-400" size={32}/>
           </div>
           <div className="space-y-3">
             <h4 className="text-xl font-black uppercase italic tracking-widest text-white">Actionable Intelligence</h4>
             <p className="text-slate-300 text-base leading-relaxed max-w-4xl font-medium">
               The engine calculates LTV based on the <strong>Cost of Goods Sold (COGS)</strong> mapped to your billing items. To maximize Net MRR, allocate marketing budget toward acquiring more parents matching the <strong>{economics.cohorts[0]?.name || "Top"}</strong> profile, as they yield the highest actual cash profit per acquisition.
             </p>
           </div>
        </div>

      </div>
    </div>
  );
}