"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
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
  onTextSelected?: (text: string, pageNum: number) => void;
}

export interface PdfViewerHandle {
  nextPage: () => void;
  prevPage: () => void;
}

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { url, initialProgress = 0, initialPage, onProgressChange, onTextSelected },
  ref
) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);

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

  const onDocumentLoadSuccess = (pdf: any) => {
    pdfDocRef.current = pdf;
    const total = pdf.numPages as number;
    setNumPages(total);

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
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      const selectedText = selection.toString().trim();
      if (onTextSelected) onTextSelected(selectedText, pageNumber);

      // Optional: Clear the browser's blue highlight after extraction to keep UI clean
      // selection.removeAllRanges();
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

  const customTextRenderer = useCallback(
    (textItem: { str: string }) => {
      const escaped = escapeHtml(textItem.str);
      if (!highlightTerm) return escaped;
      const regex = new RegExp(`(${escapeRegExp(escapeHtml(highlightTerm))})`, "gi");
      return escaped.replace(regex, '<mark class="pdf-search-mark">$1</mark>');
    },
    [highlightTerm]
  );

  return (
    <div className="flex flex-col h-full w-full bg-slate-200/50">
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 shadow-sm z-10 gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          <span className="text-xs font-bold text-slate-700 font-mono">
            {pageNumber} / {numPages || "--"}
          </span>

          <button
            disabled={pageNumber >= (numPages || 1)}
            onClick={() => changePage(1)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
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
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 text-slate-500 hover:text-slate-900">
            <Minus size={14} strokeWidth={2.5} />
          </button>
          <span className="text-[10px] font-bold text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1 text-slate-500 hover:text-slate-900">
            <Plus size={14} strokeWidth={2.5} />
          </button>
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
            className="bg-white overflow-hidden rounded-sm"
          />
        </Document>
      </div>
    </div>
  );
});

export default PdfViewer;
