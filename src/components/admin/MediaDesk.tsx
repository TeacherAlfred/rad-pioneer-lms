"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Image as ImageIcon, Users, CheckCircle2, X, Loader2, Tag, ChevronDown, Filter, Trash2, CheckSquare, Square, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function MediaDesk({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'upload' | 'tagging' | 'removals'>('upload');
  
  // Upload State
  const [eventName, setEventName] = useState("");
  const [customEvent, setCustomEvent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Tagging State
  const [recentMedia, setRecentMedia] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const isMultiSelectMode = multiSelectedIds.length > 0;

  // Removals State
  const [pendingRemovals, setPendingRemovals] = useState<any[]>([]);
  const [isProcessingRemoval, setIsProcessingRemoval] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const STANDARD_EVENTS = [
    "Term 1 Classes", "Term 2 Classes", "Polokwane Robotics Bootcamp", 
    "Pretoria Lessons", "Online MakeCode Session", "Custom Event..."
  ];

  // Live Timer for SLA Countdowns
  useEffect(() => {
    if (activeTab !== 'removals') return;
    const timer = setInterval(() => setNow(new Date()), 60000); // Update SLA every minute
    return () => clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    async function loadData() {
      const { data: studentData } = await supabase.from('profiles').select('id, display_name').eq('role', 'student').order('display_name');
      if (studentData) setStudents(studentData);
      fetchRecentMedia();
      fetchPendingRemovals();
    }
    loadData();
  }, [isOpen]);

  async function fetchRecentMedia() {
    const { data: mediaData } = await supabase.from('event_media').select(`*, media_tags ( student_id, profiles ( display_name ) )`).order('created_at', { ascending: false }).limit(50);
    if (mediaData) {
      const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
      const enrichedMedia = mediaData.map((m) => ({ 
        ...m, 
        signed_url: `${r2Url}/${m.bucket_path}`, 
        current_tags: m.media_tags || [] 
      }));
      setRecentMedia(enrichedMedia);
    }
  }

  async function fetchPendingRemovals() {
    const { data: removals } = await supabase
      .from('media_tags')
      .select(`
        id, removal_requested_at, removal_approved_by_admin, student_id,
        event_media ( id, bucket_path )
      `)
      .eq('removal_requested', true)
      .order('removal_requested_at', { ascending: false });

    if (removals && removals.length > 0) {
      const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
      const enriched = removals.map((r: any) => ({ 
        ...r, 
        signed_url: `${r2Url}/${r.event_media.bucket_path}`
      }));
      setPendingRemovals(enriched);
    } else {
      setPendingRemovals([]);
    }
  }

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalEventName = eventName === "Custom Event..." ? customEvent : eventName;
    if (!finalEventName || files.length === 0) return alert("Please select an event and at least one image.");

    setIsUploading(true); setUploadProgress(0); let successCount = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `events/${finalEventName.replace(/\s+/g, '-').toLowerCase()}/${fileName}`;

        // 1. Get the secure upload ticket from our new API
        const presignRes = await fetch('/api/upload/r2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath, fileType: file.type })
        });
        
        const { signedUrl } = await presignRes.json();
        if (!signedUrl) throw new Error("Failed to generate upload URL");

        // 2. Upload directly to Cloudflare R2 using the ticket
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        
        if (!uploadRes.ok) throw new Error("Failed to upload file to R2");

        // 3. Save the record to Supabase (so we know it exists)
        const { error: dbError } = await supabase.from('event_media').insert({ bucket_path: filePath, event_name: finalEventName });
        if (dbError) throw dbError;
        
        successCount++; setUploadProgress(Math.round((successCount / files.length) * 100));
      }
      
      alert(`Successfully uploaded ${successCount} images to Cloudflare R2!`);
      setFiles([]); setEventName(""); setCustomEvent("");
      setActiveTab('tagging'); fetchRecentMedia();
      
    } catch (err: any) { 
      alert("An error occurred during bulk upload: " + err.message); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const openTaggingModal = (media?: any) => {
    if (media) {
      setSelectedMedia(media);
      setSelectedStudentIds(media.current_tags.map((t: any) => t.student_id));
    } else {
      setSelectedMedia({ id: 'bulk', event_name: 'Bulk Tagging Session' });
      setSelectedStudentIds([]);
    }
  };

  const handleToggleMultiSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMultiSelectedIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
  };

  const handleToggleStudent = (id: string) => setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);

  const handleSaveTags = async () => {
    if (!selectedMedia) return;
    setIsSavingTags(true);
    const idsToProcess = selectedMedia.id === 'bulk' ? multiSelectedIds : [selectedMedia.id];

    try {
      await supabase.from('media_tags').delete().in('media_id', idsToProcess);
      if (selectedStudentIds.length > 0) {
        const newTagsPayload: any[] = [];
        idsToProcess.forEach(mId => { selectedStudentIds.forEach(sId => { newTagsPayload.push({ media_id: mId, student_id: sId }); }); });
        const { error } = await supabase.from('media_tags').insert(newTagsPayload);
        if (error) throw error;
      }
      setSelectedMedia(null); setMultiSelectedIds([]); fetchRecentMedia();
    } catch (err: any) { alert("Failed to save tags: " + err.message); } 
    finally { setIsSavingTags(false); }
  };

  const handleDeleteMedia = async (id: string, bucketPath: string) => {
    if(!confirm("Are you sure? This will delete the photo entirely.")) return;
    try {
      await supabase.from('event_media').delete().eq('id', id);
      await supabase.storage.from('student_media').remove([bucketPath]);
      fetchRecentMedia(); fetchPendingRemovals(); setSelectedMedia(null);
    } catch(err) { alert("Failed to delete media."); }
  };

  const handleApproveRemoval = async (tagId: string) => {
    setIsProcessingRemoval(tagId);
    try {
      await supabase.from('media_tags').update({ removal_approved_by_admin: true }).eq('id', tagId);
      fetchPendingRemovals();
    } catch(err) { alert("Failed to approve"); }
    finally { setIsProcessingRemoval(null); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} 
        className="relative w-full max-w-6xl bg-[#0a0f1c] border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30"><ImageIcon size={24} /></div>
            <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Media Desk</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Bulk Upload & Tagging Center</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-[#020617] p-1 rounded-xl border border-white/10 mr-4">
              <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'upload' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}>Upload</button>
              <button onClick={() => {setActiveTab('tagging'); fetchRecentMedia();}} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'tagging' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>Inbox</button>
              <button onClick={() => {setActiveTab('removals'); fetchPendingRemovals();}} className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'removals' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                Privacy
                {pendingRemovals.filter(r => !r.removal_approved_by_admin).length > 0 && (
                  <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] animate-pulse">
                    {pendingRemovals.filter(r => !r.removal_approved_by_admin).length}
                  </span>
                )}
              </button>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
          
          {/* TAB 1: BULK UPLOAD */}
          {activeTab === 'upload' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-[#0f172a] border border-white/5 p-6 rounded-3xl">
                <form onSubmit={handleBulkUpload} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Event Assignment</label>
                    <div className="relative">
                      <select required value={eventName} onChange={e => {setEventName(e.target.value); setCustomEvent("");}} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer">
                        <option value="" disabled>-- Select Event Type --</option>
                        {STANDARD_EVENTS.map(event => <option key={event} value={event}>{event}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    {eventName === "Custom Event..." && (
                      <input required type="text" placeholder="Type custom event name..." value={customEvent} onChange={e => setCustomEvent(e.target.value)} className="w-full mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-4 text-sm font-bold text-emerald-400 outline-none focus:border-emerald-500" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Bulk Image Select</label>
                    <div className="w-full relative bg-[#020617] border-2 border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center group hover:border-emerald-500/50 transition-all cursor-pointer overflow-hidden min-h-[200px]">
                      {files.length > 0 ? (
                        <div className="space-y-4 w-full">
                          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div>
                          <div>
                            <h4 className="text-xl font-black text-white italic tracking-tighter">{files.length} Photos Queued</h4>
                            <p className="text-xs text-slate-400 font-bold mt-1">Ready for deployment</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="text-slate-600 group-hover:text-emerald-400 mb-4 transition-colors" size={48} />
                          <div><p className="text-sm font-black text-white uppercase tracking-widest">Drop photos here</p><p className="text-xs text-slate-500 font-bold mt-1">Or click to browse files</p></div>
                        </>
                      )}
                      <input required type="file" multiple accept="image/*" onChange={e => { if (e.target.files) setFiles(Array.from(e.target.files)); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="text-emerald-400">Uploading...</span><span className="text-white">{uploadProgress}%</span></div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} className="h-full bg-emerald-500" /></div>
                    </div>
                  )}

                  <button type="submit" disabled={isUploading || files.length === 0 || (!eventName && !customEvent)} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all">
                     {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Push {files.length > 0 ? files.length : ''} Photos to DB
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: TAGGING INBOX */}
          {activeTab === 'tagging' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-black italic uppercase text-white tracking-tighter">Recent Uploads</h3>
                  <p className="text-xs text-slate-400 font-medium">Select multiple photos to tag in bulk, or click one to edit individually.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <AnimatePresence>
                    {isMultiSelectMode && (
                      <motion.button 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onClick={() => openTaggingModal()}
                        className="text-[10px] font-black uppercase text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg shadow-blue-900/40"
                      >
                        <Tag size={14}/> Tag Selected ({multiSelectedIds.length})
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <button onClick={fetchRecentMedia} className="text-[10px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5"><Filter size={12}/> Refresh Inbox</button>
                </div>
              </div>

              {recentMedia.length === 0 ? (
                <div className="text-center p-12 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                  <ImageIcon size={32} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 font-bold">No recent media found. Upload some photos first!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {recentMedia.map(media => {
                    const tagCount = media.current_tags.length;
                    const isChecked = multiSelectedIds.includes(media.id);
                    return (
                      <motion.div 
                        key={media.id} whileHover={{ y: -4 }} onClick={() => openTaggingModal(media)}
                        className={`relative aspect-square bg-[#020617] rounded-2xl border cursor-pointer overflow-hidden group shadow-lg ${isChecked ? 'border-blue-500 ring-2 ring-blue-500/20' : tagCount === 0 ? 'border-amber-500/50' : 'border-white/10 hover:border-blue-500/50'}`}
                      >
                        <div onClick={(e) => handleToggleMultiSelect(media.id, e)} className={`absolute top-2 left-2 z-20 p-1.5 rounded-lg transition-all ${isChecked ? 'bg-blue-600 text-white' : 'bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60'}`}>
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        {media.signed_url && <img src={media.signed_url} alt="event" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-3 pointer-events-none">
                          <div className="flex justify-end">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1 ${tagCount > 0 ? 'bg-blue-500/90 text-white' : 'bg-amber-500/90 text-black'}`}>
                              <Tag size={10} /> {tagCount}
                            </span>
                          </div>
                          <div><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest line-clamp-1">{media.event_name}</p></div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRIVACY & REMOVALS */}
          {activeTab === 'removals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-black italic uppercase text-white tracking-tighter">Removal Requests</h3>
                  <p className="text-xs text-slate-400 font-medium">Parents have a 48 hour grace period before auto-deletion.</p>
                </div>
                <button onClick={fetchPendingRemovals} className="text-[10px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5"><Filter size={12}/> Refresh Queue</button>
              </div>

              {pendingRemovals.length === 0 ? (
                <div className="text-center p-12 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-3" />
                  <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs">Inbox Zero</p>
                  <p className="text-slate-400 font-medium text-sm mt-1">No pending privacy requests.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingRemovals.map(req => {
                    const isApproved = req.removal_approved_by_admin;
                    
                    // SLA Timer Calculation
                    let d = new Date(req.removal_requested_at);
                    d.setHours(d.getHours() + 48);
                    if (d.getMinutes() > 0 || d.getSeconds() > 0 || d.getMilliseconds() > 0) d.setHours(d.getHours() + 1, 0, 0, 0);
                    
                    const timeDiff = d.getTime() - now.getTime();
                    const isBreached = timeDiff < 0;
                    
                    const absDiff = Math.abs(timeDiff);
                    const hoursLeft = Math.floor(absDiff / (1000 * 60 * 60));
                    const minsLeft = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
                    
                    const slaText = isBreached 
                      ? `SLA BREACHED BY ${hoursLeft}H ${minsLeft}M` 
                      : `SLA: ${hoursLeft}H ${minsLeft}M LEFT`;
                    
                    const slaColor = isBreached ? "text-rose-400" : (hoursLeft < 12 ? "text-amber-400" : "text-emerald-400");
                    const slaBg = isBreached ? "bg-rose-500/10 border-rose-500/20" : "bg-white/5 border-white/5";

                    return (
                      <div key={req.id} className="bg-[#020617] border border-white/10 rounded-3xl p-5 shadow-lg flex flex-col gap-4 relative overflow-hidden group">
                        {isApproved && <div className="absolute inset-0 border-2 border-rose-500/30 rounded-3xl pointer-events-none" />}
                        
                        <div className="flex gap-4 items-center relative z-10">
                          <div className="w-24 h-24 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-white/5 shadow-inner">
                            {req.signed_url && <img src={req.signed_url} className={`w-full h-full object-cover ${isApproved ? 'grayscale blur-sm' : ''}`} alt="flagged" />}
                          </div>
                          
                          <div className="flex-1">
                            {/* Prominent SLA Tag */}
                            <div className={`flex flex-col justify-center items-start gap-1.5 p-3 rounded-xl border ${slaBg}`}>
                              <div className="flex items-center gap-2">
                                <Clock size={14} className={slaColor} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${slaColor}`}>
                                  {isBreached ? "SLA Breached" : "Time Remaining"}
                                </span>
                              </div>
                              <span className={`text-sm font-black tracking-widest ${slaColor}`}>
                                {hoursLeft}H {minsLeft}M
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-auto pt-2 relative z-10">
                          <button 
                            onClick={() => handleApproveRemoval(req.id)}
                            disabled={isApproved || isProcessingRemoval === req.id}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center items-center gap-2 border ${isApproved ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}
                          >
                            {isProcessingRemoval === req.id ? <Loader2 size={14} className="animate-spin" /> : isApproved ? <CheckCircle2 size={14} /> : <AlertTriangle size={14}/>}
                            {isApproved ? 'Locked' : 'Acknowledge'}
                          </button>
                          
                          <button 
                            onClick={() => handleDeleteMedia(req.event_media.id, req.event_media.bucket_path)}
                            className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors border border-rose-500/50 shadow-md"
                            title="Force Delete Immediately"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </motion.div>

      {/* --- TAGGING MODAL (The Rapid Editor) --- */}
      <AnimatePresence>
        {selectedMedia && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedMedia(null)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh]">
              
              <div className="flex-1 bg-black relative flex items-center justify-center min-h-[300px]">
                <button onClick={() => setSelectedMedia(null)} className="absolute top-4 left-4 z-10 p-2 bg-black/50 hover:bg-white/10 text-white rounded-full transition-colors md:hidden"><X size={20}/></button>
                {selectedMedia.id === 'bulk' ? (
                    <div className="text-center p-10">
                        <div className="w-20 h-20 bg-blue-500/20 text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-xl"><ImageIcon size={40} /></div>
                        <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">Bulk Tagging</h4>
                        <p className="text-slate-400 text-sm mt-2">Applying tags to {multiSelectedIds.length} selected photos.</p>
                    </div>
                ) : (
                    <>
                        <div className="absolute top-4 right-4 z-10">
                           <button onClick={() => handleDeleteMedia(selectedMedia.id, selectedMedia.bucket_path)} className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl backdrop-blur-md transition-all shadow-lg border border-rose-500/30" title="Delete Photo Permanently"><Trash2 size={16} /></button>
                        </div>
                        {selectedMedia.signed_url && <img src={selectedMedia.signed_url} alt="tagging view" className="w-full h-full object-contain" />}
                    </>
                )}
              </div>

              <div className="w-full md:w-96 bg-[#0f172a] border-l border-white/5 flex flex-col h-[50vh] md:h-auto shrink-0">
                <div className="p-6 border-b border-white/5 shrink-0 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Assign Students</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedMedia.id === 'bulk' ? 'Select students to add to all items' : 'Photo will appear on their dashboard'}</p>
                  </div>
                  <button onClick={() => setSelectedMedia(null)} className="hidden md:block text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
                  {students.map(student => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    return (
                      <div key={student.id} onClick={() => handleToggleStudent(student.id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-600/20 border-blue-500/50 shadow-inner' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                        <span className={`text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>{student.display_name}</span>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-slate-600'}`}>
                          {isSelected && <CheckCircle2 size={14} />}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="p-6 border-t border-white/5 bg-black/20 shrink-0">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-1">
                    <span>Targeting:</span><span className="text-white">{selectedStudentIds.length} Pioneers</span>
                  </div>
                  <button onClick={handleSaveTags} disabled={isSavingTags} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
                    {isSavingTags ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />} {selectedMedia.id === 'bulk' ? `Publish to ${multiSelectedIds.length} Photos` : 'Save Tags & Publish'}
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}