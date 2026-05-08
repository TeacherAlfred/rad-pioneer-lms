"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { MessageCircle, X, Send, Loader2, User, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function FloatingTeacherChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize Teacher & Roster
  useEffect(() => {
    async function initTeacherChat() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) {
        setLoading(false);
        return;
      }
      
      const localUser = JSON.parse(sessionData);
      setTeacherId(localUser.id);

      // Fetch all students to filter the roster
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, metadata, linked_parent_id')
        .eq('role', 'student');
      
      let myStudents: any[] = [];
      if (profiles) {
        myStudents = profiles.filter(p => {
          const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
          return meta?.teacher?.id === localUser.id;
        }).map(p => ({
          id: p.id,
          name: p.display_name || "Unknown Pioneer",
          guardianId: p.linked_parent_id,
          unread: 0,
          lastMessage: null,
          lastMessageTime: 0
        }));
      }

      // Fetch all messages involving this teacher
      const { data: msgs } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('coach_id', localUser.id)
        .order('created_at', { ascending: true });

      if (msgs) {
        setAllMessages(msgs);
        
        // Calculate unread badges and last messages for the inbox
        msgs.forEach(m => {
          const student = myStudents.find(s => s.id === m.student_id);
          if (student) {
            if (m.sender_id === m.student_id && !m.is_read) {
              student.unread += 1;
            }
            student.lastMessage = m.message;
            student.lastMessageTime = new Date(m.created_at).getTime();
          }
        });
      }

      setRoster(myStudents);
      setLoading(false);
    }
    
    initTeacherChat();
  }, []);

  // 2. Setup Real-time Listener
  useEffect(() => {
    if (!teacherId) return;

    const channel = supabase.channel('teacher_chat_sync')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'coach_messages', filter: `coach_id=eq.${teacherId}` },
        (payload) => {
          const newMsg = payload.new;
          setAllMessages(prev => [...prev, newMsg]);
          
          setRoster(prev => prev.map(s => {
            if (s.id === newMsg.student_id) {
              // Only bump unread if the student sent it AND we aren't currently looking at their chat
              const isUnread = newMsg.sender_id === newMsg.student_id && (!isOpen || activeChatId !== s.id);
              return {
                ...s,
                lastMessage: newMsg.message,
                lastMessageTime: new Date(newMsg.created_at).getTime(),
                unread: isUnread ? s.unread + 1 : s.unread
              };
            }
            return s;
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teacherId, isOpen, activeChatId]);

  // 3. Auto-mark as read when opening a specific student's chat
  useEffect(() => {
    if (isOpen && activeChatId && teacherId) {
      const student = roster.find(s => s.id === activeChatId);
      if (student && student.unread > 0) {
        const markAsRead = async () => {
          await supabase
            .from('coach_messages')
            .update({ is_read: true })
            .eq('coach_id', teacherId)
            .eq('student_id', activeChatId)
            .eq('sender_id', activeChatId)
            .eq('is_read', false);
          
          setRoster(prev => prev.map(s => s.id === activeChatId ? { ...s, unread: 0 } : s));
        };
        markAsRead();
      }
    }
  }, [isOpen, activeChatId, teacherId, roster]);

  // 4. Auto-Scroll
  useEffect(() => {
    if (activeChatId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, activeChatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId || !teacherId || isSending) return;

    setIsSending(true);
    const msgText = newMessage.trim();
    setNewMessage(""); 

    try {
      const activeStudent = roster.find(s => s.id === activeChatId); // <--- Grab the student object
      
      const { error } = await supabase.from('coach_messages').insert([{
        student_id: activeChatId,
        coach_id: teacherId,
        guardian_id: activeStudent?.guardianId || null, 
        sender_id: teacherId, 
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

  const totalUnread = roster.reduce((acc, curr) => acc + curr.unread, 0);
  const activeStudent = roster.find(s => s.id === activeChatId);
  const activeMessages = allMessages.filter(m => m.student_id === activeChatId);

  // Sort roster: Unread first, then by most recent message
  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      if (a.unread > 0 && b.unread === 0) return -1;
      if (b.unread > 0 && a.unread === 0) return 1;
      return b.lastMessageTime - a.lastMessageTime;
    });
  }, [roster]);

  if (loading || !teacherId) return null;

  return (
    <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[9999] flex flex-col items-end">
      
      {/* --- CHAT WINDOW --- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0f172a] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl w-[340px] sm:w-[380px] h-[500px] max-h-[70vh] mb-4 flex flex-col overflow-hidden"
          >
            
            {/* --- STATE 1: INBOX VIEW --- */}
            {!activeChatId ? (
              <>
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex items-center justify-between shrink-0 shadow-md relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <MessageCircle size={14} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Student Inbox</h3>
                      <p className="text-[9px] text-purple-200 font-bold uppercase tracking-widest">{roster.length} Assigned Pioneers</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#020617] divide-y divide-white/5 custom-scrollbar">
                  {sortedRoster.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 p-6">
                      <User size={32} className="text-slate-500 mb-2" />
                      <p className="text-xs font-bold text-slate-400">Your roster is empty.</p>
                    </div>
                  ) : (
                    sortedRoster.map(student => (
                      <div 
                        key={student.id} 
                        onClick={() => setActiveChatId(student.id)}
                        className={`p-4 hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center justify-between group ${student.unread > 0 ? 'bg-purple-500/5' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${student.unread > 0 ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-400 group-hover:text-white transition-colors'}`}>
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className={`text-sm font-bold truncate ${student.unread > 0 ? 'text-white' : 'text-slate-300'}`}>{student.name}</h4>
                            <p className={`text-xs truncate max-w-[180px] ${student.unread > 0 ? 'text-purple-400 font-medium' : 'text-slate-500'}`}>
                              {student.lastMessage || "No messages yet"}
                            </p>
                          </div>
                        </div>
                        {student.unread > 0 && (
                          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-lg">
                            {student.unread}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              
              /* --- STATE 2: ACTIVE CHAT VIEW --- */
              <>
                <div className="bg-[#0f172a] border-b border-white/10 p-4 flex items-center justify-between shrink-0 shadow-md relative z-10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveChatId(null)} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                      <ChevronLeft size={20} />
                    </button>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest truncate max-w-[180px]">{activeStudent?.name}</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Active Chat</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#020617] custom-scrollbar">
                  {activeMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                      <MessageCircle size={32} className="text-slate-500 mb-2" />
                      <p className="text-xs font-bold text-slate-400">Send a message to<br/>start the conversation.</p>
                    </div>
                  ) : (
                    activeMessages.map((msg, idx) => {
                      const isMe = msg.sender_id === teacherId;
                      return (
                        <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                            isMe 
                              ? 'bg-purple-600 text-white rounded-br-sm' 
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
                      placeholder="Message Pioneer..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || isSending}
                      className="absolute right-2 p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                    >
                      {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FLOATING TOGGLE BUTTON --- */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 md:w-16 md:h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full shadow-[0_0_20px_rgba(147,51,234,0.5)] flex items-center justify-center text-white border border-purple-400/50"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        
        {/* Unread Badge */}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-500 border-2 border-[#020617] items-center justify-center text-[10px] font-black">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          </span>
        )}
      </motion.button>

    </div>
  );
}