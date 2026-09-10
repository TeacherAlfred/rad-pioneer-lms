"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Inbox, Check, X, MessageSquare, Send } from "lucide-react";

type QueueRow = {
  id: string;
  lead_id: string;
  phone: string;
  label: string;
  kind: "freeform" | "template";
  preview_text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  lead_name: string | null;
  lead_phone: string | null;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OutboxPage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/lead-funnel/outbox");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load the outbox");
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, action: "approve" | "reject") {
    setActingId(id);
    setError(null);
    try {
      const res = await fetch(`/admin/api/lead-funnel/outbox/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Lead Funnel
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Inbox size={22} className="text-teal-500" /> Outbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated bot replies to business-number leads land here instead of going straight out - approve to send for real, or reject to discard. Once handled, they show up in{" "}
            <Link href="/admin/lead-funnel/sent" className="underline hover:text-slate-700">Sent Messages</Link>.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-slate-400 text-sm">
            Nothing waiting for approval right now.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.id} className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-3 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800">{row.lead_name || "(no name)"} <span className="text-slate-400 font-normal">+{row.lead_phone || row.phone}</span></p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-teal-50 text-teal-600">
                        {row.kind === "template" ? <Send size={10} /> : <MessageSquare size={10} />} {row.label}
                      </span>
                      <span className="text-[11px] text-slate-400">{fmtDateTime(row.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => act(row.id, "reject")}
                      disabled={actingId === row.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-all disabled:opacity-50"
                    >
                      <X size={12} /> Reject
                    </button>
                    <button
                      onClick={() => act(row.id, "approve")}
                      disabled={actingId === row.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
                    >
                      {actingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve &amp; Send
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl px-3.5 py-3 text-[13px] text-slate-700 whitespace-pre-wrap">{row.preview_text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
