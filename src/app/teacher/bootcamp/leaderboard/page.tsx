"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Zap, Loader2, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TeamStats = {
  studentId: string;
  groupName: string;
  approvedCount: number;
  pendingCount: number;
  xpEarned: number;
};

export default function LiveBootcampLeaderboard() {
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    // Fetch all submissions ordered by time so we can track the most recent team name
    const { data: subs } = await supabase
      .from('tutorial_submissions')
      .select('student_id, group_names, status, submitted_at')
      .neq('student_id', '74b7334a-ef76-4862-8981-d3db46ad5378')
      .order('submitted_at', { ascending: true });

    if (!subs) return;

    // Aggregate using the unique student_id, not the text string
    const teamMap = new Map<string, TeamStats>();

    subs.forEach(sub => {
      const sid = sub.student_id;
      if (!sid) return;

      if (!teamMap.has(sid)) {
        teamMap.set(sid, { 
          studentId: sid, 
          groupName: sub.group_names || "Unknown Pioneer", 
          approvedCount: 0, 
          pendingCount: 0, 
          xpEarned: 0 
        });
      }
      
      const stats = teamMap.get(sid)!;
      
      // Always overwrite with the latest group name since we process oldest to newest
      if (sub.group_names) {
        stats.groupName = sub.group_names;
      }

      if (sub.status === 'approved') {
        stats.approvedCount += 1;
        stats.xpEarned += 20; // 20 XP per approved tutorial
      } else if (sub.status === 'pending') {
        stats.pendingCount += 1;
      }
    });

    // Convert map to array and sort by XP descending
    const sortedTeams = Array.from(teamMap.values()).sort((a, b) => b.xpEarned - a.xpEarned);
    setTeams(sortedTeams);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();

    // Listen for any submission updates
    const channel = supabase
      .channel('live_leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutorial_submissions' }, () => {
        fetchStats();
      })
      .subscribe();

    // Failsafe polling every 15 seconds
    const interval = setInterval(fetchStats, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-blue-500 gap-4">
        <Loader2 className="animate-spin" size={60} />
        <p className="text-xl font-black uppercase tracking-widest">Initializing Live Tracker...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] overflow-hidden flex flex-col text-white font-sans">
      
      {/* HEADER */}
      <header className="p-8 md:p-12 border-b border-white/10 bg-black/40 flex justify-between items-center shadow-2xl">
        <div>
          <div className="flex items-center gap-3 text-emerald-500 mb-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-black uppercase tracking-[0.3em]">Live Feed</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic drop-shadow-lg">
            Bootcamp <span className="text-blue-500">Leaderboard</span>
          </h1>
        </div>
        <div className="hidden md:flex items-center justify-center w-24 h-24 bg-blue-500/10 rounded-3xl border border-blue-500/30">
          <Trophy size={48} className="text-blue-400" />
        </div>
      </header>

      {/* LEADERBOARD LIST */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-4">
          
          {teams.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-slate-600 gap-6">
              <Users size={80} className="opacity-20" />
              <h2 className="text-3xl font-black uppercase tracking-widest">Awaiting Engineering Teams...</h2>
            </div>
          ) : (
            <AnimatePresence>
              {teams.map((team, index) => {
                
                // Styling based on rank
                let rankStyle = "bg-white/5 border-white/10 text-slate-400";
                let rankIcon = <span className="text-2xl font-black">{index + 1}</span>;

                if (index === 0) {
                  rankStyle = "bg-gradient-to-r from-yellow-500/20 to-amber-600/10 border-yellow-500/50 text-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.2)]";
                  rankIcon = <Trophy size={32} className="text-yellow-400" />;
                } else if (index === 1) {
                  rankStyle = "bg-gradient-to-r from-slate-300/20 to-slate-400/10 border-slate-300/40 text-slate-300";
                } else if (index === 2) {
                  rankStyle = "bg-gradient-to-r from-orange-700/20 to-amber-800/10 border-orange-700/40 text-orange-400";
                }

                return (
                  <motion.div
                    key={team.studentId}
                    layout
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex items-center gap-6 p-6 md:p-8 rounded-[32px] border ${rankStyle}`}
                  >
                    {/* Rank Badge */}
                    <div className="w-16 h-16 shrink-0 bg-black/40 rounded-2xl flex items-center justify-center border border-white/10">
                      {rankIcon}
                    </div>

                    {/* Team Info */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter truncate text-white">
                        {team.groupName}
                      </h2>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                          {team.approvedCount} Modules Approved
                        </span>
                        {team.pendingCount > 0 && (
                          <span className="text-xs font-bold uppercase tracking-widest text-amber-500 animate-pulse">
                            {team.pendingCount} Pending Review
                          </span>
                        )}
                      </div>
                    </div>

                    {/* XP Score */}
                    <div className="text-right shrink-0">
                      <p className="text-5xl md:text-6xl font-black italic tracking-tighter flex items-center gap-2">
                        {team.xpEarned} <Zap size={32} className="text-blue-500" />
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">Bootcamp XP</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

        </div>
      </div>

    </main>
  );
}