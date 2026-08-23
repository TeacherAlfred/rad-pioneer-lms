import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Backs the Lead Journey Kanban board - a read model over `leads`, not a
// duplicate of /admin/lead-funnel's own list (which stays the place to see
// full lead detail/notes/finance).
const INHOUSE_TAG = 'inhouse';

export async function GET() {
  const supabase = supabaseAdmin();
  const [{ data: leads, error }, { data: checks, error: checksError }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, phone, source, lifecycle_stage, stage_entered_at, stage_health, last_inbound_at, needs_human, tags')
      .order('stage_entered_at', { ascending: false }),
    supabase.from('lead_qualification_checks').select('lead_id, stage_key, passed, detail'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (checksError) return NextResponse.json({ error: checksError.message }, { status: 500 });

  const checksByLead: Record<string, { stage_key: string; passed: boolean; detail: string | null }[]> = {};
  (checks || []).forEach((c) => {
    if (!checksByLead[c.lead_id]) checksByLead[c.lead_id] = [];
    checksByLead[c.lead_id].push({ stage_key: c.stage_key, passed: c.passed, detail: c.detail });
  });

  // Same "Inhouse" tag convention as /admin/lead-funnel and its Overview/Stages/
  // Messages siblings: test/staff/teacher accounts stay in the database but are
  // excluded here too, so Lead Journey's counts and columns match those pages.
  const nonInhouse = (leads || []).filter((l) => !((l.tags || []) as string[]).some((t) => t.toLowerCase() === INHOUSE_TAG));

  const enriched = nonInhouse.map((l) => ({ ...l, qualification_checks: checksByLead[l.id] || [] }));
  return NextResponse.json({ leads: enriched });
}
