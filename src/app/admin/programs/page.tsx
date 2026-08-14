"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Baby, Plus, X, Pencil, Trash2, Users2, Calendar, MapPin,
} from "lucide-react";
import { formatLabel, PROGRAM_TYPES, PROGRAM_STATUSES } from "@/lib/programs";

type Program = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  status: string;
  enrollment_count: number;
};

const emptyForm = { name: '', type: 'course', description: '', start_date: '', end_date: '', location: '', status: 'active' };

const TYPE_STYLES: Record<string, string> = {
  course: 'bg-blue-50 text-blue-600',
  event: 'bg-amber-50 text-amber-600',
  bootcamp: 'bg-purple-50 text-purple-600',
  workshop: 'bg-emerald-50 text-emerald-600',
  other: 'bg-slate-100 text-slate-500',
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/programs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load programs');
      setPrograms(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visiblePrograms = useMemo(
    () => showArchived ? programs : programs.filter(p => p.status !== 'archived'),
    [programs, showArchived]
  );

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(p: Program) {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      description: p.description || '',
      start_date: p.start_date || '',
      end_date: p.end_date || '',
      location: p.location || '',
      status: p.status,
    });
    setFormError(null);
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        location: form.location.trim() || null,
        status: form.status,
      };
      const res = await fetch('/admin/api/programs', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      await load();
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Program) {
    const warning = p.enrollment_count > 0
      ? `Delete "${p.name}"? This also removes ${p.enrollment_count} kid enrollment${p.enrollment_count === 1 ? '' : 's'} for it.`
      : `Delete "${p.name}"?`;
    if (!confirm(warning)) return;
    await fetch('/admin/api/programs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    });
    await load();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Users2 size={14} /> Lead Funnel
            </Link>
            <Link href="/admin/kids" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Baby size={14} /> Kids
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Programs</h1>
          <p className="text-sm text-slate-500 mt-1">Courses, events, and bootcamps kids can be registered for.</p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
                <Plus size={14} /> Add Program
              </button>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer ml-auto">
                <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {visiblePrograms.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800">{p.name}</h3>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${TYPE_STYLES[p.type] || 'bg-slate-100 text-slate-500'}`}>
                          {formatLabel(p.type)}
                        </span>
                        {p.status === 'archived' && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Archived</span>
                        )}
                      </div>
                      {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        {(p.start_date || p.end_date) && (
                          <span className="flex items-center gap-1"><Calendar size={11} /> {p.start_date || '?'} → {p.end_date || '?'}</span>
                        )}
                        {p.location && <span className="flex items-center gap-1"><MapPin size={11} /> {p.location}</span>}
                        <span className="flex items-center gap-1"><Baby size={11} /> {p.enrollment_count} enrolled</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openEdit(p)} className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                      <button onClick={() => remove(p)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {visiblePrograms.length === 0 && (
                <div className="md:col-span-2 py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                  No programs yet. <button onClick={openAdd} className="underline">Add one</button>.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">{editing ? 'Edit Program' : 'Add Program'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                    {PROGRAM_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                    {PROGRAM_STATUSES.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Location</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              {formError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{formError}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Program'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
