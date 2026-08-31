"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Minus, Plus, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  url: string;
  initialProgress?: number;
  initialPage?: number; // Exact resume position - takes priority over initialProgress when present
  onProgressChange?: (currentPage: number, totalPages: number) => void;
  onTextSelected?: (text: string, pageNum: number, chapterTitle: string | null) => void;
  // Existing notes' excerpts for this book, keyed by page - used to paint an
  // approximate "you noted something here" marker when revisiting a page.
  // Approximate (first ~60 chars of the excerpt, single text-item match)
  // because PDF text layers are chunked per line/run, not per selection, so
  // an exact multi-line replay of the original selection isn't reliable the
  // way EPUB's CFI-anchored highlight is.
  noteExcerptsByPage?: Record<number, string[]>;
}

export interface PdfViewerHandle {
  nextPage: () => void;
  prevPage: () => void;
}

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { url, initialProgress = 0, initialPage, onProgressChange, onTextSelected, noteExcerptsByPage },
  ref
) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  // Fit-to-width rendering: PDFs are fixed-layout, so instead of a hardcoded
  // scale (which on a phone either overflows sideways or forces a pinch-zoom
  // out that shrinks the text below readable size), the scale is derived
  // from the actual available width divided by the page's native width.
  // zoomFactor is a multiplier on top of that fit - 100% always means "fills
  // the screen," on any device, rather than a fixed absolute PDF scale.
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageNativeWidth, setPageNativeWidth] = useState(0);
  const [zoomFactor, setZoomFactor] = useState(1);

  useEffect(() => {
    const el = pageWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handlePageLoadSuccess = (page: any) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageNativeWidth(viewport.width);
  };

  const fitScale = containerWidth > 0 && pageNativeWidth > 0 ? containerWidth / pageNativeWidth : null;
  const scale = fitScale !== null ? fitScale * zoomFactor : 1;

  // Holds the full PDFDocumentProxy (react-pdf's onLoadSuccess actually
  // receives this whole object, not just { numPages }) so search can walk
  // each page's text content on demand.
  const pdfDocRef = useRef<any>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [highlightTerm, setHighlightTerm] = useState("");

  // The page you were actually reading before you opened search, so closing
  // search can put you back there instead of leaving your saved position
  // wherever you last peeked at a result.
  const preSearchPageRef = useRef<number | null>(null);

  const pdfOptions = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  };

  // Chapter titles for the currently-selected excerpt, resolved from the
  // PDF's own outline/bookmarks (not every PDF has one - scanned or
  // simply-built PDFs often don't, and that's fine, notes just carry no
  // chapter then, same as before this existed).
  const outlineRef = useRef<{ page: number; title: string }[] | null>(null);

  const getChapterForPage = (page: number): string | null => {
    const outline = outlineRef.current;
    if (!outline || outline.length === 0) return null;
    let match: string | null = null;
    for (const entry of outline) {
      if (entry.page > page) break;
      match = entry.title;
    }
    return match;
  };

  const loadOutline = async (pdf: any) => {
    try {
      const items = await pdf.getOutline();
      if (!items || items.length === 0) return;

      const flat: { title: string; dest: any }[] = [];
      const flatten = (nodes: any[]) => {
        nodes.forEach((node) => {
          if (node.title && node.dest) flat.push({ title: node.title, dest: node.dest });
          if (node.items && node.items.length > 0) flatten(node.items);
        });
      };
      flatten(items);

      const resolved = await Promise.all(
        flat.map(async ({ title, dest }) => {
          try {
            const explicitDest = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
            if (!explicitDest) return null;
            const pageIndex = await pdf.getPageIndex(explicitDest[0]);
            return { page: pageIndex + 1, title };
          } catch {
            return null;
          }
        })
      );

      outlineRef.current = resolved
        .filter((e): e is { page: number; title: string } => e !== null)
        .sort((a, b) => a.page - b.page);
    } catch {
      // No outline, or pdf.js couldn't parse one - notes just carry no chapter.
    }
  };

  const onDocumentLoadSuccess = (pdf: any) => {
    pdfDocRef.current = pdf;
    const total = pdf.numPages as number;
    setNumPages(total);
    loadOutline(pdf);

    const startPage = initialPage
      ? Math.min(Math.max(1, initialPage), total)
      : initialProgress > 0
        ? Math.max(1, Math.round((initialProgress / 100) * total))
        : 1;

    setPageNumber(startPage);
    if (onProgressChange) onProgressChange(startPage, total);
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

  useImperativeHandle(ref, () => ({
    nextPage: () => changePage(1),
    prevPage: () => changePage(-1),
  }));

  // --- TEXT EXTRACTION ENGINE ---
  // Bound to both mouseup and touchend so selecting text (via mouse drag on
  // desktop, or long-press-and-drag handles on mobile) reliably triggers a
  // note, instead of relying on mouseup alone which touch browsers don't
  // consistently fire for a finalized selection.
  const handleSelectionEnd = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      const selectedText = selection.toString().trim();
      if (onTextSelected) onTextSelected(selectedText, pageNumber, getChapterForPage(pageNumber));
    }
  };

  // --- SEARCH WITHIN BOOK ---
  // Page-level "jump to a page containing this text," with the matched term
  // highlighted in-page via customTextRenderer below. Deliberately does NOT
  // call onProgressChange while browsing results - jumping to peek at a
  // match isn't "I've read up to here," and previously it was silently
  // overwriting the real saved reading position. Closing search restores
  // whatever page you were actually on before you opened it.
  const openSearch = () => {
    preSearchPageRef.current = pageNumber;
    setIsSearchOpen(true);
  };

  const runSearch = async () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || !pdfDocRef.current) return;

    setIsSearching(true);
    setHasSearched(true);
    const total = pdfDocRef.current.numPages as number;
    const matches: number[] = [];

    for (let i = 1; i <= total; i++) {
      try {
        const page = await pdfDocRef.current.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str || "").join(" ").toLowerCase();
        if (text.includes(query)) matches.push(i);
      } catch {
        // Skip pages that fail to extract text rather than aborting the whole search.
      }
    }

    setSearchMatches(matches);
    setSearchMatchIndex(0);
    setHighlightTerm(searchQuery.trim());
    setIsSearching(false);

    if (matches.length > 0) {
      setPageNumber(matches[0]);
    }
  };

  const goToMatch = (delta: number) => {
    if (searchMatches.length === 0) return;
    const newIndex = (searchMatchIndex + delta + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(newIndex);
    setPageNumber(searchMatches[newIndex]);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchMatches([]);
    setHasSearched(false);
    setHighlightTerm("");
    if (preSearchPageRef.current !== null) {
      setPageNumber(preSearchPageRef.current);
      preSearchPageRef.current = null;
    }
  };

  // A short, word-bounded lead-in from each note's excerpt on this page -
  // enough to spot "I noted something here" while scrolling back, without
  // pretending to reconstruct the exact original (possibly multi-line)
  // selection the way EPUB's CFI-anchored highlight can.
  const pageNoteMarkers = noteExcerptsByPage?.[pageNumber] || [];
  const noteMarkerTerms = pageNoteMarkers
    .map((excerpt) => {
      const lead = excerpt.trim().slice(0, 60);
      const words = lead.split(/\s+/);
      // Drop a possibly mid-word-truncated trailing word so the term
      // matches cleanly rather than failing to match at all.
      if (words.length > 1) words.pop();
      return words.join(" ");
    })
    .filter((term) => term.length > 3);

  const customTextRenderer = useCallback(
    (textItem: { str: string }) => {
      const escaped = escapeHtml(textItem.str);

      // Active search takes priority and is shown exclusively - layering both
      // mark types could produce overlapping/nested <mark> tags on the same
      // run of text.
      if (highlightTerm) {
        const regex = new RegExp(`(${escapeRegExp(escapeHtml(highlightTerm))})`, "gi");
        return escaped.replace(regex, '<mark class="pdf-search-mark">$1</mark>');
      }

      if (noteMarkerTerms.length === 0) return escaped;
      let result = escaped;
      for (const term of noteMarkerTerms) {
        if (!term) continue;
        const regex = new RegExp(`(${escapeRegExp(escapeHtml(term))})`, "i");
        if (regex.test(result)) {
          result = result.replace(regex, '<mark class="pdf-note-mark">$1</mark>');
          break;
        }
      }
      return result;
    },
    [highlightTerm, noteMarkerTerms.join("|")]
  );

  return (
    <div className="flex flex-col h-full w-full bg-slate-200/50">
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 flex-shrink-0 shadow-sm z-10 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          <span className="text-xs font-bold text-slate-700 font-mono">
            {pageNumber} / {numPages || "--"}
          </span>

          <button
            disabled={pageNumber >= (numPages || 1)}
            onClick={() => changePage(1)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
          >
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
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
            title="Search this book"
          >
            <Search size={16} strokeWidth={2} />
          </button>
        )}

        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200 flex-shrink-0">
          <button onClick={() => setZoomFactor(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="p-1.5 text-slate-500 hover:text-slate-900">
            <Minus size={14} strokeWidth={2.5} />
          </button>
          <span className="text-[10px] font-bold text-slate-500 w-10 text-center">{Math.round(zoomFactor * 100)}%</span>
          <button onClick={() => setZoomFactor(z => Math.min(2.5, +(z + 0.1).toFixed(2)))} className="p-1.5 text-slate-500 hover:text-slate-900">
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* mouseup covers desktop drag-selection; touchend covers a finalized
          long-press selection on mobile, which doesn't reliably fire mouseup */}
      <div
        className="flex-1 overflow-y-auto flex justify-center p-2 sm:p-6 custom-scrollbar ph-no-capture"
        onMouseUp={handleSelectionEnd}
        onTouchEnd={handleSelectionEnd}
      >
        <div ref={pageWrapperRef} className="w-full max-w-3xl flex justify-center">
          <Document
            file={url}
            options={pdfOptions}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center mt-20 gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
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
              customTextRenderer={customTextRenderer}
              onLoadSuccess={handlePageLoadSuccess}
              className="bg-white overflow-hidden rounded-sm"
            />
          </Document>
        </div>
      </div>
    </div>
  );
});

export default PdfViewer;
