"use client";

import { FileText, Download, Shield, Check, Wallet, MessageSquare } from "lucide-react";

interface DocumentProps {
  type: 'invoice' | 'quote';
  docNumber: string;
  recipient: {
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{ desc: string; qty: number | string; price: number | string; disc?: number | string; note?: string }>;
  date: string;
  dueDate: string;
  globalNote?: string;
}

export default function RADBillingDocument({ type, docNumber, recipient, items, date, dueDate, globalNote }: DocumentProps) {
  const subTotal = items.reduce((acc, item) => acc + (Number(item.qty) * Number(item.price)), 0);

  const totalDiscount = items.reduce((acc, item) => {
      const validDisc = Math.max(0, Number(item.disc || 0));
      return acc + (Number(item.qty) * Number(item.price) * validDisc / 100);
  }, 0);

  const grandTotal = subTotal - totalDiscount;

  // Helper for consistent currency formatting
  const formatZAR = (amount: number) => {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white text-slate-900 p-6 md:p-12 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-xl font-sans overflow-hidden">

      {/* HEADER SECTOR */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-slate-100 pb-8 mb-8 md:pb-10 md:mb-10">
        <div className="space-y-2 w-full md:w-auto text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600">
            <Shield size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">RAD Academy Finance</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none text-emerald-600">
            {type.toUpperCase()}
          </h1>
          <p className="text-slate-400 font-mono text-sm">REF: {docNumber}</p>
        </div>

        <div className="text-center md:text-right space-y-1 w-full md:w-auto bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none">
          <p className="font-black uppercase text-lg italic text-slate-900 md:text-inherit">RAD Academy (Pty) Ltd</p>
          <p className="text-xs text-slate-500">Jasper Avenue, Centurion, Pretoria, GP</p>
          <p className="text-xs text-slate-500">076-906 5959 (WhatsApp)</p>
          <p className="text-xs text-slate-500">info@radacademy.co.za</p>
        </div>
      </div>

      {/* RECIPIENT & DATES */}
      <div className="flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-12 mb-10 md:mb-12">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest text-center md:text-left">
            {type === 'quote' ? 'Prepared_For' : 'Billed_To'}
          </h3>
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-1 text-center md:text-left">
            <p className="text-xl font-bold text-slate-900">{recipient.name}</p>
            {recipient.email && <p className="text-sm text-slate-500 break-all">{recipient.email}</p>}
            {recipient.phone && <p className="text-sm text-slate-500">{recipient.phone}</p>}
          </div>
        </div>

        <div className="flex flex-row justify-between md:flex-col md:justify-end md:items-end gap-4 p-6 md:p-0 bg-slate-50 md:bg-transparent rounded-3xl md:rounded-none border border-slate-200 md:border-transparent">
          <div className="text-left md:text-right">
            <p className="text-[9px] font-black uppercase text-slate-400">Issue_Date</p>
            <p className="font-bold text-sm md:text-base text-slate-900">{date}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-slate-400">
              {type === 'quote' ? 'Valid_Until' : 'Due_Date'}
            </p>
            <p className="font-bold text-emerald-600 text-sm md:text-base">{dueDate}</p>
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
          <tbody className="divide-y divide-slate-100">
            {items.map((item, i) => {
               const qty = Number(item.qty);
               const price = Number(item.price);
               const disc = Math.max(0, Number(item.disc || 0));
               const discountedPrice = price * (1 - disc / 100);
               const lineTotal = qty * discountedPrice;

               return (
                  <tr key={i} className="text-sm">
                    <td className="py-6">
                      <span className="font-bold text-base text-slate-900">{item.desc}</span>
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
                          <span className="text-emerald-600 font-bold">R {formatZAR(discountedPrice)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-700">R {formatZAR(price)}</span>
                      )}
                    </td>
                    <td className="py-6 text-right font-black text-slate-900">R {formatZAR(lineTotal)}</td>
                  </tr>
               );
            })}
          </tbody>
        </table>
      </div>

      {/* LINE ITEMS - Mobile Stack View */}
      <div className="md:hidden space-y-4 mb-8">
        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2">Line Items</h3>
        {items.map((item, i) => {
           const qty = Number(item.qty);
           const price = Number(item.price);
           const disc = Math.max(0, Number(item.disc || 0));
           const discountedPrice = price * (1 - disc / 100);
           const lineTotal = qty * discountedPrice;

           return (
             <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <p className="font-bold text-base leading-tight text-slate-900">{item.desc}</p>
                  {item.note && <p className="text-[11px] text-slate-500 italic mt-1 leading-snug">{item.note}</p>}
                </div>

                <div className="pt-4 border-t border-slate-200 text-sm">
                  <p className="text-[9px] font-black uppercase text-slate-400">Qty x Unit Price</p>
                  {disc > 0 ? (
                    <p className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-slate-600">{qty} x</span>
                      <span className="text-slate-400 line-through">R {formatZAR(price)}</span>
                      <span className="text-emerald-600 font-bold">R {formatZAR(discountedPrice)}</span>
                    </p>
                  ) : (
                    <p className="text-slate-600">{qty} x R {formatZAR(price)}</p>
                  )}
                </div>

                <div className="flex justify-between items-end pt-2">
                  <span className="text-[10px] font-black uppercase text-emerald-600">Line Total</span>
                  <span className="font-black text-lg text-slate-900">R {formatZAR(lineTotal)}</span>
                </div>
             </div>
           );
        })}
      </div>

      {/* TOTALS SECTOR - one right-aligned column, fixed width, short labels
          so nothing can push wider than the box. The parent document has
          overflow-hidden for its rounded corners, so anything that doesn't
          fit here doesn't wrap - it just gets silently clipped, which is
          exactly what long labels + a 4xl figure did before. */}
      <div className="flex justify-end mb-10 md:mb-12 border-t border-slate-200 md:border-none pt-6 md:pt-0">
        <div className="w-full md:w-[22rem] bg-slate-50 md:bg-transparent p-6 md:p-0 rounded-3xl md:rounded-none space-y-2.5">
          {/* Always three rows - subtotal before discount, the discount
              itself, subtotal once the discount is applied - not just shown
              when a discount happens to be present, so the breakdown reads
              the same way on every document. */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-slate-400 uppercase font-black text-[10px] tracking-widest shrink-0">Subtotal</span>
            <span className="font-bold text-slate-700 text-sm whitespace-nowrap">R {formatZAR(subTotal)}</span>
          </div>

          <div className="flex items-baseline justify-between gap-3">
              <span className="text-slate-400 uppercase font-black text-[10px] tracking-widest shrink-0">Discount</span>
              <span className={`font-bold text-sm whitespace-nowrap ${totalDiscount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>- R {formatZAR(totalDiscount)}</span>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between gap-3">
            <span className="text-emerald-600 uppercase font-black text-[10px] tracking-widest shrink-0">Total Due</span>
            <span className="text-2xl md:text-3xl font-black italic tracking-tight text-slate-900 whitespace-nowrap">R {formatZAR(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* GLOBAL NOTE SECTOR */}
      {globalNote && (
          <div className="bg-slate-50 border border-slate-200 p-6 md:p-8 rounded-3xl mb-10 md:mb-12">
             <p className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2">
                 <MessageSquare size={14}/> Document_Notes
             </p>
             <p className="text-xs md:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                 {globalNote}
             </p>
          </div>
      )}

      {/* BANKING SETTLEMENT */}
      <div className="bg-emerald-50 border border-emerald-100 p-6 md:p-8 rounded-[32px] flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-8">
        <div>
          <h4 className="text-[10px] md:text-xs font-black uppercase text-emerald-700 tracking-widest flex items-center justify-center md:justify-start gap-2 mb-4 md:mb-5 border-b border-emerald-100 md:border-none pb-3 md:pb-0">
            <Wallet size={14}/> Payment_Instructions
          </h4>
          <div className="space-y-2 text-sm text-center md:text-left bg-white/60 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none">
            <p className="text-slate-700"><span className="text-slate-400 font-mono text-[10px] uppercase mr-2 tracking-widest">Bank:</span> FNB</p>
            <p className="text-slate-700"><span className="text-slate-400 font-mono text-[10px] uppercase mr-2 tracking-widest">Name:</span> RAD Academy</p>
            <p className="text-slate-700"><span className="text-slate-400 font-mono text-[10px] uppercase mr-2 tracking-widest">Type:</span> Cheque Account</p>
            <p className="text-slate-700"><span className="text-slate-400 font-mono text-[10px] uppercase mr-2 tracking-widest">Acc:</span> 6289 636 1632</p>
            <p className="pt-2 mt-2 border-t border-emerald-200 text-emerald-700 font-black"><span className="text-slate-400 font-mono text-[10px] uppercase mr-2 tracking-widest font-normal">Ref:</span> {docNumber}-{recipient.name.split(' ')[0]}</p>
          </div>
        </div>
        <div className="flex flex-col justify-center items-center md:items-end opacity-50 pt-4 md:pt-0 border-t border-emerald-100 md:border-none">
            <div className="text-[9px] md:text-[10px] font-black uppercase text-center md:text-right leading-relaxed italic tracking-widest text-slate-500">
                System Generated Document<br/>
                RAD Academy (Pty) Ltd<br/>
                Thank you for your business
            </div>
        </div>
      </div>
    </div>
  );
}
