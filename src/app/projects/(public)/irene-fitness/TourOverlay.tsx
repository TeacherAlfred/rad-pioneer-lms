'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type TourStep = { targetId: string; title: string; description: ReactNode };

// Step-by-step page tour, ported from the older irene-comrades platform's
// GuideOverlay (src/app/projects/(public)/irene-comrades/page.tsx) - same
// spotlight mechanic (a giant box-shadow "hole" around the target's
// bounding rect, simpler and more robust than real clip-path/portal
// masking), same bottom card with progress dots + Next/Back/Close. Kept
// generic (any `steps` array) rather than fitness-specific, since this is
// meant to be the shared tour shell for other pages too, not a one-off.
export function TourOverlay({
  steps,
  current,
  onNext,
  onPrev,
  onClose,
}: {
  steps: TourStep[];
  current: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const step = steps[current];
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    // Genuinely DOM-measurement-driven, not derivable from props/state: the
    // target's position depends on live layout after a smooth-scroll
    // animation settles, which only exists once this effect runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRect(null);
    const el = document.getElementById(step.targetId);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const t = setTimeout(measure, 400); // let the smooth-scroll mostly settle first
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [step]);

  return (
    <div className="fixed inset-0 z-[70]">
      {rect ? (
        <div
          className="fixed rounded-2xl pointer-events-none transition-all duration-300 border-2 border-[#0066cc]"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.72)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/72" />
      )}

      <div className="fixed bottom-4 left-4 right-4 z-[71] max-w-sm mx-auto bg-white rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#0066cc]">
            Step {current + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-slate-600 -m-1 p-1"
            aria-label="Close guide"
          >
            <X size={16} />
          </button>
        </div>
        <h3 className="text-base font-black text-slate-900 mb-1">{step.title}</h3>
        <div className="text-xs text-slate-600 leading-snug mb-4">{step.description}</div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-[#0066cc]' : 'w-1.5 bg-slate-200'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {current > 0 && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="px-4 py-2 bg-[#0066cc] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors"
            >
              {current === steps.length - 1 ? 'Got it!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
