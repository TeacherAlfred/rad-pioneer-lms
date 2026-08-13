"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Send, CheckCircle2, XCircle, MousePointerClick,
  Users2, Search, MessageSquare,
} from "lucide-react";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";

type MessageRow = {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at?: string | null;
  lead_phone?: string | null;
  lead_name?: string | null;
  lead_tags?: string[] | null;
};

const INHOUSE_TAG = 'Inhouse';
function isInhouseRow(m: MessageRow) {
  return (m.lead_tags || []).some(t => t.toLowerCase() === INHOUSE_TAG.toLowerCase());
}

// Everything sent to a lead is logged into `messages` as bracketed text
// rather than structured columns (see whatsapp-webhook/route.ts) - this
// parses that back out into something a dashboard can group and count.
type Parsed =
  | { kind: 'template'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'bot_media'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'human_handoff'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'button_tap'; label: string; detail?: string }
  | { kind: 'text'; label: string };

function parseMessage(m: MessageRow): Parsed {
  const body = m.body || '';

  if (m.direction === 'outbound') {
    let match = body.match(/^\[Delivered template: (.+)\]$/);
    if (match) return { kind: 'template', status: 'delivered', label: match[1] };

    match = body.match(/^\[FAILED to deliver template (.+?): (.+)\]$/);
    if (match) return { kind: 'template', status: 'failed', label: match[1], detail: match[2] };

    if (body === '[Delivered human-handoff acknowledgment]') {
      return { kind: 'human_handoff', status: 'delivered', label: 'Human handoff acknowledgment' };
    }
    match = body.match(/^\[FAILED to deliver acknowledgment: (.+)\]$/);
    if (match) return { kind: 'human_handoff', status: 'failed', label: 'Human handoff acknowledgment', detail: match[1] };

    match = body.match(/^\[FAILED to deliver "(.+?)": (.+)\]$/);
    if (match) return { kind: 'bot_media', status: 'failed', label: match[1], detail: match[2] };

    match = body.match(/^\[Delivered (.+)\]$/);
    if (match) return { kind: 'bot_media', status: 'delivered', label: match[1] };

    return { kind: 'text', label: body };
  }

  const match = body.match(/^\[Button Reply: (.+) \((.+)\)\]$/);
  if (match) return { kind: 'button_tap', label: match[1], detail: match[2] };
  return { kind: 'text', label: body };
}

const KIND_LABEL: Record<string, string> = {
  template: 'Template Send',
  bot_media: 'Bot Media',
  human_handoff: 'Human Handoff',
  button_tap: 'Button Tap',
  text: 'Text',
};

