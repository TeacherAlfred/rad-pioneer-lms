// Per-community landing pages served at /[community] (e.g. /southdowns) -
// one short page for families we met through a school or estate, offering
// a hand-picked subset of existing featured_programs rows. Adding the next
// community is a new entry here, not new code. Pure data on purpose: it's
// imported by the public page, its API route and leadSourceLane.ts alike.
//
// Programs are listed by id rather than tagged via featured_programs.
// location/series - the workshops themselves aren't Southdowns-specific
// (they run in Pretoria for everyone), so tagging the shared rows would
// mislabel every other registration for them.

export type CommunityConfig = {
  slug: string;
  // Eyebrow line - "For <X> families". Deliberately our own wording, not
  // the school's name as a brand: no crest, logo or implied endorsement.
  audienceLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  // Small print at the foot of the page, stating we're independent of the
  // school/estate so the page can't be read as an official one.
  disclaimer: string;
  programIds: string[];
  // leads.source (new leads only) and event_registrations.source (always).
  source: string;
  // Small extra line under the offers, e.g. a market-night bonus. null hides it.
  bonusLine: string | null;
  // Approved Meta template sent to the parent straight after submit. null
  // until approved - the form still works, the admin alert still fires,
  // only the parent's instant WhatsApp is skipped. Body must take exactly
  // two positional values: {{1}} first name, {{2}} chosen session(s).
  confirmTemplate: { name: string; language: string } | null;
};

export const COMMUNITIES: CommunityConfig[] = [
  {
    slug: "southdowns",
    audienceLabel: "For Southdowns families",
    heroTitle: "Which one looks fun?",
    heroSubtitle: "Two hands-on robotics workshops in Pretoria this term. Let your child pick, then leave us your details and we'll sort the rest out on WhatsApp.",
    disclaimer: "RAD Academy runs this page independently. It is not affiliated with or endorsed by Southdowns College.",
    programIds: [
      "17043a46-186e-47e8-8cb5-0bc04f80c33f", // Design It, Wire It, Watch It Work - Gr 4+, Oct 17/18, R1,300
      "e710c84a-6173-4d48-bb87-e3d52e91099d", // Build It, Then Make It Move - under Gr 4, Oct 30/31, R750
    ],
    source: "website_southdowns",
    bonusLine: null,
    confirmTemplate: null,
  },
];

export function getCommunity(slug: string): CommunityConfig | undefined {
  return COMMUNITIES.find(c => c.slug === slug);
}

export const COMMUNITY_SOURCES = new Set(COMMUNITIES.map(c => c.source));
