"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, RotateCcw } from "lucide-react";
import { unparkBookVerification, type VerifyBook } from "../../reader/_actions/books";

interface ParkedVerificationRowProps {
  book: VerifyBook;
  onUnparked: (bookId: string) => void;
}

export default function ParkedVerificationRow({ book, onUnparked }: ParkedVerificationRowProps) {
  const [isUnparking, setIsUnparking] = useState(false);

  const handleUnpark = async () => {
    setIsUnparking(true);
    try {
      await unparkBookVerification(book.id);
      onUnparked(book.id);
    } catch (error) {
      console.error("Failed to unpark book", error);
      toast.error(error instanceof Error ? error.message : "Failed to move back to verification.");
      setIsUnparking(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-8 h-11 flex-shrink-0 rounded overflow-hidden bg-slate-100 flex items-center justify-center">
        {book.cover_key ? (
          <img
            src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <BookOpen size={11} className="text-slate-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-precision text-xs font-bold text-slate-700 truncate">{book.title}</p>
        <p className="font-precision text-[11px] text-slate-400 truncate">{book.author || "Unknown Author"}</p>
      </div>
      <button
        onClick={handleUnpark}
        disabled={isUnparking}
        title="Move back to the verification queue"
        className="flex items-center gap-1 px-3 py-1 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-40 flex-shrink-0"
      >
        <RotateCcw size={10} strokeWidth={2.5} />
        {isUnparking ? "Moving…" : "Review"}
      </button>
    </div>
  );
}
