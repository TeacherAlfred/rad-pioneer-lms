// Content model for the public /labs/[slug] template. The page never
// hardcodes copy - every lab is one LabContent object, stored as JSON in the
// `labs` table and edited in place at /admin/labs/[slug]. The TS files in
// this folder are seed content only (used until a lab is first saved in the
// admin, and as the fallback if the database is unreachable).
//
// Rich text fields are plain strings with four inline tokens (rendered by
// <Rich/> in src/components/labs/Rich.tsx): **bold**, _emphasis_,
// ==highlighted concept== and [link text](https://...). No raw HTML, so
// nothing here ever needs dangerouslySetInnerHTML - the admin editor's
// toolbar inserts these tokens for the author.

export type Rich = string;

export type ScreenshotRatio = '16/9' | '4/3';

export type Screenshot = {
  // R2 (or any https) image URL. Leave unset/blank until the real image
  // exists - the page renders a labelled placeholder from `alt`, so a lab
  // can ship before its assets.
  src?: string;
  alt: string;
  ratio?: ScreenshotRatio;
};

export type LabStep = {
  title: string;
  body: Rich;
  screenshot: Screenshot;
  callout?: Rich;
};

export type AhaCard = {
  kind: 'unplugged' | 'tech';
  concept?: string;    // pill beside the Unplugged/Tech tag, e.g. 'If / else'
  title: string;
  body: Rich;
  image: Screenshot;
};

export type FaqScope = 'global' | 'series' | 'lab';

export type Faq = {
  q: string;
  a: Rich;
};

export type LabSeries = {
  key: string;         // e.g. 'makecode' - also the series FAQ bucket key
  name: string;        // e.g. 'MakeCode'
  platform: string;    // chip label, e.g. 'MakeCode'
  comingSoon?: boolean;
};

export type LabChip = {
  icon: string;
  label: string;
  platform?: boolean;
  info?: string;       // tooltip: why this time / age / platform / hardware
};

export type LabContent = {
  slug: string;                 // URL + lead source suffix, e.g. 'makecode-01'
  seriesKey: string;
  labNumber: number;
  title: string;
  subtitle: string;
  seo: { description: string };
  chips: LabChip[];
  hook: Rich;
  context: { heading: string; body: Rich; screenshot: Screenshot };
  // Heading + intro above the step slider. Optional so labs saved before it
  // existed keep rendering the default ("Let's build it" / "...next to <platform>").
  walkthrough?: { heading: string; intro: Rich };
  steps: LabStep[];
  // showImages: false = text-only cards (no image slots). Absent means true,
  // so labs saved before the switch existed keep their images.
  aha: { heading: string; intro: Rich; showImages?: boolean; cards: AhaCard[] };
  reveal: { eyebrow: string; concept: string; body: Rich; quote: Rich };
  fork: {
    nextLabTeaser: string;       // Card A body
    waitlistTitle: string;
    waitlistBody: string;
    // programs.code whose next live Session unlocks the "Book a seat" card.
    // Omit when there's no in-person equivalent - Card C then never renders.
    workshopProgramCode?: string;
  };
  faqs: Faq[];                   // "This lab only" bucket
};
