// Cross-session face recognition on top of the same-session matching in
// faceMatch.ts. A kid's profile is a running average descriptor built
// from every face confirmed as them, across every session - the more
// they're tagged, the more representative (and accurate) it gets. This
// is what actually improves over time; raw same-session matching never
// does, since it only ever compares two single instances.
import type { SupabaseClient } from '@supabase/supabase-js';
import { descriptorDistance, FACE_MATCH_THRESHOLD } from './faceMatch';

export async function matchAgainstProfiles(
  supabaseAdmin: SupabaseClient,
  descriptor: number[]
): Promise<{ kidId: string; distance: number } | null> {
  const { data: profiles } = await supabaseAdmin.from('kid_face_profiles').select('kid_id, descriptor');
  let best: { kidId: string; distance: number } | null = null;
  for (const p of profiles || []) {
    const distance = descriptorDistance(descriptor, p.descriptor as number[]);
    if (distance < FACE_MATCH_THRESHOLD && (!best || distance < best.distance)) {
      best = { kidId: p.kid_id, distance };
    }
  }
  return best;
}

// Incremental mean, one dimension at a time - mathematically exact
// regardless of how many samples came before, which is what lets
// removeFromProfile below undo one specific sample later without
// needing to replay the whole history.
export async function foldIntoProfile(supabaseAdmin: SupabaseClient, kidId: string, descriptor: number[]): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('kid_face_profiles')
    .select('descriptor, sample_count')
    .eq('kid_id', kidId)
    .maybeSingle();

  if (!existing || existing.sample_count === 0) {
    await supabaseAdmin
      .from('kid_face_profiles')
      .upsert([{ kid_id: kidId, descriptor, sample_count: 1, updated_at: new Date().toISOString() }], { onConflict: 'kid_id' });
    return;
  }

  const n = existing.sample_count;
  const oldAvg = existing.descriptor as number[];
  const newAvg = oldAvg.map((v, i) => v + (descriptor[i] - v) / (n + 1));
  await supabaseAdmin
    .from('kid_face_profiles')
    .update({ descriptor: newAvg, sample_count: n + 1, updated_at: new Date().toISOString() })
    .eq('kid_id', kidId);
}

// Exact inverse of foldIntoProfile - used when an admin untags a face
// that had already been folded in, so correcting a mistake doesn't
// leave the profile permanently skewed by it.
export async function removeFromProfile(supabaseAdmin: SupabaseClient, kidId: string, descriptor: number[]): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('kid_face_profiles')
    .select('descriptor, sample_count')
    .eq('kid_id', kidId)
    .maybeSingle();
  if (!existing) return;

  if (existing.sample_count <= 1) {
    await supabaseAdmin.from('kid_face_profiles').delete().eq('kid_id', kidId);
    return;
  }

  const n = existing.sample_count;
  const avg = existing.descriptor as number[];
  const restored = avg.map((v, i) => (v * n - descriptor[i]) / (n - 1));
  await supabaseAdmin
    .from('kid_face_profiles')
    .update({ descriptor: restored, sample_count: n - 1, updated_at: new Date().toISOString() })
    .eq('kid_id', kidId);
}
