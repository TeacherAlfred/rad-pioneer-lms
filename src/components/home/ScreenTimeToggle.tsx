"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import s from "./home.module.css";

// Phones get a segmented control between the two lists; desktop shows both
// side by side (CSS hides the control and un-hides the inactive list).
const TABS = [
  { id: "then", label: "Most screen time" },
  { id: "now", label: "At RAD" },
] as const;

export default function ScreenTimeToggle() {
  const [on, setOn] = useState<0 | 1>(1);

  return (
    <>
      <div className={s.seg} role="tablist" aria-label="Compare screen time">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`seg-${t.id}`}
            aria-selected={on === i}
            aria-controls={`side-${t.id}`}
            className={`${s.segBtn} ${on === i ? s.segOn : ""}`}
            onClick={() => setOn(i as 0 | 1)}
          >
            {on === i && (
              <motion.span layoutId="seg-thumb" className={s.segThumb} transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className={s.segLabel}>{t.label}</span>
          </button>
        ))}
      </div>
      <div className={s.versus}>
        <div className={`${s.side} ${s.then} ${on === 0 ? "" : s.sideHidden}`} id="side-then" role="tabpanel" aria-labelledby="seg-then">
          <h3>Most screen time</h3>
          <ul>
            <li>Playing games someone else made.</li>
            <li>Watching how things work.</li>
            <li>Hours gone, nothing to show.</li>
          </ul>
        </div>
        <div className={`${s.side} ${s.now} ${on === 1 ? "" : s.sideHidden}`} id="side-now" role="tabpanel" aria-labelledby="seg-now">
          <h3>At RAD</h3>
          <ul>
            <li><span>Coding</span> the game they want to make.</li>
            <li><span>Building</span> gadgets that light up and move.</li>
            <li><span>Leaving</span> with something that works.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
