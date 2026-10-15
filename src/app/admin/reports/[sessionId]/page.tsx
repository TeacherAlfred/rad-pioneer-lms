"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCheck, ClipboardList, Loader2, MessageCircle, PenLine, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import SendLinksDialog from "@/components/reports/SendLinksDialog";
import {
  STATE_LABEL, STATE_STYLE, api, fmtDate, type RosterLearner, type RunResponse, type SendResult,
} from "@/lib/reports/client";
import type { RosterState } from "@/lib/reports/types";

const FILTERS: (RosterState | "all")[] = ["all", "no_data", "not_started", "draft", "in_review", "published", "sent", "viewed"];
const SENDABLE: RosterState[] = ["published", "sent", "viewed"];

export default function ReportRosterPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [data, setData] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RosterState | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);

  async function load() {
    try {
      setData(await api<RunResponse>(`/admin/api/reports/run?sessionId=${sessionId}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const roster = data?.roster ?? [];
  const totalAreas = (data?.rubrics ?? []).reduce((n, r) => n + r.areas.length, 0);
  const counts = Object.fromEntries(FILTERS.map(f => [f, f === "all" ? roster.length : roster.filter(l => l.state === f).length]));
  const shown = filter === "all" ? roster : roster.filter(l => l.state === filter);
  const picked = roster.filter(l => selected.has(l.enrolment_id));

  function setStates(ids: string[], state: RosterState) {
    setData(d => d && { ...d, roster: d.roster.map(l => (ids.includes(l.enrolment_id) ? { ...l, state } : l)) });
  }

  async function generate(learners: RosterLearner[]) {
    const ids = learners.filter(l => l.scored_count > 0 && !l.report).map(l => l.enrolment_id);
    if (!ids.length) { toast.info("Everyone selected already has a report or is still awaiting scores."); return; }
    setBusy("generate");
    setStates(ids, "draft");
    try {
      const { results } = await api<{ results: { enrolmentId: string; error?: string }[] }>("/admin/api/reports/generate", { method: "POST", json: { enrolmentIds: ids } });
      const failed = results.filter(r => r.error);
      const ok = results.length - failed.length;
      if (ok) toast.success(`${ok} draft${ok === 1 ? "" : "s"} generated`);
      failed.forEach(f => toast.error(`${roster.find(l => l.enrolment_id === f.enrolmentId)?.first_name}: ${f.error}`));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      load();
    }
  }

  async function approve(learners: RosterLearner[]) {
    const targets = learners.filter(l => l.report && (l.state === "draft" || l.state === "in_review" || l.has_unpublished_changes));
    if (!targets.length) { toast.info("Select drafts or reports in review to approve."); return; }
    setBusy("approve");
    setStates(targets.map(t => t.enrolment_id), "published");
    let ok = 0;
    for (const t of targets) {
      try {
        await api(`/admin/api/reports/${t.report!.id}`, { method: "POST", json: { action: "approve" } });
        ok++;
      } catch (e) {
        toast.error(`${t.first_name}: ${(e as Error).message}`);
      }
    }
    if (ok) toast.success(`${ok} report${ok === 1 ? "" : "s"} published`);
    setBusy(null);
    load();
  }

  async function send(learners: RosterLearner[]) {
    const targets = learners.filter(l => l.report?.published_revision_id && SENDABLE.includes(l.state));
    if (!targets.length) { toast.info("Select published reports to send."); return; }
    setBusy("send");
    try {
      const { results } = await api<{ results: SendResult[] }>("/admin/api/reports/send", { method: "POST", json: { reportIds: targets.map(t => t.report!.id) } });
      setSendResults(results);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  if (error) return <div className="min-h-screen flex items-center justify-center text-rose-500 text-sm">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  const scope = picked.length ? picked : shown;
  const names = Object.fromEntries(roster.filter(l => l.report).map(l => [l.report!.id, l.name]));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-5">
        <Link href="/admin/reports" className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 mb-2 w-fit"><ArrowLeft size={13} /> All runs</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{data.run.programme?.name ?? "Programme"}</h1>
            <p className="text-[13px] text-slate-400 mt-1">
              {data.run.programme?.code} · {fmtDate(data.run.starts_at)}{data.run.venue_label ? ` · ${data.run.venue_label}` : ""} · {roster.length} learners
            </p>
          </div>
          <Link href={`/admin/reports/${sessionId}/capture`} className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-slate-900 rounded-full px-4 py-2 hover:bg-slate-700">
            <ClipboardList size={15} /> Capture scores &amp; attendance
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 text-[12px] font-medium rounded-full px-3 py-1.5 border transition ${filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {f === "all" ? "All" : STATE_LABEL[f]} <span className="opacity-60 tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
          <label className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-slate-400">
            <input
              type="checkbox"
              checked={shown.length > 0 && shown.every(l => selected.has(l.enrolment_id))}
              onChange={e => setSelected(e.target.checked ? new Set(shown.map(l => l.enrolment_id)) : new Set())}
              className="accent-slate-900"
            />
            {picked.length ? `${picked.length} selected` : "Select all"}
          </label>
          {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-400">Nobody in this state.</p>}
          {shown.map(l => (
            <div key={l.enrolment_id} className="flex items-center gap-3 px-4 py-3">
              <input type="checkbox" checked={selected.has(l.enrolment_id)} onChange={() => toggle(l.enrolment_id)} className="accent-slate-900" aria-label={`Select ${l.name}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{l.name}</p>
                <p className="text-[12px] text-slate-400 truncate">
                  {l.scored_count}/{totalAreas} areas scored · {l.lessons_to_catch_up} lesson{l.lessons_to_catch_up === 1 ? "" : "s"} to catch up
                  {l.viewed_at ? ` · opened ${fmtDate(l.viewed_at)}` : ""}
                </p>
                {l.report?.review_comment && l.state === "draft" && (
                  <p className="text-[12px] text-amber-700 flex items-center gap-1 mt-0.5"><AlertTriangle size={12} /> Sent back: {l.report.review_comment}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <motion.span layout key={l.state} initial={{ scale: 0.85 }} animate={{ scale: 1 }} className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${STATE_STYLE[l.state]}`}>
                  {STATE_LABEL[l.state]}
                </motion.span>
                {l.has_unpublished_changes && <span className="text-[10px] text-amber-600">correction pending</span>}
              </div>
              {l.report ? (
                <button onClick={() => router.push(`/admin/reports/edit/${l.report!.id}`)} className="shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Open ${l.name}'s report`}><PenLine size={16} /></button>
              ) : l.scored_count > 0 ? (
                <button onClick={() => generate([l])} disabled={!!busy} className="shrink-0 p-2 rounded-lg text-sky-600 hover:bg-sky-50" aria-label={`Generate ${l.name}'s draft`}><Sparkles size={16} /></button>
              ) : (
                <Link href={`/admin/reports/${sessionId}/capture#${l.enrolment_id}`} className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label={`Capture ${l.name}'s scores`}><ClipboardList size={16} /></Link>
              )}
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 md:pl-20">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-2 items-center">
          <span className="text-[12px] text-slate-400 mr-auto">{picked.length ? `${picked.length} selected` : `Applies to ${shown.length} shown`}</span>
          <BulkButton icon={<Sparkles size={15} />} label="Generate drafts" busy={busy === "generate"} disabled={!!busy} onClick={() => generate(scope)} />
          <BulkButton icon={<CheckCheck size={15} />} label="Approve" busy={busy === "approve"} disabled={!!busy} onClick={() => approve(scope)} />
          <BulkButton icon={<MessageCircle size={15} />} label="WhatsApp messages" busy={busy === "send"} disabled={!!busy} onClick={() => send(scope)} primary />
        </div>
      </div>

      <SendLinksDialog results={sendResults} names={names} onClose={() => setSendResults(null)} />
    </div>
  );
}

function BulkButton({ icon, label, onClick, busy, disabled, primary }: {
  icon: React.ReactNode; label: string; onClick: () => void; busy: boolean; disabled: boolean; primary?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-3.5 py-2 disabled:opacity-50 ${primary ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : icon} {label}
    </motion.button>
  );
}
