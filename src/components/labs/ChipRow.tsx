'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { LabChip } from '@/content/labs/types';
import s from '@/app/labs/[slug]/rad-lab.module.css';
import { Rich } from './Rich';

// Header chips (time / age / platform / hardware). A chip with `info` is a
// button: hover or keyboard focus shows its tooltip on desktop, a tap
// toggles it on touch. The ⓘ glyph is the touch affordance - there's no
// hover on a phone, so the chip has to look tappable on its own. One tooltip
// open at a time; Esc or a tap elsewhere closes it.
export function ChipRow({ chips }: { chips: LabChip[] }) {
  const uid = useId();
  const [open, setOpen] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: PointerEvent) => { if (!rowRef.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Keep the tooltip within the chip row's edges (chips near the right on a
  // phone). Measured against the row, not window.innerWidth - on mobile an
  // overflowing tooltip inflates the layout viewport, so the window can't be
  // trusted as the boundary.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const row = rowRef.current;
    if (!tip || !row) return;
    tip.style.setProperty('--shift', '0px');
    const r = tip.getBoundingClientRect();
    const bounds = row.getBoundingClientRect();
    let dx = 0;
    if (r.right > bounds.right) dx = bounds.right - r.right;
    if (r.left + dx < bounds.left) dx = bounds.left - r.left;
    tip.style.setProperty('--shift', `${dx}px`);
  }, [open]);

  return (
    <div ref={rowRef} className={s.chipRow}>
      {chips.map((c, i) => {
        const cls = `${s.chip} ${c.platform ? s.chipPlatform : ''}`;
        if (!c.info) {
          return <span key={i} className={cls}><span aria-hidden="true">{c.icon}</span> {c.label}</span>;
        }
        const tipId = `${uid}-tip-${i}`;
        const isOpen = open === i;
        return (
          <span key={i} className={s.chipWrap}>
            <button
              type="button"
              className={`${cls} ${s.chipButton}`}
              aria-describedby={isOpen ? tipId : undefined}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              onPointerEnter={e => { if (e.pointerType === 'mouse') setOpen(i); }}
              onPointerLeave={e => { if (e.pointerType === 'mouse') setOpen(o => (o === i ? null : o)); }}
              onFocus={e => { if (e.currentTarget.matches(':focus-visible')) setOpen(i); }}
              onBlur={() => setOpen(o => (o === i ? null : o))}
            >
              <span aria-hidden="true">{c.icon}</span> {c.label}
              <span className={s.chipInfoIcon} aria-hidden="true">i</span>
            </button>
            {isOpen && (
              <span
                ref={tipRef}
                id={tipId}
                role="tooltip"
                className={s.tooltip}
              >
                <Rich text={c.info} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
