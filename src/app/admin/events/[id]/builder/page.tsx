"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  CalendarDays, MapPin, Clock, Cpu, Zap, 
  ShieldCheck, Loader2, Edit3, Save, X, ImageIcon, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ICON_MAP: any = { 1: Cpu, 2: Zap, 3: ShieldCheck };

export default function WelcomePageBuilder() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable States
  const [coverImage, setCoverImage] = useState("");
  const [cards, setCards] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);

  // Modal States
  const [editingBlock, setEditingBlock] = useState<{type: 'image' | 'card' | 'check', index?: number} | null>(null);
  const [tempData, setTempData] = useState<any>({});

  useEffect(() => {
    async function fetchEvent() {
      const { data } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (data) {
        setEvent(data);
        setCoverImage(data.cover_image_url || "");
        setCards(data.welcome_config?.experience_cards || []);
        setChecklist(data.welcome_config?.checklist || []);
      }
      setLoading(false);
    }
    fetchEvent();
  }, [eventId]);

  const handleSaveToDatabase = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('events').update({
        cover_image_url: coverImage,
        welcome_config: { experience_cards: cards, checklist: checklist }
      }).eq('id', eventId);

      if (error) throw error;
      alert("Welcome page updated successfully!");
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (type: 'image' | 'card' | 'check', index?: number) => {
    setEditingBlock({ type, index });
    if (type === 'image') setTempData({ url: coverImage });
    if (type === 'card' && index !== undefined) setTempData({ ...cards[index] });
    if (type === 'check' && index !== undefined) setTempData({ ...checklist[index] });
  };

  const saveBlock = () => {
    if (!editingBlock) return;
    if (editingBlock.type === 'image') setCoverImage(tempData.url);
    if (editingBlock.type === 'card' && editingBlock.index !== undefined) {
      const newCards = [...cards];
      newCards[editingBlock.index] = tempData;
      setCards(newCards);
    }
    if (editingBlock.type === 'check' && editingBlock.index !== undefined) {
      const newList = [...checklist];
      newList[editingBlock.index] = tempData;
      setChecklist(newList);
    }
    setEditingBlock(null);
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center text-yellow-500"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans pb-20">
      
      {/* ADMIN TOP BAR */}
      <div className="sticky top-0 z-50 bg-blue-600 border-b border-blue-500 px-6 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin/events')} className="text-blue-200 hover:text-white"><X size={24}/></button>
          <div>
            <h2 className="font-black uppercase tracking-widest text-sm">Visual Builder Mode</h2>
            <p className="text-[10px] text-blue-200 uppercase tracking-widest">Editing: {event.title}</p>
          </div>
        </div>
        <button onClick={handleSaveToDatabase} disabled={saving} className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-blue-50 transition-all">
          {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Page
        </button>
      </div>

      {/* --- HERO SECTION --- */}
      <section className="relative px-6 lg:px-12 pt-20 pb-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9]">
            Welcome to the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">{event.title}</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-xl">{event.description}</p>
        </div>

        {/* EDITABLE IMAGE */}
        <div className="relative aspect-[4/5] md:aspect-square rounded-[40px] overflow-hidden border-2 border-dashed border-blue-500/50 group">
          {coverImage ? <img src={coverImage} alt="Cover" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-900 flex items-center justify-center"><ImageIcon size={64} className="text-slate-700"/></div>}
          
          <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
            <button onClick={() => openEditor('image')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-2xl hover:scale-105 transition-transform">
              <Edit3 size={16}/> Edit Image Link
            </button>
          </div>
        </div>
      </section>

      {/* --- WHAT TO EXPECT (EDITABLE CARDS) --- */}
      <section className="py-24 px-6 lg:px-12 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">The Experience</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, idx) => {
            const Icon = ICON_MAP[card.id] || Cpu;
            return (
              <div key={idx} className="bg-white/5 border-2 border-dashed border-transparent hover:border-blue-500/50 rounded-[32px] p-8 relative group transition-all">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6"><Icon size={24} className="text-yellow-400" /></div>
                <h3 className="text-xl font-black uppercase italic tracking-tight mb-3">{card.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                
                <div className="absolute inset-0 bg-blue-900/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center rounded-[32px]">
                  <button onClick={() => openEditor('card', idx)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                    <Edit3 size={14}/> Edit Card
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* --- PREPARATION CHECKLIST (EDITABLE) --- */}
      <section className="py-24 px-6 lg:px-12 bg-white/[0.02] border-t border-white/5">
        <div className="max-w-4xl mx-auto bg-[#0f172a] border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl relative">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-10">Preparation Checklist</h2>

          <div className="space-y-4">
            {checklist.map((check, idx) => (
              <div key={idx} className="flex gap-4 items-start p-5 bg-white/5 rounded-2xl border-2 border-dashed border-transparent hover:border-blue-500/50 relative group transition-all">
                 <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"><CheckCircle2 size={16}/></div>
                 <div>
                   <h4 className="text-sm font-black text-white">{check.title}</h4>
                   <p className="text-xs text-slate-400 mt-1 leading-relaxed pr-24">{check.desc}</p>
                 </div>
                 
                 <button onClick={() => openEditor('check', idx)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-blue-500">
                    <Edit3 size={16}/>
                 </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- EDIT MODAL --- */}
      <AnimatePresence>
        {editingBlock && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0f172a] border border-white/10 p-8 rounded-[32px] w-full max-w-lg shadow-2xl">
              <h3 className="text-xl font-black uppercase italic mb-6">
                {editingBlock.type === 'image' ? 'Update Cover Image' : editingBlock.type === 'card' ? 'Edit Experience Card' : 'Edit Checklist Item'}
              </h3>
              
              <div className="space-y-4">
                {editingBlock.type === 'image' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Image URL</label>
                    <input type="text" value={tempData.url} onChange={e => setTempData({...tempData, url: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm mt-1 outline-none focus:border-blue-500 text-white" placeholder="https://vzyraeuyyoytditmfvcc.supabase.co/.../IMG.jpg" />
                  </div>
                )}
                
                {(editingBlock.type === 'card' || editingBlock.type === 'check') && (
                  <>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Title</label>
                      <input type="text" value={tempData.title} onChange={e => setTempData({...tempData, title: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm mt-1 outline-none focus:border-blue-500 text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Description</label>
                      <textarea value={tempData.desc} onChange={e => setTempData({...tempData, desc: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm mt-1 outline-none focus:border-blue-500 text-white min-h-[100px] resize-none" />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setEditingBlock(null)} className="flex-1 py-3 bg-white/5 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={saveBlock} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16}/> Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}