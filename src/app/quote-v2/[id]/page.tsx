"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import RADBillingDocument from "@/components/finance/RADBillingDocument";

export default function PublicQuoteV2View() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [lead, setLead] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<"accepted" | "declined" | null>(null);
  const [planChoice, setPlanChoice] = useState<"full_term" | "monthly">("full_term");
  const [createdInvoices, setCreatedInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (quoteId) fetchData();
  }, [quoteId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/finance-v2/quotes/${quoteId}`);
      if (!res.ok) throw new Error("Quote not found");
      const { quote: quoteData, lineItems: lines, lead: leadData, invoices } = await res.json();
      setQuote(quoteData);
      setLineItems(lines || []);
      setLead(leadData);
      setCreatedInvoices(invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const isExpired = quote?.expires_at && new Date(quote.expires_at) < new Date() && quote.status === "sent";
  const canOfferMonthly = quote?.installment_count > 1 && quote?.monthly_installment_amount;

  async function executeAction() {
    if (!pendingAction || !quote) return;
    setIsProcessing(true);
    try {
      if (pendingAction === "declined") {
        const res = await fetch(`/api/finance-v2/quotes/${quote.id}/decline`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to decline quote");
        setQuote((q: any) => ({ ...q, status: "declined" }));
        setPendingAction(null);
        return;
      }

      const acceptedPlan = canOfferMonthly ? planChoice : "full_term";
      const res = await fetch(`/api/finance-v2/quotes/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planChoice: acceptedPlan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to accept quote");

      setQuote((q: any) => ({ ...q, status: "accepted", accepted_plan_type: json.acceptedPlan }));
      setCreatedInvoices(json.invoices || []);
      setPendingAction(null);
    } catch (err: any) {
      alert("System Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-purple-400 font-black uppercase tracking-widest text-[10px]">Retrieving_Secure_Document...</p>
      </div>
    );
  }

  if (!quote || !lead) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6">
        <XCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Document Not Found</h1>
        <p className="text-slate-500 mt-2">The link you followed may be invalid or the document has been removed.</p>
      </div>
    );
  }

  const documentItems = lineItems.map((li) => ({ desc: li.description, qty: li.quantity, price: li.unit_price, disc: li.discount_pct }));
  const effectiveStatus = isExpired ? "expired" : quote.status;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-12 font-sans">
      {effectiveStatus !== "sent" && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`max-w-4xl mx-auto mb-8 p-6 rounded-3xl flex flex-col items-center text-center gap-4 border ${
            effectiveStatus === "accepted" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
            effectiveStatus === "declined" ? "bg-rose-500/10 border-rose-500/30 text-rose-400" :
            "bg-amber-500/10 border-amber-500/30 text-amber-400"
          }`}
        >
          {effectiveStatus === "accepted" && <CheckCircle2 size={40} />}
          {effectiveStatus === "declined" && <XCircle size={40} />}
          {effectiveStatus === "expired" && <AlertCircle size={40} />}
          <div className="space-y-1">
            <h2 className="text-xl font-black uppercase tracking-widest">Quotation {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}</h2>
            <p className="text-xs opacity-80">
              {effectiveStatus === "accepted" && "Thank you! Your invoice(s) are ready below."}
              {effectiveStatus === "declined" && "This quotation has been declined and closed."}
              {effectiveStatus === "expired" && "This quotation has passed its validity date. Please contact us for a revised quote."}
            </p>
          </div>
          {effectiveStatus === "accepted" && createdInvoices.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              {createdInvoices.map((inv) => (
                <a
                  key={inv.id}
                  href={`/invoice-v2/${inv.id}`}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2"
                >
                  Invoice #{inv.sequence_number} — R {Number(inv.amount).toLocaleString()} <ArrowRight size={14} />
                </a>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <div className={`transition-all duration-700 ${effectiveStatus !== "sent" ? "opacity-50 grayscale pointer-events-none" : ""}`}>
        <RADBillingDocument
          type="quote"
          docNumber={`QT-${quote.quote_number}`}
          recipient={{ name: lead.name || "Customer", email: lead.email || "", phone: lead.phone || "" }}
          items={documentItems}
          date={new Date(quote.created_at).toLocaleDateString("en-ZA")}
          dueDate={quote.expires_at ? new Date(quote.expires_at).toLocaleDateString("en-ZA") : "No Expiry"}
          globalNote={quote.notes}
        />
      </div>

      {effectiveStatus === "sent" && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-0 left-0 w-full bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/10 p-6 z-40">
          <div className="max-w-4xl mx-auto space-y-4">
            {canOfferMonthly && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPlanChoice("full_term")} className={`px-5 py-3 rounded-xl text-xs font-black uppercase ${planChoice === "full_term" ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400"}`}>
                  Full Term — R {Number(quote.total_amount).toLocaleString()}
                </button>
                <button onClick={() => setPlanChoice("monthly")} className={`px-5 py-3 rounded-xl text-xs font-black uppercase ${planChoice === "monthly" ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400"}`}>
                  Monthly — R {Number(quote.monthly_installment_amount).toLocaleString()} × {quote.installment_count}
                </button>
              </div>
            )}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Action Required</p>
                <p className="text-sm font-bold text-white mt-1">Please review the details above and provide your response.</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={() => setPendingAction("declined")} className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-black uppercase tracking-widest text-xs hover:bg-rose-500/10 hover:text-rose-400 transition-all">
                  Decline
                </button>
                <button onClick={() => setPendingAction("accepted")} className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-purple-600 text-white font-black uppercase tracking-widest text-xs hover:bg-purple-500 transition-all shadow-xl">
                  Accept Quotation
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {pendingAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0f172a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl text-center space-y-6">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${pendingAction === "accepted" ? "bg-purple-500/20 text-purple-400" : "bg-rose-500/20 text-rose-400"}`}>
                {pendingAction === "accepted" ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase italic mb-2">{pendingAction === "accepted" ? "Accept Quotation?" : "Decline Quotation?"}</h3>
                <p className="text-sm text-slate-400">
                  {pendingAction === "accepted"
                    ? canOfferMonthly
                      ? `By accepting the ${planChoice === "monthly" ? "monthly" : "full term"} plan, we'll generate ${planChoice === "monthly" ? quote.installment_count + " invoices" : "one invoice"} for you.`
                      : "By accepting, you agree to the pricing above. We'll generate your invoice."
                    : "Are you sure you want to decline? This action cannot be undone."}
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setPendingAction(null)} disabled={isProcessing} className="flex-1 py-4 rounded-xl bg-white/5 text-slate-300 font-bold text-xs uppercase hover:bg-white/10 transition-all disabled:opacity-50">Cancel</button>
                <button onClick={executeAction} disabled={isProcessing} className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 ${pendingAction === "accepted" ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}`}>
                  {isProcessing ? <Loader2 className="animate-spin" size={16} /> : "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {effectiveStatus === "sent" && <div className="h-32" />}
    </div>
  );
}
