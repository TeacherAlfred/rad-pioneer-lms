"use client";

import { useEffect, useRef, useState } from "react";
import ePub, { Book, Rendition } from "epubjs";

interface EpubViewerProps {
  url: string;
  currentColor?: string;
  onHighlight?: (text: string, cfi: string, color: string) => void;
  onHighlightClick?: (cfi: string) => void;
}

export default function EpubViewer({ url, currentColor = "yellow", onHighlight, onHighlightClick }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const newBook = ePub(url);
    setBook(newBook);

    newBook.ready.then(() => {
      if (!viewerRef.current || !isMounted) return;

      const newRendition = newBook.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        spread: "none", 
        manager: "continuous",
        flow: "paginated",
      });

      setRendition(newRendition);

      // Inject custom CSS to prevent darker overlapping shades
      newRendition.hooks.content.register((contents: any) => {
        contents.addStylesheetRules([
          [".epubjs-hl", ["mix-blend-mode: multiply", "fill-opacity: 0.5"]],
          [".epubjs-hl[data-color='yellow']", ["fill: #fde047 !important"]],
          [".epubjs-hl[data-color='green']", ["fill: #86efac !important"]],
          [".epubjs-hl[data-color='blue']", ["fill: #93c5fd !important"]],
          [".epubjs-hl[data-color='pink']", ["fill: #f9a8d4 !important"]],
        ]);
      });

      newRendition.display().then(() => {
        if (isMounted) setIsReady(true);
      });

      newRendition.on("relocated", (location: any) => {
        if (!isMounted) return;
        setAtStart(location.atStart);
        setAtEnd(location.atEnd);
        setCurrentLocation(location.start.cfi);
      });

      // The Highlight Action Listener
      newRendition.on("selected", (cfiRange: string, contents: any) => {
        newBook.getRange(cfiRange).then((range) => {
          const text = range.toString().trim();
          
          if (text) {
            // Paint the text with the currently active color
            newRendition.annotations.highlight(cfiRange, { color: currentColor }, (e: any) => {
              // Click listener for deletion
              if (onHighlightClick) onHighlightClick(cfiRange);
            });

            contents.window.getSelection().removeAllRanges();

            if (onHighlight) {
              onHighlight(text, cfiRange, currentColor);
            }
          }
        });
      });
    });

    return () => {
      isMounted = false;
      try { newBook.destroy(); } catch (e) {}
      if (viewerRef.current) viewerRef.current.innerHTML = ""; 
    };
  }, [url, onHighlight, onHighlightClick]); // Note: currentColor is NOT in dependency array so it doesn't remount the book when you switch colors

  // Listen for color changes without remounting
  const currentColorRef = useRef(currentColor);
  useEffect(() => {
    currentColorRef.current = currentColor;
  }, [currentColor]);

  const changePage = (direction: 'next' | 'prev') => {
    if (!rendition || !isReady) return;
    if (direction === 'next') rendition.next();
    if (direction === 'prev') rendition.prev();
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50">
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button disabled={!isReady || atStart} onClick={() => changePage('prev')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button disabled={!isReady || atEnd} onClick={() => changePage('next')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        <div className="text-[9px] text-slate-400 font-mono truncate max-w-[200px]" title={currentLocation}>
          {!isReady ? "Mounting Engine..." : `CFI: ${currentLocation}`}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex justify-center p-6 lg:p-10 custom-scrollbar relative">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-20">
             <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div ref={viewerRef} className="w-full max-w-3xl h-full bg-white shadow-xl rounded-md overflow-hidden transition-opacity duration-300" style={{ opacity: isReady ? 1 : 0 }} />
      </div>
    </div>
  );
}