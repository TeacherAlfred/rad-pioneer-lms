import { createClient } from "@/utils/supabase/server";

export interface SuggestedMetadata {
  titles: string[];
  authors: string[];
  synopses: string[];
  coverIds: number[];
  scan_status?: 'pending' | 'success' | 'needs_review' | 'failed';
  reason?: string;
}

const HEADERS = {
  "User-Agent": "RAD-Pioneer-Library/1.0 (admin@radacademy.co.za)"
};

const KNOWN_EXTENSIONS = /\.(pdf|epub|mobi|azw3?|txt|djvu)$/i;

// Vendor/source tags that Z-Library-style exports append to filenames -
// these were previously being sent to Open Library as literal search terms,
// diluting relevance against every real title/author token.
const VENDOR_GROUP = /\s*[\(\[][^()[\]]*(?:z-?library|z-?lib|1lib|libgen|anna'?s?[- ]?archive)[^()[\]]*[)\]]/gi;

/**
 * 8.3-truncated Windows filenames (e.g. "THESCI~1.PDF", "SLAVEN~1.EPU") carry
 * almost no recoverable information - searching on them just burns an API
 * call for a guaranteed-wrong result. Better to flag these for manual entry
 * up front. Checked against the raw filename with a generic "strip whatever
 * follows the last dot" rule (not the fixed extension whitelist below) since
 * 8.3 truncation frequently mangles the extension too (".EPU" instead of
 * ".epub"), which would otherwise dodge a whitelist-based check.
 */
function isUnrecoverableFilename(rawFilename: string): boolean {
  const base = rawFilename.replace(/\.[^.]*$/, "").trim();
  return /^[A-Z0-9_]{1,8}~\d$/i.test(base);
}

function stripExtension(filename: string): string {
  let name = filename;
  // Handles the occasional double-extension artifact (e.g. "Title.epub.pdf")
  // by stripping known extensions repeatedly, not just the last one.
  while (KNOWN_EXTENSIONS.test(name)) {
    name = name.replace(KNOWN_EXTENSIONS, "");
  }
  return name;
}

function looksLikeAuthorGroup(text: string): boolean {
  const cleaned = text.replace(/\[[^\]]*\]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;

  const bannedWords = /\b(and|the|a|an|of|to|for|with|guide|edition|volume|book|series|part|how|why|what|when|your|from|into)\b/i;
  if (bannedWords.test(cleaned)) return false;

  const capitalizedRatio = words.filter(w => /^[A-Z]/.test(w.replace(/[.,&']/g, ""))).length / words.length;
  return capitalizedRatio >= 0.5;
}

function firstAuthorName(raw: string): string {
  // Collapses "Author [Author]" duplicate-name artifacts and takes just the
  // first name when multiple authors are comma/ampersand-separated, since a
  // single precise name is a stronger search signal than a jumbled list.
  const deduped = raw.replace(/\[[^\]]*\]/g, "").trim();
  return deduped.split(/[,&]| and /i)[0].trim();
}

export interface ParsedFilename {
  title: string;
  author: string | null;
  unrecoverable: boolean;
}

/**
 * Parses the structured shape Z-Library-style filenames actually use:
 *   "{Title} ({Author, Author2}) (z-library.sk, 1lib.sk, z-lib.sk)"
 *   "{Title} by {Author} (z-lib.org)"
 *   "{Title} (Author [Author]) (Z-Library)"
 *   "[Author]-{Title}(z-lib.org)"
 * into a clean { title, author } pair, instead of passing the raw filename
 * through as one free-text search blob.
 */
export function parseFilename(filename: string): ParsedFilename {
  if (isUnrecoverableFilename(filename)) {
    return { title: stripExtension(filename).trim(), author: null, unrecoverable: true };
  }

  // Vendor-tag stripping and the reversed "[Author]-Title" check both need
  // real hyphens intact, so they must run BEFORE hyphens/underscores get
  // turned into spaces below - otherwise "z-lib.org" becomes "z lib.org"
  // and the vendor regex (which expects the hyphen) stops matching.
  let raw = stripExtension(filename).trim();
  raw = raw.replace(VENDOR_GROUP, "").trim();

  const reversedMatch = raw.match(/^\s*\[([^\]]+)\]\s*-\s*(.+)$/);
  if (reversedMatch) {
    return {
      title: reversedMatch[2].replace(/[-_]/g, " ").replace(/\s+/g, " ").trim(),
      author: firstAuthorName(reversedMatch[1]),
      unrecoverable: false,
    };
  }

  let working = raw.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

  // Trailing "(Author, Author2)" group - the last remaining parenthetical,
  // if it looks like a name rather than a subtitle fragment.
  const parenGroups = [...working.matchAll(/\(([^()]+)\)/g)];
  if (parenGroups.length > 0) {
    const last = parenGroups[parenGroups.length - 1];
    if (looksLikeAuthorGroup(last[1])) {
      const author = firstAuthorName(last[1]);
      const title = (working.slice(0, last.index) + working.slice((last.index || 0) + last[0].length)).trim();
      return { title: title.replace(/\s+/g, " ").trim(), author, unrecoverable: false };
    }
  }

  // " by {Author}" form (whole-word boundary - not a blanket substring strip,
  // which previously corrupted titles containing "by", e.g. "Baby"). Allows
  // commas so reversed "Lastname, Firstname" author lists are captured too;
  // firstAuthorName() below picks just the first name out of that.
  const byMatch = working.match(/\bby\s+([A-Z][A-Za-z.,'-]+(?:\s+[A-Za-z.,'-]+){0,6})\s*$/);
  if (byMatch) {
    return {
      title: working.slice(0, byMatch.index).trim(),
      author: firstAuthorName(byMatch[1]),
      unrecoverable: false,
    };
  }

  return { title: working.replace(/[()[\]]/g, "").replace(/\s+/g, " ").trim(), author: null, unrecoverable: false };
}

function stripEditionNoise(title: string): string {
  return title.replace(/,?\s*\d+(st|nd|rd|th)\s+edition\b/gi, "").trim();
}

async function searchOpenLibrary(params: Record<string, string>, limit = 4) {
  const url = new URLSearchParams({
    ...params,
    limit: String(limit),
    fields: "title,author_name,cover_i,cover_edition_key,edition_key,key",
  });

  try {
    const res = await fetch(`https://openlibrary.org/search.json?${url.toString()}`, { headers: HEADERS });
    const data = await res.json();
    return data.docs && data.docs.length > 0 ? data.docs : [];
  } catch (error) {
    console.error("Open Library search failed:", error);
    return [];
  }
}

/**
 * Runs progressively looser q= searches, stopping at the first tier that
 * returns results.
 *
 * Verified against Open Library's live API before shipping this: the
 * structured title=/author= params look like the "correct" precise choice,
 * but they require a near-exact phrase match against the indexed title
 * (e.g. "Head First Python" matches, but "Maynard Keynes An Economists
 * Biography" - the real, full parsed title - returns zero even though the
 * book exists). Free-text q= is Solr's tokenized/fuzzy mode and is far more
 * tolerant of subtitle wording, punctuation, and word order. The actual fix
 * here isn't the query mode - it's that q= was previously being fed raw
 * vendor-tag noise ("z-library.sk 1lib.sk z-lib.sk"). Feeding it the cleanly
 * parsed title/author instead resolves the large majority of cases.
 */
async function findCandidates(title: string, author: string | null, limit = 4) {
  if (author) {
    const tier1 = await searchOpenLibrary({ q: `${title} ${author}` }, limit);
    if (tier1.length > 0) return tier1;
  }

  const tier2 = await searchOpenLibrary({ q: title }, limit);
  if (tier2.length > 0) return tier2;

  const shortTitle = stripEditionNoise(title).split(" ").slice(0, 6).join(" ");
  if (shortTitle && shortTitle !== title) {
    const shortQuery = author ? `${shortTitle} ${author}` : shortTitle;
    const tier3 = await searchOpenLibrary({ q: shortQuery }, limit);
    if (tier3.length > 0) return tier3;
  }

  return [];
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Simple token-overlap (Dice coefficient) similarity, 0-1. */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
  return (2 * overlap) / (wordsA.size + wordsB.size);
}

const CONFIDENCE_THRESHOLD = 0.35;

async function extractEditionData(match: any): Promise<{ synopsis: string, coverId: number | null }> {
  let workDesc = "";
  if (match.key) {
    try {
      const workRes = await fetch(`https://openlibrary.org${match.key}.json`, { headers: HEADERS });
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
      const edRes = await fetch(`https://openlibrary.org/books/${editionKey}.json`, { headers: HEADERS });
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
  const parsed = parseFilename(messyFilename);

  if (parsed.unrecoverable) {
    const failure: SuggestedMetadata = { titles: [], authors: [], synopses: [], coverIds: [], scan_status: 'failed', reason: 'unrecoverable_filename' };
    await supabase.from("rad_books").update({ suggested_metadata: failure }).eq("id", bookId);
    return null;
  }

  try {
    const potentialMatches = await findCandidates(parsed.title, parsed.author, 4);

    if (potentialMatches.length === 0) {
      await supabase.from("rad_books").update({ suggested_metadata: { scan_status: 'failed' } }).eq("id", bookId);
      return null;
    }

    const titles = new Set<string>();
    const authors = new Set<string>();
    const synopses = new Set<string>();
    const coverIds = new Set<number>();

    // Only fetch the expensive work+edition detail (2 extra requests) for
    // the top candidate - the rest stay lightweight (title/author/cover_i
    // already came back from the search call itself).
    for (let i = 0; i < potentialMatches.length; i++) {
      const match = potentialMatches[i];
      if (match.title) titles.add(match.title);
      if (match.author_name?.[0]) authors.add(match.author_name[0]);

      if (i === 0) {
        const { synopsis, coverId } = await extractEditionData(match);
        if (synopsis && synopsis.trim() !== "") synopses.add(synopsis);
        if (coverId) coverIds.add(coverId);
      } else if (match.cover_i) {
        coverIds.add(match.cover_i);
      }
    }

    const topMatch = potentialMatches[0];
    const confidence = topMatch.title ? titleSimilarity(parsed.title, topMatch.title) : 0;

    const suggestion: SuggestedMetadata = {
      titles: Array.from(titles),
      authors: Array.from(authors),
      synopses: Array.from(synopses),
      coverIds: Array.from(coverIds),
      scan_status: confidence >= CONFIDENCE_THRESHOLD ? 'success' : 'needs_review',
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
