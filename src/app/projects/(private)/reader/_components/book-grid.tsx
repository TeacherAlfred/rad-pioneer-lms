"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import WipCard from "./wip-card";
import type { BookWithTags } from "../_actions/books";

interface BookGridProps {
  books: BookWithTags[];
  groupByAuthor: boolean;
  selectedBooks: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenDetails: (book: BookWithTags) => void;
  onPublishSuccess: () => void;
}

function BookCover({ book, selected, onToggleSelect, onOpenDetails }: {
  book: BookWithTags;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetails: (book: BookWithTags) => void;
}) {
  return (
    <motion.div layout className="relative group">
      <div className={`absolute top-2 left-2 z-30 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelect(book.id); }}
          className={`w-6 h-6 rounded-md border-2 cursor-pointer flex items-center justify-center backdrop-blur-md transition-colors ${selected ? 'bg-amber-600 border-amber-600 text-white' : 'bg-slate-900/40 border-white/70 text-transparent hover:bg-slate-900/60'}`}
        >
          <Check size={14} strokeWidth={3} />
        </div>
      </div>

      <button
        onClick={() => onOpenDetails(book)}
        className="w-full text-left bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col focus:outline-none relative aspect-[2/3]"
      >
        {book.cover_key ? (
          <div className="w-full h-full relative">
            <img
              src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute top-2 right-2 bg-slate-900/75 backdrop-blur-xs text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
              {book.file_type || "Canvas"}
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col justify-between h-full w-full bg-gradient-to-br from-slate-50 to-slate-100 border-t-4 border-slate-800">
            <div>
              <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded tracking-wider uppercase mb-2 inline-block">No Art Assets</span>
              <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-3">{book.title}</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate mt-2">{book.author || "Unknown"}</p>
          </div>
        )}
      </button>
    </motion.div>
  );
}

export default function BookGrid({ books, groupByAuthor, selectedBooks, onToggleSelect, onOpenDetails, onPublishSuccess }: BookGridProps) {
  if (groupByAuthor) {
    const grouped = books.reduce((acc, book) => {
      const author = book.author || "Unknown Author";
      if (!acc[author]) acc[author] = [];
      acc[author].push(book);
      return acc;
    }, {} as Record<string, BookWithTags[]>);

    return (
      <div className="flex flex-col gap-8">
        {Object.entries(grouped).map(([authorName, authorBooks]) => (
          <div key={authorName} className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-xl font-black tracking-tight text-slate-900">{authorName}</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                {authorBooks.length} {authorBooks.length === 1 ? 'Volume' : 'Volumes'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {authorBooks.map((book) => (
                book.status === 'wip' ? (
                  <WipCard
                    key={book.id}
                    book={book}
                    onPublishSuccess={onPublishSuccess}
                    isSelectable={true}
                    isSelected={selectedBooks.has(book.id)}
                    onToggleSelect={onToggleSelect}
                  />
                ) : (
                  <BookCover
                    key={book.id}
                    book={book}
                    selected={selectedBooks.has(book.id)}
                    onToggleSelect={onToggleSelect}
                    onOpenDetails={onOpenDetails}
                  />
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      {books.map((book) => (
        book.status === 'wip' ? (
          <WipCard
            key={book.id}
            book={book}
            onPublishSuccess={onPublishSuccess}
            isSelectable={true}
            isSelected={selectedBooks.has(book.id)}
            onToggleSelect={onToggleSelect}
          />
        ) : (
          <BookCover
            key={book.id}
            book={book}
            selected={selectedBooks.has(book.id)}
            onToggleSelect={onToggleSelect}
            onOpenDetails={onOpenDetails}
          />
        )
      ))}
    </div>
  );
}
