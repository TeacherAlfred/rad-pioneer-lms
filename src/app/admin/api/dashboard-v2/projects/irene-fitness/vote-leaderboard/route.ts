import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VOTE_CATEGORIES = ['funniest', 'most_inspiring', 'mad_scientist'] as const;
type VoteCategory = (typeof VOTE_CATEGORIES)[number];

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
        .map((t) => ({ response_id: t.response_id, display_name: t.display_name, votes: t[cat] }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, TOP_N),
    ])
  ) as Record<VoteCategory, { response_id: string; display_name: string; votes: number }[]>;

  return NextResponse.json({ overall, by_category });
}
