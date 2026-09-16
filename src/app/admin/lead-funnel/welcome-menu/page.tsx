"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageSquare, Trash2, CheckCircle2, Info } from "lucide-react";

type Button = { id: string; title: string };
type FlowOption = { id: string; trigger_button_id: string; label: string };

const DEFAULT_NEW = "👋 Hi! Welcome to RAD Academy.\n\nWhether you're a returning parent or new to our community, we help turn screen time into skill-building. What would you like to explore?";
const DEFAULT_RETURNING = "👋 Hey, great to hear from you!\n\nWhat can we help you with today?";
const DEFAULT_BUTTONS: Button[] = [
  { id: "btn_guide", title: "Get Free Guide" },
  { id: "btn_events", title: "Upcoming Events" },
  { id: "btn_human", title: "Talk to Educator" },
];

export default function WelcomeMenuPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flows, setFlows] = useState<FlowOption[]>([]);

  const [messageNew, setMessageNew] = useState("");
  const [messageReturning, setMessageReturning] = useState("");
  const [buttons, setButtons] = useState<Button[]>([]);
  const [usingDefaults, setUsingDefaults] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, flowsRes] = await Promise.all([
          fetch("/admin/api/lead-funnel/welcome-menu"),
          fetch("/admin/api/bot-flows"),
        ]);
        const settingsData = await settingsRes.json();
        if (!settingsRes.ok) throw new Error(settingsData.error || "Failed to load settings");
        const s = settingsData.settings || {};
        const hasCustom = !!(s.welcome_message_new || s.welcome_message_returning || (s.welcome_buttons || []).length > 0);
        setUsingDefaults(!hasCustom);
        setMessageNew(s.welcome_message_new || DEFAULT_NEW);
        setMessageReturning(s.welcome_message_returning || DEFAULT_RETURNING);
        setButtons((s.welcome_buttons || []).length > 0 ? s.welcome_buttons : DEFAULT_BUTTONS);

        const flowsData = await flowsRes.json();
        setFlows((flowsData.rows || []).map((r: any) => ({ id: r.id, trigger_button_id: r.trigger_button_id, label: r.label })));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateButton(idx: number, field: "id" | "title", value: string) {
    setButtons(prev => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  }
  function addButton() {
    if (buttons.length >= 3) return;
    setButtons(prev => [...prev, { id: "", title: "" }]);
  }
  function removeButton(idx: number) {
    setButtons(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/admin/api/lead-funnel/welcome-menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          welcome_message_new: messageNew,
          welcome_message_returning: messageReturning,
          welcome_buttons: buttons.filter(b => b.id.trim() && b.title.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setUsingDefaults(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/lead-funnel/welcome-menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ welcome_message_new: "", welcome_message_returning: "", welcome_buttons: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset");
      setMessageNew(DEFAULT_NEW);
      setMessageReturning(DEFAULT_RETURNING);
      setButtons(DEFAULT_BUTTONS);
      setUsingDefaults(true);
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare size={22} className="text-blue-500" /> Welcome Menu
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            The catch-all reply sent to any lead who texts in with no keyword match and isn't mid-flow - the first thing most new leads see. Doesn't cover the robotics-watch ad set's own purpose-built greeting, which stays a separate, campaign-specific message.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <div className="space-y-4">
            {usingDefaults && (
              <div className="flex items-start gap-2 text-xs bg-blue-50 text-blue-700 rounded-xl px-3.5 py-2.5">
                <Info size={14} className="shrink-0 mt-0.5" />
                Showing the built-in default copy - nothing's been customized yet. Saving below starts overriding it.
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">First-time lead</label>
                <p className="text-[11px] text-slate-400 mb-2">A lead we've never heard from before - the message that created their record.</p>
                <textarea
                  value={messageNew}
                  onChange={e => setMessageNew(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Returning lead</label>
                <p className="text-[11px] text-slate-400 mb-2">Anyone already on file - an existing contact or a later, unrelated message from the same lead.</p>
                <textarea
                  value={messageReturning}
                  onChange={e => setMessageReturning(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Buttons (max 3) - same for both variants</label>
                {buttons.map((b, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      list="welcome-menu-trigger-ids"
                      placeholder="button_id (a bot flow's trigger id)"
                      value={b.id}
                      onChange={e => updateButton(i, "id", e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none w-64"
                    />
                    <div className="flex-1 relative">
                      <input
                        placeholder="Button label"
                        value={b.title}
                        onChange={e => updateButton(i, "title", e.target.value)}
                        maxLength={20}
                        className={`w-full bg-slate-50 border rounded-lg px-3 py-2 pr-10 text-xs outline-none ${b.title.length > 20 ? "border-rose-400" : "border-slate-200"}`}
                      />
                      <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold ${b.title.length > 20 ? "text-rose-500" : "text-slate-300"}`}>{b.title.length}/20</span>
                    </div>
                    <button type="button" onClick={() => removeButton(i)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                  </div>
                ))}
                {buttons.length < 3 && (
                  <button type="button" onClick={addButton} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">+ add button</button>
                )}
                <datalist id="welcome-menu-trigger-ids">
                  {flows.map(f => (
                    <option key={f.id} value={f.trigger_button_id}>{f.label}</option>
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><CheckCircle2 size={14} /> Saved</> : "Save"}
              </button>
              <button
                onClick={resetToDefault}
                disabled={saving || usingDefaults}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-400 disabled:opacity-30"
              >
                Reset to Default
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
