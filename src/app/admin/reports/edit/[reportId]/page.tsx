"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, Check, CheckCheck, Eye, FileDown, History, Loader2, MessageCircle, PenLine, Plus, RefreshCw,
  RotateCcw, Send, Trash2, Undo2, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import ReportCard from "@/components/reports/ReportCard";
import HistoryDrawer from "@/components/reports/HistoryDrawer";
import SendLinksDialog from "@/components/reports/SendLinksDialog";
import { STATUS_LABEL, resetSection, sectionEdited } from "@/lib/reports/generate";
import { api, fmtDateTime, type ReportDetailResponse, type SendResult } from "@/lib/reports/client";
import { REPORT_V2_SECTIONS, SECTION_FIELDS, SECTION_LABELS, type AttendanceStatus, type ReportContent, type ReportSection } from "@/lib/reports/types";

const AUTOSAVE_MS = 3000;

const STATUS_CHIP: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700", in_review: "bg-violet-50 text-violet-700",
  published: "bg-emerald-50 text-emerald-700", sent: "bg-blue-50 text-blue-700",
};
const STATUS_NAME: Record<string, string> = { draft: "Draft", in_review: "In review", published: "Published", sent: "Sent" };

export default function ReportEditorPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [detail, setDetail] = useState<ReportDetailResponse | null>(null);
  const [content, setContent] = useState<ReportContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    try {
      const d = await api<ReportDetailResponse>(`/admin/api/reports/${reportId}`);
      setDetail(d);
      setContent(d.content);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave into the working buffer a few seconds after the last edit.
  useEffect(() => {
    if (!dirty || !content) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await api<{ savedAt: string }>(`/admin/api/reports/${reportId}`, { method: "PUT", json: { content } });
        setAutosavedAt(r.savedAt);
      } catch {
        // Next edit retries; explicit Save surfaces errors.
      }
    }, AUTOSAVE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [content, dirty, reportId]);

  function update(next: ReportContent) {
    setContent(next);
    setDirty(true);
  }
  function updateSection(id: string, fn: (s: ReportSection) => ReportSection) {
    if (!content) return;
    update({ ...content, sections: content.sections.map(s => (s.id === id ? fn(s) : s)) });
  }

  async function act(action: "save" | "submit" | "approve" | "regenerate", label: string) {
    setBusy(action);
    try {
      const json: Record<string, unknown> = { action, note };
      if (action !== "regenerate") json.content = content;
      await api(`/admin/api/reports/${reportId}`, { method: "POST", json });
      toast.success(label);
      setNote("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // A4 PDF of exactly what's in the editor, watermarked DRAFT. The route
  // autosaves the current content first, so the PDF matches the preview.
  async function downloadDraftPdf() {
    setBusy("draft_pdf");
    try {
      const res = await fetch(`/admin/api/reports/${reportId}/draft-pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Draft PDF failed");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "DRAFT-report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setAutosavedAt(new Date().toISOString());
      toast.success("Draft PDF downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sendBack() {
    setBusy("send_back");
    try {
      await api(`/admin/api/reports/${reportId}`, { method: "POST", json: { action: "send_back", comment } });
      toast.success("Sent back to the teacher");
      setSendBackOpen(false);
      setComment("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sendToParents() {
    setBusy("send");
    try {
      const { results } = await api<{ results: SendResult[] }>("/admin/api/reports/send", { method: "POST", json: { reportIds: [reportId] } });
      setSendResults(results);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function revokeLinks() {
    if (!confirm("Revoke every parent link for this report? Parents will see the expired page until you send a new link.")) return;
    try {
      await api(`/admin/api/reports/${reportId}`, { method: "POST", json: { action: "revoke_links" } });
      toast.success("Links revoked");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) return <div className="min-h-screen flex items-center justify-center text-rose-500 text-sm">{error}</div>;
  if (!detail || !content) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  const { report } = detail;
  const kidName = detail.enrolment?.kids?.name ?? content.learner.first_name;
  const sessionId = detail.enrolment?.session_id;
  const isLive = report.status === "published" || report.status === "sent";
  const correction = !!report.published_revision_id && !isLive;
  const strengths = content.sections.filter(s => s.type === "strength");
  const facilitator = content.sections.find(s => s.type === "facilitator_note");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-32">
      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-4">
        {sessionId && <Link href={`/admin/reports/${sessionId}`} className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 mb-1 w-fit"><ArrowLeft size={13} /> Roster</Link>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{kidName}</h1>
          <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${STATUS_CHIP[report.status]}`}>{STATUS_NAME[report.status]}</span>
          {correction && <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-800">Correction draft · parents still see the published version</span>}
          <span className="text-[12px] text-slate-400 ml-auto flex items-center gap-1">
            {dirty ? (autosavedAt ? <>Draft autosaved {fmtDateTime(autosavedAt)}</> : <>Unsaved changes</>) : <><Check size={12} /> Saved</>}
          </span>
          <button onClick={() => setHistoryOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-50">
            <History size={14} /> History ({detail.revisions.length})
          </button>
        </div>
        {report.review_comment && report.status === "draft" && (
          <p className="mt-2 text-[13px] text-amber-800 bg-amber-50 rounded-xl px-3 py-2 flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> Sent back: {report.review_comment}</p>
        )}
        <div className="lg:hidden mt-3 inline-flex rounded-full bg-slate-100 p-0.5">
          {(["edit", "preview"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`text-[13px] font-medium rounded-full px-4 py-1 inline-flex items-center gap-1.5 ${view === v ? "bg-white shadow-sm" : "text-slate-500"}`}>
              {v === "edit" ? <PenLine size={13} /> : <Eye size={13} />} {v === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
        <div className={`space-y-4 ${view === "preview" ? "hidden lg:block" : ""}`}>
          {/* Facts: read-only, fixed at the source */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Facts from the data</p>
              {sessionId && (
                <Link href={`/admin/reports/${sessionId}/capture#${report.enrolment_id}`} className="text-[12px] text-blue-600 inline-flex items-center gap-1 hover:underline"><Wrench size={12} /> Fix the data</Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {content.levels.map(l => (
                <span key={l.subject} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1">{l.subject_label}: <b>{l.level_label}</b></span>
              ))}
              <span className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1">{content.lessons_to_catch_up} lesson{content.lessons_to_catch_up === 1 ? "" : "s"} to catch up</span>
              <span className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1">{content.programme.line}</span>
            </div>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Status</span>
              <select
                value={content.status}
                onChange={e => update({ ...content, status: e.target.value as AttendanceStatus })}
                className="border border-slate-200 rounded-lg px-2 py-1 bg-white"
              >
                {(["on_track", "catch_up"] as const).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              {content.status !== content.status_computed && (
                <span className="text-[12px] text-amber-700">Overridden - attendance says “{STATUS_LABEL[content.status_computed]}”</span>
              )}
            </label>
            <p className="text-[12px] text-slate-400">Levels, lessons and the assessed rubric come from the capture screen and can&apos;t be typed here. Change the scores, then use Regenerate.</p>
          </section>

          <AnimatePresence initial={false}>
            {strengths.map((s, i) => (
              <SectionEditor
                key={s.id}
                section={s}
                heading={`Strength ${i + 1}`}
                onChange={fields => updateSection(s.id, x => ({ ...x, fields }))}
                onReset={() => updateSection(s.id, resetSection)}
                onRemove={strengths.length > 1 ? () => update({ ...content, sections: content.sections.filter(x => x.id !== s.id) }) : undefined}
              />
            ))}
          </AnimatePresence>
          {strengths.length < 3 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const custom: ReportSection = {
                  id: `strength:custom:${crypto.randomUUID().slice(0, 8)}`, type: "strength", template_key: null, template_version: null,
                  edited: true, fields: { title: "", body: "", bigger_picture: "" }, original: { title: "", body: "", bigger_picture: "" },
                };
                const idx = content.sections.findLastIndex(x => x.type === "strength");
                const sections = [...content.sections];
                sections.splice(idx + 1, 0, custom);
                update({ ...content, sections });
              }}
              className="w-full border border-dashed border-slate-300 rounded-2xl py-3 text-sm text-slate-500 hover:bg-white inline-flex items-center justify-center gap-1.5"
            >
              <Plus size={15} /> Add a strength
            </motion.button>
          )}

          {content.sections.filter(s => s.type !== "strength" && s.type !== "facilitator_note").map(s => (
            <SectionEditor key={s.id} section={s} heading={SECTION_LABELS[s.type]} onChange={fields => updateSection(s.id, x => ({ ...x, fields }))} onReset={() => updateSection(s.id, resetSection)} />
          ))}

          {facilitator && (
            <SectionEditor
              section={facilitator}
              heading="Facilitator note (optional)"
              nudge={!facilitator.fields.text?.trim() ? "Add one personal line about this child. Parents compare reports, and near-identical ones get noticed." : undefined}
              onChange={fields => updateSection(facilitator.id, x => ({ ...x, fields }))}
            />
          )}
        </div>

        <div className={`lg:sticky lg:top-4 ${view === "edit" ? "hidden lg:block" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Parent preview</p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={downloadDraftPdf}
              disabled={busy === "draft_pdf"}
              title="A4 PDF of this draft, watermarked DRAFT - not for sending"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "draft_pdf" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              {busy === "draft_pdf" ? "Rendering…" : "Draft PDF"}
            </motion.button>
          </div>
          <div className="mx-auto max-w-[400px] rounded-[28px] border-8 border-slate-900 bg-[#F3F5F4] overflow-y-auto lg:max-h-[calc(100vh-7rem)] p-3 shadow-xl">
            <ReportCard content={content} theme="light" />
          </div>
        </div>
      </div>

      {/* Workflow bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 md:pl-20 z-30">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Change note (optional)" className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded-full px-3 py-2 outline-none focus:border-slate-400" />
          <Btn icon={<RefreshCw size={15} />} label="Regenerate" busy={busy === "regenerate"} disabled={!!busy}
            onClick={() => confirm("Rebuild the wording from the current scores and templates? Your edits stay in history; the facilitator note is kept.") && act("regenerate", "Regenerated as a new revision")} />
          <Btn icon={<Check size={15} />} label="Save" busy={busy === "save"} disabled={!!busy} onClick={() => act("save", "Saved as a new revision")} />
          {report.status === "draft" && (
            <Btn icon={<Send size={15} />} label="Submit for review" busy={busy === "submit"} disabled={!!busy} onClick={() => act("submit", "Submitted for review")} />
          )}
          {report.status === "in_review" && (
            <Btn icon={<Undo2 size={15} />} label="Send back" busy={busy === "send_back"} disabled={!!busy} onClick={() => setSendBackOpen(true)} />
          )}
          {(report.status === "draft" || report.status === "in_review" || dirty) && (
            <Btn icon={<CheckCheck size={15} />} label={report.published_revision_id ? "Publish correction" : "Approve & publish"} busy={busy === "approve"} disabled={!!busy} primary
              onClick={() => act("approve", report.published_revision_id ? "Correction published - parent links now show it" : "Published")} />
          )}
          {isLive && !dirty && (
            <Btn icon={<MessageCircle size={15} />} label={report.status === "sent" ? "Send again" : "Send to parents"} busy={busy === "send"} disabled={!!busy} primary onClick={sendToParents} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {sendBackOpen && (
          <motion.div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSendBackOpen(false)}>
            <motion.div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3" initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }} onClick={e => e.stopPropagation()}>
              <h2 className="font-semibold">Send back with a comment</h2>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} autoFocus placeholder="What should change?" className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setSendBackOpen(false)} className="text-sm px-3 py-2 rounded-full hover:bg-slate-100">Cancel</button>
                <Btn icon={<Undo2 size={15} />} label="Send back" busy={busy === "send_back"} disabled={!comment.trim() || !!busy} onClick={sendBack} primary />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        revisions={detail.revisions}
        events={detail.events}
        links={detail.links}
        publishedId={report.published_revision_id}
        onRevokeLinks={revokeLinks}
      />
      <SendLinksDialog results={sendResults} names={{ [reportId]: kidName }} onClose={() => setSendResults(null)} />
    </div>
  );
}

function SectionEditor({ section, heading, onChange, onReset, onRemove, nudge }: {
  section: ReportSection; heading: string; onChange: (fields: Record<string, string>) => void;
  onReset?: () => void; onRemove?: () => void; nudge?: string;
}) {
  const edited = sectionEdited(section);
  return (
    <motion.section layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-[15px]">{heading}</h2>
        {section.template_key && <code className="text-[11px] text-slate-400 bg-slate-50 rounded px-1.5 py-0.5">{section.template_key} v{section.template_version}</code>}
        <AnimatePresence>
          {edited && section.template_key && (
            <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">Edited</motion.span>
          )}
        </AnimatePresence>
        <span className="ml-auto flex gap-1">
          {onReset && edited && section.template_key && (
            <button onClick={onReset} className="text-[12px] text-slate-500 inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-slate-100"><RotateCcw size={12} /> Reset to template</button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="text-[12px] text-rose-600 inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-rose-50"><Trash2 size={12} /> Remove</button>
          )}
        </span>
      </div>
      {nudge && <p className="text-[12px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2">{nudge}</p>}
      {SECTION_FIELDS[section.type].map(f => {
        const value = section.fields[f.key] ?? "";
        const over = value.length > f.limit;
        return (
          <label key={f.key} className="block">
            <span className="flex justify-between text-[12px] text-slate-500 mb-1">
              <span>{f.label}{f.key === "home" && !REPORT_V2_SECTIONS ? " · saved, not shown to parents until v2" : ""}</span>
              <span className={`tabular-nums ${over ? "text-amber-600 font-semibold" : "text-slate-400"}`}>{value.length}/{f.limit}</span>
            </span>
            <textarea
              value={value}
              onChange={e => onChange({ ...section.fields, [f.key]: e.target.value })}
              rows={f.key === "title" ? 1 : Math.min(8, Math.max(2, Math.ceil(f.limit / 90)))}
              className={`w-full text-sm rounded-xl border px-3 py-2 outline-none resize-y ${over ? "border-amber-300 focus:border-amber-500" : "border-slate-200 focus:border-slate-400"}`}
            />
          </label>
        );
      })}
    </motion.section>
  );
}

function Btn({ icon, label, onClick, busy, disabled, primary }: {
  icon: React.ReactNode; label: string; onClick: () => void; busy: boolean; disabled: boolean; primary?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-3.5 py-2 disabled:opacity-50 ${primary ? "bg-slate-900 text-white hover:bg-slate-700" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : icon} {label}
    </motion.button>
  );
}
