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

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#020617] text-white p-6 md:p-12 rounded-[32px] md:rounded-[40px] border border-white/10 shadow-2xl font-sans overflow-hidden">
      
      {/* HEADER SECTOR */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-white/5 pb-8 mb-8 md:pb-10 md:mb-10">
        <div className="space-y-2 w-full md:w-auto text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-500">
            <Shield size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">RAD Academy Finance</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none text-emerald-500">
            {type.toUpperCase()}
          </h1>
          <p className="text-slate-500 font-mono text-sm">REF: {docNumber}</p>
        </div>
        
        <div className="text-center md:text-right space-y-1 w-full md:w-auto bg-white/5 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none">
          <p className="font-black uppercase text-lg italic text-white md:text-inherit">RAD Academy (Pty) Ltd</p>
          <p className="text-xs text-slate-400">Jasper Avenue, Centurion, Pretoria, GP</p>
          <p className="text-xs text-slate-400">076-906 5959 (WhatsApp)</p>
          <p className="text-xs text-slate-400">info@radacademy.co.za</p>
        </div>
      </div>

      {/* RECIPIENT & DATES */}
      <div className="flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-12 mb-10 md:mb-12">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest text-center md:text-left">
            {type === 'quote' ? 'Prepared_For' : 'Billed_To'}
          </h3>
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-1 text-center md:text-left">
            <p className="text-xl font-bold">{recipient.name}</p>
            {recipient.email && <p className="text-sm text-slate-400 break-all">{recipient.email}</p>}
            {recipient.phone && <p className="text-sm text-slate-400">{recipient.phone}</p>}
          </div>
        </div>
        
        <div className="flex flex-row justify-between md:flex-col md:justify-end md:items-end gap-4 p-6 md:p-0 bg-white/5 md:bg-transparent rounded-3xl md:rounded-none border border-white/10 md:border-transparent">
          <div className="text-left md:text-right">
            <p className="text-[9px] font-black uppercase text-slate-500">Issue_Date</p>
            <p className="font-bold text-sm md:text-base">{date}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-slate-500">
              {type === 'quote' ? 'Valid_Until' : 'Due_Date'}
            </p>
            <p className="font-bold text-emerald-400 text-sm md:text-base">{dueDate}</p>
          </div>
        </div>
      </div>

      {/* LINE ITEMS - Desktop Table View */}
      <div className="hidden md:block w-full mb-12">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-black uppercase text-slate-500 border-b border-white/5">
              <th className="py-4 text-left">Description</th>
              <th className="py-4 text-center">Qty</th>
              <th className="py-4 text-right">Unit_Price</th>
              {totalDiscount > 0 && <th className="py-4 text-right">Disc_%</th>}
              <th className="py-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item, i) => {
               const qty = Number(item.qty);
               const price = Number(item.price);
               const disc = Math.max(0, Number(item.disc || 0)); 
               const lineTotal = (qty * price) * (1 - disc / 100);

               return (
                  <tr key={i} className="text-sm">
                    <td className="py-6">
                      <span className="font-bold text-base">{item.desc}</span>
                      {item.note && (
                          <div className="text-xs text-slate-400 italic mt-1 font-normal break-words pr-4">
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
      </div>

      {/* LINE ITEMS - Mobile Stack View */}
      <div className="md:hidden space-y-4 mb-8">
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5 pb-2">Line Items</h3>
        {items.map((item, i) => {
           const qty = Number(item.qty);
           const price = Number(item.price);
           const disc = Math.max(0, Number(item.disc || 0)); 
           const lineTotal = (qty * price) * (1 - disc / 100);

           return (
             <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <div>
                  <p className="font-bold text-base leading-tight">{item.desc}</p>
                  {item.note && <p className="text-[11px] text-slate-400 italic mt-1 leading-snug">{item.note}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 text-sm">
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500">Qty x Price</p>
                    <p className="text-slate-300">{qty} x R {price.toLocaleString()}</p>
                  </div>
                  {disc > 0 && (
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-slate-500">Discount</p>
                      <p className="text-emerald-400">-{disc}%</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-end pt-2">
                  <span className="text-[10px] font-black uppercase text-emerald-500">Line Total</span>
                  <span className="font-black text-lg">R {lineTotal.toLocaleString()}</span>
                </div>
             </div>
           );
        })}
      </div>

      {/* TOTALS SECTOR */}
      <div className="flex justify-end mb-10 md:mb-12 border-t border-white/10 md:border-none pt-6 md:pt-0">
        <div className="w-full md:w-72 bg-white/5 md:bg-transparent p-6 md:p-0 rounded-3xl md:rounded-none space-y-3">
          <div className="flex justify-between text-sm md:text-base">
            <span className="text-slate-500 uppercase font-black text-[10px] md:text-xs tracking-widest mt-1">Sub_Total</span>
            <span className="font-bold text-slate-300">R {subTotal.toLocaleString()}</span>
          </div>
          
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm md:text-base">
                <span className="text-slate-500 uppercase font-black text-[10px] md:text-xs tracking-widest mt-1">Total_Discount</span>
                <span className="font-bold text-emerald-400">- R {totalDiscount.toLocaleString()}</span>
            </div>
          )}

          <div className="pt-4 border-t border-white/10 flex justify-between items-end">
            <span className="text-emerald-500 uppercase font-black text-xs md:text-sm tracking-widest mb-1">Total_Due</span>
            <span className="text-4xl font-black italic tracking-tighter text-white">R {grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* GLOBAL NOTE SECTOR */}
      {globalNote && (
          <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl mb-10 md:mb-12 shadow-inner">
             <p className="text-[10px] font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                 <MessageSquare size={14}/> Document_Notes
             </p>
             <p className="text-xs md:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                 {globalNote}
             </p>
          </div>
      )}

      {/* BANKING SETTLEMENT */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 md:p-8 rounded-[32px] flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-8">
        <div>
          <h4 className="text-[10px] md:text-xs font-black uppercase text-emerald-500 tracking-widest flex items-center justify-center md:justify-start gap-2 mb-4 md:mb-5 border-b border-emerald-500/20 md:border-none pb-3 md:pb-0">
            <Wallet size={14}/> Payment_Instructions
          </h4>
          <div className="space-y-2 text-sm text-center md:text-left bg-[#020617]/50 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none">
            <p><span className="text-slate-500 font-mono text-[10px] uppercase mr-2 tracking-widest">Bank:</span> FNB</p>
            <p><span className="text-slate-500 font-mono text-[10px] uppercase mr-2 tracking-widest">Name:</span> RAD Academy</p>
            <p><span className="text-slate-500 font-mono text-[10px] uppercase mr-2 tracking-widest">Type:</span> Cheque Account</p>
            <p><span className="text-slate-500 font-mono text-[10px] uppercase mr-2 tracking-widest">Acc:</span> 6289 636 1632</p>
            <p className="pt-2 mt-2 border-t border-emerald-500/10 text-emerald-400 font-black"><span className="text-slate-500 font-mono text-[10px] uppercase mr-2 tracking-widest font-normal">Ref:</span> {docNumber}-{recipient.name.split(' ')[0]}</p>
          </div>
        </div>
        <div className="flex flex-col justify-center items-center md:items-end opacity-40 pt-4 md:pt-0 border-t border-emerald-500/10 md:border-none">
            <div className="text-[9px] md:text-[10px] font-black uppercase text-center md:text-right leading-relaxed italic tracking-widest">
                System Generated Document<br/>
                RAD Academy (Pty) Ltd<br/>
                Thank you for your business
            </div>
        </div>
      </div>
    </div>
  );
}