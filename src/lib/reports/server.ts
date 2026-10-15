import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  GenerationError, firstNameOf, generateContent, hasAnyScore, withEditedFlags,
} from './generate';
import type {
  AreaScores, LearnerFacts, NarrativeTemplate, Report, ReportContent, ReportRevision, ReportStatus,
  Rubric, RosterState,
} from './types';
import { PARENT_LINK_DAYS } from './types';

// Server-side data access for learner report cards. Every read/write goes
// through the service-role client: the report tables are RLS-locked with no
// anon policies (see the migration), so the /admin API and the /r/[token]
// server page are the only ways in.

const db = () => supabaseAdmin();

export { GenerationError };

// ---------------------------------------------------------------------------
// Rubrics and templates
// ---------------------------------------------------------------------------

type RubricRow = {
  id: string; subject: string; label: string; version: number; sort_order: number;
  rubric_levels: { id: string; key: string; label: string; rank: number }[];
  rubric_areas: {
    id: string; key: string; label: string; sort_order: number;
    rubric_descriptors: { level_id: string; text: string }[];
  }[];
};

export async function loadRubrics(): Promise<Rubric[]> {
  const { data, error } = await db()
    .from('rubrics')
    .select('id, subject, label, version, sort_order, rubric_levels(id, key, label, rank), rubric_areas(id, key, label, sort_order, rubric_descriptors(level_id, text))')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return ((data ?? []) as RubricRow[]).map(r => {
    const levels = [...r.rubric_levels].sort((a, b) => a.rank - b.rank);
    return {
      id: r.id, subject: r.subject, label: r.label, version: r.version, sort_order: r.sort_order, levels,
      areas: [...r.rubric_areas].sort((a, b) => a.sort_order - b.sort_order).map(a => ({
        id: a.id, key: a.key, label: a.label, sort_order: a.sort_order,
        descriptors: Object.fromEntries(a.rubric_descriptors.map(d => [levels.find(l => l.id === d.level_id)?.key ?? d.level_id, d.text])),
      })),
    };
  });
}

