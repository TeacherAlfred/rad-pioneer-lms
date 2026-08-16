import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { removeFromProfile } from '@/lib/faceProfile';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_SELECTED_PER_CHILD = 3;

// Tags a kid as appearing in a photo (spec S2.3 manifest.subjects[]).
export async function POST(req: Request) {
  try {
    const { photoId, kidId } = await req.json();
    if (!photoId || !kidId) {
      return NextResponse.json({ error: 'photoId and kidId are required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('session_photo_subjects')
      .insert([{ photo_id: photoId, kid_id: kidId }])
      .select('*, kids(id, name)')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That child is already tagged in this photo.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Edits identifiable (per-subject - a kid turned away in a group shot
// may not be identifiable even when others are, see photoClearance.ts)
// and selected_for_parent (the up-to-3 gift picks - spec S3, "pick up
// to three"). Enforces the cap here rather than trusting the client.
export async function PATCH(req: Request) {
  try {
    const { id, identifiable, selected_for_parent } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (selected_for_parent) {
      const { data: subject } = await supabaseAdmin
        .from('session_photo_subjects')
        .select('kid_id, photo_id, session_photos(session_id)')
        .eq('id', id)
        .single();
      if (subject) {
        const sessionId = (subject as any).session_photos?.session_id;
        const { data: existingSelected } = await supabaseAdmin
          .from('session_photo_subjects')
          .select('id, session_photos!inner(session_id)')
          .eq('kid_id', subject.kid_id)
          .eq('selected_for_parent', true)
          .eq('session_photos.session_id', sessionId)
          .neq('id', id);
        if ((existingSelected || []).length >= MAX_SELECTED_PER_CHILD) {
          return NextResponse.json(
            { error: `Already ${MAX_SELECTED_PER_CHILD} photos selected for this child - remove one first.` },
            { status: 409 }
          );
        }
      }
    }

    const update: Record<string, any> = {};
    if (identifiable !== undefined) update.identifiable = !!identifiable;
    if (selected_for_parent !== undefined) update.selected_for_parent = !!selected_for_parent;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('session_photo_subjects')
      .update(update)
      .eq('id', id)
      .select('*, kids(id, name)')
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: subject } = await supabaseAdmin
      .from('session_photo_subjects')
      .select('photo_id, kid_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabaseAdmin.from('session_photo_subjects').delete().eq('id', id);
    if (error) throw error;

    // A face box assigned to this kid on this photo must go back to
    // unassigned, not keep pointing at a subject that no longer exists -
    // otherwise the face overlay still shows the old name after untagging.
    // Any face here that had already been folded into the kid's
    // cross-session profile (profile_updated) gets exactly subtracted
    // back out first, so correcting a mistake doesn't leave the profile
    // permanently skewed by it (see removeFromProfile).
    if (subject) {
      const { data: facesToClear } = await supabaseAdmin
        .from('session_photo_faces')
        .select('id, descriptor, profile_updated')
        .eq('photo_id', subject.photo_id)
        .eq('kid_id', subject.kid_id);

      for (const face of facesToClear || []) {
        if (face.profile_updated) {
          await removeFromProfile(supabaseAdmin, subject.kid_id, face.descriptor as number[]);
        }
      }

      await supabaseAdmin
        .from('session_photo_faces')
        .update({ kid_id: null, profile_updated: false, suggested_kid_id: null, suggested_distance: null })
        .eq('photo_id', subject.photo_id)
        .eq('kid_id', subject.kid_id);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
