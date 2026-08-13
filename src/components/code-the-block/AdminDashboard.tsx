"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MODULES } from "@/lib/code-the-block/content/code-the-block";
import { stepId } from "@/lib/code-the-block/content/types";
import { getRosterData, resolveHelp, type RosterWorkshopDTO } from "@/app/code-the-block/admin/actions";

const POLL_MS = 4000;
const BASE_TITLE = "Code the Block — Admin";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function playPingSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // Autoplay can be blocked before any user gesture — the visual banner still works.
  }
}

export function AdminDashboard() {
  const [roster, setRoster] = useState<RosterWorkshopDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const knownHelpIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const data = await getRosterData();
      if (cancelled) return;

      const currentHelpIds = new Set(
        data.flatMap((w) => w.students.filter((s) => s.needsHelp).map((s) => s.id))
      );
      const hasNew = [...currentHelpIds].some((id) => !knownHelpIds.current.has(id));
      if (hasNew) {
        playPingSound();
      }
      knownHelpIds.current = currentHelpIds;

      setRoster(data);
      setLoading(false);
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const helpRequests = roster
    .flatMap((w) => w.students.filter((s) => s.needsHelp).map((s) => ({ ...s, workshopTitle: w.title })))
    .sort((a, b) => (a.helpRequestedAt ?? "").localeCompare(b.helpRequestedAt ?? ""));

  useEffect(() => {
    if (helpRequests.length === 0) {
      document.title = BASE_TITLE;
      return;
    }
    let flash = false;
    document.title = `🆘 (${helpRequests.length}) ${BASE_TITLE}`;
    const interval = setInterval(() => {
      flash = !flash;
      document.title = flash ? BASE_TITLE : `🆘 (${helpRequests.length}) ${BASE_TITLE}`;
    }, 1000);
    return () => {
      clearInterval(interval);
      document.title = BASE_TITLE;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpRequests.length]);

  async function handleResolve(studentId: string) {
    setRoster((prev) =>
      prev.map((w) => ({
        ...w,
        students: w.students.map((s) =>
          s.id === studentId ? { ...s, needsHelp: false, helpModule: null, helpTrack: null, helpRequestedAt: null } : s
        ),
      }))
    );
    await resolveHelp(studentId);
  }

  const columns = MODULES.flatMap((m) =>
    (["beginner", "advanced"] as const).map((track) => ({
      id: stepId(m.id, track),
      label: `${m.icon} ${m.title[0]}${m.title.slice(1).toLowerCase()}`,
      track,
    }))
  );

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">⛏️ Code the Block — Roster</h1>
          {loading && <span className="text-xs text-slate-500">loading…</span>}
        </div>

        <AnimatePresence>
          {helpRequests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 space-y-2 rounded-2xl border-2 border-rad-red bg-rad-red/10 p-4 shadow-[0_0_30px_rgba(184,59,60,0.25)]"
            >
              <div className="flex items-center gap-2 font-black text-rad-red">
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  🆘
                </motion.span>
                {helpRequests.length} student{helpRequests.length > 1 ? "s" : ""} need{helpRequests.length === 1 ? "s" : ""} help
              </div>
              {helpRequests.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/50 px-4 py-2.5"
                >
                  <div className="text-sm text-slate-200">
                    <span className="font-bold text-white">
                      {s.firstName} {s.lastInitial}.
                    </span>{" "}
                    — {s.helpModule} ({s.helpTrack}){" "}
                    <span className="text-slate-500">· {timeAgo(s.helpRequestedAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolve(s.id)}
                    className="flex-none rounded-full bg-rad-green/90 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-rad-green"
                  >
                    ✓ On it
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && roster.length === 0 && <p className="text-slate-400">No workshops found yet.</p>}

        {roster.map((workshop) => (
          <div key={workshop.id} className="mb-10">
            <h2 className="mb-1 text-lg font-semibold text-white">{workshop.title}</h2>
            <p className="mb-4 text-sm text-slate-500">Code: {workshop.code}</p>

            {workshop.students.length === 0 ? (
              <p className="text-sm text-slate-500">No students have logged in yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                      <th className="px-3 py-2 font-semibold">Student</th>
                      {columns.map((col) => (
                        <th key={col.id} className="px-3 py-2 text-center font-semibold capitalize">
                          {col.label}
                          <div className="text-[10px] font-normal text-slate-500">{col.track}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workshop.students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-800/60 text-slate-200">
                        <td className="px-3 py-2 font-medium">
                          {student.needsHelp && <span className="mr-1.5">🆘</span>}
                          {student.firstName} {student.lastInitial}.
                        </td>
                        {columns.map((col) => (
                          <td key={col.id} className="px-3 py-2 text-center">
                            {student.completedStepIds.includes(col.id) ? (
                              <span className="text-rad-green">✓</span>
                            ) : (
                              <span className="text-slate-700">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
