"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  CalendarDays, X, CheckSquare, Square, Repeat, CalendarPlus, Loader2, Clock, AlertTriangle
} from "lucide-react";
import { motion } from "framer-motion";

interface BulkScheduleManagerProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  activeCourses: any[];
  currentUser: any;
  onSuccess: () => void; // Callback to refresh the dashboard
  showToast: (msg: string, type: 'success' | 'error') => void;
}

// Generate 30-min time slots from 08:00 to 20:00
const generateTimeSlots = () => {
  const slots = [];
  for (let i = 8; i <= 20; i++) {
    const hour = i.toString().padStart(2, '0');
    slots.push(`${hour}:00`);
    slots.push(`${hour}:30`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export default function BulkScheduleManager({ isOpen, onClose, students, activeCourses, currentUser, onSuccess, showToast }: BulkScheduleManagerProps) {
  const courseTitles = activeCourses.map((c: any) => c.title).concat("Unassigned");
  const [course, setCourse] = useState(courseTitles[0] || "");
  const [delivery, setDelivery] = useState("in-person");
  
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00"); 
  
  const [isRecurring, setIsRecurring] = useState(true);
  const [weeks, setWeeks] = useState(4);

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  // NEW: Collision Detection State
  const [collisionData, setCollisionData] = useState<any[] | null>(null);

  const eligibleStudents = useMemo(() => {
    return students.filter((s: any) => 
      s.coursesList?.includes(course) || s.coursesList?.includes("Unassigned")
    );
  }, [students, course]);

  // Reset states when modal opens or parameters change
  useEffect(() => {
    if (isOpen) {
      setSelectedStudentIds(new Set(eligibleStudents.map((s: any) => s.id)));
    }
  }, [course, isOpen]);

  // Hide collision warning if they change the dates to try and fix it
  useEffect(() => {
    setCollisionData(null);
  }, [startDate, startTime, course, isRecurring, weeks]);

  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const handleToggleAll = () => {
    if (selectedStudentIds.size === eligibleStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(eligibleStudents.map((s: any) => s.id)));
    }
  };

  // STEP 1: Pre-check for overlapping lessons
  const handlePreCheck = async () => {
    if (selectedStudentIds.size === 0 || !startDate || !startTime) return;
    setIsSaving(true);

    try {
      const baseDate = new Date(`${startDate}T${startTime}:00`);
      const numWeeks = isRecurring ? weeks : 1;
      const targetDates: string[] = [];

      for (let w = 0; w < numWeeks; w++) {
        targetDates.push(new Date(baseDate.getTime() + w * 7 * 24 * 60 * 60 * 1000).toISOString());
      }

      // Ask Supabase if this teacher already has lessons at ANY of these calculated times
      const { data: existingLessons, error } = await supabase
        .from('lesson_schedule')
        .select('start_time, topic')
        .eq('teacher_id', currentUser?.id)
        .in('start_time', targetDates);

      if (error) throw error;

      // If we found overlaps, halt and show the warning
      if (existingLessons && existingLessons.length > 0) {
        setCollisionData(existingLessons);
        setIsSaving(false);
        return; 
      }

      // If clear, proceed to deploy
      await executeDeploy();
    } catch (err) {
      console.error(err);
      showToast("Failed to verify schedule availability.", "error");
      setIsSaving(false);
    }
  };

  // STEP 2: Execute the final bulk insert
  const executeDeploy = async () => {
    setIsSaving(true);
    
    try {
      const payload: any[] = [];
      const baseDate = new Date(`${startDate}T${startTime}:00`);
      const numWeeks = isRecurring ? weeks : 1;
      const topicString = course === "Unassigned" ? "Scheduled Session" : `${course} Session`;

      const isValidUUID = (uuid: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

      for (let w = 0; w < numWeeks; w++) {
        const lessonDate = new Date(baseDate.getTime() + w * 7 * 24 * 60 * 60 * 1000);

        Array.from(selectedStudentIds).forEach(studentId => {
          const student = students.find((s:any) => s.id === studentId);
          
          const rawTeacher = student?.teacherId || currentUser?.id;
          const validTeacherId = isValidUUID(rawTeacher) ? rawTeacher : null;

          const rawGuardian = student?.linked_parent_id;
          const validGuardianId = isValidUUID(rawGuardian) ? rawGuardian : null;

          payload.push({
            student_id: studentId,
            teacher_id: validTeacherId, 
            guardian_id: validGuardianId, 
            start_time: lessonDate.toISOString(),
            topic: topicString,
            delivery_mode: delivery,
            attendance_status: 'pending'
          });
        });
      }

      const { error } = await supabase.from('lesson_schedule').insert(payload).select();
      
      if (error) throw error;
      
      showToast(`Successfully deployed ${payload.length} total lessons!`, "success");
      setCollisionData(null);
      onSuccess(); 
      onClose();
    } catch (err: any) {
      const errorMsg = err?.message || err?.details || err?.hint || "Failed to deploy schedule.";
      showToast(`Database Error: ${errorMsg}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30"><CalendarDays size={24} /></div>
            <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Bulk Scheduler</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Deploy Automated Itineraries</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          <div className="lg:w-1/2 p-8 overflow-y-auto custom-scrollbar border-r border-white/5 space-y-8">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Target Course</label>
                <select value={course} onChange={e => setCourse(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none cursor-pointer">
                  {courseTitles.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Delivery Mode</label>
                <select value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none cursor-pointer">
                  <option value="in-person">In-person</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6 shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2">Starting Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 cursor-pointer" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2 flex items-center gap-1"><Clock size={10}/> Time (30m Slots)</label>
                  <select 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)} 
                    className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    {TIME_SLOTS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <div className={`p-5 rounded-3xl border transition-colors cursor-pointer ${isRecurring ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`} onClick={() => setIsRecurring(!isRecurring)}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-xl ${isRecurring ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-slate-400'}`}><Repeat size={16}/></div>
                  {isRecurring ? <CheckSquare size={18} className="text-blue-400"/> : <Square size={18} className="text-slate-600"/>}
                </div>
                <p className="text-sm font-bold text-white mb-1">Recurring Weekly</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 line-clamp-2">Schedules the same time each week</p>
                
                {isRecurring && (
                  <div className="mt-4 pt-4 border-t border-blue-500/20 space-y-4" onClick={e => e.stopPropagation()}>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Number of Weeks (Max 52)</label>
                      <input type="number" min="1" max="52" value={weeks} onChange={e => setWeeks(parseInt(e.target.value) || 1)} className="w-full bg-[#020617] border border-blue-500/30 rounded-xl px-3 py-2 text-white font-bold text-sm outline-none" />
                    </div>

                    {startDate && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-blue-400 mb-1">Final Lesson Date</p>
                        <p className="text-xs font-bold text-white italic">
                          {new Date(new Date(startDate).getTime() + (weeks - 1) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:w-1/2 flex flex-col bg-[#020617]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-white">Select Students</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{eligibleStudents.length} eligible in {course}</p>
              </div>
              <button onClick={handleToggleAll} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors py-2 px-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20">
                {selectedStudentIds.size === eligibleStudents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
              {eligibleStudents.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-white/10 rounded-3xl">
                  <p className="text-sm font-bold text-slate-400 italic">No active students found assigned to this course.</p>
                </div>
              ) : (
                eligibleStudents.map((s: any) => {
                  const isSelected = selectedStudentIds.has(s.id);
                  return (
                    <div 
                      key={s.id} 
                      onClick={() => handleToggleStudent(s.id)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                    >
                      {isSelected ? <CheckSquare size={18} className="text-blue-400 shrink-0"/> : <Square size={18} className="text-slate-600 shrink-0"/>}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{s.name}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{s.course === 'Unassigned' ? 'Unassigned' : 'Enrolled'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DYNAMIC ACTION BAR: Swap between Warning and Deploy states */}
            {collisionData ? (
              <div className="p-6 border-t border-rose-500/20 bg-rose-500/5 shrink-0 flex flex-col gap-4">
                 <div className="flex items-start gap-3">
                   <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={20} />
                   <div>
                     <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest">Double Booking Detected</h4>
                     <p className="text-xs text-rose-300/80 mt-1">
                       You already have sessions scheduled at these times. Do you want to merge these {selectedStudentIds.size} students into the existing slots?
                     </p>
                   </div>
                 </div>
                 <div className="flex gap-2 w-full">
                   <button onClick={() => setCollisionData(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                     Cancel
                   </button>
                   <button onClick={executeDeploy} disabled={isSaving} className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-900/20">
                     {isSaving ? <Loader2 size={16} className="animate-spin"/> : "Merge Anyway"}
                   </button>
                 </div>
              </div>
            ) : (
              <div className="p-6 border-t border-white/5 bg-white/[0.02] shrink-0">
                 <button 
                   onClick={handlePreCheck} 
                   disabled={isSaving || selectedStudentIds.size === 0 || !startDate || !startTime}
                   className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase italic tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.02]"
                 >
                   {isSaving ? <Loader2 size={18} className="animate-spin"/> : <><CalendarPlus size={18}/> Deploy {selectedStudentIds.size * (isRecurring ? weeks : 1)} Lessons</>}
                 </button>
              </div>
            )}

          </div>
        </div>
      </motion.div>
    </div>
  );
}