"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Loader2, Plus, Trash2, Clock, CalendarDays, ShieldAlert, Eye } from "lucide-react";

const DAYS = ['Sunday','Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilityManager() {
  const [slots, setSlots] = useState<any[]>([]);
  const [globalLimit, setGlobalLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSlots();
  }, []);

  async function fetchSlots() {
    const { data } = await supabase.from('admin_calling_availability').select('*').order('day_of_week');
    setSlots(data || []);
    if (data && data.length > 0 && data[0].display_limit) {
      setGlobalLimit(data[0].display_limit);
    }
    setLoading(false);
  }

  const addSlot = () => {
    setSlots([...slots, { day_of_week: 'Sunday', start_time: '10:00', end_time: '13:00' }]);
  };

  const updateSlot = (index: number, field: string, value: string) => {
    const newSlots = [...slots];
    newSlots[index][field] = value;
    setSlots(newSlots);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, idx) => idx !== index));
  };

  const saveAvailability = async () => {
    setIsSaving(true);
    try {
      await supabase.from('admin_calling_availability').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (slots.length > 0) {
        // We save the global limit into every row so the DB schema is satisfied
        const payload = slots.map(s => ({ 
          day_of_week: s.day_of_week, 
          start_time: s.start_time, 
          end_time: s.end_time,
          display_limit: globalLimit
        }));
        await supabase.from('admin_calling_availability').insert(payload);
      }
      
      alert("System Availability Updated!");
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500 w-12 h-12" /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <Clock className="text-blue-500" size={32} /> Calling Windows
            </h1>
            <p className="text-slate-400 mt-3 text-sm leading-relaxed max-w-xl">
              Define your working hours. The system generates <strong>30-minute intervals</strong> from these blocks and presents ONLY the closest available slots to the parent based on the Global Limit.
            </p>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl shrink-0 text-center">
            <label className="block text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center justify-center gap-1.5"><Eye size={12}/> Global Visible Limit</label>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setGlobalLimit(Math.max(1, globalLimit - 1))} className="w-8 h-8 rounded-full bg-blue-500/20 hover:bg-blue-500/40 font-bold">-</button>
              <span className="text-3xl font-black text-white w-8">{globalLimit}</span>
              <button onClick={() => setGlobalLimit(globalLimit + 1)} className="w-8 h-8 rounded-full bg-blue-500/20 hover:bg-blue-500/40 font-bold">+</button>
            </div>
          </div>
        </div>

        <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl">
          
          <div className="flex justify-between items-end border-b border-white/5 pb-4 mb-6">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <CalendarDays size={14} /> Active Configurations
            </h2>
            <button onClick={addSlot} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white flex items-center gap-1.5 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
              <Plus size={14}/> Add Window
            </button>
          </div>

          <div className="space-y-3 mb-8">
            <AnimatePresence mode="popLayout">
              {slots.length === 0 ? (
                <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="p-8 text-center bg-black/30 rounded-2xl border border-white/5 border-dashed">
                  <ShieldAlert className="mx-auto text-amber-500 mb-2 opacity-50" size={24} />
                  <p className="text-sm font-bold text-slate-400">No availability defined.</p>
                </motion.div>
              ) : (
                slots.map((slot, i) => (
                  <motion.div 
                    layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    key={i} 
                    className="flex flex-col sm:flex-row gap-4 items-center bg-black/40 border border-white/5 p-4 rounded-2xl group hover:border-white/10 transition-colors"
                  >
                    <div className="w-full sm:flex-1 shrink-0">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Day</label>
                      <select value={slot.day_of_week} onChange={e => updateSlot(i, 'day_of_week', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-blue-500 appearance-none">
                        {DAYS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>

                    <div className="w-full sm:flex-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Start</label>
                      <input type="time" value={slot.start_time.substring(0, 5)} onChange={e => updateSlot(i, 'start_time', `${e.target.value}:00`)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-blue-500" />
                    </div>

                    <div className="w-full sm:flex-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">End</label>
                      <input type="time" value={slot.end_time.substring(0, 5)} onChange={e => updateSlot(i, 'end_time', `${e.target.value}:00`)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-blue-500" />
                    </div>

                    <div className="w-full sm:w-auto pt-5 sm:pt-4 flex justify-end">
                      <button onClick={() => removeSlot(i)} className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 hover:text-rose-300 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end pt-6 border-t border-white/5">
            <button onClick={saveAvailability} disabled={isSaving} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 disabled:opacity-50">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Publish Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}