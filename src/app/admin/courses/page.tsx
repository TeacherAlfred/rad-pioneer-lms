"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link"; // <-- NEW: Imported Link
import { 
  BookOpen, Plus, Search, MoreVertical, 
  Edit3, Trash2, Eye, ShieldAlert,
  Gamepad2, FileText
} from "lucide-react";

// Matches your exact 'courses' table schema
type Course = {
  id: string;
  title: string;
  description: string;
  order_index: number;
  is_published: boolean;
};

export default function CurriculumBuilder() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Curriculum Builder</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your courses, gamified modules, and missions.</p>
        </div>
        
        <button className="flex items-center gap-2 bg-rad-blue text-[#020617] px-6 py-3 rounded-xl font-bold text-sm hover:bg-rad-blue/90 transition-colors shadow-lg shadow-rad-blue/20">
          <Plus size={18} /> New Course
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-[#0f172a]/80 p-4 rounded-2xl border border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search courses..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#020617] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-rad-blue transition-colors"
          />
        </div>
      </div>

      {/* Courses Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-rad-blue border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div key={course.id} className="bg-[#0f172a]/80 border border-white/5 rounded-3xl p-6 flex flex-col group hover:border-rad-blue/30 transition-all shadow-lg hover:shadow-rad-blue/5">
              
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg ${course.is_published ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                  {course.is_published ? 'Published' : 'Draft'}
                </div>
                <button className="text-slate-500 hover:text-white transition-colors">
                  <MoreVertical size={18} />
                </button>
              </div>

              <h3 className="text-xl font-black text-white mb-2 leading-tight">{course.title}</h3>
              <p className="text-slate-400 text-sm line-clamp-2 mb-6 flex-1">
                {course.description || "No description provided."}
              </p>

              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                {/* NEW: This is now a Link that routes to the specific Course ID */}
                <Link 
                  href={`/admin/courses/${course.id}`} 
                  className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  <Gamepad2 size={16} className="text-rad-blue" /> Modules
                </Link>
                
                <button className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                  <FileText size={16} className="text-rad-purple" /> Lessons
                </button>
              </div>
            </div>
          ))}

          {filteredCourses.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <BookOpen size={48} className="mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">No courses found</h3>
              <p className="text-slate-500 text-sm">Create your first course to start building the curriculum.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}