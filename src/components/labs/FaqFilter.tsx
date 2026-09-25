'use client';

import { useState } from 'react';
import type { FaqScope } from '@/content/labs/types';
import type { ScopedFaq } from '@/content/labs';
import s from '@/app/labs/[slug]/rad-lab.module.css';
import { Rich } from './Rich';

const PIP: Record<FaqScope, string> = { global: s.pipGlobal, series: s.pipSeries, lab: s.pipLab };

export function FaqFilter({ faqs, seriesName }: { faqs: ScopedFaq[]; seriesName: string }) {
  const [scope, setScope] = useState<'all' | FaqScope>('all');
  const filters: { key: 'all' | FaqScope; label: string }[] = [
    { key: 'all', label: 'All questions' },
    { key: 'lab', label: 'This lab' },
    { key: 'series', label: `${seriesName} series` },
    { key: 'global', label: 'About RAD Labs' },
  ];
  const count = (k: 'all' | FaqScope) => (k === 'all' ? faqs.length : faqs.filter(f => f.scope === k).length);

  return (
    <>
      <div className={s.faqFilters} role="group" aria-label="Filter questions">
        {filters.filter(f => count(f.key) > 0).map(f => (
          <button key={f.key} type="button" className={s.faqFilter} aria-pressed={scope === f.key} onClick={() => setScope(f.key)}>
            {f.key !== 'all' && <span className={`${s.pip} ${PIP[f.key]}`} style={{ marginTop: 0 }} aria-hidden="true" />}
            {f.label}
            <span className={s.faqFilterCount}>{count(f.key)}</span>
          </button>
        ))}
      </div>
      <div className={s.faqList}>
        {faqs.map((f, i) => (
          <details key={i} className={s.faqItem} hidden={scope !== 'all' && f.scope !== scope}>
            <summary>
              <span className={s.faqQ}>
                <span className={`${s.pip} ${PIP[f.scope]}`} aria-hidden="true" />
                {f.q}
              </span>
              <span className={s.chevron} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </summary>
            <p className={s.faqA}><Rich text={f.a} /></p>
          </details>
        ))}
      </div>
    </>
  );
}
