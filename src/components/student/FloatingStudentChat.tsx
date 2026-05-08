"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquareText, X, Send, Loader2, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function FloatingStudentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [studentId, setStudentId] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<{ id: string, name: string } | null>(null);
  const [guardianId, setGuardianId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize User, Teacher & Parent
  useEffect(() => {
    async function initChat() {
      try {
        const sessionData = localStorage.getItem("pioneer_session");
        if (!sessionData) return;
        
        const localUser = JSON.parse(sessionData);
        setStudentId(localUser.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('metadata, linked_parent_id')
          .eq('id', localUser.id)
          .single();

        if (profile) {
          setGuardianId(profile.linked_parent_id || null);

          const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
          if (meta.teacher && meta.teacher.id) {
            setTeacher({ id: meta.teacher.id, name: meta.teacher.name });
          }
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
    if (!studentId || !teacher) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
        const unread = data.filter(m => m.sender_id === teacher.id && !m.is_read);
        setUnreadCount(unread.length);
      }
    };

    fetchMessages();

    const channel = supabase.channel('student_chat_sync')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'coach_messages', filter: `student_id=eq.${studentId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
          if (!isOpen && payload.new.sender_id === teacher.id) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [studentId, teacher, isOpen]);

  // 3. Mark as Read when opening
  useEffect(() => {
    if (isOpen && unreadCount > 0 && studentId && teacher) {
      const markAsRead = async () => {
        await supabase
          .from('coach_messages')
          .update({ is_read: true })
          .eq('student_id', studentId)
          .eq('sender_id', teacher.id)
          .eq('is_read', false);
        
        setUnreadCount(0);
      };
      markAsRead();
    }
  }, [isOpen, unreadCount, studentId, teacher]);

  // 4. Auto-Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !studentId || !teacher || isSending) return;

    setIsSending(true);
    const msgText = newMessage.trim();
    setNewMessage(""); 

    try {
      const { error } = await supabase.from('coach_messages').insert([{
        student_id: studentId,
        coach_id: teacher.id,
        guardian_id: guardianId || null,
        sender_id: studentId,
        message: msgText,
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

  if (loading || !teacher) return null;

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
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between shrink-0 shadow-md relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Shield size={14} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{teacher.name}</h3>
                  <p className="text-[9px] text-blue-200 font-bold uppercase tracking-widest">Instructor Comms</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                <X size={16} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#020617] custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <MessageSquareText size={32} className="text-slate-500 mb-2" />
                  <p className="text-xs font-bold text-slate-400">No messages yet.<br/>Say hi to your teacher!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender_id === studentId;
                  return (
                    <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-br-sm' 
                          : 'bg-white/10 border border-white/5 text-slate-200 rounded-bl-sm'
                      }`}>
                        {msg.message}
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
                  className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
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
        {/* Tooltip Label */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap border border-blue-400/50"
            >
              Message Teacher
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.4)] flex items-center justify-center text-white border-2 border-white/20 overflow-hidden"
        >
          {/* Subtle animated background shine */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          
          {isOpen ? (
            <X size={28} className="relative z-10" />
          ) : (
            <div className="relative z-10">
               <MessageSquareText size={28} strokeWidth={2.5} />
            </div>
          )}
          
          {/* Unread Badge */}
          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 w-6 z-20">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-500 border-2 border-[#020617] items-center justify-center text-[10px] font-black shadow-lg">
                {unreadCount > 9 ? '9+' : unreadCount}
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