'use client';

import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';
import h from '@/app/labs/labs-hub.module.css';

// Per-device lab progress for the /labs hub, read from the keys StepSlider
// already writes: `radlab:<slug>:step` (0-based step last viewed) and
// `radlab:<slug>:done` (set by "I did it ✓"). Nothing is stored server-side;
// the server render shows every lab as not started and this fills in after
// hydration.

export type LabRef = { slug: string; total: number; title: string; label: string };
type Status = { kind: 'new' } | { kind: 'progress'; step: number } | { kind: 'done' };

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

// One snapshot string for all requested labs, so the store comparison is a
// cheap string equality and hooks aren't called in a loop.
function useStatuses(labs: { slug: string; total: number }[]): Record<string, Status> {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => labs.map(l => `${read(`radlab:${l.slug}:done`) ?? ''},${read(`radlab:${l.slug}:step`) ?? ''}`).join('|'),
    () => '',
  );
  return useMemo(() => {
    const parts = snapshot ? snapshot.split('|') : [];
    const out: Record<string, Status> = {};
    labs.forEach((l, i) => {
      const [done, step] = (parts[i] ?? ',').split(',');
      const n = Number(step);
      if (done === '1') out[l.slug] = { kind: 'done' };
      else if (step && Number.isInteger(n) && n > 0 && n < l.total) out[l.slug] = { kind: 'progress', step: n };
      else out[l.slug] = { kind: 'new' };
    });
    return out;
  }, [snapshot, labs]);
}

// Footer row of a lab card: progress bar + the right call to action.
export function LabCardProgress({ slug, total }: { slug: string; total: number }) {
  const labs = useMemo(() => [{ slug, total }], [slug, total]);
  const status = useStatuses(labs)[slug] ?? { kind: 'new' };
  const pct = status.kind === 'done' ? 100 : status.kind === 'progress' ? ((status.step + 1) / total) * 100 : 0;

  return (
    <div className={h.cardFoot} data-status={status.kind}>
      <div className={h.cardBar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <div className={h.cardFootRow}>
        <span className={h.cardMeta}>
          {status.kind === 'done' && <><span className={h.doneTick} aria-hidden="true">✓</span>Completed</>}
          {status.kind === 'progress' && <>Step {status.step + 1} of {total}</>}
          {status.kind === 'new' && <>{total} step{total === 1 ? '' : 's'}</>}
        </span>
        <span className={h.cardCta}>
          {status.kind === 'done' ? 'Open again' : status.kind === 'progress' ? 'Continue' : 'Start the lab'}
          <span aria-hidden="true"> →</span>
        </span>
      </div>
    </div>
  );
}

// "Pick up where you left off" - the first lab (in hub order) that's
// started but not finished on this device. Renders nothing otherwise.
export function ResumeBanner({ labs }: { labs: LabRef[] }) {
  const statuses = useStatuses(labs);
  const lab = labs.find(l => statuses[l.slug]?.kind === 'progress');
  if (!lab) return null;
  const st = statuses[lab.slug] as { kind: 'progress'; step: number };
  return (
    <Link href={`/labs/${lab.slug}#walkthrough`} className={h.resume}>
      <span className={h.resumeRing} aria-hidden="true" style={{ ['--p' as string]: (st.step + 1) / lab.total }} />
      <span className={h.resumeText}>
        <span className={h.resumeEyebrow}>Pick up where you left off</span>
        <span className={h.resumeTitle}>{lab.label} · {lab.title}</span>
        <span className={h.resumeSub}>Step {st.step + 1} of {lab.total}</span>
      </span>
      <span className={h.resumeGo}>Continue <span aria-hidden="true">→</span></span>
    </Link>
  );
}
