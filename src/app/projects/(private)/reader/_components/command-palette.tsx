"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Book, Tag, User } from "lucide-react";
import { getCommandPaletteIndex, type CommandPaletteBook } from "../_actions/books";
import { isTypingTarget } from "./use-reader-shortcuts";

const GROUP_HEADING_CLASS =
  "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5";

const ITEM_CLASS =
  "flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-amber-50 data-[selected=true]:text-amber-900";

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<CommandPaletteBook[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Cmd/Ctrl+K always active; "/" only when not typing into a field. Instant
  // local fuzzy match against already-loaded metadata - no debounce needed.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !isTypingTarget(document.activeElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || index !== null || isLoading) return;
    setIsLoading(true);
    getCommandPaletteIndex()
      .then(setIndex)
      .finally(() => setIsLoading(false));
  }, [open, index, isLoading]);

  const { books, authors, tags } = useMemo(() => {
    const list = index || [];
    const tagMap = new Map<string, { id: string; name: string }>();
    const authorSet = new Set<string>();
    list.forEach((b) => {
      b.tags.forEach((t) => tagMap.set(t.id, t));
      if (b.author) authorSet.add(b.author);
    });
    return {
      books: list,
      authors: Array.from(authorSet).sort(),
      tags: Array.from(tagMap.values()),
    };
  }, [index]);

  const goToBook = (id: string) => {
    setOpen(false);
    router.push(`/projects/reader/${id}`);
  };
  const goToAuthor = (author: string) => {
    setOpen(false);
    router.push(`/projects/reader?author=${encodeURIComponent(author)}`);
  };
  const goToTag = (tagId: string) => {
    setOpen(false);
    router.push(`/projects/reader?tag=${tagId}`);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Jump to a book, tag, or author"
      overlayClassName="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
      contentClassName="fixed left-1/2 top-[15vh] -translate-x-1/2 z-[101] w-full max-w-xl px-4"
    >
      <div className="bg-white rounded-[20px] shadow-2xl ring-1 ring-black/5 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={16} className="text-slate-400 flex-shrink-0" />
          <Command.Input
            autoFocus
            placeholder="Jump to a book, tag, or author..."
            className="flex-1 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">ESC</kbd>
        </div>

        <Command.List className="max-h-96 overflow-y-auto custom-scrollbar p-2">
          {isLoading && (
            <div className="py-8 text-center text-xs text-slate-400">Loading library index...</div>
          )}

          {!isLoading && <Command.Empty className="py-8 text-center text-xs text-slate-400">No matches found.</Command.Empty>}

          {!isLoading && books.length > 0 && (
            <Command.Group heading="Books" className={GROUP_HEADING_CLASS}>
              {books.map((book) => (
                <Command.Item
                  key={book.id}
                  value={`${book.title} ${book.author || ""}`}
                  onSelect={() => goToBook(book.id)}
                  className={ITEM_CLASS}
                >
                  <Book size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="flex-1 truncate font-medium text-slate-900">{book.title}</span>
                  {book.author && <span className="text-xs text-slate-400 truncate">{book.author}</span>}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {!isLoading && authors.length > 0 && (
            <Command.Group heading="Authors" className={GROUP_HEADING_CLASS}>
              {authors.map((author) => (
                <Command.Item key={author} value={`author ${author}`} onSelect={() => goToAuthor(author)} className={ITEM_CLASS}>
                  <User size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate font-medium text-slate-900">{author}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {!isLoading && tags.length > 0 && (
            <Command.Group heading="Collections" className={GROUP_HEADING_CLASS}>
              {tags.map((tag) => (
                <Command.Item key={tag.id} value={`tag ${tag.name}`} onSelect={() => goToTag(tag.id)} className={ITEM_CLASS}>
                  <Tag size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate font-medium text-slate-900">#{tag.name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
