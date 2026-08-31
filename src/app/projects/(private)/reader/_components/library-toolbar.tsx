"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Copy, Rows3, ArrowUpDown, Plus, Search } from "lucide-react";

type SortOption = "title-asc" | "title-desc" | "newest" | "oldest" | "author-asc";
type AlphaFilterType = "none" | "title" | "author";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "title-asc", label: "Title (A to Z)" },
  { id: "title-desc", label: "Title (Z to A)" },
  { id: "newest", label: "Date Added (Newest)" },
  { id: "oldest", label: "Date Added (Oldest)" },
  { id: "author-asc", label: "Author (A to Z)" },
];

interface LibraryHeaderProps {
  booksCount: number;
  alphaFilterType: AlphaFilterType;
  setAlphaFilterType: (t: AlphaFilterType) => void;
  alphaLetter: string;
  setAlphaLetter: (l: string) => void;
  onOpenDuplicates: () => void;
  groupByAuthor: boolean;
  setGroupByAuthor: (v: boolean) => void;
  isSortMenuOpen: boolean;
  setIsSortMenuOpen: (v: boolean) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  onAddVolume: () => void;
}

export function LibraryHeader({
  booksCount, alphaFilterType, setAlphaFilterType, alphaLetter, setAlphaLetter,
  onOpenDuplicates, groupByAuthor, setGroupByAuthor, isSortMenuOpen, setIsSortMenuOpen,
  sortBy, setSortBy, viewMode, setViewMode, onAddVolume,
}: LibraryHeaderProps) {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-black tracking-tighter italic uppercase text-slate-900">Personal Library</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Database contains <span className="text-slate-900 font-bold">{booksCount}</span> total records.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-4 relative">
          <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setAlphaFilterType("none")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${alphaFilterType === "none" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Any</button>
            <button onClick={() => setAlphaFilterType("title")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${alphaFilterType === "title" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>By Title</button>
            <button onClick={() => setAlphaFilterType("author")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${alphaFilterType === "author" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>By Author</button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenDuplicates}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            >
              <Copy size={14} strokeWidth={2.5} />
              Find Duplicates
            </button>

            <button
              onClick={() => setGroupByAuthor(!groupByAuthor)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${groupByAuthor ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Rows3 size={14} strokeWidth={2.5} />
              Group Authors
            </button>

            <div className="relative">
              <button
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <ArrowUpDown size={16} strokeWidth={2.5} />
                Sort
              </button>

              {isSortMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsSortMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-30">
                    <div className="px-3 pb-2 mb-2 border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort Rules</div>
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => { setSortBy(option.id); setIsSortMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${sortBy === option.id ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200">
              <button onClick={() => setViewMode("grid")} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Grid</button>
              <button onClick={() => setViewMode("list")} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>List</button>
            </div>

            <button onClick={onAddVolume} className="px-5 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-sm hover:bg-slate-800 hover:shadow transition-all flex items-center gap-2">
              <Plus size={16} strokeWidth={2.5} />
              Add Volume
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {alphaFilterType !== "none" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-1.5 py-4 px-6 bg-white border border-slate-200 rounded-[20px] shadow-sm"
          >
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                onClick={() => setAlphaLetter(letter)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${alphaLetter === letter ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {letter}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface LibraryFiltersSidebarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedFormat: "all" | "digital" | "physical" | "both";
  setSelectedFormat: (v: "all" | "digital" | "physical" | "both") => void;
  selectedTag: string;
  setSelectedTag: (v: string) => void;
  tags: { id: string; name: string }[];
  selectedAuthor: string;
  setSelectedAuthor: (v: string) => void;
  uniqueAuthors: string[];
}

const FORMATS = [
  { id: "all", label: "All Formats" },
  { id: "digital", label: "Digital Only" },
  { id: "physical", label: "Physical Only" },
  { id: "both", label: "Digital & Physical" },
] as const;

export function LibraryFiltersSidebar({
  searchQuery, setSearchQuery, selectedFormat, setSelectedFormat, selectedTag, setSelectedTag,
  tags, selectedAuthor, setSelectedAuthor, uniqueAuthors,
}: LibraryFiltersSidebarProps) {
  return (
    <aside className="w-full md:w-64 flex-shrink-0 space-y-8">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Find a book..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-[10px] text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all"
        />
      </div>

      <div>
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Format</h3>
        <div className="space-y-1">
          {FORMATS.map((format) => (
            <button
              key={format.id}
              onClick={() => setSelectedFormat(format.id)}
              className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedFormat === format.id ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {format.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Collections</h3>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedTag("all")}
            className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedTag === "all" ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            All Collections
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTag(tag.id)}
              className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedTag === tag.id ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              # {tag.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Authors</h3>
        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
          <button
            onClick={() => setSelectedAuthor("all")}
            className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedAuthor === "all" ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            All Authors
          </button>
          {uniqueAuthors.map((author) => (
            <button
              key={author}
              onClick={() => setSelectedAuthor(author)}
              className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors truncate ${selectedAuthor === author ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {author}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
