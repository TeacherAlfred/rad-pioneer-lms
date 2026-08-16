import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DIFFICULTY_OPTIONS, COMPLETION_OPTIONS, WANTS_MORE_OPTIONS } from '@/lib/sessionReview';
import { computeSessionRating, countByOption, countByEnjoyment } from '@/lib/sessionRating';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// One computed view per session (RAD_Post_Session_Review_Spec.md S7) -
// deliberately calculated on every request, not cached/stored, same
// reasoning as photoClearance.ts: it should "stay live as the
// underlying data settles" (spec's own words) rather than go stale.
// Serves both the report page and the Reviews Status Panel on the
// sessions roster - one source of truth for what this session's
// reviews look like, so the two views can never disagree.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, starts_at, programme_id, programs(id, code, name)')
    .eq('id', sessionId)
    .single();
  if (sessionErr || !session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const { data: enrolments, error: enrolErr } = await supabaseAdmin
    .from('enrolments')
    .select('id, status, attended, kids(id, name)')
    .eq('session_id', sessionId)
    .neq('status', 'withdrawn');
  if (enrolErr) return NextResponse.json({ error: enrolErr.message }, { status: 500 });

  const roster = (enrolments || []).map((e: any) => e.kids).filter(Boolean);
  const kidIds = roster.map((k: any) => k.id);
  const bookedCount = roster.length;
  const markedCount = (enrolments || []).filter((e: any) => e.attended !== null).length;
  const presentCount = (enrolments || []).filter((e: any) => e.attended === true).length;
  // Response rate denominator: present count once attendance has
  // actually been marked, falling back to the full roster beforehand -
  // matches the spec's "12 of 14 present" framing without requiring
  // attendance to be marked first.
  const rosterSizeForRate = markedCount > 0 ? presentCount : bookedCount;

  const { data: reviews, error: reviewsErr } = await supabaseAdmin
    .from('session_reviews')
    .select('id, student_id, enjoyment, built_text, difficulty, completion, wants_more, open_text, hold_status, completed_at, submitted_at')
    .eq('session_id', sessionId);
  if (reviewsErr) return NextResponse.json({ error: reviewsErr.message }, { status: 500 });

  const reviewByKid = new Map((reviews || []).map(r => [r.student_id, r]));
  const rating = computeSessionRating(reviews || [], rosterSizeForRate);

  const distributions = {
    enjoyment: countByEnjoyment((reviews || []).map(r => r.enjoyment)),
    difficulty: countByOption((reviews || []).map(r => r.difficulty), DIFFICULTY_OPTIONS),
    completion: countByOption((reviews || []).map(r => r.completion), COMPLETION_OPTIONS),
    wantsMore: countByOption((reviews || []).map(r => r.wants_more), WANTS_MORE_OPTIONS),
  };

  // Quote consent per kid, for the quote harvest - "show consent status
  // against each so you can see at a glance what is publishable" (S7.1).
  const { data: consentRows } = await supabaseAdmin
    .from('consent_forms')
    .select('child_id, payload')
    .in('child_id', kidIds.length ? kidIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_current', true);
  const consentByKid = new Map((consentRows || []).map(r => [r.child_id, r.payload]));

  const rosterWithReviews = roster.map((k: any) => ({
    kidId: k.id,
    kidName: k.name,
    review: reviewByKid.get(k.id) || null,
  }));

  const quoteHarvest = roster
    .map((k: any) => {
      const review = reviewByKid.get(k.id);
      if (!review || (!review.built_text && !review.open_text)) return null;
      const payload = consentByKid.get(k.id) as any;
      return {
        kidId: k.id,
        kidName: k.name,
        builtText: review.built_text,
        openText: review.open_text,
        quoteConsent: !!payload?.photo?.feedbackQuoteConsent,
      };
    })
    .filter(Boolean);

  const followUps = {
    held: (reviews || [])
      .filter(r => r.hold_status === 'held')
      .map(r => ({ reviewId: r.id, kidName: (roster.find((k: any) => k.id === r.student_id) as any)?.name || 'Unknown' })),
    pendingPhotoConsent: roster
      .filter((k: any) => !consentByKid.has(k.id))
      .map((k: any) => ({ kidId: k.id, kidName: k.name })),
  };

  return NextResponse.json({
    session,
    counts: { booked: bookedCount, present: presentCount, marked: markedCount, reviewed: (reviews || []).length },
    rating,
    distributions,
    roster: rosterWithReviews,
    quoteHarvest,
    followUps,
  });
}
