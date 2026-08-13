import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This is an activity feed, not an export tool - capped rather than
// unbounded. Raise if RAD's volume ever outgrows this mattering.
const LIMIT = 2000;

export async function GET() {
  const [{ data: messages, error: msgError }, { data: leads, error: leadError }] = await Promise.all([
    supabaseAdmin.from('messages').select('*').order('created_at', { ascending: false }).limit(LIMIT),
    supabaseAdmin.from('leads').select('id, phone, name, tags'),
  ]);

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });

  const leadsById = new Map((leads || []).map((l: any) => [l.id, l]));
  const rows = (messages || []).map((m: any) => {
    const lead = leadsById.get(m.lead_id);
    return {
      ...m,
      lead_phone: lead?.phone || null,
      lead_name: lead?.name || null,
      lead_tags: lead?.tags || [],
    };
  });

  return NextResponse.json({ rows });
}
