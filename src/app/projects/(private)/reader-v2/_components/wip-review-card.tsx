"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, RefreshCw, Search, Link2, BookOpen, Trash2, Check, Loader2 } from "lucide-react";
import { publishWipBook } from "../../reader/_actions/upload";
import { autoScanSingleBook, searchBookOptions, syncExactOpenLibraryUrl } from "../../reader/_actions/metadata";
import { markBookForDeletion, type BookWithTags } from "../../reader/_actions/books";

interface SuggestedMetadata {
  titles?: string[];
  authors?: string[];
  synopses?: string[];
  coverIds?: number[];
  scan_status?: string;
  reason?: string;
}

interface WipReviewCardProps {
  book: BookWithTags;
  onPublished: (bookId: string) => void;
  onDeleted: (bookId: string) => void;
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  success: { label: "Matched", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  needs_review: { label: "Needs a look", className: "bg-amber-50 text-amber-700 border-amber-200" },
  failed: { label: "No match found", className: "bg-rose-50 text-rose-700 border-rose-200" },
  pending: { label: "Scanning…", className: "bg-slate-50 text-slate-500 border-slate-200" },
};

function coverThumb(coverId: number | null) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
}

/**
 * One WIP book's review surface - reuses v1's exact upload/metadata/publish
 * actions, but publishes directly from this card's own reviewed local state
 * rather than re-reading suggested_metadata's singular fields (which v1
 * writes as arrays, never singulars - the source of a real bug in v1's own
 * batch-publish path, where the book title/"Unknown Author" silently wins).
 * One canonical path: whatever's showing in the fields here is exactly what
 * gets published.
 */
