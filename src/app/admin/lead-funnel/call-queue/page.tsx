"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, RefreshCcw, Phone, SkipForward, X, Pin, AlertTriangle, Target, Inbox, Clock, CheckCircle2, Pencil, Info } from "lucide-react";
import { LeadPicker, type PickerLead } from "@/components/admin/LeadPicker";
import { ContactLogForm } from "@/components/admin/ContactLogForm";

type QueueLead = {
  id: string;
  name: string | null;
  phone: string;
  company_name: string | null;
  lifecycle_stage: string | null;
  stage_health: string | null;
  engagement_recency: string | null;
  needs_human: boolean | null;
  is_customer: boolean | null;
};

type QueueRow = {
  id: string;
  lead_id: string;
  target_date: string;
  status: string;
  manual_priority: number | null;
  added_at: string;
  lead: QueueLead | null;
};

type StaleFlag = { id: string; lead_id: string; lead_name: string | null; reason: string };

type QueueStats = {
  weekStart: string;
  target: number | null;
  totalInQueue: number;
  waitingToProcess: number;
  processedByDay: Record<string, number>;
  processedThisWeek: number;
};

const DAY_LABELS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
];

function urgencyLabel(lead: QueueLead | null): { text: string; className: string } | null {
  if (!lead) return null;
  if (lead.needs_human) return { text: "Needs Reply", className: "bg-amber-50 text-amber-600" };
  if (lead.stage_health === "stalled") return { text: "Stalled", className: "bg-amber-50 text-amber-600" };
  if (lead.stage_health === "dormant") return { text: "Dormant", className: "bg-rose-50 text-rose-500" };
  if (lead.engagement_recency === "cold") return { text: "Cold", className: "bg-slate-100 text-slate-500" };
  if (lead.engagement_recency === "dormant") return { text: "Cooling off", className: "bg-orange-50 text-orange-600" };
  return null;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CallQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [stale, setStale] = useState<StaleFlag[]>([]);
  const [suggestions, setSuggestions] = useState<QueueLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingRowId, setLoggingRowId] = useState<string | null>(null);

  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await fetch('/admin/api/lead-funnel/call-queue/stats');
      const data = await res.json();
      setStats(data);
    } finally {
      setStatsLoading(false);
    }
  }

  function openEditTarget() {
    setTargetInput(stats?.target != null ? String(stats.target) : '');
    setEditingTarget(true);
  }

  async function saveTarget() {
    const target = Number(targetInput);
    if (!Number.isFinite(target) || target < 0) return;
    setSavingTarget(true);
    try {
      const res = await fetch('/admin/api/lead-funnel/call-queue/stats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (res.ok) {
        setStats(prev => prev ? { ...prev, target: data.row.target } : prev);
        setEditingTarget(false);
      }
    } finally {
      setSavingTarget(false);
    }
  }

  const [addLead, setAddLead] = useState<PickerLead | null>(null);
  const [addTargetDate, setAddTargetDate] = useState(todayIso());
  const [addPriority, setAddPriority] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/lead-funnel/call-queue?status=pending");
      const data = await res.json();
      setRows(data.rows || []);
      setStale(data.stale || []);
      setSuggestions(data.suggestions || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadQueue(); loadStats(); }, []);

  async function addToQueue(leadId: string, targetDate?: string, manualPriority?: number) {
    setAddError(null);
    const res = await fetch("/admin/api/lead-funnel/call-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, targetDate: targetDate || undefined, manualPriority: manualPriority ?? null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAddError(data.error || "Failed to add to queue");
      return;
    }
    await Promise.all([loadQueue(), loadStats()]);
  }

  async function handleAddSelected() {
    if (!addLead) return;
    const priority = addPriority.trim() ? Number(addPriority) : undefined;
    await addToQueue(addLead.id, addTargetDate, priority);
    setAddLead(null);
    setAddPriority("");
  }

  async function skip(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
    await fetch("/admin/api/lead-funnel/call-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "skipped" }),
    });
    loadStats();
  }

  async function remove(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
    await fetch("/admin/api/lead-funnel/call-queue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadStats();
  }

  async function handleLogged(rowId: string) {
    setLoggingRowId(null);
    setRows(prev => prev.filter(r => r.id !== rowId));
    await fetch("/admin/api/lead-funnel/call-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rowId, status: "done" }),
    });
    loadStats();
  }

  function dismissStale(id: string) {
    setStale(prev => prev.filter(s => s.id !== id));
  }

  function dismissSuggestion(leadId: string) {
    setSuggestions(prev => prev.filter(l => l.id !== leadId));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/lead-funnel/overview" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-2">
              <ArrowLeft size={12} /> Leads Overview
            </Link>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Call Queue</h1>
            <p className="text-sm text-slate-500 mt-1">Pre-loaded, ordered by urgency. Work top to bottom, log each outcome, move on.</p>
          </div>
          <button onClick={() => { loadQueue(); loadStats(); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-400">
            <RefreshCcw size={12} /> Quick Scan
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <Target size={16} className="text-purple-500" />
              {!editingTarget && (
                <button onClick={openEditTarget} className="text-slate-300 hover:text-slate-600"><Pencil size={12} /></button>
              )}
            </div>
            {editingTarget ? (
              <div className="mt-1.5 flex items-center gap-1">
                <input
                  autoFocus
                  type="number"
                  min={0}
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
                  className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-lg font-black outline-none focus:border-slate-400"
                />
                <button onClick={saveTarget} disabled={savingTarget} className="text-[10px] font-black uppercase text-white bg-slate-900 rounded-lg px-2 py-1.5 disabled:opacity-50">
                  {savingTarget ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            ) : (
              <div className="text-2xl font-black mt-1.5 text-slate-900">{statsLoading ? '—' : stats?.target ?? <button onClick={openEditTarget} className="text-sm font-bold text-purple-500 underline">Set target</button>}</div>
            )}
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Weekly Target</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <Inbox size={16} className="text-slate-400" />
            <div className="text-2xl font-black mt-1.5 text-slate-900">{statsLoading ? '—' : stats?.totalInQueue}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Total In Queue</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <Clock size={16} className="text-amber-500" />
            <div className="text-2xl font-black mt-1.5 text-slate-900">{statsLoading ? '—' : stats?.waitingToProcess}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Waiting To Process</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <div className="text-2xl font-black mt-1.5 text-slate-900">
              {statsLoading ? '—' : stats?.processedThisWeek}
              {stats?.target != null && <span className="text-sm font-bold text-slate-400"> / {stats.target}</span>}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Processed This Week</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Processed Per Day This Week</h3>
          <div className="grid grid-cols-5 gap-2">
            {DAY_LABELS.map(d => (
              <div key={d.key} className="bg-slate-50 rounded-xl p-2.5 text-center">
                <div className="text-lg font-black text-slate-900">{statsLoading ? '—' : stats?.processedByDay[d.key] ?? 0}</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-slate-400 mb-6">
          <Info size={12} className="shrink-0 mt-0.5" />
          These numbers are strictly outbound - contact attempts you logged while working this queue. They never include replying to an inbound message (that&apos;s tracked separately on Message Activity).
        </p>

        {(stale.length > 0 || suggestions.length > 0) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700 flex items-center gap-1.5"><AlertTriangle size={13} /> Quick Scan</p>
            {stale.map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs text-amber-800 bg-white/60 rounded-lg px-2.5 py-1.5">
                <span>{s.lead_name || "Lead"} — {s.reason}, may not need this call</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => remove(s.id)} className="font-black uppercase text-[10px] hover:underline">Remove</button>
                  <button onClick={() => dismissStale(s.id)} className="text-amber-400 hover:text-amber-600"><X size={12} /></button>
                </div>
              </div>
            ))}
            {suggestions.map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs text-amber-800 bg-white/60 rounded-lg px-2.5 py-1.5">
                <span>{l.name || l.phone} became urgent and isn&apos;t queued</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => addToQueue(l.id)} className="font-black uppercase text-[10px] hover:underline">Add to Queue</button>
                  <button onClick={() => dismissSuggestion(l.id)} className="text-amber-400 hover:text-amber-600"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Add to Queue</h3>
          <LeadPicker value={addLead} onChange={setAddLead} source="lead_funnel_call_queue" />
          {addLead && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Target Date</label>
                <input type="date" value={addTargetDate} onChange={e => setAddTargetDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Priority Override (optional)</label>
                <input value={addPriority} onChange={e => setAddPriority(e.target.value)} placeholder="Lower = higher priority" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400" />
              </div>
              <button onClick={handleAddSelected} className="col-span-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900">Add</button>
            </div>
          )}
          {addError && <div className="mt-2 bg-rose-50 border border-rose-200 text-rose-600 text-[11px] rounded-xl p-2.5">{addError}</div>}
        </div>

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Queue is empty. Add leads above to build tomorrow&apos;s list.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const urgency = urgencyLabel(row.lead);
              return (
                <div key={row.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-xs font-black text-slate-300 shrink-0">#{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{row.lead?.company_name || row.lead?.name || "(no name)"}</p>
                        <p className="text-[11px] text-slate-400">+{row.lead?.phone}{row.manual_priority != null ? <span className="inline-flex items-center gap-0.5 ml-2 text-indigo-500"><Pin size={9} /> Pinned</span> : null}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {urgency && <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${urgency.className}`}>{urgency.text}</span>}
                      <span className="text-[10px] text-slate-400">{new Date(row.target_date).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>

                  {loggingRowId === row.id ? (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <ContactLogForm lead={{ id: row.lead_id, lifecycle_stage: row.lead?.lifecycle_stage }} onLogged={() => handleLogged(row.id)} />
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                      <button onClick={() => setLoggingRowId(row.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900">
                        <Phone size={12} /> Log Outcome
                      </button>
                      <button onClick={() => skip(row.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-400">
                        <SkipForward size={12} /> Skip
                      </button>
                      <button onClick={() => remove(row.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-500">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
