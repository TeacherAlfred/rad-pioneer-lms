import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PROGRAM_TYPES, PROGRAM_STATUSES } from '@/lib/programs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('programs')
    .select('*, program_enrollments(id)')
    .order('start_date', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || []).map((r: any) => {
    const { program_enrollments, ...rest } = r;
    return { ...rest, enrollment_count: (program_enrollments || []).length };
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, type, description, start_date, end_date, location, status } = body;
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (type !== undefined && !PROGRAM_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${PROGRAM_TYPES.join(', ')}` }, { status: 400 });
    }
    if (status !== undefined && !PROGRAM_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${PROGRAM_STATUSES.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('programs')
      .insert([{
        name: String(name).trim(),
        type: type || 'course',
        description: description || null,
        start_date: start_date || null,
        end_date: end_date || null,
        location: location || null,
        status: status || 'active',
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, name, type, description, start_date, end_date, location, status } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    if (type !== undefined && !PROGRAM_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${PROGRAM_TYPES.join(', ')}` }, { status: 400 });
    }
    if (status !== undefined && !PROGRAM_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${PROGRAM_STATUSES.join(', ')}` }, { status: 400 });
    }

    const update: Record<string, any> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (type !== undefined) update.type = type;
    if (description !== undefined) update.description = description || null;
    if (start_date !== undefined) update.start_date = start_date || null;
    if (end_date !== undefined) update.end_date = end_date || null;
    if (location !== undefined) update.location = location || null;
    if (status !== undefined) update.status = status;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('programs').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Cascades to program_enrollments (on delete cascade) - deleting a
// program also removes every kid's enrollment record for it.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('programs').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
