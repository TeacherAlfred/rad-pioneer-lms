"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, StickyNote, X, CheckCircle, ClipboardCopy, Lock } from "lucide-react";
import { saveMarginNote, getBookNotes, saveReadingProgress, saveLastPosition } from "../../reader/_actions/notes";
import { toggleBookStatus } from "../../reader/_actions/books";
import { useReaderShortcuts } from "../../reader/_components/use-reader-shortcuts";
import type { PdfViewerHandle } from "../../reader/_components/pdf-viewer";
import type { EpubViewerHandle } from "../../reader/_components/epub-viewer";
import ReadingGauge from "./reading-gauge";
import BookCloseMoment from "./book-close-moment";
import { useAmbientBackground } from "../_lib/use-ambient-background";
import { getAmbientEpubTheme } from "../_lib/time-of-day";

// Reusing the existing, already-solid PDF/EPUB internals (search, highlight,
// EPUB themes, resume position) - Meridian re-skins the chrome around them,
// not the reading engines themselves.
const PdfViewer = dynamic(() => import("../../reader/_components/pdf-viewer"), { ssr: false });
const EpubViewer = dynamic(() => import("../../reader/_components/epub-viewer"), { ssr: false });

interface MeridianReaderLayoutProps {
  book: any;
  fileUrl: string | null;
}

const POSITION_SAVE_DEBOUNCE_MS = 3000;

