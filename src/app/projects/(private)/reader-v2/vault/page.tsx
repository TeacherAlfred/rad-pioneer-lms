"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Search, BookOpen, LockOpen, X } from "lucide-react";
import { getLibraryBooks, toggleBookStatus, type BookWithTags } from "../../reader/_actions/books";
import ReadingGauge from "../_components/reading-gauge";
import ShelfCover from "../_components/shelf-cover";
import { isVaultUnlocked } from "../_lib/vault-session";

export default function VaultPage() {
  const router = useRouter();
  const [access, setAccess] = useState<"pending" | "granted">("pending");
  const [books, setBooks] = useState<BookWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // No PIN, no content, ever - even for a frame. Landing here directly
  // (bookmark, typed URL, browser history) without the session flag set by
  // the home page's PIN check bounces straight back out.
  useEffect(() => {
    if (isVaultUnlocked()) {
      setAccess("granted");
    } else {
      router.replace("/projects/reader-v2");
    }
  }, [router]);

  useEffect(() => {
    if (access !== "granted") return;
    getLibraryBooks().then((data) => {
      setBooks(data);
      setLoading(false);
    });
  }, [access]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRemoveFromVault = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBooks((prev) => prev.filter((b) => !ids.includes(b.id)));
    setSelectedIds(new Set());

    try {
      await Promise.all(ids.map((id) => toggleBookStatus(id, { is_vaulted: false })));
      toast.success(`${ids.length} book${ids.length === 1 ? "" : "s"} restored to your library.`);
    } catch (error) {
      console.error("Failed to update vault status", error);
      toast.error("Something went wrong — refreshing.");
      getLibraryBooks().then((data) => setBooks(data.filter((b) => b.is_vaulted)));
    }
  };

  const vaulted = useMemo(() => books.filter((b) => b.is_vaulted && b.status !== "wip"), [books]);

  const continueBook = useMemo(() => {
    return vaulted
      .filter((b) => b.status === "reading")
      .sort((a, b) => new Date(b.last_read_at || 0).getTime() - new Date(a.last_read_at || 0).getTime())[0];
  }, [vaulted]);

  const shelf = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vaulted
      .filter((b) => b.id !== continueBook?.id)
      .filter((b) => !q || b.title.toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q));
  }, [vaulted, query, continueBook]);

  if (access !== "granted") {
    return <div className="min-h-screen bg-[#faf7f1]" />;
  }

  return (
    <div className="min-h-screen bg-[#0f1115]">
      <header className="max-w-5xl mx-auto px-8 pt-10 pb-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link href="/projects/reader-v2" className="p-1.5 text-white/40 hover:text-white/80 transition-colors">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="font-display italic text-2xl text-white/90 tracking-tight">Private Collection</span>
        </div>
        <div className="flex-1 max-w-sm relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a book..."
            className="w-full pl-10 pr-4 py-2 bg-white/[0.06] border border-white/10 rounded-full text-sm font-precision text-white shadow-sm focus:outline-none focus:ring-4 focus:ring-brass-500/20 focus:border-brass-500/50 transition-all placeholder:text-white/30"
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 pb-24">
        {loading ? (
          <div className="h-72 rounded-[28px] bg-white/[0.04] border border-white/10 animate-pulse" />
        ) : vaulted.length === 0 ? (
          <section className="rounded-[28px] bg-white/[0.03] border border-dashed border-white/10 p-10 mt-6 text-center">
            <p className="font-display italic text-2xl text-white/80 mb-2">Nothing here yet.</p>
            <p className="font-precision text-sm text-white/40">Select books from your library and keep them here.</p>
          </section>
        ) : (
          <>
            {continueBook && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative overflow-hidden rounded-[28px] bg-white/[0.04] border border-white/10 shadow-sm p-8 md:p-10 mb-16 flex flex-col md:flex-row items-center gap-8 md:gap-12"
              >
                <div className="w-32 h-44 md:w-40 md:h-56 flex-shrink-0 rounded-xl overflow-hidden shadow-lg bg-white/5">
                  {continueBook.cover_key ? (
                    <img
                      src={`/api/storage/cover?key=${encodeURIComponent(continueBook.cover_key)}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <BookOpen size={28} />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center md:text-left min-w-0">
                  <p className="font-data text-[10px] uppercase tracking-[0.2em] text-brass-400 mb-3">
                    Where you left off
                  </p>
                  <h1 className="font-display italic text-3xl md:text-4xl text-white leading-tight text-wrap-balance mb-2">
                    {continueBook.title}
                  </h1>
                  <p className="font-precision text-sm text-white/50 mb-8">
                    {continueBook.author || "Unknown Author"}
                  </p>
                  <Link
                    href={`/projects/reader-v2/${continueBook.id}`}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-brass-500 text-slate-900 text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-brass-400 transition-colors"
                  >
                    Continue Reading
                  </Link>
                </div>

                <ReadingGauge progress={continueBook.reading_progress || 0} label="Progress" />
              </motion.section>
            )}

            {shelf.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="font-data text-[10px] uppercase tracking-[0.2em] text-white/30">
                    {shelf.length} {shelf.length === 1 ? "volume" : "volumes"}
                  </p>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-5">
                  {shelf.map((book, i) => (
                    <ShelfCover
                      key={book.id}
                      book={book}
                      index={i}
                      selected={selectedIds.has(book.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              </>
            )}

            {vaulted.length > 0 && shelf.length === 0 && query && (
              <p className="font-precision text-sm text-white/30 text-center py-16">No books match "{query}".</p>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white text-slate-900 rounded-full shadow-2xl px-5 py-3 flex items-center gap-4"
          >
            <span className="font-data text-xs">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-slate-200" />
            <button onClick={handleRemoveFromVault} title="Remove from private collection" className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
              <LockOpen size={15} />
            </button>
            <button onClick={() => setSelectedIds(new Set())} title="Clear selection" className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
