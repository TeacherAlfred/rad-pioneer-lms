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

/**
 * pageNumber is null for EPUB highlights - EPUBs are reflowable and have no
 * stable page number, only a CFI (not persisted here yet). PDFs always pass
 * their real page number.
 *
 * chapterTitle is resolved client-side from the book's own outline (PDF) or
 * table of contents (EPUB) at the moment of highlighting, so a note carries
 * "which chapter" even without a stable page number - the thing you actually
 * want when skimming back for context rather than citing a page.
 *
 * tagIds lets a note be tagged at the moment it's created, while the reason
 * for the highlight is still fresh, rather than only via the after-the-fact
 * picker in the global Notes view. Goes through updateNoteTags so the same
 * vocabulary cap (2 domain + 1 function) is enforced either way.
 */
export async function saveMarginNote(
  bookId: string,
  pageNumber: number | null,
  excerpt: string,
  comment: string,
  tagIds: string[] = [],
  chapterTitle: string | null = null
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_book_notes")
    .insert({
      book_id: bookId,
      page_number: pageNumber,
      excerpt,
      user_comment: comment,
      chapter_title: chapterTitle,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (tagIds.length > 0) {
    await updateNoteTags(data.id, tagIds);
  }
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

export interface NoteWithBook {
  id: string;
  pageNumber: number | null;
  chapterTitle: string | null;
  excerpt: string | null;
  userComment: string;
  createdAt: string | null;
  tagIds: string[];
  book: {
    id: string;
    title: string;
    author: string | null;
    coverKey: string | null;
  };
}

/**
 * Every margin note across the whole library, newest first, joined with its
 * book's context and its own tags. Notes on a vaulted book are excluded
 * unconditionally - the vault is meant to have zero footprint outside
 * itself, and a note excerpt showing up here would defeat that regardless of
 * how the book cover itself is hidden.
 */
export async function getAllNotes(): Promise<NoteWithBook[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_book_notes")
    .select(`
      id, page_number, chapter_title, excerpt, user_comment, created_at,
      rad_books ( id, title, author, cover_key, is_vaulted ),
      rad_book_note_tags ( tag_id )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all notes:", error);
    return [];
  }

  return (data || [])
    .filter((n: any) => n.rad_books && !n.rad_books.is_vaulted)
    .map((n: any) => ({
      id: n.id,
      pageNumber: n.page_number,
      chapterTitle: n.chapter_title,
      excerpt: n.excerpt,
      userComment: n.user_comment,
      createdAt: n.created_at,
      tagIds: (n.rad_book_note_tags || []).map((t: any) => t.tag_id),
      book: {
        id: n.rad_books.id,
        title: n.rad_books.title,
        author: n.rad_books.author,
        coverKey: n.rad_books.cover_key,
      },
    }));
}

export type NoteTagCategory = "domain" | "function";

export interface NoteTagOption {
  id: string;
  name: string;
  category: NoteTagCategory;
}

const MAX_DOMAIN_TAGS_PER_NOTE = 2;
const MAX_FUNCTION_TAGS_PER_NOTE = 1;

/**
 * The closed, two-tier controlled vocabulary notes are tagged from - domain
 * (what it's about) and function (what to do with it). Deliberately excludes
 * uncategorized tags (the older whole-book vocabulary like "robotics") so the
 * note tag picker only ever offers this fixed list, never free invention.
 */
export async function getNoteTagOptions(): Promise<NoteTagOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_tags")
    .select("id, name, category")
    .not("category", "is", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching note tag vocabulary:", error);
    return [];
  }

  return (data || []) as NoteTagOption[];
}

/**
 * Replaces a single note's tags wholesale (clear then insert), same pattern
 * as the book-level updateBookTags in _actions/books.ts. Enforces the
 * vocabulary's hard cap (0-2 domain, 0-1 function) server-side, not just in
 * the picker UI, so the cap holds regardless of caller.
 */
export async function updateNoteTags(noteId: string, tagIds: string[]) {
  const supabase = await createClient();

  if (tagIds.length > 0) {
    const { data: tagRows, error: tagsError } = await supabase
      .from("rad_tags")
      .select("id, category")
      .in("id", tagIds);

    if (tagsError) throw new Error(tagsError.message);

    const domainCount = (tagRows || []).filter((t) => t.category === "domain").length;
    const functionCount = (tagRows || []).filter((t) => t.category === "function").length;

    if (domainCount > MAX_DOMAIN_TAGS_PER_NOTE) {
      throw new Error(`A note can carry at most ${MAX_DOMAIN_TAGS_PER_NOTE} domain tags.`);
    }
    if (functionCount > MAX_FUNCTION_TAGS_PER_NOTE) {
      throw new Error(`A note can carry at most ${MAX_FUNCTION_TAGS_PER_NOTE} function tag.`);
    }
  }

  const { error: deleteError } = await supabase
    .from("rad_book_note_tags")
    .delete()
    .eq("note_id", noteId);

  if (deleteError) throw new Error(deleteError.message);

  if (tagIds.length > 0) {
    const { error: insertError } = await supabase
      .from("rad_book_note_tags")
      .insert(tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId })));

    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/projects/reader-v2/notes");
}

export interface TagHeatEntry {
  id: string;
  name: string;
  category: NoteTagCategory;
  count: number;
}

/**
 * How many (non-vaulted) notes carry each vocabulary tag - the raw signal
 * the heat map sizes itself by, before seasonal focus pinning overrides the
 * ordering. Scoped to the categorized vocabulary only, same reasoning as
 * getNoteTagOptions - the heat map is a view onto that vocabulary, not the
 * older uncategorized book-tag list.
 */
export async function getTagHeatMapData(): Promise<TagHeatEntry[]> {
  const supabase = await createClient();

  const [{ data: tags, error: tagsError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from("rad_tags")
      .select("id, name, category")
      .not("category", "is", null)
      .order("name", { ascending: true }),
    supabase
      .from("rad_book_note_tags")
      .select("tag_id, rad_book_notes ( rad_books ( is_vaulted ) )"),
  ]);

  if (tagsError || !tags) {
    console.error("Error fetching tags for heat map:", tagsError);
    return [];
  }

  const counts = new Map<string, number>();
  (links || []).forEach((link: any) => {
    if (link.rad_book_notes?.rad_books?.is_vaulted) return;
    counts.set(link.tag_id, (counts.get(link.tag_id) || 0) + 1);
  });

  if (linksError) console.error("Error fetching note-tag links for heat map:", linksError);

  return (tags as { id: string; name: string; category: NoteTagCategory }[]).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    count: counts.get(t.id) || 0,
  }));
}

export interface NoteGraphNode {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
  bookCoverKey: string | null;
  excerpt: string | null;
  userComment: string;
  pageNumber: number | null;
  tagIds: string[];
}

export type NoteEdgeReason = "note-tag" | "tag" | "author" | "keyword";

export interface NoteGraphEdge {
  source: string;
  target: string;
  reason: NoteEdgeReason;
}

export interface NotesGraphData {
  nodes: NoteGraphNode[];
  edges: NoteGraphEdge[];
}

const GRAPH_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "this", "that", "these", "those",
  "it", "as", "at", "by", "from", "not", "you", "your", "i", "we", "they",
  "he", "she", "his", "her", "their", "my", "me", "us", "our", "so", "if",
  "when", "what", "which", "who", "how", "just", "like", "than", "then",
  "also", "there", "here", "about", "into", "more", "very", "can", "will",
]);

function keywordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !GRAPH_STOPWORDS.has(w))
  );
}

function keywordOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  a.forEach((w) => { if (b.has(w)) overlap++; });
  return overlap / Math.min(a.size, b.size);
}

const KEYWORD_EDGE_THRESHOLD = 0.35;

/**
 * Connects notes across different books using signals that already exist -
 * no embeddings. Priority order (one edge per pair, strongest reason wins):
 * a tag deliberately put on both notes themselves, a tag shared by their
 * books, the same author, or excerpt/comment keyword overlap. Same-book
 * pairs are skipped deliberately - that grouping already exists in the flat
 * notes view, so the graph is reserved for the more interesting cross-book
 * connections. Vaulted books' notes never enter the graph.
 */
export async function getNotesGraphData(): Promise<NotesGraphData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_book_notes")
    .select(`
      id, page_number, excerpt, user_comment,
      rad_books (
        id, title, author, cover_key, is_vaulted,
        rad_book_tags ( tag_id )
      ),
      rad_book_note_tags ( tag_id )
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching notes graph data:", error);
    return { nodes: [], edges: [] };
  }

  const nodes: NoteGraphNode[] = [];
  const bookTags = new Map<string, Set<string>>();
  const bookAuthor = new Map<string, string>();
  const keywords = new Map<string, Set<string>>();

  data.forEach((n: any) => {
    const book = n.rad_books;
    if (!book || book.is_vaulted) return;

    nodes.push({
      id: n.id,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverKey: book.cover_key,
      excerpt: n.excerpt,
      userComment: n.user_comment,
      pageNumber: n.page_number,
      tagIds: (n.rad_book_note_tags || []).map((t: any) => t.tag_id),
    });

    if (!bookTags.has(book.id)) {
      bookTags.set(book.id, new Set((book.rad_book_tags || []).map((t: any) => t.tag_id)));
    }
    if (book.author) bookAuthor.set(book.id, book.author.toLowerCase().trim());
    keywords.set(n.id, keywordSet(`${n.excerpt || ""} ${n.user_comment || ""}`));
  });

  const edges: NoteGraphEdge[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.bookId === b.bookId) continue;

      if (a.tagIds.length > 0 && b.tagIds.length > 0 && a.tagIds.some((t) => b.tagIds.includes(t))) {
        edges.push({ source: a.id, target: b.id, reason: "note-tag" });
        continue;
      }

      const tagsA = bookTags.get(a.bookId);
      const tagsB = bookTags.get(b.bookId);
      if (tagsA && tagsB && tagsA.size > 0 && [...tagsA].some((t) => tagsB.has(t))) {
        edges.push({ source: a.id, target: b.id, reason: "tag" });
        continue;
      }

      const authorA = bookAuthor.get(a.bookId);
      const authorB = bookAuthor.get(b.bookId);
      if (authorA && authorB && authorA === authorB) {
        edges.push({ source: a.id, target: b.id, reason: "author" });
        continue;
      }

      const score = keywordOverlapScore(keywords.get(a.id)!, keywords.get(b.id)!);
      if (score >= KEYWORD_EDGE_THRESHOLD) {
        edges.push({ source: a.id, target: b.id, reason: "keyword" });
      }
    }
  }

  return { nodes, edges };
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

/**
 * Caches epub.js's generated locations map (book.locations.save()'s output)
 * so a percentage-accurate EPUB progress bar doesn't require re-walking the
 * whole book's text on every open - generated once, on first open, reused
 * from here on every open after.
 */
export async function saveEpubLocations(bookId: string, locations: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rad_books").update({ epub_locations: locations }).eq("id", bookId);
  if (error) throw new Error(error.message);
}