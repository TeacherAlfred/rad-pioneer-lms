'use client';

import { useEffect, useState } from 'react';
import type { Faq } from '@/content/labs/types';
import { RichField, TextField } from './LabFields';

// "Shared FAQs" panel on /admin/labs: the questions that appear on many labs
// at once - "All labs" (every lab) and one group per series. Each tab keeps
// its own unsaved edits, so switching tabs never loses work; Save publishes
// that group to every lab page straight away.

type Bucket = { key: string; label: string; hint: string; items: Faq[]; saved: boolean; updatedAt: string | null; updatedBy: string | null };

export function SharedFaqsPanel() {
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Faq[]>>({});
  const [active, setActive] = useState<string>('global');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/admin/api/lab-shared-faqs', { cache: 'no-store' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok) { setLoadError(d.error || 'Could not load shared FAQs.'); return; }
        setBuckets(d.buckets);
        setDrafts(Object.fromEntries(d.buckets.map((b: Bucket) => [b.key, b.items])));
      })
      .catch(() => alive && setLoadError('Could not load shared FAQs.'));
    return () => { alive = false; };
  }, []);

  const isDirty = (b: Bucket) => JSON.stringify(drafts[b.key] ?? []) !== JSON.stringify(b.items);
  const anyDirty = !!buckets?.some(isDirty);

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  if (loadError) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Shared FAQs</h2>
        <p className="mt-2 text-[13px] text-red-700">{loadError}</p>
        <p className="mt-1 text-[12px] text-slate-500">If this mentions <code>lab_shared_faqs</code>, the migration <code>20260925150000_lab_shared_faqs.sql</code> hasn&apos;t been applied yet. The public pages keep showing the built-in questions meanwhile.</p>
      </section>
    );
  }
  if (!buckets) {
    return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading shared FAQs…</section>;
  }

  const bucket = buckets.find(b => b.key === active) ?? buckets[0];
  const items = drafts[bucket.key] ?? [];
  const setItems = (fn: (list: Faq[]) => Faq[]) => {
    setDrafts(d => ({ ...d, [bucket.key]: fn([...(d[bucket.key] ?? [])]) }));
    setFlash(null);
  };
  const move = (i: number, dir: -1 | 1) => setItems(list => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    [list[i], list[j]] = [list[j], list[i]];
    return list;
  });

  const save = async () => {
    if (!window.confirm(`Publish the "${bucket.label}" questions? They update on every matching lab page straight away.`)) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch('/admin/api/lab-shared-faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: bucket.key, items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFlash({ ok: false, text: data.error || 'Save failed.' }); return; }
      setBuckets(bs => bs!.map(b => (b.key === bucket.key ? { ...b, items, saved: true, updatedAt: data.updatedAt } : b)));
      setFlash({ ok: true, text: 'Published. Lab pages update within a few seconds.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 pt-6">
        <h2 className="text-lg font-bold">Shared FAQs</h2>
        <p className="mt-1 text-[13px] text-slate-600">Questions that appear on many labs at once. Each lab&apos;s own “This lab” questions are edited inside that lab.</p>
        <div className="mt-4 flex gap-1 overflow-x-auto" role="tablist">
          {buckets.map(b => (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={b.key === bucket.key}
              onClick={() => { setActive(b.key); setFlash(null); }}
              className={`relative shrink-0 rounded-t-lg border-b-2 px-3.5 py-2 text-[13px] font-semibold transition ${b.key === bucket.key ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {b.label}
              <span className="ml-1.5 text-[11px] font-normal text-slate-400">{(drafts[b.key] ?? []).length}</span>
              {isDirty(b) && <span className="absolute right-1 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="unsaved changes" />}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-6 py-5" role="tabpanel">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
          <span>{bucket.hint}</span>
          <span>
            {bucket.saved
              ? `Last published ${bucket.updatedAt ? new Date(bucket.updatedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : ''}${bucket.updatedBy ? ` by ${bucket.updatedBy}` : ''}`
              : 'Showing the built-in questions — not edited yet'}
          </span>
        </div>

        {items.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">No questions in this group. Publishing an empty group hides it on the lab pages.</p>
        )}

        {items.map((f, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <TextField label={`Question ${i + 1}`} value={f.q} onChange={v => setItems(list => { list[i] = { ...list[i], q: v }; return list; })} maxLength={200} />
            <RichField label="Answer" value={f.a} onChange={v => setItems(list => { list[i] = { ...list[i], a: v }; return list; })} rows={4} hint="Select words, then use the toolbar. Enter for a new line." />
            <div className="flex gap-3 text-[12px] font-semibold">
              <button type="button" className="text-slate-600 hover:underline disabled:opacity-40" disabled={i === 0} onClick={() => move(i, -1)}>Move up</button>
              <button type="button" className="text-slate-600 hover:underline disabled:opacity-40" disabled={i === items.length - 1} onClick={() => move(i, 1)}>Move down</button>
              <button type="button" className="ml-auto text-red-700 hover:underline" onClick={() => { if (window.confirm('Delete this question?')) setItems(list => list.filter((_, j) => j !== i)); }}>Delete</button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
          onClick={() => setItems(list => [...list, { q: 'New question?', a: 'The answer.' }])}
        >
          + Add question
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-3.5">
        <p className={`text-[13px] ${flash ? (flash.ok ? 'text-emerald-700' : 'text-red-700') : 'text-slate-500'}`}>
          {flash ? flash.text : isDirty(bucket) ? 'Unsaved changes in this group.' : 'No unsaved changes.'}
        </p>
        <div className="flex gap-2">
          {isDirty(bucket) && (
            <button type="button" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-200/60" onClick={() => { setDrafts(d => ({ ...d, [bucket.key]: bucket.items })); setFlash(null); }}>
              Undo changes
            </button>
          )}
          <button type="button" onClick={save} disabled={busy || !isDirty(bucket)} className="rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-40">
            {busy ? 'Publishing…' : 'Save & publish'}
          </button>
        </div>
      </div>
    </section>
  );
}
