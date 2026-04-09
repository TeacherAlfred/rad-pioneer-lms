"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle2, Gamepad2 } from "lucide-react";

interface SequenceCard {
  order: number;
  title: string;
  content: string;
  media_url?: string | null;
}

interface SequenceViewerProps {
  cards: SequenceCard[];
  onComplete: () => void;
  formatText?: (text: string) => string;
  onCardChange?: (content: string) => void;
}

export default function SequenceViewer({ cards, onComplete, formatText, onCardChange }: SequenceViewerProps) {
  // 1. Bulletproof Sorting: Always ensure cards are in the correct order
  const sortedCards = [...cards].sort((a, b) => a.order - b.order);
  
  // 2. State tracking
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for next, -1 for prev (for animation)

  const currentCard = sortedCards[currentIndex];
  const isFirstCard = currentIndex === 0;
  const isLastCard = currentIndex === sortedCards.length - 1;

  // Fire the scanner callback whenever the card changes
  useEffect(() => {
    if (onCardChange && currentCard) {
      onCardChange(currentCard.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.content]); // <-- FIX: Only run when the text changes!

  const handleNext = () => {
    if (!isLastCard) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete(); // Trigger the database update / XP reward!
    }
  };

  const handlePrev = () => {
    if (!isFirstCard) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Framer Motion animation variants for a smooth sliding effect
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 50 : -50,
      opacity: 0,
    }),
  };

  if (!cards || cards.length === 0 || !currentCard) {
    return <div className="p-8 text-center text-slate-500">No sequence data found.</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#0f172a] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
      
      {/* --- HEADER & PROGRESS BAR --- */}
      <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-purple-400">
            <Gamepad2 size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Active Mission Sequence</span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Card {currentIndex + 1} of {sortedCards.length}
          </span>
        </div>
        
        {/* Progress Track */}
        <div className="w-full h-2 bg-[#020617] rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / sortedCards.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* --- CARD CONTENT AREA --- */}
      <div className="flex-1 relative overflow-hidden p-6 md:p-12 flex items-center">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
          >
            <div className="flex flex-col md:flex-row gap-8 items-center">
              
              {/* Text Content */}
              <div className="flex-1 space-y-6">
                
                {/* UPDATED: We now format the title so words like "Micro:bit" get highlighted! */}
                <h2 
                  className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tight leading-none"
                  dangerouslySetInnerHTML={{ 
                    __html: formatText ? formatText(currentCard.title) : currentCard.title 
                  }}
                />

                <p 
                  className="text-base md:text-lg text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: formatText ? formatText(currentCard.content) : currentCard.content 
                  }}
                />
                
              </div>

              {/* Optional Media Area (GIF/Image) */}
              {currentCard.media_url && (
                <div className="flex-1 w-full max-w-sm rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#020617] aspect-video flex items-center justify-center">
                  <img 
                    src={currentCard.media_url} 
                    alt={currentCard.title} 
                    className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
                  />
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* --- NAVIGATION FOOTER --- */}
      <div className="p-6 md:p-8 border-t border-white/5 bg-white/[0.02] flex items-center justify-between gap-4">
        <button
          onClick={handlePrev}
          disabled={isFirstCard}
          className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <button
          onClick={handleNext}
          className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-xl ${
            isLastCard 
              ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/20" 
              : "bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/20"
          }`}
        >
          {isLastCard ? (
            <>Complete Section <CheckCircle2 size={16} /></>
          ) : (
            <>Next Card <ChevronRight size={16} /></>
          )}
        </button>
      </div>

    </div>
  );
}