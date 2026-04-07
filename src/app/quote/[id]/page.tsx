"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, FileSignature, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import RADBillingDocument from "@/components/finance/RADBillingDocument";

export default function PublicQuoteView() {
  const params = useParams();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [guardian, setGuardian] = useState<any>(null);
  const [actionState, setActionState] = useState<'pending' | 'accepted' | 'declined' | 'expired'>('pending');
  
  const [pendingAction, setPendingAction] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (quoteId) fetchQuoteData();
  }, [quoteId]);

  async function fetchQuoteData() {
    try {
      const { data: quoteData, error: quoteErr } = await supabase
        .from('billing_records')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteErr || !quoteData) throw new Error("Quote not found");
      
      if (quoteData.expires_at && new Date(quoteData.expires_at) < new Date() && quoteData.status === 'pending') {
        setActionState('expired');
      } else if (quoteData.status === 'accepted' || quoteData.status === 'declined') {
        setActionState(quoteData.status as 'accepted' | 'declined');
      }

      setQuote(quoteData);

      // --- THE FIX: Prospect-Aware Routing ---
      if (quoteData.guardian_id) {
        // Path A: This is a fully registered user
        const { data: guardianData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', quoteData.guardian_id)
          .single();

        if (guardianData) setGuardian(guardianData);
      } else if (quoteData.metadata?.prospect_name) {
        // Path B: This is a CRM Prospect. Create a virtual guardian object for the UI!
        setGuardian({
          id: null, // No official ID yet
          display_name: quoteData.metadata.prospect_name,
          email: quoteData.metadata.prospect_email,
          metadata: { email: quoteData.metadata.prospect_email, phone: "Pending Account Setup" }
        });
      } else {
        throw new Error("No recipient data found on this document.");
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const executeAction = async () => {
    if (!pendingAction) return;
    setIsProcessing(true);

    try {
      // 1. Update the document status to Accepted/Declined
      await supabase
        .from('billing_records')
        .update({ status: pendingAction })
        .eq('id', quoteId);

      // 2. ONLY attempt to update the profile if they actually have a database ID
      if (pendingAction === 'accepted' && guardian?.id) {
        await supabase
          .from('profiles')
          .update({ status: 'active', funnel_stage: 'Active (Paid Client)' })
          .eq('id', guardian.id);
      }

      if (pendingAction === 'declined' && guardian?.id) {
        await supabase
          .from('profiles')
          .update({ status: 'dropped', funnel_stage: 'Dropped' })
          .eq('id', guardian.id);
      }

      setActionState(pendingAction);
      setPendingAction(null); 
    } catch (err: any) {
      alert("System Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-purple-400 font-black uppercase tracking-widest text-[10px]">Retrieving_Secure_Document...</p>
      </div>
    );
  }

  if (!quote || !guardian) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6">
        <XCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Document Not Found</h1>
        <p className="text-slate-500 mt-2">The link you followed may be invalid or the document has been permanently removed.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-12 font-sans selection:bg-purple-500/30">
      
      {/* STATUS BANNER */}
      {actionState !== 'pending' && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }}
          className={`max-w-4xl mx-auto mb-8 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-center gap-4 text-center border ${
            actionState === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            actionState === 'declined' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
            'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          {actionState === 'accepted' && <CheckCircle2 size={32} />}
          {actionState === 'declined' && <XCircle size={32} />}
          {actionState === 'expired' && <FileSignature size={32} />}
          
          <div className="space-y-1">
            <h2 className="text-xl font-black uppercase tracking-widest">
              Quotation {actionState.charAt(0).toUpperCase() + actionState.slice(1)}
            </h2>
            <p className="text-xs opacity-80">
              {actionState === 'accepted' && "Thank you! We will issue your official invoice shortly."}
              {actionState === 'declined' && "This quotation has been securely declined and closed."}
              {actionState === 'expired' && "This quotation has passed its validity date. Please contact us for a revised quote."}
            </p>
          </div>
        </motion.div>
      )}

      {/* THE DOCUMENT */}
      <div className={`transition-all duration-700 ${actionState !== 'pending' ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
        <RADBillingDocument 
          type="quote"
          docNumber={`QT-${quote.invoice_number}`}
          recipient={{
              name: guardian.display_name,
              email: guardian.metadata?.email || guardian.email || "",
              phone: guardian.metadata?.phone || guardian.phone || ""
          }}
          items={quote.line_items}
          date={new Date(quote.created_at).toLocaleDateString('en-ZA')}
          dueDate={quote.expires_at ? new Date(quote.expires_at).toLocaleDateString('en-ZA') : 'No Expiry'}
          globalNote={quote.metadata?.global_note}
        />
      </div>

      {/* INTERACTIVE RESPONSE BAR */}
      {actionState === 'pending' && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 w-full bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/10 p-6 z-40"
        >
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Action Required</p>
              <p className="text-sm font-bold text-white mt-1">Please review the details above and provide your response.</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={() => setPendingAction('declined')}
                className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-black uppercase tracking-widest text-xs hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-all"
              >
                Decline
              </button>
              <button 
                onClick={() => setPendingAction('accepted')}
                className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-purple-600 text-white font-black uppercase tracking-widest text-xs hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/20 flex items-center justify-center gap-2"
              >
                Accept Quotation
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      <AnimatePresence>
        {pendingAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f172a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl text-center space-y-6"
            >
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${pendingAction === 'accepted' ? 'bg-purple-500/20 text-purple-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {pendingAction === 'accepted' ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
              </div>
              
              <div>
                <h3 className="text-2xl font-black uppercase italic mb-2">
                  {pendingAction === 'accepted' ? 'Accept Quotation?' : 'Decline Quotation?'}
                </h3>
                <p className="text-sm text-slate-400">
                  {pendingAction === 'accepted' 
                    ? "By accepting, you agree to the pricing outlined above. We will officially upgrade your account and issue an invoice." 
                    : "Are you sure you want to decline? This action cannot be undone."}
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setPendingAction(null)}
                  disabled={isProcessing}
                  className="flex-1 py-4 rounded-xl bg-white/5 text-slate-300 font-bold text-xs uppercase hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeAction}
                  disabled={isProcessing}
                  className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 ${
                    pendingAction === 'accepted' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Padding to ensure document isn't hidden behind the fixed bar */}
      {actionState === 'pending' && <div className="h-32"></div>}
    </div>
  );
}