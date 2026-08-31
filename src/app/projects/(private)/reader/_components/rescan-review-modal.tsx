"use client";

import { Search, Check } from "lucide-react";
import type { BookWithTags } from "../_actions/books";

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

export default function RescanReviewModal({
  isOpen, currentIndex, totalCount, activeBook, reviewOptions,
  reviewTitle, setReviewTitle, reviewAuthor, setReviewAuthor, reviewSynopsis, setReviewSynopsis,
  reviewCoverId, setReviewCoverId, overrideUrl, setOverrideUrl, isOverriding, onOverrideSync,
  onReject, onAccept,
}: RescanReviewModalProps) {
  if (!isOpen || !activeBook || !reviewOptions) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl ring-1 ring-black/5 max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">

        <div className="border-b border-slate-100 p-6 bg-slate-50 flex-shrink-0">
          <h3 className="text-xl font-black tracking-tight text-slate-900">Review Aggregated Metadata</h3>
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-2">
            Step {currentIndex + 1} of {totalCount}: Review matched metadata
          </p>
          <p className="text-sm text-slate-500 mt-1">
            <span className="text-slate-900 font-semibold">{activeBook.title}</span>
          </p>
          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-3">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-amber-50/50 p-4 border-b border-slate-100 flex items-center gap-3 shadow-inner flex-shrink-0">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-2.5 text-amber-400" />
            <input
              type="text"
              placeholder="Incorrect data? Paste an exact Open Library URL here (e.g., https://openlibrary.org/books/OL1234M...)"
              value={overrideUrl}
              onChange={e => setOverrideUrl(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={onOverrideSync}
            disabled={isOverriding || !overrideUrl}
            className="px-5 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 whitespace-nowrap hover:bg-amber-500 transition-colors"
          >
            {isOverriding ? "Syncing URL..." : "Force Sync"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

          {reviewOptions.coverIds && reviewOptions.coverIds.length > 0 && (
            <div>
              <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Select Cover Art</label>
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {reviewOptions.coverIds.map((id: number) => (
                  <button
                    key={id}
                    onClick={() => setReviewCoverId(id)}
                    className={`relative flex-shrink-0 transition-all duration-200 rounded-xl overflow-hidden shadow-sm aspect-[2/3] w-32 ${reviewCoverId === id ? 'ring-4 ring-amber-500 scale-105 shadow-md' : 'ring-1 ring-slate-200 hover:ring-slate-300 opacity-70 hover:opacity-100'}`}
                  >
                    <img src={`https://covers.openlibrary.org/b/id/${id}-M.jpg`} alt="Cover Option" className="w-full h-full object-cover" />
                    {reviewCoverId === id && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-white p-1 rounded-full shadow-sm">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => setReviewCoverId(null)}
                  className={`relative flex-shrink-0 flex flex-col items-center justify-center transition-all duration-200 rounded-xl bg-slate-50 aspect-[2/3] w-32 ${reviewCoverId === null ? 'ring-4 ring-amber-500 scale-105 shadow-md' : 'ring-1 ring-slate-200 hover:ring-slate-300 opacity-70 hover:opacity-100'}`}
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No Cover</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Title</label>
                <input type="text" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all" />
                {reviewOptions.titles && reviewOptions.titles.length > 1 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {reviewOptions.titles.map((t: string, i: number) => (
                      <button key={i} onClick={() => setReviewTitle(t)} className="text-[11px] font-medium bg-amber-50 text-amber-700 px-2 py-1 rounded-md hover:bg-amber-100 border border-amber-100 transition-colors">
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Author</label>
                <input type="text" value={reviewAuthor} onChange={e => setReviewAuthor(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all" />

                {reviewOptions.authors && reviewOptions.authors.length > 1 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {reviewOptions.authors.map((a: string, i: number) => (
                      <button key={i} onClick={() => setReviewAuthor(a)} className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-100 border border-emerald-100 transition-colors">
                        {a}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Source File Reference</label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[11px] font-mono text-slate-600 truncate flex-1" title={activeBook.file_key || "No file"}>
                      {activeBook.file_key || "No digital file attached"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col h-full">
              <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Synopsis</label>
              <textarea value={reviewSynopsis} onChange={e => setReviewSynopsis(e.target.value)} className="w-full flex-1 min-h-[200px] px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 leading-relaxed shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 custom-scrollbar resize-none transition-all" />
              {reviewOptions.synopses && reviewOptions.synopses.length > 1 && (
                <div className="mt-3 flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alternate Descriptions Found:</span>
                  {reviewOptions.synopses.map((s: string, i: number) => (
                    <button key={i} onClick={() => setReviewSynopsis(s)} className="text-left text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg border border-slate-200 transition-colors line-clamp-2">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onReject} className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
            Reject Changes
          </button>
          <button onClick={onAccept} className="px-6 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-amber-500 hover:shadow-lg transition-all flex items-center gap-2">
            Save Options to Database
          </button>
        </div>
      </div>
    </div>
  );
}
