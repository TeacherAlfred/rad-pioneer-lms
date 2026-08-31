"use server";

import { fetchAndStoreBookMetadata } from "@/lib/metadata-helper";
import { revalidatePath } from "next/cache";
import { fetchExactOpenLibraryEdition } from "@/lib/metadata-helper";
import { createClient } from "@/utils/supabase/server";

/**
 * Triggers a targeted metadata search using a user-provided, hand-cleaned query string.
 */
export async function fetchManualMetadata(bookId: string, customQuery: string) {
  try {
    // We pass the customQuery directly to the helper. 
    // It will fetch from Open Library, upload the cover to R2, and update Supabase.
    const result = await fetchAndStoreBookMetadata(bookId, customQuery);
    
    // Force the dashboard to refresh with the new cover/metadata
    revalidatePath("/projects/reader");
    
    return result;
  } catch (error) {
    console.error("Manual metadata fetch failed:", error);
    throw new Error("Failed to fetch metadata.");
  }
}

/**
 * Fetches up to 4 potential matches for a book query without downloading images yet.
 */
export async function searchBookOptions(query: string) {
  try {
    const searchRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=4`);
    const searchData = await searchRes.json();

    if (!searchData.docs || searchData.docs.length === 0) {
      return [];
    }

    return searchData.docs.map((doc: any) => ({
      title: doc.title,
      author: doc.author_name?.[0] || "Unknown",
      publishYear: doc.first_publish_year,
      coverId: doc.cover_i || null, // We save the ID to download securely later
    }));
  } catch (error) {
    console.error("Multi-search failed:", error);
    throw new Error("Failed to search Open Library.");
  }
}

/**
 * Called by the Client-Side Orchestrator to automatically scan a single unmatched book.
 */
export async function autoScanSingleBook(bookId: string, title: string) {
  try {
    await fetchAndStoreBookMetadata(bookId, title);
    // Force the dashboard to refresh immediately after this one book finishes
    revalidatePath("/projects/reader");
    revalidatePath("/projects/reader-v2/inbox");

    // fetchAndStoreBookMetadata writes straight to the DB rather than
    // returning its result - read it back so callers (the v2 inbox review
    // card in particular) can update their local review state without a
    // separate full-list refetch.
    const supabase = await createClient();
    const { data } = await supabase.from("rad_books").select("suggested_metadata").eq("id", bookId).single();

    return { success: true, suggested_metadata: data?.suggested_metadata ?? null };
  } catch (error) {
    console.error("Auto-scan failed:", error);
    return { success: false, suggested_metadata: null };
  }
}

/**
 * Triggers a direct override sync from an Open Library URL.
 */
export async function syncExactOpenLibraryUrl(url: string) {
  try {
    return await fetchExactOpenLibraryEdition(url);
  } catch (error) {
    console.error("Manual URL sync failed:", error);
    return null;
  }
}