import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ageFromDob } from '@/lib/consent';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  let query = supabaseAdmin.from('testimonials').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Creates a candidate from a child's review. consent_verified is derived
// server-side from that child's current consent form
// (payload.photo.feedbackQuoteConsent) - never taken on the admin's say-so,
// since a child cannot consent to publication on their own behalf and the
// guardian's tick is the only thing that makes this usable at all.
export async function POST(req: Request) {
  try {
    const { sourceReviewId, quoteText } = await req.json();
    if (!sourceReviewId || !quoteText?.trim()) {
      return NextResponse.json({ error: 'sourceReviewId and quoteText are required' }, { status: 400 });
    }

    const { data: review, error: reviewErr } = await supabaseAdmin
      .from('session_reviews')
      .select('id, session_id, student_id, sessions(id, starts_at, programme_id, programs(id, name))')
      .eq('id', sourceReviewId)
      .single();
    if (reviewErr || !review) return NextResponse.json({ error: 'Review not found.' }, { status: 404 });

    const { data: kid } = await supabaseAdmin.from('kids').select('date_of_birth').eq('id', review.student_id).single();
    const displayAge = kid?.date_of_birth ? ageFromDob(kid.date_of_birth) : null;

    const { data: consentForm } = await supabaseAdmin
      .from('consent_forms')
      .select('payload')
      .eq('child_id', review.student_id)
      .eq('is_current', true)
      .maybeSingle();
    const consentVerified = !!(consentForm?.payload as any)?.photo?.feedbackQuoteConsent;

    const session = (review as any).sessions;
    const displayMonth = session?.starts_at
      ? new Date(session.starts_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
      : null;

    const { data, error } = await supabaseAdmin
      .from('testimonials')
      .insert([{
        source_review_id: review.id,
        session_id: review.session_id,
        quote_text: quoteText.trim(),
        display_age: displayAge,
        display_programme: session?.programs?.name || null,
        display_month: displayMonth,
        consent_verified: consentVerified,
        status: 'pending',
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status, approvedBy, quoteText } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (status && !['pending', 'approved', 'rejected', 'published'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    const update: Record<string, any> = {};
    if (quoteText !== undefined) update.quote_text = quoteText.trim();
    if (status) {
      update.status = status;
      if (status === 'approved' || status === 'published') {
        update.approved_by = approvedBy || null;
        update.approved_at = new Date().toISOString();
      }
    }
    const { data, error } = await supabaseAdmin.from('testimonials').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
