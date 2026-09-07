"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server"; // Adjust path to your Supabase server client factory
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME } from "@/lib/storage";
import { MAX_GENRES_PER_BOOK, UNCATEGORIZED_GENRE } from "@/lib/genre-vocabulary";
import { fetchAndStoreBookGenres } from "@/lib/genre-helper";

export interface BookWithTags {
  id: string;
  title: string;
  author: string | null;
  has_digital: boolean;
  has_physical: boolean;
  file_key: string | null;
  file_type: string | null;
  status: 'wip' | 'unread' | 'reading' | 'completed';
  marked_for_deletion: boolean;
  created_at: string;
  cover_key?: string | null;
  synopsis?: string | null;
  suggested_metadata?: any; 
  is_vip?: boolean;
  is_vaulted?: boolean;
  reading_progress?: number | null;
  last_page_number?: number | null;
  last_cfi?: string | null;
  last_read_at?: string | null;
  tags: { id: string; name: string; category?: string | null }[];
  /** Only populated by getDuplicateGroups() - fetched on-demand from R2, not persisted. */
  fileSizeBytes?: number | null;
}

/**
 * Fetches all books that are not permanently deleted, including their associated tags.
 * Bypasses the 1000-row PostgREST limit by fetching in paginated chunks.
 */
export async function getLibraryBooks(): Promise<BookWithTags[]> {
  const supabase = await createClient();
  
  let allBooks: any[] = [];
  let fetchMore = true;
  let from = 0;
  const step = 1000; // Matches Supabase's default safety limit

  while (fetchMore) {
    const { data, error } = await supabase
      .from("rad_books")
      .select(`
        *,
        rad_book_tags (
          rad_tags (id, name, category)
        )
      `)
      .eq("marked_for_deletion", false)
      .order("created_at", { ascending: false })
      .range(from, from + step - 1); // Fetch the current chunk

    if (error) {
      console.error("Error fetching library books:", error);
      return [];
    }

    if (data && data.length > 0) {
      allBooks = [...allBooks, ...data]; // Append the chunk
      from += step; // Move the cursor forward
      
      // If we got fewer rows than the step, we've hit the end of the table
      if (data.length < step) {
        fetchMore = false;
      }
    } else {
      fetchMore = false;
    }
  }

  // Transform many-to-many response into a clean structure
  return allBooks.map((book: any) => ({
    ...book,
    tags: book.rad_book_tags?.map((bt: any) => bt.rad_tags).filter(Boolean) || [],
  }));
}

/**
 * Fetches all unique tags active across the library for filter dropdowns.
 */
export async function getAllTags() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_tags")
    .select("*")
    .is("category", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
  return data || [];
}

export interface GenreCategorizationStats {
  total: number;
  success: number;
  needsReview: number;
  failed: number;
  pending: number;
  parked: number;
}

/**
 * Counts of rad_books by categorization_status, for the progress readout on
 * the v2 Settings "Genre Categorization" card. Excludes books marked for
 * deletion, same scope as the categorization batch loop.
 */
export async function getGenreCategorizationStats(): Promise<GenreCategorizationStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_books")
    .select("categorization_status")
    .eq("marked_for_deletion", false);

  if (error) {
    console.error("Error fetching categorization stats:", error);
    return { total: 0, success: 0, needsReview: 0, failed: 0, pending: 0, parked: 0 };
  }

  const rows = data || [];
  return {
    total: rows.length,
    success: rows.filter((r) => r.categorization_status === "success").length,
    needsReview: rows.filter((r) => r.categorization_status === "needs_review").length,
    failed: rows.filter((r) => r.categorization_status === "failed").length,
    pending: rows.filter((r) => r.categorization_status === "pending").length,
    parked: rows.filter((r) => r.categorization_status === "parked").length,
  };
}

export interface GenreCategorizeTarget {
  id: string;
  title: string;
  author: string | null;
}

/**
 * Next batch of books needing genre categorization, for the client-driven
 * one-book-per-call loop in Settings. Deliberately not a single server-side
 * loop over the whole batch (that was /api/categorize-genres, since
 * removed) - a 100-book batch at ~1.5s/book is 2.5+ minutes, well past what
 * a serverless function should hold open in one request. Per-book calls
 * keep each round-trip fast and give the client real progress to show.
 */
