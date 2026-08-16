// Computes what a photo may be used for from each identifiable subject's
// CURRENT consent_forms row - see RAD_Session_Photography_Process.md S2.4
// ("An image's clearance is the lowest tier held by any identifiable
// child in it... has to be computed, not judged") and the spec's own
// developer note leaning "calculated" over a stored column, so a
// consent downgrade is reflected everywhere the next time this runs,
// not just at the moment it happened.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhotoTierKey } from './consent';

export type { PhotoTierKey };

// tier5Video is deliberately excluded - this pass handles photos only.
export const PHOTO_TIER_ORDER: PhotoTierKey[] = ['tier1', 'tier2', 'tier3', 'tier4'];

export type PhotoClearance = {
  photoId: string;
  tier: number; // 0 = no identifiable-subject clearance yet, 1-4 = PHOTO_TIER_ORDER[tier-1]
  tierKey: PhotoTierKey | null;
  // Kids in frame with no current consent_forms row at all - the spec's
  // "pending" bucket, worth a follow-up. Distinct from a kid who has a
  // current row with every tier unticked (declined - don't re-ask).
  pendingSubjectKidIds: string[];
  declinedSubjectKidIds: string[];
};

function tierFromPhotoPayload(photo: Record<string, boolean> | undefined | null): number {
  if (!photo) return 0;
  for (let i = PHOTO_TIER_ORDER.length - 1; i >= 0; i--) {
    if (photo[PHOTO_TIER_ORDER[i]]) return i + 1;
  }
  return 0;
}

// Bulk variant - one query for all subjects across the given photos and
// one for all distinct kids' current consent, rather than N+1 per photo.
// Use this for any list view (the catalogue tab renders many photos at
// once).
export async function computePhotoClearanceBulk(
  supabaseAdmin: SupabaseClient,
  photoIds: string[]
): Promise<Map<string, PhotoClearance>> {
  const result = new Map<string, PhotoClearance>();
  if (photoIds.length === 0) return result;

  const { data: subjectRows, error: subjectsErr } = await supabaseAdmin
    .from('session_photo_subjects')
    .select('photo_id, kid_id')
    .in('photo_id', photoIds)
    .eq('identifiable', true);
  if (subjectsErr) throw subjectsErr;

  const subjectsByPhoto = new Map<string, string[]>();
  const allKidIds = new Set<string>();
  for (const row of subjectRows || []) {
    const list = subjectsByPhoto.get(row.photo_id) || [];
    list.push(row.kid_id);
    subjectsByPhoto.set(row.photo_id, list);
    allKidIds.add(row.kid_id);
  }

  const consentByKid = new Map<string, Record<string, boolean>>();
  if (allKidIds.size > 0) {
    const { data: consentRows, error: consentErr } = await supabaseAdmin
      .from('consent_forms')
      .select('child_id, payload')
      .in('child_id', Array.from(allKidIds))
      .eq('is_current', true);
    if (consentErr) throw consentErr;
    for (const row of consentRows || []) {
      consentByKid.set(row.child_id, row.payload?.photo || null);
    }
  }

  for (const photoId of photoIds) {
    const kidIds = subjectsByPhoto.get(photoId) || [];
    // No identifiable subjects at all (e.g. a cropped derivative) - no
    // consent requirement, cleared for anything (spec S2.4).
    if (kidIds.length === 0) {
      result.set(photoId, {
        photoId, tier: 4, tierKey: 'tier4',
        pendingSubjectKidIds: [], declinedSubjectKidIds: [],
      });
      continue;
    }

    let minTier = 4;
    const pending: string[] = [];
    const declined: string[] = [];
    for (const kidId of kidIds) {
      if (!consentByKid.has(kidId)) {
        pending.push(kidId);
        minTier = 0;
        continue;
      }
      const kidTier = tierFromPhotoPayload(consentByKid.get(kidId));
      if (kidTier === 0) declined.push(kidId);
      minTier = Math.min(minTier, kidTier);
    }

    result.set(photoId, {
      photoId,
      tier: minTier,
      tierKey: minTier > 0 ? PHOTO_TIER_ORDER[minTier - 1] : null,
      pendingSubjectKidIds: pending,
      declinedSubjectKidIds: declined,
    });
  }

  return result;
}

export async function computePhotoClearance(
  supabaseAdmin: SupabaseClient,
  photoId: string
): Promise<PhotoClearance> {
  const map = await computePhotoClearanceBulk(supabaseAdmin, [photoId]);
  return map.get(photoId)!;
}

// Where a usage-log destination sits relative to the tiers - used to
// warn if an admin tries to log a publish beyond a photo's clearance,
// and to decide which past usage rows a consent downgrade puts at risk.
export const DESTINATION_MIN_TIER: Record<string, number> = {
  parent_progress_view: 1,
  parents_whatsapp_group: 2,
  website: 3,
  organic_social: 3,
  paid_advertising: 4,
};
