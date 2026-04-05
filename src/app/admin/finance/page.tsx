"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, CreditCard, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, Filter, Search, Download, 
  Plus, ChevronRight, Wallet, Receipt, Loader2, Activity, X, Shield, FileText, Printer
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Import your components
import RADBillingDocument from "@/components/finance/RADBillingDocument";
import RADStatement from "@/components/finance/RADStatement";

export default function FinancePortal() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "overdue" | "paid">("all");
  
  // WORKSPACE STATE
  const [records, setRecords] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<{ type: 'invoice' | 'statement' | 'quote', data: any } | null>(null);

  const metrics = {
    mrr: "R 32,500",
    outstanding: "R 8,400",
    activeSubscriptions: 15,
    collectionRate: "92%"
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  async function fetchFinanceData() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('billing_records')
        .select(`*, profiles(display_name)`)
        .order('created_at', { ascending: false });
        
      if (data) setRecords(data);
    } catch (err) {
      console.error("Failed to fetch records:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleViewDocument = (rec: any) => {
    setActiveDoc({
      type: rec.doc_type || 'invoice',
      data: {
        docNumber: `${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`,
        recipient: { name: rec.profiles?.display_name || "Unknown Guardian" },
        items: rec.line_items,
        date: new Date(rec.created_at).toLocaleDateString('en-ZA'),
        dueDate: rec.expires_at ? new Date(rec.expires_at).toLocaleDateString('en-ZA') : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA'),
        globalNote: rec.metadata?.global_note
      }
    });
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
      <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">Accessing_Financial_Secure_Layer...</p>
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
                <Shield size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Vault_Access_Verified</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Finance_<span className="text-emerald-500">Relay</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/admin/finance/composer">
                <button className="flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all">
                    <Plus size={14}/> Manual Invoice
                </button>
            </Link>
          </div>
        </header>

        {/* METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Monthly Revenue" value={metrics.mrr} icon={<TrendingUp size={20}/>} color="text-emerald-400" trend="+12% from last term" />
          <MetricCard title="Outstanding" value={metrics.outstanding} icon={<AlertTriangle size={20}/>} color="text-rose-400" trend="Across 4 households" />
          <MetricCard title="Active Plans" value={metrics.activeSubscriptions.toString()} icon={<Activity size={20}/>} color="text-blue-400" trend="Term 2 Enrollment" />
          <MetricCard title="Collection Rate" value={metrics.collectionRate} icon={<Wallet size={20}/>} color="text-amber-400" trend="Target: 95%" />
        </div>

        {/* MAIN LEDGER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
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
                  {records.map((rec) => (
                    <LedgerRow 
                      key={rec.id}
                      name={rec.profiles?.display_name || 'Unknown Entity'} 
                      type={rec.doc_type === 'quote' ? 'Quotation' : 'Invoice'} 
                      amount={`R ${rec.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                      status={rec.status.charAt(0).toUpperCase() + rec.status.slice(1)} 
                      refId={`${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`} 
                      onClick={() => handleViewDocument(rec)} 
                    />
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-sm">No financial records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RECENT ACTIVITY SIDEBAR */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 border-b border-white/5 pb-6">
                <Receipt size={18} className="text-emerald-500"/> Recent Activity
              </h3>
              <div className="space-y-6">
                <TransactionItem name="Alfred Thompson" amount="+ R2000.00" time="2h ago" type="EFT" />
                <TransactionItem name="Sarah Jenkins" amount="+ R750.00" time="1d ago" type="Card" />
                <TransactionItem name="Michael Khumalo" amount="+ R2000.00" time="3d ago" type="EFT" />
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
                   <button className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white border border-white/10 transition-all"><Printer size={20}/></button>
                   <button onClick={() => setActiveDoc(null)} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white border border-white/10 transition-all"><X size={24}/></button>
                </div>
              </div>

              <div className="flex-1">
                {activeDoc.type === 'statement' ? (
                  <RADStatement {...activeDoc.data} />
                ) : (
                  <RADBillingDocument type={activeDoc.type as any} {...activeDoc.data} />
                )}
              </div>

              <div className="pt-6 border-t border-white/5 flex gap-4">
                 <button className="flex-1 py-4 bg-emerald-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-emerald-500 transition-all">Transmit to Parent Email</button>
                 <button className="px-10 py-4 bg-white/5 rounded-2xl font-black uppercase italic tracking-widest border border-white/10 hover:bg-white/10">Download PDF</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Internal Page UI Components ---

function MetricCard({ title, value, icon, color, trend }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/10 p-6 rounded-[32px] shadow-xl space-y-4">
      <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
        <p className="text-3xl font-black tracking-tight mt-1">{value}</p>
      </div>
      <p className="text-[10px] font-bold text-slate-400 italic">{trend}</p>
    </div>
  );
}

function LedgerRow({ name, type, amount, status, refId, onClick }: any) {
  const isOverdue = status === 'Overdue';
  const isQuote = type === 'Quotation';
  const isAccepted = status === 'Accepted';
  const isDeclined = status === 'Declined';

  return (
    <tr onClick={onClick} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
      <td className="px-8 py-6">
        <p className="font-bold text-white text-sm">{name}</p>
        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{refId}</p>
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
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          {status}
        </span>
      </td>
    </tr>
  );
}

function TransactionItem({ name, amount, time, type }: any) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        <div>
          <p className="text-xs font-bold text-white">{name}</p>
          <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">{type} • {time}</p>
        </div>
      </div>
      <span className="text-xs font-black text-emerald-400">{amount}</span>
    </div>
  );
}