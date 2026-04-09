"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, CreditCard, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, Filter, Search, Download, UserPlus,
  Plus, ChevronRight, Wallet, Receipt, Loader2, Activity, X, Shield, FileText, Printer, BarChart3, Package, FilterX, User, Target
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Import your components
import RADBillingDocument from "@/components/finance/RADBillingDocument";
import RADStatement from "@/components/finance/RADStatement";

export default function FinancePortal() {
  const router = useRouter(); 
  const [loading, setLoading] = useState(true);
  
  // WORKSPACE STATE
  const [records, setRecords] = useState<any[]>([]);
  const [billingItems, setBillingItems] = useState<any[]>([]);
  const [activeParentsCount, setActiveParentsCount] = useState(0);
  
  const [activeDoc, setActiveDoc] = useState<{ type: 'invoice' | 'statement' | 'quote', data: any } | null>(null);
  const [activeProspect, setActiveProspect] = useState<any | null>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // FILTERING & SEARCH STATE
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchFinanceData();
  }, []);

  async function fetchFinanceData() {
    setLoading(true);
    try {
      const { data: recordsData } = await supabase
        .from('billing_records')
        .select(`*, profiles(display_name)`)
        .order('created_at', { ascending: false });
        
      const { data: itemsData } = await supabase.from('billing_items').select('*');

      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'lead']);

      if (recordsData) setRecords(recordsData);
      if (itemsData) setBillingItems(itemsData);
      if (count !== null) setActiveParentsCount(count);
      
    } catch (err) {
      console.error("Failed to fetch finance engine data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // REAL-TIME ANALYTICS ENGINE
  // ==========================================
  const analytics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const quotes = records.filter(r => r.doc_type === 'quote');
    const invoices = records.filter(r => r.doc_type === 'invoice');

    const quotesToday = quotes.filter(q => new Date(q.created_at) >= startOfToday).length;
    const quotesWeek = quotes.filter(q => new Date(q.created_at) >= startOfWeek).length;
    const quotesMonth = quotes.filter(q => new Date(q.created_at) >= startOfMonth);
    
    const validQuotes = quotes.filter(q => q.status === 'pending' && (!q.expires_at || new Date(q.expires_at) >= now));
    const expiredQuotes = quotes.filter(q => q.status === 'pending' && q.expires_at && new Date(q.expires_at) < now);
    const declinedQuotes = quotes.filter(q => q.status === 'declined');

    const itemCostMap = Object.fromEntries(billingItems.map(i => [i.name, Number(i.cost) || 0]));

    let openQuotesGP = 0;
    validQuotes.forEach(q => {
      q.line_items?.forEach((li: any) => {
        const cost = itemCostMap[li.desc] || 0;
        const price = Number(li.price) || 0;
        const qty = Number(li.qty) || 0;
        const disc = Math.max(0, Number(li.disc || 0));
        const netPrice = price * (1 - disc / 100);
        openQuotesGP += (netPrice - cost) * qty;
      });
    });
    const avgGPPerQuote = validQuotes.length > 0 ? (openQuotesGP / validQuotes.length) : 0;

    let quotesTotalValue = 0;
    let acceptedQuotesCount = 0;
    let acceptedQuotesValue = 0;

    quotes.forEach(q => {
       const amt = Number(q.total_amount) || 0;
       quotesTotalValue += amt;
       if (q.status === 'accepted') {
          acceptedQuotesCount++;
          acceptedQuotesValue += amt;
       }
    });

    let monthGeneratedInvTotal = 0;
    let monthOutstandingInvTotal = 0;
    let totalInvoicedLifetime = 0;
    let totalPaidLifetime = 0;

    invoices.forEach(inv => {
      const dueDate = inv.expires_at ? new Date(inv.expires_at) : new Date(new Date(inv.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
      const isDueThisMonth = dueDate >= startOfMonth && dueDate.getMonth() === now.getMonth();
      const amount = Number(inv.total_amount) || 0;

      totalInvoicedLifetime += amount;
      if (inv.status === 'paid' || inv.status === 'settled') totalPaidLifetime += amount;

      if (isDueThisMonth) {
        monthGeneratedInvTotal += amount;
        if (inv.status !== 'paid' && inv.status !== 'settled') monthOutstandingInvTotal += amount;
      }
    });

    const collectionRate = totalInvoicedLifetime > 0 ? (totalPaidLifetime / totalInvoicedLifetime) * 100 : 0;
    const avgMonthlyPerParent = activeParentsCount > 0 ? (totalPaidLifetime / activeParentsCount) : 0;

    const itemStats: Record<string, { qty: number, gp: number }> = {};
    invoices.forEach(inv => {
      if (inv.status === 'paid' || inv.status === 'settled') {
        inv.line_items?.forEach((li: any) => {
          const desc = li.desc;
          if (!itemStats[desc]) itemStats[desc] = { qty: 0, gp: 0 };
          const cost = itemCostMap[desc] || 0;
          const price = Number(li.price) || 0;
          const qty = Number(li.qty) || 0;
          const disc = Math.max(0, Number(li.disc || 0));
          const netPrice = price * (1 - disc / 100);
          itemStats[desc].qty += qty;
          itemStats[desc].gp += (netPrice - cost) * qty;
        });
      }
    });

    let mostSoldItem = { name: "N/A", qty: 0 };
    let highestGpItem = { name: "N/A", gp: 0 };
    Object.entries(itemStats).forEach(([name, stats]) => {
      if (stats.qty > mostSoldItem.qty) mostSoldItem = { name, qty: stats.qty };
      if (stats.gp > highestGpItem.gp) highestGpItem = { name, gp: stats.gp };
    });

    const quoteToAcceptConversion = quotes.length > 0 ? (acceptedQuotesCount / quotes.length) * 100 : 0;

    return {
      quotes: { total: quotes.length, today: quotesToday, week: quotesWeek, month: quotesMonth.length },
      pipeline: { valid: validQuotes.length, expired: expiredQuotes.length, declined: declinedQuotes.length, avgGp: avgGPPerQuote },
      invoices: { monthGenerated: monthGeneratedInvTotal, monthOutstanding: monthOutstandingInvTotal },
      collections: { rate: collectionRate, activeParents: activeParentsCount, avgPerParent: avgMonthlyPerParent },
      conversion: { 
        quotes: quotes.length, 
        quotesValue: quotesTotalValue,
        acceptedQuotes: acceptedQuotesCount,
        acceptedValue: acceptedQuotesValue,
        invoicesValue: totalInvoicedLifetime,
        paidValue: totalPaidLifetime,
        rate: quoteToAcceptConversion 
      },
      products: { mostSold: mostSoldItem, highestGp: highestGpItem }
    };
  }, [records, billingItems, activeParentsCount]);

  // ==========================================
  // PARETO (80/20) IDENTIFIER ENGINE
  // ==========================================
  // We calculate this independently so we can highlight VIPs even when the filter is off
  const vipQuoteIds = useMemo(() => {
    const pendingQuotes = records.filter(r => r.doc_type === 'quote' && r.status === 'pending');
    // Sort highest value first
    const sortedQuotes = [...pendingQuotes].sort((a, b) => Number(b.total_amount) - Number(a.total_amount));
    const totalPendingValue = sortedQuotes.reduce((sum, q) => sum + Number(q.total_amount), 0);
    const targetValue = totalPendingValue * 0.8; // Target top 80% of revenue value
    
    let cumulative = 0;
    const paretoIds = new Set<string>();
    
    for (const q of sortedQuotes) {
      paretoIds.add(q.id);
      cumulative += Number(q.total_amount);
      if (cumulative >= targetValue) break;
    }
    
    return paretoIds;
  }, [records]);

  // ==========================================
  // TABLE FILTERING & SEARCH LOGIC
  // ==========================================
  const filteredRecords = useMemo(() => {
    let result = [...records]; // Create a shallow copy for sorting later

    // 1. Text Search
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(rec => {
        const name = rec.profiles?.display_name || rec.metadata?.prospect_name || "";
        const email = rec.metadata?.prospect_email || "";
        const ref = `${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`;
        return name.toLowerCase().includes(lowerQ) || email.toLowerCase().includes(lowerQ) || ref.toLowerCase().includes(lowerQ);
      });
    }

    // 2. Status/Metric Filters
    if (activeFilter) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // PARETO FILTER: Isolate VIPs and SORT them from greatest to lowest
      if (activeFilter === 'pareto') {
        result = result.filter(rec => vipQuoteIds.has(rec.id));
        result.sort((a, b) => Number(b.total_amount) - Number(a.total_amount)); // Force highest to lowest
      } else {
        // Standard Filters
        result = result.filter(rec => {
          if (activeFilter === 'quotes_tdy') return rec.doc_type === 'quote' && new Date(rec.created_at) >= startOfToday;
          if (activeFilter === 'quotes_valid') return rec.doc_type === 'quote' && rec.status === 'pending' && (!rec.expires_at || new Date(rec.expires_at) >= now);
          if (activeFilter === 'quotes_expired') return rec.doc_type === 'quote' && rec.status === 'pending' && rec.expires_at && new Date(rec.expires_at) < now;
          if (activeFilter === 'quotes_declined') return rec.doc_type === 'quote' && rec.status === 'declined';
          return true;
        });
      }
    }

    return result;
  }, [records, activeFilter, searchQuery, vipQuoteIds]);


  // ==========================================
  // UI HANDLERS
  // ==========================================
  const handleViewDocument = (rec: any) => {
    const recipientName = rec.profiles?.display_name || rec.metadata?.prospect_name || "Unknown Guardian";
    const recipientEmail = rec.metadata?.prospect_email || "";

    setActiveDoc({
      type: rec.doc_type || 'invoice',
      data: {
        rawRecord: rec, 
        docId: rec.id,
        status: rec.status,
        docNumber: `${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`,
        recipient: { id: rec.guardian_id, name: recipientName, email: recipientEmail },
        items: rec.line_items,
        date: new Date(rec.created_at).toLocaleDateString('en-ZA'),
        dueDate: rec.expires_at ? new Date(rec.expires_at).toLocaleDateString('en-ZA') : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA'),
        globalNote: rec.metadata?.global_note
      }
    });
  };

  const handleViewProspect = (rec: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the document modal
    const name = rec.profiles?.display_name || rec.metadata?.prospect_name || "Unknown Guardian";
    const email = rec.metadata?.prospect_email || "No Email Provided";
    
    // Find all financial history for this specific prospect/guardian
    const history = records.filter(r => 
        (r.guardian_id && r.guardian_id === rec.guardian_id) || 
        (r.metadata?.prospect_email === email && email !== "No Email Provided")
    );

    setActiveProspect({
        id: rec.guardian_id || null,
        name,
        email,
        history,
        totalInvoiced: history.filter(h => h.doc_type === 'invoice').reduce((sum, h) => sum + Number(h.total_amount), 0),
        totalPaid: history.filter(h => h.doc_type === 'invoice' && (h.status === 'paid' || h.status === 'settled')).reduce((sum, h) => sum + Number(h.total_amount), 0),
        activeQuotes: history.filter(h => h.doc_type === 'quote' && h.status === 'pending').reduce((sum, h) => sum + Number(h.total_amount), 0)
    });
  };

  const handleApproveQuoteProfile = async (isAlreadyAccepted = false) => {
    if (!activeDoc || activeDoc.type !== 'quote') return;
    setIsUpdatingStatus(true);
    
    try {
       let finalGuardianId = activeDoc.data.recipient.id; 

       if (!finalGuardianId) {
          const { data: newProfile, error: profileErr } = await supabase
            .from('profiles')
            .insert([{
               role: 'guardian',
               display_name: activeDoc.data.recipient.name,
               status: 'active',
               funnel_stage: 'Active (Paid Client)',
               lead_source: 'Quote Conversion',
               metadata: { email: activeDoc.data.recipient.email, phone: "" }
            }])
            .select('id')
            .single();
            
          if (profileErr) throw profileErr;
          finalGuardianId = newProfile.id;
       }

       const { error: updateErr } = await supabase
          .from('billing_records')
          .update({ 
             status: 'accepted',
             guardian_id: finalGuardianId 
          })
          .eq('id', activeDoc.data.docId);

       if (updateErr) throw updateErr;

       alert(isAlreadyAccepted ? "Client profile generated and verified successfully!" : "Quote accepted! Client profile verified and active.");
       setActiveDoc(null);
       fetchFinanceData(); 
    } catch (err: any) {
       alert("Error: " + err.message);
    } finally {
       setIsUpdatingStatus(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!activeDoc || activeDoc.type !== 'invoice') return;
    setIsUpdatingStatus(true);
    
    try {
       const { error: updateErr } = await supabase
          .from('billing_records')
          .update({ status: 'paid' })
          .eq('id', activeDoc.data.docId);

       if (updateErr) throw updateErr;

       alert("Invoice successfully marked as PAID.");
       setActiveDoc(null);
       fetchFinanceData(); 
    } catch (err: any) {
       alert("Error: " + err.message);
    } finally {
       setIsUpdatingStatus(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!activeDoc) return;
    setIsGeneratingPdf(true);
    try {
      const htmlToImage = await import("html-to-image");
      // @ts-ignore
      const jsPDFModule = await import("jspdf/dist/jspdf.umd.min.js");
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

      const element = document.getElementById("document-capture-area");
      if (!element) throw new Error("Document element not found");

      const dataUrl = await htmlToImage.toPng(element, { 
        pixelRatio: 2, 
        backgroundColor: "#020617", 
        style: { margin: '0' } 
      });
      
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.setFillColor("#020617");
      pdf.rect(0, 0, pdfWidth, pdfPageHeight, "F");
      
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);

      if (activeDoc.type === 'quote') {
        const acceptUrl = `${window.location.origin}/quote/${activeDoc.data.docId}`;
        const buttonY = pdfPageHeight - 25; 
        
        pdf.setFillColor(147, 51, 234); 
        pdf.rect(pdfWidth / 4, buttonY, pdfWidth / 2, 12, "F"); 
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.textWithLink("CLICK HERE TO REVIEW & ACCEPT QUOTE", pdfWidth / 2, buttonY + 7.5, {
          url: acceptUrl,
          align: "center"
        });
      }
      
      pdf.save(`${activeDoc.data.docNumber}_RAD_Academy.pdf`);
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
      <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">Compiling_Financial_Intelligence...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-emerald-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <BarChart3 size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Economics_Engine_Online</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Finance_<span className="text-emerald-500">Dashboard</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/admin/finance/composer">
                <button className="flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20">
                    <Plus size={14}/> Compose Document
                </button>
            </Link>
          </div>
        </header>

        {/* ==========================================
            LIVE ANALYTICS DASHBOARD 
            ========================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* SECTOR 1: Collections & Revenue */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><Wallet size={100} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2"><CreditCard size={14}/> Collections (Month)</h3>
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Generated Due</p>
                 <p className="text-xl font-black mt-1">R {analytics.invoices.monthGenerated.toLocaleString()}</p>
               </div>
               <div>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Outstanding</p>
                 <p className="text-xl font-black mt-1 text-rose-400">R {analytics.invoices.monthOutstanding.toLocaleString()}</p>
               </div>
            </div>
            <div className="border-t border-white/10 pt-4 grid grid-cols-3 gap-2 text-center">
               <div>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Rate</p>
                 <p className="text-sm font-bold text-emerald-400 mt-1">{analytics.collections.rate.toFixed(1)}%</p>
               </div>
               <div className="border-l border-white/10">
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Parents</p>
                 <p className="text-sm font-bold text-white mt-1">{analytics.collections.activeParents}</p>
               </div>
               <div className="border-l border-white/10">
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Avg LTV</p>
                 <p className="text-sm font-bold text-blue-400 mt-1">R {Math.round(analytics.collections.avgPerParent).toLocaleString()}</p>
               </div>
            </div>
          </div>

          {/* SECTOR 2: Quote Pipeline */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><FileText size={100} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2"><TrendingUp size={14}/> Quote Pipeline</h3>
            
            {/* CLICKABLE FILTERS: Top Row */}
            <div className="grid grid-cols-4 gap-2 text-center">
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_tdy' ? null : 'quotes_tdy')} className={`cursor-pointer rounded-lg transition-colors p-1 ${activeFilter === 'quotes_tdy' ? 'bg-purple-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500">Tdy</p>
                  <p className="font-bold">{analytics.quotes.today}</p>
               </div>
               <div className="border-l border-white/10 p-1"><p className="text-[9px] uppercase tracking-widest text-slate-500">Wk</p><p className="font-bold">{analytics.quotes.week}</p></div>
               <div className="border-l border-white/10 p-1"><p className="text-[9px] uppercase tracking-widest text-slate-500">Mth</p><p className="font-bold">{analytics.quotes.month}</p></div>
               <div className="border-l border-white/10 p-1"><p className="text-[9px] uppercase tracking-widest text-slate-500">All</p><p className="font-bold">{analytics.quotes.total}</p></div>
            </div>

            {/* CLICKABLE FILTERS: Bottom Row */}
            <div className="border-t border-white/10 pt-4 grid grid-cols-4 gap-2 text-center">
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_valid' ? null : 'quotes_valid')} className={`cursor-pointer rounded-lg transition-colors p-1 ${activeFilter === 'quotes_valid' ? 'bg-emerald-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Valid</p>
                 <p className="text-sm font-bold text-emerald-400 mt-1">{analytics.pipeline.valid}</p>
               </div>
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_expired' ? null : 'quotes_expired')} className={`cursor-pointer rounded-lg transition-colors border-l border-white/10 p-1 ${activeFilter === 'quotes_expired' ? 'bg-amber-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Expired</p>
                 <p className="text-sm font-bold text-amber-400 mt-1">{analytics.pipeline.expired}</p>
               </div>
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_declined' ? null : 'quotes_declined')} className={`cursor-pointer rounded-lg transition-colors border-l border-white/10 p-1 ${activeFilter === 'quotes_declined' ? 'bg-rose-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Declined</p>
                 <p className="text-sm font-bold text-rose-400 mt-1">{analytics.pipeline.declined}</p>
               </div>
               <div className="border-l border-white/10 p-1">
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Avg GP</p>
                 <p className="text-[10px] font-bold text-purple-400 mt-1.5 flex items-center justify-center">R {Math.round(analytics.pipeline.avgGp).toLocaleString()}</p>
               </div>
            </div>
          </div>

          {/* SECTOR 3: Product & Conversion */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><Package size={100} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Activity size={14}/> Item Intelligence (Paid)</h3>
            <div className="space-y-3">
               <div className="flex justify-between items-center bg-[#020617]/50 p-3 rounded-xl border border-white/5">
                 <div>
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Most Sold Volume</p>
                   <p className="text-xs font-bold text-white mt-0.5 truncate max-w-[150px]">{analytics.products.mostSold.name}</p>
                 </div>
                 <p className="text-sm font-black text-blue-400">{analytics.products.mostSold.qty} units</p>
               </div>
               <div className="flex justify-between items-center bg-[#020617]/50 p-3 rounded-xl border border-white/5">
                 <div>
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Highest GP Generator</p>
                   <p className="text-xs font-bold text-white mt-0.5 truncate max-w-[150px]">{analytics.products.highestGp.name}</p>
                 </div>
                 <p className="text-sm font-black text-emerald-400">R {analytics.products.highestGp.gp.toLocaleString()}</p>
               </div>
            </div>
          </div>

        </div>

        {/* MAIN LEDGER HEADER: SEARCH & PARETO */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search records by prospect name, email, or ref #..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all placeholder:text-slate-600 placeholder:font-normal"
            />
          </div>

          {/* PARETO 80/20 BUTTON */}
          <button 
            onClick={() => setActiveFilter(activeFilter === 'pareto' ? null : 'pareto')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeFilter === 'pareto' 
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105' 
              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
            }`}
          >
            <Target size={14} /> VIP Pipeline (80/20)
          </button>
        </div>

        {/* MAIN LEDGER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filter Status Bar */}
            {activeFilter && activeFilter !== 'pareto' && (
               <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 px-4 py-3 rounded-xl">
                  <p className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                     <Filter size={14}/> Active Filter Applied
                  </p>
                  <button onClick={() => setActiveFilter(null)} className="flex items-center gap-1 text-[10px] font-black uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                     Clear Filter <FilterX size={12}/>
                  </button>
               </div>
            )}

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="px-8 py-5">Household / Lead</th>
                    <th className="px-8 py-5">Document Type</th>
                    <th className="px-8 py-5">Amount</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRecords.map((rec) => {
                    const needsInvoice = rec.doc_type === 'quote' && rec.status === 'accepted' && !rec.metadata?.converted_to_invoice;
                    const isVipQuote = vipQuoteIds.has(rec.id);
                    
                    return (
                      <LedgerRow 
                        key={rec.id}
                        name={rec.profiles?.display_name || rec.metadata?.prospect_name || 'Unknown Entity'} 
                        type={rec.doc_type === 'quote' ? 'Quotation' : 'Invoice'} 
                        amount={`R ${rec.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                        status={rec.status.charAt(0).toUpperCase() + rec.status.slice(1)} 
                        refId={`${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`} 
                        needsInvoice={needsInvoice}
                        isVip={isVipQuote}
                        onClick={() => handleViewDocument(rec)} 
                        onProfileClick={(e: React.MouseEvent) => handleViewProspect(rec, e)}
                      />
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-sm italic">No records found matching your search or filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RECENT ACTIVITY SIDEBAR */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 border-b border-white/5 pb-6">
                <Receipt size={18} className="text-emerald-500"/> Pipeline Conversion
              </h3>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                
                {/* Step 1: Quotes Generated */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-purple-500/20 text-purple-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><FileText size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Quotes Generated</p>
                     <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-xl font-bold text-purple-400">{analytics.conversion.quotes}</p>
                        <p className="text-xs font-bold text-purple-400/50 italic">R {analytics.conversion.quotesValue.toLocaleString()}</p>
                     </div>
                  </div>
                </div>

                {/* Step 2: Accepted Quotes */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-emerald-500/20 text-emerald-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><CheckCircle2 size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Accepted Quotes</p>
                     <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-xl font-bold text-emerald-400">{analytics.conversion.acceptedQuotes}</p>
                        <p className="text-xs font-bold text-emerald-400/50 italic">R {analytics.conversion.acceptedValue.toLocaleString()}</p>
                     </div>
                  </div>
                </div>

                {/* Step 3: Invoices Issued */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-blue-500/20 text-blue-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><Receipt size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Invoices Issued</p>
                     <p className="text-xl font-bold mt-1 text-blue-400">R {analytics.conversion.invoicesValue.toLocaleString()}</p>
                  </div>
                </div>

                {/* Step 4: Payments Captured */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-green-500/20 text-green-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><Wallet size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Payments Captured</p>
                     <p className="text-xl font-bold mt-1 text-green-400">R {analytics.conversion.paidValue.toLocaleString()}</p>
                  </div>
                </div>

              </div>
              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quote Acceptance Rate</p>
                 <p className="text-2xl font-black italic mt-1 text-white">{analytics.conversion.rate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DOCUMENT VIEW SLIDE-OVER */}
      <AnimatePresence>
        {activeDoc && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveDoc(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30 }} className="relative w-full max-w-5xl bg-[#020617] border-l border-white/10 h-full shadow-2xl flex flex-col p-8 space-y-8 overflow-y-auto">
              
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20">
                    <FileText size={24}/>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tight">Financial_Inspector</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Secure_Vault_Node: {activeDoc.type.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   {/* View Prospect Button from inside doc */}
                   <button onClick={(e) => { handleViewProspect(activeDoc.data.rawRecord, e as any); setActiveDoc(null); }} className="px-6 py-4 bg-blue-600/10 text-blue-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-600 hover:text-white border border-blue-500/20 transition-all flex items-center gap-2">
                     <User size={16}/> Client File
                   </button>
                   <button onClick={() => window.print()} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white border border-white/10 transition-all"><Printer size={20}/></button>
                   <button onClick={() => setActiveDoc(null)} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white border border-white/10 transition-all"><X size={24}/></button>
                </div>
              </div>

              <div className="flex-1 py-4" id="document-capture-area">
                {activeDoc.type === 'statement' ? (
                  <RADStatement {...activeDoc.data} />
                ) : (
                  <RADBillingDocument type={activeDoc.type as any} {...activeDoc.data} />
                )}
              </div>

              <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4">
                 
                 {/* 1. MANUAL ACCEPT QUOTE BUTTON */}
                 {activeDoc.type === 'quote' && activeDoc.data.status === 'pending' && (
                    <button 
                      onClick={() => handleApproveQuoteProfile(false)}
                      disabled={isUpdatingStatus}
                      className="px-8 py-4 bg-purple-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Mark Accepted
                    </button>
                 )}

                 {/* 1.5. VERIFY PROFILE BUTTON */}
                 {activeDoc.type === 'quote' && activeDoc.data.status === 'accepted' && !activeDoc.data.recipient.id && (
                    <button 
                      onClick={() => handleApproveQuoteProfile(true)}
                      disabled={isUpdatingStatus}
                      className="px-8 py-4 bg-amber-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-amber-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-amber-900/20"
                    >
                      {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={18} />} Verify & Create Profile
                    </button>
                 )}

                 {/* 2. CONVERT TO INVOICE BUTTON */}
                 {activeDoc.type === 'quote' && activeDoc.data.status === 'accepted' && activeDoc.data.recipient.id && !activeDoc.data.rawRecord?.metadata?.converted_to_invoice && (
                    <button 
                      onClick={() => router.push(`/admin/finance/composer?convertFromQuote=${activeDoc.data.docId}`)}
                      className="px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20"
                    >
                      <Receipt size={18} /> Convert to Invoice
                    </button>
                 )}

                 {/* 3. MARK INVOICE AS PAID BUTTON */}
                 {activeDoc.type === 'invoice' && activeDoc.data.status === 'pending' && (
                    <button 
                      onClick={handleMarkPaid}
                      disabled={isUpdatingStatus}
                      className="px-8 py-4 bg-emerald-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Mark Paid
                    </button>
                 )}
                 
                 <button 
                   onClick={handleDownloadPDF}
                   disabled={isGeneratingPdf}
                   className="px-10 py-4 bg-white/5 rounded-2xl font-black uppercase italic tracking-widest border border-white/10 hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                 >
                   {isGeneratingPdf ? (
                     <><Loader2 size={16} className="animate-spin" /> Processing...</>
                   ) : (
                     <><Download size={16} /> PDF</>
                   )}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROSPECT WORKSPACE MODAL */}
      <AnimatePresence>
        {activeProspect && (
          <div className="fixed inset-0 z-[110] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveProspect(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30 }} className="relative w-full max-w-2xl bg-[#020617] border-l border-white/10 h-full shadow-2xl flex flex-col p-10 space-y-10 overflow-y-auto">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black uppercase italic text-white leading-none">{activeProspect.name}</h2>
                    <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">Client_Intelligence_File</p>
                  </div>
                  <button onClick={() => setActiveProspect(null)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-white/10 py-8">
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Primary Email</p>
                     <p className="font-bold text-slate-300">{activeProspect.email}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">CRM Status</p>
                     <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${activeProspect.id ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        {activeProspect.id ? 'Active Profile' : 'Pending Lead'}
                     </span>
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[24px]">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Quotes</p>
                     <p className="text-2xl font-black text-purple-400">R {activeProspect.activeQuotes.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[24px]">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Lifetime Inv.</p>
                     <p className="text-2xl font-black text-blue-400">R {activeProspect.totalInvoiced.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[24px]">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Paid</p>
                     <p className="text-2xl font-black text-emerald-400">R {activeProspect.totalPaid.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Financial History Log</h3>
                   <div className="bg-black/50 border border-white/10 rounded-[32px] overflow-hidden">
                     {activeProspect.history.length > 0 ? (
                       <div className="divide-y divide-white/5">
                         {activeProspect.history.map((doc: any) => (
                           <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {setActiveProspect(null); handleViewDocument(doc);}}>
                             <div className="flex items-center gap-3">
                                {doc.doc_type === 'quote' ? <FileText size={16} className="text-purple-400"/> : <Receipt size={16} className="text-emerald-400"/>}
                                <div>
                                  <p className="text-sm font-bold text-white">{doc.doc_type === 'quote' ? 'QT' : 'INV'}-{doc.invoice_number}</p>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</p>
                                </div>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black text-slate-300">R {doc.total_amount.toLocaleString()}</p>
                               <p className={`text-[9px] font-black uppercase tracking-widest ${doc.status === 'paid' ? 'text-emerald-500' : doc.status === 'accepted' ? 'text-purple-500' : 'text-amber-500'}`}>{doc.status}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <p className="p-8 text-center text-slate-600 text-xs italic">No financial history on record.</p>
                     )}
                   </div>
                </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Internal Page UI Components ---

function LedgerRow({ name, type, amount, status, refId, needsInvoice, isVip, onClick, onProfileClick }: any) {
  const isOverdue = status === 'Overdue';
  const isQuote = type === 'Quotation';
  const isAccepted = status === 'Accepted';
  const isDeclined = status === 'Declined';
  const isPaid = status === 'Paid' || status === 'Settled';

  return (
    <tr 
      onClick={onClick} 
      className={`transition-colors group cursor-pointer ${
        needsInvoice 
          ? 'bg-amber-500/[0.05] hover:bg-amber-500/[0.08] border-l-4 border-amber-500' 
          : isVip 
          ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.12] border-l-4 border-amber-500/60'
          : 'hover:bg-white/[0.02] border-l-4 border-transparent'
      }`}
    >
      <td className="px-8 py-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onProfileClick}
            className="p-2 bg-white/5 rounded-full text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all border border-transparent hover:border-blue-500/30"
            title="Open Client File"
          >
            <User size={14} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-sm">{name}</p>
              {needsInvoice && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded animate-pulse border border-amber-500/30">
                  Needs Invoice
                </span>
              )}
              {isVip && !needsInvoice && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded border border-amber-500/30 flex items-center gap-1">
                  <Target size={10} /> VIP Pipeline
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{refId}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-6 text-xs font-bold text-slate-300 flex items-center gap-2 mt-2">
        {isQuote ? <FileText size={14} className="text-purple-400"/> : <Receipt size={14} className="text-emerald-400"/>}
        {type}
      </td>
      <td className="px-8 py-6 text-sm font-black text-slate-400">{amount}</td>
      <td className="px-8 py-6 text-right">
        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${
          isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
          isDeclined ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
          isAccepted ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
          isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }`}>
          {status}
        </span>
      </td>
    </tr>
  );
}