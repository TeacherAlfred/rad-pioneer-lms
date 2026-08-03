"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Share2, AlertTriangle, X, Image as ImageIcon, Loader2, CheckCircle2, ImagePlus, Sparkles, Download, BookOpen, ArrowLeft, Clock, Trash2 } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface MediaItem {
  tag_id: string;
  media_id: string;
  url: string;
  event_name: string;
  date: string;
  is_starred: boolean;
  removal_requested: boolean;
  removal_requested_at: string | null;
  removal_approved: boolean;
}

interface StudentMediaGalleryProps {
  studentId: string;
  studentName: string;
}

// Helper: Calculate 48 hours from request, rounded UP to the next whole hour
const getRemovalDeadline = (requestDateStr: string | null) => {
  if (!requestDateStr) return null;
  const d = new Date(requestDateStr);
  d.setHours(d.getHours() + 48);
  if (d.getMinutes() > 0 || d.getSeconds() > 0 || d.getMilliseconds() > 0) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  }
  return d;
};

export default function StudentMediaGallery({ studentId, studentName }: StudentMediaGalleryProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Clock tick for active countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000); // Update every 10s
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchMedia() {
      if (!studentId) return;
      setLoading(true);

      try {
        const { data: tags, error: tagsError } = await supabase
          .from('media_tags')
          .select(`
            id,
            is_starred,
            removal_requested,
            removal_requested_at,
            removal_approved_by_admin,
            event_media ( id, bucket_path, event_name, taken_at )
          `)
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });

        if (tagsError) throw tagsError;
        if (!tags || tags.length === 0) {
          setItems([]);
          return;
        }

        // Generate direct Cloudflare URLs instantly
        const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
        let formattedMedia: MediaItem[] = tags.map((tag: any) => ({
          tag_id: tag.id,
          media_id: tag.event_media.id,
          url: `${r2Url}/${tag.event_media.bucket_path}`,
          event_name: tag.event_media.event_name,
          date: tag.event_media.taken_at,
          is_starred: tag.is_starred,
          removal_requested: tag.removal_requested || false,
          removal_requested_at: tag.removal_requested_at || null,
          removal_approved: tag.removal_approved_by_admin || false
        })).filter((m: MediaItem) => m.url !== "");

        setItems(formattedMedia);
      } catch (error) {
        console.error("Error fetching gallery:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchMedia();
  }, [studentId]);

  // --- Auto-Delete Engine ---
  useEffect(() => {
    items.forEach(async (item) => {
      if (item.removal_requested && item.removal_requested_at) {
        const deadline = getRemovalDeadline(item.removal_requested_at);
        if (deadline && now > deadline) {
          // Timer expired! Permanently delete from DB
          try {
            await supabase.from('media_tags').delete().eq('id', item.tag_id);
            setItems(prev => prev.filter(i => i.tag_id !== item.tag_id));
            if (selectedImage?.tag_id === item.tag_id) setSelectedImage(null);
          } catch(err) { console.error("Failed to auto-delete expired tag", err); }
        }
      }
    });
  }, [now, items, selectedImage]);

  // --- GROUP ITEMS BY EVENT ---
  const groupedItems = useMemo(() => {
    const groups: { eventName: string, items: MediaItem[] }[] = [];
    items.forEach(item => {
      const eventName = item.event_name || 'Untitled Event';
      const existingGroup = groups.find(g => g.eventName === eventName);
      if (existingGroup) {
        existingGroup.items.push(item);
      } else {
        groups.push({ eventName, items: [item] });
      }
    });
    return groups;
  }, [items]);

  // --- Actions ---
  const handleToggleStar = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    const currentItem = items.find(i => i.tag_id === tagId);
    if (!currentItem || currentItem.removal_requested) return;
    
    const newState = !currentItem.is_starred;
    setItems(items.map(item => item.tag_id === tagId ? { ...item, is_starred: newState } : item));
    if (selectedImage?.tag_id === tagId) setSelectedImage({ ...selectedImage, is_starred: newState });
    await supabase.from('media_tags').update({ is_starred: newState }).eq('id', tagId);
  };

  const handleRequestRemoval = async (tagId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = window.confirm("Request permanent removal? This image will be locked and deleted in 48 hours.");
    if (!confirmed) return;

    setIsProcessing(tagId);
    try {
      const requestTime = new Date().toISOString();
      await supabase.from('media_tags').update({ 
        removal_requested: true, 
        removal_requested_at: requestTime 
      }).eq('id', tagId);
      
      setItems(items.map(item => item.tag_id === tagId ? { ...item, removal_requested: true, removal_requested_at: requestTime } : item));
      setSelectedImage(null);
      showToast("Removal request submitted.");
    } catch (err) { showToast("Failed to request removal.", "error"); } 
    finally { setIsProcessing(null); }
  };

  const handleCancelRemoval = async (tagId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsProcessing(tagId);
    try {
      await supabase.from('media_tags').update({ 
        removal_requested: false, 
        removal_requested_at: null,
        removal_approved_by_admin: false 
      }).eq('id', tagId);
      
      setItems(items.map(item => item.tag_id === tagId ? { ...item, removal_requested: false, removal_requested_at: null, removal_approved: false } : item));
      showToast("Removal request cancelled.");
    } catch (err) { showToast("Failed to cancel removal.", "error"); } 
    finally { setIsProcessing(null); }
  };

  // --- CANVAS WATERMARKING LOGIC ---
  const generateWatermarkedImage = async (sourceUrl: string): Promise<Blob> => {
    const response = await fetch(sourceUrl);
    const originalBlob = await response.blob();
    const objectUrl = URL.createObjectURL(originalBlob);
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas context failed"));
        ctx.drawImage(img, 0, 0);
        const logo = new window.Image();
        logo.onload = () => {
          const maxLogoWidth = Math.min(img.width * 0.25, 400);
          const scale = maxLogoWidth / logo.width;
          const logoWidth = logo.width * scale; const logoHeight = logo.height * scale;
          const padding = Math.max(img.width * 0.03, 20);
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; ctx.shadowBlur = 15; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;
          ctx.drawImage(logo, img.width - logoWidth - padding, padding, logoWidth, logoHeight);
          canvas.toBlob((watermarkedBlob) => {
            URL.revokeObjectURL(objectUrl);
            if (watermarkedBlob) resolve(watermarkedBlob); else reject(new Error("Failed to create baked image"));
          }, 'image/jpeg', 0.95);
        };
        logo.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(originalBlob); };
        logo.src = "/logo/rad-logo_white_2.png"; 
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load original image")); };
      img.src = objectUrl;
    });
  };

  const handleShare = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    if (item.removal_requested) return;
    setIsSharing(item.tag_id);
    showToast("Applying RAD Academy Watermark...", "info");
    try {
      const watermarkedBlob = await generateWatermarkedImage(item.url);
      const safeEventName = item.event_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const file = new File([watermarkedBlob], `rad-academy-${safeEventName}.jpg`, { type: watermarkedBlob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${studentName} at ${item.event_name}`, text: `Check out this photo of ${studentName} at RAD Academy! 🚀` });
      } else {
        const downloadUrl = URL.createObjectURL(watermarkedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = file.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        showToast("Watermarked image downloaded successfully!");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') { showToast("Failed to prepare image. Please try again.", "error"); }
    } finally { setIsSharing(null); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[#0f172a]/50 rounded-3xl border border-white/5">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Secure Media...</span>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="bg-[#0f172a]/50 border border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
        <ImageIcon size={40} className="text-slate-600 mb-4" />
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">No Media Available</h4>
        <p className="text-xs text-slate-500 mt-2 font-medium">Photos of {studentName} from bootcamps and classes will appear here.</p>
      </div>
    );
  }

  // Helper renderer for the removal overlay
  const renderRemovalOverlay = (item: MediaItem) => {
    if (!item.removal_requested) return null;
    const deadline = getRemovalDeadline(item.removal_requested_at);
    
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${item.removal_approved ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
          {item.removal_approved ? <Trash2 size={24}/> : <Clock size={24}/>}
        </div>
        <h4 className={`text-xs font-black uppercase tracking-widest mb-2 ${item.removal_approved ? 'text-rose-400' : 'text-amber-400'}`}>
          {item.removal_approved ? 'Removal Confirmed' : 'Processing Request'}
        </h4>
        
        <p className="text-[10px] text-slate-300 font-medium mb-5 leading-relaxed max-w-[200px]">
          Set to permanently delete at the latest by <br/>
          <span className="text-white font-bold">{deadline ? formatTime(deadline) : ''}</span> on <span className="text-white font-bold">{deadline ? formatDate(deadline) : ''}</span>
        </p>

        <button 
          onClick={(e) => handleCancelRemoval(item.tag_id, e)}
          disabled={isProcessing === item.tag_id}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          {isProcessing === item.tag_id ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>} Cancel Deletion
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
          <ImageIcon size={16} className="text-blue-500" /> Media Gallery
        </h3>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
          {items.length} Memories
        </span>
      </div>

      {/* --- MEDIA GALLERY WELCOME BANNER --- */}
      <div className="mb-8 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-[#020617] border border-blue-500/20 rounded-[40px] p-8 md:p-10 flex flex-col items-start gap-6 shadow-inner relative overflow-hidden">
        <div className="absolute -right-6 -top-10 opacity-5 pointer-events-none"><ImageIcon size={160} /></div>
        <div className="relative z-10 w-full">
          <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">
            Welcome to {studentName.split(' ')[0]}'s RAD Media Vault
          </h3>
          <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-2xl mb-6">
            Relive milestones from our lessons and events. Explore photo and video highlights below.
          </p>
          <button 
            onClick={() => setShowGuideModal(true)} 
            className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors bg-white/5 border border-white/10 px-5 py-3 rounded-xl hover:bg-white/10 shadow-sm"
          >
            <BookOpen size={16} className="text-blue-500" /> View Detailed Gallery Guide
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-10 right-10 z-[300] bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-500"/>}
            {toast.type === 'error' && <AlertTriangle size={16} className="text-rose-500"/>}
            {toast.type === 'info' && <Loader2 size={16} className="text-blue-500 animate-spin"/>}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ALBUM NAVIGATION OR ACTIVE ALBUM GRID --- */}
      {!activeAlbum ? (
        <div className="space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-3">Available Albums</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedItems.map((group) => (
              <motion.div 
                key={group.eventName} whileHover={{ y: -6 }} onClick={() => setActiveAlbum(group.eventName)}
                className="group relative aspect-[4/3] rounded-[32px] overflow-hidden cursor-pointer bg-[#020617] border border-white/10 shadow-xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-blue-500/50 transition-all duration-300"
              >
                <img src={group.items[0].url} alt={group.eventName} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent" />
                <div className="absolute top-5 right-5 w-10 h-10 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-center text-white/50 group-hover:bg-blue-500/20 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all">
                  <ImageIcon size={18} />
                </div>
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col justify-end">
                  <h4 className="text-xl md:text-2xl font-black text-white uppercase italic tracking-tighter drop-shadow-md group-hover:-translate-y-1 transition-transform duration-300 line-clamp-2">
                    {group.eventName}
                  </h4>
                  <div className="flex items-center gap-2 mt-3 group-hover:-translate-y-1 transition-transform duration-300 delay-75">
                    <span className="px-3 py-1.5 bg-blue-500/20 backdrop-blur-md border border-blue-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-300 shadow-sm">
                      {group.items.length} {group.items.length === 1 ? 'Memory' : 'Memories'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 bg-[#0f172a] p-4 rounded-[28px] border border-white/5 shadow-lg">
            <button 
              onClick={() => setActiveAlbum(null)} 
              className="p-3 bg-[#020617] hover:bg-blue-600 hover:border-blue-500 rounded-2xl border border-white/10 transition-all group/back shadow-inner shrink-0"
            >
              <ArrowLeft size={18} className="text-slate-400 group-hover/back:text-white" />
            </button>
            <div className="flex-1 pr-4">
              <h4 className="text-xl md:text-2xl font-black text-white uppercase italic tracking-tighter leading-none line-clamp-1">{activeAlbum}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {groupedItems.find(g => g.eventName === activeAlbum)?.items.length} Memories
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {groupedItems.find(g => g.eventName === activeAlbum)?.items.map((item) => (
              <motion.div 
                key={item.tag_id} whileHover={{ y: -4, scale: 1.02 }} 
                onClick={() => !item.removal_requested && setSelectedImage(item)}
                className={`group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-lg ${item.removal_requested ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <img src={item.url} alt={item.event_name} className={`w-full h-full object-cover transition-opacity ${item.removal_requested ? 'opacity-20 grayscale blur-sm' : 'opacity-90 group-hover:opacity-100'}`} />
                
                {renderRemovalOverlay(item)}

                {!item.removal_requested && (
                  <>
                    <div className="absolute top-2 right-2 opacity-30 pointer-events-none w-16">
                      <Image src="/logo/rad-logo_white_2.png" alt="RAD" width={80} height={26} unoptimized className="drop-shadow-md" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <button onClick={(e) => handleToggleStar(e, item.tag_id)} className="p-2 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-colors">
                          <Star size={14} className={item.is_starred ? "fill-amber-400 text-amber-400" : "text-white"} />
                        </button>
                        <button 
                          onClick={(e) => handleShare(e, item)} 
                          disabled={isSharing === item.tag_id}
                          className="p-2 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-blue-500 disabled:opacity-50 transition-colors"
                        >
                          {isSharing === item.tag_id ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                        </button>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{new Date(item.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && !selectedImage.removal_requested && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedImage(null)} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row bg-[#020617] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-rose-500 text-white rounded-full transition-colors backdrop-blur-md"><X size={20} /></button>

              <div className="flex-1 relative bg-black flex items-center justify-center min-h-[40vh] md:min-h-[60vh]">
                <img src={selectedImage.url} alt="Expanded view" className="max-w-full max-h-[90vh] object-contain" />
                <div className="absolute bottom-6 right-6 opacity-40 pointer-events-none w-24 md:w-32">
                  <Image src="/logo/rad-logo_white_2.png" alt="RAD" width={120} height={40} unoptimized className="drop-shadow-xl" />
                </div>
              </div>

              <div className="w-full md:w-80 bg-[#0f172a] border-l border-white/5 p-6 md:p-8 flex flex-col justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30"><ImageIcon size={18} /></div>
                    <div>
                      <h4 className="text-sm font-black uppercase italic tracking-tighter text-white">Media Details</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{studentName}'s Archive</p>
                    </div>
                  </div>

                  <div className="space-y-4 border-b border-white/5 pb-6 mb-6">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Captured At</p>
                      <p className="text-sm font-bold text-white">{selectedImage.event_name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Date</p>
                      <p className="text-sm font-bold text-slate-300">{new Date(selectedImage.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={(e) => handleToggleStar(e, selectedImage.tag_id)} 
                      className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${selectedImage.is_starred ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-inner' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`}
                    >
                      <Star size={16} className={selectedImage.is_starred ? "fill-amber-400" : ""} /> 
                      {selectedImage.is_starred ? 'Favorited' : 'Add to Favorites'}
                    </button>
                    <button 
                      onClick={(e) => handleShare(e, selectedImage)} 
                      disabled={isSharing === selectedImage.tag_id}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white border border-blue-500/50 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                    >
                      {isSharing === selectedImage.tag_id ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Share / Download
                    </button>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    onClick={() => handleRequestRemoval(selectedImage.tag_id)}
                    disabled={isProcessing === selectedImage.tag_id}
                    className="w-full py-3 bg-transparent hover:bg-rose-500/10 text-rose-500/70 hover:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-transparent hover:border-rose-500/20 disabled:opacity-50"
                  >
                    {isProcessing === selectedImage.tag_id ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} Request Removal!
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guide Modal omitted for brevity, ensure you keep your existing Guide Modal code here */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGuideModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#0f172a] border border-blue-500/30 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30 text-blue-400"><BookOpen size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Media Vault Guide</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Features & Privacy Policy</p>
                  </div>
                </div>
                <button onClick={() => setShowGuideModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar space-y-8">
                <p className="text-sm font-medium text-slate-300 leading-relaxed border-b border-white/5 pb-6">Welcome to the digital showcase! Here is everything you can do within your secure media gallery.</p>
                <div className="space-y-6">
                  {/* ... Keep your existing modal rows ... */}
                  <div className="flex gap-4 items-start bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30"><AlertTriangle size={16} /></div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Privacy & Removal</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">Your privacy is our priority. If there are any pictures you want removed from our database, click the <strong className="text-rose-400">"Request removal!"</strong> button on the image. We will securely delete it and notify you via email or WhatsApp within 2 working days.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-[#020617] shrink-0">
                <button onClick={() => setShowGuideModal(false)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg">Got It</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}