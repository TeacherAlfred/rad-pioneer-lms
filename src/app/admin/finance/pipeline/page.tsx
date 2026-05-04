"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, FileText, Search, Loader2, Send, MessageCircle, X, 
  CheckCircle2, Clock, CalendarDays, XCircle, Crown, Receipt, Tag, Coins, Percent, ArrowRight, TrendingUp
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const formatWhatsAppNumber = (phone: string) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, ''); 
  if (cleaned.startsWith('0')) {
    cleaned = '27' + cleaned.substring(1); 
  }
  return cleaned;
};

export default function PipelineDashboard() {
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [billingItems, setBillingItems] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  
  // Modals & Drawers
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppBody, setWhatsAppBody] = useState("");
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState<any>(null);

  useEffect(() => {
    fetchPipelineData();
  }, []);

  async function fetchPipelineData() {
    setLoading(true);
    try {
      // Fetch Quotes
      const { data: quoteData } = await supabase
        .from('billing_records')
        .select(`*, profiles(display_name)`)
        .eq('doc_type', 'quote')
        .order('created_at', { ascending: false });
        
      // Fetch Billing Items for COGS/Profit calculation
      const { data: itemsData } = await supabase
        .from('billing_items')
        .select('name, cost, aliases');

      if (quoteData) setQuotes(quoteData);
      if (itemsData) setBillingItems(itemsData);
    } catch (err) {
      console.error("Failed to fetch pipeline data:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- CORE DATA PROCESSING (Fuzzy Matching for Profit) ---
  const itemCostMap = useMemo(() => {
    const map: Record<string, number> = {};
    billingItems.forEach(i => {
      const cost = Number(i.cost) || 0;
      
      if (i.name) map[i.name.toLowerCase().trim()] = cost;
      
      if (i.aliases && Array.isArray(i.aliases)) {
        i.aliases.forEach((alias: string) => {
          if (alias) map[alias.toLowerCase().trim()] = cost;
        });
      }
    });
    return map;
  }, [billingItems]);

  const processedQuotes = useMemo(() => {
    const nowMs = Date.now();

    // --- NEW: Remove manually expired and superseded quotes from the active pipeline ---
    const activePipelineQuotes = quotes.filter(q => q.status !== 'expired' && q.status !== 'superseded');

    return activePipelineQuotes.map(q => {
      let profit = 0;
      let parsedLineItems: any[] = [];

      // SAFE JSON PARSING
      if (Array.isArray(q.line_items)) {
        parsedLineItems = q.line_items;
      } else if (typeof q.line_items === 'string') {
        try {
          parsedLineItems = JSON.parse(q.line_items);
          if (!Array.isArray(parsedLineItems)) parsedLineItems = [];
        } catch (e) {
          parsedLineItems = [];
        }
      }

      parsedLineItems.forEach((li: any) => {
        const rawDesc = li.desc || li.description || "";
        const searchKey = rawDesc.toLowerCase().trim();
        
        const cost = itemCostMap[searchKey] || 0;
        const price = Number(li.price) || 0;
        const qty = Number(li.qty) || 0;
        const disc = Math.max(0, Number(li.disc || 0));
        
        const netPrice = price * (1 - disc / 100);
        profit += (netPrice - cost) * qty;
      });

      const totalAmt = Number(q.total_amount) || 0;
      const marginPct = totalAmt > 0 ? (profit / totalAmt) * 100 : 0;

      // Calculate if the quote passed its expiry date but hasn't been manually cleared
      const isExpired = q.status === 'pending' && q.expires_at && new Date(q.expires_at).getTime() < nowMs;

      return { ...q, profit, marginPct, line_items: parsedLineItems, isExpired };
    });
  }, [quotes, itemCostMap]);


  // --- ANALYTICS & TOP 20% CALCULATION ---
  const pipelineStats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const pending = processedQuotes.filter(q => q.status === 'pending');
    const accepted = processedQuotes.filter(q => q.status === 'accepted' || q.status === 'invoiced');
    const declined = processedQuotes.filter(q => q.status === 'declined');
    const past7Days = processedQuotes.filter(q => new Date(q.created_at) >= sevenDaysAgo);

    const quotesWithProfit = [...pending];
    quotesWithProfit.sort((a, b) => b.profit - a.profit);
    
    const top20Count = Math.max(1, Math.ceil(quotesWithProfit.length * 0.2));
    const topQuotes = quotesWithProfit.slice(0, top20Count).filter(q => q.profit > 0);

    let cumulativeProfit = 0;
    let paretoRevenue = 0;
    const paretoIds = new Set<string>();

    for (const q of topQuotes) {
      paretoIds.add(q.id);
      cumulativeProfit += q.profit;
      paretoRevenue += Number(q.total_amount);
    }

    return {
      totalValue: processedQuotes.reduce((sum, q) => sum + Number(q.total_amount), 0),
      pendingValue: pending.reduce((sum, q) => sum + Number(q.total_amount), 0),
      acceptedValue: accepted.reduce((sum, q) => sum + Number(q.total_amount), 0),
      declinedValue: declined.reduce((sum, q) => sum + Number(q.total_amount), 0),
      past7DaysValue: past7Days.reduce((sum, q) => sum + Number(q.total_amount), 0),
      paretoValue: paretoRevenue,
      paretoProfit: cumulativeProfit,

      pendingCount: pending.length,
      acceptedCount: accepted.length,
      declinedCount: declined.length,
      past7DaysCount: past7Days.length,
      paretoCount: paretoIds.size,
      paretoIds
    };
  }, [processedQuotes]);

  // --- FILTERING ENGINE ---
  const filteredQuotes = useMemo(() => {
    let result = [...processedQuotes];

    if (activeFilter === 'past7') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter(q => new Date(q.created_at) >= sevenDaysAgo);
    } else if (activeFilter === 'accepted') {
      result = result.filter(q => q.status === 'accepted' || q.status === 'invoiced');
    } else if (activeFilter === 'pending') {
      result = result.filter(q => q.status === 'pending');
    } else if (activeFilter === 'declined') {
      result = result.filter(q => q.status === 'declined');
    } else if (activeFilter === 'pareto') {
      result = result.filter(q => pipelineStats.paretoIds.has(q.id));
    }

    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(q => {
        const name = q.profiles?.display_name || q.metadata?.prospect_name || "";
        const email = q.metadata?.prospect_email || "";
        const ref = `QT-${q.invoice_number}`;
        return name.toLowerCase().includes(lowerQ) || email.toLowerCase().includes(lowerQ) || ref.toLowerCase().includes(lowerQ);
      });
    }

    if (activeFilter === 'pareto') {
      result.sort((a, b) => b.profit - a.profit);
    }

    return result;
  }, [processedQuotes, searchQuery, activeFilter, pipelineStats.paretoIds]);

  // --- ACTIONS ---
  const openQuoteDrawer = (quote: any) => {
    setActiveQuote(quote);
    setIsDrawerOpen(true);
  };

  const handleMarkExpired = async () => {
    if (!activeQuote) return;
    try {
      await supabase.from('billing_records').update({ status: 'expired' }).eq('id', activeQuote.id);
      
      // Update local state directly so it drops out of processedQuotes immediately
      setQuotes(quotes.map(q => q.id === activeQuote.id ? { ...q, status: 'expired' } : q));
      setIsDrawerOpen(false);
    } catch (e) {
      console.error("Failed to expire quote:", e);
      alert("Failed to mark quote as expired.");
    }
  };

  const openWhatsAppComposer = (quote: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const parentName = quote.profiles?.display_name || quote.metadata?.prospect_name || "Parent";
    const firstName = parentName.split(' ')[0];
    const amount = Number(quote.total_amount).toLocaleString();
    const link = `${window.location.origin}/quote/${quote.id}`;
    
    const defaultMessage = `Hi ${firstName},\n\nHere is the quotation (QT-${quote.invoice_number}) from RAD Academy for R ${amount}.\n\nYou can review the details and accept it directly online here:\n${link}\n\nLet me know if you have any questions!\n\nBest,\nRAD Academy`;
    
    setWhatsAppBody(defaultMessage);
    setActiveQuote(quote);
    setIsWhatsAppModalOpen(true);
    setIsDrawerOpen(false); 
  };

  const dispatchWhatsApp = () => {
    if (!activeQuote) return;
    
    const rawPhone = activeQuote.metadata?.prospect_phone 
                  || activeQuote.metadata?.phone 
                  || activeQuote.profiles?.metadata?.phone 
                  || activeQuote.profiles?.phone 
                  || activeQuote.phone
                  || "";

    const formattedNumber = formatWhatsAppNumber(rawPhone);
    
    if (!formattedNumber) {
      alert("No valid phone number found for this lead.");
      return;
    }

    const encodedMessage = encodeURIComponent(whatsAppBody);
    window.open(`https://wa.me/${formattedNumber}?text=${encodedMessage}`, '_blank');
    setIsWhatsAppModalOpen(false);
  };

  const toggleFilter = (filterName: string) => {
    setActiveFilter(prev => prev === filterName ? null : filterName);
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-purple-400 font-black uppercase tracking-widest text-[10px]">Analyzing_Pipeline...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-purple-500/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div className="space-y-4">
            <Link href="/admin/finance" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-purple-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-purple-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Finance Hub</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-500">
                <FileText size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sales_Pipeline_Active</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Quote_<span className="text-purple-500">Pipeline</span>
              </h1>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
             <div className="bg-white/5 p-4 rounded-3xl border border-white/10 flex flex-col justify-center text-right shadow-inner">
               <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Pipeline</p>
               <p className="text-2xl md:text-3xl font-black italic text-slate-300">R {pipelineStats.totalValue.toLocaleString()}</p>
               <p className="text-[10px] font-bold text-slate-500 mt-1">{quotes.length} Total Quotes</p>
             </div>
             <div className="bg-white/5 p-4 rounded-3xl border border-white/10 flex flex-col justify-center text-right shadow-inner">
               <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Pending Value</p>
               <p className="text-2xl md:text-3xl font-black italic text-purple-400">R {pipelineStats.pendingValue.toLocaleString()}</p>
               <p className="text-[10px] font-bold text-purple-400/60 mt-1">{pipelineStats.pendingCount} Active Quotes</p>
             </div>
          </div>
        </header>

        {/* CLICKABLE STAT CARDS (FILTERS) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          
          <div 
            onClick={() => toggleFilter('past7')}
            className={`cursor-pointer p-5 rounded-3xl border transition-all ${activeFilter === 'past7' ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-[#0f172a] border-white/10 hover:border-white/30 hover:bg-white/5 shadow-xl'}`}
          >
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <CalendarDays size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Past 7 Days</span>
            </div>
            <p className={`text-2xl font-black tracking-tighter ${activeFilter === 'past7' ? 'text-blue-300' : 'text-white'}`}>R {pipelineStats.past7DaysValue.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{pipelineStats.past7DaysCount} Quotes</p>
          </div>

          <div 
            onClick={() => toggleFilter('accepted')}
            className={`cursor-pointer p-5 rounded-3xl border transition-all ${activeFilter === 'accepted' ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-[#0f172a] border-white/10 hover:border-white/30 hover:bg-white/5 shadow-xl'}`}
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <CheckCircle2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Accepted</span>
            </div>
            <p className={`text-2xl font-black tracking-tighter ${activeFilter === 'accepted' ? 'text-emerald-300' : 'text-white'}`}>R {pipelineStats.acceptedValue.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{pipelineStats.acceptedCount} Quotes</p>
          </div>

          <div 
            onClick={() => toggleFilter('pending')}
            className={`cursor-pointer p-5 rounded-3xl border transition-all ${activeFilter === 'pending' ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-[#0f172a] border-white/10 hover:border-white/30 hover:bg-white/5 shadow-xl'}`}
          >
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Clock size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Pending</span>
            </div>
            <p className={`text-2xl font-black tracking-tighter ${activeFilter === 'pending' ? 'text-amber-300' : 'text-white'}`}>R {pipelineStats.pendingValue.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{pipelineStats.pendingCount} Quotes</p>
          </div>

          <div 
            onClick={() => toggleFilter('declined')}
            className={`cursor-pointer p-5 rounded-3xl border transition-all ${activeFilter === 'declined' ? 'bg-rose-500/20 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'bg-[#0f172a] border-white/10 hover:border-white/30 hover:bg-white/5 shadow-xl'}`}
          >
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <XCircle size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Declined</span>
            </div>
            <p className={`text-2xl font-black tracking-tighter ${activeFilter === 'declined' ? 'text-rose-300' : 'text-white'}`}>R {pipelineStats.declinedValue.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{pipelineStats.declinedCount} Quotes</p>
          </div>

          <div 
            onClick={() => toggleFilter('pareto')}
            className={`col-span-2 md:col-span-1 cursor-pointer p-5 rounded-3xl border transition-all relative overflow-hidden ${activeFilter === 'pareto' ? 'bg-purple-500/20 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'bg-gradient-to-br from-[#0f172a] to-purple-900/10 border-purple-500/20 hover:border-purple-500/50 shadow-xl'}`}
          >
            <div className="absolute right-[-10px] bottom-[-10px] opacity-10"><Crown size={80}/></div>
            <div className="flex items-center gap-2 text-purple-400 mb-2 relative z-10">
              <Crown size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Top 20% Profit Target</span>
            </div>
            <p className={`text-2xl font-black tracking-tighter relative z-10 ${activeFilter === 'pareto' ? 'text-purple-300' : 'text-white'}`}>R {pipelineStats.paretoValue.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-purple-300/60 mt-1 relative z-10">Top {pipelineStats.paretoCount} High-Margin Quotes</p>
          </div>

        </div>

        {/* WORKSPACE & TABLE */}
        <div className="bg-[#0f172a] border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search quotes by name or ref..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#020617] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-purple-500 transition-all shadow-inner"
              />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
               Showing {filteredQuotes.length} Result{filteredQuotes.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#020617] text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                <tr>
                  <th className="px-6 py-5">Reference</th>
                  <th className="px-6 py-5">Lead / Client</th>
                  <th className="px-6 py-5">Date Issued</th>
                  <th className="px-6 py-5">Total Value</th>
                  <th className="px-6 py-5">Est. Profit</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQuotes.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-bold italic">No quotes found matching your current filters.</td></tr>
                ) : (
                  filteredQuotes.map((q) => {
                    const name = q.profiles?.display_name || q.metadata?.prospect_name || "Unknown Lead";
                    const isPending = q.status === 'pending';
                    const isPareto = pipelineStats.paretoIds.has(q.id);
                    
                    return (
                      <tr 
                        key={q.id} 
                        onClick={() => openQuoteDrawer(q)}
                        className="hover:bg-white/[0.04] transition-colors group relative cursor-pointer"
                      >
                        <td className="px-6 py-5 font-mono text-xs font-bold text-slate-300">
                          <div className="flex items-center gap-2">
                             QT-{q.invoice_number}
                             {isPending && isPareto && (
                               <span title="Top 20% Profit Margin" className="text-purple-500"><Crown size={12}/></span>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-5 font-bold text-white">{name}</td>
                        <td className="px-6 py-5 text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-5 font-black text-white">R {Number(q.total_amount).toLocaleString()}</td>
                        
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-emerald-400">R {Math.round(q.profit).toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {q.marginPct.toFixed(0)}%
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                            q.status === 'invoiced' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                            q.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            q.status === 'declined' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            q.isExpired ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {q.status === 'invoiced' ? 'Accepted & Invoiced' : q.isExpired ? 'Expired (Review)' : q.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <a 
                               href={`/quote/${q.id}`} 
                               target="_blank" 
                               onClick={(e) => e.stopPropagation()} 
                               className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" 
                               title="View Web Quote"
                             >
                               <FileText size={16} />
                             </a>
                             {isPending && (
                               <button 
                                 onClick={(e) => openWhatsAppComposer(q, e)}
                                 className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg border border-green-500/20 transition-colors text-[10px] font-black uppercase tracking-widest"
                               >
                                 <MessageCircle size={14} /> Send
                               </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* --- QUOTE INSPECTOR DRAWER (SIDE PANEL) --- */}
      <AnimatePresence>
        {isDrawerOpen && activeQuote && (
          <div className="fixed inset-0 z-[100] flex justify-end">
             {/* Backdrop */}
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
               onClick={() => setIsDrawerOpen(false)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
             />
             
             {/* Drawer Content */}
             <motion.div 
               initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
               transition={{ type: "spring", damping: 25, stiffness: 200 }}
               className="relative w-full max-w-2xl bg-[#0f172a] border-l border-white/10 h-full flex flex-col shadow-2xl z-10"
             >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-white/5 bg-black/20 flex justify-between items-start shrink-0">
                   <div>
                     <div className="flex items-center gap-3 mb-2">
                       <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                            activeQuote.status === 'invoiced' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                            activeQuote.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            activeQuote.status === 'declined' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            activeQuote.isExpired ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {activeQuote.status === 'invoiced' ? 'Accepted & Invoiced' : activeQuote.isExpired ? 'Expired (Review)' : activeQuote.status}
                       </span>
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">QT-{activeQuote.invoice_number}</span>
                     </div>
                     <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                       {activeQuote.profiles?.display_name || activeQuote.metadata?.prospect_name || "Unknown Lead"}
                     </h2>
                     <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-3">
                       <span>{activeQuote.metadata?.prospect_email || "No Email"}</span>
                       <span>{activeQuote.metadata?.prospect_phone || activeQuote.metadata?.phone || "No Phone"}</span>
                     </p>
                   </div>
                   <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                     <X size={20} />
                   </button>
                </div>

                {/* Economics Summary */}
                <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5 bg-[#020617] shrink-0">
                   <div className="p-4 md:p-6 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center justify-center gap-1"><Coins size={12}/> Revenue</p>
                      <p className="text-xl font-black text-white tracking-tighter">R {Number(activeQuote.total_amount).toLocaleString()}</p>
                   </div>
                   <div className="p-4 md:p-6 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70 mb-1 flex items-center justify-center gap-1"><TrendingUp size={12}/> Est. Profit</p>
                      <p className="text-xl font-black text-emerald-400 tracking-tighter">R {Math.round(activeQuote.profit).toLocaleString()}</p>
                   </div>
                   <div className="p-4 md:p-6 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-1 flex items-center justify-center gap-1"><Percent size={12}/> Margin</p>
                      <p className="text-xl font-black text-purple-400 tracking-tighter">{activeQuote.marginPct.toFixed(1)}%</p>
                   </div>
                </div>

                {/* Line Items Detail */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Tag size={16}/> Line Item Economics</h3>
                   <div className="space-y-4">
                     {activeQuote.line_items?.map((li: any, idx: number) => {
                        const rawDesc = li.desc || li.description || "";
                        const searchKey = rawDesc.toLowerCase().trim();
                        
                        const cost = itemCostMap[searchKey] || 0;
                        const price = Number(li.price) || 0;
                        const qty = Number(li.qty) || 0;
                        const disc = Math.max(0, Number(li.disc || 0));
                        const netPrice = price * (1 - disc / 100);
                        
                        const itemProfit = (netPrice - cost) * qty;
                        const itemMargin = netPrice > 0 ? ((netPrice - cost) / netPrice) * 100 : 0;

                        return (
                          <div key={idx} className="bg-[#020617] border border-white/5 rounded-2xl p-5 shadow-inner">
                             <div className="flex justify-between items-start mb-4">
                               <p className="font-bold text-sm text-white pr-4">{rawDesc}</p>
                               <span className="text-[10px] font-black uppercase tracking-widest bg-white/5 text-slate-400 px-2 py-1 rounded">Qty {qty}</span>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Unit Economics</p>
                                   <div className="flex justify-between items-center text-slate-400"><span className="font-medium">Cost:</span> <span>R {cost.toLocaleString()}</span></div>
                                   <div className="flex justify-between items-center text-slate-300"><span className="font-medium">Selling (Net):</span> <span>R {netPrice.toLocaleString()}</span></div>
                                   {disc > 0 && <div className="flex justify-between items-center text-amber-500/70"><span className="font-medium">Discount Applied:</span> <span>{disc}%</span></div>}
                                </div>
                                <div className="text-right border-l border-white/5 pl-4 flex flex-col justify-end">
                                   <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70 mb-0.5">Line Profit</p>
                                   <p className="text-lg font-black text-emerald-400 tracking-tighter leading-none">R {Math.round(itemProfit).toLocaleString()}</p>
                                   <p className="text-[9px] font-bold text-emerald-500/50 mt-1">{itemMargin.toFixed(1)}% Margin</p>
                                </div>
                             </div>
                          </div>
                        )
                     })}
                   </div>

                   {/* Contextual Info */}
                   <div className="mt-8 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 flex items-center gap-2"><Crown size={14}/> Top 20% Analysis</p>
                      <p className="text-xs font-medium text-purple-300/80 leading-relaxed">
                        {pipelineStats.paretoIds.has(activeQuote.id) 
                          ? "This quote is part of your top 20% highest-margin deals. Following up and securing this lead directly impacts your primary bottom line."
                          : "This quote falls outside the top 20% of your potential profit pool. It is valuable revenue, but prioritize higher-margin deals first."
                        }
                      </p>
                   </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/5 bg-black/40 flex flex-wrap gap-3 shrink-0">
                   <a 
                     href={`/quote/${activeQuote.id}`} 
                     target="_blank" 
                     className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-colors border border-white/10"
                   >
                     <FileText size={14}/> Web Quote
                   </a>
                   {activeQuote.status === 'pending' && (
                     <>
                       <button 
                         onClick={handleMarkExpired}
                         className="px-4 py-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center transition-all border border-rose-500/20"
                         title="Mark as Expired (Remove from active Pipeline)"
                       >
                         <XCircle size={16}/>
                       </button>
                       <button 
                         onClick={() => openWhatsAppComposer(activeQuote)}
                         className="flex-[2] py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20"
                       >
                         <MessageCircle size={14}/> WhatsApp Follow-up
                       </button>
                     </>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WHATSAPP COMPOSER MODAL (Layered on top of Drawer if needed) */}
      <AnimatePresence>
        {isWhatsAppModalOpen && activeQuote && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{opacity: 0, scale: 0.95}} 
              animate={{opacity: 1, scale: 1}} 
              exit={{opacity: 0, scale: 0.95}} 
              className="bg-[#0f172a] border border-white/10 rounded-[32px] p-8 max-w-lg w-full shadow-2xl flex flex-col"
            >
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2 text-white">
                   <MessageCircle className="text-green-500" /> Dispatch Quote
                 </h2>
                 <button onClick={() => setIsWhatsAppModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
               </div>
               
               <div className="mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-start">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Target Lead</p>
                   <p className="text-sm font-bold text-white">{activeQuote.profiles?.display_name || activeQuote.metadata?.prospect_name}</p>
                   <p className="text-xs font-mono text-slate-400 mt-1">Ref: QT-{activeQuote.invoice_number}</p>
                 </div>
                 {pipelineStats.paretoIds.has(activeQuote.id) && (
                   <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                     <Crown size={10}/> High Value
                   </span>
                 )}
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Message Body</label>
                 <textarea 
                   value={whatsAppBody}
                   onChange={e => setWhatsAppBody(e.target.value)}
                   className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 text-sm font-medium text-slate-300 outline-none focus:border-green-500 resize-none min-h-[200px] custom-scrollbar"
                 />
                 <p className="text-[9px] text-slate-500 italic ml-2">This will open WhatsApp Web/Desktop with the message pre-filled.</p>
               </div>
               
               <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/5">
                 <button onClick={() => setIsWhatsAppModalOpen(false)} className="px-6 py-4 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                   Cancel
                 </button>
                 <button onClick={dispatchWhatsApp} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20">
                   <Send size={16}/> Send via WhatsApp
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}