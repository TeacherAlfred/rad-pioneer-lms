import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VOTE_CATEGORIES = ['funniest', 'most_inspiring', 'mad_scientist'] as const;
type VoteCategory = (typeof VOTE_CATEGORIES)[number];

type StoryFieldKey =
  | 'motivation'
  | 'toughest_challenge'
  | 'proudest_moment'
  | 'weirdest_fuel'
  | 'funniest_fail'
  | 'boss_level_challenge_2026';

const TOP_N = 10;

// Deliberately NOT filtered by qa_confirmed/consent_public_display - this is
// an internal view of where votes have actually landed, not a re-rendering
// of what the public feed currently shows. A response that's since been
// un-QA'd (or had consent withdrawn) keeps whatever votes it already
// earned; the admin should still be able to see that, not have it silently
// vanish from the standings.
export async function GET() {
  const supabase = supabaseAdmin();

  const [{ data: votes, error: votesError }, { data: responses, error: responsesError }] = await Promise.all([
    supabase.from('irene_fitness_votes').select('response_id, category'),
    supabase.from('irene_fitness_responses').select('id, display_name'),
  ]);
  if (votesError) return NextResponse.json({ error: votesError.message }, { status: 500 });
  if (responsesError) return NextResponse.json({ error: responsesError.message }, { status: 500 });

  const nameByResponse = new Map((responses || []).map((r) => [r.id, r.display_name]));

  type Tally = { response_id: string; display_name: string } & Record<VoteCategory, number>;
  const tallyByResponse = new Map<string, Tally>();
  function tally(responseId: string): Tally {
    let t = tallyByResponse.get(responseId);
    if (!t) {
      t = {
        response_id: responseId,
        display_name: nameByResponse.get(responseId) || '(deleted response)',
        funniest: 0,
        most_inspiring: 0,
        mad_scientist: 0,
      };
      tallyByResponse.set(responseId, t);
    }
    return t;
  }

  (votes || []).forEach((v) => {
    if (!VOTE_CATEGORIES.includes(v.category as VoteCategory)) return;
    tally(v.response_id)[v.category as VoteCategory]++;
  });

  const tallies = [...tallyByResponse.values()];

  const responseIds = tallies.map((t) => t.response_id);
  const { data: stories, error: storiesError } =
    responseIds.length > 0
      ? await supabase
          .from('irene_fitness_response_story')
          .select(
            'response_id, funniest_fail, proudest_moment, motivation, weirdest_fuel, toughest_challenge, boss_level_challenge_2026, category_overrides'
          )
          .in('response_id', responseIds)
      : { data: [], error: null };
  if (storiesError) return NextResponse.json({ error: storiesError.message }, { status: 500 });
  const storyByResponse = new Map((stories || []).map((s) => [s.response_id, s]));

  // Which field actually reads as "what they wrote for this category" - the
  // same rough association the public feed's category theming already uses
  // (funny -> the fail story, inspiring -> the proud moment, "mad
  // scientist"/craziest diet -> the odd fuel), each falling back to the
  // next-closest field when the first-choice one is blank. An admin-set
  // override (Responses page) always wins: a real field name substitutes
  // that field's text; 'blank' means the admin has explicitly marked this
  // category as having nothing real to show, which returns null - never
  // falls through to the default field-priority. Kept in sync with
  // community/page.tsx's own categoryExcerpt so "top voted" reads the same
  // story on both pages.
  function excerptFor(category: VoteCategory, responseId: string): string | null {
    const s = storyByResponse.get(responseId);
    if (!s) return null;

    const overrideValue = s.category_overrides?.[category] as StoryFieldKey | 'blank' | undefined;
    if (overrideValue === 'blank') return null;
    if (overrideValue && s[overrideValue]) return s[overrideValue];

    if (category === 'funniest') return s.funniest_fail || null;
    if (category === 'most_inspiring') return s.proudest_moment || s.motivation || null;
    return s.weirdest_fuel || s.toughest_challenge || null;
  }

  const overall = tallies
    .map((t) => ({
      response_id: t.response_id,
      display_name: t.display_name,
      total: t.funniest + t.most_inspiring + t.mad_scientist,
      funniest: t.funniest,
      most_inspiring: t.most_inspiring,
      mad_scientist: t.mad_scientist,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);

  const by_category = Object.fromEntries(
    VOTE_CATEGORIES.map((cat) => [
      cat,
      tallies
        .filter((t) => t[cat] > 0)
        .map((t) => ({
          response_id: t.response_id,
          display_name: t.display_name,
          votes: t[cat],
          excerpt: excerptFor(cat, t.response_id),
        }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, TOP_N),
    ])
  ) as Record<VoteCategory, { response_id: string; display_name: string; votes: number; excerpt: string | null }[]>;

  return NextResponse.json({ overall, by_category });
}
