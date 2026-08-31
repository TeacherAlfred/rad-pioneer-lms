"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ePub, { Book, Rendition } from "epubjs";
import { ChevronLeft, ChevronRight, Sun, BookOpen, Moon, Minus, Plus } from "lucide-react";

export type EpubTheme = 'light' | 'sepia' | 'dark';

interface EpubViewerProps {
  url: string;
  initialCfi?: string; // Exact resume position from a previous session
  initialTheme?: EpubTheme; // Defaults to 'light' - v1 doesn't pass this, so it's unaffected
  currentColor?: string;
  onHighlight?: (text: string, cfi: string, color: string) => void;
  onHighlightClick?: (cfi: string) => void;
  onLocationChange?: (cfi: string) => void;
}

const THEME_STYLES: Record<EpubTheme, Record<string, Record<string, string>>> = {
  light: { body: { color: "#1e293b", background: "#ffffff" } },
  sepia: { body: { color: "#5b4636", background: "#f4ecd8" } },
  dark: { body: { color: "#e2e8f0", background: "#0f172a" } },
};

const THEME_FRAME_CLASS: Record<EpubTheme, string> = {
  light: "bg-white",
  sepia: "bg-[#f4ecd8]",
  dark: "bg-[#0f172a]",
};

const THEME_OUTER_CLASS: Record<EpubTheme, string> = {
  light: "bg-slate-50",
  sepia: "bg-[#ece0c8]",
  dark: "bg-[#020617]",
};

const THEME_ORDER: EpubTheme[] = ['light', 'sepia', 'dark'];
const THEME_ICON: Record<EpubTheme, typeof Sun> = { light: Sun, sepia: BookOpen, dark: Moon };

export interface EpubViewerHandle {
  nextPage: () => void;
  prevPage: () => void;
}

const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  { url, initialCfi, initialTheme, currentColor = "yellow", onHighlight, onHighlightClick, onLocationChange },
  ref
) {
  const viewerRef = useRef<HTMLDivElement>(null);

  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>("");

  const [theme, setTheme] = useState<EpubTheme>(initialTheme || 'light');
  // A touch-typical phone width renders the same percentage smaller in
  // practice than a desktop reading pane, so start a notch larger there.
  const [fontSize, setFontSize] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 115 : 100
  );

  // Kept in a ref (not the effect's dependency array) so passing a fresh
  // inline callback on every parent render doesn't remount the whole book.
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

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

      Object.entries(THEME_STYLES).forEach(([name, styles]) => {
        newRendition.themes.register(name, styles);
      });
      newRendition.themes.select(theme);
      newRendition.themes.fontSize(`${fontSize}%`);

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

      newRendition.display(initialCfi || undefined).then(() => {
        if (isMounted) setIsReady(true);
      });

      newRendition.on("relocated", (location: any) => {
        if (!isMounted) return;
        setAtStart(location.atStart);
        setAtEnd(location.atEnd);
        setCurrentLocation(location.start.cfi);
        onLocationChangeRef.current?.(location.start.cfi);
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

  // Theme/font-size changes apply to the live rendition - no remount needed.
  useEffect(() => {
    rendition?.themes.select(theme);
  }, [theme, rendition]);

  useEffect(() => {
    rendition?.themes.fontSize(`${fontSize}%`);
  }, [fontSize, rendition]);

  const cycleTheme = () => {
    const nextIndex = (THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length;
    setTheme(THEME_ORDER[nextIndex]);
  };

  const ThemeIcon = THEME_ICON[theme];

  const changePage = (direction: 'next' | 'prev') => {
    if (!rendition || !isReady) return;
    if (direction === 'next') rendition.next();
    if (direction === 'prev') rendition.prev();
  };

  useImperativeHandle(ref, () => ({
    nextPage: () => changePage('next'),
    prevPage: () => changePage('prev'),
  }));

  return (
    <div className={`flex flex-col h-full w-full transition-colors ${THEME_OUTER_CLASS[theme]}`}>
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <button disabled={!isReady || atStart} onClick={() => changePage('prev')} className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <button disabled={!isReady || atEnd} onClick={() => changePage('next')} className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30">
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cycleTheme}
            title={`Reading theme: ${theme} (click to cycle)`}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors"
          >
            <ThemeIcon size={16} strokeWidth={2} />
          </button>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setFontSize(s => Math.max(70, s - 10))} className="p-1.5 text-slate-500 hover:text-slate-900">
              <Minus size={12} strokeWidth={2.5} />
            </button>
            <span className="text-[10px] font-bold text-slate-500 w-8 text-center">{fontSize}%</span>
            <button onClick={() => setFontSize(s => Math.min(180, s + 10))} className="p-1.5 text-slate-500 hover:text-slate-900">
              <Plus size={12} strokeWidth={2.5} />
            </button>
          </div>

          <div className="hidden lg:block text-[9px] text-slate-400 font-mono truncate max-w-[140px]" title={currentLocation}>
            {!isReady ? "Mounting Engine..." : `CFI: ${currentLocation}`}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex justify-center p-2 sm:p-6 lg:p-10 custom-scrollbar relative">
        {!isReady && (
          <div className={`absolute inset-0 flex items-center justify-center z-20 transition-colors ${THEME_OUTER_CLASS[theme]}`}>
             <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div ref={viewerRef} className={`w-full max-w-3xl h-full shadow-xl rounded-md overflow-hidden transition-opacity duration-300 ${THEME_FRAME_CLASS[theme]}`} style={{ opacity: isReady ? 1 : 0 }} />
      </div>
    </div>
  );
});

export default EpubViewer;
