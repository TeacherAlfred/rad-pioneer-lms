"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { saveMarginNote, getBookNotes, saveReadingProgress } from "../_actions/notes";

const PdfViewer = dynamic(() => import("./pdf-viewer"), { ssr: false });
const EpubViewer = dynamic(() => import("./epub-viewer"), { ssr: false });

interface ReaderLayoutProps {
  book: any;
  fileUrl: string | null;
}

export default function ReaderLayout({ book, fileUrl }: ReaderLayoutProps) {
  // --- THE FIX: THE STREAM LOCK ---
  // By placing the server's fileUrl into a local useState, we lock the URL on initial load.
  // When Server Actions trigger background UI refreshes, the PDF viewer won't receive a 
  // newly signed AWS/R2 URL, preventing the canvas from unmounting and resetting to page 1.
  const [activeStreamUrl] = useState(fileUrl);
  // --------------------------------

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Progress State
  const [readingProgress, setReadingProgress] = useState<number>(book.reading_progress || 0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  
  // Notes State
  const [notes, setNotes] = useState<any[]>([]);
  const [activeExcerpt, setActiveExcerpt] = useState("");
  const [activePage, setActivePage] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    async function loadNotes() {
      const fetchedNotes = await getBookNotes(book.id);
      setNotes(fetchedNotes);
    }
    loadNotes();
  }, [book.id]);

  const handleProgressChange = (currentPage: number, totalPages: number) => {
    const percentage = Math.round((currentPage / totalPages) * 100);
    setReadingProgress(percentage);
  };

  const handleSaveProgress = async () => {
    setIsSavingProgress(true);
    try {
      await saveReadingProgress(book.id, readingProgress);
    } catch (error) {
      console.error("Failed to save progress", error);
    }
    // Small delay just to give visual feedback that the save completed
    setTimeout(() => setIsSavingProgress(false), 500);
  };

  const handleTextSelected = (text: string, pageNum: number) => {
    setActiveExcerpt(text);
    setActivePage(pageNum);
    setIsSidebarOpen(true); // Auto-open sidebar when text is grabbed
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
    } catch (error) {
      console.error("Failed to save note", error);
    } finally {
      setIsSavingNote(false);
    }
  };

  if (!activeStreamUrl && book.has_digital) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><p className="text-slate-500">Failed to load secure file stream.</p></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative">
      
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/projects/reader" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="border-l border-slate-200 h-6"></div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-[300px]">{book.title}</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{book.author || "Unknown Author"}</p>
          </div>
        </div>

        {/* --- PROGRESS BAR & SAVE BUTTON --- */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center justify-center w-48">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{readingProgress}% Complete</span>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${readingProgress}%` }}
              ></div>
            </div>
          </div>
          <button 
            onClick={handleSaveProgress}
            disabled={isSavingProgress}
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md transition-colors disabled:opacity-50 min-w-[110px]"
          >
            {isSavingProgress ? "Saved!" : "Log Progress"}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-md transition-colors ${isSidebarOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <section className="flex-1 transition-all duration-300 relative bg-slate-100/50 flex flex-col items-center justify-center overflow-hidden">
          {/* Note: We now pass the locked activeStreamUrl instead of the dynamic fileUrl */}
          {book.file_type === 'pdf' && activeStreamUrl ? (
            <PdfViewer 
              url={activeStreamUrl} 
              initialProgress={book.reading_progress || 0}
              onProgressChange={handleProgressChange}
              onTextSelected={handleTextSelected}
            />
          ) : book.file_type === 'epub' && activeStreamUrl ? (
            <EpubViewer url={activeStreamUrl} />
          ) : (
            <div className="text-center max-w-md px-6">Physical Volume Interface</div>
          )}
        </section>

        {/* Right Pane: Notes Sidebar */}
        <aside className={`bg-white border-l border-slate-200 transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'w-80 md:w-96 translate-x-0' : 'w-0 translate-x-full opacity-0'}`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Margin Notes</h3>
            <span className="text-xs font-semibold text-slate-400">{notes.length} Notes</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            
            {/* Draft Note Area */}
            {activeExcerpt && (
              <div className="p-4 bg-indigo-50/50 border-b border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Page {activePage} Extraction</span>
                  <button onClick={() => setActiveExcerpt("")} className="text-slate-400 hover:text-slate-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm mb-3">
                  <p className="text-xs text-slate-600 font-serif italic border-l-2 border-indigo-300 pl-2 line-clamp-4">"{activeExcerpt}"</p>
                </div>
                <textarea 
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  placeholder="Add your thoughts or commentary..."
                  className="w-full text-sm p-3 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white mb-3 min-h-[100px] resize-none"
                />
                <button 
                  onClick={handleSaveNote}
                  disabled={isSavingNote || !draftComment.trim()}
                  className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                >
                  {isSavingNote ? "Saving..." : "Save Note"}
                </button>
              </div>
            )}

            {/* Existing Notes Feed */}
            <div className="p-4 space-y-4">
              {notes.length === 0 && !activeExcerpt ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center mt-4">
                  <p className="text-xs font-semibold text-slate-400">No margin notes yet.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Highlight text in the PDF to extract a quote.</p>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Page {note.page_number}</span>
                    {note.excerpt && (
                      <p className="text-xs text-slate-500 font-serif italic border-l-2 border-slate-300 pl-2 mb-3">"{note.excerpt}"</p>
                    )}
                    <p className="text-sm text-slate-900 font-medium whitespace-pre-line">{note.user_comment}</p>
                  </div>
                ))
              )}
            </div>

          </div>
        </aside>
      </main>
    </div>
  );
}