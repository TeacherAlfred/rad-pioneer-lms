"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertCircle, ArrowRight, Download, MessageSquareText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import RADBillingDocument from "@/components/finance/RADBillingDocument";

export default function PublicQuoteV2View() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = params.id as string;
  // ?print=1 - used only by the server-side PDF route (api/quote-v2/[id]/pdf)
  // navigating a headless browser here, so the PDF renders the exact same
  // component tree as the live page minus the interactive action bar - one
  // source of layout, not a second template to keep in sync.
  const printMode = searchParams.get('print') === '1';

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [lead, setLead] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<"accepted" | "change" | null>(null);
  const [changeMessage, setChangeMessage] = useState("");
  const [changeSent, setChangeSent] = useState(false);
  const [planChoice, setPlanChoice] = useState<"full_term" | "monthly">("full_term");
  const [createdInvoices, setCreatedInvoices] = useState<any[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(printMode);

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
      if (pendingAction === "change") {
        const res = await fetch(`/api/finance-v2/quotes/${quote.id}/request-change`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: changeMessage }),
        });
        if (!res.ok) throw new Error("Failed to send your request");
        setChangeSent(true);
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-600" size={40} />
        <p className="text-purple-600 font-black uppercase tracking-widest text-[10px]">Retrieving_Secure_Document...</p>
      </div>
    );
  }

  if (!quote || !lead) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center p-6">
        <XCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Document Not Found</h1>
        <p className="text-slate-500 mt-2">The link you followed may be invalid or the document has been removed.</p>
      </div>
    );
  }

  const documentItems = lineItems.map((li) => ({ desc: li.description, qty: li.quantity, price: li.unit_price, disc: li.discount_pct }));
  const effectiveStatus = isExpired ? "expired" : quote.status;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-12 font-sans">
      {!printMode && changeSent && effectiveStatus === "sent" && (
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-4xl mx-auto mb-8 p-6 rounded-3xl flex flex-col items-center text-center gap-2 border bg-rad-blue/10 border-rad-blue/30 text-rad-blue">
          <MessageSquareText size={32} />
          <p className="text-sm font-bold">Got it — a real person will follow up shortly. This quote stays open in the meantime.</p>
        </motion.div>
      )}

      {effectiveStatus !== "sent" && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`max-w-4xl mx-auto mb-8 p-6 rounded-3xl flex flex-col items-center text-center gap-4 border ${
            effectiveStatus === "accepted" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
            effectiveStatus === "declined" ? "bg-rose-50 border-rose-200 text-rose-700" :
            "bg-amber-50 border-amber-200 text-amber-700"
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
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2"
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
        />

        {quote.notes && (
          <div className="w-full max-w-4xl mx-auto -mt-6 px-6 md:px-12 pb-6">
            <details className="group" open={showBreakdown} onToggle={(e) => setShowBreakdown((e.target as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-emerald-600 select-none">
                {showBreakdown ? 'Hide' : 'See'} what&apos;s included, itemised
              </summary>
              <div className="mt-3 bg-white border border-slate-200 p-5 rounded-2xl text-xs md:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {quote.notes}
              </div>
            </details>
          </div>
        )}

        {/* Print-only CTA: the PDF has no interactive Accept/Request-a-change
            bar (that's suppressed below for printMode), so a downloaded copy
            needs its own way back to the live quote. This sits in normal
            document flow - not absolutely positioned over the document like
            the old jsPDF overlay was - so it can never clip or overlap the
            payment details above it, and it pushes onto a second PDF page
            on its own if the document above already fills page one. */}
        {printMode && effectiveStatus === "sent" && (
          <div className="max-w-4xl mx-auto px-6 md:px-12 pb-16">
            <a
              href={`/quote-v2/${quote.id}`}
              className="block bg-purple-600 text-white rounded-2xl px-6 py-5 text-center no-underline"
            >
              <p className="font-black uppercase tracking-widest text-sm">Click here to review &amp; accept quote</p>
              <p className="text-xs opacity-80 mt-1 break-all">{typeof window !== "undefined" ? window.location.origin : ""}/quote-v2/{quote.id}</p>
            </a>
          </div>
        )}

        {!printMode && (
          <div className="max-w-4xl mx-auto px-6 md:px-12 pb-24 flex justify-end">
            <a
              href={`/api/quote-v2/${quote.id}/pdf`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm"
            >
              <Download size={13} /> Download PDF
            </a>
          </div>
        )}
      </div>

      {!printMode && effectiveStatus === "sent" && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 p-6 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-4xl mx-auto space-y-4">
            {canOfferMonthly && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPlanChoice("full_term")} className={`px-5 py-3 rounded-xl text-xs font-black uppercase ${planChoice === "full_term" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  Full Term — R {Number(quote.total_amount).toLocaleString()}
                </button>
                <button onClick={() => setPlanChoice("monthly")} className={`px-5 py-3 rounded-xl text-xs font-black uppercase ${planChoice === "monthly" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  Monthly — R {Number(quote.monthly_installment_amount).toLocaleString()} × {quote.installment_count}
                </button>
              </div>
            )}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Action Required</p>
                <p className="text-sm font-bold text-slate-900 mt-1">Please review the details above and provide your response.</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={() => { setChangeMessage(""); setPendingAction("change"); }} className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-xs hover:bg-rad-blue/10 hover:text-rad-blue hover:border-rad-blue/30 transition-all">
                  Request a Change
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white border border-slate-200 p-8 rounded-3xl w-full max-w-md shadow-2xl text-center space-y-6">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${pendingAction === "accepted" ? "bg-purple-100 text-purple-600" : "bg-rad-blue/10 text-rad-blue"}`}>
                {pendingAction === "accepted" ? <CheckCircle2 size={32} /> : <MessageSquareText size={32} />}
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase italic mb-2 text-slate-900">{pendingAction === "accepted" ? "Accept Quotation?" : "What would you like us to adjust?"}</h3>
                <p className="text-sm text-slate-500">
                  {pendingAction === "accepted"
                    ? canOfferMonthly
                      ? `By accepting the ${planChoice === "monthly" ? "monthly" : "full term"} plan, we'll generate ${planChoice === "monthly" ? quote.installment_count + " invoices" : "one invoice"} for you.`
                      : "By accepting, you agree to the pricing above. We'll generate your invoice."
                    : "A real person will follow up — this quote stays open while we do."}
                </p>
              </div>
              {pendingAction === "change" && (
                <textarea
                  autoFocus
                  rows={3}
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  placeholder="e.g. Could we swap the term for something a bit lighter?"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-rad-blue resize-none"
                />
              )}
              <div className="flex gap-4 pt-4">
                <button onClick={() => setPendingAction(null)} disabled={isProcessing} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase hover:bg-slate-200 transition-all disabled:opacity-50">Cancel</button>
                <button onClick={executeAction} disabled={isProcessing} className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 ${pendingAction === "accepted" ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-rad-blue hover:opacity-90 text-white"}`}>
                  {isProcessing ? <Loader2 className="animate-spin" size={16} /> : "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!printMode && effectiveStatus === "sent" && <div className="h-32" />}
    </div>
  );
}