export async function getBooksToCategorize(limit: number): Promise<GenreCategorizeTarget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_books")
    .select("id, title, author, suggested_metadata")
    .in("categorization_status", ["pending", "failed"])
    .eq("marked_for_deletion", false)
    .limit(limit);

  if (error) {
    console.error("Error fetching books to categorize:", error);
    return [];
  }

  return (data || []).map((b: any) => ({
    id: b.id,
    title: b.suggested_metadata?.titles?.[0] || b.title,
    author: b.suggested_metadata?.authors?.[0] || b.author,
  }));
}

/**
 * Categorizes a single book's genre - the per-book unit the Settings page
 * loop calls repeatedly, same shape as autoScanSingleBook for metadata.
 */
export async function categorizeOneBook(bookId: string, title: string, author: string | null) {
  const supabase = await createClient();
  const { data: genreTags, error } = await supabase.from("rad_tags").select("id, name").eq("category", "genre");
  if (error) throw new Error(`Failed to load genre vocabulary: ${error.message}`);
  const genreTagIds = new Map((genreTags || []).map((t) => [t.name, t.id]));
  return fetchAndStoreBookGenres(bookId, title, author, genreTagIds);
}

export interface GenreReviewBook {
  id: string;
  title: string;
  author: string | null;
  cover_key: string | null;
  categorization_status: string;
  reason: string | null;
  genreTagIds: string[];
}

async function getBooksByCategorizationStatus(statuses: string[]): Promise<GenreReviewBook[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_books")
    .select(`
      id, title, author, cover_key, categorization_status, genre_metadata,
      rad_book_tags ( rad_tags (id, name, category) )
    `)
    .in("categorization_status", statuses)
    .eq("marked_for_deletion", false)
    .order("title", { ascending: true });

  if (error) {
    console.error(`Error fetching books with status in [${statuses.join(", ")}]:`, error);
    return [];
  }

  return (data || []).map((book: any) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    cover_key: book.cover_key,
    categorization_status: book.categorization_status,
    reason: book.genre_metadata?.reason ?? null,
    genreTagIds: (book.rad_book_tags || [])
      .map((bt: any) => bt.rad_tags)
      .filter((t: any) => t && t.category === "genre")
      .map((t: any) => t.id),
  }));
}

/**
 * Books whose automated genre pass didn't land cleanly (no Open Library
 * match, or a transient failure), for the "Needs Review" list on the v2
 * Settings categorization card. Excludes 'parked' books - they were already
 * looked at and set aside deliberately, see parkBookForReview.
 */
export async function getGenreReviewQueue(): Promise<GenreReviewBook[]> {
  return getBooksByCategorizationStatus(["needs_review", "failed"]);
}

/**
 * Books set aside from the Needs Review queue until more information is
 * available - still visible, but out of the way of active review.
 */
export async function getParkedBooks(): Promise<GenreReviewBook[]> {
  return getBooksByCategorizationStatus(["parked"]);
}

/**
 * Sets a book aside from the Needs Review queue without deciding a genre -
 * for a book you can't categorize yet and don't want to keep scrolling past.
 */
export async function parkBookForReview(bookId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_books").update({ categorization_status: "parked" }).eq("id", bookId);
  if (error) throw new Error(`Failed to park book: ${error.message}`);
}

/**
 * Moves a parked book back into the Needs Review queue.
 */
export async function unparkBook(bookId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_books").update({ categorization_status: "needs_review" }).eq("id", bookId);
  if (error) throw new Error(`Failed to move book back to review: ${error.message}`);
}

/**
 * The pickable curated genre vocabulary (excludes the 'uncategorized'
 * catch-all, which is a fallback state, not something to hand-pick).
 */
export async function getGenreOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_tags")
    .select("id, name")
    .eq("category", "genre")
    .neq("name", UNCATEGORIZED_GENRE)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching genre options:", error);
    return [];
  }
  return data || [];
}

/**
 * Manually sets a book's genre(s), same enforcement/replace-scoped-to-genre-
 * tags shape as the automated fetchAndStoreBookGenres pipeline. Falls back
 * to the 'uncategorized' tag if cleared to zero, preserving the invariant
 * that every 'success' book carries at least one genre-category tag.
 */
