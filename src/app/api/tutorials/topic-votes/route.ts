import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/tutorialProgress';

// Service role: tutorial_topic_votes carries an optional phone number and
// has zero anon policies. Vote counts and "did this voter already vote"
// are only ever exposed through this aggregating route - the anon client
// never queries the votes table directly.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSettings() {
  const { data } = await supabaseAdmin.from('tutorial_topic_vote_settings').select('reveal_threshold, min_display_threshold').limit(1).maybeSingle();
  return { revealThreshold: data?.reveal_threshold ?? 10, minDisplayThreshold: data?.min_display_threshold ?? 3 };
}

// Masks a real count down to what the public is actually shown: null
// (rendered as a dash by the client) either while the whole feature is
// still below its reveal threshold, or - even once revealed - for any one
// topic whose own count hasn't reached the display floor yet, so a single
// quiet topic doesn't read as obviously unpopular next to louder ones.
function displayCount(realCount: number, totalVotes: number, settings: { revealThreshold: number; minDisplayThreshold: number }): number | null {
  if (totalVotes < settings.revealThreshold) return null;
  if (realCount < settings.minDisplayThreshold) return null;
  return realCount;
}

// Returns every visible topic with its (possibly masked) vote count and
// whether this particular voterId has already voted for it, sorted by
// TRUE vote count descending - ranking still reflects real interest even
// while the numbers themselves stay hidden.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const voterId = searchParams.get('voterId') || '';

  const [{ data: topics, error: topicsError }, { data: votes, error: votesError }, settings] = await Promise.all([
    supabaseAdmin.from('tutorial_topic_suggestions').select('id, title').eq('is_hidden', false),
    supabaseAdmin.from('tutorial_topic_votes').select('topic_id, voter_id'),
    getSettings(),
  ]);
  if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 });
  if (votesError) return NextResponse.json({ error: votesError.message }, { status: 500 });

  const countByTopic = new Map<string, number>();
  const votedByMeSet = new Set<string>();
  for (const v of votes || []) {
    countByTopic.set(v.topic_id, (countByTopic.get(v.topic_id) || 0) + 1);
    if (voterId && v.voter_id === voterId) votedByMeSet.add(v.topic_id);
  }
  const totalVotes = votes?.length || 0;

  const result = (topics || [])
    .map(t => {
      const realCount = countByTopic.get(t.id) || 0;
      return { id: t.id, title: t.title, count: displayCount(realCount, totalVotes, settings), realCount, votedByMe: votedByMeSet.has(t.id) };
    })
    .sort((a, b) => b.realCount - a.realCount)
    .map(({ realCount, ...rest }) => rest);

  return NextResponse.json({ topics: result });
}

// Toggles one vote (like-button semantics): casts it if this voter hasn't
// voted for this topic yet, retracts it if they have. `phone` is entirely
// optional - a vote counts with or without it, per the "not mandatory"
// requirement.
export async function POST(req: Request) {
  try {
    const { topicId, voterId, phone } = await req.json();
    if (!topicId || !voterId) return NextResponse.json({ error: 'topicId and voterId are required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('tutorial_topic_votes')
      .select('id')
      .eq('topic_id', topicId)
      .eq('voter_id', voterId)
      .maybeSingle();

    let voted: boolean;
    if (existing) {
      const { error } = await supabaseAdmin.from('tutorial_topic_votes').delete().eq('id', existing.id);
      if (error) throw error;
      voted = false;
    } else {
      const { error } = await supabaseAdmin.from('tutorial_topic_votes').insert([{
        topic_id: topicId,
        voter_id: voterId,
        phone: phone ? normalizePhone(phone) : null,
      }]);
      if (error) throw error;
      voted = true;
    }

    const [{ count: realCount }, { count: totalVotes }, settings] = await Promise.all([
      supabaseAdmin.from('tutorial_topic_votes').select('*', { count: 'exact', head: true }).eq('topic_id', topicId),
      supabaseAdmin.from('tutorial_topic_votes').select('*', { count: 'exact', head: true }),
      getSettings(),
    ]);

    return NextResponse.json({ voted, count: displayCount(realCount || 0, totalVotes || 0, settings) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Attaches a phone number to every vote this voter has already cast - so
// opting in once (after their first vote) covers every topic they picked,
// not just the next one, and every future vote from this browser carries
// it automatically since the client stores it locally too.
export async function PATCH(req: Request) {
  try {
    const { voterId, phone } = await req.json();
    if (!voterId || !phone) return NextResponse.json({ error: 'voterId and phone are required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('tutorial_topic_votes')
      .update({ phone: normalizePhone(phone) })
      .eq('voter_id', voterId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
