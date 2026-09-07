import { createClient } from "@/utils/supabase/server";
import { findCandidates } from "@/lib/metadata-helper";
import { mapSubjectsToGenres, UNCATEGORIZED_GENRE } from "@/lib/genre-vocabulary";

export interface GenreResult {
  categorization_status: "success" | "needs_review" | "failed";
  matchedSlugs: string[];
  reason?: string;
}

interface GenreMetadata {
  subjects: string[];
  matchedSlugs: string[];
  reason?: string;
  checked_at: string;
}

/**
 * Fetches Open Library subjects for one book, maps them onto the curated
 * genre vocabulary, and replaces the book's genre-category tags with the
 * result. Called once per book by categorizeOneBook (books.ts), driven by a
 * client-side loop in Settings, rather than piggybacking on
 * fetchAndStoreBookMetadata, which already fires on every upload/rescan -
 * folding genre-fetching in there would re-burn Open Library rate-limit
 * budget on books whose genre is already resolved.
 *
 * genreTagIds is a name->id map for every rad_tags row with category =
 * 'genre', fetched once per batch run by the caller rather than once per
 * book.
 */
export async function fetchAndStoreBookGenres(
  bookId: string,
  title: string,
  author: string | null,
  genreTagIds: Map<string, string>
): Promise<GenreResult> {
  const supabase = await createClient();

  try {
    const candidates = await findCandidates(title, author, 4);

    if (candidates.length === 0) {
      const metadata: GenreMetadata = {
        subjects: [],
        matchedSlugs: [],
        reason: "no_ol_candidates",
        checked_at: new Date().toISOString(),
      };
      await supabase
        .from("rad_books")
        .update({ categorization_status: "needs_review", genre_metadata: metadata })
        .eq("id", bookId);
      return { categorization_status: "needs_review", matchedSlugs: [], reason: "no_ol_candidates" };
    }

    const subjects = new Set<string>();
    for (const candidate of candidates.slice(0, 2)) {
      for (const subject of candidate.subject || []) {
        subjects.add(String(subject));
      }
    }

    const subjectList = Array.from(subjects);
    const mapped = mapSubjectsToGenres(subjectList);
    const slugs = mapped.length > 0 ? mapped : [UNCATEGORIZED_GENRE];

    const tagIds = slugs.map((slug) => genreTagIds.get(slug)).filter((id): id is string => !!id);

    // Replace this book's genre tags only - scoped to the genre tag-id set
    // so this never touches free-text whole-book tags in the same join
    // table.
    const allGenreTagIds = Array.from(genreTagIds.values());
    if (allGenreTagIds.length > 0) {
      await supabase.from("rad_book_tags").delete().eq("book_id", bookId).in("tag_id", allGenreTagIds);
    }
    if (tagIds.length > 0) {
      await supabase.from("rad_book_tags").insert(tagIds.map((tag_id) => ({ book_id: bookId, tag_id })));
    }

    const metadata: GenreMetadata = {
      subjects: subjectList,
      matchedSlugs: slugs,
      checked_at: new Date().toISOString(),
    };
    await supabase
      .from("rad_books")
      .update({ categorization_status: "success", genre_metadata: metadata })
      .eq("id", bookId);

    return { categorization_status: "success", matchedSlugs: slugs };
  } catch (error) {
    console.error(`Genre categorization failed for book ${bookId}:`, error);
    const metadata: GenreMetadata = {
      subjects: [],
      matchedSlugs: [],
      reason: "network_error",
      checked_at: new Date().toISOString(),
    };
    await supabase
      .from("rad_books")
      .update({ categorization_status: "failed", genre_metadata: metadata })
      .eq("id", bookId);
    return { categorization_status: "failed", matchedSlugs: [], reason: "network_error" };
  }
}
