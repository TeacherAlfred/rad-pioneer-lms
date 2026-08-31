"use client";

import { useState } from "react";
import { Tag as TagIcon, Check } from "lucide-react";
import type { NoteTagOption } from "../../reader/_actions/notes";

interface NoteTagPickerProps {
  noteId: string;
  tags: NoteTagOption[];
  activeTagIds: string[];
  onSave: (noteId: string, tagIds: string[]) => Promise<void>;
}

const MAX_DOMAIN = 2;
const MAX_FUNCTION = 1;

export default function NoteTagPicker({ noteId, tags, activeTagIds, onSave }: NoteTagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set(activeTagIds));
  const [isSaving, setIsSaving] = useState(false);

  const domainTags = tags.filter((t) => t.category === "domain");
  const functionTags = tags.filter((t) => t.category === "function");

  const open = () => {
    setPending(new Set(activeTagIds));
    setIsOpen(true);
  };

  const pendingDomainCount = domainTags.filter((t) => pending.has(t.id)).length;

  const toggleDomain = (tagId: string) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        if (pendingDomainCount >= MAX_DOMAIN) return prev;
        next.add(tagId);
      }
      return next;
    });
  };

  const toggleFunction = (tagId: string) => {
    setPending((prev) => {
      const next = new Set(prev);
      const wasActive = next.has(tagId);
      // Single-select: picking a new function tag clears any other one first.
      functionTags.forEach((t) => next.delete(t.id));
      if (!wasActive) next.add(tagId);
      return next;
    });
  };

  const save = async () => {
    setIsSaving(true);
    await onSave(noteId, Array.from(pending));
    setIsSaving(false);
    setIsOpen(false);
  };

  const activeTags = tags.filter((t) => activeTagIds.includes(t.id));

  return (
    <div className="relative inline-block">
      <div className="flex flex-wrap items-center gap-1.5">
        {activeTags.map((t) => (
          <span
            key={t.id}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              t.category === "function"
                ? "text-slate-600 bg-slate-100 border-slate-200"
                : "text-brass-700 bg-brass-50 border-brass-100"
            }`}
          >
            #{t.name}
          </span>
        ))}
        <button
          onClick={open}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 border border-dashed border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded-full transition-colors"
        >
          <TagIcon size={10} strokeWidth={2.5} />
          {activeTags.length > 0 ? "Edit" : "Tag"}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-30 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-72">
            <div className="mb-3">
              <p className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Domain · pick up to {MAX_DOMAIN}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {domainTags.length === 0 ? (
                  <p className="font-precision text-xs text-slate-400 p-1">None yet.</p>
                ) : (
                  domainTags.map((t) => {
                    const active = pending.has(t.id);
                    const disabled = !active && pendingDomainCount >= MAX_DOMAIN;
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleDomain(t.id)}
                        disabled={disabled}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors border ${
                          active
                            ? "bg-brass-600 border-brass-600 text-white"
                            : disabled
                              ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {active && <Check size={10} strokeWidth={3} />}#{t.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mb-3">
              <p className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Function · pick up to {MAX_FUNCTION}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {functionTags.length === 0 ? (
                  <p className="font-precision text-xs text-slate-400 p-1">None yet.</p>
                ) : (
                  functionTags.map((t) => {
                    const active = pending.has(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleFunction(t.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors border ${
                          active
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {active && <Check size={10} strokeWidth={3} />}#{t.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={save}
              disabled={isSaving}
              className="w-full py-1.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
