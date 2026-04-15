"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, User, Calendar, BookOpen, Shield, 
  ChevronRight,  ChevronDown, ArrowLeft, Loader2, Filter, Users,
  Mail, Phone, Info, Award, Clock, CheckCircle2, 
  AlertCircle, LayoutGrid, List, Zap, CreditCard,
  X, ArrowRight, TrendingUp, Activity, Smartphone, Globe, Monitor, Play, CheckSquare, Square, UserCircle, MapPin, Video, CalendarDays, Repeat
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation"; 

// DYNAMIC SYLLABUS MAP
const COURSE_SYLLABUS: Record<string, { week: number, title: string }[]> = {
  "Robotics Pioneer Bootcamp": [
    { week: 1, title: "Intro to Microcontrollers & Safety" },
    { week: 2, title: "Sensors, Inputs, and Logic Gates" },
    { week: 3, title: "Actuators & Motor Control" },
    { week: 4, title: "Autonomous Navigation Algorithms" },
    { week: 5, title: "Final Project: Line-Following Bot" }
  ],
  "Intro to Python": [
    { week: 1, title: "Syntax, Variables & Data Types" },
    { week: 2, title: "Control Flow (If/Else & Loops)" },
    { week: 3, title: "Functions & Scope" },
    { week: 4, title: "Lists, Dictionaries & JSON" },
    { week: 5, title: "Final Project: Terminal Game" }
  ]
};

const getSyllabusForCourse = (courseName: string) => {
  if (COURSE_SYLLABUS[courseName]) return COURSE_SYLLABUS[courseName];
  return Array.from({ length: 8 }).map((_, i) => ({ week: i + 1, title: `Standard Module ${i + 1}` }));
};

