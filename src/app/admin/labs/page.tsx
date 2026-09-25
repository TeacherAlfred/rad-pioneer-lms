'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SERIES } from '@/content/labs';

// RAD Labs admin index: every lab (database + seed files) with its publish
// state, and a quick "new lab" form that drops you straight into the
// in-place editor with a fully laid-out starter page.

type Row = {
  slug: string;
  title: string;
  seriesKey: string;
  labNumber: number;
  state: 'live' | 'live_with_draft' | 'draft_only' | 'seed';
  updatedAt: string | null;
  updatedBy: string | null;
};

const STATE: Record<Row['state'], { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'bg-emerald-100 text-emerald-800' },
  live_with_draft: { label: 'Live · draft pending', cls: 'bg-violet-100 text-violet-800' },
  draft_only: { label: 'Draft · not published', cls: 'bg-amber-100 text-amber-800' },
  seed: { label: 'Live · from code', cls: 'bg-sky-100 text-sky-800' },
};

const pad = (n: number) => String(n).padStart(2, '0');

export default function AdminLabsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seriesKey, setSeriesKey] = useState(SERIES[0].key);
  const [labNumber, setLabNumber] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/admin/api/labs', { cache: 'no-store' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!alive) return; if (ok) setRows(d.rows); else setError(d.error || 'Could not load labs.'); })
      .catch(() => alive && setError('Could not load labs.'));
    return () => { alive = false; };
  }, []);

  const nextNumber = (key: string) => Math.max(0, ...(rows || []).filter(r => r.seriesKey === key).map(r => r.labNumber)) + 1;
  const num = labNumber || String(nextNumber(seriesKey));
  const slugPreview = `${seriesKey}-${pad(Number(num) || 1)}`;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch('/admin/api/labs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesKey, labNumber: Number(num), title }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) { setCreateError(data.error || 'Could not create the lab.'); return; }
    router.push(`/admin/labs/${data.slug}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600">Content</p>
            <h1 className="text-3xl font-bold tracking-tight">RAD Labs</h1>
            <p className="mt-1 text-[14px] text-slate-600">Free weekly labs at <code className="rounded bg-slate-200/70 px-1">/labs/…</code>. Open a lab to edit it in place, exactly as visitors see it.</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {error && <p className="p-6 text-sm text-red-700">{error}</p>}
          {!rows && !error && <p className="p-6 text-sm text-slate-500">Loading…</p>}
          {rows && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No labs yet.</p>}
          {rows && rows.length > 0 && (
            <table className="w-full text-left text-[14px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Lab</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="hidden px-5 py-3 md:table-cell">Last saved</th>
                  <th className="px-5 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.slug} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-[12px] text-slate-500">{SERIES.find(s => s.key === r.seriesKey)?.name ?? r.seriesKey} · Lab {pad(r.labNumber)} · /labs/{r.slug}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATE[r.state].cls}`}>{STATE[r.state].label}</span>
                    </td>
                    <td className="hidden px-5 py-3.5 text-[12px] text-slate-500 md:table-cell">
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      {r.updatedBy ? <div>{r.updatedBy}</div> : null}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        {r.state !== 'draft_only' && (
                          <a href={`/labs/${r.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">View ↗</a>
                        )}
                        <Link href={`/admin/labs/${r.slug}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-slate-700">Edit</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form onSubmit={create} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">New lab</h2>
          <p className="mt-1 text-[13px] text-slate-600">Starts as a private draft with every section laid out and placeholder text to replace.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_110px_2fr]">
            <label className="text-[12px] font-semibold text-slate-700">
              Series
              <select className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] font-normal" value={seriesKey} onChange={e => { setSeriesKey(e.target.value); setLabNumber(''); }}>
                {SERIES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              Lab no.
              <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] font-normal" inputMode="numeric" value={num} onChange={e => setLabNumber(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="text-[12px] font-semibold text-slate-700">
              Working title
              <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] font-normal" placeholder="e.g. Light It Up: Your First LED Pattern" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-slate-500">Address: <code className="rounded bg-slate-100 px-1">/labs/{slugPreview}</code></p>
            <button type="submit" disabled={creating || !title.trim()} className="rounded-lg bg-violet-600 px-4 py-2 text-[14px] font-semibold text-white hover:bg-violet-700 disabled:opacity-40">
              {creating ? 'Creating…' : 'Create & start editing →'}
            </button>
          </div>
          {createError && <p className="mt-3 text-[13px] text-red-700">{createError}</p>}
        </form>
      </div>
    </div>
  );
}
