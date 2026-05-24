'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Booking {
  student_name: string;
}

interface Teacher {
  id: string;
  display_name: string;
}

interface AdminSession {
  id: string;
  session_date: string;
  status: string;
  teacher_id: string;
  catchup_bookings: Booking[];
  profiles: { display_name: string };
}

interface NextMonthBooking {
  id: string;
  student_name: string;
  parent_email: string;
  created_at: string;
}

export default function AdminCatchupDispatch() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [nextMonthBookings, setNextMonthBookings] = useState<NextMonthBooking[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [teamsLinks, setTeamsLinks] = useState<{ [key: string]: string }>({});
  const [reassignSelections, setReassignSelections] = useState<{ [key: string]: string }>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    setLoading(true);

    const { data: sessionData } = await supabase
      .from('catchup_sessions')
      .select(`id, session_date, status, teacher_id, catchup_bookings ( student_name ), profiles ( display_name )`)
      .in('status', ['Pending Admin Link', 'Pending Admin Reassignment'])
      .order('session_date', { ascending: true });
    
    if (sessionData) setSessions(sessionData as unknown as AdminSession[]);

    const { data: teacherData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('role', 'educator');
      
    if (teacherData) setTeachers(teacherData);

    // FETCH "NEXT MONTH" DEFERRALS
    const { data: nmData } = await supabase
      .from('catchup_bookings')
      .select('id, student_name, parent_email, created_at')
      .eq('status', 'Moved to Next Month')
      .order('created_at', { ascending: false });
      
    if (nmData) setNextMonthBookings(nmData);

    setLoading(false);
  }

  const handleDispatchLink = async (sessionId: string) => {
    const link = teamsLinks[sessionId];
    if (!link) return alert('Please enter a valid MS Teams link.');
    setProcessingId(sessionId);

    const { error } = await supabase.from('catchup_sessions').update({ teams_link: link, status: 'Confirmed & Dispatched' }).eq('id', sessionId);
    if (!error) setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    else alert('Failed to dispatch link.');
    
    setProcessingId(null);
  };

  const handleReassign = async (sessionId: string) => {
    const newTeacherId = reassignSelections[sessionId];
    if (!newTeacherId) return alert('Please select a new teacher.');
    setProcessingId(sessionId);

    const { error } = await supabase.from('catchup_sessions').update({ teacher_id: newTeacherId, status: 'Pending Teacher' }).eq('id', sessionId);
    if (!error) setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    else alert('Failed to reassign teacher.');
    
    setProcessingId(null);
  };

  const handleClearNextMonth = async (bookingId: string) => {
    setProcessingId(bookingId);
    // Move status to Confirmed so it drops off the queue once you've acknowledged it
    const { error } = await supabase.from('catchup_bookings').update({ status: 'Confirmed' }).eq('id', bookingId);
    if (!error) setNextMonthBookings((prev) => prev.filter((b) => b.id !== bookingId));
    else alert('Failed to clear request.');
    setProcessingId(null);
  };

  if (loading) return <div className="p-4 border border-white/10 rounded-2xl animate-pulse bg-white/5 h-32"></div>;

  const needsLink = sessions.filter(s => s.status === 'Pending Admin Link');
  const needsReassignment = sessions.filter(s => s.status === 'Pending Admin Reassignment');

  return (
    <div className="space-y-8">
      
      {/* SECTION 1: Needs Teams Link */}
      <div className="p-6 border border-white/10 rounded-[24px] bg-[#0f172a] shadow-sm border-t-4 border-t-blue-500">
        <h3 className="text-lg font-black uppercase tracking-tight text-white mb-4 flex items-center">
          <span className="bg-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full mr-3">{needsLink.length}</span>
          Action Required: Dispatch Teams Links
        </h3>
        
        {needsLink.length === 0 ? (
          <p className="text-slate-500 text-sm font-bold italic">All confirmed sessions have their links.</p>
        ) : (
          <div className="space-y-4">
            {needsLink.map((session) => (
              <div key={session.id} className="p-5 border border-white/5 bg-[#020617] rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p className="font-bold text-white">
                    {new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-slate-400 mt-1"><strong>Teacher:</strong> {session.profiles?.display_name}</p>
                  <p className="text-sm text-slate-400"><strong>Students:</strong> {session.catchup_bookings.map(b => b.student_name).join(', ')}</p>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                  <input 
                    type="url" placeholder="Paste MS Teams URL..." value={teamsLinks[session.id] || ''}
                    onChange={(e) => setTeamsLinks({ ...teamsLinks, [session.id]: e.target.value })}
                    className="flex-1 p-3 bg-[#0f172a] border border-white/10 rounded-xl text-sm font-bold text-white focus:border-blue-500 min-w-[250px] outline-none"
                  />
                  <button 
                    onClick={() => handleDispatchLink(session.id)} disabled={processingId === session.id}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg disabled:opacity-50 whitespace-nowrap"
                  >
                    {processingId === session.id ? 'Dispatching...' : 'Dispatch'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Needs Reassignment */}
      <div className="p-6 border border-white/10 rounded-[24px] bg-[#0f172a] shadow-sm border-t-4 border-t-rose-500">
        <h3 className="text-lg font-black uppercase tracking-tight text-white mb-4 flex items-center">
          <span className="bg-rose-500/20 text-rose-400 text-xs px-3 py-1 rounded-full mr-3">{needsReassignment.length}</span>
          Action Required: Declined Reassignments
        </h3>
        
        {needsReassignment.length === 0 ? (
          <p className="text-slate-500 text-sm font-bold italic">No declined sessions require reassignment.</p>
        ) : (
          <div className="space-y-4">
            {needsReassignment.map((session) => (
              <div key={session.id} className="p-5 border border-rose-500/20 bg-rose-500/5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p className="font-bold text-white">
                    {new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-rose-400 mt-1"><strong>Declined By:</strong> {session.profiles?.display_name}</p>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                  <select 
                    value={reassignSelections[session.id] || ''}
                    onChange={(e) => setReassignSelections({ ...reassignSelections, [session.id]: e.target.value })}
                    className="flex-1 p-3 bg-[#020617] border border-white/10 rounded-xl text-sm font-bold text-slate-300 outline-none focus:border-rose-500 min-w-[200px]"
                  >
                    <option value="">Select new teacher...</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                  </select>
                  <button 
                    onClick={() => handleReassign(session.id)} disabled={processingId === session.id}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg disabled:opacity-50 whitespace-nowrap"
                  >
                    {processingId === session.id ? 'Reassigning...' : 'Reassign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: Next Month Requests */}
      <div className="p-6 border border-white/10 rounded-[24px] bg-[#0f172a] shadow-sm border-t-4 border-t-amber-500">
        <h3 className="text-lg font-black uppercase tracking-tight text-white mb-4 flex items-center">
          <span className="bg-amber-500/20 text-amber-400 text-xs px-3 py-1 rounded-full mr-3">{nextMonthBookings.length}</span>
          Action Required: Deferred to Next Month
        </h3>
        
        {nextMonthBookings.length === 0 ? (
          <p className="text-slate-500 text-sm font-bold italic">No deferred requests pending.</p>
        ) : (
          <div className="space-y-4">
            {nextMonthBookings.map((booking) => (
              <div key={booking.id} className="p-5 border border-white/5 bg-[#020617] rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p className="font-bold text-white">{booking.student_name}</p>
                  <p className="text-sm text-slate-400 mt-1"><strong>Contact:</strong> {booking.parent_email}</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2">Requested: {new Date(booking.created_at).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => handleClearNextMonth(booking.id)} disabled={processingId === booking.id}
                  className="px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg disabled:opacity-50 whitespace-nowrap w-full md:w-auto"
                >
                  {processingId === booking.id ? 'Clearing...' : 'Mark as Actioned'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}