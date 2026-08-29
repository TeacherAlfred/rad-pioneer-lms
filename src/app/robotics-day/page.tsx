"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import {
  AVATAR_OPTIONS,
  Participant,
  TEAM_COLORS,
  Team,
  TeamRow,
  teamLabel,
} from "./theme";

const POLL_MS = 5000;

export default function RoboticsDaySignIn() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [picking, setPicking] = useState<Participant | null>(null);
  const [celebrating, setCelebrating] = useState<Participant | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("robotics_day_participants").select("*").order("name"),
      supabase.from("robotics_day_teams").select("*"),
    ]);
    if (p) setParticipants(p as Participant[]);
    if (t) setTeams(t as TeamRow[]);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function chooseAvatar(avatar: string) {
    if (!picking) return;
    setSaving(true);
    const { error } = await supabase
      .from("robotics_day_participants")
      .update({ avatar })
      .eq("id", picking.id);
    setSaving(false);
    if (error) {
      alert("Oops, that didn't save. Try again!");
      return;
    }
    const justJoined = { ...picking, avatar };
    setParticipants((prev) =>
      prev.map((p) => (p.id === justJoined.id ? justJoined : p))
    );
    setPicking(null);
    setCelebrating(justJoined);
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => setCelebrating(null), 1700);
  }

  const byTeam = (team: Team) => participants.filter((p) => p.team === team);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#FFF9EC] to-[#FFEFD6] px-4 py-8 sm:px-8">
      <header className="mx-auto mb-8 max-w-5xl text-center">
        <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
          🤖 Tap Your Name! 🎉
        </h1>
        <p className="mt-2 text-lg font-bold text-slate-500">
          Pick your name, then pick your avatar. That&apos;s it!
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
        {(["A", "B"] as Team[]).map((team) => (
          <section key={team}>
            <h2
              className="mb-4 rounded-2xl px-5 py-3 text-center text-2xl font-black text-white shadow-md"
              style={{ backgroundColor: TEAM_COLORS[team].pop }}
            >
              {teamLabel(team, teams)}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {byTeam(team).map((kid) => (
                <button
                  key={kid.id}
                  onClick={() => setPicking(kid)}
                  className="flex flex-col items-center justify-center gap-2 rounded-3xl border-4 bg-white p-4 shadow-lg transition active:scale-95"
                  style={{ borderColor: TEAM_COLORS[team].pop }}
                >
                  <span className="text-5xl">{kid.avatar || "❔"}</span>
                  <span className="text-lg font-extrabold text-slate-700">
                    {kid.name}
                  </span>
                  {kid.avatar ? (
                    <span className="text-sm font-bold text-green-600">
                      You&apos;re in! ✅
                    </span>
                  ) : (
                    <span className="text-sm font-bold" style={{ color: TEAM_COLORS[team].text }}>
                      Tap to join!
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <AnimatePresence>
        {picking && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && setPicking(null)}
          >
            <motion.div
              className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-center text-2xl font-black text-slate-800">
                Pick your avatar, {picking.name}!
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_OPTIONS.map((a) => (
                  <button
                    key={a}
                    disabled={saving}
                    onClick={() => chooseAvatar(a)}
                    className="flex aspect-square items-center justify-center rounded-2xl bg-amber-50 text-4xl shadow transition hover:bg-amber-100 active:scale-90 disabled:opacity-50"
                  >
                    {a}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPicking(null)}
                className="mt-5 w-full rounded-xl py-3 text-lg font-bold text-slate-500"
              >
                Back
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrating && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="rounded-[2rem] bg-white px-10 py-8 text-center shadow-2xl"
              initial={{ scale: 0.5, rotate: -8 }}
              animate={{ scale: 1.05, rotate: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
            >
              <div className="text-7xl">{celebrating.avatar}</div>
              <div className="mt-3 text-3xl font-black text-slate-800">
                You&apos;re in, {celebrating.name}! 🎉
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
