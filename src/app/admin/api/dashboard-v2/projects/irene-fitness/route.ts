import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VOTE_CATEGORIES = ['funniest', 'most_inspiring', 'mad_scientist'] as const;
type VoteCategory = (typeof VOTE_CATEGORIES)[number];

// Irene Fitness's own dashboard - the full picture for this one project,
// split out from the generic /admin/api/dashboard-v2/projects hub listing
// (that route only needs a lightweight teaser per project).
//
// Grade stats attribute a response/vote to every grade among that family's
// children - there's no single "the" grade on a response, since a family
// can have kids in more than one grade. A response or vote counts toward
// each grade it touches, so per-grade totals can sum to more than the
// platform-wide total.
export async function GET() {
  const supabase = supabaseAdmin();

  const [
    { data: families, error: familiesError },
    { data: responses, error: responsesError },
    { data: children, error: childrenError },
    { data: votes, error: votesError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    supabase
      .from('irene_fitness_families')
      .select('id, whatsapp, email, consent_public_display, consent_updates, consent_marketing, created_at'),
    supabase.from('irene_fitness_responses').select('id, family_id, display_name'),
    supabase.from('irene_fitness_children').select('family_id, grade, class'),
    supabase.from('irene_fitness_votes').select('response_id, category'),
    supabase
      .from('irene_fitness_voting_settings')
      .select('phase, updated_at, results_announcement_date, submissions_open')
      .eq('id', 1)
      .single(),
  ]);
  if (familiesError) return NextResponse.json({ error: familiesError.message }, { status: 500 });
  if (responsesError) return NextResponse.json({ error: responsesError.message }, { status: 500 });
  if (childrenError) return NextResponse.json({ error: childrenError.message }, { status: 500 });
  if (votesError) return NextResponse.json({ error: votesError.message }, { status: 500 });
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  const responseByFamily = new Map((responses || []).map((r) => [r.family_id, r]));
  const childrenByFamily = new Map<string, { grade: string; class: string | null }[]>();
  (children || []).forEach((c) => {
    const list = childrenByFamily.get(c.family_id) || [];
    list.push({ grade: c.grade, class: c.class });
    childrenByFamily.set(c.family_id, list);
  });

  const rows = (families || [])
    .map((f) => ({
      family_id: f.id,
      display_name: responseByFamily.get(f.id)?.display_name || '(no response yet)',
      whatsapp: f.whatsapp,
      email: f.email,
      consent_public_display: !!f.consent_public_display,
      consent_updates: !!f.consent_updates,
      consent_marketing: !!f.consent_marketing,
      created_at: f.created_at,
      children: childrenByFamily.get(f.id) || [],
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const votesByCategory: Record<VoteCategory, number> = { funniest: 0, most_inspiring: 0, mad_scientist: 0 };
  const votesByResponse = new Map<string, number>();
  (votes || []).forEach((v) => {
    if (VOTE_CATEGORIES.includes(v.category as VoteCategory)) {
      votesByCategory[v.category as VoteCategory]++;
    }
    votesByResponse.set(v.response_id, (votesByResponse.get(v.response_id) || 0) + 1);
  });

  const gradeStats = new Map<string, { grade: string; response_count: number; child_count: number; vote_count: number }>();
  function gradeEntry(grade: string) {
    if (!gradeStats.has(grade)) gradeStats.set(grade, { grade, response_count: 0, child_count: 0, vote_count: 0 });
    return gradeStats.get(grade)!;
  }
  (children || []).forEach((c) => {
    gradeEntry(c.grade).child_count++;
  });
  (families || []).forEach((f) => {
    const gradesTouched = new Set((childrenByFamily.get(f.id) || []).map((c) => c.grade));
    gradesTouched.forEach((grade) => gradeEntry(grade).response_count++);
  });
  (responses || []).forEach((r) => {
    const voteCount = votesByResponse.get(r.id) || 0;
    if (!voteCount) return;
    const gradesTouched = new Set((childrenByFamily.get(r.family_id) || []).map((c) => c.grade));
    gradesTouched.forEach((grade) => (gradeEntry(grade).vote_count += voteCount));
  });
  const gradeStatsList = [...gradeStats.values()].sort((a, b) => a.grade.localeCompare(b.grade));
  const topResponsesGrade = gradeStatsList.reduce<typeof gradeStatsList[number] | null>(
    (top, g) => (!top || g.response_count > top.response_count ? g : top),
    null
  );
  const topVotesGrade = gradeStatsList.reduce<typeof gradeStatsList[number] | null>(
    (top, g) => (!top || g.vote_count > top.vote_count ? g : top),
    null
  );

  return NextResponse.json({
    summary: {
      total_responses: responses?.length || 0,
      total_children: children?.length || 0,
      consent_public_display: rows.filter((r) => r.consent_public_display).length,
      consent_updates: rows.filter((r) => r.consent_updates).length,
      consent_marketing: rows.filter((r) => r.consent_marketing).length,
      whatsapp_provided: rows.filter((r) => r.whatsapp).length,
      email_provided: rows.filter((r) => r.email).length,
    },
    votes: {
      total: votes?.length || 0,
      by_category: votesByCategory,
    },
    grade_stats: {
      by_grade: gradeStatsList,
      top_responses_grade: topResponsesGrade,
      top_votes_grade: topVotesGrade && topVotesGrade.vote_count > 0 ? topVotesGrade : null,
    },
    settings: settings || { phase: 'locked', updated_at: null, results_announcement_date: null, submissions_open: true },
    rows,
  });
}

// Partial update - the settings row always exists (seeded by migration
// 20260827130000), so this is always an update, never an insert. Only
// fields present in the body get patched, same convention as
// admin/api/irene-settings/route.ts on the older irene-comrades platform.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { phase, results_announcement_date, submissions_open } = body as {
    phase?: string;
    results_announcement_date?: string | null;
    submissions_open?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (phase !== undefined) {
    if (!['locked', 'open', 'standings_only'].includes(phase)) {
      return NextResponse.json({ error: 'phase must be one of: locked, open, standings_only' }, { status: 400 });
    }
    update.phase = phase;
  }
  if (results_announcement_date !== undefined) {
    update.results_announcement_date = results_announcement_date?.trim() || null;
  }
  if (submissions_open !== undefined) {
    update.submissions_open = submissions_open === true;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No recognized fields to update' }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('irene_fitness_voting_settings').update(update).eq('id', 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
