"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen } from "lucide-react";

interface BookCloseMomentProps {
  isOpen: boolean;
  coverKey: string | null;
  title: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 3200;

export default function BookCloseMoment({ isOpen, coverKey, title, onDismiss }: BookCloseMomentProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [isOpen, onDismiss]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onDismiss}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-md cursor-pointer"
        >
          <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <motion.div
              initial={{ scale: 1.08, opacity: 0, rotateX: 0 }}
              animate={{
                scale: [1.08, 1, 1, 0.94],
                opacity: [0, 1, 1, 1],
                rotateX: [0, 0, 0, 18],
              }}
              transition={{ duration: 2.2, times: [0, 0.2, 0.65, 1], ease: "easeInOut" }}
              style={{ perspective: 800, transformOrigin: "center bottom" }}
              className="w-40 h-56 rounded-lg overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] bg-slate-100"
            >
              {coverKey ? (
                <img src={`/api/storage/cover?key=${encodeURIComponent(coverKey)}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <BookOpen size={32} />
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6, ease: "easeOut" }}
              className="w-40 h-[2px] mt-5 bg-gradient-to-r from-transparent via-brass-400 to-transparent"
            />

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              className="mt-5 text-center"
            >
              <p className="font-display italic text-2xl text-white mb-1">Finished</p>
              <p className="font-precision text-xs text-white/70 max-w-xs truncate">{title}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
