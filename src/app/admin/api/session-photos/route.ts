import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computePhotoClearanceBulk } from '@/lib/photoClearance';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Session info + roster (from enrolments, each kid's guardians for the
// delivery step) + every catalogued photo with its subjects and live
// computed clearance (src/lib/photoClearance.ts - never stored, so a
// consent change is reflected on next load without a backfill).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, starts_at, venue, programs(id, code, name)')
    .eq('id', sessionId)
    .single();
  if (sessionErr || !session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const { data: enrolments, error: enrolErr } = await supabaseAdmin
    .from('enrolments')
    .select('id, status, kids(id, name)')
    .eq('session_id', sessionId)
    .neq('status', 'withdrawn');
  if (enrolErr) return NextResponse.json({ error: enrolErr.message }, { status: 500 });

  const roster = (enrolments || []).map((e: any) => e.kids).filter(Boolean);
  const kidIds = roster.map((k: any) => k.id);

  const { data: guardianLinks } = await supabaseAdmin
    .from('kid_guardians')
    .select('kid_id, leads(id, name, phone)')
    .in('kid_id', kidIds.length ? kidIds : ['00000000-0000-0000-0000-000000000000']);

  const guardiansByKid = new Map<string, any[]>();
  for (const link of guardianLinks || []) {
    const list = guardiansByKid.get(link.kid_id) || [];
    if (link.leads) list.push(link.leads);
    guardiansByKid.set(link.kid_id, list);
  }
  const { data: reviews } = await supabaseAdmin
    .from('session_reviews')
    .select('student_id, built_text, wants_more')
    .eq('session_id', sessionId)
    .in('student_id', kidIds.length ? kidIds : ['00000000-0000-0000-0000-000000000000']);
  const reviewByKid = new Map((reviews || []).map((r) => [r.student_id, r]));

  // Current photo-consent state per kid, for the Select & Send tab to
  // choose Message 2A (confirm what's already on record) vs 2B (ask) -
  // spec S4. No row = pending; a row with every tier false = declined;
  // any tier true = granted.
  const { data: consentRows } = await supabaseAdmin
    .from('consent_forms')
    .select('child_id, payload')
    .in('child_id', kidIds.length ? kidIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_current', true);
  const consentByKid = new Map((consentRows || []).map((r) => [r.child_id, r.payload?.photo || null]));

  const rosterWithGuardians = roster.map((k: any) => ({
    ...k,
    guardians: guardiansByKid.get(k.id) || [],
    review: reviewByKid.get(k.id) || null,
    photoConsent: consentByKid.has(k.id) ? consentByKid.get(k.id) : undefined,
  }));

  const { data: photos, error: photosErr } = await supabaseAdmin
    .from('session_photos')
    .select('*, session_photo_subjects(id, kid_id, identifiable, selected_for_parent, kids(id, name)), session_photo_faces(id, bbox, kid_id)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (photosErr) return NextResponse.json({ error: photosErr.message }, { status: 500 });

  const clearanceMap = await computePhotoClearanceBulk(supabaseAdmin, (photos || []).map((p: any) => p.id));
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const enrichedPhotos = (photos || []).map((p: any) => ({
    ...p,
    url: `${r2Url}/${p.r2_key}`,
    clearance: clearanceMap.get(p.id) || null,
  }));

  return NextResponse.json({ session, roster: rosterWithGuardians, photos: enrichedPhotos });
}

// Inserts the catalogue row after the browser has already PUT the file
// directly to R2 via /api/upload/r2 (same presign pattern as
// src/app/admin/media/page.tsx) - this route only records that it exists.
export async function POST(req: Request) {
  try {
    const { sessionId, r2Key, takenAt } = await req.json();
    if (!sessionId || !r2Key) {
      return NextResponse.json({ error: 'sessionId and r2Key are required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('session_photos')
      .insert([{ session_id: sessionId, r2_key: r2Key, taken_at: takenAt || null }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Edits catalogue metadata - quality rating, content_tags, the
// background-check tick (spec S2.5), the image-level identifiable flag,
// and the derivative relationship (spec S2.4's "keep both versions").
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, quality, content_tags, background_checked, identifiable, is_derivative, derivative_of, reset_face_detection } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const update: Record<string, any> = {};
    // Puts the photo back into the client-side detection queue (see the
    // Catalogue tab) - used to re-scan a photo that was already
    // processed but found zero faces, e.g. after switching to a more
    // accurate detector.
    if (reset_face_detection) update.faces_detected_at = null;
    if (quality !== undefined) update.quality = quality;
    if (content_tags !== undefined) update.content_tags = content_tags;
    if (background_checked !== undefined) update.background_checked = !!background_checked;
    if (identifiable !== undefined) update.identifiable = !!identifiable;
    if (is_derivative !== undefined) update.is_derivative = !!is_derivative;
    if (derivative_of !== undefined) update.derivative_of = derivative_of || null;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('session_photos').update(update).eq('id', id).select().single();
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
    const { error } = await supabaseAdmin.from('session_photos').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
