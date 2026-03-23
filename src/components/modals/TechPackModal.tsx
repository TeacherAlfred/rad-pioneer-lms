"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Code2, Palette, Cpu, Zap, Download, ExternalLink, ShieldCheck } from "lucide-react";

const ASSET_THEMES: any = {
  python: {
    label: "Script_Uplink",
    color: "text-[#5574a9]",
    bgColor: "bg-[#5574a9]/10",
    icon: <Code2 size={40} />,
    detailLabel: "Function_Logic"
  },
  canva: {
    label: "Design_Blueprint",
    color: "text-[#5d4385]",
    bgColor: "bg-[#5d4385]/10",
    icon: <Palette size={40} />,
    detailLabel: "Style_Guide"
  },
  robotics: {
    label: "Circuit_Schematic",
    color: "text-[#88be56]",
    bgColor: "bg-[#88be56]/10",
    icon: <Zap size={40} />,
    detailLabel: "Pin_Map"
  },
  minecraft: {
    label: "Voxel_Architecture",
    color: "text-[#45a79a]",
    bgColor: "bg-[#45a79a]/10",
    icon: <Cpu size={40} />,
    detailLabel: "Redstone_Logic"
  }
};

export default function TechPackModal({ asset, isOpen, onClose }: any) {
  if (!isOpen || !asset) return null;

  const theme = ASSET_THEMES[asset.type] || ASSET_THEMES.python;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-[#020617]/95 backdrop-blur-md"
          onClick={onClose}
        />
        
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-5xl bg-[#0a0f1d] border border-white/10 rounded-[40px] md:rounded-[56px] overflow-hidden flex flex-col md:flex-row h-[85vh] shadow-2xl"
        >
          {/* Left: The Visual Data Center */}
          <div className="flex-1 p-8 md:p-12 flex flex-col gap-8 bg-black/20">
            <div className="flex justify-between items-center">
               <div className="flex items-center gap-2">
                 <ShieldCheck size={16} className={theme.color} />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Secure_Asset_Vault</span>
               </div>
               <span className={`px-3 py-1 rounded-lg ${theme.bgColor} ${theme.color} text-[8px] font-black uppercase tracking-widest border border-white/5`}>
                 {theme.label}
               </span>
            </div>

            <div className="flex-1 rounded-[32px] border border-white/5 bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden">
               {/* RAD Graphic Device (Atmospheric Glow) */}
               <div className={`absolute inset-0 opacity-10 blur-3xl rounded-full ${theme.bgColor}`} />
               
               <div className={`relative z-10 flex flex-col items-center gap-6 ${theme.color}`}>
                  {theme.icon}
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Status: Verified</p>
                    <p className="text-lg font-black text-white italic uppercase tracking-tighter">{asset.title}</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Right: Technical Specs Sidebar */}
          <div className="w-full md:w-96 p-8 md:p-12 bg-[#0a0f1d] flex flex-col gap-10 border-l border-white/5">
            <button onClick={onClose} className="self-end text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>

            <section className="space-y-2">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
                {asset.title}
              </h2>
              <p className="text-slate-400 font-medium text-sm leading-relaxed">
                {asset.description}
              </p>
            </section>

            <section className="space-y-6">
               <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{theme.detailLabel}</h4>
                  <div className="p-5 bg-black/40 rounded-2xl border border-white/5 font-mono text-xs text-[#45a79a] break-all">
                    {asset.technicalDetail}
                  </div>
               </div>
            </section>

            <div className="mt-auto space-y-3">
               <button className="w-full h-16 rounded-2xl bg-[#5574a9] text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Download Pack <Download size={16} />
               </button>
               <button className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:text-white transition-all">
                  Documentation <ExternalLink size={14} />
               </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}