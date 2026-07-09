"use client";

import React, { useState, useEffect } from "react";
import { getLibraryBooks, getAllTags, markBookForDeletion, BookWithTags, toggleBookStatus, updateBookCover, applyReviewedMetadata, getDuplicateGroups, updateBookTags } from "./_actions/books";
import { autoScanSingleBook } from "./_actions/metadata";
import { publishWipBook } from "./_actions/upload"; 
import UploadModal from "./_components/upload-modal";
import WipCard from "./_components/wip-card";
import BookDetailsSheet from "./_components/book-details-sheet";
import { syncExactOpenLibraryUrl } from "./_actions/metadata";

type TabType = "reading" | "vip" | "published" | "wip-ready" | "wip-unmatched" | "all";
type SortOption = "title-asc" | "title-desc" | "newest" | "oldest" | "author-asc";
type AlphaFilterType = "none" | "title" | "author";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export default function LibraryDashboard() {
  const [books, setBooks] = useState<BookWithTags[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookWithTags | null>(null);
  
  // Batch processing states
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [isBatchPublishing, setIsBatchPublishing] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());

  // Targeted single-batch review modal states
  const [rescanReviewQueue, setRescanReviewQueue] = useState<BookWithTags[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState<number>(-1);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewSynopsis, setReviewSynopsis] = useState("");
  const [reviewCoverId, setReviewCoverId] = useState<number | null>(null);
  const [reviewOptions, setReviewOptions] = useState<any>(null);
  
  const [overrideUrl, setOverrideUrl] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);

  // Duplicates Manager State
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<BookWithTags[][]>([]);
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);

  // Tag Editor State
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
  const [activeEditTags, setActiveEditTags] = useState<Set<string>>(new Set());
  const [autoSuggestedTags, setAutoSuggestedTags] = useState<{ id: string; name: string }[]>([]);
  const [isSavingTags, setIsSavingTags] = useState(false);

  // Filter & Sort States
  const [activeTab, setActiveTab] = useState<TabType>("reading");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<"all" | "digital" | "physical" | "both">("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedAuthor, setSelectedAuthor] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [groupByAuthor, setGroupByAuthor] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("title-asc");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Alphabet Filter States
  const [alphaFilterType, setAlphaFilterType] = useState<AlphaFilterType>("none");
  const [alphaLetter, setAlphaLetter] = useState<string>("A");

  // Vault Security States
  const [vaultOpen, setVaultOpen] = useState(false);
  const [pinBuffer, setPinBuffer] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const tabs = [
    { id: "reading", label: "Currently Reading" },
    { id: "vip", label: "VIP Books" },
    { id: "published", label: "Library" },
    { id: "wip-ready", label: "Ready" },
    { id: "wip-unmatched", label: "Unmatched" },
    { id: "all", label: "All Volumes" },
  ] as const;

  // Global Key Listener for the Vault
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!/^\d$/.test(e.key)) return;
      
      setPinBuffer((prev) => {
        const nextBuffer = (prev + e.key).slice(-7);
        if (nextBuffer === "1123458") {
          setVaultOpen(true);
          alert("Vault storage decrypted successfully.");
          return "";
        }
        return nextBuffer;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const refreshLibrary = async () => {
    try {
      const [fetchedBooks, fetchedTags] = await Promise.all([getLibraryBooks(), getAllTags()]);
      setBooks(fetchedBooks);
      setTags(fetchedTags);
    } catch (err) {
      console.error("Failed to fetch library data", err);
    }
  };

  useEffect(() => {
    async function initialLoad() {
      await refreshLibrary();
      setLoading(false);
    }
    initialLoad();
  }, []);

  useEffect(() => {
    setSelectedBooks(new Set());
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedFormat, selectedTag, selectedAuthor, sortBy, alphaFilterType, alphaLetter]);

  // Load active review item into editable states
  useEffect(() => {
    if (currentReviewIndex >= 0 && rescanReviewQueue[currentReviewIndex]) {
      const book = rescanReviewQueue[currentReviewIndex];
      const meta = (book as any).suggested_metadata || {};
      
      setReviewOptions(meta);
      setReviewTitle(meta.titles?.[0] || book.title || "");
      setReviewAuthor(meta.authors?.[0] || book.author || "");
      setReviewSynopsis(meta.synopses?.[0] || book.synopsis || "");
      setReviewCoverId(meta.coverIds?.[0] || null);
    }
  }, [currentReviewIndex, rescanReviewQueue]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to mark this volume for deletion?")) {
      await markBookForDeletion(id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
      if (selectedBooks.has(id)) {
        const newSet = new Set(selectedBooks);
        newSet.delete(id);
        setSelectedBooks(newSet);
      }
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedBooks);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedBooks(newSet);
  };

  const selectAllInTab = (bookIds: string[]) => {
    if (selectedBooks.size === bookIds.length && bookIds.length > 0) {
      setSelectedBooks(new Set()); 
    } else {
      setSelectedBooks(new Set(bookIds)); 
    }
  };

  // --- TAG EDITOR HANDLERS ---
  const handleOpenTagEditor = () => {
    const targetBooks = books.filter(b => selectedBooks.has(b.id));
    if (targetBooks.length === 0) return;

    // If only one book is selected, pre-fill its existing tags
    const initialTags = new Set<string>();
    if (targetBooks.length === 1) {
      targetBooks[0].tags.forEach(t => initialTags.add(t.id));
    }
    setActiveEditTags(initialTags);

    // Smart Auto-Suggest Engine
    // Combine all titles and synopses of selected books to find semantic overlaps with available tags
    const combinedText = targetBooks.map(b => `${b.title} ${b.synopsis || ""}`).join(" ").toLowerCase();
    const suggestions = tags.filter(tag => {
      // Don't suggest tags that are already selected
      if (initialTags.has(tag.id)) return false;
      // Look for the tag name inside the combined text block (e.g. finding "robotics" in the synopsis)
      return combinedText.includes(tag.name.toLowerCase().replace(/-/g, " "));
    });

    setAutoSuggestedTags(suggestions);
    setIsTagEditorOpen(true);
  };

  const toggleEditTag = (tagId: string) => {
    setActiveEditTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) newSet.delete(tagId);
      else newSet.add(tagId);
      return newSet;
    });
  };

  const handleSaveTags = async () => {
    setIsSavingTags(true);
    try {
      await updateBookTags(Array.from(selectedBooks), Array.from(activeEditTags));
      await refreshLibrary();
      setIsTagEditorOpen(false);
      setSelectedBooks(new Set());
    } catch (e) {
      console.error("Failed to save tags", e);
      alert("Failed to update collections.");
    }
    setIsSavingTags(false);
  };

  // --- DUPLICATES MANAGER HANDLERS ---
  const handleOpenDuplicatesModal = async () => {
    setIsScanningDuplicates(true);
    setIsDuplicatesModalOpen(true);
    try {
      const groups = await getDuplicateGroups();
      setDuplicateGroups(groups);
    } catch (e) {
      console.error("Failed to scan duplicates", e);
    }
    setIsScanningDuplicates(false);
  };

  const handleDeleteDuplicate = async (id: string, groupIndex: number) => {
    if (!confirm("Are you sure you want to delete this specific copy?")) return;
    
    await markBookForDeletion(id);
    
    setDuplicateGroups((prev) => {
      const newGroups = [...prev];
      newGroups[groupIndex] = newGroups[groupIndex].filter((b) => b.id !== id);
      if (newGroups[groupIndex].length <= 1) {
        newGroups.splice(groupIndex, 1);
      }
      return newGroups;
    });

    setBooks((prev) => prev.filter((b) => b.id !== id));
  };


  // --- INTERACTIVE TARGETED RESCAN DIALOGS ---
  const handleBatchRescan = async (targetBooks: BookWithTags[]) => {
    if (targetBooks.length === 0) return;
    setIsBatchScanning(true);
    
    const scannedQueue: BookWithTags[] = [];
    for (const book of targetBooks) {
      const result = await autoScanSingleBook(book.id, book.title || "Unknown Title");
      scannedQueue.push({
        ...book,
        suggested_metadata: (result as any)?.suggested_metadata || (book as any).suggested_metadata
      });
    }

    setRescanReviewQueue(scannedQueue);
    setCurrentReviewIndex(0);
    setIsBatchScanning(false);
    setSelectedBooks(new Set());
  };

  const handleOverrideSync = async () => {
    if (!overrideUrl) return;
    setIsOverriding(true);
    const exactData = await syncExactOpenLibraryUrl(overrideUrl);
    
    if (exactData) {
      setReviewOptions(exactData);
      setReviewTitle(exactData.titles?.[0] || reviewTitle);
      setReviewAuthor(exactData.authors?.[0] || reviewAuthor);
      setReviewSynopsis(exactData.synopses?.[0] || reviewSynopsis);
      setReviewCoverId(exactData.coverIds?.[0] || null);
      setOverrideUrl(""); 
    } else {
      alert("Could not fetch data. Ensure the URL contains a valid Edition ID (e.g., OL...M).");
    }
    setIsOverriding(false);
  };

  const handleAcceptMetadata = async () => {
    const activeBook = rescanReviewQueue[currentReviewIndex];
    if (!activeBook) return;

    try {
      await applyReviewedMetadata(activeBook.id, reviewTitle, reviewAuthor, reviewSynopsis, reviewCoverId);
      await refreshLibrary();
      advanceReviewQueue();
    } catch (e) {
      console.error("Failed to update book metadata", e);
      alert("Failed to save changes.");
    }
  };

  const advanceReviewQueue = () => {
    if (currentReviewIndex < rescanReviewQueue.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
    } else {
      setRescanReviewQueue([]);
      setCurrentReviewIndex(-1);
    }
  };

  const handleBatchPublish = async (targetBooks: BookWithTags[]) => {
    if (targetBooks.length === 0) return;
    setIsBatchPublishing(true);
    for (const book of targetBooks) {
      const suggested = (book as any).suggested_metadata || {};
      const finalTitle = suggested.title || book.title || "Unknown";
      const finalAuthor = suggested.author || "Unknown Author";
      const fileExt = book.file_type === "pdf" ? "pdf" : "epub";

      try {
        await publishWipBook(
          book.id, 
          book.file_key as string, 
          finalAuthor, 
          finalTitle, 
          fileExt, 
          suggested.coverKey, 
          null, 
          suggested.synopsis
        );
      } catch (e) {
        console.error(`Failed to batch publish ${book.title}`, e);
      }
    }
    await refreshLibrary();
    setIsBatchPublishing(false);
    setSelectedBooks(new Set());
  };

  const readingCount = books.filter(b => b.status === 'reading').length;
  const vipCount = books.filter(b => (b as any).is_vip).length;
  const publishedCount = books.filter(b => b.status !== 'wip').length;
  const wipReadyCount = books.filter(b => b.status === 'wip' && (b as any).suggested_metadata?.scan_status === 'success').length;
  const wipUnmatchedCount = books.filter(b => b.status === 'wip' && (b as any).suggested_metadata?.scan_status !== 'success').length;
  const uniqueAuthors = Array.from(new Set(books.map(b => b.author || "Unknown Author"))).sort();

  // 1. Filter Pipeline Logic
  const filteredBooks = books.filter((book) => {
    const suggested = (book as any).suggested_metadata || {};
    
    if ((book as any).is_vaulted && !vaultOpen) return false;
    
    const matchesTab = 
      activeTab === "all" ? true :
      activeTab === "reading" ? book.status === "reading" :
      activeTab === "vip" ? (book as any).is_vip === true :
      activeTab === "published" ? book.status !== "wip" :
      activeTab === "wip-ready" ? (book.status === "wip" && suggested.scan_status === "success") :
      activeTab === "wip-unmatched" ? (book.status === "wip" && suggested.scan_status !== "success") : false;

    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFormat =
      selectedFormat === "all" ||
      (selectedFormat === "digital" && book.has_digital) ||
      (selectedFormat === "physical" && book.has_physical) ||
      (selectedFormat === "both" && book.has_digital && book.has_physical);

    const matchesTag =
      selectedTag === "all" || book.tags.some((t) => t.id === selectedTag);

    const matchesAuthor = 
      selectedAuthor === "all" || (book.author || "Unknown Author") === selectedAuthor;

    let matchesAlpha = true;
    if (alphaFilterType !== "none") {
      const compareString = alphaFilterType === "title" ? (book.title || "") : (book.author || "");
      if (alphaLetter === "#") {
        matchesAlpha = /^[0-9]/.test(compareString);
      } else {
        matchesAlpha = compareString.toLowerCase().startsWith(alphaLetter.toLowerCase());
      }
    }

    return matchesTab && matchesSearch && matchesFormat && matchesTag && matchesAuthor && matchesAlpha;
  });

  // 2. Premium Sorting Engine
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    const titleA = (a.title || "").toLowerCase();
    const titleB = (b.title || "").toLowerCase();
    const authorA = (a.author || "").toLowerCase();
    const authorB = (b.author || "").toLowerCase();
    const dateA = new Date((a as any).created_at || 0).getTime(); 
    const dateB = new Date((b as any).created_at || 0).getTime();

    switch (sortBy) {
      case "title-asc": return titleA.localeCompare(titleB);
      case "title-desc": return titleB.localeCompare(titleA);
      case "newest": return dateB - dateA;
      case "oldest": return dateA - dateB;
      case "author-asc": return authorA.localeCompare(authorB);
      default: return 0;
    }
  });

  // 3. PAGINATION MATH
  const totalPages = Math.ceil(sortedBooks.length / itemsPerPage);
  const paginatedBooks = sortedBooks.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  const displayedBookIds = paginatedBooks.map(b => b.id);
  const selectedInCurrentView = paginatedBooks.filter(b => selectedBooks.has(b.id));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium tracking-wide">Indexing Library Volumes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-[1400px] mx-auto p-6 md:p-10 space-y-8">
        
        {/* Dashboard Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Personal Library</h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              Database contains <span className="text-slate-900 font-bold">{books.length}</span> total records.
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
                onClick={handleOpenDuplicatesModal}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Find Duplicates
              </button>

              <button 
                onClick={() => setGroupByAuthor(!groupByAuthor)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${groupByAuthor ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h7"></path></svg>
                Group Authors
              </button>

              <div className="relative">
                <button 
                  onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="11" y2="14"></line><line x1="21" y1="18" x2="15" y2="18"></line></svg>
                  Sort
                </button>

                {isSortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsSortMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-30">
                      <div className="px-3 pb-2 mb-2 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sort Rules</div>
                      {[
                        { id: "title-asc", label: "Title (A to Z)" },
                        { id: "title-desc", label: "Title (Z to A)" },
                        { id: "newest", label: "Date Added (Newest)" },
                        { id: "oldest", label: "Date Added (Oldest)" },
                        { id: "author-asc", label: "Author (A to Z)" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => { setSortBy(option.id as SortOption); setIsSortMenuOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${sortBy === option.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
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
              
              <button onClick={() => setIsUploadModalOpen(true)} className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-800 hover:shadow transition-all flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Volume
              </button>
            </div>
          </div>
        </div>

        {alphaFilterType !== "none" && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 py-4 px-6 bg-white border border-slate-200 rounded-xl shadow-sm">
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                onClick={() => setAlphaLetter(letter)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${alphaLetter === letter ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-10">
          
          <aside className="w-full md:w-64 flex-shrink-0 space-y-8">
            <div className="relative">
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input 
                type="text" 
                placeholder="Find a book..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" 
              />
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Format</h3>
              <div className="space-y-1">
                {[
                  { id: "all", label: "All Formats" },
                  { id: "digital", label: "Digital Only" },
                  { id: "physical", label: "Physical Only" },
                  { id: "both", label: "Digital & Physical" },
                ].map((format) => (
                  <button 
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id as any)}
                    className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedFormat === format.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Collections</h3>
              <div className="space-y-1">
                <button 
                  onClick={() => setSelectedTag("all")}
                  className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedTag === "all" ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  All Collections
                </button>
                {tags.map((tag) => (
                  <button 
                    key={tag.id}
                    onClick={() => setSelectedTag(tag.id)}
                    className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedTag === tag.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    # {tag.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Authors</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                <button 
                  onClick={() => setSelectedAuthor("all")}
                  className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedAuthor === "all" ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  All Authors
                </button>
                {uniqueAuthors.map((author) => (
                  <button 
                    key={author}
                    onClick={() => setSelectedAuthor(author)}
                    className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg transition-colors truncate ${selectedAuthor === author ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {author}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 flex flex-col">
            
            <div className="flex border-b border-slate-200 mb-6 overflow-x-auto custom-scrollbar">
              {tabs.map((tab) => {
                const count = 
                  tab.id === 'reading' ? readingCount :
                  tab.id === 'vip' ? vipCount :
                  tab.id === 'published' ? publishedCount :
                  tab.id === 'wip-ready' ? wipReadyCount :
                  tab.id === 'wip-unmatched' ? wipUnmatchedCount : 0;

                return (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`whitespace-nowrap px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === tab.id 
                        ? "border-slate-900 text-slate-900" 
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-slate-200 text-slate-900 font-bold" : "bg-slate-100 text-slate-500"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* --- DYNAMIC BATCH ACTION BAR --- */}
            {selectedBooks.size > 0 && (
              <div className="border rounded-xl p-3 mb-6 flex flex-wrap items-center justify-between shadow-sm transition-colors bg-indigo-50 border-indigo-200 gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => selectAllInTab(displayedBookIds)}
                    className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2"
                  >
                    <div className="w-5 h-5 rounded border flex items-center justify-center bg-indigo-600 border-indigo-600 text-white">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    Deselect All
                  </button>
                  <span className="text-sm font-medium text-slate-500 border-l border-slate-300 pl-4">
                    {selectedBooks.size} selected
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* NEW: Edit Tags Button */}
                  <button 
                    onClick={handleOpenTagEditor}
                    className="px-5 py-2 bg-indigo-100 border border-indigo-200 hover:bg-indigo-200 text-indigo-700 text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                  >
                    Edit Tags
                  </button>

                  <button 
                    onClick={() => handleBatchRescan(selectedInCurrentView)}
                    disabled={isBatchScanning}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isBatchScanning ? "Scanning..." : `Rescan Metadata`}
                  </button>
                  
                  {activeTab === 'wip-ready' && (
                    <button 
                      onClick={() => handleBatchPublish(selectedInCurrentView)}
                      disabled={isBatchPublishing}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isBatchPublishing ? "Publishing..." : `Publish`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {sortedBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">No records found in this view.</h3>
              </div>
            ) : groupByAuthor && viewMode === "grid" ? (
              <div className="flex flex-col gap-8">
                {(() => {
                  const grouped = paginatedBooks.reduce((acc, book) => {
                    const author = book.author || "Unknown Author";
                    if (!acc[author]) acc[author] = [];
                    acc[author].push(book);
                    return acc;
                  }, {} as Record<string, BookWithTags[]>);

                  return Object.entries(grouped).map(([authorName, authorBooks]) => (
                    <div key={authorName} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                        <h2 className="text-xl font-extrabold text-slate-900">{authorName}</h2>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">
                          {authorBooks.length} {authorBooks.length === 1 ? 'Volume' : 'Volumes'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {authorBooks.map((book) => (
                           <div key={book.id} className="relative group">
                             {book.status === 'wip' ? (
                               <WipCard 
                                 book={book} 
                                 onPublishSuccess={refreshLibrary} 
                                 isSelectable={true}
                                 isSelected={selectedBooks.has(book.id)}
                                 onToggleSelect={toggleSelection}
                               />
                             ) : (
                               <>
                                 <div className={`absolute top-2 left-2 z-30 transition-opacity ${selectedBooks.has(book.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                   <div onClick={(e) => { e.stopPropagation(); toggleSelection(book.id); }} className={`w-6 h-6 rounded-md border-2 cursor-pointer flex items-center justify-center backdrop-blur-md transition-colors ${selectedBooks.has(book.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-900/40 border-white/70 text-transparent hover:bg-slate-900/60'}`}>
                                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                   </div>
                                 </div>
                                 <button onClick={() => setSelectedBookDetails(book)} className="w-full text-left bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col focus:outline-none relative aspect-[2/3]">
                                   {book.cover_key ? (
                                     <div className="w-full h-full relative">
                                       <img src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                       <div className="absolute top-2 right-2 bg-slate-900/75 backdrop-blur-xs text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wider">{book.file_type || "Canvas"}</div>
                                     </div>
                                   ) : (
                                     <div className="p-4 flex flex-col justify-between h-full w-full bg-gradient-to-br from-slate-50 to-slate-100 border-t-4 border-slate-800">
                                       <div>
                                         <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded tracking-wider uppercase mb-2 inline-block">No Art</span>
                                         <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-3">{book.title}</h3>
                                       </div>
                                       <p className="text-xs text-slate-500 font-medium truncate mt-2">{book.author || "Unknown"}</p>
                                     </div>
                                   )}
                                 </button>
                               </>
                             )}
                           </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {paginatedBooks.map((book) => {
                  if (book.status === 'wip') {
                    return (
                      <WipCard 
                        key={book.id} 
                        book={book} 
                        onPublishSuccess={refreshLibrary} 
                        isSelectable={true}
                        isSelected={selectedBooks.has(book.id)}
                        onToggleSelect={toggleSelection}
                      />
                    );
                  }

                  return (
                    <div key={book.id} className="relative group">
                      <div className={`absolute top-2 left-2 z-30 transition-opacity ${selectedBooks.has(book.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div 
                          onClick={(e) => { e.stopPropagation(); toggleSelection(book.id); }}
                          className={`w-6 h-6 rounded-md border-2 cursor-pointer flex items-center justify-center backdrop-blur-md transition-colors ${selectedBooks.has(book.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-900/40 border-white/70 text-transparent hover:bg-slate-900/60'}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>

                      <button 
                        onClick={() => setSelectedBookDetails(book)} 
                        className="w-full text-left bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col focus:outline-none relative aspect-[2/3]"
                      >
                        {book.cover_key ? (
                          <div className="w-full h-full relative">
                            <img 
                              src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            />
                            <div className="absolute top-2 right-2 bg-slate-900/75 backdrop-blur-xs text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {book.file_type || "Canvas"}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 flex flex-col justify-between h-full w-full bg-gradient-to-br from-slate-50 to-slate-100 border-t-4 border-slate-800">
                            <div>
                              <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded tracking-wider uppercase mb-2 inline-block">No Art Assets</span>
                              <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-3">{book.title}</h3>
                            </div>
                            <p className="text-xs text-slate-500 font-medium truncate mt-2">{book.author || "Unknown"}</p>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 text-center text-slate-500">
                List rendering framework logic intentionally omitted for brevity.
              </div>
            )}

            {sortedBooks.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500">Show</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 text-slate-900 text-sm rounded-lg block px-2.5 py-1.5 shadow-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-sm font-medium text-slate-500">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 mr-4 font-medium">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedBooks.length)} of {sortedBooks.length}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 font-medium text-sm transition-colors"
                  >
                    Prev
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 font-medium text-sm transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {isUploadModalOpen && (
        <UploadModal 
          existingBooks={books} 
          onClose={async () => {
            setIsUploadModalOpen(false);
            await refreshLibrary(); 
          }} 
        />
      )}

      <BookDetailsSheet 
        book={selectedBookDetails} 
        isOpen={!!selectedBookDetails} 
        onClose={() => setSelectedBookDetails(null)} 
        onDelete={(id) => {
          handleDelete(id);
          setSelectedBookDetails(null);
        }}
      />

      {isDuplicatesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="border-b border-slate-100 p-6 bg-slate-50 flex-shrink-0 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Duplicate Volumes Manager</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {isScanningDuplicates ? "Scanning library..." : `Found ${duplicateGroups.length} groups of identical titles.`}
                </p>
              </div>
              <button onClick={() => setIsDuplicatesModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-full border border-slate-200 shadow-sm transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {isScanningDuplicates ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="font-semibold text-slate-600">Cross-referencing 1,600+ records...</p>
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Your library is perfectly clean.</h3>
                  <p className="text-slate-500 mt-1">No duplicate titles were found.</p>
                </div>
              ) : (
                duplicateGroups.map((group, groupIndex) => {
                  const fileKeys = group.map(b => b.file_key).filter(Boolean);
                  const uniqueFiles = new Set(fileKeys);
                  const isFileDuplicate = uniqueFiles.size > 1; 

                  return (
                    <div key={groupIndex} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 border-b border-slate-200 p-4 flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-base font-bold text-slate-900">{group[0].title}</h4>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group[0].author || "Unknown Author"}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {isFileDuplicate ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-sm">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                              Multiple Files in Storage
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-sm">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                              Database Record Duplicate
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {group.map((book) => (
                          <div key={book.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-16 bg-slate-200 rounded flex-shrink-0 overflow-hidden border border-slate-300">
                                {book.cover_key && <img src={`/api/storage/cover?key=${encodeURIComponent(book.cover_key)}`} className="w-full h-full object-cover" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${book.status === 'wip' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {book.status === 'wip' ? 'WIP' : 'Library'}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">Added: {new Date(book.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs font-mono text-slate-600 break-all bg-slate-100 p-1.5 rounded inline-block max-w-sm truncate" title={book.file_key || "No file"}>
                                  {book.file_key || "No digital file attached"}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {book.status === 'wip' && (
                                <button onClick={() => handleBatchRescan([book])} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                                  Rescan
                                </button>
                              )}
                              <button onClick={() => handleDeleteDuplicate(book.id, groupIndex)} className="px-3 py-1.5 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-50 transition-colors">
                                Delete Copy
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- NEW: BATCH TAG EDITOR MODAL --- */}
      {isTagEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            <div className="border-b border-slate-100 p-6 bg-slate-50 flex-shrink-0 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Manage Collections</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Applying tags to <span className="font-bold text-slate-900">{selectedBooks.size}</span> selected {selectedBooks.size === 1 ? 'volume' : 'volumes'}.
                </p>
              </div>
              <button onClick={() => setIsTagEditorOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-full border border-slate-200 shadow-sm transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              
              {/* Smart Auto-Suggestions */}
              {autoSuggestedTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500"><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M4.93 4.93l2.83 2.83"></path><path d="M16.24 16.24l2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="M4.93 19.07l2.83-2.83"></path><path d="M16.24 7.76l2.83-2.83"></path></svg>
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-widest">Suggested by Content</label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {autoSuggestedTags.map(tag => (
                      <button 
                        key={tag.id}
                        onClick={() => toggleEditTag(tag.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeEditTags.has(tag.id) ? 'bg-amber-100 border-amber-200 text-amber-800 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:bg-amber-50'}`}
                      >
                        + #{tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Master Tag List */}
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">All Collections</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button 
                      key={tag.id}
                      onClick={() => toggleEditTag(tag.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeEditTags.has(tag.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-105' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'}`}
                    >
                      {activeEditTags.has(tag.id) && <span className="mr-1 opacity-75">✓</span>}
                      #{tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-end flex-shrink-0">
              <button 
                onClick={handleSaveTags} 
                disabled={isSavingTags}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isSavingTags ? "Saving..." : "Apply Collections"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Targeted Metadata Update Review Modal */}
      {rescanReviewQueue.length > 0 && currentReviewIndex >= 0 && reviewOptions && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="border-b border-slate-100 p-6 bg-slate-50 flex-shrink-0">
              <h3 className="text-xl font-extrabold text-slate-900">Review Aggregated Metadata</h3>
              <p className="text-sm text-slate-500 mt-1">
                Book {currentReviewIndex + 1} of {rescanReviewQueue.length}: <span className="text-slate-900 font-semibold">{rescanReviewQueue[currentReviewIndex].title}</span>
              </p>
            </div>

            <div className="bg-indigo-50/50 p-4 border-b border-slate-100 flex items-center gap-3 shadow-inner flex-shrink-0">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                <input 
                  type="text" 
                  placeholder="Incorrect data? Paste an exact Open Library URL here (e.g., https://openlibrary.org/books/OL1234M...)" 
                  value={overrideUrl} 
                  onChange={e => setOverrideUrl(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                />
              </div>
              <button 
                onClick={handleOverrideSync} 
                disabled={isOverriding || !overrideUrl} 
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 whitespace-nowrap hover:bg-indigo-700 transition-colors"
              >
                {isOverriding ? "Syncing URL..." : "Force Sync"}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              
              {reviewOptions.coverIds && reviewOptions.coverIds.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Select Cover Art</label>
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {reviewOptions.coverIds.map((id: number) => (
                      <button 
                        key={id}
                        onClick={() => setReviewCoverId(id)}
                        className={`relative flex-shrink-0 transition-all duration-200 rounded-xl overflow-hidden shadow-sm aspect-[2/3] w-32 ${reviewCoverId === id ? 'ring-4 ring-indigo-500 scale-105 shadow-md' : 'ring-1 ring-slate-200 hover:ring-slate-300 opacity-70 hover:opacity-100'}`}
                      >
                        <img src={`https://covers.openlibrary.org/b/id/${id}-M.jpg`} alt="Cover Option" className="w-full h-full object-cover" />
                        {reviewCoverId === id && (
                          <div className="absolute top-2 right-2 bg-indigo-500 text-white p-1 rounded-full shadow-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    ))}
                    <button 
                      onClick={() => setReviewCoverId(null)}
                      className={`relative flex-shrink-0 flex flex-col items-center justify-center transition-all duration-200 rounded-xl bg-slate-50 aspect-[2/3] w-32 ${reviewCoverId === null ? 'ring-4 ring-indigo-500 scale-105 shadow-md' : 'ring-1 ring-slate-200 hover:ring-slate-300 opacity-70 hover:opacity-100'}`}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 mb-2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No Cover</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-end justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest">Title</label>
                    </div>
                    <input type="text" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                    {reviewOptions.titles && reviewOptions.titles.length > 1 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {reviewOptions.titles.map((t: string, i: number) => (
                          <button key={i} onClick={() => setReviewTitle(t)} className="text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-100 border border-indigo-100 transition-colors">
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">Author</label>
                    <input type="text" value={reviewAuthor} onChange={e => setReviewAuthor(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                    
                    {reviewOptions.authors && reviewOptions.authors.length > 1 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {reviewOptions.authors.map((a: string, i: number) => (
                          <button key={i} onClick={() => setReviewAuthor(a)} className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-100 border border-emerald-100 transition-colors">
                            {a}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Source File Reference</label>
                      <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 flex-shrink-0">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                        <span className="text-[11px] font-mono text-slate-600 truncate flex-1" title={rescanReviewQueue[currentReviewIndex]?.file_key || "No file"}>
                          {rescanReviewQueue[currentReviewIndex]?.file_key || "No digital file attached"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col h-full">
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">Synopsis</label>
                  <textarea value={reviewSynopsis} onChange={e => setReviewSynopsis(e.target.value)} className="w-full flex-1 min-h-[200px] px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 leading-relaxed shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar resize-none transition-all" />
                  {reviewOptions.synopses && reviewOptions.synopses.length > 1 && (
                    <div className="mt-3 flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alternate Descriptions Found:</span>
                      {reviewOptions.synopses.map((s: string, i: number) => (
                        <button key={i} onClick={() => setReviewSynopsis(s)} className="text-left text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg border border-slate-200 transition-colors line-clamp-2">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3 flex-shrink-0">
              <button onClick={advanceReviewQueue} className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
                Reject Changes
              </button>
              <button onClick={handleAcceptMetadata} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2">
                Save Options to Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}