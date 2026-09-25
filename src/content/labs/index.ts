import type { Faq, FaqScope, LabContent, LabSeries } from './types';
import { GLOBAL_FAQS, SERIES_FAQS } from './faq-shared';
import makecode01 from './makecode-01';

// Pure lab helpers, safe to import from both server and client code. The
// live list of labs comes from src/lib/labsRepo.ts (database + these seeds);
// everything here takes that list as an argument rather than reading it.

export const SERIES: LabSeries[] = [
  { key: 'makecode', name: 'MakeCode', platform: 'MakeCode' },
  { key: 'robotics', name: 'Robotics', platform: 'Robotics', comingSoon: true },
  { key: 'scratch', name: 'Scratch', platform: 'Scratch', comingSoon: true },
  { key: 'app-dev', name: 'App Dev', platform: 'App Dev', comingSoon: true },
];

// Seed content - superseded per slug by a `labs` row once saved in the admin.
export const SEED_LABS: LabContent[] = [makecode01];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getSeries(key: string): LabSeries | undefined {
  return SERIES.find(s => s.key === key);
}

export function labsInSeries(labs: LabContent[], seriesKey: string): LabContent[] {
  return labs.filter(l => l.seriesKey === seriesKey).sort((a, b) => a.labNumber - b.labNumber);
}

export function seriesNeighbours(labs: LabContent[], lab: LabContent): { prev?: LabContent; next?: LabContent } {
  const list = labsInSeries(labs, lab.seriesKey);
  const i = list.findIndex(l => l.slug === lab.slug);
  if (i === -1) return {};
  return { prev: list[i - 1], next: list[i + 1] };
}

// Fallback for labs saved before the walkthrough heading/intro were editable.
export function defaultWalkthrough(platform: string) {
  return {
    heading: 'Let\'s build it',
    intro: `Follow along one step at a time. Keep this page open next to ${platform}.`,
  };
}

export type ScopedFaq = Faq & { scope: FaqScope };

export function faqsForLab(lab: LabContent): ScopedFaq[] {
  return [
    ...lab.faqs.map(f => ({ ...f, scope: 'lab' as const })),
    ...(SERIES_FAQS[lab.seriesKey] || []).map(f => ({ ...f, scope: 'series' as const })),
    ...GLOBAL_FAQS.map(f => ({ ...f, scope: 'global' as const })),
  ];
}

// Server-side lead source for a lab - never trusted from the client.
// Prefix 'lab_' is bucketed into the "Labs" lane by src/lib/leadSourceLane.ts.
export function labLeadSource(slug: string, kind: 'optin' | 'help'): string {
  const s = slug.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  return kind === 'help' ? `lab_help_${s}` : `lab_${s}`;
}

// Starting point for a lab created in the admin: every section present with
// placeholder copy, so the author edits in place instead of facing an empty page.
export function blankLab(slug: string, seriesKey: string, labNumber: number, title: string): LabContent {
  const series = getSeries(seriesKey);
  const platform = series?.platform ?? 'the editor';
  const step = (n: number) => ({
    title: `Step ${n} title`,
    body: `Describe exactly what to click and what the child should see. Use ==highlight== for the key idea.`,
    screenshot: { alt: `What the screen looks like at step ${n}`, ratio: '16/9' as const },
  });
  return {
    slug,
    seriesKey,
    labNumber,
    title,
    subtitle: 'One or two sentences on what your child builds and why it matters.',
    seo: { description: `A free RAD Lab: ${title}.` },
    chips: [
      { icon: '⏱', label: '20 min', info: 'How long the hands-on walkthrough takes, including time to experiment.' },
      { icon: '👤', label: 'Ages 8–14', info: 'Why this age range suits the lab.' },
      { icon: '💻', label: platform, platform: true, info: `What ${platform} is, in one sentence.` },
    ],
    hook: 'Two or three sentences that speak to the parent: what their child already understands, and what this lab gives a name to.',
    context: { heading: `What is ${platform}?`, body: 'Under 80 words on the platform: what it is, what it costs, and what you need.', screenshot: { alt: `${platform} at rest`, ratio: '16/9' } },
    walkthrough: defaultWalkthrough(platform),
    steps: [step(1), step(2), step(3), step(4), step(5)],
    aha: {
      heading: 'You\'ve been using this your whole life.',
      intro: 'Where the idea from this lab already shows up in everyday life.',
      cards: [
        { kind: 'unplugged', concept: 'Concept', title: 'Everyday example', body: 'How this everyday moment uses the same idea.', image: { alt: 'Photo idea for this example' } },
        { kind: 'tech', concept: 'Concept', title: 'Tech example', body: 'How this piece of tech uses the same idea.', image: { alt: 'Photo idea for this example' } },
      ],
    },
    reveal: { eyebrow: 'What your child just built', concept: 'Concept name', body: 'Name the concept and explain why it matters, for the parent.', quote: 'A short, memorable line that connects the concept to the real world.' },
    fork: {
      nextLabTeaser: `Lab ${String(labNumber + 1).padStart(2, '0')} drops next week. Leave your WhatsApp number and we'll send it to you when it's ready — just the next lab, no spam.`,
      waitlistTitle: 'See this on real hardware',
      waitlistBody: 'When a workshop opens in your area, you\'ll hear first — before it goes public.',
    },
    faqs: [],
  };
}
