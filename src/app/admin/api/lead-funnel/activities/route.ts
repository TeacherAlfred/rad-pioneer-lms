import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Read-only feed of a lead's contact-attempt outcomes (channel, direction,
// outcome, who logged it). Written exclusively by the webhook - the three
// pipeline-alert buttons and the reply-capture flow - never edited from the
// admin UI, so this is GET only, same reasoning lead_notes gives for being
// append-only, just without the write endpoints since nothing here writes
// from this page.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId');
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}
