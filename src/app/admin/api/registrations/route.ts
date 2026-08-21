import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Backs /admin/registrations. Aggregation (series -> instance -> month
// rollups) happens client-side, same as /admin/lead-funnel's useMemo
// pipeline - registration volume here doesn't warrant a second query layer.
export async function GET() {
  const [{ data: registrations, error: regErr }, { data: programs, error: progErr }] = await Promise.all([
    supabaseAdmin
      .from('event_registrations')
      .select('id, created_at, lead_id, program_id, program_title, series, location, date_option_id, date_label, number_of_children, preferred_channel, source')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('featured_programs')
      .select('id, title, series, location, live_from, live_until, draft')
      .order('live_from', { ascending: true }),
  ]);
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (progErr) return NextResponse.json({ error: progErr.message }, { status: 500 });

  const leadIds = Array.from(new Set((registrations || []).map(r => r.lead_id)));
  let leadsById: Record<string, { name: string | null; email: string | null; phone: string | null }> = {};
  if (leadIds.length > 0) {
    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, phone')
      .in('id', leadIds);
    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
    leadsById = Object.fromEntries((leads || []).map(l => [l.id, { name: l.name, email: l.email, phone: l.phone }]));
  }

  return NextResponse.json({ registrations: registrations || [], programs: programs || [], leadsById });
}
