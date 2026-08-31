"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, BookOpen, Lock, X, Settings, StickyNote, Inbox, UploadCloud } from "lucide-react";
import { getLibraryBooks, toggleBookStatus, type BookWithTags } from "../reader/_actions/books";
import { getReaderSettings } from "../reader/_actions/settings";
import ReadingGauge from "./_components/reading-gauge";
import ReadingStreak from "./_components/reading-streak";
import ShelfCover from "./_components/shelf-cover";
import AddBooksModal from "./_components/add-books-modal";
import { markVaultUnlocked, clearVaultUnlocked } from "./_lib/vault-session";
import { useAmbientBackground } from "./_lib/use-ambient-background";

// Typed anywhere on this page, no visible trigger by design - a visible
// "unlock" affordance would itself give away that a private collection
// exists. Correct entry takes you to a dedicated /vault route; this page
// itself never shows a vaulted book under any circumstance. The PIN itself
// now lives in rad_reader_settings (see Settings), not a hardcoded constant.

/**
 * Ambient personalization: the shelf orders itself around what you actually
 * reach for, not a manual sort control. Recency decays smoothly over ~14
 * days rather than being a hard cutoff, so "touched a few days ago" and
 * "touched today" don't feel like two different tiers - just weighs toward
 * what's live for you right now: in-progress books, favorites, and things
 * you've started but not finished.
 */
function affinityScore(book: BookWithTags, now: number): number {
  let score = 0;

  const lastTouched = new Date(book.last_read_at || book.created_at || 0).getTime();
  const daysSince = Math.max(0, (now - lastTouched) / (1000 * 60 * 60 * 24));
  score += 100 * Math.exp(-daysSince / 14);

  if (book.status === "reading") score += 40;
  if (book.is_vip) score += 25;

  const progress = book.reading_progress || 0;
  if (progress > 0 && progress < 100) score += 15;

  return score;
}

