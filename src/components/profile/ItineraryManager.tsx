"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Calendar, CheckSquare, Square, Video, MapPin, 
  Edit2, Trash2, Loader2, Link as LinkIcon, CheckCircle2, CalendarX2, Check, XCircle, Clock, Repeat
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ItineraryManagerProps {
  studentId: string;
}

export default function ItineraryManager({ studentId }: ItineraryManagerProps) {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);
  
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | boolean>(false);

  const [reschedulingLesson, setReschedulingLesson] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState("");

  useEffect(() => {
    if (studentId) fetchSchedule();
  }, [studentId]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lesson_schedule')
        .select('*')
        .eq('student_id', studentId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSchedule(data || []);
    } catch (err) {
      console.error("Failed to fetch schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  const { pastLessons, upcomingLessons } = useMemo(() => {
    if (!schedule || schedule.length === 0) return { pastLessons: [], upcomingLessons: [] };

    const now = new Date().getTime();
    const threshold = now - (2 * 60 * 60 * 1000); // 2 hours ago

    const past = schedule.filter(l => new Date(l.start_time).getTime() < threshold);
    const upcoming = schedule.filter(l => new Date(l.start_time).getTime() >= threshold);

    return { pastLessons: past, upcomingLessons: upcoming };
  }, [schedule]);

  const toggleSelection = (lessonId: string) => {
    setSelectedLessonIds(prev => prev.includes(lessonId) ? prev.filter(id => id !== lessonId) : [...prev, lessonId]);
  };

  const handleSelectAll = () => {
    if (selectedLessonIds.length === upcomingLessons.length) setSelectedLessonIds([]);
    else setSelectedLessonIds(upcomingLessons.map(l => l.id));
  };

  const executeBulkUpdateLogistics = async () => {
    if (selectedLessonIds.length === 0 || !bulkInput.trim()) return;
    setIsUpdating(true);
    try {
      const isLink = bulkInput.startsWith('http') || bulkInput.includes('zoom.us') || bulkInput.includes('meet.google');
      const delivery = isLink ? 'online' : 'in-person';
      
      const { error } = await supabase.from('lesson_schedule').update({ 
        location_or_link: bulkInput,
        delivery_mode: delivery
      }).in('id', selectedLessonIds);

      if (error) throw error;
      
      await fetchSchedule(); 
      setSelectedLessonIds([]);
      setBulkInput("");
    } catch (err) {
      alert("Failed to update logistics.");
    } finally { 
      setIsUpdating(false); 
    }
  };

  const handleDelete = async (lessonIds: string[]) => {
    if(!window.confirm(`Permanently delete ${lessonIds.length} lesson(s)?`)) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('lesson_schedule').delete().in('id', lessonIds);
      if (error) throw error;
      await fetchSchedule();
      setSelectedLessonIds([]);
    } catch (err) {
      alert("Failed to delete lessons.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveSingleEdit = async (lessonId: string) => {
    try {
      const d = (document.getElementById(`date-${lessonId}`) as HTMLInputElement).value;
      const l = (document.getElementById(`log-${lessonId}`) as HTMLInputElement).value;
      const isLnk = l.startsWith('http') || l.includes('zoom.us') || l.includes('meet.google');
      
      const { error } = await supabase.from('lesson_schedule').update({
        start_time: new Date(d).toISOString(),
        delivery_mode: isLnk ? 'online' : 'in-person',
        location_or_link: l || null
      }).eq('id', lessonId);

      if (error) throw error;
      await fetchSchedule();
      setIsUpdating(false);
    } catch (err) {
      alert("Failed to save changes.");
    }
  };

  // --- DIRECT ATTENDANCE UPDATER ---
  const handleUpdateAttendance = async (lessonId: string, newStatus: string) => {
    // Intercept 'rescheduled' to open the modal instead of saving immediately
    if (newStatus === 'rescheduled') {
      const lessonToReschedule = schedule.find(l => l.id === lessonId);
      if (lessonToReschedule) {
        setReschedulingLesson(lessonToReschedule);
        // Default picker to the lesson's current time
        const tzOffset = new Date(lessonToReschedule.start_time).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(new Date(lessonToReschedule.start_time).getTime() - tzOffset)).toISOString().slice(0,16);
        setNewRescheduleDate(localISOTime);
      }
      return;
    }

    try {
      // Optimistic update for UI speed
      setSchedule(prev => prev.map(l => l.id === lessonId ? { ...l, attendance_status: newStatus } : l));
      
      const { error } = await supabase
        .from('lesson_schedule')
        .update({ attendance_status: newStatus })
        .eq('id', lessonId);

      if (error) throw error;
    } catch (err) {
      alert("Failed to update attendance.");
      fetchSchedule(); // Revert on failure
    }
  };

  // --- CONFIRM RESCHEDULE ---
  const confirmReschedule = async () => {
    if (!reschedulingLesson || !newRescheduleDate) return;
    setIsUpdating(true);
    try {
      const newDateISO = new Date(newRescheduleDate).toISOString();
      
      // Update UI optimistically
      setSchedule(prev => prev.map(l => l.id === reschedulingLesson.id ? { ...l, attendance_status: 'rescheduled', start_time: newDateISO } : l));

      const { error } = await supabase
        .from('lesson_schedule')
        .update({ 
          attendance_status: 'rescheduled', 
          start_time: newDateISO 
        })
        .eq('id', reschedulingLesson.id);

      if (error) throw error;
      
      await fetchSchedule(); // Refetch to re-sort chronologically
      setReschedulingLesson(null);
    } catch (err) {
      alert("Failed to reschedule.");
      fetchSchedule();
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to render the interactive attendance dropdown
  const renderAttendanceDropdown = (lesson: any) => {
    const isPastOrPresent = new Date(lesson.start_time).getTime() <= new Date().getTime();
    const isRescheduled = lesson.attendance_status === 'rescheduled';
    
    // If it's in the future and NOT rescheduled, just show the Pending text
    if (!isPastOrPresent && !isRescheduled) {
      return (
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
          Pending
        </span>
      );
    }

    return (
      <select 
        value={lesson.attendance_status || 'pending'}
        onChange={(e) => handleUpdateAttendance(lesson.id, e.target.value)}
        onClick={(e) => e.stopPropagation()} // Prevent triggering parent click events
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest outline-none appearance-none border transition-colors cursor-pointer text-center min-w-[100px] ${
          lesson.attendance_status === 'attended' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' :
          lesson.attendance_status === 'missed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' :
          lesson.attendance_status === 'apology' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' :
          lesson.attendance_status === 'rescheduled' ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]' :
          lesson.attendance_status === 'late' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' :
          'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
        }`}
      >
        {isRescheduled && (
          <option value="rescheduled" disabled className="bg-[#0f172a] text-blue-400">Confirm Attendance</option>
        )}
        {!isRescheduled && (
          <option value="pending" className="bg-[#0f172a] text-slate-300">Pending</option>
        )}
        <option value="attended" className="bg-[#0f172a] text-emerald-400">Attended</option>
        <option value="late" className="bg-[#0f172a] text-amber-400">Late</option>
        <option value="missed" className="bg-[#0f172a] text-rose-400">Missed</option>
        <option value="apology" className="bg-[#0f172a] text-amber-400">Apology</option>
        {!isRescheduled && (
          <option value="rescheduled" className="bg-[#0f172a] text-blue-400">Resched</option>
        )}
      </select>
    );
  };

  if (loading) return (
    <div className="bg-[#0f172a] rounded-[40px] border border-white/5 shadow-2xl h-[800px] flex flex-col items-center justify-center gap-4 w-full">
      <Loader2 className="animate-spin text-blue-500" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Syncing Itinerary...</p>
    </div>
  );

  return (
    <div className="bg-[#0f172a] rounded-[40px] border border-white/5 shadow-2xl overflow-hidden flex flex-col h-[800px] w-full relative z-10">
      
      {/* HEADER & BULK ACTION BAR */}
      <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#020617]/50 shrink-0">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-widest flex items-center gap-2 text-white">
            <Calendar className="text-blue-500"/> Itinerary Manager
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Past & Upcoming Sessions</p>
        </div>
        
        <AnimatePresence>
          {selectedLessonIds.length > 1 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-blue-600/10 p-3 rounded-2xl border border-blue-500/30">
              <div className="relative flex-1 sm:min-w-[250px]">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={14} />
                <input type="text" placeholder="Batch Link/Venue..." value={bulkInput} onChange={e => setBulkInput(e.target.value)} className="w-full bg-[#020617] border border-blue-500/30 rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold text-white outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={executeBulkUpdateLogistics} disabled={isUpdating === true || !bulkInput.trim()} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase transition-colors disabled:opacity-50">
                  {isUpdating === true ? <Loader2 size={12} className="animate-spin"/> : 'Update'}
                </button>
                <button onClick={() => handleDelete(selectedLessonIds)} className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 rounded-xl transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        
        {schedule.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60 pb-20">
            <CalendarX2 size={48} className="text-slate-500" />
            <div>
              <p className="text-lg font-black text-white italic">No Itinerary Found</p>
              <p className="text-xs text-slate-400 mt-1 font-bold">This student has no scheduled sessions in the database.</p>
            </div>
          </div>
        ) : (
          <>
            {/* UPCOMING LESSONS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Upcoming ({upcomingLessons.length})</h3>
                {upcomingLessons.length > 0 && (
                  <button onClick={handleSelectAll} className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">
                    {selectedLessonIds.length === upcomingLessons.length ? 'Select None' : 'Select All'}
                  </button>
                )}
              </div>

              {upcomingLessons.length === 0 && (
                <p className="text-sm font-bold text-slate-500 italic py-4 text-center border border-dashed border-white/5 rounded-2xl">All scheduled lessons have passed.</p>
              )}

              {upcomingLessons.map(lesson => {
                  const isSelected = selectedLessonIds.includes(lesson.id);
                  const isEditingRow = isUpdating === lesson.id;
                  const isOnline = lesson.delivery_mode === 'online';

                  return (
                    <div key={lesson.id} className={`rounded-3xl border transition-all overflow-hidden ${isSelected ? 'border-blue-500/50' : 'border-white/5'}`}>
                      <div onClick={() => toggleSelection(lesson.id)} className={`p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 cursor-pointer group ${isSelected ? 'bg-blue-600/5' : 'bg-[#020617] hover:bg-white/[0.02]'}`}>
                        <div className="flex items-start gap-4 flex-1">
                          <button className={`mt-1 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-700'}`}>
                            {isSelected ? <CheckSquare size={18}/> : <Square size={18} />}
                          </button>
                          <div>
                            <p className="text-sm font-bold text-white">{lesson.topic || 'Scheduled Session'}</p>
                            <p className="text-[10px] font-black text-blue-400 mt-1 uppercase tracking-widest">
                              {new Date(lesson.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between xl:justify-end gap-4 xl:w-auto w-full pl-10 xl:pl-0">
                          <div className="flex items-center gap-3">
                            {isOnline ? (
                              <div className="text-[10px] font-black text-blue-400 flex items-center gap-1"><Video size={12}/> {lesson.location_or_link ? 'Link Setup' : 'Missing Link'}</div>
                            ) : (
                              <div className="text-[10px] font-black text-emerald-400 flex items-center gap-1"><MapPin size={12}/> {lesson.location_or_link || 'Venue Pending'}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {renderAttendanceDropdown(lesson)}
                            <button onClick={(e) => { e.stopPropagation(); setIsUpdating(lesson.id); }} className="p-2 opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all">
                              <Edit2 size={12}/>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* EDIT DROPDOWN */}
                      <AnimatePresence>
                        {isEditingRow && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-white/5 border-t border-white/10 p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500">Date & Time</label>
                                <input type="datetime-local" id={`date-${lesson.id}`} defaultValue={new Date(new Date(lesson.start_time).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)} className="w-full bg-[#020617] border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-blue-500 transition-colors" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500">Logistics (Link or Venue)</label>
                                <input type="text" id={`log-${lesson.id}`} defaultValue={lesson.location_or_link || ""} className="w-full bg-[#020617] border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-blue-500 transition-colors" />
                              </div>
                            </div>
                            <div className="flex justify-between pt-2">
                              <button onClick={() => handleDelete([lesson.id])} className="text-rose-400 hover:text-rose-300 text-[10px] font-black uppercase flex items-center gap-1 px-3 py-2 bg-rose-500/10 rounded-lg transition-colors">
                                <Trash2 size={12}/> Delete Lesson
                              </button>
                              <div className="flex gap-2">
                                <button onClick={() => setIsUpdating(false)} className="text-slate-400 hover:text-white transition-colors text-[10px] uppercase font-black px-4">Cancel</button>
                                <button onClick={() => handleSaveSingleEdit(lesson.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors shadow-lg">Save Changes</button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
              })}
            </div>

            {/* PAST LESSONS */}
            {pastLessons.length > 0 && (
              <div className="space-y-4 pt-4">
                <div className="border-b border-white/10 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Past ({pastLessons.length})</h3>
                </div>
                <div className="opacity-80 space-y-3">
                  {pastLessons.map(lesson => (
                    <div key={lesson.id} className="p-5 rounded-3xl bg-[#020617] border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 group hover:opacity-100 transition-opacity">
                      <div>
                        <p className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">{lesson.topic || 'Completed Session'}</p>
                        <p className="text-[10px] font-bold text-slate-600 mt-1 group-hover:text-slate-500 transition-colors uppercase tracking-widest">
                          {new Date(lesson.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(lesson.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                        {renderAttendanceDropdown(lesson)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- RESCHEDULE MODAL --- */}
      <AnimatePresence>
        {reschedulingLesson && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReschedulingLesson(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-[40px]" />
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden z-10">
              <h3 className="text-xl font-black italic uppercase text-white mb-2">Reschedule Session</h3>
              <p className="text-xs text-slate-400 mb-6 font-bold">Select the new date and time for this lesson.</p>
              
              <input 
                type="datetime-local" 
                value={newRescheduleDate} 
                onChange={e => setNewRescheduleDate(e.target.value)} 
                className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 cursor-pointer mb-6" 
              />

              <div className="flex gap-3">
                <button onClick={() => setReschedulingLesson(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={confirmReschedule} disabled={isUpdating === true} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  {isUpdating === true ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}