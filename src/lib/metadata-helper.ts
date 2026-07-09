import { createClient } from "@/utils/supabase/server";

export interface SuggestedMetadata {
  titles: string[];
  authors: string[];
  synopses: string[];
  coverIds: number[];
  scan_status?: 'pending' | 'success' | 'failed';
}

function cleanFilenameForSearch(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]/g, " ")
    .replace(/(v\d+|final|draft|copy)/gi, "")
    .replace(/by/gi, "")
    .trim();
}

async function queryOpenLibraryOptions(query: string, limit: number = 4) {
  const HEADERS = {
    "User-Agent": "RAD-Pioneer-Library/1.0 (admin@radacademy.co.za)"
  };
  const formattedQuery = encodeURIComponent(`${query} language:eng`);

  try {
    const searchRes = await fetch(`https://openlibrary.org/search.json?q=${formattedQuery}&limit=${limit}`, { headers: HEADERS });
    const searchData = await searchRes.json();
    return searchData.docs && searchData.docs.length > 0 ? searchData.docs : [];
  } catch (error) {
    console.error("Open Library search failed:", error);
    return [];
  }
}

async function extractEditionData(match: any): Promise<{ synopsis: string, coverId: number | null }> {
  let workDesc = "";
  if (match.key) {
    try {
      const workRes = await fetch(`https://openlibrary.org${match.key}.json`);
      const workData = await workRes.json();
      if (workData.description) {
        workDesc = typeof workData.description === 'string' ? workData.description : (workData.description.value || "");
      }
    } catch (err) { /* silent fail */ }
  }

  let editionDesc = "";
  let verifiedCoverId = null;
  const editionKey = match.cover_edition_key || (match.edition_key && match.edition_key[0]);
  
  if (editionKey) {
    try {
      const edRes = await fetch(`https://openlibrary.org/books/${editionKey}.json`);
      const edData = await edRes.json();
      if (edData.description) {
        editionDesc = typeof edData.description === 'string' ? edData.description : (edData.description.value || "");
      }
      if (edData.covers && edData.covers.length > 0) {
        verifiedCoverId = edData.covers[0];
      }
    } catch (err) { /* silent fail */ }
  }

  let finalSynopsis = editionDesc || workDesc || "";
  if (editionDesc && workDesc && editionDesc.trim() !== workDesc.trim()) {
    finalSynopsis = `${editionDesc.trim()}\n\n---MORE---\n\n${workDesc.trim()}`;
  }
  
  return { 
    synopsis: finalSynopsis, 
    coverId: verifiedCoverId || match.cover_i || null 
  };
}

export async function fetchAndStoreBookMetadata(bookId: string, messyFilename: string) {
  const supabase = await createClient();
  const cleanQuery = cleanFilenameForSearch(messyFilename);
  
  try {
    let potentialMatches = await queryOpenLibraryOptions(cleanQuery, 4);

    if (potentialMatches.length === 0) {
      const splitWords = cleanQuery.split(" ");
      if (splitWords.length > 4) {
        const fuzzyQuery = splitWords.slice(0, 4).join(" ");
        potentialMatches = await queryOpenLibraryOptions(fuzzyQuery, 4);
      }
    }

    if (potentialMatches.length === 0) {
      await supabase.from("rad_books").update({ suggested_metadata: { scan_status: 'failed' } }).eq("id", bookId);
      return null;
    }

    const titles = new Set<string>();
    const authors = new Set<string>();
    const synopses = new Set<string>();
    const coverIds = new Set<number>();

    for (const match of potentialMatches) {
      if (match.title) titles.add(match.title);
      if (match.author_name?.[0]) authors.add(match.author_name[0]);

      const { synopsis, coverId } = await extractEditionData(match);
      if (synopsis && synopsis.trim() !== "") synopses.add(synopsis);
      if (coverId) coverIds.add(coverId);
    }

    const suggestion: SuggestedMetadata = {
      titles: Array.from(titles),
      authors: Array.from(authors),
      synopses: Array.from(synopses),
      coverIds: Array.from(coverIds),
      scan_status: 'success',
    };

    await supabase.from("rad_books").update({ suggested_metadata: suggestion }).eq("id", bookId);
    return suggestion;

  } catch (error) {
    console.error(`Helper failed for ${messyFilename}:`, error);
    await supabase.from("rad_books").update({ suggested_metadata: { scan_status: 'failed' } }).eq("id", bookId);
    return null;
  }
}

/**
 * Direct Override: Fetches precise metadata using an exact Open Library Edition URL or ID.
 */
export async function fetchExactOpenLibraryEdition(urlOrId: string) {
  // Extract the specific Edition ID (e.g., OL48794927M)
  const match = urlOrId.match(/OL\d+M/i);
  if (!match) throw new Error("Could not find a valid Open Library Edition ID in the URL.");
  const editionId = match[0].toUpperCase();

  const edRes = await fetch(`https://openlibrary.org/books/${editionId}.json`);
  if (!edRes.ok) throw new Error("Failed to fetch edition data.");
  const edData = await edRes.json();

  let authorName = "Unknown";
  let workDesc = "";

  // 1. Fetch Author Name (Editions usually only link to the author key, so we must resolve it)
  if (edData.authors && edData.authors.length > 0) {
    try {
      const authorKey = edData.authors[0].author?.key || edData.authors[0].key;
      if (authorKey) {
        const authorRes = await fetch(`https://openlibrary.org${authorKey}.json`);
        const authorData = await authorRes.json();
        if (authorData.name) authorName = authorData.name;
      }
    } catch (e) { /* ignore */ }
  }

  // 2. Fetch Work Description (The long synopsis)
  if (edData.works && edData.works.length > 0) {
    try {
      const workKey = edData.works[0].key;
      const workRes = await fetch(`https://openlibrary.org${workKey}.json`);
      const workData = await workRes.json();
      if (workData.description) {
        workDesc = typeof workData.description === 'string' ? workData.description : (workData.description.value || "");
      }
    } catch (e) { /* ignore */ }
  }

  let editionDesc = "";
  if (edData.description) {
    editionDesc = typeof edData.description === 'string' ? edData.description : (edData.description.value || "");
  }

  // Combine Synopses
  let finalSynopsis = editionDesc || workDesc || "";
  if (editionDesc && workDesc && editionDesc.trim() !== workDesc.trim()) {
    finalSynopsis = `${editionDesc.trim()}\n\n---MORE---\n\n${workDesc.trim()}`;
  }

  const coverId = edData.covers && edData.covers.length > 0 ? edData.covers[0] : null;

  return {
    titles: [edData.title],
    authors: [authorName],
    synopses: [finalSynopsis],
    coverIds: coverId ? [coverId] : [],
    scan_status: 'success'
  };
}