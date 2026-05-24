'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CalendarPlus, Loader2, CheckCircle2, User, Clock, Calendar, CheckSquare } from 'lucide-react';

// Initialize standard client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Teacher {
  id: string;
  display_name: string;
}

export default function AdminSlotGenerator() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pipeline Stats
  const [stats, setStats] = useState({ empty: 0, booked: 0 });

  // Form State
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    // 1. Fetch active educators
    const { data: teacherData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('role', 'educator');

    if (teacherData) setTeachers(teacherData);

    // 2. Fetch Pipeline Stats
    await fetchStats();
    
    setLoading(false);
  }

  async function fetchStats() {
    const now = new Date().toISOString();

    // Empty future slots (Draft status)
    const { count: emptyCount } = await supabase
      .from('catchup_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Draft')
      .gte('session_date', now);

    // Booked future slots (Any status other than Draft)
    const { count: bookedCount } = await supabase
      .from('catchup_sessions')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Draft')
      .gte('session_date', now);

    setStats({ 
      empty: emptyCount || 0, 
      booked: bookedCount || 0 
    });
  }

  const handleGenerateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !sessionDate) return;
    
    setIsSaving(true);
    setSuccess(false);

    const { error } = await supabase
      .from('catchup_sessions')
      .insert([
        {
          teacher_id: selectedTeacher,
          session_date: new Date(sessionDate).toISOString(),
        }
      ]);

    if (!error) {
      setSuccess(true);
      setSessionDate(''); 
      await fetchStats(); // Instantly update the stats counter!
      setTimeout(() => setSuccess(false), 3000);
    } else {
      console.error('Failed to create slot:', error);
      alert('Error creating schedule block.');
    }
    
    setIsSaving(false);
  };

  if (loading) return <div className="p-4 border border-white/10 rounded-2xl animate-pulse bg-white/5 h-32"></div>;

  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-[32px] p-6 md:p-8 shadow-xl relative overflow-hidden group">
      <CalendarPlus className="absolute -right-6 -bottom-6 size-48 opacity-[0.02] text-emerald-500 group-hover:scale-110 transition-transform duration-700" />
      
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h3 className="text-xl font-black italic uppercase text-white tracking-tight flex items-center gap-3">
            <CalendarPlus className="text-emerald-500" size={24} /> 
            Inventory Generator
          </h3>
          <p className="text-slate-500 text-xs mt-1 font-medium">Publish new empty catch-up slots to the parent portal.</p>
        </div>

        {/* Pipeline Metrics */}
        <div className="flex items-center gap-3 bg-black/20 p-2 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
             <Calendar size={14} className="text-blue-400" />
             <div className="flex flex-col">
               <span className="text-blue-400 text-sm font-black leading-none">{stats.empty}</span>
               <span className="text-[8px] font-black uppercase tracking-widest text-blue-500/70 mt-0.5">Empty/Available</span>
             </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
             <CheckSquare size={14} className="text-emerald-400" />
             <div className="flex flex-col">
               <span className="text-emerald-400 text-sm font-black leading-none">{stats.booked}</span>
               <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70 mt-0.5">Upcoming Booked</span>
             </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerateSlot} className="relative z-10 flex flex-col md:flex-row items-end gap-4 border-t border-white/5 pt-6">
        
        {/* Teacher Selection */}
        <div className="w-full md:flex-1 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 flex items-center gap-1">
            <User size={10}/> Assign Educator
          </label>
          <select 
            required
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-300 outline-none focus:border-emerald-500 appearance-none cursor-pointer transition-colors"
          >
            <option value="" disabled>Select a teacher...</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.display_name}</option>
            ))}
          </select>
        </div>

        {/* Date & Time Selection */}
        <div className="w-full md:flex-1 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 flex items-center gap-1">
            <Clock size={10}/> Date & Time
          </label>
          <input 
            type="datetime-local" 
            required
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500 cursor-pointer transition-colors" 
          />
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={isSaving || !selectedTeacher || !sessionDate}
          className="w-full md:w-auto h-[46px] px-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isSaving ? (
            <><Loader2 size={16} className="animate-spin"/> Publishing...</>
          ) : success ? (
            <><CheckCircle2 size={16}/> Slot Published!</>
          ) : (
            'Publish Slot'
          )}
        </button>
      </form>
    </div>
  );
}