'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AhaCard } from '@/content/labs/types';
import s from '@/app/labs/[slug]/rad-lab.module.css';
import { Rich } from './Rich';
import { Shot } from './Shot';
import { EditSlot } from './EditSlot';

// "You've been using this your whole life" cards. Native scroll-snap does
// the real work (touch/trackpad/keyboard all just scroll). Floating arrow
// buttons sit over the track's edges and only appear when there's another
// card in that direction, so it's obvious there's more to see - and they
// double as the way to page on a mouse without a trackpad.
export function AhaCarousel({ cards }: { cards: AhaCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    setCanPrev(t.scrollLeft > 4);
    setCanNext(t.scrollLeft + t.clientWidth < t.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(sync);
    window.addEventListener('resize', sync);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', sync); };
  }, [sync, cards.length]);

  const page = (dir: 1 | -1) => {
    const t = trackRef.current;
    const first = t?.firstElementChild as HTMLElement | null;
    if (!t || !first) return;
    // One card (+ gap) per click so snap lands cleanly.
    t.scrollBy({ left: dir * (first.offsetWidth + 16), behavior: 'smooth' });
  };

  return (
    <div className={s.ahaStage}>
      <div ref={trackRef} className={s.ahaTrack} onScroll={sync} role="list">
        {cards.map((card, i) => (
          <article key={i} className={`${s.ahaCard} ${s.editable}`} role="listitem" tabIndex={0} aria-label={card.title}>
            <EditSlot target={{ section: 'ahaCard', index: i }} label={`card ${i + 1}`} />
            <Shot shot={card.image} label={`Image · Card ${String(i + 1).padStart(2, '0')}`} sizes="(max-width: 640px) 82vw, 360px" />
            <div className={s.ahaBody}>
              <div className={s.ahaTypeRow}>
                <span className={`${s.ahaType} ${card.kind === 'unplugged' ? s.ahaUnplugged : s.ahaTech}`}>
                  {card.kind === 'unplugged' ? '🌿 Unplugged' : '💻 Tech'}
                </span>
                {card.concept && <span className={s.ahaConcept}>{card.concept}</span>}
              </div>
              <h3 className={s.ahaTitle}>{card.title}</h3>
              <p className={s.ahaText}><Rich text={card.body} /></p>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        className={`${s.ahaArrow} ${s.ahaArrowPrev} ${canPrev ? s.ahaArrowOn : ''}`}
        onClick={() => page(-1)}
        aria-label="Previous example"
        tabIndex={canPrev ? 0 : -1}
        aria-hidden={!canPrev}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className={`${s.ahaArrow} ${s.ahaArrowNext} ${canNext ? s.ahaArrowOn : ''}`}
        onClick={() => page(1)}
        aria-label="Next example"
        tabIndex={canNext ? 0 : -1}
        aria-hidden={!canNext}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
