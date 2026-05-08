import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MonitorPlay, X, AlertTriangle } from "lucide-react";

export default function MissionBriefingModal({ isOpen, onClose, onDisableGuide }: any) {
  const [isConfirmingDisable, setIsConfirmingDisable] = useState(false);

  const handleClose = () => {
    setIsConfirmingDisable(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md" 
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-[24px] md:rounded-[40px] overflow-hidden shadow-2xl"
          >
            <div className="p-5 md:p-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="p-1.5 md:p-2 bg-blue-500/20 rounded-lg md:rounded-xl border border-blue-500/30">
                  <MonitorPlay className="text-blue-400 w-4 h-4 md:w-6 md:h-6" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-black text-white uppercase italic tracking-tighter leading-none">Mission Briefing</h3>
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1">Interface Calibration Guide</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-slate-500 hover:text-white transition-colors p-2">
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="aspect-video bg-black relative">
              <iframe 
                className="w-full h-full"
                src="https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1" 
                title="Pioneer Dashboard Walkthrough"
                allowFullScreen
              />
            </div>

            <div className="p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 bg-white/[0.02]">
              <p className="text-slate-400 text-xs md:text-sm font-medium italic text-center md:text-left">Calibration recommended for all Pioneers.</p>
              
              {!isConfirmingDisable ? (
                <button 
                  onClick={() => setIsConfirmingDisable(true)}
                  className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  Don't show this again
                </button>
              ) : (
                <div className="flex w-full md:w-auto items-center justify-center gap-2 md:gap-3">
                  <button 
                    onClick={() => setIsConfirmingDisable(false)}
                    className="px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-500 hover:text-white flex-1 md:flex-none text-center"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={onDisableGuide}
                    className="px-4 md:px-8 py-3 md:py-4 bg-red-500/10 border border-red-500/40 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5 md:gap-2 flex-1 md:flex-none"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4" /> Sure?
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}