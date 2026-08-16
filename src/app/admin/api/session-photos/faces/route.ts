import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { descriptorDistance, FACE_MATCH_THRESHOLD } from '@/lib/faceMatch';
import { matchAgainstProfiles, foldIntoProfile } from '@/lib/faceProfile';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Saves the faces face-api.js detected for one photo (run once client-side,
// see the Catalogue tab) and marks the photo as processed so it's never
// re-run. bbox is fractional (0-1 of image width/height) so it survives
// any future resize; descriptor is the raw 128-d array face-api.js
// produces, stored as-is for distance comparison later.
//
// Each new face is also checked against every kid's cross-session
// profile (src/lib/faceProfile.ts) - if one matches, suggested_kid_id
// is set as a pure hint for the Catalogue tab to pre-fill ("maybe this
// kid?"), never applied automatically.
export async function POST(req: Request) {
  try {
    const { photoId, faces } = await req.json();
    if (!photoId || !Array.isArray(faces)) {
      return NextResponse.json({ error: 'photoId and faces[] are required' }, { status: 400 });
    }

    if (faces.length > 0) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('session_photo_faces')
        .insert(faces.map((f: any) => ({ photo_id: photoId, bbox: f.bbox, descriptor: f.descriptor })))
        .select('id, descriptor');
      if (insertErr) throw insertErr;

      for (const row of inserted || []) {
        const match = await matchAgainstProfiles(supabaseAdmin, row.descriptor as number[]);
        if (match) {
          await supabaseAdmin
            .from('session_photo_faces')
            .update({ suggested_kid_id: match.kidId, suggested_distance: match.distance })
            .eq('id', row.id);
        }
      }
    }

    await supabaseAdmin.from('session_photos').update({ faces_detected_at: new Date().toISOString() }).eq('id', photoId);
    return NextResponse.json({ ok: true, count: faces.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Assigns one or more detected faces to a roster kid - each assignment
// also creates the matching session_photo_subjects row (idempotent via
// unique(photo_id, kid_id)) so clearance computation sees it exactly
// like a manually-checklist-tagged subject, and folds the face's
// descriptor into that kid's cross-session profile (profile_updated
// guards against double-counting a re-confirm).
//
// When assigning a SINGLE face (not a confirmed batch), also looks for
// other still-unassigned faces in THIS SESSION ONLY whose descriptor is
// close enough to plausibly be the same child - matched against the
// kid's just-updated profile when one exists (more robust than the one
// raw descriptor just tagged), falling back to that descriptor for a
// kid with no history yet. Returned as suggestedMatches, never applied
// automatically - the admin reviews and calls this route again with
// `ids` to confirm a batch.
export async function PATCH(req: Request) {
  try {
    const { id, ids, kidId } = await req.json();
    const faceIds: string[] = ids && Array.isArray(ids) ? ids : id ? [id] : [];
    if (faceIds.length === 0 || !kidId) {
      return NextResponse.json({ error: 'id (or ids[]) and kidId are required' }, { status: 400 });
    }

    const { data: faceRows, error: faceErr } = await supabaseAdmin
      .from('session_photo_faces')
      .select('id, photo_id, descriptor, profile_updated, session_photos(session_id)')
      .in('id', faceIds);
    if (faceErr) throw faceErr;
    if (!faceRows || faceRows.length === 0) {
      return NextResponse.json({ error: 'Face(s) not found' }, { status: 404 });
    }

    await supabaseAdmin.from('session_photo_faces').update({ kid_id: kidId }).in('id', faceIds);

    for (const face of faceRows) {
      if (!face.profile_updated) {
        await foldIntoProfile(supabaseAdmin, kidId, face.descriptor as number[]);
        await supabaseAdmin.from('session_photo_faces').update({ profile_updated: true }).eq('id', face.id);
      }
    }

    const photoIds = Array.from(new Set(faceRows.map((f) => f.photo_id)));
    await supabaseAdmin
      .from('session_photo_subjects')
      .upsert(
        photoIds.map((photoId) => ({ photo_id: photoId, kid_id: kidId })),
        { onConflict: 'photo_id,kid_id', ignoreDuplicates: true }
      );

    let suggestedMatches: { id: string; photoId: string; bbox: any; distance: number }[] = [];
    if (faceIds.length === 1) {
      const face = faceRows[0];
      const sessionId = (face as any).session_photos?.session_id;
      if (sessionId) {
        const { data: profileRow } = await supabaseAdmin
          .from('kid_face_profiles')
          .select('descriptor')
          .eq('kid_id', kidId)
          .maybeSingle();
        const matchAgainst = (profileRow?.descriptor as number[]) || (face.descriptor as number[]);

        const { data: candidates } = await supabaseAdmin
          .from('session_photo_faces')
          .select('id, photo_id, bbox, descriptor, session_photos!inner(session_id)')
          .eq('session_photos.session_id', sessionId)
          .is('kid_id', null)
          .neq('id', faceIds[0]);

        suggestedMatches = (candidates || [])
          .map((c: any) => ({ id: c.id, photoId: c.photo_id, bbox: c.bbox, distance: descriptorDistance(matchAgainst, c.descriptor) }))
          .filter((c) => c.distance < FACE_MATCH_THRESHOLD)
          .sort((a, b) => a.distance - b.distance);
      }
    }

    return NextResponse.json({ ok: true, suggestedMatches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
