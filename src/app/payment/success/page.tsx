"use client";

import { CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans selection:bg-emerald-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        className="max-w-md w-full bg-white/[0.02] border border-emerald-500/20 rounded-[40px] p-10 text-center shadow-2xl relative overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", delay: 0.2 }}
            className="w-24 h-24 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            <CheckCircle2 size={48} />
          </motion.div>

          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white mb-4">Payment <br/>Successful</h1>
          
          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10">
            Thank you! Your transaction has been securely processed. We are updating your household ledger now. You will receive an official receipt via email shortly.
          </p>

          <Link 
            href="/login" 
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
          >
            Return to Dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}