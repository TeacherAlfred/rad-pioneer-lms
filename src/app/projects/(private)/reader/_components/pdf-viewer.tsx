"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  url: string;
  initialProgress?: number; // NEW PROP
  onProgressChange?: (currentPage: number, totalPages: number) => void;
  onTextSelected?: (text: string, pageNum: number) => void;
}

export default function PdfViewer({ url, initialProgress = 0, onProgressChange, onTextSelected }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);

  const pdfOptions = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    
    // Convert saved percentage back to a page number (Default to 1)
    const startPage = initialProgress > 0 
      ? Math.max(1, Math.round((initialProgress / 100) * numPages)) 
      : 1;
      
    setPageNumber(startPage);
    if (onProgressChange) onProgressChange(startPage, numPages);
  };

  const changePage = (offset: number) => {
    // 1. Calculate the new page independently
    const newPage = Math.min(Math.max(1, pageNumber + offset), numPages || 1);
    
    // 2. Update local state
    setPageNumber(newPage);
    
    // 3. Fire the parent callback safely outside the local updater function
    if (onProgressChange) {
      onProgressChange(newPage, numPages || 1);
    }
  };

  // --- TEXT EXTRACTION ENGINE ---
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      const selectedText = selection.toString().trim();
      if (onTextSelected) onTextSelected(selectedText, pageNumber);
      
      // Optional: Clear the browser's blue highlight after extraction to keep UI clean
      // selection.removeAllRanges(); 
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-200/50">
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button 
            disabled={pageNumber <= 1} 
            onClick={() => changePage(-1)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          <span className="text-xs font-bold text-slate-700 font-mono">
            {pageNumber} / {numPages || "--"}
          </span>
          
          <button 
            disabled={pageNumber >= (numPages || 1)} 
            onClick={() => changePage(1)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="px-2 text-slate-500 hover:text-slate-900 font-bold">−</button>
          <span className="text-[10px] font-bold text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="px-2 text-slate-500 hover:text-slate-900 font-bold">+</button>
        </div>
      </div>

      {/* Attach MouseUp to the scrollable container */}
      <div 
        className="flex-1 overflow-y-auto flex justify-center p-6 custom-scrollbar ph-no-capture"
        onMouseUp={handleMouseUp}
      >
        <Document
          file={url}
          options={pdfOptions}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center mt-20 gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Decrypting secure stream...</p>
            </div>
          }
          className="drop-shadow-2xl"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale} 
            renderMode="canvas"
            renderTextLayer={true} 
            renderAnnotationLayer={true} 
            className="bg-white overflow-hidden rounded-sm"
          />
        </Document>
      </div>
    </div>
  );
}