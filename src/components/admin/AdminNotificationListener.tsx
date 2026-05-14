"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, X, ChevronRight, Brain, Cpu, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminNotificationListener() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const router = useRouter();

  const [purgingId, setPurgingId] = useState<string | null>(null);

  // --- DANGEROUS PURGE ACTION FOR TESTING ---
  const handlePurgeTest = async (item: any) => {
    const confirmed = window.confirm(
      `🚨 DANGER: PURGE TEST DATA 🚨\n\nAre you sure you want to completely delete ${item.parent_name}'s submission?\n\nThis will permanently remove the Registration, Prospect CRM record, Guardian Profile, and Student Profile linked to ${item.email}.`
    );
    if (!confirmed) return;

    setPurgingId(item.id);

    try {
      // 1. Delete from Registrations (Check for errors!)
      const { error: regErr } = await supabase.from('registrations').delete().eq('id', item.id);
      if (regErr) throw regErr;

      // 2. Delete from Prospects (CRM)
      if (item.email) {
        const { error: prosErr } = await supabase.from('prospects').delete().eq('email', item.email);
        if (prosErr) throw prosErr;

        // 3. Find Guardians by Name (Bypasses JSON/String metadata mismatch)
        const { data: guardians } = await supabase
          .from('profiles')
          .select('id, metadata')
          .eq('role', 'guardian')
          .eq('display_name', item.parent_name);

        if (guardians && guardians.length > 0) {
          for (const guardian of guardians) {
            // Safely extract email whether it is a JSON object or a stringified JSON
            let guardianEmail = "";
            try {
              const meta = typeof guardian.metadata === 'string' ? JSON.parse(guardian.metadata) : (guardian.metadata || {});
              guardianEmail = meta.email;
            } catch (e) {}

            // Only delete if the email explicitly matches the registration email
            if (guardianEmail === item.email) {
              // Delete Linked Students First
              await supabase.from('profiles').delete().eq('linked_parent_id', guardian.id);
              // Delete Guardian
              const { error: profErr } = await supabase.from('profiles').delete().eq('id', guardian.id);
              if (profErr) throw profErr;
            }
          }
        }
      }

      // 4. Remove from UI ONLY if database confirmed deletion
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
      alert("Purge successful! All test records destroyed.");
      
    } catch (error: any) {
      console.error("Purge failed:", error);
      alert(`Database rejected the delete command:\n\n${error.message || "Row Level Security (RLS) blocked the action."}\n\nYou may need to unlock DELETE permissions in Supabase.`);
    } finally {
      setPurgingId(null);
    }
  };

  // 1. Initial Load: Fetch all unacknowledged alerts so they survive page refreshes
  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('registrations')
        .select('*')
        .eq('is_acknowledged', false)
        .order('created_at', { ascending: false });
      
      if (data) setNotifications(data);
    };

    fetchAlerts();
  }, []);

  // 2. Realtime Listener: Catch new ones while navigating
  useEffect(() => {
    const channel = supabase
      .channel('global-admin-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'registrations',
        },
        (payload) => {
          // Push new alerts to the top of the stack (NO auto-dismiss timeout)
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Acknowledge Action: Clears it from DB and removes it from the screen
  const handleAcknowledge = async (id: string, redirect: boolean = false) => {
    // Optimistically remove from UI instantly
    setNotifications((prev) => prev.filter(n => n.id !== id));
    
    // Update database in the background
    await supabase.from('registrations').update({ is_acknowledged: true }).eq('id', id);

    if (redirect) {
      router.push('/admin/leads'); // Adjust route if your leads page is different
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[9999] w-[calc(100%-3rem)] max-w-[360px] flex flex-col-reverse gap-4 pointer-events-none max-h-[85vh] overflow-y-auto no-scrollbar">
      <AnimatePresence>
        {notifications.map((item) => {
          const prog = item.interested_programs?.[0];
          const isMath = prog === "Free Math Lab";
          const isTrial = prog === "14-Day Free Trial";
          
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, x: 50 }}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col gap-3 shrink-0 ${isMath ? 'border-emerald-500/30' : 'border-blue-500/30'}`}
            >
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className={`flex items-center gap-2 ${isMath ? 'text-emerald-400' : isTrial ? 'text-purple-400' : 'text-blue-400'}`}>
                  {isMath ? <Brain size={16} className="animate-pulse" /> : <Cpu size={16} className="animate-pulse" />}
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <BellRing size={10}/> {isMath ? 'Math Setup' : isTrial ? '14-Day LMS Trial' : 'Robotics Lead'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5 text-right">
                  {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Body */}
              <div>
                <p className="font-bold text-lg text-white leading-tight">{item.parent_name}</p>
                <p className="text-xs text-slate-300 mt-1">{item.email}</p>
                <p className="text-xs text-slate-300 mt-0.5">{item.phone}</p>
                
                {isMath && item.metadata?.pioneer_username && (
                  <p className="text-xs text-emerald-300 mt-2 font-bold">Pioneer ID: {item.metadata.pioneer_username}</p>
                )}
                
                {item.interested_programs && item.interested_programs.length > 0 && (
                  <div className={`mt-3 inline-block border px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${isMath ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isTrial ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                    {item.interested_programs[0]}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => handlePurgeTest(item)}
                  disabled={purgingId === item.id}
                  className="p-3 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-500/20 disabled:opacity-50"
                  title="Purge Test Data completely from DB"
                >
                  {purgingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
                <button 
                  onClick={() => handleAcknowledge(item.id, false)} 
                  className="flex-1 py-3 text-slate-400 bg-white/5 hover:bg-white/10 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors border border-white/5 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck size={14} /> Clear
                </button>
                <button 
                  onClick={() => handleAcknowledge(item.id, true)} 
                  className={`flex-1 py-3 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 hover:-translate-y-0.5 ${isMath ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'}`}
                >
                  View Lead <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}