"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Search, Wallet, CheckCircle2, AlertTriangle,
  Receipt, Loader2, ArrowRight, Coins, RefreshCw, Save,
  User, Calendar, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

const PAYMENT_METHODS = ["eft", "cash", "card", "other"];

export default function PaymentCaptureV2Page() {
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const [totalReceived, setTotalReceived] = useState<string>("");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState("eft");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const t = setTimeout(async () => {
        const res = await fetch(`/admin/api/finance-v2/leads?q=${encodeURIComponent(searchQuery)}`);
        const { leads: found } = await res.json();
        setLeads(found || []);
      }, 250);
      return () => clearTimeout(t);
    } else {
      setLeads([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedLead) {
      setInvoices([]);
      setAllocations({});
      setTotalReceived("");
      return;
    }
    (async () => {
      setIsLoadingInvoices(true);
      const res = await fetch(`/admin/api/finance-v2/leads/${selectedLead.id}/invoices`);
      const { invoices: found } = await res.json();
      setInvoices(found || []);
      setAllocations({});
      setIsLoadingInvoices(false);
    })();
  }, [selectedLead]);

  const totalAllocated = useMemo(() => Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0), [allocations]);
  const unallocatedCredit = useMemo(() => (Number(totalReceived) || 0) - totalAllocated, [totalReceived, totalAllocated]);
  const totalOutstanding = useMemo(() => invoices.reduce((sum, inv) => sum + inv.outstanding, 0), [invoices]);
  const projectedBalance = useMemo(() => Math.max(0, totalOutstanding - totalAllocated), [totalOutstanding, totalAllocated]);

  function handleAutoAllocate() {
    let remaining = Number(totalReceived) || 0;
    const next: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (remaining <= 0) { next[inv.id] = 0; return; }
      const amt = Math.min(remaining, inv.outstanding);
      next[inv.id] = amt;
      remaining -= amt;
    });
    setAllocations(next);
  }

  function handleManualAllocation(invoiceId: string, amount: string) {
    const numValue = Math.max(0, Number(amount) || 0);
    const invoice = invoices.find((i) => i.id === invoiceId);
    setAllocations((prev) => ({ ...prev, [invoiceId]: Math.min(numValue, invoice?.outstanding || 0) }));
  }

  async function handleProcessPayment(sendWhatsApp: boolean) {
    const rcvAmt = Number(totalReceived) || 0;
    if (rcvAmt <= 0) return alert("Please enter a valid received amount.");
    if (unallocatedCredit < 0) return alert("You have allocated more funds than you received. Please check your math.");
    if (!paymentDate) return alert("Please select a payment date.");

    setIsProcessing(true);
    try {
      const parsedDate = new Date(paymentDate).toISOString();

      // Note: any unallocated portion (received > allocated) is simply not
      // recorded anywhere this pass - there's no lead-linked credit-ledger
      // equivalent yet (credit_ledger is guardian_id-based, old model).
      const captureRes = await fetch("/admin/api/finance-v2/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          allocations,
          method: paymentMethod,
          reference: paymentRef,
          received_at: parsedDate,
        }),
      });
      const captureJson = await captureRes.json();
      if (!captureRes.ok) throw new Error(captureJson.error || "Failed to process payment");

      if (sendWhatsApp && selectedLead.phone) {
        const firstName = (selectedLead.name || "there").split(" ")[0];
        const amountStr = `R ${rcvAmt.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
        const balanceStr = `R ${projectedBalance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
        const msg = `Dear ${firstName},\n\nThank you for your payment received today.\n\nAn amount of ${amountStr} has been received and allocated to your account, leaving your balance at ${balanceStr}.\n\nRegards,\nRAD Academy Team`;
        let cleanPhone = selectedLead.phone.replace(/\D/g, "");
        if (cleanPhone.startsWith("0")) cleanPhone = "27" + cleanPhone.substring(1);
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      }

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ["#10b981", "#34d399", "#ffffff"] });
      setSuccessMsg(`Successfully processed R ${rcvAmt.toLocaleString()}.`);
      setTimeout(() => {
        setSelectedLead(null);
        setTotalReceived("");
        setPaymentRef("");
        setPaymentDate(new Date().toISOString().split("T")[0]);
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      alert("Error processing payment: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-blue-600 font-bold uppercase tracking-widest text-xs">Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-4">
            <Link href="/admin/dashboard-v2" className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-400 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Dashboard v2</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <Coins size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Manual Payment Capture</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Payment <span className="text-emerald-500">Capture</span> <span className="text-cyan-500 text-lg align-top">v2</span>
              </h1>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col h-[600px]">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <User size={16} className="text-blue-500" /> 1. Select Lead
              </h3>
              <div className="relative mb-4 group shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Search leads..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-inner" />
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {leads.map((l) => {
                  const isSelected = selectedLead?.id === l.id;
                  return (
                    <div key={l.id} onClick={() => setSelectedLead(l)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? "bg-blue-50 border-blue-300 shadow-md ring-1 ring-blue-500" : "bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50"}`}>
                      <p className={`font-black text-sm leading-tight ${isSelected ? "text-blue-700" : "text-slate-900"}`}>{l.name || "Unnamed"}</p>
                      <p className="text-[10px] font-bold text-slate-400 truncate mt-1">{l.phone}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {!selectedLead ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-[600px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[32px] bg-white/50">
                  <Wallet size={48} className="text-slate-300 mb-4" />
                  <p className="text-slate-500 font-bold">Select a lead from the left to capture a payment.</p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between">
                      <div className="flex-1">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <Coins size={16} className="text-emerald-500" /> 2. Enter Amount Received
                        </h3>
                        <div className="relative mb-6">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-2xl">R</span>
                          <input type="number" placeholder="0.00" value={totalReceived} onChange={(e) => setTotalReceived(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-6 py-6 text-4xl font-black text-slate-900 focus:outline-none focus:border-emerald-500 shadow-inner" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 flex items-center gap-1"><Calendar size={10} /> Date</label>
                            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Method</label>
                            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm">
                              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Reference</label>
                            <input type="text" placeholder="e.g. EFT 15 May" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="md:w-56 flex flex-col justify-end">
                        {unallocatedCredit > 0 && (
                          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Unallocated</p>
                            <p className="text-2xl font-black text-emerald-700">+ R {unallocatedCredit.toLocaleString()}</p>
                          </div>
                        )}
                        {unallocatedCredit < 0 && (
                          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Over Allocated</p>
                            <p className="text-2xl font-black text-rose-700">R {Math.abs(unallocatedCredit).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Receipt size={16} className="text-blue-500" /> 3. Distribute Funds</h3>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">Total Outstanding: R {totalOutstanding.toLocaleString()}</p>
                      </div>
                      <button onClick={handleAutoAllocate} disabled={!totalReceived || Number(totalReceived) <= 0} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 flex items-center gap-2 transition-all disabled:opacity-50 shadow-md">
                        <RefreshCw size={14} /> Auto-Allocate (Oldest First)
                      </button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {isLoadingInvoices ? (
                        <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
                      ) : invoices.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 font-bold italic">No outstanding invoices found for this lead.</div>
                      ) : (
                        invoices.map((inv) => {
                          const allocatedAmt = allocations[inv.id] || 0;
                          const isFullyAllocated = allocatedAmt >= inv.outstanding;
                          return (
                            <div key={inv.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${allocatedAmt > 0 ? "bg-blue-50/50 border-blue-200" : "bg-white border-slate-200"}`}>
                              <div>
                                <p className="font-black text-slate-900">INV-{inv.invoice_number}{inv.sequence_number > 1 ? ` (#${inv.sequence_number})` : ""}</p>
                                <span className="text-[10px] font-bold text-slate-500">{inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-ZA") : "No due date"}</span>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due</p>
                                  <p className="font-bold text-slate-700">R {inv.outstanding.toLocaleString()}</p>
                                </div>
                                <div className="relative w-32 shrink-0">
                                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm ${isFullyAllocated ? "text-emerald-500" : "text-slate-400"}`}>R</span>
                                  <input type="number" min="0" max={inv.outstanding} value={allocatedAmt || ""} onChange={(e) => handleManualAllocation(inv.id, e.target.value)} className={`w-full border rounded-xl py-2 pl-8 pr-3 text-right font-black outline-none transition-colors ${isFullyAllocated ? "bg-emerald-50 border-emerald-300 text-emerald-700" : allocatedAmt > 0 ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-900"}`} />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
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
                        <button onClick={() => handleProcessPayment(false)} disabled={isProcessing || Number(totalReceived) <= 0 || unallocatedCredit < 0} className="w-full sm:w-auto px-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Just Process
                        </button>
                        <button onClick={() => handleProcessPayment(true)} disabled={isProcessing || Number(totalReceived) <= 0 || unallocatedCredit < 0} className="w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:bg-emerald-500 flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20">
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />} Process &amp; Notify
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

      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-10 right-10 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm">
            <CheckCircle2 size={20} /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
