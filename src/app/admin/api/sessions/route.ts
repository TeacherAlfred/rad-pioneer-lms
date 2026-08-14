import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SESSION_STATUSES } from '@/lib/programs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A Session is one dated, priced, staffed delivery of a Programme - see
// RAD_Programme_Model_and_Catalogue.md section 2.4/4.1. ?programmeId=
// scopes the list to one programme (the normal case - sessions are
// managed from within a programme's card on /admin/programs); omitted,
// returns all.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const programmeId = searchParams.get('programmeId');

  let query = supabaseAdmin
    .from('sessions')
    .select('*, programs(id, code, name), enrolments(id)')
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (programmeId) query = query.eq('programme_id', programmeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || []).map((r: any) => {
    const { enrolments, ...rest } = r;
    return { ...rest, enrolment_count: (enrolments || []).length };
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      programmeId, parentSessionId, starts_at, ends_at, sales_open_at, sales_close_at,
      early_bird_ends_at, venue, capacity, min_viable_enrolments, go_no_go_at,
      status, price, currency, notes,
    } = body;

    if (!programmeId) return NextResponse.json({ error: 'programmeId is required' }, { status: 400 });
    if (status !== undefined && !SESSION_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${SESSION_STATUSES.join(', ')}` }, { status: 400 });
    }
    // "sales_close_at must be >= 48h before starts_at" - pre-registration
    // holds a seat for 48h while the parent arranges a deposit, so a
    // window that violates this can never actually be completed.
    if (sales_close_at && starts_at) {
      const gapHours = (new Date(starts_at).getTime() - new Date(sales_close_at).getTime()) / 36e5;
      if (gapHours < 48) {
        return NextResponse.json({ error: 'sales_close_at must be at least 48 hours before starts_at' }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert([{
        programme_id: programmeId,
        parent_session_id: parentSessionId || null,
        starts_at: starts_at || null,
        ends_at: ends_at || null,
        sales_open_at: sales_open_at || null,
        sales_close_at: sales_close_at || null,
        early_bird_ends_at: early_bird_ends_at || null,
        venue: venue || null,
        capacity: capacity === '' || capacity === undefined ? null : Number(capacity),
        min_viable_enrolments: min_viable_enrolments === '' || min_viable_enrolments === undefined ? null : Number(min_viable_enrolments),
        go_no_go_at: go_no_go_at || null,
        status: status || 'draft',
        price: price === '' || price === undefined ? null : Number(price),
        currency: currency || 'ZAR',
        notes: notes || null,
      }])
      .select('*, programs(id, code, name)')
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
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (body.status !== undefined && !SESSION_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${SESSION_STATUSES.join(', ')}` }, { status: 400 });
    }

    const fields = [
      'starts_at', 'ends_at', 'sales_open_at', 'sales_close_at', 'early_bird_ends_at',
      'venue', 'go_no_go_at', 'status', 'currency', 'notes',
    ];
    const numericFields = ['capacity', 'min_viable_enrolments', 'price'];
    const update: Record<string, any> = {};
    for (const f of fields) if (body[f] !== undefined) update[f] = body[f] || null;
    for (const f of numericFields) if (body[f] !== undefined) update[f] = body[f] === '' ? null : Number(body[f]);
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update(update)
      .eq('id', id)
      .select('*, programs(id, code, name)')
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Cascades to enrolments (on delete cascade) - deleting a session removes
// every student's enrolment record for it.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('sessions').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
