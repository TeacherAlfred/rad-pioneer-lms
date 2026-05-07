"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarDays, Edit2, Video, MapPin, Loader2, Plus } from "lucide-react";

interface SevenDayHorizonProps {
  viewScope: string; 
  currentUser: any;
  availabilities: any[]; 
  onEditLesson: (lessonGroup: any) => void;
  onAddLesson: (date: Date) => void;
  refreshTrigger?: number; 
}

export default function SevenDayHorizon({ viewScope, currentUser, availabilities, onEditLesson, onAddLesson, refreshTrigger }: SevenDayHorizonProps) {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    fetchUpcomingLessons();
  }, [viewScope, currentUser, refreshTrigger]);

  const fetchUpcomingLessons = async () => {
    setLoading(true);
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let query = supabase
        .from('lesson_schedule')
        .select(`
          id, student_id, teacher_id, start_time, topic, delivery_mode, location_or_link, attendance_status,
          student:profiles!lesson_schedule_student_id_fkey(display_name)
        `)
        .gte('start_time', now.toISOString())
        .lt('start_time', nextWeek.toISOString());

      if (viewScope === 'my_roster' && currentUser) {
        query = query.eq('teacher_id', currentUser.id);
      } else if (viewScope !== 'global') {
        query = query.eq('teacher_id', viewScope);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLessons(data || []);
    } catch (err) {
      console.error("Failed to fetch 7-Day Horizon:", err);
    } finally {
      setLoading(false);
    }
  };

  const scheduleDays = useMemo(() => {
    const rawLessons: any[] = [];

    lessons.forEach((lesson: any) => {
      const lessonDate = new Date(lesson.start_time);
      const studentName = lesson.student?.display_name || "Unknown Pioneer";
      
      rawLessons.push({
        lessonId: lesson.id,
        teacherId: lesson.teacher_id,
        dateObj: lessonDate,
        dateTs: lessonDate.getTime(),
        topic: lesson.topic,
        studentId: lesson.student_id,
        studentName: studentName,
        course: lesson.topic.replace(' Session', ''),
        delivery: lesson.delivery_mode || 'in-person',
        location: lesson.delivery_mode === 'in-person' ? lesson.location_or_link : '',
        link: lesson.delivery_mode === 'online' ? lesson.location_or_link : null,
        is_open_slot: false
      });
    });

    availabilities.filter(a => !a.is_booked).forEach(a => {
       const d = new Date(a.start_time);
       rawLessons.push({
         is_open_slot: true, 
         lessonId: a.id, 
         teacherId: a.teacher_id, // <-- ADDED
         dateObj: d, 
         dateTs: d.getTime(), 
         topic: "Available for Booking",
         studentId: "open", 
         studentName: "Unbooked Slot", 
         course: "Time Inventory", 
         delivery: a.delivery_mode, 
         location: "TBD", 
         link: null
       });
    });

    const groupedMap = new Map<string, any>();
    rawLessons.forEach(lesson => {
      // --- CRITICAL FIX: Include teacherId and logistics in the grouping key ---
      // This ensures different teachers' classes at the same time stay in their own separate cards!
      const logisticsStr = lesson.delivery === 'online' ? lesson.link : lesson.location;
      const key = lesson.is_open_slot 
        ? `open-${lesson.lessonId}` 
        : `${lesson.dateTs}-${lesson.teacherId}-${lesson.topic}-${lesson.delivery}-${logisticsStr}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, { ...lesson, key: key, attendees: [{ studentId: lesson.studentId, studentName: lesson.studentName, lessonId: lesson.lessonId }] });
      } else {
        groupedMap.get(key).attendees.push({ studentId: lesson.studentId, studentName: lesson.studentName, lessonId: lesson.lessonId });
      }
    });

    const groupedLessons = Array.from(groupedMap.values());
    const now = new Date();
    now.setHours(0,0,0,0);

    return Array.from({ length: 7 }).map((_, i) => {
       const d = new Date(now);
       d.setDate(d.getDate() + i);
       const start = d.getTime();
       const end = start + 24 * 60 * 60 * 1000;
       
       let label = d.toLocaleDateString('en-US', { weekday: 'short' });
       if (i === 0) label = 'Today';
       if (i === 1) label = 'Tomorrow';

       return {
          dateObj: d, label, dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          lessons: groupedLessons.filter(l => l.dateTs >= start && l.dateTs < end).sort((a, b) => a.dateTs - b.dateTs)
       };
    });
  }, [lessons, availabilities]);

  return (
    <div className="pt-6 pb-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-purple-500" />
          <h2 className="text-lg font-black uppercase italic tracking-widest text-white">7-Day Horizon</h2>
        </div>
        {loading && <Loader2 size={16} className="text-purple-500 animate-spin" />}
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {scheduleDays.map((day, idx) => (
          <div key={idx} className="bg-[#0f172a]/80 backdrop-blur-md border border-white/5 rounded-3xl p-4 min-w-[150px] lg:min-w-0 flex-1 flex flex-col snap-start shrink-0 shadow-lg">
             
             <div className="flex items-start justify-between mb-3 border-b border-white/5 pb-2 gap-2">
               <div className="flex flex-col 2xl:flex-row 2xl:items-baseline gap-1">
                 <h3 className={`text-sm font-black uppercase tracking-widest ${idx === 0 ? 'text-blue-400' : 'text-slate-300'}`}>{day.label}</h3>
                 <span className="text-[9px] font-bold text-slate-500">{day.dateStr}</span>
               </div>
               <button 
                 onClick={() => onAddLesson(day.dateObj)} 
                 className="p-1.5 bg-white/5 hover:bg-purple-500/20 text-slate-400 hover:text-purple-400 rounded-lg transition-colors border border-transparent hover:border-purple-500/30" 
                 title="Schedule Lesson Here"
               >
                 <Plus size={14} />
               </button>
             </div>
             
             <div className="flex-1 space-y-2">
                {day.lessons.length === 0 ? (
                  <p className="text-[10px] font-bold text-slate-600 italic text-center py-4">No lessons scheduled</p>
                ) : (
                  day.lessons.map((lesson: any, lessonIdx: number) => {
                    const isOnline = lesson.delivery === 'online';
                    const isMissingLogistics = (isOnline && !lesson.link) || (!isOnline && !lesson.location);
                    
                    const displayText = lesson.is_open_slot 
                      ? "OPEN SLOT" 
                      : (!isOnline && lesson.location ? lesson.location : lesson.attendees.map((a:any) => a.studentName).join(', '));

                    return (
                      <div 
                        key={lesson.key || `${lesson.dateTs}-${lessonIdx}`} 
                        onClick={() => !lesson.is_open_slot && onEditLesson(lesson)}
                        className={`bg-[#020617] rounded-2xl p-3 flex flex-col gap-1.5 relative ${
                          lesson.is_open_slot ? 'border-2 border-dashed border-white/10 cursor-default opacity-80' : 'border border-white/5 hover:border-purple-500/50 transition-colors cursor-pointer group'
                        }`}
                      >
                        {!lesson.is_open_slot && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity">
                            <Edit2 size={12}/>
                          </div>
                        )}
                        <p className={`text-xs font-black pr-5 ${lesson.is_open_slot ? 'text-slate-400' : isOnline ? 'text-purple-400' : 'text-emerald-400'}`}>
                          {new Date(lesson.dateTs).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                        <div className="flex items-start gap-1.5">
                          {isOnline ? <Video size={12} className="text-purple-500 shrink-0 mt-0.5"/> : <MapPin size={12} className={`shrink-0 mt-0.5 ${lesson.location ? 'text-emerald-500' : 'text-amber-500'}`}/>}
                          {isMissingLogistics && !lesson.is_open_slot ? (
                             <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">+ Add {isOnline ? 'Link' : 'Venue'}</span>
                          ) : (
                             <p className={`text-[10px] font-bold leading-tight line-clamp-2 ${lesson.is_open_slot ? 'text-slate-500 tracking-widest uppercase' : 'text-white'}`}>{displayText}</p>
                          )}
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 truncate mt-0.5">{lesson.topic}</p>
                      </div>
                    )
                  })
                )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}