"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, BookOpen, ClipboardCopy, Rows3, LayoutList, ChevronDown, ChevronRight, Sparkles, Flame, X } from "lucide-react";
import {
  getAllNotes,
  getNotesGraphData,
  getTagHeatMapData,
  getNoteTagOptions,
  updateNoteTags,
  type NoteWithBook,
  type NotesGraphData,
  type TagHeatEntry,
  type NoteTagOption,
} from "../../reader/_actions/notes";
import { getReaderSettings, setFocusTags } from "../../reader/_actions/settings";
import { useAmbientBackground } from "../_lib/use-ambient-background";
import NotesConstellation from "../_components/notes-constellation";
import NoteTagPicker from "../_components/note-tag-picker";
import TagHeatMap from "../_components/tag-heat-map";

type GroupMode = "flat" | "book" | "constellation" | "tags";

export default function NotesPage() {
  const ambientBackground = useAmbientBackground();
  const [notes, setNotes] = useState<NoteWithBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("flat");
  const [collapsedBooks, setCollapsedBooks] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [allTags, setAllTags] = useState<NoteTagOption[]>([]);
  const [focusTagIds, setFocusTagIdsState] = useState<string[]>([]);

  const [graphData, setGraphData] = useState<NotesGraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  const [heatEntries, setHeatEntries] = useState<TagHeatEntry[] | null>(null);
  const [heatLoading, setHeatLoading] = useState(false);

  useEffect(() => {
    getAllNotes().then((data) => {
      setNotes(data);
      setLoading(false);
    });
    getNoteTagOptions().then(setAllTags);
    getReaderSettings().then((s) => setFocusTagIdsState(s.focusTagIds));
  }, []);

  const openConstellation = () => {
    setGroupMode("constellation");
    if (!graphData && !graphLoading) {
      setGraphLoading(true);
      getNotesGraphData().then((data) => {
        setGraphData(data);
        setGraphLoading(false);
      });
    }
  };

  const openTagsView = () => {
    setGroupMode("tags");
    if (!heatEntries && !heatLoading) {
      setHeatLoading(true);
      getTagHeatMapData().then((data) => {
        setHeatEntries(data);
        setHeatLoading(false);
      });
    }
  };

  const handleSelectTag = (tagId: string) => {
    setTagFilter(tagId);
    setGroupMode("flat");
  };

  const handleToggleFocus = async (tagId: string) => {
    const next = focusTagIds.includes(tagId) ? focusTagIds.filter((id) => id !== tagId) : [...focusTagIds, tagId];
    setFocusTagIdsState(next);
    try {
      await setFocusTags(next);
    } catch (error) {
      console.error("Failed to update focus tags", error);
      setFocusTagIdsState(focusTagIds);
      toast.error("Failed to update focus.");
    }
  };

  const handleSaveNoteTags = async (noteId: string, tagIds: string[]) => {
    const previous = notes.find((n) => n.id === noteId)?.tagIds ?? [];
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, tagIds } : n)));
    try {
      await updateNoteTags(noteId, tagIds);
      // Heat map counts are now stale if they were already loaded - refresh lazily next time it's opened.
      setHeatEntries(null);
      toast.success("Tags updated.");
    } catch (error) {
      console.error("Failed to update note tags", error);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, tagIds: previous } : n)));
      toast.error(error instanceof Error ? error.message : "Failed to update tags.");
    }
  };

  const toggleCollapsed = (bookId: string) => {
    setCollapsedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (tagFilter && !n.tagIds.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        n.excerpt?.toLowerCase().includes(q) ||
        n.userComment?.toLowerCase().includes(q) ||
        n.book.title.toLowerCase().includes(q) ||
        (n.book.author || "").toLowerCase().includes(q)
      );
    });
  }, [notes, query, tagFilter]);

  const grouped = useMemo(() => {
    if (groupMode !== "book") return null;
    const map = new Map<string, { book: NoteWithBook["book"]; notes: NoteWithBook[] }>();
    filtered.forEach((n) => {
      const existing = map.get(n.book.id);
      if (existing) existing.notes.push(n);
      else map.set(n.book.id, { book: n.book, notes: [n] });
    });
    return Array.from(map.values());
  }, [filtered, groupMode]);

  const handleExport = async () => {
    if (filtered.length === 0) return;
    const byBook = new Map<string, { book: NoteWithBook["book"]; notes: NoteWithBook[] }>();
    filtered.forEach((n) => {
      const existing = byBook.get(n.book.id);
      if (existing) existing.notes.push(n);
      else byBook.set(n.book.id, { book: n.book, notes: [n] });
    });

    const sections = Array.from(byBook.values()).map(({ book, notes: bookNotes }) => {
      const noteBlocks = bookNotes.map((n) => {
        const heading = n.pageNumber !== null ? `Page ${n.pageNumber}` : n.chapterTitle || "Highlight";
        const parts = [`### ${heading}`];
        if (n.excerpt) parts.push(`> ${n.excerpt}`);
        if (n.userComment) parts.push(n.userComment);
        return parts.join("\n\n");
      });
      return [`## ${book.title}`, `_${book.author || "Unknown Author"}_`, ...noteBlocks].join("\n\n");
    });

    const markdown = [`# Notes`, ...sections].join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Notes copied as Markdown.");
    } catch (error) {
      console.error("Failed to copy notes", error);
      toast.error("Failed to copy notes.");
    }
  };

  const NoteCard = ({ note, showBook = true }: { note: NoteWithBook; showBook?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-white border border-slate-200 rounded-[16px] p-5 shadow-sm"
    >
      {showBook && (
        <Link href={`/projects/reader-v2/${note.book.id}`} className="flex items-center gap-3 mb-4 group">
          <div className="w-8 h-11 rounded overflow-hidden bg-slate-100 flex-shrink-0">
            {note.book.coverKey ? (
              <img
                src={`/api/storage/cover?key=${encodeURIComponent(note.book.coverKey)}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <BookOpen size={12} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-precision text-sm font-bold text-slate-900 truncate group-hover:text-brass-700 transition-colors">
              {note.book.title}
            </p>
            <p className="font-data text-[9px] text-slate-400 uppercase tracking-widest truncate">
              {note.book.author || "Unknown Author"}
            </p>
          </div>
        </Link>
      )}

      {note.excerpt && (
        <p className="font-display italic text-slate-600 border-l-2 border-brass-300 pl-3 mb-3 leading-snug">
          "{note.excerpt}"
        </p>
      )}
      {note.userComment && (
        <p className="font-precision text-sm text-slate-900 whitespace-pre-line mb-3">{note.userComment}</p>
      )}
      {note.chapterTitle && (
        <p className="font-data text-[9px] text-slate-400 uppercase tracking-widest mb-3 truncate">{note.chapterTitle}</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 font-data text-[9px] text-slate-400 uppercase tracking-widest flex-shrink-0">
          {note.pageNumber !== null && <span>Page {note.pageNumber}</span>}
          {note.createdAt && <span>{new Date(note.createdAt).toLocaleDateString()}</span>}
        </div>
        <NoteTagPicker noteId={note.id} tags={allTags} activeTagIds={note.tagIds} onSave={handleSaveNoteTags} />
      </div>
    </motion.div>
  );

  const containerWidth = groupMode === "constellation" || groupMode === "tags" ? "max-w-5xl" : "max-w-3xl";
  const activeTagName = tagFilter ? allTags.find((t) => t.id === tagFilter)?.name : null;

  return (
    <div className="min-h-screen transition-colors duration-[3000ms]" style={{ backgroundColor: ambientBackground }}>
      <header className={`${containerWidth} mx-auto px-8 pt-10 pb-6 flex items-center justify-between gap-4 transition-[max-width] duration-300`}>
        <div className="flex items-center gap-4">
          <Link href="/projects/reader-v2" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
          <span className="font-display italic text-2xl text-slate-900 tracking-tight">Notes</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-full p-1">
            <button
              onClick={() => setGroupMode("flat")}
              title="Newest first"
              className={`p-1.5 rounded-full transition-colors ${groupMode === "flat" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setGroupMode("book")}
              title="Group by book"
              className={`p-1.5 rounded-full transition-colors ${groupMode === "book" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
            >
              <Rows3 size={14} />
            </button>
            <button
              onClick={openTagsView}
              title="Tag heat map"
              className={`p-1.5 rounded-full transition-colors ${groupMode === "tags" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
            >
              <Flame size={14} />
            </button>
            <button
              onClick={openConstellation}
              title="Constellation view"
              className={`p-1.5 rounded-full transition-colors ${groupMode === "constellation" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
            >
              <Sparkles size={14} />
            </button>
          </div>
          {notes.length > 0 && (
            <button
              onClick={handleExport}
              title="Copy all as Markdown"
              className="p-2 text-slate-400 hover:text-brass-600 hover:bg-white rounded-full transition-colors"
            >
              <ClipboardCopy size={16} />
            </button>
          )}
        </div>
      </header>

      {(groupMode === "flat" || groupMode === "book") && (
        <div className="max-w-3xl mx-auto px-8 mb-8 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your notes..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-precision text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
            />
          </div>
          {tagFilter && (
            <div className="flex items-center gap-2">
              <span className="font-data text-[10px] uppercase tracking-widest text-slate-400">Filtered by</span>
              <button
                onClick={() => setTagFilter(null)}
                className="flex items-center gap-1.5 bg-brass-600 text-white text-xs font-bold px-3 py-1 rounded-full hover:bg-brass-500 transition-colors"
              >
                #{activeTagName}
                <X size={11} strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      )}

      <main className={`${containerWidth} mx-auto px-8 pb-24 transition-[max-width] duration-300`}>
        {groupMode === "tags" ? (
          heatLoading || !heatEntries ? (
            <div className="flex flex-wrap gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 w-24 rounded-full bg-white/60 border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <p className="font-precision text-sm text-slate-500 mb-6 max-w-xl">
                Tag prominence follows how many notes carry it. Pin a tag to bring it to the forefront regardless of
                count — for whatever you're focused on this week or month.
              </p>
              <TagHeatMap
                entries={heatEntries}
                focusTagIds={focusTagIds}
                onSelectTag={handleSelectTag}
                onToggleFocus={handleToggleFocus}
              />
            </>
          )
        ) : groupMode === "constellation" ? (
          graphLoading || !graphData ? (
            <div className="h-[560px] rounded-[20px] bg-white/60 border border-slate-200 animate-pulse" />
          ) : graphData.nodes.length === 0 ? (
            <section className="rounded-[28px] bg-white border border-dashed border-slate-200 p-10 text-center">
              <p className="font-display italic text-2xl text-slate-900 mb-2">No notes yet.</p>
              <p className="font-precision text-sm text-slate-500">Highlight text while reading to add one.</p>
            </section>
          ) : (
            <>
              <p className="font-precision text-sm text-slate-500 mb-6 max-w-xl">
                Notes connected across different books — by shared tag, shared collection, the same author, or
                similar wording. Scroll to zoom, drag the background to pan, click a note to focus it, drag a note to
                reposition it.
              </p>
              <NotesConstellation nodes={graphData.nodes} edges={graphData.edges} />
            </>
          )
        ) : loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-[16px] bg-white/60 border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <section className="rounded-[28px] bg-white border border-dashed border-slate-200 p-10 text-center">
            <p className="font-display italic text-2xl text-slate-900 mb-2">No notes yet.</p>
            <p className="font-precision text-sm text-slate-500">Highlight text while reading to add one.</p>
          </section>
        ) : filtered.length === 0 ? (
          <p className="font-precision text-sm text-slate-400 text-center py-16">No notes match this view.</p>
        ) : groupMode === "flat" ? (
          <div className="space-y-4">
            {filtered.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped!.map(({ book, notes: bookNotes }) => {
              const collapsed = collapsedBooks.has(book.id);
              return (
                <div key={book.id}>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => toggleCollapsed(book.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
                      title={collapsed ? "Expand" : "Collapse"}
                    >
                      {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <Link href={`/projects/reader-v2/${book.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                      <div className="w-8 h-11 rounded overflow-hidden bg-slate-100 flex-shrink-0">
                        {book.coverKey ? (
                          <img src={`/api/storage/cover?key=${encodeURIComponent(book.coverKey)}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <BookOpen size={12} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display italic text-lg text-slate-900 group-hover:text-brass-700 transition-colors truncate">{book.title}</p>
                        <p className="font-data text-[9px] text-slate-400 uppercase tracking-widest">{book.author || "Unknown Author"} · {bookNotes.length} notes</p>
                      </div>
                    </Link>
                  </div>

                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pl-9 pb-1">
                          {bookNotes.map((note) => (
                            <NoteCard key={note.id} note={note} showBook={false} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
