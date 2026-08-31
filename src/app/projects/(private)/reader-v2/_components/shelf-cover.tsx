"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { BookWithTags } from "../../reader/_actions/books";

interface ShelfCoverProps {
  book: BookWithTags;
  index: number;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

export default function ShelfCover({ book, index, selected, onToggleSelect }: ShelfCoverProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
    >
      <Link
        href={`/projects/reader-v2/${book.id}`}
        className="group block aspect-[2/3] rounded-lg overflow-hidden bg-slate-100 shadow-sm hover:shadow-md transition-shadow relative"
        title={`${book.title}${book.author ? ` — ${book.author}` : ""}`}
      >
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(book.id); }}
          className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center border transition-opacity ${
            selected
              ? "opacity-100 bg-slate-900 border-slate-900"
              : "opacity-0 group-hover:opacity-100 bg-white/85 border-slate-300 backdrop-blur-sm"
          }`}
        >
          {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        {book.cover_key ? (
          <img
            src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col justify-between p-2 bg-gradient-to-br from-slate-50 to-slate-100">
            <p className="font-display italic text-xs text-slate-700 leading-tight line-clamp-4">{book.title}</p>
          </div>
        )}
      </Link>
    </motion.div>
  );
}
