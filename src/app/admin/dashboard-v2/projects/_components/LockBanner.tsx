"use client";

import { useState } from "react";
import { Lock, Unlock, ShieldAlert, GitBranch } from "lucide-react";

export type ProjectLockState = {
  locked: boolean;
  lock_branch_name: string | null;
  lock_risk_notes: string | null;
  locked_at: string | null;
};

// Locking is a governance record, not git enforcement - this cannot and
// does not block real git operations. It's a reminder + written
// justification trail for "no dev work on main without a branch and a
// reason," surfaced as a persistent banner while the project is locked.
export function LockBanner({ projectId, state, onChange }: { projectId: string; state: ProjectLockState; onChange: (state: ProjectLockState) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ branch_name: "", risk_notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lock() {
    if (!draft.branch_name.trim() || !draft.risk_notes.trim()) {
      setError("Branch name and risk/justification notes are both required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/${projectId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChange(json.project);
      setShowForm(false);
      setDraft({ branch_name: "", risk_notes: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to lock");
    } finally {
      setSaving(false);
    }
  }

  async function unlock() {
    setSaving(true);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/${projectId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChange(json.project);
    } finally {
      setSaving(false);
    }
  }

  if (state.locked) {
    return (
      <div className="bg-rose-50 border-2 border-rose-300 rounded-[24px] shadow-sm p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert size={22} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-rose-800 uppercase tracking-wide">Locked — no work on main without justification</p>
            <p className="text-xs text-rose-700 mt-1 flex items-center gap-1.5">
              <GitBranch size={12} /> Work in progress belongs on branch: <span className="font-black">{state.lock_branch_name}</span>
            </p>
            <p className="text-xs text-rose-700 mt-2 whitespace-pre-wrap">{state.lock_risk_notes}</p>
          </div>
          <button
            onClick={unlock}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-300 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100 shrink-0 disabled:opacity-50"
          >
            <Unlock size={13} />
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6">
      {showForm ? (
        <div className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-stone-400">Lock this project</p>
          <input
            value={draft.branch_name}
            onChange={(e) => setDraft((d) => ({ ...d, branch_name: e.target.value }))}
            placeholder="Branch name, e.g. feature/new-checkout"
            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs"
          />
          <textarea
            value={draft.risk_notes}
            onChange={(e) => setDraft((d) => ({ ...d, risk_notes: e.target.value }))}
            placeholder="Why is this locked, and what's the risk of touching main directly?"
            rows={3}
            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={lock}
              disabled={saving}
              className="flex-1 py-2 bg-stone-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Lock Project
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-stone-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900"
        >
          <Lock size={14} />
          Lock This Project
        </button>
      )}
    </div>
  );
}
