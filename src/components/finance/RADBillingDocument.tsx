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
  globalNote?: string; // Satisfies TypeScript error
}

export default function RADBillingDocument({ type, docNumber, recipient, items, date, dueDate, globalNote }: DocumentProps) {
  // Ensure we are working with numbers for calculations
  const subTotal = items.reduce((acc, item) => acc + (Number(item.qty) * Number(item.price)), 0);
  
  // Calculate discount using Math.max(0) to prevent negative discounts
  const totalDiscount = items.reduce((acc, item) => {
      const validDisc = Math.max(0, Number(item.disc || 0));
      return acc + (Number(item.qty) * Number(item.price) * validDisc / 100);
  }, 0);
  
  const grandTotal = subTotal - totalDiscount;

  return (
    <div className="max-w-4xl mx-auto bg-[#020617] text-white p-12 rounded-[40px] border border-white/10 shadow-2xl font-sans">
      {/* HEADER SECTOR */}
      <div className="flex justify-between items-start border-b border-white/5 pb-10 mb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-500">
            <Shield size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">RAD Academy Finance</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter uppercase italic leading-none">
             {/* Removed 'TAX_' prefix */}
            <span className="text-emerald-500">{type.toUpperCase()}</span>
          </h1>
          <p className="text-slate-500 font-mono text-sm">REF: {docNumber}</p>
        </div>
        
        <div className="text-right space-y-1">
          <p className="font-black uppercase text-lg italic">RAD Academy (Pty) Ltd</p>
          <p className="text-xs text-slate-400">Jasper Avenue, Centurion, Pretoria, GP</p>
          <p className="text-xs text-slate-400">076-906 5959 (WhatsApp)</p>
          <p className="text-xs text-slate-400">info@radacademy.co.za</p>
          {/* Removed VAT line */}
        </div>
      </div>

      {/* RECIPIENT & DATES */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">
            {type === 'quote' ? 'Prepared_For' : 'Billed_To'}
          </h3>
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-1">
            <p className="text-xl font-bold">{recipient.name}</p>
            {recipient.email && <p className="text-sm text-slate-400">{recipient.email}</p>}
            {recipient.phone && <p className="text-sm text-slate-400">{recipient.phone}</p>}
          </div>
        </div>
        <div className="flex flex-col justify-end items-end space-y-2">
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[9px] font-black uppercase text-slate-500">Issue_Date</p>
              <p className="font-bold">{date}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase text-slate-500">
                {type === 'quote' ? 'Valid_Until' : 'Due_Date'}
              </p>
              <p className="font-bold text-emerald-400">{dueDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* LINE ITEMS */}
      <table className="w-full mb-12">
        <thead>
          <tr className="text-[10px] font-black uppercase text-slate-500 border-b border-white/5">
            <th className="py-4 text-left">Description</th>
            <th className="py-4 text-center">Qty</th>
            <th className="py-4 text-right">Unit_Price</th>
            {/* Only show Disc column if there's an actual discount applied somewhere */}
            {totalDiscount > 0 && <th className="py-4 text-right">Disc_%</th>}
            <th className="py-4 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((item, i) => {
             const qty = Number(item.qty);
             const price = Number(item.price);
             const disc = Math.max(0, Number(item.disc || 0)); // Prevent negative input
             const lineTotal = (qty * price) * (1 - disc / 100);

             return (
                <tr key={i} className="text-sm">
                  <td className="py-6">
                    <span className="font-bold">{item.desc}</span>
                    {/* Add Line Note if present */}
                    {item.note && (
                        <div className="text-[10px] text-slate-400 italic mt-1 font-normal break-words pr-4">
                            {item.note}
                        </div>
                    )}
                  </td>
                  <td className="py-6 text-center text-slate-400">{qty}</td>
                  <td className="py-6 text-right">R {price.toLocaleString()}</td>
                  {totalDiscount > 0 && (
                    <td className="py-6 text-right text-emerald-400">
                      {disc > 0 ? `-${disc}%` : '-'}
                    </td>
                  )}
                  <td className="py-6 text-right font-black">R {lineTotal.toLocaleString()}</td>
                </tr>
             );
          })}
        </tbody>
      </table>

      {/* TOTALS SECTOR */}
      <div className="flex justify-end mb-12">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 uppercase font-black text-[10px]">Sub_Total</span>
            <span className="font-bold text-slate-300">R {subTotal.toLocaleString()}</span>
          </div>
          
          {/* Conditionally render total discount ONLY if > 0, formatting fixes the negative issue */}
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm">
                <span className="text-slate-500 uppercase font-black text-[10px]">Total_Discount</span>
                <span className="font-bold text-emerald-400">- R {totalDiscount.toLocaleString()}</span>
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex justify-between items-end">
            <span className="text-emerald-500 uppercase font-black text-xs">Total_Due</span>
            <span className="text-3xl font-black italic tracking-tighter">R {grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* GLOBAL NOTE SECTOR */}
      {globalNote && (
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl mb-12">
             <p className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-2">
                 <MessageSquare size={12}/> Document_Notes
             </p>
             <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                 {globalNote}
             </p>
          </div>
      )}

      {/* BANKING SETTLEMENT */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-[32px] grid grid-cols-2 gap-8">
        <div>
          <h4 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest flex items-center gap-2 mb-4">
            <Wallet size={12}/> Payment_Instructions
          </h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-500 font-mono text-[11px] uppercase">Bank:</span> FNB</p>
            <p><span className="text-slate-500 font-mono text-[11px] uppercase">Name:</span> RAD Academy</p>
            <p><span className="text-slate-500 font-mono text-[11px] uppercase">Type:</span> Cheque Account</p>
            <p><span className="text-slate-500 font-mono text-[11px] uppercase">Acc:</span> 6289 636 1632</p>
            <p><span className="text-slate-500 font-mono text-[11px] uppercase">Ref:</span> {docNumber}-{recipient.name.split(' ')[0]}</p>
          </div>
        </div>
        <div className="flex flex-col justify-center items-end opacity-40">
            <div className="text-[10px] font-black uppercase text-right leading-relaxed italic">
                System Generated Document<br/>
                RAD Academy (Pty) Ltd<br/>
                Thank you for your business
            </div>
        </div>
      </div>
    </div>
  );
}