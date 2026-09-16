"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Inbox, Check, X, MessageSquare, Send, GitBranch, ShieldAlert } from "lucide-react";

type QueueRow = {
  id: string;
  lead_id: string;
  phone: string;
  label: string;
  kind: "freeform" | "template";
  preview_text: string;
  status: "pending" | "approved" | "rejected";
  reason: string[];
  flow_label: string | null;
  editable: boolean;
  created_at: string;
  lead_name: string | null;
  lead_phone: string | null;
};

const REASON_LABEL: Record<string, string> = {
  business_number: "Business number",
  flow_requires_approval: "Flow requires approval",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OutboxPage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  // Seeded from preview_text per row once loaded - only ever read back for
  // editable rows (see the GET route's `editable` flag); a template or a
  // document-only freeform send has no field here worth rewriting.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/lead-funnel/outbox");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load the outbox");
      const loaded: QueueRow[] = data.rows || [];
      setRows(loaded);
      setDrafts(prev => {
        const next = { ...prev };
        for (const r of loaded) {
          if (r.editable && !(r.id in next)) next[r.id] = r.preview_text;
        }
        return next;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(row: QueueRow, action: "approve" | "reject") {
    setActingId(row.id);
    setError(null);
    try {
      const editedText = action === "approve" && row.editable ? drafts[row.id] : undefined;
      const res = await fetch(`/admin/api/lead-funnel/outbox/${row.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      setRows(prev => prev.filter(r => r.id !== row.id));
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
            An automated send lands here instead of going straight out when the lead is flagged a business number, or the bot flow itself always requires approval - approve to send for real (editing the wording first if it's freeform), or reject to discard. Once handled, they show up in{" "}
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
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-teal-50 text-teal-600">
                        {row.kind === "template" ? <Send size={10} /> : <MessageSquare size={10} />} {row.label}
                      </span>
                      {row.flow_label && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-slate-100 text-slate-500" title="The bot_flows row this came from">
                          <GitBranch size={10} /> {row.flow_label}
                        </span>
                      )}
                      {row.reason.map(r => (
                        <span key={r} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-600">
                          <ShieldAlert size={10} /> {REASON_LABEL[r] || r}
                        </span>
                      ))}
                      <span className="text-[11px] text-slate-400">{fmtDateTime(row.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => act(row, "reject")}
                      disabled={actingId === row.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-all disabled:opacity-50"
                    >
                      <X size={12} /> Reject
                    </button>
                    <button
                      onClick={() => act(row, "approve")}
                      disabled={actingId === row.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
                    >
                      {actingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve &amp; Send
                    </button>
                  </div>
                </div>
                {row.editable ? (
                  <textarea
                    rows={4}
                    value={drafts[row.id] ?? row.preview_text}
                    onChange={e => setDrafts(prev => ({ ...prev, [row.id]: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-[13px] text-slate-700 outline-none focus:border-blue-400 resize-none"
                  />
                ) : (
                  <div className="bg-slate-50 rounded-xl px-3.5 py-3 text-[13px] text-slate-700 whitespace-pre-wrap">{row.preview_text}</div>
                )}
                {row.kind === "template" && (
                  <p className="text-[11px] text-slate-400">Approved-template wording can't be edited here - Meta enforces the exact registered text.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
