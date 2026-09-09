"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Search, X, MessageSquare, Send, MessageCircle, ChevronDown, ChevronRight, LayoutList, Users } from "lucide-react";
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
  meta_message_status: string | null;
  created_at: string;
  lead_name: string | null;
  lead_phone: string | null;
};

type LeadGroup = {
  key: string;
  leadName: string | null;
  leadPhone: string | null;
  rows: OutboxRow[];
};

const METHOD_LABEL: Record<string, string> = { waba: "WABA", desktop: "Desktop App", admin: "Sent to Admin" };

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Shared row renderer for both the flat list and the grouped-by-lead view -
// in the grouped view the lead/number is already shown once in the group's
// header row, so those two columns collapse into a single blank spacer cell
// (colSpan) instead of repeating the same name/phone on every message.
function OutboxRowCells({ row, showLeadNumber, onView }: { row: OutboxRow; showLeadNumber: boolean; onView: (row: OutboxRow) => void }) {
  const parsed = parseMessage(row);
  const statusInfo = row.status ? STATUS_DISPLAY[row.status] : null;
  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
      {showLeadNumber ? (
        <>
          <td className="px-4 py-3">
            <div className="font-bold text-slate-800">{row.lead_name || "(no name)"}</div>
          </td>
          <td className="px-4 py-3 text-slate-500">+{row.recipient_phone || row.lead_phone || "—"}</td>
        </>
      ) : (
        <td className="px-4 py-3" colSpan={2} />
      )}
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${row.method === "desktop" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
            {row.method === "desktop" ? <MessageCircle size={10} /> : <Send size={10} />}
            {METHOD_LABEL[row.method]}
          </span>
          {parsed.kind === "admin_alert" && (
            <span title="Sent to the admin's own number, about this lead" className="inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-600">
              → Admin
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 max-w-sm">
        <button onClick={() => onView(row)} className="text-left hover:underline text-slate-700 flex items-center gap-1.5">
          <MessageSquare size={12} className="text-slate-300 shrink-0" />
          <span className="line-clamp-1">{parsed.kind === "text" ? parsed.label : `${KIND_LABEL[parsed.kind] || parsed.kind} — ${parsed.label}`}</span>
        </button>
      </td>
      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDateTime(row.created_at)}</td>
      <td className="px-4 py-3">
        {row.method === "desktop" ? (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">No confirmation</span>
        ) : row.meta_message_status && row.meta_message_status !== "accepted" ? (
          // Meta's own signal that an "accepted" send is NOT actually
          // proceeding to delivery - see sendMetaTemplate/sendWhatsAppMessage
          // in metaTemplate.ts. Shown ahead of a normal status/Pending read
          // since it overrides both.
          <span className="text-xs font-bold text-amber-600" title="Meta accepted the send but is holding or has paused delivery - not the same as delivered">
            ⚠ {row.meta_message_status.replace(/_/g, ' ')}
          </span>
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
}

export default function MessagesOutboxPage() {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 'admin' cuts across method - it's "who this actually went to" (the
  // admin's own number, for a pipeline/registration alert about a lead),
  // not a delivery channel, so it sits alongside waba/desktop as a fourth
  // tab rather than a value nested under either of them. Admin-alert rows
  // are excluded from all/waba/desktop and ONLY ever surface under this tab.
  const [methodFilter, setMethodFilter] = useState<"all" | "waba" | "desktop" | "admin">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<OutboxRow | null>(null);
  // Grouped-by-lead is offered on All/WABA/Desktop (see isGroupedView below) -
  // the Admin tab stays a flat list since every row there already went to
  // the same one admin number, so grouping by lead wouldn't organize anything.
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  const counts = useMemo(() => {
    const nonAdmin = parsedRows.filter(({ parsed }) => parsed.kind !== "admin_alert");
    return {
      all: nonAdmin.length,
      waba: nonAdmin.filter(({ row }) => row.method === "waba").length,
      desktop: nonAdmin.filter(({ row }) => row.method === "desktop").length,
      admin: parsedRows.length - nonAdmin.length,
    };
  }, [parsedRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parsedRows.filter(({ row, parsed }) => {
      if (methodFilter === "admin") {
        if (parsed.kind !== "admin_alert") return false;
      } else {
        if (parsed.kind === "admin_alert") return false;
        if (methodFilter !== "all" && row.method !== methodFilter) return false;
      }
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

  const isGroupedView = viewMode === "grouped" && methodFilter !== "admin";

  const groups = useMemo<LeadGroup[]>(() => {
    if (!isGroupedView) return [];
    const map = new Map<string, LeadGroup>();
    for (const row of sortedRows) {
      const key = row.lead_id || `phone:${row.recipient_phone || row.lead_phone || row.id}`;
      let g = map.get(key);
      if (!g) {
        g = { key, leadName: row.lead_name, leadPhone: row.lead_phone || row.recipient_phone, rows: [] };
        map.set(key, g);
      }
      g.rows.push(row);
    }
    // sortedRows is already ordered by the active sort, so each group's
    // first row reflects that order - reuse it to order the groups too.
    return Array.from(map.values());
  }, [sortedRows, isGroupedView]);

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(0); }, [methodFilter, statusFilter, search, viewMode]);
  const totalItems = isGroupedView ? groups.length : sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(() => sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize), [sortedRows, currentPage, pageSize]);
  const pagedGroups = useMemo(() => groups.slice(currentPage * pageSize, currentPage * pageSize + pageSize), [groups, currentPage, pageSize]);

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
              {(["all", "waba", "desktop", "admin"] as const).map(m => (
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
              {methodFilter !== "admin" && (
                <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <LayoutList size={12} /> List
                  </button>
                  <button
                    onClick={() => setViewMode("grouped")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${viewMode === "grouped" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <Users size={12} /> Grouped by Lead
                  </button>
                </div>
              )}
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
                      {isGroupedView ? (
                        <th className="px-4 py-3" colSpan={2}>Lead</th>
                      ) : (
                        <>
                          <th className="px-4 py-3">Lead</th>
                          <th className="px-4 py-3">Number</th>
                        </>
                      )}
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Message</th>
                      <SortableHeader label="Date & Time" column="created_at" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isGroupedView ? (
                      <>
                        {pagedGroups.map(group => (
                          <Fragment key={group.key}>
                            <tr className="bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer" onClick={() => toggleGroup(group.key)}>
                              <td colSpan={6} className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {collapsedGroups.has(group.key) ? <ChevronRight size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                                  <span className="font-bold text-slate-800">{group.leadName || "(no name)"}</span>
                                  <span className="text-slate-400 text-xs">+{group.leadPhone || "—"}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 ml-auto">
                                    {group.rows.length} message{group.rows.length === 1 ? "" : "s"}
                                  </span>
                                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDateTime(group.rows[0].created_at)}</span>
                                </div>
                              </td>
                            </tr>
                            {!collapsedGroups.has(group.key) && group.rows.map(row => (
                              <OutboxRowCells key={row.id} row={row} showLeadNumber={false} onView={setViewing} />
                            ))}
                          </Fragment>
                        ))}
                        {groups.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-sm">No outbound messages match these filters.</td></tr>
                        )}
                      </>
                    ) : (
                      <>
                        {pagedRows.map(row => (
                          <OutboxRowCells key={row.id} row={row} showLeadNumber onView={setViewing} />
                        ))}
                        {filtered.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-sm">No outbound messages match these filters.</td></tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              {totalItems > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems}{isGroupedView ? (totalItems === 1 ? " lead" : " leads") : ""}</span>
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
                  ) : viewing.meta_message_status && viewing.meta_message_status !== "accepted" ? (
                    <span className="text-xs font-bold text-amber-600">⚠ Meta: {viewing.meta_message_status.replace(/_/g, ' ')} - accepted by the API but not confirmed as proceeding to delivery</span>
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
