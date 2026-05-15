"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Receipt, Loader2, FileMinus, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface CreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  guardians: any[];
}

export default function CreditNoteModal({ isOpen, onClose, onSuccess, guardians }: CreditNoteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    guardian_id: "",
    amount: "",
    reason: "",
    reference_invoice: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guardian_id) return alert("Please select a client.");
    
    setIsSubmitting(true);

    try {
      const creditAmount = parseFloat(formData.amount);
      const issueDate = new Date().toISOString();
      const creditRef = `CN-${Date.now().toString().slice(-6)}`;

      // 1. Log the Credit Note as a Billing Document (Paper Trail)
      const { error: docError } = await supabase.from('billing_records').insert([{
        guardian_id: formData.guardian_id,
        total_amount: creditAmount,
        status: 'settled', // Credit notes are essentially pre-settled
        doc_type: 'credit_note',
        invoice_number: Date.now().toString().slice(-6), // Unique pseudo-number
        payment_reference: creditRef,
        created_at: issueDate,
        line_items: [{ 
            desc: `Credit Note: ${formData.reason} ${formData.reference_invoice ? `(Ref: ${formData.reference_invoice})` : ''}`, 
            price: creditAmount, 
            qty: 1, 
            disc: 0 
        }]
      }]);

      if (docError) throw docError;

      // 2. Log an automatic Payment to instantly offset their Ledger balance
      const { error: paymentError } = await supabase.from('payments').insert([{
        parent_id: formData.guardian_id,
        amount: creditAmount,
        status: 'completed',
        description: `Applied Credit: ${formData.reason} ${formData.reference_invoice ? `(Ref: ${formData.reference_invoice})` : ''}`,
        paid_at: issueDate,
        created_at: issueDate
      }]);

      if (paymentError) throw paymentError;

      setFormData({ guardian_id: "", amount: "", reason: "", reference_invoice: "" });
      onClose();
      onSuccess(`Credit Note for R ${creditAmount.toLocaleString()} successfully applied to ledger.`);

    } catch (error: any) {
      alert(`Error issuing credit note: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <motion.form 
        onSubmit={handleSubmit}
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative bg-[#0f172a] border border-rose-500/20 rounded-[48px] w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.1)] flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 md:p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/30 text-rose-400"><FileMinus size={28} /></div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Issue Credit Note</h2>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mt-2">Offset Ledger Balances</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
        </div>

        {/* Body */}
        <div className="p-8 md:p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Client / Guardian *</label>
            <select 
              required value={formData.guardian_id} onChange={e => setFormData({...formData, guardian_id: e.target.value})}
              className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white text-sm font-bold outline-none focus:border-rose-500 appearance-none cursor-pointer"
            >
              <option value="" disabled>Select Client...</option>
              {guardians.map(g => (
                <option key={g.id} value={g.id}>
                  {g.display_name} ({g.metadata?.email || g.metadata?.prospect_email || 'No Email'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Credit Amount (ZAR) *</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R</span>
                <input 
                  required type="number" step="0.01" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full bg-[#020617] border border-rose-500/30 rounded-2xl pl-12 pr-6 py-4 text-rose-400 font-black tracking-tight outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Related Invoice (Optional)</label>
              <input 
                type="text" placeholder="e.g. INV-1042" value={formData.reference_invoice} onChange={e => setFormData({...formData, reference_invoice: e.target.value})}
                className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-sm outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reason for Credit *</label>
            <input 
              required type="text" placeholder="e.g. Goodwill discount for missed class" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}
              className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-rose-500"
            />
          </div>

          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="text-rose-500 shrink-0 mt-0.5" size={16} />
            <p className="text-xs font-medium text-rose-200/70 leading-relaxed">
              Applying this credit note will immediately act as a payment on the client's ledger, reducing their total outstanding balance by <strong className="text-rose-400 font-black">R {parseFloat(formData.amount || "0").toLocaleString()}</strong>.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-8 md:p-10 border-t border-white/5 bg-black/40 flex justify-between items-center gap-8 shrink-0">
          <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
          <button 
            type="submit" disabled={isSubmitting}
            className="bg-rose-600 text-white px-10 py-5 rounded-3xl font-black uppercase italic text-xs tracking-widest flex items-center gap-3 hover:bg-rose-500 shadow-[0_10px_30px_rgba(225,29,72,0.3)] transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <FileMinus size={18} />} Issue_Credit
          </button>
        </div>
      </motion.form>
    </div>
  );
}