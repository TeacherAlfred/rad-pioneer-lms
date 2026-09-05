import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const JUNIOR_GRADES = new Set(['R', '1', '2', '3']);
const SENIOR_GRADES = new Set(['4', '5', '6', '7']);
const TOP_N = 3;
const DAILY_HISTORY_DAYS = 60;

// Admin-only insight panel for the Votes page: a daily votes/people trend
// (left column) and top-3 class podiums per grade band (right column).
// Not shown on the public feed/leaderboard - purely for the admin's own
// read on how voting is actually going.
export async function GET() {
  const supabase = supabaseAdmin();

  const [
    { data: votes, error: votesError },
    { data: responses, error: responsesError },
    { data: children, error: childrenError },
  ] = await Promise.all([
    supabase.from('irene_fitness_votes').select('response_id, vote_date'),
    supabase.from('irene_fitness_responses').select('id, family_id'),
    supabase.from('irene_fitness_children').select('family_id, grade, class'),
  ]);
  if (votesError) return NextResponse.json({ error: votesError.message }, { status: 500 });
  if (responsesError) return NextResponse.json({ error: responsesError.message }, { status: 500 });
  if (childrenError) return NextResponse.json({ error: childrenError.message }, { status: 500 });

  // Daily trend: votes = one row per category tap (matches the "34 votes
  // cast" convention already used on this page - a person voted for in all
  // 3 categories counts 3 times here), people = distinct responses that
  // received at least one vote that day.
  const dailyVotes = new Map<string, number>();
  const dailyResponses = new Map<string, Set<string>>();
  (votes || []).forEach((v) => {
    dailyVotes.set(v.vote_date, (dailyVotes.get(v.vote_date) || 0) + 1);
    const set = dailyResponses.get(v.vote_date) || new Set<string>();
    set.add(v.response_id);
    dailyResponses.set(v.vote_date, set);
  });
  const daily = [...dailyVotes.keys()]
    .sort()
    .slice(-DAILY_HISTORY_DAYS)
    .map((date) => ({
      date,
      votes: dailyVotes.get(date) || 0,
      people: dailyResponses.get(date)?.size || 0,
    }));

  // Class podiums: same "a vote counts toward every grade/class a family's
  // children touch" convention the main dashboard's grade_stats already
  // uses (src/app/admin/api/dashboard-v2/projects/irene-fitness/route.ts),
  // extended from grade-only to the (grade, class) pair - "class" alone
  // isn't unique (different grades reuse names like "J" or "A").
  const familyToClasses = new Map<string, { grade: string; class: string }[]>();
  (children || []).forEach((c) => {
    if (!c.class) return;
    const list = familyToClasses.get(c.family_id) || [];
    list.push({ grade: c.grade, class: c.class });
    familyToClasses.set(c.family_id, list);
  });
  const familyByResponse = new Map((responses || []).map((r) => [r.id, r.family_id]));

  const voteCountByResponse = new Map<string, number>();
  (votes || []).forEach((v) => {
    voteCountByResponse.set(v.response_id, (voteCountByResponse.get(v.response_id) || 0) + 1);
  });

  const classTotals = new Map<string, { grade: string; class: string; votes: number }>();
  voteCountByResponse.forEach((count, responseId) => {
    const familyId = familyByResponse.get(responseId);
    if (!familyId) return;
    const classesTouched = familyToClasses.get(familyId) || [];
    // A family with more than one child in the *same* class shouldn't
    // double-count that class - de-duped per family before adding.
    const seenKeys = new Set<string>();
    classesTouched.forEach(({ grade, class: className }) => {
      const key = `${grade}::${className}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      const entry = classTotals.get(key) || { grade, class: className, votes: 0 };
      entry.votes += count;
      classTotals.set(key, entry);
    });
  });

  const allClassTotals = [...classTotals.values()];
  const junior = allClassTotals
    .filter((c) => JUNIOR_GRADES.has(c.grade))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, TOP_N);
  const senior = allClassTotals
    .filter((c) => SENIOR_GRADES.has(c.grade))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, TOP_N);

  return NextResponse.json({
    daily,
    class_podiums: {
      grade_r_to_3: junior,
      grade_4_to_7: senior,
    },
  });
}
