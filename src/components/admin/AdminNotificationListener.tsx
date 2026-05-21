"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, ChevronRight, Brain, Cpu, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminNotificationListener() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const router = useRouter();
  const [purgingId, setPurgingId] = useState<string | null>(null);

  // --- DANGEROUS PURGE ACTION FOR TESTING ---
  const handlePurgeTest = async (item: any) => {
    const confirmed = window.confirm(
      `🚨 DANGER: PURGE TEST DATA 🚨\n\nAre you sure you want to completely delete ${item.parent_name || item.name}'s submission?\n\nThis will permanently remove the Registration, Prospect CRM record, Guardian Profile, and Student Profile linked to ${item.email}.`
    );
    if (!confirmed) return;

    setPurgingId(item.id);

    try {
      // 1. Delete from Registrations
      await supabase.from('registrations').delete().eq('email', item.email);

      // 2. Delete from Prospects (CRM)
      if (item.email) {
        await supabase.from('prospects').delete().eq('email', item.email);

        // 3. Find and Delete Guardians & Linked Students
        const { data: guardians } = await supabase
          .from('profiles')
          .select('id, metadata')
          .eq('role', 'guardian');

        if (guardians && guardians.length > 0) {
          for (const guardian of guardians) {
            let guardianEmail = "";
            try {
              const meta = typeof guardian.metadata === 'string' ? JSON.parse(guardian.metadata) : (guardian.metadata || {});
              guardianEmail = meta.email;
            } catch (e) {}

            if (guardianEmail === item.email) {
              await supabase.from('profiles').delete().eq('linked_parent_id', guardian.id);
              await supabase.from('profiles').delete().eq('id', guardian.id);
            }
          }
        }
      }

      setNotifications((prev) => prev.filter((n) => n.email !== item.email));
      alert("Purge successful! All test records destroyed.");
      
    } catch (error: any) {
      console.error("Purge failed:", error);
      alert(`Database rejected the delete command:\n\n${error.message}`);
    } finally {
      setPurgingId(null);
    }
  };

  // 1. Fetch & Deduplicate Alerts
  const fetchAlerts = async () => {
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, created_at, parent_name, email, phone, interested_programs, metadata')
      .eq('is_acknowledged', false);
    
    const { data: leads } = await supabase
      .from('prospects')
      .select('id, created_at, name, email, phone, source, metadata')
      .eq('status', 'New Lead');

    const combined = [...(regs || []), ...(leads || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Core Fix: Deduplicate by email so we only show ONE card per person
    const uniqueAlerts = combined.reduce((acc: any[], current: any) => {
      const exists = acc.find(item => item.email === current.email);
      if (!exists) acc.push(current);
      return acc;
    }, []);

    setNotifications(uniqueAlerts);
  };

  // 2. Single Unified Realtime Listener
  useEffect(() => {
    fetchAlerts();
    
    const channel = supabase
      .channel('global-admin-alerts')
      
      // Listen to Registrations
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, (payload) => {
        setNotifications((prev) => {
          if (prev.some(n => n.email === payload.new.email)) return prev; // Block duplicate
          return [payload.new, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations' }, (payload) => {
        if (payload.new.is_acknowledged === true) {
          setNotifications((prev) => prev.filter(n => n.id !== payload.new.id));
        }
      })
      
      // Listen to Prospects
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prospects' }, (payload) => {
        setNotifications((prev) => {
          if (prev.some(n => n.email === payload.new.email)) return prev; // Block duplicate
          return [payload.new, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prospects' }, (payload) => {
        if (payload.new.status !== 'New Lead') {
          setNotifications((prev) => prev.filter(n => n.id !== payload.new.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Note: I removed the redundant second useEffect block here.

  // 3. Unified Acknowledge Action (Clears BOTH tables simultaneously)
  const handleAcknowledge = async (item: any, redirect: boolean = false) => {
    // 1. Optimistically remove from UI instantly (matching email OR exact ID)
    setNotifications((prev) => prev.filter(n => 
      (item.email && n.email === item.email) || n.id === item.id
    ));
    
    try {
      const updates = [];

      // 2. If we have an email, clear across both tables to catch duplicates
      if (item.email) {
        updates.push(supabase.from('registrations').update({ is_acknowledged: true }).eq('email', item.email));
        updates.push(supabase.from('prospects').update({ status: 'Contacted' }).eq('email', item.email).eq('status', 'New Lead'));
      } else {
        // Fallback: If no email exists, target the exact row ID
        if (item.status !== undefined) {
          updates.push(supabase.from('prospects').update({ status: 'Contacted' }).eq('id', item.id));
        } else {
          updates.push(supabase.from('registrations').update({ is_acknowledged: true }).eq('id', item.id));
        }
      }

      // Execute updates and capture results
      const results = await Promise.all(updates);

      // 3. Catch Silent Supabase Errors (RLS Blocks)
      for (const res of results) {
        if (res.error) {
          console.error("❌ Supabase Update Failed:", res.error.message);
          alert(`Failed to save to database. Check console. Error: ${res.error.message}`);
        }
      }

      if (redirect) {
        router.push('/admin/leads');
      }
    } catch (error) {
      console.error("Network Error during Acknowledge:", error);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[9999] w-[calc(100%-3rem)] max-w-[360px] flex flex-col-reverse gap-4 pointer-events-none max-h-[85vh] overflow-y-auto no-scrollbar">
      <AnimatePresence>
        {notifications.map((item) => {
          const displayName = item.parent_name || item.name; 
          const prog = item.interested_programs?.[0] || item.source;
          
          const isMath = prog === "Free Math Lab";
          const isTrial = prog === "14-Day Free Trial" || prog === "Public Trial Form";
          const isRobotics = prog === "Irene Primary WhatsApp Flyer";
          
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, x: 50 }}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col gap-3 shrink-0 ${
                isMath 
                  ? 'border-emerald-500/30' 
                  : isRobotics 
                  ? 'border-indigo-500/30' 
                  : isTrial 
                  ? 'border-amber-500/30' 
                  : 'border-blue-500/30'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className={`flex items-center gap-2 ${
                  isMath 
                    ? 'text-emerald-400' 
                    : isRobotics 
                    ? 'text-indigo-400' 
                    : isTrial 
                    ? 'text-amber-400' 
                    : 'text-blue-400'
                }`}>
                  {isMath ? (
                    <Brain size={16} className="animate-pulse" />
                  ) : (
                    <Cpu size={16} className="animate-pulse" />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <BellRing size={10}/> {
                      isMath 
                        ? 'Math Setup' 
                        : isRobotics 
                        ? 'Robotics Lead'
                        : isTrial 
                        ? 'Pioneer Trial Alert' 
                        : 'LMS Lead'
                    }
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5 text-right">
                  {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Body */}
              <div>
                <p className="font-bold text-lg text-white leading-tight">{displayName}</p>
                <p className="text-xs text-slate-300 mt-1">{item.email}</p>
                <p className="text-xs text-slate-300 mt-0.5">{item.phone}</p>
                
                {/* Specifics based on lead type */}
                {isMath && item.metadata?.pioneer_username && (
                  <p className="text-xs text-emerald-300 mt-2 font-bold">Pioneer ID: {item.metadata.pioneer_username}</p>
                )}
                {isRobotics && item.metadata?.student_grade && (
                  <p className="text-xs text-indigo-300 mt-2 font-bold">Child Grade: {item.metadata.student_grade}</p>
                )}
                
                <div className={`mt-3 inline-block border px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                  isMath 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : isRobotics 
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                    : isTrial 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  {prog}
                </div>
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
                  onClick={() => handleAcknowledge(item, false)} 
                  className="flex-1 py-3 text-slate-400 bg-white/5 hover:bg-white/10 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors border border-white/5 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck size={14} /> Clear
                </button>
                <button 
                  onClick={() => handleAcknowledge(item, true)} 
                  className={`flex-1 py-3 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 hover:-translate-y-0.5 ${
                    isMath 
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' 
                      : isRobotics 
                      ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20' 
                      : isTrial 
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20' 
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                  }`}
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