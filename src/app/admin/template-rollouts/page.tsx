"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ArrowLeft, X } from "lucide-react";

type Rollout = {
  id: string;
  name: string;
  category: string;
  language: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  meta_status: string | null;
  lane: 'a' | 'b' | null;
  linked_bot_flow_id: string | null;
  lane_completed_at: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-500' },
  submitted: { label: 'Waiting on Meta', className: 'bg-amber-50 text-amber-600' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-600' },
  rejected: { label: 'Rejected', className: 'bg-rose-50 text-rose-600' },
};

function laneLabel(row: Rollout): { label: string; className: string } | null {
  if (row.status !== 'approved') return null;
  if (!row.lane) return { label: 'Choose a lane', className: 'bg-indigo-50 text-indigo-600' };
  if (row.lane === 'a') return { label: 'Lane A - ad-hoc ready', className: 'bg-teal-50 text-teal-600' };
  return row.linked_bot_flow_id
    ? { label: 'Lane B - linked to a flow', className: 'bg-teal-50 text-teal-600' }
    : { label: 'Lane B - finish in Bot Flows', className: 'bg-indigo-50 text-indigo-600' };
}

export default function TemplateRolloutsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Rollout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('UTILITY');
  const [language, setLanguage] = useState('en_US');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/admin/api/template-rollouts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load rollouts');
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createDraft() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/admin/api/template-rollouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category, language: language.trim() || 'en_US' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create.');
      router.push(`/admin/template-rollouts/${data.row.id}`);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Lead Funnel
        </Link>

        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Template Rollouts</h1>
            <p className="text-sm text-slate-500 mt-1">Every approved-template send starts here - name it, submit it to Meta, wait for approval, then pick where it lives.</p>
          </div>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
            <Plus size={14} /> New Template
          </button>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">No templates started yet - click "New Template" to begin one.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Lane</th>
                    <th className="px-4 py-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const status = STATUS_STYLES[row.status];
                    const lane = laneLabel(row);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => router.push(`/admin/template-rollouts/${row.id}`)}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-bold text-slate-800">{row.name}</td>
                        <td className="px-4 py-3 text-slate-500">{row.category} <span className="text-slate-300">&middot;</span> {row.language}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${status.className}`}>{status.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {lane && <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${lane.className}`}>{lane.label}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(row.created_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md overflow-hidden">
            <div className="flex items-start justify-between px-6 pt-6 pb-1">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">New template</h3>
                <p className="text-[13px] text-slate-400 mt-0.5">Step 1 of the rollout - name and category. You'll write the body next.</p>
              </div>
              <button onClick={() => setShowNew(false)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={13} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Template name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="session_reminder_48h"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">Lowercase letters, numbers, underscores only - matches what Meta requires.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400">
                  <option value="UTILITY">Utility - transactional, account-related</option>
                  <option value="MARKETING">Marketing - promotional, requires opt-in</option>
                  <option value="AUTHENTICATION">Authentication - one-time codes</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Language code</label>
                <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="en_US" className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400" />
              </div>
              {createError && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{createError}</div>}
            </div>
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                onClick={createDraft}
                disabled={creating || !name.trim()}
                className="w-full py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : 'Start'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
