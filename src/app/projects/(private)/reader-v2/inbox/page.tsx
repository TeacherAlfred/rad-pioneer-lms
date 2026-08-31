"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { getLibraryBooks, type BookWithTags } from "../../reader/_actions/books";
import { useAmbientBackground } from "../_lib/use-ambient-background";
import AddBooksModal from "../_components/add-books-modal";
import WipReviewCard from "../_components/wip-review-card";

export default function InboxPage() {
  const ambientBackground = useAmbientBackground();
  const [books, setBooks] = useState<BookWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const refresh = () => {
    getLibraryBooks().then((data) => {
      setBooks(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const wipBooks = books.filter((b) => b.status === "wip");

  const handlePublished = (bookId: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  const handleDeleted = (bookId: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  return (
    <div className="min-h-screen transition-colors duration-[3000ms]" style={{ backgroundColor: ambientBackground }}>
      <header className="max-w-3xl mx-auto px-8 pt-10 pb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/projects/reader-v2" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
          <div>
            <span className="font-display italic text-2xl text-slate-900 tracking-tight block leading-tight">Inbox</span>
            <span className="font-data text-[10px] text-slate-400 uppercase tracking-widest">
              {wipBooks.length} awaiting review
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          <UploadCloud size={14} strokeWidth={2.5} />
          Add Books
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-8 pb-24">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-[20px] bg-white/60 border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : wipBooks.length === 0 ? (
          <section className="rounded-[28px] bg-white border border-dashed border-slate-200 p-10 text-center">
            <p className="font-display italic text-2xl text-slate-900 mb-2">Nothing waiting.</p>
            <p className="font-precision text-sm text-slate-500 mb-6">
              Add a PDF or EPUB and it'll show up here for a quick review before it joins your shelf.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-slate-800 transition-colors"
            >
              <UploadCloud size={14} strokeWidth={2.5} />
              Add Books
            </button>
          </section>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {wipBooks.map((book) => (
                <WipReviewCard key={book.id} book={book} onPublished={handlePublished} onDeleted={handleDeleted} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <AddBooksModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        existingBooks={books}
        onUploaded={refresh}
      />
    </div>
  );
}
