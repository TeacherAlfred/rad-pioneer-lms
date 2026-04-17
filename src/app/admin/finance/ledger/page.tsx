"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Search, Filter, TrendingUp, Wallet, Receipt, 
  Clock, AlertTriangle, CheckCircle2, ChevronRight, BarChart3,
  Users, Activity, ArrowDownToLine, ArrowUpRight, DollarSign, LayoutDashboard,
  Loader2, Target // <-- Added missing imports
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function FinanceLedgerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'cashflow'>('ledger');
  
  // Ledger Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<'all' | 'term' | 'bootcamp'>('all');
  const [sortConfig, setSortConfig] = useState<'balance' | 'next_inv' | 'name'>('balance');

  // Processed Data
  const [clients, setClients] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any>({
    expected: 0, invoiced: 0, collected: 0, outstanding: 0,
    speed: { onTime: 0, late1to7: 0, late8plus: 0, uncollected: 0 }
  });

  useEffect(() => {
    fetchLedgerData();
  }, []);

  async function fetchLedgerData() {
    setLoading(true);
    try {
      const [profilesRes, enrollmentsRes, billingRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, role, linked_parent_id, metadata'),
        supabase.from('enrollments').select('student_id, courses(title)'),
        supabase.from('billing_records').select('*').eq('doc_type', 'invoice').order('created_at', { ascending: false })
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const profiles = profilesRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const invoices = billingRes.data || [];

      // Separate profiles
      const guardians = profiles.filter(p => p.role === 'guardian' || p.role === 'admin');
      const students = profiles.filter(p => p.role === 'student');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
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
        if (myKids.length === 0) return null;

        // Determine Plan Type (If any kid is in a non-bootcamp course, they are 'Term')
        let isTerm = false;
        myKids.forEach(kid => {
          const myEnrollments = enrollments.filter(e => e.student_id === kid.id);
          myEnrollments.forEach(enr => {
            // FIX: Cast to any to prevent TypeScript "never" error on Supabase relational joins
            const courses: any = enr.courses;
            const courseTitle = Array.isArray(courses) ? courses[0]?.title : courses?.title;
            if (courseTitle && !courseTitle.toLowerCase().includes('bootcamp')) {
              isTerm = true;
            }
          });
        });
        const plan = isTerm ? 'Term' : 'Bootcamp';

        // Financials
        const myInvoices = invoices.filter(i => i.guardian_id === guardian.id);
        const lastInv = myInvoices.length > 0 ? myInvoices[0] : null;
        
        let accBalance = 0;
        myInvoices.forEach(inv => {
          const amt = Number(inv.total_amount) || 0;
          if (inv.status === 'pending' || inv.status === 'overdue') {
            accBalance += amt;
          }
        });

        // Projections
        let nextInvDate = "-";
        let nextInvAmount = 0;
        let expectedTermRev = 0;
        const lastAmount = lastInv ? Number(lastInv.total_amount) : 0;

        if (plan === 'Term') {
          if (lastInv) {
            const d = new Date(lastInv.created_at);
            d.setMonth(d.getMonth() + 1);
            nextInvDate = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
            nextInvAmount = lastAmount; // Assuming recurring flat rate
          }
          // Approx 3 months left in term for projection
          expectedTermRev = nextInvAmount * 3;
          totalExpected += nextInvAmount; // Add to monthly MRR expected
        } else {
          // Bootcamp logic (One-off)
          expectedTermRev = lastAmount; // Just the flat fee
          if (lastInv && new Date(lastInv.created_at) >= startOfMonth) {
            totalExpected += lastAmount; // Only expected if generated this month
          }
        }

        // Add to Cashflow Macrostats (Month Specific)
        myInvoices.forEach(inv => {
          const invDate = new Date(inv.created_at);
          const amt = Number(inv.total_amount) || 0;
          
          if (invDate >= startOfMonth) {
            totalInvoiced += amt;
            if (inv.status === 'paid' || inv.status === 'settled') totalCollected += amt;
            else totalOutstanding += amt;
          }

          // Collection Speed Logic (Lifetime)
          if (amt > 0) {
            totalAssessedInvoices++;
            if (inv.status === 'paid' || inv.status === 'settled') {
              // Approximate payment delay based on updated_at vs created_at
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

        return {
          id: guardian.id,
          name: guardian.display_name,
          kids: myKids.length,
          plan,
          balance: accBalance,
          lastInv: lastInv ? {
            date: new Date(lastInv.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
            amount: lastAmount,
            status: lastInv.status
          } : null,
          nextInvDate,
          nextInvAmount,
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

  // --- Filtering & Sorting ---
  const displayedClients = useMemo(() => {
    let result = [...clients];

    // Filter Plan
    if (planFilter !== 'all') {
      result = result.filter(c => c.plan.toLowerCase() === planFilter);
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
                    <option value="term">Term Only</option>
                    <option value="bootcamp">Bootcamps Only</option>
                  </select>
                  <select 
                    value={sortConfig} 
                    onChange={e => setSortConfig(e.target.value as any)}
                    className="bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-2xl px-4 py-3 outline-none focus:border-blue-500 shadow-sm cursor-pointer flex-1 md:flex-none"
                  >
                    <option value="balance">Sort: Highest Debt</option>
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
                          <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm border border-blue-100 shrink-0 group-hover:scale-110 transition-transform">
                                  {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{client.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{client.kids} Active {client.kids === 1 ? 'Pioneer' : 'Pioneers'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6">
                              <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                client.plan === 'Term' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'
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
                              {client.plan === 'Term' && client.nextInvDate !== '-' ? (
                                <div>
                                  <p className="text-sm font-bold text-slate-700">R {client.nextInvAmount.toLocaleString()}</p>
                                  <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest flex items-center gap-1">
                                    <Clock size={10}/> Due {client.nextInvDate}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-bold">-</span>
                              )}
                            </td>
                            <td className="px-8 py-6 text-right">
                              <p className="text-sm font-black text-slate-900">R {client.expectedTermRev.toLocaleString()}</p>
                            </td>
                          </tr>
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
    </div>
  );
}