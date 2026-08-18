"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, BellOff, Clock, CheckCircle2 } from "lucide-react";

type Settings = {
  id: string;
  buffer_minutes: number;
  dnd_enabled: boolean;
  dnd_start_time: string | null;
  dnd_end_time: string | null;
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/admin/api/lead-funnel/notification-settings');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load settings');
        setSettings(data.settings);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/admin/api/lead-funnel/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
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
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={settings.buffer_minutes}
                  onChange={e => setSettings(s => s ? { ...s, buffer_minutes: Number(e.target.value) } : s)}
                  onBlur={() => save({ buffer_minutes: settings.buffer_minutes })}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
                <span className="text-sm text-slate-500">minutes</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><BellOff size={13} /> Do Not Disturb</h3>
                <button
                  onClick={() => save({ dnd_enabled: !settings.dnd_enabled })}
                  disabled={saving}
                  className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${settings.dnd_enabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.dnd_enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                While enabled, <b>nothing</b> sends during these hours - including new-lead and opt-out alerts that otherwise ping immediately. Everything held back sends the moment the window ends, each lead as its own consolidated message.
              </p>
              {settings.dnd_enabled && (
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">From</label>
                    <input
                      type="time"
                      value={settings.dnd_start_time || ''}
                      onChange={e => setSettings(s => s ? { ...s, dnd_start_time: e.target.value } : s)}
                      onBlur={() => save({ dnd_start_time: settings.dnd_start_time })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <span className="text-slate-300 mt-4">→</span>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">To</label>
                    <input
                      type="time"
                      value={settings.dnd_end_time || ''}
                      onChange={e => setSettings(s => s ? { ...s, dnd_end_time: e.target.value } : s)}
                      onBlur={() => save({ dnd_end_time: settings.dnd_end_time })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-4">Africa/Johannesburg time. "To" earlier than "From" wraps past midnight.</p>
                </div>
              )}
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
