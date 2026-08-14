import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Links an existing kid to an existing lead (e.g. adding the second
// parent as a guardian after the kid was already created).
export async function POST(req: Request) {
  try {
    const { kidId, leadId, relationship } = await req.json();
    if (!kidId || !leadId) {
      return NextResponse.json({ error: 'kidId and leadId are required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('kid_guardians')
      .insert([{ kid_id: kidId, lead_id: leadId, relationship: relationship || null }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That guardian is already linked to this kid.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { kidId, leadId } = await req.json();
    if (!kidId || !leadId) {
      return NextResponse.json({ error: 'kidId and leadId are required' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('kid_guardians')
      .delete()
      .eq('kid_id', kidId)
      .eq('lead_id', leadId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
