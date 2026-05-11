"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, X, MessageCircle, Send, Loader2, 
  ChevronLeft, MonitorSmartphone, GraduationCap, User, MessageSquareText,
  Info
} from "lucide-react";

interface LivePresenceWidgetProps {
  currentUser: any;
}

export default function LivePresenceWidget({ currentUser }: LivePresenceWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Network & Unread State
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [offlineUnreadUsers, setOfflineUnreadUsers] = useState<any[]>([]);
  
  // Active Chat State
  const [chatUser, setChatUser] = useState<any | null>(null);
  const [chatUserMeta, setChatUserMeta] = useState<{ guardianId: string | null }>({ guardianId: null });
  const [activeMessages, setActiveMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- 1. SUPABASE REALTIME PRESENCE (ONLINE USERS) ---
  useEffect(() => {
    if (!currentUser?.id) return;

    const existingChannels = supabase.getChannels();
    const ghostChannel = existingChannels.find(c => c.topic === 'realtime:rad_global_presence');
    if (ghostChannel) supabase.removeChannel(ghostChannel);

    const channel = supabase.channel('rad_global_presence', {
      config: { presence: { key: currentUser.id } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: any[] = [];
        
        for (const id in state) {
          if (id !== currentUser.id) {
            const presenceData = state[id][0] as any; 
            users.push(presenceData); 
          }
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              id: currentUser.id,
              name: currentUser.display_name || 'Admin',
              role: 'admin',
              page: '/admin/dashboard',
              online_at: new Date().toISOString()
            });
          } catch (trackErr) {
            console.error("Widget track failed.", trackErr);
          }
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // --- 2. GLOBAL UNREAD MESSAGES TRACKER ---
  useEffect(() => {
    if (!currentUser?.id) return;

    const fetchUnread = async () => {
      const { data } = await supabase
        .from('coach_messages')
        .select('student_id')
        .eq('coach_id', currentUser.id)
        .eq('is_read', false)
        .neq('sender_id', currentUser.id);

      if (data) {
        const counts: Record<string, number> = {};
        const ids = new Set<string>();
        data.forEach(m => {
          counts[m.student_id] = (counts[m.student_id] || 0) + 1;
          ids.add(m.student_id);
        });
        setUnreadCounts(counts);

        // Fetch profiles for offline users who have unread messages
        if (ids.size > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, display_name, role').in('id', Array.from(ids));
          if (profiles) {
            setOfflineUnreadUsers(profiles.map(p => ({
              id: p.id,
              name: p.display_name || 'Unknown',
              role: p.role || 'student',
              page: 'Offline'
            })));
          }
        }
      }
    };

    fetchUnread();

    const channel = supabase.channel('admin_global_msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_messages', filter: `coach_id=eq.${currentUser.id}` }, (payload) => {
        const newMsg = payload.new;
        if (newMsg.sender_id !== currentUser.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [newMsg.student_id]: (prev[newMsg.student_id] || 0) + 1
          }));

          // Ensure they are in the offline array if they aren't online
          setOfflineUnreadUsers(prev => {
            if (prev.some(p => p.id === newMsg.student_id)) return prev;
            supabase.from('profiles').select('id, display_name, role').eq('id', newMsg.student_id).single().then(({data}) => {
              if (data) {
                setOfflineUnreadUsers(curr => [...curr, { id: data.id, name: data.display_name, role: data.role, page: 'Offline' }]);
              }
            });
            return prev;
          });
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // --- 3. FETCH ACTIVE CHAT HISTORY ---
  useEffect(() => {
    if (!chatUser || !currentUser) return;

    const fetchChatData = async () => {
      const { data: profile } = await supabase.from('profiles').select('linked_parent_id, role').eq('id', chatUser.id).single();
      const guardianId = profile?.role === 'guardian' ? chatUser.id : (profile?.linked_parent_id || chatUser.id);
      setChatUserMeta({ guardianId });

      const { data: msgs } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('coach_id', currentUser.id)
        .eq('student_id', chatUser.id)
        .order('created_at', { ascending: true });
        
      if (msgs) setActiveMessages(msgs);
    };

    fetchChatData();

    const channel = supabase.channel('admin_active_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_messages', filter: `coach_id=eq.${currentUser.id}` }, (payload) => {
        if (payload.new.student_id === chatUser.id) {
          setActiveMessages(prev => [...prev, payload.new]);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatUser, currentUser]);

  // --- 4. MARK AS READ WHEN OPENING CHAT ---
  useEffect(() => {
    if (chatUser && isOpen && unreadCounts[chatUser.id]) {
      supabase.from('coach_messages')
        .update({ is_read: true })
        .eq('coach_id', currentUser.id)
        .eq('student_id', chatUser.id)
        .neq('sender_id', currentUser.id)
        .eq('is_read', false)
        .then(() => {
          setUnreadCounts(prev => {
            const next = { ...prev };
            delete next[chatUser.id];
            return next;
          });
        });
    }
  }, [chatUser, isOpen, unreadCounts, currentUser]);

  // --- 5. AUTO-SCROLL TO BOTTOM ---
  useEffect(() => {
    if (chatUser) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, chatUser]);

  // --- 6. MESSAGE SENDER ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !chatUser || isSending) return;
    
    setIsSending(true);
    const msgText = message.trim();
    setMessage(""); 

    try {
      const { error } = await supabase.from('coach_messages').insert({
        student_id: chatUser.id,
        coach_id: currentUser.id,
        guardian_id: chatUserMeta.guardianId,
        sender_id: currentUser.id,
        message: msgText,
        is_read: false
      });

      if (error) throw error;
    } catch (err: any) {
      alert("Failed to send message: " + err.message);
      setMessage(msgText); 
    } finally {
      setIsSending(false);
    }
  };

  // --- 7. MERGE ONLINE USERS & UNREAD OFFLINE USERS ---
  const displayUsers = useMemo(() => {
    const map = new Map();
    offlineUnreadUsers.forEach(u => map.set(u.id, { ...u, isOnline: false }));
    onlineUsers.forEach(u => map.set(u.id, { ...u, isOnline: true }));
    
    return Array.from(map.values()).sort((a, b) => {
       const aUnread = unreadCounts[a.id] || 0;
       const bUnread = unreadCounts[b.id] || 0;
       if (aUnread > 0 && bUnread === 0) return -1;
       if (bUnread > 0 && aUnread === 0) return 1;
       if (a.isOnline && !b.isOnline) return -1;
       if (b.isOnline && !a.isOnline) return 1;
       return 0;
    });
  }, [onlineUsers, offlineUnreadUsers, unreadCounts]);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed bottom-6 left-6 lg:bottom-10 lg:left-10 z-[9999] flex flex-col items-start pointer-events-none">
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 bg-[#0f172a] border border-blue-500/30 rounded-3xl w-[340px] sm:w-[380px] h-[500px] max-h-[70vh] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto flex flex-col"
          >
            {/* VIEW 1: USERS LIST */}
            {!chatUser ? (
              <>
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between shrink-0 shadow-md relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center relative">
                      <Activity size={14} className="text-white" />
                      {onlineUsers.length > 0 && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-600 animate-pulse" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Support Network</h3>
                      <p className="text-[9px] text-blue-200 font-bold uppercase tracking-widest">{onlineUsers.length} Online • {totalUnread} Unread</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-[#020617] divide-y divide-white/5 custom-scrollbar">
                  {displayUsers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 p-6">
                      <MonitorSmartphone size={32} className="text-slate-500 mb-2" />
                      <p className="text-xs font-bold text-slate-400">No active users on the platform.</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {displayUsers.map((user, i) => {
                        const unread = unreadCounts[user.id] || 0;
                        return (
                          <div 
                            key={`${user.id}-${i}`} 
                            onClick={() => setChatUser(user)}
                            className={`p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group flex items-center gap-3 ${unread > 0 ? 'bg-blue-500/10' : ''}`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border shrink-0 transition-colors ${unread > 0 ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white'}`}>
                              {user.role === 'student' ? <GraduationCap size={16}/> : <User size={16}/>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate transition-colors ${unread > 0 ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{user.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                <p className={`text-[9px] font-mono truncate ${user.isOnline ? 'text-blue-400' : 'text-slate-500'}`}>{user.page}</p>
                              </div>
                            </div>
                            {unread > 0 ? (
                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-lg">
                                {unread}
                              </div>
                            ) : (
                              <ChevronLeft size={16} className="text-slate-600 group-hover:text-blue-400 shrink-0 rotate-180 transition-colors" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* VIEW 2: ACTIVE CHAT HISTORY */
              <div className="flex flex-col h-full bg-[#020617]">
                <div className="bg-[#0f172a] border-b border-white/10 p-4 flex items-center justify-between shrink-0 shadow-md relative z-10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setChatUser(null)} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                      <ChevronLeft size={20} />
                    </button>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest truncate max-w-[180px]">{chatUser.name}</h3>
                      <div className="text-[9px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <span className={`block w-1.5 h-1.5 rounded-full ${chatUser.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} /> 
                        {chatUser.isOnline ? 'Live Support' : 'Offline Message'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {activeMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                      <MessageCircle size={32} className="text-slate-500 mb-2" />
                      <p className="text-xs font-bold text-slate-400">Send a message to<br/>start the conversation.</p>
                    </div>
                  ) : (
                    activeMessages.map((msg, idx) => {
                      const isMe = msg.sender_id === currentUser.id;
                      
                      // THE FIX: Split the token to separate the message from the URL
                      const parts = msg.message.split('__PATH__');
                      const displayMessage = parts[0];
                      const pageUrl = parts[1]; // Will be undefined for Admin replies

                      return (
                        <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-2`}>
                          
                          {/* THE TOOLTIP: Appears on hover next to incoming student messages */}
                          {!isMe && pageUrl && (
                            <div className="flex items-center justify-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  const fullUrl = window.location.origin + pageUrl;
                                  navigator.clipboard.writeText(fullUrl);
                                  alert("Student's active page copied:\n" + fullUrl);
                                }}
                                title={`Sent from: ${pageUrl}\nClick to copy URL`}
                                className="p-1.5 text-slate-500 hover:text-blue-400 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                              >
                                <Info size={14} />
                              </button>
                            </div>
                          )}

                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                            isMe 
                              ? 'bg-blue-600 text-white rounded-br-sm' 
                              : 'bg-white/10 border border-white/5 text-slate-200 rounded-bl-sm'
                          }`}>
                            {displayMessage}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-[#0f172a] border-t border-white/5 shrink-0">
                  <form onSubmit={handleSendMessage} className="relative flex items-center">
                    <input
                      type="text"
                      placeholder={`Message ${chatUser.name.split(' ')[0]}...`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                    />
                    <button
                      type="submit"
                      disabled={!message.trim() || isSending}
                      className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors"
                    >
                      {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB TOGGLE BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto flex items-center justify-center transition-all duration-300 relative rounded-full 
          ${isOpen 
            ? 'w-12 h-12 bg-slate-800 text-slate-400 hover:text-white border border-white/10' 
            : totalUnread > 0
              ? 'w-16 h-16 bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.8)] hover:scale-105 animate-pulse'
              : onlineUsers.length > 0 
                ? 'w-16 h-16 bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-105' 
                : 'w-12 h-12 bg-slate-900 border border-white/5 text-slate-600'
          }`
        }
      >
        {isOpen ? (
          <X size={20} />
        ) : (
          <div className="relative flex items-center justify-center">
            {totalUnread > 0 ? (
               <MessageSquareText size={28} className="animate-bounce" />
            ) : (
               <Activity size={onlineUsers.length > 0 ? 24 : 20} className={onlineUsers.length > 0 ? "animate-pulse" : ""} />
            )}
            
            {totalUnread > 0 ? (
              <span className="absolute -top-3 -right-3 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-[#020617] shadow-lg">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            ) : onlineUsers.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-[#020617] shadow-lg">
                {onlineUsers.length}
              </span>
            )}
          </div>
        )}
      </button>

    </div>
  );
}