export default function MeridianReaderLayout({ book, fileUrl }: MeridianReaderLayoutProps) {
  const router = useRouter();
  const ambientBackground = useAmbientBackground();
  // Computed once at open, not live - an EPUB theme swapping under you mid-
  // session would be jarring in a way a chrome color drift isn't.
  const [ambientEpubTheme] = useState(() => getAmbientEpubTheme());
  const [activeStreamUrl] = useState(fileUrl);

  const rootRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PdfViewerHandle>(null);
  const epubRef = useRef<EpubViewerHandle>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [readingProgress, setReadingProgress] = useState<number>(book.reading_progress || 0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [isCompleted, setIsCompleted] = useState(book.status === 'completed');
  const [isVaulted, setIsVaulted] = useState(Boolean(book.is_vaulted));
  const [showCloseMoment, setShowCloseMoment] = useState(false);

  const [notes, setNotes] = useState<any[]>([]);
  const [activeExcerpt, setActiveExcerpt] = useState("");
  const [activePage, setActivePage] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [showWelcomeBack] = useState(() => Boolean(book.last_page_number || book.last_cfi));
  const [welcomeBackVisible, setWelcomeBackVisible] = useState(showWelcomeBack);
  const welcomeBackLabel =
    book.file_type === "pdf" && book.last_page_number
      ? `Resumed at page ${book.last_page_number}`
      : "Resumed where you left off";

  useEffect(() => {
    async function loadNotes() {
      const fetchedNotes = await getBookNotes(book.id);
      setNotes(fetchedNotes);
    }
    loadNotes();
  }, [book.id]);

  const positionRef = useRef<{ lastPageNumber?: number; lastCfi?: string }>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPositionSave = () => {
    const pos = positionRef.current;
    if (pos.lastPageNumber === undefined && pos.lastCfi === undefined) return;
    saveLastPosition(book.id, pos).catch((error) => console.error("Failed to save reading position", error));
  };

  const schedulePositionSave = (next: { lastPageNumber?: number; lastCfi?: string }) => {
    positionRef.current = { ...positionRef.current, ...next };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushPositionSave, POSITION_SAVE_DEBOUNCE_MS);
  };

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPositionSave();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      flushPositionSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProgressChange = (currentPage: number, totalPages: number) => {
    const percentage = Math.round((currentPage / totalPages) * 100);
    setReadingProgress(percentage);
    schedulePositionSave({ lastPageNumber: currentPage });
  };

  const handleEpubLocationChange = (cfi: string) => {
    schedulePositionSave({ lastCfi: cfi });
  };

  const handleSaveProgress = async () => {
    setIsSavingProgress(true);
    try {
      await saveReadingProgress(book.id, readingProgress);
    } catch (error) {
      console.error("Failed to save progress", error);
      toast.error("Failed to save progress.");
    }
    setTimeout(() => setIsSavingProgress(false), 500);
  };

  const handleToggleCompleted = async () => {
    const newStatus = isCompleted ? 'reading' : 'completed';
    const justFinished = !isCompleted;
    setIsCompleted(!isCompleted);
    try {
      await toggleBookStatus(book.id, { status: newStatus });
      if (justFinished) {
        setShowCloseMoment(true);
      } else {
        toast.success("Moved back to Currently Reading.");
      }
    } catch (error) {
      console.error("Failed to update status", error);
      setIsCompleted(isCompleted);
      toast.error("Failed to update status.");
    }
  };

  const handleToggleVaulted = async () => {
    const newValue = !isVaulted;
    setIsVaulted(newValue);
    try {
      await toggleBookStatus(book.id, { is_vaulted: newValue });
      toast.success(newValue ? "Moved to your private vault." : "Removed from vault.");
    } catch (error) {
      console.error("Failed to update vault status", error);
      setIsVaulted(!newValue);
      toast.error("Failed to update.");
    }
  };

  const handleTextSelected = (text: string, pageNum: number) => {
    setActiveExcerpt(text);
    setActivePage(pageNum);
    setIsComposeOpen(true);
    setIsSidebarOpen(true);
  };

  const handleSaveNote = async () => {
    if (!draftComment.trim() && !activeExcerpt.trim()) return;
    setIsSavingNote(true);

    try {
      await saveMarginNote(book.id, activePage, activeExcerpt, draftComment);
      const updatedNotes = await getBookNotes(book.id);
      setNotes(updatedNotes);
      setDraftComment("");
      setActiveExcerpt("");
      setIsComposeOpen(false);
      toast.success("Note saved.");
    } catch (error) {
      console.error("Failed to save note", error);
      toast.error("Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleExportNotes = async () => {
    if (notes.length === 0) return;
    const sections = notes
      .slice()
      .reverse()
      .map((n) => {
        const parts = [`## Page ${n.page_number}`];
        if (n.excerpt) parts.push(`> ${n.excerpt}`);
        if (n.user_comment) parts.push(n.user_comment);
        return parts.join("\n\n");
      });
    const markdown = [`# ${book.title}`, `_${book.author || "Unknown Author"}_`, ...sections].join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Notes copied as Markdown.");
    } catch (error) {
      console.error("Failed to copy notes", error);
      toast.error("Failed to copy notes.");
    }
  };

  useEffect(() => {
    if (isComposeOpen) {
      const id = requestAnimationFrame(() => draftTextareaRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isComposeOpen]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleEscape = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      return;
    }
    router.push("/projects/reader-v2");
  };

  useReaderShortcuts({
    onNextPage: () => { pdfRef.current?.nextPage(); epubRef.current?.nextPage(); },
    onPrevPage: () => { pdfRef.current?.prevPage(); epubRef.current?.prevPage(); },
    onOpenNote: () => { setIsSidebarOpen(true); setIsComposeOpen(true); },
    onToggleFullscreen: handleToggleFullscreen,
    onEscape: handleEscape,
  });

  if (!activeStreamUrl && book.has_digital) {
    return (
      <div className="flex items-center justify-center h-screen transition-colors duration-[3000ms]" style={{ backgroundColor: ambientBackground }}>
        <p className="font-precision text-slate-500">Failed to load secure file stream.</p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col h-screen overflow-hidden relative font-precision transition-colors duration-[3000ms]"
      style={{ backgroundColor: ambientBackground }}
    >

      <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-brass-200/60 flex items-center justify-between px-5 flex-shrink-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-4 z-20 min-w-0">
          <Link href="/projects/reader-v2" className="p-1.5 text-slate-400 hover:text-brass-600 hover:bg-brass-50 rounded-md transition-colors flex-shrink-0">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </Link>
          <div className="border-l border-slate-200 h-7 flex-shrink-0"></div>
          <div className="hidden sm:block min-w-0">
            <h1 className="font-display italic text-lg text-slate-900 truncate max-w-[220px] md:max-w-[340px] leading-tight">{book.title}</h1>
            <p className="font-data text-[9px] text-slate-500 uppercase tracking-widest truncate">{book.author || "Unknown Author"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-20">
          <div className="hidden md:flex items-center gap-2">
            <ReadingGauge progress={readingProgress} size={44} showTicks={false} />
            <button
              onClick={handleSaveProgress}
              disabled={isSavingProgress}
              className="font-data text-[9px] font-bold uppercase tracking-widest px-3 py-2 bg-slate-50 text-slate-500 hover:bg-brass-50 hover:text-brass-700 rounded-md transition-colors disabled:opacity-50"
            >
              {isSavingProgress ? "Saved!" : "Log Progress"}
            </button>
          </div>

          <button
            onClick={handleToggleCompleted}
            title={isCompleted ? "Marked as read — click to undo" : "Mark as read"}
            className={`p-2 rounded-md transition-colors ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <CheckCircle size={18} strokeWidth={2} fill={isCompleted ? "currentColor" : "none"} fillOpacity={0.15} />
          </button>

          <button
            onClick={handleToggleVaulted}
            title={isVaulted ? "In your private vault — click to remove" : "Keep private"}
            className={`p-2 rounded-md transition-colors ${isVaulted ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <Lock size={17} strokeWidth={2} />
          </button>

          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-md transition-colors relative ${isSidebarOpen ? 'bg-brass-50 text-brass-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
            <StickyNote size={18} strokeWidth={2} />
            {notes.length > 0 && !isSidebarOpen && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
            )}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {welcomeBackVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 2.5, times: [0, 0.15, 0.8, 1], ease: "easeInOut" }}
            onAnimationComplete={() => setWelcomeBackVisible(false)}
            className="absolute top-[72px] left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-brass-500 text-white text-xs font-bold font-precision rounded-full shadow-[0_0_20px_rgba(199,154,75,0.5)] pointer-events-none"
          >
            {welcomeBackLabel}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-1 overflow-hidden relative">
        <section className="flex-1 transition-all duration-300 relative bg-[#f0ece2] flex flex-col items-center justify-center overflow-hidden">
          {book.file_type === 'pdf' && activeStreamUrl ? (
            <PdfViewer
              ref={pdfRef}
              url={activeStreamUrl}
              initialProgress={book.reading_progress || 0}
              initialPage={book.last_page_number ?? undefined}
              onProgressChange={handleProgressChange}
              onTextSelected={handleTextSelected}
            />
          ) : book.file_type === 'epub' && activeStreamUrl ? (
            <EpubViewer
              ref={epubRef}
              url={activeStreamUrl}
              initialCfi={book.last_cfi ?? undefined}
              initialTheme={ambientEpubTheme}
              onLocationChange={handleEpubLocationChange}
            />
          ) : (
            <div className="text-center max-w-md px-6 font-precision text-slate-500">Physical Volume Interface</div>
          )}
        </section>

        <div
          className={`md:hidden absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-30 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={() => setIsSidebarOpen(false)}
        />

        <aside
          className={`bg-white border-l border-brass-200/60 transition-all duration-300 ease-in-out flex flex-col absolute md:relative top-0 right-0 h-full z-40
          ${isSidebarOpen ? 'w-full sm:w-96 md:w-80 lg:w-96 translate-x-0 opacity-100 shadow-2xl md:shadow-none' : 'w-full sm:w-96 md:w-0 translate-x-full md:translate-x-0 opacity-0'}`}
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-display italic text-base text-slate-900">Margin Notes</h3>
            <div className="flex items-center gap-3">
              <span className="font-data text-[10px] text-slate-400">{notes.length} NOTES</span>
              {notes.length > 0 && (
                <button
                  onClick={handleExportNotes}
                  title="Copy all notes as Markdown"
                  className="p-1 text-slate-400 hover:text-brass-600 transition-colors"
                >
                  <ClipboardCopy size={15} strokeWidth={2} />
                </button>
              )}
              <button className="md:hidden p-1 text-slate-400" onClick={() => setIsSidebarOpen(false)}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">

            {isComposeOpen && (
              <div className="p-4 bg-brass-50/60 border-b border-brass-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-data text-[10px] font-bold text-brass-700 uppercase tracking-widest">
                    {activeExcerpt ? `Page ${activePage} Extraction` : "New Note"}
                  </span>
                  <button onClick={() => { setActiveExcerpt(""); setIsComposeOpen(false); }} className="text-slate-400 hover:text-slate-700">
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
                {activeExcerpt && (
                  <div className="bg-white p-3 rounded-lg border border-brass-100 shadow-sm mb-3">
                    <p className="text-xs text-slate-600 font-display italic border-l-2 border-brass-300 pl-2 line-clamp-4">"{activeExcerpt}"</p>
                  </div>
                )}
                <textarea
                  ref={draftTextareaRef}
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  placeholder="Add your thoughts or commentary..."
                  className="w-full text-sm font-precision p-3 border border-brass-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-brass-200 bg-white mb-3 min-h-[100px] resize-none"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={isSavingNote || !draftComment.trim()}
                  className="w-full py-2 bg-slate-900 text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-slate-800 transition-colors"
                >
                  {isSavingNote ? "Saving..." : "Save Note"}
                </button>
              </div>
            )}

            <div className="p-4 space-y-4">
              {notes.length === 0 && !isComposeOpen ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center mt-4">
                  <p className="font-precision text-xs font-semibold text-slate-400">No margin notes yet.</p>
                  <p className="font-precision text-[10px] text-slate-400 mt-1">Highlight text (or press "n") to add one.</p>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <span className="font-data text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Page {note.page_number}</span>
                    {note.excerpt && (
                      <p className="text-xs text-slate-500 font-display italic border-l-2 border-slate-300 pl-2 mb-3">"{note.excerpt}"</p>
                    )}
                    <p className="text-sm font-precision text-slate-900 font-medium whitespace-pre-line">{note.user_comment}</p>
                  </div>
                ))
              )}
            </div>

          </div>
        </aside>
      </main>

      <BookCloseMoment
        isOpen={showCloseMoment}
        coverKey={book.cover_key ?? null}
        title={book.title}
        onDismiss={() => setShowCloseMoment(false)}
      />
    </div>
  );
}
