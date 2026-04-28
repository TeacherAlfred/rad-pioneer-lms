"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Search, Wallet, CheckCircle2, AlertTriangle, 
  Receipt, Loader2, ArrowRight, Coins, RefreshCw, Save,
  Building2, User, Calendar, MessageSquare
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

export default function PaymentCapturePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data State
  const [clientMode, setClientMode] = useState<'b2c' | 'b2b'>('b2c');
  const [guardians, setGuardians] = useState<any[]>([]);
  const [corporateClients, setCorporateClients] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuardian, setSelectedGuardian] = useState<any | null>(null);
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Allocation Engine State
  const [totalReceived, setTotalReceived] = useState<string>("");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const [guardiansRes, corporateRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, metadata').in('role', ['guardian', 'admin']).order('display_name', { ascending: true }),
        supabase.from('corporate_clients').select('*').order('company_name', { ascending: true })
      ]);
      
      if (guardiansRes.data) setGuardians(guardiansRes.data);
      if (corporateRes.data) setCorporateClients(corporateRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedGuardian) {
      setInvoices([]);
      setAllocations({});
      setTotalReceived("");
      return;
    }

    async function loadInvoices() {
      setIsLoadingInvoices(true);
      try {
        // Query intelligently based on whether it's a household or a company
        const columnToQuery = selectedGuardian.isB2B ? 'corporate_client_id' : 'guardian_id';

        const { data } = await supabase
          .from('billing_records')
          .select('*')
          .eq(columnToQuery, selectedGuardian.id)
          .eq('doc_type', 'invoice')
          .in('status', ['pending', 'overdue', 'partially_paid'])
          .order('created_at', { ascending: true }); 

        if (data) {
          const enrichedInvoices = data.map(inv => ({
            ...inv,
            outstanding: Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid || 0))
          })).filter(inv => inv.outstanding > 0);

          setInvoices(enrichedInvoices);
          setAllocations({}); 
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingInvoices(false);
      }
    }

    loadInvoices();
  }, [selectedGuardian]);

  // --- ALLOCATION MATH ---
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  }, [allocations]);

  const unallocatedCredit = useMemo(() => {
    return (Number(totalReceived) || 0) - totalAllocated;
  }, [totalReceived, totalAllocated]);

  const totalOutstanding = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
  }, [invoices]);

  const projectedBalance = useMemo(() => {
    return Math.max(0, totalOutstanding - totalAllocated);
  }, [totalOutstanding, totalAllocated]);

  // --- ENGINE ACTIONS ---
  const handleSelectClient = (client: any, isB2B: boolean) => {
    if (isB2B) {
      setSelectedGuardian({
        id: client.id,
        isB2B: true,
        display_name: client.company_name,
        contact_person: client.contact_person,
        phone: client.phone,
        email: client.email,
        metadata: { email: client.email, phone: client.phone }
      });
    } else {
      setSelectedGuardian({ ...client, isB2B: false });
    }
  };

  const handleAutoAllocate = () => {
    let remainingToAllocate = Number(totalReceived) || 0;
    const newAllocations: Record<string, number> = {};

    invoices.forEach(inv => {
      if (remainingToAllocate <= 0) {
        newAllocations[inv.id] = 0;
        return;
      }
      const allocateAmt = Math.min(remainingToAllocate, inv.outstanding);
      newAllocations[inv.id] = allocateAmt;
      remainingToAllocate -= allocateAmt;
    });

    setAllocations(newAllocations);
  };

  const handleManualAllocation = (invoiceId: string, amount: string) => {
    const numValue = Math.max(0, Number(amount) || 0);
    const invoice = invoices.find(i => i.id === invoiceId);
    
    const cappedValue = Math.min(numValue, invoice?.outstanding || 0);

    setAllocations(prev => ({
      ...prev,
      [invoiceId]: cappedValue
    }));
  };

  const handleProcessPayment = async (sendWhatsApp: boolean = false) => {
    const rcvAmt = Number(totalReceived) || 0;
    if (rcvAmt <= 0) return alert("Please enter a valid received amount.");
    if (unallocatedCredit < 0) return alert("You have allocated more funds than you received. Please check your math.");
    if (!paymentDate) return alert("Please select a payment date.");

    setIsProcessing(true);
    try {
      const parsedDate = new Date(paymentDate).toISOString();

      // 1. Create the Master Payment Record (Dynamic ID target)
      const { data: paymentRecord, error: payErr } = await supabase
        .from('payments')
        .insert([{
          parent_id: selectedGuardian.isB2B ? null : selectedGuardian.id,
          corporate_client_id: selectedGuardian.isB2B ? selectedGuardian.id : null,
          amount: rcvAmt,
          status: 'completed',
          description: paymentRef ? `Payment Ref: ${paymentRef}${unallocatedCredit > 0 ? ` (Incl. R${unallocatedCredit} Credit)` : ''}` : `Manual Allocation${unallocatedCredit > 0 ? ` (Incl. R${unallocatedCredit} Credit)` : ''}`,
          paid_at: parsedDate,
          created_at: parsedDate
        }])
        .select('id')
        .single();

      if (payErr) throw payErr;

      // 2. Process Allocations & Update Invoices
      const allocationPromises = [];
      const invoiceUpdates = [];

      for (const [invId, allocAmt] of Object.entries(allocations)) {
        if (allocAmt > 0) {
          allocationPromises.push(
            supabase.from('payment_allocations').insert([{
              payment_id: paymentRecord.id,
              invoice_id: invId,
              amount_allocated: allocAmt,
              created_at: parsedDate
            }])
          );

          const inv = invoices.find(i => i.id === invId);
          if (inv) {
            const newPaidAmt = Number(inv.amount_paid || 0) + allocAmt;
            const isFullyPaid = newPaidAmt >= Number(inv.total_amount);
            
            invoiceUpdates.push(
              supabase.from('billing_records').update({
                amount_paid: newPaidAmt,
                status: isFullyPaid ? 'paid' : 'partially_paid'
              }).eq('id', invId)
            );
          }
        }
      }

      await Promise.all([...allocationPromises, ...invoiceUpdates]);

      // 3. WHATSAPP NOTIFICATION LOGIC
      if (sendWhatsApp) {
        // Address contact person if B2B, otherwise guardian
        const firstName = selectedGuardian.isB2B 
            ? selectedGuardian.contact_person.split(' ')[0] 
            : selectedGuardian.display_name.split(' ')[0];
            
        const amountStr = `R ${rcvAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const balanceStr = `R ${projectedBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        const msg = `Dear ${firstName},\n\nThank you for your payment that has been received today.\n\nAn amount of ${amountStr} has been received and will be allocated to your account. Leaving your balance at ${balanceStr}.\n\nRegards,\nRAD Academy Team`;
        
        let phoneParam = "";
        const phoneRaw = selectedGuardian.metadata?.phone || selectedGuardian.phone;
        if (phoneRaw) {
            let cleanPhone = phoneRaw.replace(/\D/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '27' + cleanPhone.substring(1);
            phoneParam = cleanPhone;
        }
        
        window.open(`https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`, '_blank');
      }

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#34d399', '#ffffff'] });
      setSuccessMsg(`Successfully processed R ${rcvAmt.toLocaleString()} and updated ledger.`);
      
      setTimeout(() => {
        setSelectedGuardian(null);
        setTotalReceived("");
        setPaymentRef("");
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setSuccessMsg(null);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      alert("Error processing payment: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- RENDERING ---
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clientMode === 'b2c' ? guardians : corporateClients;
    const lower = searchQuery.toLowerCase();
    
    if (clientMode === 'b2c') {
      return guardians.filter(g => 
        g.display_name.toLowerCase().includes(lower) || 
        (g.metadata?.email || "").toLowerCase().includes(lower)
      );
    } else {
      return corporateClients.filter(c => 
        c.company_name.toLowerCase().includes(lower) || 
        c.contact_person.toLowerCase().includes(lower)
      );
    }
  }, [guardians, corporateClients, searchQuery, clientMode]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-blue-600 font-bold uppercase tracking-widest text-xs">Initializing Allocation Engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-4">
            <Link href="/admin/finance" className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-400 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Finance Hub</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <Coins size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Accounts_Receivable</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Payment <span className="text-emerald-500">Capture</span>
              </h1>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: CLIENT SELECTION */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col h-[600px]">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <User size={16} className="text-blue-500"/> 1. Select Account
              </h3>
              
              {/* B2C vs B2B Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mb-4 shrink-0">
                <button 
                  onClick={() => { setClientMode('b2c'); setSelectedGuardian(null); setSearchQuery(""); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${clientMode === 'b2c' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <User size={12}/> Household
                </button>
                <button 
                  onClick={() => { setClientMode('b2b'); setSelectedGuardian(null); setSearchQuery(""); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${clientMode === 'b2b' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Building2 size={12}/> Corporate
                </button>
              </div>

              <div className="relative mb-4 group shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder={`Search ${clientMode === 'b2c' ? 'parent' : 'company'}...`} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-inner"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {filteredClients.map(c => {
                  const isSelected = selectedGuardian?.id === c.id;
                  const displayName = clientMode === 'b2c' ? c.display_name : c.company_name;
                  const subText = clientMode === 'b2c' ? (c.metadata?.email || "No email") : c.contact_person;

                  return (
                    <div 
                      key={c.id}
                      onClick={() => handleSelectClient(c, clientMode === 'b2b')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected 
                        ? 'bg-blue-50 border-blue-300 shadow-md ring-1 ring-blue-500' 
                        : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <p className={`font-black text-sm leading-tight ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                        {displayName}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 truncate mt-1">{subText}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: ALLOCATION ENGINE */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {!selectedGuardian ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-[600px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[32px] bg-white/50">
                  <Wallet size={48} className="text-slate-300 mb-4" />
                  <p className="text-slate-500 font-bold">Select an account from the left to capture a payment.</p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  
                  {/* AMOUNT RECEIVED CARD */}
                  <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Wallet size={120} /></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between">
                      <div className="flex-1">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <Coins size={16} className="text-emerald-500"/> 2. Enter Amount Received
                        </h3>
                        <div className="relative mb-6">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-2xl">R</span>
                          <input 
                            type="number" 
                            placeholder="0.00"
                            value={totalReceived}
                            onChange={(e) => setTotalReceived(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-6 py-6 text-4xl font-black text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-inner"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 flex items-center gap-1"><Calendar size={10}/> Date Received</label>
                            <input 
                              type="date" 
                              value={paymentDate}
                              onChange={(e) => setPaymentDate(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Payment Reference</label>
                            <input 
                              type="text" 
                              placeholder="e.g. EFT 15 May"
                              value={paymentRef}
                              onChange={(e) => setPaymentRef(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="md:w-64 flex flex-col justify-end">
                         {unallocatedCredit > 0 && (
                           <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl animate-pulse">
                             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Account Credit</p>
                             <p className="text-2xl font-black text-emerald-700">+ R {unallocatedCredit.toLocaleString()}</p>
                           </div>
                         )}
                         {unallocatedCredit < 0 && (
                           <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl animate-pulse">
                             <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Over Allocated</p>
                             <p className="text-2xl font-black text-rose-700">R {Math.abs(unallocatedCredit).toLocaleString()}</p>
                           </div>
                         )}
                         {unallocatedCredit === 0 && Number(totalReceived) > 0 && (
                           <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                             <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1 flex items-center gap-1"><CheckCircle2 size={12}/> Perfectly Balanced</p>
                             <p className="text-2xl font-black text-blue-700">R 0.00</p>
                           </div>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* INVOICE ALLOCATION LIST */}
                  <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Receipt size={16} className="text-blue-500"/> 3. Distribute Funds
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">Total Outstanding: R {totalOutstanding.toLocaleString()}</p>
                      </div>
                      <button 
                        onClick={handleAutoAllocate}
                        disabled={!totalReceived || Number(totalReceived) <= 0}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 flex items-center gap-2 transition-all disabled:opacity-50 shadow-md"
                      >
                        <RefreshCw size={14} /> Auto-Allocate (Oldest First)
                      </button>
                    </div>

                    <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {isLoadingInvoices ? (
                        <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300"/></div>
                      ) : invoices.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 font-bold italic">No outstanding invoices found for this account.</div>
                      ) : (
                        invoices.map(inv => {
                          const allocatedAmt = allocations[inv.id] || 0;
                          const isFullyAllocated = allocatedAmt >= inv.outstanding;

                          return (
                            <div key={inv.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                              allocatedAmt > 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200'
                            }`}>
                              <div>
                                <p className="font-black text-slate-900">INV-{inv.invoice_number}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-slate-500">{new Date(inv.created_at).toLocaleDateString('en-ZA')}</span>
                                  <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">{inv.line_items?.[0]?.desc || 'Standard Invoice'}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due</p>
                                  <p className="font-bold text-slate-700">R {inv.outstanding.toLocaleString()}</p>
                                </div>
                                <div className="relative w-32 shrink-0">
                                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm ${isFullyAllocated ? 'text-emerald-500' : 'text-slate-400'}`}>R</span>
                                  <input 
                                    type="number"
                                    min="0"
                                    max={inv.outstanding}
                                    value={allocatedAmt || ""}
                                    onChange={(e) => handleManualAllocation(inv.id, e.target.value)}
                                    className={`w-full border rounded-xl py-2 pl-8 pr-3 text-right font-black outline-none transition-colors ${
                                      isFullyAllocated 
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 focus:border-emerald-500' 
                                      : allocatedAmt > 0 
                                      ? 'bg-blue-50 border-blue-300 text-blue-700 focus:border-blue-500'
                                      : 'bg-white border-slate-200 text-slate-900 focus:border-blue-400'
                                    }`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* PROJECTED BALANCE FOOTER */}
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Current Balance</p>
                          <p className="text-sm font-bold text-slate-500 line-through">R {totalOutstanding.toLocaleString()}</p>
                        </div>
                        <ArrowRight size={14} className="text-slate-300 shrink-0" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-0.5">Projected Balance</p>
                          <p className="text-2xl font-black text-slate-900">R {projectedBalance.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <button 
                          onClick={() => handleProcessPayment(false)}
                          disabled={isProcessing || Number(totalReceived) <= 0 || unallocatedCredit < 0}
                          className="w-full sm:w-auto px-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Just Process
                        </button>
                        <button 
                          onClick={() => handleProcessPayment(true)}
                          disabled={isProcessing || Number(totalReceived) <= 0 || unallocatedCredit < 0}
                          className="w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:bg-emerald-500 flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <MessageSquare size={16}/>} Process & Notify
                        </button>
                      </div>
                    </div>

                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* SUCCESS TOAST */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 right-10 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm"
          >
            <CheckCircle2 size={20} /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}