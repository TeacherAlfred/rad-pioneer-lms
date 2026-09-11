"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, BookOpen, Lock, X, Settings, StickyNote, Inbox, UploadCloud, LayoutGrid, Tag as TagIcon, ScanSearch } from "lucide-react";
import { getLibraryBooks, getAllTags, updateBookTags, toggleBookStatus, applyReviewedMetadata, type BookWithTags } from "../reader/_actions/books";
import { getReaderSettings } from "../reader/_actions/settings";
import { autoScanSingleBook, syncExactOpenLibraryUrl } from "../reader/_actions/metadata";
import { UNCATEGORIZED_GENRE, genreLabel } from "@/lib/genre-vocabulary";
import ReadingGauge from "./_components/reading-gauge";
import ReadingStreak from "./_components/reading-streak";
import ShelfCover from "./_components/shelf-cover";
import AddBooksModal from "./_components/add-books-modal";
import TagEditorModal from "./_components/tag-editor-modal";
import RescanReviewModal from "./_components/rescan-review-modal";
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
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
  const [activeEditTags, setActiveEditTags] = useState<Set<string>>(new Set());
  const [autoSuggestedTags, setAutoSuggestedTags] = useState<{ id: string; name: string }[]>([]);
  const [isSavingTags, setIsSavingTags] = useState(false);

  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [rescanQueueStatus, setRescanQueueStatus] = useState<{ current: number; total: number; etaSeconds: number | null } | null>(null);
  const [rescanReviewQueue, setRescanReviewQueue] = useState<BookWithTags[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(-1);
  const [reviewOptions, setReviewOptions] = useState<any>(null);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewSynopsis, setReviewSynopsis] = useState("");
  const [reviewCoverId, setReviewCoverId] = useState<number | null>(null);
  const [overrideUrl, setOverrideUrl] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);

  const refreshLibrary = () => {
    getLibraryBooks().then((data) => {
      setBooks(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    refreshLibrary();
    getAllTags().then(setAllTags);
  }, []);

  // Load the active review item into editable state whenever the queue
  // position changes, same as v1's rescan review.
  useEffect(() => {
    if (currentReviewIndex >= 0 && rescanReviewQueue[currentReviewIndex]) {
      const book = rescanReviewQueue[currentReviewIndex] as any;
      const meta = book.suggested_metadata || {};

      setReviewOptions(meta);
      setReviewTitle(meta.titles?.[0] || book.title || "");
      setReviewAuthor(meta.authors?.[0] || book.author || "");
      setReviewSynopsis(meta.synopses?.[0] || book.synopsis || "");
      setReviewCoverId(meta.coverIds?.[0] || null);
    }
  }, [currentReviewIndex, rescanReviewQueue]);

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

  const handleOpenTagEditor = () => {
    const targetBooks = books.filter((b) => selectedIds.has(b.id));
    if (targetBooks.length === 0) return;

    const initialTags = new Set<string>();
    if (targetBooks.length === 1) {
      targetBooks[0].tags.forEach((t) => initialTags.add(t.id));
    }
    setActiveEditTags(initialTags);

    const combinedText = targetBooks.map((b) => `${b.title} ${b.synopsis || ""}`).join(" ").toLowerCase();
    const suggestions = allTags.filter((tag) => {
      if (initialTags.has(tag.id)) return false;
      return combinedText.includes(tag.name.toLowerCase().replace(/-/g, " "));
    });

    setAutoSuggestedTags(suggestions);
    setIsTagEditorOpen(true);
  };

  const toggleEditTag = (tagId: string) => {
    setActiveEditTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  // Optimistic, same pattern as handleAddToVault above.
  const handleSaveTags = async () => {
    setIsSavingTags(true);
    const targetIds = Array.from(selectedIds);
    const newTagIds = Array.from(activeEditTags);
    const resolvedTags = allTags.filter((t) => activeEditTags.has(t.id));

    setBooks((prev) => prev.map((b) => (targetIds.includes(b.id) ? { ...b, tags: resolvedTags } : b)));
    setIsTagEditorOpen(false);
    setSelectedIds(new Set());
    toast.success("Collections updated.");

    try {
      await updateBookTags(targetIds, newTagIds);
    } catch (error) {
      console.error("Failed to update tags", error);
      toast.error("Something went wrong — refreshing.");
      getLibraryBooks().then(setBooks);
    } finally {
      setIsSavingTags(false);
    }
  };

  // --- BATCH METADATA RESCAN ---
  const handleBatchRescan = async (targetBooks: BookWithTags[]) => {
    if (targetBooks.length === 0) return;
    setIsBatchScanning(true);
    setRescanQueueStatus({ current: 0, total: targetBooks.length, etaSeconds: null });
    const startedAt = Date.now();

    const scannedQueue: BookWithTags[] = [];
    for (let i = 0; i < targetBooks.length; i++) {
      const book = targetBooks[i];
      const result = await autoScanSingleBook(book.id, book.title || "Unknown Title");
      scannedQueue.push({
        ...book,
        suggested_metadata: (result as any)?.suggested_metadata || (book as any).suggested_metadata,
      });

      const completed = i + 1;
      const remaining = targetBooks.length - completed;
      const avgMsPerBook = (Date.now() - startedAt) / completed;
      setRescanQueueStatus({
        current: completed,
        total: targetBooks.length,
        etaSeconds: remaining > 0 ? Math.round((avgMsPerBook * remaining) / 1000) : 0,
      });
    }

    setRescanReviewQueue(scannedQueue);
    setCurrentReviewIndex(0);
    setIsBatchScanning(false);
    setRescanQueueStatus(null);
    setSelectedIds(new Set());
  };

  const advanceReviewQueue = () => {
    if (currentReviewIndex < rescanReviewQueue.length - 1) {
      setCurrentReviewIndex((prev) => prev + 1);
    } else {
      setRescanReviewQueue([]);
      setCurrentReviewIndex(-1);
    }
  };

  const handleOverrideSync = async () => {
    if (!overrideUrl) return;
    setIsOverriding(true);
    const exactData = await syncExactOpenLibraryUrl(overrideUrl);

    if (exactData) {
      setReviewOptions(exactData);
      setReviewTitle(exactData.titles?.[0] || reviewTitle);
      setReviewAuthor(exactData.authors?.[0] || reviewAuthor);
      setReviewSynopsis(exactData.synopses?.[0] || reviewSynopsis);
      setReviewCoverId(exactData.coverIds?.[0] || null);
      setOverrideUrl("");
    } else {
      toast.error("Could not fetch data. Ensure the URL contains a valid Edition ID (e.g., OL...M).");
    }
    setIsOverriding(false);
  };

  const handleAcceptMetadata = async () => {
    const activeBook = rescanReviewQueue[currentReviewIndex];
    if (!activeBook) return;

    try {
      await applyReviewedMetadata(activeBook.id, reviewTitle, reviewAuthor, reviewSynopsis, reviewCoverId);
      await refreshLibrary();
      advanceReviewQueue();
    } catch (e) {
      console.error("Failed to update book metadata", e);
      toast.error("Failed to save changes.");
    }
  };

  // Vaulted books never appear here, under any state - the /vault route is
  // the only place they're ever shown.
  const readable = useMemo(
    () => books.filter((b) => b.status !== "wip" && !b.is_vaulted),
    [books]
  );

  const wipCount = useMemo(() => books.filter((b) => b.status === "wip").length, [books]);

  // Genre chips: counts real curated genres only, not the 'uncategorized'
  // catch-all - that's a triage state, not something worth browsing by.
  const genreCounts = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const book of readable) {
      for (const tag of book.tags) {
        if (tag.category !== "genre" || tag.name === UNCATEGORIZED_GENRE) continue;
        const existing = counts.get(tag.id);
        if (existing) existing.count++;
        else counts.set(tag.id, { id: tag.id, name: tag.name, count: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [readable]);

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
      .filter((b) => !selectedGenre || b.tags.some((t) => t.id === selectedGenre))
      .sort((a, b) => affinityScore(b, now) - affinityScore(a, now));
  }, [readable, query, continueBook, selectedGenre]);

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
        <div className="flex items-center gap-3">
          {/* Deliberately understated - an exit hatch back to the admin
              project hub, not a nav element competing with the reader
              itself. Near-invisible until you go looking for it. */}
          <Link
            href="/admin/dashboard-v2/projects"
            title="Back to Projects"
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <LayoutGrid size={14} strokeWidth={2} />
          </Link>
          <Link href="/projects/reader-v2" className="font-display italic text-2xl text-slate-900 tracking-tight">
            Meridian
          </Link>
        </div>
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
                      loading="lazy"
                      decoding="async"
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

            <div className="flex items-center justify-between mb-4">
              <p className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Your shelf · {shelf.length} volumes
              </p>
            </div>

            {genreCounts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setSelectedGenre(null)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-precision font-bold transition-colors ${
                    selectedGenre === null
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}
                >
                  All
                </button>
                {genreCounts.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => setSelectedGenre((current) => (current === genre.id ? null : genre.id))}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-precision font-bold transition-colors flex items-center gap-1.5 ${
                      selectedGenre === genre.id
                        ? "bg-brass-600 text-white shadow-sm"
                        : "bg-white border border-brass-200 text-slate-600 hover:border-brass-400 hover:text-slate-900"
                    }`}
                  >
                    {genreLabel(genre.name)}
                    <span className={`font-data font-normal ${selectedGenre === genre.id ? "text-white/70" : "text-slate-400"}`}>
                      {genre.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

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
              <p className="font-precision text-sm text-slate-400 text-center py-16">
                {query
                  ? `No books match "${query}".`
                  : selectedGenre
                    ? `No books in ${genreLabel(genreCounts.find((g) => g.id === selectedGenre)?.name || "")} yet.`
                    : "No books here yet."}
              </p>
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
            <button onClick={handleOpenTagEditor} title="Add to a collection" className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <TagIcon size={15} />
            </button>
            <button
              onClick={() => handleBatchRescan(books.filter((b) => selectedIds.has(b.id)))}
              disabled={isBatchScanning}
              title="Rescan metadata"
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors disabled:opacity-40"
            >
              <ScanSearch size={15} />
            </button>
            <button onClick={handleAddToVault} title="Keep private" className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <Lock size={15} />
            </button>
            <button onClick={() => setSelectedIds(new Set())} title="Clear selection" className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBatchScanning && rescanQueueStatus && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 bg-white border border-brass-200 shadow-2xl rounded-[16px] p-4 w-72"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-data text-[10px] uppercase tracking-widest text-brass-600">Matching Metadata</span>
              <span className="font-data text-[10px] text-slate-400">{rescanQueueStatus.current} / {rescanQueueStatus.total}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
              <motion.div
                className="bg-brass-500 h-full rounded-full"
                animate={{ width: `${(rescanQueueStatus.current / rescanQueueStatus.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="font-precision text-[11px] text-slate-500">
              Waiting to avoid rate limits{rescanQueueStatus.etaSeconds !== null ? ` — about ${rescanQueueStatus.etaSeconds}s remaining` : "…"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AddBooksModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        existingBooks={books}
        onUploaded={refreshLibrary}
      />

      <TagEditorModal
        isOpen={isTagEditorOpen}
        selectedCount={selectedIds.size}
        autoSuggestedTags={autoSuggestedTags}
        tags={allTags}
        activeEditTags={activeEditTags}
        onToggleTag={toggleEditTag}
        isSaving={isSavingTags}
        onSave={handleSaveTags}
        onClose={() => setIsTagEditorOpen(false)}
      />

      <RescanReviewModal
        isOpen={rescanReviewQueue.length > 0 && currentReviewIndex >= 0 && !!reviewOptions}
        currentIndex={currentReviewIndex}
        totalCount={rescanReviewQueue.length}
        activeBook={rescanReviewQueue[currentReviewIndex]}
        reviewOptions={reviewOptions}
        reviewTitle={reviewTitle}
        setReviewTitle={setReviewTitle}
        reviewAuthor={reviewAuthor}
        setReviewAuthor={setReviewAuthor}
        reviewSynopsis={reviewSynopsis}
        setReviewSynopsis={setReviewSynopsis}
        reviewCoverId={reviewCoverId}
        setReviewCoverId={setReviewCoverId}
        overrideUrl={overrideUrl}
        setOverrideUrl={setOverrideUrl}
        isOverriding={isOverriding}
        onOverrideSync={handleOverrideSync}
        onReject={advanceReviewQueue}
        onAccept={handleAcceptMetadata}
      />
    </div>
  );
}
