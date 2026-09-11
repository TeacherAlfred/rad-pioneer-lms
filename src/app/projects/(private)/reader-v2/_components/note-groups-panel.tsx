"use client";

import { X } from "lucide-react";
import type { NoteGroup } from "../_lib/derive-note-groups";

const REASON_COLOR: Record<NoteGroup["reason"], string> = {
  "note-tag": "#c79a4b",
  tag: "rgba(199,154,75,0.6)",
  author: "#93a0b4",
};

const REASON_LABEL: Record<NoteGroup["reason"], string> = {
  "note-tag": "Note tag",
  tag: "Collection",
  author: "Author",
};

interface NoteGroupsPanelProps {
  groups: NoteGroup[];
  visibleIds: Set<string>;
  selectedGroupIds: Set<string>;
  onSelect: (group: NoteGroup, additive: boolean) => void;
  onDeselect: (group: NoteGroup) => void;
}

export default function NoteGroupsPanel({ groups, visibleIds, selectedGroupIds, onSelect, onDeselect }: NoteGroupsPanelProps) {
  return (
    <div className="w-72 flex-shrink-0 h-[560px] bg-white border border-slate-200 rounded-[20px] shadow-sm overflow-y-auto custom-scrollbar p-4">
      <p className="font-data text-[9px] uppercase tracking-widest text-slate-400 mb-1 px-1">
        Groupings · {groups.length}
      </p>
      <p className="font-precision text-[11px] text-slate-400 mb-3 px-1">Ctrl/Cmd-click to select more than one.</p>
      {groups.length === 0 ? (
        <p className="font-precision text-xs text-slate-400 px-1">
          No shared tags or authors span multiple books yet.
        </p>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => {
            const isSelected = selectedGroupIds.has(group.id);
            const inView = group.memberIds.some((id) => visibleIds.has(id));
            return (
              <div
                key={group.id}
                role="button"
                tabIndex={0}
                onClick={(e) => onSelect(group, e.ctrlKey || e.metaKey)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(group, e.ctrlKey || e.metaKey); }
                }}
                title={isSelected ? "Click to clear, Ctrl/Cmd-click to add more" : "Ctrl/Cmd-click to add to selection"}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-brass-50 border border-brass-300"
                    : "border border-transparent hover:bg-slate-50"
                } ${!inView && !isSelected ? "opacity-40" : "opacity-100"}`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: REASON_COLOR[group.reason] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-precision text-sm font-bold text-slate-900 truncate">
                    {group.label}
                  </span>
                  <span className="block font-data text-[9px] uppercase tracking-widest text-slate-400">
                    {REASON_LABEL[group.reason]} · {group.memberIds.length}
                  </span>
                </span>
                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeselect(group); }}
                    title="Remove from selection"
                    className="p-1 text-brass-600 hover:text-brass-800 transition-colors flex-shrink-0"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
