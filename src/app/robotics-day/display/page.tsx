"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import {
  Participant,
  TEAM_COLORS,
  TIERS,
  Team,
  TeamRow,
  teamLabel,
} from "../theme";

const POLL_MS = 6000;

export default function RoboticsDayDisplay() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const prevPoints = useRef<Record<Team, number>>({ A: 0, B: 0 });

  const load = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("robotics_day_participants").select("*").order("name"),
      supabase.from("robotics_day_teams").select("*"),
    ]);
    if (p) {
      const rows = p as Participant[];
      (["A", "B"] as Team[]).forEach((team) => {
        const total = rows.filter((r) => r.team === team).reduce((s, r) => s + r.points, 0);
        if (total > prevPoints.current[team]) {
          confetti({ particleCount: 90, spread: 100, origin: { y: 0.3 } });
        }
        prevPoints.current[team] = total;
      });
      setParticipants(rows);
    }
    if (t) setTeams(t as TeamRow[]);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const byTeam = (team: Team) => participants.filter((p) => p.team === team);
  const totalFor = (team: Team) => byTeam(team).reduce((s, p) => s + p.points, 0);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#FFF9EC] to-[#FFEFD6] p-6 sm:p-10">
      <header className="mb-8 flex items-center justify-center gap-3">
        <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-6xl">
          🤖 RAD Robotics Day
        </h1>
        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-sm font-black text-red-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE
        </span>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
        {(["A", "B"] as Team[]).map((team) => (
          <section
            key={team}
            className="rounded-[2rem] bg-white/70 p-6 shadow-xl ring-4"
            style={{ ["--tw-ring-color" as string]: TEAM_COLORS[team].pop }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl font-black" style={{ color: TEAM_COLORS[team].text }}>
                {teamLabel(team, teams)}
              </h2>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={totalFor(team)}
                  initial={{ scale: 1.4, y: -6 }}
                  animate={{ scale: 1, y: 0 }}
                  className="rounded-2xl px-4 py-2 text-4xl font-black text-white shadow"
                  style={{ backgroundColor: TEAM_COLORS[team].pop }}
                >
                  {totalFor(team)} pts
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {byTeam(team).map((kid) => {
                const tier = TIERS.find((t) => t.value === kid.tier);
                return (
                  <motion.div
                    key={kid.id}
                    layout
                    className="flex flex-col items-center rounded-2xl bg-white p-3 text-center shadow"
                  >
                    <span className={`text-5xl ${!kid.avatar ? "opacity-20" : ""}`}>
                      {kid.avatar || "🙈"}
                    </span>
                    <span className="mt-1 font-extrabold text-slate-700">{kid.name}</span>
                    <AnimatePresence>
                      {tier && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="mt-1 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                          style={{ backgroundColor: TEAM_COLORS[team].pop }}
                        >
                          {tier.emoji} {tier.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