export default function MeridianHome() {
  const router = useRouter();
  const ambientBackground = useAmbientBackground();
  const [books, setBooks] = useState<BookWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const pinBufferRef = useRef("");
  const vaultPinRef = useRef<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const refreshLibrary = () => {
    getLibraryBooks().then((data) => {
      setBooks(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  useEffect(() => {
    getReaderSettings().then((s) => { vaultPinRef.current = s.vaultPin; });
  }, []);

  // Landing here - however you got here - always relocks the vault.
  useEffect(() => {
    clearVaultUnlocked();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!/^\d$/.test(e.key)) return;
      const pin = vaultPinRef.current;
      if (!pin) return; // settings not loaded yet
      pinBufferRef.current = (pinBufferRef.current + e.key).slice(-pin.length);
      if (pinBufferRef.current === pin) {
        pinBufferRef.current = "";
        markVaultUnlocked();
        router.push("/projects/reader-v2/vault");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Optimistic: flip is_vaulted locally right away, reconcile with the
  // server in the background, and pull a fresh copy on any failure rather
  // than trying to hand-roll a rollback for a batch of independent calls.
  const handleAddToVault = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBooks((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, is_vaulted: true } : b)));
    setSelectedIds(new Set());

    try {
      await Promise.all(ids.map((id) => toggleBookStatus(id, { is_vaulted: true })));
      toast.success(`${ids.length} book${ids.length === 1 ? "" : "s"} moved to your private collection.`);
    } catch (error) {
      console.error("Failed to update vault status", error);
      toast.error("Something went wrong — refreshing.");
      getLibraryBooks().then(setBooks);
    }
  };

  // Vaulted books never appear here, under any state - the /vault route is
  // the only place they're ever shown.
  const readable = useMemo(
    () => books.filter((b) => b.status !== "wip" && !b.is_vaulted),
    [books]
  );

  const wipCount = useMemo(() => books.filter((b) => b.status === "wip").length, [books]);

  const continueBook = useMemo(() => {
    return readable
      .filter((b) => b.status === "reading")
      .sort((a, b) => {
        const at = new Date(a.last_read_at || 0).getTime();
        const bt = new Date(b.last_read_at || 0).getTime();
        return bt - at;
      })[0];
  }, [readable]);

  const shelf = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return readable
      .filter((b) => b.id !== continueBook?.id)
      .filter((b) => !q || b.title.toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q))
      .sort((a, b) => affinityScore(b, now) - affinityScore(a, now));
  }, [readable, query, continueBook]);

  const activeReadingDates = useMemo(() => {
    const dates = new Set<string>();
    books.forEach((b) => {
      if (b.last_read_at) dates.add(new Date(b.last_read_at).toISOString().slice(0, 10));
    });
    return dates;
  }, [books]);

  return (
    <div className="min-h-screen transition-colors duration-[3000ms]" style={{ backgroundColor: ambientBackground }}>
      <header className="max-w-5xl mx-auto px-8 pt-10 pb-6 flex items-center justify-between gap-6">
        <Link href="/projects/reader-v2" className="font-display italic text-2xl text-slate-900 tracking-tight">
          Meridian
        </Link>
        <div className="flex items-center gap-4 flex-1 justify-end">
          {!loading && <ReadingStreak activeDates={activeReadingDates} />}
          <div className="flex-1 max-w-sm relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a book..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-precision text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
            />
          </div>
          <button
            onClick={() => setIsUploadOpen(true)}
            title="Add books"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors flex-shrink-0"
          >
            <UploadCloud size={17} strokeWidth={2} />
          </button>
          <Link
            href="/projects/reader-v2/inbox"
            title="Inbox"
            className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors flex-shrink-0"
          >
            <Inbox size={17} strokeWidth={2} />
            {wipCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center bg-brass-500 text-white text-[8px] font-bold rounded-full border border-white">
                {wipCount}
              </span>
            )}
          </Link>
          <Link
            href="/projects/reader-v2/notes"
            title="Notes"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors flex-shrink-0"
          >
            <StickyNote size={17} strokeWidth={2} />
          </Link>
          <Link
            href="/projects/reader-v2/settings"
            title="Settings"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors flex-shrink-0"
          >
            <Settings size={17} strokeWidth={2} />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 pb-24">
        {loading ? (
          <div className="h-72 rounded-[28px] bg-white/60 border border-slate-200 animate-pulse" />
        ) : (
          <>
            {continueBook ? (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative overflow-hidden rounded-[28px] bg-white border border-slate-200 shadow-sm p-8 md:p-10 mb-16 flex flex-col md:flex-row items-center gap-8 md:gap-12"
              >
                <div className="w-32 h-44 md:w-40 md:h-56 flex-shrink-0 rounded-xl overflow-hidden shadow-lg bg-slate-100">
                  {continueBook.cover_key ? (
                    <img
                      src={`/api/storage/cover?key=${encodeURIComponent(continueBook.cover_key)}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <BookOpen size={28} />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center md:text-left min-w-0">
                  <p className="font-data text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-3">
                    Where you left off
                  </p>
                  <h1 className="font-display italic text-3xl md:text-4xl text-slate-900 leading-tight text-wrap-balance mb-2">
                    {continueBook.title}
                  </h1>
                  <p className="font-precision text-sm text-slate-500 mb-8">
                    {continueBook.author || "Unknown Author"}
                  </p>
                  <Link
                    href={`/projects/reader-v2/${continueBook.id}`}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-slate-800 transition-colors"
                  >
                    Continue Reading
                  </Link>
                </div>

                <ReadingGauge progress={continueBook.reading_progress || 0} label="Progress" />
              </motion.section>
            ) : (
              <section className="rounded-[28px] bg-white border border-dashed border-slate-200 p-10 mb-16 text-center">
                <p className="font-display italic text-2xl text-slate-900 mb-2">Nothing in progress yet.</p>
                <p className="font-precision text-sm text-slate-500">Pick something up from the shelf below.</p>
              </section>
            )}

            <div className="flex items-center justify-between mb-6">
              <p className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Your shelf · {shelf.length} volumes
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

            {shelf.length === 0 && (
              <p className="font-precision text-sm text-slate-400 text-center py-16">No books match "{query}".</p>
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
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-full shadow-2xl px-5 py-3 flex items-center gap-4"
          >
            <span className="font-data text-xs">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-white/20" />
            <button onClick={handleAddToVault} title="Keep private" className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <Lock size={15} />
            </button>
            <button onClick={() => setSelectedIds(new Set())} title="Clear selection" className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AddBooksModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        existingBooks={books}
        onUploaded={refreshLibrary}
      />
    </div>
  );
}
