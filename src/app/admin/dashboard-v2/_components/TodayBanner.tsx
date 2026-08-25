"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Check, Plus, Undo2, X, Flame } from "lucide-react";

type FocusItem = {
  id: string;
  label: string;
  cadence: "daily" | "weekly";
  metric_key: string;
  target_value: number;
  target_max: number | null;
  actual: number;
  achieved: boolean;
};

type TodayData = {
  date: string;
  daily: { done: number; total: number; items: FocusItem[] };
  weekly: { done: number; total: number; items: FocusItem[] };
  streak: number;
  glow: { active: boolean; reason: string | null };
  results: { id: string; title: string; target_value: number | null; cadence: string; current: number | null }[];
};

const GLOW_COPY: Record<string, string> = {
  behind_pace: "Behind pace today",
  streak_risk: "Streak at risk",
  day_end_open: "Still open as today closes",
};

// Addendum A1.3: the full panel auto-opens once per calendar day, then
// collapses to the compact banner for the rest of the day - this key is
// that gate. Set at the moment we auto-expand, not on close, so a manual
// re-open later the same day doesn't re-trigger it.
const LAST_SEEN_KEY = "dashboard_today_last_seen";

export function TodayBanner() {
  const [data, setData] = useState<TodayData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ label: "", cadence: "daily", metric_key: "focus_log", target_value: "1", target_max: "" });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/admin/api/dashboard-v2/today");
    const json = await res.json();
    if (!res.ok) return;
    setData(json);
    const lastSeen = window.localStorage.getItem(LAST_SEEN_KEY);
    if (lastSeen !== json.date) {
      setExpanded(true);
      window.localStorage.setItem(LAST_SEEN_KEY, json.date);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLog(itemId: string, undo: boolean) {
    setBusyId(itemId);
    try {
      if (undo) {
        await fetch(`/admin/api/dashboard-v2/today/log?item_id=${itemId}`, { method: "DELETE" });
      } else {
        await fetch("/admin/api/dashboard-v2/today/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId }),
        });
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRetire(itemId: string) {
    setBusyId(itemId);
    try {
      await fetch(`/admin/api/dashboard-v2/today/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "retired" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddItem() {
    if (!newItem.label.trim()) return;
    await fetch("/admin/api/dashboard-v2/today/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newItem.label.trim(),
        cadence: newItem.cadence,
        metric_key: newItem.metric_key,
        target_value: Number(newItem.target_value),
        target_max: newItem.target_max ? Number(newItem.target_max) : undefined,
        result_id: data?.results?.[0]?.id,
      }),
    });
    setNewItem({ label: "", cadence: "daily", metric_key: "focus_log", target_value: "1", target_max: "" });
    setShowAddForm(false);
    await load();
  }

  if (!data) return null;

  const glowClass = data.glow.active ? "ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]" : "";

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3 bg-white border border-stone-200 rounded-2xl shadow-sm transition-shadow ${glowClass}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-black text-stone-900">
            {data.daily.done}/{data.daily.total} today
          </span>
          <span className="text-stone-300">·</span>
          <span className="font-black text-stone-900">
            {data.weekly.done}/{data.weekly.total} this week
          </span>
          {data.streak > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-bold">
              <Flame size={12} /> {data.streak}d streak
            </span>
          )}
          {data.glow.active && data.glow.reason && <span className="text-amber-700 font-bold">{GLOW_COPY[data.glow.reason]}</span>}
        </div>
        {expanded ? <ChevronUp size={16} className="text-stone-400 shrink-0" /> : <ChevronDown size={16} className="text-stone-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="mt-2 bg-white border border-stone-200 rounded-2xl shadow-sm p-6 space-y-6">
          {data.results.length > 0 && (
            <div className="pb-4 border-b border-stone-100 space-y-1">
              {data.results.map((r) => (
                <p key={r.id} className="text-[10px] text-stone-500">
                  Ladders up to: <span className="font-bold text-stone-700">{r.title}</span>
                  {r.current !== null && r.target_value !== null && (
                    <span>
                      {" "}
                      — today: {r.current}/{r.target_value}
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}

          <ItemGroup title="Today" items={data.daily.items} busyId={busyId} onLog={handleLog} onRetire={handleRetire} />
          <ItemGroup title="This Week" items={data.weekly.items} busyId={busyId} onLog={handleLog} onRetire={handleRetire} />

          {showAddForm ? (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-2">
              <input
                value={newItem.label}
                onChange={(e) => setNewItem((v) => ({ ...v, label: e.target.value }))}
                placeholder="Item label, e.g. Referral asks"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <select
                  value={newItem.cadence}
                  onChange={(e) => setNewItem((v) => ({ ...v, cadence: e.target.value }))}
                  className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <select
                  value={newItem.metric_key}
                  onChange={(e) => setNewItem((v) => ({ ...v, metric_key: e.target.value }))}
                  className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
                >
                  <option value="focus_log">Tap to log</option>
                  <option value="qualification_checks">Auto — conversations reviewed</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  value={newItem.target_value}
                  onChange={(e) => setNewItem((v) => ({ ...v, target_value: e.target.value }))}
                  placeholder="Target"
                  type="number"
                  className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
                />
                <input
                  value={newItem.target_max}
                  onChange={(e) => setNewItem((v) => ({ ...v, target_max: e.target.value }))}
                  placeholder="Max (optional, e.g. range 3-5)"
                  type="number"
                  className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddItem}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                >
                  Save Item
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-stone-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
            >
              <Plus size={12} /> Add Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemGroup({
  title,
  items,
  busyId,
  onLog,
  onRetire,
}: {
  title: string;
  items: FocusItem[];
  busyId: string | null;
  onLog: (id: string, undo: boolean) => void;
  onRetire: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  item.achieved ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-400"
                }`}
              >
                <Check size={12} />
              </span>
              <span className="text-xs font-bold text-stone-800 truncate">{item.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-black text-stone-500">
                {item.actual}/{item.target_max ? `${item.target_value}–${item.target_max}` : item.target_value}
              </span>
              {item.metric_key === "focus_log" ? (
                <>
                  <button
                    disabled={busyId === item.id}
                    onClick={() => onLog(item.id, false)}
                    className="w-6 h-6 flex items-center justify-center bg-white border border-stone-200 rounded-lg text-stone-600 hover:border-blue-300"
                  >
                    <Plus size={12} />
                  </button>
                  {item.actual > 0 && (
                    <button
                      disabled={busyId === item.id}
                      onClick={() => onLog(item.id, true)}
                      className="w-6 h-6 flex items-center justify-center bg-white border border-stone-200 rounded-lg text-stone-400 hover:border-rose-300"
                      title="Undo last tap"
                    >
                      <Undo2 size={11} />
                    </button>
                  )}
                </>
              ) : (
                <span className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-1.5 py-0.5 bg-white border border-stone-200 rounded">
                  Auto
                </span>
              )}
              <button onClick={() => onRetire(item.id)} className="text-stone-300 hover:text-rose-500" title="Retire item">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
