"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Layers, Check, BookOpen, Loader2 } from "lucide-react";
import type { BookWithTags } from "../../reader/_actions/books";

interface DuplicateFinderModalProps {
  isOpen: boolean;
  isScanning: boolean;
  groups: BookWithTags[][];
  onClose: () => void;
  onDeleteDuplicate: (id: string, groupIndex: number) => void;
}

function formatFileSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null) return "Unknown size";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * v2 reskin of v1's Duplicate Volumes Manager - same underlying data
 * (getDuplicateGroups) and delete action (markBookForDeletion), just
 * Meridian-styled. Deliberately drops v1's inline "Rescan" action: a WIP
 * duplicate's metadata is already handled by the /inbox review flow, so
 * this links there instead of duplicating that UI.
 */
export default function DuplicateFinderModal({ isOpen, isScanning, groups, onClose, onDeleteDuplicate }: DuplicateFinderModalProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleClose = () => {
    setConfirmingId(null);
    onClose();
  };

  const handleConfirmDelete = (id: string, groupIndex: number) => {
    onDeleteDuplicate(id, groupIndex);
    setConfirmingId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden"
          >
            <div className="p-6 pb-4 flex items-start justify-between border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="font-display italic text-xl text-slate-900">Duplicate Volumes</h2>
                <p className="font-precision text-sm text-slate-500 mt-1">
                  {isScanning ? "Cross-referencing your library…" : `${groups.length} group${groups.length === 1 ? "" : "s"} of identical titles.`}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {isScanning ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 size={28} className="text-brass-500 animate-spin mb-4" strokeWidth={2} />
                  <p className="font-precision text-sm text-slate-500">Scanning for matching titles…</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={24} strokeWidth={3} />
                  </div>
                  <p className="font-display italic text-2xl text-slate-900 mb-1">Perfectly clean.</p>
                  <p className="font-precision text-sm text-slate-500">No duplicate titles found.</p>
                </div>
              ) : (
                groups.map((group, groupIndex) => {
                  const fileKeys = group.map((b) => b.file_key).filter(Boolean);
                  const isFileDuplicate = new Set(fileKeys).size > 1;

                  return (
                    <div key={groupIndex} className="border border-slate-200 rounded-[20px] overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-100 px-5 py-3.5 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="font-precision text-sm font-bold text-slate-900 truncate">{group[0].title}</h4>
                          <p className="font-data text-[10px] uppercase tracking-widest text-slate-400 mt-0.5">
                            {group[0].author || "Unknown Author"}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase font-data ${
                            isFileDuplicate ? "bg-amber-100 text-amber-700" : "bg-brass-100 text-brass-700"
                          }`}
                        >
                          {isFileDuplicate ? <Copy size={11} strokeWidth={2.5} /> : <Layers size={11} strokeWidth={2.5} />}
                          {isFileDuplicate ? "Multiple Files" : "Duplicate Record"}
                        </span>
                      </div>

                      <div className="p-4 flex gap-4 overflow-x-auto custom-scrollbar">
                        {group.map((book) => {
                          const isConfirming = confirmingId === book.id;
                          return (
                            <div
                              key={book.id}
                              className="flex-shrink-0 w-48 bg-white border border-slate-200 rounded-[16px] overflow-hidden shadow-sm flex flex-col"
                            >
                              <div className="h-28 bg-slate-100 flex items-center justify-center overflow-hidden">
                                {book.cover_key ? (
                                  <img
                                    src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <BookOpen size={22} className="text-slate-300" />
                                )}
                              </div>

                              <div className="p-3 flex flex-col flex-1 gap-2">
                                <span
                                  className={`self-start px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-widest font-data ${
                                    book.status === "wip" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {book.status === "wip" ? "WIP" : "Library"}
                                </span>

                                <p
                                  className="font-data text-[10px] text-slate-500 break-all bg-slate-50 p-1.5 rounded"
                                  title={book.file_key || "No file"}
                                >
                                  {book.file_key || "No digital file"}
                                </p>

                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wide font-data">
                                  <span>{formatFileSize(book.fileSizeBytes)}</span>
                                  <span>{new Date(book.created_at).toLocaleDateString()}</span>
                                </div>

                                <div className="mt-auto pt-2 flex flex-col gap-1.5">
                                  {book.status === "wip" && (
                                    <Link
                                      href="/projects/reader-v2/inbox"
                                      className="w-full text-center px-3 py-1.5 bg-brass-50 text-brass-700 text-[11px] font-bold rounded-lg hover:bg-brass-100 transition-colors"
                                    >
                                      Review in Inbox
                                    </Link>
                                  )}
                                  {isConfirming ? (
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => handleConfirmDelete(book.id, groupIndex)}
                                        className="flex-1 px-3 py-1.5 bg-rose-600 text-white text-[11px] font-bold rounded-lg hover:bg-rose-700 transition-colors"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setConfirmingId(null)}
                                        className="px-2.5 py-1.5 border border-slate-200 text-slate-500 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                      >
                                        <X size={12} strokeWidth={2.5} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmingId(book.id)}
                                      className="w-full px-3 py-1.5 border border-rose-200 text-rose-600 text-[11px] font-bold rounded-lg hover:bg-rose-50 transition-colors"
                                    >
                                      Delete Copy
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
