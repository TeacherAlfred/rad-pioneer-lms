'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { LabContent } from '@/content/labs/types';
import type { SharedFaqs } from '@/content/labs';
import { LabView } from '@/components/labs/LabView';
import { LabEditContext, type EditTarget } from '@/components/labs/LabEditContext';
import { SectionPanel, panelTitle } from './SectionPanel';

// WordPress-style in-place editor for one RAD Lab. The real LabView renders
// the working copy; every section carries an Edit button (EditSlot) that
// opens its fields in the side panel, and every keystroke re-renders the
// page - so the author always sees exactly where their words land.
//
// Save draft keeps changes private; Publish makes them live on
// /labs/[slug]. Forms on the preview are inert (see useLabEdit in
// ForkOptIn / HelpSheet).

type Status = { isLive: boolean; hasDraft: boolean; fromSeed: boolean; publishedAt: string | null; updatedAt: string | null; updatedBy: string | null };

export function LabEditor({ slug }: { slug: string }) {
  const [draft, setDraft] = useState<LabContent | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [allLabs, setAllLabs] = useState<LabContent[]>([]);
  const [sharedFaqs, setSharedFaqs] = useState<SharedFaqs | undefined>(undefined);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'discard'>(null);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string; items?: string[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/admin/api/labs/${slug}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setLoadError(data.error || 'Could not load this lab.'); return; }
    setDraft(data.lab);
    setSavedJson(JSON.stringify(data.lab));
    setStatus(data.status);
    setAllLabs(data.allLabs || []);
    setSharedFaqs(data.sharedFaqs);
  }, [slug]);

  useEffect(() => {
    // Fetch-on-mount; state is set in the async callback, not the effect body.
    const id = requestAnimationFrame(() => { load(); });
    return () => cancelAnimationFrame(id);
  }, [load]);

  const dirty = !!draft && JSON.stringify(draft) !== savedJson;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((fn: (d: LabContent) => void) => {
    setDraft(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const persist = useCallback(async (action: 'save' | 'publish' | 'discard') => {
    if (!draft) return;
    if (action === 'publish' && !window.confirm('Publish these changes? They go live on the public lab page straight away.')) return;
    if (action === 'discard' && !window.confirm('Throw away the draft and go back to what\'s live?')) return;
    setBusy(action);
    setFlash(null);
    try {
      const res = await fetch(`/admin/api/labs/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, content: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash({ tone: 'error', text: data.error || 'Something went wrong.', items: data.errors });
        return;
      }
      setStatus(data.status);
      if (action === 'discard') {
        setDraft(data.lab);
        setSavedJson(JSON.stringify(data.lab));
        setTarget(null);
        setFlash({ tone: 'ok', text: 'Draft discarded — you\'re looking at the live version.' });
        return;
      }
      setSavedJson(JSON.stringify(draft));
      if (action === 'publish') setFlash({ tone: 'ok', text: 'Published. The live page updates within a few seconds.' });
      else if (data.warnings?.length) setFlash({ tone: 'warn', text: 'Draft saved. Sort these out before publishing:', items: data.warnings });
      else setFlash({ tone: 'ok', text: 'Draft saved. Nothing is live until you publish.' });
    } finally {
      setBusy(null);
    }
  }, [draft, slug]);

  // Ctrl/Cmd+S saves the draft; Esc closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty && !busy) persist('save'); }
      if (e.key === 'Escape' && target) setTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, busy, persist, target]);

  const editCtx = useMemo(() => ({
    open: (t: EditTarget) => {
      setTarget(t);
      requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('input, textarea, select')?.focus());
    },
  }), []);

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 p-10 text-slate-900">
        <p className="font-semibold">{loadError}</p>
        <Link href="/admin/labs" className="mt-4 inline-block text-violet-700 underline">Back to all labs</Link>
      </div>
    );
  }
  if (!draft || !status) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading lab…</div>;
  }

  const pill = dirty
    ? { text: 'Unsaved changes', cls: 'bg-amber-100 text-amber-800' }
    : status.hasDraft
      ? { text: status.isLive ? 'Live · draft saved' : 'Draft · not published', cls: 'bg-violet-100 text-violet-800' }
      : status.isLive
        ? { text: 'Live', cls: 'bg-emerald-100 text-emerald-800' }
        : { text: 'Not published', cls: 'bg-slate-200 text-slate-700' };

  return (
    <LabEditContext.Provider value={editCtx}>
      <div className="lab-editor min-h-screen bg-slate-50">
        {/* Top bar */}
        <div className="fixed inset-x-0 top-0 z-[80] flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 text-white">
          <Link href="/admin/labs" className="shrink-0 rounded-md px-2 py-1 text-[13px] text-slate-300 hover:bg-white/10 hover:text-white">← All labs</Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{draft.title || 'Untitled lab'}</div>
            <div className="truncate text-[11px] text-slate-400">/labs/{slug}{status.updatedBy ? ` · last saved by ${status.updatedBy}` : ''}</div>
          </div>
          <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline ${pill.cls}`}>{pill.text}</span>
          {status.isLive && (
            <a href={`/labs/${slug}`} target="_blank" rel="noopener noreferrer" className="hidden shrink-0 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-white/10 hover:text-white md:inline">View live ↗</a>
          )}
          {status.hasDraft && !dirty && status.isLive && (
            <button type="button" onClick={() => persist('discard')} disabled={!!busy} className="hidden shrink-0 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50 md:inline">
              {busy === 'discard' ? 'Discarding…' : 'Discard draft'}
            </button>
          )}
          <button type="button" onClick={() => persist('save')} disabled={!dirty || !!busy} className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/10 disabled:opacity-40">
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" onClick={() => persist('publish')} disabled={!!busy || (!dirty && !status.hasDraft && status.isLive)} className="shrink-0 rounded-lg bg-violet-500 px-3.5 py-1.5 text-[13px] font-semibold hover:bg-violet-400 disabled:opacity-40">
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        </div>

        {flash && (
          <div className={`fixed left-1/2 top-16 z-[85] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border px-4 py-3 text-[13px] shadow-lg ${
            flash.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : flash.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-900'
          }`} role="status">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{flash.text}</p>
                {flash.items?.length ? <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{flash.items.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
              </div>
              <button type="button" onClick={() => setFlash(null)} className="text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">×</button>
            </div>
          </div>
        )}

        {/* Live page */}
        <div className={`pt-14 transition-[margin] duration-300 ${target ? 'xl:mr-[440px]' : ''}`}>
          <div className="mx-auto max-w-none">
            <div className="border-b border-violet-200 bg-violet-50 px-4 py-2 text-center text-[12px] text-violet-900">
              Editing mode — hover any section and click <b>Edit</b>. Forms on this preview don&apos;t submit.
            </div>
            <LabView lab={draft} allLabs={allLabs} workshop={null} sharedFaqs={sharedFaqs} editing />
          </div>
        </div>

        {/* Side panel */}
        {target && (
          <aside
            ref={panelRef}
            className="fixed bottom-0 right-0 top-14 z-[75] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[440px]"
            aria-label={`Edit ${panelTitle(target)}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Editing</p>
                <h2 className="text-[17px] font-bold text-slate-900">{panelTitle(target)}</h2>
              </div>
              <button type="button" onClick={() => setTarget(null)} className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-slate-700">Done</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <SectionPanel target={target} draft={draft} update={update} retarget={setTarget} />
            </div>
            <div className="border-t border-slate-200 px-5 py-2.5 text-[11px] text-slate-500">
              Changes show on the page instantly. <kbd className="rounded bg-slate-100 px-1">Ctrl</kbd>+<kbd className="rounded bg-slate-100 px-1">S</kbd> saves a draft.
            </div>
          </aside>
        )}
      </div>
    </LabEditContext.Provider>
  );
}
