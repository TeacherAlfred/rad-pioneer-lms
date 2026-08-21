import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Backs the Lead Journey Kanban board - a read model over `leads`, not a
// duplicate of /admin/lead-funnel's own list (which stays the place to see
// full lead detail/notes/finance).
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, source, lifecycle_stage, stage_entered_at, stage_health, last_inbound_at, needs_human')
    .order('stage_entered_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data || [] });
}
