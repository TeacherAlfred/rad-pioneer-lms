"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, Zap, Flame, Calendar, Shield, TrendingUp, Link,
  ChevronRight, Loader2, AlertCircle, CheckCircle2, AlertTriangle, 
  Trophy, Clock, Plus, Copy, BarChart3, FolderGit2, Star,
  HeartHandshake, CreditCard, CalendarCheck, MessageSquare, 
  Download, Send, User, FileText, Sparkles, Share2, Award, 
  CalendarX2, RefreshCw, X, Lock, XCircle, Landmark, CalendarPlus, ArrowRight
} from 'lucide-react';

export default function ParentDashboard({ parentId }: { parentId: string }) {
  // --- Core Data State ---
  const [parentData, setParentData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // --- UI Navigation State ---
  const [activeGlobalTab, setActiveGlobalTab] = useState<'overview' | 'finance'>('overview');
  const [activeChildTab, setActiveChildTab] = useState<'overview' | 'portfolio' | 'feedback' | 'security'>('overview'); 
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  
  // --- Modals & Popups ---
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCoachBio, setShowCoachBio] = useState<any>(null);
  
  // --- Booking Engine State ---
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingMode, setBookingMode] = useState<'new' | 'reschedule'>('new');
  const [targetLesson, setTargetLesson] = useState<any>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  
  // --- Action States ---
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPinDisplay, setNewPinDisplay] = useState<any>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<string | null>(null); 
  const [copied, setCopied] = useState(false);
  const [bankCopied, setBankCopied] = useState(false);
  
  const [parentPassword, setParentPassword] = useState("");
  const [isUpdatingParentPassword, setIsUpdatingParentPassword] = useState(false);
  const [parentPasswordSuccess, setParentPasswordSuccess] = useState(false);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  // --- Chat States ---
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [lessonActions, setLessonActions] = useState<Record<string, 'apology' | 'reschedule'>>({});

  // 1. Initial Dashboard Load
  useEffect(() => {
    fetchDashboardData();
  }, [parentId]);

  async function fetchDashboardData() {
    try {
      const [parentRes, studentsRes, billingRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', parentId).single(),
        supabase.from('profiles').select('*').eq('role', 'student').eq('linked_parent_id', parentId),
        supabase.from('billing_records').select('*').eq('guardian_id', parentId).order('created_at', { ascending: false })
      ]);

      if (parentRes.error) throw parentRes.error;
      if (studentsRes.error) throw studentsRes.error;
      
      setParentData(parentRes.data);
      
      if (billingRes.error) {
        console.warn("Notice: Could not load billing records. Check RLS policies.", billingRes.error);
        setInvoices([]);
      } else {
        setInvoices(billingRes.data || []);
      }
      
      const parsedKids = (studentsRes.data || []).map(kid => {
        const meta = typeof kid.metadata === 'string' ? JSON.parse(kid.metadata) : (kid.metadata || {});
        
        const lessonsAttended = meta.lessons_attended || 0;
        const missedClasses = meta.missed_classes || 0;
        const lessonsScheduled = meta.lessons_scheduled || (lessonsAttended + missedClasses);

        return {
          ...kid,
          meta,
          attendanceRate: meta.attendance_rate || 100,
          missedClasses: missedClasses,
          lessonsAttended: lessonsAttended,
          lessonsScheduled: lessonsScheduled,
        };
      });

      setStudents(parsedKids);
      
      // NEW LOGIC: Only auto-select if there is exactly ONE student.
      if (parsedKids.length === 1 && !selectedChildId) {
        setSelectedChildId(parsedKids[0].id);
        fetchPortfolio(parsedKids[0].id);
      } else if (selectedChildId) {
        // Re-fetch portfolio if data updates and a child is already selected
        fetchPortfolio(selectedChildId);
      }
    } catch (err: any) {
      console.error("Dashboard Fetch Error:", err);
      setError("Failed to establish secure link.");
    } finally {
      setLoading(false);
    }
  }

  // 2. Fetch Portfolio
  const fetchPortfolio = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('tech_archive')
        .select('id, created_at, snapshot_url, missions(title, metadata)')
        .eq('student_id', studentId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (!error && data) setPortfolios(data);
    } catch (err) {
      console.error("Portfolio fetch error", err);
    }
  };

  useEffect(() => {
    if (selectedChildId && activeChildTab === 'portfolio') {
      fetchPortfolio(selectedChildId);
    }
  }, [selectedChildId, activeChildTab]);

  // 3. Real-Time Chat Engine
  useEffect(() => {
    if (!selectedChildId || activeChildTab !== 'feedback') return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('student_id', selectedChildId)
        .order('created_at', { ascending: true });
      if (!error && data) setChatMessages(data);
    };
    
    loadMessages();

    const channel = supabase.channel(`chat_${selectedChildId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'coach_messages', 
        filter: `student_id=eq.${selectedChildId}` 
      }, (payload) => {
        setChatMessages(prev => {
          if (prev.some(msg => msg.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChildId, activeChildTab]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChildTab]);

  const selectedChild = students.find(s => s.id === selectedChildId);
  const bookingCredits = parentData?.metadata?.booking_credits || 0;

  // --- Dynamic Schedule Parser ---
  const { upcomingLessons, pastLessons, nextLesson } = useMemo(() => {
    if (!selectedChild?.meta?.schedule) return { upcomingLessons: [], pastLessons: [], nextLesson: null };
    
    const now = new Date().getTime();
    const threshold = now - (2 * 60 * 60 * 1000); 

    const sorted = (selectedChild.meta.schedule as any[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const past = sorted.filter(l => new Date(l.date).getTime() <= threshold).reverse(); 
    const future = sorted.filter(l => new Date(l.date).getTime() > threshold);
      
    return { upcomingLessons: future, pastLessons: past, nextLesson: future.length > 0 ? future[0] : null };
  }, [selectedChild]);

  // --- Booking Engine Core Rules ---
  const isSlotBookable = (startTimeStr: string) => {
    const slotDate = new Date(startTimeStr);
    const cutoff = new Date(slotDate);
    cutoff.setDate(cutoff.getDate() - 2);
    cutoff.setHours(8, 0, 0, 0); // 8 AM local time, 2 days prior
    return new Date() < cutoff;
  };

  const isSlotLockedForReschedule = (startTimeStr: string) => {
    const slotTime = new Date(startTimeStr).getTime();
    const now = new Date().getTime();
    return (slotTime - now) < (2 * 60 * 60 * 1000); // Strictly locked if within 2 hours
  };

  const handleOpenBookingEngine = async (mode: 'new' | 'reschedule', lessonData: any = null) => {
    if (mode === 'reschedule') {
      if (isSlotLockedForReschedule(lessonData.date)) {
        return showToast("Locked: Lessons within 2 hours cannot be rescheduled.", "error");
      }
      setTargetLesson(lessonData);
    } else {
      setTargetLesson(null);
    }
    
    setBookingMode(mode);
    setIsFetchingSlots(true);
    setShowBookingModal(true);

    try {
      const { data, error } = await supabase
        .from('teacher_availability')
        .select('*, profiles:teacher_id(display_name)')
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });
        
      if (error) throw error;
      
      // Filter out slots that violate the 48hr/8AM rule
      const validSlots = (data || []).filter(slot => isSlotBookable(slot.start_time));
      setAvailableSlots(validSlots);
    } catch (err) {
      showToast("Failed to fetch available time slots.", "error");
      setShowBookingModal(false);
    } finally {
      setIsFetchingSlots(false);
    }
  };

  // --- Actions ---
  const handleResetPin = async (studentId: string) => {
    setResettingId(studentId);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch('/api/students/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, studentId })
      });
      const data = await response.json();
      if (response.ok) {
        setNewPinDisplay({ id: studentId, name: data.studentIdentifier, pin: data.newPin });
        setShowResetConfirm(null);
        showToast("PIN Reset Successful", "success");
      } else {
        showToast(data.error || "Failed to reset PIN.", "error");
      }
    } catch (err) {
      showToast("An error occurred while resetting the PIN.", "error");
    } finally {
      setResettingId(null);
    }
  };

  const handleUpdateParentPassword = async () => {
    if (!parentPassword || parentPassword.length < 6) {
      return showToast("Password must be at least 6 characters.", "error");
    }
    setIsUpdatingParentPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parentPassword });
      if (error) throw error;
      setParentPasswordSuccess(true);
      setParentPassword("");
      showToast("Password updated securely.", "success");
      setTimeout(() => setParentPasswordSuccess(false), 4000);
    } catch (err: any) {
      showToast(err.message || "Failed to update password.", "error");
    } finally {
      setIsUpdatingParentPassword(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const copyBankDetails = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setBankCopied(true);
      setTimeout(() => setBankCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy bank details', err);
    }
  };

  const getLastActiveText = (dateString: string) => {
    if (!dateString) return "Awaiting First Login";
    const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24));
    if (days === 0) return "Active Today";
    if (days === 1) return "Active Yesterday";
    return `Active ${days} days ago`;
  };

  const handleLessonAction = async (lessonId: string, action: 'apology' | 'reschedule') => {
    if (action === 'reschedule') {
      const target = upcomingLessons.find(l => l.id === lessonId);
      if (target) handleOpenBookingEngine('reschedule', target);
    } else {
      setLessonActions(prev => ({ ...prev, [lessonId]: action }));
      showToast("Apology logged. This does not refund your credit.", "success");
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChild) return;
    
    const coachId = selectedChild.meta?.teacher?.id || '00000000-0000-0000-0000-000000000000';
    const text = message.trim();
    
    setMessage(""); 
    setIsSendingMessage(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      student_id: selectedChild.id,
      guardian_id: parentId,
      coach_id: coachId,
      sender_id: parentId,
      message: text,
      created_at: new Date().toISOString(),
      is_read: true 
    };
    
    setChatMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase.from('coach_messages').insert([{
        student_id: selectedChild.id,
        guardian_id: parentId,
        coach_id: coachId,
        sender_id: parentId,
        message: text
      }]).select().single();

      if (error) throw error;
      setChatMessages(prev => prev.map(msg => msg.id === tempId ? data : msg));

      fetch('/api/messages/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedChild.id,
          guardian_id: parentId,
          coach_id: coachId,
          sender_id: parentId,
          message: text
        })
      }).catch(console.error);

    } catch (err) {
      setChatMessages(prev => prev.filter(msg => msg.id !== tempId));
      showToast("Failed to send message.", "error");
      setMessage(text); 
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!selectedChildId || !parentId) return;
    window.dispatchEvent(new Event('messagesRead'));
    
    try {
      await supabase.from('coach_messages')
        .update({ is_read: true })
        .eq('student_id', selectedChildId)
        .neq('sender_id', parentId)
        .eq('is_read', false);
    } catch (err) {
      console.error(err);
    }
  };

  const totalXP = students.reduce((acc, kid) => acc + (kid.xp || 0), 0);
  const isDemo = parentData?.payment_plan_preference === 'demo';

  const outstandingBalance = invoices.reduce((acc, inv) => {
    if (inv.status === 'paid') return acc;
    const total = parseFloat(inv.total_amount || 0);
    const paid = parseFloat(inv.amount_paid || 0);
    return acc + (total - paid);
  }, 0);

  const getHouseholdTier = (xp: number) => {
    if (xp < 5000) return { title: "New", color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (xp < 10000) return { title: "Intermediate", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" };
    if (xp < 25000) return { title: "Advanced", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" };
    return { title: "Expert", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
  };
  const householdTier = getHouseholdTier(totalXP);

  const renderAttendanceBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'attended':
        return <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded flex items-center gap-1.5"><CheckCircle2 size={12}/> Attended</div>;
      case 'missed':
        return <div className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded flex items-center gap-1.5"><XCircle size={12}/> Missed</div>;
      case 'apology':
        return <div className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded flex items-center gap-1.5"><CalendarX2 size={12}/> Apology</div>;
      case 'rescheduled':
        return <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded flex items-center gap-1.5"><RefreshCw size={12}/> Rescheduled</div>;
      default:
        return <div className="text-[10px] font-black text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded flex items-center gap-1.5"><CheckCircle2 size={12}/> Recorded</div>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 relative">
      
      {/* PREMIUM TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
              toast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.2)]'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <p className="text-xs md:text-sm font-black uppercase tracking-widest">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. GLOBAL HOUSEHOLD HEADER */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0f172a] border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 transition-transform duration-1000 group-hover:translate-x-1/4 group-hover:-translate-y-1/3 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDemo ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]'}`}>
                {isDemo ? 'Trial Access' : 'Active Account'}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                <Shield size={12} /> Secure Portal
              </span>
              {students.length > 0 && (
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${householdTier.bg} ${householdTier.color} ${householdTier.border}`}>
                  <Star size={12} /> {householdTier.title}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Welcome, {parentData?.display_name?.split(' ')[0] || 'Guardian'}
            </h1>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              Empowering your household to redefine African dreams. Manage accounts, track progress, and secure access from your central command.
            </p>
          </div>

          {students.length > 0 && (
            <div className="flex gap-4">
              <div className="bg-[#020617]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-5 min-w-[130px] shadow-xl">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Zap size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Family XP</span>
                </div>
                <div className="text-3xl font-black text-white">{totalXP.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ACTION BANNER: BOOKING ENGINE */}
      <AnimatePresence>
        {bookingCredits > 0 && activeGlobalTab === 'overview' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} 
            className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/40 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_30px_rgba(37,99,235,0.15)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <CalendarPlus size={120} />
            </div>
            <div className="relative z-10 flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg font-black text-xl shrink-0">
                {bookingCredits}
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic text-white tracking-tight">Action Required</h3>
                <p className="text-sm text-blue-200 font-medium">You have {bookingCredits} unbooked lesson {bookingCredits === 1 ? 'credit' : 'credits'}. Click below to secure a timeslot.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                if (!selectedChildId) {
                  showToast("Please select a student below to schedule their lesson.", "error");
                  return;
                }
                handleOpenBookingEngine('new');
              }}
              className="w-full md:w-auto relative z-10 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
            >
              <CalendarPlus size={16} /> Schedule Lesson
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. GLOBAL NAVIGATION TABS */}
      {students.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 border-b border-white/5">
          {[
            { id: 'overview', icon: TrendingUp, label: 'Household Overview' },
            { id: 'finance', icon: CreditCard, label: 'Billing & Finances' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveGlobalTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeGlobalTab === tab.id 
                  ? 'bg-white/10 text-white border-b-2 border-blue-500' 
                  : 'text-slate-400 border-b-2 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* TAB CONTENT: HOUSEHOLD OVERVIEW */}
      {activeGlobalTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {students.length === 0 ? (
            <div className="border-2 border-dashed border-white/10 rounded-[32px] p-16 text-center space-y-5 bg-white/[0.02]">
              <div className="w-24 h-24 bg-[#0f172a] rounded-full flex items-center justify-center mx-auto shadow-2xl border border-white/5 relative">
                <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full animate-ping" />
                <Plus size={36} className="text-blue-500" />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">No Students Found</h3>
              <p className="text-slate-400 max-w-sm mx-auto text-sm leading-relaxed">You haven't added any students to your secure household yet.</p>
            </div>
          ) : (
            <>
              {/* STUDENT SELECTOR */}
              {students.length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedChildId(s.id)}
                      className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all whitespace-nowrap ${
                        selectedChildId === s.id 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black">
                        {s.display_name.charAt(0)}
                      </div>
                      <span className="font-bold text-sm">{s.display_name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* SPECIFIC CHILD DASHBOARD OR EMPTY STATE */}
              {selectedChild ? (
                <div key={selectedChild.id} className="space-y-6 bg-white/[0.02] border border-white/5 rounded-[40px] p-6 md:p-8">
                  
                  {/* Child Banner */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[#0f172a] border border-white/10 rounded-[32px] p-6 shadow-xl">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-2xl font-black text-white shadow-inner">
                        {selectedChild.display_name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">
                          {selectedChild.display_name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold text-slate-300 bg-[#020617] px-2 py-1 rounded-md border border-white/10 truncate">
                            @{selectedChild.student_identifier}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-[#020617] px-2 py-1 rounded-md border border-white/10">
                            <Flame size={12} className="text-orange-500" /> {selectedChild.current_streak || 0} Wk Streak
                          </span>
                        </div>
                      </div>
                    </div>

                    <button 
                      disabled={true}
                      className="w-full md:w-auto px-6 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-[10px] md:text-xs shadow-xl bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                      title="Unlocks on 25 April (Week 3)"
                    >
                      <Lock size={18} />
                      Unlocks 25 April
                    </button>
                  </div>

                  {/* CHILD-SPECIFIC TABS */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {[
                      { id: 'overview', icon: Calendar, label: 'Logistics' },
                      { id: 'portfolio', icon: Trophy, label: 'Brags & Portfolio' },
                      { id: 'feedback', icon: MessageSquare, label: 'Coach Feedback' },
                      { id: 'security', icon: Shield, label: 'Security' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveChildTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                          activeChildTab === tab.id 
                            ? 'bg-white text-black shadow-lg' 
                            : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <tab.icon size={14} /> {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* CHILD TAB: LOGISTICS & ATTENDANCE */}
                  {activeChildTab === 'overview' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left Col: Attendance */}
                      <div className="lg:col-span-5 bg-[#0f172a] border border-white/10 rounded-[32px] p-8 flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-8">
                          <div>
                            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-3">
                              <CalendarCheck size={20} />
                            </div>
                            <h3 className="text-lg font-black uppercase italic tracking-tight text-white">Attendance</h3>
                          </div>
                          <span className="text-4xl font-black text-emerald-400 tracking-tighter">{selectedChild.attendanceRate}%</span>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${selectedChild.attendanceRate}%` }} />
                          </div>
                          
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-right mt-1">
                            {selectedChild.missedClasses > 0 
                              ? `${selectedChild.missedClasses} Classes Missed` 
                              : 'Perfect Attendance!'} 
                            <span className="text-white ml-1">
                              ({selectedChild.lessonsAttended}/{selectedChild.lessonsScheduled})
                            </span>
                          </p>

                        </div>
                      </div>

                      {/* Right Col: Next Session & Actions */}
                      <div className="lg:col-span-7 bg-[#0f172a] border border-white/10 rounded-[32px] p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center">
                              <Clock size={20} />
                            </div>
                            <h3 className="text-lg font-black uppercase italic tracking-tight text-white">Next Session</h3>
                          </div>
                          <button 
                            onClick={() => setShowScheduleModal(true)}
                            className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 transition-colors px-3 py-1.5 rounded-lg border border-blue-500/20"
                          >
                            View Full Schedule
                          </button>
                        </div>

                        {nextLesson ? (
                          <div className="space-y-6">
                            <div className="bg-[#020617] border border-white/5 rounded-2xl p-5 shadow-inner">
                              <div className="flex justify-between items-start mb-2">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                  {new Date(nextLesson.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                  {nextLesson.type === 'online' ? <Shield size={10} /> : <User size={10} />}
                                  {nextLesson.type || nextLesson.delivery || 'Standard'}
                                </span>
                              </div>
                              <p className="text-3xl font-black text-white tracking-tighter">
                                {new Date(nextLesson.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className="text-xs text-slate-500 mt-2 font-bold">{nextLesson.topic}</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button 
                                onClick={() => handleLessonAction(nextLesson.id, 'apology')}
                                disabled={lessonActions[nextLesson.id] === 'apology' || nextLesson.attendance_status === 'apology'}
                                className={`flex-1 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all border ${
                                  (lessonActions[nextLesson.id] === 'apology' || nextLesson.attendance_status === 'apology') 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                    : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {(lessonActions[nextLesson.id] === 'apology' || nextLesson.attendance_status === 'apology') ? <CheckCircle2 size={14}/> : <CalendarX2 size={14}/>}
                                {(lessonActions[nextLesson.id] === 'apology' || nextLesson.attendance_status === 'apology') ? 'Apology Logged' : 'Log Absence'}
                              </button>
                              
                              <button 
                                onClick={() => handleLessonAction(nextLesson.id, 'reschedule')}
                                disabled={lessonActions[nextLesson.id] === 'reschedule' || nextLesson.attendance_status === 'rescheduled' || isSlotLockedForReschedule(nextLesson.date)}
                                className={`flex-1 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all border ${
                                  (lessonActions[nextLesson.id] === 'reschedule' || nextLesson.attendance_status === 'rescheduled') 
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                                    : isSlotLockedForReschedule(nextLesson.date)
                                    ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                                    : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
                                }`}
                                title={isSlotLockedForReschedule(nextLesson.date) ? "Locked (< 2 hours)" : "Request Reschedule"}
                              >
                                {(lessonActions[nextLesson.id] === 'reschedule' || nextLesson.attendance_status === 'rescheduled') 
                                  ? <><CheckCircle2 size={14}/> Rescheduled</> 
                                  : isSlotLockedForReschedule(nextLesson.date)
                                  ? <><Lock size={14}/> Locked (&lt;2h)</>
                                  : <><RefreshCw size={14}/> Request Reschedule</>}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center bg-[#020617] rounded-2xl border border-white/5">
                            <p className="text-sm font-bold text-slate-400 italic">No upcoming sessions scheduled.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* CHILD TAB: PORTFOLIO & BRAGS */}
                  {activeChildTab === 'portfolio' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                        <p className="text-sm text-slate-400 font-medium">Completed projects & mastered skills. <span className="text-white font-bold">Share them with family!</span></p>
                      </div>
                      
                      {portfolios.length === 0 ? (
                        <div className="p-12 text-center bg-[#0f172a] rounded-[32px] border border-white/10">
                          <FolderGit2 className="mx-auto size-12 text-slate-600 mb-4" />
                          <h3 className="text-lg font-black text-white italic">Awaiting First Upload</h3>
                          <p className="text-sm text-slate-500 mt-2">When {selectedChild.display_name.split(' ')[0]} completes and captures their first approved project, it will appear here!</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {portfolios.map(item => {
                            const title = item.missions?.title || "Engineering Mission";
                            const rawSkills = item.missions?.metadata?.skills || item.missions?.skills;
                            const skills = Array.isArray(rawSkills) ? rawSkills : ["Problem Solving", "Logic"];

                            return (
                              <div key={item.id} className="bg-[#0f172a] border border-white/10 rounded-[32px] p-6 shadow-xl hover:border-blue-500/30 transition-colors group flex flex-col">
                                
                                <div className="w-full aspect-video bg-[#020617] rounded-2xl border border-white/5 mb-6 overflow-hidden relative group-hover:border-blue-500/30 transition-colors">
                                  {item.snapshot_url ? (
                                    <img src={item.snapshot_url} alt={title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-700 font-black italic uppercase tracking-widest text-xs">
                                      Project File Missing
                                    </div>
                                  )}
                                  <div className="absolute top-3 right-3">
                                    <button 
                                      onClick={() => copyToClipboard(`Look what ${selectedChild.display_name.split(' ')[0]} built at RAD Academy: ${title}! 🚀`)}
                                      className="p-2.5 bg-black/60 backdrop-blur-md hover:bg-blue-600 hover:text-white rounded-xl text-slate-300 transition-all shadow-lg border border-white/10"
                                      title="Share Achievement"
                                    >
                                      {copied ? <CheckCircle2 size={16}/> : <Share2 size={16}/>}
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="flex-1">
                                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-1 line-clamp-1">{title}</h3>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-5">Approved: {new Date(item.created_at).toLocaleDateString()}</p>
                                  
                                  <div className="space-y-2 mt-auto">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Acquired Skills:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {skills.slice(0, 3).map((skill: string) => (
                                        <span key={skill} className="px-2.5 py-1 bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300 rounded-lg">
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* CHILD TAB: COACH FEEDBACK & COMMS */}
                  {activeChildTab === 'feedback' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group mb-6">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 relative z-10">Assigned Coach</h3>
                          {selectedChild.meta?.teacher ? (
                            <div className="text-center relative z-10">
                              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/50 flex items-center justify-center font-black text-xl text-purple-400 mx-auto mb-4 overflow-hidden shadow-xl">
                                {selectedChild.meta.teacher.avatar_url ? (
                                  <img src={selectedChild.meta.teacher.avatar_url} alt={selectedChild.meta.teacher.name} className="w-full h-full object-cover" />
                                ) : (
                                  selectedChild.meta.teacher.name.charAt(0)
                                )}
                              </div>
                              <h4 className="text-lg font-bold text-white mb-1">{selectedChild.meta.teacher.name}</h4>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Lead Robotics Coach</p>
                              
                              <button onClick={() => setShowCoachBio(selectedChild.meta.teacher)} className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 transition-colors hover:bg-purple-500/20 px-4 py-2 rounded-xl border border-purple-500/20">
                                View Bio
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 italic text-center py-6">No coach assigned yet.</p>
                          )}
                        </div>

                        <div className="bg-gradient-to-br from-blue-900/40 to-[#0f172a] border border-blue-500/20 rounded-[32px] p-8 shadow-inner">
                          <div className="flex items-center gap-3 mb-6">
                            <Award className="text-blue-400" size={20}/>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Latest Evaluation</h3>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-1"><span className="text-slate-300">Logic & Problem Solving</span><span className="text-emerald-400">Excellent</span></div>
                              <div className="h-1.5 w-full bg-black/40 rounded-full"><div className="h-full bg-emerald-500 rounded-full w-[90%]"/></div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-1"><span className="text-slate-300">Focus & Participation</span><span className="text-blue-400">Good</span></div>
                              <div className="h-1.5 w-full bg-black/40 rounded-full"><div className="h-full bg-blue-500 rounded-full w-[75%]"/></div>
                            </div>
                            <p className="text-xs text-slate-400 italic mt-4 pt-4 border-t border-white/10">
                              "{selectedChild.display_name.split(' ')[0]} is showing incredible aptitude for conditional logic this week. Very proud of their progress!"
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right Col: Direct Portal (LIVE CHAT) */}
                      <div className="lg:col-span-2 bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden flex flex-col h-[600px] shadow-2xl">
                        <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-3">
                            <Sparkles size={16} className="text-blue-400" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Direct Coach Portal</h3>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3">
                            <button 
                              onClick={handleMarkAsRead}
                              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/10 transition-colors"
                              title="Clear notifications"
                            >
                              <CheckCircle2 size={12}/> <span className="hidden sm:inline">Mark all messages as read</span>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex-1 p-6 overflow-y-auto bg-[#020617] flex flex-col gap-4 shadow-inner custom-scrollbar" ref={chatScrollRef}>
                          {chatMessages.length === 0 && (
                            <div className="text-center text-slate-500 py-10 italic text-sm">
                              Secure comms link established. You can now chat directly with {selectedChild.meta?.teacher?.name?.split(' ')[0] || 'the coach'}.
                            </div>
                          )}
                          
                          {chatMessages.map(msg => {
                            const isParent = msg.sender_id === parentId;
                            return (
                              <div key={msg.id} className={`flex ${isParent ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-4 ${isParent ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 border border-white/5 text-slate-300 rounded-tl-none'}`}>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                  <p className={`text-[9px] font-black uppercase mt-2 ${isParent ? 'text-blue-300' : 'text-slate-500'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="p-4 bg-white/[0.02] border-t border-white/5 shrink-0">
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Type a secure message..."
                              className="w-full bg-[#020617] border border-white/10 rounded-2xl py-4 pl-4 pr-14 text-sm font-medium text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600 shadow-inner"
                            />
                            <button 
                              onClick={handleSendMessage}
                              disabled={!message.trim() || isSendingMessage}
                              className="absolute right-2 p-3 bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:bg-slate-700 transition-all hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-md"
                            >
                              {isSendingMessage ? <Loader2 size={16} className="animate-spin"/> : <Send size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* CHILD TAB: SECURITY */}
                  {activeChildTab === 'security' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      <div className="bg-[#0f172a] border border-red-500/10 rounded-[32px] p-8 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Student Access</h3>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <Clock size={12} /> {getLastActiveText(selectedChild.last_active_date)}
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 mb-6">If the student account is compromised or locked out, generate a new secure PIN.</p>

                        <AnimatePresence mode="wait">
                          {newPinDisplay?.id === selectedChild.id ? (
                            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                                    <CheckCircle2 size={18} /> PIN Updated Securely
                                  </div>
                                </div>
                                <div className="relative group/copy">
                                  <div className="bg-[#020617] rounded-xl py-6 text-center text-5xl font-black text-green-400 tracking-[0.25em] shadow-inner font-mono border border-green-500/30">
                                    {newPinDisplay.pin}
                                  </div>
                                  <button onClick={() => copyToClipboard(newPinDisplay.pin)} className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/copy:opacity-100 transition-all rounded-xl border border-green-400/50 text-green-300 font-bold tracking-widest uppercase text-sm">
                                    {copied ? <span className="flex items-center gap-2"><CheckCircle2 size={18}/> Copied!</span> : <span className="flex items-center gap-2"><Copy size={18}/> Copy PIN</span>}
                                  </button>
                                </div>
                                <p className="text-[10px] text-green-500/70 mt-4 text-center uppercase tracking-widest font-bold">Secure this code. It will self-destruct from this view.</p>
                                <button onClick={() => setNewPinDisplay(null)} className="w-full mt-6 py-4 bg-green-500/20 text-green-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-500/30 transition-colors">
                                  Acknowledge & Close
                                </button>
                            </motion.div>
                          ) : showResetConfirm === selectedChild.id ? (
                            <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 shadow-inner">
                              <p className="text-sm font-bold text-red-400 mb-6 text-center leading-relaxed">Generate a new login PIN? The existing PIN will immediately be revoked.</p>
                              <div className="flex gap-4">
                                <button onClick={() => setShowResetConfirm(null)} className="flex-1 py-4 bg-white/5 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors">Abort</button>
                                <button onClick={() => handleResetPin(selectedChild.id)} disabled={resettingId === selectedChild.id} className="flex-1 py-4 bg-red-500/20 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                  {resettingId === selectedChild.id ? <Loader2 size={18} className="animate-spin" /> : "Confirm Reset"}
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.button key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowResetConfirm(selectedChild.id)} className="w-full flex items-center justify-between p-5 bg-[#020617] border border-white/10 rounded-2xl hover:border-red-500/30 transition-all duration-300 group/btn">
                              <div className="flex items-center gap-4 text-slate-300 group-hover/btn:text-white transition-colors">
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover/btn:bg-red-500/20 group-hover/btn:text-red-400 transition-all duration-300 group-hover/btn:scale-110 group-hover/btn:-rotate-3">
                                  <Key size={20} />
                                </div>
                                <span className="font-black tracking-wide text-sm md:text-base">Reset Access PIN</span>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover/btn:bg-white/10 transition-colors">
                                <ChevronRight size={20} className="text-slate-400 group-hover/btn:text-white transition-colors" />
                              </div>
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-xl flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Guardian Security</h3>
                          <Lock className="text-slate-500" size={20} />
                        </div>
                        <p className="text-sm text-slate-400 mb-8">Update the password used to access this central command portal.</p>
                        
                        <div className="space-y-4 mt-auto">
                          <input 
                            type="password"
                            value={parentPassword}
                            onChange={(e) => setParentPassword(e.target.value)}
                            placeholder="Enter new password (min 6 chars)"
                            className="w-full bg-[#020617] border border-white/10 rounded-2xl py-4 px-5 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                          />
                          <button 
                            onClick={handleUpdateParentPassword}
                            disabled={isUpdatingParentPassword || !parentPassword}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all ${
                              parentPasswordSuccess 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-white text-black hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white shadow-xl'
                            }`}
                          >
                            {isUpdatingParentPassword ? <Loader2 size={16} className="animate-spin" /> : parentPasswordSuccess ? <CheckCircle2 size={16}/> : <Key size={16}/>}
                            {parentPasswordSuccess ? "Password Updated" : "Update Password"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                students.length > 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-dashed border-white/10 rounded-[40px] p-12 md:p-16 text-center space-y-5 bg-white/[0.02] mt-6">
                    <div className="w-20 h-20 bg-[#0f172a] rounded-full flex items-center justify-center mx-auto shadow-2xl border border-white/5 relative">
                      <User size={32} className="text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Select a Pioneer</h3>
                    <p className="text-slate-400 max-w-sm mx-auto text-sm leading-relaxed">Choose a student from the menu above to access their schedule, log attendance, and manage bookings.</p>
                  </motion.div>
                )
              )}
            </>
          )}
        </motion.div>
      )}

      {/* ==========================================
          TAB CONTENT: GLOBAL FINANCE
          ========================================== */}
      {activeGlobalTab === 'finance' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-xl flex flex-col justify-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Household Outstanding Balance</p>
              <p className="text-5xl font-black text-white italic tracking-tighter mb-8">
                R {outstandingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                <a 
                  href={`/statement/${parentId}`}
                  target="_blank"
                  className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                >
                  <FileText size={16}/> View Full Statement
                </a>
                <button disabled className="flex-1 px-6 py-4 bg-slate-800 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 cursor-not-allowed border border-white/5" title="Under Development">
                  <Lock size={14}/> Settle Account (In Dev)
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900/20 to-[#0f172a] border border-blue-500/20 rounded-[32px] p-8 shadow-inner flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                <Landmark size={150} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-6 flex items-center gap-2 relative z-10">
                <Landmark size={18} /> Official Banking Details
              </h3>
              
              <div className="space-y-3 relative z-10">
                 <div className="flex justify-between items-center bg-[#020617] p-4 rounded-2xl border border-white/5 shadow-inner">
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Account Name</span>
                   <span className="text-xs font-black text-white">RAD Academy (Pty) Ltd</span>
                 </div>
                 <div className="flex justify-between items-center bg-[#020617] p-4 rounded-2xl border border-white/5 shadow-inner">
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bank</span>
                   <span className="text-xs font-black text-white">FNB</span>
                 </div>
                 <div className="flex justify-between items-center bg-[#020617] p-4 rounded-2xl border border-white/5 group shadow-inner">
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Account No.</span>
                   <div className="flex items-center gap-3">
                     <span className="text-sm font-black text-white tracking-widest">6289 636 1632</span>
                     <button 
                       onClick={() => copyBankDetails('62896361632')}
                       className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors shadow-md"
                       title="Copy Account Number"
                     >
                       {bankCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                     </button>
                   </div>
                 </div>
              </div>
              
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-5 text-center relative z-10 leading-relaxed">
                Please use your <span className="text-white">Invoice Number</span> or <span className="text-white">Name</span> as the payment reference.<br/>
                Email proof of payment to <a href="mailto:info@radacademy.co.za" className="text-blue-400 hover:text-blue-300">info@radacademy.co.za</a>
              </p>
            </div>

          </div>

          <div className="bg-[#0f172a] border border-white/5 rounded-[32px] overflow-hidden shadow-xl">
            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Billing History</h3>
            </div>
            <div className="divide-y divide-white/5">
              {invoices.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-bold italic">No billing history found.</div>
              ) : (
                invoices.map((inv) => {
                  const total = parseFloat(inv.total_amount || 0);
                  const statusColors = {
                    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    partially_paid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    pending: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  };
                  const colorClass = statusColors[inv.status as keyof typeof statusColors] || statusColors.pending;

                  const dueDate = inv.due_date 
                    ? new Date(inv.due_date) 
                    : new Date(new Date(inv.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);

                  return (
                    <div key={inv.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-[#020617] border border-white/10 flex items-center justify-center text-slate-400 shrink-0 shadow-inner">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="font-black text-white text-base">{inv.payment_reference || `INV-${inv.invoice_number}`}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Issued: {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            {inv.status !== 'paid' && (
                               <>
                                 <span className="text-slate-700 hidden sm:inline">•</span>
                                 <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                                   Due: {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                 </p>
                               </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="font-black text-white text-lg">R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 w-fit ml-auto mt-1 border ${colorClass}`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </div>
                        <button className="p-3 text-slate-400 hover:text-white bg-white/5 rounded-xl border border-white/5 transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5" title="Download PDF">
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ==========================================
          MODALS
          ========================================== */}
      <AnimatePresence>
        {/* Full Schedule Modal */}
        {showScheduleModal && selectedChild && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowScheduleModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Calendar className="text-blue-500" size={20} />
                  <h3 className="text-lg font-black uppercase italic tracking-widest text-white">Full Schedule</h3>
                </div>
                <button onClick={() => setShowScheduleModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-8">
                
                {/* UPCOMING LESSONS */}
                <div className="space-y-4">
                  <div className="border-b border-white/10 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Upcoming ({upcomingLessons.length})</h3>
                  </div>
                  {upcomingLessons.length === 0 ? (
                    <p className="text-center text-slate-500 font-bold italic py-4">No upcoming sessions.</p>
                  ) : (
                    upcomingLessons.map(lesson => {
                      const isLocked = lesson.attendance_status === 'apology' || lesson.attendance_status === 'rescheduled';
                      const localApology = lessonActions[lesson.id] === 'apology';
                      const localReschedule = lessonActions[lesson.id] === 'reschedule';
                      const timeLocked = isSlotLockedForReschedule(lesson.date);

                      return (
                        <div key={lesson.id} className="bg-[#020617] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                          <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                              {new Date(lesson.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @ {new Date(lesson.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-sm font-bold text-white">{lesson.topic}</p>
                          </div>
                          
                          <div className="flex gap-2 w-full sm:w-auto shrink-0">
                            {isLocked ? (
                              <div className={`flex-1 sm:flex-none px-4 py-2 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                                lesson.attendance_status === 'apology' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                              }`}>
                                <CheckCircle2 size={14}/> {lesson.attendance_status}
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleLessonAction(lesson.id, 'apology')}
                                  disabled={localApology}
                                  className={`flex-1 sm:flex-none p-2 rounded-xl border transition-all ${localApology ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'}`}
                                  title="Log Absence"
                                >
                                  {localApology ? <CheckCircle2 size={16}/> : <CalendarX2 size={16}/>}
                                </button>
                                <button 
                                  onClick={() => handleLessonAction(lesson.id, 'reschedule')}
                                  disabled={localReschedule || timeLocked}
                                  className={`flex-1 sm:flex-none p-2 rounded-xl border transition-all ${
                                    localReschedule 
                                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                                      : timeLocked
                                      ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
                                  }`}
                                  title={timeLocked ? "Locked (< 2 hours)" : "Request Reschedule"}
                                >
                                  {localReschedule ? <CheckCircle2 size={16}/> : timeLocked ? <Lock size={16}/> : <RefreshCw size={16}/>}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* PAST LESSONS */}
                {pastLessons.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="border-b border-white/10 pb-2">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Past Sessions ({pastLessons.length})</h3>
                    </div>
                    <div className="space-y-3 opacity-80">
                      {pastLessons.map(lesson => (
                        <div key={lesson.id} className="bg-[#020617] border border-white/5 rounded-2xl p-5 flex justify-between items-center gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 mb-1">
                              {new Date(lesson.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-sm font-bold text-slate-300">{lesson.topic}</p>
                          </div>
                          <div className="shrink-0">
                            {renderAttendanceBadge(lesson.attendance_status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}

        {/* Coach Bio Modal */}
        {showCoachBio && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCoachBio(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-[#0f172a] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden p-8 text-center">
              <button onClick={() => setShowCoachBio(null)} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
              
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-4 border-purple-500/30 flex items-center justify-center font-black text-4xl text-purple-400 mx-auto mb-6 overflow-hidden shadow-2xl">
                {showCoachBio.avatar_url ? (
                  <img src={showCoachBio.avatar_url} alt={showCoachBio.name} className="w-full h-full object-cover" />
                ) : (
                  showCoachBio.name.charAt(0)
                )}
              </div>
              
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">{showCoachBio.name}</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-6">Lead Robotics Coach</p>
              
              <p className="text-sm text-slate-300 leading-relaxed font-medium bg-[#020617] p-6 rounded-3xl border border-white/5 shadow-inner">
                {showCoachBio.bio || "This coach is an expert in foundational logic, Python, and hardware engineering, dedicated to helping your child redefine their potential."}
              </p>
            </motion.div>
          </div>
        )}

        {/* BOOKING ENGINE MODAL */}
        {showBookingModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBookingModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30 text-blue-400"><CalendarPlus size={24} /></div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white">
                      {bookingMode === 'reschedule' ? 'Reschedule Lesson' : 'Schedule Lesson'}
                    </h3>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-1">
                      {bookingMode === 'reschedule' ? `Swapping: ${new Date(targetLesson.date).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}` : 'Select an available 1-hour timeslot.'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowBookingModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                {isFetchingSlots ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fetching Database...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl">
                    <CalendarX2 className="mx-auto text-slate-600 mb-4" size={40} />
                    <p className="text-sm font-bold text-slate-400 italic">No available timeslots found.<br/>Please check back later or contact your coach.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableSlots.map(slot => {
                      const start = new Date(slot.start_time);
                      const end = new Date(slot.end_time);
                      return (
                        <div key={slot.id} className="bg-[#020617] border border-white/5 rounded-2xl p-5 hover:border-blue-500/50 transition-all group flex flex-col">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                            {start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">
                            {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                          <div className="flex items-center gap-2 mt-4 mb-4">
                            <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              {slot.delivery_mode}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 truncate">
                              with {slot.profiles?.display_name?.split(' ')[0] || 'Coach'}
                            </span>
                          </div>
                          
                          <button 
                            onClick={async () => {
                              // Execute the complex booking/rescheduling logic
                              try {
                                setIsFetchingSlots(true);
                                let oldLessonDetails = "";

                                // 1. If Rescheduling, free up the old slot
                                if (bookingMode === 'reschedule' && targetLesson) {
                                  oldLessonDetails = `${new Date(targetLesson.date).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}`;
                                  
                                  // Attempt to free the old slot in the inventory
                                  await supabase.from('teacher_availability')
                                    .update({ is_booked: false, booked_by: null, student_id: null })
                                    .eq('student_id', selectedChildId)
                                    .eq('start_time', targetLesson.date);
                                }

                                // 2. Lock the new slot
                                const { error: lockErr } = await supabase.from('teacher_availability')
                                  .update({ is_booked: true, booked_by: parentId, student_id: selectedChildId })
                                  .eq('id', slot.id)
                                  .eq('is_booked', false); // Atomic check

                                if (lockErr) throw new Error("Slot already taken.");

                                // 3. Update the student's schedule
                                const newSchedule = selectedChild?.meta?.schedule ? [...selectedChild.meta.schedule] : [];
                                
                                if (bookingMode === 'reschedule' && targetLesson) {
                                  const idx = newSchedule.findIndex(l => l.id === targetLesson.id);
                                  if (idx > -1) newSchedule.splice(idx, 1); // Remove old
                                } else {
                                  // Deduct 1 credit if not a reschedule
                                  const newCredits = Math.max(0, bookingCredits - 1);
                                  const updatedMeta = { ...parentData.metadata, booking_credits: newCredits };
                                  await supabase.from('profiles').update({ metadata: updatedMeta }).eq('id', parentId);
                                  setParentData((prev: any) => ({ ...prev, metadata: updatedMeta }));

                                  // NEW: Write the withdrawal to the Audit Ledger
                                  await supabase.from('credit_ledger').insert([{
                                    guardian_id: parentId,
                                    amount: -1,
                                    reason: `Booked Lesson: ${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                                  }]);
                                }

                                // Inject new lesson
                                newSchedule.push({
                                  id: Math.random().toString(36).substring(7),
                                  date: slot.start_time,
                                  topic: bookingMode === 'reschedule' ? targetLesson.topic : (selectedChild?.course || "Scheduled Lesson"),
                                  course: selectedChild?.course || "Bootcamp",
                                  delivery: slot.delivery_mode,
                                  location: null,
                                  link: null,
                                  reminders: { parents: true, teacher: true }
                                });

                                const updatedChildMeta = { ...selectedChild.meta, schedule: newSchedule };
                                await supabase.from('profiles').update({ metadata: updatedChildMeta }).eq('id', selectedChildId);

                                // 4. Create WhatsApp / System Notification
                                const newTimeFormatted = `${start.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'})} at ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                                
                                if (bookingMode === 'reschedule') {
                                  const msg = `Hi Coach, I have rescheduled ${selectedChild?.display_name.split(' ')[0]}'s lesson from ${oldLessonDetails} to ${newTimeFormatted}. Thank you!`;
                                  window.open(`https://wa.me/27767065959?text=${encodeURIComponent(msg)}`, '_blank');
                                  showToast("Lesson rescheduled successfully. WhatsApp opened to notify the academy.", "success");
                                } else {
                                  await supabase.from('coach_messages').insert([{
                                    student_id: selectedChildId,
                                    guardian_id: parentId,
                                    coach_id: slot.teacher_id,
                                    sender_id: parentId,
                                    message: `[SYSTEM: NEW BOOKING] I have scheduled a new lesson for ${newTimeFormatted}.`
                                  }]);
                                  
                                  const remaining = Math.max(0, bookingCredits - 1);
                                  if (remaining > 0) {
                                    showToast(`Slot confirmed! You have ${remaining} credits remaining.`, "success");
                                  } else {
                                    showToast("Slot confirmed! Your schedule is fully booked.", "success");
                                  }
                                }

                                fetchDashboardData(); // Refresh UI
                                setShowBookingModal(false);

                              } catch (err: any) {
                                showToast(err.message || "Failed to secure slot. Please try another.", "error");
                                setIsFetchingSlots(false);
                              }
                            }}
                            className="mt-auto w-full py-3 bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 hover:border-blue-500 shadow-md"
                          >
                            Confirm & Lock Slot
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}