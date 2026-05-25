'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';
import { CalendarDays, User, Mail, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Clock, CalendarX } from 'lucide-react';

// Define our TypeScript interfaces based on the schema
interface CatchupSession {
  id: string;
  session_date: string;
}

export default function ParentBookingPortal() {
  const params = useParams();
  const teacherNameParam = decodeURIComponent(params.teacherName as string);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [sessions, setSessions] = useState<CatchupSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [teacherNotFound, setTeacherNotFound] = useState(false);
  const [teacherDisplayName, setTeacherDisplayName] = useState('');
  
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function initializeBooking() {
      if (!teacherNameParam) return;

      const { data: teacherData, error: teacherError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('role', 'educator')
        .ilike('display_name', `${teacherNameParam}%`) 
        .limit(1)
        .single();

      if (teacherError || !teacherData) {
        setTeacherNotFound(true);
        setLoading(false);
        return;
      }

      setTeacherDisplayName(teacherData.display_name);

      const { data: sessionData } = await supabase
        .from('catchup_sessions')
        .select('id, session_date')
        .eq('teacher_id', teacherData.id)
        .neq('status', 'Pending Admin Reassignment')
        .gte('session_date', new Date().toISOString())
        .order('session_date', { ascending: true })
        .limit(4);

      if (sessionData) setSessions(sessionData);
      setLoading(false);
    }

    initializeBooking();
  }, [teacherNameParam, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) return alert('Please select a time slot.');
    setIsSubmitting(true);

    const dbSessionId = selectedSessionId === 'next_month' ? null : selectedSessionId;
    const dbStatus = selectedSessionId === 'next_month' ? 'Moved to Next Month' : 'Pending';

    const { error } = await supabase
      .from('catchup_bookings')
      .insert([{
        session_id: dbSessionId,
        student_name: studentName,
        parent_email: parentEmail,
        status: dbStatus,
      }]);

    if (!error) {
      setSuccess(true);
    } else {
      console.error('Booking failed:', error);
      alert('Something went wrong. Please try again.');
    }
    
    setIsSubmitting(false);
  };

  // ==========================================
  // PREMIUM UI RENDERS
  // ==========================================

  // 1. Loading State
  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Accessing Schedule...</p>
    </div>
  );

  // 2. Error State (Not Found)
  if (teacherNotFound) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-rose-500/5 border border-rose-500/20 rounded-[32px] p-10 text-center relative overflow-hidden">
        <AlertTriangle className="absolute -right-10 -bottom-10 w-48 h-48 text-rose-500/5" />
        <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/30">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tight mb-2">Teacher Not Found</h2>
        <p className="text-sm text-slate-400 font-medium">
          We couldn't locate an educator matching "<span className="text-rose-400">{teacherNameParam}</span>". Please double-check your link.
        </p>
      </div>
    </div>
  );

  // 3. Success State
  if (success) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-emerald-500/5 border border-emerald-500/20 rounded-[32px] p-10 text-center relative overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.1)]">
        <CheckCircle2 className="absolute -right-10 -bottom-10 w-48 h-48 text-emerald-500/5" />
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tight mb-3">Request Confirmed!</h2>
        <p className="text-sm text-slate-400 font-medium leading-relaxed">
          Thank you. We have received your request for <strong className="text-white">{studentName}</strong>. 
          We will email the official MS Teams link to <strong className="text-emerald-400">{parentEmail}</strong> shortly.
        </p>
      </div>
    </div>
  );

  // 4. Main Booking Form
  const firstName = teacherDisplayName.split(' ')[0];

  return (
    <div className="min-h-screen bg-[#020617] text-white flex justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-xl z-10 my-auto">
        
        {/* Header */}
        <div className="text-center mb-10 space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
            <CalendarDays className="text-blue-400" size={32} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase text-white leading-tight">
              Catch-Up with Teacher <span className="text-blue-500">{firstName}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-3 font-medium px-4">
              Please select a time slot below to secure your makeup session.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/10 rounded-[40px] p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          
          {/* Section 1: Time Slots */}
          <div className="mb-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
              <Clock size={12}/> Select Availability
            </h3>
            
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <div className="p-6 border border-white/5 bg-[#0f172a] rounded-2xl text-slate-500 text-center text-sm font-medium italic">
                  No upcoming catch-up slots are currently available.
                </div>
              ) : (
                sessions.map((session) => {
                  const isSelected = selectedSessionId === session.id;
                  const dateObj = new Date(session.session_date);
                  
                  return (
                    <label 
                      key={session.id} 
                      className={`block p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 group ${
                        isSelected 
                        ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
                        : 'bg-[#0f172a] border-white/5 hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <input 
                          type="radio" name="session" value={session.id} required
                          onChange={(e) => setSelectedSessionId(e.target.value)}
                          className="sr-only" 
                        />
                        <div>
                          <p className={`font-bold text-sm sm:text-base transition-colors ${isSelected ? 'text-blue-400' : 'text-white group-hover:text-blue-300'}`}>
                            {dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
                            <Clock size={12}/> {dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        
                        {/* Custom Radio Circle */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'border-blue-500' : 'border-slate-600 group-hover:border-slate-400'
                        }`}>
                          {isSelected && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                        </div>
                      </div>
                    </label>
                  )
                })
              )}

              {/* Fallback Option */}
              <label className={`block p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 group ${
                selectedSessionId === 'next_month' 
                ? 'bg-purple-600/10 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]' 
                : 'bg-[#0f172a] border-white/5 hover:border-white/20 hover:bg-white/[0.04]'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <input 
                    type="radio" name="session" value="next_month" required
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="sr-only" 
                  />
                  <div>
                    <p className={`font-bold text-sm sm:text-base transition-colors ${selectedSessionId === 'next_month' ? 'text-purple-400' : 'text-white group-hover:text-purple-300'}`}>
                      None of these work for me
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
                      <CalendarX size={12}/> Request a deferral to next month
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedSessionId === 'next_month' ? 'border-purple-500' : 'border-slate-600 group-hover:border-slate-400'
                  }`}>
                    {selectedSessionId === 'next_month' && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full" />}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Details */}
          <div className="space-y-5 mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
              <User size={12}/> Booking Details
            </h3>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={16} className="text-slate-500" />
              </div>
              <input 
                type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-[#020617] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-slate-600 placeholder:font-medium focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Student's Full Name"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail size={16} className="text-slate-500" />
              </div>
              <input 
                type="email" required value={parentEmail} onChange={(e) => setParentEmail(e.target.value)}
                className="w-full bg-[#020617] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-slate-600 placeholder:font-medium focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Parent's Email Address (For MS Teams invite)"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isSubmitting || !selectedSessionId}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isSubmitting ? (
              <><Loader2 size={16} className="animate-spin"/> Processing...</>
            ) : (
              <>Confirm Booking <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}