"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import {
  getBooksToVerify,
  getVerificationStats,
  getParkedVerificationBooks,
  reverifyAllBooks,
  type VerifyBook,
  type VerificationStats,
  type VerificationSort,
} from "../../reader/_actions/books";
import VerifyBookPanel from "./verify-book-panel";
import ParkedVerificationRow from "./parked-verification-row";

const SORT_OPTIONS: { id: VerificationSort; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "created_at", label: "Date Added" },
  { id: "author", label: "Author" },
];

/**
 * A subtle, one-at-a-time way to audit the library for missing covers or
 * wrong titles/authors, separate from genre categorization. A book that's
 * been marked verified is excluded from getBooksToVerify going forward, so
 * it never resurfaces unless "Reverify All" is used deliberately.
 */
export default function BookVerificationCard() {
  const [sortBy, setSortBy] = useState<VerificationSort>("title");
  const [queue, setQueue] = useState<VerifyBook[]>([]);
  const [index, setIndex] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(true);

  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [parkedBooks, setParkedBooks] = useState<VerifyBook[]>([]);
  const [showParked, setShowParked] = useState(false);

  const [isReverifyConfirming, setIsReverifyConfirming] = useState(false);
  const [isReverifying, setIsReverifying] = useState(false);

  // Silent by default so a background refresh after one book's action
  // doesn't collapse this whole card to a skeleton and back - only the very
  // first load should show that.
  const refreshStats = (silent = false) => {
    if (!silent) setLoadingStats(true);
    getVerificationStats().then((s) => {
      setStats(s);
      setLoadingStats(false);
    });
  };

  useEffect(() => {
    setLoadingQueue(true);
    getBooksToVerify(sortBy).then((q) => {
      setQueue(q);
      setIndex(0);
      setLoadingQueue(false);
    });
  }, [sortBy]);

  useEffect(() => {
    refreshStats();
    getParkedVerificationBooks().then(setParkedBooks);
  }, []);

  // Removing the current book shifts the next one into the same index, so
  // acting on a book naturally reveals the next without extra advance logic.
  const handleVerified = (bookId: string) => {
    setQueue((prev) => prev.filter((b) => b.id !== bookId));
    refreshStats(true);
  };

  const handleParked = (bookId: string) => {
    setQueue((prev) => {
      const parked = prev.find((b) => b.id === bookId);
      if (parked) setParkedBooks((p) => [...p, parked]);
      return prev.filter((b) => b.id !== bookId);
    });
    refreshStats(true);
  };

  const handleUnparked = (bookId: string) => {
    setParkedBooks((prev) => {
      const unparked = prev.find((b) => b.id === bookId);
      if (unparked) setQueue((q) => [...q, unparked]);
      return prev.filter((b) => b.id !== bookId);
    });
    refreshStats(true);
  };

  const handleReverifyAll = async () => {
    setIsReverifying(true);
    try {
      await reverifyAllBooks();
      toast.success("All verified books moved back into the queue.");
      setIsReverifyConfirming(false);
      const fresh = await getBooksToVerify(sortBy);
      setQueue(fresh);
      setIndex(0);
      refreshStats(true);
    } catch (error) {
      console.error("Failed to reverify all", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset verification.");
    } finally {
      setIsReverifying(false);
    }
  };

  const currentBook = queue[Math.min(index, queue.length - 1)];

  return (
    <section className="bg-white border border-slate-200 rounded-[20px] shadow-sm p-8 mt-6">
      <p className="font-data text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">Library Curation</p>
      <h2 className="font-display italic text-2xl text-slate-900 mb-2">Verify Books</h2>
      <p className="font-precision text-sm text-slate-500 mb-6 leading-relaxed">
        Step through your library one book at a time to confirm it has a cover and the right title/author, rescanning
        Open Library where it doesn't. A verified book won't come up again unless you reverify everything.
      </p>

      {loadingStats || !stats ? (
        <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="font-precision text-sm text-slate-900">
              <span className="font-bold">{stats.verified}</span> of {stats.total} verified
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-data text-[10px] uppercase tracking-widest text-slate-400 mr-0.5">Order</span>
              <div className="flex bg-slate-100 p-0.5 rounded-full">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSortBy(opt.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                      sortBy === opt.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingQueue ? (
            <div className="h-48 bg-slate-50 rounded-xl animate-pulse" />
          ) : !currentBook ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-2xl">
              <ShieldCheck size={28} className="text-emerald-500 mx-auto mb-2" strokeWidth={2} />
              <p className="font-display italic text-lg text-slate-900">All caught up.</p>
              <p className="font-precision text-xs text-slate-400 mt-1">Every book has been verified.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-data text-[10px] uppercase tracking-widest text-slate-400">
                  {index + 1} of {queue.length} remaining
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={index === 0}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
                    disabled={index >= queue.length - 1}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <VerifyBookPanel key={currentBook.id} book={currentBook} onVerified={handleVerified} onParked={handleParked} />
            </div>
          )}

          {parkedBooks.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowParked((v) => !v)}
                className="font-data text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showParked ? "Hide" : "Show"} Parked · {parkedBooks.length}
              </button>
              {showParked && (
                <div className="mt-2">
                  {parkedBooks.map((book) => (
                    <ParkedVerificationRow key={book.id} book={book} onUnparked={handleUnparked} />
                  ))}
                </div>
              )}
            </div>
          )}

          {stats.verified > 0 && (
            <div className="pt-2 border-t border-slate-100">
              {!isReverifyConfirming ? (
                <button
                  onClick={() => setIsReverifyConfirming(true)}
                  className="font-data text-[10px] uppercase tracking-widest text-slate-300 hover:text-rose-500 transition-colors"
                >
                  Reverify All Books
                </button>
              ) : (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="font-precision text-xs text-rose-700 leading-relaxed mb-3">
                    This moves all {stats.verified} verified book{stats.verified === 1 ? "" : "s"} back into the
                    queue to review again. Parked books are left as they are.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsReverifyConfirming(false)}
                      className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReverifyAll}
                      disabled={isReverifying}
                      className="px-4 py-1.5 bg-rose-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-full hover:bg-rose-700 transition-colors disabled:opacity-40"
                    >
                      {isReverifying ? "Resetting…" : "Yes, Reverify All"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
