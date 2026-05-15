"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Search, Filter, TrendingUp, Wallet, Receipt, 
  Clock, AlertTriangle, CheckCircle2, ChevronRight, BarChart3, FileText, 
  Users, Activity, ArrowDownToLine, ArrowUpRight, DollarSign, LayoutDashboard,
  Loader2, Target, ChevronDown, ChevronUp, Save, Settings, MessageSquare,
  X, FileMinus, Copy
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

export default function FinanceLedgerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'cashflow'>('ledger');
  
  // ADDED: Current User State to track the Admin making the changes
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Ledger Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<'all' | 'term' | 'bootcamp'>('all');
  const [sortConfig, setSortConfig] = useState<'balance' | 'next_inv' | 'name'>('balance');

  // Expanded Row State
  const [expandedClientId, setExpandedClient] = useState<string | null>(null);
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);

  // Editable Config State (Local to the expanded row)
  const [editFrequency, setEditFrequency] = useState<string>("monthly");
  const [editNextDate, setEditNextDate] = useState<string>("");

  // Processed Data
  const [clients, setClients] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any>({
    expected: 0, invoiced: 0, collected: 0, outstanding: 0,
    speed: { onTime: 0, late1to7: 0, late8plus: 0, uncollected: 0 }
  });

  // Action Modal State
  const [activeInvoiceForModal, setActiveInvoiceForModal] = useState<any>(null);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  async function fetchLedgerData() {
    setLoading(true);
    try {
      // ADDED: Fetch the logged-in admin's profile
      const sessionData = localStorage.getItem("pioneer_session");
      if (sessionData) {
        const localUser = JSON.parse(sessionData);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) setCurrentUser(profile);
      }

      const [profilesRes, enrollmentsRes, billingRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, role, linked_parent_id, metadata'),
        supabase.from('enrollments').select('student_id, courses(title)'),
        // NOTE: Declined/Draft invoices are safely ignored here due to the .in() filter
        supabase.from('billing_records').select('*').eq('doc_type', 'invoice').in('status', ['paid', 'settled', 'pending', 'overdue', 'partially_paid', 'itn_received']).order('created_at', { ascending: false })
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const profiles = profilesRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const invoices = billingRes.data || [];

      // Separate profiles
      const guardians = profiles.filter(p => p.role === 'guardian' || p.role === 'admin');
      const students = profiles.filter(p => p.role === 'student');

      const now = new Date();
      const currentYear = now.getFullYear();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      let totalExpected = 0;
      let totalInvoiced = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;

      // Speed Tracking
      let onTimeCount = 0;
      let late1to7Count = 0;
      let late8plusCount = 0;
      let uncollectedCount = 0;
      let totalAssessedInvoices = 0;

      const processedClients = guardians.map(guardian => {
        // Find linked kids
        const myKids = students.filter(s => s.linked_parent_id === guardian.id);
        
        // Financials (Only valid invoices are in this array)
        const myInvoices = invoices.filter(i => i.guardian_id === guardian.id);
        
        // Parse Guardian Metadata for Custom Billing Schedule
        const gMeta = typeof guardian.metadata === 'string' ? JSON.parse(guardian.metadata) : (guardian.metadata || {});
        const billingSchedule = gMeta.billing_schedule || {};

        // CRITICAL FIX: If they are NOT configured AND have NO valid invoice records, exclude them entirely.
        if (!billingSchedule.frequency && myInvoices.length === 0) {
          return null;
        }

        // Determine Plan Type (If any kid is in a non-bootcamp course, they are 'Term')
        let isTerm = false;
        myKids.forEach(kid => {
          const myEnrollments = enrollments.filter(e => e.student_id === kid.id);
          myEnrollments.forEach(enr => {
            const courses: any = enr.courses;
            const courseTitle = Array.isArray(courses) ? courses[0]?.title : courses?.title;
            if (courseTitle && !courseTitle.toLowerCase().includes('bootcamp')) {
              isTerm = true;
            }
          });
        });
        
        // If the profile explicitly states frequency, use it to override the inferred plan
        const plan = billingSchedule.frequency === 'termly' ? 'Term (Upfront)' 
                   : billingSchedule.frequency === 'monthly' ? 'Term (Monthly)' 
                   : isTerm ? 'Term' : 'Bootcamp';

        const lastInv = myInvoices.length > 0 ? myInvoices[0] : null;
        
        let accBalance = 0;
        myInvoices.forEach(inv => {
          const amt = Number(inv.total_amount) || 0;
          if (inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'partially_paid' || inv.status === 'itn_received') {
            accBalance += Math.max(0, amt - Number(inv.amount_paid || 0));
          }
        });

        // --- NEW PROJECTION LOGIC (Profile Driven) ---
        let nextInvDate = "Not Set";
        let nextInvDateObj: Date | null = null;
        let expectedTermRev = 0;
        const lastAmount = lastInv ? Number(lastInv.total_amount) : 0;
        const rawNextDateStr = billingSchedule.next_invoice_date || "";

        // 1. Get the exact date from the Guardian Profile
        if (billingSchedule.next_invoice_date) {
          nextInvDateObj = new Date(billingSchedule.next_invoice_date);
          nextInvDate = nextInvDateObj.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
        } else if (plan.includes('Term') && lastInv) {
          // Fallback if they haven't been configured yet, but we know they are a recurring client
          const fallbackDate = new Date(lastInv.created_at);
          fallbackDate.setMonth(fallbackDate.getMonth() + 1);
          nextInvDateObj = fallbackDate;
          nextInvDate = fallbackDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + " (Est)";
        } else if (plan === 'Bootcamp') {
          nextInvDate = "-";
        }

        // 2. Calculate Expected Monthly Revenue (Target)
        if (plan.includes('Term')) {
          // Check if they were ALREADY invoiced this month
          const invoicedThisMonth = lastInv && new Date(lastInv.created_at) >= startOfMonth && new Date(lastInv.created_at) <= endOfMonth;
          
          if (invoicedThisMonth) {
            // They were already billed this month, so this amount is part of our monthly target baseline
            totalExpected += lastAmount;
          } else if (nextInvDateObj && nextInvDateObj >= startOfMonth && nextInvDateObj <= endOfMonth) {
             // They haven't been billed yet, but their custom schedule says they will be billed this month
             totalExpected += lastAmount; 
          }
          
          // Approx remaining term projection
          expectedTermRev = lastAmount * (billingSchedule.frequency === 'termly' ? 1 : 3); 
        } else {
          // Bootcamp logic (One-off)
          expectedTermRev = lastAmount; 
          // For one-offs, we only "expect" them in the month they actually occur
          if (lastInv && new Date(lastInv.created_at) >= startOfMonth && new Date(lastInv.created_at) <= endOfMonth) {
            totalExpected += lastAmount; 
          }
        }

        // Add to Cashflow Macrostats (Month Specific)
        myInvoices.forEach(inv => {
          const invDate = new Date(inv.created_at);
          const amt = Number(inv.total_amount) || 0;
          
          if (invDate >= startOfMonth && invDate <= endOfMonth) {
            totalInvoiced += amt;
            if (inv.status === 'paid' || inv.status === 'settled') totalCollected += amt;
            else totalOutstanding += amt;
          }

          // Collection Speed Logic (Lifetime)
          if (amt > 0) {
            totalAssessedInvoices++;
            if (inv.status === 'paid' || inv.status === 'settled') {
              const created = new Date(inv.created_at).getTime();
              const updated = new Date(inv.updated_at || inv.created_at).getTime();
              const daysToPay = (updated - created) / (1000 * 60 * 60 * 24);

              if (daysToPay <= 1) onTimeCount++;
              else if (daysToPay <= 7) late1to7Count++;
              else late8plusCount++;
            } else {
              uncollectedCount++;
            }
          }
        });

        // 3. Compile Current Year History for the Dropdown
        const currentYearHistory = myInvoices
          .filter(inv => new Date(inv.created_at).getFullYear() === currentYear)
          .map(inv => ({
            id: inv.id,
            ref: `INV-${inv.invoice_number}`,
            amount: Number(inv.total_amount),
            paid: Number(inv.amount_paid || 0),
            status: inv.status,
            date: new Date(inv.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
            dueDate: inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '-',
            paidDate: (inv.status === 'paid' || inv.status === 'settled' || inv.status === 'itn_received') && (inv.paid_at || inv.updated_at) ? new Date(inv.paid_at || inv.updated_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '-',
            raw_record: inv
          }));

        return {
          id: guardian.id,
          name: guardian.display_name,
          phone: gMeta.phone || "", // Extracted for WhatsApp
          kids: myKids.length,
          plan,
          billingFrequency: billingSchedule.frequency || "monthly",
          rawNextDateStr,
          balance: accBalance,
          history: currentYearHistory,
          lastStatementSent: gMeta.last_statement_sent || null,
          lastInv: lastInv ? {
            date: new Date(lastInv.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
            amount: lastAmount,
            status: lastInv.status
          } : null,
          nextInvDate,
          nextInvDateObj, // Used for sorting
          nextInvAmount: lastAmount,
          expectedTermRev
        };
      }).filter(Boolean); 

      setClients(processedClients);

      setCashflow({
        expected: totalExpected,
        invoiced: totalInvoiced,
        collected: totalCollected,
        outstanding: totalOutstanding,
        speed: {
          onTime: totalAssessedInvoices ? Math.round((onTimeCount / totalAssessedInvoices) * 100) : 0,
          late1to7: totalAssessedInvoices ? Math.round((late1to7Count / totalAssessedInvoices) * 100) : 0,
          late8plus: totalAssessedInvoices ? Math.round((late8plusCount / totalAssessedInvoices) * 100) : 0,
          uncollected: totalAssessedInvoices ? Math.round((uncollectedCount / totalAssessedInvoices) * 100) : 0,
        }
      });

    } catch (error) {
      console.error("Error generating ledger:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateBillingConfig = async (clientId: string) => {
    if (!editNextDate) {
      alert("Please select a valid Next Invoice Date.");
      return;
    }

    setSavingConfigId(clientId);
    try {
      const { data: profile } = await supabase.from('profiles').select('metadata').eq('id', clientId).single();
      if (!profile) throw new Error("Profile not found");

      const currentMeta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
      const newMeta = {
        ...currentMeta,
        billing_schedule: {
          frequency: editFrequency,
          next_invoice_date: editNextDate
        }
      };

      const { error } = await supabase.from('profiles').update({ metadata: newMeta }).eq('id', clientId);
      if (error) throw error;

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#3b82f6', '#60a5fa'] });
      
      // Refresh local data to show new dates
      await fetchLedgerData();
      
    } catch (err: any) {
      alert("Failed to update billing config: " + err.message);
    } finally {
      setSavingConfigId(null);
    }
  };

  const handleExpandRow = (client: any) => {
    if (expandedClientId === client.id) {
      setExpandedClient(null);
    } else {
      setExpandedClient(client.id);
      setEditFrequency(client.billingFrequency);
      setEditNextDate(client.rawNextDateStr);
    }
  };

  // --- Filtering & Sorting ---
  const displayedClients = useMemo(() => {
    let result = [...clients];

    // Filter Plan
    if (planFilter !== 'all') {
      if (planFilter === 'term') result = result.filter(c => c.plan.includes('Term'));
      if (planFilter === 'bootcamp') result = result.filter(c => c.plan === 'Bootcamp');
    }

    // Search
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(lowerQ));
    }

    // Sort
    result.sort((a, b) => {
      if (sortConfig === 'balance') return b.balance - a.balance; // Highest debt first
      if (sortConfig === 'name') return a.name.localeCompare(b.name);
      if (sortConfig === 'next_inv') {
         if (!a.nextInvDateObj) return 1;
         if (!b.nextInvDateObj) return -1;
         return a.nextInvDateObj.getTime() - b.nextInvDateObj.getTime(); // Earliest date first
      }
      return 0; // Default
    });

    return result;
  }, [clients, planFilter, searchQuery, sortConfig]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-blue-600 font-bold uppercase tracking-widest text-xs">Compiling Ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-4">
            <Link href="/admin/finance" className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-400 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Finance Hub</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <LayoutDashboard size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Economics_Engine_V2</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Cashflow <span className="text-blue-600">&</span> Ledger
              </h1>
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('ledger')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'ledger' ? 'bg-white text-blue-600 shadow-md border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Users size={16}/> Client Ledger
            </button>
            <button 
              onClick={() => setActiveTab('cashflow')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'cashflow' ? 'bg-white text-blue-600 shadow-md border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <BarChart3 size={16}/> Cashflow Analysis
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'ledger' ? (
            <motion.div key="ledger" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              
              {/* TOOLBAR */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:max-w-md group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by parent name..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <select 
                    value={planFilter} 
                    onChange={e => setPlanFilter(e.target.value as any)}
                    className="bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-2xl px-4 py-3 outline-none focus:border-blue-500 shadow-sm cursor-pointer flex-1 md:flex-none"
                  >
                    <option value="all">All Plans</option>
                    <option value="term">Term Clients Only</option>
                    <option value="bootcamp">Bootcamps Only</option>
                  </select>
                  <select 
                    value={sortConfig} 
                    onChange={e => setSortConfig(e.target.value as any)}
                    className="bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-2xl px-4 py-3 outline-none focus:border-blue-500 shadow-sm cursor-pointer flex-1 md:flex-none"
                  >
                    <option value="balance">Sort: Highest Debt</option>
                    <option value="next_inv">Sort: Next Invoice</option>
                    <option value="name">Sort: A-Z</option>
                  </select>
                </div>
              </div>

              {/* DATA TABLE */}
              <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-8 py-5">Household Profile</th>
                        <th className="px-6 py-5">Plan Type</th>
                        <th className="px-6 py-5">Current Balance</th>
                        <th className="px-6 py-5">Last Invoice</th>
                        <th className="px-6 py-5">Next Invoice Target</th>
                        <th className="px-8 py-5 text-right">Proj. Term Rev</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedClients.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold italic">No clients match your filter criteria.</td></tr>
                      ) : (
                        displayedClients.map((client) => (
                          <Fragment key={client.id}>
                            <tr 
                              onClick={() => handleExpandRow(client)} 
                              className={`transition-colors group cursor-pointer ${expandedClientId === client.id ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}
                            >
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border shrink-0 transition-transform ${
                                    expandedClientId === client.id ? 'bg-blue-600 text-white border-blue-700 shadow-lg scale-110' : 'bg-blue-50 text-blue-600 border-blue-100 group-hover:scale-110'
                                  }`}>
                                    {client.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                      {client.name} 
                                      {expandedClientId === client.id ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" />}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{client.kids} Active {client.kids === 1 ? 'Pioneer' : 'Pioneers'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                  client.plan.includes('Term') ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {client.plan}
                                </span>
                              </td>
                              <td className="px-6 py-6">
                                <div className={`text-sm font-black flex items-center gap-1.5 ${client.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  R {client.balance.toLocaleString()}
                                  {client.balance > 0 && <AlertTriangle size={14} className="animate-pulse" />}
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                {client.lastInv ? (
                                  <div>
                                    <p className="text-sm font-bold text-slate-700">R {client.lastInv.amount.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                                      {client.lastInv.date} • <span className={client.lastInv.status === 'paid' ? 'text-emerald-500' : 'text-rose-500'}>{client.lastInv.status}</span>
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">No records</span>
                                )}
                              </td>
                              <td className="px-6 py-6">
                                {client.plan.includes('Term') ? (
                                  <div>
                                    <p className={`text-[10px] font-black mt-1 uppercase tracking-widest flex items-center gap-1 ${client.nextInvDate === 'Not Set' ? 'text-amber-500 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-200' : 'text-blue-500'}`}>
                                      <Clock size={10}/> {client.nextInvDate === 'Not Set' ? 'Config Required' : `Due: ${client.nextInvDate}`}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 font-bold text-xs">- One Off -</span>
                                )}
                              </td>
                              <td className="px-8 py-6 text-right">
                                <p className="text-sm font-black text-slate-900 mb-2">R {client.expectedTermRev.toLocaleString()}</p>
                                <a 
                                  href={`/statement/${client.id}`} 
                                  target="_blank"
                                  onClick={(e) => e.stopPropagation()} 
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-100 shadow-sm"
                                >
                                  <FileText size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">Statement</span>
                                </a>
                              </td>
                            </tr>
                            
                            {/* EXPANDABLE DRAWER */}
                            <AnimatePresence>
                              {expandedClientId === client.id && (
                                <tr>
                                  <td colSpan={6} className="p-0 border-b border-blue-100 bg-slate-50 shadow-inner">
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }} 
                                      animate={{ height: 'auto', opacity: 1 }} 
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        
                                        {/* LEFT: Billing Config */}
                                        <div className="xl:col-span-1 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm h-fit">
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
                                            <Settings size={14} className="text-blue-500" /> Billing Settings
                                          </h4>
                                          <div className="space-y-4">
                                            <div>
                                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block ml-1">Frequency</label>
                                              <select 
                                                value={editFrequency}
                                                onChange={e => setEditFrequency(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                                              >
                                                <option value="monthly">Monthly Recurring</option>
                                                <option value="termly">Termly (Upfront)</option>
                                              </select>
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block ml-1">Next Invoice Target Date</label>
                                              <input 
                                                type="date" 
                                                value={editNextDate}
                                                onChange={e => setEditNextDate(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                                              />
                                            </div>
                                            <button 
                                              onClick={() => handleUpdateBillingConfig(client.id)}
                                              disabled={savingConfigId === client.id}
                                              className="w-full bg-blue-600 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 shadow-md shadow-blue-600/20"
                                            >
                                              {savingConfigId === client.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>} Update Terms
                                            </button>
                                          </div>
                                        </div>

                                        {/* RIGHT: Financial History Log */}
                                        <div className="xl:col-span-2 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex flex-col">
                                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center justify-between border-b border-slate-100 pb-3">
                                            <span className="flex items-center gap-2"><Receipt size={14} className="text-emerald-500" /> Account History</span>
                                            <div className="flex items-center gap-3">
                                              
                                              {/* UPDATED: WHATSAPP STATEMENT NOTIFICATION BUTTON */}
                                              <button 
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  const firstName = client.name.split(' ')[0];
                                                  const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
                                                  const amountStr = `R ${client.balance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                                  const link = `${window.location.origin}/statement/${client.id}`;
                                                  
                                                  const msg = `Dear ${firstName},\n\nFind below a link to your latest statement as at ${today}, showing an amount of ${amountStr} that is outstanding.\nWe are in the process of moving our invoicing system and may have missed a payment. If so, please let us know ASAP.\n\n${link}\n\nRegards,\nRAD Academy`;
                                                  
                                                  let phoneParam = "";
                                                  if (client.phone) {
                                                      let cleanPhone = client.phone.replace(/\D/g, '');
                                                      if (cleanPhone.startsWith('0')) cleanPhone = '27' + cleanPhone.substring(1);
                                                      phoneParam = cleanPhone;
                                                  }
                                                  
                                                  // 1. Open WhatsApp
                                                  window.open(`https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`, '_blank');

                                                  // 2. Log the action to the DB and update the UI
                                                  try {
                                                    const { data: profile } = await supabase.from('profiles').select('metadata').eq('id', client.id).single();
                                                    if (profile) {
                                                      const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
                                                      meta.last_statement_sent = {
                                                        date: today,
                                                        amount: amountStr,
                                                        admin: currentUser?.display_name?.split(' ')[0] || 'Admin'
                                                      };
                                                      await supabase.from('profiles').update({ metadata: meta }).eq('id', client.id);

                                                      // Update local state directly so the footer appears instantly without refetching
                                                      setClients(prev => prev.map(c => c.id === client.id ? { ...c, lastStatementSent: meta.last_statement_sent } : c));
                                                    }
                                                  } catch (err) {
                                                    console.error("Failed to log statement send", err);
                                                  }
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors border border-emerald-100 shadow-sm"
                                              >
                                                <MessageSquare size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">WhatsApp</span>
                                              </button>

                                              <Link 
                                                href={`/statement/${client.id}`} 
                                                target="_blank"
                                                className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-100 shadow-sm"
                                              >
                                                <FileText size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">Statement</span>
                                              </Link>
                                              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Current Year</span>
                                            </div>
                                          </h4>

                                          <div className="flex-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2 mb-4">
                                            {client.history.length === 0 ? (
                                              <p className="text-slate-400 text-xs italic text-center py-8">No invoices generated for this year.</p>
                                            ) : (
                                              client.history.map((hist: any) => (
                                                <div 
                                                  key={hist.id} 
                                                  onClick={(e) => { e.stopPropagation(); setActiveInvoiceForModal(hist.raw_record); }}
                                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                                                >
                                                  <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${hist.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : hist.status === 'itn_received' ? 'bg-amber-50 text-amber-600' : hist.status === 'pending' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                                      <Receipt size={16}/>
                                                    </div>
                                                    <div>
                                                      <p className="text-sm font-bold text-slate-900">{hist.ref}</p>
                                                      <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Issued: {hist.date}</span>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due: {hist.dueDate}</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto">
                                                    <div className="text-right">
                                                      <p className="text-sm font-black text-slate-900">R {hist.amount.toLocaleString()}</p>
                                                      <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${hist.status === 'paid' ? 'text-emerald-500' : hist.status === 'itn_received' ? 'text-amber-500 animate-pulse' : hist.status === 'pending' ? 'text-blue-500' : 'text-rose-500'}`}>
                                                        {hist.status.replace('_', ' ')}
                                                      </p>
                                                    </div>
                                                    <div className="text-right w-24">
                                                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Clearance</p>
                                                      <p className="text-xs font-bold text-slate-700">{hist.paidDate}</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))
                                            )}
                                          </div>

                                          {/* NEW: STATEMENT AUDIT LOG FOOTER */}
                                          {client.lastStatementSent && (
                                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                                              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                                                <CheckCircle2 size={12} className="text-emerald-500" />
                                                Statement sent on <span className="text-slate-900">{client.lastStatementSent.date}</span> for <span className="text-rose-600 font-black">{client.lastStatementSent.amount}</span> by <span className="text-slate-900">{client.lastStatementSent.admin}</span>
                                              </p>
                                            </div>
                                          )}
                                        </div>

                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

          ) : (

            <motion.div key="cashflow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-2">
                  <Activity className="text-blue-600"/> Monthly Macro-Economics
                </h2>
                <span className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* 4 HERO CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 p-8 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 relative z-10 flex items-center gap-2"><Target size={14}/> Expected Rev</p>
                  <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.expected.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Target for current month</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 p-8 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-2 relative z-10 flex items-center gap-2"><Receipt size={14}/> Actually Invoiced</p>
                  <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.invoiced.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Billed to clients</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 p-8 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 relative z-10 flex items-center gap-2"><Wallet size={14}/> Collected (Cash)</p>
                  <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.collected.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Secured in bank</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 p-8 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2 relative z-10 flex items-center gap-2"><AlertTriangle size={14}/> Outstanding</p>
                  <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.outstanding.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Awaiting payment</p>
                </div>

              </div>

              {/* COLLECTION SPEED BAR */}
              <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] mt-8">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 border-b border-slate-100 pb-4 flex items-center gap-2">
                   <TrendingUp size={16} className="text-blue-600"/> Collection Speed Index
                 </h3>
                 
                 {/* Stacked Progress Bar */}
                 <div className="w-full h-8 rounded-full overflow-hidden flex border border-slate-200 shadow-inner bg-slate-100">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${cashflow.speed.onTime}%` }} transition={{ duration: 1 }} className="h-full bg-emerald-500 relative group flex items-center justify-center">
                       {cashflow.speed.onTime > 10 && <span className="text-[10px] font-black text-white">{cashflow.speed.onTime}%</span>}
                    </motion.div>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${cashflow.speed.late1to7}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-amber-400 relative group flex items-center justify-center">
                       {cashflow.speed.late1to7 > 10 && <span className="text-[10px] font-black text-white">{cashflow.speed.late1to7}%</span>}
                    </motion.div>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${cashflow.speed.late8plus}%` }} transition={{ duration: 1, delay: 0.4 }} className="h-full bg-orange-500 relative group flex items-center justify-center">
                       {cashflow.speed.late8plus > 10 && <span className="text-[10px] font-black text-white">{cashflow.speed.late8plus}%</span>}
                    </motion.div>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${cashflow.speed.uncollected}%` }} transition={{ duration: 1, delay: 0.6 }} className="h-full bg-rose-500 relative group flex items-center justify-center">
                       {cashflow.speed.uncollected > 10 && <span className="text-[10px] font-black text-white">{cashflow.speed.uncollected}%</span>}
                    </motion.div>
                 </div>

                 {/* Legend */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"/>
                     <div>
                       <p className="text-xs font-bold text-slate-900">On Time</p>
                       <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">0-1 Days</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0"/>
                     <div>
                       <p className="text-xs font-bold text-slate-900">Slightly Late</p>
                       <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">2-7 Days</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0"/>
                     <div>
                       <p className="text-xs font-bold text-slate-900">Very Late</p>
                       <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">8+ Days</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.5)]"/>
                     <div>
                       <p className="text-xs font-bold text-rose-600">Uncollected</p>
                       <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">At Risk</p>
                     </div>
                   </div>
                 </div>
              </div>

            </motion.div>

          )}
        </AnimatePresence>

      </div>

      {/* INVOICE ACTION MODAL */}
      <AnimatePresence>
        {activeInvoiceForModal && (
          <InvoiceActionModal 
            invoice={activeInvoiceForModal} 
            onClose={() => setActiveInvoiceForModal(null)}
            router={router}
            onSuccess={() => {
              setActiveInvoiceForModal(null);
              fetchLedgerData(); // Refresh the ledger behind the scenes
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------
// INVOICE ACTION MODAL (Summary, Credit, Duplicate)
// ---------------------------------------------------------

function InvoiceActionModal({ invoice, onClose, onSuccess, router }: { invoice: any, onClose: () => void, onSuccess: () => void, router: any }) {
  const [view, setView] = useState<'summary' | 'credit'>('summary');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creditReason, setCreditReason] = useState(""); // <-- ADDED REASON STATE
  
  // Safely parse line items
  const parsedItems = useMemo(() => {
    try {
      return typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : (invoice.line_items || []);
    } catch { return []; }
  }, [invoice]);

  // State for strict credit note quantities
  const [creditItems, setCreditItems] = useState<any[]>(
    parsedItems.map((item: any) => ({ ...item, credit_qty: 0 }))
  );

  const totalCreditValue = creditItems.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.credit_qty) || 0;
    const disc = Number(item.disc) || 0;
    return sum + (price * qty * (1 - disc / 100));
  }, 0);

  const handleDuplicate = () => {
    // Save to local storage so the Composer page can pick it up
    localStorage.setItem('rad_invoice_template', JSON.stringify({
      guardian_id: invoice.guardian_id,
      line_items: parsedItems,
      global_note: invoice.metadata?.global_note || ""
    }));
    router.push('/admin/finance/composer?template=true');
  };

  const handleIssueCredit = async () => {
    if (totalCreditValue <= 0) return alert("Credit amount must be greater than zero.");
    if (!creditReason.trim()) return alert("Please provide a reason for this credit note for audit purposes."); // <-- VALIDATION
    
    setIsSubmitting(true);

    try {
      const issueDate = new Date().toISOString();
      const creditRef = `CN-${Date.now().toString().slice(-6)}`;
      
      // Filter out items that have 0 credit quantity, AND append the reason to the description
      const activeCreditItems = creditItems.filter(i => i.credit_qty > 0).map(i => ({
        desc: `Credit: ${i.desc} - ${creditReason}`, // <-- REASON APPENDED TO ITEM
        price: i.price,
        qty: i.credit_qty,
        disc: i.disc
      }));

      // 1. Log Credit Note
      const { error: docError } = await supabase.from('billing_records').insert([{
        guardian_id: invoice.guardian_id,
        total_amount: totalCreditValue,
        status: 'settled',
        doc_type: 'credit_note',
        invoice_number: Date.now().toString().slice(-6),
        payment_reference: creditRef,
        created_at: issueDate,
        line_items: activeCreditItems
      }]);
      if (docError) throw docError;

      // 2. Log Offset Payment
      const { error: paymentError } = await supabase.from('payments').insert([{
        parent_id: invoice.guardian_id,
        amount: totalCreditValue,
        status: 'completed',
        description: `Applied Credit against INV-${invoice.invoice_number}. Reason: ${creditReason}`, // <-- REASON APPENDED TO LEDGER
        paid_at: issueDate,
        created_at: issueDate
      }]);
      if (paymentError) throw paymentError;

      onSuccess();
    } catch (err: any) {
      alert("Failed to issue credit: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative bg-white border border-slate-200 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
              {view === 'summary' ? `INV-${invoice.invoice_number}` : 'Issue Credit Note'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
              {view === 'summary' ? 'Invoice Summary & Actions' : `Crediting against INV-${invoice.invoice_number}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors bg-white p-2 rounded-full border border-slate-200 shadow-sm"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          {view === 'summary' ? (
            <>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-200 pb-2">Original Line Items</h4>
                <div className="space-y-3">
                  {parsedItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-700">{item.qty}x {item.desc}</span>
                      <span className="font-black text-slate-900">R {(item.price * item.qty * (1 - (item.disc || 0)/100)).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Invoice Total</span>
                  <span className="text-lg font-black text-blue-600">R {Number(invoice.total_amount).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button onClick={() => setView('credit')} className="flex flex-col items-center justify-center gap-3 p-6 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl transition-colors group">
                  <FileMinus size={24} className="text-rose-500 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <span className="block text-sm font-black text-rose-700">Issue Credit</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500/70">Partial or Full</span>
                  </div>
                </button>
                <button onClick={handleDuplicate} className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl transition-colors group">
                  <Copy size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <span className="block text-sm font-black text-blue-700">Duplicate to New</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500/70">Use as Template</span>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-500 bg-amber-50 text-amber-700 p-4 rounded-xl border border-amber-200">
                  Select the quantity of each item you wish to credit. The exact original selling prices will be maintained to ensure ledger accuracy.
                </p>
                {creditItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-xl gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-900">{item.desc}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Orig. Qty: {item.qty} @ R{item.price}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Qty to Credit:</label>
                      <input 
                        type="number" min="0" max={item.qty} value={item.credit_qty}
                        onChange={(e) => {
                          const val = Math.min(item.qty, Math.max(0, Number(e.target.value)));
                          const newItems = [...creditItems];
                          newItems[idx].credit_qty = val;
                          setCreditItems(newItems);
                        }}
                        className="w-16 bg-slate-100 border-none rounded-md px-2 py-1 text-center font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* REASON INPUT FIELD */}
              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason for Credit *</label>
                <input 
                  required type="text" placeholder="e.g. Goodwill discount, sibling dropped out, overcharged..." 
                  value={creditReason} onChange={e => setCreditReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                />
              </div>

              <div className="mt-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest text-rose-700">Total Credit Value</span>
                <span className="text-2xl font-black text-rose-600">R {totalCreditValue.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        {view === 'credit' && (
          <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-6 shrink-0">
            <button onClick={() => setView('summary')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Back</button>
            <button 
              onClick={handleIssueCredit} disabled={isSubmitting || totalCreditValue === 0 || !creditReason.trim()}
              className="bg-rose-600 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-rose-500 transition-all disabled:opacity-50 shadow-md shadow-rose-600/20 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <FileMinus size={16} />} Issue Credit Note
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}