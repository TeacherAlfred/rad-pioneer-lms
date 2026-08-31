"use client";

import { Check } from "lucide-react";
import type { NoteTagOption } from "../../reader/_actions/notes";

interface NoteTagSelectorProps {
  tags: NoteTagOption[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

const MAX_DOMAIN = 2;
const MAX_FUNCTION = 1;

/**
 * Plain controlled chip selector for tagging a note at the moment it's
 * created - no popover, no noteId, no save button of its own. The compose
 * form owns the selection and submits it alongside the note itself, so
 * tagging happens in the same breath as writing the note while the reason
 * for it is still fresh, rather than as a separate later step.
 */
export default function NoteTagSelector({ tags, selectedTagIds, onChange }: NoteTagSelectorProps) {
  const domainTags = tags.filter((t) => t.category === "domain");
  const functionTags = tags.filter((t) => t.category === "function");
  const domainCount = domainTags.filter((t) => selectedTagIds.includes(t.id)).length;

  const toggleDomain = (tagId: string) => {
    const active = selectedTagIds.includes(tagId);
    if (active) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      if (domainCount >= MAX_DOMAIN) return;
      onChange([...selectedTagIds, tagId]);
    }
  };

  const toggleFunction = (tagId: string) => {
    const active = selectedTagIds.includes(tagId);
    const withoutFunctions = selectedTagIds.filter((id) => !functionTags.some((t) => t.id === id));
    onChange(active ? withoutFunctions : [...withoutFunctions, tagId]);
  };

  if (tags.length === 0) return null;

  return (
    <div className="mb-3 space-y-2.5">
      {domainTags.length > 0 && (
        <div>
          <p className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Domain · up to {MAX_DOMAIN}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {domainTags.map((t) => {
              const active = selectedTagIds.includes(t.id);
              const disabled = !active && domainCount >= MAX_DOMAIN;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleDomain(t.id)}
                  disabled={disabled}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors border ${
                    active
                      ? "bg-brass-600 border-brass-600 text-white"
                      : disabled
                        ? "bg-white border-brass-100 text-slate-300 cursor-not-allowed"
                        : "bg-white border-brass-200 text-slate-600 hover:bg-brass-50"
                  }`}
                >
                  {active && <Check size={10} strokeWidth={3} />}#{t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {functionTags.length > 0 && (
        <div>
          <p className="font-data text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Function · up to {MAX_FUNCTION}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {functionTags.map((t) => {
              const active = selectedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleFunction(t.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors border ${
                    active
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {active && <Check size={10} strokeWidth={3} />}#{t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
