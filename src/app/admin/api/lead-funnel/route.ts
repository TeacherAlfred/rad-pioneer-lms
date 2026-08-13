import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStatusChange } from '@/lib/leadStatusHistory';
import { FUNNEL_STAGES } from '@/lib/funnelStages';

// Service role: leads has zero anon RLS policies since the 2026-08-12
// lockdown, so a browser-side client can no longer read this table directly.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

// Edits tags and/or status. Status edits are the manual path (from the
// stages dashboard) for outcomes the bot/admin-button flow can't set
// itself - primarily converted/lost, but any stage can be corrected here.
export async function PATCH(req: Request) {
  try {
    const { id, tags, status } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 });
    }
    if (status !== undefined && !FUNNEL_STAGES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${FUNNEL_STAGES.join(', ')}` }, { status: 400 });
    }

    const update: Record<string, any> = {};
    if (tags !== undefined) update.tags = tags;
    if (status !== undefined) {
      update.status = status;
      if (status === 'contacted') update.contacted_at = new Date().toISOString();
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update - provide tags and/or status' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (status !== undefined) await recordStatusChange(supabaseAdmin, id, status);
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
