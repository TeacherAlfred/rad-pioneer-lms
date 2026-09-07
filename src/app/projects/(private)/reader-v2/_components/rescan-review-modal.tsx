"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, Check } from "lucide-react";
import type { BookWithTags } from "../../reader/_actions/books";

interface ReviewOptions {
  titles?: string[];
  authors?: string[];
  synopses?: string[];
  coverIds?: number[];
}

interface RescanReviewModalProps {
  isOpen: boolean;
  currentIndex: number;
  totalCount: number;
  activeBook: BookWithTags | undefined;
  reviewOptions: ReviewOptions | null;
  reviewTitle: string;
  setReviewTitle: (v: string) => void;
  reviewAuthor: string;
  setReviewAuthor: (v: string) => void;
  reviewSynopsis: string;
  setReviewSynopsis: (v: string) => void;
  reviewCoverId: number | null;
  setReviewCoverId: (v: number | null) => void;
  overrideUrl: string;
  setOverrideUrl: (v: string) => void;
  isOverriding: boolean;
  onOverrideSync: () => void;
  onReject: () => void;
  onAccept: () => void;
}

/**
 * v2 reskin of v1's Review Aggregated Metadata modal - same fields/actions
 * (accept writes via applyReviewedMetadata, reject just advances the queue),
 * Meridian-styled. Steps through a batch rescan one book at a time so each
 * match gets a look before it's saved.
 */
export default function RescanReviewModal({
  isOpen, currentIndex, totalCount, activeBook, reviewOptions,
  reviewTitle, setReviewTitle, reviewAuthor, setReviewAuthor, reviewSynopsis, setReviewSynopsis,
  reviewCoverId, setReviewCoverId, overrideUrl, setOverrideUrl, isOverriding, onOverrideSync,
  onReject, onAccept,
}: RescanReviewModalProps) {
  const show = isOpen && !!activeBook && !!reviewOptions;

  return (
    <AnimatePresence>
      {show && activeBook && reviewOptions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[88vh] overflow-hidden"
          >
            <div className="p-6 pb-5 border-b border-slate-100 flex-shrink-0">
              <p className="font-data text-[10px] uppercase tracking-widest text-brass-600 mb-2">
                Step {currentIndex + 1} of {totalCount}
              </p>
              <h2 className="font-display italic text-xl text-slate-900">{activeBook.title}</h2>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-4">
                <motion.div
                  className="bg-brass-500 h-full rounded-full"
                  animate={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-brass-50/60 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brass-400" />
                <input
                  type="text"
                  placeholder="Wrong match? Paste an exact Open Library edition URL..."
                  value={overrideUrl}
                  onChange={(e) => setOverrideUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-precision bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
                />
              </div>
              <button
                onClick={onOverrideSync}
                disabled={isOverriding || !overrideUrl}
                className="px-4 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {isOverriding ? "Syncing…" : "Force Sync"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {reviewOptions.coverIds && reviewOptions.coverIds.length > 0 && (
                <div>
                  <p className="font-data text-[10px] uppercase tracking-widest text-slate-400 mb-3">Cover Art</p>
                  <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1">
                    {reviewOptions.coverIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => setReviewCoverId(id)}
                        className={`relative flex-shrink-0 rounded-xl overflow-hidden aspect-[2/3] w-24 transition-all ${
                          reviewCoverId === id ? "ring-4 ring-brass-400 scale-105" : "ring-1 ring-slate-200 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={`https://covers.openlibrary.org/b/id/${id}-M.jpg`} className="w-full h-full object-cover" />
                        {reviewCoverId === id && (
                          <div className="absolute top-1.5 right-1.5 bg-brass-500 text-white p-0.5 rounded-full">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setReviewCoverId(null)}
                      className={`flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-50 aspect-[2/3] w-24 transition-all ${
                        reviewCoverId === null ? "ring-4 ring-brass-400 scale-105" : "ring-1 ring-slate-200 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <span className="font-data text-[9px] uppercase tracking-widest text-slate-500">No Cover</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div>
                    <label className="font-data text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">Title</label>
                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-precision font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
                    />
                    {reviewOptions.titles && reviewOptions.titles.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {reviewOptions.titles.map((t, i) => (
                          <button
                            key={i}
                            onClick={() => setReviewTitle(t)}
                            className="text-[10px] font-precision font-bold bg-brass-50 text-brass-700 px-2 py-1 rounded-md hover:bg-brass-100 border border-brass-200 transition-colors"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="font-data text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">Author</label>
                    <input
                      type="text"
                      value={reviewAuthor}
                      onChange={(e) => setReviewAuthor(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-precision text-slate-900 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
                    />
                    {reviewOptions.authors && reviewOptions.authors.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {reviewOptions.authors.map((a, i) => (
                          <button
                            key={i}
                            onClick={() => setReviewAuthor(a)}
                            className="text-[10px] font-precision font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-100 border border-emerald-100 transition-colors"
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-1">
                    <p className="font-data text-[9px] uppercase tracking-widest text-slate-300 mb-1.5">Source File</p>
                    <p className="font-data text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2 truncate" title={activeBook.file_key || "No file"}>
                      {activeBook.file_key || "No digital file attached"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="font-data text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">Synopsis</label>
                  <textarea
                    value={reviewSynopsis}
                    onChange={(e) => setReviewSynopsis(e.target.value)}
                    className="w-full flex-1 min-h-[160px] px-3.5 py-3 bg-white border border-slate-200 rounded-lg text-xs font-precision text-slate-600 leading-relaxed focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all resize-none custom-scrollbar"
                  />
                  {reviewOptions.synopses && reviewOptions.synopses.length > 1 && (
                    <div className="mt-2.5 flex flex-col gap-1.5 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                      {reviewOptions.synopses.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setReviewSynopsis(s)}
                          className="text-left text-[11px] font-precision bg-slate-50 hover:bg-slate-100 text-slate-500 p-2 rounded-lg border border-slate-100 transition-colors line-clamp-2"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={onReject}
                className="px-5 py-2.5 border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-widest rounded-full hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={onAccept}
                className="px-5 py-2.5 bg-brass-600 text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-brass-700 transition-colors"
              >
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