export async function setBookGenres(bookId: string, genreTagIds: string[]): Promise<void> {
  const supabase = await createClient();

  const { data: genreTags, error: tagsError } = await supabase
    .from("rad_tags")
    .select("id, name")
    .eq("category", "genre");
  if (tagsError) throw new Error(`Failed to load genre vocabulary: ${tagsError.message}`);

  const allGenreTags = genreTags || [];
  const validIds = new Set(allGenreTags.map((t) => t.id));
  const idToName = new Map(allGenreTags.map((t) => [t.id, t.name]));
  const uncategorizedTag = allGenreTags.find((t) => t.name === UNCATEGORIZED_GENRE);

  const cleanIds = genreTagIds.filter((id) => validIds.has(id) && idToName.get(id) !== UNCATEGORIZED_GENRE);
  if (cleanIds.length > MAX_GENRES_PER_BOOK) {
    throw new Error(`A book can carry at most ${MAX_GENRES_PER_BOOK} genres.`);
  }

  const finalIds = cleanIds.length > 0 ? cleanIds : uncategorizedTag ? [uncategorizedTag.id] : [];

  const allGenreTagIds = Array.from(validIds);
  if (allGenreTagIds.length > 0) {
    await supabase.from("rad_book_tags").delete().eq("book_id", bookId).in("tag_id", allGenreTagIds);
  }
  if (finalIds.length > 0) {
    await supabase.from("rad_book_tags").insert(finalIds.map((tag_id) => ({ book_id: bookId, tag_id })));
  }

  const matchedSlugs = finalIds.map((id) => idToName.get(id)).filter((n): n is string => !!n);
  const { error: updateError } = await supabase
    .from("rad_books")
    .update({
      categorization_status: "success",
      genre_metadata: { subjects: [], matchedSlugs, reason: "manual_override", checked_at: new Date().toISOString() },
    })
    .eq("id", bookId);
  if (updateError) throw new Error(`Failed to save genres: ${updateError.message}`);
}

/**
 * Corrects a book's title/author directly - for the Needs Review queue,
 * where the automated genre pass may have had nothing to search against
 * because the parsed-from-filename title/author was wrong, independent of
 * whether an Open Library match is ever found.
 */
export async function updateBookBasicInfo(bookId: string, title: string, author: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rad_books")
    .update({ title: title.trim(), author: author.trim() || null })
    .eq("id", bookId);
  if (error) throw new Error(`Failed to update book: ${error.message}`);
}

/**
 * Applies a hand-reviewed Open Library override in one step: full metadata
 * (title/author/synopsis/cover, via the same accept path the Rescan Review
 * modal uses) plus genre tags. Nothing is written until this is called -
 * fetching a URL's data for preview (syncExactOpenLibraryUrl) is a separate,
 * read-only step, so the admin always reviews before anything is permanent.
 */
export async function applyOpenLibraryOverride(
  bookId: string,
  fields: { title: string; author: string; synopsis: string; coverId: number | null; genreTagIds: string[] }
): Promise<void> {
  await applyReviewedMetadata(bookId, fields.title, fields.author, fields.synopsis, fields.coverId);
  await setBookGenres(bookId, fields.genreTagIds);
}

// --- BOOK VERIFICATION (cover/title/author sanity check, separate from
// genre categorization) ---

export interface VerifyBook {
  id: string;
  title: string;
  author: string | null;
  cover_key: string | null;
  file_type: string | null;
  created_at: string;
}

export interface VerificationStats {
  total: number;
  verified: number;
  parked: number;
  pending: number;
}

export type VerificationSort = "title" | "created_at" | "author";

export async function getVerificationStats(): Promise<VerificationStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_books")
    .select("verification_status")
    .eq("marked_for_deletion", false)
    .neq("status", "wip");

  if (error) {
    console.error("Error fetching verification stats:", error);
    return { total: 0, verified: 0, parked: 0, pending: 0 };
  }

  const rows = data || [];
  return {
    total: rows.length,
    verified: rows.filter((r) => r.verification_status === "verified").length,
    parked: rows.filter((r) => r.verification_status === "parked").length,
    pending: rows.filter((r) => r.verification_status === "pending").length,
  };
}

async function getBooksByVerificationStatus(status: string, sortBy: VerificationSort): Promise<VerifyBook[]> {
  const supabase = await createClient();
  const column = sortBy === "created_at" ? "created_at" : sortBy;
  const { data, error } = await supabase
    .from("rad_books")
    .select("id, title, author, cover_key, file_type, created_at")
    .eq("verification_status", status)
    .eq("marked_for_deletion", false)
    .neq("status", "wip")
    .order(column, { ascending: true });

  if (error) {
    console.error(`Error fetching books with verification_status=${status}:`, error);
    return [];
  }
  return data || [];
}

