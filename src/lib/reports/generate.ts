// Rules engine for learner report drafts. Pure functions only, so the same
// code runs in the admin API (real learners) and in the browser (template
// preview against a sample learner).
//
// Flow: scores + attendance -> facts -> pick templates whose conditions
// match (lowest priority first) -> fill {{placeholders}} -> ReportContent.
// Facts are never typed by hand; only the wording that comes out of the
// templates is editable afterwards.

import type {
  AreaScores, AssessedBlock, AttendanceStatus, Condition, FactValue, LearnerFacts, NarrativeTemplate,
  ReportContent, ReportSection, Rubric, RubricArea, RubricLevel, SubjectLevel, TemplateSection,
} from './types';

export const MAX_STRENGTHS = 2;

// 0-1 lessons behind is on track, 2+ needs a catch-up (spec suggestion).
export const CATCH_UP_THRESHOLD = 2;

export const PLACEHOLDERS = [
  'first_name', 'programme_name', 'lessons_to_catch_up', 'lessons_word',
  'area_label', 'descriptor_now', 'descriptor_next',
] as const;
type Placeholder = typeof PLACEHOLDERS[number];

export class GenerationError extends Error {}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName.trim();
}

export function attendanceStatus(lessonsToCatchUp: number, threshold = CATCH_UP_THRESHOLD): AttendanceStatus {
  return lessonsToCatchUp >= threshold ? 'catch_up' : 'on_track';
}

// Parent-facing words are soft: never "Behind".
export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  on_track: 'On track',
  catch_up: 'Catch-up needed',
};

function levelById(rubric: Rubric, levelId: string): RubricLevel | undefined {
  return rubric.levels.find(l => l.id === levelId);
}

export function missingAreas(rubrics: Rubric[], scores: AreaScores): { subject: string; area: RubricArea }[] {
  return rubrics.flatMap(r => r.areas.filter(a => !scores[a.id]).map(area => ({ subject: r.label, area })));
}

export function hasAnyScore(rubrics: Rubric[], scores: AreaScores): boolean {
  return rubrics.some(r => r.areas.some(a => !!scores[a.id]));
}

// Subject roll-up: the level nearest the mean area rank, ties rounding up
// (3 of 5 areas Excellent -> Excellent). Null when nothing is scored.
export function subjectLevel(rubric: Rubric, scores: AreaScores): SubjectLevel | null {
  const ranks = rubric.areas
    .map(a => scores[a.id] && levelById(rubric, scores[a.id])?.rank)
    .filter((r): r is number => typeof r === 'number');
  if (!ranks.length || !rubric.levels.length) return null;
  const mean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
  const sorted = [...rubric.levels].sort((a, b) => a.rank - b.rank);
  let best = sorted[0];
  for (const l of sorted) {
    if (Math.abs(l.rank - mean) <= Math.abs(best.rank - mean)) best = l;
  }
  return {
    subject: rubric.subject,
    subject_label: rubric.label,
    level_key: best.key,
    level_label: best.label,
    rank: best.rank,
    max_rank: sorted[sorted.length - 1].rank,
  };
}

type ScoredArea = {
  ref: string; // "robotics.wiring"
  area: RubricArea;
  rubric: Rubric;
  level: RubricLevel;
  subjectRank: number;
};

function scoredAreas(rubrics: Rubric[], scores: AreaScores, levels: SubjectLevel[]): ScoredArea[] {
  const out: ScoredArea[] = [];
  for (const rubric of rubrics) {
    const subjectRank = levels.find(l => l.subject === rubric.subject)?.rank ?? 0;
    for (const area of rubric.areas) {
      const level = scores[area.id] ? levelById(rubric, scores[area.id]) : undefined;
      if (level) out.push({ ref: `${rubric.subject}.${area.key}`, area, rubric, level, subjectRank });
    }
  }
  return out;
}

// Weakest: lowest area level, then the weaker subject, then rubric order.
// Strongest: the mirror image. Picking per area (not per subject) is what
// lets two "Good / Good" learners get different reports once evidence is
// scored per area.
function weakest(areas: ScoredArea[]): ScoredArea | null {
  return [...areas].sort((a, b) =>
    a.level.rank - b.level.rank || a.subjectRank - b.subjectRank
    || a.rubric.sort_order - b.rubric.sort_order || a.area.sort_order - b.area.sort_order)[0] ?? null;
}
function strongest(areas: ScoredArea[]): ScoredArea | null {
  return [...areas].sort((a, b) =>
    b.level.rank - a.level.rank || b.subjectRank - a.subjectRank
    || a.rubric.sort_order - b.rubric.sort_order || a.area.sort_order - b.area.sort_order)[0] ?? null;
}

export type Facts = Record<string, FactValue>;

