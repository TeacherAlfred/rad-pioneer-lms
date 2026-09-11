"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

type Offer = {
  id: string;
  headline: string;
  body: string | null;
  cta_label: string;
  destination_url: string;
  accent: string;
  is_active: boolean;
};

const LABEL_CLS = "block text-[13px] font-medium text-slate-700 mb-1.5";
const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

const ACCENTS = [
  { value: 'bg-rad-teal', label: 'Teal' },
  { value: 'bg-rad-blue', label: 'Blue' },
  { value: 'bg-rad-purple', label: 'Purple' },
  { value: 'bg-rad-green', label: 'Green' },
  { value: 'bg-rad-yellow', label: 'Yellow' },
];

const emptyForm = { headline: '', body: '', cta_label: 'Learn more', destination_url: '', accent: 'bg-rad-blue' };

// The single "next step" offer shown on the Hub and at series completion
// (spec S6) - one content source, admin-editable without a deploy. Rows
// are kept (not overwritten) so switching the offer later doesn't lose the
// previous one's history; only one can be is_active at a time, enforced by
// tutorial_offer_config_single_active_idx.
export default function TutorialOfferAdminPage() {
  const [rows, setRows] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/admin/api/tutorials/offer');
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function editRow(row: Offer) {
    setEditingId(row.id);
    setForm({ headline: row.headline, body: row.body || '', cta_label: row.cta_label, destination_url: row.destination_url, accent: row.accent });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const isActive = rows.find(r => r.id === editingId)?.is_active ?? false;
      const payload = { ...form, is_active: isActive };
      const res = editingId
        ? await fetch('/admin/api/tutorials/offer', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...payload }) })
        : await fetch('/admin/api/tutorials/offer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function activate(row: Offer) {
    await fetch('/admin/api/tutorials/offer', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, is_active: true }) });
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <Link href="/admin/tutorials" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-4">
        <ArrowLeft size={14} /> Tutorial Hub
      </Link>
      <h1 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-6"><Sparkles size={18} /> Tutorial Hub Offer</h1>

      <div className="flex flex-col gap-3 mb-8">
        {rows.map(row => (
          <div key={row.id} className={`flex items-center justify-between border rounded-xl p-3 ${row.is_active ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{row.headline}</p>
              <p className="text-xs text-slate-400 truncate">{row.destination_url}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {row.is_active ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Live</span>
              ) : (
                <button onClick={() => activate(row)} className="text-[10px] font-black uppercase tracking-widest text-blue-600">Activate</button>
              )}
              <button onClick={() => editRow(row)} className="text-xs font-bold text-slate-500">Edit</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">No offer configured yet - the Hub and completion screen show nothing until one is created and activated.</p>}
      </div>

      <form onSubmit={save} className="flex flex-col gap-4 border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-slate-900">{editingId ? 'Edit Offer' : 'New Offer'}</h2>
        <div>
          <label className={LABEL_CLS}>Headline</label>
          <input required value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Body (optional)</label>
          <textarea rows={2} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className={INPUT_CLS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Button label</label>
            <input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Accent color</label>
            <select value={form.accent} onChange={e => setForm({ ...form, accent: e.target.value })} className={INPUT_CLS}>
              {ACCENTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL_CLS}>Destination URL</label>
          <input required value={form.destination_url} onChange={e => setForm({ ...form, destination_url: e.target.value })} className={INPUT_CLS} placeholder="https://... or /events/..." />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white font-bold text-sm py-2.5 px-6 rounded-lg disabled:opacity-50">
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Offer'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="text-sm font-bold text-slate-500 px-4">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
