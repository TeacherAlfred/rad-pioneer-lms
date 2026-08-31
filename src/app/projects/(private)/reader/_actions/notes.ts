"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveReadingProgress(bookId: string, percentage: number) {
  const supabase = await createClient();
  
  // Automatically determine the status based on progress
  let newStatus = 'unread';
  if (percentage > 0 && percentage < 100) newStatus = 'reading';
  if (percentage === 100) newStatus = 'completed';

  const { error } = await supabase
    .from("rad_books")
    .update({ 
      reading_progress: percentage,
      status: newStatus 
    })
    .eq("id", bookId);

  if (error) throw new Error(error.message);
  revalidatePath("/projects/reader");
}

export async function saveMarginNote(bookId: string, pageNumber: number, excerpt: string, comment: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_book_notes").insert({
    book_id: bookId,
    page_number: pageNumber,
    excerpt,
    user_comment: comment
  });

  if (error) throw new Error(error.message);
}

export async function getBookNotes(bookId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_book_notes")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

/**
 * Silently persists the exact resume position (page number for PDFs, CFI for
 * EPUBs), separate from the manual 0-100 reading_progress field above. Called
 * debounced during reading and once on unmount/visibility change.
 */
export async function saveLastPosition(
  bookId: string,
  position: { lastPageNumber?: number; lastCfi?: string }
) {
  const supabase = await createClient();

  const updates: { last_page_number?: number; last_cfi?: string; last_read_at: string } = {
    last_read_at: new Date().toISOString(),
  };
  if (position.lastPageNumber !== undefined) updates.last_page_number = position.lastPageNumber;
  if (position.lastCfi !== undefined) updates.last_cfi = position.lastCfi;

  const { error } = await supabase
    .from("rad_books")
    .update(updates)
    .eq("id", bookId);

  if (error) throw new Error(error.message);
}