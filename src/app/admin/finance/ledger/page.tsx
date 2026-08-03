"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Search, Filter, TrendingUp, Wallet, Receipt, 
  Clock, AlertTriangle, CheckCircle2, ChevronRight, BarChart3, FileText, 
  Users, Activity, ArrowDownToLine, ArrowUpRight, DollarSign, LayoutDashboard,
  Loader2, Target, ChevronDown, ChevronUp, Save, Settings, MessageSquare,
  X, FileMinus, Copy, Building2
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import YearlyFinancialChart from "@/components/finance/YearlyFinancialChart";
import MacroEconomicsCards from "@/components/finance/MacroEconomicsCards";
import CollectionSpeedIndex from "@/components/finance/CollectionSpeedIndex";
import MonthlyStudentChart from "@/components/finance/MonthlyStudentChart";

export default function FinanceLedgerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'cashflow'>('ledger');
  const [studentChartData, setStudentChartData] = useState<any[]>([]);
  
  // 2. Add this new state variable with your others:
  const [yearlyChartData, setYearlyChartData] = useState<any[]>([]);
  
  // Current User State to track the Admin making the changes
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Ledger Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<'all' | 'term' | 'bootcamp' | 'corporate'>('all');
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
      const sessionData = localStorage.getItem("pioneer_session");
      if (sessionData) {
        const localUser = JSON.parse(sessionData);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        if (profile) setCurrentUser(profile);
      }

      // Fetch corporate_clients and include corporate_client_id in payments
      const [profilesRes, corpClientsRes, enrollmentsRes, billingRes, paymentsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, role, linked_parent_id, metadata'),
        supabase.from('corporate_clients').select('*'), 
        supabase.from('enrollments').select('student_id, courses(title)'),
        supabase.from('billing_records').select('*').eq('doc_type', 'invoice').in('status', ['paid', 'settled', 'pending', 'overdue', 'partially_paid', 'itn_received']).order('created_at', { ascending: false }),
        supabase.from('payments').select('parent_id, corporate_client_id, amount').in('status', ['completed', 'successful', 'paid', 'settled'])
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const profiles = profilesRes.data || [];
      const corpClients = corpClientsRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const invoices = billingRes.data || [];
      const payments = paymentsRes.data || [];

      // Separate profiles
      const guardians = profiles.filter(p => p.role === 'guardian' || p.role === 'admin');
      const students = profiles.filter(p => p.role === 'student');

      const now = new Date();
      const currentYear = now.getFullYear();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // -------------------------------------------------------------
      // FETCH AND PARSE STUDENT ENROLLMENT DATA (Strict DB Read)
      // -------------------------------------------------------------
      const { data: trackerData } = await supabase
        .from('monthly_student_tracker')
        .select('*')
        .gte('tracking_month', `${currentYear}-01-01`)
        .lte('tracking_month', `${currentYear}-12-31`);

      // Initialize Array
      const studentDataArray = Array.from({ length: 12 }, (_, i) => ({
        name: new Date(currentYear, i, 1).toLocaleString('default', { month: 'short' }),
        trial_online: 0,
        term_online: 0,
        term_in_person: 0,
        bootcamp_online: 0,
        bootcamp_in_person: 0
      }));

      // Pure DB Read: If it's saved in the tracker and active, count it.
      if (trackerData) {
        trackerData.forEach(row => {
          if (!row.is_active) return;
          
          // Safely parse the "YYYY-MM-DD" string directly
          const parts = row.tracking_month.split('-');
          if (parts.length >= 2) {
            const monthIdx = parseInt(parts[1], 10) - 1; // 0-indexed for array mapping
            
            if (monthIdx >= 0 && monthIdx <= 11) {
              if (row.program === 'Trial' && row.tier === 'Online') studentDataArray[monthIdx].trial_online++;
              if (row.program === 'Term' && row.tier === 'Online') studentDataArray[monthIdx].term_online++;
              if (row.program === 'Term' && row.tier === 'In Person') studentDataArray[monthIdx].term_in_person++;
              if (row.program === 'Bootcamp' && row.tier === 'Online') studentDataArray[monthIdx].bootcamp_online++;
              if (row.program === 'Bootcamp' && row.tier === 'In Person') studentDataArray[monthIdx].bootcamp_in_person++;
            }
          }
        });
      }
      
      setStudentChartData(studentDataArray);
      
      let totalExpected = 0;
      let totalInvoiced = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;

      // Speed Tracking
      let onTimeCount = 0;
      let late1to7Count = 0;
      let late8plusCount = 0;
      // ... existing code ...
      let uncollectedCount = 0;
      let totalAssessedInvoices = 0;

      // --- NEW: Categorized Array for the Chart ---
      const monthsData = Array.from({ length: 12 }, (_, i) => ({
        name: new Date(currentYear, i, 1).toLocaleString('default', { month: 'short' }),
        billed_term: 0,
        billed_bootcamp: 0,
        billed_hardware: 0,
        paid_term: 0,
        paid_bootcamp: 0,
        paid_hardware: 0,
        uncollected: 0,
      }));

      // --- HELPER FUNCTION: Process Invoices for Macro Cashflow ---
      const accumulateCashflowStats = (myInvoices: any[]) => {
        myInvoices.forEach(inv => {
          const invDate = new Date(inv.created_at);
          const amt = Number(inv.total_amount) || 0;
          const paidAmt = Number(inv.amount_paid) || 0;
          
          if (invDate >= startOfMonth && invDate <= endOfMonth) {
            totalInvoiced += amt;
            if (inv.status === 'paid' || inv.status === 'settled') totalCollected += amt;
            else totalOutstanding += amt;
          }

          // --- CHART LOGIC: Parse Line Items & Check Payment Speed ---
          if (invDate.getFullYear() === currentYear) {
            const monthIdx = invDate.getMonth();
            
            let isPaidOnTime = false;
            if (inv.status === 'paid' || inv.status === 'settled') {
              const paidDate = new Date(inv.paid_at || inv.updated_at);
              const dueDate = inv.expires_at ? new Date(inv.expires_at) : new Date(invDate.getTime() + 24 * 60 * 60 * 1000);
              
              paidDate.setHours(0,0,0,0);
              dueDate.setHours(23,59,59,999);

              if (paidDate <= dueDate) isPaidOnTime = true;
            } else {
              monthsData[monthIdx].uncollected += (amt - paidAmt);
            }

            let items = [];
            try {
              items = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || []);
            } catch (e) {}

            if (items.length === 0) {
              monthsData[monthIdx].billed_term += amt;
              if (isPaidOnTime) monthsData[monthIdx].paid_term += amt;
            } else {
              items.forEach((item: any) => {
                const itemValue = (Number(item.price) * Number(item.qty)) * (1 - (Number(item.disc) || 0) / 100);
                const desc = (item.desc || '').toLowerCase();
                
                // TYPE-SAFE CATEGORIZATION
                if (desc.includes('bootcamp') || desc.includes('holiday')) {
                  monthsData[monthIdx].billed_bootcamp += itemValue;
                  if (isPaidOnTime) monthsData[monthIdx].paid_bootcamp += itemValue;
                } else if (desc.includes('kit') || desc.includes('micro:bit') || desc.includes('sensor') || desc.includes('hardware') || desc.includes('robotics')) {
                  monthsData[monthIdx].billed_hardware += itemValue;
                  if (isPaidOnTime) monthsData[monthIdx].paid_hardware += itemValue;
                } else {
                  monthsData[monthIdx].billed_term += itemValue;
                  if (isPaidOnTime) monthsData[monthIdx].paid_term += itemValue;
                }
              });
            }
          }

          // --- EXISTING: Global Speed Index Logic ---
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
      };

      // --- 1. PROCESS GUARDIANS ---
      const processedGuardians = guardians.map(guardian => {
        const myKids = students.filter(s => s.linked_parent_id === guardian.id);
        const myInvoices = invoices.filter(i => i.guardian_id === guardian.id);
        
        const gMeta = typeof guardian.metadata === 'string' ? JSON.parse(guardian.metadata) : (guardian.metadata || {});
        const billingSchedule = gMeta.billing_schedule || {};

        if (!billingSchedule.frequency && myInvoices.length === 0) return null;

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
        
        const plan = billingSchedule.frequency === 'termly' ? 'Term (Upfront)' 
                   : billingSchedule.frequency === 'monthly' ? 'Term (Monthly)' 
                   : isTerm ? 'Term' : 'Bootcamp';

        const lastInv = myInvoices.length > 0 ? myInvoices[0] : null;
        const myPayments = payments.filter((p: any) => p.parent_id === guardian.id);
        
        const totalBilled = myInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total_amount) || 0), 0);
        const totalPaid = myPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        let accBalance = totalBilled - totalPaid;

        let nextInvDate = "Not Set";
        let nextInvDateObj: Date | null = null;
        let expectedTermRev = 0;
        const lastAmount = lastInv ? Number(lastInv.total_amount) : 0;
        const rawNextDateStr = billingSchedule.next_invoice_date || "";

        if (billingSchedule.next_invoice_date) {
          nextInvDateObj = new Date(billingSchedule.next_invoice_date);
          nextInvDate = nextInvDateObj.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
        } else if (plan.includes('Term') && lastInv) {
          const fallbackDate = new Date(lastInv.created_at);
          fallbackDate.setMonth(fallbackDate.getMonth() + 1);
          nextInvDateObj = fallbackDate;
          nextInvDate = fallbackDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + " (Est)";
        } else if (plan === 'Bootcamp') {
          nextInvDate = "-";
        }

        if (plan.includes('Term')) {
          const invoicedThisMonth = lastInv && new Date(lastInv.created_at) >= startOfMonth && new Date(lastInv.created_at) <= endOfMonth;
          if (invoicedThisMonth) totalExpected += lastAmount;
          else if (nextInvDateObj && nextInvDateObj >= startOfMonth && nextInvDateObj <= endOfMonth) totalExpected += lastAmount; 
          
          expectedTermRev = lastAmount * (billingSchedule.frequency === 'termly' ? 1 : 3); 
        } else {
          expectedTermRev = lastAmount; 
          if (lastInv && new Date(lastInv.created_at) >= startOfMonth && new Date(lastInv.created_at) <= endOfMonth) {
            totalExpected += lastAmount; 
          }
        }

        accumulateCashflowStats(myInvoices);

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
          phone: gMeta.phone || "", 
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
          nextInvDateObj, 
          nextInvAmount: lastAmount,
          expectedTermRev,
          type: 'household'
        };
      }).filter(Boolean); 

      // --- 2. PROCESS CORPORATE CLIENTS ---
      const processedCorporate = corpClients.map(corp => {
        const myInvoices = invoices.filter(i => i.corporate_client_id === corp.id);
        
        const cMeta = typeof corp.metadata === 'string' ? JSON.parse(corp.metadata) : (corp.metadata || {});
        const billingSchedule = cMeta.billing_schedule || {};

        if (!billingSchedule.frequency && myInvoices.length === 0) return null;

        const plan = 'Corporate';
        const lastInv = myInvoices.length > 0 ? myInvoices[0] : null;
        const myPayments = payments.filter((p: any) => p.corporate_client_id === corp.id);
        
        const totalBilled = myInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total_amount) || 0), 0);
        const totalPaid = myPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        let accBalance = totalBilled - totalPaid;

        let nextInvDate = "Not Set";
        let nextInvDateObj: Date | null = null;
        let expectedTermRev = 0;
        const lastAmount = lastInv ? Number(lastInv.total_amount) : 0;
        const rawNextDateStr = billingSchedule.next_invoice_date || "";

        if (billingSchedule.next_invoice_date) {
          nextInvDateObj = new Date(billingSchedule.next_invoice_date);
          nextInvDate = nextInvDateObj.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
        } else if (lastInv) {
          const fallbackDate = new Date(lastInv.created_at);
          fallbackDate.setMonth(fallbackDate.getMonth() + 1);
          nextInvDateObj = fallbackDate;
          nextInvDate = fallbackDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + " (Est)";
        }

        const invoicedThisMonth = lastInv && new Date(lastInv.created_at) >= startOfMonth && new Date(lastInv.created_at) <= endOfMonth;
        if (invoicedThisMonth) totalExpected += lastAmount;
        else if (nextInvDateObj && nextInvDateObj >= startOfMonth && nextInvDateObj <= endOfMonth) totalExpected += lastAmount; 
        
        expectedTermRev = lastAmount * (billingSchedule.frequency === 'termly' ? 1 : 3); 

        accumulateCashflowStats(myInvoices);

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
          id: corp.id,
          // UPDATED: Using company_name precisely
          name: corp.company_name || 'Unnamed Corp',
          phone: cMeta.phone || "", 
          kids: 0,
          plan,
          billingFrequency: billingSchedule.frequency || "monthly",
          rawNextDateStr,
          balance: accBalance,
          history: currentYearHistory,
          lastStatementSent: cMeta.last_statement_sent || null,
          lastInv: lastInv ? {
            date: new Date(lastInv.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
            amount: lastAmount,
            status: lastInv.status
          } : null,
          nextInvDate,
          nextInvDateObj, 
          nextInvAmount: lastAmount,
          expectedTermRev,
          type: 'corporate'
        };
      }).filter(Boolean);

      // Merge Both Client Types
      setClients([...processedGuardians, ...processedCorporate]);

      setYearlyChartData(monthsData);

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

  const handleUpdateBillingConfig = async (clientId: string, type: 'household' | 'corporate') => {
    if (!editNextDate) {
      alert("Please select a valid Next Invoice Date.");
      return;
    }

    setSavingConfigId(clientId);
    try {
      const table = type === 'corporate' ? 'corporate_clients' : 'profiles';
      const { data: profile } = await supabase.from(table).select('metadata').eq('id', clientId).single();
      if (!profile) throw new Error("Profile not found");

      const currentMeta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
      const newMeta = {
        ...currentMeta,
        billing_schedule: {
          frequency: editFrequency,
          next_invoice_date: editNextDate
        }
      };

      const { error } = await supabase.from(table).update({ metadata: newMeta }).eq('id', clientId);
      if (error) throw error;

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#3b82f6', '#60a5fa'] });
      
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
      if (planFilter === 'corporate') result = result.filter(c => c.plan === 'Corporate');
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
                    placeholder="Search by parent or company name..." 
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
                    <option value="corporate">Corporate Clients Only</option>
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
                        <th className="px-8 py-5">Account Profile</th>
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
                                    {client.type === 'corporate' ? <Building2 size={16} /> : client.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                      {client.name} 
                                      {expandedClientId === client.id ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" />}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                      {client.type === 'corporate' ? 'B2B Client' : `${client.kids} Active ${client.kids === 1 ? 'Pioneer' : 'Pioneers'}`}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                  client.plan === 'Corporate' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
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
                                {client.plan.includes('Term') || client.plan === 'Corporate' ? (
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
                                              onClick={() => handleUpdateBillingConfig(client.id, client.type)}
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
                                              
                                              {/* WHATSAPP STATEMENT NOTIFICATION BUTTON */}
                                              <button 
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  const firstName = client.name.split(' ')[0];
                                                  const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
                                                  const amountStr = `R ${client.balance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                                  const link = `${window.location.origin}/statement/${client.id}`;
                                                  
                                                  const msg = `Dear ${firstName},\n\nFind below a link to your latest statement as at ${today}, showing an amount of ${amountStr} that is outstanding.\nIf there is a payment not reflected please let us know.\n\n${link}\n\nRegards,\nRAD Academy`;
                                                  
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
                                                    const table = client.type === 'corporate' ? 'corporate_clients' : 'profiles';
                                                    const { data: profile } = await supabase.from(table).select('metadata').eq('id', client.id).single();
                                                    if (profile) {
                                                      const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
                                                      meta.last_statement_sent = {
                                                        date: today,
                                                        amount: amountStr,
                                                        admin: currentUser?.display_name?.split(' ')[0] || 'Admin'
                                                      };
                                                      await supabase.from(table).update({ metadata: meta }).eq('id', client.id);

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

                                          {/* STATEMENT AUDIT LOG FOOTER */}
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
              
              <MacroEconomicsCards 
                cashflow={cashflow} 
                currentMonth={new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} 
              />
              
              <CollectionSpeedIndex 
                speed={cashflow.speed} 
              />

              <YearlyFinancialChart 
                data={yearlyChartData} 
              />

              {/* NEW ENROLLMENT GRAPH */}
              <MonthlyStudentChart 
                data={studentChartData} 
              />

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
  const [creditReason, setCreditReason] = useState("");
  
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
    localStorage.setItem('rad_invoice_template', JSON.stringify({
      guardian_id: invoice.guardian_id,
      corporate_client_id: invoice.corporate_client_id, // ensure it copies corp ID if applicable
      line_items: parsedItems,
      global_note: invoice.metadata?.global_note || ""
    }));
    router.push('/admin/finance/composer?template=true');
  };

  const handleIssueCredit = async () => {
    if (totalCreditValue <= 0) return alert("Credit amount must be greater than zero.");
    if (!creditReason.trim()) return alert("Please provide a reason for this credit note for audit purposes."); 
    
    setIsSubmitting(true);

    try {
      const issueDate = new Date().toISOString();
      const creditRef = `CN-${Date.now().toString().slice(-6)}`;
      
      const activeCreditItems = creditItems.filter(i => i.credit_qty > 0).map(i => ({
        desc: `Credit: ${i.desc} - ${creditReason}`, 
        price: i.price,
        qty: i.credit_qty,
        disc: i.disc
      }));

      // 1. Log Credit Note (The Paper Trail)
      const { error: docError } = await supabase.from('billing_records').insert([{
        guardian_id: invoice.guardian_id,
        corporate_client_id: invoice.corporate_client_id, // Added corp routing
        total_amount: totalCreditValue,
        status: 'settled',
        doc_type: 'credit_note',
        invoice_number: Date.now().toString().slice(-6),
        payment_reference: creditRef,
        created_at: issueDate,
        line_items: activeCreditItems
      }]);
      if (docError) throw docError;

      // 2. Log Offset Payment (The Ledger Balancer)
      const { error: paymentError } = await supabase.from('payments').insert([{
        parent_id: invoice.guardian_id, // keep for schema backwards-compatibility
        corporate_client_id: invoice.corporate_client_id,
        amount: totalCreditValue,
        status: 'completed',
        description: `Applied Credit against INV-${invoice.invoice_number}. Reason: ${creditReason}`, 
        paid_at: issueDate,
        created_at: issueDate
      }]);
      if (paymentError) throw paymentError;

      // ---------------------------------------------------------
      // 3. UPDATE ORIGINAL INVOICE (The Missing Link!)
      // ---------------------------------------------------------
      const currentPaid = Number(invoice.amount_paid) || 0;
      const newPaidAmount = currentPaid + totalCreditValue;
      const invTotal = Number(invoice.total_amount) || 0;
      
      let newStatus = invoice.status;
      if (newPaidAmount >= invTotal) {
        newStatus = 'settled'; 
      } else if (newPaidAmount > 0) {
        newStatus = 'partially_paid'; 
      }

      const { error: updateError } = await supabase
        .from('billing_records')
        .update({ 
          amount_paid: newPaidAmount,
          status: newStatus
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (err: any) {
      alert("Failed to issue credit: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isWhatsApping, setIsWhatsApping] = useState(false);

  const handleWhatsAppDocument = async () => {
    setIsWhatsApping(true);
    try {
      let phone = "";
      let name = "Client";
      
      // 1. Safe fetch using select('*') exactly like the StatementView does
      if (invoice.corporate_client_id) {
        const { data: corp, error } = await supabase.from('corporate_clients').select('*').eq('id', invoice.corporate_client_id).single();
        if (corp) {
          name = corp.contact_person?.split(' ')[0] || corp.company_name;
          const meta = typeof corp.metadata === 'string' ? JSON.parse(corp.metadata) : (corp.metadata || {});
          phone = meta.phone || corp.phone || "";
        }
      } else if (invoice.guardian_id) {
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', invoice.guardian_id).single();
        if (profile) {
          name = profile.display_name?.split(' ')[0] || "Parent";
          const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
          phone = meta.phone || profile.phone || "";
        }
      }

      // 2. Strict Check (Now it will actually pass because the data was fetched correctly)
      if (!phone) {
        alert("No phone number found for this account. Please update their profile.");
        setIsWhatsApping(false);
        return;
      }

      // 3. Format the phone number for the WhatsApp API
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '27' + cleanPhone.substring(1);

      // 4. Format the document details
      const isCredit = invoice.doc_type === 'credit_note';
      const docName = isCredit ? 'Credit Note' : 'Invoice';
      const docRef = isCredit ? (invoice.payment_reference || `CN-${invoice.invoice_number}`) : `INV-${invoice.invoice_number}`;
      const amountStr = `R ${Number(invoice.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      const link = `${window.location.origin}/invoice/${invoice.id}`;

      // 5. Construct the message and open WhatsApp
      const msg = `Dear ${name},\n\nPlease find a link to your ${docName} (${docRef}) for the amount of ${amountStr}.\n\n${link}\n\nRegards,\nRAD Academy`;

      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');

    } catch (err: any) {
      alert("Failed to prepare WhatsApp message: " + err.message);
    } finally {
      setIsWhatsApping(false);
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                
                {/* NEW: WhatsApp Button */}
                <button 
                  onClick={handleWhatsAppDocument} 
                  disabled={isWhatsApping}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isWhatsApping ? (
                    <Loader2 size={24} className="text-emerald-500 animate-spin" />
                  ) : (
                    <MessageSquare size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-center">
                    <span className="block text-sm font-black text-emerald-700">WhatsApp</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70">Send Document</span>
                  </div>
                </button>

                {/* EXISTING: Issue Credit Button */}
                <button onClick={() => setView('credit')} className="flex flex-col items-center justify-center gap-3 p-6 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl transition-colors group">
                  <FileMinus size={24} className="text-rose-500 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <span className="block text-sm font-black text-rose-700">Issue Credit</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500/70">Partial or Full</span>
                  </div>
                </button>

                {/* EXISTING: Duplicate Button */}
                <button onClick={handleDuplicate} className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl transition-colors group">
                  <Copy size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <span className="block text-sm font-black text-blue-700">Duplicate</span>
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