export async function loadTemplates(opts: { includeInactive?: boolean } = {}): Promise<NarrativeTemplate[]> {
  let q = db().from('narrative_templates').select('*').order('section').order('priority').order('version', { ascending: false });
  if (!opts.includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as NarrativeTemplate[];
}

// ---------------------------------------------------------------------------
// Programme run (a sessions row) with its learners
// ---------------------------------------------------------------------------

export type RunSummary = {
  id: string;
  starts_at: string | null;
  status: string;
  lessons_planned: number | null;
  venue_label: string | null;
  programme: { id: string; name: string; code: string; type: string } | null;
};

type SessionRow = {
  id: string; starts_at: string | null; status: string; lessons_planned: number | null; venue: string | null;
  venues: { name: string } | null; programs: { id: string; name: string; code: string; type: string } | null;
};

const SESSION_SELECT = 'id, starts_at, status, lessons_planned, venue, venues(name), programs(id, name, code, type)';

function toRun(s: SessionRow): RunSummary {
  return {
    id: s.id, starts_at: s.starts_at, status: s.status, lessons_planned: s.lessons_planned,
    venue_label: s.venues?.name ?? s.venue ?? null, programme: s.programs,
  };
}

export async function listRuns(): Promise<(RunSummary & { learner_count: number; report_count: number })[]> {
  const { data, error } = await db()
    .from('sessions')
    .select(`${SESSION_SELECT}, enrolments(id, status)`)
    .is('parent_session_id', null)
    .order('starts_at', { ascending: false, nullsFirst: false })
    .limit(150);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as (SessionRow & { enrolments: { id: string; status: string }[] })[];
  const withLearners = rows.filter(r => r.enrolments.some(e => e.status !== 'withdrawn'));
  const enrolmentIds = withLearners.flatMap(r => r.enrolments.map(e => e.id));
  const reportCounts = new Map<string, number>();
  if (enrolmentIds.length) {
    const { data: reps } = await db().from('reports').select('enrolment_id').in('enrolment_id', enrolmentIds);
    const runByEnrolment = new Map(withLearners.flatMap(r => r.enrolments.map(e => [e.id, r.id] as const)));
    for (const rep of (reps ?? []) as { enrolment_id: string }[]) {
      const runId = runByEnrolment.get(rep.enrolment_id);
      if (runId) reportCounts.set(runId, (reportCounts.get(runId) ?? 0) + 1);
    }
  }
  return withLearners.map(r => ({
    ...toRun(r),
    learner_count: r.enrolments.filter(e => e.status !== 'withdrawn').length,
    report_count: reportCounts.get(r.id) ?? 0,
  }));
}

export async function loadRun(sessionId: string): Promise<RunSummary | null> {
  const { data } = await db().from('sessions').select(SESSION_SELECT).eq('id', sessionId).maybeSingle();
  return data ? toRun(data as unknown as SessionRow) : null;
}

export type AttendanceRow = { enrolment_id: string; lesson_no: number; present: boolean; caught_up_on: string | null };

export function lessonsToCatchUp(rows: Pick<AttendanceRow, 'present' | 'caught_up_on'>[]): number {
  return rows.filter(r => !r.present && !r.caught_up_on).length;
}

export type RosterLearner = {
  enrolment_id: string;
  kid_id: string;
  name: string;
  first_name: string;
  scores: AreaScores;
  scored_count: number;
  assessed_on: string | null;
  attendance: AttendanceRow[];
  lessons_to_catch_up: number;
  report: Pick<Report, 'id' | 'status' | 'current_revision_id' | 'published_revision_id' | 'review_comment' | 'updated_at'> | null;
  viewed_at: string | null;
  state: RosterState;
  has_unpublished_changes: boolean;
};

type EnrolmentRow = { id: string; status: string; kids: { id: string; name: string } | null };
type AssessmentRow = { id: string; enrolment_id: string; assessed_on: string; assessment_scores: { area_id: string; level_id: string }[] };

export async function loadRoster(sessionId: string): Promise<RosterLearner[]> {
  const { data: enrols, error } = await db()
    .from('enrolments')
    .select('id, status, kids(id, name)')
    .eq('session_id', sessionId)
    .neq('status', 'withdrawn');
  if (error) throw new Error(error.message);
  const enrolments = ((enrols ?? []) as unknown as EnrolmentRow[]).filter(e => e.kids);
  const ids = enrolments.map(e => e.id);
  if (!ids.length) return [];

  const [{ data: assessments }, { data: attendance }, { data: reports }] = await Promise.all([
    db().from('assessments').select('id, enrolment_id, assessed_on, assessment_scores(area_id, level_id)').in('enrolment_id', ids),
    db().from('lesson_attendance').select('enrolment_id, lesson_no, present, caught_up_on').in('enrolment_id', ids),
    db().from('reports').select('id, enrolment_id, status, current_revision_id, published_revision_id, review_comment, updated_at').in('enrolment_id', ids),
  ]);
  const reportRows = (reports ?? []) as (RosterLearner['report'] & { enrolment_id: string })[];
  const reportIds = reportRows.map(r => r!.id);
  const viewedByReport = new Map<string, string>();
  if (reportIds.length) {
    const { data: views } = await db().from('report_events').select('report_id, at').in('report_id', reportIds).eq('event', 'viewed').order('at', { ascending: false });
    for (const v of (views ?? []) as { report_id: string; at: string }[]) if (!viewedByReport.has(v.report_id)) viewedByReport.set(v.report_id, v.at);
  }

  return enrolments.map(e => {
    const a = ((assessments ?? []) as AssessmentRow[]).find(x => x.enrolment_id === e.id);
    const scores: AreaScores = Object.fromEntries((a?.assessment_scores ?? []).map(s => [s.area_id, s.level_id]));
    const att = ((attendance ?? []) as AttendanceRow[]).filter(x => x.enrolment_id === e.id).sort((x, y) => x.lesson_no - y.lesson_no);
    const rep = reportRows.find(r => r!.enrolment_id === e.id) ?? null;
    const viewed_at = rep ? viewedByReport.get(rep.id) ?? null : null;
    const scored_count = Object.keys(scores).length;
    const has_unpublished_changes = !!rep?.published_revision_id && (rep.status === 'draft' || rep.status === 'in_review');
    let state: RosterState;
    if (!rep) state = scored_count ? 'not_started' : 'no_data';
    else if (rep.status === 'sent' && viewed_at) state = 'viewed';
    else state = rep.status;
    return {
      enrolment_id: e.id,
      kid_id: e.kids!.id,
      name: e.kids!.name,
      first_name: firstNameOf(e.kids!.name),
      scores,
      scored_count,
      assessed_on: a?.assessed_on ?? null,
      attendance: att,
      lessons_to_catch_up: lessonsToCatchUp(att),
      report: rep ? {
        id: rep.id, status: rep.status, current_revision_id: rep.current_revision_id,
        published_revision_id: rep.published_revision_id, review_comment: rep.review_comment, updated_at: rep.updated_at,
      } : null,
      viewed_at,
      state,
      has_unpublished_changes,
    };
  }).sort((x, y) => x.name.localeCompare(y.name));
}

// ---------------------------------------------------------------------------
// Assessment capture
// ---------------------------------------------------------------------------

export async function saveScores(enrolmentId: string, scores: AreaScores, actor: string | null) {
  const { data: existing } = await db().from('assessments').select('id').eq('enrolment_id', enrolmentId).maybeSingle();
  let assessmentId = (existing as { id: string } | null)?.id;
  if (!assessmentId) {
    const { data, error } = await db().from('assessments').insert({ enrolment_id: enrolmentId, assessed_by: actor }).select('id').single();
    if (error) throw new Error(error.message);
    assessmentId = (data as { id: string }).id;
  } else {
    await db().from('assessments').update({ assessed_by: actor, assessed_on: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() }).eq('id', assessmentId);
  }
  const rows = Object.entries(scores).filter(([, levelId]) => levelId).map(([area_id, level_id]) => ({ assessment_id: assessmentId, area_id, level_id }));
  if (rows.length) {
    const { error } = await db().from('assessment_scores').upsert(rows, { onConflict: 'assessment_id,area_id' });
    if (error) throw new Error(error.message);
  }
  const cleared = Object.entries(scores).filter(([, levelId]) => !levelId).map(([areaId]) => areaId);
  if (cleared.length) await db().from('assessment_scores').delete().eq('assessment_id', assessmentId).in('area_id', cleared);
}

export async function saveAttendance(enrolmentId: string, lessonNo: number, state: 'present' | 'missed' | 'caught_up') {
  if (state === 'present') {
    await db().from('lesson_attendance').delete().eq('enrolment_id', enrolmentId).eq('lesson_no', lessonNo);
    return;
  }
  const { error } = await db().from('lesson_attendance').upsert({
    enrolment_id: enrolmentId, lesson_no: lessonNo, present: false,
    caught_up_on: state === 'caught_up' ? new Date().toISOString().slice(0, 10) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'enrolment_id,lesson_no' });
  if (error) throw new Error(error.message);
}

export async function setLessonsPlanned(sessionId: string, lessons: number | null) {
  const { error } = await db().from('sessions').update({ lessons_planned: lessons }).eq('id', sessionId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Facts for one enrolment
// ---------------------------------------------------------------------------

// Term courses are labelled by school term ("Term 3 2026"), so two runs of
// the same programme read differently on a parent's list of reports; one-off
// workshops by month ("August 2026").
function periodLabel(iso: string | null, programmeType: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (programmeType === 'term_course') {
    const [y, m] = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' }).split('-').map(Number);
    return `Term ${Math.floor((m - 1) / 3) + 1} ${y}`;
  }
  return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' });
}

function todaySast(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

export async function learnerFacts(enrolmentId: string): Promise<{ facts: LearnerFacts; kidId: string; sessionId: string }> {
  const { data: e, error } = await db()
    .from('enrolments')
    .select(`id, session_id, kids(id, name), sessions(${SESSION_SELECT})`)
    .eq('id', enrolmentId)
    .single();
  if (error || !e) throw new Error('Enrolment not found.');
  const row = e as unknown as { id: string; session_id: string; kids: { id: string; name: string }; sessions: SessionRow };
  const run = toRun(row.sessions);

  const [{ data: a }, { data: att }] = await Promise.all([
    db().from('assessments').select('assessment_scores(area_id, level_id)').eq('enrolment_id', enrolmentId).maybeSingle(),
    db().from('lesson_attendance').select('present, caught_up_on').eq('enrolment_id', enrolmentId),
  ]);
  const scores: AreaScores = Object.fromEntries(((a as { assessment_scores: { area_id: string; level_id: string }[] } | null)?.assessment_scores ?? []).map(s => [s.area_id, s.level_id]));
  const programmeName = run.programme?.name ?? 'RAD Academy programme';
  const period = periodLabel(run.starts_at, run.programme?.type);
  return {
    kidId: row.kids.id,
    sessionId: row.session_id,
    facts: {
      firstName: firstNameOf(row.kids.name),
      programmeName,
      programmeLine: [programmeName, run.programme?.type === 'term_course' ? period : null, run.venue_label].filter(Boolean).join(' · '),
      periodLabel: period,
      issuedOn: todaySast(),
      scores,
      lessonsToCatchUp: lessonsToCatchUp((att ?? []) as AttendanceRow[]),
    },
  };
}

// ---------------------------------------------------------------------------
// Reports and revisions
// ---------------------------------------------------------------------------

export async function logEvent(e: {
  reportId: string | null; event: string; actorType: 'staff' | 'guardian' | 'system';
  actorId?: string | null; linkId?: string | null; meta?: Record<string, unknown>;
}) {
  await db().from('report_events').insert({
    report_id: e.reportId, event: e.event, actor_type: e.actorType, actor_id: e.actorId ?? null,
    link_id: e.linkId ?? null, meta: e.meta ?? {},
  });
}

export async function getReport(reportId: string): Promise<Report | null> {
  const { data } = await db().from('reports').select('*').eq('id', reportId).maybeSingle();
  return (data as Report | null) ?? null;
}

export async function getRevision(revisionId: string): Promise<ReportRevision | null> {
  const { data } = await db().from('report_revisions').select('*').eq('id', revisionId).maybeSingle();
  return (data as ReportRevision | null) ?? null;
}

export async function listRevisions(reportId: string): Promise<ReportRevision[]> {
  const { data } = await db().from('report_revisions').select('*').eq('report_id', reportId).order('revision_no', { ascending: false });
  return (data ?? []) as ReportRevision[];
}

async function insertRevision(reportId: string, content: ReportContent, actor: string | null, note: string | null): Promise<ReportRevision> {
  const { data: last } = await db().from('report_revisions').select('revision_no').eq('report_id', reportId).order('revision_no', { ascending: false }).limit(1).maybeSingle();
  const revision_no = ((last as { revision_no: number } | null)?.revision_no ?? 0) + 1;
  const { data, error } = await db()
    .from('report_revisions')
    .insert({ report_id: reportId, revision_no, content: withEditedFlags(content), created_by: actor, change_note: note })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ReportRevision;
}

async function updateReport(reportId: string, patch: Partial<Report>) {
  const { error } = await db().from('reports').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', reportId);
  if (error) throw new Error(error.message);
}

// Create the report for an enrolment, or (regenerate) rebuild its wording
// from the current scores and templates as a new revision. A fresh
// generate never overwrites an existing report - "Generate drafts" skips
// anyone who already has one, so nobody's edits are lost.
export async function generateReport(enrolmentId: string, actor: string | null, opts: { regenerate?: boolean } = {}): Promise<{ reportId: string; created: boolean }> {
  const { facts } = await learnerFacts(enrolmentId);
  const [rubrics, templates] = await Promise.all([loadRubrics(), loadTemplates()]);
  if (!hasAnyScore(rubrics, facts.scores)) throw new GenerationError('Assessment pending: no scores have been captured for this learner.');

  const { data: existing } = await db().from('reports').select('*').eq('enrolment_id', enrolmentId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const report = existing as Report | null;

  if (report && !opts.regenerate) return { reportId: report.id, created: false };

  if (report) {
    const prior = await workingContent(report);
    const note = prior?.sections.find(s => s.type === 'facilitator_note')?.fields.text ?? '';
    const fresh = generateContent({ rubrics, templates, learner: { ...facts, periodLabel: report.period_label }, facilitatorNote: note });
    // A staff status override survives regeneration; a computed one follows the new attendance.
    const overridden = prior && prior.status !== prior.status_computed;
    const content = overridden ? { ...fresh, status: prior.status } : fresh;
    const rev = await insertRevision(report.id, content, actor, 'Regenerated from current scores and templates');
    await updateReport(report.id, {
      current_revision_id: rev.id, working_content: null, working_updated_at: null,
      status: report.status === 'published' || report.status === 'sent' ? 'draft' : report.status,
    });
    await logEvent({ reportId: report.id, event: 'generated', actorType: 'staff', actorId: actor, meta: { regenerate: true, revision_no: rev.revision_no } });
    return { reportId: report.id, created: false };
  }

  const content = generateContent({ rubrics, templates, learner: facts });
  const { data: created, error } = await db()
    .from('reports')
    .insert({ enrolment_id: enrolmentId, period_label: facts.periodLabel, status: 'draft', created_by: actor })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const rep = created as Report;
  const rev = await insertRevision(rep.id, content, actor, 'Generated draft');
  await updateReport(rep.id, { current_revision_id: rev.id });
  await logEvent({ reportId: rep.id, event: 'generated', actorType: 'staff', actorId: actor, meta: { revision_no: rev.revision_no } });
  return { reportId: rep.id, created: true };
}

export async function workingContent(report: Report): Promise<ReportContent | null> {
  if (report.working_content) return report.working_content;
  if (!report.current_revision_id) return null;
  return (await getRevision(report.current_revision_id))?.content ?? null;
}

// Autosave: overwrite the buffer only. No revision row, no event.
export async function autosave(reportId: string, content: ReportContent) {
  await updateReport(reportId, { working_content: withEditedFlags(content), working_updated_at: new Date().toISOString() });
}

// Explicit save: append a revision from the buffer (or the given content)
// if it differs from the current revision. Editing a published/sent report
// starts a correction draft - the published revision stays live.
export async function saveRevision(report: Report, content: ReportContent, actor: string | null, note: string | null): Promise<ReportRevision> {
  const current = report.current_revision_id ? await getRevision(report.current_revision_id) : null;
  const normalised = withEditedFlags(content);
  let rev = current;
  if (!current || JSON.stringify(current.content) !== JSON.stringify(normalised)) {
    rev = await insertRevision(report.id, normalised, actor, note);
    await logEvent({ reportId: report.id, event: 'edited', actorType: 'staff', actorId: actor, meta: { revision_no: rev.revision_no, note } });
  }
  const nextStatus: ReportStatus = report.status === 'published' || report.status === 'sent'
    ? (rev!.id === report.published_revision_id ? report.status : 'draft')
    : report.status;
  await updateReport(report.id, { current_revision_id: rev!.id, working_content: null, working_updated_at: null, status: nextStatus });
  return rev!;
}

export async function submitForReview(report: Report, content: ReportContent | null, actor: string | null, note: string | null) {
  const rev = content ? await saveRevision(report, content, actor, note) : null;
  await updateReport(report.id, { status: 'in_review', review_comment: null });
  await logEvent({ reportId: report.id, event: 'submitted', actorType: 'staff', actorId: actor, meta: { revision_no: rev?.revision_no ?? null } });
}

export async function sendBack(report: Report, comment: string, actor: string | null) {
  await updateReport(report.id, { status: 'draft', review_comment: comment });
  await logEvent({ reportId: report.id, event: 'sent_back', actorType: 'staff', actorId: actor, meta: { comment } });
}

// Approve = publish. Also used for "Publish correction" after a send: the
// parent's existing link then shows the new revision, and history keeps both.
export async function publish(report: Report, content: ReportContent | null, actor: string | null, note: string | null): Promise<ReportRevision> {
  const rev = content ? await saveRevision(await getReport(report.id) as Report, content, actor, note)
    : await getRevision(report.current_revision_id!);
  if (!rev) throw new Error('Nothing to publish yet.');
  const isCorrection = !!report.published_revision_id && report.published_revision_id !== rev.id;
  const wasSent = report.status === 'sent' || (isCorrection && await hasEvent(report.id, 'sent'));
  await db().from('report_revisions').update({ published_at: new Date().toISOString() }).eq('id', rev.id).is('published_at', null);
  await updateReport(report.id, {
    published_revision_id: rev.id, current_revision_id: rev.id, working_content: null, working_updated_at: null,
    status: wasSent ? 'sent' : 'published', review_comment: null,
  });
  await recordGrowthGoal(report, rev);
  await logEvent({ reportId: report.id, event: 'published', actorType: 'staff', actorId: actor, meta: { revision_no: rev.revision_no, correction: isCorrection } });
  return rev;
}

async function hasEvent(reportId: string, event: string): Promise<boolean> {
  const { count } = await db().from('report_events').select('id', { count: 'exact', head: true }).eq('report_id', reportId).eq('event', event);
  return (count ?? 0) > 0;
}

async function recordGrowthGoal(report: Report, rev: ReportRevision) {
  const growth = rev.content.sections.find(s => s.type === 'growth');
  if (!growth) return;
  const { data: e } = await db().from('enrolments').select('student_id').eq('id', report.enrolment_id).single();
  const kidId = (e as { student_id: string } | null)?.student_id;
  if (!kidId) return;
  const rank = growth.area_id ? await areaRank(report.enrolment_id, growth.area_id) : null;
  await db().from('growth_goals').upsert({
    kid_id: kidId, report_id: report.id, area_id: growth.area_id ?? null, level_rank: rank,
    text: growth.fields.title ?? '', status: 'open',
  }, { onConflict: 'report_id' });
}

async function areaRank(enrolmentId: string, areaId: string): Promise<number | null> {
  const { data } = await db()
    .from('assessments')
    .select('assessment_scores(area_id, rubric_levels(rank))')
    .eq('enrolment_id', enrolmentId)
    .maybeSingle();
  const scores = (data as { assessment_scores: { area_id: string; rubric_levels: { rank: number } | null }[] } | null)?.assessment_scores ?? [];
  return scores.find(s => s.area_id === areaId)?.rubric_levels?.rank ?? null;
}

// ---------------------------------------------------------------------------
// Parent links
// ---------------------------------------------------------------------------

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type GuardianLink = { guardian_lead_id: string; guardian_name: string; phone: string | null; url: string; message: string };

type GuardianRow = { lead_id: string; receives_reports: boolean; leads: { id: string; name: string | null; phone: string | null; is_blocked: boolean | null } | null };

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://radacademy.co.za').replace(/\/$/, '');
}

// Issues a fresh private link per guardian who receives reports (revoking
// that guardian's earlier links to the same report - the raw token is never
// stored, so a lost message means a new link) and marks the report sent.
// Returns the links + prefilled WhatsApp text for staff to send.
export async function issueLinks(report: Report, actor: string | null): Promise<GuardianLink[]> {
  if (!report.published_revision_id) throw new Error('Publish the report before sending it.');
  const { data: e } = await db().from('enrolments').select('student_id, kids(name)').eq('id', report.enrolment_id).single();
  const enrol = e as unknown as { student_id: string; kids: { name: string } } | null;
  if (!enrol) throw new Error('Enrolment not found.');
  const { data: g } = await db()
    .from('kid_guardians')
    .select('lead_id, receives_reports, leads(id, name, phone, is_blocked)')
    .eq('kid_id', enrol.student_id);
  const guardians = ((g ?? []) as unknown as GuardianRow[]).filter(x => x.receives_reports && x.leads && !x.leads.is_blocked);
  if (!guardians.length) throw new Error('No guardian on file receives reports for this learner. Link a guardian in /admin/kids first.');

  const firstName = firstNameOf(enrol.kids.name);
  const expires = new Date(Date.now() + PARENT_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const out: GuardianLink[] = [];
  for (const gd of guardians) {
    await db().from('report_links').update({ revoked_at: now }).eq('report_id', report.id).eq('guardian_lead_id', gd.lead_id).is('revoked_at', null);
    const token = randomBytes(24).toString('base64url');
    const { error } = await db().from('report_links').insert({
      report_id: report.id, guardian_lead_id: gd.lead_id, token_hash: hashToken(token), expires_at: expires, created_by: actor,
    });
    if (error) throw new Error(error.message);
    const url = `${siteUrl()}/r/${token}`;
    const greeting = gd.leads!.name ? `Hi ${firstNameOf(gd.leads!.name)}` : 'Hi';
    out.push({
      guardian_lead_id: gd.lead_id,
      guardian_name: gd.leads!.name ?? 'Guardian',
      phone: gd.leads!.phone,
      url,
      message: `${greeting}, ${firstName}'s RAD Academy progress report is ready. It's private to your family: ${url}`,
    });
  }
  await updateReport(report.id, { status: report.status === 'published' ? 'sent' : report.status });
  await logEvent({ reportId: report.id, event: 'sent', actorType: 'staff', actorId: actor, meta: { guardians: out.map(o => o.guardian_lead_id) } });
  return out;
}

export async function revokeLinks(reportId: string, actor: string | null) {
  await db().from('report_links').update({ revoked_at: new Date().toISOString() }).eq('report_id', reportId).is('revoked_at', null);
  await logEvent({ reportId, event: 'links_revoked', actorType: 'staff', actorId: actor });
}

export type ResolvedLink =
  | { ok: true; linkId: string; guardianLeadId: string; reportId: string; kidId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'rate_limited' };

const FAIL_WINDOW_MINUTES = 15;
const FAIL_MAX = 20;

export async function resolveLink(token: string, ip: string | null, userAgent: string | null): Promise<ResolvedLink> {
  if (ip) {
    const since = new Date(Date.now() - FAIL_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count } = await db().from('report_events').select('id', { count: 'exact', head: true })
      .eq('event', 'link_failed').gte('at', since).eq('meta->>ip', ip);
    if ((count ?? 0) >= FAIL_MAX) return { ok: false, reason: 'rate_limited' };
  }
  const { data } = await db()
    .from('report_links')
    .select('id, report_id, guardian_lead_id, expires_at, revoked_at, reports(enrolment_id, enrolments(student_id))')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  const link = data as unknown as {
    id: string; report_id: string; guardian_lead_id: string; expires_at: string; revoked_at: string | null;
    reports: { enrolment_id: string; enrolments: { student_id: string } | null } | null;
  } | null;
  const reason = !link ? 'not_found' : link.revoked_at ? 'revoked' : new Date(link.expires_at) <= new Date() ? 'expired' : null;
  if (reason || !link?.reports?.enrolments) {
    await logEvent({
      reportId: link?.report_id ?? null, linkId: link?.id ?? null, event: 'link_failed', actorType: 'guardian',
      actorId: link?.guardian_lead_id ?? null, meta: { reason: reason ?? 'not_found', ip, user_agent: userAgent },
    });
    return { ok: false, reason: reason ?? 'not_found' };
  }
  await db().from('report_links').update({ last_used_at: new Date().toISOString() }).eq('id', link.id);
  return { ok: true, linkId: link.id, guardianLeadId: link.guardian_lead_id, reportId: link.report_id, kidId: link.reports.enrolments.student_id };
}

// Published reports for the same child that this guardian may see: the
// guardian must still be linked to the kid, and only published revisions
// are ever returned. This is the whole parent-side access rule.
export async function guardianReports(link: Extract<ResolvedLink, { ok: true }>) {
  const { data: gl } = await db().from('kid_guardians').select('id').eq('kid_id', link.kidId).eq('lead_id', link.guardianLeadId).maybeSingle();
  if (!gl) return [];
  const { data } = await db()
    .from('reports')
    .select('id, period_label, published_revision_id, enrolments!inner(student_id), report_revisions!reports_published_revision_fk(id, published_at, content)')
    .eq('enrolments.student_id', link.kidId)
    .not('published_revision_id', 'is', null);
  type Row = { id: string; period_label: string; published_revision_id: string; report_revisions: Pick<ReportRevision, 'id' | 'published_at' | 'content'> | null };
  return ((data ?? []) as unknown as Row[])
    .filter(r => r.report_revisions)
    .map(r => ({ reportId: r.id, periodLabel: r.period_label, revision: r.report_revisions! }))
    .sort((a, b) => (b.revision.published_at ?? '').localeCompare(a.revision.published_at ?? ''));
}

// ---------------------------------------------------------------------------
// Print signing (headless Chrome fetches /r/print/<revisionId>)
// ---------------------------------------------------------------------------

function printSecret(): string {
  const s = process.env.REPORT_PRINT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('No signing secret for report printing.');
  return s;
}

export function signPrint(revisionId: string, ttlSeconds = 300): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac('sha256', printSecret()).update(`${revisionId}.${exp}`).digest('base64url');
  return `${exp}.${sig}`;
}

export function verifyPrint(revisionId: string, signed: string | null): boolean {
  if (!signed) return false;
  const [expStr, sig] = signed.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now() / 1000 || !sig) return false;
  const expected = createHmac('sha256', printSecret()).update(`${revisionId}.${exp}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

