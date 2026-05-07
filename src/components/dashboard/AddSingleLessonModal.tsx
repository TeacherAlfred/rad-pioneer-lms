"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarPlus, X, CheckSquare, Square, Loader2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AddSingleLessonModalProps {
  isOpen: boolean;
  selectedDate: Date | null;
  onClose: () => void;
  students: any[];
  activeCourses: any[];
  currentUser: any;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

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

export default function AddSingleLessonModal({ isOpen, selectedDate, onClose, students, activeCourses, currentUser, onSuccess, showToast }: AddSingleLessonModalProps) {
  const courseTitles = activeCourses.map((c: any) => c.title).concat("Unassigned");
  const [course, setCourse] = useState(courseTitles[0] || "");
  const [delivery, setDelivery] = useState("in-person");
  const [startTime, setStartTime] = useState("14:00"); 
  const [topic, setTopic] = useState("");
  const [logistics, setLogistics] = useState("");

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const eligibleStudents = useMemo(() => {
    return students.filter((s: any) => s.coursesList?.includes(course) || s.coursesList?.includes("Unassigned"));
  }, [students, course]);

  useEffect(() => {
    if (isOpen) {
      setSelectedStudentIds(new Set()); 
      setTopic(`${course === "Unassigned" ? "Custom" : course} Session`);
    }
  }, [isOpen, course]);

  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const handleToggleAll = () => {
    if (selectedStudentIds.size === eligibleStudents.length) setSelectedStudentIds(new Set());
    else setSelectedStudentIds(new Set(eligibleStudents.map((s: any) => s.id)));
  };

  const handleSubmit = async () => {
    if (selectedStudentIds.size === 0 || !selectedDate || !startTime) return;
    setIsSaving(true);
    
    try {
      const payload: any[] = [];
      const tzOffset = selectedDate.getTimezoneOffset() * 60000; 
      const localISODate = (new Date(selectedDate.getTime() - tzOffset)).toISOString().split('T')[0];
      
      const finalDateTime = new Date(`${localISODate}T${startTime}:00`);
      const isValidUUID = (uuid: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

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
          start_time: finalDateTime.toISOString(),
          topic: topic || "Scheduled Session",
          delivery_mode: delivery,
          location_or_link: logistics || null,
          attendance_status: 'pending'
        });
      });

      const { error } = await supabase.from('lesson_schedule').insert(payload);
      if (error) throw error;
      
      showToast(`Added lesson for ${payload.length} student(s)!`, "success");
      onSuccess(); 
      onClose();
    } catch (err: any) {
      showToast("Failed to schedule lesson.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !selectedDate) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30"><CalendarPlus size={24} /></div>
            <div>
                <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Schedule Lesson</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">
                  For: <span className="text-purple-400">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="md:w-1/2 p-6 md:p-8 overflow-y-auto custom-scrollbar border-r border-white/5 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Time (30m Slots)</label>
                <div className="relative">
                  <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500" />
                  <select value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl py-3.5 pl-9 pr-4 text-sm font-bold text-white outline-none focus:border-purple-500 appearance-none cursor-pointer">
                    {TIME_SLOTS.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Delivery Mode</label>
                <select value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-purple-500 appearance-none cursor-pointer">
                  <option value="in-person">In-person</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Course Target</label>
              <select value={course} onChange={e => setCourse(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-purple-500 appearance-none cursor-pointer">
                {courseTitles.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Topic / Description</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-purple-500" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{delivery === 'online' ? 'Meeting Link' : 'Location / Venue'}</label>
              <input type="text" placeholder="Optional..." value={logistics} onChange={e => setLogistics(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-purple-500" />
            </div>
          </div>

          <div className="md:w-1/2 flex flex-col bg-[#020617]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-white">Select Students</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{eligibleStudents.length} eligible in {course}</p>
              </div>
              <button onClick={handleToggleAll} className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-white transition-colors py-2 px-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20">
                {selectedStudentIds.size === eligibleStudents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar min-h-[250px]">
              {eligibleStudents.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-white/10 rounded-3xl">
                  <p className="text-sm font-bold text-slate-400 italic">No active students found assigned to this course.</p>
                </div>
              ) : (
                eligibleStudents.map((s: any) => {
                  const isSelected = selectedStudentIds.has(s.id);
                  return (
                    <div key={s.id} onClick={() => handleToggleStudent(s.id)} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                      {isSelected ? <CheckSquare size={18} className="text-purple-400 shrink-0"/> : <Square size={18} className="text-slate-600 shrink-0"/>}
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{s.name}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.02] shrink-0">
               <button 
                 onClick={handleSubmit} 
                 disabled={isSaving || selectedStudentIds.size === 0 || !startTime}
                 className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase italic tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-purple-900/20 disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.02]"
               >
                 {isSaving ? <Loader2 size={18} className="animate-spin"/> : <><CalendarPlus size={18}/> Schedule Lesson</>}
               </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}