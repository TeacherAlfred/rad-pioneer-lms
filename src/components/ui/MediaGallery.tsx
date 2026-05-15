"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderHeart, Users, X, Download, Maximize2, Edit2, Star, Flag, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Trash2, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface MediaGalleryProps {
  media: any[];
  viewerRole: 'admin' | 'parent' | 'student';
  currentStudentId?: string; 
  onMediaClick?: (media: any) => void; 
  onRefresh?: () => void; 
  onDelete?: (mediaId: string, bucketPath: string) => Promise<void>;
  onAddToDispatch?: (media: any) => void;
}

const WATERMARK_URL = "https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png";

export default function MediaGallery({ media, viewerRole, currentStudentId, onMediaClick, onRefresh, onDelete, onAddToDispatch }: MediaGalleryProps) {
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Lightbox & Carousel State
  const [lightboxPhotos, setLightboxPhotos] = useState<any[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const lightboxMedia = lightboxPhotos[lightboxIndex] || null;

  // Watermark Render State
  const [imageLoaded, setImageLoaded] = useState(false);
  const [watermarkStyles, setWatermarkStyles] = useState<{ top: number, right: number, opacity: number }>({ top: 0, right: 0, opacity: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const thumbnailRefs = useRef<(HTMLImageElement | null)[]>([]);

  // Group Media by Folder Name (Album)
  const groupedGallery = useMemo(() => {
    return media.reduce((groups: Record<string, any[]>, item) => {
      const parts = item.bucket_path?.split('/') || [];
      let folderKey = "Uncategorized";
      if (parts.length >= 3) {
        folderKey = parts[parts.length - 2].split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      }
      if (!groups[folderKey]) groups[folderKey] = [];
      groups[folderKey].push(item);
      return groups;
    }, {});
  }, [media]);

  useEffect(() => {
    setImageLoaded(false);
    setWatermarkStyles(prev => ({ ...prev, opacity: 0 }));
  }, [lightboxIndex]);

  // Keyboard Navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxPhotos.length === 0) return;
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhotos, lightboxIndex]);

  // Auto-scroll filmstrip to active thumbnail
  useEffect(() => {
    if (lightboxMedia && thumbnailRefs.current[lightboxIndex]) {
      thumbnailRefs.current[lightboxIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [lightboxIndex, lightboxMedia]);

  const openLightbox = (photos: any[], startIndex: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(startIndex);
  };

  const closeLightbox = () => {
    setLightboxPhotos([]);
    setLightboxIndex(0);
  };

  const goToNext = () => setLightboxIndex(prev => Math.min(prev + 1, lightboxPhotos.length - 1));
  const goToPrev = () => setLightboxIndex(prev => Math.max(prev - 1, 0));

  const handleRate = async (rating: number) => {
    if (!lightboxMedia || !currentStudentId) return;
    setIsProcessing(true);
    try {
      await supabase.from('media_tags').update({ rating }).match({ media_id: lightboxMedia.id, student_id: currentStudentId });
      
      const updatedPhotos = [...lightboxPhotos];
      updatedPhotos[lightboxIndex].current_tags = updatedPhotos[lightboxIndex].current_tags.map((t: any) => 
        t.student_id === currentStudentId ? { ...t, rating } : t
      );
      setLightboxPhotos(updatedPhotos);
      if (onRefresh) onRefresh();
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleRequestRemoval = async () => {
    if (!lightboxMedia || !currentStudentId) return;
    if (!confirm("Request removal of this photo? It will be hidden from your view while an admin reviews it.")) return;
    
    setIsProcessing(true);
    try {
      await supabase.from('media_tags').update({ removal_requested: true }).match({ media_id: lightboxMedia.id, student_id: currentStudentId });
      closeLightbox();
      if (onRefresh) onRefresh();
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleDelete = async () => {
    if (!lightboxMedia || !onDelete) return;
    if (!confirm("Are you sure you want to permanently delete this photo?")) return;

    setIsDeleting(true);
    try {
      await onDelete(lightboxMedia.id, lightboxMedia.bucket_path);
      const newPhotos = lightboxPhotos.filter((p) => p.id !== lightboxMedia.id);
      
      if (newPhotos.length === 0) {
        closeLightbox();
      } else {
        setLightboxPhotos(newPhotos);
        setLightboxIndex(prev => Math.min(prev, newPhotos.length - 1));
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete image.");
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadImageWithWatermark = async (url: string, filename: string) => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas not supported");

      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = url;
      await new Promise((resolve, reject) => { baseImg.onload = resolve; baseImg.onerror = reject; });

      canvas.width = baseImg.width;
      canvas.height = baseImg.height;
      ctx.drawImage(baseImg, 0, 0);

      const wmImg = new Image();
      wmImg.crossOrigin = "anonymous";
      wmImg.src = WATERMARK_URL;
      await new Promise((resolve, reject) => { wmImg.onload = resolve; wmImg.onerror = reject; });

      const wmWidth = baseImg.width * 0.15; 
      const wmHeight = (wmImg.height / wmImg.width) * wmWidth;
      const margin = baseImg.width * 0.03;

      ctx.globalAlpha = 0.85;
      ctx.drawImage(wmImg, baseImg.width - wmWidth - margin, margin, wmWidth, wmHeight);
      ctx.globalAlpha = 1.0;

      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || 'rad-academy-photo.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 'image/jpeg', 0.95);

    } catch (error) {
      console.error('Canvas compositing failed, falling back:', error);
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || 'rad-academy-photo.jpg';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (fallbackError) {
        console.error('Fallback download also failed', fallbackError);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  if (media.length === 0) {
    return (
      <div className="text-center p-20 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed">
        <FolderHeart size={40} className="mx-auto text-slate-600 mb-4" />
        <p className="text-white font-black text-xl italic uppercase tracking-tighter">Gallery is Empty</p>
      </div>
    );
  }

  // --- VIEW 1: ALBUM GRID ---
  if (!activeAlbum) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Object.entries(groupedGallery).map(([albumName, photos]) => {
          const coverPhoto = photos[0];
          return (
            <motion.div key={albumName} whileHover={{ y: -5 }} onClick={() => setActiveAlbum(albumName)} className="group cursor-pointer">
              <div className="relative aspect-video rounded-3xl overflow-hidden bg-[#0a0f1c] border border-white/10 shadow-lg mb-3">
                {coverPhoto?.signed_url ? <img src={coverPhoto.signed_url} alt="cover" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl"><FolderHeart size={20} className="text-emerald-400"/></div>
                  <span className="text-[10px] font-black bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white border border-white/10 shadow-xl">{photos.length} Photos</span>
                </div>
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white px-2 group-hover:text-emerald-400 transition-colors truncate">{albumName}</h3>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // --- VIEW 2: ALBUM PHOTOS ---
  const albumPhotos = groupedGallery[activeAlbum] || [];
  const limit = limits[activeAlbum] || 30;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveAlbum(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20}/></button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-white">{activeAlbum}</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{albumPhotos.length} Items</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {albumPhotos.slice(0, limit).map((item: any, index: number) => {
          const myTag = item.current_tags?.find((t: any) => t.student_id === currentStudentId);
          const isRemovalRequested = myTag?.removal_requested;
          
          const displayDate = new Date(item.taken_at || item.created_at).toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
          });

          return (
            <motion.div 
              key={item.id} whileHover={{ y: -5, scale: 1.02 }} 
              onClick={() => openLightbox(albumPhotos, index)} 
              className={`relative aspect-square bg-[#0a0f1c] rounded-2xl border cursor-pointer overflow-hidden group shadow-lg ${isRemovalRequested ? 'border-rose-500/30' : 'border-white/10'}`}
            >
              {item.signed_url ? (
                <img 
                  src={item.signed_url} 
                  loading="lazy" 
                  // NEW: If the image 404s, replace it with a broken file indicator
                  onError={(e) => {
                    e.currentTarget.src = "https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png";
                    e.currentTarget.classList.remove("object-cover", "opacity-80");
                    e.currentTarget.classList.add("object-contain", "opacity-20", "p-6", "grayscale");
                  }}
                  className={`w-full h-full object-cover transition-all duration-500 ${isRemovalRequested ? 'grayscale opacity-30' : 'opacity-80 group-hover:opacity-100'}`} 
                />
              ) : null}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 pointer-events-none">
                <div className="flex justify-end items-center gap-2 pointer-events-auto">
                  {viewerRole === 'admin' ? (
                    <>
                      {onAddToDispatch && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAddToDispatch(item); }}
                          className="p-1.5 bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md rounded-lg text-white shadow-xl transition-colors"
                          title="Add to Dispatch Cart"
                        >
                          <Send size={12} />
                        </button>
                      )}
                      <span className="text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1 bg-blue-500/90 backdrop-blur-md text-white shadow-xl pointer-events-none"><Users size={10} /> {item.current_tags?.length || 0}</span>
                    </>
                  ) : isRemovalRequested ? (
                    <span className="text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1 bg-rose-500/90 backdrop-blur-md text-white shadow-xl pointer-events-none"><AlertTriangle size={10} /> Pending Review</span>
                  ) : (
                    <span className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white pointer-events-none"><Maximize2 size={14} /></span>
                  )}
                </div>
                
                <div className="flex items-end justify-between">
                  <span className="text-[9px] font-black px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-white/80 border border-white/10 shadow-xl tracking-widest uppercase">
                    {displayDate}
                  </span>
                  {myTag?.rating > 0 && <div className="flex text-amber-400">{[...Array(myTag.rating)].map((_, i) => <Star key={i} size={10} fill="currentColor" />)}</div>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {albumPhotos.length > limit && (
        <div className="flex justify-center pt-6">
          <button onClick={() => setLimits(prev => ({ ...prev, [activeAlbum]: limit + 30 }))} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl transition-all">
            Load More ({albumPhotos.length - limit} remaining)
          </button>
        </div>
      )}

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightboxMedia && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeLightbox} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none">
              
              {/* Top Controls */}
              <div className="absolute top-4 right-4 z-50 flex gap-3 pointer-events-auto">
                {viewerRole === 'admin' && onAddToDispatch && (
                  <button onClick={() => onAddToDispatch(lightboxMedia)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-black uppercase text-[10px] tracking-widest transition-colors shadow-xl flex items-center gap-2">
                    <Send size={14} /> <span className="hidden sm:inline">Add to Cart</span>
                  </button>
                )}
                
                {viewerRole === 'admin' && onDelete && (
                  <button disabled={isDeleting} onClick={handleDelete} className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-full font-black uppercase text-[10px] tracking-widest transition-colors shadow-xl flex items-center gap-2">
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}

                {viewerRole === 'admin' && onMediaClick && (
                  <button onClick={() => { closeLightbox(); onMediaClick(lightboxMedia); }} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-full font-black uppercase text-[10px] tracking-widest transition-colors shadow-xl flex items-center gap-2">
                    <Edit2 size={14} /> <span className="hidden sm:inline">Edit Tags</span>
                  </button>
                )}

                <button disabled={isDownloading} onClick={() => downloadImageWithWatermark(lightboxMedia.full_url || lightboxMedia.signed_url, lightboxMedia.bucket_path.split('/').pop())} className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-full backdrop-blur-md transition-colors shadow-xl border border-white/10" title="Download">
                  {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                </button>
                <button onClick={closeLightbox} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors shadow-xl border border-white/10">
                  <X size={18} />
                </button>
              </div>

              {/* Main Viewing Area */}
              <div className="flex-1 w-full min-h-0 flex items-center justify-center relative pointer-events-auto" onClick={closeLightbox}>
                 
                 {lightboxPhotos.length > 1 && (
                   <button onClick={(e) => { e.stopPropagation(); goToPrev(); }} className="absolute left-2 sm:left-4 z-[450] p-3 sm:p-4 bg-black/40 hover:bg-white/20 rounded-full text-white pointer-events-auto">
                     <ChevronLeft size={28}/>
                   </button>
                 )}
                 
                 {/* THE FIX: A standard flex-child div automatically shrink-wraps its contents. */}
                 <div className="relative" onClick={(e) => e.stopPropagation()}>
                   
                   {!imageLoaded && (
                     <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <Loader2 className="animate-spin text-white/50" size={32} />
                     </div>
                   )}
                   
                   {(lightboxMedia.full_url || lightboxMedia.signed_url) ? (
                     <img 
                       src={lightboxMedia.full_url || lightboxMedia.signed_url} 
                       alt="High Res"
                       // THE FIX: Strict, math-based constraints applied directly to the image tag.
                       // 340px exactly accounts for your top and bottom UI elements.
                       style={{ maxWidth: '90vw', maxHeight: 'calc(100dvh - 340px)' }}
                       className={`block w-auto h-auto rounded-xl shadow-2xl pointer-events-auto transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} 
                       onLoad={() => setImageLoaded(true)}
                     />
                   ) : null}
                   
                   {/* Watermark pins flawlessly because the parent div is exactly the size of the scaled image */}
                   {imageLoaded ? (
                     <img 
                       src={WATERMARK_URL}
                       alt="Watermark"
                       className="absolute top-3 right-3 sm:top-5 sm:right-5 w-12 sm:w-16 md:w-24 h-auto opacity-85 pointer-events-none drop-shadow-2xl z-[460] animate-in fade-in duration-300"
                     />
                   ) : null}

                 </div>

                 {lightboxPhotos.length > 1 && (
                   <button onClick={(e) => { e.stopPropagation(); goToNext(); }} className="absolute right-2 sm:right-4 z-[450] p-3 sm:p-4 bg-black/40 hover:bg-white/20 rounded-full text-white pointer-events-auto">
                     <ChevronRight size={28}/>
                   </button>
                 )}
              </div>

              {/* Filmstrip */}
              <div className="absolute bottom-6 h-24 w-full flex justify-center items-center gap-3 overflow-x-auto px-10 pointer-events-auto">
                   {lightboxPhotos.map((photo, i) => (
                     photo.signed_url ? (
                       <img 
                         key={photo.id} 
                         ref={(el) => { thumbnailRefs.current[i] = el; }}
                         src={photo.signed_url} 
                         onClick={() => setLightboxIndex(i)} 
                         className={`h-16 w-16 md:h-20 md:w-20 object-cover rounded-xl cursor-pointer transition-all ${i === lightboxIndex ? 'ring-4 ring-emerald-500 scale-110 opacity-100 z-10' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0 hover:scale-105'}`} 
                       />
                     ) : null
                   ))}
              </div>

              {/* Bottom Controls (Parents & Students Only) */}
              {viewerRole !== 'admin' && currentStudentId && (
                <div className="absolute bottom-36 z-[500] bg-black/70 backdrop-blur-xl border border-white/10 p-4 rounded-3xl flex items-center gap-8 shadow-2xl pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Rate:</span>
                    {[1, 2, 3, 4, 5].map((star) => {
                       const currentRating = lightboxMedia.current_tags?.find((t:any) => t.student_id === currentStudentId)?.rating || 0;
                       return (
                         <button key={star} disabled={isProcessing} onClick={() => handleRate(star)} className="focus:outline-none transition-transform hover:scale-110 active:scale-90">
                           <Star size={24} className={star <= currentRating ? "text-amber-400" : "text-slate-600"} fill={star <= currentRating ? "currentColor" : "none"} />
                         </button>
                       );
                    })}
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <button 
                    disabled={isProcessing || lightboxMedia.current_tags?.find((t:any) => t.student_id === currentStudentId)?.removal_requested}
                    onClick={handleRequestRemoval}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors"
                  >
                    <Flag size={16} /> 
                    {lightboxMedia.current_tags?.find((t:any) => t.student_id === currentStudentId)?.removal_requested ? 'Removal Pending Admin Review' : 'Request Removal'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}