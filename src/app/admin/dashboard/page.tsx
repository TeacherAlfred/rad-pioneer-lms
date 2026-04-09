"use client";

import { useEffect, useState } from "react";
import { 
  Users, UserPlus, BookOpen, Activity, AlertCircle, 
  CheckCircle2, CreditCard, ChevronRight, Loader2, 
  Target, TrendingUp, DollarSign, Clock, X, ArrowUpRight,
  ShieldCheck, LayoutDashboard, Zap, Briefcase, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState<null | string>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingRequests: 0,
    monthlyRevenue: 0,
    activeLeads: 0,
    conversionRate: 0,
    growthMoM: 12.5,
    newLeads: 0,
    warmLeads: 0,
    wonProspects: 0
  });

  useEffect(() => {
    fetchHeartbeat();
  }, []);

  async function fetchHeartbeat() {
    setLoading(true);
    try {
      // 1. Academy Stats
      const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const { count: requestCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'new');
      
      // 2. Revenue Stats
      const { data: paidRecords } = await supabase.from('billing_records').select('total_amount').in('status', ['paid', 'settled']);
      const totalRevenue = paidRecords?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;
      
      // 3. Lead & Conversion Logic
      const { data: prospectStats } = await supabase.from('prospects').select('status');
      
      const total = prospectStats?.length || 0;
      const won = prospectStats?.filter(p => p.status === 'Converted (Won)').length || 0;
      // Actual Conversion Rate Calculation
      const actualConvRate = total > 0 ? Math.round((won / total) * 100) : 0;

      setStats(prev => ({
        ...prev,
        totalStudents: studentCount || 0,
        pendingRequests: requestCount || 0,
        monthlyRevenue: totalRevenue,
        activeLeads: prospectStats?.filter(p => !['Lost', 'Converted (Won)'].includes(p.status)).length || 0,
        newLeads: prospectStats?.filter(p => p.status === 'New Lead').length || 0,
        warmLeads: prospectStats?.filter(p => p.status === 'Warm (Pending Close)').length || 0,
        wonProspects: won,
        conversionRate: actualConvRate
      }));
    } catch (err) {
      console.error("HEARTBEAT_FAILURE:", err);
    } finally {
      setLoading(false);
    }
  }

  const StatCard = ({ label, value, icon: Icon, color, id }: any) => (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={() => setSelectedStat(id)}
      className="cursor-pointer bg-[#0f172a] border border-white/10 p-6 rounded-[32px] relative overflow-hidden group transition-all hover:border-blue-500/50"
    >
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-3 rounded-2xl bg-white/5 ${color}`}>
          <Icon size={24} />
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
          <TrendingUp size={12} /> {stats.growthMoM}%
        </div>
      </div>
      <div className="mt-6 relative z-10">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
        <h4 className="text-4xl font-black italic mt-1 tracking-tighter">{value}</h4>
      </div>
      <Icon className={`absolute -right-6 -bottom-6 size-32 opacity-[0.03] ${color} group-hover:opacity-10 transition-opacity`} />
    </motion.div>
  );

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Syncing_Operations...</span>
    </div>
  );

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
          <div className="flex gap-3">
            <Link href="/admin/leads" className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
              Inbox <span className="ml-2 px-2 py-0.5 bg-blue-600 rounded-full text-white">{stats.pendingRequests}</span>
            </Link>
            <Link href="/admin/intake" className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-900/20">
              New Intake
            </Link>
          </div>
        </header>

        {/* HEARTBEAT GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard id="revenue" label="Total Revenue" value={`R${stats.monthlyRevenue.toLocaleString()}`} icon={DollarSign} color="text-emerald-400" />
          <StatCard id="pioneers" label="Active Pioneers" value={stats.totalStudents} icon={Users} color="text-blue-400" />
          <StatCard id="leads" label="Active Leads" value={stats.activeLeads} icon={Target} color="text-fuchsia-400" />
          <StatCard id="growth" label="Conversion Rate" value={`${stats.conversionRate}%`} icon={TrendingUp} color="text-orange-400" />
        </div>

        {/* SECTORS HUB */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-[40px] p-10 flex flex-col justify-between min-h-[400px]">
            <div>
              <h3 className="text-2xl font-black italic uppercase mb-2">Active_Sectors</h3>
              <p className="text-slate-500 text-sm mb-8">Direct access to core business management modules.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'LMS Academy', icon: BookOpen, path: '/admin/courses', color: 'hover:border-blue-500' },
                  { label: 'Pioneer Ledger', icon: Users, path: '/admin/pioneers', color: 'hover:border-purple-500' },
                  { label: 'CRM Database', icon: Users, path: '/admin/directory', color: 'hover:border-purple-500' },
                  { label: 'Finance Hub', icon: CreditCard, path: '/admin/finance', color: 'hover:border-emerald-500' },
                  { label: 'Growth Plan', icon: LayoutDashboard, path: '/admin/blueprint', color: 'hover:border-fuchsia-500' },
                  { label: 'Comms Center', icon: Activity, path: '/admin/communications', color: 'hover:border-orange-500' },
                  { label: 'Master Data', icon: Briefcase, path: '/admin/contacts', color: 'hover:border-slate-500' },
                ].map((item, i) => (
                  <Link key={i} href={item.path} className={`p-6 bg-white/5 border border-transparent rounded-[32px] transition-all flex flex-col gap-4 group ${item.color}`}>
                    <item.icon size={20} className="text-slate-400 group-hover:text-white" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-blue-600 rounded-[40px] p-10 flex flex-col justify-between relative overflow-hidden group">
            <ShieldCheck className="absolute -right-10 -bottom-10 size-64 opacity-20 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
            <div className="relative z-10 space-y-4">
              <h3 className="text-3xl font-black italic uppercase leading-tight mb-4">Security & <br/>System Health</h3>
              <div className="flex items-center gap-3 bg-black/20 p-4 rounded-2xl backdrop-blur-md">
                <div className="size-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Database Stable</span>
              </div>
              <div className="flex items-center gap-3 bg-black/20 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-white font-black">{stats.pendingRequests}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100 text-white">Registrations Pending</span>
              </div>
            </div>
            <Link href="/admin/leads" className="relative z-10 w-full py-4 bg-white text-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center shadow-lg">
              Process Intake
            </Link>
          </div>
        </div>
      </div>

      {/* STAT DETAIL MODAL */}
      <AnimatePresence>
        {selectedStat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStat(null)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden">
              <Zap className="absolute -right-8 -top-8 size-48 opacity-[0.02] text-blue-500" />
              
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                  {selectedStat === 'revenue' ? 'Financial_Report' : 
                   selectedStat === 'pioneers' ? 'Pioneer_Metrics' : 
                   selectedStat === 'leads' ? 'Pipeline_Pulse' : 'Conversion_Stats'}
                </h2>
                {/* FUNCTIONAL X BUTTON */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedStat(null); }} 
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all z-50 relative"
                >
                  <X size={20}/>
                </button>
              </div>

              {selectedStat === 'leads' || selectedStat === 'growth' ? (
                <div className="space-y-4 mb-10">
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
                <div className="space-y-6 mb-10">
                  <div className="p-8 bg-white/5 rounded-3xl border border-white/10 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Operational Volume</p>
                    <p className="text-6xl font-black italic">
                      {selectedStat === 'revenue' ? `R${stats.monthlyRevenue.toLocaleString()}` : stats.totalStudents}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setSelectedStat(null)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:text-white text-slate-400">Close</button>
                <Link 
                  href={`/admin/${selectedStat === 'revenue' ? 'finance' : selectedStat === 'pioneers' ? 'directory' : 'prospects'}`}
                  className="flex-1 py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
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