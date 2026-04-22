"use client";

import { useState, useEffect } from "react";
import { Phone, Mail, Building2, Lock } from "lucide-react";

export default function RADStatement({ guardianId, name, email, phone, transactions = [], balanceDue = 0 }: any) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  
  // Create a state to hold the payment amount, defaulting to the full balance
  const [payAmount, setPayAmount] = useState<number | string>(balanceDue);

  // If the balanceDue prop updates (e.g. on load), sync it to the input box
  useEffect(() => {
    setPayAmount(balanceDue);
  }, [balanceDue]);

  return (
    <div className="max-w-4xl mx-auto bg-[#020617] text-white p-8 md:p-12 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
        <div className="space-y-6">
          <img
            src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD_Logo_white_v2.png"
            alt="RAD Academy"
            className="h-14 md:h-16 object-contain"
          />
          <div className="space-y-1.5 text-xs font-medium text-slate-400">
            <p className="font-black text-white text-sm uppercase tracking-widest mb-3">RAD Academy (Pty) Ltd</p>
            <p className="flex items-center gap-2"><Phone size={14}/> 076 706 5959</p>
            <p className="flex items-center gap-2"><Mail size={14}/> info@radacademy.co.za</p>
          </div>
        </div>

        <div className="text-left md:text-right space-y-4 w-full md:w-auto">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">Statement</h1>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left w-full md:min-w-[280px]">
            <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
              <span>Date:</span>
              <span className="text-white">{today}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-400 mb-4 border-b border-white/5 pb-4">
              <span>Page:</span>
              <span className="text-white">1</span>
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Amount Due:</span>
              <span className="text-[10px] font-black tracking-widest text-white">R {Number(balanceDue).toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span>
            </div>
            
            {/* INTEGRATED PAYFAST SANDBOX FORM WITH CUSTOM AMOUNT */}
            {balanceDue > 0 && (
              <div className="mt-5 pt-5 border-t border-white/5">
                <div className="mb-4">
                  <label className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1.5 block">Amount to Pay Today</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black">R</span>
                    <input 
                      type="number"
                      min="1"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full bg-[#020617] border border-emerald-500/30 focus:border-emerald-400 rounded-xl py-3 pl-8 pr-4 text-emerald-400 font-black outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <form action="https://sandbox.payfast.co.za/eng/process" method="POST">
                  {/* 1. Merchant Details (REPLACE WITH YOUR SANDBOX DETAILS) */}
                  <input type="hidden" name="merchant_id" value="10048108" />
                  <input type="hidden" name="merchant_key" value="rmic3yvvboic9" />
                  
                  {/* Custom String to securely pass the Guardian ID to our Webhook */}
                  <input type="hidden" name="custom_str1" value={guardianId} />
                  
                  {/* 2. Return URLs */}
                  <input type="hidden" name="return_url" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/payment/success`} />
                  <input type="hidden" name="cancel_url" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/payment/cancel`} />
                  <input type="hidden" name="notify_url" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/payfast/webhook`} />
                  
                  {/* 3. Transaction Details */}
                  <input type="hidden" name="name_first" value={name?.split(' ')[0] || 'Parent'} />
                  <input type="hidden" name="email_address" value={email || 'info@radacademy.co.za'} />
                  
                  {/* Amount pulls directly from the user's input box */}
                  <input type="hidden" name="amount" value={Number(payAmount).toFixed(2)} />
                  <input type="hidden" name="item_name" value={`RAD Academy Payment - ${name}`} />

                  <button 
                    type="submit"
                    disabled={Number(payAmount) <= 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lock size={12} /> Pay Securely via PayFast
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BILL TO SECTION */}
      <div className="mb-10 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">To:</p>
        <h2 className="text-xl font-black text-white uppercase italic tracking-tight">{name || "Client Name"}</h2>
        
        {/* Contact details forced into a single wrap-friendly row */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mt-2 text-sm">
          {email && (
            <p><span className="font-bold text-slate-500 mr-1.5">Email:</span><span className="text-slate-300">{email}</span></p>
          )}
          {phone && (
            <p><span className="font-bold text-slate-500 mr-1.5">Mobile:</span><span className="text-slate-300">{phone}</span></p>
          )}
        </div>
      </div>
      
      {/* TRANSACTIONS TABLE */}
      <div className="mb-12 rounded-3xl border border-white/5 overflow-hidden">
        <table className="w-full text-left whitespace-nowrap md:whitespace-normal">
          <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th className="py-4 px-6">Date</th>
              <th className="py-4 px-6">Reference</th>
              <th className="py-4 px-6">Description</th>
              <th className="py-4 px-6 text-right">Debit</th>
              <th className="py-4 px-6 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-[#020617]">
            {(!transactions || transactions.length === 0) ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 italic text-xs font-bold">No transactions found for this period.</td>
              </tr>
            ) : (
              transactions.map((tx: any, i: number) => (
                <tr key={i} className="text-xs hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 text-slate-400 font-medium">{tx.date}</td>
                  <td className="py-4 px-6 font-mono text-emerald-400/80 font-bold">{tx.ref}</td>
                  <td className="py-4 px-6 text-slate-300">{tx.desc}</td>
                  <td className="py-4 px-6 text-right font-black text-white">{tx.debit ? `R ${Number(tx.debit).toLocaleString('en-ZA', {minimumFractionDigits: 2})}` : '-'}</td>
                  <td className="py-4 px-6 text-right font-black text-emerald-400">{tx.credit ? `R ${Number(tx.credit).toLocaleString('en-ZA', {minimumFractionDigits: 2})}` : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* BOTTOM GRID: AGING & BANKING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Aging Matrix */}
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aging Summary</p>
          <div className="grid grid-cols-5 gap-2 border border-white/5 rounded-3xl bg-white/[0.02] p-3">
            {['120+', '90', '60', '30', 'Current'].map((label, i) => (
              <div key={i} className={`p-3 rounded-2xl text-center flex flex-col justify-center transition-colors ${i === 4 ? 'bg-emerald-500/10 border border-emerald-500/20 shadow-inner' : 'opacity-60'}`}>
                <p className="text-[8px] font-black uppercase tracking-wider text-slate-200 mb-1">{label}</p>
                <p className={`text-[6px] sm:text-xs ${i === 4 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {i === 4 ? `R${Number(balanceDue).toLocaleString('en-ZA')}` : '0.00'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Banking Details */}
        <div className="bg-blue-600/10 border border-blue-500/20 p-6 md:p-8 rounded-[32px]">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400"><Building2 size={16} /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Official Banking Details</p>
          </div>
          
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-blue-500/10 pb-3">
              <span className="font-bold text-slate-400">Account Name:</span>
              <span className="font-black text-white">RAD Academy (Pty) Ltd</span>
            </div>
            <div className="flex justify-between items-center border-b border-blue-500/10 pb-3">
              <span className="font-bold text-slate-400">Bank:</span>
              <span className="font-black text-white">FNB</span>
            </div>
            <div className="flex justify-between items-center border-b border-blue-500/10 pb-3">
              <span className="font-bold text-slate-400">Account Number:</span>
              <span className="font-black text-white tracking-widest text-sm">6289 636 1632</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-slate-400">Reference:</span>
              <span className="font-black text-emerald-400 italic">Your Name & Surname</span>
            </div>
          </div>
          
          <p className="text-[9px] text-blue-300/70 font-bold uppercase tracking-widest mt-6 text-center">
            Please email proof of payment to <br/><span className="text-blue-400">info@radacademy.co.za</span>
          </p>
        </div>
      </div>

    </div>
  );
}