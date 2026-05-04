"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Loader2, Calendar as CalendarIcon, Link as LinkIcon, 
    Plus, User, Bell, Check, X, ChevronLeft, MapPin, Video, CheckCircle2,
    Trash2, Save, Repeat, CalendarDays, Lock, UserMinus, Settings2, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ScheduleSlot = {
  id: string;
  day_of_week: string;
  time_slot: string;
  status: 'available' | 'booked' | 'tentative' | 'blocked';
  delivery_mode: 'online' | 'in-person';
  slot_type: 'recurring' | 'once-off';
  student_ids: string[];
};

type PendingBooking = {
  id: string;
  schedule_id: string;
  teacher_schedule: {
    day_of_week: string;
    time_slot: string;
  };
};

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ALL_HOURS = Array.from({ length: 14 }).map((_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 07:00 to 20:00

export default function TeacherSchedulePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // --- NEW: ADMIN TEACHER CONTEXT STATE ---
  const [educators, setEducators] = useState<any[]>([]);
  const [activeTeacherId, setActiveTeacherId] = useState<string>("");
  
  // --- GRID CONFIGURATION STATE ---
  const [activeDays, setActiveDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  // Modal States
  const [activeSlotData, setActiveSlotData] = useState<{ day: string, time: string, existingSlot?: ScheduleSlot } | null>(null);
  const [slotConfig, setSlotConfig] = useState<{ delivery: 'online'|'in-person', type: 'recurring'|'once-off', studentIds: string[], isBlocked: boolean }>({
    delivery: 'in-person', type: 'recurring', studentIds: [], isBlocked: false
  });
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("");
  
  const [approvalModal, setApprovalModal] = useState<PendingBooking | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reusable fetch function so Admins can swap contexts
  const fetchScheduleData = async (teacherId: string) => {
    setLoading(true);
    try {
      const { data: scheduleData } = await supabase.from('teacher_schedule').select(`*`).eq('teacher_id', teacherId);
      const { data: studentData } = await supabase.from('profiles').select('id, display_name, metadata').eq('role', 'student');
      const { data: pendingData } = await supabase.from('pending_bookings').select(`id, schedule_id, teacher_schedule!inner(day_of_week, time_slot, teacher_id)`).eq('status', 'pending').eq('teacher_schedule.teacher_id', teacherId);

      if (scheduleData) setSchedule(scheduleData as ScheduleSlot[]);
      if (pendingData) setPendingBookings(pendingData as any[]);
      
      if (studentData) {
        setAllStudents(studentData);
        const teacherStudents = studentData.filter(student => {
          try {
            const meta = typeof student.metadata === 'string' ? JSON.parse(student.metadata) : student.metadata;
            return meta?.teacher?.id === teacherId;
          } catch (e) { return false; }
        });
        setMyStudents(teacherStudents);
      }
    } catch (error) { console.error("Error loading data:", error); } 
    finally { setLoading(false); }
  };

  const loadData = async () => {
    const sessionData = localStorage.getItem("pioneer_session");
    if (!sessionData) return; 
    const user = JSON.parse(sessionData);
    setCurrentUser(user);

    const targetId = user.id;

    try {
      // If user is Admin, fetch the list of available educators
      if (user.role === 'admin') {
        const { data: edData } = await supabase.from('profiles').select('id, display_name').eq('role', 'educator').order('display_name');
        if (edData) setEducators(edData);
      }
      
      setActiveTeacherId(targetId);
      await fetchScheduleData(targetId);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- ADMIN: SWITCH TEACHER CONTEXT ---
  const handleTeacherChange = async (newTeacherId: string) => {
    setActiveTeacherId(newTeacherId);
    await fetchScheduleData(newTeacherId);
  };

  // --- COMPUTED METRICS ---
  const dynamicHours = useMemo(() => {
    const startIdx = ALL_HOURS.indexOf(startTime);
    const endIdx = ALL_HOURS.indexOf(endTime);
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return ["09:00"];
    return ALL_HOURS.slice(startIdx, endIdx + 1);
  }, [startTime, endTime]);

  const unassignedStudents = useMemo(() => {
    const assignedIds = new Set(schedule.flatMap(s => s.student_ids || []));
    return myStudents.filter(s => !assignedIds.has(s.id));
  }, [myStudents, schedule]);

  const dailyMetrics = useMemo(() => {
    return activeDays.map(day => {
      const daySlots = schedule.filter(s => s.day_of_week === day && s.status === 'booked');
      return {
        day,
        recurring: daySlots.filter(s => s.slot_type === 'recurring').length,
        onceOff: daySlots.filter(s => s.slot_type === 'once-off').length,
      };
    });
  }, [activeDays, schedule]);

  // --- ACTIONS ---
  const handleGenerateLink = async () => {
    if (!activeTeacherId) return;
    setIsGeneratingLink(true);
    try {
      const creditsStr = window.prompt("How many children is this parent booking for? (Enter 1 or 2)", "1");
      const credits = parseInt(creditsStr || "1");
      if (isNaN(credits) || credits < 1) return;

      const { data, error } = await supabase.from('booking_links').insert({ teacher_id: activeTeacherId, credits: credits, status: 'active' }).select('id').single();
      if (error) throw error;
      const bookingUrl = `${window.location.origin}/booking/${data.id}`;
      await navigator.clipboard.writeText(bookingUrl);
      alert(`Link copied to clipboard!\nCredits: ${credits}\n\n${bookingUrl}`);
    } catch (err) { alert("Failed to generate link."); } 
    finally { setIsGeneratingLink(false); }
  };

  const openTimeslotModal = (day: string, time: string, existingSlot?: ScheduleSlot) => {
    setActiveSlotData({ day, time, existingSlot });
    if (existingSlot) {
      setSlotConfig({
        delivery: existingSlot.delivery_mode || 'in-person',
        type: existingSlot.slot_type || 'recurring',
        studentIds: existingSlot.student_ids || [],
        isBlocked: existingSlot.status === 'blocked'
      });
    } else {
      setSlotConfig({ delivery: 'in-person', type: 'recurring', studentIds: [], isBlocked: false });
    }
    setSelectedStudentToAdd("");
  };

  const handleSaveTimeslot = async () => {
    if (!activeSlotData || !activeTeacherId) return;
    setIsSaving(true);
    const pgTime = `${activeSlotData.time}:00`;
    
    // Auto-resolve status
    let determinedStatus = slotConfig.studentIds.length > 0 ? 'booked' : 'available';
    if (slotConfig.isBlocked) determinedStatus = 'blocked';

    try {
      const { error } = await supabase.from('teacher_schedule').upsert({
          teacher_id: activeTeacherId,
          day_of_week: activeSlotData.day,
          time_slot: pgTime,
          status: determinedStatus,
          delivery_mode: slotConfig.delivery,
          slot_type: slotConfig.type,
          student_ids: slotConfig.isBlocked ? [] : slotConfig.studentIds // Clear students if blocked
        }, { onConflict: 'teacher_id, day_of_week, time_slot' });

      if (error) throw error;
      await fetchScheduleData(activeTeacherId); 
    } catch (err: any) { alert(`Failed to save slot: ${err.message}`); } 
    finally { setIsSaving(false); setActiveSlotData(null); }
  };

  const handleDeleteTimeslot = async () => {
    if (!activeSlotData?.existingSlot?.id) return;
    setIsSaving(true);
    await supabase.from('teacher_schedule').delete().eq('id', activeSlotData.existingSlot.id);
    await fetchScheduleData(activeTeacherId);
    setIsSaving(false);
    setActiveSlotData(null);
  };

  const handleApproveRequest = async () => {
    if (!approvalModal || !selectedStudentToAdd) return;
    const slotToUpdate = schedule.find(s => s.id === approvalModal.schedule_id);
    const currentIds = slotToUpdate?.student_ids || [];
    
    if (slotToUpdate?.delivery_mode === 'online' && currentIds.length >= 1) {
        alert("This online slot is already at full capacity (1). Reject request or clear the slot.");
        return;
    }

    const newIds = [...new Set([...currentIds, selectedStudentToAdd])];

    await supabase.from('teacher_schedule').update({ status: 'booked', student_ids: newIds }).eq('id', approvalModal.schedule_id);
    await supabase.from('pending_bookings').update({ status: 'approved' }).eq('id', approvalModal.id);

    setApprovalModal(null);
    setSelectedStudentToAdd("");
    fetchScheduleData(activeTeacherId);
  };

  const handleRejectRequest = async (pendingId: string, scheduleId: string) => {
    if (!confirm("Reject this booking?")) return;
    const slotToUpdate = schedule.find(s => s.id === scheduleId);
    
    if (slotToUpdate && (!slotToUpdate.student_ids || slotToUpdate.student_ids.length === 0)) {
       await supabase.from('teacher_schedule').update({ status: 'available' }).eq('id', scheduleId);
    }
    
    await supabase.from('pending_bookings').update({ status: 'rejected' }).eq('id', pendingId);
    fetchScheduleData(activeTeacherId);
  };

  const toggleDay = (day: string) => {
    setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a,b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b)));
  };

  const getSlotDetails = (day: string, time: string) => schedule.find(s => s.day_of_week === day && s.time_slot.startsWith(time));

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <main className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans selection:bg-blue-500/30">
      
      {/* HEADER & ADMIN SELECTOR */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
        <div>
          <button onClick={() => window.location.href = currentUser?.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard'} className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
             <ChevronLeft size={14} /> Back to Dashboard
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center gap-4">
              <h1 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                <CalendarIcon className="text-blue-500" /> Matrix Schedule
              </h1>
              
              {/* ADMIN: TEACHER SELECTOR */}
              {currentUser?.role === 'admin' && educators.length > 0 && (
                  <div className="flex items-center gap-2 bg-[#0f172a] border border-white/10 px-3 py-2 rounded-xl shadow-inner">
                      <User size={14} className="text-slate-500 shrink-0" />
                      <select 
                          value={activeTeacherId}
                          onChange={(e) => handleTeacherChange(e.target.value)}
                          className="bg-transparent text-blue-400 font-bold text-sm outline-none appearance-none cursor-pointer pr-4"
                      >
                          <option value={currentUser.id}>My Schedule (Admin)</option>
                          {educators.map(ed => (
                              <option key={ed.id} value={ed.id}>{ed.display_name}'s Roster</option>
                          ))}
                      </select>
                      <ChevronDown size={14} className="text-slate-500 pointer-events-none shrink-0" />
                  </div>
              )}
          </div>
        </div>
        
        <button onClick={handleGenerateLink} disabled={isGeneratingLink} className="flex items-center justify-center gap-2 px-6 py-3.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:scale-105 w-full sm:w-auto">
          {isGeneratingLink ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />} Generate Booking Link
        </button>
      </div>

      {/* APPROVAL INBOX (For Selected Context) */}
      {pendingBookings.length > 0 && (
        <div className="max-w-7xl mx-auto mb-8 bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 shadow-xl">
          <h2 className="text-amber-500 font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
            <Bell size={16} /> Pending Approvals ({pendingBookings.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pendingBookings.map(req => (
              <div key={req.id} className="bg-[#020617]/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{req.teacher_schedule.day_of_week}</p>
                  <p className="text-lg font-bold text-white">{req.teacher_schedule.time_slot.substring(0,5)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRejectRequest(req.id, req.schedule_id)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"><X size={16} /></button>
                  <button onClick={() => setApprovalModal(req)} className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors"><Check size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- NEW SUMMARY COMMAND PANEL --- */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Config Panel */}
        <div className="lg:col-span-2 bg-[#0f172a]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
              <Settings2 size={14}/> Grid Configuration
            </h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {ALL_DAYS.map(day => (
                <button 
                  key={day} onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${activeDays.includes(day) ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'}`}
                >
                  {day.substring(0,3)}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-4 border-t border-white/5 pt-4">
              <div className="space-y-1 w-full max-w-[120px]">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Day Start</label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500 text-xs font-bold appearance-none">
                  {ALL_HOURS.map(h => <option key={`start-${h}`} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1 w-full max-w-[120px]">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Day End</label>
                <select value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500 text-xs font-bold appearance-none">
                  {ALL_HOURS.map(h => <option key={`end-${h}`} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>
          
          {/* Daily Metrics Mini-Bar */}
          <div className="mt-6 flex flex-wrap gap-4 pt-6 border-t border-white/5">
             {dailyMetrics.map(m => (
               <div key={m.day} className="flex flex-col items-start bg-black/30 p-2 px-3 rounded-lg border border-white/5">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.day.substring(0,3)}</span>
                 <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-white">
                   <span className="flex items-center gap-1 text-blue-400"><Repeat size={10}/> {m.recurring}</span>
                   <span className="flex items-center gap-1 text-purple-400"><CalendarDays size={10}/> {m.onceOff}</span>
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* Unassigned Students Alert */}
        <div className={`backdrop-blur-xl border rounded-3xl p-6 shadow-xl flex flex-col h-full ${unassignedStudents.length > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-[#0f172a]/50 border-white/10'}`}>
           <h2 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4 ${unassignedStudents.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
              <UserMinus size={14}/> Unscheduled Roster
           </h2>
           {unassignedStudents.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <CheckCircle2 size={32} className="text-emerald-500 mb-2"/>
                <p className="text-xs font-bold text-slate-400">All your students are scheduled.</p>
             </div>
           ) : (
             <>
               <div className="bg-[#020617]/50 rounded-2xl p-2 flex-1 overflow-y-auto custom-scrollbar border border-white/5 space-y-1">
                 {unassignedStudents.map(s => (
                   <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl">
                     <span className="text-xs font-bold text-white truncate">{s.display_name}</span>
                   </div>
                 ))}
               </div>
               <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/70 mt-3 text-center">
                 {unassignedStudents.length} Students Pending Assignment
               </p>
             </>
           )}
        </div>
      </div>

      {/* CALENDAR GRID */}
      {activeDays.length > 0 && dynamicHours.length > 0 ? (
        <div className="max-w-7xl mx-auto bg-[#0f172a]/50 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl overflow-x-auto">
          <div className="min-w-[800px]" style={{ minWidth: `${activeDays.length * 150}px` }}>
              <div className="flex border-b border-white/10 bg-black/60 shadow-inner">
                <div className="w-20 shrink-0 p-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-white/5">Time</div>
                {activeDays.map(day => (
                    <div key={day} className="flex-1 p-4 text-center text-xs md:text-sm font-black text-white uppercase tracking-widest border-r border-white/5 last:border-0">{day}</div>
                ))}
              </div>

              {dynamicHours.map(time => (
              <div key={time} className="flex border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.01]">
                  <div className="w-20 shrink-0 p-2 flex items-center justify-center text-[10px] md:text-xs font-bold text-slate-500 border-r border-white/5 bg-black/40">{time}</div>
                  
                  {activeDays.map(day => {
                    const slot = getSlotDetails(day, time);
                    const isTentative = slot?.status === 'tentative';
                    
                    if (!slot) {
                      // BLANK SLOT
                      return (
                        <button
                            key={`${day}-${time}`}
                            onClick={() => openTimeslotModal(day, time)}
                            className="flex-1 relative p-1.5 md:p-2 border-r border-white/5 last:border-0 h-20 transition-all flex flex-col items-center justify-center group outline-none hover:bg-white/5 cursor-pointer"
                        >
                            <div className="w-8 h-8 rounded-full border border-dashed border-slate-600 flex items-center justify-center group-hover:border-white/30 transition-colors">
                                <Plus size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                      )
                    }

                    // BLOCKED SLOT
                    if (slot.status === 'blocked') {
                       return (
                        <button
                            key={`${day}-${time}`}
                            onClick={() => openTimeslotModal(day, time, slot)}
                            className="flex-1 relative p-1.5 md:p-2 border-r border-white/5 last:border-0 h-20 transition-all flex flex-col items-center justify-center group outline-none bg-rose-500/5 hover:bg-rose-500/10 cursor-pointer shadow-inner"
                        >
                            <Lock size={16} className="text-rose-500/50 mb-1" />
                            <span className="text-[8px] font-black uppercase text-rose-500/50 tracking-widest">Blocked</span>
                        </button>
                       )
                    }

                    // CONFIGURED SLOT
                    const isOnline = slot.delivery_mode === 'online';
                    const isRecurring = slot.slot_type === 'recurring';
                    const assignedCount = slot.student_ids?.length || 0;
                    const baseColor = isRecurring ? 'blue' : 'purple';
                    const Icon = isOnline ? Video : MapPin;

                    return (
                        <button
                          key={`${day}-${time}`}
                          onClick={() => !isTentative && openTimeslotModal(day, time, slot)}
                          disabled={isTentative}
                          className={`flex-1 relative p-1.5 md:p-2 border-r border-white/5 last:border-0 h-20 transition-all flex flex-col items-center justify-center gap-1.5 group outline-none focus:bg-white/5 cursor-pointer ${
                              isTentative ? 'bg-amber-500/10 cursor-not-allowed shadow-inner' : `bg-${baseColor}-500/10 hover:bg-${baseColor}-500/20 shadow-inner`
                          }`}
                        >
                          {isTentative ? (
                              <span className="text-[7px] md:text-[8px] font-black uppercase text-amber-500 tracking-widest bg-amber-500/10 border border-amber-500/20 px-1.5 py-1 rounded-md text-center shadow-inner leading-tight">Awaiting<br/>Approval</span>
                          ) : (
                              <>
                                <div className={`w-8 h-8 rounded-lg bg-${baseColor}-500/20 flex items-center justify-center border border-${baseColor}-500/30 shadow-[0_0_15px_rgba(0,0,0,0.2)] shrink-0`}>
                                    <Icon size={12} className={`text-${baseColor}-400`} />
                                </div>
                                <span className={`text-[10px] font-bold text-${baseColor}-100 text-center leading-tight line-clamp-1 px-1`}>
                                  {assignedCount === 0 ? <span className="italic text-slate-400 text-[9px]">Open Slot</span> :
                                  assignedCount === 1 ? (() => {
                                      const name = allStudents.find(s => s.id === slot.student_ids[0])?.display_name || "Unknown";
                                      return name.split(' ')[0]; 
                                  })() :
                                  `${assignedCount} Students`
                                  }
                                </span>
                              </>
                          )}
                        </button>
                    );
                  })}
              </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto p-12 text-center bg-[#0f172a]/50 rounded-[32px] border border-white/10">
          <p className="text-slate-500 font-bold">Please select at least one day and a valid time range.</p>
        </div>
      )}

      {/* --- TIMESLOT MANAGER MODAL --- */}
      <AnimatePresence>
      {activeSlotData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0f172a] border border-white/10 p-6 md:p-8 rounded-[32px] max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            
            <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
               <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Manage Timeslot</h3>
                  <p className="text-slate-400 text-sm mt-1">Configuring slot for <strong className="text-white">{activeSlotData.day} at {activeSlotData.time}</strong></p>
               </div>
               {/* Quick Block Toggle Button */}
               <button 
                  onClick={() => setSlotConfig(p => ({...p, isBlocked: !p.isBlocked}))}
                  className={`p-2 rounded-xl border transition-all ${slotConfig.isBlocked ? 'bg-rose-500/20 border-rose-500/40 text-rose-500' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
                  title={slotConfig.isBlocked ? "Unblock Slot" : "Block Slot"}
               >
                 <Lock size={18} />
               </button>
            </div>
            
            {slotConfig.isBlocked ? (
              <div className="py-8 text-center bg-rose-500/5 border border-rose-500/10 rounded-2xl mb-8">
                <Lock size={32} className="mx-auto text-rose-500/50 mb-3" />
                <p className="text-sm font-bold text-rose-400">This slot is locked.</p>
                <p className="text-xs text-rose-400/70 mt-1">No bookings can be made here.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Type Toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setSlotConfig(p => ({...p, delivery: 'in-person'}))} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${slotConfig.delivery === 'in-person' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/30 border-white/5 text-slate-500 hover:text-white'}`}>
                    <MapPin size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">In-Person</span>
                  </button>
                  <button onClick={() => { if (slotConfig.studentIds.length > 1) return alert("Online slots max 1 student. Remove students first."); setSlotConfig(p => ({...p, delivery: 'online'})) }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${slotConfig.delivery === 'online' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-black/30 border-white/5 text-slate-500 hover:text-white'}`}>
                    <Video size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">Online</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setSlotConfig(p => ({...p, type: 'recurring'}))} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${slotConfig.type === 'recurring' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-black/30 border-white/5 text-slate-500 hover:text-white'}`}>
                    <Repeat size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">Recurring</span>
                  </button>
                  <button onClick={() => setSlotConfig(p => ({...p, type: 'once-off'}))} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${slotConfig.type === 'once-off' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-black/30 border-white/5 text-slate-500 hover:text-white'}`}>
                    <CalendarDays size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">Once-Off</span>
                  </button>
                </div>

                {/* Roster Management */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Roster</p>
                    <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">{slotConfig.studentIds.length}</span>
                  </div>
                  
                  <div className="space-y-2 mb-4 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                    {slotConfig.studentIds.length === 0 ? (
                      <p className="text-xs text-slate-500 italic font-bold">No students assigned. <br/>Saving will keep slot open for bookings.</p>
                    ) : (
                      slotConfig.studentIds.map(id => {
                        const s = allStudents.find(stu => stu.id === id);
                        return (
                          <div key={id} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg group">
                            <span className="text-sm font-bold text-white">{s?.display_name || "Unknown"}</span>
                            <button onClick={() => setSlotConfig(p => ({...p, studentIds: p.studentIds.filter(sid => sid !== id)}))} className="text-rose-500 opacity-50 hover:opacity-100 transition-opacity"><X size={14}/></button>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {myStudents.length > 0 && (slotConfig.delivery === 'in-person' || slotConfig.studentIds.length === 0) && (
                      <div className="relative">
                          <select 
                              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500 transition-colors appearance-none font-bold text-sm shadow-inner"
                              value={selectedStudentToAdd}
                              onChange={(e) => {
                                const newId = e.target.value;
                                if(newId && !slotConfig.studentIds.includes(newId)) setSlotConfig(p => ({...p, studentIds: [...p.studentIds, newId]}));
                                setSelectedStudentToAdd("");
                              }}
                          >
                              <option value="" disabled>+ Assign a student to this slot...</option>
                              {myStudents.filter(s => !slotConfig.studentIds.includes(s.id)).map(s => (
                                  <option key={s.id} value={s.id}>{s.display_name}</option>
                              ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                      </div>
                  )}
                  {slotConfig.delivery === 'online' && slotConfig.studentIds.length >= 1 && (
                    <div className="p-3 border border-amber-500/20 bg-amber-500/10 rounded-xl mt-2">
                        <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest text-center">Online capacity reached (1 Max)</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={() => setActiveSlotData(null)} className="flex-1 py-4 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors text-slate-300">Cancel</button>
              
              {/* Reset/Delete Button */}
              {activeSlotData.existingSlot && (
                  <button onClick={handleDeleteTimeslot} disabled={isSaving} className="px-4 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors" title="Clear Slot Entirely"><Trash2 size={16}/></button>
              )}
              
              <button onClick={handleSaveTimeslot} disabled={isSaving} className={`flex-1 py-4 rounded-xl disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 ${slotConfig.isBlocked ? 'bg-rose-600 hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.3)]' : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]'}`}>
                {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} {slotConfig.isBlocked ? 'Lock Slot' : 'Save Slot'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* PARENT APPROVAL MODAL */}
      <AnimatePresence>
      {approvalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0f172a] border border-white/10 p-6 md:p-8 rounded-[32px] max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-2xl font-black italic uppercase mb-2 tracking-tighter text-white">Approve Booking</h3>
            <p className="text-slate-400 text-sm mb-6 border-b border-white/5 pb-4">Assigning for <strong className="text-white">{approvalModal.teacher_schedule.day_of_week} at {approvalModal.teacher_schedule.time_slot.substring(0,5)}</strong></p>
            
            {myStudents.length === 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-xs mb-6 text-center font-bold">No students currently assigned to you.</div>
            ) : (
                <div className="relative mb-6">
                    <select 
                        className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-colors appearance-none font-bold text-sm shadow-inner"
                        value={selectedStudentToAdd}
                        onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                    >
                        <option value="" disabled>Select a student to approve...</option>
                        {myStudents.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setApprovalModal(null)} className="flex-1 py-4 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors text-slate-300">Cancel</button>
              <button onClick={handleApproveRequest} disabled={!selectedStudentToAdd} className="flex-1 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.02] transition-all">Confirm Approval</button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

    </main>
  );
}