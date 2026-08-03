"use client";

import { Activity, Target, Receipt, Wallet, AlertTriangle } from "lucide-react";

interface MacroEconomicsCardsProps {
  cashflow: {
    expected: number;
    invoiced: number;
    collected: number;
    outstanding: number;
  };
  currentMonth: string;
}

export default function MacroEconomicsCards({ cashflow, currentMonth }: MacroEconomicsCardsProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-2">
          <Activity className="text-blue-600"/> Monthly Macro-Economics
        </h2>
        <span className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
          {currentMonth}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 relative z-10 flex items-center gap-2"><Target size={14}/> Expected Rev</p>
          <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.expected.toLocaleString()}</p>
          <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Target for current month</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-2 relative z-10 flex items-center gap-2"><Receipt size={14}/> Actually Invoiced</p>
          <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.invoiced.toLocaleString()}</p>
          <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Billed to clients</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 relative z-10 flex items-center gap-2"><Wallet size={14}/> Collected (Cash)</p>
          <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.collected.toLocaleString()}</p>
          <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Secured in bank</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-500"/>
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2 relative z-10 flex items-center gap-2"><AlertTriangle size={14}/> Outstanding</p>
          <p className="text-4xl font-black tracking-tighter text-slate-900 relative z-10">R {cashflow.outstanding.toLocaleString()}</p>
          <p className="text-xs font-bold text-slate-400 mt-2 relative z-10">Awaiting payment</p>
        </div>
      </div>
    </>
  );
}