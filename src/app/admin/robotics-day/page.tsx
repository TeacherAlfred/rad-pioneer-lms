"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Participant,
  TEAM_COLORS,
  TIERS,
  Team,
  TeamRow,
} from "@/app/robotics-day/theme";

const POINT_STEPS = [1, 5, 10];

export default function RoboticsDayAdmin() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamNameDrafts, setTeamNameDrafts] = useState<Record<Team, string>>({ A: "", B: "" });

  const load = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("robotics_day_participants").select("*").order("name"),
      supabase.from("robotics_day_teams").select("*"),
    ]);
    if (p) setParticipants(p as Participant[]);
    if (t) {
      setTeams(t as TeamRow[]);
      const drafts: Record<Team, string> = { A: "", B: "" };
      (t as TeamRow[]).forEach((row) => (drafts[row.team] = row.display_name || ""));
      setTeamNameDrafts(drafts);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addPoints(kid: Participant, delta: number) {
    const points = Math.max(0, kid.points + delta);
    setParticipants((prev) => prev.map((p) => (p.id === kid.id ? { ...p, points } : p)));
    await supabase.from("robotics_day_participants").update({ points }).eq("id", kid.id);
  }

  async function setTier(kid: Participant, tier: 1 | 2 | 3) {
    const next = kid.tier === tier ? null : tier;
    setParticipants((prev) => prev.map((p) => (p.id === kid.id ? { ...p, tier: next } : p)));
    await supabase.from("robotics_day_participants").update({ tier: next }).eq("id", kid.id);
  }

  async function saveTeamName(team: Team) {
    const display_name = teamNameDrafts[team].trim() || null;
    await supabase.from("robotics_day_teams").update({ display_name }).eq("team", team);
    setTeams((prev) => prev.map((t) => (t.team === team ? { ...t, display_name } : t)));
  }

  async function resetEvent() {
    if (!confirm("Reset ALL avatars, tiers and points back to zero? This can't be undone.")) return;
    await supabase
      .from("robotics_day_participants")
      .update({ avatar: null, tier: null, points: 0 })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    load();
  }

  const byTeam = (team: Team) => participants.filter((p) => p.team === team);

  return (
    <div className="min-h-screen w-full bg-slate-50 p-6 text-slate-900 sm:p-10">
      <header className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
        <h1 className="text-2xl font-black">Robotics Day — Admin Console</h1>
        <button
          onClick={resetEvent}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          Reset All (testing)
        </button>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
        {(["A", "B"] as Team[]).map((team) => (
          <section key={team} className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center gap-2">
              <input
                value={teamNameDrafts[team]}
                onChange={(e) => setTeamNameDrafts((prev) => ({ ...prev, [team]: e.target.value }))}
                onBlur={() => saveTeamName(team)}
                placeholder={`Team ${team} name`}
                className="w-full rounded-lg border px-3 py-2 font-bold"
                style={{ borderColor: TEAM_COLORS[team].pop, color: TEAM_COLORS[team].text }}
              />
            </div>

            <div className="space-y-3">
              {byTeam(team).map((kid) => (
                <div key={kid.id} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{kid.avatar || "❔"}</span>
                      <span className="font-bold">{kid.name}</span>
                    </div>
                    <span className="font-black" style={{ color: TEAM_COLORS[team].text }}>
                      {kid.points} pts
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {POINT_STEPS.map((step) => (
                      <button
                        key={step}
                        onClick={() => addPoints(kid, step)}
                        className="rounded-lg bg-green-100 px-2.5 py-1 text-sm font-bold text-green-700 hover:bg-green-200"
                      >
                        +{step}
                      </button>
                    ))}
                    <button
                      onClick={() => addPoints(kid, -1)}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-500 hover:bg-slate-200"
                    >
                      -1
                    </button>

                    <span className="mx-1 h-4 w-px bg-slate-200" />

                    {TIERS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTier(kid, t.value)}
                        className={`rounded-lg px-2.5 py-1 text-sm font-bold ${
                          kid.tier === t.value
                            ? "bg-slate-800 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
