"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Mail, Save, Users, Send, Loader2, ArrowLeft, 
  Settings, CheckCircle2, FileText, Search, Filter, Eye, PenTool, Clock, History, Activity, MessageSquare, ChevronDown
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// Helper to safely parse JSON metadata
const parseMeta = (meta: any) => {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try { return JSON.parse(meta); } catch { return {}; }
  }
  return meta;
};

export default function CommunicationsHub() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inbox' | 'templates' | 'dispatch' | 'history'>('inbox');
  
  // View Toggle States
  const [templateViewMode, setTemplateViewMode] = useState<"edit" | "visual">("edit");
  const [dispatchViewMode, setDispatchViewMode] = useState<"edit" | "visual">("edit");

  // Template State
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Dispatch & History State
  const [guardians, setGuardians] = useState<any[]>([]);
  const [selectedGuardians, setSelectedGuardians] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dispatchDraft, setDispatchDraft] = useState({ subject: "", body: "" });
  const [isSending, setIsSending] = useState(false);
  const [commsLogs, setCommsLogs] = useState<any[]>([]);
  
  // --- HISTORY ACCORDION STATE ---
  const [expandedHistory, setExpandedHistory] = useState<string[]>([]);

  // --- NEW LIVE INBOX STATE ---
  const [profilesMap, setProfilesMap] = useState<Map<string, any>>(new Map());
  const [students, setStudents] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // NEW: Real-time subscription for the Coach Messages table
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('admin_global_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_messages' }, (payload) => {
        setChatMessages(prev => {
          if (prev.some(msg => msg.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'coach_messages' }, (payload) => {
         setChatMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Auto-scroll chat
  useEffect(() => {
    if (messagesEndRef.current && activeTab === 'inbox') {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChatId, chatMessages, activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/"); return; }

      const { data: userProfile } = await supabase.from('profiles').select('*').eq('auth_user_id', session.user.id).single();
      if (userProfile) setCurrentUser(userProfile);

      // 1. Fetch Email Templates
      const { data: tplData } = await supabase.from('email_templates').select('*').order('created_at', { ascending: false });
      if (tplData) setTemplates(tplData);

      // 2. Fetch Profiles & Build Dictionary
      const { data: allProfiles } = await supabase.from('profiles').select('*');
      const pMap = new Map();
      const studentList: any[] = [];
      const guardianList: any[] = [];

      if (allProfiles) {
        allProfiles.forEach(p => {
          p.meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
          pMap.set(p.id, p);
          if (p.role === 'student') studentList.push(p);
          if (p.role === 'guardian') guardianList.push(p);
        });
      }
      setProfilesMap(pMap);
      setStudents(studentList);
      setGuardians(guardianList);

      // 3. Fetch Communication Logs
      const { data: logsData } = await supabase.from('communication_logs').select('*');

      // Inject Billing Records into Timeline
      const { data: billingData } = await supabase.from('billing_records').select('*, profiles(display_name, metadata)');

      let combinedLogs = logsData || [];
      if (billingData) {
        const billingLogs = billingData.map(rec => {
          const recMeta = parseMeta(rec.metadata);
          const profMeta = parseMeta(rec.profiles?.metadata);
          const name = rec.profiles?.display_name || recMeta.prospect_name || "Unknown Entity";
          const email = profMeta.email || recMeta.prospect_email || "";

          return {
            id: `billing-${rec.id}`,
            recipient_email: email,
            recipient_name: name,
            subject: `${rec.doc_type === 'quote' ? 'Quotation' : 'Invoice'} Transmitted: ${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`,
            status: 'Action Taken',
            sent_at: rec.created_at
          };
        });
        combinedLogs = [...combinedLogs, ...billingLogs];
      }
      combinedLogs.sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      setCommsLogs(combinedLogs);

      // 4. Fetch ALL Coach Messages for the Inbox
      const { data: allMessages } = await supabase.from('coach_messages').select('*').order('created_at', { ascending: true });
      if (allMessages) setChatMessages(allMessages);

    } catch (err) {
      console.error("Error loading communications:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- NEW LIVE INBOX LOGIC ---
  const chatThreads = useMemo(() => {
    const groups = new Map<string, { lastMessage: any, unreadCount: number, allMsgs: any[] }>();
    
    chatMessages.forEach(msg => {
      if (!groups.has(msg.student_id)) {
        groups.set(msg.student_id, { lastMessage: msg, unreadCount: 0, allMsgs: [] });
      }
      const group = groups.get(msg.student_id)!;
      group.allMsgs.push(msg);
      
      if (new Date(msg.created_at) > new Date(group.lastMessage.created_at)) {
        group.lastMessage = msg;
      }
      
      // Count unread (only count messages from parents)
      const senderProfile = profilesMap.get(msg.sender_id);
      if (!msg.is_read && senderProfile?.role === 'guardian') {
        group.unreadCount += 1;
      }
    });

    const threads = students.map(student => {
      const group = groups.get(student.id) || { lastMessage: null, unreadCount: 0, allMsgs: [] };
      const guardian = profilesMap.get(student.linked_parent_id);
      
      return {
        student,
        guardian,
        lastMessage: group.lastMessage,
        unreadCount: group.unreadCount,
        messages: group.allMsgs,
        sortTime: group.lastMessage ? new Date(group.lastMessage.created_at).getTime() : 0
      };
    }).filter(t => t.lastMessage !== null); // Only show students with active chats

    return threads.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      return b.sortTime - a.sortTime;
    });

  }, [students, chatMessages, profilesMap]);

  const activeThread = useMemo(() => {
    return chatThreads.find(t => t.student.id === activeChatId) || null;
  }, [activeChatId, chatThreads]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeThread || !currentUser) return;

    const text = replyText.trim();
    setReplyText("");
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const coachId = activeThread.student.meta?.teacher?.id || currentUser.id;

    const optimisticMsg = {
      id: tempId,
      student_id: activeThread.student.id,
      guardian_id: activeThread.student.linked_parent_id,
      coach_id: coachId,
      sender_id: currentUser.id,
      message: text,
      created_at: new Date().toISOString(),
      is_read: true
    };

    // FIXED: Changed setMessages to setChatMessages
    setChatMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase.from('coach_messages').insert([{
        student_id: activeThread.student.id,
        guardian_id: activeThread.student.linked_parent_id,
        coach_id: coachId,
        sender_id: currentUser.id,
        message: text
      }]).select().single();

      if (error) throw error;
      
      // FIXED: Changed setMessages to setChatMessages
      setChatMessages(prev => prev.map(msg => msg.id === tempId ? data : msg));

      // --- FIRE AUTOMATIC EMAIL NOTIFICATION ---
      fetch('/api/messages/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: activeThread.student.id,
          guardian_id: activeThread.student.linked_parent_id,
          coach_id: coachId,
          sender_id: currentUser.id,
          message: text
        })
      }).catch(console.error);

    } catch (err) {
      console.error("Send error:", err);
      // FIXED: Changed setMessages to setChatMessages
      setChatMessages(prev => prev.filter(msg => msg.id !== tempId));
      alert("Failed to send message.");
      setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!activeChatId || !currentUser) return;
    window.dispatchEvent(new Event('messagesRead'));
    await supabase.from('coach_messages')
      .update({ is_read: true })
      .eq('student_id', activeChatId)
      .neq('sender_id', currentUser.id)
      .eq('is_read', false);
  };

  // --- OLD LOGIC CONTINUED ---
  const generateEmailPreviewHTML = (content: string, subject: string) => {
    const whatsappLink = `#`;
    return `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; text-align: left;">
        <h2 style="color: #a855f7; text-transform: uppercase; font-style: italic; letter-spacing: 1px; margin-bottom: 24px; font-size: 24px;">
          ${subject || 'RAD Academy Transmission'}
        </h2>
        <div style="font-size: 15px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">${content}</div>
        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #1e293b; text-align: center;">
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 15px;">Need help or have questions? Our support team is just a tap away.</p>
          <a href="${whatsappLink}" style="background-color: #25D366; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            💬 Chat with us on WhatsApp
          </a>
        </div>
        <p style="color: #475569; font-size: 12px; margin-top: 40px; text-align: center;">
          RAD Academy HQ | Empowering the next generation of innovators.<br/>
          <span style="font-style: italic;">Please do not reply directly to this automated transmission.</span>
        </p>
      </div>
    `;
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ subject: selectedTemplate.subject, body_content: selectedTemplate.body_content, updated_at: new Date().toISOString() })
        .eq('id', selectedTemplate.id);

      if (error) throw error;
      setTemplates(templates.map(t => t.id === selectedTemplate.id ? selectedTemplate : t));
      alert("Template saved securely to database.");
    } catch (err) {
      alert("Failed to save template.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectTemplateForDispatch = (tpl: any) => {
    setDispatchDraft({ subject: tpl.subject, body: tpl.body_content });
  };

  const handleToggleGuardian = (id: string, hasEmail: boolean) => {
    if (!hasEmail) return; 
    setSelectedGuardians(prev => prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]);
  };

  const filteredGuardians = guardians.filter(g => {
    const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
    return g.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           meta?.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelectAll = () => {
    const validGuardians = filteredGuardians.filter(g => {
      const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
      return !!meta?.email?.trim();
    });

    if (selectedGuardians.length === validGuardians.length && validGuardians.length > 0) {
      setSelectedGuardians([]); 
    } else {
      setSelectedGuardians(validGuardians.map(g => g.id)); 
    }
  };

  const handleBulkDispatch = async () => {
    if (selectedGuardians.length === 0) return alert("Select at least one recipient.");
    if (!dispatchDraft.subject || !dispatchDraft.body) return alert("Draft cannot be empty.");
    
    const confirm = window.confirm(`Transmit this communication to ${selectedGuardians.length} guardians?`);
    if (!confirm) return;

    setIsSending(true);
    try {
      const recipients = guardians
        .filter(g => selectedGuardians.includes(g.id))
        .map(g => {
          const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
          return { email: meta?.email || "", name: g.display_name };
        });

      const res = await fetch('/api/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: recipients.map(r => r.email),
          subject: dispatchDraft.subject,
          htmlBody: generateEmailPreviewHTML(dispatchDraft.body, dispatchDraft.subject) 
        })
      });

      if (!res.ok) throw new Error("API failed to transmit to Resend.");

      const logPayload = recipients.map(r => ({
         recipient_email: r.email,
         recipient_name: r.name,
         subject: dispatchDraft.subject,
         status: 'Sent'
      }));
      
      const { error } = await supabase.from('communication_logs').insert(logPayload);
      if (error) throw error;

      alert(`Successfully transmitted to ${recipients.length} sectors.`);
      setSelectedGuardians([]);
      setDispatchDraft({ subject: "", body: "" });
      
      await fetchData();

    } catch (err: any) {
      console.error(err);
      alert(`Transmission failure: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const toggleHistoryGroup = (id: string) => {
    setExpandedHistory(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const groupedLogsArray = Object.values(commsLogs.reduce((acc: any, log: any) => {
    const rawEmail = log.recipient_email?.trim();
    const rawName = log.recipient_name?.trim();
    
    const key = rawEmail || rawName || `unknown-${log.id}`;

    if (!acc[key]) {
      acc[key] = { 
        id: key, 
        email: rawEmail || 'No Email Provided', 
        name: rawName || 'Unknown Guardian', 
        logs: [], 
        latest: log.sent_at 
      };
    }
    acc[key].logs.push(log);
    
    if (new Date(log.sent_at) > new Date(acc[key].latest)) {
      acc[key].latest = log.sent_at;
    }
    return acc;
  }, {})).sort((a: any, b: any) => new Date(b.latest).getTime() - new Date(a.latest).getTime());


  if (loading && activeTab !== 'history') return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-purple-400 font-black uppercase tracking-widest text-[10px]">Accessing Comms Network...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-purple-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-purple-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-500">
                <Mail size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Comms_Relay_Active</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Comms_<span className="text-purple-500">Hub</span>
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto max-w-full">
            <button onClick={() => setActiveTab('inbox')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              <MessageSquare size={14}/> Inbox
            </button>
            <button onClick={() => setActiveTab('templates')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${activeTab === 'templates' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              <FileText size={14}/> Templates
            </button>
            <button onClick={() => setActiveTab('dispatch')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${activeTab === 'dispatch' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              <Send size={14}/> Dispatch
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${activeTab === 'history' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              <History size={14}/> History
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">

          {/* ============================== */}
          {/* TAB 0: INBOX (Parent Messages) */}
          {/* ============================== */}
          {activeTab === 'inbox' && (
            <motion.div key="inbox" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
              
              {/* Message List */}
              <div className="lg:col-span-1 bg-white/[0.02] border border-white/10 rounded-[32px] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-sm font-black uppercase italic text-white flex items-center gap-2">Parent Messages</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {chatThreads.length === 0 ? (
                     <p className="text-center text-slate-500 text-xs py-10">No messages found.</p>
                  ) : (
                    chatThreads.map((thread) => {
                      const isActive = activeChatId === thread.student.id;
                      const hasUnread = thread.unreadCount > 0;
                      
                      return (
                        <button 
                          key={thread.student.id}
                          onClick={() => setActiveChatId(thread.student.id)}
                          className={`w-full text-left p-4 rounded-2xl transition-all border ${isActive ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className={`font-bold text-sm flex items-center gap-2 ${hasUnread ? 'text-indigo-300' : 'text-white'}`}>
                              {thread.guardian?.display_name || "Unknown"}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              {new Date(thread.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex justify-between items-end gap-2">
                            <p className="text-[11px] text-slate-400 line-clamp-2">{thread.lastMessage.message}</p>
                            {hasUnread && (
                              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                {thread.unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Active Message & Reply */}
              <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
                {!activeThread ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <MessageSquare size={48} className="opacity-20 mb-4" />
                    <p className="font-bold uppercase text-sm">Select a message to view</p>
                  </div>
                ) : (
                  <>
                    <div className="p-6 border-b border-white/5 bg-[#020617]/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-slate-300">
                        <Users size={16}/> Chatting with: {activeThread.guardian?.display_name} <span className="text-slate-500 text-xs ml-2">({activeThread.student.display_name}'s Guardian)</span>
                      </div>
                      <button 
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/10 transition-colors"
                      >
                        <CheckCircle2 size={12}/> Mark Read
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                      {activeThread.messages.map((msg) => {
                         const sender = profilesMap.get(msg.sender_id);
                         const isSystemStaff = sender?.role === 'admin' || sender?.role === 'educator';
                         return (
                           <div key={msg.id} className={`flex flex-col max-w-[80%] ${isSystemStaff ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                             <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 px-1">
                               {isSystemStaff ? (sender?.id === currentUser?.id ? 'You (Admin)' : `${sender?.display_name} (Coach)`) : (sender?.display_name || 'Guardian')}
                             </span>
                             <div className={`p-4 rounded-2xl text-sm ${isSystemStaff ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white/10 text-slate-200 rounded-bl-sm'}`}>
                               {msg.message}
                             </div>
                             <span className="text-[10px] text-slate-500 mt-1 px-1 font-medium">
                               {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                           </div>
                         );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="p-6 bg-[#020617] border-t border-white/5">
                      <div className="bg-[#0b101e] border border-white/10 rounded-2xl p-2 focus-within:border-indigo-500/50 transition-colors">
                        <textarea 
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                          placeholder="Draft response to parent..."
                          className="w-full h-20 bg-transparent p-3 text-sm text-white placeholder-slate-500 focus:outline-none resize-none custom-scrollbar"
                        />
                        <div className="flex justify-between items-center px-3 pb-2 pt-2 border-t border-white/5">
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Responses appear as Admin/Support</p>
                          <button onClick={handleSendReply} disabled={!replyText.trim() || isSending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                            {isSending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14} />} Send Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ============================== */}
          {/* TAB 1: TEMPLATES               */}
          {/* ============================== */}
          {activeTab === 'templates' && (
            <motion.div key="templates" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Available Protocols</h3>
                <div className="space-y-3">
                  {templates.map(tpl => (
                    <button key={tpl.id} onClick={() => { setSelectedTemplate(tpl); setTemplateViewMode("edit"); }} className={`w-full text-left p-5 rounded-2xl border transition-all ${selectedTemplate?.id === tpl.id ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                      <p className={`font-black uppercase italic ${selectedTemplate?.id === tpl.id ? 'text-purple-400' : 'text-white'}`}>{tpl.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">{tpl.slug}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                {selectedTemplate ? (
                  <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8 shadow-2xl space-y-6">
                    <div className="flex justify-between items-center border-b border-white/5 pb-6">
                      <div>
                        <h2 className="text-2xl font-black uppercase italic text-white">{selectedTemplate.name}</h2>
                        <p className="text-xs text-slate-500 mt-1">Changes here will affect all future automated transmissions.</p>
                      </div>
                      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
                         <button onClick={() => setTemplateViewMode('edit')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${templateViewMode === 'edit' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><PenTool size={14} /></button>
                         <button onClick={() => setTemplateViewMode('visual')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${templateViewMode === 'visual' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><Eye size={14} /></button>
                      </div>
                    </div>

                    {templateViewMode === 'edit' ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">Email Subject Line</label>
                          <input value={selectedTemplate.subject} onChange={e => setSelectedTemplate({...selectedTemplate, subject: e.target.value})} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-4 text-sm font-bold outline-none focus:border-purple-500 transition-colors" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">Body Content (Text/HTML)</label>
                            <span className="text-[9px] text-slate-500 bg-white/5 px-2 py-1 rounded-md">Use {'{{variable}}'} for dynamic data</span>
                          </div>
                          <textarea value={selectedTemplate.body_content} onChange={e => setSelectedTemplate({...selectedTemplate, body_content: e.target.value})} className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-5 text-sm font-medium text-slate-300 min-h-[300px] outline-none focus:border-purple-500 transition-colors leading-relaxed custom-scrollbar" />
                        </div>
                      </>
                    ) : (
                      <div className="bg-[#0f172a] rounded-3xl border border-white/10 overflow-hidden shadow-inner flex justify-center py-8">
                        <div dangerouslySetInnerHTML={{ __html: generateEmailPreviewHTML(selectedTemplate.body_content, selectedTemplate.subject) }} className="w-full" />
                      </div>
                    )}
                    <div className="pt-4 flex justify-end">
                      <button onClick={handleSaveTemplate} disabled={isSaving} className="px-8 py-4 bg-purple-600 rounded-2xl font-black uppercase italic flex items-center gap-2 hover:bg-purple-500 transition-all disabled:opacity-50">
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <><Save size={16}/> Save Master Protocol</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[32px] p-12 text-center">
                    <FileText size={48} className="text-slate-700 mb-4" />
                    <p className="text-slate-400 font-bold">Select a template from the matrix to edit.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ============================== */}
          {/* TAB 2: BULK DISPATCH CENTER    */}
          {/* ============================== */}
          {activeTab === 'dispatch' && (
            <motion.div key="dispatch" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8 shadow-2xl space-y-6">
                  <div className="border-b border-white/5 pb-4 mb-4 flex justify-between items-center">
                    <h2 className="text-2xl font-black uppercase italic text-blue-400">1. Draft Communication</h2>
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
                         <button onClick={() => setDispatchViewMode('edit')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${dispatchViewMode === 'edit' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><PenTool size={14} /></button>
                         <button onClick={() => setDispatchViewMode('visual')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${dispatchViewMode === 'visual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><Eye size={14} /></button>
                      </div>
                  </div>

                  {dispatchViewMode === 'edit' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Load From Template (Optional)</label>
                        <select className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-blue-400 outline-none focus:border-blue-500" onChange={(e) => { const tpl = templates.find(t => t.id === e.target.value); if(tpl) handleSelectTemplateForDispatch(tpl); }} defaultValue="">
                          <option value="" disabled>Select a starting template...</option>
                          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Subject</label>
                        <input value={dispatchDraft.subject} onChange={e => setDispatchDraft({...dispatchDraft, subject: e.target.value})} placeholder="e.g., Important Update for Term 2" className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-4 text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Message Body</label>
                        <textarea value={dispatchDraft.body} onChange={e => setDispatchDraft({...dispatchDraft, body: e.target.value})} placeholder="Type your message here..." className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-5 text-sm font-medium text-slate-300 min-h-[300px] outline-none focus:border-blue-500 transition-colors leading-relaxed custom-scrollbar" />
                      </div>
                    </>
                  ) : (
                    <div className="bg-[#0f172a] rounded-3xl border border-white/10 overflow-hidden shadow-inner flex justify-center py-8">
                      <div dangerouslySetInnerHTML={{ __html: generateEmailPreviewHTML(dispatchDraft.body || "Your message will appear here...", dispatchDraft.subject) }} className="w-full" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 flex flex-col h-full">
                <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8 shadow-2xl flex-1 flex flex-col">
                  <div className="border-b border-white/5 pb-4 mb-6">
                    <h2 className="text-2xl font-black uppercase italic text-blue-400">2. Target Audience</h2>
                    <p className="text-xs text-slate-500 mt-1">Select the guardians who will receive this transmission.</p>
                  </div>
                  <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input type="text" placeholder="Filter recipients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <button onClick={handleSelectAll} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10 transition-all shrink-0">
                      {selectedGuardians.length > 0 ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="flex-1 bg-[#0a0f1d] border border-white/10 rounded-2xl overflow-y-auto max-h-[400px] custom-scrollbar p-2">
                    {filteredGuardians.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-10 font-bold italic">No eligible guardians found.</p>
                    ) : (
                      <div className="space-y-1">
                        {filteredGuardians.map(g => {
                          const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
                          const hasEmail = !!meta?.email?.trim();
                          const isSelected = selectedGuardians.includes(g.id);
                          return (
                            <div 
                              key={g.id} 
                              onClick={() => handleToggleGuardian(g.id, hasEmail)} 
                              className={`flex items-center gap-4 p-3 rounded-xl transition-all border ${hasEmail ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed opacity-40 bg-white/[0.01]'} ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'border-transparent'}`}
                            >
                              <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                                {isSelected && <CheckCircle2 size={12} className="text-white"/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm text-white truncate">{g.display_name}</p>
                                  {!hasEmail && <span className="text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Missing Email</span>}
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">{hasEmail ? meta.email : "Cannot select recipient"}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-white/5 mt-6 space-y-4">
                    <div className="flex justify-between items-center text-sm font-bold text-slate-400">
                      <span>Recipients Selected:</span>
                      <span className="text-blue-400 text-lg">{selectedGuardians.length}</span>
                    </div>
                    <button onClick={handleBulkDispatch} disabled={isSending || selectedGuardians.length === 0 || !dispatchDraft.subject || !dispatchDraft.body} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest italic flex items-center justify-center gap-2 hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20 disabled:opacity-30 disabled:cursor-not-allowed">
                      {isSending ? <Loader2 size={20} className="animate-spin"/> : <><Send size={20}/> Transmit Emails</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================== */}
          {/* TAB 3: TRANSMISSION HISTORY    */}
          {/* ============================== */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
               {groupedLogsArray.length === 0 ? (
                 <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-24 text-center text-slate-500 font-bold italic shadow-2xl">
                   No activity recorded yet.
                 </div>
               ) : (
                 groupedLogsArray.map((group: any) => {
                   const isExpanded = expandedHistory.includes(group.id);
                   return (
                     <div key={group.id} className="bg-white/[0.02] border border-white/10 rounded-[24px] overflow-hidden shadow-lg transition-all">
                       <button
                         onClick={() => toggleHistoryGroup(group.id)}
                         className="w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors text-left"
                       >
                         <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center border border-teal-500/20 text-teal-400">
                             <Users size={20} />
                           </div>
                           <div>
                             <h3 className="text-lg font-black uppercase italic text-white leading-none mb-1">{group.name}</h3>
                             <p className="text-xs text-slate-400">{group.email}</p>
                           </div>
                         </div>
                         <div className="flex items-center gap-6">
                           <div className="text-right hidden sm:block">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Transmissions</p>
                             <p className="text-sm font-bold text-teal-400">{group.logs.length}</p>
                           </div>
                           <div className="text-right hidden sm:block">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Last Sent</p>
                             <p className="text-sm font-bold text-slate-300">{new Date(group.latest).toLocaleDateString()}</p>
                           </div>
                           <div className={`p-2 rounded-full bg-white/5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                             <ChevronDown size={16} />
                           </div>
                         </div>
                       </button>

                       <AnimatePresence>
                         {isExpanded && (
                           <motion.div
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="border-t border-white/5"
                           >
                             <table className="w-full text-left">
                               <thead className="bg-black/20 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                 <tr>
                                   <th className="px-8 py-4">Sent Date/Time</th>
                                   <th className="px-8 py-4">Subject Line</th>
                                   <th className="px-8 py-4">Status</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-white/5 bg-[#020617]/30">
                                 {group.logs.map((log: any) => {
                                   const isAction = log.status === 'Action Taken';
                                   return (
                                     <tr key={log.id} className={`transition-colors ${isAction ? 'bg-purple-500/[0.02] hover:bg-purple-500/[0.05]' : 'hover:bg-white/[0.02]'}`}>
                                       <td className="px-8 py-4 align-middle">
                                         <span className="text-xs font-bold text-slate-300 block">{new Date(log.sent_at).toLocaleDateString()}</span>
                                         <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5"><Clock size={10}/> {new Date(log.sent_at).toLocaleTimeString()}</span>
                                       </td>
                                       <td className={`px-8 py-4 align-middle text-xs font-medium ${isAction ? 'text-purple-300 italic' : 'text-slate-300'}`}>
                                         {log.subject}
                                       </td>
                                       <td className="px-8 py-4 align-middle">
                                         <span className={`px-2.5 py-1 border rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${
                                           isAction 
                                           ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                           : 'bg-green-500/10 text-green-400 border-green-500/20'
                                         }`}>
                                           {isAction ? <Activity size={10}/> : <CheckCircle2 size={10}/>} {log.status}
                                         </span>
                                       </td>
                                     </tr>
                                   )
                                 })}
                               </tbody>
                             </table>
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>
                   );
                 })
               )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}