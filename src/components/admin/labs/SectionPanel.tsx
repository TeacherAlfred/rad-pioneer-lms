'use client';

import { defaultWalkthrough, getSeries, SERIES } from '@/content/labs';
import type { AhaCard, LabContent, LabStep } from '@/content/labs/types';
import type { EditTarget } from '@/components/labs/LabEditContext';
import { GOTO_STEP_EVENT } from '@/components/labs/StepSlider';
import { ImageField, ItemActions, RichField, TextField } from './LabFields';

// The fields for whichever section's Edit button was clicked. Every change
// goes straight into the draft, so the page beside the panel updates as
// you type.

type Update = (fn: (d: LabContent) => void) => void;

const TITLES: Record<EditTarget['section'], string> = {
  identity: 'Title, subtitle & chips',
  hook: 'Hook (parent intro)',
  context: 'Platform intro',
  walkthrough: 'Walkthrough intro',
  step: 'Walkthrough step',
  aha: '"Whole life" section',
  ahaCard: '"Whole life" card',
  reveal: 'The Reveal',
  fork: 'Next-step cards',
  faqs: 'This lab\'s FAQs',
};

export function panelTitle(t: EditTarget) {
  if (t.section === 'step') return `Step ${t.index + 1}`;
  if (t.section === 'ahaCard') return `"Whole life" card ${t.index + 1}`;
  return TITLES[t.section];
}

