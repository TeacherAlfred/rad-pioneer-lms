"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminReturnBanner() {
  const [hasBackup, setHasBackup] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const backup = localStorage.getItem("admin_backup_session");
    setHasBackup(!!backup);
  }, [pathname]);

  const handleReturnToAdmin = () => {
    const backup = localStorage.getItem("admin_backup_session");
    if (backup) {
      localStorage.setItem("pioneer_session", backup);
      localStorage.removeItem("admin_backup_session");
      setHasBackup(false);
      window.location.href = "/admin/dashboard"; 
    }
  };

return (
  <AnimatePresence>
    {hasBackup && (
      <motion.div 
        initial={{ y: 100, x: "-50%", opacity: 0 }}
        animate={{ y: 0, x: "-50%", opacity: 1 }}
        exit={{ y: 100, x: "-50%", opacity: 0 }}
        style={{ left: "50%", zIndex: 2147483647 }} // Browser maximum z-index
        className="fixed bottom-8 w-[90%] max-w-sm pointer-events-auto"
      >
        {/* Shadow and Ring increased for better separation on white backgrounds */}
        <div className="bg-slate-950 text-white px-5 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)] border border-white/10 ring-8 ring-black/10">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <ShieldAlert size={20} className="animate-pulse text-violet-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400 leading-none">
                Admin Session
              </span>
              <span className="text-[11px] text-slate-400 font-bold mt-1">
                Active Impersonation
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleReturnToAdmin}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shrink-0 active:scale-95"
          >
            <ArrowLeft size={14} /> Exit
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
}