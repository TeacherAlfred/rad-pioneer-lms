"use client";

import { useState, useEffect } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import PioneerXPBar from "@/components/ui/PioneerXPBar";
import { UserCheck, Loader2, ArrowUpRight, Zap, BarChart3, BookOpen, ChevronLeft, User, Gift, Check, Rocket, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import LaunchCountdownBanner from "@/components/dashboard/LaunchCountdownBanner";
import XpEventModal from "@/components/dashboard/XpEventModal";
import MissionBriefingModal from "@/components/dashboard/MissionBriefingModal";
import ActiveCourseCard from "@/components/dashboard/ActiveCourseCard";

// --- NEW IMPORTS ---
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import NextMissionWidget from "@/components/dashboard/NextMissionWidget";
import EmptyCourseState from "@/components/dashboard/EmptyCourseState";

export default function DashboardPage() {
  const {
    loading, userProfile, metadata, allEnrollments, nextLiveSession,
    completionStats, todayXP, progressStats, dailyClaimed, isClaiming,
    handleClaimDaily, handleDisableGuide, timeLeft
  } = useStudentDashboard();

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showXpEventModal, setShowXpEventModal] = useState(false);

  const isLmsOnly = !metadata?.account_tier || metadata.account_tier !== 'full';
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

  // --- NEW: SKELETON LOADER INSTEAD OF FULL SCREEN SPINNER ---
  if (loading) return <DashboardClientWrapper initialStats={{}}><DashboardSkeleton isPreLaunchLms={isPreLaunchLms} /></DashboardClientWrapper>;

  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = { xp: currentXP, level: isEngineer ? 2 : 1, currentLevel: { name: isEngineer ? "Engineer" : "Technician", floor: isEngineer ? 1000 : 0 }, nextLevel: { xpRequired: 2500 } };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className={`min-h-screen relative overflow-hidden text-left bg-[#020617] ${isPreLaunchLms ? '' : 'lg:mr-80'}`}>
        
        <XpEventModal isOpen={showXpEventModal} onClose={closeXpModal} timeLeft={timeLeft} />

        <div className="max-w-4xl lg:max-w-5xl mx-auto p-4 sm:p-6 md:p-12 space-y-8 md:space-y-10 relative z-10 pb-12 md:pb-20">
          
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

          {/* --- NEW: ELEVATED NEXT MISSION WIDGET --- */}
          {!isPreLaunchLms && (
            <NextMissionWidget nextLiveSession={nextLiveSession} teacher={metadata?.teacher} />
          )}

          {/* --- CLEANED UP: JUST THE RANK HUD --- */}
          <section className="bg-[#0f172a]/90 backdrop-blur-xl rounded-[32px] md:rounded-[40px] border border-white/10 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
            <Rocket className="absolute -right-8 -top-8 w-64 h-64 text-white/[0.02] -rotate-12 pointer-events-none" />
            
            <div className="relative z-10 p-6 md:p-8">
              <PioneerXPBar xp={currentXP} todayXP={todayXP} rankName={stats.currentLevel.name} floor={stats.currentLevel.floor} ceiling={stats.nextLevel.xpRequired} />
            </div>
          </section>

          {/* --- COURSES SECTION (WITH EMPTY STATE) --- */}
          <section className="space-y-6 md:space-y-8 pt-4 md:pt-6">
            <div className="flex items-center justify-between px-2 md:px-4 border-b border-white/5 pb-3 md:pb-4">
              <div className="flex items-center gap-2.5 md:gap-3">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                <h3 className="text-sm md:text-base font-black uppercase tracking-widest text-white italic text-left">Your Current Course</h3>
              </div>
              
              {allEnrollments.length > 0 && (
                <Link href="/student/courses" className="group flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 md:px-6 py-2 md:py-2.5 rounded-xl border border-blue-400/50 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] active:scale-95">
                  View All Courses <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              )}
            </div>
            
            {/* --- NEW: EMPTY STATE FALLBACK --- */}
            {allEnrollments.length === 0 ? (
              <EmptyCourseState />
            ) : (
              <div className="space-y-6 md:space-y-8">
                {allEnrollments.map((enrollment) => (
                  <ActiveCourseCard key={enrollment.course_id} enrollment={enrollment} progressStats={progressStats} isPreLaunchLms={isPreLaunchLms} />
                ))}
              </div>
            )}
          </section>

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