function move<T>(list: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

const newStep = (): LabStep => ({ title: 'New step', body: 'What to click, and what the child should see.', screenshot: { alt: 'What the screen shows at this step', ratio: '16/9' } });
const newCard = (): AhaCard => ({ kind: 'unplugged', concept: '', title: 'New example', body: 'How this everyday moment uses the same idea.', image: { alt: 'Photo idea for this example' } });

const sub = 'text-[11px] font-bold uppercase tracking-wider text-slate-400';

export function SectionPanel({
  target, draft, update, retarget,
}: {
  target: EditTarget; draft: LabContent; update: Update; retarget: (t: EditTarget) => void;
}) {
  switch (target.section) {
    case 'identity':
      return (
        <div className="space-y-5">
          <TextField label="Lab title" value={draft.title} onChange={v => update(d => { d.title = v; })} maxLength={120} />
          <TextField label="Subtitle" value={draft.subtitle} onChange={v => update(d => { d.subtitle = v; })} maxLength={400} multiline />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-700" htmlFor="lab-series">Series</label>
              <select id="lab-series" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px]" value={draft.seriesKey} onChange={e => update(d => { d.seriesKey = e.target.value; })}>
                {SERIES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </div>
            <TextField label="Lab number" value={String(draft.labNumber)} onChange={v => update(d => { d.labNumber = Math.max(1, parseInt(v, 10) || 1); })} maxLength={3} />
          </div>
          <TextField label="Search & share description" value={draft.seo.description} onChange={v => update(d => { d.seo.description = v; })} maxLength={300} multiline hint="Shown by Google and in WhatsApp link previews. One or two sentences." />

          <div className="space-y-3">
            <p className={sub}>Header chips</p>
            {draft.chips.map((c, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                <div className="grid grid-cols-[64px_1fr] gap-2">
                  <TextField label="Icon" value={c.icon} onChange={v => update(d => { d.chips[i].icon = v; })} maxLength={8} />
                  <TextField label="Label" value={c.label} onChange={v => update(d => { d.chips[i].label = v; })} maxLength={40} />
                </div>
                <TextField
                  label="Tooltip (why this?)"
                  value={c.info ?? ''}
                  onChange={v => update(d => { d.chips[i].info = v; })}
                  maxLength={400}
                  multiline
                  hint="Shown on hover (desktop) or tap (phone). Leave blank for a plain chip."
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[12px] text-slate-600">
                    <input type="checkbox" checked={!!c.platform} onChange={e => update(d => { d.chips[i].platform = e.target.checked; })} />
                    Platform chip (blue)
                  </label>
                  <button type="button" className="text-[12px] font-semibold text-red-700 hover:underline" onClick={() => update(d => { d.chips.splice(i, 1); })}>Remove</button>
                </div>
              </div>
            ))}
            {draft.chips.length < 6 && (
              <button type="button" className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50" onClick={() => update(d => { d.chips.push({ icon: '•', label: 'New chip', info: '' }); })}>
                + Add chip
              </button>
            )}
          </div>
        </div>
      );

    case 'hook':
      return <RichField label="Hook" value={draft.hook} onChange={v => update(d => { d.hook = v; })} rows={6} maxLength={800} hint="2–3 sentences to the parent. Emotion first: what their child already gets, and what this lab names." />;

    case 'context':
      return (
        <div className="space-y-5">
          <TextField label="Heading" value={draft.context.heading} onChange={v => update(d => { d.context.heading = v; })} maxLength={120} />
          <RichField label="Body" value={draft.context.body} onChange={v => update(d => { d.context.body = v; })} maxLength={1200} hint="Under 80 words: what the platform is, what it costs, what you need." />
          <ImageField label="Screenshot or video" value={draft.context.screenshot} onChange={v => update(d => { d.context.screenshot = v; })} />
        </div>
      );

    case 'walkthrough': {
      // Labs saved before this was editable have no walkthrough yet - start
      // from the same default the page is currently showing.
      const current = draft.walkthrough ?? defaultWalkthrough(getSeries(draft.seriesKey)?.platform ?? 'the editor');
      return (
        <div className="space-y-5">
          <TextField label="Heading" value={current.heading} onChange={v => update(d => { d.walkthrough = { ...current, heading: v }; })} maxLength={120} />
          <RichField
            label="Intro"
            value={current.intro}
            onChange={v => update(d => { d.walkthrough = { ...current, intro: v }; })}
            rows={3}
            maxLength={400}
            hint="The line above the steps. Name the tool this lab uses, e.g. “Keep this page open next to Scratch.”"
          />
        </div>
      );
    }

    case 'step': {
      const i = target.index;
      const step = draft.steps[i];
      if (!step) return <p className="text-sm text-slate-500">This step no longer exists.</p>;
      const go = (index: number) => {
        retarget({ section: 'step', index });
        window.dispatchEvent(new CustomEvent(GOTO_STEP_EVENT, { detail: { index } }));
      };
      return (
        <div className="space-y-5">
          <ItemActions
            index={i}
            count={draft.steps.length}
            noun="step"
            onMove={dir => { update(d => move(d.steps, i, dir)); go(i + dir); }}
            onAddAfter={() => { update(d => { d.steps.splice(i + 1, 0, newStep()); }); go(i + 1); }}
            onRemove={() => { update(d => { d.steps.splice(i, 1); }); go(Math.max(0, i - 1)); }}
          />
          <TextField label="Step title" value={step.title} onChange={v => update(d => { d.steps[i].title = v; })} maxLength={120} />
          <RichField label="Instructions" value={step.body} onChange={v => update(d => { d.steps[i].body = v; })} rows={7} hint="Exactly what to click and what they'll see. Use Link for addresses like makecode.microbit.org - it opens in a new tab." />
          <ImageField label="Screenshot or video" value={step.screenshot} onChange={v => update(d => { d.steps[i].screenshot = v; })} />
          <RichField label="Callout (optional)" value={step.callout ?? ''} onChange={v => update(d => { d.steps[i].callout = v; })} rows={3} hint="The 💡 box under the screenshot: a tip, a 'notice this', or a bonus challenge. Leave blank to hide." />
        </div>
      );
    }

    case 'aha':
      return (
        <div className="space-y-5">
          <TextField label="Heading" value={draft.aha.heading} onChange={v => update(d => { d.aha.heading = v; })} maxLength={160} />
          <RichField label="Intro" value={draft.aha.intro} onChange={v => update(d => { d.aha.intro = v; })} rows={4} maxLength={600} />
          <div className="space-y-2">
            <p className={sub}>Cards</p>
            {draft.aha.cards.map((c, i) => (
              <button key={i} type="button" className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13px] hover:border-violet-300 hover:bg-violet-50/40" onClick={() => retarget({ section: 'ahaCard', index: i })}>
                <span><span className="text-slate-400">{i + 1}.</span> {c.title} <span className="text-slate-400">· {c.kind}</span></span>
                <span className="text-violet-700 font-semibold">Edit</span>
              </button>
            ))}
            <button type="button" className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50" onClick={() => { update(d => { d.aha.cards.push(newCard()); }); retarget({ section: 'ahaCard', index: draft.aha.cards.length }); }}>
              + Add card
            </button>
          </div>
        </div>
      );

    case 'ahaCard': {
      const i = target.index;
      const card = draft.aha.cards[i];
      if (!card) return <p className="text-sm text-slate-500">This card no longer exists.</p>;
      return (
        <div className="space-y-5">
          <ItemActions
            index={i}
            count={draft.aha.cards.length}
            noun="card"
            onMove={dir => { update(d => move(d.aha.cards, i, dir)); retarget({ section: 'ahaCard', index: i + dir }); }}
            onAddAfter={() => { update(d => { d.aha.cards.splice(i + 1, 0, newCard()); }); retarget({ section: 'ahaCard', index: i + 1 }); }}
            onRemove={() => { update(d => { d.aha.cards.splice(i, 1); }); retarget({ section: 'aha' }); }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-700" htmlFor="card-kind">Type</label>
              <select id="card-kind" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px]" value={card.kind} onChange={e => update(d => { d.aha.cards[i].kind = e.target.value as AhaCard['kind']; })}>
                <option value="unplugged">🌿 Unplugged</option>
                <option value="tech">💻 Tech</option>
              </select>
            </div>
            <TextField label="Concept pill" value={card.concept ?? ''} onChange={v => update(d => { d.aha.cards[i].concept = v; })} maxLength={40} placeholder="e.g. If / else" />
          </div>
          <TextField label="Card title" value={card.title} onChange={v => update(d => { d.aha.cards[i].title = v; })} maxLength={120} />
          <RichField label="Text" value={card.body} onChange={v => update(d => { d.aha.cards[i].body = v; })} rows={5} maxLength={800} />
          <ImageField label="Photo or video" value={card.image} onChange={v => update(d => { d.aha.cards[i].image = v; })} />
        </div>
      );
    }

    case 'reveal':
      return (
        <div className="space-y-5">
          <TextField label="Eyebrow" value={draft.reveal.eyebrow} onChange={v => update(d => { d.reveal.eyebrow = v; })} maxLength={80} />
          <TextField label="Concept name (the big words)" value={draft.reveal.concept} onChange={v => update(d => { d.reveal.concept = v; })} maxLength={60} />
          <RichField label="Explanation" value={draft.reveal.body} onChange={v => update(d => { d.reveal.body = v; })} rows={6} maxLength={1200} />
          <RichField label="Quote" value={draft.reveal.quote} onChange={v => update(d => { d.reveal.quote = v; })} rows={4} maxLength={600} />
        </div>
      );

    case 'fork':
      return (
        <div className="space-y-5">
          <TextField label="“Get the next lab” card text" value={draft.fork.nextLabTeaser} onChange={v => update(d => { d.fork.nextLabTeaser = v; })} maxLength={400} multiline />
          <TextField label="Waitlist card title" value={draft.fork.waitlistTitle} onChange={v => update(d => { d.fork.waitlistTitle = v; })} maxLength={120} />
          <TextField label="Waitlist card text" value={draft.fork.waitlistBody} onChange={v => update(d => { d.fork.waitlistBody = v; })} maxLength={400} multiline />
          <TextField
            label="Workshop programme code (optional)"
            value={draft.fork.workshopProgramCode ?? ''}
            onChange={v => update(d => { d.fork.workshopProgramCode = v.toUpperCase(); })}
            maxLength={20}
            placeholder="MCE-101"
            hint="The “Book a seat” card appears on its own whenever a confirmed session of this programme is on sale."
          />
        </div>
      );

    case 'faqs':
      return (
        <div className="space-y-4">
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-[12px] leading-snug text-slate-600">
            These are the <b>This lab</b> questions. The series and “all labs” questions are shared across labs and aren’t edited here yet.
          </p>
          {draft.faqs.map((f, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <TextField label={`Question ${i + 1}`} value={f.q} onChange={v => update(d => { d.faqs[i].q = v; })} maxLength={200} />
              <RichField label="Answer" value={f.a} onChange={v => update(d => { d.faqs[i].a = v; })} rows={4} hint=" " />
              <div className="flex gap-3 text-[12px] font-semibold">
                <button type="button" className="text-slate-600 hover:underline disabled:opacity-40" disabled={i === 0} onClick={() => update(d => move(d.faqs, i, -1))}>Move up</button>
                <button type="button" className="text-slate-600 hover:underline disabled:opacity-40" disabled={i === draft.faqs.length - 1} onClick={() => update(d => move(d.faqs, i, 1))}>Move down</button>
                <button type="button" className="ml-auto text-red-700 hover:underline" onClick={() => { if (window.confirm('Delete this question?')) update(d => { d.faqs.splice(i, 1); }); }}>Delete</button>
              </div>
            </div>
          ))}
          <button type="button" className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50" onClick={() => update(d => { d.faqs.push({ q: 'New question?', a: 'The answer.' }); })}>
            + Add question
          </button>
        </div>
      );
  }
}
