"use client";

import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { TrackedLink } from "./Tracked";
import s from "./home.module.css";

// Returning visitors who knew the old homepage can switch back to it at
// /classic. Dismissal is remembered per browser; storage can be blocked
// (private mode), so every access is guarded and local state still closes
// the notice for this visit.
const KEY = "rad-classic-notice";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function wasDismissed() {
  try {
    return localStorage.getItem(KEY) === "dismissed";
  } catch {
    return false;
  }
}

export default function ClassicNotice() {
  const stored = useSyncExternalStore(subscribe, wasDismissed, () => false);
  const [closed, setClosed] = useState(false);

  function dismiss() {
    setClosed(true);
    try {
      localStorage.setItem(KEY, "dismissed");
    } catch {}
  }

  return (
    <AnimatePresence initial={false}>
      {!stored && !closed && (
        <motion.div
          className={s.notice}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={`${s.wrap} ${s.noticeIn}`}>
            <span>Our homepage has a new look. Prefer the old one?</span>
            <TrackedLink className={s.link} href="/classic" event="home_classic_click" eventProps={{ source: "notice" }}>
              Open the classic homepage
            </TrackedLink>
            <button className={s.noticeX} type="button" onClick={dismiss} aria-label="Dismiss">
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
