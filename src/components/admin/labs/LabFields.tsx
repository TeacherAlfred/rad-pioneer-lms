'use client';

import { useId, useRef, useState } from 'react';
import type { Screenshot } from '@/content/labs/types';

// Form controls for the lab editor's side panel. Deliberately plain: a
// label, a box, one line of help. The live page beside the panel is the
// real preview.

const labelCls = 'block text-[12px] font-semibold text-slate-700 mb-1.5';
const hintCls = 'mt-1.5 text-[12px] leading-snug text-slate-500';
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200';

export function TextField({
  label, value, onChange, hint, placeholder, maxLength = 200, multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string; maxLength?: number; multiline?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {multiline ? (
        <textarea id={id} className={`${inputCls} min-h-[80px] resize-y`} value={value} maxLength={maxLength} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      ) : (
        <input id={id} className={inputCls} value={value} maxLength={maxLength} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      )}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );
}

// Rich text box. Toolbar wraps the selected words in the tokens <Rich/>
// understands, so the author never has to type markup by hand - but the
// tokens stay visible in the box, which keeps it honest and fixable.
export function RichField({
  label, value, onChange, hint, rows = 5, maxLength = 1500,
}: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number; maxLength?: number;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('https://');
  const [note, setNote] = useState<string | null>(null);

  const wrap = (before: string, after: string, fallback: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = value.slice(a, b) || fallback;
    const next = value.slice(0, a) + before + selected + after + value.slice(b);
    onChange(next);
    setNote(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + selected.length);
    });
  };

  const addLink = () => {
    const clean = url.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(clean)) { setNote('Enter a full web address starting with https://'); return; }
    wrap('[', `](${clean})`, 'link text');
    setLinkOpen(false);
    setUrl('https://');
  };

  const btn = 'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-white hover:shadow-sm';

  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="rounded-lg border border-slate-300 bg-white focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-200">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1 rounded-t-lg">
          <button type="button" className={btn} onClick={() => wrap('**', '**', 'bold text')} title="Bold (**text**)"><b>B</b></button>
          <button type="button" className={btn} onClick={() => wrap('_', '_', 'italic text')} title="Italic (_text_)"><i>I</i></button>
          <button type="button" className={`${btn} text-amber-800`} onClick={() => wrap('==', '==', 'key concept')} title="Highlight a key concept (==text==)">
            <span className="rounded-sm bg-amber-200/80 px-1">Highlight concept</span>
          </button>
          <button type="button" className={btn} onClick={() => setLinkOpen(o => !o)} title="Link ([text](https://…)) - opens in a new tab">↗ Link</button>
        </div>
        {linkOpen && (
          <div className="flex gap-2 border-b border-slate-200 bg-violet-50/60 p-2">
            <input className={`${inputCls} py-1.5`} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} autoFocus aria-label="Link address" />
            <button type="button" className="shrink-0 rounded-md bg-violet-600 px-3 text-[12px] font-semibold text-white hover:bg-violet-700" onClick={addLink}>Add link</button>
          </div>
        )}
        <textarea
          id={id}
          ref={ref}
          rows={rows}
          maxLength={maxLength}
          className="block w-full resize-y rounded-b-lg bg-transparent px-3 py-2 text-[14px] leading-relaxed text-slate-900 focus:outline-none"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      <p className={hintCls}>
        {note ? <span className="text-red-600">{note}</span> : hint ?? 'Select words, then use the toolbar. Highlight is for the ideas you want to stick: loop, event, Boolean condition…'}
      </p>
    </div>
  );
}

export function ImageField({
  label, value, onChange,
}: {
  label: string; value: Screenshot; onChange: (v: Screenshot) => void;
}) {
  const id = useId();
  const src = value.src?.trim() || '';
  const valid = /^https:\/\/\S+/.test(src);
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <legend className="px-1 text-[12px] font-semibold text-slate-700">{label}</legend>
      <div className="flex gap-3">
        <div className="relative h-[72px] w-[104px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {valid ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an arbitrary pasted URL
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-medium uppercase tracking-wider text-slate-400">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={id}
            className={inputCls}
            placeholder="https://pub-….r2.dev/…/image.jpg"
            value={value.src ?? ''}
            onChange={e => onChange({ ...value, src: e.target.value })}
            aria-label={`${label} image link`}
          />
          {src && !valid && <p className="text-[12px] text-red-600">Must be a full https:// link.</p>}
          <select
            className={`${inputCls} py-1.5`}
            value={value.ratio ?? '16/9'}
            onChange={e => onChange({ ...value, ratio: e.target.value as Screenshot['ratio'] })}
            aria-label="Image shape"
          >
            <option value="16/9">Wide (16:9)</option>
            <option value="4/3">Standard (4:3)</option>
          </select>
        </div>
      </div>
      <div className="mt-3">
        <TextField
          label="Describe the image"
          value={value.alt}
          onChange={alt => onChange({ ...value, alt })}
          maxLength={300}
          hint="Read aloud by screen readers. Shown on the placeholder while there's no image, so write what the screenshot should show."
        />
      </div>
    </fieldset>
  );
}

export function ItemActions({
  index, count, noun, onMove, onRemove, onAddAfter,
}: {
  index: number; count: number; noun: string;
  onMove: (dir: -1 | 1) => void; onRemove: () => void; onAddAfter: () => void;
}) {
  const b = 'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white';
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={b} disabled={index === 0} onClick={() => onMove(-1)}>← Move earlier</button>
      <button type="button" className={b} disabled={index === count - 1} onClick={() => onMove(1)}>Move later →</button>
      <button type="button" className={b} onClick={onAddAfter}>+ Add {noun} after</button>
      <button
        type="button"
        className={`${b} text-red-700 hover:border-red-200 hover:bg-red-50`}
        disabled={count <= 1}
        onClick={() => { if (window.confirm(`Delete this ${noun}? You can still discard the draft afterwards.`)) onRemove(); }}
      >
        Delete
      </button>
    </div>
  );
}
