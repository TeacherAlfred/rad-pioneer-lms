"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, TrendingUp, Activity, Loader2, 
  Zap, Target, Crown, PieChart, Users,
  Layers, Percent, ArrowUpRight, ArrowDownRight, Gem, Search, X, Package, Clock
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function RevenueIntelligencePortal() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [billingItems, setBillingItems] = useState<any[]>([]);

  // State for the Drill-Down Modal
  const [drilldown, setDrilldown] = useState<{
    title: string;
    mode: 'collected' | 'projected' | 'unpaid';
    filter: 'all' | 'monthly' | 'upfront';
  } | null>(null);

  useEffect(() => {
    fetchIntelligenceData();
  }, []);

  async function fetchIntelligenceData() {
    setLoading(true);
    try {
      // 1. Fetch ALL Valid Invoices
      const { data: invData } = await supabase
        .from('billing_records')
        .select('*')
        .eq('doc_type', 'invoice')
        .in('status', ['paid', 'settled', 'pending', 'overdue', 'partially_paid'])
        .order('created_at', { ascending: true });

      // 2. Fetch Profiles for Cohort mapping & Billing Schedules
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, display_name, lead_source, metadata')
        .eq('role', 'guardian');

      // 3. Fetch items to determine actual COGS
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

    // --- 1. ACTIVE BASE CALCULATION ---
    const totalInvoicedParentsSet = new Set();
    invoices.forEach(inv => {
      if (inv.guardian_id) totalInvoicedParentsSet.add(inv.guardian_id);
    });
    const totalInvoicedParentsCount = totalInvoicedParentsSet.size;

    // --- 2. TERM REVENUE REALIZATION PROJECTION (LINE-ITEM & PARTIAL-PAY AWARE) ---
    let termProjectedTotal = 0;
    
    let termCollectedCoreTotal = 0;
    let termUnpaidCoreTotal = 0;
    let termCollectedOtherTotal = 0;
    let termUnpaidOtherTotal = 0;
    
    let termMonthlyCount = 0;
    let termUpfrontCount = 0;
    
    let termMonthlyCoreCollected = 0;
    let termMonthlyCoreUnpaid = 0;
    let termMonthlyOtherCollected = 0;
    let termMonthlyOtherUnpaid = 0;
    
    let termUpfrontCoreCollected = 0;
    let termUpfrontCoreUnpaid = 0;
    let termUpfrontOtherCollected = 0;
    let termUpfrontOtherUnpaid = 0;
    
    const termBreakdown: any[] = [];

    const allParentsMap = new Map();
    invoices.forEach(inv => {
      const gId = inv.guardian_id;
      if (!gId) return;
      if (!allParentsMap.has(gId)) {
        const profile = profileMap.get(gId) || {};
        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
        allParentsMap.set(gId, {
          invoices: [],
          frequency: meta.billing_schedule?.frequency || 'monthly'
        });
      }
      allParentsMap.get(gId).invoices.push(inv);
    });

    allParentsMap.forEach((data, gId) => {
      let isTermParent = false;
      const isUpfront = data.frequency === 'termly';
      
      // Pass 1: Identify if they are a core term parent
      data.invoices.forEach((i: any) => {
        i.line_items?.forEach((li: any) => {
          const desc = (li.desc || "").toLowerCase();
          if (desc.includes('term') || desc.includes('lesson')) isTermParent = true;
        });
      });

      // Pass 2: Calculate Line-Item Split & Payment Splitting
      if (isTermParent) {
        const projected = isUpfront ? 2000 : 2250; // R2000 upfront vs R750x3 monthly
        termProjectedTotal += projected;
        
        if (isUpfront) termUpfrontCount++;
        else termMonthlyCount++;

        let parentCoreCollected = 0;
        let parentCoreUnpaid = 0;
        let parentOtherCollected = 0;
        let parentOtherUnpaid = 0;

        data.invoices.forEach((i: any) => {
          let invCoreSum = 0;
          let invOtherSum = 0;

          i.line_items?.forEach((li: any) => {
            const desc = (li.desc || "").toLowerCase();
            const price = Number(li.price) || 0;
            const qty = Number(li.qty) || 1;
            const disc = Number(li.disc) || 0;
            const lineValue = (price * qty) * (1 - disc / 100);

            if (desc.includes('term') || desc.includes('lesson')) invCoreSum += lineValue;
            else invOtherSum += lineValue;
          });

          const dbTotal = Number(i.total_amount) || 0;
          const dbPaid = Number(i.amount_paid) || 0;
          // If status is paid/settled but amount_paid wasn't updated correctly, default to full dbTotal
          const actualPaid = ['paid', 'settled'].includes(i.status) ? dbTotal : dbPaid;
          const actualUnpaid = Math.max(0, dbTotal - actualPaid);

          const calcTotal = invCoreSum + invOtherSum;
          
          if (calcTotal > 0) {
            parentCoreCollected += (invCoreSum / calcTotal) * actualPaid;
            parentCoreUnpaid += (invCoreSum / calcTotal) * actualUnpaid;
            parentOtherCollected += (invOtherSum / calcTotal) * actualPaid;
            parentOtherUnpaid += (invOtherSum / calcTotal) * actualUnpaid;
          } else {
            parentCoreCollected += actualPaid;
            parentCoreUnpaid += actualUnpaid;
          }
        });
        
        termCollectedCoreTotal += parentCoreCollected;
        termUnpaidCoreTotal += parentCoreUnpaid;
        termCollectedOtherTotal += parentOtherCollected;
        termUnpaidOtherTotal += parentOtherUnpaid;

        if (isUpfront) {
          termUpfrontCoreCollected += parentCoreCollected;
          termUpfrontCoreUnpaid += parentCoreUnpaid;
          termUpfrontOtherCollected += parentOtherCollected;
          termUpfrontOtherUnpaid += parentOtherUnpaid;
        } else {
          termMonthlyCoreCollected += parentCoreCollected;
          termMonthlyCoreUnpaid += parentCoreUnpaid;
          termMonthlyOtherCollected += parentOtherCollected;
          termMonthlyOtherUnpaid += parentOtherUnpaid;
        }

        // Save to breakdown for the modal
        termBreakdown.push({
          id: gId,
          name: profileMap.get(gId)?.display_name || "Unknown Guardian",
          isUpfront,
          projected,
          collectedCore: parentCoreCollected,
          unpaidCore: parentCoreUnpaid,
          collectedOther: parentOtherCollected,
          unpaidOther: parentOtherUnpaid
        });
      }
    });

    termBreakdown.sort((a, b) => a.name.localeCompare(b.name));

    // --- 3. UNIT ECONOMICS (STRICT CASHFLOW) ---
    const paidInvoices = invoices.filter(inv => ['paid', 'settled'].includes(inv.status));

    paidInvoices.forEach(inv => {
      const gId = inv.guardian_id;
      if (!gId) return;

      if (!parentStats.has(gId)) {
        parentStats.set(gId, {
          id: gId,
          totalGross: 0,
          totalProfit: 0, 
          invoiceCount: 0,
          firstDate: new Date(inv.created_at),
          lastDate: new Date(inv.created_at),
          firstItemDesc: inv.line_items?.[0]?.desc || "",
          profile: profileMap.get(gId) || {}
        });
      }

      const stat = parentStats.get(gId);
      const grossRevenue = Number(inv.total_amount) || 0;
      
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

    const cohorts: Record<string, { count: number, grossLTV: number, netLTV: number, totalMonths: number }> = {
      "Bootcamp to Ongoing": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 },
      "Referral Network": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 },
      "Online Direct": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 },
      "Organic / Unknown": { count: 0, grossLTV: 0, netLTV: 0, totalMonths: 0 }
    };

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

    const activePaidParents = parentStats.size; 
    const globalMargin = globalGross > 0 ? (globalProfit / globalGross) * 100 : 0;
    const avgNetLTV = activePaidParents > 0 ? globalProfit / activePaidParents : 0;
    const avgGrossLTV = activePaidParents > 0 ? globalGross / activePaidParents : 0;
    const avgRetention = activePaidParents > 0 ? totalRetentionMonths / activePaidParents : 0;

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
      .sort((a, b) => b.avgNetLtv - a.avgNetLtv);

    return {
      activePaidParents,
      totalInvoicedParentsCount,
      recurringParentsCount,
      grossMRR: grossMRR30Days,
      netMRR: netMRR30Days,
      globalMargin,
      avgGrossLTV,
      avgNetLTV,
      avgRetention,
      cohorts: processedCohorts,
      term: {
        projected: termProjectedTotal,
        coreCollected: termCollectedCoreTotal,
        coreUnpaid: termUnpaidCoreTotal,
        otherCollected: termCollectedOtherTotal,
        otherUnpaid: termUnpaidOtherTotal,
        upfrontCount: termUpfrontCount,
        monthlyCount: termMonthlyCount,
        upfrontCoreCollected: termUpfrontCoreCollected,
        upfrontCoreUnpaid: termUpfrontCoreUnpaid,
        upfrontOtherCollected: termUpfrontOtherCollected,
        upfrontOtherUnpaid: termUpfrontOtherUnpaid,
        monthlyCoreCollected: termMonthlyCoreCollected,
        monthlyCoreUnpaid: termMonthlyCoreUnpaid,
        monthlyOtherCollected: termMonthlyOtherCollected,
        monthlyOtherUnpaid: termMonthlyOtherUnpaid,
        breakdown: termBreakdown 
      }
    };
  }, [invoices, profiles, billingItems]);

  // Handle Drill-Down Filtering
  const displayedDrilldown = useMemo(() => {
    if (!drilldown) return [];
    let list = [...economics.term.breakdown];
    
    // Plan Filter
    if (drilldown.filter === 'monthly') list = list.filter(p => !p.isUpfront);
    if (drilldown.filter === 'upfront') list = list.filter(p => p.isUpfront);
    
    // Sort logic based on mode
    if (drilldown.mode === 'collected') {
      list.sort((a, b) => b.collectedCore - a.collectedCore);
    } else if (drilldown.mode === 'unpaid') {
      list = list.filter(p => p.unpaidCore > 0 || p.unpaidOther > 0);
      list.sort((a, b) => b.unpaidCore - a.unpaidCore);
    }
    
    return list;
  }, [drilldown, economics.term.breakdown]);


  // Bar Math
  const pctCollected = Math.min(100, (economics.term.coreCollected / (economics.term.projected || 1)) * 100);
  const pctUnpaid = Math.min(100 - pctCollected, (economics.term.coreUnpaid / (economics.term.projected || 1)) * 100);

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
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Finance Hub</span>
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

        {/* NORTH STAR METRICS */}
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
               <span className="text-white bg-white/10 px-3 py-1 rounded-lg border border-white/5">
                 {economics.activePaidParents} / {economics.totalInvoicedParentsCount} Parents
               </span>
            </div>
          </div>
        </div>

        {/* ====================================================
            TERM REVENUE REALIZATION (WITH STACKED PROGRESS)
            ==================================================== */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
           <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-blue-500/5 to-transparent pointer-events-none" />
           
           <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center">
             <div className="flex-1 w-full space-y-6">
               <div>
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                   <Layers className="text-blue-500"/> Term Revenue Pipeline
                 </h2>
                 <p className="text-slate-400 text-sm font-medium mt-1">Tracking actual cash collected vs pending invoices against term targets.</p>
               </div>
               
               <div>
                  <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-4">
                    
                    <div className="flex flex-wrap gap-6 md:gap-10">
                      {/* COLLECTED STAT */}
                      <div 
                        onClick={() => setDrilldown({ title: "Cash Realized (Term)", mode: 'collected', filter: 'all' })}
                        className="group cursor-pointer p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <p className="text-4xl font-black tracking-tighter text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                          R {Math.round(economics.term.coreCollected).toLocaleString()} <Search size={20} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mt-1">Collected (Core)</p>
                        {economics.term.otherCollected > 0 && (
                           <div className="mt-2 flex items-center gap-1.5 bg-slate-800 text-slate-300 w-fit px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border border-slate-700">
                             <Package size={10} /> + R {Math.round(economics.term.otherCollected).toLocaleString()} Extra
                           </div>
                        )}
                      </div>

                      {/* INVOICED PENDING STAT */}
                      <div 
                        onClick={() => setDrilldown({ title: "Pending Cash (Term)", mode: 'unpaid', filter: 'all' })}
                        className="group cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors flex flex-col justify-end"
                      >
                        <p className="text-3xl font-black tracking-tighter text-slate-300 group-hover:text-amber-400 transition-colors flex items-center gap-2">
                          R {Math.round(economics.term.coreUnpaid).toLocaleString()} <Search size={18} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mt-1 flex items-center gap-1"><Clock size={10}/> Pending (Invoiced)</p>
                        {economics.term.otherUnpaid > 0 && (
                           <div className="mt-2 flex items-center gap-1.5 bg-slate-800 text-slate-300 w-fit px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border border-slate-700">
                             <Package size={10} /> + R {Math.round(economics.term.otherUnpaid).toLocaleString()} Extra
                           </div>
                        )}
                      </div>
                    </div>

                    {/* TARGET STAT */}
                    <div 
                      onClick={() => setDrilldown({ title: "Term Target (Expected)", mode: 'projected', filter: 'all' })}
                      className="text-right group cursor-pointer p-2 -mr-2 rounded-xl hover:bg-white/5 transition-colors flex flex-col items-end"
                    >
                      <p className="text-2xl font-bold tracking-tighter text-slate-500 group-hover:text-white transition-colors flex items-center gap-2">
                        <Search size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-white" /> R {economics.term.projected.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mt-1">Term Projection</p>
                    </div>
                  </div>

                  {/* STACKED PROGRESS BAR */}
                  <div className="w-full h-3 bg-[#020617] rounded-full overflow-hidden border border-white/5 flex">
                     <motion.div 
                       initial={{ width: 0 }} 
                       animate={{ width: `${pctCollected}%` }} 
                       transition={{ duration: 1.5, ease: "easeOut" }}
                       className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] border-r border-black/20 relative z-20" 
                     />
                     <motion.div 
                       initial={{ width: 0 }} 
                       animate={{ width: `${pctUnpaid}%` }} 
                       transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                       className="h-full bg-gradient-to-r from-amber-500 to-amber-400 opacity-90 shadow-[0_0_15px_rgba(245,158,11,0.3)] relative z-10" 
                     />
                  </div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs font-bold text-amber-500">{(pctCollected + pctUnpaid).toFixed(1)}% Pipeline Generated</p>
                    <p className="text-xs font-bold text-blue-400">{pctCollected.toFixed(1)}% Cash Realized</p>
                  </div>
               </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto shrink-0">
               {/* MONTHLY CARD */}
               <div 
                 onClick={() => setDrilldown({ title: "Monthly Realization", mode: 'collected', filter: 'monthly' })}
                 className="group bg-[#020617] border border-white/5 p-6 rounded-3xl w-full sm:w-48 shadow-inner hover:border-blue-500/50 cursor-pointer transition-colors relative flex flex-col justify-between"
               >
                  <Search size={16} className="absolute right-4 top-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"/>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between">
                      Monthly <span className="bg-white/10 text-white px-2 py-0.5 rounded-md">{economics.term.monthlyCount}</span>
                    </p>
                    <p className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">R {Math.round(economics.term.monthlyCoreCollected).toLocaleString()}</p>
                    {economics.term.monthlyCoreUnpaid > 0 && <p className="text-[10px] font-bold text-amber-500 mt-1">+ R{Math.round(economics.term.monthlyCoreUnpaid).toLocaleString()} Pending</p>}
                    <p className="text-[9px] font-bold text-slate-600 mt-1">/ R {(economics.term.monthlyCount * 2250).toLocaleString()}</p>
                  </div>
                  
                  <div className="mt-4 border-t border-white/5 pt-3 space-y-1.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">R 750 × 3 Months</p>
                    {(economics.term.monthlyOtherCollected > 0 || economics.term.monthlyOtherUnpaid > 0) && (
                      <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1"><Package size={8}/> Add-ons Purchased</p>
                    )}
                  </div>
               </div>

               {/* UPFRONT CARD */}
               <div 
                 onClick={() => setDrilldown({ title: "Upfront Realization", mode: 'collected', filter: 'upfront' })}
                 className="group bg-[#020617] border border-white/5 p-6 rounded-3xl w-full sm:w-48 shadow-inner hover:border-blue-500/50 cursor-pointer transition-colors relative flex flex-col justify-between"
               >
                  <Search size={16} className="absolute right-4 top-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"/>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between">
                      Upfront <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md">{economics.term.upfrontCount}</span>
                    </p>
                    <p className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">R {Math.round(economics.term.upfrontCoreCollected).toLocaleString()}</p>
                    {economics.term.upfrontCoreUnpaid > 0 && <p className="text-[10px] font-bold text-amber-500 mt-1">+ R{Math.round(economics.term.upfrontCoreUnpaid).toLocaleString()} Pending</p>}
                    <p className="text-[9px] font-bold text-slate-600 mt-1">/ R {(economics.term.upfrontCount * 2000).toLocaleString()}</p>
                  </div>
                  
                  <div className="mt-4 border-t border-white/5 pt-3 space-y-1.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-blue-500/50">R 250 Discount Applied</p>
                    {(economics.term.upfrontOtherCollected > 0 || economics.term.upfrontOtherUnpaid > 0) && (
                      <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1"><Package size={8}/> Add-ons Purchased</p>
                    )}
                  </div>
               </div>
             </div>
           </div>
        </div>

        {/* COHORT LEADERBOARD */}
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
                  <div className={`absolute -right-6 -top-10 text-[180px] font-black italic leading-none opacity-5 select-none ${index === 0 ? 'text-emerald-500' : 'text-white'}`}>
                    {index + 1}
                  </div>

                  {index === 0 && <Crown className="absolute top-8 right-8 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" size={32} strokeWidth={2}/>}
                  
                  <div className="relative z-10 space-y-8">
                    
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${index === 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                          Rank 0{index + 1}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> {cohort.count} Active</span>
                      </div>
                      <h3 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white leading-none">{cohort.name}</h3>
                    </div>

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
                      
                      <div className="w-full h-2 bg-[#020617] rounded-full overflow-hidden border border-white/5 relative">
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

      {/* DRILL DOWN MODAL */}
      <AnimatePresence>
        {drilldown && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrilldown(null)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="relative bg-[#0f172a] border border-white/10 rounded-[48px] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-8 md:p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl border ${drilldown.mode === 'unpaid' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'}`}>
                    <Search size={28} />
                  </div>
                  <div>
                      <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Mathematical Proof</h2>
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-2 ${drilldown.mode === 'unpaid' ? 'text-amber-500' : 'text-blue-400'}`}>{drilldown.title}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setDrilldown(null)} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-4">Parent Name</th>
                      <th className="px-4 py-4 text-center">Billing Plan</th>
                      <th className={`px-4 py-4 text-right transition-colors ${drilldown.mode === 'projected' ? 'text-white bg-white/5 rounded-t-xl' : ''}`}>Projected Target</th>
                      <th className={`px-4 py-4 text-right transition-colors ${drilldown.mode === 'collected' ? 'text-blue-400 bg-blue-500/10 rounded-t-xl' : ''}`}>Actually Collected</th>
                      <th className={`px-4 py-4 text-right transition-colors ${drilldown.mode === 'unpaid' ? 'text-amber-400 bg-amber-500/10 rounded-t-xl' : ''}`}>Invoiced (Pending)</th>
                      <th className="px-4 py-4 text-right">Other Add-ons</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayedDrilldown.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-500 italic">No parents match this filter.</td></tr>
                    ) : (
                      displayedDrilldown.map((p, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-4 py-5 font-bold text-white">{p.name}</td>
                          <td className="px-4 py-5 text-center">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${p.isUpfront ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                              {p.isUpfront ? 'Upfront' : 'Monthly'}
                            </span>
                          </td>
                          <td className={`px-4 py-5 text-right font-mono transition-colors ${drilldown.mode === 'projected' ? 'text-white bg-white/5 font-black' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            R {p.projected.toLocaleString()}
                          </td>
                          <td className={`px-4 py-5 text-right font-mono transition-colors ${drilldown.mode === 'collected' ? 'text-blue-400 bg-blue-500/10 font-black' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            R {Math.round(p.collectedCore).toLocaleString()}
                          </td>
                          <td className={`px-4 py-5 text-right font-mono transition-colors ${drilldown.mode === 'unpaid' ? 'text-amber-400 bg-amber-500/10 font-black' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            {p.unpaidCore > 0 ? `R ${Math.round(p.unpaidCore).toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-5 text-right font-mono text-slate-500">
                            {(p.collectedOther > 0 || p.unpaidOther > 0) ? `R ${Math.round(p.collectedOther + p.unpaidOther).toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/40 flex flex-wrap justify-between items-center gap-8 shrink-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtered Count: <span className="text-white">{displayedDrilldown.length} Parents</span></p>
                <div className="text-right flex items-center gap-6">
                   <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Sum Projected</p>
                     <p className={`text-xl font-black ${drilldown.mode === 'projected' ? 'text-white' : 'text-slate-500'}`}>R {displayedDrilldown.reduce((sum, p) => sum + p.projected, 0).toLocaleString()}</p>
                   </div>
                   <div className="h-10 w-px bg-white/10" />
                   <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-blue-600/50 mb-1">Sum Collected</p>
                     <p className={`text-xl font-black ${drilldown.mode === 'collected' ? 'text-blue-400' : 'text-slate-500'}`}>R {Math.round(displayedDrilldown.reduce((sum, p) => sum + p.collectedCore, 0)).toLocaleString()}</p>
                   </div>
                   <div className="h-10 w-px bg-white/10" />
                   <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-amber-600/50 mb-1">Sum Pending</p>
                     <p className={`text-xl font-black ${drilldown.mode === 'unpaid' ? 'text-amber-400' : 'text-slate-500'}`}>R {Math.round(displayedDrilldown.reduce((sum, p) => sum + p.unpaidCore, 0)).toLocaleString()}</p>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}