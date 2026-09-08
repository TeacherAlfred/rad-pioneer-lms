"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Search, X, MessageSquare, Send, MessageCircle } from "lucide-react";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { parseMessage, KIND_LABEL, STATUS_DISPLAY } from "@/lib/messageParse";

type OutboxRow = {
  id: string;
  lead_id: string | null;
  direction: string;
  body: string;
  method: "waba" | "desktop";
  recipient_phone: string | null;
  wamid: string | null;
  status: string | null;
  status_updated_at: string | null;
  error_code: string | null;
  error_detail: string | null;
  created_at: string;
  lead_name: string | null;
  lead_phone: string | null;
};

const METHOD_LABEL: Record<string, string> = { waba: "WABA", desktop: "Desktop App" };

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MessagesOutboxPage() {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<"all" | "waba" | "desktop">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<OutboxRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/admin/api/lead-funnel/outbox");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load outbox");
        setRows(data.rows || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const parsedRows = useMemo(
    () => rows.map(r => ({ row: r, parsed: parseMessage(r) })),
    [rows]
  );

  const counts = useMemo(() => ({
    all: rows.length,
    waba: rows.filter(r => r.method === "waba").length,
    desktop: rows.filter(r => r.method === "desktop").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parsedRows.filter(({ row, parsed }) => {
      if (methodFilter !== "all" && row.method !== methodFilter) return false;
      if (statusFilter === "unconfirmed" && row.status) return false;
      if (statusFilter !== "all" && statusFilter !== "unconfirmed" && row.status !== statusFilter) return false;
      if (q) {
        const haystack = `${row.lead_name || ""} ${row.lead_phone || row.recipient_phone || ""} ${parsed.label}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [parsedRows, methodFilter, statusFilter, search]);

  const [sortColumn, setSortColumn] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  function handleSort(column: string) {
    if (sortColumn === column) setSortDirection(d => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  }
  const sortableRows = useMemo(
    () => filtered.map(({ row, parsed }) => ({ ...row, _title: parsed.label })),
    [filtered]
  );
  const sortedRows = useMemo(() => sortRows(sortableRows, sortColumn, sortDirection), [sortableRows, sortColumn, sortDirection]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(0); }, [methodFilter, statusFilter, search]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(() => sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize), [sortedRows, currentPage, pageSize]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Lead Funnel
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Messages Outbox</h1>
          <p className="text-sm text-slate-500 mt-1">Every outbound send attempt, WABA or desktop - including failed and unconfirmed ones, so a message that never arrived still leaves a record.</p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {(["all", "waba", "desktop"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMethodFilter(m)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${methodFilter === m ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400"}`}
                >
                  {m === "all" ? "All" : METHOD_LABEL[m]} ({counts[m]})
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  placeholder="Search lead, number, message..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All statuses</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
                <option value="unconfirmed">No confirmation</option>
              </select>
              <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {rows.length}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3">Lead</th>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Message</th>
                      <SortableHeader label="Date & Time" column="created_at" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map(row => {
                      const parsed = parseMessage(row);
                      const statusInfo = row.status ? STATUS_DISPLAY[row.status] : null;
                      return (
                        <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">{row.lead_name || "(no name)"}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">+{row.recipient_phone || row.lead_phone || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${row.method === "desktop" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                              {row.method === "desktop" ? <MessageCircle size={10} /> : <Send size={10} />}
                              {METHOD_LABEL[row.method]}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-sm">
                            <button onClick={() => setViewing(row)} className="text-left hover:underline text-slate-700 flex items-center gap-1.5">
                              <MessageSquare size={12} className="text-slate-300 shrink-0" />
                              <span className="line-clamp-1">{parsed.kind === "text" ? parsed.label : `${KIND_LABEL[parsed.kind] || parsed.kind} — ${parsed.label}`}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">
                            {row.method === "desktop" ? (
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">No confirmation</span>
                            ) : statusInfo ? (
                              <span className={`text-xs font-bold ${statusInfo.className}`} title={row.error_detail || undefined}>{statusInfo.icon} {statusInfo.label}</span>
                            ) : row.status === "failed" ? (
                              <span className="text-xs font-bold text-rose-500" title={row.error_detail || undefined}>⚠ Failed</span>
                            ) : (
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-sm">No outbound messages match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filtered.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
                    <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none">
                      {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40">Prev</button>
                    <span className="text-xs text-slate-400">Page {currentPage + 1} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {viewing && (() => {
        const parsed = parseMessage(viewing);
        const statusInfo = viewing.status ? STATUS_DISPLAY[viewing.status] : null;
        return (
          <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setViewing(null)}>
            <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between px-6 pt-6 pb-1 shrink-0">
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-900">{viewing.lead_name || "(no name)"}</h3>
                  <p className="text-[13px] text-slate-400 mt-0.5">+{viewing.recipient_phone || viewing.lead_phone} · {METHOD_LABEL[viewing.method]} · {fmtDateTime(viewing.created_at)}</p>
                </div>
                <button onClick={() => setViewing(null)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"><X size={13} /></button>
              </div>
              <div className="px-6 pt-4 pb-5 space-y-3 overflow-y-auto">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{KIND_LABEL[parsed.kind] || parsed.kind}</label>
                  <div className="bg-slate-50 rounded-xl px-3.5 py-3 text-[14px] text-slate-800 whitespace-pre-wrap">{viewing.body}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</label>
                  {viewing.method === "desktop" ? (
                    <span className="text-xs font-bold text-slate-400">No delivery confirmation possible (sent manually)</span>
                  ) : statusInfo ? (
                    <span className={`text-xs font-bold ${statusInfo.className}`}>{statusInfo.icon} {statusInfo.label}</span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">Pending / no status yet</span>
                  )}
                </div>
                {(viewing.error_code || viewing.error_detail) && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-500 mb-1">
                      {viewing.error_code ? `Meta error ${viewing.error_code}` : "Error"}
                    </p>
                    <p className="text-[13px] text-rose-700">{viewing.error_detail}</p>
                  </div>
                )}
              </div>
              <div className="shrink-0 border-t border-slate-100 px-6 py-4">
                <button onClick={() => setViewing(null)} className="w-full py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
