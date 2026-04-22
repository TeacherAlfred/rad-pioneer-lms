"use client";

import { XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans selection:bg-rose-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        className="max-w-md w-full bg-white/[0.02] border border-rose-500/20 rounded-[40px] p-10 text-center shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 blur-[60px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="w-24 h-24 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-rose-500/20">
            <XCircle size={48} />
          </div>

          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white mb-4">Payment <br/>Cancelled</h1>
          
          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10">
            Your transaction was cancelled. No charges were made to your account. You can attempt the payment again from your statement whenever you are ready.
          </p>

          <Link 
            href="/login" 
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all border border-white/10"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}