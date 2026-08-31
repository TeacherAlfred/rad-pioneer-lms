"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, BookOpen } from "lucide-react";
import { getLibraryBooks, getAllTags, markBookForDeletion, BookWithTags, applyReviewedMetadata, getDuplicateGroups, updateBookTags } from "./_actions/books";
import { getReaderSettings } from "./_actions/settings";
import { autoScanSingleBook } from "./_actions/metadata";
import { publishWipBook } from "./_actions/upload";
import UploadModal from "./_components/upload-modal";
import BookDetailsSheet from "./_components/book-details-sheet";
import ConfirmDialog from "./_components/confirm-dialog";
import LibrarySkeleton from "./_components/library-skeleton";
import EmptyState from "./_components/empty-state";
import BookGrid from "./_components/book-grid";
import BookList from "./_components/book-list";
import { LibraryHeader, LibraryFiltersSidebar } from "./_components/library-toolbar";
import DuplicateFinderModal from "./_components/duplicate-finder-modal";
import TagEditorModal from "./_components/tag-editor-modal";
import RescanReviewModal from "./_components/rescan-review-modal";
import ReadingStreak from "./_components/reading-streak";
import { syncExactOpenLibraryUrl } from "./_actions/metadata";

type TabType = "reading" | "read" | "vip" | "published" | "wip-ready" | "wip-unmatched" | "all";
type SortOption = "title-asc" | "title-desc" | "newest" | "oldest" | "author-asc";
type AlphaFilterType = "none" | "title" | "author";

