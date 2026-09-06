"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ePub, { Book, Rendition } from "epubjs";
import { ChevronLeft, ChevronRight, Sun, BookOpen, Moon, Minus, Plus, Search, X, ChevronUp, ChevronDown } from "lucide-react";

export type EpubTheme = 'light' | 'sepia' | 'dark';

interface EpubViewerProps {
  url: string;
  initialCfi?: string; // Exact resume position from a previous session
  initialTheme?: EpubTheme; // Defaults to 'light' - v1 doesn't pass this, so it's unaffected
  currentColor?: string;
  onHighlight?: (text: string, cfi: string, color: string, chapterTitle: string | null) => void;
  onHighlightClick?: (cfi: string) => void;
  onLocationChange?: (cfi: string) => void;
  // Previously-generated locations map (book.locations.save()'s output), so
  // percentage tracking doesn't require re-walking the whole book's text on
  // every open. Undefined/null on a book's first-ever open.
  cachedLocations?: string | null;
  // Fired once, after generating a fresh locations map for a book that
  // didn't have one cached yet - the caller persists it for next time.
  onLocationsGenerated?: (locations: string) => void;
  // Real 0-100 percentage, only fires once locations are ready (cached or
  // freshly generated) - undefined/absent until then, same as PDF's
  // page/total-derived percentage.
  onProgressChange?: (percentage: number) => void;
}

function flattenToc(items: any[]): { href: string; label: string }[] {
  const flat: { href: string; label: string }[] = [];
  const walk = (nodes: any[]) => {
    nodes.forEach((node) => {
      if (node.href && node.label) flat.push({ href: node.href, label: String(node.label).trim() });
      if (node.subitems && node.subitems.length > 0) walk(node.subitems);
    });
  };
  walk(items || []);
  return flat;
}

function hrefBasename(href: string): string {
  return href.split("/").pop()?.split("#")[0] || href;
}

function findChapterForHref(toc: { href: string; label: string }[], href: string | null): string | null {
  if (!href) return null;
  const target = hrefBasename(href);
  const match = toc.find((entry) => hrefBasename(entry.href) === target);
  return match ? match.label : null;
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
  removeHighlight: (cfiRange: string) => void;
}

