"use client";

import { motion } from "framer-motion";
import { Check, ChevronRight, BookOpen } from "lucide-react";
import type { BookWithTags } from "../_actions/books";

interface BookListProps {
  books: BookWithTags[];
  selectedBooks: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenDetails: (book: BookWithTags) => void;
}

const STATUS_STYLES: Record<string, string> = {
  reading: "bg-amber-50 text-amber-700 border-amber-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  unread: "bg-slate-100 text-slate-500 border-slate-200",
  wip: "bg-purple-50 text-purple-700 border-purple-100",
};

export default function BookList({ books, selectedBooks, onToggleSelect, onOpenDetails }: BookListProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-[20px] shadow-sm overflow-hidden divide-y divide-slate-100">
      {books.map((book) => {
        const isWip = book.status === 'wip';
        const selected = selectedBooks.has(book.id);
        const visibleTags = book.tags.slice(0, 2);
        const extraTags = book.tags.length - visibleTags.length;
        const scanStatus = book.suggested_metadata?.scan_status;

        return (
          <motion.div
            layout
            key={book.id}
            className={`group flex items-center gap-3 px-4 py-2 h-14 transition-colors ${selected ? 'bg-amber-50/60' : 'hover:bg-slate-50'}`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(book.id); }}
              className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 text-transparent hover:border-amber-400'}`}
            >
              <Check size={12} strokeWidth={3} />
            </button>

            <div className="w-9 h-12 flex-shrink-0 rounded-md overflow-hidden border border-slate-200 bg-slate-100">
              {book.cover_key ? (
                <img src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <BookOpen size={14} />
                </div>
              )}
            </div>

            <button
              onClick={() => !isWip && onOpenDetails(book)}
              disabled={isWip}
              className="flex-1 min-w-0 text-left disabled:cursor-default"
            >
              <p className="text-sm font-bold text-slate-900 truncate">{book.title}</p>
              <p className="text-xs text-slate-500 truncate">{book.author || "Unknown Author"}</p>
            </button>

            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
              {visibleTags.map((t) => (
                <span key={t.id} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">#{t.name}</span>
              ))}
              {extraTags > 0 && <span className="text-[10px] font-bold text-slate-400">+{extraTags}</span>}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              {book.has_digital && <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">Digital</span>}
              {book.has_physical && <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">Physical</span>}
            </div>

            <span className={`hidden lg:inline-flex text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_STYLES[book.status] || STATUS_STYLES.unread}`}>
              {isWip ? (scanStatus === 'success' ? 'Ready' : 'Unmatched') : book.status}
            </span>

            <span className="hidden xl:inline text-[10px] font-mono text-slate-400 flex-shrink-0 w-20 text-right">
              {new Date(book.created_at).toLocaleDateString()}
            </span>

            {!isWip && (
              <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
