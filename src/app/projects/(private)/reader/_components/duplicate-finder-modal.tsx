"use client";

import { X, Copy, Layers, Check, FileText } from "lucide-react";
import type { BookWithTags } from "../_actions/books";

interface DuplicateFinderModalProps {
  isOpen: boolean;
  isScanning: boolean;
  groups: BookWithTags[][];
  onClose: () => void;
  onDeleteDuplicate: (id: string, groupIndex: number) => void;
  onRescan: (book: BookWithTags) => void;
}

function formatFileSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null) return "Unknown size";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DuplicateFinderModal({ isOpen, isScanning, groups, onClose, onDeleteDuplicate, onRescan }: DuplicateFinderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl ring-1 ring-black/5 max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-100 p-6 bg-slate-50 flex-shrink-0 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-900">Duplicate Volumes Manager</h3>
            <p className="text-sm text-slate-500 mt-1">
              {isScanning ? "Scanning library..." : `Found ${groups.length} groups of identical titles.`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-full border border-slate-200 shadow-sm transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-semibold text-slate-600">Cross-referencing your library...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Your library is perfectly clean.</h3>
              <p className="text-slate-500 mt-1">No duplicate titles were found.</p>
            </div>
          ) : (
            groups.map((group, groupIndex) => {
              const fileKeys = group.map(b => b.file_key).filter(Boolean);
              const uniqueFiles = new Set(fileKeys);
              const isFileDuplicate = uniqueFiles.size > 1;

              return (
                <div key={groupIndex} className="border border-slate-200 rounded-[20px] overflow-hidden shadow-sm">
                  <div className="bg-slate-100 border-b border-slate-200 p-4 flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">{group[0].title}</h4>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group[0].author || "Unknown Author"}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {isFileDuplicate ? (
                        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-sm">
                          <Copy size={12} strokeWidth={3} />
                          Multiple Files in Storage
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-sm">
                          <Layers size={12} strokeWidth={3} />
                          Database Record Duplicate
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex gap-4 overflow-x-auto custom-scrollbar">
                    {group.map((book) => (
                      <div key={book.id} className="flex-shrink-0 w-52 bg-white border border-slate-200 rounded-[16px] overflow-hidden shadow-sm flex flex-col">
                        <div className="h-28 bg-slate-100 flex items-center justify-center overflow-hidden">
                          {book.cover_key ? (
                            <img src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`} className="w-full h-full object-cover" />
                          ) : (
                            <FileText size={24} className="text-slate-300" />
                          )}
                        </div>

                        <div className="p-3 flex flex-col flex-1 gap-2">
                          <span className={`self-start px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-widest ${book.status === 'wip' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {book.status === 'wip' ? 'WIP' : 'Library'}
                          </span>

                          <p className="text-[11px] font-mono text-slate-600 break-all bg-slate-50 p-1.5 rounded" title={book.file_key || "No file"}>
                            {book.file_key || "No digital file attached"}
                          </p>

                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            <span>{formatFileSize(book.fileSizeBytes)}</span>
                            <span>{new Date(book.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="mt-auto flex flex-col gap-1.5 pt-2">
                            {book.status === 'wip' && (
                              <button onClick={() => onRescan(book)} className="w-full px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors">
                                Rescan
                              </button>
                            )}
                            <button onClick={() => onDeleteDuplicate(book.id, groupIndex)} className="w-full px-3 py-1.5 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-50 transition-colors">
                              Delete Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
