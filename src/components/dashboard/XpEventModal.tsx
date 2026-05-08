import { motion, AnimatePresence } from "framer-motion";
import { Zap, X } from "lucide-react";

export default function XpEventModal({ isOpen, onClose, timeLeft }: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 relative z-50 shadow-[0_0_20px_rgba(245,158,11,0.3)] border-b border-amber-400/50 overflow-hidden"
        >
          <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 md:px-12 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black/20 rounded-full flex items-center justify-center shrink-0">
                <Zap size={16} className="text-amber-100 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest italic leading-tight">Double XP Week!</h3>
                <p className="text-[10px] text-amber-100 font-bold uppercase tracking-widest mt-0.5">Special LMS Launch Event</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-black/20 px-4 py-1.5 rounded-full border border-black/10">
              <div className="flex gap-2 text-white font-black italic text-xs md:text-sm tracking-widest">
                <span>{timeLeft.days.toString().padStart(2, '0')}d</span><span className="text-amber-300 opacity-50">:</span>
                <span>{timeLeft.hours.toString().padStart(2, '0')}h</span><span className="text-amber-300 opacity-50">:</span>
                <span>{timeLeft.minutes.toString().padStart(2, '0')}m</span><span className="text-amber-300 opacity-50">:</span>
                <span>{timeLeft.seconds.toString().padStart(2, '0')}s</span>
              </div>
            </div>

            <button onClick={onClose} className="absolute sm:relative right-4 top-4 sm:right-auto sm:top-auto text-amber-200 hover:text-white transition-colors p-1 bg-black/10 rounded-full sm:bg-transparent sm:p-0">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}