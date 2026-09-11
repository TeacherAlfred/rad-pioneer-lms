"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, X, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Sparkles, BookOpen } from "lucide-react";

type Series = {
  id: string;
  title: string;
  description: string | null;
  level: string;
  category: string | null;
  estimated_minutes: number | null;
  cover_image_url: string | null;
  sort_order: number;
  is_hidden: boolean;
};

const LABEL_CLS = "block text-[13px] font-medium text-slate-700 mb-1.5";
const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

const emptyForm = { title: '', description: '', level: 'beginner', category: '', estimated_minutes: '', cover_image_url: '' };

export default function TutorialSeriesListPage() {
  const [rows, setRows] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/tutorials/series');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createSeries(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/admin/api/tutorials/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(emptyForm);
      setFormOpen(false);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(row: Series) {
    await fetch('/admin/api/tutorials/series', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, is_hidden: !row.is_hidden }),
    });
    load();
  }

  async function move(row: Series, direction: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(r => r.id === row.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      fetch('/admin/api/tutorials/series', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, sort_order: swapWith.sort_order }) }),
      fetch('/admin/api/tutorials/series', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: swapWith.id, sort_order: row.sort_order }) }),
    ]);
    load();
  }

  async function remove(row: Series) {
    if (!confirm(`Delete "${row.title}" and everything in it? This can't be undone.`)) return;
    await fetch('/admin/api/tutorials/series', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id }) });
    load();
  }

  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen size={20} /> Tutorial Hub
          </h1>
          <p className="text-sm text-slate-500">Manage the series shown at radacademy.co.za/tutorials.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/tutorials/offer" className="flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg px-3 py-2">
            <Sparkles size={14} /> Offer
          </Link>
          <button onClick={() => setFormOpen(true)} className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg px-3 py-2">
            <Plus size={14} /> New Series
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((row, i) => (
            <div key={row.id} className={`flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 ${row.is_hidden ? 'opacity-60' : ''}`}>
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(row, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={16} /></button>
                <button onClick={() => move(row, 1)} disabled={i === sorted.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{row.title}</p>
                <p className="text-xs text-slate-400">{row.level} {row.category ? `· ${row.category}` : ''} {row.is_hidden ? '· Draft' : '· Published'}</p>
              </div>
              <button onClick={() => togglePublish(row)} className="text-slate-400 hover:text-slate-700" title={row.is_hidden ? 'Publish' : 'Unpublish'}>
                {row.is_hidden ? <EyeOff size={16} /> : <Eye size={16} className="text-emerald-500" />}
              </button>
              <Link href={`/admin/tutorials/${row.id}`} className="text-slate-400 hover:text-blue-600" title="Edit tutorials & steps">
                <Pencil size={16} />
              </Link>
              <button onClick={() => remove(row)} className="text-slate-400 hover:text-red-500" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {sorted.length === 0 && <p className="text-sm text-slate-400 text-center py-12">No series yet - create one to get started.</p>}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">New Series</h2>
              <button onClick={() => setFormOpen(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={createSeries} className="flex flex-col gap-4">
              <div>
                <label className={LABEL_CLS}>Title</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Level</label>
                  <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className={INPUT_CLS}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Est. minutes</label>
                  <input type="number" value={form.estimated_minutes} onChange={e => setForm({ ...form, estimated_minutes: e.target.value })} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Category (for filtering)</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={INPUT_CLS} placeholder="e.g. MakeCode, Web" />
              </div>
              <div>
                <label className={LABEL_CLS}>Cover image URL</label>
                <input value={form.cover_image_url} onChange={e => setForm({ ...form, cover_image_url: e.target.value })} className={INPUT_CLS} placeholder="https://..." />
              </div>
              <button type="submit" disabled={saving} className="bg-blue-600 text-white font-bold text-sm py-2.5 rounded-lg disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Series (as draft)'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
