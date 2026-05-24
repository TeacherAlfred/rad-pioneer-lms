'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize standard client (Ensure these env variables are exposed to the browser)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Booking {
  student_name: string;
}

interface PendingSession {
  id: string;
  session_date: string;
  catchup_bookings: Booking[];
}

export default function TeacherCatchupQueue({ teacherId }: { teacherId: string }) {
  const [pendingSessions, setPendingSessions] = useState<PendingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingRequests();
  }, [teacherId]);

  async function fetchPendingRequests() {
    setLoading(true);
    // Fetch sessions AND the related student names using Supabase's foreign key relationship
    const { data, error } = await supabase
      .from('catchup_sessions')
      .select(`
        id, 
        session_date,
        catchup_bookings ( student_name )
      `)
      .eq('teacher_id', teacherId)
      .eq('status', 'Pending Teacher')
      .order('session_date', { ascending: true });

    if (data) setPendingSessions(data as PendingSession[]);
    setLoading(false);
  }

  const handleAction = async (sessionId: string, action: 'Confirm' | 'Decline') => {
    setProcessingId(sessionId);
    
    // Determine the next status based on the teacher's choice
    const newStatus = action === 'Confirm' ? 'Pending Admin Link' : 'Pending Admin Reassignment';

    const { error } = await supabase
      .from('catchup_sessions')
      .update({ status: newStatus })
      .eq('id', sessionId);

    if (!error) {
      // Remove the processed session from the UI immediately
      setPendingSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } else {
      console.error(`Failed to ${action} session:`, error);
      alert('An error occurred. Please try again.');
    }
    
    setProcessingId(null);
  };

  if (loading) return <div className="p-4 border rounded-lg animate-pulse bg-gray-50">Loading requests...</div>;

  if (pendingSessions.length === 0) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50 text-center">
        <h3 className="text-lg font-semibold text-gray-700">Catch-Up Requests</h3>
        <p className="text-gray-500 mt-1">You have no pending requests to review.</p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-[#0f172a] shadow-sm">
      <h3 className="text-lg font-bold text-white-800 mb-4 flex items-center">
        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full mr-2">
          {pendingSessions.length}
        </span>
        Action Required: Catch-Up Requests
      </h3>
      
      <div className="space-y-4">
        {pendingSessions.map((session) => (
          <div key={session.id} className="p-4 border border-yellow-200 bg-yellow-50 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            
            {/* Session Info */}
            <div>
              <p className="font-semibold text-gray-800">
                {new Date(session.session_date).toLocaleDateString('en-US', { 
                  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                })}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Students:</strong> {session.catchup_bookings.map(b => b.student_name).join(', ')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => handleAction(session.id, 'Decline')}
                disabled={processingId === session.id}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-md transition disabled:opacity-50"
              >
                Decline
              </button>
              <button 
                onClick={() => handleAction(session.id, 'Confirm')}
                disabled={processingId === session.id}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition disabled:opacity-50"
              >
                {processingId === session.id ? 'Saving...' : 'Confirm Availability'}
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}