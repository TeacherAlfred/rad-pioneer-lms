"use client";

import { useState } from "react";
import { Loader2, MessageCircle, X } from "lucide-react";

// Logs a manual "opened WhatsApp Desktop/Web to send this" attempt before
// handing off to wa.me - there's no API delivery confirmation possible for
// a message sent by hand, so the honest record is "the admin clicked send
// with this text," not a real status. Same log-before-open pattern as
// dashboard-v2/projects/irene-fitness's message-sends click log, applied to
// the lead-funnel Messages Outbox (2026-09-08) rather than duplicated again.
export function DesktopSendButton({
  leadId,
  phone,
  className,
}: {
  leadId: string;
  phone: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/lead-funnel/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, phone, body: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log the send");
      const digits = phone.replace(/\D/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`, "_blank", "noopener,noreferrer");
      setText("");
      setOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Open WhatsApp Desktop/Web with a message, and log the attempt"
        className={className || "inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"}
      >
        <MessageCircle size={12} /> Desktop WA
      </button>

      {open && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 pt-6 pb-1">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">Send via WhatsApp Desktop</h3>
                <p className="text-[13px] text-slate-400 mt-0.5">+{phone} · opens outside the system, no delivery confirmation possible</p>
              </div>
              <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={13} /></button>
            </div>
            <div className="px-6 pt-4 pb-5 space-y-3">
              <textarea
                autoFocus
                rows={4}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What are you sending?"
                className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 resize-none"
              />
              {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">Cancel</button>
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : "Log & Open WhatsApp"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
