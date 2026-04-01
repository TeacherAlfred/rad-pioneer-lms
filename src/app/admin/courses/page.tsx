"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Search, MoreVertical, LayoutDashboard, 
  ArrowLeft, BookOpen, Rocket, Loader2, Calendar, Globe, Lock, EyeOff,
  SortAsc, Clock, Edit3, X, Save, ShieldAlert
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

  // --- EDIT MODAL STATE ---
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  // --- UPDATE LOGIC ---
  async function handleUpdateCourse(e: React.FormEvent) {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('courses')
        .update({
          title: editingCourse.title,
          description: editingCourse.description,
          is_published: editingCourse.is_published,
          visibility: editingCourse.visibility,
          launch_date: editingCourse.launch_date,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', editingCourse.id);

      if (error) throw error;
      
      setEditingCourse(null);
      await fetchCourses();
    } catch (err) {
      console.error("UPDATE_ERROR:", err);
      alert("System Error: Calibration failed.");
    } finally {
      setIsUpdating(false);
    }
  }

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
                    onClick={() => setEditingCourse(course)}
                    className="text-slate-600 hover:text-white transition-colors bg-white/5 p-2.5 rounded-2xl border border-white/5"
                  >
                    <Edit3 size={20} />
                  </button>
                </div>

                <div className="flex-1 space-y-4">
                  <h3 className="text-3xl font-black uppercase italic leading-[0.85] group-hover:text-blue-400 transition-colors tracking-tighter">
                    {course.title}
                  </h3>
                  {course.launch_date && !course.is_published && (
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
                  <button className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 opacity-30 cursor-not-allowed py-5 rounded-3xl">
                    <BookOpen size={18} className="text-slate-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lessons</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* --- CALIBRATION MODAL --- */}
        <AnimatePresence>
          {editingCourse && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingCourse(null)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
              <motion.form 
                onSubmit={handleUpdateCourse}
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="relative bg-[#0f172a] border border-white/10 rounded-[56px] w-full max-w-2xl overflow-hidden shadow-2xl"
              >
                <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30 text-blue-400"><ShieldAlert size={24} /></div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Sector_Calibration</h2>
                  </div>
                  <button type="button" onClick={() => setEditingCourse(null)} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
                </div>

                <div className="p-12 space-y-8">
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
                        rows={4} value={editingCourse.description}
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
                </div>

                <div className="p-10 border-t border-white/5 bg-black/40 flex justify-end items-center gap-8">
                  <button type="button" onClick={() => setEditingCourse(null)} className="text-[10px] font-black uppercase text-slate-600 tracking-widest hover:text-white transition-colors">Abort_Calibration</button>
                  <button 
                    type="submit" disabled={isUpdating}
                    className="bg-blue-600 text-white px-14 py-5 rounded-3xl font-black uppercase italic text-xs tracking-widest flex items-center gap-3 hover:bg-blue-500 shadow-2xl shadow-blue-600/30 transition-all"
                  >
                    {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Sync_to_Terminal
                  </button>
                </div>
              </motion.form>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}