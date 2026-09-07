"use client";

import { Check } from "lucide-react";
import { MAX_GENRES_PER_BOOK, genreLabel } from "@/lib/genre-vocabulary";

interface GenreOption {
  id: string;
  name: string;
}

interface GenreSelectorProps {
  options: GenreOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Plain controlled chip picker for a book's genre(s), same shape as
 * NoteTagSelector's domain tier - a closed curated vocabulary with a
 * server-enforced cap (setBookGenres), this is just the client-side mirror
 * of that cap so the picker itself never lets you exceed it.
 */
export default function GenreSelector({ options, selectedIds, onChange }: GenreSelectorProps) {
  const toggle = (id: string) => {
    const active = selectedIds.includes(id);
    if (active) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      if (selectedIds.length >= MAX_GENRES_PER_BOOK) return;
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selectedIds.includes(opt.id);
        const disabled = !active && selectedIds.length >= MAX_GENRES_PER_BOOK;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            disabled={disabled}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors border ${
              active
                ? "bg-brass-600 border-brass-600 text-white"
                : disabled
                  ? "bg-white border-brass-100 text-slate-300 cursor-not-allowed"
                  : "bg-white border-brass-200 text-slate-600 hover:bg-brass-50"
            }`}
          >
            {active && <Check size={10} strokeWidth={3} />}
            {genreLabel(opt.name)}
          </button>
        );
      })}
    </div>
  );
}
