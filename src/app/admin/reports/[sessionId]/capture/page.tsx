"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, type RosterLearner, type RunResponse } from "@/lib/reports/client";
import type { AreaScores, Rubric } from "@/lib/reports/types";

type LessonState = "present" | "missed" | "caught_up";
const NEXT_LESSON_STATE: Record<LessonState, LessonState> = { present: "missed", missed: "caught_up", caught_up: "present" };
const LESSON_STYLE: Record<LessonState, string> = {
  present: "bg-white border-slate-200 text-slate-500",
  missed: "bg-rose-50 border-rose-300 text-rose-700",
  caught_up: "bg-emerald-50 border-emerald-300 text-emerald-700",
};

// Teachers fill this in after each session, on a phone: one learner per
// card, tap a level per rubric area, tap a lesson to mark it missed (and
// again once it's been caught up). Every tap saves on its own.
export default function CapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<RunResponse>(`/admin/api/reports/run?sessionId=${sessionId}`).then(setData).catch(e => setError((e as Error).message));
  }, [sessionId]);

  useEffect(() => {
    if (!data || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data]);

  async function setLessons(n: number) {
    if (!data) return;
    // Stepping below 1 clears the count (runs reported in retrospect).
    const lessons = n < 1 ? null : Math.min(60, n);
    setData({ ...data, run: { ...data.run, lessons_planned: lessons } });
    try {
      await api("/admin/api/reports/run", { method: "PATCH", json: { sessionId, lessonsPlanned: lessons } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) return <div className="min-h-screen flex items-center justify-center text-rose-500 text-sm">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  const lessons = data.run.lessons_planned;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-10">
        <Link href={`/admin/reports/${sessionId}`} className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 mb-1 w-fit"><ArrowLeft size={13} /> Roster</Link>
        <h1 className="text-lg font-semibold leading-tight">{data.run.programme?.name}</h1>
        <div className="flex items-center gap-2 mt-2 text-sm">
          <span className="text-slate-500">Lessons in this run</span>
          <div className="flex items-center gap-1 ml-auto">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setLessons((lessons ?? 0) - 1)} disabled={lessons === null} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center" aria-label="Fewer lessons"><Minus size={14} /></motion.button>
            <span className="min-w-8 text-center font-semibold tabular-nums">{lessons ?? "Not set"}</span>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setLessons((lessons ?? 0) + 1)} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center" aria-label="More lessons"><Plus size={14} /></motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 py-4 space-y-3">
        {data.roster.length === 0 && <p className="text-center text-sm text-slate-400 py-12">No learners enrolled on this run.</p>}
        {data.roster.map(l => <LearnerCard key={l.enrolment_id} learner={l} rubrics={data.rubrics} lessons={lessons} />)}
      </main>
    </div>
  );
}

