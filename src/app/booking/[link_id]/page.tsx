"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import { Loader2, CalendarCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import confetti from "canvas-confetti";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function ParentBookingPage() {
  const { link_id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingData, setBookingData] = useState<any>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [credits, setCredits] = useState(0);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    async function loadBookingSession() {
      try {
        // 1. Validate the link
        const { data: linkData, error: linkError } = await supabase
          .from('booking_links')
          .select('*, profiles!booking_links_teacher_id_fkey(display_name)') // Assuming teacher's name is in profiles
          .eq('id', link_id)
          .single();

        if (linkError || !linkData) throw new Error("Invalid or expired booking link.");
        if (linkData.status !== 'active' || linkData.credits <= 0) throw new Error("This booking link has already been used or has expired.");

        setBookingData(linkData);
        setCredits(linkData.credits);

        // 2. Fetch the teacher's schedule (ONLY available slots)
        const { data: scheduleData } = await supabase
          .from('teacher_schedule')
          .select('*')
          .eq('teacher_id', linkData.teacher_id);
          
        // We only want to show slots that are explicitly marked available OR don't exist yet
        setAvailableSlots(scheduleData || []);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBookingSession();
  }, [link_id]);

  const handleBookSlot = async (day: string, time: string) => {
    if (credits <= 0 || isBooking) return;
    setIsBooking(true);

    try {
      const pgTime = `${time}:00`;

      // 1. Check if the slot is still truly available (prevent double booking race condition)
      const { data: existingSlot } = await supabase
        .from('teacher_schedule')
        .select('*')
        .eq('teacher_id', bookingData.teacher_id)
        .eq('day_of_week', day)
        .eq('time_slot', pgTime)
        .single();

      if (existingSlot && existingSlot.status !== 'available') {
         alert("Sorry, another parent just booked this slot. Please choose another.");
         setIsBooking(false);
         return;
      }

      // 2. Upsert the schedule to 'tentative'
      const { data: newSchedule, error: scheduleError } = await supabase
        .from('teacher_schedule')
        .upsert({
          id: existingSlot?.id, // Use existing ID if it exists
          teacher_id: bookingData.teacher_id,
          day_of_week: day,
          time_slot: pgTime,
          status: 'tentative'
        }, { onConflict: 'teacher_id, day_of_week, time_slot' })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // 3. Create the pending booking record
      await supabase.from('pending_bookings').insert({
        booking_link_id: link_id,
        schedule_id: newSchedule.id,
        status: 'pending'
      });

      // 4. Update remaining credits
      const newCredits = credits - 1;
      await supabase.from('booking_links').update({ 
        credits: newCredits,
        status: newCredits === 0 ? 'completed' : 'active' 
      }).eq('id', link_id);

      setCredits(newCredits);
      setAvailableSlots(prev => [...prev.filter(s => s.id !== newSchedule.id), newSchedule]);
      
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

    } catch (err) {
      console.error(err);
      alert("Failed to secure slot. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const getSlotStatus = (day: string, time: string) => {
    return availableSlots.find(s => s.day_of_week === day && s.time_slot.startsWith(time))?.status || 'available';
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  if (error || credits === 0) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
          {credits === 0 ? <CheckCircle2 className="text-emerald-500 w-10 h-10" /> : <AlertTriangle className="text-amber-500 w-10 h-10" />}
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">
          {credits === 0 ? "Booking Complete" : "Access Denied"}
        </h2>
        <p className="text-slate-400 max-w-md">
          {credits === 0 
            ? "Your slots have been successfully submitted for teacher approval. You will receive an email confirmation shortly." 
            : error}
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans">
      
      {/* Header */}
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center mb-10">
        <div className="bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20 mb-6">
          Parent Booking Portal
        </div>
        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">Secure Your Slot</h1>
        <p className="text-slate-400 max-w-xl">
          Select a recurring weekly timeslot for your child with <strong className="text-white">{bookingData?.profiles?.display_name || "your teacher"}</strong>. 
        </p>
        
        {/* Credit Counter */}
        <div className="mt-8 bg-[#0f172a] border border-white/10 px-8 py-4 rounded-2xl flex items-center gap-4 shadow-xl">
          <CalendarCheck className="text-fuchsia-500" />
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Remaining Slots</p>
            <p className="text-xl font-black text-fuchsia-400">{credits} {credits === 1 ? 'Child' : 'Children'}</p>
          </div>
        </div>
      </div>

      {/* Simplified Mobile-Friendly Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS.map(day => (
          <div key={day} className="bg-[#0f172a]/50 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl flex flex-col">
            <div className="bg-black/40 p-4 text-center border-b border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest">{day}</h3>
            </div>
            <div className="p-2 space-y-2 flex-1">
              {HOURS.map(time => {
                const status = getSlotStatus(day, time);
                const isAvailable = status === 'available';

                return (
                  <button
                    key={`${day}-${time}`}
                    disabled={!isAvailable || isBooking}
                    onClick={() => handleBookSlot(day, time)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                      isAvailable 
                        ? 'bg-white/5 hover:bg-blue-600 border border-white/5 hover:border-blue-500 cursor-pointer group' 
                        : status === 'tentative'
                          ? 'bg-amber-500/5 border border-amber-500/10 opacity-50 cursor-not-allowed'
                          : 'bg-black/40 border border-transparent opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <span className={`text-xs font-bold ${isAvailable ? 'group-hover:text-white text-slate-300' : 'text-slate-600'}`}>{time}</span>
                    {isAvailable && <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity group-hover:text-white">Select</span>}
                    {!isAvailable && <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{status === 'tentative' ? 'Pending' : 'Booked'}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </main>
  );
}