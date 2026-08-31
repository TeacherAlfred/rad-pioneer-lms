"use client";

import { motion } from "framer-motion";
import { Pin, PinOff } from "lucide-react";
import type { TagHeatEntry, NoteTagCategory } from "../../reader/_actions/notes";

interface TagHeatMapProps {
  entries: TagHeatEntry[];
  focusTagIds: string[];
  onSelectTag: (tagId: string) => void;
  onToggleFocus: (tagId: string) => void;
}

function sortEntries(entries: TagHeatEntry[], focusTagIds: string[]) {
  return [...entries].sort((a, b) => {
    const aFocus = focusTagIds.includes(a.id);
    const bFocus = focusTagIds.includes(b.id);
    if (aFocus !== bFocus) return aFocus ? -1 : 1;
    return b.count - a.count;
  });
}

function TagChip({
  entry,
  isFocus,
  maxCount,
  onSelectTag,
  onToggleFocus,
}: {
  entry: TagHeatEntry;
  isFocus: boolean;
  maxCount: number;
  onSelectTag: (tagId: string) => void;
  onToggleFocus: (tagId: string) => void;
}) {
  const intensity = entry.count / maxCount; // 0-1
  const fontSize = 12 + intensity * 12; // 12px - 24px
  const padY = 6 + intensity * 4;
  const padX = 12 + intensity * 6;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`group relative flex items-center gap-2 rounded-full border transition-colors ${
        isFocus
          ? "bg-brass-600 border-brass-600 text-white shadow-md"
          : entry.count === 0
            ? "bg-slate-50 border-slate-200 text-slate-400"
            : "bg-white border-brass-200 text-slate-800 hover:border-brass-400"
      }`}
      style={{ paddingTop: padY, paddingBottom: padY, paddingLeft: padX, paddingRight: padX }}
    >
      <button onClick={() => onSelectTag(entry.id)} className="font-precision font-bold" style={{ fontSize }}>
        #{entry.name}
        <span className={`ml-1.5 font-data font-normal ${isFocus ? "text-white/70" : "text-slate-400"}`} style={{ fontSize: fontSize * 0.6 }}>
          {entry.count}
        </span>
      </button>
      <button
        onClick={() => onToggleFocus(entry.id)}
        title={isFocus ? "Remove from focus" : "Bring to focus"}
        className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${isFocus ? "opacity-100 text-white" : "text-slate-400 hover:text-brass-600"}`}
      >
        {isFocus ? <Pin size={12} strokeWidth={2.5} fill="currentColor" /> : <PinOff size={12} strokeWidth={2.5} />}
      </button>
    </motion.div>
  );
}

function TagTier({
  label,
  entries,
  focusTagIds,
  maxCount,
  onSelectTag,
  onToggleFocus,
}: {
  label: string;
  entries: TagHeatEntry[];
  focusTagIds: string[];
  maxCount: number;
  onSelectTag: (tagId: string) => void;
  onToggleFocus: (tagId: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="font-data text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
      <div className="flex flex-wrap gap-3 items-start">
        {sortEntries(entries, focusTagIds).map((entry) => (
          <TagChip
            key={entry.id}
            entry={entry}
            isFocus={focusTagIds.includes(entry.id)}
            maxCount={maxCount}
            onSelectTag={onSelectTag}
            onToggleFocus={onToggleFocus}
          />
        ))}
      </div>
    </div>
  );
}

export default function TagHeatMap({ entries, focusTagIds, onSelectTag, onToggleFocus }: TagHeatMapProps) {
  if (entries.length === 0) {
    return (
      <section className="rounded-[28px] bg-white border border-dashed border-slate-200 p-10 text-center">
        <p className="font-display italic text-2xl text-slate-900 mb-2">No collections yet.</p>
        <p className="font-precision text-sm text-slate-500">Tag a note to start building this up.</p>
      </section>
    );
  }

  const maxCount = Math.max(1, ...entries.map((e) => e.count));
  const byCategory = (category: NoteTagCategory) => entries.filter((e) => e.category === category);

  return (
    <div className="space-y-8">
      <TagTier
        label="Domain — what it's about"
        entries={byCategory("domain")}
        focusTagIds={focusTagIds}
        maxCount={maxCount}
        onSelectTag={onSelectTag}
        onToggleFocus={onToggleFocus}
      />
      <TagTier
        label="Function — what to do with it"
        entries={byCategory("function")}
        focusTagIds={focusTagIds}
        maxCount={maxCount}
        onSelectTag={onSelectTag}
        onToggleFocus={onToggleFocus}
      />
    </div>
  );
}
