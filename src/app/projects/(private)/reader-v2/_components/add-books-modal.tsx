"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, AlertTriangle, Check, Loader2 } from "lucide-react";
import { getPresignedUploadUrl, registerWipBook } from "../../reader/_actions/upload";
import { autoScanSingleBook } from "../../reader/_actions/metadata";
import type { BookWithTags } from "../../reader/_actions/books";

interface AddBooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingBooks: BookWithTags[];
  onUploaded: () => void;
}

interface QueuedFile {
  file: File;
  cleanName: string;
  isDuplicate: boolean;
  willUpload: boolean;
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The upload half of the v1 intake pipeline, reskinned - the actual work
 * (presigned R2 PUT, registering the WIP row, kicking off the Open Library
 * match) is unchanged, reusing the same actions v1 uses. Metadata review and
 * publishing into the library happens separately, on /inbox.
 */
export default function AddBooksModal({ isOpen, onClose, existingBooks, onUploaded }: AddBooksModalProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0, currentFileName: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const newFiles = Array.from(e.target.files).map((file) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const normalizedCleanName = normalize(cleanName);

      const isDuplicate = existingBooks.some(
        (b) =>
          normalize(b.title || "").includes(normalizedCleanName) ||
          normalizedCleanName.includes(normalize(b.title || ""))
      );

      return { file, cleanName, isDuplicate, willUpload: !isDuplicate };
    });

    setQueue((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const toggleUploadStatus = (index: number) => {
    setQueue((prev) => prev.map((q, i) => (i === index ? { ...q, willUpload: !q.willUpload } : q)));
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (isUploading) return;
    setQueue([]);
    onClose();
  };

  const handleUpload = async () => {
    const filesToUpload = queue.filter((q) => q.willUpload);
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadStats({ current: 0, total: filesToUpload.length, currentFileName: "" });

    let completed = 0;
    for (const item of filesToUpload) {
      setUploadStats((prev) => ({ ...prev, currentFileName: item.file.name }));
      try {
        const { uploadUrl, fileKey } = await getPresignedUploadUrl(item.file.name, item.file.type);
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: item.file,
          headers: { "Content-Type": item.file.type },
        });
        if (!uploadResponse.ok) throw new Error(`Failed to upload ${item.file.name}`);

        const newBook = await registerWipBook(item.cleanName, fileKey, item.file.type);
        if (newBook) {
          autoScanSingleBook(newBook.id, newBook.title).catch((err) =>
            console.error("Metadata scan trigger failed:", err)
          );
        }

        completed++;
        setUploadStats((prev) => ({ ...prev, current: completed }));
      } catch (error) {
        console.error(`Upload error for ${item.file.name}:`, error);
      }
    }

    setIsUploading(false);
    setQueue([]);
    onUploaded();
    setTimeout(onClose, 600);
  };

  const duplicatesCount = queue.filter((q) => q.isDuplicate).length;
  const readyCount = queue.filter((q) => q.willUpload).length;

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
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden"
          >
            <div className="p-6 pb-4 flex items-start justify-between border-b border-slate-100">
              <div>
                <h2 className="font-display italic text-xl text-slate-900">Add to your library</h2>
                <p className="font-precision text-sm text-slate-500 mt-1">
                  Select PDFs or EPUBs. Anything that looks like a duplicate is flagged and paused by default.
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={isUploading}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-colors disabled:opacity-40"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {!isUploading && (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-brass-200 rounded-[16px] cursor-pointer bg-brass-50/40 hover:bg-brass-50 transition-colors mb-4">
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud size={20} className="text-brass-500" strokeWidth={2} />
                    <p className="font-precision text-sm font-bold text-slate-600">Click to browse files</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf, application/epub+zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}

              {queue.length > 0 && !isUploading && (
                <>
                  {duplicatesCount > 0 && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-[14px] flex items-start gap-3">
                      <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <div>
                        <p className="font-precision text-sm font-bold text-amber-900">Possible duplicates</p>
                        <p className="font-precision text-xs text-amber-700 mt-0.5">
                          {duplicatesCount} file{duplicatesCount === 1 ? "" : "s"} already look present in your library.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {queue.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-[14px] border transition-colors ${
                          item.isDuplicate
                            ? item.willUpload
                              ? "bg-amber-50/50 border-amber-300"
                              : "bg-slate-50 border-slate-200 opacity-70"
                            : "bg-white border-slate-200 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <button
                            onClick={() => toggleUploadStatus(idx)}
                            className={`w-5 h-5 rounded flex flex-shrink-0 items-center justify-center border transition-colors ${
                              item.willUpload
                                ? "bg-brass-600 border-brass-600 text-white"
                                : "border-slate-300 bg-white text-transparent hover:border-brass-400"
                            }`}
                          >
                            <Check size={11} strokeWidth={3} />
                          </button>
                          <div className="truncate">
                            <span
                              className={`text-sm font-bold truncate block font-precision ${
                                item.willUpload ? "text-slate-900" : "text-slate-500 line-through"
                              }`}
                            >
                              {item.file.name}
                            </span>
                            {item.isDuplicate && (
                              <span
                                className={`text-[9px] font-bold uppercase tracking-widest font-data ${
                                  item.willUpload ? "text-amber-600" : "text-slate-400"
                                }`}
                              >
                                {item.willUpload ? "Uploading anyway" : "Skipping duplicate"}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromQueue(idx)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-2 ml-2 flex-shrink-0"
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isUploading && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Loader2 size={28} className="text-brass-500 animate-spin mb-4" strokeWidth={2} />
                  <p className="font-display italic text-lg text-slate-900">
                    Uploading {uploadStats.current} of {uploadStats.total}
                  </p>
                  <p className="font-precision text-sm text-slate-500 mt-2 max-w-[85%] truncate">
                    {uploadStats.currentFileName}
                  </p>
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-6 overflow-hidden">
                    <div
                      className="bg-brass-500 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${(uploadStats.current / uploadStats.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {!isUploading && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                <span className="font-data text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {readyCount} file{readyCount === 1 ? "" : "s"} ready
                </span>
                <button
                  onClick={handleUpload}
                  disabled={readyCount === 0}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest bg-slate-900 text-white rounded-full shadow-sm hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                >
                  Start Upload
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
