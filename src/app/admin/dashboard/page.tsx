"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, UserPlus, BookOpen, Activity, AlertCircle, 
  CheckCircle2, CreditCard, ChevronRight, Loader2, 
  Target, TrendingUp, DollarSign, Clock, X, ArrowUpRight,
  ShieldCheck, LayoutDashboard, Zap, Briefcase, ArrowRight, LogOut,
  GraduationCap, Eye, Bell, CalendarDays, Building2, Send, 
  Inbox, Calculator, Key, Brain, Cpu, Trophy, ExternalLink, FileText,
  BarChart3, Globe, ImagePlus, UserCog, Terminal, Database, Server
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MediaDesk from "@/components/admin/MediaDesk";
import RoleSwitcherModal from "@/components/admin/RoleSwitcherModal";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Dashboard UI State
  const [selectedStat, setSelectedStat] = useState<null | string>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<'overview' | 'leads' | 'finance' | 'learning'>('overview');
  const [activeSectorTab, setActiveSectorTab] = useState<'growth' | 'core' | 'admin' | 'dev'>('growth');

  // Unified Registration Alerts
  const [newRegistrations, setNewRegistrations] = useState<any[]>([]);

  // XP Settings State
  const [isXpModalOpen, setIsXpModalOpen] = useState(false);
  const [xpConfig, setXpConfig] = useState({ multiplier: 1.0, start_date: "", end_date: "" });
  const [isSavingXp, setIsSavingXp] = useState(false);

  // Pending Reviews State
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTeacherFilter, setReviewTeacherFilter] = useState<string>('all');

  // Modals & Tools State
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);

  // Stats State
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingRequests: 0,
    monthlyRevenue: 0,
    activeLeads: 0,
    conversionRate: 0,
    growthMoM: 12.5,
    newLeads: 0,
    warmLeads: 0,
    wonProspects: 0,
    invitesSent: 0,
    trialsActive: 0,
    trialsConverted: 0,
    expiredUnclaimed: 0
  });

  useEffect(() => {
    fetchHeartbeat();
  }, []);

  // --- EXISTING LISTENER: Coach Messages ---
  useEffect(() => {
    if (!currentUser) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('coach_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', currentUser.id); 
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase.channel('admin_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_messages' }, () => {
         fetchUnread(); 
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // --- REGISTRATIONS LISTENER: Fetch Initial ---
  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('registrations')
        .select('*')
        .eq('is_acknowledged', false)
        .order('created_at', { ascending: false });
      
      if (data) setNewRegistrations(data);
    };

    fetchAlerts();
  }, []);

  // --- REGISTRATIONS LISTENER: Realtime Subscription ---
  useEffect(() => {
    const channel = supabase.channel('admin-registration-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations' },
        (payload) => {
          setNewRegistrations((curr) => [payload.new, ...curr]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- HEARTBEAT DATA FETCH ---
  async function fetchHeartbeat() {
    setLoading(true);
    try {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      if (profile) setCurrentUser(profile);

      // Fetch Global XP Config
      const { data: xpData } = await supabase.from('system_settings').select('*').eq('id', 1).single();
      if (xpData) {
         setXpConfig({
           multiplier: xpData.xp_multiplier || 1.0,
           start_date: xpData.xp_start_date ? new Date(xpData.xp_start_date).toISOString().slice(0, 16) : "",
           end_date: xpData.xp_end_date ? new Date(xpData.xp_end_date).toISOString().slice(0, 16) : ""
         });
      }

      const [techArchiveRes, tutSubsRes, missionsRes] = await Promise.all([
        supabase.from('tech_archive').select('*, profiles!inner(display_name, metadata)').eq('review_status', 'pending'),
        supabase.from('tutorial_submissions').select('*').eq('status', 'pending'),
        supabase.from('missions').select('id, xp_reward, title')
      ]);

      const missionsMap = new Map();
      if (missionsRes.data) {
        missionsRes.data.forEach((m: any) => missionsMap.set(m.id, { xp: m.xp_reward, title: m.title }));
      }

      let combinedPending: any[] = [];

      if (techArchiveRes.data) {
        const enrichedTech = techArchiveRes.data.map((sub: any) => {
           let max = sub.potential_xp || 0;
           if (max === 0) max = missionsMap.get(sub.mission_id)?.xp || 0;
           return { ...sub, potential_xp: max, source_table: 'tech_archive' }; 
        });
        combinedPending = [...combinedPending, ...enrichedTech];
      }

      if (tutSubsRes.data && tutSubsRes.data.length > 0) {
        const studentIds = [...new Set(tutSubsRes.data.map((s: any) => s.student_id))];
        const { data: profilesData } = await supabase.from('profiles').select('id, display_name, metadata').in('id', studentIds);
        
        const profileMap = new Map();
        if (profilesData) {
          profilesData.forEach(p => profileMap.set(p.id, p));
        }

        const enrichedSubs = tutSubsRes.data.map((sub: any) => {
           const missionData = missionsMap.get(sub.mission_id);
           return {
             ...sub,
             title: missionData ? `${missionData.title} (MakeCode Win ${sub.win_index})` : 'MakeCode Submission',
             media_url: sub.share_url,
             potential_xp: missionData?.xp || 250,
             xp_earned: sub.xp_earned || 0,
             bonus_xp: sub.bonus_xp || 0,
             review_status: sub.status,
             profiles: profileMap.get(sub.student_id) || { display_name: 'Unknown Pioneer', metadata: {} },
             source_table: 'tutorial_submissions'
           };
        });
        combinedPending = [...combinedPending, ...enrichedSubs];
      }

      setPendingSubmissions(combinedPending);

      const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const { count: requestCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'new');
      
      const { data: paidRecords } = await supabase.from('billing_records').select('total_amount').in('status', ['paid', 'settled']);
      const totalRevenue = paidRecords?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;
      
      const { data: prospectStats } = await supabase.from('prospects').select('*');
      
      const total = prospectStats?.length || 0;
      const won = prospectStats?.filter(p => p.status === 'Converted (Won)').length || 0;
      const actualConvRate = total > 0 ? Math.round((won / total) * 100) : 0;

      const now = new Date().getTime();
      let sent = 0, activeTrials = 0, inviteConverted = 0, expired = 0;
      
      prospectStats?.forEach(p => {
        const isCampaignLead = p.metadata?.campaign === "Commitment Pricing May 2026" || p.source === 'Referral' || p.metadata?.referred_by_id;
        if (!isCampaignLead) return;

        const isInviteSent = p.status === 'Invite Sent';
        const isTrialActive = p.status === 'Trial Active' || (p.source === 'Referral' && p.status === 'New Lead');
        const invExpDate = p.metadata?.invite_expiry ? new Date(p.metadata.invite_expiry).getTime() : now + 100000;

        if (p.status === 'Converted (Won)') inviteConverted++;
        if (isTrialActive) activeTrials++;
        if (isInviteSent) {
          if (now > invExpDate) expired++;
          else sent++;
        }
      });

      setStats(prev => ({
        ...prev,
        totalStudents: studentCount || 0,
        pendingRequests: requestCount || 0,
        monthlyRevenue: totalRevenue,
        activeLeads: prospectStats?.filter(p => !['Lost', 'Converted (Won)'].includes(p.status)).length || 0,
        newLeads: prospectStats?.filter(p => p.status === 'New Lead').length || 0,
        warmLeads: prospectStats?.filter(p => p.status === 'Warm (Pending Close)').length || 0,
        wonProspects: won,
        conversionRate: actualConvRate,
        invitesSent: sent,
        trialsActive: activeTrials,
        trialsConverted: inviteConverted,
        expiredUnclaimed: expired
      }));
    } catch (err) {
      console.error("HEARTBEAT_FAILURE:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- XP & EVALUATION HANDLERS ---
  const handleAwardXP = async (submission: any, awardedXp: number, bonusXp: number, justification: string) => {
    const finalAwarded = isNaN(awardedXp) ? 0 : awardedXp;
    const finalBonus = isNaN(bonusXp) ? 0 : bonusXp;

    const maxBonus = Math.floor((submission.potential_xp || 0) * 0.1);
    if (finalBonus > maxBonus) {
      return alert(`Bonus cannot exceed ${maxBonus} XP (10% limit)`);
    }

    const totalToGive = finalAwarded + finalBonus;

    try {
      const { data: profile } = await supabase.from('profiles').select('xp, metadata').eq('id', submission.student_id).single();
      
      if (profile) {
        const currentXp = profile.xp || 0;
        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
        
        let noteLog = `[${new Date().toLocaleDateString()}] Awarded ${finalAwarded} XP`;
        if (finalBonus > 0) noteLog += ` + ${finalBonus} Bonus XP`;
        noteLog += ` for project: ${submission.project_title || submission.title}\n`;
        if (justification) noteLog += `Admin Note: ${justification}\n`;

        meta.admin_notes = noteLog + (meta.admin_notes ? `\n${meta.admin_notes}` : "");

        await supabase.from('profiles').update({ 
          xp: currentXp + totalToGive,
          metadata: meta 
        }).eq('id', submission.student_id);
      }

      if (submission.source_table === 'tutorial_submissions') {
        await supabase
          .from('tutorial_submissions')
          .update({ 
            status: 'reviewed',
            xp_earned: (submission.xp_earned || 0) + totalToGive,
            bonus_xp: (submission.bonus_xp || 0) + finalBonus 
          })
          .eq('id', submission.id);
      } else {
        await supabase
          .from('tech_archive')
          .update({
            review_status: 'reviewed',
            xp_earned: (submission.xp_earned || 0) + totalToGive, 
            teacher_xp_awarded: (submission.teacher_xp_awarded || 0) + finalBonus,
            metadata: { 
              ...(submission.metadata || {}), 
              teacher_notes: justification,
              bonus_awarded: (submission.metadata?.bonus_awarded || 0) + finalBonus,
              admin_id_awarded: currentUser?.id
            }
          })
          .eq('id', submission.id);
      }

      fetchHeartbeat(); 
    } catch (err) {
      console.error(err);
      alert("Error updating XP");
    }
  };

  const handleSaveXpConfig = async () => {
      setIsSavingXp(true);
      try {
          const payload = {
              xp_multiplier: xpConfig.multiplier,
              xp_start_date: xpConfig.start_date ? new Date(xpConfig.start_date).toISOString() : null,
              xp_end_date: xpConfig.end_date ? new Date(xpConfig.end_date).toISOString() : null
          };
          await supabase.from('system_settings').upsert({ id: 1, ...payload });
          setIsXpModalOpen(false);
      } catch (err) {
          alert("Failed to update XP Configuration.");
      } finally {
          setIsSavingXp(false);
      }
  };

  const handleAcknowledge = async (id: string) => {
    setNewRegistrations((current) => current.filter(item => item.id !== id));
    await supabase.from('registrations').update({ is_acknowledged: true }).eq('id', id);
  };

  const handleLogout = async () => {
    localStorage.removeItem("pioneer_session");
    await supabase.auth.signOut();
    router.push("/login");
  };

  const reviewTeachers = useMemo(() => {
    const map = new Map();
    pendingSubmissions.forEach(sub => {
      const t = sub.profiles?.metadata?.teacher;
      if (t && t.id) map.set(t.id, t.name || 'Unknown Teacher');
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [pendingSubmissions]);

  const filteredReviews = useMemo(() => {
    if (reviewTeacherFilter === 'all') return pendingSubmissions;
    return pendingSubmissions.filter(sub => sub.profiles?.metadata?.teacher?.id === reviewTeacherFilter);
  }, [pendingSubmissions, reviewTeacherFilter]);


  const StatCard = ({ label, value, icon: Icon, color, id, customValue = null }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      onClick={() => setSelectedStat(id)}
      className="cursor-pointer bg-[#0f172a] border border-white/10 p-6 rounded-[32px] relative overflow-hidden group transition-all hover:border-blue-500/50 flex flex-col justify-between"
    >
      <div className="flex justify-between items-start relative z-10 mb-6">
        <div className={`p-3 rounded-2xl bg-white/5 ${color}`}>
          <Icon size={24} />
        </div>
        {['revenue', 'pioneers', 'leads', 'growth'].includes(id) && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
            <TrendingUp size={12} /> {stats.growthMoM}%
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
        <h4 className="text-4xl font-black italic mt-1 tracking-tighter">{customValue || value}</h4>
      </div>
      <Icon className={`absolute -right-6 -bottom-6 size-32 opacity-[0.03] ${color} group-hover:opacity-10 transition-opacity`} />
    </motion.div>
  );

  const groupedSectors: Record<string, any> = {
    growth: {
      title: "Growth & Acquisition",
      desc: "Manage top-of-funnel leads, invites, and external campaigns.",
      items: [
        { label: 'Prospects', icon: Target, path: '/admin/prospects', color: 'hover:border-fuchsia-500' },
        { label: 'Leads', icon: Inbox, path: '/admin/leads', color: 'hover:border-blue-500' },
        { label: 'Add a Guardian', icon: UserPlus, path: '/admin/intake', color: 'hover:border-blue-400' },
        { label: 'Outbound Invites', icon: Send, path: '/admin/invites', color: 'hover:border-purple-500' },
        { label: 'Events & Bootcamps', icon: CalendarDays, path: '/admin/events', color: 'hover:border-yellow-500' },
        { label: 'B2B Consulting', icon: Building2, path: '/admin/consulting', color: 'hover:border-indigo-500' },
      ]
    },
    core: {
      title: "Core Operations",
      desc: "Manage active students, course delivery, and platform users.",
      items: [
        { label: 'LMS Academy', icon: BookOpen, path: '/admin/courses', color: 'hover:border-blue-400' },
        { label: 'Math Diagnostics', icon: Calculator, path: '/admin/math-diagnostics', color: 'hover:border-rose-400' },
        { label: 'Finance Hub', icon: CreditCard, path: '/admin/finance', color: 'hover:border-emerald-500' },
        { label: 'Student Hub', icon: Users, path: '/admin/pioneers', color: 'hover:border-emerald-400' },        
        { label: 'Parent Hub', icon: Eye, path: '/admin/parents', color: 'hover:border-pink-500' }, // LINK TO BE CHANGED
      ]
    },
    admin: {
      title: "Admin & Infrastructure",
      desc: "Financials, high-level agreements, and system configuration.",
      items: [
        { label: 'Finance Hub', icon: CreditCard, path: '/admin/finance', color: 'hover:border-emerald-500' },
        { label: 'Core Agreements', icon: ShieldCheck, path: '/admin/agreements', color: 'hover:border-rose-500' },
        { label: 'Comms Center', icon: Activity, path: '/admin/communications', color: 'hover:border-orange-500' },
        { label: 'CRM Directory', icon: Users, path: '/admin/directory', color: 'hover:border-purple-500' },
        { label: 'Master Contacts', icon: Briefcase, path: '/admin/contacts', color: 'hover:border-slate-500' },
        { label: 'Growth Blueprint', icon: Target, path: '/admin/blueprint', color: 'hover:border-fuchsia-500' },
        { label: 'System Auth/MFA', icon: Key, path: '/admin/setup-mfa', color: 'hover:border-zinc-500' },
        { label: 'Verification', icon: CheckCircle2, path: '/admin/verify', color: 'hover:border-zinc-400' },
      ]
    },
    dev: {
      title: "System & Engineering",
      desc: "Developer tools, role impersonation, and environment testing.",
      items: [
        { label: 'Role Impersonation', icon: UserCog, onClick: () => setIsRoleSwitcherOpen(true), color: 'hover:border-slate-500' },
        { label: 'Parent Portals', icon: Eye, path: '/admin/parents', color: 'hover:border-pink-500' },
        { label: 'Teacher Portal', icon: LayoutDashboard, path: '/teacher/dashboard', color: 'hover:border-orange-400' },
        { label: 'Web Analytics', icon: Globe, path: '/admin/analytics', color: 'hover:border-cyan-400' },
        { label: 'API Logs', icon: Terminal, path: '/admin/logs', color: 'hover:border-violet-500' },
        { label: 'Database UI', icon: Database, path: '/admin/db', color: 'hover:border-violet-500' },
        { label: 'Server Config', icon: Server, path: '/admin/server', color: 'hover:border-violet-500' },
      ]
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Loading Pulse...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans overflow-x-hidden text-left relative">
      
      {/* NOTIFICATION PANEL */}
      <AnimatePresence>
        {newRegistrations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[150] w-[calc(100%-3rem)] max-w-[360px] flex flex-col gap-4 pointer-events-none"
          >
            {newRegistrations.map((item) => {
              const isMath = item.interested_programs?.[0] === "Free Math Lab";
              return (
                <motion.div key={item.id} layout className={`bg-[#0f172a]/95 backdrop-blur-xl border p-5 rounded-3xl flex flex-col gap-3 pointer-events-auto ${isMath ? 'border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.15)]' : 'border-blue-500/40 shadow-[0_0_40px_rgba(37,99,235,0.15)]'}`}>
                  <div className="flex items-start justify-between">
                    <div className={`flex items-center gap-2 ${isMath ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {isMath ? <Brain size={16} className="animate-pulse" /> : <Cpu size={16} className="animate-pulse" />}
                      <span className="text-[10px] font-black uppercase tracking-widest">{isMath ? 'Math Setup' : 'Robotics Lead'}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-lg text-white leading-tight">{item.parent_name}</p>
                    <p className="text-xs text-slate-300 mt-1">{item.email}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{item.phone}</p>
                    {isMath && item.metadata?.pioneer_username && (
                      <p className="text-xs text-emerald-300 mt-2 font-bold">Pioneer ID: {item.metadata.pioneer_username}</p>
                    )}
                    {item.interested_programs && item.interested_programs.length > 0 && (
                      <div className={`mt-3 inline-block border px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${isMath ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                        {item.interested_programs[0]}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleAcknowledge(item.id)} className={`mt-2 w-full py-3 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] ${isMath ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'}`}>
                    <ShieldCheck size={14} /> Acknowledge & Close
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <Zap size={14} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational_Pulse_v3.0</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter uppercase italic leading-none">
              Command_<span className="text-blue-500">Center</span>
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setIsMediaModalOpen(true)} className="px-6 py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
              <ImagePlus size={14} /> Open Media Desk
            </button>
            <button onClick={() => setIsXpModalOpen(true)} className="px-6 py-4 bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
              <Trophy size={14} /> XP Events
            </button>
            <Link href="/admin/invites" className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center gap-2 group">
              <Send size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Invite Leads
            </Link>
            <Link href="/admin/leads" className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
              Inbox <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded-full text-white">{stats.pendingRequests}</span>
            </Link>
            <div className="w-px h-10 bg-white/10 mx-2 hidden md:block" />
            <Link href="/admin/communications" className="relative p-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-2xl transition-all shadow-sm">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-[#0f172a] shadow-lg animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>
            <button onClick={handleLogout} className="p-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-all" title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* --- PENDING REVIEWS ALERT CARD --- */}
        {pendingSubmissions.length > 0 && (
          <div 
            onClick={() => setIsReviewModalOpen(true)}
            className="bg-gradient-to-r from-amber-500/20 to-[#020617] border border-amber-500/30 rounded-[32px] p-8 cursor-pointer hover:border-amber-500/60 transition-all flex items-center justify-between group overflow-hidden relative shadow-[0_0_30px_rgba(245,158,11,0.15)]"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                   <Trophy size={20} />
                 </div>
                 <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-400">Action Required</h3>
              </div>
              <p className="text-3xl md:text-5xl font-black text-white italic tracking-tighter">
                {pendingSubmissions.length} Pending Reviews
              </p>
              <p className="text-slate-400 text-sm mt-2 max-w-md">Student sandbox and MakeCode submissions are awaiting grading and XP distribution.</p>
            </div>
            <Trophy className="absolute -right-10 -bottom-10 size-64 text-amber-500/10 group-hover:text-amber-500/20 group-hover:scale-110 transition-all duration-700" />
          </div>
        )}

        {/* TABBED METRICS SECTION */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 bg-[#0f172a] p-1.5 rounded-2xl border border-white/10 w-fit">
            <button onClick={() => setActiveMetricTab('overview')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeMetricTab === 'overview' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>General Overview</button>
            <button onClick={() => setActiveMetricTab('leads')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${activeMetricTab === 'leads' ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}><Target size={12}/> Leads Engine</button>
            <button onClick={() => setActiveMetricTab('finance')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${activeMetricTab === 'finance' ? 'bg-emerald-600/20 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}><DollarSign size={12}/> Finance Engine</button>
            <button onClick={() => setActiveMetricTab('learning')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${activeMetricTab === 'learning' ? 'bg-fuchsia-600/20 text-fuchsia-400 shadow-sm border border-fuchsia-500/20' : 'text-slate-500 hover:text-slate-300'}`}><BookOpen size={12}/> Learning Engine</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatePresence mode="wait">
              {activeMetricTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="contents">
                  <StatCard id="revenue" label="Total Revenue" customValue={`R${stats.monthlyRevenue.toLocaleString()}`} icon={DollarSign} color="text-emerald-400" />
                  <StatCard id="pioneers" label="Active Pioneers" value={stats.totalStudents} icon={Users} color="text-blue-400" />
                  <StatCard id="leads" label="Active Leads" value={stats.activeLeads} icon={Target} color="text-fuchsia-400" />
                  <StatCard id="growth" label="Conversion Rate" customValue={`${stats.conversionRate}%`} icon={TrendingUp} color="text-orange-400" />
                </motion.div>
              )}
              {activeMetricTab === 'leads' && (
                <motion.div key="leads" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="contents">
                  <StatCard id="newLeads" label="New Leads" value={stats.newLeads} icon={UserPlus} color="text-purple-400" />
                  <StatCard id="sent" label="Invites Sent" value={stats.invitesSent} icon={Send} color="text-blue-400" />
                  <StatCard id="trials" label="Trials Active" value={stats.trialsActive} icon={Clock} color="text-amber-400" />
                  <StatCard id="converted" label="Trials Converted" value={stats.trialsConverted} icon={CheckCircle2} color="text-emerald-400" />
                </motion.div>
              )}
              {activeMetricTab === 'finance' && (
                <motion.div key="finance" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="contents">
                  <StatCard id="revenue" label="Collected Revenue" customValue={`R${stats.monthlyRevenue.toLocaleString()}`} icon={DollarSign} color="text-emerald-400" />
                  <StatCard id="won" label="Paid Conversions" value={stats.wonProspects} icon={CheckCircle2} color="text-blue-400" />
                  <StatCard id="trials" label="Pending Trial Cashflow" value={stats.trialsActive} icon={Activity} color="text-amber-400" />
                  <StatCard id="growth" label="MoM Growth" customValue={`${stats.growthMoM}%`} icon={TrendingUp} color="text-emerald-400" />
                </motion.div>
              )}
              {activeMetricTab === 'learning' && (
                <motion.div key="learning" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="contents">
                  <StatCard id="pioneers" label="Total Enrolled" value={stats.totalStudents} icon={GraduationCap} color="text-blue-400" />
                  <StatCard id="requests" label="Pending Intakes" value={stats.pendingRequests} icon={Inbox} color="text-fuchsia-400" />
                  <StatCard id="courses" label="Active Courses" value={3} icon={BookOpen} color="text-emerald-400" />
                  <StatCard id="events" label="Upcoming Bootcamps" value={1} icon={CalendarDays} color="text-orange-400" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* SECTORS HUB (TABBED) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-white/10">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-wrap gap-2 bg-[#0f172a] p-1.5 rounded-2xl border border-white/10 w-fit">
              <button onClick={() => setActiveSectorTab('growth')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSectorTab === 'growth' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Growth & Acquisition</button>
              <button onClick={() => setActiveSectorTab('core')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSectorTab === 'core' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Core Operations</button>
              <button onClick={() => setActiveSectorTab('admin')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSectorTab === 'admin' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Admin & Infrastructure</button>
              <button onClick={() => setActiveSectorTab('dev')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${activeSectorTab === 'dev' ? 'bg-violet-600/20 text-violet-400 shadow-sm border border-violet-500/20' : 'text-slate-500 hover:text-slate-300'}`}><Terminal size={12}/> System & Dev</button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div key={activeSectorTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="mb-8">
                    <h3 className="text-xl font-black italic uppercase text-white tracking-tight">{groupedSectors[activeSectorTab].title}</h3>
                    <p className="text-slate-500 text-xs mt-1 font-medium">{groupedSectors[activeSectorTab].desc}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {groupedSectors[activeSectorTab].items.map((item: any, i: number) => {
                      const commonClasses = `text-left p-5 bg-[#0f172a] border border-transparent hover:bg-white/5 rounded-[24px] transition-all flex flex-col gap-4 group ${item.color}`;
                      const Icon = item.icon;

                      if (item.onClick) {
                        return (
                          <button key={i} onClick={item.onClick} className={commonClasses}>
                            <Icon size={20} className="text-slate-500 group-hover:text-white transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                          </button>
                        );
                      }

                      return (
                        <Link key={i} href={item.path} className={commonClasses}>
                          <Icon size={20} className="text-slate-500 group-hover:text-white transition-colors" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* HEALTH STATUS WIDGET */}
          <div className="bg-blue-600 rounded-[40px] p-10 flex flex-col justify-between relative overflow-hidden group h-[500px] lg:sticky lg:top-10">
            <ShieldCheck className="absolute -right-10 -bottom-10 size-64 opacity-20 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
            <div className="relative z-10 space-y-4">
              <h3 className="text-3xl font-black italic uppercase leading-tight mb-4">Security & <br/>System Health</h3>
              <div className="flex items-center gap-3 bg-black/20 p-4 rounded-2xl backdrop-blur-md">
                <div className="size-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Database Stable</span>
              </div>
              <div className="flex items-center gap-3 bg-black/20 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-white font-black">{stats.pendingRequests}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Registrations Pending</span>
              </div>
            </div>
            <Link href="/admin/leads" className="relative z-10 w-full py-4 bg-white text-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center shadow-lg hover:-translate-y-1 transition-transform">
              Process Intake
            </Link>
          </div>
        </div>

      </div>

      {/* STAT DETAIL MODAL */}
      <AnimatePresence>
        {selectedStat && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStat(null)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden">
              <Zap className="absolute -right-8 -top-8 size-48 opacity-[0.02] text-blue-500" />
              
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                  {selectedStat === 'revenue' ? 'Financial_Report' : 
                   selectedStat === 'pioneers' ? 'Pioneer_Metrics' : 
                   selectedStat === 'leads' || selectedStat === 'newLeads' ? 'Pipeline_Pulse' : 
                   selectedStat === 'growth' || selectedStat === 'won' ? 'Conversion_Stats' :
                   selectedStat === 'sent' || selectedStat === 'trials' || selectedStat === 'converted' || selectedStat === 'expired' ? 'Growth_Engine' : 'Stats'}
                </h2>
                <button onClick={(e) => { e.stopPropagation(); setSelectedStat(null); }} className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all z-50 relative"><X size={20}/></button>
              </div>

              {(selectedStat === 'leads' || selectedStat === 'growth' || selectedStat === 'won') ? (
                <div className="space-y-4 mb-10 relative z-10">
                  <div className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fresh Leads (Meta)</span>
                    <span className="text-2xl font-black text-blue-400 italic">{stats.newLeads}</span>
                  </div>
                  <div className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Warm / Pending Close</span>
                    <span className="text-2xl font-black text-amber-400 italic">{stats.warmLeads}</span>
                  </div>
                  <div className="flex justify-between items-center p-5 bg-green-500/10 rounded-2xl border border-green-500/20">
                    <span className="text-[10px] font-black uppercase text-green-400 tracking-widest">Total Converted (Won)</span>
                    <span className="text-2xl font-black text-green-400 italic">{stats.wonProspects}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 mb-10 relative z-10">
                  <div className="p-8 bg-white/5 rounded-3xl border border-white/10 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Selected Metric Volume</p>
                    <p className="text-6xl font-black italic text-white">
                      {selectedStat === 'revenue' ? `R${stats.monthlyRevenue.toLocaleString()}` : 
                       selectedStat === 'pioneers' ? stats.totalStudents :
                       selectedStat === 'sent' ? stats.invitesSent :
                       selectedStat === 'trials' ? stats.trialsActive :
                       selectedStat === 'converted' ? stats.trialsConverted :
                       selectedStat === 'expired' ? stats.expiredUnclaimed :
                       selectedStat === 'requests' ? stats.pendingRequests :
                       selectedStat === 'newLeads' ? stats.newLeads : '0'
                      }
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 relative z-10">
                <button onClick={() => setSelectedStat(null)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:text-white text-slate-400 transition-colors">Close</button>
                <Link 
                  href={`/admin/${['sent', 'trials', 'converted', 'expired'].includes(selectedStat) ? 'invites' : selectedStat === 'revenue' ? 'finance' : selectedStat === 'pioneers' ? 'pioneers' : 'leads'}`}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest text-center flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
                >
                  Deep Dive <ArrowUpRight size={14} />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- GLOBAL XP SETTINGS MODAL --- */}
      <AnimatePresence>
        {isXpModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsXpModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-[40px] p-8 shadow-2xl overflow-hidden">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2 flex items-center gap-3"><Trophy className="text-purple-500" /> XP Events Manager</h3>
              <p className="text-slate-400 text-xs mb-6">Set a global multiplier for all automated and manual XP awarded across the platform.</p>
              
              <div className="space-y-4 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Multiplier (Factor)</label>
                  <input type="number" step="0.1" min="1" value={xpConfig.multiplier} onChange={e => setXpConfig({...xpConfig, multiplier: Number(e.target.value)})} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Start Time</label>
                    <input type="datetime-local" value={xpConfig.start_date} onChange={e => setXpConfig({...xpConfig, start_date: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">End Time</label>
                    <input type="datetime-local" value={xpConfig.end_date} onChange={e => setXpConfig({...xpConfig, end_date: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500" />
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-bold italic mt-2 text-center">If dates are empty or expired, the system defaults to standard 1.0x XP.</p>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsXpModalOpen(false)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:text-white text-slate-400 transition-colors">Cancel</button>
                <button onClick={handleSaveXpConfig} disabled={isSavingXp} className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest text-center flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 transition-all">
                   {isSavingXp ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save Event
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NEW: ADMIN REVIEW QUEUE MODAL --- */}
      <AnimatePresence>
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReviewModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-5xl bg-[#0a0f1c] border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              
              <div className="p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                    <Trophy size={24} />
                  </div>
                  <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Review Queue</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{filteredReviews.length} Submissions Awaiting Feedback</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {reviewTeachers.length > 0 && (
                    <select 
                      value={reviewTeacherFilter}
                      onChange={(e) => setReviewTeacherFilter(e.target.value)}
                      className="bg-[#020617] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="all">All Teachers</option>
                      {reviewTeachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => setIsReviewModalOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
                </div>
              </div>
              
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                {filteredReviews.length === 0 ? (
                   <div className="text-center p-12 text-slate-500 italic font-bold">All caught up! No reviews pending for this selection.</div>
                ) : (
                  filteredReviews.map((sub) => (
                    <div key={sub.id} className="bg-[#020617] border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-8 group hover:border-amber-500/30 transition-all shadow-inner">
                      
                      {(() => {
                        const maxPossible = sub.potential_xp || 100;
                        const maxBonus = Math.floor(maxPossible * 0.1);
                        
                        const totalEarned = sub.xp_earned || 0;
                        const existingBonus = sub.source_table === 'tutorial_submissions' 
                          ? (sub.bonus_xp || 0) 
                          : (sub.teacher_xp_awarded || sub.metadata?.bonus_awarded || 0);
                        
                        const baseEarned = totalEarned - existingBonus;
                        const remainingBase = Math.max(0, maxPossible - baseEarned);

                        return (
                          <>
                            <div className="flex-1 w-full space-y-3">
                               <div className="flex justify-between items-start">
                                 <h3 className="text-xl font-black text-white uppercase">{sub.profiles?.display_name}</h3>
                                 {sub.profiles?.metadata?.teacher?.name && (
                                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                                     {sub.profiles.metadata.teacher.name}
                                   </span>
                                 )}
                               </div>
                               <p className="text-sm font-bold text-slate-300">{sub.title || sub.project_title || "Custom Logic Build"}</p>
                               
                               <div className="inline-flex items-center gap-3 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 mt-1">
                                 <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                                   Max Possible: <span className="text-white">{maxPossible} XP</span>
                                 </p>
                                 <span className="text-blue-500/30">|</span>
                                 <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                                   Already Earned: <span className="text-white">{totalEarned} XP</span>
                                 </p>
                               </div>
                               
                               <div className="pt-3">
                                 {sub.media_url ? (
                                   <a href={sub.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20">
                                     <ExternalLink size={14}/> View Blueprint / Code
                                   </a>
                                 ) : sub.metadata?.submission_urls ? (
                                   Object.values(sub.metadata.submission_urls).map((url: any, idx) => (
                                     <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 mr-2 mt-2">
                                       <ExternalLink size={14}/> View Submission {idx + 1}
                                     </a>
                                   ))
                                 ) : null}
                               </div>
                            </div>

                            <div className="w-full md:w-1/2 lg:w-5/12 shrink-0 bg-[#0f172a] p-6 rounded-[24px] border border-white/5 flex flex-col gap-5 min-w-[340px] shadow-lg">
                               <div className="flex gap-4">
                                  <div className="flex-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2 pl-1">Add Base (Max {remainingBase})</label>
                                    <input 
                                      id={`xp-${sub.id}`} 
                                      type="number" 
                                      min="0"
                                      max={remainingBase}
                                      defaultValue={remainingBase} 
                                      className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500 transition-colors" 
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-amber-500 block mb-2 pl-1">Bonus (Max {maxBonus})</label>
                                    <input 
                                      id={`bonus-${sub.id}`} 
                                      type="number" 
                                      min="0"
                                      max={maxBonus}
                                      defaultValue={0}
                                      className="w-full bg-[#020617] border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-bold text-amber-400 outline-none focus:border-amber-500 placeholder:text-amber-500/30 transition-colors" 
                                    />
                                  </div>
                               </div>
                               
                               <div>
                                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2 pl-1 flex items-center gap-1"><FileText size={10}/> Admin Note</label>
                                  <input 
                                    id={`note-${sub.id}`} 
                                    type="text" 
                                    placeholder="Great use of loops..." 
                                    className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600" 
                                  />
                               </div>

                               <button 
                                  id={`submit-btn-${sub.id}`}
                                  onClick={async (e) => {
                                    const btn = e.currentTarget;
                                    const originalText = btn.innerHTML;
                                    btn.innerHTML = "SAVING...";
                                    btn.style.opacity = "0.5";
                                    btn.style.pointerEvents = "none";

                                    let baseVal = parseInt((document.getElementById(`xp-${sub.id}`) as HTMLInputElement).value) || 0;
                                    let bonusVal = parseInt((document.getElementById(`bonus-${sub.id}`) as HTMLInputElement).value) || 0;
                                    const noteVal = (document.getElementById(`note-${sub.id}`) as HTMLInputElement).value;
                                    
                                    if (baseVal > remainingBase) baseVal = remainingBase;
                                    if (bonusVal > maxBonus) bonusVal = maxBonus;

                                    await handleAwardXP(sub, baseVal, bonusVal, noteVal);

                                    btn.innerHTML = originalText;
                                    btn.style.opacity = "1";
                                    btn.style.pointerEvents = "auto";
                                  }}
                                  className="w-full py-4 bg-white/5 hover:bg-amber-500 text-slate-300 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-1 border border-white/10 hover:border-amber-500"
                               >
                                 <CheckCircle2 size={16}/> Submit Evaluation
                               </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- RENDER MODALS --- */}
      <MediaDesk isOpen={isMediaModalOpen} onClose={() => setIsMediaModalOpen(false)} />
      
      <RoleSwitcherModal isOpen={isRoleSwitcherOpen} onClose={() => setIsRoleSwitcherOpen(false)} />

    </div>
  );
}