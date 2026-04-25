"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  CheckCircle2, XCircle, ExternalLink, Loader2, 
  Users, Trophy, Lock, Unlock, RefreshCw, LayoutDashboard, ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TeacherBootcampDashboard() {
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [labLocked, setLabLocked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalXp: 0, activeTeams: 0 });

  useEffect(() => {
    fetchData();

    // REAL-TIME: Listen for new student submissions
    const submissionSub = supabase
      .channel('teacher_room_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutorial_submissions' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(submissionSub); };
  }, []);

  async function fetchData() {
    const [qRes, lockRes, profileRes] = await Promise.all([
      supabase.from('teacher_review_queue').select('*'),
      supabase.from('bootcamp_settings').select('lab_unlocked').eq('id', 1).single(),
      supabase.from('profiles').select('bootcamp_xp')
    ]);

    if (qRes.data) setQueue(qRes.data);
    if (lockRes.data) setLabLocked(!lockRes.data.lab_unlocked);
    
    // Calculate live classroom stats
    if (profileRes.data) {
      const total = profileRes.data.reduce((acc, curr) => acc + (curr.bootcamp_xp || 0), 0);
      setStats({ totalXp: total, activeTeams: qRes.data?.length || 0 });
    }
    
    setLoading(false);
  }

  const toggleLabLock = async () => {
    const newStatus = !labLocked;
    const { error } = await supabase
      .from('bootcamp_settings')
      .update({ lab_unlocked: !newStatus })
      .eq('id', 1);
    
    if (!error) setLabLocked(newStatus);
  };

  const handleReview = async (submissionId: string, status: 'approved' | 'rejected', studentId: string) => {
    // 1. Update the submission status
    await supabase.from('tutorial_submissions').update({ status }).eq('id', submissionId);

    // 2. Award Bootcamp XP if approved (+20 XP for tutorial completion)
    if (status === 'approved') {
      const { data } = await supabase.from('profiles').select('bootcamp_xp').eq('id', studentId).single();
      const currentXp = data?.bootcamp_xp || 0;
      
      await supabase.from('profiles')
        .update({ bootcamp_xp: currentXp + 20 })
        .eq('id', studentId);
    }

    fetchData();
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-blue-500 gap-4">
      <Loader2 className="animate-spin" size={40} />
      <p className="text-xs font-black uppercase tracking-widest">Loading Teacher Station...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white p-6 md:p-10">
      
      {/* TEACHER HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <Users size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">RAD Academy Teacher Portal</span>
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">Bootcamp Command</h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          
          {/* LINK TO MAIN TEACHER DASHBOARD */}
          <Link 
            href="/teacher/dashboard"
            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all text-xs font-black uppercase tracking-widest"
          >
            <LayoutDashboard size={14} /> Main Dashboard
          </Link>

          {/* LINK TO LIVE PROJECTOR LEADERBOARD */}
          <Link 
            href="/teacher/bootcamp/leaderboard"
            target="_blank"
            className="flex items-center gap-2 px-5 py-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 hover:text-white hover:bg-blue-500 transition-all text-xs font-black uppercase tracking-widest"
            title="Open Leaderboard in a new tab to cast to projector"
          >
            <Trophy size={14} /> Live Leaderboard <ArrowRight size={14} className="ml-1" />
          </Link>

          <div className="w-px h-8 bg-white/10 mx-2 hidden md:block" />

          <button 
            onClick={fetchData}
            className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={18} />
          </button>
          
          <button 
            onClick={toggleLabLock}
            className={`flex items-center gap-4 px-8 py-3 rounded-2xl font-black uppercase text-xs transition-all shadow-xl ${
              labLocked 
              ? 'bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20' 
              : 'bg-emerald-500 text-black hover:scale-105'
            }`}
          >
            {labLocked ? <Lock size={16} /> : <Unlock size={16} />}
            {labLocked ? "Logic Lab: Locked" : "Logic Lab: Open"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LEFT COLUMN: THE QUEUE */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
              Review Queue <span className="bg-blue-500 text-[10px] px-2 py-0.5 rounded-full">{queue.length}</span>
            </h2>
          </div>

          <div className="grid gap-4">
            {queue.length === 0 ? (
              <div className="py-20 bg-white/5 border-2 border-dashed border-white/10 rounded-[40px] flex flex-col items-center justify-center text-slate-500 gap-4">
                <Users size={40} className="opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Waiting for student submissions...</p>
              </div>
            ) : (
              queue.map((item) => (
                <div key={item.submission_id} className="bg-white/5 border border-white/10 p-6 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-white/[0.07] transition-all">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">
                      {item.tutorial_title}
                    </span>
                    <h3 className="text-xl font-black uppercase tracking-tight">{item.group_names}</h3>
                    <p className="text-[10px] text-slate-500 uppercase">Submitted {new Date(item.submitted_at).toLocaleTimeString()}</p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <a 
                      href={item.share_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                    >
                      View Code <ExternalLink size={14} />
                    </a>
                    
                    <button 
                      onClick={() => handleReview(item.submission_id, 'rejected', item.student_id)}
                      className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                      title="Reject"
                    >
                      <XCircle size={20} />
                    </button>

                    <button 
                      onClick={() => handleReview(item.submission_id, 'approved', item.student_id)}
                      className="p-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-black transition-all"
                      title="Approve & Award XP"
                    >
                      <CheckCircle2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CLASSROOM STATS */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
            <Trophy className="absolute -right-6 -bottom-6 text-white/10 group-hover:scale-110 transition-transform duration-700" size={160} />
            <h3 className="text-white/70 font-black uppercase text-[10px] tracking-widest mb-2">Classroom Performance</h3>
            <p className="text-6xl font-black italic tracking-tighter mb-1">{stats.totalXp}</p>
            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">Total Bootcamp XP</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] space-y-6">
            <h3 className="font-black uppercase tracking-widest text-xs text-slate-400">Classroom Monitor</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-sm text-slate-300">Waitlist Size</span>
                <span className="font-black text-blue-500">{queue.length}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-sm text-slate-300">Current Phase</span>
                <span className="font-black text-emerald-500">Skill Acquisition</span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-sm text-slate-300">Lab Status</span>
                <span className={`text-xs font-black uppercase ${labLocked ? 'text-red-500' : 'text-emerald-500'}`}>
                  {labLocked ? "Locked" : "Open Access"}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}