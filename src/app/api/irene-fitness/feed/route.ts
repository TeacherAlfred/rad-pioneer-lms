import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VOTE_CATEGORIES = ['funniest', 'most_inspiring', 'mad_scientist'] as const;
type VoteCategory = (typeof VOTE_CATEGORIES)[number];

// Public community feed - only families with consent_public_display=true on
// irene_fitness_families ever appear here. Story answers are optional per
// family (spec: "Tell Your Story" was always skippable), so a response with
// no story row still renders as a name-only card, same as the story_preview
// step already shows during submission.
export async function GET() {
  const supabase = supabaseAdmin();

  const [{ data: settings, error: settingsError }, { data: families, error: familiesError }] = await Promise.all([
    supabase.from('irene_fitness_voting_settings').select('phase').eq('id', 1).single(),
    supabase.from('irene_fitness_families').select('id').eq('consent_public_display', true),
  ]);
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });
  if (familiesError) return NextResponse.json({ error: familiesError.message }, { status: 500 });

  const familyIds = (families || []).map((f) => f.id);
  if (familyIds.length === 0) {
    return NextResponse.json({ phase: settings?.phase || 'locked', responses: [] });
  }

  const [{ data: responses, error: responsesError }, { data: votes, error: votesError }] = await Promise.all([
    supabase.from('irene_fitness_responses').select('id, family_id, display_name').in('family_id', familyIds),
    supabase.from('irene_fitness_votes').select('response_id, category'),
  ]);
  if (responsesError) return NextResponse.json({ error: responsesError.message }, { status: 500 });
  if (votesError) return NextResponse.json({ error: votesError.message }, { status: 500 });

  const responseIds = (responses || []).map((r) => r.id);
  const { data: stories, error: storiesError } =
    responseIds.length > 0
      ? await supabase
          .from('irene_fitness_response_story')
          .select(
            'response_id, motivation, club_member, club_names, shoe_count, boss_level_challenge_2026, toughest_challenge, proudest_moment, weirdest_fuel, funniest_fail'
          )
          .in('response_id', responseIds)
      : { data: [], error: null };
  if (storiesError) return NextResponse.json({ error: storiesError.message }, { status: 500 });

  const storyByResponse = new Map((stories || []).map((s) => [s.response_id, s]));

  const votesByResponse = new Map<string, Record<VoteCategory, number>>();
  (votes || []).forEach((v) => {
    if (!VOTE_CATEGORIES.includes(v.category as VoteCategory)) return;
    const counts = votesByResponse.get(v.response_id) || { funniest: 0, most_inspiring: 0, mad_scientist: 0 };
    counts[v.category as VoteCategory]++;
    votesByResponse.set(v.response_id, counts);
  });

  const result = (responses || []).map((r) => {
    const story = storyByResponse.get(r.id);
    return {
      id: r.id,
      display_name: r.display_name,
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
      votes: votesByResponse.get(r.id) || { funniest: 0, most_inspiring: 0, mad_scientist: 0 },
    };
  });

  return NextResponse.json({ phase: settings?.phase || 'locked', responses: result });
}
