"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, X, AlertTriangle } from "lucide-react";
import { CONTACT_CHANNEL_LABELS, CONTACT_OBJECTIVE_LABELS, CONTACT_OUTCOME_LABELS } from "@/lib/contactLog";

type QueueRow = {
  id: string;
  lead_id: string;
  target_date: string;
  status: string;
  added_at: string;
  completed_at: string | null;
};

type ActivityRow = {
  id: string;
  channel: string;
  outcome: string | null;
  objective: string | null;
  note: string | null;
  created_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' });
}

// Quick "add to call queue" action, dropped into any page that lists leads
// (Funnel Stages, Lead Funnel list, Lead Journey, Message Activity - and, in
// phone-resolve mode, Warm List) so building tomorrow's call queue doesn't
// require a trip to the Call Queue page itself. Shows a "Queued" chip while
// a pending entry already exists, and - if this lead has been queued and
// resolved before (done/skipped) - warns with what happened last time before
// letting a duplicate add through, so a follow-up add is a deliberate choice
// rather than an accidental double-queue.
export function QueueQuickAdd({
  leadId,
  phone,
  leadName,
  className,
}: {
  leadId?: string;
  phone?: string;
  leadName?: string | null;
  className?: string;
}) {
  const [resolvedLeadId, setResolvedLeadId] = useState<string | null>(leadId || null);
  const [resolving, setResolving] = useState(!leadId && !!phone);
  const [history, setHistory] = useState<QueueRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone-resolve mode (Warm List, pre-commit rows have no lead yet): look
  // up the matching lead by exact phone once committed. Digits-only search
  // against the same endpoint the LeadPicker uses.
  useEffect(() => {
    if (leadId || !phone) return;
    let cancelled = false;
    (async () => {
      setResolving(true);
      try {
        const digits = phone.replace(/\D/g, "");
        const res = await fetch(`/admin/api/finance-v2/leads?q=${encodeURIComponent(digits)}`);
        const data = await res.json();
        const match = (data.leads || []).find((l: any) => l.phone === digits || l.phone === phone);
        if (!cancelled) setResolvedLeadId(match?.id || null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId, phone]);

  useEffect(() => {
    if (!resolvedLeadId) { setLoadingHistory(false); return; }
    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/admin/api/lead-funnel/call-queue?leadId=${encodeURIComponent(resolvedLeadId)}`);
        const data = await res.json();
        if (!cancelled) setHistory(data.rows || []);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resolvedLeadId]);

  const pending = history.find(r => r.status === 'pending');
  const hasPriorHistory = !pending && history.length > 0;

  async function addToQueue() {
    if (!resolvedLeadId) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/lead-funnel/call-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: resolvedLeadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add to queue');
      setHistory(prev => [data.row, ...prev]);
      setShowConfirm(false);
    } catch (err: any) {
      setError(err.message);
      if (!showConfirm) alert(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function openConfirm() {
    setShowConfirm(true);
    setLoadingActivities(true);
    try {
      const res = await fetch(`/admin/api/lead-funnel/activities?leadId=${encodeURIComponent(resolvedLeadId!)}`);
      const data = await res.json();
      setActivities((data.rows || []).slice(0, 5));
    } finally {
      setLoadingActivities(false);
    }
  }

  async function removePending() {
    if (!pending) return;
    if (!confirm(`Remove ${leadName || 'this lead'} from the call queue?`)) return;
    setHistory(prev => prev.filter(r => r.id !== pending.id));
    await fetch('/admin/api/lead-funnel/call-queue', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pending.id }),
    });
  }

  const baseBtn = className || "inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg";

  if (resolving || loadingHistory) {
    return <span className={`${baseBtn} text-slate-300`}><Loader2 size={12} className="animate-spin" /></span>;
  }
  if (!resolvedLeadId) return null;

  if (pending) {
    return (
      <button onClick={removePending} title={`Queued for ${fmtDate(pending.target_date)} - click to remove`} className={`${baseBtn} text-blue-600 bg-blue-50 hover:bg-rose-50 hover:text-rose-500`}>
        <Phone size={12} /> Queued
      </button>
    );
  }

  return (
    <>
      <button onClick={hasPriorHistory ? openConfirm : addToQueue} disabled={adding} className={`${baseBtn} text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50`}>
        {adding ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />} Add to Queue
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 pt-6 pb-1 shrink-0">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 flex items-center gap-1.5"><AlertTriangle size={16} className="text-amber-500" /> Already queued before</h3>
                <p className="text-[13px] text-slate-400 mt-0.5">{leadName || 'This lead'} has been added to the call queue before.</p>
              </div>
              <button onClick={() => setShowConfirm(false)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"><X size={13} /></button>
            </div>

            <div className="px-6 pt-4 pb-5 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Previous Queue Entries</label>
                <div className="space-y-1.5">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-[12px] bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-slate-600 capitalize">{h.status}</span>
                      <span className="text-slate-400">{fmtDate(h.target_date)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Comments From Last Contact</label>
                {loadingActivities ? (
                  <div className="flex items-center justify-center py-3 text-slate-300"><Loader2 className="animate-spin" size={14} /></div>
                ) : activities.length === 0 ? (
                  <p className="text-[11px] text-slate-300">No contact log entries yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {activities.map(a => (
                      <div key={a.id} className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700">
                            {a.outcome ? (CONTACT_OUTCOME_LABELS[a.outcome] || a.outcome) : <span className="text-amber-600">Awaiting response</span>}
                            <span className="text-slate-400 font-normal"> · {CONTACT_CHANNEL_LABELS[a.channel] || a.channel}{a.objective ? ` · ${CONTACT_OBJECTIVE_LABELS[a.objective] || a.objective}` : ''}</span>
                          </span>
                          <span className="text-slate-400 shrink-0">{fmtDate(a.created_at)}</span>
                        </div>
                        {a.note && <p className="text-[12px] text-slate-600 mt-1">{a.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <div className="flex gap-2">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">Cancel</button>
                <button
                  onClick={addToQueue}
                  disabled={adding}
                  className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : "Add Anyway"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
