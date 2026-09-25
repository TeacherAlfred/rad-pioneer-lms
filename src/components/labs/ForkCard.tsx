'use client';

import { useEffect, useId, useState } from 'react';
import s from '@/app/labs/[slug]/rad-lab.module.css';

// One "Where does your child go from here?" card. Side by side (wide
// screens) it's a plain card, all cards stretched to equal height. The
// moment the grid stacks (STACKED_QUERY - kept in step with the
// .forkGrid breakpoint in rad-lab.module.css) each card collapses to a
// closed drawer showing just its heading; tapping the heading opens it.
//
// Visibility is driven by CSS off data-open, so there's no flash of open
// content on phones before hydration; JS only keeps ARIA truthful.
export const STACKED_QUERY = '(max-width: 719px)';

export function ForkCard({
  title, badge, variant = 'plain', children,
}: {
  title: string;
  badge?: React.ReactNode;
  variant?: 'plain' | 'featured' | 'book' | 'ghost';
  children: React.ReactNode;
}) {
  const bodyId = useId();
  const [stacked, setStacked] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(STACKED_QUERY);
    const sync = () => setStacked(mq.matches);
    const id = requestAnimationFrame(sync);
    mq.addEventListener('change', sync);
    return () => { cancelAnimationFrame(id); mq.removeEventListener('change', sync); };
  }, []);

  const variantClass = { plain: '', featured: s.fcardFeatured, book: s.fcardBook, ghost: s.fcardGhost }[variant];
  const expanded = !stacked || open;

  return (
    <div className={`${s.fcard} ${variantClass}`} data-open={open ? 'true' : 'false'}>
      <h3 className={s.fcardHeading}>
        <button
          type="button"
          className={s.fcardToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          tabIndex={stacked ? 0 : -1}
          onClick={() => stacked && setOpen(o => !o)}
        >
          <span className={s.fcardToggleText}>
            {badge}
            <span className={s.fcardTitle}>{title}</span>
          </span>
          <span className={s.fcardChevron} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </button>
      </h3>
      <div id={bodyId} className={s.fcardContent}>
        {children}
      </div>
    </div>
  );
}
