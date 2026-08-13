"use client";

import { motion } from "framer-motion";
import type { Track } from "@/lib/code-the-block/content/types";
import { TRACK_THEME } from "@/lib/code-the-block/theme";

export function TrackToggle({
  value,
  onChange,
}: {
  value: Track;
  onChange: (track: Track) => void;
}) {
  return (
    <div className="relative mx-auto flex w-fit gap-1 rounded-full border border-white/10 bg-slate-900/70 p-1 shadow-lg backdrop-blur-xl">
      {(["beginner", "advanced"] as const).map((track) => {
        const theme = TRACK_THEME[track];
        const active = value === track;

        return (
          <button
            key={track}
            type="button"
            onClick={() => onChange(track)}
            className="relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors"
          >
            {active && (
              <motion.div
                layoutId="ctb-track-active"
                className="absolute inset-0 -z-10 rounded-full shadow-[0_0_20px_var(--glow)]"
                style={{ backgroundColor: theme.primary, "--glow": theme.glow } as React.CSSProperties}
                transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
              />
            )}
            <span>{theme.icon}</span>
            <span className={active ? "text-white" : "text-slate-400"}>{theme.label}</span>
          </button>
        );
      })}
    </div>
  );
}