export default function WipReviewCard({ book, onPublished, onDeleted }: WipReviewCardProps) {
  const suggested: SuggestedMetadata = (book as any).suggested_metadata || {};
  const scanStatus = suggested.scan_status || "pending";

  const [isExpanded, setIsExpanded] = useState(scanStatus !== "success");
  const [titleOptions, setTitleOptions] = useState<string[]>(suggested.titles || []);
  const [authorOptions, setAuthorOptions] = useState<string[]>(suggested.authors || []);
  const [coverIdOptions, setCoverIdOptions] = useState<number[]>(suggested.coverIds || []);

  const [title, setTitle] = useState(suggested.titles?.[0] || book.title);
  const [author, setAuthor] = useState(suggested.authors?.[0] || "");
  const [synopsis, setSynopsis] = useState(suggested.synopses?.[0] || "");
  const [coverId, setCoverId] = useState<number | null>(suggested.coverIds?.[0] ?? null);

  const [isRescanning, setIsRescanning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [manualQuery, setManualQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [olUrl, setOlUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const status = STATUS_STYLE[scanStatus] || STATUS_STYLE.pending;

  const applyMetadata = (meta: SuggestedMetadata) => {
    setTitleOptions(meta.titles || []);
    setAuthorOptions(meta.authors || []);
    setCoverIdOptions(meta.coverIds || []);
    if (meta.titles?.[0]) setTitle(meta.titles[0]);
    if (meta.authors?.[0]) setAuthor(meta.authors[0]);
    if (meta.synopses?.[0]) setSynopsis(meta.synopses[0]);
    setCoverId(meta.coverIds?.[0] ?? null);
  };

  const handleRescan = async () => {
    setIsRescanning(true);
    try {
      const result = await autoScanSingleBook(book.id, book.title);
      if (result.suggested_metadata) {
        applyMetadata(result.suggested_metadata);
        toast.success("Rescanned.");
      } else {
        toast.error("No match found.");
      }
    } catch (error) {
      console.error("Rescan failed", error);
      toast.error("Rescan failed.");
    } finally {
      setIsRescanning(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchBookOptions(manualQuery.trim());
      if (results.length === 0) {
        toast.error("No results.");
        return;
      }
      setTitleOptions(results.map((r: any) => r.title));
      setAuthorOptions(results.map((r: any) => r.author));
      setCoverIdOptions(results.map((r: any) => r.coverId).filter(Boolean));
      setTitle(results[0].title);
      setAuthor(results[0].author);
      setCoverId(results[0].coverId ?? null);
    } catch (error) {
      console.error("Manual search failed", error);
      toast.error("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleForceSync = async () => {
    if (!olUrl.trim()) return;
    setIsSyncing(true);
    try {
      const result = await syncExactOpenLibraryUrl(olUrl.trim());
      if (!result) {
        toast.error("Couldn't resolve that URL.");
        return;
      }
      applyMetadata(result);
      toast.success("Synced from Open Library.");
      setOlUrl("");
    } catch (error) {
      console.error("Force sync failed", error);
      toast.error("Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !book.file_key) return;
    setIsPublishing(true);
    try {
      const fileExt = book.file_type === "pdf" ? "pdf" : "epub";
      await publishWipBook(book.id, book.file_key, author.trim() || "Unknown Author", title.trim(), fileExt, null, coverId ? String(coverId) : null, synopsis || null);
      toast.success(`Added "${title.trim()}" to your library.`);
      onPublished(book.id);
    } catch (error) {
      console.error("Publish failed", error);
      toast.error("Failed to add to library.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await markBookForDeletion(book.id);
      toast.success("Removed.");
      onDeleted(book.id);
    } catch (error) {
      console.error("Delete failed", error);
      toast.error("Failed to remove.");
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-white border border-slate-200 rounded-[20px] shadow-sm overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-4 text-left"
      >
        <div className="w-10 h-14 rounded bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {coverThumb(coverId) ? (
            <img src={coverThumb(coverId)!} className="w-full h-full object-cover" />
          ) : (
            <BookOpen size={16} className="text-slate-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-precision text-sm font-bold text-slate-900 truncate">{title || book.title}</p>
          <p className="font-data text-[9px] text-slate-400 uppercase tracking-widest truncate">
            {author || "No author matched"}
          </p>
        </div>
        <span className={`font-data text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border flex-shrink-0 ${status.className}`}>
          {status.label}
        </span>
        {isExpanded ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
          {titleOptions.length > 1 && (
            <div>
              <p className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Alternate matches</p>
              <div className="flex flex-wrap gap-1.5">
                {titleOptions.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setTitle(t);
                      if (authorOptions[i]) setAuthor(authorOptions[i]);
                      if (coverIdOptions[i] !== undefined) setCoverId(coverIdOptions[i]);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      t === title ? "bg-brass-600 border-brass-600 text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm font-precision p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400"
              />
            </div>
            <div>
              <label className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Author</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full text-sm font-precision p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400"
              />
            </div>
          </div>

          <div>
            <label className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Synopsis</label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={2}
              className="w-full text-xs font-precision p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 resize-none"
            />
          </div>

          {coverIdOptions.length > 1 && (
            <div>
              <p className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Cover</p>
              <div className="flex gap-2">
                {coverIdOptions.map((id) => (
                  <button
                    key={id}
                    onClick={() => setCoverId(id)}
                    className={`w-10 h-14 rounded overflow-hidden border-2 flex-shrink-0 ${id === coverId ? "border-brass-500" : "border-transparent"}`}
                  >
                    <img src={coverThumb(id)!} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Search size={12} className="text-slate-400 flex-shrink-0" />
              <input
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                placeholder="Search Open Library manually..."
                className="flex-1 min-w-0 text-xs bg-transparent outline-none placeholder:text-slate-400"
              />
              <button onClick={handleManualSearch} disabled={isSearching} className="text-slate-400 hover:text-brass-600 flex-shrink-0">
                {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Link2 size={12} className="text-slate-400 flex-shrink-0" />
              <input
                value={olUrl}
                onChange={(e) => setOlUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleForceSync()}
                placeholder="Paste an exact Open Library edition URL..."
                className="flex-1 min-w-0 text-xs bg-transparent outline-none placeholder:text-slate-400"
              />
              <button onClick={handleForceSync} disabled={isSyncing} className="text-slate-400 hover:text-brass-600 flex-shrink-0">
                {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={handleRescan}
                disabled={isRescanning}
                title="Rescan"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <RefreshCw size={14} className={isRescanning ? "animate-spin" : ""} strokeWidth={2} />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                title="Remove"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
              <span
                title={book.title}
                className="font-data text-[9px] text-slate-400 truncate"
              >
                {book.title}
              </span>
            </div>
            <button
              onClick={handlePublish}
              disabled={isPublishing || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-slate-800 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              {isPublishing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
              Add to Library
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
