"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Share2, AlertTriangle, X, Image as ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface MediaItem {
  tag_id: string;
  media_id: string;
  url: string;
  event_name: string;
  date: string;
  is_starred: boolean;
}

interface StudentMediaGalleryProps {
  studentId: string;
  studentName: string;
}

export default function StudentMediaGallery({ studentId, studentName }: StudentMediaGalleryProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
            event_media ( id, bucket_path, event_name, captured_at )
          `)
          .eq('student_id', studentId)
          .eq('removal_requested', false)
          .order('created_at', { ascending: false });

        if (tagsError) throw tagsError;
        if (!tags || tags.length === 0) {
          setItems([]);
          return;
        }

        const paths = tags.map((t: any) => t.event_media.bucket_path);
        const { data: urlData, error: urlError } = await supabase.storage
          .from('student_media')
          .createSignedUrls(paths, 3600);

        if (urlError) throw urlError;

        const formattedMedia = tags.map((tag: any, index: number) => ({
          tag_id: tag.id,
          media_id: tag.event_media.id,
          url: urlData?.[index]?.signedUrl || "",
          event_name: tag.event_media.event_name,
          date: tag.event_media.captured_at,
          is_starred: tag.is_starred
        })).filter(m => m.url !== "");

        setItems(formattedMedia);
      } catch (error) {
        console.error("Error fetching gallery:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMedia();
  }, [studentId]);

  const handleToggleStar = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    
    const currentItem = items.find(i => i.tag_id === tagId);
    if (!currentItem) return;
    const newState = !currentItem.is_starred;

    setItems(items.map(item => item.tag_id === tagId ? { ...item, is_starred: newState } : item));
    if (selectedImage?.tag_id === tagId) {
      setSelectedImage({ ...selectedImage, is_starred: newState });
    }
    
    await supabase.from('media_tags').update({ is_starred: newState }).eq('id', tagId);
  };

  const handleRequestRemoval = async (tagId: string) => {
    const confirmed = window.confirm("Are you sure you want to remove this photo from your dashboard?");
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await supabase.from('media_tags').update({ removal_requested: true }).eq('id', tagId);
      
      setItems(items.filter(item => item.tag_id !== tagId));
      setSelectedImage(null);
      showToast("Photo removed from your gallery.");
    } catch (err) {
      showToast("Failed to request removal.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- CANVAS WATERMARKING LOGIC ---
  const generateWatermarkedImage = async (sourceUrl: string): Promise<Blob> => {
    // 1. Fetch image safely to bypass Canvas CORS taint rules
    const response = await fetch(sourceUrl);
    const originalBlob = await response.blob();
    const objectUrl = URL.createObjectURL(originalBlob);

    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
           URL.revokeObjectURL(objectUrl);
           return reject(new Error("Canvas context failed"));
        }

        // Draw original photo
        ctx.drawImage(img, 0, 0);

        // Load RAD Logo
        const logo = new window.Image();
        logo.onload = () => {
          // Calculate scale: Let's make the logo 25% of the image width (capped at 400px so it's not huge on 4K photos)
          const maxLogoWidth = Math.min(img.width * 0.25, 400);
          const scale = maxLogoWidth / logo.width;
          const logoWidth = logo.width * scale;
          const logoHeight = logo.height * scale;

          // Position: Top Right with dynamic padding based on image size
          const padding = Math.max(img.width * 0.03, 20);
          const x = img.width - logoWidth - padding;
          const y = padding;

          // Add a subtle drop shadow to make the white logo pop on light backgrounds
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 4;

          // Bake it into the canvas!
          ctx.drawImage(logo, x, y, logoWidth, logoHeight);

          // Export as JPEG Blob
          canvas.toBlob((watermarkedBlob) => {
            URL.revokeObjectURL(objectUrl);
            if (watermarkedBlob) resolve(watermarkedBlob);
            else reject(new Error("Failed to create baked image"));
          }, 'image/jpeg', 0.95);
        };
        
        logo.onerror = () => {
           // Fallback: If logo fails to load (network error), just return the original photo
           URL.revokeObjectURL(objectUrl);
           resolve(originalBlob); 
        };
        logo.src = "/logo/rad-logo_white_2.png"; 
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load original image"));
      };
      img.src = objectUrl;
    });
  };

  const handleShare = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    setIsSharing(item.tag_id);
    showToast("Applying RAD Academy Watermark...", "info");

    try {
      // Create the baked file
      const watermarkedBlob = await generateWatermarkedImage(item.url);
      const safeEventName = item.event_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const file = new File([watermarkedBlob], `rad-academy-${safeEventName}.jpg`, { type: watermarkedBlob.type });

      // Check if browser supports direct file sharing (Mobile/Safari)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${studentName} at ${item.event_name}`,
          text: `Check out this photo of ${studentName} at RAD Academy! 🚀`
        });
      } else {
        // Fallback: Trigger a local download for desktop users
        const downloadUrl = URL.createObjectURL(watermarkedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        showToast("Watermarked image downloaded successfully!");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') { 
        console.error("Share failed", err);
        showToast("Failed to prepare image. Please try again.", "error");
      }
    } finally {
      setIsSharing(null);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
          <ImageIcon size={16} className="text-blue-500" /> Action Gallery
        </h3>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
          {items.length} Memories
        </span>
      </div>

      {/* Toast Notification */}
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

      {/* Grid Layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <motion.div 
            key={item.tag_id}
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={() => setSelectedImage(item)}
            className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer bg-slate-900 border border-white/10 shadow-lg"
          >
            {/* Image */}
            <img src={item.url} alt={item.event_name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            
            {/* Visual HTML Overlay (Only seen on the app) */}
            <div className="absolute top-2 right-2 opacity-30 pointer-events-none w-16">
              <Image src="/logo/rad-logo_white_2.png" alt="RAD Academy" width={80} height={26} unoptimized className="drop-shadow-md" />
            </div>

            {/* Hover Overlay */}
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
                <p className="text-[10px] font-black uppercase tracking-widest text-white truncate">{item.event_name}</p>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{new Date(item.date).toLocaleDateString()}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lightbox / Expanded View Modal */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setSelectedImage(null)} 
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              className="relative w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row bg-[#020617] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-rose-500 text-white rounded-full transition-colors backdrop-blur-md">
                <X size={20} />
              </button>

              {/* Main Image Area */}
              <div className="flex-1 relative bg-black flex items-center justify-center min-h-[40vh] md:min-h-[60vh]">
                <img src={selectedImage.url} alt="Expanded view" className="max-w-full max-h-[90vh] object-contain" />
                
                {/* Visual HTML Overlay (Only seen on the app) */}
                <div className="absolute bottom-6 right-6 opacity-40 pointer-events-none w-24 md:w-32">
                  <Image src="/logo/rad-logo_white_2.png" alt="RAD" width={120} height={40} unoptimized className="drop-shadow-xl" />
                </div>
              </div>

              {/* Details & Actions Sidebar */}
              <div className="w-full md:w-80 bg-[#0f172a] border-l border-white/5 p-6 md:p-8 flex flex-col justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
                      <ImageIcon size={18} />
                    </div>
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
                      {isSharing === selectedImage.tag_id ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} 
                      Share / Download
                    </button>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    onClick={() => handleRequestRemoval(selectedImage.tag_id)}
                    disabled={isProcessing}
                    className="w-full py-3 bg-transparent hover:bg-rose-500/10 text-rose-500/70 hover:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-transparent hover:border-rose-500/20 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} 
                    Hide From Dashboard
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