"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, User, Map, Zap, Calendar, MapPin, Video, 
  Clock, Shield, BookOpen, CheckSquare, Square, 
  Activity, Award, Loader2, Link as LinkIcon, CheckCircle2,
  Trash2, Edit2, Save, Phone, Mail, FileText, Users, Settings, ChevronDown, LayoutGrid
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileProps {
  studentId: string;
  role: "teacher" | "admin";
}

export default function ComprehensiveStudentProfile({ studentId, role }: ProfileProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [guardian, setGuardian] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [educators, setEducators] = useState<any[]>([]);
  
  // Bulk Edit Queue State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);

  // Schedule State
  const [schedule, setSchedule] = useState<any[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | boolean>(false);

  // Notes State
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Configuration State
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configData, setConfigData] = useState({
    tier: 'trial',
    mode: 'in-person',
    teacherId: ''
  });

  // Scroll Tracking State
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 150); // Adjust this value if you want it to trigger sooner/later
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // URL Param Parsing for Queue
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const bulk = params.get('bulkEdit') === 'true' && role === 'admin';
        setIsBulkMode(bulk);
        
        const q = params.get('queue');
        setQueue(q ? q.split(',') : []);

        if (bulk) {
            setIsEditingConfig(true);
            setIsEditingNotes(true);
        }
    }
  }, [role]);

  useEffect(() => {
    if (studentId) fetchStudentData();
  }, [studentId]);

  async function fetchStudentData() {
    try {
      // 1. Fetch Student Profile
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();
      
      if (profileErr) throw profileErr;
      
      const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
      profile.metadata = meta;
      
      setStudent(profile);
      setSchedule(meta.schedule || []);
      setNotes(meta.admin_notes || meta.teacher_notes || "");

      setConfigData({
        tier: meta.account_tier || 'trial',
        mode: meta.learning_mode || 'in-person',
        teacherId: meta.teacher?.id || ''
      });

      // 2. Fetch Guardian Profile
      if (profile.linked_parent_id) {
        const { data: gData } = await supabase.from('profiles').select('*').eq('id', profile.linked_parent_id).single();
        if (gData) {
          const gMeta = typeof gData.metadata === 'string' ? JSON.parse(gData.metadata) : (gData.metadata || {});
          setGuardian({
            name: gData.display_name || 'Unknown Guardian',
            email: gMeta.email || gData.email || 'No email provided',
            phone: gMeta.phone || 'No phone provided',
            relation: gMeta.relation || 'Guardian'
          });
        }
      }

      // 3. Fetch Enrollments
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('*, courses(*)')
        .eq('student_id', studentId);
        
      if (enrollmentsData) setEnrollments(enrollmentsData);

      // 4. Fetch Educators for Assignment Dropdown (Using your exact Pioneer Dashboard logic)
      const { data: educatorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'educator')
        .order('display_name', { ascending: true });
        
      if (educatorData) {
        setEducators(educatorData);
      }

    } catch (err) {
      console.error("Failed to load student dossier", err);
    } finally {
      setLoading(false);
    }
  }

  // --- SMART SCHEDULE PARSER ---
  const { pastLessons, upcomingLessons } = useMemo(() => {
    const now = new Date().getTime();
    const threshold = now - (2 * 60 * 60 * 1000); 

    const sorted = [...schedule].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const past = sorted.filter(l => new Date(l.date).getTime() < threshold);
    const upcoming = sorted.filter(l => new Date(l.date).getTime() >= threshold);

    return { pastLessons: past, upcomingLessons: upcoming };
  }, [schedule]);

  const dynamicNextLesson = upcomingLessons.length > 0 ? upcomingLessons[0] : null;

  // --- ITINERARY UTILS ---
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
      const newSchedule = schedule.map(lesson => {
        if (selectedLessonIds.includes(lesson.id)) {
          return { ...lesson, delivery: isLink ? 'online' : 'in-person', link: isLink ? bulkInput : null, location: !isLink ? bulkInput : null };
        }
        return lesson;
      });
      await supabase.from('profiles').update({ metadata: { ...student.metadata, schedule: newSchedule } }).eq('id', student.id);
      setSchedule(newSchedule);
      setSelectedLessonIds([]);
      setBulkInput("");
    } finally { setIsUpdating(false); }
  };

  // --- GLOBAL QUEUE SAVER (BULK MODE) ---
  const handleBulkSaveAndNext = async () => {
    if (!student) return;
    setIsSavingGlobal(true);
    
    try {
        const selectedEd = educators.find(e => e.id === configData.teacherId);
        const teacherObj = selectedEd ? {
          id: selectedEd.id,
          name: selectedEd.display_name,
          email: selectedEd.email || '',
          whatsapp: (typeof selectedEd.metadata === 'string' ? JSON.parse(selectedEd.metadata) : selectedEd.metadata)?.phone || ''
        } : null;

        const oldMeta = student.metadata;
        
        // 1. Create a Snapshot for Rollbacks
        const historyLog = {
            timestamp: new Date().toISOString(),
            changed_by: 'admin',
            previous_state: {
                account_tier: oldMeta.account_tier,
                learning_mode: oldMeta.learning_mode,
                teacher: oldMeta.teacher,
                admin_notes: oldMeta.admin_notes || oldMeta.teacher_notes
            }
        };

        // 2. Build New Payload
        const updatedMeta = {
          ...oldMeta,
          account_tier: configData.tier,
          learning_mode: configData.mode,
          teacher: teacherObj,
          admin_notes: notes,
          history: [...(oldMeta.history || []), historyLog] // Append snapshot
        };

        await supabase.from('profiles').update({ metadata: updatedMeta }).eq('id', student.id);

        // 3. Queue Progression Logic
        const currentIndex = queue.indexOf(student.id);
        if (currentIndex > -1 && currentIndex < queue.length - 1) {
            const nextId = queue[currentIndex + 1];
            router.push(`/admin/student/${nextId}?queue=${queue.join(',')}&bulkEdit=true`);
        } else {
            alert("All students in the queue have been updated!");
            router.push('/admin/pioneers');
        }
    } catch (err) {
        alert("Error saving bulk update.");
    } finally {
        setIsSavingGlobal(false);
    }
  };

  // --- ROLLBACK FUNCTION ---
  const handleUndoLastEdit = async () => {
    if (!student.metadata?.history || student.metadata.history.length === 0) return;
    
    const confirm = window.confirm("This will restore the student's previous license, mode, teacher, and notes. Proceed?");
    if (!confirm) return;

    setIsSavingGlobal(true);
    try {
        const lastHistory = student.metadata.history[student.metadata.history.length - 1];
        const prevState = lastHistory.previous_state;
        
        const updatedMeta = {
           ...student.metadata,
           account_tier: prevState.account_tier,
           learning_mode: prevState.learning_mode,
           teacher: prevState.teacher,
           admin_notes: prevState.admin_notes,
           history: student.metadata.history.slice(0, -1) // remove last snapshot
        };

        await supabase.from('profiles').update({ metadata: updatedMeta }).eq('id', student.id);
        
        // Update Local UI instantly
        setStudent({ ...student, metadata: updatedMeta });
        setConfigData({
            tier: prevState.account_tier || 'trial',
            mode: prevState.learning_mode || 'in-person',
            teacherId: prevState.teacher?.id || ''
        });
        setNotes(prevState.admin_notes || "");
        alert("Configuration Rolled Back.");
    } catch(e) {
        alert("Rollback failed.");
    } finally {
        setIsSavingGlobal(false);
    }
  };

  // --- STANDARD SAVE HANDLERS ---
  const handleSaveNotes = async () => {
    if (!student) return;
    setIsSavingNotes(true);
    try {
      const updatedMeta = { ...student.metadata, admin_notes: notes };
      await supabase.from('profiles').update({ metadata: updatedMeta }).eq('id', student.id);
      setStudent({ ...student, metadata: updatedMeta });
      setIsEditingNotes(false);
    } finally { setIsSavingNotes(false); }
  };

  const handleSaveConfig = async () => {
    if (!student) return;
    setIsSavingConfig(true);
    try {
      const selectedEd = educators.find(e => e.id === configData.teacherId);
      const teacherObj = selectedEd ? { id: selectedEd.id, name: selectedEd.display_name, email: selectedEd.email || '', whatsapp: (typeof selectedEd.metadata === 'string' ? JSON.parse(selectedEd.metadata) : selectedEd.metadata)?.phone || '' } : null;
      const updatedMeta = { ...student.metadata, account_tier: configData.tier, learning_mode: configData.mode, teacher: teacherObj };
      await supabase.from('profiles').update({ metadata: updatedMeta }).eq('id', student.id);
      setStudent({ ...student, metadata: updatedMeta });
      setIsEditingConfig(false);
    } finally { setIsSavingConfig(false); }
  };


  if (loading || !student) return (
    <div className="h-[100dvh] bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Decrypting Pioneer Dossier...</p>
    </div>
  );

  const xp = student.xp || 0;
  const rank = xp >= 1000 ? 'Engineer' : 'Technician';
  const accentColor = role === 'admin' ? 'blue' : 'purple';

  return (
    <div className={`min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-blue-500/30 overflow-x-hidden ${isBulkMode ? 'pb-32' : ''}`}>
      
      {/* =========================================
          STICKY MINIMALIST HEADER (On Scroll)
          ========================================= */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 left-0 right-0 z-[60] bg-[#020617]/80 backdrop-blur-xl border-b border-white/10 px-6 py-4 shadow-2xl flex items-center justify-center"
          >
            <div className="w-full max-w-[1400px] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                  <ArrowLeft size={16} />
                </button>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white ${role === 'admin' ? 'bg-gradient-to-br from-blue-600 to-cyan-600' : 'bg-gradient-to-br from-purple-600 to-blue-600'}`}>
                    {student.display_name.charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-white leading-none">
                    {student.display_name}
                  </h2>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-3">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${student.metadata?.account_tier === 'full' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                  {student.metadata?.account_tier === 'full' ? 'Term License' : 'Trial Access'}
                </span>
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                  <Shield size={12}/> {rank}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto space-y-8">        
        {/* =========================================
            BULK MODE TOP BAR
            ========================================= */}
        {isBulkMode && (
          <div className="bg-blue-600 text-white p-4 md:p-6 rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-[0_0_30px_rgba(37,99,235,0.3)] relative z-20">
             <div>
                <h3 className="font-black uppercase italic tracking-widest text-xl flex items-center gap-2"><LayoutGrid size={20}/> Sequencer Mode</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mt-1">Student {queue.indexOf(studentId) + 1} of {queue.length}</p>
             </div>
             <div className="flex items-center gap-3 w-full md:w-auto">
                <button onClick={() => router.push('/admin/pioneers')} className="px-6 py-3 rounded-xl bg-black/20 hover:bg-black/30 font-black uppercase tracking-widest text-[10px] transition-colors">Abort</button>
                <button onClick={handleBulkSaveAndNext} disabled={isSavingGlobal} className="flex-1 md:flex-none px-8 py-3 rounded-xl bg-white text-blue-600 hover:scale-105 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-lg">
                   {isSavingGlobal ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save & Auto-Next
                </button>
             </div>
          </div>
        )}

        {/* =========================================
            HEADER SECTION
            ========================================= */}
        <header className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-white/5 pb-8 relative z-10">
          <div className="space-y-4">
            <button onClick={() => router.back()} className={`group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-${accentColor}-500/50 px-4 py-2 rounded-xl transition-all w-fit text-slate-400 hover:text-white`}>
              <ArrowLeft size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Back to {role === 'admin' ? 'Pioneer Database' : 'Roster'}
              </span>
            </button>
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-[32px] bg-gradient-to-br flex items-center justify-center text-4xl font-black text-white shrink-0 border border-white/10 ${role === 'admin' ? 'from-blue-600 to-cyan-600 shadow-[0_0_30px_rgba(37,99,235,0.3)]' : 'from-purple-600 to-blue-600 shadow-[0_0_30px_rgba(147,51,234,0.3)]'}`}>
                {student.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
                  {student.display_name}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`text-[10px] font-black text-${accentColor}-400 uppercase tracking-[0.2em] flex items-center gap-1.5 bg-${accentColor}-500/10 px-3 py-1 rounded-lg border border-${accentColor}-500/20`}>
                    <User size={12}/> {student.metadata?.username || student.student_identifier || 'Unregistered'}
                  </span>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                    <Shield size={12}/> {rank} Rank
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto mt-4 md:mt-0">
             <div className="bg-white/5 p-5 rounded-3xl border border-white/10 flex flex-col justify-center min-w-[140px]">
               <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-1"><Zap size={12}/> Total XP</p>
               <p className="text-3xl font-black italic">{xp}</p>
             </div>
             <div className="bg-white/5 p-5 rounded-3xl border border-white/10 flex flex-col justify-center min-w-[140px]">
               <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-1"><Activity size={12}/> Attendance</p>
               <p className="text-3xl font-black italic text-emerald-400">{student.current_streak > 0 ? `${student.current_streak} Strk` : `${pastLessons.length} Lsns`}</p>
             </div>
          </div>
        </header>

        {/* =========================================
            DOSSIER INTEL STRIP (Parent & Notes)
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          
          {/* Guardian Card */}
          <div className="lg:col-span-1 bg-[#0f172a]/60 backdrop-blur-xl border border-white/5 rounded-[32px] p-6 shadow-xl flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-400 mb-4 border-b border-white/5 pb-3">
              <Users size={16} className={`text-${accentColor}-400`} />
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Guardian Contact</h3>
            </div>
            {guardian ? (
              <div className="space-y-3">
                 <p className="text-base font-black text-white italic">{guardian.name} <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 not-italic">({guardian.relation})</span></p>
                 <div className="flex flex-col gap-2.5 text-slate-300">
                   <a href={`mailto:${guardian.email}`} className="flex items-center gap-3 text-xs font-bold hover:text-white transition-colors group">
                     <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors"><Mail size={12} className="text-slate-400 group-hover:text-white"/></div> 
                     {guardian.email}
                   </a>
                   <a href={`tel:${guardian.phone}`} className="flex items-center gap-3 text-xs font-bold hover:text-white transition-colors group">
                     <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors"><Phone size={12} className="text-slate-400 group-hover:text-white"/></div> 
                     {guardian.phone}
                   </a>
                 </div>
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500 italic py-4">No guardian profile linked.</p>
            )}
          </div>

          {/* Teacher/Admin Notes Card */}
          <div className="lg:col-span-2 bg-[#0f172a]/60 backdrop-blur-xl border border-white/5 rounded-[32px] p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-slate-400">
                <FileText size={16} className="text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-white">Internal Notes</h3>
              </div>
              {!isEditingNotes ? (
                 !isBulkMode && (
                   <button onClick={() => setIsEditingNotes(true)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg">
                     <Edit2 size={12}/> Edit Notes
                   </button>
                 )
              ) : (
                 !isBulkMode && (
                   <button onClick={handleSaveNotes} disabled={isSavingNotes} className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                     {isSavingNotes ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Save
                   </button>
                 )
              )}
            </div>
            
            {isEditingNotes ? (
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                className={`w-full flex-1 bg-[#020617] border rounded-2xl p-4 text-sm font-medium text-slate-300 outline-none resize-none min-h-[100px] shadow-inner custom-scrollbar ${isBulkMode ? 'border-blue-500/50 focus:border-blue-500' : 'border-emerald-500/30 focus:border-emerald-500/60'}`}
                placeholder="Add specific instructions, medical alerts, or progress notes here..."
              />
            ) : (
              <div className="flex-1 text-sm font-medium text-slate-300 bg-[#020617] border border-white/5 rounded-2xl p-4 overflow-y-auto whitespace-pre-wrap min-h-[100px] shadow-inner custom-scrollbar">
                {notes || <span className="text-slate-600 italic">No operational notes on file. Click edit to add instructions.</span>}
              </div>
            )}
          </div>

        </div>

        {/* =========================================
            MAIN WORKSPACE
            ========================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          <div className="xl:col-span-5 space-y-8">
            
            {/* PIONEER CONFIGURATION CARD */}
            <div className="bg-[#0f172a] rounded-[40px] border border-white/5 p-8 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase italic tracking-widest flex items-center gap-2 text-white">
                  <Shield className="text-purple-500"/> Pioneer Configuration
                </h2>
                
                <div className="flex gap-2">
                  {/* Rollback Button */}
                  {role === 'admin' && student?.metadata?.history?.length > 0 && !isEditingConfig && (
                    <button onClick={handleUndoLastEdit} disabled={isSavingGlobal} className="text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20" title="Undo Last Saved Change">
                      <Activity size={12}/> Undo
                    </button>
                  )}

                  {!isEditingConfig && !isBulkMode && (
                     <button onClick={() => setIsEditingConfig(true)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg">
                       <Edit2 size={12}/> Edit Config
                     </button>
                  )}
                </div>
              </div>

              {isEditingConfig ? (
                <div className="space-y-6 relative z-10">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">License Tier</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => setConfigData({...configData, tier: 'trial'})} className={`p-4 rounded-2xl border transition-all ${configData.tier === 'trial' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-[#020617] border-white/5 text-slate-500 hover:bg-white/5'}`}>
                         <span className="block text-[8px] font-black uppercase tracking-widest opacity-70 mb-1">Tier 01</span>
                         <span className="block text-sm font-black uppercase italic">Trial Access</span>
                       </button>
                       <button onClick={() => setConfigData({...configData, tier: 'full'})} className={`p-4 rounded-2xl border transition-all ${configData.tier === 'full' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#020617] border-white/5 text-slate-500 hover:bg-white/5'}`}>
                         <span className="block text-[8px] font-black uppercase tracking-widest opacity-70 mb-1">Tier 02</span>
                         <span className="block text-sm font-black uppercase italic">Term License</span>
                       </button>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Learning Mode</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['in-person', 'online', 'self-paced'].map(mode => (
                         <button key={mode} onClick={() => setConfigData({...configData, mode})} className={`py-3 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest ${configData.mode === mode ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-[#020617] border-white/5 text-slate-500 hover:bg-white/5'}`}>
                           {mode.replace('-', ' ')}
                         </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Assigned Instructor</p>
                    <div className="relative">
                      <select 
                        value={configData.teacherId} 
                        onChange={e => setConfigData({...configData, teacherId: e.target.value})} 
                        className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                      >
                        <option value="" disabled>Select an instructor...</option>
                        {educators.length === 0 && <option value="" disabled>Loading educators...</option>}
                        {educators.map(ed => (
                           <option key={ed.id} value={ed.id}>{ed.display_name} {ed.email ? `(${ed.email})` : ''}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Hide individual save buttons if in bulk mode */}
                  {!isBulkMode && (
                    <div className="flex items-center gap-3 pt-4">
                      <button onClick={() => setIsEditingConfig(false)} className="px-6 py-4 rounded-2xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancel</button>
                      <button onClick={handleSaveConfig} disabled={isSavingConfig} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50">
                        {isSavingConfig ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Save Config
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 relative z-10">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">License Tier</p>
                       {student.metadata?.account_tier === 'full' ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-xl text-xs font-black uppercase italic inline-block">Term License</div>
                       ) : (
                          <div className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-2 rounded-xl text-xs font-black uppercase italic inline-block">Trial Access</div>
                       )}
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Learning Mode</p>
                       <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-2 rounded-xl text-xs font-black uppercase italic inline-block">
                         {student.metadata?.learning_mode?.replace('-', ' ') || 'In Person'}
                       </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Assigned Teacher</p>
                     {student.metadata?.teacher ? (
                       <div>
                         <p className="text-xl font-black italic text-white tracking-tighter">{student.metadata.teacher.name}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">RAD Academy Teacher</p>
                       </div>
                     ) : (
                       <p className="text-sm font-bold text-slate-500 italic">No instructor assigned.</p>
                     )}
                  </div>

                  {dynamicNextLesson && (
                    <div className="mt-6 pt-6 border-t border-white/5 bg-[#020617] -mx-8 -mb-8 px-8 py-6">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><Calendar size={12}/> Next Active Session</p>
                       <div className="flex items-center gap-4">
                           <div className="bg-blue-500/10 p-3 rounded-xl text-blue-400 shrink-0">
                             <Clock size={20} />
                           </div>
                           <div>
                              <p className="text-lg font-black text-white italic tracking-tighter leading-tight">
                                {new Date(dynamicNextLesson.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-xs font-bold text-slate-400 mt-1">
                                {new Date(dynamicNextLesson.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                           </div>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ACADEMIC RECORD WIDGET */}
            <div className="bg-[#0f172a] rounded-[40px] border border-white/5 p-8 shadow-2xl relative overflow-hidden">
              <BookOpen className="absolute -right-10 -bottom-10 w-48 h-48 text-white/5 pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-xl font-black uppercase italic tracking-widest mb-6 flex items-center gap-2">
                  <Award className={`text-${accentColor}-500`}/> Academic Record
                </h2>
                
                <div className="space-y-4">
                  {enrollments.length === 0 ? (
                     <div className="p-6 text-center border border-dashed border-white/10 rounded-3xl text-slate-500 text-sm font-bold italic">
                       No active course enrollments found.
                     </div>
                  ) : (
                    enrollments.map(enr => {
                      const course = Array.isArray(enr.courses) ? enr.courses[0] : enr.courses;
                      if (!course) return null;
                      const progress = student.metadata?.progress || 0; 
                      
                      return (
                        <div key={enr.course_id} className={`bg-[#020617] border border-white/5 p-6 rounded-[24px] hover:border-${accentColor}-500/30 transition-colors group`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${enr.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                {enr.status}
                              </span>
                              <h3 className={`text-lg font-black text-white mt-3 leading-tight group-hover:text-${accentColor}-400 transition-colors`}>{course.title}</h3>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mt-6">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span>Course Progress</span>
                              <span className="text-white">{progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${role === 'admin' ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : 'bg-gradient-to-r from-purple-600 to-blue-500'}`} style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="xl:col-span-7 space-y-6">
            <div className="bg-[#0f172a] rounded-[40px] border border-white/5 shadow-2xl overflow-hidden flex flex-col h-[800px]">
              
              <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#020617]/50 shrink-0">
                 <div>
                   <h2 className="text-xl font-black uppercase italic tracking-widest flex items-center gap-2">
                     <Calendar className="text-blue-500"/> Itinerary Manager
                   </h2>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Past & Upcoming Sessions</p>
                 </div>
                 <AnimatePresence>
                   {selectedLessonIds.length > 1 && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-blue-600/10 p-3 rounded-2xl border border-blue-500/30">
                       <div className="relative flex-1 sm:min-w-[250px]"><LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={14} /><input type="text" placeholder="Batch Link/Venue..." value={bulkInput} onChange={e => setBulkInput(e.target.value)} className="w-full bg-[#020617] border border-blue-500/30 rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold text-white outline-none focus:border-blue-400" /></div>
                       <div className="flex gap-2"><button onClick={executeBulkUpdateLogistics} disabled={isUpdating === true || !bulkInput.trim()} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">{isUpdating === true ? <Loader2 size={12} className="animate-spin"/> : 'Update'}</button><button onClick={async () => { if(!window.confirm(`Delete ${selectedLessonIds.length} lessons?`)) return; const newSchedule = schedule.filter(l => !selectedLessonIds.includes(l.id)); await supabase.from('profiles').update({ metadata: { ...student.metadata, schedule: newSchedule } }).eq('id', student.id); setSchedule(newSchedule); setSelectedLessonIds([]); }} className="p-2 bg-rose-500/20 text-rose-500 rounded-xl"><Trash2 size={14} /></button></div>
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                
                <div className="space-y-4">
                   <div className="flex items-center justify-between border-b border-white/10 pb-2"><h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Upcoming ({upcomingLessons.length})</h3><button onClick={handleSelectAll} className="text-[9px] font-black uppercase tracking-widest text-blue-400">{selectedLessonIds.length === upcomingLessons.length ? 'None' : 'All'}</button></div>
                   {upcomingLessons.map(lesson => {
                       const isSelected = selectedLessonIds.includes(lesson.id);
                       const isEditingRow = isUpdating === lesson.id;
                       const isOnline = lesson.delivery?.toLowerCase() === 'online';

                       return (
                         <div key={lesson.id} className={`rounded-3xl border transition-all overflow-hidden ${isSelected ? 'border-blue-500/50' : 'border-white/5'}`}>
                            <div onClick={() => toggleSelection(lesson.id)} className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group ${isSelected ? 'bg-blue-600/5' : 'bg-[#020617] hover:bg-white/[0.02]'}`}>
                              <div className="flex items-start gap-4"><button className={`mt-1 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-700'}`}>{isSelected ? <CheckSquare size={18}/> : <Square size={18} />}</button><div><p className="text-sm font-bold text-white">{lesson.topic}</p><p className="text-[10px] font-black text-blue-400 mt-1 uppercase tracking-widest">{new Date(lesson.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div></div>
                              <div className="flex items-center gap-3">{isOnline ? <div className="text-[10px] font-black text-blue-400 flex items-center gap-1"><Video size={12}/> Link</div> : <div className="text-[10px] font-black text-emerald-400 flex items-center gap-1"><MapPin size={12}/> {lesson.location || 'Venue'}</div>}<button onClick={(e) => { e.stopPropagation(); setIsUpdating(lesson.id); }} className="p-2 opacity-0 group-hover:opacity-100"><Edit2 size={12}/></button></div>
                            </div>
                            <AnimatePresence>
                              {isEditingRow && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-white/5 border-t border-white/10 p-6 space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500">Date</label><input type="datetime-local" id={`date-${lesson.id}`} defaultValue={new Date(new Date(lesson.date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)} className="w-full bg-[#020617] border border-white/10 rounded-xl p-2 text-xs text-white outline-none" /></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500">Logistics</label><input type="text" id={`log-${lesson.id}`} defaultValue={lesson.link || lesson.location || ""} className="w-full bg-[#020617] border border-white/10 rounded-xl p-2 text-xs text-white outline-none" /></div>
                                  </div>
                                  <div className="flex justify-between pt-2">
                                    <button onClick={async () => { if(!window.confirm("Delete?")) return; const newS = schedule.filter(l => l.id !== lesson.id); await supabase.from('profiles').update({ metadata: { ...student.metadata, schedule: newS } }).eq('id', student.id); setSchedule(newS); setIsUpdating(false); }} className="text-rose-400 text-[10px] font-black uppercase flex items-center gap-1"><Trash2 size={12}/> Delete Lesson</button>
                                    <div className="flex gap-2"><button onClick={() => setIsUpdating(false)} className="text-slate-500 text-[10px] uppercase font-black px-4">Cancel</button><button onClick={async () => {
                                      const d = (document.getElementById(`date-${lesson.id}`) as HTMLInputElement).value;
                                      const l = (document.getElementById(`log-${lesson.id}`) as HTMLInputElement).value;
                                      const isLnk = l.startsWith('http') || l.includes('zoom.us') || l.includes('meet.google');
                                      const newS = schedule.map(ls => ls.id === lesson.id ? { ...ls, date: new Date(d).toISOString(), delivery: isLnk ? 'online' : 'in-person', link: isLnk ? l : null, location: !isLnk ? l : null } : ls);
                                      await supabase.from('profiles').update({ metadata: { ...student.metadata, schedule: newS } }).eq('id', student.id);
                                      setSchedule(newS); setIsUpdating(false);
                                    }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Save Changes</button></div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                         </div>
                       )
                   })}
                </div>
                {pastLessons.length > 0 && (<div className="space-y-4 pt-4"><div className="border-b border-white/10 pb-2"><h3 className="text-xs font-black uppercase text-slate-500">Past ({pastLessons.length})</h3></div><div className="opacity-60 space-y-3">{pastLessons.map(lesson => (<div key={lesson.id} className="p-5 rounded-3xl bg-[#020617] border border-white/5 flex justify-between"><div><p className="text-sm font-bold text-slate-400">{lesson.topic}</p><p className="text-[10px] font-bold text-slate-600 mt-1">{new Date(lesson.date).toLocaleDateString()}</p></div><div className="text-[10px] font-black text-emerald-500/50 flex items-center gap-1.5"><CheckCircle2 size={14}/> Done</div></div>))}</div></div>)}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================
          STICKY BOTTOM SAVE BAR (BULK MODE)
          ========================================= */}
      {isBulkMode && (
        <div className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
           <div className="max-w-[1400px] mx-auto flex justify-end">
              <div className="bg-blue-600/90 backdrop-blur-xl p-4 rounded-3xl flex items-center gap-4 shadow-[0_0_40px_rgba(37,99,235,0.5)] border border-blue-400 pointer-events-auto">
                 <div className="hidden md:block mr-4 text-right">
                    <h3 className="font-black uppercase italic tracking-widest text-sm text-white">Queue Progress</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">{queue.indexOf(studentId) + 1} of {queue.length} Completed</p>
                 </div>
                 <button onClick={() => router.push('/admin/pioneers')} className="px-6 py-3 rounded-xl bg-black/20 hover:bg-black/30 text-white font-black uppercase tracking-widest text-[10px] transition-colors">Abort</button>
                 <button onClick={handleBulkSaveAndNext} disabled={isSavingGlobal} className="px-8 py-3 rounded-xl bg-white text-blue-600 hover:scale-105 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-lg">
                    {isSavingGlobal ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save & Next Student
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}