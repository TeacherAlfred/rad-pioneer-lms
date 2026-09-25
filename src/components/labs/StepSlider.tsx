'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LabStep } from '@/content/labs/types';
import s from '@/app/labs/[slug]/rad-lab.module.css';
import { Rich } from './Rich';
import { Shot } from './Shot';
import { EditSlot } from './EditSlot';

// Zone 4 walkthrough. All panels are server-renderable content (readable
// without JS); the client adds slide navigation, swipe, keyboard, a
// remembered position per device, and announces steps to screen readers.
// Broadcasts the active step on `radlab:step` so the help sheet can tell
// us where the child got stuck.

export const STEP_EVENT = 'radlab:step';
export const GOTO_STEP_EVENT = 'radlab:goto-step';

const pad = (n: number) => String(n).padStart(2, '0');

export function StepSlider({ slug, steps, nextSectionId }: { slug: string; steps: LabStep[]; nextSectionId: string }) {
  const total = steps.length;
  const storageKey = `radlab:${slug}:step`;
  const [rawCur, setCur] = useState(0);
  // Clamped: in the admin editor steps can be deleted from under us.
  const cur = Math.min(rawCur, Math.max(0, total - 1));
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [instant, setInstant] = useState(true); // no slide animation on first paint / restore
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Restore last position on this device.
  // localStorage is an external store, so read it in a frame callback
  // after hydration (server render always starts at step 1).
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      try {
        const saved = Number(localStorage.getItem(storageKey));
        if (Number.isInteger(saved) && saved > 0 && saved < total) {
          setCur(saved);
          setVisited(new Set(Array.from({ length: saved + 1 }, (_, i) => i)));
          setResumedAt(saved);
        }
      } catch { /* storage blocked - start at step 1 */ }
      second = requestAnimationFrame(() => setInstant(false));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [storageKey, total]);

  // Keep the viewport height matched to the active panel (content and
  // images can change height after load, hence the observer).
  useLayoutEffect(() => {
    const panel = panelRefs.current[cur];
    const viewport = viewportRef.current;
    if (!panel || !viewport) return;
    const sync = () => { viewport.style.height = `${panel.offsetHeight}px`; };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(panel);
    return () => ro.disconnect();
  }, [cur]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(STEP_EVENT, { detail: { index: cur, title: steps[cur]?.title } }));
  }, [cur, steps]);

  const goTo = useCallback((n: number, opts: { scroll?: boolean } = {}) => {
    if (n < 0 || n >= total) return;
    setCur(n);
    setVisited(v => new Set(v).add(n));
    try { localStorage.setItem(storageKey, String(n)); } catch { /* ignore */ }
    // On small screens the slider head can scroll off while reading a long
    // step - bring it back so the new step starts at its heading.
    if (opts.scroll !== false && rootRef.current) {
      const top = rootRef.current.getBoundingClientRect().top;
      if (top < 56) rootRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [total, storageKey]);

  // The admin editor jumps the preview to a step it just added or moved.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const i = Number((e as CustomEvent).detail?.index);
      if (Number.isInteger(i)) setCur(i);
    };
    window.addEventListener(GOTO_STEP_EVENT, onGoto);
    return () => window.removeEventListener(GOTO_STEP_EVENT, onGoto);
  }, []);

  const restart = () => { setResumedAt(null); setVisited(new Set([0])); goTo(0); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(cur + 1, { scroll: false }); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(cur - 1, { scroll: false }); }
  };

  // Horizontal swipe only - axis-locked so vertical page scrolling on a
  // phone never flips a step by accident.
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) goTo(dx < 0 ? cur + 1 : cur - 1);
  };

  const isLast = cur === total - 1;
  const finish = () => {
    try { localStorage.setItem(`radlab:${slug}:done`, '1'); } catch { /* ignore */ }
    document.getElementById(nextSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      ref={rootRef}
      className={s.slider}
      role="region"
      aria-roledescription="step-by-step walkthrough"
      aria-label="Lab walkthrough"
      onKeyDown={onKeyDown}
    >
      <div className={s.progress} aria-hidden="true">
        <div className={s.progressFill} style={{ width: `${((cur + 1) / total) * 100}%` }} />
      </div>

      <div className={s.sliderHead}>
        <div className={s.stepMeta}>
          <span className={s.stepCounter}>Step {cur + 1} of {total}</span>
          <h3 className={s.stepHeading} aria-live="polite">{steps[cur].title}</h3>
        </div>
        <nav className={s.stepTabs} aria-label="Jump to step">
          {steps.map((step, i) => (
            <button
              key={i}
              type="button"
              aria-current={i === cur ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${step.title}`}
              className={`${s.stab} ${i === cur ? s.stabActive : visited.has(i) ? s.stabDone : ''}`}
              onClick={() => goTo(i, { scroll: false })}
            >
              {visited.has(i) && i !== cur ? '✓' : pad(i + 1)}
            </button>
          ))}
        </nav>
      </div>

      {resumedAt !== null && cur === resumedAt && (
        <div className={s.resume}>
          <span>Welcome back — you were on step {resumedAt + 1}.</span>
          <button type="button" className={s.linkBtn} onClick={restart}>Start over</button>
        </div>
      )}

      <div ref={viewportRef} className={s.viewport} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className={s.track}
          style={{ transform: `translateX(-${cur * 100}%)`, transition: instant ? 'none' : undefined }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              ref={el => { panelRefs.current[i] = el; }}
              className={`${s.panel} ${s.editable}`}
              inert={i !== cur}
              aria-hidden={i !== cur}
            >
              <EditSlot target={{ section: 'step', index: i }} label={`step ${i + 1}`} />
              <p className={s.stepText}><Rich text={step.body} /></p>
              <Shot shot={step.screenshot} label={`Screenshot · Step ${pad(i + 1)}`} />
              {step.callout && (
                <div className={s.callout}>
                  <span className={s.calloutIcon} aria-hidden="true">💡</span>
                  <span><Rich text={step.callout} /></span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={s.sliderFoot}>
        <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => goTo(cur - 1)} disabled={cur === 0}>
          ← Back
        </button>
        <div className={s.dots} aria-hidden="true">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={`${s.dot} ${i === cur ? s.dotActive : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        {isLast ? (
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={finish}>
            I did it ✓
          </button>
        ) : (
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => goTo(cur + 1)}>
            {cur === total - 2 ? 'Final step →' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );
}
