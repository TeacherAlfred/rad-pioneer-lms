import { getSeries, SLUG_PATTERN } from '@/content/labs';
import type { AhaCard, Faq, LabChip, LabContent, LabStep, Screenshot } from '@/content/labs/types';

// Server-side guard for content saved from the admin editor. Rebuilds a
// clean LabContent from whatever JSON arrived (unknown keys dropped, strings
// trimmed and capped, image links must be https), and reports what's
// missing in plain language for the editor to show.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function shot(v: unknown): Screenshot {
  const o = obj(v);
  const src = str(o.src, 1000);
  return {
    ...(src ? { src } : {}),
    alt: str(o.alt, 300),
    ...(o.ratio === '4/3' ? { ratio: '4/3' as const } : { ratio: '16/9' as const }),
  };
}

export function validateLabContent(input: unknown, slug: string): { lab: LabContent; errors: string[] } {
  const o = obj(input);
  const errors: string[] = [];

  const seriesKey = str(o.seriesKey, 40);
  const labNumber = Math.max(1, Math.min(999, Math.round(Number(o.labNumber) || 1)));

  const chips: LabChip[] = arr(o.chips).slice(0, 6).map(c => {
    const x = obj(c);
    const info = str(x.info, 400);
    return { icon: str(x.icon, 8), label: str(x.label, 40), ...(x.platform ? { platform: true } : {}), ...(info ? { info } : {}) };
  }).filter(c => c.label);

  const steps: LabStep[] = arr(o.steps).slice(0, 12).map(st => {
    const x = obj(st);
    const callout = str(x.callout);
    return { title: str(x.title, 120), body: str(x.body), screenshot: shot(x.screenshot), ...(callout ? { callout } : {}) };
  });

  const ahaIn = obj(o.aha);
  const cards: AhaCard[] = arr(ahaIn.cards).slice(0, 10).map(c => {
    const x = obj(c);
    const concept = str(x.concept, 40);
    return {
      kind: x.kind === 'tech' ? 'tech' : 'unplugged',
      ...(concept ? { concept } : {}),
      title: str(x.title, 120),
      body: str(x.body, 800),
      image: shot(x.image),
    };
  });

  const faqs: Faq[] = arr(o.faqs).slice(0, 20).map(f => {
    const x = obj(f);
    return { q: str(x.q, 200), a: str(x.a, 1500) };
  }).filter(f => f.q && f.a);

  const context = obj(o.context);
  const walkIn = obj(o.walkthrough);
  const walkHeading = str(walkIn.heading, 120);
  const walkIntro = str(walkIn.intro, 400);
  const reveal = obj(o.reveal);
  const fork = obj(o.fork);
  const workshopProgramCode = str(fork.workshopProgramCode, 20).toUpperCase();

  const lab: LabContent = {
    slug,
    seriesKey,
    labNumber,
    title: str(o.title, 120),
    subtitle: str(o.subtitle, 400),
    seo: { description: str(obj(o.seo).description, 300) },
    chips,
    hook: str(o.hook, 800),
    context: { heading: str(context.heading, 120), body: str(context.body, 1200), screenshot: shot(context.screenshot) },
    // Omitted (page shows the default) until the author sets it.
    ...(walkHeading || walkIntro ? { walkthrough: { heading: walkHeading, intro: walkIntro } } : {}),
    steps,
    aha: { heading: str(ahaIn.heading, 160), intro: str(ahaIn.intro, 600), cards },
    reveal: { eyebrow: str(reveal.eyebrow, 80), concept: str(reveal.concept, 60), body: str(reveal.body, 1200), quote: str(reveal.quote, 600) },
    fork: {
      nextLabTeaser: str(fork.nextLabTeaser, 400),
      waitlistTitle: str(fork.waitlistTitle, 120),
      waitlistBody: str(fork.waitlistBody, 400),
      ...(workshopProgramCode ? { workshopProgramCode } : {}),
    },
    faqs,
  };

  if (!SLUG_PATTERN.test(slug)) errors.push('The lab address (slug) can only use lowercase letters, numbers and dashes.');
  if (!getSeries(seriesKey)) errors.push('Pick a series for this lab.');
  if (!lab.title) errors.push('The lab needs a title.');
  if (!lab.hook) errors.push('The hook (parent intro) is empty.');
  if (lab.walkthrough && !lab.walkthrough.heading) errors.push('The walkthrough section needs a heading.');
  if (lab.steps.length === 0) errors.push('Add at least one walkthrough step.');
  lab.steps.forEach((st, i) => {
    if (!st.title || !st.body) errors.push(`Step ${i + 1} needs a title and instructions.`);
  });
  lab.aha.cards.forEach((c, i) => {
    if (!c.title || !c.body) errors.push(`"Whole life" card ${i + 1} needs a title and text.`);
  });
  if (!lab.reveal.concept) errors.push('The Reveal needs a concept name.');
  const badImage = [lab.context.screenshot, ...lab.steps.map(x => x.screenshot), ...lab.aha.cards.map(x => x.image)]
    .find(x => x.src && !/^https:\/\//.test(x.src));
  if (badImage) errors.push(`Image links must start with https:// (check "${badImage.src}").`);

  return { lab, errors };
}
