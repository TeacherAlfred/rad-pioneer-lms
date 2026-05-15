"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  UploadCloud, Image as ImageIcon, CheckCircle2, 
  X, Loader2, Tag, ChevronDown, Filter, Trash2, CheckSquare, Square,
  ArrowLeft, FolderHeart, Plus, Search, ChevronLeft, ChevronRight, Check, AlertTriangle, BookOpen,
  Users,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import MediaGallery from "@/components/ui/MediaGallery"; 
import MediaDispatchCart, { DispatchItem } from "@/components/admin/MediaDispatchCart";

export default function MediaCommandCenter() {
  const [activeTab, setActiveTab] = useState<'upload' | 'inbox' | 'gallery' | 'directory'>('inbox');
  // --- DIRECTORY / STATS STATE ---
  const [selectedStatsStudent, setSelectedStatsStudent] = useState<{id: string, name: string} | null>(null);
  // --- DISPATCH CART STATE ---
  const [dispatchCart, setDispatchCart] = useState<DispatchItem[]>([]);
  
  // Upload State
  const [eventName, setEventName] = useState("");
  const [customEvent, setCustomEvent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Data State
  const [inboxMedia, setInboxMedia] = useState<any[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination Limits
  const [inboxLimit, setInboxLimit] = useState(30);

  // Tagging Modal Queue State
  const [taggingQueue, setTaggingQueue] = useState<any[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Bulk / Selection State
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const isMultiSelectMode = multiSelectedIds.length > 0;

  // Derived states
  const currentMedia = taggingQueue[queueIndex] || null;
  const isLastInQueue = isBulkMode || queueIndex === taggingQueue.length - 1;

  // Derived: Removal Requests
  const pendingRemovals = useMemo(() => {
    return galleryMedia.filter(m => m.current_tags?.some((t: any) => t.removal_requested));
  }, [galleryMedia]);

  const handleAddToDispatch = (media: any) => {
    // We assume media object contains media_tags and profiles relations
    const tag = media.current_tags?.[0]; 
    if (!tag || !tag.profiles?.linked_parent_id) {
      alert("This image is not tagged to a student with a registered guardian.");
      return;
    }

    // Block adding if it's a different guardian (force one parent per dispatch)
    if (dispatchCart.length > 0 && dispatchCart[0].guardian_id !== tag.profiles.linked_parent_id) {
      alert("You are currently building a dispatch for a different parent. Please clear the cart or finish dispatching first.");
      return;
    }

    // Avoid duplicates
    if (dispatchCart.some(i => i.media_id === media.id)) return;

    // We assume you have the parent's info. If your SQL query for fetching media 
    // doesn't fetch the parent profile, we might need a quick database fetch here.
    // For now, let's assume we can fetch the guardian details quickly:
    
    supabase.from('profiles').select('display_name, metadata').eq('id', tag.profiles.linked_parent_id).single()
      .then(({data: guardian}) => {
        if (guardian) {
          const newItem: DispatchItem = {
            media_id: media.id,
            url: media.full_url,
            student_id: tag.student_id,
            student_name: tag.profiles.display_name,
            guardian_id: tag.profiles.linked_parent_id,
            guardian_name: guardian.display_name,
            guardian_phone: guardian.metadata?.phone || "0000000000",
            taken_at: media.taken_at || media.created_at
          };
          setDispatchCart(prev => [...prev, newItem]);
        }
      });
  };

  // Derived: Student Stats
  const studentStats = useMemo(() => {
    const stats: Record<string, { id: string, name: string, totalCount: number, visibleCount: number }> = {};
    galleryMedia.forEach(media => {
      media.current_tags?.forEach((tag: any) => {
        if (!stats[tag.student_id]) {
          stats[tag.student_id] = { 
            id: tag.student_id, 
            name: tag.profiles?.display_name || "Unknown", 
            totalCount: 0, 
            visibleCount: 0 
          };
        }
        stats[tag.student_id].totalCount++;
        if (!tag.is_hidden) {
          stats[tag.student_id].visibleCount++;
        }
      });
    });
    return Object.values(stats).sort((a, b) => b.totalCount - a.totalCount);
  }, [galleryMedia]);

  // Derived: Dynamic Event List from Database
  const dynamicEvents = useMemo(() => {
    // Combine all fetched media
    const allMedia = [...inboxMedia, ...galleryMedia];
    // Extract event names, filter out empties, and make them unique
    const uniqueEvents = new Set(allMedia.map(m => m.event_name).filter(Boolean));
    // Return an alphabetically sorted array
    return Array.from(uniqueEvents).sort();
  }, [inboxMedia, galleryMedia]);

  useEffect(() => {
    async function loadData() {
      const { data: studentData } = await supabase.from('profiles').select('id, display_name').eq('role', 'student').order('display_name');
      if (studentData) setStudents(studentData);
      await fetchAllMedia();
    }
    loadData();
  }, []);

  async function fetchAllMedia() {
    setIsLoading(true);
    try {
      const { data: mediaData, error } = await supabase
        .from('event_media')
        .select(`*, media_tags ( student_id, rating, removal_requested, is_hidden, profiles ( display_name, linked_parent_id ) )`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      if (mediaData) {
        const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

        const enrichedMedia = mediaData.map((m) => {
          // Cloudflare R2 Public URLs are static and permanent, no need for complex signing!
          const fileUrl = `${r2Url}/${m.bucket_path}`;

          return {
            ...m,
            signed_url: fileUrl, // We use the same fast URL for the thumbnail grid
            full_url: fileUrl,   // And for the expanded lightbox
            current_tags: m.media_tags || []
          };
        });

        setInboxMedia(enrichedMedia.filter(m => !m.is_processed));
        setGalleryMedia(enrichedMedia.filter(m => m.is_processed));
      }
    } catch (e) {
      console.error("Failed to fetch media", e);
    } finally {
      setIsLoading(false);
      setMultiSelectedIds([]);
    }
  }

  const filteredStudents = useMemo(() => {
    if (studentSearch.trim().length >= 3) {
      const lowerQuery = studentSearch.toLowerCase();
      return students.filter(student => (student.display_name || "").toLowerCase().includes(lowerQuery));
    }
    return students;
  }, [students, studentSearch]);

  // --- ACTIONS ---

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalEventName = eventName === "Custom Event..." ? customEvent : eventName;
    if (!finalEventName || files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const folderName = finalEventName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const filePath = `events/${folderName}/${fileName}`;
        
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
        
        // 3. Grab native file timestamp for EXIF fallback
        const fileDate = new Date(file.lastModified).toISOString();

        // 4. Save the record to Supabase Database (so we know it exists)
        await supabase.from('event_media').insert({ 
          bucket_path: filePath, 
          event_name: finalEventName,
          taken_at: fileDate
        });
        
        successCount++;
        setUploadProgress(Math.round((successCount / files.length) * 100));
      }
      setFiles([]); setEventName(""); setCustomEvent(""); setActiveTab('inbox');
      await fetchAllMedia();
    } catch (err: any) { 
      alert("Error: " + err.message); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const openSingleTagging = (media: any) => {
    setTaggingQueue([media]); setQueueIndex(0); setIsBulkMode(false);
    setSelectedStudentIds(media.current_tags.map((t: any) => t.student_id));
  };

  const openSequenceTagging = () => {
    const queue = inboxMedia.filter(m => multiSelectedIds.includes(m.id)).map(m => ({ ...m, isInbox: true }));
    if (queue.length === 0) return;
    setTaggingQueue(queue); setQueueIndex(0); setIsBulkMode(false);
    setSelectedStudentIds(queue[0].current_tags.map((t: any) => t.student_id));
  };

  const openBulkTagging = () => {
    setTaggingQueue([{ id: 'bulk', event_name: 'Bulk Tagging Session' }]);
    setQueueIndex(0); setIsBulkMode(true); setSelectedStudentIds([]);
  };

  const closeTaggingModal = () => {
    setTaggingQueue([]); setQueueIndex(0); setIsBulkMode(false); setStudentSearch(""); 
  };

  const handleSaveTags = async (markAsDone: boolean) => {
    if (!currentMedia) return;
    setIsSavingTags(true);
    const idsToProcess = isBulkMode ? multiSelectedIds : [currentMedia.id];

    try {
      await supabase.from('media_tags').delete().in('media_id', idsToProcess);
      
      if (selectedStudentIds.length > 0) {
        const newTagsPayload: any[] = [];
        idsToProcess.forEach(mId => selectedStudentIds.forEach(sId => newTagsPayload.push({ media_id: mId, student_id: sId })));
        await supabase.from('media_tags').insert(newTagsPayload);
      }

      if (markAsDone) await supabase.from('event_media').update({ is_processed: true }).in('id', idsToProcess);

      if (!isBulkMode) {
        const updatedQueue = [...taggingQueue];
        updatedQueue[queueIndex].current_tags = selectedStudentIds.map(id => ({ student_id: id }));
        setTaggingQueue(updatedQueue);
      }

      if (isLastInQueue) {
        closeTaggingModal();
        if (markAsDone && isBulkMode) setMultiSelectedIds([]);
        await fetchAllMedia();
      } else {
        const nextIndex = queueIndex + 1;
        setQueueIndex(nextIndex);
        setSelectedStudentIds(taggingQueue[nextIndex].current_tags.map((t: any) => t.student_id));
      }
    } catch (err: any) { alert("Failed to save tags: " + err.message); } finally { setIsSavingTags(false); }
  };

  const handleMarkAsDone = async (idsToMark: string[], isDone: boolean) => {
    await supabase.from('event_media').update({ is_processed: isDone }).in('id', idsToMark);
    await fetchAllMedia();
  };

  const handleDeleteMedia = async (id: string, bucketPath: string) => {
    if(!confirm("Are you sure? This will delete the photo entirely.")) return;
    try {
      await supabase.from('event_media').delete().eq('id', id);
      await supabase.storage.from('student_media').remove([bucketPath]);
      const newQueue = taggingQueue.filter(m => m.id !== id);
      if (newQueue.length === 0) closeTaggingModal();
      else { setTaggingQueue(newQueue); setQueueIndex(0); setSelectedStudentIds(newQueue[0].current_tags.map((t: any) => t.student_id)); }
      await fetchAllMedia();
    } catch(err) { alert("Failed to delete media."); }
  };

  const handleApproveRemoval = async (id: string, bucketPath: string) => {
    if(!confirm("Approve removal? This deletes the photo permanently from the database and storage.")) return;
    try {
      await supabase.from('event_media').delete().eq('id', id);
      await supabase.storage.from('student_media').remove([bucketPath]);
      await fetchAllMedia();
    } catch(err) { alert("Failed to delete."); }
  };

  const handleBulkDelete = async () => {
    const count = multiSelectedIds.length;
    if (!confirm(`Are you sure you want to delete ${count} photos? This will permanently remove them from storage and all dashboards.`)) return;

    setIsLoading(true);
    try {
      const itemsToDelete = inboxMedia.filter(m => multiSelectedIds.includes(m.id));
      const paths = itemsToDelete.map(m => m.bucket_path);

      const { error: dbError } = await supabase.from('event_media').delete().in('id', multiSelectedIds);
      if (dbError) throw dbError;

      const { error: storageError } = await supabase.storage.from('student_media').remove(paths);
      if (storageError) throw storageError;

      setMultiSelectedIds([]);
      await fetchAllMedia();
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete photos: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleHide = async (mediaId: string, studentId: string, currentlyHidden: boolean) => {
    try {
      // Instantly update the UI optimistically for a snappy feel
      setGalleryMedia(prev => prev.map(m => {
        if (m.id === mediaId) {
          return {
            ...m,
            current_tags: m.current_tags.map((t: any) => t.student_id === studentId ? { ...t, is_hidden: !currentlyHidden } : t)
          };
        }
        return m;
      }));

      // Fire to database in the background
      await supabase.from('media_tags').update({ is_hidden: !currentlyHidden }).match({ media_id: mediaId, student_id: studentId });
    } catch (err) {
      alert("Failed to update visibility.");
      fetchAllMedia(); // Revert on failure
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
             <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
            </Link>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Media_<span className="text-emerald-500">Gallery</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Upload, Tag, and Archive Student Media</p>
            </div>
          </div>
          
          <div className="flex bg-[#0f172a] border border-white/10 rounded-2xl p-1 overflow-x-auto">
            <button onClick={() => setActiveTab('inbox')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'inbox' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}>
              Tagging Inbox <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">{inboxMedia.length}</span>
            </button>
            <button onClick={() => setActiveTab('gallery')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'gallery' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-500 hover:text-slate-300"}`}>
              <FolderHeart size={14}/> RAD Gallery
            </button>
            <button onClick={() => setActiveTab('directory')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'directory' ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-slate-500 hover:text-slate-300"}`}>
              <BookOpen size={14}/> Student Stats
            </button>
            <button onClick={() => setActiveTab('upload')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'upload' ? "bg-white text-slate-900 shadow-lg shadow-white/20" : "text-slate-500 hover:text-slate-300"}`}>
              <UploadCloud size={14}/> Upload
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="animate-spin text-emerald-500" size={40} />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            
            {/* --- TAB 1: INBOX --- */}
            {activeTab === 'inbox' && (
              <div className="space-y-6">
                
                {pendingRemovals.length > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertTriangle className="text-rose-500" />
                      <h3 className="text-lg font-black uppercase text-rose-400 tracking-widest">Removal Requests ({pendingRemovals.length})</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {pendingRemovals.map(media => (
                        <div key={media.id} className="relative aspect-square bg-[#0a0f1c] rounded-xl border border-rose-500/30 overflow-hidden group">
                           {media.signed_url ? <img src={media.signed_url} className="w-full h-full object-cover opacity-50 grayscale" /> : null}
                           <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleApproveRemoval(media.id, media.bucket_path)} className="text-[10px] font-black uppercase bg-rose-500 text-white px-3 py-2 rounded-lg">Approve & Delete</button>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-end bg-[#0f172a] border border-white/5 p-6 rounded-3xl overflow-x-auto custom-scrollbar">
                  <div className="shrink-0 mr-4">
                    <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">Needs Tagging</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Select photos to tag students, then mark them as done.</p>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <AnimatePresence>
                    {isMultiSelectMode && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-2">
                        <button onClick={openSequenceTagging} className="text-[10px] font-black uppercase text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg">
                            <ImageIcon size={14}/> Tag 1-by-1 ({multiSelectedIds.length})
                        </button>
                        
                        <button onClick={openBulkTagging} className="text-[10px] font-black uppercase text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg">
                            <Tag size={14}/> Bulk Tag
                        </button>

                        <button onClick={() => handleMarkAsDone(multiSelectedIds, true)} className="text-[10px] font-black uppercase text-slate-900 bg-emerald-400 hover:bg-emerald-300 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg">
                            <CheckCircle2 size={14}/> Mark Done
                        </button>

                        <button onClick={handleBulkDelete} className="text-[10px] font-black uppercase text-white bg-rose-600 hover:bg-rose-500 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg transition-all">
                            <Trash2 size={14}/> Delete ({multiSelectedIds.length})
                        </button>
                        </motion.div>
                    )}
                    </AnimatePresence>

                    {inboxMedia.length > 0 && (
                      <button onClick={() => setMultiSelectedIds(multiSelectedIds.length === inboxMedia.length ? [] : inboxMedia.map(m=>m.id))} className="text-[10px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5 transition-colors">
                        {multiSelectedIds.length === inboxMedia.length ? <Square size={12}/> : <CheckSquare size={12}/>} 
                        {multiSelectedIds.length === inboxMedia.length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>
                </div>

                {inboxMedia.length === 0 ? (
                  <div className="text-center p-20 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed">
                    <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-4" />
                    <p className="text-white font-black text-xl italic uppercase tracking-tighter">Inbox Zero!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {inboxMedia.slice(0, inboxLimit).map(media => {
                      const isChecked = multiSelectedIds.includes(media.id);
                      return (
                        <div key={media.id} onClick={() => openSingleTagging({ ...media, isInbox: true })} className={`relative aspect-square bg-[#0a0f1c] rounded-2xl border cursor-pointer overflow-hidden group shadow-lg ${isChecked ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/10'}`}>
                          <div onClick={(e) => {e.stopPropagation(); setMultiSelectedIds(p => p.includes(media.id) ? p.filter(id => id !== media.id) : [...p, media.id]);}} className={`absolute top-2 left-2 z-20 p-2 rounded-lg transition-all ${isChecked ? 'bg-blue-600 text-white' : 'bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80'}`}>
                            {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </div>
                          {media.signed_url ? <img src={media.signed_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" /> : null}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-between p-2 pointer-events-none">
                            <div className="flex justify-end"><span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${media.current_tags.length > 0 ? 'bg-blue-500 text-white' : 'bg-amber-500 text-black'}`}><Tag size={8} /> {media.current_tags.length}</span></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 2: GALLERY --- */}
            {activeTab === 'gallery' && (
              <MediaGallery 
                media={galleryMedia} 
                viewerRole="admin" 
                onMediaClick={(media) => openSingleTagging({ ...media, isGallery: true })} 
                onRefresh={fetchAllMedia}
                onAddToDispatch={handleAddToDispatch} // <-- ADD THIS LINE
                onDelete={async (id, bucketPath) => {
                  await supabase.from('event_media').delete().eq('id', id);
                  await supabase.storage.from('student_media').remove([bucketPath]);
                  await fetchAllMedia();
                }}
              />
            )}

            {/* --- TAB 3: STUDENT DIRECTORY --- */}
            {activeTab === 'directory' && (
              <div className="space-y-6">
                <div className="bg-[#0f172a] border border-white/5 p-8 rounded-[40px] shadow-2xl">
                  <h3 className="text-xl font-black italic uppercase text-white tracking-tighter mb-6 flex items-center gap-3"><Users className="text-purple-500"/> Student Tag Maps</h3>
                  
                  {studentStats.length === 0 ? (
                    <p className="text-slate-400 text-sm">No students have been tagged in gallery photos yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {studentStats.map((stat, i) => (
                        <div 
                          key={i} 
                          onClick={() => setSelectedStatsStudent(stat)}
                          className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group hover:scale-[1.02]"
                        >
                          <span className="font-bold text-sm text-slate-300 truncate pr-2 group-hover:text-blue-400 transition-colors">{stat.name}</span>
                          <span className="shrink-0 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-500/30 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            {stat.visibleCount} / {stat.totalCount} Visible
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 4: UPLOAD --- */}
            {activeTab === 'upload' && (
              <div className="max-w-2xl mx-auto bg-[#0f172a] border border-white/5 p-8 rounded-[40px] shadow-2xl">
                  <form onSubmit={handleBulkUpload} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Select Event / Folder</label>
                      <select required value={eventName} onChange={e => {setEventName(e.target.value); setCustomEvent("");}} className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-emerald-500">
                        <option value="" disabled>-- Choose an Event --</option>
                        
                        {/* Dynamically populate from database */}
                        {dynamicEvents.map(event => (
                          <option key={event as string} value={event as string}>{event as string}</option>
                        ))}
                        
                        {/* The trigger for a new folder */}
                        <option value="Custom Event...">+ Create New Event / Folder...</option>
                      </select>
                      
                      {eventName === "Custom Event..." && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                          <input required autoFocus type="text" placeholder="Type new event name..." value={customEvent} onChange={e => setCustomEvent(e.target.value)} className="w-full bg-[#020617] border border-emerald-500/50 rounded-2xl px-4 py-4 text-sm font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner" />
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-2 mt-2">This will automatically create a new folder in Cloudflare R2.</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Drag & Drop Images</label>
                      <div className="w-full relative bg-[#020617] border-2 border-dashed border-white/10 rounded-[32px] p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[250px]">
                        {files.length > 0 ? (
                          <div className="space-y-2"><CheckCircle2 className="mx-auto text-emerald-400" size={32}/> <h4 className="text-xl font-black text-white italic">{files.length} Queued</h4></div>
                        ) : (
                          <><UploadCloud className="text-slate-600 mb-4" size={48}/><p className="text-sm font-black text-white uppercase tracking-widest">Click to browse files</p></>
                        )}
                        <input required type="file" multiple accept="image/*" onChange={e => { if (e.target.files) setFiles(Array.from(e.target.files)); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    </div>
                    <button type="submit" disabled={isUploading || files.length === 0} className="w-full py-5 bg-white text-slate-900 hover:bg-emerald-400 rounded-2xl font-black uppercase text-[10px] tracking-widest flex justify-center items-center gap-2 shadow-xl disabled:opacity-50">
                       {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Upload to Secure Storage
                    </button>
                  </form>
              </div>
            )}

          </div>
        )}
      </div>

      {/* --- TAGGING MODAL (Queue System) --- */}
      <AnimatePresence>
        {currentMedia && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeTaggingModal} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-6xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh]">
              
              <div className="flex-1 bg-black relative flex items-center justify-center min-h-[300px] p-4 overflow-hidden group/img">
                <button onClick={closeTaggingModal} className="absolute top-4 left-4 z-30 p-2 bg-black/50 hover:bg-white/10 text-white rounded-full md:hidden"><X size={20}/></button>
                
                {isBulkMode ? (
                    <div className="text-center p-10 z-10">
                        <Tag size={40} className="mx-auto text-blue-400 mb-4" />
                        <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter">Bulk Tagging</h4>
                        <p className="text-slate-400 mt-2">Applying tags to {multiSelectedIds.length} selected photos.</p>
                    </div>
                ) : (
                    <>
                        <div className="absolute top-4 right-4 z-30 flex gap-2">
                           {currentMedia.isGallery && (
                             <button onClick={() => { handleMarkAsDone([currentMedia.id], false); closeTaggingModal(); }} className="px-3 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-900 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ArrowLeft size={14}/> Back to Inbox</button>
                           )}
                           <button onClick={() => handleDeleteMedia(currentMedia.id, currentMedia.bucket_path)} className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><Trash2 size={16} /></button>
                        </div>

                        {taggingQueue.length > 1 && (
                           <>
                             <button disabled={queueIndex === 0} onClick={(e) => { e.stopPropagation(); const prev = queueIndex - 1; setQueueIndex(prev); setSelectedStudentIds(taggingQueue[prev].current_tags.map((t:any) => t.student_id)); }} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/50 text-white rounded-full hover:bg-white/20 disabled:opacity-0 transition-opacity"><ChevronLeft size={24}/></button>
                             <button disabled={queueIndex === taggingQueue.length - 1} onClick={(e) => { e.stopPropagation(); const next = queueIndex + 1; setQueueIndex(next); setSelectedStudentIds(taggingQueue[next].current_tags.map((t:any) => t.student_id)); }} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/50 text-white rounded-full hover:bg-white/20 disabled:opacity-0 transition-opacity"><ChevronRight size={24}/></button>
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/60 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-white border border-white/10">{queueIndex + 1} / {taggingQueue.length}</div>
                           </>
                        )}
                        {currentMedia.full_url ? <img src={currentMedia.full_url} className="w-full h-full object-contain rounded-2xl z-10" /> : null}
                    </>
                )}

                {/* PILLS */}
                {!isBulkMode && selectedStudentIds.length > 0 && (
                  <div className="absolute bottom-6 left-6 right-6 z-30 flex flex-wrap gap-2 justify-center pointer-events-none">
                    {students.filter(s => selectedStudentIds.includes(s.id)).map(student => (
                      <span key={`pill-${student.id}`} className="pointer-events-auto flex items-center gap-1.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10 shadow-xl">
                        <Tag size={10} className="text-blue-400" /> {student.display_name}
                        <button onClick={(e) => { e.stopPropagation(); setSelectedStudentIds(p => p.filter(id => id !== student.id)); }} className="ml-1 text-slate-400 hover:text-rose-400"><X size={10} strokeWidth={3} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="w-full md:w-96 bg-[#0f172a] border-l border-white/5 flex flex-col h-[50vh] md:h-auto shrink-0">
                <div className="p-6 border-b border-white/5 shrink-0 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Assign Students</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{isBulkMode ? 'Apply to multiple' : 'Link photo to dashboard'}</p>
                  </div>
                  <button onClick={closeTaggingModal} className="hidden md:block text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                
                <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input type="text" placeholder="Search students (min 3 chars)..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl py-2.5 pl-9 pr-8 text-xs font-bold text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
                  {filteredStudents.length === 0 ? (
                    <p className="text-center text-xs font-bold text-slate-500 mt-6">No students found matching "{studentSearch}"</p>
                  ) : (
                    filteredStudents.map(student => {
                      const isSelected = selectedStudentIds.includes(student.id);
                      return (
                        <div key={student.id} onClick={() => setSelectedStudentIds(p => p.includes(student.id) ? p.filter(id => id !== student.id) : [...p, student.id])} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-600/20 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                          <span className={`text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>{student.display_name}</span>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-slate-600'}`}>{isSelected && <Check size={14} strokeWidth={3} />}</div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="p-6 border-t border-white/5 bg-black/20 shrink-0 space-y-3">
                  <button onClick={() => handleSaveTags(false)} disabled={isSavingTags} className="w-full py-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all">
                    {isSavingTags ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />} {isLastInQueue ? 'Save & Close' : 'Save & Next'}
                  </button>

                  {(isBulkMode || currentMedia.isInbox) && (
                    <button onClick={() => handleSaveTags(true)} disabled={isSavingTags} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all">
                      <CheckCircle2 size={16} /> {isLastInQueue ? 'Save, Done & Close' : 'Save, Done & Next'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- STUDENT VAULT MANAGEMENT MODAL --- */}
      <AnimatePresence>
        {selectedStatsStudent && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStatsStudent(null)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-5xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/5 bg-[#020617] shrink-0">
                <div>
                  <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">
                    {selectedStatsStudent.name}'s <span className="text-purple-400">Vault</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage visibility for the parent dashboard</p>
                </div>
                <button onClick={() => setSelectedStatsStudent(null)} className="p-3 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-full transition-colors"><X size={20}/></button>
              </div>

              {/* Modal Gallery Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-[#0a0f1c]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {galleryMedia
                    .filter(m => m.current_tags?.some((t: any) => t.student_id === selectedStatsStudent.id))
                    .map(media => {
                      const tag = media.current_tags.find((t: any) => t.student_id === selectedStatsStudent.id);
                      const isHidden = tag?.is_hidden;

                      return (
                        <div key={media.id} className={`relative aspect-square rounded-2xl overflow-hidden group shadow-lg border transition-all ${isHidden ? 'border-amber-500/50 grayscale-[50%]' : 'border-white/10'}`}>
                          <img src={media.signed_url || media.full_url} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isHidden ? 'opacity-40' : 'opacity-90'}`} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          
                          {/* Visibility Toggle Button */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleToggleHide(media.id, selectedStatsStudent.id, isHidden)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 ${isHidden ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400' : 'bg-amber-500 text-slate-900 hover:bg-amber-400'}`}
                            >
                              {isHidden ? <><Eye size={14} /> Unhide</> : <><EyeOff size={14} /> Hide</>}
                            </button>
                          </div>

                          {/* Hidden Badge */}
                          {isHidden && (
                            <div className="absolute top-2 right-2 bg-amber-500/20 backdrop-blur-md text-amber-400 border border-amber-500/30 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
                              <EyeOff size={10} /> Archived
                            </div>
                          )}
                        </div>
                      );
                  })}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* The Floating Dispatch Cart */}
      <MediaDispatchCart 
        items={dispatchCart} 
        onRemoveItem={(id: string) => setDispatchCart(prev => prev.filter(i => i.media_id !== id))}
        onClearCart={() => setDispatchCart([])}
      />
      
    </div>
  );
}