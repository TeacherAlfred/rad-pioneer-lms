"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Loader2, Calendar as CalendarIcon, Link as LinkIcon, 
  Plus, User, Bell, Check, X, ChevronLeft, MapPin, Video, CheckCircle2,
  Trash2, Save, Repeat, CalendarDays, Lock, UserMinus, Settings2, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type LessonInstance = {
  id: string;
  student_id: string;
  teacher_id: string;
  start_time: string;
  topic: string;
  delivery_mode: 'online' | 'in-person';
  location_or_link: string;
  attendance_status: string;
  student?: { display_name: string };
};

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ALL_HOURS = Array.from({ length: 14 }).map((_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 07:00 to 20:00
const MAX_GROUP_SIZE = 4; // Online lessons are small-group, capped at 4 students per slot

export default function TeacherSchedulePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [schedule, setSchedule] = useState<LessonInstance[]>([]);
  
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ADMIN TEACHER CONTEXT STATE
  const [educators, setEducators] = useState<any[]>([]);
  const [activeTeacherId, setActiveTeacherId] = useState<string>("");
  
  // GRID CONFIGURATION STATE
  const [activeDays, setActiveDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  // Modal States
  const [activeSlotData, setActiveSlotData] = useState<{ dateObj: Date, lessons: LessonInstance[] } | null>(null);
  const [slotConfig, setSlotConfig] = useState<{ delivery: 'online'|'in-person', type: 'recurring'|'once-off', studentIds: string[], logistics: string }>({
    delivery: 'in-person', type: 'recurring', studentIds: [], logistics: ''
  });
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("");
  
  const [approvalModal, setApprovalModal] = useState<any | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- DYNAMIC CURRENT WEEK CALCULATION ---
  const currentWeekDates = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); 
    const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }).map((_, i) => {
       const d = new Date(monday);
       d.setDate(monday.getDate() + i);
       return {
         dayName: ALL_DAYS[i],
         dateObj: d,
         label: `${ALL_DAYS[i].substring(0,3)} ${d.getDate()}`
       };
    });
  }, []);

  const fetchScheduleData = async (teacherId: string) => {
    setLoading(true);
    try {
      const weekStart = currentWeekDates[0].dateObj.toISOString();
      const weekEnd = new Date(currentWeekDates[6].dateObj.getTime() + 24 * 60 * 60 * 1000).toISOString();

      // Fetch actual lessons for the current week
      const { data: scheduleData } = await supabase
        .from('lesson_schedule')
        .select(`*, student:profiles!lesson_schedule_student_id_fkey(display_name)`)
        .eq('teacher_id', teacherId)
        .gte('start_time', weekStart)
        .lte('start_time', weekEnd);

      const { data: studentData } = await supabase.from('profiles').select('id, display_name, metadata').eq('role', 'student');
      
      // Fallback pending bookings fetch
      const { data: pendingData } = await supabase.from('pending_bookings').select(`*`).eq('status', 'pending');

      if (scheduleData) setSchedule(scheduleData as any[]);
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

    try {
      if (user.role === 'admin') {
        const { data: edData } = await supabase.from('profiles').select('id, display_name').eq('role', 'educator').order('display_name');
        if (edData) setEducators(edData);
      }
      setActiveTeacherId(user.id);
      await fetchScheduleData(user.id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadData(); }, []);

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

  // UNSCHEDULED ROSTER: Students with no lesson this week
  const unassignedStudents = useMemo(() => {
    const assignedIds = new Set(schedule.map(s => s.student_id));
    return myStudents.filter(s => !assignedIds.has(s.id));
  }, [myStudents, schedule]);

  const dailyMetrics = useMemo(() => {
    return activeDays.map(dayName => {
      const dayData = currentWeekDates.find(d => d.dayName === dayName);
      if (!dayData) return { day: dayName, recurring: 0, onceOff: 0 };
      
      const dayLessons = schedule.filter(l => new Date(l.start_time).getDate() === dayData.dateObj.getDate());
      
      return {
        day: dayName,
        recurring: dayLessons.filter(s => !s.topic?.includes('Once-off')).length,
        onceOff: dayLessons.filter(s => s.topic?.includes('Once-off')).length,
      };
    });
  }, [activeDays, schedule, currentWeekDates]);

  // --- GRID HELPERS ---
  const getLessonsForSlot = (dateObj: Date, timeStr: string) => {
    const [hours, mins] = timeStr.split(':');
    const targetTime = new Date(dateObj);
    targetTime.setHours(parseInt(hours), parseInt(mins), 0, 0);
    const targetMs = targetTime.getTime();
    
    return schedule.filter(l => new Date(l.start_time).getTime() === targetMs);
  };

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

  const openTimeslotModal = (dateObj: Date, timeStr: string, slotLessons: LessonInstance[]) => {
    const targetTime = new Date(dateObj);
    const [hours, mins] = timeStr.split(':');
    targetTime.setHours(parseInt(hours), parseInt(mins), 0, 0);

    setActiveSlotData({ dateObj: targetTime, lessons: slotLessons });
    
    if (slotLessons.length > 0) {
      setSlotConfig({
        delivery: slotLessons[0].delivery_mode || 'in-person',
        type: slotLessons[0].topic?.includes('Once-off') ? 'once-off' : 'recurring',
        studentIds: slotLessons.map(l => l.student_id),
        logistics: slotLessons[0].location_or_link || ''
      });
    } else {
      setSlotConfig({ delivery: 'in-person', type: 'recurring', studentIds: [], logistics: '' });
    }
    setSelectedStudentToAdd("");
  };

  const handleSaveTimeslot = async () => {
    if (!activeSlotData || !activeTeacherId) return;
    setIsSaving(true);
    
    try {
      const originalIds = activeSlotData.lessons.map(l => l.student_id);
      const newIds = slotConfig.studentIds;

      const idsToRemove = originalIds.filter(id => !newIds.includes(id));
      const idsToAdd = newIds.filter(id => !originalIds.includes(id));

      const topicStr = slotConfig.type === 'once-off' ? "Once-off Session" : "Scheduled Session";

      // 1. DELETE removed students from this specific slot
      if (idsToRemove.length > 0) {
        const lessonIdsToDelete = activeSlotData.lessons
          .filter(l => idsToRemove.includes(l.student_id))
          .map(l => l.id);
          
        await supabase.from('lesson_schedule').delete().in('id', lessonIdsToDelete);
      }

      // 2. UPDATE existing students (if delivery mode or logistics changed)
      const idsToUpdate = originalIds.filter(id => newIds.includes(id));
      if (idsToUpdate.length > 0) {
        const lessonIdsToUpdate = activeSlotData.lessons
          .filter(l => idsToUpdate.includes(l.student_id))
          .map(l => l.id);

        await supabase.from('lesson_schedule').update({
          delivery_mode: slotConfig.delivery,
          location_or_link: slotConfig.logistics || null,
          topic: topicStr
        }).in('id', lessonIdsToUpdate);
      }

      // 3. INSERT new students
      if (idsToAdd.length > 0) {
        const numWeeks = slotConfig.type === 'recurring' ? 12 : 1;
        const payload: any[] = [];

        for (let w = 0; w < numWeeks; w++) {
          const lessonDate = new Date(activeSlotData.dateObj.getTime() + w * 7 * 24 * 60 * 60 * 1000);
          
          idsToAdd.forEach(studentId => {
             payload.push({
               student_id: studentId,
               teacher_id: activeTeacherId,
               start_time: lessonDate.toISOString(),
               topic: topicStr,
               delivery_mode: slotConfig.delivery,
               location_or_link: slotConfig.logistics || null,
               attendance_status: 'pending'
             });
          });
        }
        await supabase.from('lesson_schedule').insert(payload);
      }

      await fetchScheduleData(activeTeacherId); 
    } catch (err: any) { alert(`Failed to save slot: ${err.message}`); } 
    finally { setIsSaving(false); setActiveSlotData(null); }
  };

  const toggleDay = (dayName: string) => {
    setActiveDays(prev => prev.includes(dayName) ? prev.filter(d => d !== dayName) : [...prev, dayName].sort((a,b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b)));
  };

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
        
        {/* Only show Generate Booking Link to Admins */}
        {currentUser?.role === 'admin' && (
          <button onClick={handleGenerateLink} disabled={isGeneratingLink} className="flex items-center justify-center gap-2 px-6 py-3.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:scale-105 w-full sm:w-auto">
            {isGeneratingLink ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />} Generate Booking Link
          </button>
        )}
      </div>

      {/* APPROVAL INBOX (Fallback/Legacy) */}
      {pendingBookings.length > 0 && (
        <div className="max-w-7xl mx-auto mb-8 bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 shadow-xl">
          <h2 className="text-amber-500 font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
            <Bell size={16} /> Pending Approvals ({pendingBookings.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
             <div className="bg-[#020617]/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center text-xs text-amber-200">
               Review pending bookings in the master database.
             </div>
          </div>
        </div>
      )}

      {/* SUMMARY COMMAND PANEL */}
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
              <UserMinus size={14}/> Unscheduled This Week
           </h2>
           {unassignedStudents.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <CheckCircle2 size={32} className="text-emerald-500 mb-2"/>
                <p className="text-xs font-bold text-slate-400">All your students are scheduled.</p>
             </div>
           ) : (
             <>
               <div className="bg-[#020617]/50 rounded-2xl p-2 flex-1 overflow-y-auto custom-scrollbar border border-white/5 space-y-1 max-h-[150px] lg:max-h-full">
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
                {activeDays.map(dayName => {
                   const dayData = currentWeekDates.find(d => d.dayName === dayName);
                   return (
                     <div key={dayName} className="flex-1 p-4 text-center text-xs md:text-sm font-black text-white uppercase tracking-widest border-r border-white/5 last:border-0">
                       {dayData?.label}
                     </div>
                   );
                })}
              </div>

              {dynamicHours.map(time => (
              <div key={time} className="flex border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.01]">
                  <div className="w-20 shrink-0 p-2 flex items-center justify-center text-[10px] md:text-xs font-bold text-slate-500 border-r border-white/5 bg-black/40">{time}</div>
                  
                  {activeDays.map(dayName => {
                    const dayData = currentWeekDates.find(d => d.dayName === dayName);
                    if (!dayData) return <div key={dayName} className="flex-1 border-r border-white/5" />;

                    const slotLessons = getLessonsForSlot(dayData.dateObj, time);
                    
                    if (slotLessons.length === 0) {
                      // BLANK SLOT
                      return (
                        <button
                            key={`${dayName}-${time}`}
                            onClick={() => openTimeslotModal(dayData.dateObj, time, [])}
                            className="flex-1 relative p-1.5 md:p-2 border-r border-white/5 last:border-0 h-24 transition-all flex flex-col items-center justify-center group outline-none hover:bg-white/5 cursor-pointer"
                        >
                            <div className="w-8 h-8 rounded-full border border-dashed border-slate-600 flex items-center justify-center group-hover:border-white/30 transition-colors">
                                <Plus size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                      )
                    }

                    // CONFIGURED SLOT
                    const isOnline = slotLessons[0].delivery_mode === 'online';
                    const isOnceOff = slotLessons[0].topic?.includes('Once-off');
                    const baseColor = isOnceOff ? 'purple' : 'blue';
                    const Icon = isOnline ? Video : MapPin;

                    return (
                        <button
                          key={`${dayName}-${time}`}
                          onClick={() => openTimeslotModal(dayData.dateObj, time, slotLessons)}
                          className={`flex-1 relative p-1.5 md:p-2 border-r border-white/5 last:border-0 h-24 transition-all flex flex-col items-center justify-center gap-1.5 group outline-none focus:bg-white/5 cursor-pointer bg-${baseColor}-500/10 hover:bg-${baseColor}-500/20 shadow-inner`}
                        >
                            <div className={`w-8 h-8 rounded-lg bg-${baseColor}-500/20 flex items-center justify-center border border-${baseColor}-500/30 shadow-[0_0_15px_rgba(0,0,0,0.2)] shrink-0`}>
                                <Icon size={12} className={`text-${baseColor}-400`} />
                            </div>
                            
                            <div className={`flex flex-col items-center px-1 w-full text-center leading-tight`}>
                              {slotLessons.length > 2 ? (
                                <span className={`text-[10px] font-bold text-${baseColor}-100 w-full block`}>
                                  {slotLessons.length} Students
                                </span>
                              ) : (
                                slotLessons.map(l => (
                                  <span key={l.id} className={`text-[10px] font-bold text-${baseColor}-100 truncate w-full block`}>
                                    {l.student?.display_name.split(' ')[0] || "Unknown"}
                                  </span>
                                ))
                              )}
                            </div>
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
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0f172a] border border-white/10 p-6 md:p-8 rounded-[32px] max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            
            <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
               <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Manage Timeslot</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Configuring slot for <strong className="text-white">{activeSlotData.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric'})}</strong> at {activeSlotData.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
               </div>
               <button onClick={() => setActiveSlotData(null)} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full shrink-0"><X size={20} /></button>
            </div>
            
            <div className="space-y-6">
              {/* Type Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSlotConfig(p => ({...p, delivery: 'in-person'}))} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${slotConfig.delivery === 'in-person' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/30 border-white/5 text-slate-500 hover:text-white'}`}>
                  <MapPin size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">In-Person</span>
                </button>
                <button onClick={() => setSlotConfig(p => ({...p, delivery: 'online'}))} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${slotConfig.delivery === 'online' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-black/30 border-white/5 text-slate-500 hover:text-white'}`}>
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

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Logistics / Meeting Link</label>
                <input type="text" value={slotConfig.logistics} onChange={e => setSlotConfig(p => ({...p, logistics: e.target.value}))} placeholder="Link or Location..." className="w-full bg-[#020617] border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500 transition-colors" />
              </div>

              {/* Roster Management */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Roster</p>
                  <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">{slotConfig.studentIds.length}{slotConfig.delivery === 'online' ? ` / ${MAX_GROUP_SIZE}` : ''}</span>
                </div>
                
                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                  {slotConfig.studentIds.length === 0 ? (
                    <p className="text-xs text-slate-500 italic font-bold">No students assigned.</p>
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

                {myStudents.length > 0 && (slotConfig.delivery === 'in-person' || slotConfig.studentIds.length < MAX_GROUP_SIZE) && (
                    <div className="relative mt-2">
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
                {slotConfig.delivery === 'online' && slotConfig.studentIds.length >= MAX_GROUP_SIZE && (
                  <div className="p-3 border border-amber-500/20 bg-amber-500/10 rounded-xl mt-2">
                      <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest text-center">Group lesson full ({MAX_GROUP_SIZE}/{MAX_GROUP_SIZE} students)</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setActiveSlotData(null)} className="flex-1 py-4 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors text-slate-300">Cancel</button>
              <button onClick={handleSaveTimeslot} disabled={isSaving} className={`flex-1 py-4 rounded-xl disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]`}>
                {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Update & Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

    </main>
  );
}