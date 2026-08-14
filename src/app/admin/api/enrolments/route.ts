import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENROLMENT_STATUSES } from '@/lib/programs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A Student enrols on a Session (a dated delivery), not a Programme
// directly. ?studentId= or ?sessionId= scopes the list; omitted, returns
// everyone (mainly for debugging - /admin/kids and /admin/programs get
// enrolments embedded in their own GETs instead of calling this).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const sessionId = searchParams.get('sessionId');

  let query = supabaseAdmin
    .from('enrolments')
    .select('*, kids(id, name), sessions(id, starts_at, programme_id, programs(id, code, name))')
    .order('created_at', { ascending: false });
  if (studentId) query = query.eq('student_id', studentId);
  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const { studentId, sessionId, status, notes } = await req.json();
    if (!studentId || !sessionId) {
      return NextResponse.json({ error: 'studentId and sessionId are required' }, { status: 400 });
    }
    if (status !== undefined && !ENROLMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${ENROLMENT_STATUSES.join(', ')}` }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('enrolments')
      .insert([{ student_id: studentId, session_id: sessionId, status: status || 'registered', notes: notes || null }])
      .select('*, sessions(id, starts_at, programme_id, programs(id, code, name))')
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status, notes } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (status !== undefined && !ENROLMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${ENROLMENT_STATUSES.join(', ')}` }, { status: 400 });
    }
    const update: Record<string, any> = {};
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes || null;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('enrolments')
      .update(update)
      .eq('id', id)
      .select('*, sessions(id, starts_at, programme_id, programs(id, code, name))')
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
    const { error } = await supabaseAdmin.from('enrolments').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
