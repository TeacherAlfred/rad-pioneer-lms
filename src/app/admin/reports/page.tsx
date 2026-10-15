"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, ClipboardCheck, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { api, fmtDate, type RunSummary } from "@/lib/reports/client";

type Run = RunSummary & { learner_count: number; report_count: number };

export default function ReportRunsPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ runs: Run[] }>("/admin/api/reports/runs").then(d => setRuns(d.runs)).catch(e => setError((e as Error).message));
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = (runs ?? []).filter(r =>
    !needle || [r.programme?.name, r.programme?.code, r.venue_label].some(x => x?.toLowerCase().includes(needle)));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-100 px-6 py-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><ClipboardCheck size={20} className="text-rad-purple" /> Report Cards</h1>
          <p className="text-[13px] text-slate-400 mt-1">Pick a programme run to capture scores, generate drafts, review and send to parents.</p>
        </div>
        <Link href="/admin/reports/templates" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50">
          <SlidersHorizontal size={14} /> Templates &amp; rubrics
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <Search size={15} className="text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search programme or venue" className="flex-1 bg-transparent outline-none text-sm" />
        </label>

        {error && <p className="text-sm text-rose-500">{error}</p>}
        {!runs && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>}
        {runs && shown.length === 0 && <p className="text-sm text-slate-400 text-center py-12">No programme runs with enrolled learners yet.</p>}

        <ul className="space-y-2">
          {shown.map((r, i) => (
            <motion.li key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}>
              <Link href={`/admin/reports/${r.id}`} className="group flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 hover:border-slate-200 hover:shadow transition">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.programme?.name ?? "Untitled programme"}</p>
                  <p className="text-[12px] text-slate-400 truncate">
                    {r.programme?.code} · {fmtDate(r.starts_at)}{r.venue_label ? ` · ${r.venue_label}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{r.report_count}/{r.learner_count}</p>
                  <p className="text-[11px] text-slate-400">reports</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition" />
              </Link>
            </motion.li>
          ))}
        </ul>
      </main>
    </div>
  );
}
