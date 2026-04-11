"use client";

import { useState, useEffect } from "react";
import DashboardClientWrapper from "@/components/dashboard/DashboardClientWrapper";
import ProfileSidebar from "@/components/dashboard/ProfileSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Triangle, Zap, CheckCircle2, RefreshCcw, Sparkles, Shield, 
  Square, RectangleHorizontal, Hexagon, Box
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// CAPS Context: Space & Shape (Properties of 3D Objects & 2D Faces)
const CHALLENGES = [
  { 
    id: 'cube', 
    targetName: 'Cube', 
    targetImage: <Box size={64} className="text-orange-500" strokeWidth={1.5} />,
    prompt: 'Construct a Cube. Gather the required 2D faces from the supply room.',
    requiredFaces: { square: 6, triangle: 0, rectangle: 0, hexagon: 0 }
  },
  { 
    id: 'sq_pyramid', 
    targetName: 'Square-Based Pyramid', 
    targetImage: <Triangle size={64} className="text-orange-500" strokeWidth={1.5} fill="currentColor" fillOpacity={0.2} />,
    prompt: 'Construct a Square-Based Pyramid. Gather the exact faces needed.',
    requiredFaces: { square: 1, triangle: 4, rectangle: 0, hexagon: 0 }
  },
  { 
    id: 'tri_prism', 
    targetName: 'Triangular Prism', 
    targetImage: <Box size={64} className="text-orange-500" strokeWidth={1.5} style={{ transform: 'skewY(-15deg)' }} />,
    prompt: 'Construct a Triangular Prism. Analyze its sides and bases carefully.',
    requiredFaces: { square: 0, triangle: 2, rectangle: 3, hexagon: 0 }
  }
];

const SHAPE_TOOLS = [
  { id: 'square', name: 'Square', icon: Square, color: 'blue' },
  { id: 'triangle', name: 'Triangle', icon: Triangle, color: 'emerald' },
  { id: 'rectangle', name: 'Rectangle', icon: RectangleHorizontal, color: 'purple' },
  { id: 'hexagon', name: 'Hexagon', icon: Hexagon, color: 'rose' }
];

