"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquareText, X, Send, Loader2, Shield, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

export default function FloatingStudentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const pathname = usePathname();
  
  const [studentId, setStudentId] = useState<string | null>(null);
  const [guardianId, setGuardianId] = useState<string | null>(null);
  
  // Recipient & Thread State
  const [recipients, setRecipients] = useState<{id: string, name: string, role: string}[]>([]);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize User, Teacher & Admins
  useEffect(() => {
    async function initChat() {
      try {
        const sessionData = localStorage.getItem("pioneer_session");
        if (!sessionData) return;
        
        const localUser = JSON.parse(sessionData);
        setStudentId(localUser.id);

        // Fetch Student Profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('metadata, linked_parent_id')
          .eq('id', localUser.id)
          .single();

        // Fetch All Admins
        const { data: admins } = await supabase
          .from('profiles')
          .select('id, display_name')
          .eq('role', 'admin');

        let loadedRecipients: any[] = [];

        if (profile) {
          setGuardianId(profile.linked_parent_id || null);
          const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
          
          if (meta.teacher && meta.teacher.id) {
            loadedRecipients.push({ id: meta.teacher.id, name: meta.teacher.name, role: 'teacher' });
          }
        }

        if (admins) {
          admins.forEach(a => {
            loadedRecipients.push({ id: a.id, name: a.display_name || 'System Support', role: 'admin' });
          });
        }

        setRecipients(loadedRecipients);
        if (loadedRecipients.length > 0) {
          setActiveRecipientId(loadedRecipients[0].id);
        }
      } catch (err) {
        console.error("Failed to init chat", err);
      } finally {
        setLoading(false);
      }
    }
    initChat();
  }, []);

  // 2. Fetch Messages & Setup Real-time Listener
  useEffect(() => {
    if (!studentId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
    };

    fetchMessages();

    const channel = supabase.channel('student_chat_sync')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'coach_messages', filter: `student_id=eq.${studentId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [studentId]);

  // 3. Auto-switch to thread with unread messages when opened
  useEffect(() => {
    if (isOpen) {
      const unreadMsg = messages.find(m => m.sender_id !== studentId && !m.is_read);
      if (unreadMsg) {
        setActiveRecipientId(unreadMsg.coach_id);
      }
    }
  }, [isOpen, messages, studentId]);

  // 4. Mark active thread as read
  useEffect(() => {
    if (isOpen && activeRecipientId && studentId) {
      const unreadInActiveThread = messages.some(m => m.coach_id === activeRecipientId && m.sender_id !== studentId && !m.is_read);
      
      if (unreadInActiveThread) {
        supabase
          .from('coach_messages')
          .update({ is_read: true })
          .eq('student_id', studentId)
          .eq('coach_id', activeRecipientId)
          .neq('sender_id', studentId)
          .eq('is_read', false)
          .then(() => {
            setMessages(prev => prev.map(m => 
              (m.coach_id === activeRecipientId && m.sender_id !== studentId) 
                ? { ...m, is_read: true } 
                : m
            ));
          });
      }
    }
  }, [isOpen, activeRecipientId, studentId, messages]);

  // 5. Auto-Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeRecipientId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !studentId || !activeRecipientId || isSending) return;

    setIsSending(true);
    const msgText = newMessage.trim();
    setNewMessage(""); 

    try {
      const { error } = await supabase.from('coach_messages').insert([{
        student_id: studentId,
        coach_id: activeRecipientId,
        guardian_id: guardianId || null,
        sender_id: studentId,
        message: `${msgText}__PATH__${pathname}`,
        is_read: false
      }]);

      if (error) throw error;
    } catch (err) {
      console.error("Failed to send message", err);
      setNewMessage(msgText); 
    } finally {
      setIsSending(false);
    }
  };

  const globalUnreadCount = messages.filter(m => m.sender_id !== studentId && !m.is_read).length;
  const activeMessages = messages.filter(m => m.coach_id === activeRecipientId);

  // Formatting helper to keep names clean
  const formatRecipientName = (role: string, name: string) => {
    if (role === 'admin') return "RAD Support";
    return `Teacher (${name.split(' ')[0]})`;
  };

  if (loading || !studentId) return null;

  return (
    <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[9999] flex flex-col items-end">
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0f172a] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl w-[340px] sm:w-[380px] h-[500px] max-h-[70vh] mb-4 flex flex-col overflow-hidden"
          >
            {/* Header with Recipient Selector */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between shrink-0 shadow-md relative z-10">
              <div className="flex items-center gap-3 w-full min-w-0 pr-4">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-white" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  {recipients.length > 1 ? (
                    <div className="relative">
                      <select 
                        value={activeRecipientId || ''} 
                        onChange={e => setActiveRecipientId(e.target.value)}
                        className="w-full bg-transparent text-sm font-black text-white uppercase tracking-widest outline-none cursor-pointer appearance-none truncate pr-6 pb-0.5"
                      >
                        {recipients.map(r => (
                          <option key={r.id} value={r.id} className="text-slate-900 bg-white">
                            {formatRecipientName(r.role, r.name)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-200 pointer-events-none" />
                    </div>
                  ) : (
                    <h3 className="text-sm font-black text-white uppercase tracking-widest line-clamp-1">
                      {recipients[0] ? formatRecipientName(recipients[0].role, recipients[0].name) : 'RAD Support'}
                    </h3>
                  )}
                  <p className="text-[9px] text-blue-200 font-bold uppercase tracking-widest mt-0.5">Comms Network</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#020617] custom-scrollbar">
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <MessageSquareText size={32} className="text-slate-500 mb-2" />
                  <p className="text-xs font-bold text-slate-400">No messages in this thread yet.<br/>Say hi!</p>
                </div>
              ) : (
                activeMessages.map((msg, idx) => {
                  const isMe = msg.sender_id === studentId;
                  const recipient = recipients.find(r => r.id === msg.sender_id);
                  const isAdmin = recipient?.role === 'admin';
                  
                  // Format the sender name cleanly for the chat bubbles
                  const senderName = isMe ? "You" : (recipient ? formatRecipientName(recipient.role, recipient.name) : "RAD Support");

                  return (
                    <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2`}>
                      
                      {/* Sender Label for Incoming Messages */}
                      {!isMe && (
                        <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ml-1 flex items-center gap-1 ${isAdmin ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isAdmin ? <Shield size={10} /> : <User size={10} />}
                          {senderName}
                        </span>
                      )}

                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-br-sm' 
                          : isAdmin
                            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-bl-sm shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                            : 'bg-white/10 border border-white/5 text-slate-200 rounded-bl-sm'
                      }`}>
                        {msg.message.split('__PATH__')[0]}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#0f172a] border-t border-white/5 shrink-0">
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!activeRecipientId}
                  className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending || !activeRecipientId}
                  className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- UPGRADED FLOATING TOGGLE BUTTON --- */}
      <div className="relative group flex items-center gap-3">
        <AnimatePresence>
          {!isOpen && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap border border-blue-400/50"
            >
              Comms Network
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.4)] flex items-center justify-center text-white border-2 border-white/20 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          
          {isOpen ? (
            <X size={28} className="relative z-10" />
          ) : (
            <div className="relative z-10">
               <MessageSquareText size={28} strokeWidth={2.5} />
            </div>
          )}
          
          {/* Unread Badge */}
          {!isOpen && globalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 w-6 z-20">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-500 border-2 border-[#020617] items-center justify-center text-[10px] font-black shadow-lg">
                {globalUnreadCount > 9 ? '9+' : globalUnreadCount}
              </span>
            </span>
          )}
        </motion.button>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}