"use client";

import { useState } from "react";
import { getPresignedUploadUrl, registerWipBook } from "../_actions/upload";

interface UploadModalProps {
  onClose: () => void;
  existingBooks: any[]; // Used for instant duplicate detection
}

interface QueuedFile {
  file: File;
  cleanName: string;
  isDuplicate: boolean;
  willUpload: boolean;
}

export default function UploadModal({ onClose, existingBooks }: UploadModalProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0, currentFileName: "" });

  // Normalizes text to aggressively find matches (e.g. "The_Book-v2" -> "thebookv2")
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const newFiles = Array.from(e.target.files).map(file => {
      const cleanName = file.name.replace(/\.[^/.]+$/, ""); // Strip extension
      const normalizedCleanName = normalize(cleanName);
      
      // Check if this filename closely matches any existing book title
      const isDuplicate = existingBooks.some(b => 
        normalize(b.title || "").includes(normalizedCleanName) || 
        normalizedCleanName.includes(normalize(b.title || ""))
      );

      return {
        file,
        cleanName,
        isDuplicate,
        willUpload: !isDuplicate, // By default, DO NOT upload duplicates
      };
    });

    setQueue(prev => [...prev, ...newFiles]);
  };

  const toggleUploadStatus = (index: number) => {
    setQueue(prev => prev.map((q, i) => i === index ? { ...q, willUpload: !q.willUpload } : q));
  };

  const removeFileFromQueue = (indexToRemove: number) => {
    setQueue(queue.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    const filesToUpload = queue.filter(q => q.willUpload);
    if (filesToUpload.length === 0) return;
    
    setIsUploading(true);
    setUploadStats({ current: 0, total: filesToUpload.length, currentFileName: "" });

    let completed = 0;

    for (const item of filesToUpload) {
      setUploadStats(prev => ({ ...prev, currentFileName: item.file.name }));
      
      try {
        const { uploadUrl, fileKey } = await getPresignedUploadUrl(item.file.name, item.file.type);

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: item.file,
          headers: { "Content-Type": item.file.type },
        });

        if (!uploadResponse.ok) throw new Error(`Failed to upload ${item.file.name}`);

        const newBook = await registerWipBook(item.cleanName, fileKey, item.file.type);
        
        // Quietly fire the background API route to process metadata instantly
        if (newBook) {
          fetch("/api/process-metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ books: [{ id: newBook.id, title: newBook.title }] }),
          }).catch(err => console.error("Processor trigger failed:", err));
        }
        
        completed++;
        setUploadStats(prev => ({ ...prev, current: completed }));
      } catch (error) {
        console.error(`Upload error for ${item.file.name}:`, error);
      }
    }

    setTimeout(() => onClose(), 800);
  };

  const duplicatesCount = queue.filter(q => q.isDuplicate).length;
  const readyCount = queue.filter(q => q.willUpload).length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Add Digital Volumes</h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">Select multiple PDFs or ePubs. Duplicates will be automatically flagged.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* File Input Area */}
        {!isUploading && (
          <div className="mb-4">
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  Click to browse files
                </p>
              </div>
              <input type="file" multiple accept="application/pdf, application/epub+zip" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        )}

        {/* Selected Files Queue */}
        {queue.length > 0 && !isUploading && (
          <div className="overflow-y-auto mb-4 flex-1 pr-2 custom-scrollbar">
            {duplicatesCount > 0 && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Possible Duplicates Detected</h4>
                  <p className="text-xs text-amber-700 mt-0.5">We found {duplicatesCount} file(s) that already exist in your library. They have been paused by default.</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {queue.map((item, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${item.isDuplicate ? (item.willUpload ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-70') : 'bg-white border-slate-200 shadow-sm'}`}>
                  
                  <div className="flex items-center gap-3 overflow-hidden">
                    <button 
                      onClick={() => toggleUploadStatus(idx)}
                      className={`w-5 h-5 rounded border flex flex-shrink-0 items-center justify-center transition-colors ${item.willUpload ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white text-transparent hover:border-indigo-400'}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                    
                    <div className="truncate">
                      <span className={`text-sm font-bold truncate block ${item.willUpload ? 'text-slate-900' : 'text-slate-500 line-through'}`}>{item.file.name}</span>
                      {item.isDuplicate && (
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${item.willUpload ? 'text-amber-600' : 'text-slate-400'}`}>
                          {item.willUpload ? 'Warning: Uploading Duplicate' : 'Skipping Duplicate'}
                        </span>
                      )}
                    </div>
                  </div>

                  <button onClick={() => removeFileFromQueue(idx)} className="text-slate-400 hover:text-red-500 transition-colors p-2 ml-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress UI */}
        {isUploading && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-bold text-slate-900">Uploading {uploadStats.current} of {uploadStats.total}</h3>
            <p className="text-sm text-slate-500 font-medium mt-2 max-w-[80%] truncate">Processing: {uploadStats.currentFileName}</p>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mt-6 overflow-hidden">
              <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${(uploadStats.current / uploadStats.total) * 100}%` }}></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isUploading && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-auto">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {readyCount} Files Ready
            </div>
            <button 
              onClick={handleUpload} 
              disabled={readyCount === 0}
              className="px-6 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-xl shadow-sm hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center gap-2"
            >
              Start Upload
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}