const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  {
    url,
    initialCfi,
    initialTheme,
    currentColor = "yellow",
    onHighlight,
    onHighlightClick,
    onLocationChange,
    cachedLocations,
    onLocationsGenerated,
    onProgressChange,
  },
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

  const onHighlightRef = useRef(onHighlight);
  useEffect(() => {
    onHighlightRef.current = onHighlight;
  }, [onHighlight]);

  const onHighlightClickRef = useRef(onHighlightClick);
  useEffect(() => {
    onHighlightClickRef.current = onHighlightClick;
  }, [onHighlightClick]);

  const onLocationsGeneratedRef = useRef(onLocationsGenerated);
  useEffect(() => {
    onLocationsGeneratedRef.current = onLocationsGenerated;
  }, [onLocationsGenerated]);

  const onProgressChangeRef = useRef(onProgressChange);
  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  // Percentage tracking: locationsReadyRef flips true once a locations map
  // is either loaded from cache or freshly generated, and currentCfiRef
  // tracks where we are so a percentage can be reported the instant
  // generation finishes, without waiting for the next page turn.
  const locationsReadyRef = useRef(false);
  const currentCfiRef = useRef<string | null>(null);
  // null = not generating (cached, not yet started, or finished); 0-100 while running.
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);

  // Chapter lookup for the currently-displayed section, resolved from the
  // book's table of contents. Refs (not state) since they're read inside
  // event handlers, not rendered.
  const tocRef = useRef<{ href: string; label: string }[]>([]);
  const currentHrefRef = useRef<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<{ href: string; excerpt: string }[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const preSearchCfiRef = useRef<string | null>(null);

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

      newBook.loaded.navigation.then((nav: any) => {
        if (isMounted) tocRef.current = flattenToc(nav?.toc);
      });

      // Percentage-accurate progress: reuse a previously-generated locations
      // map if we have one (instant), otherwise generate one in the
      // background - on a second, entirely separate, never-rendered Book
      // instance. This matters: epub.js's own Locations.generate() (and an
      // earlier version of this) walks newBook.spine's actual Section
      // objects, calling section.unload() on each after reading it - the
      // *same* Section objects the live rendition has open/cached for
      // reading. Unloading one out from under the visible page mid-read is
      // exactly what caused the flashing and the intermittent
      // "replaceCss" crash: content the manager still had a reference to
      // got ripped out while something else was still using it. A second
      // Book instance has its own independent Sections, so indexing can
      // never touch what's actually on screen. The finished map gets
      // copied onto the live book's `locations` afterward so the rest of
      // this component doesn't need to know indexing happened elsewhere.
      //
      // Also reimplements the loop itself (calling Locations' still-public
      // parse() per section) rather than calling generate() directly,
      // since its hardcoded 100ms pause between every section adds several
      // seconds of pure waiting on a book with many chapters for no
      // benefit, and it exposes no progress signal at all.
      const generateLocations = async () => {
        const indexBook = ePub(url);
        try {
          await indexBook.ready;
          if (!isMounted) return;

          const locations = indexBook.locations as any;
          locations.break = 1600;
          const spineItems: any[] = ((indexBook.spine as any).spineItems || []).filter((s: any) => s.linear);

          if (spineItems.length === 0) {
            locationsReadyRef.current = true;
            return;
          }

          setGenerationProgress(0);
          let collected: string[] = [];

          for (let i = 0; i < spineItems.length; i++) {
            if (!isMounted) return;
            const section = spineItems[i];
            try {
              const contents = await section.load(indexBook.load.bind(indexBook));
              if (!isMounted) return;
              collected = collected.concat(locations.parse(contents, section.cfiBase));
              section.unload();
            } catch (e) {
              console.error("Failed to index a section for EPUB progress", e);
            }
            if (!isMounted) return;
            setGenerationProgress(Math.round(((i + 1) / spineItems.length) * 100));
            // Yield a full tick so the browser can paint/handle input
            // between sections, rather than running the whole book
            // through back-to-back.
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          if (!isMounted) return;

          const liveLocations = newBook.locations as any;
          liveLocations._locations = collected;
          liveLocations.total = collected.length - 1;

          locationsReadyRef.current = true;
          setGenerationProgress(null);
          onLocationsGeneratedRef.current?.(liveLocations.save());
          if (currentCfiRef.current) {
            const percentage = Math.round(liveLocations.percentageFromCfi(currentCfiRef.current) * 100);
            onProgressChangeRef.current?.(percentage);
          }
        } finally {
          // Same race as the main book's own cleanup: indexBook.ready
          // resolves before its internal resource-URL replacement step
          // necessarily finishes, and indexing itself is often quick enough
          // to complete before that step does. Destroying immediately after
          // indexing finished reproduced the exact "replaceCss" crash on
          // this second instance instead of the main one. Wait for
          // indexBook.opened first (bounded, in case it never resolves).
          Promise.race([indexBook.opened.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))]).then(
            () => {
              try { indexBook.destroy(); } catch (e) {}
            }
          );
        }
      };

      if (cachedLocations) {
        try {
          newBook.locations.load(cachedLocations);
          locationsReadyRef.current = true;
        } catch (e) {
          console.error("Failed to load cached EPUB locations", e);
        }
      }

      Object.entries(THEME_STYLES).forEach(([name, styles]) => {
        newRendition.themes.register(name, styles);
      });
      newRendition.themes.select(theme);
      newRendition.themes.fontSize(`${fontSize}%`);

      // Finalizes a selection into a painted highlight + a note-composer
      // prompt - deliberately NOT wired to epub.js's own "selected" event.
      // That event fires off a plain 250ms debounce on every selectionchange
      // inside the content iframe, with no concept of "the mouse button is
      // still down" - any natural pause of more than a quarter-second while
      // still dragging out a longer highlight fires it early, on whatever
      // partial range exists at that moment. Reacting to mouseup/touchend
      // instead only finalizes once the drag has actually ended.
      const finalizeSelection = (contents: any) => {
        const selection = contents.window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        const text = range.toString().trim();
        if (!text) return;

        const cfiRange = contents.cfiFromRange(range);

        newRendition.annotations.highlight(cfiRange, { color: currentColorRef.current }, () => {
          // Click an existing highlight to remove it.
          onHighlightClickRef.current?.(cfiRange);
        });

        selection.removeAllRanges();
        onHighlightRef.current?.(text, cfiRange, currentColorRef.current, findChapterForHref(tocRef.current, currentHrefRef.current));
      };

      // Inject custom CSS to prevent darker overlapping shades, and attach
      // the selection-finalize listeners - registered per section, since
      // each gets its own iframe/document as you navigate.
      newRendition.hooks.content.register((contents: any) => {
        contents.addStylesheetRules([
          [".epubjs-hl", ["mix-blend-mode: multiply", "fill-opacity: 0.5"]],
          [".epubjs-hl[data-color='yellow']", ["fill: #fde047 !important"]],
          [".epubjs-hl[data-color='green']", ["fill: #86efac !important"]],
          [".epubjs-hl[data-color='blue']", ["fill: #93c5fd !important"]],
          [".epubjs-hl[data-color='pink']", ["fill: #f9a8d4 !important"]],
        ]);

        const handleSelectionEnd = () => finalizeSelection(contents);
        contents.document.addEventListener("mouseup", handleSelectionEnd);
        contents.document.addEventListener("touchend", handleSelectionEnd);
      });

      newRendition.display(initialCfi || undefined).then(() => {
        if (!isMounted) return;
        setIsReady(true);

        // Deferred until after the book is visible and painted, and started
        // on a fresh tick rather than immediately - generation is heavy
        // enough that kicking it off in the same tick as the initial render
        // is what was causing the visible flash on open.
        if (!cachedLocations) {
          setTimeout(() => {
            if (isMounted) generateLocations();
          }, 250);
        }
      });

      newRendition.on("relocated", (location: any) => {
        if (!isMounted) return;
        setAtStart(location.atStart);
        setAtEnd(location.atEnd);
        setCurrentLocation(location.start.cfi);
        currentHrefRef.current = location.start.href;
        currentCfiRef.current = location.start.cfi;
        onLocationChangeRef.current?.(location.start.cfi);
        if (locationsReadyRef.current) {
          const percentage = Math.round(newBook.locations.percentageFromCfi(location.start.cfi) * 100);
          onProgressChangeRef.current?.(percentage);
        }
      });

    });

    return () => {
      isMounted = false;
      // Clear the DOM immediately so a fast remount (e.g. navigating
      // straight back into a book) never overlaps with this instance's
      // rendition.
      if (viewerRef.current) viewerRef.current.innerHTML = "";

      // epub.js runs an async resource-URL replacement step as part of its
      // own book-opening sequence (this.replacements(), triggered
      // internally on unpack). destroy() nulls out internal state
      // (including `resources`) synchronously - destroying while that step
      // is still in flight makes its trailing .then() dereference
      // `resources` after it's gone, which epub.js logs via console.error
      // (already caught internally, so nothing actually breaks, but Next's
      // dev overlay surfaces it as if it were a crash). Waiting for the
      // book's own `opened` promise first avoids the race; the timeout
      // fallback just bounds how long a failed-to-open book can delay
      // cleanup.
      Promise.race([newBook.opened.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))]).then(() => {
        try { newBook.destroy(); } catch (e) {}
      });
    };
  }, [url]);
  // onHighlight/onHighlightClick/currentColor are deliberately NOT in this
  // dependency array, and are read via refs inside the listeners above
  // instead. meridian-reader-layout.tsx passes onHighlight as a fresh
  // inline function every render (it calls setState internally, so a new
  // reference is created on every one of THIS component's own re-renders
  // too) - having it in this array meant the whole book got destroyed and
  // recreated on every single relocate event, forever: recreate -> display
  // at the static initial position -> fires "relocated" -> updates
  // progress -> parent re-renders -> new onHighlight reference -> recreate
  // again. That loop was the actual cause of the reader flashing and
  // repeatedly saving the same page-1 position.

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

  // --- SEARCH WITHIN BOOK ---
  // One match per spine section (chapter file), mirroring PdfViewer's
  // one-match-per-page granularity. Sections are loaded off-render via
  // epub.js's own load/unload, not the visible rendition, so searching
  // doesn't disturb your current reading position until you jump to a
  // result. Closing search restores wherever you actually were.
  const openSearch = () => {
    preSearchCfiRef.current = currentLocation || null;
    setIsSearchOpen(true);
  };

  const runSearch = async () => {
    const query = searchQuery.trim().toLowerCase();
    const activeBook = book;
    if (!query || !activeBook) return;

    setIsSearching(true);
    setHasSearched(true);
    const matches: { href: string; excerpt: string }[] = [];
    const spineItems: any[] = (activeBook as any).spine?.spineItems || [];

    for (const item of spineItems) {
      try {
        const doc: Document = await item.load(activeBook.load.bind(activeBook));
        const text = (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
        const idx = text.toLowerCase().indexOf(query);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + query.length + 40);
          const excerpt = `${start > 0 ? "…" : ""}${text.slice(start, end)}…`;
          matches.push({ href: item.href, excerpt });
        }
        item.unload();
      } catch {
        // Skip sections that fail to load rather than aborting the whole search.
      }
    }

    setSearchMatches(matches);
    setSearchMatchIndex(0);
    setIsSearching(false);

    if (matches.length > 0) {
      rendition?.display(matches[0].href);
    }
  };

  const goToMatch = (delta: number) => {
    if (searchMatches.length === 0 || !rendition) return;
    const newIndex = (searchMatchIndex + delta + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(newIndex);
    rendition.display(searchMatches[newIndex].href);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchMatches([]);
    setHasSearched(false);
    if (preSearchCfiRef.current && rendition) {
      rendition.display(preSearchCfiRef.current);
      preSearchCfiRef.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    nextPage: () => changePage('next'),
    prevPage: () => changePage('prev'),
    removeHighlight: (cfiRange: string) => {
      rendition?.annotations.remove(cfiRange, "highlight");
    },
  }));

  return (
    <div className={`flex flex-col h-full w-full transition-colors ${THEME_OUTER_CLASS[theme]}`}>
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 flex-shrink-0 shadow-sm z-10 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button disabled={!isReady || atStart} onClick={() => changePage('prev')} className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <button disabled={!isReady || atEnd} onClick={() => changePage('next')} className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30">
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>

        {isSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 min-w-0">
              <Search size={13} className="text-slate-400 flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search this book..."
                className="flex-1 min-w-0 text-xs bg-transparent outline-none placeholder:text-slate-400"
              />
              {isSearching && <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            </div>

            {hasSearched && !isSearching && (
              <span className="text-[10px] font-bold text-slate-400 flex-shrink-0 whitespace-nowrap">
                {searchMatches.length > 0 ? `${searchMatchIndex + 1}/${searchMatches.length}` : "0 results"}
              </span>
            )}

            <button onClick={() => goToMatch(-1)} disabled={searchMatches.length === 0} className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 flex-shrink-0">
              <ChevronUp size={14} strokeWidth={2.5} />
            </button>
            <button onClick={() => goToMatch(1)} disabled={searchMatches.length === 0} className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 flex-shrink-0">
              <ChevronDown size={14} strokeWidth={2.5} />
            </button>
            <button onClick={closeSearch} className="p-1 text-slate-400 hover:text-slate-700 flex-shrink-0">
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={openSearch}
            disabled={!isReady}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors flex-shrink-0 disabled:opacity-30"
            title="Search this book"
          >
            <Search size={16} strokeWidth={2} />
          </button>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
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

          <div className="hidden xl:block text-[9px] text-slate-400 font-mono truncate max-w-[140px]" title={currentLocation}>
            {!isReady ? "Mounting Engine..." : `CFI: ${currentLocation}`}
          </div>
        </div>
      </div>

      {generationProgress !== null && (
        <div
          className="px-4 py-1.5 bg-brass-50/60 border-b border-brass-100 flex items-center gap-2 flex-shrink-0"
          title="Indexing this book once so progress tracking is percentage-accurate - only happens the first time you open it."
        >
          <span className="text-[9px] font-bold text-brass-600 flex-shrink-0">Indexing for progress tracking…</span>
          <div className="flex-1 h-1 bg-brass-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brass-400 rounded-full transition-[width] duration-200 ease-out"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-brass-600 flex-shrink-0 w-7 text-right">{generationProgress}%</span>
        </div>
      )}

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
