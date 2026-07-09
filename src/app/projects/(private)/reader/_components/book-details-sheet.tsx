"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { toggleBookStatus, updateBookCover, updateBookFormat } from "../_actions/books";

interface BookDetailsSheetProps {
  book: any | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export default function BookDetailsSheet({ book, isOpen, onClose, onDelete }: BookDetailsSheetProps) {
  const [isVip, setIsVip] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  
  // NEW: Format states
  const [isDigital, setIsDigital] = useState(false);
  const [isPhysical, setIsPhysical] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when a new book is selected
  useEffect(() => {
    setIsSynopsisExpanded(false);
    if (book) {
      setIsVip(book.is_vip || false);
      setIsDigital(book.has_digital || false);
      setIsPhysical(book.has_physical || false);
    }
  }, [book]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  // --- HANDLERS ---
  const handleToggleVip = async () => {
    const newValue = !isVip;
    setIsVip(newValue);
    try {
      await toggleBookStatus(book.id, { is_vip: newValue });
    } catch (error) {
      console.error("Failed to toggle VIP status", error);
      setIsVip(!newValue);
    }
  };

  const handleFormatToggle = async (type: 'digital' | 'physical') => {
    const newDigital = type === 'digital' ? !isDigital : isDigital;
    const newPhysical = type === 'physical' ? !isPhysical : isPhysical;

    // Optimistic UI update
    setIsDigital(newDigital);
    setIsPhysical(newPhysical);

    try {
      await updateBookFormat(book.id, newDigital, newPhysical);
    } catch (error) {
      console.error("Failed to update book format", error);
      // Revert on failure
      setIsDigital(isDigital);
      setIsPhysical(isPhysical);
      alert("Failed to update format.");
    }
  };

  const handleRemoveCover = async () => {
    if (confirm("Are you sure you want to remove this cover art?")) {
      await updateBookCover(book.id, ""); 
      onClose(); 
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/storage/upload-cover", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const { key } = await response.json();
      await updateBookCover(book.id, key);
      onClose(); 
    } catch (error) {
      console.error("Failed to upload new cover", error);
      alert("Failed to upload cover art.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200 overflow-hidden">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0 bg-white z-20">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Volume Details</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          
          <div className="relative h-72 bg-slate-900 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner group">
            {book.cover_key ? (
              <>
                <img 
                  src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`} 
                  alt="" 
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-125 saturate-200" 
                />
                <img 
                  src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`} 
                  alt={`Cover for ${book.title}`} 
                  className="absolute inset-0 w-full h-full object-contain p-6 drop-shadow-2xl z-10 transition-transform duration-300 group-hover:scale-95" 
                />
              </>
            ) : (
              <svg width="48" height="48" className="text-slate-600 z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            )}

            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUploadCover} 
                accept="image/*" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold rounded-lg backdrop-blur-md transition-colors flex items-center gap-2"
              >
                {isUploading ? "Uploading..." : "Upload New Art"}
              </button>
              {book.cover_key && (
                <button 
                  onClick={handleRemoveCover}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-100 text-sm font-semibold rounded-lg backdrop-blur-md transition-colors"
                >
                  Remove Cover
                </button>
              )}
            </div>
          </div>

          <div className="p-6 md:p-8">
            
            {/* --- INTERACTIVE FORMAT TOGGLES --- */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button 
                onClick={() => handleFormatToggle('digital')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md border tracking-wide uppercase transition-colors ${
                  isDigital 
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' 
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                }`}
              >
                Digital {isDigital && book.file_type ? `· ${book.file_type}` : ''}
              </button>
              
              <button 
                onClick={() => handleFormatToggle('physical')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md border tracking-wide uppercase transition-colors ${
                  isPhysical 
                    ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' 
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                }`}
              >
                Physical
              </button>
            </div>
            {/* ---------------------------------- */}
            
            <div className="flex items-start justify-between gap-4 mb-1">
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight tracking-tight">{book.title}</h1>
              
              <button 
                onClick={handleToggleVip}
                className={`p-2 rounded-full flex-shrink-0 transition-colors ${isVip ? 'text-amber-400 bg-amber-50 hover:bg-amber-100' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                title={isVip ? "Remove from VIP" : "Mark as VIP"}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill={isVip ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
            </div>
            
            <p className="text-base text-slate-500 font-medium mb-6">{book.author || "Unknown Author"}</p>

            <div className="prose prose-sm prose-slate">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-2 border-b border-slate-200 pb-2">Synopsis</h3>
              
              {(() => {
                const fullText = book.synopsis || "No description was found in the database for this volume. You can open the reader to begin exploring the text directly.";
                const parts = fullText.split("---MORE---");
                const summary = parts[0]?.trim();
                const details = parts[1]?.trim();

                return (
                  <div className="flex flex-col items-start">
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {summary}
                    </p>
                    
                    {details && !isSynopsisExpanded && (
                      <button 
                        onClick={() => setIsSynopsisExpanded(true)}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 tracking-wide uppercase flex items-center gap-1"
                      >
                        Read Full Details <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                    )}

                    {details && isSynopsisExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Extended Work Description</h4>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                          {details}
                        </p>
                        <button 
                          onClick={() => setIsSynopsisExpanded(false)}
                          className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-800 tracking-wide uppercase flex items-center gap-1"
                        >
                          Show Less <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {book.tags && book.tags.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {book.tags.map((t: any) => (
                    <span key={t.id} className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                      #{t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Source File</h3>
              {book.file_key ? (
                <div className="flex items-center gap-2 p-3 bg-slate-100 border border-slate-200 rounded-lg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 flex-shrink-0">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <span className="text-[11px] font-mono text-slate-600 truncate flex-1" title={book.file_key}>
                    {book.file_key}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No digital file attached.</p>
              )}
            </div>

          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between z-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
          <button 
            onClick={() => {
              onClose();
              onDelete(book.id);
            }}
            className="text-sm font-semibold text-slate-400 hover:text-red-600 transition-colors px-4 py-2"
          >
            Remove
          </button>
          
          <Link 
            href={`/projects/reader/${book.id}`}
            className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-md hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            {book.has_digital ? "Open Reader" : "Log Progress"} 
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
          </Link>
        </div>
      </div>
    </>
  );
}