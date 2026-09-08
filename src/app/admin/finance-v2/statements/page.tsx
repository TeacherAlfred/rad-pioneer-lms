"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Loader2, ScrollText, ExternalLink, ClipboardList } from "lucide-react";

type OwingRow = {
  lead: { id: string; name: string | null; phone: string | null; email: string | null; company_name: string | null };
  outstanding: number;
  invoiceCount: number;
  oldestDue: string | null;
};

export default function StatementsOwingPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OwingRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/admin/api/finance-v2/statements/owing");
        const { owing } = await res.json();
        setRows(owing || []);
      } catch (err) {
        console.error("Failed to fetch leads owing:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.lead.name, r.lead.company_name, r.lead.phone, r.lead.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const totalOwing = useMemo(() => rows.reduce((s, r) => s + r.outstanding, 0), [rows]);
  const rand = (n: number) => `R ${Math.round(n).toLocaleString()}`;

  function daysOverdue(oldestDue: string | null) {
    if (!oldestDue) return null;
    const days = Math.floor((Date.now() - new Date(oldestDue).getTime()) / 86400000);
    return days;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <Link href="/admin/dashboard-v2/money-admin" className="text-[10px] font-black uppercase text-slate-500 hover:text-rose-600 flex items-center gap-2 transition-colors mb-4">
            <ArrowLeft size={14} /> Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase leading-none">
            Statements <span className="text-rose-600 text-xl align-top">v2</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Every lead with an outstanding balance — pick one to open their statement and send it on.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 flex items-start justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Owing</p>
              <p className="text-2xl font-black tracking-tight mt-1">{rand(totalOwing)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Across {rows.length} lead{rows.length === 1 ? "" : "s"}</p>
            </div>
            <ScrollText className="text-rose-500" size={20} />
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, company, phone..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-rose-400"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-rose-500" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400 text-sm">
            {rows.length === 0 ? "No leads currently owe anything." : "No leads match this search."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const overdue = daysOverdue(r.oldestDue);
              const clientName = r.lead.company_name || r.lead.name || "Unknown";
              return (
                <div
                  key={r.lead.id}
                  className="bg-white border border-slate-200 hover:border-rose-300 rounded-[20px] p-5 flex flex-col md:flex-row md:items-center gap-4 shadow-sm transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate text-slate-800">{clientName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{r.lead.phone || r.lead.email || "No contact"}</p>
                  </div>
                  <div className="flex items-center gap-6 md:gap-8">
                    <div className="text-right">
                      <p className="font-black text-lg tracking-tight text-rose-600">{rand(r.outstanding)}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">
                        {r.invoiceCount} invoice{r.invoiceCount === 1 ? "" : "s"}
                        {overdue !== null && overdue > 0 ? ` · ${overdue}d overdue` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/finance-v2/statements-detail?lead_id=${r.lead.id}`}
                        title="View detailed invoice & payment history"
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all"
                      >
                        <ClipboardList size={14} />
                      </Link>
                      <Link
                        href={`/statement-v2/${r.lead.id}`}
                        target="_blank"
                        title="View public statement"
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
