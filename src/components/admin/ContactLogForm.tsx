"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  CONTACT_CHANNELS, CONTACT_CHANNEL_LABELS,
  CONTACT_OBJECTIVES, CONTACT_OBJECTIVE_LABELS,
  CONTACT_OUTCOMES, CONTACT_OUTCOME_LABELS,
} from "@/lib/contactLog";
import { VALID_STAGE_TRANSITIONS, LIFECYCLE_STAGE_LABELS } from "@/lib/funnelStages";

// Default operator name for the "contacted by" field - this log is
// currently solo-use (confirmed 2026-09-07), so it's a defaulted text input
// rather than a staff picker; still editable in case that ever changes.
const DEFAULT_CONTACTED_BY = "Alfred";

function nowLocalDatetime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export type LoggedActivity = {
  id: string;
  channel: string;
  direction: string;
  outcome: string | null;
  objective: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export function ContactLogForm({
  lead,
  onLogged,
}: {
  lead: { id: string; lifecycle_stage?: string | null };
  onLogged: (activity: LoggedActivity, newStage: string | null) => void;
}) {
  const [channel, setChannel] = useState(CONTACT_CHANNELS[0]);
  const [objective, setObjective] = useState(CONTACT_OBJECTIVES[0]);
  // Empty = "what they did" isn't known yet (a WhatsApp invite/email needs
  // time for a reply) - logs "what I did" only, flagged for review if
  // still unanswered 24h later. A live call where the outcome's already
  // obvious can still pick a real value here and skip that wait entirely.
  const [outcome, setOutcome] = useState("");
  const [contactedBy, setContactedBy] = useState(DEFAULT_CONTACTED_BY);
  const [occurredAt, setOccurredAt] = useState(nowLocalDatetime());
  const [note, setNote] = useState("");
  const [stageChange, setStageChange] = useState("no_change");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageOptions = VALID_STAGE_TRANSITIONS[lead.lifecycle_stage || ""] || [];

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/lead-funnel/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          channel,
          outcome,
          objective,
          note: note.trim() || null,
          createdBy: contactedBy.trim() || null,
          occurredAt: new Date(occurredAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log contact");

      let appliedStage: string | null = null;
      if (stageChange !== "no_change") {
        const moveRes = await fetch(`/admin/api/dashboard-v2/leads/${lead.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStage: stageChange,
            reason: outcome ? `Logged during contact — ${CONTACT_OUTCOME_LABELS[outcome] || outcome}` : "Logged during contact",
          }),
        });
        if (moveRes.ok) {
          appliedStage = stageChange;
        } else {
          const moveData = await moveRes.json().catch(() => ({}));
          setError(`Logged, but couldn't move stage: ${moveData.error || "unknown error"}`);
        }
      }

      onLogged(data.row, appliedStage);
      setNote("");
      setStageChange("no_change");
      setOccurredAt(nowLocalDatetime());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Channel</label>
          <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400">
            {CONTACT_CHANNELS.map(c => <option key={c} value={c}>{CONTACT_CHANNEL_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Objective</label>
          <select value={objective} onChange={e => setObjective(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400">
            {CONTACT_OBJECTIVES.map(o => <option key={o} value={o}>{CONTACT_OBJECTIVE_LABELS[o]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Outcome</label>
          <select value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400">
            <option value="">Awaiting response...</option>
            {CONTACT_OUTCOMES.map(o => <option key={o} value={o}>{CONTACT_OUTCOME_LABELS[o]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</label>
          <input type="datetime-local" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400" />
        </div>
      </div>
      {!outcome && (
        <p className="text-[11px] text-slate-400 -mt-1">
          This logs what you did. Come back and capture their response later - if nothing's recorded within 24h, you&apos;ll be notified to confirm it as No Answer.
        </p>
      )}

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Contacted By</label>
        <input value={contactedBy} onChange={e => setContactedBy(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400" />
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="What was said, what's next..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400" />
      </div>

      {stageOptions.length > 0 && (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Did this change their stage?</label>
          <select value={stageChange} onChange={e => setStageChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400">
            <option value="no_change">No change</option>
            {stageOptions.map(s => <option key={s} value={s}>{LIFECYCLE_STAGE_LABELS[s] || s}</option>)}
          </select>
        </div>
      )}

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-[11px] rounded-xl p-2.5">{error}</div>}

      <button
        onClick={submit}
        disabled={saving}
        className="w-full py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : null}
        {saving ? "Logging..." : "Log Contact"}
      </button>
    </div>
  );
}
