import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role: same lockdown as leads (RLS enabled, zero anon policies) -
// a browser-side client can't read these tables directly.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KID_SELECT = `
  *,
  kid_guardians(id, relationship, lead_id, leads(id, name, phone)),
  enrolments(id, status, notes, session_id, sessions(id, starts_at, programme_id, programs(id, code, name, type)))
`;

// ?leadId= scopes the roster to kids linked to one lead (used by the
// lead-funnel edit modal's "Kids" panel) - omitted, returns everyone.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId');

  let query = supabaseAdmin.from('kids').select(KID_SELECT).order('created_at', { ascending: false });

  if (leadId) {
    const { data: links, error: linkErr } = await supabaseAdmin
      .from('kid_guardians')
      .select('kid_id')
      .eq('lead_id', leadId);
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
    const kidIds = (links || []).map(l => l.kid_id);
    if (kidIds.length === 0) return NextResponse.json({ rows: [] });
    query = query.in('id', kidIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Creates a kid and optionally links 1+ guardians (leadIds) in the same
// call - the common path is "add a kid while looking at their parent's
// lead record", not creating an orphan kid first and linking separately.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, age, date_of_birth, grade, phone, email, notes, leadIds } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (leadIds !== undefined && !Array.isArray(leadIds)) {
      return NextResponse.json({ error: 'leadIds must be an array' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await supabaseAdmin
      .from('kids')
      .insert([{
        name: String(name).trim(),
        // date_of_birth is preferred once known; age is kept as a
        // fallback since WhatsApp-captured data is usually just an age.
        age: age === '' || age === undefined || age === null ? null : Number(age),
        date_of_birth: date_of_birth || null,
        grade: grade || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        source: 'manual',
      }])
      .select()
      .single();
    if (kidErr) throw kidErr;

    if (Array.isArray(leadIds) && leadIds.length > 0) {
      const { error: linkErr } = await supabaseAdmin
        .from('kid_guardians')
        .insert(leadIds.map((leadId: string) => ({ kid_id: kid.id, lead_id: leadId })));
      if (linkErr) throw linkErr;
    }

    return NextResponse.json({ row: kid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, name, age, date_of_birth, grade, phone, email, notes } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    const update: Record<string, any> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (age !== undefined) update.age = age === '' || age === null ? null : Number(age);
    if (date_of_birth !== undefined) update.date_of_birth = date_of_birth || null;
    if (grade !== undefined) update.grade = grade || null;
    if (phone !== undefined) update.phone = phone || null;
    if (email !== undefined) update.email = email || null;
    if (notes !== undefined) update.notes = notes || null;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('kids').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Cascades to kid_guardians and enrolments (on delete cascade) -
// removing a kid also removes their guardian links and enrolments.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('kids').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
