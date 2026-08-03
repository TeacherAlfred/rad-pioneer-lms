"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Save, Loader2, Trophy } from "lucide-react";

export default function TournamentRegistration() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize state for 4 teams, 2 players each
  const [teams, setTeams] = useState(
    Array.from({ length: 4 }).map((_, i) => ({
      teamName: `Team ${i + 1}`,
      player1: { firstName: "", grade: "" },
      player2: { firstName: "", grade: "" }
    }))
  );

  const handlePlayerChange = (teamIdx: number, playerNum: 1 | 2, field: string, value: string) => {
    const updatedTeams = [...teams];
    updatedTeams[teamIdx][`player${playerNum}` as "player1" | "player2"] = {
      ...updatedTeams[teamIdx][`player${playerNum}` as "player1" | "player2"],
      [field]: value
    };
    setTeams(updatedTeams);
  };

  const handleSaveAll = async () => {
    setIsSubmitting(true);
    try {
      // Flatten the teams into an array of individual records
      const recordsToInsert = teams.flatMap(team => {
        const players = [];
        // Add fallback "N/A" to grade to prevent database NOT NULL crashes
        if (team.player1.firstName) players.push({ 
          first_name: team.player1.firstName, 
          grade: team.player1.grade || "N/A", 
          team_name: team.teamName 
        });
        if (team.player2.firstName) players.push({ 
          first_name: team.player2.firstName, 
          grade: team.player2.grade || "N/A", 
          team_name: team.teamName 
        });
        return players;
      });

      if (recordsToInsert.length === 0) return alert("No players entered!");

      // Push to the new lightweight table
      const { error } = await supabase
        .from('tournament_participants')
        .insert(recordsToInsert);

      if (error) {
        console.error("Supabase Insert Error:", error);
        throw new Error(error.message); // Pass the exact DB error to the catch block
      }
      
      alert("All competitors registered successfully! Good luck with the tournament!");
      
      // Clear form for the next batch of kids
      setTeams(Array.from({ length: 4 }).map((_, i) => ({
        teamName: `Team ${i + 1}`,
        player1: { firstName: "", grade: "" },
        player2: { firstName: "", grade: "" }
      })));

    } catch (error: any) {
      console.error("Error saving competitors:", error);
      // This will now pop up with the EXACT reason the database rejected it
      alert(`Failed to save: ${error.message || "Unknown Error"}`); 
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
              <Trophy className="text-amber-400" /> Live Tournament Registration
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Rapid entry for 4 competing pairs. Links to the CRM Prospects table later.</p>
          </div>
          <button 
            onClick={handleSaveAll}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            Save All Competitors
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team, tIdx) => (
            <div key={tIdx} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
                <Users size={16} /> {team.teamName}
              </h3>
              
              <div className="space-y-4">
                {/* Player 1 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      placeholder="Player 1 First Name" 
                      value={team.player1.firstName}
                      onChange={(e) => handlePlayerChange(tIdx, 1, 'firstName', e.target.value)}
                      className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="w-24">
                    <input 
                      type="text" 
                      placeholder="Grade" 
                      value={team.player1.grade}
                      onChange={(e) => handlePlayerChange(tIdx, 1, 'grade', e.target.value)}
                      className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none text-center"
                    />
                  </div>
                </div>

                {/* Player 2 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      placeholder="Player 2 First Name" 
                      value={team.player2.firstName}
                      onChange={(e) => handlePlayerChange(tIdx, 2, 'firstName', e.target.value)}
                      className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="w-24">
                    <input 
                      type="text" 
                      placeholder="Grade" 
                      value={team.player2.grade}
                      onChange={(e) => handlePlayerChange(tIdx, 2, 'grade', e.target.value)}
                      className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}