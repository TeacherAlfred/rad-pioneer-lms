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
  const [payfastReady, setPayfastReady] = useState(false);
  const [payfastFields, setPayfastFields] = useState<Record<string, string> | null>(null);
  const [payfastSignature, setPayfastSignature] = useState<string | null>(null);
  const [payfastUrl, setPayfastUrl] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId) fetchData();
  }, [invoiceId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/finance-v2/invoices/${invoiceId}`);
      if (!res.ok) throw new Error("Invoice not found");
      const { invoice: inv, lead: leadData, lineItems: lines, payfastReady: pfReady, payfastFields: pfFields, payfastSignature: pfSig, payfastUrl: pfUrl } = await res.json();
      setInvoice(inv);
      setLead(leadData);
      setQuoteLineItems(lines || []);
      setPayfastReady(!!pfReady);
      setPayfastFields(pfFields);
      setPayfastSignature(pfSig);
      setPayfastUrl(pfUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
        <p className="text-emerald-600 font-black uppercase tracking-widest text-[10px]">Retrieving_Secure_Document...</p>
      </div>
    );
  }

  if (!invoice || !lead) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center p-6">
        <XCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Document Not Found</h1>
      </div>
    );
  }

  const outstanding = Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid || 0));
  const isPaid = invoice.status === "paid" || outstanding <= 0;
  // Same shape as the invoice's parent quote if line items exist, otherwise a
  // single line for the invoice amount (e.g. an installment invoice has no
  // line items of its own - it's a slice of the quote's total).
  const documentItems = quoteLineItems.length > 0
    ? quoteLineItems.map((li) => ({ desc: li.description, qty: li.quantity, price: li.unit_price, disc: li.discount_pct, lineTotal: li.line_total }))
    : [{ desc: `Instalment #${invoice.sequence_number}`, qty: 1, price: invoice.amount, disc: 0 }];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-12 font-sans">
      {isPaid && (
        <div className="max-w-4xl mx-auto mb-8 p-6 rounded-3xl flex items-center justify-center gap-4 border bg-emerald-50 border-emerald-200 text-emerald-700 text-center">
          <CheckCircle2 size={32} />
          <p className="text-sm font-black uppercase tracking-widest">Invoice Paid — Thank You!</p>
        </div>
      )}

      <RADBillingDocument
        type="invoice"
        docNumber={`INV-${invoice.invoice_number}`}
        recipient={{ name: lead.company_name || lead.name || "Customer", email: lead.email || "", phone: lead.phone || "" }}
        items={documentItems}
        date={new Date(invoice.created_at).toLocaleDateString("en-ZA")}
        dueDate={invoice.due_at ? new Date(invoice.due_at).toLocaleDateString("en-ZA") : "On Receipt"}
      />

      {!isPaid && (
        <div className="max-w-4xl mx-auto mt-8 p-6 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Outstanding</span>
            <span className="text-2xl font-black text-slate-900 tracking-tighter">R {outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
          </div>
          {/* PayFast is still pointed at sandbox while it's being tested -
              payfastReady (GET /api/finance-v2/invoices/[id]) mirrors
              PAYFAST_URL, so the button reappears automatically the moment
              that's flipped to the live process URL, nothing else to
              remember to re-enable. Fields, order, and signature all come
              from the server so PAYFAST_PASSPHRASE never reaches the client. */}
          {payfastReady ? (
            <form action={payfastUrl || undefined} method="POST">
              {payfastFields && Object.entries(payfastFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              {payfastSignature && <input type="hidden" name="signature" value={payfastSignature} />}
              <button type="submit" disabled={!payfastUrl} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50">
                <Lock size={12} /> Pay Securely via PayFast
              </button>
            </form>
          ) : (
            <p className="text-[11px] text-slate-500 text-center bg-slate-50 border border-slate-200 rounded-xl py-3 px-4">
              Online payment isn&apos;t live yet — please pay by EFT using the reference below.
            </p>
          )}
          <p className="text-[10px] text-slate-500 text-center">Paying by EFT or another method? Send your reference (INV-{invoice.invoice_number}) to RAD Academy directly.</p>
        </div>
      )}
    </div>
  );
}
