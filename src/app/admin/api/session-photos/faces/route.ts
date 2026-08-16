import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { descriptorDistance, FACE_MATCH_THRESHOLD } from '@/lib/faceMatch';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Saves the faces face-api.js detected for one photo (run once client-side,
// see the Catalogue tab) and marks the photo as processed so it's never
// re-run. bbox is fractional (0-1 of image width/height) so it survives
// any future resize; descriptor is the raw 128-d array face-api.js
// produces, stored as-is for distance comparison later.
export async function POST(req: Request) {
  try {
    const { photoId, faces } = await req.json();
    if (!photoId || !Array.isArray(faces)) {
      return NextResponse.json({ error: 'photoId and faces[] are required' }, { status: 400 });
    }

    if (faces.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from('session_photo_faces')
        .insert(faces.map((f: any) => ({ photo_id: photoId, bbox: f.bbox, descriptor: f.descriptor })));
      if (insertErr) throw insertErr;
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
// like a manually-checklist-tagged subject.
//
// When assigning a SINGLE face (not a confirmed batch), also looks for
// other still-unassigned faces in THIS SESSION ONLY whose descriptor is
// close enough to plausibly be the same child, and returns them as
// suggestedMatches - never applied automatically. The admin reviews and
// calls this route again with `ids` to confirm a batch; per explicit
// instruction this must never happen invisibly.
export async function PATCH(req: Request) {
  try {
    const { id, ids, kidId } = await req.json();
    const faceIds: string[] = ids && Array.isArray(ids) ? ids : id ? [id] : [];
    if (faceIds.length === 0 || !kidId) {
      return NextResponse.json({ error: 'id (or ids[]) and kidId are required' }, { status: 400 });
    }

    const { data: faceRows, error: faceErr } = await supabaseAdmin
      .from('session_photo_faces')
      .select('id, photo_id, descriptor, session_photos(session_id)')
      .in('id', faceIds);
    if (faceErr) throw faceErr;
    if (!faceRows || faceRows.length === 0) {
      return NextResponse.json({ error: 'Face(s) not found' }, { status: 404 });
    }

    await supabaseAdmin.from('session_photo_faces').update({ kid_id: kidId }).in('id', faceIds);

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
        const { data: candidates } = await supabaseAdmin
          .from('session_photo_faces')
          .select('id, photo_id, bbox, descriptor, session_photos!inner(session_id)')
          .eq('session_photos.session_id', sessionId)
          .is('kid_id', null)
          .neq('id', faceIds[0]);

        suggestedMatches = (candidates || [])
          .map((c: any) => ({ id: c.id, photoId: c.photo_id, bbox: c.bbox, distance: descriptorDistance(face.descriptor, c.descriptor) }))
          .filter((c) => c.distance < FACE_MATCH_THRESHOLD)
          .sort((a, b) => a.distance - b.distance);
      }
    }

    return NextResponse.json({ ok: true, suggestedMatches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
