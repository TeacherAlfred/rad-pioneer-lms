"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Search, MoreVertical, LayoutDashboard, 
  ArrowLeft, BookOpen, Rocket, Loader2, Calendar, Globe, Lock, EyeOff,
  SortAsc, Clock, Edit3, X, Save, ShieldAlert, UserPlus, Users, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type SortOption = "name" | "launch_date" | "status";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "public" | "private" | "draft">("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- EDIT MODAL STATE ---
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // --- BATCH ENROLLMENT STATE ---
  const [enrollCourse, setEnrollCourse] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .order('order_index', { ascending: true });
    
    setCourses(data || []);
    setLoading(false);
  }

  // --- FORMAT DATE FOR INPUT ---
  const formatDateTimeLocal = (dateString: string | null) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const handleEditClick = (course: any) => {
    setEditingCourse({
      ...course,
      launch_date_input: formatDateTimeLocal(course.launch_date)
    });
  };

  // --- UPDATE LOGIC ---
  async function handleUpdateCourse(e: React.FormEvent) {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const finalLaunchDate = editingCourse.launch_date_input 
        ? new Date(editingCourse.launch_date_input).toISOString() 
        : null;

      const { error } = await supabase
        .from('courses')
        .update({
          title: editingCourse.title,
          description: editingCourse.description,
          is_published: editingCourse.is_published,
          visibility: editingCourse.visibility,
          launch_date: finalLaunchDate,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', editingCourse.id);

      if (error) throw error;
      
      setSuccessMessage("Course calibrated and synced successfully.");
      setEditingCourse(null);
      await fetchCourses();
    } catch (err) {
      console.error("UPDATE_ERROR:", err);
      alert("System Error: Calibration failed.");
    } finally {
      setIsUpdating(false);
    }
  }

  // --- ENROLLMENT ENGINE LOGIC ---
  const handleOpenEnrollment = async (course: any) => {
    setEnrollCourse(course);
    setStudentSearch("");

    // 1. Fetch all student profiles
    const { data: stData } = await supabase
       .from('profiles')
       .select('id, display_name, metadata')
       .eq('role', 'student')
       .order('display_name', { ascending: true });
    
    setStudents(stData || []);

    // 2. Fetch existing enrollments for this specific course
    const { data: enData } = await supabase
       .from('enrollments')
       .select('student_id')
       .eq('course_id', course.id);
       
    const existingIds = (enData || []).map(e => e.student_id);
    setEnrolledStudentIds(existingIds);
    // 3. Pre-select already enrolled students
    setSelectedStudentIds(existingIds); 
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handleExecuteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEnrolling(true);

    try {
      // Differentiate between new enrollments and un-enrollments
      const toInsert = selectedStudentIds.filter(id => !enrolledStudentIds.includes(id));
      const toDelete = enrolledStudentIds.filter(id => !selectedStudentIds.includes(id));

      if (toInsert.length === 0 && toDelete.length === 0) {
        setEnrollCourse(null);
        return;
      }

      // Execute Insertions
      if (toInsert.length > 0) {
        const payloads = toInsert.map(id => ({
          student_id: id,
          course_id: enrollCourse.id,
          status: 'active'
        }));
        const { error: insertError } = await supabase.from('enrollments').insert(payloads);
        if (insertError) throw insertError;
      }

      // Execute Deletions
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('enrollments')
          .delete()
          .eq('course_id', enrollCourse.id)
          .in('student_id', toDelete);
        if (deleteError) throw deleteError;
      }

      setSuccessMessage(`Roster synced! (+${toInsert.length} enrolled, -${toDelete.length} removed)`);
      setEnrollCourse(null);
      
    } catch (err: any) {
      alert("Failed to execute enrollment: " + err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  const hasEnrollmentChanges = selectedStudentIds.length !== enrolledStudentIds.length || selectedStudentIds.some(id => !enrolledStudentIds.includes(id));

  // --- SORT & FILTER LOGIC ---
  const processedCourses = courses
    .filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (activeTab === "all") return matchesSearch;
      if (activeTab === "draft") return matchesSearch && !course.is_published;
      if (activeTab === "public") return matchesSearch && course.is_published && course.visibility === 'public';
      if (activeTab === "private") return matchesSearch && course.is_published && course.visibility === 'private';
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      if (sortBy === "status") return Number(b.is_published) - Number(a.is_published);
      if (sortBy === "launch_date") {
        const dateA = a.launch_date ? new Date(a.launch_date).getTime() : Infinity;
        const dateB = b.launch_date ? new Date(b.launch_date).getTime() : Infinity;
        return dateA - dateB;
      }
      return 0;
    });

  const filteredStudents = students.filter(s => 
     s.display_name?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-[0.3em] text-[10px]">Accessing_Archives...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 text-left relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* --- HEADER SECTION --- */}
        <header className="space-y-8">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-500/50 px-5 py-2.5 rounded-2xl transition-all">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Mission Control</span>
            </Link>

            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-[20px] font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-600/20">
              <Plus size={18} /> New Course
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-2">
              <h1 className="text-6xl font-black uppercase italic tracking-tighter text-white leading-none">
                Curriculum_<span className="text-blue-500">Archives</span>
              </h1>
              <div className="flex items-center gap-4">
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{processedCourses.length} Sectors Scanned</p>
                 <div className="h-1 w-1 rounded-full bg-slate-800" />
                 <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.2em] italic">Active_Filter: {activeTab}</p>
              </div>
            </div>

            {/* --- FILTER TABS --- */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
              {["all", "public", "private", "draft"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab 
                    ? "bg-blue-600 text-white shadow-lg" 
                    : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* --- CONTROLS: SCANNER & SORT --- */}
        <div className="flex flex-col md:flex-row gap-6 pt-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors" size={22} />
            <input 
              type="text"
              placeholder="SCANNING ARCHIVES..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e293b]/50 border border-white/5 rounded-[40px] py-7 pl-20 pr-8 text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-800 font-black italic uppercase tracking-tighter text-lg"
            />
          </div>

          <div className="bg-[#1e293b]/50 border border-white/5 rounded-[40px] px-10 flex items-center gap-4 group hover:border-blue-500/30 transition-all">
            <SortAsc size={20} className="text-blue-500" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-[10px] font-black uppercase tracking-[0.2em] text-white outline-none cursor-pointer py-7 pr-4 appearance-none"
            >
              <option value="name" className="bg-[#0f172a]">By Name</option>
              <option value="launch_date" className="bg-[#0f172a]">By Launch</option>
              <option value="status" className="bg-[#0f172a]">By Status</option>
            </select>
          </div>
        </div>

        {/* --- GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {processedCourses.map((course) => (
              <motion.div 
                layout key={course.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1e293b]/30 border border-white/5 rounded-[56px] p-10 flex flex-col h-full hover:border-white/20 transition-all group relative overflow-hidden shadow-2xl"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border italic ${
                      course.is_published ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    }`}>
                      {course.is_published ? 'Uplink Active' : 'Offline'}
                    </span>
                    {course.is_published && (
                      <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border italic flex items-center gap-1.5 ${
                        course.visibility === 'public' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {course.visibility === 'public' ? <Globe size={10}/> : <Lock size={10}/>}
                        {course.visibility}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => handleEditClick(course)}
                    className="text-slate-600 hover:text-white transition-colors bg-white/5 p-2.5 rounded-2xl border border-white/5"
                  >
                    <Edit3 size={20} />
                  </button>
                </div>

                <div className="flex-1 space-y-4">
                  <h3 className="text-3xl font-black uppercase italic leading-[0.85] group-hover:text-blue-400 transition-colors tracking-tighter">
                    {course.title}
                  </h3>
                  {course.launch_date && (
                    <div className="flex items-center gap-2 text-blue-400 bg-blue-400/5 py-2 px-4 rounded-xl border border-blue-400/10 w-fit">
                      <Clock size={12} />
                      <span className="text-[9px] font-black uppercase tracking-widest italic">
                        Launch: {new Date(course.launch_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <p className="text-slate-400 text-sm line-clamp-3 font-medium italic leading-relaxed">
                    {course.description || "Sector data missing. Manual override required."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-12">
                  <Link href={`/admin/courses/${course.id}`} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-blue-600 hover:border-blue-600 py-5 rounded-3xl transition-all group/btn shadow-xl">
                    <Rocket size={18} className="text-blue-400 group-hover/btn:text-white" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Modules</span>
                  </Link>
                  
                  {/* --- ENROLL BUTTON --- */}
                  <button onClick={() => handleOpenEnrollment(course)} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-emerald-600 hover:border-emerald-600 py-5 rounded-3xl transition-all group/btn shadow-xl">
                    <UserPlus size={18} className="text-emerald-400 group-hover/btn:text-white" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover/btn:text-white">Roster</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* --- CALIBRATION MODAL (EDIT COURSE) --- */}
        <AnimatePresence>
          {editingCourse && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingCourse(null)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
              <motion.form 
                onSubmit={handleUpdateCourse}
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="relative bg-[#0f172a] border border-white/10 rounded-[56px] w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
              >
                <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30 text-blue-400"><ShieldAlert size={24} /></div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Sector_Calibration</h2>
                  </div>
                  <button type="button" onClick={() => setEditingCourse(null)} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
                </div>

                <div className="p-12 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2">Sector Title</label>
                      <input 
                        required value={editingCourse.title}
                        onChange={e => setEditingCourse({...editingCourse, title: e.target.value})}
                        className="w-full bg-[#020617] border border-white/10 rounded-2xl px-8 py-5 text-white font-black italic uppercase text-lg outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2">Sector Objective Narrative</label>
                      <textarea 
                        rows={4} value={editingCourse.description || ''}
                        onChange={e => setEditingCourse({...editingCourse, description: e.target.value})}
                        className="w-full bg-[#020617] border border-white/10 rounded-[32px] px-8 py-6 text-white text-sm outline-none focus:border-blue-500 resize-none italic font-medium leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2">Uplink Status</label>
                      <select 
                        value={editingCourse.is_published ? "true" : "false"}
                        onChange={e => setEditingCourse({...editingCourse, is_published: e.target.value === "true"})}
                        className="w-full bg-[#020617] border border-white/10 rounded-2xl px-8 py-5 text-white font-black uppercase italic text-[10px] tracking-widest outline-none appearance-none cursor-pointer focus:border-blue-500"
                      >
                        <option value="true" className="bg-[#020617]">ONLINE (PUBLISHED)</option>
                        <option value="false" className="bg-[#020617]">OFFLINE (DRAFT)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2">Visibility Level</label>
                      <select 
                        value={editingCourse.visibility}
                        onChange={e => setEditingCourse({...editingCourse, visibility: e.target.value})}
                        className="w-full bg-[#020617] border border-white/10 rounded-2xl px-8 py-5 text-white font-black uppercase italic text-[10px] tracking-widest outline-none appearance-none cursor-pointer focus:border-blue-500"
                      >
                        <option value="public" className="bg-[#020617]">PUBLIC ARCHIVE</option>
                        <option value="private" className="bg-[#020617]">PRIVATE COHORT</option>
                      </select>
                    </div>
                  </div>

                  {/* NEW: LAUNCH DATE CONTROL */}
                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-1 ml-2">
                       <Calendar size={14} className="text-blue-400" />
                       <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Scheduled Release Date</label>
                    </div>
                    <input 
                      type="datetime-local" 
                      value={editingCourse.launch_date_input || ''}
                      onChange={e => setEditingCourse({...editingCourse, launch_date_input: e.target.value})}
                      className="w-full bg-[#020617] border border-blue-500/30 rounded-2xl px-8 py-5 text-white font-bold text-sm outline-none focus:border-blue-500 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 italic mt-2 ml-2">Leave blank for immediate availability.</p>
                  </div>
                </div>

                <div className="p-10 border-t border-white/5 bg-black/40 flex justify-end items-center gap-8 shrink-0">
                  <button type="button" onClick={() => setEditingCourse(null)} className="text-[10px] font-black uppercase text-slate-600 tracking-widest hover:text-white transition-colors">Abort_Calibration</button>
                  <button 
                    type="submit" disabled={isUpdating}
                    className="bg-blue-600 text-white px-14 py-5 rounded-3xl font-black uppercase italic text-xs tracking-widest flex items-center gap-3 hover:bg-blue-500 shadow-2xl shadow-blue-600/30 transition-all disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Sync_to_Terminal
                  </button>
                </div>
              </motion.form>
            </div>
          )}
        </AnimatePresence>

        {/* --- BATCH ENROLLMENT MODAL --- */}
        <AnimatePresence>
          {enrollCourse && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEnrollCourse(null)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
              <motion.form 
                onSubmit={handleExecuteEnrollment}
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="relative bg-[#0f172a] border border-white/10 rounded-[56px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 text-emerald-400"><Users size={28} /></div>
                    <div>
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Roster Synchronization</h2>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-2">Target: {enrollCourse.title}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setEnrollCourse(null)} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
                </div>

                <div className="p-10 space-y-6 flex-1 overflow-hidden flex flex-col">
                   
                   <div className="relative group shrink-0">
                     <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                     <input 
                       type="text" placeholder="Search Pioneer Database..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
                       className="w-full bg-[#020617] border border-white/10 rounded-[24px] py-4 pl-14 pr-6 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm font-bold"
                     />
                   </div>

                   <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                      {filteredStudents.length === 0 ? (
                         <div className="py-12 text-center text-slate-500 text-sm font-bold italic uppercase tracking-widest">No Pioneers Found</div>
                      ) : (
                         filteredStudents.map(student => {
                            const isSelected = selectedStudentIds.includes(student.id);
                            
                            return (
                               <div 
                                 key={student.id}
                                 onClick={() => handleToggleStudent(student.id)}
                                 className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'bg-emerald-600/10 border-emerald-500/30' 
                                      : 'bg-[#020617] border-white/5 hover:border-white/20'
                                 }`}
                               >
                                  <div>
                                     <p className="font-bold text-sm text-white">{student.display_name}</p>
                                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Age: {student.metadata?.age || 'Unknown'}</p>
                                  </div>
                                  <div>
                                    <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-white/20'}`}>
                                       {isSelected && <CheckCircle2 size={14} className="text-white"/>}
                                    </div>
                                  </div>
                               </div>
                            )
                         })
                      )}
                   </div>
                </div>

                <div className="p-10 border-t border-white/5 bg-black/40 flex justify-between items-center gap-8 shrink-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                     <span className="text-emerald-400 text-lg mr-2">{selectedStudentIds.length}</span> Active Selection
                  </div>
                  <button 
                    type="submit" disabled={isEnrolling || !hasEnrollmentChanges}
                    className="bg-emerald-600 text-white px-10 py-5 rounded-3xl font-black uppercase italic text-xs tracking-widest flex items-center gap-3 hover:bg-emerald-500 shadow-2xl shadow-emerald-600/30 transition-all disabled:opacity-50"
                  >
                    {isEnrolling ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} Sync_Roster
                  </button>
                </div>
              </motion.form>
            </div>
          )}
        </AnimatePresence>

      </div>
      
      {/* SUCCESS NOTIFICATION WIDGET */}
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage(null)} />
    </div>
  );
}

// ---------------------------------------------------------
// SUCCESS MODAL NOTIFICATION WIDGET
// ---------------------------------------------------------
function SuccessModal({ message, onClose }: { message: string | null, onClose: () => void }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <div className="fixed bottom-10 right-10 z-[300] flex justify-end pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 20, scale: 0.9 }} 
            className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl p-5 shadow-2xl shadow-emerald-900/20 flex items-center gap-4 max-w-sm w-full pointer-events-auto relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="text-emerald-400" size={20} />
            </div>
            <div className="flex-1 pr-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none mb-1">Success</h3>
              <p className="text-[10px] font-bold text-slate-400 leading-tight">{message}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors shrink-0">
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}