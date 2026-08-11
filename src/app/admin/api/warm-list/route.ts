import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lives under /admin so src/middleware.ts's existing auth guard (only the
// site owner gets past /admin/*) protects this route automatically.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('warm_list_staging')
    .select('*')
    .order('review_status', { ascending: true })
    .order('last_seen', { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

// Edits a row in place - name/phone/email corrections, review decisions, notes.
// Admin's own sanity-check pass before anything reaches the real leads table.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const allowed = ['name', 'phone', 'email', 'contact_method', 'location', 'source', 'tags', 'status_category', 'review_status', 'review_note'];
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key];
    }

    const { data, error } = await supabaseAdmin
      .from('warm_list_staging')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Manually add a lead that wasn't in any import - starts at review_status
// 'pending' like everything else, same gate before it can be committed.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, email, location, source, tags } = body;

    if (!phone && !email) {
      return NextResponse.json({ error: 'At least a phone or email is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('warm_list_staging')
      .insert([{
        name: name || null,
        phone: phone || null,
        email: email || null,
        contact_method: phone ? 'whatsapp' : 'email',
        location: location || null,
        source: source || 'warm_list',
        tags: Array.isArray(tags) ? tags : [],
        status_category: 'lead',
        sources: 'manual',
        review_status: 'pending',
        added_manually: true,
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