export default function LibraryDashboard() {
  const searchParams = useSearchParams();
  const [books, setBooks] = useState<BookWithTags[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookWithTags | null>(null);

  // Batch processing states
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [isBatchPublishing, setIsBatchPublishing] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [rescanQueueStatus, setRescanQueueStatus] = useState<{ current: number; total: number; etaSeconds: number | null } | null>(null);

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
  const pinBufferRef = useRef("");
  const vaultPinRef = useRef<string | null>(null);

  // Confirm Dialog State (replaces native confirm())
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const tabs = [
    { id: "reading", label: "Currently Reading" },
    { id: "read", label: "Read" },
    { id: "vip", label: "VIP Books" },
    { id: "published", label: "Library" },
    { id: "wip-ready", label: "Ready" },
    { id: "wip-unmatched", label: "Unmatched" },
    { id: "all", label: "All Volumes" },
  ] as const;

  // PIN now lives in rad_reader_settings (see Settings in the v2 reader),
  // not a hardcoded constant - fetched once and read via ref so the listener
  // doesn't need to re-bind when it loads.
  useEffect(() => {
    getReaderSettings().then((s) => { vaultPinRef.current = s.vaultPin; });
  }, []);

  // Global Key Listener for the Vault
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!/^\d$/.test(e.key)) return;
      const pin = vaultPinRef.current;
      if (!pin) return;

      pinBufferRef.current = (pinBufferRef.current + e.key).slice(-pin.length);
      if (pinBufferRef.current === pin) {
        pinBufferRef.current = "";
        setVaultOpen(true);
        toast.success("Vault storage decrypted successfully.", { className: "!bg-amber-600" });
      }
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

  // Preset filters when arriving via the command palette's "jump to tag/author" links
  useEffect(() => {
    const tag = searchParams.get("tag");
    const author = searchParams.get("author");
    if (tag) {
      setSelectedTag(tag);
      setActiveTab("all");
    }
    if (author) {
      setSelectedAuthor(author);
      setActiveTab("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleDelete = (id: string) => {
    setPendingConfirm({
      title: "Delete this volume?",
      description: "This marks the volume for deletion and removes it from your library view.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await markBookForDeletion(id);
        setBooks((prev) => prev.filter((b) => b.id !== id));
        if (selectedBooks.has(id)) {
          const newSet = new Set(selectedBooks);
          newSet.delete(id);
          setSelectedBooks(newSet);
        }
        toast.success("Volume marked for deletion.");
      },
    });
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

  // Optimistic: apply the new tags to local state and close the modal
  // immediately, reconciling with the server in the background and rolling
  // back only on failure.
  const handleSaveTags = async () => {
    setIsSavingTags(true);
    const targetIds = Array.from(selectedBooks);
    const newTagIds = Array.from(activeEditTags);
    const previousBooks = books;
    const resolvedTags = tags.filter(t => activeEditTags.has(t.id));

    setBooks(prev => prev.map(b => targetIds.includes(b.id) ? { ...b, tags: resolvedTags } : b));
    setIsTagEditorOpen(false);
    setSelectedBooks(new Set());
    toast.success("Collections updated.");

    try {
      await updateBookTags(targetIds, newTagIds);
      await refreshLibrary();
    } catch (e) {
      console.error("Failed to save tags", e);
      setBooks(previousBooks);
      toast.error("Failed to update collections. Changes reverted.");
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

  const handleDeleteDuplicate = (id: string, groupIndex: number) => {
    setPendingConfirm({
      title: "Delete this copy?",
      description: "This removes just this specific file/record from the library.",
      confirmLabel: "Delete",
      onConfirm: async () => {
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
        toast.success("Copy deleted.");
      },
    });
  };

  // --- INTERACTIVE TARGETED RESCAN DIALOGS ---
  const handleBatchRescan = async (targetBooks: BookWithTags[]) => {
    if (targetBooks.length === 0) return;
    setIsBatchScanning(true);
    setRescanQueueStatus({ current: 0, total: targetBooks.length, etaSeconds: null });
    const startedAt = Date.now();

    const scannedQueue: BookWithTags[] = [];
    for (let i = 0; i < targetBooks.length; i++) {
      const book = targetBooks[i];
      const result = await autoScanSingleBook(book.id, book.title || "Unknown Title");
      scannedQueue.push({
        ...book,
        suggested_metadata: (result as any)?.suggested_metadata || (book as any).suggested_metadata
      });

      const completed = i + 1;
      const remaining = targetBooks.length - completed;
      const avgMsPerBook = (Date.now() - startedAt) / completed;
      setRescanQueueStatus({
        current: completed,
        total: targetBooks.length,
        etaSeconds: remaining > 0 ? Math.round((avgMsPerBook * remaining) / 1000) : 0,
      });
    }

    setRescanReviewQueue(scannedQueue);
    setCurrentReviewIndex(0);
    setIsBatchScanning(false);
    setRescanQueueStatus(null);
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
      toast.error("Could not fetch data. Ensure the URL contains a valid Edition ID (e.g., OL...M).");
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
      toast.error("Failed to save changes.");
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

  // Optimistic: flip status out of "wip" immediately so cards leave the WIP
  // tabs right away; per-book failures are rolled back individually and
  // summarized in one toast instead of being silently swallowed.
  const handleBatchPublish = async (targetBooks: BookWithTags[]) => {
    if (targetBooks.length === 0) return;
    setIsBatchPublishing(true);

    const targetIds = new Set(targetBooks.map(b => b.id));
    const previousBooks = books;
    setBooks(prev => prev.map(b => targetIds.has(b.id) ? { ...b, status: 'unread' as const } : b));

    const failures: string[] = [];
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
        failures.push(book.title);
        const original = previousBooks.find(pb => pb.id === book.id);
        if (original) setBooks(prev => prev.map(b => b.id === book.id ? original : b));
      }
    }

    await refreshLibrary();
    setIsBatchPublishing(false);
    setSelectedBooks(new Set());

    const succeeded = targetBooks.length - failures.length;
    if (failures.length === 0) {
      toast.success(`Published ${succeeded}/${targetBooks.length}.`);
    } else {
      toast.error(`Published ${succeeded}/${targetBooks.length} — failed: ${failures.join(", ")}`);
    }
  };

  const readingCount = books.filter(b => b.status === 'reading').length;
  const readCount = books.filter(b => b.status === 'completed').length;
  const vipCount = books.filter(b => (b as any).is_vip).length;
  const publishedCount = books.filter(b => b.status !== 'wip').length;
  const wipReadyCount = books.filter(b => b.status === 'wip' && (b as any).suggested_metadata?.scan_status === 'success').length;
  const wipUnmatchedCount = books.filter(b => b.status === 'wip' && (b as any).suggested_metadata?.scan_status !== 'success').length;
  const uniqueAuthors = Array.from(new Set(books.map(b => b.author || "Unknown Author"))).sort();

  // Approximated from each book's last_read_at (no separate activity log
  // exists yet) - a day counts as "active" if any book was touched that day.
  // This undercounts a streak built entirely on re-reading a single book
  // across days without touching any other, since last_read_at only keeps
  // that book's single most recent timestamp.
  const activeReadingDates = useMemo(() => {
    const dates = new Set<string>();
    books.forEach((b) => {
      const lastReadAt = (b as any).last_read_at;
      if (lastReadAt) dates.add(new Date(lastReadAt).toISOString().slice(0, 10));
    });
    return dates;
  }, [books]);

  // 1. Filter Pipeline Logic
  const filteredBooks = books.filter((book) => {
    const suggested = (book as any).suggested_metadata || {};

    if ((book as any).is_vaulted && !vaultOpen) return false;

    const matchesTab =
      activeTab === "all" ? true :
      activeTab === "reading" ? book.status === "reading" :
      activeTab === "read" ? book.status === "completed" :
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

  const activeReviewBook = rescanReviewQueue[currentReviewIndex];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-[1400px] mx-auto p-6 md:p-10 space-y-8">

        {!loading && <ReadingStreak activeDates={activeReadingDates} />}

        <LibraryHeader
          booksCount={loading ? 0 : books.length}
          alphaFilterType={alphaFilterType}
          setAlphaFilterType={setAlphaFilterType}
          alphaLetter={alphaLetter}
          setAlphaLetter={setAlphaLetter}
          onOpenDuplicates={handleOpenDuplicatesModal}
          groupByAuthor={groupByAuthor}
          setGroupByAuthor={setGroupByAuthor}
          isSortMenuOpen={isSortMenuOpen}
          setIsSortMenuOpen={setIsSortMenuOpen}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onAddVolume={() => setIsUploadModalOpen(true)}
        />

        <div className="flex flex-col md:flex-row gap-10">

          <LibraryFiltersSidebar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedFormat={selectedFormat}
            setSelectedFormat={setSelectedFormat}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
            tags={tags}
            selectedAuthor={selectedAuthor}
            setSelectedAuthor={setSelectedAuthor}
            uniqueAuthors={uniqueAuthors}
          />

          <main className="flex-1 min-w-0 flex flex-col">

            <div className="flex border-b border-slate-200 mb-6 overflow-x-auto custom-scrollbar">
              {tabs.map((tab) => {
                const count =
                  tab.id === 'reading' ? readingCount :
                  tab.id === 'read' ? readCount :
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

            <AnimatePresence>
              {selectedBooks.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="border rounded-[16px] p-3 mb-6 flex flex-wrap items-center justify-between shadow-sm bg-amber-50 border-amber-200 gap-4"
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => selectAllInTab(displayedBookIds)}
                      className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2"
                    >
                      <div className="w-5 h-5 rounded border flex items-center justify-center bg-amber-600 border-amber-600 text-white">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      Deselect All
                    </button>
                    <span className="text-sm font-medium text-slate-500 border-l border-slate-300 pl-4">
                      {selectedBooks.size} selected
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleOpenTagEditor}
                      className="px-5 py-2 bg-amber-100 border border-amber-200 hover:bg-amber-200 text-amber-800 text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                      Edit Tags
                    </button>

                    <button
                      onClick={() => handleBatchRescan(selectedInCurrentView)}
                      disabled={isBatchScanning}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
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
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <LibrarySkeleton />
                </motion.div>
              ) : sortedBooks.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <EmptyState
                    icon={BookOpen}
                    title={activeTab === "reading" ? "Nothing in progress" : "No records found in this view"}
                    subtitle={activeTab === "reading" ? "Open a book from the Library tab to start reading — it'll show up here." : "Try a different tab or clear your filters."}
                  />
                </motion.div>
              ) : viewMode === "list" ? (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <BookList
                    books={paginatedBooks}
                    selectedBooks={selectedBooks}
                    onToggleSelect={toggleSelection}
                    onOpenDetails={setSelectedBookDetails}
                  />
                </motion.div>
              ) : (
                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <BookGrid
                    books={paginatedBooks}
                    groupByAuthor={groupByAuthor}
                    selectedBooks={selectedBooks}
                    onToggleSelect={toggleSelection}
                    onOpenDetails={setSelectedBookDetails}
                    onPublishSuccess={refreshLibrary}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {!loading && sortedBooks.length > 0 && (
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

      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ""}
        description={pendingConfirm?.description || ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        onConfirm={() => {
          pendingConfirm?.onConfirm();
          setPendingConfirm(null);
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <BookDetailsSheet
        book={selectedBookDetails}
        isOpen={!!selectedBookDetails}
        onClose={() => setSelectedBookDetails(null)}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedBookDetails(null);
        }}
        onBookUpdated={(id, patch) => {
          setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
        }}
      />

      <DuplicateFinderModal
        isOpen={isDuplicatesModalOpen}
        isScanning={isScanningDuplicates}
        groups={duplicateGroups}
        onClose={() => setIsDuplicatesModalOpen(false)}
        onDeleteDuplicate={handleDeleteDuplicate}
        onRescan={(book) => handleBatchRescan([book])}
      />

      <TagEditorModal
        isOpen={isTagEditorOpen}
        selectedCount={selectedBooks.size}
        autoSuggestedTags={autoSuggestedTags}
        tags={tags}
        activeEditTags={activeEditTags}
        onToggleTag={toggleEditTag}
        isSaving={isSavingTags}
        onSave={handleSaveTags}
        onClose={() => setIsTagEditorOpen(false)}
      />

      <AnimatePresence>
        {isBatchScanning && rescanQueueStatus && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 bg-white border border-amber-200 shadow-2xl rounded-[16px] p-4 w-72"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Matching Metadata</span>
              <span className="text-[10px] font-mono text-slate-400">{rescanQueueStatus.current} / {rescanQueueStatus.total}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
              <motion.div
                className="bg-amber-500 h-full rounded-full"
                animate={{ width: `${(rescanQueueStatus.current / rescanQueueStatus.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Waiting to avoid rate limits{rescanQueueStatus.etaSeconds !== null ? ` — about ${rescanQueueStatus.etaSeconds}s remaining` : "..."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <RescanReviewModal
        isOpen={rescanReviewQueue.length > 0 && currentReviewIndex >= 0 && !!reviewOptions}
        currentIndex={currentReviewIndex}
        totalCount={rescanReviewQueue.length}
        activeBook={activeReviewBook}
        reviewOptions={reviewOptions}
        reviewTitle={reviewTitle}
        setReviewTitle={setReviewTitle}
        reviewAuthor={reviewAuthor}
        setReviewAuthor={setReviewAuthor}
        reviewSynopsis={reviewSynopsis}
        setReviewSynopsis={setReviewSynopsis}
        reviewCoverId={reviewCoverId}
        setReviewCoverId={setReviewCoverId}
        overrideUrl={overrideUrl}
        setOverrideUrl={setOverrideUrl}
        isOverriding={isOverriding}
        onOverrideSync={handleOverrideSync}
        onReject={advanceReviewQueue}
        onAccept={handleAcceptMetadata}
      />
    </div>
  );
}
