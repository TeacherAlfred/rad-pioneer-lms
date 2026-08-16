import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computePhotoClearance, DESTINATION_MIN_TIER } from '@/lib/photoClearance';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PUBLIC_DESTINATIONS = new Set(['website', 'organic_social', 'paid_advertising']);

// The usage log (spec S5 rule 2: every publication logged, so the
// 7-working-day withdrawal promise is keepable). ?needsRemoval=true
// filters to the withdrawal-diff queue for the admin view.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get('photoId');
  const needsRemoval = searchParams.get('needsRemoval');

  let query = supabaseAdmin
    .from('session_photo_usage')
    .select('*, session_photos(id, r2_key, session_id)')
    .order('published_at', { ascending: false });
  if (photoId) query = query.eq('photo_id', photoId);
  if (needsRemoval === 'true') query = query.eq('needs_removal', true).is('removed_at', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const rows = (data || []).map((r: any) => ({
    ...r,
    photo_url: r.session_photos ? `${r2Url}/${r.session_photos.r2_key}` : null,
  }));
  return NextResponse.json({ rows });
}

// Logs a publish event. Checks the destination against the photo's live
// clearance (spec S5 rule 1: "re-checked at the point of use") and warns
// - doesn't block, since a human may have a documented exception - if
// publishing beyond clearance, or alongside an already-approved
// testimonial quote from the same child+session (spec S5 rule 3:
// "never publish a quote and an identifiable image from the same
// session together").
export async function POST(req: Request) {
  try {
    const { photoId, destination, publishedBy, notes } = await req.json();
    if (!photoId || !destination) {
      return NextResponse.json({ error: 'photoId and destination are required' }, { status: 400 });
    }

    const warnings: string[] = [];
    const clearance = await computePhotoClearance(supabaseAdmin, photoId);
    const requiredTier = DESTINATION_MIN_TIER[destination];
    if (requiredTier !== undefined && clearance.tier < requiredTier) {
      warnings.push(
        `This photo's current clearance (tier ${clearance.tier}) is below what "${destination}" requires (tier ${requiredTier}). Publishing anyway - double-check consent before proceeding.`
      );
    }
    if (clearance.pendingSubjectKidIds.length > 0) {
      warnings.push('This photo includes a child whose guardian has not yet answered the photo consent form.');
    }

    if (PUBLIC_DESTINATIONS.has(destination)) {
      const { data: photo } = await supabaseAdmin
        .from('session_photos')
        .select('session_id, identifiable')
        .eq('id', photoId)
        .single();
      if (photo?.identifiable) {
        const { data: subjects } = await supabaseAdmin
          .from('session_photo_subjects')
          .select('kid_id')
          .eq('photo_id', photoId)
          .eq('identifiable', true);
        const kidIds = (subjects || []).map((s) => s.kid_id);
        if (kidIds.length > 0 && photo.session_id) {
          const { data: reviews } = await supabaseAdmin
            .from('session_reviews')
            .select('id, student_id')
            .eq('session_id', photo.session_id)
            .in('student_id', kidIds);
          const reviewIds = (reviews || []).map((r) => r.id);
          if (reviewIds.length > 0) {
            const { data: testimonials } = await supabaseAdmin
              .from('testimonials')
              .select('id')
              .in('source_review_id', reviewIds)
              .eq('status', 'approved');
            if ((testimonials || []).length > 0) {
              warnings.push(
                'A testimonial quote from a child in this photo is already published - publishing both together risks re-identifying that child to their own school community (spec S5 rule 3).'
              );
            }
          }
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('session_photo_usage')
      .insert([{ photo_id: photoId, destination, published_by: publishedBy || null, notes: notes || null }])
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ row: data, warnings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Marks a usage entry as actually removed (the withdrawal path's last
// step - spec S5: "mark the image withdrawn so it can never re-enter a
// selection" is handled by clearance being computed live; this is the
// human confirmation that the external removal actually happened).
export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('session_photo_usage')
      .update({ removed_at: new Date().toISOString(), needs_removal: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