/**
 * The sequential review queue for the Settings "Verify Books" card - only
 * books never looked at. Verified/parked books are excluded so a verified
 * book never reappears, matching the "shouldn't reappear" requirement.
 */
export async function getBooksToVerify(sortBy: VerificationSort): Promise<VerifyBook[]> {
  return getBooksByVerificationStatus("pending", sortBy);
}

export async function getParkedVerificationBooks(): Promise<VerifyBook[]> {
  return getBooksByVerificationStatus("parked", "title");
}

export async function markBookVerified(bookId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_books").update({ verification_status: "verified" }).eq("id", bookId);
  if (error) throw new Error(`Failed to mark book verified: ${error.message}`);
}

export async function parkBookVerification(bookId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_books").update({ verification_status: "parked" }).eq("id", bookId);
  if (error) throw new Error(`Failed to park book: ${error.message}`);
}

export async function unparkBookVerification(bookId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_books").update({ verification_status: "pending" }).eq("id", bookId);
  if (error) throw new Error(`Failed to move book back to verification: ${error.message}`);
}

/**
 * Resets every VERIFIED book back to 'pending' so the queue includes them
 * again. Deliberately leaves 'parked' books untouched - parking is a
 * separate, deliberate "not yet" decision that a blanket reverify shouldn't
 * silently undo; a parked book is still reachable via its own unpark action.
 */
export async function reverifyAllBooks(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rad_books")
    .update({ verification_status: "pending" })
    .eq("verification_status", "verified");
  if (error) throw new Error(`Failed to reset verification: ${error.message}`);
}

/**
 * Soft-deletes a book by switching its marked_for_deletion flag.
 */
export async function markBookForDeletion(bookId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("rad_books")
    .update({ marked_for_deletion: true })
    .eq("id", bookId);

  if (error) throw new Error(error.message);
  
  revalidatePath("/projects/reader");
}

/**
 * Logs a new recommendation or book request directly into the sourcing wishlist.
 */
export async function addToWishlist(title: string, author: string, sourcedFromBookId?: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("rad_wishlist")
    .insert({
      title,
      author: author || null,
      sourced_from_book_id: sourcedFromBookId || null,
      status: "pending",
    });

  if (error) throw new Error(error.message);
  
  revalidatePath("/projects/reader");
}

/**
 * Fetches a single book by its ID for the reader interface.
 */
