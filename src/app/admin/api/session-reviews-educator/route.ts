import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('session_reviews_educator').select('*').eq('session_id', sessionId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data || null });
}

// Upsert - one row per session. Not optional per the spec ("this is
// where the operational learning lives"), but there's no separate
// educator login yet, so this is filled in from the admin roster view.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sessionId, educatorName, attendanceActual, timing, failuresText,
      struggledStudentIds, excelledStudentIds, curriculumNotes, mediaCaptured, mediaCount,
    } = body;
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const payload = {
      session_id: sessionId,
      educator_name: educatorName || null,
      attendance_actual: attendanceActual === '' || attendanceActual === undefined ? null : Number(attendanceActual),
      timing: timing || null,
      failures_text: failuresText || null,
      struggled_student_ids: Array.isArray(struggledStudentIds) ? struggledStudentIds : [],
      excelled_student_ids: Array.isArray(excelledStudentIds) ? excelledStudentIds : [],
      curriculum_notes: curriculumNotes || null,
      media_captured: !!mediaCaptured,
      media_count: mediaCount === '' || mediaCount === undefined ? null : Number(mediaCount),
      submitted_at: new Date().toISOString(),
    };

    const { data: existing } = await supabaseAdmin.from('session_reviews_educator').select('id').eq('session_id', sessionId).maybeSingle();
    let row;
    if (existing) {
      const { data, error } = await supabaseAdmin.from('session_reviews_educator').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabaseAdmin.from('session_reviews_educator').insert([payload]).select().single();
      if (error) throw error;
      row = data;
    }
    return NextResponse.json({ row });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
