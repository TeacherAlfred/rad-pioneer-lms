"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Users, LogIn, Clock, AlertTriangle, ShieldOff, Plus, Trash2 } from "lucide-react";

type StepSummary = {
  stepId: string;
  orderIndex: number;
  instructionPreview: string;
  avgSeconds: number | null;
  sampleCount: number;
  isOutlier: boolean;
};

type TutorialSummary = {
  tutorialId: string;
  title: string;
  slug: string;
  seriesTitle: string | null;
  seriesSlug: string | null;
  estimatedMinutes: number | null;
  totalEstimatedFromData: number | null;
  steps: StepSummary[];
};

type Summary = {
  days: number;
  hubLandings: number;
  seriesEntries: number;
  tutorials: TutorialSummary[];
  requesterIp: string | null;
  excludedIps: string[];
};

type ExcludedIpRow = { id: string; ip_address: string; note: string | null };

function fmtSeconds(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// Read-only summary view over the generic analytics_events log, scoped to
// the Tutorial Hub. Hub landings and series entries ride on the site-wide
// page_view event that already fires on every route change (no dedicated
// tracking needed); per-step average dwell time is the one piece that
// needed real instrumentation (src/app/tutorials/[seriesSlug]/[tutorialSlug]/page.tsx)
// - it's what tells you which steps are running long enough to need
// splitting, or short enough that a step could go deeper.
export default function TutorialAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [excludedRows, setExcludedRows] = useState<ExcludedIpRow[]>([]);
  const [newIp, setNewIp] = useState("");
  const [newIpNote, setNewIpNote] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/admin/api/tutorials/analytics?days=${days}`);
    const data = await res.json();
    setSummary(data);
    setLoading(false);
  }

  async function loadExcluded() {
    const res = await fetch('/admin/api/analytics/excluded-ips');
    const data = await res.json();
    setExcludedRows(data.rows || []);
  }

  useEffect(() => { load(); }, [days]);
  useEffect(() => { loadExcluded(); }, []);

  async function addExcludedIp(ip: string, note?: string) {
    if (!ip.trim()) return;
    const res = await fetch('/admin/api/analytics/excluded-ips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip_address: ip.trim(), note }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    setNewIp("");
    setNewIpNote("");
    await Promise.all([loadExcluded(), load()]);
  }

  async function removeExcludedIp(row: ExcludedIpRow) {
    await fetch('/admin/api/analytics/excluded-ips', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id }) });
    await Promise.all([loadExcluded(), load()]);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/admin/tutorials" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-4">
        <ArrowLeft size={14} /> Tutorial Hub
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-black text-slate-900 flex items-center gap-2"><Clock size={18} /> Tutorial Hub Analytics</h1>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="text-xs font-bold border border-slate-200 rounded-full px-3 py-1.5 bg-white">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="border border-slate-200 rounded-2xl bg-slate-50 p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-500">
            <ShieldOff size={14} /> Excluded IPs
          </div>
          {summary?.requesterIp && !summary.excludedIps.includes(summary.requesterIp) && (
            <button
              onClick={() => addExcludedIp(summary.requesterIp!, 'Added from Analytics page')}
              className="text-[11px] font-bold text-rad-blue"
            >
              Exclude my IP ({summary.requesterIp})
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mb-3">Traffic from these IPs is left out of every count and average below - and any other analytics that reads this same exclusion list, not just this page.</p>

        <div className="flex flex-col gap-1.5 mb-3">
          {excludedRows.map(row => (
            <div key={row.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-mono text-slate-700">{row.ip_address}</span>
              {row.note && <span className="text-[10px] text-slate-400 flex-1 truncate">{row.note}</span>}
              <button onClick={() => removeExcludedIp(row)} className="text-slate-400 hover:text-red-500 ml-auto shrink-0"><Trash2 size={13} /></button>
            </div>
          ))}
          {excludedRows.length === 0 && <p className="text-xs text-slate-400">None excluded yet.</p>}
        </div>

        <div className="flex gap-2">
          <input value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="IP address" className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white" />
          <input value={newIpNote} onChange={e => setNewIpNote(e.target.value)} placeholder="Note (optional)" className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white" />
          <button onClick={() => addExcludedIp(newIp, newIpNote)} className="shrink-0 bg-blue-600 text-white rounded-lg px-3 flex items-center gap-1 text-xs font-bold"><Plus size={13} /> Add</button>
        </div>
      </div>

      {loading || !summary ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="border border-slate-200 rounded-2xl bg-white p-4">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1"><Users size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Hub landings</span></div>
              <p className="text-2xl font-black text-slate-900">{summary.hubLandings}</p>
            </div>
            <div className="border border-slate-200 rounded-2xl bg-white p-4">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1"><LogIn size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Series entered</span></div>
              <p className="text-2xl font-black text-slate-900">{summary.seriesEntries}</p>
            </div>
          </div>

          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Time spent per tutorial</h2>
          <div className="flex flex-col gap-4">
            {summary.tutorials.map(t => (
              <div key={t.tutorialId} className="border border-slate-200 rounded-2xl bg-white p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.seriesTitle}</p>
                    <p className="text-sm font-black text-slate-900">{t.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated vs actual</p>
                    <p className="text-sm font-bold text-slate-700">
                      {t.estimatedMinutes ?? "—"}m <span className="text-slate-300">/</span> {t.totalEstimatedFromData ?? "—"}m
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {t.steps.map(s => (
                    <div key={s.stepId} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.isOutlier ? "bg-amber-50 border border-amber-200" : "bg-slate-50"}`}>
                      <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">{s.orderIndex + 1}</span>
                      <span className="text-xs text-slate-600 flex-1 truncate">{s.instructionPreview}</span>
                      {s.isOutlier && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                      <span className="text-xs font-bold text-slate-700 shrink-0">{fmtSeconds(s.avgSeconds)}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">({s.sampleCount})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {summary.tutorials.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-12">No step-timing data yet for this period.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