export default function MessageActivityPage() {
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showInhouse, setShowInhouse] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/admin/api/lead-funnel/messages');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load messages');
        setRows(data.rows || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statsRows = useMemo(() => rows.filter(r => !isInhouseRow(r)), [rows]);
  const inhouseCount = rows.length - statsRows.length;

  const parsedStatsRows = useMemo(() => statsRows.map(r => ({ row: r, parsed: parseMessage(r) })), [statsRows]);

  const stats = useMemo(() => {
    const outbound = parsedStatsRows.filter(p => p.row.direction === 'outbound');
    const delivered = outbound.filter(p => 'status' in p.parsed && p.parsed.status === 'delivered').length;
    const failed = outbound.filter(p => 'status' in p.parsed && p.parsed.status === 'failed').length;
    const buttonTaps = parsedStatsRows.filter(p => p.parsed.kind === 'button_tap');
    const engagedLeads = new Set(buttonTaps.map(p => p.row.lead_id)).size;

    const messagedLeads = new Set(outbound.map(p => p.row.lead_id));
    const repliedLeads = new Set(
      parsedStatsRows.filter(p => p.row.direction === 'inbound' && messagedLeads.has(p.row.lead_id)).map(p => p.row.lead_id)
    );

    const byKind: Record<string, number> = {};
    const byTemplate: Record<string, number> = {};
    const byButton: Record<string, number> = {};

    for (const { row, parsed } of parsedStatsRows) {
      if (row.direction !== 'outbound') continue;
      byKind[KIND_LABEL[parsed.kind] || parsed.kind] = (byKind[KIND_LABEL[parsed.kind] || parsed.kind] || 0) + 1;
      if (parsed.kind === 'template') {
        byTemplate[parsed.label] = (byTemplate[parsed.label] || 0) + 1;
      }
    }
    for (const { row, parsed } of parsedStatsRows) {
      if (row.direction !== 'inbound' || parsed.kind !== 'button_tap') continue;
      byButton[parsed.label] = (byButton[parsed.label] || 0) + 1;
    }

    return {
      totalOutbound: outbound.length,
      delivered,
      failed,
      buttonTaps: buttonTaps.length,
      engagedLeads,
      replyRate: messagedLeads.size > 0 ? Math.round((repliedLeads.size / messagedLeads.size) * 100) : 0,
      byKind, byTemplate, byButton,
    };
  }, [parsedStatsRows]);

  // Parsed once here (kind/label/detail flattened onto the row) so sorting
  // can reference the derived "Type"/"Detail" columns, not just raw fields -
  // and the table below reuses this instead of re-parsing per render.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = showInhouse ? rows : statsRows;
    return source
      .filter(r => {
        if (directionFilter !== 'all' && r.direction !== directionFilter) return false;
        const parsed = parseMessage(r);
        if (kindFilter !== 'all' && parsed.kind !== kindFilter) return false;
        if (q) {
          const haystack = `${r.lead_phone || ''} ${r.lead_name || ''} ${r.body}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .map(r => {
        const parsed = parseMessage(r);
        return {
          ...r,
          _kind: KIND_LABEL[parsed.kind] || parsed.kind,
          _label: parsed.label,
          _detail: 'detail' in parsed ? parsed.detail : undefined,
          _ok: 'status' in parsed ? parsed.status === 'delivered' : true,
        };
      });
  }, [rows, statsRows, showInhouse, directionFilter, kindFilter, search]);

  const [sortColumn, setSortColumn] = useState<string | null>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }
  const sortedRows = useMemo(() => sortRows(filteredRows, sortColumn, sortDirection), [filteredRows, sortColumn, sortDirection]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(0); }, [directionFilter, kindFilter, search, showInhouse]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(
    () => sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [sortedRows, currentPage, pageSize]
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Message Activity</h1>
          <p className="text-sm text-slate-500 mt-1">Every outbound send and every button tap logged in `messages` - templates, bot media, human handoff, and engagement.</p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard icon={Send} label="Total Sent" value={stats.totalOutbound} />
              <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} accent="text-emerald-600" />
              <StatCard icon={XCircle} label="Failed" value={stats.failed} accent="text-rose-600" />
              <StatCard icon={MousePointerClick} label="Button Taps" value={stats.buttonTaps} accent="text-indigo-600" />
              <StatCard icon={Users2} label="Leads Engaged" value={stats.engagedLeads} accent="text-indigo-600" />
              <StatCard icon={MessageSquare} label="Reply Rate" value={stats.replyRate} suffix="%" accent="text-amber-600" />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <BreakdownCard title="Sends By Type" data={stats.byKind} />
              <BreakdownCard title="Button Taps (Engagement)" data={stats.byButton} />
            </div>

            {Object.keys(stats.byTemplate).length > 0 && (
              <div className="mb-6">
                <BreakdownCard title="Template Sends By Name" data={stats.byTemplate} />
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  placeholder="Search phone, name, message text..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All directions</option>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
              <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All types</option>
                {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showInhouse} onChange={e => setShowInhouse(e.target.checked)} /> Show inhouse ({inhouseCount})
              </label>
              <span className="text-xs text-slate-400 ml-auto">{filteredRows.length} of {showInhouse ? rows.length : statsRows.length}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <SortableHeader label="Lead" column="lead_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Direction" column="direction" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Type" column="_kind" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Detail" column="_label" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="When" column="created_at" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{r.lead_name || '(no name)'}</div>
                          <div className="text-xs text-slate-400">+{r.lead_phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${r.direction === 'outbound' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                            {r.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${r._ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {r._kind}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="line-clamp-2">{r._label}</span>
                          {r._detail && (
                            <div className="text-[11px] text-slate-400 mt-0.5">{r._detail}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-400 text-sm">No messages match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredRows.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>
                      Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredRows.length)} of {filteredRows.length}
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

function StatCard({ icon: Icon, label, value, accent, suffix }: { icon: any; label: string; value: number; accent?: string; suffix?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <Icon size={16} className={accent || 'text-slate-400'} />
      <div className={`text-2xl font-black mt-2 ${accent || 'text-slate-900'}`}>{value}{suffix || ''}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-40 shrink-0 truncate" title={key}>{key}</span>
            <div className="flex-1 bg-slate-50 rounded-full h-2 overflow-hidden">
              <div className="bg-slate-800 h-full rounded-full" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-xs font-black text-slate-500 w-8 text-right">{count}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-slate-400">No data yet.</p>}
      </div>
    </div>
  );
}
