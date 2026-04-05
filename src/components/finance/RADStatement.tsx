"use client";

import { Activity, Clock, ChevronRight } from "lucide-react";

export default function RADStatement({ name, email, transactions, balanceDue }: any) {
  return (
    <div className="max-w-4xl mx-auto bg-[#020617] text-white p-12 rounded-[40px] border border-white/10 shadow-2xl">
      <div className="flex justify-between items-end border-b border-white/5 pb-10 mb-10">
        <div>
           <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none mb-2">
             Ledger_<span className="text-emerald-500">Statement</span>
           </h1>
           <p className="text-xs text-slate-500 uppercase tracking-widest font-black">As of: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="text-right">
           <p className="text-3xl font-black text-emerald-400 italic">R {balanceDue.toLocaleString()}</p>
           <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total_Balance_Due</p>
        </div>
      </div>

      {/* TRANSACTION MATRIX */}
      <table className="w-full mb-12">
        <thead className="text-[10px] font-black uppercase text-slate-500">
          <tr>
            <th className="py-4 text-left">Date</th>
            <th className="py-4 text-left">Reference</th>
            <th className="py-4 text-left">Description</th>
            <th className="py-4 text-right">Debit</th>
            <th className="py-4 text-right">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 border-t border-white/5">
          {transactions.map((tx: any, i: number) => (
            <tr key={i} className="text-xs hover:bg-white/[0.02]">
              <td className="py-4 text-slate-400">{tx.date}</td>
              <td className="py-4 font-mono text-emerald-500/80">{tx.ref}</td>
              <td className="py-4 text-slate-300 italic">{tx.desc}</td>
              <td className="py-4 text-right font-bold">{tx.debit ? `R ${tx.debit.toLocaleString()}` : '-'}</td>
              <td className="py-4 text-right font-bold text-emerald-400">{tx.credit ? `R ${tx.credit.toLocaleString()}` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* AGING MATRIX */}
      <div className="grid grid-cols-5 gap-2 border-t border-white/5 pt-10">
        {['120+ Days', '90 Days', '60 Days', '30 Days', 'Current'].map((label, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${i === 4 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/5 opacity-50'}`}>
            <p className="text-[8px] font-black uppercase text-slate-500 mb-1">{label}</p>
            <p className="text-sm font-black">{i === 4 ? `R ${balanceDue.toLocaleString()}` : 'R 0.00'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}