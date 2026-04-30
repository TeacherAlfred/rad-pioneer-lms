"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ParentDashboard from "@/components/ParentDashboard"; 
import { Loader2, LogOut, ShieldCheck, Bell, Lock, ShieldAlert, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function ParentDashboardPage() {
  const router = useRouter();
  const [parentId, setParentId] = useState<string | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<string>(""); 
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // FOMO Timer State
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
          router.push("/");
          return;
        }

        // Fetch parent ID and their specific payment plan
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, payment_plan_preference")
          .eq("auth_user_id", session.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          router.push("/");
          return;
        }

        setParentId(profile.id);
        setPaymentPlan(profile.payment_plan_preference || "Standard");
      } catch (error) {
        console.error("Critical session error:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [router]);

  // FOMO Countdown Timer Logic
  useEffect(() => {
    const targetDate = new Date("2026-05-01T10:00:00+02:00").getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Real-time Notification Listener
  useEffect(() => {
    if (!parentId) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('coach_messages')
        .select('*', { count: 'exact', head: true })
        .eq('guardian_id', parentId)
        .eq('is_read', false)
        .neq('sender_id', parentId);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase.channel('parent_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_messages', filter: `guardian_id=eq.${parentId}` }, () => {
         fetchUnread(); 
      }).subscribe();

    const handleClear = () => setUnreadCount(0);
    window.addEventListener('messagesRead', handleClear);

    return () => { 
      supabase.removeChannel(channel); 
      window.removeEventListener('messagesRead', handleClear);
    };
  }, [parentId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-green-500" size={40} />
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Initializing Portal...</p>
      </div>
    );
  }

  if (!parentId) return null; 

  // --- Identify if they should see the Launch Sequence ---
  const isRestrictedPlan = paymentPlan.toLowerCase().includes('lms') || paymentPlan.toLowerCase().includes('trial');
  const isPreLaunchLms = isRestrictedPlan && new Date() < new Date("2026-05-01T10:00:00+02:00");

  const TimeUnit = ({ label, value }: { label: string, value: number }) => (
    <div className="bg-black/60 border border-amber-500/20 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center shadow-inner relative overflow-hidden group w-full">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="text-4xl md:text-6xl font-black italic tracking-tighter text-amber-500 leading-none drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[9px] md:text-xs font-black text-amber-500/50 uppercase tracking-[0.2em] mt-2">
        {label}
      </span>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30 flex flex-col">
      <header className="border-b border-white/10 bg-[#0f172a]/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black uppercase italic tracking-tighter">
            RAD <span className="text-green-500">Parent</span> Dashboard
          </h1>
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
            <ShieldCheck size={12} className="text-green-500" />
            <span className="text-[10px] font-bold uppercase text-green-500 tracking-wider">
              {paymentPlan.includes("LMS Access") ? paymentPlan : "Secure Access"}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative p-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer shadow-sm">
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-[#0f172a] shadow-lg animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all bg-white/5 px-4 py-2 rounded-xl border border-white/5 hover:border-white/10"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      {/* Center the content vertically if locked, otherwise standard padding */}
      <div className={`flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full ${isPreLaunchLms ? 'flex flex-col items-center justify-center' : ''}`}>
         
         {isPreLaunchLms ? (
            /* =========================================
               MASSIVE FOMO COUNTDOWN (LMS / TRIAL ONLY)
               ========================================= */
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-amber-900/40 via-[#020617] to-[#020617] border border-amber-500/30 rounded-[32px] md:rounded-[48px] p-8 md:p-12 relative overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col items-center text-center w-full max-w-4xl"
            >
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse shadow-[0_0_20px_rgba(245,158,11,1)]" />
              
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-20 h-20 md:w-24 md:h-24 bg-amber-500/10 border border-amber-500/40 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.2)] mb-6"
              >
                <Lock size={40} className="text-amber-400" />
              </motion.div>

              <h2 className="text-[10px] md:text-[12px] font-black text-amber-500 uppercase tracking-[0.3em] mb-3 flex items-center justify-center gap-2">
                <ShieldAlert size={16} /> Premium Access Secured
              </h2>
              <h3 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-md mb-8">
                Global Launch Sequence <br className="hidden md:block"/> Initiated
              </h3>

              <div className="grid grid-cols-4 gap-2 md:gap-6 w-full mb-8">
                <TimeUnit label="Days" value={timeLeft.days} />
                <TimeUnit label="Hours" value={timeLeft.hours} />
                <TimeUnit label="Minutes" value={timeLeft.minutes} />
                <TimeUnit label="Seconds" value={timeLeft.seconds} />
              </div>

              <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 p-5 md:p-6 rounded-2xl w-full text-left relative overflow-hidden mt-6">
                <Zap className="absolute -right-4 -bottom-4 w-24 h-24 text-amber-500/10" />
                <div className="relative z-10">
                  <span className="px-3 py-1 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest rounded mb-3 inline-block">
                    Priority Objective
                  </span>
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-amber-100 leading-relaxed">
                      The first 50 students to log in and finish one activity during the launch week will receive an exclusive <span className="text-amber-400 font-black">500 XP Head Start Bonus.</span>
                    </p>
                    <p className="text-sm font-bold text-amber-100 leading-relaxed border-t border-amber-500/20 pt-3">
                      <span className="text-amber-400 font-black uppercase tracking-widest text-[10px] block mb-1">Weekend Leaderboard Bonus:</span>
                      The top 3 students with the highest XP by  <span className="text-green-500 font-black">Friday 8 May at 23:59</span> will each win <span className="text-amber-400 font-black">2x 1-on-1 Online RAD Lessons!</span>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
         ) : (
            /* =========================================
               STANDARD DASHBOARD FOR UNLOCKED USERS
               ========================================= */
            <ParentDashboard parentId={parentId} paymentPlan={paymentPlan} />
         )}

      </div>
      
      <footer className="py-10 text-center border-t border-white/5 mt-auto shrink-0">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">
          RAD Academy HQ &copy; {new Date().getFullYear()} | Redefining African Dreams
        </p>
      </footer>
    </main>
  );
}