"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server"; // Adjust path to your Supabase server client factory
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME } from "@/lib/storage";

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
  tags: { id: string; name: string }[];
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
          rad_tags (id, name)
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
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
  return data || [];
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
  tags: { id: string; name: string }[];
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