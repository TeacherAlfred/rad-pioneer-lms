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
  const [activeStreamUrl] = useState(fileUrl);
  
  // Set default to false so mobile users see the book first
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [readingProgress, setReadingProgress] = useState<number>(book.reading_progress || 0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  
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
    setTimeout(() => setIsSavingProgress(false), 500);
  };

  const handleTextSelected = (text: string, pageNum: number) => {
    setActiveExcerpt(text);
    setActivePage(pageNum);
    setIsSidebarOpen(true); // Automatically slides out on highlight
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
      
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-4 z-20">
          <Link href="/projects/reader" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="border-l border-slate-200 h-6"></div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-[200px] md:max-w-[300px]">{book.title}</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{book.author || "Unknown Author"}</p>
          </div>
        </div>

        {/* PROGRESS BAR & SAVE BUTTON */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col md:flex-row items-center gap-2 md:gap-6 z-10 w-[140px] md:w-auto">
          <div className="flex flex-col items-center justify-center w-full md:w-48">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 hidden md:block">{readingProgress}% Complete</span>
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
            className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider px-2 py-1 md:px-3 md:py-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md transition-colors disabled:opacity-50 min-w-[80px] md:min-w-[110px]"
          >
            {isSavingProgress ? "Saved!" : "Log Progress"}
          </button>
        </div>

        <div className="flex items-center gap-4 z-20">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-md transition-colors relative ${isSidebarOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            {notes.length > 0 && !isSidebarOpen && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
            )}
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <section className="flex-1 transition-all duration-300 relative bg-slate-100/50 flex flex-col items-center justify-center overflow-hidden">
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

        {/* Mobile Backdrop Overlay */}
        <div 
          className={`md:hidden absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-30 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={() => setIsSidebarOpen(false)}
        />

        {/* Right Pane: Notes Sidebar (Mobile Absolute Overlay, Desktop Flex Shrink) */}
        <aside 
          className={`bg-white border-l border-slate-200 transition-all duration-300 ease-in-out flex flex-col absolute md:relative top-0 right-0 h-full z-40 
          ${isSidebarOpen ? 'w-full sm:w-96 md:w-80 lg:w-96 translate-x-0 opacity-100 shadow-2xl md:shadow-none' : 'w-full sm:w-96 md:w-0 translate-x-full md:translate-x-0 opacity-0'}`}
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Margin Notes</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">{notes.length} Notes</span>
              <button className="md:hidden p-1 text-slate-400" onClick={() => setIsSidebarOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            
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