import type { Faq } from './types';

// "All labs" FAQ bucket - shown on every lab page.
export const GLOBAL_FAQS: Faq[] = [
  {
    q: 'Is this free?',
    a: 'Yes, every RAD Lab is free to access, complete, and revisit. The platform each lab runs on is also free, with no account needed. The only cost comes when you attend a live workshop, and that is always your choice.',
  },
  {
    q: 'What age group is this for?',
    a: 'Labs are designed for children aged 8–14. The concepts scale in both directions: a curious 7-year-old with a patient parent will keep up, and an older teenager who has never coded will find the first few labs genuinely useful. We don\'t gate by age — we gate by curiosity.',
  },
  {
    q: 'Do we need to buy anything?',
    a: 'Not for the first several labs. Everything runs in the browser — no hardware, no downloads, no subscription. When a series reaches physical projects, we\'ll tell you what you need before the lab opens, with plenty of notice.',
  },
  {
    q: 'My child loses focus quickly. How long does each lab actually take?',
    a: 'The core walkthrough — the steps your child does themselves — is designed for about 20 minutes. The reading around it is for you as the parent and can be read at any pace. The page remembers which step your child reached on this device, so if focus breaks, they can pick up where they left off.',
  },
];

// Per-series FAQ buckets, keyed by LabSeries.key.
export const SERIES_FAQS: Record<string, Faq[]> = {
  makecode: [
    {
      q: 'Do we need a physical Micro:Bit to do this?',
      a: 'Not for the first three labs. Those run entirely in the MakeCode simulator — a virtual Micro:Bit built into the browser. From Lab 4 onwards, projects start using the physical device, and we\'ll give you clear notice before that lab opens. A Micro:Bit costs around R300–R450 from local suppliers.',
    },
    {
      q: 'My child has never coded before. Is MakeCode too hard?',
      a: 'MakeCode uses visual, colour-coded blocks — there\'s no typing of code at all in the early labs. If your child can drag and drop, they can build today. The move from blocks to typed code happens gradually in later labs, with the reason explained before they get there.',
    },
    {
      q: 'Is MakeCode the same as Scratch?',
      a: 'They use the same visual block approach, but the output is different. Scratch creates games and animations on screen. MakeCode compiles to real hardware — the code your child writes in the browser can be loaded onto a Micro:Bit exactly as-is. That direct path to physical hardware is what makes this series different.',
    },
  ],
};
