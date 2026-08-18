"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, BellOff, Clock, CheckCircle2, Send, Copy } from "lucide-react";
import { DAY_NAMES, type DndDay } from "@/lib/dndSchedule";

type Settings = { id: string; buffer_minutes: number };
type PendingLead = {
  leadId: string; leadName: string | null; leadPhone: string | null;
  count: number; events: string[]; windowStart: string; willFlushAt: string; overdue: boolean;
};
type Preview = { pending: PendingLead[]; dndActive: boolean; bufferMinutes: number; lastFlushedAt: string | null };

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' });
}

function relativeFuture(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'any moment now';
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'under a minute';
  return `~${diffMin}m`;
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dndSchedule, setDndSchedule] = useState<DndDay[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [releasingId, setReleasingId] = useState<string | 'all' | null>(null);

  const loadPreview = useCallback(async () => {
    try {
      const res = await fetch('/admin/api/lead-funnel/notify-flush');
      const data = await res.json();
      if (res.ok) setPreview(data);
    } catch {
      // Non-fatal - the pending panel just won't update this cycle.
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/admin/api/lead-funnel/notification-settings');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load settings');
        setSettings(data.settings);
        setDndSchedule(data.dndSchedule);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
    loadPreview();
    // So an admin sitting on this page sees the pipeline update itself,
    // not just at the moment they loaded the page.
    const interval = setInterval(loadPreview, 30000);
    return () => clearInterval(interval);
  }, [loadPreview]);

  async function saveBufferMinutes(minutes: number) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/admin/api/lead-funnel/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buffer_minutes: minutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSettings(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateDay(dayOfWeek: number, patch: Partial<DndDay>) {
    setDndSchedule(prev => prev.map(d => d.day_of_week === dayOfWeek ? { ...d, ...patch } : d));
  }

  function copyDay(fromDay: number, toDays: number[]) {
    const source = dndSchedule.find(d => d.day_of_week === fromDay);
    if (!source) return;
    setDndSchedule(prev => prev.map(d => toDays.includes(d.day_of_week) ? { ...d, enabled: source.enabled, start_time: source.start_time, end_time: source.end_time } : d));
  }

  async function saveDndSchedule() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/admin/api/lead-funnel/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dndSchedule }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setDndSchedule(data.dndSchedule);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function releaseNow(leadId?: string) {
    setReleasingId(leadId || 'all');
    setError(null);
    try {
      const res = await fetch('/admin/api/lead-funnel/notify-flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadId ? { leadId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to release');
      await loadPreview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReleasingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Lead Funnel
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notification Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Controls how pipeline alerts reach you. New leads, opt-outs, and delivery failures always ping you right away - everything else (button taps, media downloads, bot flow fires, reply captures) gets batched into one message per lead after the buffer window below.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : settings ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5"><Clock size={13} /> Buffer Window</h3>
              <p className="text-xs text-slate-500 mb-3">
                A lead's first buffered action starts the clock - everything else they do gets rolled into one summary sent exactly this many minutes later, no matter how many more actions happen in between.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={settings.buffer_minutes}
                  onChange={e => setSettings(s => s ? { ...s, buffer_minutes: Number(e.target.value) } : s)}
                  onBlur={() => saveBufferMinutes(settings.buffer_minutes)}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
                <span className="text-sm text-slate-500">minutes</span>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Last batch sent</span>
                  <span className="text-xs font-bold text-slate-700">{preview ? relativeTime(preview.lastFlushedAt) : '—'}</span>
                </div>

                {preview && preview.pending.length === 0 && (
                  <p className="text-xs text-slate-300 py-3 text-center">Nothing queued right now.</p>
                )}

                {preview && preview.pending.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending for next cycle ({preview.pending.length})</span>
                      <button
                        onClick={() => releaseNow()}
                        disabled={releasingId !== null}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 disabled:opacity-50"
                      >
                        <Send size={11} /> {releasingId === 'all' ? 'Sending...' : 'Send All Now'}
                      </button>
                    </div>
                    {preview.pending.map(p => (
                      <div key={p.leadId} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800 truncate">{p.leadName || (p.leadPhone ? `+${p.leadPhone}` : 'Unknown lead')}</div>
                          <div className="text-[11px] text-slate-400">
                            {p.count} action{p.count === 1 ? '' : 's'} ·{' '}
                            {preview.dndActive
                              ? 'waiting for Do Not Disturb to end'
                              : p.overdue ? 'due now - waiting for next check' : `sends in ${relativeFuture(p.willFlushAt)}`}
                          </div>
                        </div>
                        <button
                          onClick={() => releaseNow(p.leadId)}
                          disabled={releasingId !== null}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                        >
                          {releasingId === p.leadId ? 'Sending...' : 'Send Now'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5"><BellOff size={13} /> Do Not Disturb</h3>
              <p className="text-xs text-slate-500 mb-4">
                Each day can have its own window, or none at all - e.g. a longer window on weekends than on weekdays. While a day's window is active, <b>nothing</b> sends during it, including new-lead and opt-out alerts that otherwise ping immediately. Everything held back sends the moment the window ends, each lead as its own consolidated message.
              </p>

              <div className="space-y-2">
                {dndSchedule.map(day => (
                  <div key={day.day_of_week} className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => updateDay(day.day_of_week, { enabled: !day.enabled })}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${day.enabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${day.enabled ? 'translate-x-4' : ''}`} />
                    </button>
                    <span className="text-xs font-bold text-slate-700 w-20 shrink-0">{DAY_NAMES[day.day_of_week]}</span>
                    <input
                      type="time"
                      value={day.start_time || ''}
                      disabled={!day.enabled}
                      onChange={e => updateDay(day.day_of_week, { start_time: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-40"
                    />
                    <span className="text-slate-300 text-xs">→</span>
                    <input
                      type="time"
                      value={day.end_time || ''}
                      disabled={!day.enabled}
                      onChange={e => updateDay(day.day_of_week, { end_time: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-40"
                    />
                    {day.day_of_week === 1 && (
                      <button onClick={() => copyDay(1, [2, 3, 4, 5])} title="Copy Monday's times to Tue-Fri" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                        <Copy size={10} /> Copy to Tue-Fri
                      </button>
                    )}
                    {day.day_of_week === 6 && (
                      <button onClick={() => copyDay(6, [0])} title="Copy Saturday's times to Sunday" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                        <Copy size={10} /> Copy to Sunday
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={saveDndSchedule}
                disabled={saving}
                className="mt-4 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Do Not Disturb Schedule'}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 h-5">
              {saving && <><Loader2 size={12} className="animate-spin" /> Saving...</>}
              {saved && <><CheckCircle2 size={12} className="text-emerald-500" /> Saved</>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
