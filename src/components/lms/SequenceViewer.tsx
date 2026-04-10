"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle2, Gamepad2, Maximize2, X } from "lucide-react";

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
  const sortedCards = [...cards].sort((a, b) => a.order - b.order);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); 
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const currentCard = sortedCards[currentIndex];
  const isFirstCard = currentIndex === 0;
  const isLastCard = currentIndex === sortedCards.length - 1;

  useEffect(() => {
    if (onCardChange && currentCard) {
      onCardChange(currentCard.content);
    }
  }, [currentCard?.content, onCardChange]); 

  const handleNext = () => {
    if (!isLastCard) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete(); 
    }
  };

  const handlePrev = () => {
    if (!isFirstCard) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // --- ELITE SMART MEDIA ENGINE ---
  const renderMedia = (url: string, title: string) => {
    if (!url) return null;
    
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i);
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

    if (isYouTube) {
      let embedUrl = url;
      if (url.includes("watch?v=")) embedUrl = url.replace("watch?v=", "embed/");
      if (url.includes("youtu.be/")) embedUrl = url.replace("youtu.be/", "youtube.com/embed/");
      
      return (
        <div className="w-full aspect-video rounded-[32px] overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] bg-black z-10 relative">
          <iframe src={embedUrl} className="w-full h-full object-cover border-none" allowFullScreen />
        </div>
      );
    }
    
    if (isVideo) {
      return (
        <div className="w-full aspect-video rounded-[32px] overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] bg-black z-10 relative">
          <video src={url} className="w-full h-full object-cover" controls autoPlay loop muted playsInline />
        </div>
      );
    }

    // PREMIUM IMAGE RENDERING (Reverted to full size lg:aspect-square for the card)
    return (
      <div 
        onClick={() => setExpandedImage(url)}
        className="relative w-full aspect-video lg:aspect-square flex items-center justify-center rounded-[32px] overflow-hidden group cursor-pointer"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
        
        <motion.img 
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          src={url} 
          alt={title} 
          className="relative z-10 w-full h-full object-cover sm:object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] p-6 transition-transform duration-500 group-hover:scale-105" 
        />

        <div className="absolute bottom-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-white shadow-lg">
          <Maximize2 size={16} />
        </div>
      </div>
    );
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0, scale: 0.98 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 40 : -40, opacity: 0, scale: 0.98 }),
  };

  if (!cards || cards.length === 0 || !currentCard) {
    return <div className="p-8 text-center text-slate-500">No sequence data found.</div>;
  }

  return (
    <>
      <div className="w-full max-w-5xl mx-auto bg-gradient-to-b from-[#0f172a] to-[#020617] rounded-[48px] border border-white/10 overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        
        {/* --- HEADER & PROGRESS BAR --- */}
        <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 text-purple-400">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Gamepad2 size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Active Mission Sequence</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-4 py-2 rounded-full border border-white/5">
              Phase {currentIndex + 1} // {sortedCards.length}
            </span>
          </div>
          
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              className="h-full bg-gradient-to-r from-purple-600 via-blue-500 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / sortedCards.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* --- DYNAMIC CARD CONTENT AREA --- */}
        <div className="flex-1 relative overflow-visible p-6 md:p-12 flex items-center">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full overflow-visible"
            >
              <div className={`grid gap-8 lg:gap-12 items-center ${currentCard.media_url ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto text-center'}`}>
                
                {/* Text Content */}
                <div className={`space-y-6 p-2 overflow-visible ${!currentCard.media_url && 'flex flex-col items-center'}`}>
                  <h2 
                    className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-[1.1] pb-2"
                    dangerouslySetInnerHTML={{ __html: formatText ? formatText(currentCard.title) : currentCard.title }}
                  />

                  <div 
                    className="text-base md:text-lg text-slate-300 leading-loose font-medium pb-2"
                    dangerouslySetInnerHTML={{ __html: formatText ? formatText(currentCard.content) : currentCard.content }}
                  />
                </div>

                {currentCard.media_url && (
                  <div className="w-full h-full flex items-center justify-center">
                    {renderMedia(currentCard.media_url, currentCard.title)}
                  </div>
                )}

              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* --- NAVIGATION FOOTER --- */}
        <div className="p-6 md:p-8 border-t border-white/5 bg-black/40 flex items-center justify-between gap-4 shrink-0">
          <button
            onClick={handlePrev}
            disabled={isFirstCard}
            className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 disabled:opacity-0 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <button
            onClick={handleNext}
            className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-2xl ${
              isLastCard 
                ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-emerald-900/40 border border-emerald-500/50" 
                : "bg-purple-600 text-white hover:bg-purple-500 hover:scale-105 shadow-purple-900/40 border border-purple-500/50"
            }`}
          >
            {isLastCard ? (
              <>Lock & Complete <CheckCircle2 size={16} /></>
            ) : (
              <>Next Sequence <ChevronRight size={16} /></>
            )}
          </button>
        </div>

      </div>

      {/* --- NEW: LIGHTBOX MODAL --- */}
      <AnimatePresence>
        {expandedImage && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 md:p-12">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setExpandedImage(null)} 
              className="absolute inset-0 bg-black/95 backdrop-blur-xl cursor-zoom-out" 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-6xl h-auto max-h-[85vh] flex flex-col items-center justify-center pointer-events-none"
            >
              {/* max-h-full forces the 1080x1080 image to scale down to fit the laptop screen! */}
              <img 
                src={expandedImage} 
                alt="Expanded View" 
                className="max-w-full max-h-full object-contain drop-shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-auto rounded-3xl"
                onClick={(e) => e.stopPropagation()} 
              />
              
              <button 
                onClick={() => setExpandedImage(null)}
                className="absolute -top-6 -right-2 md:-top-4 md:-right-8 p-3 bg-white/10 hover:bg-rose-500 text-white rounded-full backdrop-blur-md border border-white/20 transition-colors pointer-events-auto"
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}