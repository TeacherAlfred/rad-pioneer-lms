// Shared types for learner report cards. See
// supabase/migrations/20261015090000_learner_report_cards.sql for the tables
// and the Learner Report Cards developer spec for the product rules.

export type ReportStatus = 'draft' | 'in_review' | 'published' | 'sent';

// What the staff roster shows per learner. no_data / viewed are derived:
// no_data = no scores captured, viewed = a guardian opened a sent link.
export type RosterState = 'no_data' | 'not_started' | 'draft' | 'in_review' | 'published' | 'sent' | 'viewed';

export type TemplateSection = 'strength' | 'growth' | 'learner_note' | 'whats_next';
export type SectionType = TemplateSection | 'facilitator_note';

export type AttendanceStatus = 'on_track' | 'catch_up';

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
export type FactValue = string | number | boolean | null;
export type Condition = { fact: string; op: ConditionOp; value: FactValue | FactValue[] };
// area: growth templates only - pins the rubric area ("robotics.wiring")
// the goal is about. Without it the learner's weakest area is used.
export type TemplateConditions = { all: Condition[]; area?: string };

export type NarrativeTemplate = {
  id: string;
  key: string;
  section: TemplateSection;
  label: string;
  fields: Record<string, string>;
  conditions: TemplateConditions;
  priority: number;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type RubricLevel = { id: string; key: string; label: string; rank: number };
export type RubricArea = { id: string; key: string; label: string; sort_order: number; descriptors: Record<string, string> };
export type Rubric = {
  id: string;
  subject: string;
  label: string;
  version: number;
  sort_order: number;
  levels: RubricLevel[];
  areas: RubricArea[];
};

// area id -> level id
export type AreaScores = Record<string, string>;

// Everything the generator needs about one learner. Built server-side from
// kids / enrolments / sessions / assessment_scores / lesson_attendance, and
// client-side from a hand-picked sample on the template preview screen.
export type LearnerFacts = {
  firstName: string;
  programmeName: string;
  programmeLine: string;
  periodLabel: string;
  issuedOn: string; // YYYY-MM-DD
  scores: AreaScores;
  lessonsToCatchUp: number;
};

export type SubjectLevel = {
  subject: string;
  subject_label: string;
  level_key: string;
  level_label: string;
  rank: number;
  max_rank: number;
};

export type AssessedBlock = {
  subject: string;
  subject_label: string;
  level_label: string;
  items: { area_key: string; area_label: string; level_label: string; descriptor: string }[];
};

export type ReportSection = {
  id: string;
  type: SectionType;
  template_key: string | null;
  template_version: number | null;
  edited: boolean;
  fields: Record<string, string>;
  // The generated wording, kept so "Reset to template" and the Edited badge
  // work without re-reading a template that may have moved on since.
  original: Record<string, string>;
  // growth only: the rubric area this goal is about, for growth_goals.
  area_id?: string | null;
};

// Shape of report_revisions.content and reports.working_content. Fully
// self-contained (names, descriptors, levels are copied in) so an old
// revision renders exactly as the parent first saw it, whatever happens to
// templates, rubrics or the learner record later.
export type ReportContent = {
  schema: 1;
  learner: { first_name: string };
  programme: { name: string; line: string };
  period_label: string;
  issued_on: string;
  levels: SubjectLevel[];
  lessons_to_catch_up: number;
  status_computed: AttendanceStatus;
  status: AttendanceStatus;
  assessed: AssessedBlock[];
  sections: ReportSection[];
  rubric_version: Record<string, number>;
};

export type ReportRevision = {
  id: string;
  report_id: string;
  revision_no: number;
  content: ReportContent;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
  pdf_key: string | null;
};

export type Report = {
  id: string;
  enrolment_id: string;
  period_label: string;
  status: ReportStatus;
  current_revision_id: string | null;
  published_revision_id: string | null;
  working_content: ReportContent | null;
  working_updated_at: string | null;
  review_comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const FIELD_LIMITS: Record<string, number> = {
  title: 60,
  body: 280,
  bigger_picture: 450,
  now: 280,
  next: 280,
  home: 220,
  text: 160,
};

export const SECTION_FIELDS: Record<SectionType, { key: string; label: string; limit: number }[]> = {
  strength: [
    { key: 'title', label: 'Title', limit: 60 },
    { key: 'body', label: 'Body', limit: 280 },
    { key: 'bigger_picture', label: 'Bigger picture', limit: 450 },
  ],
  growth: [
    { key: 'title', label: 'Title', limit: 60 },
    { key: 'now', label: 'Where they are now', limit: 280 },
    { key: 'next', label: 'Next step', limit: 280 },
    { key: 'home', label: 'Try this at home', limit: 220 },
  ],
  learner_note: [{ key: 'text', label: 'Note to the learner', limit: 160 }],
  whats_next: [{ key: 'text', label: "What's next", limit: 280 }],
  facilitator_note: [{ key: 'text', label: 'Facilitator note', limit: 200 }],
};

export const SECTION_LABELS: Record<SectionType, string> = {
  strength: 'Strength',
  growth: 'Area to grow',
  learner_note: 'A note for the learner',
  whats_next: "What's next",
  facilitator_note: 'Facilitator note',
};

// "Try this at home" and "Lesson progress" are marked version 2 in the
// spec, but the Term 3 online report cards (the prototype artifact) show
// them, so they're on. Flip off to hide both from the parent renderer.
export const REPORT_V2_SECTIONS = true;

export const PARENT_LINK_DAYS = 90;
export const RAD_WHATSAPP_NUMBER = '27769065959';
