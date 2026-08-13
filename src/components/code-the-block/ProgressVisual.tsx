"use client";

import { motion } from "framer-motion";
import type { Track } from "@/lib/code-the-block/content/types";
import { TRACK_THEME, type TrackTheme } from "@/lib/code-the-block/theme";

const FRAME = "flex h-28 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-900 to-slate-800";

function BuildVisual({ stage, theme }: { stage: number; theme: TrackTheme }) {
  return (
    <div className={`${FRAME} relative flex-col-reverse !justify-start`}>
      <div className="h-4 w-full flex-none bg-[#3f6212]/70" />
      {stage === 0 && (
        <motion.div
          initial={false}
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-6 flex h-14 w-20 flex-none items-center justify-center rounded-md border-2 border-dashed border-white/25 text-lg"
        >
          🧱
        </motion.div>
      )}
      <motion.div
        initial={false}
        animate={{ height: stage >= 1 ? 40 : 0 }}
        transition={{ type: "spring", bounce: 0.25 }}
        className="w-20 flex-none border-x-4"
        style={{ backgroundColor: "#92562f", borderColor: "#5c3317" }}
      />
      <motion.div
        initial={false}
        animate={{ height: stage >= 2 ? 22 : 0 }}
        transition={{ type: "spring", bounce: 0.25, delay: 0.1 }}
        className="w-28 flex-none rounded-t-lg"
        style={{ backgroundColor: theme.primary }}
      />
      {stage >= 2 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="pb-1 text-xl">
          🚩
        </motion.div>
      )}
    </div>
  );
}

function GameVisual({ stage, theme }: { stage: number; theme: TrackTheme }) {
  const pct = stage === 0 ? 8 : stage === 1 ? 55 : 100;
  return (
    <div className={`${FRAME} flex-col gap-3 px-4`}>
      <div className="flex items-center gap-2">
        <motion.span
          animate={stage >= 1 ? { y: [0, -4, 0] } : {}}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="text-2xl"
        >
          🎮
        </motion.span>
        <div className="flex gap-1">
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              initial={false}
              animate={{ scale: stage > i ? 1 : 0.6, opacity: stage > i ? 1 : 0.25 }}
              className="text-lg"
            >
              ⭐
            </motion.span>
          ))}
        </div>
      </div>
      <div className="h-2.5 w-full max-w-[180px] overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", bounce: 0.2 }}
          className="h-full rounded-full"
          style={{ backgroundColor: theme.primary }}
        />
      </div>
    </div>
  );
}

function StoryVisual({ stage, theme }: { stage: number; theme: TrackTheme }) {
  return (
    <div className={`${FRAME} gap-3 px-6`}>
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          initial={false}
          animate={{
            scale: stage > i ? 1 : 0.7,
            opacity: stage > i ? 1 : 0.3,
            boxShadow: stage > i ? `0 0 12px ${theme.glow}` : "none",
          }}
          className="h-3 w-3 flex-none rounded-full"
          style={{ backgroundColor: theme.primary }}
        />
      ))}
      <div className="h-px w-8 flex-none bg-white/15" />
      <motion.div
        initial={false}
        animate={{ scale: stage === 2 ? 1.15 : 0.9, opacity: stage === 2 ? 1 : 0.4 }}
        className="text-3xl"
      >
        🏕️
      </motion.div>
    </div>
  );
}

function PatternVisual({ stage, theme }: { stage: number; theme: TrackTheme }) {
  const filled = stage === 0 ? 0 : stage === 1 ? 4 : 8;
  return (
    <div className={FRAME}>
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{
              backgroundColor: i < filled ? (i % 2 === 0 ? theme.primary : theme.accent) : "rgba(255,255,255,0.06)",
              scale: i < filled ? 1 : 0.85,
            }}
            transition={{ delay: i * 0.03 }}
            className="h-6 w-6 rounded-[3px]"
          />
        ))}
      </div>
    </div>
  );
}

export function ProgressVisual({
  moduleId,
  stage,
  track,
}: {
  moduleId: string;
  stage: number;
  track: Track;
}) {
  const theme = TRACK_THEME[track];

  switch (moduleId) {
    case "build":
      return <BuildVisual stage={stage} theme={theme} />;
    case "game":
      return <GameVisual stage={stage} theme={theme} />;
    case "story":
      return <StoryVisual stage={stage} theme={theme} />;
    case "pattern":
      return <PatternVisual stage={stage} theme={theme} />;
    default:
      return null;
  }
}
