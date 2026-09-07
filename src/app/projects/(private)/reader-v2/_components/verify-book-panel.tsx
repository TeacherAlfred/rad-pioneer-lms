"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Link2, X, ScanSearch, Check, BookmarkX } from "lucide-react";
import {
  updateBookBasicInfo,
  applyReviewedMetadata,
  markBookVerified,
  parkBookVerification,
  type VerifyBook,
} from "../../reader/_actions/books";
import { autoScanSingleBook, syncExactOpenLibraryUrl } from "../../reader/_actions/metadata";

interface VerifyBookPanelProps {
  book: VerifyBook;
  onVerified: (bookId: string) => void;
  onParked: (bookId: string) => void;
}

interface Preview {
  titles?: string[];
  authors?: string[];
  synopses?: string[];
  coverIds?: number[];
}

/**
 * Keyed by book.id from the parent (BookVerificationCard) so switching to
 * the next/previous book remounts this fresh, resetting all local edit/
 * rescan state automatically rather than needing manual sync effects.
 */
export default function VerifyBookPanel({ book, onVerified, onParked }: VerifyBookPanelProps) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author || "");
  const [isWorking, setIsWorking] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedCoverId, setSelectedCoverId] = useState<number | null>(null);

  const runAutoRescan = async () => {
    setIsScanning(true);
    try {
      const result = await autoScanSingleBook(book.id, title || book.title);
      const meta = (result as any)?.suggested_metadata;
      if (!meta || meta.scan_status === "failed") {
        toast.error("No match found — try pasting an exact Open Library link instead.");
        setUrlOpen(true);
        return;
      }
      setPreview(meta);
      if (meta.titles?.[0]) setTitle(meta.titles[0]);
      if (meta.authors?.[0]) setAuthor(meta.authors[0]);
      setSelectedCoverId(meta.coverIds?.[0] ?? null);
    } catch (error) {
      console.error("Rescan failed", error);
      toast.error("Rescan failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const runUrlFetch = async () => {
    if (!urlInput.trim()) return;
    setIsScanning(true);
    try {
      const data = await syncExactOpenLibraryUrl(urlInput.trim());
      if (!data) {
        toast.error("Could not fetch that page — make sure it's an exact edition URL (e.g. openlibrary.org/books/OL...M).");
        return;
      }
      setPreview(data);
      if (data.titles?.[0]) setTitle(data.titles[0]);
      if (data.authors?.[0]) setAuthor(data.authors[0]);
      setSelectedCoverId(data.coverIds?.[0] ?? null);
      setUrlInput("");
      setUrlOpen(false);
    } catch (error) {
      console.error("URL fetch failed", error);
      toast.error("Failed to fetch that page.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleMarkVerified = async () => {
    setIsWorking(true);
    try {
      if (preview) {
        await applyReviewedMetadata(book.id, title, author, preview.synopses?.[0] || "", selectedCoverId);
      } else if (title.trim() !== book.title || author.trim() !== (book.author || "")) {
        await updateBookBasicInfo(book.id, title, author);
      }
      await markBookVerified(book.id);
      onVerified(book.id);
    } catch (error) {
      console.error("Failed to verify book", error);
      toast.error(error instanceof Error ? error.message : "Failed to save.");
      setIsWorking(false);
    }
  };

  const handlePark = async () => {
    setIsWorking(true);
    try {
      await parkBookVerification(book.id);
      onParked(book.id);
    } catch (error) {
      console.error("Failed to park book", error);
      toast.error(error instanceof Error ? error.message : "Failed to park.");
      setIsWorking(false);
    }
  };

  const coverUrl = selectedCoverId
    ? `https://covers.openlibrary.org/b/id/${selectedCoverId}-L.jpg`
    : book.cover_key
      ? `/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`
      : null;

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="w-28 h-40 flex-shrink-0 mx-auto md:mx-0 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shadow-sm">
        {coverUrl ? (
          <img src={coverUrl} className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={24} className="text-slate-300" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <label className="font-data text-[9px] uppercase tracking-widest text-slate-400 block mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full font-precision text-base font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
          />
          {preview?.titles && preview.titles.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {preview.titles.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setTitle(t)}
                  className="text-[10px] font-precision font-bold bg-brass-50 text-brass-700 px-2 py-1 rounded-md hover:bg-brass-100 border border-brass-200 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="font-data text-[9px] uppercase tracking-widest text-slate-400 block mb-1">Author</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full font-precision text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
          />
        </div>

        {preview?.coverIds && preview.coverIds.length > 1 && (
          <div>
            <label className="font-data text-[9px] uppercase tracking-widest text-slate-400 block mb-1.5">Cover</label>
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
              {preview.coverIds.map((id) => (
                <button
                  key={id}
                  onClick={() => setSelectedCoverId(id)}
                  className={`flex-shrink-0 rounded-lg overflow-hidden aspect-[2/3] w-14 transition-all ${
                    selectedCoverId === id ? "ring-4 ring-brass-400 scale-105" : "ring-1 ring-slate-200 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={`https://covers.openlibrary.org/b/id/${id}-M.jpg`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!urlOpen ? (
          <button
            onClick={() => setUrlOpen(true)}
            className="flex items-center gap-1 text-[11px] font-precision font-bold text-slate-400 hover:text-brass-600 transition-colors"
          >
            <Link2 size={11} strokeWidth={2.5} />
            Paste an Open Library link instead
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="openlibrary.org/books/OL...M"
              className="flex-1 min-w-0 text-xs font-precision bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
            />
            <button
              onClick={runUrlFetch}
              disabled={isScanning || !urlInput.trim()}
              className="px-3 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              Fetch
            </button>
            <button
              onClick={() => setUrlOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            onClick={handleMarkVerified}
            disabled={isWorking || isScanning || !title.trim()}
            className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <Check size={13} strokeWidth={2.5} />
            {isWorking ? "Saving…" : "Looks Good"}
          </button>
          <button
            onClick={runAutoRescan}
            disabled={isScanning || isWorking}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest rounded-full hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <ScanSearch size={13} strokeWidth={2.5} />
            {isScanning ? "Scanning…" : "Rescan"}
          </button>
          <button
            onClick={handlePark}
            disabled={isWorking || isScanning}
            title="Set aside until you have more information"
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-widest rounded-full hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-40"
          >
            <BookmarkX size={13} strokeWidth={2.5} />
            Park
          </button>
        </div>
      </div>
    </div>
  );
}
