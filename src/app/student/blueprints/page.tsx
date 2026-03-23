"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Code2, Palette, Cpu, Zap, 
  Loader2, ArrowLeft, Box, ChevronRight,
  Search, Clock
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";

export default function AssetGallery() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadTechArchive() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) {
        router.push("/login");
        return;
      }
      
      const session = JSON.parse(sessionData);
      setUser(session);

      try {
        // Fetch items specifically for this student
        const { data, error } = await supabase
          .from("tech_archive")
          .select("*")
          .eq("student_id", session.id);

        if (error) throw error;
        setAssets(data || []);
      } catch (err: any) {
        console.error("Archive Sync Error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTechArchive();
  }, [router]);

  const triggerArchiveConfetti = () => {
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.8 },
      colors: ["#5574a9", "#45a79a", "#88be56"]
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="text-[#5574a9] animate-spin" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Loading Archive...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] p-8 md:p-16 relative overflow-hidden font-sans">
      <header className="mb-16 relative z-10 text-left">
        <Link 
          href="/student/dashboard" 
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors group mb-8 inline-flex"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest text-left">Back to Dashboard</span>
        </Link>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div>
            <h1 className="text-6xl font-black text-white uppercase italic tracking-tighter leading-none mb-4">
              Tech <span className="text-[#5574a9]">Archive</span>
            </h1>
            <p className="text-slate-500 font-bold tracking-[0.3em] text-[10px] uppercase">
              Student: {user?.display_name || "Pioneer"}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-[28px] flex items-center gap-4 backdrop-blur-md">
             <div className="w-10 h-10 rounded-xl bg-[#5574a9]/20 flex items-center justify-center text-[#5574a9]">
               <Box size={20} />
             </div>
             <div className="text-left">
               <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Items Saved</p>
               <p className="text-xl font-black text-white italic leading-none">{assets.length}</p>
             </div>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {assets.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 py-32 flex flex-col items-center justify-center text-center space-y-6 bg-white/[0.02] border border-dashed border-white/10 rounded-[64px]"
          >
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-[#45a79a]">
               <Search size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Your Archive is Empty</h2>
              <p className="text-slate-400 max-w-xs mx-auto text-sm font-medium">
                Finish your lessons to save your work here!
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {assets.map((asset) => (
              <motion.div 
                key={asset.id}
                whileHover={{ y: -5 }}
                onClick={() => {
                  triggerArchiveConfetti();
                  setTimeout(() => router.push(`/student/blueprints/${asset.id}`), 400);
                }}
                className="group p-8 rounded-[40px] bg-white/5 border border-white/10 hover:border-[#5574a9]/50 transition-all cursor-pointer text-left relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-[#5574a9]/20 transition-colors">
                  {asset.type === "python" ? <Code2 className="text-[#5574a9]" size={20} /> : 
                   asset.type === "design" ? <Palette className="text-[#5d4385]" size={20} /> : 
                   <Cpu className="text-[#45a79a]" size={20} />}
                </div>

                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">
                  {asset.title}
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {asset.type} // Project File
                </p>
                <div className="mt-8 flex justify-end">
                   <ChevronRight size={16} className="text-slate-700 group-hover:text-white transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}