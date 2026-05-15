"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Star, Loader2, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface DispatchItem {
  media_id: string;
  url: string;
  student_id: string;
  student_name: string;
  guardian_id: string;
  guardian_name: string;
  guardian_phone: string;
  taken_at: string;
}

interface MediaDispatchCartProps {
  items: DispatchItem[];
  onRemoveItem: (mediaId: string) => void;
  onClearCart: () => void;
}

export default function MediaDispatchCart({ items, onRemoveItem, onClearCart }: MediaDispatchCartProps) {
  const [coverId, setCoverId] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [successToken, setSuccessToken] = useState<string | null>(null);

  if (items.length === 0) return null;

  // Group items to ensure we are only sending to ONE parent at a time per workflow
  const targetGuardian = items[0].guardian_id;
  const guardianName = items[0].guardian_name;
  const guardianPhone = items[0].guardian_phone;
  
  // Extract unique student names for the message (safely separating siblings)
  const uniqueStudents = Array.from(new Set(items.flatMap(i => i.student_name.split(' & '))));
  const studentNamesStr = uniqueStudents.join(' & ');

  // Auto-set first item as cover if none selected
  const activeCoverId = coverId || items[0].media_id;

  const generateToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length: 12}).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

      const coverItem = items.find(i => i.media_id === activeCoverId) || items[0];
      
      const payload = items.map(i => ({
        media_id: i.media_id,
        url: i.url,
        student_name: i.student_name,
        taken_at: i.taken_at
      }));

      // 1. Save to Database
      const { error } = await supabase.from('media_shares').insert([{
        guardian_id: targetGuardian,
        token: token,
        media_payload: payload,
        cover_url: coverItem.url,
        expires_at: expiresAt.toISOString()
      }]);

      if (error) throw error;

      // 2. Generate WhatsApp URL
      const vaultUrl = `https://radacademy.co.za/vault/${token}`;
      const message = `*RAD Academy Pioneer Update*\n\nHi ${guardianName.split(' ')[0]},\n\nAs we launch our new Premium LMS platform, we’ve been looking back at some incredible memories your pioneers (${studentNamesStr}) have built with us at RAD Academy.\n\nWe’ve put together a private highlight reel of their journey. You can view their secure media vault here:\n🔗 ${vaultUrl}\n\n*(For your family's privacy, this link will expire in 7 days).*`;
      
      // Clean phone number (remove +, spaces, leading 0 to 27 if SA)
      let phone = guardianPhone.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '27' + phone.substring(1);

      // Use the official api.whatsapp.com endpoint instead of the wa.me shortcut for better encoding support
      const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
      
      // 3. Open WhatsApp in new tab
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      
      setSuccessToken(token);
      setTimeout(() => {
        onClearCart();
        setSuccessToken(null);
      }, 3000);

    } catch (err) {
      console.error("Dispatch Error:", err);
      alert("Failed to generate dispatch link.");
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-3xl bg-[#0f172a] border border-blue-500/30 rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col gap-4"
      >
        {successToken ? (
          <div className="flex flex-col items-center justify-center py-6 text-emerald-400">
            <CheckCircle2 size={40} className="mb-3 animate-bounce" />
            <h3 className="text-lg font-black uppercase tracking-widest">Vault Dispatched!</h3>
            <p className="text-xs text-slate-400 mt-1">WhatsApp opened in new tab.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                  <Send size={16} /> Dispatch Cart
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Target: {guardianName} ({uniqueStudents.length} Pioneers)
                </p>
              </div>
              <button onClick={onClearCart} className="text-slate-500 hover:text-rose-400 transition-colors p-2 bg-white/5 rounded-full">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
              {items.map(item => (
                <div key={item.media_id} className={`relative w-24 h-24 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${activeCoverId === item.media_id ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-white/10'}`} onClick={() => setCoverId(item.media_id)}>
                  <img src={item.url} alt="media" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.media_id); }} className="p-1.5 bg-rose-500 text-white rounded-full"><X size={12}/></button>
                  </div>
                  {activeCoverId === item.media_id && (
                    <div className="absolute top-1 left-1 bg-amber-400 text-black text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1 shadow-md">
                      <Star size={8} className="fill-black" /> Cover
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center bg-[#020617] p-3 rounded-2xl border border-white/5">
              <p className="text-[10px] text-slate-400 font-medium">Click an image to set it as the WhatsApp preview cover.</p>
              <button 
                onClick={handleDispatch}
                disabled={isDispatching}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
              >
                {isDispatching ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />} 
                Generate & Send
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}