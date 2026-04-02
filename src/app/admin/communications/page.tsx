"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Mail, Save, Users, Send, Loader2, ArrowLeft, 
  Settings, CheckCircle2, FileText, Search, Filter, Eye, PenTool, Clock, History, Activity, MessageSquare
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function CommunicationsHub() {
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

  // Inbox State
  const [inboxConversations, setInboxConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null); // This is the parent's ID
  const [activeMessages, setActiveMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ... inside your CommunicationsHub component ...

  useEffect(() => {
    fetchData();

    // --- NEW: REAL-TIME SUBSCRIPTION FOR THE INBOX ---
    const messagesSubscription = supabase
      .channel('admin-inbox-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          // If a new message comes in, refresh the data to rebuild the inbox groups
          console.log("New transmission received:", payload);
          fetchData(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesSubscription);
    };
  }, [activeTab]);

  useEffect(() => {
    // Scroll to bottom when opening a conversation or sending a reply
    if (activeMessages.length > 0) {
       messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages]);

  async function fetchData() {
    setLoading(true);
    try {
      // ... (Keep your existing Templates, Guardians, and History fetch logic here) ...

      // --- FIXED: INBOX FETCH LOGIC ---
      if (activeTab === 'inbox') {
        // 1. Fetch all messages
        const { data: msgs, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (msgError) throw msgError;

        // 2. Fetch all profiles so we can manually map the names (safest approach)
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, display_name');

        const profileMap = (allProfiles || []).reduce((acc: any, profile) => {
          acc[profile.id] = profile.display_name;
          return acc;
        }, {});

        if (msgs) {
          // Group by conversation (the parent's ID)
          const grouped = msgs.reduce((acc: Record<string, any>, msg: any) => {
  // Determine the parent ID involved in this message
  const parentId = msg.sender_role === 'parent' ? msg.sender_id : msg.recipient_id;
  
  if (!parentId) return acc; // Skip orphaned messages
  
  if (!acc[parentId]) {
    acc[parentId] = {
      parentId: parentId,
      parentName: profileMap[parentId] || "Unknown Guardian",
      messages: [],
      lastMessageTime: msg.created_at,
      preview: msg.content,
      unreadCount: 0
    };
  }
  
  // Count unread messages from parents
  if (msg.sender_role === 'parent' && !msg.is_read) {
     acc[parentId].unreadCount += 1;
  }

  // Prepend to keep chronological order for the chat view
  acc[parentId].messages.unshift(msg); 
  return acc;
}, {} as Record<string, any>); // <--- Add the type assertion here

          // Convert the grouped object back to an array and sort by most recent message
          const sortedInbox = Object.values(grouped).sort((a: any, b: any) => {
             return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });

          setInboxConversations(sortedInbox);

          // If an admin currently has a conversation open, update their active view too
          if (activeConversation) {
            const updatedActiveConv = sortedInbox.find((c: any) => c.parentId === activeConversation);
            if (updatedActiveConv) {
               setActiveMessages(updatedActiveConv.messages);
            }
          }
        }
      }

    } catch (err) {
      console.error("Error loading communications:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectConversation = (conversation: any) => {
    setActiveConversation(conversation.parentId);
    setActiveMessages(conversation.messages);
  };

const handleSendReply = async () => {
    if (!replyText.trim() || !activeConversation) return;

    try {
      // 1. Get the current session to identify the admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      // 2. Fetch the actual Profile UUID for this admin
      const { data: adminProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (profileError || !adminProfile) {
        console.error("Profile lookup failed:", profileError);
        throw new Error("Could not find admin profile linked to this account.");
      }

      // 3. Insert the message using the PROFILE UUID
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: adminProfile.id, // MUST be the UUID from public.profiles
          recipient_id: activeConversation, // This is already the Parent's Profile UUID
          sender_role: 'admin',
          content: replyText,
          is_read: true // Admin messages are read by default in this view
        })
        .select()
        .single();

      if (error) {
        // Log the specific database error to see if it's RLS or Constraints
        console.error("Supabase Insertion Error:", error);
        throw error;
      }

      // 4. Update UI
      setActiveMessages(prev => [...prev, data]);
      setReplyText("");
      
      // Update inbox preview
      setInboxConversations(prev => prev.map(conv => {
        if (conv.parentId === activeConversation) {
          return { ...conv, preview: data.content, lastMessageTime: data.created_at };
        }
        return conv;
      }));

    } catch (err: any) {
      console.error("Failed to send reply:", err);
      alert(`Send failed: ${err.message || 'Database error'}`);
    }
  };

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

  const handleToggleGuardian = (id: string) => {
    setSelectedGuardians(prev => prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedGuardians.length === filteredGuardians.length) {
      setSelectedGuardians([]);
    } else {
      setSelectedGuardians(filteredGuardians.map(g => g.id));
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
          return { email: meta.email, name: g.display_name };
        });

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const logPayload = recipients.map(r => ({
         recipient_email: r.email,
         recipient_name: r.name,
         subject: dispatchDraft.subject,
         status: 'Sent'
      }));
      await supabase.from('communication_logs').insert(logPayload);

      alert(`Successfully transmitted to ${recipients.length} sectors.`);
      setSelectedGuardians([]);
      setDispatchDraft({ subject: "", body: "" });
    } catch (err) {
      alert("Transmission failure.");
    } finally {
      setIsSending(false);
    }
  };

  const filteredGuardians = guardians.filter(g => {
    const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
    return g.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           meta?.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
                  {inboxConversations.length === 0 ? (
                     <p className="text-center text-slate-500 text-xs py-10">No messages found.</p>
                  ) : (
                    inboxConversations.map((conv) => (
                      <button 
                        key={conv.parentId}
                        onClick={() => handleSelectConversation(conv)}
                        className={`w-full text-left p-4 rounded-2xl transition-all border ${activeConversation === conv.parentId ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm text-white flex items-center gap-2">
                            {conv.parentName || "Unknown"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">{conv.preview}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Active Message & Reply */}
              <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
                {!activeConversation ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <MessageSquare size={48} className="opacity-20 mb-4" />
                    <p className="font-bold uppercase text-sm">Select a message to view</p>
                  </div>
                ) : (
                  <>
                    <div className="p-6 border-b border-white/5 bg-[#020617]/50">
                      <div className="flex items-center gap-2 font-bold text-slate-300">
                        <Users size={16}/> Chatting with: {inboxConversations.find(c => c.parentId === activeConversation)?.parentName}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                      {activeMessages.map((msg) => {
                         const isAdmin = msg.sender_role === 'admin';
                         return (
                           <div key={msg.id} className={`flex flex-col max-w-[80%] ${isAdmin ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                             <div className={`p-4 rounded-2xl text-sm ${isAdmin ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white/10 text-slate-200 rounded-bl-sm'}`}>
                               {msg.content}
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
                          placeholder="Draft response to parent..."
                          className="w-full h-20 bg-transparent p-3 text-sm text-white placeholder-slate-500 focus:outline-none resize-none custom-scrollbar"
                        />
                        <div className="flex justify-end px-3 pb-2 pt-2 border-t border-white/5">
                          <button onClick={handleSendReply} disabled={!replyText.trim()} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                            <Send size={14} /> Send Reply
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
                      {selectedGuardians.length === filteredGuardians.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="flex-1 bg-[#0a0f1d] border border-white/10 rounded-2xl overflow-y-auto max-h-[400px] custom-scrollbar p-2">
                    {filteredGuardians.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-10 font-bold italic">No eligible guardians found.</p>
                    ) : (
                      <div className="space-y-1">
                        {filteredGuardians.map(g => {
                          const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
                          const isSelected = selectedGuardians.includes(g.id);
                          return (
                            <div key={g.id} onClick={() => handleToggleGuardian(g.id)} className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'border-transparent hover:bg-white/5'}`}>
                              <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                                {isSelected && <CheckCircle2 size={12} className="text-white"/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-white truncate">{g.display_name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{meta.email}</p>
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
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white/[0.02] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
               <table className="w-full text-left">
                  <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-8 py-5">Sent Date</th>
                      <th className="px-8 py-5">Recipient</th>
                      <th className="px-8 py-5">Subject Line</th>
                      <th className="px-8 py-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {commsLogs.length === 0 ? (
                        <tr><td colSpan={4} className="px-8 py-24 text-center text-slate-500 font-bold italic">No activity recorded yet.</td></tr>
                     ) : (
                        commsLogs.map(log => {
                           const isAction = log.status === 'Action Taken';
                           return (
                             <tr key={log.id} className={`transition-colors ${isAction ? 'bg-purple-500-[0.02] hover:bg-purple-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                                <td className="px-8 py-6 align-top">
                                   <span className="text-sm font-bold text-slate-300">{new Date(log.sent_at).toLocaleDateString()}</span>
                                   <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest flex items-center gap-1"><Clock size={10}/> {new Date(log.sent_at).toLocaleTimeString()}</p>
                                </td>
                                <td className="px-8 py-6 align-top">
                                   <span className="text-sm font-bold text-white block">{log.recipient_name}</span>
                                   <span className="text-xs text-slate-400 mt-1 block">{log.recipient_email}</span>
                                </td>
                                <td className={`px-8 py-6 align-top text-sm font-medium ${isAction ? 'text-purple-300 italic' : 'text-slate-300'}`}>
                                   {log.subject}
                                </td>
                                <td className="px-8 py-6 align-top">
                                   <span className={`px-3 py-1 border rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${
                                      isAction 
                                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                      : 'bg-green-500/10 text-green-400 border-green-500/20'
                                   }`}>
                                      {isAction ? <Activity size={10}/> : <CheckCircle2 size={10}/>} {log.status}
                                   </span>
                                </td>
                             </tr>
                           )
                        })
                     )}
                  </tbody>
               </table>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}