export default function PioneerDashboard() {
  const router = useRouter(); 
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pioneers, setPioneers] = useState<any[]>([]);
  const [educators, setEducators] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Advanced Filtering
  const [filterType, setFilterType] = useState<"all" | "term" | "trial">("all");
  const [filterMode, setFilterMode] = useState<"all" | "in-person" | "online" | "self-paced">("all");
  
  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  
  const [pulse, setPulse] = useState({
    total: 0,
    adopted: 0,
    termCount: 0,
    avgAttendance: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // 1. Fetch Students
      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .select('*, parent:linked_parent_id(display_name, metadata)')
        .eq('role', 'student')
        .order('display_name', { ascending: true });

      if (!studentError && studentData) {
        setPioneers(studentData);
        const adopted = studentData.filter(p => p.metadata?.username).length;
        const terms = studentData.filter(p => p.metadata?.account_tier === 'full').length;
        setPulse({ total: studentData.length, adopted, termCount: terms, avgAttendance: 0 });
      }

      // 2. Fetch Educators 
      const { data: educatorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'educator')
        .order('display_name', { ascending: true });
        
      if (educatorData) setEducators(educatorData);

      // 3. Fetch Active Courses dynamically
      const { data: coursesData } = await supabase
        .from('courses')
        .select('title')
        .eq('is_published', true)
        .order('order_index', { ascending: true });
        
      if (coursesData) {
        const activeCourseTitles = coursesData.map(c => c.title);
        // Always include Unassigned for filtering/assignment purposes
        setAvailableCourses([...activeCourseTitles, "Unassigned"]);
      }

    } finally {
      setLoading(false);
    }
  }

  // --- QUICK TIER/MODE BULK HANDLER ---
  const handleBulkUpdate = async (tier: 'full' | 'demo', mode?: string) => {
    if (selectedIds.length === 0) return;
    const confirm = window.confirm(`Update license for ${selectedIds.length} pioneers?`);
    if (!confirm) return;

    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        const p = pioneers.find(p => p.id === id);
        const updatedMetadata = { 
          ...p.metadata, 
          account_tier: tier,
          learning_mode: tier === 'full' ? (mode || 'online') : null
        };
        await supabase.from('profiles').update({ metadata: updatedMetadata }).eq('id', id);
      }
      
      await fetchDashboardData();
      setSelectedIds([]);
      alert("Bulk update complete.");
    } catch (err) {
      alert("Bulk update failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- FULL SCHEDULING BULK HANDLER ---
  const executeBulkScheduling = async (type: 'create' | 'update', payload: any) => {
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        const student = pioneers.find(p => p.id === id);
        if (!student) continue;
        
        const meta = student.metadata || {};
        let currentSchedule = meta.schedule || [];

        if (type === 'create') {
          // GENERATE NEW LESSONS
          const syllabus = getSyllabusForCourse(payload.course);
          const startIdx = Math.max(0, syllabus.findIndex(l => `Week ${l.week}: ${l.title}` === payload.startTopic));
          const startDt = new Date(payload.startDate);
          
          const newLessons = [];
          for (let i = 0; i < payload.weeks; i++) {
             const lessonDate = new Date(startDt);
             lessonDate.setDate(lessonDate.getDate() + (i * 7));
             const topicObj = syllabus[startIdx + i];
             const topicStr = topicObj ? `Week ${topicObj.week}: ${topicObj.title}` : "TBD / Open Session";
             
             newLessons.push({
                 id: Math.random().toString(36).substring(7),
                 date: lessonDate.toISOString(),
                 topic: topicStr,
                 course: payload.course,
                 delivery: payload.delivery,
                 link: payload.delivery === 'online' ? payload.link : null,
                 location: payload.delivery === 'in-person' ? payload.location : null
             });
          }

          // FILTER DUPLICATES & APPEND
          const filteredNew = newLessons.filter(nl => {
             const nlDate = new Date(nl.date).toLocaleDateString();
             return !currentSchedule.some((el: any) => new Date(el.date).toLocaleDateString() === nlDate && el.topic === nl.topic);
          });
          currentSchedule = [...currentSchedule, ...filteredNew];
          
          // Auto-assign course if needed
          if (!meta.interested_programs || meta.interested_programs[0] !== payload.course) {
             meta.interested_programs = [payload.course];
          }

        } else if (type === 'update') {
          // OVERWRITE UPCOMING VENUES/LINKS
          const now = new Date().getTime();
          currentSchedule = currentSchedule.map((l: any) => {
             if (new Date(l.date).getTime() > now && l.course === payload.targetCourse) {
                 return { 
                   ...l, 
                   delivery: payload.newDelivery, 
                   link: payload.newDelivery === 'online' ? payload.newLink : null, 
                   location: payload.newDelivery === 'in-person' ? payload.newLocation : null 
                 };
             }
             return l;
          });
        }
        
        await supabase.from('profiles').update({ metadata: { ...meta, schedule: currentSchedule } }).eq('id', id);
      }
      
      await fetchDashboardData();
      setIsBulkModalOpen(false);
      setSelectedIds([]);
      alert("Bulk operation executed successfully.");
    } catch(e) {
      console.error(e);
      alert("Error performing bulk operations.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredPioneers = pioneers.filter(p => {
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const license = p.metadata?.account_tier === "full" ? "term" : "trial";
    const mode = p.metadata?.learning_mode || "none";
    
    const matchesType = filterType === "all" || filterType === license;
    const matchesMode = filterMode === "all" || filterMode === mode;
    
    return matchesSearch && matchesType && matchesMode;
  });

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Syncing_Pioneer_Database...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left pb-32">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* NAV & TITLE */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-500/50 px-4 py-2 rounded-xl transition-all w-fit text-slate-400 hover:text-white">
              <ArrowLeft size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Command Center</span>
            </Link>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Student_<span className="text-blue-500">Ledger</span></h1>
          </div>
          {selectedIds.length > 0 && (
             <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-wrap items-center gap-3 bg-blue-600 p-2 rounded-2xl shadow-xl shadow-blue-900/40 border border-blue-400">
                <span className="px-4 text-[10px] font-black uppercase tracking-widest">{selectedIds.length} Selected</span>
                <div className="h-8 w-px bg-white/20 mx-2 hidden md:block" />
                <button onClick={() => handleBulkUpdate('demo')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase transition-all">Set Trial</button>
                <button onClick={() => handleBulkUpdate('full', 'in-person')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-[9px] font-black uppercase transition-all text-black">Set In-Person</button>
                <button onClick={() => handleBulkUpdate('full', 'online')} className="px-4 py-2 bg-purple-500 hover:bg-purple-400 rounded-xl text-[9px] font-black uppercase transition-all text-white">Set Online</button>
                <button onClick={() => setSelectedIds([])} className="p-2 hover:bg-black/20 rounded-xl transition-all"><X size={16}/></button>
             </motion.div>
          )}
        </header>

        {/* HEARTBEAT ROW */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { label: "Active Pioneers", value: pulse.total > 0 ? pulse.total : "---", icon: Users, color: "text-blue-400" },
                { label: "LMS Adoption", value: pulse.total > 0 ? `${Math.round((pulse.adopted / pulse.total) * 100)}%` : "---", icon: Activity, color: "text-emerald-400" },
                { label: "Term Licenses", value: pulse.termCount > 0 ? pulse.termCount : "---", icon: CreditCard, color: "text-purple-400" },
                { label: "Avg Attendance", value: pulse.avgAttendance > 0 ? `${pulse.avgAttendance}%` : "---", icon: Clock, color: "text-orange-400" },
            ].map((stat, i) => (
                <div key={i} className={`bg-white/[0.03] border border-white/5 p-5 rounded-[24px] relative overflow-hidden group ${stat.value === "---" ? 'opacity-40 grayscale' : ''}`}>
                    <stat.icon className={`absolute -right-2 -bottom-2 size-12 opacity-5 ${stat.color}`} />
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">{stat.label}</p>
                    <h4 className={`text-2xl font-black italic ${stat.color}`}>{stat.value}</h4>
                </div>
            ))}
        </section>

        {/* MULTI-LEVEL FILTERS */}
        <div className="space-y-4 bg-white/[0.02] border border-white/5 p-6 rounded-[32px]">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="relative group w-full lg:max-w-md">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-400 transition-colors" size={20} />
                    <input type="text" placeholder="Search by Pioneer Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-[24px] py-4 pl-16 pr-8 text-white focus:outline-none focus:border-blue-500 transition-all font-bold" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedIds(filteredPioneers.map(p => p.id))} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase text-slate-400 transition-all border border-white/5">Select All Visible</button>
                    {selectedIds.length > 0 && <button onClick={() => setSelectedIds([])} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-[9px] font-black uppercase text-red-400 transition-all border border-red-500/20">Clear Selection</button>}
                    
                    {/* BULK EDIT SEQUENCER */}
                    <button 
                       onClick={() => {
                          if (filteredPioneers.length === 0) return;
                          const queue = filteredPioneers.map(p => p.id).join(',');
                          router.push(`/admin/student/${filteredPioneers[0].id}?queue=${queue}&bulkEdit=true`);
                       }}
                       className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[9px] font-black uppercase text-white transition-all flex items-center gap-2"
                    >
                       <LayoutGrid size={12}/> Edit List Sequentially ({filteredPioneers.length})
                    </button>

                    {/* NEW: BULK SCHEDULER */}
                    {selectedIds.length > 0 && (
                       <button 
                         onClick={() => setIsBulkModalOpen(true)}
                         className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[9px] font-black uppercase text-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2"
                       >
                         <CalendarDays size={12}/> Bulk Schedule & Edit
                       </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-4 border-t border-white/5 pt-4">
                <div className="flex bg-black/20 p-1 rounded-2xl border border-white/5">
                    {["all", "term", "trial"].map(t => (
                        <button key={t} onClick={() => setFilterType(t as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterType === t ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}>{t}</button>
                    ))}
                </div>
                <div className="flex bg-black/20 p-1 rounded-2xl border border-white/5">
                    {["all", "in-person", "online", "self-paced"].map(m => (
                        <button key={m} onClick={() => setFilterMode(m as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterMode === m ? "bg-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}>{m.replace('-', ' ')}</button>
                    ))}
                </div>
            </div>
        </div>

        {/* CARD GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPioneers.map((p) => {
            const isFull = p.metadata?.account_tier === "full";
            const mode = p.metadata?.learning_mode;
            const isSelected = selectedIds.includes(p.id);

            return (
              <motion.div 
                key={p.id}
                whileHover={{ y: -5 }}
                className={`cursor-pointer bg-[#0f172a] border p-8 rounded-[40px] relative overflow-hidden group transition-all shadow-2xl ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/10 hover:border-blue-500/50'}`}
              >
                {/* SELECTOR OVERLAY */}
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleSelection(p.id); }}
                    className={`absolute top-6 left-6 z-20 transition-all ${isSelected ? 'text-blue-500' : 'text-slate-700 opacity-0 group-hover:opacity-100 hover:text-blue-400'}`}
                >
                    {isSelected ? <CheckSquare size={24} fill="currentColor" className="text-white" /> : <Square size={24} />}
                </button>

                {/* ROUTE DIRECTLY TO FULL DOSSIER */}
                <div onClick={() => router.push(`/admin/student/${p.id}`)}>
                    <div className="flex justify-between items-start mb-6 pl-8">
                        <div className={`size-12 rounded-2xl flex items-center justify-center border ${isFull ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-purple-500/30 bg-purple-500/10 text-purple-400'}`}>
                            <User size={24} />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isFull ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                {isFull ? 'Term License' : 'Trial Access'}
                            </span>
                            {isFull && mode && <span className="text-[8px] font-black uppercase text-slate-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">{mode.replace('-', ' ')}</span>}
                        </div>
                    </div>
                    <h3 className="text-2xl font-black uppercase italic group-hover:text-blue-400 transition-colors leading-none">{p.display_name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Guardian: {p.parent?.display_name || "Unlinked"}</p>
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Username</span>
                            <span className="text-xs font-bold text-slate-300">{p.metadata?.username || 'not_set'}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Instructor</span>
                            <span className="text-sm font-black text-blue-400 italic">{p.metadata?.teacher?.name?.split(' ')[0] || 'Unassigned'}</span>
                        </div>
                    </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ================================================= */}
      {/* BULK SCHEDULER & LOGISTICS MODAL                  */}
      {/* ================================================= */}
      <AnimatePresence>
        {isBulkModalOpen && (
           <AdminBulkOperationsModal 
             isOpen={isBulkModalOpen}
             onClose={() => setIsBulkModalOpen(false)}
             // Pass the actual selected student objects instead of just the count
             selectedStudents={pioneers.filter(p => selectedIds.includes(p.id))} 
             availableCourses={availableCourses}
             isProcessing={isProcessing}
             onSubmit={executeBulkScheduling}
           />
        )}
      </AnimatePresence>

    </div>
  );
}

// ---------------------------------------------------------
// NEW ADMIN COMPONENT: ADVANCED BULK SCHEDULER
// ---------------------------------------------------------
function AdminBulkOperationsModal({ isOpen, onClose, selectedStudents, availableCourses, isProcessing, onSubmit }: any) {
  const [tab, setTab] = useState<'create' | 'update'>('create');
  
  // Create Tab State
  const [course, setCourse] = useState(availableCourses[0] || "");
  const [delivery, setDelivery] = useState("in-person");
  const [startDate, setStartDate] = useState("");
  const [startTopic, setStartTopic] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [isRecurring, setIsRecurring] = useState(true);
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");

  // Update Tab State
  const [targetCourse, setTargetCourse] = useState(availableCourses[0] || "");
  const [newDelivery, setNewDelivery] = useState("in-person");
  const [newLocation, setNewLocation] = useState("");
  const [newLink, setNewLink] = useState("");

  const syllabus = getSyllabusForCourse(tab === 'create' ? course : targetCourse);

  // --- DYNAMIC END DATE CALCULATOR ---
  const calculatedEndDate = useMemo(() => {
    if (tab === 'create' && startDate && isRecurring && weeks >= 2) {
       const startDt = new Date(startDate);
       if (!isNaN(startDt.getTime())) {
          const endDt = new Date(startDt);
          endDt.setDate(startDt.getDate() + (weeks - 1) * 7);
          return endDt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
       }
    }
    return null;
  }, [tab, startDate, isRecurring, weeks]);

  const handleSubmit = () => {
     if (tab === 'create') {
        if (!startDate || !startTopic) return alert("Select a start date and topic.");
        onSubmit('create', { course, delivery, startDate, startTopic, weeks: isRecurring ? weeks : 1, location, link });
     } else {
        if (newDelivery === 'in-person' && !newLocation) return alert("Enter a new venue.");
        if (newDelivery === 'online' && !newLink) return alert("Enter a new link.");
        onSubmit('update', { targetCourse, newDelivery, newLocation, newLink });
     }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30"><CalendarDays size={24} /></div>
            <div>
                <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Bulk Logistics</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Applying to {selectedStudents?.length || 0} Students</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-[#020617] border-b border-white/5 shrink-0">
           <button onClick={() => setTab('create')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors border-b-2 ${tab === 'create' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Create New Lessons</button>
           <button onClick={() => setTab('update')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors border-b-2 ${tab === 'update' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Update Existing Venues/Links</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
           
           {/* TARGET STUDENTS LIST */}
           <div className="mb-6 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Targeting Roster:</label>
              <div className="flex flex-wrap gap-2 p-3 bg-[#020617] border border-white/5 rounded-2xl max-h-24 overflow-y-auto custom-scrollbar">
                 {selectedStudents?.map((s: any) => (
                    <span key={s.id} className="bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                       {s.display_name}
                    </span>
                 ))}
              </div>
           </div>
           
           {/* CREATE TAB */}
           {tab === 'create' && (
              <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Course</label>
                       <select value={course} onChange={e => setCourse(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                         {availableCourses.map((c: string) => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Delivery Mode</label>
                       <select value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                         <option value="in-person">In-person</option>
                         <option value="online">Online</option>
                       </select>
                    </div>
                 </div>

                 {/* Venue / Link Input */}
                 <div className="space-y-2 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-2 flex items-center gap-2">
                       {delivery === 'online' ? <><Video size={12}/> Zoom/Meet Link (Applies to all generated lessons)</> : <><MapPin size={12}/> Physical Venue (Applies to all generated lessons)</>}
                    </label>
                    <input 
                       type={delivery === 'online' ? 'url' : 'text'}
                       value={delivery === 'online' ? link : location} 
                       onChange={e => delivery === 'online' ? setLink(e.target.value) : setLocation(e.target.value)} 
                       placeholder={delivery === 'online' ? "https://zoom.us/..." : "e.g. Centurion Main Lab"}
                       className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500" 
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Starting Date & Time</label>
                      <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Starting Topic</label>
                      <select value={startTopic} onChange={e => setStartTopic(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                        <option value="" disabled>Select Starting Point...</option>
                        {syllabus.map(lesson => <option key={lesson.week} value={`Week ${lesson.week}: ${lesson.title}`}>Week {lesson.week} - {lesson.title}</option>)}
                      </select>
                    </div>
                 </div>

                 <div className={`p-4 rounded-2xl border transition-colors cursor-pointer ${isRecurring ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`} onClick={() => setIsRecurring(!isRecurring)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         {isRecurring ? <CheckSquare size={18} className="text-emerald-400"/> : <Square size={18} className="text-slate-600"/>}
                         <div>
                            <p className="text-sm font-bold text-white">Recurring Weekly</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Auto-advances syllabus topic</p>
                         </div>
                      </div>
                      {isRecurring && (
                        <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weeks:</label>
                           <input type="number" min="1" max="52" value={weeks} onChange={e => setWeeks(parseInt(e.target.value))} className="w-16 bg-[#020617] border border-emerald-500/30 rounded-lg px-2 py-1 text-white font-bold text-center outline-none" />
                        </div>
                      )}
                    </div>
                    {/* DYNAMIC END DATE NOTIFIER */}
                    {calculatedEndDate && (
                       <div className="mt-4 pt-3 border-t border-emerald-500/20">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                             <TrendingUp size={12}/> Final scheduled lesson will be on: <span className="text-white italic">{calculatedEndDate}</span>
                          </p>
                       </div>
                    )}
                 </div>
              </div>
           )}

           {/* UPDATE TAB */}
           {tab === 'update' && (
              <div className="space-y-6">
                 <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                    <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5"/>
                    <p className="text-xs font-bold text-blue-200">This action will scan all <strong className="text-white">FUTURE scheduled lessons</strong> for the selected students in the target course and completely overwrite their Venue or Zoom Link.</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Target Course</label>
                       <select value={targetCourse} onChange={e => setTargetCourse(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                         {availableCourses.map((c: string) => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Change Delivery To</label>
                       <select value={newDelivery} onChange={e => setNewDelivery(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none">
                         <option value="in-person">In-person (Set Venue)</option>
                         <option value="online">Online (Set Zoom Link)</option>
                       </select>
                    </div>
                 </div>

                 <div className="space-y-2 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2 flex items-center gap-2">
                       {newDelivery === 'online' ? <><Video size={12}/> New Zoom/Meet Link</> : <><MapPin size={12}/> New Physical Venue</>}
                    </label>
                    <input 
                       type={newDelivery === 'online' ? 'url' : 'text'}
                       value={newDelivery === 'online' ? newLink : newLocation} 
                       onChange={e => newDelivery === 'online' ? setNewLink(e.target.value) : setNewLocation(e.target.value)} 
                       placeholder={newDelivery === 'online' ? "https://zoom.us/..." : "e.g. Centurion Main Lab"}
                       className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500" 
                    />
                 </div>
              </div>
           )}

        </div>

        <div className="p-6 border-t border-white/5 bg-[#020617] flex justify-between items-center gap-4 shrink-0">
          <button onClick={onClose} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
          <button 
            onClick={handleSubmit} 
            disabled={isProcessing}
            className={`flex-1 py-4 text-black rounded-2xl font-black uppercase italic tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${tab === 'create' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'}`}
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <CalendarDays size={18}/>} 
            {tab === 'create' ? 'Generate Lessons' : 'Overwrite Logistics'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}