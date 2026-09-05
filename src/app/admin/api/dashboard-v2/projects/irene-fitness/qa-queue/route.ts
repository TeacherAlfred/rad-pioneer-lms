import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Everything the QA review drawer needs to actually assess a response -
// full story text plus the private grade/class context - split out from the
// main dashboard GET (which stays lean, just the table-row shape) since
// only this one focused review flow needs story content at all. Oldest
// first, so the admin works through submission order rather than newest-
// first (which would keep bumping fresh submissions to the front of an
// already-long queue).
export async function GET() {
  const supabase = supabaseAdmin();

  const { data: responses, error: responsesError } = await supabase
    .from('irene_fitness_responses')
    .select('id, family_id, display_name, created_at, updated_at, edited_after_approval_at')
    .eq('qa_confirmed', false)
    .order('created_at', { ascending: true });
  if (responsesError) return NextResponse.json({ error: responsesError.message }, { status: 500 });

  if (!responses || responses.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const familyIds = responses.map((r) => r.family_id);
  const responseIds = responses.map((r) => r.id);

  const [
    { data: families, error: familiesError },
    { data: children, error: childrenError },
    { data: stories, error: storiesError },
  ] = await Promise.all([
    supabase.from('irene_fitness_families').select('id, whatsapp, email').in('id', familyIds),
    supabase.from('irene_fitness_children').select('family_id, grade, class').in('family_id', familyIds),
    supabase
      .from('irene_fitness_response_story')
      .select(
        'response_id, motivation, club_member, club_names, shoe_count, boss_level_challenge_2026, toughest_challenge, proudest_moment, weirdest_fuel, funniest_fail'
      )
      .in('response_id', responseIds),
  ]);
  if (familiesError) return NextResponse.json({ error: familiesError.message }, { status: 500 });
  if (childrenError) return NextResponse.json({ error: childrenError.message }, { status: 500 });
  if (storiesError) return NextResponse.json({ error: storiesError.message }, { status: 500 });

  const familyById = new Map((families || []).map((f) => [f.id, f]));
  const childrenByFamily = new Map<string, { grade: string; class: string | null }[]>();
  (children || []).forEach((c) => {
    const list = childrenByFamily.get(c.family_id) || [];
    list.push({ grade: c.grade, class: c.class });
    childrenByFamily.set(c.family_id, list);
  });
  const storyByResponse = new Map((stories || []).map((s) => [s.response_id, s]));

  const items = responses.map((r) => {
    const family = familyById.get(r.family_id);
    const story = storyByResponse.get(r.id);
    return {
      response_id: r.id,
      display_name: r.display_name,
      created_at: r.created_at,
      updated_at: r.updated_at,
      edited_after_approval_at: r.edited_after_approval_at || null,
      whatsapp: family?.whatsapp || null,
      email: family?.email || null,
      children: childrenByFamily.get(r.family_id) || [],
      story: story
        ? {
            motivation: story.motivation,
            club_member: story.club_member,
            club_names: story.club_names,
            shoe_count: story.shoe_count,
            boss_level_challenge_2026: story.boss_level_challenge_2026,
            toughest_challenge: story.toughest_challenge,
            proudest_moment: story.proudest_moment,
            weirdest_fuel: story.weirdest_fuel,
            funniest_fail: story.funniest_fail,
          }
        : null,
    };
  });

  return NextResponse.json({ items });
}
