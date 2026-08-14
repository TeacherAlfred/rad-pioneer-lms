import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENROLLMENT_STATUSES } from '@/lib/programs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ?kidId= or ?programId= scopes the list; omitted, returns everyone
// (mainly for debugging - the kids/programs pages get enrollments
// embedded in their own GETs instead of calling this directly).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kidId = searchParams.get('kidId');
  const programId = searchParams.get('programId');

  let query = supabaseAdmin
    .from('program_enrollments')
    .select('*, kids(id, name), programs(id, name, type)')
    .order('created_at', { ascending: false });
  if (kidId) query = query.eq('kid_id', kidId);
  if (programId) query = query.eq('program_id', programId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const { kidId, programId, status, notes } = await req.json();
    if (!kidId || !programId) {
      return NextResponse.json({ error: 'kidId and programId are required' }, { status: 400 });
    }
    if (status !== undefined && !ENROLLMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${ENROLLMENT_STATUSES.join(', ')}` }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('program_enrollments')
      .insert([{ kid_id: kidId, program_id: programId, status: status || 'registered', notes: notes || null }])
      .select('*, programs(id, name, type)')
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
    if (status !== undefined && !ENROLLMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${ENROLLMENT_STATUSES.join(', ')}` }, { status: 400 });
    }
    const update: Record<string, any> = {};
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes || null;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('program_enrollments')
      .update(update)
      .eq('id', id)
      .select('*, programs(id, name, type)')
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
    const { error } = await supabaseAdmin.from('program_enrollments').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
