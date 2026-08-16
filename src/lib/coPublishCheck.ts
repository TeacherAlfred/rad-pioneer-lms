// RAD_Post_Session_Review_Spec.md S10.2 / RAD_Session_Photography_Process.md
// S5 rule 3: never publish a quote and an identifiable image from the
// same session together - combined, they can re-identify a specific
// child to their own school community. Checked from BOTH directions,
// since either a photo or a testimonial can go live first:
// - src/app/admin/api/session-photos/usage/route.ts checks for an
//   already-live testimonial before logging a photo publish.
// - checkTestimonialAgainstPublishedPhotos here checks for an already-
//   published photo before a testimonial goes live.
// Advisory only (warns, doesn't block) - a human may have a documented
// exception - but "live" deliberately includes both 'approved' and
// 'published' testimonial status, since an approved-but-not-yet-marked-
// published testimonial can already be sitting in a public queue.
import type { SupabaseClient } from '@supabase/supabase-js';

export const LIVE_TESTIMONIAL_STATUSES = ['approved', 'published'];
export const PUBLIC_PHOTO_DESTINATIONS = new Set(['website', 'organic_social', 'paid_advertising']);

export async function checkTestimonialAgainstPublishedPhotos(
  supabaseAdmin: SupabaseClient,
  testimonialId: string
): Promise<string[]> {
  const warnings: string[] = [];

  const { data: testimonial } = await supabaseAdmin
    .from('testimonials')
    .select('session_id, source_review_id')
    .eq('id', testimonialId)
    .single();
  if (!testimonial?.session_id || !testimonial.source_review_id) return warnings;

  const { data: review } = await supabaseAdmin
    .from('session_reviews')
    .select('student_id')
    .eq('id', testimonial.source_review_id)
    .maybeSingle();
  const studentId = review?.student_id;
  if (!studentId) return warnings;

  const { data: subjects } = await supabaseAdmin
    .from('session_photo_subjects')
    .select('photo_id, session_photos!inner(session_id)')
    .eq('kid_id', studentId)
    .eq('identifiable', true)
    .eq('session_photos.session_id', testimonial.session_id);
  const photoIds = (subjects || []).map((s: any) => s.photo_id);
  if (photoIds.length === 0) return warnings;

  const { data: usageRows } = await supabaseAdmin
    .from('session_photo_usage')
    .select('id, destination')
    .in('photo_id', photoIds)
    .is('removed_at', null);
  const publiclyUsed = (usageRows || []).some((u) => PUBLIC_PHOTO_DESTINATIONS.has(u.destination));
  if (publiclyUsed) {
    warnings.push(
      'An identifiable photo of this child from the same session is already published - publishing this quote alongside it risks re-identifying them to their own school community.'
    );
  }
  return warnings;
}