function LearnerCard({ learner, rubrics, lessons }: { learner: RosterLearner; rubrics: Rubric[]; lessons: number | null }) {
  const [scores, setScores] = useState<AreaScores>(learner.scores);
  const [attendance, setAttendance] = useState<Record<number, LessonState>>(() =>
    Object.fromEntries(learner.attendance.map(a => [a.lesson_no, a.present ? "present" : a.caught_up_on ? "caught_up" : "missed"])));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const pending = useRef<AreaScores>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalAreas = rubrics.reduce((n, r) => n + r.areas.length, 0);
  const scored = Object.values(scores).filter(Boolean).length;
  const toCatchUp = Object.values(attendance).filter(s => s === "missed").length;

  function flush() {
    const batch = pending.current;
    pending.current = {};
    setSaved("saving");
    api("/admin/api/reports/scores", { method: "POST", json: { enrolmentId: learner.enrolment_id, scores: batch } })
      .then(() => setSaved("saved"))
      .catch(e => { setSaved("idle"); toast.error(`${learner.first_name}: ${(e as Error).message}`); });
  }

  function score(changes: AreaScores) {
    setScores(s => ({ ...s, ...changes }));
    pending.current = { ...pending.current, ...changes };
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  }

  async function tapLesson(n: number) {
    const next = NEXT_LESSON_STATE[attendance[n] ?? "present"];
    setAttendance(a => ({ ...a, [n]: next }));
    try {
      await api("/admin/api/reports/attendance", { method: "POST", json: { enrolmentId: learner.enrolment_id, lessonNo: n, state: next } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function tapCount(delta: 1 | -1) {
    const missed = Object.entries(attendance).filter(([, st]) => st === "missed").map(([n]) => Number(n));
    const lessonNo = delta > 0 ? Math.max(0, ...Object.keys(attendance).map(Number)) + 1 : Math.max(...missed);
    const state: LessonState = delta > 0 ? "missed" : "present";
    setAttendance(a => {
      const next = { ...a };
      if (state === "present") delete next[lessonNo]; else next[lessonNo] = state;
      return next;
    });
    try {
      await api("/admin/api/reports/attendance", { method: "POST", json: { enrolmentId: learner.enrolment_id, lessonNo, state } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section id={learner.enrolment_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-32">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <h2 className="font-semibold">{learner.name}</h2>
          <p className="text-[12px] text-slate-400 tabular-nums">{scored}/{totalAreas} scored · {toCatchUp} to catch up</p>
        </div>
        <AnimatePresence mode="wait">
          {saved !== "idle" && (
            <motion.span key={saved} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-[12px] text-slate-400 flex items-center gap-1">
              {saved === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} className="text-emerald-600" />}
              {saved === "saving" ? "Saving" : "Saved"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {rubrics.map(r => (
        <div key={r.id} className="px-4 py-2 border-t border-slate-50">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</p>
            <div className="flex gap-1">
              {r.levels.map(lv => (
                <button key={lv.id} onClick={() => score(Object.fromEntries(r.areas.map(a => [a.id, lv.id])))} className="text-[11px] text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 hover:bg-slate-50">
                  All {lv.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {r.areas.map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <span className="flex-1 text-[13px] text-slate-700 leading-tight">{a.label}</span>
                {r.levels.map(lv => {
                  const on = scores[a.id] === lv.id;
                  const top = lv.rank === r.levels[r.levels.length - 1].rank;
                  return (
                    <motion.button
                      key={lv.id}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => score({ [a.id]: on ? "" : lv.id })}
                      className={`min-w-[84px] text-[12px] font-medium rounded-lg border px-2 py-2 transition-colors ${on ? (top ? "bg-emerald-600 border-emerald-600 text-white" : "bg-amber-500 border-amber-500 text-white") : "bg-white border-slate-200 text-slate-500"}`}
                      aria-pressed={on}
                    >
                      {lv.label}
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="px-4 py-3 border-t border-slate-50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
          {lessons ? "Lessons · tap to mark missed, again once caught up" : "Lessons to catch up"}
        </p>
        {lessons ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: lessons }, (_, i) => i + 1).map(n => {
              const st = attendance[n] ?? "present";
              return (
                <motion.button key={n} whileTap={{ scale: 0.9 }} onClick={() => tapLesson(n)} className={`w-10 h-10 rounded-lg border text-sm font-semibold tabular-nums ${LESSON_STYLE[st]}`} aria-label={`Lesson ${n}: ${st.replace("_", " ")}`}>
                  {n}
                </motion.button>
              );
            })}
          </div>
        ) : (
          // No lesson count on this run (e.g. a retrospective report): capture
          // just how many lessons are owed. Stored as missed rows numbered
          // 1..n, which is all lessonsToCatchUp() counts.
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.9 }} disabled={toCatchUp === 0} onClick={() => tapCount(-1)} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40" aria-label="One fewer lesson to catch up"><Minus size={14} /></motion.button>
            <motion.span key={toCatchUp} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className={`w-8 text-center text-lg font-semibold tabular-nums ${toCatchUp ? "text-rose-600" : "text-slate-500"}`}>{toCatchUp}</motion.span>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => tapCount(1)} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center" aria-label="One more lesson to catch up"><Plus size={14} /></motion.button>
            <span className="text-[12px] text-slate-400">or set the number of lessons at the top to mark individual lessons</span>
          </div>
        )}
      </div>
    </section>
  );
}
