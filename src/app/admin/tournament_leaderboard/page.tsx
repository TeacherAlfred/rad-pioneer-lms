"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, User, Lock, Unlock, Loader2, Timer, Play, Pause, RotateCcw } from "lucide-react";

type TeamData = {
  teamName: string;
  score: number;
  players: { id: string; first_name: string; grade: string }[];
};

export default function TournamentLeaderboard() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [updatingTeam, setUpdatingTeam] = useState<string | null>(null);

  // --- TIMER STATE ---
  const [timeLeft, setTimeLeft] = useState(3600); 
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [adminMinutes, setAdminMinutes] = useState(60);

  // --- DATABASE POLLING ---
  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_participants')
        .select('*');

      if (error) throw error;

      const grouped = (data || []).reduce((acc: Record<string, TeamData>, student) => {
        const tName = student.team_name || "Unknown Team";
        if (!acc[tName]) {
          acc[tName] = { teamName: tName, score: student.score || 0, players: [] };
        }
        acc[tName].players.push(student);
        acc[tName].score = student.score || 0; 
        return acc;
      }, {});

      const sortedTeams = Object.values(grouped).sort((a, b) => b.score - a.score);
      setTeams(sortedTeams);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000); 
    return () => clearInterval(interval);
  }, []);

  // --- TIMER ENGINE ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTimerStart = () => setIsTimerRunning(true);
  const handleTimerPause = () => setIsTimerRunning(false);
  const handleTimerReset = () => {
    setIsTimerRunning(false);
    setTimeLeft(adminMinutes * 60);
  };

  // --- SCORE UPDATING ---
  const handleScoreChange = async (teamName: string, delta: number) => {
    setUpdatingTeam(teamName);
    const team = teams.find(t => t.teamName === teamName);
    if (!team) return;
    const newScore = Math.max(0, team.score + delta);

    try {
      const { error } = await supabase
        .from('tournament_participants')
        .update({ score: newScore })
        .eq('team_name', teamName);

      if (error) throw error;

      setTeams(prev => 
        prev.map(t => t.teamName === teamName ? { ...t, score: newScore } : t)
        .sort((a, b) => b.score - a.score)
      );
    } catch (err) {
      console.error("Error updating score:", err);
      alert("Failed to update score.");
    } finally {
      setUpdatingTeam(null);
    }
  };

  if (loading) {
    return <div className="h-screen w-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500 w-12 h-12" /></div>;
  }

  return (
    // CHANGED: Strict h-screen, w-screen, flex-col to force it to fit
    <div className="h-screen w-screen bg-[#020617] p-4 md:p-6 relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* CHANGED: max-h-full, flex-1, flex-col so internals constrain to bounds */}
      <div className="max-w-6xl w-full mx-auto relative z-10 flex flex-col h-full max-h-full">
        
        {/* HEADER & TIMER (Shrink-0 prevents it from squishing) */}
        <div className="text-center mb-6 shrink-0 space-y-2 md:space-y-4 mt-2">
          <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 rounded-full border border-amber-500/20">
            <Trophy size={32} className="text-amber-400" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 uppercase italic tracking-tighter">
            Live Leaderboard
          </h1>

          <div className="flex flex-col items-center justify-center">
            {/* CHANGED: Reduced text size slightly to save vertical space */}
            <div className={`font-mono text-6xl md:text-8xl font-black tracking-widest leading-none ${timeLeft <= 60 && timeLeft > 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.3)]'}`}>
              {formatTime(timeLeft)}
            </div>
            {timeLeft === 0 && (
              <p className="text-red-500 font-black uppercase tracking-widest text-lg mt-2 animate-bounce">
                Time is up! Controllers down!
              </p>
            )}
          </div>

          <AnimatePresence>
            {isAdminMode && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-center gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl w-fit mx-auto mt-4 overflow-hidden"
              >
                <div className="flex items-center gap-2 bg-[#020617] px-3 py-1.5 rounded-xl border border-white/10">
                  <Timer size={14} className="text-slate-400" />
                  <input 
                    type="number" 
                    value={adminMinutes}
                    onChange={(e) => {
                      const mins = parseInt(e.target.value) || 0;
                      setAdminMinutes(mins);
                      if (!isTimerRunning) setTimeLeft(mins * 60);
                    }}
                    className="w-12 bg-transparent text-white font-black text-center outline-none"
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Mins</span>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleTimerStart} disabled={isTimerRunning || timeLeft === 0} className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl transition-colors disabled:opacity-50">
                    <Play size={16} />
                  </button>
                  <button onClick={handleTimerPause} disabled={!isTimerRunning} className="p-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-xl transition-colors disabled:opacity-50">
                    <Pause size={16} />
                  </button>
                  <button onClick={handleTimerReset} className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-colors">
                    <RotateCcw size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* TEAM LIST (Flex-1 takes remaining space, overflow-y-auto handles any extra) */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 md:space-y-4 custom-scrollbar pb-4 pr-2">
          <AnimatePresence mode="popLayout">
            {teams.map((team, index) => {
              const isFirst = index === 0 && team.score > 0;
              
              return (
                <motion.div 
                  key={team.teamName}
                  layout 
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  // CHANGED: Reduced padding so 4 rows easily fit
                  className={`relative flex flex-col md:flex-row items-center justify-between p-4 md:p-5 rounded-[24px] border ${
                    isFirst 
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-600/10 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]' 
                      : 'bg-white/[0.02] border-white/10'
                  }`}
                >
                  
                  <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                    {/* CHANGED: Slightly smaller rank numbers */}
                    <div className={`text-4xl md:text-5xl font-black italic w-12 text-center ${isFirst ? 'text-amber-400' : 'text-slate-600'}`}>
                      #{index + 1}
                    </div>
                    
                    <div className="space-y-1">
                      {/* CHANGED: Slightly smaller team names */}
                      <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                        {team.teamName} 
                        {isFirst && <Crown size={24} className="text-amber-400 drop-shadow-md" />}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                        {team.players.map((p) => (
                          <span key={p.id} className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-md border border-white/5">
                            <User size={10} /> {p.first_name} (Gr. {p.grade})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 md:gap-6 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end">
                    <AnimatePresence>
                      {isAdminMode && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex gap-2"
                        >
                          {/* CHANGED: Smaller admin scoring buttons */}
                          <button onClick={() => handleScoreChange(team.teamName, -50)} disabled={updatingTeam === team.teamName} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-colors font-black text-sm w-12 h-12 flex items-center justify-center">
                            -50
                          </button>
                          <button onClick={() => handleScoreChange(team.teamName, 50)} disabled={updatingTeam === team.teamName} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20 transition-colors font-black text-sm w-12 h-12 flex items-center justify-center">
                            +50
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* CHANGED: Slightly smaller score */}
                    <div className={`text-5xl md:text-6xl font-black italic tracking-tighter w-32 text-right ${isFirst ? 'text-amber-400' : 'text-white'}`}>
                      {updatingTeam === team.teamName ? (
                        <Loader2 className="animate-spin inline-block text-slate-500" />
                      ) : (
                        team.score
                      )}
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <button 
        onClick={() => setIsAdminMode(!isAdminMode)}
        className={`absolute bottom-4 right-4 p-2.5 rounded-full transition-all z-50 ${isAdminMode ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-slate-600 hover:text-slate-400'}`}
        title="Toggle Scoring Controls"
      >
        {isAdminMode ? <Unlock size={14} /> : <Lock size={14} />}
      </button>

    </div>
  );
}