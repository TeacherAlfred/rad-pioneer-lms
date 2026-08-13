"use client";

import { useMemo, useState } from "react";
import type { ModuleContent, Track } from "@/lib/code-the-block/content/types";
import { stepId } from "@/lib/code-the-block/content/types";
import { logoutStudent } from "@/app/code-the-block/actions";
import { TRACK_THEME } from "@/lib/code-the-block/theme";
import { ModuleSidebar } from "./ModuleSidebar";
import { TrackToggle } from "./TrackToggle";
import { ModuleStepper } from "./ModuleStepper";
import { ProgressVisual } from "./ProgressVisual";
import { ProgressBar } from "./ProgressBar";
import { HelpButton } from "./HelpButton";

export function WorkbookApp({
  modules,
  studentName,
  initialCompleted,
  initialNeedsHelp,
}: {
  modules: ModuleContent[];
  studentName: string;
  initialCompleted: string[];
  initialNeedsHelp: boolean;
}) {
  const [activeModuleId, setActiveModuleId] = useState(modules[0].id);
  const [trackByModule, setTrackByModule] = useState<Record<string, Track>>(
    Object.fromEntries(modules.map((m) => [m.id, "beginner" as Track]))
  );
  const [completed, setCompleted] = useState<Set<string>>(new Set(initialCompleted));

  const activeModule = modules.find((m) => m.id === activeModuleId) ?? modules[0];
  const activeTrack = trackByModule[activeModuleId] ?? "beginner";

  const doneByModule = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of modules) {
      map[m.id] =
        (completed.has(stepId(m.id, "beginner")) ? 1 : 0) +
        (completed.has(stepId(m.id, "advanced")) ? 1 : 0);
    }
    return map;
  }, [modules, completed]);

  const totalSteps = modules.length * 2;

  function handleToggle(id: string, isCompleted: boolean) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (isCompleted) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="relative min-h-screen bg-slate-950 pb-28 lg:pb-10 lg:pl-24">
      <ModuleSidebar
        modules={modules}
        activeId={activeModuleId}
        onSelect={setActiveModuleId}
        doneByModule={doneByModule}
      />

      <HelpButton
        initialNeedsHelp={initialNeedsHelp}
        moduleTitle={activeModule.title}
        trackLabel={TRACK_THEME[activeTrack].label}
      />

      <div className="mx-auto max-w-2xl px-4 pt-16 sm:px-6">
        <header className="mb-5">
          <h1 className="text-xl font-black text-white">⛏️ Code the Block</h1>
          <p className="text-xs text-slate-500">Hey {studentName}! 👋</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar done={completed.size} total={totalSteps} />
            </div>
            <form action={logoutStudent}>
              <button
                type="submit"
                className="flex-none whitespace-nowrap text-[11px] text-slate-600 hover:text-slate-400"
              >
                switch student
              </button>
            </form>
          </div>
        </header>

        <div className="mb-6 flex justify-center">
          <TrackToggle
            value={activeTrack}
            onChange={(track) =>
              setTrackByModule((prev) => ({ ...prev, [activeModuleId]: track }))
            }
          />
        </div>

        <div className="mb-4 text-center">
          <h2 className="text-2xl font-black text-white">
            {activeModule.icon} {activeModule.title}
          </h2>
          <p className="text-sm text-slate-500">
            {activeModule.subtitle}
            {activeModule.when === "take-home" && (
              <span className="ml-2 rounded-full bg-rad-blue/20 px-2 py-0.5 text-xs font-semibold text-rad-blue">
                🏠 Take-home
              </span>
            )}
          </p>
        </div>

        <div className="mb-6">
          <ProgressVisual
            moduleId={activeModule.id}
            stage={doneByModule[activeModule.id] ?? 0}
            track={activeTrack}
          />
        </div>

        <ModuleStepper
          key={stepId(activeModuleId, activeTrack)}
          module={activeModule}
          track={activeTrack}
          completed={completed.has(stepId(activeModuleId, activeTrack))}
          onCompletedChange={handleToggle}
        />
      </div>
    </div>
  );
}
