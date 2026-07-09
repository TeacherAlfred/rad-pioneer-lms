"use client";

import { useState } from "react";
import { publishWipBook } from "../_actions/upload";
import { searchBookOptions } from "../_actions/metadata";

interface WipCardProps {
  book: any;
  onPublishSuccess: () => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function WipCard({ book, onPublishSuccess, isSelectable, isSelected, onToggleSelect }: WipCardProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const suggested = book.suggested_metadata || {};
  const [title, setTitle] = useState(suggested.title || book.title);
  const [author, setAuthor] = useState(suggested.author || "");
  
  const initialSearch = book.title.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null);

  const handleRescan = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = await searchBookOptions(searchQuery);
      if (results.length > 0) {
        setSearchResults(results);
      } else {
        alert("No matches found. Try simplifying the search query.");
      }
    } catch (error) {
      console.error(error);
      alert("Search failed. Try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectOption = (option: any) => {
    setTitle(option.title);
    setAuthor(option.author);
    if (option.coverId) {
      setSelectedCoverId(option.coverId);
    }
    setSearchResults([]); 
  };

  const handlePublish = async () => {
    if (!title.trim()) return alert("Title is required.");
    setIsPublishing(true);

    try {
      const fileExt = book.file_type === "pdf" ? "pdf" : "epub";
      await publishWipBook(
        book.id as string, book.file_key, author, title, fileExt, 
        suggested.coverKey, selectedCoverId, suggested.synopsis
      );
      onPublishSuccess();
    } catch (error) {
      console.error("Failed to publish:", error);
      alert("Failed to move file to the main library.");
      setIsPublishing(false);
    }
  };

  return (
    <div className={`flex flex-col bg-white border-2 shadow-md rounded-2xl overflow-hidden group h-full transition-all ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-purple-200'}`}>
      
      {/* Top Section: Cover & Original Filename */}
      <div className="relative h-56 bg-slate-900 flex items-center justify-center border-b border-slate-200 flex-shrink-0 cursor-pointer overflow-hidden" onClick={() => isSelectable && onToggleSelect && onToggleSelect(book.id)}>
        
        {/* The Selection Checkbox */}
        {isSelectable && (
          <div className="absolute top-3 left-3 z-20 bg-white/50 rounded-md p-1 backdrop-blur-sm">
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => onToggleSelect && onToggleSelect(book.id)}
              className="w-5 h-5 cursor-pointer accent-indigo-600 rounded border-slate-300"
            />
          </div>
        )}

        {suggested.coverKey && !selectedCoverId ? (
          <>
            {/* Ambient Blurred Background */}
            <img 
              src={`/api/storage/cover?key=${encodeURIComponent(suggested.coverKey)}`} 
              alt="" 
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110 saturate-150"
            />
            {/* Crisp Uncropped Foreground */}
            <img 
              src={`/api/storage/cover?key=${encodeURIComponent(suggested.coverKey)}`} 
              alt="Cover" 
              className={`absolute inset-0 w-full h-full object-contain p-4 drop-shadow-2xl transition-all duration-500 z-10 ${isSelected ? 'scale-95' : 'group-hover:scale-105'}`}
            />
          </>
        ) : (
          <div className="text-slate-500 flex flex-col items-center z-10">
            {selectedCoverId ? (
              <svg className="text-purple-400 animate-pulse w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            )}
            <span className="text-[10px] font-semibold mt-2 uppercase tracking-widest text-center px-4">
              {selectedCoverId ? "Cover queued for secure download" : "No Cover Found"}
            </span>
          </div>
        )}
        
        <div className="absolute top-3 right-3 flex justify-between items-start z-20">
          <span className="px-2 py-1 bg-purple-900/80 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wide rounded shadow-sm">
            WIP Staging
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-transparent p-3 pt-12 z-20">
          <p className="text-[10px] text-slate-300 font-mono truncate" title={book.title}>
            File: {book.title}
          </p>
        </div>
      </div>

      {/* Bottom Section: Editor & Search */}
      <div className="p-4 flex flex-col flex-1 gap-4 bg-purple-50/30">
        
        {/* The Multi-Search Override */}
        <div className="bg-white p-2.5 rounded-lg border border-purple-100 shadow-sm">
          <label className="text-[9px] font-bold text-purple-500 uppercase tracking-wide mb-1.5 block">
            Targeted Database Rescan
          </label>
          <div className="flex gap-2 mb-2">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-purple-400 transition-colors"
              placeholder="Clean filename here..."
            />
            <button 
              onClick={handleRescan}
              disabled={isSearching}
              className="px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 rounded text-xs font-bold transition-colors flex items-center justify-center min-w-[70px]"
            >
              {isSearching ? "..." : "Rescan"}
            </button>
          </div>

          {/* Search Results Dropdown/List */}
          {searchResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar border-t border-slate-100 pt-2">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(result)}
                  className="text-left px-2 py-1.5 hover:bg-purple-50 rounded transition-colors border border-transparent hover:border-purple-100"
                >
                  <div className="text-xs font-bold text-slate-900 truncate">{result.title}</div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>{result.author}</span>
                    <span>{result.publishYear || ''}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Final Metadata Editor */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Final Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 shadow-sm transition-all"
            />
          </div>
          
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Author</label>
            <input 
              type="text" 
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 shadow-sm transition-all"
            />
          </div>
        </div>

        <button 
          onClick={handlePublish}
          disabled={isPublishing}
          className="mt-auto w-full py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg shadow hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isPublishing ? (
            <span className="animate-pulse">Moving to Library...</span>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              Publish Book
            </>
          )}
        </button>
      </div>
    </div>
  );
}