"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, XCircle, Lock, CheckCircle2 } from "lucide-react";
import RADBillingDocument from "@/components/finance/RADBillingDocument";

export default function PublicInvoiceV2View() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);
  const [quoteLineItems, setQuoteLineItems] = useState<any[]>([]);

  useEffect(() => {
    if (invoiceId) fetchData();
  }, [invoiceId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/finance-v2/invoices/${invoiceId}`);
      if (!res.ok) throw new Error("Invoice not found");
      const { invoice: inv, lead: leadData, lineItems: lines } = await res.json();
      setInvoice(inv);
      setLead(leadData);
      setQuoteLineItems(lines || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">Retrieving_Secure_Document...</p>
      </div>
    );
  }

  if (!invoice || !lead) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6">
        <XCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Document Not Found</h1>
      </div>
    );
  }

  const outstanding = Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid || 0));
  const isPaid = invoice.status === "paid" || outstanding <= 0;
  // Same shape as the invoice's parent quote if line items exist, otherwise a
  // single line for the invoice amount (e.g. an installment invoice has no
  // line items of its own - it's a slice of the quote's total).
  const documentItems = quoteLineItems.length > 0
    ? quoteLineItems.map((li) => ({ desc: li.description, qty: li.quantity, price: li.unit_price, disc: li.discount_pct }))
    : [{ desc: `Instalment #${invoice.sequence_number}`, qty: 1, price: invoice.amount, disc: 0 }];

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-12 font-sans">
      {isPaid && (
        <div className="max-w-4xl mx-auto mb-8 p-6 rounded-3xl flex items-center justify-center gap-4 border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-center">
          <CheckCircle2 size={32} />
          <p className="text-sm font-black uppercase tracking-widest">Invoice Paid — Thank You!</p>
        </div>
      )}

      <RADBillingDocument
        type="invoice"
        docNumber={`INV-${invoice.invoice_number}`}
        recipient={{ name: lead.name || "Customer", email: lead.email || "", phone: lead.phone || "" }}
        items={documentItems}
        date={new Date(invoice.created_at).toLocaleDateString("en-ZA")}
        dueDate={invoice.due_at ? new Date(invoice.due_at).toLocaleDateString("en-ZA") : "On Receipt"}
      />

      {!isPaid && (
        <div className="max-w-4xl mx-auto mt-8 p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Outstanding</span>
            <span className="text-2xl font-black text-white tracking-tighter">R {outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
          </div>
          <form action="https://www.payfast.co.za/eng/process" method="POST">
            <input type="hidden" name="merchant_id" value={process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID} />
            <input type="hidden" name="merchant_key" value={process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY} />
            {/* Correlates directly to this invoice - the webhook resolves this
                exact row rather than guessing from a guardian's outstanding
                invoice list, unlike the old billing_records flow. */}
            <input type="hidden" name="custom_str1" value={invoice.id} />
            <input type="hidden" name="return_url" value={`${typeof window !== "undefined" ? window.location.origin : ""}/payment/success`} />
            <input type="hidden" name="cancel_url" value={`${typeof window !== "undefined" ? window.location.origin : ""}/payment/cancel`} />
            <input type="hidden" name="notify_url" value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/payfast/webhook`} />
            <input type="hidden" name="name_first" value={(lead.name || "Customer").split(" ")[0]} />
            <input type="hidden" name="email_address" value={lead.email || "info@radacademy.co.za"} />
            <input type="hidden" name="amount" value={outstanding.toFixed(2)} />
            <input type="hidden" name="item_name" value={`RAD Academy Invoice INV-${invoice.invoice_number}`} />
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Lock size={12} /> Pay Securely via PayFast
            </button>
          </form>
          <p className="text-[10px] text-slate-500 text-center">Paying by EFT or another method? Send your reference (INV-{invoice.invoice_number}) to RAD Academy directly.</p>
        </div>
      )}
    </div>
  );
}
