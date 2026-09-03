"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { FitnessBreadcrumb } from "../_components/FitnessBreadcrumb";

type ManualLog = {
  log_date: string;
  weight_kg: number | null;
  energy_level: number | null;
  sleep_hours: number | null;
  soreness_notes: string | null;
  life_event_tag: string | null;
  free_notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): ManualLog => ({
  log_date: today(),
  weight_kg: null,
  energy_level: null,
  sleep_hours: null,
  soreness_notes: null,
  life_event_tag: null,
  free_notes: null,
});

export default function FitnessLogPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<ManualLog[]>([]);
  const [form, setForm] = useState<ManualLog>(emptyForm());

  function load() {
    setLoading(true);
    fetch("/admin/api/dashboard-v2/projects/fitness/logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/admin/api/dashboard-v2/projects/fitness/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to save log");
        return;
      }
      setForm(emptyForm());
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(date: string) {
    if (!confirm(`Delete the log for ${date}?`)) return;
    await fetch(`/admin/api/dashboard-v2/projects/fitness/logs/${date}`, { method: "DELETE" });
    load();
  }

  function edit(log: ManualLog) {
    setForm(log);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link href="/admin/dashboard-v2/projects" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3">
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <FitnessBreadcrumb current="Log" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Daily Log</h1>
          <p className="text-stone-500 text-sm mt-1">Whatever Strava doesn't capture — weight, energy, sleep, soreness.</p>
        </div>

        <section className="bg-white border border-stone-200 rounded-[24px] p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Date</label>
              <input
                type="date"
                value={form.log_date}
                onChange={(e) => setForm({ ...form, log_date: e.target.value })}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={form.weight_kg ?? ""}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value === "" ? null : parseFloat(e.target.value) })}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Energy Level</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, energy_level: n })}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                    form.energy_level === n ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500 hover:border-stone-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Sleep (hours)</label>
              <input
                type="number"
                step="0.25"
                value={form.sleep_hours ?? ""}
                onChange={(e) => setForm({ ...form, sleep_hours: e.target.value === "" ? null : parseFloat(e.target.value) })}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Life Event Tag</label>
              <input
                type="text"
                placeholder="e.g. travel, sick"
                value={form.life_event_tag ?? ""}
                onChange={(e) => setForm({ ...form, life_event_tag: e.target.value || null })}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Soreness Notes</label>
            <textarea
              value={form.soreness_notes ?? ""}
              onChange={(e) => setForm({ ...form, soreness_notes: e.target.value || null })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Free Notes</label>
            <textarea
              value={form.free_notes ?? ""}
              onChange={(e) => setForm({ ...form, free_notes: e.target.value || null })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-stone-900 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Day"}
            </button>
            <button onClick={() => setForm(emptyForm())} className="text-sm font-bold text-stone-400 hover:text-stone-700">
              Clear
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">History</h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-stone-300" size={24} />
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Date</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Weight</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Energy</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Sleep</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Tag</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.log_date} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 cursor-pointer" onClick={() => edit(log)}>
                      <td className="px-6 py-3 font-bold text-stone-800">{log.log_date}</td>
                      <td className="px-6 py-3 text-stone-600">{log.weight_kg != null ? `${log.weight_kg} kg` : "—"}</td>
                      <td className="px-6 py-3 text-stone-600">{log.energy_level ?? "—"}</td>
                      <td className="px-6 py-3 text-stone-600">{log.sleep_hours != null ? `${log.sleep_hours}h` : "—"}</td>
                      <td className="px-6 py-3 text-stone-500">{log.life_event_tag ?? "—"}</td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(log.log_date);
                          }}
                          className="text-stone-300 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-stone-400 text-sm">
                        No days logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
