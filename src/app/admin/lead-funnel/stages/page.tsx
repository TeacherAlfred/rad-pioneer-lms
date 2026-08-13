"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Search, Clock, MessageSquare, Users,
} from "lucide-react";
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS } from "@/lib/funnelStages";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";

type LeadStageRow = {
  id: string;
  name: string | null;
  phone: string;
  tags: string[];
  opted_out: boolean | null;
  status: string;
  stageStartedAt: string;
  daysInStage: number;
  messagesInStage: number;
};

type StageStat = {
  stage: string;
  count: number;
  avgDaysInStage: number;
  avgMessagesToAdvance: number | null;
  advancedCount: number;
};

const STAGE_COLORS: Record<string, string> = {
  new_lead: 'bg-slate-800',
  needs_human: 'bg-amber-500',
  contacted: 'bg-blue-500',
  followup_scheduled: 'bg-indigo-500',
  no_response: 'bg-rose-400',
  converted: 'bg-emerald-500',
  lost: 'bg-slate-300',
};

const INHOUSE_TAG = 'Inhouse';
function isInhouse(lead: LeadStageRow) {
  return (lead.tags || []).some(t => t.toLowerCase() === INHOUSE_TAG.toLowerCase());
}

export default function FunnelStagesPage() {
  const [stages, setStages] = useState<StageStat[]>([]);
  const [leads, setLeads] = useState<LeadStageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showInhouse, setShowInhouse] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/lead-funnel/stages');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load funnel stages');
      setStages(data.stages || []);
      setLeads(data.leads || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function changeStage(lead: LeadStageRow, status: string) {
    setSavingId(lead.id);
    try {
      await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, status }),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  const statsLeads = useMemo(() => leads.filter(l => !isInhouse(l)), [leads]);
  const inhouseCount = leads.length - statsLeads.length;
  const maxCount = Math.max(1, ...stages.map(s => s.count));

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = showInhouse ? leads : statsLeads;
    return source.filter(l => {
      if (stageFilter !== 'all' && l.status !== stageFilter) return false;
      if (q && !`${l.phone} ${l.name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, statsLeads, showInhouse, stageFilter, search]);

  // Longest-stuck-first by default - same intent as the old hardcoded sort,
  // now just the default state of the same sortColumn/sortDirection any
  // column header can be clicked to change.
  const [sortColumn, setSortColumn] = useState<string | null>('daysInStage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }
  const sortedLeads = useMemo(() => sortRows(filteredLeads, sortColumn, sortDirection), [filteredLeads, sortColumn, sortDirection]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(0); }, [stageFilter, search, showInhouse]);
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedLeads = useMemo(
    () => sortedLeads.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [sortedLeads, currentPage, pageSize]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Lead Funnel
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Funnel Stages</h1>
          <p className="text-sm text-slate-500 mt-1">Where every lead sits right now, how long they've been there, and how many messages it typically takes to move a stage forward.</p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Funnel</h3>
              <div className="space-y-3">
                {stages.map(s => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600 w-40 shrink-0">{FUNNEL_STAGE_LABELS[s.stage] || s.stage}</span>
                    <div className="flex-1 bg-slate-50 rounded-full h-5 overflow-hidden">
                      <div className={`${STAGE_COLORS[s.stage] || 'bg-slate-400'} h-full rounded-full flex items-center justify-end pr-2 transition-all`} style={{ width: `${(s.count / maxCount) * 100}%` }}>
                        {s.count > 0 && <span className="text-[10px] font-black text-white">{s.count}</span>}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 w-24 shrink-0 flex items-center gap-1"><Clock size={11} /> {s.count > 0 ? `${s.avgDaysInStage}d avg` : '—'}</span>
                    <span className="text-[11px] text-slate-400 w-32 shrink-0 flex items-center gap-1"><MessageSquare size={11} /> {s.avgMessagesToAdvance !== null ? `${s.avgMessagesToAdvance} msgs to advance` : 'no data yet'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  placeholder="Search phone or name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All stages</option>
                {FUNNEL_STAGES.map(s => <option key={s} value={s}>{FUNNEL_STAGE_LABELS[s]}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showInhouse} onChange={e => setShowInhouse(e.target.checked)} /> Show inhouse ({inhouseCount})
              </label>
              <span className="text-xs text-slate-400 ml-auto flex items-center gap-1"><Users size={12} /> {filteredLeads.length}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <SortableHeader label="Lead" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Stage" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Time in Stage" column="daysInStage" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Messages in Stage" column="messagesInStage" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLeads.map(l => (
                      <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{l.name || '(no name)'}</div>
                          <div className="text-xs text-slate-400">+{l.phone}</div>
                          {l.opted_out && <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">Opted out</span>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={l.status}
                            disabled={savingId === l.id}
                            onChange={e => changeStage(l, e.target.value)}
                            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none disabled:opacity-50"
                          >
                            {FUNNEL_STAGES.map(s => <option key={s} value={s}>{FUNNEL_STAGE_LABELS[s]}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{l.daysInStage}d</td>
                        <td className="px-4 py-3 text-slate-600">{l.messagesInStage}</td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-16 text-center text-slate-400 text-sm">No leads match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredLeads.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>
                      Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredLeads.length)} of {filteredLeads.length}
                    </span>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none"
                    >
                      {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-slate-400">Page {currentPage + 1} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
