"use client";

import { Fragment } from "react";
import { Archivo } from "next/font/google";
import { FileText, Download, Shield, Check, Wallet, MessageSquare } from "lucide-react";

// Scoped to this component rather than routed through the app's
// --font-precision token, which only resolves inside reader-v2's layout -
// everywhere else (including every quote/invoice route) it silently falls
// back to Arial. This is the one place on the document that actually needs
// a distinct display face; body text uses font-brand (Geist, already
// loaded app-wide) instead of the plain font-sans/Arial default.
const archivo = Archivo({ subsets: ["latin"], weight: ["800", "900"], style: ["italic", "normal"], display: "swap" });

interface DocumentProps {
  type: 'invoice' | 'quote';
  docNumber: string;
  recipient: {
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{ desc: string; qty: number | string; price: number | string; disc?: number | string; lineTotal?: number | string; note?: string; group?: string | null }>;
  date: string;
  dueDate: string;
  globalNote?: string;
}

// discount_pct is stored rounded (e.g. 23.0769...% -> 23.08%), so
// recomputing qty * price * (1 - disc/100) from it drifts from the amount
// that was actually agreed at creation time (a few cents per line, which
// then compounds into the grand total not matching what the quote/invoice
// row itself says it's for). lineTotal is the authoritative, full-precision
// figure computed once at save time - use it whenever it's provided, and
// only fall back to recomputing for callers that haven't saved a row yet
// (e.g. a live in-browser preview before the first save).
function resolveLineTotal(item: { qty: number | string; price: number | string; disc?: number | string; lineTotal?: number | string }): number {
  if (item.lineTotal !== undefined && item.lineTotal !== null) return Number(item.lineTotal);
  const validDisc = Math.max(0, Number(item.disc || 0));
  return Number(item.qty) * Number(item.price) * (1 - validDisc / 100);
}

export default function RADBillingDocument({ type, docNumber, recipient, items, date, dueDate, globalNote }: DocumentProps) {
  const subTotal = items.reduce((acc, item) => acc + (Number(item.qty) * Number(item.price)), 0);

  // Derived as subTotal minus the authoritative grand total, rather than
  // summed independently from each line's disc% - so "Subtotal - Discount"
  // always equals "Total Due" exactly, with no second rounding path to drift.
  const grandTotal = items.reduce((acc, item) => acc + resolveLineTotal(item), 0);
  const totalDiscount = subTotal - grandTotal;

  // Helper for consistent currency formatting
  const formatZAR = (amount: number) => {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // A near-100% discount reads as "priced, then comped" rather than a
  // negotiated markdown - e.g. a thank-you bonus line - so it gets its own
  // gold treatment instead of the usual emerald discount styling.
  const isComplimentary = (item: DocumentProps["items"][number]) => Math.max(0, Number(item.disc || 0)) >= 99.5;

  // Items sharing the same optional `group` collapse into one labelled
  // section, sections ordered by each label's first appearance - a full
  // groupBy rather than only merging adjacent items, since the composer's
  // "Add Item to <Section>" always appends to the end of the line-item
  // array, which can easily leave same-label items non-adjacent. Items with
  // no group (every existing invoice/quote, or any ungrouped line on a new
  // one) carry a null label and render with no heading at all - grouping is
  // strictly additive, nothing changes for a document that doesn't opt in.
  type Item = DocumentProps["items"][number];
  const segments: { label: string | null; items: Item[] }[] = (() => {
    const order: (string | null)[] = [];
    const byLabel = new Map<string | null, Item[]>();
    for (const item of items) {
      const label = item.group ?? null;
      if (!byLabel.has(label)) {
        byLabel.set(label, []);
        order.push(label);
      }
      byLabel.get(label)!.push(item);
    }
    return order.map((label) => ({ label, items: byLabel.get(label)! }));
  })();
  const isFlat = segments.length <= 1 && !segments[0]?.label;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white text-slate-900 p-5 md:p-12 rounded-[28px] md:rounded-[40px] border border-slate-200 shadow-xl font-brand overflow-hidden">

      {/* HEADER SECTOR - kept tight on mobile: this is what a client sees
          before scrolling at all, so it should get them to the line items
          fast, not fill the screen with letterhead. The full company
          address card is desktop/PDF-only (PUPPETEER renders the PDF at a
          desktop-width viewport, so it still prints there) - on a phone the
          "RAD Academy Finance" eyebrow already says who this is from. */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-2 md:gap-8 border-b border-slate-100 pb-3 mb-3 md:pb-10 md:mb-10">
        <div className="space-y-0.5 md:space-y-2 w-full md:w-auto text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-1.5 md:gap-2 text-emerald-600">
            <Shield size={11} className="md:hidden" />
            <Shield size={14} className="hidden md:block" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.16em] md:tracking-[0.2em]">RAD Academy Finance</span>
          </div>
          <h1 className={`${archivo.className} text-3xl md:text-6xl italic leading-none text-emerald-600`} style={{ fontWeight: 900 }}>
            {type.toUpperCase()}
          </h1>
          <p className="text-slate-400 font-mono text-[11px] md:text-sm">REF: {docNumber}</p>
        </div>

        <div className="hidden md:block text-right space-y-1 w-auto">
          <p className={`${archivo.className} uppercase text-lg italic text-slate-900`} style={{ fontWeight: 800 }}>RAD Academy (Pty) Ltd</p>
          <p className="text-xs text-slate-500">Jasper Avenue, Centurion, Pretoria, GP</p>
          <p className="text-xs text-slate-500">076-906 5959 (WhatsApp)</p>
          <p className="text-xs text-slate-500">info@radacademy.co.za</p>
        </div>
      </div>

      {/* RECIPIENT & DATES - dates drop the bordered-card treatment on
          mobile in favour of a slim inline row, so this whole block clears
          the fold quickly. */}
      <div className="flex flex-col md:grid md:grid-cols-2 gap-2.5 md:gap-12 mb-4 md:mb-12">
        <div className="space-y-1 md:space-y-4">
          <h3 className="text-[9px] md:text-[10px] font-black uppercase text-emerald-600 tracking-widest text-center md:text-left">
            {type === 'quote' ? 'Prepared_For' : 'Billed_To'}
          </h3>
          <div className="bg-slate-50 border border-slate-200 p-3 md:p-6 rounded-2xl md:rounded-3xl space-y-0.5 md:space-y-1 text-center md:text-left">
            <p className="text-base md:text-xl font-bold text-slate-900">{recipient.name}</p>
            {recipient.email && <p className="text-[11px] md:text-sm text-slate-500 break-all">{recipient.email}</p>}
            {recipient.phone && <p className="text-[11px] md:text-sm text-slate-500">{recipient.phone}</p>}
          </div>
        </div>

        <div className="flex flex-row justify-center gap-8 md:flex-col md:justify-end md:items-end md:gap-4">
          <div className="text-center md:text-right">
            <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-400">Issue_Date</p>
            <p className="font-bold text-xs md:text-base text-slate-900">{date}</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-400">
              {type === 'quote' ? 'Valid_Until' : 'Due_Date'}
            </p>
            <p className="font-bold text-emerald-600 text-xs md:text-base">{dueDate}</p>
          </div>
        </div>
      </div>

      {/* LINE ITEMS - Desktop Table View */}
      <div className="hidden md:block w-full mb-12">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
              <th className="py-4 text-left">Description</th>
              <th className="py-4 text-center">Qty</th>
              <th className="py-4 text-right">Unit_Price</th>
              <th className="py-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment, si) => (
              <Fragment key={`s-${si}`}>
                {segment.label && (
                  <tr key={`h-${si}`}>
                    <td colSpan={4} className={si === 0 ? "pt-2 pb-2" : "pt-8 pb-2"}>
                      <span className={`${archivo.className} text-[11px] uppercase italic tracking-widest text-emerald-600`} style={{ fontWeight: 900 }}>{segment.label}</span>
                    </td>
                  </tr>
                )}
                {segment.items.map((item, i) => {
                   const qty = Number(item.qty);
                   const price = Number(item.price);
                   const disc = Math.max(0, Number(item.disc || 0));
                   const rowTotal = resolveLineTotal(item);
                   const discountedPrice = qty > 0 ? rowTotal / qty : price;
                   const comped = isComplimentary(item);

                   return (
                      <tr key={`${si}-${i}`} className="text-sm border-b border-slate-100">
                        <td className="py-6">
                          <span className="font-bold text-base text-slate-900">{item.desc}</span>
                          {comped && (
                            <span className="ml-2 align-middle text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">Complimentary</span>
                          )}
                          {item.note && (
                              <div className="text-xs text-slate-500 italic mt-1 font-normal break-words pr-4">
                                  {item.note}
                              </div>
                          )}
                        </td>
                        <td className="py-6 text-center text-slate-500">{qty}</td>
                        <td className="py-6 text-right">
                          {disc > 0 ? (
                            <div className="flex items-baseline justify-end gap-2 whitespace-nowrap">
                              <span className="text-slate-400 line-through text-xs">R {formatZAR(price)}</span>
                              <span className={`font-bold ${comped ? "text-amber-600" : "text-emerald-600"}`}>R {formatZAR(discountedPrice)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-700">R {formatZAR(price)}</span>
                          )}
                        </td>
                        <td className="py-6 text-right font-black text-slate-900">R {formatZAR(rowTotal)}</td>
                      </tr>
                   );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* LINE ITEMS - Mobile Stack View. This is the primary surface, not a
          fallback - most quotes/invoices are opened from a link on a phone.
          Sections read as one panel of compact rows each (description + qty
          x price on the left, total on the right), not a full padded card
          per item - a real multi-item quote stays scannable in a couple of
          screens instead of turning into an endless scroll. A complimentary
          line still stands out on its own via a gold wash + tag, without
          adding bulk. */}
      <div className="md:hidden mb-8">
        {/* Short break, not a full-width rule - a deliberate pause between
            the header block above and the line items starting below,
            without drawing a hard line across the whole card. */}
        <div className="w-10 h-[3px] rounded-full bg-slate-200 mx-auto mb-6" />

        <div className="space-y-7">
          {segments.map((segment, si) => (
            <div key={si}>
              {segment.label ? (
                <h3 className={`${archivo.className} text-[13px] italic uppercase tracking-wide text-emerald-600 pb-2 mb-1 border-b border-slate-100`} style={{ fontWeight: 900 }}>
                  {segment.label}
                </h3>
              ) : (
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest pb-2 mb-1 border-b border-slate-100">
                  {isFlat ? "Line Items" : "Other Items"}
                </h3>
              )}
              <div className="divide-y divide-slate-100">
                {segment.items.map((item, i) => {
                   const qty = Number(item.qty);
                   const price = Number(item.price);
                   const disc = Math.max(0, Number(item.disc || 0));
                   const rowTotal = resolveLineTotal(item);
                   const comped = isComplimentary(item);

                   return (
                     <div key={i} className={`flex items-start justify-between gap-3 py-3 ${comped ? "bg-amber-50 border border-amber-200 -mx-1 px-3 rounded-xl my-1" : ""}`}>
                        <div className="min-w-0">
                          <p className="text-sm leading-snug text-slate-800 break-words">
                            {item.desc}
                            {comped && (
                              <span className="ml-2 align-middle text-[8px] font-black uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">Complimentary</span>
                            )}
                          </p>
                          {item.note && <p className="text-[10px] text-slate-400 italic mt-0.5 leading-snug">{item.note}</p>}
                          <p className="text-[11px] text-slate-400 mt-0.5">{qty} × R {formatZAR(price)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {disc > 0 && (
                            <p className="text-[10px] text-slate-400 line-through whitespace-nowrap">R {formatZAR(qty * price)}</p>
                          )}
                          <p className={`font-medium text-sm whitespace-nowrap ${comped ? "text-amber-700" : "text-slate-900"}`}>R {formatZAR(rowTotal)}</p>
                        </div>
                     </div>
                   );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GLOBAL NOTE SECTOR */}
      {globalNote && (
          <div className="bg-slate-50 border border-slate-200 p-6 md:p-8 rounded-3xl mb-10 md:mb-12">
             <p className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2">
                 <MessageSquare size={14}/> Document_Notes
             </p>
             <p className="text-xs md:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-brand">
                 {globalNote}
             </p>
          </div>
      )}

      {/* SETTLEMENT SECTOR - banking and the numeric breakdown as one
          panel, split by a single vertical rule, instead of two separate
          stacked blocks - this is the whole footer, not half of it. */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-[24px] md:rounded-[32px] overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-emerald-200">
          <div className="p-4 md:p-8">
            <h4 className="text-[9px] md:text-xs font-black uppercase text-emerald-700 tracking-widest flex items-center gap-1.5 mb-2.5 md:mb-5">
              <Wallet size={12} className="md:hidden" /><Wallet size={14} className="hidden md:block" /> Payment
            </h4>
            <div className="space-y-1.5 md:space-y-2 text-[11px] md:text-sm">
              <p className="text-slate-700"><span className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase mr-1 tracking-widest">Bank:</span> FNB</p>
              <p className="text-slate-700"><span className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase mr-1 tracking-widest">Name:</span> RAD Academy</p>
              <p className="text-slate-700"><span className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase mr-1 tracking-widest">Type:</span> Cheque Acc.</p>
              <p className="text-slate-700 break-words"><span className="text-slate-400 font-mono text-[9px] md:text-[10px] uppercase mr-1 tracking-widest">Acc:</span> 6289 636 1632</p>
              <p className="pt-1.5 mt-1.5 border-t border-emerald-200 text-emerald-700 font-bold"><span className="text-slate-400 font-mono text-[9px] uppercase mr-1 tracking-widest font-normal">Ref:</span> {docNumber}-{recipient.name.split(' ')[0]}</p>
            </div>
          </div>

          {/* Always three rows - subtotal before discount, the discount
              itself, subtotal once the discount is applied - not just shown
              when a discount happens to be present, so the breakdown reads
              the same way on every document. */}
          <div className="p-4 md:p-8 flex flex-col justify-center space-y-1.5 md:space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-400 uppercase font-black text-[9px] tracking-widest shrink-0">Subtotal</span>
              <span className="font-medium text-slate-700 text-xs md:text-sm whitespace-nowrap">R {formatZAR(subTotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-400 uppercase font-black text-[9px] tracking-widest shrink-0">Discount</span>
              <span className={`font-medium text-xs md:text-sm whitespace-nowrap ${totalDiscount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>- R {formatZAR(totalDiscount)}</span>
            </div>
            <div className="pt-1.5 md:pt-2 border-t border-emerald-200">
              <span className="text-emerald-600 uppercase font-black text-[9px] tracking-widest block mb-0.5">Total Due</span>
              <span className={`${archivo.className} text-lg md:text-3xl italic tracking-tight text-slate-900 whitespace-nowrap block`} style={{ fontWeight: 900 }}>R {formatZAR(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-emerald-200 py-2 px-4 text-center opacity-60">
          <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-600">
            System Generated · RAD Academy (Pty) Ltd · Thank You
          </p>
        </div>
      </div>
    </div>
  );
}
