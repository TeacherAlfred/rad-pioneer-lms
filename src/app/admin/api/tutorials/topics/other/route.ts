import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Raw list - the admin page groups these by normalized text itself so it
// can show "3 people asked for this" instead of three separate rows.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tutorial_topic_other_suggestions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Dismisses one or more raw submissions at once - used both for "not
// interesting, discard" on a single row and for clearing a whole group
// after it's been promoted to a real topic.
export async function DELETE(req: Request) {
  try {
    const { id, ids } = await req.json();
    const targetIds: string[] = ids || (id ? [id] : []);
    if (targetIds.length === 0) return NextResponse.json({ error: 'id or ids is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('tutorial_topic_other_suggestions').delete().in('id', targetIds);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
