"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, Link2Off, X } from "lucide-react";
import { diffContent } from "@/lib/reports/diff";
import { fmtDateTime, type ReportEvent, type ReportLinkRow } from "@/lib/reports/client";
import type { ReportRevision } from "@/lib/reports/types";

const EVENT_LABEL: Record<string, string> = {
  generated: "Draft generated", edited: "Saved", submitted: "Submitted for review", sent_back: "Sent back",
  published: "Published", sent: "Links sent", viewed: "Opened by parent", downloaded: "PDF downloaded",
  cta_clicked: "Tapped WhatsApp reply", link_failed: "Expired / invalid link used", links_revoked: "Links revoked",
};

export default function HistoryDrawer({
  open, onClose, revisions, events, links, publishedId, onRevokeLinks,
}: {
  open: boolean; onClose: () => void; revisions: ReportRevision[]; events: ReportEvent[]; links: ReportLinkRow[];
  publishedId: string | null; onRevokeLinks: () => void;
}) {
  const [tab, setTab] = useState<"revisions" | "activity">("revisions");
  const [pair, setPair] = useState<[string | null, string | null]>([null, null]);

  // Default comparison: the latest revision against the one before it.
  const newer = revisions.find(r => r.id === pair[1]) ?? revisions[0];
  const older = revisions.find(r => r.id === pair[0]) ?? revisions.find(r => r.revision_no < (newer?.revision_no ?? 0));
  const diffs = newer && older ? diffContent(older.content, newer.content) : [];
  const activeLinks = links.filter(l => !l.revoked_at && new Date(l.expires_at) > new Date());

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-slate-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.aside
            className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl overflow-y-auto text-slate-900"
            initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-3">
              <History size={18} className="text-slate-400" />
              <h2 className="font-semibold mr-auto">History</h2>
              {(["revisions", "activity"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`text-[12px] font-medium rounded-full px-3 py-1 ${tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {t === "revisions" ? "Revisions" : "Activity"}
                </button>
              ))}
              <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            </div>

            {tab === "revisions" ? (
              <div className="p-5 space-y-5">
                <ul className="space-y-1.5">
                  {revisions.map(r => {
                    const isNew = r.id === newer?.id, isOld = r.id === older?.id;
                    return (
                      <li key={r.id} className={`rounded-xl border px-3 py-2 ${isNew ? "border-blue-300 bg-blue-50/50" : isOld ? "border-slate-300 bg-slate-50" : "border-slate-100"}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">#{r.revision_no}</span>
                          {r.id === publishedId && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Live</span>}
                          {r.published_at && r.id !== publishedId && <span className="text-[10px] uppercase tracking-wide text-slate-400">was published</span>}
                          <span className="ml-auto flex gap-1">
                            <button onClick={() => setPair([r.id, pair[1]])} className={`text-[11px] rounded px-1.5 py-0.5 ${isOld ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>A</button>
                            <button onClick={() => setPair([pair[0], r.id])} className={`text-[11px] rounded px-1.5 py-0.5 ${isNew ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>B</button>
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500">{r.created_by ?? "system"} · {fmtDateTime(r.created_at)}</p>
                        {r.change_note && <p className="text-[12px] text-slate-600 mt-0.5">“{r.change_note}”</p>}
                      </li>
                    );
                  })}
                </ul>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    {older && newer ? `Changes from #${older.revision_no} to #${newer.revision_no}` : "Only one revision so far"}
                  </p>
                  {older && newer && diffs.length === 0 && <p className="text-sm text-slate-400">No wording differences.</p>}
                  <div className="space-y-3">
                    {diffs.map((d, i) => (
                      <div key={i} className="text-sm">
                        <p className="text-[12px] font-medium text-slate-500">{d.sectionLabel} · {d.fieldLabel}</p>
                        <p className="leading-relaxed">
                          {d.parts.map((p, j) => (
                            <span key={j} className={p.kind === "add" ? "bg-emerald-100 text-emerald-900" : p.kind === "del" ? "bg-rose-100 text-rose-800 line-through" : ""}>{p.text}</span>
                          ))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Parent links</p>
                    {activeLinks.length > 0 && (
                      <button onClick={onRevokeLinks} className="text-[12px] text-rose-600 inline-flex items-center gap-1 hover:underline"><Link2Off size={13} /> Revoke all</button>
                    )}
                  </div>
                  {links.length === 0 && <p className="text-sm text-slate-400">No links issued yet.</p>}
                  <ul className="space-y-1">
                    {links.map(l => {
                      const state = l.revoked_at ? "revoked" : new Date(l.expires_at) <= new Date() ? "expired" : "active";
                      return (
                        <li key={l.id} className="text-[13px] flex justify-between gap-2">
                          <span>{l.leads?.name ?? "Guardian"} <span className="text-slate-400">· issued {fmtDateTime(l.created_at)}</span></span>
                          <span className={state === "active" ? "text-emerald-700" : "text-slate-400"}>{state}{l.last_used_at ? ` · last opened ${fmtDateTime(l.last_used_at)}` : ""}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Audit trail</p>
                  <ul className="space-y-1.5">
                    {events.map(e => (
                      <li key={e.id} className="text-[13px] flex justify-between gap-3">
                        <span>
                          {EVENT_LABEL[e.event] ?? e.event}
                          {typeof e.meta.comment === "string" ? <span className="text-slate-500"> - “{e.meta.comment}”</span> : null}
                        </span>
                        <span className="text-slate-400 shrink-0">{e.actor_type === "staff" ? e.actor_id ?? "staff" : e.actor_type} · {fmtDateTime(e.at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
