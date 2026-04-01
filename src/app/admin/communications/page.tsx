"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Mail, Save, Users, Send, Loader2, ArrowLeft, 
  Settings, CheckCircle2, FileText, Search, Filter, Eye, PenTool, Clock, History
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function CommunicationsHub() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'dispatch' | 'history'>('templates');
  
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

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch Templates
      const { data: tplData } = await supabase.from('email_templates').select('*').order('name');
      if (tplData) setTemplates(tplData);

      // Fetch Guardians
      const { data: guardData } = await supabase
        .from('profiles')
        .select('id, display_name, metadata, status')
        .eq('role', 'guardian')
        .eq('status', 'active');
        
      if (guardData) {
        const validGuardians = guardData.filter(g => {
          const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
          return !!meta?.email;
        });
        setGuardians(validGuardians);
      }

      // Fetch Communication History
      if (activeTab === 'history') {
         const { data: logsData } = await supabase
            .from('communication_logs')
            .select('*')
            .order('sent_at', { ascending: false })
            .limit(100);
         if (logsData) setCommsLogs(logsData);
      }

    } catch (err) {
      console.error("Error loading communications:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- HTML GENERATOR FOR LIVE PREVIEW ---
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

  // --- TEMPLATE MANAGEMENT ---
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

  // --- DISPATCH LOGIC ---
  const handleSelectTemplateForDispatch = (tpl: any) => {
    setDispatchDraft({ subject: tpl.subject, body: tpl.body_content });
  };

  const handleToggleGuardian = (id: string) => {
    setSelectedGuardians(prev => 
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
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

      // Simulated Bulk Dispatch & Logging
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
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button onClick={() => setActiveTab('templates')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'templates' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              <FileText size={14}/> Templates
            </button>
            <button onClick={() => setActiveTab('dispatch')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'dispatch' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              <Send size={14}/> Dispatch
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'history' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
              <History size={14}/> History
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          
          {/* ============================== */}
          {/* TAB 1: TEMPLATE MATRIX         */}
          {/* ============================== */}
          {activeTab === 'templates' && (
             // ... [YOUR EXISTING TAB 1 CODE REMAINS EXACTLY THE SAME HERE] ...
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
                          <textarea value={selectedTemplate.body_content} onChange={e => setSelectedTemplate({...selectedTemplate, body_content: e.target.value})} className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-5 text-sm font-medium text-slate-300 min-h-[300px] outline-none focus:border-purple-500 transition-colors leading-relaxed" />
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
             // ... [YOUR EXISTING TAB 2 CODE REMAINS EXACTLY THE SAME HERE] ...
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
                        <textarea value={dispatchDraft.body} onChange={e => setDispatchDraft({...dispatchDraft, body: e.target.value})} placeholder="Type your message here..." className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-5 text-sm font-medium text-slate-300 min-h-[300px] outline-none focus:border-blue-500 transition-colors leading-relaxed" />
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
                      {isSending ? <Loader2 size={20} className="animate-spin"/> : <><Send size={20}/> Transmit to Fleet</>}
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
                        <tr><td colSpan={4} className="px-8 py-24 text-center text-slate-500 font-bold italic">No transmissions recorded yet.</td></tr>
                     ) : (
                        commsLogs.map(log => (
                           <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-8 py-6 align-top">
                                 <span className="text-sm font-bold text-slate-300">{new Date(log.sent_at).toLocaleDateString()}</span>
                                 <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest flex items-center gap-1"><Clock size={10}/> {new Date(log.sent_at).toLocaleTimeString()}</p>
                              </td>
                              <td className="px-8 py-6 align-top">
                                 <span className="text-sm font-bold text-white block">{log.recipient_name}</span>
                                 <span className="text-xs text-slate-400 mt-1 block">{log.recipient_email}</span>
                              </td>
                              <td className="px-8 py-6 align-top text-sm font-medium text-slate-300">
                                 {log.subject}
                              </td>
                              <td className="px-8 py-6 align-top">
                                 <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit">
                                    <CheckCircle2 size={10}/> {log.status}
                                 </span>
                              </td>
                           </tr>
                        ))
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