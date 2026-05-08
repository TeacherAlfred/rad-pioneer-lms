"use client";

import { useState, useEffect } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { UserCheck, Loader2, ArrowUpRight, Zap, BarChart3, BookOpen, ChevronLeft, User, Calendar, MapPin, Video, Mail, MessageCircle, Shield, Gift, Check, Rocket, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

// --- THE GREAT DECOUPLING ---
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import LaunchCountdownBanner from "@/components/dashboard/LaunchCountdownBanner";
import XpEventModal from "@/components/dashboard/XpEventModal";
import MissionBriefingModal from "@/components/dashboard/MissionBriefingModal";
import ActiveCourseCard from "@/components/dashboard/ActiveCourseCard";

export default function DashboardPage() {
  // 1. DATA HOOK
  const {
    loading, userProfile, metadata, allEnrollments, nextLiveSession,
    completionStats, todayXP, progressStats, dailyClaimed, isClaiming,
    handleClaimDaily, handleDisableGuide, timeLeft
  } = useStudentDashboard();

  // 2. LOCAL UI STATE
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showXpEventModal, setShowXpEventModal] = useState(false);

  const isLmsOnly = !metadata.account_tier || metadata.account_tier !== 'full';
  const isPreLaunchLms = isLmsOnly && new Date() < new Date("2026-05-08T23:59:59+02:00");

  useEffect(() => {
    if (!loading && !isLmsOnly) {
      const hasSeenEvent = sessionStorage.getItem("xp_event_may_2026");
      if (!hasSeenEvent) {
        const timer = setTimeout(() => setShowXpEventModal(true), 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, isLmsOnly]);

  const closeXpModal = () => {
    setShowXpEventModal(false);
    sessionStorage.setItem("xp_event_may_2026", "true");
  };

  const executeDisableGuide = async () => {
    const success = await handleDisableGuide();
    if (success) setShowGuideModal(false);
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = { xp: currentXP, level: isEngineer ? 2 : 1, currentLevel: { name: isEngineer ? "Engineer" : "Technician", floor: isEngineer ? 1000 : 0 }, nextLevel: { xpRequired: 2500 } };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className={`min-h-screen relative overflow-hidden text-left bg-[#020617] ${isPreLaunchLms ? '' : 'lg:mr-80'}`}>
        
        <XpEventModal isOpen={showXpEventModal} onClose={closeXpModal} timeLeft={timeLeft} />

        <div className="max-w-4xl lg:max-w-5xl mx-auto p-4 sm:p-6 md:p-12 space-y-8 md:space-y-12 relative z-10 pb-12 md:pb-20">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6 border-b border-white/5 pb-6 md:pb-8">
            <div className="space-y-2 md:space-y-3 text-left">
              <div className="flex items-center gap-2 text-[#45a79a]">
                <UserCheck size={14} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Online</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-[0.9] md:leading-none break-words">
                Welcome back, <br className="md:hidden" />
                <span className="text-blue-400">{userProfile?.display_name?.split(' ')[0] || "Pioneer"}!</span>
              </h1>
              
              <div className="pt-2">
                {!dailyClaimed ? (
                  <motion.button 
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                    onClick={handleClaimDaily} disabled={isClaiming}
                    className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-yellow-300"
                  >
                    {isClaiming ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
                    Claim Daily +10 XP!
                  </motion.button>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs">
                    <Check size={16} /> Daily XP Secured
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex-1 md:flex-none bg-white/5 p-4 md:px-6 md:py-4 rounded-[20px] md:rounded-3xl border border-white/10 flex items-center justify-between md:justify-start md:gap-4 shadow-xl">
                <div className="text-left md:text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total_XP</p>
                  <p className="text-xl md:text-2xl font-black text-white italic leading-none">{currentXP}</p>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shrink-0">
                  <Zap size={16} fill="currentColor" className="md:w-5 md:h-5" />
                </div>
              </div>
              <div className="flex-1 md:flex-none bg-white/5 p-4 md:px-6 md:py-4 rounded-[20px] md:rounded-3xl border border-white/10 flex items-center justify-between md:justify-start md:gap-4 shadow-xl">
                <div className="text-left md:text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Missions</p>
                  <p className="text-xl md:text-2xl font-black text-white italic leading-none">{completionStats.completed}/{completionStats.total}</p>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
                  <BarChart3 size={16} className="md:w-5 md:h-5" />
                </div>
              </div>
            </div>
          </header>

          {isPreLaunchLms && <LaunchCountdownBanner timeLeft={timeLeft} />}

          <section className="bg-[#0f172a]/90 backdrop-blur-xl rounded-[32px] md:rounded-[40px] border border-white/10 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
            <Rocket className="absolute -right-8 -top-8 w-64 h-64 text-white/[0.02] -rotate-12 pointer-events-none" />
            
            <div className="relative z-10 p-6 md:p-8">
              <PioneerXPBar xp={currentXP} todayXP={todayXP} rankName={stats.currentLevel.name} floor={stats.currentLevel.floor} ceiling={stats.nextLevel.xpRequired} />
            </div>

            {(metadata?.teacher || nextLiveSession) && (
              <div className="relative z-10 bg-black/40 border-t border-white/5 p-4 md:p-6 flex flex-col xl:flex-row gap-4">
                
                {nextLiveSession && (
                  <div className="flex-1 relative overflow-hidden bg-amber-950/40 border border-amber-500/50 hover:border-amber-400 transition-all rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-[0_0_40px_rgba(245,158,11,0.25)]">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 via-orange-500/10 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="relative flex h-3.5 w-3.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,1)]"></span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-0.5 drop-shadow-md">Next Mission Drop</p>
                        <p className="text-sm md:text-lg font-black text-white tracking-tight">
                          {new Date(nextLiveSession.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} 
                          <span className="text-amber-500/50 mx-1.5">/</span> 
                          <span className="text-amber-100">{new Date(nextLiveSession.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    </div>
                    <div className="relative z-10 shrink-0">
                      {nextLiveSession.type === 'in-person' ? (
                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                          <MapPin size={14} className="shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{nextLiveSession.location}</span>
                        </div>
                      ) : nextLiveSession.link ? (
                        <a href={nextLiveSession.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-300">
                          <Video size={16} className="shrink-0" />
                          <span className="text-[11px] font-black uppercase tracking-widest">Join Meet</span>
                        </a>
                      ) : (
                        <div className="inline-flex items-center gap-2 bg-black/40 border border-amber-500/30 text-amber-500/70 px-4 py-2 rounded-xl cursor-not-allowed">
                          <Video size={14} className="shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Link Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {metadata.teacher && (
                  <div className="xl:w-1/3 shrink-0 bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400 mb-1 flex items-center gap-1.5">
                        <Shield size={12}/> Your Teacher
                      </p>
                      <p className="text-sm md:text-base font-bold text-white truncate">{metadata.teacher.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {metadata.teacher.email && (
                        <a href={`mailto:${metadata.teacher.email}`} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-sm"><Mail size={14} /></a>
                      )}
                      {metadata.teacher.whatsapp && (
                        <a href={`https://wa.me/${metadata.teacher.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:text-green-300 transition-all"><MessageCircle size={14} /></a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {allEnrollments.length > 0 && (
            <section className="space-y-6 md:space-y-8 pt-4 md:pt-6">
              <div className="flex items-center justify-between px-2 md:px-4 border-b border-white/5 pb-3 md:pb-4">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  <h3 className="text-sm md:text-base font-black uppercase tracking-widest text-white italic text-left">Your Current Course</h3>
                </div>
                <Link href="/student/courses" className="group flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 md:px-6 py-2 md:py-2.5 rounded-xl border border-blue-400/50 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] active:scale-95">
                  View All Courses <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
              
              <div className="space-y-6 md:space-y-8">
                {allEnrollments.map((enrollment) => (
                  <ActiveCourseCard key={enrollment.course_id} enrollment={enrollment} progressStats={progressStats} isPreLaunchLms={isPreLaunchLms} />
                ))}
              </div>
            </section>
          )}

          <footer className="mt-12 md:mt-20 border-t border-white/5 pt-8 md:pt-10 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy" width={80} height={26} className="opacity-50" unoptimized />
               <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Pioneer Interface</span>
             </div>
             <p className="text-[8px] md:text-[9px] font-bold text-slate-600 uppercase tracking-widest">© 2026 RAD Academy. All Systems Nominal.</p>
          </footer>
        </div>
      </main>

      <MissionBriefingModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} onDisableGuide={executeDisableGuide} />

      {!isPreLaunchLms && (
        <>
          <div className="hidden lg:block"><ProfileSidebar /></div>
          {!isMobileSidebarOpen && (
            <div className="lg:hidden fixed top-1/2 right-0 -translate-y-1/2 z-40">
              <button onClick={() => setIsMobileSidebarOpen(true)} className="flex items-center justify-center p-3 pl-4 bg-blue-600/20 backdrop-blur-xl border border-r-0 border-blue-500/30 rounded-l-2xl shadow-[-5px_0_20px_rgba(59,130,246,0.15)] text-blue-400 hover:text-white transition-all group">
                <div className="flex flex-col items-center gap-1"><ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /><User size={18} /></div>
              </button>
            </div>
          )}
          <AnimatePresence>
            {isMobileSidebarOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileSidebarOpen(false)} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm lg:hidden" />
                <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed top-0 right-0 bottom-0 z-[110] w-[85%] max-w-sm bg-[#0f172a] shadow-2xl border-l border-white/10 lg:hidden flex flex-col">
                  <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Pioneer Status</span>
                    <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar relative"><ProfileSidebar /></div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
    </DashboardClientWrapper>
  );
}