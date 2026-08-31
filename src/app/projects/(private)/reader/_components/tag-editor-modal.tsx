"use client";

import { X, Sparkles, Check } from "lucide-react";

interface Tag {
  id: string;
  name: string;
}

interface TagEditorModalProps {
  isOpen: boolean;
  selectedCount: number;
  autoSuggestedTags: Tag[];
  tags: Tag[];
  activeEditTags: Set<string>;
  onToggleTag: (tagId: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function TagEditorModal({
  isOpen, selectedCount, autoSuggestedTags, tags, activeEditTags, onToggleTag, isSaving, onSave, onClose,
}: TagEditorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl ring-1 ring-black/5 max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        <div className="border-b border-slate-100 p-6 bg-slate-50 flex-shrink-0 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-900">Manage Collections</h3>
            <p className="text-sm text-slate-500 mt-1">
              Applying tags to <span className="font-bold text-slate-900">{selectedCount}</span> selected {selectedCount === 1 ? 'volume' : 'volumes'}.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-full border border-slate-200 shadow-sm transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {autoSuggestedTags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} strokeWidth={2.5} className="text-amber-500" />
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Suggested by Content</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {autoSuggestedTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => onToggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeEditTags.has(tag.id) ? 'bg-amber-100 border-amber-200 text-amber-800 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:bg-amber-50'}`}
                  >
                    + #{tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">All Collections</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onToggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${activeEditTags.has(tag.id) ? 'bg-amber-600 border-amber-600 text-white shadow-md scale-105' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'}`}
                >
                  {activeEditTags.has(tag.id) && <Check size={11} strokeWidth={3} className="opacity-75" />}
                  #{tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-end flex-shrink-0">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-amber-500 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Apply Collections"}
          </button>
        </div>
      </div>
    </div>
  );
}
