// Detects a consent downgrade between two submissions of the same
// guardian's ConsentPayload - see RAD_Session_Photography_Process.md S5,
// "withdrawn: previously granted, since revoked... must trigger: find
// every logged usage - remove - confirm - mark withdrawn." Called from
// src/app/api/consent/[token]/route.ts right after a resubmission is
// inserted and the old row's is_current flips to false.
import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_TIER_ORDER, DESTINATION_MIN_TIER, type PhotoTierKey } from './photoClearance';

export function detectDowngradedTiers(
  prevPhoto: Record<string, boolean> | null | undefined,
  nextPhoto: Record<string, boolean> | null | undefined
): PhotoTierKey[] {
  if (!prevPhoto) return [];
  return PHOTO_TIER_ORDER.filter((tier) => !!prevPhoto[tier] && !nextPhoto?.[tier]);
}

// For a kid whose guardian just downgraded consent, flags every past
// usage-log entry that relied on a tier they no longer hold - i.e. any
// destination whose required tier is above the kid's new lowest-tier
// index (using the same PHOTO_TIER_ORDER position as photoClearance.ts).
// A photo with multiple subjects is only flagged for the tiers THIS
// kid's downgrade affects, not the whole photo's history indiscriminately.
export async function flagUsageForDowngradedChild(
  supabaseAdmin: SupabaseClient,
  kidId: string,
  downgradedTiers: PhotoTierKey[]
): Promise<number> {
  if (downgradedTiers.length === 0) return 0;

  const minDowngradedRank = Math.min(...downgradedTiers.map((t) => PHOTO_TIER_ORDER.indexOf(t) + 1));

  const { data: subjectRows } = await supabaseAdmin
    .from('session_photo_subjects')
    .select('photo_id')
    .eq('kid_id', kidId)
    .eq('identifiable', true);
  const photoIds = (subjectRows || []).map((r) => r.photo_id);
  if (photoIds.length === 0) return 0;

  const { data: usageRows } = await supabaseAdmin
    .from('session_photo_usage')
    .select('id, destination')
    .in('photo_id', photoIds)
    .is('removed_at', null)
    .eq('needs_removal', false);

  const toFlag = (usageRows || [])
    .filter((u) => (DESTINATION_MIN_TIER[u.destination] || 0) >= minDowngradedRank)
    .map((u) => u.id);
  if (toFlag.length === 0) return 0;

  await supabaseAdmin.from('session_photo_usage').update({ needs_removal: true }).in('id', toFlag);
  return toFlag.length;
}