// Facts available to template conditions:
//   <subject>              level key, e.g. coding = "excellent"
//   <subject>_rank         level rank, e.g. coding_rank = 3
//   all_top_level          every subject at its rubric's top level
//   lessons_to_catch_up    number
//   strongest_area / weakest_area   "subject.area", e.g. "robotics.wiring"
export function buildFacts(levels: SubjectLevel[], areas: ScoredArea[], lessonsToCatchUp: number): Facts {
  const facts: Facts = {
    all_top_level: levels.length > 0 && levels.every(l => l.rank === l.max_rank),
    lessons_to_catch_up: lessonsToCatchUp,
    strongest_area: strongest(areas)?.ref ?? null,
    weakest_area: weakest(areas)?.ref ?? null,
  };
  for (const l of levels) {
    facts[l.subject] = l.level_key;
    facts[`${l.subject}_rank`] = l.rank;
  }
  return facts;
}

export const FACT_NAMES = (rubrics: Pick<Rubric, 'subject'>[]) => [
  ...rubrics.flatMap(r => [r.subject, `${r.subject}_rank`]),
  'all_top_level', 'lessons_to_catch_up', 'strongest_area', 'weakest_area',
];

function matches(c: Condition, facts: Facts): boolean {
  const actual = facts[c.fact];
  const v = c.value;
  switch (c.op) {
    case 'eq': return actual === v;
    case 'neq': return actual !== v;
    case 'in': return Array.isArray(v) && v.includes(actual ?? null);
    case 'gt': case 'gte': case 'lt': case 'lte': {
      if (typeof actual !== 'number' || typeof v !== 'number') return false;
      if (c.op === 'gt') return actual > v;
      if (c.op === 'gte') return actual >= v;
      if (c.op === 'lt') return actual < v;
      return actual <= v;
    }
  }
}

export function conditionsMatch(t: Pick<NarrativeTemplate, 'conditions'>, facts: Facts): boolean {
  return (t.conditions?.all ?? []).every(c => matches(c, facts));
}

export function unknownPlaceholders(text: string): string[] {
  const found = [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map(m => m[1]);
  return found.filter(p => !(PLACEHOLDERS as readonly string[]).includes(p));
}

export function fill(text: string, vars: Record<Placeholder, string>, templateKey: string): string {
  const bad = unknownPlaceholders(text);
  if (bad.length) {
    throw new GenerationError(`Template "${templateKey}" uses unknown placeholder${bad.length > 1 ? 's' : ''} {{${bad.join('}}, {{')}}}. Allowed: ${PLACEHOLDERS.join(', ')}.`);
  }
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, p: Placeholder) => vars[p]);
}

function nextDescriptor(sa: ScoredArea): string {
  const higher = [...sa.rubric.levels].filter(l => l.rank > sa.level.rank).sort((a, b) => a.rank - b.rank)[0];
  return (higher && sa.area.descriptors[higher.key]) || sa.area.descriptors[sa.level.key] || '';
}

function sectionId(type: string, key: string, i: number) {
  return `${type}:${key}:${i}`;
}

export type GenerateInput = {
  rubrics: Rubric[];
  templates: NarrativeTemplate[];
  learner: LearnerFacts;
  facilitatorNote?: string;
};

export function generateContent({ rubrics, templates, learner, facilitatorNote = '' }: GenerateInput): ReportContent {
  if (!hasAnyScore(rubrics, learner.scores)) {
    throw new GenerationError('Assessment pending: no scores have been captured for this learner.');
  }
  const missing = missingAreas(rubrics, learner.scores);
  if (missing.length) {
    throw new GenerationError(`Assessment incomplete: ${missing.map(m => `${m.subject} / ${m.area.label}`).join(', ')} not scored yet.`);
  }

  const levels = rubrics.map(r => subjectLevel(r, learner.scores)).filter((l): l is SubjectLevel => !!l);
  const areas = scoredAreas(rubrics, learner.scores, levels);
  const facts = buildFacts(levels, areas, learner.lessonsToCatchUp);

  const active = templates.filter(t => t.is_active).sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  const matching = (section: TemplateSection) => active.filter(t => t.section === section && conditionsMatch(t, facts));

  const k = learner.lessonsToCatchUp;
  const baseVars = {
    first_name: learner.firstName,
    programme_name: learner.programmeName,
    lessons_to_catch_up: String(k),
    lessons_word: k === 1 ? 'lesson' : 'lessons',
  };
  const varsFor = (sa: ScoredArea | null): Record<Placeholder, string> => ({
    ...baseVars,
    area_label: sa?.area.label ?? '',
    descriptor_now: sa ? sa.area.descriptors[sa.level.key] ?? '' : '',
    descriptor_next: sa ? nextDescriptor(sa) : '',
  });

  const render = (t: NarrativeTemplate, sa: ScoredArea | null) =>
    Object.fromEntries(Object.entries(t.fields).map(([f, text]) => [f, fill(text, varsFor(sa), t.key)]));

  const sections: ReportSection[] = [];
  const push = (type: ReportSection['type'], t: NarrativeTemplate, sa: ScoredArea | null, i: number, extra: Partial<ReportSection> = {}) => {
    const fields = render(t, sa);
    sections.push({
      id: sectionId(type, t.key, i), type, template_key: t.key, template_version: t.version,
      edited: false, fields, original: { ...fields }, ...extra,
    });
  };

  const top = strongest(areas);
  const low = weakest(areas);

  const strengths = matching('strength').slice(0, MAX_STRENGTHS);
  if (!strengths.length) throw new GenerationError('No strength template matches this learner. Add a fallback strength template with no conditions.');
  strengths.forEach((t, i) => push('strength', t, top, i));

  const growth = matching('growth')[0];
  if (!growth) throw new GenerationError('No area-to-grow template matches this learner. Add a fallback growth template with no conditions.');
  const pinned = growth.conditions.area ? areas.find(a => a.ref === growth.conditions.area) ?? null : null;
  const growthArea = pinned ?? low;
  push('growth', growth, growthArea, 0, { area_id: growthArea?.area.id ?? null });

  const note = matching('learner_note')[0];
  if (note) push('learner_note', note, top, 0);

  const next = matching('whats_next')[0];
  if (next) push('whats_next', next, top, 0);

  sections.push({
    id: 'facilitator_note:0', type: 'facilitator_note', template_key: null, template_version: null,
    edited: facilitatorNote.trim() !== '', fields: { text: facilitatorNote }, original: { text: '' },
  });

  const assessed: AssessedBlock[] = rubrics.map(r => {
    const lvl = levels.find(l => l.subject === r.subject);
    return {
      subject: r.subject,
      subject_label: r.label,
      level_label: lvl?.level_label ?? '',
      items: r.areas.map(a => {
        const level = levelById(r, learner.scores[a.id]);
        return {
          area_key: a.key,
          area_label: a.label,
          level_label: level?.label ?? '',
          descriptor: (level && a.descriptors[level.key]) || '',
        };
      }),
    };
  });

  const status = attendanceStatus(k);
  return {
    schema: 1,
    learner: { first_name: learner.firstName },
    programme: { name: learner.programmeName, line: learner.programmeLine },
    period_label: learner.periodLabel,
    issued_on: learner.issuedOn,
    levels,
    lessons_to_catch_up: k,
    status_computed: status,
    status,
    assessed,
    sections,
    rubric_version: Object.fromEntries(rubrics.map(r => [r.subject, r.version])),
  };
}

