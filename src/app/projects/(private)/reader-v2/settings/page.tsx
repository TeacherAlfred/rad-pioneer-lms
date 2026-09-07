"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Eye, EyeOff, Sparkles, Copy } from "lucide-react";
import { getReaderSettings, updateVaultPin } from "../../reader/_actions/settings";
import {
  getGenreCategorizationStats,
  getGenreReviewQueue,
  getGenreOptions,
  getBooksToCategorize,
  categorizeOneBook,
  getParkedBooks,
  getDuplicateGroups,
  markBookForDeletion,
  type GenreCategorizationStats,
  type GenreReviewBook,
  type BookWithTags,
} from "../../reader/_actions/books";
import { useAmbientBackground } from "../_lib/use-ambient-background";
import GenreReviewRow from "../_components/genre-review-row";
import ParkedBookRow from "../_components/parked-book-row";
import DuplicateFinderModal from "../_components/duplicate-finder-modal";
import BookVerificationCard from "../_components/book-verification-card";

export default function SettingsPage() {
  const ambientBackground = useAmbientBackground();
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPinExpanded, setIsPinExpanded] = useState(false);

  const [stats, setStats] = useState<GenreCategorizationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [batchSize, setBatchSize] = useState(25);
  const [categorizeProgress, setCategorizeProgress] = useState<{ current: number; total: number; title: string } | null>(null);

  const [reviewQueue, setReviewQueue] = useState<GenreReviewBook[]>([]);
  const [genreOptions, setGenreOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);

  const [parkedBooks, setParkedBooks] = useState<GenreReviewBook[]>([]);
  const [showParked, setShowParked] = useState(false);

  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false);
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<BookWithTags[][]>([]);

  // `silent` skips the loading flag so a background refresh (after saving
  // one row, or finishing a batch) doesn't collapse the whole card - incl.
  // the Needs Review list still on screen - down to a skeleton and back.
  // Only the very first load should show that skeleton.
  const refreshStats = (silent = false) => {
    if (!silent) setLoadingStats(true);
    getGenreCategorizationStats().then((s) => {
      setStats(s);
      setLoadingStats(false);
    });
  };

  const refreshQueue = (silent = false) => {
    if (!silent) setLoadingQueue(true);
    getGenreReviewQueue().then((q) => {
      setReviewQueue(q);
      setLoadingQueue(false);
    });
  };

  useEffect(() => {
    getReaderSettings().then((s) => {
      setCurrentPin(s.vaultPin);
      setLoading(false);
    });
    getGenreOptions().then(setGenreOptions);
    refreshStats();
    refreshQueue();
    getParkedBooks().then(setParkedBooks);
  }, []);

  const handleBookSaved = (bookId: string) => {
    setReviewQueue((prev) => prev.filter((b) => b.id !== bookId));
    refreshStats(true);
  };

  const handleBookParked = (bookId: string) => {
    setReviewQueue((prev) => {
      const parked = prev.find((b) => b.id === bookId);
      if (parked) setParkedBooks((p) => [...p, { ...parked, categorization_status: "parked" }]);
      return prev.filter((b) => b.id !== bookId);
    });
  };

  const handleBookUnparked = (bookId: string) => {
    setParkedBooks((prev) => {
      const unparked = prev.find((b) => b.id === bookId);
      if (unparked) setReviewQueue((q) => [...q, { ...unparked, categorization_status: "needs_review" }]);
      return prev.filter((b) => b.id !== bookId);
    });
  };

  const handleOpenDuplicates = async () => {
    setIsDuplicatesOpen(true);
    setIsScanningDuplicates(true);
    try {
      const groups = await getDuplicateGroups();
      setDuplicateGroups(groups);
    } catch (error) {
      console.error("Failed to scan duplicates", error);
      toast.error("Failed to scan for duplicates.");
    }
    setIsScanningDuplicates(false);
  };

  const handleDeleteDuplicate = async (id: string, groupIndex: number) => {
    try {
      await markBookForDeletion(id);
      setDuplicateGroups((prev) => {
        const next = [...prev];
        next[groupIndex] = next[groupIndex].filter((b) => b.id !== id);
        if (next[groupIndex].length <= 1) next.splice(groupIndex, 1);
        return next;
      });
      toast.success("Copy deleted.");
    } catch (error) {
      console.error("Failed to delete duplicate", error);
      toast.error("Failed to delete that copy.");
    }
  };

  // Client-driven, one book per call: each round-trip stays fast (no long-
  // held serverless request for a 50-100 book batch), and it gives real
  // progress to show as each book actually finishes, rather than one opaque
  // wait for the whole batch.
  const handleCategorize = async () => {
    setIsCategorizing(true);
    try {
      const targets = await getBooksToCategorize(batchSize);
      if (targets.length === 0) {
        toast.success("Every book is already categorized.");
        return;
      }

      setCategorizeProgress({ current: 0, total: targets.length, title: targets[0].title });
      let needsReview = 0;
      let failed = 0;

      for (let i = 0; i < targets.length; i++) {
        const book = targets[i];
        setCategorizeProgress({ current: i, total: targets.length, title: book.title });

        const result = await categorizeOneBook(book.id, book.title, book.author);
        if (result.categorization_status === "needs_review") needsReview++;
        if (result.categorization_status === "failed") failed++;

        setCategorizeProgress({ current: i + 1, total: targets.length, title: book.title });
        if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 1500));
      }

      toast.success(
        `Categorized ${targets.length} book${targets.length === 1 ? "" : "s"}` +
        (needsReview || failed ? ` — ${needsReview} need review, ${failed} failed.` : ".")
      );
      refreshStats(true);
      refreshQueue(true);
    } catch (error) {
      console.error("Failed to categorize genres", error);
      toast.error(error instanceof Error ? error.message : "Failed to categorize genres.");
    } finally {
      setIsCategorizing(false);
      setCategorizeProgress(null);
    }
  };

  const handleSave = async () => {
    if (!/^\d{4,10}$/.test(newPin)) {
      toast.error("PIN must be 4-10 digits.");
      return;
    }
    setIsSaving(true);
    try {
      await updateVaultPin(newPin);
      setCurrentPin(newPin);
      setNewPin("");
      toast.success("PIN updated.");
    } catch (error) {
      console.error("Failed to update PIN", error);
      toast.error(error instanceof Error ? error.message : "Failed to update PIN.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-[3000ms]" style={{ backgroundColor: ambientBackground }}>
      <header className="max-w-2xl mx-auto px-8 pt-10 pb-6 flex items-center gap-4">
        <Link href="/projects/reader-v2" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </Link>
        <span className="font-display italic text-2xl text-slate-900 tracking-tight">Settings</span>
      </header>

      <main className="max-w-2xl mx-auto px-8 pb-24">
        <section className="bg-white border border-slate-200 rounded-[20px] shadow-sm p-8">
          <button
            onClick={() => setIsPinExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-4 text-left"
          >
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">Private Collection</p>
              <h2 className="font-display italic text-2xl text-slate-900">Vault PIN</h2>
            </div>
            <ChevronDown
              size={18}
              className={`text-slate-400 flex-shrink-0 transition-transform ${isPinExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {isPinExpanded && (
            <>
              <p className="font-precision text-sm text-slate-500 mt-2 mb-8 leading-relaxed">
                The digit sequence you type anywhere on the library home to open your private collection. Shared
                between this reader and the original dashboard — changing it here updates both.
              </p>

              {loading ? (
                <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="font-data text-[10px] uppercase tracking-widest text-slate-400 block mb-2">
                      Current PIN
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="font-precision text-lg text-slate-900 tracking-[0.3em] bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex-1">
                        {revealed ? currentPin : "•".repeat(currentPin.length)}
                      </span>
                      <button
                        onClick={() => setRevealed((v) => !v)}
                        className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title={revealed ? "Hide" : "Reveal"}
                      >
                        {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-data text-[10px] uppercase tracking-widest text-slate-400 block mb-2">
                      New PIN
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="4-10 digits"
                      className="w-full font-precision text-lg tracking-[0.3em] bg-white border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={isSaving || newPin.length < 4}
                    className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    {isSaving ? "Saving..." : "Save PIN"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-[20px] shadow-sm p-8 mt-6">
          <p className="font-data text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">Library Curation</p>
          <h2 className="font-display italic text-2xl text-slate-900 mb-2">Genre Categorization</h2>
          <p className="font-precision text-sm text-slate-500 mb-8 leading-relaxed">
            Matches each book against Open Library's subject data and sorts it onto a curated shelf genre. Runs one
            book at a time to stay polite to Open Library's API, with live progress as it goes.
          </p>

          {loadingStats || !stats ? (
            <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-data text-[10px] uppercase tracking-widest text-slate-400">Progress</span>
                  <span className="font-precision text-sm text-slate-900">
                    <span className="font-bold">{stats.success}</span> of {stats.total} categorized
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brass-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.success / stats.total) * 100 : 0}%` }}
                  />
                </div>
                {(stats.needsReview > 0 || stats.failed > 0) && (
                  <p className="font-precision text-xs text-slate-400 mt-2">
                    {stats.needsReview > 0 && `${stats.needsReview} need review`}
                    {stats.needsReview > 0 && stats.failed > 0 && " · "}
                    {stats.failed > 0 && `${stats.failed} failed`}
                  </p>
                )}
              </div>

              {isCategorizing && categorizeProgress ? (
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="font-data text-[10px] uppercase tracking-widest text-brass-600">Categorizing…</span>
                    <span className="font-data text-[10px] text-slate-400">
                      {categorizeProgress.current} / {categorizeProgress.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-brass-500 rounded-full transition-all duration-300"
                      style={{ width: `${(categorizeProgress.current / categorizeProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="font-precision text-xs text-slate-400 truncate">{categorizeProgress.title}</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleCategorize}
                    disabled={stats.pending + stats.failed === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    <Sparkles size={14} strokeWidth={2.5} />
                    {stats.pending + stats.failed === 0 ? "All caught up" : "Categorize"}
                  </button>

                  {stats.pending + stats.failed > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-data text-[10px] uppercase tracking-widest text-slate-400 mr-0.5">Batch</span>
                      <div className="flex bg-slate-100 p-0.5 rounded-full">
                        {[25, 50, 100].map((n) => (
                          <button
                            key={n}
                            onClick={() => setBatchSize(n)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                              batchSize === n ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!loadingQueue && reviewQueue.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="font-data text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                    Needs Review · {reviewQueue.length}
                  </p>
                  <p className="font-precision text-xs text-slate-400 mb-2 leading-relaxed">
                    Open Library couldn't confidently place these — pick from the same curated list by hand.
                  </p>
                  <div>
                    {reviewQueue.map((book) => (
                      <GenreReviewRow
                        key={book.id}
                        book={book}
                        genreOptions={genreOptions}
                        onSaved={handleBookSaved}
                        onParked={handleBookParked}
                      />
                    ))}
                  </div>
                </div>
              )}

              {parkedBooks.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setShowParked((v) => !v)}
                    className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <ChevronDown size={12} className={`transition-transform ${showParked ? "rotate-180" : ""}`} />
                    {showParked ? "Hide" : "Show"} Parked · {parkedBooks.length}
                  </button>
                  {showParked && (
                    <div className="mt-2">
                      {parkedBooks.map((book) => (
                        <ParkedBookRow key={book.id} book={book} onUnparked={handleBookUnparked} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <BookVerificationCard />

        <section className="bg-white border border-slate-200 rounded-[20px] shadow-sm p-8 mt-6">
          <p className="font-data text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">Library Curation</p>
          <h2 className="font-display italic text-2xl text-slate-900 mb-2">Duplicate Volumes</h2>
          <p className="font-precision text-sm text-slate-500 mb-6 leading-relaxed">
            Scans for books with matching title/author pairs — the same record uploaded twice, or the same file
            saved under a slightly different name.
          </p>

          <button
            onClick={handleOpenDuplicates}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-slate-800 transition-colors"
          >
            <Copy size={14} strokeWidth={2.5} />
            Find Duplicates
          </button>
        </section>

        <p className="font-precision text-xs text-slate-400 text-center mt-8">
          More settings will land here over time.
        </p>
      </main>

      <DuplicateFinderModal
        isOpen={isDuplicatesOpen}
        isScanning={isScanningDuplicates}
        groups={duplicateGroups}
        onClose={() => setIsDuplicatesOpen(false)}
        onDeleteDuplicate={handleDeleteDuplicate}
      />
    </div>
  );
}
