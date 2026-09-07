"use client";

import { motion, AnimatePresence } from "framer-motion";
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

/**
 * v2 reskin of v1's "Manage Collections" modal - same data (getAllTags,
 * updateBookTags) and auto-suggest logic, just Meridian-styled. Only ever
 * shows free-text collection tags: getAllTags() already excludes the
 * curated genre/domain/function vocabularies from this list.
 */
export default function TagEditorModal({
  isOpen, selectedCount, autoSuggestedTags, tags, activeEditTags, onToggleTag, isSaving, onSave, onClose,
}: TagEditorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden"
          >
            <div className="p-6 pb-4 flex items-start justify-between border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="font-display italic text-xl text-slate-900">Collections</h2>
                <p className="font-precision text-sm text-slate-500 mt-1">
                  Tagging <span className="font-bold text-slate-900">{selectedCount}</span>{" "}
                  {selectedCount === 1 ? "volume" : "volumes"}.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {autoSuggestedTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Sparkles size={12} className="text-brass-500" strokeWidth={2.5} />
                    <p className="font-data text-[10px] uppercase tracking-widest text-slate-400">Suggested</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {autoSuggestedTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => onToggleTag(tag.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors bg-brass-50 border-brass-200 text-brass-700 hover:bg-brass-100"
                      >
                        + #{tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="font-data text-[10px] uppercase tracking-widest text-slate-400 mb-3">All Collections</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = activeEditTags.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onToggleTag(tag.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          active
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {active && <Check size={10} strokeWidth={3} />}#{tag.name}
                      </button>
                    );
                  })}
                  {tags.length === 0 && (
                    <p className="font-precision text-sm text-slate-400">No collections yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end flex-shrink-0">
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                {isSaving ? "Saving…" : "Apply Collections"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
