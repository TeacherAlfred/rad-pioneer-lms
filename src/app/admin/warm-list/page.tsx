"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2, CheckCircle2, XCircle, RotateCcw, Plus, Search,
  MapPin, Mail, Phone, AlertTriangle, Send,
} from "lucide-react";

type Row = {
  id: string;
  contact_method: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  status_category: string;
  status_labels: string | null;
  sources: string | null;
  location: string | null;
  is_plk: boolean;
  kids_count: number | null;
  children_notes: string | null;
  first_seen: string | null;
  last_seen: string | null;
  review_status: 'pending' | 'approved' | 'excluded';
  review_note: string | null;
  added_manually: boolean;
  committed_at: string | null;
};

const TABS = ['pending', 'approved', 'excluded', 'committed', 'all'] as const;
type Tab = typeof TABS[number];

export default function WarmListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [plkOnly, setPlkOnly] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', location: '', is_plk: false });
  const [isAdding, setIsAdding] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);

  useEffect(() => { fetchRows(); }, []);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/warm-list');
      const data = await res.json();
      if (res.ok) setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => ({
    pending: rows.filter(r => r.review_status === 'pending').length,
    approved: rows.filter(r => r.review_status === 'approved' && !r.committed_at).length,
    excluded: rows.filter(r => r.review_status === 'excluded').length,
    committed: rows.filter(r => !!r.committed_at).length,
    all: rows.length,
  }), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === 'committed') list = list.filter(r => !!r.committed_at);
    else if (tab !== 'all') list = list.filter(r => r.review_status === tab && !r.committed_at);
    if (plkOnly) list = list.filter(r => r.is_plk);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, tab, plkOnly, search]);

  async function patchRow(id: string, fields: Partial<Row>) {
    setSavingId(id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    try {
      const res = await fetch('/admin/api/warm-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
      fetchRows();
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    if (!newLead.phone && !newLead.email) { alert('Give at least a phone or email.'); return; }
    setIsAdding(true);
    try {
      const res = await fetch('/admin/api/warm-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(prev => [data.row, ...prev]);
      setNewLead({ name: '', phone: '', email: '', location: '', is_plk: false });
      setShowAdd(false);
      setTab('pending');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleCommit() {
    if (counts.approved === 0) return;
    if (!confirm(`Push ${counts.approved} approved contact(s) into the real leads table?`)) return;
    setIsCommitting(true);
    setCommitResult(null);
    try {
      const res = await fetch('/admin/api/warm-list/commit', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCommitResult(data);
      fetchRows();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCommitting(false);
    }
  }

  const catColor: Record<string, string> = {
    existing: 'bg-emerald-100 text-emerald-700',
    recent: 'bg-sky-100 text-sky-700',
    past: 'bg-slate-200 text-slate-600',
    lead: 'bg-amber-100 text-amber-700',
    unclear: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Warm List Review</h1>
            <p className="text-sm text-slate-500 mt-1">Sanity-check the imported contacts before anything reaches the real leads table.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:border-slate-400 transition-colors">
              <Plus size={14} /> Add Lead
            </button>
            <button
              onClick={handleCommit}
              disabled={counts.approved === 0 || isCommitting}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            >
              {isCommitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Commit Approved ({counts.approved})
            </button>
          </div>
        </div>

        {commitResult && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800">
            <b>{commitResult.inserted}</b> new leads created, <b>{commitResult.alreadyExisted}</b> already existed (left untouched), <b>{commitResult.skipped}</b> skipped.
            {commitResult.skippedReasons?.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-xs text-emerald-700">
                {commitResult.skippedReasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}
            >
              {t} ({counts[t === 'all' ? 'all' : t]})
            </button>
          ))}
          <label className="flex items-center gap-2 ml-2 text-xs font-bold text-slate-500">
            <input type="checkbox" checked={plkOnly} onChange={e => setPlkOnly(e.target.checked)} className="accent-slate-900" /> PLK only
          </label>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search name, phone, email" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 w-64" />
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-slate-400 text-sm">Nothing here.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="p-3">Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3">Sources</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 align-top">
                    <td className="p-3 min-w-[160px]">
                      <input
                        defaultValue={row.name || ''}
                        placeholder={!row.name ? '⚠️ no name' : ''}
                        onBlur={e => e.target.value !== (row.name || '') && patchRow(row.id, { name: e.target.value })}
                        className={`w-full bg-transparent outline-none font-bold text-slate-800 ${!row.name ? 'placeholder:text-rose-400' : ''}`}
                      />
                    </td>
                    <td className="p-3 min-w-[190px]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Phone size={11} className="text-slate-400 shrink-0" />
                        <input defaultValue={row.phone || ''} placeholder="—" onBlur={e => e.target.value !== (row.phone || '') && patchRow(row.id, { phone: e.target.value || null, contact_method: e.target.value ? 'whatsapp' : row.contact_method })} className="w-full bg-transparent outline-none text-xs text-slate-600" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail size={11} className="text-slate-400 shrink-0" />
                        <input defaultValue={row.email || ''} placeholder={!row.phone && !row.email ? '⚠️ no contact method' : '—'} onBlur={e => e.target.value !== (row.email || '') && patchRow(row.id, { email: e.target.value || null })} className="w-full bg-transparent outline-none text-xs text-slate-600 placeholder:text-rose-400" />
                      </div>
                    </td>
                    <td className="p-3">
                      <select value={row.status_category} onChange={e => patchRow(row.id, { status_category: e.target.value })} className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full outline-none ${catColor[row.status_category] || catColor.unclear}`}>
                        {['existing', 'recent', 'past', 'lead', 'unclear'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-3 min-w-[110px]">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <input defaultValue={row.location || ''} onBlur={e => e.target.value !== (row.location || '') && patchRow(row.id, { location: e.target.value || null })} className="w-full bg-transparent outline-none text-xs text-slate-600" />
                      </div>
                      <label className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-slate-400">
                        <input type="checkbox" checked={row.is_plk} onChange={e => patchRow(row.id, { is_plk: e.target.checked })} className="accent-amber-500" /> PLK
                      </label>
                    </td>
                    <td className="p-3 max-w-[240px] text-xs text-slate-500">
                      {row.children_notes || '—'}
                      {row.review_note && <div className="mt-1 flex items-center gap-1 text-rose-500"><AlertTriangle size={11} /> {row.review_note}</div>}
                    </td>
                    <td className="p-3 text-[10px] text-slate-400 max-w-[140px] break-words">{row.sources}{row.added_manually ? ' (manual)' : ''}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.committed_at ? (
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Committed</span>
                        ) : (
                          <>
                            {row.review_status !== 'approved' && (
                              <button onClick={() => patchRow(row.id, { review_status: 'approved' })} title="Approve" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><CheckCircle2 size={16} /></button>
                            )}
                            {row.review_status !== 'excluded' && (
                              <button onClick={() => patchRow(row.id, { review_status: 'excluded' })} title="Exclude" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><XCircle size={16} /></button>
                            )}
                            {row.review_status !== 'pending' && (
                              <button onClick={() => patchRow(row.id, { review_status: 'pending' })} title="Reset to pending" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><RotateCcw size={16} /></button>
                            )}
                          </>
                        )}
                        {savingId === row.id && <Loader2 size={12} className="animate-spin text-slate-300" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60" onClick={() => setShowAdd(false)}>
          <form onSubmit={handleAddLead} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3">
            <h3 className="font-black text-lg text-slate-800 mb-2">Add a lead</h3>
            <input placeholder="Name" value={newLead.name} onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
            <input placeholder="Phone" value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
            <input placeholder="Email" value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
            <input placeholder="Location" value={newLead.location} onChange={e => setNewLead(p => ({ ...p, location: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <input type="checkbox" checked={newLead.is_plk} onChange={e => setNewLead(p => ({ ...p, is_plk: e.target.checked }))} /> Polokwane (PLK)
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
              <button type="submit" disabled={isAdding} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">{isAdding ? '...' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
