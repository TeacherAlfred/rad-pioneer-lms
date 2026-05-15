"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MousePointerClick } from "lucide-react";

export default function VaultGallery({ media }: { media: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!media || media.length === 0) return null;

  const showcase = media.slice(0, 3);
  const activeItem = showcase[currentIndex];

  const handleNext = () => {
    if (showcase.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % showcase.length);
    }
  };

  const displayDate = activeItem?.taken_at 
    ? new Date(activeItem.taken_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : "";

  return (
    <div className="flex flex-col items-center justify-center relative z-10 w-full max-w-5xl mx-auto pb-4 pt-8">
      
      {/* The Interactive Stack Container - WIDE FAN SPREAD */}
      <div 
        className="relative w-full max-w-sm md:max-w-xl aspect-[4/5] md:aspect-[4/3] cursor-pointer group mb-12" 
        onClick={handleNext}
      >
        {showcase.map((item, index) => {
          const relativeIndex = (index - currentIndex + showcase.length) % showcase.length;
          
          // --- THE FAN OUT SPREAD LOGIC ---
          let xOffset = 0;
          let yOffset = 0;
          let rotation = 0;
          let scale = 1;

          if (relativeIndex === 0) {
            // Front Image (Dead Center)
            xOffset = 0;
            yOffset = 0;
            rotation = 0;
            scale = 1;
          } else if (relativeIndex === 1) {
            // Middle Image (Peeking out sharply to the RIGHT)
            xOffset = 60;  // Push right
            yOffset = 20;  // Push slightly down
            rotation = 8;  // Tilt right
            scale = 0.95;
          } else if (relativeIndex === 2) {
            // Back Image (Peeking out sharply to the LEFT)
            xOffset = -60; // Push left
            yOffset = 30;  // Push slightly down
            rotation = -8; // Tilt left
            scale = 0.9;
          }
          
          const zIndex = showcase.length - relativeIndex;
          
          const shadow = relativeIndex === 0 
            ? "0 30px 60px -15px rgba(0, 0, 0, 0.15)" 
            : "0 15px 25px -5px rgba(0, 0, 0, 0.08)";

          return (
            <motion.div
              key={item.media_id}
              layout
              animate={{
                x: xOffset,
                y: yOffset,
                scale: scale,
                zIndex: zIndex,
                rotateZ: rotation,
                boxShadow: shadow
              }}
              transition={{ type: "spring", stiffness: 260, damping: 25 }}
              className="absolute inset-0 bg-white p-4 md:p-6 w-full h-full origin-center rounded-xl border border-slate-200"
            >
              <img 
                src={item.url} 
                alt="Pioneer project" 
                className="w-full h-full object-cover rounded-sm" 
              />
              
              {/* Fade out the images in the back to maintain focus on the front */}
              {relativeIndex > 0 && (
                <div className="absolute inset-0 bg-white/40 transition-opacity" />
              )}
            </motion.div>
          );
        })}

        {/* Bouncing Click Indicator */}
        {showcase.length > 1 && (
          <div className="absolute right-0 md:-right-12 top-1/2 -translate-y-1/2 z-50 w-16 h-16 bg-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.1)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <MousePointerClick size={28} className="text-slate-400 animate-bounce" />
          </div>
        )}
      </div>

      <motion.div 
        key={activeItem?.media_id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-6 flex flex-col items-center text-center max-w-md"
      >
        <h3 className="text-xl font-black uppercase tracking-widest text-slate-800">
          {activeItem?.student_name}
        </h3>
        {displayDate && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">
            {displayDate}
          </p>
        )}
        
        {showcase.length > 1 && (
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-6 font-bold bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
            Tap the photo stack to flip
          </p>
        )}
      </motion.div>
    </div>
  );
}