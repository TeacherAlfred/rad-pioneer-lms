import { motion } from "framer-motion";

export default function VaultHero({ kidsNames }: { kidsNames: string }) {
  return (
    <header className="text-center mb-6 space-y-6 pt-4 flex flex-col items-center">
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400"
      >
        Curated Digital Archive
      </motion.p>
      
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-5xl md:text-7xl font-light tracking-tight text-slate-900 leading-[1.1]"
      >
        {kidsNames}'s <br />
        <span className="italic font-serif text-slate-500">Memories.</span>
      </motion.h1>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-slate-500 text-sm font-medium max-w-md mx-auto leading-relaxed"
      >
        Reliving the memories of engineering, logic, and problem-solving milestones captured during RAD Academy events.
      </motion.p>
    </header>
  );
}