export function sectionEdited(s: ReportSection): boolean {
  const keys = new Set([...Object.keys(s.fields), ...Object.keys(s.original)]);
  for (const k of keys) if ((s.fields[k] ?? '') !== (s.original[k] ?? '')) return true;
  return false;
}

// Normalise edited flags before a content blob is stored.
export function withEditedFlags(content: ReportContent): ReportContent {
  return { ...content, sections: content.sections.map(s => ({ ...s, edited: sectionEdited(s) })) };
}

export function formatIssued(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function pdfFilename(firstName: string, periodLabel: string) {
  const clean = (x: string) => x.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `RAD-Academy-Report-${clean(firstName)}-${clean(periodLabel)}.pdf`;
}

// Staff edits are merged onto the server's copy, never trusted wholesale:
// facts (levels, lessons, rubric, header) always come from `base`. Only
// section wording, the attendance status override, and adding/removing
// strengths come from the editor.
export function applyEdits(base: ReportContent, incoming: unknown): ReportContent {
  const inc = (incoming && typeof incoming === 'object' ? incoming : {}) as Partial<ReportContent>;
  const incomingSections = Array.isArray(inc.sections) ? inc.sections : [];
  const clean = (fields: unknown, allowed: string[]): Record<string, string> => {
    const f = (fields && typeof fields === 'object' ? fields : {}) as Record<string, unknown>;
    return Object.fromEntries(allowed.map(k => [k, typeof f[k] === 'string' ? (f[k] as string).slice(0, 2000) : '']));
  };
  const allowedFields = (s: ReportSection) => Object.keys({ ...s.original, ...s.fields });

  const sections: ReportSection[] = [];
  for (const raw of incomingSections) {
    const id = typeof raw?.id === 'string' ? raw.id : '';
    if (sections.some(x => x.id === id)) continue;
    const existing = base.sections.find(s => s.id === id);
    if (existing) {
      sections.push({ ...existing, fields: clean(raw.fields, allowedFields(existing)) });
    } else if (raw?.type === 'strength' && id.startsWith('strength:custom:')) {
      const fields = clean(raw.fields, ['title', 'body', 'bigger_picture']);
      sections.push({ id, type: 'strength', template_key: null, template_version: null, edited: true, fields, original: { title: '', body: '', bigger_picture: '' } });
    }
  }
  // Only strengths may be removed; any other section missing from the
  // edit is restored from base.
  for (const s of base.sections) {
    if (s.type !== 'strength' && !sections.some(x => x.id === s.id)) sections.push(s);
  }
  const order: Record<string, number> = { strength: 0, growth: 1, learner_note: 2, whats_next: 3, facilitator_note: 4 };
  sections.sort((a, b) => order[a.type] - order[b.type]);

  const status = inc.status === 'on_track' || inc.status === 'catch_up' ? inc.status : base.status;
  return withEditedFlags({ ...base, sections, status });
}

export function resetSection(s: ReportSection): ReportSection {
  return { ...s, fields: { ...s.original }, edited: false };
}
