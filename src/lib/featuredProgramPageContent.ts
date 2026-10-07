// featured_programs.page_content (migration 20261007090000) - optional
// flyer-style sections for a program's /events/[id] detail page. Every key
// is optional; an empty object means "render from the plain columns only".
export type LearnItem = { title: string; desc: string };
export type Takeaway = { label: string; title: string; desc: string };

export type FeaturedProgramPageContent = {
  eyebrow?: string;
  headline?: string;
  subheading?: string;
  learn_items?: LearnItem[];
  takeaway?: Takeaway;
  quote?: string;
  scarcity_note?: string;
};

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

// Single normaliser for both directions - the admin API runs it before
// writing, the public page runs it on read (the column is untyped jsonb, so
// anything could be in there). Blank strings and half-filled items are
// dropped rather than rendered as empty boxes.
export function normalizePageContent(raw: unknown): FeaturedProgramPageContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: FeaturedProgramPageContent = {};

  const eyebrow = str(r.eyebrow);
  if (eyebrow) out.eyebrow = eyebrow;
  const headline = str(r.headline);
  if (headline) out.headline = headline;
  const subheading = str(r.subheading);
  if (subheading) out.subheading = subheading;
  const quote = str(r.quote);
  if (quote) out.quote = quote;
  const scarcity = str(r.scarcity_note);
  if (scarcity) out.scarcity_note = scarcity;

  if (Array.isArray(r.learn_items)) {
    const items = r.learn_items
      .map(i => (i && typeof i === "object" ? i as Record<string, unknown> : {}))
      .map(i => ({ title: str(i.title) || "", desc: str(i.desc) || "" }))
      .filter(i => i.title);
    if (items.length > 0) out.learn_items = items;
  }

  if (r.takeaway && typeof r.takeaway === "object" && !Array.isArray(r.takeaway)) {
    const t = r.takeaway as Record<string, unknown>;
    const title = str(t.title);
    if (title) out.takeaway = { label: str(t.label) || "", title, desc: str(t.desc) || "" };
  }

  return out;
}

export type HeadlineSegment = { text: string; tone: "plain" | "amber" | "emerald" };

// Headline highlight markup, kept to two tokens an admin can type in a
// plain input: *word* -> amber, _word_ -> emerald. Unmatched markers are
// left as literal text.
export function parseHeadline(headline: string): HeadlineSegment[] {
  const segments: HeadlineSegment[] = [];
  const re = /\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(headline)) !== null) {
    if (m.index > last) segments.push({ text: headline.slice(last, m.index), tone: "plain" });
    if (m[1] !== undefined) segments.push({ text: m[1], tone: "amber" });
    else segments.push({ text: m[2], tone: "emerald" });
    last = m.index + m[0].length;
  }
  if (last < headline.length) segments.push({ text: headline.slice(last), tone: "plain" });
  return segments;
}
