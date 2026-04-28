"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, UserPlus, BookOpen, Activity, AlertCircle, 
  CheckCircle2, CreditCard, ChevronRight, Loader2, 
  Target, TrendingUp, DollarSign, Clock, X, ArrowUpRight,
  ShieldCheck, LayoutDashboard, Zap, Briefcase, ArrowRight, LogOut,
  GraduationCap, Eye, Bell, CalendarDays, Building2, Send, 
  Inbox, Calculator, Key
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Dashboard UI State
  const [selectedStat, setSelectedStat] = useState<null | string>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<'overview' | 'leads' | 'finance' | 'learning'>('overview');
  const [activeSectorTab, setActiveSectorTab] = useState<'growth' | 'core' | 'admin'>('growth');

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
    // Growth Engine Specific
    invitesSent: 0,
    trialsActive: 0,
    trialsConverted: 0,
    expiredUnclaimed: 0
  });

  useEffect(() => {
    fetchHeartbeat();
  }, []);

  // Real-time Notification Listener (Admin Scope)
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

  async function fetchHeartbeat() {
    setLoading(true);
    try {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
      if (profile) setCurrentUser(profile);

      // 1. Academy Stats
      const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const { count: requestCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'new');
      
      // 2. Revenue Stats
      const { data: paidRecords } = await supabase.from('billing_records').select('total_amount').in('status', ['paid', 'settled']);
      const totalRevenue = paidRecords?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;
      
      // 3. Lead & Conversion Logic
      const { data: prospectStats } = await supabase.from('prospects').select('*');
      
      const total = prospectStats?.length || 0;
      const won = prospectStats?.filter(p => p.status === 'Converted (Won)').length || 0;
      const actualConvRate = total > 0 ? Math.round((won / total) * 100) : 0;

      // 4. Growth Engine / Invite Logic
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

  const handleLogout = async () => {
    localStorage.removeItem("pioneer_session");
    await supabase.auth.signOut();
    router.push("/login");
  };

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

  // Grouped Sectors Data
  const groupedSectors = {
    growth: {
      title: "Growth & Acquisition",
      desc: "Manage top-of-funnel leads, invites, and external campaigns.",
      items: [
        { label: 'Lead Inbox', icon: Inbox, path: '/admin/leads', color: 'hover:border-blue-500' },
        { label: 'New Intake', icon: UserPlus, path: '/admin/intake', color: 'hover:border-blue-400' },
        { label: 'Invite Campaigns', icon: Send, path: '/admin/invites', color: 'hover:border-purple-500' },
        { label: 'General Prospects', icon: Target, path: '/admin/prospects', color: 'hover:border-fuchsia-500' },
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
        { label: 'Pioneer Ledger', icon: Users, path: '/admin/pioneers', color: 'hover:border-emerald-400' },
        { label: 'Student Hub', icon: GraduationCap, path: '/admin/student', color: 'hover:border-cyan-400' },
        { label: 'Parent Portals', icon: Eye, path: '/admin/parents', color: 'hover:border-pink-500' },
        { label: 'Teacher Portal', icon: LayoutDashboard, path: '/teacher/dashboard', color: 'hover:border-orange-400' },
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
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans overflow-x-hidden text-left">
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
            
            {/* PROMINENT INVITE BUTTON */}
            <Link 
              href="/admin/invites" 
              className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center gap-2 group"
            >
              <Send size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Invite Leads
            </Link>

            <Link href="/admin/leads" className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
              Inbox <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded-full text-white">{stats.pendingRequests}</span>
            </Link>
            
            <div className="w-px h-10 bg-white/10 mx-2 hidden md:block" />

            {/* NOTIFICATION BELL */}
            <Link href="/admin/communications" className="relative p-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-2xl transition-all shadow-sm">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-[#0f172a] shadow-lg animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>

            <button 
              onClick={handleLogout} 
              className="p-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-all"
              title="Log Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* TABBED METRICS SECTION */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 bg-[#0f172a] p-1.5 rounded-2xl border border-white/10 w-fit">
            <button 
              onClick={() => setActiveMetricTab('overview')} 
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeMetricTab === 'overview' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              General Overview
            </button>
            <button 
              onClick={() => setActiveMetricTab('leads')} 
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${activeMetricTab === 'leads' ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Target size={12}/> Leads Engine
            </button>
            <button 
              onClick={() => setActiveMetricTab('finance')} 
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${activeMetricTab === 'finance' ? 'bg-emerald-600/20 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <DollarSign size={12}/> Finance Engine
            </button>
            <button 
              onClick={() => setActiveMetricTab('learning')} 
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${activeMetricTab === 'learning' ? 'bg-fuchsia-600/20 text-fuchsia-400 shadow-sm border border-fuchsia-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <BookOpen size={12}/> Learning Engine
            </button>
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
            <div className="flex bg-[#0f172a] p-1.5 rounded-2xl border border-white/10 w-fit">
              <button 
                onClick={() => setActiveSectorTab('growth')} 
                className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSectorTab === 'growth' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Growth & Acquisition
              </button>
              <button 
                onClick={() => setActiveSectorTab('core')} 
                className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSectorTab === 'core' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Core Operations
              </button>
              <button 
                onClick={() => setActiveSectorTab('admin')} 
                className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSectorTab === 'admin' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Admin & Infrastructure
              </button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeSectorTab}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                >
                  <div className="mb-8">
                    <h3 className="text-xl font-black italic uppercase text-white tracking-tight">{groupedSectors[activeSectorTab].title}</h3>
                    <p className="text-slate-500 text-xs mt-1 font-medium">{groupedSectors[activeSectorTab].desc}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {groupedSectors[activeSectorTab].items.map((item, i) => (
                      <Link key={i} href={item.path} className={`p-5 bg-[#0f172a] border border-transparent hover:bg-white/5 rounded-[24px] transition-all flex flex-col gap-4 group ${item.color}`}>
                        <item.icon size={20} className="text-slate-500 group-hover:text-white transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                      </Link>
                    ))}
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

      {/* STAT DETAIL MODAL (Deep Dive Info) */}
      <AnimatePresence>
        {selectedStat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedStat(null); }} 
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all z-50 relative"
                >
                  <X size={20}/>
                </button>
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
    </div>
  );
}