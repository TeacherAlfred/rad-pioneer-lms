"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { requestHelp, cancelHelp } from "@/app/code-the-block/actions";

export function HelpButton({
  initialNeedsHelp,
  moduleTitle,
  trackLabel,
}: {
  initialNeedsHelp: boolean;
  moduleTitle: string;
  trackLabel: string;
}) {
  const [active, setActive] = useState(initialNeedsHelp);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !active;
    setActive(next);
    startTransition(() => {
      if (next) {
        requestHelp(moduleTitle, trackLabel).catch(() => setActive(!next));
      } else {
        cancelHelp().catch(() => setActive(!next));
      }
    });
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black shadow-xl transition-colors disabled:opacity-70"
      style={{
        backgroundColor: active ? "#b83b3c" : "rgba(15, 23, 42, 0.85)",
        color: "#ffffff",
        border: active ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
      }}
      animate={active ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={active ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" } : {}}
    >
      <span className="text-base">🆘</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={active ? "active" : "idle"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="hidden sm:inline"
        >
          {active ? "Help is on the way!" : "I need help"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
