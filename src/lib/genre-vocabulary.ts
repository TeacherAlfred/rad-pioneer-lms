// Curated genre vocabulary for rad_books, mirroring the note-tag controlled
// vocabulary (rad_tags.category = 'domain'|'function') instead of exposing
// raw, noisy Open Library subjects directly. This list is an explicitly
// editable starting point - adding/renaming a category later is a data
// change (a rad_tags row + an entry here), not a schema change, same as
// note tags. Keep this file's slugs in sync with the seed data in
// supabase/migrations/20260907090000_genre_categorization.sql.

export const MAX_GENRES_PER_BOOK = 2;
export const UNCATEGORIZED_GENRE = "uncategorized";

export const CURATED_GENRES = [
  "business-strategy",
  "finance-investing",
  "marketing-sales",
  "entrepreneurship",
  "leadership-management",
  "productivity-habits",
  "psychology-behavior",
  "self-help",
  "biography-memoir",
  "history",
  "science-technology",
  "health-fitness",
  "politics-current-affairs",
  "philosophy",
  "fiction-genre",
  "fiction-literary",
  "religion-spirituality",
  "reference-education",
] as const;

// Ordered most-specific-first: a raw subject is credited to the FIRST
// matching category only (see mapSubjectsToGenres below), so e.g. "science
// fiction" hits fiction-genre before the generic fiction-literary bucket
// (which matches on the bare word "fiction") ever sees it. Noisy Open
// Library subjects ("Protected DAISY", "Large type books", "Overdrive",
// "Accessible book", "In library", "Internet Archive") need no denylist -
// they simply match no keyword below and contribute nothing.
export const GENRE_KEYWORDS: [string, string[]][] = [
  ["fiction-genre", ["science fiction", "fantasy", "thriller", "mystery", "detective", "horror", "romance"]],
  ["finance-investing", ["finance", "investing", "investment", "personal finance", "economics", "stock market"]],
  ["marketing-sales", ["marketing", "advertising", "sales", "branding"]],
  ["entrepreneurship", ["entrepreneurship", "startup", "new business enterprises", "small business"]],
  ["leadership-management", ["leadership", "management", "organizational behavior", "executive"]],
  ["productivity-habits", ["time management", "habit", "productivity", "self-management"]],
  ["psychology-behavior", ["psychology", "behavioral economics", "cognitive", "decision making", "persuasion"]],
  ["business-strategy", ["business", "strategic planning", "corporate", "management science"]],
  ["self-help", ["self-help", "self-improvement", "personal growth", "motivational"]],
  ["biography-memoir", ["biography", "autobiography", "memoir"]],
  ["history", ["history", "historical", "world war", "ancient"]],
  ["science-technology", ["science", "technology", "computers", "artificial intelligence", "physics", "engineering"]],
  ["health-fitness", ["health", "fitness", "nutrition", "diet", "exercise", "medicine"]],
  ["politics-current-affairs", ["politics", "government", "political science", "current events"]],
  ["philosophy", ["philosophy", "ethics", "stoicism", "logic"]],
  ["religion-spirituality", ["religion", "spirituality", "christianity", "buddhism", "faith", "bible"]],
  ["reference-education", ["textbook", "reference", "education", "study guide"]],
  ["fiction-literary", ["fiction", "literary fiction", "novel", "literature"]],
];

// Friendly display names for the shelf's genre filter chips. Falls back to a
// title-cased version of the slug for anything added here later without a
// matching label - see genreLabel() below.
export const GENRE_LABELS: Record<string, string> = {
  "business-strategy": "Business Strategy",
  "finance-investing": "Finance & Investing",
  "marketing-sales": "Marketing & Sales",
  "entrepreneurship": "Entrepreneurship",
  "leadership-management": "Leadership & Management",
  "productivity-habits": "Productivity & Habits",
  "psychology-behavior": "Psychology & Behavior",
  "self-help": "Self-Help",
  "biography-memoir": "Biography & Memoir",
  "history": "History",
  "science-technology": "Science & Technology",
  "health-fitness": "Health & Fitness",
  "politics-current-affairs": "Politics & Current Affairs",
  "philosophy": "Philosophy",
  "fiction-genre": "Genre Fiction",
  "fiction-literary": "Literary Fiction",
  "religion-spirituality": "Religion & Spirituality",
  "reference-education": "Reference & Education",
  [UNCATEGORIZED_GENRE]: "Uncategorized",
};

export function genreLabel(slug: string): string {
  return GENRE_LABELS[slug] || slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Maps raw Open Library subject strings to up to MAX_GENRES_PER_BOOK curated
 * slugs. Case-insensitive substring match; each subject is credited to the
 * first matching category only (not every category it happens to match),
 * then the slugs with the most subject hits win. Caller falls back to
 * [UNCATEGORIZED_GENRE] when this returns an empty array.
 */
export function mapSubjectsToGenres(subjects: string[]): string[] {
  const counts = new Map<string, number>();

  for (const raw of subjects) {
    const s = raw.toLowerCase();
    for (const [slug, keywords] of GENRE_KEYWORDS) {
      if (keywords.some((k) => s.includes(k))) {
        counts.set(slug, (counts.get(slug) || 0) + 1);
        break;
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GENRES_PER_BOOK)
    .map(([slug]) => slug);
}
