"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useInboundMessagePoll, type InboundMessagePollRow } from "@/lib/useInboundMessagePoll";

const MEDIA_PREVIEW: Record<string, string> = {
  image: "📷 Sent a photo",
  sticker: "😀 Sent a sticker",
  video: "🎥 Sent a video",
  audio: "🎵 Sent a voice note",
  document: "📄 Sent a document",
};

const AUTO_DISMISS_MS = 15000;

// Front-and-centre popup for a lead's inbound WhatsApp message - top-center,
// not tucked in a corner, since this is meant to interrupt whatever the
// admin is doing the moment a lead replies, not wait for a refresh. See
// useInboundMessagePoll for why this polls instead of using Supabase
// Realtime (leads/messages RLS is service-role only).
export default function InboundMessageAlert() {
  const [toasts, setToasts] = useState<InboundMessagePollRow[]>([]);
  const router = useRouter();

  const handleNewMessages = useCallback((rows: InboundMessagePollRow[]) => {
    setToasts(prev => [...prev, ...rows]);
    rows.forEach(row => {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== row.id));
      }, AUTO_DISMISS_MS);
    });
  }, []);

  useInboundMessagePoll(handleNewMessages);

  function dismiss(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function view(id: string) {
    dismiss(id);
    router.push('/admin/lead-funnel/messages');
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md flex flex-col gap-2.5 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex items-start gap-3"
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <MessageCircle size={17} className="animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">New WhatsApp Message</span>
                <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-300 shrink-0"><X size={13} /></button>
              </div>
              <p className="text-sm font-bold text-white truncate mt-0.5">{t.lead_name || `+${t.lead_phone}`}</p>
              <p className="text-[13px] text-slate-300 truncate mt-0.5">
                {t.media_type ? (MEDIA_PREVIEW[t.media_type] || 'Sent an attachment') : (t.body || '')}
              </p>
              <button
                onClick={() => view(t.id)}
                className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300"
              >
                View Conversation →
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
