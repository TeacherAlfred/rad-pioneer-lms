"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { ModuleContent, Track } from "@/lib/code-the-block/content/types";
import { stepId } from "@/lib/code-the-block/content/types";
import { TRACK_THEME } from "@/lib/code-the-block/theme";
import { markStepComplete } from "@/app/code-the-block/actions";
import { CodePanel } from "./CodePanel";

type StepKey = "mission" | "plan" | "code" | "challenge";

const TIER_META: Record<1 | 2 | 3, { label: string; icon: string }> = {
  1: { label: "Warm-Up Tweak", icon: "🔧" },
  2: { label: "Level Up", icon: "⚡" },
  3: { label: "Challenge Mode", icon: "🏆" },
};

export function ModuleStepper({
  module,
  track,
  completed,
  onCompletedChange,
}: {
  module: ModuleContent;
  track: Track;
  completed: boolean;
  onCompletedChange: (stepId: string, completed: boolean) => void;
}) {
  const theme = TRACK_THEME[track];
  const content = module.tracks[track];
  const id = stepId(module.id, track);

  const steps: { key: StepKey; label: string; icon: string }[] = [
    { key: "mission", label: "Mission", icon: "🎯" },
    ...(content.instructions.length > 0
      ? ([{ key: "plan", label: "The Plan", icon: "📝" }] as const)
      : []),
    { key: "code", label: "The Code", icon: "💻" },
    { key: "challenge", label: "Your Turn", icon: "🏆" },
  ];

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPending, startTransition] = useTransition();

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  function go(nextIndex: number) {
    setDirection(nextIndex > index ? 1 : -1);
    setIndex(nextIndex);
  }

  function handleComplete() {
    const next = !completed;
    onCompletedChange(id, next);

    if (next) {
      confetti({
        particleCount: 70,
        spread: 75,
        startVelocity: 35,
        origin: { y: 0.65 },
        colors: [theme.primary, theme.accent, "#ffffff"],
      });
    }

    startTransition(() => {
      markStepComplete(id, next).catch(() => onCompletedChange(id, completed));
    });
  }

  return (
    <div>
      {/* Step dots */}
      <div className="mb-5 flex items-center justify-center gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => go(i)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
            style={{
              backgroundColor: i === index ? theme.primary : "transparent",
              color: i === index ? "#ffffff" : i < index ? theme.accent : "#64748b",
            }}
          >
            <span>{s.icon}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step.key}
            custom={direction}
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -40, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {step.key === "mission" && (
              <div className="space-y-4">
                <div
                  className="inline-block rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest"
                  style={{ backgroundColor: theme.primarySoft, color: theme.primary }}
                >
                  Core Concept: {module.coreConcept.name}
                </div>
                <p className="text-slate-300">{module.coreConcept.description}</p>
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Your Mission
                  </div>
                  <p className="text-lg font-semibold text-white">{content.goal}</p>
                </div>
              </div>
            )}

            {step.key === "plan" && (
              <ol className="space-y-3">
                {content.instructions.map((line, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-slate-200">{line}</span>
                  </li>
                ))}
              </ol>
            )}

            {step.key === "code" && <CodePanel code={content.code} />}

            {step.key === "challenge" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {content.tryIts.map((t) => {
                    const meta = TIER_META[t.tier];
                    const isChallenge = t.tier === 3;
                    return (
                      <div
                        key={t.tier}
                        className="rounded-xl border p-4"
                        style={{
                          borderWidth: isChallenge ? 2 : 1,
                          borderColor: isChallenge ? theme.primary : theme.primarySoft,
                          backgroundColor: isChallenge ? theme.primarySoft : "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div
                          className="mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wide"
                          style={{
                            backgroundColor: isChallenge ? theme.primary : theme.primarySoft,
                            color: isChallenge ? "#ffffff" : theme.primary,
                          }}
                        >
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </div>
                        <p className="text-sm text-slate-200">{t.prompt}</p>
                      </div>
                    );
                  })}
                </div>

                {completed ? (
                  <div className="rounded-xl border border-rad-green/40 bg-rad-green/10 p-5 text-center">
                    <div className="text-3xl">🎉</div>
                    <p className="mt-1 font-black text-rad-green">Completed — awesome work!</p>
                    <button
                      type="button"
                      onClick={handleComplete}
                      disabled={isPending}
                      className="mt-2 text-xs font-medium text-slate-500 underline hover:text-slate-300"
                    >
                      Mark as not done
                    </button>
                  </div>
                ) : (
                  <motion.button
                    type="button"
                    onClick={handleComplete}
                    disabled={isPending}
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="w-full rounded-2xl py-4 text-center text-lg font-black text-white shadow-xl transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: theme.primary, boxShadow: `0 10px 30px -5px ${theme.glow}` }}
                  >
                    🎉 Mark Complete!
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Prev / Next */}
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={isFirst}
          className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-opacity disabled:opacity-0"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={isLast}
          className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-opacity disabled:opacity-0"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