export default function GeometryLab() {
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Interactive Inventory State
  const [inventory, setInventory] = useState<Record<string, number>>({
    square: 0, triangle: 0, rectangle: 0, hexagon: 0
  });
  
  // Challenge State
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [forgeAnimating, setForgeAnimating] = useState(false);

  const challenge = CHALLENGES[currentLevel];

  useEffect(() => {
    async function loadUser() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (sessionData) {
        const localUser = JSON.parse(sessionData);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', localUser.id).single();
        setUserProfile(profile);
      }
    }
    loadUser();
  }, []);

  const updateInventory = (id: string, delta: number) => {
    setInventory(prev => ({
      ...prev,
      [id]: Math.max(0, Math.min(10, prev[id] + delta)) // Limit to 10 to prevent crazy numbers
    }));
  };

  const handleVerify = async () => {
    setIsProcessing(true);
    setForgeAnimating(true);
    
    // Check if inventory exactly matches required faces
    const isCorrect = 
      inventory.square === challenge.requiredFaces.square &&
      inventory.triangle === challenge.requiredFaces.triangle &&
      inventory.rectangle === challenge.requiredFaces.rectangle &&
      inventory.hexagon === challenge.requiredFaces.hexagon;

    setTimeout(async () => {
      setForgeAnimating(false);
      
      if (isCorrect) {
        setIsSuccess(true);
        
        if (userProfile) {
          const earnedXP = 50;
          const earnedSparks = 2;

          // Update profile
          await supabase.from('profiles').update({
            xp: (userProfile.xp || 0) + earnedXP,
            sparks: (userProfile.sparks || 0) + earnedSparks
          }).eq('id', userProfile.id);

          // Update math mastery record for Space & Shape
          await supabase.from('math_mastery').upsert({
            student_id: userProfile.id,
            grade: 5,
            content_area: 'Space and Shape',
            topic: 'Properties of 3D Objects',
            cognitive_level: 'Complex Procedures',
            mastery_score: 100,
            total_challenges_completed: currentLevel + 1,
            last_activity_at: new Date().toISOString()
          }, { onConflict: 'student_id, grade, content_area, topic' });
        }

        setTimeout(() => {
          if (currentLevel < CHALLENGES.length - 1) {
            setCurrentLevel(prev => prev + 1);
            setInventory({ square: 0, triangle: 0, rectangle: 0, hexagon: 0 }); // Reset inventory
            setIsSuccess(false);
          }
          setIsProcessing(false);
        }, 3000);

      } else {
        setIsProcessing(false);
        // Reset inventory on fail to force them to try again
        setInventory({ square: 0, triangle: 0, rectangle: 0, hexagon: 0 });
      }
    }, 2000); // 2 second "forging" animation
  };

  // Safe wrapper stats
  const currentXP = userProfile?.xp || 0;
  const isEngineer = currentXP >= 1000;
  const stats = {
    xp: currentXP,
    level: isEngineer ? 2 : 1,
    currentLevel: {
      name: "Geometry Architect",
      code: "MTH-GEO",
      accentColor: "#f97316", // Orange theme for Geometry
      floor: 0
    },
    nextLevel: { name: "Math Lead", xpRequired: 1000 }
  };

  return (
    <DashboardClientWrapper initialStats={stats}>
      <main className="min-h-screen lg:mr-80 bg-[#f8fafc] text-slate-900 relative overflow-hidden pb-20">
        
        {/* Blueprint Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
          
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <Link href="/math" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-600 transition-colors">
                <ArrowLeft size={14} /> Return to Quest Map
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center border border-orange-200 shadow-sm">
                  <Triangle size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                    Geometry_<span className="text-orange-600">Forge</span>
                  </h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mt-1">Apparatus Room: Level {currentLevel + 1}</p>
                </div>
              </div>
            </div>

            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase">Sparks Earned</p>
                <p className="text-xl font-black text-amber-500 italic leading-none">{userProfile?.sparks || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200">
                <Zap size={20} fill="currentColor" />
              </div>
            </div>
          </header>

          {/* THE CHALLENGE BOARD */}
          <div className="bg-white border-2 border-orange-100 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            
            {/* Success Overlay */}
            <AnimatePresence>
              {isSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm rounded-[36px] flex flex-col items-center justify-center space-y-6"
                >
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="text-center space-y-4">
                    <div>
                      <h2 className="text-3xl font-black uppercase italic text-emerald-600 tracking-tighter mb-2">Structure Forged!</h2>
                      <p className="text-slate-500 font-bold">+50 XP | +2 RAD Sparks</p>
                    </div>
                    {currentLevel === CHALLENGES.length - 1 && (
                      <Link 
                        href="/math"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-600 transition-colors shadow-xl"
                      >
                        Return to Map
                      </Link>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
              
              {/* Left Column: Target Schematic */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-100 text-orange-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  <Shield size={14} /> Blueprint Target
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tight text-slate-800 mb-2">
                    {challenge.targetName}
                  </h2>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    {challenge.prompt}
                  </p>
                </div>

                {/* The Hologram Viewer */}
                <div className="relative w-full aspect-square bg-slate-900 rounded-[32px] border-4 border-slate-800 shadow-inner flex items-center justify-center overflow-hidden">
                  {/* Grid Lines inside hologram */}
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  
                  <motion.div 
                    animate={forgeAnimating ? { scale: [1, 1.2, 0.8, 1.1, 1], rotate: [0, 10, -10, 5, 0] } : { y: [0, -10, 0] }}
                    transition={forgeAnimating ? { duration: 2 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-10 drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]"
                  >
                    {challenge.targetImage}
                  </motion.div>

                  {/* Scanning line effect */}
                  {forgeAnimating && (
                    <motion.div 
                      className="absolute left-0 right-0 h-1 bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,1)] z-20"
                      initial={{ top: 0 }}
                      animate={{ top: '100%' }}
                      transition={{ duration: 1, repeat: 1 }}
                    />
                  )}
                </div>
              </div>

              {/* Right Column: 2D Supply Room */}
              <div className="space-y-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-4">
                    2D Materials Supply Room
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {SHAPE_TOOLS.map((shape) => {
                      const count = inventory[shape.id];
                      return (
                        <div key={shape.id} className={`bg-white border-2 rounded-2xl p-4 transition-all ${count > 0 ? `border-${shape.color}-400 shadow-md` : 'border-slate-200'}`}>
                          <div className="flex justify-between items-center mb-4">
                            <div className={`w-10 h-10 rounded-xl bg-${shape.color}-50 text-${shape.color}-500 flex items-center justify-center`}>
                              <shape.icon size={20} />
                            </div>
                            <span className="text-2xl font-black text-slate-800 tabular-nums">{count}</span>
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center mb-3">{shape.name}</p>
                          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                            <button 
                              onClick={() => updateInventory(shape.id, -1)}
                              className="flex-1 py-2 flex items-center justify-center bg-white rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors shadow-sm font-black"
                            >-</button>
                            <button 
                              onClick={() => updateInventory(shape.id, 1)}
                              className="flex-1 py-2 flex items-center justify-center bg-white rounded-lg text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 transition-colors shadow-sm font-black"
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Area */}
                <div>
                  <button 
                    onClick={handleVerify}
                    disabled={isProcessing || Object.values(inventory).every(v => v === 0)}
                    className="w-full py-5 bg-orange-500 text-white rounded-[24px] font-black uppercase italic tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {isProcessing ? <RefreshCcw size={20} className="animate-spin" /> : <Sparkles size={20} />} Forge 3D Object
                  </button>
                </div>
              </div>

            </div>
          </div>
          
        </div>
      </main>

      <ProfileSidebar />
    </DashboardClientWrapper>
  );
}