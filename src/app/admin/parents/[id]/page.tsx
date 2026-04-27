"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Coins, Plus, Minus, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import ParentDashboard from "@/components/ParentDashboard"; 
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// THE SECURE CREDIT MANAGER WIDGET (ONLY VISIBLE TO ADMINS)
// ============================================================================
function CreditManagerWidget({ guardianId, adminId, currentCredits, onCreditsUpdated }: { guardianId: string, adminId: string, currentCredits: number, onCreditsUpdated: () => void }) {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState<number | string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (guardianId) fetchLedger();
  }, [guardianId]);

  const fetchLedger = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_ledger')
        .select('*, profiles:admin_id(display_name)')
        .eq('guardian_id', guardianId)
        .order('created_at', { ascending: false })
        .limit(5); // Show last 5 transactions
      
      if (!error && data) setLedger(data);
    } catch (err) {
      console.error("Failed to fetch ledger", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount === 0) return alert("Amount cannot be zero.");
    if (!reason.trim()) return alert("You must provide an audit reason.");

    setIsSubmitting(true);
    try {
      // 1. Insert into Audit Ledger
      const { error: ledgerErr } = await supabase.from('credit_ledger').insert([{
        guardian_id: guardianId,
        admin_id: adminId,
        amount: numAmount,
        reason: reason.trim()
      }]);
      if (ledgerErr) throw ledgerErr;

      // 2. Fetch latest metadata to ensure we don't overwrite anything else
      const { data: profile, error: profErr } = await supabase.from('profiles').select('metadata').eq('id', guardianId).single();
      if (profErr) throw profErr;

      const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
      const newBalance = Math.max(0, (meta.booking_credits || 0) + numAmount); // Prevent negative balances
      meta.booking_credits = newBalance;

      // 3. Update the Parent Profile
      const { error: updateErr } = await supabase.from('profiles').update({ metadata: meta }).eq('id', guardianId);
      if (updateErr) throw updateErr;

      // 4. Cleanup & Refresh
      setAmount("");
      setReason("");
      setIsModalOpen(false);
      await fetchLedger();
      onCreditsUpdated(); // Forces the ParentDashboard below to refresh
      
    } catch (err: any) {
      alert("Provisioning failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-blue-500/20 rounded-[32px] p-8 shadow-xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
        <Coins size={200} />
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 relative z-10">
        <div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-white flex items-center gap-2">
            <Coins className="text-blue-500" /> Digital Inventory
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Lesson Booking Credits</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-4xl font-black text-white leading-none tracking-tighter">{currentCredits || 0}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mt-1">Active Balance</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:scale-105"
          >
            Provision Credits
          </button>
        </div>
      </div>

      {/* Mini Audit Trail */}
      <div className="space-y-4 relative z-10">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Recent Ledger Activity</h4>
        {loading ? (
          <div className="py-4 flex justify-center"><Loader2 className="animate-spin text-slate-600" size={20}/></div>
        ) : ledger.length === 0 ? (
          <p className="text-xs font-bold text-slate-600 italic py-2">No credit transactions on file.</p>
        ) : (
          <div className="space-y-2">
            {ledger.map(entry => (
              <div key={entry.id} className="flex items-center justify-between bg-[#020617] p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${entry.amount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {entry.amount > 0 ? <Plus size={14}/> : <Minus size={14}/>}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-300">{entry.reason}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">
                      {new Date(entry.created_at).toLocaleDateString()} by {entry.profiles?.display_name?.split(' ')[0] || 'System'}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-black ${entry.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Provisioning Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[#0f172a] border border-blue-500/30 rounded-[32px] shadow-2xl overflow-hidden p-8 flex flex-col">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Adjust Balance</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Audit Ledger Entry</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Amount to Add/Remove</label>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    placeholder="e.g. 2 or -1"
                    className="w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-lg font-black text-white outline-none focus:border-blue-500 transition-colors shadow-inner" 
                  />
                  <p className="text-[9px] text-slate-500 italic ml-2">Use negative numbers (e.g., -1) to revoke credits.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 flex items-center gap-1"><FileText size={10}/> Audit Reason</label>
                  <textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    placeholder="e.g. 'EFT payment cleared for 2 lessons' or 'Complimentary makeup lesson'"
                    className="w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-slate-300 outline-none focus:border-blue-500 transition-colors resize-none min-h-[100px] shadow-inner" 
                  />
                </div>

                <button 
                  onClick={handleProvision}
                  disabled={isSubmitting || !amount || !reason.trim()}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:hover:scale-100 hover:scale-105"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm Transaction
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// THE MAIN PAGE WRAPPER
// ============================================================================
export default function AdminParentViewerPage() {
  const params = useParams();
  const parentId = params?.id as string;
  
  // State to handle the Admin/Parent link & dynamic UI refreshes
  const [adminId, setAdminId] = useState<string | null>(null);
  const [parentCredits, setParentCredits] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    const fetchAdminAndParent = async () => {
      // Get Admin ID from session
      const sessionData = localStorage.getItem("pioneer_session");
      if (sessionData) {
        const localUser = JSON.parse(sessionData);
        setAdminId(localUser.id);
      }
      
      // Get Parent Credit Balance
      if (parentId) {
        const { data } = await supabase.from('profiles').select('metadata').eq('id', parentId).single();
        if (data) {
          const meta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : (data.metadata || {});
          setParentCredits(meta.booking_credits || 0);
        }
      }
    };
    fetchAdminAndParent();
  }, [parentId, refreshKey]);

  if (!parentId) return null;

  return (
    <div className="min-h-screen bg-[#020617] pb-20 selection:bg-blue-500/30">
      {/* PERSISTENT ADMIN WARNING BANNER */}
      <div className="sticky top-0 z-[100] bg-pink-500 text-black px-6 py-3 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <ShieldAlert size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Admin Override Active - Viewing as Parent</span>
        </div>
        <Link 
          href="/admin/parents" 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-black/10 hover:bg-black/20 px-4 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft size={14} /> Exit View
        </Link>
      </div>

      {/* ADMIN-ONLY CREDIT INJECTOR */}
      <div className="max-w-5xl mx-auto px-6 lg:px-0 pt-10">
        {adminId && (
          <CreditManagerWidget 
            guardianId={parentId} 
            adminId={adminId} 
            currentCredits={parentCredits} 
            onCreditsUpdated={() => setRefreshKey(k => k + 1)} 
          />
        )}
      </div>

      {/* THE ACTUAL PARENT DASHBOARD */}
      <div className="pt-8">
        <ParentDashboard key={refreshKey} parentId={parentId} />
      </div>
    </div>
  );
}