export async function getBookById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_books")
    .select(`
      *,
      rad_book_tags (
        rad_tags (id, name)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    tags: data.rad_book_tags?.map((bt: any) => bt.rad_tags).filter(Boolean) || [],
  };
}

export async function toggleBookStatus(bookId: string, updates: { is_vip?: boolean, is_vaulted?: boolean, status?: 'unread' | 'reading' | 'completed' }) {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_books").update(updates).eq("id", bookId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects/reader");
}

export async function updateBookCover(bookId: string, newCoverKey: string) {
  const supabase = await createClient();
  await supabase.from("rad_books").update({ cover_key: newCoverKey }).eq("id", bookId);
  revalidatePath("/projects/reader");
}

/**
 * Saves accepted and edited metadata from the rescan review modal directly to the book.
 */
export async function updateBookCoreData(bookId: string, title: string, author: string, synopsis: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rad_books")
    .update({ 
      title, 
      author: author || null, 
      synopsis: synopsis || null 
    })
    .eq("id", bookId);

  if (error) throw new Error(error.message);
  revalidatePath("/projects/reader");
}

/**
 * Saves accepted metadata from the rescan review modal and securely downloads the selected cover.
 */
export async function applyReviewedMetadata(bookId: string, title: string, author: string, synopsis: string, coverId: number | null) {
  const supabase = await createClient();
  let coverKey = null;

  // Only run the download if a cover was selected
  if (coverId) {
    const coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
    const imageRes = await fetch(coverUrl);
    
    if (imageRes.ok) {
      const buffer = Buffer.from(await imageRes.arrayBuffer());
      coverKey = `covers/${bookId}_${Date.now()}.jpg`;
      
      await r2Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME, 
        Key: coverKey, 
        Body: buffer, 
        ContentType: "image/jpeg",
      }));
    }
  }

  const updates: any = { 
    title, 
    author: author || null, 
    synopsis: synopsis || null 
  };
  
  if (coverKey) updates.cover_key = coverKey;

  const { error } = await supabase
    .from("rad_books")
    .update(updates)
    .eq("id", bookId);

  if (error) throw new Error(error.message);
  revalidatePath("/projects/reader");
}

/**
 * Scans the entire library and returns arrays of books that share the same Title and Author.
 */
export async function getDuplicateGroups(): Promise<BookWithTags[][]> {
  const allBooks = await getLibraryBooks(); // Re-use your existing fetcher
  
  const groups: Record<string, BookWithTags[]> = {};
  
  allBooks.forEach(book => {
    // Normalize text to prevent "Title" and "title " from appearing as separate books
    const titleKey = (book.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const authorKey = (book.author || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `${titleKey}-${authorKey}`;
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(book);
  });

  // Filter to only return groups that have 2 or more copies
  const duplicates = Object.values(groups).filter(group => group.length > 1);

  // Sort alphabetically by title
  duplicates.sort((a, b) => (a[0].title || "").localeCompare(b[0].title || ""));

  // File size isn't stored anywhere - fetch it on-demand from R2, scoped only
  // to files already in a flagged duplicate group (bounded by duplicate
  // count, not library size), for the side-by-side diff cards.
  await Promise.all(
    duplicates.flatMap(group =>
      group.map(async (book) => {
        if (!book.file_key) return;
        try {
          const head = await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: book.file_key }));
          book.fileSizeBytes = head.ContentLength ?? null;
        } catch {
          book.fileSizeBytes = null;
        }
      })
    )
  );

  return duplicates;
}

/**
 * Updates the tags for a batch of books.
 * Wipes existing tags for the selected books and inserts the new relationships.
 */
export async function updateBookTags(bookIds: string[], tagIds: string[]) {
  const supabase = await createClient();

  // 1. Clear existing tags for these books to ensure a clean slate
  const { error: deleteError } = await supabase
    .from("rad_book_tags")
    .delete()
    .in("book_id", bookIds);

  if (deleteError) throw new Error(deleteError.message);

  // 2. Insert the new tag mappings
  if (tagIds.length > 0) {
    const insertPayload = bookIds.flatMap(bookId => 
      tagIds.map(tagId => ({ book_id: bookId, tag_id: tagId }))
    );

    const { error: insertError } = await supabase
      .from("rad_book_tags")
      .insert(insertPayload);

    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/projects/reader");
}

/**
 * Updates the format flags (digital/physical) for a specific book.
 */
export async function updateBookFormat(bookId: string, has_digital: boolean, has_physical: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rad_books")
    .update({ has_digital, has_physical })
    .eq("id", bookId);

  if (error) throw new Error(error.message);
  revalidatePath("/projects/reader");
}

export interface CommandPaletteBook {
  id: string;
  title: string;
  author: string | null;
  status: BookWithTags['status'];
  tags: { id: string; name: string; category?: string | null }[];
}

/**
 * Trimmed index for the command palette - excludes synopsis/suggested_metadata/
 * cover_key etc. since those aren't needed to render or filter results, and
 * excludes WIP books since /projects/reader/[bookId] 404s on those. Paginated
 * the same way as getLibraryBooks() to avoid silently truncating past the
 * 1000-row PostgREST default on a large library.
 */
export async function getCommandPaletteIndex(): Promise<CommandPaletteBook[]> {
  const supabase = await createClient();

  let allBooks: any[] = [];
  let fetchMore = true;
  let from = 0;
  const step = 1000;

  while (fetchMore) {
    const { data, error } = await supabase
      .from("rad_books")
      .select(`
        id, title, author, status,
        rad_book_tags ( rad_tags (id, name) )
      `)
      .eq("marked_for_deletion", false)
      .neq("status", "wip")
      .order("title", { ascending: true })
      .range(from, from + step - 1);

    if (error) {
      console.error("Error fetching command palette index:", error);
      return [];
    }

    if (data && data.length > 0) {
      allBooks = [...allBooks, ...data];
      from += step;
      if (data.length < step) fetchMore = false;
    } else {
      fetchMore = false;
    }
  }

  return allBooks.map((book: any) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    status: book.status,
    tags: book.rad_book_tags?.map((bt: any) => bt.rad_tags).filter(Boolean) || [],
  }));
}