"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Link2, X } from "lucide-react";
import {
  setBookGenres,
  updateBookBasicInfo,
  applyOpenLibraryOverride,
  type GenreReviewBook,
} from "../../reader/_actions/books";
import { syncExactOpenLibraryUrl } from "../../reader/_actions/metadata";
import { mapSubjectsToGenres } from "@/lib/genre-vocabulary";
import GenreSelector from "./genre-selector";

const REASON_LABELS: Record<string, string> = {
  no_ol_candidates: "No match found on Open Library",
  network_error: "Categorization failed — network error",
};

interface GenreReviewRowProps {
  book: GenreReviewBook;
  genreOptions: { id: string; name: string }[];
  onSaved: (bookId: string) => void;
}

interface OverridePreview {
  title: string;
  author: string;
  synopsis: string;
  coverId: number | null;
}

export default function GenreReviewRow({ book, genreOptions, onSaved }: GenreReviewRowProps) {
  const [selected, setSelected] = useState<string[]>(book.genreTagIds);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author || "");

  const [urlOpen, setUrlOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [preview, setPreview] = useState<OverridePreview | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (title.trim() !== book.title || author.trim() !== (book.author || "")) {
        await updateBookBasicInfo(book.id, title, author);
      }
      await setBookGenres(book.id, selected);
      toast.success(`"${title.trim() || book.title}" categorized.`);
      onSaved(book.id);
    } catch (error) {
      console.error("Failed to save book", error);
      toast.error(error instanceof Error ? error.message : "Failed to save.");
      setIsSaving(false);
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetching(true);
    try {
      const data = await syncExactOpenLibraryUrl(urlInput.trim());
      if (!data) {
        toast.error("Could not fetch that page — make sure it's an exact edition URL (e.g. openlibrary.org/books/OL...M).");
        return;
      }

      setPreview({
        title: data.titles?.[0] || title,
        author: data.authors?.[0] || author,
        synopsis: data.synopses?.[0] || "",
        coverId: data.coverIds?.[0] ?? null,
      });

      const suggestedSlugs = mapSubjectsToGenres(data.subjects || []);
      const suggestedIds = suggestedSlugs
        .map((slug) => genreOptions.find((o) => o.name === slug)?.id)
        .filter((id): id is string => !!id);
      if (suggestedIds.length > 0) setSelected(suggestedIds);
    } catch (error) {
      console.error("Failed to fetch Open Library URL", error);
      toast.error("Failed to fetch that page.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleApplyOverride = async () => {
    if (!preview) return;
    setIsSaving(true);
    try {
      await applyOpenLibraryOverride(book.id, {
        title: preview.title,
        author: preview.author,
        synopsis: preview.synopsis,
        coverId: preview.coverId,
        genreTagIds: selected,
      });
      toast.success(`"${preview.title}" updated.`);
      onSaved(book.id);
    } catch (error) {
      console.error("Failed to apply Open Library override", error);
      toast.error(error instanceof Error ? error.message : "Failed to save.");
      setIsSaving(false);
    }
  };

  const cancelUrlFlow = () => {
    setUrlOpen(false);
    setUrlInput("");
    setPreview(null);
    setSelected(book.genreTagIds);
  };

  return (
    <div className="py-4 border-b border-slate-100 last:border-0">
      <div className="flex gap-4">
        <div className="w-11 h-16 flex-shrink-0 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center">
          {preview?.coverId ? (
            <img
              src={`https://covers.openlibrary.org/b/id/${preview.coverId}-M.jpg`}
              className="w-full h-full object-cover"
            />
          ) : book.cover_key ? (
            <img
              src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <BookOpen size={14} className="text-slate-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {urlOpen ? (
            <>
              <p className="font-precision text-sm font-bold text-slate-900 truncate">{title}</p>
              <p className="font-precision text-xs text-slate-400 mb-2 truncate">{author || "Unknown Author"}</p>
            </>
          ) : (
            <div className="mb-2 space-y-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full font-precision text-sm font-bold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-brass-400 focus:bg-white rounded-md px-1.5 py-0.5 -mx-1.5 focus:outline-none focus:ring-4 focus:ring-brass-200 transition-all"
              />
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Unknown Author"
                className="w-full font-precision text-xs text-slate-500 bg-transparent border border-transparent hover:border-slate-200 focus:border-brass-400 focus:bg-white rounded-md px-1.5 py-0.5 -mx-1.5 focus:outline-none focus:ring-4 focus:ring-brass-200 transition-all"
              />
            </div>
          )}
          {book.reason && !urlOpen && (
            <p className="font-data text-[9px] uppercase tracking-widest text-amber-600 mb-2">
              {REASON_LABELS[book.reason] || book.reason}
            </p>
          )}

          {!urlOpen && <GenreSelector options={genreOptions} selectedIds={selected} onChange={setSelected} />}

          {!urlOpen && (
            <button
              onClick={() => setUrlOpen(true)}
              className="flex items-center gap-1 mt-2.5 text-[11px] font-precision font-bold text-slate-400 hover:text-brass-600 transition-colors"
            >
              <Link2 size={11} strokeWidth={2.5} />
              Found it on Open Library?
            </button>
          )}
        </div>

        {!urlOpen && (
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="self-start px-4 py-1.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-full hover:bg-slate-800 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {urlOpen && (
        <div className="mt-4 ml-[60px] bg-brass-50/60 border border-brass-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-data text-[10px] uppercase tracking-widest text-brass-600">Open Library Override</p>
            <button onClick={cancelUrlFlow} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste an exact edition URL (openlibrary.org/books/OL...M)"
              className="flex-1 min-w-0 text-xs font-precision bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
            />
            <button
              onClick={handleFetchUrl}
              disabled={isFetching || !urlInput.trim()}
              className="px-4 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              {isFetching ? "Fetching…" : "Fetch"}
            </button>
          </div>

          {preview && (
            <div className="space-y-3 pt-1">
              <p className="font-precision text-[11px] text-slate-500 leading-relaxed">
                Review before this is saved — nothing's written yet.
              </p>

              <div className="grid grid-cols-[44px_1fr] gap-3">
                <div className="w-11 h-16 rounded-md overflow-hidden bg-slate-100 flex-shrink-0">
                  {preview.coverId && (
                    <img
                      src={`https://covers.openlibrary.org/b/id/${preview.coverId}-M.jpg`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="space-y-2 min-w-0">
                  <input
                    type="text"
                    value={preview.title}
                    onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                    className="w-full text-sm font-precision font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
                  />
                  <input
                    type="text"
                    value={preview.author}
                    onChange={(e) => setPreview({ ...preview, author: e.target.value })}
                    className="w-full text-xs font-precision bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
                  />
                </div>
              </div>

              {preview.synopsis && (
                <textarea
                  value={preview.synopsis}
                  onChange={(e) => setPreview({ ...preview, synopsis: e.target.value })}
                  rows={3}
                  className="w-full text-xs font-precision text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all resize-none"
                />
              )}

              <div>
                <p className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                  Suggested genre — adjust if needed
                </p>
                <GenreSelector options={genreOptions} selectedIds={selected} onChange={setSelected} />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={cancelUrlFlow}
                  className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyOverride}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-brass-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-full hover:bg-brass-700 transition-colors disabled:opacity-40"
                >
                  {isSaving ? "Applying…" : "Apply Update"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
