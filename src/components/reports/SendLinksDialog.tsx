"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { waLink, type SendResult } from "@/lib/reports/client";

// Shows the freshly issued private links with their prefilled WhatsApp
// messages. Tokens are only ever visible here (the DB keeps a hash), so
// closing this without sending means re-issuing - which is safe, it just
// revokes the previous link for that guardian.
export default function SendLinksDialog({
  results, names, onClose,
}: { results: SendResult[] | null; names: Record<string, string>; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success("Copied");
      setTimeout(() => setCopied(c => (c === id ? null : c)), 1500);
    } catch {
      toast.error("Couldn't copy - select the text instead.");
    }
  }

  const all = (results ?? []).flatMap(r => r.links ?? []);

  return (
    <AnimatePresence>
      {results && (
        <motion.div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="bg-white w-full sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl text-slate-900"
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">WhatsApp messages</h2>
                <p className="text-[12px] text-slate-400">Each link is private to one guardian and expires in 90 days.</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {all.length > 1 && (
                <button onClick={() => copy(all.map(l => l.message).join("\n\n"), "all")} className="w-full inline-flex justify-center items-center gap-2 text-sm font-medium border border-slate-200 rounded-xl py-2 hover:bg-slate-50">
                  {copied === "all" ? <Check size={15} /> : <Copy size={15} />} Copy all {all.length} messages
                </button>
              )}
              {(results ?? []).map(r => (
                <div key={r.reportId} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{names[r.reportId] ?? "Report"}</p>
                  {r.error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{r.error}</p>}
                  {(r.links ?? []).map(l => (
                    <div key={l.guardian_lead_id} className="border border-slate-100 rounded-xl p-3 space-y-2">
                      <p className="text-sm font-medium">{l.guardian_name} <span className="text-slate-400 font-normal">{l.phone ?? "no number"}</span></p>
                      <p className="text-[13px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2 break-words">{l.message}</p>
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.96 }} onClick={() => copy(l.message, l.guardian_lead_id + r.reportId)} className="flex-1 inline-flex justify-center items-center gap-1.5 text-sm border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50">
                          {copied === l.guardian_lead_id + r.reportId ? <Check size={14} /> : <Copy size={14} />} Copy
                        </motion.button>
                        {l.phone && (
                          <motion.a whileTap={{ scale: 0.96 }} href={waLink(l.phone, l.message)} target="_blank" rel="noreferrer" className="flex-1 inline-flex justify-center items-center gap-1.5 text-sm text-white bg-emerald-600 rounded-lg py-1.5 hover:bg-emerald-700">
                            <MessageCircle size={14} /> Open WhatsApp
                          </motion.a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
